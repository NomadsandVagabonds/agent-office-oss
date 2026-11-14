// The Backrooms — Cover: the rule. Pure: no three.js, no DOM (rooms/cover.js draws it; test/backrooms-tape.test.mjs
// plays it with a made-up visitor).
//
// A desk on one side wall, its screen against the wall. A stock cupboard in the far corner on the other side, behind
// a roller shutter that is up while the desk is attended: somebody on its mat, looking at its screen. A tape deck.
// The deck is the tape (../../tape.js): it records the visitor and plays them back as a figure with a body and eyes.
import { blank, rec, record, play, attended } from '../../tape.js';

export const COVER = Object.freeze({
  grace: 0.8,       // seconds a screen left alone takes to notice
  rise: 0.9,        // seconds the shutter takes to go up · and to come down
  fall: 0.55,
  through: 0.72,    // how far up it has to be to walk under
  matR: 0.75,       // the mat in front of the desk
  deckR: 1.3,       // how near the deck E works
  deep: 1.9, wide: 1.75,   // the cupboard: how far out from the back wall its shutter is, and how wide its mouth
});

/**
 * Where everything is, in the room's own frame (x across, z deep, the way in at z = +D/2).
 * @param p  what the deck line rolled: side (±1: which wall the desk is on), deskZ, seconds
 */
export function layout(W, D, p) {
  const s = p.side, wall = s * W / 2, far = -s * W / 2, back = -D / 2;
  const inner = far + s * COVER.wide;                                       // the cupboard's partition
  const cup = { x0: Math.min(far, inner), x1: Math.max(far, inner), z0: back, z1: back + COVER.deep };
  return {
    side: s, seconds: p.seconds,
    desk: { x: wall - s * 0.5, z: p.deskZ, mat: { x: wall - s * 1.6, z: p.deskZ, r: COVER.matR }, screen: { x: wall - s * 0.42, z: p.deskZ } },
    deck: { x: far + s * 0.55, z: D / 2 - 2.2, stand: { x: far + s * 1.45, z: D / 2 - 2.2 } },
    cup, inner, mouth: { x: (cup.x0 + cup.x1) / 2, z: cup.z1 }, reward: { x: far + s * 0.62, z: back + 0.5 },
  };
}
export const inCupboard = (L, x, z) => x > L.cup.x0 && x < L.cup.x1 && z < L.cup.z1 + 0.05;

/** The room before anybody has touched anything. */
export const fresh = (L) => ({ tape: blank(L.seconds), figure: null, awake: false, alone: 9, lift: 0, moving: 0, said: [] });

/** E at the deck: record, wiping whatever was on the tape. Not while it is recording already. */
export function press(s, L, me) {
  if (s.tape.state === 'rec' || Math.hypot(me.x - L.deck.x, me.z - L.deck.z) > COVER.deckR + 0.6) return s;
  return { ...s, tape: rec(s.tape), figure: null, said: ['rec'] };
}

/**
 * One moment of the room.
 * @param me  { x, z, yaw, inside }  the visitor, in the room's frame
 * @returns the room a moment later. `said` is what happened in that moment, for whoever makes the noises:
 *          'tick' (a second of tape) · 'play' (the tape ran out and is playing) · 'held' (the figure stopped) ·
 *          'wake' / 'sleep' (the screen) · 'up' / 'down' (the shutter set off)
 */
export function step(s, dt, me, L) {
  const said = [];
  let { tape, figure } = s;
  if (tape.state === 'rec') {
    const before = Math.floor(tape.t);
    tape = record(tape, dt, me);
    if (tape.state === 'play') said.push('play'); else if (Math.floor(tape.t) > before) said.push('tick');
  } else if (tape.state === 'play') {
    const was = figure && figure.held, p = play(tape, dt);
    tape = p.tape; figure = p.figure;
    if (figure && figure.held && !was) said.push('held');
  }
  const here = me.inside === false ? null : me;
  const awake = attended(L.desk, [here, figure]);
  if (awake !== s.awake) said.push(awake ? 'wake' : 'sleep');
  const alone = awake ? 0 : s.alone + dt;
  // up while attended, and for a moment after; and never down on somebody who is in the cupboard
  const want = awake || alone < COVER.grace || (here && inCupboard(L, here.x, here.z)) ? 1 : 0;
  const lift = Math.max(0, Math.min(1, s.lift + (want ? dt / COVER.rise : -dt / COVER.fall)));
  const moving = lift > s.lift ? 1 : lift < s.lift ? -1 : 0;
  if (moving && moving !== s.moving) said.push(moving > 0 ? 'up' : 'down');
  return { tape, figure, awake, alone, lift, moving, said };
}
/** Can the cupboard be walked into just now? */
export const open = (s) => s.lift >= COVER.through;
