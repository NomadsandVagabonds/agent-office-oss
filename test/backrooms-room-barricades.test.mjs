import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Exercise the real room controllers, replacing only their rendered figures.
// World queries below use transformed rectangles and circular moving bodies.
const moduleUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const modelStub = moduleUrl(`
  const node = () => ({ position: { x: 0, y: 0, z: 0, set(x,y,z) { Object.assign(this,{x,y,z}); } }, rotation: { x: 0,y: 0,z: 0 }, visible: true });
  export function makeFreightFigure() { return Object.fromEntries(['group','heldGPU','torso','head','leftArm','rightArm','leftLeg','rightLeg'].map(k => [k,node()])); }
  export function createGuard() { return { update() {}, read: () => ({ eyesOn: true }) }; }
`);
const load = async (path, model) => {
  const url = new URL(path, import.meta.url), source = readFileSync(url, 'utf8');
  return import(moduleUrl(source.replace(/from '([^']+)'/g, (_, specifier) => `from '${specifier === model ? modelStub : new URL(specifier, url).href}'`)));
};
const [{ installFreightDuo }, { createPatrol }] = await Promise.all([
  load('../public/world/backrooms/rooms/dispatch/duo.js', './figures.js'),
  load('../public/world/backrooms/rooms/mecha/patrol.js', './guards.js'),
]);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const hits = (p, r, b) => b.on !== false && (p.x - clamp(p.x, b.x0, b.x1)) ** 2 + (p.z - clamp(p.z, b.z0, b.z1)) ** 2 < r * r;

function context({ enabled = true, turn = 0 } = {}) {
  const W = 12, D = 10, cos = Math.cos(turn * Math.PI / 2), sin = Math.sin(turn * Math.PI / 2), ticks = [], calls = [];
  const toWorld = (x, z) => ({ x: 21 + x * cos + z * sin, z: -13 - x * sin + z * cos });
  const toLocal = (x, z) => ({ x: (x - 21) * cos - (z + 13) * sin, z: (x - 21) * sin + (z + 13) * cos });
  const world = { bodies: [], furnitureColliders: [], furnitureRevision: new Map([[0, 0]]), headroom: () => 3, passable: () => true, los: () => true,
    free(x, z, radius, opt = {}) {
      calls.push(opt);
      const p = toLocal(x, z);
      if (Math.abs(p.x) + radius > W / 2 || Math.abs(p.z) + radius > D / 2) return false;
      if (world.furnitureColliders.some(b => hits({ x, z }, radius, b))) return false;
      return opt.ghost || world.bodies.every(b => b.on === false || Math.hypot(b.x - x, b.z - z) >= b.r + radius);
    },
  };
  let oldDisposals = 0, captures = 0;
  const c = { W, D, world, toWorld, floorAt: () => 0, room: { id: 0, rot: turn }, rt: { id: 0, group: { userData: { dispose: () => oldDisposals++ } } },
    add() {}, tick(fn) { ticks.push(fn); }, met() {}, seen: () => false, hurt: () => ({ ended: false, landed: true }), survived() {},
    env: { barricadesEnabled: enabled, ready: [], play() {}, hold() {}, player: { me: {}, warp() { captures++; } } },
  };
  const block = (x0, z0, x1, z1) => {
    const a = toWorld(x0, z0), b = toWorld(x1, z1), box = { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z), on: true };
    world.furnitureColliders.push(box); return box;
  };
  return { c, ticks, world, calls, block, get oldDisposals() { return oldDisposals; }, get captures() { return captures; } };
}
const workerPlan = { home: { x: -2, z: 0 }, pickup: { x: 2, z: 0 }, loading: { x: 2, z: 2 }, bounds: {} };

