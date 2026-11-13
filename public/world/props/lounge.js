// The Office — furniture for the library, the lobby, and the things on their walls.
//
// Same rules as office.js: every prop is a function that returns a Vox, 2.5 cm
// voxels, floor at y = 0, centred on x = z = 0, FRONT facing +z. Something you
// sit on has the middle of its seat at the origin; something that hangs on a
// wall has its back on the plane z = 0 and its bottom centre at the origin.
// How to write one: README.md in this folder.
import { Vox, M, glow, glass, tone, noise3, VOXEL } from '../vox/vox.js';
import { hashId } from '/core/look.mjs';

const WOOD = '#9a6a3c', WOOD_DARK = '#6b4a2f', HONEY = '#b98d57', CREAM = '#cfc6b0', STEEL = '#8a8f96', BLACK = '#2b2b30';
const BRASS = '#c9a24a', PAPER = '#f1ead8';

const pick = (o, n) => hashId(String(o?.id || o?.type || '')) % n;

/** A closed book lying flat: cover on top and down the spine side, page edges on the other three. */
function layBook(v, x0, y0, z0, w, d, color, spine = '+z', h = 2) {
  v.box(x0, y0, z0, x0 + w, y0 + h, z0 + d, M(color, 1));
  v.box(x0 + (spine === '-x' ? 1 : 0), y0 + (h > 2 ? 1 : 0), z0 + (spine === '-z' ? 1 : 0),
    x0 + w - (spine === '+x' ? 1 : 0), y0 + h - 1, z0 + d - (spine === '+z' ? 1 : 0), M(PAPER, 0));
}

/* ---- the library ------------------------------------------------------------ */

export const LEATHERS = Object.freeze(['#2f5a45', '#6e2a2c']);     // bottle green, oxblood

/** A deep leather reading chair with rolled arms. Sit facing +z; the origin is the middle of the seat. 36 × 34 × 27, seat top 15. */
export function armchair(opt = {}) {
  const v = new Vox();
  const hide = M(opt.color || LEATHERS[0], 1), dark = tone(hide, -0.24), deep = tone(hide, -0.45), lite = tone(hide, 0.1), worn = tone(hide, 0.2);
  const wood = M(WOOD_DARK, 2), brass = M(BRASS, 0);
  for (const x of [-15, 14]) for (const z of [-14, 5]) v.cyl('y', x + 0.5, z + 0.5, 0, 4, 1.2, wood, 1.9);     // turned feet
  v.rbox(-17, 4, -16, 17, 11, 7, 3, dark, 'xz');                     // frame
  for (const [y0, y1, z] of [[4, 13, -16], [13, 20, -17], [20, 30, -18]]) v.rbox(-17, y0, z, 17, y1, z + 7, 3, hide, 'xz');   // the back leans a little …
  v.cyl('x', 30, -14, -17, 17, 4, hide);                             // … and rolls over at the top
  v.paint(-17, 32, -18, 17, 34, -10, lite);
  v.paint(-1, 13, -18, 1, 27, -15, dark);                            // seam down the back
  for (let x = -14; x < 14; x += 3) v.set(x, 11, -16, brass);        // tacks along its foot
  for (const s of [-1, 1]) {
    const a = s < 0 ? -16 : 11, cx = s * 13;
    v.box(a, 4, -15, a + 5, 19, 8, hide);                            // arm
    v.cyl('z', cx, 19, -15, 9, 5, hide);                             // rolled over, fat as a bolster
    v.paint(cx - 4, 22, -2, cx + 4, 24, 9, worn);                    // worn pale where hands rest
    v.paint(cx - 4, 15, 8, cx + 4, 23, 9, (x, y) => { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 19); return d < 1 ? brass : d > 2.4 && d < 3.4 ? dark : 0; });   // scroll
    for (const y of [6, 9, 12]) { v.set(a, y, 7, brass); v.set(a + 4, y, 7, brass); }                 // nail heads
  }
  v.rbox(-11, 10, -8, 11, 15, 8, 2, lite);                           // seat cushion
  v.paint(-7, 14, -4, 7, 15, 5, (x, y, z) => (((x + 0.5) / 6.5) ** 2 + ((z - 0.5) / 4) ** 2 < 1 ? tone(lite, 0.07) : 0));
  v.rbox(-11, 13, -13, 11, 32, -6, 3, lite);                         // back cushion, leaning with the back
  v.carve(-11, 20, -7, 11, 32, -6); v.carve(-11, 27, -8, 11, 32, -6);
  for (const [x, y, z] of [[-6, 17, -7], [5, 17, -7], [-6, 24, -8], [5, 24, -8]]) { v.carve(x, y, z, x + 1, y + 1, z + 1); v.set(x, y, z - 1, deep); }   // buttons
  layBook(v, 10, 24, -13, 6, 8, opt.book || '#b5483f', '+z');        // someone's place, kept on the arm
  return v;
}

