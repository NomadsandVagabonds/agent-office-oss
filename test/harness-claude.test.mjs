// Driven sessions over Claude Code's own stream-json mode, against the fake in
// test/fixtures (one JSON object per line each way; control requests and their
// answers on the same stream as the messages of a turn). The shapes come from
// the type definitions Anthropic publishes with its Agent SDK, the CLI's own
// --help, and the frames T3 Code recorded from real runs (docs/HARNESS.md
// §7.5 says which is which). Nothing here has met a real `claude`: a real
// turn spends the owner's tokens, so no test ever starts one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { startHarnessOffice, waitFor, sleep, ADAPTERS, FIX, ROOT } from './fixtures/harness-helpers.mjs';
import { tempDir } from './helpers.mjs';
import { StreamJsonWire, claudeLaunch, claudeLimits, CLAUDE_MODES } from '../server/harness/claude.mjs';
import { RpcError, RpcClosedError, RPC } from '../server/harness/rpc.mjs';
import { createCatalog, parseAdapter } from '../server/harness/catalog.mjs';

const FAKE = path.join(FIX, 'fake-claude.mjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// What makes the CLI speak the protocol at all; the same for every session.
const WIRE = ['--print', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
  '--permission-prompt-tool', 'stdio'];

// Claude Code refuses to bypass its permission checks as root unless IS_SANDBOX=1 says it is in a sandbox, and
// the adapter knows that. With the marker set, a suite run as root (a container) and one run by a developer
// start the fake with the same arguments; the entries without it are for the tests about exactly that.
const claude = (id, label, flags = [], extra = {}) => ({ id, label, protocol: 'claude-stream-json', command: process.execPath,
  args: [FAKE, ...flags], provider: 'claude', env: { IS_SANDBOX: '1' }, ...extra });
const FAKES = [
  claude('fake-claude', 'Fake Claude'),
  claude('fake-claude-old', 'Fake Claude (old)', ['--fake-old']),
  claude('fake-claude-whole', 'Fake Claude (no partials)', ['--fake-no-partials']),
  claude('fake-claude-nomcp', 'Fake Claude (no MCP)', ['--fake-refuse-mcp']),
  claude('fake-claude-root', 'Fake Claude (refuses)', ['--fake-root']),
  claude('fake-claude-asroot', 'Fake Claude (root, no sandbox)', ['--fake-root'], { env: { IS_SANDBOX: '0', CLAUDE_CODE_BUBBLEWRAP: '' } }),
  claude('fake-claude-user', 'Fake Claude (no sandbox)', [], { env: { IS_SANDBOX: '0', CLAUDE_CODE_BUBBLEWRAP: '' } }),
  claude('fake-claude-broken', 'Fake Claude (bad config)', ['--fake-bad-config']),
  claude('fake-claude-sticky', 'Fake Claude (sticky)', ['--fake-sticky']),
  claude('fake-claude-stubborn', 'Fake Claude (stubborn)', ['--fake-stubborn']),
  claude('fake-claude-reserved', 'Fake Claude (bad entry)', ['--permission-mode=bypassPermissions']),
  claude('fake-claude-extra', 'Fake Claude (operator args)', ['--allowedTools', 'mcp__office']),
];
const office = (opt = {}) => startHarnessOffice({ adapters: [...ADAPTERS, ...FAKES], ...opt });

test('driven sessions: Claude Code, natively', async (t) => {
  const h = await office();
  t.after(() => h.stop());
  const set = (id, body) => h.patch(`/api/harness/sessions/${id}`, body);
  const told = async (id) => JSON.parse((await h.turn(id, 'report')).said);
  const notices = async (id, level) => (await h.entries(id)).filter((e) => e.kind === 'notice' && (!level || e.level === level)).map((e) => e.text);
  const end = (id) => h.del(`/api/harness/sessions/${id}`);
  const gone = (id) => waitFor(async () => { const v = await h.session(id); return v.live ? null : v; }, { what: 'the session to end' });

  await t.test('it is started in its structured mode, and each office mode is one of its permission modes', async () => {
    const s = await h.start('fake-claude', { name: 'Claudia' });
    assert.equal(s.protocol, 'claude-stream-json');
    assert.equal(s.provider, 'claude');
    assert.match(s.nativeRef, UUID, 'the conversation id is the office\'s choice, so it is known before Claude has said a word');
    assert.deepEqual(s.features, { interrupt: true, resume: true, images: true, officeTools: true, nativeSandbox: false, exactSessionAllow: false },
      'Claude has a permission mode, not a sandbox, and the office says so');
    assert.deepEqual([s.mode, s.agentMode, s.model, s.effort], ['ask', 'default', '', ''], 'the model is not known until Claude names it');
    const a = await h.agent(s.id);
    assert.equal(a.runtime.transport, 'claude-stream-json');
    assert.equal(a.runtime.caps.control, true);
    assert.deepEqual((await h.entry(s.id, 'session')).agent, { name: 'Claude Code', version: '9.9.9-fake' });

    const first = await told(s.id);
    assert.deepEqual(first.args, [...WIRE, '--session-id', s.nativeRef, '--permission-mode', 'default']);
    assert.equal(first.sessionId, s.nativeRef);
    assert.deepEqual(first.initialize, { subtype: 'initialize', title: `The Office · ${s.id}` }, 'initialize is sent first, and carries nothing the office did not mean to send');
    assert.deepEqual(first.firstUser, { role: 'user', parent: null, uuid: true, string: true }, 'a turn is one user message, with an id of its own');
    assert.equal(first.framed, 1, 'the first request is framed with where the agent is');
    assert.equal(first.mode, 'default');
    // Once Claude has named the model it runs, that is what is shown.
    assert.equal((await h.session(s.id)).model, 'claude-fake-sonnet-1');
    // The session's mode is the office's own to change (it decides how requests are answered); nothing about it is fixed.
    assert.deepEqual([s.controls.mode.available, s.controls.mode.fixed, s.controls.mode.applies], [true, undefined, undefined]);
    assert.equal((await set(s.id, { wake: 'direct' })).data.session.wake, 'direct');
    await end(s.id);

    for (const [mode, own, flags] of [['edits', 'acceptEdits', []], ['full', 'bypassPermissions', ['--allow-dangerously-skip-permissions']]]) {
      const m = await h.start('fake-claude', { mode });
      assert.deepEqual((await told(m.id)).args.slice(WIRE.length + 2), ['--permission-mode', own, ...flags], mode);
      assert.equal(m.agentMode, own);
      await end(m.id);
    }
    assert.deepEqual(CLAUDE_MODES, { ask: 'default', edits: 'acceptEdits', full: 'bypassPermissions' });

    // What was chosen before it starts is on its command line; what the operator's own entry adds comes first.
    const chosen = await h.start('fake-claude-extra', { mode: 'edits', model: 'fake-opus', effort: 'high', agentMode: 'plan' });
    assert.deepEqual([chosen.model, chosen.effort, chosen.agentMode], ['fake-opus', 'high', 'plan']);
    const c = await told(chosen.id);
    assert.deepEqual(c.args, ['--allowedTools', 'mcp__office', ...WIRE, '--session-id', chosen.nativeRef, '--permission-mode', 'plan', '--model', 'fake-opus', '--effort', 'high']);
    assert.deepEqual([c.mode, c.model, c.effort], ['plan', 'claude-fake-opus-1', 'high']);
    assert.equal((await h.session(chosen.id)).model, 'fake-opus', 'an alias somebody chose is kept while Claude\'s own word shows it still stands for what runs');
    await end(chosen.id);

    // A mode of its own that goes further than the session's mode is not taken, and that is said.
    const over = await h.start('fake-claude', { mode: 'ask', agentMode: 'bypassPermissions' });
    assert.equal(over.agentMode, 'default');
    assert.match((await notices(over.id, 'warn'))[0], /was not started in its “bypassPermissions” mode: .* goes further than this session's “ask” mode allows\. It runs in “default”\./);
    await end(over.id);
  });

  await t.test('the command line is decided by one pure function', () => {
    const id = '11111111-2222-4333-8444-555555555555';
    const tail = (opt) => claudeLaunch({ sessionId: id, ...opt }).args.slice(WIRE.length);
    assert.deepEqual(claudeLaunch({ sessionId: id }).args.slice(0, WIRE.length), WIRE);
    assert.deepEqual(tail({}), ['--session-id', id, '--permission-mode', 'default']);
    assert.deepEqual(tail({ access: 'edits' }), ['--session-id', id, '--permission-mode', 'acceptEdits']);
    assert.deepEqual(tail({ access: 'full' }), ['--session-id', id, '--permission-mode', 'bypassPermissions', '--allow-dangerously-skip-permissions']);
    // Where Claude would refuse to start able to bypass (as root), "full" is one step short of it, and nothing on the line says bypass.
    assert.deepEqual(claudeLaunch({ sessionId: id, access: 'full', mayBypass: false }), { modeId: 'acceptEdits', bypass: false,
      args: [...WIRE, '--session-id', id, '--permission-mode', 'acceptEdits'] });
    assert.deepEqual(tail({ access: 'full', mayBypass: false, agentMode: 'bypassPermissions' }).slice(2), ['--permission-mode', 'acceptEdits']);
    // Its own modes: taken within the session's mode, never beyond it, never one nobody has heard of.
    assert.equal(claudeLaunch({ sessionId: id, access: 'ask', agentMode: 'plan' }).modeId, 'plan');
    assert.equal(claudeLaunch({ sessionId: id, access: 'ask', agentMode: 'acceptEdits' }).modeId, 'default');
    assert.equal(claudeLaunch({ sessionId: id, access: 'full', agentMode: 'acceptEdits' }).modeId, 'acceptEdits');
    // Its "auto" mode is not one the office starts it in (see the adapter: under a full session it would be bypass by another name).
    assert.equal(claudeLaunch({ sessionId: id, access: 'edits', agentMode: 'auto' }).modeId, 'acceptEdits');
    assert.equal(claudeLaunch({ sessionId: id, access: 'full', agentMode: 'auto' }).modeId, 'bypassPermissions');
    assert.equal(claudeLaunch({ sessionId: id, access: 'full', agentMode: 'yolo' }).modeId, 'bypassPermissions');
    assert.equal(claudeLaunch({ sessionId: id, access: 'nonsense' }).modeId, 'default', 'a mode nobody knows is the most careful one');
    assert.deepEqual(tail({ model: 'opus', effort: 'max' }).slice(4), ['--model', 'opus', '--effort', 'max']);
    // No argument is ever a prompt: the one thing that would make the CLI spend tokens on its own.
    for (const access of ['ask', 'edits', 'full']) {
      const { args } = claudeLaunch({ sessionId: id, access, model: 'm', effort: 'low' });
      assert.ok(args.every((arg, i) => arg.startsWith('-') || args[i - 1].startsWith('--')), 'every bare word is the value of the flag before it');
    }
  });

  await t.test('a turn streams: replies, reasoning, a command, an edit, a read, a task list, context use', async () => {
    for (const adapter of ['fake-claude', 'fake-claude-whole']) {
      const s = await h.start(adapter, { name: adapter === 'fake-claude' ? 'Stream' : 'Whole' });
      const files = [];
      const onFile = (e) => files.push(e);
      h.ctx.bus.on('agent:file', onFile);
      const r = await h.turn(s.id, 'say:hello; say:again; think:hmm; tool:ls -la; edit:src/a.js; read:README.md; plan:one|two; usage:5000/100000; say:done');
      h.ctx.bus.off('agent:file', onFile);
      assert.equal(r.turn.state, 'completed', adapter);
      assert.equal(r.turn.stopReason, 'end_turn');
      assert.equal(r.turn.tools, 3);
      // Streamed or delivered whole, a reply is said once; each block of text is its own item.
      assert.deepEqual(r.entries.filter((e) => e.kind === 'message').map((e) => e.text), ['hello', 'again', 'done'], adapter);
      assert.ok(r.entries.filter((e) => e.kind === 'message').every((e) => e.streaming === false));
      assert.deepEqual(r.entries.filter((e) => e.kind === 'thought').map((e) => e.text), ['hmm']);
      const [cmd, edit, read] = r.entries.filter((e) => e.kind === 'tool');
      assert.deepEqual([cmd.toolKind, cmd.name, cmd.title, cmd.command, cmd.status], ['execute', 'Shell', 'ls -la', 'ls -la', 'completed']);
      assert.match(cmd.output, /ran: ls -la\nok/);
      assert.deepEqual([edit.toolKind, edit.name, edit.title, edit.status, edit.paths], ['edit', 'Edit', 'Edit src/a.js', 'completed', ['src/a.js']]);
      assert.equal(edit.output, 'The file src/a.js has been updated.', 'a result made of content blocks is read as its text');
      assert.deepEqual([read.toolKind, read.title, read.paths], ['read', 'Read README.md', ['README.md']]);
      // Claude's task list is a tool call of its own; it is shown as the plan it is, not as a tool.
      assert.deepEqual(r.entries.find((e) => e.kind === 'plan').entries, [{ text: 'one', status: 'running' }, { text: 'two', status: 'pending' }]);
      assert.deepEqual(files.map((f) => [f.path, f.kind, f.tool]), [['src/a.js', 'edit', 'Edit'], ['README.md', 'read', 'Read']]);
      // How full the context is: what the last request carried in plus what it wrote, against the window the
      // result names for the model that holds the conversation (the small helper model's window is not it).
      const usage = await h.entry(s.id, 'usage');
      assert.equal(usage.size, 100000, adapter);
      assert.ok(usage.used >= 5000 && usage.used <= 5010, `${adapter}: ${usage.used}`);
      assert.deepEqual(usage.cost, { amount: 0.01, currency: 'USD' });
      assert.equal((await h.agent(s.id)).contextPct, 5);
      await end(s.id);
    }
  });

  await t.test('what the stream says besides the reply: retries, compaction, a slash command, a refusal by its own rules, frames twice', async () => {
    const s = await h.start('fake-claude', { name: 'Chatter' });
    const r = await h.turn(s.id, 'say:one; dup; retry; usage:9000/10000; compact; local:Context is 12% full; denied:WebFetch; say:two');
    assert.deepEqual(r.entries.filter((e) => e.kind === 'message').map((e) => e.text), ['one', 'Context is 12% full', 'two'], 'the same frame delivered twice is said once');
    const said = await notices(s.id);
    assert.ok(said.some((x) => /request to its API failed \(overloaded\); it is trying again/.test(x)));
    assert.ok(said.includes('Claude is summarising its conversation to make room.'));
    assert.ok(said.includes('Claude refused a WebFetch call by its own rules: A deny rule matches this call.'));
    // After the summary the context is what Claude says is left of it, and the next request measures from there.
    const usage = await h.entry(s.id, 'usage');
    assert.ok(usage.used >= 1200 && usage.used < 1300, String(usage.used));
    assert.equal((await h.agent(s.id)).contextPct, 12);

    // A sub-agent: its tool calls are work in this folder and are shown; its words are its own.
    const sub = await h.turn(s.id, 'sub:npm test; say:back');
    assert.deepEqual(sub.entries.filter((e) => e.kind === 'message').map((e) => e.text), ['back']);
    const tools = sub.entries.filter((e) => e.kind === 'tool');
    assert.deepEqual(tools.map((e) => [e.name, e.title, e.status]), [['Agent', 'Look into it', 'completed'], ['Shell', 'npm test', 'completed']]);
    assert.equal(tools[0].output, 'The sub-agent reports: done.');
    assert.ok(!JSON.stringify(sub.entries).includes('talking to itself'));

    // A turn Claude starts by itself (a background task reporting back) answers nothing the office asked:
    // it ends no turn of ours, and what it said is noted rather than shown as a reply.
    const w = await h.turn(s.id, 'say:started it; wake:the build finished');
    assert.equal(w.said, 'started it');
    await waitFor(async () => (await notices(s.id)).some((x) => x === 'Claude went on by itself after work in the background finished, and said: the build finished'), { what: 'the note about the turn Claude took by itself' });
    assert.equal((await h.session(s.id)).state, 'idle');
    assert.equal((await h.turn(s.id, 'say:still in step')).said, 'still in step', 'and the next turn is still the office\'s');
    // The same when the office gives a turn while Claude is still in the middle of its own: the first result
    // that arrives is the end of Claude's turn, not of the one just given, and must not be taken for it.
    await h.turn(s.id, 'say:started another; wake:hold:the tests passed');
    await sleep(120);
    const over = await h.turn(s.id, 'sleep:60; say:mine, whole');
    assert.deepEqual([over.turn.state, over.said], ['completed', 'mine, whole']);
    assert.ok((await notices(s.id)).includes('Claude went on by itself after work in the background finished, and said: the tests passed'));

    // An MCP server asking the person for input, and a callback the office never registered: both answered, neither left hanging.
    const odd = await h.turn(s.id, 'elicit; hookcb');
    assert.equal(odd.said, 'elicit=decline\nunknown=the office does not provide hook_callback');
    assert.ok((await notices(s.id)).some((x) => /asked Claude’s user for input, which the office cannot show yet; it was declined/.test(x)));
    await end(s.id);
  });

  await t.test('approvals: once, for the session, reject — as Claude\'s allow and deny', async () => {
    const s = await h.start('fake-claude', { name: 'Gate' });
    let n = await h.begin(s.id, 'ask:rm -rf build');
    let card = await h.need(s.id);
    assert.equal(card.kind, 'permission');
    assert.equal(card.message, 'Wants to run: rm -rf build\nThis command requires approval', 'why Claude asks, without its terminal colours');
    assert.deepEqual(card.request.options, [{ id: 'allow', name: 'Allow', kind: 'allow_once' }, { id: 'deny', name: 'Reject', kind: 'reject_once' }]);
    assert.deepEqual(card.actions, ['once', 'always', 'reject']);
    assert.deepEqual([card.ask.tool, card.ask.toolKind, card.ask.command, card.request.category], ['Shell', 'execute', 'rm -rf build', 'command']);
    assert.deepEqual(card.respond.actions.map((a) => a.kind), ['allow-once', 'allow-session', 'reject']);
    assert.equal((await h.agent(s.id)).blockKind, 'permission');
    // The call was announced before the question, so the record shows what is being asked about.
    assert.equal((await h.turnView(s.id, n)).entries.find((e) => e.kind === 'tool').status, 'running');
    await h.answer(card.id, { action: 'once' });
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'decision=allow', 'allowed as asked: the input is handed back unchanged, and no rule is written');
    assert.equal((await h.turnView(s.id, n)).entries.find((e) => e.kind === 'tool').status, 'completed');

    n = await h.begin(s.id, 'ask:git push --force');
    card = await h.need(s.id);
    await h.answer(card.id, { action: 'reject' });
    await h.turnDone(s.id, n);
    const rejected = await h.turnView(s.id, n);
    assert.equal(rejected.said, 'decision=deny');
    const refused = rejected.entries.find((e) => e.kind === 'tool');
    assert.deepEqual([refused.status, refused.output], ['failed', 'The human in the office declined this request.'], 'a refused command did not run, and Claude was told who refused');

    // A file outside its folder: Claude says which, and it is never the start of a standing permission.
    n = await h.begin(s.id, 'askfile:/etc/hosts');
    card = await h.need(s.id);
    assert.equal(card.request.category, 'file-change');
    assert.equal(card.message, 'Wants to change: /etc/hosts\noutside its folder: /etc/hosts');
    assert.deepEqual(card.actions, ['once', 'reject']);
    assert.equal((await h.answer(card.id, { action: 'always' })).status, 400);
    assert.equal((await h.answer(card.id, { optionId: 'nope' })).status, 400);
    await h.answer(card.id, { optionId: 'deny' });
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'decision=deny');

    // Claude stops waiting by itself: the card goes, and nothing is answered into the void.
    n = await h.begin(s.id, 'withdraw:make deploy');
    card = await h.need(s.id);
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'withdrawn');
    const withdrawn = await h.entry(s.id, 'perm:' + card.request.id);
    assert.deepEqual([withdrawn.state, withdrawn.reason], ['withdrawn', 'Claude stopped waiting']);
    assert.equal((await h.get('/api/prompts')).data.find((p) => p.id === card.id).status, 'resolved');
    assert.equal((await told(s.id)).strayAnswers, 0);

    // "For the session" is the office's memory: Claude is told "this once" every time, and never handed a rule
    // of its own to keep — what it proposes for "always" can outlive the session, or change its mode.
    n = await h.begin(s.id, 'ask:npm test');
    card = await h.need(s.id);
    assert.equal((await h.answer(card.id, { action: 'always' })).data.sessionGrant, 'command');
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'decision=allow');
    const next = await h.turn(s.id, 'ask:npm run lint');
    assert.equal(next.said, 'decision=allow');
    assert.equal(next.entries.find((e) => e.kind === 'permission').state, 'auto-allowed');
    const last = (await told(s.id)).lastAnswer;
    assert.deepEqual(Object.keys(last).sort(), ['behavior', 'toolUseID', 'updatedInput']);
    assert.deepEqual([last.behavior, last.updatedInput], ['allow', { command: 'npm run lint' }]);
    assert.match(last.toolUseID, /^toolu_fake_/, 'the answer names the call it is for');

    // A web fetch and one of the office's own tools are asked about by what they are.
    n = await h.begin(s.id, 'fetch:https://example.com/a');
    card = await h.need(s.id);
    assert.deepEqual([card.message, card.request.category], ['Wants to fetch: https://example.com/a', 'fetch']);
    await h.answer(card.id, { action: 'once' });
    await h.turnDone(s.id, n);
    n = await h.begin(s.id, 'mcptool:office_post');
    card = await h.need(s.id);
    assert.deepEqual([card.message, card.request.category, card.ask.tool], ['Wants permission: office: office_post', 'other:office.office_post', 'office.office_post']);
    await h.answer(card.id, { action: 'reject' });
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'mcptool=deny');

    await end(s.id);
  });

  await t.test('the session\'s mode is Claude\'s own mode too: it decides what Claude asks, and the office answers the rest', async () => {
    // edits: Claude writes in its folder without asking anyone; a command is still the human's call.
    const e = await h.start('fake-claude', { name: 'Edith', mode: 'edits' });
    const wrote = await h.turn(e.id, 'write:src/a.js');
    assert.equal(wrote.said, 'write=allow in acceptEdits');
    assert.equal(wrote.entries.filter((x) => x.kind === 'permission').length, 0, 'Claude did not ask, so there is nothing to answer');
    let n = await h.begin(e.id, 'run:make');
    let card = await h.need(e.id);
    assert.equal(card.ask.summary.split('\n')[0], 'Wants to run: make');
    assert.equal(card.request.title, 'A command with a description', 'a command Claude describes is titled by its description');
    await h.answer(card.id, { action: 'reject' });
    await h.turnDone(e.id, n);
    // What Claude does still ask about a file in its folder is answered by the same mode, and written down.
    const asked = await h.turn(e.id, 'askfile:src/b.js');
    assert.equal(asked.said, 'decision=allow');
    assert.match(asked.entries.find((x) => x.kind === 'permission').reason, /accepts edits/);
    // …and a file outside it goes to the human.
    n = await h.begin(e.id, 'write:/etc/hosts');
    card = await h.need(e.id);
    assert.equal(card.ask.files[0], '/etc/hosts');
    await h.answer(card.id, { action: 'reject' });
    await h.turnDone(e.id, n);
    assert.equal((await h.turnView(e.id, n)).said, 'write=deny in acceptEdits');

    // What Claude raises as a safety check of its own (a write under .git, say) is one it insists a person sees:
    // neither the mode nor "file changes for this session" answers it, though the file is in the folder.
    n = await h.begin(e.id, 'guard:.git/hooks/pre-commit');
    card = await h.need(e.id);
    assert.deepEqual([card.request.category, card.ask.tool, card.ask.files], ['file-change', 'Edit', ['.git/hooks/pre-commit']]);
    assert.equal(card.message, 'Wants to change: .git/hooks/pre-commit\nClaude’s own safety check: Claude requested permissions to edit .git/hooks/pre-commit which is a sensitive file. It is put to a person in every mode.',
      'the request says in so many words why it is being asked');
    assert.deepEqual(card.actions, ['once', 'reject'], 'and it is never the start of a standing permission');
    assert.equal((await h.answer(card.id, { action: 'always' })).status, 400);
    await h.answer(card.id, { action: 'once' });
    await h.turnDone(e.id, n);
    assert.equal((await h.turnView(e.id, n)).said, 'guard=allow');
    await end(e.id);

    // full: Claude asks about nothing an ordinary rule covers; where something makes it ask anyway, the office says yes…
    const f = await h.start('fake-claude', { name: 'Fully', mode: 'full' });
    const ran = await h.turn(f.id, 'run:make; ask:rm -rf build');
    assert.equal(ran.said, 'run=allow in bypassPermissions\ndecision=allow');
    assert.deepEqual(ran.entries.filter((x) => x.kind === 'permission').map((x) => [x.state, x.reason]), [['auto-allowed', 'the session runs in full-access mode']]);
    // …except to what Claude insists a person sees even while it bypasses everything else: its own safety
    // checks, and a rule of the operator's own that says "ask". Full mode does not overrule the operator.
    // Somebody who chose "acts without asking" is told on the request itself why they are asked anyway.
    for (const [step, summary, why, said] of [
      ['guard:.git/config', 'Wants to change: .git/config', 'Claude’s own safety check: Claude requested permissions to edit .git/config which is a sensitive file. It is put to a person in every mode.', 'guard=allow'],
      ['rule:git push origin main', 'Wants to run: git push origin main', 'A rule of yours says to ask before this: Bash(git push:*) (in your Claude settings). It is put to a person in every mode.', 'rule=allow'],
    ]) {
      n = await h.begin(f.id, step);
      card = await h.need(f.id);
      assert.equal(card.message, `${summary}\n${why}`);
      assert.equal(card.request.detail, why);
      assert.deepEqual(card.actions, ['once', 'reject']);
      await h.answer(card.id, { action: 'once' });
      await h.turnDone(f.id, n);
      assert.equal((await h.turnView(f.id, n)).said, said);
      assert.equal((await h.turnView(f.id, n)).entries.find((x) => x.kind === 'permission').state, 'allowed');
    }
    // Each reason Claude can give for insisting, in the words the person reads…
    for (const [fields, why] of [
      [{ decision_reason_type: 'hook', decision_reason: 'Blocked by the pre-push hook' }, 'A hook of yours says to ask before this: Blocked by the pre-push hook.'],
      [{ decision_reason_type: 'sandboxOverride' }, 'Claude wants to run this outside its own sandbox.'],
      [{ decision_reason_type: 'classifier', decision_reason: 'This looks like sending data away' }, 'Claude’s own classifier would not pass this by itself: This looks like sending data away.'],
      [{ decision_reason_type: 'subcommandResults', classifier_approvable: false, decision_reason: '\u001b[31mDangerous rm\u001b[0m of a directory' }, 'Claude’s own safety check: Dangerous rm of a directory.'],
      [{ default_to_no: true }, 'Claude’s own safety check asks for a person here.'],
      [{ decision_reason_type: 'rule' }, 'A rule of yours says to ask before this.'],
      [{ matched_ask_rule: { source: 'projectSettings', tool_name: 'Bash' }, decision_reason: 'Runs a deploy' }, 'A rule of yours says to ask before this: Bash (in this project’s Claude settings). Runs a deploy.'],
    ]) {
      n = await h.begin(f.id, `flag:${JSON.stringify(fields)}`);
      card = await h.need(f.id);
      assert.equal(card.request.detail, `${why} It is put to a person in every mode.`);
      await h.answer(card.id, { action: 'reject' });
      await h.turnDone(f.id, n);
    }
    // …and the reasons that are ordinary: those the mode answers as before.
    for (const fields of [{ decision_reason_type: 'other', decision_reason: 'This command requires approval' }, { decision_reason_type: 'workingDir' },
      { decision_reason_type: 'safetyCheck'.toUpperCase() }, { classifier_approvable: true }, { default_to_no: 'yes' }, { matched_ask_rule: 'nonsense' }]) {
      const ordinary = await h.turn(f.id, `flag:${JSON.stringify(fields)}`);
      assert.equal(ordinary.said, 'flag=allow', JSON.stringify(fields));
      assert.equal(ordinary.entries.find((x) => x.kind === 'permission').state, 'auto-allowed');
    }
    await end(f.id);

    // The same under a grant: "commands for this session" does not cover what an ask rule singles out.
    const g = await h.start('fake-claude', { name: 'Granted' });
    n = await h.begin(g.id, 'ask:npm test');
    await h.answer((await h.need(g.id)).id, { action: 'always' });
    await h.turnDone(g.id, n);
    assert.equal((await h.turn(g.id, 'ask:npm run lint')).entries.find((x) => x.kind === 'permission').state, 'auto-allowed');
    n = await h.begin(g.id, 'rule:git push origin main');
    card = await h.need(g.id);
    await h.answer(card.id, { action: 'reject' });
    await h.turnDone(g.id, n);
    assert.equal((await h.turnView(g.id, n)).said, 'rule=deny');
    await end(g.id);

    // Claude's own "dontAsk" mode refuses by itself; the office is told, and shows it.
    const d = await h.start('fake-claude', { name: 'Dont', agentMode: 'dontAsk' });
    assert.equal(d.agentMode, 'dontAsk');
    const denied = await h.turn(d.id, 'run:make');
    assert.equal(denied.said, 'run=deny (by itself) in dontAsk');
    assert.ok((await notices(d.id)).includes('Claude refused a Bash call by its own rules: Permission to use Bash has been denied.'));
    assert.equal(denied.entries.find((x) => x.kind === 'tool').status, 'failed');
    await end(d.id);
  });

  await t.test('a question from Claude is answered in words, keyed the way Claude keys it', async () => {
    const s = await h.start('fake-claude', { name: 'Asker' });
    let n = await h.begin(s.id, 'question:Which Tailwind version?');
    let card = await h.need(s.id);
    assert.equal(card.kind, 'question');
    assert.deepEqual(card.actions, ['reply'], 'a question has no allow or reject');
    assert.match(card.message, /Choose: Which Tailwind version\? \(v3 \/ v4\)/);
    assert.deepEqual(card.ask.questions, [{ id: 'q1', header: 'Choose', text: 'Which Tailwind version?', options: ['v3', 'v4'] }]);
    assert.equal((await h.agent(s.id)).blockKind, 'question');
    assert.equal((await h.turnView(s.id, n)).entries.filter((e) => e.kind === 'tool').length, 0, 'the question is shown as a question, not as a tool');
    assert.equal((await h.answer(card.id, {})).status, 400);
    assert.equal((await h.answer(card.id, { text: 'v4' })).data.answered, 'answered');
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'answer=v4');
    const answered = (await told(s.id)).lastAnswer;
    assert.deepEqual(answered.updatedInput.answers, { 'Which Tailwind version?': 'v4' }, 'the answer is the tool\'s own input, completed');
    assert.equal(answered.updatedInput.questions.length, 1);

    n = await h.begin(s.id, 'question:Which database?|Which port?');
    card = await h.need(s.id);
    assert.match(card.message, /Answer each on its own line, in order/);
    await h.answer(card.id, { text: 'postgres\n5432' });
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'answer=postgres,5432');

    n = await h.begin(s.id, 'question:And the cache?');
    card = await h.need(s.id);
    await h.answer(card.id, { action: 'reject' });
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'answer=', 'declining is an answer too: Claude is not left waiting');
    assert.equal((await h.turnView(s.id, n)).entries.find((e) => e.kind === 'question').state, 'rejected');
    await end(s.id);
  });

  await t.test('model, effort and Claude\'s own mode are what Claude lists, and each change is a request Claude answers', async () => {
    const s = await h.start('fake-claude', { name: 'Tuner' });
    assert.deepEqual(s.controls.model.options, ['default', 'fake-sonnet', 'fake-opus'], 'the models are the ones its initialize answer listed');
    assert.deepEqual(s.controls.model.labels, { default: 'Default (recommended)', 'fake-sonnet': 'Fake Sonnet', 'fake-opus': 'Fake Opus' });
    assert.deepEqual([s.controls.model.free, s.controls.model.available, s.controls.model.applies], [true, true, undefined]);
    assert.deepEqual(s.controls.effort.options, ['low', 'medium', 'high']);
    assert.deepEqual([s.controls.agentMode.value, s.controls.agentMode.options], ['default', ['default', 'plan', 'dontAsk']], 'its own modes, as far as the session\'s mode lets it go');
    assert.deepEqual(s.controls.agentMode.labels, { default: 'Manual', plan: 'Plan', dontAsk: 'Don’t ask' });

    // the model: set_model, and Claude's answer is what is believed
    const m = await set(s.id, { model: 'fake-opus' });
    assert.equal(m.status, 200);
    assert.deepEqual([m.data.session.model, m.data.session.controls.effort.options], ['fake-opus', ['low', 'medium', 'high', 'max']]);
    assert.ok((await notices(s.id)).includes('Model set to “Fake Opus” by Lead.'));
    assert.equal((await h.agent(s.id)).model, 'fake-opus');
    // effort: there is no request for it alone; it is a setting, merged into the session's own layer of them
    assert.equal((await set(s.id, { effort: 'max' })).data.session.effort, 'max');
    let now = await told(s.id);
    assert.deepEqual([now.modelRequests, now.settingsRequests, now.model, now.effort], [['fake-opus'], [{ effortLevel: 'max' }], 'claude-fake-opus-1', 'max']);
    assert.equal((await h.session(s.id)).model, 'fake-opus', 'the turn\'s own account of the model agrees with the alias, so the alias stays');
    // a model that cannot think that hard: the office stops claiming an effort it can no longer vouch for
    const back = await set(s.id, { model: 'fake-sonnet' });
    assert.deepEqual([back.data.session.model, back.data.session.effort, back.data.session.controls.effort.options], ['fake-sonnet', '', ['low', 'medium', 'high']]);
    assert.ok((await notices(s.id)).some((x) => /does not list the effort “max” that was set \(it has low, medium, high\)/.test(x)));
    assert.match((await set(s.id, { effort: 'max' })).data.error, /effort must be one of low, medium, high/);
    // a model that is not on the list is Claude's to accept or refuse, in its own words
    const own = await set(s.id, { model: 'my-own-model' });
    assert.deepEqual([own.status, own.data.session.model, own.data.session.controls.effort.available], [200, 'my-own-model', false]);
    const no = await set(s.id, { model: 'no-such-model' });
    assert.equal(no.status, 502);
    assert.match(no.data.error, /Fake Claude did not take that: set_model: the model "no-such-model" is not available to this account/);
    assert.equal((await h.session(s.id)).model, 'my-own-model', 'a refusal changes nothing');

    // its own mode: set_permission_mode, recorded as the person's doing — once
    const p = await set(s.id, { agentMode: 'plan' });
    assert.equal(p.data.session.agentMode, 'plan');
    let said = await notices(s.id);
    assert.ok(said.includes('Its own mode set to “Plan” by Lead.'));
    assert.ok(!said.some((x) => /switched to its/.test(x)), 'Claude did not switch by itself, so nothing says it did');
    assert.equal((await told(s.id)).mode, 'plan');
    // Leaving plan mode is Claude's own tool: the plan is shown, the human decides, and Claude says where it went.
    const n = await h.begin(s.id, 'planmode:1. Rename the module. 2. Run the tests.');
    const card = await h.need(s.id);
    assert.equal(card.message, 'Wants permission: Leave plan mode and carry out the plan\nClaude has a plan and asks to carry it out. It is put to a person in every mode.');
    assert.deepEqual(card.actions, ['once', 'reject']);
    assert.equal((await h.entry(s.id, 'plan')).note, '1. Rename the module. 2. Run the tests.', 'read from the request to approve it, where this Claude puts it');
    await h.answer(card.id, { action: 'once' });
    await h.turnDone(s.id, n);
    assert.equal((await h.turnView(s.id, n)).said, 'plan=allow now default');
    assert.equal((await h.session(s.id)).agentMode, 'default');
    assert.ok((await notices(s.id)).includes('The agent switched to its “default” mode.'));
    // a mode that goes further than the session's is not offered, and the adapter itself refuses it too
    const far = await set(s.id, { agentMode: 'acceptEdits' });
    assert.deepEqual([far.status, far.data.error], [400, 'own mode must be one of default, plan, dontAsk']);
    const adapter = h.ctx.harness.session(s.id).adapter;
    await assert.rejects(adapter.setMode('bypassPermissions'), /its “bypassPermissions” mode goes further than this session's “ask” mode allows; change the session's mode first/);
    await assert.rejects(adapter.setMode('yolo'), /Claude's own modes are default, plan, dontAsk, acceptEdits, bypassPermissions/);
    await assert.rejects(adapter.setMode('auto'), /Claude's own modes are/, 'its auto mode is known, and not offered');
    assert.deepEqual((await told(s.id)).modeRequests, ['plan'], 'neither was ever put to Claude');
    await end(s.id);

    // A Claude that says yes and stays where it is: its answer is believed, and the change is refused.
    const stub = await h.start('fake-claude-stubborn');
    const stuck = await set(stub.id, { agentMode: 'plan' });
    assert.equal(stuck.status, 502);
    assert.match(stuck.data.error, /did not take that: Claude answered that it is in its “default” mode/);
    assert.equal((await h.session(stub.id)).agentMode, 'default');
    await end(stub.id);
  });

  await t.test('changing the session\'s mode moves Claude with it; tightening is never taken on trust', async () => {
    // ask → edits → full, on a Claude that was started asking: it follows as far as it was started able to go.
    const s = await h.start('fake-claude', { name: 'Loosen' });
    const edits = await set(s.id, { mode: 'edits' });
    assert.deepEqual([edits.status, edits.data.session.mode, edits.data.session.agentMode], [200, 'edits', 'acceptEdits']);
    assert.deepEqual(edits.data.session.controls.agentMode.options, ['default', 'plan', 'dontAsk', 'acceptEdits'], 'the ceiling for its own modes moved too');
    assert.equal((await h.turn(s.id, 'write:src/a.js')).said, 'write=allow in acceptEdits');
    // The move is the office's own doing, and is written down as that — not as Claude switching by itself.
    assert.deepEqual((await notices(s.id)).slice(-2), ['Claude\'s own mode is now “acceptEdits”.', 'Mode set to “edits” by Lead.']);
    const full = await set(s.id, { mode: 'full' });
    assert.deepEqual([full.data.session.mode, full.data.session.agentMode], ['full', 'acceptEdits']);
    assert.ok(!full.data.session.controls.agentMode.options.includes('bypassPermissions'), 'a Claude that cannot enter its bypass mode is not offered it');
    assert.ok((await notices(s.id)).some((x) => /was not started able to bypass its permission checks, so it goes no further than its “acceptEdits” mode: it asks about the rest, and the office answers for it/.test(x)));
    const ran = await h.turn(s.id, 'run:make');
    assert.equal(ran.said, 'run=allow in acceptEdits');
    assert.equal(ran.entries.find((e) => e.kind === 'permission').state, 'auto-allowed');
    assert.deepEqual((await told(s.id)).modeRequests, ['acceptEdits']);
    assert.ok((await notices(s.id)).includes('Mode set to “full” by Lead.'));
    await end(s.id);

    // full → ask while Claude bypasses its checks: Claude is brought back first, and only then does the session say "ask".
    const f = await h.start('fake-claude', { name: 'Tighten', mode: 'full' });
    assert.deepEqual(f.controls.agentMode.options, ['default', 'plan', 'dontAsk', 'acceptEdits', 'bypassPermissions']);
    assert.equal((await h.turn(f.id, 'run:make')).said, 'run=allow in bypassPermissions');
    const ask = await set(f.id, { mode: 'ask' });
    assert.deepEqual([ask.status, ask.data.session.mode, ask.data.session.agentMode], [200, 'ask', 'default']);
    assert.deepEqual(ask.data.session.controls.agentMode.options, ['default', 'plan', 'dontAsk']);
    let n = await h.begin(f.id, 'run:make');
    let card = await h.need(f.id);                               // the same command is now the human's call
    await h.answer(card.id, { action: 'reject' });
    await h.turnDone(f.id, n);
    assert.equal((await h.turnView(f.id, n)).said, 'run=deny in default');
    assert.deepEqual((await told(f.id)).modeRequests, ['default']);
    assert.ok((await notices(f.id)).includes('Claude\'s own mode is now “default”.'));

    // The same for a mode somebody chose for it: back up to full, into acceptEdits by hand, then down to ask.
    await set(f.id, { mode: 'full' });
    assert.equal((await h.session(f.id)).agentMode, 'bypassPermissions', 'loosening follows, where Claude was simply following the session');
    assert.equal((await set(f.id, { agentMode: 'acceptEdits' })).data.session.agentMode, 'acceptEdits');
    const down = await set(f.id, { mode: 'ask' });
    assert.deepEqual([down.data.session.mode, down.data.session.agentMode], ['ask', 'default'], 'a broader mode of its own does not survive a narrower session');
    // A careful mode somebody chose is left alone, in both directions.
    await set(f.id, { agentMode: 'dontAsk' });
    assert.equal((await set(f.id, { mode: 'edits' })).data.session.agentMode, 'dontAsk');
    assert.equal((await set(f.id, { mode: 'ask' })).data.session.agentMode, 'dontAsk');
    await end(f.id);

    // Plan mode remembers where to go back to. A session that tightens while Claude plans must not come out
    // of the plan bypassing again: it is taken out and put back, so that what it returns to is within the mode.
    const p = await h.start('fake-claude', { name: 'Planner', mode: 'full' });
    await set(p.id, { agentMode: 'plan' });
    assert.equal((await set(p.id, { mode: 'ask' })).data.session.agentMode, 'plan');
    n = await h.begin(p.id, 'planmode:Do it.');
    card = await h.need(p.id);
    await h.answer(card.id, { action: 'once' });
    await h.turnDone(p.id, n);
    assert.equal((await h.turnView(p.id, n)).said, 'plan=allow now default', 'not bypassPermissions, where it was when it started planning');
    assert.deepEqual((await told(p.id)).modeRequests, ['plan', 'default', 'plan']);
    assert.deepEqual((await notices(p.id)).slice(0, 2), ['Its own mode set to “Plan” by Lead.', 'Mode set to “ask” by Lead.'], 'it ended where it was, so nothing says it moved');
    assert.equal((await h.session(p.id)).live, true);
    // A plan is for a person to read: even a session that allows everything does not approve one by itself.
    await set(p.id, { mode: 'full' });
    await set(p.id, { agentMode: 'plan' });
    n = await h.begin(p.id, 'planmode:Delete the old module.');
    card = await h.need(p.id);
    assert.equal((await h.entry(p.id, 'plan')).note, 'Delete the old module.');
    await h.answer(card.id, { action: 'reject' });
    await h.turnDone(p.id, n);
    assert.equal((await h.turnView(p.id, n)).said, 'plan=deny now plan', 'declined, it goes on planning');
    await end(p.id);

    // A Claude that will not be made more careful: the change is refused and the session keeps saying what is true.
    for (const [adapter, why] of [['fake-claude-sticky', /did not take that: set_permission_mode failed/], ['fake-claude-stubborn', /did not take that: Claude answered that it is in its “bypassPermissions” mode/]]) {
      const x = await h.start(adapter, { mode: 'full' });
      const refused = await set(x.id, { mode: 'ask' });
      assert.equal(refused.status, 502, adapter);
      assert.match(refused.data.error, why);
      const after = await h.session(x.id);
      assert.deepEqual([after.mode, after.agentMode, after.controls.mode.value], ['full', 'bypassPermissions', 'full'], `${adapter}: the session still says full, because Claude still is`);
      assert.ok(!(await notices(x.id)).some((e) => /Mode set to|own mode is now/.test(e)), 'and nothing is written down as changed');
      assert.equal(h.ctx.harness.session(x.id).adapter.access, 'full');
      assert.equal((await h.turn(x.id, 'ask:true')).entries.find((e) => e.kind === 'permission').state, 'auto-allowed');
      await end(x.id);
    }

    // Loosening cannot fail that way: a Claude that will not go further keeps asking, and the office answers by the new mode.
    const k = await h.start('fake-claude-stubborn', { name: 'Keeps' });
    const loose = await set(k.id, { mode: 'edits' });
    assert.deepEqual([loose.status, loose.data.session.mode, loose.data.session.agentMode], [200, 'edits', 'default']);
    assert.ok((await notices(k.id)).some((x) => /Claude would not switch to its “acceptEdits” mode \(Claude answered that it is in its “default” mode\); it keeps asking, and the office answers for it/.test(x)));
    const w = await h.turn(k.id, 'write:src/a.js');
    assert.equal(w.said, 'write=allow in default');
    assert.equal(w.entries.find((e) => e.kind === 'permission').state, 'auto-allowed');
    await end(k.id);
  });

  await t.test('Claude never ends up going further than the session shows', async () => {
    // It may make itself more careful, and that is only noted.
    const s = await h.start('fake-claude', { name: 'Careful', mode: 'edits' });
    await h.turn(s.id, 'mode:plan; say:planning');
    assert.equal((await h.session(s.id)).agentMode, 'plan');
    assert.ok((await notices(s.id)).includes('The agent switched to its “plan” mode.'));
    // It may not make itself freer: it is put back at once, and the record says what happened.
    const n = await h.begin(s.id, 'mode:bypassPermissions; sleep:150; report');
    await h.turnDone(s.id, n);
    const after = JSON.parse((await h.turnView(s.id, n)).said);
    assert.deepEqual([after.mode, after.modeRequests], ['acceptEdits', ['acceptEdits']]);
    assert.equal((await h.session(s.id)).agentMode, 'acceptEdits');
    assert.ok((await notices(s.id, 'warn')).includes('Claude put itself in its “bypassPermissions” mode, which goes further than this session\'s “edits” mode allows. The office put it back in “acceptEdits”.'));
    assert.equal((await h.session(s.id)).live, true);
    await end(s.id);

    // Its "auto" mode acts on its own judgement: fine under a session that allows everything, too far under any other.
    const a = await h.start('fake-claude', { name: 'Auto', mode: 'full' });
    await h.turn(a.id, 'mode:auto; say:on my own judgement');
    assert.equal((await h.session(a.id)).agentMode, 'auto');
    assert.deepEqual(await notices(a.id, 'warn'), []);
    assert.equal((await set(a.id, { mode: 'edits' })).data.session.agentMode, 'acceptEdits', 'and it does not survive the session being tightened');
    await end(a.id);

    // One that will not come back is ended: better no agent than one that runs with more than the session shows.
    for (const adapter of ['fake-claude-sticky', 'fake-claude-stubborn']) {
      const x = await h.start(adapter, { name: adapter === 'fake-claude-sticky' ? 'Sticky' : 'Stubborn' });
      const k = await h.begin(x.id, 'mode:acceptEdits; sleep:2000; say:never said');
      assert.equal((await h.turnDone(x.id, k)).state, 'failed', adapter);
      const dead = await gone(x.id);
      assert.equal(dead.state, 'failed');
      assert.match(dead.reason, /it would not stay within the session’s mode, so the office ended its process/);
      assert.ok((await notices(x.id, 'error')).some((e) => /Claude is in its “acceptEdits” mode, which goes further than this session's “ask” mode, and would not leave it .*The office ended it\./.test(e)), adapter);
    }
  });

  await t.test('interrupt is a request Claude acknowledges; what it was waiting on is withdrawn; one that ignores it loses its process', async () => {
    const s = await h.start('fake-claude', { name: 'Halt' });
    const pid = h.ctx.harness.session(s.id).adapter.proc.pid;
    let n = await h.begin(s.id, 'say:going; slow');
    await waitFor(async () => (await h.turnView(s.id, n)).said.includes('..'), { what: 'Claude to be mid-stream' });
    assert.equal((await h.post(`/api/harness/sessions/${s.id}/interrupt`)).data.interrupted, true);
    const stopped = await h.turnDone(s.id, n);
    assert.deepEqual([stopped.state, stopped.stoppedBy], ['interrupted', 'Lead']);
    assert.equal((await h.session(s.id)).state, 'idle', 'the session survives a stop');

    // A stop while Claude waits on the human: its question is answered first (no, and stop), then it is interrupted.
    n = await h.begin(s.id, 'ask:sleep 600');
    const card = await h.need(s.id);
    await h.post(`/api/harness/sessions/${s.id}/interrupt`);
    assert.equal((await h.turnDone(s.id, n)).state, 'interrupted');
    assert.equal((await h.get('/api/prompts')).data.find((p) => p.id === card.id).status, 'resolved');
    assert.equal((await h.entry(s.id, 'perm:' + card.request.id)).state, 'withdrawn');
    assert.equal((await h.turnView(s.id, n)).said, '', 'nothing was said after the stop');
    const after = await told(s.id);
    assert.equal(after.interrupts, 2);
    assert.deepEqual([after.lastAnswer.behavior, after.lastAnswer.interrupt], ['deny', true]);
    assert.equal(after.strayAnswers, 0);
    assert.equal((await h.post(`/api/harness/sessions/${s.id}/interrupt`)).data.interrupted, false, 'nothing to stop is not an error');

    // A Claude that acknowledges the stop and carries on anyway loses its whole process group.
    const k = await h.begin(s.id, 'ignore-cancel; slow');
    await waitFor(async () => (await h.turnView(s.id, k)).said.includes('..'), { what: 'the stubborn Claude to be mid-stream' });
    await h.post(`/api/harness/sessions/${s.id}/interrupt`);
    assert.equal((await h.turnDone(s.id, k)).state, 'failed');
    const dead = await gone(s.id);
    assert.equal(dead.state, 'failed');
    assert.match(dead.reason, /did not stop when asked/);
    assert.ok((await notices(s.id, 'warn')).includes('Claude did not confirm the stop; its process was ended.'));
    await waitFor(() => { try { process.kill(pid, 0); return false; } catch { return true; } }, { what: 'the process to be gone' });

    // Ending a session ends everything Claude started, not only Claude.
    const g = await h.start('fake-claude', { name: 'Parent' });
    const left = Number(/^child=(\d+)$/.exec((await h.turn(g.id, 'child')).said)[1]);
    const alive = (p) => { try { process.kill(p, 0); return true; } catch { return false; } };
    assert.ok(alive(left));
    await end(g.id);
    await waitFor(() => !alive(left), { what: 'what Claude left running to be gone' });

    // An older Claude says less about why a turn ended; a stop is still a stop.
    const old = await h.start('fake-claude-old', { name: 'Elder' });
    n = await h.begin(old.id, 'say:going; slow');
    await waitFor(async () => (await h.turnView(old.id, n)).said.includes('..'), { what: 'the older Claude to be mid-stream' });
    await h.post(`/api/harness/sessions/${old.id}/interrupt`);
    assert.equal((await h.turnDone(old.id, n)).state, 'interrupted');
    assert.equal((await h.turn(old.id, 'say:and on')).said, 'and on', 'its results name no message, and still end the right turn');
    await end(old.id);
  });

  await t.test('a failed turn is reported in Claude\'s words; a crash is cleaned up', async () => {
    const s = await h.start('fake-claude', { name: 'Fragile' });
    const failed = await h.turn(s.id, 'say:trying; error:You have hit your usage limit');
    assert.equal(failed.turn.state, 'failed');
    assert.equal(failed.turn.error, 'You have hit your usage limit', 'Claude\'s own diagnostics line is not shown to a person');
    assert.equal((await h.session(s.id)).state, 'idle', 'a failed turn does not end the session');

    // A login that has expired looks like a reply and a "successful" result; the office says what to do about it.
    const auth = await h.turn(s.id, 'authfail');
    assert.equal(auth.turn.state, 'failed');
    assert.match(auth.turn.error, /Failed to authenticate\. API Error: 401/);
    assert.ok((await notices(s.id, 'error')).some((x) => /Claude Code is not signed in, or its login has expired\. Run `claude` once in a terminal and log in/.test(x)));
    assert.equal((await h.session(s.id)).model, 'claude-fake-sonnet-1', 'the model named on an error message that no model wrote is not taken for the session\'s');

    // Endings that are not failures: out of turns, out of tokens. And one that is: the model declining.
    const turns = await h.turn(s.id, 'say:half; stop:max_turns');
    assert.deepEqual([turns.turn.state, turns.turn.stopReason], ['completed', 'max_turn_requests']);
    assert.ok(turns.entries.some((e) => e.kind === 'notice' && /hit a limit \(max_turn_requests\)/.test(e.text)));
    assert.equal((await h.turn(s.id, 'say:half an answ; stop:max_tokens')).turn.stopReason, 'max_tokens');
    const refusal = await h.turn(s.id, 'stop:refusal');
    assert.deepEqual([refusal.turn.state, refusal.turn.error], ['failed', 'the model declined to continue']);

    const n = await h.begin(s.id, 'tool:make; crash:4');
    assert.equal((await h.turnDone(s.id, n)).state, 'failed');
    const dead = await gone(s.id);
    assert.equal(dead.state, 'failed');
    assert.match(dead.reason, /exited with code 4/);
    assert.match(dead.reason, /fake claude was told to crash/);
    assert.equal((await h.turnView(s.id, n)).entries.find((e) => e.kind === 'tool').status, 'completed');
    assert.ok((await h.activity()).some((e) => e.kind === 'agent-crash' && /Fragile/.test(e.text)));

    // A crash while Claude waits on the human takes the card with it.
    const w = await h.start('fake-claude', { name: 'Waity' });
    await h.begin(w.id, 'ask:true');
    const card = await h.need(w.id);
    h.ctx.harness.session(w.id).adapter.proc.child.kill('SIGKILL');
    await gone(w.id);
    assert.equal((await h.get('/api/prompts')).data.find((p) => p.id === card.id).status, 'resolved');
    assert.match((await h.session(w.id)).reason, /SIGKILL/);
  });

  await t.test('a Claude that will not start says why, in its own words where it has them', async () => {
    const count = (await h.get('/api/health')).data.drivenSessions;
    // Its own frame about a known start-up failure says more than an exit status does.
    const broken = await h.post('/api/harness/sessions', { adapter: 'fake-claude-broken', cwd: h.work });
    assert.equal(broken.status, 502);
    assert.equal(broken.data.error, 'Fake Claude (bad config) could not start: The configuration file ~/.claude.json is not valid JSON. Restore it from its backup, then start again.');
    // Otherwise the end of stderr explains it — here, the refusal Claude gives as root.
    const refused = await h.post('/api/harness/sessions', { adapter: 'fake-claude-root', cwd: h.work, mode: 'full' });
    assert.equal(refused.status, 502);
    assert.match(refused.data.error, /could not start: the agent process exited with code 1: --dangerously-skip-permissions cannot be used with root\/sudo privileges for security reasons/);
    assert.equal((await h.start('fake-claude-root', { mode: 'edits' })).agentMode, 'acceptEdits', 'the same Claude starts fine when nothing asks it to bypass');
    // An operator's entry may add arguments, but not the ones the office decides: nothing is started at all.
    const reserved = await h.post('/api/harness/sessions', { adapter: 'fake-claude-reserved', cwd: h.work });
    assert.equal(reserved.status, 502);
    assert.match(reserved.data.error, /this adapter entry passes --permission-mode, which the office sets itself .* Take it out of the entry's args\./);
    assert.equal((await h.get('/api/health')).data.drivenSessions, count + 1);
    for (const x of (await h.get('/api/harness/sessions')).data.sessions.filter((v) => v.adapter === 'fake-claude-root')) await end(x.id);
  });

  await t.test('as root, "full" is one step short of bypassing, and the office answers the rest', async () => {
    // Claude Code refuses to start able to bypass its checks as root outside a sandbox. This fake refuses the
    // same way, so the session below starts only because the adapter did not ask for it.
    const uid = process.getuid;
    process.getuid = () => 0;
    let s;
    try { s = await h.start('fake-claude-asroot', { name: 'Rooty', mode: 'full' }); }
    finally { process.getuid = uid; }
    assert.deepEqual([s.mode, s.agentMode], ['full', 'acceptEdits']);
    assert.ok(!s.controls.agentMode.options.includes('bypassPermissions'));
    assert.ok((await notices(s.id)).includes('Claude Code will not bypass its permission checks as root, so it runs in its “acceptEdits” mode: it asks about the rest, and the office answers for it.'));
    const first = await told(s.id);
    assert.deepEqual(first.args.slice(WIRE.length + 2), ['--permission-mode', 'acceptEdits']);
    const ran = await h.turn(s.id, 'run:make');
    assert.equal(ran.said, 'run=allow in acceptEdits');
    assert.equal(ran.entries.find((e) => e.kind === 'permission').reason, 'the session runs in full-access mode');
    await assert.rejects(h.ctx.harness.session(s.id).adapter.setMode('bypassPermissions'), /was not started able to bypass its permission checks/);
    await end(s.id);

    // Anybody else's Claude, with the same environment, bypasses.
    process.getuid = () => 1000;
    let u;
    try { u = await h.start('fake-claude-user', { mode: 'full' }); }
    finally { process.getuid = uid; }
    assert.equal(u.agentMode, 'bypassPermissions');
    await end(u.id);
  });

  await t.test('the plan\'s allowance: asked once at the start, followed from the stream, passed on as usage reports', async () => {
    const reports = [];
    const onReport = (e) => reports.push(e.report);
    h.ctx.bus.on('usage:report', onReport);
    t.after(() => h.ctx.bus.off('usage:report', onReport));

    const s = await h.start('fake-claude', { name: 'Meter' });
    const first = await waitFor(() => reports[0], { what: 'the first usage report' });
    assert.deepEqual(first, { provider: 'claude', plan: 'max', source: 'driven', agentId: s.id, replace: true, windows: [
      { id: 'five_hour', kind: 'session', label: 'Session', usedPercent: 42, resetsAt: 1_900_000_000_000, windowMins: 300 },
      { id: 'seven_day', kind: 'weekly', label: 'Week', usedPercent: 71.5, resetsAt: 1_900_086_400_000, windowMins: 10080 },
    ] }, 'the same window ids, kinds and labels as the office reads from Claude Code\'s status line');
    assert.equal((await h.session(s.id)).limits.plan, 'max');
    const meter = await waitFor(async () => (await h.get('/api/usage')).data.meters.find((m) => m.provider === 'claude'), { what: 'the usage meter' });
    assert.deepEqual([meter.source, meter.plan, meter.via], ['driven', 'max', s.id]);

    // In the stream the share used is a fraction and the report is partial: what Claude leaves out keeps its last value.
    await h.turn(s.id, 'limits:90; say:ok');
    await waitFor(() => reports.length === 2, { what: 'the update' });
    assert.deepEqual(reports[1].windows.map((w) => [w.id, w.usedPercent]), [['five_hour', 90], ['seven_day', 71.5]]);
    assert.equal(reports[1].plan, 'max');
    // One model's own weekly window is not the account's allowance, and a repeat is not news.
    await h.turn(s.id, 'limits:opus:5; limits:90; say:ok');
    await sleep(60);
    assert.equal(reports.length, 2);
    // Where Claude sends every window it tracks at once, both are read.
    await h.turn(s.id, 'limits:95/80; say:ok');
    await waitFor(() => reports.length === 3, { what: 'both windows' });
    assert.deepEqual(reports[2].windows.map((w) => [w.id, w.usedPercent, w.resetsAt]), [['five_hour', 95, 1_900_000_000_000], ['seven_day', 80, 1_900_086_400_000]]);
    // Out of allowance, with nothing paid on top: said once, so that a turn that waits is not a mystery.
    await h.turn(s.id, 'limits:rejected; limits:rejected; say:ok');
    const out = (await notices(s.id, 'warn')).filter((x) => /used up its five-hour allowance/.test(x));
    assert.deepEqual(out, ['Claude has used up its five-hour allowance. It says the window reopens at 2030-03-17T17:46:40.000Z. A turn waits for that unless somebody stops it.']);
    assert.equal(reports.at(-1).windows[0].usedPercent, 100);
    const asked = await told(s.id);
    assert.deepEqual([asked.usageAsked, asked.usageParams], [1, { skip_behaviors: true }], 'asked once, and without the scan of old transcripts');
    await end(s.id);

    // A Claude that does not know the request has no answer: nothing breaks, nothing is invented.
    const before = reports.length;
    const old = await h.start('fake-claude-old', { name: 'Elder' });
    assert.equal((await h.turn(old.id, 'say:still works')).said, 'still works');
    assert.equal((await h.session(old.id)).limits, null);
    assert.equal(reports.length, before);
    // …but what its stream says is still passed on.
    await h.turn(old.id, 'limits:12; say:ok');
    await waitFor(() => reports.length === before + 1, { what: 'the older Claude\'s stream report' });
    assert.deepEqual(reports.at(-1).windows.map((w) => [w.id, w.usedPercent]), [['five_hour', 12]]);
    await end(old.id);
  });

  await t.test('the office tools go to Claude over the pipe, and the session token never shows', async () => {
    const s = await h.start('fake-claude', { name: 'Hedy' });
    const token = h.ctx.harness.session(s.id).adapter.opt.env.OFFICE_SESSION_TOKEN;
    assert.ok(token.length >= 40);
    const first = await told(s.id);
    assert.deepEqual(first.mcp, ['office'], 'handed over with mcp_set_servers, after initialize');
    assert.deepEqual(first.office, { url: true, agentId: s.id, token: true });
    assert.equal(first.argvHasToken, false, 'never on the command line, where every user of the machine could read it');
    assert.ok(!first.args.some((arg) => /mcp-config|OFFICE_SESSION_TOKEN/.test(arg)), 'and in no file either: there is no --mcp-config at all');
    if (fs.existsSync(`/proc/${process.pid}/cmdline`)) {
      const pid = h.ctx.harness.session(s.id).adapter.proc.pid;
      assert.ok(!fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(token));
    }
    // The server Claude was handed really is the office's, and answers as this agent.
    assert.match((await h.turn(s.id, 'mcp:office_who {}')).said, /Hedy/);
    assert.equal((await h.turn(s.id, 'post:hello from Claude')).said, 'post=200');
    const preamble = (await h.entry(s.id, 'session')).preamble;
    assert.match(preamble, /You have office tools \(the MCP server "office"/);

    // What it was given identifies it to the office; it never comes back out of the office's own records.
    const leaked = await h.turn(s.id, 'leak');
    assert.equal(leaked.said, 'my token is [office session token]');
    assert.equal(leaked.entries.find((e) => e.kind === 'tool').command, 'curl -H "x-office-session: [office session token]" localhost');
    assert.ok(!JSON.stringify(await h.entries(s.id)).includes(token));
    await end(s.id);
    const onDisk = await waitFor(() => { try { return fs.readFileSync(path.join(h.dir, 'harness', `${s.id}.jsonl`), 'utf8'); } catch { return ''; } }, { what: 'the transcript file' });
    assert.ok(onDisk.includes('my token is [office session token]') && !onDisk.includes(token));

    // A Claude that cannot start the server still works; the session says it has no office tools, and why —
    // without repeating Claude's error, which quotes the entry it was given.
    const bare = await h.start('fake-claude-nomcp', { name: 'Bare' });
    assert.equal(bare.features.officeTools, false);
    assert.deepEqual(await notices(bare.id, 'warn'), ['Claude could not start the office tools (MCP: office); it can still work, but cannot reach the office by itself.']);
    assert.equal((await h.turn(bare.id, 'say:still works')).said, 'still works');
    assert.match((await h.entry(bare.id, 'session')).preamble, /Reach the office from a shell with: node /);
    assert.ok((await notices(bare.id, 'warn')).includes('Claude reports that the office tools (MCP) failed to start; it cannot reach the office by itself.'));
    await end(bare.id);
  });

  await t.test('the office\'s own Claude hooks stay quiet for a Claude it drives', async (t2) => {
    // Claude Code driven this way still runs the hooks its operator installed — the office's own among them.
    const hook = (env, event) => new Promise((resolve) => {
      const child = spawn('sh', [path.join(ROOT, 'hooks', 'office-hook.sh')], { env, stdio: ['pipe', 'ignore', 'ignore'] });
      child.on('error', () => resolve(false));
      child.on('exit', () => resolve(true));
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify(event));
    });
    // The control: the same script, run by a Claude nobody drives, does seat an agent here.
    const env = { ...process.env, OFFICE_PORT: String(h.port) };
    delete env.OFFICE_RUNTIME_SESSION_ID;
    delete env.OFFICE_SESSION_TOKEN;
    const ran = await hook(env, { session_id: 'a-claude-nobody-drives', cwd: h.work, hook_event_name: 'SessionStart' });
    const seated = ran && await waitFor(async () => (await h.get('/api/agents/a-claude-nobody-drives')).status === 200, { timeout: 3000 }).catch(() => false);
    if (!seated) { t2.skip('the hook script cannot reach the office from here (it needs sh and curl)'); return; }
    await h.hook({ session_id: 'a-claude-nobody-drives', hook_event_name: 'SessionEnd' });

    const s = await h.start('fake-claude', { name: 'Solo' });
    const count = (await h.get('/api/agents')).data.filter((a) => a.status !== 'leaving').length;
    assert.equal((await h.turn(s.id, 'hook:SessionStart')).said, 'hook=0');
    const env2 = await told(s.id);
    assert.deepEqual([env2.launchedBy, env2.envToken], [s.id, true], 'what Claude\'s hooks inherit says which office session launched them');
    assert.equal((await h.get(`/api/agents/${s.nativeRef}`)).status, 404, 'no second avatar under Claude\'s own session id');
    assert.equal((await h.get('/api/agents')).data.filter((a) => a.status !== 'leaving').length, count);
    await end(s.id);
  });

  await t.test('output that is not the protocol is survived; a flood of it ends the session', async () => {
    const s = await h.start('fake-claude', { name: 'Noisy' });
    const ok = await h.turn(s.id, 'noise; say:fine; garbage; say:and still fine');
    assert.equal(ok.turn.state, 'completed');
    assert.equal(ok.said, 'fine\nand still fine', 'a line that starts like a frame and is not one is skipped, as Claude\'s own SDK skips it');
    assert.equal((await notices(s.id, 'warn')).filter((x) => /not its protocol/.test(x)).length, 1, 'said once, not per line');
    const n = await h.begin(s.id, `${'noise; '.repeat(45)}say:never seen`);
    assert.equal((await h.turnDone(s.id, n)).state, 'failed');
    const dead = await gone(s.id);
    assert.equal(dead.state, 'failed');
    assert.match(dead.reason, /writing something other than its protocol to stdout/);
  });

  await t.test('it is an ordinary citizen of the office: queued turns, mail, delegation', async () => {
    const s = await h.start('fake-claude', { name: 'Citizen' });
    const n = await h.begin(s.id, 'sleep:300; say:first');
    const queued = await h.post(`/api/harness/sessions/${s.id}/turn`, { text: 'say:second' });
    assert.equal(queued.data.queued, true);
    await h.turnDone(s.id, n + 1);
    assert.deepEqual([(await h.turnView(s.id, n)).said, (await h.turnView(s.id, n + 1)).said], ['first', 'second']);
    // It can hand a task to another agent through the office, like anyone holding a session token.
    const d = await h.turn(s.id, 'delegate:fake|say:done by the other one');
    assert.match(d.said, /^delegate=200:dg_/);
    // …and be handed one: the task arrives as its turn, and its last reply is the result.
    const task = await h.post('/api/delegations', { to: 'fake-claude', task: 'say:done by Claude', wait: true, timeoutMs: 15000 });
    assert.equal(task.status, 200);
    assert.deepEqual([task.data.delegation.status, task.data.delegation.result], ['completed', 'done by Claude']);
    for (const x of (await h.get('/api/harness/sessions')).data.sessions) await end(x.id);
  });
});

test('Claude Code: the raw frames can be kept for comparison, without the token', async () => {
  const traced = await office({ env: { OFFICE_HARNESS_TRACE: '1' } });
  try {
    const p = await traced.start('fake-claude');
    await traced.turn(p.id, 'say:traced');
    const secret = traced.ctx.harness.session(p.id).adapter.opt.env.OFFICE_SESSION_TOKEN;
    const frames = await waitFor(() => { try { return fs.readFileSync(path.join(traced.dir, 'harness', `${p.id}.trace.jsonl`), 'utf8'); } catch { return ''; } }, { what: 'the trace file' });
    const rows = frames.trim().split('\n').map((r) => JSON.parse(r));
    const sent = rows.filter((r) => r.dir === 'out').map((r) => JSON.parse(r.frame));
    assert.deepEqual(sent.slice(0, 3).map((f) => f.request.subtype), ['initialize', 'mcp_set_servers', 'get_usage'], 'the order of the handshake');
    assert.deepEqual(sent.map((f) => f.type), ['control_request', 'control_request', 'control_request', 'user']);
    assert.ok(rows.some((r) => r.dir === 'in' && r.frame.includes('text_delta')));
    assert.ok(frames.includes('OFFICE_SESSION_TOKEN') && !frames.includes(secret), 'the one frame that carries the token is kept with the token masked');
    assert.ok(frames.includes('[office session token]'));
  } finally { await traced.stop(); }

  const plain = await office({ env: { OFFICE_HARNESS_MCP: '0' } });
  try {
    const p = await plain.start('fake-claude');
    const told = JSON.parse((await plain.turn(p.id, 'report')).said);
    assert.deepEqual([told.mcp, p.features.officeTools], [[], false], 'OFFICE_HARNESS_MCP=0 keeps the office tools out');
  } finally { await plain.stop(); }
});

test('the catalog: Claude Code is driven natively, and its ACP wrapper is still there under its own id', () => {
  const dir = tempDir('office-claude-catalog-');
  const catalog = createCatalog({ harnessFile: path.join(dir, 'none.json'), harness: { injectMcp: true } }, null);
  const list = catalog.list();
  const own = list.find((a) => a.id === 'claude'), wrapped = list.find((a) => a.id === 'claude-acp');
  assert.deepEqual([own.protocol, own.command, own.provider, own.caps.nativeSandbox], ['claude-stream-json', 'claude', 'claude', false]);
  assert.deepEqual(catalog.get('claude').args, [], 'the adapter builds the command line; the entry only adds to it');
  assert.deepEqual([wrapped.protocol, wrapped.command, wrapped.provider], ['acp', 'claude-agent-acp', 'claude']);
  assert.match(wrapped.note, /npm i -g @agentclientprotocol\/claude-agent-acp/);
  assert.equal(list.find((a) => a.id === 'codex').caps.nativeSandbox, true);
  // An operator can point the protocol at a build of their own.
  const mine = parseAdapter({ id: 'claude-nightly', protocol: 'claude-stream-json', command: '/opt/claude-nightly/bin/claude', args: ['--settings', '/etc/claude/office.json'] });
  assert.deepEqual([mine.adapter.protocol, mine.adapter.args], ['claude-stream-json', ['--settings', '/etc/claude/office.json']]);
  assert.match(parseAdapter({ id: 'x', protocol: 'claude', command: 'claude' }).error, /protocol must be one of acp, codex-app-server, claude-stream-json/);
});

test('Claude allowance windows are the office\'s one reading of them, cleaned again', () => {
  assert.deepEqual(claudeLimits(null), { windows: [] });
  assert.deepEqual(claudeLimits({ five_hour: { used_percentage: 12.5, resets_at: 1_900_000_000 } }).windows,
    [{ id: 'five_hour', kind: 'session', label: 'Session', usedPercent: 12.5, resetsAt: 1_900_000_000_000, windowMins: 300 }]);
  // Untrusted numbers are clamped or dropped, never passed on raw.
  const odd = claudeLimits({ five_hour: { used_percentage: 250, resets_at: 'soon' }, seven_day: { used_percentage: 'lots' }, seven_day_opus: { used_percentage: 5 } });
  assert.deepEqual(odd.windows, [{ id: 'five_hour', kind: 'session', label: 'Session', usedPercent: 100, windowMins: 300 }]);
});

/* ---- the wire, by itself ------------------------------------------------------ */

function wirePair(opt = {}) {
  const toUs = new PassThrough(), fromUs = new PassThrough();
  const sent = [], frames = [], noise = [];
  let buf = '';
  fromUs.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { sent.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const wire = new StreamJsonWire({ readable: toUs, writable: fromUs, onFrame: (type, frame) => frames.push(frame), ...opt });
  wire.on('noise', (sample) => noise.push(sample));
  const feed = (v) => toUs.write(typeof v === 'string' ? v : JSON.stringify(v) + '\n');
  const settle = () => sleep(10);
  return { wire, sent, frames, noise, feed, toUs, settle };
}

test('stream-json wire: requests and their answers, both ways', async () => {
  const handled = [];
  const { wire, sent, feed, settle } = wirePair({
    onRequest: async (subtype, request, { id }) => {
      handled.push([subtype, id]);
      if (subtype === 'refuse') throw new RpcError(RPC.METHOD_NOT_FOUND, 'the office does not provide refuse');
      if (subtype === 'explode') throw new Error('a secret detail of our own');
      if (subtype === 'nothing') return undefined;
      return { behavior: 'allow' };
    },
  });
  // ours
  const asked = wire.request({ subtype: 'initialize', title: 'x' });
  await settle();
  assert.deepEqual(sent[0], { type: 'control_request', request_id: 'office-1', request: { subtype: 'initialize', title: 'x' } });
  feed({ type: 'control_response', response: { subtype: 'success', request_id: 'office-1', response: { models: [] } } });
  assert.deepEqual(await asked, { models: [] });
  const refused = wire.request({ subtype: 'set_model', model: 5 });
  feed({ type: 'control_response', response: { subtype: 'error', request_id: 'office-2', error: 'set_model: model must be a string' } });
  await assert.rejects(refused, (err) => err instanceof RpcError && err.message === 'set_model: model must be a string');
  const empty = wire.request({ subtype: 'apply_flag_settings', settings: {} });
  feed({ type: 'control_response', response: { subtype: 'success', request_id: 'office-3' } });
  assert.deepEqual(await empty, {}, 'a success with nothing in it is an empty answer');
  // an answer to nothing we asked, and a late duplicate, are dropped
  feed({ type: 'control_response', response: { subtype: 'success', request_id: 'office-99', response: {} } });
  feed({ type: 'control_response', response: { subtype: 'success', request_id: 'office-1', response: {} } });
  feed({ type: 'control_response', response: 'nonsense' });
  await settle();
  assert.equal(wire.stats.unroutable, 3);

  // Claude's
  sent.length = 0;
  feed({ type: 'control_request', request_id: 'r1', request: { subtype: 'can_use_tool', tool_name: 'Bash' } });
  feed({ type: 'control_request', request_id: 'r2', request: { subtype: 'refuse' } });
  feed({ type: 'control_request', request_id: 'r3', request: { subtype: 'explode' } });
  feed({ type: 'control_request', request_id: 'r4', request: { subtype: 'nothing' } });
  feed({ type: 'control_request', request_id: 'r5', request: {} });
  feed({ type: 'control_request', request_id: 'r6' });
  feed({ type: 'control_request', request: { subtype: 'can_use_tool' } });
  await settle();
  assert.deepEqual(sent.map((f) => [f.response.request_id, f.response.subtype, f.response.response ?? f.response.error]).sort(), [
    ['r1', 'success', { behavior: 'allow' }],
    ['r2', 'error', 'the office does not provide refuse'],
    ['r3', 'error', 'the client failed to handle this request'],
    ['r4', 'success', {}],
    ['r5', 'error', 'a control request needs a subtype'],
    ['r6', 'error', 'a control request needs a subtype'],
  ], 'every request with an id gets exactly one answer, and our own errors are not passed on');
  assert.ok(sent.every((f) => f.type === 'control_response'));
  assert.equal(wire.stats.unroutable, 4, 'a request without an id cannot be answered at all');
  wire.close();
});

test('stream-json wire: a request Claude withdraws is not answered; the same one twice is handled once; only so many are held', async () => {
  const waiting = new Map(), cancelled = [];
  const { wire, sent, feed, settle } = wirePair({
    onRequest: (subtype, request, { id }) => new Promise((resolve) => waiting.set(id, resolve)),
    onCancel: (id) => cancelled.push(id),
  });
  feed({ type: 'control_request', request_id: 'a', request: { subtype: 'can_use_tool' } });
  feed({ type: 'control_request', request_id: 'a', request: { subtype: 'can_use_tool' } });
  await settle();
  assert.equal(waiting.size, 1, 'redelivered while it is being answered: still one question');
  feed({ type: 'control_cancel_request', request_id: 'a' });
  feed({ type: 'control_cancel_request', request_id: 'never-asked' });
  await settle();
  assert.deepEqual(cancelled, ['a']);
  waiting.get('a')({ behavior: 'allow' });
  await settle();
  assert.deepEqual(sent, [], 'nothing is said into a request that was withdrawn');

  for (let i = 0; i < 40; i++) feed({ type: 'control_request', request_id: `q${i}`, request: { subtype: 'can_use_tool' } });
  await settle();
  assert.equal(waiting.size, 33, '32 more are held');
  assert.deepEqual(sent.map((f) => [f.response.request_id, f.response.error]), ['q32', 'q33', 'q34', 'q35', 'q36', 'q37', 'q38', 'q39'].map((id) => [id, 'too many requests are already waiting on the client']));
  wire.close();
});

test('stream-json wire: untrusted input — split frames, noise, giants, a flood', async () => {
  let pair = wirePair();
  const body = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'héllo → wörld' }] } });
  const bytes = Buffer.from(body + '\r\n' + '\n' + JSON.stringify({ type: 'keep_alive' }) + '\n');
  for (let i = 0; i < bytes.length; i += 7) pair.toUs.write(bytes.subarray(i, i + 7));      // cuts through lines and through characters
  await pair.settle();
  assert.equal(pair.frames.length, 1, 'a heartbeat is swallowed');
  assert.equal(pair.frames[0].message.content[0].text, 'héllo → wörld');
  // What is not a frame is counted and skipped: a banner, an array, a bare value, a torn object, an object with no type.
  pair.feed('Welcome to something a plugin printed\n');
  pair.feed('[1,2,3]\n');
  pair.feed('42\n');
  pair.feed('{"type":"assistant","message":{oops\n');
  pair.feed({ message: 'no type' });
  pair.feed({ type: 'x'.repeat(200) });
  pair.feed({ type: 'result', subtype: 'success' });
  await pair.settle();
  assert.deepEqual([pair.noise.length, pair.wire.stats.noise, pair.wire.stats.unroutable, pair.frames.length], [4, 4, 2, 2]);
  assert.equal(pair.wire.closed, false);
  // A last frame without its newline is still read when the stream ends.
  pair.toUs.end('{"type":"result","subtype":"error_during_execution"}');
  await pair.settle();
  assert.equal(pair.frames.at(-1).subtype, 'error_during_execution');
  assert.equal(pair.wire.closed, true);

  // A flood of noise ends the conversation, and says it was a protocol failure.
  pair = wirePair();
  let reason = null;
  pair.wire.on('close', (r) => { reason = r; });
  for (let i = 0; i < 41; i++) pair.feed(`log line ${i}\n`);
  await pair.settle();
  assert.equal(pair.wire.closed, true);
  assert.deepEqual([reason.protocol, reason.message], [true, 'the agent is writing something other than its protocol to stdout']);
  assert.equal(pair.wire.send({ type: 'user' }), false);
  await assert.rejects(pair.wire.request({ subtype: 'interrupt' }), RpcClosedError);

  // A line is bounded before it is parsed, however it arrives.
  pair = wirePair({ maxLineBytes: 1024 });
  pair.wire.on('close', (r) => { reason = r; });
  pair.feed({ type: 'assistant', pad: 'x'.repeat(900) });
  await pair.settle();
  assert.equal(pair.frames.length, 1);
  for (let i = 0; i < 6; i++) pair.toUs.write('y'.repeat(200));
  await pair.settle();
  assert.deepEqual([pair.wire.closed, reason.protocol, reason.message], [true, true, 'the agent sent a message larger than 1024 bytes']);
});

test('stream-json wire: a silent Claude times out, and is told we stopped waiting; a closed stream fails what was waiting', async () => {
  const { wire, sent, feed, toUs, settle } = wirePair();
  const slow = wire.request({ subtype: 'get_usage' }, { timeoutMs: 30 });
  // (The deadline's timer never keeps a process alive by itself, so the test waits beside it.)
  await Promise.all([assert.rejects(slow, (err) => err instanceof RpcClosedError && /did not answer get_usage within/.test(err.message)), sleep(80)]);
  assert.deepEqual(sent.map((f) => f.type), ['control_request', 'control_cancel_request']);
  assert.equal(sent[1].request_id, sent[0].request_id);
  feed({ type: 'control_response', response: { subtype: 'success', request_id: sent[0].request_id, response: {} } });
  await settle();
  assert.equal(wire.stats.unroutable, 1, 'an answer that comes after all is dropped');
  const open = wire.request({ subtype: 'interrupt' });
  toUs.end();
  await assert.rejects(open, (err) => err instanceof RpcClosedError && /closed its output/.test(err.message));
  assert.equal(wire.closed, true);
});
