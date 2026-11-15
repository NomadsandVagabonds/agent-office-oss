// Pure rules and deterministic look/placement logic for The Absorbed Staff:
// standard upstairs Office workers (humans, cats, dogs, goblins, robots) who
// have sunk 2/3 into a Backrooms wall, carpet, or acoustic ceiling tile, with
// 1.5x elongated droopy arms that snare passers-by without ending the tape.

export const ABSORBED = Object.freeze({
  armScale: 1.5,
  noticeRadius: 2.95,
  reachRadius: Object.freeze({
    wall: 1.04,
    floor: 1.06,
    ceiling: 0.98,
  }),
  holdDuration: 1.35,
  struggleRate: 1.85,
  cooldownDuration: 3.3,
  slowFactor: 0.14,
  floorGrabSink: 0.28,
  wallGrabSink: 0.06,
  crouchDuckSink: 0.26,
  hopClearDrop: 0.24,
  ceilingMinH: 2.30,
  ceilingMaxH: 3.45,
});

export const ABSORBED_MOUNTS = Object.freeze(['wall', 'floor', 'ceiling']);

/**
 * How many of them a part of the building has, for how many plain rooms it has: one to three. They are something to
 * come upon, not the wallpaper (the owner's rule for the level: mostly mundane rooms, features rare). The pack they
 * came in had three to eight a part, in more than a third of its plain rooms.
 */
export const ABSORBED_A_PART = Object.freeze({ share: 0.15, least: 1, most: 3 });
export function absorbedCount(plainRooms) {
  if (!(plainRooms > 0)) return 0;
  return Math.max(Math.min(ABSORBED_A_PART.least, plainRooms), Math.min(ABSORBED_A_PART.most, Math.round(plainRooms * ABSORBED_A_PART.share)));
}

export const ABSORBED_SPECIES = Object.freeze(['human', 'cat', 'dog', 'goblin', 'robot']);

const HUMAN_SKIN = ['#f3cda8', '#e6b184', '#cd8d5e', '#9c6442', '#dcab8b'];
const SPECIES_SKIN = {
  human: HUMAN_SKIN,
  robot: ['#8a93a8', '#a7b0bc', '#9aa58f', '#b0a08a'],
  goblin: ['#7fa35a', '#6b9460', '#8fae5e', '#5f8a6a'],
  dog: ['#c99a62', '#a8794a', '#e3c79a', '#8a6a4a', '#d9d2c4'],
  cat: ['#e0a060', '#9a9aa6', '#f1e6d2', '#4a4a56', '#d98a4a'],
};
const HAIR_STYLES = ['short', 'side', 'long', 'bun', 'mohawk', 'bald', 'cap', 'beanie'];
const HAIR_COLORS = ['#241608', '#4a2f1a', '#15151c', '#7d5836', '#caa05a', '#9aa0ac'];
const OUTFITS = ['tee', 'hoodie', 'suit', 'vest', 'cardigan'];
const OUTFIT_COLORS = ['#b5483f', '#3f8a72', '#5a6fa8', '#8a5a8f', '#6f8a4a', '#c9893f', '#3f7f9a', '#5a5a66'];
const SAFE_ACCESSORIES = ['none', 'none', 'none', 'glasses', 'shades', 'monocle', 'headphones', 'eyepatch'];
const FACIAL = ['none', 'none', 'none', 'mustache', 'beard'];
const PROVIDERS = ['claude', 'codex', 'gemini', 'opencode', 'shell'];

/**
 * Roll a deterministic, species-diverse roster of absorbed Office coworkers.
 * Guarantees cats, dogs, people, goblins, and robots appear across the floor,
 * optionally borrowing outfit/accessory echoes from `cast`.
 */
export function rollAbsorbedRoster(R, count, cast = []) {
  const bag = R.shuffle(['human', 'cat', 'dog', 'human', 'goblin', 'robot']);
  const mounts = R.shuffle(['wall', 'floor', 'ceiling', 'wall', 'wall', 'ceiling', 'floor']);
  const out = [];
  for (let i = 0; i < count; i++) {
    const species = bag[i % bag.length];
    const castEcho = cast.length && R.chance(0.45) ? cast[(i + R.int(0, cast.length - 1)) % cast.length] : null;
    const baseLook = castEcho?.look || null;
    const skinPool = SPECIES_SKIN[species] || HUMAN_SKIN;
    const rawAcc = baseLook?.accessory && SAFE_ACCESSORIES.includes(baseLook.accessory)
      ? baseLook.accessory
      : R.pick(SAFE_ACCESSORIES);

    const look = {
      species,
      skin: (baseLook?.species === species && baseLook?.skin) ? baseLook.skin : R.pick(skinPool),
      hair: baseLook?.hair && HAIR_STYLES.includes(baseLook.hair) ? baseLook.hair : R.pick(HAIR_STYLES),
      hairColor: baseLook?.hairColor || R.pick(HAIR_COLORS),
      outfit: baseLook?.outfit && OUTFITS.includes(baseLook.outfit) ? baseLook.outfit : R.pick(OUTFITS),
      outfitColor: baseLook?.outfitColor || R.pick(OUTFIT_COLORS),
      accessory: species === 'robot' && (rawAcc === 'glasses' || rawAcc === 'shades' || rawAcc === 'monocle' || rawAcc === 'eyepatch')
        ? 'none'
        : rawAcc,
      facial: species === 'robot' || species === 'cat' || species === 'dog'
        ? 'none'
        : (baseLook?.facial && FACIAL.includes(baseLook.facial) ? baseLook.facial : R.pick(FACIAL)),
    };

    out.push({
      idx: i,
      preferredMount: mounts[i % mounts.length],
      look,
      provider: R.pick(PROVIDERS),
      faceVariant: R.int(0, 3),
      droopSide: R.chance(0.5) ? 1 : -1,
      droopAmp: R.range(2.6, 4.1),
      slump: R.range(-0.22, 0.22),
      seed: R.int(100, 99999),
    });
  }
  return out;
}

