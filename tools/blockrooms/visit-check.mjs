// BlockRooms — the book's look at a visit's route (core/trail.mjs) against the building it was in. The same building
// is built here from its seed and difficulty (the layout depends on nothing else: plan.js), and the route is held up
// to it: inside the rooms, from one room only into one it is joined to, no faster than a body can go, through every
// part in order, and out where the way out is. It cannot see everything (that a visitor was hurt, say, or what they
// carried), but a route made up, or walked through walls, or at a speed nobody can walk, does not fit.
//
// → { ok: true, verdict: 'ok' } or { ok: true, verdict: 'flag', why: [...] } or { ok: false, why } for no route at all.
// A flag is not a refusal: the book keeps the visit and says why it looked wrong, for whoever judges a prize.
import { readTrail } from '../../core/trail.mjs';

export const ROUTE = Object.freeze({
  margin: 1.2,        // metres outside a room's walls a sample may be (a doorway, a stair, half a metre of rounding)
  step: 9,            // metres in one second, more than any run, slide or push carries anybody
  leap: 40,           // metres in one second that nothing in the building does, ever
  outside: 0.08,      // of the samples on a part, the share that may be in no room (a lift, a fall, a room that moves)
  fast: 0.03,         // the share of steps that may be faster than `step` (a flume, a drop, a door that takes you)
  jumps: 0.04,        // the share of room-to-room steps that may join rooms not joined within two doors
  count: [0.75, 1.1], // samples, against the seconds the visit says it took (pauses are not play, and not sampled)
});

const cache = new Map();
async function building(seed, difficulty) {
  const k = `${seed}|${difficulty || ''}`;
  if (cache.has(k)) return cache.get(k);
  const { planVisit, floorOf } = await import('../../public/world/backrooms/plan.js');
  const plan = planVisit(seed, difficulty ? { difficulty } : {}), parts = [];
  for (let d = 0; d < plan.depths; d++) parts.push(floorOf(plan, d));
  const made = { depths: plan.depths, parts };
  if (cache.size > 64) cache.delete(cache.keys().next().value);
  cache.set(k, made);
  return made;
}

/**
 * Which rooms of a part a point could be in (each room's footprint in the part's own metres is x..x+w by z..z+d,
 * expanded by `margin`): more than one where rooms at different heights share ground (a stair, a mezzanine), none
 * if it is in no room.
 */
function roomsAt(part, x, z, margin = ROUTE.margin) {
  const out = [];
  for (const r of part.rooms) if (x >= r.x - margin && x <= r.x + r.w + margin && z >= r.z - margin && z <= r.z + r.d + margin) out.push(r.id);
  return out;
}
/** Rooms within two doors of each other, for each room of a part. */
function nearness(part) {
  const next = new Map(part.rooms.map((r) => [r.id, new Set([r.id])]));
  for (const l of part.links || []) { next.get(l.a)?.add(l.b); next.get(l.b)?.add(l.a); }
  const two = new Map();
  for (const [id, one] of next) { const s = new Set(one); for (const o of one) for (const p of next.get(o) || []) s.add(p); two.set(id, s); }
  return two;
}

export async function checkVisit(run, trailText) {
  const trail = readTrail(trailText);
  if (!trail || !trail.length) return { ok: false, why: 'This visit has no route to check.' };
  let made;
  try { made = await building(run.seed, run.difficulty); } catch { return { ok: true, verdict: 'flag', why: ['the building could not be rebuilt here'] }; }
  const why = [];
  const [lo, hi] = ROUTE.count;
  if (trail.length < run.seconds * lo - 5 || trail.length > run.seconds * hi + 5) why.push(`${trail.length} samples for ${run.seconds} s`);
  // the parts, in order, each once, from the first to the last
  const seen = [];
  for (const s of trail) if (seen[seen.length - 1] !== s.d) seen.push(s.d);
  const of = Math.min(run.parts.of, made.depths);
  if (seen[0] !== 0) why.push(`began on part ${seen[0]}`);
  for (let i = 1; i < seen.length; i++) if (seen[i] !== seen[i - 1] + 1) why.push(`part ${seen[i - 1]} to part ${seen[i]}`);
  if (seen[seen.length - 1] !== of - 1) why.push(`ended on part ${seen[seen.length - 1]} of ${of}`);
  // each part on its own: inside its rooms, joined rooms only, no faster than a body, and off it where its way out is
  for (const d of new Set(seen)) {
    const part = made.parts[d]; if (!part) { why.push(`no part ${d}`); continue; }
    const on = trail.filter((s) => s.d === d), near = nearness(part);
    let outside = 0, fast = 0, leaps = 0, jumps = 0, moves = 0, prev = null, prevRooms = [];
    for (const s of on) {
      const rooms = roomsAt(part, s.x, s.z);
      if (!rooms.length) outside++;
      if (prev) {
        const dist = Math.hypot(s.x - prev.x, s.z - prev.z);
        if (dist > ROUTE.leap) leaps++; else if (dist > ROUTE.step) fast++;
        // from the rooms it might have been in to the rooms it might be in now: joined (within two doors) by any pair
        if (rooms.length && prevRooms.length && !rooms.some((r) => prevRooms.includes(r))) {
          moves++;
          if (!rooms.some((r) => prevRooms.some((q) => near.get(q)?.has(r)))) jumps++;
        }
      }
      prev = s; if (rooms.length) prevRooms = rooms;
    }
    if (outside > Math.max(2, on.length * ROUTE.outside)) why.push(`part ${d}: ${outside} of ${on.length} samples in no room`);
    if (leaps) why.push(`part ${d}: ${leaps} leap${leaps > 1 ? 's' : ''} of over ${ROUTE.leap} m in a second`);
    if (fast > Math.max(2, on.length * ROUTE.fast)) why.push(`part ${d}: ${fast} steps faster than anybody goes`);
    if (jumps > Math.max(1, moves * ROUTE.jumps)) why.push(`part ${d}: ${jumps} of ${moves} moves between rooms that are not joined`);
    const last = on[on.length - 1], exitNear = near.get(part.exit.room) || new Set([part.exit.room]);
    const lastRooms = roomsAt(part, last.x, last.z, ROUTE.margin * 2);
    if (!lastRooms.some((r) => exitNear.has(r))) why.push(`part ${d}: left from room ${lastRooms.join('/') || 'none'}, not by the way out (room ${part.exit.room})`);
  }
  return why.length ? { ok: true, verdict: 'flag', why } : { ok: true, verdict: 'ok' };
}
