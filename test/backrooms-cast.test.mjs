// The Backrooms — who is down there, and the rules they go by (public/world/backrooms/cast.js, cast/, doors.js).
// All of it pure: the rules are run against a made-up clock, the way reach.js is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateVisit } from '../public/world/backrooms/plan.js';
import fs from 'node:fs';
import { CAST, ALL_CAST, SUPPORTING, DISPOSITIONS, ITEMS, ROOM_LESSONS, CAST_LESSONS, whoIsDown, castFor, homeFor } from '../public/world/backrooms/cast.js';
import { THEME_IDS } from '../public/world/backrooms/themes.js';
import { HUNT, knows, lost, shown, spent, noticeTime, wayOn, handle, atHandle, getsDown, lying, willPeek } from '../public/world/backrooms/cast/hunt.js';
import { roomRoute, roomCosts, gridPath, straighten } from '../public/world/backrooms/cast/paths.js';
import { SHADOW, away, watched, drained } from '../public/world/backrooms/cast/shadow.rule.js';
import { MOTH, resting, flits } from '../public/world/backrooms/cast/moth.rule.js';
import { PORTER, mopping, minds, facesYou } from '../public/world/backrooms/cast/porter.rule.js';
import { createWalk, clearOfAbsorbed, ABSORBED_GAP } from '../public/world/backrooms/cast/walk.js';
import { OTHER_DOOR, shut, pretends, let_, took, holds, open, inFront, walksInto, cueGap, doorSpots } from '../public/world/backrooms/cast/other-door.rule.js';
import { makeRng } from '../public/world/backrooms/gen.js';
import { TONER, perched, hatchedBrood, isQuiet, weaveOffset, stepToner, strikeToner, snipToner } from '../public/world/backrooms/cast/toner.rule.js';
import { SNIP_TUNING, rankSnipTargets, strikeSnip } from '../public/world/backrooms/melee.js';
import { FIRE_WAYS, FIRE_FEAR, calm, afraid, tooNear } from '../public/world/backrooms/cast/fire.rule.js';
import { BLACKOUT, createBlackoutState, stepBlackout } from '../public/world/backrooms/rooms/blackout-bay/rule.js';
import { ARCHETYPES } from '../public/world/backrooms/gen.js';
import * as SUNK from '../public/world/backrooms/absorbed/rule.js';
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
  const more = [...CAST.filter((m) => m.always), { id: 'a', weight: 1 }, { id: 'b', weight: 1 }, { id: 'c', weight: 1 }, { id: 'never', weight: 0 }];
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

/* ---- the creature contract (docs/BACKROOMS.md, "Adding a creature") --------------------------------------- */

const DIR = new URL('../public/world/backrooms/', import.meta.url);

test('a creature\'s line in the cast: every field the guide promises, and nothing that hunts by another name', () => {
  const ids = new Set(), teaches = new Set();
  assert.equal(ALL_CAST.filter((m) => m.always).length, 1, 'one of them is always down there, and only one');
  for (const m of ALL_CAST) {
    const where = `cast: ${m.id}`;
    assert.match(m.id, /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, where); assert.ok(!ids.has(m.id), `${where}: twice`); ids.add(m.id);
    for (const k of ['name', 'rule']) assert.ok(typeof m[k] === 'string' && m[k].length > 3, `${where}: ${k}`);
    assert.ok(DISPOSITIONS.includes(m.disposition), `${where}: disposition`);
    assert.ok(m.home === 'roams' || m.home === 'room', `${where}: home`);
    assert.ok(m.always || (m.weight >= 0 && m.weight <= 3), `${where}: weight`);
    if (m.teaches !== undefined) { assert.ok(CAST_LESSONS[m.teaches], `${where}: teaches a lesson nobody has written down`); assert.ok(!teaches.has(m.teaches), `${where}: ${m.teaches} already has a teacher`); teaches.add(m.teaches); }
    for (const n of m.needs || []) assert.ok(CAST_LESSONS[n] || ROOM_LESSONS.includes(n), `${where}: needs ${n}`);
    assert.ok(!(m.needs || []).includes(m.teaches), `${where}: needs what it teaches`);
    for (const t of Object.keys(m.themes || {})) assert.ok(THEME_IDS.includes(t) && m.themes[t] >= 0, `${where}: themes.${t}`);
    assert.ok(Array.isArray(m.items) && m.items.every((i) => ITEMS.includes(i)), `${where}: items`);
    const c = m.caught || {};
    assert.equal(['hurt', 'ends', 'setback'].filter((k) => k in c).length, 1, `${where}: says one thing about what being caught by it costs`);
    if ('hurt' in c) assert.ok(Number.isInteger(c.hurt) && c.hurt >= 1 && c.hurt <= 4, `${where}: hurt`);
    if ('ends' in c) assert.ok(c.ends === true && m.disposition === 'hunts', `${where}: only what hunts may end a visit`);
    if ('setback' in c) assert.ok(typeof c.setback === 'string' && c.setback.length > 8, `${where}: setback`);
    if (m.disposition !== 'hunts') assert.ok(!('ends' in c));
    if (m.home === 'room') assert.ok(m.room && m.room.w >= 3 && m.room.d >= 3 && m.room.w <= 12 && m.room.d <= 12, `${where}: the floor it needs`);
  }
  for (const [id, what] of Object.entries(CAST_LESSONS)) { assert.match(id, /^[a-z]+$/); assert.ok(what.length > 12 && !ROOM_LESSONS.includes(id)); }
});

