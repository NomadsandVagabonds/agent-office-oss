// The Backrooms — the dummies: the shopping centre's own (themes.js `mall`). Come back into a room you have been in, and one more
// of them is stood where you stood when you left it, as you stood, facing the way you went. They do not move. A room you keep going
// through fills up; and where you have to go between two of them, they have you. (Their rule: cast/dummies.rule.js.)
//
// It comes with the kind of floor, not with a room (cast.js `withTheme`). It keeps its own record of where the visitor has been in
// each room of the floor (the host only, in a shared visit). Each one put down is a body (c.body), so the others go round them; none
// is put where a doorway is, and a room holds six. A shove rocks one back a step, and it stays where it was pushed to.
import * as THREE from 'three';
import { Batch, lamp } from '../kit.js';
import { toLocal, toWorld, wallPoint } from '../gen.js';
import { slide } from '../shove.rule.js';
import { DUMMIES, blank, leftFrom, cameBack, squeezed, mayRest } from './dummies.rule.js';
import { S, dummyVox } from './dummies.model.js';

export function create(c) {
  const { env, level } = c, K = DUMMIES, kit = env.kit;
  let s = blank(), here = null, trail = [], clock = 0, mat = null, geo = { up: [], low: [] }, met = false, over = false;
  const left = new Map(), stood = [];                                     // room id → where they stood when they last left it · what is standing
  const roomInfo = new Map();
  // the room as the rule needs it: its size, its doorways, and what of its own is solid (asked each time: a door shut or furniture moved)
  const info = (id) => { const def = level.rooms[id], rt = env.world.rooms[id];
    if (!roomInfo.has(id)) roomInfo.set(id, { W: def.W, D: def.D, doors: def.doors.map((d) => { const p = wallPoint(def, d.side, d.c, 0); return { x: p.x, z: p.z }; }) });   // (wallPoint is in the room's own frame already)
    const blocks = (rt?.colliders || []).filter((k) => k.on !== false && !k.floor).map((k) => { const a = toLocal(def, k.x0, k.z0), b = toLocal(def, k.x1, k.z1); return { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) }; });
    return { ...roomInfo.get(id), blocks }; };

  function ready() {
    mat = kit.surface({ vox: true });
    const m4 = new THREE.Matrix4().makeScale(S, S, S), lights = [lamp(0.3, 2.6, 0.8, [1.2, 1.2, 1.2], { k: 9, wrap: 0.45, far: 30 })];
    for (let n = 0; n < 4; n++) for (const crouch of [false, true]) { const b = new Batch(true); b.addVox(kit.model('dummies:' + (crouch ? 'low' : 'up') + ':' + n, dummyVox(crouch, n)).solid, m4); (crouch ? geo.low : geo.up).push(kit.geometry(b, lights, [0.6, 0.6, 0.6])); }
  }
  /** Stand one: where they stood, as they stood. */
  function put(p) {
    const def = level.rooms[p.room], w = toWorld(def, p.x, p.z), mesh = new THREE.Mesh((p.crouch ? geo.low : geo.up)[p.n % 4], mat);
    const yaw = p.yaw + (def.rot || 0) * Math.PI / 2;
    mesh.position.set(w.x, env.world.floorY(w.x, w.z), w.z); mesh.rotation.y = yaw; c.add(mesh);
    const body = c.body({ x: w.x, z: w.z, r: 0.24 });
    const one = { p, mesh, body, x: w.x, z: w.z, rock: 0 };
    stood.push(one);
    const L = c.light(w.x, w.z, 1.2); mat.uniforms.uTint.value.set(L[0] * 1.5 + 0.05, L[1] * 1.5 + 0.05, L[2] * 1.5 + 0.05);
    return one;
  }

  return {
    ready,
    update(dt) {
      if (!mat || over) return;
      clock += dt;
      const m = c.me(), id = c.room(m.x, m.z), def = id == null ? null : level.rooms[id];
      // where they are in the room they are in, as they go: kept a step at a time
      if (def && id === here) {
        const q = toLocal(def, m.x, m.z), last = trail[trail.length - 1];
        if (!last || Math.hypot(q.x - last.x, q.z - last.z) > 0.25) { trail.push({ x: q.x, z: q.z, yaw: m.yaw - (def.rot || 0) * Math.PI / 2, crouch: (m.sink ?? 0) > 0.25 }); if (trail.length > 40) trail.shift(); }
      }
      // a room left, and another come into
      if (id !== here) {
        if (here != null) left.set(here, leftFrom(trail));
        if (id != null) { const r = cameBack(s, id, info(id), left.get(id)); s = r.s; if (r.stood) { put(r.stood); const w = toWorld(def, r.stood.x, r.stood.z); c.play('creak', w.x, w.z, 8); } }
        here = id; trail = [];
      }
      // between two of them, close: they have you
      if (def && stood.length > 1) {
        const q = toLocal(def, m.x, m.z), r = squeezed(s, id, q.x, q.z, clock); s = r.s;
        if (r.hit) {
          const a = stood.find((o) => o.p === s.placed[r.hit[0]]), b = stood.find((o) => o.p === s.placed[r.hit[1]]);
          const got = c.hurt(K.hurt, a ? { x: (a.x + (b?.x ?? a.x)) / 2, z: (a.z + (b?.z ?? a.z)) / 2 } : undefined);
          if (got && !got.blocked) { env.interfere(0.8); env.hud?.glitch?.(0.4); for (const o of [a, b]) if (o) o.rock = 0.6; if (a) c.play('thunk', a.x, a.z, 8); if (got.dead || got.ended) over = true; }
        }
      }
      // the first time one is really seen
      if (!met) for (const o of stood) if (Math.hypot(o.x - m.x, o.z - m.z) < 6 && !c.hidden(o.x, o.z, 0.5) && c.los(m.x, m.z, o.x, o.z)) { met = true; c.met(); break; }
      for (const o of stood) if (o.rock > 0) { o.rock = Math.max(0, o.rock - dt); o.mesh.rotation.z = Math.sin(o.rock * 30) * o.rock * 0.12; }
    },
    at: () => ({ x: stood[stood.length - 1]?.x ?? null, z: stood[stood.length - 1]?.z ?? null, standing: stood.length, rooms: s.rooms.size }),
    films(shot) {
      const near = stood.filter((o) => Math.hypot(o.x - shot.x, o.z - shot.z) < 3).slice(0, 2); if (!near.length) return null;
      const mx = near.reduce((a, o) => a + o.x, 0) / near.length, mz = near.reduce((a, o) => a + o.z, 0) / near.length;
      return { x: mx + (mx - shot.x) * 0.8 + 0.3, y: shot.y + 0.4, z: mz + (mz - shot.z) * 0.8 + 0.3, at: { x: shot.x, y: shot.y, z: shot.z } };
    },
    shoveTargets() {
      if (over) return [];
      return stood.map((o) => ({ id: 'dummies', x: o.x, z: o.z, y: env.world.floorY(o.x, o.z) + 0.9, r: 0.24, shove: (dir) => {
        const end = slide(o, dir, (x0, z0, x1, z1) => c.walk.clear({ x: o.x, z: o.z, r: 0.24, tall: 1.7 }, x0, z0, x1, z1));
        // (it comes to rest only where one may be stood: dummies.rule.js mayRest. Not there: as far along as it may, or not at all)
        const def = level.rooms[o.p.room], room = info(o.p.room), mine = s.placed.filter((p) => p.room === o.p.room);
        let to = null;
        if (end) for (const f of [1, 0.75, 0.5, 0.25]) { const x = o.x + (end.x - o.x) * f, z = o.z + (end.z - o.z) * f, q = toLocal(def, x, z); if (mayRest(room, mine, o.p, q.x, q.z)) { to = { x, z }; break; } }
        if (to) { o.x = to.x; o.z = to.z; o.body.x = to.x; o.body.z = to.z; o.mesh.position.x = to.x; o.mesh.position.z = to.z; const q = toLocal(def, to.x, to.z); o.p.x = q.x; o.p.z = q.z; }
        o.rock = 0.8; c.play('creak', o.x, o.z, 8); return true; } }));
    },
    dispose() { for (const o of stood) { o.mesh.removeFromParent(); const i = env.world.bodies.indexOf(o.body); if (i >= 0) env.world.bodies.splice(i, 1); } },
  };
}
