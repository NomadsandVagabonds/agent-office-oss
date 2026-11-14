import test from 'node:test';
import assert from 'node:assert/strict';
import { retreatFromFire, FIRE_FEAR } from '../public/world/backrooms/fire-fear.js';

function fixture() {
  let fire = { x: 0, z: 0 }, passable = () => true, floorY = () => 0;
  const actor = { x: 2, z: 0, yaw: 0, state: 'awake', noise: .5, plinth: false, to: {}, leg: 'pursuit', hold() {} };
  const env = { player: { me: { frozen: false } }, world: { floorY: (...a) => floorY(...a), passable: (...a) => passable(...a) }, inventory: { fire: { threatAt: () => fire } } };
  const move = {
    stand: () => true,
    stride(a, x, z) { a.x = x; a.z = z; },
  };
  return { actor, env, move, step: dt => retreatFromFire(env, actor, dt, move),
    fire: value => { fire = value; }, passable: value => { passable = value; }, floor: value => { floorY = value; } };
}

test('fire sends a hostile walker away, cancels its chase route and claims the attack frame', () => {
  const f = fixture(), start = f.actor.x;
  assert.equal(f.step(.05), true);
  assert.ok(f.actor.x > start); assert.ok(Math.abs(f.actor.z) < 1e-8);
  assert.equal(f.actor.to, null); assert.equal(f.actor.leg, null);
  assert.equal(f.actor.state, 'awake'); assert.equal(f.actor.fireFear.left, FIRE_FEAR.memory);
  assert.ok(Math.abs(f.actor.yaw - Math.PI / 2) < 1e-8);
});

test('a hidden or extinguished fire is forgotten after a short retreat', () => {
  const f = fixture(); f.step(.05); f.fire(null);
  assert.equal(f.step(.1), true);
  for (let i = 0; i < 15; i++) f.step(.1);
  assert.equal(f.actor.fireFear, null); assert.equal(f.step(.05), false);
});

test('walls and drops block retreat without permitting pursuit through the fire', () => {
  const f = fixture(); f.passable(() => false);
  assert.equal(f.step(.05), true); assert.equal(f.actor.x, 2); assert.equal(f.actor.z, 0);
  f.passable(() => true); f.floor((x, z) => x === 2 && z === 0 ? 0 : -2);
  assert.equal(f.step(.05), true); assert.equal(f.actor.x, 2); assert.equal(f.actor.z, 0);
});

test('caught and frozen actors, invalid frames and disabled inventory do not react', () => {
  const f = fixture(); f.actor.state = 'caught'; assert.equal(f.step(.05), false);
  f.actor.state = 'awake'; f.env.player.me.frozen = true; assert.equal(f.step(.05), false);
  f.env.player.me.frozen = false;
  for (const dt of [0, -1, NaN, Infinity]) assert.equal(f.step(dt), false);
  delete f.env.inventory; assert.equal(f.step(.05), false); assert.equal(f.actor.x, 2);
});

test('an actor on its plinth steps off away from fire only onto safe floor', () => {
  const f = fixture(); f.actor.plinth = true;
  assert.equal(f.step(.05), true); assert.equal(f.actor.plinth, false); assert.ok(f.actor.x > 2.9);
  const blocked = fixture(); blocked.actor.plinth = true; blocked.passable(() => false);
  assert.equal(blocked.step(.05), true); assert.equal(blocked.actor.plinth, true); assert.equal(blocked.actor.x, 2);
});
