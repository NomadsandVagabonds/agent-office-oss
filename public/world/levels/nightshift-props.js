// Night Shift: the office reduced to its silhouettes, still made of 2.5 cm cubes.
// Front is +z. Furniture stands on y=0; worker limbs use an explicit joint pivot.
import { Vox, M, glow } from '../vox/vox.js';

const BLACK = M('#101010', 0), CHARCOAL = M('#191919', 1), FACE = M('#252525', 0);
const EDGE = M('#414141', 0), METAL = M('#777777', 0), PAPER = M('#b9b9b9', 0);
const WHITE = glow('#dedede');

/** 2.50 × 1.55 × 1.00 m; tabletop at .95 m. The knee well remains hollow. */
export function silhouetteDesk({ screenOn = false } = {}) {
  const v = new Vox();
  v.box(-50, 35, -20, 50, 38, 20, CHARCOAL);
  v.box(-50, 37, 19, 50, 38, 20, EDGE);
  v.box(-47, 0, -17, -44, 35, 17, BLACK);
  v.box(26, 0, -17, 47, 35, 17, BLACK);
  v.box(-44, 19, -17, 26, 35, -15, CHARCOAL);
  for (const y of [3, 13, 23]) {
    v.box(28, y, 17, 45, y + 9, 18, FACE);
    v.box(34, y + 5, 18, 40, y + 6, 19, METAL);
  }
  // Deep square CRT and broad stand are readable even without a lit screen.
  v.box(-23, 38, -11, 5, 40, 7, BLACK);
  v.box(-13, 40, -6, -5, 44, 2, CHARCOAL);
  v.box(-25, 44, -17, 7, 61, 5, CHARCOAL);
  v.box(-23, 46, 5, 5, 59, 6, EDGE);
  v.box(-21, 47, 6, 3, 58, 7, screenOn ? M('#929292', 0) : BLACK);
  v.box(-25, 60, -17, 7, 62, 5, FACE);
  if (screenOn) {
    v.box(-18, 54, 7, -6, 55, 8, WHITE);
    v.box(-18, 51, 7, -12, 52, 8, PAPER);
  }
  v.set(3, 45, 6, WHITE);
  v.box(-25, 38, 11, 9, 40, 19, BLACK);
  for (const z of [12, 15]) v.box(-22, 40, z, 6, 41, z + 1, EDGE);
  // A forgotten sheet and its bent corner, plus a cold cylindrical mug.
  v.box(22, 38, -11, 43, 39, 5, PAPER);
  v.box(40, 39, -11, 43, 40, -8, EDGE);
  v.cyl('y', -38, 3, 38, 46, 4, FACE);
  v.cyl('y', -38, 3, 45, 46, 2.5, BLACK);
  v.ring(-33, 42, 3, 2.4, .8, FACE, 'z');
  return v;
}

/** 1.80 × 1.60 × .875 m: two locked filing cabinets with one conspicuous label. */
export function filingBank() {
  const v = new Vox();
  v.box(-36, 0, -16, 36, 3, 16, BLACK);
  v.box(-35, 3, -15, 35, 63, 16, CHARCOAL);
  v.box(-36, 63, -16, 36, 64, 17, EDGE);
  for (const x of [-33, 2]) for (const y of [5, 24, 43]) {
    v.box(x, y, 16, x + 31, y + 17, 17, FACE);
    v.box(x + 10, y + 10, 17, x + 21, y + 12, 18, METAL);
    v.box(x + 11, y + 4, 17, x + 20, y + 7, 18, EDGE);
    v.set(x + 26, y + 12, 17, METAL);
  }
  v.box(-21, 49, 18, -13, 51, 19, PAPER);
  return v;
}

/** 1.00 × .35 × .40 m; lower emitter at (0, .025, .10). Mount above the beam. */
export function securityLamp() {
  const v = new Vox();
  v.box(-20, 8, -8, 20, 12, 8, CHARCOAL);
  v.box(-4, 12, -3, 4, 14, 3, EDGE);
  v.box(-18, 6, -7, 18, 8, 7, FACE);
  v.box(-16, 5, -5, 16, 6, 5, WHITE);
  // Security lens hangs below one end of the fluorescent fixture.
  v.box(10, 1, -4, 18, 6, 6, BLACK);
  v.box(11, 1, 6, 17, 5, 8, EDGE);
  v.box(13, 2, 8, 15, 4, 9, WHITE);
  v.box(-18, 4, -7, -16, 8, 7, BLACK);
  return v;
}

