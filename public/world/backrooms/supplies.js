// The Backrooms — what has been left lying about that can be carried. Pure: a
// part of the building in, a list out (inventory.js puts each on the floor).
//
// Nobody is handed anything on the way in. Whatever a visitor has in their
// pockets, they found: and where things are is decided by the seed, like the
// rooms, so the same building always has the same things in the same rooms.
//
//   battery packs   the one thing there is always more of: the camcorder runs
//                   on them, and spare ones are what the office pays for
//   snacks          one or two to a part of the building
//   a torch         likely where you land, less so further down, never full
//   chalk           in about half the parts
//   anything else   only where somebody on this floor wants it (cast.js: what
//                   a creature cares about). Nothing is clutter.
import { makeRng } from './gen.js';

/** How much there is. Starting points: this is what play-testing changes. */
export const SUPPLY = Object.freeze({
  batteryEvery: 4,                  // one pack to this many rooms
  snacks: Object.freeze([1, 2]),    // to a part of the building: fewest, most
  torch: Object.freeze([0.7, 0.4]), // the chance of a torch: in the part you land in · in any part below it
  torchCharge: Object.freeze([45, 150]),   // seconds of light left in one (a full one is 180): fewest, most
  chalk: 0.5,                       // the chance of a piece of chalk in a part
  paper: Object.freeze([3, 6]),     // sheets in a stack of paper, where somebody wants paper
  choices: 4,                       // rooms offered for each thing, in order: the first with clear floor gets it
});
/** What is about whether or not anybody wants it: the rest only turns up for somebody. */
const ALWAYS = new Set(['battery', 'snack', 'torch', 'chalk']);
const KNOWN = new Set(['torch', 'battery', 'chalk', 'paper', 'scissors', 'snack', 'balloon']);

/**
 * What the residents of a part's rooms care about: the `items` of the deck line of every room on it.
 * (A thing only somebody hands out — a pink slip — is nobody's to find lying about, and is not in KNOWN.)
 */
export function wantedByRooms(level, archetypes) {
  return [...new Set(level.rooms.flatMap((r) => (r.arch && archetypes[r.arch] && archetypes[r.arch].items) || []))];
}

/**
 * The rooms something may be left in: anywhere but where you land, the way down, and a room an earlier visitor has
 * left something in (nothing else is ever put in one of those: gen.js).
 */
export function supplyRooms(level) {
  return level.rooms.filter((r) => (r.kind === 'plain' || r.kind === 'special') && r.id !== level.start.room && r.id !== level.exit.room
    && !(r.dress || []).some((d) => d.type === 'trace'));
}

/**
 * What is lying about in one part of the building.
 * @param level   what generate() gave (gen.js)
 * @param {string[]} [wanted]  item types somebody on this floor cares about (the `items` of the cast dealt to it)
 * @returns {{id:string, type:string, rooms:number[], charge?:number, quantity?:number}[]}
 *          rooms: where it goes, in order of preference (a room with no clear floor passes it to the next)
 */
export function planSupplies(level, wanted = []) {
  const R = makeRng(`${level.seed}/supplies/${level.depth ?? 0}`), rooms = supplyRooms(level), out = [];
  if (!rooms.length) return out;
  // batteries: the rooms in the order they were made (which is roughly the order they are come to), in groups, one to a group
  for (let i = 0, n = 0; i < rooms.length; i += SUPPLY.batteryEvery) {
    out.push({ id: `battery-${n++}`, type: 'battery', rooms: R.shuffle(rooms.slice(i, i + SUPPLY.batteryEvery)).map((r) => r.id) });
  }
  // everything else: a few rooms each, no two things offered the same first room while there are rooms to go round
  const order = R.shuffle(rooms);
  let at = 0;
  const some = () => { const pick = []; for (let k = 0; k < Math.min(SUPPLY.choices, order.length); k++) pick.push(order[(at + k) % order.length].id); at++; return pick; };
  const leave = (type, n, extra = {}) => out.push({ id: `${type}-${n}`, type, rooms: some(), ...extra });
  for (let n = 0, most = R.int(SUPPLY.snacks[0], SUPPLY.snacks[1]); n < most; n++) leave('snack', n);
  if (R.chance(SUPPLY.torch[(level.depth ?? 0) > 0 ? 1 : 0])) leave('torch', 0, { charge: R.int(SUPPLY.torchCharge[0], SUPPLY.torchCharge[1]) });
  if (R.chance(SUPPLY.chalk)) leave('chalk', 0);
  for (const type of [...new Set(wanted)].filter((t) => KNOWN.has(t) && !ALWAYS.has(t)).sort()) {
    leave(type, 0, type === 'paper' ? { quantity: R.int(SUPPLY.paper[0], SUPPLY.paper[1]) } : {});
  }
  return out;
}
