// The Backrooms — the thin place, and the marks people left on walls looking
// for it. Pure.
//
// You got in by leaning on a wall that was not as solid as the rest, and that
// is the only way anybody gets out. On every floor one stretch of wall is the
// place where the building would be thin — an outside wall, near the fire
// exit, with nothing behind it on the plan. On every floor but the last it is
// only a wall. On the last it gives.
//
// Somebody was here before and knew that much. They marked the walls they
// tried: an outline in painter's tape, most of it let go since; a pencilled
// door; a tally. What people left is made by hand and is mostly right: the
// wall that gives is the one somebody taped a door on at the very bottom of
// the last fire stairs, made camp beside, and gave up on (stairwell.js); a
// failed attempt elsewhere is rare and says so (NOT HERE, WRONG WAY). What
// the place makes is an imitation: on some floors the wall the plan would
// have called thin (`thin`: an outside wall near the fire exit) has a taped
// door printed into its paper, flat, and again one repeat along. That one is
// a lie. Every marked wall answers being leaned on, one way or the other,
// well inside a second (thin.js).
import { T, SIDES, wallSpans, wallPoint, toWorld } from './frame.js';

/** The fewest doorways between where you land on the last floor and the wall that gives. */
export const MIN_OUT_STEPS = 8;
/** How wide the stretch is that gives, and how much plain wall a mark wants round it, metres. */
export const THIN_W = 1.2, MARK_W = 1.9;

/** How long the wall has to be leaned on, seconds: what the one upstairs took. */
export const LEAN = 1.15;
/**
 * Leaning, as a rule on its own: `held` seconds so far, this frame's `dt`, and whether a body is pressed against the
 * stretch and still pushing. Let go and it is forgotten twice as fast as it was earned. → the new held time; you are
 * through when that reaches LEAN.
 */
export function lean(held, dt, pressed) { return pressed ? held + dt : Math.max(0, held - dt * 2); }
/** Is a body `d` metres from the wall and `along` it from the middle of a stretch `w` wide, pushing `into` it (0…1) and moving at `speed` m/s, leaning on it? */
export function pressing(d, along, w, into, speed) { return d < 0.34 && Math.abs(along) < w / 2 && into > 0.55 && speed < 0.6; }

/** How long a wall that is only a wall takes to say so, seconds: sooner than the other kind takes to give. */
export const REFUSE = 0.42;
/**
 * What a marked wall does about being leaned on, for `held` seconds so far. Pure.
 * A wall that gives: { open: 0…1 } — how far the taped door has let the daylight round its edges, from the first
 * instant. A wall that is only a wall: { knock: true } once, REFUSE seconds in (`said`: it has answered this lean
 * already; let go altogether and it will answer the next one).
 */
export function answer(gives, held, said = false) {
  if (gives) return { open: held <= 0 ? 0 : Math.min(1, 0.18 + 0.82 * (held / LEAN)), through: held >= LEAN };
  return { knock: !said && held >= REFUSE, said: held > 0 && (said || held >= REFUSE) };
}

const inRect = (p, r) => p.x >= r.x0 && p.x < r.x1 && p.z >= r.z0 && p.z < r.z1;

/** How far behind the wall that gives the middle of the floor has to be for the look back to take in the floor, metres (leaving.js). */
export const THIN_BEHIND = 4;
/** The middle of everything built on a floor: { x, z } in the world. */
export function middle(rooms) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const r of rooms) { x0 = Math.min(x0, r.x); x1 = Math.max(x1, r.x + r.w); z0 = Math.min(z0, r.z); z1 = Math.max(z1, r.z + r.d); }
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
}

/** Is there nothing built behind this stretch of a room's wall — no other room, and nobody's view? */
function outside(rooms, room, side, at, w) {
  for (let k = -0.5; k <= 0.5001; k += 0.25) for (const off of [-(T + 0.4), -(T + 1.5)]) {
    const l = wallPoint(room, side, at + k * w, off), p = toWorld(room, l.x, l.z);
    for (const r of rooms) {
      if (inRect(p, { x0: r.x, z0: r.z, x1: r.x + r.w, z1: r.z + r.d })) return false;
      if (r.halo && inRect(p, r.halo)) return false;
    }
  }
  return true;
}

