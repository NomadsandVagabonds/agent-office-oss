#!/usr/bin/env node
// look.mjs — the office's eyes.
//
// Every other tool here lets an agent *change* the room. This one lets an
// agent *see* it: it renders the live office in a headless browser and writes
// a PNG you can open with your own file tools. No human has to take a
// screenshot for you. (For a description in words instead, `office look`
// costs far less — use this when you actually need the picture.)
//
//   node look.mjs                       the whole floor
//   node look.mjs <agent id|name|me>    that agent, close up
//   node look.mjs room <project|room>   one room
//   node look.mjs work [agent]          the Terminals panel
//   node look.mjs --classic [agent]     the original 2D office instead
//
//   --hour 22          render at a time of day (0–24)
//   --cam x,z,dist,yaw,pitch            an exact camera
//   --size 1600x1000   --wait 6000 (extra ms to let things settle)
//
// Output: .eyes/last.png (always the latest look) plus a timestamped copy.
// It also prints a one-line scene summary and ANY JavaScript errors on the
// page, so an agent can debug what it cannot otherwise see.
//
// Observe-only and zero-dependency: it loads http://localhost:PORT in headless
// Chrome/Chromium (set CHROME_PATH if yours lives somewhere unusual) and
// photographs it. Without a GPU the 3D office is drawn in software — slow,
// but correct.
import { spawn } from 'node:child_process';
import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.OFFICE_PORT || 4317;
const BASE = (process.env.OFFICE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const OUT = path.join(HERE, '.eyes');

const argv = process.argv.slice(2);
const flags = {};
const words = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--classic' || a === '--help' || a === '-h') flags[a.replace(/^-+/, '')] = true;
  else if (a.startsWith('--')) { flags[a.slice(2)] = argv[i + 1]; i++; } else words.push(a);
}
if (flags.help || flags.h) {
  console.log('node look.mjs                       the whole floor\n'
    + 'node look.mjs <agent id|name|me>    that agent, close up\n'
    + 'node look.mjs room <project|room>   one room\n'
    + 'node look.mjs work [agent]          the Terminals panel\n'
    + 'node look.mjs --classic [agent]     the original 2D office\n'
    + 'options: --hour 22 · --cam x,z,dist,yaw,pitch · --size 1600x1000 · --wait 6000');
  process.exit(0);
}
const mode = words[0] === 'work' ? 'work' : words[0] === 'room' ? 'room' : words.length ? 'agent' : 'floor';
const who = mode === 'work' || mode === 'room' ? (words[1] || (mode === 'work' ? 'me' : '')) : (words[0] || null);
const [W, H] = String(flags.size || '1600x1000').split('x').map(Number);

function findChrome() {
  const candidates = [process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium'].filter(Boolean);
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    for (const dir of (process.env.PATH || '').split(path.delimiter)) candidates.push(path.join(dir, name));
  }
  return candidates.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
}
const CHROME = findChrome();
if (!CHROME) {
  console.error('look: no Chrome or Chromium found. Set CHROME_PATH to its executable.');
  process.exit(1);
}

