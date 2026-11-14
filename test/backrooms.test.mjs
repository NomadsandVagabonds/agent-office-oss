// The Backrooms generator: every visit is different, every visit is the same
// visit again given the same seed, there is always a way out, and no room —
// however odd its floor or ceiling — can trap whoever walks into it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { generate, sketch, DECK, ARCHETYPES, SIDES, T, RISE, toWorld, wallLength, wallPoint, floorAt, ceilAt, headAt, fitsAt, stairZones,
  roomDistances, roomPath, makeRng, MIN_EXIT_STEPS, MIN_ODD, MAX_ODD, MAX_ROOMS, coinSpots, STASH } from '../public/world/backrooms/gen.js';

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

test('a floor is 5–8 oddities with no repeats, in a building that is mostly plain rooms', () => {
  for (const seed of SEEDS) {
    const level = levelFor(seed);
    assert.ok(level.picked.length >= MIN_ODD && level.picked.length <= MAX_ODD, `seed ${seed}: ${level.picked.length} oddities`);
    assert.equal(new Set(level.picked).size, level.picked.length, `seed ${seed}: a room repeats`);
    assert.ok(level.rooms.length >= 18 && level.rooms.length <= MAX_ROOMS, `seed ${seed}: ${level.rooms.length} rooms`);
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
    assert.equal(level.rooms[level.exit.room].doors.length, 1, 'the fire exit is a stairwell with one door');
    for (let i = 0; i + 1 < path.length; i++) assert.ok(level.rooms[path[i]].doors.some((d) => d.to === path[i + 1]));
  }
});

test('the fire exit is the furthest room there is, and never a short walk', () => {
  // More seeds than the other tests: this is a promise about every visit, and the generator is cheap.
  let walked = 0, rooms = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const level = seed <= 60 ? levelFor(SEEDS[seed - 1]) : generate(`far-${seed}`, office);
    const dist = roomDistances(level, level.start.room);
    const toExit = dist.get(level.exit.room), furthest = Math.max(...dist.values());
    assert.equal(toExit, furthest, `seed ${level.seed}: the fire exit is ${toExit} doorways off, but a room is ${furthest}\n${sketch(level)}`);
    assert.ok(toExit >= MIN_EXIT_STEPS, `seed ${level.seed}: the fire exit is only ${toExit} doorways from the landing`);
    walked += roomPath(level, level.start.room, level.exit.room).length; rooms += level.rooms.length;
  }
  // Going straight there, with no wrong turn at all, still takes you through about half the floor.
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
  for (const arch of DECK) {
    // a room written since the first deck names the file its builder is in
    if (arch.module) {
      assert.match(arch.module, /^\.\/rooms\/[\w-]+\.js$/, `${arch.id}: its builder is a file in rooms/`);
      assert.match(readFileSync(new URL(arch.module, dir), 'utf8'), /^export function build\s*\(/m, `${arch.module} exports build(c)`);
      continue;
    }
    assert.ok(registered.has(arch.id), `${arch.id} is in the deck but nothing builds it`);
  }
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

/* ---- what is hidden down here (core/game.mjs): a keycard in the mascot's hand, and coins ---------------- */

const ALL = { card: true, coins: [1, 2, 3, 4] };
const withLoot = (seed, loot = ALL) => generate(seed, { ...office, loot });
const coinFloor = new WeakMap();
const hasCoinFloor = (r) => { if (!coinFloor.has(r)) coinFloor.set(r, coinSpots(r).length > 0); return coinFloor.get(r); };
/** The rooms a coin may be in at all, and those of them that are on no shortest way from the landing to the way out. */
function hidingPlaces(level) {
  const fromStart = roomDistances(level, level.start.room), toExit = roomDistances(level, level.exit.room), way = fromStart.get(level.exit.room);
  const able = level.rooms.filter((r) => r.kind !== 'start' && r.kind !== 'exit' && !r.crawl && fromStart.has(r.id));
  const aside = able.filter((r) => fromStart.get(r.id) + toExit.get(r.id) > way);
  return { able, aside, fromStart };
}
/** Everywhere in a room that can be walked to from its first doorway, by the rules the player walks by (as in the test further up). */
function walked(r) {
  const cell = 0.125, R = 0.22, nx = Math.ceil(r.W / cell), nz = Math.ceil(r.D / cell);
  const at = (i, j) => ({ x: -r.W / 2 + (i + 0.5) * cell, z: -r.D / 2 + (j + 0.5) * cell });
  const free = (p) => Math.abs(p.x) <= r.W / 2 - R && Math.abs(p.z) <= r.D / 2 - R && fitsAt(r, p.x, p.z, R) && headAt(r, p.x, p.z) >= 0.62
    && !r.pillars.some((q) => Math.abs(p.x - q.x) < q.w / 2 + R && Math.abs(p.z - q.z) < q.d / 2 + R);
  const key = (p) => Math.floor((p.x + r.W / 2) / cell) + nx * Math.floor((p.z + r.D / 2) / cell);
  const from = key(wallPoint(r, r.doors[0].side, r.doors[0].c, 0.3)), seen = new Uint8Array(nx * nz), queue = [from];
  seen[from] = 1;
  while (queue.length) {
    const k = queue.pop(), i = k % nx, j = Math.floor(k / nx), here = at(i, j);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj, kk = ii + nx * jj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || seen[kk]) continue;
      const there = at(ii, jj);
      if (!free(there) || Math.abs(floorAt(r, there.x, there.z) - floorAt(r, here.x, here.z)) > 0.26) continue;
      seen[kk] = 1; queue.push(kk);
    }
  }
  return { has: (p) => seen[key(p)] === 1 };
}

