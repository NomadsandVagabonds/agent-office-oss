// How much is left: readings come in from several places, age honestly, and
// turn into advice an agent can act on.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startOffice, sleep } from './helpers.mjs';
import { toMillis, usageProvider } from '../server/usage.mjs';

const HOUR = 3600 * 1000;

test('usage: a reading becomes a meter, with what is left and when it resets', async (t) => {
  const office = await startOffice();
  t.after(() => office.stop());
  const empty = await office.get('/api/usage');
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.data.meters, []);
  assert.match(empty.data.text, /Nobody has told the office/);

  const resets = Math.round((Date.now() + 2 * HOUR) / 1000);            // providers speak in epoch seconds
  const r = await office.post('/api/usage/report', { provider: 'Anthropic', plan: 'max', source: 'statusline', windows: [
    { id: 'five_hour', kind: 'session', usedPercent: 23.5, resetsAt: resets },
    { id: 'seven_day', kind: 'weekly', used_percentage: 88, resets_at: resets + 3 * 24 * 3600 },
  ] });
  assert.equal(r.status, 200);
  assert.equal(r.data.meter.provider, 'claude', 'the office uses its own provider words');
  assert.equal(r.data.meter.left, 12, 'the tightest window decides');
  assert.equal(r.data.meter.tight, 'seven-day');
  assert.equal(r.data.meter.level, 'critical');
  assert.equal(r.data.meter.sourceName, 'Claude Code status line');
  const session = r.data.meter.windows.find((w) => w.kind === 'session');
  assert.equal(session.left, 76.5);
  assert.ok(Math.abs(session.resetsAt - resets * 1000) < 1000);

  await office.post('/api/usage/report', { provider: 'codex', plan: 'pro', windows: [
    { id: 'primary', windowMins: 300, usedPercent: 18, resetsInSeconds: 4000 }, { id: 'secondary', windowMins: 10080, remainingPercent: 64 } ] });
  const snap = (await office.get('/api/usage')).data;
  assert.equal(snap.meters.length, 2);
  assert.equal(snap.advice.prefer, 'codex');
  assert.deepEqual(snap.advice.low, ['claude']);
  assert.match(snap.text, /Codex · OpenAI \[pro\] — session: 82% left, resets in \d+ min · week: 64% left/);
  assert.match(snap.text, /Claude · Anthropic \[max\].*nearly spent/);
  assert.match(snap.text, /Prefer Codex for new work\. Go easy on Claude\./);
  assert.match(snap.text, /Read from: .*Claude Code status line/);
  assert.deepEqual(snap.meters.map((m) => m.provider), ['claude', 'codex'], 'the list keeps a steady order, whatever the levels are');

  // a prepaid balance is money, not an allowance: it can run low, but the office never steers work towards spending it
  await office.post('/api/usage/report', { provider: 'openrouter', windows: [{ kind: 'credit', used: 1, limit: 100, unit: 'usd' }] });
  const withMoney = (await office.get('/api/usage')).data;
  assert.equal(withMoney.advice.prefer, 'codex');
  assert.doesNotMatch(withMoney.advice.text, /OpenRouter/);
});

test('usage: partial readings merge, money becomes a percentage, nonsense is refused', async (t) => {
  const office = await startOffice();
  t.after(() => office.stop());
  await office.post('/api/usage/report', { provider: 'claude', windows: [{ id: 'five_hour', kind: 'session', usedPercent: 10 }, { id: 'seven_day', kind: 'weekly', usedPercent: 40 }] });
  // a stream that only knows about one window must not wipe the other
  const merged = await office.post('/api/usage/report', { provider: 'claude', windows: [{ id: 'five_hour', kind: 'session', usedPercent: 55 }] });
  assert.deepEqual(merged.data.meter.windows.map((w) => [w.id, w.usedPercent]), [['five-hour', 55], ['seven-day', 40]]);
  // …while a full probe replaces the lot
  const full = await office.post('/api/usage/report', { provider: 'claude', replace: true, windows: [{ id: 'five_hour', kind: 'session', usedPercent: 60 }] });
  assert.equal(full.data.meter.windows.length, 1);

  const money = await office.post('/api/usage/report', { provider: 'OpenRouter', account: 'someone@example.com', windows: [{ kind: 'credit', used: 12.4, limit: 50, unit: 'usd' }] });
  assert.equal(money.data.meter.windows[0].usedPercent, 24.8);
  assert.equal(money.data.meter.windows[0].detail, '$37.60 of $50.00 left');
  assert.doesNotMatch(JSON.stringify(money.data), /someone@example\.com/, 'an account label is not a place for a whole address');

  assert.equal((await office.post('/api/usage/report', { windows: [{ usedPercent: 5 }] })).status, 400);
  assert.equal((await office.post('/api/usage/report', { provider: 'claude', windows: [{ kind: 'session' }] })).status, 400);
  const wild = await office.post('/api/usage/report', { provider: 'gemini', windows: [{ kind: 'session', usedPercent: 250 }] });
  assert.equal(wild.data.meter.windows[0].usedPercent, 100);

  assert.equal((await office.del('/api/usage/gemini')).status, 200);
  assert.equal((await office.del('/api/usage/gemini')).status, 404);
});

