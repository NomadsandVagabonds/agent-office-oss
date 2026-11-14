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
import zlib from 'node:zlib';
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
const realGit = (usable && spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout?.trim()) || 'git';
const tools = fs.realpathSync(tempDir('office-changes-tools-'));
const SLOW = path.join(tools, 'slow'), PIDS = path.join(tools, 'pids'), ARGC = path.join(tools, 'argc');
if (usable) {
  fs.writeFileSync(path.join(tools, 'git'), ['#!/bin/sh', `if [ -f '${SLOW}' ]; then`, `  read sub secs < '${SLOW}'`,
    `  case " $* " in *" $sub "*) echo $$ >> '${PIDS}'; sleep "$secs";; esac`, 'fi',
    // …and how many arguments a pruning was given, for the test about how many trees it can be asked to keep
    `case " $* " in *" prune "*) echo "$#" >> '${ARGC}';; esac`, `exec '${realGit}' "$@"`, ''].join('\n'), { mode: 0o755 });
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
/**
 * How much of the disk the office's directory for one repository takes: the space every file under
 * `objects` occupies — which is what `du` says, not their lengths added up — in whole KiB, as git counts it.
 */
const weightOf = (store) => Math.floor(fs.readdirSync(path.join(store, 'objects'), { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
  .reduce((sum, entry) => sum + fs.statSync(path.join(entry.parentPath, entry.name)).blocks * 512, 0) / 1024) * 1024;
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

// What this checkout's own repository holds under the office's name, before any of this ran. A copy of the
// project that is not a checkout — an archive, an export — is in no repository at all: null, and nothing to prove.
const refsHere = () => {
  const asked = usable ? spawnSync(realGit, ['-C', ROOT, 'for-each-ref', 'refs/office'], { encoding: 'utf8' }) : null;
  return asked && asked.status === 0 ? asked.stdout : null;
};
const hereBefore = refsHere();

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

  // On unless the operator says otherwise; every limit has a default and cannot be pushed out of range.
  const d = harnessSettings({}).checkpoints;
  assert.deepEqual(d, { enabled: true, holdMs: 3000, timeoutMs: 30000, maxTreeFiles: 50000, maxTreeBytes: 512 * 1024 * 1024,
    maxFiles: 5000, maxBytes: 100 * 1024 * 1024, maxTurns: 100, diffBytes: 512 * 1024, noticeBytes: 64 * 1024 * 1024 });
  const odd = harnessSettings({ OFFICE_CHECKPOINTS_HOLD_MS: '0', OFFICE_CHECKPOINTS_TIMEOUT_MS: 'soon', OFFICE_CHECKPOINTS_MAX_FILES: '-4',
    OFFICE_CHECKPOINTS_MAX_BYTES: '1', OFFICE_CHECKPOINTS_MAX_TURNS: '999999', OFFICE_CHECKPOINTS_DIFF_BYTES: '9e99',
    OFFICE_CHECKPOINTS_MAX_TREE_FILES: '0', OFFICE_CHECKPOINTS_MAX_TREE_BYTES: 'huge', OFFICE_CHECKPOINTS_NOTICE_BYTES: '-1' }).checkpoints;
  assert.deepEqual(odd, { enabled: true, holdMs: 100, timeoutMs: 30000, maxTreeFiles: 1, maxTreeBytes: 512 * 1024 * 1024,
    maxFiles: 1, maxBytes: 1024, maxTurns: 10000, diffBytes: 16 * 1024 * 1024, noticeBytes: 0 });
  assert.equal(harnessSettings({ OFFICE_CHECKPOINTS: '0' }).checkpoints.enabled, false);
  assert.equal(harnessSettings({ OFFICE_GIT: '0' }).checkpoints.enabled, false, 'no git at all means none of this either');
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
    // …and how much that is, is part of the answer: it is the owner's disk.
    assert.deepEqual(empty.stored, { bytes: weightOf(store), objects: objectsIn(store) });
    assert.ok(empty.stored.bytes > 0 && empty.stored.bytes < 1024 * 1024);
    assert.ok(!(await h.entries(s.id)).some((e) => e.kind === 'notice'), 'nothing to explain here: the folder is recorded, and what is kept for it is small');
    assert.deepEqual((await h.get('/api/harness')).data.limits.checkpoints, { enabled: true, holdMs: 3000, timeoutMs: 30000, maxTreeFiles: 50000,
      maxTreeBytes: 536870912, maxFiles: 5000, maxBytes: 104857600, maxTurns: 100, diffBytes: 524288, noticeBytes: 67108864 });
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

/** A session with several turns that change files in `cwd`, and one that does not; returns what the office recorded. */
async function busySession(h, cwd, name) {
  const s = await h.start('fake', { name, cwd });
  await turnThat(h, s.id, () => write(cwd, 'agent-1.txt', 'made in turn 1\n'));
  await quietTurn(h, s.id);
  await turnThat(h, s.id, () => { write(cwd, 'agent-1.txt', 'changed in turn 3\n'); write(cwd, 'deep/agent-2.txt', 'made in turn 3\n'); });
  await turnThat(h, s.id, () => fs.rmSync(path.join(cwd, 'agent-1.txt')));
  const got = await changes(h, s.id);
  const whole = await diffOf(h, s.id, 'from=1&to=4');
  await h.del(`/api/harness/sessions/${s.id}`);
  await h.ctx.harness.checkpoints.settled(s.id);
  return { ...got, whole: whole.diff };
}
const BUSY = [[1, [['added', 'agent-1.txt', 1, 0]]], [2, []], [3, [['modified', 'agent-1.txt', 1, 1], ['added', 'deep/agent-2.txt', 1, 0]]], [4, [['deleted', 'agent-1.txt', 0, 1]]]];
const turnsOf = (got) => got.turns.map((turn) => [turn.turn, brief(turn.files)]);

test('checkpoints: nothing is written into the repository', { skip: !usable }, async (t) => {
  const h = await startHarnessOffice({ work: repo('office-changes-unused-') });
  t.after(() => h.stop());

  await t.test('a dirty index, a stash, hooks, a file-system monitor, filters, diff programs, a split index', async (t2) => {
    // The office's "who is working where" view (server/workspace.mjs) runs `git status` in the folders agents
    // work in. That only reads — but in a repository with a split index, git changes the time of the shared
    // index file whenever the index is read. To see what snapshots do, and only that, this office is one that
    // does not read git for that view (it does not when it listens beyond this machine, unless asked to).
    const quiet = await startHarnessOffice({ work: repo('office-changes-unused-'), env: { OFFICE_HOST: '0.0.0.0', OFFICE_TOKEN: 'test-office-token-0123456789' } });
    t2.after(() => quiet.stop());
    assert.equal(quiet.cfg.gitProbe, false);
    const h = quiet;                                  // eslint-disable-line no-shadow
    const work = repo('office-changes-owner-');
    const told = fs.realpathSync(tempDir('office-changes-told-'));      // where a program of the repository's would leave word
    const log = path.join(told, 'ran.log');
    const gitDir = path.join(work, '.git');
    // Every hook that a command of ours could reach, each one a tell-tale (`git add` runs post-index-change).
    for (const name of ['pre-commit', 'post-commit', 'post-index-change', 'reference-transaction', 'post-checkout', 'pre-auto-gc', 'fsmonitor-watchman', 'post-rewrite']) {
      const hook = path.join(gitDir, 'hooks', name);
      fs.mkdirSync(path.dirname(hook), { recursive: true });
      fs.writeFileSync(hook, `#!/bin/sh\necho "${name} $*" >> '${log}'\n`, { mode: 0o755 });
    }
    // A content filter (as git-lfs is one), an external diff program and a text converter: programs the
    // repository's config names and a file's attributes select. None may be started for a snapshot or a diff.
    git(work, 'config', 'filter.tell.clean', `sh -c 'echo filter-clean >> ${log}; cat'`);
    git(work, 'config', 'filter.tell.smudge', `sh -c 'echo filter-smudge >> ${log}; cat'`);
    git(work, 'config', 'filter.tell.required', 'true');
    git(work, 'config', 'diff.external', `sh -c 'echo external-diff >> ${log}'`);
    git(work, 'config', 'diff.tell.textconv', `sh -c 'echo textconv >> ${log}; cat "$0"'`);
    write(work, '.gitattributes', '*.txt filter=tell\n*.md diff=tell\n');
    git(work, 'add', '.gitattributes');
    git(work, 'commit', '-q', '--no-verify', '-m', 'attributes');
    // A stash, then a dirty index: one change staged, one file staged new, one change not staged, one file untracked.
    write(work, 'README.md', '# demo\n\nstashed away\n');
    git(work, 'stash', 'push', '-q', '-m', 'kept for later');
    write(work, 'src/a.js', 'export const a = "staged";\nexport const b = 2;\nexport const c = 3;\n');
    write(work, 'staged-new.md', 'staged but never committed\n');
    git(work, 'add', 'src/a.js', 'staged-new.md');
    write(work, 'README.md', '# demo\n\nchanged but not staged\n');
    write(work, 'untracked.md', 'nobody told git about this\n');
    // A file-system monitor named by config: a program git would start on every look at the tree.
    git(work, 'config', 'core.fsmonitor', path.join(gitDir, 'hooks', 'fsmonitor-watchman'));
    // And a split index whose shared half counts as expired the moment anything writes another shared index
    // into this repository — which an index of ours would, were it written the way the owner's is.
    git(work, 'config', 'core.splitIndex', 'true');
    git(work, 'config', 'splitIndex.sharedIndexExpire', 'now');
    git(work, 'update-index', '--split-index');
    assert.equal(fs.readdirSync(gitDir).filter((name) => name.startsWith('sharedindex.')).length, 1);

    const before = everything(gitDir);
    const indexBefore = sha(fs.readFileSync(path.join(gitDir, 'index')));
    const filesBefore = contents(work);
    fs.rmSync(log, { force: true });                 // the tell-tales we set off ourselves, setting this up

    const got = await busySession(h, work, 'Careful');
    assert.deepEqual(turnsOf(got), BUSY);
    assert.equal(fs.existsSync(log), false, 'no hook, monitor, filter, diff program or converter was started');
    assert.deepEqual(everything(gitDir), before, 'every path, size and time under .git, every ref and the object counts are what they were');
    assert.equal(sha(fs.readFileSync(path.join(gitDir, 'index'))), indexBefore);
    assert.deepEqual(contents(work), { ...filesBefore, 'deep/agent-2.txt': sha('made in turn 3\n') }, 'and of the working files, only what the turns did');
    // The snapshots had what was on disk — staged, unstaged and untracked alike — as it is on disk (no filter ran over it).
    const store = got.store, last = got.turns[3].trees.end;
    assert.equal(inStore(store, 'show', `${last}:untracked.md`), 'nobody told git about this\n');
    assert.equal(inStore(store, 'show', `${last}:README.md`), '# demo\n\nchanged but not staged\n');
    assert.equal(inStore(store, 'show', `${last}:staged-new.md`), 'staged but never committed\n');
    assert.equal(inStore(store, 'show', `${last}:deep/agent-2.txt`), 'made in turn 3\n');
    assert.match(got.whole, /^diff --git a\/deep\/agent-2\.txt b\/deep\/agent-2\.txt\nnew file mode 100644\n/);
    // The owner's git still works, and still has its stash and its staged changes (asking it sets its own tell-tales off; that is theirs).
    assert.match(git(work, 'stash', 'list'), /kept for later/);
    assert.deepEqual(git(work, 'diff', '--cached', '--name-only', '--no-ext-diff').trim().split('\n'), ['src/a.js', 'staged-new.md']);
  });

  await t.test('a merge that stopped on a conflict', async () => {
    const work = repo('office-changes-merge-');
    git(work, 'checkout', '-q', '-b', 'theirs');
    write(work, 'src/a.js', 'export const a = "theirs";\nexport const b = 2;\nexport const c = 3;\n');
    git(work, 'commit', '-q', '-am', 'theirs');
    git(work, 'checkout', '-q', 'main');
    write(work, 'src/a.js', 'export const a = "ours";\nexport const b = 2;\nexport const c = 3;\n');
    git(work, 'commit', '-q', '-am', 'ours');
    assert.throws(() => git(work, 'merge', 'theirs'));
    const gitDir = path.join(work, '.git');
    assert.ok(fs.existsSync(path.join(gitDir, 'MERGE_HEAD')), 'the merge stopped half way');
    const before = everything(gitDir);
    const got = await busySession(h, work, 'Midway');
    assert.deepEqual(turnsOf(got), BUSY);
    assert.deepEqual(everything(gitDir), before);
    // The conflicted file is in the snapshot as it lies there, markers and all; the merge is still the owner's to finish.
    assert.match(inStore(got.store, 'show', `${got.turns[0].trees.start}:src/a.js`), /^<<<<<<< HEAD\nexport const a = "ours";\n=======\nexport const a = "theirs";\n>>>>>>> theirs\n/);
    assert.match(git(work, 'status', '--porcelain'), /^UU src\/a\.js$/m);
  });

  await t.test('a checkout made with git worktree', async () => {
    const main = repo('office-changes-main-');
    const side = path.join(fs.realpathSync(tempDir('office-changes-side-')), 'checkout');
    git(main, 'worktree', 'add', '-q', '-b', 'side', side);
    const gitDir = path.join(main, '.git');
    const before = everything(gitDir);                // the main repository's git directory holds the worktree's too
    const got = await busySession(h, side, 'Side');
    assert.deepEqual(turnsOf(got), BUSY);
    assert.equal(got.root, side);
    assert.equal(got.store, path.join(h.dir, 'harness', 'checkpoints', repoKey(gitDir)), 'one repository, one object directory, whichever checkout');
    assert.deepEqual(everything(gitDir), before);
    // The record does not need the checkout: it is read from the office's own files.
    git(main, 'worktree', 'remove', '--force', side);
    assert.match(got.whole, /deep\/agent-2\.txt/);
  });

  await t.test('a repository with a submodule: the submodule is left out, and has a record of its own when a session works in it', async () => {
    const lib = repo('office-changes-lib-');
    const top = repo('office-changes-super-');
    git(top, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', lib, 'lib');
    git(top, 'commit', '-q', '-m', 'a submodule');
    const gitDir = path.join(top, '.git');
    assert.ok(fs.existsSync(path.join(gitDir, 'modules', 'lib', 'HEAD')));
    const before = everything(gitDir);                // …which includes the submodule's own git directory, under modules/
    const s = await h.start('fake', { name: 'Above', cwd: top });
    await turnThat(h, s.id, () => { write(top, 'beside.txt', 'in the outer repository\n'); write(top, 'lib/inside.txt', 'in the submodule\n'); write(top, 'lib/README.md', '# changed inside\n'); });
    const outer = await changes(h, s.id);
    assert.deepEqual(brief(outer.turns[0].files), [['added', 'beside.txt', 1, 0]], 'what happens inside the submodule is not the outer session\'s to record');
    assert.deepEqual(inStore(outer.store, 'ls-tree', '--name-only', outer.turns[0].trees.end).split('\n').filter(Boolean),
      ['.gitignore', '.gitmodules', 'README.md', 'beside.txt', 'gone.txt', 'old-name.txt', 'src']);
    await h.del(`/api/harness/sessions/${s.id}`);
    await h.ctx.harness.checkpoints.settled(s.id);
    const inner = await busySession(h, path.join(top, 'lib'), 'Within');
    assert.deepEqual(turnsOf(inner), BUSY);
    assert.equal(inner.root, path.join(top, 'lib'));
    assert.notEqual(inner.store, outer.store);
    assert.deepEqual(everything(gitDir), before);
  });

  await t.test('a repository that names its objects with SHA-256', async () => {
    const work = fs.realpathSync(tempDir('office-changes-sha256-'));
    git(work, 'init', '-q', '-b', 'main', '--object-format=sha256');
    write(work, 'a.txt', 'one\n');
    git(work, 'add', '.');
    git(work, 'commit', '-q', '-m', 'first');
    const before = everything(path.join(work, '.git'));
    const got = await busySession(h, work, 'Longer');
    assert.deepEqual(turnsOf(got), BUSY);
    assert.match(got.turns[0].trees.end, /^[0-9a-f]{64}$/);
    assert.deepEqual(everything(path.join(work, '.git')), before);
  });

  await t.test('and no command the office runs could: none writes a ref there, and no objects are borrowed', () => {
    const source = fs.readFileSync(path.join(ROOT, 'server', 'harness', 'checkpoints.mjs'), 'utf8');
    const commands = [...source.matchAll(/\[\s*'(?:-c',\s*'[^']*',\s*')*([a-z][a-z-]+)'/g)].map((m) => m[1]);
    for (const banned of ['symbolic-ref', 'commit', 'commit-tree', 'checkout', 'checkout-index', 'reset', 'restore', 'stash', 'clean',
      'read-tree', 'gc', 'repack', 'pack-refs', 'branch', 'tag', 'worktree', 'merge', 'rebase', 'fetch', 'pull', 'push', 'rm', 'mv']) {
      assert.ok(!commands.includes(banned), `no "git ${banned}"`);
    }
    assert.ok(commands.includes('write-tree') && commands.includes('add') && commands.includes('diff-tree'), 'the reading of the source found the commands it does run');
    // The one ref the office ever writes is in its own directory, while it tidies up there: every command that
    // could write or remove a ref or an object by name is given that directory explicitly (`own`), and no other.
    const writers = source.split('\n').filter((row) => /'(?:update-ref|prune|mktree)'/.test(row));
    assert.equal(writers.length, 5);
    for (const row of writers) assert.match(row, /\bown\(\['(?:update-ref|prune|mktree)'/, row.trim());
    assert.match(source, /const own = \(args, opt = \{\}\) => git\(null, \[`--git-dir=\$\{at\}`, \.\.\.args\]/);
    assert.ok(!/GIT_ALTERNATE_OBJECT_DIRECTORIES\s*=|env\.GIT_ALTERNATE_OBJECT_DIRECTORIES/.test(source));
  });
});

test('checkpoints: the office\'s own files are all a snapshot is, and they are tidied away', { skip: !usable }, async (t) => {
  // The store itself, without an office around it — and without the hour's grace it normally gives young objects.
  const work = repo('office-changes-tidy-');
  const data = tempDir('office-changes-tidy-data-');
  const settings = harnessSettings({ OFFICE_CHECKPOINTS: '1' }).checkpoints;
  const cps = createCheckpoints({ settings, dir: path.join(data, 'harness'), file: path.join(data, 'checkpoints.json'), log: { warn() {} }, graceSeconds: 0 });
  t.after(() => cps.stop());
  const a = 'd_aaaaaaaaaaaa', b = 'd_bbbbbbbbbbbb';
  assert.equal(await cps.open({ id: a, cwd: work }), true);
  assert.equal(await cps.open({ id: b, cwd: work }), true);
  await cps.turnStarted(a, 1);
  write(work, 'only-a.txt', 'seen in a turn of the first session only\n');
  assert.deepEqual((await cps.turnEnded(a, 1)).files, [{ path: 'only-a.txt', status: 'added', additions: 1, deletions: 0 }]);
  fs.rmSync(path.join(work, 'only-a.txt'));
  await cps.turnStarted(b, 1);
  write(work, 'only-b.txt', 'seen by the second\n');
  assert.deepEqual((await cps.turnEnded(b, 1)).files, [{ path: 'only-b.txt', status: 'added', additions: 1, deletions: 0 }]);
  const store = cps.storeOf(a);
  assert.equal(cps.storeOf(b), store, 'two sessions in one repository share its object directory');
  const idOfA = execFileSync(realGit, ['hash-object', '--stdin'], { input: 'seen in a turn of the first session only\n', encoding: 'utf8' }).trim();
  const idOfB = execFileSync(realGit, ['hash-object', '--stdin'], { input: 'seen by the second\n', encoding: 'utf8' }).trim();
  const has = (id) => spawnSync(realGit, ['--git-dir', store, 'cat-file', '-e', id]).status === 0;
  assert.ok(has(idOfA) && has(idOfB));

  // Forgetting one session lets go of what only its snapshots needed; the other's are untouched.
  await cps.close(a);
  assert.equal(await cps.forget(a), true);
  assert.equal(has(idOfA), false);
  assert.equal(has(idOfB), true);
  assert.equal((await cps.changes(a)).recorded, false);
  assert.match((await cps.diff(b, { turn: 1 })).diff, /\+seen by the second/);
  // Forgetting the last one removes the directory. Nothing was ever anywhere else.
  await cps.close(b);
  await cps.forget(b);
  assert.equal(fs.existsSync(store), false);
  assert.deepEqual(fs.readdirSync(path.join(data, 'harness')).filter((name) => name !== 'checkpoints'), []);

  await t.test('however many trees are on record: git is not handed them on its command line', async () => {
    // At its caps the office can have tens of thousands of trees to keep. Naming each one to `git prune` as an
    // argument fails outright past the system's limit, and then nothing would ever be cleaned. So: more trees
    // than that limit has room for.
    const limit = Number(spawnSync('getconf', ['ARG_MAX'], { encoding: 'utf8' }).stdout) || 2 * 1024 * 1024;
    const many = Math.min(140_000, 2 * Math.ceil((limit / 41 + 1000) / 2));
    const data2 = tempDir('office-changes-many-data-');
    const key = repoKey(path.join(work, '.git'));
    const store2 = path.join(data2, 'harness', 'checkpoints', key);
    fs.mkdirSync(path.dirname(store2), { recursive: true });
    execFileSync(realGit, ['init', '-q', '--bare', '--template=', store2]);
    const put = (text) => execFileSync(realGit, ['--git-dir', store2, 'hash-object', '-w', '--stdin'], { input: text, encoding: 'utf8' }).trim();
    const there = (id) => spawnSync(realGit, ['--git-dir', store2, 'cat-file', '-e', id]).status === 0;
    const blob = put('in every tree\n'), stray = put('needed by nothing\n');
    const trees = plantTrees(store2, blob, many);
    const turns = [];
    for (let i = 0; i < many; i += 2) turns.push({ n: i / 2 + 1, at: 1, start: { tree: trees[i], at: 1, ms: 1 }, end: { tree: trees[i + 1], at: 1, ms: 1 } });
    const record = (list) => ({ root: work, repo: path.join(work, '.git'), key, at: 1, turns: list });
    fs.writeFileSync(path.join(data2, 'checkpoints.json'), JSON.stringify({ v: 1, sessions: {
      d_cccccccccccc: record(turns), d_dddddddddddd: record([]), d_eeeeeeeeeeee: record([]) } }));
    if (many * 41 > limit) {
      const direct = spawnSync(realGit, ['--git-dir', store2, 'prune', '--expire=now', ...trees]);
      assert.equal(direct.error?.code, 'E2BIG', 'naming every tree as an argument cannot even be started here');
    }
    const warnings = [];
    const big = createCheckpoints({ settings, dir: path.join(data2, 'harness'), file: path.join(data2, 'checkpoints.json'), log: { warn: (m) => warnings.push(m) }, graceSeconds: 0 });
    try {
      fs.rmSync(ARGC, { force: true });
      assert.equal(await big.forget('d_dddddddddddd'), true);
      assert.deepEqual(warnings, []);
      assert.equal(there(stray), false, 'what nothing needed is gone');
      assert.ok(there(blob) && there(trees[0]) && there(trees[many / 2]) && there(trees[many - 1]), 'and the trees on record are still there');
      assert.ok(objectsIn(store2) >= many + 1);
      assert.equal(inStore(store2, 'for-each-ref').trim(), '', 'the one ref it held them by is gone again');
      assert.ok(Number(fs.readFileSync(ARGC, 'utf8').trim().split('\n').pop()) < 20, 'git was given the same few arguments it would be for one tree');
      const after = await big.changes('d_cccccccccccc', { turn: 1 });
      assert.equal(after.turns[0].count, 1, 'a snapshot kept through it can still be read');
      assert.deepEqual(after.stored, { bytes: weightOf(store2), objects: objectsIn(store2) }, 'and what is kept was counted again after the clearing out');

      // A tidying that fails says so — it must not go quiet and leave the directory to grow unnoticed.
      fs.rmSync(path.join(store2, 'HEAD'));
      assert.equal(await big.forget('d_eeeeeeeeeeee'), true);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /^\[checkpoints\] could not tidy \S+: git could not look up the trees to keep \(.+\); nothing was removed$/);
    } finally { await big.stop(); }

    // …and a directory git cannot count is not given a number by the next office: none is better than a wrong one.
    const next = createCheckpoints({ settings, dir: path.join(data2, 'harness'), file: path.join(data2, 'checkpoints.json'), log: { warn() {} }, graceSeconds: 0 });
    try {
      const unread = await next.changes('d_cccccccccccc', { turn: 1 });
      assert.match(unread.turns[0].skipped, /^its snapshots can no longer be read \(/);
      assert.equal('stored' in unread, false);
      assert.equal(unread.store, store2, 'where it is, is still said');
    } finally { await next.stop(); }
  });
});

/** Many small trees, written straight into an object directory of ours — git itself takes seconds to make this many one by one. */
function plantTrees(store, blob, count) {
  const inside = Buffer.from(blob, 'hex');
  const folders = new Set();
  const ids = [];
  for (let i = 0; i < count; i++) {
    const body = Buffer.concat([Buffer.from(`100644 f${i}\0`), inside]);
    const whole = Buffer.concat([Buffer.from(`tree ${body.length}\0`), body]);
    const id = crypto.createHash('sha1').update(whole).digest('hex');
    const folder = path.join(store, 'objects', id.slice(0, 2));
    if (!folders.has(folder)) { fs.mkdirSync(folder, { recursive: true }); folders.add(folder); }
    fs.writeFileSync(path.join(folder, id.slice(2)), zlib.deflateSync(whole, { level: 1 }));
    ids.push(id);
  }
  return ids;
}

test('checkpoints: a snapshot that would cost too much is skipped, and says why', { skip: !usable }, async (t) => {
  await t.test('one turn\'s worth: too large, or too many', async () => {
    const work = repo('office-changes-big-');
    const h = await startHarnessOffice({ work, env: { OFFICE_CHECKPOINTS_MAX_BYTES: '4096', OFFICE_CHECKPOINTS_MAX_FILES: '4' } });
    try {
      const s = await h.start('fake', { name: 'Bulky' });
      const notices = async () => (await h.entries(s.id)).filter((e) => e.kind === 'notice' && /No record of what turn/.test(e.text)).map((e) => e.text);
      await turnThat(h, s.id, () => write(work, 'small.txt', 'fits\n'));
      assert.deepEqual(brief((await changes(h, s.id, '?turn=1')).turns[0].files), [['added', 'small.txt', 1, 0]]);
      const store = h.ctx.harness.checkpoints.storeOf(s.id);
      assert.ok(holds(store, work, 'small.txt'));

      // Too big: nothing of it is stored, the turn is not held up, and the reason is on record.
      await turnThat(h, s.id, () => write(work, 'big.bin', crypto.randomBytes(6000)));
      const two = (await changes(h, s.id, '?turn=2')).turns[0];
      assert.deepEqual([two.files, two.count], [[], 0]);
      assert.equal(two.skipped, 'its new and changed files come to more than 4 KB (OFFICE_CHECKPOINTS_MAX_BYTES); the largest seen is big.bin, 6 KB');
      assert.equal(holds(store, work, 'big.bin'), false, 'the oversized file was never copied');
      assert.equal(await h.entry(s.id, 'turn-2:changes'), null);
      const refused = await h.get(`/api/harness/sessions/${s.id}/diff?turn=2`);
      assert.equal(refused.status, 409);
      assert.match(refused.data.error, /turn 2 has no snapshot of its end: its new and changed files come to more than 4 KB/);
      assert.deepEqual(await notices(), [`No record of what turn 2 changed: ${two.skipped}.`]);

      // It is still there, so the next turn has no record either — but nobody is told twice.
      await turnThat(h, s.id, () => write(work, 'small.txt', 'fits again\n'));
      assert.match((await changes(h, s.id, '?turn=3')).turns[0].skipped, /more than 4 KB/);
      assert.equal((await notices()).length, 1);

      // Once it is gone (or ignored), turns are recorded again: a budget is a pause, not an ending.
      fs.rmSync(path.join(work, 'big.bin'));
      await turnThat(h, s.id, () => write(work, 'small.txt', 'and again\n'));
      assert.deepEqual(brief((await changes(h, s.id, '?turn=4')).turns[0].files), [['modified', 'small.txt', 1, 1]]);

      // Too many: counted before anything is read.
      await turnThat(h, s.id, () => { for (let i = 0; i < 6; i++) write(work, `many/f${i}.txt`, `${i}\n`); });
      const five = (await changes(h, s.id, '?turn=5')).turns[0];
      assert.equal(five.skipped, '6 new or changed files is more than one snapshot takes in (4; OFFICE_CHECKPOINTS_MAX_FILES)');
      assert.equal(holds(store, work, 'many/f0.txt'), false);
      assert.equal((await notices()).length, 2, 'a different reason is worth saying');
      const all = await changes(h, s.id);
      assert.equal(all.off, undefined);
      assert.deepEqual(all.total, { turns: 2, files: 1, additions: 2, deletions: 1 });
    } finally { await h.stop(); }
  });

  await t.test('a folder too big to snapshot at all is not recorded, and its session is told so in one sentence', async () => {
    const many = repo('office-changes-many-');
    for (let i = 0; i < 3; i++) write(many, `extra-${i}.txt`, `${i}\n`);        // 5 committed files and 3 more: 8
    const heavy = repo('office-changes-heavy-');
    write(heavy, 'dataset.bin', crypto.randomBytes(5000));
    const h = await startHarnessOffice({ work: many, env: { OFFICE_CHECKPOINTS_MAX_TREE_FILES: '7', OFFICE_CHECKPOINTS_MAX_TREE_BYTES: '4096' } });
    try {
      for (const [cwd, reason] of [
        [many, 'it has 8 files that are not ignored, and the office takes snapshots of folders with up to 7 (OFFICE_CHECKPOINTS_MAX_TREE_FILES)'],
        [heavy, 'its files that are not ignored come to more than 4 KB, and the office takes snapshots of folders up to that size (OFFICE_CHECKPOINTS_MAX_TREE_BYTES)'],
      ]) {
        const before = everything(path.join(cwd, '.git'));
        const s = await h.start('fake', { name: path.basename(cwd).slice(15, 20), cwd });
        await turnThat(h, s.id, () => write(cwd, 'made.txt', 'the turn runs as ever\n'));
        await quietTurn(h, s.id);
        const got = await changes(h, s.id);
        assert.deepEqual([got.recorded, got.reason, got.turns], [false, reason, []]);
        const told = (await h.entries(s.id)).filter((e) => e.kind === 'notice' && /record/.test(e.text)).map((e) => e.text);
        assert.deepEqual(told, [`What turns change in this folder is not being recorded: ${reason}.`], 'said once, plainly');
        assert.equal((await h.session(s.id)).controls.changes.available, false);
        assert.equal(objectsIn(path.join(h.dir, 'harness', 'checkpoints', repoKey(path.join(cwd, '.git')))), 0, 'and nothing of it was copied');
        await h.del(`/api/harness/sessions/${s.id}`);
        assert.deepEqual(everything(path.join(cwd, '.git')), before);
      }
    } finally { await h.stop(); }
  });
});

test('checkpoints: a slow snapshot does not hold a turn up, and a hopeless one is given up', { skip: !usable }, async (t) => {
  const work = repo('office-changes-slow-');
  const h = await startHarnessOffice({ work, env: { OFFICE_CHECKPOINTS_HOLD_MS: '600', OFFICE_CHECKPOINTS_TIMEOUT_MS: '3000' } });
  t.after(() => { hurry(); return h.stop(); });
  const s = await h.start('fake', { name: 'Hasty' });
  const cps = h.ctx.harness.checkpoints;

  await turnThat(h, s.id, () => write(work, 'quick.txt', 'one\n'));
  assert.deepEqual(brief((await changes(h, s.id, '?turn=1')).turns[0].files), [['added', 'quick.txt', 1, 0]]);

  // Looking over the folder takes 1.5 s this once. The next turn waits 600 ms for its snapshot, then goes
  // without: it runs, and its record says there was no "before" to compare with.
  dawdle('ls-files', 1.5);
  const two = await h.turn(s.id, 'say:went ahead');
  hurry();
  assert.equal(two.turn.state, 'completed');
  assert.equal(two.said, 'went ahead');
  await cps.settled(s.id);
  const skipped = (await changes(h, s.id, '?turn=2')).turns[0];
  assert.match(skipped.skipped, /^the snapshot before it was not ready when the turn began \(it took [\d,]+ ms; a turn waits 600 ms: OFFICE_CHECKPOINTS_HOLD_MS\)$/);
  assert.ok((await h.entries(s.id)).some((e) => e.kind === 'notice' && e.turn === 2 && /No record of what turn 2 changed: the snapshot before it was not ready/.test(e.text)));
  // The slow one did finish, so the next turn is recorded as usual.
  await turnThat(h, s.id, () => write(work, 'quick.txt', 'one\ntwo\n'));
  assert.deepEqual(brief((await changes(h, s.id, '?turn=3')).turns[0].files), [['modified', 'quick.txt', 1, 0]]);
  assert.equal((await changes(h, s.id)).off, undefined);

  // A look that would take 30 s: the snapshot is stopped at 3 s, the program is stopped with it, and the
  // office stops trying for this session rather than paying that at every turn.
  dawdle('ls-files', 30);
  const four = await h.turn(s.id, 'say:not kept waiting');
  assert.equal(four.turn.state, 'completed');
  assert.equal(cps.state(s.id).recording, true, 'the turn was over while the snapshot was still being attempted');
  await cps.settled(s.id);
  hurry();
  const off = await changes(h, s.id);
  assert.equal(off.off, 'a snapshot of this folder took longer than 3,000 ms (OFFICE_CHECKPOINTS_TIMEOUT_MS)');
  assert.equal(off.turns.find((turn) => turn.turn === 4).skipped, off.off);
  assert.ok((await h.entries(s.id)).some((e) => e.kind === 'notice' && e.text === `File changes are no longer being recorded for this session: ${off.off}.`));
  const pid = lastPid();
  await waitFor(() => !alive(pid), { what: 'the git that was looking to be stopped' });
  assert.equal(cps.state(s.id).recording, false);

  // Later turns run as ever and are simply not on record; what was recorded can still be read.
  await turnThat(h, s.id, () => write(work, 'quick.txt', 'three\n'));
  assert.deepEqual((await changes(h, s.id)).turns.map((turn) => turn.turn), [1, 2, 3, 4]);
  assert.equal((await h.session(s.id)).controls.changes.available, true);
  await h.del(`/api/harness/sessions/${s.id}`);
  await cps.settled(s.id);
  assert.deepEqual(fs.readdirSync(path.join(h.dir, 'harness')).filter((name) => name.includes('.index')), [], 'no index and no lock of ours is left behind');

  // The first snapshot of a folder is the one that reads everything. When that cannot be done in time
  // the folder is not recorded at all — and nothing waits for it but the session's own start.
  const other = repo('office-changes-slower-');
  dawdle('add', 30);
  const u = await h.start('fake', { name: 'Unlucky', cwd: other });
  await cps.settled(u.id);
  hurry();
  const reason = 'a first snapshot of it took longer than 3,000 ms (OFFICE_CHECKPOINTS_TIMEOUT_MS)';
  assert.deepEqual([(await changes(h, u.id)).recorded, (await changes(h, u.id)).reason], [false, reason]);
  assert.deepEqual((await h.entries(u.id)).filter((e) => e.kind === 'notice').map((e) => e.text), [`What turns change in this folder is not being recorded: ${reason}.`]);
  assert.equal((await h.turn(u.id, 'say:still works')).said, 'still works');
});

test('checkpoints: a turn stopped, or a session ended, while its snapshot is being taken was never sent', { skip: !usable }, async (t) => {
  const work = repo('office-changes-held-');
  const h = await startHarnessOffice({ work, env: { OFFICE_CHECKPOINTS_HOLD_MS: '8000', OFFICE_CHECKPOINTS_TIMEOUT_MS: '20000' } });
  t.after(() => { hurry(); return h.stop(); });
  const s = await h.start('fake', { name: 'Held' });
  const cps = h.ctx.harness.checkpoints;
  await cps.settled(s.id);

  // The snapshot before turn 1 takes most of a second; the stop arrives while the agent is still being held back.
  dawdle('ls-files', 0.8);
  const n = await h.begin(s.id, 'say:this was never said');
  const stop = await h.post(`/api/harness/sessions/${s.id}/interrupt`);
  assert.equal(stop.data.interrupted, true, 'a turn that has not been sent can be stopped, and that is said honestly');
  const ended = await h.turnDone(s.id, n);
  hurry();
  assert.deepEqual([ended.state, ended.stoppedBy], ['interrupted', 'Lead']);
  assert.equal((await h.turnView(s.id, n)).said, '');
  assert.equal((await h.session(s.id)).state, 'idle');
  // The agent confirms it: the only prompt it has ever received is the one asking.
  assert.equal(JSON.parse((await h.turn(s.id, 'report')).said).prompts, 1);
  await cps.settled(s.id);
  assert.deepEqual((await changes(h, s.id)).turns.map((turn) => [turn.turn, turn.count, turn.skipped]), [[1, 0, undefined], [2, 0, undefined]]);

  // The same moment, but the whole session is ended: the turn is closed, nothing is left waiting or running.
  dawdle('ls-files', 0.8);
  const m = await h.begin(s.id, 'say:nor this');
  const gone = await h.del(`/api/harness/sessions/${s.id}`);
  assert.equal(gone.data.session.state, 'ended');
  assert.equal((await h.turnDone(s.id, m)).state, 'interrupted');
  await cps.settled(s.id);
  hurry();
  assert.equal((await changes(h, s.id, `?turn=${m}`)).turns[0].count, 0);
  assert.equal(cps.state(s.id), null, 'the office is done with this session\'s snapshots');
});

test('checkpoints: sessions and the folders they are in', { skip: !usable }, async (t) => {
  const work = repo('office-changes-shared-');
  const h = await startHarnessOffice({ work });
  t.after(() => h.stop());
  const cps = h.ctx.harness.checkpoints;

  await t.test('two sessions in one repository keep their own record', async () => {
    const a = await h.start('fake', { name: 'Ada' }), b = await h.start('fake', { name: 'Bob' });
    await turnThat(h, a.id, () => write(work, 'from-ada.txt', 'ada\n'));
    await turnThat(h, b.id, () => write(work, 'from-bob.txt', 'bob\n'));
    assert.deepEqual(brief((await changes(h, a.id)).turns[0].files), [['added', 'from-ada.txt', 1, 0]]);
    assert.deepEqual(brief((await changes(h, b.id)).turns[0].files), [['added', 'from-bob.txt', 1, 0]], 'what Ada did before Bob\'s turn is not Bob\'s');
    assert.equal(cps.storeOf(a.id), cps.storeOf(b.id), 'the objects are shared; the record of each is its own');
    assert.ok(fs.existsSync(path.join(h.dir, 'harness', `${a.id}.index`)) && fs.existsSync(path.join(h.dir, 'harness', `${b.id}.index`)), 'and so is its index');

    // Two turns at once in one checkout: a snapshot says what changed while a turn ran, not who did it.
    const na = await h.begin(a.id, 'ask:first'), cardA = await h.need(a.id);
    const nb = await h.begin(b.id, 'ask:second'), cardB = await h.need(b.id);
    write(work, 'shared.txt', 'written while both were at work\n');
    await Promise.all([h.answer(cardA.id, { action: 'once' }), h.answer(cardB.id, { action: 'once' })]);
    await Promise.all([h.turnDone(a.id, na), h.turnDone(b.id, nb)]);
    assert.deepEqual(brief((await changes(h, a.id, `?turn=${na}`)).turns[0].files), [['added', 'shared.txt', 1, 0]]);
    assert.deepEqual(brief((await changes(h, b.id, `?turn=${nb}`)).turns[0].files), [['added', 'shared.txt', 1, 0]]);

    // One session's record going away takes nothing of the other's.
    assert.equal(await cps.forget(a.id), true);
    assert.equal((await changes(h, a.id)).recorded, false);
    assert.equal((await changes(h, b.id)).turns.length, 2);
    assert.match((await diffOf(h, b.id, `turn=${nb}`)).diff, /\+written while both were at work/);
    assert.match((await diffOf(h, b.id, 'turn=1')).diff, /\+bob/);
    await h.del(`/api/harness/sessions/${a.id}`);
    await h.del(`/api/harness/sessions/${b.id}`);
  });

  await t.test('a session in a subfolder is recorded with its whole checkout', async () => {
    const s = await h.start('fake', { name: 'Deep', cwd: path.join(work, 'src') });
    await turnThat(h, s.id, () => { write(work, 'src/a.js', 'export const a = "deep";\n'); write(work, 'README.md', '# demo\n\nedited from below\n'); });
    const got = await changes(h, s.id);
    assert.equal(got.root, work);
    assert.deepEqual(brief(got.turns[0].files), [['modified', 'README.md', 2, 0], ['modified', 'src/a.js', 1, 3]]);
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('a folder that is not in a repository has no snapshots, and says so once', async () => {
    const plain = fs.realpathSync(tempDir('office-changes-plain-'));
    const s = await h.start('fake', { name: 'Plain', cwd: plain });
    await cps.settled(s.id);
    write(plain, 'a.txt', 'x\n');
    await quietTurn(h, s.id);
    await quietTurn(h, s.id);
    const now = await h.session(s.id);
    assert.equal(now.controls.changes.available, false);
    assert.equal(now.controls.diff.available, false);
    const got = await changes(h, s.id);
    assert.deepEqual([got.recorded, got.turns, got.total], [false, [], { turns: 0, files: 0, additions: 0, deletions: 0 }]);
    assert.match(got.reason, /^\S*office-changes-plain-\S+ is not inside a git repository$/);
    const told = (await h.entries(s.id)).filter((e) => e.kind === 'notice' && /not being recorded/.test(e.text));
    assert.deepEqual(told.map((e) => e.text), [`What turns change in this folder is not being recorded: ${got.reason}.`]);
    const none = await h.get(`/api/harness/sessions/${s.id}/diff?turn=1`);
    assert.equal(none.status, 404);
    assert.match(none.data.error, /no record of what this session's turns changed: .* is not inside a git repository/);
    assert.equal(fs.existsSync(path.join(plain, '.git')), false);
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('nor has a folder its repository ignores: git never looks into it', async () => {
    fs.mkdirSync(path.join(work, 'ignored', 'scratch'), { recursive: true });
    const s = await h.start('fake', { name: 'Hidden', cwd: path.join(work, 'ignored', 'scratch') });
    await cps.settled(s.id);
    const got = await changes(h, s.id);
    assert.equal(got.recorded, false);
    assert.equal(got.reason, 'this folder is ignored by the git repository it is in, so git does not look at it');
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('the office\'s own files are no part of a snapshot, also when it keeps them inside the folder', async () => {
    // An office whose data directory is in the repository its agents work in, and is not ignored there:
    // its transcripts and journals change with every turn, and the snapshots themselves are stored in it.
    const housed = repo('office-changes-inside-');
    const before = everything(path.join(housed, '.git'));
    const data = path.join(housed, 'office-data');
    fs.mkdirSync(data);
    const inside = await startHarnessOffice({ dir: data, work: housed });
    try {
      const s = await inside.start('fake', { name: 'Housed' });
      const quiet = await quietTurn(inside, s.id);
      const store = inside.ctx.harness.checkpoints.storeOf(s.id);
      assert.equal(path.dirname(store), path.join(data, 'harness', 'checkpoints'));
      const had = objectsIn(store);
      const n = await turnThat(inside, s.id, () => write(housed, 'src/b.js', 'export const b = 1;\n'));
      const again = await quietTurn(inside, s.id);
      const got = await changes(inside, s.id);
      assert.deepEqual(got.turns.map((turn) => [turn.turn, brief(turn.files)]), [[quiet, []], [n, [['added', 'src/b.js', 1, 0]]], [again, []]],
        'a turn\'s changes are the agent\'s folder\'s, not the office\'s bookkeeping');
      assert.ok(fs.statSync(path.join(data, 'harness', `${s.id}.index`)).size > 0, 'which was written there all the while: this session\'s index, for one');
      // The copy does not feed on itself: three objects for the one new file (the file, its folder, the top), none for the office's own.
      assert.equal(objectsIn(store), had + 3);
      assert.doesNotMatch(inStore(store, 'ls-tree', '-r', '--name-only', got.turns[1].trees.end), /office-data/);
      // (What git itself makes of that folder is its owner's business. Asked without `git status`, which rewrites the index.)
      assert.match(git(housed, 'ls-files', '--others', '--exclude-standard', '--directory'), /^office-data\/$/m);
    } finally { await inside.stop(); }
    assert.deepEqual(everything(path.join(housed, '.git')), before);

    // And a checkout that *is* the office's data directory is not recorded: every file in it is the office's own.
    const kept = fs.realpathSync(tempDir('office-changes-own-'));
    git(kept, 'init', '-q', '-b', 'main');
    const own = await startHarnessOffice({ dir: kept, work: kept });
    try {
      const s = await own.start('fake', { name: 'At home' });
      await own.ctx.harness.checkpoints.settled(s.id);
      await quietTurn(own, s.id);
      const got = await changes(own, s.id);
      assert.deepEqual([got.recorded, got.reason], [false, 'it is where the office keeps its own files']);
      const told = (await own.entries(s.id)).filter((e) => e.kind === 'notice' && /not being recorded/.test(e.text));
      assert.deepEqual(told.map((e) => e.text), ['What turns change in this folder is not being recorded: it is where the office keeps its own files.']);
      assert.equal(fs.existsSync(path.join(kept, 'harness', 'checkpoints')), false);
    } finally { await own.stop(); }
  });

  await t.test('a file that is committed and also ignored is still followed', async () => {
    const own = repo('office-changes-forced-');
    write(own, 'ignored/kept.txt', 'added with -f\n');
    git(own, 'add', '-f', 'ignored/kept.txt');
    git(own, 'commit', '-q', '-m', 'one ignored file, committed all the same');
    write(own, 'ignored/never.txt', 'ignored and never added\n');
    const s = await h.start('fake', { name: 'Forced', cwd: own });
    await turnThat(h, s.id, () => { write(own, 'ignored/kept.txt', 'changed by a turn\n'); write(own, 'ignored/never.txt', 'changed too, and nobody is told\n'); });
    assert.deepEqual(brief((await changes(h, s.id)).turns[0].files), [['modified', 'ignored/kept.txt', 1, 1]]);
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('a repository with no commit yet, and a commit made during a turn', async () => {
    const fresh = fs.realpathSync(tempDir('office-changes-unborn-'));
    git(fresh, 'init', '-q', '-b', 'main');
    const s = await h.start('fake', { name: 'Early', cwd: fresh });
    await turnThat(h, s.id, () => { write(fresh, 'first.txt', 'hello\n'); write(fresh, 'lib/second.txt', 'a\nb\n'); });
    const one = (await changes(h, s.id, '?turn=1')).turns[0];
    assert.deepEqual(brief(one.files), [['added', 'first.txt', 1, 0], ['added', 'lib/second.txt', 2, 0]]);
    assert.equal(one.head, undefined);
    // The files are the same before and after a commit; what moved is HEAD, and that is said beside the changes.
    await turnThat(h, s.id, () => { write(fresh, 'third.txt', 'new\n'); git(fresh, 'add', '.'); git(fresh, 'commit', '-q', '-m', 'by the agent'); });
    const two = (await changes(h, s.id, '?turn=2')).turns[0];
    assert.deepEqual(brief(two.files), [['added', 'third.txt', 1, 0]]);
    assert.deepEqual(two.head, { from: null, to: git(fresh, 'rev-parse', 'HEAD').trim() });
    await h.del(`/api/harness/sessions/${s.id}`);
  });

  await t.test('a turn cut short by its agent dying is still on record', async () => {
    const own = repo('office-changes-crash-');
    const s = await h.start('fake', { name: 'Brittle', cwd: own });
    const n = await h.begin(s.id, 'ask:go on; crash:3');
    const card = await h.need(s.id);
    write(own, 'half-done.txt', 'written before the crash\n');
    await h.answer(card.id, { action: 'once' });
    assert.equal((await h.turnDone(s.id, n)).state, 'failed');
    await waitFor(async () => !(await h.session(s.id)).live, { what: 'the session to end' });
    await cps.settled(s.id);
    assert.deepEqual(brief((await changes(h, s.id)).turns[0].files), [['added', 'half-done.txt', 1, 0]]);
    // The entry was written after the session closed its transcript, and reached the file all the same.
    const onDisk = await waitFor(() => { const text = fs.readFileSync(path.join(h.dir, 'harness', `${s.id}.jsonl`), 'utf8'); return text.includes('"kind":"changes"') ? text : ''; },
      { what: 'the changes entry on disk' });
    const entry = onDisk.trim().split('\n').map((row) => JSON.parse(row)).find((e) => e.kind === 'changes');
    assert.deepEqual([entry.id, entry.turn, entry.files], ['turn-1:changes', 1, [{ path: 'half-done.txt', status: 'added', additions: 1, deletions: 0 }]]);
  });

  await t.test('a repository inside the folder is left out, whole — git is never given a reason to look inside it', async () => {
    const own = repo('office-changes-nested-');
    const inner = path.join(own, 'vendor', 'lib');
    fs.mkdirSync(inner, { recursive: true });
    git(inner, 'init', '-q', '-b', 'main');
    write(inner, 'x.txt', 'inner\n');
    git(inner, 'add', '.');
    git(inner, 'commit', '-q', '-m', 'inner');
    fs.mkdirSync(path.join(own, 'vendor', 'empty'), { recursive: true });
    git(path.join(own, 'vendor', 'empty'), 'init', '-q');               // one with no commit at all: `git add` refuses those outright
    const innerBefore = everything(path.join(inner, '.git'));
    const s = await h.start('fake', { name: 'Nested', cwd: own });
    await turnThat(h, s.id, () => { write(own, 'beside.txt', 'still seen\n'); write(inner, 'x.txt', 'changed inside\n'); write(inner, 'more.txt', 'new inside\n'); });
    // …and one that appears while the session is running.
    const late = path.join(own, 'later');
    await turnThat(h, s.id, () => { fs.mkdirSync(late); git(late, 'init', '-q', '-b', 'main'); write(late, 'y.txt', 'y\n'); git(late, 'add', '.'); git(late, 'commit', '-q', '-m', 'later'); write(own, 'beside.txt', 'seen again\n'); });
    const got = await changes(h, s.id);
    assert.deepEqual(got.turns.map((turn) => [brief(turn.files), turn.partial]), [[[['added', 'beside.txt', 1, 0]], undefined], [[['modified', 'beside.txt', 1, 1]], undefined]]);
    assert.deepEqual(inStore(got.store, 'ls-tree', '-r', '--name-only', got.turns[1].trees.end).split('\n').filter(Boolean),
      ['.gitignore', 'README.md', 'beside.txt', 'gone.txt', 'old-name.txt', 'src/a.js']);
    assert.deepEqual(everything(path.join(inner, '.git')), innerBefore);
    await h.del(`/api/harness/sessions/${s.id}`);
  });
});

test('checkpoints: file names are names, never options and never patterns', { skip: !usable }, async (t) => {
  const work = repo('office-changes-names-');
  const h = await startHarnessOffice({ work });
  t.after(() => h.stop());
  const s = await h.start('fake', { name: 'Odd' });
  const at = `/api/harness/sessions/${s.id}`;
  const ODD = ['-rf', '--help', '--output=x', '-C', 'dir with space/ünïcödé ✓.txt', '-dash dir/--force', 'new\nline.txt', 'tab\there.txt',
    'quote"s and \'s.txt', 'star*.txt', 'starfish.txt', ':(top)magic.txt', ':(exclude)x', 'brace{a,b}.txt', 'semi; rm -rf x.txt', '$(touch pwned).txt',
    'back`touch pwned`tick.txt', 'HEAD', 'refs/heads/main', 'question?.txt', 'questionX.txt', '[abc].txt', 'a.txt', '日本語/ファイル.txt', '@{upstream}', '~user', '..rc'];

  const n = await turnThat(h, s.id, () => ODD.forEach((name, i) => write(work, name, `content of #${i}\n`)));
  const one = (await changes(h, s.id, `?turn=${n}`)).turns[0];
  assert.deepEqual(one.files.map((f) => f.path).sort(), [...ODD].sort(), 'every name comes back exactly as it is on disk');
  assert.ok(one.files.every((f) => f.status === 'added' && f.additions === 1));
  assert.equal(one.count, ODD.length);

  // Asked for one at a time, each name yields its own file's diff and nothing else: "star*.txt" is not also
  // starfish.txt, "[abc].txt" is not a.txt, "-rf" and "--help" are not instructions to git.
  for (const [i, name] of ODD.entries()) {
    const res = await h.get(`${at}/diff?turn=${n}&path=${encodeURIComponent(name)}`);
    assert.equal(res.status, 200, JSON.stringify(name));
    assert.equal(res.data.path, name);
    assert.equal(res.data.diff.split('\n').filter((l) => l.startsWith('diff --git ')).length, 1, JSON.stringify(name));
    assert.ok(res.data.diff.includes(`\n+content of #${i}\n`), JSON.stringify(name));
  }
  assert.equal((await diffOf(h, s.id, `turn=${n}&path=${encodeURIComponent('*')}`)).diff, '', 'a star is a file called star, and there is none');
  assert.equal((await diffOf(h, s.id, `turn=${n}&path=${encodeURIComponent('--stat')}`)).diff, '');
  assert.equal(fs.existsSync(path.join(work, 'pwned')), false);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'pwned')), false, 'no shell ever saw a name');

  // The transcript lists the first twenty and counts the rest.
  const entry = await waitFor(() => h.entry(s.id, `turn-${n}:changes`), { what: 'the changes entry' });
  assert.deepEqual([entry.files.length, entry.more], [20, ODD.length - 20]);

  // A rename and a deletion among them.
  const m = await turnThat(h, s.id, () => { fs.renameSync(path.join(work, '-rf'), path.join(work, '--rm -rf')); fs.rmSync(path.join(work, '--help')); });
  const two = (await changes(h, s.id, `?turn=${m}`)).turns[0];
  assert.deepEqual(two.files, [
    { path: '--help', status: 'deleted', additions: 0, deletions: 1, binary: false },
    { path: '--rm -rf', status: 'renamed', from: '-rf', additions: 0, deletions: 0, binary: false },
  ]);
  assert.match((await diffOf(h, s.id, `turn=${m}&path=${encodeURIComponent('--rm -rf')}`)).diff, /^diff --git a\/-rf b\/--rm -rf\nsimilarity index 100%\nrename from -rf\nrename to --rm -rf\n$/);
  assert.match((await diffOf(h, s.id, `turn=${m}&path=${encodeURIComponent('--help')}`)).diff, /^diff --git a\/--help b\/--help\ndeleted file mode 100644\n/);

  // A folder that is a repository of its own, with a name like an instruction: left out by name, literally.
  const m2 = await turnThat(h, s.id, () => {
    for (const name of [':(exclude)*', '--all']) { const inner = path.join(work, name); fs.mkdirSync(inner); git(inner, 'init', '-q'); write(inner, 'in.txt', 'in\n'); }
    write(work, 'after.txt', 'still everything else\n');
  });
  assert.deepEqual(brief((await changes(h, s.id, `?turn=${m2}`)).turns[0].files), [['added', 'after.txt', 1, 0]]);
});

test('checkpoints: how much is kept, for how long, and what a restart leaves', { skip: !usable }, async (t) => {
  await t.test('a cap on the turns kept per session; a long diff and a long list are cut and say so', async () => {
    const work = repo('office-changes-cap-');
    const h = await startHarnessOffice({ work, env: { OFFICE_CHECKPOINTS_MAX_TURNS: '2', OFFICE_CHECKPOINTS_DIFF_BYTES: '2000' } });
    try {
      const s = await h.start('fake', { name: 'Brief' });
      const at = `/api/harness/sessions/${s.id}`;
      for (const text of ['one\n', 'two\n', 'three\n']) await turnThat(h, s.id, () => write(work, 'count.txt', text));
      const kept = await changes(h, s.id);
      assert.deepEqual([kept.keeps, kept.turns.map((turn) => turn.turn)], [2, [2, 3]]);
      assert.equal((await h.get(`${at}/changes?turn=1`)).status, 404);
      assert.match((await h.get(`${at}/diff?from=1&to=3`)).data.error, /no record of turn 1 \(the last 2 turns of a session are kept\)/);
      assert.equal(JSON.parse(fs.readFileSync(path.join(h.dir, 'checkpoints.json'), 'utf8')).sessions[s.id].turns.length, 2, 'nor is it kept on disk');

      // A diff longer than one answer carries is cut at a line, and says it was cut.
      await turnThat(h, s.id, () => write(work, 'long.txt', Array.from({ length: 300 }, (_, i) => `line number ${i}`).join('\n') + '\n'));
      const cut = await diffOf(h, s.id, 'turn=4');
      assert.equal(cut.truncated, true);
      assert.ok(Buffer.byteLength(cut.diff) <= 2000 && cut.diff.length > 1500);
      assert.match(cut.diff, /^diff --git a\/long\.txt b\/long\.txt\nnew file mode 100644\n/);
      assert.match(cut.diff, /\n\+line number \d+\n$/, 'it ends on a whole line');
      assert.equal((await diffOf(h, s.id, 'turn=3')).truncated, false);

      // More files than one answer lists: the list is cut, the counts are not.
      await turnThat(h, s.id, () => { for (let i = 0; i < 520; i++) write(work, `bulk/f${String(i).padStart(3, '0')}.txt`, `${i}\n`); });
      const bulk = (await changes(h, s.id, '?turn=5')).turns[0];
      assert.deepEqual([bulk.files.length, bulk.count, bulk.additions, bulk.truncated], [500, 520, 520, true]);
      assert.equal((await changes(h, s.id, '?turn=5')).total.files, 520);
      const entry = await waitFor(() => h.entry(s.id, 'turn-5:changes'), { what: 'the changes entry' });
      assert.deepEqual([entry.files.length, entry.more, entry.additions], [20, 500, 520]);
    } finally { await h.stop(); }
  });

  await t.test('a finished session can still be asked, also after a restart — until its record is pruned, and then the office\'s files go too', async () => {
    const work = repo('office-changes-kept-');
    const gitBefore = everything(path.join(work, '.git'));
    const dir = tempDir('office-changes-data-');
    const first = await startHarnessOffice({ dir, work });
    const s = await first.start('fake', { name: 'Lasting' });
    await turnThat(first, s.id, () => write(work, 'kept.txt', 'for later\n'));
    await quietTurn(first, s.id);
    const store = first.ctx.harness.checkpoints.storeOf(s.id);
    await first.stop();
    assert.deepEqual(fs.readdirSync(path.join(dir, 'harness')).filter((name) => name.includes('.index')), []);
    assert.ok(objectsIn(store) > 0);

    const at = `/api/harness/sessions/${s.id}`;
    const second = await startHarnessOffice({ dir, work });
    try {
      const listed = (await second.get('/api/harness/sessions?all=1')).data.sessions.find((x) => x.id === s.id);
      assert.equal(listed.state, 'ended');
      assert.deepEqual(listed.controls.changes, { method: 'GET', url: `${at}/changes`, query: ['turn'], available: true });
      assert.deepEqual(listed.controls.diff, { method: 'GET', url: `${at}/diff`, query: ['turn', 'path', 'from', 'to', 'context'], available: true });
      const cold = await changes(second, s.id);
      assert.deepEqual(cold.turns.map((turn) => [turn.turn, brief(turn.files)]), [[1, [['added', 'kept.txt', 1, 0]]], [2, []]]);
      assert.match((await diffOf(second, s.id, 'turn=1')).diff, /\+for later\n$/);
      const entry = (await second.get(`${at}/transcript`)).data.entries.find((e) => e.kind === 'changes');
      assert.deepEqual([entry.id, entry.files.length], ['turn-1:changes', 1]);
    } finally { await second.stop(); }

    // Should the office's own files be lost, a turn says its snapshots cannot be read. It does not fail, and the rest is still told.
    const aside = `${store}.aside`;
    fs.renameSync(store, aside);
    const blind = await startHarnessOffice({ dir, work });
    try {
      const lost = await changes(blind, s.id);
      assert.deepEqual(lost.turns.map((turn) => [turn.turn, turn.count]), [[1, 0], [2, 0]]);
      assert.match(lost.turns[0].skipped, /^its snapshots can no longer be read \(/);
      assert.equal(lost.turns[1].skipped, undefined, 'a turn that changed nothing needs nothing read to say so');
      assert.deepEqual(lost.stored, { bytes: 0, objects: 0 }, 'and nothing is what the office now keeps for it');
      const gone = await blind.get(`${at}/diff?turn=1`);
      assert.equal(gone.status, 410);
      assert.match(gone.data.error, /^the snapshots of turn 1 can no longer be read \(/);
    } finally { await blind.stop(); }
    fs.renameSync(aside, store);

    // 120 sessions finish after it: the office forgets it, transcript and all — and removes its snapshots, which are files of the office's own.
    const book = JSON.parse(fs.readFileSync(path.join(dir, 'harness.json'), 'utf8'));
    for (let i = 1; i <= 120; i++) {
      const id = `d_${String(i).padStart(12, '0')}`;
      book.sessions[id] = { id, adapter: 'fake', label: 'Fake Agent', provider: 'gemini', protocol: 'acp/1', cwd: dir, name: `Later ${i}`,
        mode: 'ask', wake: 'off', state: 'ended', startedAt: Date.now() + i, endedAt: Date.now() + 1000 + i, turns: 1 };
    }
    fs.writeFileSync(path.join(dir, 'harness.json'), JSON.stringify(book));
    const third = await startHarnessOffice({ dir, work });
    try {
      assert.ok(fs.existsSync(store), 'still listed, so still kept');
      const extra = await third.start('fake', { cwd: dir });
      await third.del(`/api/harness/sessions/${extra.id}`);
      await waitFor(() => !fs.existsSync(store), { what: 'the pruned session\'s object directory to be removed' });
      assert.equal((await third.get(`${at}/changes`)).status, 404);
      await waitFor(() => !JSON.parse(fs.readFileSync(path.join(dir, 'checkpoints.json'), 'utf8')).sessions[s.id], { what: 'its record to be dropped' });
    } finally { await third.stop(); }
    assert.deepEqual(everything(path.join(work, '.git')), gitBefore, 'three offices and a pruning later, the repository has not been written to once');
  });

  await t.test('what is left of a session the office no longer knows is cleaned away when it starts', async () => {
    const work = repo('office-changes-orphan-');
    const dir = tempDir('office-changes-data-');
    const first = await startHarnessOffice({ dir, work });
    const s = await first.start('fake', { name: 'Orphan' });
    await turnThat(first, s.id, () => write(work, 'left.txt', 'behind\n'));
    const store = first.ctx.harness.checkpoints.storeOf(s.id);
    await first.stop();
    assert.ok(fs.existsSync(store));
    const book = JSON.parse(fs.readFileSync(path.join(dir, 'harness.json'), 'utf8'));
    delete book.sessions[s.id];
    fs.writeFileSync(path.join(dir, 'harness.json'), JSON.stringify(book));
    fs.writeFileSync(path.join(dir, 'harness', 'd_0123456789ab.index'), 'left by a daemon that was killed');
    const second = await startHarnessOffice({ dir, work });
    try {
      await waitFor(() => !fs.existsSync(store), { what: 'the orphaned object directory to be removed' });
      assert.equal(fs.existsSync(path.join(dir, 'harness', 'd_0123456789ab.index')), false);
      await waitFor(() => !JSON.parse(fs.readFileSync(path.join(dir, 'checkpoints.json'), 'utf8')).sessions[s.id], { what: 'its record to be dropped' });
    } finally { await second.stop(); }
  });

  await t.test('when what the office keeps for a repository becomes a lot, the session whose snapshot made it so is told — once, in a sentence', async () => {
    const work = repo('office-changes-told-');
    const dir = tempDir('office-changes-data-');
    const limit = 256 * 1024;
    const env = { OFFICE_CHECKPOINTS_NOTICE_BYTES: String(limit) };
    const told = async (h, id) => (await h.entries(id)).filter((e) => e.kind === 'notice' && /keeps its own copy/.test(e.text));
    const h = await startHarnessOffice({ dir, work, env });
    let kept;
    try {
      const s = await h.start('fake', { name: 'First' });
      await quietTurn(h, s.id);
      const small = (await changes(h, s.id)).stored;
      assert.ok(small.bytes > 0 && small.bytes < limit);
      assert.deepEqual(await told(h, s.id), [], 'a few small files are not worth a word');

      // A turn leaves 600 KB that do not shrink. The office's copy of them is on the owner's disk: it says so.
      await turnThat(h, s.id, () => write(work, 'data.bin', crypto.randomBytes(600 * 1024)));
      const [notice] = await waitFor(async () => { const all = await told(h, s.id); return all.length ? all : null; }, { what: 'the notice' });
      const got = await changes(h, s.id);
      assert.match(notice.text, /^To tell what turns change, the office keeps its own copy of this folder's files: \d+ KB so far, in \S+\/harness\/checkpoints\/[a-f0-9]{16}\.$/);
      assert.ok(notice.text.endsWith(` in ${got.store}.`), 'where it says is where it is');
      assert.deepEqual(got.stored, { bytes: weightOf(got.store), objects: objectsIn(got.store) });
      assert.ok(got.stored.bytes > 600 * 1024);
      assert.equal(notice.text.match(/: (\d+) KB so far/)[1], String(Math.round(got.stored.bytes / 1024)), 'and how much it says is how much there is');

      // More comes, from this session and from a second one in the same repository: it has been said.
      await turnThat(h, s.id, () => write(work, 'more.bin', crypto.randomBytes(300 * 1024)));
      const again = await h.start('fake', { name: 'Second' });
      await turnThat(h, again.id, () => write(work, 'yet-more.bin', crypto.randomBytes(300 * 1024)));
      await sleep(200);
      assert.equal((await told(h, s.id)).length, 1);
      assert.deepEqual(await told(h, again.id), []);
      kept = (await changes(h, again.id)).stored;
      assert.deepEqual(kept, { bytes: weightOf(got.store), objects: objectsIn(got.store) }, 'the count follows what is stored');
      assert.ok(kept.bytes >= got.stored.bytes + 600 * 1024);
      assert.deepEqual((await changes(h, s.id)).stored, kept, 'one repository, one copy: every session in it is given the same count');
    } finally { await h.stop(); }

    // Once for as long as an office runs. The next one says it again, to the first session whose snapshot adds to it.
    const next = await startHarnessOffice({ dir, work, env });
    try {
      const s = await next.start('fake', { name: 'Third' });
      const [notice] = await waitFor(async () => { const all = await told(next, s.id); return all.length ? all : null; }, { what: 'the notice of the next office' });
      const now = (await changes(next, s.id)).stored;
      assert.ok(now.bytes >= kept.bytes);
      assert.ok(notice.text.includes(`: ${(now.bytes / (1024 * 1024)).toFixed(1)} MB so far, in `), notice.text);
    } finally { await next.stop(); }
  });

  await t.test('switched off, nothing is looked at and nothing is kept', async () => {
    const work = repo('office-changes-off-');
    const before = everything(path.join(work, '.git'));
    // As every other suite starts an office: test/helpers.mjs says OFFICE_CHECKPOINTS=0, so that a test which
    // names no folder cannot have this checkout copied.
    const h = await startOffice({ work });
    try {
      assert.equal(h.cfg.harness.checkpoints.enabled, false);
      const s = await h.start('fake', { name: 'Unwatched' });
      await turnThat(h, s.id, () => write(work, 'unseen.txt', 'x\n'));
      const got = await changes(h, s.id);
      assert.deepEqual([got.recorded, got.reason], [false, 'this office is not recording what turns change (it was started with OFFICE_CHECKPOINTS=0 or OFFICE_GIT=0)']);
      assert.equal((await h.session(s.id)).controls.changes.available, false);
      assert.ok(!(await h.entries(s.id)).some((e) => e.kind === 'notice' && /record/.test(e.text)), 'how the office was started is not news to every session');
      assert.equal(fs.existsSync(path.join(h.dir, 'harness', 'checkpoints')), false);
      assert.equal(fs.existsSync(path.join(h.dir, 'harness', `${s.id}.index`)), false);
      assert.equal((await h.get('/api/harness')).data.limits.checkpoints.enabled, false);
      await h.del(`/api/harness/sessions/${s.id}`);
    } finally { await h.stop(); }
    assert.deepEqual(everything(path.join(work, '.git')), before);
  });
});

test('checkpoints: from another machine neither the list of changes nor a diff is given out', { skip: !usable }, async (t) => {
  const outside = Object.values(os.networkInterfaces()).flat().find((a) => a && a.family === 'IPv4' && !a.internal)?.address;
  if (!outside) { t.skip('this machine has no address other than loopback'); return; }
  const token = 'test-office-token-0123456789';
  const far = (o) => async (p) => {
    const res = await fetch(`http://${outside}:${o.port}${p}`, { headers: { authorization: `Bearer ${token}` } });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  const work = repo('office-changes-far-');
  const o = await startHarnessOffice({ work, env: { OFFICE_HOST: '0.0.0.0', OFFICE_TOKEN: token } });
  try {
    try { await fetch(`http://${outside}:${o.port}/api/health`, { signal: AbortSignal.timeout(1500) }); }
    catch { t.skip(`cannot reach ${outside} from here`); return; }
    const s = await o.start('fake', { name: 'Local' });
    await turnThat(o, s.id, () => write(work, 'private.txt', 'not for the network\n'));
    const at = `/api/harness/sessions/${s.id}`;
    const get = far(o);
    // Someone let into the office sees that the session exists and where its changes would be read…
    const seen = await get(at);
    assert.equal(seen.status, 200);
    assert.equal(seen.data.session.controls.changes.url, `${at}/changes`);
    // …but file names and file content are for this machine only, like the transcript.
    for (const p of [`${at}/changes`, `${at}/changes?turn=1`, `${at}/diff?turn=1`, `${at}/diff?turn=1&path=private.txt`, `${at}/transcript`]) {
      const res = await get(p);
      assert.equal(res.status, 403, p);
      assert.ok(!JSON.stringify(res.data).includes('private'), p);
    }
    assert.equal((await fetch(`http://${outside}:${o.port}${at}/changes`)).status, 401, 'and without the office token there is no office at all');
    assert.equal((await o.get(`${at}/changes`)).data.turns[0].files[0].path, 'private.txt', 'on this machine it is there to read');
  } finally { await o.stop(); }

  // The operator can open terminals and transcripts to token holders; these follow the same one switch.
  const opened = await startHarnessOffice({ work, env: { OFFICE_HOST: '0.0.0.0', OFFICE_TOKEN: token, OFFICE_REMOTE_TERMINALS: '1' } });
  try {
    const s = await opened.start('fake', { name: 'Shared' });
    await turnThat(opened, s.id, () => write(work, 'private.txt', 'shared on purpose\n'));
    const res = await far(opened)(`/api/harness/sessions/${s.id}/diff?turn=1`);
    assert.equal(res.status, 200);
    assert.match(res.data.diff, /\+shared on purpose/);
  } finally { await opened.stop(); }
});

test('checkpoints: none of this was about the checkout the tests are run from', {
  skip: !usable || (hereBefore === null && 'the project is not in a git repository here (an archive, an export): there is no checkout this could have been about'),
}, () => {
  // Every repository above was a temporary one. This one — where a session that names no folder would be
  // working — has the same refs under the office's name as before the suite began: none that this suite made.
  assert.equal(refsHere(), hereBefore);
});
