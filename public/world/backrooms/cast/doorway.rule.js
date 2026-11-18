// The Backrooms — nobody keeps a doorway. Pure: no three.js, nothing of the page.
//
// The owner: "No creatures should block a doorway/crawlspace etc forever. After a timeout they should wander elsewhere."
// Whatever stands in a doorway, a crawl's mouth or the way down for longer than it will — and how long that is, is not one
// number: each time, it is drawn afresh from the floor's own dice, within the creature's own range — gives it up and goes
// somewhere else: a room away, and somewhere in it the doorway cannot be seen from, so that the way is clear and stays
// clear. What it does there is its own business again.
//
// A creature asks three things of this: is it in a doorway (`at`, with what the floor says about where its doorways are);
// has it been there long enough (`camps`); and, if so, where to go (`elsewhere`, from rooms its walker could stand in).

export const DOORWAY = Object.freeze({
  near: 0.85,                                  // metres from the middle of a doorway that is standing in it
  keeps: Object.freeze([5, 12]),               // seconds, from…to, that one will keep a doorway (each a creature's own unless it says)
  away: Object.freeze([1, 2]),                 // rooms away it goes: at least one, at most two
  far: 2.5,                                    // metres from the doorway at the least, wherever it goes
});

/**
 * Is a spot in a doorway, a crawl's mouth or the way down?
 * @param p      { x, z }
 * @param ways   [{ x, z }] the doorways of the room it is in, and of the rooms next to it (a crawl's mouth is one of them)
 * @param down   true: the room it is in is the way down (the fire exit's stair): all of it counts
 * @returns the doorway it is in, or `{ down: true }`, or null
 */
export function at(p, ways = [], down = false) {
  if (!p) return null;
  if (down) return { down: true, x: p.x, z: p.z };
  let best = null, bd = DOORWAY.near;
  for (const w of ways) { const d = Math.hypot(w.x - p.x, w.z - p.z); if (d <= bd) { best = w; bd = d; } }
  return best;
}

/** Not in a doorway, or just come into one: how long it will keep this one, drawn now. `rnd` is the floor's (c.R.next / a seeded stream). */
export function fresh(rnd = Math.random, keeps = DOORWAY.keeps) { return { t: 0, limit: keeps[0] + (keeps[1] - keeps[0]) * rnd(), way: null }; }

/**
 * Time passes in (or out of) a doorway.
 * @param s     what fresh() or the last call gave
 * @param way   what at() gave (null: not in one)
 * @returns { t, limit, way, due: it has been there long enough and must go, now }
 */
export function camps(s, dt, way, rnd = Math.random, keeps = DOORWAY.keeps) {
  const same = !!way && !!s.way && (way.down ? s.way.down : Math.hypot(way.x - s.way.x, way.z - s.way.z) < 0.01);
  if (!way) return { ...fresh(rnd, keeps), due: false };
  const n = same ? { ...s, t: s.t + (dt > 0 ? dt : 0) } : { ...fresh(rnd, keeps), way, t: dt > 0 ? dt : 0 };
  return { ...n, due: n.t >= n.limit };
}

/**
 * Where to go instead: the first of the spots offered, in order of a shuffle by the floor's dice, that is a room or two
 * away, far enough from the doorway, and out of its sight.
 * @param spots  [{ x, z, rooms: how many doorways from where it is, sees: can the doorway be seen from there }]
 * @returns a spot, or null (nowhere will do: then it goes the furthest it can, and tries again next time)
 */
export function elsewhere(way, spots = [], rnd = Math.random) {
  const ok = spots.filter((p) => p && p.rooms >= DOORWAY.away[0] && p.rooms <= DOORWAY.away[1] && !p.sees && (!way || way.down || Math.hypot(p.x - way.x, p.z - way.z) >= DOORWAY.far));
  if (!ok.length) return null;
  return ok[Math.floor(rnd() * ok.length) % ok.length];
}
