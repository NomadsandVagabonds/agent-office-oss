// The Backrooms — the sticky notes. Four to six of them on the wall of one room, written on. Come near and they come off the
// wall and go round the room in the air; get close to one and it comes at your face, and if it gets there it is stuck on
// the lens (the hand's view draws it there: hand-notes.js) and costs the camcorder a little charge while it stays. A shove
// knocks one out of the air (a backhand: env.hand.swat), or wipes the lens (env.hand.wipe) if any are on it. A jab
// finishes one. Fire takes them. The rule is sticky-notes.rule.js.
//
// Each note is drawn by a stand-in here — a small square of paper, written on — until the animation session's
// cast/sticky-notes.model.js (makeStickyNote) is on live; pose() below has the same shape as its pose().
import * as THREE from 'three';
import { Vox, M } from '../../vox/vox.js';
import { Batch, lamp } from '../kit.js';
import { NOTES, onWall, noteStep, fallen, torn, drainOf, nextToPeel } from './sticky-notes.rule.js';
import { facing } from '../shove.rule.js';

const S = 0.017, SIZE = 8;                  // a note: 8 voxels of 1.7 cm, 13.6 cm a side — bigger than a real one, so it reads from across a room (the lead: at 8.5 cm it was a speck)
const COLOURS = ['#f2e27a', '#f3a7c4', '#9fd3ea', '#b9e39a', '#f6c26b'];

/** A note: a square of paper, its glued strip along the top, a few lines of somebody's writing. Front on +z; the top edge at y SIZE. */
function noteVox(colour, k) {
  const v = new Vox(), paper = M(colour, 0), glue = M(colour, 1), ink = M('#2a2f4a', 0);
  for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) v.set(x - SIZE / 2, y, 0, y >= SIZE - 2 ? glue : paper);
  for (let line = 0; line < 3; line++) { const y = SIZE - 3 - line * 2; for (let x = 1; x < SIZE - 1 - ((k + line) % 3); x++) if ((x * 7 + line * 3 + k) % 5 !== 0) v.set(x - SIZE / 2, y, 1, ink); }
  return v;
}