/** Is there something built in the room in front of this stretch of its wall, so that nobody could stand at it? */
function blocked(room, side, at, need) {
  for (let k = -0.5; k <= 0.5001; k += 0.125) for (const off of [0.25, 0.6]) {
    const p = wallPoint(room, side, at + k * need, off);
    for (const q of room.pillars || []) if (!(q.y0 > 0.62) && Math.abs(p.x - q.x) < q.w / 2 + 0.3 && Math.abs(p.z - q.z) < q.d / 2 + 0.3) return true;
    for (const q of room.blocks || []) if (p.x > q.x0 - 0.3 && p.x < q.x1 + 0.3 && p.z > q.z0 - 0.3 && p.z < q.z1 + 0.3) return true;
  }
  return false;
}

/** Where on a room's walls a mark `need` metres wide could go: [{ side, at }], at most one to a wall (the middle of its longest free stretch). */
function places(rooms, room, need, outer) {
  const out = [];
  for (const side of SIDES) {
    let best = null;
    for (const [a, b] of wallSpans(room, side, 0.4, 2.2)) {
      if (b - a < need || (best && best.len >= b - a)) continue;
      // along the stretch a quarter of a metre at a time, from its middle outward: the first place that will do
      const mid = (a + b) / 2, reach = (b - a - need) / 2;
      search: for (let d = 0; d <= reach + 1e-6; d += 0.25) for (const s of d ? [-1, 1] : [1]) {
        const at = Math.round((mid + s * d) * 100) / 100;
        if (blocked(room, side, at, need)) continue;                       // (a pier or a partition stands in front of it: quiet.js)
        if (!outer || outside(rooms, room, side, at, need)) { best = { side, at, len: b - a }; break search; }
      }
    }
    if (best) out.push({ side: best.side, at: best.at });
  }
  return out;
}

/**
 * The stretch of wall that would give. A plain room you can stand up in, at least MIN_OUT_STEPS doorways from the
 * landing, and as near the fire exit as there is one — the place its signs have been leading to all along is the
 * place to start looking.
 * `taken(room)`: rooms that are spoken for (something an earlier visitor left is in them: gen.js).
 * @returns {{room:number, side:string, at:number, w:number}|null}  in that room's own frame; null: this floor has no such wall
 */
export function thinPlace(rooms, R, taken = () => false) {
  const options = [];
  for (const room of rooms) {
    if (room.kind !== 'plain' || room.crawl || room.depth < MIN_OUT_STEPS || room.H < 2.3 || taken(room)) continue;
    const spots = places(rooms, room, MARK_W, true);
    if (spots.length) options.push({ room, spot: R.pick(spots) });
  }
  if (!options.length) return null;
  const near = Math.min(...options.map((o) => o.room.toExit));
  // (a room with a beam across it or a forest of pillars in it hides its walls: only if there is nowhere better)
  const awkward = (r) => (r.shape && (r.shape.kind === 'soffit' || r.shape.kind === 'forest') ? 0.04 : 1);
  // (and a wall with the rest of the floor behind you as you lean on it, for choice: what you see from the far side of
  // it is the floor you were lost on, and from a wall that faces back over the plan most of that is under your feet)
  const mid = middle(rooms);
  const away = ({ room, spot }) => {
    const a = wallPoint(room, spot.side, spot.at, 0), b = wallPoint(room, spot.side, spot.at, -1), A = toWorld(room, a.x, a.z), B = toWorld(room, b.x, b.z);
    return (mid.x - A.x) * (B.x - A.x) + (mid.z - A.z) * (B.z - A.z) < -THIN_BEHIND ? 1 : 0.2;
  };
  // (somewhere further off only now and then: a floor has many plain rooms, and together they would outweigh the near ones)
  const o = R.weighted(options, (k) => (k.room.toExit === near ? 9 : k.room.toExit === near + 1 ? 2 : 0.04) * awkward(k.room) * away(k));
  return { room: o.room.id, side: o.spot.side, at: o.spot.at, w: THIN_W };
}


