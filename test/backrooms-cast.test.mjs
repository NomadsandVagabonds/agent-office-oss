// The Backrooms — who is down there, and the rules they go by (public/world/backrooms/cast.js, cast/, doors.js).
// All of it pure: the rules are run against a made-up clock, the way reach.js is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateVisit } from '../public/world/backrooms/plan.js';
import { CAST, SUPPORTING, whoIsDown } from '../public/world/backrooms/cast.js';
import { HUNT, knows, lost, shown, noticeTime, wayOn, handle, atHandle, getsDown, lying, willPeek } from '../public/world/backrooms/cast/hunt.js';
import { roomRoute, roomCosts, gridPath, straighten } from '../public/world/backrooms/cast/paths.js';
import { DOORS, doorPlan, doorRooms, inTheWay } from '../public/world/backrooms/doors.js';

const office = { name: 'Robin', projects: ['Atlas', 'Harbor'], agents: ['Ivory Marten', 'Amber Vireo', 'Ember Numbat'], tasks: ['Ship the thing', 'Fix the other thing'] };
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const dt = 1 / 30;
const me = { x: 4, z: 0, room: 2 };
/** Run what-it-knows for some seconds of the same circumstances. */
const run = (s, secs, sense, rnd = () => 0.5) => { const seen = []; for (let t = 0; t < secs - 1e-9; t += dt) { s = knows(s, dt, { d: 5, me, room: 1, ...sense }, rnd); if (s.found) seen.push('found'); if (s.gaveUp) seen.push('gaveUp'); } return Object.assign(s, { events: seen }); };

test('the cast: the mascot is in every visit; the same seed is the same company', () => {
  assert.ok(CAST.some((m) => m.id === 'pirate' && m.always), 'he is the one who can be counted on');
  for (const seed of SEEDS) {
    const who = whoIsDown(seed);
    assert.equal(who[0], 'pirate');
    assert.deepEqual(who, whoIsDown(seed), `seed ${seed}`);
    assert.equal(new Set(who).size, who.length, 'nobody twice');
    assert.ok(who.length <= CAST.filter((m) => m.always).length + SUPPORTING);
    for (const id of who) assert.ok(CAST.some((m) => m.id === id));
    const { visit, floors } = generateVisit(seed, office);
    assert.ok(visit.mascot !== null && floors[visit.mascot].pursuer, `seed ${seed}: a visit without him`);
    assert.equal(floors.filter((l) => l.pursuer).length, 1, 'on one floor of it');
  }
  // with others to choose from, they rotate and he stays
  const more = [...CAST, { id: 'a', weight: 1 }, { id: 'b', weight: 1 }, { id: 'c', weight: 1 }, { id: 'never', weight: 0 }];
  const turns = new Map();
  for (let seed = 1; seed <= 300; seed++) { const who = whoIsDown(seed, more); assert.equal(who[0], 'pirate'); assert.equal(who.length, 1 + SUPPORTING); for (const id of who.slice(1)) turns.set(id, (turns.get(id) || 0) + 1); }
  assert.deepEqual([...turns.keys()].sort(), ['a', 'b', 'c']);
  for (const [id, n] of turns) assert.ok(n > 150 && n < 250, `${id} turned up in ${n} of 300`);
});

test('it hunts by what it sees: a line of sight to notice you, and nothing else will do', () => {
  assert.ok(noticeTime(1) < noticeTime(10) && noticeTime(10) < noticeTime(HUNT.far) && noticeTime(HUNT.far) <= 1);
  // no line of sight, however near and for however long: it knows nothing, and wanders
  let s = run(lost(), 60, { los: false, d: 1.5, exits: [{ room: 3 }, { room: 4 }], at: true });
  assert.equal(s.mode, 'wander'); assert.equal(s.last, null); assert.deepEqual(s.events, []);
  // a glimpse too short to count
  s = run(lost(), noticeTime(8) - 2 * dt, { los: true, d: 8, exits: [] });
  assert.equal(s.mode, 'wander');
  s = run(s, 1, { los: false, d: 8, exits: [] }); s = run(s, noticeTime(8) - 2 * dt, { los: true, d: 8, exits: [] });
  assert.equal(s.mode, 'wander', 'two glimpses do not add up to a look');
  // a look that is long enough
  s = run(lost(), noticeTime(8) + 2 * dt, { los: true, d: 8, exits: [] });
  assert.equal(s.mode, 'chase'); assert.deepEqual(s.events, ['found']); assert.deepEqual(s.last, me);
  // too far off to make out
  assert.equal(run(lost(), 20, { los: true, d: HUNT.far + 1, exits: [] }).mode, 'wander');
});

