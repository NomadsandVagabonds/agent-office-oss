// The Backrooms — the neighbourhood (themes.js `suburb`): what an office built
// indoors when it tried to remember one. It is still the building: ceiling
// tiles and tubes over every lawn, carpet showing where the fake grass was cut
// short of the wall, sky-blue emulsion on the partitions with clouds cut out of
// board and screwed on. Every object in it is one of three things, and nothing
// says which: real (it does what it looks as if it does), a prop (a painted
// flat: walk round it and there is bare board and a brace with a sandbag on
// its foot), or misremembered (the right thing, the wrong size or the wrong
// number of them).
//
// This file is what its plain rooms are dressed with (rooms.js asks for it),
// and the parts its own rooms (rooms/show-home.js, rooms/recess.js) share:
//   lawn(c)        the carpet left showing round the grass, and the clouds on the walls
//   standing(c, p) one piece of a plain room's layout that is not wall: a run of picket fence, a scenic flat, a brace (quiet.js)
//   THINGS         what somebody left on a lawn (gen.js KNOWN_THINGS)
//   setArt(kit)    the painted board everything flat is cut from, as one texture
//   sheet, beam    a flat piece and a length of timber between any two points
//   fence, flat    a run of pickets and a braced flat, anywhere, at any angle
//   daylight(c)    the tubes of a room too big to be lit one lamp to a panel
import * as THREE from 'three';
import { Batch, lin, ticks, WHITE } from './kit.js';
import { makeCutout } from './cutout.js';
import { TILE } from './gen.js';
import { FENCE, FLAT } from './quiet.js';
import { LEAN, REFUSE, lean, pressing } from './marks.js';

const P = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const PPM = 40;                                    // painted pixels to the metre, as everywhere down here
/** The office's own carpet, which is what is under all of it. */
export const CARPET = '#857c62';
export const BOARD = [0.74, 0.6, 0.4], TIMBER = [0.78, 0.66, 0.46], WHITEWASH = [0.93, 0.92, 0.86];

/* ---- the painted board ---------------------------------------------------------------------------------- */

// name → [x, y, w, h] on the sheet, in pixels
const CELLS = {
  cloudA: [0, 0, 96, 40], cloudB: [96, 0, 64, 32], cloudC: [160, 0, 48, 24], picket: [208, 0, 48, 40],
  ply: [256, 0, 48, 96], streetA: [304, 0, 48, 96], streetB: [352, 0, 48, 96], streetC: [400, 0, 48, 96],
  flamingo: [448, 0, 24, 40], flamingoBack: [472, 0, 24, 40],
  hillA: [0, 40, 96, 36], hillB: [96, 40, 96, 36], hose: [208, 40, 32, 32],
  tree: [0, 96, 64, 112], treeBack: [64, 96, 64, 112], duck: [128, 96, 32, 28], duckBack: [160, 96, 32, 28], bush: [192, 96, 48, 32],
  corn: [256, 96, 48, 80], mallA: [304, 96, 96, 48], mallB: [400, 96, 96, 48], carSide: [304, 148, 108, 44],
};
const SW = 512, SH = 256;

