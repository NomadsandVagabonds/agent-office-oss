// The Office — the long game. Pure rules, shared by the daemon (which keeps
// the office's record) and the browser.
//
// Some of the lift's floors are games. Their buttons are dark until a keycard
// lights them — except one, drawn by lot the first time an office looks,
// which is lit from the start. Every such floor hides one keycard and a few
// coins, and so does one place the lift does not go.
//
//   keycards   The number of game floors that are open is always one more
//              than the number of keycards found. So a card always opens
//              something while anything is dark; a card found after that is
//              simply kept, and lights the next floor anybody adds.
//   coins      Do not come back once picked up. They go in the office's jar,
//              with one more for every stamp in the passport — so every
//              secret in the building is worth finding — and the vending
//              machine in the kitchen takes them.
//   pay        One place pays for what is carried out of it: a coin for
//              each spare battery somebody still had when they got out —
//              but only for more of them than the office has been paid for
//              before. The jar gains when somebody beats the office's best,
//              and by no more than they beat it by: going back is worth it,
//              and going back for the same again is worth nothing.
//
// Adding a floor to the game is two words on its line in core/levels.mjs
// (`card: true, coins: 3`) and, in its module, somewhere to hide them.
import { LEVELS } from './levels.mjs';

/** What one stamp in the passport pays into the jar. */
export const STAMP_COINS = 1;

/** Everywhere that hides a keycard and coins: the card floors of the lift, and the place behind the wall. */
export const HIDEOUTS = Object.freeze([
  ...LEVELS.filter((l) => l.card).map((l) => Object.freeze({ id: l.id, name: l.name, coins: l.coins || 0, lift: true })),
  // (what the place under the office is called where anybody can read it: its card says so, and so does the office's feed)
  // It hides no coins of its own any more (it had four, as video cassettes): what it pays in is what is carried out of
  // it — spare battery packs (`pays`, below). An office that had found some of the four keeps them: nothing is taken back.
  Object.freeze({ id: 'backrooms', name: 'Out of Office', coins: 0, lift: false, pays: true }),
]);
const BY_ID = new Map(HIDEOUTS.map((h) => [h.id, h]));
export const hideoutById = (id) => BY_ID.get(id) || null;

/** The floors a keycard can open, in the order they stand on the panel. */
export const cardFloors = () => HIDEOUTS.filter((h) => h.lift).map((h) => h.id);

/** Every coin there is to find in the floors. */
export const COINS_HIDDEN = HIDEOUTS.reduce((n, h) => n + h.coins, 0);

function shuffled(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * The order in which this office's game floors open: the first is open from the start, each keycard opens the next.
 * Given the order an office already has, floors that no longer exist are dropped and new ones join at the end (in
 * an order of their own), so nothing that was open ever goes dark.
 */
export function dealOrder(known = [], rand = Math.random) {
  const floors = cardFloors();
  const kept = (Array.isArray(known) ? known : []).filter((id, i, all) => floors.includes(id) && all.indexOf(id) === i);
  return [...kept, ...shuffled(floors.filter((id) => !kept.includes(id)), rand)];
}

/** The game floors that are open: one to begin with, and one more for every keycard found. */
export function openFloors(order, cards) {
  return order.slice(0, Math.min(order.length, 1 + Math.max(0, Math.floor(cards) || 0)));
}

/** What one spare battery is worth when it is carried out, and the most any one visit can be worth, in coins. */
export const BATTERY_COINS = 1, VISIT_PAYS_MOST = 40;

/** What was carried out of a visit is worth: { batteries } → whole coins. (What the office pays is what that beats its best by.) */
export function payFor({ batteries = 0 } = {}) {
  const n = Math.floor(Number(batteries));
  return Number.isFinite(n) && n > 0 ? Math.min(VISIT_PAYS_MOST, n * BATTERY_COINS) : 0;
}

/** What is in the jar: coins picked up, what visits have paid, a coin a stamp, less what has been spent. Never less than nothing. */
export function jarOf({ coins = 0, stamps = 0, earned = 0, spent = 0 } = {}) {
  return Math.max(0, coins + earned + stamps * STAMP_COINS - spent);
}

/* ---- what the machine in the kitchen sells -------------------------------------------- */

// One shelf, for now. `slot` is what you key in; `where` says what happens to it once it drops:
// 'shelf' things stand on the prize shelf beside the machine, where everybody can see them.
export const PRIZES = Object.freeze([
  { id: 'cactus', slot: 'A1', price: 2, name: 'A very small cactus', blurb: 'Needs nothing. Thrives on being ignored.' },
  { id: 'wetfloor', slot: 'A2', price: 2, name: 'Wet floor sign (desk size)', blurb: 'The wording is slightly wrong.' },
  { id: 'stapler', slot: 'A3', price: 3, name: 'The golden stapler', blurb: 'Not to be set in anything.' },
  { id: 'lavalamp', slot: 'B1', price: 4, name: 'A lava lamp', blurb: 'It was already warm when it came out.' },
  { id: 'goat', slot: 'B2', price: 5, name: 'A desk goat', blurb: 'Counted. Probably.' },
  { id: 'bug', slot: 'B3', price: 5, name: 'A bug in amber', blurb: 'Reproducible at last.' },
  { id: 'mascot', slot: 'C1', price: 7, name: 'Capt. Legacy, small', blurb: 'Its head is not quite where you left it.' },
  { id: 'lift', slot: 'C2', price: 8, name: 'A lift of your own', blurb: 'One button. It is lit.' },
].map((p) => Object.freeze(p)));
const PRIZE_BY = new Map(PRIZES.flatMap((p) => [[p.id, p], [p.slot.toLowerCase(), p]]));
/** A prize by its id or by the code on its shelf ("goat", "B2"). */
export const findPrize = (ref) => PRIZE_BY.get(String(ref ?? '').trim().toLowerCase()) || null;
