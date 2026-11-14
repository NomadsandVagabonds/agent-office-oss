// office-lib.mjs — what every office client needs: how to reach the daemon and
// how to know who you are. Shared by the `office` CLI and the MCP server so an
// agent has one identity however it talks to the office.
import cp from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PORT = Number(process.env.OFFICE_PORT || 4317);
export const BASE = (process.env.OFFICE_URL || `http://127.0.0.1:${PORT}`).replace(/\/+$/, '');
const TOKEN = process.env.OFFICE_TOKEN || '';
// Set by the office for an agent it launched itself: proves which session is calling.
const SESSION_TOKEN = process.env.OFFICE_SESSION_TOKEN || '';
const IDENTITY_DIR = path.join(os.homedir(), '.claude', 'agent-office', 'identity');

export class OfficeError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status || 0;
    this.body = body || null;
  }
}

function viaCurl(url, method, headers, body, timeoutMs = 8000) {
  const args = ['-s', '-m', String(Math.max(1, Math.ceil(timeoutMs / 1000))), '-X', method];
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  if (body !== undefined) args.push('--data-binary', body);
  args.push('-w', '\n%{http_code}', url);
  const out = cp.execFileSync('curl', args, { encoding: 'utf8' });
  const cut = out.lastIndexOf('\n');
  return { status: Number(out.slice(cut + 1).trim()) || 0, text: cut >= 0 ? out.slice(0, cut) : out };
}

/**
 * Call the daemon. Uses fetch; falls back to curl where a sandbox blocks
 * Node's loopback sockets but allows curl (Codex does this).
 */
export async function api(pathname, opt = {}) {
  const method = (opt.method || (opt.body !== undefined ? 'POST' : 'GET')).toUpperCase();
  const headers = { ...(opt.headers || {}) };
  let body;
  if (opt.body !== undefined) {
    body = typeof opt.body === 'string' ? opt.body : JSON.stringify(opt.body);
    headers['content-type'] = 'application/json';
  }
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  if (SESSION_TOKEN) headers['x-office-session'] = SESSION_TOKEN;
  const url = BASE + pathname;
  let status = 0, text = '';
  try {
    const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(opt.timeoutMs || 8000) });
    status = res.status; text = await res.text();
  } catch (err) {
    try { ({ status, text } = viaCurl(url, method, headers, body, opt.timeoutMs)); }
    catch { throw new OfficeError(`cannot reach the office at ${BASE} — is the daemon running? (node daemon.mjs)`, 0); }
    if (!status) throw new OfficeError(`cannot reach the office at ${BASE} — is the daemon running? (node daemon.mjs)`, 0);
  }
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = { text }; } }
  if (status >= 400) {
    const detail = data && Array.isArray(data.errors) ? `: ${data.errors.join('; ')}` : '';
    throw new OfficeError(((data && (data.error || data.detail)) || `HTTP ${status}`) + detail, status, data);
  }
  return data;
}

/* ---- who am I? ---------------------------------------------------------- */

export function envSessionId() {
  return process.env.OFFICE_AGENT_ID
    || process.env.CODEX_THREAD_ID
    || process.env.CLAUDE_SESSION_ID
    || process.env.CLAUDE_CODE_SESSION_ID
    || '';
}

export function detectProvider(hint) {
  const explicit = process.env.OFFICE_PROVIDER || hint || '';
  if (explicit) return String(explicit).toLowerCase();
  if (process.env.CODEX_THREAD_ID) return 'codex';
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE_SESSION_ID || process.env.CLAUDE_SESSION_ID) return 'claude';
  if (process.env.GEMINI_CLI || process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENCODE) return 'opencode';
  return 'custom';
}

function identityFile(cwd, provider) {
  const key = crypto.createHash('sha1').update(`${provider}\n${cwd}`).digest('hex').slice(0, 20);
  return path.join(IDENTITY_DIR, `${key}.json`);
}

function readSavedIdentity(cwd, provider) {
  try { return JSON.parse(fs.readFileSync(identityFile(cwd, provider), 'utf8')); }
  catch { return null; }
}

function saveIdentity(cwd, provider, id) {
  try {
    fs.mkdirSync(IDENTITY_DIR, { recursive: true });
    fs.writeFileSync(identityFile(cwd, provider), JSON.stringify({ id, provider, cwd, at: Date.now() }));
  } catch { /* identity memory is a convenience, not a requirement */ }
}

