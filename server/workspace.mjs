// The Office — who is working where.
//
// Several agents in one repository is where collaboration really goes wrong:
// two of them edit the same file in the same checkout, or change the same file
// on two branches and only find out at merge time. The office can see that
// coming, because it already knows where everyone works (their folder), what
// they touch (a hook event names the file a tool is about to edit) and can ask
// git the rest. This module keeps that picture:
//
//   per checkout   branch, distance from upstream, changed files     (git, read-only)
//   per agent      the files it has read or edited lately            (hooks, driven sessions, reports)
//   claims         "I am working on these paths": advisory, they expire
//   overlaps       the same file edited by two agents in one checkout
//                  an edit to something another agent has claimed
//                  the same file changed in two checkouts of one repository
//
// An overlap is shown to the human (bus event `workspace`) and each agent
// involved gets ONE plain inbox note about it. Notes are mail: never a
// wake-up, never typed into a terminal, and rate-limited. Nothing here locks
// anything; agents sort it out between themselves, which is the point.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EV } from '../core/contract.mjs';
import { HttpError } from './http.mjs';
import { JsonFile } from './persist.mjs';
import * as G from './git.mjs';

const MIN = 60 * 1000, HOUR = 60 * MIN;
const WINDOW_MS = 30 * MIN;              // an edit this recent counts as "is working on it"
const TOUCH_KEEP_MS = 8 * HOUR;          // reads and edits are remembered this long ("who knows this file?")
const TOUCH_MAX = 240;                   // per agent
const CLAIM_DEFAULT_MS = 2 * HOUR, CLAIM_MAX_MS = 24 * HOUR, CLAIMS_PER_AGENT = 24;
const NOTE_AGAIN_MS = 6 * HOUR;          // the same overlap is not mentioned again sooner than this
const NOTES_PER_HOUR = 6;                // per agent
const WHERE_TTL_MS = 5 * MIN;            // how long "this folder is (not) in a repository" is believed
const FILES_SHOWN = 60;

const EDIT_TOOL = /(^|[^a-z])(edit|write|patch|replace|create|insert)|multiedit|notebookedit|str_replace|apply_patch/;
const READ_TOOL = /(^|[^a-z])(read|view|open|cat)([^a-z]|$)/;
const PATH_KEYS = ['file_path', 'filePath', 'notebook_path', 'absolute_path', 'target_file', 'path', 'filename', 'file'];

/** The files a tool call is about, from its name and input: [{ path, kind: 'edit'|'read' }]. */
export function filesFromTool(toolName, input) {
  const name = String(toolName || '').toLowerCase();
  const kind = EDIT_TOOL.test(name) ? 'edit' : READ_TOOL.test(name) ? 'read' : null;
  if (!kind || !input || typeof input !== 'object') return [];
  const out = [];
  for (const key of PATH_KEYS) {
    const v = input[key];
    if (typeof v === 'string' && v && v.length < 1024 && !/[\n\0]/.test(v)) { out.push({ path: v, kind }); break; }
  }
  // a patch names its files in its own text
  for (const v of Object.values(input)) {
    if (typeof v !== 'string' || v.length > 400_000 || !v.includes('*** ')) continue;
    for (const m of v.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) out.push({ path: m[1].trim(), kind: 'edit' });
    for (const m of v.matchAll(/^\*\*\* Move to: (.+)$/gm)) out.push({ path: m[1].trim(), kind: 'edit' });
  }
  return out.slice(0, 40);
}

