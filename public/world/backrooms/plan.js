// The Backrooms — the visit. Pure, like the generator it drives (gen.js): a
// seed and a few names in, a plain description out. Where gen.js builds one
// floor, this decides what a whole visit is: how many floors there are under
// the one you land on (three to five in all, and nothing down there ever says
// which), what kind of place each of them is (themes.js), which of them the
// mascot stands on, and how the office's coins are shared out among them.
//
// The way out is only on the last floor, and it is not a door: it is a wall
// that gives when it is leaned on, the way the one upstairs did (marks.js).
// Every floor above it ends at the same fire exit — a stairwell that stops
// short of the next floor's ceiling — so the only way on is down, the floor
// you leave is let go of behind you, and a visit is never a short walk: every
// floor's fire exit is its furthest room, at least MIN_EXIT_STEPS doorways
// from where you land on it, and the wall is never fewer than MIN_OUT_STEPS.
//
// A floor is generated when it is asked for (floorOf), not before: each is a
// fresh run of the generator from a seed of its own, told which rooms the
// floors above it had so that it deals different ones while the deck lasts —
// and what those rooms taught, so that it deals nothing that takes for granted
// a thing nobody has yet had the chance to learn.
import { generate, makeRng, MIN_EXIT_STEPS, DECK, ARCHETYPES, lessons, lessonsOf, isBig } from './gen.js';
import { MIN_OUT_STEPS } from './marks.js';
import { THEME_IDS } from './themes.js';
import { WAYS } from './seam.js';
import { whoIsDown } from './cast.js';

export const MIN_FLOORS = 3, MAX_FLOORS = 5;
/** What everybody knows before they have seen a single room down here: it is how they got in. */
export const KNOWN_AT_START = Object.freeze(['lean']);
/** How many visits in a hundred have a room in them that the place half-remembers from the news (if the deck has any). */
export const HEADLINE_CHANCE = 0.35;
/** The fewest doorways anybody walks through between landing and the way out, whatever the visit. */
export const MIN_VISIT_STEPS = (MIN_FLOORS - 1) * MIN_EXIT_STEPS + MIN_OUT_STEPS;

/** The room the plan deals by hand, below wherever its lesson was taught (deck2.js). */
export const HALL = 'unsure-hall';
/** How many visits in a hundred have the hallway in them (and, so that they can, the room that teaches what it needs). */
export const HALL_CHANCE = 0.7;
/**
 * A visit's hand: the share of the deck it shows, least and most. Which rooms, and in what order, is the seed's
 * business; no room is ever in a visit twice. (The owner: "if we only use 40-70% of rooms each time in a scrambled
 * order it keeps players on their toes." The number follows the deck: it grows as rooms are contributed.)
 */
export const HAND = Object.freeze([0.4, 0.7]);
/** How many rooms a part has, however few of them are oddities: long enough to get lost in. */
export const PART_ROOMS = Object.freeze([20, 28]);

/**
 * Deal a visit's hand across its parts. → one list of deck ids per part. Nothing before what it needs (a room that
 * takes a lesson for granted goes in a part below the one that teaches it), nothing on a kind of floor it is never at
 * home on, one set piece to a part; the room from the news where the plan has put it; the hallway, in some visits,
 * below the cardboard people.
 */
