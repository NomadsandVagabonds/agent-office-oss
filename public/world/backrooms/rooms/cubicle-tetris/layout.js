// Pure deterministic geometry & walkable heightfield for `cubicle-tetris` ("The Re-Org").
// Kept free of Three.js / DOM so unit tests can verify 3D platforming reachability
// from every doorway all the way up to the +4.80 m cantilevered chasm summit.

export const TIER_H = 0.96;
export const SUMMIT_Y = TIER_H * 5; // 4.80 m

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Walkable stacked beige cubicle decks (`kind: 'flat'`) and fallen-door / unbolted-partition
 * bridges (`kind: 'ramp'`). Pairwise disjoint in (x, z) so `tetrisFloorY(x, z)`
 * is a clean single-valued heightfield compatible with `world.walkable`.
 */
export const TETRIS_DECKS = Object.freeze([
  // Ramp 1: fallen wooden office door propped over toppled steel filing cabinet (ground -> Tier 1)
  { id: 'r1', kind: 'ramp', x0: -3.6, z0: 2.2, x1: -2.2, z1: 3.8, axis: 'z', yAtZ0: TIER_H, yAtZ1: 0, color: '#7a5838' },

  // Tier 1: Dingy Oatmeal Hollow Cubicle Cluster (y = 0.96 m)
  { id: 't1a', kind: 'flat', tier: 1, piece: 'L', x0: -3.8, z0: 0.6, x1: 1.0, z1: 2.2, y: TIER_H, color: '#b8ae98' },
  { id: 't1b', kind: 'flat', tier: 1, piece: 'L', x0: -0.6, z0: -1.0, x1: 1.0, z1: 0.6, y: TIER_H, color: '#b8ae98' },

  // Ramp 2: unbolted beige cubicle partition panel wedged across desks (Tier 1 -> Tier 2)
  { id: 'r2', kind: 'ramp', x0: 1.0, z0: -0.9, x1: 2.4, z1: 0.5, axis: 'x', yAtX0: TIER_H, yAtX1: TIER_H * 2, color: '#aba18c' },

  // Tier 2: Nicotine-Putty Sideways Cubicle Run (y = 1.92 m)
  { id: 't2', kind: 'flat', tier: 2, piece: 'I', x0: 2.4, z0: -4.2, x1: 4.0, z1: 2.2, y: TIER_H * 2, color: '#a59c88' },

  // Ramp 3: slanted oak desktop slab over spilled drawers (Tier 2 -> Tier 3)
  { id: 'r3', kind: 'ramp', x0: 0.8, z0: -4.0, x1: 2.4, z1: -2.6, axis: 'x', yAtX0: TIER_H * 3, yAtX1: TIER_H * 2, color: '#8a6842' },

  // Tier 3: Stained Warm-Beige Cubicle Heap (y = 2.88 m)
  { id: 't3a', kind: 'flat', tier: 3, piece: 'O', x0: -2.4, z0: -4.2, x1: 0.8, z1: -1.0, y: TIER_H * 3, color: '#bfb59e' },
  { id: 't3b', kind: 'flat', tier: 3, piece: 'O', x0: -4.2, z0: -2.6, x1: -2.4, z1: -1.0, y: TIER_H * 3, color: '#bfb59e' },

  // Ramp 4: fallen office door & steel partition rail bridge (Tier 3 -> Tier 4)
  { id: 'r4', kind: 'ramp', x0: -4.2, z0: -4.2, x1: -2.6, z1: -2.6, axis: 'z', yAtZ0: TIER_H * 4, yAtZ1: TIER_H * 3, color: '#745234' },

  // Tier 4: Dust-Grey Putty Cubicle Stack (y = 3.84 m)
  { id: 't4', kind: 'flat', tier: 4, piece: 'S', x0: -4.2, z0: -5.8, x1: -1.0, z1: -4.2, y: TIER_H * 4, color: '#9c9585' },

  // Ramp 5: narrow chasm-edge partition gangplank (Tier 4 -> Tier 5 Summit)
  { id: 'r5', kind: 'ramp', x0: -1.0, z0: -5.7, x1: 0.6, z1: -4.3, axis: 'x', yAtX0: TIER_H * 4, yAtX1: SUMMIT_Y, color: '#aba18c' },

  // Tier 5 (Summit): Cantilevered Beige Cubicle Booth jutting out over the black abyss (y = 4.80 m)
  { id: 't5a', kind: 'flat', tier: 5, piece: 'T', x0: 0.6, z0: -5.8, x1: 4.4, z1: -4.2, y: SUMMIT_Y, color: '#b5ab95' },
  { id: 't5b', kind: 'flat', tier: 5, piece: 'T', x0: 1.6, z0: -7.0, x1: 3.4, z1: -5.8, y: SUMMIT_Y, color: '#b5ab95' },
]);

/** Summit coordinates where the VHS cassette (`stash`) and service bell sit. */
export const SUMMIT_BELL = Object.freeze({ x: 2.5, z: -6.55, y: SUMMIT_Y });

export function tetrisStash(r, side) {
  return side < 0
    ? [0.95, -5.45, 1.55, -4.55]
    : [3.45, -5.45, 4.05, -4.55];
}

/** Local floor height at `(x, z)` in room coordinates (`x` across, `z` deep). */
export function tetrisFloorY(x, z) {
  for (let i = 0; i < TETRIS_DECKS.length; i++) {
    const d = TETRIS_DECKS[i];
    if (x < d.x0 || x > d.x1 || z < d.z0 || z > d.z1) continue;
    if (d.kind === 'flat') return d.y;
    if (d.axis === 'z') {
      const u = clamp((z - d.z0) / (d.z1 - d.z0), 0, 1);
      return d.yAtZ0 + (d.yAtZ1 - d.yAtZ0) * u;
    }
    const u = clamp((x - d.x0) / (d.x1 - d.x0), 0, 1);
    return d.yAtX0 + (d.yAtX1 - d.yAtX0) * u;
  }
  return 0;
}

/** Pure cascade state when the visitor rings the Tier-5 Re-Org service bell. */
export function createBellCascade() {
  return { active: false, t: 0, rings: 0, litTier: -1 };
}

export function stepBellCascade(state, { dt = 0, rang = false } = {}) {
  let { active, t, rings, litTier } = state;
  let dinged = false, clackedTier = -1;
  if (rang) {
    active = true;
    t = 0;
    rings += 1;
    litTier = 0;
    dinged = true;
    clackedTier = 0;
  } else if (active) {
    t += dt;
    const nextTier = Math.min(4, Math.floor(t / 0.42));
    if (nextTier !== litTier) {
      litTier = nextTier;
      clackedTier = nextTier;
    }
    if (t >= 4.2) {
      active = false;
      litTier = -1;
    }
  }
  return {
    state: { active, t, rings, litTier },
    dinged,
    clackedTier,
  };
}
