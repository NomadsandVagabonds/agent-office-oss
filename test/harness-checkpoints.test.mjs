// What a turn changed: real git repositories in temporary folders, a real
// office, the fake agents — and the files changing on disk while a turn runs.
//
// The promise under test is that the office uses git without writing anything
// into the repository: every path, size and time under `.git` is compared
// before and after.
//
// The fake agent announces an edit ("edit:src/a.js") without making it, so the
// files are changed here, by the test, while the agent's turn is held open on a
// permission request: to a snapshot it is all the same who wrote them. One test
// has the agent itself act the instant it is prompted, to show that the
// snapshot before a turn is complete before the agent can do anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { startHarnessOffice as startOffice, waitFor, sleep } from './fixtures/harness-helpers.mjs';
import { ROOT, tempDir } from './helpers.mjs';
import { createCheckpoints, parseChanges, parseShortstat, repoKey, runGit } from '../server/harness/checkpoints.mjs';
import { harnessSettings } from '../server/harness/settings.mjs';
import { ENTRY_KINDS } from '../server/harness/transcript.mjs';

// Neither the tests' own git nor the office's may depend on the settings of whoever runs them.
process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_SYSTEM = os.devNull;

const usable = process.platform !== 'win32' && spawnSync('git', ['--version']).status === 0;
// Test offices do not snapshot anything unless asked (test/helpers.mjs): a test that names no folder runs
// its agent in this checkout, and no test may write into it. Here every session is given a repository of its own.
const startHarnessOffice = (opt = {}) => startOffice({ ...opt, env: { OFFICE_CHECKPOINTS: '1', ...(opt.env || {}) } });

// A `git` of our own in front of the real one. It does what git does, but can be told to dawdle — a file
// naming a subcommand and a number of seconds — which is how a slow snapshot is made on purpose. It notes
// its pid first, so a test can see that stopping a snapshot stopped the program too.
const realGit = usable ? execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim() : 'git';
const tools = fs.realpathSync(tempDir('office-changes-tools-'));
const SLOW = path.join(tools, 'slow'), PIDS = path.join(tools, 'pids');
if (usable) {
  fs.writeFileSync(path.join(tools, 'git'), ['#!/bin/sh', `if [ -f '${SLOW}' ]; then`, `  read sub secs < '${SLOW}'`,
    `  case " $* " in *" $sub "*) echo $$ >> '${PIDS}'; sleep "$secs";; esac`, 'fi', `exec '${realGit}' "$@"`, ''].join('\n'), { mode: 0o755 });
  process.env.PATH = `${tools}${path.delimiter}${process.env.PATH}`;
}
const dawdle = (subcommand, seconds) => fs.writeFileSync(SLOW, `${subcommand} ${seconds}\n`);
const hurry = () => fs.rmSync(SLOW, { force: true });
const lastPid = () => Number(fs.readFileSync(PIDS, 'utf8').trim().split('\n').pop());

const WHO = { GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.com' };
const git = (cwd, ...args) => execFileSync(realGit, ['-C', cwd, ...args], { encoding: 'utf8', env: { ...process.env, ...WHO },
  stdio: ['ignore', 'pipe', 'pipe'] });
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

function write(dir, file, content) {
  const target = path.join(dir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

/** A repository with one commit: a few tracked files and an ignore file. */
function repo(prefix = 'office-changes-') {
  const dir = fs.realpathSync(tempDir(prefix));
  git(dir, 'init', '-q', '-b', 'main');
  write(dir, 'src/a.js', 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n');
  write(dir, 'README.md', '# demo\n');
  write(dir, 'old-name.txt', 'a first line\na second line\na third line\nand a fourth\n');
  write(dir, 'gone.txt', 'soon gone\n');
  write(dir, '.gitignore', 'ignored/\n*.log\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'first');
  return dir;
}

/** Every file under a folder (git's own aside) with a hash of what is in it. */
function contents(dir, base = dir, out = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) contents(full, base, out);
    else if (entry.isFile()) out[path.relative(base, full)] = sha(fs.readFileSync(full));
  }
  return out;
}

/**
 * Everything git keeps for a repository: each path under its git directory with
 * its size and the time it was last written (folders too — a file made and
 * removed again shows there), every ref, and git's own count of its objects.
 * Two of these being equal is what "nothing was written" means.
 */
function everything(gitDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : 1))) {
      const full = path.join(dir, entry.name);
      const info = fs.lstatSync(full);
      files.push(`${path.relative(gitDir, full)} ${entry.isDirectory() ? 'dir' : info.size} ${info.mtimeMs}`);
      if (entry.isDirectory()) walk(full);
    }
  };
  walk(gitDir);
  return { files, refs: git(gitDir, 'for-each-ref'), objects: git(gitDir, 'count-objects', '-v') };
}

