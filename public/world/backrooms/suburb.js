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
import { Vox, M, glow, tone } from '../vox/vox.js';
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
  corn: [256, 96, 48, 80], mallA: [304, 96, 96, 48], mallB: [400, 96, 96, 48], carSide: [304, 148, 108, 44], vanSide: [412, 148, 100, 44], pickupSide: [412, 196, 100, 44], hedge: [128, 128, 64, 96],
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
// a duck for a spring rider, as described twice: a head at each end of it, each looking where it is going
function duck(g, w, h, back) {
  blob(g, '#f2c230', [[16, 18, 10, 7.5], [6.5, 8.5, 6, 5.6], [25.5, 8.5, 6, 5.6]]); blob(g, '#dba51c', [[16, 19, 5.5, 3.6]]);
  P(g, '#f2c230', 6, 10, 5, 8); P(g, '#f2c230', 21, 10, 5, 8);
  P(g, '#e8862e', 0, 8, 3, 3); P(g, '#e8862e', 29, 8, 3, 3); P(g, '#2a2420', 5, 6, 2, 2); P(g, '#2a2420', 25, 6, 2, 2);
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
    P(g, '#bdbab0', 2, 26, 104, 2); blob(g, '#1d1d1f', [[24, 35, 9, 9], [84, 35, 9, 9]]); blob(g, '#9a9a96', [[24, 35, 4, 4], [84, 35, 4, 4]]); P(g, '#f3e7a6', 103, 22, 3, 4); P(g, '#bdbab0', 53, 9, 1, 25); P(g, '#7a7a76', 44, 22, 4, 1); P(g, '#7a7a76', 62, 22, 4, 1); },
  vanSide: (g) => { g.fillStyle = '#e9e7e0'; g.beginPath(); g.moveTo(2, 36); g.lineTo(2, 6); g.lineTo(74, 6); g.lineTo(88, 20); g.lineTo(98, 23); g.lineTo(98, 36); g.fill(); g.fillStyle = '#39414a'; g.beginPath(); g.moveTo(62, 20); g.lineTo(62, 9); g.lineTo(73, 9); g.lineTo(84, 20); g.fill();
    P(g, '#bdbab0', 2, 27, 96, 2); P(g, '#bdbab0', 58, 6, 1, 30); P(g, '#bdbab0', 30, 6, 1, 30); blob(g, '#1d1d1f', [[22, 36, 8, 8], [78, 36, 8, 8]]); blob(g, '#9a9a96', [[22, 36, 3.5, 3.5], [78, 36, 3.5, 3.5]]); P(g, '#f3e7a6', 95, 23, 3, 4);
    garble(g, 'DELIVRY', 6, 11, 22, 8, { color: '#7a7a76', size: 6, mess: 0.6 }, 5); garble(g, 'FOR YOU', 34, 11, 22, 8, { color: '#7a7a76', size: 6, mess: 0.6 }, 9); },
  pickupSide: (g) => { g.fillStyle = '#e9e7e0'; g.beginPath(); g.moveTo(2, 36); g.lineTo(2, 20); g.lineTo(44, 20); g.lineTo(46, 7); g.lineTo(70, 7); g.lineTo(80, 20); g.lineTo(98, 23); g.lineTo(98, 36); g.fill(); g.fillStyle = '#39414a'; g.beginPath(); g.moveTo(49, 20); g.lineTo(50, 10); g.lineTo(68, 10); g.lineTo(76, 20); g.fill();
    P(g, '#bdbab0', 2, 27, 96, 2); P(g, '#bdbab0', 44, 20, 1, 16); blob(g, '#1d1d1f', [[20, 36, 9, 9], [80, 36, 9, 9]]); blob(g, '#9a9a96', [[20, 36, 4, 4], [80, 36, 4, 4]]); P(g, '#f3e7a6', 95, 23, 3, 4); for (const [x, y] of [[8, 13], [18, 11], [30, 14]]) { P(g, '#c8a473', x, y, 9, 8); P(g, '#a9824f', x, y + 3, 9, 1); } },
  // a hedge, clipped square, far too tall: leaf on leaf, a few gone brown, and something pale a long way in
  hedge: (g, w, h) => { P(g, '#2f5f2c', 0, 0, w, h); let k = 77; const r = () => { k = (Math.imul(k, 1664525) + 1013904223) >>> 0; return k / 4294967296; };
    for (let i = 0; i < 520; i++) { const x = r() * w, y = r() * h; g.fillStyle = ['#3f7a3a', '#4f8f45', '#27522a', '#356b32', '#5a9a4c'][Math.floor(r() * 5)]; g.beginPath(); g.ellipse(x, y, 1.6 + r() * 1.6, 0.9 + r(), r() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 9; i++) P(g, '#8a7a3a', r() * w, r() * h, 2, 1); P(g, '#1c3a1c', 0, h - 6, w, 6); for (let x = 3; x < w; x += 9) P(g, '#5a4026', x, h - 6, 2, 6); P(g, '#e9e3cf', 40, 41, 2, 2); P(g, '#e9e3cf', 45, 41, 2, 2); },
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
/** A length of round timber from a to b, r0 thick at a and r1 at b: seven-sided, which at this size is round. */
export function log(batch, a, b, r0, r1 = r0, alb = TIMBER) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1, e = d.map((v) => v / L), ref = Math.abs(e[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  let p = [e[1] * ref[2] - e[2] * ref[1], e[2] * ref[0] - e[0] * ref[2], e[0] * ref[1] - e[1] * ref[0]]; const pl = Math.hypot(...p); p = p.map((v) => v / pl);
  const q = [e[1] * p[2] - e[2] * p[1], e[2] * p[0] - e[0] * p[2], e[0] * p[1] - e[1] * p[0]], N = 7;
  const at = (o, r, k) => { const cs = Math.cos(k * 6.2832 / N) * r, sn = Math.sin(k * 6.2832 / N) * r; return [o[0] + p[0] * cs + q[0] * sn, o[1] + p[1] * cs + q[1] * sn, o[2] + p[2] * cs + q[2] * sn]; };
  for (let k = 0; k < N; k++) {
    const a0 = at(a, r0, k), a1 = at(a, r0, k + 1), b0 = at(b, r1, k), b1 = at(b, r1, k + 1), mid = at([0, 0, 0], 1, k + 0.5);
    const n = [(a1[1] - a0[1]) * (b0[2] - a0[2]) - (a1[2] - a0[2]) * (b0[1] - a0[1]), (a1[2] - a0[2]) * (b0[0] - a0[0]) - (a1[0] - a0[0]) * (b0[2] - a0[2]), (a1[0] - a0[0]) * (b0[1] - a0[1]) - (a1[1] - a0[1]) * (b0[0] - a0[0])];
    const shade = alb.map((v) => v * (0.86 + 0.14 * ((k * 5) % 3) / 2));                                    // a little grain: no two faces quite the same
    if (n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] > 0) sheet(batch, a0, a1, b1, b0, 1, 1, null, shade); else sheet(batch, a1, a0, b0, b1, 1, 1, null, shade);
  }
  return batch;
}
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
  // (a passage is an alley: more often than not it runs between hedges)
  const alley = Math.min(W, D) < 4 && room.kind === 'plain';
  const paint = opt.paint || (alley && R.chance(0.6) ? 'hedge' : R.pick(['sky', 'sky', 'sky', 'corn', 'corn', 'mall', 'mall'])), art = setArt(c.kit), low = paint === 'corn' ? 2.75 : paint === 'mall' ? 1.95 : 1.55;
  c.rt.paint = paint;
  if (paint === 'hedge') {
    for (const side of ['back', 'left', 'right', 'front']) for (const [a, b] of c.spans(side, 0.05, 1.2)) {
      const [w, h] = art.size('hedge'), n = Math.max(1, Math.round((b - a) / w)), each = (b - a) / n;
      for (let i = 0; i < n; i++) { const at = a + (i + 0.5) * each, p = c.wallAt(side, at, 0.3), hh = Math.min(h, c.ceilAt(p.x, p.z) - 0.14), q = c.wallAt(side, at, 0.02), U = q.U, uv = art.uv('hedge', (i + side.length) % 2 === 1);
        sheet(cutBatch(c), [q.x - U[0] * each / 2, 0.11, q.z - U[2] * each / 2], [q.x + U[0] * each / 2, 0.11, q.z + U[2] * each / 2], [q.x + U[0] * each / 2, 0.11 + hh, q.z + U[2] * each / 2], [q.x - U[0] * each / 2, 0.11 + hh, q.z - U[2] * each / 2], 2, 3, [uv[0], uv[1], uv[2], uv[1] + (uv[3] - uv[1]) * (hh / h)]); }
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
  const asked = opt.which;
  if ((chance > 0 && R.chance(chance)) || (asked && room.kind === 'plain' && !s)) { const name = asked || R.pick([...Object.keys(WRONG), 'melting', 'melting']); if (WRONG[name](c) !== false) c.rt.weird = name; }
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
  { const f0 = c.wallAt(side, at, 0.004); c.model('suburb:rollerframe', rollerFrameVox, f0.x, f0.z, { rot: f0.rot, solid: false, shadow: false }); }
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
/**
 * A car, sculpted: an estate of about 1975, wood down its sides, a rack on the roof, chrome at either end, its lamps on. Nose toward +x.
 * (rgb: its paint, as '#rrggbb'. door: the driver's door stands open.)
 */
export function carVox(paint, door) {
  return () => {
    const v = new Vox(), body = M(paint, 1), dark = M(tone(paint, -0.25), 1), chrome = M('#c9ccd0', 0), glassy = M('#1f2a33', 0), wood = M('#7a4f2a', 3), woodL = M('#a57a48', 3), tyre = M('#17171a', 2);
    v.rbox(-84, 12, -34, 84, 32, 34, 5, body); v.rbox(-80, 8, -32, 80, 14, 32, 2, dark);
    v.rbox(-58, 30, -31, 34, 56, 31, 6, body);                                                             // the cabin, long: it is an estate
    for (let i = 0; i < 26; i++) v.box(34 + i * 0.5, 32, -30, 35 + i * 0.5, 55 - i, 30, body);             // the windscreen's rake
    // glass all round, with pillars
    v.paint(-54, 38, -32, 30, 52, -30, glassy); v.paint(-54, 38, 30, 30, 52, 32, glassy); v.paint(-60, 38, -27, -56, 52, 27, glassy); v.paint(34, 34, -27, 48, 54, 27, glassy);
    for (const x of [-26, 2]) { v.paint(x, 36, -32, x + 3, 54, -30, body); v.paint(x, 36, 30, x + 3, 54, 32, body); }
    // the wood, framed in paler wood
    for (const z of [-35, 34]) { v.box(-72, 15, z, 70, 29, z + 1, wood); v.box(-72, 15, z, 70, 16, z + 1, woodL); v.box(-72, 28, z, 70, 29, z + 1, woodL); for (const x of [-72, -26, 2, 30, 69]) v.box(x, 15, z, x + 1, 29, z + 1, woodL); for (const x of [-12, 14]) v.box(x, 30, z, x + 5, 31.4, z + 1, chrome); }
    // wheels, in arches, with caps
    for (const x of [-52, 50]) for (const s of [-1, 1]) { v.carve(x - 15, 0, s > 0 ? 26 : -35, x + 15, 22, s > 0 ? 35 : -26); v.cyl('z', x, 12, s > 0 ? 25 : -33, s > 0 ? 33 : -25, 12.5, tyre); v.cyl('z', x, 12, s > 0 ? 32.4 : -33.6, s > 0 ? 33.6 : -32.4, 6.5, chrome); v.cyl('z', x, 12, s > 0 ? 33 : -34, s > 0 ? 34 : -33, 2.2, dark); }
    // chrome: bumpers with overriders, a grille, mirrors, a rack
    for (const x of [-88, 84]) { v.rbox(x, 12, -35, x + 4, 18, 35, 1.5, chrome); for (const z of [-18, 16]) v.box(x + (x > 0 ? 3 : -1), 11, z, x + (x > 0 ? 5 : 1), 21, z + 2, chrome); }
    v.box(84, 19, -20, 85, 28, 20, M('#2b2f33', 0)); for (let z = -19; z < 20; z += 3) v.box(85, 19, z, 86, 28, z + 1, chrome); v.box(85, 23, -20, 86, 24, 20, chrome);
    for (const z of [-29, 23]) { v.rbox(84, 20, z, 86, 28, z + 6, 1.5, glow('#fff0b8')); v.box(84, 19, z - 1, 85, 29, z + 7, chrome); v.box(-85, 19, z, -84, 28, z + 6, glow('#c21f1a')); }
    v.box(-86, 13, -8, -85, 18, 8, M('#e8d9a0', 0)); v.box(86, 13, -8, 87, 18, 8, M('#e8d9a0', 0)); for (const z of [-5, -1, 3]) { v.set(-87, 15, z, dark); v.set(87, 15, z, dark); }
    for (const s of [-1, 1]) { v.tube(30, 36, s * 32, 32, 38, s * 37, 0.8, chrome); v.rbox(31, 37, s > 0 ? 36 : -39, 34, 41, s > 0 ? 39 : -36, 1, chrome); }
    for (const z of [-26, 24]) { v.box(-50, 57, z, 26, 58.4, z + 2, chrome); for (const x of [-48, -12, 22]) v.box(x, 55, z, x + 2, 57, z + 2, chrome); } for (const x of [-40, -12, 16]) v.box(x, 57.4, -26, x + 1.4, 58.4, 26, chrome);
    v.tube(-70, 32, 20, -78, 56, 24, 0.5, chrome);                                                          // an aerial
    if (door) { v.carve(4, 16, 30, 30, 54, 35); v.box(28, 16, 34, 30, 54, 60, body); v.paint(28, 38, 36, 30, 52, 58, glassy); v.box(27, 15, 34, 28, 29, 60, wood); v.box(4, 14, 22, 28, 30, 30, M('#5a3a26', 2)); v.rbox(8, 26, 10, 22, 34, 26, 2, M('#6b4a30', 2)); v.ring(20, 40, 14, 5, 0.9, M('#1b1614', 0), 'x'); }
    return v;
  };
}
const hexOf = (rgb) => (typeof rgb === 'string' ? rgb : '#' + rgb.map((k) => Math.round(Math.pow(Math.max(0, Math.min(1, k)), 1 / 2.2) * 255).toString(16).padStart(2, '0')).join(''));
/**
 * Put a car down at (x, z), nose along +x (or +z). lift: how far its wheels are above the floor's level (0: as it stands; negative:
 * that far down in the grass). into: a voxel batch of the caller's own, for a car that is going to move (a batch that says `bare`
 * gets the shape and nothing else: no body to walk into, no lamps' light). opt.door: the driver's door open.
 */
export function car(c, x, z, along = true, rgb = [0.6, 0.52, 0.38], lift = 0, into = null, opt = {}) {
  const geo = c.kit.model('suburb:car:' + hexOf(rgb) + (opt.door ? ':open' : ''), carVox(hexOf(rgb), !!opt.door)), rot = along ? 0 : -Math.PI / 2;
  if (into) into.addVox(geo.solid, new THREE.Matrix4().compose(new THREE.Vector3(x, lift, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(c.kit.VOXEL, c.kit.VOXEL, c.kit.VOXEL)));
  else c.place(geo, x, z, { y: lift, rot, solid: false, shadow: false });
  if (into && into.bare) return;                              // (only the shape of one: whoever asked puts it where it is going)
  c.light(x + (along ? 2.5 : 0), 0.6 + lift, z + (along ? 0 : 2.5), '#ffe9a8', 0.5, { k: 1.1, far: 4 });
  if (along) c.solid(x - 2.1, z - 0.85, x + 2.1, z + 0.85); else c.solid(x - 0.85, z - 2.1, x + 0.85, z + 2.1);
  c.blot(x, z, along ? 5.2 : 2.6, along ? 2.6 : 5.2, { a: lift < 0 ? 0.5 : 0.35 }); c.reserve(x, z, 2.3);
}
/* ---- the melt: timber that has gone soft (the owner's idea: wooden telephone poles, melting) ------------------------------- */

/**
 * A wooden telephone pole that is melting, toward (dx, dz): it stands for a metre or two, then goes over like a candle left
 * in the sun, wood running off its underside and standing in a pool at its foot. Only the pole: its two crossbars are as stiff
 * and square as the day they went up. Two wires still go up into the ceiling and hold the top; two have come down.
 */
export function meltingPole(c, x, z, dx, dz, hgt, R = c.R) {
  const wood = [0.36, 0.22, 0.12], dark = [0.24, 0.14, 0.07], wire = [0.04, 0.03, 0.02], N = 9, seg = hgt / N, pts = [[x, 0, z]], nx = -dz, nz = dx;
  for (let i = 1; i <= N; i++) { const a = Math.pow(i / N, 2.4) * 1.75 + Math.sin(i * 1.7) * 0.07, q = pts[i - 1]; pts.push([q[0] + dx * Math.sin(a) * seg, Math.max(0.5, q[1] + Math.cos(a) * seg), q[2] + dz * Math.sin(a) * seg]); }
  // the pole is what is melting: it thins and thickens as it goes over, and runs off its own underside
  for (let i = 0; i < N; i++) { const r = (k) => 0.1 - k * 0.004 + (k % 2) * 0.018; log(c.flat, pts[i], pts[i + 1], r(i), r(i + 1), i % 3 ? wood : dark); if (i) c.flat.ball(pts[i][0], pts[i][1], pts[i][2], r(i) * 1.02, wood, 1, 7); }
  const drip = (p, len) => { log(c.flat, p, [p[0], p[1] - len, p[2]], 0.035, 0.018, wood); c.flat.ball(p[0], p[1] - len, p[2], 0.05, wood, 1.4, 7); };
  for (const i of [N - 4, N - 2]) drip([pts[i][0], pts[i][1] - 0.06, pts[i][2]], R.range(0.25, 0.6));
  // its two crossbars are not: square timber, dead straight, a row of insulators on each, exactly as they were put up
  const ends = [];
  for (const [i, hw] of [[N - 1, 0.75], [N - 2, 0.6]]) {
    const p = pts[i]; beam(c.flat, [p[0] - nx * hw, p[1] + 0.09, p[2] - nz * hw], [p[0] + nx * hw, p[1] + 0.09, p[2] + nz * hw], 0.09, dark);
    for (const k of [-0.9, -0.45, 0.45, 0.9]) { const q = [p[0] + nx * hw * k, p[1] + 0.135, p[2] + nz * hw * k]; c.flat.box(q[0] - 0.03, q[1], q[2] - 0.03, q[0] + 0.03, q[1] + 0.09, q[2] + 0.03, [0.55, 0.62, 0.6]); if (Math.abs(k) > 0.5) ends.push([q[0], q[1] + 0.09, q[2], k]); }
  }
  // the wires: two still go up into the ceiling, and are what is holding the top; two have come down
  for (const [ex, ey, ez, k] of ends) {
    if (k > 0) { const up = c.ceilAt(ex, ez); beam(c.flat, [ex, ey, ez], [ex - dx * 0.4, up, ez - dz * 0.4], 0.014, wire); c.hole(ex - dx * 0.4 - 0.3, ez - dz * 0.4 - 0.3); }
    else { const g = [ex + dx * 0.7 + nx * k * 0.4, 0.02, ez + dz * 0.7 + nz * k * 0.4]; beam(c.flat, [ex, ey, ez], g, 0.014, wire); beam(c.flat, g, [g[0] + dx * 1.1, 0.02, g[2] + dz * 1.1 + nz * 0.3], 0.014, wire); }
  }
  // the pool, and what has dripped into it since
  c.flat.ball(x, 0.01, z, 0.62, wood, 0.09, 10); c.flat.ball(x + dx * 0.5, 0.01, z + dz * 0.5, 0.4, dark, 0.08, 8); c.blot(x, z, 1.9, 1.9, { a: 0.4 });
  for (const i of [N - 4, N - 2]) { const p = pts[i]; c.flat.ball(p[0], 0.01, p[2], 0.2, wood, 0.1, 6); }
  c.solid(x - 0.12, z - 0.12, x + 0.12, z + 0.12); c.reserve(x, z, 0.8);
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
/** A paving stone, one of three: worn at the corners, a crack, moss in the crack. About its middle. */
export const stoneVox = (k = 0) => () => {
  const v = new Vox(), g = [M('#a3a198', 2), M('#96948b', 2), M('#b0aea4', 2)], w = 10 + (k % 2), d = 9 - (k % 2);
  v.rbox(-w, 0, -d, w, 1.6, d, 1.4, g[k % 3], 'xz'); v.box(-w + 1, 1.6, -d + 1, w - 1, 2, d - 1, g[(k + 1) % 3]);
  v.carve(w - 2, 0, d - 2 - k, w, 3, d); if (k !== 1) v.carve(-w, 0, -d, -w + 2, 3, -d + 1 + k);
  for (let i = 0; i < w * 2 - 4; i++) { const x = -w + 2 + i, z = Math.round(Math.sin(i * 0.7 + k) * 2 + (k - 1) * 2); v.set(x, 1, z, M('#55534c', 2)); v.carve(x, 2, z, x + 1, 3, z + 1); if (i % 4 === k) v.set(x, 1, z, M('#4f7a3a', 3)); }
  return v;
};
/** Put a paving stone down. */
export function stone(c, x, z, k = 0, rot = 0) { c.model('suburb:stone:' + (k % 3), stoneVox(k % 3), x, z, { rot, solid: false, shadow: false }); }
/** A board on a post, for a notice to go on: a turned post with a ball on it, an arm, the board hung from the arm on two hooks. The board's face is 1 m by 0.65, its middle 1.37 up. */
export const noticeVox = () => { const v = new Vox(), w = M('#efe9d8', 1), d = M('#cfc8b4', 1); v.cyl('y', -24, 0, 0, 74, 1.7, w); v.ellipsoid(-24, 76, 0, 2.4, 2.4, 2.4, w); v.cyl('y', -24, 0, 0, 3, 3, d); v.box(-24, 69, -1, 22, 71, 1, w); v.tube(-24, 58, 0, -14, 69, 0, 0.8, d);
  for (const x of [-16, 18]) { v.tube(x, 69, 0, x, 67.4, 0, 0.5, M('#5d646c', 0)); } v.rbox(-21, 41, -1, 21, 67.6, 1, 1, w, 'xy'); v.box(-21, 41, -1.2, 21, 42, 1.2, d); v.box(-21, 66.6, -1.2, 21, 67.6, 1.2, d); return v; };
/** A machine to pay at: a post, a hooded body, a screen that is on, a slot, twelve buttons, a tray, a panel on top to keep it going. Its face is toward -z. */
export const payVox = () => {
  const v = new Vox(), body = M('#3a4048', 0), trim = M('#c9ccd0', 0);
  v.cyl('y', 0, 0, 0, 22, 3, M('#2a2f36', 0)); v.cyl('y', 0, 0, 0, 2, 6, M('#2a2f36', 0)); v.rbox(-10, 22, -7, 10, 60, 7, 2, body); v.box(-11, 58, -9, 11, 60, 8, M('#2a2f36', 0));
  v.box(-7, 46, -7.6, 7, 55, -7, glow('#8fe0a8')); for (let y = 47; y < 55; y += 2) v.box(-6, y, -7.8, 2 + (y % 3), y + 0.6, -7.6, M('#1f6b3a', 0));
  for (let i = 0; i < 12; i++) v.box(-6 + (i % 3) * 3, 43 - Math.floor(i / 3) * 2.6, -7.6, -4 + (i % 3) * 3, 44.6 - Math.floor(i / 3) * 2.6, -7, i === 11 ? M('#b3261e', 0) : trim);
  v.box(4, 36, -7.6, 8, 44, -7, trim); v.box(5.4, 37, -7.8, 6.6, 43, -7.6, M('#17171a', 0)); v.box(-7, 25, -8.6, 7, 30, -7, trim); v.carve(-6, 26, -8.6, 6, 30, -7.4);
  v.tube(0, 60, 0, 0, 66, 2, 0.8, trim); for (let x = -9; x < 9; x += 3) v.box(x, 66 + (x + 9) * 0, -6, x + 2.6, 67, 8, M('#1f2a4a', 0)); v.box(-10, 65.4, -7, 10, 66, 9, trim);
  return v;
};
/** What a roller door runs in: a channel either side, and over it the box the door rolls up into. 2.4 m of door, 2.1 high; its back to the wall (-z). */
export const rollerFrameVox = () => { const v = new Vox(), k = M('#d9dbd6', 0), d = M('#a9aba6', 0); for (const sx of [-1, 1]) { v.box(sx > 0 ? 48 : -51, 0, 0, sx > 0 ? 51 : -48, 84, 3, k); v.box(sx > 0 ? 47 : -48, 0, 2, sx > 0 ? 48 : -47, 84, 3.6, d); }
  v.rbox(-52, 84, 0, 52, 95, 7, 2, k, 'yz'); v.box(-52, 84, 6.4, 52, 85, 7.4, d); for (const x of [-40, 0, 38]) v.box(x, 88, 7, x + 2, 90, 7.6, d); v.box(52, 40, 0.4, 54, 47, 3, M('#3a4048', 0)); v.set(53, 44, 3, glow('#d9433a')); return v; };

/** A front door: six panels, a knob, a letter slot, a number. From its hinge edge (x from 0), 2.05 m high. */
export const doorVox = (paint) => () => {
  const v = new Vox(), body = M(paint, 1), deep = M(tone(paint, -0.28), 1), brass = M('#c9a43a', 0);
  v.box(0, 1, -1, 36, 82, 1, body);
  for (const [x0, x1] of [[4, 16], [20, 32]]) for (const [y0, y1] of [[6, 24], [30, 52], [58, 77]]) for (const z of [-1, 0.4]) { v.box(x0, y0, z, x1, y1, z + 0.6, deep); v.box(x0 + 1.4, y0 + 1.4, z < 0 ? -1.3 : 0.7, x1 - 1.4, y1 - 1.4, z < 0 ? -0.7 : 1.3, body); }
  for (const z of [-2.2, 2.2]) { v.ellipsoid(31.5, 41, z, 1.6, 1.6, 1.3, brass); v.box(30.6, 37, z < 0 ? -1.4 : 1, 32.4, 45, z < 0 ? -1 : 1.4, brass); }
  v.box(12, 26.4, 1, 24, 28.6, 1.5, brass); v.box(13, 27, 1.4, 23, 28, 1.7, M('#1d1c1a', 0)); for (const x of [15, 18, 21]) v.box(x, 54, 1, x + 1.6, 56.6, 1.5, brass);
  return v;
};
/** The frame a door hangs in, about its middle: two jambs and a head, with an architrave. */
export const doorFrameVox = () => { const v = new Vox(), w = M('#efe9d8', 1), d = M('#cfc8b4', 1); for (const sx of [-1, 1]) { v.box(sx > 0 ? 18 : -21, 0, -2.4, sx > 0 ? 21 : -18, 84, 2.4, w); v.box(sx > 0 ? 20 : -23, 0, 2, sx > 0 ? 23 : -20, 86, 3, d); } v.box(-21, 82, -2.4, 21, 85, 2.4, w); v.box(-23, 84, 2, 23, 87, 3, d); return v; };
/** A garden gnome, with nothing to do. */
export const gnomeVox = () => {
  const v = new Vox(), coat = M('#3f5f8a', 1), beard = M('#efe9d8', 2), skin = M('#e2b494', 1);
  for (const x of [-2.4, 2.4]) v.rbox(x - 2, 0, -2, x + 2, 3, 3.4, 1, M('#3a2a1c', 1));
  v.rbox(-4.6, 2.6, -3.4, 4.6, 12, 3.4, 2.4, coat); v.cyl('y', 0, 0, 5.4, 6.6, 4.9, M('#1b1614', 0)); v.set(0, 6, 5, M('#c9a43a', 0));
  for (const sx of [-1, 1]) { v.tube(sx * 4.4, 10.4, 0, sx * 5.4, 6.4, 1.4, 1.2, coat); v.ellipsoid(sx * 5.5, 5.6, 1.6, 1.2, 1.2, 1.2, skin); }
  v.ellipsoid(0, 13.6, 0.2, 3.9, 3.6, 3.7, skin); v.ellipsoid(0, 11.4, 2.6, 3.6, 3.8, 2, beard); v.ellipsoid(0, 13.6, 3.9, 1.3, 1.1, 1.1, M('#d9977a', 1)); for (const sx of [-1.7, 1.7]) v.set(Math.round(sx), 15, 3, M('#17171a', 0));
  v.cyl('y', 0, -0.4, 15.6, 25, 4.4, M('#b3261e', 1), 0.6); v.cyl('y', 0, -0.4, 15.2, 16.4, 4.7, M('#8f1d17', 1));
  return v;
};
export const WRONG = {
  // one sprinkler head (the one thing here that is where it should be)
  sprinkler(c) { const at = c.spot(0.3, { pad: 1 }); if (!at) return false; sprinkler(c, at.x, at.z); },
  // every letter box the street had, delivered to one corner
  pile(c) {
    const k = c.corner(1.0); if (!k) return false;
    const R = c.R, tints = ['#56606c', '#6c7680', '#3f4a56', '#7d2a22', '#48584a'];
    for (const [n, r, y] of [[11, 0.8, 0.02], [7, 0.5, 0.2], [4, 0.26, 0.38], [1, 0, 0.56]]) for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + R.range(-0.3, 0.3), tint = R.pick(tints);
      c.model('suburb:letterbox:loose:' + tint, letterBoxVox(tint, false), k.x + Math.cos(a) * r * R.range(0.6, 1), k.z + Math.sin(a) * r * R.range(0.6, 1), { y: y + R.range(0, 0.04), rot: R.range(0, 6.28), tilt: [R.range(-0.5, 0.5), R.range(-0.9, 0.9)], solid: false, shadow: false });
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
  burning(c) { if (WRONG.car(c) === false) return false; const [x, z] = c.rt.carAt; blaze(c, x + 0.3, 0.75, z, 1.3); blaze(c, x - 0.6, 0.7, z + 0.3, 0.9); },
  // a car, parked where there was room
  ceilcar(c) {
    const { W, D } = c, y = c.ceilAt(0, 0), along = W >= D;
    if (y < 2.6 || c.ceilAt(1.5, 1.5) !== y || Math.max(W, D) < 5.4) return false;
    const b = new Batch(true); b.bare = true; car(c, 0, 0, along, '#3f5f8a', 0, b);
    const g = c.dynamic(b, { pivot: [0, 0, 0] }); g.rotation.z = Math.PI; g.position.y = y + 0.19;
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
  // telephone poles, in wood, melting
  melting(c) {
    const R = c.R; let n = 0;
    if (c.ceilAt(0, 0) < 2.6) return false;
    for (let i = 0; i < 3; i++) { const at = c.spot(1.1, { head: 2.6, pad: 0.6 }); if (!at) continue; const a = R.pick([0, 1, 2, 3]) * Math.PI / 2 + R.range(-0.5, 0.5); meltingPole(c, at.x, at.z, Math.cos(a), Math.sin(a), c.ceilAt(at.x, at.z) * R.range(1.05, 1.3)); n++; }
    return n ? undefined : false;
  },
  // front doors. A house has one; so here are some
  doors(c) {
    const R = c.R; let n = 0;
    if (Math.min(c.W, c.D) < 5.4) return false;                    // (room to walk round every one of them: a shut door in a lawn is a wall a metre wide)
    for (let i = 0; i < 5; i++) {
      const s = c.spot(0.7, { head: 2.3, pad: 1.1 }); if (!s) continue;
      const paint = ['#8c2a22', '#2f5a3a', '#27406b', '#b9a23a', '#3a3a3e'][i % 5], ajar = R.chance(0.4) ? R.range(0.35, 1.3) : 0;
      c.model('suburb:doorframe', doorFrameVox, s.x, s.z, { solid: false, shadow: false });
      c.model('suburb:door:' + paint, doorVox(paint), s.x - 0.45, s.z, { rot: ajar, solid: false, shadow: false });
      if (!ajar) c.solid(s.x - 0.56, s.z - 0.06, s.x + 0.56, s.z + 0.06, { tall: true }); else { c.solid(s.x - 0.58, s.z - 0.06, s.x - 0.45, s.z + 0.06); c.solid(s.x + 0.45, s.z - 0.06, s.x + 0.58, s.z + 0.06); }
      c.flat.box(s.x - 0.4, 0, s.z + 0.12, s.x + 0.4, 0.02, s.z + 0.6, [0.36, 0.26, 0.14], { skip: '-y' }); c.shadow(s.x, s.z, 1.2, 0.3, 0.35);
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
    // (wherever in the room there is the length of it clear: other things are left in lawns now, and it will not park on them)
    // …and never where it would be a wall: a lane a body and more wide past either side of it and round either end, in a room with nothing else across it
    if (c.room.quiet) return false;
    const L = Math.max(W, D) / 2, X = Math.min(W, D) / 2, ok = (x, z) => { const u = along ? x : z, v = along ? z : x; return Math.abs(u) + 2.1 + 1.1 <= L && Math.abs(v) + 0.85 + 1.1 <= X && [-1.5, 0, 1.5].every((k) => c.clear(x + (along ? k : 0), z + (along ? 0 : k), 0.7)); };
    for (const [u, v] of c.R.shuffle([[0, 0], [0, -1.2], [0, 1.2], [-1, 0], [1, 0], [-1, -1.2], [1, 1.2], [1, -1.2], [-1, 1.2]])) {
      const x = along ? u : v, z = along ? v : u;
      if (ok(x, z)) { car(c, x, z, along, c.R.pick(['#9a8a66', '#7d2a22', '#3f5f8a', '#5f7f5a']), -0.5); c.rt.carAt = [x, z]; return undefined; }
    }
    return false;
  },
};
/** A sprinkler head: a riser out of the grass, a brass body, a nozzle on an arm. */
const sprinklerVox = () => { const v = new Vox(); v.cyl('y', 0, 0, 0, 3, 1.6, M('#17171a', 1)); v.cyl('y', 0, 0, 3, 5, 1.2, M('#b58a2e', 0)); v.cyl('y', 0, 0, 5, 6, 1.7, M('#d9ac3f', 0)); v.tube(0, 5.5, 0, 3.4, 6.4, 0, 0.6, M('#b58a2e', 0)); v.set(3, 6, 0, M('#17171a', 0)); return v; };
export function sprinkler(c, x, z, rot = 0) {
  c.model('suburb:sprinkler', sprinklerVox, x, z, { rot, solid: false, shadow: false });
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
/** A letter box: a tunnel of pressed tin on a post, its door at one end, its flag up, a number that is nearly one. `post`: false for the box alone. */
const letterBoxVox = (tint, post = true) => () => {
  const v = new Vox(), tin = M(tint, 0), dark = M(tone(tint, -0.3), 0), y = post ? 40 : 0;
  if (post) { v.cyl('y', 0, 0, 0, 40, 1.8, M('#7d5d36', 3)); v.box(-3, 37, -2.4, 3, 40, 2.4, M('#6b4f2c', 3)); v.tube(0, 28, 0, 5, 38, 0, 1, M('#6b4f2c', 3)); }
  v.box(-10, y, -4.5, 10, y + 7, 4.5, tin); v.cyl('x', y + 7, 0, -10, 10, 4.5, tin);
  for (const x of [-10, -3.4, 3.2, 9]) { v.box(x, y, -4.7, x + 1, y + 7, 4.7, dark); v.cyl('x', y + 7, 0, x, x + 1, 4.7, dark); }                    // the ribs it is pressed with
  v.box(10, y + 1, -3.5, 10.6, y + 7, 3.5, M(tone(tint, 0.25), 0)); v.cyl('x', y + 7, 0, 10, 10.6, 3.5, M(tone(tint, 0.25), 0)); v.box(10.6, y + 8.4, -0.6, 11.4, y + 10, 0.6, dark);
  v.box(1, y + 3, 4.5, 2, y + 6, 5.3, M('#b3261e', 0)); v.box(1, y + 6, 4.5, 2, y + 14, 5.3, M('#c9372b', 0)); v.box(1, y + 11, 4.5, 6, y + 14, 5.3, M('#c9372b', 0));
  v.box(-7, y + 2, -5.1, -1, y + 5, -4.7, M('#1d1c1a', 0)); for (const x of [-6, -4, -2]) v.set(x, y + 3, -6, M('#e8d9a0', 0));
  return v;
};
export function postbox(c, x, z, rot = 0, opt = {}) {
  c.model('suburb:letterbox:' + (opt.tint || '#56606c'), letterBoxVox(opt.tint || '#56606c'), x, z, { rot, solid: false, shadow: false });
  c.solid(x - 0.12, z - 0.12, x + 0.12, z + 0.12); c.shadow(x, z, 0.5, 0.3, 0.4); c.reserve(x, z, 0.4);
  return { top: 1.3, hw: 0.25, hd: 0.118, along: false };
}
