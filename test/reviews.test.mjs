// The review table: what a card in Review is offering (a real branch and
// commit in a real temp repository), what gets found, who may recommend, and
// who decides.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { ROOT, startOffice, tempDir } from './helpers.mjs';
import { startHarnessOffice, waitFor } from './fixtures/harness-helpers.mjs';
import { parseFindings } from '../server/reviews.mjs';

const hasGit = spawnSync('git', ['--version']).status === 0;
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.com' } }).trim();
function repo() {
  const dir = fs.realpathSync(tempDir('office-review-'));
  git(dir, 'init', '-q', '-b', 'main');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\n');
  git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'first');
  git(dir, 'checkout', '-q', '-b', 'feat/login');
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'export const a = 2;\n');
  git(dir, 'commit', '-q', '-am', 'change a');
  fs.writeFileSync(path.join(dir, 'src', 'login.js'), 'export const login = () => true;\n');
  git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'add login');
  return dir;
}
const join = async (office, name, cwd) => (await office.post('/api/agents/join', { provider: 'claude', name, cwd })).data.agent.id;
const inbox = async (office, id) => (await office.get(`/api/inbox?agent=${id}&ack=1`)).data.items.map((m) => `${m.from}: ${m.text}`);
const table = async (office, id) => (await office.get(`/api/tasks/${id}/review`)).data;
/** The table, once the office has finished reading git for it. */
const settled = (office, id, round) => waitFor(async () => { const t = await table(office, id); return t && !t.capturing && (!round || t.round === round) ? t : null; }, { what: 'the version to be read' });

test('reviews: findings an agent only wrote down are still findings', () => {
  const got = parseFindings([
    'I read the diff.', '',
    '- [blocker] src/auth.js:42 — the token is logged in plain text',
    '* [NOTE] the error message could name the file',
    '2. [note] `docs/setup.md` - says port 4000, the code says 4317',
    '- [blocker] server/api/users.mjs: no check that the caller owns the record',
    '- [praise] nice tests', '- no tag here', '  [blocker] not a list item',
  ].join('\n'));
  assert.deepEqual(got, [
    { severity: 'blocker', file: 'src/auth.js', line: 42, text: 'the token is logged in plain text' },
    { severity: 'note', file: null, line: null, text: 'the error message could name the file' },
    { severity: 'note', file: 'docs/setup.md', line: null, text: 'says port 4000, the code says 4317' },
    { severity: 'blocker', file: 'server/api/users.mjs', line: null, text: 'no check that the caller owns the record' },
  ]);
  assert.deepEqual(parseFindings(''), []);
  assert.equal(parseFindings(Array.from({ length: 80 }, (_, i) => `- [note] thing ${i}`).join('\n')).length, 50, 'bounded');
});

