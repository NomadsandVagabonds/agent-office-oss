// Dispatch (rooms/dispatch.js, after Codex's Dispatch): what its two figures do, its floor plan, and what the owner
// decided about it — wordless, unnamed, one a visit at most, inside the set-piece budget. The first four tests and the
// two after them are Codex's, moved here with the room.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreightBehavior, makeFreightNavigator } from '../public/world/backrooms/rooms/dispatch/behavior.js';

test('a visitor interrupts the embrace, attention expires and packing resumes without leaving', () => {
  const b = createFreightBehavior();
  assert.equal(b.read().phase, 'embrace');
  assert.equal(b.notice().phase, 'startled');
  assert.equal(b.advance(6).phase, 'follow');
  assert.equal(b.advance(9).phase, 'return');
  assert.equal(b.advance(7).phase, 'pickup');
  assert.equal(b.read().attention, 0);
  assert.equal(b.advance(6).carrying, true);
  assert.equal(b.advance(8).carrying, true);
  assert.equal(b.advance(1).carrying, false);
  assert.equal(b.advance(9).phase, 'embrace');
});

test('ending freezes choreography and departure cancels attention', () => {
  const b = createFreightBehavior(); b.notice(); b.advance(7);
  const before = b.read();
  assert.deepEqual(b.advance(100, { frozen: true }), before);
  assert.equal(b.leave().attention, 0);
  assert.equal(b.read().phase, 'return');
  assert.equal(b.notice().phase, 'startled');
});

test('a packing job waits for the worker to reach the station', () => {
  const b = createFreightBehavior(); b.notice(); b.advance(22);
  assert.equal(b.advance(60, { arrived: false }).phase, 'pickup');
  assert.equal(b.read().carrying, false);
  assert.equal(b.advance(6).phase, 'carry');
  assert.equal(b.advance(60, { arrived: false }).carrying, true);
  assert.equal(b.read().phase, 'carry');
});

test('crate navigation uses the aisle and cannot cross a closed wall to reach a target', () => {
  const free = (x, z) => Math.abs(x) < 3.7 && Math.abs(z) < 3.7 && !(Math.abs(x) < 0.4 && z < 2.2);
  const nav = makeFreightNavigator({ W: 8, D: 8, free });
  const path = nav.path({ x: -2, z: -2 }, { x: 2, z: -2 });
  assert.ok(path.length > 20);
  assert.ok(path.some(p => p.z > 2.2));
  assert.ok(path.every(p => free(p.x, p.z)));
  const closed = makeFreightNavigator({ W: 8, D: 8, free: (x, z) => free(x, z) && Math.abs(x) > 0.4 });
  assert.ok(closed.path({ x: -2, z: -2 }, { x: 2, z: -2 }).every(p => p.x < 0));
});
import { freightLayout, freightStash } from '../public/world/backrooms/rooms/dispatch/layout.js';

// Independent body-sized flood through the authored solids. Unlike the
// engine's multi-door fallback, this also checks our single-entry room.
function floor(room, layout) {
  const r = 0.25, step = 0.125, nx = Math.ceil(room.W / step), nz = Math.ceil(room.D / step);
  const free = (x, z) => {
    if (Math.abs(x) > room.W / 2 - r || Math.abs(z) > room.D / 2 - r) return false;
    return layout.solids.every((b) => {
      const dx = x - Math.max(b.x0, Math.min(x, b.x1)), dz = z - Math.max(b.z0, Math.min(z, b.z1));
      return dx * dx + dz * dz >= r * r;
    });
  };
  const key = ({ x, z }) => Math.floor((x + room.W / 2) / step) + nx * Math.floor((z + room.D / 2) / step);
  const seen = new Uint8Array(nx * nz), queue = [key(layout.entry)];
  seen[queue[0]] = 1;
  for (let at = 0; at < queue.length; at++) {
    const k = queue[at], i = k % nx, j = Math.floor(k / nx);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj, kk = ii + jj * nx;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || seen[kk]) continue;
      if (!free(-room.W / 2 + (ii + 0.5) * step, -room.D / 2 + (jj + 0.5) * step)) continue;
      seen[kk] = 1; queue.push(kk);
    }
  }
  return { free, reaches: (p) => free(p.x, p.z) && seen[key(p)] === 1 };
}

