// The Backrooms — the greeter. A tall tube of flesh on stubby feet that sways
// and waves, the way the thing outside a grand opening does, and comes over
// very slowly. It does no harm. What it brings up does (greeter.rule.js): four
// or five small pink ones, fast and blind, that jump for the face. E treads on
// one. Afterwards it is content, and only sways.
//
// Nothing of it is baked: it is a stack of boxes that are leaned afresh every
// frame, tinted by the light where it stands.
import * as THREE from 'three';
import { roomDistances } from '../gen.js';
import { GREETER, WORM, swaying, sways, finds, trodden } from './greeter.rule.js';

const SEGS = 10, SEG_H = GREETER.height / SEGS;
const FLESH = [[0.8, 0.42, 0.4], [0.62, 0.27, 0.3], [0.86, 0.5, 0.45]], GUM = [0.4, 0.08, 0.12], THROAT = [0.07, 0.01, 0.02], TOOTH = [0.95, 0.9, 0.78], PINK = [[1, 0.36, 0.56], [0.84, 0.2, 0.44]];

export function create(c) {
  const env = c.env, level = c.level, G = GREETER;
  const own = (x) => (env.kit.own ? env.kit.own(x) : x);
  const walker = { x: 0, z: 0, r: G.r, tall: G.tall, opens: false };
  const worms = [];
  let s = swaying(), group = null, segs = [], arms = [], feet = [], lips = [], mats = [], wormMats = [], cube = null;
  let clock = 0, yaw = 0, lean = 0, walked = 0, known = false, over = false, use = null, tookOne = false, hadBrood = false;

  const mat = (rgb, list) => { const m = own(new THREE.MeshBasicMaterial()); m.userData.rgb = rgb; list.push(m); return m; };
  const box = (parent, m, w, h, d) => { const k = new THREE.Mesh(cube, m); k.scale.set(w, h, d); parent.add(k); return k; };

  function startRoom() {
    const dist = roomDistances(level, level.start.room), fits = (r) => !r.crawl && r.H >= 2.5 && r.kind !== 'start' && r.kind !== 'exit';
    const plain = level.rooms.filter((r) => fits(r) && r.kind === 'plain' && (dist.get(r.id) ?? 0) >= 2), far = level.rooms.filter((r) => fits(r) && (dist.get(r.id) ?? 0) >= 2);
    const pool = plain.length ? plain : far.length ? far : level.rooms.filter((r) => r.kind !== 'start');
    const pick = pool.length ? c.R.pick(pool) : level.rooms[0];
    // (a room that asked for company has it standing there, if it will fit)
    if (c.haunt != null && level.rooms[c.haunt] && fits(level.rooms[c.haunt])) { const sp = c.walk.spotIn(walker, c.haunt); if (c.walk.stand(walker, sp.x, sp.z)) return c.haunt; }
    return pick.id;
  }

  function ready() {
    const spot = c.walk.spotIn(walker, startRoom());
    walker.x = spot.x; walker.z = spot.z; yaw = c.R.range(0, Math.PI * 2);
    cube = own(new THREE.BoxGeometry(1, 1, 1));
    group = new THREE.Group();
    const flesh = FLESH.map((rgb) => mat(rgb, mats)), gum = mat(GUM, mats), tooth = mat(TOOTH, mats), throat = mat(THROAT, mats);
    // the tube: rings of it, a little narrower toward the top, every other one a paler band
    for (let i = 0; i < SEGS; i++) {
      const w = 0.62 - 0.2 * (i / (SEGS - 1)) + (i % 2 ? 0.03 : 0);
      segs.push({ m: box(group, flesh[i % 2 ? 1 : i % 3 === 0 ? 2 : 0], w, SEG_H * 1.04, w), w });
    }
    // the mouth at the top of it: a dark ring, and what it has for teeth
    const top = new THREE.Group(); group.add(top); lips.push(top);
    box(top, gum, 0.46, 0.1, 0.46).position.y = 0.03;
    box(top, throat, 0.3, 0.04, 0.3).position.y = 0.085;
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, t = box(top, tooth, 0.05, 0.13, 0.05); t.position.set(Math.cos(a) * 0.18, 0.12, Math.sin(a) * 0.18); t.rotation.y = -a; }
    // two arms that do nothing but wave
    for (const side of [-1, 1]) {
      const joints = []; for (let j = 0; j < 4; j++) joints.push(box(group, flesh[j % 2], 0.15 - j * 0.02, 0.3, 0.15 - j * 0.02));
      arms.push({ side, joints });
    }
    // and the feet: short, thick, and more of them than it needs
    for (let k = 0; k < 6; k++) feet.push({ a: (k / 6) * Math.PI * 2, m: box(group, flesh[1], 0.24, 0.2, 0.34) });
    c.add(group);
    c.body({ get x() { return walker.x; }, get z() { return walker.z; }, r: G.r });
    PINK.forEach((rgb) => mat(rgb, wormMats));
    // E treads on one: the one spot there is to use, kept under whichever of them a foot would come down on
    use = c.use({ x: walker.x, z: walker.z, r: WORM.tread, cone: -1, when: () => !over && trodden(c.me(), worms) >= 0, use: tread });
    pose(0);
  }

  function tint(list, x, z, lift = 0.1) {
    const L = c.light(x, z, 1.2);
    for (const m of list) { const k = m.userData.rgb; const f = (v) => Math.min(1.15, v * 1.05 + lift); m.color.setRGB(k[0] * f(L[0]), k[1] * f(L[1]), k[2] * f(L[2])); }
  }

  /** Lean every ring of it where the sway has it this moment. */
  function pose(dt) {
    const floor = env.world.floorY(walker.x, walker.z), heave = s.mode === 'heave' ? Math.min(1, s.t / G.heave) : 0, glad = s.mode === 'content' ? 1 : 0;
    // how far it swings, and how fast: wider and easier when it is pleased with itself; drawn back and shaking as it heaves
    const amp = 0.5 + 0.35 * glad - 0.25 * heave, rate = 1.5 + 0.5 * glad;
    lean += ((heave ? -0.75 * heave : 0) - lean) * Math.min(1, dt * 5);
    const fx = Math.sin(yaw), fz = Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    let px = 0, pz = 0, py = 0.14, bend = 0, pitch = 0;
    for (let i = 0; i < SEGS; i++) {
      const k = i / (SEGS - 1), sway = Math.sin(clock * rate - i * 0.42) * amp * k * 0.34 + (heave ? (Math.random() - 0.5) * 0.05 * heave : 0);
      const nod = Math.sin(clock * rate * 0.5 - i * 0.3) * 0.12 * k * (1 + glad) + lean * k * 0.5;   // (the top of it curls over, to look at you with what it has)
      bend += sway * 0.32; pitch += nod * 0.3 + (k > 0.55 ? 0.3 * (1 - heave) : 0);
      const seg = segs[i].m, h = SEG_H * (1 + (heave ? Math.sin(clock * 22 + i) * 0.05 * heave : 0));
      px += Math.sin(bend) * h; pz += Math.sin(pitch) * h; py += Math.cos(bend) * Math.cos(pitch) * h;
      seg.position.set(walker.x + sx * px + fx * pz, floor + py - h / 2, walker.z + sz * px + fz * pz);
      seg.rotation.set(0, yaw, 0); seg.rotateZ(-bend); seg.rotateX(pitch);
      // a swallow goes up it while it heaves
      const gulp = heave ? Math.max(0, 1 - Math.abs(k - heave) * 5) * 0.35 : 0;
      seg.scale.set(segs[i].w * (1 + gulp), SEG_H * 1.04, segs[i].w * (1 + gulp));
    }
    const head = segs[SEGS - 1].m;
    lips[0].position.copy(head.position); lips[0].position.y += SEG_H / 2; lips[0].rotation.copy(head.rotation);
    lips[0].scale.setScalar(1 + 0.6 * heave);
    // the arms, from two thirds of the way up
    const sh = segs[Math.floor(SEGS * 0.65)].m;
    for (const arm of arms) {
      let ax = sh.position.x + sx * arm.side * 0.26, ay = sh.position.y, az = sh.position.z + sz * arm.side * 0.26, ang = arm.side * (1.1 + 0.5 * glad);
      arm.joints.forEach((j, n) => {
        ang += Math.sin(clock * (4.2 + glad * 2) + n * 0.9 + arm.side) * (0.55 + 0.25 * glad) - arm.side * heave * 0.35;
        const dx = Math.sin(ang) * 0.27, dy = Math.cos(ang) * 0.27;
        j.position.set(ax + sx * dx / 2, ay + dy / 2, az + sz * dx / 2); j.rotation.set(0, yaw, 0); j.rotateZ(-ang);
        ax += sx * dx; ay += dy; az += sz * dx;
      });
    }
    // the feet shuffle when it goes anywhere, and tread on the spot when it does not
    for (const f of feet) {
      const step = Math.max(0, Math.sin(walked * 9 + f.a * 2 + clock * (glad ? 3 : 0.8))) * (0.05 + 0.04 * glad);
      f.m.position.set(walker.x + Math.cos(f.a + yaw) * 0.36, floor + 0.1 + step, walker.z + Math.sin(f.a + yaw) * 0.36); f.m.rotation.y = -f.a - yaw + Math.PI / 2;
    }
    return { x: lips[0].position.x, y: lips[0].position.y, z: lips[0].position.z };
  }

  /** One of the small ones, out of its mouth: thrown up and over toward the visitor, and off it goes. */
  function bring(from, n, i) {
    const g = new THREE.Group(), parts = [];
    for (let k = 0; k < 4; k++) { const p = box(g, wormMats[k % 2], 0.085 - k * 0.012, 0.075 - k * 0.01, 0.1); parts.push(p); }
    c.add(g);
    const m = c.me(), a = Math.atan2(m.x - walker.x, m.z - walker.z) + (i - (n - 1) / 2) * 0.5 + (Math.random() - 0.5) * 0.3, far = 0.9 + Math.random() * 0.8;
    let tx = walker.x + Math.sin(a) * far, tz = walker.z + Math.cos(a) * far;
    const probe = { x: tx, z: tz, r: WORM.r, tall: WORM.tall, opens: false, crawls: true };
    if (!c.walk.stand(probe, tx, tz) || !env.world.passable(walker.x, walker.z, tx, tz)) { tx = walker.x + Math.sin(a) * 0.45; tz = walker.z + Math.cos(a) * 0.45; }
    worms.push({ g, parts, x: from.x, z: from.z, y: from.y, r: WORM.r, tall: WORM.tall, opens: false, crawls: true, air: { t: 0, dur: 0.6 + Math.random() * 0.25, fx: from.x, fz: from.z, fy: from.y, tx, tz, high: 0.5, born: true },
      jumps: WORM.jumps, life: WORM.life * (0.85 + Math.random() * 0.3), dazed: 0.25 + Math.random() * 0.4, wait: 0, heading: a, phase: Math.random() * 6, dead: false, flat: 0 });
  }

  /** E: a foot comes down on the nearest of them. */
  function tread() {
    const i = trodden(c.me(), worms); if (i < 0) return;
    const w = worms[i]; w.dead = true; w.flat = 0.001;
    c.play('glug', w.x, w.z, 8); c.play('thunk', w.x, w.z, 8);
  }

  function small(dt) {
    const m = c.me(), floorAt = (x, z) => env.world.floorY(x, z);
    for (let i = worms.length - 1; i >= 0; i--) {
      const w = worms[i];
      w.phase += dt * 16;
      if (w.dead) {
        // trodden flat, or dried up: it stays a moment and is gone
        w.flat += dt; w.g.position.set(w.x, floorAt(w.x, w.z) + 0.012, w.z); w.g.scale.set(1.5, Math.max(0.08, 0.3 - w.flat), 1.5);
        if (w.flat > 6) { w.g.removeFromParent(); worms.splice(i, 1); }
        continue;
      }
      const fire = c.fire(w.x, w.z);
      if (fire && Math.hypot(fire.x - w.x, fire.z - w.z) < 1.2) { w.dead = true; w.flat = 0.001; c.play('dissolve', w.x, w.z, 6); continue; }
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
            if (finds(d)) {
              const hit = c.hurt(WORM.hurts);
              w.dead = true; w.flat = 0.001; w.x = m.x; w.z = m.z;                  // it is spent either way
              if (hit.ended) { over = true; return; }
              if (hit.landed) { tookOne = true; env.hud?.glitch?.(0.7); env.interfere?.(0.8); c.play('squeak', m.x, m.z, 6); }
              continue;
            }
            w.jumps--; w.dazed = WORM.dazed; c.play('tick', w.x, w.z, 6);
            if (w.jumps <= 0) w.life = Math.min(w.life, 3);
          }
        }
      } else {
        w.life -= dt; w.y = floorAt(w.x, w.z) + 0.04;
        if (w.life <= 0) { w.dead = true; w.flat = 0.001; continue; }
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
      w.parts.forEach((p, k) => p.position.set(Math.sin(w.phase - k * 1.4) * (lying ? 0.05 : 0.028), w.air ? Math.sin(w.phase * 0.6 + k) * 0.03 : 0, -k * 0.085));
      w.g.visible = c.drawn(w);
    }
    // the one spot to use is under whichever of them a foot would find
    const j = trodden(m, worms);
    if (use && j >= 0) {
      use.wx = worms[j].x; use.wz = worms[j].z;
      const rt = env.world.roomAt(use.wx, use.wz);
      if (rt && rt !== use.room) { const at = use.room?.uses.indexOf(use) ?? -1; if (at >= 0) use.room.uses.splice(at, 1); rt.uses.push(use); use.room = rt; }
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
      if (s.mode === 'heave' && was !== 'heave') c.play('glug', walker.x, walker.z, 12);
      // it turns to whoever it is greeting, slowly; and goes over to them, more slowly
      const want = sees ? Math.atan2(m.x - walker.x, m.z - walker.z) : yaw, turn = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
      yaw += Math.max(-dt * 1.2, Math.min(dt * 1.2, turn));
      if (s.comes && d > G.near * 0.8) {
        if (nearFire) c.walk.go(walker, { x: walker.x * 2 - fire.x, z: walker.z * 2 - fire.z }, G.speed * dt);
        else walked += c.walk.go(walker, m, G.speed * (c.speedScale ?? 1) * dt, G.near * 0.8).went;
      }
      group.visible = c.drawn(walker);
      const mouth = pose(dt);
      tint(mats, walker.x, walker.z);
      if (s.up) { hadBrood = true; tookOne = false; for (let i = 0; i < s.up; i++) bring(mouth, s.up, i); c.play('dissolve', walker.x, walker.z, 12); env.interfere?.(0.35); }
      if (worms.length) { small(dt); if (worms[0]) tint(wormMats, worms[0].x, worms[0].z, 0.25); }
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
          w.parts.forEach((p, n) => p.position.set(Math.sin(w.phase - n * 1.4) * 0.04, 0, -n * 0.085));
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
    at: () => ({ x: walker.x, z: walker.z, mode: s.mode, brood: worms.filter((w) => !w.dead).length }),
    dispose() { for (const w of worms) w.g.removeFromParent(); worms.length = 0; group?.removeFromParent(); group = null; },
  };
}
