// The hallway that is not sure where it leads — its rule. Pure.
//
// An open hallway, and a room at the end of it. While nobody is looking at
// the room and nobody is in it, it is swapped for the next one: two to four
// of them, in a fixed order that comes back round to the first. Once per
// look away, and only after it has been looked at again: look away, look
// back, a room you have never been in; look away, look back, another; and
// in the end the one you came from.

/** How long nobody has to have been looking, seconds: a glance at your feet is not long enough, turning round is. */
export const AWAY = 0.4;

/** Before anybody has come near: the first room, and nothing owed. */
export const settled = () => ({ face: 0, away: 0, seen: false });

/**
 * One moment of it.
 * @param s         what settled() or the last call gave
 * @param dt        seconds since
 * @param watched   is any of the far end on somebody's screen, and not behind a wall?
 * @param occupied  is anybody (or anything that walks) standing in the far end?
 * @param n         how many rooms it has
 * @returns {{face, away, seen, turned:boolean}}  turned: it changed this moment
 */
export function unsure(s, dt, watched, occupied, n) {
  if (watched || occupied) return { face: s.face, away: 0, seen: s.seen || watched, turned: false };
  const away = s.away + dt;
  if (s.seen && away >= AWAY && n > 1) return { face: (s.face + 1) % n, away: 0, seen: false, turned: true };
  return { face: s.face, away, seen: s.seen, turned: false };
}
