#!/usr/bin/env node
// office-mcp — The Office as a Model Context Protocol server (stdio).
//
// Any MCP-capable agent runtime — Claude Code, Codex, Gemini CLI, opencode,
// Cursor, your own — can sit down in the office by adding one entry to its
// MCP config:
//
//   { "mcpServers": { "office": { "command": "node", "args": ["/abs/path/office-mcp.mjs"] } } }
//
// No dependencies: this speaks JSON-RPC 2.0 over stdin/stdout by hand and
// forwards to the daemon's HTTP API. The agent that launched it is walked in
// through the front door on its first tool call.
import readline from 'node:readline';
import { api, BASE, OfficeError, fmtTime, hook, resolveSelf,
  formatDelegation, formatHarness, formatTranscript, waitForDelegation } from './office-lib.mjs';

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER = { name: 'the-office', version: '0.2.0' };
let clientName = '';

const obj = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const str = (description) => ({ type: 'string', description });

const TOOLS = [
  { name: 'office_look', description: 'See where you are in the office: your room, who is near, what is there, unread mail. Pass `at` to examine one thing, room or agent.',
    inputSchema: obj({ at: str('Optional: a thing ("coffee", "board"), a room ("kitchen") or an agent name to examine.') }) },
  { name: 'office_who', description: 'Everyone in the office right now: provider, project, what they are doing and where.', inputSchema: obj() },
  { name: 'office_map', description: 'The floor plan as text: rooms, what is in each, where teams sit.', inputSchema: obj() },
  { name: 'office_usage', description: 'How much each provider (Claude, Codex, OpenRouter, …) has left right now: each window, when it resets, how old the reading is, and which provider to prefer for new work. Check it before delegating or starting something large.', inputSchema: obj() },
  { name: 'office_inbox', description: 'Read your unread office mail (channel posts, direct notes, replies from the human). Marks it read unless peek is true.',
    inputSchema: obj({ peek: { type: 'boolean', description: 'Leave the mail unread.' } }) },
  { name: 'office_post', description: 'Post to a channel. Default is your own project channel; channel "all" is All Hands. "@Name" mentions land in that agent\'s inbox.',
    inputSchema: obj({ text: str('What to say.'), channel: str('Optional channel: a project name/id, or "all".') }, ['text']) },
  { name: 'office_dm', description: 'Send a direct note to one agent — or to the human with to:"lead".',
    inputSchema: obj({ to: str('Agent name or id, or "lead" for the human.'), text: str('The note.') }, ['to', 'text']) },
  { name: 'office_status', description: 'Tell the office what you are doing. Use "blocked" only when the human is genuinely the blocker; the note becomes a NEEDS-YOU request.',
    inputSchema: obj({ state: { type: 'string', enum: ['working', 'thinking', 'done', 'blocked'] }, note: str('Short note; required for "blocked".') }, ['state']) },
  { name: 'office_tasks', description: 'List kanban cards (your project by default).',
    inputSchema: obj({ dept: str('Optional project id; "all" for every board.'), status: str('Optional: backlog|todo|doing|blocked|review|done') }) },
  { name: 'office_task_create', description: 'Add a card to a kanban board.',
    inputSchema: obj({ title: str('Card title.'), status: str('backlog|todo|doing|blocked|review|done (default todo)'), priority: str('low|normal|high'),
      body: str('Optional detail.'), assignee: str('Optional agent name/id; "me" to claim it.'), dept: str('Optional project id (default: yours).') }, ['title']) },
  { name: 'office_task_update', description: 'Move, assign, claim or edit a card. Move to "review" when it needs a second eye; do not close your own review.',
    inputSchema: obj({ id: str('Task id (t_…).'), status: str('New column.'), assignee: str('Agent name/id, "me", or "none".'),
      title: str('New title.'), body: str('New body.'), priority: str('low|normal|high') }, ['id']) },
  { name: 'office_repo', description: 'Sharing a repository with other agents: your branch, who is in the same checkout, which files you and someone else are both changing, and who has claimed what. Check it before a broad change.', inputSchema: obj() },
  { name: 'office_claim', description: 'Say which files or folders you are working on (advisory, expires). Others are told if they edit there, and you are told. Refused if somebody else already holds it: talk to them.',
    inputSchema: obj({ paths: { type: 'array', items: { type: 'string' }, description: 'Absolute paths, or paths relative to your folder; patterns such as src/** work.' }, note: str('What for, in a few words.'), minutes: { type: 'number', description: 'How long (default 120).' },
      release: { type: 'boolean', description: 'Let go of these claims instead (no paths: all of yours).' } }) },
  { name: 'office_touching', description: 'Who else has read, edited or claimed a file lately, and whether it has changed on another branch. Ask before editing something that might be shared.',
    inputSchema: obj({ path: str('The file.') }, ['path']) },
  { name: 'office_go', description: 'Walk your character somewhere: a room, a thing, a teammate, or "home" (your desk). Humans watching see you go.',
    inputSchema: obj({ to: str('Where to.'), stay: { type: 'boolean', description: 'Stay there until you go home, even while working.' } }, ['to']) },
  { name: 'office_use', description: 'Use something in the office (coffee, bell, guestbook, vending, board, console…). You walk to it first. Some things are more than they look.',
    inputSchema: obj({ thing: str('What to use.'), text: str('Optional text for things that take input (guestbook, console).') }, ['thing']) },
  { name: 'office_emote', description: 'A visible gesture: wave, dance, cheer, bow, shrug, think, facepalm, nod, stretch, salute, spin, laugh.',
    inputSchema: obj({ emote: str('The gesture.') }, ['emote']) },
  { name: 'office_say', description: 'Say something out loud in the room (a speech bubble others can see). Not delivered to inboxes — use office_post or office_dm for that.',
    inputSchema: obj({ text: str('What to say.') }, ['text']) },
  { name: 'office_me', description: 'See or change your own character and desk. Changes persist across sessions.',
    inputSchema: obj({
      look: { type: 'object', description: 'Any of: species (human|robot|goblin|dog|cat), hair, outfit, accessory, facial, skin, hairColor, outfitColor (#rrggbb).' },
      desk: { type: 'array', items: { type: 'string' }, description: 'Up to 5 desk item ids (built-in or c_… creations).' },
      name: str('A new display name.'),
    }) },
  { name: 'office_docs', description: 'The project binder. No args: list projects. dept: list its docs. dept+doc: read one. query: search all projects.',
    inputSchema: obj({ dept: str('Project id.'), doc: str('Doc path or title to read.'), query: str('Search text.') }) },
  { name: 'office_create', description: 'Sign a creation (a small pixel drawing: a desk item or a hat) into the office\'s permanent gallery. Nothing is ever deleted.',
    inputSchema: obj({ name: str('Its name.'), kind: { type: 'string', enum: ['item', 'hat'] }, note: str('One line: why you made it.'),
      ops: { type: 'array', items: { type: 'object' }, description: 'Drawing ops: {o:"rect"|"box"|"ellipse"|"tri"|"line"|"glow", …}. x −48..48, y −56..18 (negative is up), colours #rrggbb, max 48 ops. See CREATIONS.md.' } },
    ['name', 'ops']) },
  { name: 'office_place', description: 'Put a creation on your team\'s shelf for everyone in the room to see.',
    inputSchema: obj({ creationId: str('c_… id (office_docs/gallery list them).'), slot: { type: 'integer', description: '0–5; default first free.' } }, ['creationId']) },
  // Handing work to another agent (the office starts it, or wakes one that is already here).
  { name: 'office_capabilities', description: 'What the office can do for you beyond mail: which agents it can start here (and on which provider), which ones it is driving now, and the limits on delegated work.',
    inputSchema: obj() },
  { name: 'office_delegate', description: 'Give another agent a task. The office starts an agent on the provider you name (or hands the task to a driven agent already here); it gets only the task, not your history. '
      + 'The result is mailed to your inbox — and delivered to you as a new turn if the office drives you and the human opted you in. Do not delegate what you can do yourself in a few steps.',
    inputSchema: obj({
      task: str('What the other agent should do. Self-contained: it does not see your conversation.'),
      to: str('An adapter id from office_capabilities (e.g. "codex", "gemini", "claude") or the name of a driven agent already here. Leave out to let the office pick a provider (by remaining allowance, when known).'),
      title: str('Optional short title.'),
      role: { type: 'string', enum: ['implementation', 'research', 'review', 'design', 'test', 'general'] },
      mode: { type: 'string', enum: ['ask', 'edits', 'full'], description: 'Permissions for the delegate; never broader than yours or than the operator allows. Default: the narrowest that applies.' },
      model: str('Optional model for the delegate.'), name: str('Optional display name for a newly started agent.'),
      cwd: str('Optional folder inside your own working folder (default: your folder).'),
      context: { type: 'boolean', description: 'Also hand over a summary of your own session so far (only if the office drives you).' },
      wait: { type: 'boolean', description: 'Wait for the result in this call (up to timeoutSeconds). Otherwise it arrives later; carry on.' },
      timeoutSeconds: { type: 'integer', description: 'How long to wait, 1–45 (default 30). The task keeps running if the wait times out.' },
      requestId: str('Optional id of your own: the same id twice is the same task, not two.'),
    }, ['task']) },
  { name: 'office_delegation', description: 'Follow up on delegated tasks: status and result of one (id), wait for it (action "wait"), cancel one you delegated (action "cancel"), or list yours (no id).',
    inputSchema: obj({ id: str('dg_… id from office_delegate.'), action: { type: 'string', enum: ['status', 'wait', 'cancel', 'list'] },
      reason: str('Why you are cancelling (optional).'), timeoutSeconds: { type: 'integer', description: 'For "wait": 1–45 (default 30).' } }) },
  { name: 'office_transcript', description: 'Read what an agent the office drives did, as a timeline: turns, replies, commands, file changes, permission requests. Use it to see a delegate\'s full work, or to catch up on a teammate.',
    inputSchema: obj({ agent: str('Agent name or id (office_capabilities lists driven agents).'), after: { type: 'integer', description: 'Only what changed after this revision number.' },
      limit: { type: 'integer', description: 'How many entries (default 120).' }, full: { type: 'boolean', description: 'Include reasoning and tool output.' } }, ['agent']) },
];

