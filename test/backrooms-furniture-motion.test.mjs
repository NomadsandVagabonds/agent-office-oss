import test from 'node:test';
import assert from 'node:assert/strict';
import { createFurnitureMotion, FURNITURE } from '../public/world/backrooms/furniture-motion.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const circleHits = (p, b) => (p.x - clamp(p.x, b.x0, b.x1)) ** 2 + (p.z - clamp(p.z, b.z0, b.z1)) ** 2 < p.r ** 2 - 1e-9;
const skipped = (choice, body) => choice === body || choice instanceof Set && choice.has(body);

// Analytic fixtures stand in for the world's collision contract; neither
// Three nor a renderer is needed to test the physical move decisions.
function fixture({ floor = () => 0, head = () => 3, right = {}, walls = [] } = {}) {
  const rooms = [{ id: 0, def: { kind: 'plain' } }, { id: 1, def: { kind: 'plain', ...right } }];
  const world = {
    rooms, furniture: [], bodies: [], env: {}, furnitureRevision: new Map(),
    floorY: floor, headroom: head,
    roomAt(x, z) { return Math.abs(x) < 5 && Math.abs(z) < 5 ? rooms[x < 0 ? 0 : 1] : null; },
    free(x, z, r, opt = {}) {
      const box = opt.bounds;
      const bounds = box || { x0: x - r, x1: x + r, z0: z - r, z1: z + r };
      if (bounds.x0 <= -5 || bounds.x1 >= 5 || bounds.z0 <= -5 || bounds.z1 >= 5) return false;
      for (const collider of [...walls, ...world.furniture.map(item => item.collider)]) {
        if (collider.on === false || skipped(opt.ignoreCollider, collider)) continue;
        if (box ? overlap(box, collider) : circleHits({ x, z, r }, collider)) return false;
      }
      for (const body of world.bodies) if (!skipped(opt.ignoreBody, body)
        && (box ? circleHits(body, box) : Math.hypot(x - body.x, z - body.z) < r + body.r)) return false;
      return true;
    },
  };
  function add({ x = -1, z = 0, w = 0.4, d = 0.4, type = 'chair', y = 0, h = 0.9 } = {}) {
    const item = { id: 'furniture-' + world.furniture.length, type, label: type, x, z, y, top: y + h,
      x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, room: world.roomAt(x, z)?.id };
    item.collider = { x0: item.x0, z0: item.z0, x1: item.x1, z1: item.z1 };
    Object.defineProperty(item.collider, 'on', { get: () => true, set: () => assert.fail('a movement query must not switch off its collider') });
    item.visual = { x, z }; item.moves = 0;
    item.translate = (dx, dz) => {
      const before = item.room; item.moves++;
      item.x += dx; item.z += dz;
      for (const b of [item, item.collider]) { b.x0 += dx; b.x1 += dx; b.z0 += dz; b.z1 += dz; }
      item.visual.x += dx; item.visual.z += dz;
      item.room = world.roomAt(item.x, item.z)?.id;
      for (const id of new Set([before, item.room])) world.furnitureRevision.set(id, (world.furnitureRevision.get(id) || 0) + 1);
      return true;
    };
    world.furniture.push(item); return item;
  }
  return { world, add, motion: createFurnitureMotion(world) };
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} differs from ${b}`);

test('furniture motion: moves one coherent record/collider/visual and changes only the affected room revision', () => {
  const { add, motion } = fixture(), item = add();
  assert.equal(motion.version(0), 0); assert.equal(motion.version(1), 0);
  const moved = motion.move(item, 0.3, 0.2);
  assert.equal(moved.moved, true); close(moved.dx, 0.3); close(moved.dz, 0.2);
  close(item.x, -0.7); close(item.z, 0.2); close(item.collider.x0, -0.9); close(item.collider.z1, 0.4);
  assert.deepEqual(item.visual, { x: item.x, z: item.z });
  assert.equal(item.moves, 1, 'the rendering/ownership commit happens once, not once per sweep sample');
  assert.equal(motion.version(0), 1); assert.equal(motion.version(1), 0);
  assert.deepEqual(motion.move(item, 0, 0), { dx: 0, dz: 0, moved: false });
  assert.equal(motion.version(0), 1);
});

test('furniture motion: large moves are bounded and swept, so a thin barrier cannot be skipped', () => {
  const { add, motion } = fixture({ walls: [{ x0: -0.48, x1: -0.47, z0: -3, z1: 3 }] }), item = add();
  const moved = motion.move(item, 1000, 0);
  assert.equal(moved.moved, true); assert.ok(moved.dx < 0.34);
  assert.ok(item.x1 <= -0.48);
  const before = { x: item.x, version: motion.version(0), moves: item.moves };
  assert.equal(motion.move(item, 1000, 0).moved, false);
  assert.deepEqual({ x: item.x, version: motion.version(0), moves: item.moves }, before);
  const open = fixture(), free = open.add();
  close(Math.hypot(...Object.values(open.motion.move(free, 1000, 1000)).slice(0, 2)), 0.5);
});

test('furniture motion: the whole rectangular footprint must fit a doorway, not only its center', () => {
  const door = half => [{ x0: -0.1, x1: 0.1, z0: -5, z1: -half }, { x0: -0.1, x1: 0.1, z0: half, z1: 5 }];
  const narrow = fixture({ walls: door(0.6) }), desk = narrow.add({ x: -0.6, w: 0.6, d: 1.8, type: 'desk' });
  narrow.motion.move(desk, 0.5, 0);
  assert.ok(desk.x1 <= -0.1, 'a desk cannot pass the narrow jambs');
  const broad = fixture({ walls: door(1.1) }), cart = broad.add({ x: -0.6, w: 0.6, d: 1.8, type: 'trolley' });
  assert.equal(broad.motion.move(cart, 0.5, 0).moved, true);
  assert.equal(broad.motion.move(cart, 0.5, 0).moved, true);
  close(cart.x, 0.4); assert.equal(cart.room, 1);
  assert.ok(broad.motion.version(0) > 0 && broad.motion.version(1) > 0);
  assert.equal(broad.world.free(cart.x, cart.z, 0.22), false, 'crossing the room boundary does not lose its collider');
});

test('furniture motion: other furniture, NPC bodies and the player remain solid', () => {
  const f = fixture(), item = f.add(), other = f.add({ x: -0.3, d: 2 });
  f.motion.move(item, 0.5, 0); assert.ok(item.x1 <= other.x0);
  const npc = fixture(), chair = npc.add(), body = { x: -0.3, z: 0, r: 0.25 };
  npc.world.bodies.push(body); npc.motion.move(chair, 0.5, 0);
  assert.equal(circleHits(body, chair), false);
  const player = fixture(), trolley = player.add({ type: 'trolley' }), me = { x: -0.3, z: 0 };
  player.world.env.player = { me, RADIUS: 0.22 };
  player.motion.move(trolley, 0.5, 0);
  assert.equal(circleHits({ ...me, r: 0.22 }, trolley), false, 'player collision does not rely on world.bodies');
});

test('furniture motion: ignoring the pushing body does not make other bodies or furniture intangible', () => {
  const f = fixture(), item = f.add(), actor = { x: -1.4, z: 0, r: 0.3 }, victim = { x: -0.4, z: 0, r: 0.3 };
  f.world.bodies.push(actor, victim);
  const moved = f.motion.move(item, 0.5, 0, { ignoreBody: actor });
  assert.equal(moved.moved, true); assert.equal(circleHits(victim, item), false);
  assert.equal(f.world.bodies.length, 2); assert.equal(item.collider.on, true);
});

test('furniture motion: the player exception is by identity for a controller coupling the player and furniture step', () => {
  const f = fixture(), item = f.add(), me = { x: -0.3, z: 0 };
  f.world.env.player = { me, RADIUS: 0.22 };
  const moved = f.motion.move(item, 0.5, 0, { ignoreBody: me });
  close(moved.dx, 0.5);
  // The grip controller moves the player by this same delta, or rolls back
  // synchronously if that player's step fails. A lookalike is not permission.
  const g = fixture(), chair = g.add(); g.world.env.player = { me, RADIUS: 0.22 };
  assert.ok(g.motion.move(chair, 0.5, 0, { ignoreBody: { ...me } }).dx < 0.5);
});

test('furniture motion: rejects steps up/down, slopes, low ceilings and non-finite floors', () => {
  for (const options of [
    { floor: x => x >= 0 ? 0.18 : 0 },
    { floor: x => x >= 0 ? -0.18 : 0 },
    { floor: x => x >= 0 ? x : 0 },
    { floor: x => x >= 0 ? NaN : 0 },
    { head: x => x >= 0 ? 0.7 : 3 },
  ]) {
    const f = fixture(options), item = f.add({ x: -0.5 });
    f.motion.move(item, 0.5, 0);
    assert.ok(item.x1 < 0.02, 'the whole footprint stops at the unsafe floor/ceiling');
    close(item.y, 0); close(item.top, 0.9);
  }
});

test('furniture motion: checks the interior for holes and does not cross the edge of the world or a seam', () => {
  const pit = fixture({ floor: (x, z) => Math.abs(x + 0.85) < 0.1 && Math.abs(z) < 0.1 ? -2 : 0 });
  const table = pit.add({ w: 1.2, d: 1.2, type: 'desk' });
  for (const x of [table.x0, table.x1]) for (const z of [table.z0, table.z1]) assert.equal(pit.world.floorY(x, z), 0);
  assert.equal(pit.motion.move(table, 0.2, 0).moved, false, 'safe corners cannot bridge an interior hole');
  const edge = fixture(), chair = edge.add({ x: 4.7 });
  edge.motion.move(chair, 0.5, 0); assert.ok(chair.x1 < 5);
  const seam = fixture({ right: { kind: 'exit', way: 'hole' } }), cart = seam.add({ x: -0.5 });
  seam.motion.move(cart, 0.5, 0); assert.ok(cart.x1 < 0, 'movables remain in this part of the building');
  const fold = fixture(); fold.world.rooms[1].fold = true;
  const crooked = fold.add({ x: -0.5 }); fold.motion.move(crooked, 0.5, 0); assert.ok(crooked.x1 < 0);
});

test('furniture motion: finds the nearest swept-circle blocker without falsely blocking rounded corners', () => {
  const f = fixture(), far = f.add({ x: 2 }), near = f.add({ x: 0 });
  assert.equal(f.motion.blocking({ x: -2, z: 0 }, { x: 3, z: 0 }, 0.22), near);
  assert.equal(f.motion.blocking({ x: 3, z: 0 }, { x: -2, z: 0 }, 0.22), far);
  assert.equal(f.motion.blocking({ x: -0.42, z: 0 }, { x: -1, z: 0 }, 0.22), null, 'touching while leaving is not blocked');
  const corner = fixture(), box = corner.add({ x: 1.5, z: 1.5, w: 1, d: 1 });
  assert.equal(corner.motion.blocking({ x: 0, z: 0.81 }, { x: 0.82, z: 0.81 }, 0.2), null);
  assert.equal(corner.motion.blocking({ x: 0, z: 0.9 }, { x: 2, z: 0.9 }, 0.2), box);
  assert.equal(corner.motion.blocking({ x: 1.5, z: 0 }, { x: 1.5, z: 3 }, 0), box);
});

test('furniture motion: a nearby pirate shoves at the furniture rate and can push sideways along a jamb', () => {
  for (const type of Object.keys(FURNITURE)) {
    const f = fixture(), item = f.add({ x: 0, type }), actor = { x: -0.6, z: 0, r: 0.22 };
    actor.body = { ...actor }; f.world.bodies.push(actor.body);
    const moved = f.motion.shove(item, actor, 99);
    close(moved.dx, FURNITURE[type].pushSpeed * 0.1); close(moved.dz, 0);
  }
  const jam = fixture({ walls: [{ x0: 0.21, x1: 0.25, z0: -3, z1: 3 }] });
  const item = jam.add({ x: 0 }), moved = jam.motion.shove(item, { x: -0.6, z: 0, r: 0.22 }, 0.1);
  assert.equal(moved.moved, true); close(moved.dx, 0); assert.ok(Math.abs(moved.dz) > 0.08);
  assert.ok(item.x1 < 0.21);
});

test('furniture motion: shoving requires physical contact access, not proximity through a wall', () => {
  const f = fixture({ walls: [{ x0: -0.4, x1: -0.38, z0: -3, z1: 3 }] }), item = f.add({ x: 0 });
  assert.equal(f.motion.shove(item, { x: -0.7, z: 0, r: 0.22 }, 0.1).moved, false);
  assert.equal(item.moves, 0);
  const free = fixture(), chair = free.add({ x: 0 });
  assert.equal(free.motion.shove(chair, { x: -3, z: 0, r: 0.22 }, 0.1).moved, false);
});

test('furniture motion: invalid input and stale records never move or invalidate paths', () => {
  const f = fixture(), item = f.add(), actor = { x: -1.6, z: 0, r: 0.22 };
  for (const value of [NaN, Infinity, -Infinity, undefined, '1']) {
    assert.equal(f.motion.move(item, value, 0).moved, false);
    assert.equal(f.motion.move(item, 0, value).moved, false);
    assert.equal(f.motion.shove(item, actor, value).moved, false);
  }
  assert.equal(f.motion.shove(item, actor, -1).moved, false);
  assert.equal(f.motion.move({ ...item }, 0.1, 0).moved, false);
  assert.equal(f.motion.blocking(null, actor), null); assert.equal(f.motion.blocking(actor, actor, NaN), null);
  assert.equal(item.moves, 0); assert.equal(f.motion.version(0), 0);
});

test('furniture motion: visible rescue-disabled furniture can move, but is not an AI blocker until safely placed', () => {
  const f = fixture({ walls: [{ x0: -0.79, x1: -0.78, z0: -3, z1: 3 }] }), item = f.add();
  item.collider = { ...item.collider, on: false };
  const translate = item.translate;
  item.translate = (dx, dz) => { translate(dx, dz); item.collider.on = true; return true; };
  assert.equal(f.motion.blocking({ x: -2, z: 0 }, { x: 0, z: 0 }), null);
  assert.equal(f.motion.move(item, 0.1, 0).moved, false);
  assert.equal(item.collider.on, false, 'a rejected placement must not bring its collider back');
  assert.equal(f.motion.move(item, -0.1, 0).moved, true);
  assert.equal(item.collider.on, true);
  assert.equal(f.motion.blocking({ x: -2, z: 0 }, { x: 0, z: 0 }), item);
});

test('furniture motion: a changing room keeps moved furniture absent, immobile and nonblocking until its own return', () => {
  const f = fixture(), chair = f.add(), outside = f.add({ x: 2 });
  chair.collider = { ...chair.collider, on: true }; chair.group = { visible: true };
  outside.collider = { ...outside.collider, on: true }; outside.group = { visible: true };
  f.world.touchFurniture = item => f.world.furnitureRevision.set(item.room, f.motion.version(item.room) + 1);
  let refreshed = 0;
  f.world.refreshFurniture = () => { refreshed++; for (const item of f.world.furniture) item.group.visible = !item.away; };
  assert.equal(f.motion.move(chair, .3, .2).moved, true);
  const location = { x: chair.x, z: chair.z, x0: chair.x0, z0: chair.z0 }, revision = f.motion.version(0);
  const gone = f.motion.takeAway(x => x < 0, 'unsure-hall:0:own');
  assert.deepEqual(gone, [chair]); assert.equal(chair.away, 'unsure-hall:0:own');
  assert.equal(chair.collider.on, false); assert.equal(chair.group.visible, false);
  assert.equal(f.motion.version(0), revision + 1); assert.equal(outside.away, undefined);
  assert.equal(f.motion.blocking({ x: -2, z: .2 }, { x: 1, z: .2 }), null);
  assert.equal(f.motion.move(chair, .1, 0).moved, false);
  assert.equal(f.motion.shove(chair, { x: -1.2, z: .2 }, .1).moved, false);
  assert.deepEqual(f.motion.takeAway(() => true, 'other'), [outside], 'an absent item cannot change room identity');
  assert.deepEqual(f.motion.bringBack('unrelated'), []);
  assert.equal(chair.group.visible, false);
  assert.deepEqual(f.motion.bringBack('unsure-hall:0:own'), [chair]);
  assert.equal(chair.away, null); assert.equal(chair.collider.on, true); assert.equal(chair.group.visible, true);
  assert.equal(outside.group.visible, false, 'returning one changing room cannot resurrect another');
  assert.deepEqual({ x: chair.x, z: chair.z, x0: chair.x0, z0: chair.z0 }, location);
  assert.equal(f.motion.version(0), revision + 2); assert.ok(refreshed > 0);
  assert.deepEqual(f.motion.bringBack('unsure-hall:0:own'), []);
  assert.equal(f.motion.version(0), revision + 2, 'idempotent returns do not invalidate navigation');
  assert.equal(f.motion.move(chair, .1, 0).moved, true);
});

test('furniture motion: returning rooms preserve collision exceptions and discard stale records', () => {
  const f = fixture(), disabled = f.add(), removed = f.add({ x: 1 });
  disabled.collider = { ...disabled.collider, on: false }; disabled.group = { visible: true };
  removed.collider = { ...removed.collider, on: true }; removed.group = { visible: true };
  assert.deepEqual(f.motion.takeAway(() => true, ''), []);
  assert.deepEqual(f.motion.takeAway(null, 'room'), []);
  assert.deepEqual(f.motion.takeAway(() => true, 'room'), [disabled, removed]);
  f.world.furniture.splice(f.world.furniture.indexOf(removed), 1);
  assert.deepEqual(f.motion.bringBack('room'), [disabled]);
  assert.equal(disabled.collider.on, false, 'return preserves no-trap construction rescue');
  assert.equal(removed.collider.on, false); assert.equal(removed.group.visible, false);
  assert.equal(f.motion.blocking({ x: -2, z: 0 }, { x: 2, z: 0 }), null);
});
