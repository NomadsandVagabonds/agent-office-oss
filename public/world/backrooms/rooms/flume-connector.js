import { lin, WHITE } from '../kit.js';
import { M, Vox } from '../../vox/vox.js';
import { flumePlan, nearestTube, tubeSamples, TUBE_RADIUS, WALK_HALF, AXIS_Y } from './flume-connector/plan.js';
import { tubeRunnels } from './flume-connector/water.js';

const CELL = .058;
const COLORS = ['#c8a351', '#6d9e91', '#b76555'];

function joinedFlumes(runs, W, D) {
  const v = new Vox(), outer = TUBE_RADIUS / CELL, inner = .73 / CELL;
  const paths = runs.map(run => run.map(p => [p.x / CELL, p.y / CELL, p.z / CELL]));
  for (const [n, pts] of paths.entries()) {
    const vinyl = M(COLORS[n], 0), seal = M(['#9f803d', '#51756a', '#9a5146'][n], 0);
    for (let i = 1; i < pts.length; i++) v.tube(...pts[i - 1], ...pts[i], outer, vinyl);
    for (let i = 9; i < pts.length - 5; i += 15) v.tube(...pts[i - 1], ...pts[i], outer + .62, seal);
  }
  // Carve all three interiors in one pass so the bore stays open at the fork.
  for (const [n, pts] of paths.entries()) {
    for (let i = 1; i < pts.length; i++) v.tube(...pts[i - 1], ...pts[i], inner, 0);
    const [a, b] = n === 0 ? [pts[0], pts[1]] : [pts.at(-1), pts.at(-2)];
    const delta = a.map((value, j) => value - b[j]), d = Math.hypot(...delta);
    v.tube(...a, ...a.map((value, j) => value + delta[j] * outer / d), inner, 0);
  }
  return v.remap((x, _y, z, col) => Math.abs((x + .5) * CELL) > W / 2 + .14
    || (z + .5) * CELL > D / 2 + .14 ? 0 : col);
}

export function build(c) {
  const runs = flumePlan(c.room).map(pts => tubeSamples(pts));
  c.shell({ panels: false, skirting: false, sockets: false, floor: false, ceilAlb: lin('#333635'),
    wallAlb: lin('#3b403d') });
  c.rt.amb = lin('#b2b5a4', .19);
  c.rt.clip = (x, z, r) => nearestTube(runs, x, z).gap <= WALK_HALF - r;
  c.rt.floorY = (x, z) => nearestTube(runs, x, z).y;
  c.rt.headY = () => .89;
  c.model('return-tubes:joined-bore', () => joinedFlumes(runs, c.W, c.D), 0, 0,
    { scale: CELL / .025, solid: false, shadow: false });

  // The molded tread follows the same spline as movement.
  for (const [index, run] of runs.entries()) {
    const color = lin(COLORS[index], .69);
    const edge = (p, side) => [p.x + p.tz * WALK_HALF * side, p.y - AXIS_Y, p.z - p.tx * WALK_HALF * side];
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1], b = run[i];
      c.flat.quad(edge(a, -1), edge(b, -1), edge(b, 1), edge(a, 1), i % 7 ? color : WHITE);
    }
  }
  tubeRunnels(c, runs);
  c.light(0, .68, c.D / 2 - .44, '#f2d4a8', .86, { far: 3.1, k: 1.7 });
  c.light(-c.W / 2 + .47, .65, .09, '#96d4c0', .63, { far: 2.3, k: 1.6 });
  c.light(c.W / 2 - .47, .63, .07, '#dc9474', .64, { far: 2.7, k: 1.6 });
}
