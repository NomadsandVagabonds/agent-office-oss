// The Backrooms — the hand, in a room: things left lying for the visitor to
// pick up, and a model of one to stand about as set dressing. What is carried
// is the pockets' business (inventory*.js); what a resident asks about it is
// items.js. This is the part of the two that needs three.js.
import * as THREE from 'three';
import { Batch, lamp } from './kit.js';
import { INVENTORY_MODELS } from './inventory-items.js';
import { KINDS, ITEM_IDS, isPaper, isBalloon, isFlashlight, createHandOver } from './items.js';

export { ITEM_IDS, isPaper, isBalloon, isFlashlight };

/** Give a part of the building its hand (env.hand): the selected pocket, in the words its rooms use. */
export function createHand(env) {
  env.hand = createHandOver(() => env.inventory || null, `hand:${env.level.seed}:${env.level.depth ?? 0}`);
  return env.hand;
}

/** One of a thing, as a model with nothing to do: for a room to stand about. `light(rgb)` tints it. */
export function buildItemProp(kit, kind) {
  const type = KINDS[kind] || 'paper', b = new Batch(true), s = kit.VOXEL || 0.025, group = new THREE.Group();
  b.addVox(kit.model(`inventory:${type}:v1`, INVENTORY_MODELS[type]).solid, new THREE.Matrix4().makeScale(s, s, s));
  const mat = kit.surface({ vox: true });
  group.add(new THREE.Mesh(kit.geometry(b, [lamp(-1, 3, 1, [0.4, 0.4, 0.4], { k: 8, far: 12, wrap: 0.5 })], [0.8, 0.8, 0.8]), mat));
  group.userData.light = (rgb) => mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
  return group;
}

/**
 * Leave something in a room for the visitor to pick up: at (x, z) in the room's own frame, `y` metres up (a desk top).
 * It goes down once the part is built and the pockets are hung (c.leave: world.js); a visit without pockets leaves nothing.
 * → { get(): the kind lying there until it is taken, as far as the room can know · set(kind): leave another }
 */
export function placePickup(c, kind, x, z, y = 0, opt = {}) {
  const type = KINDS[kind];
  let slot = type ? kind : null;
  if (type) c.leave(type, x, z, { y, quantity: opt.quantity ?? (type === 'paper' ? 3 : 1), taken: () => { slot = null; opt.onTake?.(kind, null); } });
  return { get: () => slot, set(next) { if (KINDS[next]) { slot = next; c.leave(KINDS[next], x, z, { y }); } else slot = null; } };
}
