import test from 'node:test';
import assert from 'node:assert/strict';
import { createFurnitureGrip, furnitureTarget } from '../public/world/backrooms/furniture-grip.js';
import { createFurnitureMotion } from '../public/world/backrooms/furniture-motion.js';
import { createPlayer } from '../public/world/backrooms/player.js';

function fixture(type = 'chair') {
  const item = { id: 'chair', type, x: 0, z: 0, x0: -.3, x1: .3, z0: -.3, z1: .3, y: 0, top: .9, group: { visible: true, position: { y: 0 } } };
  item.collider = { x0: item.x0, x1: item.x1, z0: item.z0, z1: item.z1, on: true };
  item.translate = (dx, dz, dy = 0) => {
    item.x += dx; item.z += dz;
    for (const b of [item, item.collider]) { b.x0 += dx; b.x1 += dx; b.z0 += dz; b.z1 += dz; }
    item.y += dy; item.top += dy; item.group.position.y += dy;
    item.collider.on = !item.carried;
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

test('furniture grip: walking carries player and chair together; releasing restores ordinary walking', () => {
  const f = fixture(); f.grip.update(0, f.player.me);
  assert.equal(f.grip.use(), true); assert.equal(f.player.me.gripSpeed, 1.1);
  const gap = f.player.me.z - f.item.z;
  f.input.keys.add('w'); f.tick(20);
  assert.ok(f.item.z < -.7); assert.ok(Math.abs(f.player.me.z - f.item.z - gap) < 1e-8);
  f.input.keys.clear(); f.input.keys.add('s'); f.tick(40);
  assert.ok(f.item.z > .6); assert.ok(Math.abs(f.player.me.z - f.item.z - gap) < 1e-8);
  f.grip.use(); const before = f.item.z;
  f.tick(10); assert.equal(f.item.z, before); assert.equal(f.player.me.gripSpeed, undefined);
});

test('furniture grip: a wall behind the carrier stops their body and the prop stays with them', () => {
  const f = fixture(); f.grip.update(0, f.player.me); f.grip.use();
  const gap = f.player.me.z - f.item.z;
  f.walls.push({ x0: -3, x1: 3, z0: 1.6, z1: 1.7 });
  f.input.keys.add('s'); f.tick(60);
  assert.ok(f.player.me.z <= 1.38); assert.ok(f.item.z <= 1.38 - gap + 1e-8);
  assert.ok(Math.abs(f.player.me.z - f.item.z - gap) < 1e-8);
  const old = f.item.z; f.tick(60); assert.equal(f.item.z, old, 'holding into a wall cannot move furniture without its holder');
});

test('furniture grip: a heavy desk limits sprinting and automatically lets go when the player cannot act', () => {
  const f = fixture('desk'); f.grip.update(0, f.player.me); f.grip.use();
  const start = f.item.z;
  f.input.keys.add('w'); f.input.keys.add('Shift'); f.tick(20);
  assert.ok(start - f.item.z > .3 && start - f.item.z < .46);
  f.grip.update(.05, f.player.me, false);
  assert.equal(f.grip.held, null); assert.equal(f.grip.target, null); assert.equal(f.player.me.gripSpeed, undefined);
});

test('furniture grip: no-trap rescue does not turn an identical visible chair into an immovable exception', () => {
  const f = fixture(); f.item.collider.on = false;
  f.grip.update(0, f.player.me); assert.equal(f.grip.target, f.item); f.grip.use();
  f.input.keys.add('w'); f.tick(4);
  assert.ok(f.item.z < .2); assert.equal(f.item.collider.on, false);
  assert.equal(f.grip.use(), true); assert.equal(f.item.collider.on, true);
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

test('furniture grip: blocked player movement leaves the carried prop in place and disappearing rooms release the hold', () => {
  const f = fixture(); f.item.collider.on = false;
  f.grip.update(0, f.player.me); f.grip.use();
  const before = f.item.z;
  assert.equal(f.grip.step(0, -.03, () => false), false);
  assert.equal(f.item.z, before); assert.equal(f.item.collider.on, false);
  f.item.away = 'room'; f.grip.update(.05, f.player.me);
  assert.equal(f.grip.held, null); assert.equal(furnitureTarget(f.world, f.player.me), null);
});


test('carried furniture never calls the collision solver, follows a turn, and cannot be shoved by a creature', () => {
  const f = fixture();
  const motion = createFurnitureMotion(f.world);
  f.grip.update(0, f.player.me); f.grip.use();
  f.player.me.yaw = Math.PI / 2;
  f.grip.update(.05, f.player.me);
  assert.ok(f.item.x < f.player.me.x - 1);
  assert.ok(Math.abs(f.item.z - f.player.me.z) < 1e-8);
  assert.equal(f.item.collider.on, false);
  assert.ok(f.item.group.position.y > 0, 'the prop floats slightly off the floor');
  assert.equal(motion.move(f.item, .1, 0).moved, false);
  assert.equal(motion.shove(f.item, { x: f.item.x - .4, z: f.item.z, r: .2 }, .1).moved, false);
  const before = f.player.me.x;
  f.input.keys.add('w'); f.tick(10);
  assert.ok(f.player.me.x < before - .3);
});

test('a carried chair may clip a partition, but only the person stops and release cannot put it through the wall', () => {
  const f = fixture(); f.grip.update(0, f.player.me); f.grip.use();
  f.walls.push({ x0: -.01, x1: .01, z0: -4, z1: .5 });
  const before = f.player.me.z;
  f.input.keys.add('w'); f.tick(7);
  assert.ok(f.player.me.z < before - .25, 'chair against wall does not block its carrier');
  assert.equal(f.item.collider.on, false);
  assert.equal(f.grip.use(), false, 'there is no reachable safe drop on this side yet');
  assert.equal(f.grip.held, f.item);
  assert.equal(f.grip.blocked, true);
  f.tick(30);
  assert.ok(f.player.me.z >= .72, 'the player still stops at the partition');
  f.input.keys.clear(); f.input.keys.add('s'); f.tick(30);
  assert.equal(f.grip.use(), true, 'can walk back to make room, then set it down');
  assert.equal(f.item.carried, false); assert.equal(f.item.collider.on, true);
  assert.ok(Math.abs(f.item.group.position.y) < 1e-8);
});


test('forced release clears the hold safely even when no placement ahead fits', () => {
  const f = fixture(); f.grip.update(0, f.player.me); f.grip.use();
  f.input.keys.add('w'); f.tick(20);
  // A room change or a menu may force release. Do not re-enable the restored
  // chair inside someone now standing at the original pickup point.
  f.player.me.x = 0; f.player.me.z = 0;
  f.walls.push({ x0: -4, x1: 4, z0: -2, z1: -.3 });
  assert.equal(f.grip.release(), true);
  assert.equal(f.grip.held, null); assert.equal(f.player.me.gripSpeed, undefined);
  assert.equal(f.item.x, 0); assert.ok(Math.abs(f.item.z) < 1e-8);
  assert.equal(f.item.collider.on, false);
  assert.equal(f.item.carried, false);
  assert.ok(Math.abs(f.item.group.position.y) < 1e-8);
});
