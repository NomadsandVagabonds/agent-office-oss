import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, step, LEVEL, PLAYER, lightBeams, beamPolygon, rayToCover,
  isLit, interactable, objective,
} from '../core/nightshift-game.mjs';

const advance = (state, seconds, input = {}) => {
  for (let t = 0; t < seconds - 1e-8; t += 1 / 60) state = step(state, input, Math.min(1 / 60, seconds - t));
  return state;
};
const standingUnderFirstBeam = () => ({ ...createGame(), x: 7.4, time: 0.9 * 7.8 / (Math.PI * 2), graceUntil: 0 });

test('night shift: state is immutable and movement stays inside the office', () => {
  const before = createGame(), copy = structuredClone(before);
  const after = advance(before, 2, { axis: -1 });
  assert.deepEqual(before, copy);
  assert.equal(after.x, LEVEL.bounds.x0 + PLAYER.radius);
  assert.equal(after.y, 0);
  assert.equal(after.grounded, true);
  assert.equal(after.facing, -1);
  assert.deepEqual(JSON.parse(JSON.stringify(after)), after);
  assert.throws(() => step(after, {}, NaN), /dt/);
  assert.throws(() => step(after, {}, -1), /dt/);
  assert.ok(step(before, { axis: 1 }, 10000).x - before.x < 1, 'a resumed tab cannot teleport across the level');
});

test('night shift: solid paper boxes stop walking and can be jumped', () => {
  const start = { ...createGame(), x: 14.2, graceUntil: 100 };
  const stopped = advance(start, 1, { axis: 1 });
  assert.ok(stopped.x < LEVEL.obstacles[0].x - LEVEL.obstacles[0].w / 2);
  let jumping = step(start, { axis: 1, jump: true }, 1 / 60);
  jumping = advance(jumping, 1.1, { axis: 1 });
  assert.ok(jumping.x > LEVEL.obstacles[0].x + LEVEL.obstacles[0].w / 2);
  assert.equal(jumping.y, 0);
  assert.equal(jumping.grounded, true);
  const held = advance(start, 2, { jump: true });
  assert.equal(held.y, 0, 'holding jump never auto-bounces after landing');
  assert.equal(step(start, { crouch: true, jump: true }, 0.1).y, 0);
});

test('night shift: crouching below a desk blocks exactly the light that exposes a standing head', () => {
  const exposed = standingUnderFirstBeam();
  assert.equal(isLit(exposed), true);
  assert.equal(isLit({ ...exposed, crouching: true }), false);
  const hit = rayToCover(10, 4.7, 7.4, PLAYER.crouchHeight * 0.92);
  assert.equal(hit.cover, 'reception');
  assert.ok(Math.abs(hit.y - 0.95) < 1e-7);
  const noHit = rayToCover(10, 4.7, 7.4, 1.2 * 0.92);
  assert.equal(noHit.t, 1);
  const beam = lightBeams(exposed)[0];
  const polygon = beamPolygon(exposed, beam, 64);
  assert.deepEqual(polygon[0], [beam.x, beam.y]);
  assert.ok(polygon.some(([, y]) => Math.abs(y - 0.95) < 1e-7));
  assert.equal(polygon.length, 66);
  assert.deepEqual(beamPolygon(exposed, { ...beam, active: false }), []);
});

test('night shift: exposure warns before capture and darkness lets suspicion fade', () => {
  let state = { ...standingUnderFirstBeam(), time: 0.8 };
  state = advance(state, 0.2);
  assert.equal(state.stage, 'playing');
  assert.ok(state.exposure > 0.1 && state.exposure < 0.3);
  state = advance(state, 0.3, { crouch: true });
  assert.equal(state.exposure, 0);
  assert.equal(state.lit, false);
  const caught = advance({ ...createGame(), x: 10, time: 1, graceUntil: 0 }, 1.4);
  assert.equal(caught.stage, 'caught');
  assert.equal(caught.deaths, 1);
  assert.equal(caught.exposure, 1);
});

test('night shift: each lamp has a recurring visible blackout and a useful countdown', () => {
  for (const [i, lamp] of LEVEL.lights.entries()) {
    const darkStart = lamp.period - lamp.rest;
    for (const cycle of [0, 1, 3]) {
      const state = { ...createGame(), time: cycle * lamp.period + darkStart + 0.1 };
      const beam = lightBeams(state)[i];
      assert.equal(beam.active, false);
      assert.equal(beam.resting, true);
      assert.ok(beam.restRemaining > 3, 'the opening allows a crouched crossing plus reaction time');
      assert.equal(beam.scanRemaining, 0);
      assert.deepEqual(beamPolygon(state, beam), [], 'the safe interval is also visibly dark');
      const resumed = lightBeams({ ...state, time: (cycle + 1) * lamp.period + 0.1 })[i];
      assert.equal(resumed.active, true);
      assert.equal(resumed.resting, false);
      assert.equal(resumed.restRemaining, 0);
      assert.ok(resumed.scanRemaining > 0);
    }
  }
  const offline = lightBeams({ ...createGame(), time: 5, breaker: true }).at(-1);
  assert.equal(offline.active, false);
  assert.equal(offline.resting, false, 'a disabled light must not promise another scan');
  assert.equal(offline.restRemaining, 0);
  assert.equal(offline.scanRemaining, 0);
});

