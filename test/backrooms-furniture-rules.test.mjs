import test from 'node:test';
import assert from 'node:assert/strict';
import { furnitureClear } from '../public/world/backrooms/furniture-rules.js';
import { createAbsorbedState, stepAbsorbed } from '../public/world/backrooms/absorbed/rule.js';

test('physical contact is blocked by a low or very thin barricade even when it can be seen over', () => {
  const world = { furnitureColliders: [{ x0: 0, x1: .001, z0: -1, z1: 1, tall: false, on: true }] };
  assert.equal(furnitureClear(world, -.4, 0, .4, 0), false);
  assert.equal(furnitureClear(world, .4, 0, -.4, 0), false);
  assert.equal(furnitureClear(world, -.4, 2, .4, 2), true);
  world.furnitureColliders[0].on = false;
  assert.equal(furnitureClear(world, -.4, 0, .4, 0), true, 'a room that took its furniture away cannot leave invisible attacks blocked');
});

test('contact sweep respects body radius, rounded corners, endpoints, and movement away from an edge', () => {
  const world = { furnitureColliders: [{ x0: 1, x1: 2, z0: 1, z1: 2 }] };
  assert.equal(furnitureClear(world, 0, .9, 3, .9, .2), false);
  assert.equal(furnitureClear(world, 0, .79, 3, .79, .2), true);
  assert.equal(furnitureClear(world, 0, .81, .82, .81, .2), true, 'diagonal gap outside a rounded corner remains open');
  assert.equal(furnitureClear(world, 1.5, 1.5, 1.5, 1.5), false, 'contact inside the obstacle is not clear');
  assert.equal(furnitureClear(world, 0, 1.5, 1.5, 1.5), false);
  assert.equal(furnitureClear(world, 1, 1.5, 0, 1.5), true);
});

test('contact uses the live moved bounds and fails closed for malformed attack coordinates', () => {
  const barrier = { x0: 0, x1: .2, z0: -1, z1: 1 }, world = { furnitureColliders: [barrier] };
  assert.equal(furnitureClear(world, -1, 0, 1, 0), false);
  barrier.z0 += 3; barrier.z1 += 3;
  assert.equal(furnitureClear(world, -1, 0, 1, 0), true);
  assert.equal(furnitureClear(world, NaN, 0, 1, 0), false);
  assert.equal(furnitureClear(world, 0, 0, Infinity, 0), false);
  assert.equal(furnitureClear(world, 0, 0, 1, 0, -1), false);
  assert.equal(furnitureClear({}, 0, 0, 1, 0), true, 'flag-off worlds have no extra obstruction');
});

test('swept flight and shadow permissions preserve physical contact for everyone else', () => {
  const world = { furnitureColliders: [{ x0: 0, x1: .1, z0: -1, z1: 1, top: 1 }] };
  assert.equal(furnitureClear(world, -1, 0, 1, 0, .2), false);
  assert.equal(furnitureClear(world, -1, 0, 1, 0, .2, { furniture: 'phase' }), true);
  assert.equal(furnitureClear(world, -1, 0, 1, 0, .2, { furnitureY: 1.1 }), true);
  assert.equal(furnitureClear(world, -1, 0, 1, 0, .2, { furnitureY: .9 }), false);
  assert.equal(furnitureClear(world, -1, 0, 1, 0, .2), false, 'queries never disable the obstacle itself');
});

test('absorbed staff cannot start or sustain a grab through a newly placed barricade', () => {
  for (const mount of ['wall', 'floor', 'ceiling']) {
    const input = { dt: .05, dist: .4, clearLine: true };
    const blocked = stepAbsorbed(createAbsorbedState(mount), { ...input, contactClear: false });
    assert.equal(blocked.startedGrab, false);
    const grabbed = stepAbsorbed(createAbsorbedState(mount), input);
    assert.equal(grabbed.startedGrab, true);
    const released = stepAbsorbed(grabbed.state, { ...input, contactClear: false });
    assert.equal(released.releasedGrab, true);
    assert.equal(released.state.phase, 'cooldown');
  }
});
