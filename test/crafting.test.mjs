import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventory, makeItem, ITEM_DEFS } from '../public/world/backrooms/inventory-state.js';
import { createCameraBattery } from '../public/world/backrooms/camera-state.js';
import { CAMERA_INPUT, FIRE_SECONDS_PER_SHEET, resolveCraftInput, previewCraft } from '../public/world/backrooms/crafting.js';

const ref = (model, slot) => ({ slot, id: model.read().slots[slot].id });
const mountedRef = model => ({ device: 'mounted-torch', id: model.read().mountedTorch.id });
const bag = (...items) => { const model = createInventory(); for (const item of items) model.add(item); return model; };
const item = (type, id = type, data) => makeItem(type, id, data);
const unchanged = (model, operation, reason) => {
  const before = model.read(), result = operation();
  assert.equal(result.ok, false); assert.equal(result.reason, reason);
  assert.deepEqual(model.read(), before);
};

test('craft inputs resolve exact identity and return detached records and camera state', () => {
  const model = bag(item('paper', 'paper', { quantity: 4 })), camera = createCameraBattery();
  const snapshot = { ...model.read(), camera: camera.read() };
  const resolved = resolveCraftInput(snapshot, ref(model, 0)); resolved.item.quantity = 1; resolved.ref.id = 'changed';
  assert.equal(snapshot.slots[0].quantity, 4); assert.equal(model.read().slots[0].id, 'paper');
  const cam = resolveCraftInput(snapshot, CAMERA_INPUT); cam.camera.remaining = 0; cam.ref.device = 'other';
  assert.equal(snapshot.camera.remaining, 300); assert.equal(CAMERA_INPUT.device, 'camera'); assert.ok(Object.isFrozen(CAMERA_INPUT));
  assert.equal(resolveCraftInput(snapshot, { slot: 0, id: 'old' }).reason, 'stale-input');
  for (const input of [null, [], { slot: -1, id: 'paper' }, { slot: 6, id: 'paper' }, { slot: .5, id: 'paper' }, { slot: 0 }, { device: 'other' }, { ...CAMERA_INPUT, slot: 0 }]) {
    assert.equal(resolveCraftInput(snapshot, input).ok, false);
  }
  assert.equal(resolveCraftInput(model.read(), CAMERA_INPUT).reason, 'camera-unavailable');
});

test('previews identify recipes in either order without altering inputs', () => {
  const model = bag(item('battery'), item('torch', 'torch', { charge: 42 }), item('paper', 'paper', { quantity: 5 }), item('lighter'), item('tape'));
  const snapshot = { ...model.read(), camera: createCameraBattery().read() }, before = structuredClone(snapshot);
  for (const [a, b, recipe] of [[ref(model, 0), ref(model, 1), 'torch-battery'], [ref(model, 0), CAMERA_INPUT, 'camera-battery'],
    [ref(model, 2), ref(model, 3), 'paper-fire'], [ref(model, 4), ref(model, 1), 'tape-torch']]) {
    for (const pair of [[a, b], [b, a]]) {
      const plan = previewCraft(snapshot, pair);
      assert.equal(plan.ok, true); assert.equal(plan.recipe, recipe); assert.ok(plan.label && plan.description);
    }
  }
  const fire = previewCraft(snapshot, [ref(model, 3), ref(model, 2)], { paperCount: 3 });
  assert.equal(FIRE_SECONDS_PER_SHEET, 8); assert.equal(fire.maxPaper, 5); assert.equal(fire.duration, 24);
  assert.deepEqual(snapshot, before);
});

test('invalid, duplicate or stale selections never call external effects or spend items', () => {
  const model = bag(item('battery'), item('paper'), item('lighter')), camera = createCameraBattery();
  const old = ref(model, 0); model.remove('battery'); model.add(item('battery', 'replacement'));
  let effects = 0;
  const service = { read: camera.read, recharge: () => { effects++; return { ok: true, added: 120 }; } };
  unchanged(model, () => model.craft([old, CAMERA_INPUT], { camera: service }), 'stale-input');
  unchanged(model, () => model.craft([ref(model, 1), ref(model, 1)], { ignite: () => { effects++; } }), 'duplicate-input');
  unchanged(model, () => model.craft([ref(model, 0)]), 'missing-input');
  unchanged(model, () => model.craft([ref(model, 0), ref(model, 2)]), 'incompatible');
  unchanged(model, () => model.craft([CAMERA_INPUT, CAMERA_INPUT], { camera: service }), 'duplicate-input');
  assert.equal(effects, 0); assert.equal(camera.read().remaining, 300);
});

