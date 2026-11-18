// The scissors in the hand: a jab pulls back, stabs, and ends its own way for a hit, a miss and a pair that comes apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JAB, jabPose, jabLength, restPose, fallenBlade } from '../public/world/backrooms/hand-scissors.rule.js';

const sample = (outcome, step = 0.005) => {
  const out = [];
  for (let t = 0; t < jabLength(outcome); t += step) out.push({ t, ...jabPose(t, outcome) });
  return out;
};
const deepest = (s) => Math.min(...s.map((p) => p.z));

test('every jab pulls back, then goes forward, and is over at its length', () => {
  for (const o of [null, 'hit', 'miss', 'snapped']) {
    const s = sample(o);
    assert.ok(s.some((p) => p.z > 0.02), `${o}: it pulls back first`);
    assert.ok(deepest(s) < -0.15, `${o}: it goes forward`);
    assert.equal(jabPose(jabLength(o) + 0.001, o), null, `${o}: and then it is over`);
    for (const p of s) for (const k of ['x', 'y', 'z', 'pitch', 'yaw', 'roll', 'open']) assert.ok(Number.isFinite(p[k]), `${o} ${k} at ${p.t}`);
  }
});

test('a miss goes further than a hit, and comes back later', () => {
  assert.ok(deepest(sample('miss')) < deepest(sample('hit')) - 0.03);
  assert.ok(jabLength('miss') > jabLength('hit'));
});

test('a hit judders where it stopped; a miss does not', () => {
  const after = (o) => sample(o, 0.002).filter((p) => p.t > JAB.windup + JAB.thrust && p.t < JAB.windup + JAB.thrust + 0.06);
  const wobble = (s) => s.reduce((m, p, i) => (i ? Math.max(m, Math.abs(p.x - s[i - 1].x)) : m), 0);
  assert.ok(wobble(after('hit')) > wobble(after('miss')) * 2);
});

test('the blades open on the pull-back and are shut at full stretch', () => {
  const s = sample('hit', 0.002), open = Math.max(...s.filter((p) => p.t < JAB.windup + 0.01).map((p) => p.open));
  assert.ok(open > 0.8);
  const atPeak = jabPose(JAB.windup + JAB.thrust + 0.01, 'hit');
  assert.ok(atPeak.open < 0.1);
});

test('only a pair that comes apart breaks: one blade falls out of the picture, the hand goes down', () => {
  for (const o of [null, 'hit', 'miss']) assert.ok(sample(o).every((p) => p.broke === -1));
  const s = sample('snapped'), broken = s.filter((p) => p.broke >= 0);
  assert.ok(broken.length > 0 && broken[0].t >= JAB.breakAt);
  assert.ok(broken.some((p) => p.open > 1.5), 'the blade left in the hand swings past its stop');
  assert.ok(broken.at(-1).y < -0.25, 'and the hand has gone down');
  assert.ok(fallenBlade(0.6).y < -0.6, 'the loose blade has fallen out of the picture');
});

test('nothing in it is random: the same time gives the same pose', () => {
  assert.deepEqual(jabPose(0.13, 'hit'), jabPose(0.13, 'hit'));
  assert.deepEqual(restPose(), restPose());
});
