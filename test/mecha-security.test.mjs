import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_SECONDS, createSecurity, stepSecurity } from '../public/world/backrooms/rooms/mecha/security.js';
import { createState, step, divert, finish, deactivate, summary, working } from '../public/world/backrooms/rooms/mecha/rule.js';

test('MECHA security: patrol time does not spend the capture countdown', () => {
  const initial = createSecurity();
  const patrol = stepSecurity(initial, 120);
  assert.deepEqual(initial, { phase: 'patrol', elapsed: 0, remaining: CAPTURE_SECONDS });
  assert.deepEqual(patrol, { phase: 'patrol', elapsed: 120, remaining: CAPTURE_SECONDS });
  assert.equal(stepSecurity(patrol, 0), patrol);
});

test('MECHA security: capture lasts ten active seconds; further contact cannot extend it', () => {
  let s = stepSecurity(createSecurity(), 0, { caught: true });
  assert.deepEqual(s, { phase: 'captured', elapsed: 0, remaining: 10 });
  s = stepSecurity(s, 4, { caught: true });
  assert.equal(s.remaining, 6);
  s = stepSecurity(s, 5.99);
  assert.equal(s.phase, 'captured');
  s = stepSecurity(s, .01, { caught: true });
  assert.equal(s.phase, 'gameover');
  assert.equal(s.remaining, 0);
  assert.equal(stepSecurity(s, 100, { disable: true }), s, 'game over cannot silently restart');
});

test('MECHA security: neighbouring-room ticks cannot patrol, capture, shut down or spend the countdown', () => {
  const patrol = createSecurity();
  assert.equal(stepSecurity(patrol, 90, { inside: false, caught: true, disable: true }), patrol);
  const captured = stepSecurity(patrol, 2, { caught: true });
  assert.equal(stepSecurity(captured, 90, { inside: false, caught: true }), captured);
  assert.equal(stepSecurity(captured, 1).remaining, 7);
});

test('MECHA security: shutdown wins over simultaneous capture and over the final countdown tick', () => {
  const initial = createSecurity();
  const disabled = stepSecurity(initial, 12, { caught: true, disable: true });
  assert.deepEqual(disabled, { phase: 'disabled', elapsed: 0, remaining: 10 });
  assert.equal(stepSecurity(disabled, 100, { caught: true }), disabled);
  const lastMoment = stepSecurity(initial, 9.9, { caught: true });
  const stopped = stepSecurity(lastMoment, .1, { disable: true });
  assert.equal(stopped.phase, 'disabled');
  assert.equal(stopped.remaining, lastMoment.remaining);
});

test('MECHA security: capture timing is frame independent, bounded and serializable', () => {
  const initial = stepSecurity(createSecurity(), 7);
  const once = stepSecurity(initial, 10, { caught: true });
  let frames = initial;
  for (let i = 0; i < 600; i++) frames = stepSecurity(frames, 1 / 60, { caught: true });
  assert.equal(frames.phase, once.phase);
  assert.equal(frames.remaining, 0);
  assert.ok(Math.abs(frames.elapsed - once.elapsed) < 1e-9);
  assert.deepEqual(stepSecurity(initial, 1000, { caught: true }), once, 'large frames stop at the end of the countdown');
  assert.deepEqual(JSON.parse(JSON.stringify(once)), once);
  for (const dt of [-1, NaN, Infinity]) assert.throws(() => stepSecurity(initial, dt), RangeError);
  assert.deepEqual(initial, { phase: 'patrol', elapsed: 7, remaining: 10 });
});

test('MECHA: the red button shuts down training without any professional authorizations', () => {
  const initial = step(divert(createState(), 0).state, 1, { visitorInside: true });
  const before = JSON.stringify(initial);
  assert.equal(finish(initial).event, 'denied', 'the optional paper route still requires signatures');
  assert.equal(summary(initial).signed, 0);
  const result = deactivate(initial), stopped = result.state;
  assert.equal(result.event, 'complete');
  assert.match(result.message, /TECHNODETERMINISM DEACTIVATED/);
  assert.equal(stopped.complete, true);
  assert.ok(stopped.workers.every((_, i) => !working(stopped, i)));
  assert.deepEqual(stopped.workers.map(w => w.percent), initial.workers.map(w => w.percent));
  assert.equal(stopped.attentionIndex, -1);
  assert.equal(stopped.attentionTime, 0);
  assert.equal(summary(stopped).signed, 0, 'shutdown does not fabricate authorizations');
  assert.equal(step(stopped, 100, { visitorInside: true }), stopped);
  assert.equal(deactivate(stopped).state, stopped);
  assert.equal(JSON.stringify(initial), before);
});

test('MECHA security: the countdown running out costs hearts and lets go; only a spent countdown is ever let go', async () => {
  const { releaseSecurity, CAPTURE_HEARTS, MERCY_SECONDS } = await import('../public/world/backrooms/rooms/mecha/security.js');
  const { vacate } = await import('../public/world/backrooms/rooms/mecha/rule.js');
  const { ARCHETYPES } = await import('../public/world/backrooms/gen.js');
  assert.equal(ARCHETYPES.mecha.caught, CAPTURE_HEARTS, 'the deck says what the cage costs');
  assert.ok(CAPTURE_HEARTS >= 1 && CAPTURE_HEARTS <= 2 && MERCY_SECONDS >= 3);
  const spent = stepSecurity(createSecurity(), 0, { caught: true }), over = stepSecurity(spent, CAPTURE_SECONDS, { caught: true });
  assert.equal(over.phase, 'gameover');
  const free = releaseSecurity(over);
  assert.deepEqual(free, { phase: 'patrol', elapsed: CAPTURE_SECONDS, remaining: CAPTURE_SECONDS }, 'a whole countdown for the next time');
  assert.equal(stepSecurity(stepSecurity(free, 0, { caught: true }), CAPTURE_SECONDS).phase, 'gameover', 'and they can be put in it again');
  assert.equal(releaseSecurity(spent), spent, 'nobody is let out early');
  const off = stepSecurity(createSecurity(), 0, { disable: true });
  assert.equal(releaseSecurity(off), off, 'a shutdown stays a shutdown');
  // the cage reads vacant from being let out until they have walked away from it; its record of them stays
  let s = step(createState(), 4, { visitorNear: true, visitorInside: true });
  assert.equal(s.visitor.awake, true);
  const record = s.visitor.percent;
  s = vacate(s);
  assert.deepEqual(s.visitor, { awake: false, percent: record, released: true });
  s = step(s, 1, { visitorNear: true });
  assert.equal(s.visitor.awake, false, 'still standing at it: vacant');
  s = step(s, 1, {});
  assert.deepEqual(Object.keys(s.visitor), ['awake', 'percent'], 'walked away: it has forgotten letting them go');
  assert.equal(step(s, 1, { visitorNear: true }).visitor.awake, true, 'and it notices them again');
});
