// The Backrooms — the banner: the rule. Pure: no three.js, no DOM (banner.js hangs it).
//
// Somewhere near where a visit lands there is a vinyl banner strung up under the ceiling, the kind an office park
// puts up about itself: VOTED 6TH BEST OFFICE PARK, and under that, of where. Where is wherever the visitor is: the
// page the level is on may hand the level a place name (`where`: the BlockRooms site is told a city by its host with
// every request, and passes it on; nothing keeps it). With none, the banner says what such banners say.
//
// The banner is the same banner in the same place for everybody who walks a building: where it hangs is the seed's
// business, and only its second line is the visitor's. It is not in the level's data at all (gen.js knows nothing of
// it), so a kept tape is still the same tape.
import { toLocal, ceilAt, floorAt, roomDistances } from './gen.js';

export const BANNER_TOP = 'VOTED 6TH BEST OFFICE PARK';
export const BANNER_NOWHERE = 'IN THE TRI-COUNTY AREA';
export const WHERE_MAX = 40;
/**
 * The banner itself, metres: how long at most (to either side) and at least, how tall, how far under the ceiling its
 * top hangs, how far ahead of the landing at most, the least headroom under it. It hangs low and well ahead on
 * purpose: somebody who has just landed and is looking straight in front of them has it in the top of the picture.
 */
export const BANNER = Object.freeze({ half: 1.2, least: 0.9, tall: 0.46, under: 0.34, ahead: 2.6, clear: 1.78 });

/** A place name as a place name is written (letters, figures, spaces and the few marks one has), or ''. */
export function cleanWhere(v) {
  if (typeof v !== 'string' || /[\u0000-\u001f\u007f]/.test(v)) return '';
  const s = v.normalize('NFKC').replace(/\s+/g, ' ').trim();
  return s && [...s].length <= WHERE_MAX && /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'’()-]*$/u.test(s) ? s : '';
}

/** What is lettered on it: two lines, the place on the second. */
export function bannerLines(where) {
  const place = cleanWhere(where);
  return [BANNER_TOP, place ? `OF ${place.toUpperCase()}` : BANNER_NOWHERE];
}

const AXES = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const SIDE = { front: [0, 1], back: [0, -1], right: [1, 0], left: [-1, 0] };

/** Can a banner hang at (x, z) in this room, facing (nx, nz)? → how long it can be to either side (metres), or 0. */
function fitsAt(room, x, z, nx, nz) {
  const ax = nz, az = -nx;                                    // the way it runs, left to right from in front of it
  const span = ax ? room.W : room.D, at = ax ? x : z, depth = ax ? z : x, deep = ax ? room.D : room.W;
  if (Math.abs(depth) > deep / 2 - 0.45) return 0;
  const half = Math.min(BANNER.half, span / 2 - 0.5 - Math.abs(at));
  if (half < BANNER.least) return 0;
  // level floor and a flat ceiling high enough over all of it
  let low = Infinity, high = -Infinity;
  for (const s of [-half, -half / 2, 0, half / 2, half]) {
    const px = x + ax * s, pz = z + az * s;
    if (Math.abs(floorAt(room, px, pz)) > 0.02) return 0;
    const c = ceilAt(room, px, pz); low = Math.min(low, c); high = Math.max(high, c);
  }
  if (low - BANNER.under - BANNER.tall < BANNER.clear || high - low > 0.04) return 0;
  // nothing standing where it hangs (a low thing may stand under it)
  const x0 = Math.min(x - ax * half, x + ax * half) - 0.2, x1 = Math.max(x - ax * half, x + ax * half) + 0.2, z0 = Math.min(z - az * half, z + az * half) - 0.2, z1 = Math.max(z - az * half, z + az * half) + 0.2;
  for (const p of room.pillars || []) {
    if ((p.h ?? Infinity) + (p.y0 || 0) < BANNER.clear && !(p.y0 > 0)) continue;
    if (p.x + p.w / 2 > x0 && p.x - p.w / 2 < x1 && p.z + p.d / 2 > z0 && p.z - p.d / 2 < z1) return 0;
  }
  return half;
}

/**
 * Where the banner hangs in a part of the building: in the room a visit lands in, across the way the visitor is
 * looking, a few steps ahead of them and facing them; or, where that room will not take one, in a plain room a
 * doorway or two on, facing the way in. Only ever in the part a visit lands in. → { room, x, z, nx, nz, half, top }
 * in that room's own frame (top: the height of its top edge), or null.
 */
export function bannerSpot(level) {
  if ((level.depth | 0) !== 0 || !level.start) return null;
  const rooms = level.rooms, first = rooms[level.start.room];
  if (!first) return null;
  const take = (room, x, z, nx, nz) => {
    const half = fitsAt(room, x, z, nx, nz);
    return half ? { room: room.id, x: +x.toFixed(3), z: +z.toFixed(3), nx, nz, half: +half.toFixed(3), top: +(ceilAt(room, x, z) - BANNER.under).toFixed(3) } : null;
  };
  // where they land: ahead of them first, then behind, then to either side
  if (first.kind === 'start' || first.kind === 'plain') {
    const me = toLocal(first, level.start.x, level.start.z), yaw = (level.start.yaw || 0) - ((first.rot || 0) * Math.PI) / 2;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), ahead = Math.abs(fx) > Math.abs(fz) ? [Math.sign(fx), 0] : [0, Math.sign(fz) || -1];
    const order = [ahead, [-ahead[0], -ahead[1]], ...AXES.filter(([a, b]) => a * ahead[0] + b * ahead[1] === 0)];
    for (const [dx, dz] of order) {
      const reach = Math.min(BANNER.ahead, (dx ? first.W : first.D) / 2 - 0.55);
      if (reach < 1.2) continue;
      const got = take(first, me.x + dx * reach, me.z + dz * reach, -dx, -dz);
      if (got) return got;
    }
  }
  // else the nearest plain room that will have one, in the middle of it, facing the doorway one comes in by
  const steps = roomDistances(level, first.id);
  const near = rooms.filter((r) => r.kind === 'plain' && !r.crawl && (steps.get(r.id) ?? 99) >= 1 && (steps.get(r.id) ?? 99) <= 2).sort((a, b) => steps.get(a.id) - steps.get(b.id) || a.id - b.id);
  for (const room of near) {
    const way = room.doors.slice().sort((a, b) => (steps.get(a.to) ?? 99) - (steps.get(b.to) ?? 99))[0];
    const n = (way && SIDE[way.side]) || [0, 1];
    const got = take(room, 0, 0, n[0], n[1]);
    if (got) return got;
  }
  return null;
}
