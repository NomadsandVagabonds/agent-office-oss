#!/usr/bin/env node
// office-task.mjs — the task-lane sibling of office-msg / office-create /
// office-knowledge. One tiny command so agents can create, claim, move, and
// assign shared work without hand-rolling curl calls.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { requestJson } from './office-http.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.OFFICE_PORT || 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const GLOBAL_PROFILES = path.join(os.homedir(), '.claude', 'agent-office', 'profiles.json');
const LOCAL_PROFILES = path.join(HERE, 'data', 'profiles.local.json');
const argv = process.argv.slice(2);

function help() {
  console.log(
    'node office-task.mjs list [here|<dept>]\n'
    + 'node office-task.mjs show <taskId>\n'
    + 'node office-task.mjs create <title...> [--dept here|<dept>] [--status todo|doing|blocked|review|done]\n'
    + '  [--priority low|normal|high] [--assignee <agent>] [--body "..."] [--depends a,b] [--prompt <promptId>]\n'
    + 'node office-task.mjs move <taskId> <status>\n'
    + 'node office-task.mjs assign <taskId> <agent|none>\n'
    + 'node office-task.mjs claim <taskId> [doing|blocked|review]\n'
  );
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return { bySession: {}, byCwd: {} }; }
}

function loadProfiles() {
  const global = readJson(GLOBAL_PROFILES);
  const local = readJson(LOCAL_PROFILES);
  return {
    bySession: { ...(global.bySession || {}), ...(local.bySession || {}) },
    byCwd: { ...(global.byCwd || {}), ...(local.byCwd || {}) },
  };
}

function sessionId() {
  return process.env.CODEX_THREAD_ID || process.env.CLAUDE_SESSION_ID || '';
}

function resolveSelf() {
  const profiles = loadProfiles();
  const cwd = process.cwd();
  const sid = sessionId();
  const prof = { ...(cwd && profiles.byCwd[cwd]), ...(sid && profiles.bySession[sid]) };
  return {
    sessionId: sid || null,
    cwd,
    name: prof.name || process.env.OFFICE_AUTHOR || process.env.USER || 'Agent',
  };
}

function argValue(flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? (argv[index + 1] || '') : '';
}

function hasFlag(flag) {
  return argv.includes(flag);
}

