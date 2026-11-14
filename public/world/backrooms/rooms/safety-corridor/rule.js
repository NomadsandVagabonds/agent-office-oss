// Pure rule for The Floor Warden (the safety marshall who enforces NO RUNNING
// IN CORRIDORS by sprinting after runners with giant office scissors).
// Walk calmly (`playerSpeed <= 2.55`) and he stays on peaceful patrol. Run near
// him and he blows his pea-whistle and sprints at 3.45 m/s. Evade him for 8
// seconds and he trips headlong onto his own scissors and despawns.

export const WARDEN = Object.freeze({
  runSpeedThreshold: 2.55,
  hearRadius: 11.5,
  patrolSpeed: 0.92,
  chaseSpeed: 3.45,
  catchRadius: 0.66,
  evadeDuration: 8.0,
  tripDuration: 0.85,
  snipEvery: 0.27,
});

export const createWardenState = () => ({
  phase: 'patrol',           // 'patrol' | 'chasing' | 'tripping' | 'gone'
  chaseTimer: 0,
  tripTimer: 0,
  snipTimer: 0.14,
  patrolDir: 1,
  caught: false,
});

/**
 * Step The Floor Warden by `dt` seconds.
 * @param s  state from createWardenState()
 * @param o  { dt, dist, playerSpeed, insideRoom, clearLine }
 */
export function stepWarden(s, o) {
  const {
    dt,
    dist = Infinity,
    playerSpeed = 0,
    insideRoom = false,
    clearLine = false,
  } = o;

  let { phase, chaseTimer, tripTimer, snipTimer, patrolDir, caught } = s;
  let blewWhistle = false, snipped = false, trippedNow = false, despawned = false;

  if (phase === 'gone') {
    return {
      state: s,
      blewWhistle, snipped, trippedNow, despawned, caught,
      speed: 0, tripProgress: 1,
    };
  }

  if (phase === 'patrol') {
    const noticedRun = playerSpeed > WARDEN.runSpeedThreshold && (insideRoom || (dist < WARDEN.hearRadius && clearLine));
    if (noticedRun) {
      phase = 'chasing';
      chaseTimer = 0;
      snipTimer = 0.12;
      blewWhistle = true;
      return {
        state: { phase, chaseTimer, tripTimer, snipTimer, patrolDir, caught },
        blewWhistle, snipped, trippedNow, despawned, caught,
        speed: WARDEN.chaseSpeed, tripProgress: 0,
      };
    }
    return {
      state: { phase, chaseTimer, tripTimer, snipTimer, patrolDir, caught },
      blewWhistle, snipped, trippedNow, despawned, caught,
      speed: WARDEN.patrolSpeed, tripProgress: 0,
    };
  }

  if (phase === 'chasing') {
    if (clearLine && dist < WARDEN.catchRadius) {
      caught = true;
      snipped = true;
      return {
        state: { phase, chaseTimer, tripTimer, snipTimer, patrolDir, caught },
        blewWhistle, snipped, trippedNow, despawned, caught,
        speed: 0, tripProgress: 0,
      };
    }

    chaseTimer += dt;
    snipTimer -= dt;
    if (snipTimer <= 0) {
      snipTimer = WARDEN.snipEvery;
      snipped = true;
    }

    if (chaseTimer >= WARDEN.evadeDuration) {
      phase = 'tripping';
      tripTimer = 0;
      trippedNow = true;
      return {
        state: { phase, chaseTimer, tripTimer, snipTimer, patrolDir, caught },
        blewWhistle, snipped, trippedNow, despawned, caught,
        speed: 0, tripProgress: 0,
      };
    }

    return {
      state: { phase, chaseTimer, tripTimer, snipTimer, patrolDir, caught },
      blewWhistle, snipped, trippedNow, despawned, caught,
      speed: WARDEN.chaseSpeed, tripProgress: 0,
    };
  }

  // phase === 'tripping'
  tripTimer += dt;
  const tripProgress = Math.min(1, tripTimer / WARDEN.tripDuration);
  if (tripTimer >= WARDEN.tripDuration) {
    phase = 'gone';
    despawned = true;
  }
  return {
    state: { phase, chaseTimer, tripTimer, snipTimer, patrolDir, caught },
    blewWhistle, snipped, trippedNow, despawned, caught,
    speed: 0, tripProgress,
  };
}
