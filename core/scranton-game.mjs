// Operation Gelatin — the Scranton floor's small, entirely fictional prank.
// Pure rules shared by the browser and tests. All times are monotonic seconds;
// there are no clocks, timers, network calls, or changes to real office tasks.
//
// createGame({ mode: 'relaxed' | 'challenge', now: 0 }) creates a ready game.
// act(state, 'borrow', now) returns { state, message, event }. `start` and
// `reset` also accept { type, mode }. The returned state replaces the old one.
// advance(state, now) is called each frame: it sets the jelly after eight
// seconds and ends a challenge at its deadline. A finished game stays finished.
// Start/retry is explicit; merely entering the floor never starts a timer.

export const CHILL_SECONDS = 8;
export const CHALLENGE_SECONDS = 120;
export const GAME_STAGES = Object.freeze([
  'ready', 'searching', 'borrowed', 'mixed', 'chilling', 'set', 'carrying', 'won', 'lost',
]);

const TERMINAL = new Set(['ready', 'won', 'lost']);
const MODE = new Set(['relaxed', 'challenge']);

function validMode(mode) {
  if (!MODE.has(mode)) throw new RangeError(`Unknown prank mode: ${mode}`);
  return mode;
}

function time(now, floor = 0) {
  if (!Number.isFinite(now) || now < 0) throw new RangeError('Game time must be a finite, non-negative number of seconds.');
  return Math.max(now, floor);
}

/** A JSON-safe state; creating it does not begin the prank. */
export function createGame({ mode = 'relaxed', now = 0 } = {}) {
  return {
    mode: validMode(mode), stage: 'ready', startedAt: null, deadline: null,
    chillUntil: null, finishedAt: null, lastNow: time(now),
  };
}

/** Advance time without side effects. At the deadline, timeout wins over any action. */
export function advance(state, now = state.lastNow) {
  const t = time(now, state.lastNow);
  if (TERMINAL.has(state.stage)) return state;
  if (state.deadline !== null && t >= state.deadline) {
    return { ...state, stage: 'lost', finishedAt: state.deadline, lastNow: t };
  }
  const stage = state.stage === 'chilling' && t >= state.chillUntil ? 'set' : state.stage;
  return stage === state.stage && t === state.lastNow ? state : { ...state, stage, lastNow: t };
}

/** Seconds left in a challenge; null means the timer is not running. */
export function remaining(state, now = state.lastNow) {
  if (state.deadline === null) return null;
  const t = state.finishedAt ?? time(now, state.lastNow);
  return Math.max(0, state.deadline - t);
}

/** Seconds left until retrieval is possible (zero when the fridge is done). */
export function chillRemaining(state, now = state.lastNow) {
  if (state.stage !== 'chilling') return 0;
  return Math.max(0, state.chillUntil - time(now, state.lastNow));
}

export function objective(state) {
  switch (state.stage) {
    case 'ready': return 'Read the confidential memo at reception to begin.';
    case 'searching': return 'Borrow the stapler from the assistant regional manager’s desk.';
    case 'borrowed': return 'Take the stapler to the gelatin kit in the kitchenette.';
    case 'mixed': return 'Put the suspiciously office-shaped dessert in the fridge.';
    case 'chilling': return 'Let the gelatin set. The fridge takes eight seconds.';
    case 'set': return 'Retrieve the set gelatin from the kitchenette fridge.';
    case 'carrying': return 'Put the gelatin back on the stapler’s original desk.';
    case 'won': return 'Prank complete. Maintain plausible deniability.';
    case 'lost': return 'The meeting is over. Return to reception for another attempt.';
    default: return 'Visit reception.';
  }
}

/** Human-readable pocket contents, deliberately separate from the objective. */
export function inventory(state) {
  switch (state.stage) {
    case 'borrowed': return ['Borrowed stapler'];
    case 'mixed': return ['Stapler in unset gelatin'];
    case 'carrying': return ['Stapler in lemon gelatin'];
    default: return [];
  }
}

const result = (state, message, event = 'denied') => ({ state, message, event });

/** Apply a deliberate interaction. Incorrect ordering leaves the prank intact. */
export function act(previous, action, now = previous.lastNow) {
  const type = typeof action === 'string' ? action : action?.type;
  const mode = typeof action === 'object' && action?.mode !== undefined ? validMode(action.mode) : previous.mode;
  const t = time(now, previous.lastNow);

  if (type === 'reset') {
    return result(createGame({ mode, now: t }), 'The evidence has been cleared. Reception has another memo.', 'reset');
  }

  const state = advance(previous, t);
  if (type === 'start') {
    if (!TERMINAL.has(state.stage)) return result(state, 'One prank at a time. Corporate has enough paperwork.');
    const next = {
      ...createGame({ mode, now: t }), stage: 'searching', startedAt: t,
      deadline: mode === 'challenge' ? t + CHALLENGE_SECONDS : null,
    };
    return result(next, mode === 'challenge'
      ? 'The branch meeting ends in two minutes. Borrow the stapler, then visit the kitchenette.'
      : 'Take your time. Borrow the stapler, then visit the kitchenette. This is a strictly non-billable activity.', 'start');
  }

  if (state.stage === 'lost') return result(state, 'The meeting is over. Everyone is back. Reception can arrange a fresh attempt.', previous.stage !== 'lost' ? 'timeout' : 'denied');
  if (state.stage === 'won') return result(state, 'The stapler has become dessert. Your work here is done. Visit reception to play again.');
  if (state.stage === 'ready') return result(state, 'A confidential memo at reception explains this entirely professional assignment.');

  switch (type) {
    case 'borrow':
      if (state.stage !== 'searching') return result(state, 'You already borrowed the stapler. One is sufficient for this recipe.');
      return result({ ...state, stage: 'borrowed' }, 'Stapler acquired. Its owner has labelled it “NOT A SHARED RESOURCE.”', 'borrow');
    case 'mix':
      if (state.stage === 'searching') return result(state, 'The recipe calls for one stapler. Borrow it from the sales desk first.');
      if (state.stage !== 'borrowed') return result(state, 'The gelatin has already been mixed. More gelatin would constitute scope creep.');
      return result({ ...state, stage: 'mixed' }, 'Lemon gelatin, one stapler, zero business justification. Put it in the fridge.', 'mix');
    case 'chill':
      if (state.stage === 'chilling') return result(state, `Still setting. ${Math.ceil(chillRemaining(state, t))} seconds until this becomes an HR matter.`);
      if (state.stage !== 'mixed') return result(state, 'Mix the stapler into the gelatin at the kitchenette counter first.');
      return result({ ...state, stage: 'chilling', chillUntil: t + CHILL_SECONDS }, 'Into the fridge. Eight seconds. Please do not eat the evidence.', 'chill');
    case 'retrieve':
      if (state.stage === 'chilling') return result(state, `Not quite set. Give it ${Math.ceil(chillRemaining(state, t))} more seconds.`);
      if (state.stage !== 'set') return result(state, 'Your dessert is not in the fridge. The yoghurt marked “DO NOT TOUCH” is unrelated.');
      return result({ ...state, stage: 'carrying' }, 'A perfect wobble. Return it to the desk where the stapler belongs.', 'retrieve');
    case 'return':
      if (state.stage !== 'carrying') return result(state, 'This desk requires a fully refrigerated prank. Follow the memo’s recipe first.');
      return result({ ...state, stage: 'won', finishedAt: t }, 'Prank complete. Somewhere, a very specific incident report is being drafted.', 'win');
    default:
      return result(state, 'That is not part of the recipe. The memo remains our only qualified project manager.');
  }
}
