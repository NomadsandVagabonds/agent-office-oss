// The Office — the runtime facet of a Session, as clients are allowed to see
// it. Everything here is capability-honest: what a client may render is derived
// from core/contract.mjs CAPS, never assumed.
import { capabilityFor, promptActions } from '../core/contract.mjs';

const NO_RUNTIME_CAPS = Object.freeze({ observe: false, prompt: false, control: false, spawn: false });

/**
 * @param {{runtimes:object, codexObserver:()=>object, harness?:()=>object|null}} deps
 *   `harness` is looked up late: the harness is assembled after this view.
 */
export function createRuntimeView({ runtimes, codexObserver, harness = () => null }) {
  function snapshot(ref) {
    if (!ref) return null;
    try {
      const session = runtimes.getSession(ref);
      return session && session.kind === 'terminal' ? session : null;
    } catch {
      return null;
    }
  }

  function liveRef(ref) {
    const session = snapshot(ref);
    return session && session.alive ? session : null;
  }

  // A Codex thread we only observe still has a mailbox (the observer companion).
  function observedCodexInbox(agent) {
    if (!agent || !agent.id || !codexObserver().running) return null;
    if ((agent.provider || '').toLowerCase() !== 'codex') return null;
    return {
      id: agent.id,
      runtimeId: 'observed',
      provider: 'codex',
      runtimeLabel: 'Codex observed thread',
      kind: 'observed',
      transport: 'thread-store',
      lane: 'first-party',
      alive: true,
      observedOnly: true,
      firstParty: true,
      experimental: false,
      utility: false,
      cwd: agent.cwd || '',
      requestedCwd: agent.cwd || '',
    };
  }

  function sessionForSummary(agent, opt = {}) {
    if (!agent) return null;
    // A session the office drives is its own runtime; no terminal stands behind it.
    const driven = harness()?.sessionForAgent(agent.id);
    if (driven) return driven;
    return snapshot(opt.runtimeSessionId || opt.targetSession || opt.sessionId || null)
      || snapshot(agent.runtimeSessionId || null)
      || observedCodexInbox(agent);
  }

  function summaryFromSession(session) {
    if (!session) {
      return {
        sessionId: null, runtimeId: null, provider: null, runtimeLabel: null,
        kind: null, transport: null, lane: null,
        live: false, managed: false, observedOnly: false,
        firstParty: false, experimental: false, utility: false,
        caps: { ...NO_RUNTIME_CAPS },
        promptActions: [],
      };
    }
    // Capability follows how the session is run: a driven session can be
    // granted, denied and stopped; the same provider in a terminal is a relay.
    const caps = capabilityFor(session);
    const driven = session.kind === 'driven';
    return {
      sessionId: session.id,
      runtimeId: session.runtimeId || null,
      provider: session.provider || null,
      runtimeLabel: session.runtimeLabel || null,
      kind: session.kind || null,
      transport: session.transport || null,
      lane: session.lane || null,
      live: !!session.alive,
      managed: !!session.runtimeId && session.runtimeId !== 'observed' && !session.observedOnly,
      observedOnly: !!session.observedOnly || session.runtimeId === 'observed',
      firstParty: !!session.firstParty,
      experimental: !!session.experimental,
      utility: !!session.utility,
      caps: { ...caps },
      // For a driven session the grant/deny actions belong to each request it is
      // waiting on (see prompts.mjs), never to the session as a whole.
      promptActions: !session.alive ? [] : driven ? ['reply'] : promptActions(session.provider),
      driven,
      // Where a client finds this session's transcript and controls (GET it: the answer lists them).
      ...(driven ? { mode: session.mode, wake: session.wake, state: session.state,
        links: { session: `/api/harness/sessions/${session.id}`, transcript: `/api/harness/sessions/${session.id}/transcript` } } : {}),
    };
  }

  function summaryForAgent(agent, opt = {}) {
    return summaryFromSession(sessionForSummary(agent, opt));
  }

  /** The live managed terminal that is provably this agent's (never a cwd guess). */
  function strictSession(agent, opt = {}) {
    if (!agent) return null;
    return liveRef(opt.runtimeSessionId || opt.targetSession || opt.sessionId || null)
      || liveRef(agent.runtimeSessionId || null);
  }

  function asyncInboxSession(agent, opt = {}) {
    return strictSession(agent, opt) || observedCodexInbox(agent);
  }

  function anySession(agent, opt = {}) {
    const strict = strictSession(agent, opt);
    if (strict) return strict;
    if (opt.strict) return null;
    return runtimes.findUniqueSessionByCwd(agent.cwd);
  }

  function deliveryMode(session) {
    if (!session) return null;
    const caps = capabilityFor(session);
    if (caps.control === true) return 'delivered';
    if (caps.prompt) return 'relayed';
    return null;
  }

  function supportsAsyncInbox(session) {
    if (!session || !session.alive) return false;
    if ((session.provider || '').toLowerCase() !== 'codex') return false;
    if (session.kind !== 'terminal' && !(session.observedOnly || session.kind === 'observed')) return false;
    return !!codexObserver().running;
  }

  /** What actually happened to a message: stored / queued / relayed / delivered. */
  function receipt(opt = {}) {
    const stored = !!opt.stored;
    const targetSessions = (Array.isArray(opt.targetSessions) ? opt.targetSessions : []).filter(Boolean);
    const queuedSessions = (Array.isArray(opt.queuedSessions) ? opt.queuedSessions : []).filter(Boolean);
    const deliveredSessionIds = [];
    const relayedSessionIds = [];
    for (const session of targetSessions) {
      const mode = deliveryMode(session);
      if (mode === 'delivered') deliveredSessionIds.push(session.id);
      else if (mode === 'relayed') relayedSessionIds.push(session.id);
    }
    const queuedSessionIds = queuedSessions.map((session) => session.id);
    const queued = !!opt.queued || queuedSessionIds.length > 0;
    let status = 'stored';
    if (deliveredSessionIds.length) status = 'delivered';
    else if (relayedSessionIds.length) status = 'relayed';
    else if (queued) status = 'queued';
    return {
      status, stored, queued,
      delivered: deliveredSessionIds.length > 0,
      relayed: relayedSessionIds.length > 0,
      targetSessionIds: targetSessions.map((session) => session.id),
      deliveredSessionIds, relayedSessionIds, queuedSessionIds,
      deliveredCount: deliveredSessionIds.length,
      relayedCount: relayedSessionIds.length,
      queuedCount: queuedSessionIds.length,
    };
  }

  function promptReplyActions(prompt, runtime) {
    const actions = new Set();
    if (prompt?.threadId || runtime?.live) actions.add('reply');
    for (const action of runtime?.promptActions || []) actions.add(action);
    return [...actions];
  }

  return {
    snapshot, liveRef, summaryFromSession, summaryForAgent, strictSession,
    asyncInboxSession, anySession, supportsAsyncInbox, receipt, promptReplyActions,
  };
}

function shellQuoteArg(value) {
  return `'${String(value ?? '').replace(/'/g, `'\\''`)}'`;
}

/** Agents get the text; a bare shell gets a harmless printf of it. */
export function relayPayloadForSession(session, text) {
  const provider = (session?.provider || '').toLowerCase();
  if (provider && provider !== 'shell' && provider !== 'unknown') return text;
  const lines = String(text ?? '').replace(/\r/g, '').split('\n');
  return `printf '%s\\n' ${lines.map((line) => shellQuoteArg(line)).join(' ')}`;
}