/** A small round pedestal table: two books and a cup of tea, or (opt.lamp) a little lamp. 20 × 20 × 20. */
export function sidetable(opt = {}) {
  const v = new Vox();
  const wood = M(opt.color || WOOD, 2), dark = tone(wood, -0.28), stain = tone(wood, -0.14);
  v.box(-8, 1, -1, 8, 3, 1, dark); v.box(-1, 1, -8, 1, 3, 8, dark);                  // crossed rails …
  for (const [x, z] of [[-8, -1], [6, -1], [-1, -8], [-1, 6]]) v.box(x, 0, z, x + 2, 1, z + 2, M(BLACK, 0));     // … on four pads
  v.cyl('y', 0, 0, 3, 4, 2.6, dark);
  v.cyl('y', 0, 0, 3, 13, 1.6, wood);                                                // turned column
  v.cyl('y', 0, 0, 7, 9, 2.6, wood);
  v.cyl('y', 0, 0, 12, 13, 3.6, dark); v.cyl('y', 0, 0, 13, 14, 5.6, dark);          // collar
  v.cyl('y', 0, 0, 14, 16, 10, (x, y, z) => (y === 14 ? dark : Math.hypot(x + 0.5, z + 0.5) > 8.4 ? stain : wood));
  v.paint(-7, 15, 1, -1, 16, 7, (x, y, z) => { const d = Math.hypot(x + 4.5, z - 3.5); return d > 1 && d < 2.3 ? stain : 0; });   // a ring where a cup stood
  layBook(v, -7, 16, -7, 9, 6, '#3f8a72', '+z');
  layBook(v, -6, 18, -7, 6, 5, '#b5483f', '+x');
  if (opt.lamp) {
    const brass = M(BRASS, 0);
    v.cyl('y', 4, 3, 16, 17, 2.6, tone(brass, -0.3));
    v.cyl('y', 4, 3, 17, 21, 0.8, brass);
    v.cyl('y', 4, 3, 20, 25, 4.2, glow('#f3d9a4'), 2.6);                             // the shade is lit from inside
  } else {
    const china = M('#efe9dc', 0);
    v.cyl('y', 4, 3, 16, 17, 2.6, china);                                            // saucer
    v.cyl('y', 4, 3, 17, 19, 1.6, china);                                            // cup
    v.box(3, 18, 2, 5, 19, 4, M('#7a4a24', 0));                                      // tea
    v.set(6, 18, 3, china);                                                          // handle
  }
  return v;
}

/** The lectern that holds the binder (every project's docs). The reader stands on +z; the desk slopes down toward them. 24 × 44 × 24. */
export function lectern() {
  const v = new Vox();
  const wood = M(WOOD, 2), dark = M(WOOD_DARK, 2), deep = tone(dark, -0.24), pale = tone(wood, 0.16), brass = M(BRASS, 0);
  const T = 38, top = (z) => T - Math.floor((z + 12) / 3);          // desk-top height at each z
  v.box(-10, 0, -9, 10, 2, 9, deep);                                 // plinth
  v.box(-9, 2, -8, 9, 3, 8, dark);
  v.box(-7, 3, -6, 7, 28, 6, wood);                                  // column
  v.carve(-5, 6, -6, 5, 25, -5); v.paint(-5, 6, -5, 5, 25, -4, pale);                // panel on the audience side
  v.box(-3, 17, -6, 3, 21, -5, brass); v.box(-2, 19, -6, 2, 20, -5, tone(brass, -0.42));               // … with a plaque
  for (const x of [-7, 6]) { v.carve(x, 6, -4, x + 1, 25, 4); v.paint(x < 0 ? -6 : 5, 6, -4, x < 0 ? -5 : 6, 25, 4, pale); }
  v.carve(-5, 12, 1, 5, 26, 6); v.paint(-5, 12, 0, 5, 26, 1, deep);                  // a shelf on the reader's side
  v.box(-4, 12, 1, 4, 15, 6, M('#b5483f', 1)); v.box(-2, 13, 5, 1, 14, 6, M(PAPER, 0));                 // spare binders
  v.box(-4, 15, 1, 3, 18, 6, M('#c9893f', 1)); v.box(-2, 16, 5, 1, 17, 6, M(PAPER, 0));
  v.box(-9, 28, -8, 9, 30, 8, dark);                                 // capital
  for (let z = -12; z < 12; z++) {
    const y = top(z);
    if (z >= -10 && z < 10) v.box(-10, 30, z, 10, y - 2, z + 1, dark);
    v.box(-12, y - 2, z, 12, y, z + 1, (x, yy) => (yy === y - 2 ? dark : wood));     // the sloping desk
  }
  v.box(-11, top(11), 11, 11, top(11) + 2, 12, dark);                // lip that stops the binder sliding off

  // the binder, open
  const cover = M('#34507a', 1), page = M(PAPER, 0), rule = M('#b9b2a2', 0), steel = M('#b4bcc8', 0);
  for (let z = -10; z < 10; z++) {
    const y = top(z);
    v.box(-10, y, z, 10, y + 1, z + 1, cover);
    if (z > -10 && z < 9) { v.box(-9, y + 1, z, -1, y + 3, z + 1, page); v.box(1, y + 1, z, 9, y + 3, z + 1, page); }
  }
  const ink = (x, z, c) => v.set(x, top(z) + 2, z, c);
  for (let z = -8; z < 8; z += 2) for (let x = -8; x < -2 - (z & 2); x++) ink(x, z, rule);             // a page of text
  for (let x = 2; x < 6; x++) ink(x, -8, M('#4a4f60', 0));                                             // a heading
  for (const z of [-6, -4]) for (let x = 2; x < 8; x++) ink(x, z, rule);
  [[2, 5, '#3f8a72'], [4, 3, '#c9893f'], [6, 4, '#b5483f']].forEach(([x, h, c]) => { for (let z = 7 - h; z < 7; z++) ink(x, z, M(c, 0)); });   // and a chart
  for (const z of [5, 6]) for (const x of [-5, -4]) ink(x, z, M('#f2d45c', 0));                        // sticky note
  for (const z of [-7, -1, 5]) v.box(-1, top(z) + 1, z, 1, top(z) + 4, z + 1, steel);                  // rings
  ['#d8493f', '#e08a3c', '#e8c45a', '#6f9a4a', '#3f7f9a'].forEach((c, i) => {                         // index tabs: two turned, three to go
    for (let k = 0; k < 3; k++) { const z = -8 + i * 3 + k, x = i < 2 ? -11 : 9; v.box(x, top(z) + 2, z, x + 2, top(z) + 3, z + 1, M(c, 0)); }
  });

  // a brass reading light over the top edge
  for (const x of [-9, 8]) v.box(x, T, -12, x + 1, T + 5, -11, brass);
  v.box(-9, T + 5, -12, 9, T + 6, -8, brass);
  v.box(-9, T + 4, -12, 9, T + 5, -11, tone(brass, -0.3));
  v.box(-8, T + 4, -11, 8, T + 5, -9, glow('#ffe6b0'));
  return v;
}

