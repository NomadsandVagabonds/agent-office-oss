// The hallway that is not sure where it leads — its rule, and its plan. Pure.
//
// Three rooms in a row, in one: the room you come into, a hallway out of the
// far side of it, and a room at the hallway's other end that goes nowhere.
// The first of the three is not one room but three, taking turns:
//
//   through   the room you walked through: the doorway you came in by is in it
//   dead      a room with no way out of it but the hallway. The doorway is gone
//             (you know it was there: you came through it)
//   on        the room with the way on in it: a doorway that was never there
//             before, and the fire exit beyond it
//
// It is the next one whenever nobody is looking at it and nobody is in it:
// once per look away, and only after it has been looked at again. Look back
// and it is a dead end; look away, look back, and it is the way out; again,
// and it is the room you came through, so that nothing is ever lost down
// there. It does not turn at all until the visitor is in the hallway or the
// room beyond: from anywhere else it is only ever the room it was.
//
// This is not paint. The two doorways are real doorways to real rooms, and
// they are opened and shut with the room (world.throats), for the visitor and
// for everything else that walks.
//
// And it does not wait for anything. Whatever is standing in the room when it
// goes, goes with it, and whatever was put down in it: they are in that room,
// wherever it now is, and are there when it comes round again (the owner:
// "If an enemy is in a room it gets warped away with the room. The backrooms
// lore is not nice and considerate and waiting to make its changes."). The
// one thing it does not take is the visitor, who has to be somewhere else for
// it to turn at all.

/** How long nobody has to have been looking, seconds: a glance at your feet is not long enough, turning round is. */
export const AWAY = 0.4;

/** What the room at the end is, in the order it comes round. */
export const ROOMS = Object.freeze(['through', 'dead', 'on']);

/** Which of its two doorways each of them has. `in`: the one the whole thing is entered by. `on`: the one the way out is beyond. */
export const DOORWAYS = Object.freeze({
  through: Object.freeze({ in: true, on: false }),
  dead: Object.freeze({ in: false, on: false }),
  on: Object.freeze({ in: false, on: true }),
});

/**
 * How it is laid out, metres, in the room's own frame (it is entered by the middle of its front wall, +z):
 * end — how deep the room at the front is (the one that turns) · view — how deep the room at the back is (where it is
 * watched from) · half — half the hallway's width · column — the side of the square column in the middle of the room at
 * the back, which is what a walk round the room goes round
 */
export const PLAN = Object.freeze({ end: 6, view: 5.6, half: 1.25, column: 1.1 });

/**
 * Where its parts are, for a room W wide and D deep.
 * @returns {{zEnd:number, zView:number, hall:number, on:number, column:{x:number, z:number, s:number}}}
 *          zEnd: where the room at the front stops and the hallway begins · zView: where the hallway stops and the room at
 *          the back begins · hall: how long the hallway is · on: where along a side wall the way on is (the middle of the
 *          room at the front) · column: the column's middle and side
 */
export function partsOf(room) {
  const zEnd = room.D / 2 - PLAN.end, zView = -room.D / 2 + PLAN.view;
  return { zEnd, zView, hall: zEnd - zView, on: room.D / 2 - PLAN.end / 2, column: { x: 0, z: -room.D / 2 + PLAN.view / 2, s: PLAN.column } };
}

/** Before anybody has come near: the room you will walk through, and nothing owed. */
export const settled = () => ({ face: 0, away: 0, seen: false });

/**
 * One moment of it.
 * @param s    what settled() or the last call gave
 * @param dt   seconds since
 * @param now  { watched, inside, near }
 *        watched  is any of the room at the front on the visitor's screen, and not behind a wall?
 *        inside   is the visitor in it, or in one of its doorways?
 *        near     is the visitor in the hallway or the room at the back (the only places it turns for)?
 *        (Nothing else is asked. What else is in the room is not a reason to wait: it goes with the room.)
 * @param n    how many rooms it is (ROOMS)
 * @returns {{face:number, away:number, seen:boolean, turned:boolean}}  face: which of ROOMS · turned: it changed this moment
 */
export function unsure(s, dt, now, n = ROOMS.length) {
  // looked at, or walked into: it is known, and it stays as it is for as long as that lasts
  if (now.watched || now.inside) return { face: s.face, away: 0, seen: true, turned: false };
  // the visitor is somewhere else altogether: nothing happens, and nothing is forgotten
  if (!now.near) return { face: s.face, away: 0, seen: s.seen, turned: false };
  const away = s.away + dt;
  if (s.seen && away >= AWAY && n > 1) return { face: (s.face + 1) % n, away: 0, seen: false, turned: true };
  return { face: s.face, away, seen: s.seen, turned: false };
}
