// The Backrooms — what is let into a drop ceiling, sculpted. Pure: voxels in, voxels out. Nothing here is placed:
// whoever lights the room places these (where the tubes are is where the light and the shadows come from).
//
// Every model: the origin is the middle of the thing on the ceiling plane, +y is up into the plenum, x across a
// panel and z along it. Half-size voxels (1.25 cm): place with `scale: CEILING.scale`. A light is one panel of the
// level's grid (frame.js TILE: 0.6 m by 1.2 m); a vent and a tile are one square of it (0.6 by 0.6). Nothing hangs
// more than 1.25 cm below the ceiling but the sagging tile (7.5 cm) and the dead light's dropped louvre (5 cm).
//
// A light comes as three models: `housing` (the trim, the pan, the lamp holders: lit like any surface, and whole
// without the other two), `tubes` (the glass only, so that it can shine and dim by itself) and `louvre` (the blades
// under the lamps: fine detail that a low setting may leave out). TUBES says where each tube's two ends
// are, in voxels of the model, for whoever softens a shadow by sampling along it.
import { Vox, M, glow, noise3 } from '../vox/vox.js';

export const CEILING = Object.freeze({ scale: 0.5, voxel: 0.0125, panel: Object.freeze([0.6, 1.2]), square: 0.6, deep: 0.1 });

const HX = 24, HZ = 48;                    // half a panel, in voxels
/** The two ends of each tube: [x, y, z] in model voxels (multiply by CEILING.voxel for metres). The glass is 3 voxels through. */
export const TUBES = Object.freeze([[[-9.5, 4.5, -42], [-9.5, 4.5, 42]], [[9.5, 4.5, -42], [9.5, 4.5, 42]]].map((t) => Object.freeze(t.map((p) => Object.freeze(p)))));

const box = (v) => (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);
const TRIM = '#d9d6cc', PAN = '#eeeee6', BLADE = '#c9c9c0', STEEL = '#8d908e', DARK = '#17181a';

/**
 * A recessed light: a trim round the hole, a white pan sloping up to the lamps, two tubes in their holders, and under
 * them a louvre of thin blades that hides the glass from anybody not standing beneath it.
 * @param {{dead?:boolean}} [o] dead: it is out. One tube is black at the ends and the other is gone; the louvre has dropped at one end.
 * @returns {{housing:Vox, tubes:Vox, louvre:Vox}}
 */
export function lightVox({ dead = false } = {}) {
  const h = new Vox(), t = new Vox(), l = new Vox(), B = box(h), T = box(t), L = box(l);
  const trim = M(TRIM, 0), pan = M(PAN, 0), blade = M(BLADE, 0), steel = M(STEEL, 0), dark = M(DARK, 0);
  // the box above the ceiling, open underneath; and the trim that sits on the grid, a voxel proud of the tiles
  B(-HX + 1, 7, -HZ + 1, HX - 2, 7, HZ - 2, pan);
  for (let k = 0; k < 6; k++) {                                                                    // the pan's sides slope in toward the top
    B(-HX + 1 + k, 1 + k, -HZ + 1, -HX + 1 + k, 1 + k, HZ - 2, pan); B(HX - 2 - k, 1 + k, -HZ + 1, HX - 2 - k, 1 + k, HZ - 2, pan);
  }
  B(-HX + 1, 1, -HZ + 1, HX - 2, 7, -HZ + 1, pan); B(-HX + 1, 1, HZ - 2, HX - 2, 7, HZ - 2, pan);
  B(-HX, -1, -HZ, HX - 1, 0, -HZ + 1, trim); B(-HX, -1, HZ - 2, HX - 1, 0, HZ - 1, trim);
  B(-HX, -1, -HZ, -HX + 1, 0, HZ - 1, trim); B(HX - 2, -1, -HZ, HX - 1, 0, HZ - 1, trim);
  B(-1, 6, -HZ + 2, 0, 6, HZ - 3, M('#dcdcd2', 0));                                                // the ridge between the two lamps
  // lamp holders at both ends of each tube, and the tubes
  TUBES.forEach(([a, b], i) => {
    const x = Math.floor(a[0]) - 1, y = Math.floor(a[1]) - 1;
    for (const z of [a[2] - 3, b[2]]) B(x - 1, y - 1, z, x + 3, y + 3, z + 2, steel);
    if (dead && i === 1) return;                                                                   // this one has been taken out, and not put back
    const glass = dead ? M('#9a9c98', 0) : glow('#fff6dc'), burnt = M('#3a3632', 0);
    T(x, y, a[2], x + 2, y + 2, b[2] - 1, glass);
    for (const [cx, cy] of [[x, y], [x + 2, y], [x, y + 2], [x + 2, y + 2]]) t.carve(cx, cy, a[2], cx + 1, cy + 1, b[2]);   // round, as near as three voxels go
    if (dead) for (const z0 of [a[2], b[2] - 7]) for (let z = z0; z < z0 + 7; z++) for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) if (t.has(x + dx, y + dy, z)) t.set(x + dx, y + dy, z, burnt);
  });
  // the louvre: three blades the long way and one across every 10 cm, standing on edge just inside the trim
  const drop = (z) => (dead ? Math.round(Math.max(0, (z + HZ) / (2 * HZ) - 0.45) * 7) : 0);          // (dead: one end has come off its clips and hangs)
  for (let z = -HZ + 2; z <= HZ - 3; z++) {
    const d = drop(z);
    for (const x of [-12, -1, 0, 11]) L(x, -d, z, x, 1 - d, z, blade);
    if ((z + HZ) % 8 === 4) L(-HX + 2, -d, z, HX - 3, 1 - d, z, blade);
  }
  // a dead one has what dead lights have: flies in the pan, and a brown line where the ballast cooked
  if (dead) {
    for (let k = 0; k < 9; k++) h.set(Math.round((noise3(k, 1, 2, 5) - 0.5) * 30), 7, Math.round((noise3(k, 3, 4, 5) - 0.5) * 80), dark);
    B(12, 7, -30, 16, 7, -10, M('#b9a37a', 1));
  }
  return { housing: h, tubes: t, louvre: l };
}

