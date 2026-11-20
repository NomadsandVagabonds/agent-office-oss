// The Backrooms — the graphics screen at launch, and the screen for a machine that cannot draw the level at all.
//
// First launch (site.js, before the first visit; the dev page with &launch=1): tape static, and over it the tiers, Auto
// first and chosen. Behind the static the level is drawn for real: a visit to a fixed building (launch.rule.js BENCH),
// quiet, with nobody in it, built at High; once it has landed, High is measured while the view turns round the room,
// then Medium only if High did not hold. Auto shows what it picked; the player may take it or another tier, and the
// choice is the Graphics setting from then on, remembered (launch.rule.js LAUNCH_KEY) so that the screen does not come
// back. Settings offers it again (menu.js Test, by Graphics): then it is measured on the paused picture of the visit
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
@font-face { font-family: "Pixelify Sans"; src: url("/vendor/fonts/pixelify-sans-400.woff2") format("woff2"); font-weight: 400; font-display: swap; }
.br-launch { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; background: #0a0a08; color: #f1ead8;
  font: 400 22px/1.2 "Pixelify Sans", ui-monospace, Menlo, Consolas, monospace; letter-spacing: .14em;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; transition: opacity .45s; }
.br-launch.is-gone { opacity: 0; pointer-events: none; }
.br-launch-static { position: absolute; inset: 0; width: 100%; height: 100%; opacity: .7; }
.br-launch-list { position: relative; display: grid; gap: 4px; padding: 14px; min-width: min(320px, calc(100vw - 32px)); box-sizing: border-box;
  background: rgba(10, 10, 8, .8); box-shadow: 0 0 0 1px rgba(241, 234, 216, .2); opacity: 0; transition: opacity .35s; }
.br-launch-list.is-up { opacity: 1; }
.br-launch-row { position: relative; appearance: none; margin: 0; border: 0; border-radius: 0; padding: 11px 16px 11px 40px; background: none; color: inherit;
  font: inherit; letter-spacing: inherit; text-align: left; cursor: pointer; text-shadow: 0 0 3px rgba(241, 234, 216, .45); touch-action: manipulation; }
.br-launch-row.is-on { background: #f1ead8; color: #0a0a08; text-shadow: none; }
.br-launch-row.is-on::before { content: "\\25B6"; position: absolute; left: 14px; }
.br-launch-row:focus { outline: none; }
.br-launch-row:focus-visible { outline: 1px dashed currentColor; outline-offset: -5px; }
.br-launch-pick { opacity: .72; }
.br-launch-wait { animation: br-launch-blink 1s steps(2, start) infinite; }
@keyframes br-launch-blink { to { visibility: hidden; } }
.br-launch-fault { position: relative; display: grid; gap: 14px; padding: 18px 22px; max-width: calc(100vw - 32px); box-sizing: border-box; text-align: center;
  background: rgba(10, 10, 8, .8); font-size: 16px; }
.br-launch-fault strong { color: #ff3a26; font-size: 34px; font-weight: 400; }
@media (prefers-reduced-motion: reduce) { .br-launch-wait { animation: none; } }
`;
let styled = false;
function style() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  document.head.append(h('style', { id: 'br-launch-css' }, CSS));
}

/** A screen of tape static, put in `host` (or returned to be put somewhere). */
function screen(host) {
  style();
  const canvas = h('canvas.br-launch-static', { width: 192, height: 144, 'aria-hidden': 'true' });
  const el = h('div.br-launch', canvas);
  host?.append(el);
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
    el,
    /** Fade out, and be gone. */
    async close() {
      if (gone) return; gone = true;
      el.classList.add('is-gone'); await pause(460);
      clearInterval(timer); el.remove();
    },
  };
}

/** The tiers to choose from: Auto first, then LAUNCH_TIERS. onPick(tier) once one is chosen. */
function tierList(onPick) {
  const tiers = ['auto', ...LAUNCH_TIERS];
  const pick = h('span.br-launch-pick');
  const rows = tiers.map((tier) => h('button.br-launch-row', { type: 'button', dataset: { tier } }, LABEL[tier], tier === 'auto' ? pick : null));
  const el = h('div.br-launch-list', { role: 'group' }, ...rows);
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
 * with; its names borrowed) · enterBackrooms: index.js's. → { tier, auto, picked, results } once the choice is made, the
 * benchmark's visit is over and the setting is saved; the next visit is at that tier.
 */
export async function firstLaunch({ office, enterBackrooms, host = document.body }) {
  const before = readRaw();
  const s = screen(host);
  let resolvePick; const picked = new Promise((r) => { resolvePick = r; });
  const list = tierList((tier) => resolvePick(tier));
  s.el.append(list.el);
  list.auto(null);
  const release = hold(list, { all: true });
  const shown = pause(900).then(() => list.show());

  // the visit behind the static: quiet, nobody following, no card, at High; gone as soon as it is not needed
  let handle = null, choice = null, stopped = false;
  const stop = () => stopped || (choice !== null && choice !== 'auto');
  const quit = () => { stopped = true; if (handle && handle.state !== 'done') handle.finish('quit'); };
  const stage = office.stage;
  const visit = Promise.resolve().then(() => enterBackrooms({ stage, creations: office.creations || {}, net: office.net }, {
    name: 'Employee', seed: BENCH.tape, mute: true, pursuer: false, scorecard: false, graphics: 'high',
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
export async function retest({ stage, handle }) {
  if (!handle?.menu?.mount || !stage) return null;
  const was = handle.settings().graphics;
  const s = screen(null);
  handle.menu.mount(s.el);
  let resolvePick; const picked = new Promise((r) => { resolvePick = r; });
  const list = tierList((tier) => resolvePick(tier));
  s.el.append(list.el);
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
export function cantRun(host = document.body) {
  const s = screen(host);
  s.el.append(h('div.br-launch-fault', { role: 'alert' }, h('strong', 'NO SIGNAL'), h('span', 'THIS MACHINE CAN’T RUN BLOCKROOMS')));
  return s;
}
