// The Backrooms — what is lying about that can be carried (supplies.js), and
// the share of the camcorder's charge that something down here can take.
// Nobody is handed anything: where things are is the seed's doing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planSupplies, supplyRooms, SUPPLY } from '../public/world/backrooms/supplies.js';
import { planVisit, floorOf } from '../public/world/backrooms/plan.js';
import { ITEM_DEFS, makeItem } from '../public/world/backrooms/inventory-state.js';
import { CAST, ITEMS } from '../public/world/backrooms/cast.js';
import { CAMERA_TUNING, createCameraBattery } from '../public/world/backrooms/camera-state.js';

const office = { name: 'Robin', projects: ['Webstore', 'Mobile App', 'Infra'], agents: ['Ivory Marten', 'Amber Vireo', 'Ember Numbat', 'Olive Heron'], tasks: ['Cache the product catalogue'] };
const floors = (n) => { const out = []; for (let s = 1; s <= n; s++) { const v = planVisit(`supply-${s}`, office); for (let i = 0; i < v.depths; i++) out.push(floorOf(v, i)); } return out; };
const part = (seed, depth, eligible = 22) => ({ seed: `often-${seed}`, depth, start: { room: 0 }, exit: { room: eligible + 1 },
  rooms: Array.from({ length: eligible + 2 }, (_, id) => ({ id, kind: id === 0 ? 'start' : id === eligible + 1 ? 'exit' : 'plain', dress: [] })) });

test('what is lying about is decided by the seed and by nothing else', () => {
  for (const level of floors(6)) {
    const a = planSupplies(level, ['paper']), b = planSupplies(level, ['paper']);
    assert.deepEqual(a, b);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a, 'plain data');
    assert.equal(new Set(a.map((s) => s.id)).size, a.length, 'no two things share an id');
  }
});

test('nothing is left where you land, at the way down, or in a room an earlier visitor left something in', () => {
  let traced = 0;
  for (const level of floors(25)) {
    const ok = new Set(supplyRooms(level).map((r) => r.id));
    assert.ok(!ok.has(level.start.room) && !ok.has(level.exit.room));
    for (const r of level.rooms) if ((r.dress || []).some((d) => d.type === 'trace')) { traced++; assert.ok(!ok.has(r.id), `room ${r.id} has a trace in it`); }
    for (const s of planSupplies(level)) {
      assert.ok(s.rooms.length >= 1 && s.rooms.length <= Math.max(SUPPLY.choices, SUPPLY.batteryEvery) && s.rooms.every((id) => ok.has(id)), `${s.id}: only in rooms that may have things`);
      assert.equal(new Set(s.rooms).size, s.rooms.length, `${s.id}: each room offered once`);
    }
  }
  assert.ok(traced > 10, 'the floors tried had traces on them');
});

test('how much: an early battery then spaced refills, at most one snack and paper stack, and every find can be made', () => {
  for (const level of floors(40)) {
    const plan = planSupplies(level), of = (type) => plan.filter((s) => s.type === type);
    const eligible = supplyRooms(level).length;
    assert.equal(of('battery').length, eligible ? 1 + Math.ceil(Math.max(0, eligible - SUPPLY.batteryFirst) / SUPPLY.batteryEvery) : 0);
    assert.ok(of('snack').length >= SUPPLY.snacks[0] && of('snack').length <= SUPPLY.snacks[1]);
    assert.ok(of('torch').length <= 1 && of('chalk').length <= 1);
    for (const t of of('torch')) assert.ok(t.charge >= SUPPLY.torchCharge[0] && t.charge <= SUPPLY.torchCharge[1] && t.charge < ITEM_DEFS.torch.maxCharge, 'a found torch is never a full one');
    for (const s of plan) { const { id, type, rooms, ...made } = s; assert.doesNotThrow(() => makeItem(type, id, made), `${id} is something the pockets know`); }
    assert.ok(of('paper').length >= SUPPLY.stacks[0] && of('paper').length <= SUPPLY.stacks[1] && of('lighter').length <= 1 && of('tape').length <= 1);
    for (const p of of('paper')) assert.ok(p.quantity >= SUPPLY.paper[0] && p.quantity <= SUPPLY.paper[1]);
    assert.ok(plan.every((s) => ['battery', 'snack', 'torch', 'chalk', 'paper', 'lighter', 'tape'].includes(s.type)), 'nothing else, unless somebody wants it');
  }
});

