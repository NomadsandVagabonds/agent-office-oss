import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKROOMS_DEFAULTS, cleanBackroomsSettings } from '../core/backrooms-settings.mjs';
import { createPlayer } from '../public/world/backrooms/player.js';

test('older camcorder preferences gain safe defaults without losing mute or picture mode', () => {
  assert.deepEqual(cleanBackroomsSettings({ vhs:0, mute:true }), { ...BACKROOMS_DEFAULTS, vhs:0, mute:true });
  for (const value of [null, [], 'broken', 7]) assert.deepEqual(cleanBackroomsSettings(value), BACKROOMS_DEFAULTS);
  assert.deepEqual(cleanBackroomsSettings({ musicVolume:NaN, sfxVolume:'loud', sensitivity:Infinity, vhs:9, mute:'false', invertY:'false', steadyLighting:'false' }), BACKROOMS_DEFAULTS);
  assert.deepEqual(cleanBackroomsSettings({ musicVolume:-4, sfxVolume:12, sensitivity:0, invertY:true }),
    { ...BACKROOMS_DEFAULTS, musicVolume:0, sfxVolume:1, sensitivity:.25, invertY:true });
  assert.equal(cleanBackroomsSettings({ sensitivity:50 }).sensitivity, 2);
  assert.equal(cleanBackroomsSettings({ steadyLighting:true }).steadyLighting, true);
});

function playerWith(settings) {
  const world = { floorY:() => 0, free:() => true, passable:() => true, headroom:() => 3 };
  const camera = { position:{ set() {} }, rotation:{ set() {} } };
  const input = { keys:new Set(), dx:100, dy:50, stick:{ x:0,y:0 }, ...settings };
  const player = createPlayer(world, camera, { x:0,z:0,yaw:0 }, input);
  player.update(.01);
  return player;
}

test('look sensitivity and vertical inversion change mouse input without changing horizontal handedness', () => {
  const standard = playerWith({}), faster = playerWith({ sensitivity:2 }), inverted = playerWith({ sensitivity:2, invertY:true });
  assert.equal(faster.me.yaw, standard.me.yaw * 2);
  assert.equal(faster.me.pitch, standard.me.pitch * 2);
  assert.equal(inverted.me.yaw, faster.me.yaw);
  assert.equal(inverted.me.pitch, -faster.me.pitch);
  assert.equal(inverted.input.dx, 0); assert.equal(inverted.input.dy, 0);
});
