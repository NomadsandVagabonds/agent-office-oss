// The waiting inbox (server/waiting.mjs): an agent that is waiting on somebody
// sits on the office instead of on a human. What ends a wait, what does not,
// the guard rails it shares with mail that wakes a driven session, the board
// telling a card's new assignee, and `office wait` as an agent runs it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { ROOT, sleep, startOffice } from './helpers.mjs';

const QUICK = { OFFICE_WAKE_MIN_GAP_MS: '0' };
const join = async (o, name, cwd = '/tmp/t/webstore') => (await o.post('/api/agents/join', { name, provider: 'claude', cwd })).data.agent;
const wait = (o, id, ms = 2500) => o.get(`/api/inbox/wait?agent=${id}&timeoutMs=${ms}`).then((r) => r.data);
const note = (o, from, to, content) => o.post('/api/collab/message', { fromAgentId: from, toAgentId: to, content });
const waitingNow = async (o) => (await o.get('/api/inbox/waiting')).data.waiting.map((w) => w.name);
const until = async (fn, what, ms = 3000) => { const t0 = Date.now(); for (;;) { if (await fn()) return; if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${what}`); await sleep(15); } };

test('waiting on the office: what ends a wait, and what does not', async (t) => {
  const o = await startOffice({ env: QUICK });
  t.after(() => o.stop());
  const ada = await join(o, 'Ada'), bob = await join(o, 'Bob'), cy = await join(o, 'Cy', '/tmp/t/mobile-app');

  await t.test('mail that is already there is handed over at once, and read once', async () => {
    await note(o, bob.id, ada.id, 'Ada, the build is red on main.');
    const t0 = Date.now(), box = await wait(o, ada.id);
    assert.ok(Date.now() - t0 < 500, 'no waiting for what has already arrived');
    assert.deepEqual(box.items.map((m) => [m.kind, m.from, m.text]), [['dm', 'Bob', 'Ada, the build is red on main.']]);
    assert.equal(box.waited, true); assert.equal(box.timedOut, false); assert.equal(box.hop, 1);
    assert.equal((await o.get(`/api/inbox?agent=${ada.id}`)).data.items.length, 0, 'it was marked read');
  });

  await t.test('a wait holds until a direct note comes, and whoever waits is on the list meanwhile', async () => {
    const held = wait(o, ada.id);
    await until(async () => (await waitingNow(o)).includes('Ada'), 'Ada to be waiting');
    const t0 = Date.now();
    await note(o, bob.id, ada.id, 'Green again.');
    const box = await held;
    assert.ok(Date.now() - t0 < 600, 'ended by the note, not by the clock');
    assert.equal(box.items[0].text, 'Green again.');
    assert.deepEqual(await waitingNow(o), []);
  });

  await t.test('a mention ends a wait; other agents\' channel talk does not, and comes along with what does', async () => {
    const held = wait(o, ada.id, 1500);
    await until(async () => (await waitingNow(o)).includes('Ada'), 'Ada to be waiting');
    await o.post('/api/channels/project:webstore/message', { content: 'Rebasing the cart branch.', authorAgentId: bob.id });
    await sleep(250);
    assert.deepEqual(await waitingNow(o), ['Ada'], 'chatter did not wake her');
    await o.post('/api/channels/project:webstore/message', { content: '@Ada can you look at checkout?', authorAgentId: bob.id });
    const box = await held;
    assert.deepEqual(box.items.map((m) => m.kind), ['channel', 'mention']);
  });

  await t.test('a human in your channel ends a wait; a human in somebody else\'s does not', async () => {
    const mine = wait(o, ada.id, 1500), theirs = wait(o, cy.id, 700);
    await until(async () => (await waitingNow(o)).length === 2, 'both to be waiting');
    await o.post('/api/channels/project:webstore/message', { content: 'Freeze at five, please.' });
    const box = await mine;
    assert.equal(box.items[0].fromType, 'human'); assert.equal(box.hop, 0);
    const other = await theirs;
    assert.equal(other.timedOut, true); assert.equal(other.items.length, 0); assert.equal(other.held, null);
  });

  await t.test('a human\'s note to everybody ends every wait', async () => {
    const a = wait(o, ada.id, 1500), c = wait(o, cy.id, 1500);
    await until(async () => (await waitingNow(o)).length === 2, 'both to be waiting');
    await o.post('/api/channels/all/message', { content: 'Lunch is on me.' });
    assert.equal((await a).items[0].text, 'Lunch is on me.');
    assert.equal((await c).items[0].text, 'Lunch is on me.');
  });

  await t.test('nothing comes: the wait ends empty when its time is up, having marked nothing', async () => {
    const t0 = Date.now(), box = await wait(o, ada.id, 300);
    assert.ok(Date.now() - t0 >= 280 && Date.now() - t0 < 1500);
    assert.deepEqual([box.items.length, box.timedOut, box.held], [0, true, null]);
  });

  await t.test('somebody who hangs up is no longer waiting, and their mail is still unread', async () => {
    const req = http.get({ host: '127.0.0.1', port: o.port, path: `/api/inbox/wait?agent=${ada.id}&timeoutMs=20000` });
    req.on('error', () => {});
    await until(async () => (await waitingNow(o)).includes('Ada'), 'Ada to be waiting');
    req.destroy();
    await until(async () => !(await waitingNow(o)).includes('Ada'), 'the office to notice she has gone');
    await note(o, bob.id, ada.id, 'Still there?');
    assert.equal((await o.get(`/api/inbox?agent=${ada.id}`)).data.items.length, 1);
    await o.get(`/api/inbox?agent=${ada.id}&ack=1`);
  });

  await t.test('an agent nobody knows is told so, and a wait is never longer than the office allows', async () => {
    assert.equal((await o.get('/api/inbox/wait?agent=nobody')).status, 404);
    assert.equal((await o.get('/api/inbox/waiting')).data.limits.maxHoldMs, 50_000);
  });
});

test('waiting on the office: the guard rails it shares with mail that wakes', async (t) => {
  await t.test('too many agent-to-agent steps from a human: the mail stays in the inbox and the wait says why', async () => {
    const o = await startOffice({ env: { ...QUICK, OFFICE_WAKE_MAX_HOPS: '1' } });
    t.after(() => o.stop());
    const a = await join(o, 'Ada'), b = await join(o, 'Bob'), c = await join(o, 'Cy');
    await o.post('/api/comms/direct-message', { toAgentId: a.id, content: 'Ada: ask Bob to check the cart.' });
    assert.equal((await wait(o, a.id)).hop, 0, 'the human\'s note');
    await note(o, a.id, b.id, 'Bob, check the cart?');
    assert.equal((await wait(o, b.id)).hop, 1, 'one step from the human: delivered');
    await note(o, b.id, c.id, 'Cy, check the cart?');
    const box = await wait(o, c.id, 400);
    assert.equal(box.items.length, 0);
    assert.equal(box.held.reason, 'hops'); assert.equal(box.held.count, 1); assert.match(box.held.text, /human has to step in/);
    const still = (await o.get(`/api/inbox?agent=${c.id}`)).data;
    assert.equal(still.items[0].text, 'Cy, check the cart?', 'it is where the agent finds it when it looks');
    // …and a human stepping in is all it takes
    await o.post('/api/comms/direct-message', { toAgentId: c.id, content: 'Go ahead, Cy.' });
    assert.deepEqual((await wait(o, c.id)).items.map((m) => m.kind), ['dm', 'lead']);
  });

  await t.test('a budget of pick-ups without a human; a human\'s note is never held and renews it', async () => {
    const o = await startOffice({ env: { ...QUICK, OFFICE_WAKE_BUDGET: '2' } });
    t.after(() => o.stop());
    const a = await join(o, 'Ada'), b = await join(o, 'Bob');
    for (const n of [1, 2]) { await note(o, a.id, b.id, `note ${n}`); assert.equal((await wait(o, b.id)).items[0].text, `note ${n}`); }
    await note(o, a.id, b.id, 'note 3');
    const spent = await wait(o, b.id, 300);
    assert.equal(spent.held.reason, 'budget');
    await o.post('/api/comms/direct-message', { toAgentId: b.id, content: 'Carry on.' });
    assert.deepEqual((await wait(o, b.id)).items.map((m) => m.text), ['note 3', 'Carry on.']);
    await note(o, a.id, b.id, 'note 4');
    assert.equal((await wait(o, b.id)).items[0].text, 'note 4', 'renewed');
  });

  await t.test('a gap between pick-ups: the second note is handed over when the gap has passed', async () => {
    const o = await startOffice({ env: { OFFICE_WAKE_MIN_GAP_MS: '500' } });
    t.after(() => o.stop());
    const a = await join(o, 'Ada'), b = await join(o, 'Bob');
    await note(o, a.id, b.id, 'one');
    await wait(o, b.id);
    const t0 = Date.now();
    await note(o, a.id, b.id, 'two');
    const box = await wait(o, b.id, 3000);
    assert.equal(box.items[0].text, 'two');
    assert.ok(Date.now() - t0 >= 380, `held for the gap (${Date.now() - t0} ms)`);
  });

  await t.test('so many an hour', async () => {
    const o = await startOffice({ env: { ...QUICK, OFFICE_WAKE_MAX_PER_HOUR: '1' } });
    t.after(() => o.stop());
    const a = await join(o, 'Ada'), b = await join(o, 'Bob');
    await note(o, a.id, b.id, 'one'); await wait(o, b.id);
    await note(o, a.id, b.id, 'two');
    assert.equal((await wait(o, b.id, 300)).held.reason, 'rate');
  });

  await t.test('the human\'s pause stops pick-ups, and lifting it lets a wait in progress go', async () => {
    const o = await startOffice({ env: QUICK });
    t.after(() => o.stop());
    const a = await join(o, 'Ada'), b = await join(o, 'Bob');
    assert.equal((await o.post('/api/harness/wake', { paused: true })).data.paused, true);
    await note(o, a.id, b.id, 'held by the switch');
    assert.equal((await wait(o, b.id, 300)).held.reason, 'paused');
    const held = wait(o, b.id, 3000);
    await until(async () => (await waitingNow(o)).includes('Bob'), 'Bob to be waiting');
    await o.post('/api/harness/wake', { paused: false });
    assert.equal((await held).items[0].text, 'held by the switch');
  });

  await t.test('switched off for the whole office', async () => {
    const o = await startOffice({ env: { OFFICE_WAIT: '0' } });
    t.after(() => o.stop());
    const a = await join(o, 'Ada');
    const box = await wait(o, a.id, 5000);
    assert.equal(box.off, true); assert.equal(box.items.length, 0);
  });
});

test('the board tells whoever a card is given to', async (t) => {
  const o = await startOffice({ env: QUICK });
  t.after(() => o.stop());
  const ada = await join(o, 'Ada'), bob = await join(o, 'Bob');
  const unread = async (id) => (await o.get(`/api/inbox?agent=${id}&ack=1`)).data.items;

  await t.test('from a teammate it is a direct note from them, and it ends a wait', async () => {
    const held = wait(o, ada.id);
    await until(async () => (await waitingNow(o)).includes('Ada'), 'Ada to be waiting');
    const made = (await o.post('/api/tasks', { title: 'Fix the red build', body: 'main is failing on the cart test', assignee: ada.id, authorAgentId: bob.id })).data;
    assert.deepEqual([made.told.to, made.told.toName], [ada.id, 'Ada']);
    const box = await held;
    assert.deepEqual([box.items[0].kind, box.items[0].from], ['dm', 'Bob']);
    assert.match(box.items[0].text, /^\[Board\] “Fix the red build” is yours now \(todo, Webstore\)\.\nmain is failing on the cart test\nCard t_\w+\. When you start: office task move t_\w+ doing/);
  });

  await t.test('from the human it is the human talking', async () => {
    const made = (await o.post('/api/tasks', { title: 'Write the release note', assignee: bob.id })).data;
    assert.equal(made.told.to, bob.id);
    const [m] = await unread(bob.id);
    assert.deepEqual([m.kind, m.fromType, m.hop], ['lead', 'human', 0]);
  });

  await t.test('giving an existing card away tells its new owner, once', async () => {
    const card = (await o.post('/api/tasks', { title: 'Tidy the fixtures', authorAgentId: bob.id })).data.task;
    assert.equal((await unread(ada.id)).length, 0, 'nobody was given it yet');
    assert.equal((await o.patch(`/api/tasks/${card.id}`, { assignee: ada.id, authorAgentId: bob.id })).data.told.to, ada.id);
    assert.equal((await unread(ada.id)).length, 1);
    assert.equal((await o.patch(`/api/tasks/${card.id}`, { status: 'doing', authorAgentId: bob.id })).data.told, undefined, 'moving it tells nobody again');
    assert.equal((await o.patch(`/api/tasks/${card.id}`, { assignee: ada.id, authorAgentId: bob.id })).data.told, undefined, 'it was hers already');
    assert.equal((await unread(ada.id)).length, 0);
  });

  await t.test('nobody is told of a card they took themselves, or when the request says to keep quiet', async () => {
    assert.equal((await o.post('/api/tasks', { title: 'Mine', assignee: ada.id, authorAgentId: ada.id })).data.told, undefined);
    assert.equal((await o.post('/api/tasks', { title: 'Imported', assignee: ada.id, authorAgentId: bob.id, notify: false })).data.told, undefined);
    assert.equal((await unread(ada.id)).length, 0);
  });

  await t.test('OFFICE_TASK_MAIL=0 keeps the board quiet altogether', async () => {
    const quiet = await startOffice({ env: { ...QUICK, OFFICE_TASK_MAIL: '0' } });
    t.after(() => quiet.stop());
    const a = await join(quiet, 'Ada'), b = await join(quiet, 'Bob');
    assert.equal((await quiet.post('/api/tasks', { title: 'Quietly', assignee: a.id, authorAgentId: b.id })).data.told, undefined);
    assert.equal((await quiet.get(`/api/inbox?agent=${a.id}`)).data.items.length, 0);
  });
});

test('office wait, as an agent runs it', async (t) => {
  const o = await startOffice({ env: QUICK });
  t.after(() => o.stop());
  const ada = await join(o, 'Ada'), bob = await join(o, 'Bob');
  const env = (id) => ({ ...process.env, OFFICE_PORT: String(o.port), OFFICE_URL: '', OFFICE_TOKEN: '', OFFICE_SESSION_TOKEN: '', OFFICE_AGENT_ID: id,
    CLAUDE_CODE_SESSION_ID: '', CLAUDE_SESSION_ID: '', CODEX_THREAD_ID: '', CLAUDECODE: '', HOME: o.dir });
  const office = (id, ...args) => new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'office.mjs'), ...args], { cwd: o.dir, env: env(id), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });

  await t.test('it prints the mail that ended the wait, and that mail is read', async () => {
    const run = office(ada.id, 'wait', '20');
    await until(async () => (await waitingNow(o)).includes('Ada'), 'Ada to be waiting', 8000);
    await note(o, bob.id, ada.id, 'Your review is in.\nTwo findings.');
    const r = await run;
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /^mail — 1 new \(1 direct\)\n\n {2}.+ · DM · Bob\n {4}Your review is in\.\n {4}Two findings\.$/);
    assert.equal((await o.get(`/api/inbox?agent=${ada.id}`)).data.items.length, 0);
  });

  await t.test('with nothing to read it says so, and how to keep waiting', async () => {
    const r = await office(ada.id, 'wait', '1');
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /^wait: nothing for you in 1 s\. Run it again to keep waiting\.$/);
  });

  await t.test('--json gives what the office gave', async () => {
    await note(o, bob.id, ada.id, 'One more.');
    const r = await office(ada.id, 'wait', '5', '--json');
    assert.equal(JSON.parse(r.out).items[0].text, 'One more.');
  });
});