// The world at ten degrees a letter: 90°N at the top, 180°W on the left. g and s are land, i is ice.
const WORLD = [
  'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii',
  '.......gggg.iiii..........gggg......',
  '.gggggggg.gg.ii...gggggggggggggggggg',
  '.....gggggggg....g.gggggggggggggggg.',
  '.....ggggggg.....gggggggggggggggg...',
  '......ssggg......g...gsssssggg.g....',
  '.......sg.......sssssssssgggggg.....',
  '........gg......ggssssg..g.gg.g.....',
  '..........ggg....gggggg.....gg......',
  '..........ggggg....ggg......ggg.gg..',
  '..........ggggg....ggg.g......ggg...',
  '...........ggg.....ssg.g.....ssssg..',
  '...........gg.......g........g.ggg.g',
  '...........g......................g.',
  '...........g........................',
  '...........ii.....iiiiiiiiiiiiiiii..',
  'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii',
  'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii',
];

/** A floor-standing globe: turned wooden stand, brass meridian, the Atlantic facing the room. 22 × 40 × 22. */
export function globe() {
  const v = new Vox();
  const wood = M(WOOD_DARK, 2), wd = tone(wood, -0.26), wl = tone(wood, 0.16), brass = M(BRASS, 0), bd = tone(brass, -0.3);
  const sea = M('#3d72a6', 1), land = M('#6f9a4a', 1), ice = M('#e9ece4', 1);
  const CY = 28, st = Math.sin(0.41), ct = Math.cos(0.41);           // the axis leans 23° toward +x
  v.cyl('y', 0, 0, 0, 2, 8.6, wd);                                   // foot
  v.cyl('y', 0, 0, 2, 3, 6.6, wood);
  v.cyl('y', 0, 0, 3, 5, 3.6, wood);
  v.cyl('y', 0, 0, 5, 15, 1.6, wood);                                // turned column
  v.cyl('y', 0, 0, 8, 11, 2.6, wl);
  v.cyl('y', 0, 0, 13, 15, 2.6, wood);
  v.cyl('y', 0, 0, 15, 17, 3.6, bd);                                 // brass cradle
  v.ring(0, CY, 0, 10.5, 1.1, brass, 'z');                           // meridian
  for (const s of [-1, 1]) v.tube(s * st * 8.5, CY + s * ct * 8.5, 0, s * st * 11, CY + s * ct * 11, 0, 1, bd);   // the poles' pins
  v.sphere(0, CY, 0, 9, (x, y, z) => {
    const px = x + 0.5, py = y + 0.5 - CY, pz = z + 0.5, d = Math.hypot(px, py, pz) || 1;
    const lat = Math.asin((px * st + py * ct) / d) * 180 / Math.PI;
    const lon = Math.atan2(px * ct - py * st, pz) * 180 / Math.PI - 30;
    const c = WORLD[Math.min(17, Math.floor((90 - lat) / 10))][((Math.floor((lon + 180) / 10) % 36) + 36) % 36];
    return c === 'i' ? ice : c === '.' ? sea : land;
  });
  v.set(6, CY + 4, 4, M('#d8392f', 0));                              // a pin: we are here
  return v;
}

/* ---- the plaza -------------------------------------------------------------- */

/** A slatted bench on steel hoops, no back, a cushion at one end. Sit facing +z; the origin is mid-seat. 64 × 18 × 20, seat top 16. */
export function bench(opt = {}) {
  const v = new Vox();
  const wood = M(opt.color || HONEY, 2), end = tone(wood, -0.24), alt = tone(wood, 0.08), k = M(BLACK, 0);
  const cloth = M(opt.cushion || '#3f7f9a', 3);
  for (const x of [-27, 25]) {                                       // two steel hoops
    v.box(x, 0, -9, x + 2, 2, 9, k);
    v.box(x, 2, -9, x + 2, 12, -7, k); v.box(x, 2, 7, x + 2, 12, 9, k);
    v.box(x, 12, -9, x + 2, 14, 9, k);
  }
  v.box(-25, 11, -1, 25, 13, 1, k);                                  // stretcher
  for (let i = 0; i < 7; i++) {                                      // seven slats
    const z = -10 + i * 3, c = i % 2 ? alt : wood;
    v.box(-32, 14, z, 32, 16, z + 2, (x) => (x === -32 || x === 31 ? end : c));
  }
  v.rbox(-30, 16, -9, -12, 19, 9, 2, cloth);                         // a cushion somebody brought from home
  v.paint(-30, 16, -9, -12, 17, 9, tone(cloth, -0.22));
  v.paint(-22, 18, -1, -20, 19, 1, tone(cloth, -0.3));               // its button
  v.box(15, 16, -6, 27, 17, 4, (x, y, z) => (z < -4 ? M('#4a4f60', 0)              // yesterday's paper
    : x > 20 && x < 26 && z > -4 && z < 1 ? M('#8a8f96', 0) : (z & 1) && x > 15 && x < 26 ? M('#bdb7a8', 0) : M(PAPER, 0)));
  return v;
}

