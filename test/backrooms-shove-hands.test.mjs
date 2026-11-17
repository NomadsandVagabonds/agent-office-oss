// A shove you can see: both hands go out in front of the lens and come back over the pulse player.js keeps; none of it while the
// scissors are held (the click is the jab), a thing is being carried, or the bag is open.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HANDS, reach, showing, handAt } from '../public/world/backrooms/shove-hands.rule.js';

test('the hands wait before the pulse, go out, and are back when it is over', () => {
  assert.equal(reach(0), 0);
  assert.ok(reach(1) < 0.05, 'at the very start they have not moved yet');
  const peak = Math.max(...Array.from({ length: 101 }, (_, i) => reach(1 - i / 100)));
  assert.ok(peak > 0.99, 'at full stretch');
  assert.ok(reach(0.001) < 0.05, 'and nearly home at the end');
});

test('quick out, slower back: the stretch is in the first half of the pulse', () => {
  let peakAt = 0, best = -1; for (let i = 0; i <= 100; i++) { const r = reach(1 - i / 100); if (r > best) { best = r; peakAt = i / 100; } }
  assert.ok(peakAt > 0.3 && peakAt < 0.5, `peaked ${peakAt} of the way through`);
  const upTo = (u) => reach(1 - u);
  for (let i = 1; i <= 42; i++) assert.ok(upTo(i / 100) >= upTo((i - 1) / 100) - 1e-9, 'out is steady');
  for (let i = 43; i <= 100; i++) assert.ok(upTo(i / 100) <= upTo((i - 1) / 100) + 1e-9, 'back is steady');
});

test('both hands: mirrored, in front of the lens at full stretch and below the frame at rest', () => {
  const l = handAt(0.58, -1), r = handAt(0.58, 1);
  assert.ok(Math.abs(l.x + r.x) < 1e-9 && l.y === r.y && l.z === r.z, 'mirrored');
  assert.ok(r.z < -0.6 && r.z > -0.7, 'out in front of the lens');
  assert.ok(r.x > 0 && r.x < 0.12, 'a little apart');
  const home = handAt(0, 1);
  assert.ok(home.y < -0.3 && home.z > -0.4, 'at rest, down and near: out of the frame');
});

test('they are shown only while a shove is going on and nothing else has the hands', () => {
  assert.equal(showing(0.5), true);
  assert.equal(showing(0), false);
  assert.equal(showing(0.5, { scissors: true }), false, 'with the scissors the click is the jab');
  assert.equal(showing(0.5, { carrying: true }), false);
  assert.equal(showing(0.5, { bag: true }), false);
  assert.equal(HANDS.pulse, 0.3, 'the pulse player.js keeps');
});
