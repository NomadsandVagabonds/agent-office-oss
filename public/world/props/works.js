// The Office — props for the plaza, the supply closet and the server room.
//
// Same rules as office.js: 2.5 cm voxels, floor at y = 0, centred on
// x = z = 0, the side you use faces +z. Sizes are width × height × depth.
//
// The plaza has the office tree (it grows with every finished task, so it
// comes in five stages), the big board and the printer; the closet has the
// shelving, the moving boxes, the robot vacuum and a hatch in the floor; the
// server room has the racks, the ops console and the air conditioner. Vacant
// project rooms get the boxes, a step ladder and a sign on the wall.
import { Vox, M, glow, glass, tone, mix, noise3 } from '../vox/vox.js';
import { hashId } from '/core/look.mjs';

const pick = (o, n) => hashId(String(o?.id || o?.type || '')) % n;

const WOOD = '#9a6a3c', WOOD_DARK = '#6b4a2f', HONEY = '#b98d57', CREAM = '#cfc6b0', STEEL = '#8a8f96', BLACK = '#2b2b30';
const PAPER = '#f1ead8', CARD = '#b98d57', TAPE = '#d9c08a', RED = '#c8473c', TEAL = '#3f7f9a', YELLOW = '#e0b63a', ORANGE = '#e07a2f';
const LED_G = glow('#7fe39a'), LED_A = glow('#ffb84d'), LED_B = glow('#6cb8ff'), LED_R = glow('#ff5a4a');

function rng(seed) {
  let s = (Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/* ---- shared bits: cartons, tins ------------------------------------------- */

/**
 * A cardboard box with its corner at (x0, y0, z0). opt: tape 'x'|'z' (which way the strip runs),
 * label (a red sticker on the front), arrows ("this way up"), grip (hand holes), open (flaps up, things inside).
 */
function carton(v, x0, y0, z0, w, h, d, opt = {}) {
  const card = M(opt.color || CARD, 2), dark = tone(card, -0.18), deep = tone(card, -0.5), tape = M(TAPE, 0);
  const x1 = x0 + w, y1 = y0 + h, z1 = z0 + d, xc = x0 + (w >> 1), zc = z0 + (d >> 1);
  v.box(x0, y0, z0, x1, y1, z1, card);
  v.paint(x0, y0, z0, x1, y0 + 1, z1, dark);                                  // scuffed bottom edge
  const alongX = (opt.tape || 'x') === 'x';
  if (opt.open) {
    v.carve(x0 + 1, y1 - 4, z0 + 1, x1 - 1, y1, z1 - 1);                      // look inside
    v.paint(x0 + 1, y1 - 5, z0 + 1, x1 - 1, y1 - 4, z1 - 1, deep);
    // four flaps: front leans out, back stands up, one side hangs down, one side is folded out flat
    for (let i = 0; i < 4; i++) v.box(x0, y1 + i, z1 - 1 + ((i + 1) >> 1), x1, y1 + i + 1, z1 + ((i + 1) >> 1), i === 3 ? dark : card);
    v.box(x0, y1, z0, x1, y1 + 5, z0 + 1, card);
    v.paint(x0, y1 + 4, z0, x1, y1 + 5, z0 + 1, dark);
    v.box(x0 - 1, y1 - 5, z0 + 1, x0, y1, z1 - 1, tone(card, 0.08));
    v.box(x1, y1 - 1, z0 + 1, x1 + 4, y1, z1 - 1, tone(card, 0.08));
    v.paint(x1 + 3, y1 - 1, z0 + 1, x1 + 4, y1, z1 - 1, dark);
  } else if (alongX) {
    v.paint(x0, y1 - 1, zc - 1, x1, y1, zc + 1, tape);                        // tape along the top …
    v.paint(x0, y1 - 4, zc - 1, x0 + 1, y1, zc + 1, tape);                    // … and a little way down both ends
    v.paint(x1 - 1, y1 - 4, zc - 1, x1, y1, zc + 1, tape);
  } else {
    v.paint(xc - 1, y1 - 1, z0, xc + 1, y1, z1, tape);
    v.paint(xc - 1, y1 - 4, z0, xc + 1, y1, z0 + 1, tape);
    v.paint(xc - 1, y1 - 4, z1 - 1, xc + 1, y1, z1, tape);
  }
  if (opt.label) {                                                            // a red "fragile" sticker
    const lx = x0 + 2, ly = y0 + Math.max(2, (h >> 1) - 3);
    v.paint(lx, ly, z1 - 1, lx + 7, ly + 5, z1, M(RED, 0));
    v.paint(lx + 1, ly + 2, z1 - 1, lx + 6, ly + 3, z1, M(PAPER, 0));
  }
  if (opt.arrows) {                                                           // this way up ↑↑
    const ink = tone(card, -0.55), ay = y0 + Math.max(2, (h >> 1) - 3);
    for (const ax of [x1 - 13, x1 - 7]) {
      v.paint(ax + 2, ay, z1 - 1, ax + 3, ay + 6, z1, ink);
      v.paint(ax + 1, ay + 4, z1 - 1, ax + 4, ay + 5, z1, ink);
      v.paint(ax, ay + 3, z1 - 1, ax + 5, ay + 4, z1, ink);
    }
  }
  if (opt.grip) {                                                             // hand holes in the ends
    v.paint(x0, y1 - 6, zc - 2, x0 + 1, y1 - 4, zc + 2, deep);
    v.paint(x1 - 1, y1 - 6, zc - 2, x1, y1 - 4, zc + 2, deep);
  }
}

/** A paint tin with its corner at (x0, y0, z0), w wide: steel can, a paper label, a lid, sometimes a run of paint. */
function tin(v, x0, y0, z0, w, h, color, drip = false) {
  const st = M('#a9aeb6', 0), label = M(color, 1);
  v.rbox(x0, y0, z0, x0 + w, y0 + h, z0 + w, 2, st, 'xz');
  v.paint(x0, y0 + 1, z0, x0 + w, y0 + h - 2, z0 + w, label);
  v.paint(x0 + 1, y0 + h - 1, z0 + 1, x0 + w - 1, y0 + h, z0 + w - 1, tone(st, 0.22));             // lid
  if (drip) {
    const p = M(color, 0);
    v.paint(x0 + 2, y0 + h - 2, z0 + w - 1, x0 + 4, y0 + h, z0 + w, p);
    v.paint(x0 + 2, y0 + h - 4, z0 + w - 1, x0 + 3, y0 + h, z0 + w, p);
    v.paint(x0 + 1, y0 + h - 1, z0 + w - 2, x0 + 4, y0 + h, z0 + w - 1, p);
  }
}

/* ---- the office tree -------------------------------------------------------- */

const LEAF = M('#5a9450', 2), LEAF_L = M('#7db963', 2), LEAF_D = M('#3f7040', 2);
const BARK = M('#73543a', 2), BARK_D = tone(BARK, -0.24);
const SOIL = M('#4a3626', 3), SOIL_D = tone(SOIL, -0.22);
const isLeaf = (c) => c === LEAF || c === LEAF_L || c === LEAF_D;
/** Bark: long dark furrows down some columns (speckle would cost a quad per voxel). */
const bark = (x, y, z) => (noise3(x, (y + x * 5 + z * 3) >> 3, z, 7) > 0.8 ? BARK_D : BARK);

/**
 * One length of trunk: an upright post `w` voxels thick, standing over (cx, cz), with a
 * `cut`-voxel square notched out of each corner. Notched corners read as round and cost a
 * third of what a true circle does (every concave edge is a column of single quads).
 */
function bole(v, cx, cz, y0, y1, w, cut = 1) {
  const x0 = Math.round(cx - w / 2), z0 = Math.round(cz - w / 2);
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < w; z++) {
      if (Math.min(x, w - 1 - x) < cut && Math.min(z, w - 1 - z) < cut) continue;
      for (let y = y0; y < y1; y++) v.set(x0 + x, y, z0 + z, bark(x0 + x, y, z0 + z));
    }
  }
}

