// The Backrooms — the lift lobby's button (rooms3.js lift): what a press of it comes out as. Pure: no three.js, no DOM.
//
// A press is a seeded draw, one per press, from the room's own fork of the seed (so the room's own stream is untouched, and the
// same presses in the same building give the same cars: a kept tape walks again). Mostly it is what the lobby always had behind
// its doors (bricks, a cutout, a poster: p.behind); 45 in 100 it is a real car, and a car is empty, or has something on its
// floor, or has somebody in it, a third each. What the lobby has already given is not given again (`left`), and whatever
// cannot be given (no creature may come here, or none came) is an empty car: never a broken one, never a free second helping.

/** How deep the car is behind its doors, from the wall (the lobby's front stands this far out: rooms3.js lift). Loot, coins and supplies keep out of it (gen.js coinFits). */
export const LIFT_CAR = 1.5;
export const LIFT_ODDS = Object.freeze({ car: 0.45, empty: 1 / 3, item: 1 / 3, creature: 1 / 3, snack: 0.5 });
/** What a car may hold on its floor: something worth the wait (the owner: a high value item, a snack or the scissors). No battery: batteries are the score's currency, and the lift is not a way to farm them. */
export const LIFT_ITEMS = Object.freeze(['snack', 'scissors']);

/**
 * Who may be put in the car on this difficulty, and how often (a share of the creature third): nobody on Tourist; no toner where
 * the difficulty has none; fewer on the gentle ones.
 */
export function liftCompany(difficulty) {
  if (difficulty === 'tourist') return { who: [], scale: 0 };
  if (difficulty === 'training-wheels') return { who: ['shadow'], scale: 0.5 };
  if (difficulty === 'easy') return { who: ['toner', 'shadow'], scale: 0.5 };
  return { who: ['toner', 'shadow'], scale: 1 };
}

/**
 * @param R      the room's rng (has .fork)
 * @param p      the room's params (behind: what a plain press opens on)
 * @param visit  how many presses there have been
 * @param o      item: may a car have something on its floor (not already given, not a shared visit) ·
 *               who: the creatures that may come · scale: their share · odds
 * @returns { kind: 'bricks'|'cutout'|'poster' } | { kind: 'car', inside: 'empty' | 'item' | 'creature', item?, who? }
 */
export function liftPress(R, p, visit, { item = true, who = [], scale = 1, odds = LIFT_ODDS } = {}) {
  const r = R.fork('press:' + visit);
  const plain = p.behind[visit % p.behind.length];
  if (r.range(0, 1) >= odds.car) return { kind: plain };
  const q = r.range(0, 1), u = r.range(0, 1), pick = r.range(0, 1);
  const itemTo = odds.empty + odds.item, creatureTo = itemTo + odds.creature * scale;
  if (q < odds.empty) return { kind: 'car', inside: 'empty' };
  if (q < itemTo) return item ? { kind: 'car', inside: 'item', item: u < odds.snack ? 'snack' : 'scissors' } : { kind: 'car', inside: 'empty' };
  if (q < creatureTo && who.length) return { kind: 'car', inside: 'creature', who: who[Math.floor(pick * who.length) % who.length] };
  return { kind: 'car', inside: 'empty' };
}
