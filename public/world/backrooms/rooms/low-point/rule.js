// Low Point — the plan of the room, and nothing that draws. Pure: no three.js, no DOM.
//
// A hall with a partition straight across its middle, floor to ceiling, its skirting board level with the hall's floor
// the whole way across like a ruler. In front of it and behind it the carpet sags: an upside-down truncated pyramid on
// each side, three long flat facets (a broad one down the hall, a steeper one at each side) that meet at the foot of the
// partition, `deep` below the skirting. There the carpet goes on, level, under the wall: a passage the width of the
// trough's bottom, as high as the trough is deep, so the bottom of the wall is the ceiling over your head. Then the same
// three facets back up the other side to the next office. A pencil lies at the very bottom, where everything dropped on
// this floor would roll. The doors in the partition stand at the old floor's height, on a level shelf each side.
//
// Everything a body meets is worked out here once, from the same numbers the builder draws with:
//   floorAt   the carpet's height anywhere (the world's rt.floorY): 0 is the hall's floor, the skirting's foot
//   headroom  from the carpet to the ceiling, or to the underside of the partition where a body is under it
//   solids    the partition either side of the passage, floor to ceiling
//   facets    every face drawn below the old floor: the six slopes, the passage's floor, walls and ceiling, and the
//             partition's two lower faces each side (the yellow wall that comes down to meet the carpet)
// Room frame, as every room: x across (−W/2…W/2), z deep (+D/2 the way in), y up from the hall's floor.

/** The numbers of the place. Metres. */
export const LOW = Object.freeze({
  thick: 0.6,              // the partition, face to face (the passage under it is this long)
  half: 0.65,              // half the width of the trough's bottom, and of the passage under the partition
  rim: 1.75,               // half the width of the trough where it meets the partition: past this the floor is level
  deep: 1.2,               // how far the bottom is under the skirting: the headroom in the passage (a stoop: under `stand`)
  landing: 1.2,            // level floor kept at each end of the hall, before the slope begins
  reach: 0.24,             // a body's half-width for headroom (player.js RADIUS 0.22, and a little)
  head: 0.62,              // least headroom anybody gets through (world.js HEAD)
  stand: 1.3,              // under this, the visitor stoops by themselves (player.js: EYE 1.1 + 0.2)
  step: 0.26,              // the most the floor may change between two spots a body stands on (world.js STEP)
  skirt: 0.11, proud: 0.022,   // the skirting board: its height, and how far it stands off the wall (the shell's)
  vox: 0.05,               // the steps the skirting takes down the partition's lower faces, at its slope
  door: { w: 0.8, h: 2.03, frame: 0.07, at: 2.32 },   // the plumb office doors in the partition, on the shelves, each face
  pencil: { len: 0.18, thick: 0.009 },
});

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * The room, for its inside width W, depth D and ceiling H, and the roll's params (pencil, turn).
 * @returns {{ W, D, H, T, a, b, deep, run, kx, kz, top, solids, pencil, o }}
 */
export function planOf(W, D, H, p = {}, o = LOW) {
  const T = o.thick, a = o.half, b = Math.min(o.rim, W / 2 - o.door.w - o.door.frame * 2 - 0.12), deep = o.deep;
  const run = r4(D / 2 - T / 2 - o.landing);            // how long each slope is, along the hall
  const kx = deep / (b - a), kz = deep / run;           // the slopes: across (the side facets) and along (the broad one)
  const top = r4(T / 2 + run);                          // |z| where the slopes reach the hall's floor
  const solids = [
    { what: 'partition', x0: -W / 2, z0: -T / 2, x1: -a, z1: T / 2, tall: true },
    { what: 'partition', x0: a, z0: -T / 2, x1: W / 2, z1: T / 2, tall: true },
  ];
  // the pencil: lying across the hall (along x) at the foot of the near slope, where it meets the level bottom, as a
  // pencil that rolled down the slope stops (it rolls across its length); a little off the middle, a little turned
  const pl = o.pencil, px = clamp(p.pencil ?? 0.12, -a + 0.2, a - 0.2), turn = clamp(p.turn ?? 0.06, -0.2, 0.2);
  const pencil = { x: px, z: r4(T / 2 + 0.05), rot: turn, len: pl.len, thick: pl.thick };
  const doors = [];
  for (const side of [1, -1]) for (const sx of [-1, 1]) doors.push({ side, x: sx * Math.min(o.door.at, W / 2 - o.door.w / 2 - o.door.frame - 0.03), z: side * T / 2, w: o.door.w, h: o.door.h });
  // (each door's lever stands off its face at waist height, near its free edge, which is the +x edge seen from in front of
  // it: wooddoor.model.js. Something to bump into, low: not tall)
  for (const d of doors) {
    const e = d.x + d.side * (d.w / 2 - 0.02), f = d.x + d.side * (d.w / 2 - 0.22);
    solids.push({ what: 'lever', x0: Math.min(e, f), z0: Math.min(d.z, d.z + d.side * 0.1), x1: Math.max(e, f), z1: Math.max(d.z, d.z + d.side * 0.1), tall: false });
  }
  return { W, D, H, T, a, b, deep, run, kx, kz, top, solids, pencil, doors, o };
}