function blob(g, col, list) { g.fillStyle = col; for (const [x, y, rx, ry] of list) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); } }
function cloud(g, w, h, puffs) {
  blob(g, '#c9d6de', puffs.map(([x, y, rx, ry]) => [x * w, y * h + 2, rx * w, ry * h]));
  blob(g, '#f6f7f1', puffs.map(([x, y, rx, ry]) => [x * w, y * h, rx * w, ry * h]));
  g.clearRect(0, h - 3, w, 3); P(g, '#c9d6de', w * 0.14, h - 5, w * 0.72, 2);
}
function hills(g, w, h, seed) {
  for (let x = 0; x < w; x++) {
    const far = 10 + Math.round(5 * Math.sin((x / w) * Math.PI * 2 + seed) + 3 * Math.sin((x / w) * Math.PI * 4 + seed * 2.1));
    const near = 20 + Math.round(4 * Math.sin((x / w) * Math.PI * 2 + seed + 2.2) + 2 * Math.sin((x / w) * Math.PI * 6 + seed));
    P(g, '#9cc47a', x, far, 1, h - far); P(g, '#6ea552', x, near, 1, h - near); P(g, '#86b866', x, near, 1, 1);
  }
}
// a street, as far as anybody could remember: sky, a row of houses much too small and all the same, a lawn, a road
function street(g, w, h, k) {
  P(g, '#a9d3ee', 0, 0, w, h); P(g, '#bcdcf0', 0, 34, w, 14); P(g, '#cfe6f2', 0, 48, w, 8);
  if (k === 1) blob(g, '#f6f7f1', [[30, 18, 12, 5], [22, 15, 7, 5], [37, 16, 6, 4]]);
  if (k === 2) blob(g, '#f6f7f1', [[10, 26, 8, 3]]);
  P(g, '#8fbd6e', 0, 56, w, 6);
  const house = (x, body, roof) => { P(g, body, x, 50, 12, 9); g.fillStyle = roof; g.beginPath(); g.moveTo(x - 1, 50); g.lineTo(x + 6, 44); g.lineTo(x + 13, 50); g.fill(); P(g, '#5b4636', x + 5, 54, 2, 5); P(g, '#f3e7a6', x + 1, 52, 3, 3); P(g, '#f3e7a6', x + 8, 52, 3, 3); };
  for (let x = 2 - k * 5; x < w; x += 16) house(x, '#efe9d8', '#8c5145');
  P(g, '#79ad5c', 0, 59, w, h - 59); P(g, '#6ea552', 0, 70, w, h - 70);
  for (let i = 0; i < 26; i++) P(g, '#86b866', (i * 37 + k * 11) % w, 62 + ((i * 23) % 22), 1, 2);
  P(g, '#77787a', 0, 84, w, 10); P(g, '#e9e6d6', 0, 84, w, 1); for (let x = 4 + k * 3; x < w; x += 14) P(g, '#e9e6d6', x, 89, 7, 1);
  P(g, '#6ea552', 0, 94, w, 2);
}
function plyBack(g, w, h) {
  P(g, '#c8a473', 0, 0, w, h);
  for (let y = 0; y < h; y += 3) P(g, y % 9 ? '#c19c6b' : '#b58f5f', 0, y, w, 1);
  blob(g, '#a9824f', [[13, 22, 3, 2], [34, 61, 2, 3], [9, 80, 2, 2]]);
  // the frame it is nailed to, and a rail across
  for (const [x, y, ww, hh] of [[0, 0, w, 4], [0, h - 4, w, 4], [0, 0, 4, h], [w - 4, 0, 4, h], [0, 46, w, 4]]) { P(g, '#dcc08e', x, y, ww, hh); P(g, '#a98a5c', x, y + hh - 1, ww, 1); }
  g.fillStyle = '#5a4026'; g.font = '700 7px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center';
  g.fillText('THIS SIDE', w / 2, 24); g.fillText('BACK', w / 2, 33);
}
function tree(g, w, h, back) {
  P(g, '#7a5236', w / 2 - 4, h * 0.5, 8, h * 0.5); P(g, '#63402a', w / 2 + 1, h * 0.5, 3, h * 0.5);
  blob(g, '#4f8f45', [[w / 2, 38, 28, 30], [w / 2 - 12, 52, 18, 16], [w / 2 + 13, 50, 17, 17], [w / 2 + 2, 20, 18, 16]]);
  blob(g, '#6fae58', [[w / 2 - 8, 26, 9, 7], [w / 2 + 10, 36, 8, 6], [w / 2 - 14, 46, 6, 5]]);
  if (back) { g.globalCompositeOperation = 'source-in'; P(g, '#c8a473', 0, 0, w, h); g.globalCompositeOperation = 'source-atop'; for (let y = 0; y < h; y += 3) P(g, '#b99364', 0, y, w, 1); P(g, '#dcc08e', w / 2 - 3, 6, 6, h); P(g, '#dcc08e', 6, 44, w - 12, 5); g.globalCompositeOperation = 'source-over'; }
}
function flamingo(g, w, h, back) {
  g.strokeStyle = '#e8739a'; g.lineWidth = 3; g.beginPath(); g.moveTo(12, 20); g.quadraticCurveTo(21, 12, 14, 7); g.stroke();
  blob(g, '#f08db0', [[10, 22, 8, 5.5]]); blob(g, '#e8739a', [[13, 6, 3, 2.6]]); P(g, '#2a2420', 15, 6, 4, 2); P(g, '#e8739a', 5, 21, 6, 2);
  P(g, '#3a3632', 10, 27, 1, 13);
  if (back) { g.globalCompositeOperation = 'source-in'; P(g, '#b08a5c', 0, 0, w, h); g.globalCompositeOperation = 'source-over'; }
}
function duck(g, w, h, back) {
  blob(g, '#f2c230', [[14, 17, 12, 8], [24, 8, 6.5, 6]]); P(g, '#e8862e', 28, 8, 4, 3); P(g, '#2a2420', 24, 6, 2, 2);
  g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(2, 14); g.lineTo(0, 6); g.lineTo(8, 12); g.fill(); blob(g, '#dba51c', [[13, 18, 6, 4]]);
  if (back) { g.globalCompositeOperation = 'source-in'; P(g, '#c8a473', 0, 0, w, h); g.globalCompositeOperation = 'source-over'; }
}
// a field of corn by somebody who was told about one: the same stalk, the same ear, at the same height, for ever
function corn(g, w, h) {
  for (let x = 2; x < w; x += 8) {
    P(g, '#5f8f3a', x + 3, 4, 2, h - 4); P(g, '#4b7630', x + 4, 4, 1, h - 4);
    for (let y = 12; y < h; y += 14) { g.fillStyle = '#6fa544'; g.beginPath(); g.moveTo(x + 4, y + 6); g.quadraticCurveTo(x + 9, y, x + 10, y + 5); g.quadraticCurveTo(x + 8, y + 3, x + 4, y + 8); g.fill(); g.beginPath(); g.moveTo(x + 4, y + 12); g.quadraticCurveTo(x - 1, y + 6, x - 2, y + 11); g.quadraticCurveTo(x, y + 9, x + 4, y + 14); g.fill(); }
    P(g, '#e6c648', x + 5, 30, 3, 8); P(g, '#c9a52f', x + 7, 30, 1, 8); P(g, '#d9cf9a', x + 3, 1, 4, 4);
  }
}
// a row of shops, drawn straight on the paint with a marker by somebody who had them described: boxes, a sign each, somewhere to leave a car
function mall(g, w, h, k) {
  g.strokeStyle = '#2c3f5c'; g.fillStyle = '#2c3f5c'; g.lineWidth = 1;
  const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0 + 0.5, y0 + 0.5); g.lineTo(x1 + 0.5, y1 + 0.5); g.stroke(); };
  line(0, 34, w, 34); line(0, 10, w, 10);
  const names = k ? ['STOR', 'SHOPE', 'OPEN OPEN'] : ['SHOP', 'STORE 2', 'SHOP'];
  for (let i = 0; i < 3; i++) {
    const x = i * 32; line(x, 10, x, 34); g.strokeRect(x + 4.5, 13.5, 23, 6); g.strokeRect(x + 4.5, 22.5, 10, 11); g.strokeRect(x + 17.5, 23.5, 10, 7);
    garble(g, names[i], x + 4, 14, 24, 6, { color: '#2c3f5c', size: 5, weight: 400, mess: 0.5 }, i + k * 3 + 1);
  }
  for (let x = 6; x < w; x += 12) line(x, 38, x - 4, 47);
  if (k) { line(80, 34, 80, 2); line(80, 2, 86, 2); g.strokeRect(84.5, 2.5, 4, 2); }
}
const DRAW = {
  cloudA: (g, w, h) => cloud(g, w, h, [[0.3, 0.6, 0.26, 0.32], [0.52, 0.42, 0.24, 0.38], [0.72, 0.62, 0.22, 0.28], [0.5, 0.7, 0.4, 0.22]]),
  cloudB: (g, w, h) => cloud(g, w, h, [[0.32, 0.58, 0.26, 0.32], [0.6, 0.48, 0.28, 0.4], [0.5, 0.72, 0.38, 0.2]]),
  cloudC: (g, w, h) => cloud(g, w, h, [[0.36, 0.56, 0.28, 0.34], [0.64, 0.6, 0.26, 0.3]]),
  picket: (g, w, h) => {
    for (let x = 3; x < w; x += 12) { P(g, '#f1efe4', x, 4, 6, h - 4); P(g, '#f1efe4', x + 1, 2, 4, 2); P(g, '#f1efe4', x + 2, 0, 2, 2); P(g, '#cfccbd', x + 5, 4, 1, h - 4); }
    P(g, '#e4e1d3', 0, 11, w, 3); P(g, '#c4c1b2', 0, 14, w, 1); P(g, '#e4e1d3', 0, 30, w, 3); P(g, '#c4c1b2', 0, 33, w, 1);
  },
  ply: plyBack, streetA: (g, w, h) => street(g, w, h, 0), streetB: (g, w, h) => street(g, w, h, 1), streetC: (g, w, h) => street(g, w, h, 2),
  flamingo: (g, w, h) => flamingo(g, w, h, false), flamingoBack: (g, w, h) => flamingo(g, w, h, true),
  hillA: (g, w, h) => hills(g, w, h, 0.4), hillB: (g, w, h) => hills(g, w, h, 3.1),
  hose: (g) => { g.strokeStyle = '#3f8a4a'; g.lineWidth = 2.4; for (const r of [6, 9.5, 13]) { g.beginPath(); g.arc(16, 16, r, 0, 7); g.stroke(); } g.strokeStyle = '#2f6b3a'; g.lineWidth = 1; for (const r of [7, 10.5, 14]) { g.beginPath(); g.arc(16, 16, r, 0.6, 3.4); g.stroke(); } P(g, '#c9a43a', 26, 3, 4, 3); },
  tree: (g, w, h) => tree(g, w, h, false), treeBack: (g, w, h) => tree(g, w, h, true),
  duck: (g, w, h) => duck(g, w, h, false), duckBack: (g, w, h) => duck(g, w, h, true),
  // a car, from the side, in no colour: whoever cuts one out paints it afterwards
  carSide: (g, w, h) => { g.fillStyle = '#e9e7e0'; g.beginPath(); g.moveTo(2, 34); g.lineTo(2, 22); g.lineTo(22, 19); g.lineTo(34, 6); g.lineTo(72, 6); g.lineTo(86, 19); g.lineTo(106, 22); g.lineTo(106, 34); g.fill();
    g.fillStyle = '#39414a'; g.beginPath(); g.moveTo(27, 19); g.lineTo(36, 9); g.lineTo(52, 9); g.lineTo(52, 19); g.fill(); g.beginPath(); g.moveTo(55, 19); g.lineTo(55, 9); g.lineTo(70, 9); g.lineTo(81, 19); g.fill();
    P(g, '#bdbab0', 2, 26, 104, 2); blob(g, '#1d1d1f', [[24, 35, 9, 9], [84, 35, 9, 9]]); blob(g, '#9a9a96', [[24, 35, 4, 4], [84, 35, 4, 4]]); P(g, '#f3e7a6', 103, 22, 3, 4); },
  corn, mallA: (g, w, h) => mall(g, w, h, 0), mallB: (g, w, h) => mall(g, w, h, 1),
  bush: (g) => { blob(g, '#4f8f45', [[14, 20, 13, 12], [30, 18, 14, 14], [24, 24, 20, 8]]); blob(g, '#6fae58', [[12, 16, 5, 4], [32, 12, 6, 4]]); },
};
/** The sheet of painted board, and where each thing is on it: art.uv(name, mirrored) → [u0, v0, u1, v1]; art.size(name) → [w, h] in metres. */
export function setArt(kit) {
  const texture = kit.tex.custom('suburb:set', SW, SH, (g) => {
    for (const [name, [x, y, w, h]] of Object.entries(CELLS)) { g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); DRAW[name](g, w, h); g.restore(); g.globalCompositeOperation = 'source-over'; }
  }, { clamp: true });
  const uv = (name, mirror = false) => { const [x, y, w, h] = CELLS[name], u0 = x / SW, u1 = (x + w) / SW; return [mirror ? u1 : u0, 1 - (y + h) / SH, mirror ? u0 : u1, 1 - y / SH]; };
  return { texture, uv, size: (name) => [CELLS[name][2] / PPM, CELLS[name][3] / PPM] };
}
/** The batch everything cut from that sheet is drawn into: one mesh a room. */
export const cutBatch = (c) => c.mapped('suburb:set', setArt(c.kit).texture, { cutout: true });

/**
 * Lettering by something that has seen lettering. Every letter is nearly a letter: some are the wrong way round or the
 * wrong way up, some have slid into the next, one is its neighbour, one is two. Drawn a glyph at a time into (x, y, w, h).
 * The same text and seed is the same mess. opt: { color, size, weight, mess: 0…1 (how far gone) }
 */
export function garble(g, text, x, y, w, h, opt = {}, seed = 1) {
  let k = (seed * 2654435761) >>> 0; const r = () => { k = (Math.imul(k, 1664525) + 1013904223) >>> 0; return k / 4294967296; };
  const chars = String(text).split(''), mess = opt.mess ?? 0.5, twin = { E: 'F', O: 'Q', I: 'L', A: 'V', M: 'W', N: 'H', S: '5', R: 'P', T: 'I', P: 'R', C: 'G', U: 'V', D: 'O', L: 'I', B: '8' };
  let size = opt.size || Math.floor(h * 0.7);
  const font = (px) => `${opt.weight || 700} ${px}px ui-monospace, Menlo, Consolas, monospace`;
  g.font = font(size); while (size > 5 && g.measureText('M').width * chars.length > w - 6) g.font = font(--size);
  const cw = g.measureText('M').width, x0 = x + (w - cw * chars.length) / 2 + cw / 2;
  g.fillStyle = opt.color || '#1c1812'; g.textAlign = 'center'; g.textBaseline = 'middle';
  chars.forEach((ch, i) => {
    if (ch === ' ') { r(); r(); return; }
    const roll = r(), gone = roll < mess, kind = Math.floor(r() * 7), cx = x0 + i * cw, cy = y + h / 2 + (gone ? (r() - 0.5) * size * 0.25 : 0);
    g.save(); g.translate(cx, cy);
    if (!gone) { g.fillText(ch, 0, 0.5); g.restore(); return; }
    if (kind === 0) g.scale(-1, 1); else if (kind === 1) g.scale(1, -1); else if (kind === 2) g.rotate((r() - 0.5) * 0.7); else if (kind === 3) g.scale(0.55, 1.25);
    const what = kind === 4 ? twin[ch] || ch : kind === 5 && chars[i + 1] && chars[i + 1] !== ' ' ? chars[i + 1] : ch;
    g.fillText(what, 0, 0.5);
    if (kind === 6) { g.globalAlpha = 0.8; g.fillText(ch, cw * 0.38, size * 0.12); g.globalAlpha = 1; }                    // two of it, run together
    if (kind === 5) g.fillRect(-cw * 0.5, size * 0.18, cw * 1.3, Math.max(1, size * 0.09));                                  // a stroke that belongs to nothing
    g.restore();
  });
}

