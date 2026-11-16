// The Backrooms — what head count is made of (cast/head-count.js): the knot
// the three of them are joined in, one of the three, an upper arm, a forearm,
// a hand, and a lanyard. Voxels and nothing else, in the flesh of the lines
// and of Mother. Nothing here is clean.
import { Vox, M } from '../../vox/vox.js';

export const S = 0.03;
export const UPPER = 21, FORE = 23;           // voxels: the two lengths of an arm

const RAW = ['#b4756a', '#a5645b', '#c48a7d', '#8f5148'], BRUISE = '#5e3540', VEIN = '#4a2a3c', WET = '#7a2630', DARK = '#1c0709', BONE = '#e2d8bd', NAIL = '#2e2420';
const skinOf = (k = 0) => {
  const raw = RAW.map((c) => M(c, 2)), bruise = M(BRUISE, 2), vein = M(VEIN, 2);
  return (x, y, z) => {
    const h = Math.sin(x * 0.61 + y * 1.3 + k * 2.1) + Math.sin(z * 0.83 - y * 0.7 + k) + Math.sin((x + z) * 0.37 - k * 1.7);
    if (h > 2.0) return bruise;
    if (Math.abs(Math.sin(x * 0.9 + k * 3) * 4 + Math.sin(y * 0.5 + z * 0.4) * 3 - z * 0.6) < 0.22) return vein;
    return raw[Math.abs(Math.floor(h * 1.4 + 8)) % 4];
  };
};
/** A shirt that has been worn by this for a long time: its colour, the yellow under the arms, what has come through it. */
const clothOf = (base, k = 0) => {
  const cloth = [0, -1, 1].map((d) => M(shade(base, d * 0.07), 1)), stain = M(shade(base, -0.34), 1), seep = M('#6a2a2c', 1), skin = skinOf(k);
  return (x, y, z) => {
    const h = Math.sin(x * 0.5 + k) + Math.sin(z * 0.34 + y * 0.6 - k * 2) + Math.sin((x - z) * 0.21 + k);
    if (h > 1.9) return skin(x, y, z);                       // torn through
    if (h > 1.45) return seep;                               // and round the tear, soaked
    if (h < -1.7) return stain;
    return cloth[Math.abs(x + (z >> 1)) % 3];
  };
};
function shade(hex, by) { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * by))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); }

export const SHIRTS = ['#cdbf9c', '#8c97ab', '#b9c2ad'];

/** The knot: where three of them stop being three. Hips, belts, and what has grown over the join. Its middle at the origin. */
export function knotVox() {
  const v = new Vox(), skin = skinOf(4), belt = M('#2a211c', 1), buckle = M('#9a8f6a', 0), trouser = M('#3a3330', 1), dark = M(DARK, 0), wet = M(WET, 2), bone = M(BONE, 0);
  v.ellipsoid(0, 0, 0, 15, 9, 15, skin); v.ellipsoid(-6, 5, 4, 9, 6, 8, skin); v.ellipsoid(7, 4, -5, 8, 6, 9, skin); v.ellipsoid(2, -6, 2, 11, 5, 11, skin);
  // three belts, going in where a waist was, and what is left of the trousers they held up
  for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.3, cx = Math.cos(a) * 11, cz = Math.sin(a) * 11; v.ellipsoid(Math.round(cx), -2, Math.round(cz), 7, 5, 7, trouser); v.ring(Math.round(cx * 0.9), 2, Math.round(cz * 0.9), 6.4, 1, belt); v.box(Math.round(cx * 1.45) - 1, 1, Math.round(cz * 1.45) - 1, Math.round(cx * 1.45) + 1, 3, Math.round(cz * 1.45) + 1, buckle); }
  // the top of it: a seam that did not close, and the knuckles of a spine that is nobody's in particular
  for (let x = -9; x <= 9; x++) { const z = Math.round(Math.sin(x * 0.5) * 2); v.set(x, 9, z, dark); v.set(x, 9, z + 1, wet); v.set(x, 9, z - 1, wet); if (x % 3 === 0) v.box(x, 9, z, x, 11, z, bone); }
  // and fingers, of hands that never got out, all over the back of it
  for (let n = 0; n < 16; n++) { const a = n * 2.4, r = 5 + (n % 4) * 2.3, x = Math.cos(a) * r, z = Math.sin(a) * r, y = 8 - (r > 9 ? 3 : 0); v.tube(x, y, z, x + Math.cos(a) * 1.5, y + 3 + (n % 3), z + Math.sin(a) * 1.5, 0.75, skin); v.set(Math.round(x + Math.cos(a) * 1.6), y + 4 + (n % 3), Math.round(z + Math.sin(a) * 1.6), M(NAIL, 0)); }
  v.ellipsoid(0, -10, 0, 9, 2, 9, M('#3a1418', 0));
  return v;
}

