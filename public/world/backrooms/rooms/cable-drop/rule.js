// Pure rule for The Trunk Line (feral IT cabling). No three.js, no Math.random.
//
// Hangs dormant from an open plenum bay. Walk calmly around its perimeter and
// it never wakes; step directly underneath the dangling patch cords — or sprint
// past them — and it drops out of the ceiling, unfolds, squeezes under crawl
// partitions, and hunts you until a closed door stands in its way.

export const CABLE = Object.freeze({
  underRadius: 1.22,        // stepping directly under the hanging cords wakes it
  runRadius: 2.25,          // running near the hanging cords shakes it loose too
  runSpeed: 2.6,            // player speed threshold that counts as running
  dropTime: 0.55,           // seconds to drop from ceiling and unfold
  huntSpeed: 3.12,          // m/s lurching chase speed (player hurry is 3.7)
  catchRadius: 0.62,        // strangle reach when unimpeded by a closed door
  rattleEvery: 0.85,        // seconds between claw-scrapes on a shut door
});

export const createCableState = () => ({
  phase: 'dormant',         // 'dormant' | 'dropping' | 'hunting'
  dropProgress: 0,
  rattleTimer: 0,
  caught: false,
});

/**
 * Advance the Trunk Line by `dt` seconds.
 * @param s  state from createCableState()
 * @param o  { dt, distToDrop, distToCreature, playerSpeed, insideRoom, doorBlocked, clearLine }
 */
export function stepCable(s, o) {
  const { dt, distToDrop, distToCreature, playerSpeed = 0, insideRoom = false, doorBlocked = false, clearLine = true } = o;
  let woke = false, rattled = false, caught = s.caught;
  let { phase, dropProgress, rattleTimer } = s;

  if (phase === 'dormant') {
    const steppedUnder = insideRoom && distToDrop < CABLE.underRadius;
    const ranNear = insideRoom && playerSpeed > CABLE.runSpeed && distToDrop < CABLE.runRadius;
    if (steppedUnder || ranNear) {
      phase = 'dropping';
      dropProgress = 0;
      woke = true;
    }
    return { state: { phase, dropProgress, rattleTimer, caught }, woke, rattled, caught, speed: 0 };
  }

  if (phase === 'dropping') {
    dropProgress = Math.min(1, dropProgress + dt / CABLE.dropTime);
    if (dropProgress >= 1) phase = 'hunting';
    return { state: { phase, dropProgress, rattleTimer, caught }, woke, rattled, caught, speed: 0 };
  }

  // phase === 'hunting'
  if (doorBlocked) {
    rattleTimer -= dt;
    if (rattleTimer <= 0) { rattleTimer = CABLE.rattleEvery; rattled = true; }
    return { state: { phase, dropProgress: 1, rattleTimer, caught }, woke, rattled, caught, speed: 0 };
  }

  rattleTimer = Math.max(0, rattleTimer - dt);
  if (!caught && clearLine && distToCreature < CABLE.catchRadius) caught = true;
  return { state: { phase, dropProgress: 1, rattleTimer, caught }, woke, rattled, caught, speed: caught ? 0 : CABLE.huntSpeed };
}
