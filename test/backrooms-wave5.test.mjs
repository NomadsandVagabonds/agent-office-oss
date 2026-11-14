// Tests for Wave 5 Absorbed Staff NPCs: multi-species procedural look rolling,
// 1.5x arm reach & non-lethal snare state machine, crouch/hop counterplay, and
// cooldown anti-stunlock guarantees.
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng } from '../public/world/backrooms/gen.js';
import {
  ABSORBED, ABSORBED_MOUNTS, ABSORBED_SPECIES,
  rollAbsorbedRoster, createAbsorbedState, canGrabPlayer, stepAbsorbed, absorbedCount, ABSORBED_A_PART,
} from '../public/world/backrooms/absorbed/rule.js';

test('how many a part has: one to three, however many plain rooms it has — something to come upon, not the wallpaper', () => {
  assert.equal(absorbedCount(0), 0);
  assert.equal(absorbedCount(1), 1);
  for (let rooms = 1; rooms <= 40; rooms++) {
    const n = absorbedCount(rooms);
    assert.ok(n >= ABSORBED_A_PART.least && n <= ABSORBED_A_PART.most && n <= rooms, `${rooms} plain rooms: ${n}`);
    assert.ok(n >= absorbedCount(rooms - 1), 'never fewer for more rooms');
  }
  assert.deepEqual([absorbedCount(8), absorbedCount(14), absorbedCount(20), absorbedCount(28)], [1, 2, 3, 3]);
});

test('rollAbsorbedRoster: deterministic, covers humans, cats, dogs, goblins, and robots across wall/floor/ceiling mounts', () => {
  const cast = [
    { name: 'Olive Heron', look: { species: 'cat', skin: '#9a9aa6', outfit: 'cardigan', outfitColor: '#6f8a4a', accessory: 'glasses' } },
    { name: 'Coral Tapir', look: { species: 'dog', skin: '#c99a62', outfit: 'hoodie', outfitColor: '#c9893f', accessory: 'propeller' } },
  ];
  const r1 = rollAbsorbedRoster(makeRng('wave5-seed'), 12, cast);
  const r2 = rollAbsorbedRoster(makeRng('wave5-seed'), 12, cast);
  assert.deepEqual(r1, r2, 'identical seed rolls identical absorbed coworkers');

  const seenSpecies = new Set(r1.map((x) => x.look.species));
  for (const sp of ABSORBED_SPECIES) {
    assert.ok(seenSpecies.has(sp), `expected ${sp} in rolled roster`);
  }

  const seenMounts = new Set(r1.map((x) => x.preferredMount));
  for (const m of ABSORBED_MOUNTS) {
    assert.ok(seenMounts.has(m), `expected ${m} mount in rolled roster`);
  }

  // Cartoon accessories like propeller/halo are filtered out
  for (const item of r1) {
    assert.notEqual(item.look.accessory, 'propeller');
    assert.notEqual(item.look.accessory, 'halo');
  }
});

test('Absorbed Worker (wall): reaches at 2.9m, snares inside 1.5x arm reach (~1.04m), releases non-lethally, and respects cooldown', () => {
  assert.equal(ABSORBED.armScale, 1.5);
  assert.ok(ABSORBED.reachRadius.wall > 1.0, '1.5x arms reach over a metre into corridors');

  let s = createAbsorbedState('wall');
  // Far away -> idle
  let res = stepAbsorbed(s, { dt: 0.1, dist: 4.2, clearLine: true });
  s = res.state;
  assert.equal(s.phase, 'idle');
  assert.equal(res.slow, 1);

  // Within noticeRadius -> cranes head & extends 1.5x arms
  res = stepAbsorbed(s, { dt: 0.1, dist: 2.2, clearLine: true });
  s = res.state;
  assert.equal(s.phase, 'reaching');
  assert.equal(res.noticedNow, true);
  assert.ok(s.reachBlend > 0);

  // Running into 1.5x arm reach triggers non-lethal grab + slow
  res = stepAbsorbed(s, { dt: 0.05, dist: 0.96, clearLine: true });
  s = res.state;
  assert.equal(res.startedGrab, true);
  assert.equal(s.phase, 'grabbing');
  assert.equal(res.slow, ABSORBED.slowFactor);
  assert.ok(res.interfere > 0.5);

  // Waiting out holdDuration releases cleanly into cooldown (never kills/ends run)
  let released = false;
  for (let i = 0; i < 20; i++) {
    res = stepAbsorbed(s, { dt: 0.1, dist: 0.6, struggling: false, clearLine: true });
    s = res.state;
    if (res.releasedGrab) { released = true; break; }
  }
  assert.equal(released, true);
  assert.equal(s.phase, 'cooldown');
  assert.equal(res.slow, 1);

  // Standing right next to it during cooldown never chain-grabs
  const duringCooldown = stepAbsorbed(s, { dt: 0.2, dist: 0.3, clearLine: true });
  assert.equal(duringCooldown.state.phase, 'cooldown');
  assert.equal(duringCooldown.startedGrab, false);
});

