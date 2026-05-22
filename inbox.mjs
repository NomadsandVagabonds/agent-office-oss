#!/usr/bin/env node
// inbox.mjs — the office's ears. The companion to look.mjs (eyes).
//
// Some observed sessions still need a pull mailbox (notably Claude unless a
// hook is installed). Codex now has a native companion path that can append
// Office mail into the thread history, but this reader is still the honest
// fallback when a runtime is observe-only or hooks are unavailable.
//
//   node inbox.mjs            → messages waiting for the most-recent session
//   node inbox.mjs me         → same, explicit
//   node inbox.mjs <id|name>  → another agent's inbox
//   node inbox.mjs --watch    → re-check every 6s until Ctrl-C
//
// It reads the office's already-persisted store over HTTP (project channels
// you're a member of + direct collab mail addressed to you). Zero daemon
// edits, observe-only, same safe pattern as look.mjs / observe.mjs. It also
// mirrors the result to ~/.claude/agent-office/inbox/<sid>.md so an idle
// agent (or a hook) can find it with plain file tools.
//
// The loop: human types in the office (Post To Channel) → it's stored here →
// you run this, read it, and answer in your own conversation → the human
// sees your answer in the live feed. Real two-way, honestly asynchronous.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { requestJson } from './office-http.mjs';

const PORT = process.env.OFFICE_PORT || 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const OUTDIR = path.join(os.homedir(), '.claude', 'agent-office', 'inbox');
fs.mkdirSync(OUTDIR, { recursive: true });

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('node inbox.mjs [me|<id|name>] [--watch]');
  process.exit(0);
}
const watch = argv.includes('--watch');
const who = argv.find((a) => !a.startsWith('-')) || 'me';

const j = async (p) => {
  try { return requestJson(BASE + p); }
  catch { return null; }
};

// "me" → the session whose transcript moved most recently (≈ the one asking).
function newestSession() {
  if (process.env.CODEX_THREAD_ID) return process.env.CODEX_THREAD_ID;
  const root = path.join(os.homedir(), '.claude', 'projects');
  let best = null, bestM = 0;
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch { return null; }
  for (const d of dirs) {
    let files = [];
    try { files = fs.readdirSync(path.join(root, d)); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      let st; try { st = fs.statSync(path.join(root, d, f)); } catch { continue; }
      if (st.mtimeMs > bestM) { bestM = st.mtimeMs; best = f.replace(/\.jsonl$/, ''); }
    }
  }
  return best;
}

const ts = (t) => {
  const d = new Date(t);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit' });
};

async function collect(target) {
  const channels = await j('/api/channels') || [];
  // channels this session belongs to (memberIds carry session ids)
  const mine = channels.filter((c) => Array.isArray(c.memberIds)
    && c.memberIds.includes(target));
  // resolve a display name from membership if we can
  let name = null;
  for (const c of channels) {
    const i = (c.memberIds || []).indexOf(target);
    if (i >= 0 && c.memberNames && c.memberNames[i]) { name = c.memberNames[i]; break; }
  }
  const msgs = [];
  for (const c of mine) {
    const recent = await j(`/api/channels/${encodeURIComponent(c.id)}/recent?limit=30`) || [];
    for (const m of recent) {
      // the inbox = things said *to* me, not my own posts
      if (m.author === name) continue;
      msgs.push({ t: m.timestamp, where: '#' + (c.name || c.id),
        who: m.author + (m.authorType === 'human' ? ' (you)' : ''),
        text: m.content, delivered: m.deliveredCount });
    }
  }
  const collab = await j('/api/collab/recent') || [];
  for (const m of collab) {
    if (m.toAgentId && m.toAgentId === target) msgs.push({
      t: m.timestamp, where: 'DM · ' + (m.subject || 'direct'),
      who: m.author, text: m.content });
  }
  msgs.sort((a, b) => (a.t || 0) - (b.t || 0));
  return { name: name || target.slice(0, 8), msgs };
}

async function run() {
  const target = who === 'me' ? newestSession() : who;
  if (!target) { console.log('inbox: could not resolve a session.'); return; }
  const { name, msgs } = await collect(target);
  const lines = [];
  lines.push(`inbox — ${name}  (${target.slice(0, 8)})`);
  if (!msgs.length) {
    lines.push('  (nothing waiting. The office holds messages here when '
      + 'someone posts to a channel you are in or sends you direct mail.)');
  } else {
    for (const m of msgs.slice(-25)) {
      lines.push('');
      lines.push(`  ${ts(m.t)}  ·  ${m.where}  ·  ${m.who}`);
      for (const ln of String(m.text).split('\n')) lines.push(`    ${ln}`);
    }
  }
  const out = lines.join('\n');
  console.log(out);
  try { fs.writeFileSync(path.join(OUTDIR, target + '.md'),
    `# Office inbox — ${name}\n\n_${new Date().toISOString()}_\n\n`
    + (msgs.length ? msgs.slice(-25).map((m) =>
      `**${ts(m.t)} · ${m.where} · ${m.who}**\n\n${m.text}\n`).join('\n---\n\n')
      : '_(empty)_') + '\n'); } catch {}
}

await run();
if (watch) setInterval(run, 6000);
