// The Backrooms — a room's own frame, and the shape of its floor and ceiling.
// Pure, and a leaf: nothing here knows how a floor is laid out or what is in
// it, only how to say where things are in a room once there is one.
//
// Every room has a local frame: x across, z deep, centred on the room, and the
// doorway you are meant to arrive through is in the +z wall (the "front").
// `rot` quarter-turns that frame into the world, so the builders (rooms.js)
// never need to know which way a room ended up facing.

export const T = 0.2;                  // wall thickness, metres
export const WALL_H = 2.6;             // the usual ceiling
export const DOOR_H = 2.05;            // top of an ordinary doorway
export const TILE = 0.6;               // ceiling tile
export const RISE = 0.1625, RUN = 0.28; // one stair: up, and along

/* ---- the local frame ----------------------------------------------------------- */

const COS = [1, 0, -1, 0], SIN = [0, 1, 0, -1];
export const SIDES = ['front', 'right', 'back', 'left'];          // local walls, in turning order from +z
export function toWorld(room, lx, lz) {
  const c = COS[room.rot], s = SIN[room.rot];
  return { x: room.cx + lx * c + lz * s, z: room.cz - lx * s + lz * c };
}
export function toLocal(room, x, z) {
  const c = COS[room.rot], s = SIN[room.rot], dx = x - room.cx, dz = z - room.cz;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}
/** Length of a local wall: front/back run across (W), left/right run deep (D). */
export const wallLength = (room, side) => (side === 'front' || side === 'back' ? room.W : room.D);

/* ---- heights: the shape of a room's floor and ceiling ------------------------------
   Rooms are not all flat boxes. A room may sit a few steps above its neighbour (the
   lower one gets the stairs, inside, rising to the doorway), and a plain room may have
   a `shape`: a sunken pit, a dais, a stepped or sloping ceiling, a beam to duck under,
   a staircase that goes nowhere, a pinched waist, a corner filled in. These functions
   are the one definition of that geometry: world.js walks by them, rooms are built to
   match them. All take a point in the room's own frame.                               */

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const r4 = (v) => Math.round(v * 10000) / 10000;
/** For a point: how far into the room it is from a wall (negative: inside the wall), and where along it. */
export function wallFrame(room, side, x, z) {
  if (side === 'front') return { d: room.D / 2 - z, c: x };
  if (side === 'back') return { d: z + room.D / 2, c: x };
  if (side === 'left') return { d: x + room.W / 2, c: z };
  return { d: room.W / 2 - x, c: z };
}
/** A point on a wall: `at` along it, `off` metres into the room. */
export function wallPoint(room, side, at, off = 0) {
  if (side === 'front') return { x: at, z: room.D / 2 - off };
  if (side === 'back') return { x: at, z: -room.D / 2 + off };
  if (side === 'left') return { x: -room.W / 2 + off, z: at };
  return { x: room.W / 2 - off, z: at };
}
/** Height of the floor above the room's own level. */
export function floorAt(room, x, z) {
  for (const dr of room.doors) {                       // stairs up to a doorway that is higher than this room
    if (!(dr.sill > 0.01)) continue;
    const f = wallFrame(room, dr.side, x, z);
    if (Math.abs(f.c - dr.c) > dr.w / 2 + 1e-9) continue;
    if (f.d < 0) return dr.sill;
    const n = Math.round(dr.sill / RISE), i = Math.floor(f.d / RUN);
    if (i < n - 1) return r4(dr.sill - (dr.sill / n) * (i + 1));
  }
  const s = room.shape;
  if (!s) return 0;
  if (s.kind === 'pit' || s.kind === 'dais') {
    const inside = Math.min(s.w / 2 - Math.abs(x - s.x), s.d / 2 - Math.abs(z - s.z));
    if (inside <= 0) return 0;
    return r4((s.kind === 'pit' ? -1 : 1) * Math.min(s.n, Math.floor(inside / 0.3 + 1e-9) + 1) * RISE);
  }
  if (s.kind === 'stairs') {
    const f = wallFrame(room, s.side, x, z);
    if (Math.abs(f.c - s.c) <= s.w / 2 && f.d >= 0 && f.d < s.n * RUN) return r4((s.n - Math.floor(f.d / RUN)) * RISE);
  }
  return 0;
}
/** Height of the ceiling above the room's own level. */
export function ceilAt(room, x, z) {
  const s = room.shape;
  if (!s) return room.H;
  if (s.kind === 'stepceil') return ((s.axis === 'x' ? x : z) - s.at) * s.dir > 0 ? s.h2 : s.h1;
  if (s.kind === 'slopeceil') { const len = s.axis === 'x' ? room.W : room.D; return s.h0 + (s.h1 - s.h0) * clamp01((s.axis === 'x' ? x : z) / len + 0.5); }
  if (s.kind === 'soffit' && Math.abs((s.axis === 'x' ? z : x) - s.at) <= s.t / 2) return s.clear;
  return room.H;
}
/** Room to stand up in: ceiling minus floor, or the height of a doorway while you are in it, or of a hole in a wall (`lows`, quiet.js). */
export function headAt(room, x, z, head = ceilAt(room, x, z) - floorAt(room, x, z)) {
  for (const dr of room.doors) { const f = wallFrame(room, dr.side, x, z); if (f.d < 0.2 && Math.abs(f.c - dr.c) <= dr.w / 2 + 0.05) head = Math.min(head, dr.h); }
  if (room.lows) for (const l of room.lows) if (x >= l.x0 && x <= l.x1 && z >= l.z0 && z <= l.z1) head = Math.min(head, l.h);
  return head;
}
/** The floor each flight of door-stairs covers (plus `pad` of landing at its foot), as rectangles in the room's frame. */
export function stairZones(room, pad = 0.9) {
  return room.doors.filter((d) => d.sill > 0.01).map((d) => {
    const run = (Math.round(d.sill / RISE) - 1) * RUN, a = wallPoint(room, d.side, d.c - d.w / 2, 0), b = wallPoint(room, d.side, d.c + d.w / 2, run + pad);
    return { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z), door: d, run };
  });
}
/** Half the width of a pinched corridor at a point along it. */
export function pinchHalf(room, v) {
  const s = room.shape, wide = (s.axis === 'x' ? room.D : room.W) / 2;
  return s.waist / 2 + (wide - s.waist / 2) * Math.min(1, Math.abs(v - s.at) / s.span);
}
/** Does a body of radius r fit here, as far as the room's own shape goes? (Walls and furniture are the world's business.) */
export function fitsAt(room, x, z, r) {
  const s = room.shape;
  if (s && s.kind === 'pinch') return Math.abs(s.axis === 'x' ? z : x) <= pinchHalf(room, s.axis === 'x' ? x : z) - r;
  return true;
}

