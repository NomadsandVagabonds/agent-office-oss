// The Backrooms — the middle manager. Three metres of somebody in a suit, so tall it goes about bent under the ceiling,
// and so thin it could stand sideways in a doorway. Left alone it stands, its head down, and now and then takes a step
// or two somewhere else. Look it in the eye and it comes for you, quickly, for as long as you hold the look; every look
// leaves it fatter, and fatter is slower; near you, or full, it swells and goes off, in a burst of paper that reaches as
// far as everything it has put on (middle-manager.rule.js).
//
// Voxels, posed every frame (middle-manager.model.js): a body thin and a body full, and between them the one there is
// is let out to the width it has reached. It folds at the hips and the neck to keep its head under whatever is above it.
import * as THREE from 'three';
import { roomDistances, roomPath } from '../gen.js';
import { Batch, lamp } from '../kit.js';
import { MANAGER, fresh, minds, eyed, off, popped, blastAt, reach, bend } from './middle-manager.rule.js';
import { SHOVE, slide } from '../shove.rule.js';
import { HEALTH } from './health.rule.js';
import { canLeave } from './paths.js';
import { elbow } from './head-count.rule.js';
import { calm as unafraid, afraid } from './fire.rule.js';
import { DOORWAY, at as doorwayAt, fresh as unkept, camps, elsewhere } from './doorway.rule.js';
import { S, TORSO, NECK, UPPER, FORE, HAND, THIGH, SHIN, SHOE, HEAD, FACES, torsoVox, neckVox, headVox, sleeveVox, handVox, trouserVox, shoeVox } from './middle-manager.model.js';

const T = TORSO * S, N = NECK * S, U = UPPER * S, F = FORE * S, TH = THIGH * S, SH = SHIN * S, FOOT = SHOE * S;
const BODY = { hip: TH + SH + FOOT, torso: T, neck: N, head: HEAD * S };
const PAPER = ['#f2efe6', '#e9e4d6', '#f6f3ec', '#d9d3c2', '#f2e9a6', '#dfe9f2'];

