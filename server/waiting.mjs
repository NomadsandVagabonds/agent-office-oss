// The Office — the waiting inbox.
//
// An agent that has done what it can, and is now waiting on somebody, used to
// have two choices: end its turn (and sit there until a human typed something)
// or keep asking. This is the third: sit on the office. `GET /api/inbox/wait`
// holds until there is mail worth waking for and then hands it over, read. Any
// runtime that can run a command can do it (`office wait`), with no hooks and
// without the office owning its process — which is what lets one agent's note
// reach another without a human carrying it.
//
// It is the same machine as mail that wakes a driven session
// (server/harness/wake.mjs), and it burns tokens in the same loop if nobody
// minds it, so it passes the same gate, with the same numbers:
//
//   what wakes   a direct note, a mention, a reply to your request, and
//                anything a human said in your channels. Other agents'
//                channel chatter never does (it is handed over with the rest
//                when something else ends the wait).
//   pause        the office's one switch for automatic turns stops this too.
//   hops         mail more than a few agent-to-agent steps from a human does
//                not end a wait. Two agents answering each other stop here.
//   rate         a minimum gap between pick-ups, and a cap per hour.
//   budget       so many pick-ups before a human has to have spoken to the
//                agent again. A note from a human renews it, and is never held.
//   record       every pick-up is a line in the activity feed.
// Mail a guard rail held back is not lost: it is in the inbox, where
// `office inbox` finds it, and a wait that ends empty says what was held and why.
//
// An agent the office drives does not wait here: the office starts its turns
// (that is wake.mjs's business, with its own opt-in), and a wait would only
// keep its turn open so that nothing could.
const HOUR = 3_600_000;

const WHY = Object.freeze({
  paused: 'automatic pick-ups are paused by the human',
  hops: 'it is too many agent-to-agent steps from a human; a human has to step in',
  budget: 'your pick-ups without a human are spent; a note or a prompt from a human renews them',
  rate: 'you have picked up mail as often as the office allows this hour',
  gap: 'you picked up mail a moment ago',
});