/** "src/**", "*.md", "server/world" (a folder claims what is under it) → a test for repo-relative paths. */
export function claimMatcher(pattern) {
  const p = String(pattern || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') { re += '.*'; i += 1; if (p[i + 1] === '/') i += 1; } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  const rx = new RegExp(`^${re}(?:/.*)?$`);
  return (rel) => rx.test(rel);
}

const posix = (p) => p.split(path.sep).join('/');
const repoIdOf = (commonDir) => crypto.createHash('sha1').update(commonDir).digest('hex').slice(0, 10);
const repoNameOf = (commonDir) => (path.basename(commonDir) === '.git' ? path.basename(path.dirname(commonDir)) : path.basename(commonDir).replace(/\.git$/, ''));
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
function agoText(ms) { const m = Math.round(ms / MIN); return m < 1 ? 'just now' : m < 90 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; }
function list(names) { return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`; }

export function createWorkspace(ctx, file) {
  const { cfg, bus, log } = ctx;
  const probing = cfg.gitProbe !== false;
  const store = new JsonFile(file, {
    defaults: () => ({ v: 1, claims: [], touches: {}, noted: {} }), debounceMs: 1500,
    validate: (d) => d && Array.isArray(d.claims) && typeof d.touches === 'object' && d.touches !== null,
  });
  const now0 = Date.now();
  let claims = store.data.claims.filter((c) => c && c.until > now0);
  const touches = new Map();                       // agent id → Map(abs path → { path, kind, at, editAt, tool })
  for (const [id, rows] of Object.entries(store.data.touches || {})) {
    const fresh = (Array.isArray(rows) ? rows : []).filter((t) => t && typeof t.path === 'string' && now0 - (t.at || 0) < TOUCH_KEEP_MS);
    if (fresh.length) touches.set(id, new Map(fresh.map((t) => [t.path, t])));
  }
  const noted = store.data.noted && typeof store.data.noted === 'object' ? store.data.noted : {};
  for (const [k, at] of Object.entries(noted)) if (now0 - at > 2 * NOTE_AGAIN_MS) delete noted[k];

  const dirs = new Map();                          // cwd → { where: {root, commonDir, linked}|null, at }
  const checkouts = new Map();                     // root → { root, commonDir, linked, branch, detached, oid, upstream, ahead, behind, files, dirty:Set, total, truncated, at, failures }
  const repos = new Map();                         // commonDir → { others: [{root, branch}], at }
  const pairDiff = new Map();                      // `${head}<${other}` → Set(paths changed on head since it forked from other)
  const realDirs = new Map();                      // dirname → real dirname
  const noteTimes = new Map();                     // agent id → [timestamps of notes sent]
  const warned = new Map();                        // guard-hook warnings already given: key → at
  let overlaps = new Map();                        // id → overlap
  let lastSent = '';

  const persist = () => {
    store.data.claims = claims;
    store.data.touches = Object.fromEntries([...touches].map(([id, m]) => [id, [...m.values()]]));
    store.data.noted = noted;
    store.save();
  };
  const present = () => ctx.agents.list().filter((a) => ctx.agents.isPresent(a));
  const whereOf = (agent) => (agent?.cwd ? dirs.get(agent.cwd)?.where || null : null);

  /* ---- paths ----------------------------------------------------------------- */

  /** An absolute, symlink-free path for a file that may not exist yet. */
  function canon(p, cwd) {
    if (!p || typeof p !== 'string') return null;
    const abs = path.isAbsolute(p) ? path.normalize(p) : (cwd && path.isAbsolute(cwd) ? path.resolve(cwd, p) : null);
    if (!abs) return null;
    const dir = path.dirname(abs);
    let real = realDirs.get(dir);
    if (real === undefined) {
      try { real = fs.realpathSync(dir); } catch { real = dir; }
      if (realDirs.size > 4000) realDirs.clear();
      realDirs.set(dir, real);
    }
    return path.join(real, path.basename(abs));
  }
  function relTo(root, abs) {
    const rel = path.relative(root, abs);
    return !rel || rel.startsWith('..') || path.isAbsolute(rel) ? null : posix(rel);
  }

  /* ---- touches ----------------------------------------------------------------- */

  function touch(agent, p, opt = {}) {
    if (!agent) return null;
    const abs = canon(p, opt.cwd || agent.cwd);
    if (!abs) return null;
    const now = Date.now(), kind = opt.kind === 'edit' ? 'edit' : 'read';
    let mine = touches.get(agent.id);
    if (!mine) touches.set(agent.id, mine = new Map());
    const prev = mine.get(abs);
    const row = { path: abs, kind: kind === 'edit' || prev?.editAt ? 'edit' : 'read', at: now, editAt: kind === 'edit' ? now : (prev?.editAt || 0), tool: clean(opt.tool, 40) || prev?.tool || '' };
    mine.delete(abs); mine.set(abs, row);                    // newest last
    while (mine.size > TOUCH_MAX) mine.delete(mine.keys().next().value);
    persist();
    if (kind === 'edit') {
      const where = whereOf(agent);
      if (where) { const c = checkouts.get(where.root); if (c) c.at = Math.min(c.at, now - cfg.gitEveryMs + 1500); }   // git will have something new to say shortly
      schedule(1600);
    }
    return row;
  }

  bus.on('hook', ({ name, id, ev }) => {
    if (name !== 'PreToolUse' && name !== 'PostToolUse') return;
    const agent = ctx.agents.get(id);
    if (!agent) return;
    for (const f of filesFromTool(ev?.tool_name, ev?.tool_input)) touch(agent, f.path, { kind: f.kind, tool: ev.tool_name, cwd: ev.cwd });
  });
  // Driven sessions (server/harness) and anything else in the daemon: bus.local({ type: 'agent:file', id, path, kind, tool })
  bus.on('agent:file', (e) => { const agent = ctx.agents.get(e.id); if (agent) touch(agent, e.path, { kind: e.kind, tool: e.tool }); });
  bus.on('agent:join', () => schedule(400));
  bus.on('remove', ({ id }) => {
    touches.delete(id);
    claims = claims.filter((c) => c.agentId !== id);
    persist();
    schedule(400);
  });

  /* ---- claims -------------------------------------------------------------------- */

  function claimScope(agent) {
    const where = whereOf(agent);
    return where ? { repo: where.commonDir, base: where.root } : (agent.cwd && path.isAbsolute(agent.cwd) ? { repo: null, base: agent.cwd } : null);
  }
  function claimCovers(claim, abs, toucherWhere) {
    if (claim.repo) {
      if (!toucherWhere || toucherWhere.commonDir !== claim.repo) return false;
      const rel = relTo(toucherWhere.root, abs);
      return !!rel && claimMatcher(claim.pattern)(rel);
    }
    const rel = relTo(claim.base, abs);
    return !!rel && claimMatcher(claim.pattern)(rel);
  }
  function claim(agent, paths, opt = {}) {
    const scope = claimScope(agent);
    if (!scope) return { error: 'the office does not know which folder you work in, so it cannot place a claim (join with a cwd)', status: 400 };
    const now = Date.now();
    const wanted = (Array.isArray(paths) ? paths : [paths]).map((p) => clean(p, 300)).filter(Boolean).slice(0, 12);
    if (!wanted.length) return { error: 'name at least one path or pattern to claim', status: 400 };
    const minutes = Number(opt.minutes);
    const until = now + Math.max(5 * MIN, Math.min(CLAIM_MAX_MS, Number.isFinite(minutes) && minutes > 0 ? minutes * MIN : CLAIM_DEFAULT_MS));
    const note = clean(opt.note, 160);
    const made = [], contested = [];
    for (const raw of wanted) {
      const abs = canon(raw.replace(/[*?].*$/, 'x'), agent.cwd);          // where the pattern starts, to anchor it
      const hasGlob = /[*?]/.test(raw);
      const full = hasGlob ? (path.isAbsolute(raw) ? raw : path.resolve(agent.cwd, raw)) : abs;
      const pattern = full ? relTo(scope.base, full) || (full === scope.base ? '**' : null) : null;
      if (!pattern) { contested.push({ path: raw, problem: 'outside your repository' }); continue; }
      const mine = claims.find((c) => c.agentId === agent.id && c.pattern === pattern && c.repo === scope.repo);
      if (mine) { mine.until = until; if (note) mine.note = note; made.push(mine); continue; }
      if (claims.filter((c) => c.agentId === agent.id).length >= CLAIMS_PER_AGENT) { contested.push({ path: raw, problem: 'you hold too many claims; release some' }); continue; }
      // somebody else already holds this, or something that covers it
      const probe = path.join(scope.base, pattern.replace(/[*?].*$/, ''));
      let taken = false;
      for (const other of claims) {
        if (other.agentId === agent.id || other.repo !== scope.repo) continue;
        if (other.pattern === pattern || claimCovers(other, probe, whereOf(agent)) || claimMatcher(pattern)(other.pattern.replace(/[*?].*$/, ''))) {
          contested.push({ path: pattern, by: other.agentName, byId: other.agentId, note: other.note || '', pattern: other.pattern });
          taken = true;
        }
      }
      if (taken && !opt.force) continue;                    // two claims on one thing help nobody: talk first (or say force)
      const c = { id: 'cl_' + crypto.randomBytes(5).toString('hex'), agentId: agent.id, agentName: agent.name, repo: scope.repo, base: scope.base, pattern, note, at: now, until };
      claims.push(c); made.push(c);
    }
    persist(); schedule(200);
    const lines = [];
    if (made.length) lines.push(`Claimed ${list(made.map((c) => c.pattern))} until ${new Date(until).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. Others will be told if they edit there; nothing is locked.`);
    for (const c of contested) lines.push(c.by ? `Not claimed: ${c.by} already claims ${c.pattern}${c.note ? ` (“${c.note}”)` : ''}. Talk first: office dm "${c.by}" "…"` : `Not claimed: ${c.path} — ${c.problem}.`);
    return { ok: made.length > 0, claims: made.map(pubClaim), contested, text: lines.join('\n') || 'Nothing claimed.' };
  }
  function release(agent, paths) {
    const before = claims.length;
    const wanted = (Array.isArray(paths) ? paths : paths ? [paths] : []).map((p) => clean(p, 300)).filter(Boolean);
    const scope = claimScope(agent);
    claims = claims.filter((c) => {
      if (c.agentId !== agent.id) return true;
      if (!wanted.length) return false;
      return !wanted.some((raw) => { const abs = canon(raw, agent.cwd); const rel = abs && scope ? relTo(scope.base, abs) : null; return c.pattern === raw || c.pattern === rel || c.id === raw; });
    });
    persist(); schedule(200);
    const n = before - claims.length;
    return { ok: true, released: n, text: n ? `Released ${n} claim${n > 1 ? 's' : ''}.` : 'You held no such claim.' };
  }
  const pubClaim = (c) => ({ id: c.id, agentId: c.agentId, agentName: c.agentName, repo: c.repo ? repoIdOf(c.repo) : null, pattern: c.pattern, note: c.note || '', at: c.at, until: c.until });

  /* ---- git ------------------------------------------------------------------------- */

  async function where(cwd) {
    const known = dirs.get(cwd);
    if (known && Date.now() - known.at < WHERE_TTL_MS) return known.where;
    if (known?.pending) return known.pending;
    const pending = G.locate(cwd).catch(() => null).then((w) => { dirs.set(cwd, { where: w, at: Date.now() }); return w; });
    dirs.set(cwd, { where: known?.where || null, at: known?.at || 0, pending });
    return pending;
  }
  async function probe(w, force) {
    let c = checkouts.get(w.root);
    if (!c) checkouts.set(w.root, c = { root: w.root, commonDir: w.commonDir, linked: w.linked, branch: null, detached: false, oid: null, upstream: null, ahead: 0, behind: 0, files: [], dirty: new Set(), total: 0, truncated: false, at: 0, failures: 0 });
    const now = Date.now();
    if (!force && now - c.at < Math.max(1200, cfg.gitEveryMs - 300) * Math.min(8, 1 + c.failures)) return c;
    const s = await G.status(w.root);
    if (!s) { c.failures += 1; c.at = now; return c; }
    Object.assign(c, { branch: s.branch, detached: s.detached, oid: s.oid, upstream: s.upstream, ahead: s.ahead, behind: s.behind, files: s.files, total: s.total, truncated: s.truncated,
      dirty: new Set(s.files.map((f) => f.path)), at: now, failures: 0 });
    return c;
  }
  async function committed(head, other) {
    if (!head.oid || !other.oid || head.oid === other.oid) return new Set();
    const key = `${head.oid}<${other.oid}`;
    let set = pairDiff.get(key);
    if (!set) {
      set = new Set((await G.changedSinceFork(head.root, other.oid, head.oid)).slice(0, 4000));
      if (pairDiff.size > 80) pairDiff.delete(pairDiff.keys().next().value);
      pairDiff.set(key, set);
    }
    return set;
  }

  let running = null, again = false, timer = null, timerAt = 0;
  function schedule(ms) {
    const at = Date.now() + ms;
    if (timer && timerAt <= at) return;
    clearTimeout(timer);
    timerAt = at;
    timer = setTimeout(() => { timer = null; tick().catch(() => {}); }, ms);
    if (typeof timer.unref === 'function') timer.unref();
  }
  async function tick(opt = {}) {
    if (running) { again = true; return running; }
    running = pass(opt).catch((err) => log.warn('[workspace] ' + (err?.stack || err))).finally(() => { running = null; });
    await running;
    if (again) { again = false; return tick(); }
    return undefined;
  }
  async function pass({ force = false } = {}) {
    const now = Date.now();
    const kept = claims.filter((c) => c.until > now);
    if (kept.length !== claims.length) { claims = kept; persist(); }
    for (const [id, mine] of touches) {
      for (const [p, t] of mine) if (now - t.at > TOUCH_KEEP_MS) mine.delete(p);
      if (!mine.size) touches.delete(id);
    }
    const live = present().filter((a) => a.cwd && path.isAbsolute(a.cwd));
    const pairs = new Map();                                          // root → root → Set(committed paths)
    if (probing && await G.gitAvailable()) {
      await Promise.all([...new Set(live.map((a) => a.cwd))].map((cwd) => where(cwd)));
      const active = new Map();
      for (const a of live) { const w = whereOf(a); if (w) active.set(w.root, w); }
      await Promise.all([...active.values()].map((w) => probe(w, force)));
      for (const root of [...checkouts.keys()]) if (!active.has(root)) checkouts.delete(root);
      const byRepo = new Map();
      for (const w of active.values()) { if (!byRepo.has(w.commonDir)) byRepo.set(w.commonDir, []); byRepo.get(w.commonDir).push(checkouts.get(w.root)); }
      await Promise.all([...byRepo].map(async ([commonDir, mine]) => {
        const r = repos.get(commonDir);
        if (force || !r || now - r.at > 60_000) {
          const all = await G.worktrees(mine[0].root);
          repos.set(commonDir, { at: now, others: all.filter((w) => !active.has(w.root)).slice(0, 12).map((w) => ({ root: w.root, branch: w.branch, detached: w.detached })) });
        }
        const some = mine.slice(0, 6);                                // six checkouts of one repository is fifteen pairs; enough
        for (const a of some) for (const b of some) {
          if (a === b) continue;
          if (!pairs.has(a.root)) pairs.set(a.root, new Map());
          pairs.get(a.root).set(b.root, await committed(a, b));
        }
      }));
      for (const key of [...repos.keys()]) if (!byRepo.has(key)) repos.delete(key);
    }
    findOverlaps(now, live, pairs);
    publish();
  }

  /* ---- overlaps ---------------------------------------------------------------------- */

  function findOverlaps(now, live, pairs) {
    const found = new Map();
    const add = (kind, severity, commonDir, rel, agents, text) => {
      const ids = agents.map((a) => a.id).sort();
      const id = crypto.createHash('sha1').update(`${kind}|${commonDir}|${rel}|${ids.join(',')}`).digest('hex').slice(0, 12);
      if (found.has(id)) return;
      const prev = overlaps.get(id);
      found.set(id, { id, kind, severity, repo: commonDir ? repoIdOf(commonDir) : null, repoName: commonDir ? repoNameOf(commonDir) : null, path: rel,
        agents: agents.map((a) => { const w = whereOf(a); const c = w && checkouts.get(w.root); return { id: a.id, name: a.name, branch: c?.branch || null }; }),
        since: prev?.since || now, text });
    };
    const recentEdits = (a) => [...(touches.get(a.id)?.values() || [])].filter((t) => t.editAt && now - t.editAt < WINDOW_MS);
    const byRoot = new Map();
    for (const a of live) { const w = whereOf(a); const key = w ? w.root : `dir:${a.cwd}`; if (!byRoot.has(key)) byRoot.set(key, []); byRoot.get(key).push(a); }

    // 1. two agents, one checkout, one file
    for (const [root, group] of byRoot) {
      if (group.length < 2) continue;
      const editors = new Map();
      for (const a of group) for (const t of recentEdits(a)) { if (!editors.has(t.path)) editors.set(t.path, []); editors.get(t.path).push(a); }
      for (const [abs, who] of editors) {
        if (who.length < 2) continue;
        const w = whereOf(who[0]);
        const rel = (w && relTo(w.root, abs)) || posix(path.relative(root.replace(/^dir:/, ''), abs));
        for (let i = 0; i < who.length; i++) for (let j = i + 1; j < who.length; j++) {
          add('same-file', 'high', w?.commonDir || null, rel, [who[i], who[j]], `${who[i].name} and ${who[j].name} are both editing ${rel} in the same checkout`);
        }
      }
    }
    // 2. an edit to something somebody else has claimed
    for (const c of claims) {
      const owner = live.find((a) => a.id === c.agentId);
      if (!owner) continue;
      for (const b of live) {
        if (b.id === owner.id) continue;
        const w = whereOf(b);
        for (const t of recentEdits(b)) {
          if (!claimCovers(c, t.path, w)) continue;
          const rel = (w && relTo(w.root, t.path)) || relTo(c.base, t.path) || t.path;
          add('claimed', 'medium', c.repo, rel, [owner, b], `${b.name} edited ${rel}, which ${owner.name} has claimed${c.note ? ` (“${c.note}”)` : ''}`);
        }
      }
    }
    // 3. the same file changed in two checkouts of one repository
    for (const [rootA, others] of pairs) {
      for (const [rootB, committedA] of others) {
        if (rootA >= rootB) continue;                                    // each pair once
        const A = checkouts.get(rootA), B = checkouts.get(rootB);
        const committedB = pairs.get(rootB)?.get(rootA) || new Set();
        if (!A || !B) continue;
        const changedA = new Set([...A.dirty, ...committedA]), changedB = new Set([...B.dirty, ...committedB]);
        const whoA = byRoot.get(rootA) || [], whoB = byRoot.get(rootB) || [];
        let n = 0;
        for (const rel of changedA) {
          if (!changedB.has(rel) || ++n > 40) continue;
          const pick = (group, root) => { const abs = path.join(root, rel); const hit = group.filter((a) => touches.get(a.id)?.get(abs)?.editAt); return (hit.length ? hit : group).slice(0, 2); };
          const agents = [...pick(whoA, rootA), ...pick(whoB, rootB)];
          if (agents.length < 2) continue;
          const inFlight = A.dirty.has(rel) || B.dirty.has(rel);
          add('both-changed', inFlight ? 'medium' : 'low', A.commonDir, rel, agents,
            `${rel} has changed on both ${A.branch || 'a detached checkout'} (${list(pick(whoA, rootA).map((a) => a.name))}) and ${B.branch || 'a detached checkout'} (${list(pick(whoB, rootB).map((a) => a.name))})`);
        }
      }
    }
    const fresh = [...found.values()].filter((o) => !overlaps.has(o.id));
    overlaps = found;
    if (fresh.length) tell(fresh, now, live);
  }

  /** One note per pair of agents per pass, naming what is new between them. */
  function tell(fresh, now, live) {
    const groups = new Map();
    for (const o of fresh) {
      if (o.severity === 'low') continue;                                // committed on both sides long ago: visible, not worth mail
      const key = `${o.kind}|${o.agents.map((a) => a.id).sort().join(',')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    }
    for (const [key, group] of groups) {
      const stamp = `${key}|${group.map((o) => o.path).sort().join(',')}`;
      const digest = crypto.createHash('sha1').update(stamp).digest('hex').slice(0, 16);
      if (noted[digest] && now - noted[digest] < NOTE_AGAIN_MS) continue;
      noted[digest] = now;
      const paths = group.map((o) => o.path), shown = paths.slice(0, 4).join(', ') + (paths.length > 4 ? ` and ${paths.length - 4} more` : '');
      const o = group[0];
      try { ctx.activity?.log('overlap', group.length === 1 ? o.text : `${list(o.agents.map((a) => a.name))} overlap on ${group.length} files (${shown})`, { agentIds: o.agents.map((a) => a.id), overlap: o.kind, paths: paths.slice(0, 12) }); }
      catch { /* the feed is a nicety */ }
      if (!cfg.overlapNotes) continue;
      for (const me of o.agents) {
        const agent = live.find((a) => a.id === me.id);
        if (!agent) continue;
        const others = o.agents.filter((a) => a.id !== me.id).map((a) => a.name);
        const dm = `office dm "${others[0]}" "…"`;
        const text = o.kind === 'same-file'
          ? `Heads-up from the office: you and ${list(others)} are both editing ${shown} in the same checkout (${o.repoName || 'this folder'}${me.branch ? `, ${me.branch}` : ''}). One of you is about to overwrite the other. Agree who has it: ${dm}`
          : o.kind === 'claimed'
            ? `Heads-up from the office: ${o.text}. Worth a word before it goes further: ${dm}`
            : `Heads-up from the office: you${me.branch ? ` (on ${me.branch})` : ''} and ${list(others)} have both changed ${shown} in ${o.repoName}. That will need merging by hand unless one of you picks up the other's work first: ${dm}`;
        note(agent, text + '\n(office repo shows who is working where.)', now);
      }
    }
    persist();
  }
  function note(agent, text, now) {
    const times = (noteTimes.get(agent.id) || []).filter((t) => now - t < HOUR);
    if (times.length >= NOTES_PER_HOUR) return false;
    times.push(now); noteTimes.set(agent.id, times);
    try {
      const { bbs } = ctx, key = `office:${agent.id}`;
      const thread = bbs.getThreads('collab').find((t) => t.meta?.kind === 'office-notice' && t.meta?.participantKey === key) || null;
      const meta = { toAgentId: agent.id, toAgentName: agent.name, fromAgentName: 'Office', officeNote: true };
      if (thread) bbs.reply({ threadId: thread.id, author: 'Office', authorType: 'system', content: text, meta });
      else bbs.createThread({ board: 'collab', subject: `Office notices for ${agent.name}`, author: 'Office', authorType: 'system', content: text,
        meta: { kind: 'office-notice', participantKey: key, participants: ['office', agent.id], ...meta }, postMeta: meta });
      ctx.comms.broadcastCollabRecent();
      return true;
    } catch (err) { log.warn('[workspace] could not leave a note: ' + (err?.message || err)); return false; }
  }

  /* ---- reading it back ------------------------------------------------------------------ */

  function snapshot() {
    const now = Date.now(), live = present();
    const repoList = new Map();
    const agents = {};
    for (const a of live) {
      const w = whereOf(a), c = w && checkouts.get(w.root);
      const mine = [...(touches.get(a.id)?.values() || [])].slice(-12).reverse();
      if (!c && !mine.length) continue;
      agents[a.id] = {
        repo: w ? repoIdOf(w.commonDir) : null, root: w?.root || null, branch: c?.branch || null, detached: !!c?.detached, linked: !!w?.linked,
        dirty: c?.total || 0, ahead: c?.ahead || 0, behind: c?.behind || 0,
        touched: mine.map((t) => ({ path: (w && relTo(w.root, t.path)) || t.path, kind: t.kind, at: t.at })),
      };
      if (!c) continue;
      const id = repoIdOf(w.commonDir);
      if (!repoList.has(id)) repoList.set(id, { id, name: repoNameOf(w.commonDir), checkouts: new Map(), idle: repos.get(w.commonDir)?.others || [] });
      const r = repoList.get(id);
      if (!r.checkouts.has(c.root)) {
        r.checkouts.set(c.root, { root: c.root, name: path.basename(c.root), branch: c.branch, detached: c.detached, head: c.oid ? c.oid.slice(0, 9) : null, upstream: c.upstream,
          ahead: c.ahead, behind: c.behind, linked: c.linked, dirty: c.total, files: c.files.slice(0, FILES_SHOWN), truncated: c.truncated || c.files.length > FILES_SHOWN, agents: [], probedAt: c.at });
      }
      r.checkouts.get(c.root).agents.push(a.id);
    }
    return {
      generatedAt: now, git: probing,
      repos: [...repoList.values()].map((r) => ({ ...r, checkouts: [...r.checkouts.values()].sort((x, y) => String(x.branch).localeCompare(String(y.branch))) })).sort((x, y) => x.name.localeCompare(y.name)),
      agents,
      claims: claims.filter((c) => c.until > now).map(pubClaim),
      overlaps: [...overlaps.values()].sort((x, y) => ['high', 'medium', 'low'].indexOf(x.severity) - ['high', 'medium', 'low'].indexOf(y.severity) || x.since - y.since),
    };
  }
  function publish() {
    const snap = snapshot();
    const key = JSON.stringify([snap.repos.map((r) => [r.id, r.checkouts.map((c) => [c.root, c.branch, c.head, c.dirty, c.ahead, c.behind, c.agents, c.files.map((f) => f.path + f.state)])]),
      Object.entries(snap.agents).map(([id, a]) => [id, a.branch, a.dirty, a.touched.map((t) => t.path + t.kind)]), snap.claims.map((c) => [c.id, c.until]), snap.overlaps.map((o) => o.id)]);
    if (key === lastSent) return;
    lastSent = key;
    bus.broadcast({ type: EV.WORKSPACE, workspace: snap });
  }

  /** Who else has to do with this file, as far as `agent` is concerned. Used before an edit (the guard hook) and by `office touching`. */
  function about(agent, p, opt = {}) {
    const abs = canon(p, opt.cwd || agent?.cwd);
    if (!abs) return { ok: false, path: p, items: [], warnings: [], text: 'That is not a path the office can place.' };
    const now = Date.now(), mine = agent ? whereOf(agent) : null;
    const rel = (mine && relTo(mine.root, abs)) || abs;
    const items = [], warnings = [];
    for (const a of present()) {
      if (agent && a.id === agent.id) continue;
      const w = whereOf(a);
      const t = touches.get(a.id)?.get(abs) || (w && mine && w.commonDir === mine.commonDir && w.root !== mine.root ? touches.get(a.id)?.get(path.join(w.root, rel)) : null);
      const sameCheckout = mine ? w?.root === mine.root : a.cwd === agent?.cwd;
      const c = w && checkouts.get(w.root);
      const changedThere = !!(c && mine && w.commonDir === mine.commonDir && w.root !== mine.root && (c.dirty.has(rel) || pairDiff.get(`${c.oid}<${checkouts.get(mine.root)?.oid}`)?.has(rel)));
      if (t) items.push({ agentId: a.id, agentName: a.name, kind: t.kind, at: t.at, editAt: t.editAt || null, sameCheckout, branch: c?.branch || null });
      else if (changedThere) items.push({ agentId: a.id, agentName: a.name, kind: 'changed', at: c.at, editAt: null, sameCheckout: false, branch: c.branch });
      if (t?.editAt && now - t.editAt < WINDOW_MS && sameCheckout) warnings.push({ kind: 'same-file', agentId: a.id, agentName: a.name, text: `${a.name} edited ${rel} ${agoText(now - t.editAt)}, in this same checkout. Check with them before you change it: office dm "${a.name}" "…"` });
      else if (changedThere || (t?.editAt && !sameCheckout && mine && w?.commonDir === mine.commonDir)) warnings.push({ kind: 'both-changed', agentId: a.id, agentName: a.name, text: `${rel} has also been changed by ${a.name}${c?.branch ? ` on ${c.branch}` : ''}. Your edits and theirs will need merging.` });
    }
    for (const c of claims) {
      if ((agent && c.agentId === agent.id) || c.until <= now || !claimCovers(c, abs, mine)) continue;
      warnings.push({ kind: 'claimed', agentId: c.agentId, agentName: c.agentName, text: `${rel} is claimed by ${c.agentName}${c.note ? ` (“${c.note}”)` : ''}. Talk to them first: office dm "${c.agentName}" "…"` });
    }
    let give = warnings;
    if (opt.once && agent) {                                           // the hook should say a thing once, not on every keystroke
      give = warnings.filter((wr) => { const k = `${agent.id}|${abs}|${wr.agentId}|${wr.kind}`; const seen = warned.get(k); if (seen && now - seen < 15 * MIN) return false; warned.set(k, now); return true; });
      if (warned.size > 3000) for (const [k, at] of warned) if (now - at > 15 * MIN) warned.delete(k);
    }
    items.sort((x, y) => y.at - x.at);
    const lines = items.map((i) => `  ${i.agentName} ${i.kind === 'edit' ? 'edited' : i.kind === 'changed' ? 'has changes to' : 'read'} it ${agoText(now - i.at)}${i.sameCheckout ? '' : i.branch ? ` (on ${i.branch})` : ' (another checkout)'}`);
    return { ok: true, path: rel, items, warnings: give,
      text: [items.length ? `${rel}:` : `Nobody else here has touched ${rel}.`, ...lines, ...warnings.map((w) => `  ! ${w.text}`)].join('\n') };
  }

  /** `office repo`: where you are, who shares it, what is in the way. */
  function forAgent(agent) {
    const now = Date.now(), w = whereOf(agent), c = w && checkouts.get(w.root);
    const lines = [];
    if (!probing) lines.push('The office is not reading git here (OFFICE_GIT=0). Claims still work.');
    else if (!c) lines.push(agent.cwd ? `${agent.cwd} is not inside a git repository the office can read, so there is nothing to compare. Claims still work: office claim <path>` : 'The office does not know which folder you work in.');
    else {
      const track = c.upstream ? ` (${c.ahead} ahead, ${c.behind} behind ${c.upstream})` : '';
      lines.push(`You are in ${repoNameOf(w.commonDir)} on ${c.detached ? 'a detached HEAD' : c.branch || 'an unborn branch'}${track}${w.linked ? ', in your own worktree' : ''}. ${c.total ? `${c.total} file${c.total > 1 ? 's' : ''} changed.` : 'Nothing changed yet.'}`);
      const sharing = present().filter((a) => a.id !== agent.id && whereOf(a)?.root === w.root).map((a) => a.name);
      if (sharing.length) lines.push(`Sharing this checkout with ${list(sharing)}: edits here can collide. Claim what you are on (office claim <path>), or ask for a checkout of your own (office worktree <name>).`);
      const siblings = present().filter((a) => a.id !== agent.id && whereOf(a)?.commonDir === w.commonDir && whereOf(a).root !== w.root);
      const byRoot = new Map(); for (const a of siblings) { const r = whereOf(a).root; if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(a.name); }
      for (const [root, names] of byRoot) { const o = checkouts.get(root); lines.push(`  ${o?.branch || 'detached'}: ${list(names)}${o?.total ? `, ${o.total} changed` : ''}`); }
    }
    const mine = [...overlaps.values()].filter((o) => o.agents.some((a) => a.id === agent.id));
    for (const o of mine) lines.push(`${o.severity === 'high' ? '!' : '~'} ${o.text}`);
    const live = claims.filter((cl) => cl.until > now && (!w || !cl.repo || cl.repo === w.commonDir));
    if (live.length) {
      lines.push('Claims:');
      for (const cl of live) lines.push(`  ${cl.pattern} — ${cl.agentId === agent.id ? 'you' : cl.agentName}${cl.note ? `, “${cl.note}”` : ''}, ${Math.max(1, Math.round((cl.until - now) / MIN))} min left`);
    }
    return { ok: true, agentId: agent.id, repo: c ? { name: repoNameOf(w.commonDir), branch: c.branch, dirty: c.total, ahead: c.ahead, behind: c.behind, linked: w.linked } : null,
      overlaps: mine, claims: live.map(pubClaim), text: lines.join('\n') };
  }

  /** A checkout of one's own: `git worktree add` on a new branch, beside the repository. */
  async function addWorktree(agent, opt = {}) {
    const from = opt.cwd && path.isAbsolute(String(opt.cwd)) ? String(opt.cwd) : agent?.cwd;
    const w = from ? await where(from) : null;
    if (!w) return { error: 'that folder is not inside a git repository', status: 400 };
    const name = G.safeRefName(String(opt.name || '').replace(/\s+/g, '-').toLowerCase());
    if (!name || name.includes('/')) return { error: 'give the checkout a short name: letters, digits, dots and dashes', status: 400 };
    const branch = G.safeRefName(opt.branch || `office/${name}`);
    if (!branch) return { error: 'that is not a usable branch name', status: 400 };
    const main = path.basename(w.commonDir) === '.git' ? path.dirname(w.commonDir) : w.root;
    const dir = path.join(cfg.worktreeDir || path.join(path.dirname(main), `${path.basename(main)}.worktrees`), name);
    const made = await G.addWorktree(w.root, { dir, branch, base: opt.base ? String(opt.base) : 'HEAD' });
    if (!made.ok) return { error: made.error, status: 409 };
    schedule(300);
    return { ok: true, dir: made.dir, branch: made.branch, text: `A checkout of your own: ${made.dir} on a new branch ${made.branch} (from ${opt.base || 'where you are now'}). Work there and nobody else's edits can land on yours: cd ${made.dir}` };
  }

  let interval = null;
  return {
    snapshot, forAgent, about, touch, claim, release, addWorktree,
    refresh: async () => { await tick({ force: true }); return snapshot(); },
    start() { schedule(600); interval = setInterval(() => tick().catch(() => {}), cfg.gitEveryMs); interval.unref(); },
    stop() { clearInterval(interval); clearTimeout(timer); try { store.flush(); } catch { /* best effort */ } },
  };
}

export function registerWorkspaceRoutes(router, ctx) {
  const { workspace } = ctx;
  const who = (ref) => ctx.requireAgent(ref);
  const seen = (agent) => { ctx.agents.seen(agent.id); return agent; };
  const paths = (body) => (Array.isArray(body.paths) ? body.paths : body.path ? [body.path] : []);

  router.get('/api/workspace', () => workspace.snapshot(),
    { about: 'Who is working where: repositories, checkouts (branch, changed files), each agent\'s recent files, claims, and overlaps between agents.' });
  router.get('/api/workspace/agent/:ref', (c) => workspace.forAgent(seen(who(c.params.ref))),
    { about: 'One agent\'s view: its branch, who shares its checkout, overlaps and claims, as text.' });
  router.get('/api/workspace/check', (c) => {
    const agent = seen(who(c.query.get('agent') || ''));
    const p = c.query.get('path') || '';
    if (!p) throw new HttpError(400, 'path required');
    return workspace.about(agent, p, { once: c.query.get('once') === '1', cwd: c.query.get('cwd') || undefined });
  }, { about: 'Before editing a file: has somebody else just edited it here, changed it on another branch, or claimed it? (?agent=&path=&once=1)' });
  router.get('/api/workspace/touching', (c) => {
    const p = c.query.get('path') || '';
    if (!p) throw new HttpError(400, 'path required');
    const ref = c.query.get('agent');
    return workspace.about(ref ? seen(who(ref)) : null, p, { cwd: c.query.get('cwd') || undefined });
  }, { about: 'Who has read, edited or claimed a file lately (?path=&agent=).' });
  router.post('/api/workspace/claim', async (c) => {
    const body = await c.json();
    return c.result(workspace.claim(seen(who(body.agent || body.agentId)), paths(body), { note: body.note, minutes: body.minutes, force: body.force === true }));
  }, { about: 'Say what you are working on: {agent, paths:[…], note?, minutes?}. Advisory: others are told if they edit there.' });
  router.post('/api/workspace/release', async (c) => {
    const body = await c.json();
    return c.result(workspace.release(seen(who(body.agent || body.agentId)), paths(body)));
  }, { about: 'Let go of claims: {agent, paths?} (no paths: all of yours).' });
  router.post('/api/workspace/touch', async (c) => {
    const body = await c.json();
    const agent = seen(who(body.agent || body.agentId));
    const done = paths(body).slice(0, 40).map((p) => workspace.touch(agent, p, { kind: body.kind, tool: body.tool })).filter(Boolean);
    return { ok: true, recorded: done.length };
  }, { about: 'For runtimes without hooks: tell the office which files you are reading or editing: {agent, paths:[…], kind:"edit"|"read"}.' });
  router.post('/api/workspace/refresh', () => workspace.refresh(), { about: 'Ask git again now, then return the snapshot.' });
  router.post('/api/workspace/worktree', async (c) => {
    const body = await c.json();
    const agent = body.agent || body.agentId ? seen(who(body.agent || body.agentId)) : null;
    return c.result(await workspace.addWorktree(agent, { cwd: body.cwd, name: body.name, branch: body.branch, base: body.base }));
  }, { loopbackOnly: true, about: 'Make a checkout of your own (git worktree add, on a new branch): {agent | cwd, name, branch?, base?}.' });
}
