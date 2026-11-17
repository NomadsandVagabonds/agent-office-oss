// The Backrooms — the yellow sign that stands on a floor, sculpted. Pure: voxels in, voxels out.
// Two moulded boards hinged at the top and held apart by a stay: each a slab with a rim standing proud round it, a
// slot to carry it by, two feet, and the scuffs of having been kicked along a corridor. What it says is a picture,
// laid in the well inside the rim (bits.js). Half-size voxels (1.25 cm).
import { Vox, M, tone, noise3 } from '../vox/vox.js';

export const WETSIGN = Object.freeze({ scale: 0.5, w: 0.3, h: 0.6, spread: 0.17, top: 0.01, rim: 0.03 });
const YELLOW = '#e9bb16', V = 0.0125;

/** One board: x across (centred), y up it from the floor, the face that is read at z = 0 looking along +z; its back behind. */
export function boardVox() {
  const v = new Vox(), W = Math.round(WETSIGN.w / V) >> 1, H = Math.round(Math.hypot(WETSIGN.h, WETSIGN.spread - WETSIGN.top) / V);
  const B = (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c), K = (x0, y0, z0, x1, y1, z1) => v.carve(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1);
  const yellow = M(YELLOW, 1), rim = M(tone(YELLOW, 0.12), 1), back = M(tone(YELLOW, -0.38), 1), dark = M('#2a2618', 0);
  B(-W, 0, -2, W - 1, H - 1, -1, yellow); B(-W, 0, -2, W - 1, H - 1, -2, back);
  B(-W, 0, 0, W - 1, H - 1, 0, rim); K(-W + 2, 3, 0, W - 3, H - 8, 0);                              // the rim, and the well the words sit in
  for (const x of [-W + 3, W - 5]) for (let y = 4; y < H - 9; y += 6) B(x, y, -3, x + 1, y + 3, -3, back);   // ribs moulded into the back
  K(-5, H - 5, -2, 4, H - 4, 0); B(-6, H - 6, 0, 5, H - 6, 0, rim);                                 // the slot the hand goes through
  for (const x of [-W, W - 4]) B(x, 0, -3, x + 3, 1, 0, dark);                                      // feet
  for (let x = -W; x < W; x++) for (let y = 0; y < 9; y++) for (const z of [-1, 0]) if (v.has(x, y, z) && noise3(x >> 1, y, z, 6) > 0.74) v.set(x, y, z, M(tone(YELLOW, -0.3), 2));
  return v;
}

/** What joins the two: the hinge along the top, and the stay half-way down. Stood between them, upright; z is from board to board. */
export function frameVox() {
  const v = new Vox(), W = Math.round(WETSIGN.w / V) >> 1, top = Math.round(WETSIGN.h / V), mid = Math.round(top * 0.42);
  const reach = Math.round((WETSIGN.spread - (WETSIGN.spread - WETSIGN.top) * 0.42) / V) - 2;
  const B = (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);
  B(-W + 1, top - 2, -2, W - 2, top - 1, 1, M(tone(YELLOW, -0.25), 0));
  for (const x of [-W + 4, W - 5]) { v.set(x, top, -1, M('#2a2618', 0)); v.set(x, top, 0, M('#2a2618', 0)); }
  B(-1, mid, -reach, 0, mid, reach - 1, M('#2a2618', 0));
  return v;
}
