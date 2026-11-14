// B · Basement: what it is made of. Painted blockwork, galvanised duct, cage
// mesh, and the small things a caretaker has about him — sculpted here because
// nowhere else in the building needs them. Vox models stand on y = 0 and face
// +z; textures are drawn at the office's own grain (40 px to the metre).
import { Vox, M, glow, tone } from '../vox/vox.js';
import { canvasTexture, shade } from '../scene/textures.js';

const MONO = 'ui-monospace, Menlo, Consolas, monospace';
const lcg = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const P = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

/* ---- surfaces ------------------------------------------------------------------------------------ */

/** A wall of painted blockwork: cream above, the green that every plant room is below, a black band to tell them apart. As WALLS.*() (scene/textures.js). */
export function blockwork() {
  const top = '#b9b49f', low = '#5f7a66';
  return { tile: 2.0, tex: canvasTexture(80, 104, (g, w, h) => {
    const r = lcg(91), rail = 62;
    P(g, top, 0, 0, w, rail); P(g, low, 0, rail, w, h - rail);
    for (let y = 0; y < h; y += 8) {
      const c = y < rail ? top : low;
      P(g, shade(c, -0.1), 0, y, w, 1); P(g, shade(c, 0.05), 0, y + 1, w, 1);
      for (let x = (y / 8) % 2 ? 10 : 0; x < w; x += 20) P(g, shade(c, -0.1), x, y, 1, 8);
    }
    for (let i = 0; i < 260; i++) { const y = (r() * h) | 0; P(g, shade(y < rail ? top : low, (r() - 0.55) * 0.12), (r() * w) | 0, y, 2, 1); }
    P(g, '#22241f', 0, rail - 1, w, 2);
    for (let i = 0; i < 5; i++) P(g, shade(low, -0.2), (r() * w) | 0, h - 6 - ((r() * 10) | 0), 1, 14);      // scuffs, and what the mop leaves
    P(g, '#2e332e', 0, h - 4, w, 4);
  }) };
}

/** Screed, sealed grey a long time ago, with the lines somebody painted for trolleys. As FLOORS.*(). */
export function screed() {
  const c = '#74716c';
  return { size: 2.0, tex: canvasTexture(80, 80, (g, w, h) => {
    P(g, c, 0, 0, w, h);
    const r = lcg(17);
    for (let i = 0; i < 620; i++) P(g, shade(c, (r() - 0.5) * 0.11), (r() * w) | 0, (r() * h) | 0, 1 + ((r() * 3) | 0), 1);
    P(g, shade(c, -0.1), 0, 0, w, 1);                               // a joint in the pour, every couple of metres one way
  }) };
}

/** Cage mesh: wire on a 5 cm diamond, see-through. */
export const cageMesh = () => canvasTexture(32, 32, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(176,184,192,.9)'; g.lineWidth = 1;
  for (let k = -h; k < w + h; k += 8) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
});

/** Galvanised sheet with a seam and its rivets: ducts, and the casings of the things that feed them. */
export const galvanised = () => canvasTexture(40, 40, (g, w, h) => {
  const c = '#9aa3a8'; P(g, c, 0, 0, w, h);
  const r = lcg(5);
  for (let i = 0; i < 60; i++) P(g, shade(c, (r() - 0.5) * 0.12), (r() * w) | 0, (r() * h) | 0, 3 + ((r() * 5) | 0), 2);
  P(g, shade(c, -0.25), 0, 0, 1, h); P(g, shade(c, 0.16), 1, 0, 1, h);
  for (let y = 4; y < h; y += 8) P(g, shade(c, -0.3), 3, y, 1, 1);
});

/** The front of an air handler: louvres, and a plate nobody has read. */
export const louvres = () => canvasTexture(64, 48, (g, w, h) => {
  P(g, '#8d969c', 0, 0, w, h); P(g, '#6f777d', 2, 2, w - 4, h - 4);
  for (let y = 5; y < h - 4; y += 4) { P(g, '#2b2f33', 4, y, w - 8, 2); P(g, '#a9b2b8', 4, y + 2, w - 8, 1); }
  P(g, '#c9c2a4', w - 20, h - 9, 14, 5); P(g, '#3a3a34', w - 18, h - 7, 10, 1);
}, { clamp: true });

