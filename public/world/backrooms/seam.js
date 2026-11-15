// The Backrooms — the seams. Pure: no three.js, no DOM.
//
// A visit is one building. It is generated in parts (plan.js: three to five
// of them, each a different kind of place), and under the fire door at the
// far end of every part but the last there is a way down into the next: not
// a cut and not a level, something you do with your feet and cannot undo.
//
//   stairs   concrete stairs that run out onto the back of somebody's ceiling
//   hole     the corridor behind the door has lost the middle of its floor
//   ledge    the corridor behind the door stops, and the building carries on below it
//   chute    a duct in the wall, big enough to get into, that only goes one way
//
// The next part is built while you are still walking toward the door, and it
// is hung in the same picture: its landing spot directly under the place you
// drop from, GAP below it. This file is where both builders (stairwell.js,
// index.js) get that geometry from, so that what you see down the hole is the
// room you land in.
import { RISE, RUN, toWorld } from './frame.js';

/** The ways down, as plan.js deals them. ('wall' is the other thing a part can end in: the way out, on the last.) */
export const WAYS = Object.freeze(['stairs', 'hole', 'ledge', 'chute']);
export const goesDown = (way) => WAYS.includes(way);
/**
 * The ways down a visit is dealt (plan.js): every one but the stairs. The owner, twice: a level that is got to by a
 * door, a button and a flight of stairs is a video game's. This is one building, and one goes further into it by
 * falling through it, climbing down it or sliding. (The stairs are still a way the place can be built: the last
 * part's fire exit is the short stairwell with the wall at the bottom, and a part can be asked for with a flight.)
 */
export const DEALT = Object.freeze(WAYS.filter((way) => way !== 'stairs'));

/**
 * Is somebody pushing the bar? Walking, on the room's side of the door, within arm's length of it, across its width and
 * facing it. (`me`: the visitor in the stairwell's own frame, as a room's tick is given them; the door is in its +z wall
 * at z = door.z, and yaw 0 looks along −z, at the door from outside.) Pure, for the tests.
 */
export function pushes(me, door) {
  return !me.inside && !!me.moving && Math.abs(me.x - door.c) < door.w / 2 + 0.05 && me.z > door.z && me.z < door.z + 0.6 && Math.cos(me.yaw) > 0.35;
}

/** Metres from the floor you drop off to the floor you land on: a storey, the thickness of a slab, and whatever is kept in between. */
export const GAP = 6.4;

/** The fire stairs: how far in the landing ends, how many stairs there are, where they stop (the room's own frame; D: its depth). */
export function flight(D, down) {
  const zF = D / 2, zL = zF - (down ? 1.3 : 3.0), n = down ? 16 : 6;
  return { zF, zL, n, yB: -n * RISE, zB: zL - n * RUN, back: down ? -D / 2 : zL - n * RUN };
}
/** The hole in the corridor floor: [x0, z0, x1, z1] in the room's frame. */
export const holeIn = (W, D) => [-Math.min(0.85, W / 2 - 0.45), -D / 2 + 1.0, Math.min(0.85, W / 2 - 0.45), -D / 2 + 2.9];
/** Where the corridor's floor stops (z, in the room's frame): everything further in than this is air. */
export const ledgeAt = (D) => D / 2 - 3.6;
/** The duct: its mouth in a partition at z = wall, sloping down to an open end. { wall, half, top, z1, y1 } */
export const ductIn = (D) => ({ wall: D / 2 - 2.6, half: 0.5, top: 1.0, z1: -D / 2 + 1.2, y1: -2.2 });

/**
 * Where somebody leaves a part, in the frame of its last room: the point they drop from and the height of the floor
 * (or of what passes for it) there. → { x, z, y }
 */
export function dropOf(room) {
  const { W, D } = room;
  if (room.way === 'hole') { const h = holeIn(W, D); return { x: 0, z: (h[1] + h[3]) / 2, y: 0 }; }
  if (room.way === 'ledge') return { x: 0, z: ledgeAt(D) - 1.2, y: 0 };
  if (room.way === 'chute') { const d = ductIn(D); return { x: 0, z: d.z1 - 0.5, y: d.y1 }; }
  const f = flight(D, true);
  return { x: 0, z: (f.back + f.zB) / 2, y: f.yB };
}

/**
 * Where the next part hangs in this one's coordinates: add this to a point of the next part to get where it is drawn
 * while you are still up here. Its landing spot comes out directly under this part's drop, GAP below it.
 */
export function hangBelow(level, next) {
  const room = level.rooms[level.exit.room], d = dropOf(room), at = toWorld(room, d.x, d.z);
  const land = next.rooms[next.start.room];
  return { x: at.x - next.start.x, y: (room.y || 0) + d.y - GAP - (land.y || 0), z: at.z - next.start.z };
}
