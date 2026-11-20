// Floor 1 Yellow Office — richer seeded lighting contrast and fluorescent ballast character.
// Pure ES module: no Three.js, no DOM, zero layout-RNG side effects.
import { makeRng } from './gen.js';
import { LIGHTING, LIGHTING_MODES, planLighting, planFloorLighting } from './lighting.js';

/**
 * Floor 1 yellow office lighting distribution (~66% atmospheric contrast vs 34% full steady).
 * Keeps doorway bloom, smooth doorway spill, flashlight shadows and camcorder iris/AWB active
 * throughout exploration while capping emergency rooms to at most one per floor.
 */
export const YELLOW_LIGHTING_MIX = Object.freeze({
  steady: 0.34,
  dim: 0.24,
  islands: 0.20,
  failing: 0.14,
  travel: 0.06,
  emergency: 0.02,
});

const START_DIM_CHANCE = 0.35;
const CONTRAST_KINDS = Object.freeze(['dim', 'islands', 'failing']);

// Subtle institutional fluorescent ballast shifts (luminance-normalized when applied).
const COOL_BALLAST = Object.freeze([0.92, 1.03, 1.04]);
const WARM_BALLAST = Object.freeze([1.06, 0.98, 0.86]);
const BALLAST_TRUE_SHARE = 0.75;
const BALLAST_COOL_END = 0.90; // 15% cool-greenish, remaining 10% warm amber

const DEAD_STARTER_CHANCE = 0.14;

const panelKey = (p) => `${p.x}:${p.z}`;
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Live ceiling panels in a room that can participate in banked lighting. */
function livePanels(room) {
  if (!room || !Array.isArray(room.panels)) return [];
  return room.panels.filter((p) => p.state !== 'dead');
}

/** Whether a room is eligible for office lighting banks (`allowStart` permits the spawn room). */
function isEligible(room, allowStart = false) {
  if (!room || room.crawl) return false;
  const kindOk = room.kind === 'plain' || (allowStart && room.kind === 'start');
  if (!kindOk) return false;
  if (!room.light || !['normal', 'dim'].includes(room.light.mode)) return false;
  return livePanels(room).length >= 2;
}

/** Build the exact plan object consumed by lighting.js (`panelBank`, `bankLevels`, `localLightScale`) and world.js. */
function buildOfficePlan(room, kind, rng, forced = false) {
  if (!kind || kind === 'steady') return null;
  const panels = livePanels(room);
  if (panels.length < 2) return null;

  let axis = room.W > room.D ? 'x' : 'z';
  const rowsOn = (a) => [...new Set(panels.map((p) => p[a]))].sort((a, b) => a - b);
  let rows = rowsOn(axis);
  if (rows.length < 2) {
    axis = axis === 'x' ? 'z' : 'x';
    rows = rowsOn(axis);
  }
  if (rows.length < 2) return null;

  if (kind === 'travel' && (rows.length < 3 || (!forced && Math.max(room.W, room.D) / Math.min(room.W, room.D) < 1.8))) {
    if (forced) return null;
    kind = 'failing';
  }

  const ceilingBanks = kind === 'travel' ? Math.min(LIGHTING.maxBanks, rows.length) : 2;
  const cuts = Array.from({ length: ceilingBanks - 1 }, (_, i) => {
    const n = Math.ceil(((i + 1) * rows.length) / ceilingBanks);
    return (rows[n - 1] + rows[n]) / 2;
  });
  const reverse = rng.chance(0.5);
  const period = kind === 'travel' ? rng.range(64, 88) : kind === 'emergency' ? rng.range(5, 6) : rng.range(38, 54);
  const plan = {
    kind,
    axis,
    cuts,
    split: cuts[0],
    reverse,
    ceilingBanks,
    bankCount: ceilingBanks + (kind === 'emergency' ? 1 : 0),
    emergencyBank: kind === 'emergency' ? 2 : null,
    period,
    offset: rng.range(0, period),
    ambientShare: LIGHTING.ambientShare,
  };

  if (kind === 'islands') {
    const ordered = [...panels].sort((a, b) => a[axis] - b[axis]);
    const first = ordered[Math.floor(ordered.length * (reverse ? 0.75 : 0.25))];
    plan.keepers = [panelKey(first)];
    if (panels.length >= 12) {
      plan.keepers.push(panelKey(ordered.reduce((a, b) => (
        (b.x - first.x) ** 2 + (b.z - first.z) ** 2 > (a.x - first.x) ** 2 + (a.z - first.z) ** 2 ? b : a
      ))));
    }
  }
  return plan;
}

/**
 * Deterministic lighting planner for Floor 1 yellow office rooms.
 * Uses `YELLOW_LIGHTING_MIX` when `mode === 'office'`, keeping the `'start'` room readable
 * (steady or gentle `'dim'`, never blackout). Delegates forced modes (`'failing'`, `'dim'`,
 * `'islands'`, `'travel'`, `'emergency'`) and `true` to `planLighting`.
 */
