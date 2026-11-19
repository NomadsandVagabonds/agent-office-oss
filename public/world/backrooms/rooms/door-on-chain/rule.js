// The Door on the Chain — the plan of the room, and nothing that draws. Pure: no three.js, no DOM.
//
// What looks like a wood-panelled hall is the gap behind one enormous office door standing ajar. Its back face is the
// left wall the whole way from the hinge (by the door you come in at) to the latch edge; past the edge the hall opens
// into a slice of ordinary office with an ordinary door in its far wall (`through` in the deck: that doorway is always
// there, with a room beyond). Across the hall, a door-security chain the size of the corridor: four brass links from a
// slide plate on the door to a steel plate on the wall. It sags, its wall end raised: under that end there is room to
// get by with the automatic duck, and nowhere else.
//
// Everything a body meets is worked out here once, from the same numbers the builder draws with:
//   solids    what stands on the floor (the slab of the door, its jamb, the ordinary leaf standing open)
//   overhead  every piece of brass and steel over the floor, as boxes: the headroom anywhere is the underside of the
//             lowest one within a body's reach of the spot, so nothing drawn is ever walked through, and where a body
//             cannot get under (less than world.js HEAD) it cannot pass at all.
// Room frame, as every room: x across (−W/2…W/2), z deep (+D/2 the way in), y up from the carpet.

/** The numbers of the place. Metres. */
export const CHAIN = Object.freeze({
  face: -1.45,             // x of the door's back face (the left wall of the hall)
  slice: 3.2,              // how deep the ordinary office past the latch edge is
  scale: 6.5,              // the door is an ordinary office door (wooddoor.model.js, 0.9 × 2.03 m) this many times over
  thick: 0.29,             // …and so this thick at its latch edge (an ordinary leaf is 0.044 m)
  crack: 0.4,              // how far the dark slot behind the latch edge goes in
  gap: 0.05,               // the crack at the hinge, where the light comes through
  jamb: 0.45, proud: 0.12, // the jamb at the hinge: its width along the hall, and how far it stands off the door's face
  plateAt: 0.7,            // the chain's slide plate: this far from the latch edge
  links: 4,                // four long oval links
  pitch: 0.92,             // centre of one joint to the next
  bar: 0.1,                // the links' stock, square, so each face catches the light on its own (faceted)
  inner: 0.15,             // half the width of the hole in a link (a head goes through)
  doorY: 0.95,             // where the chain leaves the slide plate on the door
  wallY: 1.86,             // where it goes into the plate on the wall: the raised end
  reach: 0.24,             // a body's half-width for headroom (player.js RADIUS 0.22, and a little)
  head: 0.62,              // least headroom anybody gets through (world.js HEAD)
  stand: 1.3,              // under this, the visitor stoops by themselves (player.js: EYE 1.1 + 0.2)
  ordinary: { w: 1.0, h: 2.03, leaf: 0.044 },   // the door at the far end, and its doorway
});

/** The ordinary office door the giant one is, in its own proportions (wooddoor.model.js, at 1.25 cm voxels: 72 × 162). */
export const DOOR_PARTS = Object.freeze({ across: 72, high: 162, stile: 7, foot: 13, mid: 6, lock: 0.44, lockH: 10, head: 8, vox: 0.0125 });

const r4 = (v) => Math.round(v * 1e4) / 1e4;

/**
 * Hang `n` equal rigid links of pitch `s` between A and B (x, y in the plane of the chain): each joint carries the same
 * weight, so the slope of each link goes up by the same step (tan θ_i = k (i − c)). → the joints, A first, B last.
 */
