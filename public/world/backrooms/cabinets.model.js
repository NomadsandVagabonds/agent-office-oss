// The Backrooms — the filing cabinets, sculpted. Pure: numbers in, voxels out.
// A family of office steel at half-size voxels (1.25 cm, as storage.model.js: place with `scale: CABINETS.scale`),
// the front at +z, the foot on y = 0, centred on x and on the carcase's depth:
//   two · three · four   verticals, 0.5 m wide, 0.55 m deep: two, three or four drawers (0.87, 1.26, 1.65 m)
//   tall                 the same with five (2.04 m): taller than anybody down here
//   lateral              0.9 m wide, 0.45 m deep, three wide drawers with a long pull (1.26 m)
// Every one of them is grey or beige paint gone tired: dented in a side, scuffed pale at the corners and along the
// foot, rust coming through at the plinth, a scratch or two on top, and a chrome holder on every drawer with a card in
// it that somebody wrote on. Which dents and scuffs a cabinet has is its `wear` (0…7); which of its drawers is dented
// in (and so stuck: cabinets.js) follows from that and nothing else, so what is seen is what happens.
//
// Each drawer is a part of its own: `drawerFront` (the front, its pull, its card, the lock on the top one) and
// `drawerBody` (the tray behind it and what is in it), drawn where the drawer is when it is shut. `carcase` is the rest,
// with a shallow dark recess behind each drawer that can be opened (`bays`); `whole` is a cabinet none of whose drawers
// will open, in one piece, for piles and anything cut by the structure.
import { Vox, M, tone, noise3, glow } from '../vox/vox.js';

const KIND = {
  two: { W: 40, D: 44, n: 2, lateral: false },
  three: { W: 40, D: 44, n: 3, lateral: false },
  four: { W: 40, D: 44, n: 4, lateral: false },
  tall: { W: 40, D: 44, n: 5, lateral: false },
  lateral: { W: 72, D: 36, n: 3, lateral: true },
};
const PITCH = 31, FOOT = 4, LID = 3;

export const CABINETS = Object.freeze({
  scale: 0.5,
  voxel: 0.0125,
  kinds: Object.freeze(Object.keys(KIND)),
  // office paint: two greys, a putty, a beige, an olive grey
  paints: Object.freeze(['#8f9488', '#a3a395', '#b0a78f', '#bcb39b', '#7f857a']),
  wears: 8,
  pitch: PITCH,
});

/** A kind's measurements, in voxels: W, D, n, h (to the top of the lid), and each drawer's front { y0, y1 } (inclusive). */
export function dims(kind) {
  const k = KIND[kind] || KIND.three, h = FOOT + k.n * PITCH + LID;
  const bays = [];
  for (let i = 0; i < k.n; i++) { const y0 = FOOT + 2 + i * PITCH; bays.push({ y0, y1: y0 + PITCH - 3 }); }
  return { ...k, h, bays, front: k.D / 2, x0: -k.W / 2, x1: k.W / 2 - 1, z0: -k.D / 2, z1: k.D / 2 + 3 };
}

/** Which drawers of a cabinet of this wear are dented in: about one in seven. Pure; the same everywhere. */
export function dented(kind, wear) {
  const { n } = dims(kind), out = [];
  for (let i = 0; i < n; i++) out.push(noise3(wear | 0, i, n, 77) < 0.15);
  return out;
}

const INK = '#2f3a5c', CARD = '#efe8d2', CHROME = '#c9cbc5', GAP = '#24261f', RUST = '#7a5a3c';
const tools = (v) => ({
  B: (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c),
  P: (x0, y0, z0, x1, y1, z1, c) => v.paint(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c),
  K: (x0, y0, z0, x1, y1, z1) => v.carve(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1),
});
const paintOf = (p) => CABINETS.paints[((p | 0) % CABINETS.paints.length + CABINETS.paints.length) % CABINETS.paints.length];

/**
 * The carcase: the case, its plinth, its lid; the dark line round each drawer; a recess behind each drawer in `bays`
 * (a bit mask: drawer i is bit i) where that drawer can be pulled out; and its wear.
 */
