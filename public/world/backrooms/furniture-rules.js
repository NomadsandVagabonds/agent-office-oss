// Furniture contact rules shared by walking, grabbing and physical attacks.
// A clear visual ray is deliberately not enough: a low desk can be seen over
// but still prevents a creature reaching through it.
const EPS = 1e-6;

// Entry time of a segment into an open rectangle. Merely touching an edge
// while moving away is not an obstruction.
function rectTime(a, dx, dz, b) {
  let enter = 0, leave = 1;
  for (const [p, d, lo, hi] of [[a.x, dx, b.x0, b.x1], [a.z, dz, b.z0, b.z1]]) {
    if (Math.abs(d) < EPS) { if (p <= lo || p >= hi) return Infinity; continue; }
    const t0 = (lo - p) / d, t1 = (hi - p) / d;
    enter = Math.max(enter, Math.min(t0, t1)); leave = Math.min(leave, Math.max(t0, t1));
    if (enter >= leave) return Infinity;
  }
  return leave > EPS && enter < 1 - EPS ? Math.max(0, enter) : Infinity;
}
function circleTime(a, dx, dz, x, z, r) {
  const px = a.x - x, pz = a.z - z, c = px * px + pz * pz - r * r;
  if (c < -EPS) return 0;
  const aa = dx * dx + dz * dz, dot = px * dx + pz * dz, disc = dot * dot - aa * c;
  if (aa < EPS * EPS || disc <= 0) return Infinity;
  const root = Math.sqrt(disc), enter = (-dot - root) / aa, leave = (-dot + root) / aa;
  return leave > EPS && enter < 1 - EPS ? Math.max(0, enter) : Infinity;
}
// A circle swept against a rectangle: two strips and four rounded corners.
// Using just an expanded box would falsely block diagonal paths near corners.
export function furnitureEntryTime(a, b, r, item) {
  const dx = b.x - a.x, dz = b.z - a.z;
  if (!r) return rectTime(a, dx, dz, item);
  let t = Math.min(
    rectTime(a, dx, dz, { x0: item.x0 - r, x1: item.x1 + r, z0: item.z0, z1: item.z1 }),
    rectTime(a, dx, dz, { x0: item.x0, x1: item.x1, z0: item.z0 - r, z1: item.z1 + r }),
  );
  for (const x of [item.x0, item.x1]) for (const z of [item.z0, item.z1]) t = Math.min(t, circleTime(a, dx, dz, x, z, r));
  return t;
}

/** Swept XZ contact clearance. Shadows opt out at their caller, not by disabling solids. */
export function furnitureClear(world, ax, az, bx, bz, r = 0, opt = {}) {
  if (![ax, az, bx, bz, r].every(Number.isFinite) || r < 0) return false;
  for (const c of world?.furnitureColliders || []) {
    if (c.on === false || c.floor || opt.furniture === 'phase'
      || Number.isFinite(opt.furnitureY) && Number.isFinite(c.top) && opt.furnitureY >= c.top) continue;
    if (furnitureEntryTime({ x: ax, z: az }, { x: bx, z: bz }, r, c) < Infinity) return false;
  }
  return true;
}