test('Dispatch: body positions follow the real workers in a turned room and leave no stale collision on disposal', () => {
  const f = context({ turn: 1 }), duo = installFreightDuo(f.c, workerPlan);
  f.c.env.ready.forEach(fn => fn());
  assert.equal(f.world.bodies.length, 2);
  duo.behavior.notice(); duo.behavior.advance(22);
  const before = duo.read().actors.map(a => ({ x: a.x, z: a.z }));
  for (let i = 0; i < 30; i++) f.ticks[0](.1, i * .1, { inside: true, x: -2, z: -3, world: { frozen: false } });
  assert.ok(duo.read().actors.some((a, i) => Math.hypot(a.x - before[i].x, a.z - before[i].z) > .5));
  duo.read().actors.forEach((a, i) => {
    const p = f.c.toWorld(a.x, a.z), body = f.world.bodies[i];
    assert.deepEqual({ x: body.x, z: body.z }, p);
    assert.equal(f.world.free(body.x, body.z, .1), false, 'the worker occupies physical floor space');
  });
  assert.ok(f.calls.slice(0, -2).every(o => o.ghost), 'navigation does not collide with its own registered body');
  f.c.rt.group.userData.dispose(); f.c.rt.group.userData.dispose();
  assert.equal(f.world.bodies.length, 0); assert.equal(f.oldDisposals, 1);
  const after = duo.read(); f.ticks[0](1, 9, { world: { frozen: false } }); assert.deepEqual(duo.read(), after);
});

test('Dispatch: moving a barricade rebuilds the workers reachable component', () => {
  const f = context(), barrier = f.block(-.1, -5, .1, 5), duo = installFreightDuo(f.c, workerPlan);
  f.c.env.ready.forEach(fn => fn()); duo.behavior.notice(); duo.behavior.advance(22);
  const me = { inside: true, x: -2, z: -3, world: { frozen: false } };
  for (let i = 0; i < 100; i++) f.ticks[0](.1, i * .1, me);
  assert.ok(duo.read().actors.every(a => a.x < -.35), 'a sealed partition cannot be crossed');
  barrier.on = false; f.world.furnitureRevision.set(0, 1);
  let reached = false;
  for (let i = 0; i < 120; i++) { f.ticks[0](.1, 10 + i * .1, me); reached ||= duo.read().actors.every(a => a.x > 1); }
  assert.ok(reached, 'removing the barrier opens a new route instead of leaving a stale grid');
});

test('MECHA: moving guard bodies stay in floor coordinates, do not block themselves, and dispose cleanly', () => {
  const f = context({ turn: 1 }), patrol = createPatrol(f.c, { visitor: { x: -4, z: 3, d: 2 }, rows: [-3, -2, -1, 0, 1, 3], outerX: 4 });
  assert.equal(f.world.bodies.length, 3);
  const before = patrol.read().guards;
  for (let i = 0; i < 12; i++) patrol.update(.1, i * .1, { inside: true, x: 5, z: 4, world: { frozen: false } });
  assert.ok(patrol.read().guards.some((g, i) => Math.hypot(g.x - before[i].x, g.z - before[i].z) > .3));
  patrol.read().guards.forEach((g, i) => {
    const p = f.c.toWorld(g.x, g.z), body = f.world.bodies[i];
    assert.deepEqual({ x: body.x, z: body.z }, p); assert.equal(body.r, .36);
  });
  assert.ok(f.calls.every(o => o.ghost));
  f.c.rt.group.userData.dispose(); f.c.rt.group.userData.dispose();
  assert.equal(f.world.bodies.length, 0); assert.equal(f.oldDisposals, 1);
});

test('MECHA: capture cannot reach through even a thin movable collider', () => {
  const f = context(), barrier = f.block(.274, -1.5, .278, -.5);
  const patrol = createPatrol(f.c, { visitor: { x: -4, z: 3, d: 2 }, rows: [-3, -2, -1, 0, 1, 3], outerX: 4 });
  const me = { inside: true, x: .55, z: -1, world: { frozen: false } };
  for (let i = 0; i < 28; i++) patrol.update(.1, i * .1, me);
  assert.equal(f.captures, 0); assert.equal(patrol.state().phase, 'patrol');
  barrier.on = false; f.world.furnitureRevision.set(0, 1);
  patrol.update(.1, 2.9, me);
  assert.equal(f.captures, 1); assert.equal(patrol.state().phase, 'captured');
});

test('room bodies remain gated behind the furniture flag', () => {
  const f = context({ enabled: false }); installFreightDuo(f.c, workerPlan); f.c.env.ready.forEach(fn => fn());
  createPatrol(f.c, { visitor: { x: -4, z: 3, d: 2 }, rows: [-3, -2, -1, 0, 1, 3], outerX: 4 });
  assert.deepEqual(f.world.bodies, []);
});
