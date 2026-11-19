// The Backrooms — two previews for the dev page, and nothing dealt into the real game.
//   &preview=corners    doorways moved into a corner of the room: the opening runs to the end of its wall, so the side
//                       wall carries straight on into the room next door and you look into it at a slant
//   &preview=hallways   corridors whose walls are not a rectangle: narrowing, a dog-leg, a wall a few degrees off true,
//                       a dead end with two chairs and one light (both: &preview=corners,hallways)
// Only the dev page asks for these (index.js, with opt.debug): the floor generate() made is changed after it was made,
// before it is built, and generate() and the visit's plan are exactly what they were. Nothing here draws on a seeded
// source of the floor's, and nothing here uses Math.random: which corridor gets which shape is a hash of the floor's seed
// and the room. Rooms keep their rectangles (the floor's route between rooms is the same); what changes inside them is a
// doorway's place along its wall, or walls drawn inside a corridor with the rest of it made solid.
import { T, DOOR_H, TILE, toLocal, wallPoint, wallLength, floorAt, ceilAt, fitsAt, stairZones } from './frame.js';
import { fits } from './quiet.js';
import { THIN_W, MARK_W } from './marks.js';
import { lin, WHITE } from './kit.js';
import { siteOf } from './vending-machine.js';
import { doorPlan, doorRooms } from './doors.js';

export const PREVIEWS = Object.freeze(['corners', 'hallways']);
/** The visitor's radius (player.js RADIUS), and the narrowest a reshaped corridor may get: four of them, two bodies' width. */
export const BODY_R = 0.22, NARROWEST = 0.9;
/** How far off true a wall that is skewed goes, degrees: one end against the room's wall, the other this far in. */
export const SKEW_DEG = [3, 6];
const r4 = (v) => Math.round(v * 10000) / 10000;
const fnv = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const DRESSED = new Set(['waterpark', 'suburb', 'mall', 'forest']);
const plainish = (r) => (r.kind === 'plain' || r.kind === 'start') && !r.crawl;
const along = (side) => side === 'front' || side === 'back';
const pick = (preview) => new Set(String(preview || '').split(',').map((s) => s.trim()).filter((s) => PREVIEWS.includes(s)));

/**
 * Change a generated floor for the previews asked for (a comma list of PREVIEWS), once, and wrap the plain builder so
 * that the corridors given a shape are built with it. → level.preview: { corners: [...], hallways: [...] }.
 */
export function preparePreview(level, builders, preview) {
  const want = pick(preview);
  if (!want.size || level.preview) return level.preview || null;
  level.preview = { asked: [...want], corners: [], hallways: [] };
  if (want.has('hallways')) level.preview.hallways = shapeHallways(level);
  if (want.has('corners')) level.preview.corners = cornerDoors(level, new Set(level.preview.hallways.map((h) => h.room)));
  if (builders && level.preview.hallways.length) {
    for (const kind of ['plain', 'start']) {
      const was = builders[kind];
      if (was) builders[kind] = (c) => (c.room.hall ? hallway(c, was) : was(c));
    }
  }
  return level.preview;
}

/* ---- corner doors ------------------------------------------------------------------------------------------ */

