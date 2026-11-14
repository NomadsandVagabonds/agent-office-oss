// Tests for Wave 3 Backrooms items, creature rules, and neutral NPC interactions.
import test from 'node:test';
import assert from 'node:assert/strict';

import { ITEM_IDS, kindOf, createHandOver, isPaper, isBalloon, isFlashlight } from '../public/world/backrooms/items.js';
import { CABLE, createCableState, stepCable, releaseCable } from '../public/world/backrooms/rooms/cable-drop/rule.js';
import { SHREDDER, createShredderState, stepShredder, releaseShredder } from '../public/world/backrooms/rooms/shredding-bay/rule.js';
import { PARTY, createPartyState, stepParty } from '../public/world/backrooms/rooms/mandatory-fun/rule.js';
import { BLACKOUT, createBlackoutState, stepBlackout, isInBeam } from '../public/world/backrooms/rooms/blackout-bay/rule.js';
import { WARDEN, createWardenState, stepWarden } from '../public/world/backrooms/rooms/safety-corridor/rule.js';
import { PARTNER, createPartnerState, stepPartner } from '../public/world/backrooms/rooms/audit-pod/rule.js';

test('the hand, as a resident asks after it: the selected pocket in the words a room uses; a pink slip is paper to a shredder and still a pink slip', () => {
  // stand-in pockets: one selected thing, a torch that may be lit
  const pockets = (item, lit = false) => { const p = { item, given: [], held: () => (p.item ? { ...p.item } : null), torchPower: () => (lit ? 1 : 0),
    give: (it) => { if (p.full) return { ok: false }; p.given.push(it); return { ok: true, accepted: 1 }; },
    consumeHeld: (type, n) => { if (!p.item || p.item.type !== type) return { ok: false, reason: 'wrong-item' }; if (p.item.type === 'paper' && p.item.quantity > n) p.item = { ...p.item, quantity: p.item.quantity - n }; else p.item = null; return { ok: true }; } }; return p; };
  assert.deepEqual(ITEM_IDS, ['papers', 'pink-slip', 'balloon', 'flashlight']);
  assert.ok(isPaper('papers') && isPaper('pink-slip') && !isPaper('balloon'));
  assert.ok(isBalloon('balloon') && !isBalloon('papers') && isFlashlight('flashlight') && !isFlashlight('pink-slip'));
  assert.equal(kindOf({ type: 'paper' }), 'papers'); assert.equal(kindOf({ type: 'torch' }), 'flashlight'); assert.equal(kindOf({ type: 'snack' }), null); assert.equal(kindOf(null), null);
  // no pockets at all: an empty hand, and nothing breaks
  const none = createHandOver(() => null);
  assert.equal(none.there(), false); assert.equal(none.get(), null); assert.ok(!none.hasPaper() && !none.hasBalloon() && !none.hasFlashlight());
  assert.equal(none.consume(isPaper), null); assert.equal(none.give('pink-slip'), 'pink-slip', 'nowhere to put it: it stays where it was');
  // a stack of paper: one sheet at a time
  let p = pockets({ id: 'a', type: 'paper', quantity: 2 }), hand = createHandOver(() => p);
  assert.ok(hand.hasPaper() && hand.has('papers') && !hand.hasBalloon());
  assert.equal(hand.consume(isBalloon), null); assert.equal(p.item.quantity, 2);
  assert.equal(hand.consume(isPaper), 'papers'); assert.equal(p.item.quantity, 1);
  assert.equal(hand.consume(isPaper), 'papers'); assert.equal(hand.get(), null);
  // a pink slip feeds a shredder, and is asked for by its own name
  p = pockets({ id: 'b', type: 'pink-slip' }); hand = createHandOver(() => p);
  assert.ok(hand.hasPaper() && hand.has('pink-slip') && !hand.has('papers'));
  assert.equal(hand.consume(isPaper), 'pink-slip'); assert.equal(p.item, null);
  // a torch is only a flashlight while it is on
  assert.equal(createHandOver(() => pockets({ id: 'c', type: 'torch', charge: 60 }, false)).hasFlashlight(), false);
  assert.equal(createHandOver(() => pockets({ id: 'c', type: 'torch', charge: 60 }, true)).hasFlashlight(), true);
  // being handed something: into a pocket, with an id of its own each time; a full bag hands it back
  p = pockets(null); hand = createHandOver(() => p, 'part-2');
  assert.equal(hand.give('pink-slip'), null); assert.equal(hand.swap('balloon'), null);
  assert.deepEqual(p.given.map((g) => g.type), ['pink-slip', 'balloon']); assert.equal(new Set(p.given.map((g) => g.id)).size, 2);
  p.full = true; assert.equal(hand.give('pink-slip'), 'pink-slip');
});

