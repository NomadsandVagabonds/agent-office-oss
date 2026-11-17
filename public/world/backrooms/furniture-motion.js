// Movable office furniture. Pure geometry and small swept steps: the world
// owns the meshes, collisions and room revisions; this only approves moves.

import { furnitureEntryTime } from './furniture-rules.js';
import { bridgeSupport, canTip, bodyOver } from './bridge-rules.js';

/** Relative weight; player and creature movement rates in metres/second. */
export const FURNITURE = Object.freeze({
  chair: Object.freeze({ weight: 1, playerSpeed: 1.1, pushSpeed: 0.85 }),
  desk: Object.freeze({ weight: 3, playerSpeed: 0.45, pushSpeed: 0.4 }),
  trolley: Object.freeze({ weight: 1.5, playerSpeed: 0.85, pushSpeed: 0.65 }),
  prop: Object.freeze({ weight: 1.5, playerSpeed: .75, pushSpeed: .6 }),
  cutout: Object.freeze({ weight: 1, playerSpeed: .9, pushSpeed: .7 }),
});
const STEP = 0.04, MAX_MOVE = 0.5, SAMPLE = 0.1, FLOOR_EPS = 0.012, EPS = 1e-6;
const none = () => ({ dx: 0, dz: 0, moved: false });
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const ignores = (choice, body) => !!body && (choice === body || choice instanceof Set && choice.has(body));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const shifted = (item, dx, dz) => ({ x0: item.x0 + dx, z0: item.z0 + dz, x1: item.x1 + dx, z1: item.z1 + dz });
const distance2 = (p, b) => (p.x - clamp(p.x, b.x0, b.x1)) ** 2 + (p.z - clamp(p.z, b.z0, b.z1)) ** 2;

/**
 * world.furniture contains world-coordinate records. translate(dx,dz) owns
 * updating all bounds, the collider, mesh, room ownership and local revisions.
 * world.free accepts opt.bounds (an exact footprint), ignoreCollider and
 * ignoreBody identities. No collider is temporarily disabled during a query.
 */
/** How far above or below its carrier's floor a carried thing may be set down (a stair and a bit). */
export const SET_DOWN_STEP = 0.4;

