import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_DEFS, makeItem, createInventory, normalizeItemType } from '../public/world/backrooms/inventory-state.js';
import { createHealth } from '../public/world/backrooms/health-state.js';

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

test('paper fills an existing ten-sheet stack before opening another slot', () => {
  const model = createInventory();
  assert.equal(makeItem('paper', 'single').quantity, 1);
  assert.equal(ITEM_DEFS.paper.maxStack, 10);
  const source = item('paper', 'first-stack', { quantity: 7 });
  assert.equal(model.add(source).accepted, 7);
  source.quantity = 1;
  const topUp = model.add(item('paper', 'three-more', { quantity: 3 }));
  assert.equal(topUp.accepted, 3); assert.equal(topUp.remainder, null); assert.equal(topUp.index, 0);
  assert.deepEqual(model.read().slots[0], { id: 'first-stack', type: 'paper', quantity: 10 });
  assert.equal(model.read().slots.filter(Boolean).length, 1);
  topUp.item.quantity = 99;
  assert.equal(model.read().slots[0].quantity, 10);

  const second = createInventory(); second.add(item('paper', 'existing', { quantity: 7 }));
  const spill = second.add(item('paper', 'new-stack', { quantity: 9 }));
  assert.equal(spill.accepted, 9); assert.equal(spill.remainder, null);
  assert.deepEqual(second.read().slots.slice(0, 2), [
    { id: 'existing', type: 'paper', quantity: 10 },
    { id: 'new-stack', type: 'paper', quantity: 6 },
  ]);
  unchanged(second, () => second.add(item('paper', 'new-stack', { quantity: 1 })), 'duplicate');
});

test('partial paper pickup preserves every sheet and its remaining ground identity', () => {
  const model = createInventory(); model.add(item('paper', 'carried-stack', { quantity: 7 }));
  for (let n = 1; n < 6; n++) model.add(item('battery', `cell-${n}`));
  const incoming = item('paper', 'ground-stack', { quantity: 8 });
  const partial = model.add(incoming);
  assert.equal(partial.ok, true); assert.equal(partial.accepted, 3); assert.equal(partial.index, 0);
  assert.deepEqual(partial.remainder, { id: 'ground-stack', type: 'paper', quantity: 5 });
  assert.equal(model.read().slots[0].quantity + partial.remainder.quantity, 15);
  assert.equal(model.read().slots.some(s => s?.id === 'ground-stack'), false);
  assert.equal(incoming.quantity, 8);
  unchanged(model, () => model.add(partial.remainder), 'full');
  assert.equal(model.read().slots[0].quantity, 10);
  const remaining = { ...partial.remainder }; partial.remainder.quantity = 1;
  assert.equal(model.read().slots[0].quantity, 10);
  model.remove('cell-1');
  const finished = model.add(remaining);
  assert.equal(finished.accepted, 5); assert.equal(finished.remainder, null);
  assert.deepEqual(model.read().slots[1], remaining);
  assert.equal(model.read().slots.filter(s => s?.type === 'paper').reduce((n, s) => n + s.quantity, 0), 15);
  unchanged(model, () => model.add(remaining), 'duplicate');
});

test('paper drop and re-pick preserve count and can transfer part of a stack repeatedly', () => {
  const model = createInventory({ size: 2 });
  model.add(item('paper', 'one', { quantity: 8 })); model.add(item('paper', 'two', { quantity: 9 }));
  assert.equal(model.read().slots[1].quantity, 7);
  const dropped = model.remove('one');
  assert.deepEqual(dropped, { id: 'one', type: 'paper', quantity: 10 });
  model.add(item('scissors', 'scissors'));
  const partial = model.add(dropped);
  assert.equal(partial.accepted, 3); assert.equal(partial.remainder.quantity, 7);
  assert.equal(partial.remainder.id, dropped.id);
  assert.equal(model.read().slots[1].quantity, 10);
  unchanged(model, () => model.add(partial.remainder), 'full');
  model.remove('scissors');
  assert.equal(model.add(partial.remainder).accepted, 7);
  assert.equal(model.remove('one').quantity, 7);
  assert.equal(model.read().slots[1].quantity, 10);
});