test('The Trunk Line (cable-drop): stays dormant when walked around, wakes under cords, and cannot pass a shut door', () => {
  let s = createCableState();
  // Walking calmly past at 1.9 m from the drop never wakes it
  for (let i = 0; i < 30; i++) {
    const r = stepCable(s, { dt: 0.1, distToDrop: 1.9, distToCreature: 1.9, playerSpeed: 2.0, insideRoom: true });
    s = r.state;
    assert.equal(s.phase, 'dormant');
    assert.equal(r.woke, false);
  }

  // Stepping directly under the cords wakes it into 'dropping', then 'hunting'
  const wake = stepCable(s, { dt: 0.1, distToDrop: 0.8, distToCreature: 0.8, playerSpeed: 1.8, insideRoom: true });
  assert.equal(wake.woke, true);
  assert.equal(wake.state.phase, 'dropping');
  s = wake.state;

  for (let i = 0; i < 8; i++) {
    s = stepCable(s, { dt: 0.1, distToDrop: 2.0, distToCreature: 2.0, playerSpeed: 3.5, insideRoom: true }).state;
  }
  assert.equal(s.phase, 'hunting');

  // Slamming a fire door blocks movement and triggers claw-rattles without catching
  let rattledAny = false;
  for (let i = 0; i < 12; i++) {
    const r = stepCable(s, { dt: 0.1, distToDrop: 4.0, distToCreature: 0.4, playerSpeed: 0, insideRoom: false, doorBlocked: true, clearLine: false });
    s = r.state;
    assert.equal(r.speed, 0);
    assert.equal(r.caught, false);
    if (r.rattled) rattledAny = true;
  }
  assert.equal(rattledAny, true);

  // With the door open and clear line within catchRadius, it catches
  const got = stepCable(s, { dt: 0.1, distToDrop: 3.0, distToCreature: CABLE.catchRadius - 0.1, insideRoom: true, doorBlocked: false, clearLine: true });
  assert.equal(got.caught, true);
});

test('The Retention Clerk (shredding-bay): paper appeases her into leaving; empty hands get pulled into the shredder', () => {
  // Path A: appease with paper (e.g. a pink slip)
  let s = createShredderState();
  s = stepShredder(s, { dt: 0.1, dist: 5.0, insideRoom: true }).state;
  assert.equal(s.phase, 'following');

  const fed = stepShredder(s, { dt: 0.1, dist: 1.6, insideRoom: true, holdingPaper: true, offeredPaper: true });
  assert.equal(fed.atePaper, true);
  assert.equal(fed.state.phase, 'shredding');
  s = fed.state;

  for (let t = 0; t < 2.5; t += 0.25) {
    s = stepShredder(s, { dt: 0.25, dist: 1.5, insideRoom: true }).state;
  }
  assert.equal(s.phase, 'leaving');
  assert.equal(s.caught, false);

  // Path B: caught empty-handed -> pulled into the rollers
  let s2 = createShredderState();
  s2 = stepShredder(s2, { dt: 0.1, dist: 4.0, insideRoom: true }).state;
  const grab = stepShredder(s2, { dt: 0.1, dist: SHREDDER.catchRadius - 0.1, insideRoom: true, holdingPaper: false, clearLine: true });
  assert.equal(grab.grabbed, true);
  assert.equal(grab.state.phase, 'pulling');
  s2 = grab.state;

  let finalCatch = false;
  for (let t = 0; t < 1.0; t += 0.15) {
    const r = stepShredder(s2, { dt: 0.15, dist: 0.3, insideRoom: true });
    s2 = r.state;
    if (r.caught) finalCatch = true;
  }
  assert.equal(finalCatch, true);
});

