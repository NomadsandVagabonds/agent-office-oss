import test from 'node:test';
import assert from 'node:assert/strict';
import { SMALLS, binVox, trolleyVox } from '../public/world/backrooms/smalls.model.js';

// What the office's own measure, in its full-size voxels (read off the mesher): props/kitchen.js bin, props/trolley.js trolley.
const OFFICE = { bin: { x0: -10, y0: 0, z0: -10, x1: 10, y1: 23, z1: 10 }, trolley: { x0: -15, y0: 1, z0: -10, x1: 15, y1: 38, z1: 10 } };

test('the level\'s bin and trolley are exactly the size of the office\'s, so their colliders do not move', () => {
  const k = 1 / SMALLS.scale;
  for (const [name, make] of [['bin', binVox], ['trolley', trolleyVox]]) {
    const b = make().bounds();
    for (const key of Object.keys(OFFICE[name])) { assert.equal(b[key], OFFICE[name][key] * k, `${name} ${key}`); assert.equal(SMALLS.bounds[name][key], OFFICE[name][key] * k, `${name} ${key}`); }
  }
});
