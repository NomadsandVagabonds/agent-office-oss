// The Backrooms — carried interest. Somebody senior: a great soft weight in a
// waistcoat that was made for somebody else, with a small head asleep on top
// of it and no legs under it, borne along on ten small things of Mother's
// sort. It comes, slowly, and is set down on whoever it reaches
// (carried-interest.rule.js). Tread on enough of what carries it (E) and it is
// on the floor, howling, until more have grown.
//
// Voxels (carried-interest.model.js), posed every frame.
import * as THREE from 'three';
import { roomDistances } from '../gen.js';
import { Batch, lamp } from '../kit.js';
import { CARRIED, borne, carried, pace, under } from './carried-interest.rule.js';
import { S, SB, weightVox, armVox, bearerVox } from './carried-interest.model.js';

export function create(c) {
  const env = c.env, level = c.level, K = CARRIED;
  const walker = { x: 0, z: 0, r: K.r, tall: K.tall, opens: false };
  let s = borne(), group = null, mat = null, small = null, weight = null, arms = [], bearers = [], use = null;
  let clock = 0, rot = 0, high = 0.98, tilt = 0, goal = null, goalT = 0, known = false, over = false, lastX = 0, lastZ = 0, pending = 0, shake = 0, walked = 0;

  const LIGHTS = [lamp(0.6, 3.2, 1.4, [1.1, 1.05, 1.0], { k: 9, wrap: 0.45, far: 40 })];
  const geo = (key, make, k) => { const b = new Batch(true); b.addVox(env.kit.model(key, make).solid, new THREE.Matrix4().makeScale(k, k, k)); return env.kit.geometry(b, LIGHTS, [0.4, 0.38, 0.38]); };

  function startRoom() {
    const dist = roomDistances(level, level.start.room), fits = (r) => !r.crawl && r.H >= 2.2 && r.kind !== 'start' && r.kind !== 'exit' && (dist.get(r.id) ?? 0) >= 2;
    const plain = level.rooms.filter((r) => fits(r) && r.kind === 'plain' && Math.min(r.W, r.D) >= 4 && (dist.get(r.id) ?? 0) >= 3), far = level.rooms.filter(fits);
    const pool = plain.length ? plain : far.length ? far : level.rooms.filter((r) => r.kind !== 'start');
    const pick = pool.length ? c.R.pick(pool) : level.rooms[0];
    if (c.haunt != null && level.rooms[c.haunt] && fits(level.rooms[c.haunt])) { const sp = c.walk.spotIn(walker, c.haunt); if (c.walk.stand(walker, sp.x, sp.z)) return c.haunt; }
    return pick.id;
  }

  function ready() {
    const spot = c.walk.spotIn(walker, startRoom());
    walker.x = lastX = spot.x; walker.z = lastZ = spot.z; rot = c.R.range(0, Math.PI * 2);
    mat = env.kit.surface({ vox: true, wet: 0.45 }); small = env.kit.surface({ vox: true, wet: 1 });
    group = new THREE.Group();
    weight = new THREE.Mesh(geo('carried:weight', weightVox, S), mat); group.add(weight);
    for (const side of [-1, 1]) { const m = new THREE.Mesh(geo('carried:arm:' + (side > 0 ? 1 : 0), () => armVox(side > 0 ? 1 : 0), S), mat); group.add(m); arms.push({ side, m }); }
    const kinds = [0, 1, 2].map((k) => geo('carried:bearer:' + k, () => bearerVox(k), SB));
    for (let i = 0; i < K.bearers; i++) { const m = new THREE.Mesh(kinds[i % 3], small); group.add(m); bearers.push({ a: (i / K.bearers) * Math.PI * 2 + (i % 2) * 0.12, r: 0.5 + (i % 3) * 0.05, m, x: 0, z: 0, gone: false, flat: 0, grown: 1, phase: i * 1.7 }); }
    c.add(group);
    c.body({ get x() { return walker.x; }, get z() { return walker.z; }, r: K.r + 0.1 });
    // E treads on one of what carries it: one spot to use, kept under whichever a foot would come down on
    use = c.use({ x: walker.x, z: walker.z, r: K.tread, cone: -1, when: () => !over && under(c.me(), bearers) >= 0, use: () => { const i = under(c.me(), bearers); if (i < 0) return; const b = bearers[i]; b.gone = true; b.flat = 0.001; pending++; c.play('squish', b.x, b.z, 10); } });
    pose(0, false);
  }

  /** Stand it where it is: what carries it, and it on top of them. */
  function pose(dt, moving) {
    const floor = env.world.floorY(walker.x, walker.z), down = s.mode === 'down', sits = s.mode === 'sits';
    const left = bearers.filter((b) => !b.gone).length;
    // how high it rides: on their hands; lower, the fewer of them; on the floor without enough, or set down on somebody
    const want = down ? 0.5 : sits ? 0.56 : 0.98 - (K.bearers - left) * 0.035;
    high += (want - high) * Math.min(1, dt * (down || sits ? 7 : 2.5));
    shake = Math.max(0, shake - dt);
    tilt += ((down ? 0.22 : 0) - tilt) * Math.min(1, dt * 4);
    // it leans the way of whichever side has lost the most from under it
    let lx = 0, lz = 0; for (const b of bearers) if (b.gone) { lx += Math.cos(b.a); lz += Math.sin(b.a); }
    const wob = moving ? Math.sin(clock * 5.2) * 0.035 : Math.sin(clock * 1.4) * 0.012, jit = shake * 0.03;
    weight.position.set(walker.x + (Math.random() - 0.5) * jit, floor + high + Math.abs(wob) * 0.4, walker.z + (Math.random() - 0.5) * jit);
    weight.rotation.set(lz * 0.035 + wob + tilt * Math.sin(clock * 3) * 0.3, rot, -lx * 0.035 + Math.cos(clock * 4.7) * (moving ? 0.03 : 0.008) + tilt, 'YXZ');
    const breath = 1 + Math.sin(clock * (down ? 6 : 1.3)) * (down ? 0.03 : 0.018); weight.scale.set(breath, 1 / breath, breath);
    for (const arm of arms) {
      const px = Math.cos(rot) * arm.side, pz = -Math.sin(rot) * arm.side, flail = down ? Math.sin(clock * 11 + arm.side) * 0.9 : Math.sin(clock * 1.7 + arm.side) * 0.18;
      arm.m.position.set(walker.x + px * 0.68, floor + high + 0.2, walker.z + pz * 0.68);
      arm.m.rotation.set(-0.7 + flail * 0.5, rot, -arm.side * (2.75 + flail * 0.7), 'YXZ');          // (they hang; dropped, they beat at the air)
    }
    bearers.forEach((b, i) => {
      const a = b.a + rot; b.x = walker.x + Math.sin(a) * b.r; b.z = walker.z + Math.cos(a) * b.r;
      const fy = env.world.floorY(b.x, b.z);
      if (b.gone) {
        // trodden flat: it stays where it was put down, and is gone before another has grown
        b.flat += dt; b.m.scale.set(1.5, Math.max(0.06, 0.25 - b.flat * 0.5), 1.5); b.m.position.set(b.fx ?? b.x, fy + 0.01, b.fz ?? b.z); b.m.visible = b.flat < 5 && group.visible;
        if (b.fx === undefined) { b.fx = b.x; b.fz = b.z; }
        return;
      }
      b.grown = Math.min(1, b.grown + dt / 1.2); b.fx = undefined;
      const step = moving ? Math.abs(Math.sin(walked * 14 + b.phase)) * 0.04 : 0, squat = (down || sits ? 0.55 : 1 - (0.98 - high) * 0.5) * b.grown;
      b.m.visible = true; b.m.position.set(b.x, fy + step, b.z); b.m.rotation.set(0, a + Math.sin(clock * 3 + b.phase) * 0.2, Math.sin(clock * 6 + b.phase) * (down ? 0.2 : 0.05));
      b.m.scale.set(b.grown * (1 + (1 - squat) * 0.4), Math.max(0.05, squat), b.grown * (1 + (1 - squat) * 0.4));
    });
    // the one spot to use is under whichever of them a foot would find
    const m = c.me(), j = under(m, bearers);
    if (use && j >= 0) {
      use.wx = bearers[j].x; use.wz = bearers[j].z;
      const rt = env.world.roomAt(use.wx, use.wz);
      if (rt && rt !== use.room) { const at = use.room?.uses.indexOf(use) ?? -1; if (at >= 0) use.room.uses.splice(at, 1); rt.uses.push(use); use.room = rt; }
    }
  }

  function wander() {
    const here = level.rooms[c.room(walker.x, walker.z) ?? -1], ways = (here?.doors || []).map((d) => level.rooms[d.to]).filter((r) => r && !r.crawl && r.H >= 2.2 && r.kind !== 'start');
    const to = ways.length ? ways[Math.floor(Math.random() * ways.length)] : here;
    if (!to) return null;
    const sp = c.walk.spotIn(walker, to.id); return { x: sp.x, z: sp.z };
  }

  return {
    ready,
    update(dt) {
      if (!group || over) return;
      clock += dt;
      const m = c.me(), d = Math.hypot(m.x - walker.x, m.z - walker.z), sees = d < K.sees + 2 && c.los(walker.x, walker.z, m.x, m.z);
      const fire = c.fire(walker.x, walker.z), nearFire = !!fire && Math.hypot(fire.x - walker.x, fire.z - walker.z) < K.fire;
      if (!known && d < 11 && sees && !c.hidden(walker.x, walker.z, 0.8)) { known = true; c.met(); }
      s = carried(s, { dt, d, sees, trodden: pending, fire: nearFire }); pending = 0;
      if (s.grew) { const b = bearers.find((k) => k.gone); if (b) { b.gone = false; b.grown = 0.05; b.flat = 0; c.play('glug', b.x, b.z, 7); } }
      if (s.drops) {
        // on the floor: it wakes, and it howls, and the camcorder does not like the howl
        c.play('retch', walker.x, walker.z, 20); c.play('whistle', walker.x, walker.z, 20); c.play('thunk', walker.x, walker.z, 18);
        env.interfere?.(1); env.hud?.glitch?.(0.7); c.drain(K.howl); shake = 1.6;
      }
      if (s.rises) { c.play('creak', walker.x, walker.z, 14); }
      if (s.took) {
        const hit = c.hurt(K.hurts);
        if (hit.ended) { over = true; return; }
        if (hit.landed) { env.hud?.glitch?.(0.9); env.interfere?.(1); c.play('thunk', m.x, m.z, 16); c.play('squish', m.x, m.z, 12); c.survived(); }
        shake = 0.8;
      }
      const speed = s.mode === 'borne' ? pace(s.bearers) * (c.speedScale ?? 1) : 0;
      if (speed > 0) {
        if (nearFire) c.walk.go(walker, { x: walker.x * 2 - fire.x, z: walker.z * 2 - fire.z }, speed * dt);
        else if (s.comes) c.walk.go(walker, m, speed * Math.min(dt, 0.08), 0.3);
        else { goalT -= dt; if (!goal || goalT <= 0 || Math.hypot(goal.x - walker.x, goal.z - walker.z) < 0.9) { goal = wander(); goalT = 18 + Math.random() * 10; } if (goal) { const got = c.walk.go(walker, goal, speed * 0.6 * Math.min(dt, 0.08), 0.2); if (got && got.went < 1e-4) goalT = Math.min(goalT, 1.5); } }
      }
      const mx = walker.x - lastX, mz = walker.z - lastZ, moved = Math.hypot(mx, mz) > 1e-4; walked += Math.hypot(mx, mz);
      const face = sees ? Math.atan2(m.x - walker.x, m.z - walker.z) : moved ? Math.atan2(mx, mz) : rot;
      rot += Math.atan2(Math.sin(face - rot), Math.cos(face - rot)) * Math.min(1, dt * 1.2);
      lastX = walker.x; lastZ = walker.z;
      group.visible = c.drawn(walker);
      const L = c.light(walker.x, walker.z, 1.2); for (const mm of [mat, small]) mm.uniforms.uTint.value.set(L[0] * 1.5 + 0.05, L[1] * 1.5 + 0.05, L[2] * 1.5 + 0.05);
      pose(dt, moved);
    },
    /** The building's camera: it is carried the last of the way, over the visitor's character, and set down. */
    takes(shot) {
      over = true;
      const fig = shot.figure, from = { x: walker.x, z: walker.z };
      s = { ...s, mode: 'borne' };
      return (t, dt) => {
        clock += dt;
        const k = Math.min(1, t / 1.3), e = k * k * (3 - 2 * k);
        walker.x = from.x + (shot.x - from.x) * e; walker.z = from.z + (shot.z - from.z) * e; walked += 0.01;
        if (t > 1.5 && s.mode !== 'sits') { s = { ...s, mode: 'sits', t: 0 }; shake = 0.6; c.play('thunk', shot.x, shot.z, 18); c.play('squish', shot.x, shot.z, 14); }
        pose(dt, k < 1);
        if (fig) { const q = Math.max(0, Math.min(1, (t - 0.9) / 0.6)); fig.rotation.x = -1.5 * q; fig.position.y = shot.y - 0.05 * q; fig.rotation.z = t < 0.9 ? Math.sin(t * 20) * 0.05 : 0; if (t > 1.7) fig.scale.set(1.15, 0.5, 1.15); }
      };
    },
    films(shot) {
      const dx = walker.x - shot.x, dz = walker.z - shot.z, d = Math.hypot(dx, dz) || 1;
      for (const far of [4.4, 3.4, 2.6]) for (const side of [1, -1]) {
        const x = shot.x + (dz / d) * side * far, z = shot.z - (dx / d) * side * far;
        if (c.room(x, z) !== null && c.room(x, z) === c.room(shot.x, shot.z) && c.los(x, z, shot.x, shot.z)) return { x, y: shot.y + 1.4, z, at: { x: shot.x, y: shot.y + 0.6, z: shot.z } };
      }
      return null;
    },
    at: () => ({ x: walker.x, z: walker.z, mode: s.mode, bearers: s.bearers }),
    dispose() { group?.removeFromParent(); group = null; },
  };
}