test('reviews: a card put up for review says exactly what is offered, and the human decides', { skip: !hasGit }, async (t) => {
  const dir = repo();
  const office = await startOffice({ env: { OFFICE_GIT_EVERY_MS: '300' } });
  t.after(() => office.stop());
  const ada = await join(office, 'Ada', dir), lin = await join(office, 'Linus', dir);
  const card = (await office.post('/api/tasks', { title: 'Add login', deptId: 'demo', assignee: ada, status: 'doing' })).data.task;
  assert.equal(card.review, null, 'a card that was never in review has no table');
  assert.equal((await office.get(`/api/tasks/${card.id}/review`)).status, 409);
  assert.equal((await office.post(`/api/tasks/${card.id}/review/findings`, { text: 'too early' })).status, 409);
  assert.equal((await office.get('/api/tasks/t_nope/review')).status, 404);

  // Uncommitted work on top of the branch is part of what is offered — and is said to be unpinned.
  fs.writeFileSync(path.join(dir, 'notes.md'), 'todo\n');
  const head1 = git(dir, 'rev-parse', 'HEAD');
  assert.equal((await office.patch(`/api/tasks/${card.id}`, { status: 'review', authorAgentId: ada })).status, 200);
  const first = await settled(office, card.id);
  assert.deepEqual([first.round, first.state, first.openedBy.name], [1, 'open', 'Ada']);
  const v = first.version;
  assert.deepEqual([v.known, v.agentName, v.branch, v.head, v.base, v.commits], [true, 'Ada', 'feat/login', head1, 'main', 2]);
  assert.deepEqual(v.changed, ['src/a.js', 'src/login.js']);
  assert.deepEqual([v.dirty, v.uncommitted.map((f) => f.path)], [1, ['notes.md']]);
  assert.equal(first.moved, null);
  assert.match(first.text, /feat\/login at [0-9a-f]{9} \(2 commits on top of main, 2 files changed\) \+ 1 uncommitted file/);
  const onBoard = (await office.get('/api/tasks?deptId=demo')).data.tasks.find((x) => x.id === card.id).review;
  assert.deepEqual([onBoard.round, onBoard.state, onBoard.pinned.branch, onBoard.pinned.head, onBoard.pinned.dirty, onBoard.open], [1, 'open', 'feat/login', head1.slice(0, 9), 1, 0]);

  // Anyone can find; a finding has an author, a severity and, where it has one, a place.
  const f1 = (await office.post(`/api/tasks/${card.id}/review/findings`, { text: 'login() accepts anyone', file: 'src/login.js', line: 1, severity: 'blocker' })).data.finding;
  assert.deepEqual([f1.by.kind, f1.by.name, f1.severity, f1.file, f1.line, f1.round], ['human', 'Lead', 'blocker', 'src/login.js', 1, 1]);
  const f2 = (await office.post(`/api/tasks/${card.id}/review/findings`, { text: 'name the constant', from: lin })).data.finding;
  assert.deepEqual([f2.by.kind, f2.by.name, f2.severity, f2.file], ['agent', 'Linus', 'note', null]);
  assert.equal((await office.post(`/api/tasks/${card.id}/review/findings`, { text: '   ' })).status, 400);
  assert.equal((await office.post(`/api/tasks/${card.id}/review/findings`, { text: 'x', from: 'nobody-here' })).status, 404);

  // Agents recommend — never their own work — and never decide.
  assert.equal((await office.post(`/api/tasks/${card.id}/review/recommend`, { decision: 'approved', from: ada })).status, 403);
  assert.equal((await office.post(`/api/tasks/${card.id}/review/recommend`, { decision: 'approved' })).status, 400, 'the human does not recommend, the human decides');
  assert.equal((await office.post(`/api/tasks/${card.id}/review/recommend`, { decision: 'perhaps', from: lin })).status, 400);
  assert.equal((await office.post(`/api/tasks/${card.id}/review/recommend`, { decision: 'approved', from: lin })).status, 200);
  const rec = (await office.post(`/api/tasks/${card.id}/review/recommend`, { decision: 'changes', note: 'the blocker first', from: lin })).data.recommendation;
  assert.deepEqual([rec.by.name, rec.decision, rec.head], ['Linus', 'changes', head1]);
  const verdictByAgent = await office.post(`/api/tasks/${card.id}/review/verdict`, { decision: 'approved', from: lin });
  assert.equal(verdictByAgent.status, 403);
  assert.match(verdictByAgent.data.error, /that is for the human/);
  let now = await table(office, card.id);
  assert.equal(now.recommendations.length, 1, 'one recommendation per reviewer per round: the latest');
  assert.deepEqual([now.findings.length, now.state], [2, 'open']);
  assert.deepEqual((await office.get('/api/tasks?deptId=demo')).data.tasks.find((x) => x.id === card.id).review.recommends, { approved: 0, changes: 1 });

  // The human asks for changes: the card goes back, and the owner is told what is open, as the human speaking.
  await inbox(office, ada);
  const back = (await office.post(`/api/tasks/${card.id}/review/verdict`, { decision: 'changes', note: 'Close, not yet.' })).data;
  assert.deepEqual([back.verdict.decision, back.verdict.by.name, back.verdict.openFindings, back.task.status], ['changes', 'Lead', 2, 'doing']);
  const mail = (await inbox(office, ada)).join('\n');
  assert.match(mail, /Lead: Changes asked on “Add login” \(t_\w+\)\. Close, not yet\./);
  assert.match(mail, /- \[blocker\] src\/login\.js:1 — login\(\) accepts anyone/);
  assert.match(mail, /office task move t_\w+ review/);
  assert.equal((await office.post(`/api/tasks/${card.id}/review/verdict`, { decision: 'approved' })).status, 409, 'it is not in review any more');

  // Fixed, resolved, put up again: a second round at a new commit, with the history of the first.
  fs.writeFileSync(path.join(dir, 'src', 'login.js'), 'export const login = (user) => !!user;\n');
  git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'check the user');
  const head2 = git(dir, 'rev-parse', 'HEAD');
  const done = (await office.patch(`/api/tasks/${card.id}/review/findings/${f1.id}`, { resolved: true, note: 'checks the user now', from: ada })).data.finding;
  assert.deepEqual([done.resolved.by.name, done.resolved.note], ['Ada', 'checks the user now']);
  assert.equal((await office.patch(`/api/tasks/${card.id}/review/findings/f_nope`, { resolved: true })).status, 404);
  await office.patch(`/api/tasks/${card.id}`, { status: 'review', authorAgentId: ada });
  const second = await settled(office, card.id, 2);
  assert.deepEqual([second.round, second.state, second.version.head, second.version.commits], [2, 'open', head2, 3]);
  assert.deepEqual(second.history.map((h) => [h.round, h.verdict.decision]), [[1, 'changes']]);
  assert.deepEqual(second.findings.map((f) => [f.round, !!f.resolved]), [[1, true], [1, false]], 'findings stay with the card across rounds');
  assert.deepEqual(second.recommendations, [], 'a recommendation was about the round it was made in');

  // More commits after it was put up: whoever opens the table is told the ground has moved.
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\nlogin added\n');
  git(dir, 'commit', '-q', '-am', 'docs');
  const head3 = git(dir, 'rev-parse', 'HEAD');
  now = await table(office, card.id);
  assert.deepEqual(now.moved, { head: head3, was: head2 });
  assert.match(now.text, /! the branch has moved since: it is now at /);
  const again = (await office.post(`/api/tasks/${card.id}/review/refresh`)).data.version;
  assert.equal(again.head, head3);
  assert.equal((await table(office, card.id)).moved, null);

  // Approved: done, on the record with the commit it was approved at, and the owner hears it quietly.
  await inbox(office, ada);
  const ok = (await office.post(`/api/tasks/${card.id}/review/verdict`, { decision: 'approved', note: 'Good.' })).data;
  assert.deepEqual([ok.verdict.decision, ok.verdict.head, ok.verdict.openFindings, ok.task.status], ['approved', head3, 1, 'done']);
  assert.match((await inbox(office, ada)).join('\n'), /Office: Approved: “Add login” — Good\./);
  const final = (await office.get('/api/tasks?deptId=demo')).data.tasks.find((x) => x.id === card.id).review;
  assert.deepEqual([final.state, final.verdict.decision, final.verdict.by, final.closedBy], ['approved', 'approved', 'Lead', null]);
  const feed = (await office.get('/api/activity?limit=50')).data;
  const lines = (feed.items || feed.activity || feed).map((e) => e.text).join('\n');
  assert.match(lines, /Ada put “Add login” up for review/);
  assert.match(lines, /Lead asked for changes on “Add login” \(2 open findings\)/);
  assert.match(lines, /Lead approved “Add login”/);
});

