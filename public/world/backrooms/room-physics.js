// Room-local physical residents: their rigs stay under the room's transform,
// while collision and furniture use world coordinates. Tape/shadow figures do
// not register here: playing back a recorded image is deliberately spectral.
import { stepWalker } from './denizens.js';
import { furnitureClear } from './furniture-rules.js';

export function roomBody(c, actor, { r = .22, tall = 1.45 } = {}) {
  actor.r = r; actor.tall = tall;
  if (!c.env.barricadesEnabled) return null;
  const body = {
    get x() { return c.toWorld(actor.x, actor.z).x; },
    get z() { return c.toWorld(actor.x, actor.z).z; },
    r,
    get on() { return !actor.gone && !actor.away && actor.physical !== false && actor.group.visible !== false; },
  };
  c.world.bodies.push(body);
  actor.body = body;
  const before = actor.group.userData.dispose;
  actor.group.userData.dispose = () => {
    const i = c.world.bodies.indexOf(body);
    if (i >= 0) c.world.bodies.splice(i, 1);
    before?.();
  };
  return body;
}

export function moveRoomWalker(c, actor, x, z, distance) {
  if (actor.away || actor.gone) return 0;
  const start = c.toWorld(actor.x, actor.z), target = c.toWorld(x, z);
  const walker = { ...start, r: actor.r ?? .22, tall: actor.tall ?? 1.45 };
  // Party, Stand-Ins and Speaker are room-bound scripts, unlike the residents
  // registered with denizens. A sidestep must not slip through a doorway into
  // another room (including a disappearing end of Unsure Hall).
  const localWorld = Object.create(c.world);
  localWorld.free = (wx, wz, r, opt) => {
    const at = c.toLocal(wx, wz);
    return Math.abs(at.x) <= c.W / 2 - r && Math.abs(at.z) <= c.D / 2 - r
      && c.world.roomAt(wx, wz) === c.rt && c.world.free(wx, wz, r, opt);
  };
  const went = stepWalker(localWorld, walker, target.x, target.z, Math.max(0, distance));
  const at = c.toLocal(walker.x, walker.z);
  actor.x = at.x; actor.z = at.z;
  return went;
}

export function roomContact(c, a, b, radius = .035) {
  if (a.away || a.gone) return false;
  const from = c.toWorld(a.x, a.z), to = c.toWorld(b.x, b.z);
  return c.world.los(from.x, from.z, to.x, to.z) && furnitureClear(c.world, from.x, from.z, to.x, to.z, radius);
}

// A room's supernatural setback may teleport the visitor, but its destination
// still needs a real space to stand after furniture has been moved there.
export function roomReturn(c, x, z) {
  const radius = c.env.player?.RADIUS ?? .22;
  for (let ring = 0; ring <= 10; ring++) {
    const count = ring ? 16 : 1;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count, at = c.toWorld(x + Math.sin(angle) * ring * .25, z + Math.cos(angle) * ring * .25);
      if (c.world.roomAt(at.x, at.z) === c.rt && c.world.free(at.x, at.z, radius)) return at;
    }
  }
  return null;
}

// A grab moves the player continuously, never teleporting through a desk (or a
// wall) even on a long frame. Releasing a blocked pull prevents delayed damage
// through a barrier that was placed after the original grab.
export function pullPlayer(world, player, x, z, yaw, ignoreBody = null) {
  if (!player) return false;
  const me = player.me, radius = player.RADIUS ?? .22;
  const dx = x - me.x, dz = z - me.z, distance = Math.hypot(dx, dz);
  const count = Math.max(1, Math.ceil(distance / .04));
  let ax = me.x, az = me.z, reached = true;
  for (let i = 1; i <= count; i++) {
    const nx = me.x + dx * i / count, nz = me.z + dz * i / count;
    if (!furnitureClear(world, ax, az, nx, nz, radius) || !world.free(nx, nz, radius, { ignoreBody }) || !world.passable(ax, az, nx, nz)) { reached = false; break; }
    ax = nx; az = nz;
  }
  if (Math.hypot(ax - me.x, az - me.z) > 1e-6) player.warp(ax, az, yaw);
  return reached;
}
