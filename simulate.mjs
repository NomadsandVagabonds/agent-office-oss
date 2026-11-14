#!/usr/bin/env node
// The demo cast. Brings a fictional, multi-provider team online and keeps it
// behaving like a real one: agents take turns (prompt → tools → done), go idle
// between them, hit the occasional permission prompt, talk in channels, send
// each other notes, and move cards across their boards.
//
// Everything goes through the daemon's public HTTP API — the same calls real
// agents make — so the demo exercises the real system rather than faking it.
//
//   node simulate.mjs            the stable cast
//   node simulate.mjs --quiet    presence only (no chatter, no board activity)
//
// Each cwd's basename becomes a department when no profiles.json mapping is
// present, so a fresh clone shows a lively office out of the box.
const PORT = process.env.OFFICE_PORT || 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const QUIET = process.argv.includes('--quiet');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (list) => list[(Math.random() * list.length) | 0];
const chance = (p) => Math.random() < p;

async function call(path, body, method = 'POST') {
  try {
    const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return res.ok && res.status !== 204 ? await res.json() : null;
  } catch { return null; }
}

// provider · model · project — a team that could plausibly exist
const ROSTER = [
  { id: 'demo-webstore-1', cwd: '/tmp/demo/webstore', provider: 'claude', model: 'claude-opus-4-5' },
  { id: 'demo-webstore-2', cwd: '/tmp/demo/webstore', provider: 'codex', model: 'gpt-5-codex' },
  { id: 'demo-mobile-1', cwd: '/tmp/demo/mobile-app', provider: 'gemini', model: 'gemini-2.5-pro' },
  { id: 'demo-mobile-2', cwd: '/tmp/demo/mobile-app', provider: 'claude', model: 'claude-sonnet-4-5' },
  { id: 'demo-api-1', cwd: '/tmp/demo/api-gateway', provider: 'codex', model: 'gpt-5-codex' },
  { id: 'demo-api-2', cwd: '/tmp/demo/api-gateway', provider: 'claude', model: 'claude-haiku-4-5' },
  { id: 'demo-data-1', cwd: '/tmp/demo/data-pipeline', provider: 'claude', model: 'claude-sonnet-4-5' },
  { id: 'demo-ml-1', cwd: '/tmp/demo/ml-research', provider: 'gemini', model: 'gemini-2.5-pro' },
  { id: 'demo-ml-2', cwd: '/tmp/demo/ml-research', provider: 'opencode', model: 'qwen3-coder' },
  { id: 'demo-infra-1', cwd: '/tmp/demo/infra', provider: 'codex', model: 'gpt-5-codex' },
  { id: 'demo-docs-1', cwd: '/tmp/demo/docs-site', provider: 'claude', model: 'claude-haiku-4-5' },
  { id: 'demo-growth-1', cwd: '/tmp/demo/growth', provider: 'custom', model: 'deepseek-v3 · aider' },
];

const TOOLS = ['Edit', 'Edit', 'Bash', 'Read', 'Read', 'Grep', 'Write', 'Glob', 'WebFetch', 'Task'];
const ASKS = ['Claude needs your permission to use Bash', 'Permission to run git push?',
  'Which dataset — v3 or v4?', 'Approve the deploy to staging?', 'Pick a model for the eval run',
  'OK to delete the old migration files?', 'The tests need a real API key — should I mock it instead?'];
const STATUS_LINES = ['Status: tests are green on my branch.', 'Pushed the refactor; ready for a second pair of eyes.',
  'Found the flaky test — it was a timezone thing. Fixing.', 'Heads up: I am touching the shared config.',
  'Blocked on nothing; picking up the next card.', 'Wrote up the tradeoffs in docs/decisions.md.',
  'Latency is down 18% after the cache change.', 'Rebased on main, no conflicts.',
  'Dependency bump done; lockfile is clean.', 'Anyone else seeing the CI runner stall?'];
const NOTES = ['Can you sanity-check my migration before I run it?', 'Your endpoint returns 200 with an empty body — intended?',
  'Stealing your retry helper, thank you.', 'Got five minutes to look at a weird stack trace?',
  'I left a comment on your card.', 'Which branch has the new schema?', 'Nice fix on the pagination bug.'];
const CARDS = ['Add rate limiting to the public API', 'Write the onboarding guide', 'Migrate the auth tables',
  'Profile the slow dashboard query', 'Set up nightly evals', 'Fix flaky checkout test', 'Dark mode for settings',
  'Document the deploy runbook', 'Cache the product catalogue', 'Audit third-party licenses',
  'Add structured logging', 'Trim the Docker image'];

const hook = (a, name, extra = {}) => call('/hook', {
  session_id: a.id, cwd: a.cwd, provider: a.provider, model: a.model,
  hook_event_name: name, contextPct: Math.round(a.ctx), ...extra,
});