test('battery fitting is order-independent, keeps active light and consumes exactly one pack', () => {
  const model = bag(item('torch', 'torch', { charge: 20 }), item('battery'));
  model.toggleLight(); const refs = [ref(model, 0), ref(model, 1)];
  const used = model.craft(refs);
  assert.equal(used.recipe, 'torch-battery'); assert.equal(used.action, 'recharge');
  assert.deepEqual(used.consumed, [item('battery')]); assert.equal(model.read().slots[0].charge, 180);
  assert.equal(model.read().activeTorch, 'torch');
  unchanged(model, () => model.craft(refs), 'stale-input');
  model.add(item('battery', 'second'));
  unchanged(model, () => model.craft([ref(model, 0), ref(model, 1)]), 'full-charge');
  used.item.charge = 0; assert.equal(model.read().slots[0].charge, 180);
});

test('camera recharge caps the addition and refuses full or expired cameras without wasting a pack', () => {
  const model = bag(item('battery', 'a'), item('battery', 'b'), item('battery', 'c')), camera = createCameraBattery();
  camera.tick(100);
  const firstRefs = [CAMERA_INPUT, ref(model, 0)], first = model.craft(firstRefs, { camera });
  assert.equal(first.action, 'recharge-camera'); assert.equal(first.result.added, 120); assert.equal(camera.read().remaining, 320);
  assert.equal(first.consumed[0].id, 'a');
  unchanged(model, () => model.craft(firstRefs, { camera }), 'stale-input');
  assert.equal(model.craft([ref(model, 1), CAMERA_INPUT], { camera }).result.added, 80);
  unchanged(model, () => model.craft([ref(model, 2), CAMERA_INPUT], { camera }), 'full-charge');
  camera.tick(400);
  unchanged(model, () => model.craft([ref(model, 2), CAMERA_INPUT], { camera }), 'depleted');
  assert.equal(camera.read().remaining, 0);
});

test('a camera effect rejection or missing service keeps the battery', () => {
  const model = bag(item('battery')), camera = createCameraBattery(), refs = [ref(model, 0), CAMERA_INPUT];
  unchanged(model, () => model.craft(refs), 'camera-unavailable');
  unchanged(model, () => model.craft(refs, { camera: { read: camera.read, recharge: () => ({ ok: false, reason: 'unavailable' }) } }), 'unavailable');
  unchanged(model, () => model.craft(refs, { camera: { read: camera.read, recharge: () => ({ ok: true, added: 0 }) } }), 'camera-unavailable');
  assert.equal(camera.read().remaining, 300);
});

test('paper fire uses eight seconds per chosen sheet and keeps the lighter reusable', () => {
  const model = bag(item('paper', 'paper', { quantity: 10 }), item('lighter')), calls = [];
  const refs = [ref(model, 1), ref(model, 0)];
  const ignite = request => { calls.push(structuredClone(request)); request.paper.quantity = 99; request.lighter.id = 'wrong'; return { ok: true, fire: calls.length }; };
  const first = model.craft(refs, { ignite });
  assert.equal(first.duration, 8); assert.equal(first.consumed[0].quantity, 1); assert.equal(model.read().slots[0].quantity, 9);
  const rest = model.craft(refs, { paperCount: 9, ignite });
  assert.equal(rest.duration, 72); assert.equal(model.read().slots[0], null);
  assert.deepEqual(model.read().slots[1], item('lighter'));
  assert.deepEqual(calls.map(call => [call.paperCount, call.duration]), [[1, 8], [9, 72]]);
  unchanged(model, () => model.craft(refs, { ignite }), 'stale-input');
  assert.equal(calls.length, 2);
});

