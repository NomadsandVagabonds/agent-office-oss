// The Backrooms, top to bottom: a visit is several floors, the way out is only
// on the last of them, getting there is never a short walk, and all of it is
// the same again given the same seed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, MAX_ODD, MAX_ROOMS, DECK, ARCHETYPES, LESSONS, lessons, ready, lessonsOf, roomDistances, roomPath, MIN_EXIT_STEPS, EXIT_DEPTH, T, sketch, wallPoint, wallLength, toWorld, floorAt, ceilAt, headAt, fitsAt } from '../public/world/backrooms/gen.js';
import { MIN_OUT_STEPS, THIN_W, MARK_W, LEAN, REFUSE, MARK_STYLES, PRINT_CHANCE, PRINTED, lean, pressing, answer, TAPE_LABELS } from '../public/world/backrooms/marks.js';
import { REACH, calm, beside, closeness, grabChance } from '../public/world/backrooms/reach.js';
import { planVisit, floorOf, generateVisit, MIN_FLOORS, MAX_FLOORS, MIN_VISIT_STEPS, KNOWN_AT_START } from '../public/world/backrooms/plan.js';
import { THEMES, THEME_IDS } from '../public/world/backrooms/themes.js';
import { WAYS, GAP, goesDown, dropOf, hangBelow, flight, holeIn, ledgeAt, ductIn } from '../public/world/backrooms/seam.js';
import { AWAY, settled, unsure } from '../public/world/backrooms/rooms/unsure-hall/rule.js';
import { HALL, HAND, PART_ROOMS } from '../public/world/backrooms/plan.js';
import { WARNINGS, warningFor } from '../public/world/backrooms/drawings.js';
import { CAST, castFor } from '../public/world/backrooms/cast.js';
import { createTally } from '../public/world/backrooms/tally.js';
import { cleanRun } from '../core/runs.mjs';
import { leaving, LEAVE } from '../public/world/backrooms/leaving.js';

const office = {
  name: 'Robin', projects: ['Webstore', 'Mobile App', 'Infra'], agents: ['Ivory Marten', 'Amber Vireo', 'Ember Numbat', 'Olive Heron'],
  tasks: ['Cache the product catalogue', 'Trim the Docker image'],
};
const ALL = { card: true, coins: [1, 2, 3, 4] };
const SEEDS = Array.from({ length: 120 }, (_, i) => `visit-${i}`);
const visits = new Map();
const visitFor = (seed, opt = office) => { const k = seed + JSON.stringify(opt.loot || 0); if (!visits.has(k)) visits.set(k, generateVisit(seed, opt)); return visits.get(k); };

test('a visit is planned from its seed: three to five floors, yellow on top, the wall that gives only on the last', () => {
  const sizes = new Map(), orders = new Set(), under = new Set(), ways = new Set();
  for (const seed of SEEDS) {
    const plan = planVisit(seed, office);
    assert.deepEqual(plan, planVisit(seed, office), `seed ${seed}: the same seed plans the same visit`);
    assert.equal(JSON.stringify(plan), JSON.stringify(planVisit(seed, office)), 'and it is plain data');
    assert.ok(plan.depths >= MIN_FLOORS && plan.depths <= MAX_FLOORS, `seed ${seed}: ${plan.depths} floors`);
    assert.equal(plan.floors.length, plan.depths);
    assert.equal(plan.floors[0].theme, 'yellow', 'you always land in the yellow');
    assert.equal(new Set(plan.floors.map((f) => f.theme)).size, plan.depths, `seed ${seed}: two floors of one kind`);
    // one building: nothing in the plan numbers or names a part of it, and every part but the last ends in a way down that is its own while there are ways left
    assert.ok(!JSON.stringify(plan).match(/"(label|below)"/), `seed ${seed}: the plan numbers its parts`);
    const downs = plan.floors.slice(0, -1).map((f) => f.way);
    assert.equal(new Set(downs).size, Math.min(downs.length, WAYS.length), `seed ${seed}: the same way down twice (${downs})`);
    downs.forEach((w) => ways.add(w));
    plan.floors.forEach((f, i) => {
      assert.equal(f.depth, i);
      assert.ok(THEMES[f.theme], `${f.theme} is a kind of floor`);
      assert.equal(goesDown(f.way), i < plan.depths - 1, `seed ${seed}: part ${i} ends in ${f.way}`);
      if (i === plan.depths - 1) assert.equal(f.way, 'wall');
      assert.equal(f.prev, i ? plan.floors[i - 1].theme : null); assert.equal(f.next, i < plan.depths - 1 ? plan.floors[i + 1].theme : null);
    });
    sizes.set(plan.depths, (sizes.get(plan.depths) || 0) + 1);
    orders.add(plan.floors.map((f) => f.theme).join('>'));
    for (const f of plan.floors.slice(1)) under.add(f.theme);
  }
  for (let n = MIN_FLOORS; n <= MAX_FLOORS; n++) assert.ok(sizes.get(n) > 5, `visits of ${n} floors: ${sizes.get(n) || 0} in ${SEEDS.length}`);
  assert.deepEqual([...under].sort(), THEME_IDS.filter((id) => id !== 'yellow').sort(), 'every kind of floor turns up under the yellow one');
  assert.deepEqual([...ways].sort(), [...WAYS].sort(), 'every way down turns up somewhere');
  assert.ok(orders.size > 30, `only ${orders.size} different buildings in ${SEEDS.length} visits`);
  // nothing in a plan says how to play, and asking for a number of floors gets that number
  assert.equal(planVisit(3, { ...office, depths: 4 }).depths, 4);
  assert.throws(() => floorOf({ depths: 3, floors: [] }, 0), /planVisit/);
});

test('a floor is the same floor again whenever it is asked for, in any order', () => {
  for (const seed of SEEDS.slice(0, 25)) {
    const { visit, floors } = visitFor(seed);
    const again = planVisit(seed, office), last = floorOf(again, again.depths - 1);          // the bottom floor first: the ones above are worked out on the way
    assert.deepEqual(last, floors[floors.length - 1], `seed ${seed}`);
    for (let i = 0; i < visit.depths; i++) {
      assert.deepEqual(floorOf(again, i), floors[i], `seed ${seed}, floor ${i}`);
      assert.equal(JSON.stringify(floors[i]), JSON.stringify(floorOf(again, i)), 'plain data');
      assert.equal(floors[i].depth, i); assert.equal(floors[i].depths, visit.depths);
      assert.equal(floors[i].theme, visit.floors[i].theme); assert.equal('label' in floors[i] || 'below' in floors[i], false, 'no part of the building has a number');
      assert.equal(floors[i].exit.way, visit.floors[i].way);
    }
    assert.throws(() => floorOf(again, again.depths), /no floor/);
  }
});

