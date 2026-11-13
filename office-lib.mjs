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
const IDENTITY_DIR = path.join(os.homedir(), '.claude', 'agent-office', 'identity');

export class OfficeError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status || 0;
    this.body = body || null;
  }
}

function viaCurl(url, method, headers, body) {
  const args = ['-s', '-m', '8', '-X', method];
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
  const url = BASE + pathname;
  let status = 0, text = '';
  try {
    const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(opt.timeoutMs || 8000) });
    status = res.status; text = await res.text();
  } catch (err) {
    try { ({ status, text } = viaCurl(url, method, headers, body)); }
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

export function fmtTime(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
