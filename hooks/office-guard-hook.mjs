#!/usr/bin/env node
// The Office — the look-before-you-edit hook.
//
// Several agents in one repository step on each other. Just before Claude
// Code edits a file, this asks the office one question: has somebody else
// edited this file here in the last half hour, changed it on another branch,
// or claimed it? If so, the answer is handed to the agent as context next to
// the edit. It never blocks an edit and never asks the human anything: the
// agents sort it out between themselves (office dm …).
//
// Register on PreToolUse for Edit|Write|MultiEdit|NotebookEdit (node install-guard-hook.mjs).
//
// Hard safety rules, as for every hook here: fail OPEN (office down, slow, or
// any error → say nothing), tight timeouts, and each warning is given once
// per file and person, not on every keystroke (the office remembers).
const ok = () => process.exit(0);
process.on('uncaughtException', ok);
process.on('unhandledRejection', ok);
setTimeout(ok, 1200).unref();

const BASE = (process.env.OFFICE_URL || `http://localhost:${process.env.OFFICE_PORT || 4317}`).replace(/\/+$/, '');
const headers = process.env.OFFICE_TOKEN ? { authorization: `Bearer ${process.env.OFFICE_TOKEN}` } : {};

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let ev = {};
  try { ev = JSON.parse(raw || '{}'); } catch { return ok(); }
  const input = ev.tool_input || {};
  const file = input.file_path || input.notebook_path;
  if (!ev.session_id || typeof file !== 'string' || !file) return ok();
  let answer = null;
  try {
    const q = `agent=${encodeURIComponent(ev.session_id)}&path=${encodeURIComponent(file)}&once=1${ev.cwd ? `&cwd=${encodeURIComponent(ev.cwd)}` : ''}`;
    const res = await fetch(`${BASE}/api/workspace/check?${q}`, { headers, signal: AbortSignal.timeout(600) });
    if (!res.ok) return ok();                        // the office does not know this session, or is not there
    answer = await res.json();
  } catch { return ok(); }
  const warnings = Array.isArray(answer?.warnings) ? answer.warnings : [];
  if (!warnings.length) return ok();
  const text = 'From the office, before you change this file:\n' + warnings.map((w) => `- ${w.text}`).join('\n')
    + '\nYou may still go ahead; this is so you can decide with your eyes open.';
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: text } }));
  return ok();
}
main();