test('reviews: leaving Review without a verdict is on the record as exactly that', async (t) => {
  const office = await startOffice({ env: { OFFICE_GIT: '0' } });
  t.after(() => office.stop());
  const ada = await join(office, 'Ada', '/tmp/proj/nowhere');
  const mk = async (title) => (await office.post('/api/tasks', { title, deptId: 'demo', assignee: ada, status: 'review', authorAgentId: ada })).data.task;

  const a = await mk('Closed by its own author');
  const ta = await settled(office, a.id);
  assert.deepEqual([ta.state, ta.version.known], ['open', false]);
  assert.match(ta.version.why, /not reading git/);
  await office.patch(`/api/tasks/${a.id}`, { status: 'done', authorAgentId: ada });
  const closed = (await office.get('/api/tasks?deptId=demo')).data.tasks.find((x) => x.id === a.id).review;
  assert.deepEqual([closed.state, closed.closedBy, closed.verdict], ['closed', 'Ada', null]);
  assert.equal((await office.post(`/api/tasks/${a.id}/review/verdict`, { decision: 'approved' })).status, 409);

  const b = await mk('Taken back');
  await settled(office, b.id);
  await office.patch(`/api/tasks/${b.id}`, { status: 'doing', authorAgentId: ada });
  assert.equal((await table(office, b.id)).state, 'withdrawn');
  await office.patch(`/api/tasks/${b.id}`, { status: 'review', authorAgentId: ada });
  assert.deepEqual([(await settled(office, b.id, 2)).round], [2]);

  // A card deleted takes its table with it; nothing dangles.
  await office.del(`/api/tasks/${b.id}`);
  assert.equal((await office.get(`/api/tasks/${b.id}/review`)).status, 404);
});

