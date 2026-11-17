import { evalFlume } from '../../waterpark.rule.js';

export const CONNECTOR = 'flume-connector';
export const OFFICE = 'flooded-cubicles';
export const BEACH = 'office-beach-day';
export const TUBE_RADIUS = .83;
export const AXIS_Y = .52;
export const WALK_HALF = .51;
export const BEACH_FLOOR = -2.36;
export const BEACH_WATER = BEACH_FLOOR - .07;
export const BEACH_BED = BEACH_FLOOR - .21;

export function flumePlan({ W, D }) {
  const edge = W / 2 + .11, front = D / 2 + .11;
  const fork = [0, .56, 1.44];
  return [
    [[0, AXIS_Y, front], [0, AXIS_Y, front - .55], [.67, .63, 3.68], [.51, .60, 2.50], fork],
    [fork, [-.91, .63, .98], [-1.98, .75, -.34], [-3.35, .61, -.32], [-edge + .49, AXIS_Y, 0], [-edge, AXIS_Y, 0]],
    [fork, [1.02, .51, .93], [1.88, .37, .04], [3.07, .42, -.43], [edge - .55, AXIS_Y, 0], [edge, AXIS_Y, 0]],
  ];
}

export function tubeSamples(pts, count = 56) {
  return Array.from({ length: count + 1 }, (_, i) => evalFlume(pts, i / count));
}

export function nearestTube(runs, x, z) {
  let best = Infinity, y = AXIS_Y;
  for (const run of runs) for (let i = 1; i < run.length; i++) {
    const a = run[i - 1], b = run[i], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const d = (x - a.x - t * dx) ** 2 + (z - a.z - t * dz) ** 2;
    if (d < best) { best = d; y = a.y + t * (b.y - a.y); }
  }
  return { gap: Math.sqrt(best), y: y - AXIS_Y };
}

const contains = (p, x, z) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1;

function stairs(bounds, axis, highAtMin) {
  const low = axis + '0', high = axis + '1';
  const n = 13, run = (bounds[high] - bounds[low]) / n;
  return Array.from({ length: n }, (_, i) => ({
    ...bounds, [low]: bounds[low] + i * run, [high]: bounds[low] + (i + 1) * run,
    y: BEACH_FLOOR * ((highAtMin ? i : n - 1 - i) + .5) / n,
  }));
}

export function beachPlan({ W, D }) {
  const front = D / 2, left = -W / 2, right = W / 2, back = -D / 2;
  const entry = { x0: left, x1: right, z0: front - 1.19, z1: front + .18 };
  const sideStairs = { x0: right - 1.66, x1: right, z0: -.13, z1: entry.z0 };
  const exitStairs = { x0: left - .16, x1: left + 3.78, z0: -.92, z1: .92 };
  // Three spans make a chamfered, nearly empty kiddie pool without a dense mesh.
  const basin = [
    { x0: -1.22, x1: .88, z0: 1.06, z1: 1.42 },
    { x0: -1.67, x1: 1.30, z0: 1.42, z1: 3.02 },
    { x0: -1.22, x1: .88, z0: 3.02, z1: 3.36 },
  ];
  const drop = [[0, AXIS_Y, front + .12], [0, AXIS_Y, front - .52],
    [.04, .48, front - 1.18], [.04, .29, front - 1.71], [.04, -.18, front - 2.22], [.04, -.64, front - 2.49]];
  const hole = { x0: -.91, x1: .98, z0: front - 3.01, z1: entry.z0 };
  const landing = { x: .08, z: front - 3.20 };
  return { front, left, right, back, entry, sideStairs, exitStairs,
    treads: [...stairs(sideStairs, 'z', false), ...stairs(exitStairs, 'x', true)], basin, drop, hole, landing };
}

export function beachFloor(plan, x, z) {
  if (contains(plan.entry, x, z)) return 0;
  const tread = plan.treads.find(p => contains(p, x, z));
  if (tread) return tread.y;
  if (plan.basin.some(p => contains(p, x, z))) return BEACH_BED;
  return BEACH_FLOOR;
}
