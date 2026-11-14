#!/usr/bin/env node
// Film one shot of the office, frame by frame, on a virtual clock.
//
//   node rig/capture.mjs shots/<file>.mjs [--shot name] [--out dir] [--size 1920x1080] [--fps 30] [--seconds n] [--still t1,t2] [--base url]
//
// A shot is an ES module whose default export is:
//   {
//     name, base, url,               where to point the browser (base may be overridden with --base)
//     size: [w, h], fps, seconds,
//     tape, tapeStart,               optional: a recording of the daemon's stream to play back (see rig/tape.mjs)
//     ready,                         optional: a JS expression that is true once the page can be filmed
//     settle,                        seconds of held time to run after ready, before setup (default 1)
//     setup(arg),                    runs IN THE PAGE once, before the first frame (may be async)
//     tick(t, i, arg),               runs IN THE PAGE before each frame; t in seconds from the start of the take
//     arg,                           plain data handed to setup and tick
//     html,                          a file to serve at `url` instead of asking the daemon for it (the title cards)
//     dsf,                           device pixels per CSS pixel (the page is laid out at size / dsf)
//     actions, pointer,              a hand on the mouse and keyboard, on the take's clock (see hand() below)
//     answers,                       { 'POST /api/…*': json } — requests answered here instead of by the daemon
//     pre,                           seconds to run after setup but before recording (clock and tape moving): the take is already under way when the camera rolls
//     blind, unblind,                JS to stop and restart drawing around that run-in, so it costs nothing
//   }
// --still t1,t2 writes PNGs at those times instead of a clip (cheap: for checking a framing).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const file = argv[0];
const flag = {};
for (let i = 1; i < argv.length; i += 2) flag[argv[i].replace(/^--/, '')] = argv[i + 1];
if (!file) { console.error('usage: node rig/capture.mjs shots/<name>.mjs [--out dir] [--size WxH] [--fps n] [--seconds n] [--still t1,t2]'); process.exit(1); }

// a file may hold one shot (its default export) or several (export const shots = { name: {…} }; pick with --shot name)
const mod = await import(pathToFileURL(path.resolve(file)).href);
const shot = flag.shot ? mod.shots?.[flag.shot] : mod.default;
if (!shot) { console.error(`no such shot${flag.shot ? ` "${flag.shot}"` : ''} in ${file}${mod.shots ? ' — it has: ' + Object.keys(mod.shots).join(', ') : ''}`); process.exit(1); }
if (flag.shot && !shot.name) shot.name = flag.shot;
const [W, H] = flag.size ? flag.size.split('x').map(Number) : shot.size || [1920, 1080];
const fps = Number(flag.fps || shot.fps || 30);
const seconds = Number(flag.seconds || shot.seconds || 5);
const outDir = path.resolve(flag.out || path.join(HERE, '..', 'out', 'clips'));
const stills = flag.still ? flag.still.split(',').map(Number) : null;
const base = flag.base || shot.base || 'http://localhost:4401';
fs.mkdirSync(outDir, { recursive: true });

const tape = shot.tape ? JSON.parse(fs.readFileSync(path.resolve(path.dirname(path.resolve(file)), shot.tape), 'utf8')) : null;
const config = { tape, tapeStart: shot.tapeStart || 0, t0: shot.t0 };

