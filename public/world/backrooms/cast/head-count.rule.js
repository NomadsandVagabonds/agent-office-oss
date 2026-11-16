// The Backrooms — head count's rule. Pure: no three.js, nothing of the page.
//
// Three of the staff, joined at the hips and walking on their arms. None of
// them has a head, so it does not see and it does not hear: it feels the floor.
// Somebody walking is felt from a long way off, and somebody running from
// further. Somebody standing still is not there at all, until a hand comes
// down on them. So: keep still, and do not be where it is going.
//
// It goes about the floor slowly, patting, counting. When it feels a step it
// comes, fast, to where the step was. If nobody is there it goes over the
// place with its hands for a while and then goes back to its count. Whoever it
// touches loses two hearts, and it stays to count again, which is the time
// there is to get away.

export const HEADS = Object.freeze({
  r: 0.5, tall: 1.05,      // what of it walks: low, and wide
  slow: 0.75,              // metres a second, counting
  fast: 3.0,               // …and coming: faster than a walk (2.05), slower than a run (3.7)
  walks: 8,                // metres: a walking step is felt from here
  runs: 14,                // …and a running one from here
  step: 0.3,               // metres a second: slower than this is standing still
  sure: 0.45,              // seconds of felt steps before it is sure, and comes
  touch: 1.0,              // metres: nearer than this a hand is on you, still or not
  hurts: 2,
  sweep: 4,                // seconds it goes over the place with its hands
  recount: 4.5,            // seconds it counts again after having somebody
  fire: 3,                 // metres: it will not come this near a fire
});

/** As it is first found: about its count. */
export const counting = () => ({ mode: 'counts', t: 0, sure: 0, felt: null });

/** How far off this is felt: nothing if they are standing still. */
export const reach = (speed) => (speed < HEADS.step ? 0 : speed > 2.6 ? HEADS.runs : HEADS.walks);

/**
 * A moment of it.
 * @param s  its state
 * @param o  { dt, d: metres to the visitor, speed: how fast they are going, at: { x, z } where they are, line: nothing solid
 *             between it and them, there: it has got to where it was going, fire: a fire is near it }
 * @returns the next state; `took: true` on the moment a hand comes down on them, `felt: true` on the moment it becomes sure
 */
export function counts(s, o) {
  const { dt, d, speed = 0, at = null, line = true, there = false, fire = false } = o;
  let { mode, t, sure, felt } = s;
  t += dt;
  if (mode === 'recounts') return t >= HEADS.recount ? counting() : { mode, t, sure: 0, felt: null };
  // a hand on them: whatever it was doing, and whether they moved or not
  if (d <= HEADS.touch && line && !fire) return { mode: 'recounts', t: 0, sure: 0, felt: null, took: true };
  const feels = line && d <= reach(speed);
  sure = feels ? sure + dt : Math.max(0, sure - dt * 0.6);
  if (mode === 'counts') {
    if (sure >= HEADS.sure && !fire) return { mode: 'comes', t: 0, sure, felt: at && { x: at.x, z: at.z }, begins: true };
    return { mode, t, sure, felt: null };
  }
  if (mode === 'comes') {
    if (fire) return { mode: 'sweeps', t: 0, sure: 0, felt };
    if (feels && at) felt = { x: at.x, z: at.z };          // every step tells it again where
    if (there || t > 12) return { mode: 'sweeps', t: 0, sure: 0, felt };
    return { mode, t, sure, felt };
  }
  // sweeping: going over the place with its hands. A step starts it off again
  if (sure >= HEADS.sure && !fire) return { mode: 'comes', t: 0, sure, felt: at && { x: at.x, z: at.z }, begins: true };
  if (t >= HEADS.sweep) return counting();
  return { mode, t, sure, felt };
}

/** How fast it goes, doing what it is doing. */
export const pace = (mode) => (mode === 'comes' ? HEADS.fast : mode === 'recounts' ? 0 : mode === 'sweeps' ? HEADS.slow * 0.8 : HEADS.slow);

/**
 * Where an elbow is, for an arm of two lengths from a shoulder to a hand: the joint is lifted, and stands out from the body.
 * @returns {{x:number, y:number, z:number}}
 */
export function elbow(sh, hand, upper, fore, out = { x: 0, z: 0 }) {
  const dx = hand.x - sh.x, dy = hand.y - sh.y, dz = hand.z - sh.z, full = Math.hypot(dx, dy, dz) || 1e-6, d = Math.min(full, upper + fore - 1e-3);
  const a = (upper * upper - fore * fore + d * d) / (2 * d), h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const ux = dx / full, uy = dy / full, uz = dz / full;
  // the way the joint goes: up, and outward, with whatever of that lies along the arm taken out of it
  let px = out.x * 0.6, py = 1, pz = out.z * 0.6; const along = px * ux + py * uy + pz * uz; px -= ux * along; py -= uy * along; pz -= uz * along;
  const n = Math.hypot(px, py, pz) || 1;
  return { x: sh.x + ux * a + (px / n) * h, y: sh.y + uy * a + (py / n) * h, z: sh.z + uz * a + (pz / n) * h };
}
