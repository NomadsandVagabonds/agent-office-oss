// Scranton Paper Co. — the furniture has survived three corporate rebrands.
// 40 voxels = 1 metre. Floor at y=0; the useful/front side faces +z.
// Standalone desktop pieces start at y=0 so the floor can pick them up.
import { Vox, M, glow, glass, tone } from '../vox/vox.js';
import { crt, keyboard, mouse } from '../props/office.js';

const OAK = M('#93683f', 2), EDGE = M('#b39160', 2), WALNUT = M('#59402c', 2);
const LAMINATE = M('#c6b894', 0), CREAM = M('#d9d1b9', 0), PAPER = M('#f3edde', 0);
const INK = M('#2b3031', 0), STEEL = M('#8e9392', 0), BRASS = M('#c69f4b', 0);
const TEAL = M('#406f72', 0), RED = M('#9f4539', 0);

function sheets(v, x, y, z, w = 10, d = 13, height = 3) {
  v.box(x, y, z, x + w, y + height, z + d, PAPER);
  // A ruled top sheet and one folded-over corner, rather than noise everywhere.
  v.box(x + 2, y + height - 1, z + 3, x + w - 2, y + height, z + 4, M('#aab6b3', 0));
  v.box(x + 2, y + height - 1, z + 6, x + w - 3, y + height, z + 7, M('#c7cbbb', 0));
  v.set(x + w - 1, y + height, z, CREAM);
}

function mug(v, x, y, z, color = CREAM) {
  v.cyl('y', x, z, y, y + 6, 2.8, color);
  v.cyl('y', x, z, y + 5, y + 6, 1.8, M('#47301c', 0));
  v.ring(x + 3, y + 3, z, 2.2, 0.7, color, 'z');
  // An unreasonably large label on a very ordinary mug.
  v.box(x - 2, y + 2, z + 2, x + 2, y + 4, z + 3, PAPER);
}

function phone(v, x, y, z, color = INK) {
  v.rbox(x - 6, y, z - 4, x + 6, y + 3, z + 5, 1, color);
  v.box(x - 3, y + 3, z - 3, x + 3, y + 4, z - 1, M('#8b9d81', 0));
  for (let ix = -2; ix <= 2; ix += 2) for (let iz = 0; iz <= 2; iz++) v.set(x + ix, y + 3, z + iz, CREAM);
  v.rbox(x - 7, y + 3, z - 5, x - 4, y + 6, z + 5, 1, tone(color, 0.12));
  v.box(x - 8, y + 1, z + 3, x - 7, y + 2, z + 8, color);
  v.box(x - 8, y, z + 7, x - 2, y + 1, z + 8, color);
}

function nameplate(v, x, y, z, accent = BRASS) {
  v.box(x - 7, y, z, x + 7, y + 1, z + 4, INK);
  v.box(x - 6, y + 1, z + 2, x + 6, y + 4, z + 3, accent);
  v.box(x - 4, y + 2, z + 3, x + 4, y + 3, z + 4, WALNUT);
}

function drawers(v, x0, x1, z0, z1, height = 24) {
  v.box(x0, 2, z0, x1, height, z1, WALNUT);
  for (let y = 3; y < height - 3; y += 7) {
    v.box(x0 + 1, y, z1, x1 - 1, y + 6, z1 + 1, OAK);
    const mid = Math.floor((x0 + x1) / 2);
    v.box(mid - 3, y + 3, z1 + 1, mid + 3, y + 4, z1 + 2, STEEL);
  }
}