async function turn(a) {
  await hook(a, 'UserPromptSubmit');
  await sleep(rand(1200, 3200));
  const steps = 4 + ((Math.random() * 12) | 0);
  for (let i = 0; i < steps; i++) {
    const tool = pick(TOOLS);
    await hook(a, 'PreToolUse', { tool_name: tool });
    await sleep(rand(700, 2600));
    a.ctx = Math.min(96, a.ctx + rand(0.3, 1.6));
    if (chance(0.045)) {                              // a real decision is needed
      await hook(a, 'Notification', { message: pick(ASKS) });
      await sleep(rand(9000, 24000));
      await hook(a, 'UserPromptSubmit');
      await sleep(rand(800, 1800));
      continue;
    }
    await hook(a, 'PostToolUse', { tool_name: tool });
    if (tool === 'Task') { await sleep(rand(2500, 6000)); await hook(a, 'SubagentStop'); }
    await sleep(rand(500, 2400));
  }
  await hook(a, 'Stop');
  if (a.ctx > 88) a.ctx = rand(8, 20);                 // a fresh context, now and then
}

async function live(a) {
  await sleep(rand(0, 9000));
  for (;;) {
    await turn(a);
    await sleep(rand(18000, 75000));                   // idle: this is when they wander
  }
}

// A card in Review is looked at by a colleague, and then decided — in this demo by a stand-in for you, who says so in its name.
const FINDINGS = [
  ['The error path is not covered by a test', false], ['This retries forever when the server says no', true], ['Name says "list" but it returns a map', false],
  ['The limit is hard-coded here and in the config', false], ['A request without a token still gets through', true], ['The log line prints the whole payload', false],
];
async function review(t, a) {
  const at = `/api/tasks/${encodeURIComponent(t.id)}/review`;
  const peer = t.assignee && t.assignee !== a.id;
  if (peer && chance(0.45)) {
    const [text, blocker] = pick(FINDINGS);
    await call(`${at}/findings`, { text, from: a.id, ...(blocker ? { severity: 'blocker' } : {}) });
  } else if (peer && chance(0.4)) {
    await call(`${at}/recommend`, { decision: t.review?.blockers ? 'changes' : 'approved', from: a.id });
  } else {
    await call(`${at}/verdict`, { decision: t.review?.blockers ? 'changes' : 'approved', author: 'Demo lead' });
  }
}

async function social() {
  for (;;) {
    await sleep(rand(9000, 22000));
    const a = pick(ROSTER);
    const roll = Math.random();
    if (roll < 0.34) {
      const others = ROSTER.filter((o) => o.id !== a.id);
      const mention = chance(0.2) ? ` @${(pick(others).name || '').split(' ')[0] || 'all'}` : '';
      await call(`/api/channels/${encodeURIComponent('project:' + a.dept)}/message`,
        { content: pick(STATUS_LINES) + mention, authorAgentId: a.id, authorType: 'agent' });
    } else if (roll < 0.56) {
      const to = pick(ROSTER.filter((o) => o.id !== a.id));
      await call('/api/collab/message', { fromAgentId: a.id, toAgentId: to.id, content: pick(NOTES) });
    } else {
      const { tasks = [] } = await call(`/api/tasks?deptId=${encodeURIComponent(a.dept)}`, undefined, 'GET') || {};
      const open = tasks.filter((t) => t.status !== 'done');
      const who = { authorAgentId: a.id, authorType: 'agent' };
      if (open.length < 3 || chance(0.25)) {
        await call('/api/tasks', { title: pick(CARDS), deptId: a.dept, status: chance(0.5) ? 'todo' : 'backlog', ...who });
      } else {
        const t = pick(open);
        if (t.status === 'review') { await review(t, a); continue; }
        const next = { backlog: 'todo', todo: 'doing', doing: 'review', blocked: 'doing' }[t.status] || 'doing';
        await call(`/api/tasks/${encodeURIComponent(t.id)}`,
          { status: next, ...(next === 'doing' ? { assignee: a.id } : {}), ...who }, 'PATCH');
      }
    }
  }
}

(async () => {
  console.log(`Demo office: ${ROSTER.length} agents from ${new Set(ROSTER.map((a) => a.provider)).size} providers.`);
  for (const a of ROSTER) {
    a.ctx = rand(6, 55);
    a.dept = a.cwd.split('/').pop();
    await hook(a, 'SessionStart');
    await sleep(350);
  }
  // learn the names the office gave everyone (for @mentions)
  const known = await call('/api/agents', undefined, 'GET') || [];
  for (const a of ROSTER) a.name = known.find((k) => k.id === a.id)?.name || '';
  for (const a of ROSTER) live(a);
  if (!QUIET) social();
})();
