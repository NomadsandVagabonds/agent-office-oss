// The Backrooms — walking the floor. Everything that roams down here gets
// about the same way: through doorways it is able to use (cast/paths.js
// roomRoute, with a cost of its own), across each room on a grid of where its
// own body fits and it has room to stand up (gridPath), a stride at a time,
// sliding round what is in the way. Nothing here teleports and nothing here
// decides anything: a creature says where it wants to be, and is told how far
// it got and what stopped it — a shut door, or no way at all.
//
// A walker is any object with { x, z, r, tall, opens? }: where it is, its
// radius, how much headroom it needs, and whether it can open a door.
import { furnitureClear } from '../furniture-rules.js';
import { toWorld, toLocal, T } from '../gen.js';
import { overlaps } from '../furniture-policy.js';
import { roomRoute, roomCosts, gridPath, straighten } from './paths.js';

const CELL = 0.125, STEP = 0.26;
/** What a shut door costs a walker that can open one, in rooms: it would go some way round sooner than stop and work a handle. */
export const DOOR_COST = 3;
/** A furnished doorway is usable, but going around is usually quicker than clearing it. */
export const BARRICADE_COST = 3;
const RETRY_BARRICADE = 3;

/** How near one of the absorbed staff a creature will set foot, metres (their arms are longer; their bodies are not). */
export const ABSORBED_GAP = 0.5;
/** Is a spot clear of every colleague sunk into the building? (`list`: env.absorbed — [{ x, z }], or nothing yet.) */
export function clearOfAbsorbed(list, x, z, gap = ABSORBED_GAP) {
  if (list) for (const a of list) if ((x - a.x) * (x - a.x) + (z - a.z) * (z - a.z) < gap * gap) return false;
  return true;
}

