// BlockRooms difficulty, edition 1. Shared by launch, simulation and score validation.
// Multipliers are provisional, not a claim that these modes are equally hard per point.
export const DEFAULT_DIFFICULTY = 'easy';
export const DIFFICULTIES = Object.freeze([
  { id: 'tourist', label: 'Tourist', multiplier: 0, immune: true, cameraStart: 1, rooms: 1, toner: 0, batteryEvery: 8, batteryShare: 1, snack: .5,
    note: 'Explore without injury or a battery deadline. No score.' },
  { id: 'training-wheels', label: 'Training Wheels', multiplier: .5, cameraStart: 1, rooms: 1, toner: 0, batteryEvery: 8, batteryShare: 1, snack: .5,
    note: 'Score ×0.5' },
  { id: 'easy', label: 'Easy', multiplier: 1, cameraStart: 1, rooms: 1, toner: 1, batteryEvery: 28, batteryShare: 1, snack: .65,
    note: 'Score ×1' },
  { id: 'normal', label: 'Normal', multiplier: 1.5, cameraStart: 1, rooms: 1, toner: 2, batteryEvery: 28, batteryShare: .7, snack: 0,
    note: 'Score ×1.5' },
  { id: 'hard', label: 'Hard', multiplier: 2, cameraStart: .75, rooms: 1.25, toner: 3, batteryEvery: 28, batteryShare: .7, snack: 0, maxHealth: 1,
    note: 'Score ×2' },
].map(Object.freeze));
export const validDifficulty = id => DIFFICULTIES.some(d => d.id === id);
export const cleanDifficulty = (id, fallback = DEFAULT_DIFFICULTY) => validDifficulty(id) ? id : fallback;
export const difficultyOf = id => DIFFICULTIES.find(d => d.id === cleanDifficulty(id));

// Explicit species tuning. A speed change never changes tell/fuse/cooldown clocks.
export const CREATURE_DIFFICULTY = Object.freeze({
  'training-wheels': { pirate: { speed: 1 }, toner: { speed: 1 } },
  tourist: { pirate: { speed: 1 }, toner: { speed: 1 } },
  easy: { pirate: { speed: 1, damage: 2 }, toner: { speed: 1, damage: 1 }, 'other-door': { damage: 2 } },
  normal: { pirate: { speed: 1.12, damage: 3 }, toner: { speed: 1.08, damage: 1 }, 'other-door': { damage: 3 } },
  hard: { pirate: { speed: 1.2, damage: 3 }, toner: { speed: 1.12, damage: 2 }, 'other-door': { damage: 3 } },
});
export const creatureTuning = (difficulty, id) => CREATURE_DIFFICULTY[cleanDifficulty(difficulty)]?.[id] || {};

/** Immutable launch mode; changing back cannot restore score eligibility. */
export function createDifficultyRun(id = DEFAULT_DIFFICULTY, { ranked = true } = {}) {
  const initial = cleanDifficulty(id);
  let current = initial, changed = false;
  return {
    get current() { return current; },
    set(id) { if (!validDifficulty(id) || id === current) return false; current = id; changed = true; return true; },
    report() { return { difficulty: initial, difficultyChanged: changed, ranked: ranked && !changed && initial !== 'tourist', scoring: 1 }; },
  };
}
export const scoreEligible = run => run.ranked !== false && !run.difficultyChanged && run.difficulty !== 'tourist';
export const scoreMultiplier = run => !scoreEligible(run) ? 0 : run.difficulty ? difficultyOf(run.difficulty).multiplier : 1;

/** Department kit remains meaningful; Hard caps all kits at one heart and disables regeneration. */
export function difficultyPerk(perk = {}, id) {
  const d = difficultyOf(id);
  return { ...perk, cameraStart: (perk.cameraStart ?? 300) * d.cameraStart,
    ...(d.maxHealth ? { maxHealth: d.maxHealth, maxSnackHealth: d.maxHealth, regenSeconds: 0 } : {}) };
}