test('the way out is earned: every floor ends at a fire exit in its furthest room, and a visit is never a short walk', () => {
  let steps = 0, rooms = 0, n = 0, shortest = Infinity, longest = 0;
  for (const seed of SEEDS) {
    const { visit, floors } = visitFor(seed);
    let walk = 0;
    floors.forEach((level, i) => {
      const dist = roomDistances(level, level.start.room), toExit = dist.get(level.exit.room);
      assert.equal(dist.size, level.rooms.length, `seed ${seed}, floor ${i}: a room is cut off\n${sketch(level)}`);
      assert.equal(toExit, Math.max(...dist.values()), `seed ${seed}, floor ${i}: the fire exit is not the furthest room`);
      assert.ok(toExit >= MIN_EXIT_STEPS, `seed ${seed}, floor ${i}: the fire exit is ${toExit} doorways from the landing`);
      const exit = level.rooms[level.exit.room];
      assert.equal(exit.kind, 'exit'); assert.equal(exit.way, level.exit.way);
      assert.equal(exit.doors.length, 1, 'a stairwell has one door');
      assert.ok(exit.doors[0].door, 'and it is a door you have to open');
      assert.ok(Math.abs(exit.W - (3 - T)) < 1e-9 && Math.abs(exit.D - (EXIT_DEPTH - T)) < 1e-9, 'with room behind it for a flight of stairs');
      // the stairs go on down from every floor but the last; there, the way out is a wall, and it is not a short walk either
      assert.equal(level.exit.way === 'wall', i === visit.depths - 1, `seed ${seed}, floor ${i}`);
      assert.equal(level.rooms.filter((r) => r.kind === 'exit').length, 1);
      assert.equal(level.rooms.filter((r) => r.kind === 'start').length, 1);
      const out = dist.get(level.thin.room);
      assert.ok(out >= MIN_OUT_STEPS, `seed ${seed}, floor ${i}: the thin place is ${out} doorways from the landing`);
      walk += i === visit.depths - 1 ? out : toExit; rooms += level.rooms.length; n++;
    });
    assert.ok(walk >= MIN_VISIT_STEPS, `seed ${seed}: out in ${walk} doorways`);
    steps += walk; shortest = Math.min(shortest, walk); longest = Math.max(longest, walk);
  }
  assert.equal(MIN_VISIT_STEPS, (MIN_FLOORS - 1) * MIN_EXIT_STEPS + MIN_OUT_STEPS);
  assert.ok(MIN_VISIT_STEPS >= 19, 'at the very least, nineteen doorways');
  assert.ok(steps / SEEDS.length > 28, `the straight way out averages ${(steps / SEEDS.length).toFixed(1)} doorways`);
  assert.ok(longest >= shortest + 12, 'and how long it is varies from one visit to the next');
  assert.ok(rooms / n >= 15, 'a floor is still a floor');
});

test('asking for a floor to be the last, or not, changes nothing else about it', () => {
  for (const seed of [1, 7, 'tuesday', 44]) {
    for (const theme of THEME_IDS) {
      const door = generate(seed, { ...office, theme });
      assert.equal(door.exit.way, 'wall');
      const strip = (level) => JSON.parse(JSON.stringify(level, (k, v) => (k === 'way' || k === 'name' ? undefined : v)));
      for (const way of WAYS) {
        const down = generate(seed, { ...office, theme, way });
        assert.equal(down.exit.way, way); assert.equal(down.rooms[down.exit.room].way, way);
        assert.deepEqual(strip(down), strip(door), `seed ${seed}, ${theme}, ${way}`);
      }
    }
  }
});

test('the floors of a visit are different places: a kind each, and rooms you have not already seen while the deck lasts', () => {
  const seenThemes = new Map();
  let repeats = 0, floorsSeen = 0;
  for (const seed of SEEDS) {
    const { floors } = visitFor(seed);
    const had = new Set();
    floors.forEach((level, i) => {
      assert.equal(new Set(level.picked).size, level.picked.length, `seed ${seed}, floor ${i}: a room twice on one floor`);
      // (a room the plan places by hand may come twice in a long visit: that is the plan's business, and has a test of its own)
      const fresh = DECK.length - had.size, again = level.picked.filter((id) => had.has(id) && !ARCHETYPES[id].planned).length;
      // only a floor the unused deck could not fill takes anything it has dealt before (two to spare, for rooms that would not fit anywhere)
      if (fresh >= level.picked.length + 2) assert.equal(again, 0, `seed ${seed}, floor ${i}: ${again} rooms from the floors above, with ${fresh} still unused`);
      if (i < 2) assert.equal(again, 0, `seed ${seed}: the second floor repeats the first`);
      repeats += again > 0 ? 1 : 0; floorsSeen++;
      level.picked.forEach((id) => had.add(id));
      // a floor looks like what it is
      // (but for the few rooms at a seam, which are on their way to being the part above or the part below)
      const theme = THEMES[level.theme], plain = level.rooms.filter((r) => r.kind === 'plain' && !r.bleed);
      if (theme.families) {
        const own = plain.filter((r) => (theme.families[r.look.family] || 0) > 0).length;
        assert.equal(own, plain.length, `seed ${seed}, floor ${i} (${level.theme}): a plain room in wallpaper from another kind of floor`);
      }
      const tally = seenThemes.get(level.theme) || { rooms: 0, dark: 0, families: new Set() };
      for (const r of plain) { tally.rooms++; if (r.light.mode === 'dark' || r.light.mode === 'one') tally.dark++; tally.families.add(r.look.family); }
      seenThemes.set(level.theme, tally);
      const start = level.rooms[level.start.room];
      assert.equal(start.light.mode, 'normal', 'wherever you land, you can see where you are');
      assert.ok(start.panels.some((p) => p.state !== 'dead'), `seed ${seed}, floor ${i}: you land in the dark`);
      assert.equal(level.rooms[level.exit.room].light.mode, 'normal');
    });
  }
  const dark = (id) => seenThemes.get(id).dark / seenThemes.get(id).rooms;
  assert.ok(dark('night') > 0.6, `out of hours, ${Math.round(dark('night') * 100)}% of the plain rooms are dark`);
  assert.equal(dark('yellow'), 0);
  assert.ok(seenThemes.get('yellow').families.has('yellow') && !seenThemes.get('yellow').families.has('board'));
  for (const id of ['archive', 'fitout', 'exec']) assert.ok(dark(id) < 0.25, `${id}: ${Math.round(dark(id) * 100)}% dark`);
});

test('the tape is older the further down it was shot', () => {
  for (const seed of SEEDS.slice(0, 40)) {
    const { floors } = visitFor(seed);
    for (let i = 1; i < floors.length; i++) {
      const up = floors[i - 1].stamp.year, here = floors[i].stamp.year;
      assert.ok(here < up && here >= up - 6, `seed ${seed}: floor ${i} is dated ${here}, the one above ${up}`);
    }
  }
});

/* ---- what is hidden, over the whole visit ---------------------------------------------------------- */

test('with nothing left to find, no floor hides anything, and the building is the one it always was', () => {
  for (const seed of SEEDS.slice(0, 40)) {
    const { visit, floors } = visitFor(seed);
    for (const level of floors) assert.equal('loot' in level, false);
    assert.equal(visit.card, false);
    for (const loot of [null, {}, { card: false, coins: [] }, { coins: [0, 'x'] }]) assert.deepEqual(generateVisit(seed, { ...office, loot }).floors, floors, `seed ${seed}: loot ${JSON.stringify(loot)}`);
    // coins change nothing but themselves, on any floor
    const hid = generateVisit(seed, { ...office, loot: { coins: [1, 2, 3, 4] } });
    hid.floors.forEach((level, i) => { const { loot: _l, ...rest } = level; assert.deepEqual(rest, floors[i], `seed ${seed}, floor ${i}: hiding coins moved something else`); });
  }
});

