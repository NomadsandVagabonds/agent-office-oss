// The Backrooms — thumbs, as things on the screen. A phone has no keys, so the
// camcorder grows a thumb stick and four buttons while a finger is what is
// being used: a ring low on the left that walks (and runs, pushed past its
// edge), and on the right a hop, a duck, the light when there is one to
// switch, and a hand when there is something in front of you to use. They are
// drawn the way the rest of the viewfinder is, they say nothing, and where
// the screen has room beside the picture they are beside it and not on it.
//
// This file only draws them and says which one a finger is on. Where they go
// is arithmetic (touch.rule.js); what they do is input.js's.
import { h } from '../ui/dom.js';
import { placeOf, zoneOf, pictureTop } from './touch.rule.js';

const CSS = `
/* (above the pockets: on a small screen they can meet, and a button is the smaller of the two to hit) */
.backrooms .br-thumbs { position: absolute; inset: 0; z-index: 9; pointer-events: none; display: none; color: #f4f1e6; }
.backrooms.touch .br-thumbs { display: block; }
.backrooms.is-paused .br-thumbs, .backrooms:has(.br-inventory.is-open) .br-thumbs { visibility: hidden; }
.br-thumbs .br-thumbs-edges { position: absolute; left: 0; top: 0; width: 0; height: 0; visibility: hidden;
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px); }
.br-thumbs .br-stick { position: absolute; left: 0; top: 0; width: 0; height: 0; opacity: .34; transition: opacity .18s ease; }
.br-thumbs .br-stick.is-held { opacity: .7; transition: none; }
.br-thumbs .br-stick i { position: absolute; left: 0; top: 0; border-radius: 50%; box-sizing: border-box; transform: translate(-50%, -50%); }
.br-thumbs .br-stick-ring { width: calc(var(--r, 52px) * 2); height: calc(var(--r, 52px) * 2); border: 2px solid currentColor; background: rgba(10, 10, 8, .24); }
.br-thumbs .br-stick-run { width: calc(var(--run, 78px) * 2); height: calc(var(--run, 78px) * 2); border: 2px dashed currentColor; opacity: 0; transition: opacity .12s ease; }
.br-thumbs .br-stick.is-held .br-stick-run { opacity: .3; }
.br-thumbs .br-stick.is-running .br-stick-run { opacity: 1; }
.br-thumbs .br-stick i.br-stick-nub { left: var(--nx, 0px); top: var(--ny, 0px); width: calc(var(--r, 52px) * .86); height: calc(var(--r, 52px) * .86); background: currentColor; opacity: .5; }
.br-thumbs .br-stick.is-running i.br-stick-nub { opacity: .95; }
.br-thumbs .br-tb { position: absolute; display: grid; place-items: center; box-sizing: border-box; border-radius: 50%; transform: translate(-50%, -50%);
  border: 2px solid currentColor; background: rgba(10, 10, 8, .32); opacity: .5; pointer-events: auto; touch-action: none; -webkit-tap-highlight-color: transparent;
  transition: opacity .12s ease, background-color .12s ease; }
.br-thumbs .br-tb svg { width: 54%; height: 54%; display: block; pointer-events: none; }
.br-thumbs .br-tb.is-down { opacity: .96; background: rgba(244, 241, 230, .28); transform: translate(-50%, -50%) scale(.93); }
.br-thumbs .br-tb.is-on { opacity: .92; background: #f4f1e6; color: #15140f; border-color: #f4f1e6; }
.br-thumbs .br-tb[hidden] { display: none; }
.br-thumbs .br-tb-use { opacity: .4; }
.br-thumbs .br-tb-use.is-ready { opacity: .92; animation: br-thumb-in .16s ease-out; }
.br-thumbs .br-tb-light .br-rays { visibility: hidden; }
.br-thumbs .br-tb-light.is-on .br-rays { visibility: visible; }
@keyframes br-thumb-in { from { opacity: 0; transform: translate(-50%, -50%) scale(.7); } }
/* a finger has no E to press: the hand is its [E]. Nor any other key: what the bag's buttons and the menu say about keys is for keyboards */
.backrooms.touch .br-use { display: none; }
.backrooms.touch .br-inv-action kbd, .backrooms.touch .br-menu-controls { display: none; }
@media (prefers-reduced-motion: reduce) { .br-thumbs .br-tb-use { animation: none; } .br-thumbs .br-tb, .br-thumbs .br-stick, .br-thumbs .br-stick-run { transition: none; } }
`;

const NS = 'http://www.w3.org/2000/svg';
// Each is a few plain shapes on a 24 × 24 grid, in whatever colour the button is: no letters, and nothing a phone would
// swap for a picture of its own.
const ICONS = {
  jump: [['path', { d: 'M12 4 20 13H15V20H9V13H4Z' }]],
  crouch: [['path', { d: 'M12 20 4 11H9V4H15V11H20Z' }]],
  light: [
    ['path', { d: 'M7.5 6H16.5L14.4 10.6H9.6Z' }], ['rect', { x: 9.6, y: 10.6, width: 4.8, height: 10.4, rx: 1 }],
    ['path', { class: 'br-rays', d: 'M11.2 1H12.8V4.2H11.2Z M5.3 2.6 6.6 1.7 8.3 4.3 7 5.2Z M18.7 2.6 17.4 1.7 15.7 4.3 17 5.2Z' }],
  ],
  use: [
    ['rect', { x: 7.2, y: 11, width: 10.2, height: 10, rx: 3.2 }],
    ['rect', { x: 7.2, y: 4.6, width: 2.3, height: 9, rx: 1.15 }], ['rect', { x: 9.85, y: 2.8, width: 2.3, height: 10.5, rx: 1.15 }],
    ['rect', { x: 12.5, y: 3.4, width: 2.3, height: 10, rx: 1.15 }], ['rect', { x: 15.1, y: 5.2, width: 2.3, height: 8.5, rx: 1.15 }],
    ['rect', { x: 3.3, y: 10.8, width: 2.5, height: 7.4, rx: 1.25, transform: 'rotate(-32 4.55 14.5)' }],
  ],
};
function icon(name) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('fill', 'currentColor');
  for (const [tag, attrs] of ICONS[name]) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    svg.append(node);
  }
  return svg;
}

