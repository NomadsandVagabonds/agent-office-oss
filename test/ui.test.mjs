// The parts of the interface that are plain logic: what a waiting request is
// said to be asking, and which answers it is offered — for the daemon's
// current self-describing prompts and for the older shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { answersOf, describe } from '../public/world/ui/answers.js';

const respond = (actions, extra = {}) => ({ method: 'POST', url: '/api/prompts/p1/reply', textField: 'text', actions, ...extra });

test('ui: what a request says it is asking', () => {
  const run = describe({ kind: 'permission', message: 'Wants to run: rm -rf build',
    ask: { summary: 'Wants to run: rm -rf build', tool: 'Shell', toolKind: 'execute', command: 'rm -rf build', files: [], detail: 'in ~/repo', questions: [] } });
  assert.equal(run.verb, 'wants to run');
  assert.equal(run.words, '', 'the command is not said twice');
  assert.equal(run.detail, 'rm -rf build\nin ~/repo');

  const edit = describe({ kind: 'permission', ask: { summary: 'Change files', toolKind: 'edit', files: ['src/a.js', 'src/b.js'] } });
  assert.deepEqual([edit.verb, edit.words, edit.detail], ['wants to change', 'Change files', 'src/a.js\nsrc/b.js']);

  // a hook-observed session: all the office has is the sentence
  const bare = describe({ kind: 'permission', message: 'Claude needs your permission to use Bash', ask: { summary: 'Claude needs your permission to use Bash' } });
  assert.deepEqual([bare.verb, bare.words, bare.detail], ['wants permission', 'Claude needs your permission to use Bash', '']);

  const asked = describe({ kind: 'question', message: 'Choose: Which dataset? (v3 / v4)',
    ask: { summary: 'Choose: Which dataset? (v3 / v4)', questions: [{ id: 'q1', header: 'Choose', text: 'Which dataset?', options: ['v3', 'v4'] }] } });
  assert.equal(asked.verb, 'has a question');
  assert.equal(asked.words, '', 'the question itself is shown, not its one-line summary');
  assert.equal(asked.questions[0].text, 'Which dataset?');

  // the older daemon: no `ask`, the details live on `request`
  const old = describe({ kind: 'permission', message: 'Run a command', request: { pending: true, command: 'npm test', paths: [], detail: '' } });
  assert.deepEqual([old.verb, old.words, old.detail], ['wants permission', 'Run a command', 'npm test']);
});

test('ui: which answers a request is offered', () => {
  const live = answersOf({ respond: respond([
    { id: 'once', kind: 'allow-once', label: 'Allow once', text: 'optional', body: { action: 'once' } },
    { id: 'always', kind: 'allow-session', label: 'Allow commands for this session', text: 'optional', body: { action: 'always' }, covers: 'command' },
    { id: 'reject', kind: 'reject', label: 'Reject', text: 'optional', body: { action: 'reject' } }]) });
  assert.deepEqual(live.map((a) => [a.kind, a.body.action]), [['allow-once', 'once'], ['allow-session', 'always'], ['reject', 'reject']]);

  // a resolved prompt offers nothing, and the client invents nothing
  assert.deepEqual(answersOf({ actions: ['reply'], respond: respond([]) }), []);

  // the older daemon only named its actions
  const old = answersOf({ actions: ['once', 'always', 'reject'] });
  assert.deepEqual(old.map((a) => a.kind), ['allow-once', 'allow-session', 'reject', 'dismiss']);
  assert.deepEqual(old[1].body, { action: 'always' });
  const relay = answersOf({ actions: ['reply'] });
  assert.deepEqual(relay.map((a) => [a.kind, a.text]), [['reply', 'required'], ['dismiss', 'none']]);
  assert.deepEqual(relay[1].body, { text: '', close: true });
});
