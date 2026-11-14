// The Backrooms — getting about. Pure: no three.js, no DOM, no world. Two
// searches that everything which walks down here shares: the way from one
// room to another through the doorways it is able to use, and the way across
// one room's floor round whatever is standing on it. What "able" means is the
// walker's own business (how tall it is, whether it can work a door handle):
// it is handed in as a cost.

/**
 * The rooms to walk through from a to b, both included, by the cheapest way — or null.
 * @param level  a generated floor: rooms[i].doors[] = { to, link, h, kind … }
 * @param cost   (door, from, to) → what going through that doorway costs this walker, ≥ 0 — Infinity: it cannot
 */
export function roomRoute(level, a, b, cost = () => 1) {
  const from = roomCosts(level, a, cost, b);
  if (!from.cost.has(b)) return null;
  const path = [];
  for (let r = b; r !== undefined; r = from.prev.get(r)) path.unshift(r);
  return path;
}

/** What it costs this walker to get from a to every room it can get to: { cost: Map(room → cost), prev: Map(room → the room before it) }. */
export function roomCosts(level, a, cost = () => 1, stopAt = null) {
  const best = new Map([[a, 0]]), prev = new Map(), open = [a], done = new Set();
  while (open.length) {
    let k = 0;
    for (let i = 1; i < open.length; i++) if (best.get(open[i]) < best.get(open[k])) k = i;
    const cur = open.splice(k, 1)[0];
    if (done.has(cur)) continue;
    done.add(cur);
    if (cur === stopAt) break;
    for (const d of level.rooms[cur].doors) {
      const c = cost(d, cur, d.to);
      if (!(c < Infinity) || done.has(d.to)) continue;
      const t = best.get(cur) + Math.max(0, c);
      if (!best.has(d.to) || t < best.get(d.to)) { best.set(d.to, t); prev.set(d.to, cur); open.push(d.to); }
    }
  }
  return { cost: best, prev };
}

const NEAR = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];

/**
 * The way across a floor: a grid of nx × nz cells, ok[k] non-zero where the walker fits.
 * From cell `from` to cell `to`, or — where `to` cannot be got to — to the cell nearest it that can.
 * No cutting a corner between two cells that are not both free, and no step up or down of more than `step`
 * where `floor` (a height per cell) is given.
 * @returns {{cells:number[], reached:boolean}}  the cells to walk through, `from` first · whether the last of them is `to`
 */
export function gridPath(nx, nz, ok, from, to, floor = null, step = 0.26) {
  if (!ok[from]) return { cells: [from], reached: from === to };
  const dist = new Int32Array(nx * nz).fill(-1), prev = new Int32Array(nx * nz).fill(-1);
  const ti = to % nx, tj = (to - ti) / nx;
  let queue = [from], end = from, endD = Infinity;
  dist[from] = 0;
  // a breadth-first flood in two rings (straight steps cost 10, diagonals 14): near enough to shortest, and cheap
  const buckets = new Map([[0, queue]]);
  let cur = 0, left = 1;
  while (left > 0) {
    const list = buckets.get(cur);
    if (!list || !list.length) { buckets.delete(cur); cur++; continue; }
    const k = list.pop(); left--;
    if (dist[k] !== cur) continue;
    const i = k % nx, j = (k - i) / nx, away = (i - ti) * (i - ti) + (j - tj) * (j - tj);
    if (away < endD) { endD = away; end = k; }
    if (k === to) break;
    for (const [di, dj, c] of NEAR) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const kk = ii + nx * jj;
      if (!ok[kk] || (di && dj && (!ok[i + di + nx * j] || !ok[i + nx * (j + dj)]))) continue;
      if (floor && Math.abs(floor[kk] - floor[k]) > step) continue;
      const d = cur + c;
      if (dist[kk] !== -1 && dist[kk] <= d) continue;
      dist[kk] = d; prev[kk] = k;
      if (!buckets.has(d)) buckets.set(d, []);
      buckets.get(d).push(kk); left++;
    }
  }
  const cells = [];
  for (let k = end; k !== -1; k = prev[k]) cells.unshift(k);
  return { cells, reached: end === to };
}

/** Drop the cells of a path that a straight walk between its neighbours does not need: `clear(a, b)` says whether a walker can go straight from cell a to cell b. */
export function straighten(cells, clear) {
  if (cells.length < 3) return cells.slice();
  const out = [cells[0]];
  let at = 0;
  while (at < cells.length - 1) {
    let next = at + 1;
    for (let k = Math.min(cells.length - 1, at + 24); k > at + 1; k--) if (clear(cells[at], cells[k])) { next = k; break; }
    out.push(cells[next]); at = next;
  }
  return out;
}
