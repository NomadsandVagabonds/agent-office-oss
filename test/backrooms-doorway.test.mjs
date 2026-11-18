// Nobody keeps a doorway (cast/doorway.rule.js). The owner: "No creatures should block a doorway/crawlspace etc forever.
// After a timeout they should wander elsewhere."
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOORWAY, at, fresh, camps, elsewhere } from '../public/world/backrooms/cast/doorway.rule.js';
import { makeRng } from '../public/world/backrooms/gen.js';

const dt = 1 / 30, door = { x: 0, z: 0 }, other = { x: 6, z: 0 };

test('in a doorway, a crawl\'s mouth or the way down — and not a step outside one', () => {
  assert.equal(at({ x: 0.5, z: 0.3 }, [door, other]), door);
  assert.equal(at({ x: DOORWAY.near + 0.1, z: 0 }, [door]), null);
  assert.equal(at({ x: 5.6, z: 0 }, [door, other]), other, 'the nearer of two');
  assert.equal(at({ x: 30, z: 30 }, [], true).down, true, 'anywhere in the way down');
  assert.equal(at(null, [door]), null);
});

test('how long it keeps one is the floor\'s dice, within its range, and drawn again for every doorway', () => {
  const R = makeRng('doorway-test'), limits = new Set();
  for (let n = 0; n < 40; n++) { const s = fresh(R); assert.ok(s.limit >= DOORWAY.keeps[0] && s.limit <= DOORWAY.keeps[1]); limits.add(s.limit.toFixed(3)); }
  assert.ok(limits.size > 30, 'not one number a visitor could learn');
  // the same floor draws the same: same seed, same doorways kept as long
  const a = makeRng('same'), b = makeRng('same'); assert.equal(fresh(a).limit, fresh(b).limit);
  // a creature may have its own range
  assert.ok(fresh(R, [1, 2]).limit <= 2);
});

test('it has to be there the whole time: out of it, or into another, and the count starts again', () => {
  const R = makeRng('t'); let s = fresh(R), dueAt = null;
  for (let t = 0; t < 20 && dueAt === null; t += dt) { s = camps(s, dt, door, R); if (s.due) dueAt = t; }
  assert.ok(dueAt !== null && dueAt >= DOORWAY.keeps[0] - 0.05 && dueAt <= DOORWAY.keeps[1] + 0.05, `due after ${dueAt}`);
  s = camps(fresh(R), 3, door, R); s = camps(s, dt, null, R); assert.equal(s.t, 0); assert.equal(s.due, false);
  s = camps(fresh(R), 3, door, R); s = camps(s, dt, other, R); assert.ok(s.t < 0.1, 'another doorway is another count');
});

test('elsewhere: a room or two away, not near it, and not where it can be seen from', () => {
  const R = makeRng('e');
  const spots = [{ x: 1, z: 0, rooms: 1, sees: false }, { x: 5, z: 5, rooms: 0, sees: false }, { x: 5, z: 5, rooms: 1, sees: true }, { x: 9, z: 1, rooms: 3, sees: false }, { x: 4, z: 6, rooms: 2, sees: false }];
  for (let n = 0; n < 20; n++) assert.deepEqual(elsewhere(door, spots, R), spots[4]);
  assert.equal(elsewhere(door, spots.slice(0, 4), R), null, 'nowhere will do');
  assert.ok(elsewhere({ down: true }, [{ x: 0.2, z: 0, rooms: 1, sees: false }], R), 'out of the way down, anywhere a room off');
});

test('the mascot lying at a crawl hole: furniture meets the whole of it, the visitor only its feet end — the mouth is never sealed', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../public/world/backrooms/cast/pirate.js', import.meta.url), 'utf8'), world = readFileSync(new URL('../public/world/backrooms/world.js', import.meta.url), 'utf8');
  assert.match(src, /p\.body\.r = BODY \+ Math\.hypot\(p\.down\.head\.x - p\.down\.feet\.x, p\.down\.head\.z - p\.down\.feet\.z\) \/ 2; p\.body\.airborne = true;/);
  assert.match(src, /p\.feetBody\.x = p\.down\.feet\.x \+ \(p\.down\.head\.x - p\.down\.feet\.x\) \* DOWN_BODY;/);
  assert.match(src, /p\.body\.airborne = false; if \(p\.feetBody\) p\.feetBody\.on = false;/, 'up again, it is one body again');
  // (an airborne body is met by furniture's box and not by the visitor's circle: world.js)
  assert.match(world, /&& \(!b\.airborne \|\| box\)/);
  const k = Number(/DOWN_BODY = ([\d.]+)/.exec(src)[1]); assert.ok(1.26 - (1.26 - 0.38) * k - 0.3 > 0.6, 'its feet body stops well short of the hole');
});
