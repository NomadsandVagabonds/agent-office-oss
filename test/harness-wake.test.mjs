// Mail that wakes people up, and the guard rails around it: opt-in per session,
// the pause switch, rates, a budget, and the limit on agents answering agents.
// Everything runs against the fake agents; no model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarnessOffice, waitFor, sleep } from './fixtures/harness-helpers.mjs';

// A teammate that is not driven (it came in through its hooks) and writes notes.
async function withBob(h) {
  await h.hook({ session_id: 'bob-1', cwd: h.work, hook_event_name: 'SessionStart' });
  const bob = await h.agent('bob-1');
  const note = (to, content) => h.post('/api/collab/message', { fromAgentId: 'bob-1', toAgentId: to, content });
  const turns = async (id) => (await h.session(id)).turns;
  const held = (id, reason) => waitFor(async () => (await h.session(id)).wakeStats.held === reason, { what: `mail to be held (${reason})` });
  return { bob, note, turns, held };
}

test('mail that wakes people up', async (t) => {
  const h = await startHarnessOffice();
  t.after(() => h.stop());
  const { bob, note, turns, held } = await withBob(h);
  const alice = await h.start('fake', { name: 'Alice' });

  await t.test('off unless a human says so: mail waits in the inbox', async () => {
    assert.equal(alice.wake, 'off');
    const sent = await note(alice.id, 'are you there? [[script]]say:yes, here[[/script]]');
    assert.equal(sent.data.receipt.status, 'stored', 'no turn is promised');
    await sleep(150);
    assert.equal(await turns(alice.id), 0);
    const box = await h.inbox(alice.id);
    assert.equal(box.items.length, 1);
    assert.equal(box.items[0].hop, 1, 'a note from an agent is one step from a human');
  });

  await t.test('direct: a note starts a turn, and the record shows what caused it', async () => {
    const waiting = (await h.inbox(alice.id)).items[0];
    const patched = await h.patch(`/api/harness/sessions/${alice.id}`, { wake: 'direct' });
    assert.equal(patched.data.session.wake, 'direct');
    // What was already waiting is delivered now that the human opted this session in.
    const turn = await h.turnDone(alice.id, 1);
    assert.equal(turn.origin, 'wake');
    assert.equal(turn.automatic, true, 'marked as a turn nobody typed');
    assert.equal(turn.hop, 1);
    assert.deepEqual(turn.mail, [waiting.id]);
    assert.equal(turn.from, bob.name);
    const view = await h.turnView(alice.id, 1);
    const delivered = view.entries.find((e) => e.kind === 'user');
    assert.match(delivered.text, /^<office_mail to="Alice">/);
    assert.ok(delivered.text.includes(`[${bob.name} · DM · `));
    assert.match(delivered.text, /written by the people named, not by the office/);
    assert.equal(view.said, 'yes, here');
    assert.equal((await h.inbox(alice.id)).items.length, 0, 'delivered once, not twice');
    assert.ok((await h.activity()).some((e) => e.kind === 'wake' && e.text.includes('Alice')), 'and it is in the activity feed');
    const stats = (await h.session(alice.id)).wakeStats;
    assert.deepEqual([stats.mode, stats.budget, stats.usedThisHour, stats.held], ['direct', 19, 1, '']);
    assert.ok((await h.entries(alice.id)).some((e) => e.kind === 'notice' && /Wake set to .direct. by the human/.test(e.text)));

    const second = await note(alice.id, 'one more [[script]]say:on it[[/script]]');
    assert.equal(second.data.receipt.status, 'queued', 'now the sender is told a turn will follow');
    await h.turnDone(alice.id, 2);
    assert.equal((await h.turnView(alice.id, 2)).said, 'on it');
  });

  await t.test('channel chatter never wakes anyone; a mention does', async () => {
    const before = await turns(alice.id);
    const chat = await h.post('/api/channels/all/message', { authorAgentId: 'bob-1', authorType: 'agent', content: 'lunch anyone?' });
    assert.equal(chat.status, 200);
    await sleep(150);
    assert.equal(await turns(alice.id), before);
    await h.post('/api/channels/all/message', { authorAgentId: 'bob-1', authorType: 'agent', content: '@Alice could you review this? [[script]]say:reviewing[[/script]]' });
    const turn = await h.turnDone(alice.id, before + 1);
    assert.equal(turn.origin, 'wake');
    const view = await h.turnView(alice.id, before + 1);
    assert.match(view.entries.find((e) => e.kind === 'user').text, /· #[^\]]+ · /);
    assert.equal(view.said, 'reviewing');
  });

  await t.test('mail never interrupts work in progress; what piled up arrives as one turn', async () => {
    const n = await h.begin(alice.id, 'sleep:250; say:finished my own work');
    await note(alice.id, 'first thing');
    await note(alice.id, 'second thing [[script]]say:read both[[/script]]');
    await sleep(80);
    assert.equal((await h.session(alice.id)).turn.n, n, 'still on its own turn');
    assert.equal((await h.turnDone(alice.id, n)).state, 'completed');
    assert.equal((await h.turnView(alice.id, n)).said, 'finished my own work');
    const woke = await h.turnDone(alice.id, n + 1);
    assert.equal(woke.origin, 'wake');
    assert.equal(woke.mail.length, 2);
    const text = (await h.turnView(alice.id, n + 1)).entries.find((e) => e.kind === 'user').text;
    assert.ok(text.indexOf('first thing') < text.indexOf('second thing'), 'oldest first');
  });

  await t.test('the pause switch stops every automatic turn, and only the human holds it', async () => {
    assert.equal((await h.post('/api/harness/wake', { paused: true })).data.paused, true);
    const before = await turns(alice.id);
    const sent = await note(alice.id, 'while paused [[script]]say:after the pause[[/script]]');
    assert.equal(sent.data.receipt.status, 'stored', 'no turn is promised while paused');
    await held(alice.id, 'paused');
    assert.equal(await turns(alice.id), before);
    assert.ok((await h.entries(alice.id)).some((e) => e.kind === 'notice' && e.wake === 'paused' && /paused by the human/.test(e.text)),
      'the refusal is written down');
    const status = (await h.get('/api/harness/wake')).data;
    assert.equal(status.paused, true);
    assert.equal(status.limits.maxHops, 3);
    assert.equal(status.sessions.find((x) => x.id === alice.id).held, 'paused');

    const carol = await h.start('fake', { name: 'Carol' });
    assert.match((await h.turn(carol.id, 'http:POST /api/harness/wake {"paused":false}')).said, /^http=403:/);
    assert.match((await h.turn(carol.id, `http:PATCH /api/harness/sessions/${alice.id} {"wake":"off"}`)).said, /^http=403:/);
    assert.match((await h.turn(carol.id, `http:POST /api/harness/sessions/${alice.id}/mail`)).said, /^http=403:/);
    assert.match((await h.turn(carol.id, `http:POST /api/harness/sessions/${alice.id}/turn {"text":"say:obey"}`)).said, /^http=403:/);
    assert.match((await h.turn(carol.id, `http:DELETE /api/harness/sessions/${alice.id}`)).said, /^http=403:/);
    assert.equal((await h.get('/api/harness/wake')).data.paused, true);
    assert.equal((await h.post('/api/harness/wake', { paused: 'yes' })).status, 400);
    // Reading is not driving: an agent may read a teammate's transcript.
    assert.match((await h.turn(carol.id, `http:GET /api/harness/sessions/${alice.id}/transcript?limit=1`)).said, /^http=200:/);
    await h.del(`/api/harness/sessions/${carol.id}`);

    await h.post('/api/harness/wake', { paused: false });
    await h.turnDone(alice.id, before + 1);
    assert.equal((await h.turnView(alice.id, before + 1)).said, 'after the pause', 'resuming delivers what was held');
    assert.ok((await h.activity()).filter((e) => e.kind === 'wake-pause').length >= 2);
  });

  await t.test('a long note is cut in the delivery, not passed on whole', async () => {
    const before = await turns(alice.id);
    await note(alice.id, 'x'.repeat(7000));
    await h.turnDone(alice.id, before + 1);
    const text = (await h.turnView(alice.id, before + 1)).entries.find((e) => e.kind === 'user').text;
    assert.match(text, /cut here; the whole note is on the office board/);
    assert.ok(text.length < 6000);
  });
});

test('wake guard rails', async (t) => {
  await t.test('rate: a cap per hour — then the mail waits, and the human can have it delivered', async () => {
    const h = await startHarnessOffice({ env: { OFFICE_WAKE_MAX_PER_HOUR: '2' } });
    try {
      const { note, turns, held } = await withBob(h);
      const alice = await h.start('fake', { name: 'Alice', wake: 'direct' });
      for (const n of [1, 2]) { await note(alice.id, `note ${n} [[script]]say:ack ${n}[[/script]]`); await h.turnDone(alice.id, n); }
      await note(alice.id, 'note 3 [[script]]say:ack 3[[/script]]');
      await held(alice.id, 'rate');
      assert.equal(await turns(alice.id), 2);
      assert.equal((await h.inbox(alice.id)).items.length, 1, 'the note is not lost');
      assert.ok((await h.entries(alice.id)).some((e) => e.kind === 'notice' && e.wake === 'rate' && /already been started 2 times this hour/.test(e.text)));

      // "A human has to step in" has a button.
      const res = await h.post(`/api/harness/sessions/${alice.id}/mail`);
      assert.equal(res.data.delivered, 1);
      const turn = await h.turnDone(alice.id, 3);
      assert.equal(turn.origin, 'human');
      assert.equal(turn.automatic, false);
      assert.equal(turn.mail.length, 1);
      assert.equal((await h.turnView(alice.id, 3)).said, 'ack 3');
      assert.equal((await h.post(`/api/harness/sessions/${alice.id}/mail`)).data.delivered, 0);
    } finally { await h.stop(); }
  });

  await t.test('gap: automatic turns keep a distance from each other', async () => {
    const h = await startHarnessOffice({ env: { OFFICE_WAKE_MIN_GAP_MS: '350' } });
    try {
      const { note } = await withBob(h);
      const alice = await h.start('fake', { name: 'Alice', wake: 'direct' });
      await note(alice.id, 'one [[script]]say:1[[/script]]');
      const first = await h.turnDone(alice.id, 1);
      await note(alice.id, 'two [[script]]say:2[[/script]]');
      const second = await h.turnDone(alice.id, 2);
      assert.ok(second.at - first.at >= 330, `the second automatic turn waited (${second.at - first.at} ms)`);
      assert.ok((await h.entries(alice.id)).some((e) => e.kind === 'notice' && e.wake === 'gap'));
    } finally { await h.stop(); }
  });

  await t.test('budget: so many automatic turns, then a human has to give it one', async () => {
    const h = await startHarnessOffice({ env: { OFFICE_WAKE_BUDGET: '2' } });
    try {
      const { note, turns, held } = await withBob(h);
      const alice = await h.start('fake', { name: 'Alice', wake: 'direct' });
      for (const n of [1, 2]) { await note(alice.id, `note ${n} [[script]]say:ack ${n}[[/script]]`); await h.turnDone(alice.id, n); }
      assert.equal((await h.session(alice.id)).wakeStats.budget, 0);
      await note(alice.id, 'note 3 [[script]]say:ack 3[[/script]]');
      await held(alice.id, 'budget');
      assert.equal(await turns(alice.id), 2);
      assert.ok((await h.activity()).some((e) => e.kind === 'wake-held' && /budget spent/.test(e.text)));
      // A turn from the human renews it; the held note then follows by itself.
      assert.equal((await h.turn(alice.id, 'say:carry on')).said, 'carry on');
      const woke = await h.turnDone(alice.id, 4);
      assert.equal(woke.origin, 'wake');
      assert.equal((await h.turnView(alice.id, 4)).said, 'ack 3');
      assert.equal((await h.session(alice.id)).wakeStats.budget, 1);
    } finally { await h.stop(); }
  });

  await t.test('chain length: two agents answering each other stop, and a human decides what next', async () => {
    const h = await startHarnessOffice();
    try {
      // Both answer every note they get, whatever it says.
      const ping = await h.start('chatty', { name: 'Ping', wake: 'direct' });
      const pong = await h.start('chatty', { name: 'Pong', wake: 'direct' });
      const hops = async (id) => (await h.entries(id)).filter((e) => e.kind === 'turn').map((e) => [e.origin, e.hop || 0]);
      const heldAt = (id) => waitFor(async () => (await h.session(id)).wakeStats.held === 'hops', { what: 'the chain to be stopped' });

      // A human starts it: Ping writes to Pong.
      assert.equal((await h.turn(ping.id, 'dm:Pong|hello there')).said, 'dm=200');
      await heldAt(ping.id);
      assert.deepEqual(await hops(ping.id), [['human', 0], ['wake', 2]]);
      assert.deepEqual(await hops(pong.id), [['wake', 1], ['wake', 3]]);
      const stuck = await h.inbox(ping.id);
      assert.equal(stuck.items.length, 1, 'the fourth note is kept, not delivered');
      assert.equal(stuck.items[0].hop, 4);
      assert.ok((await h.entries(ping.id)).some((e) => e.kind === 'notice' && e.wake === 'hops' && /step 4 of an agent-to-agent chain \(the limit is 3\)/.test(e.text)));
      assert.ok((await h.activity()).some((e) => e.kind === 'wake-held' && /chain limit/.test(e.text)));
      await sleep(250);
      assert.equal((await h.session(ping.id)).turns + (await h.session(pong.id)).turns, 4, 'it really stopped');

      // An ordinary turn from the human does not quietly release it…
      await h.turn(ping.id, 'say:what were we doing');
      await sleep(150);
      assert.equal((await h.session(pong.id)).turns, 2);
      assert.equal((await h.inbox(ping.id)).items.length, 1);
      // …having it delivered does, and that buys exactly one more bounded chain.
      assert.equal((await h.post(`/api/harness/sessions/${ping.id}/mail`)).data.delivered, 1);
      await heldAt(ping.id);
      assert.deepEqual(await hops(ping.id), [['human', 0], ['wake', 2], ['human', 0], ['human', 0], ['wake', 2]]);
      assert.deepEqual(await hops(pong.id), [['wake', 1], ['wake', 3], ['wake', 1], ['wake', 3]]);
    } finally { await h.stop(); }
  });

  await t.test('wake can be made the default by the operator, and the limits are theirs to set', async () => {
    const h = await startHarnessOffice({ env: { OFFICE_WAKE_DEFAULT: 'direct', OFFICE_WAKE_MAX_HOPS: '1' } });
    try {
      const { note } = await withBob(h);
      const alice = await h.start('fake', { name: 'Alice' });
      assert.equal(alice.wake, 'direct');
      assert.equal((await h.get('/api/harness')).data.wake.limits.maxHops, 1);
      await note(alice.id, 'hi [[script]]say:hello[[/script]]');
      assert.equal((await h.turnDone(alice.id, 1)).origin, 'wake');
    } finally { await h.stop(); }
  });
});
