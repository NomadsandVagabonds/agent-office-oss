import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three.module.min.js';
import { SHADOW, away, watched } from '../public/world/backrooms/cast/shadow.rule.js';
import { createCameraBattery } from '../public/world/backrooms/camera-state.js';
import { createTally } from '../public/world/backrooms/tally.js';

const sense = (extra = {}) => ({ placed: true, looked: true, exposed: true, d: 6, ...extra });
const lurking = () => watched({ ...away(() => .5, true), t: 0 }, 1 / 60, sense({ looked: false, exposed: false }), () => .5);
const arm = () => watched(lurking(), SHADOW.charge, sense(), () => .5);

test('a brief glance or repeated cooled glances never dismisses the shadow', () => {
  let s = lurking();
  for (let i = 0; i < 30; i++) {
    s = watched(s, .15, sense(), () => .5);
    assert.equal(s.mode, 'lurk'); assert.ok(s.heat > 0 && s.heat < 1);
    assert.ok(!s.armed && !s.cleared && !s.burst);
    s = watched(s, .2, sense({ looked: false, exposed: false }), () => .5);
    assert.equal(s.mode, 'lurk'); assert.equal(s.heat, 0);
    assert.ok(!s.armed && !s.cleared && !s.burst);
  }
});

test('arming gives a distinct white fuse; frame carryover is charged exactly once', () => {
  let s = arm();
  assert.equal(s.mode, 'armed'); assert.equal(s.heat, 1); assert.equal(s.armed, true);
  assert.ok(Math.abs(s.t - SHADOW.fuse) < 1e-8);
  s = watched(s, .1, sense(), () => .5);
  assert.ok(s.mode === 'armed' && s.heat === 1 && !s.armed && !s.burst);
  const coarse = watched(lurking(), SHADOW.charge + .2, sense(), () => .5);
  assert.equal(coarse.mode, 'armed'); assert.ok(Math.abs(coarse.t - (SHADOW.fuse - .2)) < 1e-8);
  assert.ok(watched(lurking(), SHADOW.charge + SHADOW.fuse + .1, sense(), () => .5).burst, 'a coarse frame cannot dodge the full timer');
});

test('an armed shadow clears only off the whole picture at expiry, and only once', () => {
  let s = arm();
  s = watched(s, SHADOW.fuse * .6, sense({ looked: false, exposed: false }), () => .5);
  assert.equal(s.mode, 'armed'); assert.equal(s.heat, 1); assert.ok(!s.cleared);
  s = watched(s, SHADOW.fuse, sense({ looked: false, exposed: false }), () => .5);
  assert.ok(s.mode === 'gone' && s.cleared && !s.burst && !s.shift);
  for (let i = 0; i < 100; i++) {
    s = watched(s, 10, sense({ d: 0 }), () => .5);
    assert.ok(s.mode === 'gone' && !s.cleared && !s.armed && !s.burst && !s.shift, 'terminal state emits no more encounter events');
  }
  const edge = watched(arm(), SHADOW.fuse + .01, sense({ looked: false, exposed: true }), () => .5);
  assert.ok(edge.burst && !edge.cleared && edge.mode === 'away', 'moving it out of the reticle but leaving it on screen is unsafe');
});

test('looking back, backing out of range, or touching it cannot evade an armed burst', () => {
  let s = watched(arm(), SHADOW.fuse * .4, sense({ looked: false, exposed: false }), () => .5);
  s = watched(s, SHADOW.fuse, sense(), () => .5);
  assert.ok(s.burst && s.mode === 'away' && s.t >= SHADOW.gone[0]);
  const far = watched(arm(), SHADOW.fuse + .01, sense({ d: SHADOW.far + 10 }), () => .5);
  assert.ok(far.burst, 'range limits charging, not the threat after it is armed');
  for (const start of [lurking(), arm()]) {
    const contact = watched(start, .01, sense({ looked: false, exposed: false, d: SHADOW.touch - .01 }), () => .5);
    assert.ok(contact.burst && !contact.cleared && contact.mode === 'away');
  }
});

test('armed countdown cannot relocate, cool, or stall when its placement changes', () => {
  let s = watched({ ...lurking(), t: .01 }, SHADOW.charge, sense(), () => .5);
  assert.equal(s.mode, 'armed'); assert.ok(!s.shift);
  s = watched(s, .2, sense({ placed: false, looked: false, exposed: false, d: Infinity }), () => .5);
  assert.ok(s.mode === 'armed' && s.heat === 1 && !s.shift && Math.abs(s.t - (SHADOW.fuse - .2)) < 1e-8);
  s = watched(s, SHADOW.fuse, sense({ placed: false, looked: false, exposed: false, d: Infinity }), () => .5);
  assert.ok(s.mode === 'gone' && s.cleared, 'the armed fuse resolves even without a current placement');
  const legacy = watched(arm(), SHADOW.fuse + .01, { placed: true, looked: true, d: 6 }, () => .5);
  assert.ok(legacy.burst, 'older callers without exposed fall back to looked');
});

// Exercise the production controller with the real Three scene graph and
// the real battery/tally. Geometry baking alone is replaced; there is no GPU.
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const controllerUrl = new URL('../public/world/backrooms/cast/shadow.js', import.meta.url);
const kitUrl = moduleUrl('export class Batch { addVox() {} } export const lamp = () => ({});');
const source = readFileSync(controllerUrl, 'utf8').replace(/from '([^']+)'/g, (_, spec) => `from '${spec === 'three' ? new URL('../public/vendor/three.module.min.js', import.meta.url).href : spec === '../kit.js' ? kitUrl : new URL(spec, controllerUrl).href}'`);
const { create } = await import(moduleUrl(source));

