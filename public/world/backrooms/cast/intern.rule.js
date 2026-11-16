// The Backrooms — the intern's rule. Pure: no three.js, nothing of the page.
//
// One of them, far too tall, bent double: it goes on its hands and its feet
// with its back in the air, and its head hangs down between its arms the wrong
// way up, looking at you. It is learning the job by watching somebody do it.
// Whatever you do, it does, where you did it, a few seconds after: it walks
// where you walked and stops where you stopped. So it is always exactly that
// far behind, and it reaches you by your standing still, or by your coming
// back the way you went. The longer it has been following, the less far
// behind it is.
//
// It only knows what it has watched. Out of its sight for long enough, it has
// lost its place: it stops, and waits to be shown again. It cannot open a door.

export const INTERN = Object.freeze({
  r: 0.3, tall: 1.4,       // what of it walks
  sees: 16,                // metres
  notice: 0.7,             // seconds of watching before it starts
  behind: 3.4,             // seconds behind, when it starts
  least: 1.5,              // …and at best, when it has got the hang of it
  learns: 45,              // seconds of following to get from one to the other
  fast: 3.5,               // metres a second at most: it copies a run, nearly
  lost: 6,                 // seconds out of its sight before it has lost its place
  blank: 3,                // seconds it stands there, having lost it
  touch: 0.75,             // metres
  hurts: 1,
  sorry: 3,                // seconds it stands back, having had somebody
  keep: 12,                // seconds of what it has watched that it keeps
  fire: 3,
});

/** As it is first found: waiting to be shown. */
export const waiting = () => ({ mode: 'waits', t: 0, watched: 0, unseen: 0, learnt: 0 });

/** How many seconds behind it is, having followed for this long. */
export const behind = (learnt) => INTERN.behind - (INTERN.behind - INTERN.least) * Math.max(0, Math.min(1, learnt / INTERN.learns));

/**
 * Where somebody was at a time, from what was watched of them: [{ x, z, t }], oldest first.
 * @returns {{x:number, z:number}|null} null: it had not started watching by then
 */
export function was(trail, at) {
  if (!trail.length || at < trail[0].t) return null;
  for (let i = trail.length - 1; i >= 0; i--) {
    const a = trail[i]; if (a.t > at) continue;
    const b = trail[i + 1]; if (!b) return { x: a.x, z: a.z };
    const k = (at - a.t) / Math.max(1e-6, b.t - a.t); return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
  }
  return null;
}

/**
 * A moment of it.
 * @param s  its state
 * @param o  { dt, d: metres to the visitor, sees: it can see them, fire: a fire is near it }
 * @returns the next state; `starts` when it begins to copy, `loses` when it has lost its place, `took` when it has somebody
 */
export function copies(s, o) {
  const { dt, d, sees = false, fire = false } = o;
  let { mode, t, watched, unseen, learnt } = s;
  t += dt;
  if (mode === 'sorry') return t >= INTERN.sorry ? { mode: 'waits', t: 0, watched: INTERN.notice, unseen: 0, learnt: learnt * 0.5 } : { mode, t, watched, unseen, learnt };
  if (mode === 'blank') return t >= INTERN.blank ? waiting() : { mode, t, watched: 0, unseen: 0, learnt };
  if (d <= INTERN.touch && sees && !fire) return { mode: 'sorry', t: 0, watched: 0, unseen: 0, learnt, took: true };
  if (mode === 'waits') {
    watched = sees && d <= INTERN.sees && !fire ? watched + dt : Math.max(0, watched - dt);
    if (watched >= INTERN.notice) return { mode: 'copies', t: 0, watched, unseen: 0, learnt, starts: true };
    return { mode, t, watched, unseen: 0, learnt };
  }
  // copying
  unseen = sees ? 0 : unseen + dt;
  if (unseen >= INTERN.lost || fire) return { mode: 'blank', t: 0, watched: 0, unseen: 0, learnt, loses: true };
  return { mode, t, watched, unseen, learnt: learnt + dt };
}
