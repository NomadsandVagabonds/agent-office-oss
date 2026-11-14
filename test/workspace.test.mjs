// Who is working where: real git repositories in a temp folder, agents that
// say which files they touch, and the office noticing before they collide.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { startOffice, tempDir } from './helpers.mjs';
import { claimMatcher, filesFromTool } from '../server/workspace.mjs';
import { parseStatus, safeRefName } from '../server/git.mjs';

const hasGit = spawnSync('git', ['--version']).status === 0;
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.com' } });
function repo() {
  const dir = fs.realpathSync(tempDir('office-repo-'));
  git(dir, 'init', '-q', '-b', 'main');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\n');
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\n');
  git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'first');
  return dir;
}
const join = async (office, name, cwd) => (await office.post('/api/agents/join', { provider: 'claude', name, cwd })).data.agent.id;
const edit = (office, id, cwd, file, tool = 'Edit') => office.hook({ session_id: id, hook_event_name: 'PreToolUse', cwd, tool_name: tool, tool_input: { file_path: file } });
const inbox = async (office, id) => (await office.get(`/api/inbox?agent=${id}&ack=1`)).data.items.map((m) => `${m.from}: ${m.text}`);

test('workspace: which files a tool call is about, and what a claim covers', () => {
  assert.deepEqual(filesFromTool('Edit', { file_path: '/r/a.js', old_string: 'x' }), [{ path: '/r/a.js', kind: 'edit' }]);
  assert.deepEqual(filesFromTool('Read', { file_path: 'docs/x.md' }), [{ path: 'docs/x.md', kind: 'read' }]);
  assert.deepEqual(filesFromTool('NotebookEdit', { notebook_path: '/r/n.ipynb' }), [{ path: '/r/n.ipynb', kind: 'edit' }]);
  assert.deepEqual(filesFromTool('write_file', { filePath: 'b.txt' }), [{ path: 'b.txt', kind: 'edit' }]);
  assert.deepEqual(filesFromTool('apply_patch', { input: '*** Begin Patch\n*** Update File: src/a.js\n@@\n*** Add File: src/new.js\n*** End Patch' }).map((f) => f.path), ['src/a.js', 'src/new.js']);
  for (const [tool, input] of [['Bash', { command: 'cat a.js' }], ['TodoWrite', { todos: [] }], ['TaskCreate', { subject: 'x' }], ['Grep', { pattern: 'x', path: 'src' }], ['Edit', null]]) {
    assert.deepEqual(filesFromTool(tool, input), [], `${tool} names no file being touched`);
  }
  const m = claimMatcher('server/world');
  assert.ok(m('server/world') && m('server/world/text.mjs') && !m('server/worldly.mjs'));
  assert.ok(claimMatcher('src/**')('src/a/b.js') && claimMatcher('*.md')('README.md') && !claimMatcher('*.md')('docs/x.md'));
  assert.ok(claimMatcher('src/**/x.js')('src/deep/er/x.js'));
  assert.equal(safeRefName('office/ada'), 'office/ada');
  for (const bad of ['-rf', 'a..b', 'a b', 'x.lock', '', 'a//b', '../up']) assert.equal(safeRefName(bad), null, bad);
  const s = parseStatus('# branch.oid abc\0# branch.head feat/x\0# branch.upstream origin/feat/x\0# branch.ab +2 -1\0'
    + '1 .M N... 100644 100644 100644 a b src/a.js\0' + '2 R. N... 100644 100644 100644 a b R100 new name.txt\0old.txt\0' + '? notes.md\0? build/\0');
  assert.deepEqual([s.branch, s.ahead, s.behind, s.upstream], ['feat/x', 2, 1, 'origin/feat/x']);
  assert.deepEqual(s.files, [{ path: 'src/a.js', state: 'M' }, { path: 'new name.txt', state: 'R' }, { path: 'notes.md', state: '?' }]);
});

