// The Backrooms — the shadow's rule (cast/shadow.js is the creature). Pure: no
// three.js, no DOM. It stands where you can see it out of the corner of your
// eye; hold it in the middle of the picture for the length of its fuse and it
// goes off, and is gone a good while.

export const SHADOW = Object.freeze({
  cone: 0.24,          // radians from the middle of the picture: nearer than this is looking straight at it
  far: 16,             // metres: further off than this, looking does nothing
  fuse: 1.3,           // seconds of looking before it goes off
  cool: 0.7,           // seconds of fuse it gets back for every second you look away
  touch: 0.8,          // walk into it and it goes off at once
  drain: 0.5,          // the share of the battery's charge that goes with it
  dark: 16,            // seconds the room stays dark afterwards
  gone: [40, 75],      // seconds before it is standing somewhere again
  stay: [9, 18],       // seconds it stands in one place before it tries another (it only ever moves while it is off the picture)
  near: [3, 10],       // how far from you it likes to stand, metres
});

/** Not here yet: where it starts, and where it is after it has gone off. */
export function away(rnd = Math.random, first = false) { return { mode: 'away', stare: 0, t: first ? 6 + 10 * rnd() : SHADOW.gone[0] + (SHADOW.gone[1] - SHADOW.gone[0]) * rnd(), heat: 0, burst: false, shift: false }; }

/**
 * One moment of it.
 * @param s      what away() or the last call gave
 * @param sense  { placed: it is standing somewhere · looked: it is in the middle of the picture, in plain sight · d: how far off, metres }
 * @returns the new state: { mode: 'away' | 'lurk', stare, t, heat: 0…1 how near going off it is, burst: it went off this moment,
 *          shift: it would like to be standing somewhere else (or, away, to be standing somewhere at all) }
 */
export function watched(s, dt, sense, rnd = Math.random) {
  const n = { ...s, burst: false, shift: false };
  if (s.mode === 'away') {
    n.t = s.t - dt;
    if (n.t > 0) return n;
    if (!sense.placed) { n.shift = true; return n; }
    return { ...n, mode: 'lurk', stare: 0, heat: 0, t: SHADOW.stay[0] + (SHADOW.stay[1] - SHADOW.stay[0]) * rnd() };
  }
  const looking = !!sense.looked && sense.d <= SHADOW.far;
  n.stare = sense.d < SHADOW.touch ? SHADOW.fuse : looking ? s.stare + dt : Math.max(0, s.stare - SHADOW.cool * dt);
  n.heat = Math.min(1, n.stare / SHADOW.fuse);
  if (n.stare >= SHADOW.fuse) return { ...away(rnd), burst: true };
  n.t = s.t - dt;
  if (n.t <= 0 && n.stare === 0) { n.shift = true; n.t = 1.5; }
  return n;
}

/** What is left in a battery after it has gone off. */
export const drained = (charge) => charge * (1 - SHADOW.drain);