/** 120 × 49 × 48. Visitors stand on +z; a low staff worktop is behind the counter. */
export function receptionDesk() {
  const v = new Vox();
  // Long frontage plus a return on the left; the receptionist's knee well stays open.
  v.box(-58, 2, 14, 58, 39, 20, OAK);
  v.box(-58, 2, -22, -52, 39, 14, OAK);
  v.box(-59, 0, 13, 59, 3, 21, WALNUT);
  v.box(-59, 0, -23, -51, 3, 13, WALNUT);
  v.box(-60, 39, 11, 60, 42, 24, EDGE);
  v.box(-60, 39, -24, -49, 42, 11, EDGE);
  v.box(-52, 25, -20, 57, 27, 14, LAMINATE);
  v.box(52, 2, -20, 56, 25, 14, WALNUT);
  drawers(v, 29, 50, -19, 10);
  // Four flat veneered panels. Painted rails keep this long frontage cheap to mesh.
  for (let x = -53; x < 50; x += 28) {
    v.paint(x, 8, 19, x + 22, 31, 20, EDGE);
    v.paint(x + 2, 10, 19, x + 20, 29, 20, OAK);
  }
  v.paint(34, 4, 19, 43, 5, 20, tone(OAK, -0.25));
  // A bell, a clipped visitor sheet and a pencil cup on the public ledge.
  v.cyl('y', 35, 17, 42, 43, 4.5, INK);
  v.ellipsoid(35, 43, 17, 3.6, 2.3, 3.6, BRASS);
  v.box(34, 45, 16, 36, 47, 18, STEEL);
  sheets(v, -20, 42, 12, 14, 10, 1);
  v.box(-18, 43, 12, -10, 44, 13, STEEL);
  v.cyl('y', -39, 17, 42, 47, 2.7, TEAL);
  for (const [x, z, h] of [[-40, 17, 49], [-38, 16, 48]]) v.box(x, 46, z, x + 1, h, z + 1, M('#d4a442', 0));
  // Staff monitor is low enough to be visible above, but not dwarf, the frontage.
  const monitor = crt();
  monitor.paint(-7, 7, 7, 7, 18, 8, M('#536c64', 0));
  v.stamp(monitor.turned(2), -13, 27, -8);
  v.stamp(keyboard().turned(2), -13, 27, -18);
  phone(v, 13, 27, -9, CREAM);
  return v;
}

/** 60 × 46 × 40. Salesperson sits at +z, facing the screen. No chair included. */
export function salesDesk({ variant = 0 } = {}) {
  const v = new Vox(), n = ((Math.trunc(variant) % 4) + 4) % 4;
  v.box(-30, 24, -20, 30, 26, 20, LAMINATE);
  v.box(-30, 23, -20, 30, 24, 20, EDGE);
  v.box(-28, 1, -18, -26, 23, 18, WALNUT);
  v.box(26, 1, -18, 28, 23, 18, WALNUT);
  for (const x of [-28, 26]) v.box(x, 0, -18, x + 2, 1, 18, INK);
  v.box(-26, 8, -18, 26, 23, -16, OAK);
  drawers(v, 13, 26, -14, 14, 23);
  const monitor = crt({ color: n === 2 ? '#c3c0ac' : '#d9d1b9' });
  monitor.paint(-7, 7, 7, 7, 18, 8, M(['#536d6a', '#42695b', '#526578', '#5f6d54'][n], 0));
  monitor.box(-5, 15, 8, 4, 16, 9, glow('#b6cbae'));
  monitor.box(-5, 12, 8, 1, 13, 9, M('#9bb69b', 0));
  monitor.box(-5, 9, 8, 5, 10, 9, M('#779387', 0));
  v.stamp(monitor, -3, 26, -7);
  v.stamp(keyboard(), -3, 26, 11);
  v.stamp(mouse(), 13, 26, 11);
  phone(v, -21, 26, -10, n === 1 ? CREAM : INK);
  sheets(v, 16, 26, -13, 10, 12, n === 2 ? 5 : 3);
  mug(v, -23, 26, 8, [TEAL, CREAM, RED, M('#79723d', 0)][n]);
  nameplate(v, 20, 26, 15);
  // Variant one: the meticulously aligned desk of a security enthusiast.
  if (n === 1) {
    v.box(-13, 26, 16, -8, 27, 17, M('#c9a447', 0));
    v.box(-13, 26, 18, -8, 27, 19, M('#c9a447', 0));
    v.box(-28, 26, 15, -26, 28, 18, RED);
  } else if (n === 3) {
    // A sticky-note moat around an otherwise very serious spreadsheet.
    v.box(4, 43, 1, 8, 46, 2, M('#e7cf69', 0));
    v.box(-11, 35, 1, -8, 39, 2, M('#dbb2ba', 0));
  }
  return v;
}

/** 84 × 47 × 50. Executive laminate, two visitor-side pedestals, a tiny award. */
export function managerDesk() {
  const v = new Vox();
  v.box(-42, 24, -25, 42, 27, 25, OAK);
  v.box(-42, 26, -25, 42, 27, 25, EDGE);
  v.box(-39, 0, -22, -21, 24, 22, WALNUT);
  v.box(21, 0, -22, 39, 24, 22, WALNUT);
  v.box(-21, 8, -21, 21, 23, -19, OAK);
  drawers(v, -38, -22, -18, 20, 24);
  drawers(v, 22, 38, -18, 20, 24);
  v.box(-18, 27, 2, 18, 28, 23, M('#405447', 0));             // green blotter
  const monitor = crt();
  monitor.paint(-7, 7, 7, 7, 18, 8, M('#526e7a', 0));
  v.stamp(monitor, 16, 27, -13);
  v.stamp(keyboard(), 16, 27, 3);
  phone(v, -29, 27, -10, CREAM);
  mug(v, -28, 27, 11, PAPER);
  nameplate(v, -5, 27, 20, BRASS);
  sheets(v, 27, 27, 7, 11, 13, 3);
  v.stamp(trophy(), -8, 27, -15);
  return v;
}

