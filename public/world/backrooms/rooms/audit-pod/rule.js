// Pure rule for The Efficiency Partners (neutral management consultants with
// clipboards who briskly walk up, click their pens, and hand you Pink Slips).
// 100% non-hostile: if your hand is empty they place a 'pink-slip' straight in
// it; if your hand is occupied they hold the slip out politely for [E] swap
// without ever overwriting a held flashlight or balloon.

export const PARTNER = Object.freeze({
  noticeRadius: 8.5,
  approachSpeed: 1.52,
  departSpeed: 1.15,
  offerDist: 1.28,
  offerWait: 5.5,
  cooldown: 14.0,
  clickEvery: 2.8,
});

export const createPartnerState = (offset = 0) => ({
  phase: 'observing',        // 'observing' | 'approaching' | 'offering' | 'departing'
  timer: offset,
  clickTimer: 1.1 + offset * 0.5,
});

/**
 * Step an Efficiency Partner by `dt` seconds.
 * @param s  state from createPartnerState()
 * @param o  { dt, dist, insideRoom, handEmpty, acceptedViaUse }
 */
export function stepPartner(s, o) {
  const {
    dt,
    dist = Infinity,
    insideRoom = false,
    handEmpty = true,
    acceptedViaUse = false,
  } = o;

  let { phase, timer, clickTimer } = s;
  let clickedPen = false, gaveSlip = false;

  clickTimer -= dt;
  if (clickTimer <= 0) {
    clickTimer = PARTNER.clickEvery;
    clickedPen = true;
  }

  if (phase === 'observing') {
    if (insideRoom || dist < PARTNER.noticeRadius) {
      phase = 'approaching';
    }
    return { state: { phase, timer, clickTimer }, clickedPen, gaveSlip, speed: 0, canSwap: false };
  }

  if (phase === 'approaching') {
    if (dist <= PARTNER.offerDist) {
      if (handEmpty) {
        gaveSlip = true;
        phase = 'departing';
        timer = PARTNER.cooldown;
        return { state: { phase, timer, clickTimer }, clickedPen: true, gaveSlip, speed: 0, canSwap: false };
      }
      phase = 'offering';
      timer = PARTNER.offerWait;
      return { state: { phase, timer, clickTimer }, clickedPen: true, gaveSlip, speed: 0, canSwap: true };
    }
    return { state: { phase, timer, clickTimer }, clickedPen, gaveSlip, speed: PARTNER.approachSpeed, canSwap: false };
  }

  if (phase === 'offering') {
    if (acceptedViaUse || handEmpty) {
      gaveSlip = true;
      phase = 'departing';
      timer = PARTNER.cooldown;
      return { state: { phase, timer, clickTimer }, clickedPen: true, gaveSlip, speed: 0, canSwap: false };
    }
    timer -= dt;
    if (timer <= 0 || dist > PARTNER.offerDist + 1.4) {
      phase = 'departing';
      timer = PARTNER.cooldown * 0.65;
      return { state: { phase, timer, clickTimer }, clickedPen, gaveSlip, speed: PARTNER.departSpeed, canSwap: false };
    }
    return { state: { phase, timer, clickTimer }, clickedPen, gaveSlip, speed: 0, canSwap: true };
  }

  // phase === 'departing'
  timer -= dt;
  if (timer <= 0) {
    phase = 'observing';
  }
  return { state: { phase, timer, clickTimer }, clickedPen, gaveSlip, speed: PARTNER.departSpeed, canSwap: false };
}
