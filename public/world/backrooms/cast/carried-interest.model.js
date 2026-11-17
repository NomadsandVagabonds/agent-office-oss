// The Backrooms — what carried interest is made of
// (cast/carried-interest.js): the weight of it, the small arms it has, and one
// of what carries it. Voxels and nothing else.
import { Vox, M } from '../../vox/vox.js';

export const S = 0.04;             // metres to a voxel of the big one: it is big
export const SB = 0.028;           // …and of a bearer

const RAW = ['#b4756a', '#a5645b', '#c48a7d', '#8f5148'], BRUISE = '#5e3540', VEIN = '#4a2a3c', WET = '#7a2630', DARK = '#12070a', TOOTH = '#efe7d2';
const skinOf = (k = 0) => {
  const raw = RAW.map((c) => M(c, 2)), bruise = M(BRUISE, 2), vein = M(VEIN, 2);
  return (x, y, z) => {
    const h = Math.sin(x * 0.61 + y * 1.3 + k * 2.1) + Math.sin(z * 0.83 - y * 0.7 + k) + Math.sin((x + z) * 0.37 - k * 1.7);
    if (h > 2.05) return bruise;
    if (Math.abs(Math.sin(x * 0.9 + k * 3) * 4 + Math.sin(y * 0.5 + z * 0.4) * 3 - z * 0.6) < 0.24) return vein;       // (it is stretched: the veins show)
    return raw[Math.abs(Math.floor(h * 1.4 + 8)) % 4];
  };
};

/**
 * The weight of it. A shirt with a stripe in it, and over that a waistcoat, both made for somebody a quarter of the size and
 * both still done up, so that between every pair of buttons it comes through; a tie; and on top, sunk in to the ears, a head
 * that is asleep until it is dropped. It faces +z. Its middle is at the origin.
 */
export function weightVox() {
  const v = new Vox(), skin = skinOf(2), shirtA = M('#d8d3c6', 1), shirtB = M('#8d8fb0', 1), coat = M('#2f2b33', 1), pin = M('#4a4652', 1), tie = M('#7d1f27', 1), tieD = M('#5a151c', 1), button = M('#b9ab78', 0), dark = M(DARK, 0), wet = M(WET, 2), tooth = M(TOOTH, 0), sweat = M('#a8a48c', 1), chain = M('#c9b86a', 0);
  const RX = 19, RY = 13, RZ = 17;
  v.ellipsoid(0, 0, 0, RX, RY, RZ, (x, y, z) => {
    const front = z > 0, ax = Math.abs(x);
    // where two buttons are a long way apart, there is no cloth between them
    const gape = front && ax < 3 + Math.abs(Math.sin(y * 0.8)) * 3.2 && ((y + 40) % 6) > 1;
    if (y < -8) return skin(x, y, z);                                               // underneath, where it rests on them: nothing was ever made to cover it
    if (gape) return skin(x, y, z);
    if (front && ax < 2 && y > -6) return (y + 60) % 7 < 5 ? tie : tieD;
    const inCoat = ax > 5 + (front ? Math.max(0, y) * 0.35 : -30) && y < 9;
    if (inCoat) return (x + 100) % 4 === 0 ? pin : coat;
    if (y > 4 && ax > 12 && (x * 3 + y) % 5 < 2) return sweat;
    return (x + 100) % 3 === 0 ? shirtB : shirtA;
  });
  for (let y = -6; y <= 6; y += 6) { v.set(4, y, Math.round(RZ * Math.sqrt(Math.max(0, 1 - (y / RY) ** 2 - (4 / RX) ** 2))), button); v.set(-9, y - 2, Math.round(RZ * Math.sqrt(Math.max(0, 1 - ((y - 2) / RY) ** 2 - (9 / RX) ** 2))), button); }
  // a watch chain, across it, that no longer reaches
  for (let x = -11; x <= 2; x++) { const y = -1 + Math.round(Math.sin((x + 11) / 13 * Math.PI) * -2), z = Math.round(RZ * Math.sqrt(Math.max(0, 1 - (y / RY) ** 2 - (x / RX) ** 2))) + 1; v.set(x, y, z, chain); }
  // rolls of it, over the collar
  v.ellipsoid(0, 12, 1, 8, 3, 8, skin); v.ellipsoid(0, 14, 2, 6, 2.5, 6.5, skin);
  // the head: small for it, bald, and down among the rolls
  v.ellipsoid(0, 17, 3, 5.5, 5, 5.5, skin);
  for (const ex of [-2.5, 2.5]) { v.box(Math.round(ex - 1), 18, 8, Math.round(ex + 1), 18, 8, dark); v.set(Math.round(ex), 17, 8, wet); }      // shut eyes, and they weep
  v.box(-2, 14, 7, 2, 15, 8, dark); for (const tx of [-2, 0, 2]) v.set(tx, 15, 8, tooth);                                              // a mouth, open, breathing
  v.box(-1, 16, 8, 0, 17, 9, skin(0, 16, 9));
  for (const sx of [-1, 1]) v.ellipsoid(sx * 5.5, 17, 2, 1.4, 2.2, 1.6, skin);                                                         // ears
  // and it sags, at the back and the sides, over whatever is under it
  for (let n = 0; n < 9; n++) { const a = n * 0.7 + 1.2; v.ellipsoid(Math.round(Math.cos(a) * 16), -11, Math.round(Math.sin(a) * 14), 4, 3.5, 4, skin); }
  return v;
}