/** A black stapler; gelatin variant is in a wobbly amber dome on a white plate. */
export function stapler({ gelatin = false } = {}) {
  const v = new Vox(), base = gelatin ? 5 : 0;
  if (gelatin) {
    v.cyl('y', 0, 0, 0, 2, 13, PAPER);
    v.cyl('y', 0, 0, 2, 3, 11.5, M('#e2b649', 0));
    v.cyl('y', 0, 0, 3, 12, 11, glass('#e9b63b'), 8);
    v.ellipsoid(0, 11, 0, 8, 4, 8, glass('#f1ca54'));
    // A pale molded ridge around the bottom makes the dome read at room scale.
    v.ring(0, 3, 0, 10, 0.7, M('#e2b649', 0));
  }
  v.rbox(-3, base, -8, 3, base + 2, 8, 1, INK);
  v.box(-2, base + 2, -7, 2, base + 3, 7, STEEL);
  v.rbox(-3, base + 3, -7, 3, base + 6, 7, 1, INK);
  v.box(-2, base + 5, -6, 2, base + 6, 5, M('#4b5050', 0));
  v.box(-2, base + 2, 6, 2, base + 3, 8, M('#c4c7bf', 0));
  return v;
}

/** A countertop kit: bowl, packet, measuring jug and a conspicuously yellow spoon. 36 × 18 × 26. */
export function gelatinKit() {
  const v = new Vox();
  // Tray keeps the ingredients together and makes the whole kit easy to pick out.
  v.rbox(-18, 0, -13, 18, 2, 13, 2, M('#ddd4bf', 0), 'xz');
  v.cyl('y', -5, 1, 2, 10, 5, M('#8aa8a7', 0), 9);
  v.cyl('y', -5, 1, 8, 10, 7.2, M('#dfa43e', 0));
  v.ring(-5, 10, 1, 8.3, 0.7, CREAM);
  v.tube(-7, 8, 1, 1, 18, -3, 0.8, M('#dab955', 0));
  // Packet: green stripe, red fruit, cream label. One can infer the instructions.
  v.box(7, 2, -10, 15, 14, -6, PAPER);
  v.box(7, 10, -6, 15, 14, -5, M('#829948', 0));
  v.box(8, 7, -6, 14, 9, -5, RED);
  v.sphere(11, 5, -5, 2, M('#b95837', 0));
  // Transparent measuring jug on the other side of the tray.
  v.cyl('y', 11, 7, 2, 11, 3.5, glass('#c7dfda'));
  v.cyl('y', 11, 7, 2, 5, 2.8, glass('#89b8b3'));
  v.ring(15, 7, 7, 2.6, 0.8, CREAM, 'z');
  for (const y of [5, 7, 9]) v.box(10, y, 10, 13, y + 1, 11, M('#799692', 0));
  return v;
}

/** 48 × 49 × 42. A wheeled copier with an output tray, crooked original, and red jam light. */
export function copier() {
  const v = new Vox();
  for (const x of [-18, 17]) for (const z of [-15, 14]) v.rbox(x - 2, 0, z - 2, x + 2, 4, z + 2, 1, INK);
  v.box(-22, 4, -18, 22, 33, 18, CREAM);
  v.box(-23, 31, -19, 23, 35, 19, tone(CREAM, -0.18));
  for (let y = 7; y < 28; y += 9) {
    v.box(-20, y, 18, 20, y + 8, 19, M('#c8c6b8', 0));
    v.box(-6, y + 4, 19, 6, y + 6, 20, INK);
    v.box(12, y + 2, 19, 18, y + 4, 20, PAPER);
  }
  // Scanner bed and chunky hinged lid; a sheet sticks out on the right.
  v.box(-19, 35, -16, 19, 37, 14, INK);
  v.box(-17, 37, -14, 17, 38, 12, glass('#7eada3'));
  v.box(-20, 38, -17, 20, 41, 12, M('#c7c8b9', 0));
  v.box(-20, 40, -17, 20, 41, 12, CREAM);
  v.box(18, 37, -10, 24, 38, 5, PAPER);
  // A paper feeder above, with just one imperfect stack.
  v.box(-16, 41, -14, 13, 44, 8, M('#b5b8ab', 0));
  sheets(v, -13, 44, -11, 23, 16, 3);
  v.box(-17, 47, -12, -15, 49, 5, CREAM);
  // Control strip faces the visitor, a red warning at the very end.
  v.box(-21, 35, 14, 21, 38, 21, CREAM);
  v.box(-17, 38, 15, -3, 39, 20, glow('#7eaa83'));
  for (let x = 2; x <= 10; x += 4) for (let z = 15; z <= 18; z += 3) v.box(x, 38, z, x + 2, 39, z + 2, STEEL);
  v.box(15, 38, 16, 19, 40, 20, RED);
  v.set(19, 38, 14, glow('#ec8e51'));
  // Side output tray and a sheet that never quite arrived.
  v.box(-24, 24, -8, -21, 26, 12, INK);
  v.box(-24, 26, -5, -20, 27, 10, PAPER);
  return v;
}

