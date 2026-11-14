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
import { toWorld, toLocal, T } from '../gen.js';
import { roomRoute, roomCosts, gridPath, straighten } from './paths.js';

const CELL = 0.125, STEP = 0.26;
/** What a shut door costs a walker that can open one, in rooms: it would go some way round sooner than stop and work a handle. */
export const DOOR_COST = 3;

export function createWalk(env) {
  const W = () => env.world, level = env.level;
  const grids = new Map();                         // room id + who → { nx, nz, ok, floor, version }
  const doorOf = (id) => env.doors?.at(id) || null;

  const stand = (a, x, z) => W().free(x, z, a.r, { ghost: true }) && W().headroom(x, z) >= a.tall;
  /** Rooms it will not go into: ones that fold space, and ones it could not stand up in. */
  const shy = (a, rt) => !rt || rt.fold || rt.def.crawl || rt.def.H < a.tall + 0.05;
  /** What a doorway costs this walker (cast/paths.js): Infinity where it cannot go. */
  const cost = (a) => (d, from, to) => {
    const th = W().throats[d.link], door = doorOf(d.link);
    if (!th || d.h < a.tall || shy(a, W().rooms[to])) return Infinity;
    if (door && door.isShut) return a.opens ? 1 + DOOR_COST : Infinity;
    return th.open ? 1 : Infinity;
  };

  function grid(a, rt) {
    const key = rt.id + ':' + a.r + ':' + a.tall, version = env.doors?.version || 0;
    let g = grids.get(key);
    if (g && g.version === version) return g;
    const def = rt.def, nx = Math.max(1, Math.ceil(def.W / CELL)), nz = Math.max(1, Math.ceil(def.D / CELL));
    g = { nx, nz, ok: new Uint8Array(nx * nz), floor: new Float32Array(nx * nz), version };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const p = toWorld(def, -def.W / 2 + (i + 0.5) * CELL, -def.D / 2 + (j + 0.5) * CELL), k = i + nx * j;
      if (W().roomAt(p.x, p.z) !== rt) continue;
      g.ok[k] = stand(a, p.x, p.z) ? 1 : 0; g.floor[k] = W().floorY(p.x, p.z);
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
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 0.1));
    let px = x0, pz = z0;
    for (let i = 1; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n; if (!stand(a, x, z) || !W().passable(px, pz, x, z)) return false; px = x; pz = z; }
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
        if (stand(a, nx, nz) && W().passable(a.x, a.z, nx, nz)) { a.x = nx; a.z = nz; moved = true; break; }
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

  /**
   * Walk toward a spot for `dist` metres, by whatever rooms lie between.
   * @param a       the walker
   * @param target  { x, z }
   * @param dist    metres it may go this time
   * @param keep    stop this far short of the spot
   * @returns {{went:number, door:object|null, cannot:boolean, there:boolean}}  how far it got · the shut door it is standing at, if one is in
   *          its way · there is no way there at all · it is as near as it is going to get
   */
  function go(a, target, dist, keep = 0) {
    const w = W(), here = w.roomAt(a.x, a.z), there = w.roomAt(target.x, target.z), out = { went: 0, door: null, cannot: false, there: false };
    if (a.way) a.way.age += dist / Math.max(0.2, a.speed || 1);
    if (!here) { out.cannot = true; return out; }
    // somewhere its body does not fit (something was shut on it, or put down round it): the nearest floor that it does
    if (!stand(a, a.x, a.z)) { const g = grid(a, here), k = nearCell(here, g, a.x, a.z); if (g.ok[k]) { const m = middle(here, g, k); a.x = m.x; a.z = m.z; a.way = null; a.thru = null; } }
    // half way through a doorway: finish going through it
    if (a.thru) {
      out.went = stride(a, a.thru.x, a.thru.z, dist);
      if (Math.hypot(a.thru.x - a.x, a.thru.z - a.z) < 0.1 || out.went < 1e-3) a.thru = null;
      return out;
    }
    if (!there) { out.cannot = true; return out; }
    if (here === there) {
      const d = Math.hypot(target.x - a.x, target.z - a.z);
      if (d <= keep + 0.05) { out.there = true; return out; }
      out.went = cross(a, here, target.x, target.z, Math.min(dist, d - keep));
      if (out.went < 1e-3 && a.way && !a.way.pts.length) out.there = true;                       // as near as its body will go
      return out;
    }
    const path = roomRoute(level, here.id, there.id, cost(a));
    if (!path || path.length < 2) { out.cannot = true; return out; }
    const t = through(here, w.rooms[path[1]]), dA = Math.hypot(t.A.x - a.x, t.A.z - a.z);
    if (dA > 0.12) { out.went = cross(a, here, t.A.x, t.A.z, dist); if (out.went > 1e-3 || Math.hypot(t.A.x - a.x, t.A.z - a.z) > 0.3) return out; }
    const door = doorOf(t.link);
    if (door && (door.isShut || door.moving)) { out.door = door; return out; }
    a.thru = t.B; a.way = null;
    out.went += stride(a, t.B.x, t.B.z, dist - out.went);
    return out;
  }

  /** The rooms a walker could walk into from the one it is in: [{ room, shut }] — shut: through a door somebody has shut since it came this way. */
  function exits(a) {
    const here = W().roomAt(a.x, a.z); if (!here) return [];
    const c = cost(a);
    return here.def.doors.filter((d) => c(d, here.id, d.to) < Infinity).map((d) => ({ room: d.to, shut: !!doorOf(d.link)?.news }));
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
  return { stand, shy, cost, stride, clear, go, exits, spotIn, steps, forget(a) { a.way = null; a.thru = null; } };
}