test('with nothing left to find, nothing is hidden: the level is the one it always was', () => {
  for (const seed of SEEDS) {
    const level = levelFor(seed);
    assert.equal('loot' in level, false, 'a visit that was not asked to hide anything does not mention loot');
    for (const loot of [undefined, null, {}, { card: false, coins: [] }, { coins: [0, -1, 'x'] }]) assert.deepEqual(generate(seed, { ...office, loot }), level, `seed ${seed}: loot ${JSON.stringify(loot)}`);
    // coins change nothing but themselves…
    const { loot, ...rest } = generate(seed, { ...office, loot: { coins: [1, 2, 3, 4] } });
    assert.deepEqual(rest, level, `seed ${seed}: hiding coins moved something else`);
    assert.deepEqual(loot.coins.map((c) => c.n), [1, 2, 3, 4]);
    assert.equal(loot.card, false);
    // …and the card is in the mascot's hand, so asking for it is asking for the mascot and nothing more
    const forced = generate(seed, { ...office, pursuer: true });
    if (forced.pursuer) { const { loot: held, ...same } = withLoot(seed, { card: true }); assert.deepEqual(same, forced, `seed ${seed}`); assert.deepEqual(held, { card: true, coins: [] }); }
  }
});

test('while the keycard is still to be found there is a mascot to hold it, every visit', () => {
  let nowhere = 0;
  for (let i = 1; i <= 400; i++) {
    const seed = i <= 60 ? SEEDS[i - 1] : `far-${i}`;
    for (const pursuer of i <= 60 ? [undefined, false] : [undefined]) {                    // not even asking for none gets rid of it
      const level = generate(seed, { ...office, pursuer, loot: { card: true } });
      assert.ok(level.pursuer && level.loot.card === true, `seed ${seed}: nobody to hold the card`);
      const lair = level.rooms[level.pursuer.room];
      assert.ok(lair.kind === 'plain' && !lair.crawl && lair.id !== level.start.room && lair.id !== level.exit.room, `seed ${seed}: it stands in ${lair.arch || lair.kind}`);
      assert.ok(!lair.shape || lair.shape.kind === 'stepceil', 'with a level floor under it');
    }
    if (!generate(seed, { ...office, pursuer: true }).pursuer) nowhere++;
    // once the card has been found, the mascot is back to being a matter of chance
    if (i <= 60) assert.deepEqual(generate(seed, { ...office, loot: { card: false, coins: [1] } }).pursuer, levelFor(seed).pursuer);
  }
  assert.ok(nowhere > 0, 'four hundred buildings and every one had a room the mascot would have chosen: the other case is not being tested');
});

