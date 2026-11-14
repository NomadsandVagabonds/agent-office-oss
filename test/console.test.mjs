// The console: the office as a terminal conversation. First the words half
// (core/console.mjs), which the browser console and `office chat` share; then
// `office chat` itself, against a real office driving the fake agents — once
// through a pipe, once on a pretend terminal that understands just enough
// control sequences to say what would be on the screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { COMMANDS, choicesOf, complete, createConsole, markdown, optionsOf, parseInput, renderDiff, renderEntry, resolveOption, settled, shortFolder, width, wordsAction, wrap, STYLES } from '../core/console.mjs';
import { ROOT, sleep } from './helpers.mjs';
import { startHarnessOffice, waitFor } from './fixtures/harness-helpers.mjs';
import { TinyTerm, fakeTerminal } from './fixtures/tiny-term.mjs';

const text = (lines) => lines.map((l) => l.map(([t]) => t).join('')).join('\n');
const styles = (lines) => new Set(lines.flatMap((l) => l.map(([, s]) => s)));
const permission = (extra = {}) => ({ id: 'p1', status: 'pending', ask: { summary: 'Wants to run: rm -rf build', detail: 'in ~/repo', questions: [] },
  respond: { method: 'POST', url: '/api/prompts/p1/reply', textField: 'text', actions: [
    { id: 'once', kind: 'allow-once', label: 'Allow once', text: 'optional', body: { action: 'once' } },
    { id: 'always', kind: 'allow-session', label: 'Allow commands for this session', text: 'optional', body: { action: 'always' } },
    { id: 'reject', kind: 'reject', label: 'Reject', text: 'optional', body: { action: 'reject' } }] }, ...extra });
const question = () => ({ id: 'p2', status: 'pending', ask: { summary: 'Which dataset?', questions: [{ id: 'q1', header: 'Choose', text: 'Which dataset?', options: ['v3', 'v4'] }] },
  respond: { method: 'POST', url: '/api/prompts/p2/reply', textField: 'text', actions: [
    { id: 'answer', kind: 'answer', label: 'Answer', text: 'required', body: { action: 'answer' } }, { id: 'decline', kind: 'decline', label: 'Decline', body: { action: 'decline' } }] } });

test('console: what a typed line means', () => {
  assert.deepEqual(parseInput('   '), { kind: 'empty' });
  assert.deepEqual(parseInput('fix the tests\n'), { kind: 'turn', text: 'fix the tests' });
  assert.deepEqual(parseInput('/mode full'), { kind: 'command', name: 'mode', words: ['full'], flags: {}, rest: 'full' });
  assert.deepEqual(parseInput('/new claude ~/code/app --mode edits --name Ada'), { kind: 'command', name: 'new', words: ['claude', '~/code/app'], flags: { mode: 'edits', name: 'Ada' }, rest: 'claude ~/code/app --mode edits --name Ada' });
  assert.equal(parseInput('/ls').name, 'sessions', 'an alias is the command it stands for');
  assert.equal(parseInput('/?').name, 'help');
  assert.equal(parseInput('/no it would delete the build').rest, 'it would delete the build');
  // a slash command that is not ours belongs to the agent, and goes to it untouched; so does anything after //
  assert.deepEqual(parseInput('/compact'), { kind: 'turn', text: '/compact' });
  assert.deepEqual(parseInput('//mode is the name of my variable'), { kind: 'turn', text: '/mode is the name of my variable' });
  assert.deepEqual(complete('/se'), ['sessions']);
  assert.deepEqual(complete('/m'), ['model', 'mode', 'mail']);
  assert.deepEqual(complete('/mode f'), [], 'only the command itself is completed');
  assert.equal(new Set(COMMANDS.flatMap((c) => [c.name, ...(c.alias || [])])).size, COMMANDS.reduce((n, c) => n + 1 + (c.alias || []).length, 0), 'no name means two things');
});

test('console: lines fold to a width without losing or inventing anything', () => {
  const line = [['The quick brown fox ', ''], ['jumps', 'bold'], [' over the lazy dog and keeps going for a while', '']];
  for (const cols of [12, 20, 37, 80]) {
    const rows = wrap(line, cols, 2);
    for (const row of rows) assert.ok(width(row.map(([t]) => t).join('')) <= cols, `a row fits in ${cols}`);
    assert.equal(rows.map((r) => r.map(([t]) => t).join('').trim()).join(' ').replace(/\s+/g, ' '), 'The quick brown fox jumps over the lazy dog and keeps going for a while');
    for (const row of rows.slice(1)) assert.ok(row[0][0].startsWith('  '), 'what continues is indented under what it continues');
  }
  assert.equal(wrap([['x'.repeat(50), 'code']], 20).length, 3, 'a word longer than a row is cut where it falls');
  assert.equal(wrap([['x'.repeat(50), 'code']], 20).map((r) => r.map(([t]) => t).join('')).join(''), 'x'.repeat(50));
  assert.equal(width('日本語'), 6); assert.equal(width('é'), 1); assert.equal(width('abc'), 3);
  assert.ok(wrap([['日本語のテキストです', '']], 9).every((r) => width(r.map(([t]) => t).join('')) <= 9));
  assert.equal(shortFolder('/home/ada/code/office/server', '/home/ada'), '…/office/server');
  assert.equal(shortFolder('/home/ada/app', '/home/ada'), '~/app');
});