export function carcase(kind, o = {}) {
  const v = new Vox(), { B, P, K } = tools(v), d = dims(kind), { W, D, h } = d, x0 = -W / 2, x1 = W / 2 - 1, z0 = -D / 2, z1 = D / 2 - 1;
  const col = paintOf(o.paint), wear = o.wear | 0;
  const st = M(col, 1), lite = M(tone(col, 0.12), 1), dark = M(tone(col, -0.22), 1), gap = M(GAP, 0), rust = M(RUST, 2), pale = M(tone(col, 0.3), 1);
  B(x0 + 2, 0, z0 + 2, x1 - 2, FOOT - 1, z1 - 1, gap);                                  // the plinth, set back
  B(x0, FOOT, z0, x1, h - 1, z1, st);
  P(x0, h - 2, z0, x1, h - 1, z1, lite); P(x0, h - 1, z0 + 1, x1, h - 1, z1 - 1, st);    // the lid's rolled edge
  P(x0, FOOT, z0, x1, FOOT + 1, z1, dark);
  for (const x of [x0, x1]) { P(x, FOOT + 2, -1, x, h - 3, -1, dark); P(x, FOOT + 2, 0, x, h - 3, 0, lite); }   // where the sheet is folded
  d.bays.forEach((b, i) => {
    P(x0 + 1, b.y0 - 1, z1, x1 - 1, b.y1 + 1, z1, gap);
    if ((o.bays >> i) & 1) { K(x0 + 2, b.y0, z1 - 2, x1 - 2, b.y1, z1); P(x0 + 2, b.y0, z1 - 3, x1 - 2, b.y1, z1 - 3, gap); P(x0 + 1, b.y0 - 1, z1 - 2, x0 + 1, b.y1, z1, gap); P(x1 - 1, b.y0 - 1, z1 - 2, x1 - 1, b.y1, z1, gap); }
  });
  // twenty years: rust along the foot, the corners rubbed pale, a dent or two in the sides, scratches on the lid
  for (let x = x0; x <= x1; x++) for (const z of [z0, z1]) for (let y = FOOT; y < FOOT + 6; y++) if (noise3(x >> 1, y, z, 4 + wear) > 0.82 - (FOOT + 6 - y) * 0.03) v.set(x, y, z, rust);
  for (let z = z0; z <= z1; z++) for (const x of [x0, x1]) for (let y = FOOT; y < FOOT + 5; y++) if (noise3(x, y, z >> 1, 9 + wear) > 0.84) v.set(x, y, z, rust);
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) for (let y = FOOT + 2; y < h; y++) if (noise3(x, y >> 1, z, 13 + wear) > 0.7) v.set(x, y, z, pale);
  for (let k = 0; k < 2 + (wear % 3); k++) {                                           // dents: a dark crease and a hollow, in either side or the back
    const side = (wear + k) % 3, cy = FOOT + 10 + Math.floor(noise3(wear, k, 1, 21) * (h - FOOT - 24)), cz = z0 + 6 + Math.floor(noise3(wear, k, 2, 21) * (D - 14)), r = 3 + ((wear + k) % 3);
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      if (a * a + b * b > r * r) continue;
      if (side < 2) { const x = side ? x1 : x0; v.set(x, cy + a, cz + b, a * a + b * b < (r - 1) * (r - 1) ? dark : M(tone(col, -0.1), 1)); if (a * a + b * b <= 2) v.set(x, cy + a, cz + b, 0); }
      else { const cx = Math.round(x0 + 6 + (cz - z0) * (W - 12) / D); v.set(cx + b, cy + a, z0, a * a + b * b < (r - 1) * (r - 1) ? dark : st); }
    }
  }
  for (let k = 0; k < 3; k++) {                                                        // scratches across the lid, pale
    const zs = z0 + 4 + Math.floor(noise3(wear, k, 5, 31) * (D - 8)), xs = x0 + 3 + Math.floor(noise3(wear, k, 6, 31) * (W - 20));
    for (let t = 0; t < 12; t++) v.set(xs + t, h - 1, zs + (t >> 2) * (k % 2 ? 1 : -1), pale);
  }
  return v;
}

