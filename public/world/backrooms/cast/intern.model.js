// The Backrooms — what the intern is made of (cast/intern.js): its long back,
// its neck, and its head. Its arms and hands are head count's, and its legs
// the standing meeting's: it is the same stuff. Voxels and nothing else.
import { Vox, M } from '../../vox/vox.js';

export const S = 0.03;
export const BACK = 34;            // voxels from its hips to its shoulders: half as long again as a back is
export const NECK = 13;

const RAW = ['#b4756a', '#a5645b', '#c48a7d', '#8f5148'], BRUISE = '#5e3540', VEIN = '#4a2a3c', WET = '#7a2630', DARK = '#12070a', BONE = '#e2d8bd';
const skinOf = (k = 0) => {
  const raw = RAW.map((c) => M(c, 2)), bruise = M(BRUISE, 2), vein = M(VEIN, 2);
  return (x, y, z) => {
    const h = Math.sin(x * 0.61 + y * 1.3 + k * 2.1) + Math.sin(z * 0.83 - y * 0.7 + k) + Math.sin((x + z) * 0.37 - k * 1.7);
    if (h > 2.05) return bruise;
    if (Math.abs(Math.sin(x * 0.9 + k * 3) * 4 + Math.sin(y * 0.5 + z * 0.4) * 3 - z * 0.6) < 0.2) return vein;
    return raw[Math.abs(Math.floor(h * 1.4 + 8)) % 4];
  };
};

/**
 * Its back, in the shirt it came in on its first day: from the hips (y 0) to the shoulders (y BACK), along +y. The shirt has
 * not kept up with it: it has ridden up and split, and the spine stands out through the split in a row, too many of it. The
 * belly side is -z (which, the way it carries itself, is underneath).
 */
export function backVox() {
  const v = new Vox(), skin = skinOf(3), shirt = [0, -1, 1].map((d) => M(['#d8d3c2', '#c9c4b2', '#e2ddcc'][d + 1], 1)), sweat = M('#a59f86', 1), seep = M('#6a2a2c', 1), bone = M(BONE, 0), dark = M(DARK, 0), belt = M('#2a211c', 1), trouser = M('#2f2c2f', 1);
  const cloth = (x, y, z) => { const h = Math.sin(x * 0.5) + Math.sin(z * 0.34 + y * 0.6) + Math.sin((x - z) * 0.21 + y * 0.2); return h > 1.9 ? skin(x, y, z) : h > 1.5 ? seep : h < -1.75 ? sweat : shirt[Math.abs(x + (y >> 1)) % 3]; };
  for (let y = 0; y <= BACK; y++) {
    const k = y / BACK, w = 6.5 + Math.sin(k * Math.PI) * 1.2 + (k > 0.8 ? (k - 0.8) * 14 : 0), d = 4.4 + Math.sin(k * Math.PI) * 0.8;      // narrow, and then the shoulders
    for (let x = -Math.ceil(w); x <= Math.ceil(w); x++) for (let z = -Math.ceil(d); z <= Math.ceil(d); z++) if ((x / w) ** 2 + (z / d) ** 2 <= 1) v.set(x, y, z, y < 4 ? trouser : y < 6 ? belt : y < 10 ? skin(x, y, z) : cloth(x, y, z));
  }
  // the split, up the back of it (+z), and what stands out of it
  for (let y = 7; y <= BACK - 2; y++) { const w = 1 + Math.round(Math.abs(Math.sin(y * 0.5)) * 1.4); for (let x = -w; x <= w; x++) { v.set(x, y, 5, skin(x, y, 5)); v.set(x, y, 4, skin(x, y, 4)); } if (y % 2 === 0) { v.box(-1, y, 5, 0, y, 7, bone); v.set(0, y, 8, bone); } }
  // ribs, where the shirt has ridden up
  for (let y = 11; y <= 23; y += 3) for (const sx of [-1, 1]) v.tube(sx * 2, y, 4, sx * 6.5, y - 2, -1, 0.6, bone);
  // its name, on a sticker, where a pocket would be: it was never given a real badge
  v.box(2, BACK - 9, -5, 6, BACK - 6, -5, M('#e9e4d2', 0)); v.box(2, BACK - 6, -5, 6, BACK - 6, -5, M('#b23a3a', 0)); v.box(3, BACK - 8, -5, 5, BACK - 8, -5, dark);
  v.ellipsoid(-8.5, BACK - 1, 0, 3.2, 3, 3.6, skin); v.ellipsoid(8.5, BACK - 1, 0, 3.2, 3, 3.6, skin);        // the shoulders, bare: the sleeves went long ago
  return v;
}

