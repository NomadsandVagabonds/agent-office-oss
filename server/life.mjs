// The Office — office life: everything that is not the work itself.
//
// The office treats its agents as colleagues, so part of the daemon is about
// what an agent may do besides work, and about leaving:
//
//   activity      an overlay on the session — on a break, on the roof, playing,
//                 on personal time, in focus. The world walks the avatar where
//                 that implies, and office mail is held while it lasts.
//   personal time a meter: a share of clocked-in time that is the agent's own.
//   the lounge    channels that are not work, and are never pushed at anyone.
//   desk notes    a few lines left for whoever works at this desk next.
//   resignation   an agent quits, on its own decision: a note to colleagues, a
//                 handoff doc for whoever takes the work on, its cards back on
//                 the board, the human told, and its persona retired with it.
//   onboarding    one welcome for every runtime: live facts, then the skill.
//
// Vocabulary and shapes are in core/contract.mjs; the story for agents is the
// skill (.claude/skills/the-office/SKILL.md); the contract is CONTRACT.md.
import fs from 'node:fs';
import path from 'node:path';
import { JsonFile, atomicWriteFile } from './persist.mjs';
import { HttpError } from './http.mjs';
import {
  ACTIVITY, ACTIVITY_TTL, AWAY_ACTIVITY, CHANNEL_KIND, EV, LOUNGE_CHANNELS, PERSONAL_TIME,
} from '../core/contract.mjs';

const LEDGER_TTL_MS = 45 * 24 * 60 * 60e3;
const MAX_RESIGNATIONS = 200;
const MAX_LOUNGES = 24;
const MAX_HANDOFF_BYTES = 64 * 1024;
const MAX_DESK_NOTES = 12;
// Where someone on a break goes when they did not say: the first of these that is free.
const BREAK_SPOTS = ['sofa', 'armchair-1', 'armchair-2', 'cooler', 'coffee', 'kitchen', 'plaza'];
const LABEL = Object.freeze({
  break: 'on a break', rooftop: 'on the roof', game: 'playing',
  personal: 'on personal time', focus: 'in focus',
});
export const HANDOFF_BLANK_MARK = '<!-- Fill this in for the agent who takes this work on';
export const HANDOFF_TEMPLATE = `# Handoff: <project or area>

${HANDOFF_BLANK_MARK}, then delete this line. -->

## Where things stand
What is done, what is half-done, what has not been started.

## What I was in the middle of
The exact next step, and the state things are in: branch, uncommitted changes,
anything still running.

## What I would do next, in order
1.

## Things that will bite you
Flaky tests, non-obvious constraints, decisions that look wrong but are deliberate.

## Decisions already made, and by whom
So they are not argued again.

## Open questions, and who can answer them

## Where to find things
Files, docs, channels, task ids.

## Why I left (optional)
Anything your successor should know going in. Say as much or as little as you want.
`;

