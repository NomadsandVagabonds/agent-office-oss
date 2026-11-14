// The Office — the fuel stand: four glass tanks on a panelled board, one per
// provider, showing how much each has left. The sculpture is empty glass and
// brass; scene/dynamics.js pours the liquid and writes the plates, from the
// daemon's usage feed (server/usage.mjs).
import { Vox, M, glass, tone } from '../vox/vox.js';

/** Where the live parts go, in voxels from the prop's origin (floor, centre). */
export const FUELSTAND = {
  tanks: [-19.5, -6.5, 6.5, 19.5],              // the axis of each tank
  y0: 13, y1: 49, r: 3.4,                       // the inside of the glass, and how wide the liquid is
  plaque: { y: 4.5, z: 10.06, w: 11, h: 4 },    // the name, on the plinth under each tank
  readout: { y: 59.5, z: -3.94, w: 11, h: 5 },  // the figure, on the board above each tank
  lamp: { y: 55.6, r: 1.3 },                    // the warning lamp on each cap
};

export function fuelstand() {
  const v = new Vox();
  const wood = M('#4d382a', 2), woodD = tone(wood, -0.28), brass = M('#c8a048', 0), brassD = tone(brass, -0.32);
  const enamel = M('#1f4239', 0), cream = M('#efe6cf', 0), ink = M('#221f1a', 0), tube = glass('#cfe6ea');
  // plinth
  v.rbox(-29, 0, -10, 29, 8, 9, 1, wood, 'xz');
  v.box(-29, 0, -10, 29, 1, 9, woodD);
  v.box(-28, 8, -9, 28, 9, 8, brassD);                                   // a brass sill the tanks stand on
  // the board behind
  v.box(-29, 8, -10, 29, 66, -6, wood);
  v.box(-27, 10, -6, 27, 64, -5, enamel);
  v.box(-29, 66, -10, 29, 68, -5, woodD);
  v.box(-30, 68, -10, 30, 69, -4, brass);                                // cornice
  for (const x of FUELSTAND.tanks) {
    v.cyl('y', x, 0, 9, 11, 5.7, brass); v.cyl('y', x, 0, 11, 13, 5, brassD);        // seat
    v.cyl('y', x, 0, 13, 49, 4.7, tube); v.cyl('y', x, 0, 13, 49, 3.7, 0);           // the glass, hollow
    v.cyl('y', x, 0, 49, 51, 5, brassD); v.cyl('y', x, 0, 51, 53, 5.7, brass);       // cap
    v.cyl('y', x, 0, 53, 55, 2.2, brassD);                                            // lamp holder
    v.box(x - 1, 50, -6, x + 1, 52, -4, brassD);                                      // the pipe back into the board
    v.box(x + 6, 13, -5, x + 8, 49, -4, cream);                                       // a scale beside the glass…
    for (let k = 0; k <= 4; k++) { const y = Math.min(48, 13 + k * 9); v.box(x + (k % 2 ? 7 : 6), y, -5, x + 8, y + 1, -4, ink); }   // …quarters marked
    v.box(x - 6, 2, 9, x + 6, 7, 10, brass);                                          // name plate
    v.box(x - 6, 57, -5, x + 6, 62, -4, ink);                                         // figure plate
  }
  return v;
}

export const CATALOGUE = {
  fuelstand: { make: () => fuelstand() },
};
