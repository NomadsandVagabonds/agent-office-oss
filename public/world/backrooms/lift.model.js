// The Backrooms — a lift's front, sculpted. Pure: voxels in, voxels out.
// The steel surround with a hole in the middle, a door leaf (two of them slide away behind it), and the plate the
// call button is on. x runs along the wall (0 is the middle), y up from the floor (the call plate: from its middle),
// z out of the wall with the back at z = 0. The surround and the leaf are half-size voxels (1.25 cm), the plate
// quarter-size (6.25 mm). Words, the floor number and the button's light are the room's own, laid over these.
import { Vox, M, tone, noise3 } from '../vox/vox.js';

export const LIFT = Object.freeze({ voxel: 0.0125, plateVoxel: 0.00625, deep: 9, leafDeep: 2 });
const V = LIFT.voxel;
const box = (v) => (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);

/**
 * The surround: brushed steel in panels either side of the opening and over it, an architrave stepping back into
 * the opening, a kick strip along the foot, a grooved sill across the threshold, a screw in each panel's corners.
 * The middle of the head is left plain: the sign and the floor number hang there.
 * @param {{ow:number, oh:number, side:number, head:number, colour:string}} o the opening's width and height, how
 *        wide the steel is either side of it and how tall over it (metres), and the steel
 */
export function surroundVox({ ow, oh, side, head, colour }) {
  const v = new Vox(), B = box(v), hx = Math.round(ow / V / 2), H = Math.round(oh / V), S = Math.round(side / V), T = Math.round(head / V), D = LIFT.deep;
  const steel = M(colour, 1), streak = M(tone(colour, 0.06), 1), seam = M(tone(colour, -0.3), 0), step = M(tone(colour, -0.14), 1), kick = M(tone(colour, -0.42), 0), screw = M(tone(colour, -0.5), 0);
  const face = (x0, x1, y0, y1) => {
    B(x0, y0, 0, x1, y1, D - 1, steel);
    for (let x = x0; x <= x1; x++) if (noise3(x >> 1, 5, 1, 11) > 0.7) B(x, y0, D - 1, x, y1, D - 1, streak);     // brushed, top to bottom
  };
  face(-hx - S, -hx - 1, 0, H + T - 1); face(hx, hx + S - 1, 0, H + T - 1); face(-hx, hx - 1, H, H + T - 1);
  // panel seams: the steel either side is in two sheets, the head is one; a screw at each sheet's corners
  for (const s of [-1, 1]) {
    const xm = s * (hx + (S >> 1));
    B(xm, 0, D - 1, xm, H + T - 1, D - 1, seam);
    for (const [x0, x1] of s < 0 ? [[-hx - S, xm - 1], [xm + 1, -hx - 1]] : [[hx, xm - 1], [xm + 1, hx + S - 1]]) for (const x of [x0 + 2, x1 - 2]) for (const y of [14, H + T - 4]) v.set(x, y, D - 1, screw);
  }
  B(-hx - S, H + T - 1, D - 1, hx + S - 1, H + T - 1, D - 1, seam);
  // the architrave: two steps back into the opening, all round it
  for (let k = 0; k < 2; k++) {
    const d = D - 2 - k * 2;
    B(-hx - 3 + k * 2, 0, d, -hx - 2 + k * 2, H + 2 - k * 2, D - 1, step); B(hx + 1 - k * 2, 0, d, hx + 2 - k * 2, H + 2 - k * 2, D - 1, step); B(-hx - 3 + k * 2, H + 1 - k * 2, d, hx + 2 - k * 2, H + 2 - k * 2, D - 1, step);
  }
  // the kick strip, scuffed; and the sill, with the grooves the doors run in
  for (const [x0, x1] of [[-hx - S, -hx - 4], [hx + 3, hx + S - 1]]) { B(x0, 0, D, x1, 7, D, kick); for (let x = x0; x <= x1; x++) if (noise3(x >> 2, 2, 3, 4) > 0.75) v.set(x, 3 + (x & 1), D, seam); }
  B(-hx, 0, 0, hx - 1, 1, D - 1, kick); for (const z of [3, 5]) B(-hx, 1, z, hx - 1, 1, z, M('#0d0d0e', 0));
  return v;
}

/** One leaf: a steel slab with a panel pressed into it, a rubber strip down the edge the two meet at (+x), scuffs low down. */
export function liftLeafVox({ w, h, colour }) {
  const v = new Vox(), B = box(v), W = Math.round(w / V), H = Math.round(h / V), hx = W >> 1, D = LIFT.leafDeep;
  const steel = M(colour, 1), streak = M(tone(colour, 0.06), 1), sunk = M(tone(colour, -0.1), 1), groove = M(tone(colour, -0.34), 0), rubber = M('#151516', 0);
  B(-hx, 0, 0, W - hx - 1, H - 1, D - 1, steel);
  for (let x = -hx; x < W - hx; x++) if (noise3(x >> 1, 9, 2, 3) > 0.7) B(x, 0, D - 1, x, H - 1, D - 1, streak);
  const x0 = -hx + 6, x1 = W - hx - 8, y0 = 18, y1 = H - 19;
  B(x0, y0, D - 1, x1, y1, D - 1, sunk); B(x0, y0, D - 1, x1, y0, D - 1, groove); B(x0, y1, D - 1, x1, y1, D - 1, groove); B(x0, y0, D - 1, x0, y1, D - 1, groove); B(x1, y0, D - 1, x1, y1, D - 1, groove);
  B(W - hx - 2, 0, 0, W - hx - 1, H - 1, D, rubber);
  for (let x = -hx; x < W - hx - 2; x++) for (let y = 1; y < 14; y++) if (noise3(x >> 3, y >> 1, 5, 8) > 0.93) v.set(x, y, D - 1, groove);
  return v;
}

/** The call plate (12 cm by 24): a bevelled plate, a collar round where the button's light goes, an arrow over it, a key switch under, four screws. */
export function callPlateVox({ colour }) {
  const v = new Vox(), B = box(v), hx = 10, hy = 19;
  const plate = M(tone(colour, -0.45), 0), edge = M(tone(colour, -0.6), 0), collar = M(tone(colour, -0.1), 0), mark = M(tone(colour, 0.2), 0), dark = M('#0d0d0e', 0);
  B(-hx, -hy, 0, hx - 1, hy - 1, 0, edge); B(-hx + 1, -hy + 1, 0, hx - 2, hy - 2, 1, plate);
  B(-5, -5, 2, 4, 4, 2, collar); v.carve(-4, -4, 2, 4, 4, 3);                                                // the collar: the lit button sits in it
  for (let k = 0; k < 4; k++) B(-k - 1, 12 - k, 2, k, 12 - k, 2, mark);                                       // an arrow, up
  B(-2, -14, 2, 1, -11, 2, collar); v.set(-1, -13, 2, dark); v.set(0, -13, 2, dark); v.set(-1, -12, 2, dark);  // the key switch
  for (const [x, y] of [[-hx + 2, -hy + 2], [hx - 3, -hy + 2], [-hx + 2, hy - 3], [hx - 3, hy - 3]]) v.set(x, y, 2, edge);
  return v;
}
