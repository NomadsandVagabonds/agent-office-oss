// The Backrooms — the residents of rooms that walk (after Gemini's third pack). The cast that roams a whole part of the
// building is cast/ and pursuer.js; these belong to one room each and may follow you out of it. What is lying about for
// them is supplies.js's business, by the seed. A shut pair of fire doors (doors.js) is wall to all of them: none can
// work a handle. Nothing follows across a seam.
// Things that walk the floor. Room-bound oddities stay in their
// own files; anything that can follow you out through a doorway (the trunk line,
// the retention clerk, the safety warden, the efficiency partners) registers a
// walker here so it stays lit, stays on the carpet, and knows which doorways are
// shut against it.
import { makeRng } from './gen.js';
import { populateAbsorbed } from './absorbed.js';

/**
 * Step a walker `(a.x, a.z)` toward `(tx, tz)` by up to `dist` metres, sliding
 * round walls and furniture. `a.tall` sets how much headroom it needs (0.62 m
 * lets coiled cabling slip through crawl holes; 1.45 m keeps upright staff out).
 */
export function stepWalker(world, a, tx, tz, dist, { closedDoor = null } = {}) {
  const stand = (x, z) => {
    if (!world.free(x, z, a.r ?? 0.24, { ghost: true })) return false;
    if (world.headroom(x, z) < (a.tall ?? 1.45)) return false;
    if (!world.passable(a.x, a.z, x, z)) return false;
    if (closedDoor && Math.hypot(x - closedDoor.x, z - closedDoor.z) < 0.58) return false;
    return true;
  };
  let went = 0;
  let rem = dist;
  while (rem > 1e-3) {
    const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    if (d < 0.02) break;
    const s = Math.min(rem, d, 0.085);
    let moved = false;
    for (const turn of [0, 0.55, -0.55, 1.15, -1.15, 1.7, -1.7]) {
      const cs = Math.cos(turn), sn = Math.sin(turn);
      const ux = (dx * cs - dz * sn) / d, uz = (dx * sn + dz * cs) / d;
      const nx = a.x + ux * s, nz = a.z + uz * s;
      if (stand(nx, nz)) {
        a.x = nx; a.z = nz; went += s; moved = true;
        a.heading = Math.atan2(ux, uz);
        break;
      }
    }
    if (!moved) break;
    rem -= s;
  }
  return went;
}

/**
 * Find the next world waypoint from walker `(ax, az)` toward `( gx, gz )`.
 * When `needsOpenDoor` is true, a closed doorway stops the route at its leaf
 * and reports `doorBlocked: true`.
 */
export function routeToward(world, ax, az, gx, gz, { needsOpenDoor = false } = {}) {
  const here = world.roomAt(ax, az), there = world.roomAt(gx, gz);
  if (!here || !there) return { tx: gx, tz: gz, doorBlocked: false, door: null };
  if (here.id === there.id) return { tx: gx, tz: gz, doorBlocked: false, door: null };
  const path = world.path(here.id, there.id);
  if (!path || path.length < 2) return { tx: gx, tz: gz, doorBlocked: false, door: null };
  const door = world.doorway(here.id, path[1]);
  if (!door) return { tx: gx, tz: gz, doorBlocked: false, door: null };
  if (needsOpenDoor && !door.open) {
    const dist = Math.hypot(door.x - ax, door.z - az);
    return { tx: door.x, tz: door.z, doorBlocked: dist < 1.05, closedDoor: door, door };
  }
  const nextRt = world.rooms[path[1]];
  const sign = Math.sign((nextRt.def.cx - door.x) * door.nx + (nextRt.def.cz - door.z) * door.nz) || 1;
  const nearDoor = Math.hypot(door.x - ax, door.z - az) < 0.72;
  return {
    tx: door.x + (nearDoor ? door.nx * sign * 0.85 : 0),
    tz: door.z + (nearDoor ? door.nz * sign * 0.85 : 0),
    doorBlocked: false,
    door,
  };
}

export function createDenizens(env) {
  const list = [];

  // Placement is not a behaviour tick. A newly built part is visible during
  // the fall, while its residents are frozen: put each in its room before
  // adding it to the scene, rather than leaving its mesh at the landing.
  function present(d, distMap) {
    if (!d.group) return;
    const world = env.world;
    if (!world || d.gone || d.away) { d.group.visible = false; return; }
    const rt = world.roomAt(d.x, d.z);
    const nearEnough = !rt || (distMap ? (distMap.get(rt.id) ?? 99) <= 3 : rt.group.visible);
    d.group.position.set(d.x, (d.y ?? world.floorY(d.x, d.z)) + (d.lift || 0), d.z);
    d.group.visible = nearEnough && d.visible !== false;
    d.light?.(d.sampleLight ? d.sampleLight(world) : world.lightAt(d.x, d.z, 1.0));
  }
  function attach(d) {
    present(d);
    if (env.world && d.group && !d.group.parent) env.world.scene.add(d.group);
  }

  (env.ready || (env.ready = [])).push(() => {
    // colleagues the building is keeping (absorbed.js, after Gemini's fifth pack): a few to a part, in its plain rooms,
    // by dice of their own, so that they move nothing else about a seed
    populateAbsorbed(env, makeRng(`${env.level.seed}/absorbed`));
    for (const d of list) attach(d);
  });

  const denizens = {
    all: () => list,
    add(d) {
      list.push(d);
      attach(d);
      return d;
    },
    /** Refresh room visibility after arrival, without waking or advancing anybody. */
    sync() { for (const d of list) present(d); },
    update(dt, time) {
      const { world, player } = env;
      if (!world || !player) return;
      const me = player.me;
      const curRoom = world.current();
      const distMap = curRoom ? world.distances(curRoom.id) : null;
      for (const d of list) {
        if (d.gone || d.away) { if (d.group) d.group.visible = false; continue; }          // (away: the room it was standing in has gone, and it with it)
        d.update?.(dt, time, me);
        present(d, distMap);
      }
    },
    /** A room has gone and taken whoever was in it (pursuer.js, takeAway: the same, for the residents that walk) · and is back. */
    takeAway(inside, key) { const gone = list.filter((d) => !d.gone && !d.away && Number.isFinite(d.x) && Number.isFinite(d.z) && inside(d.x, d.z)); for (const d of gone) { d.away = key; if (d.group) d.group.visible = false; } return gone.length; },
    bringBack(key) { const back = list.filter((d) => d.away === key); for (const d of back) { d.away = null; present(d); } return back.length; },
    dispose() {
      for (const d of list) { d.dispose?.(); d.group?.removeFromParent(); }
      list.length = 0;
    },
  };
  env.denizens = denizens;
  return denizens;
}