/** A tapering limb through [x, y, z, radius] points: boughs, twigs, roots. */
function limb(v, pts, color = bark) {
  const fn = typeof color === 'function' ? color : null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0, z0, r0] = pts[i], [x1, y1, z1, r1] = pts[i + 1];
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, len2 = dx * dx + dy * dy + dz * dz || 1e-6, rm = Math.max(r0, r1);
    for (let x = Math.floor(Math.min(x0, x1) - rm); x <= Math.ceil(Math.max(x0, x1) + rm); x++) {
      for (let y = Math.floor(Math.min(y0, y1) - rm); y <= Math.ceil(Math.max(y0, y1) + rm); y++) {
        for (let z = Math.floor(Math.min(z0, z1) - rm); z <= Math.ceil(Math.max(z0, z1) + rm); z++) {
          const px = x + 0.5 - x0, py = y + 0.5 - y0, pz = z + 0.5 - z0;
          const t = Math.max(0, Math.min(1, (px * dx + py * dy + pz * dz) / len2));
          const r = r0 + (r1 - r0) * t;
          if ((px - dx * t) ** 2 + (py - dy * t) ** 2 + (pz - dz * t) ** 2 <= r * r) v.set(x, y, z, fn ? fn(x, y, z) : color);
        }
      }
    }
  }
}

/** Roots flaring out of the foot of the trunk and diving into the soil. */
function roots(v, count, r0, reach, y0, thick) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.4 + (i % 2) * 0.3, c = Math.cos(a), s = Math.sin(a);
    limb(v, [[c * r0, y0, s * r0, thick], [c * reach, 10.4, s * reach, thick * 0.6]]);
  }
}

/**
 * A leaf mass: a dome with a flattened underside, laid in n-voxel leaf blocks
 * (one block = one clump of leaves). The blocks give the foliage its texture
 * and keep the big canopies inside the quad budget: a crown this size at full
 * resolution would be well over ten thousand quads on its own.
 */
function puff(v, n, cx, cy, cz, rx, ry, rz, color, flat = 0.34) {
  for (let bx = Math.floor((cx - rx) / n); bx * n < cx + rx; bx++) {
    for (let by = Math.floor((cy - ry * flat) / n); by * n < cy + ry; by++) {
      for (let bz = Math.floor((cz - rz) / n); bz * n < cz + rz; bz++) {
        const x = (bx + 0.5) * n - cx, y = (by + 0.5) * n - cy, z = (bz + 0.5) * n - cz;
        if ((x / rx) ** 2 + (y / (y < 0 ? ry * flat : ry)) ** 2 + (z / rz) ** 2 > 1) continue;
        v.box(bx * n, by * n, bz * n, bx * n + n, by * n + n, bz * n + n, color);
      }
    }
  }
}

function wateringCan(v, x, y, z) {
  const c = M(TEAL, 0), d = tone(c, -0.28), l = tone(c, 0.22);
  v.box(x - 2, y, z - 2, x + 3, y + 5, z + 3, c);                             // a squarish enamel can
  v.paint(x - 2, y, z - 2, x + 3, y + 1, z + 3, d);
  v.paint(x - 1, y + 4, z - 1, x + 2, y + 5, z + 2, M('#27424c', 0));         // water inside
  for (let i = 0; i < 4; i++) v.set(x + 3 + i, y + 2 + i, z, c);              // spout …
  v.box(x + 6, y + 5, z - 1, x + 8, y + 7, z + 2, l);                         // … and rose
  v.box(x - 4, y + 1, z, x - 2, y + 2, z + 1, d); v.box(x - 4, y + 4, z, x - 2, y + 5, z + 1, d); v.box(x - 4, y + 2, z, x - 3, y + 4, z + 1, d);     // handle
}

/**
 * The planter every stage of the tree lives in: stone, 56 × 56 with the corners cut off
 * (in 2-voxel steps, like laid blocks), and a timber rim at sitting height that widens into
 * a little shelf at each corner. The soil is a 44 × 44 bed, its top at y = 11.
 */
function planter(v, stage) {
  const stone = M('#b6ae9f', 2), stoneD = tone(stone, -0.2);
  const wood = M(HONEY, 2), woodD = tone(wood, -0.1), woodEdge = tone(wood, -0.24);
  for (let x = -28; x < 28; x++) {
    for (let z = -28; z < 28; z++) {
      const fx = Math.abs(x + 0.5), fz = Math.abs(z + 0.5), step = Math.floor(fx / 2) * 2 + Math.floor(fz / 2) * 2 + 2;
      if (step >= 50) continue;                                              // the cut corner
      for (let y = 0; y < 10; y++) v.set(x, y, z, y < 2 ? stoneD : stone);
      if (fx < 22 && fz < 22) v.set(x, 10, z, SOIL);
      else { v.set(x, 10, z, woodEdge); v.set(x, 11, z, woodEdge); v.set(x, 12, z, fx >= 22 && fz >= 22 ? woodD : wood); }
    }
  }
  v.paint(-7, 3, 27, 7, 9, 28, M('#c9a24a', 0));                              // a brass plaque let into the front
  v.paint(-5, 6, 27, 5, 7, 28, M('#6b4a1c', 0)); v.paint(-4, 4, 27, 3, 5, 28, M('#6b4a1c', 0));
  wateringCan(v, -21.5, 13, 21.5);                                            // somebody waters it
  if (stage >= 1 && stage <= 3) {                                             // grass creeps in at the edges, until the shade is too deep
    const g = M('#6aa356', 2);
    for (const [x, z, h] of [[-21, 3, 2], [-21, 5, 3], [13, 21, 3], [21, -7, 2], [-10, -21, 3]]) v.box(x, 11, z, x + 1, 11 + h, z + 1, g);
  }
}

function sprout(v) {
  const g = M('#86c06a', 2), gd = M('#5f9150', 2);
  v.cyl('y', -0.5, -0.5, 10, 11, 6.5, SOIL_D);                                // freshly watered
  v.cyl('y', -0.5, -0.5, 11, 12, 2.4, SOIL_D);
  v.box(-1, 12, -1, 0, 17, 0, gd);                                            // stem
  v.box(-4, 16, -2, -1, 17, 1, g); v.box(-5, 17, -1, -3, 18, 0, g);           // two seed leaves
  v.box(0, 16, -2, 3, 17, 1, g); v.box(2, 17, -1, 4, 18, 0, g);
  v.box(-1, 17, -1, 0, 19, 0, M('#a8dc84', 2));                               // and the first true one
  // the seed packet on a stick, and the trowel that planted it
  v.box(9, 11, -5, 10, 19, -4, M(HONEY, 2));
  v.box(7, 17, -4, 12, 23, -3, M(PAPER, 0));
  v.paint(7, 21, -4, 12, 23, -3, M(RED, 0));
  v.paint(8, 18, -4, 11, 20, -3, g); v.paint(9, 20, -4, 10, 21, -3, g);
  v.box(-11, 11, 6, -9, 14, 7, M('#b9bfc8', 0)); v.box(-11, 14, 6, -10, 15, 7, M('#b9bfc8', 0));
  v.box(-10, 14, 6, -9, 18, 7, M(RED, 0));
}

function sapling(v, n = 2) {
  const twig = M('#7d5d40', 2);
  puff(v, n, 0, 34, 0, 7, 6, 7, LEAF);
  puff(v, n, -5, 30, 2, 5, 4, 5, LEAF_D);
  puff(v, n, 5, 31, -2, 5, 5, 5, LEAF_L);
  v.box(-1, 11, -1, 1, 13, 1, twig);
  limb(v, [[0, 11, 0, 1.2], [0.6, 22, 0, 1.1], [-0.4, 32, 0.4, 0.9]], twig);
  limb(v, [[0.4, 24, 0, 0.8], [-4, 29, 2, 0.6]], twig);
  limb(v, [[0.4, 26, 0, 0.8], [4, 30, -2, 0.6]], twig);
  // staked and tied, the way you look after a young tree
  v.box(4, 11, 2, 5, 29, 3, M(HONEY, 2));
  v.box(0, 22, 1, 5, 23, 2, M('#e9e3d4', 3)); v.box(0, 22, 0, 1, 23, 2, M('#e9e3d4', 3));
}