function dealHand(R, themes, story) {
  const depths = themes.length, N = DECK.length;
  const size = Math.max(depths, R.int(Math.ceil(N * HAND[0]), Math.floor(N * HAND[1])));
  const hands = themes.map(() => []), at = new Map();
  // how many each part gets: as near equal as it goes, the odd ones wherever the seed says
  const cap = themes.map(() => Math.floor(size / depths));
  for (const i of R.shuffle(themes.map((_, k) => k)).slice(0, size - cap[0] * depths)) cap[i]++;
  const total = () => hands.reduce((n, h) => n + h.length, 0);
  const taught = (n, i) => KNOWN_AT_START.includes(n) || [...at].some(([id, p]) => p < i && lessons(ARCHETYPES[id]).teaches.includes(n));
  const fits = (a, i, strict = true) => (!strict || hands[i].length < cap[i]) && ((a.themes && a.themes[themes[i]]) ?? 1) > 0
    && !(isBig(a) && hands[i].some((id) => isBig(ARCHETYPES[id]))) && lessons(a).needs.every((n) => taught(n, i));
  const put = (a, i) => { hands[i].push(a.id); at.set(a.id, i); };
  if (story && ARCHETYPES[story.arch]) put(ARCHETYPES[story.arch], story.floor);
  // the hallway, and the room that has to come before it
  const hall = ARCHETYPES[HALL], RH = R.fork('hall');
  if (hall && depths > 1 && RH.chance(HALL_CHANCE)) {
    const teachers = DECK.filter((a) => !a.planned && !a.headline && lessons(hall).needs.some((n) => lessons(a).teaches.includes(n)));
    const teacher = teachers.length ? RH.pick(teachers) : null, early = teacher ? themes.map((_, i) => i).filter((i) => i < depths - 1 && fits(teacher, i, false)) : [];
    if (early.length) {
      put(teacher, RH.pick(early));
      const late = themes.map((_, i) => i).filter((i) => fits(hall, i, false) && !(story && story.floor === i));
      if (late.length) put(hall, RH.pick(late));
    }
  }
  // the rest of the hand, in the order the seed draws them — a room that cannot go anywhere yet waits for the next round
  let pool = DECK.filter((a) => !a.planned && !a.headline && !at.has(a.id));
  const order = [];
  while (pool.length) { const a = R.weighted(pool, (k) => k.weight); order.push(a); pool = pool.filter((k) => k !== a); }
  for (let round = 0; round < 2; round++) for (const a of order) {
    if (total() >= size) break;
    if (at.has(a.id)) continue;
    const parts = themes.map((_, i) => i).filter((i) => fits(a, i));
    if (parts.length) put(a, R.weighted(parts, (i) => ((a.themes && a.themes[themes[i]]) ?? 1) * (cap[i] - hands[i].length)));
  }
  return hands.map((h) => R.shuffle(h));
}

const made = new WeakMap();                 // visit → the floors generated so far

/** What generate() was asked to hide, tidied — or null for nothing. (As gen.js reads it.) */
function wanted(loot) {
  if (!loot || typeof loot !== 'object') return null;
  const coins = [...new Set((Array.isArray(loot.coins) ? loot.coins : []).map((n) => Math.floor(Number(n))).filter((n) => n >= 1))].sort((a, b) => a - b);
  return loot.card || coins.length ? { card: !!loot.card, coins } : null;
}

/**
 * The shape of one visit.
 * @param {string|number} seed
 * @param {object} [opt]  everything generate() takes (names, loot, pursuer, count…), and:
 *        depths  how many floors (default: three to five, by the seed) · only / onlyDepth  deal these archetypes into that floor (default the first)
 * @returns {{seed, depths, floors: [{depth, seed, theme, prev, next, way, must, mascot, coins}], mascot}}  plain data; floors are generated by floorOf()
 */
