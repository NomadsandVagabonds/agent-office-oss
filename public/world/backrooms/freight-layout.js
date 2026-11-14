// The freight room's floor plan. Pure data: also used by the generator's coin
// placement and by traversal tests. Do not import gen.js here.
function random(seed) {
  let s = 2166136261;
  for (const c of String(seed)) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rect = (x, z, w, d) => ({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
const overlaps = (a, b, pad = 0) => a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad;

/** Deliberately outside the maze, beside the front-right skirting. */
export function freightStash(room) { return [room.W / 2 - 1.7, room.D / 2 - 2.1, room.W / 2 - 1.1, room.D / 2 - 1.5]; }

export function freightLayout(room, seed = room.params?.layoutSeed ?? 0) {
  const { W, D, H } = room, R = random(seed), columns = 9, rows = 11;
  const cell = Math.min((W - 3.2) / columns, (D - 3.2) / rows, 1.9);
  const open = Array.from({ length: rows }, () => Array(columns).fill(false));
  const walk = (x, z) => {
    open[z][x] = true;
    const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    for (let i = dirs.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [dirs[i], dirs[j]] = [dirs[j], dirs[i]]; }
    for (const [dx, dz] of dirs) { const nx = x + dx, nz = z + dz; if (nx <= 0 || nz <= 0 || nx >= columns - 1 || nz >= rows - 1 || open[nz][nx]) continue; open[z + dz / 2][x + dx / 2] = true; walk(nx, nz); }
  };
  walk(5, rows - 2);
  open[rows - 1][5] = true;
  // A second opening makes the exterior aisle a deliberate route back out.
  open[1][0] = true;

  const bounds = { x0: -W / 2 + 1.2, x1: -0.8, z0: D / 2 - 6.4, z1: D / 2 - 1.25 };
  const work = {
    bounds,
    home: { x: -W / 2 + 4.0, z: D / 2 - 3.5 },
    loading: { x: -W / 2 + 5.4, z: D / 2 - 6.05 },
    pickup: { x: -W / 2 + 2.65, z: D / 2 - 6.05 },
    table: { x: -W / 2 + 2.65, z: D / 2 - 7.45 },
    crate: { x: -W / 2 + 5.4, z: D / 2 - 7.55, w: 1.45, d: 1.3, h: 0.84 },
  };
  const portal = { x: W * 0.22, z: -D / 2 + 3.8, w: 3.5, d: 3.35, h: 3.2, thickness: 0.18 };
  portal.outer = rect(portal.x, portal.z, portal.w, portal.d);
  portal.entry = { x: portal.x, z: portal.outer.z0 - 0.7 };
  portal.interior = { x0: portal.outer.x0 + 0.4, x1: portal.outer.x1 - 0.4, z0: portal.outer.z0 + 0.52, z1: portal.outer.z1 - 0.45 };
  portal.solids = [
    { x0: portal.outer.x0, x1: portal.outer.x0 + portal.thickness, z0: portal.outer.z0, z1: portal.outer.z1 },
    { x0: portal.outer.x1 - portal.thickness, x1: portal.outer.x1, z0: portal.outer.z0, z1: portal.outer.z1 },
    { x0: portal.outer.x0, x1: portal.outer.x1, z0: portal.outer.z1 - portal.thickness, z1: portal.outer.z1 },
  ];
  const reserved = [
    { x0: -W / 2 + 0.5, x1: -0.35, z0: D / 2 - 9.1, z1: D / 2 },
    { x0: -1.2, x1: 1.2, z0: D / 2 - 4.3, z1: D / 2 },
    { x0: portal.outer.x0 - 0.95, x1: portal.outer.x1 + 0.95, z0: -D / 2, z1: portal.outer.z1 + 0.95 },
    { x0: W / 2 - 2.6, x1: W / 2, z0: D / 2 - 3.0, z1: D / 2 },
  ];
  const crates = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    if (open[row][column]) continue;
    const x = (column - (columns - 1) / 2) * cell, z = (row - (rows - 1) / 2) * cell;
    const w = cell - 0.1, d = cell - 0.1, box = rect(x, z, w, d);
    if (reserved.some((r) => overlaps(box, r, 0.2))) continue;
    const h = 1.35 + Math.floor(R() * 4) * 0.43;
    crates.push({ x, z, w, d, h, stack: h > 2.1, tone: Math.floor(R() * 4), ...box });
  }
  // Columns rise from already-solid stacks, never from a walking lane.
  const pillars = crates.filter((c, i) => i % 9 === 3 && Math.abs(c.x) > 2).slice(0, 4).map((c) => ({ x: c.x, z: c.z, h: H, w: 0.42 }));
  const solids = [...crates.map(({ x0, z0, x1, z1 }) => ({ x0, z0, x1, z1 })), ...portal.solids,
    rect(work.table.x, work.table.z, 1.6, 0.8), rect(work.crate.x, work.crate.z, work.crate.w, work.crate.d)];
  return { seed: String(seed), cell, columns, rows, open, crates, pillars, portal, work, solids, stash: freightStash(room), entry: { x: 0, z: D / 2 - 0.7 } };
}
