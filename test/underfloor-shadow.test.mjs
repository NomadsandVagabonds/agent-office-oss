import test from 'node:test';
import assert from 'node:assert/strict';
import { underfloorPlan } from '../public/world/backrooms/underfloor-layout.js';
import { SHADOW, createShadowState, updateShadow, shadowPose, underGrate } from '../public/world/backrooms/underfloor-shadow-behavior.js';

const plan = underfloorPlan();
const exposed = { x: 0, z: plan.crossings[0].z, y: .55 };
function run(s, seconds, player, rate = 60) {
  const events = [];
  for (let n = 0; n < Math.round(seconds * rate); n++) events.push(...updateShadow(s, 1 / rate, player, plan));
  return events;
}
function until(s, phase, player = exposed) {
  for (let n = 0; n < 600; n++) {
    if (s.phase === phase) return;
    updateShadow(s, 1 / 120, player, plan);
  }
  assert.fail(`Never entered ${phase}; reached ${s.phase}`);
}

test('the watcher gives a visible inspection and windup before a real, single catch', () => {
  const s = createShadowState(plan), events = [];
  let caughtAt;
  for (let n = 0; n < 360; n++) {
    for (const e of updateShadow(s, 1 / 60, exposed, plan)) {
      events.push(e.type);
      if (e.type === 'caught') caughtAt = s.time;
    }
  }
  assert.deepEqual(events.filter(x => ['notice', 'windup', 'reach', 'caught', 'release'].includes(x)), ['notice', 'windup', 'reach', 'caught', 'release']);
  assert.ok(caughtAt >= SHADOW.notice + SHADOW.windup + SHADOW.hitStart);
  assert.ok(caughtAt < 2.2);
  assert.equal(s.caught, false);
  assert.equal(s.phase, 'patrol');
  assert.ok(s.moving, 'the creature leaves instead of chaining unavoidable grabs');
});

test('covered boards, every refuge and distant grates block sight and catches', () => {
  for (const p of [plan.entry, plan.exit, ...plan.shelters.map(s => s.center), { x: .75, z: exposed.z }, { x: 0, z: exposed.z + .7 }]) {
    const s = createShadowState(plan);
    assert.equal(underGrate(plan, 0, p), false);
    assert.equal(run(s, 55, p).some(e => ['notice', 'caught'].includes(e.type)), false);
  }
  const s = createShadowState(plan);
  const otherOpening = { x: 0, z: plan.crossings[2].z };
  assert.equal(run(s, 5, otherOpening).some(e => e.type === 'notice'), false);
  assert.equal(underGrate(plan, 0, { ...exposed, y: 1.5 }), false);
});

test('breaking sight during inspection makes the watcher lose interest without attacking', () => {
  const s = createShadowState(plan);
  run(s, .55, exposed);
  assert.equal(s.phase, 'notice');
  assert.ok(s.awareness > .45 && s.awareness < .6);
  const events = run(s, 2, plan.shelters[0].center);
  assert.ok(events.some(e => e.type === 'lost'));
  assert.equal(events.some(e => ['windup', 'reach', 'caught'].includes(e.type)), false);
  assert.equal(s.phase, 'patrol');
});

test('a committed reach can be dodged; its locked wrist stays in the broken grate slot', () => {
  const s = createShadowState(plan), edge = { x: .4, z: exposed.z + .35 };
  until(s, 'windup', edge);
  const locked = { ...s.target };
  assert.equal(locked.x, SHADOW.slot);
  assert.equal(locked.z, edge.z);
  const events = run(s, 3, { x: -.4, z: exposed.z - .35 });
  assert.ok(events.some(e => e.type === 'reach'));
  assert.equal(events.some(e => e.type === 'caught'), false);
  assert.deepEqual(s.target, locked);
});

test('patrol covers all grates continuously and frame rates preserve encounter timing', () => {
  const s = createShadowState(plan), arrivals = new Set([0]);
  let previous = s.z;
  for (let n = 0; n < 60 * 65; n++) {
    for (const e of updateShadow(s, 1 / 60, plan.entry, plan)) if (e.type === 'arrive') arrivals.add(e.grate);
    assert.ok(Math.abs(s.z - previous) <= SHADOW.speed / 60 + 1e-8, 'no teleport between openings');
    previous = s.z;
    assert.equal(shadowPose(s, plan).x, 0);
  }
  assert.deepEqual([...arrivals].sort(), [0, 1, 2]);
  const states = [30, 60, 120].map(rate => { const q = createShadowState(plan); run(q, 2.5, exposed, rate); return q; });
  for (const q of states.slice(1)) {
    assert.equal(q.phase, states[0].phase);
    assert.equal(q.caught, states[0].caught);
    assert.ok(Math.abs(q.phaseTime - states[0].phaseTime) < 1e-8);
  }
});

test('stall and invalid deltas cannot jump past the warning or poison animation values', () => {
  const s = createShadowState(plan);
  updateShadow(s, 30, exposed, plan);
  assert.ok(s.time <= .25 + 1e-8);
  assert.equal(s.phase, 'notice');
  const time = s.time;
  for (const dt of [NaN, Infinity, -1, 0]) assert.deepEqual(updateShadow(s, dt, exposed, plan), []);
  assert.equal(s.time, time);
  for (const value of Object.values(shadowPose(s, plan))) if (typeof value === 'number') assert.ok(Number.isFinite(value));
});