/**
 * What a person left on a wall, looking for the way out. People's marks are made by hand, sit on the surface, and are
 * mostly right: a failed attempt is rare, and says that it failed.
 *   crossed    a door in tape, crossed out in the same tape, and NOT HERE under it — one to a floor at most, on fewer than half
 *   wrongway   a cross and WRONG WAY, in a room with one doorway: it is a dead end, and somebody has saved you the walk
 * Each is a thing left in a room: { room, type: 'marks', side, at, style, seed }. (What the place itself puts on a wall
 * is another thing altogether — printed, flat, repeating, and a lie: see `thin.print`, and thin.js.)
 */
export const MARK_STYLES = Object.freeze(['crossed', 'wrongway']);
export function decoyMarks(rooms, R, thin, taken = () => false) {
  const able = rooms.filter((r) => (r.kind === 'plain' || r.kind === 'start') && !r.crawl && r.H >= 2.3 && !(thin && r.id === thin.room) && !taken(r));
  const out = [];
  if (R.chance(0.4)) for (const room of R.shuffle(able.filter((r) => r.doors.length > 1))) {
    const spots = places(rooms, room, MARK_W, false);
    if (!spots.length) continue;
    const spot = R.pick(spots);
    out.push({ room: room.id, type: 'marks', side: spot.side, at: spot.at, style: 'crossed', seed: R.int(1, 9999) });
    break;
  }
  // dead ends: on the wall you face as you come in, or whichever wall there is
  for (const room of R.shuffle(able.filter((r) => r.doors.length === 1 && r.kind === 'plain'))) {
    if (out.filter((m) => m.style === 'wrongway').length >= 2) break;
    if (!R.chance(0.55)) continue;
    const spots = places(rooms, room, MARK_W, false), facing = { front: 'back', back: 'front', left: 'right', right: 'left' }[room.doors[0].side];
    if (!spots.length) continue;
    const spot = spots.find((k) => k.side === facing) || R.pick(spots);
    out.push({ room: room.id, type: 'marks', side: spot.side, at: spot.at, style: 'wrongway', seed: R.int(1, 9999) });
  }
  return out;
}
/**
 * What the walls teach, in a sentence. (It is a lesson in the guide's sense, but not one a room teaches, so it is not
 * on gen.js's LESSONS, which is for what rooms may take for granted of each other. No room may take this for granted.)
 */
export const PRINTED = 'what people left is made by hand, sits on the surface, and is mostly right; what the place makes is printed flat into the paper, too regular, repeats — and lies';
/** How often the place fakes a taped door on the wall the plan would have called thin: printed into the paper. */
export const PRINT_CHANCE = 0.45;

/* ---- what is written on a tape (loot.js hangs them; gen.js says which is where) ---------------------- */

// Hand-labelled, mostly. {name}, {agent} and {project} are filled in from the office, as everywhere down here.
export const TAPE_LABELS = [
  ['STAFF PARTY', 'DO NOT TAPE OVER'], ['{NAME}', 'DAY 1'], ['HOW TO LEAVE', 'PART 2 OF 2'], ['FIRE DRILL', '(REAL ONE)'], ['CCTV', 'STAIRWELL · TUES'],
  ['ALL-HANDS', '9 HRS'], ['WEDDING', 'TAPED OVER'], ['SETTING THE CLOCK', '12:00 12:00 12:00'], ['BLANK', '(USED)'], ['EXIT INTERVIEW', '{NAME}'],
  ['WATCH LAST', ''], ['{PROJECT}', 'DEMO · DO NOT DEMO'], ['THIS TAPE', ''], ['{AGENT}', 'RETURN TO OWNER'], ['INDUCTION', 'VOL. 14'], ['HUM', 'SIDE B'],
];