/**
 * Find (or create) this session's agent in the office.
 *   1. an id the runtime put in the environment
 *   2. the id this directory joined with last time, if the office still knows it
 *   3. the only agent already sitting in this directory
 *   4. otherwise — when `join` is allowed — walk in through the front door
 * @returns {Promise<{id:string, agent:object|null, joined:boolean}>}
 */
export async function resolveSelf(opt = {}) {
  const cwd = opt.cwd || process.cwd();
  const provider = detectProvider(opt.provider);
  const lookup = async (id) => {
    try { return (await api(`/api/agents/${encodeURIComponent(id)}`)).agent; }
    catch (err) { if (err.status === 404) return null; throw err; }
  };
  const envId = opt.id || envSessionId();
  if (envId) {
    const agent = await lookup(envId);
    if (agent || opt.join === false) return { id: envId, agent, joined: false };
    const made = await join({ ...opt, id: envId, cwd, provider });
    return { id: made.agent.id, agent: made.agent, joined: true };
  }
  const saved = readSavedIdentity(cwd, provider);
  if (saved?.id) {
    const agent = await lookup(saved.id);
    if (agent) return { id: saved.id, agent, joined: false };
  }
  const here = (await api('/api/agents')).filter((a) => a.cwd === cwd);
  const sameProvider = here.filter((a) => (a.provider || '') === provider);
  const only = sameProvider.length === 1 ? sameProvider[0] : (here.length === 1 ? here[0] : null);
  if (only) { saveIdentity(cwd, provider, only.id); return { id: only.id, agent: only, joined: false }; }
  if (opt.join === false) return { id: '', agent: null, joined: false };
  const made = await join({ ...opt, cwd, provider });
  return { id: made.agent.id, agent: made.agent, joined: true };
}

export async function join(opt = {}) {
  const cwd = opt.cwd || process.cwd();
  const provider = detectProvider(opt.provider);
  const res = await api('/api/agents/join', { body: {
    id: opt.id || envSessionId() || undefined,
    provider,
    model: opt.model || process.env.OFFICE_MODEL || undefined,
    cwd,
    name: opt.name || process.env.OFFICE_AUTHOR || undefined,
    handle: opt.handle || process.env.OFFICE_HANDLE || undefined,
    task: opt.task || undefined,
    runtimeSessionId: process.env.OFFICE_RUNTIME_SESSION_ID || undefined,
  } });
  saveIdentity(cwd, provider, res.agent.id);
  return res;
}

/** Post one hook-vocabulary event for this agent (status changes ride on these). */
export function hook(id, name, extra = {}) {
  return api('/hook', { body: {
    session_id: id, hook_event_name: name, cwd: process.cwd(),
    provider: detectProvider(), model: process.env.OFFICE_MODEL || undefined,
    runtime_session_id: process.env.OFFICE_RUNTIME_SESSION_ID || undefined,
    ...extra,
  } });
}

/* ---- delegation + transcripts, as text ----------------------------------- */

const DELEGATION_DONE = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

/**
 * Wait for a delegated task: until it finishes, needs the human, or `seconds`
 * have passed. The daemon holds one request for under a minute, so a longer
 * wait is several of them. Waiting never cancels the task.
 */
export async function waitForDelegation(id, seconds) {
  const until = Date.now() + Math.max(1, Number(seconds) || 30) * 1000;
  for (;;) {
    const left = Math.max(500, Math.min(40_000, until - Date.now()));
    const { delegation } = await api(`/api/delegations/${encodeURIComponent(id)}?wait=1&timeoutMs=${left}`, { timeoutMs: left + 8000 });
    if (DELEGATION_DONE.has(delegation.status) || delegation.pendingApproval || Date.now() >= until - 250) return delegation;
  }
}