// "me" → the session asking: its runtime's id, else the newest Claude transcript.
function newestSession() {
  if (process.env.OFFICE_AGENT_ID) return process.env.OFFICE_AGENT_ID;
  if (process.env.CODEX_THREAD_ID) return process.env.CODEX_THREAD_ID;
  if (process.env.CLAUDE_SESSION_ID) return process.env.CLAUDE_SESSION_ID;
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

fs.mkdirSync(OUT, { recursive: true });
const port = 9300 + Math.floor(Math.random() * 600);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-eyes-'));
const ch = spawn(CHROME, ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', 'about:blank'],
  { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanup = () => { try { ch.kill(); } catch {}
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {} };
process.on('exit', cleanup);

await sleep(1200);
function getJson(url) {
  return JSON.parse(cp.execFileSync('curl', ['-s', url], { encoding: 'utf8' }));
}

let targets;
for (let i = 0; i < 20; i++) {
  try { targets = getJson(`http://127.0.0.1:${port}/json`); break; }
  catch { await sleep(400); }
}
if (!targets) { console.error('look: the browser did not open a debug port.'); process.exit(1); }
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
const evaluate = async (expression) => (await cmd('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression })).result?.value;
await cmd('Runtime.enable');
await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

const target = who === 'me' ? newestSession() : who;
let scene = 'the whole floor';

if (flags.classic) {
  /* ---- the original 2D office ---------------------------------------------- */
  await cmd('Page.navigate', { url: `${BASE}/classic/` });
  // Real wall-clock wait: the page needs a websocket snapshot and p5 to settle.
  await sleep(8500);
  if (target) {
    const v = await evaluate(`(() => {
      const q = ${JSON.stringify(String(target))}.toLowerCase();
      const k = [...agents.keys()].find((x) => x.toLowerCase().startsWith(q))
        || [...agents.entries()].find(([,a]) => (a.name||'').toLowerCase().includes(q))?.[0];
      if (!k) return 'NOMATCH';
      const a = agents.get(k);
      if (${JSON.stringify(mode)} === 'work') { try { openTerminalWorkspace(k); } catch (e) { return 'WORKFAIL: ' + e; } try { setActiveRail('runtime'); } catch {} }
      else { panelOpen = false; deskAgentId = k; view = 'desk'; }
      return (a && a.name || '?');
    })()`);
    if (v === 'NOMATCH') console.error(`look: no agent matches "${target}". Showing the floor instead.`);
    else if (typeof v === 'string' && v.startsWith('WORKFAIL')) console.error('look: could not open Work Mode — ' + v);
    else { scene = `${v} — classic ${mode === 'work' ? 'Work Mode' : 'desk'}`; await sleep(4500); }
  } else scene = 'the whole floor (classic)';
} else {
  /* ---- the 3D office -------------------------------------------------------- */
  const params = new URLSearchParams({ shot: '1' });
  if (flags.hour !== undefined) params.set('hour', String(flags.hour));
  if (flags.cam) params.set('cam', String(flags.cam));
  await cmd('Page.navigate', { url: `${BASE}/?${params}` });
  let ready = false;
  for (let i = 0; i < 80 && !ready; i++) {                         // up to ~40 s: software WebGL takes its time
    await sleep(500);
    ready = await evaluate('!!(window.office && window.office.ready && window.office.stage.frame > 2)').catch(() => false);
  }
  if (!ready) console.error('look: the office never finished loading (is the daemon up? does this browser have WebGL2?). Photographing what there is.');
  if (ready && mode === 'room' && who) {
    const v = await evaluate(`(() => {
      const q = ${JSON.stringify(String(who))}.toLowerCase().replace(/[^a-z0-9]+/g, '');
      const rooms = office.world.layout.rooms.filter((r) => !r.locked);
      const r = rooms.find((x) => [x.id, x.name, x.deptId].some((s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '') === q))
        || rooms.find((x) => String(x.name).toLowerCase().replace(/[^a-z0-9]+/g, '').includes(q));
      if (!r) return 'NOMATCH';
      office.rig.frame(r.rect, { instant: true });
      return r.name;
    })()`);
    if (v === 'NOMATCH') console.error(`look: no room matches "${who}". Showing the floor instead.`); else scene = `${v} (room)`;
  } else if (ready && target && (mode === 'agent' || mode === 'work')) {
    const v = await evaluate(`(async () => {
      const q = ${JSON.stringify(String(target))}.toLowerCase();
      const all = [...office.net.state.agents.values()];
      const a = all.find((x) => x.id.toLowerCase().startsWith(q)) || all.find((x) => (x.name || '').toLowerCase().includes(q));
      if (!a) return 'NOMATCH';
      office.ui.select(a.id);
      office.rig.flyTo({ dist: 8.5, pitch: 0.6, yaw: 0.3 }, { instant: true, follow: () => office.people.positionOf(a.id) });
      if (${JSON.stringify(mode)} === 'work') await office.ui.openSheet('work', { sessionId: a.runtimeSessionId || undefined });
      return a.name;
    })()`);
    if (v === 'NOMATCH') console.error(`look: no agent matches "${target}". Showing the floor instead.`);
    else scene = `${v} — ${mode === 'work' ? 'Terminals panel' : 'close up'}`;
  } else if (ready && mode === 'work') { await evaluate("office.ui.openSheet('work').then(() => 1)"); scene = 'Terminals panel'; }
  // let the camera land, walls fold, and a few frames draw
  const before = await evaluate('window.office ? office.stage.frame : 0').catch(() => 0);
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const now = await evaluate('window.office ? office.stage.frame : 0').catch(() => 0);
    if (now - before >= 8) break;
  }
}
await sleep(Number(flags.wait) || 300);

const summary = await evaluate(flags.classic
  ? `(() => { try { return JSON.stringify({ agents: agents.size, view }); } catch (e) { return JSON.stringify({ error: String(e) }); } })()`
  : `(() => { try { const s = office.net.state, list = [...s.agents.values()];
      return JSON.stringify({ agents: list.length, needYou: s.prompts.filter((p) => p.status === 'pending').length,
        rooms: (s.world?.plan?.rooms || []).length, selected: office.selected ? s.agents.get(office.selected)?.name : null,
        frameMs: Math.round(office.stage.frameMs) }); }
    catch (e) { return JSON.stringify({ error: String(e) }); } })()`).catch(() => '{}');

const shot = await cmd('Page.captureScreenshot', { format: 'png' });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const stampFile = path.join(OUT, `look-${stamp}.png`);
const lastFile = path.join(OUT, 'last.png');
const buf = Buffer.from(shot.data, 'base64');
fs.writeFileSync(stampFile, buf);
fs.writeFileSync(lastFile, buf);

console.log(`looked: ${scene}`);
console.log(`scene:  ${summary}`);
console.log(`image:  ${lastFile}   (open it)`);
console.log(`        ${stampFile}`);
console.log(`page:   ${errs.length ? errs.join('  ;;  ') : 'no JS errors'}`);
process.exit(0);
