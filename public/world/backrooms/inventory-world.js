// Floor-owned physical inventory. The visit carries only plain item state;
// every floor owns its meshes, marks and use records until that floor retires.
import * as THREE from 'three';
import { Batch, lamp, lightAt, lin } from './kit.js';
import { toLocal, toWorld } from './gen.js';
import { INVENTORY_MODELS } from './inventory-items.js';
import { makeItem, ITEM_DEFS } from './inventory-state.js';
import { createInventoryFire, FIRE } from './inventory-fire.js';

const REACH = 1.35, MARK_R = .33, MAX_MARKS = 24;
const ITEM_RADIUS = Object.freeze({ torch: .30, battery: .19, chalk: .16, paper: .31, 'pink-slip': .28, scissors: .29, snack: .23, balloon: .26, lighter: .20, tape: .26, opener: .2, extinguisher: .2, flamingo: .3 });
const ITEM_HEIGHT = Object.freeze({ balloon: 1.4, flamingo: .85 });
const copy = item => ({ ...item });
/**
 * Something lying on the floor gives a small start now and then, so that it is seen: two quick rocks and a hop of a few
 * centimetres, every few seconds, each thing in its own time. No glow, no marker: it is the thing itself that moves.
 * every, lasts: seconds · tilt: radians at the most · hop: metres at the most
 */
export const JIGGLE = Object.freeze({ every: 5.5, lasts: 0.5, tilt: 0.17, hop: 0.03 });
/** Where in its start a thing is, `clock` seconds in, for one that began `phase` seconds out of step: { tilt, hop }, both 0 between starts. */
export function jiggleAt(clock, phase = 0) {
  const t = (((clock + phase) % JIGGLE.every) + JIGGLE.every) % JIGGLE.every;
  if (t >= JIGGLE.lasts) return { tilt: 0, hop: 0 };
  const k = t / JIGGLE.lasts, w = Math.sin(k * Math.PI * 4) * (1 - k);
  return { tilt: w * JIGGLE.tilt, hop: Math.abs(w) * JIGGLE.hop };
}
const phaseOf = id => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 1000) / 1000 * JIGGLE.every; };
const label = item => item.type === 'paper' ? `Paper × ${item.quantity}` : item.type === 'battery' ? 'Batteries' : ITEM_DEFS[item.type].name;

