// The Backrooms — the lift lobby's button (rooms3.js lift): what a press of it comes out as. Pure: no three.js, no DOM.

/**
 * How a press of the button comes out. A seeded draw, one per press, that does not touch the room's own random stream: mostly what
 * the lobby always had behind its doors (bricks, a cutout, a poster: p.behind), and now and then a real car. A car is empty, or
 * has something on its floor, or (with a summon from the cast, if there is one: env.pursuer.summon) something in it.
 *  */
export const LIFT_ODDS = Object.freeze({ car: 0.45, empty: 0.3, item: 0.4, creature: 0.3, snack: 0.6, battery: 0.25 });
export function liftPress(R, p, visit, { creatures = false, tourist = false, odds = LIFT_ODDS } = {}) {
  const r = R.fork('press:' + visit);
  const plain = p.behind[visit % p.behind.length];
  if (r.range(0, 1) >= odds.car) return { kind: plain };
  const q = r.range(0, 1);
  if (q < odds.empty) return { kind: 'car', inside: 'empty' };
  if (q < odds.empty + odds.item || tourist || !creatures) { const u = r.range(0, 1); return { kind: 'car', inside: 'item', item: u < odds.snack ? 'snack' : u < odds.snack + odds.battery ? 'battery' : 'paper' }; }
  return { kind: 'car', inside: 'creature', who: r.pick(['toner', 'shadow']) };
}