test('freight keeps its work floor, hidden crate and loot reachable across sizes and seeds', () => {
  for (const W of [17.8, 18.8, 19.8]) for (const D of [19.8]) for (let seed = 1; seed <= 12; seed++) {
    const room = { W, D, H: seed % 2 ? 5 : 6, params: { layoutSeed: seed * 7919 } }, layout = freightLayout(room), walk = floor(room, layout);
    const { work, portal } = layout, [x0, z0, x1, z1] = freightStash(room);
    const targets = { home: work.home, pickup: work.pickup, loading: work.loading, crateEntry: portal.entry, crateInterior: { x: portal.x, z: portal.z }, coin: { x: (x0 + x1) / 2, z: (z0 + z1) / 2 } };
    for (const [name, p] of Object.entries(targets)) assert.ok(walk.reaches(p), `${W}×${D} seed ${seed}: ${name} is reachable with radius .25`);
    for (const p of [work.home, work.pickup, work.loading]) for (const dx of [-0.46, 0.46]) assert.ok(walk.reaches({ x: p.x + dx, z: p.z }), `space for both workers at ${JSON.stringify(p)}`);
    const heap = work.hoard, box = work.crate;
    assert.ok(heap.x0 > -W / 2 && heap.x1 < W / 2 && heap.z0 > -D / 2 && heap.z1 < D / 2 && heap.h < room.H,
      'the GPU hoard fits inside the room and below the ceiling');
    assert.ok(heap.x1 < box.x - box.w / 2, 'the hoard leaves the open loading crate unobstructed');
    for (const c of layout.crates) assert.ok(c.x1 <= heap.x0 || c.x0 >= heap.x1 || c.z1 <= heap.z0 || c.z0 >= heap.z1,
      'maze freight does not occupy the GPU hoard');
    assert.ok(layout.crates.length >= 25, 'the maze remains substantial');
    for (const c of layout.crates) assert.ok(c.x0 > -W / 2 && c.x1 < W / 2 && c.z0 > -D / 2 && c.z1 < D / 2, 'freight stays within the room');
    assert.equal(walk.free(portal.x, portal.outer.z1), false, 'front face is closed');
    assert.equal(walk.free(portal.outer.x0, portal.z), false, 'left face is closed');
    assert.equal(walk.free(portal.outer.x1, portal.z), false, 'right face is closed');
    assert.equal(walk.free(portal.x, portal.outer.z0), true, 'only the back face is open');
  }
});

test('the layout is deterministic and changes with its rolled seed', () => {
  const room = { W: 19.8, D: 19.8, H: 5.5, params: { layoutSeed: 713 } };
  assert.deepEqual(freightLayout(room), freightLayout(room));
  assert.notDeepEqual(freightLayout(room).open, freightLayout(room, 714).open);
});

/* ---- what was decided about it --------------------------------------------------------------------------- */
import { readFileSync, readdirSync } from 'node:fs';
import { ARCHETYPES, DECK, isBig, generate } from '../public/world/backrooms/gen.js';
import { generateVisit } from '../public/world/backrooms/plan.js';

const here = new URL('../public/world/backrooms/rooms/', import.meta.url);
const sources = () => [['dispatch.js', readFileSync(new URL('dispatch.js', here), 'utf8')], ...readdirSync(new URL('dispatch/', here)).map((f) => [`dispatch/${f}`, readFileSync(new URL(`dispatch/${f}`, here), 'utf8')])];

