// The Backrooms — the other lights a ceiling wears, sculpted. Pure: voxels in, voxels out. Nothing here is placed:
// whoever lights the room places these, as it places the troffer (ceiling.model.js).
//
// The same conventions as that file: half-size voxels (1.25 cm): place with `scale: FITTINGS.scale`. The origin is
// the middle of the fitting's lowest face; +y is up, toward the ceiling it is fixed to; x across it, z along it. So
// a fitting `deep` high is placed with its origin `deep` under the ceiling (FITTINGS.<kind>.deep, metres), exactly as
// the troffer is placed CEILING.deep under it. Each comes as named parts, so that what shines can shine by itself and
// what is fine can be left out; `dead: true` gives the same parts with nothing lit in them.
//
//   the pool light   a sealed fitting for a wet room: a closed body the size of a troffer, a ribbed lens, clips
//   the batten       a bare tube under a narrow steel channel, a holder at each end; 0.6, 1.2 or 1.8 m
//   the can          a small downlight: a trim ring and a lit disc set up inside it
import { Vox, M, glow, tone } from '../vox/vox.js';

export const FITTINGS = Object.freeze({
  scale: 0.5, voxel: 0.0125,
  pool: Object.freeze({ size: Object.freeze([0.6, 1.2]), deep: 0.1 }),
  batten: Object.freeze({ wide: 0.1, deep: 0.075, lengths: Object.freeze([0.6, 1.2, 1.8]) }),
  can: Object.freeze({ across: 0.175, deep: 0.05 }),
});

const box = (v) => (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);
const BODY = '#d7d8d2', STEEL = '#8d908e', LIT = '#f2fbff', OUT = '#9aa09c';

/**
 * The pool light: 0.6 m by 1.2 m, 10 cm deep. A closed moulded body with an end cap at each end and a gasket line,
 * two steel clips a side holding the lens on, and the lens: frosted, ribbed across, proud of the body by a voxel.
 * @param {{dead?:boolean}} [o]
 * @returns {{housing:Vox, lens:Vox}}  the lens is what shines
 */
export function poolLightVox({ dead = false } = {}) {
  const h = new Vox(), l = new Vox(), H = box(h), L = box(l), HX = 24, HZ = 48;
  const body = M(BODY, 0), cap = M(tone(BODY, -0.08), 0), gasket = M('#2a2d2e', 0), steel = M(STEEL, 0);
  H(-HX, 3, -HZ, HX - 1, 7, HZ - 1, body);                                                        // the body, shut all round and on top
  H(-HX, 2, -HZ, HX - 1, 2, HZ - 1, gasket);                                                      // the gasket the lens seats on
  for (const z of [-HZ, HZ - 3]) H(-HX, 1, z, HX - 1, 7, z + 2, cap);                             // end caps, a little deeper than the body
  for (const z of [-26, 24]) for (const x of [-HX, HX - 1]) { H(x, 0, z, x, 4, z + 2, steel); H(x < 0 ? x : x - 1, 0, z, x < 0 ? x + 1 : x, 0, z + 2, steel); }   // clips: down the side and under the lens's edge
  const lit = dead ? M(OUT, 0) : glow(LIT), rib = dead ? M(tone(OUT, -0.08), 0) : glow('#dcefff');
  L(-HX + 1, 0, -HZ + 3, HX - 2, 1, HZ - 4, lit);
  for (let z = -HZ + 5; z <= HZ - 6; z += 4) L(-HX + 1, 0, z, HX - 2, 0, z, rib);                  // ribs across it, a shade apart: the picture of a prismatic lens
  if (dead) { L(-6, 0, -30, 9, 0, -12, M('#6f7a68', 2)); L(-14, 0, 8, -9, 0, 20, M('#6f7a68', 2)); }   // out, and what grows in a wet fitting that is out
  return { housing: h, lens: l };
}

/**
 * The batten: a steel channel 10 cm wide and 3.75 cm deep fixed to the ceiling, a holder at each end, one tube under it.
 * @param {{len?:number, dead?:boolean}} [o] len: 0.6, 1.2 (as given) or 1.8 metres
 * @returns {{channel:Vox, holders:Vox, tube:Vox}}  the tube is what shines
 */
export function battenVox({ len = 1.2, dead = false } = {}) {
  const n = Math.round((FITTINGS.batten.lengths.includes(len) ? len : 1.2) / FITTINGS.voxel), HZ = n / 2;
  const c = new Vox(), hd = new Vox(), t = new Vox(), C = box(c), Hh = box(hd), T = box(t);
  const steel = M('#d4d5cf', 0), under = M(tone('#d4d5cf', -0.12), 0), holder = M('#eceae2', 0), pin = M(STEEL, 0);
  C(-4, 3, -HZ, 3, 5, HZ - 1, steel); C(-4, 3, -HZ, 3, 3, HZ - 1, under);                         // the channel: its underside is in its own shade
  for (const z of [-HZ, HZ - 3]) { Hh(-2, 0, z, 1, 2, z + 2, holder); Hh(-1, 1, z < 0 ? z + 2 : z, 0, 1, z < 0 ? z + 2 : z, pin); }
  const glass = dead ? M(OUT, 0) : glow('#fff6dc');
  T(-1, 0, -HZ + 3, 0, 2, HZ - 4, glass); T(-2, 1, -HZ + 3, 1, 1, HZ - 4, glass);                 // round, as near as three voxels go
  if (dead) for (const z0 of [-HZ + 3, HZ - 10]) T(-2, 0, z0, 1, 2, z0 + 6, M('#3a3632', 0)), t.carve(-2, 0, z0, -1, 1, z0 + 7), t.carve(1, 0, z0, 2, 1, z0 + 7), t.carve(-2, 2, z0, -1, 3, z0 + 7), t.carve(1, 2, z0, 2, 3, z0 + 7);
  return { channel: c, holders: hd, tube: t };
}

/**
 * The can: a trim ring 17.5 cm across and 5 cm deep with its corners taken off, and a lit disc set a voxel up inside it.
 * @param {{dead?:boolean}} [o]
 * @returns {{trim:Vox, disc:Vox}}  the disc is what shines
 */
export function canVox({ dead = false } = {}) {
  const tr = new Vox(), d = new Vox(), T = box(tr), D = box(d), ring = M('#e4e2da', 0), inner = M('#b9b8b0', 0);
  T(-7, 0, -6, 6, 3, 5, ring); T(-6, 0, -7, 5, 3, 6, ring);                                        // square with its corners taken off: rooms hang many of these
  tr.carve(-5, 0, -5, 5, 3, 5);                                                                    // the well
  T(-5, 3, -5, 4, 3, 4, inner);                                                                    // its roof, behind the disc
  D(-4, 1, -4, 3, 1, 3, dead ? M(OUT, 0) : glow('#fff3d6'));
  return { trim: tr, disc: d };
}