test('how often: preserve the first torch opportunity but make spare tools and crafting materials rarer', () => {
  // (the chances are the plan's own arithmetic, so it is asked about a thousand made-up parts: enough to hold it to its margins)
  const share = (depth, type) => { let n = 0; for (let s = 0; s < 1000; s++) n += planSupplies(part(s, depth)).filter((x) => x.type === type).length; return n / 1000; };
  const top = share(0, 'torch'), low = share(2, 'torch'), chalk = share(1, 'chalk'), lighter = share(1, 'lighter'), tape = share(1, 'tape');
  assert.ok(Math.abs(lighter - SUPPLY.lighter) < 0.06, `a lighter in ${Math.round(lighter * 100)} of 100`);
  assert.ok(Math.abs(tape - SUPPLY.tape) < 0.06, `tape in ${Math.round(tape * 100)} of 100`);
  assert.ok(Math.abs(top - SUPPLY.torch[0]) < 0.06, `a torch where you land in ${Math.round(top * 100)} of 100`);
  assert.ok(Math.abs(low - SUPPLY.torch[1]) < 0.06, `a torch further down in ${Math.round(low * 100)} of 100`);
  assert.ok(Math.abs(chalk - SUPPLY.chalk) < 0.06, `chalk in ${Math.round(chalk * 100)} of 100`);
});

test('sparser supplies retain an early battery opportunity and refill coverage even on a small floor', () => {
  for (const eligible of [0, 1, 4, 5, 12, 20, 36]) {
    const level = part(`coverage-${eligible}`, 1, eligible), batteries = planSupplies(level).filter(s => s.type === 'battery');
    if (!eligible) { assert.deepEqual(planSupplies(level), []); continue; }
    const first = batteries[0];
    assert.ok(first.rooms.length > 0 && first.rooms.length <= 4);
    assert.ok(first.rooms.every(id => id >= 1 && id <= Math.min(4, eligible)), 'first pack stays in the early group');
    for (const pack of batteries.slice(1)) {
      assert.ok(pack.rooms.length >= 1 && pack.rooms.length <= 8, 'later packs retain multiple placement opportunities');
      assert.ok(pack.rooms.every(id => id > 4));
    }
    const coverage = batteries.flatMap(pack => pack.rooms).sort((a, b) => a - b);
    assert.deepEqual(coverage, supplyRooms(level).map(room => room.id), 'disjoint groups cover the whole eligible floor');
  }
});

test('a typical part has roughly six scattered finds rather than eleven, without reducing every pack to a lone placement', () => {
  let finds = 0, snacks = 0, stacks = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const plan = planSupplies(part(seed, 2));
    finds += plan.length; snacks += plan.filter(s => s.type === 'snack').length; stacks += plan.filter(s => s.type === 'paper').length;
    assert.equal(plan.filter(s => s.type === 'battery').length, 4, '24 rooms keep an early pack and three later packs');
  }
  assert.ok(finds / 1000 >= 5.5 && finds / 1000 <= 6.3, `${finds / 1000} finds per part`);
  assert.ok(snacks / 1000 >= .4 && snacks / 1000 <= .6, `${snacks / 1000} snacks per part`);
  assert.ok(stacks / 1000 >= .4 && stacks / 1000 <= .6, `${stacks / 1000} paper stacks per part`);
});

test('anything else is only there for somebody: what a creature or a resident on the part cares about, one of each', () => {
  const level = floors(1)[0], ABOUT = ['battery', 'snack', 'torch', 'chalk', 'paper', 'lighter', 'tape'];
  const types = (wanted) => planSupplies(level, wanted).map((s) => s.type).filter((t) => !ABOUT.includes(t)).sort();
  assert.deepEqual(types([]), []);
  assert.deepEqual(types(['battery', 'torch', 'paper']), [], 'what is about anyway is not left twice');
  assert.deepEqual(types(['balloon', 'scissors', 'balloon']), ['balloon', 'scissors']);
  assert.deepEqual(types(['a-stapler', 'pink-slip', undefined, 7]), [], 'only things that can be left lying (a pink slip is only ever handed to you)');
  // what is lying about does not move when somebody is added who wants something
  assert.deepEqual(planSupplies(level, ['balloon']).filter((s) => s.type !== 'balloon'), planSupplies(level, []));
  // (and what the cast says it cares about is always something that can be carried)
  for (const m of CAST) for (const t of m.items || []) assert.ok(ITEMS.includes(t) && ITEM_DEFS[t], `${m.id} cares about ${t}`);
});

test('something can take a share of the camcorder\'s charge, but only the clock can stop the tape', () => {
  const cam = createCameraBattery(), start = cam.read().remaining;
  assert.equal(start, CAMERA_TUNING.start);
  const half = cam.drain(0.5);
  assert.deepEqual({ ok: half.ok, taken: half.taken, remaining: half.remaining }, { ok: true, taken: start / 2, remaining: start / 2 });
  for (const bad of [0, -1, 1.5, NaN, undefined, '0.5']) { const before = cam.read(); assert.equal(cam.drain(bad).ok, false); assert.deepEqual(cam.read(), before); }
  assert.equal(cam.drain(1).remaining, 1, 'all of it leaves a second');
  assert.equal(cam.drain(1).ok, false, 'and there is nothing more to take');
  assert.equal(cam.read().depleted, false);
  assert.equal(cam.tick(2).depleted, true, 'the clock ends it');
  assert.equal(cam.drain(0.5).ok, false);
});
