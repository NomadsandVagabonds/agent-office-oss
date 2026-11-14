// What a driven session runs on, and changing it while it runs: its model, how
// hard it thinks, the agent's own mode (plan, and whatever else it calls them)
// and how freely it may act. None of it is a catalogue of the office's: every
// option here is one the (fake) agent listed itself, and every change is put to
// the agent and written into the session's record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarnessOffice, waitFor } from './fixtures/harness-helpers.mjs';
import { CODEX_TURN_POLICY } from '../server/harness/codex.mjs';

test('driven sessions: model, effort, the agent\'s own mode, access', async (t) => {
  const h = await startHarnessOffice();
  t.after(() => h.stop());
  const set = (id, body, headers) => h.patch(`/api/harness/sessions/${id}`, body, headers);
  const told = async (id) => JSON.parse((await h.turn(id, 'report')).said);
  const notices = async (id) => (await h.entries(id)).filter((e) => e.kind === 'notice').map((e) => e.text);
  const adapter = async (id) => (await h.get('/api/harness')).data.adapters.find((a) => a.id === id);

  await t.test('ACP: what the agent offers is what can be chosen, and a change is put to the agent', async () => {
    assert.equal((await adapter('fake')).offers, null, 'before an agent has ever run here, the office claims to know nothing about it');
    const s = await h.start('fake', { name: 'Ada' });
    assert.deepEqual([s.model, s.effort, s.agentMode, s.mode], ['fake-large', 'medium', 'default', 'ask']);

    // the model, by its id; the record says who changed it, and calls it what the agent calls it
    const m = await set(s.id, { model: 'fake-small' });
    assert.equal(m.status, 200);
    assert.deepEqual([m.data.session.model, m.data.session.controls.model.value], ['fake-small', 'fake-small']);
    assert.equal((await h.agent(s.id)).model, 'fake-small', 'its desk shows the same');
    assert.equal((await h.entry(s.id, 'session')).model, 'fake-small', 'and so does the head of its record');
    assert.ok((await notices(s.id)).includes('Model set to “Fake Small” by Lead.'));
    // the smaller model cannot think as hard: the agent's new list replaces the old one
    assert.deepEqual(m.data.session.controls.effort.options, ['low', 'medium', 'high'], 'not yet: the agent has not said so');
    const narrowed = await set(s.id, { model: 'fake-large', effort: 'high' });
    assert.deepEqual([narrowed.data.session.model, narrowed.data.session.effort], ['fake-large', 'high']);
    await set(s.id, { model: 'fake-small' });
    const after = await waitFor(async () => { const x = await h.session(s.id); return x.effort === 'medium' ? x : null; }, { what: 'the agent to say what the smaller model can do' });
    assert.deepEqual(after.controls.effort.options, ['low', 'medium']);
    assert.deepEqual((await told(s.id)).settings, { model: 'fake-small', effort: 'medium', mode: 'default' }, 'the agent really was told');

    // what is not on the agent's list is refused before it is asked; what it refuses itself is said in its words
    const no = await set(s.id, { model: 'gpt-anything' });
    assert.equal(no.status, 400);
    assert.match(no.data.error, /model must be one of fake-large, fake-small/);
    assert.match((await set(s.id, { effort: 'high' })).data.error, /effort must be one of low, medium/);
    assert.equal((await set(s.id, { effort: '' })).status, 400);
    assert.equal((await set(s.id, { model: 'fake-small' })).status, 200, 'setting what is already set is not an error');
    assert.equal((await notices(s.id)).filter((x) => x.startsWith('Model set to “Fake Small”')).length, 2, 'nor is it written down again');

    // its own mode: set by a person, it is recorded as theirs — once
    const p = await set(s.id, { agentMode: 'plan' });
    assert.equal(p.data.session.agentMode, 'plan');
    assert.equal((await told(s.id)).settings.mode, 'plan');
    const said = await notices(s.id);
    assert.ok(said.includes('Its own mode set to “Plan” by Lead.'));
    assert.ok(!said.some((x) => /switched to its/.test(x)), 'the agent did not switch by itself, so nothing says it did');
    // …and when the agent does switch by itself, that is what the record says
    await h.turn(s.id, 'mode:yolo; say:done');
    assert.equal((await h.session(s.id)).agentMode, 'yolo');
    assert.ok((await notices(s.id)).includes('The agent switched to its “yolo” mode.'));
    assert.match((await set(s.id, { agentMode: 'turbo' })).data.error, /own mode must be one of default, plan, yolo/);

    // only the human changes these: anything that presents a session token is an agent
    const asAgent = await set(s.id, { model: 'fake-large' }, { 'x-office-session': 'whatever-an-agent-holds' });
    assert.equal(asAgent.status, 403);
    assert.match(asAgent.data.error, /agents cannot change .* what it runs on; that is for the human/);
    assert.equal((await h.session(s.id)).model, 'fake-small');

    // the office now remembers what this agent offers, for the next time one is started
    const offers = (await adapter('fake')).offers;
    assert.deepEqual(offers.models, [{ id: 'fake-large', name: 'Fake Large' }, { id: 'fake-small', name: 'Fake Small' }]);
    assert.deepEqual(offers.modes.map((x) => x.id), ['default', 'plan', 'yolo']);
    assert.ok(offers.efforts.length >= 2 && offers.at > 0);
    assert.equal((await adapter('fake-auth')).offers, null, 'and still nothing about one that never ran');

    await h.del(`/api/harness/sessions/${s.id}`);
    const ended = await set(s.id, { model: 'fake-large' });
    assert.ok([404, 409].includes(ended.status), 'nothing can be set on a session that has ended');

    // chosen before it starts: all three are in place for its first turn
    const chosen = await h.start('fake', { model: 'fake-small', effort: 'low', agentMode: 'plan' });
    assert.deepEqual([chosen.model, chosen.effort, chosen.agentMode], ['fake-small', 'low', 'plan']);
    assert.deepEqual((await told(chosen.id)).settings, { model: 'fake-small', effort: 'low', mode: 'plan' });
    await h.del(`/api/harness/sessions/${chosen.id}`);
  });

  await t.test('ACP v2: the same choices, described as session config options', async () => {
    const s = await h.start('fake-v2');
    assert.deepEqual([s.model, s.effort], ['fake-large', 'medium']);
    assert.deepEqual(s.controls.model.options, ['fake-large', 'fake-small']);
    assert.equal(s.controls.agentMode.available, false, 'this agent listed no modes of its own, so none are offered');
    const r = await set(s.id, { model: 'fake-small', effort: 'low' });
    assert.deepEqual([r.data.session.model, r.data.session.effort, r.data.session.controls.effort.options], ['fake-small', 'low', ['low', 'medium']]);
    assert.deepEqual((await told(s.id)).settings, { model: 'fake-small', effort: 'low', mode: 'default' });
    assert.match((await set(s.id, { agentMode: 'plan' })).data.error, /offers no choice of own mode/);
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('Codex: choices ride on the next turn, and nothing rides that nobody chose', async () => {
    const s0 = await h.start('fake-codex', { name: 'Cody' });
    const s = await waitFor(async () => { const x = await h.session(s0.id); return x.controls.model.options.length ? x : null; }, { what: 'Codex to list its models' });
    assert.deepEqual(s.controls.model.options, ['gpt-fake', 'gpt-fake-mini'], 'both pages of the list, without the model Codex hides');
    assert.deepEqual(s.controls.model.labels, { 'gpt-fake': 'GPT Fake', 'gpt-fake-mini': 'GPT Fake Mini' });
    assert.equal(s.controls.model.free, true, 'Codex takes any model its provider knows, listed or not');
    assert.deepEqual([s.model, s.effort, s.controls.effort.options], ['gpt-fake', 'medium', ['low', 'medium', 'high']], 'the effort shown is that model\'s own default');
    assert.deepEqual([s.agentMode, s.controls.agentMode.options, s.controls.agentMode.applies], ['default', ['default', 'plan'], 'next-turn']);
    assert.deepEqual((await told(s.id)).lastTurn, {}, 'untouched, a turn is its text and nothing else');

    // model and effort
    const m = await set(s.id, { model: 'gpt-fake-mini' });
    assert.deepEqual([m.data.session.model, m.data.session.effort, m.data.session.controls.effort.options], ['gpt-fake-mini', 'low', ['low', 'medium']]);
    assert.match((await set(s.id, { effort: 'high' })).data.error, /effort must be one of low, medium/);
    await set(s.id, { effort: 'medium' });
    assert.deepEqual((await told(s.id)).lastTurn, { model: 'gpt-fake-mini', effort: 'medium' });
    assert.equal((await h.session(s.id)).model, 'gpt-fake-mini', 'and Codex\'s own account of the thread agrees');

    // plan, and back: Codex is told both ways
    await set(s.id, { agentMode: 'plan' });
    assert.deepEqual((await told(s.id)).lastTurn.collaborationMode, { mode: 'plan', settings: { model: 'gpt-fake-mini', reasoning_effort: 'medium' } });
    await set(s.id, { agentMode: 'default' });
    assert.equal((await told(s.id)).lastTurn.collaborationMode.mode, 'default');
    assert.ok((await notices(s.id)).includes('Its own mode set to “Plan” by Lead.'));

    // how freely it acts: its own sandbox enforces it, so it is Codex that is told — loosened, then tightened again
    const full = await set(s.id, { mode: 'full' });
    assert.equal(full.data.session.mode, 'full');
    let carried = (await told(s.id)).lastTurn;
    assert.deepEqual([carried.approvalPolicy, carried.sandboxPolicy], [CODEX_TURN_POLICY.full.approvalPolicy, CODEX_TURN_POLICY.full.sandboxPolicy]);
    await set(s.id, { mode: 'ask' });
    carried = (await told(s.id)).lastTurn;
    assert.deepEqual([carried.approvalPolicy, carried.sandboxPolicy], ['untrusted', { type: 'readOnly' }]);
    assert.equal((await h.session(s.id)).mode, 'ask');
    assert.equal((await h.entry(s.id, 'session')).modeLabel, 'asks before it acts');

    // a change made while a turn runs is the next turn's, and says so
    const n = await h.begin(s.id, 'sleep:150; say:done');
    await set(s.id, { model: 'gpt-fake' });
    await h.turnDone(s.id, n);
    assert.ok((await notices(s.id)).includes('Model set to “GPT Fake” by Lead. It applies from the next turn.'));

    // a model that is not on Codex's list is still Codex's to accept or refuse
    assert.equal((await set(s.id, { model: 'my-own-finetune' })).status, 200);
    assert.equal((await told(s.id)).lastTurn.model, 'my-own-finetune');
    await h.del(`/api/harness/sessions/${s.id}`);

    // chosen before it starts
    const c = await h.start('fake-codex', { model: 'gpt-fake-mini', effort: 'low', agentMode: 'plan', mode: 'edits' });
    const first = (await told(c.id)).lastTurn;
    assert.deepEqual([first.effort, first.collaborationMode.mode, first.model, first.sandboxPolicy], ['low', 'plan', undefined, undefined],
      'effort and plan have no place in thread/start, so the first turn carries them; model and sandbox were given there');
    await h.del(`/api/harness/sessions/${c.id}`);
  });

  await t.test('carrying on with another agent: what was done comes along, and is written down on both sides', async () => {
    const a = await h.start('fake', { name: 'Ada' });
    await h.turn(a.id, 'say:The cart fixture is shared between workers.; tool:npm test -- checkout');
    const before = (await h.get('/api/harness/sessions')).data.sessions.length;

    // a reference to nothing starts nothing
    const bad = await h.post('/api/harness/sessions', { adapter: 'fake-v2', cwd: h.work, context: { session: 'nobody-by-that-name' } });
    assert.equal(bad.status, 400);
    assert.match(bad.data.error, /context can only be carried over from a session the office drives or drove/);
    assert.equal((await h.get('/api/harness/sessions')).data.sessions.length, before);

    const b = (await h.post('/api/harness/sessions', { adapter: 'fake-v2', cwd: h.work, name: 'Bo', context: { session: a.id } })).data.session;
    const handed = await h.entry(b.id, `handoff:${b.id}`);
    assert.deepEqual([handed.kind, handed.direction, handed.fromName, handed.fromSessionId], ['handoff', 'in', 'Ada', a.id]);
    assert.match(handed.text, /^<handoff from="Ada \(gemini\)"[\s\S]*- Assistant: The cart fixture is shared between workers\.[\s\S]*- Command: npm test -- checkout/, 'the exact words handed over are on the record');
    assert.deepEqual([(await h.entry(a.id, `handoff:${b.id}`)).direction, (await h.entry(a.id, `handoff:${b.id}`)).toName], ['out', 'Bo'], 'and the session it came from says where it went');

    // it rides in front of the first thing a person says there — once — and what is shown as their turn is what they typed
    const first = await h.turn(b.id, 'report');
    assert.equal(JSON.parse(first.said).handoffs, 1);
    assert.equal(first.entries.find((e) => e.kind === 'user').text, 'report');
    assert.equal(JSON.parse((await h.turn(b.id, 'report')).said).handoffs, 1, 'not again on the second turn');

    // a session that has ended can still be carried on from: its record is what is read
    await h.del(`/api/harness/sessions/${a.id}`);
    const c = await h.post('/api/harness/sessions', { adapter: 'fake', cwd: h.work, context: { session: a.id, turns: 1 }, text: 'report' });
    assert.equal(c.status, 200);
    const told1 = await waitFor(async () => (await h.turnView(c.data.session.id, 1)).said, { what: 'its first turn' });
    assert.equal(JSON.parse(told1).handoffs, 1, 'and a first turn given with the start carries it too');
    for (const id of [b.id, c.data.session.id]) await h.del(`/api/harness/sessions/${id}`);
  });

  await t.test('Codex: what it reports is believed over what it was asked', async () => {
    // an older Codex lists nothing: a model can still be typed, and nothing else is offered
    const old = await h.start('fake-codex-old');
    assert.deepEqual([old.controls.model.options, old.controls.model.available, old.controls.effort.available], [[], true, false]);
    await h.del(`/api/harness/sessions/${old.id}`);

    // one that does not apply a tighter sandbox must not be shown as if it had
    const s = await h.start('fake-codex-stubborn', { mode: 'full' });
    assert.equal((await set(s.id, { mode: 'ask' })).data.session.mode, 'ask', 'asked for');
    await h.turn(s.id, 'say:hello');
    const now = await waitFor(async () => { const x = await h.session(s.id); return x.mode === 'full' ? x : null; }, { what: 'the office to show what Codex reports' });
    assert.equal(now.modeLabel, 'acts without asking');
    const warned = (await h.entries(s.id)).find((e) => e.kind === 'notice' && e.level === 'warn');
    assert.match(warned.text, /reports that it acts without asking \(“full”\), not “ask” as it was asked\. The office shows what it reports\./);
    await h.del(`/api/harness/sessions/${s.id}`);
  });
});
