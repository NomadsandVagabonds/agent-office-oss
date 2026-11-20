// The Backrooms — the graphics screen at launch, and the screen for a machine that cannot draw the level at all.
//
// First launch (site.js, before the first visit; the dev page with &launch=1): tape static, and over it the tiers, Auto
// first and chosen. Behind the static the level is drawn for real: a visit to a fixed building (launch.rule.js BENCH),
// quiet, with nobody in it, built at the top tier (High, or Ultra once there is one); once it has landed, that tier is
// measured while the view turns round the room, then each lower one only while none has held. Auto shows what it
// picked; the player may take it or another tier, and the choice is the Graphics setting from then on, remembered
// (launch.rule.js LAUNCH_KEY) so that the screen does not come back. Settings offers it again (menu.js Test, by Graphics): then it is measured on the paused picture of the visit
// itself, and the choice is applied there and then.
//
// No words but the tiers' names and what Auto chose: words live in the world (the owner's rule).
import { h } from '../ui/dom.js';
import { profile as graphicsProfile, showDetail } from './graphics.js';
import { LAUNCH_TIERS, LAUNCH_KEY, BENCH_ORDER, BENCH, frameStats, holds, autoPick, cleanLaunchRecord } from './launch.rule.js';

const PREFS = 'office.backrooms';                  // (index.js prefs: the camcorder's saved settings)
const LABEL = { auto: 'AUTO', low: 'LOW', medium: 'MEDIUM', high: 'HIGH', ultra: 'ULTRA', classic: 'CLASSIC' };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- what is remembered -------------------------------------------------------------------------- */

/** The choice made on the screen, if one has been ({ tier, auto, picked }), else null. */
export function launchRecord() {
  try { return cleanLaunchRecord(JSON.parse(localStorage.getItem(LAUNCH_KEY) || 'null')); } catch { return null; }
}
/** Whether the screen is to be shown before the visit: until a choice has been made on it. */
export const shouldAsk = () => !launchRecord();
function remember(rec) { try { localStorage.setItem(LAUNCH_KEY, JSON.stringify(rec)); } catch { /* asked again next time, then */ } }
const readRaw = () => { try { return localStorage.getItem(PREFS); } catch { return null; } };
function writeRaw(raw) { try { if (raw === null) localStorage.removeItem(PREFS); else localStorage.setItem(PREFS, raw); } catch { /* private mode */ } }
/** The Graphics setting, put in the saved settings and nothing else of them touched. */
function saveTier(tier) {
  let was = {};
  try { const v = JSON.parse(readRaw() || '{}'); if (v && typeof v === 'object' && !Array.isArray(v)) was = v; } catch { /* nothing saved yet */ }
  writeRaw(JSON.stringify({ ...was, graphics: tier }));
}

/* ---- can it draw at all -------------------------------------------------------------------------- */

/** Can this machine draw the level: a WebGPU adapter, or WebGL 2 (WebGPURenderer's other backend). Never throws. */
export async function graphicsAvailable() {
  try { if (globalThis.navigator?.gpu && (await navigator.gpu.requestAdapter())) return true; } catch { /* no adapter */ }
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (gl) { gl.getExtension('WEBGL_lose_context')?.loseContext(); return true; }
  } catch { /* no WebGL 2 */ }
  return false;
}

/* ---- the look ------------------------------------------------------------------------------------ */

