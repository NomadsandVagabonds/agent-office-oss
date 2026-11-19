// The Backrooms — what has been left lying about that can be carried. Pure: a
// part of the building in, a list out (inventory.js puts each on the floor).
//
// Nobody is handed anything on the way in. Whatever a visitor has in their
// pockets, they found: and where things are is decided by the seed, like the
// rooms, so the same building always has the same things in the same rooms.
//
//   battery packs   the one thing there is always more of: the camcorder runs
//                   on them, and spare ones are what the office pays for
//   snacks          at most one to a part of the building
//   a torch         likely where you land, less so further down, never full
//   chalk           in about a quarter of the parts
//   paper           at most one stack to a part: it burns (crafting.js), and
//                   there is somebody down here who will take it instead of you
//   a lighter, tape in about a quarter of the parts each: with paper, a fire; with a
//                   torch, a torch that will stay on the camcorder
//   an extinguisher in about a third of the parts, part used: it stops a thing a
//                   moment (extinguisher.rule.js)
//   anything else   only where somebody on this floor wants it (cast.js: what
//                   a creature cares about). Nothing is clutter.
import { difficultyOf } from '../../../core/difficulty.mjs';
import { makeRng } from './gen.js';
import { foundCharge } from './extinguisher.rule.js';

/** How much there is. Starting points: this is what play-testing changes. */
export const SUPPLY = Object.freeze({
  batteryFirst: 4,                  // keep the first pack among this many early eligible rooms
  batteryEvery: 28,                 // after that, one pack to this many rooms: two a part, about (it was 8, four a part: more than could ever be used)
  snacks: Object.freeze([0, 1]),    // to a part of the building: fewest, most
  snack: 0.65,                      // the chance that a part has the most and not the fewest (it was even: one snack in a whole visit)
  torch: Object.freeze([0.7, 0.2]), // keep the first torch likely; fewer redundant ones further down
  torchCharge: Object.freeze([45, 150]),   // seconds of light left in one (a full one is 180): fewest, most
  chalk: 0.25,                      // the chance of a piece of chalk in a part
  paper: Object.freeze([3, 5]),     // sheets in a stack of paper
  stacks: Object.freeze([0, 1]),    // stacks of paper to a part: the first, that was always there; the plenty below is on top of it
  paperRooms: 3.5,                  // PAPER, VERY COMMON (the owner, 18 Nov: it is what the shop is paid in): one more stack of loose paper to about this many rooms of a part, so about one room in three or four has a sheaf to take. Set it higher for less, 0 for none
  lighter: 0.25,                    // the chance of a lighter in a part (it is kept: one is enough for a visit)
  tape: 0.2,                        // the chance of a roll of tape in a part
  extinguisher: 0.3,                // the chance of a fire extinguisher in a part (extinguisher.rule.js): one every three or so, part used, never refilled
  choices: 4,                       // rooms offered for each thing, in order: the first with clear floor gets it
});
/** What is about whether or not anybody wants it: the rest only turns up for somebody. */
const ALWAYS = new Set(['battery', 'snack', 'torch', 'chalk', 'paper', 'lighter', 'tape', 'extinguisher']);
const KNOWN = new Set(['torch', 'battery', 'chalk', 'paper', 'scissors', 'snack', 'balloon', 'lighter', 'tape', 'extinguisher']);

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
  const d = level.difficulty ? difficultyOf(level.difficulty) : null;
  // Keep an early refill opportunity, then space out surplus packs. The rooms
  // are in build order (roughly encounter order); each group offers fallback
  // locations, so one blocked floor patch does not discard its pack.
  for (let i = 0, n = 0; i < rooms.length;) {
    const span = n === 0 ? SUPPLY.batteryFirst : (d?.batteryEvery ?? SUPPLY.batteryEvery);
    out.push({ id: `battery-${n++}`, type: 'battery', rooms: R.shuffle(rooms.slice(i, i + span)).map((r) => r.id) });
    i += span;
  }
  // everything else: a few rooms each, no two things offered the same first room while there are rooms to go round
  const order = R.shuffle(rooms);
  let at = 0;
  const some = () => { const pick = []; for (let k = 0; k < Math.min(SUPPLY.choices, order.length); k++) pick.push(order[(at + k) % order.length].id); at++; return pick; };
  const leave = (type, n, extra = {}) => out.push({ id: `${type}-${n}`, type, rooms: some(), ...extra });
  // Draw Easy's snack even when it will be removed, preserving all later rolls.
  const snackChance = d?.snack === 0 ? difficultyOf('easy').snack : d?.snack ?? SUPPLY.snack;
  const originalSupply = d && ['tourist', 'training-wheels'].includes(d.id);
  const snacks = originalSupply ? R.int(...SUPPLY.snacks) : R.chance(snackChance) ? SUPPLY.snacks[1] : SUPPLY.snacks[0];
  for (let n = 0; n < snacks; n++) leave('snack', n);
  if (R.chance(SUPPLY.torch[(level.depth ?? 0) > 0 ? 1 : 0])) leave('torch', 0, { charge: R.int(SUPPLY.torchCharge[0], SUPPLY.torchCharge[1]) });
  if (R.chance(SUPPLY.chalk)) leave('chalk', 0);
  // (what was added later draws from a source of its own, so that what was already lying about in a building stays where it was)
  const RC = R.fork('crafting');
  for (let n = 0, most = RC.int(SUPPLY.stacks[0], SUPPLY.stacks[1]); n < most; n++) leave('paper', n, { quantity: RC.int(SUPPLY.paper[0], SUPPLY.paper[1]) });
  if (RC.chance(SUPPLY.lighter)) leave('lighter', 0);
  if (RC.chance(SUPPLY.tape)) leave('tape', 0);
  for (const type of [...new Set(wanted)].filter((t) => KNOWN.has(t) && !ALWAYS.has(t)).sort()) leave(type, 0);
  // (the extinguisher came later still: a stream of its own and rooms of its own, so that nothing else moves for it)
  const RX = R.fork('extinguisher');
  if (RX.chance(SUPPLY.extinguisher)) out.push({ id: 'extinguisher-0', type: 'extinguisher', rooms: RX.shuffle(rooms).slice(0, SUPPLY.choices).map((r) => r.id), charge: foundCharge(RX()) });
  if (d && d.batteryShare < 1) {
    // An independent draw preserves other loot positions. Keep the first pack;
    // thin the rest to ~70% overall, not 70% of only the surplus.
    const packs = out.filter(p => p.type === 'battery'), RR = makeRng(`${level.seed}/difficulty-packs`);
    const keep = Math.max(0, (packs.length * d.batteryShare - 1) / Math.max(1, packs.length - 1));
    return out.filter(p => (d.snack !== 0 || p.type !== 'snack') && (p.type !== 'battery' || p.id === 'battery-0' || RR.chance(keep)));
  }
  return out;
}

