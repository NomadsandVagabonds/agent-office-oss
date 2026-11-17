// The Backrooms — where an office keeps what it is not using, sculpted. Pure: voxels in, voxels out.
// The office keeps its filing cabinet and its moving boxes (props/office.js, props/works.js); down here they are the
// level's own, at half-size voxels (1.25 cm): place with `scale: STORAGE.scale`.
//
// Each is exactly the size of the office's, so that it stands where that stood and is solid where that was. The
// numbers in STORAGE.bounds are twice the office's, and a model that strays outside them has moved a collider.
//   the cabinet   three drawers on a plinth, the front at +z; on top what was on top of the office's: a box and papers
//   the boxes     three stacks, as the office has three (works.js `boxes`, seed 1…3), carton for carton, each with
//                 the one box left open and the same things in it: a desk plant and a poster, binders and a mug, a lamp
import { Vox, M, tone, noise3 } from '../vox/vox.js';

export const STORAGE = Object.freeze({
  scale: 0.5,
  bounds: Object.freeze({
    cabinet: Object.freeze({ x0: -20, y0: 0, z0: -22, x1: 20, y1: 112, z1: 26 }),
    boxes: Object.freeze([
      Object.freeze({ x0: -32, y0: 0, z0: -26, x1: 24, y1: 74, z1: 24 }),
      Object.freeze({ x0: -34, y0: 0, z0: -24, x1: 34, y1: 58, z1: 20 }),
      Object.freeze({ x0: -32, y0: 0, z0: -32, x1: 34, y1: 64, z1: 36 }),
    ]),
  }),
});

const STEEL = '#8f9488', CARD = '#b98d57', CARD_2 = '#c29660', TAPE = '#d9c08a', PAPER = '#f1ead8', INK = '#3a3128', RED = '#b5443a';

// (inclusive at both ends, which is how a joiner thinks; Vox's own boxes stop one short)
const tools = (v) => ({
  B: (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c),
  P: (x0, y0, z0, x1, y1, z1, c) => v.paint(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c),
  K: (x0, y0, z0, x1, y1, z1) => v.carve(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1),
});

