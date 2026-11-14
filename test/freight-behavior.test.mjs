import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreightBehavior, makeFreightNavigator } from '../public/world/backrooms/freight-behavior.js';

test('a visitor interrupts the embrace, attention expires and packing resumes without leaving', () => {
  const b = createFreightBehavior();
  assert.equal(b.read().phase, 'embrace');
  assert.equal(b.notice().phase, 'startled');
  assert.equal(b.advance(6).phase, 'follow');
  assert.equal(b.advance(9).phase, 'return');
  assert.equal(b.advance(7).phase, 'pickup');
  assert.equal(b.read().attention, 0);
  assert.equal(b.advance(6).carrying, true);
  assert.equal(b.advance(8).carrying, true);
  assert.equal(b.advance(1).carrying, false);
  assert.equal(b.advance(9).phase, 'embrace');
});

test('ending freezes choreography and departure cancels attention', () => {
  const b = createFreightBehavior(); b.notice(); b.advance(7);
  const before = b.read();
  assert.deepEqual(b.advance(100, { frozen: true }), before);
  assert.equal(b.leave().attention, 0);
  assert.equal(b.read().phase, 'return');
  assert.equal(b.notice().phase, 'startled');
});

test('a packing job waits for the worker to reach the station', () => {
  const b = createFreightBehavior(); b.notice(); b.advance(22);
  assert.equal(b.advance(60, { arrived: false }).phase, 'pickup');
  assert.equal(b.read().carrying, false);
  assert.equal(b.advance(6).phase, 'carry');
  assert.equal(b.advance(60, { arrived: false }).carrying, true);
  assert.equal(b.read().phase, 'carry');
});

test('crate navigation uses the aisle and cannot cross a closed wall to reach a target', () => {
  const free = (x, z) => Math.abs(x) < 3.7 && Math.abs(z) < 3.7 && !(Math.abs(x) < 0.4 && z < 2.2);
  const nav = makeFreightNavigator({ W: 8, D: 8, free });
  const path = nav.path({ x: -2, z: -2 }, { x: 2, z: -2 });
  assert.ok(path.length > 20);
  assert.ok(path.some(p => p.z > 2.2));
  assert.ok(path.every(p => free(p.x, p.z)));
  const closed = makeFreightNavigator({ W: 8, D: 8, free: (x, z) => free(x, z) && Math.abs(x) > 0.4 });
  assert.ok(closed.path({ x: -2, z: -2 }, { x: 2, z: -2 }).every(p => p.x < 0));
});
