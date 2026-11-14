import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPES, isBig, generate } from '../public/world/backrooms/gen.js';
import {
  TETRIS_DECKS, SUMMIT_Y, SUMMIT_BELL,
  tetrisStash, tetrisFloorY, createBellCascade, stepBellCascade,
} from '../public/world/backrooms/rooms/cubicle-tetris/layout.js';
import {
  QA_SLIDE, ADJOURNED_SLIDE, ALL_HANDS,
  auditoriumFloorY, allHandsStash, createAllHandsState, stepAllHands,
} from '../public/world/backrooms/rooms/all-hands/rule.js';
import {
  N_BANKS, CAMP_SLOT, AISLE_GAP,
  canyonMetrics, slotCenterX, targetBankX, compactorStash, compactorWalkable, createCompactorState, stepCompactor,
} from '../public/world/backrooms/rooms/compactor-canyon/rule.js';
import {
  chasmWalkable, serverChasmStash, createChasmState, stepChasm,
} from '../public/world/backrooms/rooms/server-chasm/rule.js';

const STEP = 0.26;
const CELL = 0.125;

/** 12.5 cm grid flood-fill matching `world.walkable(rt).flood` rules. */
function floodHeightfield(W, D, floorFn, startPt, freeFn = () => true) {
  const r = 0.225;
  const nx = Math.ceil(W / CELL), nz = Math.ceil(D / CELL);
  const key = (x, z) => Math.floor((x + W / 2) / CELL) + nx * Math.floor((z + D / 2) / CELL);
  const seen = new Uint8Array(nx * nz);
  const k0 = key(startPt.x, startPt.z);
  seen[k0] = 1;
  const queue = [k0];
  while (queue.length) {
    const k = queue.pop();
    const i = k % nx, j = (k - i) / nx;
    const hx = -W / 2 + (i + 0.5) * CELL, hz = -D / 2 + (j + 0.5) * CELL;
    const hy = floorFn(hx, hz);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const kk = ii + nx * jj;
      if (seen[kk]) continue;
      const tx = hx + di * CELL, tz = hz + dj * CELL;
      if (Math.abs(tx) > W / 2 - r || Math.abs(tz) > D / 2 - r) continue;
      if (!freeFn(tx, tz, r)) continue;
      if (Math.abs(floorFn(tx, tz) - hy) > STEP) continue;
      seen[kk] = 1;
      queue.push(kk);
    }
  }
  return (x, z) => !!seen[key(x, z)];
}

test('Wave 4 set pieces are registered in ARCHETYPES as set pieces (isBig) and generate cleanly', () => {
  const ids = ['cubicle-tetris', 'all-hands', 'compactor-canyon', 'server-chasm'];
  for (const id of ids) {
    assert.ok(ARCHETYPES[id], `${id} is in ARCHETYPES`);
    assert.equal(isBig(ARCHETYPES[id]), true, `${id} is recognized as a set piece`);
    const level = generate(`w4-${id}`, { only: id, projects: ['Webstore'], agents: ['Ivory Marten'], tasks: ['Ship Wave 4'] });
    const room = level.rooms.find((r) => r.arch === id);
    assert.ok(room, `${id} generated on floor`);
  }
});

