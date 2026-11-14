// MECHA's security clock. Patrol movement and capture presentation belong to the room.
// No timers run behind the player's back or after the session has ended.
export const CAPTURE_SECONDS = 10;
/** What those seconds cost, in hearts (the deck's `caught`), and how long the wardens then take no notice of you. */
export const CAPTURE_HEARTS = 2;
export const MERCY_SECONDS = 8;

export function createSecurity() {
  return { phase: 'patrol', elapsed: 0, remaining: CAPTURE_SECONDS };
}

/**
 * Contact is measured at the start of the step. Repeated contact never resets
 * the countdown. A physical shutdown takes priority over capture on that step.
 */
export function stepSecurity(state, dt, { inside = true, caught = false, disable = false } = {}) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('MECHA security time must advance by finite, non-negative seconds.');
  if (!inside || state.phase === 'disabled' || state.phase === 'gameover') return state;
  if (disable) return { ...state, phase: 'disabled' };
  const phase = state.phase === 'captured' || caught ? 'captured' : 'patrol';
  if (!dt && phase === state.phase) return state;
  const left = phase === 'captured' ? Math.max(0, state.remaining - dt) : state.remaining;
  const remaining = left < 1e-9 ? 0 : left;
  return {
    phase: phase === 'captured' && !remaining ? 'gameover' : phase,
    elapsed: state.elapsed + (phase === 'captured' ? Math.min(dt, state.remaining) : dt),
    remaining,
  };
}

/**
 * The countdown has run out and the visitor is still here (it cost them hearts,
 * not the visit): the cage lets go, with a whole countdown for the next time.
 * Nothing else is ever let go: a shutdown stays a shutdown.
 */
export function releaseSecurity(state) {
  return state.phase === 'gameover' ? { phase: 'patrol', elapsed: state.elapsed, remaining: CAPTURE_SECONDS } : state;
}