export function planOfficeLighting(room, seed, mode = false) {
  if (!mode) return null;
  if (mode !== 'office' || LIGHTING_MODES.includes(mode)) return planLighting(room, seed, mode);
  if (!isEligible(room, true)) return null;

  const rng = makeRng(`${seed}:office-lighting:${room.id}`);
  const roll = rng();

  if (room.kind === 'start') {
    // Keep Room 0 readable on frame 1: either steady bright or gentle half-lit 'dim'.
    return roll < START_DIM_CHANCE ? buildOfficePlan(room, 'dim', rng, false) : null;
  }

  let kind = 'steady';
  let ceiling = 0;
  for (const [name, share] of Object.entries(YELLOW_LIGHTING_MIX)) {
    ceiling += share;
    if (roll < ceiling) {
      kind = name;
      break;
    }
  }
  return buildOfficePlan(room, kind, rng, false);
}

/**
 * Floor-level office lighting planner: caps emergency rooms to at most 1 per floor (matching
 * `planFloorLighting`), and encourages doorway light contrast right out of the `'start'` room
 * (bright-into-dark or dark-into-bright) when `level.links` is present. Never mutates `level`.
 */
export function planFloorOfficeLighting(level, mode = false) {
  if (!mode) return level.rooms.map(() => null);
  if (mode !== 'office') return planFloorLighting(level, mode);

  let emergency = false;
  const plans = level.rooms.map((room) => {
    const p = planOfficeLighting(room, level.seed, 'office');
    if (p?.kind === 'emergency') {
      if (emergency) return null;
      emergency = true;
    }
    return p;
  });

  // Encourage immediate bright-into-dark or dark-into-bright doorway contrast from Room 0.
  const startIdx = level.rooms.findIndex((r) => r.kind === 'start');
  const links = Array.isArray(level.links) ? level.links : [];
  if (startIdx >= 0 && links.length) {
    const startId = level.rooms[startIdx].id;
    const byId = new Map(level.rooms.map((r, i) => [r.id, i]));
    const neighborIndices = [];
    for (const l of links) {
      const otherId = l.a === startId ? l.b : l.b === startId ? l.a : null;
      if (otherId === null) continue;
      const idx = byId.get(otherId);
      if (idx !== undefined && !neighborIndices.includes(idx)) neighborIndices.push(idx);
    }

    const eligibleNeighbors = neighborIndices.filter((i) => isEligible(level.rooms[i], false));
    if (eligibleNeighbors.length) {
      const startIsDim = !!plans[startIdx];
      if (!startIsDim) {
        // Start is steady bright: ensure at least one adjacent plain room has varied/darker lighting.
        if (!eligibleNeighbors.some((i) => !!plans[i])) {
          const targetIdx = eligibleNeighbors[0];
          const targetRoom = level.rooms[targetIdx];
          const rng = makeRng(`${level.seed}:office-lighting:contrast:${targetRoom.id}`);
          const kind = rng.pick(CONTRAST_KINDS);
          plans[targetIdx] = buildOfficePlan(targetRoom, kind, rng, false);
        }
      } else {
        // Start is gentle 'dim': ensure at least one adjacent plain room is steady bright.
        if (!eligibleNeighbors.some((i) => !plans[i])) {
          const targetIdx = eligibleNeighbors[0];
          plans[targetIdx] = null;
        }
      }
    }
  }

  return plans;
}

/**
 * Deterministic per-troffer color-temperature micro-variation for yellow office fluorescent fixtures.
 * ~75% remain true `[r, g, b]`, ~15% shift subtly cool-greenish institutional ballast, and ~10%
 * shift subtly warm amber/sodium-leaning. Always preserves Rec.709 luminance (~1.0 ratio).
 */
export function ballastTint(baseRgb, seedKey, panelIndex) {
  const r = baseRgb[0], g = baseRgb[1], b = baseRgb[2];
  const rng = makeRng(`${seedKey}:ballast:${panelIndex}`);
  const roll = rng();
  if (roll < BALLAST_TRUE_SHARE) return [r, g, b];

  const mul = roll < BALLAST_COOL_END ? COOL_BALLAST : WARM_BALLAST;
  const tr = r * mul[0], tg = g * mul[1], tb = b * mul[2];
  const baseL = luma(r, g, b), tintedL = luma(tr, tg, tb);
  if (baseL <= 1e-6 || tintedL <= 1e-6) return [r, g, b];
  const s = baseL / tintedL;
  return [tr * s, tg * s, tb * s];
}

/**
 * Deterministic dying-starter orange filament glow (~14% of dead ceiling panels) at one end
 * of an otherwise dead fluorescent tube. Returns `{ end: -1 | 1, color: '#ff8a3a', power: 0.35 }`
 * or `null`.
 */
export function deadStarterGlow(seedKey, panelIndex) {
  const rng = makeRng(`${seedKey}:starter:${panelIndex}`);
  if (rng() >= DEAD_STARTER_CHANCE) return null;
  return {
    end: rng() < 0.5 ? -1 : 1,
    color: '#ff8a3a',
    power: 0.35,
  };
}