test('The Fun Committee (mandatory-fun): holding a red balloon makes them dance; empty hands past threshold trigger swarm', () => {
  let s = createPartyState();
  // Entering past threshold WITH a balloon triggers harmless partying even right beside them
  const party = stepParty(s, { dt: 0.2, insideRoom: true, pastThreshold: true, holdingBalloon: true, minDist: 0.2 });
  assert.equal(party.state.mode, 'partying');
  assert.equal(party.horn, true);
  assert.equal(party.caught, false);
  assert.equal(party.speed, 0);

  // Crossing threshold WITHOUT a balloon triggers swarming
  let s2 = createPartyState();
  const sw = stepParty(s2, { dt: 0.1, insideRoom: true, pastThreshold: true, holdingBalloon: false, minDist: 3.0 });
  assert.equal(sw.triggeredSwarm, true);
  assert.equal(sw.state.mode, 'swarming');
  assert.equal(sw.speed, PARTY.swarmSpeed);

  // Grabbing the red balloon mid-swarm immediately pacifies them back into partying
  const saved = stepParty(sw.state, { dt: 0.1, insideRoom: true, pastThreshold: false, holdingBalloon: true, minDist: 1.1 });
  assert.equal(saved.state.mode, 'partying');
  assert.equal(saved.speed, 0);
  assert.equal(saved.caught, false);

  // Staying empty-handed within catchRadius catches the visitor
  const caught = stepParty(sw.state, { dt: 0.1, insideRoom: true, pastThreshold: true, holdingBalloon: false, minDist: 0.4 });
  assert.equal(caught.caught, true);
});

test('The Stand-Ins (blackout-bay): unlit crossing floods crimson and kills; flashlight beam freezes aimed targets only', () => {
  // Unlit crossing -> red ramps to 1 and catches
  let s = createBlackoutState(2);
  let res;
  for (let i = 0; i < 12; i++) {
    res = stepBlackout(s, { dt: 0.1, inDark: true, hasFlashlight: false, px: 0, pz: 0, yaw: 0, targets: [{ x: 0, z: -4, los: true }, { x: 3, z: -2, los: true }] });
    s = res.state;
  }
  assert.equal(res.red, 1);
  assert.equal(res.caught, true);

  // With flashlight, looking straight toward -z (yaw = 0): target ahead (0, -4) freezes; target off to the side (3, 0) stalks
  assert.equal(isInBeam(0, 0, 0, 0, -4), true);
  assert.equal(isInBeam(0, 0, 0, 3, 0), false);

  let s2 = createBlackoutState(2);
  const lit = stepBlackout(s2, {
    dt: 0.1, inDark: true, hasFlashlight: true, px: 0, pz: 0, yaw: 0,
    targets: [{ x: 0, z: -4, los: true }, { x: 3, z: 0, los: true }],
  });
  assert.equal(lit.red, 0);
  assert.deepEqual(lit.frozen, [true, false]);
  assert.equal(lit.speeds[0], 0);
  assert.equal(lit.speeds[1], BLACKOUT.stalkSpeed);
  assert.equal(lit.caught, false);
});

test('The Floor Warden (safety-corridor): ignores walkers, chases runners with scissors, and trips onto them after 8s', () => {
  let s = createWardenState();
  // Walking right past at 2.05 m/s never triggers chase
  for (let i = 0; i < 20; i++) {
    const r = stepWarden(s, { dt: 0.1, dist: 1.2, playerSpeed: 2.05, insideRoom: true, clearLine: true });
    s = r.state;
    assert.equal(s.phase, 'patrol');
  }

  // Running (> 2.55 m/s) triggers whistle and fast scissor sprint
  const run = stepWarden(s, { dt: 0.1, dist: 4.5, playerSpeed: 3.6, insideRoom: true, clearLine: true });
  assert.equal(run.blewWhistle, true);
  assert.equal(run.state.phase, 'chasing');
  assert.equal(run.speed, WARDEN.chaseSpeed);
  s = run.state;

  // Evading for 8 seconds makes him trip on his own scissors and despawn
  let sawSnip = false, sawTrip = false, sawDespawn = false;
  for (let i = 0; i < 95; i++) {
    const r = stepWarden(s, { dt: 0.1, dist: 2.2, playerSpeed: 3.65, insideRoom: true, clearLine: true });
    s = r.state;
    if (r.snipped) sawSnip = true;
    if (r.trippedNow) sawTrip = true;
    if (r.despawned) sawDespawn = true;
    assert.equal(r.caught, false);
  }
  assert.equal(sawSnip, true);
  assert.equal(sawTrip, true);
  assert.equal(sawDespawn, true);
  assert.equal(s.phase, 'gone');
});

