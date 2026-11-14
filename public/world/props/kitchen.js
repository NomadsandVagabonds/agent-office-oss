// The Office — the kitchen, where everybody ends up sooner or later.
//
// Same rules as office.js: every prop is a function that returns a Vox, in
// 2.5 cm voxels, floor at y = 0, centred on x = z = 0, FRONT facing +z. The
// worktop is 30 voxels up (people are 52). The coffee machine is a prop of its
// own — the floor plan stands it on the counter — so somebody can be walked
// up to it; the counter keeps a clear stretch for it (see COUNTER_COFFEE).
//
// A break room, mid-1990s: honey wood under speckled laminate, mint and cream
// enamel, chrome handles, and always one or two things somebody left out.
// Quads are spent where they show: long creases cost two quads per voxel of
// length, so the cupboards are one flat plane with painted seams and only the
// handles, the worktop's lip and what stands on it are real relief.
import { Vox, M, glow, glass, tone, mix } from '../vox/vox.js';
import { hashId } from '/core/look.mjs';

const WOOD = '#9a6a3c', WOOD_DARK = '#6b4a2f', CREAM = '#cfc6b0', STEEL = '#8a8f96', BLACK = '#2b2b30';
const CHROME = '#c3c9d1', PAPER = '#f1ead8', COFFEE = '#3a2414', RED = '#c0463a', BLUE = '#3f7f9a';

// Which of n variants a layout object gets. FNV's low bits hardly differ between ids that end alike
// (stool:2.4,-4.6 / stool:4,-4.6), so the stools round one table would all match — take higher bits.
const pick = (o, n) => (hashId(String(o?.id || o?.type || '')) >>> 6) % n;

/**
 * Draw a small picture, one character per voxel: rows run top to bottom, `key` maps characters to colours.
 * It starts at (x, yTop, z) and runs along +x; pass (dx, dz) = (0, 1) or (0, -1) to lay it on a side face instead.
 */
function sprite(v, x, yTop, z, rows, key, dx = 1, dz = 0) {
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (key[row[i]]) v.set(x + i * dx, yTop - j, z + i * dz, key[row[i]]); });
}

// Pictures for sprite(), top row first.
const RECYCLE = [
  '.....##.....',
  '....####....',
  '...##..##...',
  '..##....##..',
  '.##...######',
  '.......####.',
  '..#.....##..',
  '.###........',
  '#####.....##',
  '.#...######.',
  '.....#####..',
];
const BISCUIT = [                                              // the vending machine's logo: one bite gone
  '...ccccc...',
  '..ccccccc..',
  '.ccckcccc..',
  'cccccccc...',
  'ccccccc....',
  'cckcccccc..',
  'cccccckccc.',
  '.ccccccccc.',
  '..ccckccc..',
  '...ccccc...',
];
const MENU = ['rrrrrrr', 'rrrrrrr', 'ppppppp', 'pgggggp', 'ppppppp', 'pggggpp', 'ppppppp', 'pgggggp', 'ppppppp', 'pgggppp', 'ppppppp'];
const FONT = {                                                 // 4 × 5 capitals, as many as the brand needs
  B: ['###.', '#..#', '###.', '#..#', '###.'], Y: ['#..#', '#..#', '.##.', '.##.', '.##.'], T: ['####', '.##.', '.##.', '.##.', '.##.'],
  E: ['####', '#...', '###.', '#...', '####'], S: ['.###', '#...', '.##.', '...#', '###.'],
};

/** A slab with rounded vertical edges. (rbox clamps its radius to half the height, so a thin lid cannot be as round as the box under it.) */
function slab(v, x0, y0, z0, x1, y1, z1, r, color) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2 - r, hz = (z1 - z0) / 2 - r;
  return v.box(x0, y0, z0, x1, y1, z1, (x, y, z) => {
    const qx = Math.max(Math.abs(x + 0.5 - cx) - hx, 0), qz = Math.max(Math.abs(z + 0.5 - cz) - hz, 0);
    return qx * qx + qz * qz <= r * r + 0.3 ? color : 0;
  });
}

/** A mug of coffee standing on y, centred on the voxel (x, z) — the one people carry around, set down. `side` (±1) is where the handle points. */
function mug(v, x, y, z, color = '#cf6b4b', side = 1) {
  const c = M(color, 0);
  v.cyl('y', x + 0.5, z + 0.5, y, y + 5, 2.3, c);
  v.carve(x - 1, y + 4, z - 1, x + 2, y + 5, z + 2);
  v.paint(x - 2, y + 4, z - 2, x + 3, y + 5, z + 3, tone(c, 0.25));
  v.box(x - 1, y + 3, z - 1, x + 2, y + 4, z + 2, M(COFFEE, 0));
  v.box(x + 3 * side, y + 1, z, x + 3 * side + 1, y + 4, z + 1, c);
}

/** A drink can standing on y; (x, z) is the corner its 4 × 4 footprint is centred on. */
function can(v, x, y, z, color) {
  const c = M(color, 0), tin = M('#c9ced6', 0);
  v.cyl('y', x, z, y, y + 6, 2.05, c);
  v.paint(x - 2, y, z - 2, x + 2, y + 1, z + 2, tin);
  v.paint(x - 2, y + 5, z - 2, x + 2, y + 6, z + 2, tin);
  v.paint(x - 2, y + 3, z - 2, x + 2, y + 4, z + 2, tone(c, 0.35));
  v.set(x - 1, y + 5, z, M('#7d838c', 0));                     // the ring pull
}

/* ---- the counter -------------------------------------------------------------- */

/** Worktop height in voxels. */
export const COUNTER_H = 30;
/** Where the coffee machine stands, in voxels from the counter's origin; the worktop is bare from x = −62 to −34 around it. */
export const COUNTER_COFFEE = Object.freeze([-48, COUNTER_H, 0]);