const changes = async (h, id, query = '') => (await h.get(`/api/harness/sessions/${id}/changes${query}`)).data;
const diffOf = async (h, id, query) => (await h.get(`/api/harness/sessions/${id}/diff?${query}`)).data;
const brief = (files) => files.map((f) => [f.status, f.path, f.additions, f.deletions]);
/** Ask the office's own object directory, as a person could. */
const inStore = (store, ...args) => execFileSync(realGit, ['--git-dir', store, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const objectsIn = (store) => { try { return fs.readdirSync(path.join(store, 'objects'), { recursive: true }).filter((name) => /[0-9a-f]{38}$/.test(name)).length; } catch { return 0; } };
/** Is the content of this file, as it is on disk now, among the objects the office holds? */
const holds = (store, work, file) => spawnSync(realGit, ['--git-dir', store, 'cat-file', '-e', git(work, 'hash-object', file).trim()]).status === 0;

/**
 * A turn during which `work` happens — while the agent waits on a permission —
 * as if the agent had done it. Returns the turn's number once its snapshots are in.
 */
async function turnThat(h, id, work, script = 'ask:make the change; say:done') {
  const n = await h.begin(id, script);
  const card = await h.need(id);
  await work();
  await h.answer(card.id, { action: 'once' });
  await h.turnDone(id, n);
  await h.ctx.harness.checkpoints.settled(id);
  return n;
}

/** A turn that touches no file. */
async function quietTurn(h, id, text = 'say:nothing to change') {
  const t = await h.turn(id, text);
  await h.ctx.harness.checkpoints.settled(id);
  return t.n;
}

// What this checkout's own repository holds under the office's name, before any of this ran.
const hereBefore = usable ? git(ROOT, 'for-each-ref', 'refs/office') : '';

test('checkpoints: reading what git says, and the settings', () => {
  // The two halves of `diff-tree -z --raw --numstat`, as git writes them: a change, an addition whose name
  // has a newline in it, a rename (two names), a binary file.
  const zero = '0'.repeat(40), one = '1'.repeat(40), two = '2'.repeat(40);
  const out = [`:100644 100755 ${one} ${two} M`, 'src/a.js', `:000000 100644 ${zero} ${one} A`, 'new\nline.txt',
    `:100644 100644 ${one} ${one} R100`, 'old name.txt', '-new name.txt', `:100644 100644 ${one} ${two} M`, 'logo.png',
    `:100644 000000 ${one} ${zero} D`, 'gone.txt',
    '3\t1\tsrc/a.js', '2\t0\tnew\nline.txt', '0\t0\t', 'old name.txt', '-new name.txt', '-\t-\tlogo.png', '0\t4\tgone.txt', ''].join('\0');
  assert.deepEqual(parseChanges(out), [
    { path: 'src/a.js', status: 'modified', additions: 3, deletions: 1, binary: false },
    { path: 'new\nline.txt', status: 'added', additions: 2, deletions: 0, binary: false },
    { path: '-new name.txt', status: 'renamed', from: 'old name.txt', additions: 0, deletions: 0, binary: false },
    { path: 'logo.png', status: 'modified', additions: 0, deletions: 0, binary: true },
    { path: 'gone.txt', status: 'deleted', additions: 0, deletions: 4, binary: false },
  ]);
  // Output cut in the middle of a name loses that name, not its mind.
  assert.deepEqual(parseChanges(`:100644 100644 ${one} ${two} M\0a.txt\0:000000 100644 ${zero} ${one} A\0half a na`, { cut: true }).map((f) => f.path), ['a.txt']);
  assert.deepEqual(parseChanges(''), []);
  assert.deepEqual(parseShortstat(' 3 files changed, 5 insertions(+), 2 deletions(-)\n'), { count: 3, additions: 5, deletions: 2 });
  assert.deepEqual(parseShortstat(' 1 file changed, 1 deletion(-)\n'), { count: 1, additions: 0, deletions: 1 });
  assert.equal(parseShortstat('nothing'), null);
  assert.ok(ENTRY_KINDS.includes('changes'));
  assert.match(repoKey('/some/repo/.git'), /^[a-f0-9]{16}$/);
  assert.notEqual(repoKey('/some/repo/.git'), repoKey('/some/other/.git'));

  // Off unless the operator asks for it; every limit has a default and cannot be pushed out of range.
  const d = harnessSettings({}).checkpoints;
  assert.deepEqual(d, { enabled: false, holdMs: 3000, timeoutMs: 30000, maxTreeFiles: 50000, maxTreeBytes: 512 * 1024 * 1024,
    maxFiles: 5000, maxBytes: 100 * 1024 * 1024, maxTurns: 100, diffBytes: 512 * 1024 });
  const odd = harnessSettings({ OFFICE_CHECKPOINTS: '1', OFFICE_CHECKPOINTS_HOLD_MS: '0', OFFICE_CHECKPOINTS_TIMEOUT_MS: 'soon', OFFICE_CHECKPOINTS_MAX_FILES: '-4',
    OFFICE_CHECKPOINTS_MAX_BYTES: '1', OFFICE_CHECKPOINTS_MAX_TURNS: '999999', OFFICE_CHECKPOINTS_DIFF_BYTES: '9e99',
    OFFICE_CHECKPOINTS_MAX_TREE_FILES: '0', OFFICE_CHECKPOINTS_MAX_TREE_BYTES: 'huge' }).checkpoints;
  assert.deepEqual(odd, { enabled: true, holdMs: 100, timeoutMs: 30000, maxTreeFiles: 1, maxTreeBytes: 512 * 1024 * 1024,
    maxFiles: 1, maxBytes: 1024, maxTurns: 10000, diffBytes: 16 * 1024 * 1024 });
  assert.equal(harnessSettings({ OFFICE_CHECKPOINTS: '0' }).checkpoints.enabled, false);
  assert.equal(harnessSettings({ OFFICE_CHECKPOINTS: '1', OFFICE_GIT: '0' }).checkpoints.enabled, false, 'no git at all means none of this either');
});

test('checkpoints: every git call is bounded in time and in output, and stopped with what it started', { skip: !usable }, async () => {
  const fine = await runGit(null, ['--version']);
  assert.equal(fine.ok, true);
  assert.match(fine.out, /^git version /);
  const cut = await runGit(null, ['--version'], { maxOut: 6 });
  assert.deepEqual([cut.ok, cut.truncated, cut.out], [false, true, 'git ve']);
  // A git that will not finish is stopped, and so is whatever it had started.
  const dir = tempDir('office-changes-bound-');
  dawdle('--version', 30);
  try {
    const began = Date.now();
    const slow = await runGit(dir, ['--version'], { timeout: 400 });
    assert.deepEqual([slow.ok, slow.timedOut], [false, true]);
    assert.ok(Date.now() - began < 5000, 'it did not wait for it');
    const pid = lastPid();
    await waitFor(() => !alive(pid), { what: 'the program to be stopped with it' });
  } finally { hurry(); }
  const missing = await runGit(path.join(dir, 'no-such-folder'), ['status']);
  assert.equal(missing.ok, false);
  assert.match(missing.err, /cannot change to/);
});

test('checkpoints: what each turn changed', { skip: !usable }, async (t) => {
  const work = repo();
  const before = everything(path.join(work, '.git'));
  const h = await startHarnessOffice({ work });
  t.after(() => h.stop());
  const s = await h.start('fake', { name: 'Ada' });
  const at = `/api/harness/sessions/${s.id}`;
  const cps = h.ctx.harness.checkpoints;
  let store = '';

  await t.test('a session in a repository says where its changes can be read', async () => {
    await cps.settled(s.id);
    const now = await h.session(s.id);
    assert.deepEqual(now.controls.changes, { method: 'GET', url: `${at}/changes`, query: ['turn'], available: true });
    assert.deepEqual(now.controls.diff, { method: 'GET', url: `${at}/diff`, query: ['turn', 'path', 'from', 'to', 'context'], available: true });
    const empty = await changes(h, s.id);
    assert.deepEqual([empty.sessionId, empty.recorded, empty.root, empty.turns, empty.keeps], [s.id, true, work, [], 100]);
    assert.deepEqual(empty.total, { turns: 0, files: 0, additions: 0, deletions: 0 });
    // The objects of its snapshots are kept by the office, in a directory of its own named after the repository.
    store = empty.store;
    assert.equal(store, path.join(h.dir, 'harness', 'checkpoints', repoKey(path.join(work, '.git'))));
    assert.equal(cps.storeOf(s.id), store);
    assert.ok(objectsIn(store) >= 6, 'the first snapshot stored every file that is not ignored');
    assert.ok(!(await h.entries(s.id)).some((e) => e.kind === 'notice' && /not being recorded/.test(e.text)), 'nothing to explain here');
    assert.deepEqual((await h.get('/api/harness')).data.limits.checkpoints, { enabled: true, holdMs: 3000, timeoutMs: 30000, maxTreeFiles: 50000,
      maxTreeBytes: 536870912, maxFiles: 5000, maxBytes: 104857600, maxTurns: 100, diffBytes: 524288 });
  });

  await t.test('a tracked edit, a new file, a deletion, a rename and a binary file — and nothing that is ignored', async () => {
    const n = await turnThat(h, s.id, () => {
      write(work, 'src/a.js', 'export const a = 1;\nexport const b = 22;\nexport const c = 3;\nexport const d = 4;\n');
      write(work, 'notes/new.md', 'one\ntwo\n');
      fs.rmSync(path.join(work, 'gone.txt'));
      fs.renameSync(path.join(work, 'old-name.txt'), path.join(work, 'new-name.txt'));
      write(work, 'logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 0, 255]));
      write(work, 'ignored/secret.txt', 'never looked at\n');
      write(work, 'debug.log', 'never looked at\n');
    }, 'ask:make the changes; edit:src/a.js; say:done');
    assert.equal(n, 1);

    const one = (await changes(h, s.id, '?turn=1')).turns[0];
    assert.equal(one.turn, 1);
    assert.ok(Math.abs(one.at - Date.now()) < 60_000);
    assert.deepEqual(one.files, [
      { path: 'gone.txt', status: 'deleted', additions: 0, deletions: 1, binary: false },
      { path: 'logo.png', status: 'added', additions: 0, deletions: 0, binary: true },
      { path: 'new-name.txt', status: 'renamed', from: 'old-name.txt', additions: 0, deletions: 0, binary: false },
      { path: 'notes/new.md', status: 'added', additions: 2, deletions: 0, binary: false },
      { path: 'src/a.js', status: 'modified', additions: 2, deletions: 1, binary: false },
    ]);
    assert.deepEqual([one.count, one.additions, one.deletions, one.truncated, one.skipped, one.head], [5, 4, 2, false, undefined, undefined]);
    assert.match(one.trees.start, /^[0-9a-f]{40}$/);
    assert.notEqual(one.trees.start, one.trees.end);

    // Every client can say "5 files changed" from the transcript alone.
    const entry = await waitFor(() => h.entry(s.id, 'turn-1:changes'), { what: 'the changes entry of turn 1' });
    assert.deepEqual([entry.kind, entry.turn, entry.more, entry.additions, entry.deletions], ['changes', 1, 0, 4, 2]);
    assert.deepEqual(entry.files, [
      { path: 'gone.txt', status: 'deleted', additions: 0, deletions: 1 },
      { path: 'logo.png', status: 'added', additions: 0, deletions: 0, binary: true },
      { path: 'new-name.txt', status: 'renamed', from: 'old-name.txt', additions: 0, deletions: 0 },
      { path: 'notes/new.md', status: 'added', additions: 2, deletions: 0 },
      { path: 'src/a.js', status: 'modified', additions: 2, deletions: 1 },
    ]);
    // …beside what the agent said it did, which is a different thing.
    assert.deepEqual((await h.turnView(s.id, 1)).entries.find((e) => e.kind === 'tool' && e.toolKind === 'edit').paths, ['src/a.js']);

    // A snapshot is a tree in the office's own directory: the new file is in it, the ignored ones are not.
    assert.equal(inStore(store, 'cat-file', '-t', one.trees.end).trim(), 'tree');
    assert.deepEqual(inStore(store, 'ls-tree', '-r', '--name-only', one.trees.end).split('\n').filter(Boolean),
      ['.gitignore', 'README.md', 'logo.png', 'new-name.txt', 'notes/new.md', 'src/a.js']);
    assert.equal(inStore(store, 'for-each-ref').trim(), '', 'and no ref is written, there or anywhere');
  });

  await t.test('the diff of a turn, of one file of it, and with more or less around each change', async () => {
    const whole = await diffOf(h, s.id, 'turn=1');
    assert.deepEqual([whole.sessionId, whole.turn, whole.from, whole.to, whole.context, whole.truncated], [s.id, 1, 1, 1, 3, false]);
    assert.match(whole.diff, /^diff --git a\/gone\.txt b\/gone\.txt\ndeleted file mode 100644/);
    assert.match(whole.diff, /\nBinary files \/dev\/null and b\/logo\.png differ\n/);
    assert.match(whole.diff, /\nsimilarity index 100%\nrename from old-name\.txt\nrename to new-name\.txt\n/);
    assert.match(whole.diff, /\n--- a\/src\/a\.js\n\+\+\+ b\/src\/a\.js\n@@ -1,3 \+1,4 @@\n export const a = 1;\n-export const b = 2;\n\+export const b = 22;\n export const c = 3;\n\+export const d = 4;\n/);
    assert.equal(whole.diff.split('\n').filter((l) => l.startsWith('diff --git ')).length, 5);
    assert.ok(!/secret|debug\.log/.test(whole.diff));

    const file = await diffOf(h, s.id, 'turn=1&path=src%2Fa.js');
    assert.equal(file.path, 'src/a.js');
    assert.equal(file.diff.split('\n').filter((l) => l.startsWith('diff --git ')).length, 1);
    assert.match(file.diff, /^diff --git a\/src\/a\.js b\/src\/a\.js\n/);
    const tight = await diffOf(h, s.id, 'turn=1&path=src%2Fa.js&context=0');
    assert.equal(tight.context, 0);
    assert.match(tight.diff, /\n@@ -2 \+2 @@[^\n]*\n-export const b = 2;\n\+export const b = 22;\n@@ -3,0 \+4 @@[^\n]*\n\+export const d = 4;\n$/);
    // A renamed file is one change with two names, also when it is asked for alone by its new one.
    assert.match((await diffOf(h, s.id, 'turn=1&path=new-name.txt')).diff, /^diff --git a\/old-name\.txt b\/new-name\.txt\nsimilarity index 100%\nrename from old-name\.txt\nrename to new-name\.txt\n$/);
    assert.equal((await diffOf(h, s.id, 'turn=1&path=README.md')).diff, '', 'a file the turn did not touch has no diff');
    // A folder is a path too: everything the turn changed under it.
    assert.match((await diffOf(h, s.id, 'turn=1&path=notes')).diff, /^diff --git a\/notes\/new\.md b\/notes\/new\.md\nnew file mode 100644\n/);
  });

  await t.test('a turn that changes nothing writes nothing', async () => {
    const stored = objectsIn(store);
    const n = await quietTurn(h, s.id);
    assert.equal(n, 2);
    const two = (await changes(h, s.id, '?turn=2')).turns[0];
    assert.deepEqual([two.files, two.count, two.truncated, two.skipped], [[], 0, false, undefined]);
    assert.equal(two.trees.start, two.trees.end);
    await sleep(80);
    assert.equal(await h.entry(s.id, 'turn-2:changes'), null);
    assert.equal(objectsIn(store), stored, 'not in the office\'s directory either');
    assert.equal((await diffOf(h, s.id, 'turn=2')).diff, '');
  });

  await t.test('what was changed between turns is not put down to the next one', async () => {
    write(work, 'README.md', '# demo\n\nedited by a person while the agent was idle\n');
    const n = await turnThat(h, s.id, () => write(work, 'src/a.js', 'export const a = 100;\nexport const b = 22;\nexport const c = 3;\nexport const d = 4;\n'));
    assert.equal(n, 3);
    const all = await changes(h, s.id);
    assert.deepEqual(all.turns.map((turn) => [turn.turn, brief(turn.files)]), [
      [1, [['deleted', 'gone.txt', 0, 1], ['added', 'logo.png', 0, 0], ['renamed', 'new-name.txt', 0, 0], ['added', 'notes/new.md', 2, 0], ['modified', 'src/a.js', 2, 1]]],
      [2, []],
      [3, [['modified', 'src/a.js', 1, 1]]],
    ]);
    // The session as a whole: its turns' changes added up, each file counted once.
    assert.deepEqual(all.total, { turns: 2, files: 5, additions: 5, deletions: 3 });
    assert.deepEqual((await h.entry(s.id, 'turn-3:changes')).files, [{ path: 'src/a.js', status: 'modified', additions: 1, deletions: 1 }]);

    // From the start of one turn to the end of a later one is everything in between, whoever did it.
    const span = await diffOf(h, s.id, 'from=1&to=3');
    assert.deepEqual([span.from, span.to, span.turn], [1, 3, undefined]);
    assert.match(span.diff, /\n\+edited by a person while the agent was idle\n/);
    assert.match(span.diff, /\n-export const a = 1;\n-export const b = 2;\n\+export const a = 100;\n\+export const b = 22;\n/);
    const late = await diffOf(h, s.id, 'from=2&to=3');
    assert.match(late.diff, /README\.md/);
    assert.ok(!/logo\.png/.test(late.diff));
  });

  await t.test('an agent that acts the instant it is prompted finds the snapshot before its turn already taken', async () => {
    // Its first step is to ask the office what this very turn has on record.
    const n = (await h.session(s.id)).turns + 1;
    const told = await h.turn(s.id, `http:GET ${at}/changes?turn=${n}; say:and then went on`);
    await cps.settled(s.id);
    assert.match(told.said, /^http=200:/);
    const seen = /"turn":(\d+),"at":\d+,"files":\[\],"count":0,"additions":0,"deletions":0,"truncated":false,"pending":true,"trees":\{"start":"([0-9a-f]{40})"\}/.exec(told.said);
    assert.ok(seen, `the turn was on record, with where it started from, before the agent could act: ${told.said}`);
    assert.equal(Number(seen[1]), n);
    assert.equal((await changes(h, s.id, `?turn=${n}`)).turns[0].trees.start, seen[2]);
    // An agent may read this, as it may read a transcript — it presented its own session token there.
  });

  await t.test('questions that cannot be answered say why', async () => {
    assert.equal((await h.get(`${at}/changes?turn=zero`)).status, 400);
    assert.equal((await h.get(`${at}/changes?turn=99`)).status, 404);
    assert.match((await h.get(`${at}/changes?turn=99`)).data.error, /no record of turn 99/);
    assert.equal((await h.get(`${at}/diff`)).status, 400);
    assert.match((await h.get(`${at}/diff`)).data.error, /\?turn=n, or \?from=a&to=b/);
    assert.equal((await h.get(`${at}/diff?from=3&to=1`)).status, 400);
    assert.equal((await h.get(`${at}/diff?from=1`)).status, 400);
    assert.equal((await h.get(`${at}/diff?turn=1&context=1000`)).status, 400);
    assert.equal((await h.get(`${at}/diff?turn=99`)).status, 404);
    for (const outside of ['../elsewhere', 'src/../../elsewhere', '/etc/passwd', 'C:\\Windows']) {
      assert.equal((await h.get(`${at}/diff?turn=1&path=${encodeURIComponent(outside)}`)).status, 400, outside);
    }
    assert.equal((await h.get('/api/harness/sessions/d_000000000000/changes')).status, 404);
    assert.equal((await h.get('/api/harness/sessions/..%2f..%2fetc%2fpasswd/diff?turn=1')).status, 404);
    assert.equal((await h.get('/api/harness/sessions/Ada/changes?turn=1')).data.turns[0].count, 5, 'a session answers to its agent\'s name here too');
    // While a turn runs it has a start and no end yet.
    const n = await h.begin(s.id, 'ask:wait here');
    const card = await h.need(s.id);
    const running = (await changes(h, s.id, `?turn=${n}`)).turns[0];
    assert.deepEqual([running.pending, running.files], [true, []]);
    const early = await h.get(`${at}/diff?turn=${n}`);
    assert.equal(early.status, 409);
    assert.match(early.data.error, /still running/);
    await h.answer(card.id, { action: 'reject' });
    await h.turnDone(s.id, n);
    await cps.settled(s.id);
    assert.equal((await changes(h, s.id, `?turn=${n}`)).turns[0].pending, undefined);
  });

  await t.test('the session ends: its record stays readable, its index goes, and the repository is as it was', async () => {
    const index = path.join(h.dir, 'harness', `${s.id}.index`);
    assert.ok(fs.existsSync(index), 'while it lives, a session keeps an index of its own — in the office\'s folder, not the repository\'s');
    await h.del(at);
    await cps.settled(s.id);
    assert.ok(!fs.existsSync(index) && !fs.existsSync(`${index}.lock`));
    const after = await h.session(s.id);
    assert.equal(after.live, false);
    assert.equal(after.controls.changes.available, true, 'what it changed can still be read');
    assert.equal((await changes(h, s.id)).turns.length, 5);
    assert.match((await diffOf(h, s.id, 'turn=3')).diff, /export const a = 100;/);
    // Five turns, two of them changing files, a dozen questions asked — and of the repository itself, nothing written.
    assert.deepEqual(everything(path.join(work, '.git')), before);
  });
});