test('the coins are spread through the building, and the keycard is wherever the mascot is', () => {
  const where = new Map();
  let apart = 0, deep = 0;
  for (const seed of SEEDS) {
    const { visit, floors } = visitFor(seed, { ...office, loot: ALL });
    const coins = floors.flatMap((level, i) => (level.loot ? level.loot.coins.map((c) => ({ ...c, floor: i })) : []));
    assert.deepEqual(coins.map((c) => c.n).sort(), [1, 2, 3, 4], `seed ${seed}: every coin is somewhere, once`);
    const used = new Set(coins.map((c) => c.floor));
    assert.equal(used.size, Math.min(4, visit.depths), `seed ${seed}: four coins on ${used.size} of ${visit.depths} floors`);
    if (used.size === 4) apart++;
    for (const c of coins) { const r = floors[c.floor].rooms[c.room]; assert.ok(r && r.kind !== 'start' && r.kind !== 'exit' && !r.crawl, `seed ${seed}: coin ${c.n} is in ${r && r.kind}`); where.set(c.floor, (where.get(c.floor) || 0) + 1); }
    // the card: one floor has it, and that floor has somebody to hold it
    assert.ok(visit.card && visit.mascot !== null, `seed ${seed}: nobody to hold the card`);
    floors.forEach((level, i) => {
      assert.equal(!!(level.loot && level.loot.card), i === visit.mascot, `seed ${seed}, floor ${i}`);
      assert.equal(!!level.pursuer, i === visit.mascot, `seed ${seed}, floor ${i}: ${level.pursuer ? 'a second mascot' : 'no mascot where the plan put one'}`);
    });
    if (visit.mascot > 0) deep++;
    // the same seed hides it all in the same places
    assert.deepEqual(generateVisit(seed, { ...office, loot: ALL }).floors.map((l) => l.loot), floors.map((l) => l.loot));
  }
  assert.ok(apart > SEEDS.length * 0.4, 'in a building of four floors or more, no two coins share one');
  for (let i = 0; i < MIN_FLOORS; i++) assert.ok(where.get(i) > SEEDS.length * 0.5, `floor ${i} has had ${where.get(i) || 0} coins in ${SEEDS.length} visits`);
  assert.ok(deep > SEEDS.length * 0.6, `the mascot is under the floor you land on in ${deep} of ${SEEDS.length} visits`);
});

test('the coins still to be found take the same hiding places in the same order, whichever they are', () => {
  for (const seed of SEEDS.slice(0, 40)) {
    const places = (v) => v.floors.flatMap((level, i) => (level.loot ? level.loot.coins.map((c) => ({ n: c.n, at: `${i}:${c.room}:${c.x}:${c.z}` })) : [])).sort((a, b) => a.n - b.n);
    const all = places(visitFor(seed, { ...office, loot: { coins: [1, 2, 3, 4] } })).map((c) => c.at);
    assert.equal(new Set(all).size, 4);
    for (const left of [[1], [4], [2, 3], [1, 4], [1, 3, 4], [4, 2, 2, 1]]) {
      const want = [...new Set(left)].sort((a, b) => a - b), got = places(generateVisit(seed, { ...office, loot: { coins: left } }));
      assert.deepEqual(got.map((c) => c.n), want, `seed ${seed}: asked for ${left}`);
      // the k-th coin still to be found hangs where the k-th of all four would — or, sharing a floor with fewer others, in that floor's first place
      const floorsOf = got.map((c) => c.at.split(':')[0]);
      assert.deepEqual(floorsOf, all.slice(0, want.length).map((at) => at.split(':')[0]), `seed ${seed}: ${left} are not on the floors the first ${want.length} of four would be on`);
    }
    assert.deepEqual(places(generateVisit(seed, { ...office, loot: { coins: [3, 2] } })), places(generateVisit(seed, { ...office, loot: { coins: [2, 3] } })));
  }
});

test('something follows you in every visit (cast.js: the mascot is the one who is always down there) — and never from more than one floor', () => {
  let with_ = 0, onTop = 0;
  for (const seed of SEEDS) {
    const { visit, floors } = visitFor(seed);
    const lairs = floors.filter((l) => l.pursuer).length;
    assert.ok(lairs <= 1, `seed ${seed}: ${lairs} mascots`);
    if (lairs) { with_++; assert.ok(floors[visit.mascot].pursuer, 'on the floor the plan says'); if (visit.mascot === 0) onTop++; }
    assert.equal(generateVisit(seed, { ...office, pursuer: false }).floors.filter((l) => l.pursuer).length, 0);
  }
  // (a floor in fifty has no corner for his plinth; there he is stood in a plain room when the floor is built — pursuer.js — so the plan is still kept)
  assert.ok(with_ >= SEEDS.length * 0.95, `${with_} of ${SEEDS.length}`);
  for (const seed of SEEDS) assert.ok(visitFor(seed).visit.mascot !== null, `seed ${seed}: a visit he is not in`);
  assert.ok(onTop < with_ * 0.45, `it is on the floor you land on in ${onTop} of ${with_}`);
});

test('a path from the landing to the way out exists through every floor in turn', () => {
  for (const seed of SEEDS.slice(0, 30)) {
    const { floors } = visitFor(seed, { ...office, loot: ALL });
    for (const level of floors) {
      const path = roomPath(level, level.start.room, level.exit.room);
      assert.ok(path && path.length - 1 >= MIN_EXIT_STEPS);
      // every doorway on it can be walked through: none is a door that has to be found first, except the fire door itself
      for (let i = 0; i + 1 < path.length; i++) {
        const door = level.rooms[path[i]].doors.find((d) => d.to === path[i + 1]);
        assert.ok(door, 'each room on the way opens onto the next');
      }
    }
  }
});

/* ---- the way out: a wall ------------------------------------------------------------------------------ */

/** Everywhere in a plain room that can be walked to from its first doorway, by the rules the player walks by. */
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

