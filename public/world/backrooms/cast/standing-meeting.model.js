// The Backrooms — what the standing meeting is made of
// (cast/standing-meeting.js): a length of it (a pair of hips), a thigh, a shin
// with the shoe on, and a tie. Voxels and nothing
// else, in the flesh of the lines, Mother and head count.
import { Vox, M } from '../../vox/vox.js';

export const S = 0.03;
export const THIGH = 20, SHIN = 16;               // voxels: a thigh that goes straight out sideways, and a shin that goes straight down

const RAW = ['#b4756a', '#a5645b', '#c48a7d', '#8f5148'], BRUISE = '#5e3540', VEIN = '#4a2a3c', WET = '#7a2630', DARK = '#1c0709', BONE = '#e2d8bd';
const skinOf = (k = 0) => {
  const raw = RAW.map((c) => M(c, 2)), bruise = M(BRUISE, 2), vein = M(VEIN, 2);
  return (x, y, z) => {
    const h = Math.sin(x * 0.61 + y * 1.3 + k * 2.1) + Math.sin(z * 0.83 - y * 0.7 + k) + Math.sin((x + z) * 0.37 - k * 1.7);
    if (h > 2.0) return bruise;
    if (Math.abs(Math.sin(x * 0.9 + k * 3) * 4 + Math.sin(y * 0.5 + z * 0.4) * 3 - z * 0.6) < 0.22) return vein;
    return raw[Math.abs(Math.floor(h * 1.4 + 8)) % 4];
  };
};
const SUITS = ['#2f2c2f', '#3c3530', '#27303a', '#3a3a34'];

/**
 * A length of it: a pair of hips, in what is left of the trousers, belted, and joined to the next pair along the top by a
 * ridge of flesh with a spine in it. On the ridge, pressed out from underneath, the face of whoever this length was. It has
 * no front and no back. It goes along +z; its middle is at the origin.
 */
export function backVox(k = 0) {
  const v = new Vox(), skin = skinOf(k), dark = M(DARK, 0), wet = M(WET, 2), bone = M(BONE, 0), cloth = M(SUITS[k % 4], 1), crease = M('#1b1a1c', 1), belt = M('#2a211c', 1), buckle = M('#9a8f6a', 0), shirt = M(['#cdbf9c', '#8c97ab', '#b9c2ad'][k % 3], 1), tooth = M('#e6dcc0', 0);
  // the hips: a seat of trouser, wide, and under it nothing that should be there
  v.ellipsoid(0, -2, 0, 9, 5, 6, (x) => (x === 0 ? crease : cloth));
  v.ellipsoid(-6, -2, 0, 4, 4, 5, cloth); v.ellipsoid(6, -2, 0, 4, 4, 5, cloth);
  // the belt, done up, and a tail of shirt that never got tucked in
  for (let x = -9; x <= 9; x++) for (let z = -6; z <= 6; z++) { const d = (x / 9.3) ** 2 + (z / 6.3) ** 2; if (d <= 1 && d > 0.62) { v.set(x, 2, z, belt); v.set(x, 3, z, belt); } }
  v.box(8, 2, -1, 9, 3, 1, buckle);
  for (let z = -4; z <= 3; z++) { const n = 2 + ((z + k + 9) % 3); for (let y = 0; y < n; y++) v.set(k % 2 ? -9 : 9, 1 - y, z + (k % 2 ? 0 : 1), shirt); }
  // above the belt there is no more of them: the flesh closes over, and runs on to the next
  v.ellipsoid(0, 5, 0, 7, 3, 7, skin); v.ellipsoid(0, 6, 0, 4.5, 3.5, 8.5, skin);
  for (let z = -8; z <= 8; z += 3) v.box(-1 + (k % 2), 9, z, (k % 2), 10, z, bone);
  // the face: the two hollows, a nose, and a mouth that is open and has its teeth. Not all of them look the same way up
  const fx = k % 3 === 0 ? -2 : k % 3 === 1 ? 2 : 0, flip = k % 2 ? -1 : 1;
  for (const ex of [-2, 2]) { v.box(fx + ex - 1, 8, flip * 3, fx + ex, 9, flip * 3, dark); v.set(fx + ex, 8, flip * 2, wet); }
  v.box(fx - 2, 8, flip * -3 - 1, fx + 2, 9, flip * -3 + 1, dark); for (const tx of [-2, 0, 2]) v.set(fx + tx, 9, flip * -3 + 1, tooth); for (const tx of [-1, 1]) v.set(fx + tx, 9, flip * -3 - 1, tooth);
  // and it drips, underneath, between the legs
  for (let n = 0; n < 5; n++) { const x = -5 + n * 2 + (k % 2), z = ((n * 3 + k) % 7) - 3, len = 2 + ((n + k) % 4); for (let y = 0; y < len; y++) v.set(x, -7 - y, z, y === len - 1 ? wet : skin(x, y, z)); }
  return v;
}

