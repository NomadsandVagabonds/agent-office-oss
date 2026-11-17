// The Backrooms — what is fixed to a fire stair, sculpted. Pure: voxels in, voxels out. Nothing here is solid:
// the stairs are the stairwell's own concrete, and these are drawn on them.
//
//   the nosing    the strip screwed along the edge of each tread: ribbed steel, painted yellow once, the paint gone
//                 where feet come down. Quarter-size voxels across and along (6.25 mm), one voxel high; whoever places
//                 it squashes that to a few millimetres. x along the edge from 0, z back from the edge from 0.
//   the rail      a steel tube, eight-sided as near as four voxels go, half-size voxels (1.25 cm). It runs along +z from
//                 0, its middle on the origin; at its far end, if asked, it turns in to the wall and ends in a flange.
//   the bracket   what holds the rail off the wall: a plate with two screws, an arm, a cradle. x is out from the wall
//                 (the wall's face at 0, the rail's middle at STAIRS.reach), y 0 is the rail's middle.
import { Vox, M, tone, noise3 } from '../vox/vox.js';

export const STAIRS = Object.freeze({
  nosing: Object.freeze({ voxel: 0.00625, deep: 8 }),     // metres per voxel along and across · voxels from the edge back
  rail: Object.freeze({ voxel: 0.0125, reach: 8 }),       // metres per voxel · voxels from the wall's face to the rail's middle
});

const YELLOW = '#b8921f', STEEL = '#6b7075', RAIL = '#6f7478';
const B = (v) => (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);

/** @param {number} n how many voxels long the strip is (along the tread's edge) */
export function nosingVox(n) {
  const v = new Vox(), b = B(v), N = Math.max(16, Math.round(n));
  const yellow = M(YELLOW, 0), pale = M(tone(YELLOW, 0.12), 0), steel = M(STEEL, 0), bright = M(tone(STEEL, 0.2), 0), groove = M('#26282a', 0), screw = M('#2f3133', 0);
  // from the edge back: a yellow lip, a groove, two yellow ribs, a groove, the steel it is all rolled from, its back edge
  b(0, 0, 0, N - 1, 0, 0, pale); b(0, 0, 1, N - 1, 0, 1, groove); b(0, 0, 2, N - 1, 0, 3, yellow); b(0, 0, 4, N - 1, 0, 4, groove);
  b(0, 0, 5, N - 1, 0, 6, steel); b(0, 0, 7, N - 1, 0, 7, M(tone(STEEL, -0.2), 0));
  // where people walk (down the middle, and by the rail) the paint has gone, in patches a shoe wide
  for (let x = 0; x < N; x += 8) {
    const u = x / N, traffic = Math.max(1 - Math.abs(u - 0.5) * 3.2, 1 - Math.abs(u - 0.14) * 9);
    if (noise3(x >> 3, 2, 5, 13) < traffic * 0.95) { b(x, 0, 2, Math.min(N - 1, x + 7), 0, 3, bright); if (noise3(x >> 3, 4, 1, 13) < traffic * 0.7) b(x, 0, 0, Math.min(N - 1, x + 7), 0, 0, bright); }
  }
  for (let x = 6; x < N - 4; x += 64) b(x, 0, 5, x + 1, 0, 6, screw);
  b(N - 8, 0, 5, N - 7, 0, 6, screw);
  return v;
}

/**
 * @param {number} n     how many voxels long
 * @param {{wall?:number}} [o] wall: +1 or −1, the side (model x) the wall is on: the far end turns in to it. 0 or absent: a plain length.
 */
export function railVox(n, { wall = 0 } = {}) {
  const v = new Vox(), b = B(v), L = Math.max(8, Math.round(n));
  const steel = M(RAIL, 0), worn = M(tone(RAIL, 0.16), 0), dark = M(tone(RAIL, -0.22), 0);
  b(-1, -2, 0, 0, 1, L - 1, steel); b(-2, -1, 0, 1, 0, L - 1, steel);
  b(-1, 1, 0, 0, 1, L - 1, worn);                                                       // a hand has been along the top of it for forty years
  b(-1, -2, 0, 0, -2, L - 1, dark);
  if (wall) {
    const X = (x) => (wall > 0 ? x : -1 - x), R = STAIRS.rail.reach, bx = (x0, y0, z0, x1, y1, z1, c) => b(Math.min(X(x0), X(x1)), y0, z0, Math.max(X(x0), X(x1)), y1, z1, c);
    bx(1, -2, L - 4, R - 2, 1, L - 1, steel); bx(1, -1, L - 5, R - 2, 0, L, steel);     // the return
    bx(R - 1, -4, L - 7, R - 1, 3, L + 2, dark);                                          // the flange on the wall
    for (const [y, z] of [[-3, L - 6], [2, L - 6], [-3, L + 1], [2, L + 1]]) v.set(X(R - 1), y, z, worn);
  }
  return v;
}

export function bracketVox() {
  const v = new Vox(), b = B(v), R = STAIRS.rail.reach;
  const steel = M(tone(RAIL, -0.08), 0), dark = M(tone(RAIL, -0.3), 0), screw = M('#b9bcbd', 0);
  b(0, -10, -2, 0, -3, 2, steel);                                                         // the plate
  v.set(0, -9, 0, screw); v.set(0, -4, 0, screw);
  b(1, -7, -1, R, -6, 0, steel); b(1, -8, -1, 3, -8, 0, dark);                            // the arm, and the web under it
  b(R - 1, -5, -1, R, -4, 0, steel);                                                      // up to the rail
  b(R - 2, -3, -2, R + 1, -3, 1, dark);                                                   // the cradle it sits in
  return v;
}
