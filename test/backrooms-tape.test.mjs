// The tape (public/world/backrooms/tape.js), and the two rooms proposed on it (docs/backrooms-lab/TAPE.md), played by a
// made-up visitor against a made-up clock. Nothing here draws anything: it is the proof that each room's answer works,
// that the obvious wrong ways fail for the reason the design says, and that nobody gets the reward without the tape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAPE, yawTo, looksAt, clearLine, blank, rec, record, play, onMat, attended, colleague } from '../public/world/backrooms/tape.js';

const DT = 0.05, WALK = 2.05, HURRY = 3.7;          // (player.js: how fast a visitor walks and hurries)

/** A made-up visit to one room: a visitor, a deck, maybe a cardboard colleague, and whatever the room says is open. */
function visit(room) {
  const s = { t: 0, me: { ...room.start }, tape: blank(room.seconds), figure: null, card: room.card ? { ...room.card, unseen: 0 } : null, open: false, shut: 0, log: [] };
  const tick = () => {
    if (s.tape.state === 'rec') s.tape = record(s.tape, DT, s.me);
    else { const p = play(s.tape, DT); s.tape = p.tape; s.figure = p.figure; }
    if (s.card) s.card = colleague(s.card, DT, [s.me, s.figure], room.solids);
    const want = room.open(s);
    s.shut = want ? 0 : s.shut + DT;
    s.open = want || (s.open && s.shut < room.grace);          // (a shutter takes `grace` seconds to notice and come down)
    s.t += DT;
  };
  const api = {
    s,
    /** Stand for a while, looking wherever you were (or at a spot). */
    wait(seconds, look) { for (let t = 0; t < seconds; t += DT) { if (look) s.me.yaw = yawTo(s.me.x, s.me.z, look[0], look[1]); tick(); } return api; },
    /** Walk to a spot. `look`: a spot to keep looking at on the way (walking backwards if need be); otherwise look where you go. */
    go(x, z, look, speed = WALK) {
      for (let n = 0; n < 4000; n++) {
        const dx = x - s.me.x, dz = z - s.me.z, d = Math.hypot(dx, dz);
        if (d < 0.02) break;
        const step = Math.min(d, speed * DT);
        s.me.x += (dx / d) * step; s.me.z += (dz / d) * step;
        s.me.yaw = look ? yawTo(s.me.x, s.me.z, look[0], look[1]) : yawTo(0, 0, dx, dz);
        tick();
      }
      return api;
    },
    /** E at the deck: it records for as long as its tape is, and then plays. */
    press() { assert.ok(Math.hypot(s.me.x - room.deck.x, s.me.z - room.deck.z) < 1.3, 'nowhere near the deck'); s.tape = rec(s.tape); s.figure = null; return api; },
    /** Did the visitor get inside while it was open? */
    reach(x, z, speed = WALK) { api.go(x, z, null, speed); return s.open; },
  };
  return api;
}

// ---------------------------------------------------------------- the rule itself
test('a tape keeps where you stood and where you looked, plays it back, and holds its last frame', () => {
  let tape = rec(blank(2));
  for (let i = 0; i < 39; i++) { const t = i * DT; tape = record(tape, DT, { x: t, z: 0, yaw: t < 1 ? 0 : 1 }); }
  assert.equal(tape.state, 'rec');
  tape = record(tape, DT, { x: 2, z: 0, yaw: 1 });
  assert.equal(tape.state, 'play', 'a full tape plays by itself');
  assert.equal(tape.frames.length, 2 * TAPE.hz + 1);
  let p = play(tape, 0.5); assert.ok(Math.abs(p.figure.x - 0.5) < 0.11 && p.figure.yaw === 0 && !p.figure.held);
  p = play(p.tape, 1.0); assert.ok(Math.abs(p.figure.x - 1.5) < 0.11 && p.figure.yaw === 1);
  p = play(p.tape, 5); assert.ok(p.figure.held && Math.abs(p.figure.x - 2) < 0.11, 'it stays where the tape ran out');
  assert.equal(play(blank(), 1).figure, null);
  assert.equal(rec(tape).frames.length, 0, 'recording again wipes it');
});