/** The interval of the dividing line both rooms' insides reach (world, along the wall): a doorway has to be inside it. */
function shared(A, B, link) {
  const span = (r) => (link.axis === 'x' ? [r.z + T / 2, r.z + r.d - T / 2] : [r.x + T / 2, r.x + r.w - T / 2]);
  const [a0, a1] = span(A), [b0, b1] = span(B);
  return { lo: Math.max(a0, b0), hi: Math.min(a1, b1), lowBoth: Math.abs(a0 - b0) < 1e-6, highBoth: Math.abs(a1 - b1) < 1e-6 };
}
/** Where a link's doorway is in one of its rooms' own frame (as gen.js writes room.doors). */
function localC(room, side, link, from, to) {
  const mid = (from + to) / 2, p = toLocal(room, link.axis === 'x' ? link.at : mid, link.axis === 'x' ? mid : link.at);
  return r4(along(side) ? p.x : p.z);
}
/** Is a doorway here, in this room, as good as the one it replaces: clear wall, level floor, headroom, and every doorway still reached? */
function doorwayFine(level, room, dr, link, h0) {
  const half = wallLength(room, dr.side) / 2;
  if (dr.c - dr.w / 2 < -half - 1e-6 || dr.c + dr.w / 2 > half + 1e-6) return false;
  const lo = dr.c - dr.w / 2 - 0.3, hi = dr.c + dr.w / 2 + 0.3;
  const clash = (c, w) => c + w / 2 > lo && c - w / 2 < hi;
  if (room.doors.some((d) => d !== dr && d.side === dr.side && clash(d.c, d.w))) return false;
  if ((room.wins || []).some((w) => w.side === dr.side && clash(w.c, w.w))) return false;
  const thin = level.thin;
  if (thin && thin.room === room.id && thin.side === dr.side && clash(thin.at, Math.max(thin.w || THIN_W, THIN_W))) return false;
  if ((room.dress || []).some((m) => m.type === 'marks' && m.side === dr.side && clash(m.at, MARK_W))) return false;
  // a metre of clear, level floor in front of it, a little wider than itself (quiet.js fits: the same zone)
  const a = wallPoint(room, dr.side, dr.c - (dr.w + 0.4) / 2, 0.15), b = wallPoint(room, dr.side, dr.c + (dr.w + 0.4) / 2, 1.0);
  const zone = { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) };
  const hit = (q) => q.x1 > zone.x0 - 0.05 && q.x0 < zone.x1 + 0.05 && q.z1 > zone.z0 - 0.05 && q.z0 < zone.z1 + 0.05;
  if ((room.pillars || []).some((p) => hit({ x0: p.x - p.w / 2, z0: p.z - p.d / 2, x1: p.x + p.w / 2, z1: p.z + p.d / 2 }))) return false;
  if ((room.blocks || []).some(hit) || (room.lows || []).some(hit)) return false;
  if (stairZones(room, 0.6).some((s) => s.door !== dr && hit(s))) return false;
  for (let k = -0.5; k <= 0.501; k += 0.1) for (const off of [0.05, 0.5, 1.0]) {
    const p = wallPoint(room, dr.side, dr.c + k * dr.w, off);
    if (Math.abs(floorAt(room, p.x, p.z)) > 0.005 || !fitsAt(room, p.x, p.z, 0.1)) return false;
  }
  // (the doorway's height, as gen.js works it out once the ceilings are known: no lower than it was)
  let h = link.kind === 'arch' ? 9 : DOOR_H;
  for (let k = -0.5; k <= 0.501; k += 0.1) { const p = wallPoint(room, dr.side, dr.c + k * dr.w, 0.05); h = Math.min(h, ceilAt(room, p.x, p.z) - dr.sill - (link.kind === 'arch' ? 0.02 : 0.12)); }
  if (r4(Math.max(0.62, h)) < h0 - 1e-6) return false;
  return fits(room, { pillars: [] });
}
/** Which end of its wall a doorway runs to, if it reaches one: -1 (the low end), 1 (the high end), else 0. */
export function cornerOf(room, dr) {
  const half = wallLength(room, dr.side) / 2;
  if (Math.abs(dr.c - dr.w / 2 + half) < 0.01) return -1;
  if (Math.abs(dr.c + dr.w / 2 - half) < 0.01) return 1;
  return 0;
}
/** The room's corner (sx, sz) at one end of a wall, for telling when two doorways share one. */
const cornerKey = (room, side, end) => {
  const p = wallPoint(room, side, end * wallLength(room, side) / 2, 0);
  return `${Math.sign(Math.round(p.x * 1000))},${Math.sign(Math.round(p.z * 1000))}`;
};

/**
 * Every doorway between two plain rooms that can go to a corner goes to one: its opening slid along the wall until it
 * reaches the end of the wall of one room (of both, where their walls end in the same place, for choice; and the corner
 * another doorway of the room has already gone to, next, so that a corner opens two ways). Not a door with a leaf, a
 * crawl hole or a slit, not between floors at different heights, not in the room something follows you from, and only
 * where the new place passes every test the old one did (doorwayFine). → [{ link, rooms: [a, b], corner: [ends] }].
 */