/* ---- pieces ------------------------------------------------------------------------------------------------- */

/**
 * A flat piece between four corners (bottom-left, bottom-right, top-right, top-left as seen from the side it faces), cut
 * nu × nv so that the light has something to hold on to. uv: [u0, v0, u1, v1], or (s, t) → [u, v] for 0…1 across and up.
 */
export function sheet(batch, a, b, cc, d, nu = 1, nv = 1, uv = null, alb = WHITE, ao = 1) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
  const base = batch.verts;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const s = i / nu, t = j / nv;
    for (let k = 0; k < 3; k++) batch.pos.push((a[k] * (1 - s) + b[k] * s) * (1 - t) + (d[k] * (1 - s) + cc[k] * s) * t);
    batch.nor.push(nx, ny, nz);
    const q = typeof uv === 'function' ? uv(s, t) : uv ? [uv[0] + (uv[2] - uv[0]) * s, uv[1] + (uv[3] - uv[1]) * t] : [s, t];
    batch.uv.push(q[0], q[1]); batch.alb.push(alb[0], alb[1], alb[2]); batch.ao.push(ao);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const p = base + j * (nu + 1) + i; batch.idx.push(p, p + 1, p + nu + 2, p, p + nu + 2, p + nu + 1); }
  return batch;
}
/** An upright flat piece from (ax, az) to (bx, bz), y0 to y1: it faces whoever sees a on their left. */
export const upright = (batch, ax, az, bx, bz, y0, y1, uv, alb, ao) => sheet(batch, [ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 0.6)), Math.max(1, Math.round((y1 - y0) / 0.8)), uv, alb, ao);
/** A length of square timber from a to b, t thick. */
export function beam(batch, a, b, t = 0.05, alb = TIMBER, ao = 1) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1, e = d.map((v) => v / L);
  const ref = Math.abs(e[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  let p = [e[1] * ref[2] - e[2] * ref[1], e[2] * ref[0] - e[0] * ref[2], e[0] * ref[1] - e[1] * ref[0]]; const pl = Math.hypot(...p); p = p.map((v) => (v / pl) * t / 2);
  let q = [e[1] * p[2] - e[2] * p[1], e[2] * p[0] - e[0] * p[2], e[0] * p[1] - e[1] * p[0]]; const ql = Math.hypot(...q); q = q.map((v) => (v / ql) * t / 2);
  const at = (o, sp, sq) => [o[0] + sp * p[0] + sq * q[0], o[1] + sp * p[1] + sq * q[1], o[2] + sp * p[2] + sq * q[2]];
  const n = Math.max(1, Math.round(L / 1.2));
  // four faces, each wound to face out (p × e = q's side, and so round)
  for (const [s0, t0, s1, t1] of [[1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1], [-1, -1, 1, -1]]) sheet(batch, at(a, s0, t0), at(a, s1, t1), at(b, s1, t1), at(b, s0, t0), 1, n, null, alb, ao);
  return batch;
}

/** A run of picket fence from (ax, az) to (bx, bz): pickets on both faces, a post at either end. Solid where it runs square to the room. */
export function fence(c, ax, az, bx, bz, opt = {}) {
  const art = setArt(c.kit), cut = cutBatch(c), len = Math.hypot(bx - ax, bz - az), h = opt.h || FENCE.h;
  if (len < 0.05) return;
  const ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux, [mw] = art.size('picket'), uv = art.uv('picket');
  for (let s = 0; s < len - 0.01; s += mw) {
    const e = Math.min(len, s + mw), part = [uv[0], uv[1], uv[0] + (uv[2] - uv[0]) * ((e - s) / mw), uv[3]];
    for (const k of [1, -1]) {
      const o = 0.022 * k, x0 = ax + ux * s + nx * o, z0 = az + uz * s + nz * o, x1 = ax + ux * e + nx * o, z1 = az + uz * e + nz * o;
      // (opt.hang: the same fence, the other way up, from that height down)
      const y0 = opt.hang ? opt.hang - h : 0.02, y1 = opt.hang || h, pv = opt.hang ? [part[0], part[3], part[2], part[1]] : part;
      if (k > 0) upright(cut, x0, z0, x1, z1, y0, y1, pv); else upright(cut, x1, z1, x0, z0, y0, y1, [pv[2], pv[1], pv[0], pv[3]]);
    }
  }
  if (opt.hang) return;
  for (const [x, z] of opt.posts === false ? [] : [[ax, az], [bx, bz]]) { c.flat.box(x - 0.05, 0, z - 0.05, x + 0.05, h + 0.07, z + 0.05, WHITEWASH, { skip: '-y' }); c.flat.box(x - 0.065, h + 0.07, z - 0.065, x + 0.065, h + 0.1, z + 0.065, WHITEWASH); }
  if (opt.solid !== false && (Math.abs(ux) > 0.999 || Math.abs(uz) > 0.999)) c.solid(Math.min(ax, bx) - 0.05, Math.min(az, bz) - 0.05, Math.max(ax, bx) + 0.05, Math.max(az, bz) + 0.05, { keep: !!opt.keep });
  for (let s = 0; s <= len; s += 0.6) c.reserve(ax + ux * s, az + uz * s, 0.4);
}

/**
 * A scenic flat: a sheet of board from (ax, az) to (bx, bz), painted with `front` on the side that sees a on its left and
 * bare on the other. opt: h, back (the art for the back: the board, unless it is a cut-out shape), brace (how far out behind).
 */
export function flat(c, ax, az, bx, bz, front, opt = {}) {
  const art = setArt(c.kit), cut = cutBatch(c), len = Math.hypot(bx - ax, bz - az), h = opt.h || FLAT.h;
  const ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux, o = 0.012, fu = art.uv(front), bu = art.uv(opt.back || 'ply', !!opt.back);
  // (where the ceiling is lower than the sheet, the sheet was sawn off at the top: the picture loses its sky, not its road)
  const crop = (uv) => [uv[0], uv[1], uv[2], uv[1] + (uv[3] - uv[1]) * Math.min(1, h / (opt.full || h))];
  upright(cut, ax + nx * o, az + nz * o, bx + nx * o, bz + nz * o, 0, h, crop(fu));
  upright(cut, bx - nx * o, bz - nz * o, ax - nx * o, az - nz * o, 0, h, crop(bu));
  if (opt.brace) brace(c, (ax + bx) / 2 - nx * o, (az + bz) / 2 - nz * o, -nx, -nz, opt.brace, Math.min(h * 0.72, 1.75));
  if (opt.solid !== false && (Math.abs(ux) > 0.999 || Math.abs(uz) > 0.999)) c.solid(Math.min(ax, bx) - 0.03, Math.min(az, bz) - 0.03, Math.max(ax, bx) + 0.03, Math.max(az, bz) + 0.03, { tall: h > 1.25, keep: !!opt.keep });
  c.reserve((ax + bx) / 2, (az + bz) / 2, len / 2 + 0.2);
}
/** What holds a flat up: a length of timber from part-way up its back down to the floor `reach` out behind, a rail along the floor, a sandbag on the rail. */
export function brace(c, x, z, dx, dz, reach = FLAT.brace, up = 1.7) {
  const fx = x + dx * reach, fz = z + dz * reach;
  beam(c.flat, [x, up, z], [fx, 0.04, fz], 0.045); beam(c.flat, [x, 0.025, z], [fx, 0.025, fz], 0.045);
  c.flat.ball(x + dx * reach * 0.72, 0.1, z + dz * reach * 0.72, 0.19, [0.62, 0.56, 0.42], 0.5, 7);
  c.shadow(x + dx * reach * 0.6, z + dz * reach * 0.6, 0.3 + Math.abs(dx) * reach * 0.6, 0.3 + Math.abs(dz) * reach * 0.6, 0.35);
}

/**
 * A flat that goes over. As flat(), square to the room, with no brace of its own. Stood against from behind, facing it, for the
 * best part of a second, it falls on its face and stays there: what it was hiding is now a way through. From the front it only
 * shudders (that is the side its braces hold). The floor's own rule: a prop is whatever falls over when it is leaned on.
 */
export function fallingFlat(c, ax, az, bx, bz, front, opt = {}) {
  const art = setArt(c.kit), len = Math.hypot(bx - ax, bz - az), h = opt.h || FLAT.h, ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux, o = 0.012;
  const crop = (uv) => [uv[0], uv[1], uv[2], uv[1] + (uv[3] - uv[1]) * Math.min(1, h / (opt.full || h))], b = new Batch();
  upright(b, ax + nx * o, az + nz * o, bx + nx * o, bz + nz * o, 0, h, crop(art.uv(front)), opt.alb);
  upright(b, bx - nx * o, bz - nz * o, ax - nx * o, az - nz * o, 0, h, crop(art.uv(opt.back || 'ply', !!opt.back)));
  const mx = (ax + bx) / 2, mz = (az + bz) / 2, g = c.dynamic(b, { pivot: [mx + nx * o, 0.02, mz + nz * o], map: art.texture, cutout: true });
  const col = c.solid(Math.min(ax, bx) - 0.03, Math.min(az, bz) - 0.03, Math.max(ax, bx) + 0.03, Math.max(az, bz) + 0.03, { tall: h > 1.25, keep: true });
  c.reserve(mx, mz, len / 2 + 0.2);
  const tip = (a) => { if (Math.abs(ux) > 0.5) g.rotation.x = a * Math.sign(nz); else g.rotation.z = -a * Math.sign(nx); }, say = () => { const w = c.toWorld(mx, mz); c.env.play?.('shuffle', w.x, w.z, 7); };
  let held = 0, fall = 0, wob = 0;
  const state = { down: false }, w0 = c.toWorld(mx, mz), w1 = c.toWorld(mx + nx, mz + nz), nw = [w1.x - w0.x, w1.z - w0.z];
  c.tick((dt, t, me) => {
    if (fall >= 1) return;
    if (fall > 0) { fall = Math.min(1, fall + dt * 2.4); tip((Math.PI / 2) * fall * fall); if (fall >= 1) { state.down = true; say(); } return; }
    if (wob > 0) { wob -= dt; tip(wob > 0 ? Math.sin(wob * 44) * 0.05 * wob : 0); }
    if (!me.inside) return;
    // the same lean as the wall that gives (marks.js): pressed against it, still pushing, getting nowhere
    const rx = me.x - mx, rz = me.z - mz, off = rx * nx + rz * nz, wish = me.world ? me.world.wishX * nw[0] + me.world.wishZ * nw[1] : 0;
    held = lean(held, dt, pressing(Math.abs(off), rx * ux + rz * uz, len, -wish * Math.sign(off), me.speed));
    if (off >= 0) { if (held >= REFUSE && wob <= 0) { wob = 0.4; held = 0; say(); } return; }
    if (held >= LEAN) { held = 0; fall = 0.001; col.on = false; say(); }
  });
  return state;
}

/* ---- a plain room's layout, where it is not wall (quiet.js: `prop` on a pillar) ------------------------------------- */

/** One piece of it. The room's frame; the pillar says where, how high, and which way round. */
export function standing(c, p) {
  const along = p.w >= p.d, x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2;
  if (p.prop === 'fence') {
    if (along) fence(c, x0, p.z, x1, p.z, { h: p.h, keep: true }); else fence(c, p.x, z0, p.x, z1, { h: p.h, keep: true });
  } else if (p.prop === 'flat') {
    // the row stands off the middle of the room, and its back is to the nearer wall (quiet.js `flats`)
    const names = ['streetA', 'streetB', 'streetC'], front = names[(p.art || 0) % 3], o = { h: p.h, full: FLAT.h, keep: true };
    if (along) { if (p.z < 0) fallingFlat(c, x0, p.z, x1, p.z, front, o); else fallingFlat(c, x1, p.z, x0, p.z, front, o); }
    else if (p.x < 0) fallingFlat(c, p.x, z1, p.x, z0, front, o); else fallingFlat(c, p.x, z0, p.x, z1, front, o);
  } else if (p.prop === 'brace') {
    // (a brace's pillar reaches out from the back of its flat: the end nearer the middle of the room is the flat's)
    if (along) { const s = p.x < 0 ? -1 : 1; brace(c, s < 0 ? x1 : x0, p.z, s, 0, p.w); } else { const s = p.z < 0 ? -1 : 1; brace(c, p.x, s < 0 ? z1 : z0, 0, s, p.d); }
    c.solid(x0, z0, x1, z1, { keep: true }); c.reserve(p.x, p.z, Math.max(p.w, p.d) / 2 + 0.15);
  }
}

/* ---- the lawn ------------------------------------------------------------------------------------------------ */

/** A piece cut from the board, screwed flat to a wall. */
export function onWall(c, name, side, at, y, opt = {}) {
  const art = setArt(c.kit), [w, h] = art.size(name), k = opt.scale || 1, p = c.wallAt(side, at, opt.off ?? 0.014), U = p.U, hw = (w * k) / 2, hh = (h * k) / 2;
  sheet(cutBatch(c), [p.x - U[0] * hw, y - hh, p.z - U[2] * hw], [p.x + U[0] * hw, y - hh, p.z + U[2] * hw], [p.x + U[0] * hw, y + hh, p.z + U[2] * hw], [p.x - U[0] * hw, y + hh, p.z - U[2] * hw], Math.max(1, Math.round(w * k / 0.8)), 1, art.uv(name, !!opt.mirror));
}
/**
 * What every room of the neighbourhood has, plain or not: the grass stops short of the walls and the carpet shows (not across
 * a doorway: the grass goes on through), and there are clouds on the walls. opt: { clouds: false, border: false, paint: 'sky' | 'corn' | 'mall', wrong: 0…1 (how likely one thing got wrong is), which }
 */
export function lawn(c, opt = {}) {
  const { W, D, R, room } = c, s = room.shape;
  if (room.crawl) return;
  if (opt.border !== false && !(s && (s.kind === 'ell' || s.kind === 'pinch'))) {
    const bw = opt.width || R.pick([0.3, 0.4, 0.4, 0.55]), carpet = c.mapped('suburb:carpet', c.kit.tex.carpet(CARPET)), edge = [0.07, 0.11, 0.05];
    const rect = (x0, z0, x1, z1, y, batch, alb, uv) => { if (x1 - x0 > 0.01 && z1 - z0 > 0.01) batch.grid([x0, y, z0], [0, 0, 1], [1, 0, 0], ticks(z1 - z0, 0.5, 0), ticks(x1 - x0, 0.5, 0), uv ? (u, v) => [(x0 + v) / 1.6, (z0 + u) / 1.6] : null, alb); };
    for (const side of ['back', 'front', 'left', 'right']) {
      const ends = side === 'left' || side === 'right', half = (ends ? D : W) / 2, trim = ends ? bw : 0;          // (the side strips stop short of the corners, which are the end strips')
      const cuts = room.doors.filter((d) => d.side === side).map((d) => [d.c - d.w / 2, d.c + d.w / 2]).sort((p, q) => p[0] - q[0]);
      let from = -half + trim;
      for (const [a, b] of [...cuts, [half - trim, half - trim]]) {
        if (a - from > 0.05) {
          const p = c.wallAt(side, from, 0), q = c.wallAt(side, a, bw), e = c.wallAt(side, from, bw + 0.03);
          rect(Math.min(p.x, q.x), Math.min(p.z, q.z), Math.max(p.x, q.x), Math.max(p.z, q.z), 0.011, carpet, WHITE, true);
          rect(Math.min(e.x, q.x), Math.min(e.z, q.z), Math.max(e.x, q.x), Math.max(e.z, q.z), 0.012, c.flat, edge, false);      // the cut edge of the grass, and its shadow
        }
        from = Math.max(from, b);
      }
    }
  }
  // what is on the walls: clouds, mostly. In some rooms a field of corn, or a row of shops, as described to whoever drew them
  const paint = opt.paint || R.pick(['sky', 'sky', 'sky', 'corn', 'corn', 'mall', 'mall', 'melt', 'melt']), art = setArt(c.kit), low = paint === 'corn' ? 2.75 : paint === 'mall' ? 1.95 : 1.55;
  c.rt.paint = paint;
  if (paint === 'melt') {
    // the owner's sky: boards of it round the room as far up as a board goes, and the room's own things run with it
    const b = c.mapped('suburb:melt', meltArt(c.kit)); let n = 0;
    for (const side of ['back', 'left', 'right', 'front']) for (const [a, e] of c.spans(side, 0.1, 2.2)) for (let i = 0, m = Math.floor((e - a) / MELT.w); i < m; i++, n++) {
      const at = a + (e - a - m * MELT.w) / 2 + (i + 0.5) * MELT.w, p = c.wallAt(side, at, 0.3), hh = Math.min(MELT.h, c.ceilAt(p.x, p.z) - 0.13), u0 = (n % 2) / 2;
      c.hang(b, side, at, 0.11 + hh / 2, MELT.w, hh, [[u0, 1 - hh / MELT.h], [u0 + 0.5, 1 - hh / MELT.h], [u0 + 0.5, 1], [u0, 1]], WHITE, 0.008);
    }
    if (opt.wrong !== 0 && !s && Math.min(W, D) >= 4.6 && c.ceilAt(0, 0) >= 2.6) {
      const along = W >= D, hgt = c.ceilAt(0, 0) * 1.25;
      for (const u of [-1, 1]) { const x = along ? u * W * 0.2 : R.range(-0.6, 0.6), z = along ? R.range(-0.6, 0.6) : u * D * 0.2; if (c.clear(x, z, 0.4)) meltingPole(c, x, z, along ? u : 0.3, along ? 0.3 : u, R.range(0.45, 0.75), hgt); }
      debris(c, 50); c.rt.weird = 'melting';
    }
    return;
  }
  if (paint !== 'sky') for (const side of ['back', 'left', 'right', 'front']) for (const [a, b] of c.spans(side, 0.12, paint === 'corn' ? 2.2 : 1.5)) {
    const [w, h] = art.size(paint === 'corn' ? 'corn' : 'mallA'), n = Math.floor((b - a) / w);
    for (let i = 0; i < n; i++) onWall(c, paint === 'corn' ? 'corn' : (i + (side.length % 2)) % 2 ? 'mallB' : 'mallA', side, a + (b - a - n * w) / 2 + (i + 0.5) * w, 0.11 + h / 2, { off: 0.006 });
  }
  if (opt.clouds !== false) for (const side of ['back', 'left', 'right', 'front']) for (const [a, b] of c.spans(side, 0.3, 2.2)) {
    const len = b - a; if (len < 2.7) continue;
    for (let i = 0, n = Math.max(1, Math.round(len / 5)); i < n; i++) {
      const name = R.pick(['cloudA', 'cloudA', 'cloudB', 'cloudB', 'cloudC']), [w, h] = art.size(name), at = a + (len / n) * (i + R.range(0.3, 0.7));
      const p = c.wallAt(side, at, 0.3), top = c.ceilAt(p.x, p.z), hi = Math.min(top - h / 2 - 0.25, opt.cloudTop || 2.9);
      if (hi < low) continue;
      const y = R.range(low, Math.max(low, hi));
      if (at - w / 2 < a || at + w / 2 > b || y + h / 2 > top - 0.1) continue;
      onWall(c, name, side, at, y, { mirror: R.chance(0.5) });
    }
  }
  if (room.quiet && room.quiet.kind === 'fence' && room.kind === 'plain' && R.chance(opt.neighbour ?? 0.6)) neighbour(c);
  // …and in some lawns that have nothing else, one thing that whoever built this got wrong (WRONG, below)
  const chance = opt.wrong ?? (!room.quiet && !s && room.kind === 'plain' && Math.min(W, D) >= 3.4 ? 0.4 : 0);
  if (chance > 0 && R.chance(chance)) { const name = opt.which || R.pick(Object.keys(WRONG)); if (WRONG[name](c) !== false) c.rt.weird = name; }
}

/* ---- the neighbour ------------------------------------------------------------------------------------------------ */

export const NEIGHBOUR = Object.freeze({ back: 0.75, unseen: 0.45, glance: 0.6, share: 0.2, sulk: 5 });
/**
 * The neighbour's rule, pure. They are always on the other side of the fence from you, level with you, and are never seen
 * getting there. A fence between you is all it takes. The gate is where there is none: go through it without having
 * looked at them (`glanced`: seconds since they were last on screen) and they are in the gateway behind you.
 * → 'stay' | 'across' (go and stand opposite, unseen) | 'gate' (they have you)
 */
export function neighbourly(s, crossed, unseenFor, glanced) {
  if (crossed && glanced > NEIGHBOUR.glance && s.sulk <= 0) return 'gate';
  return unseenFor >= NEIGHBOUR.unseen && s.sulk <= 0 ? 'across' : 'stay';
}
/** A cardboard colleague over the fence of a lawn that has one (quiet.js `fence`). Costs a fifth of the camcorder's charge, never a heart. */
function neighbour(c) {
  const runs = c.room.pillars.filter((p) => p.prop === 'fence'), cast = c.env.cast || [];
  if (runs.length !== 2 || !cast.length) return;
  const alongX = runs[0].w >= runs[0].d, line = alongX ? runs[0].z : runs[0].x, ends = runs.map((p) => (alongX ? [p.x - p.w / 2, p.x + p.w / 2] : [p.z - p.d / 2, p.z + p.d / 2])).sort((a, b) => a[0] - b[0]);
  const g0 = ends[0][1], g1 = ends[1][0], lo = ends[0][0] + 0.5, hi = ends[1][1] - 0.5, who = cast[c.R.int(0, cast.length - 1)];
  const fig = makeCutout(c.kit, 'who:' + who.name, who.look, { creations: c.env.who?.creations, name: who.name });
  c.add(fig); c.rt.neighbour = fig;
  const P2 = (u, v) => (alongX ? [u, v] : [v, u]), gate = alongX ? c.solid(g0, line - 0.1, g1, line + 0.1, { on: false }) : c.solid(line - 0.1, g0, line + 0.1, g1, { on: false });
  const s = { u: (lo + hi) / 2, side: 0, sulk: 0, unseen: 0, glanced: 9, mine: 0, inGate: false };
  const put = (me) => { const [x, z] = P2(s.u, s.inGate ? line : line + s.side * NEIGHBOUR.back); fig.position.set(x, 0, z); fig.rotation.y = me ? Math.atan2(me.x - x, me.z - z) : 0; fig.userData.light(c.sample(x, 1, z)); return [x, z]; };
  c.after.push(() => { const d = c.room.doors[0], q = d ? c.doorPoint(d, 0.5) : { x: 0, z: 0 }; s.mine = Math.sign((alongX ? q.z : q.x) - line) || 1; s.side = -s.mine; put({ x: q.x, z: q.z }); });
  let wait = 0;
  c.tick((dt, t, me) => {
    wait += dt; if (wait < 0.15) return;
    const step = wait; wait = 0;
    if (!me.inside) return;
    const [x, z] = P2(s.u, s.inGate ? line : line + s.side * NEIGHBOUR.back), seen = c.seen(x, z, { radius: 0.5 });
    s.unseen = seen ? 0 : s.unseen + step; s.glanced = seen ? 0 : s.glanced + step; s.sulk = Math.max(0, s.sulk - step);
    const mu = alongX ? me.x : me.z, mv = (alongX ? me.z : me.x) - line, now = Math.abs(mv) > 0.3 ? Math.sign(mv) : s.mine, crossed = now !== s.mine;
    s.mine = now;
    const does = neighbourly(s, crossed && !s.inGate, s.unseen, s.glanced);
    if (does === 'gate') {
      s.inGate = true; s.u = (g0 + g1) / 2; s.sulk = NEIGHBOUR.sulk; gate.on = true; put(me);
      c.env.camera?.drain?.(NEIGHBOUR.share); c.env.interfere?.(1); c.env.hud?.glitch?.(0.6); const w = c.toWorld(...P2(s.u, line)); c.env.play?.('shuffle', w.x, w.z, 8);
    } else if (does === 'across') {
      const u = Math.max(lo, Math.min(hi, mu)), want = u > g0 - 0.5 && u < g1 + 0.5 ? (u < (g0 + g1) / 2 ? g0 - 0.5 : g1 + 0.5) : u;
      if (s.inGate || -now !== s.side || Math.abs(want - s.u) > 0.25) { s.inGate = false; gate.on = false; s.side = -now; s.u = want; put(me); }
    }
  });
}

/* ---- a roller door, for whoever has the thing that opens them ----------------------------------------------------------- */

/**
 * A garage door on a wall. E at it only rattles it. `c.rt.rollers` lists every one in the room as { x, z, open() } (the room's
 * frame): what the opener, when there is one, is to call. Behind it: the wall, mostly; or a garage, as a picture of one.
 */
export function roller(c, side, at, opt = {}) {
  const w = 2.4, h = 2.1, p = c.wallAt(side, at, 0.03), U = p.U, a = [p.x - U[0] * w / 2, p.z - U[2] * w / 2], b = [p.x + U[0] * w / 2, p.z + U[2] * w / 2], q = c.wallAt(side, at, 0.012);
  const tex = c.kit.tex.custom('suburb:roller', 16, 16, (g) => { P(g, '#b9bbb8', 0, 0, 16, 16); for (let y = 0; y < 16; y += 4) { P(g, '#8f918e', 0, y + 3, 16, 1); P(g, '#d2d4d0', 0, y, 16, 1); } });
  if (opt.garage) sheet(c.flat, [q.x - U[0] * w / 2, 0.11, q.z - U[2] * w / 2], [q.x + U[0] * w / 2, 0.11, q.z + U[2] * w / 2], [q.x + U[0] * w / 2, h, q.z + U[2] * w / 2], [q.x - U[0] * w / 2, h, q.z - U[2] * w / 2], 2, 2, null, [0.03, 0.03, 0.035]);
  const leaf = new Batch(); upright(leaf, a[0], a[1], b[0], b[1], 0.02, h, (s, t) => [s * 6, t * 5.25]);
  const door = c.dynamic(leaf, { pivot: [p.x, 0, p.z], map: tex });
  c.wbox(side, at, w + 0.16, h, h + 0.1, 0, 0.06, WHITEWASH); for (const k of [-1, 1]) c.wbox(side, at + k * (w / 2 + 0.04), 0.08, 0, h, 0, 0.06, WHITEWASH);
  c.keepWall(side, at - w / 2 - 0.2, at + w / 2 + 0.2);
  let up = 0, going = false;
  c.tick((dt) => { if (!going || up >= 1) return; up = Math.min(1, up + dt * 0.7); door.position.y = up * (h - 0.25); door.scale.y = 1 - up * 0.86; });
  const f = c.wallAt(side, at, 0.6), it = { x: f.x, z: f.z, open() { going = true; const w2 = c.toWorld(f.x, f.z); c.env.play?.('shuffle', w2.x, w2.z, 9); } };
  (c.rt.rollers ||= []).push(it);
  // with the remote in the hand, E from anywhere near opens the nearest one that is still shut (the item is the lead's: `opener`)
  const has = () => c.env.inventory?.held?.()?.type === 'opener';
  c.use({ x: f.x, z: f.z, r: 12, cone: -1, label: 'open the door', when: () => has() && !going, use: () => it.open() });
  c.use({ x: f.x, z: f.z, r: 1.4, label: 'try the door', when: () => !going && !has(), use: () => { const w2 = c.toWorld(f.x, f.z); c.env.play?.('shuffle', w2.x, w2.z, 6); door.position.y = 0.03; setTimeout(() => { if (!going) door.position.y = 0; }, 120); } });
  return it;
}

/* ---- got wrong: what a lawn has on it when whoever built it had only been told ------------------------------------- */

function flamingoAt(c, x, z, turn) {
  const art = setArt(c.kit), cut = cutBatch(c), dx = Math.cos(turn) * 0.3, dz = Math.sin(turn) * 0.3;
  upright(cut, x - dx, z - dz, x + dx, z + dz, 0, 1.0, art.uv('flamingo')); upright(cut, x + dx, z + dz, x - dx, z - dz, 0, 1.0, art.uv('flamingoBack', true));
  c.shadow(x, z, 0.3, 0.3, 0.3);
}
/** A car, as far down in the lawn as its door handles, its lamps still on. Along x, or along z. */
export function car(c, x, z, along = true, rgb = [0.6, 0.52, 0.38], lift = 0, into = null) {
  const body = into || c.flat;
  const B = (u0, y0, v0, u1, y1, v1, col, o) => (along ? body.box(x + u0, y0 + lift, z + v0, x + u1, y1 + lift, z + v1, col, lift ? {} : o) : body.box(x + v0, y0 + lift, z + u0, x + v1, y1 + lift, z + u1, col, lift ? {} : o));
  if (lift) for (const u of [-1.5, 1.1]) for (const v of [-0.88, 0.7]) B(u, -lift, v, u + 0.55, 0.12, v + 0.18, [0.05, 0.05, 0.06]);
  B(-2.1, 0, -0.85, 2.1, 0.42, 0.85, rgb, { skip: '-y' }); B(-2.1, 0.16, -0.86, 2.1, 0.3, 0.86, [0.36, 0.22, 0.12]);          // the body, and the strip of wood down its side
  B(-1.25, 0.42, -0.74, 0.75, 0.86, 0.74, [0.07, 0.09, 0.11]); B(-1.3, 0.86, -0.78, 0.8, 0.93, 0.78, rgb);                    // glass all round, a roof
  for (const u of [-1.28, -0.28, 0.72]) for (const v of [-0.76, 0.72]) B(u, 0.42, v, u + 0.07, 0.86, v + 0.04, rgb);
  B(-0.9, 0.93, -0.6, 0.4, 0.97, -0.55, [0.6, 0.6, 0.6]); B(-0.9, 0.93, 0.55, 0.4, 0.97, 0.6, [0.6, 0.6, 0.6]);               // somewhere to put the luggage
  const glow = into || c.shining('suburb:lamp', c.kit.tex.white(), 1.6, lin('#ffe9a8'));
  for (const v of [-0.6, 0.6]) { const p = along ? [x + 2.105, z + v] : [x + v, z + 2.105], q = 0.11; const y = 0.22 + lift; if (along) sheet(glow, [p[0], y, p[1] + q], [p[0], y, p[1] - q], [p[0], y + 0.14, p[1] - q], [p[0], y + 0.14, p[1] + q]); else sheet(glow, [p[0] - q, y, p[1]], [p[0] + q, y, p[1]], [p[0] + q, y + 0.14, p[1]], [p[0] - q, y + 0.14, p[1]]); }
  if (into && into.bare) return;                              // (only the shape of one: whoever asked puts it where it is going)
  c.light(x + (along ? 2.5 : 0), 0.35 + lift, z + (along ? 0 : 2.5), '#ffe9a8', 0.5, { k: 1.1, far: 4 });
  if (along) c.solid(x - 2.1, z - 0.85, x + 2.1, z + 0.85); else c.solid(x - 0.85, z - 2.1, x + 0.85, z + 2.1);
  c.blot(x, z, along ? 5.2 : 2.6, along ? 2.6 : 5.2, { a: lift ? 0.3 : 0.45 }); c.reserve(x, z, 2.3);
}
/* ---- the melt: after the owner's own pictures (nomadsandvagabonds), where telephone poles lean and run like paint ------------- */

const MELT = { w: 2.4, h: 2.6 };
/** Two boards of it, side by side in one texture: an ochre sky, firs, small houses, poles going over, and everything above them running down in strokes. */
function meltArt(kit) {
  return kit.tex.custom('suburb:melt', 192, 104, (g, w, h) => {
    let k = 97; const r = () => { k = (Math.imul(k, 1664525) + 1013904223) >>> 0; return k / 4294967296; };
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#d7a94c'); sky.addColorStop(0.6, '#e6c877'); sky.addColorStop(1, '#ecd690'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let b = 0; b < 2; b++) {
      const x0 = b * 96; g.save(); g.beginPath(); g.rect(x0, 0, 96, h); g.clip();
      // firs, and the roofs under them
      g.fillStyle = '#1f2a1c'; for (let x = x0 - 4; x < x0 + 100; x += 5 + r() * 5) { const th = 16 + r() * 16; g.beginPath(); g.moveTo(x, 78); g.lineTo(x + 4, 78 - th); g.lineTo(x + 8, 78); g.fill(); }
      for (let x = x0 + 2; x < x0 + 96; x += 22) { const c2 = ['#e9e7dc', '#c9b23a', '#a8322a', '#dfe6ea'][Math.floor(r() * 4)]; P(g, c2, x, 80, 18, 16); g.fillStyle = '#4a3a34'; g.beginPath(); g.moveTo(x - 2, 80); g.lineTo(x + 9, 71); g.lineTo(x + 20, 80); g.fill(); P(g, '#2a3338', x + 3, 84, 4, 5); P(g, '#7a2a22', x + 11, 86, 4, 10); }
      P(g, '#3f7a3a', x0, 96, 96, 8);
      // the poles, going over
      g.strokeStyle = '#3a2416'; g.lineCap = 'round';
      for (const [px, lean] of b ? [[30, 0.5], [70, -0.25]] : [[22, 0.62], [58, 0.3]]) {
        const tx = x0 + px + Math.sin(lean) * 62, ty = 78 - Math.cos(lean) * 62; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x0 + px, 80); g.lineTo(tx, ty); g.stroke();
        g.lineWidth = 1.4; for (let a = 0; a < 4; a++) { const cx = tx - Math.sin(lean) * (6 + a * 7), cy = ty + Math.cos(lean) * (6 + a * 7), ux = Math.cos(lean) * (9 - a), uy = Math.sin(lean) * (9 - a); g.beginPath(); g.moveTo(cx - ux, cy - uy); g.lineTo(cx + ux, cy + uy); g.stroke(); }
        // …and what was the top of it, running
        for (let i = 0; i < 16; i++) { g.lineWidth = 0.5 + r() * 2.2; g.strokeStyle = ['#3a2416', '#5a3a1e', '#2a1a10', '#f1e2a8'][Math.floor(r() * 4)]; const sx = tx + (r() - 0.5) * 30, sy = ty + r() * 20; g.beginPath(); g.moveTo(sx, sy); g.bezierCurveTo(sx + 20 + r() * 30, sy + 10 + r() * 20, sx - 30 + r() * 40, sy + 40 + r() * 20, sx + (r() - 0.3) * 50, 100 + r() * 6); g.stroke(); }
        g.strokeStyle = '#3a2416';
      }
      for (let i = 0; i < 46; i++) { g.fillStyle = ['#2a1a10', '#a8322a', '#2b477a', '#f1e2a8', '#5a3a1e'][Math.floor(r() * 5)]; g.beginPath(); g.ellipse(x0 + r() * 96, r() * 70, 0.6 + r() * 1.8, 0.4 + r() * 1.1, r() * 3, 0, 7); g.fill(); }
      g.restore();
    }
  }, { clamp: true });
}
/** What has run off a wall and gone on across the grass: a patch of it. */
function swirlArt(kit) {
  return kit.tex.custom('suburb:swirl', 96, 96, (g) => { let k = 31; const r = () => { k = (Math.imul(k, 1664525) + 1013904223) >>> 0; return k / 4294967296; }; g.lineCap = 'round';
    for (let i = 0; i < 22; i++) { g.lineWidth = 1 + r() * 3; g.strokeStyle = ['#f1e2a8', '#e6c877', '#3a2416', '#5a3a1e', '#f1e2a8'][i % 5]; const y = 6 + i * 4; g.beginPath(); g.moveTo(-4, y); g.bezierCurveTo(24, y - 14 + r() * 28, 60, y - 16 + r() * 32, 100, y + (r() - 0.5) * 30); g.stroke(); } }, { clamp: true });
}
/** A telephone pole, leaning (`lean` radians toward dx, dz), its arms and its wires going up; and its foot running out across the grass. */
export function meltingPole(c, x, z, dx, dz, lean, hgt) {
  const dark = [0.2, 0.12, 0.07], sx = Math.sin(lean), cs = Math.cos(lean), top = [x + dx * sx * hgt, cs * hgt, z + dz * sx * hgt], nx = -dz, nz = dx, ceil = c.ceilAt(top[0], top[2]);
  beam(c.flat, [x, 0, z], top, 0.13, dark);
  for (let a = 0; a < 3; a++) { const t = 1 - 0.07 - a * 0.1, p = [x + dx * sx * hgt * t, cs * hgt * t, z + dz * sx * hgt * t], hw = 0.6 - a * 0.1; beam(c.flat, [p[0] - nx * hw, p[1], p[2] - nz * hw], [p[0] + nx * hw, p[1], p[2] + nz * hw], 0.07, dark);
    for (const k of [-1, 1]) { const e = [p[0] + nx * hw * k, p[1], p[2] + nz * hw * k], m = [e[0] + dx * 0.9 + nx * k * 0.5, Math.min(ceil - 0.3, e[1] + 0.2), e[2] + dz * 0.9 + nz * k * 0.5], u = [m[0] + dx * 0.8 + nx * k * (a - 1) * 0.6, ceil, m[2] + dz * 0.8 + nz * k * (a - 1) * 0.6]; beam(c.flat, e, m, 0.016, [0.04, 0.03, 0.02]); beam(c.flat, m, u, 0.016, [0.04, 0.03, 0.02]); } }
  const sw = c.mapped('suburb:swirl', swirlArt(c.kit), { cutout: true }), rot = Math.atan2(-dz, dx);
  for (let i = 0; i < 3; i++) c.lay(sw, x - dx * (0.9 + i * 1.5), z - dz * (0.9 + i * 1.5), 2.2, 1.3 + i * 0.5, rot + (i - 1) * 0.25, null, WHITE, 0.014 + i * 0.001);
  c.solid(x - 0.1, z - 0.1, x + 0.1, z + 0.1); c.reserve(x, z, 0.5);
}
/** What a lawn has on it after: small things, of every colour, everywhere, and a heap of them. */
export function debris(c, n = 60) {
  const { W, D, R } = c, cols = [[0.66, 0.16, 0.12], [0.16, 0.28, 0.5], [0.9, 0.85, 0.7], [0.85, 0.68, 0.2], [0.2, 0.2, 0.22], [0.55, 0.4, 0.25]];
  for (let i = 0; i < n; i++) { const x = R.range(-W / 2 + 0.6, W / 2 - 0.6), z = R.range(-D / 2 + 0.6, D / 2 - 0.6), a = R.range(0.04, 0.16), b = R.range(0.04, 0.22); c.flat.box(x - a, 0, z - b, x + a, R.range(0.015, 0.09), z + b, R.pick(cols), { skip: '-y' }); }
  for (let i = 0; i < 8; i++) c.paper(R.range(-W / 2 + 0.6, W / 2 - 0.6), R.range(-D / 2 + 0.6, D / 2 - 0.6));
}