/** The cat's bed: a fleece pad inside a round bolster, low at the front; shed fur and a toy mouse. No cat. 24 × 8 × 24. */
export function catbed(opt = {}) {
  const v = new Vox();
  const cloth = M(opt.color || '#5a7890', 3), dark = tone(cloth, -0.26), lite = tone(cloth, 0.14);
  const fleece = M('#e9dcc0', 3), fur = M('#2b2b33', 3), white = M('#f3efe6', 3), k = M(BLACK, 0);
  v.cyl('y', 0, 0, 0, 1, 11, dark);                                  // tucked-in base
  v.cyl('y', 0, 0, 1, 4, 11.6, cloth);                               // the bolster
  v.cyl('y', 0, 0, 4, 5, 10.9, lite);
  v.cyl('y', 0, 0, 1, 5, 8.2, 0);                                    // the hollow
  v.cyl('y', 0, 0, 4, 5, 8.9, 0);
  v.carve(-4, 3, 6, 4, 5, 12);                                       // low at the front, to step in
  v.cyl('y', 0, 0, 0, 1, 8.2, fleece);                               // fleece pad, plump in the middle
  v.cyl('y', 0, 0, 1, 2, 6, fleece);
  for (const [x, y, z, c] of [[-5, 2, -3, fur], [-4, 2, -3, fur], [-4, 2, -4, fur], [-3, 2, -4, white], [-4, 3, -3, fur], [-6, 1, -4, fur],
    [-10, 5, 1, fur], [6, 1, 4, white]]) v.set(x, y, z, c);                                                     // a tuft of shed fur
  const grey = M('#9a9aa6', 3), pink = M('#e8a0a8', 1);              // a toy mouse, left on the rim
  v.box(8, 5, -3, 11, 7, 1, grey); v.box(9, 5, 1, 10, 6, 2, grey);
  v.set(9, 5, 2, pink); v.set(8, 7, 0, pink); v.set(10, 7, 0, pink); v.set(8, 6, 0, k); v.set(10, 6, 0, k);
  for (const [x, z] of [[9, -4], [9, -5], [8, -5], [8, -6], [8, -7], [7, -7]]) v.set(x, 5, z, pink);
  return v;
}

/* ---- the foyer -------------------------------------------------------------- */

/** Height of the reception's raised visitor counter (voxels): the top surface, where the bell stands. */
export const RECEPTION_TOP = 38;

/** A small beige monitor. Screen faces +z. 14 × 12 × 9. */
function monitor() {
  const v = new Vox();
  const body = M(CREAM, 0), shade = tone(body, -0.14);
  v.rbox(-7, 2, -5, 7, 12, 4, 1, body);
  v.carve(-7, 2, -5, -5, 12, -2); v.carve(5, 2, -5, 7, 12, -2); v.carve(-7, 10, -5, 7, 12, -2);     // the tube narrows toward the back
  v.decal('+z', -6, 3, 6, 11, shade);                                // bezel
  v.carve(-5, 5, 3, 5, 11, 4);                                       // the screen sits back a little
  v.box(-5, 5, 2, 5, 11, 3, M('#0e1512', 0));
  for (const [y, w] of [[9, 7], [8, 4], [6, 5]]) v.box(-4, y, 2, -4 + w, y + 1, 3, glow('#86e0a8'));   // today's visitors
  v.set(5, 3, 3, glow('#86e0a8'));
  v.box(-2, 1, -2, 2, 2, 2, shade);
  v.rbox(-5, 0, -4, 5, 1, 3, 2, shade, 'xz');
  return v;
}

