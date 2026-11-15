// The Backrooms — the other door. A pair of fire doors, shut, where the plan
// has no doorway: the same leaves, the same plates, the same sign as every
// pair on the floor (doorleaf.js), in the floor's own door colour. Now and
// then it shivers. That is all there is to know it by.
//
// Try it, walk into it, or stand in front of it too long, and it is an
// opening with nothing in it and arms coming out. The rule is mimics(), in
// mimic.rule.js; this file is what it looks like and what it does to you.
import * as THREE from 'three';
import { toWorld, wallPoint, wallSpans } from '../gen.js';
import { Batch, lin } from '../kit.js';
import { turnTo } from '../bits.js';
import { DOORS, doorTint } from '../doors.js';
import { TINTS, SIGN, slab, leafTexture } from '../doorleaf.js';
import { CAST } from '../cast.js';
import { HUNTER_NEAR } from '../absorbed/rule.js';
import { MIMIC, shut, mimics, let_, took, holds, open, mimicSpots } from './mimic.rule.js';

const ARMS = 7, LINKS = 11;
/** The others that hunt: while one of them is near and in sight, nothing of this turns the visitor's head (as the absorbed staff). */
const OTHERS = CAST.filter((m) => m.disposition === 'hunts' && m.id !== 'mimic').map((m) => m.id);

