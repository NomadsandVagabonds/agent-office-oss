// The Backrooms — what the thing that follows you knows. Pure: no three.js,
// no DOM, no clock of its own (pursuer.js acts on it; the tests run it against
// a made-up clock).
//
// It hunts by what it sees. While it has a line of sight to you it knows where
// you are, and comes ('chase'). Break the line — a corner, a door pulled shut,
// something tall — and all it has is the last place it saw you: it goes there
// ('search'), stands and looks ('look'), and then walks the floor room by room
// with nothing to go on ('wander') until it sees you again. It never knows
// where you are in any other way, with one exception that is also something it
// sees: a door it left open and finds shut was shut by somebody, and it would
// rather try that door than another.
//
// A shut door holds it up (handle): it can work the handle, slowly, and you can
// hear it at it — but working a handle is moving, and it only ever moves while
// nobody is looking. Watch the door and the handle is still.
//
// And it cannot get through anything it could not stand up in. Sometimes, when
// you have crawled through such a hole and turned your back on it, it gets down
// on the carpet and puts its face to the hole (getsDown): not every time, and
// only once you have stopped looking.

export const HUNT = Object.freeze({
  far: 24,                 // metres: further off than this it cannot make you out
  notice: [0.1, 0.8],      // seconds of unbroken sight before it has noticed you: at arm's length · at `far`
  after: 0.5,              // seconds after the line breaks that it still knows which way you went
  look: 3.5,               // seconds it stands where it last saw you
  linger: [3, 8],          // seconds in each room it wanders into
  door: 5,                 // unwatched seconds at the handle of a shut door before it opens
  rattle: 1.15,            // …and how often, in those seconds, you hear it
  shutPull: 5,             // how much rather it would try a door somebody has shut than any other way on
  stale: 0.25,             // …and how little it wants the room it has just come out of
  trail: 10,               // how many rooms back it remembers having been in: it would rather try one it has not
  grab: 2,                 // points of health a grab costs, of four (with no health to take, a grab is the end of the tape)
  spent: [14, 24],         // seconds after a grab that it keeps away and takes no notice of you
  peek: 0.65,              // how often, when you crawl away from it, it gets down to look through the hole after you
  peekGap: [1.4, 6.5],     // how far from the hole you must be for that, metres: not within its reach, not out of sight of it
  peekTurned: 0.7,         // seconds your back must have been to the hole
  peekWithin: 9,           // seconds after you crawled through that it will still bother
  peekFor: 7,              // seconds it lies there if you never look
  peekSeen: 0.7,           // seconds after you look away again that it gets up
});

/** Moving a barricade costs unwatched time before the furniture starts to slide. */
export const BARRICADE = Object.freeze({ chair: 1.2, trolley: 1.5, desk: 2.4, knock: 0.8, stuck: 1.2, follow: 1 });
/** Pure wind-up clock. A changed obstacle starts again; watching, a pause or a spent hunter makes no progress. */
export function heave(previous, dt, item, active = true) {
  const step = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0));
  if (!item) {
    if (!previous) return null;
    // It takes a step after each shove. Briefly losing contact is not a whole new desk to brace against.
    const idle = (previous.idle || 0) + (active ? step : 0);
    return idle > BARRICADE.follow ? null : { ...previous, idle, shove: 0, knock: false };
  }
  const s = previous?.id === item.id ? previous : { id: item.id, t: 0, next: 0.25, stuck: 0 };
  if (!active) return { ...s, shove: 0, knock: false };
  const delay = BARRICADE[item.type] || BARRICADE.desk;
  const t = s.t + step, knock = step > 0 && t >= s.next;
  return { ...s, t, idle: 0, next: knock ? t + BARRICADE.knock : s.next, knock,
    shove: Math.max(0, t - delay) - Math.max(0, s.t - delay) };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** How long it must have a line of sight to you, d metres off, before it has noticed. */