function young(v, n = 3) {
  puff(v, n, -8, 50, 4, 9, 8, 9, LEAF_D);
  puff(v, n, 9, 49, -3, 9, 8, 9, LEAF_D);
  puff(v, n, 0, 56, 0, 13, 13, 13, LEAF);
  puff(v, n, 3, 63, 3, 7, 6, 7, LEAF_L);
  bole(v, 0, 0, 11, 14, 8, 2); bole(v, 0, 0, 14, 18, 6, 1);
  bole(v, 0, 0, 18, 36, 4, 1); bole(v, 1, 0, 36, 54, 4, 1);
  limb(v, [[0, 37, 0, 1.3], [-7, 48, 4, 1]]);
  limb(v, [[1, 35, 0, 1.3], [9, 47, -3, 1]]);
  v.set(22, 13, -4, LEAF_L);                                                  // the first leaf it has dropped
}

function full(v, n = 3) {
  puff(v, n, -4, 76, -15, 14, 12, 13, LEAF_D);
  puff(v, n, 18, 73, -4, 13, 11, 13, LEAF_D);
  puff(v, n, 0, 87, 0, 20, 20, 19, LEAF);
  puff(v, n, -18, 77, 4, 13, 12, 13, LEAF);
  puff(v, n, 4, 75, 16, 13, 11, 12, LEAF);
  puff(v, n, 9, 96, 6, 11, 11, 11, LEAF_L);
  puff(v, n, -10, 93, -4, 10, 10, 10, LEAF_L);
  puff(v, n, -13, 81, 14, 8, 7, 8, LEAF_L);
  bole(v, 0, 0, 11, 15, 12, 3); bole(v, 0, 0, 15, 20, 10, 2);
  bole(v, 0, 0, 20, 44, 8, 1); bole(v, 1, 0, 44, 62, 6, 1); bole(v, 1, 0, 62, 84, 4, 1);
  roots(v, 4, 5, 12, 14, 1.7);
  limb(v, [[-1, 54, 0.5, 1.9], [-16, 74, 4, 1.4]]);
  limb(v, [[2, 52, 0, 1.9], [16, 71, -4, 1.4]]);
  limb(v, [[1, 57, 1, 1.8], [4, 73, 14, 1.3]]);
  limb(v, [[1, 58, -1, 1.8], [-4, 74, -13, 1.3]]);
  for (const [x, y, z] of [[23, 13, 6], [-25, 13, -9]]) v.set(x, y, z, LEAF_L);    // a few leaves have come down
}

function grand(v, n = 4) {
  puff(v, n, -5, 100, -19, 16, 14, 15, LEAF_D);
  puff(v, n, 21, 96, -5, 15, 13, 15, LEAF_D);
  puff(v, n, 0, 113, 0, 23, 24, 22, LEAF);
  puff(v, n, -21, 101, 5, 15, 14, 15, LEAF);
  puff(v, n, 5, 99, 20, 15, 13, 14, LEAF);
  puff(v, n, 11, 124, 7, 13, 13, 13, LEAF_L);
  puff(v, n, -12, 120, -5, 12, 12, 12, LEAF_L);
  // blossom: the tops of the leaf clumps come out pink, in drifts
  const pink = M('#f6c3d0', 2), pinkD = M('#ea9ab4', 2);
  v.remap((x, y, z, c) => {
    if (!isLeaf(c) || y < 100 || v.has(x, y + 1, z)) return c;
    const bx = Math.floor(x / n), by = Math.floor(y / n), bz = Math.floor(z / n);
    if (noise3(bx >> 1, by >> 1, bz >> 1, 11) < 0.52 || noise3(bx, by, bz, 5) < 0.3) return c;
    return noise3(bx, by, bz, 9) > 0.45 ? pink : pinkD;
  });
  bole(v, 0, 0, 11, 16, 18, 5);
  bole(v, 0, 0, 16, 46, 14, 3); bole(v, 1, 0, 46, 76, 12, 2); bole(v, 1, 0, 76, 104, 6, 0);
  roots(v, 3, 8, 15, 14.5, 1.6);
  limb(v, [[-4, 79, 1, 2], [-16, 99, 4, 1.5]]);                               // three scaffold boughs under the lower lobes
  limb(v, [[6, 76, -1, 2], [16, 94, -4, 1.5]]);
  limb(v, [[2, 78, 5, 2], [4, 97, 16, 1.5]]);
  // fairy lights: wound up the trunk, then scattered through the crown
  const bulb = glow('#ffe7b0'), bulbA = glow('#ffc978');
  for (let y = 22; y < 76; y += 3) {
    const a = y * 0.6;
    for (let s = 13; s > 0; s -= 0.5) {
      const x = Math.floor(0.5 + Math.cos(a) * s), z = Math.floor(0.5 + Math.sin(a) * s);
      if (v.has(x, y, z)) { v.set(x, y, z, y % 2 ? bulb : bulbA); break; }
    }
  }
  const N = 44;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N, a = i * 2.39996, cy = 1 - 1.5 * t, sy = Math.sqrt(Math.max(0, 1 - cy * cy));
    const dx = Math.cos(a) * sy, dz = Math.sin(a) * sy;
    for (let s = 46; s > 4; s -= 0.5) {
      const x = Math.floor(dx * s), y = Math.floor(110 + cy * s), z = Math.floor(dz * s);
      if (v.has(x, y, z)) { if (y > 90) v.set(x, y, z, i % 5 === 2 ? bulbA : bulb); break; }
    }
  }
}

/** The office tree in its 56 × 56 planter. It grows with the work done: stage 0 a sprout … 4 a grand tree in blossom and lights, 72 × 136 × 64. */
export function tree(opt = {}) {
  const stage = Math.max(0, Math.min(4, Math.round(Number(opt.stage ?? 3)) || 0));
  const v = new Vox();
  planter(v, stage);
  [sprout, sapling, young, full, grand][stage](v);
  return v;
}

/* ---- the plaza ------------------------------------------------------------- */

/** The live picture on the big board: centre and size in voxels, in the plane z = BIGBOARD_SCREEN.z facing +z. */
export const BIGBOARD_SCREEN = Object.freeze({ x: 0, y: 46, z: 2.08, w: 120, h: 56 });

/** The big board — every project at a glance. A wall of a display on two steel feet; the screen faces +z. 124 × 76 × 16. */
export function bigboard() {
  const v = new Vox();
  const S = BIGBOARD_SCREEN;
  const shell = M('#3b3c44', 0), lite = tone(shell, 0.16), deep = tone(shell, -0.4), steel = M('#9aa3b0', 0), steelD = tone(steel, -0.3), k = M(BLACK, 0);
  const sx0 = S.x - S.w / 2, sx1 = S.x + S.w / 2, sy0 = S.y - S.h / 2, sy1 = S.y + S.h / 2;
  for (const s of [-1, 1]) {                                                  // two sturdy feet
    const cx = s * 42;
    v.rbox(cx - 4, 0, -8, cx + 4, 2, 8, 2, steelD, 'xz');
    v.box(cx - 3, 2, -6, cx + 3, 3, 6, steel);
    v.box(cx - 3, 3, -2, cx + 3, sy0 - 4, 2, steel);
    for (let i = 0; i < 4; i++) { v.box(cx - 1, 3 + i, 2, cx + 1, 4 + i, 6 - i, steelD); v.box(cx - 1, 3 + i, -6 + i, cx + 1, 4 + i, -2, steelD); }     // gussets
    v.box(cx - 2, sy0 - 4, -5, cx + 2, 46, -3, steel);                        // the rail the cabinet hangs on
    v.paint(cx - 4, 0, 6, cx + 4, 1, 8, k); v.paint(cx - 4, 0, -8, cx + 4, 1, -6, k);
  }
  v.box(-40, 7, -1, 40, 9, 1, steelD);                                        // tie bar
  v.rbox(sx0 - 2, sy0 - 4, -3, sx1 + 2, sy1 + 2, 3, 2, shell, 'xy');          // the cabinet
  v.paint(sx0 - 2, sy1 + 1, -3, sx1 + 2, sy1 + 2, 3, lite);
  v.carve(sx0, sy0, 2, sx1, sy1, 3);                                          // the screen sits back a little
  v.box(sx0, sy0, 1, sx1, sy1, 2, M('#10151c', 0));
  // the chin: speaker slots, a badge, three buttons and the power light
  for (let x = -56; x < -42; x += 2) v.paint(x, sy0 - 3, 2, x + 1, sy0 - 1, 3, deep);
  v.paint(-4, sy0 - 3, 2, 4, sy0 - 1, 3, steel);
  for (const x of [42, 46, 50]) v.paint(x, sy0 - 3, 2, x + 2, sy0 - 1, 3, deep);
  v.set(56, sy0 - 2, 2, LED_G);
  v.box(-34, sy0 - 4, 3, -30, sy0, 4, M('#f2d45c', 0));                       // a sticky note nobody dares remove
  v.paint(-33, sy0 - 2, 3, -31, sy0 - 1, 4, M('#9a8430', 0));
  // the back: electronics hump, vents, a service label, and the cable to the floor
  const hump = tone(shell, -0.1);
  v.box(-36, sy0 - 4, -6, 36, 66, -3, hump);
  for (const y of [57, 59, 61]) for (let x = -28; x < 28; x += 5) v.paint(x, y, -6, x + 3, y + 1, -5, deep);
  v.paint(-30, 24, -6, -20, 30, -5, M(PAPER, 0));
  v.paint(-28, 27, -6, -22, 28, -5, steelD); v.paint(-28, 25, -6, -24, 26, -5, steelD);
  v.paint(16, 17, -6, 28, 22, -5, deep);
  v.tube(22.5, 19.5, -6.5, 22.5, 10, -6.5, 0.7, k);
  v.tube(22.5, 10, -6.5, 29.5, 0.5, -7.5, 0.7, k);
  v.box(29, 0, -8, 38, 1, -7, k);
  return v;
}