test('The Efficiency Partners (audit-pod): auto-give Pink Slip to empty hand, wait politely when holding another item', () => {
  // Empty hand: approaches and places 'pink-slip' automatically
  let s = createPartnerState();
  s = stepPartner(s, { dt: 0.1, dist: 4.0, insideRoom: true, handEmpty: true }).state;
  assert.equal(s.phase, 'approaching');

  const handOver = stepPartner(s, { dt: 0.1, dist: PARTNER.offerDist - 0.1, insideRoom: true, handEmpty: true });
  assert.equal(handOver.gaveSlip, true);
  assert.equal(handOver.state.phase, 'departing');

  // Occupied hand (e.g. holding flashlight): offers politely without overwriting unless acceptedViaUse
  let s2 = createPartnerState();
  s2 = stepPartner(s2, { dt: 0.1, dist: 4.0, insideRoom: true, handEmpty: false }).state;
  const polite = stepPartner(s2, { dt: 0.1, dist: 1.0, insideRoom: true, handEmpty: false });
  assert.equal(polite.gaveSlip, false);
  assert.equal(polite.canSwap, true);
  assert.equal(polite.state.phase, 'offering');

  const swapped = stepPartner(polite.state, { dt: 0.1, dist: 1.0, insideRoom: true, handEmpty: false, acceptedViaUse: true });
  assert.equal(swapped.gaveSlip, true);
  assert.equal(swapped.state.phase, 'departing');
});

/* ---- nothing down here is an instant death: after a catch that was lived through, each of them lets go ------------- */

test('the Trunk Line lets go: after a strangle that was survived it hangs back for a while, harmless, and then comes on again', () => {
  let s = { ...createCableState(), phase: 'hunting' };
  let r = stepCable(s, { dt: 0.05, distToDrop: 5, distToCreature: CABLE.catchRadius - 0.1, insideRoom: true, clearLine: true });
  assert.ok(r.caught);
  s = releaseCable(r.state);
  assert.equal(s.phase, 'recoiling'); assert.equal(s.caught, false);
  for (let t = 0; t < CABLE.recoil - 0.2; t += 0.05) { r = stepCable(s, { dt: 0.05, distToDrop: 5, distToCreature: 0.1, insideRoom: true, clearLine: true }); s = r.state; assert.ok(!r.caught && r.speed === 0, 'standing right against it, and it does nothing'); }
  for (let t = 0; t < 0.5; t += 0.05) { r = stepCable(s, { dt: 0.05, distToDrop: 5, distToCreature: 4, insideRoom: true, clearLine: true }); s = r.state; }
  assert.equal(s.phase, 'hunting'); assert.ok(r.speed > 0);
  assert.ok(CABLE.hurts === 1 && CABLE.recoil >= 4);
});

test('the Retention Clerk lets go: after the rollers she is content for a while and goes home, and then she is waiting again; after paper she is done for good', () => {
  let s = releaseShredder({ ...createShredderState(), phase: 'pulling', caught: true, timer: SHREDDER.pullTime });
  assert.equal(s.phase, 'leaving'); assert.equal(s.caught, false);
  let r = null;
  for (let t = 0; t < SHREDDER.respite - 0.5; t += 0.1) { r = stepShredder(s, { dt: 0.1, dist: 0.2, insideRoom: true, holdingPaper: false, clearLine: true }); s = r.state; assert.ok(!r.grabbed && !r.caught && s.phase === 'leaving', 'right beside her, empty-handed, and she is not interested'); }
  for (let t = 0; t < 1; t += 0.1) { r = stepShredder(s, { dt: 0.1, dist: 6, insideRoom: false, clearLine: true }); s = r.state; }
  assert.ok(s.phase === 'waiting' || s.phase === 'following', 'and then she is');
  // fed paper: leaving, and still leaving an hour later
  s = { ...createShredderState(), phase: 'leaving' };
  for (let t = 0; t < 3600; t += 1) s = stepShredder(s, { dt: 1, dist: 0.2, insideRoom: true, clearLine: true }).state;
  assert.equal(s.phase, 'leaving');
  assert.ok(SHREDDER.hurts === 2 && SHREDDER.respite >= 8);
});