test('console: a reply keeps its code and marks the little Markdown agents write', () => {
  const lines = markdown('## Result\nAll **done**: run `npm test`.\n```js\nconst a = `x` ** 2;\n```\n- **one**');
  assert.deepEqual(lines[0], [['Result', 'head']]);
  assert.deepEqual(lines[1], [['All ', ''], ['done', 'bold'], [': run ', ''], ['npm test', 'code'], ['.', '']]);
  assert.deepEqual(lines.slice(2, 5), [[['```js', 'dim']], [['const a = `x` ** 2;', 'code']], [['```', 'dim']]], 'inside a fence nothing is touched');
  assert.equal(text([lines[5]]), '- one');
});

test('console: every kind of transcript entry has its lines, and an unknown one draws nothing', () => {
  const shown = (e, opt) => text(renderEntry(e, opt));
  assert.equal(shown({ kind: 'session', state: 'started', label: 'Claude Code', model: 'opus', modeLabel: 'asks before it acts', cwd: '/home/ada/code/app' }, { home: '/home/ada' }), '◆ Claude Code · opus · asks before it acts · ~/code/app');
  assert.match(shown({ kind: 'session', state: 'failed', reason: 'could not start: not signed in' }), /^■ session failed: could not start: not signed in$/);
  assert.equal(shown({ kind: 'turn', n: 1, state: 'running', origin: 'human' }), '', 'a turn somebody typed needs no announcement');
  assert.equal(shown({ kind: 'turn', n: 2, state: 'running', origin: 'wake', from: 'Bo' }), '· woken by mail from Bo');
  assert.equal(shown({ kind: 'turn', n: 1, state: 'completed', durationMs: 12_400, tools: 3 }), '  ✓ 12s · 3 tools');
  assert.equal(shown({ kind: 'turn', n: 1, state: 'interrupted', stoppedBy: 'Lead' }), '  ■ stopped by Lead');
  assert.equal(shown({ kind: 'turn', n: 1, state: 'failed', error: 'rate limited' }), '  ✗ failed: rate limited');
  assert.equal(shown({ kind: 'user', text: 'fix it\nand test it' }), '> fix it\n  and test it');
  assert.equal(shown({ kind: 'user', text: '<delegated_task from="Bo">\nreview the diff\n</delegated_task>' }), '> review the diff', 'the office\'s own wrapper is not what was asked');
  assert.equal(shown({ kind: 'message', text: 'Done.\nTwo lines.' }), '● Done.\n  Two lines.');
  assert.equal(shown({ kind: 'thought', text: 'a\nb\nc\nd\ne' }), '∴ a\n  b\n  c\n  … 2 more lines');
  assert.equal(shown({ kind: 'thought', text: 'a\nb\nc\nd\ne' }, { full: true }), '∴ a\n  b\n  c\n  d\n  e');
  assert.equal(shown({ kind: 'tool', name: 'Shell', command: 'npm test', status: 'in_progress' }), '● Shell(npm test)  …');
  assert.equal(shown({ kind: 'tool', name: 'Shell', command: 'npm test', status: 'failed', exitCode: 2, output: 'boom' }), '● Shell(npm test)  ✗ exit 2\n  ⎿  boom');
  assert.equal(shown({ kind: 'tool', name: 'Edit', title: 'Edit src/a.js', paths: ['src/a.js'], status: 'completed' }), '● Edit(src/a.js)', 'the verb is not said twice');
  const long = shown({ kind: 'tool', name: 'Shell', command: 'ls', status: 'completed', output: Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n') });
  assert.match(long, /… 7 earlier lines\n {5}line 8\n[\s\S]*line 12$/, 'the end of long output, and how much came before it');
  assert.equal(shown({ kind: 'tool', name: 'Shell', command: 'ls', status: 'completed', output: 'a\nb\nc\nd\ne\nf\ng' }, { full: true }).split('\n').length, 8);
  assert.equal(shown({ kind: 'plan', entries: [{ text: 'read', status: 'completed' }, { text: 'fix', status: 'in_progress' }, { text: 'test', status: 'pending' }] }), '  ☒ read\n  ◐ fix\n  ☐ test');
  assert.equal(shown({ kind: 'notice', level: 'warn', text: 'The agent wrote noise.' }), '  The agent wrote noise.');
  assert.equal(shown({ kind: 'handoff', direction: 'in', fromName: 'Bo', items: 3, omitted: 2 }), '  ⇠ context handed over from Bo: 3 items, 2 older left out');
  assert.equal(shown({ kind: 'changes', files: [{ path: 'a.js', status: 'modified', additions: 3, deletions: 1 }, { path: 'b.js', status: 'added', additions: 9, deletions: 0 }] }),
    '  ± 2 files changed  +12 −1\n     M a.js  +3 −1\n     A b.js  +9 −0');
  assert.deepEqual(renderEntry({ kind: 'usage', used: 1, size: 2 }), []);
  assert.deepEqual(renderEntry({ kind: 'something-from-a-newer-office', text: 'hello' }), []);
  assert.deepEqual(renderEntry(null), []);

  // a request that is waiting lists what answers it; one that has been answered says who by
  const asked = { id: 'perm:r1', kind: 'permission', state: 'asked', command: 'rm -rf build' };
  assert.equal(shown(asked, { prompt: permission() }), '⚠ Wants to run: rm -rf build\n  in ~/repo\n  y Allow once   a Allow commands for this session   n Reject');
  assert.equal(shown(asked, { prompt: permission(), choices: false }), '⚠ Wants to run: rm -rf build\n  in ~/repo', 'a screen with buttons draws its own');
  assert.equal(shown(asked), '⚠ Wants: rm -rf build', 'with nothing known about how to answer, it still says what is asked');
  assert.equal(shown({ ...asked, state: 'allowed-session', by: 'Lead', grant: 'command' }), '  ✓ allowed: rm -rf build  (by Lead · for the rest of the session)');
  assert.equal(shown({ ...asked, state: 'rejected', by: 'Lead', reason: 'not that folder' }), '  ✗ denied: rm -rf build  (by Lead · not that folder)');
  assert.equal(shown({ id: 'perm:r2', kind: 'question', state: 'asked', text: 'Which dataset?' }, { prompt: question() }), '? Which dataset?\n    1 v3\n    2 v4\n  n Decline');
  assert.equal(shown({ id: 'perm:r2', kind: 'question', state: 'answered', text: 'Which dataset?', answer: 'v4', by: 'Lead' }), '  ✓ answered: Which dataset?  → v4  (by Lead)');
  for (const lines of [renderEntry(asked, { prompt: permission() }), renderEntry({ kind: 'tool', name: 'x', status: 'failed' }), renderDiff('@@ -1 +1 @@\n-a\n+b')]) for (const s of styles(lines)) assert.ok(STYLES.includes(s), `"${s}" is a style both screens know`);
  assert.deepEqual(renderDiff('diff --git a/x b/x\n@@ -1 +1 @@\n-old\n+new\n same').map((l) => l[0][1]), ['dim', 'tool', 'del', 'add', '']);

  assert.deepEqual([settled({ kind: 'message', streaming: true }), settled({ kind: 'message' }), settled({ kind: 'tool', status: 'in_progress' }), settled({ kind: 'tool', status: 'failed' }),
    settled({ kind: 'permission', state: 'asked' }), settled({ kind: 'turn', state: 'running' }), settled({ kind: 'plan' })], [false, true, false, true, false, false, true]);
  assert.deepEqual(choicesOf(permission()).map((c) => [c.key, c.kind]), [['y', 'allow-once'], ['a', 'allow-session'], ['n', 'reject']]);
  assert.deepEqual(choicesOf(question()).map((c) => c.key), ['n'], 'an answer that needs words has no key');
  assert.equal(wordsAction(question()).kind, 'answer'); assert.equal(wordsAction(permission()), null);
});

/** A console with nothing behind it but a list of what it asked for. */
function harnessed(answers = {}) {
  const calls = [], said = [], drawn = [], resets = [];
  const session = (extra = {}) => { const at = '/api/harness/sessions/d_1'; return { id: 'd_1', name: 'Ada', label: 'Fake Agent', adapter: 'fake', model: 'fake-large', mode: 'ask', modeLabel: 'asks before it acts', state: 'idle', live: true,
    cwd: '/work/app', pending: [], controls: { transcript: { url: `${at}/transcript` }, turn: { method: 'POST', url: `${at}/turn`, available: true }, interrupt: { method: 'POST', url: `${at}/interrupt`, available: true },
      end: { method: 'DELETE', url: at, available: true }, mode: { method: 'PATCH', url: at, field: 'mode', value: 'ask', options: ['ask', 'edits', 'full'], available: true },
      wake: { method: 'PATCH', url: at, field: 'wake', value: 'off', options: ['off', 'results', 'direct'], available: true } }, ...extra }; };
  const con = createConsole({
    api: async (url, opt = {}) => { calls.push([opt.method || 'GET', url, opt.body]); const a = answers[`${opt.method || 'GET'} ${url.split('?')[0]}`]; if (a instanceof Error) throw a; return typeof a === 'function' ? a(opt.body) : (a ?? { ok: true }); },
    watch: (id) => calls.push(['WATCH', id]), cwd: '/work/app', home: '/home/ada',
  });
  con.on('say', (lines) => said.push(text(lines)));
  con.on('block', (b, fresh) => drawn.push([b.key, fresh, b.live, text(b.lines)]));
  con.on('reset', (s, again) => resets.push([s.id, !!again]));
  return { con, calls, said, drawn, resets, session };
}

test('console: a page of history is drawn in the order it happened, and live entries carry on from it', async () => {
  const page = { entries: [
    { id: 'session', kind: 'session', seq: 9, state: 'ended', reason: 'ended from the office', label: 'Fake Agent', model: 'fake-large', modeLabel: 'asks before it acts', cwd: '/work/app' },
    { id: 'turn-1', kind: 'turn', seq: 7, n: 1, state: 'completed', origin: 'wake', from: 'Bo', durationMs: 900, tools: 1 },
    { id: 'turn-1:user', kind: 'user', seq: 2, turn: 1, text: 'hello' },
    { id: 'm1', kind: 'message', seq: 4, turn: 1, text: 'Looking.' },
    { id: 't1', kind: 'tool', seq: 6, turn: 1, name: 'Shell', command: 'ls', status: 'completed' },
    { id: 'turn-2', kind: 'turn', seq: 8, n: 2, state: 'interrupted', origin: 'human', stoppedBy: 'Lead' },
    { id: 'turn-2:user', kind: 'user', seq: 8, turn: 2, text: 'again' }], truncated: false, seq: 9 };
  const h = harnessed({ 'GET /api/harness/sessions/d_1/transcript': page });
  h.con.harness({ sessions: [h.session({ state: 'ended', live: false })], adapters: [] });
  await h.con.open('ada');
  assert.deepEqual(h.resets, [['d_1', false], ['d_1', true]], 'once to clear the screen, once more when the page is in');
  assert.deepEqual(h.calls.filter((c) => c[0] === 'WATCH'), [['WATCH', 'd_1']]);
  assert.deepEqual(h.con.blocks().map((b) => text(b.lines)), [
    '◆ Fake Agent · fake-large · asks before it acts · /work/app', '· woken by mail from Bo', '> hello', '● Looking.', '● Shell(ls)', '  ✓ 0.9s · 1 tool',
    '> again', '  ■ stopped by Lead', '■ session ended: ended from the office'], 'a turn ends where it ended, and the session ends last');

  // live: text arriving, a tool starting and finishing, an older revision ignored
  const live = harnessed({ 'GET /api/harness/sessions/d_1/transcript': { entries: [], seq: 0 } });
  live.con.harness({ sessions: [live.session()], adapters: [] });
  await live.con.open('1');
  live.drawn.length = 0;
  live.con.entry('d_1', { id: 'm1', kind: 'message', seq: 3, text: 'Wor', streaming: true });
  live.con.entry('d_1', { id: 'm1', kind: 'message', seq: 4, text: 'Working', streaming: true });
  live.con.entry('d_1', { id: 'm1', kind: 'message', seq: 2, text: 'stale' });
  live.con.entry('other', { id: 'm9', kind: 'message', seq: 9, text: 'somebody else' });
  live.con.entry('d_1', { id: 'm1', kind: 'message', seq: 5, text: 'Working on it.' });
  assert.deepEqual(live.drawn, [['m1', true, true, '● Wor'], ['m1', false, true, '● Working'], ['m1', false, false, '● Working on it.']]);
  // a turn is two blocks, and neither changes once drawn: nothing waits at the bottom of a terminal for an end that is written elsewhere
  live.drawn.length = 0;
  live.con.entry('d_1', { id: 'turn-2', kind: 'turn', seq: 6, n: 2, state: 'running', origin: 'wake', from: 'Bo' });
  live.con.entry('d_1', { id: 'turn-2', kind: 'turn', seq: 9, n: 2, state: 'completed', origin: 'wake', from: 'Bo', durationMs: 2000 });
  assert.deepEqual(live.drawn, [['turn-2#start', true, false, '· woken by mail from Bo'], ['turn-2#end', true, false, '  ✓ 2s']]);
});

test('console: typing gives a turn, answers what is waiting, and asks twice before anything that cannot be undone', async () => {
  const h = harnessed({ 'GET /api/harness/sessions/d_1/transcript': { entries: [], seq: 0 }, 'POST /api/harness/sessions/d_1/turn': { ok: true, queued: true, position: 2 } });
  h.con.harness({ sessions: [h.session()], adapters: [{ id: 'fake', label: 'Fake Agent', available: true }, { id: 'codex', label: 'Codex', available: false, note: 'npm i -g codex' }] });
  await h.con.submit('hello');
  assert.match(h.said.pop(), /No session/, 'with nobody on show there is nobody to say it to');
  await h.con.open('ada');
  h.calls.length = 0;
  await h.con.submit('run the tests');
  assert.deepEqual(h.calls, [['POST', '/api/harness/sessions/d_1/turn', { text: 'run the tests' }]]);
  assert.match(h.said.pop(), /queued: it starts when this turn ends \(1 ahead of it\)/);

  // a permission is waiting: y, a, n answer it; ordinary text is still a turn
  h.con.harness({ sessions: [h.session({ state: 'waiting', pending: [{ id: 'r1', promptId: 'p1', kind: 'permission' }] })] });
  h.con.prompts([permission()]);
  h.con.entry('d_1', { id: 'perm:r1', kind: 'permission', seq: 5, state: 'asked', command: 'rm -rf build' });
  assert.match(text(h.con.blocks().pop().lines), /y Allow once {3}a Allow commands for this session {3}n Reject/);
  assert.equal(h.con.status()[0].map(([t]) => t).join(''), 'Ada  Fake Agent · fake-large · ask  waiting on you');
  h.calls.length = 0;
  assert.equal(await h.con.key('z'), false);
  assert.equal(await h.con.key('a'), true);
  await h.con.submit('/no it would delete the build');
  assert.deepEqual(h.calls, [['POST', '/api/prompts/p1/reply', { action: 'always' }], ['POST', '/api/prompts/p1/reply', { action: 'reject', text: 'it would delete the build' }]]);

  // a question is waiting: what is typed next is the answer, and a number picks one of its options
  h.con.harness({ sessions: [h.session({ state: 'waiting', pending: [{ id: 'r2', promptId: 'p2', kind: 'question' }] })] });
  h.con.prompts([question()]);
  h.calls.length = 0;
  await h.con.submit('the newer one');
  assert.equal(await h.con.key('2'), true);
  assert.deepEqual(h.calls, [['POST', '/api/prompts/p2/reply', { action: 'answer', text: 'the newer one' }], ['POST', '/api/prompts/p2/reply', { action: 'answer', text: 'v4' }]]);

  // settings; "full" and "end" need saying twice
  h.con.harness({ sessions: [h.session()] }); h.con.prompts([]);
  h.calls.length = 0;
  await h.con.submit('/mode edits');
  await h.con.submit('/mode sideways');
  assert.match(h.said.pop(), /"sideways" is not one of ask, edits, full/);
  await h.con.submit('/mode full');
  assert.match(h.said.pop(), /act without asking anyone.*again to go ahead/);
  await h.con.submit('/wake results');                     // something else in between: the confirmation is forgotten
  await h.con.submit('/mode full');
  await h.con.submit('/mode full');
  await h.con.submit('/end');
  assert.match(h.said.pop(), /End Ada\?.*again to go ahead/);
  await h.con.submit('/end');
  assert.deepEqual(h.calls, [['PATCH', '/api/harness/sessions/d_1', { mode: 'edits' }], ['PATCH', '/api/harness/sessions/d_1', { wake: 'results' }],
    ['PATCH', '/api/harness/sessions/d_1', { mode: 'full' }], ['DELETE', '/api/harness/sessions/d_1', undefined]]);

  // a mode its own sandbox fixes cannot be changed, and says why
  h.con.harness({ sessions: [h.session({ controls: { ...h.session().controls, mode: { ...h.session().controls.mode, available: false, fixed: 'set when this agent starts: its own sandbox enforces it' } } })] });
  await h.con.submit('/mode edits');
  assert.match(h.said.pop(), /cannot be changed here: set when this agent starts/);

  // starting one: only what the office says can be started, in the folder you are in
  h.calls.length = 0;
  await h.con.submit('/new nope');
  assert.match(h.said.slice(-2).join('\n'), /no agent called "nope"[\s\S]*fake, codex \(not installed\)/);
  await h.con.submit('/new codex');
  assert.match(h.said.pop(), /Codex is not installed on this machine\. npm i -g codex/);
  assert.deepEqual(h.calls, []);
  await h.con.submit('/help');
  assert.ok(COMMANDS.every((c) => h.said[h.said.length - 1].includes(`/${c.name}`)), 'help lists every command');
  await h.con.submit('/full');
  assert.equal(h.con.state.full, true);

  // a refusal from the office is said, not thrown
  const bad = harnessed({ 'GET /api/harness/sessions/d_1/transcript': { entries: [], seq: 0 }, 'POST /api/harness/sessions/d_1/turn': new Error('this session has ended') });
  bad.con.harness({ sessions: [bad.session()] });
  await bad.con.open('d_1');
  await bad.con.submit('hello');
  assert.equal(bad.said.pop(), '✗ this session has ended');
  bad.con.leave();
  assert.equal(bad.con.session(), null);
  assert.deepEqual(bad.calls.pop(), ['WATCH', null]);
});

test('console: a model, an effort and the agent\'s own mode are picked from what the agent itself offers', async () => {
  const h = harnessed({ 'GET /api/harness/sessions/d_1/transcript': { entries: [], seq: 0 } });
  const at = '/api/harness/sessions/d_1';
  const pickOf = (field, value, labels, extra = {}) => ({ method: 'PATCH', url: at, field, value, options: Object.keys(labels), labels, available: true, ...extra });
  const offers = { model: pickOf('model', 'fake-large', { 'fake-large': 'Fake Large', 'fake-small': 'Fake Small' }), effort: pickOf('effort', 'medium', { low: 'Low', medium: 'Medium', high: 'High' }),
    // this agent has a mode of its own that is called what one of the office's is called
    agentMode: pickOf('agentMode', 'default', { default: 'Default', plan: 'Plan', ask: 'Ask' }) };
  const having = (extra = {}) => h.session({ effort: 'medium', agentMode: 'default', ...extra, controls: { ...h.session().controls, ...offers, ...(extra.controls || {}) } });
  h.con.harness({ sessions: [having()], adapters: [{ id: 'fake', label: 'Fake Agent', available: true }, { id: 'codex', label: 'Codex', available: false }] });
  await h.con.open('ada');
  h.calls.length = 0;

  await h.con.submit('/model');
  assert.equal(h.said.pop(), 'model: Fake Large (fake-large)\n  ▸ fake-large  Fake Large\n    fake-small  Fake Small');
  await h.con.submit('/model fake-small');                 // by its id
  await h.con.submit('/model Fake Large');                 // by the agent's name for it
  await h.con.submit('/effort hi');                        // by the unmistakable start of either
  await h.con.submit('/model fake');
  assert.equal(h.said.pop(), '"fake" is not one of fake-large, fake-small.', 'two begin like that: neither is guessed');
  await h.con.submit('/mode plan');                        // not one of the office's three words: one of the agent's own
  await h.con.submit('/mode own:ask');                     // the agent's own "ask", said so
  await h.con.submit('/mode ask');                         // the office's: how freely it may act
  await h.con.submit('/mode sideways');
  assert.equal(h.said.pop(), '"sideways" is not one of ask, edits, full — nor one of its own (default, plan, ask).');
  await h.con.submit('/mode');
  assert.deepEqual(h.said.slice(-2), ['It: ask. One of ask, edits, full.', 'its own mode: Default (default)\n  ▸ default  Default\n    plan  Plan\n    ask  Ask']);
  assert.deepEqual(h.calls, [['PATCH', at, { model: 'fake-small' }], ['PATCH', at, { model: 'fake-large' }], ['PATCH', at, { effort: 'high' }],
    ['PATCH', at, { agentMode: 'plan' }], ['PATCH', at, { agentMode: 'ask' }], ['PATCH', at, { mode: 'ask' }]]);

  // an agent that takes any model is sent what was typed; one that offers no choice says so
  h.con.harness({ sessions: [having({ state: 'running', controls: { model: { ...offers.model, free: true, applies: 'next-turn' }, effort: { ...offers.effort, options: [], labels: {}, available: false } } })] });
  h.calls.length = 0;
  await h.con.submit('/model my-own-finetune');
  assert.equal(h.said.pop(), 'model: my-own-finetune — from the next turn');
  await h.con.submit('/effort high');
  assert.equal(h.said.pop(), 'This agent offers no choice of effort.');
  assert.deepEqual(h.calls, [['PATCH', at, { model: 'my-own-finetune' }]]);
  assert.deepEqual([resolveOption(offers.model, 'FAKE-SMALL'), resolveOption(offers.model, 'fake small'), resolveOption(offers.model, 'x'), resolveOption({ ...offers.model, free: true }, ' x '), resolveOption(offers.model, '')],
    ['fake-small', 'fake-small', null, 'x', null]);
  assert.deepEqual(optionsOf({ options: ['a', 'b'], labels: { a: 'A' } }), [{ id: 'a', label: 'A' }, { id: 'b', label: 'b' }]);

  // what a half-typed line could become: the command, then the first word it takes
  h.con.harness({ sessions: [having({ agentMode: 'plan' })] });
  const labels = (text) => h.con.complete(text).map((o) => o.label);
  assert.deepEqual(labels('/mo'), ['/model', '/mode']);
  assert.deepEqual(h.con.complete('/sw')[0], { kind: 'command', text: '/switch ', label: '/switch', hint: '<number|name> — talk to another session', more: true });
  assert.equal(h.con.complete('/model')[0].more, false, 'a command whose word is optional can be sent as it stands');
  assert.deepEqual(h.con.complete('/model '), [{ kind: 'word', text: '/model fake-large', label: 'fake-large', hint: 'Fake Large' }, { kind: 'word', text: '/model fake-small', label: 'fake-small', hint: 'Fake Small' }]);
  assert.deepEqual(labels('/mode '), ['ask', 'edits', 'full', 'default', 'plan'], 'the office\'s three, then the agent\'s own that are not called the same');
  assert.deepEqual([labels('/mode p'), labels('/effort '), labels('/wake r'), labels('/new '), labels('/delegate '), labels('/switch a')], [['plan'], ['low', 'medium', 'high'], ['results'], ['fake'], ['any', 'fake'], ['Ada']]);
  assert.deepEqual([labels('/model fake-small'), labels('/help me'), labels('hello'), labels('/nope ')], [[], [], [], []]);

  // the line at the bottom says what it runs on; a screen that shows that elsewhere asks for the short form
  const line = (spans) => spans.map(([t]) => t).join('');
  assert.equal(line(h.con.status()[0]), 'Ada  Fake Agent · fake-large · medium · ask  Plan mode  idle');
  assert.equal(line(h.con.status({ brief: true })[0]), 'Ada  idle');

  // carrying this conversation on with another agent
  h.calls.length = 0;
  await h.con.submit('/new fake --context --model fake-small --effort low');
  assert.deepEqual(h.calls[0], ['POST', '/api/harness/sessions', { adapter: 'fake', cwd: '/work/app', model: 'fake-small', effort: 'low', context: { session: 'd_1' } }]);
});

test('console: the pretend terminal behaves like one', () => {
  const t = new TinyTerm(10, 3);
  t.write('ab\r\ncd\r\nef\r\ngh');
  assert.deepEqual([t.scrolled, t.screen()], [['ab'], ['cd', 'ef', 'gh']]);
  t.write('\x1b[2A\r\x1b[J\x1b[1mXY\x1b[0m\r\n1234567890\r\nz');
  assert.deepEqual(t.screen(), ['XY', '1234567890', 'z'], 'up, erase to the end of the screen, colour ignored, a full row does not wrap by itself');
  t.write('\n');
  assert.deepEqual(t.cursor().x, 1, 'a line feed alone does not go back to the first column');
  assert.deepEqual(t.unknown, []);
  t.write('\x1b[5n');
  assert.equal(t.unknown.length, 1);
});

test('console: office chat, through a pipe and on a terminal', async (t) => {
  const h = await startHarnessOffice();
  t.after(() => h.stop());
  const run = (args, input) => new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'office.mjs'), 'chat', ...args], { cwd: h.work, env: { ...process.env, OFFICE_URL: h.base, OFFICE_TOKEN: '', OFFICE_SESSION_TOKEN: '', NO_COLOR: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, out, err }));
    child.stdin.end(input);
  });

  await t.test('piped: it sends what it was given, prints what comes back, and leaves when the agent has finished', async () => {
    const r = await run(['new', 'fake', '--name', 'Ada'], 'say: Looking.; tool: ls -la; say: Done.\n/sessions\n');
    assert.equal(r.code, 0, r.err);
    assert.doesNotMatch(r.out, /\x1b\[/, 'no colours, no cursor moves: a pipe gets plain lines');
    for (const want of ['── Ada ──', '◆ Fake Agent', '> say: Looking.; tool: ls -la; say: Done.', '● Looking.', '● Shell(ls -la)', '  ⎿  ran: ls -la', '● Done.', '  ✓ ', '▸ Ada']) assert.ok(r.out.includes(want), `"${want}" in:\n${r.out}`);
    assert.ok(r.out.indexOf('● Looking.') < r.out.indexOf('● Shell(ls -la)') && r.out.indexOf('● Shell(ls -la)') < r.out.indexOf('● Done.'), 'in the order it happened');
    const s = (await h.get('/api/harness/sessions')).data.sessions.find((x) => x.name === 'Ada');
    assert.equal(s.cwd, h.work, 'an agent started from a terminal works in that terminal\'s folder');

    // something it cannot answer through a pipe: it says so, and says so with its exit code
    const stuck = await run([s.id], 'ask: rm -rf build\n');
    assert.equal(stuck.code, 3);
    assert.match(stuck.out, /⚠ Wants to run: rm -rf build[\s\S]*waiting for an answer, which a pipe cannot give/);
    await h.post(`/api/harness/sessions/${s.id}/interrupt`);
    const none = await run(['nobody-by-that-name'], '');
    assert.match(none.out, /No session matches "nobody-by-that-name"/);
  });

  await t.test('on a terminal: the bottom of the screen is live, and what is above it is written once', async () => {
    process.env.OFFICE_URL = h.base; delete process.env.OFFICE_TOKEN; delete process.env.OFFICE_SESSION_TOKEN;
    const { chat } = await import('../office-chat.mjs');
    const s = await h.start('fake', { name: 'Bo' });
    const term = fakeTerminal(84, 28);
    const done = chat({ words: [s.id], flags: {}, input: term.input, output: term.output });
    const screen = () => term.term.screen().join('\n');
    const all = () => term.term.text();
    await waitFor(() => /◆ Fake Agent/.test(screen()), { what: 'the session to be on screen' });
    assert.deepEqual([term.term.cursor().row, term.term.cursor().x], ['>', 2], 'the cursor waits at the prompt');
    assert.match(term.term.screen().filter(Boolean).pop(), /^Bo {2}Fake Agent · fake-large · medium · ask {2}idle/, 'and the last row says where things stand: who, on what, how hard, how freely');

    // typing, with an edit in the middle of the line
    await term.type('say: helo');
    await term.press('left'); await term.press('left'); await term.type('l');
    assert.equal(term.term.cursor().row, '> say: hello');
    assert.equal(term.term.cursor().before, '> say: hel');
    await term.press('ctrl-u'); await term.press('ctrl-e'); await term.press('ctrl-u');
    assert.equal(term.term.cursor().row, '>');

    // a turn with a request in it: the request waits at the bottom, one key answers it
    await term.type('say: Looking.; tool: npm test; ask: rm -rf build; say: Finished.');
    await term.press('enter');
    await waitFor(() => /⚠ Wants to run: rm -rf build\n\s+y Allow once {3}a Allow commands for this session {3}n Reject/.test(screen()), { what: 'the request to be on screen' });
    assert.match(screen(), /waiting on you/);
    await term.press('y');
    await waitFor(() => /✓ allowed: rm -rf build {2}\(by Lead\)/.test(all()) && /Finished\.\n {2}✓ /.test(all()), { what: 'the turn to finish' });
    const once = (re) => (all().match(re) || []).length;
    assert.equal(once(/● Shell\(npm test\)/g), 1, 'what is written down is written once, however often the bottom was redrawn');
    assert.equal(once(/⚠ Wants to run/g), 0, 'and the request, once answered, is replaced by its answer');
    assert.equal(once(/> say: Looking/g), 1);

    // a command, completed with Tab
    await term.type('/sess'); await term.press('tab');
    assert.equal(term.term.cursor().row, '> /sessions');
    await term.press('enter');
    await waitFor(() => /▸ Bo {2}Fake Agent/.test(all()), { what: 'the list of sessions' });

    // …and the word after it: the model, from what this agent offers. The office puts the change to the agent and writes it down.
    await term.type('/mod'); await term.press('tab');
    assert.equal(term.term.cursor().row, '> /mod', 'two commands begin like that: Tab lists them and takes neither');
    assert.match(all(), /\/model {2}\/mode/);
    await term.type('el fake-s'); await term.press('tab');
    assert.equal(term.term.cursor().row, '> /model fake-small');
    await term.press('enter');
    await waitFor(() => /model: Fake Small \(fake-small\)/.test(all()) && /Model set to “Fake Small” by Lead\./.test(all()), { what: 'the model to change' });
    await waitFor(() => /^Bo {2}Fake Agent · fake-small · medium · ask {2}idle/.test(term.term.screen().filter(Boolean).pop()), { what: 'the status row to say so' });

    // Esc stops a turn in flight
    await term.type('slow'); await term.press('enter');
    await waitFor(() => /working…/.test(screen()), { what: 'the turn to be running' });
    await term.press('esc');
    await waitFor(() => /■ stopped by Lead/.test(all()), { what: 'the stop to be written down' });
    assert.match(term.term.screen().filter(Boolean).pop(), /idle/);

    // a long line wraps under itself, and the cursor follows it
    await term.type('x'.repeat(100));
    assert.equal(term.term.cursor().row, '  ' + 'x'.repeat(18));
    await term.press('ctrl-u');

    // history
    await term.press('up');
    assert.equal(term.term.cursor().row, '> slow');
    await term.press('down');
    assert.equal(term.term.cursor().row, '>');

    await term.type('/quit'); await term.press('enter');
    assert.equal(await done, 0);
    assert.deepEqual(term.term.unknown, [], 'nothing was written that a plain terminal would not understand');
    assert.equal(term.term.modes.has('2004'), false, 'the terminal is given back as it was found');
    assert.equal((await h.session(s.id)).state, 'idle', 'leaving the console leaves the agent running');
    await sleep(20);
  });
});