const CSS = `
.br-launch { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; overflow: hidden; background: #0a0a08; color: #f4f1e6;
  font: 700 22px/1.2 "Courier New", ui-monospace, Menlo, Consolas, monospace; letter-spacing: .1em;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; transition: opacity .45s; }
.br-launch.is-gone { opacity: 0; pointer-events: none; }
.br-launch-static { position: absolute; inset: 0; width: 100%; height: 100%; opacity: .6; }
/* the tape's lines, and the dark at the edges of an old tube */
.br-launch-lines { position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(to bottom, rgba(0, 0, 0, .3) 0 1px, transparent 1px 3px), radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, .7) 100%); }
/* the viewfinder: its four corners, and the red dot of a camcorder that is on */
.br-launch-frame { position: absolute; inset: max(14px, 4vmin); pointer-events: none; }
.br-launch-frame i { position: absolute; width: clamp(18px, 5vmin, 40px); height: clamp(18px, 5vmin, 40px); border: 3px solid rgba(244, 241, 230, .85);
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .7)); }
.br-launch-frame i:nth-child(1) { left: 0; top: 0; border-right: 0; border-bottom: 0; }
.br-launch-frame i:nth-child(2) { right: 0; top: 0; border-left: 0; border-bottom: 0; }
.br-launch-frame i:nth-child(3) { left: 0; bottom: 0; border-right: 0; border-top: 0; }
.br-launch-frame i:nth-child(4) { right: 0; bottom: 0; border-left: 0; border-top: 0; }
.br-launch-frame b { position: absolute; left: clamp(28px, 7vmin, 60px); top: clamp(26px, 6.5vmin, 56px); width: 16px; height: 16px; border-radius: 50%;
  background: #ff3a26; box-shadow: 0 0 8px rgba(255, 58, 38, .75); animation: br-launch-blink 1.4s steps(2, start) infinite; }
.br-launch-stack { position: relative; display: flex; flex-direction: column; align-items: center; gap: clamp(14px, 4vmin, 34px);
  padding: 16px; max-width: 100%; box-sizing: border-box; }
.br-launch-logo { display: block; width: min(76vw, 420px, 50vh); height: auto; image-rendering: pixelated; filter: drop-shadow(0 5px 0 rgba(0, 0, 0, .6)); }
/* the camcorder's own menu: its lettering (hud.js), fringed red and blue as a tape smears it, on a dark band, with the
   picture's tracking slipping now and then */
.br-launch-list { position: relative; display: grid; gap: 3px; padding: 12px 14px 14px; min-width: min(330px, calc(100vw - 32px)); box-sizing: border-box;
  background: rgba(8, 8, 6, .76); text-shadow: .055em 0 rgba(255, 60, 40, .45), -.055em 0 rgba(60, 220, 255, .4), 0 .08em .1em rgba(0, 0, 0, .85);
  opacity: 0; transition: opacity .35s; animation: br-launch-track 7s steps(1) infinite; }
.br-launch-list.is-up { opacity: 1; }
.br-launch-head { padding: 2px 16px 10px 40px; margin-bottom: 6px; border-bottom: 2px solid rgba(244, 241, 230, .55); letter-spacing: .24em; }
.br-launch-row { position: relative; appearance: none; margin: 0; border: 0; border-radius: 0; padding: 10px 16px 10px 40px; background: none; color: inherit;
  font: inherit; letter-spacing: inherit; text-align: left; text-shadow: inherit; cursor: pointer; touch-action: manipulation; }
.br-launch-row.is-on { background: #f4f1e6; color: #15140f; text-shadow: none; }
.br-launch-row.is-on::before { content: "\\25B6"; position: absolute; left: 14px; }
.br-launch-row:focus { outline: none; }
.br-launch-row:focus-visible { outline: 2px dashed currentColor; outline-offset: -5px; }
.br-launch-row.is-on:focus-visible { outline-color: transparent; }
.br-launch-pick { opacity: .72; }
.br-launch-wait { animation: br-launch-blink 1s steps(2, start) infinite; }
@keyframes br-launch-blink { to { visibility: hidden; } }
@keyframes br-launch-track { 0%, 91%, 100% { transform: none; } 92% { transform: translateX(4px) skewX(-3deg); } 93% { transform: translateX(-3px); } 94% { transform: translateX(1px) skewX(1deg); } }
.br-launch-fault { position: relative; display: grid; gap: 14px; padding: 16px 22px; max-width: calc(100vw - 32px); box-sizing: border-box; text-align: center;
  background: rgba(8, 8, 6, .76); font-size: 16px; text-shadow: .055em 0 rgba(255, 60, 40, .45), -.055em 0 rgba(60, 220, 255, .4), 0 .08em .1em rgba(0, 0, 0, .85); }
.br-launch-fault strong { color: #ff3a26; font-size: 34px; }
@media (max-width: 420px) { .br-launch { font-size: 19px; } }
/* a phone on its side: the name beside the menu, not over it */
@media (orientation: landscape) and (max-height: 520px) {
  .br-launch { font-size: 18px; }
  .br-launch-stack { flex-direction: row; gap: clamp(18px, 5vw, 48px); }
  .br-launch-logo { width: min(38vw, 340px, 62vh); }
  .br-launch-row { padding-top: 7px; padding-bottom: 7px; }
}
@media (prefers-reduced-motion: reduce) { .br-launch-wait, .br-launch-frame b, .br-launch-list { animation: none; } }
`;
let styled = false;
function style() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  document.head.append(h('style', { id: 'br-launch-css' }, CSS));
}

