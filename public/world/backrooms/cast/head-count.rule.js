// The Backrooms — head count's rule. Pure: no three.js, nothing of the page.
//
// Three of the staff, joined at the hips and walking on their arms. None of
// them has a head, so it does not see and it does not hear, and it does not
// know anybody is there. It goes about the floor, patting, counting, from one
// room to whichever is next, with no idea where it is going. It is not coming
// for anybody. But whoever it walks into, or whoever walks into it, has a hand
// come down on them and loses two hearts; and it stays there to count again,
// which is the time there is to get away. So: do not be where it is going.

export const HEADS = Object.freeze({
  r: 0.5, tall: 1.05,      // what of it walks: low, and wide
  slow: 1.1,               // metres a second, going about: a walk is 2.05
  touch: 1.0,              // metres: nearer than this a hand is on you, still or not
  hurts: 2,
  recount: 4.5,            // seconds it counts again after having somebody
  fire: 3,                 // metres: it will not come this near a fire
});

/** As it is first found: about its count. */
export const counting = () => ({ mode: 'counts', t: 0 });

/**
 * A moment of it.
 * @param s  its state
 * @param o  { dt, d: metres to the visitor, line: nothing solid between it and them, fire: a fire is near it }
 * @returns the next state; `took: true` on the moment a hand comes down on them
 */
export function counts(s, o) {
  const { dt, d, line = true, fire = false } = o;
  const t = s.t + dt;
  if (s.mode === 'recounts') return t >= HEADS.recount ? counting() : { mode: 'recounts', t };
  // a hand on them: it did not know they were there, and now it does
  if (d <= HEADS.touch && line && !fire) return { mode: 'recounts', t: 0, took: true };
  return { mode: 'counts', t };
}

/** How fast it goes, doing what it is doing. */
export const pace = (mode) => (mode === 'recounts' ? 0 : HEADS.slow);

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
