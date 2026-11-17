// The Backrooms — head count. Three of the staff joined at the hips, face down,
// walking on eight arms; where each neck ends there is a collar, a lanyard and
// a hole. It has no head to see or hear with, and does not know anybody is
// there (head-count.rule.js): it goes about the floor with no idea where it is
// going, and a hand comes down on whoever is in the way.
//
// Voxels (head-count.model.js), posed every frame: each arm is planted on the
// floor by its hand and worked out back to the shoulder, elbow up and out.
import * as THREE from 'three';
import { roomDistances } from '../gen.js';
import { Batch, lamp } from '../kit.js';
import { HEADS, counting, counts, pace, elbow, turned } from './head-count.rule.js';
import { slide } from '../shove.rule.js';
import { S, UPPER, FORE, knotVox, torsoVox, upperVox, foreVox, handVox, lanyardVox } from './head-count.model.js';

const UP = new THREE.Vector3(0, 1, 0), U = UPPER * S, F = FORE * S;
// the three of them round the knot (which way each lies, from the way it is going), and the arms: [who it belongs to (-1: the knot), which side]
const LIE = [0, 2.2, -2.2];
const ARMS = [[0, -1], [0, 1], [1, -1], [1, 1], [2, -1], [2, 1], [-1, -1], [-1, 1]];

