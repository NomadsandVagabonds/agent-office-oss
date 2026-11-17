// The Backrooms — thumbs, as arithmetic. On a phone there is no keyboard and no
// mouse, so there is a thumb stick and four buttons (touch.js draws them,
// input.js listens to them). This file says where they go on a screen of any
// shape, which part of the screen a finger has to land on to be the stick, and
// what a push of so many pixels means. Numbers in, numbers out: nothing here
// knows what a browser is.
//
// The picture is 4:3 and a phone is not, so a phone held sideways has a black
// bar either side of the picture and a phone held upright has room under it.
// That is where the controls go when there is room: beside the picture, not
// on it. Where there is none (a tablet), they sit over its corners.

export const THUMBS = Object.freeze({
  reach: Object.freeze({ least: 46, share: 0.13, most: 64 }),    // the stick's ring, as a radius in px: a share of the screen's shorter side
  dead: 0.16,          // of the reach: a thumb at rest is not a step
  run: 1.5,            // of the reach: pushed this far, past the ring, is running…
  walk: 1.2,           // …until it comes back inside this (so that a thumb on the line does not stutter)
  button: Object.freeze({ least: 46, share: 0.135, most: 60 }),  // a button's width, px (never smaller than a finger)
  gap: 12,             // between two buttons, and between anything and the edge of the screen
  look: 2.6,           // a finger drags the view this much further than a mouse would
  upright: 1.05,       // taller than wide by this much is a phone held upright
  pockets: 0.74,       // of the picture's height: below this is where the pockets and the heart are drawn
  lift: 90,            // px: upright, the stick's ring ends at least this far above the bottom of the screen
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sized = (rule, view) => clamp(Math.min(view.w, view.h) * rule.share, rule.least, rule.most);
const edges = (view) => ({ top: 0, right: 0, bottom: 0, left: 0, ...(view.safe || {}) });
const pictureOf = (view) => view.picture || { x: 0, y: 0, w: view.w, h: view.h };

/** Is this screen a phone held upright? */
export const upright = (view) => view.h > view.w * THUMBS.upright;

/** How far the stick's ring reaches from where the thumb came down, px. */
export const reachOf = (view) => sized(THUMBS.reach, view);

/**
 * Where a finger has to land to be the thumb stick: the left of the screen, low down. Upright, that is the left half of
 * what is under the picture; sideways, the left two fifths below the top strip.
 * @param {{w:number, h:number, picture?:{x,y,w,h}}} view  the screen and where the picture is on it, CSS px
 * @returns {{x0:number, y0:number, x1:number, y1:number}}
 */
export function zoneOf(view) {
  if (!upright(view)) return { x0: 0, y0: view.h * 0.22, x1: view.w * 0.42, y1: view.h };
  const p = pictureOf(view), under = p.y + p.h;
  return { x0: 0, y0: under < view.h * 0.7 ? under : view.h * 0.5, x1: view.w * 0.5, y1: view.h };
}
export const inZone = (zone, x, y) => x >= zone.x0 && x < zone.x1 && y >= zone.y0 && y <= zone.y1;

/**
 * What a thumb that has moved (dx, dy) px from where it came down is asking for.
 * @param {number} dx  px to the right
 * @param {number} dy  px down the screen
 * @param {number} reach  the ring's radius, px (reachOf)
 * @param {boolean} [running]  was it running a moment ago
 * @returns {{x:number, y:number, run:boolean, nub:{x:number, y:number}}}
 *          x: right, y: forward, together never longer than 1 · run: pushed past the ring · nub: where to draw the thumb, px from the middle
 */
export function stickOf(dx, dy, reach, running = false) {
  const dist = Math.hypot(dx, dy);
  if (!(dist > 0) || !(reach > 0)) return { x: 0, y: 0, run: false, nub: { x: 0, y: 0 } };
  const ux = dx / dist, uy = dy / dist, far = Math.min(1, dist / reach);
  const push = far <= THUMBS.dead ? 0 : (far - THUMBS.dead) / (1 - THUMBS.dead);
  const run = dist > reach * (running ? THUMBS.walk : THUMBS.run);
  return { x: ux * push || 0, y: -uy * push || 0, run, nub: { x: ux * far * reach, y: uy * far * reach } };          // (|| 0: no step is 0, never −0)
}

/**
 * Where everything is drawn. Centres, in CSS px from the screen's top left.
 *
 * Sideways there are three cases, each side for itself. A bar beside the picture wide enough for what goes in it has it
 * in its middle (two buttons across; the stick). A narrower bar has the buttons in one column, and the stick against
 * the screen's edge, so that as little as can be is on the picture. No bar at all (a tablet: the picture is the screen)
 * and they sit on the picture's lower corners, but above its bottom band: that is where the pockets are, and a pocket
 * is also something a finger presses.
 * @param {{w:number, h:number, picture?:{x,y,w,h}, safe?:{top,right,bottom,left}}} view
 *        safe: how much of each edge the phone keeps for itself (a notch, a rounded corner, the bar you swipe up)
 * @returns {{stick:{x,y,r,run}, buttons:{use:{x,y,d}, light:{x,y,d}, jump:{x,y,d}, crouch:{x,y,d}}}}
 */
export function placeOf(view) {
  const { w, h } = view, safe = edges(view), p = pictureOf(view), gap = THUMBS.gap;
  const r = reachOf(view), d = sized(THUMBS.button, view), tall = upright(view);
  const left = safe.left + gap, right = w - safe.right - gap, floor = h - safe.bottom - gap;
  const leftBar = tall ? 0 : Math.max(0, p.x - safe.left), rightBar = tall ? 0 : Math.max(0, w - safe.right - (p.x + p.w));
  const shelf = Math.min(floor, p.y + p.h * THUMBS.pockets - gap);        // the lowest anything on the picture may come

  // the stick
  let sx, sy;
  // (upright, thumbs sit a little higher than the bottom of the phone — and on the smallest phones never so low that the
  // ring lies over the camcorder's battery marks, which sit just above the bottom edge there: THUMBS.lift)
  if (tall) { sx = left + r + w * 0.05; sy = floor - r - Math.max(h * 0.12, THUMBS.lift); }
  else if (leftBar >= 2 * r + 2 * gap) { sx = safe.left + leftBar / 2; sy = floor - r - h * 0.1; }
  else if (leftBar >= r) { sx = safe.left + r + 4; sy = floor - r - h * 0.1; }
  else { sx = left + r; sy = shelf - r; }

  // the buttons. The thumb comes to rest on `use` and `crouch`; the light and a hop are a reach away
  const step = d + gap, buttons = {};
  if (!tall && rightBar < 2 * d + 3 * gap && rightBar >= d + gap / 2) {
    // (as low as the thumb likes, but never so low that the top one is off the screen)
    const x = w - safe.right - rightBar / 2, y0 = Math.min(floor - d / 2, Math.max(floor - d / 2 - h * 0.04, safe.top + gap + d / 2 + 3 * step));
    ['crouch', 'use', 'jump', 'light'].forEach((name, i) => { buttons[name] = { x, y: y0 - i * step, d }; });
  } else {
    const inBar = !tall && rightBar >= 2 * d + 3 * gap, onPicture = !tall && !inBar;
    const x1 = inBar ? w - safe.right - rightBar / 2 + step / 2 : right - d / 2, x0 = x1 - step;         // the outer column, the inner
    const y1 = onPicture ? shelf - d / 2 : floor - d / 2 - h * (tall ? 0.11 : 0.08), y0 = y1 - step;      // the lower row, the upper
    Object.assign(buttons, { use: { x: x0, y: y1, d }, crouch: { x: x1, y: y1, d }, light: { x: x0, y: y0, d }, jump: { x: x1, y: y0, d } });
  }
  return { stick: { x: sx, y: clamp(sy, r + safe.top + gap, floor - r), r, run: r * THUMBS.run }, buttons };
}

/**
 * Where the top of the picture goes on a phone held upright: up under the phone's own edge, so that what is left of the
 * screen is all below it, where thumbs are. Sideways (or anywhere the picture fills the screen) it stays in the middle.
 * @returns {number | null} px from the top, or null for the middle
 */
export function pictureTop(view) {
  if (!upright(view)) return null;
  return Math.round(edges(view).top + Math.min(view.h * 0.02, 14));
}
