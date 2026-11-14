// MECHA's guards navigate the same solids as the player. This graph is room
// local and lazy: constructing it before the room finishes would miss cages.
const CELL = .25, RADIUS = .36, SAMPLE = .08, MAX_CELLS = 12000;

export function createLabNavigation(c) {
  let graph = null;
  const world = () => c.world || c.env?.world;
  const finite = p => Number.isFinite(p?.x) && Number.isFinite(p?.z);

  function free(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > c.W / 2 - RADIUS || Math.abs(z) > c.D / 2 - RADIUS) return false;
    const w = world();
    if (!w) return false;
    const p = c.toWorld(x, z);
    // Moving guards do not obstruct their own paths. Static cage, console,
    // chair and wall collisions all count, regardless of their `tall` flag.
    return w.free(p.x, p.z, RADIUS, { ghost: true });
  }

  function clear(ax, az, bx, bz) {
    if (!free(ax, az) || !free(bx, bz)) return false;
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / SAMPLE));
    const w = world();
    let previous = c.toWorld(ax, az);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (i < steps && !free(x, z)) return false;
      const at = c.toWorld(x, z);
      if (w.passable && !w.passable(previous.x, previous.z, at.x, at.z)) return false;
      previous = at;
    }
    return true;
  }

  function build() {
    if (graph) return graph;
    if (!world()) return null;
    let cell = CELL, nx = Math.ceil(c.W / cell), nz = Math.ceil(c.D / cell);
    while (nx * nz > MAX_CELLS) { cell *= 1.02; nx = Math.ceil(c.W / cell); nz = Math.ceil(c.D / cell); }
    const count = nx * nz, valid = new Uint8Array(count), edges = new Int32Array(count * 4);
    const cells = [], points = new Array(count);
    edges.fill(-1);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = i + j * nx, p = { x: -c.W / 2 + (i + .5) * cell, z: -c.D / 2 + (j + .5) * cell };
      points[k] = p;
      if (free(p.x, p.z)) { valid[k] = 1; cells.push(k); }
    }
    // Check each undirected edge once. An endpoint-only check could jump over
    // a thin cage rail, even when both neighbouring grid cells are free.
    for (const k of cells) {
      const i = k % nx, j = (k - i) / nx, a = points[k];
      for (const [next, out, back] of [[i + 1 < nx ? k + 1 : -1,0,1],[j + 1 < nz ? k + nx : -1,2,3]]) {
        if (next < 0 || !valid[next]) continue;
        const b = points[next];
        if (clear(a.x, a.z, b.x, b.z)) { edges[k * 4 + out] = next; edges[next * 4 + back] = k; }
      }
    }
    graph = { points, cells, edges, previous: new Int32Array(count), seen: new Uint32Array(count), queue: new Int32Array(count), serial: 0 };
    return graph;
  }

  function nearestKey(p, visible = false) {
    const g = build();
    if (!g || !finite(p) || !g.cells.length) return -1;
    if (!visible) {
      let best = -1, distance = Infinity;
      for (const k of g.cells) {
        const q = g.points[k], d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
        if (d < distance) { best = k; distance = d; }
      }
      return best;
    }
    // The closest cell may be on the other side of a rail. Search in distance
    // order until the guard can actually reach the chosen attachment point.
    const candidates = g.cells.map(k => ({ k, d: (g.points[k].x - p.x) ** 2 + (g.points[k].z - p.z) ** 2 }));
    candidates.sort((a, b) => a.d - b.d);
    for (const { k } of candidates) { const q = g.points[k]; if (clear(p.x, p.z, q.x, q.z)) return k; }
    return -1;
  }

  function nearest(p) {
    const k = nearestKey(p);
    return k < 0 ? null : { ...graph.points[k] };
  }

  function route(from, to) {
    if (!finite(from) || !finite(to) || !free(from.x, from.z)) return [];
    if (Math.hypot(to.x - from.x, to.z - from.z) < 1e-5) return [];
    if (clear(from.x, from.z, to.x, to.z)) return [{ x: to.x, z: to.z }];
    // The player is narrower than a guard. When they hug a wall, the guard
    // approaches the nearest safe point instead of abandoning the pursuit.
    const start = nearestKey(from, true), end = nearestKey(to, free(to.x, to.z)), g = graph;
    if (start < 0 || end < 0 || !g) return [];
    if (++g.serial >= 0xffffffff) { g.seen.fill(0); g.serial = 1; }
    let head = 0, tail = 1;
    g.queue[0] = start; g.seen[start] = g.serial; g.previous[start] = -1;
    while (head < tail && g.seen[end] !== g.serial) {
      const k = g.queue[head++];
      for (let side = 0; side < 4; side++) {
        const next = g.edges[k * 4 + side];
        if (next < 0 || g.seen[next] === g.serial) continue;
        g.seen[next] = g.serial; g.previous[next] = k; g.queue[tail++] = next;
      }
    }
    if (g.seen[end] !== g.serial) return [];
    const raw = [];
    for (let k = end; k !== -1; k = g.previous[k]) raw.push(g.points[k]);
    raw.reverse();
    raw.unshift({ x: from.x, z: from.z });
    // Exact endpoints are appended only after a full-body collision test.
    const last = raw[raw.length - 1];
    if (clear(last.x, last.z, to.x, to.z)) raw.push({ x: to.x, z: to.z });

    // Drop straight grid runs first, then skip corners only when the entire
    // body fits along the shortcut. This also avoids snapping backwards to a
    // cell centre each time a moving guard requests another route.
    const corners = [raw[0]];
    for (let i = 1; i < raw.length - 1; i++) {
      const a = raw[i - 1], b = raw[i], d = raw[i + 1];
      const ux = b.x-a.x, uz = b.z-a.z, vx = d.x-b.x, vz = d.z-b.z;
      if (Math.abs(ux*vz-uz*vx) > 1e-7 || ux*vx+uz*vz < 0) corners.push(b);
    }
    corners.push(raw[raw.length - 1]);
    const out = [];
    let anchor = corners[0], at = 0;
    while (at < corners.length - 1) {
      let next = corners.length - 1;
      while (next > at && !clear(anchor.x, anchor.z, corners[next].x, corners[next].z)) next--;
      if (next === at) return []; // A collider changed after the graph was built.
      anchor = corners[next]; at = next;
      if (!out.length || Math.hypot(anchor.x-out[out.length-1].x,anchor.z-out[out.length-1].z) > 1e-5) out.push({ ...anchor });
    }
    return out;
  }

  return { free, clear, route, nearest };
}
