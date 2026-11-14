import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealth } from '../public/world/backrooms/health-state.js';

const unchanged = (health, operation, reason) => {
  const before = health.read(), result = operation();
  assert.deepEqual(result, { ok: false, reason });
  assert.deepEqual(health.read(), before);
};

test('a visit starts with four health and snapshots cannot change it', () => {
  const health = createHealth();
  assert.deepEqual(health.read(), { current: 4, max: 4, dead: false, invulnerable: false, cooldown: 0, revision: 0 });
  const snapshot = health.read(); snapshot.current = 0; snapshot.max = 100;
  assert.equal(health.read().current, 4); assert.equal(health.read().max, 4);
  unchanged(health, () => health.heal(), 'full-health');
});

test('one contact costs one health and repeated contact waits for simulation time', () => {
  const health = createHealth(), hit = health.damage();
  assert.equal(hit.ok, true); assert.equal(hit.amount, 1); assert.equal(hit.dead, false);
  assert.equal(hit.health.current, 3); assert.equal(hit.health.cooldown, 1.25);
  assert.equal(hit.health.invulnerable, true);
  hit.health.current = 0; hit.health.cooldown = 0;
  unchanged(health, () => health.damage(), 'invulnerable');
  // Reads and attempted hits during a paused frame never advance the cooldown.
  const paused = health.read();
  for (let n = 0; n < 20; n++) unchanged(health, () => health.damage(), 'invulnerable');
  assert.deepEqual(health.read(), paused);
  health.tick(0.5);
  assert.equal(health.read().cooldown, 0.75);
  unchanged(health, () => health.damage(), 'invulnerable');
  health.tick(0.75);
  assert.equal(health.read().invulnerable, false);
  assert.equal(health.damage().health.current, 2);
});

test('healing clamps to four, preserves the hit cooldown and returns a detached snapshot', () => {
  const health = createHealth(); health.damage(3);
  const restored = health.heal();
  assert.equal(restored.amount, 1); assert.equal(restored.health.current, 2);
  assert.equal(restored.dead, false); assert.equal(restored.health.cooldown, 1.25);
  restored.health.current = 100;
  assert.equal(health.read().current, 2);
  const full = health.heal(100);
  assert.equal(full.amount, 2); assert.equal(full.health.current, 4);
  unchanged(health, () => health.heal(), 'full-health');
  unchanged(health, () => health.damage(), 'invulnerable');
});

test('lethal damage reports only remaining health and death cannot be healed or hit again', () => {
  const health = createHealth(); health.damage(2); health.tick(10);
  const lethal = health.damage(Number.MAX_SAFE_INTEGER);
  assert.equal(lethal.amount, 2); assert.equal(lethal.dead, true);
  assert.equal(lethal.health.current, 0); assert.equal(lethal.health.invulnerable, false);
  assert.equal(lethal.health.cooldown, 0);
  unchanged(health, () => health.heal(), 'dead');
  unchanged(health, () => health.damage(), 'dead');
  const before = health.read(); assert.deepEqual(health.tick(10), { changed: false });
  assert.deepEqual(health.read(), before);
  assert.equal(createHealth().read().current, 4);
});

test('four spaced hits reach death exactly without negative health', () => {
  const health = createHealth();
  for (let current = 3; current >= 0; current--) {
    const result = health.damage();
    assert.equal(result.health.current, current); assert.equal(result.dead, current === 0);
    health.tick(1.25);
  }
  assert.equal(health.read().current, 0);
});

test('damage and healing reject invalid point amounts without mutation', () => {
  const health = createHealth(); health.damage(); health.tick(2);
  for (const amount of [0, -1, 0.5, NaN, Infinity, -Infinity, '1', null, true, Number.MAX_SAFE_INTEGER + 1]) {
    unchanged(health, () => health.damage(amount), 'invalid-amount');
    unchanged(health, () => health.heal(amount), 'invalid-amount');
  }
});

test('only finite positive simulation deltas reduce cooldown and idle ticks do not revise state', () => {
  const health = createHealth();
  assert.deepEqual(health.tick(1), { changed: false });
  assert.equal(health.read().revision, 0);
  health.damage(); const before = health.read();
  for (const dt of [0, -1, NaN, Infinity, -Infinity, '1', null, undefined]) {
    assert.deepEqual(health.tick(dt), { changed: false });
    assert.deepEqual(health.read(), before);
  }
  assert.deepEqual(health.tick(100), { changed: true });
  assert.equal(health.read().cooldown, 0);
  const ended = health.read(); health.tick(100);
  assert.deepEqual(health.read(), ended);
});