test('usage: an old reading is old, and a window that has rolled over is not reported as used', async (t) => {
  const office = await startOffice();
  t.after(() => office.stop());
  const { usage } = office.ctx;
  usage.report({ provider: 'claude', windows: [{ id: 'five_hour', kind: 'session', usedPercent: 97, resetsAt: Date.now() + 1500 }] });
  assert.equal(usage.snapshot().meters[0].level, 'critical');
  await sleep(1700);
  const after = usage.snapshot().meters[0];
  assert.equal(after.windows[0].lapsed, true);
  assert.equal(after.left, 100);
  assert.match(usage.text(), /reset since the last reading/);

  // nothing fresh to go on: no advice is better than confident advice
  usage.report({ provider: 'codex', windows: [{ kind: 'weekly', usedPercent: 5 }] });
  const stale = usage.view({ id: 'x', provider: 'gemini', account: null, plan: null, source: 'report', via: null, checkedAt: Date.now() - 9 * HOUR, note: null,
    windows: { weekly: { id: 'weekly', kind: 'weekly', label: 'Week', usedPercent: 99, resetsAt: null, windowMins: null, detail: null, models: null } } });
  assert.equal(stale.stale, true);
});

test('usage: the bus carries it — a driven session reports, clients hear, the feed notes a threshold once', async (t) => {
  const office = await startOffice();
  t.after(() => office.stop());
  const seen = [];
  const ws = new WebSocket(`ws://127.0.0.1:${office.port}`);
  ws.addEventListener('message', (e) => { try { seen.push(JSON.parse(e.data)); } catch { /* not ours */ } });
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  t.after(() => ws.close());
  const until = async (fn, ms = 2500) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(25); } return fn(); };
  assert.ok(await until(() => seen.find((m) => m.type === 'usage')), 'a new client is told what is known');

  office.ctx.bus.local({ type: 'usage:report', report: { provider: 'codex', plan: 'plus', windows: [{ id: 'primary', kind: 'session', usedPercent: 40, resetsAt: Date.now() + HOUR }] } });
  const pushed = await until(() => seen.find((m) => m.type === 'usage' && m.usage.meters.some((x) => x.provider === 'codex')));
  assert.equal(pushed.usage.meters[0].source, 'driven');

  office.ctx.usage.report({ provider: 'codex', windows: [{ id: 'primary', kind: 'session', usedPercent: 91, resetsAt: Date.now() + HOUR }] });
  office.ctx.usage.report({ provider: 'codex', windows: [{ id: 'primary', kind: 'session', usedPercent: 93, resetsAt: Date.now() + HOUR }] });
  await sleep(150);
  const lines = office.ctx.activity.recent(20).filter((i) => i.kind === 'usage');
  assert.equal(lines.length, 1, 'crossing 90% is said once');
  assert.match(lines[0].text, /Codex · OpenAI: the session allowance is 91% used \(resets in \d+ min\)/);
});

