import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three.module.min.js';
import { MOTH } from '../public/world/backrooms/cast/moth.rule.js';

const directory = new URL('../public/world/backrooms/', import.meta.url);
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
// Exercise the real lifecycle without meshing the room residents. Their
// behaviour and voxel rigs have their own tests; arrival must not tick them.
const residentsSource = readFileSync(new URL('denizens.js', directory), 'utf8')
  .replace("'./gen.js'", JSON.stringify(new URL('gen.js', directory).href))
  .replace("import { populateAbsorbed } from './absorbed.js';", 'const populateAbsorbed = env => env.populateForTest?.();');
const { createDenizens } = await import(moduleUrl(residentsSource));

function world() {
  const rooms = [0, 1, 2].map(id => ({ id, group: { visible: id < 2 } }));
  return {
    rooms, scene: new THREE.Scene(),
    roomAt: x => rooms[x < 10 ? 0 : x < 20 ? 1 : 2],
    current: () => rooms[0], distances: () => new Map([[0, 0], [1, 2], [2, 7]]),
    floorY: () => 2, lightAt: () => [0.2, 0.3, 0.4],
  };
}

test('arrival: residents are placed and culled before a fall can render them, without ticking their behaviour', () => {
  const env = { level: { seed: 'arrival', depth: 1 }, player: { me: {} } };
  const residents = createDenizens(env), group = new THREE.Group();
  let ticks = 0, light;
  const worker = residents.add({ x: 12, z: -8, y: 3, lift: 0.4, group,
    light: rgb => { light = rgb; }, update() { ticks++; worker.x = 24; } });
  assert.equal(group.visible, false, 'a resident registered while the floor builds stays out of the picture');
  assert.equal(group.parent, null);

  env.world = world();
  let absorbed;
  env.populateForTest = () => {
    absorbed = residents.add({ x: 25, z: 7, group: new THREE.Group(), update() { ticks++; } });
    assert.deepEqual(absorbed.group.position.toArray(), [25, 2, 7], 'a late-created office avatar has its location before it joins the scene');
    assert.equal(absorbed.group.visible, false, 'the distant room is not drawn');
  };
  for (const ready of env.ready) ready();
  assert.equal(group.parent, env.world.scene);
  assert.deepEqual(group.position.toArray(), [12, 3.4, -8]);
  assert.equal(group.visible, true);
  assert.deepEqual(light, [0.2, 0.3, 0.4]);
  assert.equal(ticks, 0, 'arrival does not wake, attack, or advance anyone');

  env.world.rooms[1].group.visible = false;
  residents.sync();
  assert.equal(group.visible, false, 'entering the landing refreshes culling without an AI tick');
  assert.equal(ticks, 0);
  env.world.rooms[1].group.visible = true;
  worker.visible = false;
  residents.sync();
  assert.equal(group.visible, false, 'dormant residents remain hidden even in visible rooms');
  worker.visible = true;
  residents.update(0.1, 1);
  assert.equal(ticks, 2);
  assert.deepEqual(group.position.toArray(), [24, 3.4, -8], 'normal walking still changes the rendered location');
  assert.equal(group.visible, false, 'walking into a distant room culls the resident');
  worker.gone = true;
  worker.x = 2;
  residents.sync();
  assert.equal(group.visible, false, 'a gone resident cannot reappear on a presentation refresh');
});

// Keep Three's real transform/visibility contract; mesh batching can be
// empty here because the regression is a group at the wrong coordinates.
const mothSource = readFileSync(new URL('cast/moth.js', directory), 'utf8')
  .replace("'three'", JSON.stringify(new URL('../public/vendor/three.module.min.js', import.meta.url).href))
  .replace("'../gen.js'", JSON.stringify(new URL('gen.js', directory).href))
  .replace("'./moth.rule.js'", JSON.stringify(new URL('cast/moth.rule.js', directory).href))
  .replace("import { Batch } from '../kit.js';", 'class Batch { box() {} quad() {} }');
const { create: createMoth } = await import(moduleUrl(mothSource));

test('arrival: a frozen moth appears by its ceiling lamp, never at the landing origin', () => {
  const level = {
    rooms: [{ id: 0, cx: 0, cz: 0, rot: 0, H: 3, y: 0, panels: [{ x: 18, z: -6, state: 'on' }] }],
    links: [], start: { room: 0 }, exit: { room: 0 },
  };
  const scene = new THREE.Scene(), material = new THREE.MeshBasicMaterial();
  const env = { level, world: { floorY: () => 4 }, kit: {
    tex: { white: () => null }, surface: () => material, geometry: () => new THREE.BufferGeometry(),
  } };
  let walker;
  const moth = createMoth({ env, walk: { spotIn: () => ({ x: 18, z: -6 }), stand: () => true },
    drawn: at => { walker = { ...at }; return false; },
    add: group => {
      assert.deepEqual(group.position.toArray(), [18 + MOTH.round, 6.3, -6], 'position exists before scene attachment');
      scene.add(group);
    },
    me: () => assert.fail('ready must not run the moth behaviour'),
  });
  moth.ready();
  assert.deepEqual([walker.x, walker.z], [18, -6]);
  assert.equal(scene.children[0].visible, false, 'a lamp in a hidden room does not reveal its moth during the drop');
  assert.equal(moth.at().mode, 'round');
  moth.dispose();
  assert.equal(scene.children.length, 0);
  material.dispose();
});
