// The Office — the harness: sessions the office drives itself.
//
// Next to the tmux lane (a terminal the office types into and reads back) this
// is the structured lane: an agent runs as a child process speaking ACP or the
// Codex app-server protocol, and the office starts it, sends it turns, streams
// what it does, answers its permission requests, stops it and ends it. See
// docs/HARNESS.md for the design and what it was learned from.
//
//   catalog.mjs      which agents can be driven, and how to start each
//   rpc.mjs child.mjs adapter.mjs acp.mjs codex.mjs normalize.mjs
//                    process + protocol → one vocabulary of events
//   session.mjs      one driven session: turns, transcript, approvals, its desk
//   approvals.mjs    what "once / for the session / reject" mean
//   transcript.mjs   the per-session timeline
//   credentials.mjs  a secret per session, for the office tools it is given
//   wake.mjs         mail that starts a turn — and its guard rails
//   delegations.mjs  one agent giving another a task
//   handoff.mjs      a portable summary of one session for another
//   routes.mjs       the HTTP surface
//
// This module assembles them around the shared context and is `ctx.harness`.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { JsonFile } from '../persist.mjs';
import { isLoopbackAddress } from '../config.mjs';
import { EV } from '../../core/contract.mjs';
import { createCatalog, MODES, MODE_LABEL } from './catalog.mjs';
import { createCredentials, SESSION_HEADER } from './credentials.mjs';
import { DrivenSession, SessionError } from './session.mjs';
import { readTranscriptFile } from './transcript.mjs';
import { createWake } from './wake.mjs';
import { createDelegations } from './delegations.mjs';
import { WAKE_MODES } from './settings.mjs';
import { line } from './normalize.mjs';

const KEEP_ENDED = 120;                 // how many finished sessions stay listed
const SESSION_ID = /^d_[a-f0-9]{12}$/;

export { SessionError };