/** Three cartons and loose reams, 52 × 38 × 38. Packaging carries blue bands. */
export function paperStack() {
  const v = new Vox();
  const card = M('#bda474', 2), tape = M('#dbc8a0', 0), blue = M('#3f6b8c', 0);
  function carton(x, y, z, w = 25, d = 31, h = 17) {
    v.box(x, y, z, x + w, y + h, z + d, card);
    v.box(x - 1, y + h - 3, z - 1, x + w + 1, y + h, z + d + 1, tone(card, 0.15));
    v.box(x + 10, y + h - 1, z - 1, x + 14, y + h, z + d + 1, tape);
    v.box(x + 3, y + 5, z + d, x + w - 3, y + 12, z + d + 1, PAPER);
    v.box(x + 3, y + 10, z + d + 1, x + w - 3, y + 12, z + d + 2, blue);
    v.box(x + 6, y + 7, z + d + 1, x + w - 6, y + 8, z + d + 2, tone(card, -0.25));
    v.box(x + 8, y + h - 8, z - 1, x + w - 8, y + h - 5, z, INK);
  }
  carton(-25, 0, -17, 24, 31, 17);
  carton(1, 0, -15, 23, 30, 17);
  carton(-12, 17, -17, 25, 31, 17);
  v.box(5, 17, 17, 24, 22, 21, PAPER);
  v.box(5, 20, 17, 24, 22, 21, blue);
  v.box(-8, 34, -8, 10, 38, 10, PAPER);
  v.box(-8, 34, -8, 10, 35, 10, blue);
  return v;
}

/** A small golden office worker holding a tiny paper rectangle. 14 × 19 × 12. */
export function trophy() {
  const v = new Vox();
  v.rbox(-7, 0, -6, 7, 3, 6, 1, WALNUT);
  v.box(-5, 1, 6, 5, 3, 7, BRASS);
  v.box(-3, 3, -2, -1, 9, 1, BRASS);
  v.box(1, 3, -2, 3, 9, 1, BRASS);
  v.box(-4, 8, -2, 4, 14, 2, BRASS);
  v.sphere(0, 16, 0, 2.7, tone(BRASS, 0.16));
  v.tube(-4, 12, 0, -5, 8, 3, 1, BRASS);
  v.tube(4, 12, 0, 6, 13, 3, 1, BRASS);
  v.box(4, 13, 3, 8, 17, 4, tone(BRASS, 0.28));
  return v;
}

/** Twin fluorescent troffer, 80 × 5 × 20. Mount at ceiling height; underside glows. */
export function ceilingLight() {
  const v = new Vox();
  v.box(-40, 2, -10, 40, 5, 10, M('#abae9f', 0));
  v.box(-39, 1, -9, 39, 3, 9, CREAM);
  v.box(-37, 0, -7, 37, 2, -3, glow('#f4f0d5'));
  v.box(-37, 0, 3, 37, 2, 7, glow('#f4f0d5'));
  v.box(-40, 0, -10, -37, 3, 10, CREAM);
  v.box(37, 0, -10, 40, 3, 10, CREAM);
  for (const x of [-20, 0, 20]) v.box(x, 0, -9, x + 1, 1, 9, M('#b6b7a8', 0));
  return v;
}

// Kept local to this level; the shared office prop catalogue stays untouched.
export const CATALOGUE = {
  reception: { make: receptionDesk },
  salesdesk: { make: salesDesk, variant: (o) => String(o.variant || 0) },
  managerdesk: { make: managerDesk },
  stapler: { make: stapler },
  gelatin: { make: () => stapler({ gelatin: true }) },
  gelatinkit: { make: gelatinKit },
  copier: { make: copier },
  paperstack: { make: paperStack },
  trophy: { make: trophy },
  fluorescent: { make: ceilingLight },
};