/** A two-slice toaster with the toast up; the lever is on its right. 13 × 10 × 8. */
function toaster() {
  const v = new Vox();
  const tin = M('#b9bfc7', 0), toast = M('#d9a55f', 2), k = M(BLACK, 0);
  for (const x of [-5, 4]) for (const z of [-3, 2]) v.set(x, 0, z, k);
  v.rbox(-6, 1, -4, 6, 8, 4, 2, tin, 'xy');
  v.paint(-6, 1, -4, 6, 2, 4, k);
  for (const z of [-2, 1]) {
    v.box(-4, 7, z, 4, 8, z + 1, k);                           // slot
    v.box(-3, 6, z, 3, 10, z + 1, toast); v.paint(-3, 9, z, 3, 10, z + 1, M('#a8703a', 2));
  }
  v.box(6, 4, -1, 7, 6, 1, k);                                 // lever
  v.box(-1, 3, 3, 1, 5, 4, k); v.set(3, 3, 3, glow('#ff7a3c'));          // dial, and it is on
  return v;
}

/** A cream microwave, door facing +z, with a pizza box left on top. 26 × 17 × 16. */
function microwave() {
  const v = new Vox();
  const body = M(CREAM, 0), trim = tone(body, -0.16), k = M(BLACK, 0);
  for (const x of [-12, 11]) for (const z of [-7, 5]) v.set(x, 0, z, k);
  v.box(-13, 1, -8, 13, 15, 7, body);
  v.box(-12, 2, 6, 7, 14, 7, trim);                            // door
  v.box(-10, 4, 6, 5, 12, 7, M('#1c2224', 0));                 // window
  v.box(6, 4, 7, 7, 12, 8, k);                                 // handle
  v.box(8, 11, 6, 12, 14, 7, k); v.box(9, 12, 6, 12, 13, 7, glow('#7fe0a0'));        // clock
  for (const y of [5, 7, 9]) for (const x of [9, 11]) v.set(x, y, 6, trim);
  v.box(9, 2, 6, 12, 4, 7, tone(body, -0.3));
  for (const x of [-10, -8, -6]) v.box(x, 14, -6, x + 1, 15, 0, trim);               // vents
  v.box(-9, 4, -8, 9, 12, -7, trim);                           // …and the grille at the back
  v.box(-2, 15, -7, 10, 17, 5, M(PAPER, 1));                   // the pizza box, with the pizzeria's stamp
  v.paint(-2, 15, -7, 10, 16, 5, M('#d9cdb0', 1));
  v.box(1, 16, -4, 7, 17, 2, M(RED, 1)); v.box(2, 16, -3, 6, 17, 1, M(PAPER, 1));
  for (const x of [1, 6]) for (const z of [-4, 1]) v.set(x, 16, z, M(PAPER, 1));
  return v;
}

/** A wooden bowl of fruit. 11 × 7 × 11, centred on the voxel (0, 0). */
function fruitbowl() {
  const v = new Vox();
  const bowl = M(WOOD_DARK, 2), banana = M('#e8c84a', 1);
  v.cyl('y', 0.5, 0.5, 0, 1, 1.6, tone(bowl, -0.2));
  v.cyl('y', 0.5, 0.5, 1, 4, 5.3, bowl);
  v.paint(-6, 3, -6, 7, 4, 7, tone(bowl, 0.14));
  v.sphere(-1.5, 4.5, -1.5, 1.6, M('#e08a2c', 1));
  v.sphere(2.5, 4.5, -0.5, 1.6, M('#c0392f', 1));
  v.sphere(0.5, 5.5, 2.5, 1.6, M('#8fb84a', 1));
  v.box(-4, 4, 3, -1, 5, 4, banana); v.box(-2, 5, 4, 3, 6, 5, banana); v.box(2, 4, 3, 5, 5, 4, banana);
  return v;
}

/** A wire dish rack on four feet: three plates and two tumblers left to dry. 13 × 13 × 18. */
function dishrack() {
  const v = new Vox();
  const wire = M('#4a6fa8', 0), white = M('#e9e4d6', 0);
  v.box(-6, 1, -9, 7, 2, 9, wire);
  v.box(-6, 4, -9, 7, 5, 9, wire); v.carve(-5, 4, -8, 6, 5, 8);
  for (const x of [-6, 6]) for (const z of [-9, 8]) v.box(x, 0, z, x + 1, 4, z + 1, wire);
  for (const [z, r, c] of [[-6, 5.3, white], [-3, 5.3, white], [0, 4.3, M('#d9c9a0', 0)]]) {
    v.cyl('z', 0.5, 2 + Math.floor(r) + 0.5, z, z + 1, r, c);
    if (z === 0) v.cyl('z', 0.5, 2 + Math.floor(r) + 0.5, z, z + 1, r - 1.9, tone(c, -0.1));
  }
  for (const x of [-3, 2]) v.cyl('y', x + 0.5, 4.5, 2, 6, 1.6, glass('#cfe3e8'));
  return v;
}