test('cubicle-tetris: pairwise-disjoint heightfield climbs from ground doorways to +4.80m summit within 0.26m steps', () => {
  // Check pairwise interior disjointness of TETRIS_DECKS
  for (let i = 0; i < TETRIS_DECKS.length; i++) {
    for (let j = i + 1; j < TETRIS_DECKS.length; j++) {
      const a = TETRIS_DECKS[i], b = TETRIS_DECKS[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      assert.ok(ox <= 1e-6 || oz <= 1e-6, `decks ${a.id} and ${b.id} do not overlap in interior`);
    }
  }

  for (const W of [15, 17]) {
    const D = W;
    const reached = floodHeightfield(W, D, tetrisFloorY, { x: 0, z: D / 2 - 0.5 });
    // Reaches side doorways on y = 0
    assert.equal(reached(-W / 2 + 0.5, 0), true, 'reaches left doorway');
    assert.equal(reached(W / 2 - 0.5, 0), true, 'reaches right doorway');
    // Reaches Summit (+4.80 m) & both summit stash zones
    assert.equal(tetrisFloorY(SUMMIT_BELL.x, SUMMIT_BELL.z), SUMMIT_Y);
    assert.equal(reached(2.5, -5.0), true, 'reaches Tier 5 summit pod');
    assert.equal(reached(SUMMIT_BELL.x, -6.4), true, 'reaches cantilevered chasm nose');
    for (const side of [-1, 1]) {
      const [x0, z0, x1, z1] = tetrisStash({ W, D }, side);
      assert.equal(reached((x0 + x1) / 2, (z0 + z1) / 2), true, `reaches summit stash (${side})`);
    }
  }

  // Bell cascade ripples down all 5 chasm tiers and resets
  let bell = createBellCascade();
  bell = stepBellCascade(bell, { rang: true }).state;
  assert.equal(bell.active, true);
  assert.equal(bell.litTier, 0);
  bell = stepBellCascade(bell, { dt: 1.8 }).state;
  assert.equal(bell.litTier, 4);
  bell = stepBellCascade(bell, { dt: 3.0 }).state;
  assert.equal(bell.active, false);
});

test('all-hands: raked bowl reaches pit & stage via twin stairs, and Q&A shutter advances/adjourns speaker', () => {
  for (const [W, D] of [[18, 20], [22, 24]]) {
    const reached = floodHeightfield(W, D, (x, z) => auditoriumFloorY(x, z, W, D), { x: 0, z: D / 2 - 0.5 });
    assert.equal(reached(-W / 2 + 0.5, 0), true, 'reaches left concourse door');
    assert.equal(reached(W / 2 - 0.5, 0), true, 'reaches right concourse door');
    const stageZ = -D / 2 + 5.2;
    assert.equal(reached(0, stageZ + 1.15), true, 'reaches orchestra pit Q&A mic');
    assert.equal(reached(0, stageZ - 1.5), true, 'reaches walnut proscenium stage');
    for (const side of [-1, 1]) {
      const [x0, z0, x1, z1] = allHandsStash({ W, D }, side);
      assert.equal(reached((x0 + x1) / 2, (z0 + z1) / 2), true, `reaches stage wing stash (${side})`);
    }
  }

  let st = createAllHandsState();
  for (let i = 0; i < QA_SLIDE; i++) st = stepAllHands(st, { clickedSlide: true }).state;
  assert.equal(st.phase, 'qa');
  assert.equal(st.slide, QA_SLIDE);

  // Advance across one shutter period -> speaker steps forward
  const rStep = stepAllHands(st, { dt: ALL_HANDS.shutterPeriod + 0.05, insideRoom: true, distToSpeaker: 6 });
  st = rStep.state;
  assert.equal(rStep.stepped, true);
  assert.ok(st.speakerProgress >= ALL_HANDS.stepAdvance);

  // Cornering visitor triggers setback to Slide 2
  const rCatch = stepAllHands(st, { dt: 0.1, insideRoom: true, distToSpeaker: 0.6 });
  assert.equal(rCatch.setback, true);
  assert.equal(rCatch.state.phase, 'slides');
  assert.equal(rCatch.state.slide, QA_SLIDE - 1);

  // Re-enter Q&A and adjourn at aisle microphone
  const qa2 = stepAllHands(rCatch.state, { clickedSlide: true }).state;
  const rAdj = stepAllHands(qa2, { usedMic: true });
  assert.equal(rAdj.adjourned, true);
  assert.equal(rAdj.state.phase, 'adjourned');
  assert.equal(rAdj.state.slide, ADJOURNED_SLIDE);
});

test('compactor-canyon: 5 monoliths roll cleanly across all 6 slots and reveal hidden Slot 3 camp', () => {
  const W = 16, D = 18;
  const { halfSpan, bankW } = canyonMetrics(W, D);
  for (let slot = 0; slot <= N_BANKS; slot++) {
    for (let i = 0; i < N_BANKS; i++) {
      const cx = targetBankX(W, i, slot);
      assert.ok(cx - bankW / 2 >= -halfSpan - 1e-6 && cx + bankW / 2 <= halfSpan + 1e-6, `bank ${i} stays inside rail bay`);
      if (i > 0) {
        const prev = targetBankX(W, i - 1, slot);
        const gap = (cx - bankW / 2) - (prev + bankW / 2);
        assert.ok(Math.abs(gap - (slot === i ? AISLE_GAP : 0.14)) < 1e-5, `slot ${slot} gap ${i} matches exact width`);
      }
    }
  }

  let st = createCompactorState(W, 1);
  assert.equal(st.openSlot, 1);
  const reachInit = floodHeightfield(W, D, () => 0, { x: 0, z: D / 2 - 0.5 }, (x, z, r) => compactorWalkable(x, z, r, W, D, st));
  assert.equal(reachInit(-W / 2 + 0.5, 0), true, 'reaches left perimeter door');
  assert.equal(reachInit(W / 2 - 0.5, 0), true, 'reaches right perimeter door');
  assert.equal(reachInit(0, -D / 2 + 0.5), true, 'reaches back perimeter door');
  for (const side of [-1, 1]) {
    const [x0, z0, x1, z1] = compactorStash({ W, D, params: { initialSlot: 1 } }, side);
    assert.equal(reachInit((x0 + x1) / 2, (z0 + z1) / 2), true, `reaches initial canyon stash (${side})`);
  }
  assert.equal(reachInit(slotCenterX(W, CAMP_SLOT), 0), false, 'sealed Slot 3 camp is blocked at t=0');

  // Turn crank on Bank 2 (`openSlot <= 2` -> opens Slot 3 = CAMP_SLOT!)
  let res = stepCompactor(st, { crankedBank: 2 });
  assert.equal(res.startedRoll, true);
  assert.equal(res.state.openSlot, CAMP_SLOT);
  st = res.state;
  for (let k = 0; k < 30 && st.anyMoving; k++) {
    res = stepCompactor(st, { dt: 0.1 });
    st = res.state;
  }
  assert.equal(st.anyMoving, false);
  assert.equal(res.campRevealed, true);
  const reachCamp = floodHeightfield(W, D, () => 0, { x: 0, z: D / 2 - 0.5 }, (x, z, r) => compactorWalkable(x, z, r, W, D, st));
  assert.equal(reachCamp(slotCenterX(W, CAMP_SLOT), 0), true, 'Slot 3 camp canyon is reachable once cranked open');
});

test('server-chasm: clip reaches wing stashes at t=0, blocks abyss, and bridges across to spire once both breakers lock', () => {
  const W = 13, D = 14;
  let st = createChasmState();
  const reach0 = floodHeightfield(W, D, () => 0, { x: 0, z: D / 2 - 0.5 }, (x, z, r) => chasmWalkable(x, z, r, W, D, st));

  for (const side of [-1, 1]) {
    const [x0, z0, x1, z1] = serverChasmStash({ W, D }, side);
    assert.equal(reach0((x0 + x1) / 2, (z0 + z1) / 2), true, `reaches wing stash (${side}) at t=0`);
  }
  assert.equal(reach0(0, 0.9), false, 'mid-chasm pylon is unreachable before breaker 1');
  assert.equal(reach0(0, -2.8), false, 'central spire is unreachable before breakers');

  // Throw both breakers and let drawbridges extend
  st = stepChasm(st, { toggle1: true, toggle2: true }).state;
  for (let i = 0; i < 15; i++) st = stepChasm(st, { dt: 0.1 }).state;
  assert.equal(st.ext1, 1);
  assert.equal(st.ext2, 1);

  const reachBridged = floodHeightfield(W, D, () => 0, { x: 0, z: D / 2 - 0.5 }, (x, z, r) => chasmWalkable(x, z, r, W, D, st));
  assert.equal(reachBridged(0, 0.9), true, 'reaches mid-chasm pylon');
  assert.equal(reachBridged(0, -2.8), true, 'reaches central cooling spire');

  const flushRes = stepChasm(st, { triggerFlush: true, dt: 0.5 });
  assert.equal(flushRes.startedFlush, true);
  assert.equal(flushRes.state.flushed, true);
  assert.ok(flushRes.state.fanSpeed > 0.75);
});
