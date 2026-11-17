// The Backrooms — a window's joinery, sculpted. Pure: voxels in, voxels out. Nothing here is placed: whoever builds
// the wall places these, where the five painted blocks of a window were (world.js), and at exactly their sizes.
//
// Every model: x along the wall with the window's middle at 0, y up, z out of the wall.
//   the sill     0.16 m wider than the opening, 0.05 m high, 0.07 m proud. y 0 is its underside; z 0 the wall's face.
//   the casing   the head and the two jambs as one piece: 0.12 m wider than the opening and 0.06 m higher, 0.03 m
//                proud. y 0 is the foot of the opening; z 0 the wall's face. Open at the bottom, where the sill is.
//   the bars     the cross in the opening: an upright 0.04 m wide and a rail 0.04 m high, 0.03 m through.
//                y 0 is the foot of the opening; z 0 is the middle of the bars (they stand in the middle of the wall).
// A model's voxels are near 1.5 cm but not exactly: each *Dims() gives the metres a model must come out to and the
// metres per voxel each way that make it so (the three numbers a placing matrix wants).
import { Vox, M, tone } from '../vox/vox.js';

export const WINDOW = Object.freeze({ voxel: 0.015, sill: Object.freeze({ wider: 0.16, high: 0.05, proud: 0.07 }), casing: Object.freeze({ wider: 0.12, head: 0.06, jamb: 0.06, proud: 0.03 }), bars: Object.freeze({ wide: 0.04, through: 0.03 }) });

const n = (metres, least = 1) => Math.max(least, Math.round(metres / WINDOW.voxel));
const dims = (size, voxels) => Object.freeze({ size: Object.freeze(size), voxels: Object.freeze(voxels), scale: Object.freeze(size.map((m, i) => m / voxels[i])) });
const even = (k) => k + (k % 2);                                       // (an even count sits square on the middle)

export const sillDims = (w) => dims([w + WINDOW.sill.wider, WINDOW.sill.high, WINDOW.sill.proud], [even(n(w + WINDOW.sill.wider)), 3, 5]);
export const casingDims = ({ w, h }) => dims([w + WINDOW.casing.wider, h + WINDOW.casing.head, WINDOW.casing.proud], [even(n(w)) + 8, n(h) + 4, 2]);
export const barsDims = ({ w, h }) => dims([w, h, WINDOW.bars.through], [even(n(w)), even(n(h)), 2]);

const box = (v) => (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);

/** The sill: a board with a rounded nose and a drip under it, worn where elbows go. */
export function sillVox(w, colour = '#e2d8bd') {
  const [X] = sillDims(w).voxels, h = X / 2, v = new Vox(), b = box(v);
  const paint = M(colour, 0), lit = M(tone(colour, 0.07), 0), under = M(tone(colour, -0.16), 0), worn = M(tone(colour, -0.07), 0);
  b(-h, 1, 0, h - 1, 2, 3, paint); b(-h, 0, 0, h - 1, 0, 2, under);                                   // the board, and the apron under it
  b(-h, 1, 4, h - 1, 1, 4, paint);                                                                     // the nose: its top corner is taken off
  b(-h, 2, 0, h - 1, 2, 3, lit);
  b(-Math.round(h * 0.3), 2, 2, Math.round(h * 0.2), 2, 3, worn);                                     // where people lean
  return v;
}

/** The casing: an architrave in two steps round the head and both sides, a block at each top corner. */
export function casingVox({ w, h }, colour = '#e2d8bd') {
  const [X, Y] = casingDims({ w, h }).voxels, hx = X / 2, v = new Vox(), b = box(v);
  const paint = M(colour, 0), lit = M(tone(colour, 0.07), 0), shade = M(tone(colour, -0.1), 0);
  const top = Y - 1, open = hx - 4;                                                                    // (the opening is x −open…open−1, y 0…top−4)
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -hx : open, x1 = x0 + 3;
    b(x0, 0, 0, x1, top - 4, 0, paint);                                                               // a jamb: the flat of it …
    b(s < 0 ? x0 + 2 : x0, 0, 1, s < 0 ? x1 : x1 - 2, top - 4, 1, lit);                              // … and the raised band next to the opening
    b(x0, top - 3, 0, x1, top, 1, paint); b(x0 + 1, top - 2, 1, x1 - 1, top - 1, 1, shade);           // the corner block, and the square cut in it
  }
  b(-open, top - 3, 0, open - 1, top, 0, paint); b(-open, top - 3, 1, open - 1, top - 2, 1, lit);      // the head, the same in section
  return v;
}

/** The bars: an upright and a rail halved into each other, a line of putty where the glass would meet them. */
export function barsVox({ w, h }, colour = '#e2d8bd') {
  const [X, Y] = barsDims({ w, h }).voxels, hx = X / 2, my = Y / 2, v = new Vox(), b = box(v);
  const paint = M(colour, 0), putty = M(tone(colour, -0.12), 0);
  const half = Math.max(1, Math.round(WINDOW.bars.wide / 2 / (w / X))), halfY = Math.max(1, Math.round(WINDOW.bars.wide / 2 / (h / Y)));
  b(-half, 0, -1, half - 1, Y - 1, 0, paint); b(-hx, my - halfY, -1, hx - 1, my + halfY - 1, 0, paint);
  for (const z of [-1, 0]) { b(-half, 0, z, -half, Y - 1, z, putty); b(half - 1, 0, z, half - 1, Y - 1, z, putty); }
  return v;
}