/** A thigh, in the trouser: long, and carried straight out sideways. Along +y from the hip at y 0. (k: whose suit.) */
export function thighVox(k = 0) {
  const v = new Vox(), cloth = M(SUITS[k % 4], 1), crease = M('#1b1a1c', 1), skin = skinOf(k + 30);
  v.cyl('y', 0, 0, 0, THIGH, 3.3, (x, y, z) => (x === 0 && z > 0 ? crease : cloth), 2.7);
  v.ellipsoid(0, 0, 0, 3.8, 2.6, 3.8, skin);                                         // where it goes into the back, there is no trouser
  v.ellipsoid(0, THIGH, 0, 3.1, 2.4, 3.1, cloth);                                    // the knee
  if (k % 3 === 0) v.ellipsoid(2, 9, 1, 1.9, 2.4, 1.9, skin);                        // a tear
  if (k % 2) v.ellipsoid(-2, 15, 0, 1.6, 2, 1.6, skin);
  return v;
}
/** A shin, and at the end of it an office shoe, laced, pointing along +z. Along +y from the knee at y 0, so the sole is at the top of it. */
export function shinVox(k = 0) {
  const v = new Vox(), cloth = M(SUITS[k % 4], 1), sock = M(k % 2 ? '#6d1f24' : '#23303f', 1), shoe = M('#1a1614', 0), sole = M('#0d0b0a', 0), lace = M('#6b6258', 0);
  v.cyl('y', 0, 0, 0, SHIN - 2, 2.7, cloth, 2.4); v.cyl('y', 0, 0, SHIN - 2, SHIN, 2, sock);
  v.box(-2, SHIN, -3, 2, SHIN + 2, 6, shoe); v.ellipsoid(0, SHIN + 1, 6, 2.4, 1.6, 2.4, shoe); v.box(-2, SHIN + 3, -3, 2, SHIN + 3, 7, sole);
  for (const z of [1, 3]) v.box(-1, SHIN - 1, z, 1, SHIN - 1, z, lace);
  return v;
}
/** A tie: what it has where feelers would be. It hangs along +y from the knot at y 0 (it is swung about by whoever holds it). */
export function tieVox(k = 0) {
  const v = new Vox(), silk = M(['#7d1f27', '#1f3b6b', '#3d5a2c', '#5a2c58'][k % 4], 1), stripe = M('#d8cfae', 0);
  v.box(-1, 0, 0, 1, 2, 0, silk);
  for (let y = 2; y < 22; y++) { const w = y < 15 ? 1 : 2; for (let x = -w; x <= w; x++) v.set(x, y, 0, (y + x) % 5 === 0 ? stripe : silk); }
  v.set(0, 22, 0, silk); v.set(-1, 22, 0, silk); v.set(1, 22, 0, silk); v.set(0, 23, 0, silk);
  return v;
}
