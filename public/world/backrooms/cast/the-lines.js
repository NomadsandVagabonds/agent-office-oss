// The Backrooms — the lines: flesh, slung between six telephone poles it walks
// on. It belongs to the gap (rooms/the-culvert.js: the strip of lawn that was
// never drawn) and is in a part only when that room is. It sleeps as a stand
// of poles a few rooms before it, on the way there from the landing; woken,
// it follows, and does not lose whoever woke it. In a room with the height
// for it, it walks stood up. Through a doorway, down a passage, under a low
// ceiling, it folds: its poles laid forward past its body like a bundle, and
// the body dragging after them. It is slower like that.
//
// It walks only where there is floor (cast/walk.js), so the gap stops it, and
// a hoarding laid across the gap does not. It has no body in the way of
// anything (c.body), on purpose: a hoarding can be taken up with it on it,
// and then there is nothing under it. Its rule: cast/the-lines.rule.js.
import * as THREE from 'three';
import { Batch, lamp } from '../kit.js';
import { roomRoute } from './paths.js';
import { LINES, asleep, sleepsIn, folded, minds } from './the-lines.rule.js';
import { S, bodyVox, poleVox, sinewVox } from './the-lines.model.js';

const GAP_ROOM = 'the-culvert', UP = new THREE.Vector3(0, 1, 0);

