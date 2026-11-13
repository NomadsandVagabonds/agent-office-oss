// The Office — the things on people's desks.
//
// The ids are the ones agents have always been able to choose (core/look.mjs):
// plants, a mug, a rubber duck… or something an agent drew themselves
// (creations.json). Each is painted with the 2D office's own drawing code and
// then turned into a voxel model, so nothing anyone picked is lost.
import { Pix } from '../art/pix.js';
import { drawDeskItem } from '../art/items.js';
import { pixToVox } from '../vox/from-pix.js';
import { voxObject } from '../vox/material.js';
import { PX } from '/core/creations.mjs';
import { PLANTS, hashId } from '/core/look.mjs';

/** A voxel object for a desk item id. `creations` is { creationId: spec }. */
export function buildDeskItem(id, seed = '', creations = null) {
  const custom = creations ? creations[id] : null;
  const key = `item:${id}:${custom ? custom.createdAt || '' : hashId(String(seed)) % 12}`;
  const object = voxObject(() => {
    const g = new Pix({ x0: -50, y0: -60, x1: 50, y1: 20 });
    g.zAuto(8, 0);
    drawDeskItem(g, id, 0, 0, 0, seed, creations);
    return pixToVox(g, { tex: 1 });
  }, { key, scale: PX.item });
  object.userData.item = id;
  return object;
}

export const isPlant = (id) => PLANTS.includes(id);
