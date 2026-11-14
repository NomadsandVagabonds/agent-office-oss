import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, divert, help, finish, summary, working, workerStatus,
  ROLES, REST_SECONDS, REPLACEMENT_PER_SECOND, VISITOR_PER_SECOND } from '../public/world/backrooms/rooms/mecha/rule.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} differs from ${b}`);
const sign = (state, index) => help(step(divert(state, index).state, REST_SECONDS), index).state;

test('MECHA: arriving wakes no empty cage and starts every professional at their own task', () => {
  const s = createState();
  assert.equal(s.workers.length, 8);
  assert.deepEqual(s.workers.map((w) => w.role), ROLES);
  assert.ok(s.workers.every((_, i) => working(s, i)));
  assert.deepEqual(s.visitor, { awake: false, percent: 0 });
  assert.equal(summary(s).signed, 0);
  assert.equal(summary(s).ready, false);
  assert.equal(s.complete, false);
});

test('MECHA: replacing somebody does not let them stop working', () => {
  const s = step(createState([99.9, 50, 50, 50, 50, 50, 50, 50]), 10);
  assert.equal(s.workers[0].percent, 100);
  assert.equal(working(s, 0), true);
  assert.equal(workerStatus(s, 0), 'VALIDATING REPLACEMENT');
  near(s.workers[1].percent, 50 + 10 * REPLACEMENT_PER_SECOND);
  const off = divert(s, 0).state;
  assert.equal(working(off, 0), false);
  assert.equal(off.workers[0].percent, 100);
});

test('MECHA: a diverted camera gives immediate rest, then a paper; a neighbouring camera cannot restart that worker', () => {
  const initial = createState();
  assert.equal(help(initial, 0).event, 'denied');
  const off = divert(initial, 0).state;
  assert.equal(working(off, 0), false);
  assert.equal(off.attentionIndex, 0);
  assert.equal(help(step(off, REST_SECONDS - 0.01), 0).event, 'denied');
  const waiting = step(off, REST_SECONDS);
  assert.equal(waiting.workers[0].percent, initial.workers[0].percent, 'replacement progress freezes with the worker');
  assert.equal(workerStatus(waiting, 0), 'MANUAL AUTHORIZATION');
  const signed = help(waiting, 0);
  assert.equal(signed.event, 'help');
  assert.equal(summary(signed.state).signed, 1);
  const another = step(divert(signed.state, 1).state, 6);
  assert.equal(another.attentionIndex, -1, 'the visual inspection times out');
  assert.equal(working(another, 0), false, 'the first camera stays diverted');
  assert.equal(working(another, 1), false);
});

test('MECHA: returning a camera to work cancels an unfinished offer, but keeps a collected signature', () => {
  const s = step(divert(createState(), 0).state, 1);
  const restored = divert(s, 0);
  assert.equal(restored.event, 'restore');
  assert.equal(working(restored.state, 0), true);
  assert.equal(restored.state.workers[0].restTime, 0);
  const again = divert(restored.state, 0).state;
  assert.equal(help(step(again, 1), 0).event, 'denied', 'the first second of the cancelled offer is not reused');
  const signed = help(step(again, 2), 0).state;
  const backAtWork = divert(signed, 0).state;
  assert.equal(summary(backAtWork).signed, 1);
  assert.equal(backAtWork.workers[0].helped, true);
  assert.equal(working(backAtWork, 0), true);
});

test('MECHA: duplicate professions cannot complete the override, and collecting a paper twice does nothing', () => {
  let s = sign(createState(), 0);
  const again = help(s, 0);
  assert.equal(again.event, 'denied');
  assert.equal(again.state, s);
  s = sign(s, 4);
  assert.deepEqual(summary(s).roles, ['lawyer']);
  assert.equal(summary(s).signed, 1);
  assert.equal(finish(s).event, 'denied');
  assert.equal(finish(s).state.complete, false);
  s = sign(sign(s, 5), 6);
  assert.equal(summary(s).signed, 3);
  assert.equal(finish(s).event, 'denied');
});

test('MECHA: four professions enable the optional console action; completion rests every cage for the visit', () => {
  let s = createState();
  for (const i of [0, 5, 2, 7]) s = sign(s, i);
  assert.equal(summary(s).ready, true);
  assert.equal(s.complete, false, 'the player still has to use the mainframe');
  assert.equal(working(s, 1), true, 'unsigned duplicate workers are still working');
  const result = finish(s);
  assert.equal(result.event, 'complete');
  s = result.state;
  assert.equal(summary(s).working, 0);
  assert.ok(s.workers.every((w) => w.diverted));
  assert.equal(workerStatus(s, 3), 'HUMAN INPUT LOST');
  assert.equal(step(s, 3600, { visitorInside: true }), s, 'nothing quietly restarts');
  assert.equal(divert(s, 0).state, s);
  assert.equal(finish(s).state, s);
});

test('MECHA: the empty cage notices approach, records only occupancy, and retains the visitor record after they leave', () => {
  const initial = createState();
  const nearCage = step(initial, 10, { visitorNear: true });
  assert.deepEqual(nearCage.visitor, { awake: true, percent: 0 });
  const inCage = step(nearCage, 3, { visitorInside: true });
  near(inCage.visitor.percent, 3 * VISITOR_PER_SECOND);
  const left = step(inCage, 10);
  assert.deepEqual(left.visitor, inCage.visitor);
  const capped = step(left, 1000, { visitorInside: true });
  assert.equal(capped.visitor.percent, 100);
  assert.equal(capped.complete, false, 'the visitor record is independent of the optional objective');
  assert.deepEqual(initial.visitor, { awake: false, percent: 0 }, 'past states stay untouched');
});

test('MECHA: neighbouring-room ticks do not progress workers, offers, visitor capture or camera attention', () => {
  const s = divert(createState(), 0).state;
  assert.equal(step(s, 300, { inside: false, visitorNear: true, visitorInside: true }), s);
  const a = step(s, 2), b = Array.from({ length: 120 }).reduce((v) => step(v, 1 / 60), s);
  near(a.elapsed, b.elapsed);
  for (let i = 0; i < a.workers.length; i++) {
    near(a.workers[i].percent, b.workers[i].percent);
    near(a.workers[i].restTime, b.workers[i].restTime);
  }
  near(a.attentionTime, b.attentionTime);
  assert.equal(help(a, 0).event, 'help');
  assert.equal(help(b, 0).event, 'help', 'floating-point frame accumulation cannot defer the offer');
});

test('MECHA: bad inputs cannot corrupt a run, and snapshots are isolated serializable data', () => {
  assert.throws(() => createState([1, 2]), RangeError);
  assert.throws(() => createState(Array(8).fill(NaN)), RangeError);
  assert.throws(() => createState(Array(8).fill(101)), RangeError);
  const values = Array(8).fill(45), s = createState(values);
  values[0] = 90;
  assert.equal(s.workers[0].percent, 45);
  for (const dt of [-1, NaN, Infinity]) assert.throws(() => step(s, dt), RangeError);
  for (const i of [-1, 8, NaN, 0.5]) {
    assert.equal(divert(s, i).state, s);
    assert.equal(help(s, i).state, s);
  }
  const before = JSON.stringify(s);
  const next = sign(s, 0);
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(JSON.parse(JSON.stringify(next)), next);
});
