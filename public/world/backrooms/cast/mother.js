// The Backrooms — Mother. A tall tube of flesh on stubby feet that sways
// and waves, the way the thing outside a grand opening does, and comes over
// very slowly. It does no harm. What it brings up does (mother.rule.js): four
// or five small pink ones, fast and blind, that jump for the face. E treads on
// one. Afterwards it is content, and only sways.
//
// Nothing of it is baked: it is a stack of boxes that are leaned afresh every
// frame, tinted by the light where it stands.
import * as THREE from 'three';
import { roomDistances } from '../gen.js';
import { Batch, lamp } from '../kit.js';
import { S, SW, RING, LIMB, ringVox, mouthVox, limbVox, endVox, footVox, wormVox } from './mother.model.js';
import { MOTHER, WORM, swaying, sways, finds, trodden } from './mother.rule.js';
import { slide } from '../shove.rule.js';

const SEGS = 14, SEG_H = MOTHER.height / SEGS, RING_H = RING * S, LIMB_H = LIMB * S;

export function create(c) {
  const env = c.env, level = c.level, G = MOTHER;
  const walker = { x: 0, z: 0, r: G.r, tall: G.tall, opens: false };
  /** Can it get through this doorway of room r at all? (A room whose every doorway is a crawl hole to it is no room to start in, nor to set off for.) */
  const way = (d, r) => { const cost = c.walk.cost?.(walker); return !cost || cost(d, r.id, d.to) < Infinity; };
  const worms = [];
  let s = swaying(), group = null, segs = [], arms = [], feet = [], lips = [], mat = null, wormMat = null, wormGeo = [], peeping = [];
  let clock = 0, yaw = 0, lean = 0, walked = 0, known = false, over = false, tookOne = false, hadBrood = false;

  // (voxels, lit once from above and in front as the lines are, and tinted every frame by the light where it stands)
  const LIGHTS = [lamp(0.6, 3.2, 1.4, [1.1, 1.05, 1.0], { k: 9, wrap: 0.45, far: 40 })];
  const geo = (key, make, scale = S) => { const b = new Batch(true); b.addVox(env.kit.model(key, make).solid, new THREE.Matrix4().makeScale(scale, scale, scale)); return env.kit.geometry(b, LIGHTS, [0.42, 0.4, 0.4]); };
  const part = (parent, g, m = mat) => { const k = new THREE.Mesh(g, m); parent.add(k); return k; };
  /** One of the small ones, as a thing to look at: four lengths of it, its head first. */
  const smallOne = (parent) => { const g = new THREE.Group(), parts = wormGeo.map((w, k) => { const p = part(g, w, wormMat); p.scale.setScalar(1 - k * 0.1); return p; }); parent.add(g); return { g, parts }; };

  function startRoom() {
    const dist = roomDistances(level, level.start.room), fits = (r) => !r.crawl && r.H >= 2.5 && r.kind !== 'start' && r.kind !== 'exit' && r.doors.some((d) => way(d, r));
    const plain = level.rooms.filter((r) => fits(r) && r.kind === 'plain' && (dist.get(r.id) ?? 0) >= 2), far = level.rooms.filter((r) => fits(r) && (dist.get(r.id) ?? 0) >= 2);
    const pool = plain.length ? plain : far;
    const pick = pool.length ? c.R.pick(pool) : null;
    // (a room that asked for company has it standing there, if it will fit)
    if (c.haunt != null && level.rooms[c.haunt] && fits(level.rooms[c.haunt]) && (dist.get(c.haunt) ?? 0) >= 2) { const sp = c.walk.spotIn(walker, c.haunt); if (c.walk.stand(walker, sp.x, sp.z)) return c.haunt; }
    return pick?.id ?? null;
  }

  function ready() {
    const id = startRoom(); if (id === null) return;
    const spot = c.walk.spotIn(walker, id);
    walker.x = spot.x; walker.z = spot.z; yaw = c.R.range(0, Math.PI * 2);
    group = new THREE.Group();
    mat = env.kit.surface({ vox: true, wet: 0.55 }); wormMat = env.kit.surface({ vox: true, wet: 1 });   // (she is damp; what she brings up is wet)
    wormGeo = [0, 1, 2, 3].map((k) => geo('mother:small:' + k, () => wormVox(k), SW));
    // the trunk: rings of it, no two alike, narrower toward the top and never quite round
    const rings = [0, 1, 2, 3].map((k) => geo('mother:ring:' + k, () => ringVox(k)));
    for (let i = 0; i < SEGS; i++) {
      const w = 1.02 - 0.36 * (i / (SEGS - 1)) + Math.sin(i * 2.3) * 0.05;
      segs.push({ m: part(group, rings[(i * 3 + (i >> 2)) % 4]), w, wx: 1 + Math.sin(i * 1.7) * 0.07, wz: 1 + Math.cos(i * 2.9) * 0.07, turn: i * 1.1 });
    }
    // the mouth on top of it: a pit of spines, with some of what is in it looking out, and what grows round the lip of it
    const top = new THREE.Group(); group.add(top); lips.push(top);
    part(top, geo('mother:mouth', mouthVox)).scale.setScalar(0.74);
    for (let k = 0; k < 3; k++) { const w = smallOne(top); w.a = k * 2.2 + 0.4; w.g.scale.setScalar(0.85); peeping.push(w); }
    const limb = geo('mother:limb', limbVox), end = geo('mother:end', endVox);
    const feelers = []; for (let k = 0; k < 5; k++) { const joints = [0, 1, 2].map((n) => { const j = part(top, n === 2 ? end : limb); j.scale.set(0.55, 0.7, 0.55); return j; }); feelers.push({ a: k * 1.26 + 0.3, joints }); }
    lips.push(feelers);
    // what it waves: two long, two short, joined on wherever
    for (const [side, at, n, thick] of [[-1, 0.66, 5, 1], [1, 0.6, 5, 1], [-1, 0.42, 3, 0.75], [1, 0.8, 3, 0.7]]) {
      const joints = []; for (let j = 0; j < n; j++) { const m = part(group, j === n - 1 ? end : limb); m.scale.set(thick * (1 - j * 0.1), 1, thick * (1 - j * 0.1)); joints.push(m); }
      arms.push({ side, at, joints });
    }
    // and the feet: short, thick, and more of them than it needs
    const foot = geo('mother:foot', footVox);
    for (let k = 0; k < 7; k++) { const m = part(group, foot); m.scale.setScalar(0.95 + (k % 3) * 0.12); feet.push({ a: (k / 7) * Math.PI * 2 + (k % 2) * 0.2, m }); }
    c.add(group);
    c.body({ get x() { return walker.x; }, get z() { return walker.z; }, r: G.r });
    pose(0);
  }

  function tint(m, x, z, lift = 0.06) {
    const L = c.light(x, z, 1.4);
    m.uniforms.uTint.value.set(L[0] * 1.5 + lift, L[1] * 1.5 + lift, L[2] * 1.5 + lift);
  }

  /** Lean every ring of it where the sway has it this moment. */
  function pose(dt) {
    const floor = env.world.floorY(walker.x, walker.z), heave = s.mode === 'heave' ? Math.min(1, s.t / G.heave) : 0, glad = s.mode === 'content' ? 1 : 0;
    // how far it swings, and how fast: wider and easier when it is pleased with itself; drawn back and shaking as it heaves
    const amp = 0.5 + 0.35 * glad - 0.25 * heave, rate = 1.5 + 0.5 * glad;
    lean += ((heave ? -0.75 * heave : 0) - lean) * Math.min(1, dt * 5);
    const fx = Math.sin(yaw), fz = Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    let px = 0, pz = 0, py = 0.1, bend = 0, pitch = 0;
    for (let i = 0; i < SEGS; i++) {
      const k = i / (SEGS - 1), sway = Math.sin(clock * rate - i * 0.42) * amp * k * 0.34 + (heave ? (Math.random() - 0.5) * 0.05 * heave : 0);
      const nod = Math.sin(clock * rate * 0.5 - i * 0.3) * 0.12 * k * (1 + glad) + lean * k * 0.5;   // (the top of it curls over, to look at you with what it has)
      bend += sway * 0.23; pitch += nod * 0.22 + (k > 0.55 ? 0.21 * (1 - heave) : 0);
      const seg = segs[i].m, h = SEG_H * (1 + (heave ? Math.sin(clock * 22 + i) * 0.05 * heave : 0));
      seg.position.set(walker.x + sx * px + fx * pz, floor + py, walker.z + sz * px + fz * pz);
      seg.rotation.set(0, yaw, 0); seg.rotateZ(-bend); seg.rotateX(pitch); seg.rotateY(segs[i].turn);
      px += Math.sin(bend) * h; pz += Math.sin(pitch) * h; py += Math.cos(bend) * Math.cos(pitch) * h;
      // a swallow goes up it while it heaves
      const gulp = heave ? Math.max(0, 1 - Math.abs(k - heave) * 5) * 0.35 : 0;
      const breath = 1 + Math.sin(clock * 1.1 - i * 0.5) * 0.025;
      seg.scale.set(segs[i].w * segs[i].wx * (1 + gulp) * breath, (h / RING_H) * 1.25, segs[i].w * segs[i].wz * (1 + gulp) * breath);
    }
    const head = segs[SEGS - 1].m;
    lips[0].position.set(walker.x + sx * px + fx * pz, floor + py, walker.z + sz * px + fz * pz); lips[0].rotation.set(0, yaw, 0); lips[0].rotateZ(-bend); lips[0].rotateX(pitch);
    lips[0].scale.setScalar(1 + 0.45 * heave);
    // what is in it looks out, and goes back in; more of them, further, as it heaves
    peeping.forEach((w, n) => {
      const out = Math.max(0, Math.sin(clock * (0.9 + n * 0.23) + n * 2.1)) * (0.5 + 0.5 * heave) + heave * 0.4, r = 0.07 + 0.03 * n;
      w.g.position.set(Math.cos(w.a + clock * 0.2) * r, 0.02 + out * 0.2, Math.sin(w.a + clock * 0.2) * r);
      w.g.rotation.set(-Math.PI / 2 + Math.sin(clock * 3 + n) * 0.5, w.a, 0);
      w.parts.forEach((p, q) => p.position.set(Math.sin(clock * 9 + n * 2 - q * 1.4) * 0.012, 0, -q * 0.05));
    });
    // and what grows round the lip of it feels about
    for (const f of lips[1]) {
      let x = Math.cos(f.a) * 0.2, y = 0.2, z = Math.sin(f.a) * 0.2, tilt = 0.5 + Math.sin(clock * 1.7 + f.a * 3) * 0.5 - heave * 0.6;
      f.joints.forEach((jt, n) => {
        tilt += Math.sin(clock * (2.4 + n * 0.6) + f.a * 5 + n) * 0.45;
        jt.position.set(x, y, z); jt.rotation.set(0, -f.a, 0); jt.rotateZ(-tilt);
        const len = LIMB_H * 0.7; x += Math.cos(f.a) * Math.sin(tilt) * len; z += Math.sin(f.a) * Math.sin(tilt) * len; y += Math.cos(tilt) * len;
      });
    }
    // what it waves, joined on to the trunk
    for (const arm of arms) {
      const sh = segs[Math.floor((SEGS - 1) * arm.at)].m, out = 0.24 * segs[Math.floor((SEGS - 1) * arm.at)].w;
      let ax = sh.position.x + sx * arm.side * out, ay = sh.position.y + 0.06, az = sh.position.z + sz * arm.side * out, ang = arm.side * (1.25 + 0.4 * glad);
      arm.joints.forEach((jt, n) => {
        ang += Math.sin(clock * (3.6 + glad * 2) + n * 0.9 + arm.side + arm.at * 7) * (0.5 + 0.25 * glad) - arm.side * heave * 0.3;
        jt.position.set(ax, ay, az); jt.rotation.set(0, yaw, 0); jt.rotateZ(-ang);
        const dx = Math.sin(ang) * LIMB_H * 0.94, dy = Math.cos(ang) * LIMB_H * 0.94;
        ax += sx * dx; ay += dy; az += sz * dx;
      });
    }
    // the feet shuffle when it goes anywhere, and tread on the spot when it does not
    for (const f of feet) {
      const step = Math.max(0, Math.sin(walked * 9 + f.a * 2 + clock * (glad ? 3 : 0.8))) * (0.05 + 0.04 * glad);
      f.m.position.set(walker.x + Math.cos(f.a + yaw) * 0.3, floor + step, walker.z + Math.sin(f.a + yaw) * 0.3); f.m.rotation.y = -f.a - yaw + Math.PI / 2;
    }
    return { x: lips[0].position.x, y: lips[0].position.y + 0.2, z: lips[0].position.z };
  }

  /** One of the small ones, out of its mouth: thrown up and over toward the visitor, and off it goes. */
  function bring(from, n, i) {
    const { g, parts } = smallOne(group); group.remove(g); c.add(g);
    const m = c.me(), a = Math.atan2(m.x - walker.x, m.z - walker.z) + (i - (n - 1) / 2) * 0.5 + (Math.random() - 0.5) * 0.3, far = 0.9 + Math.random() * 0.8;
    let tx = walker.x + Math.sin(a) * far, tz = walker.z + Math.cos(a) * far;
    const probe = { x: tx, z: tz, r: WORM.r, tall: WORM.tall, opens: false, crawls: true };
    if (!c.walk.stand(probe, tx, tz) || !env.world.passable(walker.x, walker.z, tx, tz)) { tx = walker.x + Math.sin(a) * 0.45; tz = walker.z + Math.cos(a) * 0.45; }
    const w = { g, parts, x: from.x, z: from.z, y: from.y, r: WORM.r, tall: WORM.tall, opens: false, crawls: true, air: { t: 0, dur: 0.6 + Math.random() * 0.25, fx: from.x, fz: from.z, fy: from.y, tx, tz, high: 0.5, born: true },
      jumps: WORM.jumps, life: WORM.life * (0.85 + Math.random() * 0.3), dazed: 0.25 + Math.random() * 0.4, wait: 0, heading: a, phase: Math.random() * 6, dead: false, flat: 0 };
    worms.push(w);
    // One interaction per small one: either visitor may tread on their nearest.
    w.use = c.use({x:w.x,z:w.z,r:WORM.tread,cone:-1,when:()=>!over && trodden(c.me(), [w])===0,use:()=>tread(w)});
  }

  /** E: a foot comes down on the nearest of them. */
  function tread(w) {
    if (trodden(c.me(), [w]) < 0) return;
    w.dead = true; w.flat = 0.001;
    c.play('squish', w.x, w.z, 9);
  }

  function tickSmall(w, dt) {
    const m = c.me(), floorAt = (x, z) => env.world.floorY(x, z);
    w.phase += dt * 16;
    if (w.dead) {
      // trodden flat, or dried up: it stays a moment and is gone
      w.flat += dt; w.g.position.set(w.x, floorAt(w.x, w.z) + 0.012, w.z); w.g.scale.set(1.5, Math.max(0.08, 0.3 - w.flat), 1.5);
      if (w.flat > 6) { w.g.removeFromParent(); w.remove = true; }
      return;
    }
    const fire = c.fire(w.x, w.z);
    if (fire && Math.hypot(fire.x - w.x, fire.z - w.z) < 1.2) { w.dead = true; w.flat = 0.001; c.play('dissolve', w.x, w.z, 6); return; }
    if (w.air) {
      const a = w.air; a.t += dt; const k = Math.min(1, a.t / a.dur);
      w.x = a.fx + (a.tx - a.fx) * k; w.z = a.fz + (a.tz - a.fz) * k;
      const ground = floorAt(w.x, w.z) + 0.04, to = a.born ? ground : a.ty;
      w.y = a.fy + (to - a.fy) * k + Math.sin(k * Math.PI) * a.high;
      if (k >= 1) {
        w.air = null;
        if (a.born) { c.play('glug', w.x, w.z, 7); }
        else {
          // it has come down where a face was when it jumped: is the face still there, and did it find it?
          const d = Math.hypot(m.x - w.x, m.z - w.z);
          if (c.los(a.fx, a.fz, m.x, m.z) && finds(d)) {
            const hit = c.hurt(WORM.hurts, { x: a.fx, z: a.fz });   // (from where it jumped: the way they are thrown, and the side a shove has to be facing)
            w.dead = true; w.flat = 0.001; w.x = m.x; w.z = m.z;                  // it is spent either way
            if (hit.ended) { over = true; return; }
            if (hit.landed) { tookOne = true; env.hud?.glitch?.(0.7); env.interfere?.(0.8); c.play('squeak', m.x, m.z, 6); }
            return;
          }
          w.jumps--; w.dazed = WORM.dazed; c.play('tick', w.x, w.z, 6);
          if (w.jumps <= 0) w.life = Math.min(w.life, 3);
        }
      }
    } else {
      w.life -= dt; w.y = floorAt(w.x, w.z) + 0.04;
      if (w.life <= 0) { w.dead = true; w.flat = 0.001; return; }
      if (w.dazed > 0) w.dazed -= dt;
      else {
        const d = Math.hypot(m.x - w.x, m.z - w.z);
        if (d < WORM.spring && w.jumps > 0 && c.los(w.x, w.z, m.x, m.z)) {
          // at the face: at where it is now, for they cannot see it move
          w.air = { t: 0, dur: WORM.jump, fx: w.x, fz: w.z, fy: w.y, tx: m.x, tz: m.z, ty: floorAt(m.x, m.z) + 1.0, high: 0.35 };
          c.play('squeak', w.x, w.z, 7);
        } else {
          // blind: it goes roughly where the footsteps are, and not straight
          w.wait -= dt;
          if (w.wait <= 0) { w.wait = 0.25 + Math.random() * 0.3; w.heading = Math.atan2(m.x - w.x, m.z - w.z) + (Math.random() - 0.5) * 1.3; }
          const aim = d < 2.2 ? m : { x: w.x + Math.sin(w.heading) * 2, z: w.z + Math.cos(w.heading) * 2 };
          const got = c.walk.go(w, aim, WORM.speed * (c.speedScale ?? 1) * dt, 0.3);
          if (got.went < 1e-4) w.wait = 0;
          w.heading = Math.atan2(aim.x - w.x, aim.z - w.z);
        }
      }
    }
    // a writhing line of four
    const lying = w.dazed > 0 && !w.air;
    w.g.position.set(w.x, w.y, w.z); w.g.rotation.set(lying ? Math.PI : 0, w.air ? Math.atan2(w.air.tx - w.air.fx, w.air.tz - w.air.fz) : w.heading, 0); w.g.scale.set(1, 1, 1);
    w.parts.forEach((p, k) => p.position.set(Math.sin(w.phase - k * 1.4) * (lying ? 0.05 : 0.028), w.air ? Math.sin(w.phase * 0.6 + k) * 0.03 : 0, -k * 0.07));
    w.g.visible = c.drawn(w);
  }
  function small(dt) {
    for (let i = worms.length - 1; i >= 0; i--) {
      const w = worms[i];
      // Each small one chooses its own visitor; Mother may be in another room.
      if (env.withVisitor) env.withVisitor('mother-brood', w, () => tickSmall(w, dt));
      else tickSmall(w, dt);
      const u = w.use, rt = w.remove ? null : env.world.roomAt(w.x, w.z);
      u.wx = w.x; u.wz = w.z;
      if (rt !== u.room) {
        const at = u.room?.uses.indexOf(u) ?? -1;
        if (at >= 0) u.room.uses.splice(at, 1);
        rt?.uses.push(u); u.room = rt || null;
      }
      if (w.remove) worms.splice(i, 1);
    }
  }

  return {
    ready,
    update(dt) {
      if (!group || over) return;
      clock += dt;
      const m = c.me(), d = Math.hypot(m.x - walker.x, m.z - walker.z), sees = d < 16 && c.los(walker.x, walker.z, m.x, m.z);
      const fire = c.fire(walker.x, walker.z), nearFire = !!fire && Math.hypot(fire.x - walker.x, fire.z - walker.z) < G.fire;
      if (!known && d < 9 && sees && !c.hidden(walker.x, walker.z, 0.5)) { known = true; c.met(); }
      const alive = worms.filter((w) => !w.dead).length;
      const was = s.mode;
      s = sways(s, { dt, d, sees, fire: nearFire, brood: alive });
      if (s.mode === 'heave' && was !== 'heave') c.play('retch', walker.x, walker.z, 14);          // (as long as the heave is: they come up on the last of it)
      // it turns to whoever it is greeting, slowly; and goes over to them, more slowly
      const want = sees ? Math.atan2(m.x - walker.x, m.z - walker.z) : yaw, turn = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
      yaw += Math.max(-dt * 1.2, Math.min(dt * 1.2, turn));
      if (s.comes && d > G.near * 0.8) {
        if (nearFire) c.walk.go(walker, { x: walker.x * 2 - fire.x, z: walker.z * 2 - fire.z }, G.speed * dt);
        else walked += c.walk.go(walker, m, G.speed * (c.speedScale ?? 1) * dt, G.near * 0.8).went;
      }
      group.visible = c.drawn(walker);
      const mouth = pose(dt);
      tint(mat, walker.x, walker.z);
      if (s.up) { hadBrood = true; tookOne = false; for (let i = 0; i < s.up; i++) bring(mouth, s.up, i); env.interfere?.(0.35); }
      if (worms.length) small(dt);
      tint(wormMat, worms[0] ? worms[0].x : walker.x, worms[0] ? worms[0].z : walker.z, 0.14);
      if (hadBrood && !over && !worms.some((w) => !w.dead)) { hadBrood = false; if (!tookOne) c.survived(); }
    },
    /** The building's camera: every one of them that is left goes for the visitor's character, which goes down under them. */
    takes(shot) {
      over = true;
      const fig = shot.figure, left = worms.filter((w) => !w.dead || w.flat < 0.5);
      for (const w of left) { w.dead = false; w.from = { x: w.x, y: w.g.position.y, z: w.z }; w.on = { a: Math.random() * 6.28, h: 0.75 + Math.random() * 0.6 }; }
      return (t, dt) => {
        clock += dt; pose(dt);
        const k = Math.min(1, t / 0.7), down = Math.max(0, Math.min(1, (t - 1.0) / 0.9)), e = down * down * (3 - 2 * down);
        if (fig) { fig.rotation.x = -1.4 * e; fig.rotation.z = Math.sin(t * 19) * 0.07 * (1 - e); }
        for (const w of left) {
          const rad = 0.2, hx = shot.x + Math.sin(w.on.a + t * 2) * rad, hz = shot.z + Math.cos(w.on.a + t * 2) * rad - Math.cos(shot.yaw ?? 0) * 0, hy = shot.y + w.on.h * (1 - e) + 0.12;
          w.phase += dt * 22;
          w.g.visible = true; w.g.scale.set(1, 1, 1);
          w.g.position.set(w.from.x + (hx - w.from.x) * k, w.from.y + (hy - w.from.y) * k + Math.sin(k * Math.PI) * 0.4, w.from.z + (hz - w.from.z) * k);
          w.g.rotation.set(Math.sin(w.phase * 0.3), w.on.a + t * 2, 0);
          w.parts.forEach((p, n) => p.position.set(Math.sin(w.phase - n * 1.4) * 0.04, 0, -n * 0.07));
        }
      };
    },
    /** …filmed from the side: the visitor's character and the thing still waving at it, both in the picture. */
    films(shot) {
      const dx = walker.x - shot.x, dz = walker.z - shot.z, d = Math.hypot(dx, dz) || 1, mx = shot.x + dx * 0.35, mz = shot.z + dz * 0.35;
      for (const far of [4.4, 3.4, 2.4]) for (const side of [1, -1]) {
        const x = mx + (dz / d) * side * far, z = mz - (dx / d) * side * far;
        if (c.room(x, z) !== null && c.room(x, z) === c.room(shot.x, shot.z) && c.los(x, z, shot.x, shot.z)) return { x, y: shot.y + 1.9, z, at: { x: mx, y: shot.y + 1.0, z: mz } };
      }
      return null;
    },
    /** A shove (shove.rule.js): the small ones are batted away, out of the air or off the floor, and lie on their backs. Mother is not moved. */
    shoveTargets() {
      if (!group || over) return [];
      return worms.filter((w) => !w.dead && !w.remove && !w.air?.born).map((w) => ({ id: 'mother-brood', x: w.x, z: w.z, y: w.y ?? env.world.floorY(w.x, w.z), r: 0.2, shove: (dir) => {
        if (w.dead) return false;
        if (w.air) { w.air = null; w.jumps = Math.max(0, (w.jumps ?? 1) - 1); if (w.jumps <= 0) w.life = Math.min(w.life, 3); }
        const to = slide(w, dir, (x0, z0, x1, z1) => c.walk.clear(w, x0, z0, x1, z1), 1.4);
        if (to) { w.x = to.x; w.z = to.z; }
        w.y = env.world.floorY(w.x, w.z) + 0.04; w.dazed = WORM.dazed * 1.6; c.play('squeak', w.x, w.z, 6);
        return true;
      } }));
    },
    at: () => group ? ({ x: walker.x, z: walker.z, mode: s.mode, brood: worms.filter((w) => !w.dead).length }) : null,
    dispose() { for (const w of worms) w.g.removeFromParent(); worms.length = 0; group?.removeFromParent(); group = null; },
  };
}
