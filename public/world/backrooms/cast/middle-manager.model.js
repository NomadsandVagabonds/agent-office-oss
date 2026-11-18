// The Backrooms — what the middle manager is made of (cast/middle-manager.js). Voxels, fine ones.
//
// Somebody who has been in the building a long time and has been stretched by it: three metres, so that under an
// ordinary ceiling it stands bent, its head down, and in a doorway it folds nearly in half; and thin enough to stand
// sideways in one. A suit almost black, a white shirt, a dark tie, a lanyard with a badge on it whose photograph is
// blank too. Long legs, longer arms, hands with fingers too long by a joint. And where the face should be, nothing: a
// head like an egg, pale, smooth, turned to you.
// Then the same suit with far too much in it: the jacket will not close, the shirt has gone at the buttons, the tie lies
// on top of it all.
//
// Each piece is made along +y from its joint at the origin (hips, shoulders, elbows, knees, wrists), front on +z. Few
// colours, so that the faces merge and it reads smooth, not built.
import { Vox, M } from '../../vox/vox.js';

export const S = 0.012;           // metres per voxel
export const TORSO = 66;          // hips to shoulders
export const NECK = 15;
export const UPPER = 53, FORE = 53, HAND = 26;     // the arms: they hang below the knee, and the hands are long
export const THIGH = 58, SHIN = 58;                // the legs: the hip is at 1.48 m
export const SHOE = 7;                             // voxels from the ankle to the floor
export const HEAD = 34;                            // voxels from the neck to the crown
/** How tall it stands, metres, straight up. */
export const STANDS = (THIGH + SHIN + SHOE + TORSO + NECK + HEAD) * S;

const SUIT = '#17181c', SUIT2 = '#1d1e23', SHIRT = '#e4e3de', TIE = '#0f1014', SKIN = '#e9e6df', SKIN2 = '#dcd8d0', SKIN3 = '#cfcac1';

/** A smooth solid of revolution about +y: radius r(k) at height k = 0…1 of `len`, and `depth` its front-to-back share. */
function lathe(v, len, r, color, depth = 1, x0 = 0, z0 = 0) {
  for (let y = 0; y <= len; y++) {
    const k = y / len, rx = r(k), rz = rx * depth, R = Math.ceil(rx) + 1;
    for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) if ((x / rx) ** 2 + (z / rz) ** 2 <= 1) v.set(x0 + x, y, z0 + z, typeof color === 'function' ? color(x, y, z, k) : color);
  }
  return v;
}

/** Its body from the hips (y 0) to the shoulders (y TORSO). `full`: the same suit with too much in it. */
export function torsoVox(full = false) {
  const v = new Vox(), suit = M(SUIT, 0), suit2 = M(SUIT2, 0), shirt = M(SHIRT, 0), tie = M(TIE, 0), skin = M(SKIN2, 0), button = M('#08080a', 0);
  const strap = M('#2a3140', 0), card = M('#d8d6d0', 0), blank = M('#bdbab3', 0);
  // thin: a waist like a wrist, a narrow chest, and the shoulders squared by the jacket. Full: round, lowest at the belly
  const w = full ? (k) => 15 + Math.sin(Math.min(1, k * 1.12) * Math.PI) * 17 + (k > 0.86 ? (k - 0.86) * 30 : 0) : (k) => 7 + k * 5 + (k > 0.84 ? (k - 0.84) * 45 : 0);
  const d = full ? 0.95 : 0.62;
  lathe(v, TORSO, w, (x, y, z, k) => {
    const rx = w(k), front = z > rx * d * 0.5;
    // the jacket opens on the shirt in a long V; full, it does not close at all, and the shirt is open between its buttons
    const open = full ? Math.abs(x) < 5 + k * 9 : k > 0.42 && Math.abs(x) < (k - 0.42) * 22 + 1;
    if (y < 3) return suit2;
    if (front && open) return full && k < 0.7 && Math.abs(x) < 2 && y % 10 > 6 ? skin : shirt;
    return Math.abs(x) > rx * 0.82 ? suit2 : suit;
  }, d);
  const front = (x, y) => { let z = 60; while (z > -60 && !v.has(x, y, z)) z--; return z; };
  // the tie: narrow and dark, from the collar down; full, it lies on top of the belly and stops well short
  const tieFrom = full ? Math.round(TORSO * 0.5) : Math.round(TORSO * 0.18);
  for (let y = tieFrom; y <= TORSO - 2; y++) { const wd = y > TORSO - 6 ? 2 : y < tieFrom + 4 ? 2 : 1; for (let x = -wd; x <= wd; x++) v.set(x, y, front(x, y) + 1, tie); }
  // buttons: done up when it is thin; strained apart when it is full
  for (const y of full ? [14, 24, 34] : [16, 26]) { if (full) for (const sx of [-1, 1]) v.set(sx * (7 + (y % 3)), y, front(sx * 7, y), button); else v.set(2, y, front(2, y) + 1, button); }
  // the lanyard and the badge on its chest; its photograph is as blank as its face. Full, the badge has gone into a crease
  const bx = full ? 10 : 4, by = full ? 30 : 34;
  for (let y = by + 9; y <= TORSO - 1; y++) v.set(full ? 8 : 3, y, front(full ? 8 : 3, y) + 1, strap);
  for (let x = bx; x <= bx + 6; x++) for (let y = by; y <= by + 9; y++) v.set(x, y, front(x, y) + 1, x > bx + 1 && x < bx + 5 && y > by + 2 && y < by + 7 ? blank : card);
  // the jacket's shoulders: squared, sharp
  for (const sx of [-1, 1]) v.ellipsoid(sx * (full ? 30 : 13), TORSO - 3, 0, full ? 8 : 6, 4, full ? 10 : 6, suit);
  return v;
}