export function noticeTime(d, far = HUNT.far) { return HUNT.notice[0] + (HUNT.notice[1] - HUNT.notice[0]) * clamp(d / Math.max(0.1, far), 0, 1); }

/** Knowing nothing: where it starts, and where it ends up every time it has lost you. */
export function lost() { return { mode: 'wander', last: null, seen: 0, since: 0, t: 0, stuck: 0, blind: false, spent: 0, room: null, from: null, been: [], found: false, gaveUp: false }; }

/** It has had you, and you are still here: it goes off, and for a while it is not interested. */
export function spent(rnd = Math.random) { return { ...lost(), spent: HUNT.spent[0] + (HUNT.spent[1] - HUNT.spent[0]) * rnd() }; }

/** Knowing exactly where you are (it was shown: the card taken from its hand, a back turned within its reach). */
export function shown(me) { return { ...lost(), mode: 'chase', last: { x: me.x, z: me.z, room: me.room } }; }

/**
 * One moment of knowing.
 * @param s      what lost(), shown() or the last call gave
 * @param dt     seconds since
 * @param sense  { los: is there a line of sight between it and you · d: how far off you are, metres ·
 *                 me: { x, z, room } where you are · room: the room it is in ·
 *                 at: it has got to where it was going (or as near as it can get) ·
 *                 cannot: there is no way for it to where it is going ·
 *                 exits: [{ room, shut }] the rooms it could walk into from here; shut: through a door somebody has shut since it last came this way }
 * @param rnd    () → 0…1
 * @returns the new state: { mode: 'chase'|'search'|'look'|'wander', last: where it last knew you to be, room: the room it is making for (wander),
 *          found: it noticed you this moment, gaveUp: it stopped looking this moment … }
 */
export function knows(s, dt, sense, rnd = Math.random) {
  const n = { ...s, found: false, gaveUp: false };
  const far = sense.far ?? HUNT.far, noticeScale = sense.noticeScale ?? 1;
  const inSight = !!sense.los && sense.d <= far;
  if (!inSight) n.blind = false;
  n.spent = Math.max(0, (s.spent || 0) - dt);
  const sees = inSight && !n.blind && !(n.spent > 0);
  n.seen = sees ? s.seen + dt : 0;
  // somewhere it cannot get to (you crawled there): it stands and stares for as long as it would look for you, and then gives it up —
  // and having given you up, it takes no more notice of you until it has lost sight of you and seen you afresh
  n.stuck = sense.cannot && (s.mode === 'chase' || s.mode === 'search') ? s.stuck + dt : 0;
  if (n.stuck >= HUNT.look) { n.mode = 'wander'; n.gaveUp = true; n.blind = inSight; n.seen = 0; n.stuck = 0; n.t = 0; n.room = null; return n; }
  if (sees && (s.mode === 'chase' || n.seen >= noticeTime(sense.d, far) * noticeScale)) {
    n.found = s.mode !== 'chase';
    n.mode = 'chase'; n.since = 0; n.t = 0; n.room = null;
    n.last = { x: sense.me.x, z: sense.me.z, room: sense.me.room };
    return n;
  }
  if (s.mode === 'chase') {
    // round the corner, through the door: for a moment it still knows which way that was
    n.since = s.since + dt;
    if (n.since <= HUNT.after) { n.last = { x: sense.me.x, z: sense.me.z, room: sense.me.room }; return n; }
    n.mode = 'search'; n.t = 0;
    return n;
  }
  if (sense.heard && !(n.spent > 0)) {
    n.mode = 'search'; n.since = 0; n.t = 0; n.room = null;
    n.last = { x: sense.me.x, z: sense.me.z, room: sense.me.room };
    return n;
  }
  if (s.mode === 'search') {
    if (sense.at && !sense.cannot) { n.mode = 'look'; n.t = HUNT.look; }
    return n;
  }
  if (s.mode === 'look') {
    n.t = s.t - dt;
    if (n.t <= 0) { n.mode = 'wander'; n.gaveUp = true; n.t = 0; n.room = null; }
    return n;
  }
  // wandering: a room, a while in it, another room
  if (n.room === null || sense.cannot) {
    const next = wayOn(sense.exits || [], s.from, rnd, s.been);
    if (next === null) { n.room = null; return n; }
    n.room = next; n.arrived = false; n.t = HUNT.linger[0] + (HUNT.linger[1] - HUNT.linger[0]) * rnd();
    return n;
  }
  if (sense.room === n.room && sense.at) n.arrived = true;
  if (n.arrived) {
    n.t = s.t - dt;
    if (n.t <= 0) { n.from = sense.room; n.room = null; n.been = [...s.been.filter((r) => r !== sense.room), sense.room].slice(-HUNT.trail); }
  }
  return n;
}

