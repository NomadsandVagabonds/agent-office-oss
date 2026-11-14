// The Office — harness: its settings, read once from the environment by
// server/config.mjs. Every number here is a guard rail: how many agents the
// office may run, how often it may start a turn by itself, how far a chain of
// agents waking agents may go before a human has to step in.

export const WAKE_MODES = Object.freeze(['off', 'results', 'direct']);
const MODES = ['ask', 'edits', 'full'];

function int(env, name, fallback, min, max) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

function pick(env, name, allowed, fallback) {
  const v = String(env[name] || '').toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

export function harnessSettings(env = {}) {
  return Object.freeze({
    enabled: env.OFFICE_HARNESS !== '0',
    injectMcp: env.OFFICE_HARNESS_MCP !== '0',            // give launched agents the office tools
    trace: env.OFFICE_HARNESS_TRACE === '1',              // write raw protocol frames beside the transcript (debugging)
    toolOutput: env.OFFICE_HARNESS_TOOL_OUTPUT !== '0',   // keep a bounded tail of tool output in transcripts
    maxSessions: int(env, 'OFFICE_HARNESS_MAX_SESSIONS', 8, 1, 64),
    startTimeoutMs: int(env, 'OFFICE_HARNESS_START_TIMEOUT_MS', 45_000, 500, 600_000),
    cancelTimeoutMs: int(env, 'OFFICE_HARNESS_CANCEL_TIMEOUT_MS', 15_000, 100, 600_000),
    maxQueuedTurns: 16,
    wake: Object.freeze({
      default: pick(env, 'OFFICE_WAKE_DEFAULT', WAKE_MODES, 'off'),     // opt-in: nobody is woken unless a human says so
      minGapMs: int(env, 'OFFICE_WAKE_MIN_GAP_MS', 20_000, 0, 3_600_000),
      maxPerHour: int(env, 'OFFICE_WAKE_MAX_PER_HOUR', 12, 1, 600),
      maxHops: int(env, 'OFFICE_WAKE_MAX_HOPS', 3, 1, 12),
      budget: int(env, 'OFFICE_WAKE_BUDGET', 20, 1, 1000),
      debounceMs: int(env, 'OFFICE_WAKE_DEBOUNCE_MS', 600, 0, 60_000),
    }),
    delegate: Object.freeze({
      enabled: env.OFFICE_DELEGATE !== '0',
      maxMode: pick(env, 'OFFICE_DELEGATE_MAX_MODE', MODES, 'ask'),     // a delegate asks the human unless the operator says otherwise
      maxPerHour: int(env, 'OFFICE_DELEGATE_MAX_PER_HOUR', 12, 1, 600),
      maxActive: int(env, 'OFFICE_DELEGATE_MAX_ACTIVE', 4, 1, 32),
      idleEndMs: int(env, 'OFFICE_DELEGATE_IDLE_END_MS', 15 * 60_000, 0, 24 * 3_600_000),
      waitCapMs: int(env, 'OFFICE_DELEGATE_WAIT_CAP_MS', 50_000, 100, 240_000),
      resultChars: 8000,
    }),
    // What a turn changed (checkpoints.mjs): snapshots of the working tree, kept in an object directory of
    // the office's own — nothing is written into the repository. Each number bounds what that may cost:
    // how long a turn waits, how long git may run, how much is copied, how much is kept.
    checkpoints: Object.freeze({
      // Off unless asked for (OFFICE_CHECKPOINTS=1) while this is still being reviewed; OFFICE_GIT=0 means no git at all, this included.
      enabled: env.OFFICE_CHECKPOINTS === '1' && env.OFFICE_GIT !== '0',
      holdMs: int(env, 'OFFICE_CHECKPOINTS_HOLD_MS', 3_000, 100, 60_000),            // how long a turn waits for the snapshot taken before it
      timeoutMs: int(env, 'OFFICE_CHECKPOINTS_TIMEOUT_MS', 30_000, 200, 600_000),    // one snapshot, all its git calls together
      // The first snapshot of a folder copies every file that is not ignored: how big a folder is taken at all.
      maxTreeFiles: int(env, 'OFFICE_CHECKPOINTS_MAX_TREE_FILES', 50_000, 1, 5_000_000),
      maxTreeBytes: int(env, 'OFFICE_CHECKPOINTS_MAX_TREE_BYTES', 512 * 1024 * 1024, 1024, 1024 * 1024 * 1024 * 1024),
      // Later snapshots copy only what is new or changed: how much one of them takes in.
      maxFiles: int(env, 'OFFICE_CHECKPOINTS_MAX_FILES', 5_000, 1, 1_000_000),
      maxBytes: int(env, 'OFFICE_CHECKPOINTS_MAX_BYTES', 100 * 1024 * 1024, 1024, 64 * 1024 * 1024 * 1024),
      maxTurns: int(env, 'OFFICE_CHECKPOINTS_MAX_TURNS', 100, 1, 10_000),            // turns kept per session
      diffBytes: int(env, 'OFFICE_CHECKPOINTS_DIFF_BYTES', 512 * 1024, 1024, 16 * 1024 * 1024),   // diff text one answer carries
    }),
  });
}