const LABELS = { use: 'Use', light: 'Light', jump: 'Jump', crouch: 'Crouch' };

/**
 * @param {HTMLElement} host  the camcorder's overlay (.backrooms): the thumbs are hidden whenever it says they should be
 * @returns {{ el, layout(view), zone, reach, edges(), pictureTop(size), act(target), stick(s), set(patch), down(name, on), remove() }}
 */
export function createThumbs(host) {
  const style = h('style', { id: 'backrooms-thumbs-css' }, CSS);
  document.head.append(style);
  const stick = h('div.br-stick', h('i.br-stick-run'), h('i.br-stick-ring'), h('i.br-stick-nub'));
  const buttons = {};
  for (const name of ['light', 'jump', 'use', 'crouch']) buttons[name] = h(`div.br-tb.br-tb-${name}`, { role: 'button', 'aria-label': LABELS[name], 'data-act': name }, icon(name));
  buttons.light.hidden = true;                           // (the hand is never hidden: see set())
  const probe = h('div.br-thumbs-edges', { 'aria-hidden': 'true' });
  const el = h('div.br-thumbs', stick, Object.values(buttons), probe);
  host.append(el);

  let place = null, zone = null, safe = null, safeFor = '';
  const px = (n) => `${Math.round(n * 10) / 10}px`;
  /** How much of each edge the phone keeps for itself (a notch, the bar you swipe up from), px. */
  function edges(key = '') {
    if (safe && key === safeFor) return safe;
    const cs = typeof getComputedStyle === 'function' ? getComputedStyle(probe) : {}, n = (v) => parseFloat(v) || 0;
    safe = { top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft) }; safeFor = key;
    return safe;
  }
  function rest() {
    stick.classList.remove('is-held', 'is-running');
    if (place) { stick.style.left = px(place.stick.x); stick.style.top = px(place.stick.y); }
    stick.style.setProperty('--nx', '0px'); stick.style.setProperty('--ny', '0px');
  }

  return {
    el,
    /** Put everything where it goes on this screen. view: { w, h, picture: {x, y, w, h} }, CSS px. */
    layout(view) {
      const whole = { ...view, safe: edges(`${view.w}x${view.h}`) };
      place = placeOf(whole); zone = zoneOf(whole);
      stick.style.setProperty('--r', px(place.stick.r)); stick.style.setProperty('--run', px(place.stick.run));
      if (!stick.classList.contains('is-held')) rest();
      for (const [name, b] of Object.entries(place.buttons)) Object.assign(buttons[name].style, { left: px(b.x), top: px(b.y), width: px(b.d), height: px(b.d) });
    },
    /** Where a finger has to land to be the stick, and how far the ring reaches (null until laid out). */
    get zone() { return zone; },
    get reach() { return place ? place.stick.r : null; },
    edges,
    /** Where the top of the picture should be on this screen (px), or null for the middle: touch.rule.js. */
    pictureTop(size) { return pictureTop({ w: size.w, h: size.h, safe: edges(`${size.w}x${size.h}`) }); },
    /** Which button is this (the thing a finger landed on)? → 'use' | 'light' | 'jump' | 'crouch' | null */
    act(target) {
      const b = target && typeof target.closest === 'function' ? target.closest('[data-act]') : null;
      return b && el.contains(b) && !b.hidden ? b.getAttribute('data-act') : null;
    },
    /** Draw the stick under a thumb: where it came down (x, y), where it is now from there (nx, ny), whether that is a run. null: nobody is holding it. */
    stick(s) {
      if (!s) { rest(); return; }
      stick.classList.add('is-held'); stick.classList.toggle('is-running', !!s.run);
      stick.style.left = px(s.x); stick.style.top = px(s.y);
      stick.style.setProperty('--nx', px(s.nx || 0)); stick.style.setProperty('--ny', px(s.ny || 0));
    },
    /** usable: there is something in front of you (the hand shows plainly; otherwise faintly) · light: 'none' | 'off' | 'on' · crouched: you are ducking */
    set(patch) {
      // (the hand is always there: with something in front of you it uses it, and with nothing it is the two hands a mouse's
      // click is — a shove, index.js useIt. `usable` only says how plainly it shows)
      if ('usable' in patch) buttons.use.classList.toggle('is-ready', !!patch.usable);
      if ('light' in patch) { const has = patch.light === 'off' || patch.light === 'on'; if (buttons.light.hidden === has) buttons.light.hidden = !has; buttons.light.classList.toggle('is-on', patch.light === 'on'); }
      if ('crouched' in patch) buttons.crouch.classList.toggle('is-on', !!patch.crouched);
    },
    /** A button is under a finger (or no longer is). */
    down(name, on) { buttons[name]?.classList.toggle('is-down', !!on); },
    remove() { el.remove(); style.remove(); },
  };
}