test('invalid sheet counts and rejected fire placement consume no paper', () => {
  const model = bag(item('paper', 'paper', { quantity: 2 }), item('lighter')), refs = [ref(model, 0), ref(model, 1)];
  let calls = 0; const ignite = () => { calls++; return { ok: true }; };
  for (const paperCount of [0, -1, 11, .5, NaN, Infinity, '1', null, Symbol('sheet')]) unchanged(model, () => model.craft(refs, { paperCount, ignite }), 'invalid-amount');
  unchanged(model, () => model.craft(refs, { paperCount: 3, ignite }), 'insufficient');
  assert.equal(calls, 0);
  unchanged(model, () => model.craft(refs), 'fire-unavailable');
  unchanged(model, () => model.craft(refs, { ignite: () => ({ ok: false, reason: 'no-fire-space' }) }), 'no-fire-space');
  unchanged(model, () => model.craft(refs, { ignite: () => { throw new Error('no placement'); } }), 'effect-failed');
  assert.equal(model.craft(refs, { ignite }).ok, true); assert.equal(calls, 1);
});

test('ten sheets make an eighty-second fire without consuming the lighter', () => {
  const model = bag(item('paper', 'whole-stack', { quantity: 10 }), item('lighter'));
  let duration;
  const result = model.craft([ref(model, 0), ref(model, 1)], { paperCount: 10,
    ignite: request => { duration = request.duration; return { ok: true }; } });
  assert.equal(duration, 80); assert.equal(result.consumed[0].quantity, 10);
  assert.equal(model.read().slots[0], null); assert.equal(model.read().slots[1].type, 'lighter');
});

test('an external effect cannot reenter crafting or replace an input during the transfer', () => {
  const model = bag(item('paper', 'paper', { quantity: 2 }), item('lighter')), refs = [ref(model, 0), ref(model, 1)];
  const result = model.craft(refs, { ignite: () => {
    assert.equal(model.craft(refs).reason, 'busy'); assert.equal(model.remove('paper'), null);
    assert.equal(model.consumeSelected('paper').reason, 'busy'); assert.equal(model.select(1), false);
    assert.equal(model.add(item('battery')).reason, 'busy'); model.clear();
    assert.equal(model.read().slots[0].quantity, 2);
    return { ok: true };
  } });
  assert.equal(result.ok, true); assert.equal(model.read().slots[0].quantity, 1);
  result.consumed[0].quantity = 100; assert.equal(model.read().slots[0].quantity, 1);
});

test('paper, packs, tape and the reusable lighter open crafting without consuming anything', () => {
  for (const type of ['paper', 'battery', 'tape', 'lighter']) {
    const model = bag(item(type)), before = model.read();
    assert.equal(model.useSelected().action, 'combine'); assert.deepEqual(model.read(), before);
  }
  assert.equal(ITEM_DEFS.lighter.useLabel, 'Combine');
});

test('tape prepares the same flashlight once while preserving charge and armed state', () => {
  const model = bag(item('torch', 'light', { charge: 37 }), item('tape', 'one'), item('tape', 'two'));
  model.toggleLight(); const result = model.craft([ref(model, 1), ref(model, 0)]);
  assert.equal(result.action, 'prepare-torch'); assert.equal(result.consumed[0].id, 'one');
  assert.deepEqual(model.read().slots[0], item('torch', 'light', { charge: 37, prepared: true }));
  assert.equal(model.read().activeTorch, 'light');
  unchanged(model, () => model.craft([ref(model, 0), ref(model, 2)]), 'already-prepared');
  result.item.prepared = false; assert.equal(model.read().slots[0].prepared, true);
  for (const prepared of [1, null, 'true']) assert.throws(() => item('torch', 'bad', { prepared }), TypeError);
});

test('only one prepared flashlight can leave its pocket and mount to the camera', () => {
  const model = bag(item('torch', 'plain'), item('torch', 'ready', { prepared: true }), item('torch', 'other', { prepared: true }));
  const camera = createCameraBattery();
  unchanged(model, () => model.craft([ref(model, 0), CAMERA_INPUT], { camera }), 'not-prepared');
  const pocket = ref(model, 1), result = model.craft([CAMERA_INPUT, pocket], { camera });
  assert.equal(result.action, 'mount-torch'); assert.deepEqual(result.consumed, []);
  assert.deepEqual(model.read().mountedTorch, item('torch', 'ready', { prepared: true }));
  assert.equal(model.read().activeTorch, null); assert.equal(model.read().slots[1], null);
  assert.equal(model.read().slots.filter(Boolean).length, 2);
  unchanged(model, () => model.craft([pocket, CAMERA_INPUT], { camera }), 'stale-input');
  unchanged(model, () => model.craft([mountedRef(model), CAMERA_INPUT], { camera }), 'already-mounted');
  unchanged(model, () => model.craft([ref(model, 2), CAMERA_INPUT], { camera }), 'mount-occupied');
  assert.equal(camera.read().remaining, 300);
});

