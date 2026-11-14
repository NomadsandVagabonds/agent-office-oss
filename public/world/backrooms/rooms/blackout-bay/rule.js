// Pure rule for The Stand-Ins in Blackout Bay.
// Passing into the dark interior without the facilities flashlight washes the
// picture solid crimson and ends the visit. With the flashlight held, aiming
// its beam at a Stand-In freezes it in place while any outside the cone creep
// closer through the dark.

export const BLACKOUT = Object.freeze({
  redFillSeconds: 0.92,
  redFadePerSec: 2.4,
  stalkSpeed: 1.65,
  catchRadius: 0.64,
  beamRange: 9.8,
  beamCosHalf: 0.76,
});

/**
 * Is target `(tx, tz)` inside the player's horizontal flashlight cone from
 * `(px, pz)` looking along `yaw` (`fx = -sin(yaw), fz = -cos(yaw)`)?
 */
export function isInBeam(px, pz, yaw, tx, tz, maxDist = BLACKOUT.beamRange, cosHalf = BLACKOUT.beamCosHalf) {
  const dx = tx - px, dz = tz - pz;
  const d = Math.hypot(dx, dz);
  if (d > maxDist) return false;
  if (d < 0.25) return true;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const dot = (dx * fx + dz * fz) / d;
  return dot >= cosHalf;
}

export const createBlackoutState = (count = 4) => ({
  red: 0,
  caught: false,
  frozen: Array.from({ length: count }, () => false),
});

/**
 * Step Blackout Bay by `dt` seconds.
 * @param s  state from createBlackoutState()
 * @param o  { dt, inDark, hasFlashlight, px, pz, yaw, targets: [{ x, z, los }] }
 */
export function stepBlackout(s, o) {
  const {
    dt,
    inDark = false,
    hasFlashlight = false,
    px = 0,
    pz = 0,
    yaw = 0,
    targets = [],
  } = o;

  let { red, caught } = s;

  // Without a flashlight in the blackout zone, the screen floods red and kills you
  if (inDark && !hasFlashlight) {
    red = Math.min(1, red + dt / BLACKOUT.redFillSeconds);
    if (!caught && red >= 1) caught = true;
    return {
      state: { red, caught, frozen: targets.map(() => false) },
      red,
      caught,
      speeds: targets.map(() => BLACKOUT.stalkSpeed * 1.35),
      frozen: targets.map(() => false),
    };
  }

  red = Math.max(0, red - dt * BLACKOUT.redFadePerSec);

  const frozen = [];
  const speeds = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const d = Math.hypot(t.x - px, t.z - pz);
    const litByTorch = hasFlashlight && (t.los !== false) && isInBeam(px, pz, yaw, t.x, t.z);
    frozen.push(litByTorch);
    if (!inDark) {
      speeds.push(0);
    } else if (litByTorch) {
      speeds.push(0);
    } else {
      speeds.push(BLACKOUT.stalkSpeed);
      if (!caught && (t.los !== false) && d < BLACKOUT.catchRadius) caught = true;
    }
  }

  return {
    state: { red, caught, frozen },
    red,
    caught,
    speeds,
    frozen,
  };
}