/** A fire that is not the visitor's: two crossed sheets of it, alight for as long as anybody is near, and what it does to the ceiling. */
export function blaze(c, x, y, z, size = 1) {
  const tex = c.kit.tex.custom('suburb:flame', 32, 48, (g, w, h) => { for (const [col, k] of [['#d8421c', 1], ['#f08a1e', 0.72], ['#ffd65a', 0.42]]) { g.fillStyle = col; for (const [fx, fw, fh] of [[8, 7, 34], [16, 9, 46], [24, 7, 30], [12, 5, 22], [21, 5, 38]]) { g.beginPath(); g.moveTo(fx - fw * k, h); g.quadraticCurveTo(fx - fw * k, h - fh * k * 0.5, fx, h - fh * k); g.quadraticCurveTo(fx + fw * k, h - fh * k * 0.5, fx + fw * k, h); g.fill(); } } }, { clamp: true });
  const mat = c.kit.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })), geo = c.kit.own(new THREE.PlaneGeometry(1.1 * size, 1.5 * size)), parts = [];
  mat.color.setRGB(1.7, 1.5, 1.2);
  for (const rot of [0, Math.PI / 2, Math.PI / 4]) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y + 0.75 * size, z); m.rotation.y = rot; c.add(m); parts.push(m); }
  c.light(x, y + 0.8, z, '#ff8a2a', 1.1, { k: 1.4, far: 6 });
  const top = c.ceilAt(x, z); c.blot(x, z, 3.2, 3.2, { rgb: [0.02, 0.02, 0.02], a: 0.75, y: top - 0.004, down: true }); c.blot(x, z, 1.6, 1.6, { rgb: [0, 0, 0], a: 0.8, y: top - 0.005, down: true });
  c.tick((dt, t) => { parts.forEach((m, i) => { const k = 1 + 0.16 * Math.sin(t * 11 + i * 2.1) + 0.08 * Math.sin(t * 23 + i); m.scale.set(1 + 0.08 * Math.sin(t * 7 + i), k, 1); m.position.y = y + 0.75 * size * k; }); });
}
export const WRONG = {
  // one sprinkler head (the one thing here that is where it should be)
  sprinkler(c) { const at = c.spot(0.3, { pad: 1 }); if (!at) return false; sprinkler(c, at.x, at.z); },
  // every letter box the street had, delivered to one corner
  pile(c) {
    const k = c.corner(1.0); if (!k) return false;
    const R = c.R;
    for (const [n, r, y] of [[13, 0.85, 0], [8, 0.55, 0.19], [4, 0.28, 0.38], [1, 0, 0.57]]) for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + R.range(-0.3, 0.3), x = k.x + Math.cos(a) * r * R.range(0.6, 1), z = k.z + Math.sin(a) * r * R.range(0.6, 1), t = R.chance(0.5), hw = t ? 0.22 : 0.1, hd = t ? 0.1 : 0.22, g = R.range(0.3, 0.46);
      c.flat.box(x - hw, y, z - hd, x + hw, y + 0.19, z + hd, [g * 0.9, g, g * 1.15], y ? {} : { skip: '-y' });
      c.flat.box(x - 0.015, y + 0.19, z - 0.015, x + 0.015, y + 0.19 + R.range(0.04, 0.2), z + 0.015, [0.75, 0.12, 0.1]);
    }
    c.solid(k.x - 0.8, k.z - 0.8, k.x + 0.8, k.z + 0.8); c.shadow(k.x, k.z, 2, 2, 0.4);
  },
  // the fence, where the description said it went: up
  ceilfence(c) {
    const { W, D } = c, x = c.ceilAt(0, 0);
    if (x < 2.5) return false;
    if (W >= D) fence(c, -W / 2 + 0.02, D * 0.12, W / 2 - 0.02, D * 0.12, { hang: x }); else fence(c, W * 0.12, -D / 2 + 0.02, W * 0.12, D / 2 - 0.02, { hang: x });
  },
  // a second lawn, overhead, with its own sprinkler
  ceillawn(c) {
    const { W, D } = c, y = c.ceilAt(0, 0) - 0.012, w = Math.min(3.6, W - 1.8), d = Math.min(2.4, D - 1.8);
    if (c.ceilAt(w / 2, d / 2) !== c.ceilAt(-w / 2, -d / 2)) return false;
    c.floor.grid([-w / 2, y, -d / 2], [1, 0, 0], [0, 0, 1], ticks(w, 0.6, 0), ticks(d, 0.6, 0), (u, v) => [u / 1.6, v / 1.6]);
    c.flat.box(-0.03, y - 0.07, -0.03, 0.03, y, 0.03, [0.06, 0.06, 0.06]); c.flat.box(-0.02, y - 0.085, -0.02, 0.02, y - 0.07, 0.02, [0.7, 0.55, 0.2]);
  },
  // a car, alight, and it has been for some time: nothing is burnt but the ceiling
  burning(c) { if (WRONG.car(c) === false) return false; blaze(c, 0.3, 0.6, 0, 1.3); blaze(c, -0.5, 0.5, 0.3, 0.9); },
  // a car, parked where there was room
  ceilcar(c) {
    const { W, D } = c, y = c.ceilAt(0, 0), along = W >= D;
    if (y < 2.6 || c.ceilAt(1.5, 1.5) !== y || Math.max(W, D) < 5.4) return false;
    const b = new Batch(); b.bare = true; car(c, 0, 0, along, [0.3, 0.42, 0.62], 0.32, b);
    const g = c.dynamic(b, { pivot: [0, 0, 0] }); g.rotation.z = Math.PI; g.position.y = y - 0.01;
    c.blot(0, 0, along ? 4.6 : 2.2, along ? 2.2 : 4.6, { a: 0.4 });
  },
  // telephone poles, in board, with the wires going where wires go
  poles(c) {
    const { W, D } = c, along = W >= D, n = Math.floor((Math.max(W, D) - 2) / 2.4), top = c.ceilAt(0, 0), off = (along ? D : W) * 0.22;
    if (n < 2 || top < 2.6) return false;
    let last = null;
    for (let i = 0; i < n; i++) {
      const u = (i - (n - 1) / 2) * 2.4, [x, z] = along ? [u, off] : [off, u];
      if (!c.clear(x, z, 0.3)) { last = null; continue; }
      c.flat.box(x - 0.07, 0, z - 0.02, x + 0.07, 2.35, z + 0.02, BOARD, { skip: '-y' }); if (along) c.flat.box(x - 0.45, 2.05, z - 0.02, x + 0.45, 2.15, z + 0.02, BOARD); else c.flat.box(x - 0.02, 2.05, z - 0.45, x + 0.02, 2.15, z + 0.45, BOARD);
      beam(c.flat, [x, 2.15, z], [x, top, z], 0.012, [0.05, 0.05, 0.05]); c.hole(x - 0.3, z - 0.3);
      if (last) beam(c.flat, [last[0], 2.12, last[1]], [x, 2.12, z], 0.012, [0.05, 0.05, 0.05]);
      c.solid(x - 0.08, z - 0.05, x + 0.08, z + 0.05); c.shadow(x, z, 0.3, 0.2, 0.3); last = [x, z];
    }
  },
  // front doors. A house has one; so here are some
  doors(c) {
    const R = c.R; let n = 0;
    for (let i = 0; i < 5; i++) {
      const s = c.spot(0.7, { head: 2.2 }); if (!s) continue;
      const col = [[0.5, 0.12, 0.1], [0.15, 0.3, 0.2], [0.14, 0.2, 0.4], [0.75, 0.7, 0.2]][i % 4], ajar = R.chance(0.35) ? R.range(0.3, 1.2) : 0;
      for (const k of [-1, 1]) c.flat.box(s.x + k * 0.5 - 0.04, 0, s.z - 0.05, s.x + k * 0.5 + 0.04, 2.1, s.z + 0.05, WHITEWASH, { skip: '-y' });
      c.flat.box(s.x - 0.54, 2.06, s.z - 0.05, s.x + 0.54, 2.14, s.z + 0.05, WHITEWASH);
      const hx = s.x - 0.46, ex = hx + Math.cos(ajar) * 0.92, ez = s.z - Math.sin(ajar) * 0.92;
      upright(c.flat, hx, s.z, ex, ez, 0.02, 2.06, null, col); upright(c.flat, ex, ez, hx, s.z, 0.02, 2.06, null, col.map((v) => v * 0.8));
      c.flat.ball(ex - Math.cos(ajar) * 0.1, 1.0, ez + Math.sin(ajar) * 0.1 + 0.04, 0.035, [0.75, 0.6, 0.25]);
      if (!ajar) c.solid(s.x - 0.54, s.z - 0.05, s.x + 0.54, s.z + 0.05, { tall: true }); else { c.solid(s.x - 0.56, s.z - 0.05, s.x - 0.46, s.z + 0.05); c.solid(s.x + 0.46, s.z - 0.05, s.x + 0.56, s.z + 0.05); }
      n++;
    }
    return n > 1 ? undefined : false;
  },
  // the sun, where it was said to be: overhead
  sun(c) {
    const y = c.ceilAt(0, 0) - 0.012, tex = c.kit.tex.custom('suburb:sun', 48, 48, (g) => { g.strokeStyle = '#f2b830'; g.lineWidth = 2.5; for (let i = 0; i < 12; i++) { const a = i * 0.5236; g.beginPath(); g.moveTo(24 + Math.cos(a) * 13, 24 + Math.sin(a) * 13); g.lineTo(24 + Math.cos(a) * (i % 2 ? 22 : 18), 24 + Math.sin(a) * (i % 2 ? 22 : 18)); g.stroke(); } blob(g, '#f6cf3a', [[24, 24, 11, 11]]); P(g, '#2a2420', 19, 21, 2, 3); P(g, '#2a2420', 27, 21, 2, 3); P(g, '#2a2420', 20, 28, 8, 1); }, { clamp: true });
    c.lay(c.mapped('suburb:sun', tex, { cutout: true }), 0, 0, 1.8, 1.8, c.R.range(0, 3), null, WHITE, y, true);
  },
  // WELCOME, as often as it was heard
  mats(c) {
    const { W, D, R } = c, tex = c.kit.tex.custom('suburb:mats', 128, 96, (g) => { for (let i = 0; i < 4; i++) { const x = (i % 2) * 64, y = Math.floor(i / 2) * 48; P(g, '#6b4a2a', x, y, 64, 48); P(g, '#5a3d22', x + 3, y + 3, 58, 42); garble(g, ['WELCOME', 'WELCOME', 'WELLCOME', 'WELCOM'][i], x + 3, y + 8, 58, 30, { color: '#d9c08a', size: 12, mess: 0.25 + i * 0.2 }, i + 2); } }, { clamp: true }), b = c.mapped('suburb:mats', tex);
    let n = 0;
    for (let x = -W / 2 + 1.3; x <= W / 2 - 1.3; x += 0.92) for (let z = -D / 2 + 1.2; z <= D / 2 - 1.2; z += 0.66) { if (!c.clear(x, z, 0.2)) continue; const i = Math.floor(R() * 4), u0 = (i % 2) / 2, v1 = 1 - Math.floor(i / 2) / 2; c.lay(b, x, z, 0.8, 0.56, R.range(-0.06, 0.06), [[u0, v1 - 0.5], [u0 + 0.5, v1 - 0.5], [u0 + 0.5, v1], [u0, v1]], WHITE, 0.014 + (n % 3) * 0.001); n++; }
    return n > 5 ? undefined : false;
  },
  // flamingos: one was mentioned. Nobody said how many
  flock(c) {
    const { W, D } = c, d = c.room.doors[0], p = d ? c.doorPoint(d, 0) : { x: 0, z: D / 2 };
    let n = 0;
    for (let x = -W / 2 + 1.2; x <= W / 2 - 1.2; x += 0.95) for (let z = -D / 2 + 1.2; z <= D / 2 - 1.2; z += 0.95) { if (!c.clear(x, z, 0.3, 1.2)) continue; flamingoAt(c, x, z, Math.atan2(x - p.x, p.z - z)); n++; }
    return n > 3 ? undefined : false;
  },
  // a garage door, on a wall with no garage behind it (suburb.js roller)
  garage(c) { const spot = c.wallSpot(3.2, undefined, 0.5, 2.4); if (!spot) return false; roller(c, spot.side, spot.at, { garage: c.R.chance(0.5) }); },
  // a car, most of the way down
  car(c) {
    const { W, D } = c, along = W >= D;
    if (Math.max(W, D) < 6.6 || Math.min(W, D) < 4.6) return false;
    const x = along ? 0 : c.R.pick([-0.5, 0.5]), z = along ? c.R.pick([-0.5, 0.5]) : 0;
    if (!c.clear(x, z, 0.9) || !c.clear(x + (along ? 1.5 : 0), z + (along ? 0 : 1.5), 0.9) || !c.clear(x - (along ? 1.5 : 0), z - (along ? 0 : 1.5), 0.9)) return false;
    car(c, x, z, along);
  },
};
export function sprinkler(c, x, z) {
  c.flat.box(x - 0.03, 0, z - 0.03, x + 0.03, 0.07, z + 0.03, [0.06, 0.06, 0.06], { skip: '-y' });
  c.flat.box(x - 0.02, 0.07, z - 0.02, x + 0.02, 0.085, z + 0.02, [0.7, 0.55, 0.2]);
  c.blot(x, z, 0.5, 0.5, { a: 0.3 });
}