export function create(c) {
  const env = c.env, level = c.level, H = HEADS;
  const walker = { x: 0, z: 0, r: H.r, tall: H.tall, opens: false };
  let s = counting(), group = null, mat = null, knot = null, torsos = [], arms = [], tags = [];
  let clock = 0, rot = 0, high = 0.6, goal = null, goalT = 0, known = false, over = false, lastX = 0, lastZ = 0, sweepA = 0, tapT = 0, shudder = 0, shovedFrom = null;
  const dir = new THREE.Vector3();

  const LIGHTS = [lamp(0.6, 3.2, 1.4, [1.1, 1.05, 1.0], { k: 9, wrap: 0.45, far: 40 })];
  const geo = (key, make) => { const b = new Batch(true); b.addVox(env.kit.model(key, make).solid, new THREE.Matrix4().makeScale(S, S, S)); return env.kit.geometry(b, LIGHTS, [0.4, 0.38, 0.38]); };
  const part = (g) => { const k = new THREE.Mesh(g, mat); group.add(k); return k; };

  function startRoom() {
    const dist = roomDistances(level, level.start.room), fits = (r) => !r.crawl && r.H >= 1.4 && r.kind !== 'start' && r.kind !== 'exit';
    const plain = level.rooms.filter((r) => fits(r) && r.kind === 'plain' && (dist.get(r.id) ?? 0) >= 3), far = level.rooms.filter((r) => fits(r) && (dist.get(r.id) ?? 0) >= 2);
    const pool = plain.length ? plain : far.length ? far : level.rooms.filter((r) => r.kind !== 'start');
    const pick = pool.length ? c.R.pick(pool) : level.rooms[0];
    if (c.haunt != null && level.rooms[c.haunt] && fits(level.rooms[c.haunt])) { const sp = c.walk.spotIn(walker, c.haunt); if (c.walk.stand(walker, sp.x, sp.z)) return c.haunt; }
    return pick.id;
  }

  function ready() {
    const spot = c.walk.spotIn(walker, startRoom());
    walker.x = lastX = spot.x; walker.z = lastZ = spot.z; rot = c.R.range(0, Math.PI * 2);
    mat = env.kit.surface({ vox: true, wet: 0.6 });
    group = new THREE.Group();
    knot = part(geo('heads:knot', knotVox));
    torsos = LIE.map((a, k) => ({ a, m: part(geo('heads:torso:' + k, () => torsoVox(k))), tilt: [0.62, 0.3, 0.78][k], roll: [0.12, -0.3, 0.22][k] }));   // (no two of them hold what they have not got the same way)
    tags = LIE.map((a, k) => ({ a, m: part(geo('heads:tag:' + k, () => lanyardVox(k))), swing: 0, v: 0 }));
    const hands = [0, 1].map((k) => geo('heads:hand:' + k, () => handVox(k)));
    arms = ARMS.map(([who, side], i) => ({
      who, side, upper: part(geo('heads:upper:' + (i % 3), () => upperVox(i % 3))), fore: part(geo('heads:fore:' + (i % 3), () => foreVox(i % 3))), hand: part(hands[i % 2]),
      x: walker.x, z: walker.z, fx: 0, fz: 0, tx: 0, tz: 0, k: 1, lift: 0, face: 0, placed: false,
    }));
    c.add(group);
    c.body({ get x() { return walker.x; }, get z() { return walker.z; }, r: H.r });
    pose(0, false);
  }

  /** Where an arm is joined on, in the world, this moment. */
  function shoulder(arm, floor) {
    if (arm.who < 0) { const a = rot + Math.PI + arm.side * 0.95; return { x: walker.x + Math.sin(a) * 0.4, y: floor + high - 0.04, z: walker.z + Math.cos(a) * 0.4, out: a }; }
    const t = torsos[arm.who], a = rot + t.a, px = Math.cos(a), pz = -Math.sin(a);
    return { x: walker.x + Math.sin(a) * 0.62 + px * arm.side * 0.33, y: floor + high + 0.14, z: walker.z + Math.cos(a) * 0.62 + pz * arm.side * 0.33, out: a + arm.side * 0.85 };
  }

  /** Stand it where it is: the knot, the three, and every arm from its hand back to its shoulder. */
  function pose(dt, moving) {
    const floor = env.world.floorY(walker.x, walker.z), coming = s.mode === 'comes', again = s.mode === 'recounts';
    // it carries itself low when it comes, and lower still over somebody it has
    const want = coming ? 0.5 : again ? 0.42 : 0.62 + Math.sin(clock * 1.3) * 0.03;
    high += (want - high) * Math.min(1, dt * 4);
    shudder = Math.max(0, shudder - dt);
    const jx = shudder ? (Math.random() - 0.5) * 0.02 : 0;
    knot.position.set(walker.x + jx, floor + high, walker.z); knot.rotation.set(Math.sin(clock * 1.7) * 0.05, rot, Math.sin(clock * 1.1) * 0.06);
    const breath = 1 + Math.sin(clock * 2.4) * 0.03; knot.scale.set(breath, 1 / breath, breath);
    torsos.forEach((t, k) => {
      const a = rot + t.a;
      t.m.position.set(walker.x + Math.sin(a) * 0.4, floor + high + 0.08, walker.z + Math.cos(a) * 0.4);
      // each of them still tries to lift what it has not got, and turns it, feeling
      t.m.rotation.set(0, a, 0); t.m.rotateX(-(t.tilt + Math.sin(clock * (0.9 + k * 0.23) + k * 2) * 0.12 + (coming ? 0.18 : 0))); t.m.rotateZ(t.roll + Math.sin(clock * (1.4 + k * 0.31) + k) * (again ? 0.3 : 0.16));
      const tag = tags[k], nx = walker.x + Math.sin(a) * 0.86, nz = walker.z + Math.cos(a) * 0.86;
      tag.v += (-tag.swing * 18 - tag.v * 2.2 + (moving ? Math.sin(clock * 9 + k) * 6 : Math.sin(clock * 1.9 + k) * 0.6)) * dt; tag.swing += tag.v * dt;
      tag.m.position.set(nx, floor + high + 0.3 + Math.sin(t.tilt) * 0.1, nz); tag.m.rotation.set(tag.swing * 0.5, a, tag.swing);
    });
    let stepping = arms.filter((l) => l.k < 1).length;
    const most = coming ? 4 : 3, stride = coming ? 0.42 : 0.3, quick = coming ? 0.09 : again ? 0.4 : 0.22;
    // whichever hands are furthest from where they should be are put down again first: none is left behind
    const due = arms.map((l, i) => { const sh = shoulder(l, floor), far = coming ? 0.78 : 0.86; return l.placed && l.k >= 1 ? Math.hypot(sh.x + Math.sin(sh.out) * far - l.x, sh.z + Math.cos(sh.out) * far - l.z) : 0; });
    const turn = new Set(due.map((d, i) => [d, i]).filter(([d]) => d > stride).sort((a, b) => b[0] - a[0]).slice(0, Math.max(0, most - stepping)).map(([, i]) => i));
    arms.forEach((l, i) => {
      const sh = shoulder(l, floor), far = coming ? 0.78 : 0.86, lead = moving ? (coming ? 0.45 : 0.2) : 0;
      const rx = sh.x + Math.sin(sh.out) * far + Math.sin(rot) * lead, rz = sh.z + Math.cos(sh.out) * far + Math.cos(rot) * lead;
      if (!l.placed) { l.x = rx; l.z = rz; l.placed = true; }
      const off = Math.hypot(rx - l.x, rz - l.z);
      if (off > 2.2) { l.x = rx; l.z = rz; l.k = 1; }                       // (it was somewhere else a moment ago: its hands are where it is)
      // a hand is put down again when it is left behind; and, counting, one is lifted now and then to pat for whatever may be there
      const pat = !moving && !coming && l.k >= 1 && stepping < 2 && tapT <= 0 && i === Math.floor(clock * 1.9) % arms.length;
      if (l.k >= 1 && (turn.has(i) || off > 1.1 || (pat && stepping < most))) {
        l.fx = l.x; l.fz = l.z; l.k = 0; stepping++;
        const a = sh.out + (pat ? (Math.random() - 0.5) * 1.2 : 0), r = pat ? far + 0.25 : 0;
        l.tx = pat ? sh.x + Math.sin(a) * r : rx; l.tz = pat ? sh.z + Math.cos(a) * r : rz; l.pat = pat;
        if (pat) tapT = again ? 0.2 : 0.3 + Math.random() * 0.5;
      }
      if (l.k < 1) {
        l.k = Math.min(1, l.k + dt / (l.pat ? 0.34 : quick)); l.x = l.fx + (l.tx - l.fx) * l.k; l.z = l.fz + (l.tz - l.fz) * l.k; l.lift = Math.sin(l.k * Math.PI) * (l.pat ? 0.34 : coming ? 0.16 : 0.22);
        if (l.k >= 1) { l.lift = 0; c.play(l.pat ? 'knock' : coming ? 'thunk' : 'step', l.x, l.z, coming ? 16 : 9); }
      }
      const hy = env.world.floorY(l.x, l.z) + l.lift, hand = { x: l.x, y: hy + 0.05, z: l.z };
      const e = elbow(sh, hand, U, F, { x: Math.sin(sh.out), z: Math.cos(sh.out) });
      dir.set(e.x - sh.x, e.y - sh.y, e.z - sh.z); const ul = dir.length();
      l.upper.position.set(sh.x, sh.y, sh.z); l.upper.quaternion.setFromUnitVectors(UP, dir.normalize()); l.upper.scale.set(1, ul / U, 1);
      dir.set(hand.x - e.x, hand.y - e.y, hand.z - e.z); const fl = dir.length();
      l.fore.position.set(e.x, e.y, e.z); l.fore.quaternion.setFromUnitVectors(UP, dir.normalize()); l.fore.scale.set(1, fl / F, 1);
      l.face = Math.atan2(l.x - sh.x, l.z - sh.z);
      l.hand.position.set(l.x, hy, l.z); l.hand.rotation.set(l.lift * -1.6, l.face, 0);
    });
    tapT -= dt;
  }

  /** Somewhere to go on with its count: the middle of a room next to the one it is in. */
  function wander() {
    const here = level.rooms[c.room(walker.x, walker.z) ?? -1], ways = (here?.doors || []).map((d) => level.rooms[d.to]).filter((r) => r && !r.crawl && r.H >= 1.4 && r.kind !== 'start');
    let to = ways.length ? ways[Math.floor(Math.random() * ways.length)] : here;
    if (!to) return null;
    // shoved, it goes on whichever way is furthest from where the shove came from; and then it has forgotten
    if (shovedFrom && ways.length) { const far = (r) => Math.hypot(r.x + (r.w ?? r.W ?? 0) / 2 - shovedFrom.x, r.z + (r.d ?? r.D ?? 0) / 2 - shovedFrom.z); to = ways.slice().sort((a, b) => far(b) - far(a))[0]; }
    shovedFrom = null;
    const sp = c.walk.spotIn(walker, to.id); return { x: sp.x + (Math.random() - 0.5) * 1.5, z: sp.z + (Math.random() - 0.5) * 1.5 };
  }

  return {
    ready,
    update(dt) {
      if (!group || over) return;
      clock += dt;
      const m = c.me(), d = Math.hypot(m.x - walker.x, m.z - walker.z), line = d < 20 && c.los(walker.x, walker.z, m.x, m.z);
      const fire = c.fire(walker.x, walker.z), nearFire = !!fire && Math.hypot(fire.x - walker.x, fire.z - walker.z) < H.fire;
      if (!known && d < 10 && line && !c.hidden(walker.x, walker.z, 0.6)) { known = true; c.met(); }
      const was = s.mode;
      s = counts(s, { dt, d, line, fire: nearFire });
      if (s.took) {
        const hit = c.hurt(H.hurts);
        if (hit.ended) { over = true; return; }
        if (hit.landed) { env.hud?.glitch?.(0.8); env.interfere?.(0.9); c.play('thunk', m.x, m.z, 14); c.play('crack', m.x, m.z, 10); c.survived(); }
        shudder = 1.2;
      }
      if (was === 'recounts' && s.mode === 'counts') goal = null;
      // where it is going: on with its count, into whichever room is next. It is not going anywhere for anybody
      let to = null;
      if (nearFire) to = { x: walker.x * 2 - fire.x, z: walker.z * 2 - fire.z };
      else if (s.mode === 'counts') {
        goalT -= dt;
        if (!goal || goalT <= 0 || Math.hypot(goal.x - walker.x, goal.z - walker.z) < 0.8) { goal = wander(); goalT = 14 + Math.random() * 10; }
        to = goal;
      }
      // counting, it stops every so often where it is and only its hands go on, feeling about for whatever may be there
      const listens = s.mode === 'counts' && (clock % 9) < 2.6;
      const speed = listens ? 0 : pace(s.mode) * (c.speedScale ?? 1);
      if (to && speed > 0) { const got = c.walk.go(walker, to, speed * Math.min(dt, 0.08), 0.2); if (s.mode === 'counts' && got && got.went < 1e-4) goalT = Math.min(goalT, 1.5); }
      const mx = walker.x - lastX, mz = walker.z - lastZ, moved = Math.hypot(mx, mz) > 1e-4;
      if (moved) { let da = Math.atan2(mx, mz) - rot; da = Math.atan2(Math.sin(da), Math.cos(da)); rot += da * Math.min(1, dt * 2.5); }
      else if (s.mode === 'recounts') rot += dt * 0.5;
      lastX = walker.x; lastZ = walker.z;
      group.visible = c.drawn(walker);
      const L = c.light(walker.x, walker.z, 1.2); mat.uniforms.uTint.value.set(L[0] * 1.5 + 0.05, L[1] * 1.5 + 0.05, L[2] * 1.5 + 0.05);
      pose(dt, moved);
    },
    /** The building's camera: it goes over the visitor's character, which goes down under it, and it settles there to count. */
    takes(shot) {
      over = true;
      const fig = shot.figure, from = { x: walker.x, z: walker.z };
      return (t, dt) => {
        clock += dt;
        const k = Math.min(1, t / 1.1), e = k * k * (3 - 2 * k), down = Math.max(0, Math.min(1, (t - 0.5) / 0.7));
        walker.x = from.x + (shot.x - from.x) * e; walker.z = from.z + (shot.z - from.z) * e;
        if (k >= 1 && s.mode !== 'recounts') s = { ...s, mode: 'recounts', t: 0 };
        if (fig) { fig.rotation.x = -1.5 * down; fig.position.y = shot.y - 0.1 * down; fig.rotation.z = Math.sin(t * 23) * 0.06 * (1 - down); }
        pose(dt, k < 1);
      };
    },
    /** …filmed from the side, low, so that what it does is not hidden by its own back. */
    films(shot) {
      const dx = walker.x - shot.x, dz = walker.z - shot.z, d = Math.hypot(dx, dz) || 1;
      for (const far of [3.8, 2.8, 2]) for (const side of [1, -1]) {
        const x = shot.x + (dz / d) * side * far, z = shot.z - (dx / d) * side * far;
        if (c.room(x, z) !== null && c.room(x, z) === c.room(shot.x, shot.z) && c.los(x, z, shot.x, shot.z)) return { x, y: shot.y + 1.25, z, at: { x: shot.x, y: shot.y + 0.45, z: shot.z } };
      }
      return null;
    },
    /** A shove (shove.rule.js): it is pushed back a step and turned aside, and when it has found its hands it goes some other way. */
    shoveTargets() {
      if (!group || over || s.mode === 'recounts') return [];
      return [{ id: 'head-count', x: walker.x, z: walker.z, y: env.world.floorY(walker.x, walker.z) + 0.6, r: H.r, shove: (dir) => {
        const to = slide(walker, dir, (x0, z0, x1, z1) => c.walk.clear(walker, x0, z0, x1, z1));
        if (to) { walker.x = to.x; walker.z = to.z; }
        const m = c.me(); shovedFrom = { x: m.x, z: m.z }; s = turned(); goal = null; shudder = 0.8;
        c.play('creak', walker.x, walker.z, 10);
        return true;
      } }];
    },
    at: () => ({ x: walker.x, z: walker.z, mode: s.mode }),
    dispose() { group?.removeFromParent(); group = null; },
  };
}
