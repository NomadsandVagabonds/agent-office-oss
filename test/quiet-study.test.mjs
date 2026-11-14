// This fixture is an optional authoring preview, not a production pacing change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuietStudy } from '../public/world/backrooms/quiet-study.js';
import { generate, toWorld, toLocal, wallPoint, wallLength, roomDistances, roomPath, T } from '../public/world/backrooms/gen.js';

const seeds = [1, 7, 29, 713, 'same corridor'];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;

test('quiet study is deterministic plain data and does not alter normal generation', () => {
  for (const seed of seeds) {
    const before = generate(seed);
    const first = generateQuietStudy(seed, { name: 'Robin', agents: ['Aster'], projects: ['Archive'] });
    assert.deepEqual(first, generateQuietStudy(seed, { name: 'Robin', agents: ['Aster'], projects: ['Archive'] }));
    assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
    assert.deepEqual(generate(seed), before);
    assert.equal(first.name, 'Robin');
    assert.deepEqual(first.cast, ['Aster']);
    assert.deepEqual(first.projects, ['Archive']);
  }
});

test('nine repeated quiet rooms share one palette and ceiling without set-piece state', () => {
  for (const seed of seeds) {
    const lv = generateQuietStudy(seed, { pursuer: true, count: 1, only: 'freight', loot: { card: true, coins: [1] } });
    assert.equal(lv.rooms.length, 10);
    assert.deepEqual(lv.picked, []);
    assert.equal(lv.pursuer, null);
    assert.equal(lv.loot, undefined);
    assert.deepEqual(lv.windows, []);
    const repeats = [0, 0, 0];
    for (const room of lv.rooms.slice(0, 9)) {
      assert.equal(room.kind, 'plain');
      assert.equal(room.arch, null);
      assert.equal(room.name, undefined);
      assert.equal(room.params, undefined);
      assert.equal(room.w, 12); assert.equal(room.d, 12);
      near(room.W, 12 - T); near(room.D, 12 - T);
      assert.equal(room.H, 2.6); assert.equal(room.y, 0); assert.equal(room.crawl, false);
      assert.equal(room.look.family, 'yellow');
      assert.deepEqual(room.look, lv.rooms[0].look);
      assert.deepEqual(room.light, lv.rooms[0].light);
      assert.deepEqual(room.panels, lv.rooms[0].panels);
      assert.deepEqual(room.dress, []); assert.deepEqual(room.wins, []);
      assert.equal(room.sign, null); assert.equal(room.shape, null);
      assert.ok(room.pillars.length > 0);
      assert.ok(room.quietStudy.probes.length > 0);
      assert.ok(room.quietStudy.turn >= 0 && room.quietStudy.turn <= 3);
      repeats[room.quietStudy.variant]++;
    }
    assert.deepEqual(repeats, [3, 3, 3]);
    const details = lv.rooms.slice(0, 9).map(r => r.quietStudy.detail);
    assert.equal(details.filter(d => d === 'apertures').length, 2);
    assert.equal(details.filter(d => d === 'sunken').length, 2);
    assert.equal(details.filter(d => d === null).length, 5);
    assert.equal(lv.rooms[0].quietStudy.detail, null, 'entry remains unadorned');
    for (const room of lv.rooms.slice(0, 9)) {
      if (room.quietStudy.detail === 'apertures') assert.equal(room.quietStudy.variant, 0);
      if (room.quietStudy.detail === 'sunken') assert.equal(room.quietStudy.variant, 1);
    }
  }
});

test('two real macro loops, every room reachable, and an ordinary exit annex', () => {
  for (const seed of seeds) {
    const lv = generateQuietStudy(seed), reached = roomDistances(lv, lv.start.room);
    assert.equal(reached.size, lv.rooms.length);
    assert.equal(lv.links.length - lv.rooms.length + 1, 2, 'cycle rank');
    assert.ok(roomPath(lv, lv.start.room, lv.exit.room));
    const exit = lv.rooms[lv.exit.room];
    assert.equal(exit.kind, 'exit'); assert.equal(exit.doors.length, 1);
    assert.equal(exit.doors[0].side, 'front'); assert.equal(exit.doors[0].to, 8);
    assert.equal(exit.toExit, 0); assert.equal(exit.H, 2.6); assert.equal(exit.y, 0);
    assert.deepEqual(exit.pillars, []); assert.equal(exit.quietStudy, undefined);
    for (const room of lv.rooms) {
      assert.equal(room.depth, reached.get(room.id));
      assert.equal(room.toExit, roomDistances(lv, lv.exit.room).get(room.id));
    }
  }
});

test('room footprints are disjoint and door/link geometry agrees in both frames', () => {
  for (const seed of seeds) {
    const lv = generateQuietStudy(seed);
    for (const [i, room] of lv.rooms.entries()) {
      assert.equal(room.id, i);
      for (const other of lv.rooms.slice(i + 1)) assert.ok(!overlap(room, other), `${room.id}/${other.id} overlap`);
      for (const panel of room.panels) {
        assert.ok(Math.abs(panel.x) + .3 < room.W / 2);
        assert.ok(Math.abs(panel.z) + .6 < room.D / 2);
      }
      for (const dr of room.doors) {
        near(dr.w, 1.8); near(Math.abs(dr.c), 2.4);
        assert.equal(dr.sill, 0); assert.equal(dr.h, 2.05); assert.equal(dr.door, false);
        assert.ok(Math.abs(dr.c) + dr.w / 2 < wallLength(room, dr.side) / 2);
        const link = lv.links[dr.link], other = lv.rooms[dr.to];
        assert.ok(link.a === room.id || link.b === room.id);
        const reciprocal = other.doors.find((d) => d.link === dr.link);
        assert.equal(reciprocal.to, room.id);
        const p = wallPoint(room, dr.side, dr.c, -T / 2), w = toWorld(room, p.x, p.z);
        const q = wallPoint(other, reciprocal.side, reciprocal.c, -T / 2), v = toWorld(other, q.x, q.z);
        near(w.x, v.x); near(w.z, v.z);
        near(link.to - link.from, dr.w);
        near(link.axis === 'x' ? w.x : w.z, link.at);
        near(link.axis === 'x' ? w.z : w.x, (link.from + link.to) / 2);
      }
    }
  }
});

test('spawn and every doorway approach clear the authored partition footprints', () => {
  const clear = (room, p, radius = .25) => {
    assert.ok(Math.abs(p.x) + radius < room.W / 2 && Math.abs(p.z) + radius < room.D / 2);
    for (const wall of room.pillars) {
      const dx = Math.max(0, Math.abs(p.x - wall.x) - wall.w / 2);
      const dz = Math.max(0, Math.abs(p.z - wall.z) - wall.d / 2);
      assert.ok(dx * dx + dz * dz >= radius * radius, `room ${room.id}: blocked approach`);
    }
  };
  for (const seed of seeds) {
    const lv = generateQuietStudy(seed);
    clear(lv.rooms[0], toLocal(lv.rooms[0], lv.start.x, lv.start.z));
    for (const room of lv.rooms) for (const door of room.doors) {
      for (const off of [.5, .8, 1.2]) clear(room, wallPoint(room, door.side, door.c, off));
    }
  }
});
