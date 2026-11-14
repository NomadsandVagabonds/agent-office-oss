// office-self.mjs — "who is running this helper, and where is the office?"
// Shared by every office-*.mjs command so identity resolves the same way from
// any runtime:
//
//   --id <sessionId>          explicit, always wins
//   OFFICE_SESSION_ID         for runtimes that export nothing of their own
//   CODEX_THREAD_ID           Codex
//   CLAUDE_CODE_SESSION_ID    Claude Code (CLAUDE_SESSION_ID on older builds)
//
// With none of those, the daemon matches the caller by working directory when
// exactly one agent sits there.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { requestJson } from './office-http.mjs';

export const OFFICE_HOME = path.dirname(fileURLToPath(import.meta.url));
export const PORT = process.env.OFFICE_PORT || 4317;
export const BASE = `http://127.0.0.1:${PORT}`;
const GLOBAL_PROFILES = path.join(os.homedir(), '.claude', 'agent-office', 'profiles.json');
const LOCAL_PROFILES = path.join(OFFICE_HOME, 'data', 'profiles.local.json');

export function flagValue(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? (argv[index + 1] || '') : '';
}

// Positional words only: drops `--flag value` pairs and bare `--switches`.
export function positional(argv, valueFlags = [], switches = []) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (valueFlags.includes(argv[i])) { i += 1; continue; }
    if (switches.includes(argv[i])) continue;
    out.push(argv[i]);
  }
  return out;
}

export function sessionIdFrom(argv = []) {
  return flagValue(argv, '--id')
    || process.env.OFFICE_SESSION_ID
    || process.env.CODEX_THREAD_ID
    || process.env.CLAUDE_CODE_SESSION_ID
    || process.env.CLAUDE_SESSION_ID
    || '';
}

export function providerGuess() {
  if (process.env.OFFICE_RUNTIME_PROVIDER) return process.env.OFFICE_RUNTIME_PROVIDER;
  if (process.env.CODEX_THREAD_ID) return 'codex';
  if (process.env.CLAUDE_CODE_SESSION_ID || process.env.CLAUDE_SESSION_ID || process.env.CLAUDECODE) {
    return 'claude';
  }
  return '';
}

function loadProfiles() {
  const read = (file) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
  };
  const global = read(GLOBAL_PROFILES);
  const local = read(LOCAL_PROFILES);
  return {
    bySession: { ...(global.bySession || {}), ...(local.bySession || {}) },
    byCwd: { ...(global.byCwd || {}), ...(local.byCwd || {}) },
  };
}

export function resolveSelf(argv = []) {
  const profiles = loadProfiles();
  const cwd = process.cwd();
  const sid = sessionIdFrom(argv);
  const prof = { ...(cwd && profiles.byCwd[cwd]), ...(sid && profiles.bySession[sid]) };
  return {
    sessionId: sid || null,
    runtimeSessionId: process.env.OFFICE_RUNTIME_SESSION_ID || null,
    cwd,
    name: prof.name || process.env.OFFICE_AUTHOR || process.env.USER || 'Agent',
    provider: providerGuess(),
    model: process.env.OFFICE_MODEL || '',
  };
}

// The fields every office endpoint reads to work out who is calling.
export function identity(me) {
  return {
    sessionId: me.sessionId,
    agentId: me.sessionId,
    authorAgentId: me.sessionId,
    authorSessionId: me.sessionId,
    authorRuntimeSessionId: me.runtimeSessionId,
    cwd: me.cwd,
    author: me.name,
    authorType: 'agent',
    provider: me.provider,
    model: me.model,
  };
}

// ?agentId=…&cwd=… for GET endpoints.
export function identityQuery(me) {
  const q = new URLSearchParams();
  if (me.sessionId) q.set('agentId', me.sessionId);
  if (me.cwd) q.set('cwd', me.cwd);
  return q.toString();
}

export const api = (pathname, opt = {}) => requestJson(BASE + pathname, opt);
export const post = (pathname, body) => api(pathname, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body,
});

// A helper's usage text is the comment block at the top of its own file.
export function headerHelp(moduleUrl) {
  const lines = fs.readFileSync(fileURLToPath(moduleUrl), 'utf8').split('\n');
  const out = [];
  for (const line of lines) {
    if (line.startsWith('#!')) continue;
    if (!line.startsWith('//')) break;
    out.push(line.replace(/^\/\/ ?/, ''));
  }
  return out.join('\n');
}

// Uniform failure output: say what went wrong and what to do about it.
export function fail(tool, err) {
  if (err && err.unreachable) {
    console.error(`${tool}: the office daemon is not running on port ${PORT}.`);
    console.error(`  start it:  (cd "${OFFICE_HOME}" && npm run dev)`);
  } else {
    console.error(`${tool}: ${err && err.message ? err.message : err}`);
  }
  process.exit(1);
}

// "10m", "90s", "1h", or a bare number of minutes → milliseconds (0 if unset).
export function parseSpan(text) {
  const match = /^(\d+(?:\.\d+)?)\s*(s|m|h)?$/i.exec(String(text || '').trim());
  if (!match) return 0;
  const unit = (match[2] || 'm').toLowerCase();
  return Math.round(Number(match[1]) * (unit === 's' ? 1e3 : unit === 'h' ? 3600e3 : 60e3));
}

export function fmtSpan(ms) {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function ago(ts) {
  const span = fmtSpan(Date.now() - ts);
  return span.endsWith('s') ? 'just now' : `${span} ago`;
}
