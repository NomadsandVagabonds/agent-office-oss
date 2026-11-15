// A room that changes the building takes what is in it. The hallway that is not
// sure where it leads swaps the room at its end for another, and it does not wait
// for anything to step out first (the owner: "If an enemy is in a room it gets
// warped away with the room. The backrooms lore is not nice and considerate and
// waiting to make its changes."). Whoever is standing there and whatever is lying
// there go with the room, and are there, as they were, when it comes round again.
//
// The real conductor, residents and floor are run here, with only what draws
// replaced: these tests need no WebGL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInventory as createModel, makeItem } from '../public/world/backrooms/inventory-state.js';

const dir = new URL('../public/world/backrooms/', import.meta.url);
const read = (f) => readFileSync(new URL(f, dir), 'utf8');
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
/** A module of the level with some of what it imports swapped for stand-ins. */
async function load(file, swaps) {
  let source = read(file);
  for (const [from, to] of Object.entries(swaps)) { assert.ok(source.includes(`'${from}'`), `${file} no longer imports ${from}`); source = source.replace(`'${from}'`, JSON.stringify(to)); }
  return import(moduleUrl(source));
}
/** The room that goes: everything with x under 5. */
const inside = (x) => x < 5;

/* ---- the cast, and the colleague who came along ------------------------------------------------ */

// Three of them, as plain as can be: one that adds itself to the level and has a body (as the shadow, the moth and the
// porter do), one that builds itself and only shows its figure (as the mascot does), and one that is standing elsewhere.
globalThis.__takenMakers = {
  walker: (c) => { const mesh = c.add({ visible: true }), body = c.body({ x: 2, z: 2, r: 0.3 }), use = c.use({ x: 2, z: 2, when: () => true, use() {} }); const it = { ticks: 0, mesh, body, use, at: () => ({ x: 2, z: 2 }), update() { it.ticks++; } }; return it; },
  mascot: (c) => { const figure = { group: { visible: true }, body: { x: 3, z: 1, r: 0.26 } }; c.env.world.bodies.push(figure.body); const it = { ticks: 0, figure, at: () => ({ x: 3, z: 1 }), update() { it.ticks++; if (!c.env.world.bodies.includes(figure.body)) c.env.world.bodies.push(figure.body); } }; return it; },
  elsewhere: (c) => { const mesh = c.add({ visible: true }); const it = { ticks: 0, mesh, at: () => ({ x: 20, z: 2 }), update() { it.ticks++; } }; return it; },
  nowhere: () => { const it = { ticks: 0, at: () => ({ x: null, z: null }), update() { it.ticks++; } }; return it; },
};
const { createStalkers } = await load('pursuer.js', {
  './gen.js': moduleUrl('export const makeRng = () => () => 0.5;'),
  './cast.js': moduleUrl('export const CAST = ["walker", "mascot", "elsewhere", "nowhere"].map((id) => ({ id })); export const castFor = () => CAST.map((m) => ({ id: m.id })); export const homeFor = () => null;'),
  './cast/index.js': moduleUrl('export const MAKERS = globalThis.__takenMakers;'),
  './cast/walk.js': moduleUrl('export const createWalk = () => ({ go() {} });'),
  './doorleaf.js': moduleUrl('export const hangDoors = () => ({ update() {} });'),
});

function castSetup() {
  const room = { uses: [], group: { visible: true, remove() {} } };
  const env = {
    level: { seed: 'taken', depth: 0 }, visit: {}, player: { me: { x: 30, z: 30 } },
    world: { bodies: [], scene: { add() {} }, roomAt: () => room, floorY: () => 0, lightAt: () => [1, 1, 1] }, sees: () => false, play() {},
  };
  createStalkers(env);
  for (const fn of env.ready) fn();
  const of = (id) => env.pursuer.of(id);
  return { env, room, of };
}