/** A drain cover. */
export const grating = () => canvasTexture(32, 32, (g, w, h) => {
  P(g, '#0c0d0f', 0, 0, w, h);
  for (let x = 0; x < w; x += 4) P(g, '#5c636b', x, 0, 2, h);
  for (let y = 0; y < h; y += 16) P(g, '#6f777f', 0, y, w, 2);
});

/** Letters put on with a stencil and a spray can. Transparent round them. */
export function stencil(text, color = '#22241f') {
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `800 22px ${MONO}`;
  const w = Math.ceil(probe.measureText(text).width) + 8, h = 28;
  const tex = canvasTexture(w, h, (g) => {
    g.clearRect(0, 0, w, h); g.fillStyle = color; g.font = `800 22px ${MONO}`; g.textBaseline = 'middle'; g.fillText(text, 4, h / 2 + 1);
    g.globalCompositeOperation = 'destination-out'; g.fillRect(0, h / 2 - 1, w, 2);          // the bridges
    const r = lcg(text.length * 77 + text.charCodeAt(0)); for (let i = 0; i < w * 0.9; i++) g.fillRect((r() * w) | 0, (r() * h) | 0, 2, 1);
    g.globalCompositeOperation = 'source-over';
  }, { clamp: true });
  tex.userData = { aspect: w / h };
  return tex;
}

/**
 * Damp coming through a wall, and what it has done to the paint: a tide mark, blisters, and in one place where a
 * blister has gone altogether, what is under the paint. It is not blockwork.
 */
