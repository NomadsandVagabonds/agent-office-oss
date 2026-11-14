// The Office — harness: one agent giving work to another.
//
// This is the collaboration the office exists for: an agent — on any provider,
// however it got in — asks the office to put a task in front of another agent,
// on a provider of its choosing. The office starts that agent (it gets a desk
// like anyone else) or hands the task to one that is already here, and the
// delegator can wait for the result, look in on it, or cancel it. The result
// comes back durably: it is kept here, it is in the delegate's transcript, and
// it is mailed to the delegator — which, for a driven delegator that opted in,
// starts its next turn.
//
// The shape follows T3 Code's orchestrator tools (delegate_task / task_status /
// task_cancel; docs/orchestration-v2/orchestrator-mcp-server.md), and so do the
// rules worth keeping:
//   - the delegate receives the task, not the delegator's history (a handoff
//     summary is added only when one is asked for, and is recorded as such);
//   - a delegate never runs with broader permissions than its delegator, nor
//     than the ceiling the operator set for delegated work (default: it asks);
//   - a delegate finishing never finishes its delegator's own work — the two
//     are separate turns in separate transcripts, joined only by this record;
//   - waiting never cancels, and a pending approval ends a wait but grants the
//     delegator no right to answer it — approvals go to the human.
// Agent-initiated delegation is an automatic turn, so it passes the same gate
// as wake-on-mail (pause switch, hop limit, rates).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { JsonFile } from '../persist.mjs';
import { EV } from '../../core/contract.mjs';
import { SessionError } from './session.mjs';
import { MODES, MODE_RANK } from './catalog.mjs';
import { buildHandoff, compact } from './handoff.mjs';
import { text as cleanText, line } from './normalize.mjs';

const KEEP = 300;
const HOUR = 3_600_000;
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const ROLES = Object.freeze(['implementation', 'research', 'review', 'design', 'test', 'general']);
const MAX_TASK_CHARS = 60_000;

const narrower = (a, b) => (MODE_RANK[a] <= MODE_RANK[b] ? a : b);

