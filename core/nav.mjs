// The Office — walking. A* over the layout's 1 m tile grid, honouring walls
// (edges between tiles) and furniture (blocked tiles), then string-pulled so
// avatars cut corners like people instead of marching the grid.
// Pure and shared: the client animates along these paths, the daemon uses the
// same function to know how long a walk takes.
import { edgeKey, tileKey } from './layout.mjs';

const SQRT2 = Math.SQRT2;
export const WALK_SPEED = 1.5;       // metres per second
export const RUN_SPEED = 3.2;

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(node) {
    const a = this.items;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export function createNav(layout) {
  const { wallEdges } = layout;
  const walkable = (x, z) => layout.walkable(x, z);

  /** Can you step between two orthogonally adjacent tiles? */
  function stepOpen(x, z, nx, nz) {
    if (!walkable(nx, nz)) return false;
    if (nx !== x) return !wallEdges.has(edgeKey('v', Math.max(x, nx), z));
    return !wallEdges.has(edgeKey('h', x, Math.max(z, nz)));
  }

  function moveOpen(x, z, dx, dz) {
    if (dx === 0 || dz === 0) return stepOpen(x, z, x + dx, z + dz);
    // A diagonal must be clear both ways round the corner.
    return stepOpen(x, z, x + dx, z) && stepOpen(x + dx, z, x + dx, z + dz)
      && stepOpen(x, z, x, z + dz) && stepOpen(x, z + dz, x + dx, z + dz);
  }

  /** The closest walkable tile to a point (itself, if it already is one). */
  function nearestWalkable(px, pz, maxRing = 6) {
    const cx = Math.floor(px), cz = Math.floor(pz);
    if (walkable(cx, cz)) return { x: cx, z: cz };
    let best = null, bestD = Infinity;
    for (let ring = 1; ring <= maxRing && !best; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const x = cx + dx, z = cz + dz;
          if (!walkable(x, z)) continue;
          const d = (x + 0.5 - px) ** 2 + (z + 0.5 - pz) ** 2;
          if (d < bestD) { bestD = d; best = { x, z }; }
        }
      }
    }
    return best;
  }

  /** Straight walk between two points without clipping a wall or a desk. */
  function clearLine(ax, az, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(dist / 0.2));
    let px = Math.floor(ax), pz = Math.floor(az);
    if (!walkable(px, pz)) return false;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.floor(ax + (bx - ax) * t), z = Math.floor(az + (bz - az) * t);
      if (x === px && z === pz) continue;
      if (Math.abs(x - px) > 1 || Math.abs(z - pz) > 1) return false;
      if (!moveOpen(px, pz, x - px, z - pz)) return false;
      px = x; pz = z;
    }
    return true;
  }

  function tilePath(start, goal) {
    const startKey = tileKey(start.x, start.z);
    const goalKey = tileKey(goal.x, goal.z);
    if (startKey === goalKey) return [start];
    const h = (x, z) => {
      const dx = Math.abs(x - goal.x), dz = Math.abs(z - goal.z);
      return (dx + dz) + (SQRT2 - 2) * Math.min(dx, dz);
    };
    const open = new MinHeap();
    const g = new Map([[startKey, 0]]);
    const from = new Map();
    const closed = new Set();
    open.push({ x: start.x, z: start.z, f: h(start.x, start.z), k: startKey });
    let guard = 0;
    while (open.size && guard++ < 20000) {
      const cur = open.pop();
      if (closed.has(cur.k)) continue;
      if (cur.k === goalKey) {
        const out = [{ x: cur.x, z: cur.z }];
        let k = cur.k;
        while (from.has(k)) { const p = from.get(k); out.push({ x: p.x, z: p.z }); k = p.k; }
        return out.reverse();
      }
      closed.add(cur.k);
      const base = g.get(cur.k);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dz) continue;
          if (!moveOpen(cur.x, cur.z, dx, dz)) continue;
          const nx = cur.x + dx, nz = cur.z + dz;
          const nk = tileKey(nx, nz);
          if (closed.has(nk)) continue;
          const cost = base + (dx && dz ? SQRT2 : 1);
          if (cost < (g.get(nk) ?? Infinity)) {
            g.set(nk, cost);
            from.set(nk, { x: cur.x, z: cur.z, k: cur.k });
            open.push({ x: nx, z: nz, f: cost + h(nx, nz), k: nk });
          }
        }
      }
    }
    return null;
  }

  /**
   * Waypoints from one point to another (world metres). The first point is
   * `from` itself. Returns null when there is no way through.
   */
  function findPath(from, to) {
    const a = nearestWalkable(from.x, from.z);
    const b = nearestWalkable(to.x, to.z);
    if (!a || !b) return null;
    const tilesOnPath = tilePath(a, b);
    if (!tilesOnPath) return null;
    const pts = tilesOnPath.map((t) => ({ x: t.x + 0.5, z: t.z + 0.5 }));
    // If the endpoints are themselves on walkable tiles, start/end exactly there.
    const fromOk = walkable(Math.floor(from.x), Math.floor(from.z));
    const toOk = walkable(Math.floor(to.x), Math.floor(to.z));
    if (fromOk) pts[0] = { x: from.x, z: from.z };
    else pts.unshift({ x: from.x, z: from.z });
    if (toOk) pts[pts.length - 1] = { x: to.x, z: to.z };
    else pts.push({ x: to.x, z: to.z });
    // String-pull: keep a waypoint only when the straight line would clip.
    const out = [pts[0]];
    let anchor = 0;
    for (let i = 2; i < pts.length; i++) {
      const lineOk = (anchor > 0 || fromOk) && (i < pts.length - 1 || toOk)
        && clearLine(pts[anchor].x, pts[anchor].z, pts[i].x, pts[i].z);
      if (!lineOk) { out.push(pts[i - 1]); anchor = i - 1; }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function pathLength(path) {
    let total = 0;
    for (let i = 1; i < (path?.length || 0); i++) {
      total += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    }
    return total;
  }

  /** Seconds to walk between two points (straight-line fallback if no path). */
  function walkSeconds(from, to, speed = WALK_SPEED) {
    const path = findPath(from, to);
    const metres = path ? pathLength(path) : Math.hypot(to.x - from.x, to.z - from.z);
    return metres / speed;
  }

  return { findPath, pathLength, walkSeconds, nearestWalkable, clearLine, stepOpen, walkable };
}