export function cornerDoors(level, skip = new Set()) {
  const { rooms } = level, moved = [], lair = level.pursuer ? level.pursuer.room : -1;
  // (a doorway that is hung with a pair of leaves stays where it is: one leaf, standing open, would be inside the side wall)
  const hung = new Set(doorPlan(level).map((p) => p.link));
  const coins = new Set((level.loot?.coins || []).map((k) => k.room));
  const used = new Map(rooms.map((r) => [r.id, new Set()]));
  for (const link of level.links) {
    const A = rooms[link.a], B = rooms[link.b];
    if (link.door || hung.has(link.id) || !(link.kind === 'door' || link.kind === 'arch') || !plainish(A) || !plainish(B) || A.y !== B.y) continue;
    if ([A, B].some((r) => r.id === lair || skip.has(r.id) || coins.has(r.id))) continue;
    const dA = A.doors.find((d) => d.link === link.id), dB = B.doors.find((d) => d.link === link.id);
    if (!dA || !dB || dA.sill > 0.01 || dB.sill > 0.01) continue;
    const w = link.to - link.from, s = shared(A, B, link);
    if (s.hi - s.lo < w + 0.05) continue;
    const was = { from: link.from, to: link.to, cA: dA.c, cB: dB.c };
    const options = [{ from: s.lo, to: s.lo + w, both: s.lowBoth }, { from: s.hi - w, to: s.hi, both: s.highBoth }];
    const corners = (o) => [[A, dA], [B, dB]].map(([r, d]) => { const c = localC(r, d.side, link, o.from, o.to), end = cornerOf(r, { ...d, c }); return end ? cornerKey(r, d.side, end) : null; });
    const score = (o) => { const k = corners(o); return (o.both ? 4 : 0) + (k.some((key, i) => key && used.get([A, B][i].id).has(key)) ? 2 : 0) - Math.abs(o.from - link.from) * 0.01; };
    for (const o of options.sort((p, q) => score(q) - score(p))) {
      if (Math.abs(o.from - link.from) < 1e-6) continue;
      link.from = r4(o.from); link.to = r4(o.to);
      dA.c = localC(A, dA.side, link, link.from, link.to); dB.c = localC(B, dB.side, link, link.from, link.to);
      if (doorwayFine(level, A, dA, link, link.h ?? DOOR_H) && doorwayFine(level, B, dB, link, link.h ?? DOOR_H)) {
        const k = corners(o);
        k.forEach((key, i) => key && used.get([A, B][i].id).add(key));
        moved.push({ link: link.id, rooms: [A.id, B.id], corner: k, both: !!o.both, from: was.from, to: was.to });
        break;
      }
      link.from = was.from; link.to = was.to; dA.c = was.cA; dB.c = was.cB;
    }
  }
  return moved;
}

/* ---- hallways that are not rectangles -------------------------------------------------------------------------- */
// A corridor's walls inside its rectangle, in the room's own frame along the corridor: v runs from one end wall to the
// other (local z when the corridor runs deep, x when it runs across), u across it. Each side is a polyline of [v, u]
// knots from v = -len/2 to v = +len/2; the walkable floor is between them, the rest of the rectangle is solid.

