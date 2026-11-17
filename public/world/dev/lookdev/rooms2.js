// Round two's test rooms (look2.js): each a real floor of the level drawn at the Graphics tier High, which is the
// baseline. Cameras as rooms.js has them: [x, z, yaw, pitch] in the room's own frame. What is hand-built is said so.
import * as THREE from 'three';
import { figure, chair, blot, heldTorch } from './movers.js';
import { setupDoor } from './rooms.js';

const R2 = { round2: true, gfx: 'high' };
const at = (rt, x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(rt.group.matrixWorld);

/** the figure and the chair, stood in the room at (x, z) of its own frame; they are lit where they stand (world.lightAt) */
function placeMovers(look, world, rt, list) {
  for (const m of look.movers) m.group.removeFromParent();
  look.movers.length = 0;
  for (const it of list) {
    const w = at(rt, it.x, 0, it.z);
    const thing = it.t === 'chair' ? chair(look.kit) : figure(look.kit, it.stride ?? 0);
    thing.group.position.copy(w); thing.group.rotation.y = (it.yaw ?? 0) + rt.group.rotation.y;
    if (it.t === 'chair') { const b = blot(look.kit, 0.74, 0.74); b.position.set(w.x, w.y + 0.006, w.z); look.root.add(b); look.blots.push(b); }
    look.root.add(thing.group); thing.group.updateMatrixWorld(true);
    thing.light(world.lightAt(w.x, w.z, it.t === 'chair' ? 0.6 : 1.1));
    look.movers.push(thing);
  }
}

export const ROOMS2 = {
  // hard and shiny: the mailroom on Records' lino (seed 7's archive floor), its brass tube, its glass, a steel trolley
  r2shiny: {
    chosen: ['planar', 'ssr', 'materials', 'bloom', 'ao'],
    ...R2, seed: 7, themes: ['archive'], only: ['mailroom'], goto: 'mailroom', reflK: 2,
    cams: { a: [0, 3, 0, -0.12], low: [-1.5, 1.6, 0.3, -0.25] },
  },
  // a pool of the waterpark floor (waterpark.js), its basin sunk below the deck: the water's surface is the lab's (water2.js)
  r2pool: {
    chosen: ['water', 'movers', 'ao', 'bloom'],
    ...R2, seed: 7, themes: ['waterpark'], goto: 16,
    cams: { a: [4.9, 5.3, 0.45, -0.42], wide: [0, 5.4, 0, -0.3] },
    water2: {},
    // the wader walks along the near side of the basin, in the water to the knee: path(t) in the room's frame
    path: (t) => [-0.6 + 0.75 * t, 3.3 + 0.12 * Math.sin(t * 1.3)],
    extras({ look, world, rt }) {
      if (this.variant === 'empty') return;
      const fig = figure(look.kit, 0.8); look.root.add(fig.group); look.movers.push(fig); look.wader = fig;
    },
    update(t, look) {
      const fig = look.wader; if (!fig) return;
      const rt = look.rt, p = this.path(t), q = this.path(t + 0.05), y = -0.42;
      // a fresh figure each time is not wanted; the stride is the legs' swing, put on in place
      const w = at(rt, p[0], y, p[1]);
      fig.group.position.copy(w); fig.group.rotation.y = Math.atan2(-(q[0] - p[0]), -(q[1] - p[1])) + rt.group.rotation.y;
      fig.group.updateMatrixWorld(true);
      fig.light(look.world.lightAt(w.x, w.z, 1.1));
      // the wake: where each foot went in, over the last two seconds (newest first)
      look.wake = [];
      for (let k = 0; k < 12; k++) { const age = k * 0.17, pp = this.path(t - age), ww = at(rt, pp[0], 0, pp[1]); look.wake.push([ww.x, ww.z, age, k === 0 ? 1.4 : 1]); }
    },
  },
  // a dark room of seed 7's night floor looking through its doorway into the lit mailroom (rooms.js `door`), dimmed to 6 %
  // so that the doorway is the main light; at High the level already bakes the door-shaped patch on its floor and walls
  r2door: {
    chosen: ['shafts', 'ao', 'bloom'],
    ...R2, seed: 7, themes: ['night'], only: ['vending', 'mailroom', 'all-hands'], goto: 3, dim: 0.06, doorAirK: 3,
    cams: { front: [2.5, -0.3, 1.5, -0.3], a: [-1.0, -1.6, 2.52, -0.4], wide: [2.9, 0.9, 1.25, -0.18] },
    extras({ THREE: T, look, world, rt, def }) {
      const dr = def.doors.find((d) => d.side === 'left');
      setupDoor(T, look, world, rt, def, dr);
    },
  },
  // seed 7's archive floor (Records' lino): a long room to look down, for reflections on a hard floor
  r2lino: {
    chosen: ['planar', 'materials', 'ao', 'bloom'],
    // (reflK: a waxed floor, twice what bare lino would give: bare, it is too faint to pay for, as round one found)
    ...R2, seed: 7, themes: ['archive'], goto: 23, reflK: 2,
    cams: { a: [0.2, 3.0, 0.03, -0.14], b: [0.3, 2.6, 0.06, -0.24] },
  },
  // a plain room of the same floor in the level's fluorescent-bank mode (rooms.js `bank`), one bank failed (bank=out):
  // the figure under two of the tubes still lit. Nothing hand-built but the movers.
  r2bank: {
    chosen: ['movers', 'ao', 'bloom'],
    ...R2, seed: 7, themes: ['yellow'], goto: 24, lighting: 'failing',
    banks: { all: [1, 1], out: [1, 0.0025] },
    cams: { fig: [-0.6, -1.9, Math.PI + 0.1, -0.24], a: [1.2, 3.3, 0.3, -0.3] },
    movers: { stand: [{ t: 'figure', x: -1.2, z: 2.3, yaw: 2.6 }, { t: 'chair', x: -0.3, z: 1.7, yaw: 0.6 }], stride: [{ t: 'figure', x: -1.2, z: 2.3, yaw: 2.6 + Math.PI / 2, stride: 1 }, { t: 'chair', x: -0.3, z: 1.7, yaw: 0.6 }] },
    extras(o) { ROOMS2.r2office.extras.call(this, o); },
    // flicker=1: the second bank failing, not out: a stutter pinned to t (six steps a second), its tubes and its light together
    update(t, look) {
      if (!this.flicker) return;
      const k = [1, 0.06, 0.85, 0.2, 1, 0.03, 0.6, 0.1][Math.floor(t * 6) % 8], rt = look.rt;
      rt.u.banks.value = [rt.u.banks.value[0], k];
      for (const m of rt.bankPanels) if (m.userData.bank === 1) m.material.color.copy(m.userData.on).multiplyScalar(k);
    },
  },
  // the copier room of seed 7's yellow floor (rooms.js `office`), at High: its fittings, its baked tube shadows. A figure
  // and a dragged chair (hand-built, lit as the level lights what moves) under the two tubes nearest them.
  r2office: {
    chosen: ['movers', 'ao', 'bloom', 'materials'],
    ...R2, seed: 7, themes: ['yellow'], goto: 11,
    cams: { a: [0, 5, 0, -0.15], walk: [0.2, 4.2, 0.05, -0.22], low: [-1.2, 1.8, 0.75, -0.3], up: [0, 4.4, 0, 0.32] },
    movers: { stand: [{ t: 'figure', x: 0.25, z: 0.3, yaw: 0.25 }, { t: 'chair', x: -0.55, z: 0.85, yaw: 0.5 }], stride: [{ t: 'figure', x: 0.25, z: 0.3, yaw: 0.25 + Math.PI / 2, stride: 1 }, { t: 'chair', x: -0.55, z: 0.85, yaw: 0.5 }] },
    extras({ look, world, rt, camera, root }) {
      if (this.held) look.held = heldTorch(look.kit, camera, root, world.lightAt(camera.position.x, camera.position.z, 1.2).map((v) => Math.max(0.16, v * 1.25)));
      const set = this.movers[this.variant || 'none'];
      if (set) placeMovers(look, world, rt, set);
    },
  },
};
