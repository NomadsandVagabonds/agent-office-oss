// The Backrooms — the sticky notes' rule (cast/sticky-notes.js is the creature). Pure: no three.js, nothing of the page.
//
// Four to six notes on the wall of a room, in somebody's hand, as notes are. Come near and they come off the wall, one after
// another, and go about the room in the air, flapping, as paper does in a draught that is not there. They do not all come
// at you: they go round. But get close to one and it comes at your face, and if it gets there it is on the lens, stuck,
// and you are looking through it. Stuck, they cost the camcorder a little charge, slowly; that is all they do. They are a
// nuisance, never what ends a visit (the owner: "more annoyance and distraction than lethal threat").
//
// A shove knocks one out of the air (a backhand: it goes down and lies a while), and a shove while any are stuck on the
// lens wipes them off instead. A jab finishes one (basic: one jab, one note). Fire takes them. The extinguisher brings down
// whatever it catches, wet, for a long while. And one that has been on the lens twice has had its glue: it falls and stays down.

export const NOTES = Object.freeze({
  count: Object.freeze([4, 6]),       // how many to a room, by the floor's dice
  wake: 3.2,                          // metres: this near, in the same room, and they come off the wall
  peel: 0.5,                          // seconds coming off the wall
  stagger: 0.45,                      // seconds between one peeling and the next
  flies: 1.1,                         // metres a second, going round the room
  round: 2.4,                         // metres: going round, they keep about this far round the visitor (in the room)
  low: 0.9, high: 2.2,                // the heights they keep to, above the floor
  inset: 0.45,                        // metres they keep off the walls
  dives: 1.4,                         // metres: this near to one, and it comes at your face
  diveSpeed: 3.4,                     // metres a second, coming at you
  diveFor: 1.1,                       // seconds it keeps coming before it gives up and goes round again
  sticks: 0.38,                       // metres from the lens that is on it
  rest: 4,                            // seconds after one has come at you before the next may (never two at once): mostly they go round
  knocked: 6,                         // seconds one knocked down lies there before it lifts again
  wet: 20,                            // …and one brought down by the extinguisher, wet through (extinguisher.rule.js)
  stuckFor: Object.freeze([18, 30]),  // seconds one stays on the lens if nobody wipes it, before it peels off and falls
  glue: 2,                            // times one can stick; after that, knocked or wiped or fallen, it stays down
  drain: 0.00025,                     // of a full charge, a second, for each one stuck (a tenth of a second of tape a second)
  most: 0.05,                         // …and no more than this of a full charge on a floor, all of them together, ever (20 s of 400)
  spare: 0.2,                         // …and none once the charge is down to this: they never finish a battery
  fire: 0.9,                          // metres: a fire this near and it burns
  fear: 2.4,                          // metres: they keep this far from a fire, going round
});

/** One note, on the wall. */
export const onWall = () => ({ mode: 'wall', t: 0, stuck: 0, down: 0 });

/**
 * One note's moment. The creature does the moving; this says what it is doing.
 * @param n      what onWall() or the last call gave
 * @param sense  { d: metres to the visitor (the lens), here: the visitor is in its room, wake: it may peel now (its turn), swarm: one has,
 *                 dive: it may come at you now (nobody else is), lens: metres from the lens, fire: metres to the nearest fire }
 * @returns the note, with one-frame events: `peeled`, `dove`, `stuck` (it is on the lens now), `fell`, `burnt`
 */
export function noteStep(n, dt, sense) {
  const N = NOTES, o = { ...n, t: n.t + (dt > 0 ? dt : 0), peeled: false, dove: false, stuck: false, fell: false, burnt: false };
  if (!(dt > 0) || n.mode === 'gone') return o;
  const d = sense.d ?? Infinity, fire = sense.fire ?? Infinity;
  if (fire <= N.fire && n.mode !== 'lens') return { ...o, mode: 'gone', t: 0, burnt: true };
  switch (n.mode) {
    // (near, it comes off; and once one has, the rest follow it, one after another, wherever in the room you are: a swarm)
    case 'wall': return sense.here && sense.wake && (d <= N.wake || sense.swarm) ? { ...o, mode: 'peel', t: 0 } : o;
    case 'peel': return o.t >= N.peel ? { ...o, mode: 'flutter', t: 0, peeled: true } : o;
    case 'flutter': return sense.here && d <= N.dives && sense.dive && fire > N.fear ? { ...o, mode: 'dive', t: 0, dove: true } : o;
    case 'dive':
      if ((sense.lens ?? Infinity) <= N.sticks) return { ...o, mode: 'lens', t: 0, stuck: true, times: (n.times || 0) + 1, until: sense.stuckFor ?? N.stuckFor[0] };
      return o.t >= N.diveFor ? { ...o, mode: 'flutter', t: 0 } : o;
    case 'lens': return o.t >= (n.until ?? N.stuckFor[0]) ? fallen(o) : o;
    case 'down': return o.t >= (n.wet ? N.wet : N.knocked) && (n.times || 0) < N.glue ? { ...o, mode: 'flutter', t: 0, wet: false } : o;
    default: return o;
  }
}

/** It has come off the lens by itself, or been wiped off, or knocked out of the air: it goes down — and stays down once its glue is spent. */
export function fallen(n) { return { ...n, mode: (n.times || 0) >= NOTES.glue ? 'spent' : 'down', t: 0, fell: true }; }

/** The extinguisher: it comes down wet, and lies stuck to the floor a long while (NOTES.wet) before it can lift. */
export const wetted = (n) => ({ ...fallen(n), wet: true });

/** A jab: one note, finished (basic). It lies where it falls and is done. */
export const torn = (n) => ({ ...n, mode: 'spent', t: 0, fell: true });

/**
 * What the stuck ones cost the camcorder this moment: a share of its charge — never more than NOTES.most of a full charge
 * on a floor, all told, and nothing once it is down to NOTES.spare. They are a nuisance; they never end a visit.
 * @param stuck   how many are on the lens
 * @param charge  0…1, what is left
 * @param taken   0…1, what they have taken on this floor so far
 * @returns the share to take now (of a full charge)
 */
export function drainOf(stuck, dt, charge, taken) {
  if (!(stuck > 0) || !(dt > 0) || !(charge > NOTES.spare) || taken >= NOTES.most) return 0;
  return Math.max(0, Math.min(stuck * NOTES.drain * dt, NOTES.most - taken, charge - NOTES.spare));
}

/** Who goes next: of those still on the wall, the nearest to the visitor (`d`, metres, by the same index) — or the first. → its index, or −1. */
export function nextToPeel(notes, d = []) {
  let best = -1;
  notes.forEach((n, i) => { if (n.mode === 'wall' && (best < 0 || (d[i] ?? Infinity) < (d[best] ?? Infinity))) best = i; });
  return best;
}