/** The kitchen counter: cupboards, dishwasher and sink face +z, its back goes against the wall. 160 × 30 × 24, things on it reach 47. */
export function counter() {
  const v = new Vox();
  const H = COUNTER_H, Z = 10;                                 // Z: the layer the cupboard fronts are in
  const wood = M(WOOD, 2), door = tone(wood, 0.16), seam = tone(wood, -0.42), rout = tone(wood, -0.16);
  const top = M('#c2b8a0', 2), steel = M('#a9afb7', 0), chrome = M(CHROME, 0), k = M(BLACK, 0), white = M('#e9e4d6', 0);

  v.box(-80, 0, -12, 80, H - 3, Z + 1, wood);                  // carcass
  v.box(-80, 3, Z, 80, H - 3, Z + 1, seam);                    // …the dark between the fronts
  v.box(-80, 0, -12, 80, 3, Z + 1, M('#3b3531', 1));           // …and a plinth
  v.box(-78, 5, -12, 78, H - 5, -11, M('#b0895a', 1));         // hardboard backs, for the wall to look at

  const pull = (x0, y0, x1, y1) => v.box(x0, y0, Z + 1, x1, y1, Z + 2, chrome);
  const cupboard = (x, w, hinge) => {                          // a panelled door, handle on the side away from the hinge
    v.box(x, 4, Z, x + w, 20, Z + 1, door);
    v.box(x + 3, 6, Z, x + w - 3, 18, Z + 1, rout);
    v.box(x + 4, 7, Z, x + w - 4, 17, Z + 1, wood);
    const hx = hinge < 0 ? x + w - 2 : x + 1;
    pull(hx, 14, hx + 1, 18);
  };
  const drawer = (x, w, y0, y1) => {
    v.box(x, y0, Z, x + w, y1, Z + 1, door);
    const m = x + (w >> 1);
    pull(m - 2, y1 - 3, m + 2, y1 - 2);
  };
  for (const [x, hinge] of [[-79, -1], [-60, 1], [-41, -1]]) { cupboard(x, 18, hinge); drawer(x, 18, 21, 26); }
  drawer(-22, 30, 4, 12); drawer(-22, 30, 13, 20); drawer(-22, 30, 21, 26);           // pan drawers
  cupboard(34, 15, -1); cupboard(50, 15, 1);                   // under the sink
  v.box(34, 21, Z, 49, 26, Z + 1, door); v.box(50, 21, Z, 65, 26, Z + 1, door);
  cupboard(66, 13, 1); drawer(66, 13, 21, 26);

  v.box(9, 4, Z, 33, 26, Z + 1, white);                        // dishwasher
  v.box(9, 21, Z, 33, 26, Z + 1, M('#4a4d55', 0));
  v.box(11, 5, Z, 31, 6, Z + 1, tone(white, -0.22));
  for (const x of [11, 13, 15]) v.set(x, 23, Z, M('#b9bec6', 0));
  v.box(19, 22, Z, 22, 25, Z + 1, M('#c9ccd0', 0));
  v.set(30, 23, Z, glow('#7fe0a0'));
  pull(13, 19, 29, 20);
  v.box(23, 12, Z + 1, 29, 21, Z + 2, M(RED, 3));              // a tea towel over its handle
  v.box(23, 14, Z + 1, 29, 15, Z + 2, M(PAPER, 3));

  v.box(-80, H - 3, -12, 80, H, 12, top);                      // worktop
  v.paint(-80, H - 2, 10, 80, H, 12, tone(top, 0.5));          // its lighter front edge
  v.paint(-80, H - 3, 11, 80, H - 2, 12, tone(top, -0.2));

  // the sink: one pressed-steel top with a bowl and a drainer
  v.paint(35, H - 1, -11, 79, H, 10, steel);
  v.box(37, H - 6, -7, 61, H, 9, steel);
  v.rbox(38, H - 5, -6, 60, H, 8, 2, 0, 'xz');
  v.paint(38, H - 6, -6, 60, H - 5, 8, tone(steel, -0.14));
  v.box(48, H - 6, 0, 50, H - 5, 2, k);                        // drain
  for (let z = -8; z < 9; z += 3) v.paint(63, H - 1, z, 78, H, z + 1, tone(steel, -0.14));
  v.box(48, H, -10, 52, H + 1, -7, chrome);                    // tap: a swan neck over the bowl
  v.box(49, H + 1, -10, 51, H + 10, -8, chrome);
  v.box(49, H + 8, -8, 51, H + 10, -1, chrome);
  v.box(49, H + 6, -3, 51, H + 8, -1, chrome);
  v.carve(49, H + 9, -10, 51, H + 10, -9); v.carve(49, H + 9, -2, 51, H + 10, -1);
  v.paint(49, H + 6, -3, 51, H + 7, -1, M(STEEL, 0));
  for (const [x, c] of [[45, BLUE], [53, RED]]) { v.box(x, H, -10, x + 2, H + 1, -8, chrome); v.box(x, H + 1, -10, x + 2, H + 2, -8, M(c, 0)); }
  mug(v, 42, H - 5, 3, '#5a6fa8');                             // and the mug nobody has washed up
  v.box(56, H, -10, 60, H + 1, -8, M('#e8c84a', 3)); v.box(56, H + 1, -10, 60, H + 2, -8, M('#4f8a4a', 3));     // sponge
  v.box(40, H, -10, 42, H + 4, -8, M('#6fb58a', 0)); v.set(40, H + 4, -9, white); v.box(40, H + 5, -9, 42, H + 6, -8, white);      // soap

  // what stands on it, left to right — and nothing at all from x = −62 to −34, where the coffee machine goes
  v.stamp(toaster(), -72, H, -2);
  for (const [x, z] of [[-64, 4], [-67, 5], [-65, 7]]) v.set(x, H - 1, z, M('#d9a55f', 2));                     // crumbs
  v.cyl('y', -28.5, -5.5, H, H + 7, 2.3, M('#7a4a2a', 0));     // the coffee tin
  v.paint(-31, H + 2, -8, -26, H + 5, -3, M('#e2c98f', 0)); v.paint(-31, H + 6, -8, -26, H + 7, -3, M(RED, 0));
  v.cyl('y', -21.5, -6.5, H, H + 5, 2.3, glass('#cfe3e8'));    // the sugar
  v.box(-23, H + 1, -8, -20, H + 4, -5, M(PAPER, 1));
  v.cyl('y', -21.5, -6.5, H + 5, H + 6, 2.3, M(BLUE, 0));
  const ring = mix(top, '#7a5230', 0.5);                       // a ring somebody left, and the spoon
  for (const [x, z] of [[-25, 4], [-24, 4], [-23, 4], [-26, 5], [-22, 5], [-26, 6], [-22, 6], [-26, 7], [-22, 7], [-25, 8], [-24, 8], [-23, 8]]) v.set(x, H - 1, z, ring);
  v.box(-19, H, 6, -15, H + 1, 7, chrome); v.box(-15, H, 5, -13, H + 1, 8, chrome);
  v.stamp(microwave(), 3, H, -3);
  v.stamp(fruitbowl(), 25, H, 0);
  v.stamp(dishrack(), 71, H, 0);
  return v;
}

/* ---- the coffee machine --------------------------------------------------------- */

