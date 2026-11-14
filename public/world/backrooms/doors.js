// The Backrooms — which doorways have doors. Pure: no three.js, no DOM.
// Most of the level's doorways are holes in a wall. A few on every floor are
// hung with a pair of fire doors, the kind an office props open and then puts
// a sign on telling you to keep shut. They stand open. Anybody can shut them
// and open them again, from either side, so a door is never a way of being
// trapped; what it is, is in the way of whatever is behind you (cast/hunt.js),
// and something tall to stand behind while it is open.
// doorleaf.js builds them and works them.
import { makeRng, ARCHETYPES } from './gen.js';

export const DOORS = Object.freeze({
  share: 0.42,       // of the doorways that could have doors, how many do
  least: 3,          // …but this many on a floor, if it has that many doorways for them
  widest: 2.0,       // a pair of leaves covers this much and no more, metres
  lowest: 1.85,      // …and is not hung in anything lower than this
  swing: 0.42,       // seconds from open to shut
  thick: 0.044,      // a leaf, metres
  deep: 1.3,         // floor the room must have beyond the open leaves
});

/** May this doorway have doors, and which of its two rooms would they stand open in? → [room ids], empty for no. */
export function doorRooms(level, link) {
  if (link.kind !== 'door' || link.door) return [];
  const w = link.to - link.from, a = level.rooms[link.a], b = level.rooms[link.b];
  if (w > DOORS.widest + 1e-6 || !(link.h >= DOORS.lowest)) return [];
  if ([a, b].some((r) => r.kind === 'start' || r.kind === 'exit' || r.crawl || r.H < 2.2)) return [];
  if ([a, b].some((r) => r.arch && ARCHETYPES[r.arch] && ARCHETYPES[r.arch].doors === 'own')) return [];          // a room that hangs doors of its own on its doorways
  if ([a, b].some((r) => r.doors.some((d) => d.link === link.id && d.sill > 0.01))) return [];
  // the leaves stand open in a plain room (nobody's set piece is rearranged), and not the one the mascot's plinth is in
  return [a, b].filter((r) => {
    if (r.kind !== 'plain' || (level.pursuer && level.pursuer.room === r.id) || r.shape || r.lows) return false;
    const d = r.doors.find((k) => k.link === link.id), deep = d.side === 'front' || d.side === 'back' ? r.D : r.W;
    return deep >= w / 2 + DOORS.deep;
  }).map((r) => r.id);
}

/**
 * The doors of one floor.
 * @param level  from generate()
 * @returns {{link:number, room:number, other:number, w:number, h:number, tint:number}[]}  link: which doorway · room: the room its leaves
 *          stand open in · other: the room beyond · tint: which of the floor's door colours (0…)
 */
export function doorPlan(level) {
  const R = makeRng(`${level.seed}/doors`), tint = R.int(0, 3);
  const able = level.links.map((link) => ({ link, rooms: doorRooms(level, link) })).filter((k) => k.rooms.length);
  const n = Math.min(able.length, Math.max(DOORS.least, Math.round(able.length * DOORS.share)));
  return R.shuffle(able).slice(0, n).sort((p, q) => p.link.id - q.link.id).map(({ link, rooms }) => {
    const room = rooms.length > 1 ? rooms[makeRng(`${level.seed}/door/${link.id}`).int(0, 1)] : rooms[0];
    return { link: link.id, room, other: link.a === room ? link.b : link.a, w: Math.round((link.to - link.from) * 1000) / 1000, h: link.h, tint };
  });
}

/**
 * Is something in the way of a pair of doors being shut? Positions are in the doorway's own frame: `across` metres from the middle of the
 * opening along the wall, `out` metres from the wall's face into the room the leaves stand in (negative: in the doorway, or beyond it).
 * A body in the doorway, or up against where the leaves meet, stops them; standing in the room, clear of the wall, does not.
 */
export function inTheWay(w, wallT, across, out, r = 0.22) {
  return Math.abs(across) < w / 2 + r && out > -(wallT + r) && out < DOORS.thick + r + 0.04;
}