test('whoever is standing in a room that goes, goes with it: not seen, not walked into, not usable, doing nothing; and is there again when it is back', () => {
  const { env, of } = castSetup(), bodies = env.world.bodies, walker = of('walker'), mascot = of('mascot'), elsewhere = of('elsewhere');
  env.pursuer.update(0.1);
  assert.deepEqual([walker.ticks, mascot.ticks, elsewhere.ticks], [1, 1, 1]);
  assert.equal(bodies.length, 2);
  // the room goes
  assert.deepEqual(env.pursuer.takeAway(inside, 'room:a'), ['walker', 'mascot']);
  assert.deepEqual(env.pursuer.away, { walker: 'room:a', mascot: 'room:a' });
  assert.deepEqual([walker.mesh.visible, mascot.figure.group.visible, elsewhere.mesh.visible], [false, false, true], 'they are not seen: one that adds itself to the level, and one that builds itself');
  assert.equal(bodies.length, 0, 'nor walked into: where they stood is floor in whatever room is there now');
  assert.equal(walker.use.when(), false, 'and nothing of somebody who is not there can be used');
  for (let i = 0; i < 5; i++) env.pursuer.update(0.1);
  assert.deepEqual([walker.ticks, mascot.ticks, elsewhere.ticks], [1, 1, 6], 'they do nothing while they are away; everybody else carries on');
  assert.equal(bodies.length, 0, '(the mascot puts its own body back whenever it is run: it is not run)');
  assert.deepEqual(env.pursuer.takeAway(inside, 'room:b'), [], 'a second room going has nobody left to take');
  // another room coming back brings nobody
  assert.deepEqual(env.pursuer.bringBack('room:b'), []);
  assert.deepEqual(env.pursuer.away, { walker: 'room:a', mascot: 'room:a' });
  // theirs does
  assert.deepEqual(env.pursuer.bringBack('room:a'), ['walker', 'mascot']);
  assert.deepEqual(env.pursuer.away, {});
  assert.deepEqual([walker.mesh.visible, mascot.figure.group.visible], [true, true]);
  assert.deepEqual(bodies.slice().sort((a, b) => a.x - b.x), [walker.body, mascot.figure.body], 'and they are in the way again');
  assert.equal(walker.use.when(), true);
  env.pursuer.update(0.1);
  assert.deepEqual([walker.ticks, mascot.ticks], [2, 2], 'and go on from where they were');
  assert.equal(bodies.length, 2, 'once each');
});

test('the colleague who came along goes with the room too; somebody who is nowhere at all is not taken', () => {
  const { env, of } = castSetup();
  const cutout = { g: { visible: true, position: { set() {} }, rotation: {}, userData: {} }, x: 1, z: 1 };
  assert.equal(env.adopt({ toWorld: (x, z) => ({ x, z }), rt: { group: { remove() {} } }, world: { scene: { add() {} } }, room: { y: 0 } }, cutout), true);
  assert.deepEqual(env.pursuer.follower, { x: 1, z: 1 });
  assert.deepEqual(env.pursuer.takeAway(inside, 'room:a'), ['walker', 'mascot', 'follower']);
  assert.equal(cutout.g.visible, false);
  env.pursuer.update(0.5); env.pursuer.update(0.5);
  assert.equal(cutout.g.visible, false, 'it is not moved, or shown, while it is away');
  assert.equal(of('nowhere').ticks, 2, 'one with no place to be (the shadow, between appearances) is not in any room, and carries on');
  assert.ok(env.pursuer.bringBack('room:a').includes('follower'));
  assert.equal(env.pursuer.away.follower, undefined);
});

/* ---- the residents that walk ------------------------------------------------------------------ */

const { createDenizens } = await load('denizens.js', {
  './gen.js': moduleUrl('export const makeRng = () => () => 0.5;'),
  './absorbed.js': moduleUrl('export const populateAbsorbed = () => {};'),
});

