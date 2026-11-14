import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, act, advance, objective, remaining, chillRemaining, inventory,
  CHILL_SECONDS, CHALLENGE_SECONDS,
} from '../core/scranton-game.mjs';

const step = (state, action, now) => act(state, action, now).state;

function inFridge(mode = 'relaxed', start = 0) {
  let state = createGame({ mode, now: start });
  state = step(state, 'start', start);
  state = step(state, 'borrow', start + 1);
  state = step(state, 'mix', start + 2);
  return step(state, 'chill', start + 3);
}

test('gelatin: entering the floor never starts a timer or gives away the stapler', () => {
  const state = createGame({ mode: 'challenge', now: 10 });
  assert.equal(state.stage, 'ready');
  assert.equal(remaining(state, 10000), null);
  assert.equal(advance(state, 10000), state);
  assert.equal(act(state, 'borrow', 10000).state.stage, 'ready');
  assert.deepEqual(inventory(state), []);
  assert.match(objective(state), /reception/);
});

test('gelatin: every recipe step requires its actual predecessor', () => {
  const state = step(createGame(), 'start', 10);
  const original = structuredClone(state);
  for (const action of ['mix', 'chill', 'retrieve', 'return', 'invent a new ingredient']) {
    const answer = act(state, action, 11);
    assert.equal(answer.event, 'denied');
    assert.equal(answer.state.stage, 'searching');
    assert.ok(answer.message.length > 10);
  }
  assert.deepEqual(state, original, 'rejected actions never mutate the caller’s state');
  const borrowed = step(state, 'borrow', 12);
  assert.deepEqual(inventory(borrowed), ['Borrowed stapler']);
  assert.equal(step(borrowed, 'borrow', 13).stage, 'borrowed');
  assert.equal(step(borrowed, 'return', 14).stage, 'borrowed');
  assert.equal(step(borrowed, 'chill', 15).stage, 'borrowed');
  const mixed = step(borrowed, 'mix', 16);
  assert.equal(step(mixed, 'retrieve', 17).stage, 'mixed');
});

test('gelatin: a complete relaxed prank uses real fridge time, then stays won', () => {
  let state = inFridge('relaxed', 100);
  assert.equal(state.chillUntil, 103 + CHILL_SECONDS);
  assert.deepEqual(inventory(state), [], 'the bowl is inside the fridge');
  assert.equal(chillRemaining(state, 105), 6);
  assert.equal(step(state, 'retrieve', 110.999).stage, 'chilling');
  state = advance(state, 111);
  assert.equal(state.stage, 'set', 'the exact boundary is enough');
  assert.match(objective(state), /Retrieve/);
  state = step(state, 'retrieve', 111);
  assert.deepEqual(inventory(state), ['Stapler in lemon gelatin']);
  const outcome = act(state, 'return', 130);
  assert.equal(outcome.event, 'win');
  assert.equal(outcome.state.stage, 'won');
  assert.equal(outcome.state.finishedAt, 130);
  assert.equal(outcome.state.startedAt, 100);
  assert.equal(remaining(outcome.state, 100000), null);
  assert.equal(advance(outcome.state, 100000), outcome.state);
  assert.equal(act(outcome.state, 'return', 100000).event, 'denied', 'no duplicate wins');
});

test('gelatin: retrieval at the boundary works without a preceding animation tick', () => {
  const state = inFridge();
  const early = act(state, 'retrieve', state.chillUntil - 0.001);
  assert.equal(early.event, 'denied');
  const ready = act(state, 'retrieve', state.chillUntil);
  assert.equal(ready.event, 'retrieve');
  assert.equal(ready.state.stage, 'carrying');
});

test('gelatin: challenge wins before the deadline, but times out at the deadline', () => {
  const chilled = inFridge('challenge', 40);
  assert.equal(chilled.deadline, 40 + CHALLENGE_SECONDS);
  const carrying = step(chilled, 'retrieve', 51);
  assert.equal(act(carrying, 'return', 159.999).event, 'win');
  const late = act(carrying, 'return', 160);
  assert.equal(late.event, 'timeout');
  assert.equal(late.state.stage, 'lost');
  assert.equal(late.state.finishedAt, 160);
  assert.equal(remaining(late.state, 200), 0);
  assert.equal(advance(carrying, 1000).stage, 'lost', 'a missed render frame cannot bypass timeout');
});

test('gelatin: relaxed play has no hurry, and a completed challenge retains its finishing time', () => {
  const unhurried = step(inFridge(), 'retrieve', 5000);
  assert.equal(step(unhurried, 'return', 20000).stage, 'won');
  const fast = step(step(inFridge('challenge'), 'retrieve', 11), 'return', 12);
  assert.equal(remaining(fast, 9000), 108, 'display the time actually left at completion');
  assert.equal(fast.finishedAt - fast.startedAt, 12);
});

test('gelatin: retry starts a fresh clock; a live attempt cannot silently restart', () => {
  const active = step(createGame(), { type: 'start', mode: 'challenge' }, 12);
  const refused = act(active, { type: 'start', mode: 'relaxed' }, 40);
  assert.equal(refused.event, 'denied');
  assert.equal(refused.state.mode, 'challenge');
  assert.equal(refused.state.startedAt, 12);
  const expired = advance(active, 132);
  const retry = act(expired, { type: 'start', mode: 'challenge' }, 150);
  assert.equal(retry.event, 'start');
  assert.equal(retry.state.deadline, 270);
  assert.equal(retry.state.chillUntil, null);
  assert.equal(retry.state.finishedAt, null);
  const reset = act(retry.state, { type: 'reset', mode: 'relaxed' }, 151);
  assert.equal(reset.state.stage, 'ready');
  assert.equal(reset.state.deadline, null);
  assert.equal(reset.state.mode, 'relaxed');
  assert.deepEqual(inventory(reset.state), []);
});

test('gelatin: a backwards clock cannot postpone refrigeration or extend the challenge', () => {
  const fridge = inFridge('challenge', 20);
  const later = advance(fridge, 27);
  assert.equal(chillRemaining(later, 1), 4);
  assert.equal(remaining(later, 1), 113);
  assert.equal(advance(later, 1).lastNow, 27);
  assert.equal(step(later, 'retrieve', 1).stage, 'chilling');
});

test('gelatin: state is serializable and invalid configuration cannot corrupt a run', () => {
  const state = inFridge('challenge');
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  assert.throws(() => createGame({ mode: 'impossible' }), /Unknown prank mode/);
  for (const now of [NaN, Infinity, -1]) assert.throws(() => advance(state, now), /Game time/);
});