/** The coffee machine, facing +z: a filter jug on the left, espresso and somebody's mug on the right. Its origin is its base. 16 × 20 × 14. */
export function coffeemachine() {
  const v = new Vox();
  const red = M(RED, 0), redD = tone(red, -0.26), chrome = M(CHROME, 0), steel = M(STEEL, 0), k = M(BLACK, 0), white = M(PAPER, 0);

  slab(v, -8, 0, -7, 8, 2, 7, 2, redD);                        // base
  v.rbox(-8, 2, -7, 8, 13, 5, 2, red, 'xz');                   // body…
  v.rbox(-8, 9, -7, 8, 17, 5, 2, red);                         // …with a rounded top
  v.carve(-8, 2, -1, 8, 11, 5);                                // the two bays under the head
  v.paint(-7, 2, -2, 7, 11, -1, chrome);                       // splash plate

  // left bay: the filter jug on its hot plate
  const JX = -2.5, JZ = 2.5;
  v.cyl('y', JX, JZ, 1, 2, 3.4, k);
  v.cyl('y', JX, JZ, 2, 8, 3.3, glass('#cfe3e8'));             // the jug…
  v.cyl('y', JX, JZ, 6, 8, 2.3, 0);
  v.paint(-6, 2, -1, 1, 6, 6, glass('#6b4326'));               // …amber where the coffee is,
  v.cyl('y', JX, JZ, 2, 6, 2.3, M(COFFEE, 0));                 // and half a pot left
  v.box(-5, 3, 5, -4, 6, 6, glass('#e6d2b8'));                 // a shine on the glass
  v.cyl('y', JX, JZ, 8, 9, 3.3, k);                            // collar
  v.box(-8, 3, 2, -7, 8, 4, k); v.box(-7, 7, 2, -6, 8, 4, k); v.box(-7, 3, 2, -6, 4, 4, k);        // handle
  v.cyl('y', JX, JZ, 9, 11, 2.4, M('#4a4d55', 0), 3.3);        // filter basket

  // right bay: drip tray, a mug under the spout
  v.paint(1, 1, -1, 8, 2, 7, chrome);
  for (const x of [2, 4, 6]) v.paint(x, 1, 0, x + 1, 2, 6, steel);
  mug(v, 4, 2, 2);
  v.cyl('y', 4.5, 2.5, 10, 11, 2.3, chrome);                   // group head
  v.cyl('y', 4.5, 2.5, 9, 10, 2.3, steel);                     // portafilter…
  v.set(4, 8, 2, steel);
  v.box(4, 9, 5, 5, 10, 7, k);                                 // …and its handle

  // the face: power light, buttons, a pressure gauge
  v.paint(-6, 12, 4, 6, 15, 5, chrome);
  v.box(-5, 12, 4, -3, 14, 5, glow('#ff5a1e'));
  v.set(-1, 13, 4, glow('#39d07a'));
  v.set(1, 13, 4, k); v.set(1, 12, 4, k);
  v.box(3, 12, 4, 6, 15, 5, white); v.set(4, 13, 4, k); v.set(5, 14, 4, M(RED, 0));

  // cups warming on top
  v.paint(-5, 16, -5, 5, 17, 3, chrome);
  v.box(-5, 17, -4, -2, 20, -1, white); v.paint(-5, 18, -4, -2, 19, -1, tone(white, -0.14)); v.set(-2, 18, -3, white);
  v.box(1, 17, -3, 4, 19, 0, white); v.set(4, 17, -2, white);

  // on its right side a note (whose turn it is to descale) and the water gauge; vents and a socket at the back
  v.paint(7, 12, -3, 8, 15, 0, M('#f2d45c', 0)); v.paint(7, 12, -1, 8, 13, 0, M('#c9a93a', 0));
  v.paint(7, 4, -5, 8, 10, -3, M('#bfe0ea', 0)); v.paint(7, 4, -5, 8, 7, -3, glow('#3f8fd0'));
  for (const y of [5, 7, 9]) v.paint(-4, y, -7, 4, y + 1, -6, redD);
  v.paint(4, 2, -7, 6, 3, -6, k);
  return v;
}

/* ---- the fridge ------------------------------------------------------------------- */