/* ---- a room too big for a lamp to every panel ----------------------------------------------------------------- */

/**
 * The ceiling's tubes, for a room whose shell was built with `panels: false` (its deck line still says `lights: 'normal'`):
 * `cols` × `rows` lit panels, and a lamp to every `every`-th of them (the light budget is sixteen a room).
 */
export function daylight(c, cols, rows, every = 1, power = 1) {
  const { W, D, H, kit } = c, tube = lin(c.look.tube), on = c.shining('panel', kit.tex.panel(true), 2.5, tube), uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const head = Math.max(0.3, Math.min(2.5, H / 2.6));
  let k = 0;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++, k++) {
    const x = (Math.round((-W / 2 + (i + 0.5) * W / cols) / TILE - 0.5) + 0.5) * TILE, z = Math.round((-D / 2 + (j + 0.5) * D / rows) / TILE) * TILE, y = H - 0.006;
    on.quad([x - TILE / 2, y, z - TILE], [x + TILE / 2, y, z - TILE], [x + TILE / 2, y, z + TILE], [x - TILE / 2, y, z + TILE], WHITE, uv);
    if ((i + j * 2) % every === 0) c.light(x, H - 0.14, z, tube, 1.05 * power * Math.pow(head, 1.5), { axis: [0, -1, 0], floor: 0.24, k: 3.4 * head, far: 14 * head });
  }
}