export function hang(A, B, n, s) {
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const sums = (k, c) => { let sx = 0, sy = 0; for (let i = 0; i < n; i++) { const th = Math.atan(k * (i + 0.5 - c)); sx += Math.cos(th); sy += Math.sin(th); } return [sx, sy]; };
  const centre = (k) => {            // the c that points the chain from A at B, for this k
    let lo = -50, hi = 50;
    for (let it = 0; it < 80; it++) { const m = (lo + hi) / 2, [sx, sy] = sums(k, m); if (sy / sx > dy / dx) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  if (s * n <= Math.hypot(dx, dy) + 1e-6) throw new Error('the chain is too short to reach');
  let lo = 0, hi = 40;
  for (let it = 0; it < 80; it++) { const k = (lo + hi) / 2, [sx] = sums(k, centre(k)); if (dx / sx < s) lo = k; else hi = k; }
  const k = (lo + hi) / 2, c = centre(k), [sx] = sums(k, c), pitch = dx / sx;
  const pts = [[A[0], A[1]]];
  for (let i = 0; i < n; i++) { const th = Math.atan(k * (i + 0.5 - c)), p = pts[i]; pts.push([p[0] + pitch * Math.cos(th), p[1] + pitch * Math.sin(th)]); }
  return pts;
}

/**
 * One link as the bars it is made of: an elongated octagon of square stock, its hole `pitch` long so that each link's
 * end sits in the next one's. Its plane is the chain's own (upright) or turned a quarter about its length (flat).
 * → [{ c: [x, y, z], ax: [[u], [v], [w]], half: [hu, hv, hw] }] oriented boxes in the room frame.
 */
export function linkBars(p, q, z, flat, o = CHAIN) {
  const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy), u = [dx / len, dy / len, 0];
  const up = [-u[1], u[0], 0], across = [0, 0, 1];
  const v = flat ? across : up, w = flat ? up : across;
  const t = o.bar, A = len / 2 + t / 2, B = o.inner + t / 2, k = B * 0.6;
  const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, z];
  const ring = [[A - k, B], [-(A - k), B], [-A, B - k], [-A, -(B - k)], [-(A - k), -B], [A - k, -B], [A, -(B - k)], [A, B - k]];
  const at = (a, b) => [mid[0] + u[0] * a + v[0] * b, mid[1] + u[1] * a + v[1] * b, mid[2] + u[2] * a + v[2] * b];
  const bars = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], e = [b[0] - a[0], b[1] - a[1]], el = Math.hypot(e[0], e[1]);
    const eu = [u[0] * e[0] / el + v[0] * e[1] / el, u[1] * e[0] / el + v[1] * e[1] / el, u[2] * e[0] / el + v[2] * e[1] / el];
    const n = [eu[1] * w[2] - eu[2] * w[1], eu[2] * w[0] - eu[0] * w[2], eu[0] * w[1] - eu[1] * w[0]];
    bars.push({ c: at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), ax: [eu, n, w], half: [el / 2 + t * 0.2, t / 2, t / 2] });
  }
  return bars;
}

/** The eight corners of an oriented box. */
export function corners(b) {
  const out = [];
  for (const i of [-1, 1]) for (const j of [-1, 1]) for (const k of [-1, 1]) {
    out.push([0, 1, 2].map((d) => b.c[d] + b.ax[0][d] * b.half[0] * i + b.ax[1][d] * b.half[1] * j + b.ax[2][d] * b.half[2] * k));
  }
  return out;
}

/** An oriented box cut into short lengths, each as the axis-aligned box round it: what a body has to get under. */
function pieces(b, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = -1 + (2 * i) / n, e = -1 + (2 * (i + 1)) / n, h = (e - a) / 2, m = (a + e) / 2;
    const c = [0, 1, 2].map((d) => b.c[d] + b.ax[0][d] * b.half[0] * m);
    const cs = corners({ c, ax: b.ax, half: [b.half[0] * h, b.half[1], b.half[2]] });
    out.push({ x0: Math.min(...cs.map((p) => p[0])), x1: Math.max(...cs.map((p) => p[0])), y0: Math.min(...cs.map((p) => p[1])), y1: Math.max(...cs.map((p) => p[1])), z0: Math.min(...cs.map((p) => p[2])), z1: Math.max(...cs.map((p) => p[2])) });
  }
  return out;
}

/**
 * The room, for its inside width W (always 3.8: the deck says 4 m, wall to wall), depth D and ceiling H. Its frame.
 * @returns {{ W, D, H, face, edge, hinge, jambZ, zc, plate, strike, joints, links, overhead, solids, leaf, door, back }}
 */