test('invalid paper quantities do not create, inflate or mutate carried stacks', () => {
  const model = createInventory(); model.add(item('paper', 'valid', { quantity: 4 }));
  for (const quantity of [0, -1, 11, 1.5, NaN, Infinity, '3', null]) {
    assert.throws(() => makeItem('paper', 'invalid', { quantity }), RangeError);
    unchanged(model, () => model.add({ id: 'invalid', type: 'paper', quantity }), 'invalid-item');
  }
  const read = model.read(); read.slots[0].quantity = 100;
  assert.equal(model.read().slots[0].quantity, 4);
});

test('paper opens combining, scissors need a snip target, and snacks need a health callback', () => {
  const model = createInventory();
  for (const type of ['paper', 'scissors', 'snack', 'pink-slip']) {
    const added = model.add(item(type, type));
    assert.equal(added.ok, true); assert.equal(added.accepted, 1); assert.equal(added.remainder, null);
    model.select(added.index);
    if (type === 'paper') {
      const before = model.read();
      assert.equal(model.useSelected().action, 'combine');
      assert.equal(model.useSelected({ canMark: false }).action, 'combine');
      assert.deepEqual(model.read(), before);
    } else {
      const expected = type === 'snack' ? 'health-unavailable' : type === 'scissors' ? 'no-snip-target' : 'no-use';
      unchanged(model, () => model.useSelected(), expected);
      unchanged(model, () => model.useSelected({ canMark: false }), expected);
    }
    if (type === 'scissors') {
      assert.equal(model.read().slots[added.index].uses, 3);
    } else {
      assert.equal(Object.hasOwn(model.read().slots[added.index], 'uses'), false);
    }
    assert.ok(ITEM_DEFS[type].name && ITEM_DEFS[type].description);
  }
  assert.equal(ITEM_DEFS.scissors.maxUses, 3);
  assert.equal(ITEM_DEFS.scissors.useLabel, 'Snip');
  assert.equal(ITEM_DEFS.snack.healAmount, 1);
  assert.equal(Object.hasOwn(model.read(), 'health'), false);
  unchanged(model, () => model.combine(1, 0), 'incompatible');
  const snack = model.remove('snack'); assert.equal(snack.type, 'snack');
  assert.equal(model.add(snack).ok, true);
});

test('snacks heal one point and consume only the held snack after actual healing', () => {
  const model = createInventory(), health = createHealth();
  model.add(item('snack', 'first')); model.add(item('snack', 'second'));
  unchanged(model, () => model.useSelected({ heal: health.heal }), 'full-health');
  health.damage();
  const used = model.useSelected({ heal: health.heal });
  assert.deepEqual(used, { ok: true, action: 'heal', amount: 1, item: { id: 'first', type: 'snack' }, index: 0 });
  assert.equal(health.read().current, 4); assert.equal(model.read().slots[0], null);
  assert.equal(model.read().slots[1].id, 'second');
  unchanged(model, () => model.useSelected({ heal: health.heal }), 'empty');
  model.select(1);
  unchanged(model, () => model.useSelected({ heal: health.heal }), 'full-health');
  assert.equal(health.read().current, 4);
});

test('dead, rejected or unavailable healing never wastes a snack', () => {
  const model = createInventory(), health = createHealth(); model.add(item('snack', 'kept'));
  health.damage(4);
  unchanged(model, () => model.useSelected({ heal: health.heal }), 'dead');
  assert.equal(health.read().current, 0);
  unchanged(model, () => model.useSelected({ heal: () => ({ ok: false, reason: 'paused' }) }), 'paused');
  for (const heal of [null, true, undefined, () => undefined, () => ({ ok: 'yes', amount: 1 }), () => ({ ok: true, amount: 0 }), () => ({ ok: true, amount: NaN })]) {
    unchanged(model, () => model.useSelected({ heal }), 'health-unavailable');
  }
});