export function createDelegations({ ctx, settings, file, harness, wake }) {
  const { bus } = ctx;
  const store = new JsonFile(file, {
    defaults: () => ({ v: 1, delegations: [] }),
    validate: (d) => d && Array.isArray(d.delegations),
  });
  const byId = new Map(store.data.delegations.map((d) => [d.id, d]));
  const waiters = new Map();             // delegation id → Set<() => void>
  const idleTimers = new Map();          // session id → timer that sends an idle delegate home

  // Whatever was in flight when the daemon stopped did not survive it.
  for (const d of byId.values()) {
    if (!TERMINAL.has(d.status)) { d.status = 'failed'; d.error = 'the office restarted before this finished'; d.endedAt = d.endedAt || Date.now(); }
  }

  function save(d) {
    d.updatedAt = Date.now();
    if (!byId.has(d.id)) { byId.set(d.id, d); store.data.delegations.push(d); }
    if (store.data.delegations.length > KEEP) {
      for (const old of store.data.delegations.splice(0, store.data.delegations.length - KEEP)) byId.delete(old.id);
    }
    store.save();
    bus.broadcast({ type: EV.DELEGATIONS, delegation: view(d) });
    for (const wakeUp of waiters.get(d.id) || []) wakeUp();
  }

  function pendingApproval(d) {
    const session = harness.session(d.to.sessionId);
    if (!session?.live || session.turn?.delegationId !== d.id) return null;
    const first = session.pub().pending[0];
    return first ? { promptId: first.promptId, kind: first.kind, title: first.title } : null;
  }

  function nextHint(d) {
    if (TERMINAL.has(d.status)) return undefined;
    const delegator = d.from.kind === 'agent' ? harness.sessionOf(d.from.agentId) : null;
    if (delegator?.live && delegator.record.wake !== 'off') {
      return 'The result will be delivered to you as a new turn when it is ready. Do not wait on it or poll it: finish what you can and end your turn.';
    }
    return d.from.kind === 'agent'
      ? `The result will arrive in your office inbox. Carry on, and check later (office delegation ${d.id}), or wait for it (office delegation ${d.id} --wait).`
      : `Follow it in the delegate's transcript; the result is kept on this record.`;
  }

  /** What anyone may see of a delegation. `task` is the brief as given. */
  function view(d, extra = {}) {
    const approval = !TERMINAL.has(d.status) ? pendingApproval(d) : null;
    return {
      id: d.id, title: d.title, role: d.role, status: approval ? 'waiting' : d.status,
      from: d.from, to: d.to, hop: d.hop, mode: d.mode, parentId: d.parentId || null,
      task: d.task, handoff: d.handoff || null,
      createdAt: d.createdAt, startedAt: d.startedAt || null, endedAt: d.endedAt || null,
      result: d.result ?? null, resultTruncated: !!d.resultTruncated, error: d.error || null,
      // Told so the delegator can say "it is waiting on the human" — it cannot answer this itself.
      pendingApproval: approval,
      delivered: d.delivered || null, waitTimedOut: false,
      ...(nextHint(d) ? { next: nextHint(d) } : {}), ...extra,
    };
  }

  function taskPrompt(d, handoffText) {
    const role = d.role && d.role !== 'general' ? `Act as the ${d.role} agent for this task.\n\n` : '';
    return `${handoffText ? handoffText + '\n\n' : ''}<delegated_task id="${d.id}" from="${compact(d.from.name, 60)}">\n${role}${d.task}\n</delegated_task>\n\n`
      + `This task was given to you by ${d.from.name} through the office. Do the work yourself, and do not hand it on to other agents unless the task says to. `
      + `When you are done, end your turn with the result: your final message is returned to ${d.from.name}.`;
  }

  function resolveCwd(requested, fallback, { confineTo } = {}) {
    const dir = path.resolve(requested || fallback || process.cwd());
    let ok = false;
    try { ok = fs.statSync(dir).isDirectory(); } catch { ok = false; }
    if (!ok) throw new SessionError(400, `no such folder: ${dir}`);
    if (confineTo) {
      const rel = path.relative(path.resolve(confineTo), dir);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new SessionError(403, 'an agent may only delegate work inside its own folder');
      }
    }
    return dir;
  }

  // Nobody named a provider: choose among the agents that can be started here,
  // following whoever keeps count of the operator's allowance (ctx.usage, when
  // it exists): never a provider that is spent, the one with the most left when
  // the difference is worth acting on, and one that is not running low over one
  // that is. Without that advice it is simply the first agent available.
  function pickAdapter() {
    const available = harness.catalog.list().filter((a) => a.available);
    if (!available.length) throw new SessionError(409, 'no agent can be started here: none of the known adapters is installed (GET /api/harness)');
    let advice = null;
    try { advice = ctx.usage?.advice?.() || null; } catch { advice = null; }
    const names = (list) => new Set(Array.isArray(list) ? list.filter((p) => typeof p === 'string') : []);
    const low = names(advice?.low), out = names(advice?.out);
    const usable = available.filter((a) => !out.has(a.provider));
    if (!usable.length) {
      throw new SessionError(409, `every provider that can be started here is out of allowance for now (${[...out].join(', ')}); name one explicitly if you want to try anyway`);
    }
    const preferred = typeof advice?.prefer === 'string' ? usable.find((a) => a.provider === advice.prefer) : null;
    const chosen = preferred || usable.find((a) => !low.has(a.provider)) || usable[0];
    const passedOver = [...out, ...low].filter((p) => p !== chosen.provider);
    const why = preferred ? `${chosen.provider} has the most allowance left`
      : passedOver.length && available.some((a) => passedOver.includes(a.provider)) ? `${passedOver.join(', ')} ${passedOver.length === 1 ? 'is' : 'are'} spent or running low`
        : 'the first agent that can be started here';
    return { adapter: harness.catalog.get(chosen.id), why };
  }

  function scheduleIdleEnd(session) {
    clearTimeout(idleTimers.get(session.id));
    idleTimers.delete(session.id);
    if (!settings.idleEndMs || session.record.origin?.kind !== 'delegation' || !session.live) return;
    const timer = setTimeout(() => {
      idleTimers.delete(session.id);
      if (!session.live || session.turn || session.queue.length) return;
      session.end('its delegated work was done and nobody had more for it').catch(() => {});
    }, settings.idleEndMs);
    if (typeof timer.unref === 'function') timer.unref();
    idleTimers.set(session.id, timer);
  }

  /**
   * Start a delegation.
   * @param {object} body  { to?, task, title?, role?, model?, mode?, cwd?, name?, clientRequestId?, context?:{session?, turns?} }
   *                       `to` is an adapter or an agent already here; left out, the office chooses (see pickAdapter)
   * @param {{agentId?:string, verified?:boolean}} caller  who is asking; empty means the human
   */
  function request(body = {}, caller = {}) {
    if (!settings.enabled) throw new SessionError(403, 'delegation is switched off on this office (OFFICE_DELEGATE=0)');
    const fromAgent = caller.agentId ? ctx.agents.get(caller.agentId) : null;
    if (caller.agentId && !fromAgent) throw new SessionError(404, 'the delegating agent is not in the office');
    const byAgent = !!fromAgent;
    const task = typeof body.task === 'string' ? body.task.replace(/\u0000/g, '').trim() : '';
    if (!task) throw new SessionError(400, 'a delegation needs a task: say what the other agent should do');
    if (task.length > MAX_TASK_CHARS) throw new SessionError(413, `a task is at most ${MAX_TASK_CHARS} characters`);
    const clientRequestId = typeof body.clientRequestId === 'string' ? body.clientRequestId.slice(0, 200) : '';
    if (clientRequestId) {
      // The same call made twice is the same piece of work.
      const again = [...byId.values()].find((d) => d.clientRequestId === clientRequestId && (d.from.agentId || '') === (fromAgent?.id || ''));
      if (again) return view(again, { duplicate: true });
    }

    const delegator = byAgent ? harness.sessionOf(fromAgent.id) : null;
    // Steps away from a human: a human's own request is 0, an agent's is one past the turn it is in.
    const hop = byAgent ? harness.hopOf(fromAgent.id) : 0;
    const parent = delegator?.turn?.delegationId || null;

    let targetRef = String(body.to || '').trim();
    let adapter = null, existing = null, chosenBecause = '';
    if (!targetRef) ({ adapter, why: chosenBecause } = pickAdapter());
    else if (targetRef.startsWith('agent:')) targetRef = targetRef.slice(6);
    else adapter = harness.catalog.get(targetRef.replace(/^adapter:/, ''));
    if (!adapter) {
      const agent = ctx.agents.resolveRef(targetRef);
      existing = agent ? harness.sessionOf(agent.id) : null;
      if (!existing?.live) {
        const adapters = harness.catalog.list().filter((a) => a.available).map((a) => a.id);
        throw new SessionError(404, agent
          ? `${agent.name} is not driven by the office, so the office cannot give it a turn. Send a note instead (office dm).`
          : `no adapter or driven agent called "${targetRef}". Adapters available here: ${adapters.join(', ') || 'none installed'}.`);
      }
      if (fromAgent && existing.id === fromAgent.id) throw new SessionError(400, 'you cannot delegate to yourself');
    }

    if (byAgent) {
      // An agent starting work on another agent is an automatic turn: same gate as wake-on-mail.
      const verdict = wake.allow(existing, hop);
      if (!verdict.ok) throw new SessionError(verdict.reason === 'paused' ? 423 : 429, `the office will not start this by itself: ${verdict.text}`);
      const now = Date.now();
      const mine = [...byId.values()].filter((d) => d.from.agentId === fromAgent.id);
      if (mine.filter((d) => now - d.createdAt < HOUR).length >= settings.maxPerHour) {
        throw new SessionError(429, `you have delegated ${settings.maxPerHour} tasks this hour; that is the limit`);
      }
      if (mine.filter((d) => !TERMINAL.has(d.status)).length >= settings.maxActive) {
        throw new SessionError(429, `you already have ${settings.maxActive} delegated tasks running; wait for one or cancel one`);
      }
    }

    // Permissions: never broader than the delegator's own, nor than the operator's ceiling for delegated work.
    const requested = MODES.includes(body.mode) ? body.mode : null;
    let mode;
    if (byAgent) {
      const ceiling = delegator ? narrower(settings.maxMode, delegator.mode) : settings.maxMode;
      if (requested && MODE_RANK[requested] > MODE_RANK[ceiling]) {
        throw new SessionError(403, `mode "${requested}" is broader than a task you delegate may run with (at most "${ceiling}")`);
      }
      mode = requested || ceiling;
      if (existing && MODE_RANK[existing.mode] > MODE_RANK[ceiling]) {
        throw new SessionError(403, `${existing.pub().name} runs with broader permissions ("${existing.mode}") than a task you delegate may use ("${ceiling}")`);
      }
    } else {
      mode = requested || 'ask';
    }
    if (existing) mode = existing.mode;

    let handoff = null, handoffText = '';
    if (body.context) {
      // A summary of another session's work, added on request and recorded as an artifact on both sides.
      const sourceRef = body.context === true || !body.context.session ? fromAgent?.id : body.context.session;
      const source = sourceRef ? harness.resolve(sourceRef) : null;
      if (!source) throw new SessionError(400, 'context can only be handed over from a session the office drives (it needs a transcript)');
      const built = buildHandoff(source.transcript.read({ limit: 1000 }).entries, {
        from: source.pub().name, provider: source.record.provider, sessionId: source.id,
        turns: Number(body.context.turns) > 0 ? Math.min(50, Number(body.context.turns)) : 0,
      });
      handoffText = built.text;
      handoff = { fromSessionId: source.id, fromName: source.pub().name, items: built.items, omitted: built.omitted, turns: built.turns };
    }

    const d = {
      id: `dg_${crypto.randomBytes(5).toString('hex')}`,
      title: line(body.title, 120) || compact(task.split('\n')[0], 80),
      role: ROLES.includes(body.role) ? body.role : 'general',
      task: cleanText(task, MAX_TASK_CHARS), status: 'queued', hop, mode, parentId: parent,
      clientRequestId: clientRequestId || null, handoff,
      from: byAgent
        ? { kind: 'agent', agentId: fromAgent.id, name: fromAgent.name, provider: fromAgent.provider || '', verified: !!caller.verified }
        : { kind: 'human', agentId: null, name: 'Lead' },
      to: null, createdAt: Date.now(),
    };

    let session = existing;
    if (!session) {
      const cwd = resolveCwd(body.cwd, fromAgent?.cwd, byAgent ? { confineTo: fromAgent.cwd || process.cwd() } : {});
      session = harness.create({ adapter: adapter.id, cwd, name: body.name, model: body.model, mode, wake: 'off', task: d.title },
        { kind: 'delegation', by: d.from.name, delegationId: d.id });
    }
    d.to = { agentId: session.id, sessionId: session.id, adapter: session.record.adapter, provider: session.record.provider,
      name: session.pub().name, started: !existing, ...(chosenBecause ? { chosenBecause } : {}) };
    save(d);

    const prompt = taskPrompt(d, handoffText);
    if (handoff) {
      session.transcript.write({ id: `handoff:${d.id}`, kind: 'handoff', direction: 'in', delegationId: d.id, ...handoff, text: handoffText });
      harness.resolve(handoff.fromSessionId)?.transcript.write({ id: `handoff:${d.id}`, kind: 'handoff', direction: 'out',
        delegationId: d.id, toName: d.to.name, items: handoff.items, omitted: handoff.omitted, turns: handoff.turns });
    }
    session.send(prompt, { origin: 'delegation', by: d.from.name, from: d.from.name, hop, delegationId: d.id, display: prompt,
      onDropped: (why) => finish(d, 'cancelled', { error: why }) });
    if (byAgent) wake.spend(session);
    ctx.activity.log('delegation', `${d.from.name} gave ${d.to.name} a task: ${compact(d.title, 70)}`,
      { agentId: d.from.agentId, toAgentId: d.to.agentId, delegationId: d.id, hop });
    return view(d);
  }

  function finish(d, status, { result, error, quiet } = {}) {
    if (TERMINAL.has(d.status)) return;
    d.status = status;
    d.endedAt = Date.now();
    if (typeof result === 'string' && result.trim()) {
      d.resultTruncated = result.length > settings.resultChars;
      d.result = cleanText(result, settings.resultChars);
    }
    if (error) d.error = cleanText(error, 600);
    // Whoever cancelled their own task does not need a letter telling them so.
    if (quiet) d.delivered = { at: Date.now(), how: 'not mailed: the delegator cancelled it' };
    else deliver(d);
    save(d);
  }

  // The result goes back as mail from the delegate, so it is in the delegator's
  // inbox whatever kind of agent it is — and wakes it if it is driven and opted in.
  function deliver(d) {
    const child = ctx.agents.get(d.to.agentId);
    const body = [`[Delegated task ${d.id} · ${d.status}] ${d.title}`, '',
      d.result || (d.error ? `It did not finish: ${d.error}` : '(it ended without a written result)'),
      d.resultTruncated ? '\n(The result was long and is cut here.)' : '',
      `\nFull timeline: office transcript ${d.to.agentId}`].filter((s) => s !== '').join('\n');
    if (!child) { d.delivered = { at: Date.now(), how: 'kept on the record only: the delegate had already left' }; return; }
    const toRef = d.from.kind === 'agent' ? d.from.agentId : 'lead';
    if (d.from.kind === 'agent' && !ctx.agents.get(toRef)) {
      d.delivered = { at: Date.now(), how: 'kept on the record only: the delegator has left the office' };
      return;
    }
    // A result returning to whoever asked is the same exchange, not a step further from the human.
    const sent = ctx.comms.sendCollabMessage({ fromAgentId: child.id, toAgentId: toRef, content: body }, { hop: d.hop, delegationId: d.id });
    d.delivered = sent?.ok ? { at: Date.now(), how: d.from.kind === 'agent' ? 'mailed to the delegator' : 'sent to the human' }
      : { at: Date.now(), how: `kept on the record only: ${sent?.error || 'mail failed'}` };
  }

  function forSessionTurn(session, turn) {
    return turn?.delegationId ? byId.get(turn.delegationId) : null;
  }

  function cancel(id, caller = {}, reason = '') {
    const d = byId.get(id);
    if (!d) throw new SessionError(404, 'no such delegation');
    // The human may cancel anything; an agent only what it delegated itself.
    if (caller.agentId && d.from.agentId !== caller.agentId) throw new SessionError(403, 'only the agent that delegated a task (or the human) can cancel it');
    if (TERMINAL.has(d.status)) return view(d);
    const by = caller.agentId ? (ctx.agents.get(caller.agentId)?.name || 'the delegator') : 'the human';
    // Depth first: whatever this task delegated in turn stops before it does.
    for (const child of byId.values()) if (child.parentId === d.id && !TERMINAL.has(child.status)) cancel(child.id, {}, `its parent task ${d.id} was cancelled`);
    d.cancelledBy = by;
    const session = harness.session(d.to.sessionId);
    const partial = session?.turn?.delegationId === d.id ? session.turn.text : '';
    finish(d, 'cancelled', { result: partial, error: line(reason, 300) || `cancelled by ${by}`,
      quiet: !!caller.agentId || d.from.kind === 'human' });
    session?.cancelDelegation(d.id, by);
    return view(d);
  }

  /** Wait until the task is finished, needs the human, or the time is up. Waiting never cancels. */
  function wait(id, timeoutMs) {
    const d = byId.get(id);
    if (!d) return Promise.reject(new SessionError(404, 'no such delegation'));
    const settled = () => TERMINAL.has(d.status) || !!pendingApproval(d);
    if (settled()) return Promise.resolve(view(d));
    const cap = Math.max(100, Math.min(settings.waitCapMs, Number(timeoutMs) || 30_000));
    return new Promise((resolve) => {
      const set = waiters.get(id) || new Set();
      waiters.set(id, set);
      const done = (timedOut) => {
        clearTimeout(timer);
        set.delete(check);
        if (!set.size) waiters.delete(id);
        resolve(view(d, timedOut ? { waitTimedOut: true } : {}));
      };
      const check = () => { if (settled()) done(false); };
      const timer = setTimeout(() => done(true), cap);
      if (typeof timer.unref === 'function') timer.unref();
      set.add(check);
    });
  }

  return {
    request, cancel, wait, view,
    get: (id) => byId.get(id) || null,
    list({ from, to, status, limit } = {}) {
      let out = [...byId.values()];
      if (from) out = out.filter((d) => d.from.agentId === from);
      if (to) out = out.filter((d) => d.to?.agentId === to);
      if (status === 'active') out = out.filter((d) => !TERMINAL.has(d.status));
      else if (status) out = out.filter((d) => d.status === status);
      return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, Math.max(1, Math.min(200, Number(limit) || 50))).map((d) => view(d));
    },
    activeCount: () => [...byId.values()].filter((d) => !TERMINAL.has(d.status)).length,

    /* ---- what sessions tell us ---------------------------------------------- */
    onTurnStarted(session, turn) {
      clearTimeout(idleTimers.get(session.id));
      idleTimers.delete(session.id);
      const d = forSessionTurn(session, turn);
      if (d && d.status === 'queued') { d.status = 'running'; d.startedAt = Date.now(); save(d); }
    },
    onTurnEnded(session, turn) {
      const d = forSessionTurn(session, turn);
      if (d) {
        // "interrupted" alone tells a delegator nothing: say who stopped it, or that its agent was sent home.
        const why = turn.error || (turn.status !== 'interrupted' ? ''
          : turn.ending ? `the agent's session was ended (${turn.ending})` : `stopped by ${turn.stoppedBy || 'the human'}`);
        finish(d, turn.status === 'completed' ? 'completed' : turn.status === 'interrupted' ? 'interrupted' : 'failed',
          { result: turn.text, error: why });
      }
      scheduleIdleEnd(session);
    },
    /** A delegate started or stopped waiting on the human: anyone waiting on the task should hear. */
    onChanged(session) {
      const d = session.turn?.delegationId ? byId.get(session.turn.delegationId) : null;
      if (d && !TERMINAL.has(d.status)) {
        bus.broadcast({ type: EV.DELEGATIONS, delegation: view(d) });
        for (const wakeUp of waiters.get(d.id) || []) wakeUp();
      }
    },
    onSessionEnded(session, { reason } = {}) {
      clearTimeout(idleTimers.get(session.id));
      idleTimers.delete(session.id);
      for (const d of byId.values()) {
        if (d.to?.sessionId === session.id && !TERMINAL.has(d.status)) finish(d, 'failed', { error: `the agent's session ended: ${reason || 'it is gone'}` });
      }
    },
    stop() {
      for (const timer of idleTimers.values()) clearTimeout(timer);
      idleTimers.clear();
      store.flush();
    },
  };
}
