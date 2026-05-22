#!/usr/bin/env node
// The Office — auto-inbox hook. Pairs with inbox.mjs (the manual read).
//
// The office can't push a message into a session it didn't spawn. But the
// session's OWN Claude Code hooks run. So: when the agent finishes a turn
// (Stop) or the human submits a prompt (UserPromptSubmit), this checks the
// office for NEW mail addressed to this exact session and surfaces it — so
// you just post in the office and the agent picks it up naturally, no "check
// your inbox" needed.
//
// Hard safety rules (a hook must never harm a session):
//  - fail OPEN: office down / any error / slow → exit 0, normal stop.
//  - one-shot: a per-session seen-marker means each message surfaces once.
//  - no loop: respects `stop_hook_active`; never blocks twice in a row.
//  - no history dump: first run for a session sets a baseline silently.
//  - tight timeouts: a fast no-op for the (common) no-mail case.
//  - direct mail always, plus project-channel posts from humans or teammates
//    (but never your own posts and never system noise).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ok = () => process.exit(0);                 // allow normal stop / no-op
process.on('uncaughtException', ok);
process.on('unhandledRejection', ok);
setTimeout(ok, 1500);                             // absolute backstop

const PORT = process.env.OFFICE_PORT || 4317;
const BASE = `http://localhost:${PORT}`;
const DIR = path.join(os.homedir(), '.claude', 'agent-office', 'inbox');

// This session's own display name, resolved the same way office-msg.mjs
// resolves the author it posts under. We still keep this self-author filter
// even now that agent posts are typed properly, because it protects against
// stale metadata and lets channel collaboration stay loop-free. Fail-open.
function resolveSelfName(sid, cwd) {
  try {
    const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
    const g = rd(path.join(os.homedir(), '.claude', 'agent-office', 'profiles.json'));
    const here = path.dirname(fileURLToPath(import.meta.url));
    const l = rd(path.join(here, '..', 'data', 'profiles.local.json'));
    const bySession = { ...(g.bySession || {}), ...(l.bySession || {}) };
    const byCwd = { ...(g.byCwd || {}), ...(l.byCwd || {}) };
    const prof = { ...(cwd && byCwd[cwd]), ...(sid && bySession[sid]) };
    return prof.name || null;
  } catch { return null; }
}

async function main() {
  let raw = '';
  for await (const c of process.stdin) raw += c;
  let ev = {};
  try { ev = JSON.parse(raw || '{}'); } catch { return ok(); }

  const sid = ev.session_id;
  const kind = ev.hook_event_name || ev.event || '';
  if (!sid) return ok();
  // Already continuing from a stop-hook injection → don't block again.
  if (kind === 'Stop' && ev.stop_hook_active) return ok();

  const j = async (p) => {
    try {
      const r = await fetch(BASE + p, { signal: AbortSignal.timeout(700) });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  };

  const channels = await j('/api/channels');
  if (channels === null) return ok();             // office not reachable

  const selfName = resolveSelfName(sid, ev.cwd);

  const mineCh = (channels || []).filter((c) =>
    c.kind === 'project' && Array.isArray(c.memberIds)
    && c.memberIds.includes(sid));

  const msgs = [];
  for (const c of mineCh) {
    const recent = await j(`/api/channels/${encodeURIComponent(c.id)}/recent?limit=20`);
    for (const m of (recent || [])) {
      if (m.authorType === 'system') continue;
      if (selfName && m.author === selfName) continue;  // not your own posts
      msgs.push({ t: m.timestamp || 0, where: '#' + (c.name || c.id),
        who: m.author || 'Lead', text: m.content || '' });
    }
  }
  const collab = await j('/api/collab/recent');
  for (const m of (collab || [])) {
    if (m.toAgentId === sid) msgs.push({ t: m.timestamp || 0,
      where: 'DM · ' + (m.subject || 'direct'), who: m.author || '?',
      text: m.content || '' });
  }
  if (!msgs.length) return ok();
  msgs.sort((a, b) => a.t - b.t);
  const maxTs = msgs[msgs.length - 1].t;

  fs.mkdirSync(DIR, { recursive: true });
  const seenFile = path.join(DIR, `.seen-${sid}.json`);
  let lastTs = null;
  try { lastTs = JSON.parse(fs.readFileSync(seenFile, 'utf8')).lastTs; } catch {}

  // First run for this session: set a baseline, surface nothing (history was
  // already readable via inbox.mjs and may be already answered).
  if (typeof lastTs !== 'number') {
    try { fs.writeFileSync(seenFile, JSON.stringify({ lastTs: maxTs })); } catch {}
    return ok();
  }

  const fresh = msgs.filter((m) => m.t > lastTs);
  if (!fresh.length) return ok();
  try { fs.writeFileSync(seenFile, JSON.stringify({ lastTs: maxTs })); } catch {}

  const fmt = fresh.map((m) => {
    const time = new Date(m.t).toLocaleString('en-US',
      { hour: 'numeric', minute: '2-digit' });
    return `[${m.who} · ${m.where} · ${time}] ${m.text}`;
  }).join('\n');

  const body =
    `\u{1F4EC} New Office mail came in while you were working `
    + `(project-channel coordination and/or direct mail, not ambient chatter):`
    + `\n\n${fmt}\n\n`
    + `Respond to it now in your normal reply. The human and other agents can `
    + `read your answer in the Office live feed. If it needs no action, `
    + `acknowledge briefly.`;

  if (kind === 'Stop') {
    process.stdout.write(JSON.stringify({ decision: 'block', reason: body }));
    return process.exit(0);
  }
  // UserPromptSubmit (or anything else): add as context, never block.
  process.stdout.write(body + '\n');
  return process.exit(0);
}
main();