test('workspace: two agents editing one file in one checkout are told, once', { skip: !hasGit }, async (t) => {
  const dir = repo();
  const office = await startOffice({ env: { OFFICE_GIT_EVERY_MS: '300' } });
  t.after(() => office.stop());
  const ada = await join(office, 'Ada', dir), lin = await join(office, 'Linus', path.join(dir, 'src'));     // a subfolder is the same checkout
  await edit(office, ada, dir, path.join(dir, 'src', 'a.js'));
  await edit(office, lin, path.join(dir, 'src'), 'a.js', 'Write');                                               // relative to its own folder
  await edit(office, lin, dir, path.join(dir, 'README.md'));
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'export const a = 2;\n');
  const snap = (await office.post('/api/workspace/refresh')).data;
  assert.equal(snap.git, true);
  assert.equal(snap.repos.length, 1);
  const checkout = snap.repos[0].checkouts[0];
  assert.deepEqual([checkout.branch, checkout.dirty, checkout.agents.length], ['main', 1, 2]);
  assert.deepEqual(checkout.files, [{ path: 'src/a.js', state: 'M' }]);
  assert.equal(snap.overlaps.length, 1);
  assert.deepEqual([snap.overlaps[0].kind, snap.overlaps[0].severity, snap.overlaps[0].path], ['same-file', 'high', 'src/a.js']);
  assert.deepEqual(snap.agents[lin].touched.map((x) => x.path), ['README.md', 'src/a.js']);

  for (const [id, other] of [[ada, 'Linus'], [lin, 'Ada']]) {
    const mail = await inbox(office, id);
    assert.equal(mail.length, 1, 'one note, not one per pass');
    assert.match(mail[0], new RegExp(`^Office: Heads-up from the office: you and ${other} are both editing src/a\\.js in the same checkout`));
  }
  await office.post('/api/workspace/refresh');
  assert.equal((await inbox(office, ada)).length, 0, 'read once, and not sent again');
  assert.equal(office.ctx.activity.recent(30).filter((i) => i.kind === 'overlap').length, 1);

  const mine = (await office.get(`/api/workspace/agent/${ada}`)).data;
  assert.match(mine.text, /You are in office-repo-\S+ on main\. 1 file changed\./);
  assert.match(mine.text, /Sharing this checkout with Linus/);
  assert.match(mine.text, /! Ada and Linus are both editing src\/a\.js/);
});

test('workspace: a claim is advisory — the editor and the owner both hear about it, and it can be asked about first', { skip: !hasGit }, async (t) => {
  const dir = repo();
  const office = await startOffice({ env: { OFFICE_GIT_EVERY_MS: '300' } });
  t.after(() => office.stop());
  const ada = await join(office, 'Ada', dir), lin = await join(office, 'Linus', dir);
  await office.post('/api/workspace/refresh');
  const claimed = (await office.post('/api/workspace/claim', { agent: ada, paths: ['src'], note: 'router refactor', minutes: 30 })).data;
  assert.equal(claimed.ok, true);
  assert.match(claimed.text, /^Claimed src until /);
  const contest = (await office.post('/api/workspace/claim', { agent: lin, paths: ['src/a.js'] })).data;
  assert.equal(contest.ok, false, 'two claims on one thing help nobody');
  assert.match(contest.text, /Not claimed: Ada already claims src \(“router refactor”\)\. Talk first/);
  assert.equal((await office.post('/api/workspace/claim', { agent: lin, paths: ['/etc/passwd'] })).data.ok, false, 'outside the repository is not yours to claim');

  // asking before the edit: this is what the guard hook does
  const ask = (await office.get(`/api/workspace/check?agent=${lin}&path=${encodeURIComponent(path.join(dir, 'src', 'a.js'))}&once=1`)).data;
  assert.equal(ask.warnings.length, 1);
  assert.match(ask.warnings[0].text, /src\/a\.js is claimed by Ada \(“router refactor”\)\. Talk to them first/);
  assert.equal((await office.get(`/api/workspace/check?agent=${lin}&path=${encodeURIComponent(path.join(dir, 'src', 'a.js'))}&once=1`)).data.warnings.length, 0, 'said once, not on every keystroke');
  assert.equal((await office.get(`/api/workspace/check?agent=${ada}&path=src/a.js`)).data.warnings.length, 0, 'your own claim is not a warning to you');

  await edit(office, lin, dir, path.join(dir, 'src', 'a.js'));
  const snap = (await office.post('/api/workspace/refresh')).data;
  assert.deepEqual(snap.overlaps.map((o) => [o.kind, o.path]), [['claimed', 'src/a.js']]);
  assert.match((await inbox(office, ada))[0], /Linus edited src\/a\.js, which Ada has claimed/);
  assert.match((await office.get(`/api/workspace/touching?path=${encodeURIComponent(path.join(dir, 'src', 'a.js'))}&agent=${ada}`)).data.text, /Linus edited it just now/);

  assert.equal((await office.post('/api/workspace/release', { agent: ada })).data.released, 1);
  assert.equal((await office.get('/api/workspace')).data.claims.length, 0);
});

