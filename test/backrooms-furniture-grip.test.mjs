import test from 'node:test';
import assert from 'node:assert/strict';
import { createFurnitureGrip, furnitureTarget } from '../public/world/backrooms/furniture-grip.js';
import { createFurnitureMotion } from '../public/world/backrooms/furniture-motion.js';
import { createPlayer } from '../public/world/backrooms/player.js';

function fixture(type = 'chair') {
  const item = { id: 'chair', type, x: 0, z: 0, x0: -.3, x1: .3, z0: -.3, z1: .3, y: 0, top: .9, group: { visible: true } };
  item.collider = { x0: item.x0, x1: item.x1, z0: item.z0, z1: item.z1, on: true };
  item.translate = (dx, dz) => {
    item.x += dx; item.z += dz;
    for (const b of [item, item.collider]) { b.x0 += dx; b.x1 += dx; b.z0 += dz; b.z1 += dz; }
    item.collider.on = true;
  };
  const walls = [], room = { id: 0, def: { kind: 'plain' } };
  const world = { furniture: [item], env: {}, floorY: () => 0, headroom: () => 3, passable: () => true, roomAt: () => room,
    free(x, z, r, opt = {}) {
      for (const b of [...walls, item.collider]) {
        if (b === opt.ignoreCollider || b.on === false) continue;
        if (opt.bounds) {
          const a = opt.bounds;
          if (a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0) return false;
        } else if (Math.hypot(x - Math.max(b.x0, Math.min(x, b.x1)), z - Math.max(b.z0, Math.min(z, b.z1))) < r) return false;
      }
      return true;
    },
  };
  const input = { keys: new Set(), dx: 0, dy: 0, stick: { x: 0, y: 0 } };
  const camera = { position: { set() {} }, rotation: { set() {} } };
  const player = createPlayer(world, camera, { x: 0, z: 1.3, yaw: 0 }, input);
  Object.assign(player.me, { y: 1.1, pitch: -.4 }); world.env.player = player;
  const grip = createFurnitureGrip(world, createFurnitureMotion(world));
  player.on('move', (dx, dz, step) => grip.step(dx, dz, step));
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { grip.update(.05, player.me); player.update(.05); } };
  return { world, item, walls, grip, player, input, tick };
}

test('furniture targeting: ordinary silhouettes, range, facing and walls determine the cue', () => {
  const f = fixture();
  assert.equal(furnitureTarget(f.world, f.player.me), f.item);
  f.player.me.yaw = Math.PI;
  assert.equal(furnitureTarget(f.world, f.player.me), null);
  f.player.me.yaw = 0; f.player.me.z = 3;
  assert.equal(furnitureTarget(f.world, f.player.me), null);
  f.player.me.z = 1.3;
  f.walls.push({ x0: -1, x1: 1, z0: .6, z1: .7 });
  assert.equal(furnitureTarget(f.world, f.player.me), null, 'cannot grab through a partition');
});

test('furniture grip: walking pushes and pulls player and chair together; releasing restores ordinary walking', () => {
  const f = fixture(); f.grip.update(0, f.player.me);
  assert.equal(f.grip.use(), true); assert.equal(f.player.me.gripSpeed, 1.1);
  f.input.keys.add('w'); f.tick(20);
  assert.ok(f.item.z < -.7); assert.ok(Math.abs(f.player.me.z - f.item.z - 1.3) < 1e-8);
  f.input.keys.clear(); f.input.keys.add('s'); f.tick(40);
  assert.ok(f.item.z > .6); assert.ok(Math.abs(f.player.me.z - f.item.z - 1.3) < 1e-8);
  f.grip.use(); const before = f.item.z;
  f.tick(10); assert.equal(f.item.z, before); assert.equal(f.player.me.gripSpeed, undefined);
});

test('furniture grip: a wall behind the pulling player rolls the object back, without creep or overlap', () => {
  const f = fixture(); f.grip.update(0, f.player.me); f.grip.use();
  f.walls.push({ x0: -3, x1: 3, z0: 1.6, z1: 1.7 });
  f.input.keys.add('s'); f.tick(60);
  assert.ok(f.player.me.z <= 1.38); assert.ok(f.item.z <= .08);
  assert.ok(Math.abs(f.player.me.z - f.item.z - 1.3) < 1e-8);
  const old = f.item.z; f.tick(60); assert.equal(f.item.z, old, 'holding into a wall cannot move furniture without its holder');
});

test('furniture grip: a heavy desk limits sprinting and automatically lets go when the player cannot act', () => {
  const f = fixture('desk'); f.grip.update(0, f.player.me); f.grip.use();
  f.input.keys.add('w'); f.input.keys.add('Shift'); f.tick(20);
  assert.ok(-f.item.z > .3 && -f.item.z < .46);
  f.grip.update(.05, f.player.me, false);
  assert.equal(f.grip.held, null); assert.equal(f.grip.target, null); assert.equal(f.player.me.gripSpeed, undefined);
});

test('furniture grip: no-trap rescue does not turn an identical visible chair into an immovable exception', () => {
  const f = fixture(); f.item.collider.on = false;
  f.grip.update(0, f.player.me); assert.equal(f.grip.target, f.item); f.grip.use();
  f.input.keys.add('w'); f.tick(4);
  assert.ok(f.item.z < 0); assert.equal(f.item.collider.on, true);
});

test('furniture grip: looking below an interactive desktop moves it without taking E away from its computer', () => {
  const f = fixture('desk'); f.item.surfaceY = .65;
  f.grip.update(0, f.player.me);
  const use = { furniture: f.item };
  assert.equal(f.grip.action(use), null, 'at the tabletop, the computer keeps its interaction');
  f.player.me.pitch = -.6; f.grip.update(0, f.player.me);
  assert.equal(f.grip.action(use), f.item, 'below the tabletop, the desk can be grabbed');
  assert.equal(f.grip.action({}), null, 'other room interactions keep priority');
  f.grip.use(); assert.equal(f.grip.action({}), f.item, 'releasing cannot accidentally activate a nearby puzzle');
});

test('furniture grip: a rejected drag restores a disabled collider and disappearing rooms release the hold', () => {
  const f = fixture(); f.item.collider.on = false;
  f.grip.update(0, f.player.me); f.grip.use();
  const before = f.item.z;
  assert.equal(f.grip.step(0, -.03, () => false), false);
  assert.equal(f.item.z, before); assert.equal(f.item.collider.on, false);
  f.item.away = 'room'; f.grip.update(.05, f.player.me);
  assert.equal(f.grip.held, null); assert.equal(furnitureTarget(f.world, f.player.me), null);
});
