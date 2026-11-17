// The Backrooms — the intern. One of them, far too tall, bent double: on its
// hands and its feet with its back in the air, and its head hung down between
// its arms the wrong way up, smiling at you. It learns by watching: whatever
// you do it does, where you did it, a few seconds late (intern.rule.js). Stand
// still and it arrives. Out of its sight for long enough, it has lost its
// place, and waits to be shown again.
//
// Voxels, posed every frame. Its arms and hands are head count's and its legs
// the standing meeting's; its back, neck and head are its own
// (intern.model.js). Hands and feet are planted on the floor and the joints
// worked out from there.
import * as THREE from 'three';
import { roomDistances } from '../gen.js';
import { Batch, lamp } from '../kit.js';
import { INTERN, waiting, copies, behind, was, pushed } from './intern.rule.js';
import { slide } from '../shove.rule.js';
import { elbow } from './head-count.rule.js';
import { S, BACK, NECK, backVox, neckVox, headVox } from './intern.model.js';
import { UPPER, FORE, upperVox, foreVox, handVox, lanyardVox } from './head-count.model.js';
import { THIGH, SHIN, thighVox, shinVox } from './standing-meeting.model.js';

const U = UPPER * S, F = FORE * S, LEG = 1.35, TH = THIGH * S * LEG, SH = SHIN * S * LEG, SHOE = 0.1 * LEG;

