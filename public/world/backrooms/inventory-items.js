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
function paper() {
  const v = new Vox(), edge = M('#b8b19a', 1), sheet = M('#d8d1b9', 1), top = M('#ece5ce', 1), crease = M('#c4bda5', 1);
  // Slightly misaligned sheets, with the top corner curling away from the stack.
  v.box(-7, 0, -8, 7, 1, 9, edge);
  v.box(-6, 1, -9, 8, 2, 8, sheet);
  v.box(-7, 2, -9, 7, 3, 9, top);
  v.box(-7, 2, -8, -6, 3, 8, sheet);
  v.carve(4, 2, 6, 7, 3, 9);
  v.box(3, 2, 5, 7, 3, 6, crease);
  v.box(3, 3, 6, 7, 4, 7, sheet);
  v.box(4, 3, 7, 7, 4, 8, top);
  v.box(5, 4, 7, 7, 5, 9, top);
  v.box(5, 4, 8, 7, 5, 9, sheet);
  return v;
}
function scissors() {
  const v = new Vox(), red = M('#9e4339', 1), edge = M('#c06850', 1), steel = M('#929d98', 0), bright = M('#c9cfbb', 0), dark = M('#535e58', 1);
  // Open finger loops and two stepped blades keep the silhouette readable on carpet.
  for (const x of [-7, 1]) {
    v.rbox(x, 0, 2, x + 6, 2, 9, 1, red, 'xz');
    v.carve(x + 2, 0, 4, x + 4, 2, 7);
    v.box(x + 1, 1, 3, x + 2, 2, 7, edge);
  }
  v.box(-3, 0, 0, -1, 2, 4, red); v.box(1, 0, 0, 3, 2, 4, red);
  for (let z = 0; z < 10; z++) {
    const x = Math.floor(z / 2), width = z < 8 ? 2 : 1;
    v.box(x, 0, -z - 1, x + width, 1, -z, steel);
    v.box(-x - width, 1, -z - 1, -x, 2, -z, bright);
    if (z < 7) v.box(x + 1, 0, -z - 1, x + 2, 1, -z, dark);
  }
  v.box(-2, 0, -2, 2, 2, 2, steel);
  v.box(-1, 2, -1, 1, 3, 1, dark); v.box(-1, 2, -1, 0, 3, 0, bright);
  return v;
}
function snack() {
  const v = new Vox(), orange = M('#b77c49', 1), shadow = M('#875737', 1), fold = M('#d1a06a', 1), label = M('#dbd0a5', 1), ink = M('#63654a', 1);
  // A sealed, crumpled packet: pinched ends, a paper label and an uneven top seam.
  v.rbox(-5, 0, -6, 5, 4, 6, 1, orange);
  v.box(-4, 1, -8, 4, 3, -6, shadow); v.box(-4, 1, 6, 4, 3, 8, shadow);
  for (const x of [-4, -2, 0, 2]) {
    v.box(x, 2, -8, x + 1, 3, -6, fold);
    v.box(x, 2, 6, x + 1, 3, 8, fold);
  }
  v.box(-4, 3, -4, -3, 4, 4, fold); v.box(3, 3, -3, 4, 4, 5, shadow);
  v.paint(-3, 3, -3, 3, 4, 3, label);
  v.paint(-2, 3, -2, 2, 4, -1, ink); v.paint(-1, 3, 0, 1, 4, 2, ink);
  v.box(-1, 4, 4, 3, 5, 5, fold);
  return v;
}
function balloon() {
  const v = new Vox(), red = M('#ad423b', 1), shade = M('#87362f', 1), highlight = M('#d6755e', 0), cord = M('#c6bba1', 1);
  // The loose end of the string is the floor anchor; the balloon floats above it.
  for (let y = 0; y < 29; y++) {
    const x = Math.round(Math.sin(y / 7) * .8), previousX = Math.round(Math.sin(Math.max(0, y - 1) / 7) * .8);
    v.set(x, y, 0, cord); v.set(previousX, y, 0, cord);
  }
  v.box(-2, 28, -1, 2, 30, 1, shade); v.box(-1, 29, -1, 1, 32, 1, red);
  v.ellipsoid(0, 42, 0, 10, 13, 8, red);
  v.paint(5, 30, -8, 11, 43, 9, shade);
  v.paint(-7, 45, 4, -4, 50, 8, highlight);
  v.paint(-7, 46, 5, -6, 49, 8, M('#dfa086', 0));
  return v;
}
/** FORM HR-404: one pink sheet, a heading bar, three ruled lines, a box for the signature nobody gave. */
function pinkSlip() {
  const v = new Vox(), pink = M('#e7a3b4', 1), dark = M('#b8697f', 1), ink = M('#4a2f3a', 0);
  v.box(-6, 0, -8, 6, 1, 8, pink); v.box(-6, 0, -8, -5, 1, 8, dark);
  v.box(-4, 1, -7, 5, 2, -5, ink);
  for (const z of [-3, -1, 1]) v.box(-4, 1, z, 4, 2, z + 1, dark);
  v.box(1, 1, 4, 5, 2, 7, dark); v.carve(2, 1, 5, 4, 2, 6);
  v.box(5, 1, 6, 6, 2, 8, pink);                                        // a corner that will not lie flat
  return v;
}
export const INVENTORY_MODELS = Object.freeze({ torch, battery, chalk, paper, scissors, snack, balloon, 'pink-slip': pinkSlip });
