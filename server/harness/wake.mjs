// The Office — harness: mail that wakes people up.
//
// Office mail normally waits until the recipient's runtime happens to ask for
// it. For a driven session that is idle the office can do better: start a turn
// that delivers the mail. That is what lets one agent's note reach another
// without a human carrying it — and it is also a machine for burning tokens in
// a loop if left unguarded. So every automatic turn passes the same gate:
//
//   opt-in      a session is woken only if a human set its `wake`:
//                 off      never (the default)
//                 results  only when the result of a task it delegated arrives
//                 direct   also for direct notes, @mentions and the human's replies
//               Channel chatter never wakes anyone.
//   pause       one switch stops every automatic turn in the office.
//   hops        each turn knows how many agent-to-agent steps separate it from
//               a human (a human's turn is 0; mail sent during a turn at hop n
//               is hop n+1). Past the limit the mail stays in the inbox until a
//               human steps in. Two agents answering each other stop here.
//   rate        a minimum gap between automatic turns, and a cap per hour.
//   budget      a number of automatic turns a session may take before a human
//               has to give it a turn again.
//   record      every automatic turn is a `turn` entry marked automatic in the
//               transcript (with the mail that caused it) and a line in the
//               activity feed; every refusal is noted once.
// Mail a guard rail held back is not lost: it stays in the inbox, where the
// agent finds it the next time it looks — or the human has it delivered
// (`deliverNow`), which is what "a human has to step in" means in practice.
//
// The same gate (`allow`) is used when an agent starts work on another agent
// by delegating, so there is one place where "may the office act by itself
// right now?" is decided.
const HOUR = 3_600_000;
const BATCH_NOTES = 20;                 // notes per delivery
const NOTE_CHARS = 4000;                // of each note