/** Which agents the office can start, who it is driving, and whether it may act by itself right now. */
export function formatHarness(h) {
  const lines = ['Agents the office can start here  (office delegate <adapter> <task…>)'];
  for (const a of h.adapters) {
    lines.push(`  ${a.id.padEnd(12)} ${a.label} · ${a.protocol}${a.available ? '' : '  — not installed'}`
      + `${!a.available && a.note ? `\n${' '.repeat(15)}${a.note}` : ''}`);
  }
  if (h.sessions?.length) {
    lines.push('', 'Driven by the office now');
    for (const s of h.sessions) {
      lines.push(`  ${s.name || s.label} (${s.adapter}) · ${s.state}${s.pending?.length ? ' on the human' : ''} · ${s.modeLabel} · wake ${s.wake}   ${s.id}`);
    }
  }
  const w = h.wake || {};
  lines.push('', w.paused ? 'Automatic turns are PAUSED by the human: the office will not start work by itself (delegation by agents included).'
    : `Automatic turns are on. A chain of agents handing work to agents stops after ${w.limits?.maxHops ?? '?'} steps; then a human decides.`);
  const d = h.limits?.delegate;
  if (d) {
    lines.push(d.enabled ? `Delegated work runs in mode "${d.maxMode}" at most (never broader than yours); ${d.maxActive} at once, ${d.maxPerHour} an hour.`
      : 'Delegation is switched off on this office.');
  }
  return lines.join('\n');
}

/** One delegated task in a few lines an agent can act on. */
export function formatDelegation(d) {
  const lines = [`${d.id}  ${d.status}  →  ${d.to?.name || '?'} (${d.to?.adapter || d.to?.provider || 'agent'})  “${d.title}”`];
  if (d.pendingApproval) lines.push(`  waiting on the human: ${d.pendingApproval.title || d.pendingApproval.kind} (you cannot answer this; they will)`);
  if (d.waitTimedOut) lines.push('  still running — the wait timed out, the task did not');
  if (d.error && d.status !== 'completed') lines.push(`  ${d.error}`);
  if (d.result) lines.push('', d.result, d.resultTruncated ? '(cut for length — read the rest: office transcript ' + d.to.agentId + ')' : '');
  if (d.next) lines.push('', d.next);
  return lines.filter((l) => l !== undefined).join('\n').trimEnd();
}

const secs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

/** A session's transcript as a readable timeline. */
export function formatTranscript(session, entries, opt = {}) {
  const out = [];
  if (session) out.push(`# ${session.name || session.label} — ${session.label} (${session.protocol}) · ${session.state}${session.turns ? ` · ${session.turns} turn(s)` : ''}`);
  const cut = (t, n) => { const flat = String(t || ''); return opt.full || flat.length <= n ? flat : flat.slice(0, n - 1) + '…'; };
  for (const e of entries) {
    switch (e.kind) {
      case 'turn':
        out.push('', `── turn ${e.n} · ${e.origin}${e.from ? ` from ${e.from}` : ''}${e.hop ? ` (hop ${e.hop})` : ''} · ${e.state}`
          + `${e.durationMs ? ` (${secs(e.durationMs)})` : ''}${e.error ? ` — ${e.error}` : ''}`);
        break;
      case 'user': out.push(`> ${cut(e.text, 600).replace(/\n/g, '\n> ')}`); break;
      case 'message': out.push(cut(e.text, 4000)); break;
      case 'thought': if (opt.full) out.push(`(thinking) ${e.text}`); break;
      case 'tool':
        out.push(`[${e.name || 'tool'}] ${e.command || e.title}${e.paths?.length && !e.command ? ` (${e.paths.join(', ')})` : ''} · ${e.status}`
          + `${opt.full && e.output ? '\n' + e.output.replace(/^/gm, '    ') : ''}`);
        break;
      case 'plan': if (e.entries?.length) out.push(`[plan] ${e.entries.map((p) => `${p.status === 'completed' ? '✓' : p.status === 'running' ? '▸' : '·'} ${p.text}`).join('  ')}`); break;
      case 'permission':
        out.push(`[permission] ${e.command || (e.paths || []).join(', ') || e.title} → ${e.state}${e.by ? ` by ${e.by}` : ''}${e.reason ? ` (${e.reason})` : ''}`);
        break;
      case 'question': out.push(`[question] ${cut(e.text, 300)} → ${e.state}${e.answer ? `: ${cut(e.answer, 200)}` : ''}`); break;
      case 'notice': out.push(`(${e.text})`); break;
      case 'handoff': out.push(`[handoff ${e.direction === 'out' ? `to ${e.toName}` : `from ${e.fromName}`}] ${e.items} item(s)`); break;
      case 'session':
        if (e.state === 'ended' || e.state === 'failed') out.push('', `── session ${e.state}${e.reason ? `: ${e.reason}` : ''}`);
        break;
      default: break;
    }
  }
  return out.join('\n').trim();
}

export function fmtTime(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