export function createInventoryWorld(env, model, { canAct = () => true, onNotice = () => {}, onPickup = () => {} } = {}) {
  const { world, kit } = env, entries = new Map(), geometries = new Map(), marks = [];
  let disposed = false, markCount = 0, arrowGeometry = null, clock = 0;
  const point = (rt, x, z) => { const p = toWorld(rt.def, x, z); return { x, z, wx: p.x, wz: p.z, y: world.floorY(p.x, p.z) - rt.def.y }; };
  const roomFor = room => typeof room === 'object' ? world.rooms.find(r => r === room) : world.rooms.find(r => r.id === room);
  const available = () => !disposed && canAct() && !!env.player?.me;
  const notice = reason => { onNotice(reason); return { ok: false, reason }; };
  const floorAt = (p) => world.floorY(p.wx, p.wz);
  const dry = (rt, p) => {
    const flood = rt.floodMark;
    if (!flood) return true;
    const b = flood.plan.waterBounds;
    return p.x < b.x0 || p.x > b.x1 || p.z < b.z0 || p.z > b.z1 || flood.phase.water <= p.y + .025;
  };
  // Unlike the general interaction shortcut, even the shortest reach is
  // sampled. A pickup on the other side of a thin wall must stay there.
  const clearRay = (ax, az, bx, bz, radius = .025, walk = false, height = 0) => {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / .055));
    let px = ax, pz = az;
    for (let i = 1; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
      if (!world.free(x, z, radius, { tall: !walk, ghost: !walk }) || (walk && (!world.passable(px, pz, x, z) || world.headroom(x, z) < height))) return false;
      px = x; pz = z;
    }
    return true;
  };
  const fires = createInventoryFire(env, { canAct: available, clearRay, isDry: f => dry(f.rt, f) });
  const supported = (rt, p, radius, height = .62, ignore) => {
    if (world.roomAt(p.wx, p.wz) !== rt || !world.free(p.wx, p.wz, radius, ignore ? { ignoreCollider: ignore } : undefined) || world.headroom(p.wx, p.wz) < height) return false;
    const y = floorAt(p);
    for (const [dx, dz] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius], [radius * .7, radius * .7], [-radius * .7, -radius * .7], [-radius * .7, radius * .7], [radius * .7, -radius * .7]]) {
      if (world.roomAt(p.wx + dx, p.wz + dz) !== rt || world.headroom(p.wx + dx, p.wz + dz) < height
        || Math.abs(world.floorY(p.wx + dx, p.wz + dz) - y) > .025) return false;
      const local = toLocal(rt.def, p.wx + dx, p.wz + dz);
      if (!dry(rt, { ...local, y: y - rt.def.y })) return false;
    }
    return dry(rt, p);
  };
  function groundSpot(radius, mark = false, height = .62) {
    if (!available()) return null;
    const me = env.player.me, rt = world.roomAt(me.x, me.z);
    if (!rt || (mark && (me.drop > .02 || me.sinkTo > .05))) return null;
    const local = toLocal(rt.def, me.x, me.z), floor = world.floorY(me.x, me.z);
    if (mark && !dry(rt, point(rt, local.x, local.z))) return null;
    for (const distance of mark ? [.65, .48] : [.9, .65, .4, .25]) {
      for (const offset of mark ? [0, -.25, .25] : [0, -.4, .4, -.85, .85, -1.35, 1.35]) {
        const yaw = me.yaw + offset, wx = me.x - Math.sin(yaw) * distance, wz = me.z - Math.cos(yaw) * distance;
        const q = toLocal(rt.def, wx, wz), p = point(rt, q.x, q.z);
        if (!supported(rt, p, radius, height) || Math.abs(floorAt(p) - floor) > .24 || !clearRay(me.x, me.z, wx, wz, radius, true, height)) continue;
        if (fires.occupied(p.wx, p.wz, radius, floorAt(p))) continue;
        if (!mark && [...entries.values()].some(e => e.active && e.rt === rt && Math.hypot(e.x - p.x, e.z - p.z) < radius + ITEM_RADIUS[e.item.type])) continue;
        if (mark && marks.some(m => !m.away && m.rt === rt && Math.hypot(m.x - p.x, m.z - p.z) < .48)) continue;
        return { ...p, rt, yaw: me.yaw - (rt.def.rot * Math.PI) / 2 };
      }
    }
    return null;
  }
  function tint(mesh, rt, x, y, z) {
    const rgb = lightAt(rt.lights, rt.amb, x, y + .12, z);
    mesh.material.uniforms.uTint.value.set(...rgb);
    mesh.material.uniforms.uDim = rt.u.dim;
    mesh.material.uniforms.uFlick = rt.u.flick;
  }
  function itemGeometry(type) {
    if (!geometries.has(type)) {
      const make = INVENTORY_MODELS[type], high = typeof make?.sculpt === 'function';
      const b = new Batch(!high), s = kit.VOXEL;
      if (high && Array.isArray(b.pos)) {
        make.sculpt(b, s, { grounded: true });
        geometries.set(type, kit.geometry(b, [
          lamp(-1.4, 3.2, 1.6, [.48, .46, .42], { k: 10, far: 14, wrap: .45 }),
          lamp(1.8, 1.9, -1.6, [.20, .22, .26], { k: 10, far: 14, wrap: .35 }),
        ], [.78, .78, .80]));
      } else {
        b.addVox(kit.model(`inventory:${type}:v1`, make).solid, new THREE.Matrix4().makeScale(s, s, s));
        geometries.set(type, kit.geometry(b, [lamp(-1, 3, 1, [.4, .4, .4], { k: 8, far: 12, wrap: .5 })], [.8, .8, .8]));
      }
    }
    return geometries.get(type);
  }
  const canPickup = e => {
    if (!available()) return false;
    const me = env.player.me;
    return e.active && !me.frozen && !!e.rt.group.visible && Math.hypot(me.x - e.wx, me.z - e.wz) <= REACH
      && Math.abs(me.y - (e.rt.def.y + e.y + .1)) < 1.35 && clearRay(me.x, me.z, e.wx, e.wz);
  };
  function take(e) {
    if (!canPickup(e)) return { ok: false, reason: 'out-of-reach' };
    const result = model.add(e.item);
    if (!result.ok) { onNotice(result.reason || 'full'); return result; }
    const picked = copy(e.item);
    if (picked.type === 'paper') picked.quantity = result.accepted;
    // A full bag may still have room in a paper stack. Only transfer what
    // fits; the remaining sheets keep their physical identity and location.
    if (result.remainder) { e.item = copy(result.remainder); e.use.label = label(e.item); }
    else { e.active = false; e.mesh.visible = false; }
    env.sound.play('clack', { vol: .55 }); onPickup(picked, result.index);
    return { ...result, id: e.item.id };
  }
  function place(item, p, rotation = -.18) {
    let e = entries.get(item.id);
    if (!e) {
      const high = typeof INVENTORY_MODELS[item.type]?.sculpt === 'function';
      const mesh = new THREE.Mesh(itemGeometry(item.type), kit.surface({ vox: !high, room: p.rt.u }));
      mesh.name = `inventory-${item.id}`;
      e = { item: copy(item), mesh, active: false };
      e.use = { r: REACH, label: label(item), inventoryItem: true,
        when: () => canPickup(e), use: () => take(e) };
      entries.set(item.id, e);
    }
    if (e.rt !== p.rt) {
      if (e.rt) e.rt.uses = e.rt.uses.filter(u => u !== e.use);
      p.rt.uses.push(e.use); p.rt.group.add(e.mesh);
    }
    Object.assign(e, { item: copy(item), rt: p.rt, x: p.x, z: p.z, y: p.y, wx: p.wx, wz: p.wz, active: true, away: null });
    Object.assign(e.use, { wx: p.wx, wz: p.wz, x: p.x, z: p.z, room: p.rt, label: label(item) });
    e.mesh.position.set(p.x, p.y + .009, p.z); e.mesh.rotation.y = rotation; e.mesh.visible = true;
    tint(e.mesh, p.rt, p.x, p.y, p.z);
    return { ok: true, id: item.id };
  }
  function spawn(item, { room, x, z, y, ignore } = {}) {         // (ignore: a collider it may lie over, as in an open drawer: cabinets.js)
    const rt = roomFor(room);
    if (disposed || !rt || !item?.id || !Number.isFinite(x) || !Number.isFinite(z)) return { ok: false, reason: 'invalid-item' };
    try { item = makeItem(item.type, item.id, item); } catch { return { ok: false, reason: 'invalid-item' }; }
    if (!INVENTORY_MODELS[item.type]) return { ok: false, reason: 'invalid-item' };
    const bag = model.read();
    if (entries.has(item.id) || bag.mountedTorch?.id === item.id || bag.slots.some(s => s?.id === item.id)) return { ok: false, reason: 'duplicate' };
    const p = { ...point(rt, x, z), rt }, radius = ITEM_RADIUS[item.type];
    if (fires.occupied(p.wx, p.wz, radius, floorAt(p))) return { ok: false, reason: 'no-space' };
    if (y !== undefined && !Number.isFinite(y)) return { ok: false, reason: 'no-space' };
    const elevation = y === undefined ? 0 : y - p.y;
    if (!Number.isFinite(elevation) || elevation < 0 || elevation > 1.1) return { ok: false, reason: 'no-space' };
    if (!supported(rt, p, radius, (ITEM_HEIGHT[item.type] ?? .62) + elevation, ignore) || [...entries.values()].some(e => e.active && e.rt === rt && Math.hypot(e.x - p.x, e.z - p.z) < radius + ITEM_RADIUS[e.item.type])) return { ok: false, reason: 'no-space' };
    p.y += elevation;
    return place(item, p);
  }
  function dropSelected() {
    if (!available()) return { ok: false, reason: 'unavailable' };
    const s = model.read(), item = s.slots[s.selected];
    if (s.holstered || !item) return notice('empty');
    const spot = groundSpot(ITEM_RADIUS[item.type], false, ITEM_HEIGHT[item.type]);
    if (disposed || !spot) return notice('no-space');
    // Build/position before removing anything from the bag. Allocation failure
    // cannot destroy the carried item; reuse the same node on later drops.
    const result = place(item, spot, spot.yaw + .25);
    const removed = model.remove(item.id);
    if (!removed) { const e = entries.get(item.id); e.active = false; e.mesh.visible = false; return notice('empty'); }
    env.sound.play('thunk', { vol: .35 });
    return { ...result, item: removed };
  }
  function mark() {
    if (!available()) return { ok: false, reason: 'unavailable' };
    const p = groundSpot(MARK_R, true);
    if (disposed || !p) return { ok: false, reason: 'no-mark' };
    return drawMark(p);
  }
  function drawMark(p, number = ++markCount) {
    if (!arrowGeometry) {
      const b = new Batch(), chalk = lin('#d9d1b2');
      // A broken, hand-drawn arrow. All pieces are disjoint and lie on one
      // slightly raised plane, rather than overlapping transparent decals.
      const squares = [[0,-4],[-1,-3],[0,-3],[1,-3],[-2,-2],[0,-2],[2,-2],[0,-1],[0,0],[0,1],[0,2],[0,3]];
      for (let i = 0; i < squares.length; i++) {
        const [x, z] = squares[i], x0 = x * .07 - .026, z0 = z * .07 - .026;
        b.quad([x0, 0, z0 + .052], [x0 + .052, 0, z0 + .052], [x0 + .052, 0, z0], [x0, 0, z0], chalk.map(v => v * (i % 3 ? 1 : .78)));
      }
      arrowGeometry = kit.geometry(b, [], [1, 1, 1]);
    }
    let m;
    if (marks.length < MAX_MARKS) {
      m = { mesh: new THREE.Mesh(arrowGeometry, kit.surface({ room: p.rt.u })) }; marks.push(m);
    } else { m = marks.shift(); marks.push(m); }
    Object.assign(m, { rt: p.rt, x: p.x, z: p.z, y: p.y, number, yaw:p.yaw, away: null });
    p.rt.group.add(m.mesh); m.mesh.position.set(p.x, p.y + .013, p.z); m.mesh.rotation.y = p.yaw; m.mesh.visible = true;
    tint(m.mesh, p.rt, p.x, p.y, p.z);
    if (number === markCount) env.sound.play('rustle', { vol: .6 });
    return { ok: true, number, room: p.rt.id, x: p.x, z: p.z };
  }
  function ignite(spec) {
    const checked = fires.request(spec);
    if (!checked.ok) return checked;
    const p = groundSpot(FIRE.footprint, false, FIRE.height);
    if (!p) return { ok: false, reason: 'no-fire-space' };
    const result = fires.ignite(p, checked);
    if (result.ok) env.sound.play('rustle', { vol: .6 });
    return result;
  }
  return {
    spawn, dropSelected, dropSpot: item => groundSpot(ITEM_RADIUS[item.type], false, ITEM_HEIGHT[item.type]), canMark: () => !disposed && !!groundSpot(MARK_R, true), mark, ignite,
    fire: Object.freeze({ threatAt: fires.threatAt, burning: fires.report, douse: fires.douse }),
    // A co-op spectator renders only effects accepted by the authority.
    applyEffects(report) {
      fires.sync(report.fires || []);
      const visible = new Set((report.marks || []).map(m => m.number));
      for (const m of marks) m.mesh.visible = visible.has(m.number);
      for (const m of report.marks || []) if (!marks.some(old => old.number === m.number)) {
        const rt = roomFor(m.room); if (rt) drawMark({ ...m, rt }, m.number);
      }
    },
    update(dt = 0) {
      if (disposed) return;
      fires.update(dt);
      clock += dt;
      for (const e of entries.values()) if (e.active && e.rt.near) {
        tint(e.mesh, e.rt, e.x, e.y, e.z);
        const j = jiggleAt(clock, e.phase ??= phaseOf(e.item.id));
        e.mesh.rotation.z = j.tilt; e.mesh.position.y = e.y + .009 + j.hop;
      }
      for (const m of marks) if (m.rt.near && !m.away) tint(m.mesh, m.rt, m.x, m.y, m.z);
    },
    /**
     * A room has gone, and taken what was lying in it (there are rooms that change the building: the hallway that is not
     * sure where it leads). Everything on that floor — things put down, chalk marks, a fire — goes with the room and is
     * there again, as it was, when the room is: bringBack(key). `inside(x, z)` says where the room was, in the world.
     * (So a chalk mark made to find out whether it is the same room says what is true: it is not.) → how many things went.
     */
    takeAway(inside, key) {
      if (disposed) return 0;
      let n = fires.takeAway?.(inside, key) || 0;
      for (const e of entries.values()) if (e.active && inside(e.wx, e.wz)) { e.active = false; e.away = key; e.mesh.visible = false; n++; }
      for (const m of marks) { if (m.away) continue; const at = toWorld(m.rt.def, m.x, m.z); if (inside(at.x, at.z)) { m.away = key; m.mesh.visible = false; n++; } }
      return n;
    },
    bringBack(key) {
      if (disposed) return 0;
      let n = fires.bringBack?.(key) || 0;
      for (const e of entries.values()) if (e.away === key) { e.away = null; e.active = true; e.mesh.visible = true; n++; }
      for (const m of marks) if (m.away === key) { m.away = null; m.mesh.visible = true; n++; }
      return n;
    },
    report: () => ({ items: [...entries.values()].map(e => ({ ...copy(e.item), room: e.rt.id, x: e.x, y: e.y, z: e.z, wx: e.wx, wz: e.wz, active: e.active, ...(e.away ? { away: e.away } : {}) })),
      marks: marks.map(m => ({ number: m.number, room: m.rt.id, x: m.x, y: m.y, z: m.z, yaw:m.yaw, ...(m.away ? { away: m.away } : {}) })), marksMade: markCount, fires: fires.report() }),
    dispose() {
      if (disposed) return;
      disposed = true;
      fires.dispose();
      for (const e of entries.values()) { e.rt.uses = e.rt.uses.filter(u => u !== e.use); e.mesh.removeFromParent(); }
      for (const m of marks) m.mesh.removeFromParent();
      entries.clear(); marks.length = 0; geometries.clear(); arrowGeometry = null;
      // All geometries and materials belong to kit, which disposes once when
      // the floor retires. No event handlers, timers or persistent storage here.
    },
  };
}
