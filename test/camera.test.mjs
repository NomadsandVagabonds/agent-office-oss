import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_TUNING, createCameraBattery } from '../public/world/backrooms/camera-state.js';

const unchanged = (camera, operation, reason) => {
  const before = camera.read(), result = operation();
  assert.deepEqual(result, { ok: false, reason });
  assert.deepEqual(camera.read(), before);
};

test('camera starts at 75 percent with five minutes of recording and detached state', () => {
  const camera = createCameraBattery();
  assert.deepEqual(CAMERA_TUNING, { capacity: 400, start: 300, batterySeconds: 120 });
  assert.ok(Object.isFrozen(CAMERA_TUNING));
  assert.deepEqual(camera.read(), { remaining: 300, capacity: 400, fraction: 0.75, depleted: false, revision: 0 });
  const snapshot = camera.read(); snapshot.remaining = 0; snapshot.capacity = 1;
  assert.equal(camera.read().remaining, 300); assert.equal(camera.read().capacity, 400);
});

test('a battery adds exactly two minutes when space permits and otherwise caps at capacity', () => {
  const camera = createCameraBattery(); camera.tick(50);
  assert.deepEqual(camera.recharge(), { ok: true, added: 120, remaining: 370 });
  assert.deepEqual(camera.recharge(), { ok: true, added: 30, remaining: 400 });
  assert.equal(camera.read().fraction, 1);
  unchanged(camera, () => camera.recharge(), 'full-charge');
  camera.tick(0.5);
  assert.deepEqual(camera.recharge(0.25), { ok: true, added: 0.25, remaining: 399.75 });
});

test('recording runs out once, never goes negative, and cannot be revived after ending', () => {
  const camera = createCameraBattery();
  assert.deepEqual(camera.tick(299), { changed: true, depleted: false });
  assert.equal(camera.read().remaining, 1);
  assert.deepEqual(camera.tick(10), { changed: true, depleted: true });
  assert.equal(camera.read().remaining, 0); assert.equal(camera.read().fraction, 0);
  const ended = camera.read();
  assert.deepEqual(camera.tick(10), { changed: false, depleted: false });
  assert.deepEqual(camera.read(), ended);
  unchanged(camera, () => camera.recharge(), 'depleted');
  assert.equal(createCameraBattery().read().remaining, 300);
});

test('no wall clock passes while reads or invalid frame deltas are supplied', () => {
  const camera = createCameraBattery(), before = camera.read();
  for (let n = 0; n < 20; n++) assert.deepEqual(camera.read(), before);
  for (const dt of [0, -1, NaN, Infinity, -Infinity, '1', null, undefined]) {
    assert.deepEqual(camera.tick(dt), { changed: false, depleted: false });
    assert.deepEqual(camera.read(), before);
  }
  camera.tick(2.5);
  assert.equal(camera.read().remaining, 297.5);
});

test('invalid recharge amounts neither add charge nor advance revision', () => {
  const camera = createCameraBattery();
  for (const seconds of [0, -1, NaN, Infinity, -Infinity, '120', null, true]) {
    unchanged(camera, () => camera.recharge(seconds), 'invalid-amount');
  }
});
