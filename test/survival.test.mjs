import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurvival } from '../public/world/backrooms/survival.js';

function visit(initial = 'play', difficulty = () => 'training-wheels') {
  let phase = initial, held = false;
  const endings = [], sounds = [], batteries = [], glitches = [], interference = [], red = [];
  const env = {
    inventory: { isOpen: false },
    sound: { play: (...args) => sounds.push(args) },
    hud: { battery: state => batteries.push(state), glitch: value => glitches.push(value) },
    interfere: value => interference.push(value),
    red: value => red.push(value),
  };
  const survival = createSurvival(env, {
    canAct: () => phase === 'play' && !held,
    onEnd: reason => { endings.push(reason); phase = 'ending'; },
    difficulty,
  });
  return { env, survival, endings, sounds, batteries, glitches, interference, red,
    state: () => ({ health: survival.health.read(), camera: survival.camera.read() }),
    phase: value => { phase = value; },
    hold: value => { held = value; },
  };
}

test('an open item card keeps camera time and hit cooldown running and permits another hit after grace', () => {
  const v = visit(), { survival, env } = v;
  env.inventory.isOpen = true;
  assert.equal(survival.health.damage().health.current, 3);
  survival.update(.5, true);
  assert.equal(survival.camera.read().remaining, 299.5);
  assert.equal(survival.health.read().cooldown, .75);
  assert.equal(survival.health.damage().reason, 'invulnerable');
  assert.equal(v.sounds.length, 1); assert.equal(v.glitches.length, 1);
  survival.update(.75, true);
  assert.equal(survival.camera.read().remaining, 298.75);
  assert.equal(survival.health.read().invulnerable, false);
  assert.equal(survival.health.damage().health.current, 2);
  assert.equal(env.inventory.isOpen, true);
  assert.equal(v.sounds.length, 2); assert.equal(v.interference.length, 2);
  assert.deepEqual(v.endings, []);
});

test('only a landed hit flashes red, including a lethal hit', () => {
  let mode = 'training-wheels';
  const v = visit('play', () => mode), { survival } = v;
  survival.health.damage(0); assert.deepEqual(v.red, []);
  survival.health.damage(1); assert.deepEqual(v.red, [.48]);
  survival.health.damage(1); assert.equal(v.red.length, 1, 'cooldown blocks the flash too');
  survival.update(2, true);
  mode = 'tourist'; survival.health.damage(1); assert.equal(v.red.length, 1);
  mode = 'training-wheels'; v.hold(true); survival.health.damage(1); assert.equal(v.red.length, 1);
  v.hold(false); survival.health.heal(); assert.equal(v.red.length, 1);
  survival.health.damage(4); assert.deepEqual(v.red, [.48, .48]);
  assert.deepEqual(v.endings, ['caught']);
  const flat = visit(); flat.survival.update(300, true); assert.deepEqual(flat.red, [], 'battery expiry is not a hit');
});

test('healing and camera recharge remain usable from an open item card', () => {
  const v = visit(), { survival, env } = v;
  env.inventory.isOpen = true;
  survival.health.damage(2); survival.update(100, true);
  assert.equal(survival.health.heal().health.current, 3);
  assert.equal(survival.health.heal().health.current, 4);
  assert.equal(survival.health.heal().reason, 'full-health');
  assert.deepEqual(survival.camera.recharge(), { ok: true, added: 120, remaining: 320 });
  assert.deepEqual(survival.camera.recharge(), { ok: true, added: 80, remaining: 400 });
  assert.equal(survival.camera.recharge().reason, 'full-charge');
  assert.equal(v.batteries.at(-1).remaining, 400);
  assert.equal(env.inventory.isOpen, true);
});

test('nonrunning transition frames block actions and leave both clocks alone', () => {
  const v = visit('loading'), { survival } = v;
  for (const phase of ['loading', 'falling', 'held', 'through', 'ending', 'done']) {
    v.phase(phase);
    const before = v.state();
    assert.equal(survival.health.damage().reason, 'unavailable');
    assert.equal(survival.health.heal().reason, 'unavailable');
    assert.equal(survival.camera.recharge().reason, 'unavailable');
    survival.update(500, false);
    assert.deepEqual(v.state(), before);
  }
  assert.deepEqual(v.endings, []); assert.deepEqual(v.sounds, []);
});