/** A rounded retro fridge, doors facing +z: freezer over the main door, chrome pulls, notes under magnets. 36 × 62 × 28, things on top reach 73. */
export function fridge(opt = {}) {
  const v = new Vox();
  const mint = M(opt.color || '#a9d2bf', 1), side = tone(mint, -0.1), deep = tone(mint, -0.42);
  const chrome = M(CHROME, 0), k = M(BLACK, 0), paper = M(PAPER, 0);
  const TOP = 62, SEAM = 46, F = 12, R = 5, RT = 4;            // F: the doors' front plane · R, RT: how round the corners and the top are

  for (const x of [-16, 13]) for (const z of [-13, 7]) v.box(x, 0, z, x + 3, 2, z + 3, k);
  v.box(-18, 2, -14, 18, TOP, F, (x, y, z) => {                // one moulded shell: round at the front and on top, square at the back
    const ax = Math.abs(x + 0.5), pz = z + 0.5, py = y + 0.5;
    const cx = Math.max(ax - (18 - R), 0), cz = Math.max(pz - (F - R), 0);
    if (cx * cx + cz * cz > R * R + 0.3) return 0;
    const tx = Math.max(ax - (18 - RT), 0), tz = Math.max(pz - (F - RT), 0), ty = Math.max(py - (TOP - RT), 0);
    if (ty > 0 && tx * tx + ty * ty + tz * tz > RT * RT + 0.3) return 0;
    return z < 7 ? side : z === 7 ? deep : mint;               // cabinet, gasket, doors
  });
  // the seam between freezer and fridge: cut one voxel deep, all round the doors
  const seam = [];
  v.each((x, y, z) => { if (y === SEAM && z >= 8 && (!v.has(x + 1, y, z) || !v.has(x - 1, y, z) || !v.has(x, y, z + 1))) seam.push([x, z]); });
  for (const [x, z] of seam) v.set(x, SEAM, z, 0);
  v.paint(-18, SEAM, 8, 18, SEAM + 1, F, deep);
  v.paint(-18, 2, 8, 18, 5, F, tone(k, 0.12));                 // kick plate
  v.paint(-12, 3, F - 1, 12, 4, F, tone(k, 0.4)); v.set(14, 3, F - 1, glow('#39d07a'));

  const pull = (y0, y1) => {                                   // a chrome bar standing off the door
    v.box(-15, y0, F + 1, -13, y1, F + 2, chrome);
    v.box(-15, y0 + 1, F, -13, y0 + 3, F + 1, chrome); v.box(-15, y1 - 3, F, -13, y1 - 1, F + 1, chrome);
  };
  pull(30, 45); pull(49, 58);
  v.box(3, 56, F - 1, 11, 58, F, chrome); v.set(12, 56, F - 1, M(RED, 0)); v.set(12, 57, F - 1, M(RED, 0));       // badge

  // stuck to the door
  const Zd = F - 1;
  v.box(1, 30, Zd, 8, 39, Zd + 1, paper);                      // the cleaning rota
  for (const y of [32, 34, 36]) v.box(2, y, Zd, y === 34 ? 6 : 7, y + 1, Zd + 1, M('#9aa3b0', 0));
  v.set(4, 38, Zd + 1, M(RED, 0));
  v.box(-8, 23, Zd, -3, 28, Zd + 1, M('#f2d45c', 0)); v.set(-4, 23, Zd, M('#c9a93a', 0));       // a sticky note
  v.box(-7, 26, Zd, -4, 27, Zd + 1, M('#8a7a3a', 0));
  sprite(v, 8, 26, Zd, ['bbbbbb', 'bbbybb', 'gbbbbg', 'gggggg', 'GGGGGG'], { b: M('#7fb6d9', 0), y: M('#f2d45c', 0), g: M('#6f9a4f', 0), G: M('#4f7a3f', 0) });      // a postcard
  v.set(10, 27, Zd + 1, M(BLUE, 0));
  for (const [x, y, c] of [[-9, 15, RED], [-6, 16, '#f2d45c'], [-3, 14, BLUE], [0, 16, '#5f9150'], [3, 15, '#e0705f']]) v.set(x, y, Zd + 1, M(c, 0));     // fridge magnets
  sprite(v, 3, 53, Zd + 1, ['r.r', 'rrr', '.r.'], { r: M(RED, 0) });

  sprite(v, 17, 42, 0, MENU, { r: M(RED, 0), p: paper, g: M('#9aa3b0', 0) }, 0, -1);            // a takeaway menu on the side, under its magnet
  v.set(18, 41, -3, M('#f2d45c', 0));
  v.paint(-14, 8, -14, 14, 52, -13, tone(k, 0.1));             // the coil at the back
  for (let y = 11; y < 50; y += 4) v.paint(-12, y, -14, 12, y + 1, -13, M(STEEL, 0));
  v.paint(-14, 3, -14, 14, 7, -13, k);

  // kept on top: cereal, the biscuit tin, a plant that is doing fine
  v.box(-13, TOP, -10, -5, TOP + 11, -6, M('#e0a23c', 1));
  v.paint(-13, TOP + 8, -10, -5, TOP + 11, -6, M(RED, 1));
  v.box(-11, TOP + 2, -7, -7, TOP + 6, -6, paper); v.box(-10, TOP + 3, -7, -8, TOP + 5, -6, M('#e0a23c', 1));
  v.cyl('y', -3, 1, TOP, TOP + 4, 4.1, M(BLUE, 0));
  v.cyl('y', -3, 1, TOP + 4, TOP + 5, 4.1, M('#d9cdb0', 0));
  const leaf = M('#5f9150', 2), leafL = M('#86c06a', 2), leafD = M('#3f6638', 2);
  v.cyl('y', 8.5, -4.5, TOP, TOP + 4, 3.3, M('#a5552f', 1));
  v.cyl('y', 8.5, -4.5, TOP + 3, TOP + 4, 2.3, M('#3a2a1c', 3));
  v.ellipsoid(8.5, TOP + 6, -4.5, 4, 2.6, 3.6, leaf);
  v.ellipsoid(11, TOP + 7.5, -6, 2.6, 1.8, 2.6, leafL);
  v.ellipsoid(6, TOP + 7, -2.5, 2.6, 1.6, 2.2, leafD);
  const drape = (x, z, dx, dz, hang) => {                      // a runner: crawl to the edge of the shell, then hang
    const topOf = (px, pz) => { for (let y = TOP; y >= 2; y--) if (v.has(px, y - 1, pz)) return y; return 0; };
    let y = topOf(x, z), i = 0;
    const put = () => v.set(x, y, z, [leaf, leafL, leaf, leafD][i++ % 4]);
    while (topOf(x, z)) { for (const t = topOf(x, z); y > t; y--) put(); put(); x += dx; z += dz; }
    for (; hang > 0; hang--, y--) put();
  };
  drape(13, -1, 0, 1, 7); drape(12, -5, 1, 0, 5);
  return v;
}

/* ---- the vending machine ------------------------------------------------------------ */

/** The vending machine's window: centre and size in voxels, in the plane z = VENDING_WINDOW.z facing +z. */
export const VENDING_WINDOW = Object.freeze({ x: -4.5, y: 39, z: 15.08, w: 25, h: 40 });