/** The reception desk. Visitors stand at the raised counter on +z; the receptionist sits at the low side on −z. 96 × 43 × 32. */
export function reception() {
  const v = new Vox();
  const T = RECEPTION_TOP, H = 26;
  const wood = M(WOOD, 2), dark = M(WOOD_DARK, 2), deep = tone(dark, -0.26), pale = M('#c4995f', 2), top = M(HONEY, 2);
  const brass = M(BRASS, 0), bd = tone(brass, -0.42), k = M(BLACK, 0), steel = M(STEEL, 0), paper = M(PAPER, 0), cream = M(CREAM, 0), shade = tone(cream, -0.16);

  // the raised part: a panelled front for visitors, under the counter
  v.box(-48, 0, -2, 48, T - 2, 15, dark);
  v.box(-45, 3, 9, 45, T - 2, 15, wood);
  v.box(-48, 0, 9, 48, 3, 15, k);                                                    // plinth
  for (const x of [-45, -14, 17]) { v.carve(x, 7, 14, x + 28, 31, 15); v.paint(x, 7, 13, x + 28, 31, 14, pale); }   // three inset panels
  v.paint(-8, 17, 13, 8, 23, 14, brass); v.paint(-6, 21, 13, 6, 22, 14, bd); v.paint(-5, 19, 13, 5, 20, 14, bd);    // RECEPTION, engraved
  for (const [x, y, w] of [[24, 7, 3], [29, 8, 2], [-38, 7, 2], [36, 7, 4]]) v.paint(x, y, 13, x + w, y + 1, 14, tone(pale, -0.16));   // scuffs from shoes
  v.box(-48, T - 2, -2, 48, T, 16, (x, y, z) => (y === T - 2 ? deep : z === 15 ? tone(dark, 0.14) : dark));     // the counter

  // the low side: things pinned up, a work surface, drawers, the computer
  v.paint(-42, 28, -2, -24, 35, -1, M('#b98d57', 3)); v.paint(-40, 30, -2, -35, 34, -1, paper);                   // corkboard
  v.paint(-33, 31, -2, -30, 34, -1, M('#f2d45c', 0)); v.paint(-28, 29, -2, -25, 32, -1, M('#e8a0a8', 0));
  v.paint(4, 27, -2, 14, 35, -1, paper); v.paint(4, 33, -2, 14, 35, -1, M('#b5483f', 0));                         // calendar
  v.paint(5, 29, -2, 13, 30, -1, M('#c4bdae', 0)); v.paint(5, 31, -2, 13, 32, -1, M('#c4bdae', 0)); v.paint(9, 29, -2, 10, 30, -1, M('#b5483f', 0));
  v.paint(26, 33, -2, 42, 34, -1, wood);                                             // key rail
  ['#d8493f', '#3f7f9a', '#e8c45a', '#6f9a4a'].forEach((c, i) => { v.set(28 + i * 4, 32, -3, brass); v.set(28 + i * 4, 31, -3, M(c, 0)); });
  v.box(-46, H - 2, -16, 46, H, -3, (x, y, z) => (y === H - 2 ? deep : (z + 16) % 6 === 0 ? tone(top, -0.08) : top));   // stops short of the back: a slot for cables
  for (const x of [-48, 46]) { v.box(x, 1, -16, x + 2, H, -2, dark); v.box(x, 0, -16, x + 2, 1, -2, k); }
  for (const x of [-46, 28]) { v.box(x, 1, -14, x + 18, H - 2, -2, dark); v.box(x, 0, -14, x + 18, 1, -2, k); }
  for (let i = 0; i < 3; i++) { const y = 3 + i * 7; v.paint(-45, y, -14, -29, y + 6, -13, wood); v.box(-40, y + 3, -15, -34, y + 4, -14, steel); }   // drawers
  for (const y of [3, 14]) { v.paint(29, y, -14, 45, y + 9, -13, wood); v.box(34, y + 6, -15, 40, y + 7, -14, steel); v.paint(35, y + 2, -14, 39, y + 4, -13, paper); }   // files
  v.box(17, 0, -13, 25, 20, -3, cream);                                              // the computer, under the desk
  v.paint(18, 13, -13, 24, 18, -12, shade); v.paint(19, 10, -13, 23, 11, -12, tone(cream, -0.4));
  v.set(19, 8, -13, shade); v.set(23, 8, -13, glow('#86e0a8'));

  // on the work surface
  v.stamp(monitor().turned(2), -14, H, -8);
  v.box(-20, H, -16, -8, H + 1, -13, shade); v.paint(-19, H, -16, -9, H + 1, -14, cream);              // keyboard
  v.box(-4, H, -14, 3, H + 1, -8, M('#e8c95a', 0)); v.paint(-4, H, -9, 3, H + 1, -8, M('#b5483f', 0));  // legal pad
  v.box(4, H, -13, 5, H + 1, -8, M('#34507a', 0));
  v.box(6, H, -13, 15, H + 2, -6, cream); v.box(6, H + 2, -13, 9, H + 3, -6, shade);                   // telephone
  v.paint(10, H + 1, -11, 14, H + 2, -7, tone(cream, -0.3));
  v.set(13, H + 1, -12, glow('#ff6a5a'));                                            // one message waiting
  v.box(20, H, -9, 23, H + 3, -6, M('#b5483f', 1)); v.set(21, H + 2, -8, M('#3a2a1c', 0)); v.set(23, H + 1, -8, M('#b5483f', 1));     // mug
  v.box(30, H, -14, 42, H + 2, -5, steel); v.paint(31, H + 1, -13, 41, H + 2, -6, paper);              // in-tray

  // on the counter — nothing between x = 18 and 38: the bell stands at x = 28
  v.box(-35, T, 2, -25, T + 1, 15, (x, y, z) => (x < -34 || x > -27 || z < 4 || z > 13 ? M('#8a5a2f', 1)          // sign-in clipboard
    : !(z & 1) || x < -33 || x > -28 ? paper : z < 9 ? M('#4a5a8a', 0) : M('#c4bdae', 0)));
  v.box(-32, T + 1, 2, -28, T + 2, 4, steel);
  v.box(-23, T, 5, -22, T + 1, 11, M('#34507a', 0)); v.set(-23, T, 11, brass);       // its pen
  v.cyl('y', -17, 8, T, T + 3, 1.6, M('#3f7f9a', 1));                                // pen pot
  v.box(-18, T + 3, 7, -17, T + 5, 8, M('#d8493f', 0)); v.box(-17, T + 3, 8, -16, T + 4, 9, M('#e8c45a', 0)); v.box(-18, T + 3, 8, -17, T + 4, 9, k);
  v.box(-6, T, 11, 6, T + 3, 13, brass); v.paint(-4, T + 1, 12, 4, T + 2, 13, bd);   // name plate
  v.cyl('y', 42, 7, T, T + 3, 1.6, M('#a5552f', 1));                                 // a small succulent
  v.ellipsoid(42, T + 3.5, 7, 2.6, 1.5, 2.6, M('#5f9150', 2));
  return v;
}

/** A brass service bell for the reception counter: base, dome, button. 8 × 8 × 8. */
export function bell() {
  const v = new Vox();
  const brass = M(BRASS, 0), dark = tone(brass, -0.42), mid = tone(brass, -0.16), lite = tone(brass, 0.22);
  v.cyl('y', 0, 0, 0, 1, 4, dark);                                   // base
  v.cyl('y', 0, 0, 1, 4, 3.6, brass);                                // dome
  v.paint(-4, 1, -4, 4, 2, 4, mid);
  v.cyl('y', 0, 0, 4, 5, 3.1, brass);
  v.cyl('y', 0, 0, 5, 6, 2.1, mid);
  v.paint(-3, 3, 0, -1, 5, 3, lite);                                 // where the light catches it
  v.cyl('y', 0, 0, 6, 7, 0.8, dark);                                 // plunger
  v.cyl('y', 0, 0, 7, 8, 0.8, lite);                                 // button
  return v;
}