test('every floor has the wall the plan would call thin — a bare, marked stretch of outside wall you can walk up to — and only the last floor ends at the wall that gives', () => {
  let near = 0, floors = 0;
  for (const seed of SEEDS) {
    const { visit, floors: all } = visitFor(seed);
    all.forEach((level, i) => {
      const t = level.thin, where = `seed ${seed}, floor ${i}`;
      assert.ok(t && typeof t.room === 'number' && ['front', 'back', 'left', 'right'].includes(t.side) && t.w === THIN_W, `${where}: ${JSON.stringify(t)}`);
      const r = level.rooms[t.room], half = wallLength(r, t.side) / 2;
      assert.ok(r.kind === 'plain' && !r.crawl && r.H >= 2.3, `${where}: the thin place is in ${r.arch || r.kind}`);
      assert.ok(r.depth >= MIN_OUT_STEPS, `${where}: ${r.depth} doorways in`);
      assert.ok(Math.abs(t.at) + MARK_W / 2 <= half - 0.3, `${where}: the mark runs off the end of its wall`);
      // bare: no doorway or window in it, level carpet and a ceiling you can stand under in front of it, no pillar against it
      for (const d of [...r.doors, ...r.wins]) if (d.side === t.side) assert.ok(Math.abs(d.c - t.at) >= (d.w + MARK_W) / 2 + 0.3, `${where}: a ${d.win !== undefined ? 'window' : 'doorway'} in the stretch`);
      for (let k = -0.5; k <= 0.501; k += 0.125) {
        const p = wallPoint(r, t.side, t.at + k * MARK_W, 0.25);
        assert.equal(floorAt(r, p.x, p.z), 0, `${where}: the floor is not level in front of it`);
        assert.ok(ceilAt(r, p.x, p.z) >= 2.2 && fitsAt(r, p.x, p.z, 0.05), `${where}: under something low, or inside a wall`);
        assert.ok(!r.pillars.some((q) => Math.abs(p.x - q.x) < q.w / 2 + 0.05 && Math.abs(p.z - q.z) < q.d / 2 + 0.05), `${where}: behind a pillar`);
      }
      // you can walk up to it and lean
      assert.ok(walked(r).has(wallPoint(r, t.side, t.at, 0.3)), `${where}: the wall cannot be reached from the room's own doorway`);
      // outside: nothing is built behind it — no other room, and nobody's view
      for (const k of [-0.5, 0, 0.5]) for (const off of [-0.6, -1.7]) {
        const l = wallPoint(r, t.side, t.at + k * MARK_W, off), p = toWorld(r, l.x, l.z);
        for (const o of level.rooms) {
          assert.ok(!(p.x >= o.x && p.x < o.x + o.w && p.z >= o.z && p.z < o.z + o.d), `${where}: room ${o.id} is behind the thin place`);
          if (o.halo) assert.ok(!(p.x >= o.halo.x0 && p.x < o.halo.x1 && p.z >= o.halo.z0 && p.z < o.halo.z1), `${where}: it backs onto somebody's view`);
        }
      }
      assert.equal(level.exit.way === 'wall', i === visit.depths - 1);
      // the wall that gives is the taped door at the bottom of the last fire stairs: never a shorter walk than the plan's guess was allowed to be
      if (level.exit.way === 'wall') assert.ok(level.rooms[level.exit.room].depth >= MIN_OUT_STEPS && level.exit.room !== t.room, `${where}: the way out is ${level.rooms[level.exit.room].depth} doorways in`);
      floors++; if (r.toExit <= 2) near++;
    });
  }
  assert.ok(near / floors > 0.65, `the thin place is within two doorways of the fire exit on ${Math.round(100 * near / floors)}% of floors`);
});

test('what people left on walls is rare and honest; what the place fakes is printed, and there is far less of either than of plain wall', () => {
  const styles = new Set();
  let crossed = 0, wrongway = 0, printed = 0, floors = 0;
  for (const seed of SEEDS) {
    const { floors: all } = visitFor(seed);
    all.forEach((level, i) => {
      const list = level.rooms.flatMap((r) => r.dress.filter((d) => d.type === 'marks').map((d) => ({ r, d }))), where = `seed ${seed}, floor ${i}`;
      floors++;
      assert.ok(list.filter((k) => k.d.style === 'crossed').length <= 1, `${where}: more than one taped door that is only a wall`);
      assert.ok(list.filter((k) => k.d.style === 'wrongway').length <= 2, `${where}: ${list.length} marked walls`);
      for (const { r, d } of list) {
        assert.ok(MARK_STYLES.includes(d.style), `${where}: ${d.style}`);
        assert.ok(r.id !== level.thin.room, `${where}: a person's mark in the room with the place's`);
        assert.ok((r.kind === 'plain' || r.kind === 'start') && !r.crawl);
        assert.ok(Math.abs(d.at) + MARK_W / 2 <= wallLength(r, d.side) / 2 - 0.3);
        for (const o of [...r.doors, ...r.wins]) if (o.side === d.side) assert.ok(Math.abs(o.c - d.at) >= (o.w + MARK_W) / 2 + 0.3, `seed ${seed}: a mark across a doorway`);
        // WRONG WAY is true: the room it is in goes nowhere
        if (d.style === 'wrongway') { assert.equal(r.doors.length, 1, `${where}: WRONG WAY in a room with ${r.doors.length} doorways`); assert.notEqual(r.id, level.exit.room); wrongway++; } else crossed++;
        styles.add(d.style);
      }
      assert.equal(typeof level.thin.print, 'boolean');
      if (level.thin.print) printed++;
    });
  }
  assert.deepEqual([...styles].sort(), MARK_STYLES.slice().sort());
  // "a couple of fakeout doors are fine": a door that is only a wall — taped and crossed out by a person, or printed by the place — is on fewer than one floor in two of each kind
  assert.ok(crossed / floors < 0.5 && crossed / floors > 0.15, `a crossed-out door on ${crossed} of ${floors} floors`);
  assert.ok(Math.abs(printed / floors - PRINT_CHANCE) < 0.12, `a printed door on ${printed} of ${floors} floors`);
  assert.ok(wrongway > floors * 0.3, `WRONG WAY on ${wrongway} dead ends in ${floors} floors`);
  assert.ok(PRINTED.length > 40 && !LESSONS.printed && !DECK.some((a) => lessons(a).needs.includes('printed')), 'the difference is taught by walls, not by a room: no room may take it for granted');
});

test('leaning: against the stretch, still pushing, for as long as it took to get in', () => {
  assert.ok(LEAN > 1 && LEAN < 1.5);
  assert.equal(pressing(0.25, 0, THIN_W, 1, 0.1), true);
  assert.equal(pressing(0.25, THIN_W / 2 + 0.01, THIN_W, 1, 0.1), false, 'beside the stretch is only wall');
  assert.equal(pressing(0.6, 0, THIN_W, 1, 0.1), false, 'standing near it is not leaning on it');
  assert.equal(pressing(0.25, 0, THIN_W, 0.2, 0.1), false, 'nor is walking along it');
  assert.equal(pressing(0.25, 0, THIN_W, 1, 2), false, 'nor is running past');
  // held long enough, you are through; let go, and it is forgotten twice as fast
  let held = 0, t = 0;
  while (held < LEAN) { held = lean(held, 1 / 30, true); t += 1 / 30; }
  assert.ok(Math.abs(t - LEAN) < 0.05, `through after ${t.toFixed(2)} s`);
  held = 1.0;
  for (let i = 0; i < 15; i++) held = lean(held, 1 / 30, false);
  assert.ok(Math.abs(held - 0) < 1e-9, 'half a second off the wall and you start again');
  assert.equal(lean(0, 1, false), 0);
});

test('every tape has something written on it, and the same tape always says the same thing', () => {
  for (const [a, b] of TAPE_LABELS) assert.ok(typeof a === 'string' && typeof b === 'string' && a.length <= 18 && b.length <= 18, `${a} / ${b}`);
  for (const seed of SEEDS.slice(0, 40)) {
    const labels = (v) => new Map(v.floors.flatMap((l) => (l.loot ? l.loot.coins : [])).map((c) => [c.n, c.label]));
    const all = labels(visitFor(seed, { ...office, loot: ALL }));
    assert.equal(all.size, 4);
    for (const [n, label] of all) { assert.ok(Array.isArray(label) && label.length === 2, `seed ${seed}, tape ${n}`); assert.ok(!/\{[a-z]+\}/i.test(label.join(' ')), 'no unfilled blanks'); }
    for (const left of [[2], [1, 4], [3, 4]]) for (const [n, label] of labels(generateVisit(seed, { ...office, loot: { coins: left } }))) assert.deepEqual(label, all.get(n), `seed ${seed}: tape ${n} changed its label`);
  }
});