test('a resident that has walked into the room goes with it, and is put back where it stood', () => {
  const room = { id: 1, group: { visible: true } };
  const env = { level: { seed: 'taken' }, player: { me: { x: 30, z: 30 } },
    world: { scene: { add() {} }, roomAt: () => room, floorY: () => 0, lightAt: () => [1, 1, 1], current: () => room, distances: () => new Map([[1, 0]]) } };
  const denizens = createDenizens(env);
  for (const fn of env.ready) fn();
  const make = (x) => { const d = { x, z: 1, ticks: 0, group: { visible: true, parent: null, position: { set(px, py, pz) { d.drawn = [px, pz]; } }, removeFromParent() {} }, update() { d.ticks++; } }; return denizens.add(d); };
  const near = make(2), far = make(12);
  denizens.update(0.1, 0);
  assert.deepEqual([near.ticks, far.ticks, near.group.visible], [1, 1, true]);
  assert.equal(denizens.takeAway(inside, 'room:a'), 1);
  denizens.update(0.1, 0); denizens.sync();
  assert.deepEqual([near.ticks, far.ticks, near.group.visible, far.group.visible], [1, 2, false, true]);
  assert.equal(denizens.bringBack('room:b'), 0); assert.equal(near.group.visible, false);
  assert.equal(denizens.bringBack('room:a'), 1);
  assert.deepEqual([near.group.visible, near.drawn], [true, [2, 1]]);
  denizens.update(0.1, 0);
  assert.equal(near.ticks, 2);
});

/* ---- what is lying on the floor ---------------------------------------------------------------- */

const { createInventoryWorld } = await load('inventory-world.js', {
  three: moduleUrl(`export class Matrix4 { makeScale() { return this; } }
    export class Mesh { constructor(geometry, material) { this.material = material; this.visible = true; this.position = { set() {} }; this.rotation = {}; } removeFromParent() {} }`),
  './kit.js': moduleUrl('export class Batch { addVox() {} quad() {} } export const lamp = () => ({}), lightAt = () => [1, 1, 1], lin = (value) => [1, 1, 1];'),
  './gen.js': moduleUrl('export const toLocal = (def, x, z) => ({ x, z }), toWorld = toLocal;'),
  './inventory-items.js': moduleUrl('export const INVENTORY_MODELS = { battery: {}, chalk: {} };'),
  './inventory-state.js': new URL('inventory-state.js', dir).href,
  './inventory-fire.js': moduleUrl(`export const FIRE = {}; export const createInventoryFire = () => { const log = globalThis.__takenFires = []; return { occupied: () => false, threatAt() {}, update() {}, report: () => [], dispose() {},
    takeAway(inside, key) { log.push(['away', key]); return 1; }, bringBack(key) { log.push(['back', key]); return 1; } }; };`),
});

function floorSetup(t) {
  const model = createModel(), me = { x: 0, y: 0.1, z: 0, yaw: 0, drop: 0, sinkTo: 0 };
  const room = { id: 'room', def: { y: 0, rot: 0 }, u: {}, uses: [], near: true, lights: [], amb: [1, 1, 1], group: { visible: true, add() {} } };
  const env = { player: { me }, sound: { play() {} },
    world: { rooms: [room], roomAt: () => room, floorY: () => 0, headroom: () => 3, free: () => true, passable: () => true },
    kit: { VOXEL: 1, model: () => ({ solid: [] }), geometry: () => ({}), surface: () => ({ uniforms: { uTint: { value: { set() {} } } } }) } };
  const physical = createInventoryWorld(env, model);
  t.after(() => physical.dispose());
  return { model, physical, room, me };
}

test('what is lying in a room that goes, goes with it: a thing put down cannot be picked up from the room that is there instead, and is back when its own room is', (t) => {
  const { model, physical, room } = floorSetup(t);
  assert.equal(physical.spawn(makeItem('battery', 'near'), { room: 'room', x: 0.6, z: 0 }).ok, true);
  assert.equal(physical.spawn(makeItem('battery', 'far'), { room: 'room', x: 8, z: 0 }).ok, true);
  const items = () => Object.fromEntries(physical.report().items.map((i) => [i.id, [i.active, i.away || null]]));
  assert.equal(physical.takeAway(inside, 'room:a'), 2, 'the thing on the floor, and (the stand-in says so) a fire');
  assert.deepEqual(items(), { near: [false, 'room:a'], far: [true, null] });
  assert.deepEqual(globalThis.__takenFires, [['away', 'room:a']], 'a fire that was burning there is told as well');
  const pick = room.uses.find((u) => u.when && !u.when()) || room.uses[0];
  assert.equal(pick.when(), false, 'it is not there to be picked up');
  assert.equal(pick.use().ok, false);
  assert.deepEqual(model.read().slots.filter(Boolean), [], 'and nothing has been');
  // the floor where it lay is free for something else, in the room that is there now
  assert.equal(physical.spawn(makeItem('battery', 'second'), { room: 'room', x: 0.6, z: 0 }).ok, true);
  assert.equal(physical.takeAway(inside, 'room:b'), 2);
  assert.deepEqual(items(), { near: [false, 'room:a'], far: [true, null], second: [false, 'room:b'] });
  // each comes back with its own room and no other
  assert.equal(physical.bringBack('room:a'), 2);
  assert.deepEqual(items(), { near: [true, null], far: [true, null], second: [false, 'room:b'] });
  assert.equal(physical.bringBack('room:c'), 1, '(only the stand-in fire answers to a room nobody knows)');
  assert.deepEqual(items().second, [false, 'room:b']);
});