/** Its neck and its collar: long, thin, along +y from the shoulders. */
export function neckVox() {
  const v = new Vox(), skin = M(SKIN2, 0), shirt = M(SHIRT, 0);
  lathe(v, NECK, (k) => 3.6 - k * 0.6, skin);
  lathe(v, 5, () => 5.5, shirt);
  return v;
}

/**
 * Its head: an egg, longer than a head, narrower at the bottom, pale and perfectly smooth. Nothing on it at all. Only the
 * light shows where a face would be: the front is a shade paler. The neck joins underneath at the origin; front on +z.
 */
export function headVox() {
  const v = new Vox(), pale = M(SKIN, 0), mid = M(SKIN2, 0), back = M(SKIN3, 0);
  lathe(v, HEAD, (k) => { const t = k * 2 - 1; return Math.max(0.5, Math.sqrt(Math.max(0, 1 - t * t)) * (9.5 + k * 1.8)); }, (x, y, z) => (z > 3 ? pale : z > -4 ? mid : back), 1.05);
  return v;
}

/** An arm's length of sleeve, along +y, `len` voxels, narrowing; `cuff`: the shirt shows at the end of it. */
export function sleeveVox(len, cuff = false, wide = 4.6) {
  const v = new Vox(), suit = M(SUIT, 0), shirt = M(SHIRT, 0);
  lathe(v, len, (k) => wide - k * 1.3, (x, y) => (cuff && y > len - 3 ? shirt : suit));
  return v;
}

/** A hand: long, pale, the fingers apart and too long by a joint, a little curled. Along +y from the wrist. */
export function handVox() {
  const v = new Vox(), skin = M(SKIN2, 0), knuckle = M(SKIN3, 0);
  lathe(v, 7, (k) => 3.2 - k * 0.4, skin, 0.55);
  for (const [x, len, curl] of [[-3, 15, 1], [-1, 19, 2], [1, 19, 2], [3, 16, 1]]) {
    for (let y = 7; y <= 7 + len; y++) { const z = Math.round(((y - 7) / len) ** 2 * curl * 2); v.set(x, y, z, (y - 7) % 7 === 6 ? knuckle : skin); }
  }
  for (let y = 0; y <= 10; y++) v.set(-4 - Math.round(y * 0.25), y + 1, Math.round(y * 0.3), skin);         // the thumb
  return v;
}

/** A trouser leg, along +y, narrowing to the ankle. */
export function trouserVox(len, wide = 5.2) {
  const v = new Vox(), suit = M(SUIT, 0), crease = M(SUIT2, 0);
  lathe(v, len, (k) => wide - k * 1.4, (x, y, z) => (x === 0 && z > 0 ? crease : suit));
  return v;
}

/** A shoe: black, polished, long and narrow. The ankle is at the origin; the toe points +z; the sole is at y -SHOE. */
export function shoeVox() {
  const v = new Vox(), black = M('#0b0b0d', 0), shine = M('#2c2e34', 0);
  for (let z = -6; z <= 22; z++) { const k = (z + 6) / 28, w = 4 - Math.max(0, k - 0.7) * 6, h = SHOE - Math.round(Math.max(0, k - 0.5) * 6); for (let x = -Math.round(w); x <= Math.round(w); x++) for (let y = -SHOE; y <= -SHOE + h; y++) v.set(x, y, z, y === -SHOE + h && Math.abs(x) < 2 && k > 0.4 ? shine : black); }
  return v;
}