test('mounting frees a usable pocket in a full bag and preserves charge, on-state, selection and holstering', () => {
  for (const on of [false, true]) for (const holstered of [false, true]) {
    const torch = item('torch', 'light', { charge: 37, prepared: true });
    const model = bag(item('chalk'), item('lighter'), torch, item('tape'), item('battery'), item('scissors'));
    const camera = createCameraBattery(), cameraBefore = camera.read();
    model.select(2);
    if (on) { model.toggleLight(); model.tick(4); }
    if (holstered) model.select(2, { toggle: true });
    const before = model.read(), pocket = ref(model, 2);
    unchanged(model, () => model.add(item('snack')), 'full');
    const result = model.craft([pocket, CAMERA_INPUT], { camera });
    assert.equal(result.ok, true);
    assert.deepEqual(model.read().mountedTorch, before.slots[2]);
    assert.equal(model.read().slots[2], null); assert.equal(model.read().selected, 2);
    assert.equal(model.read().holstered, holstered); assert.equal(model.read().activeTorch, on ? 'light' : null);
    assert.equal(model.torchPower(), on ? 1 : 0);
    assert.equal(model.add(item('snack')).index, 2);
    assert.equal(model.read().slots.filter(Boolean).length, 6);
    assert.equal(model.read().selected, 2); assert.equal(model.read().holstered, holstered);
    assert.deepEqual(camera.read(), cameraBefore);
    result.item.charge = 0; result.item.prepared = false;
    before.slots[2].charge = 0; torch.charge = 0;
    assert.equal(model.read().mountedTorch.charge, on ? 33 : 37);
    assert.equal(model.read().mountedTorch.prepared, true);
  }
});

test('mounted crafting inputs resolve exact equipment identity and return detached snapshots', () => {
  const model = bag(item('torch', 'light', { charge: 23, prepared: true }), item('battery'));
  const pocket = ref(model, 0), camera = createCameraBattery();
  assert.equal(model.craft([pocket, CAMERA_INPUT], { camera }).ok, true);
  const input = mountedRef(model), snapshot = model.read(), resolved = resolveCraftInput(snapshot, input);
  assert.equal(resolved.ok, true); assert.equal(resolved.type, 'torch');
  assert.deepEqual(resolved.ref, input); assert.deepEqual(resolved.item, snapshot.mountedTorch);
  resolved.item.charge = 0; resolved.ref.id = 'changed';
  assert.equal(input.id, 'light'); assert.equal(snapshot.mountedTorch.charge, 23);
  snapshot.mountedTorch.charge = 0; snapshot.mountedTorch.id = 'changed';
  assert.equal(model.read().mountedTorch.charge, 23); assert.equal(model.read().mountedTorch.id, 'light');
  assert.equal(resolveCraftInput(model.read(), pocket).reason, 'stale-input');
  assert.equal(resolveCraftInput(model.read(), { ...input, id: 'old' }).reason, 'stale-input');
  for (const invalid of [{ device: 'mounted-torch' }, { ...input, id: '' }, { ...input, id: 1 }, { ...input, slot: 0 }]) {
    assert.equal(resolveCraftInput(model.read(), invalid).reason, 'invalid-input');
  }
  unchanged(model, () => model.craft([input, input]), 'duplicate-input');
  unchanged(model, () => model.craft([ref(model, 1), { ...input, id: 'old' }]), 'stale-input');
  model.clear();
  assert.equal(resolveCraftInput(model.read(), input).reason, 'stale-input');
  model.add(item('torch', 'replacement', { charge: 10, prepared: true })); model.add(item('battery', 'replacement-pack'));
  model.craft([ref(model, 0), CAMERA_INPUT], { camera });
  unchanged(model, () => model.craft([input, ref(model, 1)]), 'stale-input');
  assert.equal(model.read().mountedTorch.id, 'replacement');
});

