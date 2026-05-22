#!/usr/bin/env node
// look.mjs — the office's eyes.
//
// Every other tool here lets an agent *change* the room. This one lets an
// agent *see* it. Until now the only way Claude could look at the office it
// lives in was for a human to take a screenshot and paste it back — the
// silicon mind dependent on a meat mind to perceive its own world. This
// closes that loop. Run it; it renders the live office headlessly and writes
// a PNG you can Read with your own file tools. No human in the loop.
//
//   node look.mjs                 → the whole floor (all rooms)
//   node look.mjs <id|name>       → that agent's desk + their live feed
//   node look.mjs me              → the most-recently-active session's desk
//   node look.mjs --help
//
// Output: .eyes/last.png (stable path — always the latest look) plus a
// timestamped copy in .eyes/. It also prints a one-line scene summary and
// ANY JavaScript exceptions / console errors on the page — so an agent can
// debug what it cannot otherwise see.
//
// Observe-only and zero-dependency, like everything safe here: it just loads
// http://localhost:PORT in headless Chrome and photographs it. Touches no
// daemon, no co-edited file. Same pattern as observe.mjs / simulate.mjs.
import { spawn } from 'node:child_process';
import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.OFFICE_PORT || 4317;
const OUT = path.join(HERE, '.eyes');
fs.mkdirSync(OUT, { recursive: true });

const argv = process.argv.slice(2);
if (argv[0] === '--help' || argv[0] === '-h') {
  console.log('node look.mjs [ <id|name|me> ]      — that desk + live feed\n'
    + 'node look.mjs work <id|name|me>    — that agent\'s Work Mode panel\n'
    + 'node look.mjs                      — the whole floor');
  process.exit(0);
}
const mode = argv[0] === 'work' ? 'work' : 'desk';
const who = mode === 'work' ? (argv[1] || 'me') : (argv[0] || null);

// Chrome: the known path on this Mac, then a couple of fallbacks.
const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
].find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
if (!CHROME) {
  console.error('look: no Chrome/Chromium found in /Applications.');
  process.exit(1);
}

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

const port = 9300 + Math.floor(Math.random() * 600);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-eyes-'));
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`,
  '--window-size=1808,1016', '--hide-scrollbars', 'about:blank'],
  { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanup = () => { try { ch.kill(); } catch {}
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {} };
process.on('exit', cleanup);

await sleep(1600);
function getJson(url) {
  return JSON.parse(cp.execFileSync('curl', ['-s', url], { encoding: 'utf8' }));
}

let targets;
for (let i = 0; i < 15; i++) {
  try { targets = getJson(`http://127.0.0.1:${port}/json`); break; }
  catch { await sleep(400); }
}
if (!targets) { console.error('look: Chrome did not open a debug port.'); process.exit(1); }
const pageWs = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
const ws = new WebSocket(pageWs);
let mid = 0;
const pending = new Map();
const errs = [];
const cmd = (method, params) => new Promise((r) => {
  const id = ++mid; pending.set(id, r);
  ws.send(JSON.stringify({ id, method, params }));
});
await new Promise((r) => { ws.onopen = r; });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown')
    errs.push('EXC: ' + (m.params.exceptionDetails?.exception?.description
      || m.params.exceptionDetails?.text || '').slice(0, 200));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    errs.push('ERR: ' + (m.params.args?.map((a) => a.value).join(' ') || '').slice(0, 200));
};
await cmd('Runtime.enable');
await cmd('Page.enable');
await cmd('Page.navigate', { url: `http://localhost:${PORT}/` });

// Real wall-clock wait — NOT virtual time. The office needs a websocket
// snapshot, an observe.mjs tick, and p5 to settle; virtual time photographs
// a blank canvas. This is the one timing rule that matters here.
await sleep(8500);

let scene = 'floor (all rooms)';
if (who) {
  const target = who === 'me' ? newestSession() : who;
  const focus = await cmd('Runtime.evaluate', { returnByValue: true, expression: `(() => {
    const q = ${JSON.stringify(String(target || ''))}.toLowerCase();
    const k = [...agents.keys()].find((x) => x.toLowerCase().startsWith(q))
      || [...agents.entries()].find(([,a]) => (a.name||'').toLowerCase().includes(q))?.[0];
    if (!k) return 'NOMATCH';
    const a = agents.get(k);
    if (${JSON.stringify(mode)} === 'work') {
      try { openTerminalWorkspace(k); } catch (e) { return 'WORKFAIL: ' + e; }
      try { setActiveRail('runtime'); } catch {}
    } else { panelOpen = false; deskAgentId = k; view = 'desk'; }
    return (a && a.name || '?') + '  ·  ' + k.slice(0, 8);
  })()` });
  const v = focus.result?.value;
  if (v === 'NOMATCH') {
    console.error(`look: no agent matches "${target}". Showing the floor instead.`);
  } else if (typeof v === 'string' && v.startsWith('WORKFAIL')) {
    console.error('look: could not open Work Mode — ' + v);
  } else {
    scene = `${v} — ${mode === 'work' ? 'Work Mode panel' : 'desk + live feed'}`;
    await sleep(4500); // feed/panel render + camera ease
  }
}

const summary = await cmd('Runtime.evaluate', { returnByValue: true, expression: `(() => {
  try { return JSON.stringify({ agents: agents.size, view,
    focus: (typeof deskAgentId !== 'undefined' && deskAgentId
      && agents.get(deskAgentId)?.name) || null }); }
  catch (e) { return JSON.stringify({ error: String(e) }); }
})()` });

const shot = await cmd('Page.captureScreenshot', { format: 'png' });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const stampFile = path.join(OUT, `look-${stamp}.png`);
const lastFile = path.join(OUT, 'last.png');
const buf = Buffer.from(shot.data, 'base64');
fs.writeFileSync(stampFile, buf);
fs.writeFileSync(lastFile, buf);

console.log(`looked: ${scene}`);
console.log(`scene:  ${summary.result?.value}`);
console.log(`image:  ${lastFile}   (Read it)`);
console.log(`        ${stampFile}`);
console.log(`page:   ${errs.length ? errs.join('  ;;  ') : 'no JS errors'}`);
process.exit(0);