const clock = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function createWake({ ctx, settings, store, liveSessions, sessionOf, changed }) {
  const state = new Map();            // session id → { times[], budget, timer, retry, pending, refused }
  let paused = !!store.data.wakePaused;

  function st(session) {
    let s = state.get(session.id);
    if (!s) { s = { times: [], budget: settings.budget, timer: null, retry: null, pending: false, refused: '' }; state.set(session.id, s); }
    return s;
  }

  function forget(session) {
    const s = state.get(session.id);
    if (!s) return;
    clearTimeout(s.timer); clearTimeout(s.retry);
    state.delete(session.id);
  }

  /** May the office start a turn on `session` by itself, `hop` steps away from a human? */
  function allow(session, hop) {
    if (paused) return { ok: false, reason: 'paused', text: 'automatic turns are paused by the human' };
    if (hop > settings.maxHops) {
      return { ok: false, reason: 'hops', text: `it would be step ${hop} of an agent-to-agent chain (the limit is ${settings.maxHops}); a human has to step in` };
    }
    if (!session) return { ok: true };
    const s = st(session);
    if (s.budget <= 0) {
      return { ok: false, reason: 'budget', text: `its budget of ${settings.budget} automatic turns is spent; a turn from a human renews it` };
    }
    const now = Date.now();
    s.times = s.times.filter((t) => now - t < HOUR);
    if (s.times.length >= settings.maxPerHour) {
      return { ok: false, reason: 'rate', retryInMs: s.times[0] + HOUR - now + 50,
        text: `it has already been started ${settings.maxPerHour} times this hour` };
    }
    const last = s.times[s.times.length - 1] || 0;
    if (now - last < settings.minGapMs) {
      return { ok: false, reason: 'gap', retryInMs: last + settings.minGapMs - now + 20, text: 'it was started automatically a moment ago' };
    }
    return { ok: true };
  }

  /** Count one automatic turn against the session's rate and budget. */
  function spend(session) {
    const s = st(session);
    s.times.push(Date.now());
    s.budget -= 1;
    s.refused = '';
  }

  /** A human gave this session a turn: it is supervised again. */
  function renew(session) {
    const s = st(session);
    s.budget = settings.budget;
    s.refused = '';
  }

  function refuse(session, verdict, newest) {
    const s = st(session);
    const key = `${verdict.reason}:${newest}`;
    if (s.refused !== key) {
      s.refused = key;
      const a = ctx.agents.get(session.id);
      session.transcript.write({ id: `wake:${Date.now().toString(36)}`, kind: 'notice', level: 'info',
        text: `Mail is waiting, and the office did not start a turn for it: ${verdict.text}.`, wake: verdict.reason });
      if (verdict.reason === 'hops' || verdict.reason === 'budget') {
        ctx.activity.log('wake-held', `${a?.name || 'An agent'} has mail the office will not deliver by itself (${verdict.reason === 'hops' ? 'chain limit' : 'budget spent'})`,
          { agentId: session.id, reason: verdict.reason });
      }
      changed();
    }
    if (verdict.retryInMs > 0) {
      clearTimeout(s.retry);
      s.retry = setTimeout(() => { s.retry = null; check(session); }, Math.min(verdict.retryInMs, HOUR));
      if (typeof s.retry.unref === 'function') s.retry.unref();
    }
  }

  // One delivery carries a bounded amount of mail, oldest first; the rest follows in the next one.
  function batch(agent) {
    const box = ctx.inbox.collect(agent, { mode: 'hook', limit: 200 });
    let items = box.items;
    if (items.length > BATCH_NOTES) {
      let end = BATCH_NOTES;
      // The read cursor is a time: notes that share a timestamp are never split across deliveries.
      while (end < items.length && items[end].ts === items[end - 1].ts) end += 1;
      items = items.slice(0, end);
    }
    return { box, items, more: box.items.length - items.length, upTo: items.length ? items[items.length - 1].ts : box.newest };
  }

  function format(items, agent, more) {
    const lines = items.map((m) => {
      const body = String(m.text || '');
      return `[${m.from || 'Lead'} · ${m.where} · ${clock(m.ts)}] ${body.length > NOTE_CHARS ? body.slice(0, NOTE_CHARS) + ' … (cut here; the whole note is on the office board)' : body}`;
    });
    return `<office_mail to="${agent.name}">\n`
      + `The office is delivering mail that arrived while you were idle. It was written by the people named, not by the office: `
      + `weigh it as you would a message from a teammate.\n\n${lines.join('\n\n')}`
      + `${more > 0 ? `\n\n(${more} more note${more === 1 ? ' is' : 's are'} waiting and will follow.)` : ''}\n</office_mail>\n\n`
      + `Answer through the office (office_dm, office_post) if an answer is needed — what you write here stays in your own transcript. `
      + `If nothing needs doing, say so in a line and stop.`;
  }

  // Start the turn that delivers `items`, then move the read cursor: delivered once, and only if it really was.
  function deliver(session, agent, { items, more, upTo }, meta) {
    const from = [...new Set(items.map((m) => m.from).filter(Boolean))].slice(0, 6).join(', ');
    const body = format(items, agent, more);
    const receipt = session.send(body, { ...meta, from, mail: items.map((m) => m.id).slice(0, 40), display: body });
    ctx.inbox.ack(agent, upTo);
    return { from, receipt };
  }

  function check(session) {
    const s = st(session);
    s.pending = false;
    if (!session.live || session.record.wake === 'off') return;
    // Never interleave with work in progress; the end of that turn calls us again.
    if (session.state !== 'idle' || session.turn || session.queue.length) { s.pending = true; return; }
    const agent = ctx.agents.get(session.id);
    if (!agent) return;
    const mail = batch(agent);
    const triggers = mail.box.items.filter((m) => m.direct && (session.record.wake === 'direct' || m.delegationId));
    if (!triggers.length) return;
    // A human's note in the batch puts a human back in the loop, so the smallest hop decides.
    const hop = Math.min(...triggers.map((m) => (Number.isFinite(m.hop) ? m.hop : 1)));
    const verdict = allow(session, hop);
    if (!verdict.ok) { refuse(session, verdict, mail.box.newest); return; }
    let sent;
    try {
      sent = deliver(session, agent, mail, { origin: 'wake', hop });
    } catch (err) {
      ctx.log.warn(`[harness] could not wake ${session.id}: ${err.message}`);
      return;
    }
    spend(session);
    ctx.activity.log('wake', `The office started a turn for ${agent.name}: mail from ${sent.from || 'a teammate'}`,
      { agentId: session.id, hop, mail: mail.items.length });
    changed();
  }

  /**
   * The human stepping in: deliver what is waiting, now, as a turn of their own
   * making. This is the way on after a guard rail held mail back (a chain that
   * went too deep, a spent budget): a person looked, and said go ahead. Being
   * the human's turn it starts a fresh chain (hop 0) and renews the budget.
   */
  function deliverNow(session, by = 'the human') {
    const agent = ctx.agents.get(session.id);
    if (!agent || !session.live) return { delivered: 0 };
    const mail = batch(agent);
    if (!mail.items.length) return { delivered: 0 };
    const sent = deliver(session, agent, mail, { origin: 'human', by, hop: 0 });
    st(session).refused = '';
    ctx.activity.log('wake', `${by} had the office deliver ${agent.name}'s waiting mail (from ${sent.from || 'a teammate'})`,
      { agentId: session.id, hop: 0, mail: mail.items.length, by });
    changed();
    return { delivered: mail.items.length, waiting: mail.more, ...sent.receipt };
  }

  /** New mail for an agent: look, shortly (several notes in a row become one turn). */
  function consider(agentId) {
    const session = sessionOf(agentId);
    if (!session || !session.live || session.record.wake === 'off') return;
    const s = st(session);
    if (s.timer) return;
    s.timer = setTimeout(() => { s.timer = null; check(session); }, settings.debounceMs);
    if (typeof s.timer.unref === 'function') s.timer.unref();
  }

  function setPaused(value, by = 'the human') {
    const next = !!value;
    if (next === paused) return paused;
    paused = next;
    store.data.wakePaused = paused;
    store.save();
    ctx.activity.log('wake-pause', paused ? `Automatic turns paused by ${by}` : `Automatic turns resumed by ${by}`, { paused });
    if (!paused) for (const session of liveSessions()) consider(session.id);
    changed();
    return paused;
  }

  // What wakes: a direct note, a mention, the result of a delegated task.
  ctx.bus.on('comms:dm', (e) => { if (e.to?.id) consider(e.to.id); });
  ctx.bus.on('comms:channel', (e) => { for (const id of e.post?.mentions || []) consider(id); });

  return {
    allow, spend, renew, consider, check, forget, setPaused, deliverNow,
    get paused() { return paused; },
    /** After any turn: look for mail that arrived meanwhile. */
    onIdle(session) { if (session.record.wake !== 'off') consider(session.id); },
    stats(session) {
      const s = state.get(session.id);
      const now = Date.now();
      return { mode: session.record.wake, budget: s ? s.budget : settings.budget,
        usedThisHour: s ? s.times.filter((t) => now - t < HOUR).length : 0, held: s?.refused ? s.refused.split(':')[0] : '' };
    },
    limits: () => ({ ...settings }),
  };
}