export function createHarness(ctx, file) {
  const { cfg, bus, log } = ctx;
  const settings = cfg.harness;
  const dir = path.join(cfg.dataDir, 'harness');
  const catalog = createCatalog(cfg, log);
  const credentials = createCredentials();
  const store = new JsonFile(file, {
    defaults: () => ({ v: 1, wakePaused: false, sessions: {} }),
    validate: (d) => d && typeof d.sessions === 'object' && d.sessions !== null,
  });
  const sessions = new Map();           // id → DrivenSession, while it lives in this process
  const watchers = new Map();           // session id (or '*') → Set<ws client>

  // A daemon restart ends every agent it was driving: say so rather than list ghosts.
  for (const record of Object.values(store.data.sessions)) {
    if (record.state !== 'ended' && record.state !== 'failed') {
      record.state = 'ended';
      record.endedAt = record.endedAt || Date.now();
      record.reason = 'the office restarted';
    }
  }

  /* ---- telling clients ----------------------------------------------------- */

  const liveSessions = () => [...sessions.values()].filter((s) => s.live);

  function pubSession(session) {
    return { ...session.pub(), wakeStats: wake.stats(session) };
  }

  function pubRecord(record) {
    return { id: record.id, agentId: record.id, adapter: record.adapter, label: record.label, provider: record.provider,
      protocol: record.protocol, cwd: record.cwd, name: record.name || '', model: record.model || '', mode: record.mode,
      modeLabel: MODE_LABEL[record.mode], wake: record.wake, state: record.state, live: false,
      startedAt: record.startedAt, endedAt: record.endedAt || null, reason: record.reason || '', turns: record.turns || 0,
      origin: record.origin || { kind: 'human' }, caps: { observe: true, prompt: false, control: false, spawn: true },
      // All that is left to do with a finished session is read it.
      controls: { transcript: { method: 'GET', url: `/api/harness/sessions/${record.id}/transcript`, query: ['after', 'limit'] } } };
  }

  function snapshot() {
    return {
      sessions: liveSessions().map(pubSession),
      wake: { paused: wake.paused, limits: wake.limits() },
      delegations: { active: delegations.activeCount() },
    };
  }

  let stateTimer = null;
  function changed() {
    if (stateTimer) return;
    stateTimer = setTimeout(() => {
      stateTimer = null;
      bus.broadcast({ type: EV.HARNESS, ...snapshot() });
    }, 60);
    if (typeof stateTimer.unref === 'function') stateTimer.unref();
  }

  // Transcript entries go only to clients that asked to watch that session:
  // a streamed reply is many small messages, and most clients are looking elsewhere.
  function pushEntry(session, entry) {
    const frame = { type: EV.TRANSCRIPT, sessionId: session.id, agentId: session.id, entry };
    bus.local(frame);
    for (const key of [session.id, '*']) {
      for (const client of watchers.get(key) || []) client.send(frame);
    }
  }

  function onClientMessage(client, message) {
    if (!message || message.type !== 'transcript:watch') return;
    // A transcript is what a terminal would show — commands, paths, output — so it is watched
    // from this machine only, exactly like a terminal snapshot (unless the operator opened those).
    if (!cfg.remoteTerminals && !isLoopbackAddress(client.remote)) return;
    for (const set of watchers.values()) set.delete(client);
    const id = typeof message.sessionId === 'string' ? message.sessionId : '';
    if (!id || (id !== '*' && !SESSION_ID.test(id))) return;
    if (!watchers.has(id)) watchers.set(id, new Set());
    watchers.get(id).add(client);
  }

  function onClientGone(client) {
    for (const set of watchers.values()) set.delete(client);
  }

  /* ---- sessions ------------------------------------------------------------ */

  const wake = createWake({ ctx, settings: settings.wake, store, liveSessions, sessionOf: (agentId) => sessions.get(agentId) || null, changed });
  const delegations = createDelegations({ ctx, settings: settings.delegate, file: path.join(cfg.dataDir, 'delegations.json'), wake,
    harness: {
      catalog,
      session: (id) => sessions.get(id) || null,
      sessionOf: (agentId) => sessions.get(agentId) || null,
      resolve: (ref) => resolve(ref),
      hopOf: (agentId) => hopOf(agentId),
      create: (input, origin) => create(input, origin),
    } });

  function persist(session) {
    store.data.sessions[session.id] = session.record;
    const ended = Object.values(store.data.sessions).filter((r) => r.state === 'ended' || r.state === 'failed')
      .sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
    // The oldest finished sessions are forgotten, and their transcripts with them: the record does not grow for ever.
    for (const old of ended.slice(KEEP_ENDED)) {
      delete store.data.sessions[old.id];
      if (!SESSION_ID.test(old.id)) continue;                       // only ever a file name we made ourselves
      for (const suffix of ['.jsonl', '.jsonl.1', '.jsonl.2', '.trace.jsonl']) fs.rm(path.join(dir, old.id + suffix), { force: true }, () => {});
    }
    store.save();
  }

  // The office is full. An agent that was started for one delegated task, has
  // finished it and is only lingering in case someone has more for it, gives up
  // its seat — the one idle longest first. Nobody a human started is ever sent
  // home this way, and nobody with work in hand.
  function makeRoom() {
    const spare = liveSessions().filter((s) => !s.leaving && s.record.origin?.kind === 'delegation'
      && s.state === 'idle' && !s.turn && !s.queue.length && s.lastTurn)
      .sort((a, b) => a.lastTurn.endedAt - b.lastTurn.endedAt)[0];
    if (!spare) return false;
    spare.leaving = true;
    spare.end('its delegated work was done, and the office needed the seat').catch(() => {});
    return true;
  }

  /**
   * Create a driven session and start it in the background. Returns at once;
   * `session.ready` settles when the agent has answered (or failed to).
   */
  function create(input = {}, origin = { kind: 'human' }) {
    if (!settings.enabled) throw new SessionError(403, 'driven sessions are switched off on this office (OFFICE_HARNESS=0)');
    const spec = catalog.get(input.adapter);
    if (!spec) {
      throw new SessionError(404, `no adapter called "${input.adapter}". Known: ${catalog.list().map((a) => a.id).join(', ')}`);
    }
    if (!catalog.locate(spec)) {
      throw new SessionError(409, `${spec.label} cannot be started here: “${spec.command}” is not installed.${spec.note ? ' ' + spec.note : ''}`);
    }
    if (liveSessions().filter((s) => !s.leaving).length >= settings.maxSessions && !makeRoom()) {
      throw new SessionError(429, `the office is already driving ${settings.maxSessions} agents; end one first (OFFICE_HARNESS_MAX_SESSIONS)`);
    }
    const cwd = path.resolve(typeof input.cwd === 'string' && input.cwd.trim() ? input.cwd.trim() : process.cwd());
    let isDir = false;
    try { isDir = fs.statSync(cwd).isDirectory(); } catch { isDir = false; }
    if (!isDir) throw new SessionError(400, `no such folder: ${cwd}`);
    const mode = input.mode === undefined || input.mode === '' ? 'ask' : String(input.mode);
    if (!MODES.includes(mode)) throw new SessionError(400, `mode must be one of ${MODES.join(', ')}`);
    const wakeMode = input.wake === undefined || input.wake === '' ? settings.wake.default : String(input.wake);
    if (!WAKE_MODES.includes(wakeMode)) throw new SessionError(400, `wake must be one of ${WAKE_MODES.join(', ')}`);

    const id = `d_${crypto.randomBytes(6).toString('hex')}`;
    const record = {
      id, adapter: spec.id, label: spec.label, provider: spec.provider, protocol: spec.protocol, cwd,
      name: line(input.name, 32), handle: line(input.handle, 40), model: line(input.model, 200), task: line(input.task, 140),
      mode, wake: wakeMode, state: 'starting', startedAt: Date.now(), endedAt: null, reason: '', turns: 0,
      origin: { kind: origin.kind || 'human', ...(origin.by ? { by: line(origin.by, 60) } : {}),
        ...(origin.delegationId ? { delegationId: origin.delegationId } : {}) },
    };
    const token = credentials.issue({ sessionId: id, agentId: id });
    const session = new DrivenSession({ ctx, spec, record, token,
      files: { transcript: path.join(dir, `${id}.jsonl`), trace: path.join(dir, `${id}.trace.jsonl`) } });
    sessions.set(id, session);
    persist(session);

    session.transcript.onEntry((entry) => pushEntry(session, entry));
    session.on('changed', () => { persist(session); delegations.onChanged(session); changed(); });
    session.on('waiting', () => delegations.onChanged(session));
    session.on('turn-started', (turn) => {
      if (turn.origin === 'human') wake.renew(session);        // a human is supervising again
      delegations.onTurnStarted(session, turn);
    });
    session.on('turn-ended', (turn) => {
      delegations.onTurnEnded(session, turn);
      wake.onIdle(session);
    });
    session.on('ended', ({ state, reason }) => {
      credentials.revoke(id);
      delegations.onSessionEnded(session, { reason });
      wake.forget(session);
      persist(session);
      const name = session.pub().name || record.label;
      if (state === 'failed') ctx.activity.log('agent-crash', `${name}'s agent process ended unexpectedly: ${line(reason, 140)}`, { agentId: id });
      changed();
      // Keep the object a little while so late readers (a wait, a transcript poll) still find it.
      const t = setTimeout(() => { if (!session.live) sessions.delete(id); }, 10 * 60_000);
      if (typeof t.unref === 'function') t.unref();
    });

    session.ready = session.start().then(() => session);
    session.ready.catch(() => {});          // reported through the session's own state; callers may also await it
    changed();
    return session;
  }

  /** A session by its id, or by anything that names its agent. Live ones only. */
  function resolve(ref) {
    const key = String(ref || '').trim();
    if (!key) return null;
    if (sessions.has(key)) return sessions.get(key);
    const agent = ctx.agents.resolveRef(key);
    return agent ? sessions.get(agent.id) || null : null;
  }

  function list({ all } = {}) {
    const live = liveSessions().map(pubSession);
    if (!all) return live;
    const liveIds = new Set(live.map((s) => s.id));
    const ended = Object.values(store.data.sessions).filter((r) => !liveIds.has(r.id))
      .sort((a, b) => (b.endedAt || b.startedAt) - (a.endedAt || a.startedAt)).map(pubRecord);
    return [...live, ...ended];
  }

  /** One session, live or finished, as clients may see it. */
  function describe(ref) {
    const live = resolve(ref);
    if (live) return pubSession(live);
    const record = store.data.sessions[String(ref || '')];
    return record ? pubRecord(record) : null;
  }

  function transcript(ref, opt) {
    const live = resolve(ref);
    if (live) return { sessionId: live.id, ...live.transcript.read(opt) };
    const id = String(ref || '');
    if (!SESSION_ID.test(id) || !store.data.sessions[id]) return null;      // an id we issued, never a path from the wire
    return { sessionId: id, ...readTranscriptFile(path.join(dir, `${id}.jsonl`), opt) };
  }

  /** How many agent-to-agent steps from a human would something this agent sends now be? */
  function hopOf(agentId) {
    const session = sessions.get(agentId);
    // Not ours to know from a turn: one step past the mail it has just read, if any (server/inbox.mjs).
    if (!session?.live) return 1 + (ctx.inbox?.readHop(agentId) || 0);
    const turn = session.turn || session.lastTurn;
    return (turn ? turn.hop || 0 : 0) + 1;
  }

  /** The runtime facet of a driven agent, in the shape runtime-view.mjs uses for terminals. */
  function sessionForAgent(agentId) {
    const session = sessions.get(agentId);
    if (!session) return null;
    const r = session.record;
    return {
      id: session.id, name: r.name || r.label, cwd: r.cwd, requestedCwd: null, createdAt: r.startedAt, task: r.task || '',
      provider: r.provider, alive: session.live, observedOnly: false,
      runtimeId: `driven:${r.adapter}`, runtimeLabel: `${r.label} (driven)`, lane: 'driven', kind: 'driven',
      transport: session.adapter.kind, firstParty: true, experimental: false, utility: false,
      mode: r.mode, wake: r.wake, state: session.pub().state,
    };
  }

  /** The human speaking to a driven agent: that is a turn, delivered now (or queued behind the one running). */
  function deliverHumanNote(agent, content, { author } = {}) {
    const session = agent ? sessions.get(agent.id) : null;
    if (!session?.live) return null;
    try {
      const receipt = session.send(content, { origin: 'human', by: line(author, 60) || 'Lead' });
      return { session: sessionForAgent(agent.id), ...receipt };
    } catch (err) {
      log.warn(`[harness] could not deliver a note to ${agent.id}: ${err.message}`);
      return null;
    }
  }

  /** Who is calling: the driven session whose token the request carries, or nobody in particular. */
  function callerOf(req) {
    const token = req?.headers?.[SESSION_HEADER];
    const scope = typeof token === 'string' ? credentials.resolve(token) : null;
    if (!scope) return { agentId: null, verified: false, presented: typeof token === 'string' && token.length > 0 };
    return { agentId: scope.agentId, sessionId: scope.sessionId, verified: true, presented: true };
  }

  async function stop() {
    if (stateTimer) clearTimeout(stateTimer);
    // Sessions first: each one's ending settles the task it was doing, and that has to reach the disk too.
    await Promise.allSettled(liveSessions().map((s) => s.end('the office is shutting down')));
    delegations.stop();
    store.flush();
  }

  return {
    settings, catalog, wake, delegations,
    create, resolve, list, describe, transcript, snapshot,
    session: (id) => sessions.get(id) || null,
    sessionForAgent, deliverHumanNote, hopOf, callerOf,
    isDriven: (agentId) => !!sessions.get(agentId)?.live,
    /** Will mail to this agent start a turn for it (rather than wait to be read)? */
    willWake: (agentId) => { const s = sessions.get(agentId); return !!s?.live && s.record.wake === 'direct' && !wake.paused; },
    onClientMessage, onClientGone, stop,
    liveCount: () => liveSessions().length,
  };
}
