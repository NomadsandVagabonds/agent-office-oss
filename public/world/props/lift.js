// The Office — the lift. What you call it with on the landing (a brass sill
// across the doorway and a call plate on the wall beside it), and the pieces a
// level uses to build its own lift doorway: the surround with a floor display
// over it, and a door leaf.
//
// Same rules as every other prop (README.md in this folder): 2.5 cm voxels,
// floor at y = 0, FRONT facing +z. These are all wall things: the back is the
// plane z = 0 and they stick out toward +z.
import { Vox, M, glow, tone } from '../vox/vox.js';

const PLATE = '#b4bcc8', FRAME = '#6d7582', LEAF = '#9aa3b0', BLACK = '#17171c', AMBER = '#ffb44a', BRASS = '#c9a24a';

/** Where the call plate hangs, measured from the middle of the doorway (voxels): beside the right-hand post. */
export const CALL_PLATE = Object.freeze({ x: 51, y: 28 });

/**
 * The lift, as far as the landing is concerned: a brass sill across the 2 m
 * doorway and the call plate on the wall to its right. Origin: the middle of
 * the doorway, on the floor, at the face of the wall. 93 × 52 × 5.
 */
export function liftpanel() {
  const v = new Vox();
  const brass = M(BRASS, 0), groove = tone(brass, -0.36);
  v.box(-37, 0, 0, 37, 1, 5, (x, y, z) => (z === 2 || x === -37 || x === 36 ? groove : brass));
  v.stamp(callplate(), CALL_PLATE.x, CALL_PLATE.y, 0);
  return v;
}

/**
 * The call plate: brushed steel with a floor display, an up and a down button,
 * a key switch nobody has the key for, and a note someone stuck on it.
 * Origin: bottom centre of the back. 10 × 24 × 3.
 */
export function callplate() {
  const v = new Vox();
  const plate = M(PLATE, 0), lite = tone(plate, 0.25), dark = tone(plate, -0.34), k = M(BLACK, 0);
  v.box(-5, 0, 0, 5, 24, 2, plate);
  v.paint(-5, 23, 0, 5, 24, 2, lite);                          // light catches the top edge
  v.paint(-5, 0, 0, 5, 1, 2, dark);
  for (const [x, y] of [[-4, 1], [3, 1], [-4, 22], [3, 22]]) v.set(x, y, 1, dark);     // screws
  // where the car is: a dark window, an amber 2 (the office's floor: core/levels.mjs)
  v.carve(-3, 15, 1, 3, 22, 2);
  v.paint(-3, 15, 0, 3, 22, 1, k);
  for (const [x0, y0, x1, y1] of [[-1, 20, 2, 21], [1, 19, 2, 20], [-1, 18, 2, 19], [-1, 17, 0, 18], [-1, 16, 2, 17]]) v.paint(x0, y0, 0, x1, y1, 1, glow(AMBER));
  // up (lit: the car is here) and down
  v.cyl('z', 0, 10, 2, 3, 2.9, glow(AMBER)); v.cyl('z', 0, 10, 2, 3, 2, lite);
  v.cyl('z', 0, 4, 2, 3, 2.9, dark); v.cyl('z', 0, 4, 2, 3, 2, lite);
  v.set(-1, 10, 2, dark); v.set(0, 10, 2, dark); v.set(-1, 11, 2, dark);               // ▲, as far as six pixels go
  v.set(-1, 4, 2, dark); v.set(0, 4, 2, dark); v.set(0, 3, 2, dark);
  v.set(3, 13, 1, k); v.set(3, 12, 1, k);                      // the key switch
  v.box(-5, 12, 2, -2, 15, 3, M('#f2d45c', 0));                // a sticky note: somebody's question about a floor
  v.set(-4, 13, 2, M('#8a7a3a', 0)); v.set(-3, 13, 2, M('#8a7a3a', 0));
  return v;
}

/** The doorway of a lift, in voxels: the opening, a leaf, and where the surround's display window is. */
export const LIFT = Object.freeze({ open: 48, height: 82, post: 4, leaf: 24, depth: 3 });
/** The floor display over the door: centre and size in voxels, in the plane z = LIFT_DISPLAY.z facing +z. */
export const LIFT_DISPLAY = Object.freeze({ x: 0, y: 94, z: 3.08, w: 16, h: 9 });

/**
 * The surround of a lift doorway: two posts, a header, a housing for the floor
 * display above it, and a threshold in hazard stripes. The opening is 48 × 82;
 * the scene lays the floor's letter over the dark window. 56 × 100 × 7.
 */
export function liftframe() {
  const v = new Vox();
  const st = M(FRAME, 0), lite = tone(st, 0.28), dark = tone(st, -0.32), k = M(BLACK, 0);
  const W = LIFT.open / 2, H = LIFT.height, P = LIFT.post;
  for (const x0 of [-W - P, W]) {
    v.box(x0, 0, 0, x0 + P, H + 5, 3, st);
    v.paint(x0 < 0 ? x0 + P - 1 : x0, 0, 0, x0 < 0 ? x0 + P : x0 + 1, H, 3, dark);       // the reveal, in shadow
    v.paint(x0, 0, 0, x0 + P, 2, 3, dark);
  }
  v.box(-W - P, H, 0, W + P, H + 5, 3, st);
  v.paint(-W - P, H + 4, 0, W + P, H + 5, 3, lite);
  v.paint(-W, H, 0, W, H + 1, 3, dark);
  for (const x of [-W - 2, W + 1]) for (const y of [20, 62]) v.set(x, y, 2, lite);     // bolts
  // the display housing
  v.rbox(-11, H + 5, 0, 11, H + 18, 4, 2, st, 'xy');
  v.paint(-11, H + 17, 0, 11, H + 18, 4, lite);
  v.carve(-8, H + 8, 3, 8, H + 16, 4);
  v.paint(-8, H + 8, 2, 8, H + 16, 3, k);
  // the threshold
  v.box(-W, 0, 0, W, 1, 7, (x) => ((((x + 96) >> 2) & 1) ? M('#e0a62a', 0) : k));
  return v;
}

/** One door leaf: brushed steel, a raised panel, a kick plate, rubber on both edges. Origin: bottom centre of the back. 24 × 82 × 2. */
export function liftleaf() {
  const v = new Vox();
  const st = M(LEAF, 0), lite = tone(st, 0.2), dark = tone(st, -0.26), rubber = M('#2b2b30', 0);
  v.box(-12, 0, 0, 12, LIFT.height, 2, st);
  v.paint(-8, 10, 1, 8, 74, 2, lite);                          // the raised panel
  v.paint(-8, 10, 1, 8, 11, 2, dark); v.paint(-8, 10, 1, -7, 74, 2, dark);
  v.paint(-12, 0, 1, 12, 5, 2, dark);                          // kick plate, scuffed
  v.paint(-6, 2, 1, -2, 3, 2, st); v.paint(3, 3, 1, 9, 4, 2, st);
  v.paint(-12, 0, 0, -11, LIFT.height, 2, rubber); v.paint(11, 0, 0, 12, LIFT.height, 2, rubber);
  return v;
}

export const CATALOGUE = {
  liftpanel: { make: () => liftpanel() },
  callplate: { make: () => callplate(), wall: true, y: CALL_PLATE.y * 0.025 },
  liftframe: { make: () => liftframe() },
  liftleaf: { make: () => liftleaf() },
};