test('workspace: the same file changed in two checkouts of one repository', { skip: !hasGit }, async (t) => {
  const dir = repo();
  const office = await startOffice({ env: { OFFICE_GIT_EVERY_MS: '300' } });
  t.after(() => office.stop());
  const ada = await join(office, 'Ada', dir);
  // a checkout of one's own, made by the office
  const made = (await office.post('/api/workspace/worktree', { agent: ada, name: 'Linus Desk' })).data;
  assert.equal(made.ok, true);
  assert.equal(made.branch, 'office/linus-desk');
  assert.equal(made.dir, `${dir}.worktrees/linus-desk`);
  assert.equal((await office.post('/api/workspace/worktree', { agent: ada, name: 'linus-desk' })).status, 409, 'never over an existing folder');
  assert.equal((await office.post('/api/workspace/worktree', { agent: ada, name: '../escape' })).status, 400);
  assert.equal((await office.post('/api/workspace/worktree', { cwd: '/nonexistent', name: 'x' })).status, 400);

  const lin = await join(office, 'Linus', made.dir);
  fs.writeFileSync(path.join(made.dir, 'shared.txt'), 'two\n');
  git(made.dir, 'commit', '-q', '-am', 'linus changes shared');                 // committed on one side…
  fs.writeFileSync(path.join(dir, 'shared.txt'), 'three\n');                    // …still being edited on the other
  fs.writeFileSync(path.join(dir, 'README.md'), '# only ada\n');
  const snap = (await office.post('/api/workspace/refresh')).data;
  assert.deepEqual(snap.repos[0].checkouts.map((c) => [c.branch, c.linked, c.agents.length]), [['main', false, 1], ['office/linus-desk', true, 1]]);
  assert.deepEqual(snap.overlaps.map((o) => [o.kind, o.severity, o.path]), [['both-changed', 'medium', 'shared.txt']], 'README changed on one side only: no overlap');
  assert.match(snap.overlaps[0].text, /shared\.txt has changed on both main \(Ada\) and office\/linus-desk \(Linus\)/);
  assert.match((await inbox(office, lin))[0], /you \(on office\/linus-desk\) and Ada have both changed shared\.txt/);
  assert.match((await office.get(`/api/workspace/agent/${lin}`)).data.text, /on office\/linus-desk, in your own worktree/);
  const ask = (await office.get(`/api/workspace/check?agent=${ada}&path=shared.txt`)).data;
  assert.match(ask.warnings[0].text, /shared\.txt has also been changed by Linus on office\/linus-desk/);
});

test('workspace: nothing to read is not an error, and git can be left alone entirely', async (t) => {
  const office = await startOffice({ env: { OFFICE_GIT: '0' } });
  t.after(() => office.stop());
  const a = await join(office, 'Ada', '/tmp/proj/nowhere'), b = await join(office, 'Linus', '/tmp/proj/nowhere');
  await edit(office, a, '/tmp/proj/nowhere', 'notes.md'); await edit(office, b, '/tmp/proj/nowhere', 'notes.md');
  const snap = (await office.post('/api/workspace/refresh')).data;
  assert.equal(snap.git, false);
  assert.deepEqual(snap.repos, []);
  assert.deepEqual(snap.overlaps.map((o) => [o.kind, o.path]), [['same-file', 'notes.md']], 'hooks alone are enough to notice a shared file');
  assert.match((await office.get(`/api/workspace/agent/${a}`)).data.text, /not reading git here/);
  assert.equal((await office.post('/api/workspace/claim', { agent: a, paths: ['docs/**'] })).data.ok, true);
});
