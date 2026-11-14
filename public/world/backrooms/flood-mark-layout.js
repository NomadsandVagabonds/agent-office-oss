// A stable floor beneath an unstable-looking surface. No geometry depends on
// the tide: a route memorized at low water is still there when the water rises.
export const FLOOD_PERIOD = 56;
export const FLOOD_LOW = -0.5;
export const FLOOD_HIGH = 0.14;
const STEP = 0.18, CELL = 0.4;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smooth = n => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const inRect = (x, z, b, inset = 0) => x >= b.x0 + inset && x <= b.x1 - inset && z >= b.z0 + inset && z <= b.z1 - inset;
const rectDistance = (x, z, b) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));

/** The first eight seconds allow a new arrival to look from the dry dock. */
export function floodPhase(time) {
  const t = ((time % FLOOD_PERIOD) + FLOOD_PERIOD) % FLOOD_PERIOD;
  let amount = 1, phase = 'high';
  if (t >= 8 && t < 16) { phase = 'draining'; amount = 1 - smooth((t - 8) / 8); }
  else if (t >= 16 && t < 36) { phase = 'low'; amount = 0; }
  else if (t >= 36 && t < 44) { phase = 'rising'; amount = smooth((t - 36) / 8); }
  return { phase, time: t, amount, water: FLOOD_LOW + (FLOOD_HIGH - FLOOD_LOW) * amount };
}

export function planFloodMark({ W = 17.8, D = 23.8 } = {}) {
  if (!Number.isFinite(W) || !Number.isFinite(D) || W < 14 || D < 20) throw new RangeError('Flood-Mark Hall needs at least 14 × 20 m.');
  const sx = W / 17.8, sz = D / 23.8, halfLane = 0.8;
  const nodes = [[0, D / 2], [0, 7.2 * sz], [-3.2 * sx, 7.2 * sz], [-3.2 * sx, 3.2 * sz], [2.4 * sx, 3.2 * sz],
    [2.4 * sx, -1.6 * sz], [-2.4 * sx, -1.6 * sz], [-2.4 * sx, -6.4 * sz], [0, -6.4 * sz], [0, -D / 2]].map(([x, z]) => ({ x, z }));
  const path = nodes.slice(1).map((b, i) => { const a = nodes[i]; return { x0: Math.min(a.x, b.x) - halfLane, z0: Math.min(a.z, b.z) - halfLane,
    x1: Math.max(a.x, b.x) + halfLane, z1: Math.max(a.z, b.z) + halfLane }; });
  const islands = [[-3.2, 5.2], [2.4, 0.8], [-2.4, -4.4]].map(([x, z], i) => ({
    id: i + 1, x: x * sx, z: z * sz, x0: x * sx - 1.3, x1: x * sx + 1.3, z0: z * sz - 1.25, z1: z * sz + 1.25,
  }));
  const docks = [{ id: 0, x: 0, z: D / 2 - .75, x0: -W / 2, x1: W / 2, z0: D / 2 - 1.6, z1: D / 2 },
    { id: 4, x: 0, z: -D / 2 + .75, x0: -W / 2, x1: W / 2, z0: -D / 2, z1: -D / 2 + 1.6 }];
  const surfaces = [...path, ...docks, ...islands.map(b => ({ x0: b.x0 - .45, x1: b.x1 + .45, z0: b.z0 - .45, z1: b.z1 + .45 }))];
  const nx = Math.ceil(W / CELL), nz = Math.ceil(D / CELL), dx = W / nx, dz = D / nz, cells = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x0 = -W / 2 + i * dx, z0 = -D / 2 + j * dz, x = x0 + dx / 2, z = z0 + dz / 2;
    const island = islands.find(b => inRect(x, z, b));
    const distance = Math.min(...surfaces.map(b => rectDistance(x, z, b)));
    const tier = distance < 1e-8 ? 0 : Math.min(5, Math.ceil(distance / .45));
    cells.push({ x0, z0, x1: x0 + dx, z1: z0 + dz, y: island ? STEP : tier ? -tier * STEP : 0, raised: !!island, path: tier === 0 });
  }
  return { W, D, nx, nz, dx, dz, cells, path, nodes, islands, docks, waterBounds: { x0: -W / 2, x1: W / 2, z0: -D / 2 + 1.6, z1: D / 2 - 1.6 } };
}

export function floodFloor(plan, x, z) {
  const i = clamp(Math.floor((x + plan.W / 2) / plan.dx), 0, plan.nx - 1);
  const j = clamp(Math.floor((z + plan.D / 2) / plan.dz), 0, plan.nz - 1);
  return plan.cells[i + plan.nx * j].y;
}

/** A checkpoint is acquired only well inside a dry platform, not at its lip. */
export function floodRefuge(plan, x, z) {
  return [...plan.docks, ...plan.islands].find(b => inRect(x, z, b, .32)) || null;
}

/** Depth and time, not a random event, govern a soft return to the last refuge. */
export function floodExposure(plan, phase, x, z) {
  const floor = floodFloor(plan, x, z), inBasin = inRect(x, z, plan.waterBounds);
  const depth = inBasin ? Math.max(0, phase.water - floor) : 0;
  return { floor, depth, deep: depth > .65, wet: depth > .03 };
}
