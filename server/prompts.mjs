// The Office — PermissionRequests: the "NEEDS YOU" objects.
// agent blocked → prompt opened (+ a help thread on the board) → surfaced to
// the human → reply relayed to the board and, when the runtime allows, typed
// into the agent's terminal → resolved.
//
// A session the office drives itself (server/harness) adds a second kind: a
// prompt backed by a request the agent is actually waiting on. Its buttons —
// allow once, allow for the session, reject — are real: answering resolves the
// agent's request over its protocol. Such a prompt carries `request`; the
// actions it offers come from that request and from nowhere else.
import crypto from 'node:crypto';
import { classifyBlock, requestActions } from '../core/contract.mjs';

const KEEP_RESOLVED = 40;          // resolved prompts kept around for context

export function createPrompts(ctx) {
  const { bus, bbs, runtimes, runtimeView } = ctx;
  const prompts = new Map();
  const promptByAgent = new Map();
  const requestThreadByAgent = new Map();

  function pub(p) {
    const agent = ctx.agents.get(p.agentId);
    const runtime = runtimeView.summaryForAgent(agent, {
      runtimeSessionId: p.terminalSessionId,
    });
    return {
      id: p.id,
      agentId: p.agentId,
      agentName: p.agentName,
      cwd: p.cwd,
      task: p.task,
      message: p.message,
      kind: p.kind || 'question',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      resolvedAt: p.resolvedAt || null,
      resolution: p.resolution || null,
      status: p.status,
      threadId: p.threadId || null,
      terminalSessionId: p.terminalSessionId || null,
      provider: runtime.provider || agent?.provider || null,
      runtime,
      // Backed by a live request: exactly the answers that request offers (a
      // question is answered in words). Otherwise: what the runtime can honour
      // (a reply, at most). `respond` below spells each one out.
      actions: p.request
        ? (p.status !== 'pending' ? [] : p.request.kind === 'question' ? ['reply'] : requestActions(p.request))
        : runtimeView.promptReplyActions(p, runtime),
      request: p.request || null,
      // The same two things for every prompt, whatever stands behind it, so a
      // client needs no knowledge of runtimes: what is being asked, as plain
      // fields, and every way to answer it with the exact call to make.
      ask: askOf(p),
      respond: respondOf(p, runtime),
    };
  }

  function askOf(p) {
    const r = p.request;
    return {
      summary: String(p.message || '').split('\n')[0],
      tool: r?.tool || '', toolKind: r?.toolKind || '',
      command: r?.command || '', files: r?.paths || [], detail: r?.detail || '',
      // what "allow for the session" would cover, when that is on offer
      category: r && r.kind === 'permission' ? r.category : '',
      questions: r?.questions || [],
    };
  }

  const ACTION_KIND = Object.freeze({ once: 'allow-once', always: 'allow-session', reject: 'reject' });

  function respondOf(p, runtime) {
    const how = { method: 'POST', url: `/api/prompts/${p.id}/reply`, textField: 'text' };
    if (p.status !== 'pending') return { ...how, actions: [], reaches: null };
    if (p.request) {
      // Backed by a request the agent is waiting on: answering it answers the agent, over its protocol.
      const actions = p.request.kind === 'question'
        ? [{ id: 'answer', kind: 'answer', label: 'Answer', text: 'required', body: {} },
          { id: 'reject', kind: 'decline', label: 'Decline to answer', text: 'none', body: { action: 'reject' } }]
        : (p.request.choices || []).map((c) => ({ id: c.action, kind: ACTION_KIND[c.action] || c.action, label: c.label,
          // words sent with a decision follow as the agent's next turn; words alone are refused
          text: 'optional', body: { action: c.action }, ...(c.scope ? { scope: c.scope, covers: p.request.category } : {}) }));
      return { ...how, actions, reaches: 'agent', humanOnly: true, thisMachineOnly: true };
    }
    // An agent that reported itself blocked: all the office can do is carry words to it.
    const agent = ctx.agents.get(p.agentId);
    const reaches = ctx.harness?.isDriven(p.agentId) ? 'turn'
      : (runtimeView.liveRef(p.terminalSessionId) || runtimeView.strictSession(agent)) ? 'terminal' : 'inbox';
    const canReply = runtimeView.promptReplyActions(p, runtime).includes('reply');
    return { ...how, reaches, actions: [
      ...(canReply ? [{ id: 'reply', kind: 'reply', label: 'Reply', text: 'required', body: {} }] : []),
      { id: 'dismiss', kind: 'dismiss', label: 'Dismiss', text: 'none', body: { text: '', close: true } },
    ] };
  }

  const listPublic = () => [...prompts.values()].map(pub).sort((a, b) => b.updatedAt - a.updatedAt);

  function prune() {
    const resolved = [...prompts.values()].filter((p) => p.status === 'resolved')
      .sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0));
    for (const stale of resolved.slice(KEEP_RESOLVED)) prompts.delete(stale.id);
  }

  function broadcast() {
    prune();
    bus.broadcast({ type: 'prompts', prompts: listPublic() });
    ctx.comms.broadcastOverview();
  }

  function helpThreadContent(a, message) {
    return [
      message,
      a.task ? `Task: ${a.task}` : '',
      a.cwd ? `Workspace: ${a.cwd}` : '',
    ].filter(Boolean).join('\n');
  }

  function postHelpRequest(id, message) {
    const a = ctx.agents.get(id);
    if (!a || !message) return null;
    const content = helpThreadContent(a, message);
    const threadId = requestThreadByAgent.get(id);
    if (threadId && bbs.getThread(threadId)) {
      bbs.reply({ threadId, author: a.name, authorType: 'agent', content });
      ctx.comms.broadcastBoardRecent();
      return threadId;
    }
    const { thread } = bbs.createThread({
      board: 'requests',
      subject: `${a.name} needs input`,
      author: a.name,
      authorType: 'agent',
      content,
    });
    requestThreadByAgent.set(id, thread.id);
    ctx.comms.broadcastBoardRecent();
    return thread.id;
  }

  function resolveHelpRequest(id, message) {
    const threadId = requestThreadByAgent.get(id);
    if (!threadId) return;
    requestThreadByAgent.delete(id);
    if (!bbs.getThread(threadId)) return;
    bbs.reply({ threadId, author: 'SYSTEM', authorType: 'system', content: message });
    ctx.comms.broadcastBoardRecent();
  }

  function open(id, message, kind) {
    const a = ctx.agents.get(id);
    if (!a || !message) return null;
    const existingId = promptByAgent.get(id);
    const threadId = postHelpRequest(id, message);
    const matched = runtimeView.anySession(a);
    const now = Date.now();
    if (existingId && prompts.has(existingId)) {
      const cur = prompts.get(existingId);
      cur.message = message;
      cur.kind = kind || classifyBlock(message);
      cur.updatedAt = now;
      cur.status = 'pending';
      cur.threadId = threadId || cur.threadId || null;
      cur.terminalSessionId = matched?.id || cur.terminalSessionId || null;
      broadcast();
      return cur;
    }
    const prompt = {
      id: crypto.randomUUID(),
      agentId: id,
      agentName: a.name,
      cwd: a.cwd,
      task: a.task || '',
      message,
      kind: kind || classifyBlock(message),
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      status: 'pending',
      threadId: threadId || null,
      terminalSessionId: matched?.id || null,
    };
    prompts.set(prompt.id, prompt);
    promptByAgent.set(id, prompt.id);
    bus.local({ type: 'prompt:opened', prompt });
    broadcast();
    return prompt;
  }

  function resolveForAgent(id, resolution) {
    resolveHelpRequest(id, resolution);
    const promptId = promptByAgent.get(id);
    if (!promptId || !prompts.has(promptId)) return;
    const prompt = prompts.get(promptId);
    prompt.status = 'resolved';
    prompt.resolvedAt = Date.now();
    prompt.updatedAt = prompt.resolvedAt;
    if (resolution) prompt.resolution = resolution;
    promptByAgent.delete(id);
    bus.local({ type: 'prompt:resolved', prompt });
    broadcast();
  }

  /**
   * A request a driven agent is blocked on right now (a permission, a
   * question). Unlike a blocked-agent prompt there may be several per agent,
   * each with its own card, and none of them outlives the agent's process.
   */
  function openRequest(agentId, { kind, message, request }) {
    const a = ctx.agents.get(agentId);
    if (!a || !request) return null;
    const now = Date.now();
    const prompt = {
      id: crypto.randomUUID(), agentId, agentName: a.name, cwd: a.cwd, task: a.task || '',
      message: String(message || '').slice(0, 4000), kind: kind || 'permission',
      createdAt: now, updatedAt: now, resolvedAt: null, status: 'pending',
      threadId: null, terminalSessionId: null, request,
    };
    prompts.set(prompt.id, prompt);
    bus.local({ type: 'prompt:opened', prompt });
    broadcast();
    return prompt;
  }

  function resolveRequest(promptId, resolution) {
    const prompt = prompts.get(promptId);
    if (!prompt || prompt.status === 'resolved') return;
    prompt.status = 'resolved';
    prompt.resolvedAt = Date.now();
    prompt.updatedAt = prompt.resolvedAt;
    prompt.resolution = resolution || 'Answered.';
    prompt.request = { ...prompt.request, pending: false };
    bus.local({ type: 'prompt:resolved', prompt });
    broadcast();
  }

  // Answering a request-backed prompt answers the agent itself.
  function answerRequest(prompt, body, who) {
    if (prompt.status !== 'pending') return { error: 'This request has already been answered.', status: 409 };
    const session = ctx.harness?.session(prompt.request.sessionId);
    if (!session) return { error: 'The session that asked is gone.', status: 409 };
    const result = session.answer(prompt.request.id, {
      action: body.action, optionId: body.optionId, text: body.text ? String(body.text) : '',
    }, { by: body.author || who.by || 'Lead', via: who.via });
    if (result.error) return result;
    const target = ctx.harness.sessionForAgent(prompt.agentId);
    return {
      ok: true, prompt: pub(prompt), answered: result.state, sessionGrant: result.sessionGrant || null,
      followUp: result.followUp || null, boardPosted: false, terminalDelivered: false, turnDelivered: !!result.followUp,
      targetSession: target?.id || null,
      receipt: runtimeView.receipt({ stored: false, targetSessions: target ? [target] : [] }),
    };
  }

  function reply(promptId, body = {}, who = {}) {
    const prompt = prompts.get(promptId);
    if (!prompt) return { error: 'Prompt not found', status: 404 };
    if (prompt.request) return answerRequest(prompt, body, who);
    const text = (body.text ? String(body.text) : '').trim();
    const author = body.author || 'Human';
    let boardPosted = false;
    let terminalDelivered = false;
    let receiptTargetSession = null;
    // A driven agent that asked a question gets its answer as a turn, now —
    // not as a line typed into a terminal, and not as mail it may never read.
    const driven = text ? ctx.harness?.deliverHumanNote(ctx.agents.get(prompt.agentId), text, { author }) : null;
    if (text && prompt.threadId && bbs.getThread(prompt.threadId)) {
      bbs.reply({ threadId: prompt.threadId, author, authorType: 'human', content: text,
        meta: { toAgentId: prompt.agentId, promptId: prompt.id, leadReply: true, ...(driven ? { turnDelivered: true } : {}) } });
      boardPosted = true;
      ctx.comms.broadcastBoardRecent();
    }
    if (driven) receiptTargetSession = driven.session;
    const target = body.targetSession
      || runtimeView.liveRef(prompt.terminalSessionId)?.id
      || runtimeView.strictSession(ctx.agents.get(prompt.agentId))?.id
      || null;
    if (text && target) {
      try {
        runtimes.sendInput(target, text, { enter: body.enter !== false });
        terminalDelivered = true;
        prompt.terminalSessionId = target;
        receiptTargetSession = runtimeView.snapshot(target);
      } catch { /* terminal went away — the board copy still stands */ }
    }
    if (body.close !== false) {
      // Delivering the answer as a turn already moved a driven agent on, which
      // resolved this prompt; say what really happened, but announce it once.
      const already = prompt.status === 'resolved';
      prompt.status = 'resolved';
      prompt.resolvedAt = Date.now();
      prompt.updatedAt = prompt.resolvedAt;
      prompt.resolution = text ? 'Human replied from the office.' : 'Dismissed from the office.';
      promptByAgent.delete(prompt.agentId);
      if (!already) bus.local({ type: 'prompt:resolved', prompt, reply: text });
    } else {
      prompt.updatedAt = Date.now();
    }
    broadcast();
    return {
      ok: true,
      prompt: pub(prompt),
      boardPosted,
      terminalDelivered,
      turnDelivered: !!driven,
      targetSession: target || driven?.session?.id || null,
      receipt: runtimeView.receipt({
        stored: boardPosted,
        targetSessions: receiptTargetSession ? [receiptTargetSession] : [],
      }),
    };
  }

  /* ---- surviving a daemon restart -------------------------------------- */

  function exportState() {
    return {
      // A request-backed prompt dies with the agent process that asked; never restore one.
      prompts: [...prompts.values()].filter((p) => p.status === 'pending' && !p.request),
      threads: [...requestThreadByAgent.entries()],
    };
  }

  function restore(saved) {
    if (!saved || typeof saved !== 'object') return 0;
    let count = 0;
    for (const p of Array.isArray(saved.prompts) ? saved.prompts : []) {
      if (!p || !p.id || !ctx.agents.get(p.agentId) || prompts.has(p.id)) continue;
      prompts.set(p.id, { ...p, status: 'pending' });
      promptByAgent.set(p.agentId, p.id);
      count += 1;
    }
    for (const [agentId, threadId] of Array.isArray(saved.threads) ? saved.threads : []) {
      if (ctx.agents.get(agentId) && bbs.getThread(threadId)) requestThreadByAgent.set(agentId, threadId);
    }
    return count;
  }

  // Wire to the agent lifecycle.
  bus.on('agent:blocked', (e) => open(e.id, e.message, e.kind));
  bus.on('agent:prompted', (e) => resolveForAgent(e.id, 'Human acknowledged the request and replied.'));
  bus.on('agent:ended', (e) => resolveForAgent(e.id, 'Session closed before the request was resolved.'));
  bus.on('agent:status', (e) => {
    // Approved in the terminal rather than in the office: the agent is moving
    // again, so the request is no longer waiting on anyone.
    if (e.from === 'blocked' && e.to !== 'blocked' && e.to !== 'leaving') {
      resolveForAgent(e.agent.id, 'Agent resumed work.');
    }
  });

  return {
    map: prompts,
    pub, listPublic, open, reply, resolveForAgent, openRequest, resolveRequest, broadcast, exportState, restore,
    pendingIdForAgent: (agentId) => {
      const promptId = promptByAgent.get(agentId);
      return promptId && prompts.has(promptId) ? promptId : null;
    },
    get: (id) => prompts.get(id) || null,
    pendingCount: () => [...prompts.values()].filter((p) => p.status === 'pending').length,
  };
}