/**
 * A screen of tape static in the camcorder's viewfinder, put in `host` (or returned to be put somewhere). logo(canvas):
 * draws the name over it and → a stop (the site's art.js drawLogo, as on the front page; none where a page has none).
 * Whatever goes on it goes in `stack`, under the name.
 */
function screen(host, { logo } = {}) {
  style();
  const canvas = h('canvas.br-launch-static', { width: 192, height: 144, 'aria-hidden': 'true' });
  const name = logo ? h('canvas.br-launch-logo', { role: 'img', 'aria-label': 'BlockRooms' }) : null;
  const stack = h('div.br-launch-stack', name);
  const el = h('div.br-launch', canvas, h('div.br-launch-lines', { 'aria-hidden': 'true' }),
    h('div.br-launch-frame', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('b')), stack);
  host?.append(el);
  let stopLogo = null;
  try { stopLogo = name ? logo(name) : null; } catch { name?.remove(); }
  // a small picture of noise, drawn a dozen times a second and stretched over the screen: next to nothing for the
  // machine to do while it is being measured behind it
  const ctx = canvas.getContext('2d'), w = canvas.width, ht = canvas.height;
  const img = ctx?.createImageData(w, ht), px = img ? new Uint32Array(img.data.buffer) : null;
  let roll = 0;
  const draw = () => {
    if (!ctx) return;
    roll = (roll + 2 + Math.random() * 5) % ht;
    for (let y = 0; y < ht; y++) {
      const k = (Math.abs(y - roll) < 7 ? 1.3 : 1) * (0.7 + Math.random() * 0.35);
      for (let x = 0; x < w; x++) { const v = Math.min(255, (Math.random() * 210 * k) | 0); px[y * w + x] = 0xff000000 | (v << 16) | (v << 8) | v; }
    }
    ctx.putImageData(img, 0, 0);
  };
  draw();
  const timer = setInterval(draw, 80);
  let gone = false;
  return {
    el, stack,
    /** Fade out, and be gone. */
    async close() {
      if (gone) return; gone = true;
      el.classList.add('is-gone'); await pause(460);
      clearInterval(timer); if (typeof stopLogo === 'function') stopLogo(); el.remove();
    },
  };
}

let lists = 0;
/** The tiers to choose from, under GRAPHICS (the owner: "so they know what low-high are for"): Auto first, then
 * LAUNCH_TIERS. onPick(tier) once one is chosen. */
function tierList(onPick) {
  const tiers = ['auto', ...LAUNCH_TIERS];
  const pick = h('span.br-launch-pick');
  const rows = tiers.map((tier) => h('button.br-launch-row', { type: 'button', dataset: { tier } }, LABEL[tier], tier === 'auto' ? pick : null));
  const head = h('div.br-launch-head', { id: 'br-launch-head-' + (++lists) }, 'GRAPHICS');
  const el = h('div.br-launch-list', { role: 'group', 'aria-labelledby': head.id }, head, ...rows);
  let on = 0, chosen = false;
  const set = (i) => { on = (i + rows.length) % rows.length; rows.forEach((r, k) => r.classList.toggle('is-on', k === on)); rows[on].focus({ preventScroll: true }); };
  const choose = (i) => { if (chosen) return; chosen = true; set(i); onPick(tiers[i]); };
  const rowOf = (target) => rows.indexOf(target?.closest?.('.br-launch-row'));
  rows.forEach((r, k) => r.classList.toggle('is-on', k === on));
  return {
    el,
    show() { el.classList.add('is-up'); set(on); },
    /** What Auto picked: null while it measures, a tier when it has, 'auto' when it could not (nothing more is said). */
    auto(tier) {
      pick.replaceChildren();
      if (tier === null) pick.append(' · ', h('span.br-launch-wait', '▮▮▮'));
      else if (tier !== 'auto' && LABEL[tier]) pick.append(` · ${LABEL[tier]}`);
    },
    /** A key. → whether it was the list's. */
    key(e) {
      if (chosen || !el.classList.contains('is-up') || e.ctrlKey || e.metaKey || e.altKey) return false;
      const k = e.key;
      if (k === 'ArrowDown' || k === 'ArrowRight' || k === 's' || k === 'S' || (k === 'Tab' && !e.shiftKey)) { set(on + 1); return true; }
      if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'w' || k === 'W' || (k === 'Tab' && e.shiftKey)) { set(on - 1); return true; }
      if (k === 'Home') { set(0); return true; }
      if (k === 'End') { set(rows.length - 1); return true; }
      if (k === 'Enter' || k === ' ' || k === 'e' || k === 'E') { if (!e.repeat) choose(on); return true; }
      return false;
    },
    /** A click (or tap) on a row chooses it. → whether it was on one. */
    click(target) { const i = rowOf(target); if (i < 0 || chosen || !el.classList.contains('is-up')) return false; choose(i); return true; },
    hover(target) { const i = rowOf(target); if (i >= 0 && i !== on && !chosen) set(i); },
  };
}

