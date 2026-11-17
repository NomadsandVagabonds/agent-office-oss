// The Backrooms — a shove you can see (shove.rule.js says what it moves; this says what the visitor's own hands do). Both hands go
// out in front of the lens and come back, over the pulse player.js keeps (me.punch: 1, falling to 0 in PULSE seconds). Pure: no
// three.js. hand.js builds the hands and puts them where this says, in camera space (−z is forward).

export const HANDS = Object.freeze({
  pulse: 0.3,                                 // seconds: player.js `me.punch` falls from 1 to 0 over this
  rest: { x: 0.17, y: -0.34, z: -0.34 },      // where each hand waits, just below the frame (the left one is mirrored)
  out: { x: 0.075, y: -0.045, z: -0.66 },     // at the furthest: palms flat out in front, a little apart, a little low
  spread: 0.12,                               // radians the palms turn outward at rest, and flatten to nothing at the furthest
});

/** How far out the hands are, 0 (waiting) to 1 (at full stretch), for a pulse that has `punch` left (1 just begun, 0 over). */
export function reach(punch) {
  if (!(punch > 0)) return 0;
  const u = 1 - Math.min(1, punch);                // how far through the pulse: 0 to 1
  const out = Math.min(1, u / 0.42), back = Math.max(0, (u - 0.42) / 0.58);       // quick out, slower back
  const e = u < 0.42 ? Math.sin(out * Math.PI / 2) : Math.cos(back * Math.PI / 2);
  return Math.max(0, Math.min(1, e));
}

/** Are the hands to be shown: a shove is going on, and nothing else has the hands (the scissors jab; a thing carried; the bag). */
export const showing = (punch, { scissors = false, carrying = false, bag = false } = {}) => punch > 0 && !scissors && !carrying && !bag;

/** Where one hand is, and how it is turned. side −1 left, +1 right. → { x, y, z, yaw, pitch } */
export function handAt(punch, side) {
  const e = reach(punch), { rest, out, spread } = HANDS;
  const lerp = (a, b) => a + (b - a) * e;
  return { x: side * lerp(rest.x, out.x), y: lerp(rest.y, out.y), z: lerp(rest.z, out.z), yaw: -side * spread * (1 - e), pitch: 0.18 * (1 - e) };
}