/** The office laser printer on its stand: paper tray out the front (+z), a fresh page in the output tray on top. 32 × 34 × 28. */
export function printer() {
  const v = new Vox();
  const body = M(CREAM, 0), shade = tone(body, -0.14), deep = tone(body, -0.34), k = M(BLACK, 0);
  const wood = M(WOOD, 2), woodD = tone(wood, -0.26), woodL = tone(wood, 0.14), paper = M('#f4efe2', 0);
  // the stand: a small cabinet, open on the left for paper, a door on the right
  v.box(-14, 0, -12, 14, 2, 10, woodD);
  v.box(-15, 2, -13, 15, 15, 11, wood);
  v.box(-16, 15, -14, 16, 17, 12, woodL);
  v.paint(-16, 15, -14, 16, 16, 12, woodD);
  v.carve(-13, 4, -4, -1, 14, 11);
  v.paint(-13, 4, -5, -1, 14, -4, tone(wood, -0.45));
  v.box(-12, 4, 0, -3, 7, 9, M('#e9e3d4', 0)); v.paint(-12, 5, 0, -3, 6, 9, M(TEAL, 0));           // reams of paper
  v.box(-11, 7, 1, -2, 10, 10, M('#e9e3d4', 0)); v.paint(-11, 8, 1, -2, 9, 10, M(TEAL, 0));
  v.box(1, 3, 11, 14, 14, 12, woodL);
  v.box(2, 7, 12, 3, 11, 13, M(STEEL, 0));
  // the printer
  v.rbox(-14, 17, -12, 14, 34, 10, 2, body);
  v.carve(-14, 15, -12, 14, 17, 10); v.box(-13, 17, -11, 13, 19, 9, shade);     // a darker foot
  v.paint(-14, 24, 9, 14, 25, 10, shade);                                    // where the top cover meets the base
  v.box(-11, 19, 10, 11, 21, 14, tone(body, -0.24));                         // the paper tray, pulled out
  v.box(-10, 20, 10, 10, 22, 13, paper); v.paint(-10, 20, 10, 10, 21, 13, M('#d9d3c4', 0));
  v.paint(-3, 19, 13, 3, 20, 14, deep);
  v.carve(-9, 31, -7, 7, 34, 7);                                             // output tray
  v.paint(-9, 30, -7, 7, 31, 7, shade);
  v.box(-9, 31, -8, 7, 33, -7, deep);                                        // the slot the page comes out of
  v.box(-8, 31, -6, 6, 32, 8, paper);
  for (const z of [-4, -2, 0, 2, 4]) v.paint(-6, 31, z, z === 4 ? 0 : 4, 32, z + 1, M('#8f8f98', 0));    // it has printed something
  v.box(5, 26, 10, 13, 32, 11, deep);                                        // control panel
  v.box(6, 29, 11, 11, 31, 12, M('#9fb08f', 0));                              // LCD: "READY"
  v.set(7, 30, 11, M('#4c5a44', 0)); v.set(8, 30, 11, M('#4c5a44', 0)); v.set(9, 29, 11, M('#4c5a44', 0));
  v.set(12, 30, 11, M('#d9d2c2', 0)); v.set(11, 27, 11, M('#d9d2c2', 0)); v.set(9, 27, 11, M('#d9d2c2', 0)); v.set(7, 27, 11, LED_G);
  v.paint(-12, 30, 9, -7, 31, 10, M(STEEL, 0));                              // badge
  v.box(-12, 25, 10, -8, 29, 11, M('#f2d45c', 0)); v.paint(-11, 27, 10, -9, 28, 11, M('#9a8430', 0));   // "PC LOAD LETTER?"
  for (const y of [22, 24, 26]) { v.paint(-14, y, -8, -13, y + 1, 2, deep); v.paint(13, y, -8, 14, y + 1, 2, deep); }     // vents
  v.paint(3, 20, -12, 12, 24, -11, deep);                                    // sockets on the back, a rating plate
  v.paint(-11, 26, -12, -4, 30, -11, M(PAPER, 0)); v.paint(-10, 28, -12, -5, 29, -11, shade);
  v.tube(7.5, 21.5, -12.5, 9.5, 2, -13.5, 0.7, k);                           // power
  v.box(9, 0, -14, 14, 1, -13, k);
  return v;
}

/* ---- the supply closet ----------------------------------------------------- */

