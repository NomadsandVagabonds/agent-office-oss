// The Backrooms — what a room's resident asks of the visitor's pockets. Pure:
// no three.js, no DOM. The rooms that came with residents (after Gemini's
// third pack) ask about "the hand": is there paper in it, a balloon, a torch
// that is lit. There is one set of pockets (inventory*.js) and the hand is the
// selected one; this is the small translation between the two, so that a rule
// can be written and tested against either. A visit run without pockets still
// has a hand: it holds one thing, picked up where a room left it, so that no
// room which wants something carried is impossible there.
//
//   what a room calls it     what is in the pocket (inventory-state.js)
//   'papers'                 paper (a stack of sheets)
//   'pink-slip'              pink-slip (FORM HR-404: its own thing, and paper to anything that eats paper)
//   'balloon'                balloon
//   'flashlight'             torch — and "has a flashlight" means one that is switched on

export const KINDS = Object.freeze({ papers: 'paper', 'pink-slip': 'pink-slip', balloon: 'balloon', flashlight: 'torch' });
export const ITEM_IDS = Object.freeze(Object.keys(KINDS));
const KIND_OF = Object.freeze(Object.fromEntries(Object.entries(KINDS).map(([k, t]) => [t, k])));
/** A room's word for a thing in a pocket, or null for something no resident cares about. */
export const kindOf = (item) => (item && KIND_OF[item.type]) || null;

export const isPaper = (kind) => kind === 'papers' || kind === 'pink-slip';
export const isBalloon = (kind) => kind === 'balloon';
export const isFlashlight = (kind) => kind === 'flashlight';

/**
 * The hand, as a room's resident sees it.
 * @param inventory  () → the part's pockets (env.inventory: held, give, consumeHeld, torchPower) — or null where a visit has none
 * @param prefix     something unique to this part of the building, for the ids of what is handed over
 */
export function createHandOver(inventory, prefix = 'hand') {
  let n = 0, bare = null;               // (bare: the one thing a visitor without pockets can carry — see below)
  const held = () => inventory()?.held?.() ?? null, get = () => (inventory() ? kindOf(held()) : bare);
  return {
    /** Are there pockets at all? A visit can be run without: then the hand is a hand, and holds one thing. */
    there: () => !!inventory(),
    get, has: (kind) => get() === kind,
    hasPaper: () => isPaper(get()),
    hasBalloon: () => isBalloon(get()),
    /** A lit loose or camera-mounted torch: possession alone is not light. (With no pockets there is no switch: it is on.) */
    hasFlashlight: () => inventory() ? (inventory().torchPower?.() ?? 0) > 0 : isFlashlight(get()),
    /** Put one of something into the visitor's pockets. → null if it went in, or the kind back if there was no room for it. */
    give(kind) {
      if (!KINDS[kind]) return kind;
      if (!inventory()) { if (bare !== null) return kind; bare = kind; return null; }
      const got = inventory().give?.({ id: `${prefix}:${kind}:${n++}`, type: KINDS[kind], quantity: 1 });
      return got && got.ok ? null : kind;
    },
    /** (As give: with pockets, taking one thing no longer means putting another down.) */
    swap(kind = null) { return kind === null ? null : this.give(kind); },
    /** If what is in the hand satisfies `pred`, one of it is taken. → its kind, or null. */
    consume(pred = Boolean) {
      if (!inventory()) { const was = bare; if (!was || !pred(was)) return null; bare = null; return was; }
      const item = held(), kind = kindOf(item);
      if (!kind || !pred(kind)) return null;
      return inventory().consumeHeld(item.type, 1)?.ok ? kind : null;
    },
  };
}
