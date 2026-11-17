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

export function divePlan({ W, D }) {
  const bottom = -7.72, water = -7.24;
  const platforms = [
    { x: 0, half: 2.28, nose: D/2-3.08, rear: D/2, y: 0 },
    { x: .76, half: 1.95, nose: 6.22, rear: D/2-3.83, y: -1.17 },
    { x: -.43, half: 1.84, nose: 2.43, rear: 5.42, y: -2.35 },
    { x: -1.62, half: 1.73, nose: -1.45, rear: 1.60, y: -3.55 },
  ];
  const entry = platforms[0].nose;
  const stairs = [
    { x0: 5.91, x1: W/2, z0: -3.8, z1: entry, high: 0, low: bottom },
    { x0: -1.48, x1: 1.48, z0: -D/2+1.65, z1: -4.9, high: bottom, low: 0 },
  ];
  // Both flights use ordinary player step heights. The side flight is a
  // maintenance route back to the entrance and a fallback for exploration.
  const treads = stairs.flatMap(({ x0,x1,z0,z1,high,low }) =>
    Array.from({ length: 37 }, (_, i) => ({
      x0, x1, z0: z1-(z1-z0)*(i+1)/37, z1: z1-(z1-z0)*i/37,
      y: high+(low-high)*(i+1)/37,
    })));
  const rim = { x0: -1.48, x1: 1.48, z0: -D/2, z1: stairs[1].z0, y: 0 };
  const pool = { x0: -7.45, x1: 5.3, z0: -9.75, z1: -2.95 };
  const landing = { x: -2.85, y: bottom, z: -4.05 };
  const flights = platforms.map((from, i) => {
    const next = platforms[i+1];
    return {
      from, x: next?.x ?? landing.x, y: next?.y ?? landing.y,
      z: next ? next.rear-.8 : landing.z, seconds: next ? .60 : 1.26, plunge: !next,
    };
  });
  return { W, D, bottom, water, platforms, stairs, treads, rim, pool, flights, landing };
}

export function towerFloor(p, x, z) {
  if (z >= p.platforms[0].nose) return 0;
  if (x >= p.rim.x0 && x <= p.rim.x1 && z <= p.rim.z1) return 0;
  for (const board of p.platforms) {
    if (Math.abs(x-board.x) <= board.half && z >= board.nose && z <= board.rear) return board.y;
  }
  for (const stair of p.treads) {
    if (x >= stair.x0 && x <= stair.x1 && z >= stair.z0 && z <= stair.z1) return stair.y;
  }
  return p.bottom;
}

export function inPool(p, x, z) {
  return x > p.pool.x0 && x < p.pool.x1 && z > p.pool.z0 && z < p.pool.z1
    && towerFloor(p,x,z) <= p.water;
}

export function flightAt(from, to, progress, plunge = false) {
  const t = Math.max(0, Math.min(1, progress));
  const drop = plunge ? t*t : t;
  return {
    x: from.x+(to.x-from.x)*t, z: from.z+(to.z-from.z)*t,
    y: from.y+(to.y-from.y)*drop + Math.sin(t*Math.PI)*(plunge ? .16 : .46),
  };
}