function setup(t) {
  const scene = new THREE.Scene(), camera = createCameraBattery(), tally = createTally({ seed: 'shadow-test', of: 3 });
  const geometry = new THREE.BufferGeometry(), material = new THREE.ShaderMaterial({ uniforms: { uTint: { value: new THREE.Vector3() } } });
  const me = { x: 0, z: 0, yaw: 0, pitch: 0 };
  const room = { id: 0, def: { doors: [] }, rect: { x0: -5, z0: -5, x1: 5, z1: 5 } };
  const calls = { drain: [], lights: [], survived: 0, sounds: [], met: 0 };
  let screen = 'off', lineOfSight = true;
  const env = { world: { roomAt: () => room, throats: [], floorY: () => 0, setLights: (r, value) => calls.lights.push(value) },
    kit: { model: () => ({ solid: {} }), geometry: () => geometry, surface: () => material },
    interfere() {}, hud: { glitch() {} }, sound: { play: name => calls.sounds.push(name) },
  };
  const shadow = create({ env, R: () => .5, me: () => me, add: mesh => scene.add(mesh),
    walk: { stand: () => true }, hidden: () => screen === 'off', los: () => lineOfSight,
    drawn: () => true, light: () => [.3, .3, .3], play() {},
    drain: share => { calls.drain.push(share); return camera.drain(share); },
    met: () => { calls.met++; tally.met('shadow'); },
    survived: () => { calls.survived++; tally.survived('shadow'); },
  });
  shadow.ready(); shadow.hurry(); shadow.update(1 / 60); shadow.update(1 / 60);
  assert.equal(shadow.at().mode, 'lurk');
  t.after(() => { shadow.dispose(); geometry.dispose(); material.dispose(); });
  const fixture = { shadow, scene, camera, tally, calls, me, material,
    look(where) {
      screen = where;
      const at = shadow.at();
      me.yaw = Math.atan2(-(at.x - me.x), -(at.z - me.z)) + (where === 'off' ? Math.PI : where === 'edge' ? .6 : 0);
    },
    sight(value) { lineOfSight = value; },
    tick(seconds) { let left = seconds; while (left > 1e-9) { const dt = Math.min(1 / 60, left); shadow.update(dt); left -= dt; } },
    arm() { this.look('center'); this.tick(SHADOW.charge + .02); assert.equal(shadow.at().mode, 'armed'); },
  };
  return fixture;
}

test('controller: armed is visibly white, then successful aversion removes it without battery loss/darkness and awards one survival', t => {
  const f = setup(t); f.arm();
  assert.equal(f.scene.children[0].visible, true, 'the armed model must not disappear during the skill window');
  assert.equal(f.shadow.at().heat, 1); assert.ok(f.material.uniforms.uTint.value.x > 1, 'the white state reads through the camcorder');
  const at = f.shadow.at(); f.look('off'); f.tick(.2);
  assert.equal(f.shadow.at().x, at.x); assert.equal(f.shadow.at().z, at.z); assert.equal(f.shadow.at().mode, 'armed');
  f.tick(SHADOW.fuse);
  assert.equal(f.shadow.at().mode, 'gone'); assert.equal(f.scene.children[0].visible, false);
  assert.deepEqual(f.calls.drain, []); assert.deepEqual(f.calls.lights, []); assert.equal(f.camera.read().remaining, 300);
  assert.equal(f.calls.survived, 1); assert.equal(f.tally.report().cast.survived, 1);
  f.shadow.hurry(); f.tick(SHADOW.gone[1] * 2);
  assert.equal(f.shadow.at().mode, 'gone'); assert.equal(f.calls.survived, 1); assert.equal(f.scene.children[0].visible, false);
});

test('controller: peripheral viewing is still exposed; failed armed fuse drains once, darkens, and respawns normally', t => {
  const f = setup(t); f.arm(); f.look('edge'); f.tick(SHADOW.fuse);
  assert.equal(f.shadow.at().mode, 'away'); assert.equal(f.scene.children[0].visible, false);
  assert.deepEqual(f.calls.drain, [.5]); assert.equal(f.camera.read().remaining, 150);
  f.tick(.2); // past the initial flash, into the dark interval
  assert.ok(f.calls.lights.some(value => value < 1)); assert.equal(f.calls.survived, 0);
  f.tick(SHADOW.dark + 1);
  assert.deepEqual(f.calls.drain, [.5]); assert.equal(f.calls.lights.at(-1), 1, 'failure darkness restores the room');
  f.look('off'); f.shadow.hurry(); f.shadow.update(1 / 60); f.shadow.update(1 / 60);
  assert.equal(f.shadow.at().mode, 'lurk', 'only failure returns after a cooldown');
});

test('controller: a short glance cannot farm survival; loss of line of sight during the armed window is safe', t => {
  const f = setup(t); f.look('center'); f.tick(.15); f.look('off'); f.tick(2);
  assert.equal(f.shadow.at().mode, 'lurk'); assert.equal(f.calls.survived, 0);
  f.arm(); f.sight(false); f.tick(SHADOW.fuse);
  assert.equal(f.shadow.at().mode, 'gone'); assert.equal(f.calls.survived, 1);
  assert.deepEqual(f.calls.drain, []); assert.deepEqual(f.calls.lights, []);
});
