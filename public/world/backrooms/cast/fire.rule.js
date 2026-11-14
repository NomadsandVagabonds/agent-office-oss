// The Backrooms — what a creature does about a fire. Pure: no three.js, no DOM.
//
// A visitor can set light to paper on the floor (crafting.js, inventory-fire.js):
// eight seconds a sheet. Every creature's line in the deck (cast.js) says what
// that is to it — `fire`: 'fears' | 'ignores' | 'drawn' — and its own rule does
// it, with what is here. The conductor hands each of them c.fire(x, z): the fire
// a spot is in sight and reach of, { x, z, remaining }, or null (and always null
// in a visit without pockets: nobody can light one).
//
// Fearing one (the mascot): it will not set foot within FIRE_FEAR.keep of a fire
// it can see, so a fire in a doorway is a door it will not go through until the
// paper has burnt; and one lit beside it sends it backing off at once — watched
// or not, which is the one thing down here that moves it while you look at it.
// (After Codex's fire-fear.js, which did this to the old pursuer.)

/** What a creature's line may say fire is to it. */
export const FIRE_WAYS = Object.freeze(['fears', 'ignores', 'drawn']);

export const FIRE_FEAR = Object.freeze({
  keep: 3,          // metres: nearer a fire than this it will not go, and will not stay
  speed: 2.7,       // metres a second, backing off: faster than it ever comes for you
  memory: 1.5,      // seconds it keeps going once it is clear, or once the fire is out or out of sight
  turns: Object.freeze([0, 0.55, -0.55, 1.05, -1.05, 1.5, -1.5]),          // the ways it tries, either side of straight away from it
});

const off = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Not afraid of anything. */
export function calm() { return { from: null, left: 0, flee: false, away: 0, step: 0 }; }

/** Would standing here be too near that fire? (`fire`: what c.fire() gave for the spot, or null.) */
export function tooNear(spot, fire, keep = FIRE_FEAR.keep) { return !!fire && off(spot, fire) < keep; }

/**
 * One moment of being afraid of fire.
 * @param s     what calm() or the last call gave
 * @param at    { x, z, yaw } where it is, and which way it faces
 * @param fire  the fire that spot is threatened by ({ x, z }), or null
 * @returns { from: the fire it is getting away from, left: seconds it will keep going, flee: this moment belongs to the fire and to
 *            nothing else (no chasing, no reaching), away: the heading straight away from it, step: how far it may go this moment }
 */
export function afraid(s, dt, at, fire) {
  if (!Number.isFinite(dt) || dt <= 0) return { ...s, flee: false, step: 0 };
  const near = tooNear(at, fire);
  const from = near ? { x: fire.x, z: fire.z } : s.from, left = near ? FIRE_FEAR.memory : Math.max(0, (s.left || 0) - dt);
  if (!from || !(left > 0)) return calm();
  // (a fire lit exactly underfoot still has a way out: the way it was not facing)
  const away = off(at, from) > 1e-3 ? Math.atan2(at.x - from.x, at.z - from.z) : (at.yaw || 0) + Math.PI;
  return { from, left, flee: true, away, step: FIRE_FEAR.speed * Math.min(dt, 0.1) };
}
