// The Office — small things: what sits on desks, shelves and pedestals, and
// the hats agents made for themselves.
//
// The ids are the ones agents have always been able to choose (core/look.mjs):
// plants, a mug, a rubber duck… or something an agent drew (creations.json,
// see CREATIONS.md). Each is painted with the 2D office's own drawing code and
// then turned into a voxel model, so nothing anyone picked or made is lost —
// and a creation's `glow` ops become voxels that really light up.
import { Pix } from '../art/pix.js';
import { drawDeskItem, drawCustom, creationGlows } from '../art/items.js';
import { pixToVox } from '../vox/from-pix.js';
import { voxObject } from '../vox/material.js';
import { C, mix, isGlass } from '../vox/vox.js';
import { PX } from '/core/creations.mjs';
import { PLANTS, hashId } from '/core/look.mjs';

/** The lit heart of each glow: voxels near its centre become self-luminous. */
function applyGlows(vox, spec, res) {
  for (const g of creationGlows(spec)) {
    const cx = g.x * res, cy = -g.y * res, rx = Math.max(1, (g.w * res) * 0.22), ry = Math.max(1, (g.h * res) * 0.22);
    vox.remap((x, y, z, v) => {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1 || isGlass(v)) return v;
      return C(mix(v, g.c, 0.45), { tex: 0, glow: true });
    });
  }
  return vox;
}

/** A creation spec → Vox. `res` draws it finer than one voxel per drawing pixel. */
export function creationVox(spec, res = 1) {
  const g = new Pix({ x0: Math.floor(-50 * res), y0: Math.floor(-60 * res), x1: Math.ceil(50 * res), y1: Math.ceil(20 * res) });
  if (res !== 1) g.scale(res);
  g.zAuto(Math.round(8 * res), 0);
  drawCustom(g, spec, 0, 0, 0);
  return applyGlows(pixToVox(g, { tex: 1 }), spec, res);
}

/** A voxel object for a desk item id. `creations` is { creationId: spec }. */
export function buildDeskItem(id, seed = '', creations = null) {
  const custom = creations ? creations[id] : null;
  const key = `item:${id}:${custom ? custom.createdAt || '' : hashId(String(seed)) % 12}`;
  const object = voxObject(() => {
    if (custom) return creationVox(custom, 1);
    const g = new Pix({ x0: -50, y0: -60, x1: 50, y1: 20 });
    g.zAuto(8, 0);
    drawDeskItem(g, id, 0, 0, 0, seed, creations);
    return pixToVox(g, { tex: 1 });
  }, { key, scale: PX.item });
  object.userData.item = id;
  return object;
}

/**
 * A hat an agent made, sized for the 3D head. The result is in the avatar's
 * own voxel units: add it to `avatar.hat` (the top of the head is its origin).
 */
export function buildHat(spec) {
  const object = voxObject(() => creationVox(spec, 1.5), { key: `hat:${spec.id}:${spec.createdAt || ''}`, scale: 1 });
  object.userData.hat = spec.id;
  return object;
}

/** Any creation, for display (a pedestal, a shelf): items as they are, hats on their own. */
export function buildExhibit(spec, creations) {
  if (spec.kind === 'hat') {
    const object = voxObject(() => creationVox(spec, 1.5), { key: `hat:${spec.id}:${spec.createdAt || ''}`, scale: PX.item * 1.1 });
    object.userData.item = spec.id;
    return object;
  }
  return buildDeskItem(spec.id, '', creations);
}

export const isPlant = (id) => PLANTS.includes(id);
