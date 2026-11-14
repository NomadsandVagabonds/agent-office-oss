import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, restart, step, LEVEL, PLAYER, COIN, lightBeams, beamPolygon, rayToCover,
  isLit, interactable, objective,
} from '../core/nightshift-game.mjs';
import { hideoutById } from '../core/game.mjs';

const advance = (state, seconds, input = {}) => {
  for (let t = 0; t < seconds - 1e-8; t += 1 / 60) state = step(state, input, Math.min(1 / 60, seconds - t));
  return state;
};
const standingUnderFirstBeam = () => ({ ...createGame(), x: 7.4, time: 0.9 * 7.8 / (Math.PI * 2), graceUntil: 0 });

// The long game: what office.game.left('nightshift') says while nothing has been found yet.
const ALL = Object.freeze({ card: true, coins: Object.freeze([1, 2]) });
const [GAP_COIN, STACK_COIN] = LEVEL.coins;
const STACK = LEVEL.obstacles.find((box) => box.id === 'archive-boxes');
/** Step with these keys until `done(state)`. A rule that never fires fails the test instead of hanging it. */
function until(state, done, what, input = {}, seconds = 30) {
  for (let frame = 0; frame < seconds * 60 && !done(state); frame++) state = step(state, input, 1 / 60);
  assert.ok(done(state), `${what} (waited ${seconds}s of game time)`);
  return state;
}
/** One jump from where you stand, held keys and all, until you are back on something. */
function jump(state, axis = 0) {
  state = step(state, { axis, jump: true }, 1 / 60);
  for (let frame = 0; frame < 120 && !state.grounded; frame++) state = step(state, { axis }, 1 / 60);
  return step(state, {}, 1 / 60);
}
/**
 * Play the real map from wherever `state` is to the time clock, with held keys only: crouch under desks, jump the
 * boxes, use what there is to use — and go for whatever coins are still hanging (up for the first as you cross its
 * gap, a stop and a second jump on top of the archive boxes for the other).
 */
function playThrough(state, seconds = 60) {
  for (let frame = 0; frame < 60 * seconds && state.stage !== 'won'; frame++) {
    const cover = LEVEL.covers.some((desk) => Math.abs(state.x - desk.x) < desk.w / 2 - 0.05);
    const obstacle = LEVEL.obstacles.find((box) => state.x < box.x && box.x - box.w / 2 - state.x < 0.8);
    const near = [LEVEL.keycardX, LEVEL.breakerX, LEVEL.exitX].some((x) => Math.abs(state.x - x) < 0.7);
    const input = { axis: 1, crouch: cover, jump: !cover && !!obstacle && state.grounded && !state.jumpHeld, interact: near && frame % 2 === 0 };
    if (state.left.coins.includes(GAP_COIN.n) && !cover && Math.abs(state.x - GAP_COIN.x) < 0.9 && state.grounded && !state.jumpHeld) input.jump = true;
    if (state.left.coins.includes(STACK_COIN.n) && state.y > 0.3 && Math.abs(state.x - STACK.x) < 0.25) { input.axis = 0; input.jump = state.grounded && !state.jumpHeld; }
    state = step(state, input, 1 / 60);
  }
  return state;
}

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

/* ---- the long game: a keycard and two coins (core/game.mjs) ------------------------------------------- */

test('night shift: the floor hides exactly what the office counts, and with nothing left it offers nothing', () => {
  assert.deepEqual(LEVEL.coins.map((coin) => coin.n), Array.from({ length: hideoutById('nightshift').coins }, (_, i) => i + 1));
  assert.deepEqual(createGame(ALL).left, { card: true, coins: [1, 2] });
  assert.deepEqual(createGame(ALL).took, { card: false, coins: [] });
  assert.deepEqual(createGame({ card: false, coins: [2] }).left, { card: false, coins: [2] });
  assert.deepEqual(createGame({ card: 1, coins: [7, '1', 2, 2] }).left, { card: true, coins: [2] }, 'only coins this floor has, once each');
  assert.deepEqual(createGame({ card: true, coins: 'both' }).left.coins, []);
  // no long game at all (an older office, a test harness), or everything already found: nothing to pick up, nothing to bank
  for (const nothing of [undefined, null, {}, { card: false, coins: [] }]) {
    const fresh = createGame(nothing);
    assert.deepEqual(fresh.left, { card: false, coins: [] });
    assert.deepEqual(JSON.parse(JSON.stringify(fresh)), fresh);
    assert.equal(jump({ ...fresh, x: GAP_COIN.x, graceUntil: 100 }).event, null, 'jumping where a coin would hang finds nothing');
    const done = playThrough(fresh);
    assert.equal(done.stage, 'won', 'and the shift is the same errand');
    assert.equal(done.keycard, true);
    assert.equal(done.breaker, true);
    assert.deepEqual(done.took, { card: false, coins: [] });
  }
});

