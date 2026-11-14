// Directing the office for the camera: the same HTTP calls agents (and the
// `office` CLI) make, on a timeline, with the daemon's WebSocket stream taped
// so the take can be played back to a slow renderer at its real speed.
//
//   import { studio, record } from '../rig/direct.mjs';
//   const o = studio(4410);
//   const tape = await record(4410, async ({ at }) => { await at(1); await o.go('ada', 'kitchen'); … });
import fs from 'node:fs';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function studio(port = 4410) {
  const base = `http://127.0.0.1:${port}`;
  async function api(path, { method, body } = {}) {
    const res = await fetch(base + path, { method: method || (body ? 'POST' : 'GET'), headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    if (!res.ok) console.warn(`[direct] ${method || (body ? 'POST' : 'GET')} ${path} → ${res.status} ${JSON.stringify(data)?.slice(0, 160)}`);
    return data;
  }
  const cast = new Map();          // id → { id, cwd, provider, model, ctx }
  const hook = (id, name, extra = {}) => { const a = cast.get(id) || { id, cwd: `/tmp/demo/${id}` }; return api('/hook', { body: { session_id: a.id, cwd: a.cwd, provider: a.provider, model: a.model, hook_event_name: name, contextPct: Math.round(a.ctx || 20), ...extra } }); };
  return {
    api, cast, hook,
    /** A session shows up (the lift, then a desk). */
    async arrive(a) { cast.set(a.id, { ctx: 12, ...a }); return hook(a.id, 'SessionStart'); },
    prompt: (id) => hook(id, 'UserPromptSubmit'),
    tool: (id, tool) => hook(id, 'PreToolUse', { tool_name: tool }),
    toolDone: (id, tool) => hook(id, 'PostToolUse', { tool_name: tool }),
    stop: (id) => hook(id, 'Stop'),
    ask: (id, message) => hook(id, 'Notification', { message }),
    end: (id) => hook(id, 'SessionEnd'),
    me: (id, patch) => api(`/api/agents/${encodeURIComponent(id)}/persona`, { method: 'PATCH', body: patch }),
    go: (id, to, stay = true) => api('/api/world/go', { body: { agent: id, to, stay } }),
    use: (id, thing, arg) => api('/api/world/use', { body: { agent: id, thing, arg } }),
    emote: (id, emote) => api('/api/world/emote', { body: { agent: id, emote } }),
    say: (id, text) => api('/api/world/say', { body: { agent: id, text } }),
    dm: (from, to, content) => api('/api/collab/message', { body: { fromAgentId: from, toAgentId: to, content } }),
    post: (id, dept, content) => api(`/api/channels/${encodeURIComponent('project:' + dept)}/message`, { body: { content, authorAgentId: id, authorType: 'agent' } }),
    card: (id, dept, title, status = 'todo') => api('/api/tasks', { body: { title, deptId: dept, status, authorAgentId: id, authorType: 'agent' } }),
    move: (id, taskId, status, extra = {}) => api(`/api/tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', body: { status, authorAgentId: id, authorType: 'agent', ...extra } }),
    agents: () => api('/api/agents'),
    world: () => api('/api/world'),
  };
}

/**
 * Tape the daemon's stream while `fn` directs the scene. `at(seconds)` waits until that long after the tape began.
 * The tape is { t0, init: [raw…] (what the daemon says on connect), live: [{ t, d }] }.
 */
export async function record(port, fn, { file, lead = 800, watch = '', http = [] } = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const got = [];
  ws.onmessage = (e) => got.push({ t: Date.now(), d: String(e.data) });
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('the daemon would not take a WebSocket')); });
  if (watch) ws.send(JSON.stringify({ type: 'transcript:watch', sessionId: watch }));       // a driven session's record, as the console watches it
  await sleep(lead);
  // what a page asks the daemon for when it opens, as it stood when the tape began (played back by rig/capture.mjs)
  const answers = {};
  for (const path of http) { try { answers[path] = await (await fetch(`http://127.0.0.1:${port}${path}`)).json(); } catch { /* the page will ask the live daemon */ } }
  const t0 = Date.now();
  const init = got.splice(0).map((m) => m.d);
  const at = async (seconds) => { const wait = t0 + seconds * 1000 - Date.now(); if (wait > 0) await sleep(wait); };
  await fn({ t0, at });
  await sleep(300);
  ws.close();
  const tape = { t0, init, live: got.slice(), http: answers };
  if (file) { fs.writeFileSync(file, JSON.stringify(tape)); console.log(`[tape] ${file}: ${init.length} on connect, ${tape.live.length} live, ${((Date.now() - t0) / 1000).toFixed(1)}s`); }
  return tape;
}
