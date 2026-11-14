// Test helpers for the harness suites: a real office whose adapter catalog
// points at the fake agents in this folder, plus the few verbs every test
// needs (start a session, give it a turn, wait for it, read what happened).
//
// Hermetic on purpose: every built-in adapter id is overridden here, so a
// machine that does have `codex`, `gemini` or a Claude wrapper installed can
// never have a test start a real agent and spend the owner's tokens.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, startOffice, tempDir, sleep } from '../helpers.mjs';

const FIX = path.join(ROOT, 'test', 'fixtures');
const NODE = process.execPath;
const ACP = path.join(FIX, 'fake-acp-agent.mjs');
const CODEX = path.join(FIX, 'fake-codex-app-server.mjs');
const ABSENT = 'office-test-agent-that-is-not-installed';

export const ADAPTERS = [
  // the built-ins, made unavailable
  { id: 'claude', label: 'Claude Code', protocol: 'acp', command: ABSENT, provider: 'claude' },
  { id: 'codex', label: 'Codex', protocol: 'codex-app-server', command: ABSENT, provider: 'codex' },
  { id: 'gemini', label: 'Gemini CLI', protocol: 'acp', command: ABSENT, provider: 'gemini' },
  { id: 'opencode', label: 'opencode', protocol: 'acp', command: ABSENT, provider: 'opencode' },
  { id: 'codex-acp', label: 'Codex (ACP)', protocol: 'acp', command: ABSENT, provider: 'codex' },
  // the fakes
  { id: 'fake', label: 'Fake Agent', protocol: 'acp', command: NODE, args: [ACP], provider: 'gemini' },
  { id: 'fake-v2', label: 'Fake Agent v2', protocol: 'acp', command: NODE, args: [ACP, '--v2'], provider: 'gemini', acpVersion: 2 },
  { id: 'fake-auth', label: 'Fake Agent (login)', protocol: 'acp', command: NODE, args: [ACP, '--auth'], provider: 'gemini' },
  { id: 'chatty', label: 'Chatty Agent', protocol: 'acp', command: NODE, args: [ACP, '--pingpong'], provider: 'opencode' },
  { id: 'fake-codex', label: 'Fake Codex', protocol: 'codex-app-server', command: NODE, args: [CODEX], provider: 'codex' },
  { id: 'fake-codex-old', label: 'Fake Codex (old)', protocol: 'codex-app-server', command: NODE, args: [CODEX, '--no-limits'], provider: 'codex' },
];

/** Poll until `fn` returns something truthy (it may be async). */
export async function waitFor(fn, { timeout = 6000, every = 15, what = 'the condition' } = {}) {
  const until = Date.now() + timeout;
  let last;
  for (;;) {
    last = await fn();
    if (last) return last;
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await sleep(every);
  }
}

/** An office with the fake adapters. Adds the harness verbs to what startOffice() returns. */
export async function startHarnessOffice(opt = {}) {
  const dir = opt.dir || tempDir('office-harness-');
  const work = opt.work || fs.mkdtempSync(path.join(dir, 'work-'));
  const file = path.join(dir, 'adapters.json');
  fs.writeFileSync(file, JSON.stringify({ adapters: opt.adapters || ADAPTERS }));
  const o = await startOffice({ dir, env: {
    OFFICE_HARNESS_FILE: file,
    OFFICE_WAKE_DEBOUNCE_MS: '20', OFFICE_WAKE_MIN_GAP_MS: '0',
    OFFICE_HARNESS_CANCEL_TIMEOUT_MS: '600',
    ...(opt.env || {}),
  } });

  const h = {
    ...o, work, adaptersFile: file,

    /** Start a driven session and wait until the agent has answered. Returns its public view. */
    async start(adapter = 'fake', extra = {}) {
      const res = await o.post('/api/harness/sessions', { adapter, cwd: work, ...extra });
      if (res.status !== 200) throw new Error(`could not start ${adapter}: ${res.status} ${JSON.stringify(res.data)}`);
      return res.data.session;
    },
    session: async (id) => (await o.get(`/api/harness/sessions/${id}`)).data.session,
    entries: async (id, query = '') => (await o.get(`/api/harness/sessions/${id}/transcript${query}`)).data.entries,
    entry: async (id, entryId) => (await h.entries(id)).find((e) => e.id === entryId) || null,

    /** Wait until turn `n` of a session has ended; returns its transcript entry. */
    turnDone: (id, n, opt2 = {}) => waitFor(async () => {
      const e = await h.entry(id, `turn-${n}`);
      return e && e.state !== 'running' ? e : null;
    }, { what: `turn ${n} of ${id} to end`, ...opt2 }),

    /** Give a turn and wait for it. Returns { n, turn, said, entries } for that turn. */
    async turn(id, text, opt2 = {}) {
      const res = await o.post(`/api/harness/sessions/${id}/turn`, { text });
      if (res.status !== 200) throw new Error(`turn refused: ${res.status} ${JSON.stringify(res.data)}`);
      if (res.data.queued) throw new Error('the turn was queued; use post() and turnDone() for that');
      const n = res.data.turn;
      const turn = await h.turnDone(id, n, opt2);
      return { n, turn, ...(await h.turnView(id, n)) };
    },
    async turnView(id, n) {
      const entries = (await h.entries(id)).filter((e) => e.turn === n);
      return { entries, said: entries.filter((e) => e.kind === 'message').map((e) => e.text).join('\n') };
    },
    /** Start a turn without waiting for it; returns its number. */
    async begin(id, text) {
      const res = await o.post(`/api/harness/sessions/${id}/turn`, { text });
      if (res.status !== 200) throw new Error(`turn refused: ${res.status} ${JSON.stringify(res.data)}`);
      return res.data.turn;
    },

    /** The pending NEEDS-YOU card for an agent (waits for it). */
    need: (agentId, opt2 = {}) => waitFor(async () => {
      const list = (await o.get('/api/prompts?status=pending')).data;
      return list.find((p) => p.agentId === agentId) || null;
    }, { what: `a NEEDS-YOU card for ${agentId}`, ...opt2 }),
    answer: (promptId, body, headers) => o.post(`/api/prompts/${promptId}/reply`, body, headers),

    agent: async (id) => (await o.get(`/api/agents/${id}`)).data.agent,
    inbox: async (agent) => (await o.get(`/api/inbox?agent=${encodeURIComponent(agent)}`)).data,
    activity: async () => (await o.get('/api/activity?limit=200')).data.items,
  };
  return h;
}

export { sleep, ROOT, FIX };
