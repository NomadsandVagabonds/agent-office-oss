import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInventory as createModel, makeItem } from '../public/world/backrooms/inventory-state.js';
import { createCameraBattery } from '../public/world/backrooms/camera-state.js';
import { CAMERA_INPUT } from '../public/world/backrooms/crafting.js';

// Exercise the real input/controller boundary with its pure inventory model.
// Drawing and floor allocation are stand-ins so these tests need no WebGL.
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const replacements = {
  './inventory-state.js': new URL('../public/world/backrooms/inventory-state.js', import.meta.url).href,
  './melee.js': new URL('../public/world/backrooms/melee.js', import.meta.url).href,
  './inventory-hud.js': moduleUrl(`export function createInventoryHud(callbacks) {
    return { el: {}, snapshot: null, isOpen: false, callbacks,
      update(value) { this.snapshot = value; }, notice() {}, tick() {}, destroy() {}, cancelCombine() {}, beginCombine() {},
      setOpen(value) { this.isOpen = value; callbacks.onOpen(value); },
      handleKey(e) { if (e.key.toLowerCase() !== 'i') return false; if (!e.repeat) this.setOpen(!this.isOpen); return true; },
    };
  }`),
  './inventory-world.js': moduleUrl(`export function createInventoryWorld() {
    return { drops: 0, marks: 0, fire: { threatAt() {} },
      dropSelected() { this.drops++; return { ok: true }; }, mark() { this.marks++; return { ok: true }; },
      update() {}, report() { return {}; }, dispose() {},
    };
  }`),
  './gen.js': moduleUrl('export const toLocal = () => ({}), makeRng = () => ({}), ARCHETYPES = {}, STASH = {};'),
  './supplies.js': moduleUrl('export const planSupplies = () => [], wantedByRooms = () => [];'),
  './cast.js': moduleUrl('export const CAST = [], castFor = () => [];'),
};
let source = readFileSync(new URL('../public/world/backrooms/inventory.js', import.meta.url), 'utf8');
for (const [from, to] of Object.entries(replacements)) source = source.replace(`'${from}'`, JSON.stringify(to));
const { createInventory } = await import(moduleUrl(source));

function setup(t, ...items) {
  const env = { hud: { el: {} }, sound: { play() {} }, camera: createCameraBattery() };
  const floor = { world: { rooms: [] }, kit: {}, level: { seed: 'holster', depth: 0 }, player: { me: {} } };
  const inventory = createInventory(env); inventory.hang(floor); inventory.attend(floor);
  for (const item of items) inventory.give(item);
  t.after(() => inventory.dispose());
  return { inventory, floor, camera: env.camera, key: (key, repeat = false) => inventory.handleKey({ key, repeat }) };
}

test('number keys toggle empty hands without opening the bag; held keys cannot toggle repeatedly', t => {
  const { inventory, floor, key } = setup(t, makeItem('battery', 'cell'));
  assert.equal(inventory.held().id, 'cell');
  assert.equal(key('1'), true); assert.equal(inventory.held(), null); assert.equal(floor.inventory.held(), null);
  assert.equal(inventory.isOpen, false); assert.equal(inventory.view.snapshot.holstered, true);
  key('1', true); assert.equal(inventory.held(), null);
  key('1'); assert.equal(inventory.held().id, 'cell'); assert.equal(inventory.isOpen, false);
  key('1', true); assert.equal(inventory.held().id, 'cell');
});

test('stowed chalk cannot mark or drop, and NPCs cannot consume it', t => {
  const { inventory, floor, key } = setup(t, makeItem('chalk', 'chalk'));
  key('1'); key('q'); key('g');
  assert.equal(inventory.physical.marks, 0); assert.equal(inventory.physical.drops, 0);
  assert.equal(floor.inventory.consumeHeld('chalk').reason, 'empty');
  assert.equal(inventory.report().slots[0].uses, 6);
  key('1'); key('q'); key('g');
  assert.equal(inventory.physical.marks, 1); assert.equal(inventory.physical.drops, 1);
  assert.equal(inventory.report().slots[0].uses, 5);
});