/** A three-drawer filing cabinet, and what was left on top of it. */
export function cabinetVox() {
  const v = new Vox(), { B, P } = tools(v);
  const st = M(STEEL, 0), lite = M(tone(STEEL, 0.1), 0), dark = M(tone(STEEL, -0.2), 0), gap = M('#23251f', 0), chrome = M('#c8cac4', 0), rust = M('#7a5a3c', 2);
  // the carcase on a recessed plinth; a rolled edge round the top; a seam down each side where the sheet is folded
  B(-18, 0, -20, 17, 3, 19, gap);
  B(-20, 4, -22, 19, 99, 21, st);
  P(-20, 98, -22, 19, 99, 21, lite); P(-20, 4, -22, 19, 5, 21, dark);
  for (const x of [-20, 19]) { P(x, 6, -1, x, 97, -1, dark); P(x, 6, 0, x, 97, 0, lite); }
  // three drawers: a front standing proud with a dark line all round it, a bar to pull on two posts, a card in a holder
  for (let i = 0; i < 3; i++) {
    const y0 = 7 + i * 31, y1 = y0 + 28;
    P(-19, y0 - 1, 21, 18, y1 + 1, 21, gap);
    B(-18, y0, 22, 17, y1, 23, lite);
    P(-18, y0, 23, 17, y0, 23, dark); P(-18, y1, 23, 17, y1, 23, M(tone(STEEL, 0.18), 0));
    for (const x of [-8, 7]) B(x, y0 + 19, 24, x, y0 + 20, 24, dark);
    B(-9, y0 + 19, 25, 8, y0 + 20, 25, chrome);
    B(-7, y0 + 7, 24, 6, y0 + 13, 24, chrome); P(-6, y0 + 8, 24, 5, y0 + 12, 24, M(PAPER, 0));
    P(-4, y0 + 10, 24, 2, y0 + 10, 24, M(INK, 0));                                                   // what is in it, in somebody's hand
    if (i === 2) { B(13, y1 - 5, 24, 14, y1 - 4, 24, chrome); v.set(13, y1 - 5, 24, gap); }            // one lock does all three
  }
  // twenty years: the paint gone to rust along the foot, and a dent's worth of dark in one side
  for (let x = -20; x <= 19; x++) for (const z of [-22, 21]) for (let y = 4; y < 9; y++) if (noise3(x >> 1, y, z, 4) > 0.8 - (8 - y) * 0.03) v.set(x, y, z, rust);
  for (let z = -22; z <= 21; z++) for (const x of [-20, 19]) for (let y = 4; y < 8; y++) if (noise3(x, y, z >> 1, 4) > 0.84) v.set(x, y, z, rust);
  P(19, 40, -12, 19, 47, -7, dark); P(19, 42, -13, 19, 45, -6, dark);
  // on top: an archive box with its lid on, and a few sheets that never got filed
  const card = M(CARD, 2), lid = M(tone(CARD, 0.08), 2);
  B(-14, 100, -12, 9, 107, 11, card); B(-15, 108, -13, 10, 111, 12, lid);
  P(-15, 108, -13, 10, 108, 12, M(tone(CARD, -0.16), 2));
  P(-6, 103, 11, 1, 105, 11, gap);                                                                     // the hole for a hand
  P(-12, 101, 11, -8, 105, 11, M(PAPER, 0)); P(-11, 103, 11, -9, 103, 11, M(INK, 0));
  B(12, 100, 2, 18, 101, 16, M(PAPER, 0)); B(11, 102, 4, 17, 102, 18, M('#e4dcc6', 0));
  P(12, 102, 6, 15, 102, 6, M(INK, 0)); P(12, 102, 9, 16, 102, 9, M(INK, 0)); P(12, 102, 12, 14, 102, 12, M(INK, 0));
  return v;
}

/**
 * One carton: x0…x0+w, y0…y0+h, z0…z0+d (those ends not included).
 * o: colour · tape 'x' | 'z' (which way it runs over the top) · label (a red sticker) · ship (an address label) ·
 * arrows (this way up) · grip (a hole for a hand in each end) · open (the flaps are up and you can see in)
 */
