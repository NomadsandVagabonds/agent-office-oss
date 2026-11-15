// The Backrooms — what the greeter is made of (cast/greeter.js): a ring of its
// trunk, the mouth on top of it, a length of what it waves, a foot, and the
// small ones it brings up. Voxels and nothing else (no three.js here), in the
// same flesh as the lines (cast/the-lines.model.js): raw, mottled, bruised.
import { Vox, M } from '../../vox/vox.js';

export const S = 0.03;            // metres to a voxel of the big one
export const SW = 0.014;          // …and of a small one
export const RING = 7;            // voxels a ring of the trunk is tall
export const LIMB = 9;            // voxels a length of what it waves is long

const RAW = ['#b4756a', '#a5645b', '#c48a7d', '#8f5148'], BRUISE = '#5e3540', CREASE = '#6d3a3a', VEIN = '#4a2a3c', GUM = '#7a2630', THROAT = '#1c0709', TOOTH = '#efe7d2', BRISTLE = '#2a1a18';
/** The skin of it: four reds that do not agree, a bruise where three waves meet, and a vein now and then. (k: so that no two rings are alike.) */
const skinOf = (k = 0) => {
  const raw = RAW.map((c) => M(c, 2)), bruise = M(BRUISE, 2), vein = M(VEIN, 2);
  return (x, y, z) => {
    const h = Math.sin(x * 0.61 + y * 1.3 + k * 2.1) + Math.sin(z * 0.83 - y * 0.7 + k) + Math.sin((x + z) * 0.37 - k * 1.7);
    if (h > 2.15) return bruise;
    if (Math.abs(Math.sin(x * 0.9 + k * 3) * 4 + Math.sin(y * 0.5 + z * 0.4) * 3 - z * 0.6) < 0.2) return vein;
    return raw[Math.abs(Math.floor(h * 1.4 + 8)) % 4];
  };
};

/** A ring of the trunk: fat in the middle, drawn in where it meets the next, with a few coarse hairs and a wen or two. Base at y 0. */
export function ringVox(k = 0) {
  const v = new Vox(), skin = skinOf(k), crease = M(CREASE, 2), bristle = M(BRISTLE, 0);
  for (let y = 0; y < RING; y++) {
    const edge = Math.min(y, RING - 1 - y), r = 10 - (edge === 0 ? 1.6 : edge === 1 ? 0.5 : 0);
    v.cyl('y', 0, 0, y, y + 1, r, edge === 0 ? crease : skin);
  }
  // wens: lumps under the skin, not where they were on the last ring
  for (let n = 0; n < 3; n++) { const a = k * 2.4 + n * 2.3, d = 8.6; v.ellipsoid(Math.round(Math.cos(a) * d), 3 + (n % 2), Math.round(Math.sin(a) * d), 2.6, 2.2, 2.6, skin); }
  // and hairs, thick as wire, standing out of it
  for (let n = 0; n < 7; n++) { const a = k * 1.3 + n * 0.9 + Math.sin(n * 7 + k) * 0.3, y = 1 + ((n * 3 + k) % 5); v.tube(Math.cos(a) * 9.4, y, Math.sin(a) * 9.4, Math.cos(a) * (11.6 + (n % 3)), y + (n % 2 ? 1 : -1), Math.sin(a) * (11.6 + (n % 3)), 0.5, bristle); }
  return v;
}

