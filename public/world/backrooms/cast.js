// The Backrooms — who is down here this time. Pure: a seed in, a list of names
// out. One of them is in every visit (the mascot: pursuer.js); the rest, when
// there are any, are dealt from the seed, a different few each time, so that
// no two visits have the same company and nobody but him can be counted on.
// A visit is one roll: the same seed is the same company, and a seed is only
// ever given once (index.js: the seed is the clock).
import { makeRng } from './gen.js';

/**
 * Everybody there is. `always`: in every visit. `weight`: how often the others are dealt (1 is ordinary).
 * What each of them is and does lives with it (pursuer.js for the mascot); this is only the casting.
 */
export const CAST = Object.freeze([
  Object.freeze({ id: 'pirate', always: true, weight: 1 }),
]);
/** How many of the others turn up in one visit, at most. */
export const SUPPORTING = 2;

/**
 * The company for one visit.
 * @param {string|number} seed  the visit's seed
 * @param {object[]} [cast]     who there is to choose from (default: everybody)
 * @returns {string[]}  ids — everybody who is `always`, then up to SUPPORTING of the others, in the order they were dealt
 */
export function whoIsDown(seed, cast = CAST) {
  const R = makeRng(`cast:${seed}`), out = cast.filter((m) => m.always).map((m) => m.id);
  const pool = cast.filter((m) => !m.always && m.weight > 0);
  for (let n = Math.min(SUPPORTING, pool.length); n > 0 && pool.length; n--) {
    const m = R.weighted(pool, (k) => k.weight);
    out.push(m.id); pool.splice(pool.indexOf(m), 1);
  }
  return out;
}