function norm(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const j = (pathname, opt = {}) => requestJson(BASE + pathname, opt);

async function getChannels() {
  return await j('/api/channels');
}

async function resolveDept(ref, me) {
  const value = String(ref || '').trim();
  if (!value || value === 'here' || value === 'me' || value === 'project') {
    const channels = await getChannels();
    const mine = channels.filter((channel) =>
      channel.kind === 'project' && Array.isArray(channel.memberIds)
      && me.sessionId && channel.memberIds.includes(me.sessionId));
    if (mine[0]?.departmentId) return mine[0].departmentId;
    const byCwd = channels.find((channel) => channel.sampleCwd
      && (channel.sampleCwd === me.cwd || me.cwd.startsWith(channel.sampleCwd)));
    if (byCwd?.departmentId) return byCwd.departmentId;
    return '';
  }
  if (value.startsWith('project:')) return value.slice('project:'.length);
  const channels = await getChannels();
  const matched = channels.find((channel) =>
    channel.id.toLowerCase() === value.toLowerCase()
    || channel.name.toLowerCase() === value.toLowerCase()
    || norm(channel.id) === norm(value)
    || norm(channel.name) === norm(value));
  return matched?.departmentId || value;
}

function renderTask(task) {
  const bits = [
    task.status,
    task.priority && task.priority !== 'normal' ? task.priority : '',
    task.assigneeName ? '@' + task.assigneeName : (task.assignee ? '@' + task.assignee : 'unassigned'),
    task.promptId ? 'prompt:' + task.promptId : '',
    task.dependsOn && task.dependsOn.length ? 'deps:' + task.dependsOn.length : '',
  ].filter(Boolean);
  console.log(`${task.id}  ${task.title}`);
  console.log(`  ${task.deptId} · ${bits.join(' · ')}`);
  if (task.body) console.log(`  ${task.body}`);
}

async function listTasks(ref, me) {
  const deptId = await resolveDept(ref || 'here', me);
  const query = deptId ? `?deptId=${encodeURIComponent(deptId)}` : '';
  const payload = await j('/api/tasks' + query);
  const tasks = Array.isArray(payload) ? payload : payload.tasks || [];
  if (!tasks.length) {
    console.log(deptId ? `# ${deptId}\n\n(no tasks yet)` : '(no tasks yet)');
    return;
  }
  console.log(`# ${deptId || 'tasks'}\n`);
  for (const task of tasks) renderTask(task);
}

const cmd = argv[0];
if (!cmd || cmd === '--help' || cmd === '-h') {
  help();
  process.exit(0);
}

const me = resolveSelf();

if (cmd === 'list') {
  await listTasks(argv[1] || 'here', me);
  process.exit(0);
}

if (cmd === 'show') {
  const id = argv[1];
  if (!id) {
    console.error('office-task: task id required.');
    process.exit(1);
  }
  const payload = await j('/api/tasks/' + encodeURIComponent(id));
  console.log(JSON.stringify(payload.task || payload, null, 2));
  process.exit(0);
}

if (cmd === 'create') {
  const title = argv.filter((part, index) => index > 0 && !part.startsWith('--')
    && argv[index - 1] !== '--dept' && argv[index - 1] !== '--status'
    && argv[index - 1] !== '--priority' && argv[index - 1] !== '--assignee'
    && argv[index - 1] !== '--body' && argv[index - 1] !== '--depends'
    && argv[index - 1] !== '--prompt').join(' ').trim();
  if (!title) {
    console.error('office-task: title required.');
    process.exit(1);
  }
  const deptId = await resolveDept(argValue('--dept') || 'here', me);
  if (!deptId) {
    console.error('office-task: could not resolve a department. Try --dept <name>.');
    process.exit(1);
  }
  const body = {
    title,
    deptId,
    status: argValue('--status') || 'todo',
    priority: argValue('--priority') || 'normal',
    assignee: argValue('--assignee') || null,
    body: argValue('--body') || '',
    dependsOn: argValue('--depends') || '',
    promptId: argValue('--prompt') || null,
    author: me.name,
    authorType: 'agent',
    authorAgentId: me.sessionId,
    authorSessionId: me.sessionId,
  };
  if (hasFlag('--claim')) body.assignee = me.sessionId || me.name;
  const res = await j('/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  renderTask(res.task);
  process.exit(0);
}

if (cmd === 'move') {
  const taskId = argv[1];
  const status = argv[2];
  if (!taskId || !status) {
    console.error('office-task: move requires <taskId> <status>.');
    process.exit(1);
  }
  const res = await j('/api/tasks/' + encodeURIComponent(taskId), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: {
      status,
      author: me.name,
      authorType: 'agent',
      authorAgentId: me.sessionId,
      authorSessionId: me.sessionId,
    },
  });
  renderTask(res.task);
  process.exit(0);
}

if (cmd === 'assign') {
  const taskId = argv[1];
  const assignee = argv[2];
  if (!taskId || !assignee) {
    console.error('office-task: assign requires <taskId> <agent|none>.');
    process.exit(1);
  }
  const res = await j('/api/tasks/' + encodeURIComponent(taskId), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: {
      assignee: assignee === 'none' ? null : assignee,
      author: me.name,
      authorType: 'agent',
      authorAgentId: me.sessionId,
      authorSessionId: me.sessionId,
    },
  });
  renderTask(res.task);
  process.exit(0);
}

if (cmd === 'claim') {
  const taskId = argv[1];
  const status = argv[2] || 'doing';
  if (!taskId) {
    console.error('office-task: claim requires <taskId>.');
    process.exit(1);
  }
  const res = await j('/api/tasks/' + encodeURIComponent(taskId), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: {
      assignee: me.sessionId || me.name,
      status,
      sessionId: me.sessionId,
      author: me.name,
      authorType: 'agent',
      authorAgentId: me.sessionId,
      authorSessionId: me.sessionId,
    },
  });
  renderTask(res.task);
  process.exit(0);
}

console.error(`office-task: unknown command "${cmd}"`);
help();
process.exit(1);
