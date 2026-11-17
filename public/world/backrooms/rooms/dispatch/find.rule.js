// The Backrooms — what Dispatch pays for being found. Pure: no three.js, nothing of the page.
//
// The crate in the far wall is not on the plan and is never the only way, so finding it has to be worth something: a real find
// lying by it (one rare, scissors or a torch, by the seed, once), and the crate's way out lands in a plain room beside the floor's
// way down, so it is a real short cut and not a lottery of anywhere. Nothing here moves what plan.js edition() hashes.
import { SUPPLY } from '../../supplies.js';

export const FIND_TYPES = Object.freeze(['scissors', 'torch']);

/** The rare thing left by the crate: scissors or a torch (a part-used one), from the room's own rng. → { type, charge? } */
export function dispatchFind(R) {
  const type = R.pick(FIND_TYPES);
  return type === 'torch' ? { type, charge: R.int(SUPPLY.torchCharge[0], SUPPLY.torchCharge[1]) } : { type };
}

/** The rooms a doorway joins to the floor's way down (its fire exit): the ones the stairwell's lobby is among. → room ids */
export function besideWayDown(level) {
  const down = level?.exit?.room;
  if (down === undefined || down === null) return [];
  const ids = [];
  for (const l of level.links || []) {
    const other = l.a === down ? l.b : l.b === down ? l.a : null;
    if (other !== null && !ids.includes(other)) ids.push(other);
  }
  return ids;
}

/** The candidate rooms, those beside the way down first and each side's own order kept. */
export function orderTargets(rooms, near, idOf = (r) => r.id) {
  const set = new Set(near);
  return [...rooms.filter((r) => set.has(idOf(r))), ...rooms.filter((r) => !set.has(idOf(r)))];
}
