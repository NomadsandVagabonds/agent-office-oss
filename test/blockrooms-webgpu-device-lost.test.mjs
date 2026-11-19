// A lost WebGPU device (engine/gpu-recover.js, used by engine/stage.js openStage): the visit goes on, the stage stops
// drawing while it finds another device, and a picture comes back, from a fresh WebGPU device or from WebGL 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecovery, RECOVERY_STEPS } from '../public/world/engine/gpu-recover.js';

/** A stand-in for the stage: backends that hold or are lost, a frame loop that draws only while it may. */
function rig(behaviour) {
  const log = [];
  let backend = 'webgpu', alive = true, pictures = 0;
  let recovery = null;
  const attempt = async (kind) => {
    log.push(kind);
    const how = behaviour[kind]?.shift?.() ?? behaviour[kind];
    if (how === 'throws') throw new Error('no adapter');
    if (how === 'no') return false;
    backend = kind; alive = true;
    if (how === 'lost-at-first-frame') { await null; alive = false; recovery.lost({ api: 'WebGPU', message: 'again' }); }
    return true;
  };
  recovery = createRecovery({ attempt, onChange: (s) => log.push(`state:${s}`) });
  return {
    log, recovery,
    lose() { alive = false; return recovery.lost({ api: 'WebGPU', message: 'A valid external Instance reference no longer exists.' }); },
    frame() { if (recovery.drawing && alive) pictures++; },
    get pictures() { return pictures; }, get backend() { return backend; },
  };
}

test('a lost device leads to a picture: a fresh WebGPU device when one holds', async () => {
  const r = rig({ webgpu: ['ok'] });
  r.frame(); assert.equal(r.pictures, 1);
  const done = r.lose();
  r.frame(); assert.equal(r.pictures, 1, 'nothing is drawn while it recovers');
  assert.equal(await done, 'webgpu');
  r.frame(); r.frame();
  assert.equal(r.pictures, 3, 'and the picture comes back');
  assert.equal(r.backend, 'webgpu');
});

test('a lost device leads to a picture: WebGL 2 when WebGPU will not hold (the software adapter here, lost at its first frame)', async () => {
  const r = rig({ webgpu: ['lost-at-first-frame'], webgl2: ['ok'] });
  assert.equal(await r.lose(), 'webgl2');
  r.frame();
  assert.equal(r.pictures, 1);
  assert.deepEqual(r.log.filter((l) => !l.startsWith('state:')), ['webgpu', 'webgl2']);
  assert.deepEqual(r.log.filter((l) => l.startsWith('state:')), ['state:recovering', 'state:webgl2'], 'one recovery, not one for each word of the loss');
});

test('an attempt that throws, or says no, is passed over; a later loss goes on down the list', async () => {
  const r = rig({ webgpu: ['throws'], webgl2: ['ok', 'ok'] });
  assert.equal(await r.lose(), 'webgl2');
  assert.equal(await r.lose(), 'webgl2');                     // (a WebGL 2 canvas lost too: one more)
  r.frame(); assert.equal(r.pictures, 1);
});

test('when nothing holds, it says so and stops drawing (the page falls back to the WebGL renderer at the start)', async () => {
  const r = rig({ webgpu: 'no', webgl2: 'no' });
  assert.equal(await r.lose(), null);
  assert.equal(r.recovery.state, 'failed');
  assert.equal(r.recovery.drawing, false);
  assert.deepEqual(r.log.filter((l) => !l.startsWith('state:')), [...RECOVERY_STEPS]);
  assert.equal(await r.lose(), null, 'and a loss after that changes nothing');
});
