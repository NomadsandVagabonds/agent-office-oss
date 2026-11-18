// The sticky notes (cast/sticky-notes.rule.js): off the wall when you are near, round the room, one at a time at your face,
// stuck on the lens until wiped, knocked down by a shove, finished by a jab, burnt by a fire — a nuisance that never ends a
// visit (the owner: "more annoyance and distraction than lethal threat").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOTES as N, onWall, noteStep, fallen, torn, drainOf, nextToPeel } from '../public/world/backrooms/cast/sticky-notes.rule.js';
import { CAST } from '../public/world/backrooms/cast.js';
import { healthOf } from '../public/world/backrooms/cast/health.rule.js';
import { WARNINGS } from '../public/world/backrooms/drawings.js';

const dt = 1 / 30, run = (n, secs, sense) => { for (let t = 0; t < secs - 1e-9; t += dt) n = noteStep(n, dt, sense); return n; };
const near = { d: 1, here: true, wake: true, dive: true, lens: 1.5, fire: Infinity };

test('the owner\'s count, and on the wall until you are near in its room — and only one peels at a time', () => {
  assert.deepEqual([...N.count], [4, 6]);
  assert.equal(run(onWall(), 3, { ...near, d: N.wake + 0.5 }).mode, 'wall');
  assert.equal(run(onWall(), 3, { ...near, here: false }).mode, 'wall', 'not from the next room');
  assert.equal(run(onWall(), 3, { ...near, wake: false }).mode, 'wall', 'not before its turn');
  assert.equal(noteStep(onWall(), dt, { ...near, d: 6, swarm: true }).mode, 'peel', 'once one is off, the rest follow, wherever you are in the room');
  assert.equal(noteStep(onWall(), dt, { ...near, d: 6, swarm: true, here: false }).mode, 'wall');
  let n = noteStep(onWall(), dt, near); assert.equal(n.mode, 'peel');
  n = run(n, N.peel + 0.05, { ...near, dive: false }); assert.equal(n.mode, 'flutter');
  assert.equal(nextToPeel([{ mode: 'flutter' }, { mode: 'wall' }, { mode: 'wall' }]), 1);
  assert.equal(nextToPeel([{ mode: 'flutter' }, { mode: 'wall' }, { mode: 'wall' }], [0.5, 3, 1.2]), 2, 'the nearest of those on the wall');
  assert.equal(nextToPeel([{ mode: 'flutter' }]), -1);
});

test('they go round; one comes at your face only when you are close and nobody else is; it sticks, or gives up', () => {
  let n = { ...onWall(), mode: 'flutter' };
  assert.equal(run(n, 2, { ...near, d: N.dives + 0.4 }).mode, 'flutter', 'not from across the room');
  assert.equal(run(n, 2, { ...near, dive: false }).mode, 'flutter', 'never two at once');
  n = noteStep(n, dt, near); assert.equal(n.mode, 'dive'); assert.equal(n.dove, true);
  const missed = run(n, N.diveFor + 0.1, { ...near, lens: 1, dive: false }); assert.equal(missed.mode, 'flutter', 'it gives up');
  const hit = noteStep(n, dt, { ...near, lens: N.sticks - 0.05, stuckFor: 20 }); assert.equal(hit.mode, 'lens'); assert.equal(hit.stuck, true); assert.equal(hit.times, 1);
  // stuck, it stays until wiped; left, it falls by itself in its time
  assert.equal(run(hit, 19, near).mode, 'lens'); const fell = run(hit, 21, { ...near, dive: false }); assert.equal(fell.mode, 'down');
  assert.ok(N.stuckFor[0] >= 10 && N.stuckFor[1] <= 40);
});

test('knocked or wiped it goes down and lifts again; its glue is spent after twice on the lens; a jab finishes it; fire burns it', () => {
  const down = fallen({ ...onWall(), mode: 'lens', times: 1 }); assert.equal(down.mode, 'down');
  assert.equal(run(down, N.knocked + 0.1, { ...near, dive: false }).mode, 'flutter', 'up again');
  assert.equal(fallen({ ...onWall(), mode: 'lens', times: N.glue }).mode, 'spent'); assert.equal(run({ ...onWall(), mode: 'spent' }, 30, near).mode, 'spent', 'and stays down');
  assert.equal(torn({ ...onWall(), mode: 'flutter' }).mode, 'spent');
  assert.equal(healthOf('sticky-notes'), 1, 'one jab, one note');
  const burnt = noteStep({ ...onWall(), mode: 'flutter' }, dt, { ...near, fire: N.fire - 0.1 }); assert.equal(burnt.mode, 'gone'); assert.equal(burnt.burnt, true);
  assert.equal(noteStep({ ...onWall(), mode: 'flutter' }, dt, { ...near, fire: N.fear - 0.1 }).mode, 'flutter', 'near a fire it does not dive');
});

test('stuck, a little charge: never more than its share of a floor, never the last of it — it cannot end a visit', () => {
  // three on the lens for a second: a tenth of a second of tape each
  assert.ok(Math.abs(drainOf(3, 1, 0.8, 0) - 3 * N.drain) < 1e-12);
  assert.ok(N.drain * 400 <= 0.12, 'very slow: a tenth of a second of a 400 s battery, a second, a note');
  let taken = 0, charge = 1; for (let t = 0; t < 10000; t += 1) { const k = drainOf(6, 1, charge, taken); taken += k; charge -= k; }
  assert.ok(taken <= N.most + 1e-9, `all told ${taken}`); assert.ok(charge >= 1 - N.most - 1e-9);
  assert.equal(drainOf(6, 1, N.spare, 0), 0, 'none once the charge is low'); assert.ok(drainOf(6, 1, N.spare + 0.001, 0) <= 0.001 + 1e-12, 'never below it');
  assert.equal(drainOf(0, 1, 0.9, 0), 0);
  const src = readFileSync(new URL('../public/world/backrooms/cast/sticky-notes.js', import.meta.url), 'utf8');
  assert.ok(!/c\.hurt\(|env\.end\(/.test(src), 'they never hurt and never end anything');
});

test('the hand: on the lens through env.hand.stick, off it with how it went; a shove wipes the lens if any are on it, a backhand otherwise', () => {
  const src = readFileSync(new URL('../public/world/backrooms/cast/sticky-notes.js', import.meta.url), 'utf8');
  assert.match(src, /env\.hand\?\.stick\?\.\(n\.id, \{ u: /); assert.match(src, /env\.hand\?\.unstick\?\.\(n\.id, how, dir\)/);
  assert.match(src, /shove: \(\) => \{ env\.hand\?\.wipe\?\.\(\);[^\n]*wipeAt = 0\.12;/, 'the wipe, and they come off as the hand crosses the picture');
  assert.match(src, /if \(wipeAt < 0\) env\.hand\?\.swat\?\.\(side\);/, 'the backhand, unless the lens is being wiped');
  for (const how of ["'wiped'", "'fell'"]) assert.ok(src.includes(`offLens(n, ${how})`));
});

test('its line: it hunts, keeps a room, fears fire, can be hit; a drawing warns of it', () => {
  const m = CAST.find((k) => k.id === 'sticky-notes');
  assert.ok(m && m.home === 'room' && m.room && m.fire === 'fears' && m.weight > 0 && !m.caught.hurt, 'a setback, not a hurt');
  assert.equal(WARNINGS['sticky-notes'], undefined, 'the owner, 18 Nov: no drawing of the notes; they are a hazard, not an enemy');
});
