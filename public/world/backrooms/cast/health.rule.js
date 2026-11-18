// The Backrooms — how much it takes. Pure: no three.js, nothing of the page.
//
// There is one thing down here to hit with, and it is a pair of scissors. A jab takes one. What it is taken from:
//
//   basic   1   the things that are barely there: the figure in the corner, a small one of Mother's, a toner's hatchling
//   medium  2   what walks the floor after you and can be put off: the mascot, the trunk line, a toner, the intern
//   boss    3   what a part of the building belongs to: the lines, the standing meeting, Mother, carried interest, head count
//
// A hit that does not finish it still does what a jab always did (each of the cast says what: its own snipTargets()),
// and it leaves a mark the picture can read: `hurt`, seconds since the last hit. One that does finish it starts it
// `dying`, 0 → 1 over as long as a thing of its size takes to go (HEALTH.takes: the bigger, the longer it lies there),
// in which it lands nothing; after that it is gone from this floor.
// Who cannot be hit at all says nothing: a moth, a porter, a door, a row of shop dummies.

export const HEALTH = Object.freeze({
  basic: 1, medium: 2, boss: 3,
  jab: 1,                  // what one jab of the scissors takes
  dying: 1.2,              // seconds from the last hit to gone, for whatever says nothing else
  takes: Object.freeze({ basic: 1.2, medium: 1.6, boss: 2.4 }),   // …and by size: a death needs a beat of it lying there to be seen
  flinch: 0.6,             // seconds a hit that does not finish it stops a thing that has no stand-down of its own
});

/** Who is in which. (The small ones are not of the cast: they are bodies of somebody who is.) */
export const TIER = Object.freeze({
  'the-lines': 'boss', 'standing-meeting': 'boss', mother: 'boss', 'carried-interest': 'boss', 'head-count': 'boss',
  pirate: 'medium', 'trunk-line': 'medium', toner: 'medium', intern: 'medium',
  shadow: 'basic', 'toner-brood': 'basic', 'mother-brood': 'basic',
  // somebody a room keeps (resident.js): the waterpark's
  'guard-stand': 'medium', 'lane-keeper': 'medium', 'flume-toner': 'medium', 'plenum-toner': 'medium',
  'inverted-bathers': 'basic', 'towel-return': 'basic', 'pool-skimmer': 'basic',
});

/** Those a pair of scissors does nothing to. */
export const UNHITTABLE = Object.freeze(['moth', 'porter', 'other-door', 'dummies']);

/** How much this one takes: 1, 2 or 3 — or 0: it cannot be hit. */
export const healthOf = (id) => HEALTH[TIER[id]] ?? 0;

/** How long this one takes to go, seconds. */
export const dyingOf = (id) => HEALTH.takes[TIER[id]] ?? HEALTH.dying;

/**
 * A thing's health at the start of a floor — or null: it has none.
 * { hp, max, hurt: seconds since it was last hit (Infinity: never), dying: null or 0…1, gone, takes: seconds its dying lasts }
 */
export function fresh(id) {
  const max = healthOf(id);
  return max > 0 ? { hp: max, max, hurt: Infinity, dying: null, gone: false, takes: dyingOf(id) } : null;
}

/** It has been hit. One that is already dying is not hit again. → the new health, with `killed`: this was the hit that finished it. */
export function struck(h, n = HEALTH.jab) {
  if (!h || h.gone || h.dying !== null) return h ? { ...h, killed: false } : h;
  const hp = Math.max(0, h.hp - Math.max(0, n)), killed = hp <= 0;
  return { ...h, hp, hurt: 0, dying: killed ? 0 : null, killed };
}

/** Time passes: the mark of the last hit ages, and one that is dying goes. */
export function aged(h, dt, length = (h && h.takes) || HEALTH.dying) {
  if (!h || !(dt > 0)) return h;
  const hurt = h.hurt + dt;
  if (h.dying === null || h.gone) return { ...h, hurt, killed: false };
  const dying = Math.min(1, h.dying + dt / length);
  return { ...h, hurt, dying, gone: dying >= 1, killed: false };
}

/** Is it out of things: dying, or gone? (It lands no hit, and is not to be pushed or jabbed.) */
export const finished = (h) => !!h && (h.dying !== null || h.gone);
