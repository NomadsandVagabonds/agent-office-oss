// The All-Hands — the lectern, sculpted. Pure: voxels in, voxels out.
// Half-size voxels (1.25 cm): place with `scale: LECTERN.scale`. It is exactly the size of the five boxes it was
// (LECTERN.bounds is twice their 22 × 46 × 16), so it is solid where they were; and the microphone's head is where
// their microphone's was (LECTERN.mic), because the room lights that spot and speaks from it. Whoever speaks stands
// on the −z side; the hall is to +z. Nothing on it shines.
import { Vox, M, tone, noise3 } from '../../../vox/vox.js';

export const LECTERN = Object.freeze({
  scale: 0.5,
  bounds: Object.freeze({ x0: -22, y0: 0, z0: -16, x1: 22, y1: 92, z1: 16 }),
  mic: Object.freeze({ x0: -2, y0: 88, z0: -8, x1: 2, y1: 92, z1: -4 }),          // the head: where the old one's was, doubled
});

const PUTTY = '#58564c', DARK = '#262624', MIC = '#16171a', FOAM = '#34363c';

export function lecternVox() {
  const v = new Vox();
  const b = (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);
  const putty = M(PUTTY, 0), edge = M(tone(PUTTY, 0.14), 0), under = M(tone(PUTTY, -0.2), 0), dark = M(DARK, 0), weld = M('#3a3a36', 0), black = M(MIC, 0), bare = M('#77766c', 0);
  // the foot: a steel plate on four levelling feet, its corners knocked bright by whatever has been wheeled past
  b(-20, 1, -14, 19, 3, 13, dark);
  for (const [x, z] of [[-19, -13], [17, -13], [-19, 11], [17, 11]]) b(x, 0, z, x + 1, 0, z + 1, black);
  for (const [x, z] of [[-20, -14], [19, -14], [-20, 13], [19, 13]]) v.set(x, 3, z, bare);
  for (const [x, z] of [[-16, -10], [15, -10], [-16, 9], [15, 9]]) v.set(x, 3, z, weld);          // the bolts that hold it to the stage
  // the column: a folded steel box welded to the plate, a gusset each side, an access panel facing the hall
  b(-6, 4, -6, 5, 65, 5, dark);
  for (let k = 0; k < 5; k++) { b(-7 - k, 4, -1, -7 - k, 8 - k, 0, weld); b(6 + k, 4, -1, 6 + k, 8 - k, 0, weld); }
  b(-4, 12, 6, 3, 44, 6, weld); for (const [x, y] of [[-4, 12], [3, 12], [-4, 44], [3, 44]]) v.set(x, y, 6, bare);
  for (let y = 16; y <= 24; y += 2) b(-2, y, 6, 1, y, 6, black);                                     // the slots a fan once blew through
  // the desk: a tray that slopes toward whoever reads from it, a lip along the low edge to stop the pages, a dark underside
  for (let z = -16; z <= 15; z++) {
    const top = 68 + Math.floor((z + 16) / 6);                                                        // 68 at the reader's edge … 73 at the hall's
    b(-22, 66, z, 21, top, z, putty); v.box(-22, 66, z, 22, 67, z + 1, under);
    b(-22, top, z, -22, top, z, edge); b(21, top, z, 21, top, z, edge);
  }
  b(-22, 69, -16, 21, 70, -16, edge);                                                                 // the lip
  b(-22, 66, 15, 21, 73, 15, putty); b(-22, 73, 15, 21, 73, 15, edge);
  for (let x = -20; x < 20; x++) if (noise3(x >> 1, 3, 1, 21) > 0.72) v.set(x, 70, -16, bare);     // hands have had the paint off it
  // where a reading lamp was clamped, and is not: a paler patch the shape of its foot, and the two holes
  b(12, 72, 9, 18, 72, 13, M(tone(PUTTY, 0.07), 0)); v.set(13, 72, 11, black); v.set(17, 72, 11, black);
  // the microphone: a mount on the desk, a gooseneck bent toward the mouth, a foam head. The wire goes through a hole and down the column
  b(-2, 71, -1, 1, 73, 2, black);
  const neck = [[74, 0], [76, 0], [78, -2], [80, -2], [82, -4], [84, -4], [86, -6]];                   // (y, z) of the old stalk's cells, doubled
  for (const [y, z] of neck) for (let k = 0; k < 2; k++) b(-1, y + k, z + (k && z < 0 ? 0 : 0), 0, y + k, z + 1, (y + k) % 2 ? black : M('#2a2c30', 0));
  b(-2, 88, -8, 1, 91, -5, M(FOAM, 0));
  for (const x of [-2, 1]) for (const y of [88, 91]) for (const z of [-8, -5]) v.carve(x, y, z, x + 1, y + 1, z + 1);   // a ball, as near as four voxels go
  b(-1, 86, -7, 0, 87, -6, black);                                                                    // the collar under it
  v.set(3, 72, 3, black); b(3, 66, 3, 3, 71, 3, black);
  b(3, 8, -7, 3, 65, -7, black); for (const y of [20, 40, 60]) b(2, y, -7, 4, y, -7, weld);          // clipped down the reader's side
  b(3, 4, -9, 3, 7, -7, black); b(1, 4, -11, 5, 4, -9, black); v.carve(2, 4, -10, 5, 5, -9);          // and the slack, left in a loop on the plate
  return v;
}
/** (for whoever places it and has only the function in hand) */
lecternVox.scale = LECTERN.scale;