export function planVisit(seed, opt = {}) {
  const R = makeRng(`visit:${seed}`), want = wanted(opt.loot);
  const rolled = R.weighted([[3, 5], [4, 4], [5, 2]], (k) => k[1])[0];
  const depths = Math.max(1, Math.min(8, Math.floor(Number(opt.depths)) || rolled));
  // you always land in the yellow; what is under it is a different selection, in a different order, every visit
  const below = R.shuffle(THEME_IDS.filter((id) => id !== 'yellow'));
  const themes = Array.from({ length: depths }, (_, i) => (i === 0 ? 'yellow' : below[(i - 1) % below.length]));
  // how each part but the last ends, behind its fire door: a different way down each time, while there are ways left
  // (rolled from a source of its own, so that which they are changes nothing else about a visit)
  const RW = R.fork('ways'), order = RW.shuffle(WAYS.slice());
  const ways = themes.map((_, i) => (i === depths - 1 ? 'wall' : order[i % order.length]));
  // the mascot: in some visits, on one floor — less often the one you land on. While the office's keycard is still to be
  // found there always is one, because it is holding it.
  const chance = R.chance(0.62) || whoIsDown(seed).includes('pirate'), at = R.weighted(themes.map((_, i) => i), (i) => (i === 0 && depths > 1 ? 1 : 2));
  const mascot = (want && want.card) || opt.pursuer === true || (opt.pursuer === undefined && chance) ? at : null;
  // the coins still to be found, smallest first, take the visit's hiding places in order — and those go round the floors, a
  // different way round every visit, so that they are spread through the building and the first few are never on one floor
  const round = R.shuffle(themes.map((_, i) => i)), coins = themes.map(() => []);
  (want ? want.coins : []).forEach((n, k) => coins[round[k % depths]].push(n));
  // Something the place has half-remembered from the news and staged wrongly (a deck entry flagged `headline`): in some
  // visits, one of them — and never on the floor you land on, which is for finding out where you are. (Rolled from a
  // source of its own: whether the deck has any such room changes nothing else about a visit.)
  const stories = DECK.filter((a) => a.headline), RS = R.fork('headline');
  const story = stories.length && depths > 1 && RS.chance(HEADLINE_CHANCE) ? { arch: RS.pick(stories).id, floor: RS.int(1, depths - 1) } : null;
  // which rooms this visit has, and which part each is in (a source of its own: the hand moves nothing else)
  const hands = dealHand(R.fork('hand'), themes, story), RP = R.fork('rooms');
  const floors = themes.map((theme, i) => ({
    depth: i, seed: i === 0 ? String(seed) : `${seed}/floor:${i}`, theme,
    // (what the part above was like and what the part below will be: near a seam the one turns up in the other)
    prev: i ? themes[i - 1] : null, next: i < depths - 1 ? themes[i + 1] : null,
    way: ways[i], hand: hands[i], rooms: RP.int(PART_ROOMS[0], PART_ROOMS[1]),
    must: hands[i].filter((id) => ARCHETYPES[id].planned || ARCHETYPES[id].headline), mascot: mascot === i, coins: coins[i],
  }));
  const visit = { seed: String(seed), depths, floors, mascot, card: !!(want && want.card), headline: story ? story.arch : null, hand: hands.flat() };
  made.set(visit, { opt, levels: [] });
  return visit;
}

/**
 * One floor of a planned visit: the level generate() makes for it, with where it is in the visit written on it
 * (depth, depths). Floors above it are generated first if they have not been — what they were dealt
 * decides what this one may be — so asking for floor 3 of a seed always gives the same floor 3.
 */
export function floorOf(visit, i) {
  const memo = made.get(visit);
  if (!memo) throw new Error('backrooms: floorOf() wants a visit from planVisit()');
  if (i < 0 || i >= visit.depths) throw new Error(`backrooms: there is no floor ${i} in this visit`);
  for (let k = memo.levels.length; k <= i; k++) {
    const f = visit.floors[k], opt = memo.opt, first = memo.levels[0];
    const known = [...KNOWN_AT_START, ...memo.levels.flatMap((l) => lessonsOf(l))];
    const loot = f.coins.length || (visit.card && f.mascot) ? { card: visit.card && f.mascot, coins: f.coins, tapes: visit.seed } : undefined;
    const level = generate(f.seed, {
      name: opt.name, projects: opt.projects, agents: opt.agents, tasks: opt.tasks, count: opt.count,
      only: (opt.onlyDepth || 0) === k ? opt.only : undefined,
      theme: f.theme, way: f.way, paper: `${visit.seed}/${k}`, must: f.must,
      // the rooms of the visit's hand that are in this part, and how long the part is, whatever it holds
      hand: f.hand, rooms: f.rooms,
      bleed: { prev: f.prev && { theme: f.prev, paper: `${visit.seed}/${k - 1}` }, next: f.next && { theme: f.next, paper: `${visit.seed}/${k + 1}` } },
      // what the floors above have had the chance to teach: a room that takes more than that for granted is not dealt here
      known,
      pursuer: f.mascot, mascot: f.mascot, loot,
    });
    level.depth = k; level.depths = visit.depths;
    // the tape is older the further down it was shot: every floor's date is some years before the one above
    if (first) level.stamp = { ...level.stamp, year: memo.levels[k - 1].stamp.year - 2 - (level.stamp.year % 4) };
    memo.levels.push(level);
  }
  return memo.levels[i];
}

/** Every floor of a visit, top to bottom (for the tests, and for anybody who wants to read a whole building). */
export function generateVisit(seed, opt = {}) {
  const visit = planVisit(seed, opt);
  return { visit, floors: visit.floors.map((_, i) => floorOf(visit, i)) };
}
