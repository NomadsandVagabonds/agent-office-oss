// The Backrooms — what the middle manager is made of (cast/middle-manager.js). Voxels, fine ones.
//
// Somebody who has been in the building a long time and has been stretched by it: three metres, so that under an
// ordinary ceiling it stands bent, its head down, and in a doorway it folds nearly in half; and thin enough to stand
// sideways in one. A tired grey-brown suit a size too short for it, so that the wrists and the ankles show; an
// off-white shirt; a dull patterned tie; a lanyard and a big badge whose photograph is blank. Long legs, longer arms,
// hands with fingers too long by a joint. And where the face should be, nothing: a head like an egg, sallow, smooth,
// turned to you.
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

const SUIT = '#47433c', SUIT2 = '#3d3a34', SHIRT = '#d9d5c6', TIE = '#5d5a3c', TIE2 = '#77653f', SOCK = '#22262e', SKIN = '#d8c4b1', SKIN2 = '#cbb5a1', SKIN3 = '#bca390';
const LANYARD = '#3f7f86';

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
  const tie2 = M(TIE2, 0), strap = M(LANYARD, 0), card = M('#ece9df', 0), blank = M('#b9b4a8', 0), band = M(LANYARD, 0), clip = M('#9a9a96', 0);
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
  for (let y = tieFrom; y <= TORSO - 2; y++) { const wd = y > TORSO - 6 ? 2 : y < tieFrom + 4 ? 2 : 1; for (let x = -wd; x <= wd; x++) v.set(x, y, front(x, y) + 1, (x + y) % 5 < 2 ? tie2 : tie); }          // (a dull diagonal stripe)
  // buttons: done up when it is thin; strained apart when it is full
  for (const y of full ? [14, 24, 34] : [16, 26]) { if (full) for (const sx of [-1, 1]) v.set(sx * (7 + (y % 3)), y, front(sx * 7, y), button); else v.set(2, y, front(2, y) + 1, button); }
  // the lanyard, round its neck and down, and the badge on it, big, at the middle of its chest: its photograph is as blank
  // as its face. Full, the lanyard is pulled taut over the belly and the badge rides up on it
  const bx = full ? -5 : -4, by = full ? 44 : 30, bw = 10, bh = 14;
  for (const sx of [-1, 1]) for (let y = by + bh; y <= TORSO - 1; y++) { const x = Math.round(sx * (2 + (y - by - bh) * (full ? 0.5 : 0.18))); v.set(x, y, front(x, y) + 1, strap); }
  for (let x = bx; x <= bx + bw - 1; x++) for (let y = by; y <= by + bh - 1; y++) v.set(x, y, front(x, y) + 2, y >= by + bh - 3 ? band : x > bx + 2 && x < bx + 7 && y > by + 3 && y < by + 9 ? blank : card);
  v.set(bx + 4, by + bh, front(bx + 4, by + bh) + 2, clip); v.set(bx + 5, by + bh, front(bx + 5, by + bh) + 2, clip);
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

/** How fed it looks: 0 sad, 1 nothing, 2 pleased, 3 the grin (cast/middle-manager.js picks it by how fat it is). */
export const FACES = 4;

/**
 * Its head: an egg, longer than a head, narrower at the bottom, sallow and smooth, and on it a face drawn as a child draws
 * one, small, in the middle of all that egg. Unfed it is sad: a mouth turned down and two streaks of tears. Fed, the mouth
 * straightens, then turns up, and at the last it is a grin from one side of the head to the other, under two eyes gone
 * wide and white. The neck joins underneath at the origin; front on +z.
 * @param face 0…3 (FACES)
 */