/** One of its arms: short, and no use to it. Along +y from the shoulder at y 0; it ends in a hand that opens and shuts on nothing. */
export function armVox(k = 0) {
  const v = new Vox(), skin = skinOf(k + 9), cuff = M('#d8d3c6', 1), link = M('#b9ab78', 0), nail = M('#2e2420', 0);
  v.cyl('y', 0, 0, 0, 7, 2.6, M('#2f2b33', 1), 2.2); v.cyl('y', 0, 0, 7, 9, 2.4, cuff); v.set(2, 8, 0, link);
  v.ellipsoid(0, 11, 0, 2.4, 2.4, 2, skin);
  for (const [x, z] of [[-2, 0], [-1, 1], [1, 1], [2, 0], [0, -1]]) { v.tube(x, 12, z, x * 1.6, 15, z * 1.6, 0.6, skin); v.set(Math.round(x * 1.7), 16, Math.round(z * 1.7), nail); }
  return v;
}

/**
 * One of what carries it: Mother's sort, grown thick and upright, with two arms it was not born with held up over its head
 * to take the weight, and a mouth where the top of it is. Base at y 0.
 */
export function bearerVox(k = 0) {
  const v = new Vox(), pink = ['#f08aa2', '#e46f90', '#f7a6b6', '#c9517a'].map((c) => M(c, 2)), ring = M('#a8385f', 2), dark = M('#3a0f1e', 0), tooth = M(TOOTH, 0), gum = M('#8a2a35', 2);
  const skin = (x, y, z) => (y % 3 === 0 ? ring : pink[Math.abs(Math.floor(Math.sin(x * 1.3 + y * 0.9 + k) * 2 + Math.sin(z * 0.8) * 2 + 4)) % 4]);
  for (let y = 0; y < 15; y++) { const r = 4.6 - Math.abs(y - 6) * 0.16 + (y < 2 ? 0.8 : 0); v.cyl('y', 0, 0, y, y + 1, r, skin); }
  v.cyl('y', 0, 0, 15, 17, 4.2, gum, 4.8);
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (x * x + z * z <= 8) { v.set(x, 16, z, 0); v.set(x, 15, z, 0); v.set(x, 14, z, dark); }
  for (let n = 0; n < 10; n++) { const a = (n / 10) * Math.PI * 2 + k; v.set(Math.round(Math.cos(a) * 3.4), 16, Math.round(Math.sin(a) * 3.4), tooth); if (n % 2) v.set(Math.round(Math.cos(a) * 2.4), 15, Math.round(Math.sin(a) * 2.4), tooth); }
  // arms: up, either side, bent under the load, the hands flat against it
  for (const sx of [-1, 1]) { v.tube(sx * 4, 10, 0, sx * 7, 13, 1, 1.1, skin); v.tube(sx * 7, 13, 1, sx * 6, 19, 0, 1, skin); v.box(sx * 6 - 1, 20, -1, sx * 6 + 1, 20, 2, pink[2]); }
  // and feet of a kind, to shuffle on
  for (let n = 0; n < 5; n++) { const a = n * 1.26 + k; v.ellipsoid(Math.round(Math.cos(a) * 4.4), 0, Math.round(Math.sin(a) * 4.4), 1.8, 1.2, 1.8, ring); }
  v.carve(-10, -4, -10, 10, -1, 10);
  return v;
}
