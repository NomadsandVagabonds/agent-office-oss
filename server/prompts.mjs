// The Office — PermissionRequests: the "NEEDS YOU" objects.
// agent blocked → prompt opened (+ a help thread on the board) → surfaced to
// the human → reply relayed to the board and, when the runtime allows, typed
// into the agent's terminal → resolved.
import crypto from 'node:crypto';
import { classifyBlock } from '../core/contract.mjs';

const KEEP_RESOLVED = 40;          // resolved prompts kept around for context

export function createPrompts(ctx) {
  const { bus, bbs, runtimes, runtimeView } = ctx;
  const prompts = new Map();
  const promptByAgent = new Map();
  const requestThreadByAgent = new Map();

  function pub(p) {
    const runtime = runtimeView.summaryForAgent(ctx.agents.get(p.agentId), {
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
      provider: runtime.provider || null,
      runtime,
      actions: runtimeView.promptReplyActions(p, runtime),
    };
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

  function reply(promptId, body = {}) {
    const prompt = prompts.get(promptId);
    if (!prompt) return { error: 'Prompt not found', status: 404 };
    const text = (body.text ? String(body.text) : '').trim();
    const author = body.author || 'Human';
    let boardPosted = false;
    let terminalDelivered = false;
    let receiptTargetSession = null;
    if (text && prompt.threadId && bbs.getThread(prompt.threadId)) {
      bbs.reply({ threadId: prompt.threadId, author, authorType: 'human', content: text,
        meta: { toAgentId: prompt.agentId, promptId: prompt.id, leadReply: true } });
      boardPosted = true;
      ctx.comms.broadcastBoardRecent();
    }
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
      prompt.status = 'resolved';
      prompt.resolvedAt = Date.now();
      prompt.updatedAt = prompt.resolvedAt;
      prompt.resolution = text ? 'Human replied from the office.' : 'Dismissed from the office.';
      promptByAgent.delete(prompt.agentId);
      bus.local({ type: 'prompt:resolved', prompt, reply: text });
    } else {
      prompt.updatedAt = Date.now();
    }
    broadcast();
    return {
      ok: true,
      prompt: pub(prompt),
      boardPosted,
      terminalDelivered,
      targetSession: target,
      receipt: runtimeView.receipt({
        stored: boardPosted,
        targetSessions: receiptTargetSession ? [receiptTargetSession] : [],
      }),
    };
  }

  /* ---- surviving a daemon restart -------------------------------------- */

  function exportState() {
    return {
      prompts: [...prompts.values()].filter((p) => p.status === 'pending'),
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
    pub, listPublic, open, reply, resolveForAgent, broadcast, exportState, restore,
    pendingIdForAgent: (agentId) => {
      const promptId = promptByAgent.get(agentId);
      return promptId && prompts.has(promptId) ? promptId : null;
    },
    get: (id) => prompts.get(id) || null,
    pendingCount: () => [...prompts.values()].filter((p) => p.status === 'pending').length,
  };
}
