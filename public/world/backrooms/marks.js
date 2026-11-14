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
// door; a tally. So the thin place is marked — and so are other walls, which
// are only walls. What tells them apart is not written anywhere (thin.js).
import { T, SIDES, wallSpans, wallPoint, toWorld } from './frame.js';

/** The fewest doorways between where you land on the last floor and the wall that gives. */
export const MIN_OUT_STEPS = 5;
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

const inRect = (p, r) => p.x >= r.x0 && p.x < r.x1 && p.z >= r.z0 && p.z < r.z1;

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
 * @returns {{room:number, side:string, at:number, w:number}|null}  in that room's own frame; null: this floor has no such wall
 */
export function thinPlace(rooms, R) {
  const options = [];
  for (const room of rooms) {
    if (room.kind !== 'plain' || room.crawl || room.depth < MIN_OUT_STEPS || room.H < 2.3) continue;
    const spots = places(rooms, room, MARK_W, true);
    if (spots.length) options.push({ room, spot: R.pick(spots) });
  }
  if (!options.length) return null;
  const near = Math.min(...options.map((o) => o.room.toExit));
  // (a room with a beam across it or a forest of pillars in it hides its walls: only if there is nowhere better)
  const awkward = (r) => (r.shape && (r.shape.kind === 'soffit' || r.shape.kind === 'forest') ? 0.04 : 1);
  const o = R.weighted(options, (k) => (k.room.toExit === near ? 9 : k.room.toExit === near + 1 ? 2 : 0.3) * awkward(k.room));
  return { room: o.room.id, side: o.spot.side, at: o.spot.at, w: THIN_W };
}

const STYLES = ['tape', 'tape', 'tape', 'pencil', 'pencil', 'tally'];

/**
 * The other walls somebody tried: a few to a floor, anywhere a wall is bare. Each is a thing left in a room, like the
 * rest of what is left in rooms: { room, type: 'marks', side, at, style, seed }.
 */
export function decoyMarks(rooms, R, thin) {
  const able = rooms.filter((r) => (r.kind === 'plain' || r.kind === 'start') && !r.crawl && r.H >= 2.3 && !(thin && r.id === thin.room));
  const out = [];
  for (const room of R.shuffle(able)) {
    if (out.length >= 4) break;
    if (!R.chance(out.length < 2 ? 0.9 : 0.4)) continue;
    const spots = places(rooms, room, MARK_W, false);
    if (!spots.length) continue;
    const spot = R.pick(spots);
    out.push({ room: room.id, type: 'marks', side: spot.side, at: spot.at, style: R.pick(STYLES), seed: R.int(1, 9999) });
  }
  return out;
}

/* ---- what is written on a tape (loot.js hangs them; gen.js says which is where) ---------------------- */

// Hand-labelled, mostly. {name}, {agent} and {project} are filled in from the office, as everywhere down here.
export const TAPE_LABELS = [
  ['STAFF PARTY', 'DO NOT TAPE OVER'], ['{NAME}', 'DAY 1'], ['HOW TO LEAVE', 'PART 2 OF 2'], ['FIRE DRILL', '(REAL ONE)'], ['CCTV', 'STAIRWELL · TUES'],
  ['ALL-HANDS', '9 HRS'], ['WEDDING', 'TAPED OVER'], ['SETTING THE CLOCK', '12:00 12:00 12:00'], ['BLANK', '(USED)'], ['EXIT INTERVIEW', '{NAME}'],
  ['WATCH LAST', ''], ['{PROJECT}', 'DEMO · DO NOT DEMO'], ['THIS TAPE', ''], ['{AGENT}', 'RETURN TO OWNER'], ['INDUCTION', 'VOL. 14'], ['HUM', 'SIDE B'],
];
