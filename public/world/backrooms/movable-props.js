// Room-authored meshes join the same collection as catalogue furniture.
// Coordinates in the authoring contract are room-local; records and collisions
// are in the part's world frame, including quarter-turned / raised rooms.
import { toWorld } from './gen.js';
import { overlaps, worldFootprint } from './furniture-policy.js';
import { FURNITURE } from './furniture-motion.js';
import { BRIDGE, cutoutBounds } from './bridge-rules.js';

function validFoot(f) {
  return f && ['x', 'z', 'x0', 'x1', 'z0', 'z1', 'bottom', 'top'].every(k => Number.isFinite(f[k]))
    && f.x1 > f.x0 && f.z1 > f.z0 && f.top > f.bottom && f.x1 - f.x0 <= 4 && f.z1 - f.z0 <= 4 && f.top - f.bottom <= 4;
}

export function registerMovable(world, rt, group, { foot, type = 'prop', label = 'Scenery', cutout } = {}) {
  if (!validFoot(foot) || !Object.hasOwn(FURNITURE, type) || !group?.isObject3D || group.parent !== rt.group) throw Error('movable: use a room-owned group, a finite footprint (up to 4m), and a known motion profile');
  if (cutout && (![cutout.x, cutout.z, cutout.y ?? 0, cutout.width, cutout.height, cutout.facing ?? 0].every(Number.isFinite)
    || ![0, 1, 2, 3].includes(cutout.facing ?? 0) || !Number.isFinite(cutout.thickness ?? BRIDGE.thickness)
    || (cutout.thickness ?? BRIDGE.thickness) <= 0 || (cutout.thickness ?? BRIDGE.thickness) > .18
    || cutout.width < BRIDGE.width || cutout.height < .8 || Math.max(cutout.width, cutout.height) > BRIDGE.max)) throw Error('movable: cutouts need facing 0–3 and a rigid panel .72–4m wide / .8–4m high / at most .18m thick');
  const def = rt.def, f = { id: `movable:${rt.id}:${world.furniture.length}`, type, label: String(label).slice(0, 60), room: rt.id,
    ...worldFootprint(foot, def, toWorld), group, authored: true, deployed: false, transition: null, support: null, offsetX: 0, offsetZ: 0 };
  f.collider = { x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, get top() { return f.top; }, on: true, tall: f.top - f.y > 1.25, furniture: f.id, floor: false, keep: true };
  rt.colliders.push(f.collider);
  if (!world.env.barricadesEnabled) { delete f.collider.furniture; return null; } // fixed geometry still has a body
  world.furniture.push(f); world.furnitureColliders.push(f.collider);
  const touch = before => {
    for (const room of world.rooms) if (overlaps(f, room.rect) || before && overlaps(before, room.rect)) {
      const rev = (world.furnitureRevision.get(room.id) || 0) + 1;
      world.furnitureRevision.set(room.id, rev); room.furnitureRevision = rev;
    }
  };
  const bounds = box => {
    Object.assign(f, box);
    Object.assign(f.collider, { x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, tall: !f.deployed && f.top - f.y > 1.25, floor: f.deployed && !f.transition && !!f.support?.ok });
  };
  f.translate = (dx, dz) => {
    if (f.away || f.transition || !Number.isFinite(dx) || !Number.isFinite(dz) || Math.hypot(dx, dz) < 1e-6) return false;
    const before = { ...f };
    f.offsetX += dx; f.offsetZ += dz;
    bounds({ x: f.x + dx, z: f.z + dz, x0: f.x0 + dx, x1: f.x1 + dx, z0: f.z0 + dz, z1: f.z1 + dz });
    group.position.x += dx; group.position.z += dz;
    if (f.hinge) { f.hinge.x += dx; f.hinge.z += dz; }
    const next = world.roomAt(f.x, f.z);
    if (next && next.id !== f.room) {
      const old = world.rooms.find(r => r.id === f.room), i = old?.colliders.indexOf(f.collider);
      if (i >= 0) old.colliders.splice(i, 1);
      next.colliders.push(f.collider); f.room = next.id;
    }
    // These props are small in number. Every move invalidates their surface
    // and route immediately, including motion shorter than a nav cell.
    touch(before); world.refreshFurniture?.(); return true;
  };
  if (cutout) {
    world.movableSurfaces.push(f);
    const base = { thickness: BRIDGE.thickness, y: 0, facing: 0, ...cutout };
    const localN = { x: Math.sin(base.facing * Math.PI / 2), z: Math.cos(base.facing * Math.PI / 2) };
    const hinge = toWorld(def, base.x, base.z), tip = toWorld(def, base.x + localN.x, base.z + localN.z);
    f.hinge = { ...hinge };
    f.bridge = { axis: Math.abs(tip.x - hinge.x) > .5 ? 'x' : 'z', normal: { x: tip.x - hinge.x, z: tip.z - hinge.z }, bearing: BRIDGE.bearing, eitherEnd: cutout.eitherEnd === true };
    f.pose = (angle, dx = 0, dz = 0) => {
      const box = worldFootprint(cutoutBounds(base, angle), def, toWorld);
      for (const k of ['x', 'x0', 'x1']) box[k] += f.offsetX + dx;
      for (const k of ['z', 'z0', 'z1']) box[k] += f.offsetZ + dz;
      box.y = (def.y || 0) + base.y; // feet / underside rest on the ground
      return box;
    };
    const poseVisual = angle => {
      // scene.attach may express a half-turn as X/Z rotations instead of Y.
      // Set the whole pose explicitly so turning a room cannot reverse a tip.
      group.rotation.set(angle * localN.z, def.rot * Math.PI / 2, -angle * localN.x, 'YXZ');
    };
    f.tip = checked => {
      if (!checked?.ok || f.transition) return false;
      const before = { ...f };
      f.transition = { ...checked, time: 0, from: f.deployed ? Math.PI / 2 : 0 };
      bounds(checked.sweep); touch(before); return true;
    };
    f.tick = dt => {
      if (!f.transition || f.away) return;
      const t = f.transition; t.time = Math.min(1, t.time + Math.max(0, dt) / BRIDGE.tipSeconds);
      const ease = t.time * t.time * (3 - 2 * t.time), end = t.down ? Math.PI / 2 : 0;
      poseVisual(t.from + (end - t.from) * ease);
      if (t.time < 1) return;
      const before = { ...f };
      f.transition = null; f.deployed = t.down; f.support = t.down ? t.support : null;
      bounds(t.target); touch(before);
    };
  }
  f.remove = () => {
    touch();
    for (const list of [world.furniture, world.movableSurfaces, world.furnitureColliders, ...world.rooms.map(r => r.colliders)]) {
      for (const value of [f, f.collider]) { const i = list.indexOf(value); if (i >= 0) list.splice(i, 1); }
    }
    group.removeFromParent();
  };
  return f;
}
