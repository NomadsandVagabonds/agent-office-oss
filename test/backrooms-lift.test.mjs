// The lift lobby's button (rooms3.js lift): a press mostly opens on what the lobby always had behind its doors, and now and
// then on a real car; a car is empty, or has something on its floor, or has something in it only where the cast can put it,
// and never on Tourist. The draw is seeded, one per press, and does not touch the room's own stream.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../public/world/backrooms/gen.js';
import { LIFT_ODDS, liftPress } from '../public/world/backrooms/rooms/lift/rule.js';

const P = { behind: ['bricks', 'bricks', 'cutout', 'poster', 'bricks'] };
const sample = (n, opt, seed = 'lift-test') => { const R = makeRng(seed); return Array.from({ length: n }, (_, i) => liftPress(R, P, i, opt)); };

test('the same room, the same press, the same answer', () => {
  assert.deepEqual(sample(40, { creatures: true }), sample(40, { creatures: true }));
  assert.notDeepEqual(sample(40, { creatures: true }, 'a'), sample(40, { creatures: true }, 'b'));
});

test('a press that is not a car is what the lobby always had', () => {
  for (const r of sample(300, {})) if (r.kind !== 'car') assert.ok(P.behind.includes(r.kind), r.kind);
});

test('over many presses the odds are about what they say', () => {
  const rows = sample(4000, { creatures: true }), cars = rows.filter((r) => r.kind === 'car');
  const share = (list, f) => list.filter(f).length / list.length;
  assert.ok(Math.abs(share(rows, (r) => r.kind === 'car') - LIFT_ODDS.car) < 0.04, 'cars');
  assert.ok(Math.abs(share(cars, (r) => r.inside === 'empty') - LIFT_ODDS.empty) < 0.05, 'empty cars');
  assert.ok(Math.abs(share(cars, (r) => r.inside === 'item') - LIFT_ODDS.item) < 0.05, 'cars with something in them');
  assert.ok(Math.abs(share(cars, (r) => r.inside === 'creature') - LIFT_ODDS.creature) < 0.05, 'cars with a creature');
});

test('nobody is put in a car where the cast cannot put them, or for a tourist', () => {
  assert.ok(sample(1000, { creatures: false }).every((r) => r.inside !== 'creature'), 'no cast hook: no creature');
  assert.ok(sample(1000, { creatures: true, tourist: true }).every((r) => r.inside !== 'creature'), 'a tourist is not given one');
  assert.ok(sample(1000, { creatures: true }).some((r) => r.inside === 'creature'), 'and with the hook there are some');
});

test('what lies on a car floor is one of three things, and a creature is one of two', () => {
  const rows = sample(3000, { creatures: true });
  assert.deepEqual([...new Set(rows.filter((r) => r.inside === 'item').map((r) => r.item))].sort(), ['battery', 'paper', 'snack']);
  assert.deepEqual([...new Set(rows.filter((r) => r.inside === 'creature').map((r) => r.who))].sort(), ['shadow', 'toner']);
});

test('the odds can be set by a room that wants none: a lift that is never a car', () => {
  assert.ok(sample(500, { odds: { ...LIFT_ODDS, car: 0 } }).every((r) => r.kind !== 'car'));
});
