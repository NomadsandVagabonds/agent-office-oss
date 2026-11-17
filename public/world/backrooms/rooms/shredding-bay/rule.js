// Pure rule for The Retention Clerk (the whistling records matron pushing an
// industrial cross-cut shredder). No three.js, no Math.random.

export const SHREDDER = Object.freeze({
  wakeRadius: 9.5,
  followSpeed: 1.25,
  leaveSpeed: 1.1,
  whistleEvery: 10.5,       // seconds between her whistles while she is after you: about 9 to 12 (the owner: it was on a loop)
  whistleSpread: 1.5,       // …and how far from that it varies, from a count
  whistleGap: 6,            // the least between two, whatever the phase (a pleased one for paper counts too)
  catchRadius: 0.88,
  shredTime: 2.1,
  pullTime: 0.72,
  hurts: 2,                 // hearts the rollers cost, where there are hearts
  respite: 12,              // seconds she is content, on her way back to her place, after having had some of somebody
});

export const createShredderState = () => ({
  phase: 'waiting',          // 'waiting' | 'following' | 'shredding' | 'leaving' | 'pulling'
  timer: 0.6,
  whistleTimer: 1.1,
  caught: false,
  since: SHREDDER.whistleGap,    // seconds since she last whistled
  whistles: 0,
});

/**
 * Step the Retention Clerk by `dt` seconds.
 * @param s  state from createShredderState()
 * @param o  { dt, dist, insideRoom, holdingPaper, offeredPaper, clearLine, contactClear }
 */
/** The rollers had hold of somebody, and they are still here: she lets go, pleased enough, and wheels it back to where she stands. */
export function releaseShredder(s) { return { ...s, phase: 'leaving', caught: false, timer: 0, whistleTimer: 0.2, rest: SHREDDER.respite }; }

export function stepShredder(s, o) {
  const { dt, dist, insideRoom = false, holdingPaper = false, offeredPaper = false, clearLine = true, contactClear = true } = o;
  let whistled = false, chirp = false, atePaper = false, grabbed = false, caught = s.caught;
  let { phase, timer, whistleTimer } = s;
  let since = (s.since ?? SHREDDER.whistleGap) + dt, whistles = s.whistles ?? 0;
  const state = (extra = {}) => ({ phase, timer, whistleTimer, caught, since, whistles, ...extra });
  // Her whistle is how she is heard coming, and it is rare: about every 9 to 12 s (varied, from a count, never from chance), and
  // never twice within whistleGap whatever the phase. `whistle()` asks for one: yes if it is time and it has been long enough.
  const gap = () => SHREDDER.whistleEvery + SHREDDER.whistleSpread * Math.sin(whistles * 2.4 + 0.7);
  const whistle = () => { if (since < SHREDDER.whistleGap) return false; since = 0; whistles++; return true; };

  if (phase === 'waiting') {
    if (insideRoom || dist < SHREDDER.wakeRadius) {
      phase = 'following';
      whistleTimer = 0.35;
    }
    return { state: state(), whistled, chirp, atePaper, grabbed, caught, speed: 0, pullProgress: 0 };
  }

  if (phase === 'following') {
    whistleTimer -= dt;
    if (whistleTimer <= 0) { if (whistle()) { whistled = true; whistleTimer = gap(); } else whistleTimer = SHREDDER.whistleGap - since + 0.05; }

    // Handing paper voluntarily via E, or bumping into her while holding paper, satisfies her
    if (clearLine && contactClear && (offeredPaper || (holdingPaper && dist < SHREDDER.catchRadius + 0.15))) {
      phase = 'shredding';
      timer = SHREDDER.shredTime;
      atePaper = true;
      chirp = whistle();                                       // (pleased, if she has not just whistled)
      return { state: state(), whistled, chirp, atePaper, grabbed, caught, speed: 0, pullProgress: 0 };
    }

    if (clearLine && contactClear && dist < SHREDDER.catchRadius) {
      phase = 'pulling';
      timer = 0;
      grabbed = true;
      return { state: state(), whistled, chirp, atePaper, grabbed, caught, speed: 0, pullProgress: 0 };
    }

    return { state: state(), whistled, chirp, atePaper, grabbed, caught, speed: SHREDDER.followSpeed, pullProgress: 0 };
  }

  if (phase === 'shredding') {
    timer -= dt;
    if (timer <= 0) {
      phase = 'leaving';
      whistleTimer = 0.2;
    }
    return { state: state(), whistled, chirp, atePaper, grabbed, caught, speed: 0, pullProgress: 0 };
  }

  if (phase === 'leaving') {
    whistleTimer -= dt;
    // (fed paper she is done with you for good, and quiet: no rest to count down. Only after a taste of you does she whistle her way home)
    if (s.rest > 0 && whistleTimer <= 0) { if (whistle()) { whistled = true; whistleTimer = gap() * 1.4; } else whistleTimer = SHREDDER.whistleGap - since + 0.05; }
    // (after paper she is done with you for good; after a taste of you, only for a while)
    const rest = s.rest > 0 ? s.rest - dt : undefined;
    if (rest !== undefined && rest <= 0) return { state: { phase: 'waiting', timer: 0.6, whistleTimer: 1.1, caught: false, since, whistles }, whistled, chirp, atePaper, grabbed, caught: false, speed: 0, pullProgress: 0 };
    return { state: state(rest !== undefined ? { rest } : {}), whistled, chirp, atePaper, grabbed, caught, speed: SHREDDER.leaveSpeed, pullProgress: 0 };
  }

  // phase === 'pulling': dragging the visitor down into the cross-cut jaws
  timer = Math.min(SHREDDER.pullTime, timer + dt);
  const pullProgress = timer / SHREDDER.pullTime;
  if (!caught && timer >= SHREDDER.pullTime) caught = true;
  return { state: state(), whistled, chirp, atePaper, grabbed, caught, speed: 0, pullProgress };
}