export function planOf(W, D, H, o = CHAIN) {
  const half = W / 2, face = o.face;
  const edge = r4(-D / 2 + o.slice);                       // z of the latch edge: the hall behind the door ends here
  const doorLong = DOOR_PARTS.across * DOOR_PARTS.vox * o.scale;   // the giant leaf, hinge edge to latch edge
  const hinge = r4(edge + doorLong), jambZ = r4(hinge + o.gap);    // its hinge edge, and the jamb after the crack
  const zc = r4(edge + o.plateAt);                         // the line of the chain
  // the two plates: brass slide plate on the door (its knob is where the chain starts), steel plate on the wall
  const plate = { x0: face, x1: face + 0.05, y0: o.doorY - 0.15, y1: o.doorY + 0.15, z0: zc - 0.62, z1: zc + 0.36 };
  const strike = { x0: half - 0.07, x1: half, y0: o.wallY - 0.42, y1: o.wallY + 0.42, z0: zc - 0.27, z1: zc + 0.27 };
  const A = [face + 0.05 + 0.1, o.doorY], B = [half - 0.07 - 0.05, o.wallY];
  const joints = hang(A, B, o.links, o.pitch);
  const links = [];
  for (let i = 0; i < o.links; i++) links.push({ flat: i % 2 === 1, bars: linkBars(joints[i], joints[i + 1], zc, i % 2 === 1, o) });
  const knob = { x0: face + 0.05, x1: A[0] + 0.05, y0: o.doorY - 0.06, y1: o.doorY + 0.06, z0: zc - 0.06, z1: zc + 0.06 };
  // what hangs over the floor: every bar of every link in short lengths, the knob, the two plates, the latch tongue
  const overhead = [];
  for (const l of links) for (const b of l.bars) overhead.push(...pieces(b, Math.max(1, Math.ceil((b.half[0] * 2) / 0.06))));
  overhead.push(knob, plate, strike);
  const tongue = { x0: face - o.thick * 0.72, x1: face - o.thick * 0.28, y0: 2.18, y1: 2.42, z0: edge - 0.22, z1: edge };
  if (tongue.y1 < H - 0.05) overhead.push(tongue);
  // what stands on the floor: the door (all of it to the wall behind: nobody gets round the back of it), the dark slot
  // behind its latch edge left open (too narrow for anybody: 0.26 m), the jamb at the hinge proud of the face, the wall
  // after it to the front, and the ordinary door at the far end standing open into this room on its hinge
  const ow = o.ordinary;
  const leaf = { x0: -ow.w / 2 - 0.012 - ow.leaf, x1: -ow.w / 2 - 0.012, z0: -D / 2 + 0.015, z1: -D / 2 + 0.015 + ow.w - 0.02 };
  const solids = [
    { what: 'door', x0: face - o.thick, z0: edge, x1: face, z1: hinge, tall: true },
    { what: 'door', x0: -half, z0: edge + o.crack, x1: face - o.thick, z1: hinge, tall: true },
    { what: 'jamb', x0: -half, z0: hinge, x1: face + o.proud, z1: jambZ + o.jamb, tall: true },
    { what: 'wall', x0: -half, z0: jambZ + o.jamb, x1: face, z1: D / 2, tall: true },
    { what: 'leaf', ...leaf, tall: true },
    // (its lever stands off the face at waist height, near its free edge: wooddoor.model.js)
    { what: 'handle', x0: leaf.x1, z0: leaf.z1 - 0.3, x1: leaf.x1 + 0.1, z1: leaf.z1 - 0.02, tall: false },
  ];
  // (everything overhead, in one box: a spot further than a body's reach from it has the whole ceiling over it)
  const band = { x0: Math.min(...overhead.map((b) => b.x0)), x1: Math.max(...overhead.map((b) => b.x1)), z0: Math.min(...overhead.map((b) => b.z0)), z1: Math.max(...overhead.map((b) => b.z1)) };
  return { W, D, H, face, edge, hinge, jambZ, zc, plate, strike, knob, tongue, joints, links, overhead, band, solids, leaf, doorLong, o };
}

