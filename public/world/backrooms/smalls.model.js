// The Backrooms — the small things an office leaves standing about, sculpted. Pure: voxels in, voxels out.
// The office keeps its own (props/): down here the bin and the trolley are the level's, at half-size voxels
// (1.25 cm): place with `scale: SMALLS.scale`.
//
// Each is exactly the size of the office's (SMALLS.bounds is twice the office's numbers), so that it stands where
// that stood and is solid where that was.
import { Vox, M, tone, noise3 } from '../vox/vox.js';

const B6 = (x0, y0, z0, x1, y1, z1) => Object.freeze({ x0, y0, z0, x1, y1, z1 });
export const SMALLS = Object.freeze({
  scale: 0.5,
  bounds: Object.freeze({
    bin: B6(-20, 0, -20, 20, 46, 20),
    trolley: B6(-30, 2, -20, 30, 76, 20),
  }),
});

const box = (v) => (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);
const paint = (v) => (x0, y0, z0, x1, y1, z1, c) => v.paint(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);

/* ---- the bin ------------------------------------------------------------------------------------- */

const ARROWS = [                       // the three arrows chasing each other, as on the office's
  '..........####..........', '.........######.........', '........###..###........', '.......###....###.......', '......###......###......',
  '.....###........########', '...............########.', '................######..', '....##...........####...', '...####.................',
  '..######..............##', '.########............###', '...##.....#############.', '...##....#############..', '...##.....###########...',
];

/** A recycling bin: a moulded body, a lid a little proud of it with a swing flap stuck half open, and what did not go in. */
export function binVox({ colour = '#3f6fae' } = {}) {
  const v = new Vox(), b = box(v), p = paint(v);
  const blue = M(colour, 0), dark = M(tone(colour, -0.3), 0), lite = M(tone(colour, 0.22), 0), white = M('#f1ead8', 0), black = M('#1c1d21', 0), scuff = M(tone(colour, -0.14), 0);
  v.rbox(-18, 0, -18, 18, 34, 18, 8, blue, 'xz');
  p(-18, 0, -18, 17, 3, 17, dark);
  for (const x of [-18, 17]) for (let y = 4; y < 30; y++) for (let z = -9; z <= 8; z += 6) v.has(x, y, z) && v.set(x, y, z, scuff);      // the ribs it was moulded with
  for (let x = -18; x <= 17; x++) for (let z = -18; z <= 17; z++) for (let y = 4; y < 9; y++) if (v.has(x, y, z) && noise3(x >> 1, y, z >> 1, 31) > 0.83) v.set(x, y, z, scuff);
  v.rbox(-20, 32, -20, 20, 40, 20, 8, dark, 'xz');                                                    // the lid
  v.carve(-12, 36, -12, 12, 40, 12); p(-12, 34, -12, 11, 35, 11, black);
  b(-12, 38, -12, 11, 39, -3, lite); b(-12, 36, -2, 11, 37, 1, lite);                                 // the flap, and where it has stuck
  b(-14, 38, -2, -13, 39, 1, white); b(12, 38, -2, 13, 39, 1, white);
  ARROWS.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') { const x = -12 + i, y = 29 - j; for (let z = 19; z >= 10; z--) if (v.has(x, y, z)) { v.set(x, y, z, white); break; } } });
  for (const x of [-18, 17]) p(x, 24, -6, x, 27, 5, black);                                           // somewhere to lift it by
  // the sheet somebody balled up and did not push through, and a smaller one
  v.ellipsoid(3, 41, 7, 5, 5, 5, (x, y, z) => (((x * 3 + y * 5 + z * 7) % 4 + 4) % 4 === 0 ? M('#cfc8b6', 0) : white));
  v.ellipsoid(-7, 39, 7, 3.4, 3.4, 3.4, M('#ded7c5', 0));
  return v;
}

/* ---- the trolley --------------------------------------------------------------------------------- */

/** A two-shelf trolley on castors: steel posts, trays with a rail down each long side, a push bar at one end, three things left on top. */
export function trolleyVox() {
  const v = new Vox(), b = box(v);
  const steel = M('#747c76', 0), bright = M('#8d958f', 0), dark = M('#333a37', 0), rubber = M('#212320', 0), cream = M('#b5ac91', 0), worn = M('#a29a80', 0), left = M('#888168', 0);
  for (const x of [-26, 24]) for (const z of [-16, 14]) {
    b(x - 1, 8, z - 1, x + 2, 59, z + 2, steel); b(x, 8, z, x, 59, z, bright);                          // a post, and the light down its corner
    b(x - 3, 2, z, x + 4, 9, z + 1, rubber); b(x - 2, 3, z, x + 3, 8, z + 1, M('#2c2e2b', 0));           // the wheel …
    b(x, 5, z - 1, x + 1, 6, z + 2, bright);                                                             // … its axle
    b(x - 1, 9, z - 2, x + 2, 12, z - 1, dark); b(x - 1, 9, z + 2, x + 2, 12, z + 3, dark);             // … the fork it swivels in
  }
  for (const y of [14, 56]) {
    b(-30, y, -20, 29, y + 3, 19, dark);                                                                 // the tray
    b(-28, y + 3, -18, 27, y + 3, 17, cream);
    for (let x = -26; x < 26; x += 3) for (let z = -16; z < 16; z += 2) if (noise3(x, y, z, 37) > 0.78) b(x, y + 3, z, x + 2, y + 3, z, worn);
    for (const z of [-20, 19]) { b(-30, y + 4, z, 29, y + 5, z, steel); b(-30, y + 5, z, 29, y + 5, z, bright); }
    for (const x of [-30, 29]) b(x, y + 4, -20, x, y + 4, 19, steel);
  }
  for (const z of [-16, 14]) b(24, 60, z - 1, 27, 73, z + 2, steel);                                     // the push bar's two uprights
  b(24, 70, -16, 29, 75, 15, dark); b(25, 75, -14, 28, 75, 13, M('#454d49', 0));
  for (const [x, z] of [[-20, 8], [-6, -16], [14, 14]]) b(x, 60, z, x + 7, 61, z + 1, left);            // what was left on it
  return v;
}
