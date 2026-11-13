// The Office — kanban logic on top of TaskStore. One board per department;
// the store owns persistence, this owns identity, linking and broadcasts.
import { EV, TASK_PRIORITY, normalizeTaskStatus } from '../core/contract.mjs';

const PRIORITIES = new Set(TASK_PRIORITY);
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const normalizePriority = (p) => (PRIORITIES.has(p) ? p : 'normal');
const activeStatus = (status) => status === 'doing' || status === 'blocked' || status === 'review';

function cleanDependsOn(dependsOn) {
  if (Array.isArray(dependsOn)) {
    return [...new Set(dependsOn.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  if (typeof dependsOn === 'string') return cleanDependsOn(dependsOn.split(','));
  return [];
}

export function normalizeDeptId(ref) {
  const value = String(ref || '').trim();
  if (!value) return '';
  return value.startsWith('project:') ? value.slice('project:'.length) : value;
}

export function createTasks(ctx) {
  const { bus, tasks } = ctx;

  function pub(task) {
    const assigneeAgent = task.assignee ? ctx.agents.resolveRef(task.assignee) : null;
    const linkedPrompt = task.promptId ? ctx.prompts.get(task.promptId) : null;
    return {
      id: task.id,
      deptId: task.deptId,
      title: task.title,
      body: task.body || '',
      status: task.status,
      priority: task.priority || 'normal',
      assignee: task.assignee || null,
      assigneeName: assigneeAgent?.name || task.assigneeName || null,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      sessionId: task.sessionId || null,
      promptId: task.promptId || null,
      dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn.slice() : [],
      live: !!task.sessionId,
      promptStatus: linkedPrompt?.status || null,
    };
  }

  const list = (opt = {}) => tasks.list(opt).map(pub);
  const deptIds = () => [...new Set(tasks.list().map((task) => task.deptId).filter(Boolean))];

  function broadcast(deptId) {
    if (deptId) {
      bus.broadcast({ type: EV.TASKS, deptId, tasks: list({ deptId }) });
      return;
    }
    const ids = deptIds();
    if (!ids.length) {
      bus.broadcast({ type: EV.TASKS, deptId: null, tasks: [] });
      return;
    }
    for (const id of ids) bus.broadcast({ type: EV.TASKS, deptId: id, tasks: list({ deptId: id }) });
  }

  function resolveDept(body, authorInfo, assigneeAgent) {
    const direct = normalizeDeptId(body.deptId || body.departmentId || '');
    if (direct) return direct;
    if (body.channelId || body.channel) {
      const channel = ctx.comms.resolveChannelRef(body.channelId || body.channel, authorInfo.agent?.id || null);
      if (channel?.departmentId) return channel.departmentId;
    }
    if (assigneeAgent?.department?.id) return assigneeAgent.department.id;
    if (authorInfo.agent?.department?.id) return authorInfo.agent.department.id;
    if (body.sessionId || body.agentId || body.authorAgentId || body.authorSessionId) {
      const sessionAgent = ctx.agents.resolveRef(
        body.sessionId || body.agentId || body.authorAgentId || body.authorSessionId);
      if (sessionAgent?.department?.id) return sessionAgent.department.id;
    }
    if (body.cwd) return ctx.profiles.department(body.cwd).id;
    return '';
  }

  function create(body) {
    const title = String(body.title || '').trim();
    if (!title) return { error: 'title required', status: 400 };
    const authorInfo = ctx.comms.resolveAuthorIdentity(body, { fallbackAuthor: 'Lead', fallbackType: 'human' });
    const assigneeRef = body.assignee || body.assigneeId || null;
    const assigneeAgent = ctx.agents.resolveRef(assigneeRef);
    if (assigneeRef && !assigneeAgent) return { error: 'assignee not found', status: 404 };
    const deptId = resolveDept(body, authorInfo, assigneeAgent);
    if (!deptId) return { error: 'deptId required', status: 400 };
    const status = normalizeTaskStatus(body.status);
    const sessionId = hasOwn(body, 'sessionId')
      ? (body.sessionId ? String(body.sessionId).trim() : null)
      : (activeStatus(status) ? (authorInfo.agent?.id || assigneeAgent?.id || null) : null);
    const promptId = hasOwn(body, 'promptId')
      ? (body.promptId ? String(body.promptId).trim() : null)
      : (status === 'blocked' && assigneeAgent ? ctx.prompts.pendingIdForAgent(assigneeAgent.id) : null);
    const task = tasks.create({
      deptId,
      title,
      body: body.body || '',
      status,
      priority: normalizePriority(body.priority),
      assignee: assigneeAgent?.id || null,
      createdBy: authorInfo.authorType === 'agent' && authorInfo.agent ? authorInfo.agent.id : 'human',
      sessionId,
      promptId,
      dependsOn: cleanDependsOn(body.dependsOn),
    });
    if (assigneeAgent) task.assigneeName = assigneeAgent.name;
    bus.local({ type: 'task:created', task, by: authorInfo });
    broadcast(task.deptId);
    return { ok: true, task: pub(task) };
  }

  function update(taskId, body) {
    const current = tasks.get(taskId);
    if (!current) return { error: 'task not found', status: 404 };
    const before = { status: current.status, assignee: current.assignee, deptId: current.deptId };
    const authorInfo = ctx.comms.resolveAuthorIdentity(body, { fallbackAuthor: 'Lead', fallbackType: 'human' });
    const assigneeProvided = hasOwn(body, 'assignee') || hasOwn(body, 'assigneeId');
    const assigneeRef = assigneeProvided ? (body.assignee ?? body.assigneeId ?? null) : null;
    const assigneeAgent = assigneeProvided
      ? ctx.agents.resolveRef(assigneeRef || '')
      : (current.assignee ? ctx.agents.resolveRef(current.assignee) : null);
    if (assigneeProvided && assigneeRef && !assigneeAgent) return { error: 'assignee not found', status: 404 };
    const deptProvided = hasOwn(body, 'deptId') || hasOwn(body, 'departmentId')
      || hasOwn(body, 'channelId') || hasOwn(body, 'channel');
    const deptId = deptProvided ? resolveDept(body, authorInfo, assigneeAgent) : current.deptId;
    if (!deptId) return { error: 'deptId required', status: 400 };
    const statusProvided = hasOwn(body, 'status');
    const nextStatus = statusProvided ? normalizeTaskStatus(body.status) : current.status;
    const patch = { deptId };
    if (hasOwn(body, 'title')) patch.title = body.title || '';
    if (hasOwn(body, 'body')) patch.body = body.body || '';
    if (statusProvided) patch.status = nextStatus;
    if (hasOwn(body, 'priority')) patch.priority = normalizePriority(body.priority);
    if (assigneeProvided) patch.assignee = assigneeAgent?.id || null;
    if (hasOwn(body, 'dependsOn')) patch.dependsOn = cleanDependsOn(body.dependsOn);
    if (hasOwn(body, 'sessionId')) {
      patch.sessionId = body.sessionId ? String(body.sessionId).trim() : null;
    } else if (statusProvided) {
      patch.sessionId = activeStatus(nextStatus)
        ? (authorInfo.agent?.id || assigneeAgent?.id || current.sessionId || null)
        : null;
    }
    if (hasOwn(body, 'promptId')) {
      patch.promptId = body.promptId ? String(body.promptId).trim() : null;
    } else if (statusProvided) {
      patch.promptId = nextStatus === 'blocked'
        ? ctx.prompts.pendingIdForAgent(assigneeAgent?.id || current.assignee || '') || current.promptId || null
        : null;
    }
    const updated = tasks.update(taskId, patch);
    if (!updated) return { error: 'task not found', status: 404 };
    // Remember the name so a card still reads well after its owner goes home.
    if (assigneeProvided) updated.assigneeName = assigneeAgent?.name || null;
    else if (assigneeAgent) updated.assigneeName = assigneeAgent.name;
    bus.local({ type: 'task:updated', task: updated, before, by: authorInfo });
    if (before.deptId !== updated.deptId) broadcast(before.deptId);
    broadcast(updated.deptId);
    return { ok: true, task: pub(updated) };
  }

  function remove(taskId) {
    const removed = tasks.remove(taskId);
    if (!removed) return { error: 'task not found', status: 404 };
    bus.local({ type: 'task:removed', task: removed });
    broadcast(removed.deptId);
    return { ok: true, task: pub(removed) };
  }

  // A session that went home is no longer carrying anything.
  bus.on('agent:leave', (e) => {
    const touched = new Set();
    for (const task of tasks.list({ sessionId: e.agent.id })) {
      tasks.update(task.id, { sessionId: null });
      touched.add(task.deptId);
    }
    for (const deptId of touched) broadcast(deptId);
  });

  return { pub, list, deptIds, broadcast, create, update, remove, resolveDept };
}
