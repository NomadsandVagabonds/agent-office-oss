// Dispatch pays for being found: a rare thing by the crate, and a way out beside the floor's way down. (pure rule)
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchFind, besideWayDown, orderTargets, FIND_TYPES } from '../public/world/backrooms/rooms/dispatch/find.rule.js';
import { makeRng } from '../public/world/backrooms/gen.js';
import { SUPPLY } from '../public/world/backrooms/supplies.js';

test('the find is scissors or a torch, by the seed, and the same every time', () => {
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const a = dispatchFind(makeRng('s' + i).fork('dispatch-find')), b = dispatchFind(makeRng('s' + i).fork('dispatch-find'));
    assert.deepEqual(a, b);
    assert.ok(FIND_TYPES.includes(a.type)); seen.add(a.type);
    if (a.type === 'torch') assert.ok(a.charge >= SUPPLY.torchCharge[0] && a.charge <= SUPPLY.torchCharge[1]); else assert.equal(a.charge, undefined);
  }
  assert.deepEqual([...seen].sort(), ['scissors', 'torch']);
});

test('the rooms beside the way down are the ones a doorway joins to the fire exit', () => {
  const level = { exit: { room: 7 }, links: [{ a: 1, b: 2 }, { a: 6, b: 7 }, { a: 7, b: 9 }, { a: 6, b: 7 }, { a: 3, b: 4 }] };
  assert.deepEqual(besideWayDown(level), [6, 9]);
  assert.deepEqual(besideWayDown({ links: [] }), []);
  assert.deepEqual(besideWayDown(null), []);
});

test('candidates beside the way down come first, each side keeping its own order', () => {
  const rooms = [{ id: 4 }, { id: 6 }, { id: 2 }, { id: 9 }, { id: 5 }];
  assert.deepEqual(orderTargets(rooms, [6, 9]).map((r) => r.id), [6, 9, 4, 2, 5]);
  assert.deepEqual(orderTargets(rooms, []).map((r) => r.id), [4, 6, 2, 9, 5]);
});
