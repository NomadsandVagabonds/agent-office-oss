// Driven sessions over Codex's own app-server protocol, against the fake in
// test/fixtures (JSON lines without "jsonrpc", threads, turns with ids, items,
// approvals as server requests). The shapes come from the schema T3 Code
// generates from Codex; nothing here has met a real `codex` binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarnessOffice, waitFor, sleep } from './fixtures/harness-helpers.mjs';
import { codexLimits, CODEX_MODES } from '../server/harness/codex.mjs';

test('driven sessions: Codex app-server', async (t) => {
  const h = await startHarnessOffice();
  t.after(() => h.stop());

  await t.test('a thread starts with the mode\'s native policy and the office tools', async () => {
    const s = await h.start('fake-codex', { name: 'Cody', model: 'gpt-test' });
    assert.equal(s.protocol, 'codex-app-server');
    assert.equal(s.nativeRef, 'thr_fake_1');
    assert.equal(s.provider, 'codex');
    assert.equal(s.model, 'gpt-test');
    assert.equal(s.features.nativeSandbox, true);
    assert.equal(s.features.officeTools, true);
    const a = await h.agent(s.id);
    assert.equal(a.runtime.transport, 'codex-app-server');
    assert.equal(a.runtime.caps.control, true);

    const told = JSON.parse((await h.turn(s.id, 'report')).said);
    assert.equal(told.clientInfo.name, 'the-office');
    assert.deepEqual(told.optOut, ['turn/diff/updated']);
    assert.equal(told.initialized, true, 'initialize is followed by the initialized notification');
    assert.deepEqual(told.thread, { cwd: h.work, model: 'gpt-test', approvalPolicy: 'untrusted', sandbox: 'read-only', configKeys: ['mcp_servers.office'] });
    assert.deepEqual(told.office, { url: true, agentId: s.id, token: true });
    assert.equal(told.framed, 1);

    // Codex enforces its sandbox itself, so the mode is fixed when the thread starts.
    const refused = await h.patch(`/api/harness/sessions/${s.id}`, { mode: 'full' });
    assert.equal(refused.status, 409);
    assert.match(refused.data.error, /sandbox is set when it starts/);
    assert.equal((await h.patch(`/api/harness/sessions/${s.id}`, { wake: 'direct' })).data.session.wake, 'direct');
    await h.del(`/api/harness/sessions/${s.id}`);

    for (const mode of ['edits', 'full']) {
      const m = await h.start('fake-codex', { mode });
      const thread = JSON.parse((await h.turn(m.id, 'report')).said).thread;
      assert.equal(thread.approvalPolicy, CODEX_MODES[mode].approvalPolicy);
      assert.equal(thread.sandbox, CODEX_MODES[mode].sandbox);
      await h.del(`/api/harness/sessions/${m.id}`);
    }
    assert.deepEqual(CODEX_MODES.ask, { approvalPolicy: 'untrusted', sandbox: 'read-only' });
    assert.deepEqual(CODEX_MODES.full, { approvalPolicy: 'never', sandbox: 'danger-full-access' });
  });

  await t.test('a turn streams: replies, reasoning, a command, a patch, a plan, context use', async () => {
    const s = await h.start('fake-codex', { name: 'Stream' });
    const files = [];
    const onFile = (e) => files.push(e);
    h.ctx.bus.on('agent:file', onFile);
    const r = await h.turn(s.id, 'say:hello; say:again; think:hmm; tool:ls -la; edit:src/a.js; plan:one|two; usage:5000/100000; say:done');
    h.ctx.bus.off('agent:file', onFile);
    assert.equal(r.turn.state, 'completed');
    // Each agent message is its own item, even back to back.
    assert.deepEqual(r.entries.filter((e) => e.kind === 'message').map((e) => e.text), ['hello', 'again', 'done']);
    assert.equal(r.entries.find((e) => e.kind === 'thought').text, 'hmm');
    const [cmd, patch] = r.entries.filter((e) => e.kind === 'tool');
    assert.deepEqual([cmd.toolKind, cmd.command, cmd.status, cmd.exitCode], ['execute', 'ls -la', 'completed', 0]);
    assert.match(cmd.output, /ran: ls -la\nok/);
    assert.deepEqual([patch.toolKind, patch.status, patch.paths], ['edit', 'completed', ['src/a.js']]);
    const plan = r.entries.find((e) => e.kind === 'plan');
    assert.equal(plan.note, 'the plan');
    assert.deepEqual(plan.entries, [{ text: 'one', status: 'running' }, { text: 'two', status: 'pending' }]);
    assert.equal((await h.agent(s.id)).contextPct, 5);
    assert.deepEqual(files.map((f) => [f.path, f.kind]), [['src/a.js', 'edit']]);
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('approvals: once, for the session, reject — as Codex decisions', async () => {
    const s = await h.start('fake-codex', { name: 'Gate' });
    let n = await h.begin(s.id, 'ask:rm -rf build');
    let card = await h.need(s.id);
    assert.equal(card.message.split('\n')[0], 'Wants to run: rm -rf build');
    assert.match(card.request.detail, /the sandbox would not allow this command/);
    assert.deepEqual(card.request.options.map((o) => o.id), ['accept', 'acceptForSession', 'decline']);
    assert.deepEqual(card.actions, ['once', 'always', 'reject', 'reply']);
    await h.answer(card.id, { action: 'once' });
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'decision=accept');
    assert.equal((await h.turnView(s.id, n)).entries.find((e) => e.kind === 'tool').status, 'completed');

    n = await h.begin(s.id, 'ask:git push --force');
    card = await h.need(s.id);
    await h.answer(card.id, { action: 'reject' });
    await h.turnDone(s.id, n);
    const rejected = await h.turnView(s.id, n);
    assert.equal(rejected.said, 'decision=decline');
    assert.equal(rejected.entries.find((e) => e.kind === 'tool').status, 'failed', 'a declined command did not run');

    n = await h.begin(s.id, 'askfile:/etc/hosts');
    card = await h.need(s.id);
    assert.equal(card.request.category, 'file-change');
    assert.equal(card.message.split('\n')[0], 'Wants to change: /etc/hosts');
    await h.answer(card.id, { optionId: 'decline' });
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'decision=decline');

    // "For the session": Codex's own answer covers this exact command; the office remembers the category.
    n = await h.begin(s.id, 'ask:npm test');
    card = await h.need(s.id);
    await h.answer(card.id, { action: 'always' });
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'decision=acceptForSession');
    const next = await h.turn(s.id, 'ask:npm run lint');
    assert.equal(next.said, 'decision=accept');
    assert.equal(next.entries.find((e) => e.kind === 'permission').state, 'auto-allowed');
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('a question from the agent is answered in words', async () => {
    const s = await h.start('fake-codex', { name: 'Asker' });
    let n = await h.begin(s.id, 'question:Which Tailwind version?');
    let card = await h.need(s.id);
    assert.equal(card.kind, 'question');
    assert.deepEqual(card.actions, ['reply'], 'a question has no allow or reject');
    assert.match(card.message, /Choose: Which Tailwind version\? \(v3 \/ v4\)/);
    assert.equal((await h.agent(s.id)).blockKind, 'question');
    assert.equal((await h.answer(card.id, {})).status, 400);
    const res = await h.answer(card.id, { text: 'v4' });
    assert.equal(res.data.answered, 'answered');
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'answer=v4');
    const asked = (await h.turnView(s.id, n)).entries.find((e) => e.kind === 'question');
    assert.equal(asked.state, 'answered');
    assert.equal(asked.answer, 'v4');

    n = await h.begin(s.id, 'question:And the database?');
    card = await h.need(s.id);
    await h.answer(card.id, { action: 'reject' });
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'answer=', 'declining answers with nothing rather than leaving Codex waiting');
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('interrupt is a request Codex confirms; what it was waiting on is withdrawn', async () => {
    const s = await h.start('fake-codex', { name: 'Halt' });
    let n = await h.begin(s.id, 'say:going; slow');
    await waitFor(async () => (await h.turnView(s.id, n)).said.includes('..'), { what: 'Codex to be mid-stream' });
    assert.equal((await h.post(`/api/harness/sessions/${s.id}/interrupt`)).data.interrupted, true);
    assert.equal((await h.turnDone(s.id, n)).state, 'interrupted');

    n = await h.begin(s.id, 'ask:sleep 600');
    const card = await h.need(s.id);
    await h.post(`/api/harness/sessions/${s.id}/interrupt`);
    assert.equal((await h.turnDone(s.id, n)).state, 'interrupted');
    const after = (await h.get('/api/prompts')).data.find((p) => p.id === card.id);
    assert.equal(after.status, 'resolved');
    assert.equal((await h.entry(s.id, 'perm:' + card.request.id)).state, 'withdrawn');
    assert.equal((await h.session(s.id)).state, 'idle');
    assert.equal(JSON.parse((await h.turn(s.id, 'report')).said).interrupts, 2);
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('a failed turn is reported; a crash is cleaned up', async () => {
    const s = await h.start('fake-codex', { name: 'Fragile' });
    const failed = await h.turn(s.id, 'say:trying; error:You have hit your usage limit');
    assert.equal(failed.turn.state, 'failed');
    assert.match(failed.turn.error, /usage limit/);
    assert.equal((await h.session(s.id)).state, 'idle');
    const n = await h.begin(s.id, 'tool:make; crash:4');
    assert.equal((await h.turnDone(s.id, n)).state, 'failed');
    const gone = await waitFor(async () => { const v = await h.session(s.id); return v.live ? null : v; }, { what: 'the session to end' });
    assert.equal(gone.state, 'failed');
    assert.match(gone.reason, /exited with code 4/);
    assert.match(gone.reason, /fake codex was told to crash/);
    assert.ok((await h.activity()).some((e) => e.kind === 'agent-crash' && /Fragile/.test(e.text)));
  });

  await t.test('the account\'s allowance: asked once at the start, followed after, passed on as usage reports', async () => {
    const reports = [];
    const onReport = (e) => reports.push(e.report);
    h.ctx.bus.on('usage:report', onReport);
    t.after(() => h.ctx.bus.off('usage:report', onReport));

    const s = await h.start('fake-codex', { name: 'Meter' });
    const first = await waitFor(() => reports[0], { what: 'the first usage report' });
    assert.deepEqual(first, { provider: 'codex', plan: 'plus', source: 'driven', agentId: s.id, windows: [
      { id: 'primary', kind: 'session', label: 'Session', usedPercent: 42, resetsAt: 1_900_000_000_000, windowMins: 300 },
      { id: 'secondary', kind: 'weekly', label: 'Weekly', usedPercent: 71.5, resetsAt: 1_900_086_400_000, windowMins: 10080 },
    ] });
    assert.equal((await h.session(s.id)).limits.plan, 'plus');

    // Updates are partial: what Codex leaves out keeps its last value.
    await h.turn(s.id, 'limits:90; say:ok');
    await waitFor(() => reports.length === 2, { what: 'the update' });
    assert.deepEqual(reports[1].windows.map((w) => [w.id, w.usedPercent]), [['primary', 90], ['secondary', 71.5]]);
    assert.equal(reports[1].plan, 'plus');
    // One model's own limit is not the account's allowance, and a repeat is not news.
    await h.turn(s.id, 'limits:model:5; limits:90; say:ok');
    await sleep(60);
    assert.equal(reports.length, 2);
    const told = JSON.parse((await h.turn(s.id, 'report')).said);
    assert.equal(told.limitsRead, 1, 'it is asked for once');
    assert.equal(told.limitsParams, null);
    await h.del(`/api/harness/sessions/${s.id}`);

    // A Codex that does not know the method simply has no answer; nothing breaks, nothing is invented.
    const old = await h.start('fake-codex-old', { name: 'Elder' });
    assert.equal((await h.turn(old.id, 'say:still works')).said, 'still works');
    assert.equal((await h.session(old.id)).limits, null);
    assert.equal(reports.length, 2);
    await h.del(`/api/harness/sessions/${old.id}`);

    // An ACP agent has no standard way to report an allowance: no report, rather than a guess.
    const acp = await h.start('fake', { name: 'NoMeter' });
    await h.turn(acp.id, 'usage:10/100; say:ok');
    assert.equal(reports.length, 2);
    await h.del(`/api/harness/sessions/${acp.id}`);
  });
});

test('Codex allowance windows are read by their length, not their position', () => {
  assert.deepEqual(codexLimits(null), { plan: '', windows: [] });
  // No length given: paid plans are five hours and a week…
  assert.deepEqual(codexLimits({ planType: 'pro', primary: { usedPercent: 10 }, secondary: { usedPercent: 20 } }).windows.map((w) => [w.id, w.kind, w.windowMins]),
    [['primary', 'session', 300], ['secondary', 'weekly', 10080]]);
  // …and the free tiers a month.
  assert.deepEqual(codexLimits({ planType: 'free', primary: { usedPercent: 10 } }).windows.map((w) => [w.kind, w.label]), [['monthly', 'Monthly']]);
  // A spend cap is reported as what is left.
  const capped = codexLimits({ planType: 'team', individualLimit: { remainingPercent: 30, resetsAt: 1_900_000_000, limit: '50', used: '35' } });
  assert.deepEqual(capped.windows, [{ id: 'individual', kind: 'credit', label: 'Credit limit', usedPercent: 70, resetsAt: 1_900_000_000_000 }]);
  // Untrusted numbers are clamped or dropped, never passed on raw.
  const odd = codexLimits({ planType: 'x'.repeat(200), primary: { usedPercent: 250, resetsAt: 'soon', windowDurationMins: -5 }, secondary: { usedPercent: 'lots' } });
  assert.equal(odd.plan.length <= 40, true);
  assert.deepEqual(odd.windows, [{ id: 'primary', kind: 'session', label: 'Session', usedPercent: 100, windowMins: 300 }]);
});