/** The corridor's axes: which local walls are its ends, how long it is, how wide. */
export function axesOf(room) {
  const deep = room.D >= room.W;
  return { deep, len: deep ? room.D : room.W, wide: (deep ? room.W : room.D) / 2, ends: deep ? ['back', 'front'] : ['left', 'right'] };
}
/** Room point (x, z) → corridor (u, v), and back. */
const toUV = (ax, x, z) => (ax.deep ? { u: x, v: z } : { u: z, v: x });
const toXZ = (ax, u, v) => (ax.deep ? { x: u, z: v } : { x: v, z: u });
/** The u of a polyline at v (it runs monotonically in v). */
export function uAt(line, v) {
  for (let i = 0; i + 1 < line.length; i++) {
    const [v0, u0] = line[i], [v1, u1] = line[i + 1];
    if (v <= v1 + 1e-9 || i + 2 === line.length) return v1 - v0 < 1e-9 ? u1 : u0 + (u1 - u0) * Math.max(0, Math.min(1, (v - v0) / (v1 - v0)));
  }
  return line[0][1];
}
const segDist = (pu, pv, [v0, u0], [v1, u1]) => {
  const du = u1 - u0, dv = v1 - v0, L2 = du * du + dv * dv, t = L2 ? Math.max(0, Math.min(1, ((pu - u0) * du + (pv - v0) * dv) / L2)) : 0;
  return Math.hypot(pu - (u0 + t * du), pv - (v0 + t * dv));
};
/** Distance from (u, v) to a polyline. */
export function lineDist(line, u, v) { let d = Infinity; for (let i = 0; i + 1 < line.length; i++) d = Math.min(d, segDist(u, v, line[i], line[i + 1])); return d; }
/** Can a body of radius r stand at room point (x, z) as far as the corridor's walls go? (The room's own walls are the world's.) */
export function hallClip(room, hall) {
  const ax = axesOf(room);
  return (x, z, r) => {
    const { u, v } = toUV(ax, x, z);
    const lo = uAt(hall.left, v), hi = uAt(hall.right, v);
    return u > lo && u < hi && lineDist(hall.left, u, v) >= r && lineDist(hall.right, u, v) >= r;
  };
}
/** The narrowest the corridor gets, metres: the least distance between its two walls. */
export function narrowest(hall) {
  let d = Infinity;
  for (const [v, u] of hall.left) d = Math.min(d, lineDist(hall.right, u, v));
  for (const [v, u] of hall.right) d = Math.min(d, lineDist(hall.left, u, v));
  return d;
}

/** The corridors that can be given a shape: plain, empty, at most three doorways, all at floor level, and none of the floor's own things in them. */
export function hallwayRooms(level) {
  const lair = level.pursuer ? level.pursuer.room : -1, coins = new Set((level.loot?.coins || []).map((k) => k.room));
  // (not on a kind of floor whose plain rooms are furnished by the floor itself — a lawn, a pool, a concourse, a trail —
  // nor where the floor's one vending machine is to stand: neither would know where the walls had gone)
  if (DRESSED.has(level.theme)) return [];
  const machine = siteOf(level), hung = new Set(doorPlan(level).map((p) => p.link));
  return level.rooms.filter((r) => {
    // (nor where a pair of leaves stands open: they would stand through a wall that leans in)
    if (r.doors.some((d) => hung.has(d.link))) return false;
    if (r.kind !== 'plain' || r.crawl || r.shape || r.id === lair || coins.has(r.id) || machine.has(r.id) || (level.thin && level.thin.room === r.id)) return false;
    const ax = axesOf(r);
    if (ax.wide * 2 >= 4 || ax.len < 3.6 || ax.len < ax.wide * 2 + 1.5) return false;
    if ((r.pillars || []).length || (r.blocks || []).length || (r.lows || []).length || (r.dress || []).length || (r.wins || []).length) return false;
    if (r.H < 2.2 || !r.doors.length || r.doors.length > 3) return false;
    return r.doors.every((d) => !(d.sill > 0.01) && d.kind !== 'crawl' && d.kind !== 'slit' && !d.door);
  });
}
/** A doorway in corridor terms: on an end (end 0 at v = -len/2, 1 at +len/2) across [u0, u1], or on a side (-1 the low-u wall, 1 the high) along [v0, v1]. */
export function doorUV(room, d) {
  const ax = axesOf(room), end = ax.ends.indexOf(d.side);
  if (end >= 0) return { end, u0: d.c - d.w / 2, u1: d.c + d.w / 2 };
  const side = (ax.deep ? d.side === 'right' : d.side === 'front') ? 1 : -1;
  return { side, v0: d.c - d.w / 2, v1: d.c + d.w / 2 };
}

/** Narrow a doorway (both rooms' sides of it) to at most w, about its middle, as gen.js narrows a slit. */
function narrowDoor(level, room, dr, w) {
  // (only where the floor would still hang leaves in exactly the doorways it did: a narrower doorway can become one that
  // could have them, and then which doorways have them would be dealt again over the whole floor — doors.js doorPlan)
  if (dr.w <= w + 1e-6) return;
  const link = level.links[dr.link], was = [link.from, link.to, dr.w], could = JSON.stringify(doorRooms(level, link)), mid = (link.from + link.to) / 2;
  const set = (from, to, width) => { link.from = from; link.to = to; for (const r of [level.rooms[link.a], level.rooms[link.b]]) for (const d of r.doors) if (d.link === link.id) d.w = width; };
  set(r4(mid - w / 2), r4(mid + w / 2), r4(w));
  if (JSON.stringify(doorRooms(level, link)) !== could) set(...was);
}

