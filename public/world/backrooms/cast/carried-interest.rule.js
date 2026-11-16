// The Backrooms — carried interest's rule. Pure: no three.js, nothing of the
// page.
//
// Somebody senior, who has not walked anywhere in a long time and has no legs
// to do it with now: a great soft weight in a waistcoat, borne along on the
// backs of ten small things that are not people. It comes for whoever it sees,
// slowly, and when it gets there it is set down on them.
//
// The small ones can be trodden on (E). It needs six to carry it. With fewer
// it is on the floor, and it does not like the floor: it howls, and the howl
// takes some of the battery out of the camcorder. More of them grow, one at a
// time, and when there are enough it is taken up again. So it can be stopped,
// at a price, for a while; or it can be walked away from, which costs nothing
// but the way you were going.

export const CARRIED = Object.freeze({
  r: 0.5, tall: 1.45,      // what of it walks
  bearers: 10,
  needs: 6,                // fewer than this and it is on the floor
  speed: 0.95,             // metres a second with all ten under it
  sees: 14,
  set: 0.95,               // metres: this near, and it is set down on them
  hurts: 2,
  sits: 4.5,               // seconds it sits, having been set down on somebody
  grows: 5.5,              // seconds for another to grow
  howl: 0.14,              // of whatever battery there is, each time it is dropped
  tread: 1.45,             // metres from a small one that a foot reaches
  fire: 3,
});

/** As it is first found: borne, on all ten. */
export const borne = () => ({ mode: 'borne', t: 0, bearers: CARRIED.bearers, grow: 0 });

/** How fast it is carried on that many. */
export const pace = (n) => (n < CARRIED.needs ? 0 : CARRIED.speed * (0.55 + 0.45 * (n - CARRIED.needs) / (CARRIED.bearers - CARRIED.needs)));

/**
 * A moment of it.
 * @param s  its state
 * @param o  { dt, d: metres to the visitor, sees: it can see them, trodden: how many of the small ones were trodden on this
 *             moment, fire: a fire is near it }
 * @returns the next state; `drops` on the moment it goes down, `rises` when it is taken up, `took` when it is set down on
 *          somebody, `grew` when another small one has grown, `comes` while it is being carried toward them
 */
export function carried(s, o) {
  const { dt, d, sees = false, trodden = 0, fire = false } = o;
  let { mode, t, bearers, grow } = s;
  t += dt;
  const before = bearers; bearers = Math.max(0, bearers - trodden);
  let grew = false;
  if (bearers < CARRIED.bearers) { grow += dt; if (grow >= CARRIED.grows) { grow = 0; bearers++; grew = true; } } else grow = 0;
  if (mode === 'sits') return t >= CARRIED.sits ? { mode: bearers >= CARRIED.needs ? 'borne' : 'down', t: 0, bearers, grow, grew, rises: bearers >= CARRIED.needs } : { mode, t, bearers, grow, grew };
  if (mode === 'down') {
    if (bearers > CARRIED.needs) return { mode: 'borne', t: 0, bearers, grow, grew, rises: true };       // (one to spare, before they will try it again)
    return { mode, t, bearers, grow, grew };
  }
  // borne
  if (bearers < CARRIED.needs) return { mode: 'down', t: 0, bearers, grow: 0, drops: before >= CARRIED.needs };
  if (d <= CARRIED.set && sees && !fire) return { mode: 'sits', t: 0, bearers, grow, grew, took: true };
  return { mode, t, bearers, grow, grew, comes: sees && !fire && d <= CARRIED.sees };
}

/** Which of the small ones a foot comes down on: the nearest that is there, in front, within a stride — its index, or -1. */
export function under(me, spots) {
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
  let best = -1, least = Infinity;
  spots.forEach((p, i) => {
    if (!p || p.gone) return;
    const dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz);
    if (d > CARRIED.tread) return;
    if (d > 0.45 && (dx * fx + dz * fz) / d < 0.3) return;
    if (d < least) { least = d; best = i; }
  });
  return best;
}