/** Open steel utility shelving, loaded with spares; you take things from the +z side. 100 × 68 × 20. */
export function shelving() {
  const v = new Vox();
  const st = M('#8a9099', 0), lite = tone(st, 0.2), post = M('#646b75', 0), k = M(BLACK, 0), steel = M('#c9ccd2', 0);
  const TOPS = [5, 22, 39, 56];                                               // the top face of each shelf
  for (const t of TOPS) { v.box(-50, t - 2, -10, 50, t, 10, st); v.paint(-50, t - 1, -10, 50, t, 10, lite); }
  for (const x of [-50, -1, 48]) {                                            // angle-iron uprights
    for (const z of [-10, 9]) { v.box(x, 0, z, x + 2, 68, z + 1, post); v.paint(x, 0, z, x + 2, 1, z + 1, k); }
  }
  v.box(-48, 29, -10, 48, 31, -9, post);                                      // a tie bar across the back

  // bottom shelf: the heavy things
  let y = TOPS[0];
  carton(v, -46, y, -4, 19, 13, 14, { tape: 'x', label: true });
  const red = M('#b5382e', 0);                                                // a red toolbox
  v.box(-23, y, -2, -6, y + 7, 7, red);
  v.paint(-23, y + 5, -2, -6, y + 6, 7, tone(red, -0.3));
  v.paint(-20, y + 4, 6, -18, y + 6, 7, steel); v.paint(-11, y + 4, 6, -9, y + 6, 7, steel);
  v.box(-19, y + 7, 2, -18, y + 9, 3, k); v.box(-11, y + 7, 2, -10, y + 9, 3, k); v.box(-19, y + 9, 2, -10, y + 10, 3, k);
  tin(v, 5, y, 1, 6, 7, TEAL, true);
  tin(v, 13, y, -3, 6, 7, '#e9e3d4');
  carton(v, 27, y, -4, 19, 10, 14, { tape: 'z', arrows: true });

  // second shelf: a cable drum, toner, paper
  y = TOPS[1];
  const ply = M(HONEY, 2), cable = M(ORANGE, 2);
  v.box(-44, y + 2, -3, -36, y + 10, 7, cable);                               // the cable, wound between …
  for (const [dx, dy] of [[0, 0], [6, 0], [0, 6], [6, 6]]) v.carve(-44 + dx, y + 2 + dy, -3, -42 + dx, y + 4 + dy, 7);
  v.paint(-44, y + 2, 0, -36, y + 10, 1, tone(cable, -0.2)); v.paint(-44, y + 2, 4, -36, y + 10, 5, tone(cable, -0.2));
  v.cyl('z', -40, y + 6, -4, -3, 6, ply); v.cyl('z', -40, y + 6, 7, 8, 6, ply);     // … two plywood cheeks
  v.paint(-41, y + 5, 7, -39, y + 7, 8, k);
  for (const [dx, dy] of [[-4, 0], [3, 0], [0, -4], [0, 3]]) v.set(-40 + dx - (dx ? 0 : 1), y + 6 + dy - (dy ? 0 : 1), 7, steel);
  const stripes = ['#3fa7c9', '#c94f8a', YELLOW];
  v.box(-25, y, -6, -7, y + 12, 7, M('#ece6d8', 0));                          // toner, one of each colour
  for (let i = 0; i < 3; i++) {
    const x = -25 + i * 6;
    v.paint(x, y + 7, -6, x + 6, y + 10, 7, M(stripes[i], 0));
    v.paint(x + 1, y + 2, 6, x + 5, y + 5, 7, M('#55555e', 0));
    if (i) v.paint(x, y, -6, x + 1, y + 12, 7, M('#a59f90', 0));
  }
  v.box(18, y, -6, 36, y + 9, 6, M('#e9e3d4', 0));                            // reams of paper
  for (let i = 0; i < 3; i++) { v.paint(18, y + i * 3 + 1, -6, 36, y + i * 3 + 2, 6, M(TEAL, 0)); v.paint(18, y + i * 3, -6, 36, y + i * 3 + 1, 6, M('#cfc8b6', 0)); }

  // third shelf: parts bins, the spare keyboard
  y = TOPS[2];
  const bins = [RED, YELLOW, TEAL, TEAL, YELLOW, RED, YELLOW, TEAL];
  for (let i = 0; i < 8; i++) {
    const up = i >= 5, x = up ? -42 + (i - 5) * 8 : -46 + i * 8, by = y + (up ? 6 : 0), c = M(bins[i], 0);
    v.box(x, by, -5, x + 8, by + 6, 7, c);
    v.paint(x + 1, by + 2, 6, x + 7, by + 5, 7, tone(c, -0.5));               // the open mouth of the bin
    v.paint(x + 2, by + 2, 6, x + 4, by + 3, 7, steel);                       // nuts and bolts
    v.paint(x, by, -5, x + 1, by + 6, 7, tone(c, -0.14));
  }
  const cream = M(CREAM, 0);
  v.box(3, y, 2, 27, y + 2, 10, tone(cream, -0.14));                          // the spare keyboard
  v.paint(4, y + 1, 3, 26, y + 2, 9, (x, yy, z) => (z % 2 ? cream : tone(cream, -0.07)));
  v.paint(11, y + 1, 8, 19, y + 2, 9, cream);
  v.paint(21, y + 1, 3, 22, y + 2, 9, tone(cream, -0.14)); v.set(4, y + 1, 3, M('#c96a5a', 0));
  for (let i = 0; i < 4; i++) v.set(25 + (i % 2), y - 1 - i, 10, k);          // its curly cable
  carton(v, 31, y, -6, 16, 12, 13, { tape: 'z', label: true });

  // top shelf: light, awkward things
  y = TOPS[3];
  carton(v, -45, y, -4, 17, 10, 14, { tape: 'x', arrows: true });
  v.box(12, y, -4, 25, y + 9, 5, M('#f4efe2', 0));                            // first aid
  v.paint(17, y + 2, 4, 20, y + 7, 5, M('#3f8a5a', 0)); v.paint(16, y + 3, 4, 21, y + 6, 5, M('#3f8a5a', 0));
  v.box(17, y + 9, 0, 20, y + 10, 1, k);
  return v;
}

/** A stack of cardboard moving boxes; three arrangements (seed 1–3), each with one box left open. At most 34 × 37 × 34. */
export function boxes(opt = {}) {
  const v = new Vox();
  const seed = ((Math.round(Number(opt.seed) || 1) - 1) % 3 + 3) % 3 + 1;
  const r = rng(seed * 7 + 1), j = () => Math.round(r() * 2) - 1;             // nobody stacks boxes perfectly square
  const packing = (x, y, z) => { v.ellipsoid(x + 2, y, z + 3, 3, 2, 3, M('#e9e3d4', 3)); v.ellipsoid(x + 9, y, z + 7, 3.4, 2.2, 3, M('#e9e3d4', 3)); };
  if (seed === 1) {
    carton(v, -15 + j(), 0, -13, 28, 13, 25, { tape: 'x', label: true, grip: true });
    carton(v, -12, 13, -11 + j(), 22, 11, 20, { tape: 'z', arrows: true, color: '#c29660' });
    carton(v, -9 + j(), 24, -8, 16, 8, 15, { open: true });
    const [x, y, z] = [-7, 29, -6];                                           // somebody's desk plant and a rolled poster
    packing(x, y, z);
    v.cyl('y', x + 9.5, z + 1.5, y - 3, y + 7, 1.6, M('#5f86b0', 1));
    v.box(x + 2, y, z + 8, x + 5, y + 2, z + 11, M('#a5552f', 1));
    v.ellipsoid(x + 3, y + 4, z + 9, 3, 2.4, 3, M('#5f9150', 2));
    v.ellipsoid(x + 5, y + 6, z + 8, 2, 1.6, 2, M('#86c06a', 2));
  } else if (seed === 2) {
    carton(v, -17, 0, -12 + j(), 17, 14, 22, { tape: 'z', grip: true });
    carton(v, 1, 0, -11, 16, 12, 20 + j(), { tape: 'x', grip: true, color: '#c29660' });
    carton(v, -13 + j(), 14, -10, 18, 10, 18, { open: true, color: '#c29660' });
    const [x, y, z] = [-11, 21, -8];                                          // ring binders, standing, and a mug
    packing(x, y, z);
    for (const [i, c, h] of [[0, RED, 7], [1, TEAL, 6], [2, YELLOW, 7], [3, '#4a3f35', 5]]) {
      v.box(x + 5 + i * 2, y - 2, z + 1, x + 7 + i * 2, y + h, z + 10, M(c, 1));
      v.paint(x + 5 + i * 2, y + 2, z + 9, x + 7 + i * 2, y + 4, z + 10, M(PAPER, 0));
    }
    v.box(x, y - 1, z + 11, x + 3, y + 3, z + 14, M('#e9e3d4', 0)); v.set(x + 3, y + 1, z + 12, M('#e9e3d4', 0));
    carton(v, 3, 12, -8 + j(), 13, 7, 14, { tape: 'x', label: true });
  } else {
    carton(v, -16, 0, -15 + j(), 26, 16, 27, { tape: 'x', arrows: true, grip: true });
    carton(v, -12 + j(), 16, -11, 19, 11, 19, { open: true });
    const [x, y, z] = [-10, 24, -9];                                          // a banker's lamp, shade and all
    packing(x, y, z);
    v.box(x + 6, y - 2, z + 9, x + 8, y + 5, z + 11, M('#c9a24a', 0));
    v.rbox(x + 2, y + 4, z + 7, x + 13, y + 8, z + 13, 2, M('#3f8a5a', 0), 'yz');
    v.paint(x + 2, y + 4, z + 7, x + 3, y + 8, z + 13, M('#c9a24a', 0)); v.paint(x + 12, y + 4, z + 7, x + 13, y + 8, z + 13, M('#c9a24a', 0));
    carton(v, 6, 0, 4 + j(), 11, 9, 13, { tape: 'z', label: true, color: '#c29660' });
    carton(v, -5, 0, 13, 10, 6, 5, { tape: 'x', color: '#c79a62' });
  }
  return v;
}