test('a chalk mark made to find out whether it is the same room says what is true: it is gone with the room, and back with it', (t) => {
  const { physical } = floorSetup(t);
  const made = physical.mark();
  assert.equal(made.ok, true);
  const marks = () => physical.report().marks.map((m) => [m.number, m.away || null]);
  assert.deepEqual(marks(), [[1, null]]);
  assert.equal(physical.canMark(), false, 'there is a mark here already');
  physical.takeAway(inside, 'room:a');
  assert.deepEqual(marks(), [[1, 'room:a']]);
  assert.equal(physical.canMark(), true, 'the floor of the room that is here now has no mark on it');
  assert.equal(physical.mark().ok, true);
  assert.deepEqual(marks(), [[1, 'room:a'], [2, null]]);
  physical.takeAway(inside, 'room:b');
  physical.bringBack('room:a');
  assert.deepEqual(marks(), [[1, null], [2, 'room:b']], 'the first room is back, with the first mark; the second mark is in the second room');
});

/* ---- and the hallway asks for all of it ------------------------------------------------------- */

test('the hallway takes what is in its room and waits for nothing but the visitor', () => {
  const hall = read('rooms/unsure-hall.js'), rule = read('rooms/unsure-hall/rule.js'), index = read('index.js'), fire = read('inventory-fire.js');
  // the room that was there goes with everything in it, the next is shown, and what was in that one comes back: in that order
  const turn = hall.slice(hall.indexOf('if (!s.turned) return;'));
  const order = ['env.takeAway?.(inWorld, nameOf(was));', 'show(s.face);', 'env.bringBack?.(nameOf(s.face));'].map((line) => turn.indexOf(line));
  assert.ok(order.every((i) => i > 0) && order[0] < order[1] && order[1] < order[2], `the turn is out of order: ${order}`);
  assert.match(hall, /const nameOf = \(i\) => `unsure-hall:\$\{room\.id\}:\$\{ROOMS\[i\]\}`;/, 'each of the three rooms keeps its own');
  assert.ok(!/busy/.test(hall) && !/now\.busy/.test(rule), 'nothing that is standing in it holds it up');
  assert.match(hall, /s = unsure\(s, dt, \{ watched, inside, near \}\);/);
  // one call takes the cast, the residents and the floor
  assert.match(index, /takeAway\(inside, key\) \{ return \{ cast: env\.pursuer\?\.takeAway\?\.\(inside, key\) \|\| \[\], residents: env\.denizens\?\.takeAway\?\.\(inside, key\) \|\| 0, things: env\.inventory\?\.physical\?\.takeAway\?\.\(inside, key\) \|\| 0 \}; \},/);
  assert.match(index, /bringBack\(key\) \{ return \{ cast: env\.pursuer\?\.bringBack\?\.\(key\) \|\| \[\], residents: env\.denizens\?\.bringBack\?\.\(key\) \|\| 0, things: env\.inventory\?\.physical\?\.bringBack\?\.\(key\) \|\| 0 \}; \},/);
  // a fire that is away is no threat, takes up no floor and does not burn down
  assert.match(fire, /f\.remaining > 0 && !f\.away && Math\.abs\(f\.wy - y\)/);
  assert.match(fire, /if \(f\.remaining <= 0 \|\| f\.away \|\|/);
  assert.match(fire, /for \(const f of pool\) if \(f\.remaining > 0 && !f\.away\) \{/);
});
