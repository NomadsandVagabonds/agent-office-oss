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

test('how much: a battery pack to every few rooms, a snack or two, a torch more often than not where you land, and every one can be made', () => {
  const all = floors(40);
  let torchTop = 0, tops = 0, torchLow = 0, lows = 0, chalk = 0;
  for (const level of all) {
    const plan = planSupplies(level), of = (type) => plan.filter((s) => s.type === type);
    assert.equal(of('battery').length, Math.ceil(supplyRooms(level).length / SUPPLY.batteryEvery));
    assert.ok(of('snack').length >= SUPPLY.snacks[0] && of('snack').length <= SUPPLY.snacks[1]);
    assert.ok(of('torch').length <= 1 && of('chalk').length <= 1);
    for (const t of of('torch')) assert.ok(t.charge >= SUPPLY.torchCharge[0] && t.charge <= SUPPLY.torchCharge[1] && t.charge < ITEM_DEFS.torch.maxCharge, 'a found torch is never a full one');
    for (const s of plan) { const { id, type, rooms, ...made } = s; assert.doesNotThrow(() => makeItem(type, id, made), `${id} is something the pockets know`); }
    assert.ok(plan.every((s) => ['battery', 'snack', 'torch', 'chalk'].includes(s.type)), 'nothing else, unless somebody wants it');
    if ((level.depth ?? 0) === 0) { tops++; torchTop += of('torch').length; } else { lows++; torchLow += of('torch').length; }
    chalk += of('chalk').length;
  }
  assert.ok(torchTop / tops > 0.5 && torchTop / tops < 0.9, `a torch where you land in ${torchTop} of ${tops}`);
  assert.ok(torchLow / lows > 0.2 && torchLow / lows < 0.6, `a torch further down in ${torchLow} of ${lows}`);
  assert.ok(chalk / all.length > 0.3 && chalk / all.length < 0.7);
});

test('anything else is only there for somebody: what a creature on the floor cares about, one of each', () => {
  const level = floors(1)[0];
  const types = (wanted) => planSupplies(level, wanted).map((s) => s.type).filter((t) => !['battery', 'snack', 'torch', 'chalk'].includes(t)).sort();
  assert.deepEqual(types([]), []);
  assert.deepEqual(types(['battery', 'torch']), [], 'what is about anyway is not left twice');
  assert.deepEqual(types(['paper', 'balloon', 'paper', 'scissors']), ['balloon', 'paper', 'scissors']);
  assert.deepEqual(types(['a-stapler', undefined, 7]), [], 'only things the pockets know');
  const paper = planSupplies(level, ['paper']).find((s) => s.type === 'paper');
  assert.ok(Number.isInteger(paper.quantity) && paper.quantity >= SUPPLY.paper[0] && paper.quantity <= SUPPLY.paper[1] && paper.quantity <= ITEM_DEFS.paper.maxStack);
  // (and what the cast says it cares about is always something that can be left)
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
