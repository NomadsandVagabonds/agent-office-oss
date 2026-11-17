// The Backrooms — the dummies' rule (cast/dummies.js), where a test can run it: no three.js, no page.
//
// "Come back into a room you have been in, and one more of them is stood where you stood when you left it, as you stood, facing
// the way you went. They do not move. A room you keep going through fills up; and where you have to go between two of them,
// they have you."
//
// The shopping centre's own (themes.js `mall`): a new way of playing, so a new creature by the owner's rule. It punishes going
// back the same way. It never walls anybody in: none is ever put where a doorway's way through is, and a room holds so many.

/**
 * keep: how far from where the visitor left a room the spot is taken (metres back from the doorway they went by) · door: how far
 * from any doorway's middle one may stand · apart: how far from another · most: in one room · all: on a floor · squeeze: two
 * nearer each other than this, with the visitor between, is a squeeze · reach: how near the line between them the visitor has to
 * be · again: seconds before the same pair can have them again · hurt: hearts
 */
export const DUMMIES = Object.freeze({ keep: 1.1, door: 1.05, apart: 0.75, most: 6, all: 24, squeeze: 1.15, reach: 0.32, again: 3.5, hurt: 1, wall: 0.4 });

export const blank = () => ({ rooms: new Map(), placed: [], last: null, cool: new Map() });

/**
 * Where they stood when they left: the last spot well inside the room on the way out, the pose they had, and the way they were
 * facing. (A spot inside: a step in from the doorway they went by, toward where they came from.)
 * @param trail  [{ x, z, yaw, crouch }] the visitor's last positions in the room, oldest first (room's own frame)
 * @returns {{ x, z, yaw, crouch } | null}
 */
export function leftFrom(trail) {
  if (!trail || !trail.length) return null;
  const end = trail[trail.length - 1];
  for (let i = trail.length - 1; i >= 0; i--) { const p = trail[i]; if (Math.hypot(p.x - end.x, p.z - end.z) >= DUMMIES.keep) return { x: p.x, z: p.z, yaw: end.yaw, crouch: !!end.crouch }; }
  return { x: trail[0].x, z: trail[0].z, yaw: end.yaw, crouch: !!end.crouch };
}

/**
 * May one stand at (x, z) in a room: clear of every doorway by DUMMIES.door, inside by DUMMIES.wall, and not on top of another?
 * room: { W, D, doors: [{ x, z }] } (doorway middles, room frame) · others: [{ x, z }] already in it
 */
export function mayStand(x, z, room, others = []) {
  if (Math.abs(x) > room.W / 2 - DUMMIES.wall || Math.abs(z) > room.D / 2 - DUMMIES.wall) return false;
  if (room.doors.some((d) => Math.hypot(x - d.x, z - d.z) < DUMMIES.door)) return false;
  return !others.some((o) => Math.hypot(x - o.x, z - o.z) < DUMMIES.apart);
}

/**
 * The visitor has come into a room (id) that they have been in before, and left it last time from `spot`: does one more stand
 * there now? Not on the first visit; not past the room's or the floor's share; not where it may not stand.
 * → the next state, and `stood`: the one put down this time, or null.
 */
export function cameBack(s, id, room, spot) {
  const n = { ...s, rooms: new Map(s.rooms), placed: s.placed.slice() }, mine = n.placed.filter((p) => p.room === id);
  const seen = n.rooms.get(id) || 0; n.rooms.set(id, seen + 1);
  if (seen < 1 || !spot || mine.length >= DUMMIES.most || n.placed.length >= DUMMIES.all || !mayStand(spot.x, spot.z, room, mine)) return { s: n, stood: null };
  const stood = { room: id, x: spot.x, z: spot.z, yaw: spot.yaw, crouch: spot.crouch, n: n.placed.length };
  n.placed.push(stood);
  return { s: n, stood };
}

/** How near (x, z) is to the line between a and b, and whether it is between them at all. → distance, or Infinity if not between. */
export function offLine(x, z, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz; if (L2 < 1e-9) return Infinity;
  const t = ((x - a.x) * dx + (z - a.z) * dz) / L2; if (t <= 0.08 || t >= 0.92) return Infinity;
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}

/**
 * Has the visitor, at (x, z) in room id, gone between two of them that stand close? Each pair once in DUMMIES.again seconds.
 * → { s, hit: [i, j] | null } (indices into s.placed)
 */
export function squeezed(s, id, x, z, clock) {
  const here = s.placed.map((p, i) => [p, i]).filter(([p]) => p.room === id);
  for (let a = 0; a < here.length; a++) for (let b = a + 1; b < here.length; b++) {
    const [p, i] = here[a], [q, j] = here[b];
    if (Math.hypot(p.x - q.x, p.z - q.z) > DUMMIES.squeeze) continue;
    if (offLine(x, z, p, q) > DUMMIES.reach) continue;
    const key = i + ':' + j; if (clock - (s.cool.get(key) ?? -1e9) < DUMMIES.again) continue;
    const cool = new Map(s.cool); cool.set(key, clock);
    return { s: { ...s, cool }, hit: [i, j] };
  }
  return { s, hit: null };
}
