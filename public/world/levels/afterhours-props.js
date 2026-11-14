// After Hours: tools from maintenance, and something that came out of the vents.
// Original 2.5 cm voxel sculptures. Furniture stands at y=0 and faces +z.
// The crowbar and creature legs use the explicit pivots documented below.
import { Vox, M, glow, tone } from '../vox/vox.js';

const STEEL = M('#a5b4bd', 0), EDGE = M('#d3d9d5', 0), DARK_STEEL = M('#424f59', 1);
const RED = M('#a93629', 1), TAPE = M('#292c30', 2), WARNING = M('#d3a94a', 1);
const SHELL = M('#b9996d', 2), PALE = M('#d3bc92', 1), UNDERSIDE = M('#71513d', 2);
const CLAW = M('#573a2d', 1), BONE = M('#e0d3af', 0), MOUTH = M('#302b2a', 1);

/** Grip origin at (0,0,0); shaft +y, hooked fork +x. Approximately .85 m long. */
export function crowbar() {
  const v = new Vox();
  v.box(-1, -3, -1, 2, 24, 2, RED);
  v.paint(-1, 7, 1, 2, 22, 2, tone(RED, 0.14));
  v.rbox(-2, -2, -2, 3, 7, 3, 1, TAPE);
  for (const y of [0, 3, 6]) v.box(-2, y, 2, 3, y + 1, 3, M('#45484a', 1));
  // A forged, squared crook; the slit divides the end into two distinct claws.
  v.tube(0, 22, 0, 3, 27, 0, 1.8, STEEL);
  v.tube(3, 27, 0, 8, 27, 0, 1.8, STEEL);
  v.tube(8, 27, 0, 10, 23, 0, 1.8, STEEL);
  v.box(8, 21, -3, 12, 25, 3, STEEL);
  v.carve(8, 20, -1, 13, 24, 1);
  v.paint(2, 28, -2, 9, 30, 2, EDGE);
  v.paint(11, 21, -3, 12, 25, 3, EDGE);
  // The small pry end is visible below the wrapped handle.
  v.box(-1, -4, -1, 2, -2, 2, STEEL);
  v.box(-2, -5, -1, 3, -4, 2, EDGE);
  return v;
}

/** Hand closes around the crowbar's grip origin; sleeve extends down −y. */
export function gloveHand() {
  const v = new Vox(), glove = M('#41494e', 2), cuff = M('#bc8f45', 2);
  v.rbox(-5, -3, -4, 5, 5, 4, 1, glove);
  v.box(-4, -7, -3, 4, -3, 3, cuff);
  v.box(-4, -4, 3, 4, -2, 4, TAPE);
  v.rbox(-7, -1, 1, -3, 4, 6, 1, glove);
  for (const x of [-4, -1, 2]) v.box(x, 2, 4, x + 2, 5, 5, M('#596267', 1));
  v.carve(-1, -2, -1, 2, 6, 2);
  return v;
}

/** Body root is at the creature's feet. Dome .70×.60 m, top .45 m. Faces +z. */
export function headcrabBody() {
  const v = new Vox();
  v.rbox(-11, 5, -9, 11, 12, 10, 3, UNDERSIDE);
  v.ellipsoid(0, 11, -1, 14, 7, 12, SHELL);
  v.paint(-10, 15, -10, 11, 19, 9, PALE);
  // Broad patches and creases, not per-cell noise, keep the shell inexpensive.
  v.paint(-4, 16, -12, 4, 19, 8, tone(PALE, -0.08));
  v.paint(-14, 5, -9, -10, 11, 8, UNDERSIDE);
  v.paint(10, 5, -9, 14, 11, 8, UNDERSIDE);
  v.box(-7, 6, 9, 7, 8, 12, UNDERSIDE);
  v.box(-5, 5, 10, 5, 7, 12, MOUTH);
  // The dark underside and pale fangs become readable when the creature leaps.
  v.ellipsoid(0, 4.6, 2, 6.5, 2.6, 7, UNDERSIDE);
  v.ellipsoid(0, 3.6, 2, 4.5, 1.6, 4.8, MOUTH);
  for (const x of [-4, 4]) for (const z of [-2, 6]) v.cyl('y', x, z, 1, 6, 0.65, BONE, 1.6);
  // Four shoulder plates locate the leg pivots and give the windup a silhouette.
  for (const x of [-10, 10]) for (const z of [-7, 7]) v.ellipsoid(x, 7, z, 3.2, 3.2, 3.2, PALE);
  return v;
}

/**
 * Shoulder pivot at local origin. side is ±1, front selects +z/−z reach.
 * Mount at HEADCRAB.joints[*].position in metres. The bent knee rises .1 m;
 * the tapered claw descends .175 m to the floor. Rotate around z/x to animate.
 */