/**
 * Paper in plenty: the stacks that can be taken, on top of whatever planSupplies leaves (it is a list of its own, drawn from a
 * stream of its own, so that nothing else's place or number changes). One stack to about SUPPLY.paperRooms rooms, no two in
 * the same room, never in a crawl space or where you land or the way down (supplyRooms). Decorative litter is not this.
 * @returns {{id:string, type:'paper', quantity:number, rooms:number[], plenty:true}[]}
 */
export function plentyOfPaper(level) {
  const every = SUPPLY.paperRooms;
  if (!(every > 0)) return [];
  const rooms = supplyRooms(level).filter((r) => !r.crawl);
  if (!rooms.length) return [];
  const R = makeRng(`${level.seed}/paper-plenty/${level.depth ?? 0}`), want = rooms.length / every;
  const count = Math.min(rooms.length, Math.floor(want) + (R.chance(want - Math.floor(want)) ? 1 : 0)), order = R.shuffle(rooms), out = [];
  for (let n = 0; n < count; n++) out.push({ id: `paper-plenty-${n}`, type: 'paper', quantity: R.int(SUPPLY.paper[0], SUPPLY.paper[1]), rooms: [0, 1, 2, 3].map((k) => order[(n + k * 7) % order.length].id).filter((id, i, a) => a.indexOf(id) === i), plenty: true });
  return out;
}