/**
 * The screen's hold on the keys and the pointer. The level's own input listens on the window before anything on the
 * page (input.js); so does this, and on the first launch it is there first, and nothing reaches the visit drawn behind.
 * Over the menu (Settings), what is in the menu's own box passes the level's input by, and only the keys need taking.
 */
function hold(list, { all }) {
  const types = ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'pointercancel', 'pointermove', 'mousedown', 'mouseup', 'mousemove',
    'click', 'dblclick', 'contextmenu', 'wheel', 'touchstart', 'touchmove', 'touchend'];
  const on = (e) => {
    let mine = false;
    if (e.type === 'keydown') mine = list.key(e);
    else if (e.type === 'click') mine = list.click(e.target);
    else if (e.type === 'pointermove') list.hover(e.target);
    if (mine) e.preventDefault();
    if (all || mine) e.stopImmediatePropagation();
  };
  for (const t of types) window.addEventListener(t, on, { capture: true, passive: false });
  return () => { for (const t of types) window.removeEventListener(t, on, true); };
}

/* ---- the measuring ------------------------------------------------------------------------------- */

/** The stage's frames for `seconds`: → the milliseconds between them. aim(now) each frame; stop() ends it early. */
function frames(stage, seconds, { aim, stop }) {
  return new Promise((resolve) => {
    const ms = []; let last = 0, t0 = 0, off = null;
    off = stage.onFrame(() => {
      const now = performance.now();
      if (!t0) t0 = now; else ms.push(now - last);
      last = now;
      aim?.(now);
      if (stop() || now - t0 >= seconds * 1000) { off?.(); off = null; resolve(ms); }
    });
  });
}

/** Each tier of BENCH_ORDER in turn, until one holds. setTier(tier) puts it on. → [{ tier, stats }]. */
async function measureTiers(stage, setTier, { aim, stop }) {
  const results = [];
  for (const tier of BENCH_ORDER) {
    if (stop()) break;
    setTier(tier);
    await frames(stage, BENCH.settleS, { aim, stop });
    const ms = await frames(stage, BENCH.measureS, { aim, stop });
    if (stop()) break;
    const stats = frameStats(ms);
    results.push({ tier, stats });
    console.info(`[graphics] ${tier}: median ${stats.median} ms, 9 in 10 under ${stats.p90} ms, ${stats.fps} fps over ${stats.frames} frames${holds(stats) ? ' — holds' : ''}`);
    if (holds(stats)) break;
  }
  return results;
}

/* ---- the first launch ------------------------------------------------------------------------------ */

/**
 * The screen at first launch, over `host`, with the level measured behind it. office: the page's (its stage is drawn
 * with; its names borrowed) · enterBackrooms: index.js's · logo: as screen() takes it. → { tier, auto, picked,
 * results } once the choice is made, the benchmark's visit is over and the setting is saved; the next visit is at that tier.
 */
