// Delegation: one agent giving another a task through the office — over HTTP,
// through the `office` CLI and through the office MCP server — with the rules
// that keep it safe. Everything runs against the fake agents; no model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startHarnessOffice, waitFor, sleep, ROOT } from './fixtures/harness-helpers.mjs';

// A teammate that is not driven: it came in through its hooks and uses the HTTP API (or the CLI).
async function withBob(h, id = 'bob-1') {
  await h.hook({ session_id: id, cwd: h.work, hook_event_name: 'SessionStart' });
  return h.agent(id);
}
const waitDone = async (h, id, timeoutMs = 8000) => (await h.get(`/api/delegations/${id}?wait=1&timeoutMs=${timeoutMs}`)).data.delegation;
const running = (h, id) => waitFor(async () => { const d = (await h.get(`/api/delegations/${id}`)).data.delegation; return d.status === 'running' ? d : null; },
  { what: `${id} to be running` });

// Tests delegate far more often than an agent should; the limits get their own office below.
const ROOMY = { OFFICE_DELEGATE_MAX_PER_HOUR: '400', OFFICE_DELEGATE_MAX_ACTIVE: '16', OFFICE_HARNESS_MAX_SESSIONS: '6' };

test('delegation', async (t) => {
  const h = await startHarnessOffice({ env: ROOMY });
  t.after(() => h.stop());
  const bob = await withBob(h);

  await t.test('the human delegates: a new agent gets a desk and the task; the result is kept and sent back', async () => {
    const seen = [];
    const onEvent = (e) => seen.push(e.delegation);
    h.ctx.bus.on('delegations', onEvent);
    const res = await h.post('/api/delegations', { to: 'fake', task: 'say:the answer is 42', title: 'Compute the answer', cwd: h.work, name: 'Worker' });
    assert.equal(res.status, 200);
    const d0 = res.data.delegation;
    assert.match(d0.id, /^dg_[a-f0-9]{10}$/);
    assert.ok(['queued', 'running'].includes(d0.status));
    assert.deepEqual(d0.from, { kind: 'human', agentId: null, name: 'Lead' });
    assert.equal(d0.to.adapter, 'fake');
    assert.equal(d0.to.provider, 'gemini');
    assert.equal(d0.to.name, 'Worker');
    assert.equal(d0.to.started, true);
    assert.equal(d0.hop, 0);
    assert.equal(d0.mode, 'ask');

    const d = await waitDone(h, d0.id);
    h.ctx.bus.off('delegations', onEvent);
    assert.equal(d.status, 'completed');
    assert.equal(d.result, 'the answer is 42');
    assert.equal(d.waitTimedOut, false);
    assert.equal(d.delivered.how, 'sent to the human');
    assert.ok(seen.some((x) => x.id === d.id && x.status === 'running') && seen.some((x) => x.id === d.id && x.status === 'completed'),
      'each step is announced on the bus');

    // The delegate is an agent like any other, and its transcript shows where the turn came from.
    const worker = await h.agent(d.to.agentId);
    assert.equal(worker.driven, true);
    assert.equal(worker.task, 'Compute the answer');
    const session = await h.session(d.to.sessionId);
    assert.deepEqual(session.origin, { kind: 'delegation', by: 'Lead', delegationId: d.id });
    assert.equal(session.wake, 'off');
    const turn = await h.entry(session.id, 'turn-1');
    assert.equal(turn.origin, 'delegation');
    assert.equal(turn.delegationId, d.id);
    assert.equal(turn.automatic, true);
    const asked = (await h.entry(session.id, 'turn-1:user')).text;
    assert.ok(asked.startsWith(`<delegated_task id="${d.id}" from="Lead">\nsay:the answer is 42\n</delegated_task>`));
    assert.match(asked, /Do the work yourself/);
    // The human finds the result in their mail with that agent, as well as on the record.
    const mail = (await h.get(`/api/collab/recent?agentId=${d.to.agentId}`)).data;
    assert.ok(mail.some((p) => p.content.startsWith(`[Delegated task ${d.id} · completed] Compute the answer`) && p.content.includes('the answer is 42')));
    assert.ok((await h.activity()).some((e) => e.kind === 'delegation' && /Lead gave Worker a task/.test(e.text)));

    const listed = (await h.get('/api/delegations?to=Worker&status=completed')).data.delegations;
    assert.deepEqual(listed.map((x) => x.id), [d.id]);
    assert.equal((await h.get('/api/delegations/dg_0000000000')).status, 404);
    assert.equal((await h.post('/api/delegations', { to: 'fake', cwd: h.work })).status, 400, 'a delegation needs a task');
    // Starting an agent is for this machine only.
    const evil = await fetch(h.base + '/api/delegations', { method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'text/plain' }, body: JSON.stringify({ to: 'fake', task: 'say:x' }) });
    assert.equal(evil.status, 403);
  });

  await t.test('an agent delegates: the result lands in its inbox, whatever kind of agent it is', async () => {
    const res = await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:done by the helper', role: 'review' });
    assert.equal(res.status, 200);
    const d0 = res.data.delegation;
    assert.deepEqual(d0.from, { kind: 'agent', agentId: 'bob-1', name: bob.name, provider: bob.provider || '', verified: false });
    assert.equal(d0.hop, 1, 'one step from a human');
    assert.equal(d0.mode, 'ask', 'a delegate asks the human unless the operator says otherwise');
    assert.match(d0.next, /will arrive in your office inbox/);
    const d = await waitDone(h, d0.id);
    assert.equal(d.status, 'completed');
    assert.equal(d.delivered.how, 'mailed to the delegator');
    assert.equal((await h.session(d.to.sessionId)).cwd, h.work, 'the delegate works in the delegator\'s folder');
    assert.match((await h.entry(d.to.sessionId, 'turn-1:user')).text, /\nAct as the review agent for this task\.\n\nsay:done by the helper\n<\/delegated_task>/);

    const box = await h.inbox('bob-1');
    const mail = box.items.find((m) => m.delegationId === d.id);
    assert.ok(mail, 'the result is mail');
    // …unless the delegator is waiting on the task at that moment: then the wait's answer is the delivery.
    const waited = (await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:straight back', wait: true })).data.delegation;
    assert.equal(waited.result, 'straight back');
    assert.match(waited.delivered.how, /returned to the delegator/);
    assert.ok(!(await h.inbox('bob-1')).items.some((m) => m.delegationId === waited.id));
    assert.equal(mail.from, d.to.name);
    assert.ok(mail.text.startsWith(`[Delegated task ${d.id} · completed]`));
    assert.ok(mail.text.includes(`Full timeline: office transcript ${d.to.agentId}`));
    assert.equal(mail.hop, 1, 'a result going home is the same exchange, not a step further');
    assert.deepEqual((await h.get('/api/delegations?from=bob-1')).data.delegations.map((x) => x.id), [waited.id, d.id]);
  });

  await t.test('a driven agent delegates with its own office tools and is woken with the result', async () => {
    const boss = await h.start('fake', { name: 'Boss', wake: 'results' });
    // Its own turn carries on after delegating; the child finishing does not finish it.
    const first = await h.turn(boss.id, 'delegate:fake|say:the child did it; sleep:1200; tool:echo still mine');
    const id = /delegate=200:(dg_[a-f0-9]+)/.exec(first.said)[1];
    assert.equal(first.turn.state, 'completed');
    assert.equal(first.entries.find((e) => e.kind === 'tool').command, 'echo still mine');
    const d = await waitDone(h, id);
    assert.equal(d.status, 'completed');
    assert.equal(d.result, 'the child did it');
    assert.ok(d.endedAt < first.turn.endedAt, 'the child finished while its parent was still working');
    assert.equal(d.from.agentId, boss.id);
    assert.equal(d.from.verified, true, 'the session token says who is asking');
    assert.equal(d.hop, 1);
    assert.equal((await h.session(d.to.sessionId)).cwd, h.work);

    const woke = await h.turnDone(boss.id, 2);
    assert.equal(woke.origin, 'wake');
    assert.equal(woke.hop, 1);
    const delivered = (await h.entry(boss.id, 'turn-2:user')).text;
    assert.ok(delivered.includes(`[Delegated task ${id} · completed]`));
    assert.ok(delivered.includes('the child did it'));

    // "results" means results: a plain note does not start a turn.
    await h.post('/api/collab/message', { fromAgentId: 'bob-1', toAgentId: boss.id, content: 'got a minute?' });
    await sleep(150);
    assert.equal((await h.session(boss.id)).turns, 2);
    await h.del(`/api/harness/sessions/${boss.id}`);
  });

  await t.test('the office tools a launched agent is given really work, and say who it is', async () => {
    const boss = await h.start('fake', { name: 'Toolsmith' });
    await h.patch(`/api/harness/sessions/${boss.id}`, { wake: 'results' });
    const caps = (await h.turn(boss.id, 'mcp:office_capabilities')).said;
    assert.match(caps, /Agents the office can start here/);
    assert.match(caps, /fake\s+Fake Agent · acp/);
    assert.match(caps, /claude\s+Claude Code · acp {2}— not installed/);
    const out = (await h.turn(boss.id, 'mcp:office_delegate {"to":"fake","task":"say:made through mcp","wait":true,"timeoutSeconds":20}')).said;
    assert.match(out, /^dg_[a-f0-9]+ {2}completed/);
    assert.match(out, /made through mcp/);
    const id = out.split(' ')[0];
    const d = (await h.get(`/api/delegations/${id}`)).data.delegation;
    assert.equal(d.from.agentId, boss.id);
    assert.equal(d.from.verified, true, 'the injected MCP server carries the session token');
    // It waited for the result and got it as the tool's answer: the office does not also mail it, or spend a turn on it.
    assert.match(d.delivered.how, /returned to the delegator, which was waiting for it/);
    await sleep(150);
    assert.equal((await h.session(boss.id)).turns, 2);
    assert.ok(!(await h.inbox(boss.id)).items.some((m) => m.delegationId === id));
    assert.match((await h.turn(boss.id, 'mcp:office_delegation {}')).said, new RegExp(`^${id}  completed`));
    assert.match((await h.turn(boss.id, `mcp:office_transcript {"agent":"${d.to.agentId}"}`)).said, /── turn 1 · delegation from Toolsmith[\s\S]*made through mcp/);
    assert.match((await h.turn(boss.id, 'mcp:office_who')).said, /Toolsmith/);
    await h.del(`/api/harness/sessions/${boss.id}`);
  });

  await t.test('waiting never cancels; a pending approval ends a wait but is the human\'s to answer', async () => {
    const res = await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'sleep:900', wait: true, timeoutMs: 150 });
    const slow = res.data.delegation;
    assert.equal(slow.waitTimedOut, true);
    assert.ok(['queued', 'running'].includes(slow.status), 'the wait timed out; the task did not');
    const done = await waitDone(h, slow.id);
    assert.equal(done.status, 'completed');
    assert.equal(done.result, null);
    assert.ok((await h.inbox('bob-1')).items.some((m) => m.delegationId === slow.id && /ended without a written result/.test(m.text)));

    const asked = (await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'ask:rm -rf build', wait: true, timeoutMs: 6000 })).data.delegation;
    assert.equal(asked.status, 'waiting');
    assert.equal(asked.waitTimedOut, false);
    assert.equal(asked.pendingApproval.kind, 'permission');
    const card = (await h.get('/api/prompts?status=pending')).data.find((p) => p.id === asked.pendingApproval.promptId);
    assert.equal(card.agentId, asked.to.agentId);
    assert.equal(card.request.command, 'rm -rf build');
    // The human answers; the delegator could not have (agents never can — see harness.test.mjs).
    await h.answer(card.id, { action: 'once' });
    const after = await waitDone(h, asked.id);
    assert.equal(after.status, 'completed');
    assert.equal(after.result, 'outcome=allow-once');
    assert.equal(after.pendingApproval, null);
  });

  await t.test('cancel: the delegator or the human — and whatever the task delegated in turn goes first', async () => {
    await withBob(h, 'carol-1');
    const mine = (await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:working; slow' })).data.delegation;
    await running(h, mine.id);
    assert.equal((await h.post(`/api/delegations/${mine.id}/cancel`, { from: 'carol-1' })).status, 403);
    const cancelled = (await h.post(`/api/delegations/${mine.id}/cancel`, { from: 'bob-1', reason: 'changed my mind' })).data.delegation;
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.error, 'changed my mind');
    assert.match(cancelled.delivered.how, /not mailed: the delegator cancelled it/);
    assert.equal((await h.turnDone(cancelled.to.sessionId, 1)).state, 'interrupted');
    assert.equal((await h.session(cancelled.to.sessionId)).live, true, 'cancelling a task stops the turn, not the agent');
    assert.ok(!(await h.inbox('bob-1')).items.some((m) => m.delegationId === mine.id));
    // Cancelling again, or something finished, changes nothing.
    assert.equal((await h.post(`/api/delegations/${mine.id}/cancel`, { from: 'bob-1' })).data.delegation.status, 'cancelled');
    assert.equal((await h.post('/api/delegations/dg_0000000000/cancel', {})).status, 404);

    // The human cancels someone else's task: the delegator is told.
    const theirs = (await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'slow' })).data.delegation;
    await running(h, theirs.id);
    assert.equal((await h.post(`/api/delegations/${theirs.id}/cancel`, {})).data.delegation.status, 'cancelled');
    await waitFor(async () => (await h.inbox('bob-1')).items.some((m) => m.delegationId === theirs.id && /cancelled by the human/.test(m.text)),
      { what: 'the cancellation to reach the delegator' });

    // A task that delegated in turn: the grandchild stops before the child does.
    const top = (await h.post('/api/delegations', { to: 'fake', task: 'delegate:fake|slow; slow', cwd: h.work, name: 'Mid' })).data.delegation;
    const inner = await waitFor(async () => (await h.get(`/api/delegations?from=${top.to.agentId}`)).data.delegations.find((x) => x.status === 'running'),
      { what: 'the nested task to be running' });
    assert.equal(inner.parentId, top.id);
    assert.equal(inner.hop, 1);
    await h.post(`/api/delegations/${top.id}/cancel`, {});
    const innerAfter = (await h.get(`/api/delegations/${inner.id}`)).data.delegation;
    assert.equal(innerAfter.status, 'cancelled');
    assert.match(innerAfter.error, new RegExp(`its parent task ${top.id} was cancelled`));
    assert.equal((await h.get(`/api/delegations/${top.id}`)).data.delegation.status, 'cancelled');
    assert.equal((await h.turnDone(inner.to.sessionId, 1)).state, 'interrupted');
    assert.equal((await h.turnDone(top.to.sessionId, 1)).state, 'interrupted');
  });

  await t.test('a delegate never has more freedom than its delegator, nor than the operator allows', async () => {
    const tooMuch = await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:x', mode: 'full' });
    assert.equal(tooMuch.status, 403);
    assert.match(tooMuch.data.error, /broader than a task you delegate may run with \(at most "ask"\)/);
    // The human chooses freely.
    const edits = (await h.post('/api/delegations', { to: 'fake', task: 'askfile:src/a.js', mode: 'edits', cwd: h.work, wait: true })).data.delegation;
    assert.equal(edits.mode, 'edits');
    assert.equal(edits.result, 'outcome=allow-once');
    // An agent cannot borrow a freer agent that is already here.
    const free = await h.start('fake', { name: 'Free', mode: 'full' });
    const borrowed = await h.post('/api/delegations', { from: 'bob-1', to: 'Free', task: 'say:x' });
    assert.equal(borrowed.status, 403);
    assert.match(borrowed.data.error, /Free runs with broader permissions/);
    await h.del(`/api/harness/sessions/${free.id}`);

    // An agent delegates inside its own folder, nowhere else.
    const outside = await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:x', cwd: path.dirname(h.work) });
    assert.equal(outside.status, 403);
    assert.match(outside.data.error, /inside its own folder/);
    assert.equal((await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:x', cwd: path.join(h.work, 'nope') })).status, 400);
    const sub = path.join(h.work, 'packages');
    fs.mkdirSync(sub);
    const inside = (await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:x', cwd: sub, wait: true })).data.delegation;
    assert.equal((await h.session(inside.to.sessionId)).cwd, sub);
  });

  await t.test('giving a task to an agent that is already here', async () => {
    const wendy = await h.start('fake', { name: 'Wendy' });
    const d = (await h.post('/api/delegations', { from: 'bob-1', to: 'Wendy', task: 'say:sure thing', wait: true })).data.delegation;
    assert.equal(d.status, 'completed');
    assert.equal(d.to.agentId, wendy.id);
    assert.equal(d.to.started, false);
    assert.equal(d.result, 'sure thing');
    assert.equal((await h.entry(wendy.id, 'turn-1')).origin, 'delegation');
    // While she is busy the task waits its turn.
    await h.begin(wendy.id, 'sleep:250; say:my own work');
    const queued = (await h.post('/api/delegations', { from: 'bob-1', to: 'agent:Wendy', task: 'say:after that' })).data.delegation;
    assert.equal(queued.status, 'queued');
    assert.equal((await waitDone(h, queued.id)).result, 'after that');
    assert.equal((await h.session(wendy.id)).live, true, 'an agent the human started is not sent home after a delegated task');

    const notDriven = await h.post('/api/delegations', { from: 'bob-1', to: 'carol-1', task: 'say:x' });
    assert.equal(notDriven.status, 404);
    assert.match(notDriven.data.error, /is not driven by the office.*Send a note instead/);
    const unknown = await h.post('/api/delegations', { from: 'bob-1', to: 'nobody-at-all', task: 'say:x' });
    assert.equal(unknown.status, 404);
    assert.match(unknown.data.error, /Adapters available here: .*fake/);
    assert.equal((await h.post('/api/delegations', { from: 'bob-1', to: 'claude', task: 'say:x' })).status, 409, 'an adapter that is not installed');
    assert.equal((await h.post('/api/delegations', { from: 'ghost-9', to: 'fake', task: 'say:x' })).status, 404);
    assert.match((await h.turn(wendy.id, 'delegate:Wendy|say:to myself')).said, /^delegate=400:you cannot delegate to yourself/);
    await h.del(`/api/harness/sessions/${wendy.id}`);
  });

  await t.test('the same request twice is one task', async () => {
    const before = (await h.get('/api/harness/sessions?all=1')).data.sessions.length;
    const a = (await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:once', clientRequestId: 'req-77' })).data.delegation;
    const b = (await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:once', clientRequestId: 'req-77' })).data.delegation;
    assert.equal(b.id, a.id);
    assert.equal(b.duplicate, true);
    assert.equal((await h.get('/api/harness/sessions?all=1')).data.sessions.length, before + 1);
    // …but only for the same delegator.
    const other = (await h.post('/api/delegations', { from: 'carol-1', to: 'fake', task: 'say:once', clientRequestId: 'req-77' })).data.delegation;
    assert.notEqual(other.id, a.id);
    await waitDone(h, a.id);
    await waitDone(h, other.id);
  });

  await t.test('context is handed over as a recorded artifact, not glued on quietly', async () => {
    const source = await h.start('fake', { name: 'Scout' });
    await h.turn(source.id, 'say:I looked at the failing test; tool:npm test; edit:src/fix.js; read:README.md');
    const d = (await h.post('/api/delegations', { to: 'fake', task: 'report', cwd: h.work, context: { session: source.id }, wait: true })).data.delegation;
    assert.equal(d.status, 'completed');
    const told = JSON.parse(d.result);
    assert.equal(told.handoffs, 1);
    assert.equal(told.tasks, 1);
    assert.deepEqual(d.handoff, { fromSessionId: source.id, fromName: 'Scout', items: 4, omitted: 0, turns: [1, 1] });
    const incoming = await h.entry(d.to.sessionId, `handoff:${d.id}`);
    assert.equal(incoming.kind, 'handoff');
    assert.equal(incoming.direction, 'in');
    assert.ok(incoming.text.startsWith(`<handoff from="Scout (gemini)" session="${source.id}" turns="1-1">`));
    assert.match(incoming.text, /background, not a new request/);
    assert.match(incoming.text, /- User: say:I looked at the failing test/);
    assert.match(incoming.text, /- Assistant: I looked at the failing test/);
    assert.match(incoming.text, /- Command: npm test/);
    assert.match(incoming.text, /- File change: src\/fix\.js/);
    assert.equal(incoming.text.split('\n').filter((l) => l.startsWith('- ')).length, 4, 'reads and reasoning are not carried over');
    const outgoing = await h.entry(source.id, `handoff:${d.id}`);
    assert.equal(outgoing.direction, 'out');
    assert.equal(outgoing.items, 4);
    // Only a session with a transcript can hand anything over.
    assert.equal((await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:x', context: true })).status, 400);
    await h.del(`/api/harness/sessions/${source.id}`);
  });

  await t.test('a delegate that dies fails the task, and says why', async () => {
    const started = (await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:half way; crash:3' })).data.delegation;
    const d = await waitDone(h, started.id);
    assert.equal(d.status, 'failed');
    assert.match(d.error, /exited with code 3/);
    assert.equal(d.result, 'half way', 'what it got done is kept');
    await waitFor(async () => (await h.inbox('bob-1')).items.some((m) => m.delegationId === d.id && /· failed\]/.test(m.text)),
      { what: 'the failure to reach the delegator' });
  });

  await t.test('paused means paused for agents too; the human can still act', async () => {
    await h.post('/api/harness/wake', { paused: true });
    const refused = await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:x' });
    assert.equal(refused.status, 423);
    assert.match(refused.data.error, /automatic turns are paused by the human/);
    const byHuman = (await h.post('/api/delegations', { to: 'fake', task: 'say:the human may', cwd: h.work, wait: true })).data.delegation;
    assert.equal(byHuman.status, 'completed');
    await h.post('/api/harness/wake', { paused: false });
  });

  await t.test('when nobody names a provider the office chooses — by remaining allowance, when someone keeps count', async () => {
    const real = h.ctx.usage;
    const pick = async (advice) => {
      if (advice === undefined) delete h.ctx.usage; else h.ctx.usage = { advice };
      return h.post('/api/delegations', { task: 'say:hello', cwd: h.work, wait: true });
    };
    const chosen = async (advice) => {
      const res = await pick(advice);
      assert.equal(res.data.delegation?.status, 'completed', JSON.stringify(res.data));
      return res.data.delegation.to;
    };
    try {
      const plain = await chosen(undefined);
      assert.equal(plain.adapter, 'fake', 'without advice: the first agent that can be started here');
      assert.match(plain.chosenBecause, /first agent that can be started/);
      const preferred = await chosen(() => ({ prefer: 'codex', low: [], out: [] }));
      assert.equal(preferred.adapter, 'fake-codex');
      assert.equal(preferred.chosenBecause, 'codex has the most allowance left');
      const avoiding = await chosen(() => ({ prefer: null, low: ['gemini', 'opencode'], out: [] }));
      assert.equal(avoiding.adapter, 'fake-codex');
      assert.match(avoiding.chosenBecause, /gemini, opencode are spent or running low/);
      // A spent provider is never chosen — not even when it is the one "preferred".
      assert.equal((await chosen(() => ({ prefer: 'gemini', low: [], out: ['gemini', 'opencode'] }))).adapter, 'fake-codex');
      // Running low is still better than nothing.
      assert.equal((await chosen(() => ({ prefer: null, low: ['gemini', 'opencode', 'codex'], out: [] }))).adapter, 'fake');
      const none = await pick(() => ({ prefer: null, low: [], out: ['gemini', 'opencode', 'codex'] }));
      assert.equal(none.status, 409);
      assert.match(none.data.error, /every provider that can be started here is out of allowance/);
      // Naming one is the caller's decision, and stays possible.
      h.ctx.usage = { advice: () => ({ prefer: null, low: [], out: ['gemini', 'opencode', 'codex'] }) };
      assert.equal((await h.post('/api/delegations', { to: 'fake', task: 'say:anyway', cwd: h.work, wait: true })).data.delegation.status, 'completed');
      assert.equal((await chosen(() => ({ prefer: 'claude', low: [], out: [] }))).adapter, 'fake', 'a preferred provider that is not installed cannot be chosen');
      assert.equal((await chosen(() => { throw new Error('usage is having a day'); })).adapter, 'fake', 'advice is optional, even when it breaks');
      assert.equal((await chosen(() => ({ prefer: 42, low: 'all of them', out: null }))).adapter, 'fake');
      // The real usage service, with nothing worth acting on, steers nothing.
      h.ctx.usage = real;
      assert.equal(real.advice().prefer, null);
      assert.equal((await h.post('/api/delegations', { task: 'say:hello', cwd: h.work, wait: true })).data.delegation.to.adapter, 'fake');
    } finally { h.ctx.usage = real; }
  });
});

test('delegation limits', async (t) => {
  await t.test('how many at once, and how many an hour', async () => {
    const h = await startHarnessOffice({ env: { OFFICE_DELEGATE_MAX_ACTIVE: '1', OFFICE_DELEGATE_MAX_PER_HOUR: '2' } });
    try {
      await withBob(h);
      const first = (await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'slow' })).data.delegation;
      const second = await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:x' });
      assert.equal(second.status, 429);
      assert.match(second.data.error, /already have 1 delegated tasks running/);
      await h.post(`/api/delegations/${first.id}/cancel`, { from: 'bob-1' });
      assert.equal((await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:x', wait: true })).data.delegation.status, 'completed');
      const third = await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'say:x' });
      assert.equal(third.status, 429);
      assert.match(third.data.error, /delegated 2 tasks this hour/);
      // The limits are on agents acting by themselves, not on the human.
      assert.equal((await h.post('/api/delegations', { to: 'fake', task: 'say:x', cwd: h.work })).status, 200);
    } finally { await h.stop(); }
  });

  await t.test('a chain of agents handing work on stops at the limit', async () => {
    const h = await startHarnessOffice({ env: { OFFICE_WAKE_MAX_HOPS: '1' } });
    try {
      await withBob(h);
      const d = (await h.post('/api/delegations', { from: 'bob-1', to: 'fake', task: 'delegate:fake|say:too deep', wait: true })).data.delegation;
      assert.equal(d.status, 'completed');
      assert.match(d.result, /^delegate=429:the office will not start this by itself: it would be step 2 of an agent-to-agent chain \(the limit is 1\)/);
      assert.equal((await h.get('/api/delegations')).data.delegations.length, 1, 'the deeper task was never created');
    } finally { await h.stop(); }
  });

  await t.test('the operator sets the ceiling; a delegator\'s own mode still caps it', async () => {
    const h = await startHarnessOffice({ env: { OFFICE_DELEGATE_MAX_MODE: 'edits' } });
    try {
      const careful = await h.start('fake', { name: 'Careful', mode: 'ask' });
      assert.match((await h.turn(careful.id, 'delegate:fake|say:x|{"mode":"edits"}')).said, /^delegate=403:mode "edits" is broader/);
      const fromCareful = /delegate=200:(dg_\w+)/.exec((await h.turn(careful.id, 'delegate:fake|say:x')).said)[1];
      assert.equal((await waitDone(h, fromCareful)).mode, 'ask');
      const bold = await h.start('fake', { name: 'Bold', mode: 'full' });
      assert.match((await h.turn(bold.id, 'delegate:fake|say:x|{"mode":"full"}')).said, /^delegate=403:.*at most "edits"/);
      const fromBold = /delegate=200:(dg_\w+)/.exec((await h.turn(bold.id, 'delegate:fake|say:x')).said)[1];
      assert.equal((await waitDone(h, fromBold)).mode, 'edits');
    } finally { await h.stop(); }
  });

  await t.test('a full office sends home a delegate that is only lingering — never one at work, never one a human started', async () => {
    const h = await startHarnessOffice({ env: { OFFICE_HARNESS_MAX_SESSIONS: '2' } });
    try {
      const mine = await h.start('fake', { name: 'Mine' });
      const a = (await h.post('/api/delegations', { to: 'fake', task: 'say:first job', cwd: h.work, wait: true })).data.delegation;
      assert.equal((await h.session(a.to.sessionId)).live, true, 'it lingers in case someone has more for it');
      const b = (await h.post('/api/delegations', { to: 'fake', task: 'say:second job; slow', cwd: h.work })).data.delegation;
      const gone = await waitFor(async () => { const s = await h.session(a.to.sessionId); return s.live ? null : s; }, { what: 'the idle delegate to give up its seat' });
      assert.equal(gone.state, 'ended');
      assert.match(gone.reason, /the office needed the seat/);
      await running(h, b.id);
      // Now both seats hold someone who may not be moved: the human's own agent, and a delegate at work.
      const full = await h.post('/api/delegations', { to: 'fake', task: 'say:third job', cwd: h.work });
      assert.equal(full.status, 429);
      assert.match(full.data.error, /already driving 2 agents/);
      assert.equal((await h.session(mine.id)).live, true);
    } finally { await h.stop(); }
  });

  await t.test('a delegate started for one task goes home when nobody has more for it', async () => {
    const h = await startHarnessOffice({ env: { OFFICE_DELEGATE_IDLE_END_MS: '250' } });
    try {
      const d = (await h.post('/api/delegations', { to: 'fake', task: 'say:quick job', cwd: h.work, wait: true })).data.delegation;
      assert.equal((await h.session(d.to.sessionId)).live, true);
      const gone = await waitFor(async () => { const s = await h.session(d.to.sessionId); return s.live ? null : s; }, { what: 'the idle delegate to go home' });
      assert.equal(gone.state, 'ended');
      assert.match(gone.reason, /delegated work was done and nobody had more for it/);
      assert.ok(!(await h.activity()).some((e) => e.kind === 'agent-crash'));
    } finally { await h.stop(); }
  });

  await t.test('delegation can be switched off; records survive a restart', async () => {
    const off = await startHarnessOffice({ env: { OFFICE_DELEGATE: '0' } });
    try {
      assert.equal((await off.post('/api/delegations', { to: 'fake', task: 'say:x', cwd: off.work })).status, 403);
      assert.equal((await off.get('/api/harness')).data.limits.delegate.enabled, false);
    } finally { await off.stop(); }

    const first = await startHarnessOffice();
    const done = (await first.post('/api/delegations', { to: 'fake', task: 'say:kept', cwd: first.work, wait: true })).data.delegation;
    const cut = (await first.post('/api/delegations', { to: 'fake', task: 'slow', cwd: first.work })).data.delegation;
    await running(first, cut.id);
    await first.stop();
    const second = await startHarnessOffice({ dir: first.dir, work: first.work });
    try {
      assert.equal((await second.get(`/api/delegations/${done.id}`)).data.delegation.result, 'kept');
      const after = (await second.get(`/api/delegations/${cut.id}`)).data.delegation;
      assert.equal(after.status, 'interrupted');
      assert.match(after.error, /session was ended \(the office is shutting down\)/);
    } finally { await second.stop(); }
  });
});

test('delegation from the office CLI and the office MCP server', async (t) => {
  const h = await startHarnessOffice({ env: ROOMY });
  t.after(() => h.stop());
  await withBob(h);
  // The way an agent in a terminal uses it: its own id in the environment, nothing else.
  const env = { ...process.env, OFFICE_PORT: String(h.port), OFFICE_URL: '', OFFICE_TOKEN: '', OFFICE_SESSION_TOKEN: '', OFFICE_AGENT_ID: 'bob-1',
    CLAUDE_CODE_SESSION_ID: '', CLAUDE_SESSION_ID: '', CODEX_THREAD_ID: '', CLAUDECODE: '', HOME: h.dir };
  // Not spawnSync: the office under test lives in this process and has to keep answering.
  const office = (...args) => new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'office.mjs'), ...args], { cwd: h.work, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });

  await t.test('office runtimes / delegate / delegation / transcript', async () => {
    const runtimes = await office('runtimes');
    assert.equal(runtimes.code, 0, runtimes.err);
    assert.match(runtimes.out, /fake\s+Fake Agent · acp/);
    assert.match(runtimes.out, /claude\s+Claude Code · acp {2}— not installed/);
    assert.match(runtimes.out, /stops after 3 steps/);

    const made = await office('delegate', 'fake', 'say:from the command line', '--title', 'CLI task', '--wait', '20');
    assert.equal(made.code, 0, made.err);
    assert.match(made.out, /^dg_[a-f0-9]+ {2}completed {2}→ {2}.+ \(fake\) {2}“CLI task”/);
    assert.match(made.out, /from the command line/);
    const id = made.out.split(' ')[0];
    const d = (await h.get(`/api/delegations/${id}`)).data.delegation;
    assert.equal(d.from.agentId, 'bob-1');

    assert.match((await office('delegation')).out, new RegExp(`You delegated\\n  ${id}  completed`));
    assert.match((await office('delegation', id)).out, /from the command line/);
    assert.equal(JSON.parse((await office('delegation', id, '--json')).out).delegation.id, id);
    const timeline = await office('transcript', d.to.agentId);
    assert.match(timeline.out, /── turn 1 · delegation from .+ \(hop 1\) · completed/);
    assert.match(timeline.out, /from the command line/);
    assert.match(timeline.out, /What changed since: office transcript .+ --after \d+/);

    // "any" lets the office choose; without --wait the answer says where the result will arrive.
    const any = await office('delegate', 'any', 'sleep:300');
    assert.match(any.out, /^dg_[a-f0-9]+ {2}(queued|running)/);
    assert.match(any.out, /will arrive in your office inbox/);
    const cancelled = await office('delegation', 'cancel', any.out.split(' ')[0], 'not', 'needed');
    assert.match(cancelled.out, /cancelled/);
    assert.match(cancelled.out, /not needed/);

    const bad = await office('delegate', 'nobody-here', 'say:x');
    assert.equal(bad.code, 1);
    assert.match(bad.err, /no adapter or driven agent called "nobody-here"/);
    assert.equal((await office('delegate')).code, 1);
    assert.match((await office('help')).out, /office delegate <adapter\|agent\|any> <task…>/);
  });

  await t.test('the MCP tools: office_capabilities, office_delegate, office_delegation, office_transcript', async () => {
    const child = spawn(process.execPath, [path.join(ROOT, 'office-mcp.mjs')], { cwd: h.work, stdio: ['pipe', 'pipe', 'ignore'], env });
    t.after(() => child.kill());
    let buf = ''; const waiting = new Map(); let n = 0;
    child.stdout.on('data', (chunk) => { buf += chunk; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); waiting.get(m.id)?.(m); } });
    const rpc = (method, params) => new Promise((resolve) => { const id = ++n; waiting.set(id, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
    const call = async (name, args = {}) => (await rpc('tools/call', { name, arguments: args })).result;
    const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'codex', version: '1' } });
    assert.match(init.result.instructions, /office_delegate hands it over/);
    const names = (await rpc('tools/list', {})).result.tools.map((x) => x.name);
    for (const tool of ['office_capabilities', 'office_delegate', 'office_delegation', 'office_transcript']) assert.ok(names.includes(tool), tool);

    assert.match((await call('office_capabilities')).content[0].text, /Agents the office can start here/);
    const made = await call('office_delegate', { to: 'fake', task: 'say:made by an mcp client', wait: true, timeoutSeconds: 20, title: 'MCP task' });
    assert.ok(!made.isError, made.content[0].text);
    assert.match(made.content[0].text, /^dg_[a-f0-9]+ {2}completed/);
    assert.match(made.content[0].text, /made by an mcp client/);
    const id = made.content[0].text.split(' ')[0];
    assert.match((await call('office_delegation', { id })).content[0].text, /MCP task/);
    assert.match((await call('office_delegation', {})).content[0].text, new RegExp(id));
    const d = (await h.get(`/api/delegations/${id}`)).data.delegation;
    assert.match((await call('office_transcript', { agent: d.to.agentId })).content[0].text, /made by an mcp client/);

    const later = await call('office_delegate', { task: 'sleep:400' });
    const laterId = later.content[0].text.split(' ')[0];
    assert.match((await call('office_delegation', { id: laterId, action: 'wait', timeoutSeconds: 1 })).content[0].text, /completed|still running/);
    assert.match((await call('office_delegation', { id: laterId, action: 'cancel', reason: 'done testing' })).content[0].text, /cancelled|completed/);
    const refused = await call('office_delegate', { to: 'fake', task: 'say:x', mode: 'full' });
    assert.equal(refused.isError, true);
    assert.match(refused.content[0].text, /broader than a task you delegate may run with/);
  });
});