test('reviews: the human hands the review to an agent, and what it found comes back onto the card', async (t) => {
  const h = await startHarnessOffice();
  t.after(() => h.stop());
  const ada = await join(h, 'Ada', h.work);
  const card = (await h.post('/api/tasks', { title: 'Tidy the parser', body: 'Split parse() in two.', deptId: 'demo', assignee: ada, status: 'review', authorAgentId: ada })).data.task;
  await settled(h, card.id);
  assert.equal((await table(h, card.id)).canAskAgents, true);
  assert.equal((await h.post(`/api/tasks/${card.id}/review/run`, { to: 'fake', from: ada })).status, 403, 'an agent delegates in its own name instead');
  assert.equal((await h.post(`/api/tasks/${card.id}/review/run`, { to: 'no-such-agent' })).status, 404);

  // The stand-in agent says its task back, so what it is asked to look at is also what it "found".
  const focus = 'the split\n- [blocker] src/parse.js:12 — the second half never runs\n- [note] name both halves';
  const run = (await h.post(`/api/tasks/${card.id}/review/run`, { to: 'fake', focus })).data.run;
  assert.match(run.id, /^dg_/);
  const done = await waitFor(async () => { const x = await table(h, card.id); return x.runs[0]?.status === 'completed' ? x : null; }, { what: 'the review to come back' });
  const reviewer = done.runs[0].to.name;
  assert.ok(reviewer, 'the reviewer has a name');
  assert.match(done.runs[0].summary, /Review the work on this card\. Read only/);
  assert.match(done.runs[0].summary, /Card: “Tidy the parser” \(t_\w+\)\nSplit parse\(\) in two\./);
  assert.match(done.runs[0].summary, /office task finding t_\w+ "what is wrong/);
  assert.deepEqual(done.findings.map((f) => [f.by.name, f.severity, f.file, f.line, f.text, f.runId]), [
    [reviewer, 'blocker', 'src/parse.js', 12, 'the second half never runs', run.id],
    [reviewer, 'note', null, null, 'name both halves', run.id]]);
  assert.match((await inbox(h, ada)).join('\n'), new RegExp(`Office: ${reviewer} reviewed “Tidy the parser”: 2 findings, 1 blocker\\. See them: office task review t_\\w+`));
  const badge = (await h.get('/api/tasks?deptId=demo')).data.tasks.find((x) => x.id === card.id).review;
  assert.deepEqual([badge.open, badge.blockers, badge.reviewing], [2, 1, 0]);
  // The delegation is an ordinary one: its record and the reviewer's transcript are there to read.
  const d = (await h.get(`/api/delegations/${run.id}`)).data.delegation;
  assert.deepEqual([d.role, d.mode, d.from.kind, d.title], ['review', 'ask', 'human', 'Review: Tidy the parser']);
});

/** Run the office command the way an agent in a terminal would, while the office under test keeps answering here. */
function cli(office, id, cwd, args, input) {
  const env = { ...process.env, OFFICE_PORT: String(office.port), OFFICE_URL: '', OFFICE_TOKEN: '', OFFICE_SESSION_TOKEN: '', OFFICE_AGENT_ID: id,
    CLAUDE_CODE_SESSION_ID: '', CLAUDE_SESSION_ID: '', CODEX_THREAD_ID: '', CLAUDECODE: '', HOME: office.dir };
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, args[0] === '--mcp' ? 'office-mcp.mjs' : 'office.mjs'), ...(args[0] === '--mcp' ? [] : args)], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
    child.stdin.end(input || '');
  });
}