/**
 * The stretches of a wall with nothing in the way — no doorway, window, stairs, pillar or filled-in corner, and at
 * least `minTop` of ceiling over them: [[from, to], …] along the wall, in the room's own frame.
 */
export function wallSpans(room, side, margin = 0.3, minTop = 0) {
  const half = wallLength(room, side) / 2;
  const holes = [...room.doors, ...(room.wins || [])].filter((d) => d.side === side).map((d) => [d.c - d.w / 2 - margin, d.c + d.w / 2 + margin]);
  let bad = null;
  for (let at = -half; at <= half + 1e-6; at += 0.125) {
    const p = wallPoint(room, side, at, 0.25);
    const blocked = Math.abs(floorAt(room, p.x, p.z)) > 0.01 || !fitsAt(room, p.x, p.z, 0.05) || ceilAt(room, p.x, p.z) < minTop
      || (room.pillars || []).some((q) => Math.abs(p.x - q.x) < q.w / 2 + 0.05 && Math.abs(p.z - q.z) < q.d / 2 + 0.05);
    if (blocked && !bad) bad = [at - 0.15, at]; else if (blocked) bad[1] = at;
    if (!blocked && bad) { holes.push([bad[0], bad[1] + 0.15]); bad = null; }
  }
  if (bad) holes.push([bad[0], half]);
  holes.sort((a, b) => a[0] - b[0]);
  const out = []; let at = -half + margin;
  for (const [a, b] of holes) { if (a - at > 0.05) out.push([at, a]); at = Math.max(at, b); }
  if (half - margin - at > 0.05) out.push([at, half - margin]);
  return out;
}