/** A snack machine, front facing +z: lit window on four shelves, keypad, coin slot, flap, a glowing brand panel. 40 × 70 × 31. */
export function vending() {
  const v = new Vox();
  const body = M('#33363d', 0), dark = tone(body, -0.32), lite = tone(body, 0.22), red = M(RED, 0);
  const chrome = M(CHROME, 0), k = M('#17181c', 0), tin = M('#c9ced6', 0);
  const W = VENDING_WINDOW, x0 = W.x - W.w / 2, x1 = W.x + W.w / 2, y0 = W.y - W.h / 2, y1 = W.y + W.h / 2, Z = 14;      // Z: the front layer

  for (const x of [-19, 16]) for (const z of [-15, 11]) v.box(x, 0, z, x + 3, 2, z + 3, k);
  v.box(-20, 2, -16, 20, 70, Z + 1, body);
  v.paint(-20, 2, -16, 20, 4, Z + 1, dark);
  v.paint(-20, 16, -16, 20, 18, Z + 1, red);                   // a brand stripe all the way round

  // the window: a lit cabinet behind glass
  v.box(x0 - 1, y0 - 1, 7, x1 + 1, y1 + 1, Z, M('#d9d4c8', 0));
  v.carve(x0, y0, 8, x1, y1, Z + 1);
  v.box(x0, y0, 7, x1, y1, 8, glow('#b8ab8c'));
  for (const y of [y0 + 9, y0 + 19, y0 + 29]) { v.box(x0, y, 8, x1, y + 1, 13, tin); v.box(x0, y, 12, x1, y + 1, 13, glow('#e8dcc0')); }
  const lit = (c) => glow(tone(c, -0.38));                     // under the cabinet lights: dimly self-lit, so the window still reads at night
  const item = (x, y, w, h, c, band, cap) => {                 // one product, front of its column
    v.box(x, y, 8, x + w, y + h, 12, lit(c));
    if (band) v.box(x, y + (h >> 1) - 1, 11, x + w, y + (h >> 1) + 1, 12, lit(band));
    if (cap) v.box(x + (w > 3 ? 1 : 0), y + h - 1, 8, x + w - (w > 3 ? 1 : 0), y + h, 12, lit(cap));
  };
  const cans = [RED, RED, '#3f8a72', '#e08a2c', '#5a6fa8', '#e8c84a'];
  cans.forEach((c, i) => item(x0 + i * 4, y0, 4, 6, c, tone(c, 0.45), '#c9ced6'));
  const bars = ['#6b3f2a', '#8a5a8f', '#c9893f', '#6b3f2a', RED, null, '#3f7f9a', '#8a5a8f'];      // null: sold out
  bars.forEach((c, i) => c && item(x0 + i * 3, y0 + 10, 3, 6, c, PAPER));
  const crisps = ['#e8c84a', RED, '#5a6fa8', '#6f8a4a', '#e08a2c'];
  crisps.forEach((c, i) => {
    item(x0 + i * 5, y0 + 20, 5, 7, c, null, tone(c, -0.25));
    v.box(x0 + i * 5 + 1, y0 + 22, 11, x0 + i * 5 + 4, y0 + 25, 12, lit(tone(c, 0.5)));
  });
  const bottles = [['#bfe0ea', '#5a6fa8'], ['#e08a2c', PAPER], [COFFEE, RED], ['#8fb84a', PAPER]];
  bottles.forEach(([c, cap], i) => item(x0 + i * 3, y0 + 30, 3, 8, c, cap, cap));
  item(x0 + 13, y0 + 30, 6, 6, '#c9893f', PAPER); item(x0 + 19, y0 + 30, 6, 6, '#8a5a8f', '#f2d45c');         // biscuits
  v.box(x0, y0, Z, x1, y1, Z + 1, glass('#44525a'));

  // brand panel
  const ink = M('#5a1a12', 0);
  v.box(-18, 61, Z, 18, 68, Z + 1, glow('#f5d08a'));
  'BYTES'.split('').forEach((ch, i) => sprite(v, -12 + i * 5, 66, Z, FONT[ch], { '#': ink }));
  for (const x of [-16, 15]) sprite(v, x, 65, Z, ['.#', '##', '.#'].map((r) => (x < 0 ? r : r.split('').reverse().join(''))), { '#': ink });

  // paying: display, keypad, coins, notes, change
  v.box(10, 20, Z, 18, 60, Z + 1, lite);
  v.box(11, 53, Z, 17, 58, Z + 1, k); v.box(12, 55, Z, 16, 57, Z + 1, glow('#39d07a'));
  v.box(11, 41, Z, 17, 51, Z + 1, k);
  for (const x of [12, 14]) for (const y of [42, 44, 46, 48]) v.set(x, y, Z, tin);
  for (const y of [42, 44, 46]) v.set(16, y, Z, tin);
  v.set(16, 49, Z, glow('#ff5a4a'));
  v.box(12, 33, Z, 16, 39, Z + 1, chrome); v.box(14, 34, Z, 15, 38, Z + 1, k);
  v.box(11, 28, Z, 17, 31, Z + 1, k); v.box(12, 29, Z, 16, 30, Z + 1, glow('#39d07a'));
  v.carve(12, 22, Z, 16, 25, Z + 1); v.paint(12, 22, Z - 1, 16, 25, Z, k); v.box(12, 21, Z, 16, 22, Z + 1, chrome);

  // the flap you reach through
  v.box(-16, 5, Z, 6, 15, Z + 1, lite);
  v.carve(-15, 6, Z, 5, 14, Z + 1); v.paint(-15, 6, Z - 1, 5, 14, Z, k);
  v.paint(-15, 12, Z - 1, 5, 14, Z, dark);
  v.box(-8, 8, Z - 1, -2, 10, Z, M(PAPER, 0));

  // sides, top, back
  for (const x of [-20, 19]) {
    v.paint(x, 36, -16, x + 1, 39, Z + 1, red); v.paint(x, 40, -16, x + 1, 41, Z + 1, M(PAPER, 0));
    sprite(v, x, 59, x < 0 ? -6 : 5, BISCUIT, { c: M('#d9a55f', 0), k: M(COFFEE, 0) }, 0, x < 0 ? 1 : -1);
  }
  for (let z = -13; z < -4; z += 2) v.paint(-14, 69, z, 14, 70, z + 1, dark);
  v.paint(-16, 8, -16, 16, 62, -15, dark);
  for (let y = 12; y < 60; y += 6) v.paint(-14, y, -16, 14, y + 1, -15, body);
  return v;
}

/* ---- water and waste ----------------------------------------------------------------- */

