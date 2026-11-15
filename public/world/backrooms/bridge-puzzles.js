// A room supplies a witness (where to stand, and where to drag the hinge),
// not a "trust me" flag. Rehearse with the real movement/support rules on
// copies, then flood the resulting floor. Never move a live mesh/collider.
import { toWorld, wallPoint } from './gen.js';
import { boxHits } from './furniture-policy.js';
import { createFurnitureMotion } from './furniture-motion.js';
import { canTip, surfaceAt } from './bridge-rules.js';

export function posedWorld(world, poses = new Map()) {
  const view = Object.create(world), ignored = new Set([...poses.keys()].map(item => item.collider));
  view.furniture = world.furniture.map(item => poses.get(item) || item);
  view.movableSurfaces = view.furniture.filter(item => item.bridge);
  view.furnitureColliders = view.furniture.map(item => item.collider);
  view.floorY = (x, z) => surfaceAt(view.movableSurfaces, x, z, world.terrainY(x, z));
  view.headroom = (x, z) => world.ceilingY(x, z) - view.floorY(x, z);
  view.passable = (ax, az, bx, bz) => view.headroom(bx, bz) >= .62 && Math.abs(view.floorY(ax, az) - view.floorY(bx, bz)) <= .26;
  view.free = (x, z, r = .22, opt = {}) => {
    const skip = new Set(ignored);
    if (opt.ignoreCollider instanceof Set) for (const c of opt.ignoreCollider) skip.add(c);
    else if (opt.ignoreCollider) skip.add(opt.ignoreCollider);
    if (!world.free(x, z, r, { ...opt, ignoreCollider: skip })) return false;
    for (const f of poses.values()) {
      const c = f.collider;
      if (c.on === false || c === opt.ignoreCollider || opt.ignoreCollider?.has?.(c) || c.floor && !opt.bounds || opt.furniture === 'phase' || opt.furnitureY >= c.top || opt.tall && !c.tall) continue;
      if (opt.bounds ? boxHits(opt.bounds, c) : boxHits(c, { x, z, r })) return false;
    }
    return true;
  };
  return view;
}

export function verifyBridgePlan(world, rt, plan, previous = new Map()) {
  const { item, stand, path } = plan;
  if (!item?.bridge || item.away || item.deployed || item.transition || previous.has(item) || !stand || !Array.isArray(path) || path.length > 8) return null;
  if (![stand.x, stand.z, ...path.flatMap(p => [p.x, p.z])].every(Number.isFinite)) return null;
  const me = { ...toWorld(rt.def, stand.x, stand.z), r: .225 }, f = { ...item, hinge: { ...item.hinge }, collider: { ...item.collider }, group: null };
  const poses = new Map(previous); poses.set(item, f);
  const view = posedWorld(world, poses); view.env = {}; view.bodies = [];
  const originalX = item.hinge.x, originalZ = item.hinge.z;
  f.pose = (angle, dx = 0, dz = 0) => item.pose(angle, f.hinge.x - originalX + dx, f.hinge.z - originalZ + dz);
  f.translate = (dx, dz) => {
    for (const k of ['x', 'x0', 'x1']) f[k] += dx;
    for (const k of ['z', 'z0', 'z1']) f[k] += dz;
    f.hinge.x += dx; f.hinge.z += dz;
    Object.assign(f.collider, { x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1 }); return true;
  };
  const nearX = Math.max(f.x0, Math.min(me.x, f.x1)), nearZ = Math.max(f.z0, Math.min(me.z, f.z1));
  if (!view.free(me.x, me.z, me.r) || Math.hypot(me.x - nearX, me.z - nearZ) > 1.25 || Math.abs(view.floorY(me.x, me.z) - f.y) > .015) return null;
  // You must be able to reach the actual object, not a handle through a wall.
  const n = Math.max(1, Math.ceil(Math.hypot(me.x - nearX, me.z - nearZ) / .04));
  for (let i = 0; i <= n; i++) if (!view.free(me.x + (nearX - me.x) * i / n, me.z + (nearZ - me.z) * i / n, .02, { ignoreCollider: f.collider, ghost: true })) return null;
  const motion = createFurnitureMotion(view);
  let travel = 0;
  for (const p of path) {
    const end = toWorld(rt.def, p.x, p.z), dx = end.x - f.hinge.x, dz = end.z - f.hinge.z, length = Math.hypot(dx, dz);
    travel += length; if (travel > 16) return null;
    const steps = Math.max(1, Math.ceil(length / .035));
    for (let i = 0; i < steps; i++) {
      // Same axis steps as the player/grip; diagonal plans cannot cut corners.
      for (const [sx, sz] of [[dx / steps, 0], [0, dz / steps]]) {
        if (Math.abs(sx) + Math.abs(sz) < 1e-7) continue;
        const moved = motion.move(f, sx, sz);
        if (Math.abs(moved.dx - sx) > 1e-6 || Math.abs(moved.dz - sz) > 1e-6 || !view.free(me.x + sx, me.z + sz, me.r) || !view.passable(me.x, me.z, me.x + sx, me.z + sz)) return null;
        me.x += sx; me.z += sz;
      }
    }
  }
  const checked = canTip(view, f, { actor: me, bodies: false });
  if (!checked.ok) return null;
  Object.assign(f, checked.target, { deployed: true, support: checked.support });
  Object.assign(f.collider, checked.target, { floor: true, tall: false });
  return poses;
}

/** Try from every doorway: a solution requiring a prop on the inaccessible
 * bank is not safe just because the room works in the other direction. */
export function bridgeReachable(world, rt) {
  const plans = rt.bridgePlans || [];
  if (!plans.length || plans.length > 8) return false;
  const doorPoints = rt.def.doors.map(dr => wallPoint(rt.def, dr.side, dr.c, .5));
  for (const source of rt.def.doors) {
    let poses = new Map(), solved = false;
    for (let pass = 0; pass <= plans.length; pass++) {
      const view = posedWorld(world, poses), walk = world.walkable(rt, view), seen = walk.flood([source]);
      if (doorPoints.every(p => walk.free(p.x, p.z) && seen[walk.key(p)])) { solved = true; break; }
      let next = null;
      for (const plan of plans) {
        if (!walk.free(plan.stand.x, plan.stand.z) || !seen[walk.key(plan.stand)]) continue;
        next = verifyBridgePlan(world, rt, plan, poses);
        if (next) break;
      }
      if (!next) break;
      poses = next;
    }
    if (!solved) return false;
  }
  return true;
}
