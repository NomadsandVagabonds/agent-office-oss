// The Backrooms — the middle manager's rule (cast/middle-manager.js is the creature). Pure: no three.js, nothing of the page.
//
// Far too tall and far too thin, in a suit, with a lanyard. Left alone it stands, and now and then takes a step or two
// somewhere else. Look it in the eye — straight at it, the middle of the picture — and it comes for you, quickly, for as
// long as you hold its look: a meeting, one to one. Look away and it stops where it is.
//
// Every meeting leaves it fatter, and fatter is slower: thin it is quick and lean, full it can barely walk. And it keeps
// what it has put on. When it is near you it stops, swells and goes off; full, it goes off wherever it is. What it goes
// off with is everything it has put on: a thin one barely reaches you, a full one reaches across a room.
//
// So: watch it out of the corner of your eye, never straight at it; a jab finishes it at once (it is barely there), but at
// arm's length it goes off on you; a shove puts it back a step, and a shove while it is swelling puts it off.
// It never stands in a doorway for long: after a while there it goes and stands somewhere else.

export const MANAGER = Object.freeze({
  cone: 0.2,             // radians from the middle of the picture (plus its own width) that is looking it in the eye
  far: 18,               // metres: further off than this a look is not a meeting
  takes: 0.25,           // seconds of a look before it is a meeting (a glance across it is not)
  lets: 0.35,            // seconds after the look has gone before it stops (it does not stop the instant your eye leaves)
  quick: 3.4,            // metres a second at its thinnest — a hurry is 3.7: it can be outrun, only just
  slow: 1.3,             // …and at its fullest
  gets: 2.2,             // metres a second gained each second of a meeting, up to how quick it is now
  stops: 9,              // …and lost each second after, down to standing
  meeting: 0.12,         // put on for every new meeting, however short
  stare: 0.08,           // put on for every second of looking
  near: 1.5,             // metres: this near, it stops and goes off
  swells: 0.7,           // seconds from stopping to going off (a shove in this time puts it off)
  ripens: 1.2,           // full, seconds before it goes off wherever it is
  blast: Object.freeze({ thin: 1.6, full: 4.2 }),   // metres it reaches when it goes off, from its thinnest to full
  hurts: Object.freeze({ near: 2, far: 1 }),       // hearts: in the inner half of its reach · in the outer half
  drift: 0.22,           // metres a second, the step or two it takes on its own
  wanders: Object.freeze([7, 16]),                 // seconds between one step or two and the next
  doorway: 6,            // seconds it will stand in a doorway before it goes somewhere else
  r: 0.3,
  ducks: 2.0,            // metres: as low as it can fold itself to go under something (it goes through a doorway of this)
  clear: 0.1,            // metres it keeps between its crown and the ceiling
  neck: 1.5,             // its neck goes this much further forward than its body bends…
  head: 0.55,            // …and its head, bowed, only this much (it hangs in front of it, upright, and looks at you)
});

/**
 * How far it bends, under this much room: it is three metres, and a ceiling is not. It folds at the hips; its neck goes
 * further forward than its body, and its head, bowed, less far (MANAGER.neck, MANAGER.head: how much of the bend each
 * takes), until its crown is `clear` under what is above it.
 * @param above  metres from the floor to the ceiling over it (or to a door's head, going through one)
 * @param body   { hip, torso, neck, head }: metres, floor to hip · hip to shoulder · the neck · neck to crown, standing straight
 * @returns radians it bends at the hips: 0 standing straight, at most 1.45
 */
export function bend(above, body) {
  const room = above - MANAGER.clear;
  if (!(Number.isFinite(room)) || crown(0, body) <= room) return 0;
  let lo = 0, hi = 1.45;
  if (crown(hi, body) > room) return hi;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (crown(mid, body) > room) lo = mid; else hi = mid; }
  return hi;
}