test('leaving: through the wall, out and up with nothing to stop you, a look back at the floor, and then white', () => {
  // standing at a wall on the −x side of a room, facing it (yaw: forward is (−sin, −cos))
  const from = { x: 10, y: 1.1, z: -4, yaw: Math.PI / 2, pitch: -0.1, nx: -1, nz: 0 };
  const at = (t) => leaving(t, from);
  assert.deepEqual([at(0).x, at(0).y, at(0).z, at(0).yaw, at(0).pitch, at(0).white, at(0).outside], [10, 1.1, -4, from.yaw, from.pitch, 0, false], 'it starts where you were standing, as you were');
  assert.deepEqual(at(1.3), at(1.3), 'the same moment is the same picture');
  // out of the room by the time it says so: past your own width and the wall's thickness
  assert.ok(at(LEAVE.through).out >= 0.22 + T + 0.2 && at(LEAVE.through).outside);
  let prev = at(0);
  for (let t = 1 / 30; t <= LEAVE.over + 0.2; t += 1 / 30) {
    const p = at(t);
    assert.ok(p.out >= prev.out && p.y >= prev.y - 1e-9, `never back toward the wall, never down (t=${t.toFixed(2)})`);
    assert.ok(p.out - prev.out < 1.6 && Math.abs(p.yaw - prev.yaw) < 0.2, `no jump in the picture at t=${t.toFixed(2)}`);
    assert.ok(Math.abs(p.z - from.z) < 1e-9, 'straight out, the way the wall faces');
    assert.ok(p.white >= prev.white && p.white <= 1 && p.snow >= 0 && p.snow <= 1 && p.track >= 0 && p.track <= 1);
    prev = p;
  }
  // once it has turned round it is looking back at the floor it left, and down at it
  const back = at(LEAVE.turn[1] + 0.2), fx = -Math.sin(back.yaw), fz = -Math.cos(back.yaw);
  assert.ok(fx > 0.98 && Math.abs(fz) < 0.2, 'facing back the way it came');
  assert.ok(back.pitch < -0.05 && Math.abs(back.roll) < 0.1, 'and down, and level again');
  assert.ok(back.out > 8 && back.y > from.y + 3, 'from well outside and above the ceilings');
  assert.equal(at(LEAVE.white[0]).white, 0);
  assert.equal(at(LEAVE.white[1]).white, 1, 'the picture is gone before the tape is');
  assert.ok(LEAVE.white[1] <= LEAVE.over && !at(LEAVE.over - 0.01).over && at(LEAVE.over).over);
});

test('rules stack with depth: no room is dealt that takes for granted what the floors above have not taught', () => {
  // what an entry may say: one thing it teaches at most, and what it needs — each of which something else can teach
  for (const arch of DECK) {
    const { teaches, needs } = lessons(arch);
    assert.ok(teaches.length <= 1, `${arch.id} teaches ${teaches.length} new things: one to a room`);
    for (const id of [...teaches, ...needs]) assert.match(id, /^[a-z][a-z0-9-]*$/, `${arch.id}: a lesson is a plain word`);
    for (const n of needs) {
      assert.ok(!teaches.includes(n), `${arch.id} cannot need what it is the first to teach`);
      assert.ok(KNOWN_AT_START.includes(n) || DECK.some((b) => b !== arch && lessons(b).teaches.includes(n)), `${arch.id} needs '${n}', which nothing teaches: it could never be dealt`);
    }
    if (arch.headline) assert.equal(needs.length, 0, `${arch.id}: a room staged from the news goes where the plan puts it, and so may take nothing for granted`);
  }
  // the rule itself
  const combo = { id: 'x', needs: ['valve', 'light'] }, single = { id: 'y', teaches: 'valve' };
  assert.equal(ready(combo, new Set(['valve'])), false, 'one ingredient is not enough');
  assert.equal(ready(combo, new Set(['light', 'valve', 'lean'])), true);
  assert.equal(ready(single, new Set()), true, 'a room that needs nothing can be anywhere');
  assert.equal(ready(combo, null), true, 'a floor asked for by itself (the dev page) is taken to have been taught everything');
  assert.deepEqual(lessons(single), { teaches: ['valve'], needs: [] });
  // and every visit keeps to it, floor by floor
  for (const seed of SEEDS.slice(0, 60)) {
    const known = new Set(KNOWN_AT_START);
    for (const level of visitFor(seed).floors) {
      for (const id of level.picked) for (const n of lessons(ARCHETYPES[id]).needs) assert.ok(known.has(n), `${seed}, floor ${level.depth}: ${id} needs '${n}' before anything has taught it`);
      for (const id of lessonsOf(level)) known.add(id);
    }
  }
});

test('a room staged from the news: one to a visit at most, never on the floor you land on, and never by chance', () => {
  const stories = new Set(DECK.filter((a) => a.headline).map((a) => a.id));
  let seen = 0;
  for (const seed of SEEDS) {
    const { visit, floors } = visitFor(seed);
    const where = floors.flatMap((level) => level.picked.filter((id) => stories.has(id)).map((id) => [level.depth, id]));
    assert.ok(where.length <= 1, `${seed}: ${where.length} of them in one visit`);
    assert.ok(where.every(([depth]) => depth > 0), `${seed}: one on the floor you land on`);
    assert.deepEqual(where.map(([, id]) => id), visit.headline ? [visit.headline] : [], `${seed}: it is there because the plan said so, and only then`);
    seen += where.length;
  }
  if (stories.size) assert.ok(seen > SEEDS.length * 0.15 && seen < SEEDS.length * 0.6, `${seen} visits in ${SEEDS.length} had one`);
  // a floor asked for by itself never has one unless it is asked for by name
  for (let i = 0; i < 40; i++) assert.ok(!generate(`alone-${i}`, office).picked.some((id) => stories.has(id)));
});


test('a marked wall that is leaned on answers inside half a second, whichever kind of wall it is', () => {
  assert.ok(REFUSE < 0.5 && REFUSE < LEAN, 'a wall that is only a wall says so before the other kind would have given');
  // the one that gives: something to see from the first instant, more of it the longer you lean, and through at LEAN
  assert.equal(answer(true, 0).open, 0);
  assert.ok(answer(true, 1 / 30).open > 0.15, 'the first frame of a lean already shows');
  let prev = 0;
  for (let h = 1 / 30; h < LEAN; h += 1 / 30) { const a = answer(true, h); assert.ok(a.open > prev && a.open <= 1 && !a.through); prev = a.open; }
  assert.equal(answer(true, LEAN).through, true);
  assert.equal(answer(true, LEAN).open, 1);
  // the ones that do not: one knock per lean, and nothing until you have let go altogether and leaned again
  let held = 0, said = false, knocks = 0, at = null;
  const step = (pressed) => { held = lean(held, 1 / 30, pressed); const a = answer(false, held, said); said = a.said; if (a.knock) { knocks++; at ??= held; } };
  for (let i = 0; i < 90; i++) step(true);
  assert.equal(knocks, 1, 'three seconds of leaning is one refusal, not a drum roll');
  assert.ok(at >= REFUSE && at < 0.5);
  for (let i = 0; i < 4; i++) step(false);
  for (let i = 0; i < 30; i++) step(true);
  assert.equal(knocks, 1, 'easing off for a moment is the same lean');
  for (let i = 0; i < 90; i++) step(false);
  for (let i = 0; i < 30; i++) step(true);
  assert.equal(knocks, 2, 'let go and lean again, and it says so again');
});

