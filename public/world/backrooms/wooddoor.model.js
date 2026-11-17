// The Backrooms — an ordinary wooden door, sculpted. Pure: voxels in, voxels out.
// The door of every office that has a door: two stiles, a head rail, a lock rail and a deep bottom rail, a muntin
// down the middle, and between them four panels sunk into the frame, each with a field raised in it. A brass plate
// with a lever on it and a keyhole under, three butt hinges on the other edge, the grain running the way each piece
// of wood runs, and the foot of it kicked. It hangs on walls, lies in floors and is let into ceilings (bits.js).
// x across (the middle of the door is 0; the lever is on the +x side), y up it from its foot, z out of whatever it
// is on: its back is z = 0. Half-size voxels (1.25 cm); whoever places it stretches it to the door it is.
import { Vox, M, tone, noise3 } from '../vox/vox.js';

export const WOODDOOR = Object.freeze({ voxel: 0.0125, thick: 3, proud: 2 });

/** How many voxels a door of these metres is: { W (even), H }. */
export const doorSize = (w, h) => ({ W: Math.max(20, Math.round(w / WOODDOOR.voxel / 2) * 2), H: Math.max(30, Math.round(h / WOODDOOR.voxel)) });

/**
 * @param {{w:number, h:number, colour:string}} o  metres across and high, and the paint or stain
 * @returns {Vox}
 */
export function woodDoorVox({ w, h, colour }) {
  const { W, H } = doorSize(w, h), v = new Vox(), X0 = -W / 2, X1 = W / 2 - 1, T = WOODDOOR.thick;
  const B = (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);
  const wood = M(colour, 2), grain = M(tone(colour, -0.1), 2), pale = M(tone(colour, 0.1), 2), sunk = M(tone(colour, -0.24), 2), bead = M(tone(colour, -0.36), 2);
  const brass = M('#b39a55', 0), brassD = M('#7d6a38', 0), black = M('#141312', 0);
  const small = H < 80, stile = small ? 3 : 7, head = small ? 3 : 8, foot = small ? 5 : 13, lockH = small ? 3 : 10, mid = small ? 2 : 6;
  const lockY = Math.round(H * 0.44), half = mid >> 1;

  // the slab, and on its face the frame: every piece its own way of the grain
  B(X0, 0, 0, X1, H - 1, T - 1, wood);
  const upright = (x0, x1, y0, y1) => { for (let x = x0; x <= x1; x++) B(x, y0, T, x, y1, T, noise3(x, 3, 1, 5) > 0.72 ? grain : noise3(x, 7, 2, 5) > 0.8 ? pale : wood); };
  const across = (x0, x1, y0, y1) => { for (let y = y0; y <= y1; y++) B(x0, y, T, x1, y, T, noise3(2, y, 1, 9) > 0.72 ? grain : noise3(4, y, 2, 9) > 0.8 ? pale : wood); };
  upright(X0, X0 + stile - 1, 0, H - 1); upright(X1 - stile + 1, X1, 0, H - 1);
  across(X0 + stile, X1 - stile, H - head, H - 1); across(X0 + stile, X1 - stile, 0, foot - 1); across(X0 + stile, X1 - stile, lockY, lockY + lockH - 1);
  upright(-half, half - 1 + (mid & 1), foot, lockY - 1); upright(-half, half - 1 + (mid & 1), lockY + lockH, H - head - 1);
  // four panels: sunk to the slab, a dark bead where each meets the frame, and a field standing in the middle of it
  for (const [x0, x1] of [[X0 + stile, -half - 1], [half + (mid & 1), X1 - stile]]) for (const [y0, y1] of [[foot, lockY - 1], [lockY + lockH, H - head - 1]]) {
    if (x1 - x0 < 3 || y1 - y0 < 3) continue;
    B(x0, y0, T - 1, x1, y1, T - 1, sunk);
    B(x0, y0, T - 1, x1, y0, T - 1, bead); B(x0, y1, T - 1, x1, y1, T - 1, bead); B(x0, y0, T - 1, x0, y1, T - 1, bead); B(x1, y0, T - 1, x1, y1, T - 1, bead);
    const inset = small ? 1 : 4;
    if (x1 - x0 > inset * 2 + 2 && y1 - y0 > inset * 2 + 2) { B(x0 + inset, y0 + inset, T, x1 - inset, y1 - inset, T, wood); B(x0 + inset, y0 + inset, T, x1 - inset, y0 + inset, T, grain); B(x0 + inset, y1 - inset, T, x1 - inset, y1 - inset, T, pale); }
  }
  // the furniture: a plate, a lever standing off it toward the middle of the door, a keyhole
  {
    const px = X1 - stile + (small ? 0 : 2), py = lockY + (lockH >> 1), ph = small ? 3 : 8;
    B(px, py - ph, T + 1, px + (small ? 1 : 3), py + ph, T + 1, brass);
    if (!small) { B(px + 1, py + 2, T + 2, px + 2, py + 3, T + 4, brassD); B(px - 8, py + 2, T + 4, px + 2, py + 3, T + 5, brass); v.set(px + 1, py - 4, T + 1, black); v.set(px + 2, py - 4, T + 1, black); v.set(px + 1, py - 5, T + 1, black); }
    else B(px - 3, py, T + 2, px + 1, py, T + 3, brass);
  }
  // three hinges on the hanging edge
  if (!small) for (const hy of [Math.round(H * 0.1), H >> 1, Math.round(H * 0.9)]) { B(X0 - 1, hy - 4, T - 1, X0 - 1, hy + 4, T, brass); v.set(X0 - 1, hy - 1, T + 1, brassD); v.set(X0 - 1, hy + 2, T + 1, brassD); }
  // where feet and buckets have been
  for (let x = X0; x <= X1; x++) for (let y = 0; y < Math.min(6, foot); y++) if (noise3(x >> 2, y, 4, 13) > 0.78) v.set(x, y, T, sunk);
  return v;
}
