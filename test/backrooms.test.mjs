// The Backrooms generator: every visit is different, every visit is the same
// visit again given the same seed, there is always a way out, and no room —
// however odd its floor or ceiling — can trap whoever walks into it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { generate, sketch, DECK, ARCHETYPES, SIDES, T, RISE, toWorld, wallLength, wallPoint, floorAt, ceilAt, headAt, fitsAt, stairZones,
  roomDistances, roomPath, makeRng, MIN_EXIT_STEPS } from '../public/world/backrooms/gen.js';

const office = {
  name: 'Robin', projects: ['Webstore', 'Mobile App', 'Infra'], agents: ['Ivory Marten', 'Amber Vireo', 'Ember Numbat', 'Olive Heron'],
  tasks: ['Cache the product catalogue', 'Trim the Docker image'],
};
const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 13);
const levels = new Map();
const levelFor = (seed) => { if (!levels.has(seed)) levels.set(seed, generate(seed, office)); return levels.get(seed); };

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
    const level = levelFor(seed);
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
    const level = levelFor(seed);
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
    const level = levelFor(seed);
    const dist = roomDistances(level, level.start.room);
    assert.equal(dist.size, level.rooms.length, `seed ${seed}: a room is cut off\n${sketch(level)}`);
    const path = roomPath(level, level.start.room, level.exit.room);
    assert.ok(path && path.length >= 3, `seed ${seed}: the way out is too close`);
    assert.equal(level.rooms[level.exit.room].doors.length, 1, 'the way out is at the end of its own passage');
    for (let i = 0; i + 1 < path.length; i++) assert.ok(level.rooms[path[i]].doors.some((d) => d.to === path[i + 1]));
  }
});

test('the way out is the furthest room there is, and never a short walk', () => {
  // More seeds than the other tests: this is a promise about every visit, and the generator is cheap.
  let walked = 0, rooms = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const level = seed <= 60 ? levelFor(SEEDS[seed - 1]) : generate(`far-${seed}`, office);
    const dist = roomDistances(level, level.start.room);
    const toExit = dist.get(level.exit.room), furthest = Math.max(...dist.values());
    assert.equal(toExit, furthest, `seed ${level.seed}: the way out is ${toExit} doorways off, but a room is ${furthest}\n${sketch(level)}`);
    assert.ok(toExit >= MIN_EXIT_STEPS, `seed ${level.seed}: the way out is only ${toExit} doorways from the landing`);
    walked += roomPath(level, level.start.room, level.exit.room).length; rooms += level.rooms.length;
  }
  // Going straight there, with no wrong turn at all, still takes you through about half the building.
  assert.ok(walked / rooms > 0.45, `the shortest way out passes ${(100 * walked / rooms).toFixed(0)}% of the rooms`);
});

