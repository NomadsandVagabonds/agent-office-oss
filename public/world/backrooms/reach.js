// The Backrooms — within arm's reach of it. Pure: no three.js, no clock of its
// own, and no chance but what it is handed.
//
// Across a room, watched, the mascot is a shop dummy, and that is still true.
// But the camcorder cannot hold a picture this close to it. Inside arm's
// reach the tape tears, and it moves in the torn frames: each tear shows it a
// little nearer, an arm a little higher. The first tear is a warning and
// never anything else, unless you are actually touching it. After that every
// tear may be the one in which it has you, and the fourth always is. So you
// can run past it and lose one frame; you can take what it is holding if you
// are quick about it; and you cannot stand beside it, watching or not.
//
// pursuer.js keeps one of these per figure and does what it says.

export const REACH = Object.freeze({
  arm: 1.3,                                // metres between the middle of it and the middle of you: nearer than this, the tape tears
  touch: 0.62,                             // …and this near, you are up against it (it has a body: nobody gets nearer)
  first: 0.22,                             // seconds inside reach before the first tear
  every: Object.freeze([0.6, 0.95]),       // seconds between tears after that, at arm's length (which, is the dice)
  hurry: 1.6,                              // how much faster they come when you are touching it
  forget: 3,                               // seconds out of reach before it is as if you had never come near
  last: 4,                                 // the tear nobody walks away from
});

/** Nobody has been near it. */
export const calm = () => ({ tears: 0, next: REACH.first, away: 0 });

/** How near is near: 0 at arm's length, 1 touching. */
export const closeness = (d) => Math.max(0, Math.min(1, (REACH.arm - d) / (REACH.arm - REACH.touch)));

/** The chance that tear number `n` (1, 2, …) is the one in which it has you, `close` (0…1) to it. */
export function grabChance(n, close) {
  if (n <= 1) return close >= 1 ? 0.35 : 0;
  if (n === 2) return 0.15 + 0.55 * close;
  if (n < REACH.last) return 0.55 + 0.45 * close;
  return 1;
}

/**
 * One moment beside it.
 * @param s    what calm() or the last call gave
 * @param dt   seconds since
 * @param d    how far from it you are, metres — Infinity if it cannot be seen at all
 * @param rnd  () → 0…1: the dice (Math.random while somebody is playing; anything you like in a test)
 * @returns {{tears, next, away, tear:boolean, grab:boolean, noise:number}}  the new state · tear: the tape tore this moment ·
 *          grab: …and it has you · noise: 0…1, how much static its being this near puts on the picture between tears
 */
export function beside(s, dt, d, rnd = Math.random) {
  if (!(d < REACH.arm)) {
    const away = s.away + dt, gone = away >= REACH.forget;
    return { tears: gone ? 0 : s.tears, next: gone ? REACH.first : s.next, away, tear: false, grab: false, noise: 0 };
  }
  const close = closeness(d);
  let { tears, next } = s, tear = false, grab = false;
  next -= dt * (1 + (REACH.hurry - 1) * close);
  if (next <= 0) {
    tears += 1; tear = true;
    grab = rnd() < grabChance(tears, close);
    next = REACH.every[0] + (REACH.every[1] - REACH.every[0]) * rnd();
  }
  return { tears, next, away: 0, tear, grab, noise: Math.min(1, 0.3 + 0.18 * tears + 0.2 * close) };
}