/** One of the three: from the belt to where the neck ends. It lies along +z, belly down, its middle at the origin. (k: which.) */
export function torsoVox(k = 0) {
  const v = new Vox(), skin = skinOf(k + 6), cloth = clothOf(SHIRTS[k % 3], k), dark = M(DARK, 0), wet = M(WET, 2), bone = M(BONE, 0), collar = M(shade(SHIRTS[k % 3], 0.08), 1), strap = M('#1d2a44', 0);
  v.ellipsoid(0, 0, 0, 9, 6, 14, cloth); v.ellipsoid(0, 1, 9, 11, 6, 6, cloth);                 // the back, and the shoulders
  v.ellipsoid(0, -4, -2, 8, 5, 10, cloth);                                                      // a belly that hangs
  // the shirt has split down the back, and what is under it stands out of the split
  for (let z = -11; z <= 8; z++) { const w = 1 + Math.round(Math.abs(Math.sin(z * 0.45 + k)) * 1.6); for (let x = -w; x <= w; x++) v.set(x, 6 + (Math.abs(x) < w ? 1 : 0), z, skin(x, 6, z)); if (((z % 4) + 4) % 4 === 0) v.box(-1, 7, z, 0, 8, z, bone); }
  // ribs through it on one side, where it has been dragged
  for (let z = -6; z <= 4; z += 3) { v.tube(5 + (k % 2 ? -10 : 0), 3, z, 8 + (k % 2 ? -16 : 0), -2, z + 1, 0.7, bone); }
  // where the neck ends: a collar still buttoned round it, the wet ring of it, and a hole
  v.cyl('z', 0, 2, 14, 17, 4.6, collar); v.cyl('z', 0, 2, 17, 20, 3.8, skin, 4.4); v.cyl('z', 0, 2, 20, 21, 4.6, wet);
  for (let x = -2; x <= 2; x++) for (let y = 0; y <= 4; y++) if ((x * x + (y - 2) * (y - 2)) <= 5) { v.set(x, y, 20, dark); v.set(x, y, 19, dark); }
  v.box(-1, 3, 18, 0, 5, 21, bone);                                                               // the end of a spine, standing out of it
  for (let n = 0; n < 6; n++) { const a = n * 1.05 + k; v.set(Math.round(Math.cos(a) * 4.4), 2 + Math.round(Math.sin(a) * 4.4), 21 + (n % 2), wet); }   // it is ragged
  v.ring(0, 2, 15, 5, 0.6, strap, 'z');                                                           // the lanyard, round what it was put round
  // counted, on its own back, in fives
  for (let g = 0; g < 2; g++) for (let n = 0; n < 5; n++) { const x = -7 + n + g * 9; for (let z = -9; z <= -5; z++) v.set(n === 4 ? x - 4 + (z + 9) : x, 5 - (Math.abs(x) > 5 ? 1 : 0), n === 4 ? z : z, dark); }
  return v;
}