test('an armed loose flashlight emits and drains only while its pocket is selected', () => {
  const model = bag(item('torch', 'light', { charge: 20 }), item('paper'));
  assert.equal(model.toggleLight().action, 'torch-on'); model.tick(2);
  model.select(1); assert.equal(model.read().activeTorch, 'light'); assert.equal(model.torchPower(), 0);
  const hidden = model.read(); model.tick(10); assert.deepEqual(model.read(), hidden);
  unchanged(model, () => model.toggleLight(), 'no-light');
  model.select(0); assert.equal(model.torchPower(), 1); model.tick(3);
  assert.equal(model.read().slots[0].charge, 15); assert.equal(model.toggleLight().action, 'torch-off');
});

test('stowing an armed loose flashlight stops its beam and drain until reselected', () => {
  const model = bag(item('torch', 'light', { charge: 20 }));
  model.toggleLight(); model.tick(2); model.select(0, { toggle: true });
  assert.equal(model.read().activeTorch, 'light'); assert.equal(model.torchPower(), 0);
  const stowed = model.read(); model.tick(10); assert.deepEqual(model.read(), stowed);
  unchanged(model, () => model.toggleLight(), 'no-light');
  unchanged(model, () => model.useSelected(), 'empty');
  model.select(0, { toggle: true }); assert.equal(model.torchPower(), 1); model.tick(3);
  assert.equal(model.read().slots[0].charge, 15);
});

test('a mounted flashlight keeps working with empty hands and F still toggles it', () => {
  const model = bag(item('torch', 'mounted', { charge: 20, prepared: true }));
  model.select(0, { toggle: true });
  model.craft([ref(model, 0), CAMERA_INPUT], { camera: createCameraBattery() });
  model.toggleLight();
  assert.equal(model.read().holstered, true); assert.equal(model.torchPower(), 1);
  assert.equal(model.read().slots[0], null);
  model.tick(3); assert.equal(model.read().mountedTorch.charge, 17);
  assert.equal(model.toggleLight().action, 'torch-off'); assert.equal(model.torchPower(), 0);
  const off = model.read(); model.tick(10); assert.deepEqual(model.read(), off);
  assert.equal(model.toggleLight().action, 'torch-on'); assert.equal(model.torchPower(), 1);
  assert.equal(model.read().holstered, true);
});

test('F prioritizes a mounted lamp, which keeps emitting while another item is held', () => {
  const model = bag(item('torch', 'mounted', { charge: 10, prepared: true }), item('torch', 'loose'), item('paper'));
  model.craft([ref(model, 0), CAMERA_INPUT], { camera: createCameraBattery() });
  model.select(2); assert.equal(model.toggleLight().item.id, 'mounted'); assert.equal(model.torchPower(), 1);
  model.tick(2); assert.equal(model.read().mountedTorch.charge, 8);
  model.select(1); model.useSelected(); assert.equal(model.read().activeTorch, 'loose'); model.tick(1);
  assert.equal(model.read().mountedTorch.charge, 8); assert.equal(model.read().slots[1].charge, 179);
  assert.equal(model.toggleLight().item.id, 'mounted'); assert.equal(model.read().activeTorch, 'mounted');
  assert.equal(model.toggleLight().action, 'torch-off'); assert.equal(model.torchPower(), 0);
});