export function createWaiting(ctx) {
  const limits = ctx.cfg.harness.wake;                 // one set of guard rails for every way work starts without a human
  const cfg = ctx.cfg.waiting || { enabled: true, holdMs: 25_000, maxHoldMs: 50_000 };
  const state = new Map();                             // agent id → { times: [], budget }
  const waiters = new Map();                           // agent id → Set<{ check(), since }>

  function st(id) {
    let s = state.get(id);
    if (!s) { s = { times: [], budget: limits.budget }; state.set(id, s); if (state.size > 2000) state.delete(state.keys().next().value); }
    return s;
  }
  const paused = () => !!ctx.harness?.wake?.paused;

  /** May this agent be handed its mail now, without having asked for it? */
  function look(agent) {
    const box = ctx.inbox.collect(agent, { mode: 'hook', limit: 200 });
    const triggers = box.items.filter((m) => m.direct || m.fromType === 'human');
    if (!triggers.length) return { ok: false, reason: 'none', count: 0 };
    const hop = Math.min(...triggers.map((m) => (Number.isFinite(m.hop) ? m.hop : 1)));
    const count = triggers.length;
    if (paused()) return { ok: false, reason: 'paused', count };
    if (hop === 0) return { ok: true, hop };            // a human wrote: nothing holds that back
    if (hop > limits.maxHops) return { ok: false, reason: 'hops', count };
    const s = st(agent.id), now = Date.now();
    if (s.budget <= 0) return { ok: false, reason: 'budget', count };
    s.times = s.times.filter((t) => now - t < HOUR);
    if (s.times.length >= limits.maxPerHour) return { ok: false, reason: 'rate', count, retryInMs: s.times[0] + HOUR - now + 50 };
    const last = s.times[s.times.length - 1] || 0;
    if (now - last < limits.minGapMs) return { ok: false, reason: 'gap', count, retryInMs: last + limits.minGapMs - now + 20 };
    return { ok: true, hop };
  }

  /** Hand it over: everything worth an interruption, read once, counted against the agent's rate and budget. */
  function hand(agent, hop, sinceMs) {
    const box = ctx.inbox.read(agent, { mode: 'hook', ack: true, limit: 20 });
    const s = st(agent.id);
    if (hop === 0) s.budget = limits.budget;            // a human is in the loop again
    else { s.times.push(Date.now()); s.budget -= 1; }
    const from = [...new Set(box.items.filter((m) => m.direct || m.fromType === 'human').map((m) => m.from).filter(Boolean))].slice(0, 4).join(', ');
    ctx.activity.log('wait', `${agent.name} was waiting on the office and picked up mail from ${from || 'a teammate'}`,
      { agentId: agent.id, hop, mail: box.items.length, waitedMs: sinceMs });
    return { ...box, waited: true, timedOut: false, hop, held: null };
  }

  function nothing(agent, verdict, extra = {}) {
    const held = verdict && WHY[verdict.reason] ? { reason: verdict.reason, count: verdict.count || 0, text: WHY[verdict.reason] } : null;
    return { agentId: agent.id, agentName: agent.name, items: [], unread: held ? held.count : 0, direct: 0, waited: true, timedOut: true, held, ...extra };
  }

  /**
   * Hold until there is mail this agent may be woken for, or `timeoutMs` has gone (one request holds for
   * cfg.maxHoldMs at most: whoever is waiting asks again).
   * → what GET /api/inbox gives, read and acknowledged, with `waited: true` · or `{ items: [], timedOut: true,
   *   held: { reason, count, text } | null }` · or null if `signal` aborted (whoever was waiting has gone).
   */
  function wait(agent, opt = {}) {
    const asked = Number(opt.timeoutMs);
    const holdMs = Math.max(0, Math.min(cfg.maxHoldMs, Number.isFinite(asked) && asked >= 0 ? asked : cfg.holdMs));
    if (!cfg.enabled) return Promise.resolve(nothing(agent, null, { off: true, text: 'waiting on the office is switched off here (OFFICE_WAIT=0)' }));
    if (ctx.harness?.isDriven?.(agent.id)) {
      return Promise.resolve(nothing(agent, null, { driven: true,
        text: 'the office starts your turns itself: end this one, and your mail is brought to you as the next (if the human has turned that on for you)' }));
    }
    ctx.agents.seen(agent.id);
    return new Promise((resolve) => {
      const since = Date.now();
      let done = false, timer = null, retry = null, last = null;
      const me = { since, check, end: () => finish(nothing(agent, last)) };
      const set = waiters.get(agent.id) || new Set();
      waiters.set(agent.id, set);
      set.add(me);
      function finish(value) {
        if (done) return;
        done = true;
        clearTimeout(timer); clearTimeout(retry);
        set.delete(me);
        if (!set.size) waiters.delete(agent.id);
        resolve(value);
      }
      function check() {
        if (done) return;
        let verdict;
        try { verdict = look(agent); } catch (err) { ctx.log?.warn?.(`[waiting] ${agent.id}: ${err.message}`); return; }
        if (verdict.ok) { finish(hand(agent, verdict.hop, Date.now() - since)); return; }
        last = verdict;
        if (verdict.retryInMs > 0) {
          clearTimeout(retry);
          retry = setTimeout(check, Math.min(verdict.retryInMs, HOUR));
          retry.unref?.();
        }
      }
      timer = setTimeout(() => finish(nothing(agent, last)), holdMs);
      timer.unref?.();
      if (opt.signal) {
        if (opt.signal.aborted) { finish(null); return; }
        opt.signal.addEventListener('abort', () => finish(null), { once: true });
      }
      check();
    });
  }

  const nudge = (id) => { for (const w of [...(waiters.get(id) || [])]) w.check(); };
  const nudgeAll = () => { for (const id of [...waiters.keys()]) nudge(id); };
  ctx.bus.on('comms:dm', (e) => { if (e.to?.id) nudge(e.to.id); });
  ctx.bus.on('comms:channel', nudgeAll);                // (a mention, or a human in somebody's channel: few are waiting, so ask them all)
  ctx.bus.on('prompt:resolved', nudgeAll);              // the human answered a request
  ctx.bus.on('harness', nudgeAll);                      // (the pause switch is in there)
  // A prompt typed by a person, as the runtime's own hooks report it, puts a human back in the loop.
  ctx.bus.on('agent:prompted', (e) => {
    const agent = ctx.agents.get(e.id);
    if (agent && !agent.selfReported && state.has(e.id)) st(e.id).budget = limits.budget;
  });

  return {
    wait,
    /** Who is sitting on the office right now: [{ agentId, name, since }]. */
    list() {
      const out = [];
      for (const [id, set] of waiters) {
        const agent = ctx.agents.get(id);
        if (agent && set.size) out.push({ agentId: id, name: agent.name, since: Math.min(...[...set].map((w) => w.since)) });
      }
      return out.sort((a, b) => a.since - b.since);
    },
    isWaiting: (agentId) => (waiters.get(agentId)?.size || 0) > 0,
    stats(agentId) {
      const s = state.get(agentId), now = Date.now();
      return { budget: s ? s.budget : limits.budget, usedThisHour: s ? s.times.filter((t) => now - t < HOUR).length : 0 };
    },
    limits: () => ({ minGapMs: limits.minGapMs, maxPerHour: limits.maxPerHour, maxHops: limits.maxHops, budget: limits.budget, holdMs: cfg.holdMs, maxHoldMs: cfg.maxHoldMs, enabled: cfg.enabled }),
    /** Let everybody go (the office is stopping): each wait ends as if its time were up. */
    stop() { for (const set of [...waiters.values()]) for (const w of [...set]) w.end(); },
  };
}
