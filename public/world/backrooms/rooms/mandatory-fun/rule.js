// Pure rule for The Fun Committee in Mandatory Fun.
// Hold a red balloon ('balloon') and the Culture Crew dances and celebrates
// harmlessly; cross past the foyer threshold empty-handed and the circle breaks
// to swarm you.

export const PARTY = Object.freeze({
  swarmSpeed: 2.85,
  returnSpeed: 1.8,
  catchRadius: 0.65,
  hornEvery: 3.8,
});

export const createPartyState = () => ({
  mode: 'idle',              // 'idle' | 'partying' | 'swarming'
  hornTimer: 0.8,
  dancePhase: 0,
  caught: false,
});

/**
 * Step The Fun Committee by `dt` seconds.
 * @param s  state from createPartyState()
 * @param o  { dt, insideRoom, pastThreshold, holdingBalloon, minDist }
 */
export function stepParty(s, o) {
  const {
    dt,
    insideRoom = false,
    pastThreshold = false,
    holdingBalloon = false,
    minDist = Infinity,
  } = o;

  let { mode, hornTimer, dancePhase, caught } = s;
  let horn = false, triggeredSwarm = false;

  if (holdingBalloon && insideRoom) {
    if (mode !== 'partying') {
      mode = 'partying';
      horn = true;
      hornTimer = PARTY.hornEvery;
    } else {
      hornTimer -= dt;
      if (hornTimer <= 0) {
        hornTimer = PARTY.hornEvery;
        horn = true;
      }
    }
    dancePhase += dt * 4.6;
    return {
      state: { mode, hornTimer, dancePhase, caught },
      horn,
      triggeredSwarm,
      caught,
      speed: 0,
    };
  }

  if (!insideRoom) {
    mode = holdingBalloon ? 'partying' : 'idle';
    return {
      state: { mode, hornTimer, dancePhase, caught },
      horn,
      triggeredSwarm,
      caught,
      speed: PARTY.returnSpeed,
    };
  }

  // Inside the room without a red balloon
  if (pastThreshold || mode === 'swarming') {
    if (mode !== 'swarming') {
      mode = 'swarming';
      triggeredSwarm = true;
    }
    dancePhase += dt * 9.5;
    if (!caught && minDist < PARTY.catchRadius) caught = true;
    return {
      state: { mode, hornTimer, dancePhase, caught },
      horn,
      triggeredSwarm,
      caught,
      speed: PARTY.swarmSpeed,
    };
  }

  // Standing in the safe threshold strip without a balloon: they stare silently
  mode = 'idle';
  return {
    state: { mode, hornTimer, dancePhase, caught },
    horn,
    triggeredSwarm,
    caught,
    speed: 0,
  };
}