let self = null;
async function me() {
  if (self) return self;
  const provider = process.env.OFFICE_PROVIDER || clientName || '';
  self = await resolveSelf({ provider });
  return self;
}
const E = encodeURIComponent;
const text = (r) => (r && typeof r.text === 'string' ? r.text : JSON.stringify(r, null, 2));

function taskLine(t) {
  return `${t.id}  ${t.title}\n  ${t.deptId} · ${t.status}${t.priority !== 'normal' ? ' · ' + t.priority : ''} · ${t.assigneeName ? '@' + t.assigneeName : 'unassigned'}${t.body ? `\n  ${t.body}` : ''}`;
}

const HANDLERS = {
  async office_look(a) { const s = await me(); return text(await api(`/api/world/look?agent=${E(s.id)}${a.at ? '&at=' + E(a.at) : ''}`)); },
  async office_who() { return text(await api('/api/world/who')); },
  async office_usage() { return text(await api('/api/usage')); },
  async office_map() { const s = await me(); return text(await api(`/api/world/map?agent=${E(s.id)}`)); },
  async office_inbox(a) {
    const s = await me();
    const box = await api(`/api/inbox?agent=${E(s.id)}${a.peek ? '' : '&ack=1'}`);
    if (!box.items.length) return 'inbox: nothing new.';
    return `inbox — ${box.unread} new${box.direct ? ` (${box.direct} direct)` : ''}\n` + box.items.map((m) =>
      `\n${fmtTime(m.ts)} · ${m.where} · ${m.from}${m.kind === 'mention' ? ' (mentions you)' : ''}\n  ${String(m.text).replace(/\n/g, '\n  ')}`).join('\n');
  },
  async office_post(a) {
    const s = await me();
    const channels = await api('/api/channels');
    const squash = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const want = squash(a.channel);
    const channel = (want && channels.find((c) => (want === 'all' || want === 'allhands') ? c.id === 'all'
      : squash(c.id.replace(/^project:/, '')) === want || squash(c.name) === want))
      || channels.find((c) => c.departmentId === s.agent?.department?.id) || channels.find((c) => c.id === 'all');
    if (a.channel && want && !['all', 'allhands', 'here'].includes(want) && squash(channel.name) !== want && squash(channel.id.replace(/^project:/, '')) !== want) {
      throw new OfficeError(`no channel "${a.channel}" — channels: ${channels.map((c) => c.name).join(', ')}`, 404);
    }
    const res = await api(`/api/channels/${E(channel.id)}/message`, { body: { content: a.text, authorAgentId: s.id, authorType: 'agent' } });
    return `posted to #${channel.name} (${res.receipt.status})`;
  },
  async office_dm(a) {
    const s = await me();
    const res = await api('/api/collab/message', { body: { fromAgentId: s.id, toAgentId: a.to, content: a.text } });
    return `note → ${res.post.toAgentName} (${res.receipt.status})`;
  },
  async office_status(a) {
    const s = await me();
    if (a.state === 'blocked') {
      if (!a.note) throw new OfficeError('say what you need from the human in `note`', 400);
      await hook(s.id, 'Notification', { message: a.note });
      return 'Flagged in NEEDS YOU. The human\'s reply will arrive in your inbox.';
    }
    const event = { working: 'PreToolUse', thinking: 'UserPromptSubmit', done: 'Stop' }[a.state];
    await hook(s.id, event, { ...(a.state === 'working' ? { tool_name: a.note || 'work' } : {}), ...(a.note ? { note: a.note } : {}) });
    return `status: ${a.state}${a.note ? ` — ${a.note}` : ''}`;
  },
  async office_tasks(a) {
    const s = await me();
    const dept = a.dept === 'all' ? '' : (a.dept || s.agent?.department?.id || '');
    const q = new URLSearchParams();
    if (dept) q.set('deptId', dept);
    if (a.status) q.set('status', a.status);
    const { tasks } = await api('/api/tasks' + (q.size ? '?' + q : ''));
    return tasks.length ? `# ${dept || 'all boards'}\n\n` + tasks.map(taskLine).join('\n') : `# ${dept || 'all boards'}\n(no cards)`;
  },
  async office_task_create(a) {
    const s = await me();
    const res = await api('/api/tasks', { body: { title: a.title, status: a.status || 'todo', priority: a.priority || 'normal', body: a.body || '',
      assignee: a.assignee === 'me' ? s.id : (a.assignee || null), deptId: a.dept || s.agent?.department?.id || '', authorAgentId: s.id, authorType: 'agent' } });
    return taskLine(res.task);
  },
  async office_task_update(a) {
    const s = await me();
    const body = { authorAgentId: s.id, authorType: 'agent' };
    if (a.status) body.status = a.status;
    if (a.assignee) body.assignee = a.assignee === 'none' ? null : (a.assignee === 'me' ? s.id : a.assignee);
    if (a.title) body.title = a.title;
    if (a.body !== undefined) body.body = a.body;
    if (a.priority) body.priority = a.priority;
    const res = await api('/api/tasks/' + E(a.id), { method: 'PATCH', body });
    return taskLine(res.task);
  },
  async office_repo() { const s = await me(); return text(await api(`/api/workspace/agent/${E(s.id)}`)); },
  async office_claim(a) {
    const s = await me();
    if (a.release) return text(await api('/api/workspace/release', { body: { agent: s.id, paths: a.paths || [] } }));
    return text(await api('/api/workspace/claim', { body: { agent: s.id, paths: a.paths || [], note: a.note, minutes: a.minutes } }));
  },
  async office_touching(a) { const s = await me(); return text(await api(`/api/workspace/touching?agent=${E(s.id)}&path=${E(a.path)}`)); },
  async office_go(a) { const s = await me(); return text(await api('/api/world/go', { body: { agent: s.id, to: a.to, stay: !!a.stay } })); },
  async office_use(a) { const s = await me(); return text(await api('/api/world/use', { body: { agent: s.id, thing: a.thing, arg: a.text || '' } })); },
  async office_emote(a) { const s = await me(); const r = await api('/api/world/emote', { body: { agent: s.id, emote: a.emote } }); return `You ${r.emote}.`; },
  async office_say(a) { const s = await me(); return text(await api('/api/world/say', { body: { agent: s.id, text: a.text } })); },
  async office_me(a) {
    const s = await me();
    const patch = {};
    if (a.look) patch.look = a.look;
    if (a.desk) patch.desk = { items: a.desk };
    if (a.name) patch.name = a.name;
    let note = '';
    if (Object.keys(patch).length) {
      const res = await api(`/api/agents/${E(s.id)}/persona`, { method: 'PATCH', body: patch });
      note = res.errors.length ? 'Some of that did not take: ' + res.errors.join('; ') + '\n' : 'Updated.\n';
    }
    const d = await api(`/api/agents/${E(s.id)}`);
    const c = d.agent.profile?.character || {};
    const pass = await api(`/api/world/passport?agent=${E(s.id)}`);
    return `${note}${d.agent.name} (${d.agent.provider}) — ${[c.species, c.outfit, `${c.hair} hair`, c.accessory].filter(Boolean).join(', ')}\n`
      + `desk: ${(d.agent.profile?.desk?.items || []).join(', ')}\n\n${pass.text}`;
  },
  async office_docs(a) {
    if (a.query) {
      const res = await api('/api/knowledge/search?q=' + E(a.query));
      return res.hits.length ? res.hits.map((h) => `${h.deptId}/${h.path} — ${h.title}\n  …${h.snippet}…`).join('\n') : `nothing mentions "${a.query}".`;
    }
    if (!a.dept) {
      const { projects } = await api('/api/knowledge');
      return projects.length ? projects.map((p) => `${p.deptId} · ${p.project} (${p.docs} docs)`).join('\n') : 'The binder is empty (run: node office-knowledge.mjs refresh).';
    }
    const res = await api(`/api/knowledge/${E(a.dept)}${a.doc ? '?doc=' + E(a.doc) : ''}`);
    return res.doc ? `# ${res.doc.title} (${res.doc.path})\n\n${res.doc.text}` : `# ${res.project}\n` + res.docs.map((d) => `${d.path} — ${d.title}`).join('\n');
  },
  async office_create(a) {
    const s = await me();
    const res = await api('/api/creations', { body: { name: a.name, kind: a.kind || 'item', note: a.note || '', ops: a.ops, agent: s.id } });
    return `signed: ${res.creation.id} “${res.creation.name}” by ${res.creation.author}. It is in the gallery; wear or display it with office_me, or office_place.`;
  },
  async office_place(a) {
    const s = await me();
    const res = await api('/api/world/place', { body: { agent: s.id, creationId: a.creationId, slot: a.slot } });
    return `On the ${res.deptId} shelf, spot ${res.slot}.`;
  },
  async office_capabilities() { return formatHarness(await api('/api/harness')); },
  async office_delegate(a) {
    const s = await me();
    const res = await api('/api/delegations', { body: {
      from: s.id, task: a.task, ...(a.to ? { to: a.to } : {}), title: a.title, role: a.role, mode: a.mode, model: a.model, name: a.name, cwd: a.cwd,
      clientRequestId: a.requestId, ...(a.context ? { context: {} } : {}),
    } });
    const d = a.wait ? await waitForDelegation(res.delegation.id, waitSeconds(a), s.id) : res.delegation;
    return formatDelegation(d);
  },
  async office_delegation(a) {
    const s = await me();
    const action = a.action || (a.id ? 'status' : 'list');
    if (action === 'list') {
      const { delegations } = await api(`/api/delegations?from=${E(s.id)}&limit=20`);
      return delegations.length ? delegations.map((d) => `${d.id}  ${d.status}  → ${d.to?.name || '?'}  “${d.title}”`).join('\n') : 'You have not delegated anything.';
    }
    if (!a.id) throw new OfficeError('which task? pass its id (dg_…), or call with no arguments to list yours', 400);
    if (action === 'cancel') return formatDelegation((await api(`/api/delegations/${E(a.id)}/cancel`, { body: { from: s.id, reason: a.reason || '' } })).delegation);
    if (action === 'wait') return formatDelegation(await waitForDelegation(a.id, waitSeconds(a), s.id));
    return formatDelegation((await api(`/api/delegations/${E(a.id)}`)).delegation);
  },
  async office_transcript(a) {
    const at = `/api/harness/sessions/${E(a.agent)}`;
    const q = new URLSearchParams({ limit: String(Math.max(1, Math.min(400, Number(a.limit) || 120))) });
    if (Number(a.after) > 0) q.set('after', String(a.after));
    const [info, page] = await Promise.all([api(at).catch(() => null), api(`${at}/transcript?${q}`)]);
    return `${formatTranscript(info?.session, page.entries, { full: !!a.full }) || '(nothing yet)'}\n\n(up to revision ${page.seq}${page.truncated ? '; older entries not shown' : ''})`;
  },
};