test('inspection preserves empty hands, while explicitly clicking its pocket equips it', t => {
  const { inventory, key } = setup(t, makeItem('battery', 'cell'));
  key('1'); key('i');
  assert.equal(inventory.isOpen, true); assert.equal(inventory.held(), null);
  assert.equal(inventory.view.snapshot.slots[inventory.view.snapshot.selected].id, 'cell');
  inventory.view.callbacks.onSelect(0); assert.equal(inventory.held().id, 'cell');
});

test('accepting another item preserves an intentionally stowed pocket and pickup order', t => {
  const { inventory, floor, key } = setup(t, makeItem('battery', 'cell'));
  key('1'); assert.equal(floor.inventory.give(makeItem('paper', 'paper', { quantity: 3 })).index, 1);
  assert.equal(inventory.held(), null); assert.equal(inventory.report().selected, 0);
  assert.deepEqual(inventory.report().slots.map(item => item?.id || null), ['cell', 'paper', null, null, null, null]);
  assert.equal(inventory.count('battery'), 1); assert.equal(inventory.count('paper'), 3);
  key('2'); assert.equal(inventory.held().id, 'paper');
});

test('mounting leaves public and floor hands empty while F controls the equipped flashlight', t => {
  const light = makeItem('torch', 'light', { charge: 20, prepared: true });
  const { inventory, floor, camera, key } = setup(t, light);
  assert.equal(inventory.held().id, 'light');
  key('f'); inventory.update(2, true);
  const mounted = inventory.craft([{ slot: 0, id: 'light' }, CAMERA_INPUT]);
  assert.equal(mounted.ok, true); assert.equal(mounted.action, 'mount-torch');
  assert.equal(inventory.held(), null); assert.equal(floor.inventory.held(), null);
  assert.equal(inventory.report().slots[0], null); assert.equal(inventory.view.snapshot.slots[0], null);
  assert.equal(inventory.count('torch'), 0); assert.equal(floor.inventory.count('torch'), 0);
  assert.deepEqual(inventory.report().mountedTorch, { ...light, charge: 18 });
  assert.equal(floor.inventory.consumeHeld('torch').reason, 'empty');
  assert.equal(inventory.give(light).reason, 'duplicate');
  assert.equal(inventory.torchPower(), 1); assert.equal(floor.inventory.torchPower(), 1);
  inventory.update(3, true); assert.equal(inventory.report().mountedTorch.charge, 15);
  key('f'); assert.equal(inventory.torchPower(), 0);
  key('f', true); assert.equal(inventory.torchPower(), 0);
  key('f'); assert.equal(inventory.torchPower(), 1);
  assert.equal(inventory.give(makeItem('chalk', 'chalk')).index, 0);
  assert.equal(inventory.held().id, 'chalk'); key('1');
  assert.equal(inventory.held(), null); assert.equal(floor.inventory.held(), null);
  inventory.update(2, true); assert.equal(inventory.report().mountedTorch.charge, 13);
  assert.equal(inventory.view.snapshot.holstered, true); assert.equal(camera.read().remaining, 300);
});

// The real floor transfer code, with only rendering/fire replaced. The room
// is a clear square: picking up a supply must not secretly select its slot.
const worldReplacements = {
  three: moduleUrl(`export class Matrix4 { makeScale() { return this; } }
    export class Mesh { constructor(geometry, material) { this.material = material; this.position = { set() {} }; this.rotation = {}; } removeFromParent() {} }`),
  './kit.js': moduleUrl('export class Batch { addVox() {} } export const lamp = () => ({}), lightAt = () => [1, 1, 1], lin = value => value;'),
  './gen.js': moduleUrl('export const toLocal = (def, x, z) => ({ x, z }), toWorld = toLocal;'),
  './inventory-items.js': moduleUrl('export const INVENTORY_MODELS = { battery: {} };'),
  './inventory-state.js': replacements['./inventory-state.js'],
  './inventory-fire.js': moduleUrl('export const FIRE = {}; export const createInventoryFire = () => ({ occupied: () => false, threatAt() {}, update() {}, report: () => [], dispose() {} });'),
};
let worldSource = readFileSync(new URL('../public/world/backrooms/inventory-world.js', import.meta.url), 'utf8');
for (const [from, to] of Object.entries(worldReplacements)) worldSource = worldSource.replace(`'${from}'`, JSON.stringify(to));
const { createInventoryWorld } = await import(moduleUrl(worldSource));