test('healing consumes the original held snack even if feedback changes selection', () => {
  const model = createInventory(), health = createHealth();
  model.add(item('snack', 'held')); model.add(item('scissors', 'other')); health.damage();
  const result = model.useSelected({ heal: amount => { model.select(1); return health.heal(amount); } });
  assert.equal(result.index, 0); assert.equal(result.item.id, 'held');
  assert.equal(model.read().slots[0], null); assert.equal(model.read().slots[1].id, 'other');
  assert.equal(model.read().selected, 1); assert.equal(health.read().current, 4);
});

test('explicit room aliases normalize to canonical types without creating paper variants', () => {
  const aliases = { 'loose-papers': 'paper', 'red-balloon': 'balloon', 'facilities-flashlight': 'torch' };
  for (const [alias, canonical] of Object.entries(aliases)) {
    assert.equal(normalizeItemType(alias), canonical);
    assert.equal(normalizeItemType(canonical), canonical);
    assert.equal(makeItem(alias, alias).type, canonical);
  }
  assert.equal(makeItem('facilities-flashlight', 'lamp', { charge: 12 }).charge, 12);
  // the pink slip is its own thing (FORM HR-404), one to a pocket: it never joins a stack of paper
  const pink = makeItem('pink-slip', 'slip', { quantity: 2, variant: 'pink', label: 'pink slip' });
  assert.deepEqual(pink, { id: 'slip', type: 'pink-slip' });
  const model = createInventory();
  model.add(makeItem('loose-papers', 'loose', { quantity: 8 })); model.add(pink);
  assert.deepEqual(model.read().slots[0], { id: 'loose', type: 'paper', quantity: 8 });
  assert.deepEqual(model.read().slots[1], { id: 'slip', type: 'pink-slip' });
  assert.equal(model.read().slots.filter(Boolean).length, 2);
  assert.throws(() => makeItem('paper', 'too-many', { quantity: 11 }), RangeError);
  assert.equal(model.add({ id: 'too-many', type: 'loose-papers', quantity: 11 }).reason, 'invalid-item');
  for (const unknown of ['Paper', 'pink slip', 'pink-slips', 'red_balloon', ' torch ', '__proto__', 'constructor', {}, undefined, null]) {
    assert.equal(normalizeItemType(unknown), null);
    assert.throws(() => makeItem(unknown, 'unknown'), TypeError);
  }
});

test('a held paper stack gives exactly one sheet and rejects requests aimed at other pockets', () => {
  const model = createInventory();
  model.add(item('paper', 'held-paper', { quantity: 4 })); model.add(item('scissors', 'tool'));
  unchanged(model, () => model.consumeSelected('pink-slip'), 'wrong-item');          // (paper is not a pink slip: what eats either asks for what is held — items.js)
  const handed = model.consumeSelected('loose-papers');
  assert.deepEqual(handed, { ok: true, action: 'consume', item: { id: 'held-paper', type: 'paper', quantity: 1 }, index: 0 });
  assert.equal(model.read().slots[0].quantity, 3);
  handed.item.quantity = 100;
  assert.equal(model.read().slots[0].quantity, 3);
  model.select(1);
  unchanged(model, () => model.consumeSelected('paper'), 'wrong-item');
  assert.equal(model.read().slots[0].quantity, 3);
  model.select(5);
  unchanged(model, () => model.consumeSelected('loose-papers'), 'empty');
  model.select(0);
  unchanged(model, () => model.consumeSelected('paper', 4), 'insufficient');
  for (const amount of [0, -1, 1.5, NaN, Infinity, '1', Number.MAX_SAFE_INTEGER + 1]) {
    unchanged(model, () => model.consumeSelected('paper', amount), 'invalid-amount');
  }
  unchanged(model, () => model.consumeSelected('pink-slips'), 'invalid-item');
  const rest = model.consumeSelected('loose-papers', 3);
  assert.equal(rest.item.quantity, 3); assert.equal(model.read().slots[0], null);
  assert.equal(model.read().selected, 0);
  unchanged(model, () => model.consumeSelected('paper'), 'empty');
});