/** The top of it: a lip of gum round a hole, and rings of teeth going down into the dark, each ring inside the last. Base at y 0. */
export function mouthVox() {
  const v = new Vox(), skin = skinOf(5), gum = M(GUM, 2), throat = M(THROAT, 0), tooth = M(TOOTH, 0), stain = M('#cdb98f', 0);
  v.cyl('y', 0, 0, 0, 6, 9.2, skin, 10.2);
  v.cyl('y', 0, 0, 6, 10, 10.2, gum, 11.4);                                 // the lip, turned out
  v.cyl('y', 0, 0, 10, 11, 10.6, gum);
  // hollow: wide at the lip, narrowing as it goes down
  for (let y = 2; y <= 11; y++) { const r = 3.2 + (y - 2) * 0.62; for (let x = -9; x <= 9; x++) for (let z = -9; z <= 9; z++) if (x * x + z * z <= r * r) v.set(x, y, z, 0); }
  v.cyl('y', 0, 0, 1, 2, 4, throat); v.cyl('y', 0, 0, 2, 3, 3.6, throat);
  // the walls of it, wet and dark
  for (let y = 3; y <= 9; y++) { const r = 3.9 + (y - 2) * 0.62; for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI * 2; v.set(Math.round(Math.cos(t) * r), y, Math.round(Math.sin(t) * r), a % 5 === 0 ? gum : throat); } }
  // teeth: three rings, pointing in, longer toward the lip
  for (const [y, r, n, len] of [[11, 9.4, 22, 6], [9, 7.8, 17, 5], [7, 6.2, 13, 4], [5, 4.6, 9, 3]]) {
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2 + y, cx = Math.cos(t), cz = Math.sin(t);
      for (let j = 0; j < len - (k % 3 === 1 ? 1 : 0); j++) v.set(Math.round(cx * (r - j * 0.9)), y + 1 - Math.floor(j * 0.45), Math.round(cz * (r - j * 0.9)), k % 5 === 0 ? stain : tooth);   // (long, thin, uneven: spines more than teeth)
    }
  }
  return v;
}

/** A length of what it waves: a rope of the same flesh, thinner toward the end it is not joined on by. Along +y, base at y 0. */
export function limbVox() {
  const v = new Vox(), skin = skinOf(9), crease = M(CREASE, 2);
  v.cyl('y', 0, 0, 0, LIMB, 2.3, (x, y, z) => (y % 4 === 0 ? crease : skin(x, y, z)), 1.7);
  v.ellipsoid(0, 0, 0, 2.6, 1.6, 2.6, skin);
  return v;
}
/** The last length of one: it ends in three things that are not fingers. */
export function endVox() {
  const v = limbVox(), skin = skinOf(2), nail = M('#d9cdb0', 0);
  for (const [x, z] of [[-1.6, 0], [1.2, 1.2], [1.0, -1.4]]) { v.tube(x * 0.6, LIMB - 1, z * 0.6, x * 1.8, LIMB + 4, z * 1.8, 0.8, skin); v.set(Math.round(x * 1.9), LIMB + 5, Math.round(z * 1.9), nail); }
  return v;
}

/** A foot: short, thick, flat underneath, with nails where no toes are. It points along +z. Base at y 0. */
export function footVox() {
  const v = new Vox(), skin = skinOf(3), dark = M(CREASE, 2), nail = M('#cfc3a4', 0);
  v.ellipsoid(0, 2, 1, 4.6, 4.2, 6.6, skin); v.ellipsoid(0, 4, -3, 3.8, 4.4, 3.8, skin);
  v.carve(-8, -8, -12, 8, -1, 12);
  for (const x of [-3, 0, 3]) { v.ellipsoid(x, 1, 7, 1.5, 1.4, 1.8, skin); v.box(x - 1, 2, 8, x, 2, 8, nail); }
  v.box(-4, 0, -4, 4, 0, 6, dark);
  return v;
}

/** A length of a small one: wet pink, ringed. Along -z from the origin, lying on y 0. (k: 0 its head, which has a mouth and nothing else.) */
export function wormVox(k = 0) {
  const v = new Vox(), pink = ['#f08aa2', '#e46f90', '#f7a6b6', '#c9517a'].map((c) => M(c, 2)), ring = M('#a8385f', 2), dark = M('#3a0f1e', 0), tooth = M(TOOTH, 0);
  const skin = (x, y, z) => (((z % 3) + 3) % 3 === 0 ? ring : pink[Math.abs(Math.floor(Math.sin(x * 1.3 + y * 0.9 + k) * 2 + Math.sin(z * 0.8) * 2 + 4)) % 4]);
  v.ellipsoid(0, 3, -3, 3.4 - k * 0.35, 3 - k * 0.3, 4.4, skin);
  v.carve(-6, -6, -10, 6, -1, 6);
  if (k === 0) { v.ellipsoid(0, 3, 1, 1.8, 1.6, 1.2, dark); for (const [x, y] of [[-1, 4], [1, 4], [-1, 2], [1, 2], [0, 5]]) v.set(x, y, 1, tooth); }
  return v;
}