test('Absorbed Worker struggle: pressing movement/hop breaks the hold nearly twice as fast', () => {
  let passive = stepAbsorbed(createAbsorbedState('wall'), { dt: 0.01, dist: 0.7, clearLine: true }).state;
  let active = stepAbsorbed(createAbsorbedState('wall'), { dt: 0.01, dist: 0.7, clearLine: true }).state;

  let passiveSteps = 0, activeSteps = 0;
  while (passive.phase === 'grabbing' && passiveSteps < 100) {
    passive = stepAbsorbed(passive, { dt: 0.05, dist: 0.6, struggling: false, clearLine: true }).state;
    passiveSteps++;
  }
  while (active.phase === 'grabbing' && activeSteps < 100) {
    active = stepAbsorbed(active, { dt: 0.05, dist: 0.6, struggling: true, clearLine: true }).state;
    activeSteps++;
  }
  assert.ok(activeSteps < passiveSteps * 0.65, `struggling (${activeSteps}) should release faster than passive (${passiveSteps})`);
});

test('Ceiling & Floor counterplay: crouching ducks under ceiling hangers; hopping clears outer floor hands; walls block grabs', () => {
  // Ceiling hanger: standing player gets grabbed, crouched player passes safely underneath
  assert.equal(canGrabPlayer('ceiling', { dist: 0.5, playerSink: 0, clearLine: true }), true);
  assert.equal(canGrabPlayer('ceiling', { dist: 0.5, playerSink: 0.42, clearLine: true }), false);

  let ceil = createAbsorbedState('ceiling');
  const crouched = stepAbsorbed(ceil, { dt: 0.1, dist: 0.4, playerSink: 0.45, clearLine: true });
  assert.notEqual(crouched.state.phase, 'grabbing');
  const upright = stepAbsorbed(ceil, { dt: 0.1, dist: 0.4, playerSink: 0, clearLine: true });
  assert.equal(upright.state.phase, 'grabbing');

  // Floor hanger: hopping over outer arm ring clears, running flat snags legs and tugs camera down
  assert.equal(canGrabPlayer('floor', { dist: 0.82, playerDrop: 0.32, clearLine: true }), false);
  assert.equal(canGrabPlayer('floor', { dist: 0.82, playerDrop: 0, clearLine: true }), true);
  const floorGrab = stepAbsorbed(createAbsorbedState('floor'), { dt: 0.1, dist: 0.82, playerDrop: 0, clearLine: true });
  assert.equal(floorGrab.state.phase, 'grabbing');
  assert.equal(floorGrab.sinkTo, ABSORBED.floorGrabSink);

  // Blocked line-of-sight (e.g. behind a 20 cm wall) never reaches or grabs
  const behindWall = stepAbsorbed(createAbsorbedState('wall'), { dt: 0.1, dist: 0.3, clearLine: false });
  assert.equal(behindWall.state.phase, 'idle');
  assert.equal(behindWall.startedGrab, false);
});