export function create(c) {
  const env = c.env, level = env.level, kit = env.kit, R = c.R;
  let s = shut(), door = null, used = false, known = false, reach = 0, clock = 0;

  /** Find it a wall in its room, and hang it there. Nowhere that will do: it is not on this part. */
  function ready() {
    if (c.home === null || c.home === undefined) return;
    const rt = env.world.rooms[c.home], def = rt && rt.def;
    if (!def) return;
    const spans = {};
    for (const side of ['back', 'front', 'left', 'right']) spans[side] = wallSpans(def, side, 0.45, MIMIC.h + 0.15);
    for (const spot of mimicSpots(spans, R)) {
      const C = wallPoint(def, spot.side, spot.at, 0), N = wallPoint(def, spot.side, spot.at, 1), A = wallPoint(def, spot.side, spot.at + 1, 0);
      const n = [N.x - C.x, N.z - C.z], U = [A.x - C.x, A.z - C.z];
      const at = (across, out) => [C.x + U[0] * across + n[0] * out, C.z + U[1] * across + n[1] * out];
      // floor to stand on in front of it, and nothing leaning on that bit of wall
      let clear = true;
      for (let a = -MIMIC.w / 2; a <= MIMIC.w / 2 + 1e-6 && clear; a += 0.3) for (const o of [0.3, 0.7, 1.1]) {
        const p = at(a, o), w = toWorld(def, p[0], p[1]);
        if (env.world.roomAt(w.x, w.z) !== rt || !env.world.free(w.x, w.z, 0.2)) { clear = false; break; }
      }
      if (!clear) continue;
      hang(rt, at, n, U);
      return;
    }
  }

  function hang(rt, at, n, U) {
    const def = rt.def, half = MIMIC.w / 2, h = MIMIC.h - 0.015, T0 = 0.004, T1 = T0 + DOORS.thick * 0.5;
    const rgb = lin(TINTS[doorTint(level) % TINTS.length]), steel = [0.52, 0.53, 0.52], tex = leafTexture(kit);
    const holder = new THREE.Group(), leaves = [];
    rt.group.add(holder);
    for (const side of [-1, 1]) {
      const b = new Batch();
      const box = (a0, a1, o0, o1, y0, y1, col) => { const p = at(a0, o0), q = at(a1, o1); slab(b, Math.min(p[0], q[0]), y0, Math.min(p[1], q[1]), Math.max(p[0], q[0]), y1, Math.max(p[1], q[1]), col); };
      const j = side * (half - 0.012), m = side * 0.004;                 // from its jamb to where the two meet
      box(j, m, T0, T1, 0.012, h, rgb);
      box(j - side * 0.02, m + side * 0.02, T1, T1 + 0.004, 0.02, 0.26, steel);                                  // the kick plate
      box(m + side * 0.08, m + side * 0.2, T1, T1 + 0.004, 1.0, 1.32, steel);                                    // the plate you push
      const mid = (j + m) / 2, p0 = at(mid - 0.16, T1 + 0.003), p1 = at(mid + 0.16, T1 + 0.003);                 // the sign, at eye level
      b.quad([p0[0], 1.36, p0[1]], [p1[0], 1.36, p1[1]], [p1[0], 1.68, p1[1]], [p0[0], 1.68, p0[1]], [1, 1, 1], SIGN);
      const geo = kit.geometry(b, rt.lights, rt.amb), mesh = new THREE.Mesh(geo, kit.surface({ map: tex, room: rt.u, flick: geo.userData.flick, side: THREE.DoubleSide }));
      holder.add(mesh); leaves.push(mesh);
    }
    // the frame it hangs in: the room's own trim, as round any pair
    const fb = new Batch(), trim = lin(def.look.trim).map((v) => v * 0.8);
    const fbox = (a0, a1, y0, y1) => { const p = at(a0, 0), q = at(a1, 0.028); fb.box(Math.min(p[0], q[0]), y0, Math.min(p[1], q[1]), Math.max(p[0], q[0]), y1, Math.max(p[1], q[1]), trim, { skip: '-y' }); };
    for (const side of [-1, 1]) fbox(side * (half + 0.005), side * (half + 0.07), 0, MIMIC.h + 0.07);
    fbox(-half - 0.07, half + 0.07, MIMIC.h, MIMIC.h + 0.07);
    const fgeo = kit.geometry(fb, rt.lights, rt.amb), frame = new THREE.Mesh(fgeo, kit.surface({ map: kit.tex.white(), room: rt.u, flick: fgeo.userData.flick }));
    rt.group.add(frame);
    // what is behind the leaves: nothing. A black that takes no light, the size of the opening
    const black = kit.own(new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
    const hole = new THREE.Mesh(kit.own(new THREE.PlaneGeometry(MIMIC.w - 0.02, MIMIC.h - 0.01)), black);
    const hp = at(0, 0.006); hole.position.set(hp[0], MIMIC.h / 2, hp[1]); hole.rotation.y = Math.atan2(n[0], n[1]); hole.visible = false;
    rt.group.add(hole);

    // in the world's own frame: where it is, which way it faces, and along it
    const cw = toWorld(def, ...at(0, 0)), nw = toWorld(def, ...at(0, 1)), uw = toWorld(def, ...at(1, 0));
    const nx = nw.x - cw.x, nz = nw.z - cw.z, ux = uw.x - cw.x, uz = uw.z - cw.z, y0 = env.world.floorY(cw.x + nx * 0.5, cw.z + nz * 0.5);
    // its arms: links of the same black, each a little out of true with the last
    const arms = new THREE.Group(), cube = kit.own(new THREE.BoxGeometry(1, 1, 1));
    const grey = kit.own(new THREE.MeshBasicMaterial({ color: 0x1b1b1f }));
    const links = [];
    for (let i = 0; i < ARMS; i++) {
      const arm = { across: (i / (ARMS - 1) - 0.5) * (MIMIC.w - 0.5), up: 0.5 + ((i * 5) % ARMS) / ARMS * 1.2, phase: i * 1.7, late: (i % 3) * 0.08, cubes: [] };
      for (let k = 0; k < LINKS; k++) { const m = new THREE.Mesh(cube, (i + k) % 5 === 0 ? grey : black); arms.add(m); arm.cubes.push(m); }
      links.push(arm);
    }
    arms.visible = false; c.add(arms);

    door = { rt, holder, leaves, frame, hole, arms, links, x: cw.x, z: cw.z, nx, nz, ux, uz, y0, Ul: U, still: true,
      where: (x, z) => ({ across: (x - cw.x) * ux + (z - cw.z) * uz, out: (x - cw.x) * nx + (z - cw.z) * nz }),
      point: (across, out) => ({ x: cw.x + ux * across + nx * out, z: cw.z + uz * across + nz * out }) };
    // E, as on any pair: half a metre in front of it
    const e = door.point(0, 0.55);
    c.use({ x: e.x, z: e.z, r: 1.3, label: 'the doors', when: () => s.mode === 'door', use: () => { used = true; } });
  }

  /** Is one of the others that hunt near the visitor, with nothing between them? */
  function hunted(me) {
    for (const id of OTHERS) {
      const at = env.pursuer?.of?.(id)?.at?.();
      if (at && Number.isFinite(at.x) && Number.isFinite(at.z) && Math.hypot(at.x - me.x, at.z - me.z) <= HUNTER_NEAR && c.los(me.x, me.z, at.x, at.z)) return true;
    }
    return false;
  }

  function draw(me, dt) {
    const d = door, shown = open(s);
    for (const leaf of d.leaves) leaf.visible = !shown;
    d.hole.visible = shown;
    // the tell: the pair out of register with itself, for a frame or two
    if (!shown && s.tremor > 0) {
      // (a few centimetres: the whole pair jumps, and one leaf slides along the wall out of line with the other)
      const k = s.tremor * 0.03, torn = d.leaves[Math.random() < 0.5 ? 0 : 1], slip = (Math.random() - 0.5) * k * 2.2;
      d.holder.position.set((Math.random() - 0.5) * k * 0.5, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k * 0.5);
      for (const leaf of d.leaves) leaf.position.set(0, (Math.random() - 0.5) * k, 0);
      torn.position.x = d.Ul[0] * slip; torn.position.z = d.Ul[1] * slip;
      torn.visible = Math.random() > 0.3 * s.tremor;
      d.still = false;
    } else if (!d.still) {
      d.holder.position.set(0, 0, 0); for (const leaf of d.leaves) leaf.position.set(0, 0, 0);
      d.still = true;
    }
    // its arms: out to whoever it has, and back in when it lets go
    const want = s.mode === 'opening' ? Math.min(1, s.t / MIMIC.opens) : holds(s) ? 1 : s.mode === 'letting' ? 1 - Math.min(1, s.t / MIMIC.lets) : 0;
    reach += (want - reach) * (1 - Math.exp(-18 * dt));
    d.arms.visible = reach > 0.02 && c.drawn({ x: d.x, z: d.z });
    if (!d.arms.visible) return;
    const eye = d.y0 + 1.0;
    for (const arm of d.links) {
      const from = d.point(arm.across, 0.02), r = Math.max(0, Math.min(1, reach * 1.15 - arm.late));
      const tx = me.x + d.ux * arm.across * 0.18, tz = me.z + d.uz * arm.across * 0.18, ty = eye + (arm.up - 1.1) * 0.5;
      for (let k = 0; k < LINKS; k++) {
        const t = ((k + 1) / LINKS) * r, sag = Math.sin(t * Math.PI) * 0.22, wave = Math.sin(clock * 9 + arm.phase + k * 0.8) * 0.05 * (1 - t * 0.5);
        const jx = (Math.random() < 0.12 ? (Math.random() - 0.5) * 0.09 : 0), jy = (Math.random() < 0.12 ? (Math.random() - 0.5) * 0.09 : 0);
        const x = from.x + (tx - from.x) * t + d.ux * wave + jx, z = from.z + (tz - from.z) * t + d.uz * wave;
        const y = d.y0 + arm.up + (ty - d.y0 - arm.up) * t - sag + wave + jy;
        const m = arm.cubes[k], size = 0.11 - 0.055 * (k / LINKS);
        // (in voxels: every link snapped to the same grid as everything else down here)
        m.position.set(Math.round(x / 0.03) * 0.03, Math.round(y / 0.03) * 0.03, Math.round(z / 0.03) * 0.03);
        m.scale.setScalar(size); m.visible = r > 0.02 && Math.random() > 0.04;
      }
    }
  }

  return {
    ready,
    update(dt) {
      if (!door) return;
      const me = c.me(), d = door, w = d.where(me.x, me.z), inRoom = c.room(me.x, me.z) === d.rt.id, dist = Math.hypot(me.x - d.x, me.z - d.z);
      clock += dt;
      const speed = Math.hypot(me.vx || 0, me.vz || 0), toward = speed > 0.05 ? -((me.vx * d.nx + me.vz * d.nz) / speed) : 0;
      const front = d.point(0, 0.6), burning = s.mode === 'door' ? c.fire(front.x, front.z) : null;
      const fire = !!burning && Math.hypot(burning.x - front.x, burning.z - front.z) <= MIMIC.fire;
      s = mimics(s, dt, { out: inRoom ? w.out : -1, across: w.across, d: inRoom || c.los(me.x, me.z, front.x, front.z) ? dist : Infinity,
        moving: !!me.moving && !me.frozen, toward, used: used && inRoom, fire, rnd: Math.random() });
      used = false;
      const seen = !c.hidden(front.x, front.z, 0.4) && dist < 9;
      if (!known && ((s.shook && seen) || s.sprung)) { known = true; c.met(); }
      if (s.sprung) { c.play('crack', d.x, d.z, 12); env.sound?.play?.('static', { dur: 0.5, vol: 0.8 }); env.interfere(0.9); env.hud?.glitch?.(0.5); }
      if (s.mode === 'opening' || holds(s)) {
        // it has them: they are going nowhere, and they are brought up to it
        me.slow = Math.min(me.slow, 0.1); me.vx *= Math.exp(-15 * dt); me.vz *= Math.exp(-15 * dt);
        const to = d.point(Math.max(-0.5, Math.min(0.5, w.across)), s.mode === 'taking' ? 0.12 : 0.8), k = 1 - Math.exp(-(s.mode === 'taking' ? 5 : 3.2) * dt);
        const x = me.x + (to.x - me.x) * k, z = me.z + (to.z - me.z) * k;
        if (s.mode === 'taking' || env.world.free(x, z, 0.22)) { me.x = x; me.z = z; }
        if (s.mode === 'taking' || !hunted(me)) me.yaw += turnTo(me.yaw, Math.atan2(-(d.x - me.x), -(d.z - me.z))) * (1 - Math.exp(-6 * dt));
        env.interfere(s.mode === 'taking' ? 1 : 0.35);
      }
      if (s.strike) {
        c.play('thunk', d.x, d.z, 10);
        const hit = c.hurt(MIMIC.hurts);
        if (hit.ended) s = took(s);
        else { s = let_(s); if (hit.landed) { env.hud?.glitch?.(0.6); c.survived(); } }
      }
      draw(me, dt);
    },
    /** Where it is and what it is being (for the dev page, and for whoever keeps clear of the cast). */
    at: () => (door ? { x: door.x, z: door.z, room: door.rt.id, mode: s.mode, front: +s.front.toFixed(2) } : { room: null }),
    /** For the dev page and the tests of the level in a browser: its frame, and a way to try it. */
    get door() { return door; },
    try() { used = true; },
    dispose() { if (door) { door.arms.removeFromParent(); door.holder.removeFromParent(); door.frame.removeFromParent(); door.hole.removeFromParent(); } door = null; },
  };
}