// Software GL either way, but Mesa's llvmpipe draws this scene about four times faster than SwiftShader. It needs a
// real (virtual) display: run under `xvfb-run -a -s "-screen 0 2048x1280x24"` with LIBGL_ALWAYS_SOFTWARE=1 and it is used.
const mesa = !!process.env.DISPLAY && process.env.PROMO_GL !== 'swiftshader';
const browser = await chromium.launch(mesa
  ? { headless: false, args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--hide-scrollbars', `--window-size=${W},${H + 90}`] }
  : { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
// dsf: draw a smaller page at more pixels per pixel — text an interface was set in 13px for is then readable on a phone
const dsf = Number(flag.dsf || shot.dsf || 1);
const context = await browser.newContext({ viewport: { width: Math.round(W / dsf), height: Math.round(H / dsf) }, deviceScaleFactor: dsf, reducedMotion: 'no-preference' });
const page = await context.newPage();
// answers the tape holds, and answers the shot makes up (so that what a hand does on camera changes nothing in the daemon)
const canned = { ...(tape?.http || {}), ...(shot.answers || {}) };
if (Object.keys(canned).length) await page.route('**/api/**', (route) => {
  const u = new URL(route.request().url()), key = u.pathname + u.search, method = route.request().method();
  const hit = Object.keys(canned).find((k) => (k.includes(' ') ? k === `${method} ${key}` || (k.endsWith('*') && `${method} ${key}`.startsWith(k.slice(0, -1))) : method === 'GET' && k === key));
  return hit ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(canned[hit]) }) : route.continue();
});
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 240)); });
page.on('pageerror', (e) => problems.push('page: ' + String(e).slice(0, 240)));
if (shot.storage) await context.addInitScript((data) => { try { for (const [k, v] of Object.entries(data)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch { /* fine */ } }, shot.storage);
await context.addInitScript({ content: `window.__PROMO = ${JSON.stringify(config)};` });
await context.addInitScript({ path: path.join(HERE, 'inject.js') });

// a page of the film's own (the title cards): served from this file at the shot's address, so it shares the office's origin
if (shot.html) {
  const body = fs.readFileSync(path.resolve(path.dirname(path.resolve(file)), shot.html), 'utf8');
  await page.route((u) => u.pathname === shot.url.split('?')[0], (route) => route.fulfill({ status: 200, contentType: 'text/html', body }));
}
const started = Date.now();
await page.goto(base + shot.url, { waitUntil: 'load' });
const frame = (ms, hold) => page.evaluate(([m, h]) => window.__vt.frame(m, h), [ms, hold]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// let it load: move the frame clock (things animate in, lazy imports resolve) while the calendar and the tape stand still
const ready = shot.ready || '!!(window.office && window.office.ready && window.office.stage.frame > 2)';
let ok = false;
for (let i = 0; i < 400 && !ok; i++) {
  await frame(50, true);
  await sleep(40);
  ok = await page.evaluate(ready).catch(() => false);
}
if (!ok) console.error(`[capture] ${shot.name}: never became ready; filming what there is`);
for (let i = 0; i < Math.round((shot.settle ?? 1) * 20); i++) { await frame(50, true); if (i % 5 === 0) await sleep(20); }
await page.evaluate(() => document.fonts?.ready).catch(() => null);

// a shot's functions are written as methods; turn `name(a) {…}` back into something that can stand alone as an expression
const src = (fn) => { const s = fn.toString(); return /^(async\s+)?(function\b|\()/.test(s) || /^(async\s+)?[\w$]+\s*=>/.test(s) ? s : s.replace(/^(async\s+)?/, '$1function '); };
const call = (fn, ...args) => page.evaluate(`(${src(fn)})(...${JSON.stringify(args)})`);
if (shot.setup) await call(shot.setup, shot.arg ?? null);
// some set-ups wait on real things (a module to import, an image to decode): give them real time and held frames
for (let i = 0; i < Math.round((shot.afterSetup ?? 0.5) * 20); i++) { await frame(50, true); await sleep(20); }
if (shot.readyAfterSetup) {
  for (let i = 0; i < 400; i++) { if (await page.evaluate(shot.readyAfterSetup).catch(() => false)) break; await frame(50, true); await sleep(40); }
}

const dt = 1000 / fps;
const tickSrc = shot.tick ? `(${src(shot.tick)})` : null;

/* ---- a hand on the mouse and keyboard: shot.actions = [{ at, click | hover: { css, text? }, dur? } | { at, type, cps? } | { at, key } | { at, js }] ---- */
const acts = (shot.actions || []).map((a) => ({ ...a })).sort((a, b) => a.at - b.at);
let pointer = Array.isArray(shot.pointer) ? { x: shot.pointer[0], y: shot.pointer[1] } : { x: W / dsf * 0.6, y: H / dsf * 0.6 }, glide = null;
const typing = [];
if (acts.length && shot.pointer !== false) {
  await page.evaluate(([x, y]) => {
    const c = document.createElement('div');
    c.id = 'promo-pointer';
    c.innerHTML = '<svg width="22" height="30" viewBox="0 0 11 15" shape-rendering="crispEdges"><path d="M1 1v11l3-3 2 5 2-1-2-5h4z" fill="#f4ecd6" stroke="#14110f" stroke-width="1"/></svg>';
    c.style.cssText = `position:fixed;left:0;top:0;z-index:99999;pointer-events:none;transform:translate(${x}px,${y}px);transform-origin:2px 2px;`;
    document.documentElement.appendChild(c);
    document.addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)${c.dataset.down ? ' scale(.82)' : ''}`; c.dataset.x = e.clientX; c.dataset.y = e.clientY; }, true);
    document.addEventListener('mousedown', () => { c.dataset.down = '1'; c.style.transform = `translate(${c.dataset.x}px,${c.dataset.y}px) scale(.82)`; setTimeout(() => { delete c.dataset.down; c.style.transform = `translate(${c.dataset.x}px,${c.dataset.y}px)`; }, 140); }, true);
  }, [pointer.x, pointer.y]);
  await page.mouse.move(pointer.x, pointer.y);
}
// a target is something on the page ({ css, text?, nth?, px?, py? }) or a point worked out in the page
// ({ at: 'js' } → [x, y] in CSS pixels: where something in the 3D office is on screen, say)
const boxOf = (spec) => spec.at ? page.evaluate(spec.at).then((p) => (Array.isArray(p) ? { x: p[0], y: p[1], w: 0, h: 0 } : null)) : page.evaluate(({ css, text, nth }) => {
  const all = [...document.querySelectorAll(css || '*')].filter((el) => !text || (el.innerText || el.textContent || '').trim().toLowerCase().includes(String(text).toLowerCase()));
  const smallest = text && !css ? all.filter((el) => !all.some((o) => o !== el && el.contains(o))) : all;
  const el = smallest[nth || 0];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, spec);
async function hand(t) {
  for (const a of acts) {
    if (a.done || t < a.at) continue;
    a.done = true;
    const target = a.click || a.hover;
    if (target) {
      const box = await boxOf(target);
      if (!box) { problems.push(`hand: nothing matches ${JSON.stringify(target)} at ${a.at}s`); continue; }
      glide = { from: { ...pointer }, to: { x: box.x + box.w * (target.px ?? 0.5), y: box.y + box.h * (target.py ?? 0.5) }, t0: t, dur: a.dur ?? 0.55, click: !!a.click };
    } else if (a.type !== undefined) typing.push({ text: a.type, t0: t, cps: a.cps || 24, sent: 0 });
    else if (a.key) await page.keyboard.press(a.key);
    else if (a.js) await page.evaluate(a.js);
  }
  if (glide) {
    const k = Math.min(1, (t - glide.t0) / Math.max(0.01, glide.dur)), e = k * k * (3 - 2 * k);
    pointer = { x: glide.from.x + (glide.to.x - glide.from.x) * e, y: glide.from.y + (glide.to.y - glide.from.y) * e };
    await page.mouse.move(pointer.x, pointer.y);
    if (k >= 1) { if (glide.click) { await page.mouse.down(); await page.mouse.up(); } glide = null; }
  }
  for (const ty of typing) {
    const want = Math.min(ty.text.length, Math.floor((t - ty.t0) * ty.cps));
    if (want > ty.sent) { await page.keyboard.type(ty.text.slice(ty.sent, want)); ty.sent = want; }
  }
}
const runFrame = async (t, i) => {
  if (acts.length && t >= 0) await hand(t);
  await page.evaluate(`(async () => { ${tickSrc ? `await ${tickSrc}(${t}, ${i}, ${JSON.stringify(shot.arg ?? null)});` : ''} await window.__vt.frame(${dt}, false); })()`);
};

// run-in: the take is already moving when the camera rolls
const pre = Math.round((shot.pre || 0) * fps);
if (pre && shot.blind) await page.evaluate(shot.blind);            // nobody is watching the run-in: it need not be drawn
for (let i = 0; i < pre; i++) await runFrame((i - pre) / fps, i - pre);
if (pre && shot.unblind) { await page.evaluate(shot.unblind); await page.evaluate(() => window.__vt.frame(0, true)); }

const cdp = await context.newCDPSession(page);
// at more than one device pixel per CSS pixel the picture has to be asked for at that scale, or it comes back at one
const scaled = dsf !== 1 ? { clip: { x: 0, y: 0, width: Math.round(W / dsf), height: Math.round(H / dsf), scale: dsf } } : {};
const grab = async (format = 'jpeg') => Buffer.from((await cdp.send('Page.captureScreenshot', { ...(format === 'png' ? { format: 'png' } : { format: 'jpeg', quality: 97 }), ...scaled })).data, 'base64');

if (stills) {
  const total = Math.round(Math.max(...stills) * fps);
  const want = new Map(stills.map((t) => [Math.round(t * fps), t]));
  for (let i = 0; i <= total; i++) {
    await runFrame(i / fps, i);
    if (want.has(i)) { const p = path.join(outDir, `${shot.name}@${want.get(i)}.png`); fs.writeFileSync(p, await grab('png')); console.log('still', p); }
  }
} else {
  const outFile = path.join(outDir, `${shot.name}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '13', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(seconds * fps);
  for (let i = 0; i < total; i++) {
    await runFrame(i / fps, i);
    const buf = await grab();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 30 === 0) process.stdout.write(`\r[capture] ${shot.name} ${i}/${total} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log(`\n[capture] ${outFile}  ${total} frames in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
if (problems.length) console.log('[capture] page said:\n  ' + [...new Set(problems)].slice(0, 8).join('\n  '));
await browser.close();