/** A water cooler, taps facing +z: blue for cold, red for hot, cups in a tube on its right side. 20 × 46 × 18. */
export function cooler() {
  const v = new Vox();
  const white = M('#e6e2d6', 0), grey = tone(white, -0.2), dark = tone(white, -0.5), steel = M(STEEL, 0), paper = M(PAPER, 0);
  const water = glass('#7fc4e8'), air = glass('#c9e6f4');
  const CX = -2;                                               // the cabinet sits left of centre; the cups hang on its right

  v.rbox(-10, 0, -8, 6, 28, 8, 2, white, 'xz');                // cabinet
  v.box(-10, 0, -8, -9, 28, -7, white); v.box(5, 0, -8, 6, 28, -7, white);            // (square at the back, where the wall is)
  v.paint(-10, 0, -8, 6, 2, 8, dark);
  v.paint(-10, 2, -8, 6, 11, 8, grey);                         // lower panel
  v.carve(-8, 13, 5, 4, 24, 8);                                // the alcove the taps hang in
  v.paint(-8, 13, 4, 4, 24, 5, grey); v.paint(-8, 12, 5, 4, 13, 8, grey);
  v.box(-8, 12, 5, 4, 14, 10, steel);                          // drip tray
  for (const x of [-7, -5, -3, -1, 1]) v.paint(x, 13, 6, x + 1, 14, 9, tone(steel, -0.35));
  for (const [x, c] of [[-6, BLUE], [0, RED]]) {
    v.box(x, 20, 5, x + 2, 22, 7, white); v.box(x, 18, 6, x + 2, 20, 7, steel);       // tap body, spout
    v.box(x, 21, 7, x + 2, 23, 8, M(c, 0));                    // paddle
    v.set(x, 25, 7, glow(c === RED ? '#ff3b2a' : '#2a8cff'));
  }
  v.box(-6, 14, 5, -3, 18, 8, paper); v.set(-5, 17, 6, M('#9fd0ea', 0));               // somebody's cup, left under the cold tap

  v.cyl('y', CX, 0, 28, 30, 5.6, grey);                        // collar
  v.cyl('y', CX, 0, 29, 31, 2.6, water);                       // the bottle, upside down: neck…
  v.cyl('y', CX, 0, 31, 34, 3.6, water, 6.9);                  // …shoulder…
  v.cyl('y', CX, 0, 34, 45, 6.9, water);                       // …body
  v.cyl('y', CX, 0, 45, 46, 5.6, water);
  for (const y of [37, 41]) v.paint(-10, y, -8, 6, y + 1, 8, air);                    // ribs
  v.paint(-10, 43, -8, 6, 46, 8, air);                         // the air at the top
  v.set(-4, 39, 6, air); v.set(0, 35, 6, air);                 // bubbles

  v.cyl('y', 8, 2, 13, 26, 2.05, glass('#cfe3e8'));            // cup dispenser
  v.box(7, 14, 1, 9, 25, 3, paper);
  v.cyl('y', 8, 2, 26, 27, 2.05, grey);
  v.cyl('y', 8, 2, 11, 13, 1.5, paper);                        // the next cup, waiting
  v.box(6, 15, 1, 7, 17, 3, grey); v.box(6, 22, 1, 7, 24, 3, grey);      // brackets

  for (let y = 5; y < 24; y += 3) v.paint(-7, y, -8, 3, y + 1, -7, grey);            // vents at the back
  sprite(v, -10, 23, -3, ['bbbbbb', 'bbwbbb', 'bwwwbb', 'bwwwbb', 'bbwbbb', 'bbbbbb', 'wwwwww'], { b: M(BLUE, 0), w: paper }, 0, 1);      // the water company's label
  return v;
}

/** A paper-recycling bin, its mark facing +z: a swing flap stuck half open and a crumpled sheet that did not quite go in. 20 × 23 × 20. */
export function bin(opt = {}) {
  const v = new Vox();
  const blue = M(opt.color || BLUE, 0), dark = tone(blue, -0.3), lite = tone(blue, 0.22), white = M(PAPER, 0), k = M('#1c1d21', 0);
  v.rbox(-9, 0, -9, 9, 17, 9, 4, blue, 'xz');                  // body
  v.paint(-9, 0, -9, 9, 2, 9, dark);
  slab(v, -10, 16, -10, 10, 20, 10, 4, dark);                  // lid, a little proud of the body
  v.carve(-6, 18, -6, 6, 20, 6); v.paint(-6, 17, -6, 6, 18, 6, k);       // the opening
  v.box(-6, 19, -6, 6, 20, -1, lite);                          // swing flap, stuck half open
  v.box(-6, 18, -1, 6, 19, 1, lite);
  v.box(-7, 19, -1, -6, 20, 1, white); v.box(6, 19, -1, 7, 20, 1, white);            // hinge pins
  sprite(v, -6, 14, 8, RECYCLE, { '#': white });
  v.sphere(1.5, 20.5, 3.5, 2.6, (x, y, z) => ((((x * 3 + y * 5 + z * 7) % 4) + 4) % 4 === 0 ? tone(white, -0.16) : white));   // the sheet
  v.sphere(-3.5, 19.5, 3.5, 1.7, tone(white, -0.08));
  for (const x of [-9, 8]) v.paint(x, 12, -3, x + 1, 14, 3, k);                      // grips
  return v;
}

/* ---- somewhere to sit ---------------------------------------------------------------- */

/** Table-top height in voxels. */
export const CAFETABLE_H = 26;
/** Seat height of a stool in voxels (the top of the cushion), and the cushions it comes in. */
export const STOOL_H = 18;
export const STOOL_COLORS = Object.freeze([RED, '#3f8a72', '#c9893f', '#5a6fa8']);

/** A round café table on one pedestal leg, the top left mostly free (opt.item: 0 a bud vase, 1 napkins). 36 × 26 × 36, top at y = 26. */
export function cafetable(opt = {}) {
  const v = new Vox();
  const H = CAFETABLE_H, wood = M('#b98d57', 2), dark = tone(wood, -0.3), iron = M('#34322f', 0), steel = M(CHROME, 0);
  v.cyl('y', 0, 0, 0, 1, 9, iron);                             // foot
  v.cyl('y', 0, 0, 1, 3, 3.5, iron);
  v.cyl('y', 0, 0, 3, H - 3, 1.9, iron);                       // pedestal
  v.cyl('y', 0, 0, H - 3, H - 2, 4, iron);
  v.cyl('y', 0, 0, H - 2, H, 17.9, (x, y, z) => (y === H - 2 || Math.hypot(x + 0.5, z + 0.5) > 16.7 ? dark : ((x % 6) + 6) % 6 === 0 ? tone(wood, -0.1) : wood));
  if ((opt.item ?? 0) === 0) {                                 // a bud vase
    v.cyl('y', 1.5, -1.5, H, H + 4, 1.6, M(BLUE, 0));
    v.box(1, H + 4, -2, 2, H + 7, -1, M('#4f8a4a', 2)); v.set(2, H + 5, -2, M('#6fae5a', 2));
    v.box(0, H + 7, -3, 3, H + 8, 0, M('#f2d45c', 1)); v.set(1, H + 8, -2, M('#f2d45c', 1)); v.set(1, H + 7, -2, M('#c9893f', 1));
  } else {                                                     // a napkin holder
    v.box(-4, H, -2, 4, H + 1, 2, steel); v.box(-4, H + 1, -2, 4, H + 5, -1, steel); v.box(-4, H + 1, 1, 4, H + 5, 2, steel);
    v.box(-3, H + 1, -1, 3, H + 6, 1, M(PAPER, 1));
  }
  const ring = tone(wood, -0.22);
  for (const [x, z] of [[9, 6], [10, 6], [11, 6], [8, 7], [12, 7], [8, 8], [12, 8], [8, 9], [12, 9], [9, 10], [10, 10], [11, 10]]) v.set(x, H - 1, z, ring);     // a coffee ring
  return v;
}

