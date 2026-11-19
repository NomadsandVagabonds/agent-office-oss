// The Open-Plan Pit: more of the partition caps are down, dealt per visit, and there is always a way across, never a straight run
// (the owner, 18 Nov); and the room is never a dead end (gen.js `through`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { dealBreaks, pitBreaksOk, PIT_BREAKS, buildGridPlan, gridFloorY, GRID } from '../public/world/backrooms/rooms/cubicle-grid/rule.js';
import { makeRng, ARCHETYPES } from '../public/world/backrooms/gen.js';
import { planVisit, floorOf } from '../public/world/backrooms/plan.js';

test('every deal is solvable, keeps no straight run of caps, and takes turns to cross; the fallback is a good deal too', () => {
  assert.equal(pitBreaksOk(PIT_BREAKS.fallback).ok, true);
  const seen = new Set();
  for (let i = 0; i < 600; i++) {
    const broken = dealBreaks(makeRng('pit' + i));
    const r = pitBreaksOk(broken);
    assert.ok(r.ok, `${broken.join()}: ${r.reason}`);
    assert.ok(r.turns >= PIT_BREAKS.minTurns);
    assert.ok(broken.length >= PIT_BREAKS.min && broken.length <= PIT_BREAKS.max, `${broken.length} broken`);
    assert.deepEqual(broken, dealBreaks(makeRng('pit' + i)), 'the same seed deals the same');
    seen.add(broken.join());
  }
  assert.ok(seen.size > 20, `${seen.size} different deals`);
});

test('checks refuse a straight run, a row with nothing left, and too few turns', () => {
  assert.match(pitBreaksOk(['2:2', '3:1']).reason, /column 1 keeps 4 caps/);                          // the old two: column 1 is intact from foyer to door
  assert.match(pitBreaksOk(['1:0', '2:0', '3:0', '1:1', '2:2']).reason, /row 0 has no cap left/);
  assert.match(pitBreaksOk(['1:3', '2:3', '3:0', '3:2', '1:1']).reason, /column 2 keeps 3 caps/);   // three in a row is a sprint
  // a deal that crosses with one column switch (two turns) is refused too
  const few = []; for (let r = 0; r < 4; r++) for (let c = 1; c <= 3; c++) few.push(`${c}:${r}`);
  assert.equal(pitBreaksOk(['1:2', '2:2']).ok, false);
});

test('a plan built from a deal has exactly those caps down, and a walk of intact caps still crosses', () => {
  for (let i = 0; i < 40; i++) {
    const breaks = dealBreaks(makeRng('plan' + i)), plan = buildGridPlan(15, 17, 3.4, 1, breaks);
    assert.equal(plan.brokenSpans.length, breaks.length);
    for (const b of plan.brokenSpans) { assert.ok(breaks.includes(`${b.col}:${b.row}`)); assert.equal(gridFloorY(plan, b.cx, (b.z0 + b.z1) / 2), GRID.pitDepth); }
    // no column is intact all the way from the foyer to the north cap
    for (let c = 1; c <= 3; c++) {
      let all = true; for (let z = plan.gridZ1 - 0.1; z >= plan.northBeamZ; z -= 0.125) if (gridFloorY(plan, plan.colX[c], z) !== 0) { all = false; break; }
      assert.equal(all, false, `column ${c} is a straight line (${breaks.join()})`);
    }
  }
  // asked for nothing it is the two it always was
  const old = buildGridPlan(15, 17, 3.4, 1);
  assert.equal(old.brokenSpans.length, 2);
});

test('the Open-Plan Pit is never a dead end: its back wall always has a doorway, on every floor that deals it', () => {
  assert.equal(ARCHETYPES['cubicle-grid'].through, true);
  let seen = 0;
  for (let i = 0; i < 120; i++) {
    const v = planVisit('pitdoor' + i, { depths: 4 });
    for (let d = 0; d < 4; d++) for (const r of floorOf(v, d).rooms) if (r.arch === 'cubicle-grid') { seen++; assert.ok(r.doors.some((x) => x.side === 'back') && r.doors.some((x) => x.side === 'front'), `seed pitdoor${i} floor ${d} room ${r.id}: ${r.doors.map((x) => x.side)}`); }
  }
  assert.ok(seen >= 10, `only ${seen} pits seen`);
});