export function headcrabLeg({ side = 1, front = true } = {}) {
  const s = side < 0 ? -1 : 1, f = front ? 1 : -1, v = new Vox();
  v.ellipsoid(0, 0, 0, 2.5, 2.5, 2.5, UNDERSIDE);
  v.tube(0, 0, 0, s * 7, 4, f * 4, 2, SHELL);
  v.ellipsoid(s * 7, 4, f * 4, 2.6, 2.6, 2.6, PALE);
  v.tube(s * 7, 4, f * 4, s * 11, -4, f * 7, 1.7, UNDERSIDE);
  v.tube(s * 11, -4, f * 7, s * 12, -6.4, f * 9, 1.15, CLAW);
  return v;
}

/** .80 × .65 × .80 m body, with a .05 m handle. Matches a jumpable collision box. */
export function supplyCrate({ medical = false } = {}) {
  const v = new Vox(), base = M(medical ? '#678b78' : '#96734d', 2);
  v.box(-16, 0, -16, 16, 26, 16, base);
  v.paint(-16, 0, -16, 16, 3, 16, tone(base, -0.23));
  v.box(-16, 24, -16, 16, 26, 16, tone(base, 0.18));
  for (const x of [-13, 10]) {
    v.box(x, 0, -16, x + 3, 26, -15, DARK_STEEL);
    v.box(x, 0, 15, x + 3, 26, 16, DARK_STEEL);
    v.box(x, 25, -16, x + 3, 26, 16, STEEL);
  }
  v.box(-5, 17, 16, 5, 20, 17, TAPE);
  v.box(-4, 18, 16, 4, 19, 18, STEEL);
  if (medical) {
    v.box(-7, 5, 16, 7, 15, 17, M('#d7e0c9', 0));
    v.box(-2, 6, 17, 2, 14, 18, M('#476c56', 1));
    v.box(-6, 9, 17, 6, 12, 18, M('#476c56', 1));
    v.set(12, 22, 16, glow('#a6d7b1'));
  } else {
    v.box(-7, 5, 16, 7, 13, 17, WARNING);
    for (let x = -6; x < 7; x += 5) v.box(x, 5, 17, x + 2, 13, 18, TAPE);
  }
  return v;
}

/** Horizontal floor grille: 1.00 × .10 × .70 m. Rotate the holder for a wall vent. */
export function ventGrille() {
  const v = new Vox();
  v.box(-20, 0, -14, 20, 1, 14, TAPE);
  v.box(-20, 1, -14, -17, 3, 14, DARK_STEEL);
  v.box(17, 1, -14, 20, 3, 14, DARK_STEEL);
  v.box(-17, 1, -14, 17, 3, -11, DARK_STEEL);
  v.box(-17, 1, 11, 17, 3, 14, DARK_STEEL);
  for (let x = -15; x < 17; x += 5) v.box(x, 1, -11, x + 2, 3, 11, STEEL);
  for (const x of [-18, 18]) for (const z of [-12, 12]) v.set(x, 3, z, EDGE);
  return v;
}

/** .20 × .45 × .225 m power cell. Mount a little above its pedestal. */
export function fuseCell() {
  const v = new Vox();
  v.box(-4, 0, -4, 4, 16, 4, STEEL);
  v.box(-3, 3, -3, 3, 13, 3, M('#d29243', 1));
  v.box(-4, 4, -4, 4, 12, 4, M('#b36c31', 1));
  v.box(-2, 5, 4, 2, 11, 5, glow('#e8c87b'));
  v.box(-3, 1, 4, 3, 2, 5, DARK_STEEL);
  v.box(-3, 14, 4, 3, 15, 5, DARK_STEEL);
  v.box(-2, 16, -2, 2, 18, 2, EDGE);
  return v;
}

/** Wall mounting board .45×1.10 m, rear z=0. Place the crowbar separately. */
export function crowbarRack() {
  const v = new Vox();
  v.box(-9, 0, 0, 9, 44, 2, DARK_STEEL);
  v.box(-9, 0, 2, 9, 2, 3, WARNING);
  v.box(-9, 42, 2, 9, 44, 3, WARNING);
  for (const y of [10, 34]) {
    v.box(-4, y, 2, 4, y + 2, 6, STEEL);
    v.box(-4, y, 6, -2, y + 4, 8, STEEL);
    v.box(2, y, 6, 4, y + 4, 8, STEEL);
  }
  return v;
}

export const HEADCRAB = Object.freeze({
  width: 1.15, depth: 0.85, height: 0.45, bodyWidth: 0.7,
  joints: Object.freeze([
    { id: 'front-left', side: -1, front: true, position: [-0.25, 0.175, 0.175] },
    { id: 'front-right', side: 1, front: true, position: [0.25, 0.175, 0.175] },
    { id: 'back-left', side: -1, front: false, position: [-0.25, 0.175, -0.175] },
    { id: 'back-right', side: 1, front: false, position: [0.25, 0.175, -0.175] },
  ].map((joint) => Object.freeze({ ...joint, position: Object.freeze(joint.position) }))),
});
export const JOINTS = HEADCRAB.joints;