/** 1.40 × 2.60 × .25 m; a black opening with a narrow luminous inner frame. */
export function officeDoor({ open = true } = {}) {
  const v = new Vox();
  v.box(-28, 0, -5, -24, 104, 5, CHARCOAL);
  v.box(24, 0, -5, 28, 104, 5, CHARCOAL);
  v.box(-24, 100, -5, 24, 104, 5, CHARCOAL);
  v.box(-24, 0, -4, 24, 100, -3, BLACK);
  v.box(-24, 1, -2, -23, 100, 0, open ? WHITE : EDGE);
  v.box(23, 1, -2, 24, 100, 0, open ? WHITE : EDGE);
  v.box(-24, 99, -2, 24, 100, 0, open ? WHITE : EDGE);
  v.box(-25, 0, -4, 25, 1, 5, EDGE);
  if (!open) {
    v.box(-23, 1, -2, 23, 99, 0, FACE);
    v.box(17, 44, 0, 19, 50, 2, METAL);
    v.box(-10, 73, 0, 10, 83, 1, BLACK);
  }
  return v;
}

/** A .35 m square head (eyes project .025 m), with squared hair and boxy glasses. */
export function workerHead() {
  const v = new Vox();
  v.box(-7, 0, -6, 7, 13, 6, CHARCOAL);
  v.box(-7, 10, -6, 7, 14, 6, BLACK);
  v.box(-7, 6, -6, -5, 12, 6, BLACK);
  v.box(-6, 12, -6, 3, 15, 5, BLACK);
  v.box(-4, 5, 6, -2, 7, 7, WHITE);
  v.box(2, 5, 6, 4, 7, 7, WHITE);
  v.box(-5, 7, 6, 5, 8, 7, EDGE); // boxy glasses, not a facial texture
  v.box(7, 5, 1, 8, 7, 3, WHITE);
  v.box(-8, 5, 1, -7, 7, 3, WHITE);
  v.box(-3, 1, 6, 3, 2, 7, FACE);
  return v;
}

/** Hip-to-collar torso, .35 × .425 × .25 m; small white ID badge on the jacket. */
export function workerBody() {
  const v = new Vox();
  v.box(-7, 0, -4, 7, 16, 4, BLACK);
  v.box(-6, 15, -3, 6, 17, 3, CHARCOAL);
  v.box(-2, 11, 4, 2, 16, 5, METAL);
  v.box(-1, 9, 5, 1, 15, 6, BLACK);
  v.box(3, 8, 4, 6, 12, 5, WHITE);
  v.box(-6, 1, 4, 6, 2, 5, FACE);
  return v;
}

/** Joint at origin; extends down. Leg .425 m, arm .35 m. Rotate around z to walk. */
export function workerLimb({ leg = false, part = 'whole' } = {}) {
  const v = new Vox(), length = part === 'upper' ? 7 : part === 'lower' ? (leg ? 8 : 7) : leg ? 17 : 14;
  v.box(-2, -length, -3, 2, 0, 3, BLACK);
  if (leg && part === 'whole') {
    v.box(-2, -length, -3, 5, -length + 3, 4, BLACK);
    v.box(-2, -length, 3, 5, -length + 1, 4, FACE);
  } else if (!leg && part !== 'upper') {
    v.box(-2, -length, -3, 2, -length + 3, 3, CHARCOAL);
    v.box(-2, -length + 3, 3, 2, -length + 4, 4, EDGE);
  }
  return v;
}

/** Ankle at origin; the separate shoe stays flat as the knee bends. */
export function workerFoot() {
  return new Vox().box(-2, -2, -3, 5, 0, 4, BLACK).box(-2, -2, 3, 5, -1, 4, FACE);
}

// Metres, for assembling a 1.225 m employee (feet y=0). No rig or scene ownership here.
export const WORKER_PARTS = Object.freeze({
  head: Object.freeze([0, .85, 0]), body: Object.freeze([0, .425, 0]),
  leftArm: Object.freeze([-.225, .80, 0]), rightArm: Object.freeze([.225, .80, 0]),
  leftLeg: Object.freeze([-.0875, .425, 0]), rightLeg: Object.freeze([.0875, .425, 0]),
  height: 1.225,
});

export const DIMENSIONS = Object.freeze({
  desk: Object.freeze({ width: 2.5, height: 1.55, depth: 1, coverHeight: .95 }),
  filing: Object.freeze({ width: 1.8, height: 1.6, depth: .875 }),
  lamp: Object.freeze({ width: 1, height: .35, depth: .425 }),
  door: Object.freeze({ width: 1.4, height: 2.6, depth: .25 }),
});
