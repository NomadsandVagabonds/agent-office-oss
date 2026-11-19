// Dev only (?debug): the tape's number and a bug report in the pause menu, and nothing hurts or runs down when asked.
// The owner, 19 Nov: "a dev only mode … pausing timer and invincible mode for testing", and the tape number not shown
// to everybody, since a number shown is a building anyone can walk again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSurvival } from '../public/world/backrooms/survival.js';

const quiet = { hud: { battery() {}, glitch() {} }, sound: { play() {} }, interfere() {}, red() {} };

test('dev god mode: nothing hurts and the battery does not run down; the clock can be stopped on its own', () => {
  const dev = { god: false, stopClock: false };
  const s = createSurvival(quiet, { canAct: () => true, onEnd() {}, difficulty: () => 'normal', dev });
  const hearts = s.health.read().current;
  dev.god = true;
  assert.equal(s.health.damage(1).ok, false); assert.equal(s.health.read().current, hearts);
  assert.equal(s.camera.drain(0.5).ok, false);
  dev.god = false; dev.stopClock = true;
  const before = s.camera.read().remaining; s.update(30, true);
  assert.equal(s.camera.read().remaining, before, 'the clock ran with it stopped');
  dev.stopClock = false; s.update(30, true);
  assert.ok(s.camera.read().remaining < before);
  assert.equal(s.health.damage(1).ok, true);
});

test('without dev (every visit that is not ?debug) nothing changes, and the menu offers no tape number', () => {
  const s = createSurvival(quiet, { canAct: () => true, onEnd() {}, difficulty: () => 'normal' });
  assert.equal(s.health.damage(1).ok, true);
  const index = readFileSync(new URL('../public/world/backrooms/index.js', import.meta.url), 'utf8');
  assert.match(index, /\.\.\.\(opt\.debug \? \{ tape: /, 'the tape number is handed to the menu only under ?debug');
  assert.match(index, /dev: opt\.debug \? devState : null/);
});