test('usage: OpenRouter is only asked when the operator says so, and its answer becomes a meter', async (t) => {
  let asked = 0, auth = '';
  const fake = http.createServer((req, res) => {
    asked += 1; auth = req.headers.authorization || '';
    res.setHeader('content-type', 'application/json');
    if (req.url.endsWith('/key')) return res.end(JSON.stringify({ data: { label: 'k', limit: 50, limit_remaining: 37.6, limit_reset: 'monthly', usage: 12.4, usage_monthly: 12.4, is_free_tier: false } }));
    if (req.url.endsWith('/credits')) return res.end(JSON.stringify({ data: { total_credits: 100, total_usage: 62.5 } }));
    res.statusCode = 404; res.end('{}');
  });
  await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
  t.after(() => fake.close());
  const url = `http://127.0.0.1:${fake.address().port}/api/v1/key`;

  const quiet = await startOffice({ env: { OPENROUTER_API_KEY: 'sk-test-not-a-real-key', OFFICE_USAGE_OPENROUTER_URL: url } });
  t.after(() => quiet.stop());
  await quiet.post('/api/usage/refresh');
  assert.equal(asked, 0, 'a key in the environment is not permission to use it');

  const office = await startOffice({ env: { OPENROUTER_API_KEY: 'sk-test-not-a-real-key', OFFICE_USAGE_OPENROUTER: '1', OFFICE_USAGE_OPENROUTER_URL: url } });
  t.after(() => office.stop());
  const snap = (await office.post('/api/usage/refresh')).data;
  assert.ok(asked >= 2);
  assert.equal(auth, 'Bearer sk-test-not-a-real-key');
  const meter = snap.meters.find((m) => m.provider === 'openrouter');
  assert.deepEqual(meter.windows.map((w) => [w.id, w.usedPercent, w.detail]), [['credits', 62.5, '$37.50 of $100 left'], ['key', 24.8, '$37.60 of $50.00 left']]);
  assert.doesNotMatch(JSON.stringify(snap) + JSON.stringify((await office.get('/api')).data), /sk-test-not-a-real-key/, 'the key never comes back out');
});

test('usage: small helpers', () => {
  assert.equal(usageProvider('OpenAI'), 'codex');
  assert.equal(usageProvider('anthropic'), 'claude');
  assert.equal(usageProvider('OpenRouter (work)'), 'openrouter');
  assert.equal(usageProvider('Mistral Large'), 'mistral-large');
  assert.equal(toMillis(1738425600), 1738425600000);
  assert.equal(toMillis(1738425600000), 1738425600000);
  assert.equal(toMillis('2026-01-02T03:04:05Z'), Date.parse('2026-01-02T03:04:05Z'));
  assert.equal(toMillis(0), null);
});

/* ---- where readings come from ------------------------------------------------ */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, tempDir } from './helpers.mjs';
import { claudeStatusLineToReport, codexRateLimitsToReport } from '../server/usage-sources.mjs';

test('usage: Claude Code status-line data and Codex snapshots both become reports', () => {
  const claude = claudeStatusLineToReport({ rate_limits: {
    five_hour: { used_percentage: 23.5, resets_at: 1738425600 }, seven_day: { used_percentage: 41.2, resets_at: 1738857600 },
    spend_limit: { used_percentage: 62.8, resets_at: 1740787200, used_usd: 31.4, limit_usd: 50, period: 'monthly' } } });
  assert.deepEqual(claude.windows.map((w) => [w.id, w.kind, w.usedPercent]), [['five_hour', 'session', 23.5], ['seven_day', 'weekly', 41.2], ['spend_limit', 'credit', 62.8]]);
  assert.equal(claude.windows[2].label, 'Spend limit (monthly)');
  assert.equal(claudeStatusLineToReport({ model: { display_name: 'X' } }), null, 'no limits in the data: nothing to report');

  const at = Date.parse('2026-03-01T10:00:00Z');
  // the two shapes Codex has written: seconds-from-now, and an absolute time
  const older = codexRateLimitsToReport({ primary: { used_percent: 12, window_minutes: 299, resets_in_seconds: 600 }, secondary: { used_percent: 30, window_minutes: 10079, resets_in_seconds: 86400 } }, at);
  assert.deepEqual(older.windows.map((w) => [w.id, w.kind, w.usedPercent, w.resetsAt]), [['primary', 'session', 12, at + 600000], ['secondary', 'weekly', 30, at + 86400000]]);
  const newer = codexRateLimitsToReport({ limitId: 'codex', planType: 'pro', primary: { usedPercent: 50, windowDurationMins: 300, resetsAt: 1772360000 }, secondary: null }, at);
  assert.equal(newer.plan, 'pro');
  assert.deepEqual(newer.windows.map((w) => [w.kind, w.resetsAt]), [['session', 1772360000]]);
  assert.equal(codexRateLimitsToReport({ plan_type: 'free', primary: { used_percent: 9 } }, at).windows[0].kind, 'monthly', 'free plans meter by the month');
  assert.equal(codexRateLimitsToReport({ limit_id: 'some-model', primary: { used_percent: 9 } }, at), null, 'a model-specific quota is not the main allowance');
});