/** An air vent, one square: a frame, slats set at a slant with the dark of the duct between them, and the dust the air leaves on the frame. */
export function ventVox() {
  const v = new Vox(), B = box(v), S = HX;
  const frame = M('#cfcdc4', 0), slat = M('#b4b3ab', 0), under = M('#8f8e87', 0), dust = M('#7c776b', 2);
  B(-S + 1, 2, -S + 1, S - 2, 5, S - 2, M('#0c0d0e', 0));                                          // the duct
  B(-S, -1, -S, S - 1, 0, -S + 2, frame); B(-S, -1, S - 3, S - 1, 0, S - 1, frame); B(-S, -1, -S, -S + 2, 0, S - 1, frame); B(S - 3, -1, -S, S - 1, 0, S - 1, frame);
  for (let z = -S + 4; z <= S - 6; z += 4) { B(-S + 3, 0, z, S - 4, 0, z + 1, slat); B(-S + 3, 1, z + 1, S - 4, 1, z + 2, under); }    // each slat steps up and back: a slant
  B(-1, -1, -S + 3, 0, 0, S - 4, frame);                                                           // the bar down the middle
  for (const [x, z] of [[-S + 1, -S + 1], [S - 2, -S + 1], [-S + 1, S - 2], [S - 2, S - 2]]) v.set(x, -1, z, M(STEEL, 0));
  for (let x = -S; x < S; x++) for (let z = -S; z < S; z++) if (v.has(x, -1, z) && noise3(x >> 1, 4, z >> 1, 9) > 0.7 && (Math.abs(z) > S - 4 || Math.abs(x) < 3)) v.set(x, -1, z, dust);
  return v;
}

/**
 * One square of the ceiling that is on its way down: the grid's four bars, and in them a tile bellied in the middle,
 * a tide mark where the water sat, one corner broken off and the dark of the plenum through it.
 */
export function sagVox() {
  const v = new Vox(), B = box(v), S = HX;
  const bar = M('#d6d3c8', 0), tile = M('#cfc9b6', 3), wet = M('#a8946a', 3), ring = M('#7d6a45', 3), edge = M('#b9b29e', 3);
  B(-S, 0, -S, S - 1, 1, -S + 1, bar); B(-S, 0, S - 2, S - 1, 1, S - 1, bar); B(-S, 0, -S, -S + 1, 1, S - 1, bar); B(S - 2, 0, -S, S - 1, 1, S - 1, bar);
  B(-S + 2, 4, -S + 2, S - 3, 4, S - 3, M('#0c0d0e', 0));                                            // what is above it
  for (let x = -S + 2; x <= S - 3; x++) for (let z = -S + 2; z <= S - 3; z++) {
    if (x > S - 15 && z > S - 15 && x + z > 2 * S - 22 + (noise3(x, 0, z, 2) > 0.5 ? 1 : 0)) continue;   // the corner that has gone
    const fx = 1 - Math.abs(x + 3) / S, fz = 1 - Math.abs(z - 2) / S, sag = Math.round(6 * Math.max(0, fx) * Math.max(0, fz) * (0.85 + 0.3 * noise3(x >> 2, 1, z >> 2, 7)));
    const r = Math.hypot(x + 3, z - 2), c = r < 9 ? wet : r < 11 ? ring : (x > S - 17 && z > S - 17 ? edge : tile);
    v.set(x, 1 - sag, z, c); v.set(x, 2 - sag, z, c);
  }
  return v;
}