/**
 * A corridor's shape, of the kind asked for, fitted round its doorways → { kind, left, right, ... } or null if it will not go.
 * Every doorway keeps its opening: one on an end has both walls outside it there, one on a side has its wall against the
 * room's own all along it and a little either side. And nowhere is narrower than NARROWEST.
 */
export function hallShape(room, kind, hash = 0) {
  const ax = axesOf(room), { len, wide } = ax, half = len / 2, gap = 0.08, pin = 0.15;
  const doors = room.doors.map((d) => doorUV(room, d)), ends = (e) => doors.filter((d) => d.end === e), sides = (s) => doors.filter((d) => d.side === s);
  const endSpan = (e) => { const ds = ends(e); return ds.length ? [Math.min(...ds.map((d) => d.u0)) - gap, Math.max(...ds.map((d) => d.u1)) + gap] : null; };
  const fitsDoors = (left, right) => [0, 1].every((e) => { const s = endSpan(e), v = e ? half : -half; return !s || (uAt(left, v) <= s[0] + 1e-6 && uAt(right, v) >= s[1] - 1e-6); })
    && [[-1, left], [1, right]].every(([s, line]) => sides(s).every((d) => { for (let v = Math.max(-half, d.v0 - pin); v <= Math.min(half, d.v1 + pin) + 1e-9; v += 0.05) if (Math.abs(uAt(line, v) - s * wide) > 1e-4) return false; return true; }));
  const ok = (h) => h && fitsDoors(h.left, h.right) && narrowest(h) >= NARROWEST - 1e-6 && h.left.every(([, u]) => u >= -wide - 1e-6) && h.right.every(([, u]) => u <= wide + 1e-6) ? h : null;
  const out = (left, right, extra) => ok({ kind, left: left.map(([v, u]) => [r4(v), r4(u)]), right: right.map(([v, u]) => [r4(v), r4(u)]), ...extra });
  // (how far along the corridor a side's doorways reach from either end: a wall may only leave the room's wall past them)
  const sideReach = doors.filter((d) => d.side).map((d) => [d.v0 - pin, d.v1 + pin]);
  if (kind === 'taper') {
    // the far end (the end away from the way in) as narrow as its doorway lets it be, and both walls closing on it from the
    // last doorway in a side wall: the walls are not parallel
    const far = hash % 2, sgn = far ? 1 : -1, vFar = sgn * half, s = endSpan(far) || [-NARROWEST / 2, NARROWEST / 2];
    let lo = s[0], hi = s[1];
    if (hi - lo < NARROWEST) { const m = (lo + hi) / 2; lo = m - NARROWEST / 2; hi = m + NARROWEST / 2; }
    if (lo < -wide) { hi += -wide - lo; lo = -wide; }
    if (hi > wide) { lo -= hi - wide; hi = wide; }
    const vStart = sideReach.reduce((m, [a, b]) => (far ? Math.max(m, b) : Math.min(m, a)), -vFar);
    if (Math.abs(vFar - vStart) < 2.2 || wide * 2 - (hi - lo) < 0.5) return null;         // (not enough of a narrowing to be one)
    const L = [[-vFar, -wide], [vStart, -wide], [vFar, lo]], R = [[-vFar, wide], [vStart, wide], [vFar, hi]];
    const tidy = (line) => (far ? line : line.reverse()).filter((k, i, all) => i === 0 || Math.abs(k[0] - all[i - 1][0]) > 1e-6);
    return out(tidy(L), tidy(R), { far });
  }
  if (kind === 'skew') {
    // one wall a few degrees off true: against the room's wall at one end, in from it at the other. Tried both walls, both ways.
    for (const deg of [SKEW_DEG[1], 4.5, SKEW_DEG[0]]) for (const k of [0, 1, 2, 3]) {
      const which = (k + hash) % 4, side = which < 2 ? -1 : 1, inAt = which % 2 ? half : -half, t = Math.tan((deg * Math.PI) / 180) * len;
      const line = [[-half, side * wide - (inAt < 0 ? side * t : 0)], [half, side * wide - (inAt > 0 ? side * t : 0)]];
      const L = side < 0 ? line : [[-half, -wide], [half, -wide]], R = side > 0 ? line : [[-half, wide], [half, wide]];
      const h = out(L, R, { deg, side, inAt: Math.sign(inAt) });
      if (h) return h;
    }
    return null;
  }
  if (kind === 'dogleg') {
    // the far half put over by about half its width, with a short slanting jog between: neither half lines up with the other
    const a = endSpan(0), b = endSpan(1), wd = Math.max(1.05, a ? a[1] - a[0] : 0, b ? b[1] - b[0] : 0);
    const band = (s) => [Math.max(-wide + wd / 2, (s ? s[1] : -Infinity) - wd / 2), Math.min(wide - wd / 2, (s ? s[0] : Infinity) + wd / 2)];
    const [n0, n1] = band(a), [f0, f1] = band(b);
    if (n0 > n1 + 1e-6 || f0 > f1 + 1e-6) return null;
    const jog = Math.min(0.9, len * 0.18), options = [];
    for (let nb = n0; nb <= n1 + 1e-6; nb += 0.05) for (let fb = f0; fb <= f1 + 1e-6; fb += 0.05) for (const m of [0, -0.1, 0.1, -0.2, 0.2, -0.3, 0.3]) {
      const off = Math.abs(fb - nb);
      if (off >= 0.4) options.push({ nb, fb, mid: m * len, score: -Math.abs(off - wd / 2) - Math.abs(m) * 0.2 + ((hash % 2 ? fb > nb : fb < nb) ? 0.01 : 0) });
    }
    for (const { nb, fb, mid } of options.sort((p, q) => q.score - p.score)) {
      const h = out([[-half, nb - wd / 2], [mid - jog / 2, nb - wd / 2], [mid + jog / 2, fb - wd / 2], [half, fb - wd / 2]],
        [[-half, nb + wd / 2], [mid - jog / 2, nb + wd / 2], [mid + jog / 2, fb + wd / 2], [half, fb + wd / 2]], { width: r4(wd), offset: r4(fb - nb) });
      if (h) return h;
    }
    return null;
  }
  return null;
}

