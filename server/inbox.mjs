// The Office — the inbox, computed on the server.
//
// "What has been said to me since I last looked?" used to be re-derived by
// every helper from a handful of recent posts, matching on display names. Here
// it is one question with one answer, keyed by agent id, with a read cursor
// the office remembers — so a hook, the CLI and an MCP tool all see the same
// mail, exactly once.
import { JsonFile } from './persist.mjs';

const CURSOR_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function createInbox(ctx, file) {
  const { bbs } = ctx;
  const store = new JsonFile(file, {
    defaults: () => ({ v: 1, cursors: {} }),
    validate: (d) => d && typeof d.cursors === 'object' && d.cursors !== null,
  });
  const cursors = store.data.cursors;
  const now0 = Date.now();
  for (const [id, c] of Object.entries(cursors)) {
    if (now0 - (c.at || 0) > CURSOR_TTL_MS) delete cursors[id];
  }

  function cursorFor(agent) {
    const hit = cursors[agent.id];
    if (hit) return hit.ts;
    // First look: nothing before you sat down counts as unread.
    return agent.joinedAt || Date.now();
  }

  function setCursor(agentId, ts) {
    const prev = cursors[agentId]?.ts || 0;
    cursors[agentId] = { ts: Math.max(prev, Number(ts) || 0), at: Date.now() };
    store.save();
  }

  /**
   * Everything addressed to `agent` after `since` (default: its read cursor).
   * mode 'all'  — every channel it sits in + all direct mail
   * mode 'hook' — only what is worth interrupting a turn for: direct mail,
   *               mentions, project-channel posts, and all-hands notes from humans
   */
  function collect(agent, opt = {}) {
    const since = opt.since !== undefined && opt.since !== null ? Number(opt.since) : cursorFor(agent);
    const limit = Math.max(1, Math.min(200, Number(opt.limit) || 50));
    const mode = opt.mode === 'hook' ? 'hook' : 'all';
    const items = [];
    const deptChannel = agent.department?.id ? ctx.comms.projectChannelId(agent.department.id) : null;

    const channelThreads = bbs.getThreads('channels').filter((t) => t.meta?.kind === 'project-channel');
    const channelMap = new Map(channelThreads.map((t) => [t.id, t]));
    if (channelThreads.length) {
      for (const post of bbs.getRecent(600, { board: 'channels', threadIds: [...channelMap.keys()], since })) {
        const meta = post.meta || {};
        if (post.authorType === 'system') continue;
        if (meta.authorAgentId === agent.id) continue;                     // not your own posts
        const thread = channelMap.get(post.threadId);
        const allHands = thread.meta.channelId === 'all';
        const mention = Array.isArray(meta.mentions) && meta.mentions.includes(agent.id);
        // Your project's channel and All Hands — plus any channel that names you.
        if (!mention && !allHands && thread.meta.channelId !== deptChannel) continue;
        if (mode === 'hook' && allHands && !mention && post.authorType !== 'human') continue;
        items.push({
          id: post.id, ts: post.timestamp,
          kind: mention ? 'mention' : 'channel',
          direct: mention,
          where: '#' + (thread.meta.channelName || thread.subject),
          channelId: thread.meta.channelId,
          from: post.author, fromType: post.authorType, fromAgentId: meta.authorAgentId || null,
          text: post.content, threadId: post.threadId,
        });
      }
    }

    const mailThreads = bbs.getThreads('collab').filter((t) => (t.meta?.participants || []).includes(agent.id));
    const mailMap = new Map(mailThreads.map((t) => [t.id, t]));
    if (mailThreads.length) {
      for (const post of bbs.getRecent(400, { board: 'collab', threadIds: [...mailMap.keys()], since })) {
        const meta = post.meta || {};
        if (meta.toLead) continue;                                         // that one went to the human
        if (meta.toAgentId !== agent.id) continue;
        const fromLead = !!meta.leadDirect;
        items.push({
          id: post.id, ts: post.timestamp,
          kind: fromLead ? 'lead' : 'dm',
          direct: true,
          where: fromLead ? 'DM · Lead' : 'DM',
          from: post.author, fromType: post.authorType, fromAgentId: meta.fromAgentId || null,
          text: post.content, threadId: post.threadId,
        });
      }
    }

    // The human's answer to a NEEDS-YOU request.
    for (const post of bbs.getRecent(200, { board: 'requests', since })) {
      const meta = post.meta || {};
      if (!meta.leadReply || meta.toAgentId !== agent.id) continue;
      items.push({
        id: post.id, ts: post.timestamp, kind: 'reply', direct: true,
        where: 'Reply to your request',
        from: post.author, fromType: post.authorType, fromAgentId: null,
        text: post.content, threadId: post.threadId,
      });
    }

    items.sort((a, b) => a.ts - b.ts);
    const sliced = items.slice(-limit);
    return {
      agentId: agent.id,
      agentName: agent.name,
      since,
      items: sliced,
      unread: items.length,
      direct: items.filter((i) => i.direct).length,
      newest: sliced.length ? sliced[sliced.length - 1].ts : since,
      truncated: items.length > sliced.length,
    };
  }

  function read(agent, opt = {}) {
    const result = collect(agent, opt);
    if (opt.ack && result.items.length) setCursor(agent.id, result.newest);
    ctx.agents.seen(agent.id);
    return result;
  }

  function ack(agent, upTo) {
    setCursor(agent.id, upTo ?? Date.now());
    return { ok: true, agentId: agent.id, cursor: cursors[agent.id].ts };
  }

  return { collect, read, ack, cursorFor, flush: () => store.flush() };
}
