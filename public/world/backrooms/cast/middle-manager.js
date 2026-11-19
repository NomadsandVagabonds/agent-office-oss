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
import { MANAGER, CUT, fresh, minds, eyed, off, popped, cut, bloat, blastAt, reach, bend } from './middle-manager.rule.js';
import { SHOVE, slide } from '../shove.rule.js';
import { HEALTH } from './health.rule.js';
import { canLeave } from './paths.js';
import { calm as unafraid, afraid } from './fire.rule.js';
import { DOORWAY, at as doorwayAt, fresh as unkept, camps, elsewhere } from './doorway.rule.js';
import { makeMiddleManager, BODY } from './middle-manager.rig.js';          // (its body and how it is posed: the animation session's)

const PAPER = ['#f2efe6', '#e9e4d6', '#f6f3ec', '#d9d3c2', '#f2e9a6', '#dfe9f2'];

export function create(c) {
  const env = c.env, level = c.level, Mg = MANAGER;
  const walker = { x: 0, z: 0, r: Mg.r, tall: Mg.ducks, opens: false };
  let rig = null, hurtNow = Infinity, burstT = -1, s = fresh(), fear = unafraid(), group = null, mat = null, thin = null, full = null, neck = null, rawNeck = null, head = null, heads = [], limbs = [], shoes = [];
  let reel = 0, popped2 = false, extras = [], rot = 0, lean = 0, phase = 0, clock = 0, lastX = 0, lastZ = 0, known = false, over = false, wanderT = 0, goal = null, goalT = 0, leaving = false, kept = unkept(c.R), debris = null;
  const doors = new Map();
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
    rig = makeMiddleManager(env.kit); group = rig.group; mat = rig.mat;
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

  /** Stand it (the rig: cast/middle-manager.rig.js): where it is, and how it is — the rig folds it, swells it, faces it and reels it. */
  function pose(dt, moved, m) {
    group.position.set(walker.x, env.world.floorY(walker.x, walker.z), walker.z);
    rig.pose({ time: clock, speed: dt > 0 ? moved / dt : 0, fat: s.fat, swell: s.mode === 'swells' ? Math.min(1, s.swell / Mg.swells) : 0, mode: s.mode,
      lean: bend(above(), BODY), heading: rot, me: m, floorAt: (x, z) => env.world.floorY(x, z), hurt: hurtNow });
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
    // the body goes (the rig draws its going); what it was full of comes down over the room
    burstT = 0;
    debris = spill(at, fat);
    return { ended };
  }

  /** A burst of paper: torn sheets that fly out as far as it reached, and come down and lie there. */
  /** Things thrown out of it: { count, colours, size [w, h], far (metres they go), y (how high above the floor they start), up } — paper by default. */
  function spill(at, fat, o = {}) {
    const count = o.count ?? 40 + Math.round(fat * 60), floor = env.world.floorY(at.x, at.z), colours = o.colours ?? PAPER;
    const geom = new THREE.PlaneGeometry(...(o.size ?? [0.16, 0.2])), paper = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geom, paper, count), bits = [], col = new THREE.Color(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), mx = new THREE.Matrix4();
    const out = o.far ?? reach(fat) * 1.4, y0 = o.y ?? 1.6, up = o.up ?? 3;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random()) * out;
      bits.push({ x: at.x, y: floor + y0 + Math.random() * 0.6, z: at.z, vx: Math.sin(a) * sp, vy: 1 + Math.random() * up, vz: Math.cos(a) * sp, rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 18, down: false });
      mesh.setColorAt(i, col.set(colours[i % colours.length]));
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
    dies(progress, dt = 0) { if (dt > 0) { clock += dt; if (burstT >= 0) { burstT += dt; rig.burst(burstT / 0.6, clock); } if (debris) debris.tick(dt); for (const e of extras) e.tick(dt); } },
    /** Cut and standing (the conductor stands it for HEALTH.flinch): it reels up and back off its stoop, arms thrown out, and comes back. */
    flinch(hurt, dt = 0) {
      if (!group || over || hurt == null || !(hurt < HEALTH.flinch)) return;
      clock += dt; for (const e of extras) e.tick(dt);
      hurtNow = hurt; pose(dt, 0, c.me()); hurtNow = Infinity;
    },
    /** Finished, the paper lies where it came down. */
    fell() { return !!group; },
    update(dt) {
      if (!group) return;
      clock += dt;
      for (const e of extras) e.tick(dt);
      if (debris) { if (burstT >= 0) { burstT += dt; rig.burst(burstT / 0.6, clock); } debris.tick(dt); return; }
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
        if (s.swelling) { c.play('creak', walker.x, walker.z, 12); popped2 = false; }
        // a third of the way to going off, its buttons go: they fly off it and lie where they land
        if (s.mode === 'swells' && !popped2 && s.swell > Mg.swells * 0.35) { popped2 = true; c.play('click', walker.x, walker.z, 9); extras.push(spill({ x: walker.x + Math.sin(rot) * 0.3, z: walker.z + Math.cos(rot) * 0.3 }, s.fat, { count: 5, colours: ['#14120f', '#1d1a16'], size: [0.035, 0.035], far: 2.2, y: 1.3, up: 2 })); }
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
    /**
     * The extinguisher (extinguisher.rule.js): put off swelling, it stands in the white for the stop and the backing off
     * together (it does not back off: it stands its ground, as it does). What it has put on, it keeps.
     */
    doused(dose) {
      if (!group || over) return false;
      s = off(s); c.stall((dose?.stop || 0) + (dose?.back || 0)); c.play('creak', walker.x, walker.z, 10);
      return true;
    },
    /** A jab (melee.js): it takes two (cast/health.rule.js, medium). The first cuts it; the second sets it off there and then, on whoever jabbed it. */
    snipTargets() {
      if (!group || over) return [];
      return [{ id: 'middle-manager', x: walker.x, z: walker.z, y: env.world.floorY(walker.x, walker.z) + 1.3, r: Mg.r + 0.1, verticalReach: 1.6, priority: 2, snip: () => {
        if (!known) { known = true; c.met(); }
        // the last of it: it goes off there and then, on whoever jabbed it — before the count takes it, since once it is dying it lands nothing
        if ((c.vital?.hp ?? 1) <= HEALTH.jab) { s = popped(s); burst(); c.struck(HEALTH.jab); return { ok: true, target: 'middle-manager' }; }
        // not the last: it is cut. It reels, and a puff of what it is full of comes out of the cut, and some of what it had put on
        const hit = c.struck(HEALTH.jab); if (!hit.ok) return false;
        s = cut(s); if (!hit.killed) c.stall(HEALTH.flinch);
        c.play('shred', walker.x, walker.z, 10); c.play('creak', walker.x, walker.z, 10);
        extras.push(spill({ x: walker.x + Math.sin(rot) * 0.25, z: walker.z + Math.cos(rot) * 0.25 }, s.fat, { count: CUT.puff, far: 1.2, y: 1.5, up: 1.5 }));
        c.survived();
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
