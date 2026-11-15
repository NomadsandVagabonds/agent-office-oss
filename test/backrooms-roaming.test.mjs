import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three.module.min.js';
import { generateVisit } from '../public/world/backrooms/plan.js';
import { roomDistances, toLocal } from '../public/world/backrooms/gen.js';
import { ROAMING, roamsThisFloor, roamingRooms, roamingSpots } from '../public/world/backrooms/cast/roaming.rule.js';

test('every later generated floor has seeded roaming rooms beyond the entry buffer, even behind low entrance doors', () => {
  let floors = 0, lowEntrances = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const { visit, floors: levels } = generateVisit(seed);
    assert.equal(roamsThisFloor(levels[0], visit), false);
    for (const level of levels.slice(1)) {
      floors++;
      assert.ok(roamsThisFloor(level, visit));
      const ids = roamingRooms(level), far = roomDistances(level, level.start.room);
      assert.deepEqual(ids, roamingRooms(level), `seed ${seed}, floor ${level.depth}`);
      assert.ok(ids.length && ids.some(id => roamingSpots(level, id).some(p => Math.hypot(p.x - level.start.x, p.z - level.start.z) >= ROAMING.near)));
      assert.equal(new Set(ids).size, ids.length);
      for (const id of ids) {
        const r = level.rooms[id];
        assert.ok(r.kind === 'plain' && !r.crawl && !r.lows && !r.shape && r.H >= 2.2);
        assert.ok(far.get(id) >= ROAMING.doors && id !== level.exit.room);
        assert.ok(r.doors.some(d => d.h >= ROAMING.tall && !level.rooms[d.to].crawl && level.rooms[d.to].H >= ROAMING.tall + .05));
        const spots = roamingSpots(level, id);
        assert.deepEqual(spots, roamingSpots(level, id));
        for (const p of spots) {
          const local = toLocal(r, p.x, p.z);
          assert.ok(Math.abs(local.x) <= r.W / 2 - .54 && Math.abs(local.z) <= r.D / 2 - .54, 'not in a wall');
        }
      }
      if (level.rooms[level.start.room].doors.every(d => d.h < ROAMING.tall)) lowEntrances++;
    }
  }
  assert.ok(floors > 200 && lowEntrances > 0, 'covers arrivals the pirate cannot walk out of');
});

test('roaming never overrides the first floor, a quiet visit, or an isolated/ineligible room', () => {
  const { visit, floors } = generateVisit(7);
  assert.equal(roamsThisFloor(floors[0], visit), false);
  assert.equal(roamsThisFloor(floors[1], { ...visit, mascot: null }), false);
  assert.equal(roamsThisFloor(floors[1], null), false);
  assert.deepEqual(roamingRooms(floors[1], () => Infinity), [], 'no opening the walker can use');
  for (const change of [{ crawl: true }, { shape: {} }, { lows: [{}] }, { H: 1.5 }, { kind: 'special' }]) {
    const level = { ...floors[1], rooms: floors[1].rooms.map(r => ({ ...r, ...change })) };
    assert.deepEqual(roamingRooms(level), []);
  }
});

// Run the actual pirate controller and pure hunting rules. Only geometry
// baking is replaced: the scene graph, creature lifecycle and decisions are
// real, with a small unobstructed test world instead of WebGL/furniture.
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const pirateUrl = new URL('../public/world/backrooms/cast/pirate.js', import.meta.url);
const kitUrl = moduleUrl('export class Batch { addVox() {} } export const lamp = () => ({}), lin = () => [1,1,1], drawText = () => {};');
const bitsUrl = moduleUrl(readFileSync(new URL('../public/world/backrooms/bits.js', import.meta.url), 'utf8').split('\n').filter(line => /^export const (P|clamp|turnTo) =/.test(line)).join('\n'));
const source = readFileSync(pirateUrl, 'utf8').replace(/from '([^']+)'/g, (_, spec) => `from '${spec === 'three' ? new URL('../public/vendor/three.module.min.js', import.meta.url).href : spec === '../kit.js' ? kitUrl : spec === '../bits.js' ? bitsUrl : new URL(spec, pirateUrl).href}'`);
const { create } = await import(moduleUrl(source));

