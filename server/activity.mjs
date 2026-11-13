// The Office — the activity feed. One human-readable line per thing that
// happened (someone arrived, a card moved, a secret was found), journaled to
// disk and pushed on the bus. It answers "what did I miss?" without replaying
// raw state, and it is what the lobby ticker and the catch-up digest read.
import { EV } from '../core/contract.mjs';

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

export function createActivity(ctx) {
  const { bus, journal } = ctx;

  function log(kind, text, extra = {}) {
    const item = journal.append({ kind, text, ...extra });
    bus.broadcast({ type: EV.ACTIVITY, item });
    return item;
  }

  bus.on('agent:join', ({ agent, restored }) => {
    if (restored) return;                       // it never left; the daemon did
    log('join', `${agent.name} arrived${agent.department?.name ? ` in ${agent.department.name}` : ''}`,
      { agentId: agent.id, deptId: agent.department?.id || null, provider: agent.provider || null });
  });
  bus.on('agent:leave', ({ agent }) => {
    log('leave', `${agent.name} headed home`, { agentId: agent.id, deptId: agent.department?.id || null });
  });
  bus.on('prompt:opened', ({ prompt }) => {
    log('needs-you', `${prompt.agentName} needs you: ${clip(prompt.message, 90)}`,
      { agentId: prompt.agentId, promptId: prompt.id, blockKind: prompt.kind });
  });
  bus.on('prompt:resolved', ({ prompt }) => {
    log('unblocked', `${prompt.agentName} is unblocked`, { agentId: prompt.agentId, promptId: prompt.id });
  });
  bus.on('comms:channel', ({ channel, post }) => {
    log('channel', `${post.author} in #${channel.name}: ${clip(post.content, 90)}`,
      { agentId: post.authorAgentId, channelId: channel.id });
  });
  bus.on('comms:dm', ({ from, to, fromLead, toLead, post }) => {
    const a = fromLead ? 'Lead' : (from?.name || post.author);
    const b = toLead ? 'Lead' : (to?.name || '?');
    // Direct mail is private: the feed says that it happened, not what was said.
    log('dm', `${a} sent ${b} a note`, { agentId: from?.id || null, toAgentId: to?.id || null });
  });
  bus.on('task:created', ({ task, by }) => {
    log('task', `${by?.author || 'Someone'} added “${clip(task.title, 60)}” to ${task.deptId}`,
      { taskId: task.id, deptId: task.deptId, agentId: by?.authorAgentId || null });
  });
  bus.on('task:updated', ({ task, before, by }) => {
    if (before.status === task.status) return;
    log(task.status === 'done' ? 'task-done' : 'task',
      `“${clip(task.title, 60)}” moved ${before.status} → ${task.status}`,
      { taskId: task.id, deptId: task.deptId, agentId: by?.authorAgentId || null, to: task.status });
  });

  return {
    log,
    recent: (limit) => journal.recent(limit),
    since: (ts, limit) => journal.since(ts, limit),
  };
}