test('lose it: it goes to where it last saw you, looks, and then walks the floor with nothing to go on', () => {
  let s = run(shown(me), 2, { los: true });
  assert.equal(s.mode, 'chase');
  // round a corner: for a moment it still knows which way you went, and then it does not
  const gone = { x: 9, z: 9, room: 5 };
  s = knows(s, dt, { los: false, d: 6, me: gone, room: 1 });
  assert.equal(s.mode, 'chase'); assert.deepEqual(s.last, gone);
  for (let t = 0; t < HUNT.after + 2 * dt; t += dt) s = knows(s, dt, { los: false, d: 6, me: gone, room: 1 });
  assert.equal(s.mode, 'search');
  const far = { x: 30, z: 30, room: 9 };
  for (let t = 0; t < 5; t += dt) s = knows(s, dt, { los: false, d: 30, me: far, room: 1 });
  assert.equal(s.mode, 'search'); assert.deepEqual(s.last, gone, 'where you are now is nothing to it');
  s = knows(s, dt, { los: false, d: 30, me: far, room: 5, at: true });
  assert.equal(s.mode, 'look');
  s = run(s, HUNT.look - 0.2, { los: false, me: far, room: 5 }); assert.equal(s.mode, 'look');
  s = run(s, 0.4, { los: false, me: far, room: 5, exits: [{ room: 6 }] });
  assert.equal(s.mode, 'wander'); assert.ok(s.events.includes('gaveUp'));
  // wandering: a room, a while in it, another — and never the faintest idea where you are
  const visited = [];
  let room = 5;
  for (let t = 0; t < 120; t += dt) {
    const before = s.room;
    s = knows(s, dt, { los: false, d: 30, me: far, room, at: s.room === room, exits: [{ room: room + 1 }, { room: room - 1 }] }, Math.random);
    if (s.room !== null && s.room !== before) visited.push(s.room);
    if (s.room !== null && t % 2 < dt) room = s.room;                 // (it gets there)
    assert.equal(s.mode, 'wander');
  }
  assert.ok(visited.length >= 120 / (HUNT.linger[1] + 2) - 1 && visited.length <= 120 / HUNT.linger[0] + 1, `it tried ${visited.length} rooms in two minutes`);
  // until it sees you again
  s = run(s, 1.2, { los: true, d: 6 });
  assert.equal(s.mode, 'chase');
});

test('somewhere it cannot get to: it stares for a while, gives you up, and takes no more notice until it has lost sight of you', () => {
  let s = run(shown(me), HUNT.look - 0.3, { los: true, cannot: true });
  assert.equal(s.mode, 'chase');
  s = run(s, 0.6, { los: true, cannot: true, exits: [{ room: 3 }] });
  assert.equal(s.mode, 'wander'); assert.ok(s.blind);
  s = run(s, 10, { los: true, exits: [{ room: 3 }] });
  assert.equal(s.mode, 'wander', 'still in plain sight, and it has stopped caring');
  s = run(s, 0.2, { los: false, exits: [{ room: 3 }] });
  s = run(s, 1.5, { los: true, exits: [{ room: 3 }] });
  assert.equal(s.mode, 'chase', 'out of sight and back in, and it is after you again');
});

test('which way it wanders: anywhere, but rather through a door somebody has shut, and rather not back the way it came', () => {
  assert.equal(wayOn([], 1), null);
  assert.equal(wayOn([{ room: 7 }], 7), 7, 'a dead end: back is the only way');
  const tally = (exits, from, been) => { const n = new Map(); for (let i = 0; i < 4000; i++) { const r = wayOn(exits, from, () => (i + 0.5) / 4000, been); n.set(r, (n.get(r) || 0) + 1); } return n; };
  const even = tally([{ room: 1 }, { room: 2 }, { room: 3 }], null);
  for (const r of [1, 2, 3]) assert.ok(Math.abs(even.get(r) - 4000 / 3) < 40);
  const back = tally([{ room: 1 }, { room: 2 }, { room: 3 }], 2);
  assert.ok(back.get(2) < back.get(1) * 0.4);
  const been = tally([{ room: 1 }, { room: 2 }, { room: 3 }], null, [3, 9, 1]);
  assert.ok(been.get(2) > been.get(3) && been.get(3) > been.get(1), 'the room it does not remember, then the one it was in longest ago');
  const shut = tally([{ room: 1 }, { room: 2, shut: true }, { room: 3 }], null);
  assert.ok(shut.get(2) > shut.get(1) * 3, 'a door it left open and finds shut is something it has seen');
});

