// The lawn flamingo in the hand (hand-flamingo.rule.js): a stab draws back, drives forward and down; gone in, the hand lets
// go and drops away without it; missed, it is held out and comes back to where it was. Nothing random.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAB, stabPose, stabLength } from '../public/world/backrooms/hand-flamingo.rule.js';

test('drawn back, then driven forward and down', () => {
  const back = stabPose(STAB.draw * 0.99, null), out = stabPose(STAB.draw + STAB.drive * 0.99, null);
  assert.ok(back.z > 0.05, 'back toward the lens'); assert.ok(out.z < -0.25 && out.y < 0, 'forward and down');
  assert.ok(out.pitch > back.pitch, 'the stakes tip down as it goes');
  assert.ok(back.bird && out.bird);
});

test('went in: the hand lets go, opens and drops out of the picture; the bird is not in it', () => {
  const k = STAB.draw + STAB.drive, p = stabPose(k + STAB.release * 0.5, true), q = stabPose(k + STAB.release * 0.99, true);
  assert.equal(p.bird, false); assert.ok(p.open > 0.5);
  assert.ok(q.y < -0.25 && q.gone);
  assert.equal(stabPose(stabLength(true), true), null, 'and it is over');
});

test('missed: held out, and back to rest; the same moment is the same pose', () => {
  const end = stabLength(false), r = stabPose(end * 0.999, false);
  assert.ok(Math.abs(r.z) < 0.01 && r.bird);
  assert.equal(stabPose(end, false), null);
  assert.equal(stabPose(-1, false), null);
  assert.deepEqual(stabPose(0.15, true), stabPose(0.15, true));
});