test('coins hide where exploring pays: off the way out, on floor you can walk to, one to a room', () => {
  const seeds = [...SEEDS, ...Array.from({ length: 140 }, (_, i) => `coins-${i}`)];
  const tally = { coins: 0, deadEnd: 0, oddity: 0, either: 0, shared: 0, withMascot: 0 };
  for (const seed of seeds) {
    const level = withLoot(seed), { able, aside, fromStart } = hidingPlaces(level);
    const coins = level.loot.coins;
    assert.deepEqual(coins.map((c) => c.n), [1, 2, 3, 4], `seed ${seed}: every coin has a place`);
    const again = withLoot(seed);
    assert.deepEqual(again.loot, level.loot, `seed ${seed}: the same seed hides them in the same places`);
    assert.equal(JSON.stringify(again), JSON.stringify(level), 'and it is still plain data');
    const somewhereAside = aside.some(hasCoinFloor);
    for (const c of coins) {
      const r = level.rooms[c.room], where = `seed ${seed}: coin ${c.n} in room ${c.room} (${r && (r.arch || r.kind)}${r && r.shape ? ' ' + r.shape.kind : ''}) at ${c.x}, ${c.z}`;
      assert.ok(r && fromStart.has(r.id), `${where}: no such room, or no way to it`);
      assert.ok(r.kind !== 'start' && r.kind !== 'exit' && !r.crawl, `${where}: never where you land, the way out, or a crawl space`);
      if (somewhereAside) assert.ok(aside.includes(r), `${where}: that is on the shortest way out, and there were rooms off it\n${sketch(level)}`);
      else assert.ok(able.includes(r));
      // on free floor: inside the room and clear of its walls, on level carpet (no stairs, no pit or its edge, no dais), with room to stand
      assert.ok(Math.abs(c.x) <= r.W / 2 - 0.5 && Math.abs(c.z) <= r.D / 2 - 0.5 && fitsAt(r, c.x, c.z, 0.3), `${where}: in or against a wall`);
      for (const [dx, dz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3], [0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) assert.equal(floorAt(r, c.x + dx, c.z + dz), 0, `${where}: the floor is not level there`);
      assert.ok(headAt(r, c.x, c.z) >= 1.5, `${where}: under something low`);
      assert.ok(!stairZones(r, 0.6).some((s) => c.x > s.x0 - 0.3 && c.x < s.x1 + 0.3 && c.z > s.z0 - 0.3 && c.z < s.z1 + 0.3), `${where}: on the stairs, or at their foot`);
      assert.ok(!r.pillars.some((q) => Math.abs(c.x - q.x) < q.w / 2 + 0.3 && Math.abs(c.z - q.z) < q.d / 2 + 0.3), `${where}: in a pillar`);
      for (const d of r.doors) { const p = wallPoint(r, d.side, d.c, 0); assert.ok(Math.hypot(c.x - p.x, c.z - p.z) >= 1, `${where}: in a doorway`); }
      assert.ok(walked(r).has(c), `${where}: cannot be walked to from the room's own doorway`);
      tally.coins++;
      const dead = r.doors.length === 1, odd = r.kind === 'special';
      if (dead) tally.deadEnd++; if (odd) tally.oddity++; if (dead || odd) tally.either++;
      if (level.pursuer.room === r.id) tally.withMascot++;
    }
    // one to a room — unless the building has fewer rooms to hide them in than there are coins
    const rooms = new Set(coins.map((c) => c.room));
    if (rooms.size < coins.length) {
      tally.shared++;
      const pool = somewhereAside ? aside.filter(hasCoinFloor) : able.filter(hasCoinFloor);
      assert.ok(pool.length < coins.length, `seed ${seed}: two coins share a room, though ${pool.length} rooms could have had one each`);
      assert.equal(rooms.size, pool.length, `seed ${seed}: …and then every such room has one`);
      for (const a of coins) for (const b of coins) if (a.n < b.n && a.room === b.room) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 0.9, `seed ${seed}: coins ${a.n} and ${b.n} are on top of each other`);
    }
  }
  assert.ok(tally.either / tally.coins > 0.75, `dead ends and oddities are preferred: ${tally.either} of ${tally.coins} coins`);
  assert.ok(tally.deadEnd / tally.coins > 0.5 && tally.oddity / tally.coins > 0.4, JSON.stringify(tally));
  assert.ok(tally.shared < seeds.length * 0.05, `coins share a room in ${tally.shared} of ${seeds.length} buildings`);
  assert.ok(tally.withMascot < tally.coins * 0.02, `${tally.withMascot} coins are in the room the mascot stands in`);
});

