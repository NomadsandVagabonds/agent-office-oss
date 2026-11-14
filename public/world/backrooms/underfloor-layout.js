// The structural crawl route and conservative head clearances, without a renderer.
export const UNDERFLOOR = Object.freeze({ ceiling: 0.98, bayHead: 0.86, flex: 0.16 });
export const inRect = (p, b, pad = 0) => p.x >= b.x0 + pad && p.x <= b.x1 - pad && p.z >= b.z0 + pad && p.z <= b.z1 - pad;

export function underfloorPlan(W = 11.8, D = 19.8) {
  if (!Number.isFinite(W) || !Number.isFinite(D) || W < 9 || D < 18) throw new RangeError('Underfloor Walker needs a broad room at least 18m deep.');
  const end = D / 2 - 2.3, zs = [end - 2.8, 0, -end + 2.8];
  const lane = { x0: -1.3, z0: -end, x1: 1.3, z1: end };
  const shelters = zs.map((z, id) => ({ id, x0: id === 1 ? 1.3 : -3.8, x1: id === 1 ? 3.8 : -1.3, z0: z - 1.1, z1: z + 1.1,
    center: { x: id === 1 ? 2.65 : -2.65, z } }));
  const crossings = zs.map((z, id) => ({ id, x0: -1.3, x1: 1.3, z0: z - 0.95, z1: z + 0.95, z }));
  const spaces = [lane, ...shelters];
  const xs = [-W / 2, -3.8, -1.3, 1.3, 3.8, W / 2];
  const zcuts = [...new Set([-end, end, ...shelters.flatMap(b => [b.z0, b.z1])])].sort((a, b) => a - b);
  const solids = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zcuts.length - 1; j++) {
    const b = { x0: xs[i], x1: xs[i + 1], z0: zcuts[j], z1: zcuts[j + 1] };
    if (!spaces.some(s => inRect({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }, s))) solids.push(b);
  }
  return { W, D, end, lane, shelters, crossings, solids, entry: { x: 0, z: end + 1.1 }, exit: { x: 0, z: -end - 1.1 } };
}

/** Exact, disjoint deck rectangles. The moving spans and fixed roof share edges,
 * never faces; an aperture is a real hole all the way through the upper floor. */
export function underfloorSurfacePlan(plan) {
  const fixed = [], apertures = [], patches = [], grateHalf = .60;
  let z = -plan.end;
  for (const crossing of [...plan.crossings].sort((a, b) => a.z0 - b.z0)) {
    if (crossing.z0 > z) fixed.push({ x0: -plan.W / 2, x1: plan.W / 2, z0: z, z1: crossing.z0 });
    fixed.push({ x0: -plan.W / 2, x1: crossing.x0, z0: crossing.z0, z1: crossing.z1 });
    fixed.push({ x0: crossing.x1, x1: plan.W / 2, z0: crossing.z0, z1: crossing.z1 });
    z = crossing.z1;
  }
  if (z < plan.end) fixed.push({ x0: -plan.W / 2, x1: plan.W / 2, z0: z, z1: plan.end });
  // Preserve encounter order rather than the z ordering used for the fixed roof.
  for (const b of plan.crossings) {
    const a = { id: b.id, x0: -grateHalf, x1: grateHalf, z0: b.z - grateHalf, z1: b.z + grateHalf };
    apertures.push(a);
    patches.push([
      { x0: b.x0, x1: b.x1, z0: b.z0, z1: a.z0 },
      { x0: b.x0, x1: b.x1, z0: a.z1, z1: b.z1 },
      { x0: b.x0, x1: a.x0, z0: a.z0, z1: a.z1 },
      { x0: a.x1, x1: b.x1, z0: a.z0, z1: a.z1 },
    ]);
  }
  return { fixed, patches, apertures, bottom: UNDERFLOOR.ceiling, top: 1.15, pierTop: .96,
    handSlot: { x0: -.18, x1: .18 }, headerBottom: UNDERFLOOR.bayHead };
}

export function underfloorHead(plan, x, z, step = { active: 0, pressure: 0 }) {
  // The entrance beam reaches .16m outside the deck. Start ducking before
  // the player's body reaches it, in either travel direction.
  if (Math.abs(z) > plan.end + 0.16 + 0.225) return 3.2;
  const b = plan.crossings[step.active];
  return inRect({ x, z }, b, -0.22) ? UNDERFLOOR.ceiling - Math.max(0, Math.min(1, step.pressure)) * UNDERFLOOR.flex : UNDERFLOOR.bayHead;
}