export function headVox(face = 0) {
  const v = new Vox(), pale = M(SKIN, 0), mid = M(SKIN2, 0), back = M(SKIN3, 0);          // (sallow, not white: somebody's, once)
  lathe(v, HEAD, (k) => { const t = k * 2 - 1; return Math.max(0.5, Math.sqrt(Math.max(0, 1 - t * t)) * (9.5 + k * 1.8)); }, (x, y, z) => (z > 3 ? pale : z > -4 ? mid : back), 1.05);
  const ink = M('#2a1f1c', 0), tear = M('#9fb4c2', 0), white = M('#f1eee4', 0), tooth = M('#e8e2cf', 0), gum = M('#5a2a2a', 0);
  // paint onto the front of the egg: the voxel nearest the viewer at (x, y), and the one behind it, so it reads from the side
  const front = (x, y) => { for (let z = 20; z > 0; z--) if (v.has(x, y, z)) return z; return null; };
  const dot = (x, y, c, deep = 2) => { const z = front(x, y); if (z === null) return; for (let d = 0; d < deep; d++) v.set(x, y, z - d, c); };
  const EY = 21, MY = 11;
  if (face < 3) {
    // small eyes, close together; sad, the brows go up in the middle and the tears run from them
    for (const sx of [-1, 1]) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) dot(sx * 3 + (sx > 0 ? dx : -dx), EY + dy, ink);
      if (face === 0) { for (let t = 0; t <= 4; t++) dot(sx * (6 - t), EY + 1 + t, ink, 1); for (let y = EY - 1; y >= EY - 9; y--) dot(sx * (4 + ((EY - y) > 5 ? 1 : 0)), y, tear, 1); }
    }
    // the mouth: down at the ends, then straight, then up
    for (let x = -4; x <= 4; x++) {
      const k = (x / 4) ** 2, y = face === 0 ? MY + Math.round(2 * (1 - k)) : face === 1 ? MY : MY + Math.round(2 * k);
      dot(x, y, ink);
    }
  } else {
    // the grin, and the eyes: wide, white, a speck of black in each, too high and too far apart
    for (const sx of [-1, 1]) for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) if (dx * dx + dy * dy <= 10) dot(sx * 4 + dx, EY + 1 + dy, dx === 0 && dy === 0 ? ink : white, 1);
    for (let x = -8; x <= 8; x++) {
      const k = (x / 8) ** 2, top = MY + Math.round(3 * k) + 1, bottom = MY - 4 + Math.round(6 * k);
      for (let y = bottom; y <= top; y++) dot(x, y, y === top ? tooth : y === bottom ? ink : y === top - 1 && x % 2 === 0 ? tooth : gum, 1);
      dot(x, top + 1, ink, 1);
    }
  }
  return v;
}

/** An arm's length of sleeve, along +y, `len` voxels, narrowing; `cuff`: it is too short — a band of shirt cuff, then the wrist. */
export function sleeveVox(len, cuff = false, wide = 4.6) {
  const v = new Vox(), suit = M(SUIT, 0), shirt = M(SHIRT, 0), skin = M(SKIN2, 0);
  lathe(v, len, (k) => (cuff && k > 0.86 ? 2.6 : wide - k * 1.3), (x, y) => (cuff && y > len * 0.92 ? skin : cuff && y > len * 0.82 ? shirt : suit));
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

/** A trouser leg, along +y, narrowing to the ankle; `short`: it stops short of the shoe, over a thin sock and a band of shin. */
export function trouserVox(len, wide = 5.2, short = false) {
  const v = new Vox(), suit = M(SUIT, 0), crease = M(SUIT2, 0), sock = M(SOCK, 0), skin = M(SKIN3, 0);
  lathe(v, len, (k) => (short && k > 0.84 ? 2.8 : wide - k * 1.4), (x, y, z, k) => (short && k > 0.92 ? sock : short && k > 0.84 ? skin : x === 0 && z > 0 ? crease : suit));
  return v;
}

/** A shoe: black, polished, long and narrow. The ankle is at the origin; the toe points +z; the sole is at y -SHOE. */
export function shoeVox() {
  const v = new Vox(), black = M('#0b0b0d', 0), shine = M('#2c2e34', 0);
  for (let z = -6; z <= 22; z++) { const k = (z + 6) / 28, w = 4 - Math.max(0, k - 0.7) * 6, h = SHOE - Math.round(Math.max(0, k - 0.5) * 6); for (let x = -Math.round(w); x <= Math.round(w); x++) for (let y = -SHOE; y <= -SHOE + h; y++) v.set(x, y, z, y === -SHOE + h && Math.abs(x) < 2 && k > 0.4 ? shine : black); }
  return v;
}
