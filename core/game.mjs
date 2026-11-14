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
//   pay        One place pays for what is carried out of it, every time
//              somebody gets out: a coin for each spare battery they still
//              had. That is the only coin there is no end of, so a visit
//              pays a fixed most, and nothing at all to anybody who did not
//              leave by the way out.
//
// Adding a floor to the game is two words on its line in core/levels.mjs
// (`card: true, coins: 3`) and, in its module, somewhere to hide them.
import { LEVELS } from './levels.mjs';

/** What one stamp in the passport pays into the jar. */
export const STAMP_COINS = 1;

/** Everywhere that hides a keycard and coins: the card floors of the lift, and the place behind the wall. */
export const HIDEOUTS = Object.freeze([
  ...LEVELS.filter((l) => l.card).map((l) => Object.freeze({ id: l.id, name: l.name, coins: l.coins || 0, lift: true })),
  Object.freeze({ id: 'backrooms', name: 'the Backrooms', coins: 4, lift: false, pays: true }),
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

/** What one spare battery is worth when it is carried out, and the most one visit can pay, in coins. */
export const BATTERY_COINS = 1, VISIT_PAYS_MOST = 12;

/** What a visit pays for what was carried out of it: { batteries } → whole coins. Never more than a visit can pay. */
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
