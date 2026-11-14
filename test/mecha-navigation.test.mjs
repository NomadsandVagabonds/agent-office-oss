import test from 'node:test';
import assert from 'node:assert/strict';
import { createLabNavigation } from '../public/world/backrooms/rooms/mecha/navigation.js';

const RADIUS = .36;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// The mock uses world coordinates, including translated, quarter-turned rooms.
// Every rectangle is fully solid, as occupied cages are in the playable room.
function lab(blocks = [], turns = 0) {
  const W = 12, D = 10, yaw = turns * Math.PI / 2;
  const cos = Math.cos(yaw), sin = Math.sin(yaw), calls = [];
  const toWorld = (x, z) => ({ x: 31 + x * cos + z * sin, z: -17 - x * sin + z * cos });
  const toLocal = (x, z) => ({ x: (x - 31) * cos - (z + 17) * sin, z: (x - 31) * sin + (z + 17) * cos });
  const world = {
    free(x, z, radius, opt) {
      calls.push({ radius, ghost: opt?.ghost });
      const p = toLocal(x, z);
      if (Math.abs(p.x) + radius > W / 2 + 1e-10 || Math.abs(p.z) + radius > D / 2 + 1e-10) return false;
      return blocks.every(b => Math.hypot(p.x - clamp(p.x, b.x0, b.x1), p.z - clamp(p.z, b.z0, b.z1)) >= radius - 1e-10);
    },
    passable: () => true,
  };
  return { nav: createLabNavigation({ W, D, world, toWorld }), calls, W, D };
}

// Independent continuous geometry check: even a shortcut between safe grid
// cells must keep the guard's whole body away from every cage edge.
function pointToSegment(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return distance(p, { x: a.x + dx * t, z: a.z + dz * t });
}
function segmentDistance(a, b, c, d) {
  const rx = b.x - a.x, rz = b.z - a.z, sx = d.x - c.x, sz = d.z - c.z;
  const cross = rx * sz - rz * sx;
  if (Math.abs(cross) > 1e-10) {
    const dx = c.x - a.x, dz = c.z - a.z;
    const t = (dx * sz - dz * sx) / cross, u = (dx * rz - dz * rx) / cross;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(pointToSegment(a, c, d), pointToSegment(b, c, d), pointToSegment(c, a, b), pointToSegment(d, a, b));
}
function assertSafeRoute(from, route, blocks) {
  assert.ok(route.length, 'a traversable detour exists');
  let previous = from;
  for (const next of route) {
    assert.ok(Number.isFinite(next.x) && Number.isFinite(next.z));
    for (const b of blocks) {
      const corners = [{ x: b.x0, z: b.z0 }, { x: b.x1, z: b.z0 }, { x: b.x1, z: b.z1 }, { x: b.x0, z: b.z1 }];
      const clearance = Math.min(...corners.map((p, i) => segmentDistance(previous, next, p, corners[(i + 1) % 4])));
      assert.ok(clearance >= RADIUS - .01, `route clips a solid: clearance ${clearance}`);
    }
    previous = next;
  }
}

test('MECHA navigation: guards detour around filled cages in translated and rotated rooms', () => {
  const cage = { x0: -1, z0: -1.6, x1: 1, z1: 1.6 };
  const from = { x: -3, z: 0 }, to = { x: 3, z: 0 };
  for (const turn of [0, 1]) {
    const { nav, calls } = lab([cage], turn);
    assert.equal(nav.clear(from.x, from.z, to.x, to.z), false);
    const route = nav.route(from, to);
    assertSafeRoute(from, route, [cage]);
    assert.deepEqual(route.at(-1), to);
    assert.ok(route.some(p => Math.abs(p.z) > 1.95), 'the route goes around the end of the cage');
    assert.ok(calls.every(c => c.radius === RADIUS && c.ghost), 'every collision query uses the full guard radius');
  }
});

test('MECHA navigation: a thin rail cannot be crossed by a shortcut between clear endpoints', () => {
  const rail = { x0: -.01, z0: -2, x1: .01, z1: 2 };
  const { nav } = lab([rail]);
  const from = { x: -2, z: 0 }, to = { x: 2, z: 0 };
  assert.ok(nav.free(from.x, from.z) && nav.free(to.x, to.z));
  assert.equal(nav.clear(from.x, from.z, to.x, to.z), false);
  const route = nav.route(from, to);
  assertSafeRoute(from, route, [rail]);
  assert.deepEqual(route.at(-1), to);
});

test('MECHA navigation: guards approach a player hugging a wall without adopting the smaller player radius', () => {
  const { nav } = lab();
  const target = { x: 6 - .23, z: .12 };
  assert.equal(nav.free(target.x, target.z), false, 'the player fits here but the guard does not');
  assert.equal(nav.free(6 - .35, 0), false);
  assert.equal(nav.free(6 - .37, 0), true);
  const route = nav.route({ x: 0, z: 0 }, target), last = route.at(-1);
  assert.ok(last, 'pursuit does not stop because the exact target is too tight');
  assert.ok(nav.free(last.x, last.z));
  assert.ok(distance(last, target) < .62, 'the guard can get within capture reach');
  assert.notDeepEqual(last, target, 'the endpoint never snaps inside the wall clearance');
});

test('MECHA navigation: disconnected sides have no route through a solid barrier', () => {
  const { nav } = lab([{ x0: -.01, z0: -5, x1: .01, z1: 5 }]);
  assert.deepEqual(nav.route({ x: -2, z: 0 }, { x: 2, z: 0 }), []);
});

test('MECHA navigation: a passage narrower than the guard cannot be entered', () => {
  const { nav } = lab([
    { x0: -6, z0: -1, x1: -.325, z1: 1 },
    { x0: .325, z0: -1, x1: 6, z1: 1 },
  ]);
  assert.equal(nav.free(0, 0), false, 'a .65m gap is narrower than the .72m guard');
  assert.deepEqual(nav.route({ x: 0, z: -3 }, { x: 0, z: 3 }), []);
});
