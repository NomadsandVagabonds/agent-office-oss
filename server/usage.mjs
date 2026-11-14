// The Office — how much is left.
//
// Every provider meters its plans differently: a five-hour window, a weekly
// one, a monthly credit, dollars on a key. Knowing which of them still has
// room decides which agent should take the next job. The office does not call
// models and holds no provider credentials, so it cannot ask on anyone's
// behalf; what it can do is collect what the runtimes already say about
// themselves and put it in one place:
//
//   - Claude Code hands its subscription windows to the status line
//     (hooks/office-statusline.mjs forwards them here)
//   - Codex writes its rate-limit snapshot into its session files
//     (observe-codex.mjs reads it)
//   - a session the office drives reports its provider's own numbers
//     ('usage:report' on the bus, from server/harness)
//   - anything else can POST /api/usage/report
//   - and, only when asked to (OFFICE_USAGE_OPENROUTER=1 with
//     OPENROUTER_API_KEY in the daemon's environment), the office asks
//     OpenRouter what is left on that key
//
// A meter always says where its numbers came from and how old they are. An
// old reading is shown as old, and a window whose reset time has passed is
// shown as "reset since", never as a current figure.
//
// The shape (windows with a used percentage and a reset time, merged by id)
// follows T3 Code's provider usage limits, which solved the same problem.
import { EV, normalizeProvider } from '../core/contract.mjs';
import { HttpError } from './http.mjs';
import { JsonFile } from './persist.mjs';

const KINDS = ['session', 'weekly', 'monthly', 'credit', 'other'];
const SOURCES = ['statusline', 'codex-session', 'driven', 'openrouter', 'report'];
const MAX_METERS = 40, MAX_WINDOWS = 8;
const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
// How long a reading stays believable, by the kind of window it describes.
const FRESH_MS = { session: 30 * MIN, weekly: 6 * HOUR, monthly: DAY, credit: 6 * HOUR, other: 6 * HOUR };
const FORGET_MS = 9 * DAY;
const THRESHOLDS = [75, 90, 100];               // worth a line in the activity feed, once each per window period
const LABELS = { claude: 'Claude · Anthropic', codex: 'Codex · OpenAI', gemini: 'Gemini · Google', opencode: 'opencode', openrouter: 'OpenRouter' };
const SOURCE_NAMES = { statusline: 'Claude Code status line', 'codex-session': 'Codex session files', driven: 'the session itself',
  openrouter: 'OpenRouter key', report: 'reported' };
const KIND_LABEL = { session: 'Session', weekly: 'Week', monthly: 'Month', credit: 'Credit', other: 'Limit' };

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const slug = (v, max = 32) => clean(v, max).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null));
// An account label must not turn the feed into a list of e-mail addresses.
const maskAccount = (v) => clean(v, 40).replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+)/g, '$1…@$2');

/** "usage of what": the office's provider words, plus the gateways that are not runtimes. */
export function usageProvider(value) {
  const v = clean(value, 40).toLowerCase();
  if (!v) return '';
  if (/openrouter/.test(v)) return 'openrouter';
  const known = normalizeProvider(v);
  return known && known !== 'custom' ? known : slug(v, 24);
}

/** Epoch milliseconds from seconds, milliseconds or an ISO string — or null. */
export function toMillis(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = num(value);
  if (n !== null) return n <= 0 ? null : n < 1e11 ? Math.round(n * 1000) : Math.round(n);
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? t : null;
}