test('rooms never overlap, and every doorway is a real hole in both walls', () => {
  for (const seed of SEEDS.slice(0, 30)) {
    const level = levelFor(seed);
    const cells = new Map();
    for (const r of level.rooms) for (let i = 0; i < r.w; i++) for (let j = 0; j < r.d; j++) {
      const k = `${r.x + i},${r.z + j}`;
      assert.ok(!cells.has(k), `seed ${seed}: rooms ${cells.get(k)} and ${r.id} overlap`);
      cells.set(k, r.id);
    }
    for (const link of level.links) {
      assert.ok(link.to - link.from >= 0.6, 'wide enough to squeeze through');
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

test('stairs, crawl doors and windows: the geometry between rooms adds up', () => {
  const seen = { crawl: 0, arch: 0, slit: 0, stairs: 0, windows: 0, crawlRooms: 0 };
  for (const seed of SEEDS) {
    const level = levelFor(seed);
    for (const link of level.links) {
      const a = level.rooms[link.a], b = level.rooms[link.b], lower = a.y <= b.y ? a : b, upper = lower === a ? b : a;
      const n = (upper.y - lower.y) / RISE;
      assert.ok(Math.abs(n - Math.round(n)) < 1e-6, 'floors differ by whole stairs');
      assert.ok(link.h >= 0.62, `seed ${seed}: doorway ${link.id} is ${link.h} m high`);
      if (link.kind === 'crawl') { seen.crawl++; assert.ok(link.h <= 0.9, 'a crawl door is knee-high'); } else assert.ok(link.h >= 1.5, `seed ${seed}: an ordinary doorway only ${link.h} m high`);
      if (link.kind === 'arch') seen.arch++;
      if (link.kind === 'slit') seen.slit++;
      for (const r of [a, b]) {
        const d = r.doors.find((q) => q.link === link.id);
        assert.ok(Math.abs(d.sill - (link.y - r.y)) < 1e-6 && d.h === link.h);
        const p = wallPoint(r, d.side, d.c, 0.05);
        assert.ok(ceilAt(r, p.x, p.z) >= d.sill + d.h, `seed ${seed}: doorway ${link.id} pokes through the ceiling of room ${r.id}`);
      }
      if (n > 0.5) {
        seen.stairs++;
        assert.ok(lower.kind === 'plain' || lower.kind === 'start', `seed ${seed}: stairs inside ${lower.arch || lower.kind}`);
        // walk down them: from the sill to the floor in steps nobody would trip on
        const d = lower.doors.find((q) => q.link === link.id);
        let last = d.sill;
        assert.equal(floorAt(lower, ...Object.values(wallPoint(lower, d.side, d.c, -0.05))), d.sill);
        for (let off = 0.02; off < 4; off += 0.04) {
          const p = wallPoint(lower, d.side, d.c, off), y = floorAt(lower, p.x, p.z);
          assert.ok(Math.abs(y - last) <= RISE + 1e-6, `seed ${seed}: a step of ${Math.abs(y - last)} m`);
          last = y;
          if (y === 0) break;
        }
        assert.equal(last, 0, 'the stairs reach the floor');
      }
    }
    for (const win of level.windows) {
      seen.windows++;
      for (const id of [win.a, win.b]) {
        const r = level.rooms[id], rec = r.wins.find((w) => w.win === win.id);
        assert.ok(rec && rec.y1 > rec.y0 && rec.y0 > 0.5, 'a window is a hole above a sill');
        assert.ok(Math.abs(rec.c) + rec.w / 2 <= wallLength(r, rec.side) / 2 - 0.3, 'inside its wall');
        assert.ok(!r.doors.some((d) => d.side === rec.side && Math.abs(d.c - rec.c) < (d.w + rec.w) / 2 + 0.2), 'not on top of a doorway');
      }
    }
    seen.crawlRooms += level.rooms.filter((r) => r.crawl).length;
    assert.equal(level.intro, undefined, 'nothing narrates');
  }
  for (const [what, n] of Object.entries(seen)) assert.ok(n > 0, `sixty visits and not one of: ${what}`);
});

test('no room can trap you: every doorway of every plain room can be walked to from every other', () => {
  const kinds = new Set();
  for (const seed of SEEDS) {
    const level = levelFor(seed);
    for (const r of level.rooms) {
      if (r.kind !== 'plain' && r.kind !== 'start') continue;
      if (r.shape) kinds.add(r.shape.kind);
      // flood the floor on a 12.5 cm grid with the rules the player walks by
      const cell = 0.125, R = 0.22, nx = Math.ceil(r.W / cell), nz = Math.ceil(r.D / cell);
      const at = (i, j) => ({ x: -r.W / 2 + (i + 0.5) * cell, z: -r.D / 2 + (j + 0.5) * cell });
      const free = (p) => Math.abs(p.x) <= r.W / 2 - R && Math.abs(p.z) <= r.D / 2 - R && fitsAt(r, p.x, p.z, R) && headAt(r, p.x, p.z) >= 0.62
        && !r.pillars.some((q) => Math.abs(p.x - q.x) < q.w / 2 + R && Math.abs(p.z - q.z) < q.d / 2 + R);
      const key = (p) => Math.floor((p.x + r.W / 2) / cell) + nx * Math.floor((p.z + r.D / 2) / cell);
      const inner = (d) => wallPoint(r, d.side, d.c, 0.3);
      const seen = new Set([key(inner(r.doors[0]))]), queue = [key(inner(r.doors[0]))];
      while (queue.length) {
        const k = queue.pop(), i = k % nx, j = Math.floor(k / nx), here = at(i, j);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di, jj = j + dj, kk = ii + nx * jj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || seen.has(kk)) continue;
          const there = at(ii, jj);
          if (!free(there) || Math.abs(floorAt(r, there.x, there.z) - floorAt(r, here.x, here.z)) > 0.26) continue;
          seen.add(kk); queue.push(kk);
        }
      }
      for (const d of r.doors) assert.ok(seen.has(key(inner(d))), `seed ${seed}: room ${r.id} (${r.shape ? r.shape.kind : 'plain'}) cuts off its ${d.side} doorway\n${JSON.stringify(r.shape)} ${JSON.stringify(r.pillars)}`);
      for (const z of stairZones(r, 0.6)) assert.ok(!r.pillars.some((q) => q.x + q.w / 2 > z.x0 && q.x - q.w / 2 < z.x1 && q.z + q.d / 2 > z.z0 && q.z - q.d / 2 < z.z1), `seed ${seed}: a pillar stands on the stairs`);
    }
  }
  for (const kind of ['ell', 'pinch', 'forest', 'stepceil', 'slopeceil', 'pit', 'dais', 'soffit', 'stairs']) assert.ok(kinds.has(kind), `sixty visits and no ${kind}`);
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
      assert.ok(room.doors.every((d) => d.sill === 0), `${arch.id} never has stairs inside it`);
    }
    // and its details survive an office with nobody and nothing in it
    assert.ok(generate(5, { only: arch.id }).rooms.some((r) => r.arch === arch.id));
    for (let i = 0; i < 25; i++) arch.roll(makeRng(`roll${i}`), { name: 'Lead', projects: ['A'], agents: ['B'], tasks: [] });
  }
});