test('night shift: waiting at either desk gap permits a fully dark crouched crossing, without exposure grace', () => {
  for (const [leftIndex, rightIndex, lightIndex] of [[0, 1, 0], [2, 3, 1]]) {
    const left = LEVEL.covers[leftIndex], right = LEVEL.covers[rightIndex];
    const startX = left.x + left.w / 2 - PLAYER.radius * 2;
    const endX = right.x - right.w / 2 + PLAYER.radius * 2;
    const reactionTime = 0.5, crossingTime = (endX - startX) / PLAYER.crouchSpeed;
    const requiredWindow = reactionTime + crossingTime + 0.15;
    // A visitor can arrive on any part of the scan or blackout; late arrivals
    // wait for the following opening instead of racing an invisible deadline.
    for (const arrival of [0, 0.3, 1.9, 4.7, 7.5, 8.2, 13.3]) {
      let state = { ...createGame(), x: startX, time: arrival, crouching: true, graceUntil: 0 };
      let waited = 0;
      while (lightBeams(state)[lightIndex].restRemaining < requiredWindow) {
        state = step(state, { crouch: true }, 1 / 60); waited += 1 / 60;
        assert.equal(state.exposure, 0, 'the waiting spot stays safe while crouching');
        assert.ok(waited < LEVEL.lights[lightIndex].period + 0.1, 'an opening recurs within one cycle');
      }
      state = advance(state, reactionTime, { crouch: true });
      while (state.x < endX - 1e-7) {
        state = step(state, { axis: 1, crouch: true }, Math.min(1 / 60, (endX - state.x) / PLAYER.crouchSpeed));
        assert.equal(state.lit, false, 'the entire crossing is visibly dark, not just survivable');
        assert.equal(state.exposure, 0, 'crossing does not spend the exposure warning interval');
        assert.equal(state.stage, 'playing');
      }
      assert.equal(state.deaths, 0);
      assert.equal(state.cover, right.id);
      assert.equal(state.graceUntil, 0);
    }
  }
});

test('night shift: capture returns to a checkpoint and preserves earned access', () => {
  const start = { ...createGame(), x: 23.5, checkpoint: 17, time: 1, graceUntil: 0, keycard: true };
  let state = advance(start, 1.4);
  assert.equal(state.stage, 'caught');
  state = advance(state, 0.9);
  assert.equal(state.stage, 'playing');
  assert.equal(state.x, 17);
  assert.equal(state.exposure, 0);
  assert.equal(state.keycard, true);
  assert.equal(state.deaths, 1);
  assert.ok(state.graceUntil > state.time);
});

test('night shift: keycard, breaker, shutter and exit enforce the actual errand', () => {
  const atBreaker = { ...createGame(), x: LEVEL.breakerX };
  assert.equal(interactable(atBreaker).id, 'breaker');
  assert.equal(step(atBreaker, { interact: true }, 0).breaker, false);
  let state = step({ ...createGame(), x: LEVEL.keycardX }, { interact: true }, 0);
  assert.equal(state.keycard, true);
  assert.equal(state.event, 'keycard');
  assert.match(objective(state), /breaker/);
  state = step({ ...state, x: LEVEL.breakerX }, {}, 0);
  state = step(state, { interact: true }, 0);
  assert.equal(state.breaker, true);
  assert.equal(state.event, 'breaker');
  assert.equal(lightBeams(state).find((beam) => beam.id === 'executive').active, false);
  assert.equal(lightBeams(state).find((beam) => beam.id === 'reception').active, true);
  const locked = advance({ ...createGame(), x: 38, graceUntil: 100 }, 2, { axis: 1 });
  assert.ok(locked.x < LEVEL.gateX);
  const unlocked = advance({ ...state, x: 38 }, 2, { axis: 1 });
  assert.ok(unlocked.x > LEVEL.gateX);
  state = step({ ...unlocked, x: LEVEL.exitX, interactHeld: false }, { interact: true }, 0);
  assert.equal(state.stage, 'won');
  assert.equal(state.event, 'win');
  assert.equal(step(state, { axis: -1 }, 10), state, 'completion remains complete');
});

test('night shift: holding interact cannot activate two successive stations', () => {
  const card = step({ ...createGame(), x: LEVEL.keycardX }, { interact: true }, 0);
  const breaker = step({ ...card, x: LEVEL.breakerX }, { interact: true }, 0);
  assert.equal(breaker.breaker, false);
  assert.equal(step(step(breaker, {}, 0), { interact: true }, 0).breaker, true);
});

test('night shift: the real map can be cleared using cover, jumps and interactions without teleports', () => {
  let state = createGame();
  for (let frame = 0; frame < 60 * 45 && state.stage !== 'won'; frame++) {
    const cover = LEVEL.covers.some((desk) => Math.abs(state.x - desk.x) < desk.w / 2 - 0.05);
    const obstacle = LEVEL.obstacles.find((box) => state.x < box.x && box.x - box.w / 2 - state.x < 0.8);
    const near = [LEVEL.keycardX, LEVEL.breakerX, LEVEL.exitX].some((x) => Math.abs(state.x - x) < 0.7);
    state = step(state, {
      axis: 1, crouch: cover,
      jump: !cover && !!obstacle && state.grounded && !state.jumpHeld,
      interact: near && frame % 2 === 0,
    }, 1 / 60);
  }
  assert.equal(state.stage, 'won');
  assert.equal(state.deaths, 0);
  assert.equal(state.keycard, true);
  assert.equal(state.breaker, true);
  assert.equal(state.checkpoint, LEVEL.checkpoints.at(-1));
});
