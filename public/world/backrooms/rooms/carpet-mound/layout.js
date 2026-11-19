// The Backrooms — Carpet Allowance: where everything in the room is, and the shape of the fold. Pure: no three.js, no kit.
//
// The wall-to-wall carpet was cut several metres too long, and the excess has risen in one great pleat down the length
// of the room: an inverted U of carpet, its cut edges showing the tan backing in coarse voxel steps, a dark gap under
// it tall enough to duck into. Two ways on: the short blind one under the fold, or round its edge on the open side.
//
// Everything is in the room's own frame (x across, z deep, the way in at z = +D/2, its doorway in the middle: an
// oddity's front doorway is always centred). The fold runs along z, put to one side (`side`) so that from the doorway
// you look into its mouth at a slant and the walk round it is on the other side.

/** The fixed numbers of the fold. Metres. */
export const MOUND = {
  ro: 1.9,          // half its width at the foot, outside
  crown: 1.62,      // the top of the outside at its highest
  t: 0.1,           // the carpet with its backing (a voxel model's two inches, doubled: it has to read from the doorway)
  v: 0.05,          // the voxel step of its cut edges
  aisle: 1.2,       // the floor left between its foot and the wall on its own side
  front: 2.35,      // floor kept between its front mouth and the front wall (the stapler is there)
  back: 1.45,       // …and between its back mouth and the back wall
  stand: 0.7,       // under the fold, where the gap is less than this, it is solid
};

const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** A small whole-number hash, for the jagged edges: the same every time for the same arguments. Nothing seeded is read. */
export const hash = (...n) => { let h = 2166136261; for (const k of n) h = Math.imul(h ^ (Math.round(k * 1000) | 0), 16777619); h ^= h >>> 13; return (Math.imul(h, 2246822519) >>> 0) / 4294967296; };

/** Where things are, from the room's size and what it rolled. */
export function layout(W, D, p = {}) {
  const s = p.side === -1 ? -1 : 1, { ro, aisle, front, back } = MOUND;
  const xc = s * Math.max(0, W / 2 - aisle - ro);
  const z0 = -D / 2 + back, z1 = D / 2 - front;
  // the runner stripe: the narrow worn band the carpet was laid with, on the flank that faces the walk round
  const stripe = xc - s * ro * 0.42;
  return {
    s, xc, z0, z1, len: z1 - z0, sag: p.sag ?? 0.05, stripe,
    stapler: { x: xc + s * ro * 0.32, z: z1 + 0.9, rot: p.stapler ?? 0.4 },
    // three bright snags where the carpet pulled free of the wall on the fold's own side, near the way in
    snags: [0, 1, 2].map((i) => ({ x: s * (W / 2 - 0.05), z: z1 - 0.55 + i * 0.52 + (p.snag ?? 0.5) * 0.2 })),
    reward: { x: -s * (W / 2 - 0.95), z: -D / 2 + 0.95 },
  };
}

