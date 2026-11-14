// Driven sessions, end to end: a real office starting real child processes —
// the fake agents in test/fixtures, which speak ACP from the agent's side — and
// driving them the way the browser and the CLI do. No model is ever called.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startHarnessOffice, waitFor, sleep, ADAPTERS } from './fixtures/harness-helpers.mjs';
import { tempDir } from './helpers.mjs';

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

test('driven sessions', async (t) => {
  const h = await startHarnessOffice();
  t.after(() => h.stop());

  await t.test('the catalog says what can be started here, and nothing on the wire can add to it', async () => {
    const cat = (await h.get('/api/harness')).data;
    assert.equal(cat.enabled, true);
    assert.deepEqual(cat.catalogErrors, []);
    const fake = cat.adapters.find((a) => a.id === 'fake');
    const claude = cat.adapters.find((a) => a.id === 'claude');
    assert.equal(fake.available, true);
    assert.equal(fake.caps.spawn, true);
    assert.equal(fake.caps.nativeSandbox, false);
    assert.equal(cat.adapters.find((a) => a.id === 'fake-codex').caps.nativeSandbox, true);
    assert.equal(claude.available, false, 'an agent that is not installed is listed as such');
    assert.equal(claude.caps.spawn, false);

    const missing = await h.post('/api/harness/sessions', { adapter: 'claude', cwd: h.work });
    assert.equal(missing.status, 409);
    assert.match(missing.data.error, /not installed/);
    assert.equal((await h.post('/api/harness/sessions', { adapter: 'nope', cwd: h.work })).status, 404);
    assert.equal((await h.post('/api/harness/sessions', { adapter: 'fake', cwd: path.join(h.work, 'no-such-folder') })).status, 400);
    assert.equal((await h.post('/api/harness/sessions', { adapter: 'fake', cwd: h.work, mode: 'yolo' })).status, 400);
    assert.equal((await h.post('/api/harness/sessions', { adapter: 'fake', cwd: h.work, wake: 'always' })).status, 400);

    // A request names an adapter; it can never supply the program to run.
    const marker = path.join(h.work, 'pwned');
    const sneaky = await h.post('/api/harness/sessions', { adapter: 'fake', cwd: h.work, command: 'touch', args: [marker], env: { X: '1' } });
    assert.equal(sneaky.status, 200);
    assert.equal(sneaky.data.session.adapter, 'fake');
    assert.equal(fs.existsSync(marker), false);
    await h.del(`/api/harness/sessions/${sneaky.data.session.id}`);

    // Starting a process is for this machine only, like the terminal endpoints.
    const evil = await fetch(h.base + '/api/harness/sessions', { method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'text/plain' }, body: JSON.stringify({ adapter: 'fake' }) });
    assert.equal(evil.status, 403);
    assert.equal((await h.get('/api/health')).data.drivenSessions, 0);
  });

  await t.test('a session shows up as an agent, with a desk and honest capabilities', async () => {
    const s = await h.start('fake', { name: 'Ada' });
    assert.match(s.id, /^d_[a-f0-9]{12}$/);
    assert.equal(s.agentId, s.id, 'the office id is the agent id');
    assert.equal(s.nativeRef, 'fake-session-1', 'the provider\'s own id is kept only as a reference');
    assert.equal(s.protocol, 'acp/1');
    assert.equal(s.state, 'idle');
    assert.equal(s.mode, 'ask');
    assert.equal(s.wake, 'off', 'nobody is woken by mail unless a human says so');
    assert.deepEqual(s.caps, { observe: true, prompt: true, control: true, spawn: true });
    // What can be done with it, and the call for each: nothing here depends on which agent it is.
    const at = `/api/harness/sessions/${s.id}`;
    assert.deepEqual(s.controls, {
      transcript: { method: 'GET', url: `${at}/transcript`, query: ['after', 'limit'], watch: { type: 'transcript:watch', sessionId: s.id } },
      turn: { method: 'POST', url: `${at}/turn`, body: { text: '' }, available: true },
      interrupt: { method: 'POST', url: `${at}/interrupt`, available: false },
      end: { method: 'DELETE', url: at, available: true },
      wake: { method: 'PATCH', url: at, field: 'wake', value: 'off', options: ['off', 'results', 'direct'], available: true },
      mode: { method: 'PATCH', url: at, field: 'mode', value: 'ask', options: ['ask', 'edits', 'full'], available: true },
      deliverMail: { method: 'POST', url: `${at}/mail`, available: true },
    });

    const a = await h.agent(s.id);
    assert.equal(a.name, 'Ada');
    assert.deepEqual(a.runtime.links, { session: at, transcript: `${at}/transcript` }, 'the agent itself says where its session is');
    assert.equal(a.driven, true);
    assert.equal(a.provider, 'gemini');
    assert.equal(a.model, 'fake-large');
    assert.ok(Number.isInteger(a.desk) && a.desk >= 0, 'it has a desk like anyone else');
    assert.ok(a.persona, 'and a persona');
    assert.equal(a.runtime.kind, 'driven');
    assert.equal(a.runtime.caps.control, true, 'control is real here: the office holds the process');
    assert.deepEqual(a.runtime.promptActions, ['reply']);
    assert.ok((await h.get('/api/agents')).data.some((x) => x.id === s.id));
    assert.equal((await h.get('/api/harness/sessions/Ada')).data.session.id, s.id, 'a session answers to its agent\'s name');
    assert.equal((await h.get('/api/health')).data.drivenSessions, 1);
    assert.ok((await h.get('/api/harness/sessions')).data.sessions.some((x) => x.id === s.id));
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('a turn streams and lands in the transcript', async () => {
    const s = await h.start('fake', { name: 'Grace' });
    const files = [];
    const onFile = (e) => files.push(e);
    h.ctx.bus.on('agent:file', onFile);
    const t1 = await h.turn(s.id, 'say:hello there; think:let me look; tool:ls -la; edit:src/a.js; read:README.md; plan:one|two; usage:1200/200000; say:all done');
    h.ctx.bus.off('agent:file', onFile);

    assert.equal(t1.turn.state, 'completed');
    assert.equal(t1.turn.stopReason, 'end_turn');
    assert.equal(t1.turn.origin, 'human');
    assert.equal(t1.turn.automatic, false);
    assert.equal(t1.turn.tools, 3);
    assert.ok(t1.turn.durationMs >= 0);
    assert.equal(t1.entries.find((e) => e.kind === 'user').text, 'say:hello there; think:let me look; tool:ls -la; edit:src/a.js; read:README.md; plan:one|two; usage:1200/200000; say:all done');
    // A reply is one item until something else happens; the next text is a new item.
    assert.deepEqual(t1.entries.filter((e) => e.kind === 'message').map((e) => e.text), ['hello there', 'all done']);
    assert.ok(t1.entries.filter((e) => e.kind === 'message').every((e) => e.streaming === false));
    assert.equal(t1.entries.find((e) => e.kind === 'thought').text, 'let me look');
    const tools = t1.entries.filter((e) => e.kind === 'tool');
    assert.deepEqual(tools.map((e) => [e.toolKind, e.name, e.status]), [['execute', 'Shell', 'completed'], ['edit', 'Edit', 'completed'], ['read', 'Read', 'completed']]);
    assert.equal(tools[0].command, 'ls -la');
    assert.match(tools[0].output, /ran: ls -la/);
    assert.deepEqual(tools[1].paths, ['src/a.js']);
    assert.deepEqual(t1.entries.find((e) => e.kind === 'plan').entries, [{ text: 'one', status: 'running' }, { text: 'two', status: 'pending' }]);
    const usage = await h.entry(s.id, 'usage');
    assert.equal(usage.used, 1200);
    assert.equal(usage.size, 200000);

    // The agent's facets are driven from the same stream — no hooks involved.
    const a = await h.agent(s.id);
    assert.equal(a.status, 'done');
    assert.equal(a.turn, 'idle');
    assert.equal(a.contextPct, 1);
    assert.equal(a.toolCount, 3);
    // …and the files it touched are announced for the workspace layer.
    assert.deepEqual(files.map((f) => [f.id, f.path, f.kind, f.tool]), [[s.id, 'src/a.js', 'edit', 'Edit'], [s.id, 'README.md', 'read', 'Read']]);

    // Reading: revisions are numbered, so "what changed since" is one query.
    const all = (await h.get(`/api/harness/sessions/${s.id}/transcript`)).data;
    assert.equal(all.live, true);
    assert.ok(all.entries.every((e, i) => i === 0 || e.at >= all.entries[i - 1].at));
    const t2 = await h.turn(s.id, 'say:second');
    const since = (await h.get(`/api/harness/sessions/${s.id}/transcript?after=${all.seq}`)).data;
    assert.ok(since.entries.length >= 3);
    assert.ok(since.entries.every((e) => e.seq > all.seq));
    assert.ok(since.entries.some((e) => e.id === `turn-${t2.n}` && e.state === 'completed'));
    assert.equal((await h.get(`/api/harness/sessions/${s.id}/transcript?limit=2`)).data.entries.length, 2);
    assert.equal((await h.get('/api/harness/sessions/d_000000000000/transcript')).status, 404);
    assert.equal((await h.get('/api/harness/sessions/..%2f..%2fetc%2fpasswd/transcript')).status, 404);
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('the agent is told where it is on its first turn, and given the office tools', async () => {
    const s = await h.start('fake', { name: 'Hedy' });
    const first = JSON.parse((await h.turn(s.id, 'report')).said);
    assert.equal(first.protocolVersion, 1, 'ACP v1 is what we ask for');
    assert.equal(first.clientInfo.name, 'the-office');
    assert.deepEqual(first.clientCapabilities, { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      'we offer no file or terminal access through the client side');
    assert.equal(first.cwd, h.work);
    assert.deepEqual(first.mcp, ['office'], 'the office MCP server is injected');
    assert.deepEqual(first.office, { url: true, agentId: s.id, token: true });
    assert.equal(first.framed, 1, 'the first request is framed with where the agent is');
    const second = JSON.parse((await h.turn(s.id, 'report')).said);
    assert.equal(second.prompts, 2);
    assert.equal(second.framed, 1, 'later requests are passed through as they are');
    // What a person reads in the transcript is what they typed, not the framing.
    assert.equal((await h.entry(s.id, 'turn-1:user')).text, 'report');
    // The token it was given identifies it to the office; it never comes back out of the office's own records.
    const token = h.ctx.harness.session(s.id).adapter.opt.env.OFFICE_SESSION_TOKEN;
    assert.ok(token.length >= 40);
    const leaked = await h.turn(s.id, 'leak');
    assert.equal(leaked.said, 'my token is [office session token]');
    assert.equal(leaked.entries.find((e) => e.kind === 'tool').command, 'curl -H "x-office-session: [office session token]" localhost');
    assert.ok(!JSON.stringify(await h.entries(s.id)).includes(token));
    await h.del(`/api/harness/sessions/${s.id}`);
    const onDisk = await waitFor(() => { try { return fs.readFileSync(path.join(h.dir, 'harness', `${s.id}.jsonl`), 'utf8'); } catch { return ''; } },
      { what: 'the transcript file' });
    assert.ok(onDisk.includes('my token is [office session token]') && !onDisk.includes(token));

    const plain = await startHarnessOffice({ env: { OFFICE_HARNESS_MCP: '0', OFFICE_HARNESS_TRACE: '1' } });
    try {
      const p = await plain.start('fake');
      const told = JSON.parse((await plain.turn(p.id, 'report')).said);
      assert.deepEqual(told.mcp, [], 'OFFICE_HARNESS_MCP=0 keeps the office tools out');
      assert.equal(p.features.officeTools, false);
    } finally { await plain.stop(); }

    // OFFICE_HARNESS_TRACE=1 keeps the raw frames beside the transcript, for comparing a real agent with what
    // the adapter expects — everything the agent saw, except its token.
    const traced = await startHarnessOffice({ env: { OFFICE_HARNESS_TRACE: '1' } });
    try {
      const p = await traced.start('fake');
      await traced.turn(p.id, 'say:traced');
      const secret = traced.ctx.harness.session(p.id).adapter.opt.env.OFFICE_SESSION_TOKEN;
      const frames = await waitFor(() => { try { return fs.readFileSync(path.join(traced.dir, 'harness', `${p.id}.trace.jsonl`), 'utf8'); } catch { return ''; } },
        { what: 'the trace file' });
      const rows = frames.trim().split('\n').map((r) => JSON.parse(r));
      assert.deepEqual([rows[0].dir, JSON.parse(rows[0].frame).method], ['out', 'initialize']);
      assert.ok(rows.some((r) => r.dir === 'in' && r.frame.includes('agent_message_chunk')));
      assert.ok(frames.includes('OFFICE_SESSION_TOKEN') && !frames.includes(secret));
      assert.ok(frames.includes('[office session token]'));
    } finally { await traced.stop(); }
  });

  await t.test('a permission request becomes a NEEDS-YOU card, and each answer resolves it the right way', async (t2) => {
    const s = await h.start('fake', { name: 'Linus' });

    await t2.test('allow once', async () => {
      const n = await h.begin(s.id, 'ask:rm -rf build');
      const card = await h.need(s.id);
      assert.equal(card.kind, 'permission');
      assert.equal(card.message, 'Wants to run: rm -rf build');
      assert.deepEqual(card.actions, ['once', 'always', 'reject']);
      assert.equal(card.request.command, 'rm -rf build');
      assert.equal(card.request.category, 'command');
      // What is asked and how to answer it are spelled out, so a client needs no knowledge of the runtime.
      assert.deepEqual(card.ask, { summary: 'Wants to run: rm -rf build', tool: 'Shell', toolKind: 'execute', command: 'rm -rf build',
        files: [], detail: '', category: 'command', questions: [] });
      assert.deepEqual(card.respond, { method: 'POST', url: `/api/prompts/${card.id}/reply`, textField: 'text', reaches: 'agent', humanOnly: true, thisMachineOnly: true,
        actions: [
          { id: 'once', kind: 'allow-once', label: 'Allow once', text: 'optional', body: { action: 'once' } },
          { id: 'always', kind: 'allow-session', label: 'Allow commands for this session', text: 'optional', body: { action: 'always' }, scope: 'session', covers: 'command' },
          { id: 'reject', kind: 'reject', label: 'Reject', text: 'optional', body: { action: 'reject' } },
        ] });
      assert.deepEqual(card.request.choices.map((c) => c.action), ['once', 'always', 'reject']);
      assert.deepEqual(card.request.options.map((o) => o.id), ['allow-once', 'allow-always', 'reject-once']);
      const blocked = await h.agent(s.id);
      assert.equal(blocked.status, 'blocked');
      assert.equal(blocked.blockKind, 'permission');
      assert.equal((await h.session(s.id)).state, 'waiting');
      assert.equal((await h.entry(s.id, 'perm:' + card.request.id)).state, 'asked');

      // The answer is the action's own body, posted to the prompt's own URL.
      const once = card.respond.actions.find((a) => a.kind === 'allow-once');
      const res = await h.post(card.respond.url, once.body);
      assert.equal(res.status, 200);
      assert.equal(res.data.answered, 'allowed');
      assert.equal(res.data.prompt.status, 'resolved');
      assert.deepEqual(res.data.prompt.actions, []);
      assert.deepEqual(res.data.prompt.respond.actions, []);
      await h.turnDone(s.id, n);
      assert.equal((await h.turnView(s.id, n)).said, 'outcome=allow-once');
      const perm = await h.entry(s.id, 'perm:' + card.request.id);
      assert.equal(perm.state, 'allowed');
      assert.equal(perm.by, 'Lead');
      assert.equal(perm.via, 'api');
      const resolved = (await h.get('/api/prompts?status=resolved')).data.find((p) => p.id === card.id);
      assert.equal(resolved.resolution, 'Allowed once by Lead.');
      assert.equal(resolved.request.pending, false);
      // A second answer has nothing left to answer.
      assert.equal((await h.answer(card.id, { action: 'once' })).status, 409);
    });

    await t2.test('reject, with words that follow as the next turn', async () => {
      const n = await h.begin(s.id, 'ask:git push --force');
      const card = await h.need(s.id);
      // From the browser, the record says so.
      const res = await h.answer(card.id, { action: 'reject', text: 'say:use a normal push' }, { origin: h.base });
      assert.equal(res.status, 200);
      assert.equal(res.data.answered, 'rejected');
      assert.equal(res.data.turnDelivered, true);
      await h.turnDone(s.id, n);
      assert.equal((await h.turnView(s.id, n)).said, 'outcome=reject-once');
      const perm = await h.entry(s.id, 'perm:' + card.request.id);
      assert.equal(perm.state, 'rejected');
      assert.equal(perm.via, 'browser');
      await h.turnDone(s.id, n + 1);
      const next = await h.turnView(s.id, n + 1);
      assert.equal(next.entries.find((e) => e.kind === 'user').text, 'say:use a normal push');
      assert.equal(next.said, 'use a normal push');
    });

    await t2.test('the agent\'s own answers can be picked by id', async () => {
      const n = await h.begin(s.id, 'ask:make install');
      const card = await h.need(s.id);
      assert.equal((await h.answer(card.id, { optionId: 'not-an-option' })).status, 400);
      assert.equal((await h.answer(card.id, {})).status, 400, 'an empty answer is not a dismissal');
      assert.equal((await h.answer(card.id, { action: 'maybe' })).status, 400);
      const words = await h.answer(card.id, { text: 'yes' });
      assert.equal(words.status, 400, 'words alone are never taken for a decision');
      assert.match(words.data.error, /needs a decision: send action once, always, reject/);
      assert.equal((await h.need(s.id)).id, card.id, 'a bad answer leaves the request waiting');
      const res = await h.answer(card.id, { optionId: 'allow-always' });
      assert.equal(res.data.answered, 'allowed');
      await h.turnDone(s.id, n);
      assert.equal((await h.turnView(s.id, n)).said, 'outcome=allow-always');
      assert.equal((await h.entry(s.id, 'perm:' + card.request.id)).option, 'Always allow');
      assert.deepEqual((await h.session(s.id)).grants, [], 'picking the agent\'s option is not an office grant');
    });

    await t2.test('allow for the session: the office remembers, per category, and writes down each use', async () => {
      const n = await h.begin(s.id, 'ask:npm test');
      const card = await h.need(s.id);
      const res = await h.answer(card.id, { action: 'always' });
      assert.equal(res.data.answered, 'allowed-session');
      assert.equal(res.data.sessionGrant, 'command');
      await h.turnDone(s.id, n);
      // The agent was told "this once": the standing permission is the office's, and ends with the session.
      assert.equal((await h.turnView(s.id, n)).said, 'outcome=allow-once');
      assert.deepEqual((await h.session(s.id)).grants, ['command']);

      const again = await h.turn(s.id, 'ask:npm run build');
      assert.equal(again.said, 'outcome=allow-once', 'the next command is allowed without a card');
      const auto = again.entries.find((e) => e.kind === 'permission');
      assert.equal(auto.state, 'auto-allowed');
      assert.match(auto.reason, /you allowed commands for this session/);
      assert.equal((await h.get('/api/prompts?status=pending')).data.filter((p) => p.agentId === s.id).length, 0);

      // A different kind of request is still asked.
      const m = await h.begin(s.id, 'askfile:src/secret.js');
      const fileCard = await h.need(s.id);
      assert.equal(fileCard.request.category, 'file-change');
      assert.equal(fileCard.message, 'Wants to change: src/secret.js');
      assert.deepEqual([fileCard.ask.tool, fileCard.ask.toolKind, fileCard.ask.files, fileCard.ask.command], ['Edit', 'edit', ['src/secret.js'], '']);
      assert.equal(fileCard.respond.actions[1].label, 'Allow file changes in its folder for this session');
      await h.answer(fileCard.id, { action: 'always' });
      await h.turnDone(s.id, m);
      assert.equal((await h.turnView(s.id, m)).said, 'outcome=allow-once');
      assert.equal((await h.turn(s.id, 'askfile:src/other.js')).said, 'outcome=allow-once', 'the next file in the folder is allowed');

      // That standing permission stops at the edge of the session's folder — however the path is spelled.
      fs.symlinkSync(path.dirname(h.work), path.join(h.work, 'way-out'));
      for (const outside of ['/etc/hosts', '../sibling/notes.txt', 'way-out/escaped.txt']) {
        const k = await h.begin(s.id, `askfile:${outside}`);
        const card = await h.need(s.id);
        assert.deepEqual(card.actions, ['once', 'reject'], `${outside}: asked, and not offered as a session-wide grant`);
        assert.equal((await h.answer(card.id, { action: 'always' })).status, 400);
        await h.answer(card.id, { action: 'reject' });
        await h.turnDone(s.id, k);
      }
    });

    await t2.test('only the human answers: not another agent, not a page from elsewhere', async () => {
      const other = await h.start('fake', { name: 'Mallory' });
      const n = await h.begin(s.id, 'askfile:/srv/deploy.yaml');      // outside its folder: no standing permission covers it
      const card = await h.need(s.id);
      const tried = await h.turn(other.id, `http:POST /api/prompts/${card.id}/reply {"action":"once"}`);
      assert.match(tried.said, /^http=403:/);
      assert.match(tried.said, /agents cannot answer permission requests/);
      const direct = await h.turn(other.id, `http:POST /api/harness/sessions/${s.id}/requests/${card.request.id} {"action":"once"}`);
      assert.match(direct.said, /^http=403:/);
      const evil = await fetch(`${h.base}/api/prompts/${card.id}/reply`, { method: 'POST',
        headers: { origin: 'https://evil.example', 'content-type': 'text/plain' }, body: JSON.stringify({ action: 'once' }) });
      assert.equal(evil.status, 403);
      assert.equal((await h.need(s.id)).id, card.id, 'still waiting for the human');
      // The same answer through the session's own endpoint, by the human.
      const res = await h.post(`/api/harness/sessions/${s.id}/requests/${card.request.id}`, { action: 'once' });
      assert.equal(res.status, 200);
      assert.equal(res.data.state, 'allowed');
      await h.turnDone(s.id, n);
      await h.del(`/api/harness/sessions/${other.id}`);
    });

    await t2.test('a card without a live request cannot be granted, only replied to', async () => {
      await h.hook({ session_id: 'hooked-1', cwd: h.work, hook_event_name: 'SessionStart' });
      await h.hook({ session_id: 'hooked-1', cwd: h.work, hook_event_name: 'Notification', message: 'Claude needs your permission to use Bash' });
      const card = await h.need('hooked-1');
      assert.equal(card.request, null);
      assert.ok(!card.actions.includes('once'), 'no grant button the office could not honour');
      assert.deepEqual(card.respond.actions.map((a) => [a.kind, a.text]), [['reply', 'required'], ['dismiss', 'none']]);
      assert.equal(card.respond.reaches, 'inbox', 'and it says where words to this agent end up');
      assert.equal(card.ask.summary, 'Claude needs your permission to use Bash');
      assert.equal((await h.answer(card.id, { action: 'once' })).status, 409);
      await h.hook({ session_id: 'hooked-1', hook_event_name: 'SessionEnd' });
    });

    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('the session mode decides what is answered without asking', async () => {
    const edits = await h.start('fake', { name: 'Edith', mode: 'edits' });
    const e1 = await h.turn(edits.id, 'askfile:src/a.js');
    assert.equal(e1.said, 'outcome=allow-once');
    assert.equal(e1.entries.find((e) => e.kind === 'permission').state, 'auto-allowed');
    assert.match(e1.entries.find((e) => e.kind === 'permission').reason, /accepts edits/);
    const n = await h.begin(edits.id, 'ask:curl example.com');
    const card = await h.need(edits.id);                       // a command is still the human's call
    await h.answer(card.id, { action: 'reject' });
    await h.turnDone(edits.id, n);
    // "Edits freely" means in its own folder: anywhere else it asks.
    const o = await h.begin(edits.id, 'askfile:/etc/hosts');
    const outside = await h.need(edits.id);
    assert.equal(outside.ask.files[0], '/etc/hosts');
    await h.answer(outside.id, { action: 'reject' });
    await h.turnDone(edits.id, o);

    // The human can widen or narrow an ACP session while it runs; it is written down.
    const patched = await h.patch(`/api/harness/sessions/${edits.id}`, { mode: 'full' });
    assert.equal(patched.data.session.mode, 'full');
    assert.equal((await h.turn(edits.id, 'ask:curl example.com')).said, 'outcome=allow-once');
    assert.ok((await h.entries(edits.id)).some((e) => e.kind === 'notice' && /Mode set to .full. by the human/.test(e.text)));
    assert.equal((await h.patch(`/api/harness/sessions/${edits.id}`, { mode: 'everything' })).status, 400);
    await h.del(`/api/harness/sessions/${edits.id}`);
  });

  await t.test('interrupt stops the turn in flight; a stop the agent ignores ends its process', async () => {
    const s = await h.start('fake', { name: 'Stopper' });
    const pid = h.ctx.harness.session(s.id).adapter.proc.pid;
    const n = await h.begin(s.id, 'say:starting; slow');
    await waitFor(async () => (await h.turnView(s.id, n)).said.includes('...'), { what: 'the agent to be mid-stream' });
    assert.equal((await h.agent(s.id)).turn, 'active');
    const live = (await h.turnView(s.id, n)).entries.find((e) => e.kind === 'message');
    assert.equal(live.streaming, true, 'a reply is readable while it is still being written');
    assert.equal((await h.session(s.id)).controls.interrupt.available, true);
    const stop = await h.post(`/api/harness/sessions/${s.id}/interrupt`);
    assert.equal(stop.data.interrupted, true);
    const ended = await h.turnDone(s.id, n);
    assert.equal(ended.state, 'interrupted');
    assert.equal(ended.stoppedBy, 'Lead');
    assert.equal((await h.session(s.id)).state, 'idle', 'the session survives a stop');
    assert.equal((await h.turn(s.id, 'say:still here')).said, 'still here');
    assert.equal(JSON.parse((await h.turn(s.id, 'report')).said).cancelHadId, false, 'session/cancel is a notification, not a request');

    // A stop while the agent waits for a permission answers that request (cancelled) and clears the card.
    const m = await h.begin(s.id, 'ask:sleep 600');
    const card = await h.need(s.id);
    await h.post(`/api/harness/sessions/${s.id}/interrupt`);
    assert.equal((await h.turnDone(s.id, m)).state, 'interrupted');
    assert.equal((await h.get('/api/prompts?status=pending')).data.filter((p) => p.agentId === s.id).length, 0);
    assert.equal((await h.entry(s.id, 'perm:' + card.request.id)).state, 'withdrawn');
    assert.equal((await h.post(`/api/harness/sessions/${s.id}/interrupt`)).data.interrupted, false, 'nothing to stop is not an error');

    // An agent that never confirms the stop loses its process (after OFFICE_HARNESS_CANCEL_TIMEOUT_MS).
    const k = await h.begin(s.id, 'ignore-cancel; slow');
    await waitFor(async () => (await h.turnView(s.id, k)).said.includes('..'), { what: 'the stubborn agent to be mid-stream' });
    await h.post(`/api/harness/sessions/${s.id}/interrupt`);
    const killed = await h.turnDone(s.id, k);
    assert.equal(killed.state, 'failed');
    const gone = await waitFor(async () => { const v = await h.session(s.id); return v.live ? null : v; }, { what: 'the session to end' });
    assert.equal(gone.state, 'failed');
    assert.match(gone.reason, /did not stop when asked/);
    await waitFor(() => !alive(pid), { what: 'the process to be gone' });
  });

  await t.test('a crashed agent is cleaned up and reported', async () => {
    const s = await h.start('fake', { name: 'Crashy' });
    const pid = h.ctx.harness.session(s.id).adapter.proc.pid;
    assert.ok(alive(pid));
    const n = await h.begin(s.id, 'say:working on it; tool:make; crash:3');
    const turn = await h.turnDone(s.id, n);
    assert.equal(turn.state, 'failed');
    assert.match(turn.error, /exited with code 3/);
    const gone = await waitFor(async () => { const v = await h.session(s.id); return v.live ? null : v; }, { what: 'the session to be marked failed' });
    assert.equal(gone.state, 'failed');
    assert.match(gone.reason, /exited with code 3/);
    assert.match(gone.reason, /boom \(the fake agent was told to crash\)/, 'the end of stderr explains it');
    assert.deepEqual(gone.caps, { observe: true, prompt: false, control: false, spawn: true });
    const record = await h.entry(s.id, 'session');
    assert.equal(record.state, 'failed');
    assert.equal(record.exit.code, 3);
    assert.equal((await h.entries(s.id)).find((e) => e.kind === 'message').text, 'working on it', 'what it said before dying is kept');
    assert.ok(!alive(pid));
    // The agent leaves the floor like anyone whose session ended, and the feed says why.
    await waitFor(async () => !(await h.get('/api/agents')).data.some((a) => a.id === s.id && a.status !== 'leaving'), { what: 'the agent to leave' });
    assert.ok((await h.activity()).some((e) => e.kind === 'agent-crash' && /Crashy/.test(e.text)));
    assert.equal((await h.post(`/api/harness/sessions/${s.id}/turn`, { text: 'say:hello?' })).status, 409);
    const listed = (await h.get('/api/harness/sessions?all=1')).data.sessions.find((x) => x.id === s.id);
    assert.equal(listed.state, 'failed');
    assert.ok(!(await h.get('/api/harness/sessions')).data.sessions.some((x) => x.id === s.id));

    // A crash while the agent waits on the human takes the card with it.
    const w = await h.start('fake', { name: 'Waity' });
    await h.begin(w.id, 'ask:true; crash:5');
    const card = await h.need(w.id);
    h.ctx.harness.session(w.id).adapter.proc.child.kill('SIGKILL');
    await waitFor(async () => !(await h.session(w.id)).live, { what: 'the killed session to end' });
    const after = (await h.get('/api/prompts')).data.find((p) => p.id === card.id);
    assert.equal(after.status, 'resolved');
    assert.match(after.resolution, /stopped waiting|session ended/);
    assert.match((await h.session(w.id)).reason, /SIGKILL/);
  });

  await t.test('output that is not the protocol: noise is tolerated, a broken frame ends the session', async () => {
    const s = await h.start('fake', { name: 'Noisy' });
    const ok = await h.turn(s.id, 'noise; say:fine');
    assert.equal(ok.turn.state, 'completed');
    assert.equal(ok.said, 'fine');
    assert.ok((await h.entries(s.id)).some((e) => e.kind === 'notice' && /not its protocol/.test(e.text)));
    const n = await h.begin(s.id, 'garbage; say:never seen');
    assert.equal((await h.turnDone(s.id, n)).state, 'failed');
    const gone = await waitFor(async () => { const v = await h.session(s.id); return v.live ? null : v; }, { what: 'the session to end' });
    assert.equal(gone.state, 'failed');
    assert.match(gone.reason, /malformed|not valid JSON|protocol/i);
  });

  await t.test('turns wait their turn; a failed turn and a turn that hit a limit are reported as such', async () => {
    const s = await h.start('fake', { name: 'Queue' });
    const n = await h.begin(s.id, 'sleep:500; say:first');
    const queued = await h.post(`/api/harness/sessions/${s.id}/turn`, { text: 'say:second' });
    assert.equal(queued.data.queued, true);
    assert.equal(queued.data.position, 1);
    assert.equal((await h.session(s.id)).queued, 1);
    await h.turnDone(s.id, n + 1);
    assert.equal((await h.turnView(s.id, n)).said, 'first');
    assert.equal((await h.turnView(s.id, n + 1)).said, 'second');

    const failed = await h.turn(s.id, 'say:trying; error:the model refused');
    assert.equal(failed.turn.state, 'failed');
    assert.match(failed.turn.error, /the model refused/);
    assert.equal((await h.session(s.id)).state, 'idle', 'a failed turn does not end the session');
    const cut = await h.turn(s.id, 'say:half an answ; stop:max_tokens');
    assert.equal(cut.turn.stopReason, 'max_tokens');
    assert.ok(cut.entries.some((e) => e.kind === 'notice' && /hit a limit \(max_tokens\)/.test(e.text)));

    assert.equal((await h.post(`/api/harness/sessions/${s.id}/turn`, { text: '   ' })).status, 400);
    assert.equal((await h.post(`/api/harness/sessions/${s.id}/turn`, { text: 'x'.repeat(120_001) })).status, 413);
    assert.equal((await h.post('/api/harness/sessions/nobody-here/turn', { text: 'hi' })).status, 404);
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('ending a session ends its process tree and keeps the record', async () => {
    const s = await h.start('fake', { name: 'Brief' });
    const pid = h.ctx.harness.session(s.id).adapter.proc.pid;
    await h.turn(s.id, 'say:one thing');
    const res = await h.del(`/api/harness/sessions/${s.id}`);
    assert.equal(res.data.session.state, 'ended');
    assert.equal(res.data.session.reason, 'ended from the office');
    assert.deepEqual(res.data.session.caps, { observe: true, prompt: false, control: false, spawn: true });
    assert.deepEqual(Object.entries(res.data.session.controls).filter(([, c]) => c.available).map(([name]) => name), [], 'nothing can be done to a finished session');
    assert.equal(res.data.session.controls.transcript.url, `/api/harness/sessions/${s.id}/transcript`, '…but it can still be read');
    await waitFor(() => !alive(pid), { what: 'the process to be gone' });
    assert.equal((await h.entry(s.id, 'session')).state, 'ended');
    assert.ok(!(await h.activity()).some((e) => e.kind === 'agent-crash' && /Brief/.test(e.text)), 'an ending we asked for is not a crash');
    assert.equal((await h.get(`/api/harness/sessions/${s.id}/transcript`)).data.entries.find((e) => e.kind === 'message').text, 'one thing');
  });

  await t.test('the ACP v2 preview is understood, and an agent that wants a login gets its own method', async () => {
    const v2 = await h.start('fake-v2', { name: 'Vera' });
    assert.equal(v2.protocol, 'acp/2');
    assert.equal(v2.model, 'fake-large');
    const told = JSON.parse((await h.turn(v2.id, 'report')).said);
    assert.equal(told.protocolVersion, 2);
    assert.equal(told.mcpTyped, true, 'v2 wants each MCP server typed');
    const work = await h.turn(v2.id, 'say:planning; plan:alpha|beta; tool:ls');
    assert.equal(work.turn.state, 'completed');
    assert.deepEqual(work.entries.find((e) => e.kind === 'plan').entries.map((e) => e.text), ['alpha', 'beta']);
    const n = await h.begin(v2.id, 'ask:rm x');
    const card = await h.need(v2.id);
    assert.equal(card.request.command, 'rm x');
    await h.answer(card.id, { action: 'once' });
    await h.turnDone(v2.id, n);
    assert.equal((await h.turnView(v2.id, n)).said, 'outcome=allow-once');
    const failed = await h.turn(v2.id, 'error:v2 turn failed');
    assert.equal(failed.turn.state, 'failed');
    await h.del(`/api/harness/sessions/${v2.id}`);

    const auth = await h.start('fake-auth', { name: 'Auth' });
    assert.equal(JSON.parse((await h.turn(auth.id, 'report')).said).authenticated, true);
    await h.del(`/api/harness/sessions/${auth.id}`);
  });

  await t.test('the bus: a harness snapshot for everyone, transcript entries only for who is watching', async () => {
    const s = await h.start('fake', { name: 'Wired' });
    const ws = new WebSocket(h.base.replace('http', 'ws') + '/');
    const seen = [];
    ws.onmessage = (e) => seen.push(JSON.parse(e.data));
    await new Promise((r) => { ws.onopen = r; });
    const snap = await waitFor(() => seen.find((m) => m.type === 'harness'), { what: 'the harness snapshot' });
    assert.ok(snap.sessions.some((x) => x.id === s.id));
    assert.equal(snap.wake.paused, false);
    assert.ok(seen.find((m) => m.type === 'snapshot').agents.some((a) => a.id === s.id && a.driven === true));

    await h.turn(s.id, 'say:nobody is watching');
    await sleep(60);
    assert.equal(seen.filter((m) => m.type === 'transcript').length, 0);
    assert.ok(seen.some((m) => m.type === 'update' && m.agent.id === s.id), 'the agent\'s status still reaches everyone');

    ws.send(JSON.stringify({ type: 'transcript:watch', sessionId: s.id }));
    await sleep(40);
    await h.turn(s.id, 'say:now you see me; tool:ls');
    await waitFor(() => seen.some((m) => m.type === 'transcript' && m.sessionId === s.id && m.entry.kind === 'tool' && m.entry.status === 'completed'),
      { what: 'a watched tool entry' });
    assert.ok(seen.some((m) => m.type === 'transcript' && m.entry.kind === 'message' && m.entry.text === 'now you see me'));
    assert.ok(seen.filter((m) => m.type === 'harness').length >= 2, 'state changes are announced');

    // Watching something that is not a session id is ignored, not an error.
    ws.send(JSON.stringify({ type: 'transcript:watch', sessionId: '../../etc/passwd' }));
    const before = seen.filter((m) => m.type === 'transcript').length;
    await sleep(30);
    await h.turn(s.id, 'say:unwatched again');
    await sleep(60);
    assert.equal(seen.filter((m) => m.type === 'transcript').length, before);
    ws.close();
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('the human speaking to a driven agent is a turn, not mail left on a board', async () => {
    const s = await h.start('fake', { name: 'Listener' });
    const dm = await h.post('/api/comms/direct-message', { toAgentId: s.id, content: 'say:heard you' });
    assert.equal(dm.status, 200);
    assert.equal(dm.data.turnDelivered, true);
    await h.turnDone(s.id, 1);
    const view = await h.turnView(s.id, 1);
    assert.equal(view.entries.find((e) => e.kind === 'user').text, 'say:heard you');
    assert.equal(view.said, 'heard you');
    assert.equal((await h.inbox(s.id)).items.length, 0, 'it was delivered once, as the turn');

    // The agent flags the human the ordinary way (office block); the reply arrives as its next turn.
    await h.hook({ session_id: s.id, hook_event_name: 'Notification', message: 'Which database should I use?' });
    const card = await h.need(s.id);
    assert.equal(card.request, null);
    assert.deepEqual(card.actions, ['reply']);
    assert.equal(card.respond.reaches, 'turn', 'words to a driven agent arrive as a turn');
    const reply = await h.answer(card.id, { text: 'say:postgres it is' });
    assert.equal(reply.data.turnDelivered, true);
    await h.turnDone(s.id, 2);
    assert.equal((await h.turnView(s.id, 2)).said, 'postgres it is');
    assert.equal((await h.inbox(s.id)).items.length, 0);
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('hooks from a driven agent\'s own CLI do not seat a second avatar', async () => {
    const s = await h.start('fake', { name: 'Solo' });
    const count = (await h.get('/api/agents')).data.filter((a) => a.status !== 'leaving').length;
    // Claude Code driven through ACP still fires its hooks; the hook script forwards who launched it.
    const res = await fetch(h.base + '/hook', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-office-runtime-session': s.id },
      body: JSON.stringify({ session_id: 'claude-native-uuid-1', cwd: h.work, hook_event_name: 'SessionStart' }) });
    assert.equal(res.status, 204);
    assert.equal((await h.get('/api/agents')).data.filter((a) => a.status !== 'leaving').length, count);
    assert.equal((await h.get('/api/agents/claude-native-uuid-1')).status, 404);
    await h.del(`/api/harness/sessions/${s.id}`);
  });
});

test('driven sessions and the daemon\'s own life', async (t) => {
  await t.test('sessions do not outlive the daemon, and the record says what happened', async () => {
    const dir = tempDir('office-harness-restart-');
    const first = await startHarnessOffice({ dir });
    const s = await first.start('fake', { name: 'Mortal' });
    const pid = first.ctx.harness.session(s.id).adapter.proc.pid;
    await first.turn(s.id, 'say:remember me');
    await first.stop();
    assert.ok(!alive(pid), 'stopping the office stops the agents it runs');

    const second = await startHarnessOffice({ dir, work: first.work });
    try {
      assert.equal((await second.get('/api/harness/sessions')).data.sessions.length, 0);
      const listed = (await second.get('/api/harness/sessions?all=1')).data.sessions.find((x) => x.id === s.id);
      assert.equal(listed.state, 'ended');
      assert.equal(listed.reason, 'the office is shutting down');
      assert.equal(listed.caps.control, false);
      const cold = (await second.get(`/api/harness/sessions/${s.id}/transcript`)).data;
      assert.equal(cold.live, false);
      assert.equal(cold.entries.find((e) => e.kind === 'message').text, 'remember me');
      assert.equal(cold.entries.find((e) => e.kind === 'session').state, 'ended');
      assert.ok(!(await second.get('/api/agents')).data.some((a) => a.id === s.id), 'no ghost at a desk');
    } finally { await second.stop(); }
  });

  await t.test('a daemon that died mid-session says so instead of listing ghosts', async () => {
    const dir = tempDir('office-harness-crash-');
    fs.writeFileSync(path.join(dir, 'harness.json'), JSON.stringify({ v: 1, wakePaused: true, sessions: {
      d_0123456789ab: { id: 'd_0123456789ab', adapter: 'fake', label: 'Fake Agent', provider: 'gemini', protocol: 'acp/1', cwd: dir,
        name: 'Ghost', mode: 'ask', wake: 'off', state: 'running', startedAt: Date.now() - 5000, turns: 1 } } }));
    const o = await startHarnessOffice({ dir });
    try {
      const listed = (await o.get('/api/harness/sessions?all=1')).data.sessions.find((x) => x.id === 'd_0123456789ab');
      assert.equal(listed.state, 'ended');
      assert.equal(listed.reason, 'the office restarted');
      assert.equal(listed.live, false);
      assert.equal((await o.get('/api/harness/wake')).data.paused, true, 'the pause switch survives a restart');
      assert.equal((await o.get('/api/harness/sessions/d_0123456789ab/transcript')).data.missing, true);
    } finally { await o.stop(); }
  });

  await t.test('the harness can be switched off, and limited', async () => {
    const off = await startHarnessOffice({ env: { OFFICE_HARNESS: '0' } });
    try {
      assert.equal((await off.get('/api/harness')).data.enabled, false);
      assert.equal((await off.post('/api/harness/sessions', { adapter: 'fake', cwd: off.work })).status, 403);
    } finally { await off.stop(); }

    const small = await startHarnessOffice({ env: { OFFICE_HARNESS_MAX_SESSIONS: '1' } });
    try {
      await small.start('fake');
      const second = await small.post('/api/harness/sessions', { adapter: 'fake', cwd: small.work });
      assert.equal(second.status, 429);
      assert.match(second.data.error, /already driving 1 agents/);
    } finally { await small.stop(); }
  });

  await t.test('an operator file with a bad entry is reported, and the good entries still load', async () => {
    const o = await startHarnessOffice({ adapters: [...ADAPTERS, { id: 'Bad Id!', command: 'x' }, { id: 'noproto', protocol: 'telepathy', command: 'x' }] });
    try {
      const cat = (await o.get('/api/harness')).data;
      assert.equal(cat.catalogErrors.length, 2);
      assert.ok(cat.adapters.some((a) => a.id === 'fake' && a.available));
      assert.ok(!cat.adapters.some((a) => a.id === 'noproto'));
    } finally { await o.stop(); }
  });
});