export async function firstLaunch({ office, enterBackrooms, host = document.body, logo }) {
  const before = readRaw();
  const s = screen(host, { logo });
  let resolvePick; const picked = new Promise((r) => { resolvePick = r; });
  const list = tierList((tier) => resolvePick(tier));
  s.stack.append(list.el);
  list.auto(null);
  const release = hold(list, { all: true });
  const shown = pause(900).then(() => list.show());

  // the visit behind the static: quiet, nobody following, no card, at the top tier; gone as soon as it is not needed
  let handle = null, choice = null, stopped = false;
  const stop = () => stopped || (choice !== null && choice !== 'auto');
  const quit = () => { stopped = true; if (handle && handle.state !== 'done') handle.finish('quit'); };
  const stage = office.stage;
  const visit = Promise.resolve().then(() => enterBackrooms({ stage, creations: office.creations || {}, net: office.net }, {
    name: 'Employee', seed: BENCH.tape, mute: true, pursuer: false, scorecard: false, graphics: BENCH_ORDER[0],
    onReady(h) { handle = h; if (stopped) h.finish('quit'); },
  })).catch((err) => { console.warn('[graphics] the benchmark could not be run', err); return null; });
  let over = false; visit.then(() => { over = true; });

  const bench = (async () => {
    const t0 = performance.now();
    while (!(handle && handle.state === 'play')) {
      if (stop() || over) return { results: [] };
      if (performance.now() - t0 > BENCH.landMs) return { results: [], late: true };
      await pause(100);
    }
    const me = handle.player.me, base = me.yaw, start = performance.now();
    const aim = (now) => { me.yaw = base + (((now - start) / 1000) / BENCH.sweepS) * Math.PI * 2; me.pitch = 0; };
    return { results: await measureTiers(stage, (t) => handle.setSetting('graphics', t), { aim, stop }) };
  })().catch((err) => { console.warn('[graphics] the benchmark stopped', err); return { results: [] }; });

  const measured = bench.then((r) => {
    const tier = r.late ? 'low' : autoPick(r.results);
    list.auto(tier);
    quit();
    return { tier, results: r.results };
  });
  choice = await picked;
  if (choice !== 'auto') quit();
  await shown;
  const auto = await measured;
  const tier = choice === 'auto' ? auto.tier : choice;
  if (choice === 'auto') await pause(500);          // (long enough to see what Auto picked)
  await visit;
  stage.setView?.(null);
  writeRaw(before);                                  // (whatever the benchmark's visit saved, as it was)
  saveTier(tier);
  const rec = { tier, auto: choice === 'auto', picked: auto.tier !== 'auto' ? auto.tier : null };
  remember(rec);
  release();
  await s.close();
  return { ...rec, results: auto.results };
}

/* ---- from Settings ------------------------------------------------------------------------------- */

/**
 * The screen again, from the menu's Settings, over the paused picture of the visit `handle` (index.js's), measured on
 * that picture. stage: the page's. The choice is the visit's Graphics setting at once. → the record, or null.
 */
export async function retest({ stage, handle, logo }) {
  if (!handle?.menu?.mount || !stage) return null;
  const was = handle.settings().graphics;
  const s = screen(null, { logo });
  handle.menu.mount(s.el);
  let resolvePick; const picked = new Promise((r) => { resolvePick = r; });
  const list = tierList((tier) => resolvePick(tier));
  s.stack.append(list.el);
  list.auto(null);
  const release = hold(list, { all: false });
  // (Esc: as it was, and back to the menu)
  const esc = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); resolvePick(null); } };
  window.addEventListener('keydown', esc, true);
  await pause(600); list.show();
  let choice = null, cancelled = false;
  const stop = () => cancelled || (choice !== null && choice !== 'auto');
  const put = (t) => { const p = graphicsProfile(t); handle.vhs.setProfile(p); showDetail(handle.root, p); };
  const measured = measureTiers(stage, put, { stop }).then((results) => { const tier = autoPick(results); list.auto(tier); return { tier, results }; });
  choice = await picked;
  if (choice === null) cancelled = true;
  const auto = await measured;
  put(was);
  window.removeEventListener('keydown', esc, true);
  release();
  if (choice === 'auto') await pause(500);
  await s.close();
  if (choice === null) return null;
  const tier = choice === 'auto' ? auto.tier : choice;
  handle.setSetting('graphics', tier);
  const rec = { tier, auto: choice === 'auto', picked: auto.tier !== 'auto' ? auto.tier : null };
  remember(rec);
  return rec;
}

/* ---- no picture at all --------------------------------------------------------------------------- */

/** For a machine with neither WebGPU nor WebGL 2: the static, and that it cannot be played here. */
export function cantRun(host = document.body, { logo } = {}) {
  const s = screen(host, { logo });
  s.stack.append(h('div.br-launch-fault', { role: 'alert' }, h('strong', 'NO SIGNAL'), h('span', 'THIS MACHINE CAN’T RUN BLOCKROOMS')));
  return s;
}