export const damp = () => canvasTexture(96, 120, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const r = lcg(404);
  for (let i = 0; i < 46; i++) { g.fillStyle = `rgba(20,26,22,${0.05 + r() * 0.06})`; g.beginPath(); g.ellipse(w / 2 + (r() - 0.5) * 44, h * 0.64 + (r() - 0.5) * 50, 12 + r() * 24, 14 + r() * 30, r(), 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(214,208,186,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(9, 46); g.bezierCurveTo(30, 28, 66, 40, 87, 31); g.stroke();      // the tide mark, in salts
  for (let i = 0; i < 12; i++) { const x = 14 + r() * 66, y = 50 + r() * 56; g.fillStyle = 'rgba(190,196,176,.55)'; g.fillRect(x, y, 3 + r() * 4, 2 + r() * 3); g.fillStyle = 'rgba(30,34,30,.5)'; g.fillRect(x, y + 3, 4, 1); }
  // low down, where it is wettest, the paint has let go in a flake the size of a hand. What is under it is not blockwork:
  // paper, yellow, a small flower that repeats. Nothing else down here is that colour except what is in cage C
  const px = 49, py = 88, flake = [[0, 3], [4, 0], [9, 1], [11, 5], [10, 11], [6, 13], [2, 12], [-1, 8]];
  g.save();
  g.beginPath(); flake.forEach(([x, y], i) => (i ? g.lineTo(px + x, py + y) : g.moveTo(px + x, py + y))); g.closePath(); g.clip();
  P(g, '#b8aa5c', px - 2, py - 1, 15, 16);
  for (let y = py + 1; y < py + 14; y += 5) for (let x = px + ((y - py) % 10 === 1 ? 0 : 3); x < px + 12; x += 6) { P(g, '#958640', x, y, 2, 2); P(g, '#cfc47e', x, y - 1, 1, 1); }
  P(g, 'rgba(30,34,26,.28)', px - 2, py - 1, 15, 3);                                              // (in the shadow of the paint that still hangs over it)
  g.restore();
  P(g, '#c9c4ae', px + 3, py + 13, 5, 2); P(g, '#8f9a8a', px + 2, py + 15, 6, 1);                 // the flake itself, curled and hanging by an edge
}, { clamp: true });

/* ---- things -------------------------------------------------------------------------------------- */

/** A sack truck: two wheels, a toe plate, a ladder of a back. Stands upright. 16 × 44 × 12. */
export function sackTruck() {
  const v = new Vox(), red = M('#a8322b', 0), tyre = M('#1c1c1f', 1);
  for (const x of [-7, 5]) v.box(x, 4, -1, x + 2, 44, 1, red);
  for (const y of [12, 24, 36]) v.box(-7, y, -1, 7, y + 2, 1, red);
  v.box(-7, 42, -1, 7, 44, 3, red);                                // the handle, bent back
  v.box(-8, 0, 0, 8, 2, 10, M('#7d8694', 0));                      // the toe plate
  for (const x of [-10, 8]) { v.cyl('x', 5, -3, x, x + 2, 5, tyre); v.cyl('x', 5, -3, x, x + 2, 2, M('#b9bec6', 0)); }
  v.box(-8, 4, -4, 8, 6, -2, M('#3a3d44', 0));                     // the axle
  return v;
}

/** An archive box: lid, hand hole, a label that was filled in by somebody who has left. 16 × 11 × 13. */
export function archiveBox(variant = 0) {
  const v = new Vox(), card = M(['#b08a5c', '#a7835a', '#b8946a'][variant % 3], 2), lid = tone(card, -0.12);
  v.box(-8, 0, -6, 8, 9, 7, card);
  v.box(-8, 9, -7, 8, 11, 7, lid); v.box(-9, 8, -7, 9, 10, 8, lid);
  v.box(-2, 5, 6, 2, 7, 7, M('#3a2a1a', 0));
  v.box(-6, 2, 7, 3, 5, 8, M('#efe9d8', 0)); v.box(-5, 3, 7, 1, 4, 8, M('#5a5448', 0));
  return v;
}

/** A kettle with a cord, and the sort of mug that lives next to one. 10 × 12 × 8. */
export function kettle() {
  const v = new Vox(), steel = M('#b9bec6', 0), black = M('#222226', 0);
  v.cyl('y', 0, 0, 0, 8, 3.6, steel, 3); v.cyl('y', 0, 0, 8, 9, 2.4, black);
  v.box(3, 3, -1, 6, 4, 1, steel); v.box(5, 4, -1, 6, 6, 1, steel);                       // the spout
  v.box(-6, 2, -1, -4, 8, 1, black); v.box(-5, 8, -1, -2, 9, 1, black);                   // the handle
  v.box(-1, 9, -1, 1, 10, 1, black);
  return v;
}

/** A transistor radio with a bent aerial. 14 × 16 × 5. */
export function radio() {
  const v = new Vox(), body = M('#5a4a3a', 1), grille = M('#2a2622', 0);
  v.rbox(-7, 0, -2, 7, 9, 3, 1, body, 'xy');
  v.box(-6, 1, 3, 1, 8, 4, grille); for (let y = 2; y < 8; y += 2) v.box(-5, y, 3, 0, y + 1, 4, M('#6a5a48', 0));
  v.box(2, 5, 3, 6, 8, 4, M('#e6dfc8', 0)); v.box(3, 6, 3, 4, 7, 4, M('#b5483f', 0));     // the dial, and where it has been left
  v.cyl('z', 4, 2.5, 3, 4, 1.4, M('#b9bec6', 0));
  v.box(5, 9, 0, 6, 15, 1, M('#b9bec6', 0)); v.box(6, 14, 0, 9, 15, 1, M('#b9bec6', 0));  // the aerial
  v.set(-6, 9, 0, glow('#ff5a3c'));
  return v;
}

/** A gate valve: a wheel on a stem. Sits on a pipe that runs along x. 8 × 10 × 8. */
export function valve(color = '#b5342c') {
  const v = new Vox(), red = M(color, 0), brass = M('#b08a3a', 0);
  v.rbox(-3, 0, -3, 3, 5, 3, 1, brass); v.box(-1, 5, -1, 1, 8, 1, brass);
  v.ring(0, 8, 0, 3.4, 0.8, red, 'y'); v.box(-3, 8, 0, 4, 9, 1, red); v.box(0, 8, -3, 1, 9, 4, red);
  return v;
}

/** A padlock, hanging. 4 × 7 × 2. */
export function padlock() {
  const v = new Vox(), brass = M('#b9963a', 0), steel = M('#b9bec6', 0);
  v.rbox(-2, 0, -1, 2, 4, 1, 1, brass, 'xy');
  v.box(-2, 4, 0, -1, 7, 1, steel); v.box(1, 4, 0, 2, 7, 1, steel); v.box(-2, 6, 0, 2, 7, 1, steel);
  return v;
}

/** One shoe. There is never the other. 5 × 5 × 11. */
export function shoe(variant = 0) {
  const v = new Vox(), c = M(['#6a4a2a', '#22242a', '#7a2a2a', '#e6e2d6', '#2a4a6a'][variant % 5], 1);
  v.rbox(-2, 0, -5, 2, 2, 5, 1, M('#1e1b18', 0), 'xz'); v.rbox(-2, 2, -5, 2, 4, 1, 1, c); v.rbox(-2, 2, 1, 2, 5, 5, 1, c); v.carve(-1, 3, 2, 1, 5, 4);
  return v;
}

/** A roll of something that was going to be laid, or hung: carpet (thick) or wallpaper (thin, and patterned on the outside). Lies along x. */
export function roll(kind = 'carpet') {
  const v = new Vox();
  if (kind === 'carpet') { const c = M('#8a8250', 3); v.cyl('x', 5, 0, -30, 30, 5, c); v.cyl('x', 5, 0, -30, -29, 3, M('#6a6238', 2)); v.cyl('x', 5, 0, 29, 30, 3, M('#6a6238', 2)); v.cyl('x', 5, 0, -30, 30, 1, M('#4a4a44', 0)); }
  else {
    v.cyl('x', 2.5, 0, -10, 11, 2.5, M('#d6c66e', 1));
    v.remap((x, y, z, c) => ((x + 40) % 4 === 0 && (y + z + 40) % 3 === 0 ? M('#b3a04a', 0) : c));          // the little flower, every so often
    v.cyl('x', 2.5, 0, -10, -9, 1.2, M('#efe9d8', 0)); v.cyl('x', 2.5, 0, 10, 11, 1.2, M('#efe9d8', 0));
  }
  return v;
}

/* ---- pictures that change ---------------------------------------------------------------------------- */

/**
 * What the caretaker's monitor shows: a fixed camera on a corridor that is not in this building. Yellow paper, a
 * drop ceiling, a doorway at the end. `figure` (0…1): something standing in the doorway, that much there.
 */
export function drawCctv(g, w, h, t, figure = 0) {
  P(g, '#1a1a12', 0, 0, w, h);
  const vx = w * 0.52, vy = h * 0.46;                                      // the vanishing point
  g.fillStyle = '#8f8a52'; g.beginPath(); g.moveTo(0, h); g.lineTo(w, h); g.lineTo(vx + 14, vy + 12); g.lineTo(vx - 14, vy + 12); g.fill();          // carpet
  g.fillStyle = '#b9ad5c'; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, h); g.lineTo(vx - 14, vy + 12); g.lineTo(vx - 14, vy - 12); g.fill();         // the walls
  g.fillStyle = '#a89c50'; g.beginPath(); g.moveTo(w, 0); g.lineTo(w, h); g.lineTo(vx + 14, vy + 12); g.lineTo(vx + 14, vy - 12); g.fill();
  g.fillStyle = '#c9c4a6'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(vx + 14, vy - 12); g.lineTo(vx - 14, vy - 12); g.fill();         // the ceiling
  for (const k of [0.25, 0.5, 0.72]) { const x0 = vx - 14 - (vx - 14) * (1 - k) * 0.5, x1 = vx + 14 + (w - vx - 14) * (1 - k) * 0.5, y = (vy - 12) * k; P(g, '#fffbe0', x0 + (x1 - x0) * 0.42, y, (x1 - x0) * 0.16, 2 + (1 - k) * 3); }
  P(g, '#3a3620', vx - 14, vy - 12, 28, 24); P(g, '#d6c66e', vx - 9, vy - 9, 18, 21);                                                                // the doorway, and more of the same through it
  if (figure > 0.02) { g.globalAlpha = Math.min(1, figure); P(g, '#15130c', vx - 3, vy - 3, 6, 15); P(g, '#15130c', vx - 7, vy - 6, 14, 3); P(g, '#15130c', vx - 2, vy - 9, 4, 4); g.globalAlpha = 1; }
  g.fillStyle = 'rgba(0,0,0,.22)'; for (let y = 0; y < h; y += 2) g.fillRect(0, y, w, 1);
  const band = ((t * 9) % (h + 20)) - 10; g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, band, w, 6);
  g.fillStyle = '#e9e6d2'; g.font = `700 8px ${MONO}`; g.textBaseline = 'top'; g.textAlign = 'left'; g.fillText('CAM 4', 4, 3);
  const s = Math.floor(t) % 60; g.textAlign = 'right'; g.fillText(`03:1${Math.floor(t / 60) % 10}:${String(s).padStart(2, '0')}`, w - 4, 3);
  if (Math.floor(t * 2) % 2) { g.fillStyle = '#ff3a2a'; g.fillRect(w - 10, h - 10, 5, 5); }
}

