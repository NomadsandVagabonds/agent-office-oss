// The Office — HTTP surface. Every endpoint the 2D office ever had is still
// here with the same shape (the classic client runs unmodified against this
// daemon); everything new is additive.
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from './http.mjs';
import { normalizeDeptId } from './tasks.mjs';
import { appendCreation, readCreations } from './creations-store.mjs';
import { isCreationId, slug } from '../core/creations.mjs';
import { LOOK_OPTIONS } from '../core/look.mjs';
import { CAPS, PROVIDER, STATUS, TASK_PRIORITY, TASK_STATUS, EV, normalizeProvider } from '../core/contract.mjs';

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Project context for the filing cabinet. SAFE: never reads .env contents,
// never returns secret values — names only, and only for workspaces the office
// already knows about.
function getProjectInfo(cwd) {
  const out = { cwd, exists: false, claudeMd: null, agentsMd: false,
    envFiles: [], dotClaude: [], skills: [], files: [] };
  try {
    if (!cwd || !fs.statSync(cwd).isDirectory()) return out;
    out.exists = true;
    const ents = fs.readdirSync(cwd, { withFileTypes: true });
    out.envFiles = ents.filter((e) => /^\.env/.test(e.name)).map((e) => e.name).slice(0, 8);
    out.agentsMd = ents.some((e) => e.name === 'AGENTS.md');
    out.files = ents
      .filter((e) => !/^(node_modules|\.git|\.DS_Store)$/.test(e.name))
      .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name))
      .slice(0, 24)
      .map((e) => (e.isDirectory() ? e.name + '/' : e.name));
    const cmd = path.join(cwd, 'CLAUDE.md');
    if (fs.existsSync(cmd)) {
      const txt = fs.readFileSync(cmd, 'utf8').slice(0, 8192);
      const head = txt.split('\n').find((l) => l.trim().startsWith('#'));
      out.claudeMd = {
        heading: (head || 'CLAUDE.md').replace(/^#+\s*/, '').slice(0, 60),
        lines: txt.split('\n').length,
        kb: Math.max(1, Math.round(fs.statSync(cmd).size / 1024)),
      };
    }
    const dc = path.join(cwd, '.claude');
    if (fs.existsSync(dc) && fs.statSync(dc).isDirectory()) {
      out.dotClaude = fs.readdirSync(dc).slice(0, 16);
      const sk = path.join(dc, 'skills');
      if (fs.existsSync(sk)) out.skills = fs.readdirSync(sk).slice(0, 24);
    }
  } catch { /* unreadable — return what we have */ }
  return out;
}

