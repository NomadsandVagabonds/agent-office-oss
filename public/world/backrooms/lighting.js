// Optional fluorescent-bank study. The layout's RNG is never consumed here:
// switching this on must leave rooms, furniture, supplies and residents alone.
import { makeRng } from './gen.js';

export const LIGHTING = Object.freeze({ ambientShare: 0.92, ownLamp: 0.08, gainMax: 1.65 });

export function planLighting(room, seed, mode = false) {
  if (!mode || room.kind !== 'plain' || room.crawl || !['normal', 'dim'].includes(room.light.mode)) return null;
  const panels = room.panels.filter((p) => p.state !== 'dead');
  if (panels.length < 2) return null;
  const rng = makeRng(`${seed}:lighting:${room.id}`);
  const roll = rng();
  const kind = ['failing', 'dim'].includes(mode) ? mode : roll < 0.70 ? 'steady' : roll < 0.90 ? 'failing' : 'dim';
  if (kind === 'steady') return null;
  // Divide along the long axis, between fixtures, so even an uneven ceiling
  // has a live bank on both sides. Keep actual panel objects out of the plan.
  const axis = room.W > room.D ? 'x' : 'z';
  const sorted = panels.map((p) => p[axis]).sort((a, b) => a - b);
  const mid = sorted.findIndex((n) => n >= (sorted[0] + sorted.at(-1)) / 2);
  if (mid <= 0) return null;
  return { kind, axis, split: (sorted[mid - 1] + sorted[mid]) / 2,
    reverse: rng.chance(0.5), period: rng.range(38, 54), offset: rng.range(0, 54), ambientShare: LIGHTING.ambientShare };
}

export function panelBank(plan, panel) {
  return (panel[plan.axis] < plan.split ? 0 : 1) ^ Number(plan.reverse);
}

const ease = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
/** Absolute visit time: frame rate and whether a room was culled cannot change the cycle. */
export function bankLevels(plan, time, effect = 1) {
  // Encounters own their dramatic flash/blackout; restoring 1 resumes the bank cycle.
  if (effect !== 1) return [1, 1];
  if (plan.kind === 'steady') return [1, 1];
  if (plan.kind === 'dim') return [0.78, 0.015];
  const t = ((time + plan.offset) % plan.period + plan.period) % plan.period;
  // One hesitant dip, a brief recovery, then a long outage and a slow restart.
  // Long bright intervals keep this from becoming a constant flashing effect.
  let k = 1;
  if (t < 0.35) k = 1 - 0.82 * ease(t / 0.35);
  else if (t < 1.05) k = 0.18 + 0.67 * ease((t - 0.35) / 0.7);
  else if (t < 1.6) k = 0.85 - 0.835 * ease((t - 1.05) / 0.55);
  else if (t < 10) k = 0.015;
  else if (t < 12.5) k = 0.015 + 0.985 * ease((t - 10) / 2.5);
  return [1, k];
}

/** Local share of the ceiling's bounced light, using the nearest tube in each bank. */
export function bankWeights(lights, x, z) {
  const near = [Infinity, Infinity];
  for (const l of lights) if (l.bank === 0 || l.bank === 1) near[l.bank] = Math.min(near[l.bank], (l.x - x) ** 2 + (l.z - z) ** 2);
  const a = 1 / (1 + near[0]), b = 1 / (1 + near[1]);
  return a + b > 0 ? [a / (a + b), b / (a + b)] : [0.5, 0.5];
}

export function localLightScale(plan, lights, levels, x, z) {
  const weights = bankWeights(lights, x, z);
  return 1 - plan.ambientShare + plan.ambientShare * (weights[0] * levels[0] + weights[1] * levels[1]);
}