export function create(c) {
  const env = c.env, level = c.level, I = INTERN;
  const walker = { x: 0, z: 0, r: I.r, tall: I.tall, opens: false };
  /** Can it get through this doorway of room r at all? (A room whose every doorway is a crawl hole to it is no room to start in, nor to set off for.) */
  const way = (d, r) => { const cost = c.walk.cost?.(walker); return !cost || cost(d, r.id, d.to) < Infinity; };
  let s = waiting(), group = null, mat = null, back = null, neck = null, head = null, tag = null, limbs = [], trail = [];
  let clock = 0, rot = 0, low = 0, known = false, over = false, lastX = 0, lastZ = 0, sampleT = 0, swing = 0, swingV = 0, nod = 0, look = 0;
  const vx = new THREE.Vector3(), vy = new THREE.Vector3(), vz = new THREE.Vector3(), basis = new THREE.Matrix4();

  const LIGHTS = [lamp(0.6, 3.2, 1.4, [1.1, 1.05, 1.0], { k: 9, wrap: 0.45, far: 40 })];
  const geo = (key, make) => { const b = new Batch(true); b.addVox(env.kit.model(key, make).solid, new THREE.Matrix4().makeScale(S, S, S)); return env.kit.geometry(b, LIGHTS, [0.4, 0.38, 0.38]); };
  const part = (g) => { const k = new THREE.Mesh(g, mat); group.add(k); return k; };
  /** Turn a length of it (made along +y) to run along a direction, with its front (+z) as near another as that allows; and stretch it to a length. */
  const aim = (mesh, dx, dy, dz, fx, fy, fz, len, made, wide = 1) => {
    vy.set(dx, dy, dz).normalize(); vz.set(fx, fy, fz); vx.crossVectors(vy, vz);
    if (vx.lengthSq() < 1e-6) vx.set(1, 0, 0); vx.normalize(); vz.crossVectors(vx, vy).normalize();
    mesh.quaternion.setFromRotationMatrix(basis.makeBasis(vx, vy, vz)); mesh.scale.set(wide, len / made, wide);
  };

  function startRoom() {
    const dist = roomDistances(level, level.start.room), fits = (r) => !r.crawl && r.H >= 2.2 && r.kind !== 'start' && r.kind !== 'exit' && r.doors.some((d) => way(d, r)) && (dist.get(r.id) ?? 0) >= 2;
    const plain = level.rooms.filter((r) => fits(r) && r.kind === 'plain' && (dist.get(r.id) ?? 0) >= 3), far = level.rooms.filter(fits);
    const pool = plain.length ? plain : far.length ? far : level.rooms.filter((r) => r.kind !== 'start');
    const pick = pool.length ? c.R.pick(pool) : level.rooms[0];
    if (c.haunt != null && level.rooms[c.haunt] && fits(level.rooms[c.haunt])) { const sp = c.walk.spotIn(walker, c.haunt); if (c.walk.stand(walker, sp.x, sp.z)) return c.haunt; }
    return pick.id;
  }

  function ready() {
    const spot = c.walk.spotIn(walker, startRoom());
    walker.x = lastX = spot.x; walker.z = lastZ = spot.z; rot = c.R.range(0, Math.PI * 2);
    mat = env.kit.surface({ vox: true, wet: 0.55 });
    group = new THREE.Group();
    back = part(geo('intern:back', backVox)); neck = part(geo('intern:neck', neckVox)); head = part(geo('intern:head', headVox)); tag = part(geo('intern:tag', () => lanyardVox(1)));
    const upper = geo('heads:upper:1', () => upperVox(1)), fore = geo('heads:fore:1', () => foreVox(1)), hand = geo('heads:hand:0', () => handVox(0));
    const thigh = geo('meeting:thigh2:0', () => thighVox(0)), shin = geo('meeting:shin2:0', () => shinVox(0));
    for (const side of [-1, 1]) limbs.push({ arm: true, side, a: part(upper), b: part(fore), end: part(hand), x: 0, z: 0, fx: 0, fz: 0, tx: 0, tz: 0, k: 1, lift: 0, placed: false });
    for (const side of [-1, 1]) limbs.push({ arm: false, side, a: part(thigh), b: part(shin), end: null, x: 0, z: 0, fx: 0, fz: 0, tx: 0, tz: 0, k: 1, lift: 0, placed: false });
    c.add(group);
    c.body({ get x() { return walker.x; }, get z() { return walker.z; }, r: I.r });
    pose(0, false, c.me());
  }

  /** Stand it where it is: back, neck and head, and each limb from the floor up. */
  function pose(dt, moving, m) {
    const floor = env.world.floorY(walker.x, walker.z), fx = Math.sin(rot), fz = Math.cos(rot), px = Math.cos(rot), pz = -Math.sin(rot);
    const sorry = s.mode === 'sorry', blank = s.mode === 'blank', keen = s.mode === 'copies';
    // what it carries itself at: lower when the one it is copying is stooped (it stoops too); lower again when it has them
    const want = (m?.duck ?? 0) * 0.3 + (sorry ? 0.25 : 0);
    low += (want - low) * Math.min(1, dt * 3);
    const sh = { x: walker.x + fx * 0.42, y: floor + (1.02 - low * 0.9) + Math.sin(clock * 1.7) * 0.02, z: walker.z + fz * 0.42 };
    const hip = { x: walker.x - fx * 0.42, y: floor + (1.24 - low * 0.7) + Math.sin(clock * 1.7 + 1) * 0.025, z: walker.z - fz * 0.42 };
    const bx = sh.x - hip.x, by = sh.y - hip.y, bz = sh.z - hip.z, bl = Math.hypot(bx, by, bz);
    back.position.set(hip.x, hip.y, hip.z); aim(back, bx, by, bz, 0, 1, 0, bl, BACK * S);            // (its spine is uppermost)
    // the limbs. Two at a time, opposite corners: it has been shown how something on four legs goes
    let stepping = limbs.filter((l) => l.k < 1).length;
    const stride = moving ? 0.34 : 0.16, quick = 0.16;
    const rest = (l) => l.arm
      ? { jx: sh.x + px * l.side * 0.27, jy: sh.y - 0.03, jz: sh.z + pz * l.side * 0.27, x: sh.x + px * l.side * 0.34 + fx * (moving ? 0.5 : 0.22), z: sh.z + pz * l.side * 0.34 + fz * (moving ? 0.5 : 0.22) }
      : { jx: hip.x + px * l.side * 0.14, jy: hip.y - 0.04, jz: hip.z + pz * l.side * 0.14, x: hip.x + px * l.side * 0.3 - fx * (moving ? 0.12 : 0.34), z: hip.z + pz * l.side * 0.3 - fz * (moving ? 0.12 : 0.34) };
    const due = limbs.map((l, n) => { if (!l.placed || l.k < 1) return [0, n]; const r = rest(l); return [Math.hypot(r.x - l.x, r.z - l.z), n]; }).filter(([d]) => d > stride).sort((a, b) => b[0] - a[0]).slice(0, Math.max(0, 2 - stepping));
    const turn = new Set(due.map(([, n]) => n));
    limbs.forEach((l, n) => {
      const r = rest(l);
      if (!l.placed || Math.hypot(r.x - l.x, r.z - l.z) > 1.5) { l.x = r.x; l.z = r.z; l.k = 1; l.placed = true; }
      if (l.k >= 1 && turn.has(n)) { l.fx = l.x; l.fz = l.z; l.tx = r.x; l.tz = r.z; l.k = 0; }
      if (l.k < 1) {
        l.k = Math.min(1, l.k + dt / quick); l.x = l.fx + (l.tx - l.fx) * l.k; l.z = l.fz + (l.tz - l.fz) * l.k; l.lift = Math.sin(l.k * Math.PI) * 0.2;
        if (l.k >= 1) { l.lift = 0; c.play('step', l.x, l.z, 9); }          // (it sounds like somebody walking, which is what it is doing)
      }
      const gy = env.world.floorY(l.x, l.z) + l.lift, joint = { x: r.jx, y: r.jy, z: r.jz };
      if (l.arm) {
        const hand = { x: l.x, y: gy + 0.05, z: l.z }, e = elbow(joint, hand, U, F, { x: px * l.side * 1.4, z: pz * l.side * 1.4 });
        l.a.position.set(joint.x, joint.y, joint.z); aim(l.a, e.x - joint.x, e.y - joint.y, e.z - joint.z, fx, 0, fz, Math.hypot(e.x - joint.x, e.y - joint.y, e.z - joint.z), U);
        l.b.position.set(e.x, e.y, e.z); aim(l.b, hand.x - e.x, hand.y - e.y, hand.z - e.z, fx, 0, fz, Math.hypot(hand.x - e.x, hand.y - e.y, hand.z - e.z), F);
        l.end.position.set(l.x, gy, l.z); l.end.rotation.set(l.lift * -1.5, rot + l.side * 0.25, 0);
      } else {
        const ankle = { x: l.x, y: gy + SHOE, z: l.z }, e = elbow(joint, ankle, TH, SH, { x: -fx * 2 + px * l.side * 0.8, z: -fz * 2 + pz * l.side * 0.8 });   // (the knee goes up and back: it is the wrong way round)
        l.a.position.set(joint.x, joint.y, joint.z); aim(l.a, e.x - joint.x, e.y - joint.y, e.z - joint.z, fx, 0, fz, Math.hypot(e.x - joint.x, e.y - joint.y, e.z - joint.z), TH / LEG, LEG);
        l.b.position.set(e.x, e.y, e.z); aim(l.b, ankle.x - e.x, ankle.y - e.y, ankle.z - e.z, fx, 0, fz, Math.hypot(ankle.x - e.x, ankle.y - e.y, ankle.z - e.z), SH / LEG, LEG);
      }
    });
    // the head: it hangs, and swings as it goes, and whatever else it is doing it is looking at them
    swingV += (-swing * 16 - swingV * 2.4 + (moving ? Math.sin(clock * 8.5) * 5 : 0)) * dt; swing += swingV * dt;
    nod += ((blank ? 0.9 : sorry ? -0.35 : keen ? 0.15 : 0) - nod) * Math.min(1, dt * 3);
    const nb = { x: sh.x + fx * 0.1, y: sh.y - 0.06, z: sh.z + fz * 0.1 }, nl = NECK * S;
    const ndx = fx * (0.28 + nod * 0.5) + px * swing * 0.5, ndy = -1 + Math.abs(nod) * 0.25, ndz = fz * (0.28 + nod * 0.5) + pz * swing * 0.5, nn = Math.hypot(ndx, ndy, ndz);
    neck.position.set(nb.x, nb.y, nb.z); aim(neck, ndx, ndy, ndz, fx, 0, fz, nl, nl);
    const hx = nb.x + (ndx / nn) * nl, hy = nb.y + (ndy / nn) * nl, hz = nb.z + (ndz / nn) * nl;
    // (blank, it looks about for whoever was showing it; otherwise at them)
    const want2 = m ? Math.atan2(m.x - hx, m.z - hz) : rot; look += Math.atan2(Math.sin((blank ? rot + Math.sin(clock * 1.3) * 1.2 : want2) - look), Math.cos((blank ? rot + Math.sin(clock * 1.3) * 1.2 : want2) - look)) * Math.min(1, dt * 4);
    head.position.set(hx, hy, hz); aim(head, ndx * 0.25, -1, ndz * 0.25, Math.sin(look), 0, Math.cos(look), 1, 1);
    head.rotateZ(Math.sin(clock * 0.9) * 0.1 + swing * 0.6);                                              // and it tilts, the way somebody listening does
    tag.position.set(nb.x - fx * 0.05, nb.y - 0.02, nb.z - fz * 0.05); tag.rotation.set(swing * 0.6, rot, swing);
  }

  return {
    ready,
    update(dt) {
      if (!group || over) return;
      clock += dt;
      const m = c.me(), d = Math.hypot(m.x - walker.x, m.z - walker.z), sees = d < I.sees && c.los(walker.x, walker.z, m.x, m.z);
      const fire = c.fire(walker.x, walker.z), nearFire = !!fire && Math.hypot(fire.x - walker.x, fire.z - walker.z) < I.fire;
      if (!known && d < 11 && sees && !c.hidden(walker.x, walker.z, 0.6)) { known = true; c.met(); }
      // what it has watched: where they were, ten times a second, for as long as it can see them
      sampleT -= dt;
      if (sees && sampleT <= 0) { sampleT = 0.1; trail.push({ x: m.x, z: m.z, t: clock }); while (trail.length && trail[0].t < clock - I.keep) trail.shift(); }
      s = copies(s, { dt, d, sees, fire: nearFire });
      if (s.starts) { c.play('penclick', walker.x, walker.z, 12); trail = trail.filter((p) => p.t >= clock - 0.2); }
      if (s.loses) { c.play('creak', walker.x, walker.z, 10); trail = []; }
      if (s.took) {
        const hit = c.hurt(I.hurts);
        if (hit.ended) { over = true; return; }
        if (hit.landed) { env.hud?.glitch?.(0.6); env.interfere?.(0.7); c.play('thunk', m.x, m.z, 12); c.survived(); }
        trail = [];
      }
      // it goes where they were, that long ago
      if (s.mode === 'copies') {
        const to = was(trail, clock - behind(s.learnt));
        if (to) c.walk.go(walker, to, I.fast * (c.speedScale ?? 1) * Math.min(dt, 0.08), 0.05);
      } else if (nearFire) c.walk.go(walker, { x: walker.x * 2 - fire.x, z: walker.z * 2 - fire.z }, 1.2 * dt);
      const mx = walker.x - lastX, mz = walker.z - lastZ, moved = Math.hypot(mx, mz) > 1e-4;
      const face = moved ? Math.atan2(mx, mz) : sees ? Math.atan2(m.x - walker.x, m.z - walker.z) : rot;
      rot += Math.atan2(Math.sin(face - rot), Math.cos(face - rot)) * Math.min(1, dt * (moved ? 6 : 1.5));
      lastX = walker.x; lastZ = walker.z;
      group.visible = c.drawn(walker);
      const L = c.light(walker.x, walker.z, 1.2); mat.uniforms.uTint.value.set(L[0] * 1.5 + 0.05, L[1] * 1.5 + 0.05, L[2] * 1.5 + 0.05);
      pose(dt, moved, m);
    },
    /** The building's camera: it comes up to the visitor's character, puts its face to theirs, and they go down in front of it. */
    takes(shot) {
      over = true;
      const fig = shot.figure, d0 = Math.hypot(shot.x - walker.x, shot.z - walker.z) || 1, dir = { x: (shot.x - walker.x) / d0, z: (shot.z - walker.z) / d0 };
      s = { ...s, mode: 'copies' };
      return (t, dt) => {
        clock += dt;
        const gap = Math.hypot(shot.x - walker.x, shot.z - walker.z), step = gap > 0.85 ? Math.min(gap - 0.85, 1.6 * dt) : 0;
        if (step > 0) { const nx = walker.x + dir.x * step, nz = walker.z + dir.z * step; if (c.walk.clear(walker, walker.x, walker.z, nx, nz)) { walker.x = nx; walker.z = nz; } }
        rot += Math.atan2(Math.sin(Math.atan2(dir.x, dir.z) - rot), Math.cos(Math.atan2(dir.x, dir.z) - rot)) * Math.min(1, dt * 5);
        if (t > 1.4 && s.mode !== 'sorry') s = { ...s, mode: 'sorry', t: 0 };
        pose(dt, step > 0, { x: shot.x, z: shot.z, duck: Math.max(0, Math.min(1, (t - 1.4) / 0.6)) });
        if (fig) { const k = Math.max(0, Math.min(1, (t - 1.5) / 0.7)), e = k * k * (3 - 2 * k); fig.rotation.x = -1.45 * e; fig.rotation.z = t < 1.5 ? Math.sin(t * 20) * 0.04 : 0; }
      };
    },
    /** …filmed from the side. */
    films(shot) {
      const dx = walker.x - shot.x, dz = walker.z - shot.z, d = Math.hypot(dx, dz) || 1, cx = shot.x + (dx / d) * 0.5, cz = shot.z + (dz / d) * 0.5;
      for (const far of [4, 3, 2.2]) for (const side of [1, -1]) {
        const x = cx + (dz / d) * side * far, z = cz - (dx / d) * side * far;
        if (c.room(x, z) !== null && c.room(x, z) === c.room(shot.x, shot.z) && c.los(x, z, shot.x, shot.z)) return { x, y: shot.y + 1.3, z, at: { x: cx, y: shot.y + 0.8, z: cz } };
      }
      return null;
    },
    /** A shove (shove.rule.js): it goes back a step, and has lost its place in what it was copying. */
    shoveTargets() {
      if (!group || over || s.mode === 'sorry') return [];
      return [{ id: 'intern', x: walker.x, z: walker.z, y: env.world.floorY(walker.x, walker.z) + 0.9, r: I.r, shove: (dir) => {
        const to = slide(walker, dir, (x0, z0, x1, z1) => c.walk.clear(walker, x0, z0, x1, z1));
        if (to) { walker.x = to.x; walker.z = to.z; }
        s = pushed(s); trail = []; c.play('creak', walker.x, walker.z, 10);
        return true;
      } }];
    },
    at: () => ({ x: walker.x, z: walker.z, mode: s.mode, behind: +behind(s.learnt).toFixed(2) }),
    dispose() { group?.removeFromParent(); group = null; },
  };
}
