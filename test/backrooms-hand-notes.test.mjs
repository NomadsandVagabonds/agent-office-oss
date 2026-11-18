// A sticky note stuck on the visitor's picture (hand-notes.rule.js): it settles where the cast puts it, and each way of
// taking it off moves it the way that way goes and is over in its own time — nothing random.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTE, HOWS, stuckPose, offPose, placed } from '../public/world/backrooms/hand-notes.rule.js';

const spot = { u: 0.3, v: 0.2, turn: 0.1 };

test('slapped on, it comes in large and settles flat where it was put', () => {
  assert.ok(stuckPose(0, spot).scale > 1.2);
  const s = stuckPose(1, spot);
  assert.deepEqual([s.u, s.v, s.turn, s.scale, s.curl, s.dark], [0.3, 0.2, 0.1, 1, 0, 0]);
  assert.deepEqual(placed({ u: 4, v: -9, turn: NaN }), { u: 1, v: -1, turn: 0 }, 'kept on the picture');
});

test('wiped it goes left and down with the hand; swatted, off to its side; fell, out of the bottom; burnt, it shrinks and darkens', () => {
  const end = (how, dir) => offPose(how, NOTE.off[how] * 0.98, spot, dir);
  const w = end('wiped'); assert.ok(w.u < spot.u - 0.5 && w.v < spot.v, 'left and down');
  assert.ok(end('swatted', -1).u < -1, 'knocked off to the left'); assert.ok(end('swatted', 1).u > 1, 'and to the right');
  assert.ok(end('swatted').u > 1, 'by default, off its own side (it is on the right)');
  assert.ok(end('fell').v < -1, 'out of the bottom');
  const b = end('burnt'); assert.ok(b.scale < 0.3 && b.dark > 0.9 && b.curl > 0.9);
  for (const how of HOWS) assert.equal(offPose(how, NOTE.off[how], spot), null, `${how}: over`);
});

test('a wipe takes a note off well inside the wipe, and nothing is random', () => {
  assert.ok(NOTE.off.wiped < 0.42);
  for (const how of HOWS) assert.deepEqual(offPose(how, 0.1, spot, 1), offPose(how, 0.1, spot, 1));
  assert.deepEqual(stuckPose(0.05, spot), stuckPose(0.05, spot));
});