export function createWalk(env) {
  const W = () => env.world, level = env.level;
  const grids = new Map();                         // room id + who → { nx, nz, ok, floor, version }
  const doorOf = (id) => env.doors?.at(id) || null;
  const furnitureVersion = (id) => env.barricades?.version(id) || 0;
  const linkVersion = (from, to) => `${furnitureVersion(Math.min(from, to))}:${furnitureVersion(Math.max(from, to))}:${env.doors?.version || 0}`;

  // (ghost: creatures do not block on one another's bodies. But a colleague the building is keeping — absorbed.js — is
  // not somebody to walk through or stop on: nothing of the cast stands within ABSORBED_GAP of one.)
  const flies = a => Number.isFinite(a.flightY);
  const ignores = (a, item) => a.furniture === 'phase' || flies(a) && Number.isFinite(item?.top) && a.flightY >= item.top;
  const stand = (a, x, z, furnitureColliders) => {
    const w = W();
    if (!w.free(x, z, a.r, { ghost: true, furnitureColliders, furniture: a.furniture, furnitureY: a.flightY })) return false;
    const head = w.headroom(x, z);
    if (!flies(a)) return head >= a.tall && clearOfAbsorbed(env.absorbed, x, z);
    const floor = w.floorY(x, z);
    if (a.flightY < floor || a.flightY + a.tall > floor + head) return false;
    for (const th of w.throats || []) {
      const l = th.link, cross = l.axis === 'x' ? Math.abs(x - l.at) <= T / 2 + a.r && z > l.from - a.r && z < l.to + a.r : Math.abs(z - l.at) <= T / 2 + a.r && x > l.from - a.r && x < l.to + a.r;
      if (cross && Number.isFinite(l.h) && (a.flightY < (l.y || 0) || a.flightY + a.tall > (l.y || 0) + l.h)) return false;
    }
    return true;
  };
  /** Rooms it will not go into: ones that fold space, and ones it could not stand up in. */
  const shy = (a, rt) => !rt || rt.fold || !flies(a) && rt.def.crawl || rt.def.H < a.tall + 0.05;
  /** What a doorway costs this walker (cast/paths.js): Infinity where it cannot go. */
  const cost = (a) => (d, from, to) => {
    const th = W().throats[d.link], door = doorOf(d.link);
    if (!th || d.h < a.tall || shy(a, W().rooms[to])) return Infinity;
    if (flies(a) && (a.flightY < (th.link.y || 0) || a.flightY + a.tall > (th.link.y || 0) + d.h)) return Infinity;
    const blockedLink = a.blockedLinks?.get(d.link);
    if (blockedLink?.version === linkVersion(from, to) && blockedLink.until > (a.walkTime || 0)) return Infinity;
    if (door?.isShut ? !a.opens : !th.open) return Infinity;
    const t = env.barricades ? through(W().rooms[from], W().rooms[to]) : null;
    const obstacle = t && env.barricades.blocking(t.A, t.B, a.r), blocked = obstacle && !ignores(a, obstacle);
    return 1 + (door?.isShut ? DOOR_COST : 0) + (blocked ? BARRICADE_COST : 0);
  };

  function grid(a, rt) {
    // A bobbing moth shares one conservative altitude envelope per 10cm band.
    // Exact flight height still governs every actual stride and visual orbit.
    const low = flies(a) ? Math.floor((a.flightY + 1e-9) * 10) / 10 : null, high = flies(a) ? Math.ceil((a.flightY + a.tall - 1e-9) * 10) / 10 : null;
    const body = flies(a) ? { ...a, flightY: low, tall: high - low } : a;
    const key = rt.id + ':' + a.r + ':' + a.tall + ':' + (a.furniture || 'solid') + ':' + flies(a), version = (env.doors?.version || 0) + ':' + (env.absorbed?.length || 0) + ':' + furnitureVersion(rt.id) + ':' + low + ':' + high;
    let g = grids.get(key);
    if (g && g.version === version) return g;
    const def = rt.def, nx = Math.max(1, Math.ceil(def.W / CELL)), nz = Math.max(1, Math.ceil(def.D / CELL));
    g = { nx, nz, ok: new Uint8Array(nx * nz), floor: new Float32Array(nx * nz), version };
    // A synchronous grid build cannot see furniture move between its cells. Snapshot only
    // nearby footprints, including those across the doorway within this body's radius.
    // rect stops at the inner wall; open-throat cells also occupy its half-wall strip.
    const nearbyFurniture = rt.rect && W().furnitureColliders?.filter(c => overlaps(c, rt.rect, -a.r - T / 2));
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const p = toWorld(def, -def.W / 2 + (i + 0.5) * CELL, -def.D / 2 + (j + 0.5) * CELL), k = i + nx * j;
      if (W().roomAt(p.x, p.z) !== rt) continue;
      g.ok[k] = stand(body, p.x, p.z, nearbyFurniture) ? 1 : 0; g.floor[k] = flies(a) ? low : W().floorY(p.x, p.z);
    }
    grids.set(key, g);
    return g;
  }
  const cellOf = (rt, g, x, z) => { const p = toLocal(rt.def, x, z); return Math.max(0, Math.min(g.nx - 1, Math.floor((p.x + rt.def.W / 2) / CELL))) + g.nx * Math.max(0, Math.min(g.nz - 1, Math.floor((p.z + rt.def.D / 2) / CELL))); };
  const middle = (rt, g, k) => { const i = k % g.nx; return toWorld(rt.def, -rt.def.W / 2 + (i + 0.5) * CELL, -rt.def.D / 2 + ((k - i) / g.nx + 0.5) * CELL); };
  /** The free cell nearest a point of a room, within a few cells — or the point's own. */
  function nearCell(rt, g, x, z) {
    const k = cellOf(rt, g, x, z);
    if (g.ok[k]) return k;
    const i0 = k % g.nx, j0 = (k - i0) / g.nx;
    let best = k, bd = Infinity;
    for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= g.nx || j >= g.nz || !g.ok[i + g.nx * j]) continue;
      const d = di * di + dj * dj; if (d < bd) { bd = d; best = i + g.nx * j; }
    }
    return best;
  }
  /** Can it walk straight from one spot to another? */
  function clear(a, x0, z0, x1, z1) {
    if (!furnitureClear(W(), x0, z0, x1, z1, a.r, { furniture: a.furniture, furnitureY: a.flightY })) return false;
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 0.1));
    let px = x0, pz = z0;
    for (let i = 1; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n; if (!stand(a, x, z) || !flies(a) && !W().passable(px, pz, x, z)) return false; px = x; pz = z; }
    return true;
  }

  /** Some strides toward a point, sliding round what is in the way. → how far it got. */
  function stride(a, tx, tz, dist) {
    let went = 0;
    while (dist > 1e-3) {
      const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
      if (d < 0.02) break;
      const s = Math.min(dist, d, 0.09);
      let moved = false;
      for (const turn of [0, 0.6, -0.6, 1.2, -1.2]) {
        const cs = Math.cos(turn), sn = Math.sin(turn), nx = a.x + ((dx * cs - dz * sn) / d) * s, nz = a.z + ((dx * sn + dz * cs) / d) * s;
        if (stand(a, nx, nz) && furnitureClear(W(), a.x, a.z, nx, nz, a.r, { furniture: a.furniture, furnitureY: a.flightY }) && (flies(a) || W().passable(a.x, a.z, nx, nz))) { a.x = nx; a.z = nz; moved = true; break; }
      }
      if (!moved) break;
      went += s; dist -= s;
    }
    return went;
  }

  /** The two ends of the way through a doorway from one room into the next: a spot just inside each. */
  function through(from, to) {
    const d = from.def.doors.find((k) => k.to === to.id), l = W().throats[d.link].link, mid = (l.from + l.to) / 2;
    const c = l.axis === 'x' ? { x: l.at, z: mid, nx: 1, nz: 0 } : { x: mid, z: l.at, nx: 0, nz: 1 };
    const s = Math.sign((to.def.cx - c.x) * c.nx + (to.def.cz - c.z) * c.nz) || 1, k = T / 2 + 0.45;
    return { link: d.link, A: { x: c.x - c.nx * s * k, z: c.z - c.nz * s * k }, B: { x: c.x + c.nx * s * k, z: c.z + c.nz * s * k } };
  }

  /** Across the room it is in, toward a spot of that room: follow the way round the furniture. → how far it got. */
  function cross(a, rt, tx, tz, dist) {
    if (clear(a, a.x, a.z, tx, tz)) { a.way = null; return stride(a, tx, tz, dist); }
    const g = grid(a, rt), to = nearCell(rt, g, tx, tz), wk = a.way;
    if (!wk || wk.room !== rt.id || wk.to !== to || wk.g !== g || wk.age > 0.6) {
      const from = nearCell(rt, g, a.x, a.z), found = gridPath(g.nx, g.nz, g.ok, from, to, g.floor, STEP);
      const pts = straighten(found.cells, (p, q) => { const m = middle(rt, g, p), n = middle(rt, g, q); return clear(a, m.x, m.z, n.x, n.z); }).map((k) => middle(rt, g, k));
      pts.shift();
      a.way = { room: rt.id, to, g, pts, reached: found.reached, age: 0 };
    }
    let went = 0;
    while (dist - went > 1e-3 && a.way.pts.length) {
      const p = a.way.pts[0], got = stride(a, p.x, p.z, dist - went);
      went += got;
      if (Math.hypot(p.x - a.x, p.z - a.z) < 0.08) a.way.pts.shift(); else if (got < 1e-3) break;
    }
    if (!a.way.pts.length && a.way.reached && dist - went > 1e-3) went += stride(a, tx, tz, dist - went);
    return went;
  }

  /** A path ends at furniture: name the thing within reach, instead of pretending we reached the goal. */
  function stopped(a, target, out) {
    if (!env.barricades || out.went > 1e-3) return;
    const item = env.barricades.blocking(a, target, a.r);
    if (item && !ignores(a, item)) {
      const x = Math.max(item.x0, Math.min(a.x, item.x1)), z = Math.max(item.z0, Math.min(a.z, item.z1));
      if (Math.hypot(a.x - x, a.z - z) <= a.r + 0.4) { out.obstacle = item; out.there = false; out.cannot = !a.pushes; return; }
    }
    if (a.way && !a.way.reached && !a.way.pts.length) { out.cannot = true; out.there = false; }
  }

  /**
   * Walk toward a spot for `dist` metres, by whatever rooms lie between.
   * @param a       the walker
   * @param target  { x, z }
   * @param dist    metres it may go this time
   * @param keep    stop this far short of the spot
   * @returns {{went:number, door:object|null, obstacle:object|null, link:number|null, cannot:boolean, there:boolean}}  how far it got · the shut door or furniture it is standing at, if one is in
   *          its way · there is no way there at all · it is as near as it is going to get
   */
  function go(a, target, dist, keep = 0) {
    const w = W(), here = w.roomAt(a.x, a.z), there = w.roomAt(target.x, target.z), out = { went: 0, door: null, obstacle: null, link: null, cannot: false, there: false };
    if (env.barricades) a.walkTime = (a.walkTime || 0) + dist / Math.max(0.2, a.speed || 1);
    if (a.way) a.way.age += dist / Math.max(0.2, a.speed || 1);
    if (!here) { out.cannot = true; return out; }
    // somewhere its body does not fit (something was shut on it, or put down round it): the nearest floor that it does
    if (!stand(a, a.x, a.z)) { const g = grid(a, here), k = nearCell(here, g, a.x, a.z); if (g.ok[k]) { const m = middle(here, g, k); a.x = m.x; a.z = m.z; a.way = null; a.thru = null; } }
    // half way through a doorway: finish going through it
    if (a.thru) {
      out.link = a.thru.link ?? null;
      out.went = stride(a, a.thru.x, a.thru.z, dist);
      stopped(a, a.thru, out);
      // A movable obstruction in the throat is still the same crossing. Re-approaching A here
      // would make it walk back and forth between the doorway and the desk it just shifted.
      if (Math.hypot(a.thru.x - a.x, a.thru.z - a.z) < 0.1 || out.went < 1e-3 && !out.obstacle) a.thru = null;
      return out;
    }
    if (!there) { out.cannot = true; return out; }
    if (here === there) {
      const d = Math.hypot(target.x - a.x, target.z - a.z);
      if (d <= keep + 0.05) { out.there = true; return out; }
      out.went = cross(a, here, target.x, target.z, Math.min(dist, d - keep));
      if (out.went < 1e-3 && a.way && !a.way.pts.length) out.there = true;                       // as near as its body will go
      stopped(a, target, out);
      return out;
    }
    const path = roomRoute(level, here.id, there.id, cost(a));
    if (!path || path.length < 2) { out.cannot = true; return out; }
    const t = through(here, w.rooms[path[1]]), dA = Math.hypot(t.A.x - a.x, t.A.z - a.z);
    out.link = t.link;
    if (dA > 0.12) { out.went = cross(a, here, t.A.x, t.A.z, dist); if (out.went > 1e-3 || Math.hypot(t.A.x - a.x, t.A.z - a.z) > 0.3) { stopped(a, t.B, out); return out; } }
    const door = doorOf(t.link);
    if (door && (door.isShut || door.moving)) { out.door = door; return out; }
    a.thru = { ...t.B, link: t.link }; a.way = null;
    out.went += stride(a, t.B.x, t.B.z, dist - out.went);
    stopped(a, t.B, out);
    return out;
  }

  /** The rooms a walker could walk into from the one it is in: [{ room, shut }] — shut: through a door somebody has shut since it came this way. */
  function exits(a) {
    const here = W().roomAt(a.x, a.z); if (!here) return [];
    const c = cost(a);
    return here.def.doors.filter((d) => c(d, here.id, d.to) < Infinity).map((d) => ({ room: d.to, shut: !!doorOf(d.link)?.news }));
  }
  /** A spot `k` metres into room `to` through the doorway it shares with room `from` — or null if they share none. */
  function spotBeyond(from, to, k = 1) {
    const a = W().rooms[from], b = W().rooms[to]; if (!a.def.doors.some((d) => d.to === to)) return null;
    const t = through(a, b), dx = t.B.x - t.A.x, dz = t.B.z - t.A.z, len = Math.hypot(dx, dz) || 1;
    return { x: t.B.x + (dx / len) * (k - 0.45), z: t.B.z + (dz / len) * (k - 0.45) };
  }
  /** Somewhere to stand in a room: as near its middle as this walker fits. */
  function spotIn(a, id) {
    const rt = W().rooms[id], g = grid(a, rt), k = nearCell(rt, g, rt.def.cx, rt.def.cz);
    return g.ok[k] ? middle(rt, g, k) : { x: rt.def.cx, z: rt.def.cz };
  }
  /** How many doorways it is, for this walker, from where it is to a spot (Infinity: no way). */
  function steps(a, target) {
    const here = W().roomAt(a.x, a.z), there = W().roomAt(target.x, target.z);
    if (!here || !there) return Infinity;
    const c = roomCosts(level, here.id, cost(a), there.id).cost.get(there.id);
    return c === undefined ? Infinity : c;
  }
  return { stand, shy, cost, stride, clear, go, exits, spotIn, spotBeyond, steps,
    /** Try another doorway after a failed shove; retry later in case a body was temporarily in the way. */
    avoid(a, link) {
      const th = W().throats[link]; if (!th) return;
      (a.blockedLinks ||= new Map()).set(link, { version: linkVersion(th.a, th.b), until: (a.walkTime || 0) + RETRY_BARRICADE });
      a.way = null; a.thru = null;
    },
    forget(a) { a.way = null; a.thru = null; },
  };
}