/** How high its crown is, bent this far at the hips. */
export const crown = (a, body) => body.hip + body.torso * Math.cos(a) + body.neck * Math.cos(a * MANAGER.neck) + body.head * Math.cos(a * MANAGER.head);

/** Where it starts: alone, standing, thin. */
export const fresh = () => ({ mode: 'stands', fat: 0, speed: 0, looked: 0, since: Infinity, t: 0, met: false, swell: 0 });

/** How quick it is now: thin, quick; full, slow. */
export const topSpeed = (fat) => MANAGER.quick + (MANAGER.slow - MANAGER.quick) * Math.max(0, Math.min(1, fat));

/** How far it reaches when it goes off, now. */
export const reach = (fat) => MANAGER.blast.thin + (MANAGER.blast.full - MANAGER.blast.thin) * Math.max(0, Math.min(1, fat));

/** What it costs somebody this far from it when it goes off, with nothing between: 2, 1 or 0. */
export function blastAt(fat, d) {
  const r = reach(fat);
  if (!(d <= r)) return 0;
  return d <= r / 2 ? MANAGER.hurts.near : MANAGER.hurts.far;
}

/**
 * Is it being looked in the eye?
 * @param off   radians between the middle of the picture and it
 * @param d     metres to it
 * @param sight nothing between, and it is in the picture
 */
export const eyed = (off, d, sight) => !!sight && d <= MANAGER.far && off <= MANAGER.cone + Math.atan2(MANAGER.r, Math.max(d, 0.01));

/**
 * One moment of it.
 * @param s      fresh() or the last call's
 * @param sense  { eyed: is it being looked in the eye · d: metres to the visitor · stalled?: it has been shoved }
 * @returns the new state, with one-frame events: `meets` (a meeting begins), `bursts` (it goes off: now), `swelling`
 *          (it has stopped to go off). Modes: stands · comes · swells · gone.
 */
export function minds(s, dt, sense) {
  const n = { ...s, meets: false, bursts: false, swelling: false };
  if (!(dt > 0) || s.mode === 'gone') return n;
  const M = MANAGER, eye = !!sense.eyed, d = sense.d ?? Infinity;
  // a look: held long enough it is a meeting, and every meeting puts weight on; every second of one puts on more
  n.looked = eye ? s.looked + dt : 0;
  n.since = eye ? 0 : s.since + dt;
  if (eye && s.looked < M.takes && n.looked >= M.takes) { n.meets = true; n.fat = Math.min(1, n.fat + M.meeting); }
  if (eye && n.looked >= M.takes) n.fat = Math.min(1, n.fat + M.stare * dt);
  // going off: once it has begun, it finishes (unless a shove puts it off: off())
  if (s.mode === 'swells') {
    n.swell = s.swell + dt; n.speed = 0;
    if (n.swell >= (n.fat >= 1 && d > M.near ? M.ripens : M.swells)) return { ...n, mode: 'gone', bursts: true };
    return n;
  }
  if (n.fat >= 1 || d <= M.near) return { ...n, mode: 'swells', swell: 0, speed: 0, swelling: true };
  // coming: only while the meeting holds, and a moment after
  const on = n.looked >= M.takes || (s.mode === 'comes' && n.since < M.lets);
  n.speed = on ? Math.min(topSpeed(n.fat), s.speed + M.gets * dt) : Math.max(0, s.speed - M.stops * dt);
  n.mode = n.speed > 0 ? 'comes' : 'stands';
  if (n.mode === 'stands') n.t = s.t + dt; else n.t = 0;
  return n;
}

/** A shove: it is put back a step and, if it was swelling, put off it (it stands again, as fat as it was). */
export const off = (s) => (s.mode === 'gone' ? s : { ...s, mode: 'stands', swell: 0, speed: 0, looked: 0, t: 0 });

/** A jab finishes it (it is barely there): it goes off where it is, then and there. */
export const popped = (s) => ({ ...s, mode: 'gone', bursts: true, speed: 0 });
