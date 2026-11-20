import * as T from 'three';
import { Batch } from '../../backrooms/kit.js';
import { chairVox, WORKSTATION } from '../../backrooms/workstation.model.js';
import { mix, texOf, Vox, VOXEL } from '../../vox/vox.js';

export const CLOTH = '#527e80';
export const CELL = VOXEL * WORKSTATION.scale;

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

export function makePrintPoses(kit, room, probeLit) {
  const source = chairVox({colour: CLOTH});
  const scale = new T.Matrix4().makeScale(CELL, CELL, CELL);
  function bake(slipping) {
    const model = kit.model('chair-study:misprint:' + slipping, () => {
      const result = new Vox();
      source.each((x, y, z, ink) => result.set(x + rowOffset(y, slipping), y, z, printInk(x, y, ink)));
      return result;
    }, {ao: false});
    const batch = new Batch(true).addVox(model.solid, scale);
    return probeLit ? kit.geometry(batch, [], [1, 1, 1]) : kit.geometry(batch, room.lights, room.amb, room.lighting);
  }
  // Both poses share the existing furniture material. The room kit owns their lifetime.
  return {rest: bake(false), slip: bake(true)};
}
