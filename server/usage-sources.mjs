// The Office — turning what a runtime says about its own limits into a usage
// report (see usage.mjs). Pure functions: the Codex observer, the Claude Code
// status-line bridge and the tests all use the same ones.
//
// Shapes we depend on:
//   Claude Code status line input (documented): rate_limits.five_hour / .seven_day
//     { used_percentage, resets_at (epoch seconds) } and rate_limits.spend_limit
//     { used_percentage, resets_at, used_usd?, limit_usd?, period? }.
//   Codex rate-limit snapshot (its session files and its app-server): primary /
//     secondary { used_percent | usedPercent, window_minutes | windowDurationMins,
//     resets_at | resetsAt (epoch seconds) | resets_in_seconds }, plan_type, limit_id.
const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const WEEK = 7 * 24 * 60, MONTH = 30 * 24 * 60;

/** Claude Code's status-line JSON → a report, or null when it carries no limits (API-key users, first seconds of a session). */
export function claudeStatusLineToReport(input) {
  const limits = input && typeof input === 'object' ? input.rate_limits : null;
  if (!limits || typeof limits !== 'object') return null;
  const windows = [];
  const add = (key, kind, label, mins) => {
    const w = limits[key];
    if (!w || n(w.used_percentage) === null) return;
    windows.push({ id: key, kind, label, usedPercent: w.used_percentage, resetsAt: n(w.resets_at), windowMins: mins });
  };
  add('five_hour', 'session', 'Session', 300);
  add('seven_day', 'weekly', 'Week', WEEK);
  const spend = limits.spend_limit;
  if (spend && n(spend.used_percentage) !== null) {
    const w = { id: 'spend_limit', kind: 'credit', label: spend.period ? `Spend limit (${String(spend.period).slice(0, 12)})` : 'Spend limit',
      usedPercent: spend.used_percentage, resetsAt: n(spend.resets_at) };
    if (n(spend.used_usd) !== null && n(spend.limit_usd) > 0) Object.assign(w, { used: spend.used_usd, limit: spend.limit_usd, unit: 'usd' });
    windows.push(w);
  }
  return windows.length ? { provider: 'claude', source: 'statusline', windows } : null;
}

/** A Codex rate-limit snapshot → a report, or null. `at` is when Codex wrote it (ms), for "resets in N seconds". */
export function codexRateLimitsToReport(snapshot, at = Date.now()) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  // Model-specific quotas ride along under their own ids; the main allowance is "codex" (older builds send no id).
  const limitId = snapshot.limit_id ?? snapshot.limitId;
  if (limitId && limitId !== 'codex') return null;
  const plan = snapshot.plan_type ?? snapshot.planType ?? null;
  const monthlyPlan = plan === 'free' || plan === 'go';
  const windows = [];
  for (const [id, fallback] of [['primary', monthlyPlan ? MONTH : 300], ['secondary', WEEK]]) {
    const w = snapshot[id];
    const used = w ? n(w.used_percent ?? w.usedPercent) : null;
    if (used === null) continue;
    const mins = n(w.window_minutes ?? w.windowDurationMins ?? w.window_duration_mins) || fallback;
    const kind = mins >= MONTH - 2 * 24 * 60 ? 'monthly' : mins >= WEEK - 24 * 60 ? 'weekly' : 'session';
    const resetsAt = n(w.resets_at ?? w.resetsAt);
    const resetsIn = n(w.resets_in_seconds ?? w.resetsInSeconds);
    windows.push({ id, kind, label: kind === 'session' ? 'Session' : kind === 'weekly' ? 'Week' : 'Month', usedPercent: used, windowMins: mins,
      resetsAt: resetsAt !== null ? resetsAt : (resetsIn !== null ? at + resetsIn * 1000 : null) });
  }
  if (!windows.length) return null;
  return { provider: 'codex', source: 'codex-session', plan: plan ? String(plan).slice(0, 24) : undefined, replace: true, checkedAt: at, windows };
}