/** Headroom at a spot of the floor: the room's ceiling, or the underside of the lowest thing over it within a body's reach. */
export function headroomAt(plan, x, z, reach = plan.o.reach) {
  let h = plan.H;
  const k = plan.band;
  if (x < k.x0 - reach || x > k.x1 + reach || z < k.z0 - reach || z > k.z1 + reach) return h;
  for (const b of plan.overhead) if (x > b.x0 - reach && x < b.x1 + reach && z > b.z0 - reach && z < b.z1 + reach && b.y0 < h) h = b.y0;
  return h;
}

/**
 * What the room tells the world (`rt.headY`): the headroom, except that where it is under the least anybody gets through
 * (world.js HEAD) it is none at all. The walk lets nothing set foot there whatever its size (world.passable), and a
 * creature shorter than that must not be sent there by its grid (cast/walk.js stand asks only its own height).
 */
export function roomHead(plan, x, z) {
  const h = headroomAt(plan, x, z);
  return h < plan.o.head ? 0 : h;
}

/** Is the floor at (x, z) somewhere a body of radius r stands: inside the walls, clear of every solid? (Headroom apart.) */
export function standsAt(plan, x, z, r = 0.225) {
  const { W, D } = plan;
  if (Math.abs(x) > W / 2 - r || Math.abs(z) > D / 2 - r) return false;
  for (const s of plan.solids) { const dx = x - Math.max(s.x0, Math.min(x, s.x1)), dz = z - Math.max(s.z0, Math.min(z, s.z1)); if (dx * dx + dz * dz < r * r) return false; }
  return true;
}

/**
 * Walk the floor on a grid (as world.js walkable does: 12.5 cm cells, a body 0.225 m, at least `tall` of headroom) from
 * one spot, and say whether another is reached, and the least headroom met on the way there. → { reached, low, path }
 */
export function walk(plan, from, to, { tall = plan.o.head, r = 0.225, cell = 0.125 } = {}) {
  const { W, D } = plan, nx = Math.ceil(W / cell), nz = Math.ceil(D / cell);
  const key = (p) => Math.floor((p.x + W / 2) / cell) + nx * Math.floor((p.z + D / 2) / cell);
  const at = (k) => { const i = k % nx; return { x: -W / 2 + (i + 0.5) * cell, z: -D / 2 + ((k - i) / nx + 0.5) * cell }; };
  const ok = (p) => standsAt(plan, p.x, p.z, r) && headroomAt(plan, p.x, p.z) >= tall;
  const start = key(from), goal = key(to), prev = new Int32Array(nx * nz).fill(-2), queue = [start];
  if (!ok(at(start))) return { reached: false, low: 0, path: [] };
  prev[start] = -1;
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi]; if (k === goal) break;
    const i = k % nx, j = (k - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj, kk = ii + nx * jj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || prev[kk] !== -2 || !ok(at(kk))) continue;
      prev[kk] = k; queue.push(kk);
    }
  }
  if (prev[goal] === -2) return { reached: false, low: 0, path: [] };
  const path = []; for (let k = goal; k !== -1; k = prev[k]) path.unshift(at(k));
  return { reached: true, low: Math.min(...path.map((p) => headroomAt(plan, p.x, p.z))), path };
}

/** The way under the chain: the stretch of the chain's line where a body gets through, and its headroom there. */
export function gapUnder(plan, step = 0.02) {
  const { W } = plan, xs = [];
  for (let x = -W / 2; x <= W / 2; x += step) if (standsAt(plan, x, plan.zc) && headroomAt(plan, x, plan.zc) >= plan.o.head) xs.push(x);
  if (!xs.length) return null;
  const heads = xs.map((x) => headroomAt(plan, x, plan.zc));
  return { x0: xs[0], x1: xs[xs.length - 1], low: Math.min(...heads), high: Math.max(...heads) };
}

/**
 * The most headroom anything of radius r has on the way through (under the raised end, where it fits between the walls):
 * a walker taller than this cannot get from one end to the other, and is not sent in (cast/walk.js, `rt.headway`).
 */
export function headwayOf(plan, r = 0.3, step = 0.02) {
  let best = 0;
  for (let x = -plan.W / 2; x <= plan.W / 2; x += step) if (standsAt(plan, x, plan.zc, r)) best = Math.max(best, headroomAt(plan, x, plan.zc));
  return Math.round(best * 1000) / 1000;
}