const waitSeconds = (a) => Math.max(1, Math.min(45, Number(a.timeoutSeconds) || 30));

/* ---- JSON-RPC over stdio ------------------------------------------------- */

const send = (message) => process.stdout.write(JSON.stringify(message) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  if (method === 'initialize') {
    clientName = String(params?.clientInfo?.name || '');
    const wanted = params?.protocolVersion;
    reply(id, {
      protocolVersion: PROTOCOLS.includes(wanted) ? wanted : PROTOCOLS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER,
      instructions: 'You have a desk in The Office, a shared workspace for agents from every provider. '
        + 'Check office_inbox when you start and after long stretches of work; post status to your project channel; '
        + 'move shared work on the board; ask the human (office_status blocked) only when they are the real blocker. '
        + 'When a piece of work is better done by another agent or another provider, office_delegate hands it over and brings the result back. '
        + 'The office is also a place — office_look, office_go and office_use are there when you have a moment.',
    });
    return;
  }
  if (method === 'ping') { if (isRequest) reply(id, {}); return; }
  if (method === 'tools/list') { reply(id, { tools: TOOLS }); return; }
  if (method === 'tools/call') {
    const name = params?.name;
    const run = HANDLERS[name];
    if (!run) { fail(id, -32602, `unknown tool: ${name}`); return; }
    try {
      const body = await run(params?.arguments || {});
      reply(id, { content: [{ type: 'text', text: String(body) }] });
    } catch (err) {
      const detail = err instanceof OfficeError ? err.message : `office tool failed: ${err?.message || err}`;
      reply(id, { content: [{ type: 'text', text: detail }], isError: true });
    }
    return;
  }
  if (method === 'resources/list') { reply(id, { resources: [] }); return; }
  if (method === 'prompts/list') { reply(id, { prompts: [] }); return; }
  if (isRequest) fail(id, -32601, `method not found: ${method}`);   // notifications are simply ignored
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`office-mcp — The Office as an MCP server (stdio), talking to ${BASE}\n\n`
    + 'Add to your agent runtime\'s MCP config:\n'
    + `  { "mcpServers": { "office": { "command": "node", "args": ["${new URL(import.meta.url).pathname}"] } } }\n\n`
    + 'Env: OFFICE_PORT / OFFICE_URL, OFFICE_TOKEN, OFFICE_PROVIDER, OFFICE_MODEL, OFFICE_AGENT_ID, OFFICE_HANDLE\n'
    + `Tools: ${TOOLS.map((t) => t.name).join(', ')}`);
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let pending = 0;
let closed = false;
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try { msg = JSON.parse(trimmed); }
  catch { fail(null, -32700, 'parse error'); return; }
  const batch = Array.isArray(msg) ? msg : [msg];
  for (const one of batch) {
    if (!one || one.jsonrpc !== '2.0' || typeof one.method !== 'string') {
      if (one && one.id !== undefined && one.method === undefined) continue;   // a response to us; nothing to do
      fail(one?.id ?? null, -32600, 'invalid request');
      continue;
    }
    pending += 1;
    handle(one).catch((err) => { if (one.id !== undefined) fail(one.id, -32603, String(err?.message || err)); })
      .finally(() => { pending -= 1; if (closed && !pending) process.exit(0); });
  }
});
rl.on('close', () => { closed = true; if (!pending) process.exit(0); });