/** What is written on a card: a few strokes in somebody's hand, different for each drawer and each wear. */
function card(v, x0, y0, z, w, hgt, seed, ink) {
  const { B, P } = tools(v);
  B(x0, y0, z, x0 + w - 1, y0 + hgt - 1, z, M(CHROME, 0));
  P(x0 + 1, y0 + 1, z, x0 + w - 2, y0 + hgt - 2, z, M(CARD, 0));
  const lines = hgt > 6 ? 2 : 1;
  for (let l = 0; l < lines; l++) {
    const yy = y0 + (lines === 2 ? 2 + l * 2 : (hgt >> 1)), len = 3 + Math.floor(noise3(seed, l, 3, 41) * (w - 6));
    for (let t = 0; t < len; t++) if (noise3(seed, l, t, 43) > 0.18) v.set(x0 + 2 + t, yy, z, ink);
  }
}

/**
 * Drawer i's front, where it is when shut: proud of the carcase, a dark edge under it and a pale one on top, a pull, a
 * card in its holder, and on the top drawer the cabinet's lock (pushed in when the cabinet is locked: one lock does all).
 * Paint chipped at its edges; dented in where `dented` says.
 */
export function drawerFront(kind, i, o = {}) {
  const v = new Vox(), { B, P } = tools(v), d = dims(kind), b = d.bays[i], { W } = d, z = d.front, col = paintOf(o.paint), wear = o.wear | 0;
  const lite = M(tone(col, 0.1), 1), dark = M(tone(col, -0.2), 1), top = M(tone(col, 0.2), 1), chrome = M(CHROME, 0), gap = M(GAP, 0);
  const x0 = -W / 2 + 1, x1 = W / 2 - 2;
  B(x0, b.y0, z, x1, b.y1, z + 1, lite);
  P(x0, b.y0, z + 1, x1, b.y0, z + 1, dark); P(x0, b.y1, z + 1, x1, b.y1, z + 1, top);
  for (let x = x0; x <= x1; x++) for (const y of [b.y0, b.y1]) if (noise3(x, y, i, 51 + wear) > 0.86) v.set(x, y, z + 1, M('#5d5a50', 2));    // chipped to the primer
  const ink = M(INK, 0), seed = wear * 11 + i * 3 + 1;
  if (!d.lateral) {
    const py = b.y0 + 18;
    for (const x of [-8, 7]) B(x, py, z + 2, x, py + 1, z + 2, dark);
    B(-9, py, z + 3, 8, py + 1, z + 3, chrome);
    card(v, -7, b.y0 + 5, z + 2, 14, 8, seed, ink);
  } else {
    const py = b.y1 - 6;
    B(x0 + 6, py, z + 2, x1 - 6, py, z + 2, dark); B(x0 + 6, py + 1, z + 2, x1 - 6, py + 2, z + 3, chrome);
    card(v, x0 + 4, b.y0 + 5, z + 2, 16, 7, seed, ink);
  }
  if (i === d.n - 1) {                                                                  // the lock
    const lx = x1 - 4, ly = b.y1 - 4;
    B(lx, ly, z + 2, lx + 1, ly + 1, z + (o.locked ? 2 : 3), chrome); v.set(lx, ly, z + (o.locked ? 2 : 3), gap);
  }
  if (dented(kind, wear)[i]) {                                                          // a kick, low on one side: it will not come out now
    const cx = (wear % 2 ? x1 - 9 : x0 + 9), cy = b.y0 + 9;
    for (let a = -5; a <= 5; a++) for (let c2 = -4; c2 <= 4; c2++) {
      const r2 = a * a + c2 * c2; if (r2 > 25) continue;
      v.set(cx + a, cy + c2, z + 1, r2 < 9 ? 0 : M(tone(col, -0.3), 1));
      if (r2 < 9) v.set(cx + a, cy + c2, z, M(tone(col, -0.38), 1));
    }
    for (let t = -6; t <= 6; t++) v.set(cx + t, cy + (t >> 2), z + 1, M(tone(col, -0.45), 1));
  }
  return v;
}