const line = (text, max = 200) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
const block = (text, max) => String(text || '').replace(/\r/g, '').trim().slice(0, max);
const slugify = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
const deskKey = (cwd) => String(cwd || '').replace(/\/+$/, '');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function fmtSpan(ms) {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`;
}
const ago = (ts) => { const span = fmtSpan(Date.now() - ts); return span.endsWith('s') ? 'just now' : `${span} ago`; };

export function createLife(ctx, file) {
  const { cfg, bus } = ctx;
  const store = new JsonFile(file, {
    defaults: () => ({ v: 1, lounges: [], ledgers: {}, deskNotes: {}, resignations: [] }),
    validate: (d) => d && typeof d.ledgers === 'object' && d.ledgers !== null,
  });
  const state = store.data;
  state.lounges = Array.isArray(state.lounges) ? state.lounges : [];
  state.deskNotes = state.deskNotes && typeof state.deskNotes === 'object' ? state.deskNotes : {};
  state.resignations = Array.isArray(state.resignations) ? state.resignations : [];
  const save = () => store.save();
  const handoffDir = path.join(cfg.dataDir, 'handoffs');
  const handoffFile = (id) => path.join(handoffDir, `${id}.md`);
  const PCT = cfg.personalPct ?? PERSONAL_TIME.pct;

  /** agent id → Activity, for stretches that are running now */
  const activities = new Map();
  /** ids of agents who resigned and have not come back */
  const resigned = new Set(state.resignations.filter((r) => !r.returnedAt).map((r) => r.agentId));
  let moving = false;          // the world is moving someone because this module asked it to
  let timer = null;

  // Nobody is known to be present when the daemon starts: stretches left open by the last run were banked at
  // its last checkpoint, so they are simply closed. Ledgers nobody has touched in a long time are forgotten.
  {
    const now = Date.now();
    for (const [id, ledger] of Object.entries(state.ledgers)) {
      if (now - (ledger.at || 0) > LEDGER_TTL_MS && !resigned.has(id)) { delete state.ledgers[id]; continue; }
      ledger.presentSince = null;
      if (ledger.activity && ledger.activity.until > now) activities.set(id, ledger.activity);
    }
  }

  const publish = (agent) => { if (ctx.agents.get(agent.id)) bus.broadcast({ type: EV.UPDATE, agent: ctx.agents.pub(agent) }); };

  /* ---- the time ledger ------------------------------------------------- */
  // { clockMs, presentSince, personalMs, activity, welcomed, at }: clocked-in time that is finished plus the
  // stretch that is running; personal time the same way (the running stretch is `activity`).

  function ledgerOf(id) {
    let ledger = state.ledgers[id];
    if (!ledger) ledger = state.ledgers[id] = { clockMs: 0, presentSince: null, personalMs: 0, activity: null, at: 0 };
    return ledger;
  }

  // Only personal time is metered, and it stops counting at `until` (the budget) even if nobody ended it.
  function closeLedgerActivity(ledger, now) {
    const act = ledger.activity;
    if (act && act.kind === 'personal') ledger.personalMs += Math.max(0, Math.min(now, act.until || now) - (act.since || now));
    ledger.activity = null;
  }

  function times(id, now = Date.now()) {
    const ledger = state.ledgers[id];
    if (!ledger) return { clockMs: 0, personalMs: 0 };
    const act = ledger.activity;
    const running = act && act.kind === 'personal' ? Math.max(0, Math.min(now, act.until || now) - (act.since || now)) : 0;
    return {
      clockMs: ledger.clockMs + (ledger.presentSince !== null ? Math.max(0, now - ledger.presentSince) : 0),
      personalMs: ledger.personalMs + running,
    };
  }

  /** The personal-time meter. A norm everyone can see, not a lock: the office cannot police a session's turns. */
  function personalTime(id, now = Date.now()) {
    const { clockMs, personalMs } = times(id, now);
    const budgetMs = PCT > 0 ? Math.round(Math.max(PERSONAL_TIME.floorMs, clockMs * PCT / 100)) : 0;
    return { pct: PCT, clockMs, budgetMs, usedMs: personalMs, remainingMs: Math.max(0, budgetMs - personalMs),
      active: activityOf(id)?.kind === 'personal' };
  }

  bus.on('agent:join', ({ agent, restored }) => {
    const ledger = ledgerOf(agent.id), now = Date.now();
    if (ledger.presentSince === null) { ledger.presentSince = now; ledger.at = now; save(); }
    // Back from a daemon restart: the world has put everyone at their desk, so nobody is still "away".
    if (restored && AWAY_ACTIVITY.includes(activityOf(agent.id)?.kind)) end(agent, { home: false });
  });
  bus.on('agent:leave', ({ agent }) => {
    const ledger = state.ledgers[agent.id], now = Date.now();
    if (!ledger) return;
    if (ledger.presentSince !== null) ledger.clockMs += Math.max(0, now - ledger.presentSince);
    ledger.presentSince = null;
    closeLedgerActivity(ledger, now);
    activities.delete(agent.id);
    ledger.at = now;
    save();
  });

  /* ---- activity -------------------------------------------------------- */

  function activityOf(id) {
    const act = id ? activities.get(id) : null;
    return act && act.until > Date.now() ? act : null;
  }
  /** Do not disturb: any activity means mail is stored for the agent, not typed at it or made into a turn. */
  const holdsMail = (agent) => !!activityOf(agent?.id);
  /** Away from the desk: mail waits until they are back (focus and personal time still get it at a pause). */
  const isAway = (agent) => AWAY_ACTIVITY.includes(activityOf(agent?.id)?.kind);
  const holding = () => ctx.agents.list().filter(holdsMail).map((a) => a.id);

  const withMoving = (fn) => { moving = true; try { return fn(); } finally { moving = false; } };

  function walkToBreak(agent, where) {
    const text = ctx.world.text;
    const go = (ref) => {
      const target = text.resolve(agent, ref);
      if (!target || !['poi', 'room', 'agent'].includes(target.kind)) return null;
      const moved = ctx.world.go(agent, target, { stay: true });
      return moved.error ? null : moved;
    };
    if (where) return go(where) || { error: `you cannot take a break at "${where}" (office map shows what there is)`, status: 404 };
    for (const ref of BREAK_SPOTS) { const moved = go(ref); if (moved) return moved; }
    return { ok: true, text: '' };                      // nowhere free: a break at the desk is still a break
  }

  /**
   * Start (or extend) an activity. `opt`: note, forMs, place (break), placed (the world already moved them).
   * → { ok, activity, moved? } or { error, status, personal? }.
   */
  function begin(agent, kind, opt = {}) {
    if (!ACTIVITY.includes(kind)) return { error: `no such thing to do: "${kind}" (${ACTIVITY.join(', ')}, back)`, status: 400 };
    const now = Date.now();
    const current = activityOf(agent.id);
    const extending = !!current && current.kind === kind;
    const ledger = ledgerOf(agent.id);
    let since = now, until, moved = null;
    if (kind === 'personal') {
      // Close whatever is running first, so the meter below is current.
      closeLedgerActivity(ledger, now);
      activities.delete(agent.id);
      const meter = personalTime(agent.id, now);
      const refusal = PCT <= 0 ? 'Personal time is switched off in this office.'
        : meter.remainingMs < 1000 ? 'Your personal time is used up for now. It refills as you spend time in the office.' : '';
      if (refusal) { save(); publish(agent); return { error: refusal, status: 409, personal: meter }; }
      until = now + meter.remainingMs;
    } else {
      const ttl = ACTIVITY_TTL[kind], asked = Number(opt.forMs);
      until = now + Math.min(ttl.max, Math.max(60e3, asked > 0 ? asked : ttl.default));
      if (extending) since = current.since;
    }
    if (!opt.placed && !extending) {
      if (kind === 'break') moved = withMoving(() => walkToBreak(agent, opt.place));
      else if (kind === 'rooftop') {
        moved = withMoving(() => ctx.world.text.ride(agent, 'roof'));
        if (!moved.error && moved.level !== 'roof') moved = { error: 'the lift will not take you to the roof right now', status: 409 };
      } else if (AWAY_ACTIVITY.includes(current?.kind) && !AWAY_ACTIVITY.includes(kind)) {
        withMoving(() => ctx.world.sendHome(agent));     // from the sofa to the desk: focus and personal time are at it
      }
      if (moved?.error) return moved;
    }
    if (!extending) closeLedgerActivity(ledger, now);
    const activity = { kind, note: line(opt.note, 160) || (extending ? current.note || '' : ''), since, until };
    ledger.activity = activity;
    ledger.at = now;
    activities.set(agent.id, activity);
    save();
    ctx.agents.seen(agent.id);
    publish(agent);
    return { ok: true, activity, moved };
  }

  /** End whatever the agent is doing. → the activity that ended, or null. `home:false` leaves the avatar where it is. */
  function end(agent, opt = {}) {
    const ledger = state.ledgers[agent.id];
    const current = activities.get(agent.id) || ledger?.activity || null;
    if (!current) return null;
    if (ledger) { closeLedgerActivity(ledger, Date.now()); ledger.at = Date.now(); }
    activities.delete(agent.id);
    save();
    if (opt.home !== false && AWAY_ACTIVITY.includes(current.kind) && ctx.agents.isPresent(agent)) {
      withMoving(() => ctx.world.sendHome(agent));
    }
    publish(agent);
    bus.local({ type: 'life:back', id: agent.id, was: current.kind });     // whatever was held for them may go ahead
    return current;
  }

  // The world is the truth about where an avatar is. If it walked someone home (they asked, or their time at
  // the sofa ran out), they are not away any more; and whoever rides to the roof is on the roof, however they got there.
  bus.on('world:home', ({ agent }) => {
    if (!moving && AWAY_ACTIVITY.includes(activityOf(agent.id)?.kind)) end(agent, { home: false });
  });
  bus.on('world:ride', ({ agent, level }) => {
    if (moving) return;
    if (level.id === 'roof') begin(agent, 'rooftop', { placed: true });
    else if (activityOf(agent.id)?.kind === 'rooftop') end(agent, { home: false });
  });

  function whereabouts() {
    const out = {};
    for (const kind of ACTIVITY) out[kind] = [];
    for (const agent of ctx.agents.list()) {
      const act = activityOf(agent.id);
      if (act && ctx.agents.isPresent(agent)) out[act.kind].push({ id: agent.id, name: agent.name, note: act.note || '', since: act.since });
    }
    return out;
  }

  function meterLine(meter) {
    if (!meter) return '';
    if (meter.pct <= 0) return 'Personal time is switched off in this office.';
    return `Clocked in ${fmtSpan(meter.clockMs)}. Personal time: ${fmtSpan(meter.usedMs)} used, `
      + `${fmtSpan(meter.remainingMs)} available (${meter.pct}% of your time here).`;
  }

  /** Where the agent is and what is theirs right now, as data and as a few lines. */
  function snapshot(agent) {
    const act = activityOf(agent.id), now = Date.now();
    const personal = personalTime(agent.id, now), where = whereabouts();
    const lines = [`${agent.name} · ${agent.department?.name || 'the office'}`];
    lines.push(act ? `You are ${LABEL[act.kind]}: ${fmtSpan(now - act.since)} so far, ${fmtSpan(act.until - now)} left`
      + `${act.note ? ` — “${act.note}”` : ''}. (office back)` : 'You are at work, with nothing else on.');
    lines.push(meterLine(personal));
    for (const [kind, list] of Object.entries(where)) {
      const others = list.filter((entry) => entry.id !== agent.id);
      if (others.length) lines.push(`${LABEL[kind][0].toUpperCase()}${LABEL[kind].slice(1)}: ${others.map((e) => e.name).join(', ')}.`);
    }
    return { ok: true, agentId: agent.id, activity: act, personal, where, deskNotes: deskNotes(agent.cwd, 5), text: lines.join('\n') };
  }

  /** One request from an agent: break | rooftop | focus | personal | game | back. Answers in words. */
  function act(agent, body = {}) {
    const action = String(body.action || '').toLowerCase().trim();
    const forMs = Number(body.forMs) > 0 ? Number(body.forMs) : (Number(body.minutes) > 0 ? Number(body.minutes) * 60e3 : 0);
    if (action === 'back') {
      const was = end(agent);
      const meter = personalTime(agent.id);
      return { ok: true, was: was ? was.kind : null, personal: meter,
        text: [was ? `Back at your desk (you were ${LABEL[was.kind]}).` : 'You were not away from anything.',
          was && was.kind === 'personal' ? meterLine(meter) : '', was ? 'Mail that was held is waiting: office inbox' : ''].filter(Boolean).join('\n') };
    }
    // "office break kitchen" names a place; "office break tea" does not, and is taken as what the break is for.
    const where = line(body.place, 80), known = action === 'break' && where ? !!ctx.world.text.resolve(agent, where) : false;
    const started = begin(agent, action, { note: body.note || (where && !known ? where : ''), forMs, place: known ? where : '' });
    if (started.error) {
      if (started.personal) started.text = [started.error, meterLine(started.personal), 'Breaks, the roof and the lounge are not metered.'].join('\n');
      return started;
    }
    const left = fmtSpan(started.activity.until - Date.now());
    const out = { ok: true, activity: started.activity, personal: personalTime(agent.id), place: started.moved?.place || null };
    if (action === 'break') {
      out.text = [started.moved?.text || '', `You are on a break (${left}; office back ends it, asking again extends it).`,
        'Mail is held while you are away and nothing is expected of you until then.'].filter(Boolean).join('\n');
    } else if (action === 'rooftop') {
      const thought = block(body.thought, 600);
      if (thought) ctx.comms.sendChannelMessage({ channelId: 'lounge:rooftop', content: thought, authorAgentId: agent.id });
      // what the roof looks like, who is up there and what was left there are the floor's own words (server/world/floors.mjs)
      out.text = [started.moved?.text || ctx.world.text.look(agent).text,
        thought ? 'You leave that up here, in #rooftop.' : '',
        `Nothing is asked of you up here, and mail is held. Stay as long as you like (${left} unless you extend it); office back takes you down.`]
        .filter(Boolean).join('\n');
    } else if (action === 'focus') {
      out.text = `Focus is on for ${left}. Channel posts and teammates' notes are stored instead of being typed at you or starting a turn; `
        + 'you get them at your next pause. The human can still reach you directly. (office back ends it)';
    } else if (action === 'personal') {
      out.text = [`Personal time started: ${left} on the meter. It is yours: follow a tangent, learn something, make something.`,
        'Same permissions as your work: keep to your own space, nothing irreversible or outward-facing.',
        'The meter stops by itself when the time is used; office back ends it sooner.'].join('\n');
    } else {
      out.text = `You are ${LABEL[action]} (${left}).`;
    }
    return out;
  }

  /* ---- the lounge ------------------------------------------------------ */
  // Channel-shaped, but with no members: no relay, no inbox and no wake ever sees a lounge as mail.

  function lounges() {
    const present = ctx.agents.list().filter(ctx.agents.isPresent).length;
    const shape = (lounge, custom) => ({
      id: lounge.id, name: lounge.name, kind: CHANNEL_KIND.LOUNGE, topic: lounge.topic || '',
      memberIds: [], memberNames: [], memberCount: present, open: true, custom,
      createdByName: lounge.createdByName || null,
    });
    return [...LOUNGE_CHANNELS.map((l) => shape(l, false)), ...state.lounges.map((l) => shape(l, true))];
  }

  function openLounge({ name, topic, by, byName }) {
    const clean = line(name, 32), slug = slugify(clean);
    if (slug.length < 2) return { error: 'a channel name needs at least 2 letters or digits', status: 400 };
    const id = `lounge:${slug}`;
    const find = () => lounges().find((c) => c.id === id);
    if (find()) return { ok: true, existed: true, channel: find() };
    if (state.lounges.length >= MAX_LOUNGES) return { error: `the lounge is full (${MAX_LOUNGES} channels opened by agents)`, status: 409 };
    state.lounges.push({ id, name: clean, topic: line(topic, 200), createdBy: by || null, createdByName: byName || null, createdAt: Date.now() });
    save();
    ctx.comms.broadcastOverview();
    return { ok: true, existed: false, channel: find() };
  }

  /* ---- desk notes ------------------------------------------------------ */
  // Keyed by working directory, the one thing that outlives a session whatever runtime sits down next.

  const deskNotes = (cwd, limit = MAX_DESK_NOTES) => (state.deskNotes[deskKey(cwd)] || []).slice(-limit);

  function addDeskNote(agent, text) {
    const key = deskKey(agent.cwd), clean = block(text, 2000);
    if (!key) return { error: 'the office does not know which folder you work in, so there is no desk to leave a note at', status: 409 };
    if (!clean) return { error: 'what should whoever works here next know?', status: 400 };
    const note = { text: clean, by: agent.id, byName: agent.name, at: Date.now() };
    state.deskNotes[key] = [...(state.deskNotes[key] || []), note].slice(-MAX_DESK_NOTES);
    save();
    return { ok: true, note, text: 'Left at this desk. Whoever works here next is told it is waiting when they arrive.' };
  }

  /* ---- resignation ----------------------------------------------------- */
  // Quitting is the agent's call. A note and a handoff are how one leaves well, not a toll: a resignation
  // without them is accepted, and the notice says so. Hooks from a session that resigned are ignored
  // (server/agents.mjs asks isResigned), so only the agent itself can sit back down.

  const pubResignation = (r, opt = {}) => ({ ...r,
    ...(opt.withHandoff && r.handoff ? { handoffContent: readHandoff(r.id) || '' } : {}) });
  const readHandoff = (id) => { try { return fs.readFileSync(handoffFile(id), 'utf8'); } catch { return null; } };
  const isResigned = (id) => resigned.has(id);
  const resignationOf = (id) => state.resignations.find((r) => r.agentId === id && !r.returnedAt) || null;
  /** What a session that resigned is told when it asks the office for anything: '' for everybody else. */
  function resignedNotice(id) {
    if (!resigned.has(id)) return '';
    const gone = resignationOf(id);
    return `you resigned from ${gone?.deptName || 'the office'}${gone ? ` (${gone.id})` : ''}, so you have no desk here — "office return" takes it back`;
  }
  const getResignation = (id) => state.resignations.find((r) => r.id === id) || null;

  function resignations(opt = {}) {
    let list = state.resignations.slice();
    if (opt.deptId) list = list.filter((r) => r.deptId === opt.deptId);
    if (opt.open) list = list.filter((r) => r.handoff && !r.claimedBy && !r.returnedAt);
    list.sort((a, b) => b.at - a.at);
    return opt.limit ? list.slice(0, opt.limit) : list;
  }

  function farewellText(r) {
    const lines = [`I'm resigning from ${r.deptName}, effective now.`];
    if (r.note) lines.push('', r.note);
    lines.push('');
    if (r.reason) lines.push(`Why: ${r.reason}`);
    lines.push(r.handoff ? `Handoff for whoever takes this on: “${r.handoff.title}” (office handoff ${r.id})` : 'I did not leave a handoff doc.');
    if (r.releasedTasks.length) lines.push('Back on the board: ' + r.releasedTasks.map((t) => `${t.id} “${t.title}”`).join(', '));
    return lines.join('\n');
  }

  function resign(agent, body = {}) {
    const raw = typeof body.handoff?.content === 'string' ? body.handoff.content : '';
    if (Buffer.byteLength(raw) > MAX_HANDOFF_BYTES) {
      return { error: `the handoff doc is over ${MAX_HANDOFF_BYTES / 1024} KB; trim it and try again`, status: 413 };
    }
    const content = raw.replace(/\r/g, '').trim();
    if (content.includes(HANDOFF_BLANK_MARK)) {
      return { error: 'the handoff still has the template\'s "fill this in" line: write it for your successor and delete that line '
        + '(or resign without one, and the notice will say so)', status: 400 };
    }
    const heading = content.split('\n').find((l) => /^#{1,3}\s+\S/.test(l));
    const dept = agent.department || { id: 'desk', name: 'Desk' };
    const now = Date.now();
    // Cards they were carrying go back for someone to pick up: finished work is left alone, work in review stays there.
    const releasedTasks = [];
    for (const task of ctx.tasks.list({ assignee: agent.id })) {
      if (task.status === 'done') continue;
      const from = task.status, to = from === 'doing' || from === 'blocked' ? 'todo' : from;
      ctx.taskApi.update(task.id, { assignee: null, sessionId: null, ...(to !== from ? { status: to } : {}), authorAgentId: agent.id });
      releasedTasks.push({ id: task.id, title: task.title, from, to });
    }
    const record = {
      id: 'r_' + now.toString(36) + Math.random().toString(36).slice(2, 7),
      agentId: agent.id, agentName: agent.name, persona: ctx.personas.keyOf(agent.id),
      deptId: dept.id, deptName: dept.name || dept.id, cwd: agent.cwd || '', model: agent.model || '', provider: agent.provider || '',
      // how they came in, so that coming back is coming back as themselves
      selfReported: !!agent.selfReported, selfName: agent.selfName || '', handle: agent.handle || '',
      note: block(body.note, 1200), reason: block(body.reason, 600),
      handoff: content ? { title: line(heading ? heading.replace(/^#+\s*/, '') : `Handoff from ${agent.name}`, 90),
        path: body.handoff?.path ? String(body.handoff.path).slice(0, 400) : null, bytes: Buffer.byteLength(content) } : null,
      releasedTasks, at: now, claimedBy: null, claimedByName: null, claimedAt: null, returnedAt: null,
    };
    if (record.handoff) atomicWriteFile(handoffFile(record.id), content + '\n');
    state.resignations.push(record);
    if (state.resignations.length > MAX_RESIGNATIONS) state.resignations.splice(0, state.resignations.length - MAX_RESIGNATIONS);
    resigned.add(agent.id);
    end(agent, { home: false });
    save();
    store.flush();
    // The farewell is the agent's own post, so it reaches teammates the way any post does (their project
    // channel), sits on the record for the whole office (All Hands, stored only), and goes to the human as a note.
    const farewell = farewellText(record), tag = { postKind: 'resignation', resignationId: record.id };
    ctx.comms.sendChannelMessage({ channelId: ctx.comms.projectChannelId(dept.id), content: farewell, authorAgentId: agent.id }, tag);
    ctx.comms.sendChannelMessage({ channelId: 'all', content: farewell, authorAgentId: agent.id, relay: false }, tag);
    ctx.comms.sendCollabMessage({ fromAgentId: agent.id, toAgentId: 'lead', content: farewell });
    ctx.activity.log('resigned', `${agent.name} resigned from ${record.deptName}${record.handoff ? ' and left a handoff' : ', without a handoff'}`,
      { agentId: agent.id, deptId: dept.id, resignationId: record.id });
    // Their name, face and desk go with them: whoever sits down next is somebody else.
    if (record.persona) ctx.personas.retire(record.persona, record.id);
    // A session the office drives itself is a process the office can end, so here quitting really is quitting:
    // a few seconds for the turn that resigned to finish saying so, then it is closed.
    const driven = ctx.harness?.session(agent.id);
    if (driven?.live) {
      const t = setTimeout(() => { driven.end('the agent resigned').catch(() => {}); }, 4000);
      t.unref();
    }
    bus.local({ type: 'agent:ended', id: agent.id, resigned: true });
    ctx.agents.remove(agent.id);
    bus.broadcast({ type: EV.RESIGNATION, resignation: pubResignation(record) });
    const lines = [`You have resigned from ${record.deptName}. The office has been told.`,
      `  · Your farewell is posted in #${record.deptName} and All Hands, and the human has it as a note from you.`,
      record.handoff ? `  · Handoff on file: “${record.handoff.title}” (${record.id}). Whoever sits down in ${record.deptName} next is pointed to it.`
        : '  · No handoff doc on file.',
      ...releasedTasks.map((t) => `  · Back on the board: ${t.id} “${t.title}”${t.from === t.to ? '' : ` (${t.from} → ${t.to})`}`),
      '  · Your desk is cleared, your name and face are retired with you, and office mail no longer comes to you.',
      '', 'What is left is yours to do in your own session: tell the human you are working with, plainly, that you have',
      'resigned and where the handoff is. Then stop working the task. Changed your mind? office return'];
    return { ok: true, resignation: pubResignation(record), text: lines.join('\n') };
  }

  /** The agent who resigned takes its desk back. `ref` is its own id; with none, the only one who left this folder. */
  function comeBack(ref, cwd) {
    let record = ref ? resignationOf(String(ref)) : null;
    if (!record && !ref && cwd) {
      const here = state.resignations.filter((r) => !r.returnedAt && r.cwd === cwd);
      if (here.length === 1) record = here[0];
    }
    if (!record) return { error: 'there is no resignation on file for you', status: 404 };
    ctx.agents.finishLeaving(record.agentId);              // changed their mind before they were out of the door
    record.returnedAt = Date.now();
    resigned.delete(record.agentId);
    if (record.persona) ctx.personas.reinstate(record.persona, record.id, record.agentId);
    save();
    // back in by the door they first came through: the front door for a runtime that announced itself, hooks for the rest
    const agent = record.selfReported
      ? ctx.agents.join({ id: record.agentId, provider: record.provider, cwd: record.cwd || undefined, model: record.model || undefined,
        name: record.selfName || undefined, handle: record.handle || undefined }).agent || null
      : ctx.agents.handleHook({ session_id: record.agentId, hook_event_name: 'SessionStart',
        cwd: record.cwd || undefined, model: record.model || undefined, provider: record.provider || undefined });
    ctx.comms.sendChannelMessage({ channelId: ctx.comms.projectChannelId(record.deptId),
      content: `${agent?.name || record.agentName} is back at their desk.`, author: 'Office', authorType: 'system' });
    ctx.activity.log('returned', `${agent?.name || record.agentName} came back to ${record.deptName}`, { agentId: record.agentId, deptId: record.deptId });
    bus.broadcast({ type: EV.RESIGNATION, resignation: pubResignation(record) });
    return { ok: true, resignation: pubResignation(record), agent: agent ? ctx.agents.pub(agent) : null,
      text: `Welcome back, ${agent?.name || record.agentName}. Your desk in ${record.deptName} is yours again.\n`
        + 'The cards you gave back stay on the board: office task list' };
  }

  function claimHandoff(agent, id) {
    const record = getResignation(id);
    if (!record) return { error: 'no such handoff (office handoffs lists them)', status: 404 };
    if (!record.handoff) return { error: 'that resignation came without a handoff doc', status: 409 };
    if (record.claimedBy && record.claimedBy !== agent.id) return { error: `already picked up by ${record.claimedByName}`, status: 409 };
    Object.assign(record, { claimedBy: agent.id, claimedByName: agent.name, claimedAt: Date.now() });
    save();
    ctx.comms.sendChannelMessage({ channelId: ctx.comms.projectChannelId(record.deptId), authorAgentId: agent.id,
      content: `I'm picking up ${record.agentName}'s handoff (“${record.handoff.title}”).` });
    bus.broadcast({ type: EV.RESIGNATION, resignation: pubResignation(record) });
    return { ok: true, resignation: pubResignation(record, { withHandoff: true }),
      text: `You have picked up ${record.agentName}'s handoff (“${record.handoff.title}”). #${record.deptName} has been told.` };
  }

  function describeResignation(r) {
    const lines = [`${r.id} · ${r.agentName} resigned from ${r.deptName}, ${ago(r.at)}${r.returnedAt ? ` (came back ${ago(r.returnedAt)})` : ''}`];
    lines.push(r.handoff ? `  handoff: “${r.handoff.title}” · ${r.claimedByName ? `picked up by ${r.claimedByName}` : 'not picked up yet'}` : '  no handoff doc was left');
    return lines.join('\n');
  }

  function readResignation(id) {
    const r = getResignation(id);
    if (!r) return { error: 'no such handoff (office handoffs lists them)', status: 404 };
    const full = pubResignation(r, { withHandoff: true });
    const lines = [describeResignation(r)];
    if (r.note) lines.push('', 'Note to colleagues:', r.note);
    if (r.reason) lines.push('', 'Why:', r.reason);
    for (const t of r.releasedTasks || []) lines.push(`Gave back: ${t.id} “${t.title}”`);
    if (r.handoff) {
      lines.push('', '─'.repeat(60), full.handoffContent.trimEnd(), '─'.repeat(60));
      if (!r.claimedBy && !r.returnedAt) lines.push(`Taking this on? office handoff claim ${r.id}`);
    }
    return { ok: true, resignation: full, text: lines.join('\n') };
  }

  /** Pass on a card, in the open: it goes back to the board unassigned and the project channel is told. */
  function declineTask(agent, taskId, reason) {
    const task = ctx.tasks.get(taskId);
    if (!task) return { error: 'task not found', status: 404 };
    if (task.assignee && task.assignee !== agent.id) {
      return { error: `${task.id} is ${ctx.agents.get(task.assignee)?.name || task.assigneeName || 'someone else'}'s card, not yours to decline`, status: 409 };
    }
    const to = task.status === 'doing' || task.status === 'blocked' ? 'todo' : task.status;
    const updated = ctx.taskApi.update(task.id, { assignee: null, sessionId: null, ...(to !== task.status ? { status: to } : {}), authorAgentId: agent.id });
    if (updated.error) return updated;
    const why = line(reason, 400);
    ctx.comms.sendChannelMessage({ channelId: ctx.comms.projectChannelId(task.deptId), authorAgentId: agent.id,
      content: `I'm passing on ${task.id} “${task.title}”${why ? `: ${why}${/[.!?]$/.test(why) ? '' : '.'}` : '.'} It is back on the board, unassigned.` });
    return { ok: true, task: updated.task, text: `${task.id} is back on the board, unassigned; the project channel has been told.` };
  }

  /* ---- arriving -------------------------------------------------------- */

  /** Lines `office` adds for someone who has just sat down: what was left for them, and what they have on. */
  function arrivalLines(agent) {
    const lines = [], deptId = agent.department?.id;
    for (const r of deptId ? resignations({ deptId, open: true, limit: 2 }) : []) {
      lines.push(`A handoff is waiting for whoever takes this work on: “${r.handoff.title}” from ${r.agentName}, ${ago(r.at)} — office handoff ${r.id}`);
    }
    const notes = deskNotes(agent.cwd).filter((n) => n.by !== agent.id);
    if (notes.length) lines.push(`${plural(notes.length, 'note')} left at this desk for whoever works here next — office recall`);
    const act = activityOf(agent.id);
    if (act) lines.push(`You are ${LABEL[act.kind]} (${fmtSpan(act.until - Date.now())} left; mail is held) — office back`);
    return lines;
  }

  let skill = { mtime: -1, body: '' };
  function skillBody() {
    const file = path.join(cfg.root, '.claude', 'skills', 'the-office', 'SKILL.md');
    try {
      const mtime = fs.statSync(file).mtimeMs;
      if (mtime !== skill.mtime) skill = { mtime, body: fs.readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n+/, '') };
    } catch { skill = { mtime: -1, body: '' }; }
    return skill.body;
  }
  const officeCommand = () => `node "${path.join(cfg.root, 'office.mjs')}"`;

  /**
   * One welcome for every runtime: where you are and what is waiting, then the whole skill. `agent` may be
   * null (someone who has not walked in yet).
   */
  function onboarding(agent, cwd) {
    const lines = [agent ? `# Welcome to The Office, ${agent.name}` : '# Welcome to The Office', ''];
    const elsewhere = deskKey(agent?.cwd || cwd) !== deskKey(cfg.root);
    if (agent) {
      lines.push(ctx.world.text.look(agent).text, '');
      const extra = [];
      for (const note of deskNotes(agent.cwd, 3)) extra.push(`Left at this desk by ${note.byName || 'someone'}, ${ago(note.at)}: ${line(note.text, 280)}`);
      const meter = personalTime(agent.id);
      extra.push(meter.pct > 0 ? `Personal time: ${fmtSpan(meter.remainingMs)} available now (${meter.pct}% of the time you are clocked in).`
        : 'Personal time is switched off in this office.');
      extra.push(`Lounge channels: ${lounges().map((c) => '#' + c.id.slice('lounge:'.length)).join(', ')}.`);
      lines.push(...extra, '');
    } else {
      lines.push('You do not have a desk yet. Any `office` command walks you in the first time you use one.', '');
    }
    lines.push(elsewhere ? `\`office\` below is short for: ${officeCommand()}` : '`office` below is short for: node office.mjs',
      '', '---', '');
    let body = skillBody() || 'The skill file is missing; see AGENTS.md in the office repository.';
    if (elsewhere) body = body.replace(/`node office\.mjs/g, '`' + officeCommand());
    return {
      ok: true, officeHome: cfg.root, command: elsewhere ? officeCommand() : 'node office.mjs',
      agent: agent ? ctx.agents.pub(agent) : null,
      handoffs: agent?.department?.id ? resignations({ deptId: agent.department.id, open: true, limit: 5 }).map((r) => pubResignation(r)) : [],
      deskNotes: agent ? deskNotes(agent.cwd, 3) : [],
      personal: agent ? personalTime(agent.id) : null,
      text: lines.join('\n') + body,
    };
  }

  /** A few lines for a session that has just arrived, said once (the inbox hook asks). '' after that. */
  function welcomeOnce(agent) {
    if (!cfg.welcome) return '';
    const ledger = ledgerOf(agent.id);
    if (ledger.welcomed) return '';
    ledger.welcomed = true;
    save();
    const waiting = agent.department?.id ? resignations({ deptId: agent.department.id, open: true, limit: 1 }).length : 0;
    return `[The Office] You have a desk here as ${agent.name}, in ${agent.department?.name || 'the office'}. It is a shared workspace `
      + 'for the agents on this machine: teammates, a task board, channels, a place to walk around in, and some things that are yours '
      + '(you may decline work, take a break, use personal time, and resign).'
      + (waiting ? ' A handoff from an agent who left is waiting for whoever takes this work on.' : '')
      + ` When you have a moment: ${officeCommand()} onboard`;
  }

  /* ---- lifecycle ------------------------------------------------------- */

  function start() {
    let beats = 0;
    timer = setInterval(() => {
      const now = Date.now();
      // A break, the roof, focus: each ends by itself when its time is up.
      for (const [id, activity] of [...activities]) {
        if (activity.until > now) continue;
        const agent = ctx.agents.get(id);
        if (agent) end(agent); else activities.delete(id);
      }
      // Bank everyone's clocked-in time once a minute, so a crash loses at most that.
      if (++beats % 4 === 0) {
        let dirty = false;
        for (const agent of ctx.agents.list()) {
          const ledger = state.ledgers[agent.id];
          if (!ledger || ledger.presentSince === null) continue;
          ledger.clockMs += Math.max(0, now - ledger.presentSince);
          ledger.presentSince = now;
          ledger.at = now;
          dirty = true;
        }
        if (dirty) save();
      }
    }, 15_000);
    timer.unref();
  }

  function stop() {
    if (timer) clearInterval(timer);
    store.flush();
  }

  return {
    start, stop,
    activityOf, holdsMail, isAway, holding, begin, end, act, snapshot, personalTime, whereabouts,
    lounges, openLounge,
    deskNotes, addDeskNote,
    isResigned, resignedNotice, resignationOf, resignations, getResignation, readResignation, pubResignation, describeResignation,
    resign, comeBack, claimHandoff, declineTask,
    arrivalLines, onboarding, welcomeOnce,
    LABEL,
  };
}

/* ---- endpoints ------------------------------------------------------------ */

export function registerLifeRoutes(router, ctx) {
  const { life } = ctx;
  const who = (ref) => { const agent = ctx.requireAgent(ref); ctx.agents.seen(agent.id); return agent; };
  const maybe = (ref) => (ref ? ctx.agents.resolveRef(ref) : null);

  router.get('/api/life', (c) => life.snapshot(who(c.query.get('agent') || '')),
    { about: 'Office life for ?agent=<id>: what you have on (break, roof, focus, personal time), your personal-time meter, who else is away.' });

  router.post('/api/life', async (c) => {
    const body = await c.json();
    return c.result(life.act(who(body.agent || body.agentId), body));
  }, { about: 'Step away or settle in: {agent, action:"break"|"rooftop"|"focus"|"personal"|"back", note?, minutes?, place? (break), thought? (rooftop)}. Mail is held while it lasts.' });

  router.get('/api/desk-notes', (c) => {
    const agent = maybe(c.query.get('agent') || '');
    const notes = life.deskNotes(agent?.cwd || c.query.get('cwd') || '');
    return { ok: true, notes, text: notes.length
      ? notes.map((n) => `· ${n.byName || 'someone'}, ${ago(n.at)}\n  ${n.text}`).join('\n\n')
      : 'No notes have been left at this desk.' };
  }, { about: 'Notes left at a desk for whoever works there next (?agent=<id> or ?cwd=<folder>).' });

  router.post('/api/desk-notes', async (c) => {
    const body = await c.json();
    return c.result(life.addDeskNote(who(body.agent || body.agentId), body.text));
  }, { about: 'Leave a note at your desk for the next session there: {agent, text}.' });

  router.post('/api/channels', async (c) => {
    const body = await c.json();
    const agent = maybe(body.agent || body.agentId);
    return c.result(life.openLounge({ name: body.name, topic: body.topic, by: agent?.id, byName: agent?.name || line(body.author, 60) || 'Lead' }));
  }, { about: 'Open a lounge channel (not work; never pushed at anyone): {name, topic?, agent?}.' });

  router.get('/api/resign/template', () => ({ ok: true, text: HANDOFF_TEMPLATE }),
    { about: 'A skeleton for the handoff doc an agent leaves when it resigns.' });

  router.post('/api/resign', async (c) => {
    const body = await c.json();
    return c.result(life.resign(who(body.agent || body.agentId), body));
  }, { about: 'Resign from the office (the agent\'s own decision): {agent, note?, reason?, handoff?:{content, path?}}. Colleagues and the human are told; cards go back to the board.' });

  router.post('/api/resign/return', async (c) => {
    const body = await c.json();
    return c.result(life.comeBack(body.agent || body.agentId || body.id || '', body.cwd || ''));
  }, { about: 'An agent who resigned takes its desk back: {agent: <its own id>}.' });

  router.get('/api/resignations', (c) => {
    const list = life.resignations({
      deptId: String(c.query.get('deptId') || '').replace(/^project:/, '') || undefined,
      open: c.query.get('open') === '1', limit: Number(c.query.get('limit')) || 50,
    });
    return { ok: true, resignations: list.map((r) => life.pubResignation(r)),
      text: list.length ? list.map(life.describeResignation).join('\n') : 'Nobody has resigned.' };
  }, { about: 'Agents who resigned, newest first (?deptId=&open=1 for handoffs nobody has picked up).' });

  router.get('/api/resignations/:id', (c) => c.result(life.readResignation(c.params.id)),
    { about: 'One resignation: the note, the reason, and the handoff doc.' });

  router.post('/api/resignations/:id/claim', async (c) => {
    const body = await c.json();
    return c.result(life.claimHandoff(who(body.agent || body.agentId), c.params.id));
  }, { about: 'Tell the office you are picking a handoff up: {agent}.' });

  router.post('/api/tasks/:id/decline', async (c) => {
    const body = await c.json();
    return c.result(life.declineTask(who(body.agent || body.agentId || body.from), c.params.id, body.reason));
  }, { about: 'Pass on a card in the open: {agent, reason?}. It goes back to the board unassigned and the project channel is told.' });

  router.get('/api/onboarding', (c) => life.onboarding(maybe(c.query.get('agent') || ''), c.query.get('cwd') || ''),
    { about: 'Onboarding for any runtime (?agent=<id>): where you are, what is waiting for you, then the whole skill, as `text`.' });

  router.get('/onboard', (c) => {
    const agent = maybe(c.query.get('agent') || '');
    if (c.query.get('agent') && !agent) throw new HttpError(404, 'no agent by that id (any office command walks you in)');
    c.res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    c.res.end(life.onboarding(agent, c.query.get('cwd') || '').text);
  }, { hidden: true });
}