test('Dispatch is on the room contract: from the news, a set piece, a dead end, and a size the plan can hold', () => {
  const a = ARCHETYPES.dispatch;
  assert.ok(a && a.headline === true && a.big === true && isBig(a) && a.module === './rooms/dispatch.js');
  assert.deepEqual(a.ports, [], 'its only doorway is the one you came in by: the crate is the other way out, and it is not on the plan');
  assert.ok(a.w[1] <= 20 && a.d[1] <= 20 && a.h[1] <= 9 && !a.teaches && !a.needs);
  assert.deepEqual(DECK.filter((d) => d.headline).map((d) => d.id), ['dispatch', 'mecha'], 'which stories become rooms is the owner\'s call: so far, these two');
  // the floor plan was drawn for a bigger room: it has to hold at every size the deck can deal
  for (let seed = 0; seed < 12; seed++) {
    const level = generate(`dispatch-${seed}`, { only: ['dispatch'] }), r = level.rooms.find((k) => k.arch === 'dispatch');
    assert.ok(r && r.W <= 19.8 + 1e-9 && r.D <= 19.8 + 1e-9 && r.H >= 5 - 0.2 && r.doors.length === 1 && r.doors[0].side === 'front', `seed ${seed}: ${r && [r.W, r.D, r.H, r.doors.length]}`);
    const [x0, z0, x1, z1] = a.stash(r, 1);
    assert.ok(x0 < x1 && z0 < z1 && x1 < r.W / 2 && z1 < r.D / 2 && x0 > -r.W / 2 && z0 > -r.D / 2);
  }
});

test('there is not a word in Dispatch, and nothing in it names, describes or points at the two figures', () => {
  for (const [file, src] of sources()) {
    // nothing is ever lettered: no text drawn on any surface, none of the level's cards, signs or notices (bits.js), nothing to press E at
    for (const [what, re] of [['draws text', /\bfillText\b|\bstrokeText\b|\bdrawText\b|\.font\s*=/], ['hangs a card or a sign', /bits\.js|words\.js|wetSign\s*\(|exitSign\s*\(|floorPlan\s*\(|poster|plaque|nameplate/i], ['can be used', /\bc\.use\s*\(/], ['speaks', /dialog|speech|caption|subtitle|\bsay\s*\(/i]])
      assert.equal(re.test(src), false, `${file} ${what}`);
  }
  const a = ARCHETYPES.dispatch;
  // what the rest of the level can say about the room is its landmark and its name on the dev page: the crates, and nothing else
  assert.equal(a.landmark, 'the wooden shipping crates');
  assert.equal(a.name, 'Dispatch');
  assert.deepEqual(Object.keys(a.roll({ int: () => 1, pick: (l) => l[0] }, { name: 'x', projects: [], agents: [], tasks: [] })).sort(), ['layoutSeed', 'wood'], 'it borrows no names from the office: nobody upstairs is in this room');
});

test('the heap is thinned to fit a set piece, and is still a heap', () => {
  const hoard = readFileSync(new URL('dispatch/hoard.js', here), 'utf8');
  // the counts the builder loops to (a skin of cards over a core nobody sees): 28 + 13 × 2 + 4 × 3 + 16 + 6 + 6
  const loops = [...hoard.matchAll(/outer\.slice\(0, (\d+)\)|for \(let i = 0; i < (\d+); i\+\+\)/g)].map((m) => Number(m[1] || m[2]));
  assert.ok(loops.includes(28) && loops.includes(13), `the heap's loops are ${loops}`);
  const cards = 28 + 13 * 2 + 4 * 3 + 16 + 6 + 6;
  assert.equal(cards, 94);
  assert.ok(cards * 428 < 45000, 'the cards are well under half of what a set piece may cost (120,000 triangles): the two figures and the crates need the rest');
});

test('the plan puts Dispatch in its share of the third of visits that have a room from the news, once, and never where you land', () => {
  let visits = 0, withIt = 0;
  for (let i = 0; i < 90; i++) {
    const { visit, floors } = generateVisit(`news-${i}`, { name: 'Robin' });
    const at = floors.map((l, k) => (l.picked.includes('dispatch') ? k : -1)).filter((k) => k >= 0);
    assert.ok(at.length <= 1 && !at.includes(0), `visit ${i}: Dispatch on parts ${at}`);
    assert.equal(visit.headline === 'dispatch', at.length === 1);
    for (const k of at) assert.equal(floors[k].rooms.filter((r) => r.big || (r.arch && isBig(ARCHETYPES[r.arch]))).length <= 1, true, `visit ${i}: two set pieces on one part`);
    visits++; if (at.length) withIt++;
  }
  // (a third of visits have a room from the news, and there are two such rooms now: each has half of them)
  assert.ok(withIt / visits > 0.08 && withIt / visits < 0.3, `Dispatch is in ${withIt} of ${visits} visits`);
});