test('only the coins still to be found are hidden, and what is left takes the same hiding places in the same order', () => {
  for (const seed of SEEDS.slice(0, 40)) {
    const all = withLoot(seed, { card: false, coins: [1, 2, 3, 4] }).loot.coins, places = (list) => list.map((c) => [c.room, c.x, c.z]);
    const rooms = hidingPlaces(levelFor(seed)).aside.filter(hasCoinFloor).length;          // (coins alone leave every room as it was)
    for (const left of [[1], [4], [2, 3], [1, 4], [1, 3, 4], [4, 2, 2, 1]]) {
      const level = withLoot(seed, { card: false, coins: left }), want = [...new Set(left)].sort((a, b) => a - b);
      assert.deepEqual(level.loot.coins.map((c) => c.n), want, `seed ${seed}: asked for ${left}`);
      assert.deepEqual(places(level.loot.coins), places(all.slice(0, want.length)), `seed ${seed}: ${left} are not where the first ${want.length} of four would be`);
      // fewer coins than rooms to hide them in: none of them share
      if (rooms >= want.length) assert.equal(new Set(level.loot.coins.map((c) => c.room)).size, want.length, `seed ${seed}: ${left} share a room`);
    }
    // the card being there or not makes no difference to where a coin goes — unless the mascot that comes with it is standing in the way
    const bare = withLoot(seed, { card: false, coins: [2, 3] }), held = withLoot(seed, { card: true, coins: [2, 3] });
    assert.deepEqual(withLoot(seed, { card: false, coins: [3, 2] }).loot, bare.loot, 'the same seed and the same coins: the same places');
    if (JSON.stringify(held.pursuer) === JSON.stringify(bare.pursuer)) assert.deepEqual(held.loot.coins, bare.loot.coins);
  }
});

test('in an oddity a coin has a place of its own, where the builder leaves the floor clear', () => {
  for (const arch of DECK) assert.equal(typeof STASH[arch.id], 'function', `${arch.id} has no place for a coin: one would land wherever the generator supposes there is floor`);
  const seen = new Map();
  for (let i = 0; i < 250; i++) {
    const level = withLoot(`deck-${i}`), first = new Set();
    for (const c of level.loot.coins) {
      const r = level.rooms[c.room];
      if (!r.arch || first.has(r.id)) continue;                  // (a second coin in the same room has to go somewhere else)
      first.add(r.id);
      const zones = [-1, 1].flatMap((side) => { const lay = STASH[r.arch](r, side); return Array.isArray(lay[0]) ? lay : [lay]; });
      for (const [x0, z0, x1, z1] of zones) assert.ok(x0 <= x1 && z0 <= z1 && x0 > -r.W / 2 && x1 < r.W / 2 && z0 > -r.D / 2 && z1 < r.D / 2, `${r.arch} (${r.W} × ${r.D}): its place is not inside the room`);
      assert.ok(zones.some(([x0, z0, x1, z1]) => c.x >= x0 - 0.01 && c.x <= x1 + 0.01 && c.z >= z0 - 0.01 && c.z <= z1 + 0.01), `seed deck-${i}: the coin in ${r.arch} is at ${c.x}, ${c.z}, not in its place`);
      seen.set(r.arch, (seen.get(r.arch) || 0) + 1);
    }
  }
  // (a room that is never dealt by chance is not in these buildings at all: its place is checked where it is dealt)
  for (const arch of DECK) if (!arch.planned) assert.ok(seen.get(arch.id) >= 5, `${arch.id}: only ${seen.get(arch.id) || 0} coins in 250 buildings`);
});