/** The guestbook: an open book on a slim brass stand, pen on a chain. The reader stands on +z. 20 × 40 × 18. */
export function guestbook() {
  const v = new Vox();
  const brass = M(BRASS, 0), bd = tone(brass, -0.32), bl = tone(brass, 0.26), wood = M(WOOD_DARK, 2), wd = tone(wood, -0.26);
  const top = (z) => 36 - Math.floor((z + 9) * 5 / 18);              // the board tilts toward the reader
  v.cyl('y', 0, 0, 0, 1, 8, bd);                                     // weighted foot
  v.cyl('y', 0, 0, 1, 2, 7, brass);
  v.cyl('y', 0, 0, 2, 3, 4.2, brass);
  v.cyl('y', 0, 0, 3, 30, 1.6, brass);                               // column
  v.cyl('y', 0, 0, 15, 17, 2.6, bl);
  v.cyl('y', 0, 0, 28, 31, 2.6, bd);
  for (let z = -9; z < 9; z++) {
    const y = top(z);
    if (z >= -5 && z < 5) v.box(-4, 31, z, 4, y - 2, z + 1, wd);
    v.box(-10, y - 2, z, 10, y, z + 1, (x, yy) => (yy === y - 2 ? wd : wood));
  }
  v.box(-10, top(8), 8, 10, top(8) + 1, 9, wd);                      // lip

  const cover = M('#6e2a2c', 1), page = M(PAPER, 0), ink = M('#5a6fa8', 0);
  for (let z = -8; z < 8; z++) {
    const y = top(z);
    v.box(-9, y, z, 9, y + 1, z + 1, cover);
    if (z > -8 && z < 7) { v.box(-8, y + 1, z, 8, y + 2, z + 1, page); v.box(-7, y + 2, z, -1, y + 3, z + 1, page); v.box(1, y + 2, z, 7, y + 3, z + 1, page); }
  }
  [[-5, 5], [-3, 4], [-1, 6], [1, 3], [3, 5], [5, 4]].forEach(([z, w]) => v.box(-6, top(z) + 2, z, -6 + w, top(z) + 3, z + 1, ink));   // a full page of names
  [[-5, 4], [-3, 5], [-1, 3]].forEach(([z, w]) => v.box(2, top(z) + 2, z, 2 + w, top(z) + 3, z + 1, ink));                        // and room for yours
  for (const [y, z] of [[top(7) + 1, 7], [top(8) + 1, 8], [top(8), 9], [top(8) - 1, 9], [top(8) - 2, 9], [top(8) - 3, 9]]) v.set(-4, y, z, M('#b5483f', 3));   // ribbon

  const p = top(5) + 3;                                              // the pen, and its chain looping down the front
  v.box(2, p, 5, 6, p + 1, 6, M('#2b2b30', 0)); v.set(6, p, 5, brass);
  const chain = [[7, p - 1, 5], [7, top(6) + 2, 6], [7, top(7) + 1, 7], [7, top(8) + 1, 8], [7, top(8), 9]];
  for (let y = top(8) - 1; y >= top(8) - 6; y--) chain.push([7, y, 9]);
  for (let x = 6; x >= 4; x--) chain.push([x, top(8) - 6, 9]);
  for (let y = top(8) - 6; y <= top(8) - 1; y++) chain.push([3, y, 9]);
  chain.forEach(([x, y, z], i) => v.set(x, y, z, i % 2 ? bd : bl));
  return v;
}