/* ---- what somebody left on a lawn (themes.js `dressing`) ------------------------------------------------------- */

export const THINGS = {
  // a letter box on a post, its flag up: nothing has been collected
  mailbox(c, item) {
    const s = c.spot(0.4, { head: 1.6 }); if (!s) return;
    postbox(c, s.x, s.z, item.turn);
  },
  // a flamingo, cut out of board, on a wire
  flamingo(c, item) {
    const s = c.spot(0.45, { head: 1.3 }); if (!s) return;
    flamingoAt(c, s.x, s.z, item.turn);
  },
  // a garden hose, coiled, connected to nothing
  hose(c, item) {
    const s = c.spot(0.5); if (!s) return;
    const art = setArt(c.kit), u = art.uv('hose');
    c.lay(cutBatch(c), s.x, s.z, 0.8, 0.8, item.turn, [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]], [u[0], u[3]]], WHITE, 0.03);
    c.blot(s.x, s.z, 0.9, 0.9, { a: 0.35 });
  },
};
/** A letter box on a post. opt.plate: a batch and uv for what is written on its side. */
export function postbox(c, x, z, rot = 0, opt = {}) {
  const along = Math.abs(Math.sin(rot)) > 0.7, hw = along ? 0.11 : 0.24, hd = along ? 0.24 : 0.11, body = opt.rgb || [0.32, 0.36, 0.42];
  c.flat.box(x - 0.04, 0, z - 0.04, x + 0.04, 1.02, z + 0.04, TIMBER, { skip: '-y' });
  c.flat.box(x - hw, 1.02, z - hd, x + hw, 1.2, z + hd, body); c.flat.box(x - hw * 0.86, 1.2, z - hd * 0.86, x + hw * 0.86, 1.25, z + hd * 0.86, body);
  // the flag, up
  if (along) c.flat.box(x + hw, 1.1, z - 0.02, x + hw + 0.012, 1.36, z + 0.02, [0.75, 0.12, 0.1]); else c.flat.box(x - 0.02, 1.1, z + hd, x + 0.02, 1.36, z + hd + 0.012, [0.75, 0.12, 0.1]);
  c.solid(x - 0.12, z - 0.12, x + 0.12, z + 0.12); c.shadow(x, z, 0.3, 0.3, 0.4); c.reserve(x, z, 0.4);
  return { top: 1.25, hw, hd, along };
}
