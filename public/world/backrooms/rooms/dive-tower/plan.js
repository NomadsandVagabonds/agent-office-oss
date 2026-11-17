import { AQUA } from '../../waterpark.rule.js';

export const MAZE = 'smiler-maze';
export const TOWER = 'dive-tower';

export function mazePlan({ W, D }) {
  const edge = W / 2, gap = 2.65, lane = edge - gap / 2;
  return {
    walls: [
      [-edge, 3.6, edge - gap, 3.88],
      [-edge + gap, -.2, edge, .08],
      [-edge, -4, edge - gap, -3.72],
      [-3.15, 5.1, -2.93, D / 2 - .03],
      [2.7, -.2, 2.93, .79],
    ],
    route: [[0,D/2-.75], [lane,5.7], [lane,2.22], [-lane,2.22],
      [-lane,-2.1], [lane,-2.1], [lane,-5.7], [0,-6.2], [0,-D/2]],
  };
}

function staircase(bounds, axis, atMin, atMax) {
  const lo = axis + '0', hi = axis + '1';
  const count = Math.ceil(Math.abs(atMax - atMin) / .21);
  const run = (bounds[hi] - bounds[lo]) / count;
  return Array.from({ length: count }, (_, i) => {
    const from = bounds[lo] + i * run, to = from + run;
    const y = atMin + (atMax - atMin) * (i + .5) / count;
    return { ...bounds, [lo]: from, [hi]: to, y, axis, lip: atMin < atMax ? from : to };
  });
}

export function divePlan({ W, D }) {
  const deckY = -15.6, water = deckY - .18, bottom = water - 2.95;
  const swimY = water + .23 - AQUA.eye;
  const platforms = [
    { x: 0, half: 2.28, nose: D/2-3.08, rear: D/2, y: 0 },
    { x: .76, half: 1.95, nose: 6.22, rear: D/2-3.83, y: -1.17 },
    { x: -.43, half: 1.84, nose: 2.43, rear: 5.42, y: -2.35 },
    { x: -1.62, half: 1.73, nose: -1.45, rear: 1.60, y: -3.55 },
  ];
  const pool = { x0: -7.45, x1: 5.3, z0: -7.4, z1: -.95 };
  const turn = { x0: -8.78, x1: -7.65, z0: -12.55, z1: -7.5, y: deckY / 2 };
  const exit = { x0: -.95, x1: 1.48, z0: -D / 2 - .14, z1: -10.35, y: 0 };
  const landings = [turn, exit];
  // The long side stair leads back to the entrance. Two transverse flights
  // climb the far wall to the exit. Every riser is within normal step height.
  const treads = [
    ...staircase({ x0: 5.91, x1: W / 2, z0: -9.8, z1: platforms[0].nose }, 'z', deckY, 0),
    ...staircase({ x0: turn.x1, x1: 0, z0: -9.4, z1: turn.z1 }, 'x', turn.y, deckY),
    ...staircase({ x0: turn.x1, x1: exit.x0, z0: turn.z0, z1: exit.z1 }, 'x', turn.y, 0),
  ];
  const poolSteps = staircase({ x0: -1.45, x1: 1.45, z0: pool.z0, z1: pool.z0 + 3.15 },
    'z', deckY, bottom);
  const landing = { x: -2.85, y: swimY, z: -4.05 };
  const flights = platforms.map((from, i) => {
    const next = platforms[i+1];
    return {
      from, x: next?.x ?? landing.x, y: next?.y ?? landing.y,
      z: next ? next.rear-.8 : landing.z, seconds: next ? .60 : 1.88, plunge: !next,
    };
  });
  return { W, D, bottom, deckY, water, swimY, platforms, landings, treads, pool, poolSteps, flights, landing };
}

const covers = (p, x, z) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1;

export function towerFloor(p, x, z) {
  if (z >= p.platforms[0].nose) return 0;
  for (const board of p.platforms) {
    if (Math.abs(x-board.x) <= board.half && z >= board.nose && z <= board.rear) return board.y;
  }
  for (const stair of p.treads) {
    if (covers(stair, x, z)) return stair.y;
  }
  for (const landing of p.landings) {
    if (covers(landing, x, z)) return landing.y;
  }
  if (!covers(p.pool, x, z)) return p.deckY;
  return p.poolSteps.find(step => covers(step, x, z))?.y ?? p.bottom;
}

export function inPool(p, x, z) {
  return covers(p.pool, x, z) && towerFloor(p, x, z) < p.water;
}

export function towerSupport(p, x, z) {
  const floor = towerFloor(p, x, z);
  return covers(p.pool, x, z) ? Math.max(floor, p.swimY) : floor;
}

export function flightAt(from, to, progress, plunge = false) {
  const t = Math.max(0, Math.min(1, progress));
  const drop = plunge ? t*t : t;
  return {
    x: from.x+(to.x-from.x)*t, z: from.z+(to.z-from.z)*t,
    y: from.y+(to.y-from.y)*drop + Math.sin(t*Math.PI)*(plunge ? .16 : .46),
  };
}