/** A café stool: round cushion, four splayed legs, a foot ring. The seat centre is the origin; sit facing +z. 16 × 18 × 16, seat top at y = 18. */
export function stool(opt = {}) {
  const v = new Vox();
  const fab = M(opt.color || STOOL_COLORS[0], 3), steel = M('#9aa3b0', 0), k = M(BLACK, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {        // legs: each steps out a voxel on the way down
    const x = sx > 0 ? 3 : -5, z = sz > 0 ? 3 : -5;
    v.box(x, 7, z, x + 2, 14, z + 2, steel);
    v.box(x + sx, 1, z + sz, x + sx + 2, 7, z + sz + 2, steel);
    v.box(x + sx, 0, z + sz, x + sx + 2, 1, z + sz + 2, k);
  }
  v.ring(0, 6.5, 0, 6.4, 0.8, steel);                          // foot ring
  v.cyl('y', 0, 0, STOOL_H - 4, STOOL_H - 1, 8, fab);          // cushion
  v.cyl('y', 0, 0, STOOL_H - 1, STOOL_H, 7, fab);
  v.paint(-8, STOOL_H - 4, -8, 8, STOOL_H - 3, 8, k);          // …on its pan
  v.box(-1, STOOL_H - 1, -1, 1, STOOL_H, 1, tone(fab, -0.25)); // button
  return v;
}

/* ---- the speakeasy's fridge ----------------------------------------------------------- */

/** A black mini fridge covered in stickers, door facing +z, two cans left on top. 24 × 30 × 24. */
export function minifridge() {
  const v = new Vox();
  const body = M('#2e2f35', 0), door = tone(body, 0.1), deep = M('#141418', 0), chrome = M(CHROME, 0), paper = M(PAPER, 0);
  const F = 11, Zd = F - 1;                                    // F: the door's front plane, Zd: its surface layer
  for (const x of [-11, 9]) for (const z of [-11, 8]) v.box(x, 0, z, x + 2, 1, z + 2, deep);
  v.rbox(-12, 1, -12, 12, 30, F, 2, body, 'xz');
  v.box(-12, 1, -12, -11, 30, -11, body); v.box(11, 1, -12, 12, 30, -11, body);      // (square at the back)
  v.paint(-12, 1, 7, 12, 30, 8, deep);                         // gasket
  v.paint(-12, 1, 8, 12, 30, F, door);
  v.paint(-12, 1, 8, 12, 4, F, deep);                          // vent under the door
  v.box(8, 14, F, 10, 26, F + 1, chrome);                      // handle
  v.box(-10, 25, Zd, -4, 28, F, deep); v.box(-9, 26, Zd, -5, 27, F, glow('#5ad0ff'));              // thermostat
  v.set(-2, 26, Zd, glow('#39d07a'));
  sprite(v, -9, 22, Zd, ['.yyy.', 'ykyky', 'yyyyy', 'ykkky', '.yyy.'], { y: M('#f2d45c', 0), k: deep });           // stickers: a smiley,
  sprite(v, -2, 21, Zd, ['yykkyykk', 'ykkyykky', 'kkyykkyy'], { y: M('#e8b83a', 0), k: deep });                 // hazard tape,
  sprite(v, -9, 14, Zd, ['.p.p.', 'ppppp', 'ppppp', '.ppp.', '..p..'], { p: M('#e0705f', 0) });                // a heart,
  sprite(v, -1, 15, Zd, ['gggggg', 'gwwwwg', 'gggggg'], { g: M('#3f8a72', 0), w: paper });                      // a band's name,
  sprite(v, 0, 10, Zd, ['..b..', '.bbb.', 'bbbbb', '.b.b.'], { b: M('#7f9fe0', 0) });                           // a star,
  v.set(4, 6, Zd, paper); v.set(5, 6, Zd, paper); v.set(5, 7, Zd, paper);                                       // and what is left of one that was peeled off
  sprite(v, 11, 22, 3, ['yyyyyyy', '.yryyy.', '.yyyry.', '..yyy..', '..yry..', '...y...'], { y: M('#e8b83a', 0), r: M(RED, 0) }, 0, -1);     // pizza, on the side
  v.paint(-9, 29, -9, 9, 30, 6, tone(body, 0.08));
  can(v, -4, 30, -2, RED);
  can(v, 4, 30, 1, '#3f8a72');
  for (let y = 6; y < 26; y += 3) v.paint(-9, y, -12, 9, y + 1, -11, deep);          // coil at the back
  return v;
}

export const CATALOGUE = {
  counter: { make: () => counter() },
  coffeemachine: { make: () => coffeemachine(), y: 0.75 },
  fridge: { make: () => fridge() },
  vending: { make: () => vending() },
  cooler: { make: () => cooler() },
  bin: { make: () => bin() },
  cafetable: { make: (o) => cafetable({ item: pick(o, 2) }), variant: (o) => String(pick(o, 2)) },
  stool: { make: (o) => stool({ color: STOOL_COLORS[pick(o, STOOL_COLORS.length)] }), variant: (o) => String(pick(o, STOOL_COLORS.length)), seat: STOOL_H },
  minifridge: { make: () => minifridge() },
};