function carton(v, x0, y0, z0, w, h, d, o = {}) {
  const { B, P, K } = tools(v), col = o.colour || CARD;
  const card = M(col, 2), dark = M(tone(col, -0.16), 2), deep = M(tone(col, -0.5), 2), pale = M(tone(col, 0.08), 2), tape = M(TAPE, 0), ink = M(INK, 0);
  const x1 = x0 + w - 1, y1 = y0 + h - 1, z1 = z0 + d - 1, xc = x0 + (w >> 1), zc = z0 + (d >> 1), alongX = (o.tape || 'x') === 'x';
  B(x0, y0, z0, x1, y1, z1, card);
  P(x0, y0, z0, x1, y0 + 1, z1, dark);                                                                 // the bottom edge, scuffed along the floor
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) for (let y = y0 + 2; y <= y1; y++) if (noise3(x, y >> 1, z, 8) > 0.62) v.set(x, y, z, pale);   // corners rubbed pale
  if (o.open) {
    K(x0 + 1, y1 - 7, z0 + 1, x1 - 1, y1, z1 - 1);
    P(x0 + 1, y1 - 8, z0 + 1, x1 - 1, y1 - 8, z1 - 1, deep);
    // four flaps: the back one stands up, the front one leans out, one side hangs down outside, one is folded out flat
    B(x0, y1 + 1, z0, x1, y1 + 10, z0, card); P(x0, y1 + 10, z0, x1, y1 + 10, z0, dark);
    for (let i = 0; i < 8; i++) B(x0, y1 + 1 + i, z1 + ((i + 1) >> 1), x1, y1 + 1 + i, z1 + ((i + 1) >> 1), i === 7 ? dark : card);
    B(x0 - 2, y1 - 9, z0 + 1, x0 - 1, y1, z1 - 1, pale);
    B(x1 + 1, y1 - 1, z0 + 1, x1 + 8, y1, z1 - 1, pale); P(x1 + 8, y1 - 1, z0 + 1, x1 + 8, y1, z1 - 1, dark);
  } else if (alongX) {
    P(x0, y1, zc - 3, x1, y1, zc + 2, tape); P(x0, y1 - 8, zc - 3, x0, y1, zc + 2, tape); P(x1, y1 - 7, zc - 3, x1, y1, zc + 2, tape);
    P(x0, y1, z0, x0, y1, z1, dark); P(x1, y1, z0, x1, y1, z1, dark); P(x0, y1, zc - 3, x0, y1, zc + 2, tape); P(x1, y1, zc - 3, x1, y1, zc + 2, tape);   // where the flaps end
  } else {
    P(xc - 3, y1, z0, xc + 2, y1, z1, tape); P(xc - 3, y1 - 8, z0, xc + 2, y1, z0, tape); P(xc - 3, y1 - 7, z1, xc + 2, y1, z1, tape);
    P(x0, y1, z0, x1, y1, z0, dark); P(x0, y1, z1, x1, y1, z1, dark); P(xc - 3, y1, z0, xc + 2, y1, z0, tape); P(xc - 3, y1, z1, xc + 2, y1, z1, tape);
  }
  const my = y0 + Math.max(4, (h >> 1) - 5);
  if (o.label) { P(x0 + 4, my, z1, x0 + 17, my + 9, z1, M(RED, 0)); P(x0 + 6, my + 4, z1, x0 + 15, my + 5, z1, M(PAPER, 0)); }
  if (o.ship) {                                                                                        // an address, and the bars under it
    const lx = x1 - 20; P(lx, my, z1, lx + 15, my + 10, z1, M(PAPER, 0));
    P(lx + 2, my + 8, z1, lx + 10, my + 8, z1, ink); P(lx + 2, my + 6, z1, lx + 12, my + 6, z1, ink);
    for (const k of [2, 4, 5, 8, 10, 11, 13]) P(lx + k, my + 1, z1, lx + k, my + 3, z1, ink);
  }
  if (o.arrows) for (const ax of [x1 - 9, x1 - 18]) {                                                   // this way up, twice
    P(ax, my, z1, ax + 1, my + 5, z1, ink); P(ax, my + 8, z1, ax + 1, my + 8, z1, ink); P(ax - 1, my + 7, z1, ax + 2, my + 7, z1, ink); P(ax - 2, my + 6, z1, ax + 3, my + 6, z1, ink); P(ax - 3, my + 5, z1, ax + 4, my + 5, z1, ink);
  }
  if (o.grip) for (const x of [x0, x1]) { const gy = y1 - Math.max(6, h >> 2); P(x, gy, zc - 4, x, gy + 2, zc + 3, deep); }
}

/** The stuff a thing is packed in: crumpled paper, in two heaps. */
function packing(v, x, y, z) { const c = M('#e9e3d4', 3); v.ellipsoid(x + 5, y, z + 7, 6, 3, 6, c); v.ellipsoid(x + 19, y, z + 15, 7, 4, 6, c); }

/**
 * A stack of moving boxes.
 * @param {number} [arrangement] 0, 1 or 2: which of the three stacks (the office's seed 1, 2, 3)
 */