test('a creature\'s file: named for it, listed, exports create(c), keeps its rule where it can be tested, and reaches for nothing outside', () => {
  const index = fs.readFileSync(new URL('cast/index.js', DIR), 'utf8');
  const BANNED = [[/\bfetch\s*\(/, 'the network'], [/XMLHttpRequest|WebSocket|EventSource/, 'the network'], [/localStorage|sessionStorage|indexedDB|document\.cookie/, 'the browser\'s storage'],
    [/https?:\/\//, 'an address'], [/\bnew\s+Audio\b|\.(mp3|ogg|wav)\b/, 'a sound file'], [/\beval\s*\(|new\s+Function\b/, 'eval'], [/env\.end\s*\(/, 'ending the visit itself (c.hurt does that)']];
  for (const m of ALL_CAST) {
    const file = new URL(`cast/${m.id}.js`, DIR);
    assert.ok(fs.existsSync(file), `cast/${m.id}.js is not there`);
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, /export\s+function\s+create\s*\(\s*c\s*\)/, `cast/${m.id}.js: export function create(c)`);
    assert.ok(new RegExp(`from\\s+'\\./${m.id}\\.js'`).test(index) && new RegExp(`\\b${m.id.replace(/-(.)/g, (_, ch) => ch.toUpperCase())}\\b`).test(index.split('MAKERS')[1] || ''), `cast/index.js does not list ${m.id}`);
    for (const [re, what] of BANNED) if (!(m.id === 'pirate' && what.startsWith('ending'))) assert.ok(!re.test(src), `cast/${m.id}.js reaches for ${what}`);
    for (const spec of [...src.matchAll(/from\s+'([^']+)'/g)].map((k) => k[1])) {
      assert.ok(spec === 'three' || /^\.\.?\//.test(spec), `cast/${m.id}.js imports ${spec}`);
      assert.ok(!/^\.\.\/(index|world|player|input|hud|vhs|sound|loot|pursuer)\.js$/.test(spec), `cast/${m.id}.js imports ${spec}: what it needs of the level comes through c`);
    }
    // its rule is pure and somewhere a test can run it: its own exports, or a module of rules beside it
    const pure = [...src.matchAll(/from\s+'(\.\/[a-z.-]+\.js|\.\.\/reach\.js)'/g)].map((k) => k[1]).filter((k) => k !== './index.js');
    assert.ok(pure.length > 0, `cast/${m.id}.js: no rule a test could run`);
    for (const k of pure.filter((x) => x.startsWith('./'))) assert.ok(!/from\s+'three'|document\.|window\./.test(fs.readFileSync(new URL('cast/' + k.slice(2), DIR), 'utf8')), `cast/${k.slice(2)} is not pure`);
  }
});

test('who is on which floor, and in which room: one floor each, the same for the same seed, nothing that needs a lesson where you land', () => {
  const more = [...CAST.filter((m) => m.always),
    { id: 'roamer', disposition: 'hunts', home: 'roams', weight: 1, needs: ['sight'], items: [] },
    { id: 'homebody', disposition: 'helps', home: 'room', weight: 1, needs: [], items: [], room: { w: 4, d: 4 }, themes: { yellow: 0 } },
    { id: 'big', disposition: 'keeps to itself', home: 'room', weight: 1, needs: [], items: [], room: { w: 11, d: 11 } }];
  let homes = 0, none = 0;
  for (const seed of SEEDS.slice(0, 30)) {
    const { visit, floors } = generateVisit(seed, office), cast = castFor(visit, undefined, more);
    assert.deepEqual(cast, castFor(visit, undefined, more));
    assert.deepEqual(cast.map((k) => k.id), whoIsDown(seed, more).filter((id) => cast.some((k) => k.id === id)));
    assert.deepEqual(cast[0], { id: 'pirate', floor: null }, 'the mascot goes where the plan puts him, and down the stairs after you');
    for (const k of cast.slice(1)) {
      assert.ok(Number.isInteger(k.floor) && k.floor >= 0 && k.floor < visit.depths);
      if (k.id === 'roamer') assert.ok(k.floor > 0, 'what takes a lesson for granted is never on the floor you land on');
      if (k.id === 'homebody') assert.notEqual(visit.floors[k.floor].theme, 'yellow');
      assert.deepEqual(castFor(visit, k.floor, more).filter((x) => x.id === k.id), [k]);
      const m = more.find((x) => x.id === k.id), level = floors[k.floor], home = homeFor(level, m);
      assert.equal(home, homeFor(level, m));
      if (m.home !== 'room') { assert.equal(home, null); continue; }
      if (home === null) { none++; continue; }
      homes++;
      const r = level.rooms[home];
      assert.ok(r.kind === 'plain' && !r.crawl && home !== level.start.room && !(level.pursuer && level.pursuer.room === home));
      assert.ok(Math.max(r.W, r.D) >= m.room.w && Math.min(r.W, r.D) >= m.room.d - 1e-9);
      assert.ok(roomRoute(level, level.start.room, home).length - 1 >= 3, 'a little way in');
    }
    for (let i = 0; i < visit.depths; i++) assert.ok(castFor(visit, i, more).some((k) => k.id === 'pirate'));
  }
  assert.ok(homes > 10 && none > 0, `${homes} homes found, ${none} floors with no room that would do`);
  assert.deepEqual(castFor(null), [{ id: 'pirate', floor: null }]);
});

test('with health to take, being grabbed costs two of four and it keeps away a while; it is not interested until that is over', () => {
  assert.equal(HUNT.grab, 2, 'the second time is the last');
  assert.equal(CAST.find((m) => m.id === 'pirate').caught.hurt, HUNT.grab, 'and the cast says so');
  for (const r of [0, 0.5, 0.999]) { const s = spent(() => r); assert.ok(s.spent >= HUNT.spent[0] && s.spent <= HUNT.spent[1] && s.mode === 'wander'); }
  let s = run(spent(() => 0), HUNT.spent[0] - 0.5, { los: true, d: 2, exits: [{ room: 3 }] });
  assert.equal(s.mode, 'wander', 'in plain sight, a pace away, and it does not care');
  s = run(s, 1.5, { los: true, d: 2, exits: [{ room: 3 }] });
  assert.equal(s.mode, 'chase', 'and then it does');
});

test('the shadow: a glance cools; a sustained stare arms it, then its fuse runs whether watched or not', () => {
  const lurk = () => { let s = away(() => 0.5, true); for (let t = 0; t < 30 && s.mode !== 'lurk'; t += dt) s = watched(s, dt, { placed: true, looked: false, d: 6 }, () => 0.5); assert.equal(s.mode, 'lurk'); return s; };
  // it is not there at first, and it does not arrive until there is somewhere out of sight for it to stand
  let s = away(() => 0.5, true), asked = 0;
  for (let t = 0; t < 60; t += dt) { s = watched(s, dt, { placed: false, looked: false, d: Infinity }); if (s.shift) asked++; assert.equal(s.mode, 'away'); }
  assert.ok(asked > 100, 'it keeps asking for a place');
  // never looked at: nothing, for ever — though it moves about, while it is off the picture
  s = lurk(); let moves = 0;
  for (let t = 0; t < 300; t += dt) { s = watched(s, dt, { placed: true, looked: false, d: 4 }, () => 0.5); assert.ok(!s.burst && s.heat === 0); if (s.shift) moves++; }
  assert.equal(s.mode, 'lurk'); assert.ok(moves > 5);
  // a glance costs nothing, and is forgotten
  s = lurk();
  for (let t = 0; t < SHADOW.charge * 0.6; t += dt) { s = watched(s, dt, { placed: true, looked: true, d: 6 }); assert.ok(!s.burst && !s.cleared); }
  assert.ok(s.heat > 0.4 && s.heat < 1, 'it whitens: that is the warning');
  for (let t = 0; t < 3; t += dt) s = watched(s, dt, { placed: true, looked: false, d: 6 });
  assert.equal(s.heat, 0);
  // keep it on the picture: a charge, then a separate fuse, then one burst
  s = lurk(); let bursts = 0, when = null;
  for (let t = dt; t < 20; t += dt) { s = watched(s, dt, { placed: s.mode === 'lurk' || s.mode === 'armed', looked: true, exposed: true, d: 6 }, () => 0.5); if (s.burst) { bursts++; when ??= t; } }
  assert.equal(bursts, 1); assert.ok(Math.abs(when - SHADOW.charge - SHADOW.fuse) < 3 * dt, `after ${when} s`);
  assert.ok(SHADOW.charge >= 1 && SHADOW.fuse >= .7, 'a deliberate stare, and then a usable window to look away');
  assert.ok(s.mode === 'away' && s.t > SHADOW.gone[0] - 20);
  // once it is white, get it off the picture before that fuse expires
  s = watched(lurk(), SHADOW.charge, { placed: true, looked: true, exposed: true, d: 6 });
  assert.equal(s.mode, 'armed'); assert.equal(s.heat, 1);
  s = watched(s, SHADOW.fuse + .01, { placed: true, looked: false, exposed: false, d: 6 });
  assert.ok(s.mode === 'gone' && s.cleared && !s.burst);
  s = watched(s, 120, { placed: false, looked: false, d: Infinity });
  assert.ok(s.mode === 'gone' && !s.cleared && !s.shift, 'gone for the rest of the floor, not another cooldown');
  // too far off to count; and walking into it is the same as staring
  s = lurk(); for (let t = 0; t < 10; t += dt) { s = watched(s, dt, { placed: true, looked: true, d: SHADOW.far + 1 }); assert.ok(!s.burst); }
  s = watched(lurk(), dt, { placed: true, looked: false, d: SHADOW.touch - 0.1 }); assert.ok(s.burst);
  // what it takes
  assert.equal(drained(300), 150); assert.equal(SHADOW.drain, 0.5);
});

test('the desk moth: it waits at a light until you have seen it and come up to it, then it is off to the next; a lit torch is a better light than any', () => {
  const far = { d: 9, seen: true, next: true }, near = { d: MOTH.near - 0.5, seen: true, next: true };
  let s = resting();
  for (let t = 0; t < 60; t += dt) { s = flits(s, dt, far); assert.equal(s.mode, 'round'); }
  // walked up to without ever having been looked at: it stays (it does not lead somebody who has not noticed it)
  s = resting(); for (let t = 0; t < 10; t += dt) s = flits(s, dt, { ...near, seen: false });
  assert.equal(s.mode, 'round');
  // seen, and come up to: off it goes, once, and it is not interested in you until it has got there
  s = resting(); let moves = 0;
  for (let t = 0; t < 5; t += dt) { s = flits(s, dt, near); if (s.moved) moves++; }
  assert.equal(s.mode, 'fly'); assert.equal(moves, 1);
  s = flits(s, dt, { ...near, there: true }); assert.equal(s.mode, 'round'); assert.equal(s.seen, 0, 'and it waits to be noticed again');
  // at the end of the way there is nowhere further: it goes round the last light for good
  s = resting(); for (let t = 0; t < 20; t += dt) s = flits(s, dt, { ...near, next: false });
  assert.equal(s.mode, 'round');
  // a lit torch: it goes round you, and leads nowhere; put it out and it goes back to its tube
  s = flits(resting(), dt, { ...near, torch: true }); assert.equal(s.mode, 'pester');
  for (let t = 0; t < 20; t += dt) { s = flits(s, dt, { ...near, torch: true }); assert.ok(s.mode === 'pester' && !s.moved); }
  s = flits(s, dt, near); assert.equal(s.mode, 'round');
});

test('the night porter: nothing, unless you knock his bucket over; then the room, then the doors — and standing it up again puts it right, and opens his locker once', () => {
  const idle = { bucket: 3, moving: true, inRoom: true };
  let s = mopping();
  for (let t = 0; t < 120; t += dt) { s = minds(s, dt, idle); assert.equal(s.mode, 'mop'); }
  s = minds(s, dt, { ...idle, bucket: PORTER.knock - 0.05, moving: false }); assert.equal(s.mode, 'mop', 'standing beside it is not knocking it');
  s = minds(s, dt, { ...idle, bucket: PORTER.knock - 0.05 }); assert.ok(s.mode === 'upset' && s.knocked);
  let events = 0; for (let t = 0; t < 30; t += dt) { s = minds(s, dt, { ...idle, bucket: 0.1 }); if (s.knocked || s.lockUp || s.gift) events++; }
  assert.equal(s.mode, 'upset'); assert.equal(events, 0, 'it stays as it is for as long as you stay');
  // walk out on it: he locks up, once
  let locks = 0; for (let t = 0; t < 10; t += dt) { s = minds(s, dt, { ...idle, inRoom: false }); if (s.lockUp) locks++; }
  assert.equal(s.mode, 'shut'); assert.equal(locks, 1);
  // come back and stand it up: mopping again, and the locker is open — the first time only
  s = minds(s, dt, { ...idle, righted: true }); assert.ok(s.mode === 'mop' && s.righted && s.gift && s.thanked);
  s = minds(s, dt, { ...idle, bucket: 0.1 }); s = minds(s, dt, { ...idle, righted: true });
  assert.ok(s.mode === 'mop' && !s.gift, 'he is not paying you to keep knocking it over');
  assert.ok(PORTER.dim > 0.1 && PORTER.dim < 0.5, 'dim, not dark: a setback, not a trap');
  // his back while he mops; what he has for a face for as long as the bucket is on its side, turned to you slowly
  assert.equal(facesYou(mopping()), false); assert.equal(facesYou({ ...mopping(), mode: 'upset' }), true); assert.equal(facesYou({ ...mopping(), mode: 'shut' }), true);
  assert.ok(PORTER.round < 2 && PORTER.turn > 6.7, 'he turns to you slowly, and away faster than anybody can run round him');
});

test('fire: every creature says what one is to it; one that fears it backs off from a fire beside it and will not stand near one', () => {
  for (const m of ALL_CAST) assert.ok(FIRE_WAYS.includes(m.fire), `${m.id}: fire is one of ${FIRE_WAYS.join(', ')}`);
  assert.equal(CAST.find((m) => m.id === 'pirate').fire, 'fears', 'a fire is the one way to hold the mascot off');
  for (const a of Object.values(ARCHETYPES)) if (a.fire !== undefined) assert.ok(a.resident && FIRE_WAYS.includes(a.fire), `${a.id}: fire is what it is to whoever lives there`);
  const fire = { x: 0, z: 0 };
  // out of its reach: nothing; standing where it would be too near: no
  assert.equal(afraid(calm(), dt, { x: FIRE_FEAR.keep + 0.5, z: 0 }, fire).flee, false);
  assert.equal(afraid(calm(), dt, { x: 1, z: 0 }, null).flee, false);
  assert.ok(tooNear({ x: 1, z: 1 }, fire) && !tooNear({ x: FIRE_FEAR.keep + 0.01, z: 0 }, fire) && !tooNear({ x: 0, z: 0 }, null));
  // lit beside it: straight away from it, this moment and every moment until it is clear and has kept going a while
  let at = { x: 1, z: 0, yaw: 0 }, s = calm(), secs = 0;
  for (; secs < 20; secs += dt) {
    s = afraid(s, dt, at, fire);
    if (!s.flee) break;
    assert.ok(Math.abs(s.away - Math.PI / 2) < 1e-9 && s.step > 0 && s.step <= FIRE_FEAR.speed * dt + 1e-9);
    at = { ...at, x: at.x + Math.sin(s.away) * s.step, z: at.z + Math.cos(s.away) * s.step };
  }
  assert.ok(at.x > FIRE_FEAR.keep + FIRE_FEAR.speed * FIRE_FEAR.memory * 0.9, `it stopped ${at.x.toFixed(2)} m off`);
  assert.ok(secs < 4, 'and it is over quickly');
  assert.ok(FIRE_FEAR.speed > 1.85, 'it goes faster than it ever comes');
  // the fire goes out under it: it still finishes backing off, and then it is not afraid of anything
  s = afraid(calm(), dt, { x: 1, z: 0 }, fire); let more = 0;
  for (let t = 0; t < 5; t += dt) { s = afraid(s, dt, { x: 1, z: 0 }, null); if (s.flee) more += dt; }
  assert.ok(Math.abs(more - FIRE_FEAR.memory) < 0.1 && s.from === null);
  // lit exactly underfoot: the way it was not facing; and a moment that is no time at all moves nothing
  assert.ok(Math.abs(afraid(calm(), dt, { x: 0, z: 0, yaw: 1 }, fire).away - (1 + Math.PI)) < 1e-9);
  assert.equal(afraid(calm(), 0, { x: 1, z: 0 }, fire).flee, false);
  // a doorway is narrower than the room a fire keeps round itself: one lit in a doorway shuts it, to anything that fears it
  assert.ok(FIRE_FEAR.keep > DOORS.widest / 2 + 0.5 && FIRE_FEAR.keep < 6, 'wider than half a doorway, and no further than a fire is seen from');
  // and to what hunts, a way it will not go is a way it cannot: it stands off for as long as it would look, and gives you up
  const stood = run(shown(me), HUNT.look + 0.5, { los: true, cannot: true });
  assert.ok(stood.events.includes('gaveUp') && stood.mode === 'wander');
});

test('fire: the moth goes to one it can see, and into it; the stand-ins are held by one, and paper burning is light enough to stand in', () => {
  const near = { d: 3, seen: true, torch: false, next: true, there: false };
  // a fire it can see: that, before a torch and before the next tube
  let s = flits(resting(), dt, { ...near, torch: true, fire: true, atFire: false });
  assert.equal(s.mode, 'flame');
  for (let t = 0; t < 30; t += dt) { s = flits(s, dt, { ...near, fire: true, atFire: false }); assert.ok(s.mode === 'flame' && !s.burnt, 'on its way, however long that takes'); }
  // at it: round it for a little, and then once, and for good
  let burnt = 0, secs = 0;
  for (; secs < 20 && s.mode !== 'gone'; secs += dt) { s = flits(s, dt, { ...near, fire: true, atFire: true }); if (s.burnt) burnt++; }
  assert.equal(s.mode, 'gone'); assert.equal(burnt, 1); assert.ok(Math.abs(secs - MOTH.burn) < 0.1);
  for (let t = 0; t < 5; t += dt) { s = flits(s, dt, near); assert.ok(s.mode === 'gone' && !s.burnt && !s.moved, 'nothing brings it back'); }
  // the paper burns out before it gets there: it goes round wherever it has got to, and can be followed again
  s = flits(flits(resting(), dt, { ...near, fire: true }), dt, near);
  assert.equal(s.mode, 'round'); assert.equal(s.seen, 0);
  // the stand-ins (rooms/blackout-bay): one that can see a fire does not move, torch or no torch
  const targets = [{ x: 0, z: -6, los: true, fire: true }, { x: 3, z: -6, los: true, fire: false }];
  let r = stepBlackout(createBlackoutState(2), { dt, inDark: true, hasFlashlight: false, px: 0, pz: 0, yaw: 0, targets });
  assert.deepEqual(r.speeds.map((v) => v > 0), [false, true]); assert.deepEqual(r.frozen, [true, false]);
  assert.ok(r.red > 0, 'in the dark with no light of your own the red still comes');
  // …and standing within sight of the fire is standing in light: no red, for as long as it burns
  let st = createBlackoutState(2);
  for (let t = 0; t < BLACKOUT.redFillSeconds * 2; t += dt) { r = stepBlackout(st, { dt, inDark: true, hasFlashlight: false, byFire: true, px: 0, pz: 0, yaw: 0, targets }); st = r.state; }
  assert.equal(r.red, 0); assert.equal(r.speeds[0], 0);
  assert.equal(ARCHETYPES['blackout-bay'].fire, 'fears');
});

test('the absorbed staff: nothing of the cast walks through one or stops on one', () => {
  const sunk = [{ x: 4, z: 4 }, { x: -2, z: 9 }];
  assert.ok(clearOfAbsorbed(null, 4, 4) && clearOfAbsorbed([], 4, 4), 'a part with none of them, or before they are placed');
  assert.equal(clearOfAbsorbed(sunk, 4, 4), false);
  assert.equal(clearOfAbsorbed(sunk, 4 + ABSORBED_GAP - 0.01, 4), false);
  assert.equal(clearOfAbsorbed(sunk, 4 + ABSORBED_GAP + 0.01, 4), true);
  assert.ok(ABSORBED_GAP >= 0.4 && ABSORBED_GAP <= 0.7, 'their body, not their reach: a corridor with one in the wall can still be walked');
  // the walker's own footing test asks it: a floor that is otherwise free everywhere
  const env = { level: { rooms: [] }, world: { free: () => true, headroom: () => 3 }, absorbed: sunk };
  const walk = createWalk(env), it = { x: 0, z: 0, r: 0.3, tall: 1.6 };
  assert.equal(walk.stand(it, 0, 0), true);
  assert.equal(walk.stand(it, 4.2, 4.1), false);
  assert.equal(walk.stand(it, -2, 9.3), false);
  env.absorbed = [];
  assert.equal(walk.stand(it, 4.2, 4.1), true, 'and where there are none, as before');
});

test('crawl spaces: only a walker that says it crawls goes into one; fitting through the hole is not the same thing', () => {
  // a room, a crawl space off it through a crawl hole, and nothing shut
  const rooms = [
    { id: 0, def: { H: 2.6, doors: [{ link: 0, to: 1, h: 0.8 }] } },
    { id: 1, def: { H: 0.95, crawl: true, doors: [{ link: 0, to: 0, h: 0.8 }] } },
  ];
  const env = { level: { rooms: [] }, world: { rooms, throats: [{ open: true }], roomAt: () => rooms[0], free: () => true, headroom: () => 0.95 } };
  const walk = createWalk(env);
  const moth = { x: 0, z: 0, r: 0.1, tall: 0.6, opens: false };
  const toner = { x: 0, z: 0, r: TONER.r, tall: TONER.tall, opens: TONER.opens, crawls: TONER.crawls };
  assert.equal(TONER.crawls, true);
  assert.equal(walk.shy(moth, rooms[1]), true, 'the moth fits through the hole and keeps out of the crawl space, as it always has');
  assert.deepEqual(walk.exits(moth), []);
  assert.equal(walk.shy(toner, rooms[1]), false);
  assert.deepEqual(walk.exits(toner), [{ room: 1, shut: false }], 'the waste toner goes in after you');
  assert.deepEqual(walk.exits({ ...toner, tall: 1.62 }), [], 'saying so does not get anybody through a hole they do not fit');
  assert.equal(walk.shy({ ...toner, tall: 1.2 }, rooms[1]), true, '…or into a room they could not be in');
  env.world.throats[0].open = false;
  assert.deepEqual(walk.exits(toner), [], 'and a doorway that is shut is shut for it too');
  // every walker the creature's file makes says so (the ones it only tries a spot with as well: a spot in a crawl space is a spot)
  const src = fs.readFileSync(new URL('../public/world/backrooms/cast/toner.js', import.meta.url), 'utf8');
  const walkers = src.match(/tall: TONER\.tall/g) || [], crawlers = src.match(/tall: TONER\.tall, opens: TONER\.opens, crawls: TONER\.crawls/g) || [];
  assert.ok(walkers.length >= 3 && walkers.length === crawlers.length, `${walkers.length} walkers, ${crawlers.length} of them say they crawl`);
});

test('the waste toner: the bite that takes the last heart is the last thing any of them does', () => {
  // (the rule cannot know: being got is the conductor's c.hurt. What the creature's file does with the answer is read here,
  // and was seen in a browser: before this it stayed on the visitor biting, and buzzing, every frame until the picture went)
  const src = fs.readFileSync(new URL('../public/world/backrooms/cast/toner.js', import.meta.url), 'utf8');
  assert.match(src, /const hit = c\.hurt\(TONER\.hitDamage\);\s+(\/\/[^\n]*\n\s+)*if \(hit\.dead \|\| hit\.ended\) \{ over = true; return; \}/, 'nothing more once the visit is ending');
  assert.match(src, /if \(!placed \|\| !units\.length \|\| over\) return;/, 'and none of the others either');
  assert.ok(!/env\.end\(/.test(src), 'it never ends a visit itself: being caught is c.hurt');
  // the rule's own answer to a hit that did not count (they were hit a moment ago) is to go back up, not to try again at once
  const s = strikeToner({ ...perched(() => 0.5), mode: 'chase' }, { landed: false, dead: false, ended: false }, () => 0.5);
  assert.equal(s.mode, 'recoil'); assert.equal(s.hits, 0); assert.ok(s.t > 2 && s.t < TONER.recoilTime[1]);
});

test('the absorbed staff: a hold never turns the visitor\'s head while something that hunts is near and in sight', () => {
  const { ABSORBED: A, tugsTheCamera, HUNTER_NEAR, TUG_SECONDS } = SUNK;
  // nobody about: the first half second of a hold pulls the look round to the face, and then lets it go
  assert.equal(tugsTheCamera(A.holdDuration, false), true);
  assert.equal(tugsTheCamera(A.holdDuration - TUG_SECONDS + 0.01, false), true);
  assert.equal(tugsTheCamera(A.holdDuration - TUG_SECONDS - 0.01, false), false);
  // the mascot in the room (or the shadow): not for a moment of it
  for (let left = A.holdDuration; left > 0; left -= dt) assert.equal(tugsTheCamera(left, true), false);
  assert.ok(HUNTER_NEAR >= 5 && HUNTER_NEAR <= HUNT.far, 'near enough to matter, and no further than it could see you from');
  assert.ok(TUG_SECONDS < A.holdDuration);
  // the ones this is for are the ones that hunt (the waste toner since it came: something dropping off the ceiling at
  // you is not a moment to have your head turned for you); the rest of the hold is as it was
  assert.deepEqual(CAST.filter((m) => m.disposition === 'hunts').map((m) => m.id), ['pirate', 'shadow', 'toner', 'other-door']);
  const held = SUNK.stepAbsorbed(SUNK.createAbsorbedState('wall'), { dt, dist: 0.5 });
  assert.ok(held.startedGrab && held.slow === A.slowFactor);
});

test('the absorbed staff: never in the mascot\'s plinth room, nor in the home of anybody dealt to the part', () => {
  let withMascot = 0, withPorter = 0, parts = 0;
  for (const seed of SEEDS) {
    const { visit, floors } = generateVisit(seed, office);
    for (const level of floors) {
      const out = SUNK.absorbedKeepOut(level, visit);
      parts++;
      if (level.pursuer) { withMascot++; assert.ok(out.has(level.pursuer.room), `${seed}, part ${level.depth}: the plinth room is his`); }
      // everybody dealt to this part who lives in one room: each has a room, no two the same, and all of them are kept clear
      const homes = castFor(visit, level.depth).map((k) => [k.id, homeFor(level, CAST.find((m) => m.id === k.id))]).filter(([, home]) => home !== null);
      for (const [id, home] of homes) assert.ok(out.has(home), `${seed}, part ${level.depth}: ${id}'s room is its own`);
      assert.equal(new Set(homes.map(([, home]) => home)).size, homes.length, `${seed}, part ${level.depth}: two of them in one room`);
      if (homes.some(([id]) => id === 'porter')) withPorter++;
      assert.equal(out.size, new Set([...(level.pursuer ? [level.pursuer.room] : []), ...homes.map(([, home]) => home)]).size, 'and nothing else is kept from them');
      assert.ok([...out].every((id) => level.rooms[id]));
    }
  }
  assert.ok(withMascot > 20 && withPorter > 5 && parts > withMascot, `${withMascot} parts with the mascot, ${withPorter} with the porter, of ${parts}`);
  // a floor made by itself, with no visit: only the plinth room
  assert.deepEqual([...SUNK.absorbedKeepOut({ depth: 0, pursuer: { room: 3 }, rooms: [] }, null)], [3]);
});

test('the absorbed staff and fire: paper burning beside one lets go of whoever it has, and keeps its arms down while it burns', () => {
  const { ABSORBED: A, createAbsorbedState, stepAbsorbed } = SUNK;
  // holding somebody: the fire is lit, and that moment they are free
  let r = stepAbsorbed(createAbsorbedState('floor'), { dt, dist: 0.6 });
  assert.equal(r.state.phase, 'grabbing');
  r = stepAbsorbed(r.state, { dt, dist: 0.6, fire: true });
  assert.ok(r.releasedGrab && r.state.phase === 'cooldown' && r.slow === 1 && r.sinkTo === 0);
  // for as long as it burns, standing in its arms is nothing: no reach, no grab, and the cooldown never runs down
  let s = r.state;
  for (let t = 0; t < 30; t += dt) { r = stepAbsorbed(s, { dt, dist: 0.4, fire: true }); s = r.state; assert.ok(s.phase === 'cooldown' && !r.startedGrab && !r.releasedGrab && s.cooldownLeft === A.cooldownDuration); }
  assert.equal(s.grabCount, 1);
  // the paper burns out: a whole cooldown more, and then it is what it was
  let free = 0;
  for (; free < 20 && s.phase === 'cooldown'; free += dt) s = stepAbsorbed(s, { dt, dist: 0.4 }).state;
  assert.ok(Math.abs(free - A.cooldownDuration) < 0.1, `arms down for ${free.toFixed(2)} s after the fire`);
  s = stepAbsorbed(s, { dt, dist: 0.4 }).state;
  assert.equal(s.phase, 'grabbing');
  // one that was only reaching, or doing nothing, is put off the same way; and no fire changes nothing
  for (const mount of SUNK.ABSORBED_MOUNTS) assert.equal(stepAbsorbed(createAbsorbedState(mount), { dt, dist: 2, fire: true }).state.phase, 'cooldown');
  assert.deepEqual(stepAbsorbed(createAbsorbedState('wall'), { dt, dist: 2, fire: false }), stepAbsorbed(createAbsorbedState('wall'), { dt, dist: 2 }));
  assert.ok(A.fireRadius > A.reachRadius.floor && A.fireRadius <= 3, 'further than its arms, nearer than a fire is seen from');
});

test('the absorbed staff on the card: met once, when one is seen reaching; letting go is not getting away', () => {
  const { meetsAbsorbed } = SUNK;
  assert.equal(meetsAbsorbed('reaching', true, false), true);
  assert.equal(meetsAbsorbed('grabbing', true, false), true);
  assert.equal(meetsAbsorbed('reaching', false, false), false, 'behind you, it has not been met');
  assert.equal(meetsAbsorbed('idle', true, false), false, 'hanging there doing nothing, it is part of the wall');
  assert.equal(meetsAbsorbed('cooldown', true, false), false);
  assert.equal(meetsAbsorbed('grabbing', true, true), false, 'once');
  // and the room's own code never tells the count that somebody got away from one
  const src = fs.readFileSync(new URL('../public/world/backrooms/absorbed.js', import.meta.url), 'utf8');
  assert.ok(/run\?\.met\?\.\('absorbed'\)/.test(src) && !/survived/.test(src));
});

test('the absorbed staff: none is put where a thing lying about could not be picked up without being held', () => {
  const { clearOfThings, THING_GAP, ABSORBED: A } = SUNK;
  const things = [{ x: 2, z: 2 }, { x: 10, z: -3 }];
  assert.equal(clearOfThings(2, 2 + THING_GAP - 0.01, things), false);
  assert.equal(clearOfThings(2, 2 + THING_GAP + 0.01, things), true);
  assert.equal(clearOfThings(10.5, -3.5, things), false);
  assert.ok(clearOfThings(0, 0, []) && clearOfThings(0, 0, undefined), 'a visit without pockets has nothing lying about');
  // the gap leaves somewhere to stand: within arm's length of the thing, and out of the longest of their reaches
  const longest = Math.max(...Object.values(A.reachRadius));
  assert.ok(THING_GAP - longest >= 0.4, `only ${(THING_GAP - longest).toFixed(2)} m between the thing and their hands`);
  // …and it is they who move: the seed's supplies are not asked to (a kept tape is compared on them)
  const src = fs.readFileSync(new URL('../public/world/backrooms/supplies.js', import.meta.url), 'utf8');
  assert.ok(!/absorbed/i.test(src));
  // the same gap is kept from wherever the cast has taken its places: wider than the gap the cast keeps from them, so that
  // nobody is ever walled in by a colleague put down beside them
  assert.ok(THING_GAP > ABSORBED_GAP + 0.5);
  const placing = fs.readFileSync(new URL('../public/world/backrooms/absorbed.js', import.meta.url), 'utf8');
  assert.ok(/clearOfThings\(s\.wx, s\.wz, company\)/.test(placing) && /env\.pursuer\?\.cast\?\.\(\)/.test(placing));
});

test('the waste toner: hides on the ceiling clicking sonar, passes over crouch or stillness, weaves fast through crawl holes, stops at shut doors, and melts into glitch slime on its second bite', () => {
  const deckEntry = CAST.find((m) => m.id === 'toner');
  assert.ok(deckEntry && deckEntry.caught.hurt === TONER.hitDamage && TONER.hitDamage === 1 && TONER.maxHits === 2);
  assert.ok(TONER.tall <= 0.55 && TONER.opens === false && TONER.chaseSpeed > 4.2, 'low enough to crawl, fast, and unable to open doors');

  // 1. Perched on the ceiling: standing still or crouching right underneath it never wakes it, while calm sonar clicks sound
  let s = perched(() => 0.5), pings = 0;
  for (let t = 0; t < 30; t += dt) {
    s = stepToner(s, dt, { d: 1.5, los: true, audible: true, moving: true, speed: 1.4, sink: TONER.crouchSink + 0.1 }, () => 0.5);
    assert.ok(s.mode === 'perch' || s.mode === 'prowl', `crouched visitor stays safe (got ${s.mode})`);
    assert.equal(s.alert, 0);
    if (s.sonar === 'ping') pings++;
  }
  assert.ok(pings >= 8, `emits periodic sonar clicks while on the ceiling (${pings})`);
  assert.equal(isQuiet({ moving: false, speed: 0, sink: 0 }), true);
  assert.equal(isQuiet({ moving: true, speed: 2.0, sink: 0.45 }), true);
  assert.equal(isQuiet({ moving: true, speed: 2.0, sink: 0 }), false);

  // 2. Upright walking triggers warning clicks first (allowing you to freeze/crouch in time), while sprinting drops it
  s = perched(() => 0.5);
  let warns = 0;
  for (let t = 0; t < TONER.fuseWalk * 0.65; t += dt) {
    s = stepToner(s, dt, { d: 5, los: true, audible: true, moving: true, speed: 2.0, sink: 0 }, () => 0.5);
    if (s.sonar === 'warn') warns++;
  }
  assert.ok(s.mode !== 'drop' && s.alert > 0.4 && warns >= 1, 'accelerating clicks warn before it drops');
  for (let t = 0; t < 1.2; t += dt) s = stepToner(s, dt, { d: 5, los: true, audible: true, moving: false, speed: 0, sink: 0.45 }, () => 0.5);
  assert.equal(s.alert, 0, 'crouching or freezing lets the sonar pass');

  // Sprinting upright within drop range triggers ceiling peel -> floor chase
  let dropped = 0;
  for (let t = 0; t < 1.2; t += dt) {
    s = stepToner(s, dt, { d: 5, los: true, audible: true, moving: true, speed: 3.4, sink: 0 }, () => 0.4);
    if (s.dropped) dropped++;
  }
  assert.equal(dropped, 1);
  assert.equal(s.mode, 'chase');

  // 3. Never runs in a straight line: weaves widely both left and right with sporadic phase-glitches
  let minW = Infinity, maxW = -Infinity, glitches = 0;
  for (let t = 0; t < 2.2; t += dt) {
    s = stepToner(s, dt, { d: 4, los: true, audible: true, moving: true, speed: 2.0, sink: 0 }, () => 0.35);
    const w = weaveOffset(s);
    minW = Math.min(minW, w); maxW = Math.max(maxW, w);
    if (s.glitch) glitches++;
  }
  assert.ok(minW < -0.55 && maxW > 0.55 && glitches >= 2, `weaves [${minW.toFixed(2)}, ${maxW.toFixed(2)}] with ${glitches} glitches`);

  // 4. Shut fire doors stop it cold, and after scratching a moment it climbs back onto the ceiling
  for (let t = 0; t < TONER.doorGiveUp + 3 * dt; t += dt) {
    s = stepToner(s, dt, { d: 3, los: false, audible: false, moving: false, speed: 0, sink: 0, blockedByDoor: true }, () => 0.5);
  }
  assert.equal(s.mode, 'prowl', 'blocked by a shut door, it climbs back to the ceiling');

  // 5. Two landed 1-damage bites dissolve it into a persistent sticky pool of black glitch slime
  s = { ...s, mode: 'chase', doorT: 0, lostT: 0 };
  s = stepToner(s, dt, { d: TONER.touch - 0.1, los: true, audible: true, moving: true, speed: 2, sink: 0 }, () => 0.5);
  assert.equal(s.bite, true);
  s = strikeToner(s, { landed: true, dead: false, ended: false }, () => 0.5);
  assert.equal(s.hits, 1);
  assert.equal(s.mode, 'recoil', 'after 1st bite (1 damage), phases back up to ceiling for a breather');
  assert.equal(s.survived, true);

  // Fast-forward past ceiling recoil, drop again, and land the 2nd bite (2 total damage)
  for (let t = 0; t < TONER.recoilTime[1] + 0.5; t += dt) s = stepToner(s, dt, { d: 6, los: false, audible: false }, () => 0.5);
  for (let t = 0; t < 1.2; t += dt) s = stepToner(s, dt, { d: 4, los: true, audible: true, moving: true, speed: 3.4, sink: 0 }, () => 0.5);
  assert.equal(s.mode, 'chase');
  s = stepToner(s, dt, { d: TONER.touch - 0.1, los: true, audible: true, moving: true, speed: 2, sink: 0 }, () => 0.5);
  assert.equal(s.bite, true);
  s = strikeToner(s, { landed: true, dead: false, ended: false }, () => 0.5);
  assert.equal(s.hits, 2);
  assert.equal(s.mode, 'dissolving', '2nd landed bite triggers dissolve');
  assert.equal(s.dissolved, true);

  let melted = 0;
  for (let t = 0; t < TONER.dissolveTime + 3 * dt; t += dt) {
    s = stepToner(s, dt, { d: 0.4, los: true, audible: true, moving: true, speed: 2, sink: 0 }, () => 0.5);
    if (s.melted) melted++;
  }
  assert.equal(melted, 1);
  assert.equal(s.mode, 'puddle');
  assert.ok(s.inPuddle && s.slow === TONER.puddleSlow, 'stepping in the glitch slime puddle slows movement');
  const outside = stepToner(s, dt, { d: TONER.puddleRadius + 0.5 }, () => 0.5);
  assert.ok(outside.mode === 'puddle' && !outside.inPuddle && outside.slow === 1);

  // 6. Brood lifecycle: after ~1 minute (60 s), the puddle ruptures into 'spent' and hatches 2–3 territorial broodlings
  assert.equal(TONER.broodTime, 60);
  assert.deepEqual(TONER.broodCount, [2, 3]);
  let stirPings = 0, hatches = 0, spawned = 0;
  for (let t = 0; t < TONER.broodTime * 0.5; t += dt) {
    s = stepToner(s, dt, { d: 8 }, () => 0.8);
  }
  assert.equal(s.mode, 'puddle');
  assert.ok(s.gestation > 0.48 && s.gestation < 0.55, `mid-gestation progress (${s.gestation.toFixed(2)})`);

  for (let t = 0; t < TONER.broodTime * 0.5 + 1; t += dt) {
    s = stepToner(s, dt, { d: 8 }, () => 0.85);
    if (s.sonar === 'ping') stirPings++;
    if (s.hatched) { hatches++; spawned = s.spawnCount; }
  }
  assert.ok(stirPings >= 2, `late-stage brooding puddle emits warning clicks (${stirPings})`);
  assert.equal(hatches, 1, 'puddle hatches once when the 60 s clock expires');
  assert.ok(spawned >= 2 && spawned <= 3, `spawns 2 or 3 broodlings (got ${spawned})`);
  assert.equal(s.mode, 'spent');

  // Spent stain stays inert forever (never hatches a second brood) and keeps mild residual tackiness
  for (let t = 0; t < 120; t += dt) {
    s = stepToner(s, dt, { d: 0.3 }, () => 0.2);
    assert.equal(s.hatched, false);
    assert.equal(s.mode, 'spent');
  }
  assert.ok(s.inPuddle && s.slow === TONER.spentSlow);
  // Check both ends of broodCount rng: 0 -> 2, 0.99 -> 3
  assert.equal(stepToner({ ...perched(() => 0.5, { mode: 'puddle' }), broodLeft: 0.01 }, dt, { d: 5 }, () => 0.0).spawnCount, 2);
  assert.equal(stepToner({ ...perched(() => 0.5, { mode: 'puddle' }), broodLeft: 0.01 }, dt, { d: 5 }, () => 0.99).spawnCount, 3);

  // Hatched broodlings are territorial to their birth room until they hear upright footsteps
  let brood = hatchedBrood(4, () => 0.5);
  assert.equal(brood.territorial, true);
  assert.equal(brood.homeRoom, 4);
  assert.equal(brood.mode, 'recoil', 'emerges from puddle up onto the ceiling');
  for (let t = 0; t < TONER.emergeTime[1] + 0.2; t += dt) brood = stepToner(brood, dt, { d: 12, audible: false }, () => 0.5);
  assert.equal(brood.mode, 'perch');
  assert.equal(brood.territorial, true);
  assert.equal(brood.homeRoom, 4);
  // Hearing upright movement wakes a territorial broodling onto the hunt
  for (let t = 0; t < 1.2; t += dt) brood = stepToner(brood, dt, { d: 5, los: true, audible: true, moving: true, speed: 3.4, sink: 0 }, () => 0.5);
  assert.equal(brood.mode, 'chase');
  assert.equal(brood.territorial, true);
  assert.equal(brood.homeRoom, 4, 'remembers its home room so it can return if it loses the trail');
  // Once it loses the trail far from home, it keeps prowling back across the ceilings until near homeRoom
  for (let t = 0; t < TONER.trailMemory + 0.5; t += dt) brood = stepToner(brood, dt, { d: 15, los: false, audible: false, farFromHome: true }, () => 0.5);
  for (let t = 0; t < 20; t += dt) {
    brood = stepToner(brood, dt, { d: 15, los: false, audible: false, farFromHome: true }, () => 0.5);
    assert.equal(brood.mode, 'prowl', 'keeps creeping homeward rather than perching in distant rooms');
  }
});

test('the other door: walking past it is nothing; trying it, walking into it or standing in front of it opens it', () => {
  const away = { out: 3, across: 0, d: 3, moving: false, toward: 0, used: false, fire: false, rnd: 0.5 };
  const steps = (s, secs, sense) => { const seen = []; for (let t = 0; t < secs - 1e-9; t += dt) { s = pretends(s, dt, sense); if (s.sprung) seen.push('sprung'); if (s.strike) seen.push('strike'); if (s.shook) seen.push('shook'); } return Object.assign(s, { events: seen }); };
  // in its room for five minutes, never in front of it: a door
  let s = steps(shut(), 300, away);
  assert.equal(s.mode, 'door'); assert.ok(!s.events.includes('sprung'));
  // across its face at a walk, close: two metres of wall at 1.4 m/s is under the time it allows
  assert.ok((OTHER_DOOR.w + 2 * OTHER_DOOR.aside) / 1.4 < OTHER_DOOR.linger * 0.7, 'crossing in front of it is not standing in front of it');
  s = shut(); for (let x = -1.6; x <= 1.6; x += 1.4 * dt) { s = pretends(s, dt, { ...away, out: 0.7, across: x, moving: true, toward: 0 }); assert.equal(s.mode, 'door'); }
  // …and walking along the wall itself, shoulder to it, is not walking into it
  s = shut(); for (let x = -1.6; x <= 1.6; x += 1.4 * dt) { s = pretends(s, dt, { ...away, out: 0.3, across: x, moving: true, toward: 0.1 }); assert.equal(s.mode, 'door'); }
  // standing in front of it: it lets you look for a while, and then it does not
  s = steps(shut(), OTHER_DOOR.linger - 0.2, { ...away, out: 0.9, d: 0.9 }); assert.equal(s.mode, 'door');
  s = steps(s, 0.3, { ...away, out: 0.9, d: 0.9 }); assert.ok(s.mode !== 'door' && s.events.includes('sprung'));
  // step away and come back: the count starts again
  s = steps(shut(), OTHER_DOOR.linger - 0.3, { ...away, out: 0.9 }); s = pretends(s, dt, away); assert.equal(s.front, 0);
  s = steps(s, OTHER_DOOR.linger - 0.3, { ...away, out: 0.9 }); assert.equal(s.mode, 'door');
  // E, from where any pair is worked: at once
  assert.ok(pretends(shut(), dt, { ...away, out: 1.1, used: true }).sprung);
  // walking into it: at its face, moving, headed at it. Not standing at it, not backing into it, not beside it
  const at = { ...away, out: 0.4, d: 0.4, moving: true, toward: 1 };
  assert.ok(walksInto(at) && pretends(shut(), dt, at).sprung);
  assert.ok(!walksInto({ ...at, moving: false }) && !walksInto({ ...at, toward: -1 }) && !walksInto({ ...at, across: OTHER_DOOR.w / 2 + 0.4 }) && !walksInto({ ...at, out: 0.8 }));
  assert.ok(inFront(0.5, 0) && !inFront(-0.5, 0) && !inFront(OTHER_DOOR.near + 0.1, 0) && !inFront(0.5, OTHER_DOOR.w), 'the other side of the wall is not in front of it');
});

test('the other door: it has you, it costs two hearts, and then it lets go and is a hole in the wall; or it does not let go', () => {
  const here = { out: 0.9, across: 0, d: 0.9, moving: false, toward: 0, used: true, fire: false, rnd: 0.5 };
  let s = pretends(shut(), dt, here), strikes = 0, secs = 0;
  assert.ok(s.sprung && s.mode === 'opening' && open(s) && !holds(s));
  for (; secs < 10 && !s.strike; secs += dt) s = pretends(s, dt, { ...here, used: false });
  assert.ok(Math.abs(secs - (OTHER_DOOR.opens + OTHER_DOOR.grips)) < 0.1, `it struck after ${secs.toFixed(2)} s`);
  assert.ok(holds(s) && s.mode === 'gripping');
  assert.equal(OTHER_DOOR.hurts, 2); assert.equal(CAST.find((m) => m.id === 'other-door').caught.hurt, OTHER_DOOR.hurts);
  // lived through: the arms go back in, and it is spent for good, whatever is done to it
  let free = let_(s); assert.ok(!holds(free) && open(free));
  for (let t = 0; t < OTHER_DOOR.lets + 0.1; t += dt) { free = pretends(free, dt, here); if (free.strike) strikes++; }
  assert.equal(free.mode, 'spent');
  for (let t = 0; t < 60; t += dt) { free = pretends(free, dt, here); assert.ok(free.mode === 'spent' && !free.sprung && !free.strike && free.tremor === 0); }
  assert.equal(strikes, 0, 'once');
  // the last of them: it keeps hold, and asks nothing more of anybody (the conductor ends the visit)
  let gone = took(s); assert.ok(holds(gone));
  for (let t = 0; t < 30; t += dt) { gone = pretends(gone, dt, here); assert.ok(gone.mode === 'taking' && !gone.strike); }
});

test('the other door: its one tell is a shiver, oftener and harder the nearer you are; and a fire in front of it stops it springing', () => {
  const sense = (d) => ({ out: 3, across: 2.5, d, moving: false, toward: 0, used: false, fire: false, rnd: 0.5 });
  const count = (d, secs) => { let s = shut(), n = 0, hard = 0; for (let t = 0; t < secs; t += dt) { s = pretends(s, dt, sense(d)); if (s.shook) n++; hard = Math.max(hard, s.tremor); } return { n, hard }; };
  const near = count(1.5, 120), mid = count(6, 120), far = count(OTHER_DOOR.far - 0.5, 120), gone = count(OTHER_DOOR.far + 3, 120);
  assert.ok(near.n > mid.n && mid.n > far.n && far.n >= 15, `${near.n} / ${mid.n} / ${far.n} shivers in two minutes`);
  assert.ok(near.hard > mid.hard && mid.hard > far.hard && far.hard > 0.3 && near.hard <= 1);
  assert.equal(gone.n, 0, 'nobody near: nothing');
  assert.ok(cueGap(0) === OTHER_DOOR.cue[0] && cueGap(OTHER_DOOR.far) === OTHER_DOOR.cue[1] && OTHER_DOOR.shiver < 0.3, 'a frame or two, every few seconds: something to catch, not something to miss');
  // paper burning in front of it: stood at, tried, walked into, and it stays a door, flinching the whole time
  let s = shut(), flinches = 0;
  for (let t = 0; t < 16; t += dt) { s = pretends(s, dt, { out: 0.4, across: 0, d: 0.4, moving: true, toward: 1, used: true, fire: true, rnd: 0.5 }); assert.ok(s.mode === 'door' && !s.sprung); if (s.shook) flinches++; }
  assert.ok(flinches >= 16 / OTHER_DOOR.flinch - 2, `${flinches} flinches in sixteen seconds of fire`);
  assert.equal(CAST.find((m) => m.id === 'other-door').fire, 'fears');
  // the paper burns out with you still standing there: it has its patience back, from the start
  assert.equal(s.front, 0);
  s = pretends(s, dt, { out: 0.9, across: 0, d: 0.9, moving: false, toward: 0, used: false, fire: false, rnd: 0.5 }); assert.equal(s.mode, 'door');
});

test('the other door: it hangs on a clear stretch of wall wide enough for a pair, the same place for the same seed', () => {
  const spans = { back: [[-3, 3]], front: [[-3, -1.2], [0.5, 3]], left: [[-1, 1]], right: [] };
  const a = doorSpots(spans, makeRng('m1')), b = doorSpots(spans, makeRng('m1'));
  assert.deepEqual(a, b);
  assert.ok(a.length > 4 && a.every((p) => ['back', 'front'].includes(p.side)) && new Set(a.map((p) => p.side)).size === 2, 'only where there is room for it and its frame, and more than one place to try on each');
  for (const p of a) { const [lo, hi] = spans[p.side].find(([x, y]) => p.at >= x && p.at <= y); assert.ok(p.at - OTHER_DOOR.w / 2 >= lo + 0.2 && p.at + OTHER_DOOR.w / 2 <= hi - 0.2); }
  assert.deepEqual(doorSpots({ back: [[0, 1.5]], front: [], left: [], right: [] }, makeRng('m2')), []);
  // it is a pair like the floor's own: no wider than doors are hung, and it is never where you land (it takes the lesson of doors for granted)
  assert.ok(OTHER_DOOR.w <= DOORS.widest && OTHER_DOOR.h >= DOORS.lowest);
  const line = CAST.find((m) => m.id === 'other-door');
  assert.ok(line.needs.includes('doors') && line.home === 'room' && line.disposition === 'hunts');
  for (const seed of SEEDS) { const { visit } = generateVisit(seed, office); for (const k of castFor(visit)) if (k.id === 'other-door') assert.ok(k.floor >= 1, `${seed}: it is on the part you land in`); }
});

test('close-quarters scissors (melee.js & snipToner): reach, forward cone, ceiling clearance, hunter priority, and repelling a lunging Waste Toner', () => {
  assert.ok(SNIP_TUNING.reach > 1.3 && SNIP_TUNING.reach < 2.2);
  const viewer = { x: 0, z: 0, y: 1.56, yaw: 0 }; // facing -z

  // Out of reach, behind the camcorder, high on a 3.3 m ceiling, or behind a wall: no hit
  const unreachable = [
    { id: 'far', x: 0, z: -3.2, y: 1.2, r: 0.4, snip: () => true },
    { id: 'behind', x: 0, z: 1.2, y: 1.2, r: 0.4, snip: () => true },
    { id: 'ceiling', x: 0, z: -1.1, y: 3.3, r: 0.4, snip: () => true },
    { id: 'walled', x: 0, z: -1.0, y: 1.2, r: 0.4, snip: () => true },
  ];
  assert.deepEqual(
    strikeSnip(viewer, unreachable, (ax, az, bx, bz) => !(bx === 0 && bz === -1.0)),
    { ok: false, reason: 'no-snip-target' }
  );

  // Active lunging hunter (priority 3) is jabbed ahead of a nearby brooding puddle (priority 1)
  const struck = [];
  const mix = [
    { id: 'toner-puddle', x: 0, z: -0.9, y: 0.35, r: 0.85, priority: 1, snip: () => { struck.push('puddle'); return { ok: true, target: 'toner-puddle' }; } },
    { id: 'toner', x: 0.15, z: -1.45, y: 1.15, r: 0.52, priority: 3, snip: () => { struck.push('toner'); return { ok: true, target: 'toner' }; } },
  ];
  assert.deepEqual(rankSnipTargets(viewer, mix).map((c) => c.id), ['toner', 'toner-puddle']);
  assert.deepEqual(strikeSnip(viewer, mix), { ok: true, target: 'toner' });
  assert.deepEqual(struck, ['toner'], 'stops after the first landed jab');

  // Snipping a lunging ('drop') or chasing ('chase') Waste Toner drives it straight into ceiling recoil without incrementing hits
  for (const mode of ['drop', 'chase']) {
    const before = { ...perched(() => 0.5, { mode }), hits: 1, alert: 1 };
    const after = snipToner(before, () => 0.5);
    assert.equal(after.repelled, true);
    assert.equal(after.mode, 'recoil');
    assert.equal(after.hits, 1, 'jabbing a Toner does not feed it a bite toward its brood puddle');
    assert.equal(after.alert, 0);
  }

  // Snipping a brooding puddle ruptures it into inert 'spent' stain with zero broodlings hatched
  const puddle = { ...perched(() => 0.5, { mode: 'puddle' }), broodLeft: 14, gestation: 0.76 };
  const burst = snipToner(puddle, () => 0.99);
  assert.equal(burst.ruptured, true);
  assert.equal(burst.mode, 'spent');
  assert.equal(burst.hatched, false);
  assert.equal(burst.spawnCount, 0);
  const next = stepToner(burst, dt, { d: 0.3 }, () => 0.99);
  assert.equal(next.mode, 'spent');
  assert.equal(next.hatched, false);
});