test('what was done on the tape is done again, once, when it comes round', () => {
  let tape = rec(blank(1));
  for (let i = 0; i < 20; i++) tape = record(tape, DT, { x: 0, z: 0, yaw: 0 }, i === 10 ? 'button' : null);
  tape = record(tape, DT, { x: 0, z: 0, yaw: 0 });
  const seen = [];
  for (let i = 0; i < 40; i++) { const p = play(tape, DT); tape = p.tape; seen.push(...p.used); }
  assert.deepEqual(seen, ['button']);
});

test('looking: in front, near enough, and nothing in the way', () => {
  const me = { x: 0, z: 0, yaw: 0 };                                   // facing −z
  assert.ok(looksAt(me, 0, -5)); assert.ok(!looksAt(me, 0, 5)); assert.ok(!looksAt(me, 5, 0));
  assert.ok(!looksAt(me, 0, -5, [[-1, -3, 1, -2]]), 'a wall is a wall');
  assert.ok(clearLine(0, 0, 0, -5, [[2, -3, 3, -2]]));
});

test('a cardboard colleague comes to whoever is nearest while nobody looks, and not otherwise', () => {
  let k = { x: 0, z: -6, yaw: 0, unseen: 0 };
  const away = { x: 0, z: 0, yaw: Math.PI }, toward = { x: 0, z: 0, yaw: 0 };
  for (let i = 0; i < 200; i++) k = colleague(k, DT, [toward]);
  assert.equal(k.z, -6, 'watched, it stays');
  for (let i = 0; i < 400; i++) k = colleague(k, DT, [away]);
  assert.ok(Math.abs(Math.hypot(k.x, k.z) - TAPE.keep) < 0.02, 'unwatched, it comes as near as it comes');
  // a figure on a tape that faces it holds it as well as the visitor would
  let j = { x: 0, z: -6, yaw: 0, unseen: 0 };
  for (let i = 0; i < 200; i++) j = colleague(j, DT, [away, { x: 3, z: 0, yaw: yawTo(3, 0, 0, -6) }]);
  assert.equal(j.z, -6);
});

// ---------------------------------------------------------------- Cover
// A desk on one side of the room, its screen against the wall; a shutter on the far side that is up while the desk is
// attended. The deck is by the door. (Plan: docs/backrooms-lab/TAPE.md.)
const COVER = {
  start: { x: 0, z: 4.5, yaw: 0 }, deck: { x: -1.5, z: 3.5 }, seconds: 10, grace: 0.8, solids: [],
  desk: { mat: { x: 4, z: 0, r: 0.7 }, screen: { x: 5.2, z: 0 } }, shutter: [-5, -2.5],
  open(s) { return attended(COVER.desk, [s.me, s.figure]); },
};

test('Cover: at the desk yourself the shutter is up, and you cannot get to it', () => {
  const v = visit(COVER).go(4, 0).wait(1, [5.2, 0]);
  assert.ok(v.s.open, 'up while you sit and look at the screen');
  assert.ok(!v.reach(...COVER.shutter, HURRY), 'down again before you are across, even at a run');
});

test('Cover: tape yourself going to the desk and turning to watch the shutter — the screen sleeps, as it did for you', () => {
  const v = visit(COVER).go(-1.5, 3.5).press().go(4, 0).wait(20, COVER.shutter);
  assert.ok(v.s.figure.held && onMat(COVER.desk.mat, v.s.figure), 'the figure is at the desk');
  assert.ok(!v.s.open, 'and looking the wrong way');
});

