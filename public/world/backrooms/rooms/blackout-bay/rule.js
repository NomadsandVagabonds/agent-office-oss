// Pure rule for The Stand-Ins in Blackout Bay.
// Passing into the dark interior without the facilities flashlight washes the
// picture solid crimson and ends the visit. With the flashlight held, aiming
// its beam at a Stand-In freezes it in place while any outside the cone creep
// closer through the dark.
import { FLASHLIGHT, inFlashlight } from '../../flashlight.js';

export const BLACKOUT = Object.freeze({
  redFillSeconds: 0.92,
  redFadePerSec: 2.4,
  stalkSpeed: 1.0,
  catchRadius: 0.64,
  beamRange: 9.8,
  beamCosHalf: FLASHLIGHT.holdCos,
  hurts: 2,                  // hearts the dark costs, where there are hearts
  grace: 4,                  // seconds, back at the door, in which nothing in here stirs
});

/**
 * Is target `(tx, tz)` inside the player's horizontal flashlight cone from
 * `(px, pz)` looking along `yaw` (`fx = -sin(yaw), fz = -cos(yaw)`)?
 */
export function isInBeam(px, pz, yaw, tx, tz, maxDist = BLACKOUT.beamRange, cosHalf = BLACKOUT.beamCosHalf) {
  const dx = tx - px, dz = tz - pz;
  const d = Math.hypot(dx, dz);
  if (d > maxDist) return false;
  if (d < .001) return false;
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
 * @param o  { dt, inDark, hasFlashlight, px, py, pz, yaw, pitch, targets: [{ x, z, los }] }
 */
/** The dark had somebody, who is still here (and back at the door, where the room put them): everything is as it was, and for a moment nothing stirs. */
export function releaseBlackout(s) { return { ...createBlackoutState(s.frozen.length), grace: BLACKOUT.grace }; }

export function stepBlackout(s, o) {
  const {
    dt,
    inDark = false,
    hasFlashlight = false,
    mounted = false,
    byFire = false,
    px = 0,
    py = 1.1,
    pz = 0,
    yaw = 0,
    pitch = 0,
    targets = [],
  } = o;

  let { red, caught } = s;
  if (s.grace > 0) {
    const grace = s.grace - dt, still = targets.map(() => false);
    return { state: { red: 0, caught: false, frozen: still, ...(grace > 0 ? { grace } : {}) }, red: 0, caught: false, speeds: targets.map(() => 0), frozen: still };
  }

  // Without a light in the blackout zone, the screen floods red and kills you. (A torch is a light; so is paper burning
  // within sight of where you stand, for as long as it burns. And a Stand-In that can see a fire is held by it, torch or no torch.)
  if (inDark && !hasFlashlight && !byFire) {
    red = Math.min(1, red + dt / BLACKOUT.redFillSeconds);
    if (!caught && red >= 1) caught = true;
    const held = targets.map((t) => (!!t.fire||!!t.lit));
    return {
      state: { red, caught, frozen: held },
      red,
      caught,
      speeds: held.map((h) => (h ? 0 : BLACKOUT.stalkSpeed * 1.35)),
      frozen: held,
    };
  }

  red = Math.max(0, red - dt * BLACKOUT.redFadePerSec);

  const frozen = [];
  const speeds = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const d = Math.hypot(t.x - px, t.z - pz);
    const litByTorch = (!!t.fire||!!t.lit) || inFlashlight({x:px,y:py,z:pz,yaw,pitch,mounted},t,
      {power:hasFlashlight?1:0,los:t.los!==false,bottom:.5,top:1.5,range:BLACKOUT.beamRange});
    frozen.push(litByTorch);
    if (!inDark) {
      speeds.push(0);
    } else if (litByTorch) {
      speeds.push(0);
    } else {
      speeds.push(BLACKOUT.stalkSpeed);
      if (!caught && (t.los !== false) && (t.contact !== false) && d < BLACKOUT.catchRadius) caught = true;
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