const FILL = ['files', 'paper', 'empty'];
/** The odd things a drawer might hold instead (seldom: cabinets.js says how seldom). Only to be looked at. */
export const ODD = Object.freeze(['carpet', 'wallpaper', 'tube', 'keys', 'shoe', 'phone']);

/**
 * The tray behind drawer i, `len` voxels deep from the back of its front, and what is in it: `fill` one of 'files'
 * (hanging folders, manila and green, tabs up), 'paper' (a ream gone soft, and loose sheets), 'empty' (dust, a
 * paperclip) or an ODD thing.
 */
export function drawerBody(kind, i, o = {}) {
  const v = new Vox(), { B, P } = tools(v), d = dims(kind), b = d.bays[i], { W } = d, len = o.len || d.D - 8, wear = o.wear | 0;
  const zf = d.front - 1, zb = d.front - len, x0 = -W / 2 + 3, x1 = W / 2 - 4, y0 = b.y0 + 1, y1 = b.y1 - 3;
  const tray = M('#5f625a', 1), inner = M('#43463f', 1);
  B(x0, y0, zb, x1, y0, zf, inner);                                                     // bottom, sides, back
  for (const x of [x0, x1]) B(x, y0, zb, x, y1, zf, tray);
  B(x0, y0, zb, x1, y1, zb, tray);
  for (const x of [x0 + 1, x1 - 1]) B(x, y1 - 1, zb + 1, x, y1, zf, M('#8a8d84', 0));    // the rails the folders hang from
  const ix0 = x0 + 1, ix1 = x1 - 1, iz0 = zb + 1, iz1 = zf - 1, fill = o.fill || 'empty', s = wear * 13 + i * 5;
  if (fill === 'files') {
    const manila = M('#d6bf86', 2), green = M('#6b8a62', 2), pale = M('#e3d6ae', 2), paper = M('#f1ebda', 0);
    for (let z = iz0 + 1, k = 0; z <= iz1 - 1; z += 3, k++) {
      if (noise3(s, k, 1, 61) < 0.18) continue;                                         // a gap where one was taken out
      const c = noise3(s, k, 2, 61) < 0.3 ? green : noise3(s, k, 3, 61) < 0.5 ? pale : manila, hh = y1 - 2 - Math.floor(noise3(s, k, 4, 61) * 4);
      B(ix0 + 1, y0 + 2, z, ix1 - 1, hh, z, c);
      if (noise3(s, k, 6, 61) < 0.5) P(ix0 + 2, hh - 1, z, ix1 - 3, hh - 1, z, paper);
      const tx = ix0 + 2 + ((k * 7) % Math.max(1, ix1 - ix0 - 10));
      B(tx, hh + 1, z, tx + 5, hh + 2, z, c); v.set(tx + 1, hh + 1, z, M(CARD, 0)); v.set(tx + 2, hh + 1, z, M(CARD, 0));
    }
  } else if (fill === 'paper') {
    const paper = M('#f1ebda', 0), paper2 = M('#e6dfcb', 0);
    B(ix0 + 2, y0 + 1, iz0 + 2, ix0 + 18, y0 + 7, iz0 + 24 < iz1 ? iz0 + 24 : iz1 - 1, paper);
    for (let y = y0 + 1; y <= y0 + 7; y += 2) P(ix0 + 2, y, iz0 + 2, ix0 + 18, y, iz1, paper2);
    B(ix0 + 4, y0 + 8, iz0 + 4, ix0 + 20, y0 + 8, iz0 + 26 < iz1 ? iz0 + 26 : iz1 - 1, paper);
    B(ix1 - 16, y0 + 1, iz1 - 20, ix1 - 2, y0 + 2, iz1 - 2, paper2);
  } else if (fill === 'empty') {
    for (let x = ix0; x <= ix1; x++) for (let z = iz0; z <= iz1; z++) if (noise3(x, z, s, 71) > 0.9) v.set(x, y0 + 1, z, M('#6a6a60', 3));   // dust
    B(ix0 + 6, y0 + 1, iz1 - 8, ix0 + 9, y0 + 1, iz1 - 8, M(CHROME, 0)); B(ix0 + 6, y0 + 1, iz1 - 7, ix0 + 6, y0 + 1, iz1 - 6, M(CHROME, 0));
  } else if (fill === 'carpet') {
    const c = M('#807a5b', 3);
    B(ix0, y0 + 1, iz0, ix1, y1 - 3, iz1, c);
    for (let x = ix0; x <= ix1; x++) for (let z = iz0; z <= iz1; z++) if (noise3(x, z, s, 73) > 0.75) v.set(x, y1 - 2, z, M('#6f6a4e', 3));
  } else if (fill === 'wallpaper') {
    const a = M('#d8ce88', 1), bb = M('#c6b86e', 1);
    v.remap((x, y, z, val) => (val === tray || val === inner) && (x === x0 || x === x1 || z === zb || y === y0) ? (((x + z) & 3) + (y & 3) === 3 || ((x - z) & 3) === (y & 3) ? bb : a) : val);
  } else if (fill === 'tube') {
    const zc = (iz0 + iz1) >> 1;
    v.cyl('x', y0 + 3, zc, ix0 + 1, ix1, 2, glow('#f4f6e8'));
    for (const x of [ix0, ix1]) B(x, y0 + 1, zc - 2, x, y0 + 5, zc + 2, M('#8b8f86', 0));
  } else if (fill === 'keys') {
    const brass = M('#c9a64a', 0), steel = M('#b9bbb4', 0);
    for (let k = 0; k < 28; k++) {
      const x = ix0 + 1 + Math.floor(noise3(s, k, 1, 81) * (ix1 - ix0 - 6)), z = iz0 + 1 + Math.floor(noise3(s, k, 2, 81) * (iz1 - iz0 - 6)), c = k % 3 ? brass : steel;
      B(x, y0 + 1 + (k & 1), z, x + 1, y0 + 1 + (k & 1), z + 1, c); B(x + 2, y0 + 1 + (k & 1), z, x + 4, y0 + 1 + (k & 1), z, c);
    }
  } else if (fill === 'shoe') {
    const leather = M('#3b2a20', 1), sole = M('#1c1714', 0), zc = (iz0 + iz1) >> 1;
    B(-4, y0 + 1, zc - 9, 4, y0 + 2, zc + 9, sole); B(-4, y0 + 3, zc - 9, 4, y0 + 6, zc + 9, leather); B(-3, y0 + 7, zc - 9, 3, y0 + 9, zc - 2, leather);
    P(-2, y0 + 6, zc - 1, 2, y0 + 6, zc + 6, M('#120d0a', 0));
  } else if (fill === 'phone') {
    const beige = M('#d9d0b8', 0), dk = M('#2b2a26', 0), zc = (iz0 + iz1) >> 1;
    B(-7, y0 + 1, zc - 6, 7, y0 + 4, zc + 6, beige); B(-9, y0 + 5, zc - 3, 9, y0 + 6, zc + 1, beige); B(-9, y0 + 3, zc - 3, -7, y0 + 6, zc + 1, beige); B(7, y0 + 3, zc - 3, 9, y0 + 6, zc + 1, beige);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) v.set(-3 + c * 3, y0 + 4, zc + 2 + r * 1, dk);
    for (let t = 0; t < 14; t++) v.set(9 + (t & 1), y0 + 1, zc + 2 + t - 7, dk);
  }
  return v;
}

/** A cabinet none of whose drawers opens: carcase and fronts in one model (for piles, and for what the structure cuts). */
export function whole(kind, o = {}) {
  const v = carcase(kind, { ...o, bays: 0 });
  for (let i = 0; i < dims(kind).n; i++) v.stamp(drawerFront(kind, i, o));
  return v;
}

/** The fills the ordinary drawers choose from, for cabinets.js (paper is the common thing; see there). */
export { FILL };
