// The Backrooms generator: every visit is different, every visit is the same
// visit again given the same seed, and there is always a way out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, sketch, DECK, ARCHETYPES, SIDES, T, toWorld, wallLength, roomDistances, roomPath, makeRng } from '../public/world/backrooms/gen.js';

const office = {
  name: 'Robin', projects: ['Webstore', 'Mobile App', 'Infra'], agents: ['Ivory Marten', 'Amber Vireo', 'Ember Numbat', 'Olive Heron'],
  tasks: ['Cache the product catalogue', 'Trim the Docker image'],
};
const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 13);

test('the same seed always builds the same level', () => {
  for (const seed of [1, 'tuesday', 1794609514540]) {
    assert.deepEqual(generate(seed, office), generate(seed, office));
    assert.equal(JSON.stringify(generate(seed, office)), JSON.stringify(generate(seed, office)), 'and it is plain data');
  }
  const R = makeRng('x'), S = makeRng('x');
  assert.deepEqual([R(), R.int(1, 9), R.pick('abcdef'.split(''))], [S(), S.int(1, 9), S.pick('abcdef'.split(''))]);
});

test('different seeds build different levels', () => {
  const shapes = new Set(), decks = new Set(), exits = new Set();
  for (const seed of SEEDS) {
    const level = generate(seed, office);
    shapes.add(level.rooms.map((r) => `${r.x},${r.z},${r.w},${r.d}`).join('|'));
    decks.add(level.picked.join(','));
    const exit = level.rooms[level.exit.room];
    exits.add(`${exit.cx},${exit.cz}`);
  }
  assert.equal(shapes.size, SEEDS.length, 'no two floor plans alike');
  assert.equal(decks.size, SEEDS.length, 'no two selections of rooms alike');
  assert.ok(exits.size > SEEDS.length * 0.8, 'the way out moves');
});

test('a visit is 6–9 oddities with no repeats, in 15–25 rooms', () => {
  for (const seed of SEEDS) {
    const level = generate(seed, office);
    assert.ok(level.picked.length >= 6 && level.picked.length <= 9, `seed ${seed}: ${level.picked.length} oddities`);
    assert.equal(new Set(level.picked).size, level.picked.length, `seed ${seed}: a room repeats`);
    assert.ok(level.rooms.length >= 15 && level.rooms.length <= 25, `seed ${seed}: ${level.rooms.length} rooms`);
    assert.deepEqual(level.rooms.filter((r) => r.kind === 'special').map((r) => r.arch).sort(), level.picked.slice().sort());
    assert.equal(level.rooms.filter((r) => r.kind === 'start').length, 1);
    assert.equal(level.rooms.filter((r) => r.kind === 'exit').length, 1);
    for (const r of level.rooms) if (r.arch) assert.ok(ARCHETYPES[r.arch] && r.params, `seed ${seed}: ${r.arch} has its details`);
  }
});

test('the exit, and every other room, can be reached from where you land', () => {
  for (const seed of SEEDS) {
    const level = generate(seed, office);
    const dist = roomDistances(level, level.start.room);
    assert.equal(dist.size, level.rooms.length, `seed ${seed}: a room is cut off\n${sketch(level)}`);
    const path = roomPath(level, level.start.room, level.exit.room);
    assert.ok(path && path.length >= 3, `seed ${seed}: the way out is too close`);
    assert.equal(level.rooms[level.exit.room].doors.length, 1, 'the way out is at the end of its own passage');
    // doors that have to be opened never stand between you and the exit by themselves being unopenable: they are just links
    for (let i = 0; i + 1 < path.length; i++) assert.ok(level.rooms[path[i]].doors.some((d) => d.to === path[i + 1]));
  }
});

