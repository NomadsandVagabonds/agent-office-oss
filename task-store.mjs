// The Office — kanban persistence. One board per department; the Task shape
// and the column vocabulary are frozen in core/contract.mjs.
import path from 'node:path';
import { TASK_PRIORITY, TASK_STATUS, normalizeTaskStatus } from './core/contract.mjs';
import { JsonFile } from './server/persist.mjs';

const STATUS_INDEX = new Map(TASK_STATUS.map((status, index) => [status, index]));
const PRIORITY_SET = new Set(TASK_PRIORITY);

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function uniqueStrings(list) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(list) ? list : []) {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function normalizePriority(priority) {
  return PRIORITY_SET.has(priority) ? priority : 'normal';
}

function normalizeText(text) {
  return String(text || '').trim();
}

export class TaskStore {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), 'data', 'tasks.json');
    this.store = new JsonFile(this.filePath, {
      defaults: () => ({ tasks: [] }),
      pretty: true,
      validate: (d) => d && Array.isArray(d.tasks),
    });
    this.data = this.store.data;
    this.seq = 0;
  }

  #save() {
    this.store.save();
  }

  flush() {
    this.store.flush();
  }

  #genId() {
    this.seq = (this.seq + 1) % 1296;
    return 't_' + Date.now().toString(36) + this.seq.toString(36).padStart(2, '0')
      + Math.random().toString(36).slice(2, 5);
  }

  #sort(tasks) {
    return tasks.slice().sort((a, b) => {
      const sa = STATUS_INDEX.get(a.status) ?? 999;
      const sb = STATUS_INDEX.get(b.status) ?? 999;
      if (sa !== sb) return sa - sb;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  list(opt = {}) {
    let tasks = this.data.tasks.slice();
    if (opt.deptId) tasks = tasks.filter((task) => task.deptId === opt.deptId);
    if (opt.assignee) tasks = tasks.filter((task) => task.assignee === opt.assignee);
    if (opt.status) tasks = tasks.filter((task) => task.status === opt.status);
    if (opt.sessionId) tasks = tasks.filter((task) => task.sessionId === opt.sessionId);
    if (opt.promptId) tasks = tasks.filter((task) => task.promptId === opt.promptId);
    return this.#sort(tasks);
  }

  get(taskId) {
    return this.data.tasks.find((task) => task.id === taskId) || null;
  }

  create(input) {
    const now = Date.now();
    let id = normalizeText(input.id) || this.#genId();
    while (this.get(id)) id = this.#genId();
    const task = {
      id,
      deptId: normalizeText(input.deptId),
      title: normalizeText(input.title).slice(0, 240),
      body: normalizeText(input.body).slice(0, 8000),
      status: normalizeTaskStatus(input.status),
      priority: normalizePriority(input.priority),
      assignee: input.assignee ? String(input.assignee).trim() : null,
      createdBy: normalizeText(input.createdBy) || 'human',
      createdAt: now,
      updatedAt: now,
      sessionId: input.sessionId ? String(input.sessionId).trim() : null,
      promptId: input.promptId ? String(input.promptId).trim() : null,
      dependsOn: uniqueStrings(input.dependsOn),
    };
    task.dependsOn = task.dependsOn.filter((dep) => dep !== task.id);
    this.data.tasks.push(task);
    this.#save();
    return task;
  }

  update(taskId, patch) {
    const task = this.get(taskId);
    if (!task) return null;
    if (hasOwn(patch, 'deptId')) task.deptId = normalizeText(patch.deptId);
    if (hasOwn(patch, 'title')) task.title = normalizeText(patch.title).slice(0, 240) || task.title;
    if (hasOwn(patch, 'body')) task.body = normalizeText(patch.body).slice(0, 8000);
    if (hasOwn(patch, 'status')) task.status = normalizeTaskStatus(patch.status);
    if (hasOwn(patch, 'priority')) task.priority = normalizePriority(patch.priority);
    if (hasOwn(patch, 'assignee')) task.assignee = patch.assignee ? String(patch.assignee).trim() : null;
    if (hasOwn(patch, 'sessionId')) task.sessionId = patch.sessionId ? String(patch.sessionId).trim() : null;
    if (hasOwn(patch, 'promptId')) task.promptId = patch.promptId ? String(patch.promptId).trim() : null;
    if (hasOwn(patch, 'dependsOn')) {
      task.dependsOn = uniqueStrings(patch.dependsOn).filter((dep) => dep !== task.id);
    }
    task.updatedAt = Date.now();
    this.#save();
    return task;
  }

  remove(taskId) {
    const index = this.data.tasks.findIndex((task) => task.id === taskId);
    if (index === -1) return null;
    const [task] = this.data.tasks.splice(index, 1);
    for (const other of this.data.tasks) {
      if (Array.isArray(other.dependsOn) && other.dependsOn.includes(taskId)) {
        other.dependsOn = other.dependsOn.filter((dep) => dep !== taskId);
      }
    }
    this.#save();
    return task;
  }
}