/** An upper arm: too long, the sleeve gone to a rag at the shoulder. Along +y from the shoulder at y 0. */
export function upperVox(k = 0) {
  const v = new Vox(), skin = skinOf(k + 11), rag = M(shade(SHIRTS[k % 3], -0.12), 1);
  v.cyl('y', 0, 0, 0, UPPER, 3.1, skin, 2.2); v.ellipsoid(0, 0, 0, 3.8, 3, 3.8, skin);
  for (let n = 0; n < 9; n++) { const a = n * 0.7 + k; v.tube(Math.cos(a) * 3, 0, Math.sin(a) * 3, Math.cos(a) * 3.6, 4 + (n % 4), Math.sin(a) * 3.6, 0.6, rag); }
  v.ellipsoid(0, UPPER, 0, 3, 2.6, 3, skin);                                                      // an elbow like a knot in a rope
  return v;
}
/** A forearm: thinner still, all cord. Along +y from the elbow at y 0. */
export function foreVox(k = 0) {
  const v = new Vox(), skin = skinOf(k + 17), vein = M(VEIN, 2);
  v.cyl('y', 0, 0, 0, FORE, 2.3, skin, 1.7);
  v.tube(1.6, 2, 0.5, 1.2, FORE - 2, -0.6, 0.5, vein); v.tube(-1.4, 4, -0.8, -0.8, FORE - 4, 1, 0.5, vein);
  v.ellipsoid(0, FORE, 0, 2.2, 1.6, 2.2, skin);
  return v;
}
/** A hand, flat on the floor: a palm and more fingers than a hand has, each a joint too long. It points along +z; the wrist is at the origin, on y 0. */
export function handVox(k = 0) {
  const v = new Vox(), skin = skinOf(k + 23), nail = M(NAIL, 0), knuckle = M('#c48a7d', 2);
  v.ellipsoid(0, 1, 3, 3.6, 1.6, 4, skin);
  const n = 6 + (k % 2);
  for (let f = 0; f < n; f++) {
    const a = (f - (n - 1) / 2) * 0.42, len = 9 + ((f * 3 + k) % 4), mx = Math.sin(a) * len * 0.55, mz = 6 + Math.cos(a) * len * 0.55, tx = Math.sin(a) * len * 1.05, tz = 6 + Math.cos(a) * len * 1.05;
    v.tube(Math.sin(a) * 2.5, 1, 5, mx, 3, mz, 0.9, skin); v.tube(mx, 3, mz, tx, 0, tz, 0.8, skin);                 // up at the knuckle, down at the tip: it walks on them
    v.set(Math.round(mx), 4, Math.round(mz), knuckle); v.set(Math.round(tx), 0, Math.round(tz) + 1, nail); v.set(Math.round(tx), 1, Math.round(tz) + 1, nail);
  }
  v.tube(-3, 1, 2, -7, 2, 0, 0.9, skin); v.tube(3, 1, 2, 7, 1, -1, 0.9, skin);                                     // and a thumb either side
  v.carve(-16, -6, -6, 16, -1, 24);
  return v;
}
/** A lanyard: the strap, and the card on the end of it with a face on it that is nobody now. It hangs along -y from the origin. */
export function lanyardVox(k = 0) {
  const v = new Vox(), strap = M('#1d2a44', 0), card = M('#e9e4d2', 0), dark = M('#2a211c', 0), tint = M(['#8c2f2f', '#2f5f8c', '#3d7a4a'][k % 3], 0);
  v.box(0, -12, 0, 0, 0, 0, strap); v.box(-2, -18, 0, 2, -12, 0, card); v.box(-2, -13, 0, 2, -12, 0, tint);
  v.box(-1, -16, 0, 0, -15, 0, dark); v.set(-1, -14, 0, dark); v.set(0, -14, 0, dark);              // a photograph of somebody, with the head scratched out
  for (const [x, y] of [[-1, -16], [0, -15], [1, -17], [-1, -14], [1, -15]]) v.set(x, y, 1, dark);
  return v;
}
