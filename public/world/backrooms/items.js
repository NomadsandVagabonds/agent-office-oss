// The Backrooms — what you can carry in your free hand. Pure: no three.js, no
// DOM, so creature rules and tests can ask about held things directly.
//
// Only one thing fits in the hand that is not holding the camcorder:
//   'papers'      a sheaf of loose office memos
//   'pink-slip'   Form HR-404 (Notice of Redundancy), handed out by consultants;
//                 paper is paper as far as a shredder is concerned
//   'balloon'     a red latex balloon on a string
//   'flashlight'  a yellow facilities torch with a real beam

export const ITEM_IDS = Object.freeze(['papers', 'pink-slip', 'balloon', 'flashlight']);

export const isPaper = (kind) => kind === 'papers' || kind === 'pink-slip';
export const isBalloon = (kind) => kind === 'balloon';
export const isFlashlight = (kind) => kind === 'flashlight';

/** Pure single-slot hand state. */
export function createBag(initial = null) {
  let held = ITEM_IDS.includes(initial) ? initial : null;
  return {
    get: () => held,
    has: (kind) => held === kind,
    hasPaper: () => isPaper(held),
    hasBalloon: () => isBalloon(held),
    hasFlashlight: () => isFlashlight(held),
    /** Put `next` in hand (or null to empty it); returns what was there before. */
    swap(next = null) {
      const prev = held;
      held = ITEM_IDS.includes(next) ? next : null;
      return prev;
    },
    /** If the held item satisfies `pred`, consume it and return its id; else null. */
    consume(pred = Boolean) {
      if (!held || !pred(held)) return null;
      const was = held;
      held = null;
      return was;
    },
  };
}