test('mounted equipment cannot be dropped, handed off, or added again as a pocket item', () => {
  const camera = createCameraBattery(), model = bag(item('torch', 'light', { charge: 20, prepared: true }));
  model.craft([ref(model, 0), CAMERA_INPUT], { camera }); model.toggleLight(); model.tick(2);
  const equipped = model.read();
  assert.equal(model.remove('light'), null); assert.deepEqual(model.read(), equipped);
  unchanged(model, () => model.consumeSelected('torch'), 'empty');
  unchanged(model, () => model.useSelected(), 'empty');
  unchanged(model, () => model.add(equipped.mountedTorch), 'duplicate');
  unchanged(model, () => model.add(item('chalk', 'light')), 'duplicate');
  model.add(item('chalk'));
  unchanged(model, () => model.consumeSelected('torch'), 'wrong-item');
  assert.equal(model.consumeSelected('chalk').ok, true);
  model.add(item('torch', 'loose', { prepared: true }));
  assert.equal(model.remove('loose').prepared, true);
  assert.deepEqual(model.read().mountedTorch, equipped.mountedTorch);
  assert.equal(model.read().activeTorch, 'light'); assert.equal(model.torchPower(), 1);
  model.clear();
  assert.equal(model.read().mountedTorch, null); assert.equal(model.read().activeTorch, null); assert.equal(model.torchPower(), 0);
  assert.equal(model.add(equipped.mountedTorch).ok, true);
  assert.equal(model.read().mountedTorch, null);
});

test('camera and mounted-light battery recipes recharge only the explicitly chosen device', () => {
  for (const reversed of [false, true]) {
    const model = bag(item('torch', 'light', { charge: 37, prepared: true }), item('battery', 'camera-pack'),
      item('battery', 'light-pack'), item('battery', 'spare'));
    const camera = createCameraBattery(); camera.tick(50);
    model.craft([ref(model, 0), CAMERA_INPUT], { camera }); model.toggleLight();
    const light = mountedRef(model), pair = (a, b) => reversed ? [b, a] : [a, b];
    const cameraResult = model.craft(pair(ref(model, 1), CAMERA_INPUT), { camera });
    assert.equal(cameraResult.recipe, 'camera-battery'); assert.equal(cameraResult.result.added, 120);
    assert.equal(camera.read().remaining, 370); assert.equal(model.read().mountedTorch.charge, 37);
    assert.deepEqual(cameraResult.consumed, [item('battery', 'camera-pack')]);
    const refs = pair(ref(model, 2), light), snapshot = { ...model.read(), camera: camera.read() }, before = structuredClone(snapshot);
    assert.equal(previewCraft(snapshot, refs).recipe, 'torch-battery'); assert.deepEqual(snapshot, before);
    const cameraBefore = camera.read(), lightResult = model.craft(refs);
    assert.equal(lightResult.ok, true); assert.equal(lightResult.recipe, 'torch-battery'); assert.equal(lightResult.action, 'recharge');
    assert.deepEqual(lightResult.consumed, [item('battery', 'light-pack')]);
    assert.equal(model.read().mountedTorch.charge, 180); assert.equal(model.read().mountedTorch.prepared, true);
    assert.equal(model.read().activeTorch, 'light'); assert.equal(model.torchPower(), 1);
    assert.deepEqual(camera.read(), cameraBefore);
    lightResult.item.charge = 0; assert.equal(model.read().mountedTorch.charge, 180);
    unchanged(model, () => model.craft(refs), 'stale-input');
    unchanged(model, () => model.craft(pair(ref(model, 3), light)), 'full-charge');
    assert.equal(model.read().slots[3].id, 'spare');
  }
});

test('depleting a mounted lamp preserves its mount and recharging it does not silently switch it on', () => {
  const model = bag(item('torch', 'light', { charge: 1, prepared: true }), item('battery')), camera = createCameraBattery();
  model.craft([ref(model, 0), CAMERA_INPUT], { camera }); model.select(1); model.toggleLight();
  assert.deepEqual(model.tick(2), { changed: true, depleted: true });
  assert.deepEqual(model.read().mountedTorch, item('torch', 'light', { charge: 0, prepared: true }));
  assert.equal(model.read().activeTorch, null); assert.equal(model.torchPower(), 0);
  unchanged(model, () => model.toggleLight(), 'empty-charge');
  assert.deepEqual(model.tick(2), { changed: false, depleted: false });
  camera.tick(300);
  assert.equal(model.craft([ref(model, 1), mountedRef(model)], { camera }).ok, true);
  assert.equal(model.read().mountedTorch.id, 'light'); assert.equal(model.read().mountedTorch.charge, 180);
  assert.equal(model.read().activeTorch, null); assert.equal(camera.read().remaining, 0);
  const off = model.read(); model.tick(10); assert.deepEqual(model.read(), off);
  assert.equal(model.toggleLight().action, 'torch-on'); assert.equal(model.torchPower(), 1);
});