export function createAbsorbedState(mount = 'wall') {
  if (!ABSORBED_MOUNTS.includes(mount)) throw new Error(`unknown mount: ${mount}`);
  return {
    mount,
    phase: 'idle',        // 'idle' | 'reaching' | 'grabbing' | 'cooldown'
    holdLeft: 0,
    cooldownLeft: 0,
    reachBlend: 0,
    grabBlend: 0,
    grabCount: 0,
  };
}

/**
 * Can this absorbed worker snare the player on the current frame?
 * - Ceiling hangers miss crouched players (`playerSink >= crouchDuckSink`).
 * - Floor hangers miss players hopping cleanly over their outer arm ring (`playerDrop >= hopClearDrop && dist > 0.46`).
 */
export function canGrabPlayer(mount, {
  dist,
  playerSink = 0,
  playerDrop = 0,
  clearLine = true,
}) {
  if (!clearLine) return false;
  const r = ABSORBED.reachRadius[mount] ?? 1.0;
  if (dist > r) return false;
  if (mount === 'ceiling' && playerSink >= ABSORBED.crouchDuckSink) return false;
  if (mount === 'floor' && playerDrop >= ABSORBED.hopClearDrop && dist > 0.46) return false;
  return true;
}

const approach = (cur, want, rate, dt) => cur + (want - cur) * (1 - Math.exp(-rate * dt));

/**
 * Advance one absorbed coworker's state machine by `dt` seconds.
 * Never ends the run ('caught' does not exist here): grabbing holds & slows
 * the visitor briefly before releasing into a limp cooldown.
 */
export function stepAbsorbed(prev, {
  dt,
  dist,
  playerSink = 0,
  playerDrop = 0,
  struggling = false,
  clearLine = true,
}) {
  const s = { ...prev };
  let startedGrab = false;
  let releasedGrab = false;
  let noticedNow = false;

  if (s.phase === 'cooldown') {
    s.cooldownLeft = Math.max(0, s.cooldownLeft - dt);
    if (s.cooldownLeft <= 0) {
      s.phase = (clearLine && dist <= ABSORBED.noticeRadius) ? 'reaching' : 'idle';
    }
  } else if (s.phase === 'grabbing') {
    const burn = struggling ? ABSORBED.struggleRate : 1.0;
    s.holdLeft -= dt * burn;
    // Also release if external warp moved player far away
    if (s.holdLeft <= 0 || dist > (ABSORBED.reachRadius[s.mount] ?? 1.0) + 0.85) {
      s.holdLeft = 0;
      s.phase = 'cooldown';
      s.cooldownLeft = ABSORBED.cooldownDuration;
      releasedGrab = true;
    }
  } else {
    // 'idle' or 'reaching'
    if (canGrabPlayer(s.mount, { dist, playerSink, playerDrop, clearLine })) {
      s.phase = 'grabbing';
      s.holdLeft = ABSORBED.holdDuration;
      s.grabCount += 1;
      startedGrab = true;
    } else if (clearLine && dist <= ABSORBED.noticeRadius) {
      if (s.phase === 'idle') noticedNow = true;
      s.phase = 'reaching';
    } else {
      s.phase = 'idle';
    }
  }

  const wantReach = s.phase === 'grabbing' ? 1 : s.phase === 'reaching' ? Math.max(0.28, 1 - (dist / ABSORBED.noticeRadius) * 0.72) : 0;
  const wantGrab = s.phase === 'grabbing' ? 1 : 0;
  s.reachBlend = approach(s.reachBlend, wantReach, s.phase === 'cooldown' ? 5.5 : 8.5, dt);
  s.grabBlend = approach(s.grabBlend, wantGrab, s.phase === 'grabbing' ? 14 : 7.5, dt);

  const grabbing = s.phase === 'grabbing';
  const slow = grabbing ? ABSORBED.slowFactor : 1;
  const sinkTo = grabbing
    ? (s.mount === 'floor' ? ABSORBED.floorGrabSink : s.mount === 'wall' ? ABSORBED.wallGrabSink : 0)
    : 0;
  const interfere = startedGrab
    ? 0.68
    : grabbing
      ? 0.22
      : releasedGrab
        ? 0.28
        : (s.phase === 'reaching' && dist < 1.65 ? (1.65 - dist) * 0.08 : 0);

  return {
    state: s,
    startedGrab,
    releasedGrab,
    noticedNow,
    slow,
    sinkTo,
    interfere,
  };
}

/**
 * Does the hold turn the visitor's head to the one holding them, this moment? Only in its first half second — and
 * never while something that hunts is within HUNTER_NEAR metres of them with a line of sight between the two
 * (`hunted`). Watching is what holds the mascot where it is, and looking is what sets the shadow off: nothing of the
 * building's takes that look out of the visitor's hands. Being slowed and held with one of them close is the cost of
 * walking into reach; the creak and the arms were the warning.
 */
export const HUNTER_NEAR = 6;
export const TUG_SECONDS = 0.55;
export function tugsTheCamera(holdLeft, hunted) {
  return !hunted && holdLeft > ABSORBED.holdDuration - TUG_SECONDS;
}
