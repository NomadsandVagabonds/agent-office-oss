import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_DEFS, makeItem, createInventory } from '../public/world/backrooms/inventory-state.js';

const item = (type, id, data) => makeItem(type, id, data);
const unchanged = (model, operation, reason) => {
  const before = model.read(), result = operation();
  assert.equal(result.ok, false); assert.equal(result.reason, reason);
  assert.deepEqual(model.read(), before);
};

test('six slots reject duplicates, a seventh object and malformed records without losing items', () => {
  const model = createInventory();
  assert.deepEqual(model.read().slots, [null, null, null, null, null, null]);
  for (let n = 0; n < 6; n++) assert.equal(model.add(item('battery', `cell-${n}`)).index, n);
  unchanged(model, () => model.add(item('battery', 'extra')), 'full');
  unchanged(model, () => model.add(item('chalk', 'cell-0')), 'duplicate');
  for (const value of [null, {}, { type: 'coin', id: 'reward' }, { type: 'torch', id: '' }, { type: '__proto__', id: 'bad' }, { type: 'torch', id: 'bad', charge: NaN }]) {
    unchanged(model, () => model.add(value), 'invalid-item');
  }
  const beforeRemove = model.read();
  for (const id of ['missing', undefined, null, '', 0]) assert.equal(model.remove(id), null);
  assert.deepEqual(model.read(), beforeRemove);
  assert.equal(model.read().slots.filter(Boolean).length, 6);
  for (const size of [0, 7, 1.5, NaN]) assert.throws(() => createInventory({ size }), RangeError);
});

test('construction and snapshots cannot mutate inventory contents or item definitions', () => {
  const model = createInventory(), source = item('torch', 'torch-a', { charge: 42 });
  const added = model.add(source);
  source.charge = 0; added.item.charge = 0;
  const snapshot = model.read(); snapshot.slots[0].charge = 0; snapshot.slots.push(item('battery', 'injected'));
  assert.equal(model.read().slots[0].charge, 42);
  assert.equal(model.read().slots.length, 6);
  assert.ok(Object.isFrozen(ITEM_DEFS)); assert.ok(Object.isFrozen(ITEM_DEFS.torch));
  assert.throws(() => makeItem('torch', 'bad', { charge: -1 }), RangeError);
  assert.throws(() => makeItem('torch', 'bad', { charge: Infinity }), RangeError);
  assert.throws(() => makeItem('chalk', 'bad', { uses: 1.5 }), RangeError);
  assert.throws(() => makeItem('chalk', 'bad', { uses: 7 }), RangeError);
});

test('selection follows numbered slots and a dropped torch preserves charge while turning off', () => {
  const model = createInventory();
  model.add(item('battery', 'cell')); model.add(item('torch', 'torch', { charge: 70 }));
  assert.equal(model.select(1), true); assert.equal(model.useSelected().action, 'torch-on');
  model.tick(2.5);
  for (const index of [-1, 6, 1.2, NaN]) assert.equal(model.select(index), false);
  assert.equal(model.read().selected, 1);
  const dropped = model.remove('torch');
  assert.equal(dropped.charge, 67.5); assert.equal(model.read().activeTorch, null);
  assert.equal(model.read().selected, 1); assert.equal(model.read().slots[1], null);
  assert.equal(model.tick(20).changed, false);
  assert.equal(model.add(dropped).index, 1);
  assert.equal(model.read().slots[1].charge, 67.5); assert.equal(model.read().activeTorch, null);
  dropped.charge = 0;
  assert.equal(model.read().slots[1].charge, 67.5);
});