/** How the crown sags along its length: 0 at the mouths, the most halfway. */
const sagAt = (L, z) => 1 - L.sag * Math.sin(Math.PI * Math.max(0, Math.min(1, (z - L.z0) / L.len)));
/** The outside of the fold at `d` across from its middle line and `z` along: a broad sagging crown, steep flanks, flaring out flat at the foot. */
export function outer(L, d, z) {
  const u = Math.abs(d) / MOUND.ro;
  if (u >= 1) return 0;
  return MOUND.crown * sagAt(L, z) * ((1 + Math.cos(Math.PI * u ** 1.6)) / 2) ** 0.6;
}
/** Its slope across, d(outer)/dd. */
export function slope(L, d, z) { const e = 0.002; return (outer(L, d + e, z) - outer(L, d - e, z)) / (2 * e); }
/** The underside: the outside less the carpet's thickness, measured square to it. 0 where the sheet lies on the floor. */
export function inner(L, d, z) {
  const y = outer(L, d, z) - MOUND.t * Math.hypot(1, slope(L, d, z));
  return y > 0 ? y : 0;
}
/** How far across from the middle line the gap under it is at least `h` high (at z). */
export function reach(L, h, z = L.z0) {
  let lo = 0, hi = MOUND.ro;
  if (inner(L, 0, z) < h) return 0;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (inner(L, m, z) >= h) lo = m; else hi = m; }
  return lo;
}
/** The voxel columns of a cut edge: each MOUND.v wide, the lowest and highest the sheet reaches over it, snapped out to the step. */
export function columns(L, z) {
  const { ro, v } = MOUND, out = [];
  for (let x0 = -ro; x0 < ro - 1e-9; x0 += v) {
    let top = 0, bot = Infinity;
    for (let k = 0; k <= 4; k++) { const d = x0 + (v * k) / 4; top = Math.max(top, outer(L, d, z)); bot = Math.min(bot, inner(L, d, z)); }
    if (top < 0.012) continue;
    const y1 = Math.max(v, Math.ceil(top / v - 0.15) * v), y0 = bot > v * 0.5 ? Math.floor(bot / v + 0.15) * v : 0;
    out.push({ x0, x1: x0 + v, y0: Math.min(y0, y1 - v), y1 });
  }
  return out;
}
/** How many voxels each column of a mouth stands proud of the cut (1 or 2, now and then 3): the torn look in plan. */
export const jag = (i, end) => { const h = hash(i, end, 7); return h < 0.55 ? 1 : h < 0.95 ? 2 : 3; };
/** The headroom over a spot of floor (room frame), where the fold is over it; null where it is not. */
export function headroom(L, x, z) {
  const reachZ = 3 * MOUND.v + 0.02;
  if (z < L.z0 - reachZ || z > L.z1 + reachZ || Math.abs(x - L.xc) >= MOUND.ro) return null;
  const zz = Math.max(L.z0, Math.min(L.z1, z)), y = inner(L, x - L.xc, zz);
  // (under the cut edge the backing's voxels hang a step lower than the smooth sheet)
  return z < L.z0 + 0.02 || z > L.z1 - 0.02 ? Math.max(0, y - MOUND.v) : y;
}
/** The two solid flanks under the fold, in the room's frame: where its gap is lower than MOUND.stand, out to its foot. */
export function flanks(L) {
  const zs = [L.z0, (L.z0 + L.z1) / 2, L.z1], inn = Math.min(...zs.map((z) => reach(L, MOUND.stand, z)));
  let out = MOUND.ro;
  while (out > 0 && outer(L, out, L.z0) < 0.1) out -= 0.01;
  const z0 = L.z0 - 3 * MOUND.v, z1 = L.z1 + 3 * MOUND.v;
  return [-1, 1].map((k) => ({ x0: Math.min(L.xc + k * inn, L.xc + k * out), x1: Math.max(L.xc + k * inn, L.xc + k * out), z0, z1 }));
}
/** How much of the fluorescent light gets in under the fold at z: 1 at a mouth, falling off into the middle. */
export const reachIn = (L, z) => { const dz = Math.max(0, Math.min(z - L.z0, L.z1 - z)); return 0.12 + 0.88 * Math.exp(-dz / 0.6); };
export { smooth };

/** Where the room hides what the seed leaves in it: the far corner of the walk round. */
export const stash = (r) => { const L = layout(r.W, r.D, r.params || {}), x = L.reward.x, z = L.reward.z; return [x - 0.35, z - 0.35, x + 0.35, z + 0.35]; };

/**
 * Its line in the deck, ready to go into MORE_DECK (deck2.js) as it is. Until then it is dealt only on the dev page,
 * with &preview=mound (preview-deck.js), and is in nobody's visit.
 */
export const CARPET_MOUND = {
  id: 'carpet-mound', name: 'Carpet Allowance', landmark: 'the carpet that was cut too long',
  w: [8, 10], d: [10, 12], ports: ['left', 'right', 'back'], weight: 1, lights: 'normal',
  module: './rooms/carpet-mound.js', stash,
  roll: (R) => ({ side: R.pick([-1, 1]), sag: R.range(0.03, 0.07), stapler: R.range(-0.9, 0.9), snag: R.range(0, 1) }),
};