test('the conductor chooses running frames and disposal blocks every later action', () => {
  const v = visit(), { survival } = v;
  survival.health.damage(); const before = v.state();
  survival.update(100, false);
  assert.deepEqual(v.state(), before);
  survival.update(.5, true);
  assert.equal(survival.health.read().cooldown, .75);
  assert.equal(survival.camera.read().remaining, 299.5);
  const disposed = v.state(), batteryUpdates = v.batteries.length;
  survival.dispose(); survival.dispose(); survival.update(500, true);
  assert.equal(survival.health.damage().reason, 'unavailable');
  assert.equal(survival.health.heal().reason, 'unavailable');
  assert.equal(survival.camera.recharge().reason, 'unavailable');
  assert.deepEqual(v.state(), disposed); assert.equal(v.batteries.length, batteryUpdates);
  assert.deepEqual(v.endings, []);
});

test('falling between floors keeps recording and grace running while actions are blocked', () => {
  const v = visit(), { survival } = v;
  survival.health.damage(); survival.update(.25, true);
  v.phase('drop');
  for (const operation of [survival.health.damage, survival.health.heal, survival.camera.recharge]) {
    assert.equal(operation().reason, 'unavailable');
  }
  survival.update(.5, true);
  assert.equal(survival.camera.read().remaining, 299.25);
  assert.equal(survival.health.read().current, 3);
  assert.equal(survival.health.read().cooldown, .5);
  // A floor that is still building adds no time; landing does not replace
  // either visit model or reset the remaining grace period.
  v.phase('held'); survival.update(500, false);
  assert.equal(survival.camera.read().remaining, 299.25);
  v.phase('play');
  assert.equal(survival.health.damage().reason, 'invulnerable');
  survival.update(.5, true);
  assert.equal(survival.health.damage().health.current, 2);
  assert.equal(survival.camera.read().remaining, 298.75);
});

test('a chute can hold the controls without stopping recording or exposing its rider to damage', () => {
  const v = visit(), { survival } = v;
  survival.health.damage(); v.hold(true);
  assert.equal(survival.health.damage().reason, 'unavailable');
  assert.equal(survival.health.heal().reason, 'unavailable');
  assert.equal(survival.camera.recharge().reason, 'unavailable');
  survival.update(2, true);
  assert.equal(survival.camera.read().remaining, 298);
  assert.equal(survival.health.read().current, 3);
  assert.equal(survival.health.read().invulnerable, false);
  v.hold(false);
  assert.equal(survival.health.heal().health.current, 4);
  assert.equal(survival.camera.recharge().ok, true);
});

test('lethal damage ends once and ending the visit prevents healing or further battery drain', () => {
  const v = visit(), { survival } = v;
  v.env.inventory.isOpen = true;
  const hit = survival.health.damage(4);
  assert.equal(hit.dead, true); assert.equal(hit.health.current, 0);
  assert.deepEqual(v.endings, ['caught']);
  const ended = v.state();
  v.phase('play'); // A stale caller cannot reopen an internally ended visit.
  assert.equal(survival.health.damage().reason, 'unavailable');
  const healing = survival.health.heal();
  assert.equal(healing.ok, false); assert.equal(healing.dead, true);
  assert.equal(survival.camera.recharge().reason, 'unavailable');
  survival.update(500, true); survival.update(500, true);
  assert.deepEqual(v.state(), ended); assert.deepEqual(v.endings, ['caught']);
});

test('camera expiry ends once even with an item card open and the recording cannot be revived', () => {
  const v = visit(), { survival } = v;
  v.env.inventory.isOpen = true;
  survival.update(300, true);
  assert.deepEqual(v.endings, ['battery']); assert.equal(survival.camera.read().remaining, 0);
  assert.equal(v.batteries.at(-1).depleted, true);
  const ended = v.state();
  v.phase('play');
  assert.equal(survival.camera.recharge().reason, 'unavailable');
  assert.equal(survival.health.heal().reason, 'unavailable');
  assert.equal(survival.health.damage().reason, 'unavailable');
  survival.update(300, true); survival.update(300, true);
  assert.deepEqual(v.state(), ended); assert.deepEqual(v.endings, ['battery']);
});

test('camera expiry during a drop ends once before a subsequent hazard can deal damage', () => {
  const v = visit(), { survival } = v;
  survival.update(299, true); v.phase('drop');
  survival.update(1, true);
  assert.deepEqual(v.endings, ['battery']);
  v.phase('play');
  assert.equal(survival.health.damage(4).reason, 'unavailable');
  assert.equal(survival.health.read().current, 4);
  survival.update(1, true);
  assert.deepEqual(v.endings, ['battery']);
});
