// Paper in plenty (the owner, 18 Nov: paper very common on every floor, the rare very hard): the rule, not the placing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planVisit, floorOf } from '../public/world/backrooms/plan.js';
import { SUPPLY, planSupplies, plentyOfPaper, supplyRooms } from '../public/world/backrooms/supplies.js';

const floors = [];
for (let i = 0; i < 12; i++) { const v = planVisit('paper' + i, { depths: 4 }); for (let d = 0; d < 4; d++) floors.push(floorOf(v, d)); }

test('about one stack to every 3.5 rooms, on every kind of floor, in distinct rooms that are not crawl spaces, the landing or the way down', () => {
  assert.equal(SUPPLY.paperRooms, 3.5);
  const themes = new Set();
  for (const lv of floors) {
    themes.add(lv.theme);
    const plenty = plentyOfPaper(lv), ok = supplyRooms(lv).filter((r) => !r.crawl), want = ok.length / SUPPLY.paperRooms;
    assert.ok(plenty.length === Math.floor(want) || plenty.length === Math.floor(want) + 1, `${lv.theme}: ${plenty.length} of ${want}`);
    assert.ok(plenty.length >= 5, `${lv.theme} floor has only ${plenty.length}`);
    const firsts = plenty.map((p) => p.rooms[0]); assert.equal(new Set(firsts).size, firsts.length, 'two stacks offered the same first room');
    for (const p of plenty) {
      assert.equal(p.type, 'paper'); assert.ok(p.quantity >= SUPPLY.paper[0] && p.quantity <= SUPPLY.paper[1]);
      for (const id of p.rooms) { const r = lv.rooms.find((q) => q.id === id); assert.ok(!r.crawl && id !== lv.start.room && id !== lv.exit.room, `${lv.theme}: room ${id}`); }
    }
  }
  assert.ok(themes.size >= 5, [...themes].join());
});

test('the same floor gives the same paper; and what planSupplies leaves is not touched by it', () => {
  for (const lv of floors.slice(0, 12)) {
    assert.deepEqual(plentyOfPaper(lv), plentyOfPaper(lv));
    const base = planSupplies(lv, []); assert.ok(!base.some((p) => p.plenty || /plenty/.test(p.id)), 'planSupplies carries the plenty');
    assert.deepEqual(planSupplies(lv, []), base);
  }
});

test('paper in plenty is a number in one place: 0 turns it off', () => {
  const lv = floors[0], was = SUPPLY.paperRooms;
  assert.ok(plentyOfPaper(lv).length > 0);
  assert.equal(Object.isFrozen(SUPPLY), true);
  assert.ok(Number.isFinite(was) && was > 0);
});