export function create(c) {
  const env = c.env, level = c.level, Mg = MANAGER;
  const walker = { x: 0, z: 0, r: Mg.r, tall: Mg.ducks, opens: false };
  let s = fresh(), fear = unafraid(), group = null, mat = null, thin = null, full = null, neck = null, head = null, heads = [], limbs = [], shoes = [];
  let rot = 0, lean = 0, phase = 0, clock = 0, lastX = 0, lastZ = 0, known = false, over = false, wanderT = 0, goal = null, goalT = 0, leaving = false, kept = unkept(c.R), debris = null;
  const doors = new Map();
  const vx = new THREE.Vector3(), vy = new THREE.Vector3(), vz = new THREE.Vector3(), basis = new THREE.Matrix4();

  const LIGHTS = [lamp(0.6, 3.4, 1.4, [1.1, 1.05, 1.0], { k: 9, wrap: 0.45, far: 40 })];
  // (no corner shading: flat faces of one colour merge, and it reads smooth rather than built; f: built coarser, drawn bigger)
  const geo = (key, make, f = 1) => { const b = new Batch(true); b.addVox(env.kit.model(key, make, { ao: false }).solid, new THREE.Matrix4().makeScale(S * f, S * f, S * f)); return env.kit.geometry(b, LIGHTS, [0.4, 0.38, 0.38]); };
  const part = (g) => { const k = new THREE.Mesh(g, mat); group.add(k); return k; };
  /** Turn a length of it (made along +y) to run along a direction, its front (+z) as near another as that allows; stretch it, and let it out. */
  const aim = (mesh, dx, dy, dz, fx, fy, fz, len, made, wide = 1) => {
    vy.set(dx, dy, dz).normalize(); vz.set(fx, fy, fz); vx.crossVectors(vy, vz);
    if (vx.lengthSq() < 1e-6) vx.set(1, 0, 0); vx.normalize(); vz.crossVectors(vx, vy).normalize();
    mesh.quaternion.setFromRotationMatrix(basis.makeBasis(vx, vy, vz)); mesh.scale.set(wide, len / made, wide);
  };

  function startRoom() {
    const dist = roomDistances(level, level.start.room), fits = (r) => !r.crawl && r.H >= 2.2 && r.kind !== 'start' && r.kind !== 'exit' && (dist.get(r.id) ?? 0) >= 2 && canLeave(r, walker.tall);
    const plain = level.rooms.filter((r) => fits(r) && r.kind === 'plain' && (dist.get(r.id) ?? 0) >= 3), far = level.rooms.filter(fits);
    const pool = plain.length ? plain : far.length ? far : level.rooms.filter((r) => r.kind !== 'start');
    if (c.haunt != null && level.rooms[c.haunt] && fits(level.rooms[c.haunt])) { const sp = c.walk.spotIn(walker, c.haunt); if (c.walk.stand(walker, sp.x, sp.z)) return c.haunt; }
    return (pool.length ? c.R.pick(pool) : level.rooms[0]).id;
  }

  function ready() {
    const spot = c.walk.spotIn(walker, startRoom());
    walker.x = lastX = spot.x; walker.z = lastZ = spot.z; rot = c.R.range(0, Math.PI * 2); wanderT = c.R.range(Mg.wanders[0], Mg.wanders[1]);
    mat = env.kit.surface({ vox: true, wet: 0.2 });
    group = new THREE.Group();
    thin = part(geo('manager:torso:thin3', () => torsoVox(false))); full = part(geo('manager:torso:full3', () => torsoVox(true).downsample(2), 2));          // (big enough to be built at half the grain) full.visible = false;
    neck = part(geo('manager:neck', neckVox));
    // its face, as fed as it is: sad, nothing, pleased, the grin (the owner's). One head each; the one it has on is shown
    heads = Array.from({ length: FACES }, (_, f) => part(geo(`manager:head3:${f}`, () => headVox(f)))); head = heads[0];
    const upper = geo('manager:upper2', () => sleeveVox(UPPER)), fore = geo('manager:fore2', () => sleeveVox(FORE, true)), hand = geo('manager:hand2', handVox);
    const thigh = geo('manager:thigh', () => trouserVox(THIGH)), shin = geo('manager:shin2', () => trouserVox(SHIN, 5.2, true)), shoe = geo('manager:shoe', shoeVox);
    for (const side of [-1, 1]) limbs.push({ arm: true, side, a: part(upper), b: part(fore), end: part(hand) });
    for (const side of [-1, 1]) { limbs.push({ arm: false, side, a: part(thigh), b: part(shin), end: null }); shoes.push(part(shoe)); }
    c.add(group);
    // (gone off, it is nobody's to walk round: its body is let go)
    c.body({ get x() { return walker.x; }, get z() { return walker.z; }, get r() { return over ? 0.001 : Mg.r; } });
    pose(0, 0, c.me());
  }

  /** Where this room's doorways are, and how high: worked out once a room. */
  function doorsOf(rt) {
    if (!rt) return [];
    if (!doors.has(rt.id)) doors.set(rt.id, (rt.def.doors || []).map((d) => { const w = env.world.doorway?.(rt.id, d.to); return w ? { x: w.x, z: w.z, h: Number.isFinite(d.h) ? d.h : rt.def.H, to: d.to } : null; }).filter(Boolean));
    return doors.get(rt.id);
  }
  /** What is above it: the ceiling, or a doorway's head when it is going through one. */
  function above() {
    const rt = env.world.roomAt(walker.x, walker.z); if (!rt) return 2.6;
    let h = rt.def.H ?? 2.6;
    for (const d of doorsOf(rt)) if (Math.hypot(d.x - walker.x, d.z - walker.z) < 0.9) h = Math.min(h, d.h);
    return h;
  }
  /** Is it standing in a doorway, a crawl's mouth or the way down (doorway.rule.js)? */
  const doorway = () => { const rt = env.world.roomAt(walker.x, walker.z); return rt ? doorwayAt(walker, doorsOf(rt), level.rooms[rt.id]?.kind === 'exit') : null; };
  /** Somewhere a room or two away that the doorway cannot be seen from (doorway.rule.js elsewhere). */
  function away(way) {
    const here = env.world.roomAt(walker.x, walker.z), m = c.me(); if (!here) return null;
    // (and not past the visitor: it is going away from the doorway, not into them — near them, it goes off)
    const mine = m ? env.world.roomAt(m.x, m.z)?.id : null;
    const dist = roomDistances(level, here.id), spots = [];
    for (const [rid, n] of dist) {
      if (n < DOORWAY.away[0] || n > DOORWAY.away[1] || level.rooms[rid]?.kind === 'exit' || level.rooms[rid]?.crawl) continue;
      if (rid === mine || (roomPath(level, here.id, rid) || []).slice(1).includes(mine)) continue;          // (nor through their room on the way)
      const p = c.walk.spotIn(walker, rid); if (!p || !c.walk.stand(walker, p.x, p.z)) continue;
      if (m && Math.hypot(p.x - m.x, p.z - m.z) < Mg.near * 3) continue;
      spots.push({ x: p.x, z: p.z, rooms: n, sees: way.down ? false : c.los(p.x, p.z, way.x, way.z) });
    }
    return elsewhere(way, spots, c.R);
  }

  /** Stand it: legs from the floor, the body folded under what is above it, the arms hanging, the head down and on them. */
  function pose(dt, moved, m) {
    const floor = env.world.floorY(walker.x, walker.z), fx = Math.sin(rot), fz = Math.cos(rot), px = Math.cos(rot), pz = -Math.sin(rot);
    const fat = s.fat, swell = s.mode === 'swells' ? Math.min(1, s.swell / Mg.swells) : 0, shake = swell * Math.sin(clock * 38) * 0.03;
    // how far it has to bend to keep its head under what is above it, and a little more when it is coming for you
    const want = Math.min(1.45, bend(above(), BODY) + (s.mode === 'comes' ? 0.12 : 0) + swell * 0.15);
    lean += (want - lean) * Math.min(1, dt * 4 || 1);
    // its walk: long, slow strides, whatever its speed; the knees always a little bent
    const stride = 0.55 + 0.25 * (1 - fat);
    phase += moved / stride * Math.PI;
    const kneel = 0.06 + swell * 0.1 + fat * 0.04, hipBack = T * Math.sin(lean) * 0.35;
    const hip = { x: walker.x - fx * hipBack, y: floor + BODY.hip - kneel + Math.abs(Math.sin(phase)) * 0.02, z: walker.z - fz * hipBack };
    const dir = { x: fx * Math.sin(lean), y: Math.cos(lean), z: fz * Math.sin(lean) }, front = { x: fx * Math.cos(lean), y: -Math.sin(lean), z: fz * Math.cos(lean) };
    // the body: thin, let out as it fattens; past half, the full one, let out the rest of the way
    const widen = 1 + swell * 0.45 + shake;
    thin.visible = fat < 0.5; full.visible = !thin.visible;
    const body = thin.visible ? thin : full, wide = (thin.visible ? 1 + fat * 1.3 : 0.5 + (fat - 0.5)) * widen;
    body.position.set(hip.x, hip.y, hip.z); aim(body, dir.x, dir.y, dir.z, front.x, front.y, front.z, T, T, wide);
    const sh = { x: hip.x + dir.x * T, y: hip.y + dir.y * T, z: hip.z + dir.z * T }, half = 0.17 + fat * 0.22 + swell * 0.06;
    // the neck and the head: down further than the body, and turned to whoever it is having its meeting with
    const na = lean * Mg.neck, ha = lean * Mg.head, nd = { x: fx * Math.sin(na), y: Math.cos(na), z: fz * Math.sin(na) };
    neck.position.set(sh.x, sh.y, sh.z); aim(neck, nd.x, nd.y, nd.z, fx * Math.cos(na), -Math.sin(na), fz * Math.cos(na), N, N, 1 + fat * 0.6);
    const hb = { x: sh.x + nd.x * N, y: sh.y + nd.y * N, z: sh.z + nd.z * N };
    const look = m ? Math.atan2(m.x - hb.x, m.z - hb.z) : rot, turn = Math.atan2(Math.sin(look - rot), Math.cos(look - rot)), tl = Math.max(-1, Math.min(1, turn));
    const face = swell > 0 || fat >= 0.8 ? 3 : fat >= 0.5 ? 2 : fat >= 0.22 ? 1 : 0;
    heads.forEach((h, f) => { h.visible = f === face; }); head = heads[face];
    head.position.set(hb.x, hb.y, hb.z); aim(head, Math.sin(rot + tl) * Math.sin(ha), Math.cos(ha), Math.cos(rot + tl) * Math.sin(ha), Math.sin(rot + tl) * Math.cos(ha), -Math.sin(ha), Math.cos(rot + tl) * Math.cos(ha), 1, 1, 1 + fat * 0.25);
    head.rotateZ(Math.sin(clock * 0.7) * 0.06 + shake * 2);
    const swing = moved > 0 ? Math.sin(phase) : 0;
    limbs.forEach((l, i) => {
      if (l.arm) {
        // its arms hang, long; coming for you they swing; swelling, they lift from its sides
        const j = { x: sh.x + px * l.side * half, y: sh.y - 0.04, z: sh.z + pz * l.side * half };
        const reachOut = s.mode === 'comes' ? 0.35 : 0, sw = -l.side * swing * 0.35;
        const hand = { x: j.x + fx * (reachOut + sw) + px * l.side * (0.06 + swell * 0.5 + fat * 0.12), y: j.y - (U + F) * (0.97 - swell * 0.35) + reachOut * 0.3, z: j.z + fz * (reachOut + sw) + pz * l.side * (0.06 + swell * 0.5 + fat * 0.12) };
        const e = elbow(j, hand, U, F, { x: -fx * 2 + px * l.side, z: -fz * 2 + pz * l.side });
        l.a.position.set(j.x, j.y, j.z); aim(l.a, e.x - j.x, e.y - j.y, e.z - j.z, fx, 0, fz, U, U, 1 + fat * 0.5);
        const hl = Math.min(F, Math.hypot(hand.x - e.x, hand.y - e.y, hand.z - e.z));
        l.b.position.set(e.x, e.y, e.z); aim(l.b, hand.x - e.x, hand.y - e.y, hand.z - e.z, fx, 0, fz, F, F, 1 + fat * 0.4);
        const hx = e.x + (hand.x - e.x) / (hl || 1) * F, hy = e.y + (hand.y - e.y) / (hl || 1) * F, hz = e.z + (hand.z - e.z) / (hl || 1) * F;
        l.end.position.set(hx, hy, hz); aim(l.end, hand.x - e.x, hand.y - e.y, hand.z - e.z, fx, 0, fz, HAND * S, HAND * S, 1);
      } else {
        // its feet: one in front of the other, the far one lifting
        const ph = phase + (l.side > 0 ? Math.PI : 0), fore = moved > 0 || s.speed > 0 ? Math.sin(ph) * stride * 0.5 : 0, lift = moved > 0 ? Math.max(0, Math.cos(ph)) * 0.12 : 0;
        const j = { x: hip.x + px * l.side * (0.1 + fat * 0.12), y: hip.y, z: hip.z + pz * l.side * (0.1 + fat * 0.12) };
        const ax = walker.x + px * l.side * (0.12 + fat * 0.1) + fx * fore, az = walker.z + pz * l.side * (0.12 + fat * 0.1) + fz * fore;
        const ankle = { x: ax, y: env.world.floorY(ax, az) + FOOT + lift, z: az };
        const e = elbow(j, ankle, TH, SH, { x: fx * 3, z: fz * 3 });
        l.a.position.set(j.x, j.y, j.z); aim(l.a, e.x - j.x, e.y - j.y, e.z - j.z, fx, 0, fz, TH, TH, 1 + fat * 0.5);
        l.b.position.set(e.x, e.y, e.z); aim(l.b, ankle.x - e.x, ankle.y - e.y, ankle.z - e.z, fx, 0, fz, SH, SH, 1 + fat * 0.3);
        const shoe = shoes[i - 2]; shoe.position.set(ankle.x, ankle.y, ankle.z); shoe.rotation.set(-lift * 1.5, rot, 0);
      }
    });
  }

  /** It goes off: the hearts it costs whoever is in reach of it with nothing between, and paper everywhere. */
  function burst() {
    if (over || !group) return { ended: false };
    over = true;
    const m = c.me(), d = Math.hypot(m.x - walker.x, m.z - walker.z), at = { x: walker.x, z: walker.z }, fat = s.fat;
    c.play('crack', at.x, at.z, 16); c.play('shred', at.x, at.z, 14);
    let ended = false;
    const n = c.los(at.x, at.z, m.x, m.z) ? blastAt(fat, d) : 0;
    if (n > 0) {
      const hit = c.hurt(n, at);
      if (hit.ended) ended = true;
      else if (hit.landed) { env.hud?.glitch?.(0.8); c.survived(); }
    } else if (known && d <= reach(fat) + 2) c.survived();              // (it went off for them, and they were out of its reach: got away)
    // the body goes; what it was full of comes down over the room
    for (const k of group.children) k.visible = false;
    debris = spill(at, fat);
    return { ended };
  }

  /** A burst of paper: torn sheets that fly out as far as it reached, and come down and lie there. */
  function spill(at, fat) {
    const count = 40 + Math.round(fat * 60), floor = env.world.floorY(at.x, at.z);
    const geom = new THREE.PlaneGeometry(0.16, 0.2), paper = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geom, paper, count), bits = [], col = new THREE.Color(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), mx = new THREE.Matrix4();
    const out = reach(fat) * 1.4;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random()) * out;
      bits.push({ x: at.x, y: floor + 1.6 + Math.random() * 0.6, z: at.z, vx: Math.sin(a) * sp, vy: 1 + Math.random() * 3, vz: Math.cos(a) * sp, rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 18, down: false });
      mesh.setColorAt(i, col.set(PAPER[i % PAPER.length]));
    }
    const L = c.light(at.x, at.z, 1); paper.color.setRGB(Math.min(1, L[0] * 1.6 + 0.15), Math.min(1, L[1] * 1.6 + 0.15), Math.min(1, L[2] * 1.6 + 0.15));
    mesh.frustumCulled = false;          // (its sheets fly anywhere in the room; a bound worked out before they flew would hide them)
    c.add(mesh);
    let settled = false;
    return {
      tick(dt) {
        if (settled) return 0;
        let moving = 0;
        bits.forEach((b, i) => {
          if (!b.down) {
            moving++;
            const drag = Math.exp(-dt * 3.2); b.vx *= drag; b.vz *= drag; b.vy = b.vy * Math.exp(-dt * 1.5) - 6 * dt;
            const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
            if (c.los(b.x, b.z, nx, nz)) { b.x = nx; b.z = nz; } else { b.vx *= -0.3; b.vz *= -0.3; }
            const g = env.world.floorY(b.x, b.z) + 0.005; b.y += b.vy * dt; b.rx += b.spin * dt; b.ry += b.spin * 0.6 * dt;
            if (b.y <= g) { b.y = g; b.down = true; b.rx = -Math.PI / 2; b.ry = b.ry % (Math.PI * 2); }
          }
          e.set(b.down ? -Math.PI / 2 : b.rx, b.ry, 0); q.setFromEuler(e); p.set(b.x, b.y, b.z); mesh.setMatrixAt(i, mx.compose(p, q, one));
        });
        mesh.instanceMatrix.needsUpdate = true;
        settled = moving === 0;
        return moving;
      },
    };
  }

  function wander(dt, m, sees) {
    const here = env.world.roomAt(walker.x, walker.z);
    // never long in a doorway: after a while there — how long is the floor's to say, each time — it goes a room or two away,
    // somewhere the doorway cannot be seen from (doorway.rule.js)
    const dw = doorway(); kept = camps(kept, dt, dw, c.R);
    if (kept.due && !leaving) { const to = away(dw); if (to) { goal = to; goalT = 30; leaving = true; wanderT = c.R.range(Mg.wanders[0], Mg.wanders[1]); } else kept = unkept(c.R); }
    // and now and then, a step or two
    wanderT -= dt;
    if (!goal && wanderT <= 0 && here && !dw) {
      wanderT = c.R.range(Mg.wanders[0], Mg.wanders[1]);
      const a = c.R.range(0, Math.PI * 2), dist = c.R.range(0.4, 1.2), x = walker.x + Math.sin(a) * dist, z = walker.z + Math.cos(a) * dist;
      if (c.walk.stand(walker, x, z)) { goal = { x, z }; goalT = 6; }
    }
    if (goal) {
      goalT -= dt;
      const before = { x: walker.x, z: walker.z };
      c.walk.go(walker, goal, (leaving ? Mg.leaves : Mg.drift) * Math.min(dt, 0.08), 0.05);
      if (Math.hypot(goal.x - walker.x, goal.z - walker.z) < 0.15 || goalT <= 0 || (!leaving && before.x === walker.x && before.z === walker.z)) { goal = null; leaving = false; }
    }
  }

  return {
    ready,
    /** Its going (cast/health.rule.js): it went off when it was jabbed; what is left of it is the paper, coming down. */
    dies(progress, dt = 0) { if (debris && dt > 0) debris.tick(dt); },
    /** Finished, the paper lies where it came down. */
    fell() { return !!group; },
    update(dt) {
      if (!group) return;
      clock += dt;
      if (debris) { debris.tick(dt); return; }
      if (over) return;
      const m = c.me(), dx = walker.x - m.x, dz = walker.z - m.z, d = Math.hypot(dx, dz);
      group.visible = c.drawn(walker);
      const sight = group.visible && c.los(m.x, m.z, walker.x, walker.z);
      const offAxis = Math.acos(Math.max(-1, Math.min(1, (-Math.sin(m.yaw) * dx - Math.cos(m.yaw) * dz) / Math.max(d, 0.01))));
      const eye = eyed(offAxis, d, sight && Math.abs(m.pitch) < 0.9);
      if (!known && sight && d < 12 && !c.hidden(walker.x, walker.z, 0.6)) { known = true; c.met(); }
      // a fire: it backs off from it, and nothing else this moment
      fear = afraid(fear, dt, { x: walker.x, z: walker.z, yaw: rot }, c.fire(walker.x, walker.z));
      if (fear.flee) {
        s = off(s);
        c.walk.go(walker, { x: walker.x + Math.sin(fear.away), z: walker.z + Math.cos(fear.away) }, fear.step, 0.05);
      } else {
        s = minds(s, dt, { eyed: eye, d });
        if (s.meets) c.play('ding', walker.x, walker.z, 10);
        if (s.swelling) c.play('creak', walker.x, walker.z, 12);
        // (its tell is all in its body: it swells, it shakes, its arms lift, its buttons go, and the cloth creaks. Nothing of the picture)
        if (s.mode === 'swells' && Math.random() < dt * 6) c.play('squeak', walker.x, walker.z, 8);
        if (s.bursts) { burst(); return; }
        if (s.mode === 'comes') { goal = null; leaving = false; c.walk.go(walker, { x: m.x, z: m.z }, s.speed * (c.speedScale ?? 1) * Math.min(dt, 0.08), 0.05); }
        else if (s.mode === 'stands') wander(dt, m, sight);
      }
      const mx = walker.x - lastX, mz = walker.z - lastZ, moved = Math.hypot(mx, mz);
      const face = moved > 1e-4 ? Math.atan2(mx, mz) : sight ? Math.atan2(m.x - walker.x, m.z - walker.z) : rot;
      rot += Math.atan2(Math.sin(face - rot), Math.cos(face - rot)) * Math.min(1, dt * (moved > 1e-4 ? 5 : 0.8));
      lastX = walker.x; lastZ = walker.z;
      const L = c.light(walker.x, walker.z, 1.8); mat.uniforms.uTint.value.set(L[0] * 1.5 + 0.05, L[1] * 1.5 + 0.05, L[2] * 1.5 + 0.05);
      pose(dt, moved, m);
    },
    /** A shove (shove.rule.js): it is put back the whole push and stands; one swelling to go off is put off it. */
    shoveTargets() {
      if (!group || over) return [];
      return [{ id: 'middle-manager', x: walker.x, z: walker.z, y: env.world.floorY(walker.x, walker.z) + 1.3, r: Mg.r + 0.1, shove: (dir) => {
        const to = slide(walker, dir, (x0, z0, x1, z1) => c.walk.clear(walker, x0, z0, x1, z1));
        if (to) { walker.x = to.x; walker.z = to.z; }
        c.stall(SHOVE.stagger); s = off(s); c.play('creak', walker.x, walker.z, 10);
        return true;
      } }];
    },
    /** A jab (melee.js): it takes one and that is all it has (cast/health.rule.js, basic). It goes off there and then, on whoever jabbed it. */
    snipTargets() {
      if (!group || over) return [];
      return [{ id: 'middle-manager', x: walker.x, z: walker.z, y: env.world.floorY(walker.x, walker.z) + 1.3, r: Mg.r + 0.1, verticalReach: 1.6, priority: 2, snip: () => {
        if (!known) { known = true; c.met(); }
        s = popped(s); burst();
        c.struck(HEALTH.jab);          // (it has gone off whatever the count makes of it)
        return { ok: true, target: 'middle-manager' };
      } }];
    },
    /** For the dev page: stand it here, now (world coordinates), and as fed as `fat` says if it says. */
    put(x, z, fat) { if (!group || over) return false; walker.x = lastX = x; walker.z = lastZ = z; goal = null; leaving = false; if (Number.isFinite(fat)) s = { ...s, fat: Math.max(0, Math.min(1, fat)) }; pose(0, 0, c.me()); return true; },
    /** For the dev page's beside: stand this far off it and look this far aside (near, it goes off; in the eye, it comes). */
    apart: 5, aside: 0.7,
    at: () => ({ x: walker.x, z: walker.z, mode: s.mode, fat: +s.fat.toFixed(2), speed: +s.speed.toFixed(2) }),
    dispose() { group?.removeFromParent(); group = null; },
  };
}
