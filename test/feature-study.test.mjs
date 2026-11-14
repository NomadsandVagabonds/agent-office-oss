import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE_STUDIES, generateFeatureStudy } from '../public/world/backrooms/feature-study.js';
import { generate, DECK, T, DOOR_H, toWorld, toLocal, wallPoint, wallLength, roomDistances, roomPath, sketch, fitsAt } from '../public/world/backrooms/gen.js';

const seeds = [7, 22, 41, 713, 'late again'];
const ids = ['underfloor', 'flood-mark', 'window-court'];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('feature fixture is deterministic serializable data, isolated from normal generation', () => {
  const deck = JSON.stringify(DECK);
  for (const seed of seeds) {
    const original = generate(seed), options = { name: 'Robin', agents: ['Aster'], projects: ['Archive'], tasks: ['A task'] };
    for (const id of ids) {
      const first = generateFeatureStudy(id, seed, options);
      assert.deepEqual(first, generateFeatureStudy(id, seed, options));
      assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
      assert.deepEqual(first.cast, ['Aster']); assert.deepEqual(first.projects, ['Archive']);
      assert.equal(first.name, 'Robin'); assert.equal(first.seed, String(seed));
      assert.deepEqual(generate(seed), original);
      assert.equal(first.rooms[1].params.studySeed, `feature-study:${id}:${seed}`);
    }
  }
  assert.equal(JSON.stringify(DECK), deck);
  assert.ok(ids.every(id => !DECK.some(entry => entry.id === id)));
  assert.throws(() => generateFeatureStudy('unknown', 1), RangeError);
  assert.throws(() => generateFeatureStudy('toString', 1), RangeError);
});

test('each fixture contains only its candidate and two safe ordinary annexes', () => {
  for (const id of ids) for (const seed of seeds) {
    const level = generateFeatureStudy(id, seed, { count: 9, only: ['freight'], pursuer: true, loot: { card: true, coins: [1, 2] } });
    const [entry, feature, exit] = level.rooms, size = FEATURE_STUDIES[id];
    assert.equal(level.rooms.length, 3); assert.deepEqual(level.picked, [id]);
    assert.equal(entry.kind, 'plain'); assert.equal(entry.arch, null);
    assert.equal(feature.kind, 'special'); assert.equal(feature.arch, id);
    assert.equal(exit.kind, 'exit'); assert.equal(exit.arch, null);
    near(feature.W, size.W); near(feature.D, size.D); near(feature.H, size.H);
    for (const annex of [entry, exit]) { near(annex.W, 5.8); near(annex.D, 5.8); near(annex.H, 2.6); }
    assert.equal(level.pursuer, null); assert.equal(level.loot, undefined); assert.deepEqual(level.windows, []);
    assert.deepEqual(level.featureStudy, { version: 1, id, feature: 1 });
    for (const room of level.rooms) {
      assert.equal(room.y, 0); assert.equal(room.rot, 0); assert.equal(room.shape, null);
      assert.deepEqual(room.pillars, []); assert.deepEqual(room.dress, []); assert.deepEqual(room.wins, []);
      assert.equal(room.sign, null); assert.ok(room.panels.some(p => p.state === 'on'));
      for (const panel of room.panels) {
        assert.ok(Math.abs(panel.x) + 0.3 < room.W / 2);
        assert.ok(Math.abs(panel.z) + 0.6 < room.D / 2);
      }
    }
  }
});

test('integer room footprints are disjoint and reciprocal doors meet across each shared wall', () => {
  for (const id of ids) {
    const level = generateFeatureStudy(id, 713);
    assert.doesNotThrow(() => sketch(level));
    for (const [i, room] of level.rooms.entries()) {
      assert.equal(room.id, i);
      for (const key of ['x', 'z', 'w', 'd']) assert.ok(Number.isInteger(room[key]), key);
      for (const other of level.rooms.slice(i + 1)) {
        assert.ok(!(room.x < other.x + other.w && other.x < room.x + room.w && room.z < other.z + other.d && other.z < room.z + room.d));
      }
      for (const door of room.doors) {
        assert.equal(door.c, 0); near(door.w, 1.8); near(door.h, DOOR_H);
        assert.equal(door.sill, 0); assert.equal(door.door, false);
        assert.ok(door.w < wallLength(room, door.side));
        const other = level.rooms[door.to], opposite = other.doors.find(d => d.link === door.link), link = level.links[door.link];
        assert.equal(opposite.to, room.id);
        assert.equal(opposite.side, door.side === 'front' ? 'back' : 'front');
        const a = wallPoint(room, door.side, 0, -T / 2), b = wallPoint(other, opposite.side, 0, -T / 2);
        const wa = toWorld(room, a.x, a.z), wb = toWorld(other, b.x, b.z);
        near(wa.x, wb.x); near(wa.z, wb.z); near(wa.z, link.at);
        near(wa.x, (link.from + link.to) / 2); near(link.to - link.from, door.w);
        assert.equal(link.axis, 'z'); assert.equal(link.door, false);
      }
    }
  }
});

test('arrival faces the feature, both connections are open, and exit faces the normal way out', () => {
  for (const id of ids) {
    const level = generateFeatureStudy(id, 7), fromStart = roomDistances(level, 0), fromExit = roomDistances(level, 2);
    assert.deepEqual(roomPath(level, 0, 2), [0, 1, 2]); assert.equal(fromStart.size, 3);
    assert.equal(level.start.yaw, 0); assert.equal(level.start.room, 0); assert.equal(level.exit.room, 2);
    assert.equal(level.rooms[0].doors[0].side, 'back');
    assert.deepEqual(level.rooms[1].doors.map(d => d.side), ['front', 'back']);
    assert.equal(level.rooms[2].doors[0].side, 'front');
    const spawn = toLocal(level.rooms[0], level.start.x, level.start.z);
    assert.ok(fitsAt(level.rooms[0], spawn.x, spawn.z, .225));
    assert.ok(spawn.z > 0 && spawn.z < level.rooms[0].D / 2 - .225);
    for (const room of level.rooms) {
      assert.equal(room.depth, fromStart.get(room.id)); assert.equal(room.toExit, fromExit.get(room.id));
      for (const door of room.doors) {
        const approach = wallPoint(room, door.side, door.c, .5);
        assert.ok(fitsAt(room, approach.x, approach.z, .225));
      }
    }
  }
});