test('consuming one nonstackable object clears its slot and an active torch safely', () => {
  const model = createInventory(); model.add(item('torch', 'lamp', { charge: 40 }));
  model.useSelected(); model.tick(2.5);
  unchanged(model, () => model.consumeSelected('facilities-flashlight', 2), 'insufficient');
  assert.equal(model.read().activeTorch, 'lamp');
  const handed = model.consumeSelected('facilities-flashlight');
  assert.equal(handed.item.type, 'torch'); assert.equal(handed.item.charge, 37.5);
  assert.equal(model.read().slots[0], null); assert.equal(model.read().activeTorch, null);
  assert.equal(model.tick(1).changed, false);
  model.add(item('scissors', 'tool'));
  assert.equal(model.consumeSelected('scissors').item.id, 'tool');
  assert.equal(model.read().slots[0], null);
});

test('red balloons use one slot each and have no invented use action', () => {
  const model = createInventory();
  model.add(makeItem('red-balloon', 'first-balloon')); model.add(item('balloon', 'second-balloon'));
  assert.equal(model.read().slots.filter(Boolean).length, 2);
  assert.equal(ITEM_DEFS.balloon.name, 'Red balloon');
  assert.equal(Object.hasOwn(ITEM_DEFS.balloon, 'maxStack'), false);
  unchanged(model, () => model.useSelected(), 'no-use');
  unchanged(model, () => model.combine(0, 1), 'incompatible');
  unchanged(model, () => model.consumeSelected('red-balloon', 2), 'insufficient');
  const dropped = model.remove('first-balloon');
  assert.deepEqual(dropped, { id: 'first-balloon', type: 'balloon' });
  assert.equal(model.add(dropped).ok, true);
  assert.equal(model.consumeSelected('red-balloon').item.id, 'first-balloon');
  assert.equal(model.read().slots[1].id, 'second-balloon');
});

test('scissors carry three snips, never waste durability on empty air, and snap on the third landed hit', () => {
  for (const uses of [-1, 4, 1.5, NaN, Infinity, '2', null]) {
    assert.throws(() => makeItem('scissors', 'bad', { uses }), RangeError);
  }
  const model = createInventory();
  model.add(item('scissors', 'warden-blades'));
  assert.equal(model.read().slots[0].uses, 3);

  // Swinging in thin air or without a target callback never costs a snip
  unchanged(model, () => model.useSelected(), 'no-snip-target');
  unchanged(model, () => model.useSelected({ snip: () => ({ ok: false }) }), 'no-snip-target');
  unchanged(model, () => model.useSelected({ snip: () => ({ ok: false, reason: 'blocked-by-wall' }) }), 'blocked-by-wall');
  unchanged(model, () => model.useSelected({ snip: () => ({ ok: 'yes' }) }), 'no-snip-target');

  // Snip 1: 3 -> 2 uses
  const first = model.useSelected({ snip: (held) => { assert.equal(held.uses, 3); held.uses = 0; return { ok: true, target: 'toner' }; } });
  assert.deepEqual(first, { ok: true, action: 'snip', snapped: false, target: 'toner', item: { id: 'warden-blades', type: 'scissors', uses: 2 }, index: 0 });
  assert.equal(model.read().slots[0].uses, 2);

  // Drop and re-pick preserves remaining uses
  const dropped = model.remove('warden-blades');
  assert.deepEqual(dropped, { id: 'warden-blades', type: 'scissors', uses: 2 });
  assert.equal(model.add(dropped).ok, true);

  // Snip 2: 2 -> 1 use
  const second = model.useSelected({ snip: () => ({ ok: true, target: 'toner-puddle' }) });
  assert.equal(second.snapped, false);
  assert.equal(second.item.uses, 1);
  assert.equal(model.read().slots[0].uses, 1);

  // Snip 3: 1 -> 0 uses -> blades snap and clear the slot
  const third = model.useSelected({ snip: () => ({ ok: true, target: 'pirate' }) });
  assert.deepEqual(third, { ok: true, action: 'snip', snapped: true, target: 'pirate', item: { id: 'warden-blades', type: 'scissors', uses: 0 }, index: 0 });
  assert.equal(model.read().slots[0], null);
  unchanged(model, () => model.useSelected({ snip: () => ({ ok: true }) }), 'empty');
});