/** The robot vacuum's charging dock: a wedge against the wall; the robot parks on its +z side. 20 × 8 × 20. */
export function roombadock() {
  const v = new Vox();
  const body = M('#303138', 0), lite = tone(body, 0.2), k = M('#1c1c20', 0), steel = M('#c9ccd2', 0);
  v.rbox(-9, 0, -4, 9, 1, 10, 4, tone(body, 0.1), 'xz');                      // the plate it drives onto
  v.rbox(-8, 0, -10, 8, 8, -2, 2, body, 'xz');
  for (let y = 2; y < 8; y++) v.carve(-8, y, -2 - ((y - 1) >> 1), 8, y + 1, -2);     // the face leans back
  v.paint(-8, 7, -10, 8, 8, -2, lite);
  v.paint(-5, 4, -5, 5, 6, -3, k);                                            // infrared window
  v.box(-6, 1, -2, -3, 3, -1, steel); v.box(3, 1, -2, 6, 3, -1, steel);       // charging contacts
  v.set(0, 7, -6, LED_G); v.set(-1, 7, -6, LED_G);
  v.box(6, 0, -10, 10, 1, -9, k);                                             // mains lead
  return v;
}

/** The robot vacuum. Origin at its centre on the floor; it drives toward +z. 14 across, 4 tall. */
export function roomba() {
  const v = new Vox();
  const body = M('#34353c', 0), lid = M('#4a4c55', 0), bump = M('#70737d', 0), k = M('#1c1c20', 0);
  v.box(-6, 0, -2, -4, 1, 2, k); v.box(4, 0, -2, 6, 1, 2, k); v.box(-1, 0, 3, 1, 1, 5, k);      // wheels and a caster
  v.cyl('y', 0, 0, 1, 4, 7, body);
  const R = (x, z) => Math.hypot(x + 0.5, z + 0.5);
  v.paint(-7, 1, -7, 7, 3, 7, (x, y, z) => (z >= -1 && R(x, z) > 5.8 ? bump : 0));                // bumper round the front half
  v.paint(-7, 3, -7, 7, 4, 7, (x, y, z) => { const r = R(x, z); return r < 1 ? k : r < 2.3 ? glow('#4fcf82') : r < 5 ? lid : r < 5.8 ? k : z >= -1 ? bump : 0; });
  v.paint(-3, 2, 5, 3, 3, 7, k);                                              // its eye
  for (const [x, z] of [[4, 4], [5, 5], [6, 6], [6, 4], [7, 4], [4, 6], [4, 7]]) v.set(x, 0, z, M(YELLOW, 0));     // side brush
  return v;
}

/** A hatch in the floor, flat enough to walk over: checker-plate door, ring handle, hinges at the back. 40 × 2 × 40. */
export function hatch() {
  const v = new Vox();
  const plate = M('#858a92', 0), ridge = tone(plate, 0.24), edge = tone(plate, -0.28), dark = M('#25262b', 0), yel = M(YELLOW, 0), steel = M('#c9ccd2', 0);
  v.box(-20, 0, -20, 20, 1, 20, (x, y, z) => ((((x + z + 80) >> 2) & 1) ? yel : dark));           // hazard-striped frame
  v.box(-17, 0, -17, 17, 2, 17, (x, y, z) => {
    if (y === 0) return edge;
    if (x === -17 || x === 16 || z === -17 || z === 16) return edge;
    const u = ((x % 6) + 6) % 6, w = ((z % 6) + 6) % 6;
    return (w === 1 && u < 3) || (u === 4 && w >= 3) ? ridge : plate;         // tread pattern
  });
  for (const x of [-13, 7]) {                                                 // hinges
    v.box(x, 1, -19, x + 6, 2, -17, M('#4a4d55', 0));
    v.paint(x, 1, -17, x + 6, 2, -15, edge);
    v.set(x, 1, -18, steel); v.set(x + 5, 1, -18, steel);
  }
  v.carve(-6, 1, 7, 6, 2, 14);                                                // the recess the ring lies in
  v.paint(-6, 0, 7, 6, 1, 14, dark);
  v.box(-4, 1, 8, 4, 2, 13, steel); v.carve(-3, 1, 9, 3, 2, 12);
  v.box(-1, 1, 12, 1, 2, 14, M('#4a4d55', 0));
  for (const [x, z] of [[-15, -15], [14, -15], [-15, 14], [14, 14]]) v.set(x, 1, z, steel);       // bolts
  return v;
}

/* ---- the server room -------------------------------------------------------- */

/** A 19-inch server rack: mesh door on +z with the machines blinking behind it, cables down the back. 28 × 76 × 40. */
export function rack() {
  const v = new Vox();
  const frame = M('#2c2c32', 0), panel = M('#383940', 0), lite = tone(frame, 0.2), k = M('#1c1c20', 0), steel = M(STEEL, 0);
  const face = M('#4c4e58', 0), faceL = tone(face, 0.18), faceD = tone(face, -0.3);
  for (const x of [-13, 10]) for (const z of [-18, 15]) v.box(x, 0, z, x + 3, 2, z + 3, steel);     // levelling feet
  v.box(-14, 2, -18, 14, 74, 15, frame);
  v.paint(-14, 73, -18, 14, 74, 15, lite);
  for (const x of [-14, 13]) {                                                // side panels, with vents low down
    v.paint(x, 6, -15, x + 1, 70, 12, panel);
    for (const y of [9, 11, 13, 15]) v.paint(x, y, -11, x + 1, y + 1, 8, k);
  }
  v.paint(13, 60, 2, 14, 64, 9, M(PAPER, 0)); v.paint(13, 61, 3, 14, 62, 8, k);     // asset tag

  // the machines: front faces at z = 15, behind the door
  const Z = 14;
  const unit = (y0, h, c = face) => { v.paint(-11, y0, Z, 11, y0 + h, Z + 1, c); v.paint(-11, y0, Z, 11, y0 + 1, Z + 1, faceD); };
  v.paint(-11, 6, Z, 11, 70, Z + 1, k);
  unit(66, 4, M('#b9b3a2', 0));                                               // patch panel
  for (let x = -9; x < 9; x += 2) v.set(x, 68, Z, k);
  unit(62, 4);                                                                // switch: link lights, every fourth one busy
  for (let i = 0; i < 9; i++) v.set(-9 + i * 2, 64, Z, i % 4 === 3 ? LED_A : LED_G);
  unit(58, 4, faceD);                                                         // cable tidy
  v.paint(-8, 60, Z, 8, 61, Z + 1, k);
  for (let i = 0; i < 4; i++) {                                               // four servers
    const y0 = 26 + i * 8;
    unit(y0, 8);
    v.paint(-11, y0 + 7, Z, 11, y0 + 8, Z + 1, faceL);
    for (let b = 0; b < 3; b++) v.paint(-3 + b * 4, y0 + 2, Z, b * 4, y0 + 6, Z + 1, faceD);       // drive bays
    v.set(-9, y0 + 5, Z, LED_G);
    v.set(-9, y0 + 3, Z, i === 1 ? LED_A : LED_B);
    v.set(-7, y0 + 3, Z, LED_B);
    v.box(9, y0 + 2, Z + 1, 10, y0 + 6, Z + 2, steel);                        // pull handle
  }
  unit(10, 16, faceD);                                                        // disk shelf: a wall of drives, one of them unwell
  for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
    const x = -10 + col * 4, y0 = 11 + row * 5;
    v.paint(x, y0, Z, x + 3, y0 + 4, Z + 1, face);
    v.set(x + 1, y0 + 3, Z, row === 1 && col === 3 ? LED_A : LED_G);
  }
  unit(6, 4, M('#3f414a', 0));                                                // power: a little meter and the big switch
  v.paint(-9, 7, Z, -4, 9, Z + 1, glow('#ffcf7a'));
  v.set(7, 8, Z, LED_R); v.set(8, 8, Z, LED_R);

  // the door: a frame, a mesh you can see through, a handle
  v.box(-14, 2, 15, 14, 74, 19, frame);
  v.carve(-11, 6, 15, 11, 70, 19);
  const mesh = M('#23252b', 3, { glass: true }), meshL = M('#5a5e69', 3, { glass: true });
  v.box(-11, 6, 17, 11, 70, 18, (x, y) => (y & 1 ? meshL : mesh));            // perforated steel: fine lines, and you can see the lights through it
  v.paint(-14, 73, 15, 14, 74, 19, lite);
  v.box(11, 34, 19, 13, 44, 20, steel); v.set(12, 32, 19, steel);
  for (const y of [10, 38, 66]) v.box(-14, y, 19, -13, y + 4, 20, k);         // hinges
  v.paint(-5, 71, 18, 5, 73, 19, steel);                                      // maker's plate
  v.set(9, 72, 18, LED_G);

  // the top: vents and the cable entry
  v.paint(-10, 73, -10, 10, 74, 10, M('#1e1e23', 3));
  v.box(-11, 74, -11, 11, 75, 11, frame); v.carve(-10, 74, -10, 10, 75, 10);
  // the back: a door, a power strip, and the bundle
  v.paint(-12, 5, -18, 12, 71, -17, panel);
  v.box(8, 10, -19, 11, 66, -18, M('#b9b3a2', 0));
  for (let y = 13; y < 62; y += 6) v.paint(9, y, -19, 10, y + 2, -18, k);
  v.set(9, 63, -19, LED_R);
  const wires = [TEAL, TEAL, '#9a9da3', YELLOW, TEAL];
  for (let i = 0; i < 5; i++) {
    const x = -6 + i * 2, c = M(wires[i], 1);
    v.box(x, 0, -20, x + 2, 76, -18, c);
    v.box(x, 74, -18, x + 2, 76, -13, c);
  }
  v.box(-7, 74, -14, 5, 76, -12, k);                                          // the gland they come out of
  for (const y of [14, 34, 54]) v.box(-7, y, -20, 5, y + 2, -18, k);          // velcro
  for (const [y, c] of [[20, YELLOW], [28, TEAL], [44, RED], [50, TEAL]]) v.box(4, y, -19, 8, y + 1, -18, M(c, 1));     // patch leads
  return v;
}

