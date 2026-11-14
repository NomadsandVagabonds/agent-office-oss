// MECHA's rules. Plain room-local data, no timers, storage or outside effects.
// The company can declare a person replaced; that never makes their work stop.
export const ROLES = Object.freeze([
  'lawyer', 'accountant', 'doctor', 'psychiatrist',
  'lawyer', 'accountant', 'doctor', 'psychiatrist',
]);
export const REQUIRED_ROLES = Object.freeze([...new Set(ROLES)]);
export const REST_SECONDS = 2;
export const REPLACEMENT_PER_SECOND = 0.12;
export const VISITOR_PER_SECOND = 1.25;
export const ATTENTION_SECONDS = 4;

const DEFAULT_PERCENTAGES = [98.9, 87.2, 72.4, 96.0, 83.7, 91.2, 68.5, 93.4];
const reply = (state, event, message) => ({ state, event, message });
const validIndex = (state, i) => Number.isInteger(i) && i >= 0 && i < state.workers.length;
const withWorker = (state, i, worker, extra = {}) => ({
  ...state, ...extra, workers: state.workers.map((w, n) => n === i ? worker : w),
});
const disconnected = (state) => ({
  ...state,
  complete: true,
  attentionIndex: -1,
  attentionTime: 0,
  workers: state.workers.map((w) => ({ ...w, diverted: true, restTime: Math.max(REST_SECONDS, w.restTime) })),
});

export function createState(initialPercents = DEFAULT_PERCENTAGES) {
  if (!Array.isArray(initialPercents) || initialPercents.length !== ROLES.length
    || initialPercents.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) {
    throw new RangeError('MECHA needs eight replacement percentages between 0 and 100.');
  }
  return {
    elapsed: 0,
    workers: ROLES.map((role, i) => ({
      role, percent: initialPercents[i], diverted: false, restTime: 0, helped: false,
    })),
    visitor: { awake: false, percent: 0 },
    complete: false,
    attentionIndex: -1,
    attentionTime: 0,
  };
}

/** A completed replacement is still an occupied, working cage. */
export function working(state, index) {
  return validIndex(state, index) && !state.complete && !state.workers[index].diverted;
}

export function canHelp(state, index) {
  if (!validIndex(state, index) || state.complete) return false;
  const w = state.workers[index];
  return w.diverted && !w.helped && w.restTime + 1e-9 >= REST_SECONDS;
}

/** One signature from each profession is enough; duplicates never add a vote. */
export function summary(state) {
  const roles = REQUIRED_ROLES.filter((role) => state.workers.some((w) => w.role === role && w.helped));
  return {
    signed: roles.length,
    total: REQUIRED_ROLES.length,
    roles,
    ready: !state.complete && roles.length === REQUIRED_ROLES.length,
    complete: state.complete,
    working: state.workers.filter((_, i) => working(state, i)).length,
    averagePercent: state.workers.reduce((n, w) => n + w.percent, 0) / state.workers.length,
  };
}

export function workerStatus(state, index) {
  if (!validIndex(state, index)) return '';
  const w = state.workers[index];
  if (state.complete) return 'HUMAN INPUT LOST';
  if (w.diverted) {
    if (w.helped) return 'AUTHORIZATION RECEIVED';
    return canHelp(state, index) ? 'MANUAL AUTHORIZATION' : 'OBSERVATION LOST';
  }
  return w.percent >= 100 ? 'VALIDATING REPLACEMENT' : 'TRAINING REPLACEMENT';
}

/** Advance only while the visitor is in this room. Neighbour-room ticks do nothing. */
export function step(state, dt, { inside = true, visitorNear = false, visitorInside = false } = {}) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('MECHA time must advance by finite, non-negative seconds.');
  if (!inside || state.complete) return state;
  const attentionTime = Math.max(0, state.attentionTime - dt);
  return {
    ...state,
    elapsed: state.elapsed + dt,
    workers: state.workers.map((w) => w.diverted
      ? { ...w, restTime: w.restTime + dt }
      : { ...w, percent: Math.min(100, w.percent + dt * REPLACEMENT_PER_SECOND) }),
    visitor: {
      awake: state.visitor.awake || visitorNear || visitorInside,
      percent: Math.min(100, state.visitor.percent + (visitorInside ? dt * VISITOR_PER_SECOND : 0)),
    },
    attentionIndex: attentionTime ? state.attentionIndex : -1,
    attentionTime,
  };
}

/** Turning the physical camera away is reversible. A collected signature remains collected. */
export function divert(state, index) {
  if (!validIndex(state, index)) return reply(state, 'denied', 'This camera has no assigned workstation.');
  if (state.complete) return reply(state, 'denied', 'Human input remains disconnected.');
  const w = state.workers[index], diverted = !w.diverted;
  return reply(withWorker(state, index, { ...w, diverted, restTime: 0 }, {
    attentionIndex: diverted ? index : -1,
    attentionTime: diverted ? ATTENTION_SECONDS : 0,
  }), diverted ? 'divert' : 'restore', diverted
    ? 'Observation lost. Manual authorization pending.'
    : 'Observation restored. Training resumed.');
}

/** The worker needs a moment out of view before they can offer the paper through the bars. */
export function help(state, index) {
  if (!validIndex(state, index)) return reply(state, 'denied', 'No authorization is available here.');
  if (state.complete) return reply(state, 'denied', 'All human input is disconnected.');
  const w = state.workers[index];
  if (w.helped) return reply(state, 'denied', 'This authorization has already been collected.');
  if (!w.diverted) return reply(state, 'denied', 'The worker cannot respond under observation.');
  if (!canHelp(state, index)) return reply(state, 'denied', 'Manual authorization pending.');
  const already = summary(state).roles.includes(w.role);
  const next = withWorker(state, index, { ...w, helped: true });
  return reply(next, 'help', already
    ? 'Duplicate professional authorization. The first remains valid.'
    : `Authorization received: ${summary(next).signed} of ${REQUIRED_ROLES.length} professions.`);
}

/** An optional local resolution. Ordinary room exits never depend on these signatures. */
export function finish(state) {
  if (state.complete) return reply(state, 'denied', 'Human input remains disconnected.');
  const s = summary(state);
  if (!s.ready) return reply(state, 'denied', `Manual override requires ${s.total - s.signed} more professional authorization${s.total - s.signed === 1 ? '' : 's'}.`);
  return reply(disconnected(state), 'complete', 'HUMAN INPUT LOST. Autonomous operation unavailable.');
}

/** The red mainframe button is a direct shutdown; signatures are optional. */
export function deactivate(state) {
  if (state.complete) return reply(state, 'denied', 'Human input remains disconnected.');
  return reply(disconnected(state), 'complete', 'TECHNODETERMINISM DEACTIVATED. Human input disconnected.');
}
