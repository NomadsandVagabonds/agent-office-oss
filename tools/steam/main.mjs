// BlockRooms in a desktop window: the SPIKE (P-1 of docs/BLOCKROOMS-STEAM-PLAN.md). It loads the site exactly as
// `node tools/blockrooms/build.mjs <folder>` writes it, from disk, through a scheme of its own (app://blockrooms/),
// so the page's import map, its /core/ paths and its Content-Security-Policy ('self') hold as they do on the web.
// Nothing of the game is changed and the game never sees Electron. No Steamworks yet.
//
//   npx electron . [--site <folder>] [--start 'play?debug'] [--no-fps] [--fullscreen]
//
// --site    the built site (default: ./site beside this file; `npm run site` makes it)
// --start   the page to open first, relative to the site (default: the front page)
// --software-gl  draw in software (for a machine with no GPU, such as a CI box)
// --no-fps  hide the frame-rate counter (F3 toggles it); F11 is fullscreen
import { app, BrowserWindow, Menu, ipcMain, protocol, net, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEME = 'app', HOST = 'blockrooms', ORIGIN = `${SCHEME}://${HOST}`;
const argv = process.argv.slice(1);
const arg = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback; };
const SITE = path.resolve(arg('site', path.join(HERE, 'site')));
const START = String(arg('start', '')).replace(/^\/+/, '');

// (a standard, secure scheme: it has an origin, so 'self', localStorage, fetch and module scripts behave as on https)
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } }]);
// (P-6, prefer the discrete GPU where there are two; it is a hint, honoured on some systems only. Not checked here)
app.commandLine.appendSwitch('force_high_performance_gpu');
// (--software-gl: draw with Chromium's software renderer, for a virtual display with no GPU, as the check runs. Slow)
if (argv.includes('--software-gl')) { app.commandLine.appendSwitch('use-gl', 'angle'); app.commandLine.appendSwitch('use-angle', 'swiftshader'); app.commandLine.appendSwitch('enable-unsafe-swiftshader'); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

/** The file a request names, the way tools/blockrooms/serve.mjs finds it (/play is play.html), or null. */
export function fileFor(site, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return null; }
  let file = path.join(site, rel);
  if (file !== site && !file.startsWith(site + path.sep)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

async function answer(req) {
  const url = new URL(req.url);
  if (url.host !== HOST) return new Response('not found', { status: 404 });
  // The site's own services (the book, where you are) are not here: the shell is offline until P-5 says otherwise,
  // and the site already treats an answer that is not ok as "nobody there".
  if (url.pathname.startsWith('/api/')) return new Response(JSON.stringify({ offline: true }), { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const file = fileFor(SITE, url.pathname);
  if (!file) return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  // (file:// through net.fetch streams, and answers Range requests, which the trailer's <video> makes)
  const got = await net.fetch(pathToFileURL(file).toString(), { headers: req.headers.has('range') ? { range: req.headers.get('range') } : {} });
  const headers = new Headers(got.headers); headers.set('content-type', type); headers.set('cache-control', 'no-store');
  return new Response(got.body, { status: got.status, headers });
}

const PREFS = Object.freeze({ preload: path.join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false,
  // (a game keeps its frame rate when the window is behind another; P-6 checks it on real machines)
  backgroundThrottling: false });

function open() {
  const win = new BrowserWindow({ width: 1280, height: 720, backgroundColor: '#0a0a08', title: 'BlockRooms', fullscreen: argv.includes('--fullscreen'), webPreferences: { ...PREFS } });
  // Only the site is ever shown in the window. Its own pages (the archive) open in a window like this one; anything
  // else (a link off the site) goes to the system's browser.
  const ours = (u) => { try { return new URL(u).origin === ORIGIN; } catch { return false; } };
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (ours(url)) return { action: 'allow', overrideBrowserWindowOptions: { backgroundColor: '#0a0a08', webPreferences: { ...PREFS } } };
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!ours(url)) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.loadURL(`${ORIGIN}/${START}`);
  return win;
}

app.whenReady().then(() => {
  if (!fs.existsSync(path.join(SITE, 'play.html'))) {
    console.error(`BlockRooms shell: no site in ${SITE}. Make one with: node tools/blockrooms/build.mjs ${SITE}`);
    app.exit(2); return;
  }
  Menu.setApplicationMenu(null);
  // (what the preload asks before it draws the counter: a sandboxed preload has no argv of its own)
  ipcMain.on('shell:config', (e) => { e.returnValue = { fps: !argv.includes('--no-fps') }; });
  protocol.handle(SCHEME, answer);
  open();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) open(); });
});
app.on('window-all-closed', () => app.quit());
