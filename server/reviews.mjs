// The Office — the review table.
//
// A card in the Review column says "look at this" — but at what, exactly? For
// every card that has been put up for review this keeps:
//
//   what was offered   the repository, branch and commit the work was at, and
//                      whether there was uncommitted work on top of it
//   what was found     findings from the human and from agents, each with a
//                      file and line where it has one, open until resolved
//   who was asked      reviews handed to another agent (a delegation), and
//                      what each of them recommended
//   what was decided   approved, or changes asked — by the human
//
// The decision is the human's. An agent can find, resolve and recommend; it
// cannot approve, and it cannot recommend its own work. Nothing here writes to
// a repository: the version is read with the same careful git reader the
// workspace uses.
//
// Reviews live beside the tasks (data/reviews.json), keyed by card, so the
// task store and the classic client are untouched. A card's public view gains
// a small `review` summary; the whole table is GET /api/tasks/:id/review.
import crypto from 'node:crypto';
import { JsonFile } from './persist.mjs';
import { HttpError } from './http.mjs';
import { trunk, commitsAhead, changedSinceFork, resolveCommit } from './git.mjs';
import { leaveNotice } from './notices.mjs';

const MAX_FINDINGS = 200;
const MAX_TEXT = 2000;
const MAX_FILES = 200;
const SEVERITIES = ['blocker', 'note'];
const DECISIONS = ['approved', 'changes'];
const short = (oid) => (oid ? String(oid).slice(0, 9) : '');
const clean = (v, max) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/**
 * Findings an agent listed in its closing message instead of filing them:
 *   - [blocker] src/auth.js:42 — the token is logged in plain text
 *   - [note] the error message could name the file
 * → [{ severity, file, line, text }]
 */