/** How far the carpet is under the hall's floor at (x, z): the trough's two pyramids, and level under the partition. */
export function depthAt(plan, x, z) {
  const { T, a, deep, run, kx } = plan, s = Math.abs(z) - T / 2;
  const along = deep * (1 - Math.max(0, s) / run), across = deep - kx * Math.max(0, Math.abs(x) - a);
  return Math.max(0, Math.min(deep, along, across));
}
/** The carpet's height at (x, z) (rt.floorY). */
export function floorAt(plan, x, z) { const d = depthAt(plan, x, z); return d > 0 ? -d : 0; }

/** Is (x, z) under the partition's underside, for a body's reach about it: over the passage, or at its mouths. */
export function underWall(plan, x, z, reach = plan.o.reach) {
  return Math.abs(x) < plan.a && Math.abs(z) < plan.T / 2 + reach;
}
/** Headroom at a spot of the floor: to the ceiling, or (under the partition) to its underside, the hall's floor height. */
export function headroomAt(plan, x, z, reach = plan.o.reach) {
  const roof = underWall(plan, x, z, reach) ? 0 : plan.H;
  return roof - floorAt(plan, x, z);
}
/**
 * What the room tells the world (`rt.headY`): the headroom, except that where it is under the least anybody gets through
 * (world.js HEAD) it is none at all, so nothing is sent where the walk will not let it set foot.
 */
export function roomHead(plan, x, z) {
  const h = headroomAt(plan, x, z);
  return h < plan.o.head ? 0 : h;
}

/** Is the floor at (x, z) somewhere a body of radius r stands: inside the walls, clear of every solid? (Headroom apart.) */
export function standsAt(plan, x, z, r = 0.225) {
  const { W, D } = plan;
  if (Math.abs(x) > W / 2 - r || Math.abs(z) > D / 2 - r) return false;
  for (const s of plan.solids) { const dx = x - clamp(x, s.x0, s.x1), dz = z - clamp(z, s.z0, s.z1); if (dx * dx + dz * dz < r * r) return false; }
  return true;
}

/**
 * Walk the floor on a grid (as world.js walkable does: 12.5 cm cells, a body 0.225 m, at least `tall` of headroom, the
 * floor never changing by more than a step between neighbours) from one spot, and say whether another is reached, the
 * least headroom met on the way, and the steepest change of floor between two cells of it. → { reached, low, steep, path }
 */
export function walk(plan, from, to, { tall = plan.o.head, r = 0.225, cell = 0.125 } = {}) {
  const { W, D } = plan, nx = Math.ceil(W / cell), nz = Math.ceil(D / cell);
  const key = (p) => Math.floor((p.x + W / 2) / cell) + nx * Math.floor((p.z + D / 2) / cell);
  const at = (k) => { const i = k % nx; return { x: -W / 2 + (i + 0.5) * cell, z: -D / 2 + ((k - i) / nx + 0.5) * cell }; };
  const ok = (p) => standsAt(plan, p.x, p.z, r) && headroomAt(plan, p.x, p.z) >= tall;
  const start = key(from), goal = key(to), prev = new Int32Array(nx * nz).fill(-2), queue = [start];
  if (!ok(at(start))) return { reached: false, low: 0, steep: 0, path: [] };
  prev[start] = -1;
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi]; if (k === goal) break;
    const i = k % nx, j = (k - i) / nx, here = at(k), hy = floorAt(plan, here.x, here.z);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj, kk = ii + nx * jj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || prev[kk] !== -2) continue;
      const q = at(kk);
      if (!ok(q) || Math.abs(floorAt(plan, q.x, q.z) - hy) > plan.o.step) continue;
      prev[kk] = k; queue.push(kk);
    }
  }
  if (prev[goal] === -2) return { reached: false, low: 0, steep: 0, path: [] };
  const path = []; for (let k = goal; k !== -1; k = prev[k]) path.unshift(at(k));
  let steep = 0;
  for (let i = 1; i < path.length; i++) steep = Math.max(steep, Math.abs(floorAt(plan, path[i].x, path[i].z) - floorAt(plan, path[i - 1].x, path[i - 1].z)));
  return { reached: true, low: Math.min(...path.map((q) => headroomAt(plan, q.x, q.z))), steep, path };
}