test('only one carried torch drains, toggling pauses it, and depletion cannot produce negative charge', () => {
  const model = createInventory();
  model.add(item('torch', 'first', { charge: 4 })); model.add(item('torch', 'second', { charge: 8 }));
  model.useSelected(); model.tick(1);
  assert.equal(model.read().slots[0].charge, 3);
  model.select(1); model.useSelected(); model.tick(2);
  assert.equal(model.read().slots[0].charge, 3); assert.equal(model.read().slots[1].charge, 6);
  assert.equal(model.read().activeTorch, 'second');
  assert.equal(model.useSelected().action, 'torch-off'); model.tick(20);
  assert.equal(model.read().slots[1].charge, 6);
  model.useSelected(); const before = model.read();
  for (const dt of [NaN, Infinity, -1, 0]) assert.equal(model.tick(dt).changed, false);
  assert.deepEqual(model.read(), before);
  assert.deepEqual(model.tick(100), { changed: true, depleted: true });
  assert.equal(model.read().activeTorch, null); assert.equal(model.read().slots[1].charge, 0);
  unchanged(model, () => model.useSelected(), 'empty-charge');
  assert.equal(model.tick(1).changed, false);
});

test('battery combining is explicit and atomic; invalid recipes or a full torch waste nothing', () => {
  const model = createInventory();
  model.add(item('torch', 'torch')); model.add(item('battery', 'cell')); model.add(item('chalk', 'chalk'));
  model.select(1); const before = model.read();
  assert.equal(model.useSelected().action, 'combine'); assert.deepEqual(model.read(), before);
  unchanged(model, () => model.combine(1, 0), 'full-charge');
  for (const pair of [[1, 1], [1, 2], [2, 0], [0, 1], [1, 5]]) unchanged(model, () => model.combine(...pair), 'incompatible');
  for (const pair of [[1, 6], [-1, 0], [NaN, 0]]) unchanged(model, () => model.combine(...pair), 'invalid-slot');
  model.select(0); model.useSelected(); model.tick(17.5); model.select(1);
  const result = model.combine(1, 0);
  assert.equal(result.action, 'recharge'); assert.equal(result.consumed.id, 'cell');
  assert.equal(model.read().slots[0].charge, 180); assert.equal(model.read().slots[1], null);
  assert.equal(model.read().activeTorch, 'torch'); assert.equal(model.read().selected, 0);
  result.item.charge = 0;
  assert.equal(model.read().slots[0].charge, 180);
  unchanged(model, () => model.combine(1, 0), 'incompatible');
});

test('replacing a depleted battery pack does not silently switch the flashlight on', () => {
  const model = createInventory();
  model.add(item('torch', 'empty-torch', { charge: 0 })); model.add(item('battery', 'cell'));
  assert.equal(model.combine(1, 0).ok, true);
  assert.equal(model.read().slots[0].charge, 180); assert.equal(model.read().activeTorch, null);
  assert.equal(model.useSelected().action, 'torch-on');
});

test('chalk is consumed only when the world can place a mark, including the final use', () => {
  const model = createInventory(); model.add(item('chalk', 'chalk', { uses: 2 }));
  unchanged(model, () => model.useSelected({ canMark: false }), 'no-mark-space');
  const first = model.useSelected();
  assert.equal(first.action, 'mark'); assert.equal(first.item.uses, 1);
  first.item.uses = 99;
  assert.equal(model.read().slots[0].uses, 1);
  const dropped = model.remove('chalk');
  assert.equal(dropped.uses, 1); model.add(dropped);
  const last = model.useSelected();
  assert.equal(last.action, 'mark'); assert.equal(last.item.uses, 0);
  assert.equal(model.read().slots[0], null);
  unchanged(model, () => model.useSelected(), 'empty');
});

test('clearing a visit removes supplies, active light and selection', () => {
  const model = createInventory(); model.add(item('torch', 'torch')); model.useSelected(); model.select(3);
  model.clear();
  assert.deepEqual(model.read().slots, Array(6).fill(null));
  assert.equal(model.read().activeTorch, null); assert.equal(model.read().selected, 0);
  const empty = model.read(); model.clear(); assert.deepEqual(model.read(), empty);
});
