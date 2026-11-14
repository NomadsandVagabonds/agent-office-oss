// The Claude Code inbox hook (hooks/office-inbox-hook.mjs) as Claude Code runs it — an event on stdin, an answer on
// stdout or in the exit code — and its installer, against a settings file that is nobody's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, sleep, startOffice, tempDir } from './helpers.mjs';

const HOOK = path.join(ROOT, 'hooks', 'office-inbox-hook.mjs');
const claude = (id, name, extra = {}) => ({ session_id: id, cwd: '/tmp/t/webstore', hook_event_name: name, transcript_path: '/nonexistent.jsonl', ...extra });
const until = async (fn, what, ms = 5000) => { const t0 = Date.now(); for (;;) { if (await fn()) return; if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${what}`); await sleep(20); } };

function runHook(o, event, args = [], env = {}) {
  const child = spawn(process.execPath, [HOOK, ...args], { env: { ...process.env, OFFICE_PORT: String(o.port), OFFICE_URL: '', OFFICE_TOKEN: '', OFFICE_SESSION_TOKEN: '', ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', (c) => { out += c; });
  child.stderr.on('data', (c) => { err += c; });
  const done = new Promise((resolve) => child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() })));
  child.stdin.end(JSON.stringify(event));
  return { child, done };
}

test('the inbox hook, at the end of a turn', async (t) => {
  const o = await startOffice({ env: { OFFICE_WAKE_MIN_GAP_MS: '0' } });
  t.after(() => o.stop());
  await o.hook(claude('s1', 'SessionStart'));
  const bob = (await o.post('/api/agents/join', { name: 'Bob', provider: 'codex', cwd: '/tmp/t/webstore' })).data.agent;

  await t.test('no mail: it lets the session stop, and says nothing', async () => {
    assert.deepEqual(await runHook(o, claude('s1', 'Stop')).done, { code: 0, out: '', err: '' });
  });

  await t.test('mail: it holds the stop and hands the mail over, once', async () => {
    await o.post('/api/collab/message', { fromAgentId: bob.id, toAgentId: 's1', content: 'Can you rebase?' });
    const r = await runHook(o, claude('s1', 'Stop')).done;
    assert.equal(r.code, 0);
    const answer = JSON.parse(r.out);
    assert.equal(answer.decision, 'block');
    assert.match(answer.reason, /New Office mail came in while you were working/);
    assert.match(answer.reason, /\[Bob · DM · .+\] Can you rebase\?/);
    assert.deepEqual(await runHook(o, claude('s1', 'Stop')).done, { code: 0, out: '', err: '' }, 'read once');
  });

  await t.test('it never holds a stop twice in a row, and adds context without blocking when the human is typing', async () => {
    await o.post('/api/collab/message', { fromAgentId: bob.id, toAgentId: 's1', content: 'Second note.' });
    assert.deepEqual(await runHook(o, claude('s1', 'Stop', { stop_hook_active: true })).done, { code: 0, out: '', err: '' });
    const r = await runHook(o, claude('s1', 'UserPromptSubmit', { prompt: 'hello' })).done;
    assert.equal(r.code, 0);
    assert.match(r.out, /Second note\./);
    assert.ok(!r.out.startsWith('{'), 'plain context, not a decision');
  });

  await t.test('a session the office drives, an office that is not there, a session nobody knows: silence', async () => {
    await o.post('/api/collab/message', { fromAgentId: bob.id, toAgentId: 's1', content: 'Third note.' });
    assert.deepEqual(await runHook(o, claude('s1', 'Stop'), [], { OFFICE_SESSION_TOKEN: 'x' }).done, { code: 0, out: '', err: '' });
    assert.deepEqual(await runHook(o, claude('s1', 'Stop'), [], { OFFICE_PORT: '9' }).done, { code: 0, out: '', err: '' });
    assert.deepEqual(await runHook(o, claude('nobody', 'Stop')).done, { code: 0, out: '', err: '' });
    await o.get('/api/inbox?agent=s1&ack=1');
  });
});

test('the inbox hook, watching while the session is idle (--watch)', async (t) => {
  const o = await startOffice({ env: { OFFICE_WAKE_MIN_GAP_MS: '0' } });
  t.after(() => o.stop());
  await o.hook(claude('s1', 'SessionStart'));
  const bob = (await o.post('/api/agents/join', { name: 'Bob', provider: 'codex', cwd: '/tmp/t/webstore' })).data.agent;
  const waiting = async () => (await o.get('/api/inbox/waiting')).data.waiting.map((w) => w.agentId);

  await t.test('mail wakes it: exit 2, the mail on stderr, and the mail is read', async () => {
    const w = runHook(o, claude('s1', 'Stop'), ['--watch', '30']);
    await until(async () => (await waiting()).includes('s1'), 'the watcher to be waiting');
    await o.post('/api/collab/message', { fromAgentId: bob.id, toAgentId: 's1', content: 'The review is in.' });
    const r = await w.done;
    assert.equal(r.code, 2);
    assert.equal(r.out, '');
    assert.match(r.err, /New Office mail came in while you were idle/);
    assert.match(r.err, /\[Bob · DM · .+\] The review is in\./);
    assert.equal((await o.get('/api/inbox?agent=s1')).data.items.length, 0);
  });

  await t.test('a newer watcher of the same session takes the older one\'s place, silently', async () => {
    const first = runHook(o, claude('s1', 'SessionStart'), ['--watch', '30']);
    await until(async () => (await waiting()).includes('s1'), 'the first watcher');
    const second = runHook(o, claude('s1', 'Stop'), ['--watch', '30']);
    assert.deepEqual(await first.done, { code: 0, out: '', err: '' });
    await until(async () => (await waiting()).includes('s1'), 'the second watcher');
    await o.post('/api/collab/message', { fromAgentId: bob.id, toAgentId: 's1', content: 'Only one of you hears this.' });
    assert.equal((await second.done).code, 2);
  });

  await t.test('nothing comes: it gives up when its time is up, silently', async () => {
    const t0 = Date.now(), r = await runHook(o, claude('s1', 'Stop'), ['--watch', '5']).done;
    assert.deepEqual(r, { code: 0, out: '', err: '' });
    assert.ok(Date.now() - t0 >= 4500 && Date.now() - t0 < 9000, `after its five seconds (${Date.now() - t0} ms)`);
  });

  await t.test('a session nobody knows, or one the office drives: it leaves at once', async () => {
    const t0 = Date.now();
    assert.deepEqual(await runHook(o, claude('nobody', 'Stop'), ['--watch', '30']).done, { code: 0, out: '', err: '' });
    assert.deepEqual(await runHook(o, claude('s1', 'Stop'), ['--watch', '30'], { OFFICE_SESSION_TOKEN: 'x' }).done, { code: 0, out: '', err: '' });
    assert.ok(Date.now() - t0 < 4000);
  });
});

test('install-inbox-hook: only its own entries, a backup first, and the watcher only when asked', async (t) => {
  const home = tempDir('office-home-');
  fs.mkdirSync(path.join(home, '.claude'));
  const file = path.join(home, '.claude', 'settings.json');
  const mine = { theme: 'dark', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] } };
  fs.writeFileSync(file, JSON.stringify(mine));
  const install = (...args) => new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'install-inbox-hook.mjs'), ...args], { env: { ...process.env, HOME: home, USERPROFILE: home }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
    child.on('close', (code) => resolve({ code, out }));
  });
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  const ours = (s) => Object.entries(s.hooks || {}).flatMap(([ev, groups]) => groups.flatMap((g) => g.hooks.filter((h) => String(h.command).includes('office-inbox-hook.mjs')).map((h) => ({ ev, ...h }))));

  assert.equal((await install()).code, 0);
  let s = read();
  assert.equal(s.theme, 'dark');
  assert.equal(s.hooks.Stop[0].hooks[0].command, 'echo mine', 'what was there is still there');
  assert.deepEqual(ours(s).map((h) => h.ev).sort(), ['Stop', 'UserPromptSubmit']);
  assert.ok(ours(s).every((h) => !h.asyncRewake), 'no watcher unless asked for');
  assert.ok(fs.readdirSync(path.dirname(file)).some((f) => f.startsWith('settings.json.bak.')), 'a backup was taken first');

  const watched = await install('--watch', '30');
  assert.match(watched.out, /watching for mail while a session is idle, for up to 30 minutes/);
  s = read();
  const watchers = ours(s).filter((h) => h.asyncRewake);
  assert.deepEqual(watchers.map((h) => h.ev).sort(), ['SessionStart', 'Stop']);
  for (const h of watchers) { assert.match(h.command, / --watch 1800$/); assert.equal(h.timeout, 1830); assert.equal(h.type, 'command'); }
  assert.equal(ours(s).length, 4, 'run twice, installed once');

  await install();
  assert.equal(ours(read()).filter((h) => h.asyncRewake).length, 0, 'installing again without --watch takes the watcher out');

  await install('--watch', '30'); await install('--uninstall');
  s = read();
  assert.equal(ours(s).length, 0);
  assert.deepEqual(s.hooks, mine.hooks, 'and what was the user\'s is exactly as it was');
});
