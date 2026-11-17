// The lift lobby's button (rooms3.js lift): a press mostly opens on what the lobby always had behind its doors, and now and
// then on a real car; a car is empty, or has something on its floor, or has somebody in it. What the lobby has given it does
// not give again, nobody is put in a car where the cast cannot put them or for a tourist, and the same presses in the same
// building give the same cars.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../public/world/backrooms/gen.js';
import { LIFT_ODDS, LIFT_ITEMS, liftCompany, liftPress, doorwayWall } from '../public/world/backrooms/rooms/lift/rule.js';

const P = { behind: ['bricks', 'bricks', 'cutout', 'poster', 'bricks'] };
const sample = (n, opt, seed = 'lift-test') => { const R = makeRng(seed); return Array.from({ length: n }, (_, i) => liftPress(R, P, i, opt)); };
const BOTH = { who: ['toner', 'shadow'] };

test('the same room, the same press, the same answer', () => {
  assert.deepEqual(sample(40, BOTH), sample(40, BOTH));
  assert.notDeepEqual(sample(40, BOTH, 'a'), sample(40, BOTH, 'b'));
});

test('a press that is not a car is what the lobby always had', () => {
  for (const r of sample(300, {})) if (r.kind !== 'car') assert.ok(P.behind.includes(r.kind), r.kind);
});

test('the odds are 55 plain, 15 empty, 15 with something on the floor, 15 with somebody in it', () => {
  const rows = sample(6000, BOTH), share = (f) => rows.filter(f).length / rows.length;
  assert.ok(Math.abs(share((r) => r.kind !== 'car') - 0.55) < 0.025, 'plain');
  assert.ok(Math.abs(share((r) => r.inside === 'empty') - 0.15) < 0.025, 'empty');
  assert.ok(Math.abs(share((r) => r.inside === 'item') - 0.15) < 0.025, 'item');
  assert.ok(Math.abs(share((r) => r.inside === 'creature') - 0.15) < 0.025, 'creature');
});

test('what lies on a car floor is worth the wait (a snack or the scissors), and never a battery: the lift is not a way to farm the score', () => {
  const kinds = new Set(sample(4000, BOTH).filter((r) => r.inside === 'item').map((r) => r.item));
  assert.deepEqual([...kinds].sort(), [...LIFT_ITEMS].sort());
  assert.ok(!kinds.has('battery'));
});

test('what has been given is not given again: the draw falls to an empty car', () => {
  const rows = sample(2000, { item: false, who: [] });
  assert.ok(rows.every((r) => r.inside !== 'item' && r.inside !== 'creature'));
  assert.ok(rows.some((r) => r.inside === 'empty'), 'and the cars that were going to give something are empty, not plain');
  assert.ok(sample(2000, { item: true, who: [] }).some((r) => r.inside === 'item'));
  assert.ok(sample(2000, { item: false, who: ['toner'] }).some((r) => r.inside === 'creature'));
});

test('nobody is put in a car where they may not be: Tourist, Training Wheels\' toner, and a gentler share on Easy', () => {
  assert.deepEqual(liftCompany('tourist'), { who: [], scale: 0 });
  assert.deepEqual(liftCompany('training-wheels').who, ['shadow']);
  assert.ok(liftCompany('easy').scale < liftCompany('normal').scale && liftCompany('normal').scale === liftCompany('hard').scale);
  const share = (c) => sample(6000, { ...c }).filter((r) => r.inside === 'creature').length / 6000;
  assert.equal(share(liftCompany('tourist')), 0);
  assert.ok(share(liftCompany('easy')) < share(liftCompany('normal')) * 0.7, 'fewer on Easy');
  assert.ok(sample(3000, liftCompany('training-wheels')).filter((r) => r.inside === 'creature').every((r) => r.who === 'shadow'));
});

test('a creature is one of the two that the cast can put there', () => {
  assert.deepEqual([...new Set(sample(4000, BOTH).filter((r) => r.inside === 'creature').map((r) => r.who))].sort(), ['shadow', 'toner']);
});

test('the odds can be set by a room that wants none: a lift that is never a car', () => {
  assert.ok(sample(500, { ...BOTH, odds: { ...LIFT_ODDS, car: 0 } }).every((r) => r.kind !== 'car'));
});

test('nothing the building hangs or leaves is ever in a lift\'s car: the coin place and every coin spot keep out of it', async () => {
  const { generate, coinSpots, STASH } = await import('../public/world/backrooms/gen.js');
  const { LIFT_CAR } = await import('../public/world/backrooms/rooms/lift/rule.js');
  let seen = 0;
  for (let i = 0; i < 60 && seen < 12; i++) {
    const level = generate(`lift-coins-${i}`, { name: 'Robin', projects: ['Webstore'], agents: ['Ivory Marten', 'Amber Vireo'], tasks: ['x'], only: 'lift' });
    for (const r of level.rooms.filter((q) => q.arch === 'lift')) {
      seen++;
      const front = -r.D / 2 + LIFT_CAR;
      for (const side of [-1, 1]) { const [, z0, , z1] = STASH.lift(r, side); assert.ok(z0 >= front && z1 <= r.D / 2, `the place for a coin is in front of the car (${z0}..${z1}, car to ${front})`); }
      assert.ok(coinSpots(r).every((s) => s.z >= front), 'and so is every spot a coin could hang at');
    }
  }
  assert.ok(seen >= 6, 'enough lifts to mean something');
});

test('the doorway is a wall while the doors are shut or part open, and with the doors open only where there is a car', () => {
  for (const kind of ['car', 'bricks', 'cutout', 'poster']) { assert.equal(doorwayWall(0, kind), true); assert.equal(doorwayWall(0.5, kind), true); }
  assert.equal(doorwayWall(1, 'car'), false, 'open on a car: walk in');
  for (const kind of ['bricks', 'cutout', 'poster']) assert.equal(doorwayWall(1, kind), true, kind + ': a wall however far the doors are open');
});
