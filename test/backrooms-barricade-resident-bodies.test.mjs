import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three.module.min.js';

const directory = new URL('../public/world/backrooms/', import.meta.url);
const source = readFileSync(new URL('denizens.js', directory), 'utf8')
  .replace("import { populateAbsorbed } from './absorbed.js';", 'const populateAbsorbed = () => {};')
  .replace(/from '([^']+)'/g, (_, name) => `from '${new URL(name, directory).href}'`);
const { createDenizens, stepWalker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function fixture(enabled = true) {
  const room = { id: 0, group: { visible: true } };
  const world = { bodies: [], scene: new THREE.Scene(), roomAt: () => room, floorY: () => 0,
    current: () => room, distances: () => new Map([[0, 0]]), lightAt: () => [1, 1, 1] };
  const env = { barricadesEnabled: enabled, level: { seed: 7 }, world, player: { me: {} } };
  return { world, env, denizens: createDenizens(env) };
}

test('resident physical bodies follow live coordinates, survive culling, and leave with their room', () => {
  const { world, denizens } = fixture();
  const resident = denizens.add({ x: 2, z: 3, r: .3, group: new THREE.Group() });
  assert.equal(world.bodies.length, 1);
  const body = world.bodies[0];
  assert.deepEqual([body.x, body.z, body.r, body.on], [2, 3, .3, true]);
  resident.x = 5; resident.z = 7; resident.group.visible = false;
  assert.deepEqual([body.x, body.z, body.on], [5, 7, true], 'render culling must not let a desk through a creature');
  denizens.takeAway(x => x > 4, 'fold:one');
  assert.equal(body.on, false);
  denizens.bringBack('another-fold'); assert.equal(body.on, false);
  denizens.bringBack('fold:one'); assert.equal(body.on, true);
  resident.gone = true; assert.equal(body.on, false);
  denizens.dispose(); assert.equal(world.bodies.length, 0);
});

test('a hanging resident becomes solid only when grounded, and the feature stays opt-in', () => {
  const { world, denizens, env } = fixture();
  const trunk = denizens.add({ x: 0, z: 0, physical: false, group: new THREE.Group() });
  const body = world.bodies[0];
  assert.equal(body.on, false);
  trunk.physical = true; assert.equal(body.on, true);
  trunk.visible = false; assert.equal(body.on, false);
  for (const ready of env.ready) ready();
  assert.equal(world.bodies.length, 1, 'ready does not duplicate a resident already registered during building');
  const off = fixture(false); off.denizens.add({ x: 0, z: 0, group: new THREE.Group() });
  assert.equal(off.world.bodies.length, 0);
  denizens.dispose(); off.denizens.dispose();
});

test('resident sweep cannot step across a thin barricade between clear endpoints', () => {
  const world = { free: () => true, headroom: () => 3, passable: () => true,
    furnitureColliders: [{ x0: .01, x1: .011, z0: -10, z1: 10 }] };
  const resident = { x: 0, z: 0, r: .001, tall: 1.5 };
  stepWalker(world, resident, 1, 0, .085);
  assert.ok(resident.x < .01, 'a movement query checks its whole segment, not only its destination');
});