export function createFurnitureMotion(world) {
  const away = new Map();
  function usable(item) {
    return !!item && !item.away && world.furniture?.includes(item) && Object.hasOwn(FURNITURE, item.type)
      && !!item.collider && typeof item.translate === 'function'
      && ['x', 'z', 'x0', 'z0', 'x1', 'z1', 'y', 'top'].every(k => Number.isFinite(item[k]))
      && item.x1 > item.x0 && item.z1 > item.z0 && item.x1 - item.x0 <= 4 && item.z1 - item.z0 <= 4 && item.top > item.y;
  }
  function fits(item, dx, dz, ignoreBody) {
    if (item.transition || item.deployed && item.support?.spansGap) return false;
    const bounds = shifted(item, dx, dz), x = item.x + dx, z = item.z + dz;
    if (!world.free(x, z, 0, { bounds, bottom: item.y, top: item.top, ignoreCollider: item.collider, ignoreBody })) return false;
    // The player is not in world.bodies; creatures are. Both stop a desk.
    const players = world.env?.players?.() || [world.env?.player];
    for (const player of players) {
      const me = player?.me, radius = player?.RADIUS || .22;
      if (point(me) && !ignores(ignoreBody, me) && distance2(me, bounds) < radius * radius - EPS) return false;
    }
    if (item.deployed) {
      if (players.some(p=>p?.me && bodyOver(item, {...p.me,r:p.RADIUS||.22})) || (world.bodies || []).some(b=>b.on!==false && !b.airborne && bodyOver(item,b))) return false;
      return bridgeSupport(world, { ...item, ...bounds }, item.bridge.axis, item.bridge.bearing).ok;
    }
    // Check the interior as well as the corners: four good legs do not make
    // a desk safe to slide over a hole. Furniture does not climb or fall.
    const nx = Math.ceil((bounds.x1 - bounds.x0) / SAMPLE), nz = Math.ceil((bounds.z1 - bounds.z0) / SAMPLE);
    for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
      const px = bounds.x0 + (bounds.x1 - bounds.x0) * ix / nx, pz = bounds.z0 + (bounds.z1 - bounds.z0) * iz / nz;
      const room = world.roomAt(px, pz), floor = world.floorY(px, pz), head = world.headroom(px, pz);
      if (!room || room.fold || room.def?.kind === 'exit' || room.def?.way
        || !Number.isFinite(floor) || Math.abs(floor - item.y) > FLOOR_EPS
        || !Number.isFinite(head) || floor + head < item.top + 0.01) return false;
    }
    return true;
  }
  /** Swept, straight movement, at most half a metre per call. Returns its actual delta; a blocked move can be partial. */
  function move(item, dx, dz, { ignoreBody } = {}) {
    if (!usable(item) || item.carried || !Number.isFinite(dx) || !Number.isFinite(dz)) return none();
    const length = Math.hypot(dx, dz);
    if (!Number.isFinite(length) || length < EPS) return none();
    const scale = Math.min(1, MAX_MOVE / length), stride = Math.min(STEP, (item.x1 - item.x0) / 2, (item.z1 - item.z0) / 2);
    const steps = Math.ceil(Math.min(length, MAX_MOVE) / stride);
    if (steps > 256) return none();               // malformed microscopic bounds cannot create an unbounded sweep
    let ax = 0, az = 0;
    for (let i = 1; i <= steps; i++) {
      const tx = dx * scale * i / steps, tz = dz * scale * i / steps;
      if (!fits(item, tx, tz, ignoreBody)) break;
      ax = tx; az = tz;
    }
    if (Math.hypot(ax, az) < EPS || item.translate(ax, az) === false) return none();
    if (item.deployed) item.support = bridgeSupport(world, item, item.bridge.axis, item.bridge.bearing);
    return { dx: ax, dz: az, moved: true };
  }
  /** A carried prop is intangible in transit. Only setting it down needs a
   * full footprint/body/floor check; it does not sweep back through the path
   * the visitor has already walked. Supports a different landing height. */
  function place(item, x, z, { from } = {}) {
    if (!usable(item) || ![x, z].every(Number.isFinite)) return false;
    const floor = world.floorY(x, z), dy = floor - item.y;
    if (!Number.isFinite(floor)) return false;
    // `from`: the floor its carrier stands on. Nothing is set down more than a step above or below that: not into a pit
    // (where it would be lost, or stand in the air over one), and not up onto a ledge out of reach.
    if (Number.isFinite(from) && Math.abs(floor - from) > SET_DOWN_STEP) return false;
    // Something a room authored (movable-props.js) may come to rest at another height now that its translate() moves its
    // picture and its collider up and down together — but only where somebody is standing to put it: with no carrier's
    // floor given, it stays at the height it is.
    if (item.authored && Math.abs(dy) > FLOOR_EPS && !Number.isFinite(from)) return false;
    const dx = x - item.x, dz = z - item.z;
    if (!fits({ ...item, y: floor, top: item.top + dy }, dx, dz)) return false;
    if (Math.hypot(dx, dz, dy) >= EPS && item.translate(dx, dz, dy) === false) return false;
    return true;
  }
  /** The first solid movable thing a circular walker would meet on a straight segment, or null. */
  function blocking(a, b, r = 0.22) {
    if (!point(a) || !point(b) || !Number.isFinite(r) || r < 0 || r > 4) return null;
    let closest = null, at = Infinity;
    for (const item of world.furniture || []) {
      if (!usable(item) || item.collider.on === false || item.collider.floor) continue;
      const t = furnitureEntryTime(a, b, r, item);
      if (t < at) { at = t; closest = item; }
    }
    return closest;
  }
  /** A nearby creature pushes away from itself, trying sideways if a jamb stops the straight shove. */
  function shove(item, actor, dt) {
    if (!usable(item) || !point(actor) || !Number.isFinite(dt) || dt <= 0) return none();
    const radius = Number.isFinite(actor.r) && actor.r > 0 ? actor.r : 0.22;
    if (distance2(actor, item) > (radius + 0.6) ** 2) return none();
    const dx = item.x - actor.x, dz = item.z - actor.z, distance = Math.hypot(dx, dz);
    if (distance < EPS) return none();
    const touch = { x: clamp(actor.x, item.x0, item.x1), z: clamp(actor.z, item.z0, item.z1) };
    const count = Math.max(1, Math.ceil(Math.hypot(touch.x - actor.x, touch.z - actor.z) / STEP));
    for (let i = 0; i <= count; i++) {
      const x = actor.x + (touch.x - actor.x) * i / count, z = actor.z + (touch.z - actor.z) * i / count;
      if (!world.free(x, z, 0.02, { ignoreCollider: item.collider, ignoreBody: actor.body })
        || Math.abs(world.floorY(x, z) - item.y) > FLOOR_EPS) return none();
    }
    const step = FURNITURE[item.type].pushSpeed * Math.min(dt, 0.1);
    for (const angle of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
      const c = Math.cos(angle), s = Math.sin(angle);
      const moved = move(item, (dx * c - dz * s) / distance * step, (dx * s + dz * c) / distance * step, { ignoreBody: actor.body });
      if (moved.moved) return moved;
    }
    return none();
  }
  /** A changing room takes moved furniture with it, at its current location.
   * Keep the exact collision state: a construction-rescue exception must not
   * silently become solid again merely because its room returns. */
  function takeAway(inside, key) {
    if (typeof inside !== 'function' || typeof key !== 'string' || !key) return [];
    const gone = [];
    for (const item of world.furniture || []) {
      if (!usable(item) || !inside(item.x, item.z)) continue;
      away.set(item, { key, on: item.collider.on, visible: item.group?.visible });
      item.away = key; item.collider.on = false;
      if (item.group) item.group.visible = false;
      world.touchFurniture?.(item);
      gone.push(item);
    }
    return gone;
  }
  function bringBack(key) {
    const back = [];
    for (const [item, saved] of away) {
      if (saved.key !== key) continue;
      away.delete(item);
      if (!world.furniture?.includes(item)) continue;
      item.away = null; item.collider.on = saved.on;
      if (item.group) item.group.visible = saved.visible;
      world.touchFurniture?.(item);
      back.push(item);
    }
    world.refreshFurniture?.();
    return back;
  }
  function tip(item, actor) {
    if (!usable(item)) return { ok: false, reason: 'fixed' };
    const checked = canTip(world, item, { actor });
    if (checked.ok && !item.tip?.(checked)) return { ok: false, reason: 'busy' };
    return checked;
  }
  return { move, place, blocking, shove, tip, takeAway, bringBack, version: room => world.furnitureRevision?.get(room) || 0 };
}