/**
 * The light panels a shaped corridor keeps: those wholly between its walls; if none is, one on its middle line, on the
 * ceiling's grid (and, where the corridor is too narrow for a panel lying across it, one turned to lie along it: not a
 * panel of the shell's, which all lie one way, but the same light put up by the room, hall.lights). → the panels.
 */
function keepPanels(room, hall, one) {
  const ax = axesOf(room), clip = hallClip(room, hall);
  const inside = (p, turn = false) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([sx, sz]) => clip(p.x + sx * (turn ? TILE : TILE / 2), p.z + sz * (turn ? TILE / 2 : TILE), 0.04));
  let kept = room.panels.filter(inside);
  if (one) {
    // the dead end's one light: the panel nearest the dead end, lit
    const end = hall.dead, far = (p) => (end > 0 ? 1 : -1) * toUV(ax, p.x, p.z).v;
    kept = kept.sort((p, q) => far(q) - far(p)).slice(0, 1).map((p) => ({ ...p, state: 'on' }));
  }
  if (!kept.length) {
    for (const frac of [0, 0.25, -0.25, 0.4, -0.4]) {
      const v = frac * ax.len, u = (uAt(hall.left, v) + uAt(hall.right, v)) / 2, p = toXZ(ax, u, v);
      const x = (Math.round(p.x / TILE - 0.5) + 0.5) * TILE, z = Math.round(p.z / TILE) * TILE;
      if (inside({ x, z })) { kept = [{ x: r4(x), z: r4(z), state: 'on' }]; break; }
      const tx = Math.round(p.x / TILE) * TILE, tz = (Math.round(p.z / TILE - 0.5) + 0.5) * TILE;
      if (!ax.deep && inside({ x: tx, z: tz }, true)) { hall.lights = [{ x: r4(tx), z: r4(tz), turn: true }]; break; }
    }
  }
  return kept;
}

