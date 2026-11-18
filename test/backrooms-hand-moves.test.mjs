// The hand's two moves that are not a shove (hand-moves.rule.js): a wipe across the lens, a swat to one side.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVES, wipePose, swatPose, swatSide } from '../public/world/backrooms/hand-moves.rule.js';

const path = (f, len) => Array.from({ length: 50 }, (_, i) => f((i / 50) * len)).filter(Boolean);

test('a wipe comes up into the picture close to the lens, goes across it right to left, and leaves', () => {
  const p = path(wipePose, MOVES.wipe);
  assert.ok(p[0].y < -0.3, 'from below the frame');
  assert.ok(p.some((q) => q.y > -0.1 && q.z > -0.3), 'up close in front of the lens');
  assert.ok(p[0].x > 0.15 && p.at(-1).x < -0.25, 'right to left');
  assert.ok(p.every((q) => q.side === 1));
  assert.equal(wipePose(MOVES.wipe), null);
});

test('a swat goes out to its own side, the hand on that side, and is quick', () => {
  for (const dir of [-1, 1, { x: -2 }, { x: 3 }]) {
    const s = swatSide(dir), p = path((t) => swatPose(t, dir), MOVES.swat);
    assert.ok(p.every((q) => q.side === s));
    assert.ok(Math.max(...p.map((q) => q.x * s)) > 0.35, 'flung out to that side');
  }
  assert.ok(MOVES.swat < MOVES.wipe);
  assert.equal(swatPose(MOVES.swat, 1), null);
});

test('nothing random: the same moment is the same pose', () => {
  assert.deepEqual(wipePose(0.2), wipePose(0.2));
  assert.deepEqual(swatPose(0.1, -1), swatPose(0.1, -1));
});
