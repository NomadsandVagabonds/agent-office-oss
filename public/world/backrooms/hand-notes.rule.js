// The Backrooms — a sticky note stuck on the visitor's own picture (the lead, of the sticky notes: "a flat thing in front
// of the lens that the wipe visibly takes away"; it belongs with the hand's view, as the held scissors do). Where one is on
// the picture, a given time after it landed or after it was taken off. Pure: no three.js, nothing random. hand-notes.js
// draws it; the cast's rule says when one sticks and when it goes (env.hand.stick / unstick).
//
//   on      slapped on: it comes in a little large and settles flat on the lens, with a small shiver
//   wiped   it goes with the wipe's hand (hand-moves.rule.js): dragged across to the left and down out of the picture
//   swatted knocked off to the side the swat went, spinning
//   burnt   it curls up from its corners, darkening, and is gone
//   fell    its free edge peels, it tips off and drops out of the bottom of the picture
import { MOVES, wipePose } from './hand-moves.rule.js';

export const NOTE = Object.freeze({
  size: 0.07,           // metres across, as held in front of the lens
  depth: 0.28,          // metres in front of the lens
  on: 0.14,             // seconds to settle
  off: Object.freeze({ wiped: 0.3, swatted: 0.28, burnt: 0.55, fell: 0.7 }),
});
export const HOWS = Object.freeze(Object.keys(NOTE.off));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (u) => { const k = clamp(u, 0, 1); return k * k * (3 - 2 * k); };
const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);

/** Where one lands, from what the cast says ({ u, v, turn } with u, v −1…1 on the picture) → the same, made safe. */
export function placed(spot = {}) {
  return { u: clamp(fin(spot.u), -1, 1), v: clamp(fin(spot.v), -1, 1), turn: fin(spot.turn) };
}

/**
 * A note stuck, `t` seconds after it landed at `spot` → { u, v, turn, scale, curl, dark }.
 * scale 1 is flat on the lens at its size; curl 0…1 lifts its corners; dark 0…1 browns it.
 */
export function stuckPose(t, spot) {
  const p = placed(spot), k = smooth(fin(t) / NOTE.on), shake = fin(t) < NOTE.on * 2 ? Math.sin(fin(t) * 70) * 0.05 * (1 - fin(t) / (NOTE.on * 2)) : 0;
  return { u: p.u, v: p.v, turn: p.turn + shake, scale: 1.35 - 0.35 * k, curl: 0.25 * (1 - k), dark: 0 };
}

/** Which side a note swatted off goes: the side it is on, unless the cast says otherwise. */
const sideOf = (p, dir) => Math.sign(typeof dir === 'number' ? dir : p.u) || 1;

/**
 * A note going, `t` seconds after it was taken off `how` from `spot` → the pose as stuckPose, or null once it has gone.
 * `dir` is for a swat (−1 / +1); anything else is ignored.
 */
export function offPose(how, t, spot, dir) {
  const len = NOTE.off[how] ?? NOTE.off.fell;
  if (!(t >= 0) || t >= len) return null;
  const p = placed(spot), k = t / len, e = smooth(k);
  switch (how) {
    case 'wiped': {
      // the hand's own sweep, from where it is on the wipe now to where the wipe ends: right to left and down
      const a = wipePose(MOVES.wipe * 0.55) ?? { x: 0, y: 0 }, b = wipePose(MOVES.wipe * 0.999) ?? { x: -0.34, y: -0.32 };
      const du = (b.x - a.x) * 4.2, dv = (b.y - a.y) * 4.2;
      return { u: p.u + du * e, v: p.v + dv * e, turn: p.turn - 0.6 * e, scale: 1, curl: 0.5 * e, dark: 0 };
    }
    case 'swatted': {
      const s = sideOf(p, dir);
      return { u: p.u + s * 2.6 * e, v: p.v + 0.5 * Math.sin(k * Math.PI) - 0.4 * k * k, turn: p.turn - s * 7 * k, scale: 1 - 0.25 * k, curl: 0.3, dark: 0 };
    }
    case 'burnt':
      return { u: p.u, v: p.v - 0.05 * e, turn: p.turn + 0.3 * e, scale: 1 - 0.85 * smooth((k - 0.3) / 0.7), curl: smooth(k / 0.7), dark: smooth(k / 0.6) };
    default: {          // fell
      const peel = smooth(k / 0.35), drop = Math.max(0, k - 0.3) / 0.7;
      return { u: p.u + 0.15 * drop, v: p.v - 2.8 * drop * drop, turn: p.turn + 0.5 * peel + 1.2 * drop, scale: 1, curl: 0.6 * peel, dark: 0 };
    }
  }
}