/**
 * Give some of the floor's corridors a shape: each two-doorway corridor that will take one gets the next of taper,
 * dog-leg and skew (in an order the floor's seed decides), and a dead end (one doorway) a wall off true, two chairs
 * at the end facing the wall, and one light. Doorways into them are narrowed to a metre where they were wider, so
 * that the shapes have room. → [{ room, kind, narrowest, ... }].
 */
export function shapeHallways(level) {
  const kinds = ['taper', 'dogleg', 'skew'], out = [], turn = fnv(`${level.seed}/preview/hallways`) % 3;
  let k = 0;
  for (const room of hallwayRooms(level)) {
    const hash = fnv(`${level.seed}/preview/hall/${room.id}`), dead = room.doors.length === 1;
    const saved = room.doors.map((d) => [d, d.w, level.links[d.link].from, level.links[d.link].to]);
    const others = room.doors.map((d) => level.rooms[d.to]);
    // (doorways into a room something else may need wide, an oddity's or a room with stairs up to it, stay as they are)
    for (const d of room.doors) if (plainish(level.rooms[d.to]) && !level.links[d.link].door) narrowDoor(level, room, d, 1.0);
    let hall = null;
    if (dead) {
      hall = hallShape(room, 'skew', hash);
      if (hall) { const d = doorUV(room, room.doors[0]); hall.dead = d.end !== undefined ? (d.end ? -1 : 1) : ((d.v0 + d.v1) / 2 > 0 ? -1 : 1); hall.kind = 'deadend'; }
    } else for (let i = 0; i < kinds.length && !hall; i++) {
      // (the narrowing ends at the end away from the room nearer the landing: you walk in wide and it closes ahead of you)
      const kind = kinds[(turn + k + i) % 3], near = doorUV(room, room.doors[others.indexOf(others.reduce((p, q) => (q.depth < p.depth ? q : p)))]);
      const nearV = near.end !== undefined ? (near.end ? 1 : -1) : (near.v0 + near.v1) / 2;
      hall = hallShape(room, kind, kind === 'taper' ? (nearV <= 0 ? 1 : 0) : hash);
    }
    // the neighbours' approaches still fine at the narrowed doorways (they can only have got roomier), and this room walkable end to end
    if (!hall || !others.every((r) => !plainish(r) || fits(r, { pillars: [] })) || !walksThrough(room, hall)) {
      for (const [d, w, from, to] of saved) { d.w = w; const l = level.links[d.link]; l.from = from; l.to = to; for (const r of [level.rooms[l.a], level.rooms[l.b]]) for (const e of r.doors) if (e.link === l.id) e.w = w; }
      continue;
    }
    if (!dead) k++;
    room.hall = hall;
    room.panels = keepPanels(room, hall, dead);
    out.push({ room: room.id, kind: hall.kind, narrowest: r4(narrowest(hall)), len: r4(axesOf(room).len), wide: r4(axesOf(room).wide * 2) });
  }
  return out;
}

/** Every doorway of the corridor reached from the first, on the level's 12.5 cm grid, by a body of the visitor's size. */
export function walksThrough(room, hall, r = 0.225) {
  const clip = hallClip(room, hall), cell = 0.125, nx = Math.ceil(room.W / cell), nz = Math.ceil(room.D / cell);
  const key = (p) => Math.floor((p.x + room.W / 2) / cell) + nx * Math.floor((p.z + room.D / 2) / cell);
  const free = (x, z) => Math.abs(x) <= room.W / 2 - r && Math.abs(z) <= room.D / 2 - r && clip(x, z, r);
  const starts = room.doors.map((d) => key(wallPoint(room, d.side, d.c, 0.5)));
  const seen = new Uint8Array(nx * nz), queue = [starts[0]];
  seen[starts[0]] = 1;
  while (queue.length) {
    const kk = queue.pop(), i = kk % nx, j = (kk - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj, n = ii + nx * jj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || seen[n]) continue;
      if (!free(-room.W / 2 + (ii + 0.5) * cell, -room.D / 2 + (jj + 0.5) * cell)) continue;
      seen[n] = 1; queue.push(n);
    }
  }
  return starts.every((s) => seen[s]);
}