/** The ops console's terminal: centre and size in voxels, in the plane z = CONSOLE_SCREEN.z facing +z. */
export const CONSOLE_SCREEN = Object.freeze({ x: -5, y: 34.5, z: -4.92, w: 12, h: 7 });

/** The ops console: a sloped control desk with a built-in terminal; you stand at the +z side. 32 × 41 × 24. */
export function opsconsole() {
  const v = new Vox();
  const S = CONSOLE_SCREEN;
  const body = M(CREAM, 0), shade = tone(body, -0.14), deep = tone(body, -0.34), k = M(BLACK, 0), dark = M('#33343b', 0);
  const wood = M(WOOD_DARK, 2), woodL = tone(wood, 0.16), steel = M('#c9ccd2', 0);
  const top = (z) => (z >= 6 ? 23 : z >= -4 ? 25 + ((5 - z) >> 1) : 40);      // height of the profile at depth z
  v.box(-14, 0, -10, 14, 2, 5, k);                                            // plinth
  v.box(-15, 2, -11, 15, 24, 6, body);
  for (let z = -4; z < 6; z++) v.box(-15, 24, z, 15, top(z), z + 1, dark);    // the control slope, in treads
  v.box(-15, 24, -11, 15, 40, -4, body);                                      // the hood the terminal lives in
  v.carve(-15, 39, -5, 15, 40, -4);
  v.paint(-15, 39, -11, 15, 40, -5, tone(body, 0.12));
  v.box(-15, 21, 6, 15, 23, 12, wood);                                        // keyboard shelf
  v.paint(-15, 22, 6, 15, 23, 12, woodL);
  for (const x of [-13, 11]) for (let i = 0; i < 4; i++) v.box(x, 17 + i, 6, x + 2, 18 + i, 7 + i, shade);     // brackets
  for (const x of [-16, 15]) {                                                // wooden cheeks, a voxel proud of everything
    for (let z = -11; z < 6; z++) v.box(x, 2, z, x + 1, top(z) + 1, z + 1, wood);
    v.paint(x, 2, -11, x + 1, 4, 6, tone(wood, -0.25));
  }
  // the front of the pedestal: a service door and a vent
  v.paint(-12, 4, 5, 12, 20, 6, shade);
  v.paint(-11, 5, 5, 11, 19, 6, body);
  for (const y of [7, 9, 11]) v.paint(-8, y, 5, 8, y + 1, 6, deep);
  v.box(8, 15, 6, 10, 17, 7, steel);
  // the terminal
  const sx0 = S.x - S.w / 2, sy0 = Math.floor(S.y - S.h / 2);
  v.paint(sx0 - 1, sy0 - 1, -5, sx0 + S.w + 1, sy0 + S.h + 1, -4, deep);
  v.carve(sx0, sy0, -5, sx0 + S.w, sy0 + S.h, -4);
  v.box(sx0, sy0, -6, sx0 + S.w, sy0 + S.h, -5, M('#0e1512', 0));
  const txt = glow('#7dee9a');
  v.paint(sx0 + 1, sy0 + 5, -6, sx0 + 7, sy0 + 6, -5, txt);
  v.paint(sx0 + 1, sy0 + 3, -6, sx0 + 9, sy0 + 4, -5, txt); v.set(sx0 + 5, sy0 + 3, -6, M('#0e1512', 0));
  v.paint(sx0 + 1, sy0 + 1, -6, sx0 + 4, sy0 + 2, -5, txt);
  v.set(sx0 + 5, sy0 + 1, -6, glow('#c8ffd6'));
  // beside it: a gauge and three status lamps
  v.cyl('z', 9.5, 35.5, -5, -4, 3.2, dark);
  v.cyl('z', 9.5, 35.5, -5, -4, 2.3, M(PAPER, 0));
  v.set(9, 35, -5, k); v.set(10, 36, -5, M(RED, 0)); v.set(11, 37, -5, M(RED, 0));
  v.set(6, 31, -5, LED_G); v.set(9, 31, -5, LED_G); v.set(12, 31, -5, LED_A);
  v.box(4, 36, -4, 7, 39, -3, M('#f2d45c', 0));                               // sticky note
  // toggles on the front tread, chunky lit buttons behind them, small keys above
  for (let i = 0; i < 6; i++) {
    const x = -13 + i * 3;
    v.set(x, 25, 5, steel); v.set(x, 26, i % 3 === 1 ? 5 : 4, steel);
  }
  const caps = [LED_G, LED_G, LED_A, LED_B, glow('#fff1cf')];
  for (let i = 0; i < 5; i++) v.box(-13 + i * 4, 26, 2, -11 + i * 4, 27, 4, caps[i]);
  for (let i = 0; i < 7; i++) v.box(-13 + i * 3, 27, 0, -11 + i * 3, 28, 2, i === 3 ? M(RED, 0) : M('#d9d2c2', 0));
  v.cyl('y', -11.5, -1.5, 28, 30, 1.5, steel); v.set(-12, 30, -2, M(RED, 0));       // key switch
  // the emergency stop, under its cover
  v.box(7, 25, -4, 14, 29, 3, (x, y, z) => (((x + z + 40) >> 1) & 1 ? M(YELLOW, 0) : k));
  v.box(7, 29, -4, 14, 34, 3, glass('#bfe0ea'));
  v.carve(8, 29, -3, 13, 33, 2);
  v.cyl('y', 10.5, -0.5, 29, 31, 1.5, M('#d8392f', 0));
  v.cyl('y', 10.5, -0.5, 31, 32, 2.5, M('#d8392f', 0));
  // keyboard and trackball on the shelf
  v.box(-12, 23, 7, 6, 24, 12, tone(body, -0.12));
  for (let z = 7; z < 11; z++) for (let x = -12; x < 6; x++) v.set(x, 24, z, (x + z) % 2 === 0 ? body : tone(body, -0.08));
  v.box(8, 23, 7, 13, 24, 12, shade);
  v.sphere(10.5, 24.5, 9.5, 1.7, M(TEAL, 0));
  // the back: vents and the mains lead
  for (const y of [28, 30, 32, 34]) v.paint(-10, y, -11, 10, y + 1, -10, deep);
  v.paint(-12, 5, -11, 12, 20, -10, shade);
  v.tube(-8.5, 8.5, -11.5, -8.5, 1, -11.5, 0.7, k);
  return v;
}
export { opsconsole as console };          // its catalogue name (a function called `console` would shadow the real one in here)