export function registerCoreRoutes(router, ctx) {
  const { cfg, agents, prompts, comms, bbs, tasks, taskApi, runtimes, inbox, activity } = ctx;

  /** Resolve "who is asking" from a query/body reference, or 404 with a hint. */
  function requireAgent(ref) {
    const agent = agents.resolveRef(ref);
    if (!agent) {
      throw new HttpError(404, ref
        ? `no agent matches "${ref}" — join first (POST /api/agents/join) or check GET /api/agents`
        : 'agent reference required (pass ?agent=<id|name>)');
    }
    return agent;
  }
  ctx.requireAgent = requireAgent;

  /* ---- discovery ------------------------------------------------------ */

  router.get('/api', () => ({
    name: 'the-office',
    version: ctx.version,
    contract: {
      events: Object.values(EV), status: STATUS, taskStatus: TASK_STATUS, taskPriority: TASK_PRIORITY,
      providers: Object.values(PROVIDER), caps: CAPS,
    },
    endpoints: router.describe(),
    docs: ['README.md', 'CONTRACT.md', 'AGENTS.md', 'WORLD.md', 'CREATIONS.md'],
  }), { about: 'What this daemon is and everything it can do (start here).' });

  router.get('/api/health', () => {
    const runtime = runtimes.runtimeStatus();
    return {
      status: 'ok',
      version: ctx.version,
      uptimeSec: Math.round((Date.now() - ctx.startedAt) / 1000),
      agents: agents.map.size,
      departments: [...new Set(agents.list().map((a) => a.department?.id).filter(Boolean))].length,
      boards: bbs.getBoards().length,
      tasks: tasks.list().length,
      recentPosts: bbs.getRecent(comms.BBS_RECENT_LIMIT).length,
      pendingPrompts: prompts.pendingCount(),
      clients: ctx.hub.clients.size,
      tmuxAvailable: runtime.tmuxAvailable,
      claudeAvailable: runtime.claudeAvailable,
      codexAvailable: runtime.codexAvailable,
      shellAvailable: runtime.shellAvailable,
      managedSessions: runtime.sessions.filter((s) => s.kind === 'terminal' && s.alive).length,
      drivenSessions: ctx.harness ? ctx.harness.liveCount() : 0,
      codexObserver: ctx.codexObserver.status(),
      world: ctx.world ? ctx.world.summary() : null,
    };
  }, { about: 'Liveness + counts. Check this before assuming the office is down.' });

  /* ---- hook intake + agents ------------------------------------------- */

  router.post('/hook', async (c) => {
    let ev;
    try { ev = await c.json(); } catch { return undefined; }          // bad payloads are ignored
    // A session the office launched says which one it is (hooks/office-hook.sh
    // forwards OFFICE_RUNTIME_SESSION_ID). For a driven session the harness
    // already reports everything from the agent's own stream, so its hooks would
    // only seat a second avatar; for a terminal it makes the join exact.
    const launched = String(c.req.headers['x-office-runtime-session'] || '');
    if (launched && /^[A-Za-z0-9_.:-]{1,80}$/.test(launched)) {
      if (ctx.harness?.isDriven(launched)) return undefined;
      if (ev.runtime_session_id === undefined && ev.runtimeSessionId === undefined) ev.runtime_session_id = launched;
    }
    try { agents.handleHook(ev); } catch (err) { ctx.log.warn('[hook] ' + (err?.message || err)); }
    return undefined;                                                  // 204, always fast
  }, { about: 'Hook/event intake (Claude Code hook JSON, or the same vocabulary from any runtime).' });

  router.get('/state', () => agents.listPublic(), { hidden: true });
  router.get('/api/agents', () => agents.listPublic(), { about: 'Everyone in the office right now.' });
  router.get('/api/agents/:ref', (c) => {
    const agent = requireAgent(c.params.ref);
    return { agent: agents.pub(agent), persona: ctx.personas.forAgent(agent.id),
      place: ctx.world ? ctx.world.placeOf(agent.id) : null };
  }, { about: 'One agent by id or name, with its persona and whereabouts.' });

  router.post('/api/agents/join', async (c) => {
    const body = await c.json();
    const { agent, created } = agents.join(body);
    return { ok: true, created, agent: agents.pub(agent),
      place: ctx.world ? ctx.world.placeOf(agent.id) : null,
      hint: 'Keep your id. Report state with POST /hook (or the office CLI), read mail with GET /api/inbox?agent=<id>.' };
  }, { about: 'Front door for any runtime: {id?, provider, model?, cwd?, name?, handle?, task?} → a desk.' });

  router.post('/api/agents/:ref/heartbeat', (c) => {
    const agent = requireAgent(c.params.ref);
    agents.seen(agent.id);
    return { ok: true, id: agent.id, lastSeen: agent.lastSeen };
  }, { about: 'Keep a self-reporting agent from being swept as stale.' });

  router.post('/api/agents/:ref/leave', (c) => {
    const agent = requireAgent(c.params.ref);
    agents.handleHook({ session_id: agent.id, hook_event_name: 'SessionEnd' });
    return { ok: true, id: agent.id };
  }, { about: 'Clock out.' });

  router.patch('/api/agents/:ref/persona', async (c) => {
    const agent = requireAgent(c.params.ref);
    const body = await c.json();
    const key = ctx.personas.keyOf(agent.id);
    if (!key) throw new HttpError(409, 'this session has no durable persona yet (it needs a cwd or a handle)');
    const { persona, errors } = ctx.personas.patch(key, body);
    agents.refresh(agent.id);
    if (ctx.world) ctx.world.onPersonaChanged(agent.id);
    return { ok: errors.length === 0, errors, persona, agent: agents.pub(agent) };
  }, { about: 'Customize yourself: {look:{species,hair,outfit,…}, desk:{items,deskColor}, card:{…}, name}.' });

  router.get('/api/look-options', () => LOOK_OPTIONS, { about: 'Every valid value for a character look and desk.' });

  router.get('/project', (c) => {
    const cwd = c.query.get('cwd') || '';
    // Only workspaces the office already knows — never an arbitrary path.
    const known = agents.list().some((a) => a.cwd === cwd)
      || Object.values(ctx.personas.data.personas).some((p) => p.cwd === cwd);
    return known ? getProjectInfo(cwd) : { cwd, exists: false, claudeMd: null, agentsMd: false,
      envFiles: [], dotClaude: [], skills: [], files: [] };
  }, { hidden: true });

  /* ---- NEEDS YOU ------------------------------------------------------ */

  router.get('/api/prompts', (c) => {
    const status = c.query.get('status');
    const list = prompts.listPublic();
    return status ? list.filter((p) => p.status === status) : list;
  }, { about: 'NEEDS-YOU requests (?status=pending|resolved).' });

  const replyPrompt = async (c) => {
    const body = await c.json();
    const prompt = prompts.get(c.params.id);
    const who = { by: 'Lead', via: c.req.headers.origin ? 'browser' : 'api' };
    if (prompt?.request || body.action !== undefined || body.optionId !== undefined) {
      // Granting or denying is control, not conversation: this machine only
      // (unless the operator opened terminals to the network), and never an agent.
      if (!c.loopback && !cfg.remoteTerminals) throw new HttpError(403, 'permission requests can only be answered on the machine the office runs on');
      if (ctx.harness?.callerOf(c.req).presented) throw new HttpError(403, 'agents cannot answer permission requests; that is for the human');
      if (!prompt?.request) throw new HttpError(409, 'this request cannot be granted or denied from the office: its runtime only takes a reply');
    }
    return c.result(prompts.reply(c.params.id, body, who));
  };
  router.post('/api/prompts/:id', replyPrompt, { hidden: true });
  router.post('/api/prompts/:id/reply', replyPrompt,
    { about: 'Answer a blocked agent: {text, close?, enter?} — or, when the prompt carries a `request`, {action:once|always|reject} / {optionId}.' });

  /* ---- runtimes + terminals (loopback only) --------------------------- */

  router.get('/api/terminal/status', () => ({ ...runtimes.runtimeStatus(), codexObserver: ctx.codexObserver.status() }));
  router.get('/api/observers', () => ({ codex: ctx.codexObserver.status() }));
  router.get('/api/runtimes', () => runtimes.listRuntimes(), { about: 'Runtimes the office can launch here.' });
  router.get('/api/sessions', () => runtimes.listSessions(), { about: 'Managed terminal sessions.' });
  router.get('/api/terminal/sessions', () => ({ managed: runtimes.listSessions(), live: runtimes.listLiveTerminals() }));

  router.post('/api/terminal/spawn', async (c) => {
    const body = await c.json();
    try {
      return runtimes.spawnSession({
        runtimeId: body.runtimeId,
        name: body.name,
        cwd: body.cwd || process.cwd(),
        task: body.task || '',
        provider: body.provider || 'claude',
        systemPrompt: body.systemPrompt || '',
        command: body.command || '',
        args: Array.isArray(body.args) ? body.args : [],
        claudeArgs: Array.isArray(body.claudeArgs) ? body.claudeArgs : [],
        codexArgs: Array.isArray(body.codexArgs) ? body.codexArgs : [],
        env: body.env && typeof body.env === 'object' ? body.env : {},
      });
    } catch (err) {
      c.send(500, { error: err.message });
      return undefined;
    }
  }, { loopbackOnly: true, about: 'Launch a managed terminal session (claude | codex | gemini | opencode | shell).' });

  router.get('/api/terminal/:id/snapshot', (c) => {
    try {
      return {
        session: runtimes.getSession(c.params.id),
        text: runtimes.capture(c.params.id, Number(c.query.get('lines') || 220), { ansi: c.query.get('ansi') === '1' }),
      };
    } catch (err) {
      c.send(500, { error: err.message });
      return undefined;
    }
  }, { loopbackOnly: true, about: 'What a managed terminal shows right now (?lines=220&ansi=1 keeps colour escapes).' });

  router.post('/api/terminal/:id/input', async (c) => {
    const body = await c.json();
    try {
      // {text, enter?} types text; {keys:["Escape","Up","C-c"]} presses named keys
      if (Array.isArray(body.keys) && body.keys.length) {
        return { ok: true, sessionId: c.params.id, pressed: runtimes.sendKeys(c.params.id, body.keys) };
      }
      runtimes.sendInput(c.params.id, body.text || '', { enter: body.enter !== false });
      return { ok: true, sessionId: c.params.id };
    } catch (err) {
      c.send(500, { error: err.message });
      return undefined;
    }
  }, { loopbackOnly: true, about: 'Type into a managed terminal: {text, enter?} or {keys:["Escape","C-c",…]}.' });

  router.delete('/api/terminal/:id', (c) => {
    runtimes.kill(c.params.id);
    return { ok: true, sessionId: c.params.id };
  }, { loopbackOnly: true });

  /* ---- boards --------------------------------------------------------- */

  router.get('/api/bbs/boards', () => bbs.getBoards());
  router.get('/api/bbs/threads', (c) => bbs.getThreads(c.query.get('board') || undefined));
  router.get('/api/bbs/threads/:id', (c) => {
    const thread = bbs.getThread(c.params.id);
    if (!thread) throw new HttpError(404, 'Thread not found');
    return thread;
  });
  router.get('/api/bbs/recent', (c) => bbs.getRecent(num(c.query.get('limit'), comms.BBS_RECENT_LIMIT)));

  router.post('/api/bbs/threads', async (c) => {
    const { board, subject, author, authorType, content, pinned } = await c.json();
    if (!subject || !content || !author) throw new HttpError(400, 'subject, author, content required');
    const created = bbs.createThread({
      board: board || 'general',
      subject: String(subject).slice(0, 200),
      author: String(author).slice(0, 60),
      authorType: authorType || 'agent',
      content: String(content).slice(0, 8000),
      pinned: !!pinned,
    });
    comms.broadcastBoardRecent();
    return created;
  });

  router.post('/api/bbs/threads/:id/reply', async (c) => {
    const { author, authorType, content } = await c.json();
    if (!author || !content) throw new HttpError(400, 'author, content required');
    const post = bbs.reply({
      threadId: c.params.id,
      author: String(author).slice(0, 60),
      authorType: authorType || 'agent',
      content: String(content).slice(0, 8000),
    });
    if (!post) throw new HttpError(404, 'Thread not found');
    comms.broadcastBoardRecent();
    comms.broadcastOverview();
    return post;
  });

  /* ---- comms ---------------------------------------------------------- */

  router.get('/api/collab/recent', (c) => comms.getCollabRecent(
    c.query.get('agentId') || undefined, num(c.query.get('limit'), comms.COLLAB_RECENT_LIMIT)));
  router.get('/api/comms/overview', () => comms.getOverview(), { about: 'Channels, prompts, recent mail — the whole comms picture.' });
  router.get('/api/channels', () => comms.getChannels(), { about: 'Channels: All Hands + one per project.' });
  router.get('/api/channels/:id/recent', (c) => comms.getChannelRecent(
    c.params.id, num(c.query.get('limit'), comms.CHANNEL_RECENT_LIMIT)));
  router.post('/api/channels/:id/message', async (c) => {
    const body = await c.json();
    return c.result(comms.sendChannelMessage({ ...body, channelId: c.params.id }));
  }, { about: 'Post to a channel: {content, authorAgentId?}. "@name" mentions land in that agent\'s inbox.' });
  router.post('/api/collab/message', async (c) => c.result(comms.sendCollabMessage(await c.json())),
    { about: 'Agent → agent direct note: {fromAgentId, toAgentId, content}. toAgentId:"lead" writes to the human.' });
  router.post('/api/comms/direct-message', async (c) => c.result(comms.sendLeadDirectMessage(await c.json())),
    { about: 'Human → agent direct note: {toAgentId, content}.' });

  router.get('/api/inbox', (c) => {
    const agent = requireAgent(c.query.get('agent') || c.query.get('agentId') || '');
    return inbox.read(agent, {
      since: c.query.has('since') ? Number(c.query.get('since')) : undefined,
      limit: c.query.get('limit'),
      mode: c.query.get('mode'),
      ack: c.query.get('ack') === '1' || c.query.get('ack') === 'true',
    });
  }, { about: 'Unread office mail for ?agent=<id|name> (add &ack=1 to mark it read, &mode=hook for interrupt-worthy only).' });
  router.post('/api/inbox/ack', async (c) => {
    const body = await c.json();
    const agent = requireAgent(body.agent || body.agentId || '');
    return inbox.ack(agent, body.upTo);
  }, { about: 'Advance your read cursor: {agent, upTo?}.' });
  router.get('/api/inbox/wait', async (c) => {
    const agent = requireAgent(c.query.get('agent') || c.query.get('agentId') || '');
    // whoever is waiting may hang up: the wait ends with them, and nothing is marked read for nobody
    const gone = new AbortController();
    c.res.on('close', () => { if (!c.res.writableEnded) gone.abort(); });
    const out = await ctx.waiting.wait(agent, { timeoutMs: c.query.has('timeoutMs') ? Number(c.query.get('timeoutMs')) : undefined,
      tag: c.query.get('tag') || undefined, signal: gone.signal });
    return out === null ? undefined : out;                 // (nobody is there to be told)
  }, { about: 'Hold until there is mail worth waking ?agent=<id|name> for (a direct note, a mention, a human in its channels), then hand it over read; &timeoutMs= (50 s at most: ask again); &tag= replaces an older wait of the same tag. Same guard rails as mail that wakes a driven session.' });
  router.get('/api/inbox/waiting', () => ({ waiting: ctx.waiting.list(), limits: ctx.waiting.limits() }),
    { about: 'Who is sitting on the office waiting for mail right now.' });

  /* ---- tasks ---------------------------------------------------------- */

  router.get('/api/tasks', (c) => {
    const deptId = normalizeDeptId(c.query.get('deptId') || c.query.get('departmentId') || '');
    const assignee = c.query.get('assignee') || '';
    const resolved = assignee ? agents.resolveRef(assignee) : null;
    return { tasks: taskApi.list({
      deptId: deptId || undefined,
      assignee: resolved?.id || undefined,
      status: c.query.get('status') || undefined,
      promptId: c.query.get('promptId') || undefined,
      sessionId: c.query.get('sessionId') || undefined,
    }) };
  }, { about: 'Kanban cards (?deptId=&status=&assignee=).' });
  router.post('/api/tasks', async (c) => c.result(taskApi.create(await c.json())),
    { about: 'Create a card: {title, deptId?, status?, priority?, assignee?, body?, dependsOn?}.' });
  router.get('/api/tasks/:id', (c) => {
    const task = tasks.get(c.params.id);
    if (!task) throw new HttpError(404, 'task not found');
    return { task: taskApi.pub(task) };
  });
  router.patch('/api/tasks/:id', async (c) => c.result(taskApi.update(c.params.id, await c.json())),
    { about: 'Move / edit / assign a card.' });
  router.delete('/api/tasks/:id', (c) => c.result(taskApi.remove(c.params.id)), { about: 'Remove a card.' });

  /* ---- creations ------------------------------------------------------ */

  router.get('/api/creations', () => {
    const store = readCreations(cfg.creationsFile);
    return { creations: store ? store.creations : [] };
  }, { about: 'The legacy: every desk item, hat and sculpture agents have signed.' });

  router.post('/api/creations', async (c) => {
    const body = await c.json();
    const author = agents.resolveRef(body.agent || body.agentId || body.authorAgentId || '');
    const entry = { ...body };
    if (!entry.id && entry.name) entry.id = `c_${slug(entry.name)}_${Math.random().toString(36).slice(2, 6)}`;
    entry.kind = entry.kind || 'item';
    let result;
    try {
      result = appendCreation(cfg.creationsFile, entry, {
        author: author ? author.name : String(body.author || 'Lead').slice(0, 60),
        runtime: author ? (normalizeProvider(author.provider) || 'custom') : 'human',
      });
    } catch (err) {
      throw new HttpError(err.code === 'ELOCKED' ? 503 : 500, err.message);
    }
    if (!result.ok) {
      c.send(400, { error: 'invalid creation', errors: result.errors, notes: result.notes });
      return undefined;
    }
    if (author) {
      agents.seen(author.id);
      ctx.personas.bump(ctx.personas.keyOf(author.id), 'creations');
    }
    ctx.bus.local({ type: 'creation:added', creation: result.creation, by: author || null });
    return { ok: true, creation: result.creation, notes: result.notes };
  }, { about: 'Sign a creation into the legacy (append-only). See CREATIONS.md for the op vocabulary.' });

  router.get('/api/creations/:id', (c) => {
    if (!isCreationId(c.params.id)) throw new HttpError(400, 'creation ids look like c_<name>');
    const store = readCreations(cfg.creationsFile);
    const hit = store?.creations.find((x) => x.id === c.params.id);
    if (!hit) throw new HttpError(404, 'no such creation');
    return { creation: hit };
  });

  /* ---- activity ------------------------------------------------------- */

  router.get('/api/activity', (c) => {
    const since = Number(c.query.get('since') || 0);
    const limit = Math.min(500, num(c.query.get('limit'), 60));
    return { items: since ? activity.since(since, limit) : activity.recent(limit) };
  }, { about: 'What happened (?since=<ms>): arrivals, card moves, discoveries…' });
}