test('rooms never overlap, and every doorway is a real hole in both walls', () => {
  for (const seed of SEEDS.slice(0, 30)) {
    const level = generate(seed, office);
    const cells = new Map();
    for (const r of level.rooms) for (let i = 0; i < r.w; i++) for (let j = 0; j < r.d; j++) {
      const k = `${r.x + i},${r.z + j}`;
      assert.ok(!cells.has(k), `seed ${seed}: rooms ${cells.get(k)} and ${r.id} overlap`);
      cells.set(k, r.id);
    }
    for (const link of level.links) {
      assert.ok(link.to - link.from >= 0.89, 'wide enough to walk through');
      for (const id of [link.a, link.b]) {
        const r = level.rooms[id];
        const lo = link.axis === 'x' ? r.z : r.x, hi = lo + (link.axis === 'x' ? r.d : r.w);
        assert.ok(link.from >= lo + 0.29 && link.to <= hi - 0.29, `seed ${seed}: doorway ${link.id} misses room ${id}`);
        assert.ok(link.axis === 'x' ? (r.x === link.at || r.x + r.w === link.at) : (r.z === link.at || r.z + r.d === link.at), 'on the shared wall');
        const door = r.doors.find((d) => d.link === link.id);
        assert.ok(door && SIDES.includes(door.side), 'each room knows its side of the doorway');
        assert.ok(Math.abs(door.c) + door.w / 2 <= wallLength(r, door.side) / 2 - 0.15, 'inside the wall it is in');
        // the local frame agrees with the world
        const p = toWorld(r, door.side === 'left' ? -r.W / 2 - T / 2 : door.side === 'right' ? r.W / 2 + T / 2 : door.c,
          door.side === 'front' ? r.D / 2 + T / 2 : door.side === 'back' ? -r.D / 2 - T / 2 : door.c);
        const mid = (link.from + link.to) / 2;
        assert.ok(Math.abs(p.x - (link.axis === 'x' ? link.at : mid)) < 1e-6 && Math.abs(p.z - (link.axis === 'x' ? mid : link.at)) < 1e-6);
      }
    }
    // every oddity is entered through the middle of its front wall
    for (const r of level.rooms) if (r.kind !== 'plain' && r.kind !== 'start') {
      const entry = r.doors.find((d) => d.side === 'front');
      assert.ok(entry && Math.abs(entry.c) < 1e-6, `seed ${seed}: ${r.arch || r.kind} has no front door`);
    }
  }
});

test('every archetype in the deck can be generated', () => {
  assert.ok(DECK.length >= 16, `the deck holds ${DECK.length}`);
  assert.equal(new Set(DECK.map((a) => a.id)).size, DECK.length);
  for (const arch of DECK) {
    for (const seed of [3, 41, 'x']) {
      const level = generate(seed, { ...office, only: arch.id });
      const room = level.rooms.find((r) => r.arch === arch.id);
      assert.ok(room, `${arch.id} was dealt`);
      assert.ok(room.params && typeof room.params === 'object');
      assert.ok(room.W >= arch.w[0] - T - 1e-6 && room.D >= arch.d[0] - T - 1e-6, `${arch.id} is the size it asked for`);
      assert.ok(room.panels.length > 0, `${arch.id} has a ceiling`);
    }
    // and its details survive an office with nobody and nothing in it
    assert.ok(generate(5, { only: arch.id }).rooms.some((r) => r.arch === arch.id));
    for (let i = 0; i < 25; i++) arch.roll(makeRng(`roll${i}`), { name: 'Lead', projects: ['A'], agents: ['B'], tasks: [] });
  }
});

test('the names of the real office end up in the level, and nothing else leaks in', () => {
  let found = { project: false, agent: false, name: false };
  for (const seed of SEEDS.slice(0, 40)) {
    const text = JSON.stringify(generate(seed, office).rooms.map((r) => [r.params, r.dress]));
    if (/WEBSTORE|MOBILE APP|INFRA/i.test(text)) found.project = true;
    if (/Ivory Marten|IVORY MARTEN|Amber Vireo|AMBER VIREO/.test(text)) found.agent = true;
    if (/ROBIN|Robin/.test(text)) found.name = true;
    assert.ok(!/\{(name|agent|project)\}/i.test(text), 'no unfilled blanks');
  }
  assert.deepEqual(found, { project: true, agent: true, name: true });
});

test('something follows you in some visits, not all', () => {
  const with_ = SEEDS.filter((seed) => generate(seed, office).pursuer).length;
  assert.ok(with_ > SEEDS.length * 0.3 && with_ < SEEDS.length * 0.9, `${with_} of ${SEEDS.length}`);
  const level = generate(11, { ...office, pursuer: true });
  assert.ok(level.pursuer && level.rooms[level.pursuer.room].kind === 'plain' && level.pursuer.room !== level.start.room);
  assert.equal(generate(11, { ...office, pursuer: false }).pursuer, null);
});