test('night shift: each coin hangs clear of the furniture, inside a lamp’s sweep, and only a jump reaches it', () => {
  for (const coin of LEVEL.coins) {
    assert.ok(coin.x - COIN.radius > LEVEL.bounds.x0 && coin.x + COIN.radius < LEVEL.bounds.x1, `coin ${coin.n} is inside the office`);
    for (const box of [...LEVEL.covers, ...LEVEL.obstacles]) {
      assert.ok(coin.y - COIN.radius > box.h || Math.abs(coin.x - box.x) > box.w / 2 + COIN.radius, `coin ${coin.n} is not inside ${box.id}`);
    }
    assert.ok(coin.y - COIN.radius > PLAYER.height, `coin ${coin.n} is above anybody merely walking past`);
    assert.ok(coin.y + COIN.radius < Math.min(...LEVEL.lights.map((lamp) => lamp.y)), `coin ${coin.n} is below the lamps`);
  }
  // the first: in the open gap between the first two desks, where the first lamp looks for as long as it is scanning
  const [reception, sales] = LEVEL.covers;
  assert.ok(GAP_COIN.x > reception.x + reception.w / 2 && GAP_COIN.x < sales.x - sales.w / 2);
  const lamp = LEVEL.lights[0];
  let lit = 0, dark = 0;
  for (let time = 0; time < lamp.period; time += 0.05) (isLit({ ...createGame(), x: GAP_COIN.x, time }) ? lit++ : dark++);
  assert.ok(lit > dark, 'standing up under it is exposed for most of the cycle');
  assert.ok(dark * 0.05 > 3, 'and safe only while the lamp recalibrates');
  const under = { ...createGame(ALL), x: reception.x + reception.w / 2, graceUntil: 100 };
  assert.deepEqual(advance(under, 1.2, { axis: 1 }).took.coins, [], 'walking under it does not take it');
  assert.deepEqual(advance(under, 2.2, { axis: 1, crouch: true }).took.coins, [], 'nor does crouching past');
  const grabbed = jump({ ...under, x: GAP_COIN.x });
  assert.deepEqual(grabbed.took.coins, [GAP_COIN.n], 'a jump does');
  assert.deepEqual(grabbed.left.coins, [STACK_COIN.n]);
  assert.equal(grabbed.y, 0);
  // the second: over the archive boxes, beyond any jump from the floor — up onto the stack first, then again
  assert.equal(STACK_COIN.x, STACK.x);
  for (let x = STACK.x - 2.4; x <= STACK.x + 2.4; x += 0.05) {
    for (const axis of [-1, 0, 1]) {
      const tried = jump({ ...createGame(ALL), x, graceUntil: 100 }, axis);
      assert.deepEqual(tried.took.coins, [], `no single jump from the floor (x ${x.toFixed(2)}, ${axis}) reaches it`);
    }
  }
  let climber = jump({ ...createGame(ALL), x: STACK.x - STACK.w / 2 - 1.1, graceUntil: 100 }, 1);
  assert.equal(climber.y, STACK.h, 'a running jump lands on the stack');
  assert.deepEqual(climber.took.coins, []);
  climber = jump(climber);
  assert.deepEqual(climber.took.coins, [STACK_COIN.n], 'and a second jump from there takes the coin');
  assert.equal(climber.y, STACK.h);
  // up there the second lamp does look, some of the time
  const second = LEVEL.lights[1];
  let seen = 0;
  for (let time = 0; time < second.period; time += 0.05) if (isLit({ ...createGame(), x: STACK.x, y: STACK.h, time })) seen++;
  assert.ok(seen * 0.05 > 0.5 && seen * 0.05 < second.period - second.rest);
});

test('night shift: a coin is kept the moment it is touched — a catch does not give it back, nor does starting again', () => {
  const start = { ...createGame(ALL), x: GAP_COIN.x, time: 0.5, graceUntil: 0 };
  let state = until(step(start, { jump: true }, 1 / 60), (now) => now.took.coins.length > 0, 'the jump reaches the coin', {}, 2);
  assert.equal(state.event, 'coin');
  assert.deepEqual(state.took.coins, [GAP_COIN.n]);
  assert.deepEqual(start.left.coins, [1, 2], 'the state it came from is untouched');
  // stay standing in the light until security has you, then come to at the checkpoint
  state = until(state, (now) => now.stage === 'caught', 'standing in the open gets you caught');
  assert.equal(state.deaths, 1);
  assert.deepEqual(state.took.coins, [GAP_COIN.n]);
  state = until(state, (now) => now.stage === 'playing', 'you come to at the checkpoint', {}, 5);
  assert.equal(state.event, 'respawn');
  assert.equal(state.x, LEVEL.startX);
  assert.deepEqual(state.left, { card: true, coins: [STACK_COIN.n] }, 'the coin is not hanging there again');
  assert.deepEqual(state.took, { card: false, coins: [GAP_COIN.n] }, 'and is still in hand');
  assert.equal(jump({ ...state, x: GAP_COIN.x, graceUntil: 100 }).took.coins.length, 1, 'there is nothing to take there twice');
  // R: a fresh shift, given only what was still on the floor
  const again = restart(state);
  assert.equal(again.x, LEVEL.startX);
  assert.equal(again.time, 0);
  assert.equal(again.deaths, 0);
  assert.equal(again.keycard, false);
  assert.deepEqual(again.left, { card: true, coins: [STACK_COIN.n] });
  assert.deepEqual(again.took, { card: false, coins: [] }, 'what the last shift earned is already the office’s');
  assert.equal(jump({ ...again, x: GAP_COIN.x, graceUntil: 100 }).event, null);
  assert.deepEqual(restart(restart(again)).left, again.left);
  // and the whole floor, played from there: the other coin, the card — never the first coin again
  const done = playThrough(again);
  assert.equal(done.stage, 'won');
  assert.deepEqual(done.took, { card: true, coins: [STACK_COIN.n] });
  assert.deepEqual(restart(done).left, { card: false, coins: [] }, 'after which the floor has nothing left');
});

