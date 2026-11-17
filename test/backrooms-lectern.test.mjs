import test from 'node:test';
import assert from 'node:assert/strict';
import { LECTERN, lecternVox } from '../public/world/backrooms/rooms/all-hands/lectern.model.js';

// What the five boxes it replaced measured, in their full-size voxels (read off the mesher before they went).
const OLD = { x0: -11, y0: 0, z0: -8, x1: 11, y1: 46, z1: 8 };
// The cells of the old microphone's head: x −1…0, y 44…45, z −4…−3.
const OLD_HEAD = { x0: -1, y0: 44, z0: -4, x1: 1, y1: 46, z1: -2 };

test('the lectern is exactly the size of the one it replaced, so its collider has not moved', () => {
  const k = 1 / LECTERN.scale, b = lecternVox().bounds();
  for (const key of Object.keys(OLD)) { assert.equal(b[key], OLD[key] * k, key); assert.equal(LECTERN.bounds[key], OLD[key] * k, key); }
});

test('the microphone\'s head is where the old one\'s was: the room lights that spot', () => {
  const k = 1 / LECTERN.scale, v = lecternVox(), m = LECTERN.mic;
  for (const key of Object.keys(OLD_HEAD)) assert.equal(m[key], OLD_HEAD[key] * k, key);
  let inside = 0;
  for (let x = m.x0; x < m.x1; x++) for (let y = m.y0; y < m.y1; y++) for (let z = m.z0; z < m.z1; z++) if (v.has(x, y, z)) inside++;
  assert.ok(inside >= 48, `the head fills its place (${inside} of 64)`);
  // and nothing of it is higher, or further toward the reader, than the old one reached
  const b = v.bounds();
  assert.equal(b.y1, m.y1);
  for (let x = b.x0; x < b.x1; x++) for (let y = 74; y < b.y1; y++) for (let z = b.z0; z < m.z0; z++) assert.equal(v.has(x, y, z), false);
});
