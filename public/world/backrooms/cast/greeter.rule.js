// The Backrooms — the greeter's rule. Pure: no three.js, nothing of the page, and
// chance comes in as a function so that a test can load the dice.
//
// A tall tube of flesh on stubby feet that sways and waves like the thing put
// outside a grand opening, and goes about very slowly. It does no harm itself.
// When somebody is near enough it heaves, and brings up four or five small
// pink ones, which are fast and blind and jump for the face. One jump in four
// lands. They can be trodden on (E). Having brought them up it is content for
// a long while and only sways; it does it again only to somebody who went
// away and came back.

export const GREETER = Object.freeze({
  r: 0.36, tall: 1.9,      // what of it walks: it bends under a lintel
  height: 2.2,             // how tall it is, end to end: curled over at the top, it stands under any ceiling it walks beneath
  speed: 0.6,              // metres a second: it is in no hurry
  notices: 11,             // metres: nearer than this, and seen, it comes over
  near: 3.2,               // metres: this near, it heaves
  heave: 1.3,              // seconds of heaving before they come up (the warning)
  brood: [4, 5],           // how many come up
  rest: 80,                // seconds before it could do it again
  away: 10,                // …and only for somebody who has been this far off in the meantime
  fire: 3,                 // metres: it will not come this near a fire, and does not heave beside one
});

export const WORM = Object.freeze({
  r: 0.09, tall: 0.14,
  speed: 2.4,              // faster than walking, slower than running
  spring: 1.5,             // metres: this near, and it jumps
  jump: 0.55,              // seconds in the air
  lands: 0.25,             // they are blind: one jump in four finds the face
  reach: 0.75,             // metres: further than this from where it came down, it has missed whatever the dice say
  dazed: 1.1,              // seconds on its back after a miss
  jumps: 2,                // jumps in it before it is spent
  life: 26,                // seconds before it dries up of its own accord
  tread: 1.4,              // metres: near enough to tread on
  hurts: 1,
});

/** As it is first found: swaying, ready, having met nobody. */
export const swaying = () => ({ mode: 'sway', t: 0, rest: 0, been: true });

/**
 * A moment of the big one.
 * @param s  its state
 * @param o  { dt, d: metres to the visitor, sees: a line of sight to them, fire: is a fire near it, brood: how many small ones are still about }
 * @param rnd  () => 0…1
 * @returns the next state; with `up: n` on the moment n small ones come up, and `comes: true` while it is walking over
 */
export function sways(s, o, rnd = Math.random) {
  const { dt, d, sees, fire = false, brood = 0 } = o;
  let { mode, t, rest, been } = s;
  rest = Math.max(0, rest - dt);
  if (d >= GREETER.away) been = true;                       // they went away: it may greet them again, when it has it in it
  if (mode === 'heave') {
    t += dt;
    if (fire) return { mode: 'sway', t: 0, rest, been };     // it swallows them again
    if (t >= GREETER.heave) {
      const [a, b] = GREETER.brood, n = a + Math.floor(rnd() * (b - a + 1));
      return { mode: 'content', t: 0, rest: GREETER.rest, been: false, up: Math.min(b, n) };
    }
    return { mode, t, rest, been };
  }
  if (mode === 'content') {
    // pleased with itself: it stays where it is and sways, until it has it in it again and they have been away
    if (rest <= 0 && been && brood === 0) return { mode: 'sway', t: 0, rest: 0, been };
    return { mode, t: t + dt, rest, been };
  }
  // swaying, and ready
  if (sees && !fire && d <= GREETER.near) return { mode: 'heave', t: 0, rest, been };
  return { mode: 'sway', t: t + dt, rest, been, comes: sees && !fire && d <= GREETER.notices };
}

/** Does a jump find the face? Only one that came down near enough, and of those one in four. */
export const finds = (d, rnd = Math.random) => d <= WORM.reach && rnd() < WORM.lands;

/** Which of the small ones a foot comes down on: the nearest that is on the floor, in front, within a stride — its index, or -1. */
export function trodden(me, worms) {
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
  let best = -1, least = Infinity;
  worms.forEach((w, i) => {
    if (!w || w.dead || w.air) return;
    const dx = w.x - me.x, dz = w.z - me.z, d = Math.hypot(dx, dz);
    if (d > WORM.tread) return;
    if (d > 0.45 && (dx * fx + dz * fz) / d < 0.3) return;   // (underfoot counts whichever way they face)
    if (d < least) { least = d; best = i; }
  });
  return best;
}
