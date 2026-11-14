// Small, grounded objects made in the same 2.5cm voxel grid as the office.
import { Vox, M } from '../vox/vox.js';

function torch() {
  const v = new Vox(), rubber = M('#343832', 2), yellow = M('#bca151', 1), edge = M('#d4bc76', 1);
  const metal = M('#939b8c', 1), lens = M('#dbdfca', 0);
  // A heavy plastic torch lying along z. Its broad front rim rests on the floor.
  v.rbox(-3, 1, -5, 3, 6, 8, 1, yellow, 'xy');
  v.rbox(-4, 0, -9, 4, 7, -4, 1, rubber, 'xy');
  v.rbox(-3, 1, -10, 3, 6, -9, 1, metal, 'xy');
  v.box(-2, 2, -11, 2, 5, -10, lens);
  v.box(-3, 1, 7, 3, 6, 9, rubber);
  for (const z of [-2, 1, 4]) v.box(-3, 1, z, 3, 2, z + 1, rubber);
  v.box(-1, 6, -1, 2, 7, 2, rubber); v.box(-1, 6, 0, 1, 7, 1, metal);
  v.box(2, 4, 2, 3, 5, 5, edge); v.box(-3, 3, 5, -2, 4, 7, edge);
  v.box(-2, 6, -4, -1, 7, -2, edge);
  return v;
}
function battery() {
  const v = new Vox(), green = M('#73815d', 1), sleeve = M('#c8c2a0', 2), cell = M('#3b443b', 1), metal = M('#a9b1a3', 0);
  for (const x of [-3, 1]) {
    v.rbox(x, 0, -5, x + 3, 3, 5, 1, cell, 'xy');
    v.box(x, 0, -4, x + 3, 3, 2, green);
    v.box(x, 0, -5, x + 3, 3, -4, metal);
    v.box(x + 1, 1, -6, x + 2, 2, -5, metal);
    v.box(x, 3, -2, x + 3, 4, 0, sleeve);
    v.box(x + 1, 3, -3, x + 2, 4, 1, sleeve);
  }
  v.box(-3, 0, 2, 4, 4, 4, sleeve); v.box(-2, 4, 2, 3, 5, 3, green);
  return v;
}
function chalk() {
  const v = new Vox(), white = M('#e1dcc1', 3), paper = M('#99967b', 2), blue = M('#657e7d', 1);
  v.rbox(-2, 0, -5, 2, 4, 6, 1, white, 'xy');
  v.box(-2, 0, 0, 2, 4, 5, paper);
  v.box(-2, 3, 1, 2, 4, 3, blue); v.box(-2, 1, 1, -1, 3, 3, blue);
  v.carve(1, 3, -5, 2, 4, -3); v.box(-1, 3, -4, 1, 4, -2, M('#f1ead5', 1));
  return v;
}
export const INVENTORY_MODELS = Object.freeze({ torch, battery, chalk });
