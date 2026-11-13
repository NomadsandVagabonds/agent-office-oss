// The voxel toolkit's pure parts (the browser loads the same file).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vox, M, isGlow, glow } from '../public/world/vox/vox.js';

test('boxes are min-inclusive, max-exclusive', () => {
  const v = new Vox().box(0, 0, 0, 4, 2, 4, '#336699');
  assert.equal(v.size, 32);
  assert.deepEqual(v.bounds(), { x0: 0, y0: 0, z0: 0, x1: 4, y1: 2, z1: 4 });
  assert.ok(v.has(3, 1, 3) && !v.has(4, 0, 0));
});

test('a coarser copy keeps the shape, thin parts and the commonest colour', () => {
  const v = new Vox();
  const wood = M('#9a6a3c', 2), steel = M('#8a8f96', 0);
  v.box(-16, 24, -8, 16, 26, 8, wood);                      // a table top…
  for (const [x, z] of [[-15, -7], [13, -7], [-15, 5], [13, 5]]) v.box(x, 0, z, x + 2, 24, z + 2, steel);   // …on thin legs
  v.set(0, 26, 0, glow('#ffe2a8'));

  const half = v.downsample(2);
  const b = half.bounds();
  assert.deepEqual([b.x0, b.x1, b.y0, b.y1], [-8, 8, 0, 14], 'half the size in every direction');
  assert.ok(half.size < v.size / 4);
  assert.ok(half.has(-8, 5, -4) || half.has(-7, 5, -4), 'legs two voxels thick survive');
  assert.equal(half.get(0, 12, 0), wood, 'the top is still wood');

  const quarter = v.downsample(4);
  assert.ok(quarter.size > 0 && quarter.size < half.size);
  assert.ok([...Array(6).keys()].some((y) => quarter.has(-4, y, -2) || quarter.has(3, y, 1)), 'and survive again at a quarter');
  assert.ok(!isGlow(quarter.get(0, 6, 0)), 'one lit voxel does not light up a whole block');
});

test('turning a model a quarter turn four times gives it back', () => {
  const v = new Vox().box(0, 0, 0, 3, 1, 1, '#ff0000').box(0, 0, 1, 1, 1, 3, '#00ff00');
  const round = v.turned(1).turned(1).turned(1).turned(1);
  assert.equal(round.size, v.size);
  v.each((x, y, z, c) => assert.equal(round.get(x, y, z), c));
});