export function boxesVox(arrangement = 0) {
  const v = new Vox(), { B, P } = tools(v), a = ((Math.round(Number(arrangement) || 0) % 3) + 3) % 3;
  if (a === 0) {
    carton(v, -32, 0, -26, 56, 26, 50, { tape: 'x', label: true, ship: true, grip: true });
    carton(v, -25, 26, -21, 44, 22, 40, { tape: 'z', arrows: true, colour: CARD_2 });
    carton(v, -18, 48, -16, 32, 16, 30, { open: true });
    const x = -14, y = 58, z = -12;                                                                    // somebody's desk plant, and a poster rolled up
    packing(v, x, y, z);
    v.cyl('y', x + 20, z + 4, y - 5, y + 14, 3, M('#5f86b0', 1)); v.cyl('y', x + 20, z + 4, y + 13, y + 14, 2, M(PAPER, 0));
    B(x + 4, y, z + 16, x + 9, y + 4, z + 21, M('#a5552f', 1)); P(x + 4, y + 4, z + 16, x + 9, y + 4, z + 21, M('#8c4526', 1));
    v.ellipsoid(x + 7, y + 8, z + 19, 5, 4, 5, M('#5f9150', 2)); v.ellipsoid(x + 10, y + 11, z + 17, 3, 3, 3, M('#86c06a', 2)); v.ellipsoid(x + 4, y + 11, z + 20, 2.4, 2.4, 2.4, M('#6fa35c', 2));
  } else if (a === 1) {
    carton(v, -34, 0, -24, 34, 28, 44, { tape: 'z', grip: true, ship: true });
    carton(v, 2, 0, -22, 32, 24, 40, { tape: 'x', grip: true, arrows: true, colour: CARD_2 });
    carton(v, -27, 28, -20, 34, 20, 36, { open: true, colour: CARD_2 });
    const x = -23, y = 42, z = -16;                                                                    // ring binders, standing, and a mug
    packing(v, x, y, z);
    [['#b5443a', 13], ['#3f8f8a', 11], ['#d8b24a', 13], ['#4a3f35', 9]].forEach(([c, h], i) => {
      B(x + 9 + i * 4, y - 3, z + 2, x + 11 + i * 4, y + h, z + 20, M(c, 1)); B(x + 12 + i * 4, y - 3, z + 3, x + 12 + i * 4, y + h - 1, z + 19, M(PAPER, 0));
      P(x + 9 + i * 4, y + 4, z + 20, x + 11 + i * 4, y + 8, z + 20, M(PAPER, 0)); v.set(x + 10, y + 1, z + 20, M('#c8cac4', 0));
    });
    B(x + 1, y - 2, z + 23, x + 6, y + 5, z + 28, M('#e9e3d4', 0)); P(x + 2, y + 5, z + 24, x + 5, y + 5, z + 27, M('#3a2a1e', 0)); B(x + 7, y, z + 25, x + 7, y + 3, z + 26, M('#e9e3d4', 0));
    carton(v, 10, 24, -14, 24, 14, 28, { tape: 'x', label: true });
  } else {
    carton(v, -32, 0, -32, 52, 32, 54, { tape: 'x', arrows: true, grip: true, ship: true });
    carton(v, -24, 32, -22, 38, 22, 38, { open: true });
    const x = -20, y = 48, z = -18;                                                                    // a banker's lamp, shade and all
    packing(v, x, y, z);
    B(x + 12, y - 4, z + 18, x + 15, y + 9, z + 21, M('#c9a24a', 0)); B(x + 9, y - 4, z + 15, x + 18, y - 3, z + 24, M('#c9a24a', 0));
    v.rbox(x + 4, y + 8, z + 14, x + 26, y + 15, z + 26, 3, M('#3f8a5a', 0), 'yz');
    P(x + 4, y + 8, z + 14, x + 5, y + 15, z + 26, M('#c9a24a', 0)); P(x + 24, y + 8, z + 14, x + 25, y + 15, z + 26, M('#c9a24a', 0));
    carton(v, 12, 0, 10, 22, 18, 26, { tape: 'z', label: true, colour: CARD_2 });
    carton(v, -10, 0, 26, 20, 12, 10, { tape: 'x', colour: '#c79a62' });
  }
  return v;
}