/** The trophy case: glass front on +z, three lit shelves of things people have found. 56 × 60 × 20. */
export function trophycase(opt = {}) {
  const v = new Vox();
  const wood = M(WOOD_DARK, 2), dark = tone(wood, -0.28), pale = tone(wood, 0.2), felt = M(opt.felt || '#2e5a48', 3), brass = M(BRASS, 0), k = M(BLACK, 0);
  const gl = glass(opt.glass || '#bfe0ea'), gold = M('#e8c45a', 0), goldD = M('#caa24a', 0), goldL = M('#f6e08a', 0), silver = M('#b4bcc8', 0);
  v.box(-28, 0, -10, 28, 60, 9, wood);                               // carcass
  v.paint(-28, 0, -10, 28, 2, 9, dark);                              // plinth
  v.paint(-28, 59, -10, 28, 60, 9, pale); v.paint(-28, 56, -10, 28, 57, 9, dark);    // cornice
  v.carve(-26, 10, -8, 26, 56, 9);                                   // hollow, open at the front
  for (const x of [-26, 1]) { v.paint(x, 3, 8, x + 25, 9, 9, pale); v.box(x + 11, 6, 9, x + 14, 7, 10, brass); }   // two drawers below
  v.paint(-24, 14, -10, 24, 52, -9, pale);                           // panelled back
  v.box(-6, 57, 9, 6, 59, 10, brass);                                // plate on the cornice
  v.box(-26, 10, -8, 26, 56, -7, felt);                              // lined in green baize
  v.paint(-26, 9, -8, 26, 10, 8, felt);
  for (const x of [-26, 24]) v.box(x, 10, 8, x + 2, 56, 9, wood);    // door frame
  v.box(-24, 10, 8, 24, 12, 9, wood); v.box(-24, 55, 8, 24, 56, 9, wood);
  v.box(-1, 10, 9, 1, 12, 10, brass);                                // lock
  v.box(-24, 12, 8, 24, 55, 9, gl);                                  // glass front
  for (const y of [24, 39]) {                                        // glass shelves on brass pins
    v.box(-25, y, -6, 25, y + 1, 7, gl);
    for (const x of [-26, 25]) for (const z of [-4, 3]) v.set(x, y, z, brass);
  }
  v.box(-20, 52, 6, 20, 53, 7, glow('#ffe9b8'));                     // strip light
  for (const x of [-19, 18]) v.box(x, 53, 6, x + 1, 56, 7, brass);

  // top shelf: the cup, a star, a medal
  v.box(-3, 40, -3, 3, 42, 3, k); v.paint(-2, 40, 2, 2, 41, 3, brass);
  v.cyl('y', 0, 0, 42, 43, 1.6, goldD);
  v.cyl('y', 0, 0, 43, 45, 0.8, gold);
  v.cyl('y', 0, 0, 45, 46, 1.6, goldD);
  v.cyl('y', 0, 0, 46, 47, 2.6, gold);
  v.cyl('y', 0, 0, 47, 52, 3.6, gold);
  v.cyl('y', 0, 0, 51, 52, 2.6, 0); v.cyl('y', 0, 0, 50, 51, 2.6, goldD);
  v.paint(-3, 47, 1, -1, 51, 4, goldL);
  for (const s of [-1, 1]) {
    const a = s < 0 ? -6 : 4, b = s < 0 ? -6 : 5;
    v.box(a, 50, -1, a + 2, 51, 1, gold); v.box(b, 48, -1, b + 1, 50, 1, gold); v.box(a, 47, -1, a + 2, 48, 1, goldD);
  }
  v.box(-21, 40, -2, -10, 42, 2, k);
  ['....#....', '...###...', '...###...', '#########', '.#######.', '..#####..', '..#####..', '.###.###.', '##.....##'].forEach((row, i) => {
    for (let c = 0; c < 9; c++) if (row[c] === '#') v.box(-20 + c, 50 - i, -1, -19 + c, 51 - i, 1, i < 4 && c < 5 ? goldL : gold);
  });
  v.box(14, 46, -7, 18, 53, -6, (x) => (x === 14 || x === 17 ? M('#b5483f', 3) : M('#e9dcc0', 3)));
  v.cyl('z', 16, 44, -7, -6, 2.6, gold); v.box(15, 43, -7, 17, 45, -6, goldD);

  // middle shelf: the duck, the golden semicolon, a floppy disk
  const duck = M('#f2cf3a', 1);
  v.ellipsoid(-14, 28, 0, 4, 3, 3, duck);
  v.box(-19, 29, -1, -17, 31, 1, duck);
  v.sphere(-11, 32, 0, 2.3, duck);
  v.box(-9, 31, -1, -7, 32, 1, M('#e8843a', 1));
  v.set(-10, 32, 1, k); v.set(-10, 32, -2, k);
  v.box(-4, 25, -3, 4, 27, 3, k); v.box(-3, 27, -2, 3, 37, -1, k);
  v.box(-1, 34, -1, 1, 36, 1, gold); v.box(-1, 30, -1, 1, 32, 1, gold); v.box(-2, 28, -1, 0, 30, 1, gold);
  const disk = M('#2f4a8a', 0);
  v.box(9, 25, -2, 19, 27, 2, k); v.box(13, 27, -1, 15, 32, 0, k);
  v.box(10, 27, 0, 18, 35, 1, disk); v.carve(17, 34, 0, 18, 35, 1);
  v.box(12, 32, 0, 16, 35, 1, silver); v.box(14, 32, 0, 15, 34, 1, disk);
  v.box(11, 27, 0, 17, 31, 1, M(PAPER, 0)); v.box(12, 29, 0, 16, 30, 1, M('#8fa0c8', 0));

  // bottom shelf: second place, the red book, a ghost
  v.box(-18, 10, -2, -12, 11, 2, k);
  v.cyl('y', -15, 0, 11, 13, 0.8, silver);
  v.cyl('y', -15, 0, 13, 14, 1.6, silver);
  v.cyl('y', -15, 0, 14, 18, 2.6, silver);
  v.cyl('y', -15, 0, 17, 18, 1.6, 0);
  layBook(v, -5, 10, -4, 10, 7, '#b5483f', '+z', 3); v.box(-3, 12, -2, 3, 13, 0, goldD);
  const ghost = M('#f4f1ea', 1);
  v.box(11, 11, -2, 17, 16, 2, ghost); v.box(12, 16, -2, 16, 17, 2, ghost); v.box(13, 17, -1, 15, 18, 1, ghost);
  for (const x of [11, 13, 14, 16]) v.box(x, 10, -2, x + 1, 11, 2, ghost);
  v.set(12, 15, 1, k); v.set(15, 15, 1, k); v.set(13, 13, 1, k); v.set(14, 13, 1, k);
  return v;
}

/** A coir doormat that says HI. Flat on the floor: 64 × 1 × 32. */
export function doormat() {
  const v = new Vox();
  const coir = M('#a47c48', 3), edge = M('#553c26', 3), line = tone(coir, -0.18), ink = M('#3b2a1c', 3), fleck = tone(coir, 0.1);
  const letter = (x, z) => (x >= -17 && x < -3 && (x < -13 || x >= -7 || (z >= -2 && z < 2)))        // H
    || (x >= 5 && x < 17 && (z < -4 || z >= 4 || (x >= 9 && x < 13)));                               // I
  v.box(-32, 0, -16, 32, 1, 16, (x, y, z) => {
    const inset = Math.min(x + 32, 31 - x, z + 16, 15 - z);
    if (inset < 2) return edge;
    if (inset === 4) return line;
    if (z >= -8 && z < 8 && letter(x, z)) return ink;
    return inset > 5 && noise3(x >> 1, 0, z >> 1, 7) > 0.9 ? fleck : coir;
  });
  return v;
}

/* ---- on the walls ----------------------------------------------------------- */

