// Original workshop encounter: floor plans and the walker's cadence, without a renderer.
export const UNDERFLOOR = Object.freeze({ ceiling: 0.98, bayHead: 0.86, cadence: 6.4, lead: 2.0, press: 1.15, cycle: 38.4 });
const ORDER = [0, 1, 2, 2, 1, 0];
export const inRect = (p, b, pad = 0) => p.x >= b.x0 + pad && p.x <= b.x1 - pad && p.z >= b.z0 + pad && p.z <= b.z1 - pad;

export function underfloorPlan(W = 11.8, D = 19.8) {
  if (W < 9 || D < 18) throw new RangeError('Underfloor Walker needs a broad room at least 18m deep.');
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

/** Each step has two seconds of creaking/dust before weight reaches the boards. */
export function walkerAt(time) {
  const t = Math.max(0, time), step = Math.floor(t / UNDERFLOOR.cadence), phase = t - step * UNDERFLOOR.cadence;
  const active = ORDER[step % ORDER.length], warning = phase < UNDERFLOOR.lead;
  const down = phase - UNDERFLOOR.lead;
  const pressure = down >= 0 && down < UNDERFLOOR.press ? Math.sin(Math.PI * down / UNDERFLOOR.press) : 0;
  return { step, active, phase, warning, pressure, striking: pressure > 0.55,
    lift: warning ? 0.8 * (1 - phase / UNDERFLOOR.lead) : phase < 3.4 ? 0 : Math.min(0.8, (phase - 3.4) * 0.5) };
}

export function underfloorHead(plan, x, z, step = walkerAt(0)) {
  // The entrance beam reaches .16m outside the deck. Start ducking before
  // the player's body reaches it, in either travel direction.
  if (Math.abs(z) > plan.end + 0.16 + 0.225) return 3.2;
  const b = plan.crossings[step.active];
  return inRect({ x, z }, b, -0.22) ? UNDERFLOOR.ceiling - step.pressure * 0.16 : UNDERFLOOR.bayHead;
}

export function underfloorRisk(plan, x, z, step) {
  return step.striking && inRect({ x, z }, plan.crossings[step.active], 0.02);
}
