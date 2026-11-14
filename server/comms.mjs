// The Office — comms: project channels, agent↔agent direct mail, and the
// Lead's direct line. Every message is stored first (the board is the source
// of truth), then relayed into a live terminal only where the runtime's
// capabilities allow it. The receipt says which of those actually happened.
import { EV } from '../core/contract.mjs';
import { relayPayloadForSession } from './runtime-view.mjs';

const BBS_RECENT_LIMIT = 6;
const COLLAB_RECENT_LIMIT = 8;
const CHANNEL_RECENT_LIMIT = 12;
const MAX_MESSAGE = 8000;

const projectChannelId = (deptId) => `project:${deptId}`;

function cleanContent(value) {
  return String(value ?? '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim().slice(0, MAX_MESSAGE);
}

export function createComms(ctx) {
  const { bus, bbs, runtimes, runtimeView } = ctx;
  const agents = () => ctx.agents;

  /* ---- channels ------------------------------------------------------- */

  function allHandsChannel() {
    const members = agents().list().sort((a, b) => a.name.localeCompare(b.name));
    return {
      id: 'all',
      name: 'All Hands',
      kind: 'all-hands',
      memberIds: members.map((a) => a.id),
      memberNames: members.map((a) => a.name),
      memberCount: members.length,
      departmentIds: [...new Set(members.map((a) => a.department?.id).filter(Boolean))],
    };
  }

  function groupsByDepartment() {
    const grouped = new Map();
    for (const agent of agents().list()) {
      const dept = agent.department || { id: 'desk', name: 'Desk' };
      if (!grouped.has(dept.id)) grouped.set(dept.id, { dept, list: [] });
      grouped.get(dept.id).list.push(agent);
    }
    return [...grouped.values()].sort((a, b) => a.dept.name.localeCompare(b.dept.name));
  }

  function getChannels() {
    const groups = groupsByDepartment().map((grp) => ({
      id: projectChannelId(grp.dept.id),
      name: grp.dept.name,
      kind: 'project',
      departmentId: grp.dept.id,
      memberIds: grp.list.map((a) => a.id),
      memberNames: grp.list.map((a) => a.name),
      memberCount: grp.list.length,
      liveCount: grp.list.filter(agents().isPresent).length,
      sampleCwd: grp.list[0]?.cwd || '',
    }));
    // A project keeps its channel after everyone goes home, so a note left in
    // an empty room is still there for whoever sits down next.
    for (const dept of ctx.world?.knownDepartments?.() || []) {
      if (groups.some((g) => g.departmentId === dept.id)) continue;
      groups.push({
        id: projectChannelId(dept.id), name: dept.name, kind: 'project', departmentId: dept.id,
        memberIds: [], memberNames: [], memberCount: 0, liveCount: 0, sampleCwd: '', dormant: true,
      });
    }
    groups.sort((a, b) => a.name.localeCompare(b.name));
    return [allHandsChannel(), ...groups];
  }

  function resolveChannelRef(ref, fallbackAgentId) {
    const channels = getChannels();
    if (ref) {
      const needle = String(ref).trim().toLowerCase();
      const direct = channels.find((channel) =>
        channel.id.toLowerCase() === needle || channel.name.toLowerCase() === needle);
      if (direct) return direct;
      const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const loose = channels.filter((channel) => squash(channel.id.replace(/^project:/, '')) === squash(needle)
        || squash(channel.name) === squash(needle));
      if (loose.length === 1) return loose[0];
    }
    if (fallbackAgentId) {
      const agent = agents().resolveRef(fallbackAgentId);
      if (agent && agent.department?.id) {
        return channels.find((channel) => channel.id === projectChannelId(agent.department.id)) || null;
      }
    }
    return ref ? null : (channels[0] || null);
  }

  function findChannelThread(channelId) {
    return bbs.getThreads('channels').find((thread) =>
      thread.meta?.kind === 'project-channel' && thread.meta?.channelId === channelId) || null;
  }

  function channelMembers(channel) {
    if (!channel) return [];
    if (channel.id === 'all') return agents().list();
    return channel.memberIds.map((id) => agents().get(id)).filter(Boolean);
  }

  function formatChannelRelay(channel, author, content) {
    return [`[Office channel] #${channel.name}`, `${author}:`, content].filter(Boolean).join('\n');
  }

  function pubChannelPost(post, thread) {
    const meta = post?.meta || {};
    const threadMeta = thread?.meta || {};
    return {
      id: post.id,
      threadId: post.threadId,
      channelId: threadMeta.channelId || null,
      channelName: threadMeta.channelName || thread?.subject || '(unknown channel)',
      author: post.author,
      authorType: post.authorType,
      content: post.content,
      timestamp: post.timestamp,
      board: 'channels',
      authorAgentId: meta.authorAgentId || null,
      authorSessionId: meta.authorSessionId || null,
      authorRuntimeSessionId: meta.authorRuntimeSessionId || null,
      deliveredCount: meta.deliveredCount || 0,
      targetSessions: meta.targetSessions || [],
      queuedCount: meta.queuedCount || 0,
      queuedSessionIds: meta.queuedSessionIds || [],
      memberCount: meta.memberCount || threadMeta.memberCount || 0,
      mentions: meta.mentions || [],
    };
  }

  function getChannelRecent(channelId, limit = CHANNEL_RECENT_LIMIT, opt = {}) {
    const thread = channelId ? findChannelThread(channelId) : null;
    if (channelId && !thread) return [];
    if (!channelId) {
      const threads = bbs.getThreads('channels').filter((item) => item.meta?.kind === 'project-channel');
      const threadMap = new Map(threads.map((item) => [item.id, item]));
      return bbs.getRecent(limit, { board: 'channels', threadIds: threads.map((item) => item.id), since: opt.since })
        .map((post) => pubChannelPost(post, threadMap.get(post.threadId)));
    }
    return bbs.getRecent(limit, { board: 'channels', threadIds: [thread.id], since: opt.since })
      .map((post) => pubChannelPost(post, thread));
  }

  function resolveAuthorIdentity(body, opt = {}) {
    const fallbackAuthor = (opt.fallbackAuthor || 'Lead').trim() || 'Lead';
    const requestedAuthor = String(body.author || fallbackAuthor).trim() || fallbackAuthor;
    const agent = agents().resolveRef(
      body.authorAgentId || body.authorSessionId || body.fromAgentId
      || body.from || body.authorId || body.agentId || body.sessionId
      || requestedAuthor,
    );
    const runtimeSessionId = body.authorRuntimeSessionId
      || body.fromRuntimeSessionId
      || body.runtimeSessionId
      || runtimeView.strictSession(agent)?.id
      || null;
    if (agent) {
      agents().seen(agent.id);
      return {
        author: agent.name, authorType: 'agent', agent,
        authorAgentId: agent.id, authorSessionId: agent.id,
        authorRuntimeSessionId: runtimeSessionId,
      };
    }
    return {
      author: requestedAuthor.slice(0, 60),
      authorType: body.authorType || opt.fallbackType || 'human',
      agent: null, authorAgentId: null, authorSessionId: null,
      authorRuntimeSessionId: runtimeSessionId,
    };
  }

  // "@Amber Lynx" / "@amber-lynx" / "@amber" → agent ids (members only).
  function findMentions(content, everyone, members) {
    const text = String(content || '').toLowerCase();
    if (!text.includes('@')) return [];
    const hits = [];
    for (const member of everyone) {
      const full = member.name.toLowerCase();
      const dashed = full.replace(/\s+/g, '-');
      const first = full.split(/\s+/)[0];
      if (text.includes('@' + full) || text.includes('@' + dashed)
        || new RegExp(`@${first.replace(/[^a-z0-9]/g, '')}\\b`).test(text)) hits.push(member.id);
    }
    if (/@(all|everyone|here|team)\b/.test(text)) hits.push(...members.map((m) => m.id));
    return [...new Set(hits)];
  }

  // How many agent-to-agent steps from a human is something this author says
  // right now? (0 for the human; the harness knows it for agents it drives;
  // 1 for everyone else.) The office uses it to stop agents waking each other in a loop.
  const hopOfAuthor = (agent) => (agent ? (ctx.harness?.hopOf(agent.id) ?? 1) : 0);

  function sendChannelMessage(body) {
    const channel = resolveChannelRef(body.channelId || body.channel || body.projectChannel, body.agentId || body.agent);
    if (!channel) return { error: 'channel not found', status: 404 };
    const content = cleanContent(body.content || body.text);
    if (!content) return { error: 'content required', status: 400 };
    const authorInfo = resolveAuthorIdentity(body, { fallbackAuthor: 'Lead', fallbackType: 'human' });
    const members = channelMembers(channel);
    const sessions = runtimes.listSessions().filter((session) => session.alive);
    const targets = new Map();
    const exactTargetIds = new Set();
    const fallbackCwds = new Set();
    for (const member of members) {
      const exact = runtimeView.strictSession(member);
      if (exact) exactTargetIds.add(exact.id);
      else if (member.cwd) fallbackCwds.add(member.cwd);
    }
    if (body.relay !== false) {
      for (const session of sessions) {
        if (session.kind !== 'terminal') continue;
        if (authorInfo.authorRuntimeSessionId && session.id === authorInfo.authorRuntimeSessionId) continue;
        if (exactTargetIds.has(session.id)) { targets.set(session.id, session); continue; }
        if (!fallbackCwds.has(session.cwd) && !fallbackCwds.has(session.requestedCwd)) continue;
        targets.set(session.id, session);
      }
    }
    const deliveredSessions = [];
    for (const session of targets.values()) {
      try {
        runtimes.sendInput(session.id,
          relayPayloadForSession(session, formatChannelRelay(channel, authorInfo.author, content)),
          { enter: body.enter !== false });
        deliveredSessions.push(session);
      } catch { /* a dead pane must not fail the post */ }
    }
    const queuedSessions = [];
    for (const member of members) {
      const asyncSession = runtimeView.asyncInboxSession(member);
      if (!runtimeView.supportsAsyncInbox(asyncSession)) continue;
      if (authorInfo.authorRuntimeSessionId && asyncSession.id === authorInfo.authorRuntimeSessionId) continue;
      if (deliveredSessions.some((session) => session.id === asyncSession.id)) continue;
      if (!queuedSessions.some((session) => session.id === asyncSession.id)) queuedSessions.push(asyncSession);
    }
    let thread = findChannelThread(channel.id);
    const postMeta = {
      authorAgentId: authorInfo.authorAgentId,
      authorSessionId: authorInfo.authorSessionId,
      authorRuntimeSessionId: authorInfo.authorRuntimeSessionId,
      deliveredCount: deliveredSessions.length,
      targetSessions: deliveredSessions.map((session) => session.id),
      queuedCount: queuedSessions.length,
      queuedSessionIds: queuedSessions.map((session) => session.id),
      memberCount: members.length,
      // A mention reaches its target wherever they sit, not just channel members.
      mentions: findMentions(content, agents().list().filter((m) => m.id !== authorInfo.authorAgentId), members),
      hop: hopOfAuthor(authorInfo.agent),
    };
    let post;
    if (!thread) {
      const created = bbs.createThread({
        board: 'channels',
        subject: channel.name,
        author: authorInfo.author,
        authorType: authorInfo.authorType,
        content,
        meta: {
          kind: 'project-channel',
          channelId: channel.id,
          channelName: channel.name,
          memberCount: members.length,
        },
        postMeta,
      });
      thread = created.thread;
      post = created.post;
    } else {
      post = bbs.reply({
        threadId: thread.id,
        author: authorInfo.author,
        authorType: authorInfo.authorType,
        content,
        meta: postMeta,
      });
    }
    const pubPost = pubChannelPost(post, thread);
    bus.local({ type: 'comms:channel', channel, post: pubPost, author: authorInfo });
    broadcastBoardRecent();
    broadcastOverview();
    return {
      ok: true,
      channel,
      thread,
      post: pubPost,
      deliveredCount: deliveredSessions.length,
      memberCount: members.length,
      targetSessions: deliveredSessions.map((session) => session.id),
      receipt: runtimeView.receipt({ stored: true, targetSessions: deliveredSessions, queuedSessions }),
    };
  }

  /* ---- direct mail ---------------------------------------------------- */

  const collabParticipantKey = (aId, bId) => [aId, bId].sort().join('::');

  function formatCollabRelay(from, to, subject, content) {
    return [`[Office collab] ${from.name} -> ${to.name}`, subject ? `Thread: ${subject}` : '', content]
      .filter(Boolean).join('\n');
  }

  function pubCollabPost(post, thread) {
    const meta = post?.meta || {};
    const threadMeta = thread?.meta || {};
    return {
      id: post.id,
      threadId: post.threadId,
      subject: thread?.subject || '(unknown)',
      author: post.author,
      authorType: post.authorType,
      content: post.content,
      timestamp: post.timestamp,
      board: 'collab',
      fromAgentId: meta.fromAgentId || (meta.toLead ? null : threadMeta.fromAgentId) || null,
      fromAgentName: meta.fromAgentName || threadMeta.fromAgentName || post.author,
      toAgentId: meta.toLead ? null : (meta.toAgentId || threadMeta.toAgentId || null),
      toAgentName: meta.toLead ? 'Lead' : (meta.toAgentName || threadMeta.toAgentName || null),
      toLead: !!meta.toLead,
      terminalDelivered: !!meta.terminalDelivered,
      relaySessionId: meta.relaySessionId || null,
      queuedCount: meta.queuedCount || 0,
      queuedSessionIds: meta.queuedSessionIds || [],
    };
  }

  function getCollabRecent(agentId, limit = COLLAB_RECENT_LIMIT, opt = {}) {
    const threads = bbs.getThreads('collab').filter((thread) =>
      !agentId || (thread.meta?.participants || []).includes(agentId));
    if (!threads.length) return [];
    const threadMap = new Map(threads.map((thread) => [thread.id, thread]));
    return bbs.getRecent(limit, { board: 'collab', threadIds: threads.map((t) => t.id), since: opt.since })
      .map((post) => pubCollabPost(post, threadMap.get(post.threadId)));
  }

  function getDirectThreadSummaries(limit = 18) {
    const threads = bbs.getThreads('collab').filter((thread) =>
      thread.meta?.kind === 'direct' || thread.meta?.kind === 'lead-direct');
    if (!threads.length) return [];
    const threadMap = new Map(threads.map((thread) => [thread.id, thread]));
    const latestByThread = new Map();
    for (const post of bbs.getRecent(Math.max(limit * 6, 72), { board: 'collab', threadIds: threads.map((t) => t.id) })) {
      if (latestByThread.has(post.threadId)) continue;
      latestByThread.set(post.threadId, pubCollabPost(post, threadMap.get(post.threadId)));
    }
    return [...latestByThread.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  const findDirectCollabThread = (fromAgentId, toAgentId) => {
    const key = collabParticipantKey(fromAgentId, toAgentId);
    return bbs.getThreads('collab').find((thread) =>
      thread.meta?.kind === 'direct' && thread.meta?.participantKey === key) || null;
  };

  const findLeadDirectThread = (toAgentId) => bbs.getThreads('collab').find((thread) =>
    thread.meta?.kind === 'lead-direct' && thread.meta?.toAgentId === toAgentId) || null;

  function relayTo(agent, body, text) {
    const relayTarget = body.relay === false
      ? null
      : runtimeView.liveRef(body.targetSession || body.targetRuntimeSessionId || body.toRuntimeSessionId)?.id
        || runtimeView.strictSession(agent)?.id
        || null;
    let terminalDelivered = false;
    if (relayTarget) {
      try {
        const relaySession = runtimes.getSession(relayTarget);
        runtimes.sendInput(relayTarget, relayPayloadForSession(relaySession, text), { enter: body.enter !== false });
        terminalDelivered = true;
      } catch { /* stored on the board regardless */ }
    }
    return { relayTarget, terminalDelivered };
  }

  // An agent writing to the human: lands in that agent's Lead thread.
  function sendToLead(from, body, content, internal = {}) {
    let thread = findLeadDirectThread(from.id);
    const postMeta = {
      fromAgentId: from.id, fromAgentName: from.name,
      toAgentId: null, toAgentName: 'Lead', toLead: true, leadDirect: true,
      terminalDelivered: false, relaySessionId: null, queuedCount: 0, queuedSessionIds: [],
      ...(internal.delegationId ? { delegationId: internal.delegationId } : {}),
    };
    let post;
    if (!thread) {
      const created = bbs.createThread({
        board: 'collab',
        subject: `[Lead direct] Lead -> ${from.name}`,
        author: from.name, authorType: 'agent', content,
        meta: {
          kind: 'lead-direct', participantKey: `lead:${from.id}`, participants: ['lead', from.id],
          fromAgentId: null, fromAgentName: 'Lead', toAgentId: from.id, toAgentName: from.name, leadDirect: true,
        },
        postMeta,
      });
      thread = created.thread; post = created.post;
    } else {
      post = bbs.reply({ threadId: thread.id, author: from.name, authorType: 'agent', content, meta: postMeta });
    }
    const pubPost = pubCollabPost(post, thread);
    bus.local({ type: 'comms:dm', from, to: null, toLead: true, post: pubPost });
    broadcastCollabRecent();
    return { ok: true, thread, post: pubPost, terminalDelivered: false, targetSession: null,
      receipt: runtimeView.receipt({ stored: true }) };
  }

  /**
   * @param {object} body      what came off the wire
   * @param {{hop?:number, delegationId?:string}} [internal]  set only by the office itself
   *        (a delegated task's result going home) — never read from a request.
   */
  function sendCollabMessage(body, internal = {}) {
    const from = agents().resolveRef(body.fromAgentId || body.from || body.authorId || body.author);
    const toRef = body.toAgentId || body.to || body.recipientId || body.recipient;
    const content = cleanContent(body.content || body.text);
    if (from && /^(lead|human|the lead|boss)$/i.test(String(toRef || '').trim())) {
      if (!content) return { error: 'content required', status: 400 };
      agents().seen(from.id);
      return sendToLead(from, body, content, internal);
    }
    const to = agents().resolveRef(toRef);
    if (!from || !to) return { error: 'from/to agent not found', status: 404 };
    if (!content) return { error: 'content required', status: 400 };
    agents().seen(from.id);

    let thread = body.threadId ? bbs.getThread(body.threadId)?.thread || null : null;
    if (!thread) thread = findDirectCollabThread(from.id, to.id);
    const subject = thread?.subject || body.subject || `${from.name} ↔ ${to.name}`;
    const { relayTarget, terminalDelivered } = relayTo(to, body, formatCollabRelay(from, to, subject, content));
    const queuedSession = !terminalDelivered
      && (!body.fromRuntimeSessionId || body.fromRuntimeSessionId !== runtimeView.asyncInboxSession(to)?.id)
      ? runtimeView.asyncInboxSession(to)
      : null;
    const queuedSessions = runtimeView.supportsAsyncInbox(queuedSession) ? [queuedSession] : [];
    // A driven recipient that opted in is not typed at: the office starts a turn
    // for it (server/harness/wake.mjs). Until then the note is "queued", honestly.
    const wakes = !terminalDelivered && ctx.harness?.willWake(to.id) ? ctx.harness.sessionForAgent(to.id) : null;
    if (wakes) queuedSessions.push(wakes);
    const postMeta = {
      fromAgentId: from.id,
      fromAgentName: from.name,
      fromRuntimeSessionId: body.fromRuntimeSessionId || body.runtimeSessionId || null,
      toAgentId: to.id,
      toAgentName: to.name,
      terminalDelivered,
      relaySessionId: terminalDelivered ? relayTarget : null,
      queuedCount: queuedSessions.length,
      queuedSessionIds: queuedSessions.map((session) => session.id),
      hop: Number.isFinite(internal.hop) ? internal.hop : hopOfAuthor(from),
      ...(internal.delegationId ? { delegationId: internal.delegationId } : {}),
    };
    let post;
    if (!thread) {
      const created = bbs.createThread({
        board: 'collab',
        subject,
        author: from.name,
        authorType: 'agent',
        content,
        meta: {
          kind: 'direct',
          participantKey: collabParticipantKey(from.id, to.id),
          participants: [from.id, to.id],
          fromAgentId: from.id,
          fromAgentName: from.name,
          toAgentId: to.id,
          toAgentName: to.name,
        },
        postMeta,
      });
      thread = created.thread;
      post = created.post;
    } else {
      post = bbs.reply({ threadId: thread.id, author: from.name, authorType: 'agent', content, meta: postMeta });
    }
    const pubPost = pubCollabPost(post, thread);
    bus.local({ type: 'comms:dm', from, to, post: pubPost });
    broadcastBoardRecent();
    broadcastCollabRecent();
    const relaySession = terminalDelivered ? runtimeView.snapshot(relayTarget) : null;
    return {
      ok: true,
      thread,
      post: pubPost,
      terminalDelivered,
      targetSession: relayTarget,
      receipt: runtimeView.receipt({
        stored: true,
        targetSessions: relaySession ? [relaySession] : [],
        queuedSessions,
      }),
    };
  }

  function sendLeadDirectMessage(body) {
    const to = agents().resolveRef(body.toAgentId || body.to || body.recipientId || body.recipient
      || body.agentId || body.agent);
    if (!to) return { error: 'recipient agent not found', status: 404 };
    const content = cleanContent(body.content || body.text);
    if (!content) return { error: 'content required', status: 400 };
    const author = String(body.author || 'Lead').slice(0, 60);

    let thread = body.threadId ? bbs.getThread(body.threadId)?.thread || null : null;
    if (!thread) thread = findLeadDirectThread(to.id);
    const subject = thread?.subject || body.subject || `[Lead direct] Lead -> ${to.name}`;
    // The human speaking to an agent the office drives is a turn, not keystrokes.
    const driven = body.relay === false ? null : ctx.harness?.deliverHumanNote(to, content, { author });
    const { relayTarget, terminalDelivered } = driven ? { relayTarget: null, terminalDelivered: false } : relayTo(to, body,
      [`[Office lead direct] Lead -> ${to.name}`, content].join('\n'));
    const queuedSession = !terminalDelivered && !driven ? runtimeView.asyncInboxSession(to) : null;
    const queuedSessions = runtimeView.supportsAsyncInbox(queuedSession) ? [queuedSession] : [];
    const postMeta = {
      fromAgentId: null,
      fromAgentName: author,
      toAgentId: to.id,
      toAgentName: to.name,
      terminalDelivered,
      relaySessionId: terminalDelivered ? relayTarget : null,
      leadDirect: true,
      queuedCount: queuedSessions.length,
      queuedSessionIds: queuedSessions.map((session) => session.id),
      hop: 0,
      // Already in front of the agent as a turn: the inbox must not hand it over a second time.
      ...(driven ? { turnDelivered: true } : {}),
    };
    let post;
    if (!thread) {
      const created = bbs.createThread({
        board: 'collab',
        subject,
        author,
        authorType: body.authorType || 'human',
        content,
        meta: {
          kind: 'lead-direct',
          participantKey: `lead:${to.id}`,
          participants: ['lead', to.id],
          fromAgentId: null,
          fromAgentName: author,
          toAgentId: to.id,
          toAgentName: to.name,
          leadDirect: true,
        },
        postMeta,
      });
      thread = created.thread;
      post = created.post;
    } else {
      post = bbs.reply({ threadId: thread.id, author, authorType: body.authorType || 'human', content, meta: postMeta });
    }
    const pubPost = pubCollabPost(post, thread);
    bus.local({ type: 'comms:dm', from: null, fromLead: true, to, post: pubPost });
    broadcastCollabRecent();
    const relaySession = driven ? driven.session : terminalDelivered ? runtimeView.snapshot(relayTarget) : null;
    return {
      ok: true,
      thread,
      post: pubPost,
      terminalDelivered,
      turnDelivered: !!driven,
      turnQueued: !!driven?.queued,
      targetSession: driven ? driven.session.id : relayTarget,
      receipt: runtimeView.receipt({
        stored: true,
        targetSessions: relaySession ? [relaySession] : [],
        queuedSessions,
      }),
    };
  }

  /* ---- overview + broadcasts ------------------------------------------ */

  function getOverview() {
    const live = agents().list();
    const pending = ctx.prompts.listPublic().sort((a, b) => {
      if ((a.status === 'pending') !== (b.status === 'pending')) return a.status === 'pending' ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
    return {
      generatedAt: Date.now(),
      channels: getChannels(),
      prompts: pending,
      recentChannels: getChannelRecent(null, 18),
      recentCollab: getCollabRecent(null, 14),
      directThreads: getDirectThreadSummaries(18),
      stats: {
        liveAgents: live.length,
        blockedAgents: live.filter((a) => a.status === 'blocked').length,
        workingAgents: live.filter((a) => a.status === 'working').length,
        managedSessions: runtimes.listSessions().filter((s) => s.alive).length,
      },
    };
  }

  // The overview is rebuilt from the whole board, so coalesce bursts.
  let overviewTimer = null;
  function broadcastOverview() {
    if (overviewTimer) return;
    overviewTimer = setTimeout(() => {
      overviewTimer = null;
      bus.broadcast({ type: EV.COMMS_OVERVIEW, overview: getOverview() });
    }, 40);
    if (typeof overviewTimer.unref === 'function') overviewTimer.unref();
  }

  function broadcastBoardRecent() {
    bus.broadcast({ type: 'bbs_recent', posts: bbs.getRecent(BBS_RECENT_LIMIT) });
  }

  function broadcastCollabRecent() {
    bus.broadcast({ type: 'collab_recent', posts: getCollabRecent(null, COLLAB_RECENT_LIMIT) });
    broadcastOverview();
  }

  return {
    BBS_RECENT_LIMIT, COLLAB_RECENT_LIMIT, CHANNEL_RECENT_LIMIT,
    projectChannelId, getChannels, resolveChannelRef, findChannelThread, channelMembers,
    getChannelRecent, getCollabRecent, getDirectThreadSummaries, getOverview,
    sendChannelMessage, sendCollabMessage, sendLeadDirectMessage, resolveAuthorIdentity,
    broadcastOverview, broadcastBoardRecent, broadcastCollabRecent,
  };
}