test('a shut door holds it up: seconds at the handle, which you can hear — and none of them while you are watching the door', () => {
  const work = (watched, secs) => { let h = atHandle(), rattles = 0, opened = null; for (let t = dt; t <= secs; t += dt) { h = handle(h, dt, watched(t)); if (h.rattle) rattles++; if (h.open && opened === null) opened = t; } return { rattles, opened }; };
  const free = work(() => false, 20);
  assert.ok(Math.abs(free.opened - HUNT.door) < 2 * dt, `open after ${free.opened} s`);
  assert.ok(HUNT.door >= 4 && HUNT.door <= 8, 'long enough to be worth shutting, short enough to be worth running');
  assert.ok(work(() => false, HUNT.door - 0.1).rattles >= 3, 'you hear it at the handle before it is through');
  assert.deepEqual(work(() => true, 60), { rattles: 0, opened: null }, 'watched, the handle is still');
  // look away for three seconds, back for ten, away again: only the seconds it was not watched count
  const stop = work((t) => t > 3 && t <= 13, 30);
  assert.ok(Math.abs(stop.opened - (HUNT.door + 10)) < 3 * dt);
});

test('the face at the hole: only after you have crawled away from it and turned your back, not always, and it gets up when you are not looking', () => {
  const ok = { since: 2, d: 3, turned: 1, there: true, room: true };
  assert.equal(getsDown(ok), true);
  for (const [k, v] of [['since', HUNT.peekWithin + 1], ['d', HUNT.peekGap[0] - 0.2], ['d', HUNT.peekGap[1] + 1], ['turned', 0.1], ['there', false], ['room', false]]) assert.equal(getsDown({ ...ok, [k]: v }), false, `${k}: ${v}`);
  assert.ok(HUNT.peekGap[0] > 1.25, 'never where it could reach you as it appears');
  let yes = 0; for (let i = 0; i < 1000; i++) if (willPeek(() => (i + 0.5) / 1000)) yes++;
  assert.ok(yes > 400 && yes < 800, `it bothers ${yes} times in a thousand`);
  // never looked at: it lies there a while and gets up
  let p = { t: 0, seen: 0, away: 0 }, up = null;
  for (let t = dt; t < 20 && up === null; t += dt) { p = lying(p, dt, false); if (p.up) up = t; }
  assert.ok(Math.abs(up - HUNT.peekFor) < 2 * dt);
  // looked at: one shock, it does not move for as long as you look, and it is gone soon after you look away
  p = { t: 0, seen: 0, away: 0 }; let shocks = 0;
  for (let t = dt; t < 30; t += dt) { p = lying(p, dt, t > 1); if (p.shock) shocks++; assert.equal(p.up, false); }
  assert.equal(shocks, 1);
  up = null; for (let t = dt; t < 5 && up === null; t += dt) { p = lying(p, dt, false); if (p.up) up = t; }
  assert.ok(Math.abs(up - HUNT.peekSeen) < 2 * dt);
});

test('the way between rooms is the walker\'s own: what cannot stand up in a crawl-height doorway goes round, or does not go', () => {
  let round = 0, noWay = 0, pairs = 0;
  for (const seed of SEEDS.slice(0, 12)) for (const level of generateVisit(seed, office).floors) {
    const tall = (d, from, to) => (d.h < 1.62 || level.rooms[to].crawl ? Infinity : 1);
    for (const link of level.links) {
      if (!(link.h < 1.62)) continue;
      pairs++;
      const any = roomRoute(level, link.a, link.b), path = roomRoute(level, link.a, link.b, tall);
      assert.deepEqual(any, [link.a, link.b]);
      if (!path) { noWay++; continue; }
      round++;
      assert.ok(path.length > 2 && path[0] === link.a && path[path.length - 1] === link.b);
      for (let i = 0; i + 1 < path.length; i++) { const d = level.rooms[path[i]].doors.find((k) => k.to === path[i + 1]); assert.ok(d && d.h >= 1.62, 'every doorway on its way is one it can stand up in'); }
    }
    // what a way costs is what its doorways cost: a shut door is worth a detour and no more
    const costs = roomCosts(level, level.start.room, () => 1).cost;
    assert.equal(costs.size, level.rooms.length);
  }
  assert.ok(pairs > 40 && round > 0 && noWay > 0, `${pairs} low doorways: ${round} with a way round, ${noWay} with none`);
});