/** The pieces of wall a shaped corridor draws: every segment of either polyline that is not the room's own wall. → [{ a: {x,z}, b: {x,z}, n: {x,z} }] (n into the corridor). */
export function hallWalls(room, hall) {
  const ax = axesOf(room), out = [];
  for (const [line, inward] of [[hall.left, 1], [hall.right, -1]]) for (let i = 0; i + 1 < line.length; i++) {
    const [v0, u0] = line[i], [v1, u1] = line[i + 1];
    if (Math.abs(Math.abs(u0) - ax.wide) < 0.005 && Math.abs(Math.abs(u1) - ax.wide) < 0.005 && Math.sign(u0) === Math.sign(u1)) continue;     // (the room's own wall: the shell's)
    // the normal into the corridor, in (u, v): perpendicular to the segment, on the side away from the wall
    const du = u1 - u0, dv = v1 - v0, L = Math.hypot(du, dv) || 1;
    let nu = dv / L, nv = -du / L;
    if (nu * inward < 0) { nu = -nu; nv = -nv; }
    const a = toXZ(ax, u0, v0), b = toXZ(ax, u1, v1), n = toXZ(ax, nu, nv);
    out.push({ a, b, n });
  }
  return out;
}

/**
 * Build a shaped corridor: the plain room it was (the shell, and what the plain builder puts in it, which in these rooms
 * is little more than a socket or an exit sign), with no sockets, then its inner walls, papered and skirted as the
 * shell's are, solid exactly where they are drawn (rt.clip), and in a dead end two chairs facing the wall.
 */
function hallway(c, plainBuilder) {
  const { room, H } = c, hall = room.hall, trim = lin(c.look.trim);
  const shell = c.shell;
  c.shell = (opt = {}) => shell({ ...opt, sockets: false });
  try { plainBuilder(c); } finally { c.shell = shell; }
  const rows = [0, 0.16, 0.7, 1.3, 1.9, H - 0.16, H];
  let run = 0;
  for (const { a, b, n } of hallWalls(room, hall)) {
    // the quad's face is (b - a) × up: into the corridor when a → b runs with the corridor on its left
    let p = a, q = b;
    if ((q.z - p.z) * -1 * n.x + (q.x - p.x) * n.z < 0) [p, q] = [q, p];
    const len = Math.hypot(q.x - p.x, q.z - p.z), cols = Math.max(1, Math.ceil(len / 0.3));
    for (let i = 0; i < cols; i++) {
      const t0 = i / cols, t1 = (i + 1) / cols, x0 = p.x + (q.x - p.x) * t0, z0 = p.z + (q.z - p.z) * t0, x1 = p.x + (q.x - p.x) * t1, z1 = p.z + (q.z - p.z) * t1;
      const s0 = (run + len * t0) / 0.8, s1 = (run + len * t1) / 0.8;
      for (let k = 0; k + 1 < rows.length; k++) {
        const y0 = rows[k], y1 = rows[k + 1], ao = k === 0 || k === rows.length - 2 ? 0.84 : 1;
        c.wall.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], WHITE, [[s0, y0 / 0.8], [s1, y0 / 0.8], [s1, y1 / 0.8], [s0, y1 / 0.8]], ao);
      }
      const k2 = 0.022;
      c.flat.quad([x0 + n.x * k2, 0, z0 + n.z * k2], [x1 + n.x * k2, 0, z1 + n.z * k2], [x1 + n.x * k2, 0.11, z1 + n.z * k2], [x0 + n.x * k2, 0.11, z0 + n.z * k2], trim);
    }
    run += len;
  }
  c.rt.clip = hallClip(room, hall);
  for (const l of hall.lights || []) c.fitting(l.x, l.z, { rot: l.turn ? Math.PI / 2 : 0 });
  if (hall.kind === 'deadend') {
    // two ordinary chairs at the end, side by side, facing the wall with nothing on it
    const ax = axesOf(room), side = ax.ends[hall.dead > 0 ? 1 : 0], v = hall.dead * (ax.len / 2 - 0.85);
    const lo = uAt(hall.left, v), hi = uAt(hall.right, v), mid = (lo + hi) / 2, gapU = Math.min(0.62, (hi - lo) / 2 - 0.05);
    for (const s of [-1, 1]) {
      const u = mid + s * gapU / 2, w = c.wallAt(side, u, 0.85);
      c.prop('chair', w.x, w.z, { rot: w.rot, o: { color: '#5a5a66' } });
    }
  }
}