test('reviews: an agent reviews from its terminal — findings, a recommendation, never the verdict', { skip: !hasGit }, async (t) => {
  const dir = repo();
  const office = await startOffice({ env: { OFFICE_GIT_EVERY_MS: '300' } });
  t.after(() => office.stop());
  const ada = await join(office, 'Ada', dir), lin = await join(office, 'Linus', dir);
  const card = (await office.post('/api/tasks', { title: 'Add login', deptId: 'demo', assignee: ada, status: 'review', authorAgentId: ada })).data.task;
  await settled(office, card.id);
  const linus = (...args) => cli(office, lin, dir, args), adaSays = (...args) => cli(office, ada, dir, args);

  const shown = await linus('task', 'review', card.id);
  assert.equal(shown.code, 0, shown.err);
  assert.match(shown.out, /^“Add login” \(t_\w+\) — review round 1, waiting for a verdict/);
  assert.match(shown.out, /feat\/login at [0-9a-f]{9} \(2 commits on top of main, 2 files changed\)/);
  assert.match(shown.out, /no findings yet/);

  const found = await linus('task', 'finding', card.id, 'login() accepts anyone', '--file', 'src/login.js', '--line', '1', '--blocker');
  assert.match(found.out, /^f_[0-9a-f]{8} {2}\[blocker\] recorded on t_\w+\.$/);
  const fid = found.out.split(' ')[0];
  assert.match((await linus('task', 'finding', card.id, 'a.js has no test')).out, /\[note\] recorded/);
  assert.notEqual((await linus('task', 'finding', card.id)).code, 0, 'a finding needs words');

  assert.match((await linus('task', 'recommend', card.id, 'changes', 'the blocker first')).out, /you would ask for changes\. The decision is the human's\./);
  const own = await adaSays('task', 'recommend', card.id, 'approve');
  assert.notEqual(own.code, 0);
  assert.match(own.err + own.out, /cannot recommend your own work/);
  assert.notEqual((await linus('task', 'recommend', card.id, 'maybe')).code, 0);

  // The author reads what was found, deals with it, and says so.
  const read = (await adaSays('task', 'review', card.id)).out;
  assert.match(read, new RegExp(`${fid}  \\[blocker\\] src/login\\.js:1 — login\\(\\) accepts anyone  \\(Linus\\)`));
  assert.match(read, /Linus recommends: changes — the blocker first/);
  assert.match((await adaSays('task', 'resolve', card.id, fid, 'checks the user now')).out, /resolved\.$/);
  assert.match((await adaSays('task', 'review', card.id)).out, /1 open finding:/);
  assert.match((await adaSays('task', 'reopen', card.id, fid)).out, /open again\.$/);
  // The board says it in a line.
  assert.match((await linus('task', 'show', card.id)).out, /review · @Ada · in review at [0-9a-f]{9}, 2 open findings \(1 blocker\)/);

  // The same through the tools an agent has when it is not in a terminal.
  const frames = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'office_review', arguments: { taskId: card.id, action: 'finding', text: 'the README does not mention login', file: 'README.md' } } },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'office_review', arguments: { taskId: card.id } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'office_review', arguments: { taskId: card.id, action: 'recommend', decision: 'approve' } } },
  ];
  const mcp = await cli(office, lin, dir, ['--mcp'], frames.map((f) => JSON.stringify(f)).join('\n') + '\n');
  const answers = mcp.out.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const textOf = (id) => answers.find((a) => a.id === id)?.result?.content?.[0]?.text || '';
  assert.match(textOf(2), /^f_[0-9a-f]{8} \[note\] recorded\.$/);
  assert.match(textOf(3), /README\.md — the README does not mention login {2}\(Linus\)/);
  assert.match(textOf(4), /you would approve it/);
  assert.deepEqual((await table(office, card.id)).recommendations.map((r) => [r.by.name, r.decision]), [['Linus', 'approved']]);
});
