import { mix, texOf } from '../../vox/vox.js';

export const CLOTH = '#527e80';

// A paper feed error, cut into the upholstery itself. Coordinates are in chair voxels.
export function rowOffset(y, slipping = false) {
  if (y >= 54 && y < 62) return slipping ? -2 : 7;
  return y >= 62 ? -4 : 0;
}

export function printInk(x, y, ink) {
  // Traces of the two ink passes show on opposite edges of the torn seam.
  if (y === 54 || (y === 55 && x < 3)) return mix(ink, '#c47d92', .80);
  if (y === 61 || (y === 60 && x > -3)) return mix(ink, '#a7c7b7', .84);
  return texOf(ink) === 3 ? mix(ink, '#96868e', .52) : ink;
}