test('no empty rooms: every archetype in the deck has somebody to build it', () => {
  // the builders need a browser, so read how they are registered instead: export const BUILDERS / MORE… = { id, 'an-id': fn, … }
  const dir = new URL('../public/world/backrooms/', import.meta.url);
  const maps = readdirSync(dir).filter((f) => /^rooms\d*\.js$/.test(f)).map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n').match(/^export const (?:BUILDERS|MORE\d*) = \{[^}]*\};$/gm) || [];
  const registered = new Set(maps.join(' ').match(/'[\w-]+'(?=:)|\b\w+\b(?=\s*[,}])/g).map((k) => k.replace(/'/g, '')));
  for (const arch of DECK) assert.ok(registered.has(arch.id), `${arch.id} is in the deck but nothing builds it`);
  for (const kind of ['plain', 'start', 'exit']) assert.ok(registered.has(kind));
});

test('the names of the real office end up in the level, and nothing else leaks in', () => {
  let found = { project: false, agent: false, name: false };
  for (const seed of SEEDS.slice(0, 40)) {
    const level = levelFor(seed);
    const text = JSON.stringify([level.cast, level.projects, level.rooms.map((r) => [r.params, r.dress])]);
    if (/Webstore|Mobile App|Infra/i.test(text)) found.project = true;
    if (/Ivory Marten|IVORY MARTEN|Amber Vireo|AMBER VIREO/.test(text)) found.agent = true;
    if (/ROBIN|Robin/.test(text)) found.name = true;
    assert.ok(!/\{[a-z]+\}/i.test(text), 'no unfilled blanks');
  }
  assert.deepEqual(found, { project: true, agent: true, name: true });
});

test('something follows you in some visits, not all', () => {
  const with_ = SEEDS.filter((seed) => levelFor(seed).pursuer).length;
  assert.ok(with_ > SEEDS.length * 0.3 && with_ < SEEDS.length * 0.9, `${with_} of ${SEEDS.length}`);
  const level = generate(11, { ...office, pursuer: true });
  assert.ok(level.pursuer && level.rooms[level.pursuer.room].kind === 'plain' && level.pursuer.room !== level.start.room);
  assert.equal(generate(11, { ...office, pursuer: false }).pursuer, null);
  // asking for it, or for none, changes nothing else about where the rooms are
  for (const seed of SEEDS.slice(0, 20)) {
    const plan = sketch(levelFor(seed));
    for (const pursuer of [true, false]) assert.equal(sketch(generate(seed, { ...office, pursuer })), plan, `seed ${seed}`);
    const lair = levelFor(seed).pursuer && levelFor(seed).rooms[levelFor(seed).pursuer.room];
    if (lair) assert.ok(!lair.crawl && lair.H >= 2.5 && (!lair.shape || lair.shape.kind === 'stepceil'), 'it has room to stand up where it lives');
  }
});