function setup(t, { depth = 1, quiet = false, carried = null, plinth = false, blockedCentre = false } = {}) {
  const { visit, floors } = generateVisit('roaming-controller', { depths: 3 });
  const level = { ...floors[depth], pursuer: null, loot: null };
  const eligible = roamingRooms(level);
  if (plinth) level.pursuer = { room: eligible[0], face: 1 };
  const scene = new THREE.Group(), bodies = [], rooms = level.rooms.map(def => ({ id: def.id, def, group: { visible: true }, uses: [] }));
  const nearest = (x, z) => rooms.reduce((a, b) => Math.hypot(a.def.cx - x, a.def.cz - z) < Math.hypot(b.def.cx - x, b.def.cz - z) ? a : b);
  const geometry = new THREE.BoxGeometry(.1, .1, .1), materials = [];
  const kit = {
    own: value => value, tex: { blob: () => null }, model: () => ({ solid: {} }), geometry: () => geometry,
    surface() { const m = new THREE.ShaderMaterial({ uniforms: { uTint: { value: new THREE.Vector3(1, 1, 1) } } }); materials.push(m); return m; },
  };
  const world = { scene, bodies, rooms, throats: level.links.map(link => ({ link, open: true })), roomAt: nearest,
    floorY: (x, z) => nearest(x, z).def.y || 0, lightAt: () => [.4, .4, .4], los: () => false };
  let steps = 0, hits = 0;
  const walk = {
    cost: a => (d, from, to) => d.h >= a.tall && !level.rooms[to].crawl && level.rooms[to].H >= a.tall + .05 ? 1 : Infinity,
    stand: (a, x, z) => !blockedCentre || level.rooms.every(r => Math.hypot(r.cx - x, r.cz - z) > .4),
    spotIn: (a, id) => ({ x: rooms[id].def.cx, z: rooms[id].def.cz }),
    exits(a) { const r = nearest(a.x, a.z); return r.def.doors.filter(d => this.cost(a)(d, r.id, d.to) < Infinity).map(d => ({ room: d.to })); },
    go(a, to, distance) { steps++; const d = Math.hypot(to.x - a.x, to.z - a.z); if (d) { a.x += (to.x - a.x) / d * Math.min(d, distance); a.z += (to.z - a.z) / d * Math.min(d, distance); } return { went: distance, there: false, cannot: false }; },
    forget() {},
  };
  const env = { level, visit: quiet ? { ...visit, mascot: null, floors: visit.floors.map(f => ({ ...f, mascot: false })) } : visit, carry: carried, kit, world, clock: 0,
    player: { me: { ...level.start, pitch: 0, frozen: false } }, sees: () => false, play() {}, interfere() {},
    hud: { glitch() {} }, sound: { play() {} }, doors: { watched: () => false }, health: {},
  };
  const pirate = create({ env, level, walk, hidden: () => true, drawn: () => true, fire: () => null,
    met() {}, survived() {}, hurt() { hits++; return { landed: false, dead: false }; } });
  pirate.ready();
  t.after(() => { pirate.dispose(); geometry.dispose(); for (const m of materials) m.dispose(); });
  return { pirate, env, scene, walk, get steps() { return steps; }, get hits() { return hits; },
    tick(seconds) { for (let i = 0; i < Math.ceil(seconds * 30); i++) { env.clock += 1 / 30; pirate.update(1 / 30); } },
  };
}

test('a later floor has an awake pirate without finding its plinth; arrival grace ends in real roaming', t => {
  const f = setup(t), at = f.pirate.at();
  assert.ok(at && at.state === 'awake' && at.know === 'wander');
  assert.ok(Math.hypot(at.x - f.env.level.start.x, at.z - f.env.level.start.z) >= ROAMING.near);
  assert.ok(roomDistances(f.env.level, f.env.level.start.room).get(at.room) >= ROAMING.doors);
  f.env.player.me.frozen = true; f.tick(20);
  assert.equal(f.pirate.figure.entryGrace, ROAMING.grace, 'falling consumes none of the entry grace');
  f.env.player.me.frozen = false; f.tick(ROAMING.grace - 1);
  assert.equal(f.steps, 0); assert.equal(f.hits, 0);
  f.tick(8);
  assert.ok(f.steps > 0, 'actually walks without ever meeting the player, rather than waiting 150–260 seconds');
});

test('later floors keep exactly one body and carry its face/card; furniture at every centre does not suppress the spawn', t => {
  const f = setup(t, { carried: { awake: true, face: 4, card: true, lost: true, wait: 70 }, plinth: true, blockedCentre: true });
  const at = f.pirate.at(), p = f.pirate.figure;
  assert.ok(at && at.state === 'awake'); assert.equal(at.face, 4); assert.equal(at.card, true);
  assert.equal(f.scene.children.length, 1, 'reuses the figure already built for the plinth');
  assert.equal(p.plinth, false); assert.ok(f.walk.stand(p, p.x, p.z));
  assert.deepEqual(p.body, { x: p.x, z: p.z, r: .3 }, 'collision follows the new position immediately');
  f.tick(1); assert.equal(f.env.world.bodies.length, 1);
  f.pirate.dispose(); assert.equal(f.env.world.bodies.length, 0); assert.equal(f.scene.children.length, 0);
});

test('a first or explicitly quiet floor does not get the guaranteed roamer', t => {
  assert.notEqual(setup(t, { depth: 0 }).pirate.at()?.state, 'awake');
  assert.equal(setup(t, { quiet: true }).pirate.at(), null);
});
