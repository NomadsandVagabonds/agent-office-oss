// Visit-local physical inventory. Small objects never block the player. A
// dropped object is the same instance, including its remaining charge/uses.
import * as THREE from 'three';
import { Batch, lamp, lightAt, lin } from './kit.js';
import { toLocal, toWorld } from './gen.js';
import { INVENTORY_MODELS } from './inventory-items.js';
import { makeItem } from './inventory-state.js';

const REACH = 1.35, MARK_R = .33, MAX_MARKS = 24;
const ITEM_RADIUS = Object.freeze({ torch: .30, battery: .19, chalk: .16 });
const copy = item => ({ ...item });

export function createInventoryWorld(env, model, { onNotice = () => {}, onPickup = () => {} } = {}) {
  const { world, kit } = env, entries = new Map(), geometries = new Map(), marks = [];
  let disposed = false, markCount = 0, arrowGeometry = null;
  const point = (rt, x, z) => { const p = toWorld(rt.def, x, z); return { x, z, wx: p.x, wz: p.z, y: world.floorY(p.x, p.z) - rt.def.y }; };
  const roomFor = room => typeof room === 'object' ? room : world.rooms.find(r => r.id === room);
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
  const clearRay = (ax, az, bx, bz, radius = .025, walk = false) => {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / .055));
    let px = ax, pz = az;
    for (let i = 1; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
      if (!world.free(x, z, radius, { tall: !walk }) || (walk && !world.passable(px, pz, x, z))) return false;
      px = x; pz = z;
    }
    return true;
  };
  const supported = (rt, p, radius) => {
    if (world.roomAt(p.wx, p.wz) !== rt || !world.free(p.wx, p.wz, radius) || world.headroom(p.wx, p.wz) < .62) return false;
    const y = floorAt(p);
    for (const [dx, dz] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius], [radius * .7, radius * .7], [-radius * .7, -radius * .7], [-radius * .7, radius * .7], [radius * .7, -radius * .7]]) {
      if (world.roomAt(p.wx + dx, p.wz + dz) !== rt || Math.abs(world.floorY(p.wx + dx, p.wz + dz) - y) > .025) return false;
    }
    return dry(rt, p);
  };
  function groundSpot(radius, mark = false) {
    const me = env.player.me, rt = world.roomAt(me.x, me.z);
    if (!rt || (mark && (me.drop > .02 || me.sinkTo > .05))) return null;
    const local = toLocal(rt.def, me.x, me.z), floor = world.floorY(me.x, me.z);
    if (mark && !dry(rt, point(rt, local.x, local.z))) return null;
    for (const distance of mark ? [.65, .48] : [.9, .65, .4, .25]) {
      for (const offset of mark ? [0, -.25, .25] : [0, -.4, .4, -.85, .85, -1.35, 1.35]) {
        const yaw = me.yaw + offset, wx = me.x - Math.sin(yaw) * distance, wz = me.z - Math.cos(yaw) * distance;
        const q = toLocal(rt.def, wx, wz), p = point(rt, q.x, q.z);
        if (!supported(rt, p, radius) || Math.abs(floorAt(p) - floor) > .24 || !clearRay(me.x, me.z, wx, wz, radius, true)) continue;
        if (!mark && [...entries.values()].some(e => e.active && e.rt === rt && Math.hypot(e.x - p.x, e.z - p.z) < radius + ITEM_RADIUS[e.item.type])) continue;
        if (mark && marks.some(m => m.rt === rt && Math.hypot(m.x - p.x, m.z - p.z) < .48)) continue;
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
      const b = new Batch(true), s = kit.VOXEL;
      b.addVox(kit.model(`inventory:${type}:v1`, INVENTORY_MODELS[type]).solid, new THREE.Matrix4().makeScale(s, s, s));
      geometries.set(type, kit.geometry(b, [lamp(-1, 3, 1, [.4, .4, .4], { k: 8, far: 12, wrap: .5 })], [.8, .8, .8]));
    }
    return geometries.get(type);
  }
  const canPickup = e => {
    const me = env.player.me;
    return !disposed && e.active && !me.frozen && !!e.rt.group.visible && Math.hypot(me.x - e.wx, me.z - e.wz) <= REACH
      && Math.abs(me.y - (e.rt.def.y + e.y + .1)) < 1.35 && clearRay(me.x, me.z, e.wx, e.wz);
  };
  function take(e) {
    if (!canPickup(e)) return { ok: false, reason: 'out-of-reach' };
    const result = model.add(e.item);
    if (!result.ok) { onNotice(result.reason || 'full'); return result; }
    e.active = false; e.mesh.visible = false;
    env.sound.play('clack', { vol: .55 }); onPickup(copy(e.item), result.index);
    return { ...result, id: e.item.id };
  }
  function place(item, p, rotation = -.18) {
    let e = entries.get(item.id);
    if (!e) {
      const mesh = new THREE.Mesh(itemGeometry(item.type), kit.surface({ vox: true, room: p.rt.u }));
      mesh.name = `inventory-${item.id}`;
      e = { item: copy(item), mesh, active: false };
      e.use = { r: REACH, label: item.type === 'torch' ? 'Flashlight' : item.type === 'battery' ? 'Batteries' : 'Chalk', inventoryItem: true,
        when: () => canPickup(e), use: () => take(e) };
      entries.set(item.id, e);
    }
    if (e.rt !== p.rt) {
      if (e.rt) e.rt.uses = e.rt.uses.filter(u => u !== e.use);
      p.rt.uses.push(e.use); p.rt.group.add(e.mesh);
    }
    Object.assign(e, { item: copy(item), rt: p.rt, x: p.x, z: p.z, y: p.y, wx: p.wx, wz: p.wz, active: true });
    Object.assign(e.use, { wx: p.wx, wz: p.wz, x: p.x, z: p.z, room: p.rt });
    e.mesh.position.set(p.x, p.y + .009, p.z); e.mesh.rotation.y = rotation; e.mesh.visible = true;
    tint(e.mesh, p.rt, p.x, p.y, p.z);
    return { ok: true, id: item.id };
  }
  function spawn(item, { room, x, z, y } = {}) {
    const rt = roomFor(room);
    if (disposed || !rt || !item?.id || !INVENTORY_MODELS[item.type] || !Number.isFinite(x) || !Number.isFinite(z)) return { ok: false, reason: 'invalid-item' };
    try { item = makeItem(item.type, item.id, item); } catch { return { ok: false, reason: 'invalid-item' }; }
    if (entries.has(item.id) || model.read().slots.some(s => s?.id === item.id)) return { ok: false, reason: 'duplicate' };
    const p = { ...point(rt, x, z), rt }, radius = ITEM_RADIUS[item.type];
    if (!supported(rt, p, radius) || [...entries.values()].some(e => e.active && e.rt === rt && Math.hypot(e.x - p.x, e.z - p.z) < radius + ITEM_RADIUS[e.item.type])) return { ok: false, reason: 'no-space' };
    if (y !== undefined) {
      if (!Number.isFinite(y) || y < p.y || y > p.y + 1.1) return { ok: false, reason: 'no-space' };
      p.y = y;
    }
    return place(item, p);
  }
  function dropSelected() {
    const s = model.read(), item = s.slots[s.selected];
    if (!item) return notice('empty');
    const spot = groundSpot(ITEM_RADIUS[item.type]);
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
    const p = groundSpot(MARK_R, true);
    if (disposed || !p) return { ok: false, reason: 'no-mark' };
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
    Object.assign(m, { rt: p.rt, x: p.x, z: p.z, y: p.y, number: ++markCount });
    p.rt.group.add(m.mesh); m.mesh.position.set(p.x, p.y + .013, p.z); m.mesh.rotation.y = p.yaw;
    tint(m.mesh, p.rt, p.x, p.y, p.z);
    env.sound.play('rustle', { vol: .6 });
    return { ok: true, number: markCount, room: p.rt.id, x: p.x, z: p.z };
  }
  return {
    spawn, dropSelected, canMark: () => !disposed && !!groundSpot(MARK_R, true), mark,
    update() {
      if (disposed) return;
      for (const e of entries.values()) if (e.active && e.rt.near) tint(e.mesh, e.rt, e.x, e.y, e.z);
      for (const m of marks) if (m.rt.near) tint(m.mesh, m.rt, m.x, m.y, m.z);
    },
    report: () => ({ items: [...entries.values()].map(e => ({ ...copy(e.item), room: e.rt.id, x: e.x, y: e.y, z: e.z, wx: e.wx, wz: e.wz, active: e.active })),
      marks: marks.map(m => ({ number: m.number, room: m.rt.id, x: m.x, y: m.y, z: m.z })), marksMade: markCount }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const e of entries.values()) { e.rt.uses = e.rt.uses.filter(u => u !== e.use); e.mesh.removeFromParent(); }
      for (const m of marks) m.mesh.removeFromParent();
      entries.clear(); marks.length = 0;
      // All geometries and materials belong to kit, which disposes once when
      // the visit ends. No event handlers, timers or persistent storage here.
    },
  };
}
