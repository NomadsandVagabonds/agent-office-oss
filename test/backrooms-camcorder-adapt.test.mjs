import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CAMCORDER_ADAPT,
  createCamcorderAdapt,
  resetCamcorderAdapt,
  stepCamcorderAdapt,
  focusHuntCurve,
  targetChroma,
} from '../public/world/backrooms/camcorder-adapt.js';

function runFrames(state, sample, seconds, fps = 60) {
  const dt = 1 / fps;
  const steps = Math.round(seconds * fps);
  let maxExp = -Infinity, minExp = Infinity, maxDef = 0, maxWarm = -Infinity, minWarm = Infinity;
  for (let i = 0; i < steps; i++) {
    stepCamcorderAdapt(state, sample, dt);
    maxExp = Math.max(maxExp, state.exposure);
    minExp = Math.min(minExp, state.exposure);
    maxDef = Math.max(maxDef, state.defocus);
    const wb = state.balance[0] - state.balance[2];
    maxWarm = Math.max(maxWarm, wb);
    minWarm = Math.min(minWarm, wb);
  }
  return { maxExp, minExp, maxDef, maxWarm, minWarm };
}

test('camcorder adaptation starts settled on the first sample and resets cleanly on teleport', () => {
  const s = createCamcorderAdapt();
  stepCamcorderAdapt(s, { light: 0.02, rgb: [0.02, 0.02, 0.02], roomId: 1, torch: 0 }, 1 / 60);
  assert.equal(s.exposure, 1);
  assert.deepEqual(s.balance, [1, 1, 1]);
  assert.equal(s.defocus, 0);

  // Jump to bright room, verify reaction, then reset
  runFrames(s, { light: 0.75, rgb: [0.85, 0.78, 0.56], roomId: 2, torch: 0 }, 0.25);
  assert.ok(s.exposure > 1.1, `expected iris bloom, got ${s.exposure}`);
  resetCamcorderAdapt(s);
  assert.equal(s.exposure, 1);
  assert.deepEqual(s.balance, [1, 1, 1]);
  assert.equal(s.defocus, 0);
});

test('dark -> bright room triggers auto-iris bloom, warm white-balance lag, and 2-bump autofocus hunt that settles to neutral', () => {
  const s = createCamcorderAdapt();
  const dark = { light: 0.02, rgb: [0.02, 0.02, 0.02], roomId: 1, torch: 0 };
  const lit = { light: 0.72, rgb: [0.84, 0.77, 0.54], roomId: 2, torch: 0 };

  stepCamcorderAdapt(s, dark, 1 / 60);
  runFrames(s, dark, 0.5);

  const peak = runFrames(s, lit, 0.85);
  assert.ok(peak.maxExp > 1.25 && peak.maxExp <= CAMCORDER_ADAPT.irisMax, `expected overexposure bloom, got ${peak.maxExp}`);
  assert.ok(peak.maxWarm > 0.06, `expected warm fluorescent AWB lag, got ${peak.maxWarm}`);
  assert.ok(peak.maxDef > 0.45, `expected autofocus hunt, got ${peak.maxDef}`);

  // Settle cleanly back to neutral after staying in the lit room
  runFrames(s, lit, 8.0);
  assert.ok(Math.abs(s.exposure - 1) < 0.01, `expected exposure settled to 1, got ${s.exposure}`);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(s.balance[i] - 1) < 0.015, `expected balance[${i}] settled to 1, got ${s.balance[i]}`);
  assert.equal(s.defocus, 0, 'autofocus locks cleanly at 0');
});

test('bright -> dark room briefly underexposes, cools white balance, hunts focus, and recovers slower than dark -> bright', () => {
  const s = createCamcorderAdapt();
  const lit = { light: 0.72, rgb: [0.84, 0.77, 0.54], roomId: 2, torch: 0 };
  const dark = { light: 0.02, rgb: [0.02, 0.02, 0.02], roomId: 1, torch: 0 };

  stepCamcorderAdapt(s, lit, 1 / 60);
  runFrames(s, lit, 0.5);

  const dip = runFrames(s, dark, 0.9);
  assert.ok(dip.minExp < 0.82 && dip.minExp >= CAMCORDER_ADAPT.irisMin, `expected temporary dark crush, got ${dip.minExp}`);
  assert.ok(dip.minWarm < -0.06, `expected cool low-light AWB lag, got ${dip.minWarm}`);
  assert.ok(dip.maxDef > 0.45, `expected autofocus hunt entering dark room, got ${dip.maxDef}`);
  assert.ok(CAMCORDER_ADAPT.irisOpenTau > CAMCORDER_ADAPT.irisCloseTau, 'AGC opens slower than iris stops down');

  runFrames(s, dark, 8.0);
  assert.ok(Math.abs(s.exposure - 1) < 0.01);
  assert.equal(s.defocus, 0);
});

test('focusHuntCurve has a smooth two-bump profile bounded in [0, 1] and zero at endpoints', () => {
  assert.equal(focusHuntCurve(0), 0);
  assert.equal(focusHuntCurve(1), 0);
  const peak1 = focusHuntCurve(0.27);
  const valley = focusHuntCurve(0.56);
  const peak2 = focusHuntCurve(0.74);
  assert.ok(peak1 > 0.85, `main search peak ${peak1}`);
  assert.ok(valley < peak1 * 0.4 && valley < peak2, `valley ${valley} between peaks ${peak1} and ${peak2}`);
  assert.ok(peak2 > 0.25 && peak2 < peak1 * 0.6, `confirmation micro-pulse ${peak2}`);
});

test('targetChroma blends cool CCD bias in darkness and preserves room colour in bright rooms', () => {
  const darkC = targetChroma(0.015, [0.02, 0.02, 0.02]);
  const warmC = targetChroma(0.7, [0.9, 0.78, 0.5]);
  const tealC = targetChroma(0.7, [0.45, 0.82, 0.88]);
  assert.ok(darkC[2] > darkC[0], 'darkness leans cool');
  assert.ok(warmC[0] > warmC[2], 'yellow fluorescent leans warm');
  assert.ok(tealC[2] > tealC[0], 'poolroom teal leans cool');
});

test('vhs.js and vhs-node.js both wire uBalance and uDefocus with identity defaults', () => {
  const root = new URL('../public/world/backrooms/', import.meta.url);
  for (const file of ['vhs.js', 'vhs-node.js']) {
    const src = readFileSync(new URL(file, root), 'utf8');
    assert.ok(src.includes('uBalance'), `${file} has uBalance`);
    assert.ok(src.includes('uDefocus'), `${file} has uDefocus`);
    assert.ok(src.includes('sampleOptical'), `${file} has sampleOptical`);
  }
});
