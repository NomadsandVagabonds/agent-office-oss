// The Office — harness: the HTTP surface.
//
// Which agents exist and what state they are in is open to whoever may read
// the office. A transcript is not: it is what a terminal would show, so it is
// read on this machine only, like a terminal snapshot. Everything that starts a
// process, gives an agent a turn, stops one or answers a permission request is
// loopback-only too, exactly like the terminal endpoints (all lifted only by
// the operator's OFFICE_REMOTE_TERMINALS=1). On top of that, the things only the
// human may do are refused to any caller that presents an agent's session
// token: an agent can delegate, read transcripts and send mail — it cannot
// drive another agent directly, approve anything, or lift the pause.
import { HttpError } from '../http.mjs';
import { SessionError } from './session.mjs';

/** Run a harness call; its refusals carry their own HTTP status. */
async function guard(fn) {
  try { return await fn(); }
  catch (err) {
    if (err instanceof SessionError) throw new HttpError(err.status || 400, err.message);
    throw err;
  }
}

export function registerHarnessRoutes(router, ctx) {
  const { harness } = ctx;
  const { delegations, wake } = harness;
  const local = { loopbackOnly: true };

  /** Refuse callers that are agents (they hold a session token) where only the human may act. */
  function humanOnly(c, what) {
    const caller = harness.callerOf(c.req);
    if (caller.presented) throw new HttpError(403, `agents cannot ${what}; that is for the human`);
    return { by: 'Lead', via: c.req.headers.origin ? 'browser' : 'api' };
  }

  function need(ref) {
    const session = harness.resolve(ref);
    if (!session) throw new HttpError(404, `no driven session matches "${ref}" (GET /api/harness/sessions lists them)`);
    return session;
  }

  /* ---- catalog and state --------------------------------------------------- */

  router.get('/api/harness', () => ({
    enabled: harness.settings.enabled,
    adapters: harness.adapters(),
    catalogErrors: harness.catalog.errors(),
    ...harness.snapshot(),
    limits: { maxSessions: harness.settings.maxSessions, delegate: { ...harness.settings.delegate },
      checkpoints: { ...harness.settings.checkpoints } },
  }), { about: 'Driven sessions: which agents the office can start here, who is running, and the guard rails.' });

  router.get('/api/harness/sessions', (c) => ({ sessions: harness.list({ all: c.query.get('all') === '1' }) }),
    { about: 'Agents the office is driving (?all=1 also lists finished ones).' });

  router.post('/api/harness/sessions', async (c) => guard(async () => {
    humanOnly(c, 'start another agent directly (delegate a task instead: POST /api/delegations)');
    const body = await c.json();
    // Carrying a conversation on with another agent: the summary is built first, so a bad reference starts nothing.
    const handoff = body.context ? harness.handoffFrom(body.context) : null;
    const session = harness.create(body, { kind: 'human' });
    handoff?.attach(session);
    // Most agents answer within a second or two; do not hold the request for a slow one.
    const outcome = await Promise.race([
      session.ready.then(() => 'ready', (err) => err),
      new Promise((resolve) => { const t = setTimeout(() => resolve('starting'), Number(body.waitMs) > 0 ? Math.min(Number(body.waitMs), 30_000) : 20_000); t.unref?.(); }),
    ]);
    if (outcome instanceof Error) throw outcome;
    if (typeof body.text === 'string' && body.text.trim()) session.send(body.text, { origin: 'human', by: 'Lead' });
    return { ok: true, starting: outcome === 'starting', session: harness.describe(session.id), agent: ctx.agents.pub(ctx.agents.get(session.id)) };
  }), { ...local, about: 'Start a driven session: {adapter, cwd?, name?, model?, effort?, agentMode?, mode?:ask|edits|full, wake?:off|results|direct, text?, context?:{session, turns?}} — context carries the work of another session over, as a recorded handoff. What an adapter offers for model, effort and agentMode is in GET /api/harness (adapters[].offers), once it has run here.' });

  router.get('/api/harness/sessions/:ref', (c) => {
    const session = harness.describe(c.params.ref);
    if (!session) throw new HttpError(404, 'no such session');
    return { session };
  }, { about: 'One driven session, by its id or its agent\'s name.' });

  router.patch('/api/harness/sessions/:ref', async (c) => guard(async () => {
    const who = humanOnly(c, 'change how an agent is woken, what it may do or what it runs on');
    const session = need(c.params.ref);
    const body = await c.json();
    if (body.wake !== undefined) {
      if (!['off', 'results', 'direct'].includes(body.wake)) throw new HttpError(400, 'wake must be off, results or direct');
      session.record.wake = body.wake;
      session.transcript.write({ id: `n:wake:${Date.now().toString(36)}`, kind: 'notice', level: 'info',
        text: `Wake set to “${body.wake}” by the human.` });
    }
    // The session knows what its agent can really change, and refuses the rest in words (session.controls
    // says the same thing ahead of time). Each change is written into its record.
    for (const name of ['mode', 'model', 'effort', 'agentMode']) {
      if (body[name] !== undefined) await session.set(name, body[name], who);
    }
    session.emit('changed');
    if (body.wake && body.wake !== 'off') wake.consider(session.id);
    return { ok: true, session: harness.describe(session.id) };
  }), { ...local, about: 'Change a driven session: {wake?:off|results|direct, mode?:ask|edits|full, model?, effort?, agentMode?} — the last three are whatever the agent itself offers (session.controls lists the options).' });

  router.post('/api/harness/sessions/:ref/turn', async (c) => guard(async () => {
    const who = humanOnly(c, 'give another agent a turn directly (send it a note, or delegate a task)');
    const session = need(c.params.ref);
    const body = await c.json();
    const receipt = session.send(body.text, { origin: 'human', by: who.by });
    return { ok: true, ...receipt, session: harness.describe(session.id) };
  }), { ...local, about: 'Give a driven agent a turn: {text}. It waits its turn if the agent is busy.' });

  router.post('/api/harness/sessions/:ref/interrupt', (c) => guard(async () => {
    const who = humanOnly(c, 'stop another agent');
    const session = need(c.params.ref);
    return { ok: true, ...session.interrupt(who.by), session: harness.describe(session.id) };
  }), { ...local, about: 'Stop the turn in flight (and drop turns waiting behind it).' });

  router.delete('/api/harness/sessions/:ref', (c) => guard(async () => {
    humanOnly(c, 'end another agent\'s session');
    const session = need(c.params.ref);
    await session.end('ended from the office');
    return { ok: true, session: harness.describe(session.id) };
  }), { ...local, about: 'End a driven session and its whole process tree.' });

  router.get('/api/harness/sessions/:ref/transcript', (c) => {
    const result = harness.transcript(c.params.ref, {
      after: c.query.get('after') || 0, limit: c.query.get('limit') || 300,
    });
    if (!result) throw new HttpError(404, 'no such session');
    const caller = harness.callerOf(c.req);
    if (caller.agentId) ctx.agents.seen(caller.agentId);
    return result;
    // Loopback-only, like a terminal snapshot: it is the same material — commands, paths, output.
  }, { ...local, about: 'What a driven session did, as a timeline (?after=<seq> for what changed since, &limit=). This machine only.' });

  /* ---- what a turn changed ---------------------------------------------------- */

  // File names in one answer, file content in the other: both are read on this machine only, like the
  // transcript. Reading is not control, so an agent may ask, as it may read a transcript.
  function changeAnswer(c, result) {
    if (!result) throw new HttpError(404, 'no such session');
    if (result.error) throw new HttpError(result.status || 400, result.error);
    const caller = harness.callerOf(c.req);
    if (caller.agentId) ctx.agents.seen(caller.agentId);
    return result;
  }
  const asked = (c, names) => Object.fromEntries(names.filter((name) => c.query.has(name)).map((name) => [name, c.query.get(name)]));

  router.get('/api/harness/sessions/:ref/changes', async (c) => changeAnswer(c, await harness.changes(c.params.ref, asked(c, ['turn']))),
    { ...local, about: 'What each turn of a driven session changed on disk: per turn, the files added, modified, deleted or renamed, with lines added and removed (?turn=n for one turn). From snapshots of its git working tree. This machine only.' });

  router.get('/api/harness/sessions/:ref/diff', async (c) => changeAnswer(c,
    await harness.diff(c.params.ref, asked(c, ['turn', 'from', 'to', 'path', 'context']))),
  { ...local, about: 'The unified diff of one turn (?turn=n) or from the start of one turn to the end of a later one (?from=a&to=b); &path= for one file, &context= lines around a change (3). Bounded, with a truncated flag. This machine only.' });

  router.post('/api/harness/sessions/:ref/requests/:rid', async (c) => guard(async () => {
    const who = humanOnly(c, 'answer a permission request');
    const session = need(c.params.ref);
    const body = await c.json();
    const result = session.answer(c.params.rid, body, { ...who, by: body.author || who.by });
    if (result.error) { c.send(result.status || 400, result); return undefined; }
    return { ...result, session: harness.describe(session.id) };
  }), { ...local, about: 'Answer a request an agent is waiting on: {action:once|always|reject} or {optionId} (also: POST /api/prompts/:id/reply).' });

  /* ---- mail that wakes ------------------------------------------------------ */

  router.post('/api/harness/sessions/:ref/mail', (c) => guard(async () => {
    const who = humanOnly(c, 'have mail delivered to another agent');
    const session = need(c.params.ref);
    return { ok: true, ...wake.deliverNow(session, who.by), session: harness.describe(session.id) };
  }), { ...local, about: 'Deliver an agent\'s waiting office mail now, as a turn (the human stepping in after a guard rail held it).' });

  router.get('/api/harness/wake', () => ({ paused: wake.paused, limits: wake.limits(),
    sessions: harness.list().map((s) => ({ id: s.id, name: s.name, ...s.wakeStats })) }),
  { about: 'Automatic turns: paused or not, the limits, and each session\'s budget.' });

  router.post('/api/harness/wake', async (c) => {
    const who = humanOnly(c, 'pause or resume automatic turns');
    const body = await c.json();
    if (typeof body.paused !== 'boolean') throw new HttpError(400, 'send {paused: true|false}');
    return { ok: true, paused: wake.setPaused(body.paused, who.by) };
  }, { ...local, about: 'The switch that stops every automatic turn: {paused:true|false}.' });

  /* ---- delegation ----------------------------------------------------------- */

  /** Who is delegating: a verified session, an agent that named itself, or (neither) the human. */
  function delegator(c, body) {
    const caller = harness.callerOf(c.req);
    if (caller.verified) return { agentId: caller.agentId, verified: true };
    if (caller.presented) throw new HttpError(401, 'that session token is not valid (the session may have ended)');
    const claimed = body?.from || body?.fromAgentId || c.query.get('from') || '';
    if (claimed) {
      const agent = ctx.agents.resolveRef(claimed);
      if (!agent) throw new HttpError(404, `no agent matches "${claimed}"`);
      ctx.agents.seen(agent.id);
      return { agentId: agent.id, verified: false };
    }
    return {};
  }

  router.get('/api/delegations', (c) => {
    const ref = (name) => { const v = c.query.get(name); return v ? (ctx.agents.resolveRef(v)?.id || v) : undefined; };
    return { delegations: delegations.list({ from: ref('from'), to: ref('to'), status: c.query.get('status') || undefined, limit: c.query.get('limit') }) };
  }, { about: 'Delegated tasks (?from=<agent>&to=<agent>&status=active|completed|failed|cancelled).' });

  router.post('/api/delegations', async (c) => guard(async () => {
    const body = await c.json();
    const who = delegator(c, body);
    const result = delegations.request(body, who);
    if (body.wait) return { ok: true, delegation: await delegations.wait(result.id, body.timeoutMs, who) };
    return { ok: true, delegation: result };
  }), { ...local, about: 'Give another agent a task: {task, to?:<adapter|agent> (left out: the office picks, by remaining allowance when known), from?, title?, role?, model?, mode?, cwd?, context?:{session?,turns?}, wait?, timeoutMs?}.' });

  router.get('/api/delegations/:id', (c) => guard(async () => {
    const d = delegations.get(c.params.id);
    if (!d) throw new HttpError(404, 'no such delegation');
    // `from` (or a session token) says who is waiting: a delegator waiting on its own task gets the result here, not again by mail.
    if (c.query.get('wait') === '1') {
      let who = {};
      try { who = delegator(c, null); } catch { who = {}; }          // reading needs no identity; a stale one is simply nobody
      return { delegation: await delegations.wait(d.id, Number(c.query.get('timeoutMs')) || undefined, who) };
    }
    return { delegation: delegations.view(d) };
  }), { about: 'One delegated task: status and result (?wait=1&timeoutMs=&from=<you> holds until it finishes, needs the human, or times out).' });

  router.post('/api/delegations/:id/cancel', async (c) => guard(async () => {
    const body = await c.json();
    return { ok: true, delegation: delegations.cancel(c.params.id, delegator(c, body), body.reason) };
  }), { ...local, about: 'Cancel a task you delegated (the human may cancel any): {from?, reason?}.' });
}