test('usage: the status-line bridge prints a line and tells the office, and an older reading never overwrites a newer one', async (t) => {
  const office = await startOffice();
  t.after(() => office.stop());
  const bridge = path.join(ROOT, 'hooks', 'office-statusline.mjs');
  const input = { session_id: 's1', model: { display_name: 'Fable' }, workspace: { current_dir: '/tmp/proj/atlas' }, context_window: { used_percentage: 42 },
    rate_limits: { five_hour: { used_percentage: 23.5, resets_at: Math.round(Date.now() / 1000) + 3600 }, seven_day: { used_percentage: 95, resets_at: Math.round(Date.now() / 1000) + 86400 } } };
  const env = { ...process.env, OFFICE_PORT: String(office.port), TMPDIR: tempDir('office-sl-') };
  const run = spawnSync(process.execPath, [bridge], { input: JSON.stringify(input), env, encoding: 'utf8', timeout: 5000 });
  assert.equal(run.status, 0);
  assert.match(run.stdout, /^Fable · atlas · ctx 42% · 5h 77% left · \u001b\[31mweek 5% left\u001b\[0m\n$/);
  const meter = (await office.get('/api/usage')).data.meters[0];
  assert.equal(meter.source, 'statusline');
  assert.equal(meter.left, 5);

  // your own status line keeps showing
  const mine = spawnSync(process.execPath, [bridge], { input: JSON.stringify(input), env: { ...env, OFFICE_STATUSLINE_CMD: 'printf "mine: %s" "$(cat | wc -c)"' }, encoding: 'utf8', timeout: 5000 });
  assert.match(mine.stdout, /^mine: \d+\n$/);
  // garbage in: still a clean exit and a line
  assert.equal(spawnSync(process.execPath, [bridge], { input: 'not json', env, encoding: 'utf8', timeout: 5000 }).status, 0);

  const old = await office.post('/api/usage/report', { provider: 'claude', checkedAt: Date.now() - 3600 * 1000, windows: [{ id: 'seven_day', kind: 'weekly', usedPercent: 10 }] });
  assert.match(old.data.ignored, /older reading/);
  assert.equal(old.data.meter.left, 5);
});

test('usage: installing the status line keeps what was there, and uninstalling gives it back', () => {
  const dir = tempDir('office-settings-');
  const file = path.join(dir, 'settings.json');
  const run = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'install-statusline.mjs'), ...args], { env: { ...process.env, OFFICE_CLAUDE_SETTINGS: file }, encoding: 'utf8' });
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));

  assert.equal(run().status, 0);                                   // nothing there yet
  assert.match(read().statusLine.command, /^node '.*office-statusline\.mjs'$/);
  assert.equal(run('--uninstall').status, 0);
  assert.equal(read().statusLine, undefined);

  const theirs = { type: 'command', command: `jq -r '"[\\(.model.display_name)] it's mine"'`, padding: 2 };
  fs.writeFileSync(file, JSON.stringify({ model: 'x', hooks: { Stop: [] }, statusLine: theirs }));
  assert.equal(run('--refresh', '30').status, 0);
  assert.equal(run('--refresh', '30').status, 0);                   // twice: still one layer of wrapping
  const wrapped = read();
  assert.equal(wrapped.model, 'x');
  assert.deepEqual(wrapped.hooks, { Stop: [] });
  assert.equal(wrapped.statusLine.padding, 2);
  assert.equal(wrapped.statusLine.refreshInterval, 30);
  assert.ok(wrapped.statusLine.command.startsWith('OFFICE_STATUSLINE_CMD='));
  assert.equal(wrapped.statusLine.command.split('office-statusline.mjs').length, 2);
  assert.equal(run('--uninstall').status, 0);
  assert.equal(read().statusLine.command, theirs.command, 'quotes and all');
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('settings.json.bak.')), 'and there is a backup');
});
