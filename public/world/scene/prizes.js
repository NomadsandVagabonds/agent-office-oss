// The Office — what has been bought from the vending machine (core/game.mjs)
// stands on top of it, each thing on its own spot, for as long as the office
// lasts. Two of them do a little more than stand: the lava lamp's wax goes
// round, and Capt. Legacy's head is never quite where you left it.
import * as THREE from 'three';
import { VOXEL } from '../vox/vox.js';
import { voxObject } from '../vox/material.js';
import { PRIZE_MODELS, PRIZE_PARTS, PRIZE_SPOTS } from '../props/prizes.js';

const POP = 0.45, LAVA = 1.6, GLANCE = [5, 11];          // seconds: arriving · a frame of wax · between looks

export function createPrizes(office) {
  const shown = new Map();                               // prize id → { holder, parts, born, next }
  const at = new THREE.Vector3(), q = new THREE.Quaternion(), e3 = new THREE.Euler();
  let node = null, t = 0, first = true;

  function build(id) {
    const holder = new THREE.Group();
    const pieces = PRIZE_PARTS[id] || [{ make: PRIZE_MODELS[id], at: [0, 0, 0], role: 'still' }];
    const parts = pieces.map((p, i) => {
      const o = voxObject(p.make, { key: `prize:${id}:${i}`, lod: false });
      o.position.set(p.at[0] * VOXEL, p.at[1] * VOXEL, p.at[2] * VOXEL);
      holder.add(o);
      return { o, role: p.role, i };
    });
    return { holder, parts, born: 0, next: 0 };
  }

  /** Stand whatever the office says has been bought on the machine; take away what it does not. */
  function sync() {
    const w = office.world, world = office.net.state.world;
    if (!w || !world) return;
    const machine = w.layout.objects.find((o) => o.type === 'vending');
    const home = machine ? w.furniture.nodes.get(machine.id) : null;
    if (!home) return;
    if (home !== node) { for (const e of shown.values()) e.holder.removeFromParent(); shown.clear(); node = home; }     // the office was rebuilt round it
    const bought = new Set(world.game?.prizes || []);
    for (const [id, e] of shown) if (!bought.has(id)) { e.holder.removeFromParent(); shown.delete(id); }
    for (const id of bought) {
      if (shown.has(id) || !PRIZE_SPOTS[id] || !PRIZE_MODELS[id]) continue;
      const e = build(id), [x, y, z] = PRIZE_SPOTS[id];
      e.holder.position.set(x * VOXEL, y * VOXEL, z * VOXEL);
      e.born = first ? -9 : t;                           // what was already here when you came in does not arrive again
      node.add(e.holder);
      shown.set(id, e);
    }
    first = false;
  }

  function update(dt) {
    t += dt;
    for (const e of shown.values()) {
      const k = Math.min(1, (t - e.born) / POP);
      e.holder.scale.setScalar(k < 1 ? Math.max(0.001, 1 + 0.35 * Math.sin(k * Math.PI) - (1 - k) ** 2) : 1);
      for (const p of e.parts) {
        if (p.role === 'frame') p.o.visible = Math.floor(t / LAVA) % 3 === p.i;
        else if (p.role === 'head' && t >= e.next) {
          // it looks at whoever is about — the person walking the floor, or else the camera — but never while you could say you saw it turn
          e.next = t + GLANCE[0] + Math.random() * (GLANCE[1] - GLANCE[0]);
          const walk = office.walk?.state, cam = office.stage?.camera;
          const tx = walk?.active ? walk.x : cam?.position.x, tz = walk?.active ? walk.z : cam?.position.z;
          if (tx === undefined) continue;
          e.holder.getWorldPosition(at); e.holder.getWorldQuaternion(q); e3.setFromQuaternion(q, 'YXZ');
          p.o.rotation.y = Math.atan2(tx - at.x, tz - at.z) - e3.y + (Math.random() - 0.5) * 0.5;
        }
      }
    }
  }

  return { sync, update, shown };
}
