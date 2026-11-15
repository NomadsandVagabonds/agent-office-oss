// Furniture follows its physical placement, not a special copy of a chair.
// Pure rules shared by the world builder and its tests. Heights here are
// room-local; the world records made from them are in floor coordinates.
export const FURNITURE = Object.freeze({ chair: 'Chair', desk: 'Desk', trolley: 'Trolley' });
export const furnitureType = type => Object.hasOwn(FURNITURE, type);
export const overlaps = (a, b, pad = 0) => a.x1 > b.x0 + pad && a.x0 < b.x1 - pad && a.z1 > b.z0 + pad && a.z0 < b.z1 - pad;

/** A fixed exception must have visible structure explaining it. */
export function fixedFurnitureReason(type, foot, opt = {}, floor = 0, stacked = false) {
  if (!furnitureType(type)) return 'other';
  if (opt.fixed) return 'anchored';
  if (opt.flip || (opt.quat && (Math.abs(opt.quat.x) > .06 || Math.abs(opt.quat.z) > .06)) || (opt.tilt || []).some(v => Math.abs(v) > .12)) return 'wedged';
  if (foot.bottom < floor - .06) return 'sunk';
  if (foot.bottom > floor + .06) return 'raised';
  if (stacked) return 'stacked';
  return null;
}

/** Small things resting on a desktop, including a screen just above its CRT. */
export function onFurniture(foot, item, { gap = .16, rise = 1.3, edge = .12 } = {}) {
  return item.bottom >= foot.top - gap && item.top <= foot.top + rise
    && item.x0 >= foot.x0 - edge && item.x1 <= foot.x1 + edge
    && item.z0 >= foot.z0 - edge && item.z1 <= foot.z1 + edge;
}

/** Transform a room-local footprint through its quarter-turn into floor space. */
export function worldFootprint(foot, room, toWorld) {
  const a = toWorld(room, foot.x0, foot.z0), b = toWorld(room, foot.x1, foot.z1), p = toWorld(room, foot.x, foot.z);
  return { x: p.x, z: p.z, x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z),
    y: (room.y || 0) + foot.bottom, top: (room.y || 0) + foot.top };
}

/** A box footprint against another box or a circular body; touching is allowed. */
export function boxHits(box, obstacle) {
  if (obstacle.on === false) return false;
  if (obstacle.r === undefined) return overlaps(box, obstacle);
  const dx = obstacle.x - Math.max(box.x0, Math.min(obstacle.x, box.x1));
  const dz = obstacle.z - Math.max(box.z0, Math.min(obstacle.z, box.z1));
  return dx * dx + dz * dz < obstacle.r * obstacle.r;
}