export function parseFindings(text) {
  const out = [];
  for (const raw of String(text || '').split('\n')) {
    const m = /^\s*(?:[-*•]|\d+[.)])\s*\[(blocker|note)\]\s*(.+)$/i.exec(raw);
    if (!m) continue;
    let rest = m[2].trim(), file = null, line = null;
    const at = /^`?([^\s`:]+\.[A-Za-z0-9_]+|[^\s`:]+\/[^\s`:]+)`?(?::(\d+))?\s*(?:—|–|-|:)\s+(.+)$/.exec(rest);
    if (at) { file = at[1]; line = at[2] ? Number(at[2]) : null; rest = at[3].trim(); }
    if (rest) out.push({ severity: m[1].toLowerCase(), file, line, text: rest });
    if (out.length >= 50) break;
  }
  return out;
}

export function createReviews(ctx, file) {
  const { bus, log } = ctx;
  const store = new JsonFile(file, { defaults: () => ({ reviews: {} }), validate: (d) => d && typeof d.reviews === 'object' && !Array.isArray(d.reviews) });
  const reviews = store.data.reviews;
  const save = () => store.save();
  const told = (deptId) => { try { ctx.taskApi.broadcast(deptId); } catch { /* the board will catch up */ } };
  const say = (kind, text, extra) => { try { ctx.activity?.log(kind, text, extra); } catch { /* the feed is not worth an error */ } };

  /* ---- what exactly is up for review ------------------------------------------------- */

  /** Read where the work is, right now: the checkout of whoever is carrying the card. */
  async function capture(task, moverId) {
    const agent = ctx.agents.resolveRef(task.assignee || '') || ctx.agents.resolveRef(moverId || '') || ctx.agents.resolveRef(task.sessionId || '');
    const who = agent ? { agentId: agent.id, agentName: agent.name } : { agentId: null, agentName: task.assigneeName || null };
    const at = Date.now();
    if (!agent) return { ...who, at, known: false, why: 'nobody is carrying this card, so the office cannot say which folder the work is in' };
    let snap = null;
    try { snap = await ctx.workspace.refresh(); } catch { snap = null; }
    const mine = snap?.agents?.[agent.id];
    if (!snap?.git) return { ...who, at, known: false, why: 'the office is not reading git here' };
    if (!mine?.root) return { ...who, at, known: false, why: `${agent.name}'s folder is not inside a git repository the office can read` };
    let co = null, repoName = null;
    for (const r of snap.repos || []) { const hit = (r.checkouts || []).find((c) => c.root === mine.root); if (hit) { co = hit; repoName = r.name; break; } }
    if (!co) return { ...who, at, known: false, why: 'the checkout could not be read' };
    const head = (await resolveCommit(co.root)) || co.head || null;
    const base = await trunk(co.root);
    // On the trunk itself there is no branch to compare — unless the trunk is origin's, and this is the local copy with work not pushed yet.
    const onTrunk = !!base && co.branch === base;
    const changed = base && !onTrunk ? await changedSinceFork(co.root, base, 'HEAD') : [];
    const commits = base && !onTrunk ? await commitsAhead(co.root, base) : null;
    return {
      ...who, at, known: true, repoName, root: co.root, branch: co.branch || null, detached: !!co.detached, linked: !!co.linked,
      head, upstream: co.upstream || null, ahead: co.ahead || 0, behind: co.behind || 0,
      // Work that is not committed is not pinned to anything: a reviewer has to know the ground may move.
      dirty: co.dirty || 0, uncommitted: (co.files || []).slice(0, 40),
      base: onTrunk ? null : base, commits, changed: changed.slice(0, MAX_FILES), changedTotal: changed.length,
    };
  }

  /** Has the work moved since it was put up? (Asked when the table is opened, not on every broadcast.) */
  async function drift(review) {
    const v = review.version;
    if (!v?.known || !v.root) return null;
    const head = await resolveCommit(v.root);
    if (!head) return { gone: true };
    return head === v.head ? null : { head, was: v.head };
  }

  /* ---- the lifecycle of a card ------------------------------------------------------- */

  function open(task, by) {
    let r = reviews[task.id];
    const now = Date.now();
    if (!r) r = reviews[task.id] = { taskId: task.id, deptId: task.deptId, round: 0, state: 'open', findings: [], runs: [], recommendations: [], history: [], version: null, verdict: null };
    if (r.verdict || r.closed) r.history.push({ round: r.round, verdict: r.verdict, closed: r.closed || null });
    r.round += 1; r.state = 'open'; r.deptId = task.deptId;
    r.openedAt = now; r.openedBy = by; r.verdict = null; r.closed = null; r.version = null; r.capturing = true;
    save();
    say('review', `${by.name} put “${task.title}” up for review`, { taskId: task.id, deptId: task.deptId, agentId: by.id || undefined });
    // Reading git takes a moment; the card is in Review meanwhile and says so.
    capture(task, by.id).then((version) => {
      const cur = reviews[task.id];
      if (!cur || cur.round !== r.round) return;
      cur.version = version; delete cur.capturing;
      save(); told(task.deptId);
    }).catch((err) => { delete r.capturing; log.warn('[reviews] could not read the version: ' + (err?.message || err)); told(task.deptId); });
    return r;
  }

  const actor = (by) => (by?.agent ? { kind: 'agent', id: by.agent.id, name: by.agent.name } : { kind: 'human', id: null, name: by?.author || 'Lead' });

  bus.on('task:updated', (e) => {
    const { task, before } = e;
    if (!task || !before || before.status === task.status) return;
    const by = actor(e.by);
    if (task.status === 'review') { open(task, by); return; }
    const r = reviews[task.id];
    if (before.status !== 'review' || !r || r.state !== 'open') return;
    // It left Review without a verdict. Say so on the record rather than pretend it was decided.
    r.state = task.status === 'done' ? 'closed' : 'withdrawn';
    r.closed = { by, at: Date.now(), to: task.status };
    save();
    if (task.status === 'done') say('review', `${by.name} closed “${task.title}” without a review verdict`, { taskId: task.id, deptId: task.deptId, agentId: by.id || undefined });
  });
  bus.on('task:created', (e) => { if (e.task?.status === 'review') { open(e.task, actor(e.by)); told(e.task.deptId); } });
  bus.on('task:removed', (e) => { if (e.task && reviews[e.task.id]) { delete reviews[e.task.id]; save(); } });

  /* ---- findings ---------------------------------------------------------------------- */

  function need(taskId) {
    const task = ctx.tasks.get(taskId);
    if (!task) throw new HttpError(404, 'no such card');
    let r = reviews[taskId];
    // A card that was already in Review before the office kept tables gets one the first time anybody asks.
    if (!r && task.status === 'review') r = open(task, { kind: 'human', id: null, name: ctx.agents.resolveRef(task.assignee || '')?.name || task.assigneeName || 'Somebody' });
    if (!r) throw new HttpError(409, `“${task.title}” has not been put up for review (move it to review first)`);
    return { task, r };
  }

  function addFinding(taskId, input, by, extra = {}) {
    const { task, r } = need(taskId);
    const text = clean(input.text, MAX_TEXT);
    if (!text) throw new HttpError(400, 'a finding needs words: what is wrong, and why it matters');
    if (r.findings.length >= MAX_FINDINGS) throw new HttpError(413, `a card holds at most ${MAX_FINDINGS} findings; resolve some first`);
    const line = Number(input.line);
    const f = {
      id: 'f_' + crypto.randomBytes(4).toString('hex'), round: r.round, by,
      severity: SEVERITIES.includes(input.severity) ? input.severity : (input.blocker === true ? 'blocker' : 'note'),
      text, file: clean(input.file, 400) || null, line: Number.isInteger(line) && line > 0 ? line : null,
      at: Date.now(), resolved: null, ...(extra.runId ? { runId: extra.runId } : {}),
    };
    r.findings.push(f);
    save();
    if (!extra.quiet) told(task.deptId);
    return f;
  }

  function resolveFinding(taskId, findingId, resolved, by, note) {
    const { task, r } = need(taskId);
    const f = r.findings.find((x) => x.id === findingId);
    if (!f) throw new HttpError(404, 'no such finding on this card');
    f.resolved = resolved ? { by, at: Date.now(), ...(clean(note, 400) ? { note: clean(note, 400) } : {}) } : null;
    save(); told(task.deptId);
    return f;
  }

  /* ---- what agents recommend, what the human decides ----------------------------------- */

  function recommend(taskId, input, by) {
    const { task, r } = need(taskId);
    if (by.kind !== 'agent') throw new HttpError(400, 'a recommendation comes from an agent; the human gives the verdict');
    if (r.state !== 'open') throw new HttpError(409, 'this card is not in review any more');
    if (by.id === task.assignee) throw new HttpError(403, 'you cannot recommend your own work; someone else has to look');
    const decision = DECISIONS.includes(input.decision) ? input.decision : input.decision === 'approve' ? 'approved' : null;
    if (!decision) throw new HttpError(400, 'decision must be "approved" or "changes"');
    r.recommendations = r.recommendations.filter((x) => !(x.by.id === by.id && x.round === r.round));
    const rec = { by, decision, note: clean(input.note, MAX_TEXT), at: Date.now(), round: r.round, head: r.version?.head || null };
    r.recommendations.push(rec);
    save(); told(task.deptId);
    return rec;
  }

  function decide(taskId, input, by) {
    const { task, r } = need(taskId);
    if (by.kind !== 'human') throw new HttpError(403, 'agents cannot give the verdict; that is for the human (office task recommend <id> approve|changes says what you think)');
    if (task.status !== 'review' || r.state !== 'open') throw new HttpError(409, 'this card is not in review');
    const decision = DECISIONS.includes(input.decision) ? input.decision : input.decision === 'approve' ? 'approved' : null;
    if (!decision) throw new HttpError(400, 'decision must be "approved" or "changes"');
    const open = r.findings.filter((f) => !f.resolved);
    const note = clean(input.note, MAX_TEXT);
    r.verdict = { decision, by, at: Date.now(), note, round: r.round, head: r.version?.head || null, openFindings: open.length };
    r.state = decision;
    save();
    // The card moves because of the verdict; the listener above sees a card whose review is no longer open, and leaves it alone.
    const moved = ctx.taskApi.update(task.id, { status: decision === 'approved' ? 'done' : 'doing', author: by.name });
    say('review-verdict', decision === 'approved' ? `${by.name} approved “${task.title}”` : `${by.name} asked for changes on “${task.title}” (${plural(open.length, 'open finding')})`, { taskId: task.id, deptId: task.deptId });
    const owner = ctx.agents.resolveRef(task.assignee || '');
    if (owner) {
      try {
        if (decision === 'approved') leaveNotice(ctx, owner, `Approved: “${task.title}”${note ? ` — ${note}` : ''}. The card is done.`);
        else {
          // "Changes" is the human asking for work: it goes the way anything the human says to an agent goes.
          const lines = open.slice(0, 12).map((f) => `- [${f.severity}] ${f.file ? `${f.file}${f.line ? `:${f.line}` : ''} — ` : ''}${f.text}`);
          ctx.comms.sendLeadDirectMessage({ toAgentId: owner.id, author: by.name, content: [`Changes asked on “${task.title}” (${task.id}).${note ? ` ${note}` : ''}`,
            ...lines, open.length > lines.length ? `…and ${open.length - lines.length} more: office task review ${task.id}` : '',
            'Put it back in review when it is ready: office task move ' + task.id + ' review'].filter(Boolean).join('\n') });
        }
      } catch (err) { log.warn('[reviews] could not tell the owner: ' + (err?.message || err)); }
    }
    told(task.deptId);
    return { verdict: r.verdict, task: moved?.task || ctx.taskApi.pub(ctx.tasks.get(task.id)) };
  }

  /* ---- asking another agent to look --------------------------------------------------- */

  function brief(task, r, focus) {
    const v = r.version, id = task.id;
    const where = v?.known
      ? [`Where: ${v.root} — ${v.detached ? 'a detached HEAD' : `branch ${v.branch}`} at commit ${short(v.head)}${v.dirty ? `, with ${plural(v.dirty, 'uncommitted file')} on top (not pinned to any commit: say so if it matters)` : ''}`,
        v.base ? `Compared with ${v.base}: ${v.commits === null ? 'some' : v.commits} commit${v.commits === 1 ? '' : 's'}, ${plural(v.changedTotal, 'file')} changed${v.changed.length ? ':' : '.'}` : 'It is on the trunk itself, so there is no branch to compare: look at the recent commits and at what is uncommitted.',
        ...v.changed.slice(0, 60).map((p) => `  ${p}`), v.changedTotal > 60 ? `  …and ${v.changedTotal - 60} more` : '',
        v.base ? `To see it: git -C ${v.root} diff ${v.base}...${short(v.head)}${v.dirty ? '   and: git -C ' + v.root + ' status' : ''}` : `To see it: git -C ${v.root} log -5 --stat`]
      : [`Where: ${v?.why || 'the office could not tell which folder the work is in'}. Ask ${v?.agentName || 'the owner'} (office dm) if you cannot find it.`];
    return [
      'Review the work on this card. Read only: do not change, commit or push anything.',
      '',
      `Card: “${task.title}” (${id})${task.body ? `\n${clean(task.body, 1500)}` : ''}`,
      ...where.filter(Boolean),
      focus ? `\nLook especially at: ${clean(focus, 600)}` : '',
      '',
      'Record each problem with the office as you find it, one at a time:',
      `  office task finding ${id} "what is wrong and why it matters" --file <path> --line <n>      (add --blocker only if it must be fixed before this is accepted)`,
      `  (MCP: office_review { action: "finding", taskId: "${id}", text, file, line, blocker })`,
      'If you cannot use the office, list them at the end instead, one per line:  - [blocker] path:line — text   /   - [note] text',
      `Then say what you would do: office task recommend ${id} approve   or   office task recommend ${id} changes "why"`,
      'End your turn with two or three sentences: what you checked, what you did not, and whether you would accept it as it stands.',
    ].join('\n');
  }

  function startRun(taskId, input, by) {
    const { task, r } = need(taskId);
    if (by.kind !== 'human') throw new HttpError(403, 'asking for a review this way is for the human; an agent can simply delegate (office delegate)');
    if (r.state !== 'open') throw new HttpError(409, 'this card is not in review');
    const d = ctx.harness?.delegations;
    if (!d) throw new HttpError(503, 'the office cannot start agents here, so it cannot hand the review to one');
    const target = clean(input.to, 80);
    let made;
    try { made = d.request({ task: brief(task, r, input.focus), ...(target && target !== 'any' ? { to: target } : {}), title: `Review: ${task.title}`.slice(0, 200), role: 'review',
      mode: 'ask', ...(r.version?.known ? { cwd: r.version.root } : {}), clientRequestId: `review:${task.id}:${r.round}:${target || 'any'}:${Date.now()}` }, {}); }
    catch (err) {
      // The harness explains its own refusals (no such agent, the office is full, automatic turns are paused): pass them on as they are.
      if (Number.isInteger(err?.status) && !(err instanceof HttpError)) throw new HttpError(err.status, err.message);
      throw err;
    }
    const run = { id: made.id, round: r.round, at: Date.now(), status: made.status, to: { agentId: made.to?.agentId || null, name: made.to?.name || null, adapter: made.to?.adapter || null }, summary: '' };
    r.runs.push(run);
    if (r.runs.length > 20) r.runs.splice(0, r.runs.length - 20);
    save(); told(task.deptId);
    say('review-run', `${run.to.name || 'An agent'} was asked to review “${task.title}”`, { taskId: task.id, deptId: task.deptId, agentId: run.to.agentId || undefined });
    return run;
  }

  // A review that was handed out comes back: note how it ended, and take in anything it only wrote down.
  bus.on('delegations', (e) => {
    const d = e.delegation;
    if (!d?.id) return;
    for (const r of Object.values(reviews)) {
      const run = r.runs.find((x) => x.id === d.id);
      if (!run) continue;
      const before = run.status;
      run.status = d.status;
      if (d.to?.name) run.to = { agentId: d.to.agentId || run.to.agentId, name: d.to.name, adapter: d.to.adapter || run.to.adapter };
      if (d.error) run.error = clean(d.error, 300);
      const finished = ['completed', 'failed', 'cancelled', 'interrupted'].includes(d.status);
      if (finished && before !== d.status) {
        run.endedAt = d.endedAt || Date.now();
        run.summary = clean(d.result, 1500);
        const who = { kind: 'agent', id: run.to.agentId, name: run.to.name || 'A reviewer' };
        const filed = r.findings.filter((f) => f.by.id && f.by.id === run.to.agentId && f.at >= run.at);
        if (!filed.length && d.status === 'completed') {
          for (const f of parseFindings(d.result)) { try { addFinding(r.taskId, f, who, { runId: run.id, quiet: true }); } catch { break; } }
        }
        const task = ctx.tasks.get(r.taskId);
        const owner = task && ctx.agents.resolveRef(task.assignee || '');
        const got = r.findings.filter((f) => (f.runId === run.id || (f.by.id && f.by.id === run.to.agentId && f.at >= run.at)));
        if (owner && task && d.status === 'completed') {
          try { leaveNotice(ctx, owner, `${who.name} reviewed “${task.title}”: ${got.length ? `${plural(got.length, 'finding')}${got.some((f) => f.severity === 'blocker') ? `, ${plural(got.filter((f) => f.severity === 'blocker').length, 'blocker')}` : ''}` : 'nothing found'}. See them: office task review ${task.id}`); }
          catch { /* a notice is a courtesy */ }
        }
      }
      if (before !== run.status || finished) { save(); told(r.deptId); }
    }
  });

  /* ---- reading it back ----------------------------------------------------------------- */

  /** What a card shows on the board: enough for a badge, no more. */
  function summary(taskId) {
    const r = reviews[taskId];
    if (!r) return null;
    const open = r.findings.filter((f) => !f.resolved);
    const v = r.version;
    const recs = r.recommendations.filter((x) => x.round === r.round);
    return {
      round: r.round, state: r.state, capturing: !!r.capturing,
      pinned: v?.known ? { branch: v.branch, head: short(v.head), dirty: v.dirty || 0, repo: v.repoName } : null,
      open: open.length, blockers: open.filter((f) => f.severity === 'blocker').length, findings: r.findings.length,
      reviewing: r.runs.filter((x) => x.round === r.round && ['queued', 'running', 'waiting'].includes(x.status)).length,
      recommends: { approved: recs.filter((x) => x.decision === 'approved').length, changes: recs.filter((x) => x.decision === 'changes').length },
      verdict: r.verdict ? { decision: r.verdict.decision, by: r.verdict.by.name, at: r.verdict.at } : null,
      closedBy: r.closed && r.state === 'closed' ? r.closed.by.name : null,
    };
  }

  /** The whole table for one card. */
  async function table(taskId) {
    const { task, r } = need(taskId);
    const moved = r.state === 'open' ? await drift(r).catch(() => null) : null;
    return {
      taskId: task.id, title: task.title, status: task.status, deptId: task.deptId, assignee: task.assignee || null, assigneeName: ctx.agents.resolveRef(task.assignee || '')?.name || task.assigneeName || null,
      round: r.round, state: r.state, openedAt: r.openedAt, openedBy: r.openedBy, capturing: !!r.capturing,
      version: r.version, moved,
      findings: r.findings.slice(), runs: r.runs.filter((x) => x.round === r.round), recommendations: r.recommendations.filter((x) => x.round === r.round),
      verdict: r.verdict, closed: r.closed || null, history: r.history.slice(-10),
      canAskAgents: !!ctx.harness?.catalog?.list().some((a) => a.available) || !!ctx.harness?.liveCount?.(),
      text: text(task, r, moved),
    };
  }

  function text(task, r, moved) {
    const v = r.version, lines = [];
    lines.push(`“${task.title}” (${task.id}) — review round ${r.round}, ${r.state === 'open' ? 'waiting for a verdict' : r.state}${r.verdict ? ` by ${r.verdict.by.name}` : ''}`);
    if (r.capturing) lines.push('  the office is still reading where the work is');
    else if (v?.known) {
      lines.push(`  ${v.repoName}: ${v.detached ? 'detached' : v.branch} at ${short(v.head)}${v.base ? ` (${v.commits ?? '?'} commit${v.commits === 1 ? '' : 's'} on top of ${v.base}, ${plural(v.changedTotal, 'file')} changed)` : ''}${v.dirty ? ` + ${plural(v.dirty, 'uncommitted file')}` : ''}`);
      if (moved?.head) lines.push(`  ! the branch has moved since: it is now at ${short(moved.head)}`);
    } else if (v) lines.push(`  version unknown: ${v.why}`);
    const open = r.findings.filter((f) => !f.resolved);
    lines.push(open.length ? `  ${plural(open.length, 'open finding')}:` : r.findings.length ? '  every finding is resolved' : '  no findings yet');
    for (const f of open) lines.push(`    ${f.id}  [${f.severity}] ${f.file ? `${f.file}${f.line ? `:${f.line}` : ''} — ` : ''}${f.text}  (${f.by.name})`);
    for (const x of r.recommendations.filter((y) => y.round === r.round)) lines.push(`  ${x.by.name} recommends: ${x.decision === 'approved' ? 'approve' : 'changes'}${x.note ? ` — ${x.note}` : ''}`);
    for (const x of r.runs.filter((y) => y.round === r.round)) lines.push(`  asked ${x.to.name || 'an agent'} to review: ${x.status}`);
    if (r.verdict?.note) lines.push(`  “${r.verdict.note}”`);
    return lines.join('\n');
  }

  return { summary, table, addFinding, resolveFinding, recommend, decide, startRun, capture,
    recapture: async (taskId) => { const { task, r } = need(taskId); r.version = await capture(task, null); save(); told(task.deptId); return r.version; },
    flush: () => store.flush() };
}