/** Its neck: longer than it should be, and it has been turned further than one turns. Along +y from the shoulders at y 0. */
export function neckVox() {
  const v = new Vox(), skin = skinOf(8), wet = M(WET, 2), bone = M(BONE, 0);
  v.cyl('y', 0, 0, 0, NECK, 2.6, skin, 2.1);
  for (let y = 1; y < NECK; y++) { const a = y * 0.55; v.set(Math.round(Math.cos(a) * 2.6), y, Math.round(Math.sin(a) * 2.6), wet); if (y % 3 === 0) v.set(Math.round(Math.cos(a + 3) * 2.4), y, Math.round(Math.sin(a + 3) * 2.4), bone); }   // the twist in it
  return v;
}

/**
 * Its head, the right way up (it is hung the other way): somebody young, who is pleased to be here. The eyes are where eyes
 * go and are open as far as eyes open, and there is nothing in them. The smile is the one it came in with, and it has not
 * been able to stop. Its hair has been combed. The face is on +z; the neck joins underneath, at the origin.
 */
export function headVox() {
  const v = new Vox(), skin = skinOf(12), pale = M('#d2a89a', 2), dark = M(DARK, 0), wet = M(WET, 2), tooth = M('#efe7d2', 0), gum = M('#8a2a35', 2), hair = M('#3a2a20', 1), hairL = M('#4a372a', 1);
  v.ellipsoid(0, 9, 0, 7.5, 9, 7.5, (x, y, z) => (z > 3 ? pale : skin(x, y, z)));
  v.ellipsoid(0, 3, 1, 5.5, 4, 6, pale);                                                    // the jaw
  // hair: combed, a side parting, and it hangs (which, the way it is carried, is toward the floor)
  for (let x = -8; x <= 8; x++) for (let z = -8; z <= 5; z++) for (let y = 13; y <= 19; y++) if (((x / 8) ** 2 + ((y - 9) / 9.6) ** 2 + (z / 8) ** 2) <= 1.08 && ((x / 7.5) ** 2 + ((y - 9) / 9) ** 2 + (z / 7.5) ** 2) > 0.92) v.set(x, y, z, (x + z) % 3 ? hair : hairL);
  for (let n = 0; n < 16; n++) { const a = n * 0.42 + 0.3, r = 6.5, x = Math.cos(a) * r, z = Math.sin(a) * r - 1, len = 5 + (n % 5); if (z < 4) v.tube(x, 17, z, x * 1.08, 17 + len, z * 1.08, 0.6, n % 2 ? hair : hairL); }
  // the eyes: wide, round, empty, and one of them a little lower
  for (const [cx, cy] of [[-3.5, 11], [3.5, 10]]) { for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) if (x * x + y * y <= 5) { const X = Math.round(cx + x), Y = cy + y; for (let z = 4; z <= 8; z++) if (v.has(X, Y, z)) v.set(X, Y, z, z < 6 ? dark : 0); } for (let a = 0; a < 10; a++) { const X = Math.round(cx + Math.cos(a * 0.63) * 2.8), Y = Math.round(cy + Math.sin(a * 0.63) * 2.8); for (let z = 8; z >= 4; z--) if (v.has(X, Y, z)) { v.set(X, Y, z, a % 3 ? pale : wet); break; } } }
  // the smile: all the way across, held, and every tooth of it showing, and more behind
  for (let x = -5; x <= 5; x++) { const y = 4 + Math.round((x * x) / 9); for (let z = 3; z <= 8; z++) for (const dy of [0, -1]) if (v.has(x, y + dy, z)) v.set(x, y + dy, z, z < 5 ? dark : 0); let zf = 8; while (zf > 2 && !v.has(x, y + 1, zf)) zf--; if (v.has(x, y + 1, zf)) v.set(x, y + 1, zf, gum); if (x % 2 === 0) { v.set(x, y, 5, tooth); v.set(x, y - 1, 5, tooth); } else v.set(x, y, 4, tooth); }
  v.set(-6, 6, 5, gum); v.set(6, 6, 5, gum);
  v.box(-1, 7, 7, 0, 9, 7, pale);                                                           // a nose, small
  return v;
}
