// The Backrooms — the desk moth. A pale moth the size of a paperback, going
// round a ceiling tube a few rooms in. It is the only thing down here that is
// on your side, and it does not know it: it only wants the next light. But the
// next light is always one room nearer the way down, and it waits there, going
// round, until you have come up to it. Lose it and it is still going round the
// last tube you saw it at. Hold a lit torch and it wants that instead. Light a
// fire where it can see it and it wants that most of all, and has it.
// The rule is flits(), in moth.rule.js.
import * as THREE from 'three';
import { toWorld, ceilAt, roomPath } from '../gen.js';
import { Batch } from '../kit.js';
import { MOTH, resting, flits } from './moth.rule.js';
const HALF = 0.2, CRUISE = 1.55;

export function create(c) {
  const env = c.env, level = env.level, walker = { x: 0, z: 0, r: 0.22, tall: HALF * 2, opens: false, speed: MOTH.speed };
  let s = resting(), group = null, wings = [], room = null, lamp = null, y = 1.9, phase = 0, known = false, to = null, body = null;

  /** The tube a room's moth goes round: a lit one, the nearest the middle — or the middle of the ceiling if they are all out. */
  function lampOf(id) {
    const def = level.rooms[id], lit = def.panels.filter((p) => p.state !== 'dead').sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0] || { x: 0, z: 0 };
    const p = toWorld(def, lit.x, lit.z), height = Math.min(2.3, ceilAt(def, lit.x, lit.z) - 0.4);
    const probe = { ...walker, flightY: env.world.floorY(p.x, p.z) + height - HALF };
    const at = c.walk.spotIn(probe, id), ok = c.walk.stand(probe, p.x, p.z);
    return { room: id, x: ok ? p.x : at.x, z: ok ? p.z : at.z, y: height };
  }
  /** The next room on the way from one room to the way down, or null at the end of it. */
  const onward = (id) => { const path = roomPath(level, id, level.exit.room); return path && path.length > 1 ? path[1] : null; };

  function ready() {
    const b = new Batch(), bodyColor = [0.42, 0.38, 0.3], wing = [0.86, 0.82, 0.7];
    b.box(-0.02, -0.015, -0.07, 0.02, 0.015, 0.07, bodyColor); b.box(-0.03, -0.02, 0.05, 0.03, 0.02, 0.1, [0.3, 0.27, 0.22]);
    const mat = env.kit.surface({ map: env.kit.tex.white(), side: THREE.DoubleSide });
    group = new THREE.Group(); group.add(new THREE.Mesh(env.kit.geometry(b, [], [1, 1, 1]), mat));
    for (const sx of [-1, 1]) {
      const w = new Batch();
      w.quad([0, 0, -0.1], [sx * 0.17, 0, -0.13], [sx * 0.2, 0, 0.04], [0, 0, 0.06], wing); w.quad([0, 0, 0.02], [sx * 0.12, 0, 0.03], [sx * 0.1, 0, 0.13], [0, 0, 0.09], wing.map((v) => v * 0.9));
      const m = new THREE.Mesh(env.kit.geometry(w, [], [1, 1, 1]), mat); group.add(m); wings.push([m, sx]);
    }
    group.userData.mat = mat;
    // a few rooms in from where you land, on the way you will want to go
    const path = roomPath(level, level.start.room, level.exit.room) || [level.start.room];
    lamp = lampOf(path[Math.min(MOTH.far, path.length - 1)]); room = lamp.room;
    walker.x = lamp.x; walker.z = lamp.z; y = lamp.y;
    walker.flightY = env.world.floorY(walker.x, walker.z) + y - HALF;
    // Its first behaviour tick waits until the visitor lands. Even while
    // frozen, its mesh belongs by its tube, never at the world's origin.
    group.position.set(lamp.x + MOTH.round, env.world.floorY(walker.x, walker.z) + y, lamp.z);
    if (!c.walk.stand(walker, group.position.x, group.position.z)) group.position.x = walker.x;
    group.visible = c.drawn(walker);
    c.add(group);
    body = { r: walker.r, airborne: true, get x() { return group.position.x; }, get z() { return group.position.z; },
      get bottom() { return group.position.y - HALF; }, get top() { return group.position.y + HALF; }, get on() { return s.mode !== 'gone' && !!group; } };
    if (c.body) c.body(body); else env.world.bodies?.push(body);
  }

  return {
    ready,
    update(dt) {
      if (!group || s.mode === 'gone') return;
      walker.flightY = env.world.floorY(walker.x, walker.z) + y - HALF;
      const fire = c.fire(walker.x, walker.z), atFire = !!fire && Math.hypot(walker.x - fire.x, walker.z - fire.z) < 0.8;
      const m = c.me(), d = Math.hypot(walker.x - m.x, walker.z - m.z), held = c.held();
      const seen = !c.hidden(walker.x, walker.z, 0.3) && d < 14;
      if (seen && d < 8 && !known) { known = true; c.met(); }
      s = flits(s, dt, { d, seen, torch: !!(held && held.type === 'torch' && held.lit), next: onward(room) !== null, there: !!to && !!to.done, fire: !!fire, atFire });
      if (s.burnt) { c.play('static', walker.x, walker.z, 6); c.play('tick', walker.x, walker.z, 8); group.visible = false; return; }
      if (s.moved) { to = lampOf(onward(room)); c.play('rustle', walker.x, walker.z, 5); }
      phase += dt;
      let tx, tz, ty;
      if (s.mode === 'flame' && fire) {
        // to the fire, and round it: nearer and lower the longer it has been at it
        c.walk.go(walker, fire, MOTH.speed * dt, 0.3);
        room = c.room(walker.x, walker.z) ?? room; lamp = { room, x: walker.x, z: walker.z, y: 1.5 }; to = null;
        const k = Math.min(1, (s.heat || 0) / MOTH.burn), r = atFire ? 0.5 - 0.38 * k : 0.2;
        tx = (atFire ? fire.x : walker.x) + Math.cos(phase * (5 + 6 * k)) * r; tz = (atFire ? fire.z : walker.z) + Math.sin(phase * (5 + 6 * k)) * r;
        ty = atFire ? 1.1 - 0.75 * k : 1.3;
      } else if (s.mode === 'fly' && to) {
        const got = c.walk.go(walker, to, MOTH.speed * dt);
        if (got.door && Math.random() < dt * 3) c.play('tick', walker.x, walker.z, 5);          // against a shut door, like a moth at a window
        room = c.room(walker.x, walker.z) ?? room; ty = Math.min(CRUISE, to.y - 0.25);
        // Leave the ceiling to pass beneath the next lintel; low crawlways can
        // still admit a moth, but a chair packed into one genuinely blocks it.
        const path = roomPath(level, room, to.room), door = path?.length > 1 && level.rooms[room].doors.find(d => d.to === path[1]);
        if (door) ty = Math.min(ty, (door.sill || 0) + door.h - HALF - 0.05);
        // there, or as near as a moth gets: it goes round wherever it has got to
        to.stuck = got.went < 1e-4 && !got.door && Math.abs(y - ty) < 0.06 ? (to.stuck || 0) + dt : 0;
        if (Math.hypot(walker.x - to.x, walker.z - to.z) < 0.3 || got.there || to.stuck > 0.6) { to.done = true; lamp = { ...to, x: walker.x, z: walker.z }; room = c.room(walker.x, walker.z) ?? to.room; }
        tx = walker.x + Math.sin(phase * 9) * 0.12; tz = walker.z + Math.cos(phase * 7) * 0.12;
      } else if (s.mode === 'pester') {
        c.walk.go(walker, m, MOTH.speed * dt, 0.5);
        room = c.room(walker.x, walker.z) ?? room; lamp = { room, x: walker.x, z: walker.z, y: 1.5 };
        tx = walker.x + Math.cos(phase * 5) * 0.3; tz = walker.z + Math.sin(phase * 5) * 0.3; ty = 1.25 + Math.sin(phase * 3) * 0.15;
      } else {
        to = null;
        tx = lamp.x + Math.cos(phase * 2.6) * MOTH.round; tz = lamp.z + Math.sin(phase * 2.6) * MOTH.round; ty = lamp.y + Math.sin(phase * 4.1) * 0.08;
      }
      y += (ty - y) * (1 - Math.exp(-3 * dt));
      if (Math.abs(ty - y) < 0.01) y = ty;
      const px = group.position.x, pz = group.position.z;
      const floor = env.world.floorY(walker.x, walker.z), probe = { ...walker, flightY: floor + y - HALF };
      if (!c.walk.stand(probe, tx, tz) || !c.walk.clear(probe, px, pz, tx, tz)) {
        tx = walker.x; tz = walker.z;
        if (!c.walk.stand(probe, tx, tz) || !c.walk.clear(probe, px, pz, tx, tz)) {
          // Do not lower the visible moth into a desktop just because its
          // orbit wants to dip; keep the last clear altitude instead.
          y = group.position.y - floor; probe.flightY = group.position.y - HALF;
          if (!c.walk.stand(probe, tx, tz) || !c.walk.clear(probe, px, pz, tx, tz)) { tx = px; tz = pz; walker.x = px; walker.z = pz; }
        }
      }
      group.position.set(tx, floor + y, tz);
      y = group.position.y - env.world.floorY(walker.x, walker.z);
      if (Math.hypot(tx - px, tz - pz) > 1e-4) group.rotation.y = Math.atan2(tx - px, tz - pz);
      for (const [w, sx] of wings) w.rotation.z = sx * (0.25 + Math.sin(phase * 34) * 0.75);
      group.visible = c.drawn(walker);
      const L = c.light(walker.x, walker.z, 1.6); group.userData.mat.uniforms.uTint.value.set(L[0] * 1.6 + 0.08, L[1] * 1.6 + 0.08, L[2] * 1.6 + 0.08);
    },
    at: () => ({ x: walker.x, z: walker.z, room, mode: s.mode, next: onward(room) }),
    dispose() { const i = env.world.bodies?.indexOf(body) ?? -1; if (i >= 0) env.world.bodies.splice(i, 1); group?.removeFromParent(); group = null; },
  };
}
