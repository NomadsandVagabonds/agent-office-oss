#!/usr/bin/env node
// Session Observatory — gives REAL Claude Code sessions a desk by reading
// their on-disk transcripts and emitting the daemon's standard hook events.
// OBSERVE-ONLY: we did not spawn these sessions and cannot control them
// (this is the contract's `provider:'unknown'` reality). Zero daemon edits —
// same safe pattern as simulate.mjs. Run + leave running:
//
//   node observe.mjs
//
// It does NOT replace the hook bridge: new sessions with hooks installed
// emit their own events; this surfaces the ones that otherwise wouldn't —
// including the conversation that is running right now. It ALSO writes a
// compact, read-only digest of each live session to
// `public/transcripts/<sid>.json` (the daemon serves public/ statically),
// so the office can show "what this session is doing" without any control.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TDIR = path.join(HERE, 'public', 'transcripts');
try { fs.mkdirSync(TDIR, { recursive: true }); } catch {}

const PORT = process.env.OFFICE_PORT || 4317;
const ROOT = path.join(os.homedir(), '.claude', 'projects');
const ACTIVE_MS = 15 * 60 * 1000;   // "present" if its transcript moved within
const FRESH_MS  = 25 * 1000;        // "actively working" if moved within
const TICK = 5000;
const FEED_TURNS = 140;             // keep only the last N turns in the digest
const FEED_CHARS = 1800;            // trim each turn's text to this (still
                                    // message text + tool NAMES only — never
                                    // tool I/O; longer ≠ a new leak class)

const post = (b) => fetch(`http://localhost:${PORT}/hook`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(b) }).catch(() => {});
const seen = new Map();             // sessionId -> { gone:boolean }

// "-home-dev-projects-webstore" -> "/home/dev/projects/webstore"
// (best effort; the transcript's own `cwd` field is preferred when present)
const deslug = (d) => '/' + d.replace(/^-/, '').replace(/-/g, '/');

function tailLines(file, bytes = 131072) {
  try {
    const fd = fs.openSync(file, 'r');
    const { size } = fs.fstatSync(fd);
    const len = Math.min(size, bytes);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    return buf.toString('utf8').split('\n').filter(Boolean);
  } catch { return []; }
}

function readSession(lines) {
  let cwd = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    let o; try { o = JSON.parse(lines[i]); } catch { continue; }
    if (o.cwd) { cwd = o.cwd; break; }
  }
  let status = 'thinking';
  for (let i = lines.length - 1; i >= 0; i--) {
    let o; try { o = JSON.parse(lines[i]); } catch { continue; }
    const m = o.message || o, c = m && m.content;
    if (o.type === 'assistant') {
      status = Array.isArray(c) && c.some((x) => x && x.type === 'tool_use')
        ? 'working' : 'thinking';
      break;
    }
    if (o.type === 'user') { status = 'working'; break; }
  }
  return { cwd, status };
}

const tidy = (s) => String(s).replace(/\s+/g, ' ').trim().slice(0, FEED_CHARS);

// Compact, READ-ONLY digest. Message text + tool *names* only — we never
// dump tool inputs/outputs (huge + leaky) and never read .env etc. Local
// file, served only to localhost; this is presence, not a control surface.
function writeFeed(sid, lines) {
  const turns = [];
  for (const ln of lines) {
    let o; try { o = JSON.parse(ln); } catch { continue; }
    if (o.type === 'user') {
      const c = (o.message || o).content;
      if (typeof c === 'string') {
        const x = tidy(c);
        if (x && !x.startsWith('<')) turns.push({ r: 'u', x });
      } else if (Array.isArray(c)) {
        for (const p of c) {
          if (p && p.type === 'text' && p.text && !p.text.startsWith('<'))
            turns.push({ r: 'u', x: tidy(p.text) });
        }
      }
    } else if (o.type === 'assistant') {
      const c = (o.message || {}).content;
      if (Array.isArray(c)) for (const p of c) {
        if (p && p.type === 'text' && p.text && p.text.trim())
          turns.push({ r: 'a', x: tidy(p.text) });
        else if (p && p.type === 'tool_use')
          turns.push({ r: 't', x: '↳ ' + (p.name || 'tool') });
      }
    }
  }
  const out = { sid, turns: turns.slice(-FEED_TURNS), at: Date.now() };
  const fp = path.join(TDIR, sid + '.json');
  try {
    fs.writeFileSync(fp + '.tmp', JSON.stringify(out));
    fs.renameSync(fp + '.tmp', fp);
  } catch {}
}

async function tick() {
  let dirs;
  try {
    dirs = fs.readdirSync(ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name);
  } catch { return; }
  const now = Date.now(), live = new Set();
  for (const dir of dirs) {
    const dp = path.join(ROOT, dir);
    let files;
    try {
      files = fs.readdirSync(dp).filter((f) => f.endsWith('.jsonl'));
    } catch { continue; }
    for (const f of files) {
      const full = path.join(dp, f);
      let st; try { st = fs.statSync(full); } catch { continue; }
      if (now - st.mtimeMs > ACTIVE_MS) continue;     // not a live session
      const sid = f.replace(/\.jsonl$/, '');
      live.add(sid);
      const lines = tailLines(full);
      const info = readSession(lines);
      const cwd = info.cwd || deslug(dir);
      if (!seen.has(sid)) {
        await post({ session_id: sid, cwd, transcript_path: full,
          hook_event_name: 'SessionStart' });
        seen.set(sid, { gone: false });
      }
      writeFeed(sid, lines);
      const fresh = now - st.mtimeMs < FRESH_MS;
      const base = { session_id: sid, cwd, transcript_path: full };
      if (fresh && info.status === 'working') {
        await post({ ...base, hook_event_name: 'PreToolUse',
          tool_name: '(observed)' });
      } else {
        await post({ ...base, hook_event_name: 'UserPromptSubmit' });
      }
      seen.get(sid).gone = false;
    }
  }
  // sessions that fell out of the active window -> walk them out, once
  for (const [sid, rec] of seen) {
    if (!live.has(sid) && !rec.gone) {
      await post({ session_id: sid, hook_event_name: 'SessionEnd' });
      rec.gone = true;
    }
  }
}

console.log('Session Observatory -> watching ~/.claude/projects '
  + '(observe-only; real sessions get desks + a read-only feed, '
  + 'including this one)');
tick();
setInterval(tick, TICK);