export function create(c) {
  const { env, level } = c, L = LINES, kit = env.kit;
  const gap = level.rooms.find((r) => r.arch === GAP_ROOM);
  const walker = { x: 0, z: 0, r: 0.34, tall: 1.5, opens: true };
  let fig = null, body = null, mat = null, legs = [], s = asleep(), rot = 0, y = 0.55, q = 0, drop = 0, clock = 0, base = 0, known = false, doorT = 0, lastX = 0, lastZ = 0;
  const dir = new THREE.Vector3();

  function ready() {
    if (!gap) return;                                                            // (no gap in this part: nothing of it is here)
    const w = env.world, way = roomRoute(level, level.start.room, gap.id, c.walk.cost(walker)) || [gap.id];
    let spot = null;
    // (c.lair: the cast's own choice of where, when it has one to give — cast.js `withRoom`. Without: the same, worked out here)
    for (const id of [c.lair ?? sleepsIn(way, c.R), ...way.slice().reverse()]) { const def = level.rooms[id]; if (!def || def.crawl || def.H < 2.2) continue; const sp = c.walk.spotIn(walker, id); if (sp && c.walk.stand(walker, sp.x, sp.z)) { spot = sp; break; } }
    if (!spot) return;
    walker.x = lastX = spot.x; walker.z = lastZ = spot.z; rot = c.R.range(0, 6.28); base = w.floorY(spot.x, spot.z);
    mat = kit.surface({ vox: true }); fig = new THREE.Group();
    const m4 = new THREE.Matrix4().makeScale(S, S, S), lights = [lamp(0.6, 3.2, 1.4, [1.1, 1.1, 1.05], { k: 9, wrap: 0.45, far: 40 })];
    const geo = (key, make) => { const b = new Batch(true); b.addVox(kit.model(key, make).solid, m4); return kit.geometry(b, lights, [0.5, 0.5, 0.5]); };
    body = new THREE.Mesh(geo('lines:body', bodyVox), mat); fig.add(body);
    const poleGeo = geo('lines:pole', poleVox), sinewGeo = geo('lines:sinew', sinewVox);
    legs = Array.from({ length: L.legs }, (_, i) => {
      const a = (i < 3 ? 1 : -1) * (0.55 + (i % 3) * 1.02), pole = new THREE.Mesh(poleGeo, mat), sinew = new THREE.Mesh(sinewGeo, mat); fig.add(pole, sinew);
      return { a, pole, sinew, x: spot.x + Math.sin(rot + a) * 0.75, z: spot.z + Math.cos(rot + a) * 0.75, fx: 0, fz: 0, tx: 0, tz: 0, k: 1, lift: 0 };
    });
    c.add(fig); pose(0, false);
  }

  /** Stand it where it is: the body, and each leg from its foot to its knee, and what joins the knee to the body. */
  function pose(dt, moving) {
    const up = s.up, fx = Math.sin(rot), fz = Math.cos(rot), fl = base - drop;
    const spread = (0.75 + (L.spread - 0.75) * up) * (1 - q) + 0.45 * q, lead = moving ? 0.55 * (1 - q) : 0;
    y = (0.55 + (L.high - 0.55) * up) * (1 - q) + L.low * q + (up > 0.9 ? Math.sin(clock * 2.1) * 0.05 * (1 - q) : 0);
    let stepping = legs.filter((l) => l.k < 1).length;
    legs.forEach((l, i) => {
      const rx = walker.x + Math.sin(rot + l.a) * spread + fx * (lead - L.trail * q), rz = walker.z + Math.cos(rot + l.a) * spread + fz * (lead - L.trail * q);
      if (l.k >= 1 && stepping < 3 && !drop && Math.hypot(rx - l.x, rz - l.z) > (up < 1 ? 0.2 : L.stride * (1 - 0.45 * q))) { l.fx = l.x; l.fz = l.z; l.tx = rx; l.tz = rz; l.k = 0; stepping++; }
      if (l.k < 1) {
        l.k = Math.min(1, l.k + dt / L.step); l.x = l.fx + (l.tx - l.fx) * l.k; l.z = l.fz + (l.tz - l.fz) * l.k; l.lift = Math.sin(l.k * Math.PI) * 0.55 * (1 - 0.6 * q);
        if (l.k >= 1 && up >= 1 && i % 2 === 0) c.play(q > 0.5 ? 'rattle' : 'thunk', l.x, l.z, 14);
      }
      if (drop) { l.x += (walker.x - l.x) * dt * 0.8; l.z += (walker.z - l.z) * dt * 0.8; }
      // stood up: the pole leans in a little toward the body. Folded: it lies forward, past the body, nearly flat
      const ox = (walker.x - l.x) * 0.3, oz = (walker.z - l.z) * 0.3, oy = Math.sqrt(Math.max(0.2, L.pole * L.pole - ox * ox - oz * oz));
      dir.set(ox * (1 - q) + fx * L.pole * 0.93 * q, oy * (1 - q) + L.pole * 0.36 * q, oz * (1 - q) + fz * L.pole * 0.93 * q).normalize();
      const fy = fl + l.lift - drop * (0.1 * i);
      l.pole.position.set(l.x, fy, l.z); l.pole.quaternion.setFromUnitVectors(UP, dir);
      const kx = l.x + dir.x * L.pole, ky = fy + dir.y * L.pole, kz = l.z + dir.z * L.pole, hx = walker.x + Math.sin(rot + l.a) * 0.45, hz = walker.z + Math.cos(rot + l.a) * 0.45;
      dir.set(hx - kx, fl + y + 0.2 - ky, hz - kz); const len = dir.length(); l.sinew.position.set(kx, ky, kz); l.sinew.quaternion.setFromUnitVectors(UP, dir.normalize()); l.sinew.scale.set(1, len, 1);
    });
    body.position.set(walker.x, fl + y, walker.z); body.rotation.set(Math.sin(clock * 1.3) * 0.05 * up, rot, Math.sin(clock * 0.9) * 0.06 * up);
  }

  return {
    ready,
    update(dt) {
      if (!fig || s.mode === 'gone') return;
      const w = env.world, m = c.me(), d = Math.hypot(m.x - walker.x, m.z - walker.z); clock += dt;
      fig.visible = c.drawn(walker);
      const fy = w.floorY(walker.x, walker.z), floor = fy > base - 1.5, sees = c.los(m.x, m.z, walker.x, walker.z);
      if (floor && s.mode !== 'falling') base = fy;
      // how folded it has to be here: by the ceiling, and by a wall close on either side of the way it is going
      const px = Math.cos(rot), pz = -Math.sin(rot), hemmed = !c.los(walker.x, walker.z, walker.x + px * 1.5, walker.z + pz * 1.5) || !c.los(walker.x, walker.z, walker.x - px * 1.5, walker.z - pz * 1.5);
      const want = s.mode === 'asleep' ? 0 : folded(w.headroom(walker.x, walker.z), hemmed); q += (want - q) * Math.min(1, dt * (want > q ? 5 : 1.6));
      const bridge = !!w.terrainY && fy - w.terrainY(walker.x, walker.z) > 0.02;
      s = minds(s, dt, { d, sees, here: c.room(m.x, m.z) === c.room(walker.x, walker.z), floor, fold: q, bridge });
      if (s.woke) { c.play('rattle', walker.x, walker.z, 18); env.interfere(0.35); }
      if (s.fell) { c.play('rattle', walker.x, walker.z, 20); env.interfere(0.6); }
      if (s.mode === 'falling') { drop = 0.5 * 9.8 * s.t * s.t; rot += dt * 0.9; pose(dt, false); return; }
      if (s.over) { fig.visible = false; c.survived(); return; }
      if (!known && sees && d < 12 && s.mode !== 'asleep' && !c.hidden(walker.x, walker.z, 1)) { known = true; c.met(); }
      if (s.hit) {
        const got = c.hurt(1); env.interfere(1); env.hud?.glitch?.(0.6); c.play('thunk', walker.x, walker.z, 16);
        if (got && (got.dead || got.ended)) { s = { ...s, mode: 'gone' }; return; }
      }
      let moved = false;
      if (s.speed > 0 && d > L.reach * 0.7) {
        const dist = s.speed * Math.min(dt, 0.08), res = c.walk.go(walker, { x: m.x, z: m.z }, dist, 0.5);
        if (res && res.door) { doorT += dt; if (doorT > 0.5) { env.doors?.open?.(res.door, 'it'); doorT = 0; } } else doorT = 0;
        if (!res || !res.went) c.walk.stride(walker, m.x, m.z, dist);             // (no way to them: as near as there is floor)
        const mx = walker.x - lastX, mz = walker.z - lastZ; moved = Math.hypot(mx, mz) > 1e-4;
        if (moved) { let da = Math.atan2(mx, mz) - rot; da = Math.atan2(Math.sin(da), Math.cos(da)); rot += da * Math.min(1, dt * 3.2); }
      }
      lastX = walker.x; lastZ = walker.z;
      const lit = c.light(walker.x, walker.z, 1.6); mat.uniforms.uTint.value.set(lit[0] * 1.5 + 0.05, lit[1] * 1.5 + 0.05, lit[2] * 1.5 + 0.05);
      pose(dt, moved);
    },
    at: () => (fig ? { x: walker.x, z: walker.z, mode: s.mode, fold: +q.toFixed(2) } : { x: null, z: null, mode: 'absent' }),
    /** What it does with whoever it has got, for the last picture: stands up over them, all of it, and comes down. */
    takes(shot) {
      return (t, dt) => { if (!fig) return; clock += dt; q += (0 - q) * Math.min(1, dt * 3); walker.x += (shot.x - walker.x) * Math.min(1, dt * 1.2); walker.z += (shot.z - walker.z) * Math.min(1, dt * 1.2); fig.visible = true; pose(dt, true); body.position.y -= Math.min(0.9, t * 0.5); };
    },
    /** The last picture, if it was this that ended the visit: from beside it, looking up at what it is slung from. */
    films(shot) {
      if (!fig) return null;
      for (const a of [0.9, -0.9, 2.4, -2.4]) { const x = walker.x + Math.sin(rot + a) * 4, z = walker.z + Math.cos(rot + a) * 4; if (c.los(x, z, walker.x, walker.z)) return { x, y: shot.y + 0.7, z, at: { x: walker.x, y: shot.y + y, z: walker.z } }; }
      return null;
    },
    dispose() { fig?.removeFromParent(); },
  };
}
