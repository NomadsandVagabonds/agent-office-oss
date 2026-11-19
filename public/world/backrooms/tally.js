// The Backrooms — what a visit came to. Pure: no three.js, no clock of its
// own. The conductor (index.js) keeps one of these for a whole visit and
// tells it things as they happen; when the visit ends, however it ends, this
// is what the card is filled in from (scorecard.js; the rules that score it
// are core/runs.mjs, and `cleanRun` there is the shape this must give).
//
//   run = { seed, seconds, parts: { reached, of }, rooms: { explored, kinds }, cast: { met, survived }, hearts?, trail }
//
// `trail` is where the visitor was, once a second of play (core/trail.mjs): the book builds the same building and
// checks the route against it, so that a visit that never happened cannot be signed for (tools/blockrooms/visit-check.mjs).
//
// A part of the building is counted when it is let go of, because after that
// it is gone: `part()` is given its rooms then, and the last part's at the end.

import { createTrail } from '../../../core/trail.mjs';

export function createTally({ seed, of }) {
  let seconds = 0, ways = 0, deepest = 1, explored = 0, survived = 0, encounters = 0;
  const kinds = [], met = [], counted = new WeakSet(), trail = createTrail();
  const sightings = new WeakMap();
  function meet(id, source) {
    if (typeof id !== 'string' || !id) return;
    if (source) {
      const known = sightings.get(source) || new Set();
      if (known.has(id)) return;
      known.add(id);
      sightings.set(source, known);
    }
    encounters++;
    if (!met.includes(id)) met.push(id);
  }
  return {
    /** A moment of the tape. Only time in play counts: not the fall in, not a drop between parts, not the ending. */
    tick(dt, playing) { if (playing && dt > 0) { seconds += dt; trail.tick(dt); } },
    /** Where the visitor is now: which part, and where on it (the world's own metres). Sampled by `tick`. */
    trace(depth, x, z) { trail.at(depth, x, z); },
    /** Somebody took a way down. */
    way() { ways++; },
    /** Somebody has landed in a part of the building: how far down it is (0: the one under the office). A visit begun lower down has still got that far. */
    at(depth) { const d = Math.floor(Number(depth)); if (Number.isFinite(d) && d >= 0) deepest = Math.max(deepest, d + 1); },
    /**
     * A part's rooms, as its world has them (each { visits, def: { kind, arch } }): how many were walked into, and
     * which oddities. Asked twice about the same part, it counts it once.
     */
    part(part) {
      if (!part || typeof part !== 'object' || counted.has(part)) return;
      counted.add(part);
      for (const rt of part.rooms || []) {
        if (!(rt.visits > 0)) continue;
        explored++;
        const def = rt.def || {};
        if (def.kind === 'special' && def.arch && !kinds.includes(def.arch)) kinds.push(def.arch);
      }
    },
    /** What creatures tell the visit (env.run): this one was met; this one was got away from. */
    met: meet,
    survived(id, source) {
      if (typeof id !== 'string' || !id) return;
      survived++;
      if (source || !met.includes(id)) meet(id, source);
    },
    /** The whole of it. hearts: { left, of } if there is such a thing as health this visit. */
    report(hearts) {
      const run = { seed: String(seed), seconds: Math.round(seconds), parts: { reached: Math.min(Math.max(1 + ways, deepest), of), of }, rooms: { explored, kinds: kinds.slice() }, cast: { met: met.slice(), survived, encounters } };
      if (hearts && Number.isFinite(hearts.left) && Number.isFinite(hearts.of)) run.hearts = { left: hearts.left, of: hearts.of };
      run.trail = trail.encode();
      return run;
    },
  };
}
