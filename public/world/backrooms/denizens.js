// The Backrooms — things that walk the floor. Room-bound oddities stay in their
// own files; anything that can follow you out through a doorway (the trunk line,
// the retention clerk, the safety warden, the efficiency partners) registers a
// walker here so it stays lit, stays on the carpet, and knows which doorways are
// shut against it.
import { makeRng, toWorld } from './gen.js';
import { buildItemProp, isPaper } from './hand.js';
import { populateAbsorbed } from './absorbed.js';
import * as THREE from 'three';

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

/** Drop a stray item into a plain connective room after the floor is built. */
function scatterStrayItems(env, R) {
  const { world, kit } = env;
  const plains = world.rooms.filter((rt) => rt.def.kind === 'plain' && rt.def.W >= 5 && rt.def.D >= 5 && !rt.def.crawl && !rt.def.shape);
  if (plains.length < 2) return;
  const picks = R.shuffle(plains);
  const items = [['papers', 0], ['balloon', 1]];
  for (const [kind, idx] of items) {
    const rt = picks[idx]; if (!rt) continue;
    // pick a quiet off-centre spot clear of furniture
    let spot = null;
    for (let t = 0; t < 20; t++) {
      const lx = R.range(-rt.def.W / 2 + 1.1, rt.def.W / 2 - 1.1);
      const lz = R.range(-rt.def.D / 2 + 1.1, rt.def.D / 2 - 1.1);
      const w = toWorld(rt.def, lx, lz);
      if (world.free(w.x, w.z, 0.45) && Math.abs(world.floorY(w.x, w.z) - rt.def.y) < 0.02) { spot = { lx, lz, wx: w.x, wz: w.z }; break; }
    }
    if (!spot) continue;
    let slot = kind;
    const holder = new THREE.Group();
    holder.position.set(spot.lx, 0, spot.lz);
    holder.rotation.y = R.range(0, 6.28);
    rt.group.add(holder);
    const models = new Map();
    const ensure = (k) => {
      if (!k || models.has(k)) return;
      const m = buildItemProp(kit, k, { view: false });
      holder.add(m); models.set(k, m);
    };
    ensure(slot);
    const refresh = () => {
      const L = world.lightAt(spot.wx, spot.wz, 0.5);
      const lit = [Math.max(0.2, L[0]), Math.max(0.2, L[1]), Math.max(0.2, L[2])];
      for (const [k, m] of models) { m.visible = k === slot; m.userData.light(lit); }
    };
    refresh();
    rt.uses.push({
      wx: spot.wx, wz: spot.wz, r: 1.45, cone: 0.45, label: `take ${kind}`,
      when: () => slot !== null && !!env.hand,
      use: () => {
        if (!env.hand || !slot) return;
        const taking = slot;
        slot = env.hand.swap(taking);
        if (slot) ensure(slot);
        refresh();
        env.play(isPaper(taking) ? 'rustle' : taking === 'flashlight' ? 'click' : 'squeak', spot.wx, spot.wz, 4);
      },
    });
  }
}

export function createDenizens(env) {
  const R = makeRng(`${env.level.seed}/denizens`);
  const list = [];

  (env.ready || (env.ready = [])).push(() => {
    scatterStrayItems(env, R);
    populateAbsorbed(env, R.fork('absorbed'));
    for (const d of list) if (d.group && !d.group.parent) env.world.scene.add(d.group);
  });

  const denizens = {
    all: () => list,
    add(d) {
      list.push(d);
      if (env.world && d.group && !d.group.parent) env.world.scene.add(d.group);
      return d;
    },
    update(dt, time) {
      const { world, player } = env;
      if (!world || !player) return;
      const me = player.me;
      const curRoom = world.current();
      const distMap = curRoom ? world.distances(curRoom.id) : null;
      for (const d of list) {
        if (d.gone) { if (d.group) d.group.visible = false; continue; }
        d.update?.(dt, time, me);
        if (d.group) {
          const rt = world.roomAt(d.x, d.z);
          const nearEnough = !distMap || !rt || (distMap.get(rt.id) ?? 99) <= 3;
          d.group.visible = nearEnough && !d.gone && d.visible !== false;
          d.group.position.set(d.x, (d.y ?? world.floorY(d.x, d.z)) + (d.lift || 0), d.z);
          d.light?.(d.sampleLight ? d.sampleLight(world) : world.lightAt(d.x, d.z, 1.0));
        }
      }
    },
    dispose() {
      for (const d of list) { d.dispose?.(); d.group?.removeFromParent(); }
      list.length = 0;
    },
  };
  env.denizens = denizens;
  return denizens;
}