function physicalSetup(t) {
  const model = createModel(); model.add(makeItem('battery', 'held')); model.select(0, { toggle: true });
  const room = { id: 'room', def: { y: 0, rot: 0 }, u: {}, uses: [], group: { visible: true, add() {} } };
  const env = {
    player: { me: { x: 0, y: .1, z: 0 } }, sound: { play() {} },
    world: { rooms: [room], roomAt: () => room, floorY: () => 0, headroom: () => 3, free: () => true, passable: () => true },
    kit: { VOXEL: 1, model: () => ({ solid: [] }), geometry: () => ({}), surface: () => ({ uniforms: { uTint: { value: { set() {} } } } }) },
  };
  const physical = createInventoryWorld(env, model);
  t.after(() => physical.dispose());
  return { model, physical, room };
}

test('ground pickup fills the next pocket without unholstering the selected item', t => {
  const { model, physical, room } = physicalSetup(t);
  assert.equal(physical.spawn(makeItem('battery', 'ground'), { room: 'room', x: .6, z: 0 }).ok, true);
  assert.equal(room.uses[0].use().ok, true);
  assert.equal(model.read().holstered, true); assert.equal(model.read().selected, 0);
  assert.deepEqual(model.read().slots.map(item => item?.id || null), ['held', 'ground', null, null, null, null]);
  assert.equal(physical.report().items[0].active, false);
});

test('direct physical drop also refuses a stowed item before any world allocation', t => {
  const { model, physical } = physicalSetup(t), before = model.read();
  assert.deepEqual(physical.dropSelected(), { ok: false, reason: 'empty' });
  assert.deepEqual(model.read(), before); assert.deepEqual(physical.report().items, []);
});

test('direct physical drop cannot allocate the flashlight after it becomes camera equipment', t => {
  const { model, physical } = physicalSetup(t);
  model.remove('held'); model.add(makeItem('torch', 'light', { charge: 20, prepared: true })); model.select(0);
  assert.equal(model.craft([{ slot: 0, id: 'light' }, CAMERA_INPUT], { camera: createCameraBattery() }).ok, true);
  model.toggleLight();
  const before = model.read();
  assert.deepEqual(physical.dropSelected(), { ok: false, reason: 'empty' });
  assert.deepEqual(model.read(), before); assert.deepEqual(physical.report().items, []);
  assert.equal(model.torchPower(), 1);
});

test('Q on a battery pack puts it straight into the camcorder, and only opens the bag when the camcorder is full', t => {
  const { inventory, camera, key } = setup(t, makeItem('battery', 'first'), makeItem('battery', 'second'));
  let began = 0; inventory.view.beginCombine = () => { began++; };
  camera.tick(60);                                                          // 240 s left of 400
  assert.equal(key('q'), true);
  assert.equal(camera.read().remaining, 360, 'a pack is two minutes');
  assert.equal(inventory.count('battery'), 1, 'and it is spent'); assert.equal(began, 0, 'no bag, no combining');
  assert.equal(inventory.isOpen, false);
  key('1', false); key('2'); key('q');                                      // the second pack: only 40 s of room left
  assert.equal(camera.read().remaining, 400); assert.equal(inventory.count('battery'), 0);
});

test('with the camcorder full, Q on a battery keeps the pack and offers the combination (a torch), as before', t => {
  const { inventory, camera, key } = setup(t, makeItem('battery', 'cell'));
  let began = 0; inventory.view.beginCombine = () => { began++; };
  camera.recharge(100);                                                     // full: 400 of 400
  key('q');
  assert.equal(inventory.count('battery'), 1); assert.equal(camera.read().remaining, 400); assert.equal(began, 1);
});

test('a stowed battery pack is not spent by Q', t => {
  const { inventory, camera, key } = setup(t, makeItem('battery', 'cell'));
  camera.tick(60); key('1'); key('q');
  assert.equal(inventory.count('battery'), 1); assert.equal(camera.read().remaining, 240);
});
