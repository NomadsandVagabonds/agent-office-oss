// The Mailroom — the dispatch desk and the breech on it, sculpted. Pure: voxels in, voxels out.
//
// The desk is exactly the outer box of the three blocks it was: 1.2 m by 0.96 m, 0.92 m high (MAILDESK.desk.size),
// in 96 × 74 × 76 voxels: place with MAILDESK.desk.scale, which is a shade off a half each way so that the box comes
// out to the millimetre. Its top is dead flat over the whole of it: canisters stand there, and the breech. The face
// to +z is where the room hangs its dial (0.66 m by 0.29 m, its middle 0.52 m up): that face is left on its plane
// behind the dial and a frame stands round it. The breech is the two blocks it was: 0.26 m square, 0.15 m high, the
// throat down its middle. Nothing here is solid, nothing shines; the room keeps its own solid, shadow and dial.
import { Vox, M, tone, noise3 } from '../../../vox/vox.js';

const VOXEL = 0.025;                                   // the kit's (vox.js): a model placed at scale 1 has voxels this big
const fit = (metres, voxels) => metres / voxels / VOXEL;
export const MAILDESK = Object.freeze({
  desk: Object.freeze({ size: Object.freeze([1.2, 0.92, 0.96]), voxels: Object.freeze([96, 74, 76]), scale: Object.freeze([fit(1.2, 96), fit(0.92, 74), fit(0.96, 76)]) }),
  breech: Object.freeze({ size: Object.freeze([0.26, 0.15, 0.26]), voxels: Object.freeze([20, 12, 20]), scale: Object.freeze([fit(0.26, 20), fit(0.15, 12), fit(0.26, 20)]) }),
});

const ENAMEL = '#243830';
const box = (v) => (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);

/** @param {string} brass the room's brass, a hex colour */
export function deskVox(brass = '#c49a45') {
  const v = new Vox(), b = box(v);
  const enamel = M(ENAMEL, 0), seam = M(tone(ENAMEL, -0.3), 0), chip = M('#5d6a62', 0), br = M(brass, 0), brL = M(tone(brass, 0.14), 0), brD = M(tone(brass, -0.38), 0), black = M('#15171a', 0);
  // the plinth, the body set in from it, the brass top over both
  b(-48, 0, -38, 47, 6, 37, brD);
  b(-45, 7, -35, 44, 68, 34, enamel);
  b(-48, 69, -38, 47, 73, 37, br);
  // the top: flat. Its edge has a bead and a rivet every hand's breadth; on the surface only colour — where canisters are slid across it
  for (const z of [-38, 37]) { b(-48, 71, z, 47, 71, z, brL); for (let x = -44; x <= 44; x += 8) v.set(x, 70, z, brD); }
  for (const x of [-48, 47]) { b(x, 71, -38, x, 71, 37, brL); for (let z = -34; z <= 34; z += 8) v.set(x, 70, z, brD); }
  for (let x = -40; x < 40; x += 4) for (let z = -30; z < 30; z += 3) if (noise3(x >> 2, 9, z >> 1, 17) > 0.8) b(x, 73, z, x + 3, 73, z, brL);
  // the plinth is where feet and trolleys find it
  for (let x = -48; x <= 47; x++) for (const z of [-38, 37]) for (let y = 0; y < 5; y++) if (noise3(x >> 1, y, z, 23) > 0.8) v.set(x, y, z, M(tone(brass, -0.55), 0));
  b(-48, 6, -38, 47, 6, 37, M(tone(brass, -0.22), 0));
  // the body: enamelled panels with a seam between them, chipped along the bottom
  for (const z of [-35, 34]) for (const x of [-16, 15]) b(x, 8, z, x, 67, z, seam);
  for (const x of [-45, 44]) b(x, 8, 0, x, 67, 0, seam);
  for (let x = -45; x <= 44; x++) for (const z of [-35, 34]) if (noise3(x >> 1, 2, z, 29) > 0.74) v.set(x, 7 + (noise3(x, 5, z, 3) > 0.5 ? 1 : 0), z, chip);
  // the face to the room (+z): a brass frame for the dial, standing proud; the face behind the dial is the face
  b(-29, 28, 35, 28, 29, 35, br); b(-29, 54, 35, 28, 55, 35, br); b(-29, 28, 35, -28, 55, 35, br); b(27, 28, 35, 28, 55, 35, br);
  for (const [x, y] of [[-29, 28], [28, 28], [-29, 55], [28, 55]]) v.set(x, y, 35, brD);
  b(-38, 14, 35, -33, 20, 35, brD); v.set(-36, 17, 35, black);                                         // a key switch, low to the left
  // the clerk's side (−z): a door on two hinges with a pull, and a row of louvres under it
  b(-13, 22, -36, 12, 62, -36, M(tone(ENAMEL, 0.08), 0));
  for (const y of [28, 56]) b(-15, y, -36, -14, y + 3, -36, br);
  b(8, 40, -37, 9, 46, -37, br);
  for (let y = 10; y <= 16; y += 2) b(-10, y, -36, 9, y, -36, black);
  // one end: the plate where the air comes in, four bolts, and the stub of the pipe
  b(45, 30, -8, 45, 46, 7, br); for (const [y, z] of [[31, -7], [31, 6], [45, -7], [45, 6]]) v.set(45, y, z, brD);
  b(45, 35, -3, 46, 41, 2, brD);
  return v;
}

/** The breech: a brass block on a flange, a rim round the mouth, the throat dark down its middle. */
export function breechVox(brass = '#c49a45') {
  const v = new Vox(), b = box(v), br = M(brass, 0), brL = M(tone(brass, 0.16), 0), brD = M(tone(brass, -0.38), 0), dark = M('#212125', 0);
  b(-10, 0, -10, 9, 10, 9, br);
  b(-10, 0, -10, 9, 1, 9, brD);                                                                         // the flange it is bolted down by
  for (const [x, z] of [[-9, -9], [8, -9], [-9, 8], [8, 8]]) v.set(x, 2, z, brL);
  b(-10, 10, -10, 9, 10, 9, brL);                                                                       // the rim
  b(-7, 10, -7, 6, 11, 6, dark);                                                                        // the mouth, where the dark block was: 0.18 m square
  v.carve(-5, 9, -5, 5, 12, 5);
  b(-5, 8, -5, 4, 8, 4, M('#0c0c0e', 0));
  for (const x of [-10, 9]) b(x, 4, -3, x, 6, 2, brD);                                                  // a catch each side
  return v;
}
