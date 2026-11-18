import { createWalk } from '../../cast/walk.js';
import { buildSmilingClimber } from '../cubicle-grid/rig.js';
import { flightAt, TOWER } from './plan.js';

const COUNT = 6;
const RESIDENT = 'towel-return';
const SPREAD = Math.PI * 2 / COUNT;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const heading = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function buildPack(c) {
  return Array.from({ length: COUNT }, (_, i) => {
    const rig = buildSmilingClimber(c.kit, i, { swimTrunks: true });
    const { group } = rig;
    group.name = 'dive-smiler';
    group.visible = false;
    c.world.scene.add(group);
    const row = Math.floor(i / 3), lane = i % 3 - 1;
    const spawn = c.toWorld(lane * (row ? 1.55 : 1.08), c.D / 2 - (row ? 1.02 : 1.58));
    return {
      ...spawn, rig, group, row, lane, r: .21, tall: 1.37, board: 0,
      speed: [1.48, 1.52, 1.46, 1.40, 1.50, 1.43][i],
      delay: [.47, .25, .70, 1.12, .94, 1.30][i], attackUntil: 0,
    };
  });
}

export function createChase(c) {
  const { world, env } = c;
  const link = c.room.doors.find(d => c.level.rooms[d.to]?.arch === TOWER);
  const foyer = c.room.doors.find(d => d.side === 'front')?.to;
  const pack = buildPack(c), safe = new WeakSet(), riding = new WeakSet(), hitAt = new WeakMap();
  const walk = createWalk({
    world, level: c.level,
    get doors() { return env.doors; },
    get barricades() { return env.barricades; },
    get absorbed() { return env.absorbed; },
  });
  let tower, time = 0, began = null;

  function addTower(ctx, plan) { tower = { ctx, plan, last: plan.platforms.length - 1 }; }

  function start() {
    if (began !== null || !link) return;
    began = time;
    world.setLights(c.rt, .43);
    const at = c.toWorld(0, c.D / 2 - 1.35);
    env.play?.('rattle', at.x, at.z, 6);
    c.met(RESIDENT);
  }

  function escape(body) {
    if (safe.has(body)) return;
    safe.add(body);
    if (began !== null) c.survived(RESIDENT);
  }

  function catchVisitor(context, { world: body }) {
    if (began === null || body.frozen || safe.has(body) || riding.has(body) || (hitAt.get(body) ?? 0) > time) return;
    for (const actor of pack) {
      if (!actor.group.visible || actor.jump || distance(body, actor) > .62) continue;
      if (Math.abs(body.y - 1.1 - actor.group.position.y) > .54) continue;
      if (!walk.clear(actor, actor.x, actor.z, body.x, body.z)) continue;
      context.hurt(1, actor);
      hitAt.set(body, time + 1.6);
      actor.attackUntil = time + .32;
      break;
    }
  }

  function inEncounter(body) {
    const id = world.roomAt(body.x, body.z)?.id;
    return id != null && (id === c.rt.id || id === link?.to || id === foyer);
  }

  function boardOf(body) {
    if (!tower || world.roomAt(body.x, body.z) !== tower.ctx.rt) return -1;
    const { ctx, plan, last } = tower;
    if (safe.has(body)) return last;
    const ride = ctx.rt.diving.getRide(body), index = ride ? plan.flights.indexOf(ride.hop) : -1;
    if (index >= 0) return Math.min(index + 1, last);
    const local = ctx.toLocal(body.x, body.z);
    return plan.platforms.findIndex((b, i) => local.z >= b.nose && local.z <= b.rear
      && (i === 0 || Math.abs(local.x - b.x) <= b.half));
  }

  function approach(actor, body, i) {
    // Spread around the visitor, falling back to a direct approach by a wall.
    const angle = body.yaw + i * SPREAD, x = body.x + .39 * Math.sin(angle), z = body.z + .39 * Math.cos(angle);
    if (world.roomAt(x, z) === world.roomAt(body.x, body.z) && walk.stand(actor, x, z)
      && world.passable(body.x, body.z, x, z) && world.los(x, z, body.x, body.z)) return { x, z };
    return body;
  }

  function separate(actor, dt) {
    let dx = 0, dz = 0;
    for (const other of pack) {
      if (other === actor || !other.group.visible || other.jump || other.board !== actor.board) continue;
      const gap = distance(actor, other);
      if (gap >= .52) continue;
      const push = (.52 - gap) / Math.max(.04, gap);
      dx += (actor.x - other.x) * push;
      dz += (actor.z - other.z) * push;
    }
    const push = Math.hypot(dx, dz);
    if (push > .01) walk.stride(actor, actor.x + dx, actor.z + dz, Math.min(push * .36, .88) * dt);
  }

  function towerPoint(x, z, y) {
    return { ...tower.ctx.toWorld(x, z), y: tower.ctx.room.y + y };
  }

  function beginJump(actor, hop) {
    for (const offset of [actor.lane * .52, 0, -actor.lane * .52]) {
      const landing = towerPoint(hop.x + offset, hop.z - actor.row * .22, hop.y);
      if (!walk.stand(actor, landing.x, landing.z)) continue;
      actor.jump = {
        from: { x: actor.x, z: actor.z, y: actor.group.position.y },
        to: landing, age: 0, seconds: hop.seconds + actor.row * .05,
      };
      walk.forget(actor);
      break;
    }
  }

  function advanceJump(actor, dt) {
    const jump = actor.jump;
    jump.age += dt;
    const at = flightAt(jump.from, jump.to, jump.age / jump.seconds);
    actor.x = at.x; actor.z = at.z;
    if (jump.age >= jump.seconds) { actor.board++; actor.jump = null; }
    return at.y;
  }

  function pursue(actor, body, targetBoard, dt, i) {
    if (actor.jump) return advanceJump(actor, dt);
    const inTower = tower && world.roomAt(actor.x, actor.z) === tower.ctx.rt;
    const needsJump = inTower && targetBoard > actor.board;
    const peering = inTower && safe.has(body) && actor.board === tower.last;
    let target, keep = .05;
    if (needsJump || peering) {
      const board = tower.plan.platforms[actor.board];
      target = towerPoint(board.x + actor.lane * .78, board.nose + .31 + (peering ? actor.row * .68 : 0), board.y);
      keep = .01;
    } else target = approach(actor, body, i);
    walk.go(actor, target, actor.speed * dt, keep);
    if (needsJump && distance(actor, target) < .12) beginJump(actor, tower.plan.flights[actor.board]);
    else if (!peering) separate(actor, dt);
    return world.floorY(actor.x, actor.z);
  }

  function update(dt, now, visitor) {
    time = now;
    if (began === null) return;
    // In co-op, a guest still on the boards stays a target after somebody dives.
    const body = [visitor.world, ...(env.players?.() ?? []).map(p => p.me)]
      .find(p => !p.frozen && !safe.has(p) && inEncounter(p)) ?? visitor.world;
    if (!inEncounter(body)) return;
    if (world.roomAt(body.x, body.z)?.id === foyer) catchVisitor(c, { world: body });
    const targetBoard = boardOf(body);
    for (const [i, actor] of pack.entries()) {
      if (now < began + actor.delay) continue;
      if (!actor.group.visible) {
        if (!walk.stand(actor, actor.x, actor.z)) continue;
        actor.group.visible = true;
        actor.group.position.set(actor.x, world.floorY(actor.x, actor.z), actor.z);
      }
      const before = { x: actor.x, z: actor.z };
      const y = pursue(actor, body, targetBoard, dt, i);
      const moved = distance(before, actor) > .001;
      const close = Math.abs(body.y - 1.1 - y) < .62 && distance(body, actor) < 3.2
        && world.los(actor.x, actor.z, body.x, body.z);
      const peering = safe.has(body) && actor.board === tower?.last && !moved;
      const yaw = actor.group.rotation.y;
      const aim = close || peering ? heading(actor, body) : moved ? heading(before, actor) : yaw;
      actor.group.position.set(actor.x, y, actor.z);
      actor.group.rotation.y += turn(yaw, aim) * Math.min(1, dt * 12);
      actor.rig.pose(actor.jump ? 'falling' : 'stalking', now + i * .23);
      if (peering) actor.rig.head.rotation.x = .32;
      if (moved && !actor.jump) {
        actor.rig.armL.rotation.z *= .55;
        actor.rig.armR.rotation.z *= .55;
      }
      if (now < actor.attackUntil) {
        actor.rig.armL.rotation.x = actor.rig.armR.rotation.x = -1.64;
        actor.rig.armL.rotation.z = -.25;
        actor.rig.armR.rotation.z = .25;
      }
      const room = world.roomAt(actor.x, actor.z);
      actor.rig.light(world.lightAt(actor.x, actor.z, y - (room?.def.y ?? 0) + 1.05));
    }
  }

  return { addTower, start, catchVisitor, update, escape, riding, pack, get started() { return began !== null; } };
}
