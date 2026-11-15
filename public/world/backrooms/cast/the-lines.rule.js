// The Backrooms — the lines' rule (cast/the-lines.js), where a test can run it: no three.js, no page.
//
// "It walks only where there is floor, and over anything that has been laid down. Take up what it is standing on."
// It sleeps as a stand of telephone poles a few rooms before the gap (rooms/the-culvert.js). Woken, it does not stop and
// it does not lose you; it is slow wherever it has to fold itself to get through, and slower on a bridge. It cannot
// cross what was never drawn. (The owner: "the monster should spawn 2-4 rooms before the chasm so there is a chase
// scene before a solution is offered"; "squeeze through the hallways".)

/**
 * wake: how near wakes it, seen · rise: seconds of getting up · speed: in the open · tight: folded · onBridge: on something laid
 * reach, again: how near it gets you, and how long before it can again · stun: how long it stands after · falls: seconds of going down
 * before: how many doorways before the gap it sleeps, fewest and most · pole: a leg, metres · spread, high: how it stands in the open
 * low, trail: how it goes folded: its body this far off the floor, its feet this far behind
 */
export const LINES = Object.freeze({ wake: 8, rise: 1.5, speed: 2.45, tight: 1.55, onBridge: 1.25, reach: 1.55, again: 1.7, stun: 1.0, falls: 3,
  before: [2, 4], pole: 3.3, spread: 2.2, high: 1.75, low: 0.62, trail: 1.9, stride: 1.15, step: 0.24, legs: 6, room: 3.6 });

export const asleep = () => ({ mode: 'asleep', t: 0, again: 0, up: 0 });

/**
 * Where it sleeps: a room on the way from the landing to the gap, two to four doorways short of it (fewer if the way is
 * shorter; never the landing itself if there is anything else). way: room ids, landing first, the gap's room last. → a room id.
 */
export function sleepsIn(way, rnd = Math.random) {
  if (!Array.isArray(way) || !way.length) return null;
  const [lo, hi] = LINES.before, last = way.length - 1, want = lo + Math.floor(rnd() * (hi - lo + 1));
  return way[Math.max(Math.min(1, last), last - Math.min(want, last))];
}

/** How folded it has to be, 0 (stood up) to 1 (dragging its poles behind it): by the ceiling, and by walls close on either side. */
export const folded = (headroom, hemmed) => Math.max(hemmed ? 1 : 0, Math.max(0, Math.min(1, (LINES.room - headroom) / 1.2)));

/**
 * One moment of it. s: { mode: 'asleep' | 'rising' | 'hunt' | 'stun' | 'falling' | 'gone', t, again, up }.
 * sense: { d: metres to the visitor, sees, here: the visitor is in its room, floor: there is floor under it, fold: 0…1, bridge: it is on something laid }
 * → the next s, with for this moment only: woke, hit, fell, over, and speed (metres a second; 0: it stands).
 */
export function minds(s, dt, sense) {
  const n = { mode: s.mode, t: s.t, again: Math.max(0, s.again - dt), up: s.up, speed: 0 };
  if (n.mode === 'gone') return n;
  if (n.mode === 'falling') { n.t += dt; if (n.t >= LINES.falls) { n.mode = 'gone'; n.over = true; } return n; }
  if (n.mode === 'asleep') { if (sense.here || (sense.sees && sense.d < LINES.wake)) { n.mode = 'rising'; n.woke = true; } return n; }
  if (!sense.floor) { n.mode = 'falling'; n.t = 0; n.fell = true; return n; }                      // (woken or half up: what it stood on is gone)
  if (n.mode === 'rising') { n.up = Math.min(1, n.up + dt / LINES.rise); if (n.up >= 1) n.mode = 'hunt'; return n; }
  if (n.mode === 'stun') { n.t -= dt; if (n.t <= 0) n.mode = 'hunt'; return n; }
  if (sense.sees && sense.d < LINES.reach && n.again <= 0) { n.hit = true; n.again = LINES.again; n.mode = 'stun'; n.t = LINES.stun; return n; }
  n.speed = sense.bridge ? LINES.onBridge : LINES.speed + (LINES.tight - LINES.speed) * Math.max(0, Math.min(1, sense.fold || 0));
  return n;
}