test('within arm\'s reach of what follows you: across a room it is a dummy; running past costs a frame; standing beside it, it has you', () => {
  const dt = 1 / 30, dice = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
  const stand = (d, rnd, secs = 6) => { let s = calm(), tears = 0; for (let t = dt; t <= secs; t += dt) { s = beside(s, dt, d, rnd); if (s.tear) tears++; if (s.grab) return { at: t, tears }; } return { at: null, tears }; };
  assert.ok(REACH.touch < REACH.arm && REACH.arm < 1.6, 'arm\'s reach is an arm, not a room');
  // watched from anywhere outside its reach, for as long as you like: nothing
  for (const d of [REACH.arm, REACH.arm + 0.01, 3, 12, Infinity]) assert.deepEqual(stand(d, () => 0, 30), { at: null, tears: 0 }, `at ${d} m it is a shop dummy`);
  // standing at arm's length: a warning first, always, and then it has you — in a second or two, whatever the dice say
  for (const d of [REACH.arm - 0.02, 1.1, 0.9]) for (const rnd of [() => 0, () => 0.5, () => 0.999]) {
    let s = calm(), first = null, seen = 0;
    for (let t = dt; t <= 0.5; t += dt) { s = beside(s, dt, d, rnd); if (s.tear) { first ??= t; seen++; assert.equal(s.grab, false, `at ${d} m the first tear is only a warning`); } }
    assert.ok(first !== null && first <= REACH.first + dt + 1e-9 && seen === 1, 'the tape tears almost as soon as you are in reach, once');
    const got = stand(d, rnd);
    assert.ok(got.at >= 0.55 && got.at <= 3.2 && got.tears >= 2 && got.tears <= REACH.last, `at ${d} m it had you after ${got.at} s and ${got.tears} tears`);
  }
  // running past (well under a second inside its reach, not touching): one torn frame, and you are still there — every time
  for (const rnd of [() => 0, () => 0.3, () => 0.999]) {
    let s = calm(), tears = 0;
    for (let t = 0; t < 0.5; t += dt) { s = beside(s, dt, 0.9, rnd); if (s.tear) tears++; assert.equal(s.grab, false); }
    assert.equal(tears, 1, 'running past costs one tear');
  }
  // touching it: sometimes that is all it takes
  assert.equal(closeness(REACH.touch), 1); assert.equal(closeness(REACH.arm), 0);
  assert.ok(grabChance(1, 1) > 0.2 && grabChance(1, 1) < 0.6 && grabChance(1, 0.99) === 0);
  assert.equal(stand(REACH.touch, () => 0).tears, 1, 'up against it, with the dice against you, the first tear is the last');
  assert.ok(stand(REACH.touch, () => 0.999).at < stand(REACH.arm - 0.02, () => 0.999).at, 'and it is quicker about it the nearer you are');
  for (let n = 1; n < REACH.last; n++) for (const c of [0, 0.5, 1]) assert.ok(grabChance(n + 1, c) >= grabChance(n, c) && grabChance(n, 1) >= grabChance(n, 0), 'each tear is worse than the last, and nearer is worse');
  assert.equal(grabChance(REACH.last, 0), 1);
  // step back out and wait, and it forgets; step back for a moment and it has not
  let s = calm();
  for (let t = 0; t < 0.4; t += dt) s = beside(s, dt, 1, () => 0.999);
  assert.equal(s.tears, 1);
  for (let t = 0; t < REACH.forget - 0.5; t += dt) s = beside(s, dt, 5, () => 0.999);
  assert.equal(s.tears, 1, 'not forgotten yet');
  for (let t = 0; t < 1; t += dt) s = beside(s, dt, 5, () => 0.999);
  assert.deepEqual([s.tears, s.next], [0, REACH.first]);
  // and the rule is only the rule: the same dice, the same story
  assert.deepEqual(stand(1, dice(0.9, 0.2, 0.9, 0.7, 0.1, 0.4)), stand(1, dice(0.9, 0.2, 0.9, 0.7, 0.1, 0.4)));
});

test('one building: every part but the last ends at a way down, and the part below hangs with its landing spot directly under it', () => {
  for (const seed of SEEDS.slice(0, 40)) {
    const { visit, floors } = visitFor(seed);
    floors.forEach((level, i) => {
      const room = level.rooms[level.exit.room], where = `seed ${seed}, part ${i} (${room.way})`;
      assert.equal(room.way, visit.floors[i].way);
      if (i === visit.depths - 1) { assert.equal(goesDown(room.way), false); return; }
      // the drop is inside the room behind the fire door, further in than the door, and nowhere else
      const d = dropOf(room);
      assert.ok(Math.abs(d.x) < room.W / 2 - 0.3 && d.z > -room.D / 2 + 0.2 && d.z < room.D / 2 - 1.5 && d.y <= 0, `${where}: the drop is at ${JSON.stringify(d)}`);
      // …and the next part hangs so that where you land is straight down from it, a storey and a slab below, clear of every ceiling up here
      const next = floors[i + 1], at = hangBelow(level, next), top = toWorld(room, d.x, d.z);
      assert.ok(Math.abs(next.start.x + at.x - top.x) < 1e-9 && Math.abs(next.start.z + at.z - top.z) < 1e-9, `${where}: the landing is not under the drop`);
      assert.ok(Math.abs(room.y + d.y - at.y - GAP) < 1e-9, `${where}: ${room.y + d.y - at.y} m down`);
      assert.ok(GAP > next.rooms[next.start.room].H + 0.6, 'the room you land in fits under the floor you left');
    });
  }
  // the geometry the builders share: stairs that end short of the back wall, a hole with floor all round it, a ledge with floor to stand on, a duct with a way in
  for (const D of [EXIT_DEPTH - T, EXIT_DEPTH + 1 - T]) {            // (the room behind the fire door is always this deep)
    const f = flight(D, true), h = holeIn(2.8, D), z = ledgeAt(D), duct = ductIn(D);
    assert.ok(f.zB > f.back + 0.5 && f.zL < f.zF && f.yB < -2);
    assert.ok(h[0] > -1.4 + 0.4 && h[2] < 1.4 - 0.4 && h[1] > -D / 2 + 0.5 && h[3] < D / 2 - 2, 'floor on every side of the hole, and room to stop inside the door');
    assert.ok(z < D / 2 - 2 && z > -D / 2 + 2);
    assert.ok(duct.wall < D / 2 - 2 && duct.z1 > -D / 2 + 0.6 && duct.z1 < duct.wall - 2 && duct.y1 < -1 && duct.top >= 0.9);
  }
});