/** Which room to wander into next: any of them, but rather through a door somebody has shut, rather not back the way it came, and rather somewhere it has not just been. */
export function wayOn(exits, from, rnd = Math.random, been = []) {
  if (!exits.length) return null;
  // the longer ago it was in a room, the more it would like another look; one it does not remember at all, most
  const fresh = (room) => { const i = been.lastIndexOf(room); return i < 0 ? 4 : 0.5 + (been.length - 1 - i) * 0.25; };
  const weight = (e) => (e.shut ? HUNT.shutPull : 1) * (e.room === from && exits.length > 1 ? HUNT.stale : 1) * (been.length ? fresh(e.room) : 1);
  let total = 0;
  for (const e of exits) total += weight(e);
  let roll = rnd() * total;
  for (const e of exits) { roll -= weight(e); if (roll < 0) return e.room; }
  return exits[exits.length - 1].room;
}

/** At a shut door: nothing done yet. */
export function atHandle() { return { t: 0, next: 0.35 }; }
/**
 * One moment at the handle of a shut door.
 * @param h        what atHandle() or the last call gave
 * @param watched  somebody is looking at the door (from either side)
 * @returns {{t, next, rattle:boolean, open:boolean}}  rattle: you hear it this moment · open: the door is open
 */
export function handle(h, dt, watched, holdTime = HUNT.door) {
  if (watched) return { t: h.t, next: h.next, rattle: false, open: false };
  const t = h.t + dt;
  let next = h.next - dt, rattle = false;
  if (next <= 0) { rattle = true; next = HUNT.rattle; }
  return { t, next, rattle, open: t >= holdTime };
}

/** Will it bother getting down to look, this time you have crawled away from it? (Rolled once, when you go through.) */
export function willPeek(rnd = Math.random) { return rnd() < HUNT.peek; }

/**
 * Is this the moment for it to be lying at the hole?
 * @param o  { since: seconds since you crawled through · d: how far from the hole you are · turned: seconds your back has been to the hole ·
 *             there: it has got to its side of the hole · room: there is floor for it to lie on }
 */
export function getsDown(o) {
  return !!o.there && !!o.room && o.since <= HUNT.peekWithin && o.d >= HUNT.peekGap[0] && o.d <= HUNT.peekGap[1] && o.turned >= HUNT.peekTurned;
}

/**
 * One moment of lying at the hole.
 * @param p     { t: seconds down so far, seen: seconds it has been looked at, away: seconds since it was last looked at (once it has been) }
 * @param seen  it is on your screen
 * @returns {{t, seen, away, shock:boolean, up:boolean}}  shock: you have just seen it there · up: it gets up now (only ever while you are not looking)
 */
export function lying(p, dt, seen) {
  const n = { t: p.t + dt, seen: p.seen + (seen ? dt : 0), away: seen ? 0 : p.seen > 0 ? p.away + dt : 0, shock: seen && p.seen === 0, up: false };
  n.up = !seen && ((n.seen > 0 && n.away >= HUNT.peekSeen) || (n.seen === 0 && n.t >= HUNT.peekFor));
  return n;
}
