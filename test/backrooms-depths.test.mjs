// The Backrooms, top to bottom: a visit is several floors, the way out is only
// on the last of them, getting there is never a short walk, and all of it is
// the same again given the same seed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, DECK, roomDistances, roomPath, MIN_EXIT_STEPS, EXIT_DEPTH, T, sketch, wallPoint, wallLength, toWorld, floorAt, ceilAt, headAt, fitsAt } from '../public/world/backrooms/gen.js';
import { MIN_OUT_STEPS, THIN_W, MARK_W, LEAN, lean, pressing, TAPE_LABELS } from '../public/world/backrooms/marks.js';
import { planVisit, floorOf, generateVisit, MIN_FLOORS, MAX_FLOORS, MIN_VISIT_STEPS } from '../public/world/backrooms/plan.js';
import { THEMES, THEME_IDS } from '../public/world/backrooms/themes.js';

const office = {
  name: 'Robin', projects: ['Webstore', 'Mobile App', 'Infra'], agents: ['Ivory Marten', 'Amber Vireo', 'Ember Numbat', 'Olive Heron'],
  tasks: ['Cache the product catalogue', 'Trim the Docker image'],
};
const ALL = { card: true, coins: [1, 2, 3, 4] };
const SEEDS = Array.from({ length: 120 }, (_, i) => `visit-${i}`);
const visits = new Map();
const visitFor = (seed, opt = office) => { const k = seed + JSON.stringify(opt.loot || 0); if (!visits.has(k)) visits.set(k, generateVisit(seed, opt)); return visits.get(k); };

test('a visit is planned from its seed: three to five floors, yellow on top, the wall that gives only on the last', () => {
  const sizes = new Map(), orders = new Set(), under = new Set();
  for (const seed of SEEDS) {
    const plan = planVisit(seed, office);
    assert.deepEqual(plan, planVisit(seed, office), `seed ${seed}: the same seed plans the same visit`);
    assert.equal(JSON.stringify(plan), JSON.stringify(planVisit(seed, office)), 'and it is plain data');
    assert.ok(plan.depths >= MIN_FLOORS && plan.depths <= MAX_FLOORS, `seed ${seed}: ${plan.depths} floors`);
    assert.equal(plan.floors.length, plan.depths);
    assert.equal(plan.floors[0].theme, 'yellow', 'you always land in the yellow');
    assert.equal(new Set(plan.floors.map((f) => f.theme)).size, plan.depths, `seed ${seed}: two floors of one kind`);
    assert.equal(new Set(plan.floors.map((f) => f.label)).size, plan.depths, `seed ${seed}: two floors with the same number painted on the wall`);
    plan.floors.forEach((f, i) => {
      assert.equal(f.depth, i);
      assert.ok(THEMES[f.theme], `${f.theme} is a kind of floor`);
      assert.equal(f.way, i === plan.depths - 1 ? 'wall' : 'stairs', `seed ${seed}: floor ${i} ends in ${f.way}`);
      assert.equal(f.below, i === plan.depths - 1 ? 'G' : plan.floors[i + 1].label, 'the arrow on the wall points at the floor that is really under this one');
    });
    sizes.set(plan.depths, (sizes.get(plan.depths) || 0) + 1);
    orders.add(plan.floors.map((f) => f.theme).join('>'));
    for (const f of plan.floors.slice(1)) under.add(f.theme);
  }
  for (let n = MIN_FLOORS; n <= MAX_FLOORS; n++) assert.ok(sizes.get(n) > 5, `visits of ${n} floors: ${sizes.get(n) || 0} in ${SEEDS.length}`);
  assert.deepEqual([...under].sort(), THEME_IDS.filter((id) => id !== 'yellow').sort(), 'every kind of floor turns up under the yellow one');
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
      assert.equal(floors[i].theme, visit.floors[i].theme); assert.equal(floors[i].label, visit.floors[i].label);
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
      const door = generate(seed, { ...office, theme }), stairs = generate(seed, { ...office, theme, way: 'stairs' });
      assert.equal(door.exit.way, 'wall'); assert.equal(stairs.exit.way, 'stairs');
      const strip = (level) => JSON.parse(JSON.stringify(level, (k, v) => (k === 'way' || k === 'name' ? undefined : v)));
      assert.deepEqual(strip(stairs), strip(door), `seed ${seed}, ${theme}`);
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
      const fresh = DECK.length - had.size, again = level.picked.filter((id) => had.has(id)).length;
      // only a floor the unused deck could not fill takes anything it has dealt before (two to spare, for rooms that would not fit anywhere)
      if (fresh >= level.picked.length + 2) assert.equal(again, 0, `seed ${seed}, floor ${i}: ${again} rooms from the floors above, with ${fresh} still unused`);
      if (i < 2) assert.equal(again, 0, `seed ${seed}: the second floor repeats the first`);
      repeats += again > 0 ? 1 : 0; floorsSeen++;
      level.picked.forEach((id) => had.add(id));
      // a floor looks like what it is
      const theme = THEMES[level.theme], plain = level.rooms.filter((r) => r.kind === 'plain');
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

test('something follows you in some visits, not all — and never from more than one floor', () => {
  let with_ = 0, onTop = 0;
  for (const seed of SEEDS) {
    const { visit, floors } = visitFor(seed);
    const lairs = floors.filter((l) => l.pursuer).length;
    assert.ok(lairs <= 1, `seed ${seed}: ${lairs} mascots`);
    if (lairs) { with_++; assert.ok(floors[visit.mascot].pursuer, 'on the floor the plan says'); if (visit.mascot === 0) onTop++; }
    assert.equal(generateVisit(seed, { ...office, pursuer: false }).floors.filter((l) => l.pursuer).length, 0);
  }
  assert.ok(with_ > SEEDS.length * 0.3 && with_ < SEEDS.length * 0.9, `${with_} of ${SEEDS.length}`);
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

test('every floor has a thin place — a bare stretch of outside wall you can walk up to — and only the last floor\'s gives', () => {
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
      floors++; if (r.toExit <= 2) near++;
    });
  }
  assert.ok(near / floors > 0.65, `the thin place is within two doorways of the fire exit on ${Math.round(100 * near / floors)}% of floors`);
});

test('other walls carry the same kind of marks, and are only walls', () => {
  const styles = new Set();
  let marked = 0;
  for (const seed of SEEDS) {
    const { floors } = visitFor(seed);
    floors.forEach((level, i) => {
      const list = level.rooms.flatMap((r) => r.dress.filter((d) => d.type === 'marks').map((d) => ({ r, d })));
      assert.ok(list.length >= 1 && list.length <= 4, `seed ${seed}, floor ${i}: ${list.length} marked walls`);
      for (const { r, d } of list) {
        assert.ok(r.id !== level.thin.room, `seed ${seed}, floor ${i}: a decoy in the room with the real one`);
        assert.ok((r.kind === 'plain' || r.kind === 'start') && !r.crawl);
        assert.ok(Math.abs(d.at) + MARK_W / 2 <= wallLength(r, d.side) / 2 - 0.3);
        for (const o of [...r.doors, ...r.wins]) if (o.side === d.side) assert.ok(Math.abs(o.c - d.at) >= (o.w + MARK_W) / 2 + 0.3, `seed ${seed}: a mark across a doorway`);
        styles.add(d.style); marked++;
      }
    });
  }
  assert.deepEqual([...styles].sort(), ['pencil', 'tally', 'tape']);
  assert.ok(marked > SEEDS.length * 6);
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
