// A scuffed office AV trolley: the same 2.5cm voxel scale as the desks.
import { Vox, M, tone } from '../vox/vox.js';

export function trolley() {
  const v = new Vox(), steel = M('#747c76'), dark = M('#333a37'), rubber = M('#212320'), cream = M('#b5ac91');
  for (const x of [-13, 12]) for (const z of [-8, 7]) {
    v.box(x - 1, 3, z - 1, x + 1, 30, z + 1, steel);
    v.box(x - 2, 1, z - 2, x + 2, 5, z + 2, rubber);
    v.box(x - 1, 3, z - 2, x + 1, 6, z + 2, dark);
  }
  for (const y of [7, 28]) {
    v.box(-15, y, -10, 15, y + 2, 10, dark);
    v.box(-14, y + 1, -9, 14, y + 2, 9, cream);
    for (const z of [-10, 9]) v.box(-15, y + 2, z, 15, y + 3, z + 1, steel);
  }
  for (const z of [-8, 7]) v.box(12, 29, z - 1, 14, 37, z + 1, steel);
  v.box(12, 35, -8, 14, 38, 8, dark);
  for (const [x, z] of [[-10, 4], [-3, -8], [7, 7]]) v.box(x, 29, z, x + 4, 30, z + 1, tone(cream, -.25));
  return v;
}

/** A plainly visible bolted foot for furniture authored into moving scenery. */
export function fixedFurnitureFoot() {
  const v = new Vox(), steel = M('#626c69'), dark = M('#303936'), bolt = M('#9a9585');
  v.box(-4, 0, -4, 4, 1, 4, steel);
  v.box(-1, 1, -3, 1, 7, 3, dark);
  for (const x of [-3, 2]) for (const z of [-3, 2]) v.box(x, 1, z, x + 1, 3, z + 1, bolt);
  return v;
}