/** "The Old Office": a gilt-framed pixel painting of the 2D office. Hangs on a wall (back at z = 0), sticks out toward +z. 44 × 32 × 3. */
export function painting() {
  const v = new Vox();
  const gilt = M(BRASS, 0), giltL = tone(gilt, 0.3), giltD = tone(gilt, -0.34);
  v.box(-22, 0, 0, 22, 32, 2, gilt);                                 // frame
  v.box(-21, 1, 0, 21, 31, 3, giltL);                                // its ridge
  v.box(-20, 2, 0, 20, 30, 2, giltD); v.carve(-20, 2, 2, 20, 30, 3); // inner lip
  v.carve(-19, 3, 1, 19, 29, 3);                                     // the canvas sits back
  for (const x of [-22, 20]) for (const y of [0, 30]) v.box(x, y, 0, x + 2, y + 2, 3, giltL);          // corner blocks
  v.box(-5, 0, 0, 5, 2, 3, M('#e9dcc0', 0)); v.paint(-3, 1, 2, 3, 2, 3, M('#6b4a2f', 0));              // title plate

  // the picture, 38 × 26, x from the left, y from the bottom; `up` raises a thing off the canvas
  const px = (x, y, w, h, c, up = 0) => v.box(x - 19, y + 3, 0, x - 19 + w, y + 3 + h, 1 + up, c);
  px(0, 11, 38, 15, '#3f8a82');                                      // teal wall
  px(0, 6, 38, 5, '#a8763f'); px(0, 10, 38, 1, '#7d5630');           // wainscot and its rail
  for (let x = 5; x < 38; x += 6) px(x, 6, 1, 4, '#7d5630');
  px(0, 0, 38, 6, '#6e5f55'); px(0, 5, 38, 1, '#4a3526');            // floor, skirting
  px(14, 14, 16, 4, '#8a4f7a'); px(14, 18, 16, 3, '#5d3f7d'); px(14, 21, 16, 3, '#3a2f5e');           // dusk in the window
  px(26, 21, 2, 2, '#f4ecc8');                                       // moon
  for (const [x, w, h] of [[14, 3, 5], [17, 2, 3], [19, 3, 7], [22, 2, 4], [24, 3, 6], [27, 3, 3]]) px(x, 14, w, h, '#2a2242');   // skyline
  for (const [x, y] of [[15, 16], [15, 18], [20, 15], [20, 19], [23, 16], [25, 18], [28, 15]]) px(x, y, 1, 1, glow('#f2d45c'));  // lit windows
  px(13, 13, 18, 1, '#5a3a22', 1); px(13, 24, 18, 1, '#5a3a22', 1); px(13, 13, 1, 12, '#5a3a22', 1); px(30, 13, 1, 12, '#5a3a22', 1);   // window frame
  px(21, 14, 1, 10, '#5a3a22', 1);
  px(1, 5, 6, 11, '#8a8f96', 1);                                     // filing cabinet
  for (const y of [6, 9, 12]) { px(2, y, 4, 3, '#aab0b8', 1); px(3, y + 2, 2, 1, '#5a626e', 1); }
  px(1, 18, 6, 2, '#6b4a2f', 1); px(2, 18, 4, 1, '#d9b06a', 1);      // PROJECT
  for (const x of [10, 20, 30]) {                                    // three desks, three monitors
    px(x, 1, 1, 3, '#6b4a2f', 1); px(x + 7, 1, 1, 3, '#6b4a2f', 1);
    px(x, 4, 8, 2, '#9a6a3c', 1); px(x + 3, 5, 2, 1, '#c9a24a', 1);
    px(x, 6, 8, 1, '#c99a5a', 1);
    px(x + 3, 7, 2, 1, '#2b2b30', 1); px(x + 2, 8, 4, 3, '#2b2b30', 1);
    px(x + 3, 9, 2, 1, glow('#86e0a8'), 1);
  }
  px(7, 1, 3, 2, '#2f3440', 1); px(7, 3, 3, 4, '#8a5a8f', 1); px(7, 7, 3, 3, '#f3cda8', 1);            // somebody, in a party hat
  px(7, 8, 1, 1, '#2b2b30', 1); px(9, 8, 1, 1, '#2b2b30', 1);
  px(7, 10, 3, 1, '#d8493f', 1); px(8, 11, 1, 1, '#e8c45a', 1); px(8, 12, 1, 1, '#f4f1ea', 1);
  return v;
}

/** The clock's face: centre and radius in voxels; z is the dial's front surface (the rim stands one voxel further out). */
export const CLOCK_FACE = Object.freeze({ x: -0.5, y: 9.5, z: 2.08, r: 7.5 });

/** A round wall clock with twelve ticks and no hands — the scene lays those over CLOCK_FACE. Hangs on a wall (back at z = 0). 19 × 19 × 3. */
export function clock() {
  const v = new Vox();
  const rim = M('#2f2a2a', 0), face = M(PAPER, 0), tick = M('#3a3530', 0);
  const X = CLOCK_FACE.x, Y = CLOCK_FACE.y;
  v.cyl('z', X, Y, 0, 2, 9.4, tone(rim, -0.2));                      // case
  v.cyl('z', X, Y, 0, 3, 8.6, rim);                                  // bezel
  v.cyl('z', X, Y, 2, 3, 7.5, 0);
  v.cyl('z', X, Y, 0, 2, 7.5, face);                                 // dial
  const dot = (dx, dy, c = tick) => v.set(-1 + dx, 9 + dy, 1, c);
  for (const s of [1, -1]) for (const r of [5, 6]) { dot(0, s * r); dot(s * r, 0); }                   // 12, 3, 6, 9
  for (const sx of [1, -1]) for (const sy of [1, -1]) { dot(sx * 3, sy * 5, M('#7d766b', 0)); dot(sx * 5, sy * 3, M('#7d766b', 0)); }
  dot(0, 0);                                                         // where the hands pivot
  return v;
}

/* ---- the catalogue ---------------------------------------------------------- */

export const CATALOGUE = {
  armchair: { make: (o) => armchair({ color: o?.color || LEATHERS[pick(o, 2)], book: pick(o, 2) ? '#3f7f9a' : '#b5483f' }), variant: (o) => o?.color || String(pick(o, 2)), seat: 15 },
  sidetable: { make: (o) => sidetable({ lamp: pick(o, 3) === 2 }), variant: (o) => (pick(o, 3) === 2 ? 'lamp' : 'tea') },
  lectern: { make: () => lectern() },
  globe: { make: () => globe() },
  bench: { make: () => bench(), seat: 16 },
  catbed: { make: () => catbed() },
  reception: { make: () => reception() },
  bell: { make: () => bell(), y: RECEPTION_TOP * VOXEL },
  guestbook: { make: () => guestbook() },
  trophycase: { make: (o) => trophycase({ glass: o?.glass && '#' + o.glass, felt: o?.felt && '#' + o.felt }) },
  doormat: { make: () => doormat() },
  painting: { make: () => painting(), wall: true, y: 1.25 },
  clock: { make: () => clock(), wall: true, y: 1.75 },
};