test('the way across a room goes round what is in it, never through a corner, and stops as near as it can get', () => {
  // 9 × 7, a wall down the middle with a gap at the top
  const nx = 9, nz = 7, ok = new Uint8Array(nx * nz).fill(1);
  for (let j = 1; j < nz; j++) ok[4 + nx * j] = 0;
  const from = 1 + nx * 5, to = 7 + nx * 5;
  const { cells, reached } = gridPath(nx, nz, ok, from, to);
  assert.ok(reached && cells[0] === from && cells[cells.length - 1] === to);
  for (let i = 0; i + 1 < cells.length; i++) {
    const a = cells[i], b = cells[i + 1], ai = a % nx, aj = (a - ai) / nx, bi = b % nx, bj = (b - bi) / nx;
    assert.ok(ok[b] && Math.abs(ai - bi) <= 1 && Math.abs(aj - bj) <= 1);
    if (ai !== bi && aj !== bj) assert.ok(ok[bi + nx * aj] && ok[ai + nx * bj], 'no squeezing between two corners');
  }
  assert.ok(cells.some((k) => k === 4), 'through the gap');
  // shut the gap: it gets as near as it can, and says it did not get there
  ok[4] = 0;
  const shut = gridPath(nx, nz, ok, from, to);
  assert.equal(shut.reached, false);
  assert.equal(shut.cells[shut.cells.length - 1] % nx, 3, 'up against the wall, on its own side');
  // a step too high is a wall
  ok[4] = 1;
  const floor = new Float32Array(nx * nz); for (let j = 0; j < nz; j++) for (let i = 5; i < nx; i++) floor[i + nx * j] = 1;
  assert.equal(gridPath(nx, nz, ok, from, to, floor).reached, false);
  // and a path is only as bent as it has to be
  const straight = straighten(cells, (a, b) => { const ai = a % nx, bi = b % nx; return (ai < 4) === (bi < 4) || (a - ai) / nx === 0 && (b - bi) / nx === 0; });
  assert.ok(straight.length < cells.length && straight[0] === from && straight[straight.length - 1] === to);
});

test('doors: a few ordinary doorways a floor, the same ones for the same seed, never where they could be in anybody\'s way', () => {
  let total = 0, floors = 0, withDoors = 0;
  for (const seed of SEEDS.slice(0, 25)) for (const level of generateVisit(seed, office).floors) {
    const plan = doorPlan(level);
    floors++; total += plan.length; if (plan.length) withDoors++;
    assert.deepEqual(plan, doorPlan(level), 'the same floor, the same doors');
    assert.equal(new Set(plan.map((d) => d.link)).size, plan.length);
    const able = level.links.filter((l) => doorRooms(level, l).length).length;
    assert.ok(plan.length === Math.min(able, Math.max(DOORS.least, Math.round(able * DOORS.share))));
    for (const d of plan) {
      const link = level.links[d.link], room = level.rooms[d.room], other = level.rooms[d.other];
      assert.ok(link.kind === 'door' && !link.door, 'an ordinary doorway: not a crawl hole, an arch, a slit, or a door a room keeps locked');
      assert.ok(d.w <= DOORS.widest + 1e-9 && d.h >= DOORS.lowest);
      assert.equal(room.kind, 'plain', 'the leaves stand open in a plain room');
      assert.ok(!(level.pursuer && level.pursuer.room === room.id), 'not in the room with the plinth');
      for (const r of [room, other]) {
        assert.ok(r.kind !== 'start' && r.kind !== 'exit' && !r.crawl, 'never where you land, or on the way out');
        assert.ok(r.doors.find((k) => k.link === d.link).sill <= 0.01, 'never at the top of a flight of stairs');
      }
      assert.deepEqual([link.a, link.b].sort(), [d.room, d.other].sort());
    }
  }
  assert.ok(withDoors > floors * 0.9 && total / floors >= 3 && total / floors <= 14, `${total} doors on ${floors} floors (${withDoors} floors with any)`);
});

test('a door will not shut on anybody: in the doorway, or up against it, you are in the way; standing clear in either room you are not', () => {
  const w = 1.8, T = 0.2;
  assert.equal(inTheWay(w, T, 0, -T / 2), true, 'in the doorway');
  assert.equal(inTheWay(w, T, 0.5, 0.1), true, 'up against where the leaves meet');
  assert.equal(inTheWay(w, T, 0, 0.55), false, 'a step into the room the doors are in: clear');
  assert.equal(inTheWay(w, T, 0, -(T + 0.55)), false, 'a step into the room beyond: clear');
  assert.equal(inTheWay(w, T, w / 2 + 0.5, 0), false, 'beside the opening');
});