/** A floor-standing air conditioner: louvres blow out the +z side, the exhaust duct leaves at the back. 26 × 36 × 28. */
export function acunit() {
  const v = new Vox();
  const body = M('#dedad0', 0), shade = tone(body, -0.13), deep = tone(body, -0.36), dark = M('#33343b', 0), grey = M('#a3a6ac', 0), k = M(BLACK, 0);
  for (const x of [-11, 9]) for (const z of [-7, 8]) v.box(x, 0, z, x + 2, 2, z + 2, k);          // casters
  v.rbox(-13, -4, -9, 13, 36, 12, 3, body);
  v.carve(-13, -4, -9, 13, 2, 12);
  v.paint(-13, 2, -9, 13, 5, 12, shade);
  // front: intake grille below, louvres above, the controls on top of those
  v.paint(-10, 7, 11, 10, 17, 12, M('#b4b1a8', 3));
  v.paint(-10, 7, 11, 10, 8, 12, shade); v.paint(-10, 16, 11, 10, 17, 12, shade);
  v.carve(-10, 19, 11, 10, 29, 12);
  v.box(-10, 19, 10, 10, 29, 11, dark);
  for (let y = 20; y < 29; y += 2) v.box(-10, y, 11, 10, y + 1, 13, body);
  v.paint(-9, 30, 11, 9, 34, 12, dark);
  v.paint(-7, 31, 11, -2, 33, 12, glow('#7fcfc0'));                           // 18°
  v.set(-5, 32, 11, dark); v.set(-5, 31, 11, dark); v.set(-3, 32, 11, dark);
  v.set(1, 32, 11, LED_G);
  v.paint(4, 31, 11, 6, 33, 12, grey); v.paint(7, 31, 11, 9, 33, 12, grey);
  v.paint(6, 4, 11, 10, 5, 12, M(STEEL, 0));                                  // badge
  v.box(-5, 15, 13, -4, 21, 14, M(RED, 3)); v.box(2, 16, 13, 3, 21, 14, M(TEAL, 3));     // tell-tale ribbons on the louvre
  // sides: a grip to wheel it about, and slots
  for (const x of [-13, 12]) {
    v.carve(x, 27, -2, x + 1, 30, 6);
    v.paint(x < 0 ? x + 1 : x - 1, 27, -2, x < 0 ? x + 2 : x, 30, 6, deep);
    for (const y of [8, 10, 12, 14]) v.paint(x, y, -4, x + 1, y + 1, 8, deep);
  }
  // back: the stub of the exhaust duct, ribbed like a hose, and the mains lead
  v.box(-8, 17, -10, 8, 33, -9, shade);
  v.cyl('z', 0, 25, -14, -10, 5.6, (x, y, z) => (z & 1 ? grey : tone(grey, -0.22)));
  v.cyl('z', 0, 25, -14, -13, 3.6, 0);
  v.cyl('z', 0, 25, -13, -12, 3.6, dark);
  v.paint(-9, 6, -9, 9, 13, -8, shade);
  v.tube(8.5, 9.5, -9.5, 9.5, 1, -10.5, 0.7, k);
  return v;
}

/* ---- vacant rooms ------------------------------------------------------------ */

/** An A-frame step ladder, climbed from the +z side, with a paint tin left on top. 24 × 64 × 24. */
export function ladder() {
  const v = new Vox();
  const al = M('#b9bfc8', 0), alD = tone(al, -0.22), cap = M(ORANGE, 0), capD = tone(cap, -0.22), k = M(BLACK, 0);
  const H = 55;
  const fz = (y) => Math.round(9 - (y / H) * 8), bz = (y) => Math.round(-11 + (y / H) * 8);     // the two sides lean together
  for (let y = 0; y < H; y++) {
    for (const x of [-11, 9]) {
      v.box(x, y, fz(y), x + 2, y + 1, fz(y) + 2, al);                        // front rails
      v.box(x < 0 ? x + 1 : x, y, bz(y), (x < 0 ? x + 1 : x) + 1, y + 1, bz(y) + 2, alD);         // back legs
    }
  }
  for (const y of [11, 22, 33, 44]) {                                         // treads, ribbed so you do not slip
    v.box(-9, y, fz(y) - 2, 9, y + 2, fz(y) + 2, al);
    v.paint(-9, y + 1, fz(y) - 2, 9, y + 2, fz(y) + 2, (px, py, pz) => (pz & 1 ? alD : 0));
  }
  for (const y of [14, 30, 46]) v.box(-10, y, bz(y), 10, y + 1, bz(y) + 1, alD);                  // braces across the back
  for (const x of [-11, 10]) { v.box(x, 27, bz(27) + 2, x + 1, 28, fz(27), alD); v.set(x, 27, 0, k); }     // spreaders
  for (const x of [-12, 8]) { v.box(x, 0, 8, x + 4, 2, 12, cap); v.box(x < 0 ? x + 1 : x, 0, -12, (x < 0 ? x + 1 : x) + 3, 2, -9, cap); }     // feet
  v.rbox(-10, H, -5, 10, H + 3, 5, 1, cap, 'xz');                             // top cap
  v.paint(-10, H, -5, 10, H + 1, 5, capD);
  tin(v, 1, H + 3, -3, 6, 6, TEAL, true);
  v.box(-8, H + 3, -1, -3, H + 4, 0, M(HONEY, 2)); v.box(-8, H + 3, -2, -6, H + 4, 1, k);       // the brush
  const ry = 22, rz = fz(ry);                                                 // a rag over the second tread
  v.box(3, ry + 2, rz - 1, 7, ry + 3, rz + 2, M(RED, 3)); v.box(3, ry - 1, rz + 2, 7, ry + 3, rz + 3, M(RED, 3));
  return v;
}

const GLYPHS = {
  V: ['#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
};

/** A "VACANT" board for the wall of an empty room, hung crooked from one nail. Back against the wall at z = 0. 40 × 24 × 2. */
export function vacantsign() {
  const v = new Vox();
  const board = M('#f4efe2', 1), red = M(RED, 1), ink = M('#33343b', 0), twine = M('#8a7a5c', 3);
  const tilt = (x) => (x < -11 ? -2 : x < -1 ? -1 : x < 10 ? 0 : 1);         // it hangs crooked; the steps fall between the letters
  for (let x = -20; x < 20; x++) {
    const y0 = 2 + tilt(x);
    v.box(x, y0, 0, x + 1, y0 + 18, 1, board);
    v.box(x, y0 + 13, 0, x + 1, y0 + 18, 2, red);                             // header band, a voxel proud of the board
    v.set(x, y0, 0, tone(board, -0.2));
    if (x > -17 && x < 16 && (x + 20) % 4 !== 3) v.set(x, y0 + 15, 1, M(PAPER, 0));              // small print
    if (x > -13 && x < 12 && (x + 20) % 5 !== 0) v.set(x, y0 + 2, 0, tone(board, -0.3));
  }
  let x = -16;
  for (const ch of 'VACANT') {
    const g = GLYPHS[ch];
    for (let row = 0; row < 5; row++) for (let i = 0; i < g[row].length; i++) if (g[row][i] === '#') v.set(x + i, 10 + tilt(x) - row, 0, ink);
    x += g[0].length + 1;
  }
  v.set(19, 2 + tilt(19), 0, 0);                                              // a chipped corner
  // the nail and the twine
  v.box(-1, 22, 0, 1, 24, 2, M('#9aa3b0', 0));
  v.tube(0, 22.5, 0.5, -17.5, 18.5, 0.5, 0.5, twine);
  v.tube(0, 22.5, 0.5, 17.5, 21.5, 0.5, 0.5, twine);
  return v;
}

export const CATALOGUE = {
  tree: { make: (o) => tree({ stage: o.stage ?? 3 }), variant: (o) => String(o.stage ?? 3) },
  bigboard: { make: () => bigboard() },
  printer: { make: () => printer() },
  shelving: { make: () => shelving() },
  boxes: { make: (o) => boxes({ seed: 1 + pick(o, 3) }), variant: (o) => String(pick(o, 3)) },
  roombadock: { make: () => roombadock() },
  roomba: { make: () => roomba() },
  hatch: { make: () => hatch() },
  rack: { make: () => rack() },
  console: { make: () => opsconsole() },
  acunit: { make: () => acunit() },
  ladder: { make: () => ladder() },
  vacantsign: { make: () => vacantsign(), wall: true, y: 1.3 },
};
