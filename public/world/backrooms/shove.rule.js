// The Backrooms — a shove. Pure: no three.js, nothing of the page.
//
// There is nothing down here to fight with, and a shove is not fighting: it is
// two hands out in front, for a moment. It hurts nothing and it ends nothing.
// What it does:
//
//   · whatever is right in front is pushed back a step, if it is the kind of
//     thing that can be pushed (each of the cast says what a push does to it:
//     its own shoveTargets());
//   · and for a moment after — the window — a hit that comes from in front
//     does not land. That is the timing: shove as it reaches you, not before.
//
// It costs breath (the same breath running costs: player.js), and there is a
// second before the next. Out of breath, there is no shove at all. So it is a
// way through a doorway, or one hit turned aside, and never a way of standing
// one's ground.

export const SHOVE = Object.freeze({
  reach: 1.35,             // metres from the visitor to the edge of what is pushed
  minDot: 0.42,            // how far off straight ahead it may be (about 65°, before its own width is allowed for)
  verticalReach: 1.3,      // metres above or below the camcorder
  most: 3,                 // how many things one shove moves
  cooldown: 1.0,           // seconds before the next
  breath: 0.3,             // of a full breath: the fourth in a row is the last of it
  rest: 2.5,               // seconds after a shove before any breath comes back (or standing still would pay for the next)
  push: 1.1,               // metres something is pushed back
  blockReach: 2.6,         // metres: a hit from further off than this is not one a pair of hands turns aside
  blockDot: 0.1,           // …nor one from behind or beside
  // seconds after the shove that a hit from in front does not land: the easier the visit, the longer
  window: Object.freeze({ tourist: 0.5, 'training-wheels': 0.5, easy: 0.45, normal: 0.32, hard: 0.22 }),
});

/** How long a shove turns a hit aside, on this kind of visit. */
export const shoveWindow = (difficulty) => SHOVE.window[difficulty] ?? SHOVE.window.easy;

/** The way the visitor is facing, on the floor (yaw as player.js has it). */
export const facing = (yaw = 0) => ({ x: -Math.sin(yaw) || 0, z: -Math.cos(yaw) || 0 });          // (|| 0: never −0)

/**
 * May they shove now, and what does it cost?
 * @param me  { wind: 0…1 breath left, winded: seconds still out of breath, shoveCool: seconds until the next, frozen? }
 * @returns {{ ok: false } | { ok: true, wind: number, spent: boolean }}  spent: that was the last of their breath
 */
export function tryShove(me) {
  if (!me || me.frozen || me.winded > 0 || me.shoveCool > 0) return { ok: false };
  const wind = Math.max(0, (me.wind ?? 1) - SHOVE.breath);
  return { ok: true, wind, spent: wind <= 0 };
}

/**
 * Is a hit from `from` turned aside? Only while the window is open, from in front, and from near.
 * @param me    { x, z, yaw, shoveT: seconds of the window left }
 * @param from  { x, z } where what is hitting them is — or nothing, when it cannot say (then the window alone decides)
 */
export function blocks(me, from) {
  if (!me || !(me.shoveT > 0)) return false;
  if (!from || !Number.isFinite(from.x) || !Number.isFinite(from.z)) return true;
  const dx = from.x - me.x, dz = from.z - me.z, d = Math.hypot(dx, dz);
  if (d > SHOVE.blockReach) return false;
  if (d < 0.3) return true;
  const f = facing(me.yaw);
  return (f.x * dx + f.z * dz) / d >= SHOVE.blockDot;
}

/**
 * What a shove reaches: in front, near, in a clear line; nearest first.
 * @param me          { x, z, y?, yaw }
 * @param candidates  [{ id?, x, z, y?, r?, shove(dir) }]
 * @param los         (ax, az, bx, bz) => boolean
 */
export function rankShoveTargets(me, candidates = [], los = () => true) {
  if (!me || !Number.isFinite(me.x) || !Number.isFinite(me.z) || !Array.isArray(candidates)) return [];
  const f = facing(me.yaw), half = Math.acos(SHOVE.minDot), hits = [];
  for (const c of candidates) {
    if (!c || typeof c.shove !== 'function' || !Number.isFinite(c.x) || !Number.isFinite(c.z)) continue;
    const r = Math.max(0, c.r ?? 0.3), dx = c.x - me.x, dz = c.z - me.z, dist = Math.hypot(dx, dz), edge = Math.max(0, dist - r);
    if (edge > SHOVE.reach) continue;
    if (c.y !== undefined && Number.isFinite(me.y) && Math.abs(c.y - me.y) > SHOVE.verticalReach) continue;
    if (dist > 0.28 && (f.x * dx + f.z * dz) / dist < Math.cos(Math.min(Math.PI * 0.85, half + Math.atan2(r + 0.1, dist)))) continue;
    if (!los(me.x, me.z, c.x, c.z)) continue;
    hits.push({ c, edge });
  }
  return hits.sort((a, b) => a.edge - b.edge).map((h) => h.c);
}

/**
 * Shove: everything in reach is told, nearest first, the way it is being pushed. → the ids of what was moved by it.
 * (What does not move — too heavy, or not the moment — says so by returning nothing.)
 */
export function strikeShove(me, candidates = [], los = () => true) {
  const dir = facing(me.yaw), moved = [];
  for (const c of rankShoveTargets(me, candidates, los)) {
    if (moved.length >= SHOVE.most) break;
    let did = false;
    try { did = c.shove(dir); } catch { did = false; }
    if (did) moved.push(c.id || 'something');
  }
  return moved;
}

/**
 * Where something pushed from `at` comes to rest: as far along `dir` as there is floor for, up to `far`.
 * @param clear  (x0, z0, x1, z1) => may it go from the one to the other?
 * @returns {{x:number, z:number}|null}  null: it is against something, and stays where it is
 */
export function slide(at, dir, clear, far = SHOVE.push) {
  for (const k of [1, 0.7, 0.4, 0.2]) {
    const x = at.x + dir.x * far * k, z = at.z + dir.z * far * k;
    if (clear(at.x, at.z, x, z)) return { x, z };
  }
  return null;
}