test('near a seam the parts run into each other, and that changes nothing but how rooms look', () => {
  for (const seed of SEEDS.slice(0, 40)) {
    const { visit, floors } = visitFor(seed);
    floors.forEach((level, i) => {
      const where = `seed ${seed}, part ${i}`, into = level.rooms.filter((r) => r.bleed === 'next'), from = level.rooms.filter((r) => r.bleed === 'prev');
      if (i < visit.depths - 1) {
        assert.ok(level.shaft && into.length >= 1, `${where}: nothing of the part below turns up before the way down`);
        for (const r of into) { assert.ok(r.kind === 'plain' && r.toExit <= 2, `${where}: room ${r.id}`); assert.equal(r.look.carpet, level.shaft.carpet); assert.equal(r.look.floor, level.shaft.floor); }
        assert.ok(into.some((r) => r.look.wall === level.shaft.wall), `${where}: the room at the door is not papered like the part below`);
      } else assert.equal(into.length, 0, `${where}: there is nothing below the last part`);
      if (i > 0) assert.ok(from.some((r) => r.id === level.start.room), `${where}: the room you land in remembers nothing of the part above`);
      // …and what turns up early or lingers is the neighbour's own paper, not merely its kind of paper
      const most = (l) => { const n = new Map(); for (const r of l.rooms) if (r.kind === 'plain' && !r.bleed) n.set(r.look.family, (n.get(r.look.family) || 0) + 1); return [...n].sort((a, b) => b[1] - a[1])[0][0]; };
      if (i > 0) assert.equal(level.rooms[level.start.room].look.family, most(floors[i - 1]), `${where}: the landing is papered like nowhere up there`);
      if (i < visit.depths - 1) assert.equal(level.shaft.family, most(floors[i + 1]), `${where}: the shaft is papered like nowhere down there`);
      if (i === 0) assert.equal(from.length, 0);
      assert.ok(into.length + from.length <= 9, `${where}: ${into.length + from.length} rooms are somebody else's colour: it is a seam, not a redecoration`);
    });
  }
  const strip = (level) => JSON.parse(JSON.stringify(level, (k, v) => (k === 'look' || k === 'bleed' || k === 'shaft' ? undefined : v)));
  for (const seed of [1, 7, 'tuesday']) for (const theme of THEME_IDS) {
    const plain = generate(seed, { ...office, theme, way: 'hole' }), bled = generate(seed, { ...office, theme, way: 'hole', paper: 'p1', bleed: { prev: { theme: 'night', paper: 'p0' }, next: { theme: 'exec', paper: 'p2' } } });
    assert.deepEqual(strip(bled), strip(plain), `seed ${seed}, ${theme}`);
    assert.equal(plain.shaft, null);
  }
});

test('the hallway that is not sure where it leads: only while nobody looks and nobody is in it, once per look away, and round to the first room again', () => {
  const dt = 1 / 30;
  const run = (s, secs, watched, occupied, n) => { let turns = 0; for (let t = 0; t < secs; t += dt) { s = unsure(s, dt, watched, occupied, n); if (s.turned) turns++; } return [s, turns]; };
  for (const n of [2, 3, 4]) {
    // nobody has ever seen it: it has nothing to be different from, and stays as it is
    let [s, turns] = run(settled(), 30, false, false, n);
    assert.deepEqual([s.face, turns], [0, 0], 'a room nobody has looked at does not change behind their backs');
    // watched, or stood in, for as long as you like: never
    [s, turns] = run(s, 30, true, false, n); assert.equal(turns, 0, 'it never changes while somebody is looking');
    [s, turns] = run(s, 30, false, true, n); assert.equal(turns, 0, 'nor while somebody is in it, looking or not');
    // look away, look back; look away, look back: one room on each time, and after n of them the room you started with
    const seen = [];
    s = settled();
    for (let i = 0; i < n * 2; i++) {
      [s] = run(s, 1, true, false, n); seen.push(s.face);
      [s, turns] = run(s, 5, false, false, n);
      assert.equal(turns, 1, 'however long you look away, it is one room on: you have to look back before it will change again');
    }
    assert.deepEqual(seen, Array.from({ length: n * 2 }, (_, i) => i % n), `${n} rooms, in order, and round again`);
    // a glance at your feet is not long enough
    [s] = run(settled(), 1, true, false, n);
    [s, turns] = run(s, AWAY - 2 * dt, false, false, n);
    assert.equal(turns, 0);
    [s, turns] = run(s, 1, true, false, n); assert.equal(turns, 0);
  }
  assert.equal(unsure({ face: 0, away: 9, seen: true }, 1, false, false, 1).turned, false, 'a hallway with only one end is only a hallway');
  assert.ok(AWAY >= 0.25 && AWAY <= 0.8);
});

test('the hallway is rare, is never where you land, and only ever comes after the cardboard people', () => {
  const hall = ARCHETYPES[HALL];
  assert.ok(hall && hall.planned && lessons(hall).needs.includes('unwatched'), 'it takes the cardboard people for granted, and is never dealt by chance');
  const counts = [0, 0, 0];
  for (const seed of SEEDS) {
    const { visit, floors } = visitFor(seed);
    const at = floors.map((l, i) => (l.picked.includes(HALL) ? i : -1)).filter((i) => i >= 0);
    assert.ok(at.length <= 1, `seed ${seed}: ${at.length} of them in one visit (no room is in a visit twice)`);
    counts[at.length]++;
    for (const i of at) {
      assert.ok(i > 0, `seed ${seed}: in the part you land in`);
      assert.ok(floors.slice(0, i).some((l) => l.picked.includes('cutouts')), `seed ${seed}, part ${i}: before anybody has met the cardboard people`);
      assert.equal(floors[i].picked.filter((id) => id === HALL).length, 1);
      const room = floors[i].rooms.find((r) => r.arch === HALL);
      // where a tape may hide in it: inside the room, in the far end, on the way through that every room it can be keeps clear
      const [x0, z0, x1, z1] = hall.stash(room, 1);
      assert.ok(x0 < x1 && z0 < z1 && x0 > -room.W / 2 && x1 < room.W / 2 && z0 > -room.D / 2 + 1 && z1 < 0, `seed ${seed}: its hiding place is at ${[x0, z0, x1, z1]}`);
      assert.ok(room.params.faces.length >= 1 && room.params.faces.length <= 3 && new Set(room.params.faces).size === room.params.faces.length, 'two to four rooms at the end of it, the first being more of the hallway');
    }
    assert.equal(visit.depths, floors.length);
  }
  assert.ok(counts[2] === 0 && counts[1] > SEEDS.length * 0.5 && counts[0] > SEEDS.length * 0.1, `visits with none, one, two: ${counts}`);
});

