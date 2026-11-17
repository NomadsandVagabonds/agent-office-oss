// The Backrooms — the top floor's panelling, given an edge. Pure: voxels in, voxels out. Nothing here is placed.
//
// The panelled wall is a picture on a 0.8 m repeat (kit.js, the `panel` pattern): on each tile a raised panel is drawn
// by a dark line and a pale one, 0.15 m in from the tile's edge. panelFrameVox() is that bead made real: a square
// frame 0.55 m across, 2.5 cm wide, 1.25 cm proud, to stand on the wall over each tile's drawn one, so that the
// panels catch a light that comes along the wall. x and y across the frame from its middle, z out of the wall from
// the wall's face. Half-size voxels: place with PANELLING.scale. On its tile the frame's middle is PANELLING.centre
// (0.425 m) from the tile's corner both ways: the drawn bead is not in the middle of the tile.
import { Vox, M, tone } from '../vox/vox.js';

export const PANELLING = Object.freeze({ scale: 0.5, voxel: 0.0125, tile: 0.8, frame: 0.55, inset: 0.15, centre: 0.425, bead: 0.025, proud: 0.0125 });

/**
 * @param {string} colour the wall's colour
 * @param {{flip?:boolean}} [o] flip: the light is drawn from below and the right on this wall, not from above and the left
 */
export function panelFrameVox(colour = '#8a6a48', { flip = false } = {}) {
  const v = new Vox(), N = Math.round(PANELLING.frame / PANELLING.voxel), h = N / 2, w = Math.round(PANELLING.bead / PANELLING.voxel);
  const pale = M(tone(colour, 0.12), 0), ink = M(tone(colour, -0.2), 0), hi = flip ? ink : pale, lo = flip ? pale : ink;
  const b = (x0, y0, x1, y1, c) => v.box(x0, y0, 0, x1 + 1, y1 + 1, 1, c);
  // four lengths: the top and the left catch the light, the bottom and the right are in their own shade (the bevel is in the paint)
  b(-h, h - w, h - 1, h - 1, hi); b(-h, -h + w, -h + w - 1, h - w - 1, hi);
  b(-h, -h, h - 1, -h + w - 1, lo); b(h - w, -h + w, h - 1, h - w - 1, lo);
  return v;
}
