// The floor after the landing is never empty of something that can follow
// you. The mascot's plinth is still dealt once per visit; below the first
// floor he may already be walking, whether or not you found that plinth.
// Pure placement rules. The creature checks the actual furniture afterwards.
import { makeRng, roomDistances, toWorld } from '../gen.js';

export const ROAMING = Object.freeze({ tall: 1.62, doors: 3, near: 9, grace: 12 });

/** Keep the first floor's original deal, and honour a deliberately quiet dev/replay visit. */
export const roamsThisFloor = (level, visit) => !!visit && visit.mascot !== null && level.depth >= 1;

/**
 * Safe rooms to try, in seeded order: ordinary full-height rooms, a few doors
 * in, with somewhere to walk. Prefer the way onward over deep dead ends.
 * A low doorway near the landing must not strand the floor's only pursuer
 * in that landing: it starts beyond those openings, in the maze itself.
 * cost is the live walker's doorway rule when the building is available.
 */
export function roamingRooms(level, cost = (d, from, to) => d.h >= ROAMING.tall && !level.rooms[to].crawl && level.rooms[to].H >= ROAMING.tall + .05 ? 1 : Infinity) {
  const from = roomDistances(level, level.start.room), to = roomDistances(level, level.exit.room);
  const length = from.get(level.exit.room) ?? 0;
  const pool = level.rooms.filter(r => r.kind === 'plain' && !r.crawl && !r.shape && !r.lows && r.H >= 2.2
    && r.id !== level.exit.room && (from.get(r.id) ?? 0) >= ROAMING.doors
    && r.doors.some(d => cost(d, r.id, d.to) < Infinity));
  const R = makeRng(`${level.seed}/roaming/pirate`), out = [];
  while (pool.length) {
    const room = R.weighted(pool, r => {
      const steps = from.get(r.id), detour = Math.max(0, steps + (to.get(r.id) ?? length) - length);
      return (steps <= 6 ? 4 : 1) / (1 + detour * 2);
    });
    out.push(room.id); pool.splice(pool.indexOf(room), 1);
  }
  return out;
}

/** Room centres often hold desks. Try the floor round them too, clear of the walls. */
export function roamingSpots(level, id) {
  const r = level.rooms[id], spots = [];
  for (let z = -r.D / 2 + .55; z <= r.D / 2 - .55; z += .7) {
    for (let x = -r.W / 2 + .55; x <= r.W / 2 - .55; x += .7) spots.push(toWorld(r, x, z));
  }
  return makeRng(`${level.seed}/roaming/pirate/${id}`).shuffle(spots);
}