/**
 * The most headroom anything of radius r keeps the whole way under the partition (the least of it along the passage,
 * its mouths included, at the best line across it): a walker taller than this cannot get from one end to the other,
 * and is not sent in (cast/walk.js, `rt.headway`).
 */
export function headwayOf(plan, r = 0.3, step = 0.02) {
  let best = 0;
  const z0 = plan.T / 2 + plan.o.reach;
  for (let x = -plan.a; x <= plan.a; x += step) {
    if (!standsAt(plan, x, 0, r)) continue;
    let least = Infinity;
    for (let z = -z0 - 0.02; z <= z0 + 0.02; z += 0.01) least = Math.min(least, headroomAt(plan, x, z));
    best = Math.max(best, least);
  }
  return Math.round(best * 1000) / 1000;
}

/**
 * Every face drawn below the hall's floor, as flat polygons (three or four corners, counter-clockwise from the side
 * they face) with their facing: what the builder sheets with carpet and wallpaper, and what the tests hold the
 * colliders and the floor to. kind: 'slope' (carpet), 'bottom' (the level carpet under the partition), 'wall'
 * (wallpaper, the partition's lower faces and the passage's sides), 'under' (the partition's underside).
 */
export function facets(plan) {
  const { T, a, b, deep, top } = plan, out = [];
  const add = (kind, pts, name) => {
    const [A, B, , Dd] = pts, C = pts[2];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [(pts.length === 4 ? Dd : C)[0] - A[0], (pts.length === 4 ? Dd : C)[1] - A[1], (pts.length === 4 ? Dd : C)[2] - A[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n); n = n.map((k) => k / l);
    out.push({ kind, name, pts, n });
  };
  for (const s of [1, -1]) {
    const zw = s * T / 2, zt = s * top, side = s > 0 ? 'near' : 'far';
    // (each wound counter-clockwise seen from the side it faces: up, or out into the hall it is in)
    const ccw = (pts) => (s > 0 ? [pts[0], ...pts.slice(1).reverse()] : pts);
    add('slope', ccw([[-a, -deep, zw], [a, -deep, zw], [b, 0, zt], [-b, 0, zt]]), `${side} slope`);
    add('slope', ccw([[a, -deep, zw], [b, 0, zw], [b, 0, zt]]), `${side} right side`);
    add('slope', ccw([[-a, -deep, zw], [-b, 0, zt], [-b, 0, zw]]), `${side} left side`);
    // the partition's lower faces, from the carpet's line up to the hall's floor, each side of the passage
    add('wall', ccw([[a, -deep, zw], [a, 0, zw], [b, 0, zw]]), `${side} wall right`);
    add('wall', ccw([[-a, -deep, zw], [-b, 0, zw], [-a, 0, zw]]), `${side} wall left`);
  }
  // under the partition: the level carpet, its two sides and its ceiling
  add('bottom', [[-a, -deep, T / 2], [a, -deep, T / 2], [a, -deep, -T / 2], [-a, -deep, -T / 2]], 'passage floor');
  add('wall', [[a, -deep, -T / 2], [a, -deep, T / 2], [a, 0, T / 2], [a, 0, -T / 2]], 'passage right');
  add('wall', [[-a, -deep, T / 2], [-a, -deep, -T / 2], [-a, 0, -T / 2], [-a, 0, T / 2]], 'passage left');
  add('under', [[-a, 0, -T / 2], [a, 0, -T / 2], [a, 0, T / 2], [-a, 0, T / 2]], 'underside');
  return out;
}

/** Light that gets down there: 0…1 of the bake's, for a spot of carpet or wall (it does not reach far under the partition). */
export function shadeAt(plan, x, y, z) {
  const { T, deep } = plan, s = Math.abs(z) - T / 2;
  const sm = (t) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };
  if (s < 0) return 0.42 - 0.14 * sm(-s / (T / 2));                       // under the partition: darker toward the middle of the passage
  const low = sm((y + deep) / deep), lee = sm(s / 0.6);                  // the bottom of the trough, and the foot of the partition
  return (0.7 + 0.3 * low) * (0.78 + 0.22 * lee);
}

/** Where a body could wear the carpet: the line from one end of the hall to the other, down the middle. 0…1. */
export function wornAt(plan, x, z) {
  const sm = (t) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };
  return 1 - sm((Math.abs(x) - 0.18) / 0.32);
}
