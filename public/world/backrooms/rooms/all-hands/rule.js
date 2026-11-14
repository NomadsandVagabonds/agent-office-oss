// Pure state machine & raked-bowl heightfield for `all-hands` ("Mandatory All-Hands").
// Zero Three.js / DOM imports so tests can verify both the auditorium heightfield
// and the slide -> Q&A spotlight -> Keynote Speaker setback loop deterministically.

export const QA_SLIDE = 3;
export const ADJOURNED_SLIDE = 4;

export const ALL_HANDS = Object.freeze({
  shutterPeriod: 2.1,
  blackoutDur: 0.22,
  stepAdvance: 1.45,
  catchRadius: 1.0,
});

/**
 * Raked auditorium floor height `y` in local room coordinates (`x` across, `z` deep).
 * - Back concourse (`z >= zTop`) & outer side promenades (`|x| >= sideX, z >= -1.0`): `0`
 * - 5-step raked seating bowl: `-0.22` down to `-1.10` in Orchestra Pit
 * - Walnut proscenium stage (`z < stageZ`): `-0.44`, joined to pit by 3-riser side stairs
 */
export function auditoriumFloorY(x, z, W, D) {
  const sideX = W / 2 - 2.25;
  const zTop = D / 2 - 3.2;
  const stageZ = -D / 2 + 5.2;
  const pitZ = stageZ + 1.8;

  // Flat upper concourse connecting front (+D/2) and left/right (z = 0) doorways
  if (z >= zTop) return 0;
  if (Math.abs(x) >= sideX && z >= -1.2) return 0;

  // Raised walnut stage at the front (-z) of the hall
  if (z <= stageZ) return -0.44;

  // Twin 3-riser stage stairs bridging pit (-1.10) up to stage (-0.44)
  if (Math.abs(x) >= 3.2 && Math.abs(x) <= 4.8 && z > stageZ && z <= stageZ + 0.9) {
    const u = (z - stageZ) / 0.9; // 0 at stage (-0.44) -> 1 at pit (-1.10)
    if (u < 0.333) return -0.66;
    if (u < 0.667) return -0.88;
    return -1.10;
  }

  // Orchestra pit in front of the stage
  if (z <= pitZ) return -1.10;

  // 5-tier raked seating bowl from zTop (0) down to pitZ (-1.10) in 0.22m steps
  const span = Math.max(1, zTop - pitZ);
  const frac = (zTop - z) / span; // 0 at back -> 1 at pit
  const tier = Math.min(5, Math.max(1, Math.ceil(frac * 5)));
  return -(tier * 0.22);
}

export function allHandsStash(r, side) {
  return side < 0
    ? [-(r.W / 2 - 2.8), -r.D / 2 + 2.2, -(r.W / 2 - 3.8), -r.D / 2 + 3.2]
    : [r.W / 2 - 3.8, -r.D / 2 + 2.2, r.W / 2 - 2.8, -r.D / 2 + 3.2];
}

export function createAllHandsState() {
  return {
    phase: 'slides', // 'slides' | 'qa' | 'adjourned'
    slide: 0,
    timer: 0,
    speakerProgress: 0, // metres advanced from lectern toward the visitor
    blackout: false,
    setbacks: 0,
  };
}

export function stepAllHands(state, {
  dt = 0,
  clickedSlide = false,
  usedMic = false,
  insideRoom = false,
  distToSpeaker = 99,
} = {}) {
  let { phase, slide, timer, speakerProgress, blackout, setbacks } = state;
  let changedSlide = false, triggeredQa = false, stepped = false, setback = false, adjourned = false;

  if (phase === 'slides') {
    blackout = false;
    if (clickedSlide) {
      slide = Math.min(QA_SLIDE, slide + 1);
      changedSlide = true;
      if (slide === QA_SLIDE) {
        phase = 'qa';
        timer = 0;
        speakerProgress = 0;
        triggeredQa = true;
      }
    }
  } else if (phase === 'qa') {
    if (usedMic) {
      phase = 'adjourned';
      slide = ADJOURNED_SLIDE;
      blackout = false;
      speakerProgress = 0;
      adjourned = true;
      changedSlide = true;
    } else if (insideRoom) {
      const prevCycle = Math.floor(timer / ALL_HANDS.shutterPeriod);
      timer += dt;
      const curCycle = Math.floor(timer / ALL_HANDS.shutterPeriod);
      const inCycle = timer - curCycle * ALL_HANDS.shutterPeriod;
      blackout = inCycle < ALL_HANDS.blackoutDur;

      if (curCycle > prevCycle) {
        speakerProgress += ALL_HANDS.stepAdvance;
        stepped = true;
      }
      if (distToSpeaker <= ALL_HANDS.catchRadius) {
        setback = true;
        setbacks += 1;
        phase = 'slides';
        slide = QA_SLIDE - 1;
        timer = 0;
        speakerProgress = 0;
        blackout = false;
        changedSlide = true;
      }
    } else {
      blackout = false;
    }
  } else {
    blackout = false;
  }

  return {
    state: { phase, slide, timer, speakerProgress, blackout, setbacks },
    changedSlide,
    triggeredQa,
    stepped,
    setback,
    adjourned,
  };
}
