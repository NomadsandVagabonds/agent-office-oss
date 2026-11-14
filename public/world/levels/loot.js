// The Office — a thing lying about to be picked up: a coin or a keycard,
// turning slowly a hand above the floor. For any floor's scene:
//
//   const p = makePickup('coin');          // { group, update(dt, t), take(), dispose(), taken }
//   scene.add(p.group); p.group.position.set(x, y, z);
//   each frame: p.update(dt, t);           // it turns and bobs; after take() it leaps and is gone
//
// Floors built with the level kit do not need this directly: w.loot({ item,
// n, x, z }) places one, watches for you walking into it, and tells the
// office (public/world/game.js) when you have.
import * as THREE from 'three';
import { voxObject } from '../vox/material.js';
import { VOXEL } from '../vox/vox.js';
import { coin, keycard } from '../props/loot.js';

const MODEL = { coin, card: keycard };

/**
 * @param {'coin'|'card'} item
 * @param {{scale?:number, hover?:number, light?:boolean}} [opt]  scale: 1 is life size (a coin is 22 cm: this is a chibi world) ·
 *        hover: how high its lowest point floats, metres · light: a small glow of its own, for dark floors
 */
export function makePickup(item, opt = {}) {
  const group = new THREE.Group(), turn = new THREE.Group();
  const node = voxObject(MODEL[item] || coin, { lod: false, cast: true, receive: false });
  const scale = opt.scale ?? (item === 'card' ? 1.5 : 1.6);
  turn.scale.setScalar(scale);
  turn.add(node);
  group.add(turn);
  const hover = opt.hover ?? 0.42;
  let lamp = null;
  if (opt.light) { lamp = new THREE.PointLight(item === 'card' ? '#9fd0ff' : '#ffd97a', 1.4, 3.2, 1.6); lamp.position.y = hover + 0.2; group.add(lamp); }
  const self = {
    group, item, taken: false, gone: false, t: 0,
    /** Turn and bob; once taken, jump and vanish. Returns false when there is nothing left to draw. */
    update(dt, t = 0) {
      if (self.gone) return false;
      if (!self.taken) {
        turn.rotation.y = t * 1.8;
        turn.position.y = hover + Math.sin(t * 2.4) * 0.05;
        return true;
      }
      self.t += dt / 0.55;
      const k = Math.min(1, self.t);
      turn.rotation.y += dt * 16;
      turn.position.y = hover + Math.sin(k * Math.PI) * 0.6 + k * 0.5;
      turn.scale.setScalar(scale * (1 - k * k));
      if (lamp) lamp.intensity = 1.4 * (1 - k);
      if (k >= 1) { self.gone = true; group.visible = false; }
      return !self.gone;
    },
    take() { if (!self.taken) { self.taken = true; self.t = 0; } },
    dispose() { node.traverse((o) => { o.geometry?.dispose?.(); }); group.removeFromParent(); },
  };
  return self;
}

export { VOXEL };
