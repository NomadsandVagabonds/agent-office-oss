// The Backrooms — the shadow's rule (cast/shadow.js is the creature). Pure: no
// three.js, no DOM. It stands where you can see it out of the corner of your
// eye. A sustained central stare arms it; then its white fuse burns whether
// watched or not. Get it out of the picture before that fuse ends to clear it.

export const SHADOW = Object.freeze({
  cone: 0.24,          // radians from the middle of the picture: nearer than this is looking straight at it
  far: 16,             // metres: further off than this, looking does nothing
  charge: 1.1,         // seconds of sustained staring before it turns white and arms
  fuse: 0.85,          // seconds to turn away after arming; this countdown never cools
  cool: 1.8,           // seconds of unarmed charge lost per second of looking away
  touch: 0.8,          // walk into it and it goes off at once
  drain: 0.5,          // the share of the battery's charge that goes with it
  dark: 16,            // seconds the room stays dark afterwards
  gone: [40, 75],      // seconds before it is standing somewhere again
  stay: [9, 18],       // seconds it stands in one place before it tries another (it only ever moves while it is off the picture)
  near: [3, 10],       // how far from you it likes to stand, metres
});

/** Not here yet: where it starts, and where it is after it has gone off. */
export function away(rnd = Math.random, first = false) { return { mode: 'away', stare: 0, t: first ? 6 + 10 * rnd() : SHADOW.gone[0] + (SHADOW.gone[1] - SHADOW.gone[0]) * rnd(), heat: 0, burst: false, shift: false, armed: false, cleared: false }; }

function finish(s, exposed, rnd) {
  return exposed ? { ...away(rnd), burst: true }
    : { ...s, mode: 'gone', stare: 0, t: 0, heat: 0, armed: false, cleared: true };
}

/**
 * One moment of it.
 * @param s      what away() or the last call gave
 * @param sense  { placed · looked: central gaze, in plain sight · exposed: anywhere in the picture, in plain sight · d: metres }
 * @returns the new state: mode away/lurk/armed/gone; t is time to relocate, or the armed fuse;
 *          heat 0…1, and one-frame burst / armed / cleared / shift events. Gone is terminal for this floor.
 */
export function watched(s, dt, sense, rnd = Math.random) {
  const n = { ...s, burst: false, shift: false, armed: false, cleared: false };
  if (!Number.isFinite(dt) || dt <= 0 || s.mode === 'gone') return n;
  if (s.mode === 'away') {
    n.t = s.t - dt;
    if (n.t > 0) return n;
    if (!sense.placed) { n.shift = true; return n; }
    return { ...n, mode: 'lurk', stare: 0, heat: 0, t: SHADOW.stay[0] + (SHADOW.stay[1] - SHADOW.stay[0]) * rnd() };
  }
  const looking = !!sense.looked && sense.d <= SHADOW.far;
  // Getting outside the charging range is not looking away from a white figure.
  const exposed = sense.exposed ?? !!sense.looked;
  if (sense.d < SHADOW.touch) return { ...away(rnd), burst: true };
  if (s.mode === 'armed') {
    n.t = Math.max(0, s.t - dt); n.heat = 1;
    return n.t > 0 ? n : finish(n, exposed, rnd);
  }
  n.stare = looking ? s.stare + dt : Math.max(0, s.stare - SHADOW.cool * dt);
  n.heat = Math.min(1, n.stare / SHADOW.charge);
  if (n.stare >= SHADOW.charge) {
    n.mode = 'armed'; n.armed = true;
    n.t = Math.max(0, SHADOW.fuse - (n.stare - SHADOW.charge));
    n.stare = SHADOW.charge;
    return n.t > 0 ? n : finish(n, exposed, rnd);
  }
  n.t = s.t - dt;
  if (n.t <= 0 && n.stare === 0) { n.shift = true; n.t = 1.5; }
  return n;
}

/** What is left in a battery after it has gone off. */
export const drained = (charge) => charge * (1 - SHADOW.drain);