test('the visit\'s hand: a visit shows 40–70% of the deck, in an order of its own, and never a room twice', () => {
  const orders = new Set(), shown = new Map();
  let least = 1, most = 0;
  assert.deepEqual([...HAND], [0.4, 0.7]);
  for (const seed of SEEDS) {
    const { visit, floors } = visitFor(seed), all = floors.flatMap((l) => l.picked);
    // never twice — and what was built is what the plan dealt, part for part (a room that would not fit anywhere may be missing: no more than one a part)
    assert.equal(new Set(all).size, all.length, `seed ${seed}: a room twice in one visit (${all})`);
    assert.equal(new Set(visit.hand).size, visit.hand.length);
    assert.deepEqual(visit.hand.slice().sort(), visit.floors.flatMap((f) => f.hand).sort());
    floors.forEach((level, i) => {
      const hand = visit.floors[i].hand;
      for (const id of level.picked) assert.ok(hand.includes(id), `seed ${seed}, part ${i}: ${id} was not in this part's hand`);
      assert.ok(level.picked.length >= hand.length - 1, `seed ${seed}, part ${i}: dealt ${hand}, built ${level.picked}`);
      assert.ok(hand.length >= 1 && hand.length <= MAX_ODD, `seed ${seed}, part ${i}: ${hand.length} oddities`);
      // long enough to get lost in, however few of its rooms are oddities; and mostly plain
      assert.ok(level.rooms.length >= PART_ROOMS[0] && level.rooms.length <= MAX_ROOMS, `seed ${seed}, part ${i}: ${level.rooms.length} rooms`);
      assert.ok(1 - level.picked.length / level.rooms.length >= 0.7, `seed ${seed}, part ${i}: only ${level.rooms.length - level.picked.length} of ${level.rooms.length} rooms are plain`);
      for (const id of level.picked) shown.set(id, (shown.get(id) || 0) + 1);
    });
    const share = visit.hand.length / DECK.length;
    assert.ok(share >= HAND[0] - 1e-9 && share <= HAND[1] + 1e-9, `seed ${seed}: the hand is ${visit.hand.length} of ${DECK.length} rooms`);
    least = Math.min(least, all.length / DECK.length); most = Math.max(most, all.length / DECK.length);
    orders.add(all.join('>'));
  }
  assert.ok(least >= HAND[0] - 2 / DECK.length && most <= HAND[1] + 1e-9, `visits showed between ${Math.round(least * 100)}% and ${Math.round(most * 100)}% of the deck`);
  assert.equal(orders.size, SEEDS.length, 'no two visits have the same rooms in the same order');
  // every room in the deck gets its turn, and none is in every visit
  for (const a of DECK) { const n = shown.get(a.id) || 0; assert.ok(n > 0, `${a.id} is never dealt`); assert.ok(n < SEEDS.length, `${a.id} is in every visit`); }
});

test('what a visit came to: time in play, parts reached, rooms walked into, who was met — in the shape the card is filled in from', () => {
  const t = createTally({ seed: 'visit-9', of: 4 });
  // only time in play is on the clock
  for (let i = 0; i < 300; i++) t.tick(0.1, true);
  for (let i = 0; i < 50; i++) t.tick(0.1, false);
  // a part is counted when it is let go, once, however often it is asked about
  const first = { rooms: [{ visits: 3, def: { kind: 'start' } }, { visits: 1, def: { kind: 'plain' } }, { visits: 0, def: { kind: 'plain' } }, { visits: 2, def: { kind: 'special', arch: 'cutouts' } }, { visits: 1, def: { kind: 'exit' } }] };
  t.part(first); t.part(first); t.way();
  const second = { rooms: [{ visits: 1, def: { kind: 'start' } }, { visits: 1, def: { kind: 'special', arch: 'vending' } }, { visits: 4, def: { kind: 'special', arch: 'cutouts' } }, { def: { kind: 'plain' } }] };
  t.met('pirate'); t.met('pirate'); t.survived('shadow'); t.survived('pirate'); t.met(''); t.met(7);
  t.part(second); t.part(null);
  const run = t.report({ left: 2, of: 3 });
  assert.deepEqual(run, { seed: 'visit-9', seconds: 30, parts: { reached: 2, of: 4 }, rooms: { explored: 7, kinds: ['cutouts', 'vending'] }, cast: { met: ['pirate', 'shadow'], survived: 2 }, hearts: { left: 2, of: 3 } });
  assert.equal(JSON.stringify(run), JSON.stringify(t.report({ left: 2, of: 3 })), 'plain data, and the same each time it is asked for');
  assert.equal('hearts' in t.report(), false, 'no health this visit, no line for it');
  // it is what the office's rules expect: nothing in it is cut or changed by them
  for (const reason of ['exit', 'caught', 'quit', 'battery']) {
    const clean = cleanRun({ ...run, reason });
    for (const k of ['seed', 'seconds', 'parts', 'rooms', 'cast', 'hearts']) assert.deepEqual(clean[k], run[k], `${reason}: ${k}`);
  }
  // however many ways down the conductor reports, nobody reaches more parts than there are
  const far = createTally({ seed: 1, of: 3 }); for (let i = 0; i < 9; i++) far.way();
  assert.deepEqual(far.report().parts, { reached: 3, of: 3 });
  assert.equal(far.report().seed, '1');
});

test('drawings on the walls: only ever of something that is in this visit, on its part or the one above, in a frightened person\'s own unfinished words', () => {
  // the words: every creature has some, none is the deck's own line, and nobody got to the end of a sentence
  const norm = (t) => t.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const m of CAST) {
    assert.ok(Array.isArray(WARNINGS[m.id]) && WARNINGS[m.id].length >= 2, `nobody has drawn ${m.id}: there is nothing on the walls to learn it from`);
    for (const lines of WARNINGS[m.id]) {
      const said = norm(lines.join(' ')), rule = norm(m.rule);
      assert.ok(lines.length >= 2 && lines.length <= 4 && lines.every((l) => l.length <= 22 && l === l.toUpperCase()), `${m.id}: ${JSON.stringify(lines)}`);
      assert.ok(!said.includes(rule) && !rule.includes(said), `${m.id}: the wall quotes the deck`);
      // (not the deck's sentence with a word changed either: no run of five words is shared)
      const words = rule.split(' ');
      for (let i = 0; i + 5 <= words.length; i++) assert.ok(!said.includes(words.slice(i, i + 5).join(' ')), `${m.id}: "${words.slice(i, i + 5).join(' ')}" is the deck's own wording`);
      assert.ok(!/[.!?…]$/.test(lines[lines.length - 1].trim()), `${m.id}: "${lines[lines.length - 1]}" — they finished the sentence`);
    }
  }
  const R = { pick: (l) => l[0] };
  assert.deepEqual(warningFor('pirate', R), WARNINGS.pirate[0]);
  assert.ok(warningFor('somebody-new', R).length >= 2, 'a creature nobody has words for yet still gets an honest scrawl');
  // the walls: who is drawn where
  const drawnOf = new Map();
  let parts = 0, withOne = 0;
  for (const seed of SEEDS) {
    const { visit, floors } = visitFor(seed), company = castFor(visit);
    floors.forEach((level, i) => {
      parts++;
      const drawings = level.rooms.flatMap((r) => r.dress.filter((d) => d.type === 'trace' && d.kind === 'drawing'));
      assert.ok(drawings.length <= 1, `seed ${seed}, part ${i}: ${drawings.length} drawings`);
      for (const d of drawings) {
        withOne++;
        const who = company.find((m) => m.id === d.of);
        assert.ok(who, `seed ${seed}, part ${i}: a drawing of ${d.of}, who is not in this visit`);
        const at = who.floor === null ? visit.mascot : who.floor;
        assert.ok(who.floor === null ? i >= at - 1 : at === i || at === i + 1, `seed ${seed}, part ${i}: a drawing of ${d.of}, who is on part ${at}`);
        assert.ok((WARNINGS[d.of] || []).some((lines) => JSON.stringify(lines) === JSON.stringify(d.text)), `seed ${seed}: ${JSON.stringify(d.text)}`);
        drawnOf.set(d.of, (drawnOf.get(d.of) || 0) + 1);
      }
    });
  }
  assert.ok(withOne / parts > 0.3 && withOne / parts < 0.7, `a drawing on ${withOne} of ${parts} parts`);
  for (const m of CAST) assert.ok(drawnOf.get(m.id) > 0, `${m.id} is never drawn`);
});