function money(v, unit) {
  if (unit === 'usd') return '$' + (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
  return `${Math.round(v * 100) / 100}${unit ? ' ' + unit : ''}`;
}

/** One window out of whatever a reporter sent. → window | null */
function cleanWindow(raw, now) {
  if (!raw || typeof raw !== 'object') return null;
  let kind = KINDS.includes(raw.kind) ? raw.kind : null;
  const mins = num(raw.windowMins ?? raw.windowDurationMins ?? raw.window_minutes);
  if (!kind && mins) kind = mins >= 28 * 24 * 60 ? 'monthly' : mins >= 6 * 24 * 60 ? 'weekly' : 'session';
  kind = kind || 'other';
  let used = num(raw.usedPercent ?? raw.used_percent ?? raw.used_percentage);
  const remaining = num(raw.remainingPercent ?? raw.remaining_percent);
  if (used === null && remaining !== null) used = 100 - remaining;
  let detail = clean(raw.detail, 60);
  const amount = num(raw.used), limit = num(raw.limit);
  if (limit !== null && limit > 0 && amount !== null && amount >= 0) {
    if (used === null) used = (amount / limit) * 100;
    if (!detail) detail = `${money(Math.max(0, limit - amount), clean(raw.unit, 12).toLowerCase())} of ${money(limit, clean(raw.unit, 12).toLowerCase())} left`;
  }
  if (used === null) return null;
  let resetsAt = toMillis(raw.resetsAt ?? raw.resets_at);
  const resetsIn = num(raw.resetsInSeconds ?? raw.resets_in_seconds);
  if (!resetsAt && resetsIn !== null && resetsIn > 0) resetsAt = now + resetsIn * 1000;
  const id = slug(raw.id) || kind;
  return {
    id, kind, label: clean(raw.label, 40) || KIND_LABEL[kind],
    usedPercent: Math.round(clamp(used, 0, 100) * 10) / 10,
    resetsAt: resetsAt && resetsAt > now - 400 * DAY && resetsAt < now + 400 * DAY ? resetsAt : null,
    windowMins: mins && mins > 0 ? Math.round(mins) : null,
    detail: detail || null,
    models: Array.isArray(raw.models) ? raw.models.slice(0, 6).map((m) => clean(m, 40)).filter(Boolean) : null,
  };
}

function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s} s ago`;
  if (s < 90 * 60) return `${Math.round(s / 60)} min ago`;
  if (s < 36 * 3600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
function until(ms) {
  const m = Math.max(1, Math.round(ms / MIN));
  if (m < 90) return `in ${m} min`;
  if (m < 36 * 60) { const h = Math.floor(m / 60), r = m % 60; return r >= 5 && h < 6 ? `in ${h} h ${r} min` : `in ${Math.round(m / 60)} h`; }
  return `in ${Math.round(m / (24 * 60))} d`;
}

export function createUsage(ctx, file) {
  const { cfg, bus, log } = ctx;
  const store = new JsonFile(file, {
    defaults: () => ({ v: 1, meters: {} }), debounceMs: 800,
    validate: (d) => d && typeof d.meters === 'object' && d.meters !== null && !Array.isArray(d.meters),
  });
  const meters = store.data.meters;                 // id -> { id, provider, account, plan, source, via, checkedAt, windows: { [id]: window }, note, alerted: {} }
  for (const [id, m] of Object.entries(meters)) {
    if (!m || typeof m !== 'object' || Date.now() - (m.checkedAt || 0) > FORGET_MS) delete meters[id];
  }

  /* ---- taking a reading in ------------------------------------------------ */

  function report(body, opt = {}) {
    const now = Date.now();
    if (!body || typeof body !== 'object') return { error: 'a report is an object: { provider, windows: [{ kind, usedPercent, resetsAt? }] }', status: 400 };
    const provider = usageProvider(body.provider);
    if (!provider) return { error: 'provider required (claude, codex, gemini, openrouter, …)', status: 400 };
    const account = maskAccount(body.account);
    const id = account ? `${provider}:${slug(account, 24)}` : provider;
    const windows = (Array.isArray(body.windows) ? body.windows : []).slice(0, MAX_WINDOWS).map((w) => cleanWindow(w, now)).filter(Boolean);
    const note = clean(body.note, 140);
    if (!windows.length && !note) return { error: 'nothing to record: give at least one window with usedPercent (or used + limit), or a note', status: 400 };
    let meter = meters[id];
    const isNew = !meter;
    // A reading knows when it was taken (a line in a session file may be hours old); an older one never replaces a newer one.
    const taken = toMillis(body.checkedAt);
    const at = taken && taken <= now ? taken : now;
    if (meter && at < meter.checkedAt - 1000) return { ok: true, ignored: 'an older reading than the one on file', meter: view(meter, now) };
    if (!meter) {
      if (Object.keys(meters).length >= MAX_METERS) return { error: 'too many meters; DELETE /api/usage/<id> one first', status: 409 };
      meter = meters[id] = { id, provider, account: account || null, plan: null, source: 'report', via: null, checkedAt: now, windows: {}, note: null, alerted: {} };
    }
    const source = SOURCES.includes(body.source) ? body.source : (opt.source || 'report');
    // A full reading replaces the lot; a partial one (a single window from a stream) only touches what it names.
    if (body.replace === true) meter.windows = {};
    for (const w of windows) {
      const before = meter.windows[w.id];
      // a new period began: its thresholds may be announced again
      if (before && ((w.resetsAt && before.resetsAt && w.resetsAt > before.resetsAt + 10 * MIN) || w.usedPercent < before.usedPercent - 25)) delete meter.alerted[w.id];
      meter.windows[w.id] = w;
    }
    meter.source = source;
    if (body.plan !== undefined) meter.plan = clean(body.plan, 24) || null;
    if (note || body.note === '') meter.note = note || null;
    const agent = opt.agent || (body.agentId || body.agent ? ctx.agents.resolveRef(body.agentId || body.agent) : null);
    meter.via = agent ? agent.id : (meter.via || null);
    meter.checkedAt = at;
    announce(meter, now, isNew);
    changed();
    return { ok: true, meter: view(meter, now) };
  }

  function forget(id) {
    if (!meters[id]) return { error: `no meter called "${id}"`, status: 404 };
    delete meters[id];
    changed();
    return { ok: true };
  }

  /* ---- reading it back ---------------------------------------------------- */

  function windowView(meter, w, now) {
    const age = now - meter.checkedAt;
    // the window has rolled over since anybody looked: whatever was used then is gone
    const span = w.windowMins ? w.windowMins * MIN : (w.kind === 'session' ? 5 * HOUR : null);
    const lapsed = (w.resetsAt !== null && now >= w.resetsAt) || (w.resetsAt === null && span !== null && age > span);
    const stale = !lapsed && age > (FRESH_MS[w.kind] || FRESH_MS.other);
    return { ...w, left: lapsed ? 100 : Math.round((100 - w.usedPercent) * 10) / 10, lapsed, stale };
  }

  function view(meter, now = Date.now()) {
    const windows = Object.values(meter.windows).map((w) => windowView(meter, w, now))
      .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.id.localeCompare(b.id));
    const tight = windows.length ? windows.reduce((a, b) => (b.left < a.left ? b : a)) : null;
    const left = tight ? tight.left : null;
    const level = left === null ? 'unknown' : left <= 1 ? 'out' : left <= 12 ? 'critical' : left <= 35 ? 'low' : 'ok';
    const name = LABELS[meter.provider] || meter.provider.replace(/(^|-)([a-z])/g, (_, sep, ch) => (sep ? ' ' : '') + ch.toUpperCase());
    return {
      id: meter.id, provider: meter.provider, label: name + (meter.account ? ` (${meter.account})` : ''),
      account: meter.account, plan: meter.plan, source: meter.source, sourceName: SOURCE_NAMES[meter.source] || meter.source,
      via: meter.via, checkedAt: meter.checkedAt, ageMs: now - meter.checkedAt,
      windows, left, tight: tight ? tight.id : null, level,
      // every number here is a guess once all of it is old
      stale: windows.length > 0 && windows.every((w) => w.stale),
      note: meter.note,
      agents: ctx.agents.list().filter((a) => ctx.agents.isPresent(a) && usageProvider(a.provider) === meter.provider).map((a) => a.id),
    };
  }

  /** Who has room. → { prefer, low, out, text } — `prefer` is null unless the difference is worth acting on. */
  function advice(now = Date.now(), views = null) {
    const known = (views || Object.values(meters).map((m) => view(m, now))).filter((v) => v.left !== null && !v.stale);
    // one entry per provider: whichever of its accounts has the most room
    const byProvider = new Map();
    for (const v of known) { const cur = byProvider.get(v.provider); if (!cur || v.left > cur.left) byProvider.set(v.provider, v); }
    const ranked = [...byProvider.values()].sort((a, b) => b.left - a.left);
    const low = ranked.filter((v) => v.left <= 15 && v.left > 1).map((v) => v.provider);
    const out = ranked.filter((v) => v.left <= 1).map((v) => v.provider);
    // "Prefer" compares allowances with allowances. A prepaid balance is money: whether to spend it is a person's call,
    // so a credit meter can be flagged as low but is never the thing the office steers work towards.
    const plans = ranked.filter((v) => v.windows.find((w) => w.id === v.tight)?.kind !== 'credit');
    const best = plans[0], worst = plans[plans.length - 1];
    const prefer = plans.length >= 2 && best.left >= 25 && best.left - worst.left >= 15 ? best.provider : null;
    const name = (p) => (LABELS[p] || p).split(' · ')[0];
    const parts = [];
    if (prefer) parts.push(`Prefer ${name(prefer)} for new work.`);
    if (out.length) parts.push(`${out.map(name).join(' and ')} ${out.length > 1 ? 'are' : 'is'} spent for now.`);
    if (low.length) parts.push(`Go easy on ${low.map(name).join(' and ')}.`);
    return { prefer, low, out, text: parts.join(' ') };
  }

  function windowText(w, now) {
    const what = w.detail || `${Math.round(w.left)}% left`;
    const reset = w.lapsed ? 'reset since the last reading' : w.resetsAt ? `resets ${until(w.resetsAt - now)}` : '';
    return `${w.label.toLowerCase()}: ${what}${reset ? `, ${reset}` : ''}`;
  }

  function text(now = Date.now(), views = null) {
    const list = [...(views || Object.values(meters).map((m) => view(m, now)))].sort((a, b) => (b.left ?? -1) - (a.left ?? -1));
    if (!list.length) {
      return ['Nobody has told the office how much is left on any provider yet.',
        'It learns from: the Claude Code status line (node install-statusline.mjs), Codex session files (automatic while Codex is observed),',
        'sessions the office drives, and anything that posts to /api/usage/report.'].join('\n');
    }
    const lines = ['How much is left:'];
    for (const v of list) {
      const flag = v.stale ? '   (old reading)' : v.level === 'out' ? '   ← spent' : v.level === 'critical' ? '   ← nearly spent' : v.level === 'low' ? '   ← running low' : '';
      const body = v.windows.length ? v.windows.map((w) => windowText(w, now)).join(' · ') : (v.note || 'no figures');
      lines.push(`  ${v.label}${v.plan ? ` [${v.plan}]` : ''} — ${body}${flag}`);
    }
    const a = advice(now, list);
    if (a.text) lines.push(a.text);
    lines.push('Read from: ' + list.map((v) => `${v.sourceName} (${ago(v.ageMs)})`).filter((s, i, all) => all.indexOf(s) === i).join(' · ') + '.');
    return lines.join('\n');
  }

  function snapshot() {
    const now = Date.now();
    const list = Object.values(meters).map((m) => view(m, now)).sort((a, b) => a.label.localeCompare(b.label));
    return { generatedAt: now, meters: list, advice: advice(now, list), text: text(now, list),
      sources: { openrouter: !!cfg.usage?.openRouterKey } };
  }

  /* ---- telling people ----------------------------------------------------- */

  let timer = null, lastSent = '';
  function changed() { store.save(); schedule(); }
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const snap = snapshot();
      // ages tick by themselves; only a real change is worth a broadcast
      const key = JSON.stringify(snap.meters.map((m) => [m.id, m.plan, m.source, m.level, m.stale, m.note, m.windows.map((w) => [w.id, w.usedPercent, w.resetsAt, w.lapsed, w.stale, w.detail])]));
      if (key === lastSent) return;
      lastSent = key;
      bus.broadcast({ type: EV.USAGE, usage: snap });
    }, 400);
    if (typeof timer.unref === 'function') timer.unref();
  }

  /** A line in the activity feed when a window crosses 75, 90 or 100 % — once each per period. */
  function announce(meter, now, quiet) {
    const v = view(meter, now);
    for (const w of v.windows) {
      if (w.lapsed) continue;
      const crossed = THRESHOLDS.filter((t) => w.usedPercent >= t).pop();
      if (!crossed || (meter.alerted[w.id] || 0) >= crossed) continue;
      meter.alerted[w.id] = crossed;
      // The very first reading of a meter is news to the office's memory, not to the people in it.
      if (quiet) continue;
      const what = w.kind === 'credit' ? 'credit' : `${w.label.toLowerCase()} allowance`;
      const line = crossed >= 100 ? `${v.label}: the ${what} is spent` : `${v.label}: the ${what} is ${Math.round(w.usedPercent)}% used`;
      try { ctx.activity?.log('usage', line + (w.resetsAt ? ` (resets ${until(w.resetsAt - now)})` : ''), { provider: meter.provider, meterId: meter.id, window: w.id, usedPercent: w.usedPercent }); }
      catch (err) { log.warn('[usage] could not log: ' + (err?.message || err)); }
    }
  }

  bus.on('usage:report', (event) => {
    const agent = event.report?.agentId ? ctx.agents.get(event.report.agentId) : null;
    const r = report(event.report, { source: 'driven', agent });
    if (r.error) log.warn('[usage] dropped a report from a driven session: ' + r.error);
  });
  // Windows roll over and readings age without anybody posting: look again now and then.
  const tick = setInterval(schedule, 5 * MIN);
  tick.unref();

  /* ---- OpenRouter, when asked to ------------------------------------------- */

  let polling = null, pollTimer = null;
  async function pollOpenRouter() {
    const key = cfg.usage?.openRouterKey;
    if (!key) return { skipped: true };
    if (polling) return polling;
    polling = (async () => {
      const ask = async (url) => {
        const res = await fetch(url, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json())?.data || {};
      };
      try {
        const d = await ask(cfg.usage.openRouterUrl);
        const windows = [];
        const limit = num(d.limit), remaining = num(d.limit_remaining);
        if (limit !== null && limit > 0 && remaining !== null) {
          windows.push({ id: 'key', kind: 'credit', label: d.limit_reset ? `Key limit (${clean(d.limit_reset, 12)})` : 'Key limit', used: Math.max(0, limit - remaining), limit, unit: 'usd' });
        }
        const free = d.free_model_daily_requests;
        if (free && num(free.limit) > 0 && num(free.used) !== null) {
          windows.push({ id: 'free', kind: 'session', label: 'Free models today', usedPercent: (num(free.used) / num(free.limit)) * 100,
            detail: `${Math.max(0, num(free.limit) - num(free.used))} of ${num(free.limit)} requests left` });
        }
        // The account's own balance, where this key may read it.
        try {
          const c = await ask(cfg.usage.openRouterUrl.replace(/\/key$/, '/credits'));
          const total = num(c.total_credits), spent = num(c.total_usage);
          if (total !== null && total > 0 && spent !== null) windows.push({ id: 'credits', kind: 'credit', label: 'Credits', used: Math.min(total, spent), limit: total, unit: 'usd' });
        } catch { /* not every key may read the balance */ }
        const month = num(d.usage_monthly);
        return report({ provider: 'openrouter', source: 'openrouter', replace: true, windows,
          note: windows.length ? '' : (month !== null ? `${money(month, 'usd')} used this month; this key has no limit to measure against` : 'this key has no limit to measure against') });
      } catch (err) {
        log.warn('[usage] OpenRouter did not answer: ' + (err?.message || err));
        return { error: 'OpenRouter did not answer', status: 502 };
      } finally { polling = null; }
    })();
    return polling;
  }

  return {
    report, forget, snapshot, advice: () => advice(), text: () => text(), view,
    refresh: pollOpenRouter,
    start() {
      if (!cfg.usage?.openRouterKey) return;
      pollOpenRouter();
      pollTimer = setInterval(pollOpenRouter, Math.max(MIN, cfg.usage.openRouterEveryMs || 5 * MIN));
      pollTimer.unref();
    },
    stop() { clearInterval(tick); if (pollTimer) clearInterval(pollTimer); if (timer) clearTimeout(timer); },
  };
}

export function registerUsageRoutes(router, ctx) {
  const { usage } = ctx;
  router.get('/api/usage', () => usage.snapshot(),
    { about: 'How much is left on each provider: meters with windows (used %, reset time), where each reading came from and how old it is, and which provider to prefer.' });
  router.post('/api/usage/report', async (c) => c.result(usage.report(await c.json())),
    { about: 'Tell the office what a provider has left: {provider, plan?, account?, windows:[{kind:"session"|"weekly"|"monthly"|"credit", usedPercent | used+limit+unit, resetsAt?, label?}], agent?}.' });
  router.post('/api/usage/refresh', async () => { await usage.refresh(); return usage.snapshot(); },
    { about: 'Ask again where the office can ask (OpenRouter, when enabled), then return the snapshot.' });
  router.delete('/api/usage/:id', (c) => {
    const r = usage.forget(c.params.id);
    if (r.error) throw new HttpError(r.status, r.error);
    return r;
  }, { about: 'Forget a meter.' });
}