export function create(c) {
  const env = c.env, kit = env.kit, notes = [];
  let room = null, rect = null, floor = 0, peelT = 0, diveRest = 0, taken = 0, known = false, wipeAt = -1, clock = 0;
  const LIGHTS = [lamp(0.4, 2.6, 1.0, [1.1, 1.1, 1.05], { k: 9, wrap: 0.6, far: 30 })];

  function ready() {
    if (c.home === null || c.home === undefined) return;          // no room on this floor would do: they are not here
    room = env.world.rooms[c.home]; rect = room.rect; floor = env.world.floorY((rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2);
    const mat = kit.surface({ vox: true }), count = Math.round(c.R.range(NOTES.count[0], NOTES.count[1] + 0.999) - 0.499);
    const ways = c.walk.doorways((rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2).ways;
    for (let i = 0; i < count; i++) {
      // on a wall of the room, a hand's height, not by a doorway
      let spot = null;
      for (let k = 0; k < 30 && !spot; k++) {
        const side = c.R.int(0, 3), along = c.R.range(0.15, 0.85), y = floor + c.R.range(1.15, 1.75);
        const p = side === 0 ? { x: rect.x0 + (rect.x1 - rect.x0) * along, z: rect.z0 + 0.012, yaw: 0 } : side === 1 ? { x: rect.x0 + (rect.x1 - rect.x0) * along, z: rect.z1 - 0.012, yaw: Math.PI }
          : side === 2 ? { x: rect.x0 + 0.012, z: rect.z0 + (rect.z1 - rect.z0) * along, yaw: Math.PI / 2 } : { x: rect.x1 - 0.012, z: rect.z0 + (rect.z1 - rect.z0) * along, yaw: -Math.PI / 2 };
        if (ways.every((w) => Math.hypot(w.x - p.x, w.z - p.z) > 1.1) && notes.every((n) => Math.hypot(n.wall.x - p.x, n.wall.z - p.z) > 0.25)) spot = { ...p, y };
      }
      if (!spot) continue;
      const colour = COLOURS[c.R.int(0, COLOURS.length - 1)], b = new Batch(true);
      b.addVox(kit.model(`notes:${colour}:${i % 3}`, () => noteVox(colour, i % 3), { ao: false }).solid, new THREE.Matrix4().makeScale(S, S, S));
      const mesh = new THREE.Mesh(kit.geometry(b, LIGHTS, [0.5, 0.5, 0.5]), mat), group = new THREE.Group(); group.add(mesh); c.add(group);
      notes.push({ i, id: `note:${env.level.seed}:${env.level.depth ?? 0}:${i}`, colour, group, mesh, wall: spot, p: { x: spot.x, y: spot.y, z: spot.z }, goal: null, heading: spot.yaw, s: onWall(), fallV: 0, mat, stuckFor: c.R.range(NOTES.stuckFor[0], NOTES.stuckFor[1]) });
    }
    for (const n of notes) pose(n, 0);
  }

  /** Where the lens is: the visitor's eye. */
  const lens = (m) => ({ x: m.x, y: Number.isFinite(m.y) ? m.y : env.world.floorY(m.x, m.z) + 1.1, z: m.z });          // (me.y is the camera's own height: player.js)

  /** Draw one: where it is and how it is (the same shape as makeStickyNote's pose({ mode, t, time, heading })). */
  function pose(n, dt) {
    const g = n.group, s = n.s, t = clock + n.i * 1.37;
    g.visible = s.mode !== 'lens' && s.mode !== 'gone' && c.drawn(n.p);
    g.position.set(n.p.x, n.p.y, n.p.z);
    if (s.mode === 'wall') { g.rotation.set(Math.sin(t * 0.7) * 0.03, n.wall.yaw, 0); n.mesh.position.set(0, -SIZE * S, 0); return; }
    if (s.mode === 'peel') { const k = Math.min(1, s.t / NOTES.peel); g.rotation.set(-k * 1.1, n.wall.yaw, 0); n.mesh.position.set(0, -SIZE * S, 0); return; }
    if (s.mode === 'down' || s.mode === 'spent') { g.rotation.set(-Math.PI / 2, n.heading, 0); n.mesh.position.set(0, -SIZE * S / 2, 0); return; }
    // in the air: it flaps along its edge and twists as it goes; coming at you, it holds flat and comes edge on
    const flap = s.mode === 'dive' ? 0.15 : Math.sin(t * 11) * 0.7, twist = s.mode === 'dive' ? 0 : Math.sin(t * 2.3) * 0.5;
    g.rotation.set(-0.9 + flap, n.heading, twist); n.mesh.position.set(0, -SIZE * S / 2, 0);
  }

  /** Somewhere to go next, going round: about NOTES.round round the visitor if they are in the room, anywhere in it if not. */
  function goal(n) {
    const I = NOTES.inset, m = c.me(), clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), y = floor + c.R.range(NOTES.low, NOTES.high);
    if (c.room(m.x, m.z) === c.home) { const a = c.R.range(0, Math.PI * 2), r = NOTES.round * c.R.range(0.6, 1.2); return { x: clamp(m.x + Math.cos(a) * r, rect.x0 + I, rect.x1 - I), y, z: clamp(m.z + Math.sin(a) * r, rect.z0 + I, rect.z1 - I) }; }
    return { x: c.R.range(rect.x0 + I, rect.x1 - I), y, z: c.R.range(rect.z0 + I, rect.z1 - I) };
  }
  const inside = (x, z) => x > rect.x0 + 0.2 && x < rect.x1 - 0.2 && z > rect.z0 + 0.2 && z < rect.z1 - 0.2;

  /** Off the lens, how it went; down in front of the visitor. */
  function offLens(n, how, dir = 0) {
    env.hand?.unstick?.(n.id, how, dir);
    const m = c.me(), f = facing(m.yaw), side = { x: -f.z, z: f.x };
    n.p = { x: m.x + f.x * 0.5 + side.x * dir * 0.4, y: env.world.floorY(m.x, m.z) + 1.2, z: m.z + f.z * 0.5 + side.z * dir * 0.4 };
    if (!inside(n.p.x, n.p.z)) n.p = { x: Math.max(rect.x0 + 0.3, Math.min(rect.x1 - 0.3, n.p.x)), y: n.p.y, z: Math.max(rect.z0 + 0.3, Math.min(rect.z1 - 0.3, n.p.z)) };
    n.s = fallen(n.s); n.fallV = 0;
  }

  return {
    ready,
    update(dt) {
      if (!room || !notes.length) return;
      clock += dt; diveRest = Math.max(0, diveRest - dt); peelT = Math.max(0, peelT - dt);
      const m = c.me(), L = lens(m), here = c.room(m.x, m.z) === c.home;
      // the wipe takes them as the hand crosses the middle of the picture (hand-moves.rule.js: 0.12 s into its 0.42)
      if (wipeAt >= 0) { wipeAt -= dt; if (wipeAt < 0) for (const n of notes) if (n.s.mode === 'lens') offLens(n, 'wiped'); }
      // (the next to come off: of those still on the wall, the nearest to the visitor — one at a time)
      const diving = notes.some((n) => n.s.mode === 'dive'), next = nextToPeel(notes.map((n) => n.s), notes.map((n) => Math.hypot(m.x - n.p.x, m.z - n.p.z)));
      let stuck = 0;
      for (const n of notes) {
        const d = Math.hypot(m.x - n.p.x, m.z - n.p.z), f = c.fire(n.p.x, n.p.z), fd = f ? Math.hypot(f.x - n.p.x, f.z - n.p.z) : Infinity;
        const lensD = Math.hypot(L.x - n.p.x, L.y - n.p.y, L.z - n.p.z);
        const was = n.s.mode;
        n.s = noteStep(n.s, dt, { d, here, wake: notes.indexOf(n) === next && peelT <= 0, swarm: notes.some((k) => k.s.mode !== 'wall'), dive: !diving && diveRest <= 0, lens: lensD, fire: fd, stuckFor: n.stuckFor });
        if (n.s.mode === 'peel' && was === 'wall') { peelT = NOTES.stagger; c.play('rustle', n.p.x, n.p.z, 6); if (!known && !c.hidden(n.p.x, n.p.z, 0.3)) { known = true; c.met(); } }
        if (n.s.peeled) { n.goal = goal(n); n.p = { x: n.p.x + Math.sin(n.wall.yaw) * 0.3, y: n.p.y - SIZE * S / 2, z: n.p.z + Math.cos(n.wall.yaw) * 0.3 }; }
        if (n.s.dove) c.play('rustle', n.p.x, n.p.z, 7);
        if (n.s.stuck) {
          // on the lens: the hand's view has it now, somewhere on the picture, at a slant
          env.hand?.stick?.(n.id, { u: c.R.range(-0.7, 0.7), v: c.R.range(-0.55, 0.55), turn: c.R.range(-0.5, 0.5), colour: n.colour });
          c.play('squish', L.x, L.z, 3); diveRest = NOTES.rest; c.survived();
        }
        if (n.s.mode === 'flutter' && was === 'dive') diveRest = NOTES.rest;
        if (n.s.fell && was === 'lens') offLens(n, 'fell');
        if (n.s.burnt) c.play('crack', n.p.x, n.p.z, 6);
        // moving it
        if (n.s.mode === 'flutter') {
          if (!n.goal || Math.hypot(n.goal.x - n.p.x, n.goal.z - n.p.z) < 0.3) n.goal = goal(n);
          // (away from a fire, if there is one near: they are paper)
          let gx = n.goal.x, gz = n.goal.z; if (fd < NOTES.fear) { gx = n.p.x + (n.p.x - f.x); gz = n.p.z + (n.p.z - f.z); }
          const dx = gx - n.p.x, dy = n.goal.y - n.p.y + Math.sin(clock * 3 + n.i) * 0.3, dz = gz - n.p.z, dd = Math.hypot(dx, dy, dz) || 1, step = NOTES.flies * dt;
          const nx = n.p.x + dx / dd * step, nz = n.p.z + dz / dd * step;
          // (it may always come back in off a wall; it may not go out to one)
          if (inside(nx, nz) || !inside(n.p.x, n.p.z)) { n.p.x = nx; n.p.z = nz; } else n.goal = goal(n);
          n.p.y += dy / dd * step; n.heading += Math.atan2(Math.sin(Math.atan2(dx, dz) - n.heading), Math.cos(Math.atan2(dx, dz) - n.heading)) * Math.min(1, dt * 3);
        } else if (n.s.mode === 'dive') {
          const dx = L.x - n.p.x, dy = L.y - n.p.y, dz = L.z - n.p.z, dd = Math.hypot(dx, dy, dz) || 1, step = Math.min(dd, NOTES.diveSpeed * dt);
          n.p.x += dx / dd * step; n.p.y += dy / dd * step; n.p.z += dz / dd * step; n.heading = Math.atan2(dx, dz);
        } else if (n.s.mode === 'down' || n.s.mode === 'spent') {
          // falling, then lying
          const g = env.world.floorY(n.p.x, n.p.z) + 0.004; if (n.p.y > g) { n.fallV += 4 * dt; n.p.y = Math.max(g, n.p.y - n.fallV * dt); }
        }
        if (n.s.mode === 'lens') stuck++;
        pose(n, dt);
        const Lt = c.light(n.p.x, n.p.z, 1.4); n.mat.uniforms.uTint.value.set(Lt[0] * 1.5 + 0.1, Lt[1] * 1.5 + 0.1, Lt[2] * 1.5 + 0.1);
      }
      // stuck, they cost a little charge: never much, never the last of it (sticky-notes.rule.js drainOf)
      const cam = env.camera?.read?.();
      if (stuck && cam && cam.capacity > 0 && cam.remaining > 0) {
        const take = drainOf(stuck, dt, cam.remaining / cam.capacity, taken);
        if (take > 0) { const share = Math.min(1, (take * cam.capacity) / cam.remaining); if (c.drain(share)?.ok) taken += take; }
      }
    },
    /** A jab (melee.js): one note out of the air, finished (cast/health.rule.js: basic). */
    snipTargets() {
      if (!room) return [];
      return notes.filter((n) => n.s.mode === 'flutter' || n.s.mode === 'dive' || n.s.mode === 'peel').map((n) => ({ id: 'sticky-notes', x: n.p.x, z: n.p.z, y: n.p.y, r: 0.16, verticalReach: 1.6, priority: 1, snip: () => {
        if (!(n.s.mode === 'flutter' || n.s.mode === 'dive' || n.s.mode === 'peel')) return false;
        n.s = torn(n.s); n.fallV = 0; c.play('shred', n.p.x, n.p.z, 6); if (!known) { known = true; c.met(); }
        return { ok: true, target: 'sticky-notes' };
      } }));
    },
    /**
     * A shove (shove.rule.js). With any on the lens, the hand wipes them off instead of pushing (env.hand.wipe: it takes the
     * place of the two hands). Otherwise, one in the air in front is knocked out of it with a backhand (env.hand.swat).
     */
    shoveTargets() {
      if (!room) return [];
      const m = c.me(), f = facing(m.yaw), out = [];
      if (notes.some((n) => n.s.mode === 'lens') && wipeAt < 0)
        out.push({ id: 'sticky-notes', x: m.x + f.x * 0.3, z: m.z + f.z * 0.3, y: lens(m).y, r: 0.3, shove: () => { env.hand?.wipe?.(); c.play('rustle', m.x, m.z, 4); wipeAt = 0.12; return true; } });
      for (const n of notes) if (n.s.mode === 'flutter' || n.s.mode === 'dive') out.push({ id: 'sticky-notes', x: n.p.x, z: n.p.z, y: n.p.y, r: 0.2, shove: () => {
        if (!(n.s.mode === 'flutter' || n.s.mode === 'dive')) return false;
        // which side of the picture it is on, for the backhand
        const dx = n.p.x - m.x, dz = n.p.z - m.z, side = Math.sign(-f.z * dx + f.x * dz) || 1;
        if (wipeAt < 0) env.hand?.swat?.(side);
        n.s = fallen(n.s); n.fallV = 0; n.heading += side; c.play('rustle', n.p.x, n.p.z, 6);
        return true;
      } });
      return out;
    },
    // (where they are: the first still on its wall — so the dev page's beside stands you within peeling reach of one, facing it —
    // or, once none is, the middle of their room)
    at: () => { if (!room) return { x: null, z: null }; const w = notes.find((n) => n.s.mode === 'wall'), p = w ? { x: w.wall.x + Math.sin(w.wall.yaw) * 0.05, z: w.wall.z + Math.cos(w.wall.yaw) * 0.05 } : { x: (rect.x0 + rect.x1) / 2, z: (rect.z0 + rect.z1) / 2 }; return { ...p, notes: notes.map((n) => n.s.mode), taken: +taken.toFixed(4) }; },
    /** For the dev page's beside: stand two metres off the note, in the room, facing it. */
    apart: 2,
    /** For the dev page: one of them, now, where it is ({ x, y, z }, mode) — and wake them all. */
    notes: () => notes.map((n) => ({ ...n.p, mode: n.s.mode })),
    wake() { for (const n of notes) if (n.s.mode === 'wall') n.s = { ...n.s, mode: 'peel', t: 0 }; },
    dispose() { for (const n of notes) { n.group.removeFromParent(); if (n.s.mode === 'lens') env.hand?.unstick?.(n.id, 'fell'); } },
  };
}