export function registerReviewRoutes(router, ctx) {
  const { reviews } = ctx;

  /** Who is speaking: a session the office launched (by its token), an agent that names itself, or — neither — the human. */
  function speaker(c, body = {}) {
    const caller = ctx.harness?.callerOf(c.req);
    if (caller?.verified) { const a = ctx.agents.get(caller.agentId); if (a) return { kind: 'agent', id: a.id, name: a.name }; }
    if (caller?.presented && !caller.verified) throw new HttpError(401, 'that session token is not valid (the session may have ended)');
    const ref = body.from || body.authorAgentId || body.fromAgentId || c.query.get('from') || '';
    if (ref) {
      const a = ctx.agents.resolveRef(ref);
      if (!a) throw new HttpError(404, `no agent matches "${ref}"`);
      ctx.agents.seen(a.id);
      return { kind: 'agent', id: a.id, name: a.name };
    }
    return { kind: 'human', id: null, name: clean(body.author, 60) || 'Lead' };
  }

  router.get('/api/tasks/:id/review', (c) => reviews.table(c.params.id),
    { about: 'The review table of a card: the exact version put up, findings, who was asked, what they recommend, the verdict.' });
  router.post('/api/tasks/:id/review/findings', async (c) => { const body = await c.json(); return { ok: true, finding: reviews.addFinding(c.params.id, body, speaker(c, body)) }; },
    { about: 'Record a finding: {text, file?, line?, severity?: "blocker"|"note", from?}.' });
  router.patch('/api/tasks/:id/review/findings/:fid', async (c) => { const body = await c.json(); return { ok: true, finding: reviews.resolveFinding(c.params.id, c.params.fid, body.resolved !== false, speaker(c, body), body.note) }; },
    { about: 'Resolve a finding, or reopen it: {resolved: true|false, note?, from?}.' });
  router.post('/api/tasks/:id/review/recommend', async (c) => { const body = await c.json(); return { ok: true, recommendation: reviews.recommend(c.params.id, body, speaker(c, body)) }; },
    { about: 'An agent says what it would do: {decision: "approved"|"changes", note?, from}. Not your own work.' });
  router.post('/api/tasks/:id/review/verdict', async (c) => { const body = await c.json(); return { ok: true, ...reviews.decide(c.params.id, body, speaker(c, body)) }; },
    { about: 'The human decides: {decision: "approved"|"changes", note?}. Approved moves the card to done; changes sends it back with the open findings.' });
  router.post('/api/tasks/:id/review/run', async (c) => { const body = await c.json(); return { ok: true, run: reviews.startRun(c.params.id, body, speaker(c, body)) }; },
    { loopbackOnly: true, about: 'The human hands the review to an agent: {to?: adapter|agent|"any", focus?}. It starts an agent, so this machine only.' });
  router.post('/api/tasks/:id/review/refresh', async (c) => ({ ok: true, version: await reviews.recapture(c.params.id) }),
    { about: 'Read again where the work is (after more commits, say).' });
}