test('Cover: tape yourself at the desk looking at the screen, and walk in', () => {
  const v = visit(COVER).go(-1.5, 3.5).press().go(4, 0).wait(8, [5.2, 0]);      // (the tape runs out while you sit there, and plays)
  assert.equal(v.s.tape.state, 'play');
  v.go(-4, -1.5).wait(10);                                                       // wait by the shutter for yourself to arrive
  assert.ok(v.s.open, 'the figure is attending');
  assert.ok(v.reach(...COVER.shutter));
});

// ---------------------------------------------------------------- Handover
// Two desks, east and west, each with its screen on its west side. A cage at the back, open while BOTH are attended.
// One cardboard colleague. The deck by the door.
const HAND = {
  start: { x: 0, z: 5, yaw: 0 }, deck: { x: 0, z: 4 }, seconds: 12, grace: 0.8,
  solids: [[-6, -4.2, -0.7, -3.8], [0.7, -4.2, 6, -3.8]],                        // the front of the cage, with its door in the middle
  A: { mat: { x: -4, z: 0, r: 0.7 }, screen: { x: -5.6, z: 0 } }, B: { mat: { x: 4, z: 0, r: 0.7 }, screen: { x: 2.6, z: 0 } },
  card: { x: 2, z: -2.5, yaw: 0 }, cage: [0, -5],
  open(s) { const all = [s.me, s.figure, s.card]; return attended(HAND.A, all, HAND.solids) && attended(HAND.B, all, HAND.solids); },
};
const lure = (v) => v.go(-5.25, 0).wait(9, [-6, 0]);                             // stand beyond desk A with your back to the room

test('Handover: you and your tape can open the cage between you, and then nobody is left to go in', () => {
  const v = visit(HAND).go(0, 4).press().go(-4, 0).wait(12, [-5.6, 0]);          // the figure will attend A
  v.go(4, 0, [-4, 0]).wait(10, [2.6, 0]);                                        // you attend B (keeping an eye on the cardboard on the way)
  assert.ok(v.s.open);
  assert.ok(!v.reach(...HAND.cage, HURRY), 'shut before you get there');
});

test('Handover: the cardboard colleague will sit at a desk for you — until you look away', () => {
  const v = lure(visit(HAND));
  assert.ok(onMat(HAND.A.mat, v.s.card), 'it came, and it is on the mat');
  assert.ok(attended(HAND.A, [v.s.card]), 'facing you, which is facing the screen');
  v.go(0, 4);                                                                    // walk off to the deck the ordinary way: looking where you go
  assert.ok(!onMat(HAND.A.mat, v.s.card), 'it followed');
});

test('Handover: lure it to A, back away watching it, tape yourself to B still watching it — and walk in', () => {
  const v = lure(visit(HAND));
  v.go(0, 4, [-4, 0]).press();                                                   // backwards to the deck, eyes on it
  v.go(4, 0, [-4, 0]).wait(13, [-4, 0]);                                         // backwards to B, eyes on it, until the tape runs out
  assert.equal(v.s.tape.state, 'play');
  assert.ok(onMat(HAND.A.mat, v.s.card), 'still there');
  v.go(0, -3, null).wait(12);                                                    // turn your back on all of it and go and stand at the cage
  assert.ok(onMat(HAND.A.mat, v.s.card), 'the figure has its eyes on it');
  assert.ok(v.s.figure.held && attended(HAND.B, [v.s.figure]), 'and from B, looking at A is looking at B\'s screen');
  assert.ok(v.s.open);
  assert.ok(v.reach(...HAND.cage));
});

test('Handover: taped looking the wrong way from B, the cardboard gets up and the cage shuts', () => {
  const v = lure(visit(HAND));
  v.go(0, 4, [-4, 0]).press();
  v.go(4, 0, [-4, 0]).wait(13, [6, 0]);                                          // at B you turn to face the wall
  v.go(0, -3, null).wait(12);
  assert.ok(!onMat(HAND.A.mat, v.s.card));
  assert.ok(!v.s.open);
});