/** The board over his desk. Two columns, in chalk, kept up to date. */
export function drawTally(g, w, h, into, out) {
  P(g, '#22302a', 0, 0, w, h); P(g, '#6a4a2a', 0, 0, w, 3); P(g, '#6a4a2a', 0, h - 3, w, 3); P(g, '#6a4a2a', 0, 0, 3, h); P(g, '#6a4a2a', w - 3, 0, 3, h);
  g.fillStyle = '#e9e6d6'; g.font = `700 11px ${MONO}`; g.textBaseline = 'top'; g.textAlign = 'left';
  g.fillText('IN', 10, 8); g.fillText('OUT', w / 2 + 8, 8);
  P(g, '#e9e6d6', w / 2, 8, 1, h - 16); P(g, '#e9e6d6', 8, 22, w - 16, 1);
  const col = (n, x0, wide) => {
    g.strokeStyle = '#e9e6d6'; g.lineWidth = 1.3; g.lineCap = 'round';
    for (let i = 0, x = x0, y = 28; i < n; i++) {
      if (i % 5 === 4) { g.beginPath(); g.moveTo(x - 13, y + 11); g.lineTo(x, y + 1); g.stroke(); x += 6; } else { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 12); g.stroke(); x += 3.2; }
      if (x > x0 + wide - 8) { x = x0; y += 17; }
      if (y > h - 18) break;
    }
  };
  col(into, 10, w / 2 - 14); col(out, w / 2 + 8, w / 2 - 14);
}

/** A board of hooks, each with a key and a tag — or without the key. */
export function drawKeys(g, w, h, tags) {
  P(g, '#7a5a34', 0, 0, w, h); P(g, '#5f4426', 0, h - 3, w, 3);
  const per = Math.ceil(tags.length / 2), step = (w - 12) / per;
  tags.forEach((t, i) => {
    const x = 6 + (i % per) * step + step / 2, y = i < per ? 6 : h / 2 + 3;
    P(g, '#c9a24a', x - 1, y, 2, 3);
    if (t.key !== false) { P(g, '#b9bec6', x - 1, y + 3, 2, 9); P(g, '#b9bec6', x - 2, y + 10, 4, 2); }
    P(g, '#efe9d8', x - 9, y + 14, 18, 8); g.fillStyle = '#2a2620'; g.font = `700 6px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t.text, x, y + 18.5);
  });
}