test('night shift: the keycard is the office’s only once you have clocked out with it, and only once', () => {
  let state = step({ ...createGame(ALL), x: LEVEL.keycardX }, { interact: true }, 0);
  assert.equal(state.keycard, true, 'the access card is in hand');
  assert.equal(state.took.card, false, 'which is not yet the same as having got out with it');
  assert.equal(state.left.card, true);
  // caught while carrying it: the card stays in hand (as before), and still nothing is banked
  state = advance({ ...state, x: 23.5, checkpoint: 17, time: 1, graceUntil: 0 }, 2.4);
  assert.equal(state.deaths, 1);
  assert.equal(state.keycard, true);
  assert.equal(state.took.card, false);
  state = step(step({ ...state, x: LEVEL.breakerX }, {}, 0), { interact: true }, 0);
  assert.equal(state.breaker, true);
  assert.equal(state.took.card, false, 'cutting the power banks nothing either');
  assert.equal(restart(state).left.card, true, 'giving up before the exit leaves the card on the floor for another go');
  state = step(step({ ...state, x: LEVEL.exitX }, {}, 0), { interact: true }, 0);
  assert.equal(state.stage, 'won');
  assert.deepEqual(state.took, { card: true, coins: [] });
  assert.equal(state.left.card, false);
  assert.equal(interactable(state).id, 'lift', 'all that is left is the way home');
  // a second shift in the same visit, or a later visit: the errand is the same, and nothing new is banked
  for (const later of [restart(state), createGame({ card: false, coins: [] })]) {
    assert.equal(later.left.card, false);
    const locked = step({ ...later, x: LEVEL.breakerX }, { interact: true }, 0);
    assert.equal(locked.breaker, false, 'the breaker still wants the card');
    assert.equal(locked.event, 'locked');
    assert.equal(interactable({ ...later, x: LEVEL.breakerX }).locked, true);
    assert.equal(interactable({ ...later, x: LEVEL.keycardX }).id, 'keycard', 'which is still in Records');
    const done = playThrough(later);
    assert.equal(done.stage, 'won');
    assert.equal(done.keycard, true);
    assert.equal(done.took.card, false, 'clocking out again is not finding it again');
    assert.equal(done.left.card, false);
  }
});

test('night shift: what is within reach is only ever named, never explained', () => {
  const seen = [
    interactable({ ...createGame(), x: LEVEL.keycardX }),
    interactable({ ...createGame(), x: LEVEL.breakerX }),
    interactable({ ...createGame(), x: LEVEL.breakerX, keycard: true }),
    interactable({ ...createGame(), x: LEVEL.exitX, keycard: true, breaker: true }),
    interactable({ ...createGame(), stage: 'won' }),
  ];
  assert.deepEqual(seen.map((near) => near.id), ['keycard', 'breaker', 'breaker', 'exit', 'lift']);
  assert.deepEqual(seen.map((near) => near.locked), [false, true, false, false, false]);
  for (const near of seen) assert.match(near.label, /^(the|a) [a-z ]+$/, `"${near.label}" is the name of a thing: no key, no instruction`);
  assert.equal(interactable({ ...createGame(), x: 10 }), null);
  assert.equal(interactable({ ...createGame(), x: LEVEL.keycardX, stage: 'caught' }), null);
});

test('night shift: the real map can be cleared with both coins and the keycard, without teleports', () => {
  const state = playThrough(createGame(ALL));
  assert.equal(state.stage, 'won');
  assert.equal(state.deaths, 0);
  assert.deepEqual(state.took, { card: true, coins: [GAP_COIN.n, STACK_COIN.n] });
  assert.deepEqual(state.left, { card: false, coins: [] });
  assert.equal(state.checkpoint, LEVEL.checkpoints.at(-1));
});
