// The Office — harness: which agents the office can drive.
//
// An adapter entry says how to start one agent CLI in its structured mode and
// which protocol it then speaks. The built-in list covers the agents the
// office already knows; anything else that speaks ACP (there are dozens — see
// the public registry at agentclientprotocol.com) is one entry in the
// operator's own file:
//
//   ~/.claude/agent-office/harness.json   (or $OFFICE_HARNESS_FILE)
//   { "adapters": [ { "id": "goose", "label": "Goose", "protocol": "acp",
//                     "command": "goose", "args": ["acp"] } ] }
//
// Two rules keep this safe. A command comes only from this catalog, never from
// a request — nobody on the wire can make the daemon run an arbitrary program.
// And the office only ever runs what is already installed: it does not
// download agents (no `npx`), so what runs is what the operator put on PATH.
import fs from 'node:fs';
import { whichSync, redact } from './child.mjs';
import { normalizeProvider } from '../../core/contract.mjs';

export const PROTOCOLS = Object.freeze(['acp', 'codex-app-server']);
export const MODES = Object.freeze(['ask', 'edits', 'full']);
export const MODE_RANK = Object.freeze({ ask: 0, edits: 1, full: 2 });
export const MODE_LABEL = Object.freeze({
  ask: 'asks before it acts',
  edits: 'edits freely, asks for the rest',
  full: 'acts without asking',
});

// Launch arguments as published in the ACP registry (checked 2026-11) and, for
// Codex, as T3 Code starts its app-server.
const BUILTIN = Object.freeze([
  { id: 'claude', label: 'Claude Code', provider: 'claude', protocol: 'acp', command: 'claude-agent-acp', args: [],
    note: 'Claude Code through its ACP wrapper. Install once: npm i -g @agentclientprotocol/claude-agent-acp' },
  { id: 'codex', label: 'Codex', provider: 'codex', protocol: 'codex-app-server', command: 'codex', args: ['app-server'],
    note: 'Codex over its own app-server protocol (native sandbox and approvals).' },
  { id: 'gemini', label: 'Gemini CLI', provider: 'gemini', protocol: 'acp', command: 'gemini', args: ['--acp'],
    note: 'Gemini CLI in ACP mode.' },
  { id: 'opencode', label: 'opencode', provider: 'opencode', protocol: 'acp', command: 'opencode', args: ['acp'],
    note: 'opencode in ACP mode.' },
  { id: 'codex-acp', label: 'Codex (ACP)', provider: 'codex', protocol: 'acp', command: 'codex-acp', args: [],
    note: 'Codex through its ACP wrapper, for when the app-server is not wanted.' },
]);

const ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** Validate one operator-written entry. Returns the clean entry, or a reason it was refused. */
export function parseAdapter(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'an adapter is an object' };
  const id = String(raw.id || '').toLowerCase();
  if (!ID.test(id)) return { error: `adapter id "${raw.id}" must be short lowercase letters, digits, - or _` };
  const protocol = String(raw.protocol || 'acp');
  if (!PROTOCOLS.includes(protocol)) return { error: `adapter ${id}: protocol must be one of ${PROTOCOLS.join(', ')}` };
  const command = typeof raw.command === 'string' ? raw.command.trim() : '';
  if (!command || command.length > 1024 || command.includes('\0')) return { error: `adapter ${id}: command is required` };
  // A mistyped "args" must not quietly become "no arguments": for most agents that starts their interactive UI.
  const args = raw.args === undefined ? [] : raw.args;
  if (!Array.isArray(args) || args.length > 64 || args.some((a) => typeof a !== 'string' || a.length > 2048 || a.includes('\0'))) {
    return { error: `adapter ${id}: args must be a short list of strings` };
  }
  const env = {};
  if (raw.env !== undefined) {
    if (!raw.env || typeof raw.env !== 'object' || Array.isArray(raw.env)) return { error: `adapter ${id}: env must be an object` };
    for (const [name, value] of Object.entries(raw.env)) {
      if (!ENV_NAME.test(name) || typeof value !== 'string' || value.length > 4096) return { error: `adapter ${id}: bad env entry ${name}` };
      env[name] = value;
    }
  }
  return { adapter: {
    id, protocol, command, args: args.slice(), env,
    label: String(raw.label || id).slice(0, 40),
    provider: normalizeProvider(raw.provider) || 'custom',
    note: String(raw.note || '').slice(0, 240),
    ...(typeof raw.modeId === 'string' ? { modeId: raw.modeId.slice(0, 200) } : {}),
    ...(raw.acpVersion === 2 ? { acpVersion: 2 } : {}),
    ...(raw.mcp === false ? { mcp: false } : {}),
    ...(raw.preamble === false ? { preamble: false } : {}),
    custom: true,
  } };
}

export function createCatalog(cfg, log) {
  let cache = { key: '', at: 0, list: BUILTIN, errors: [] };
  const found = new Map();           // command → { at, path }

  function load() {
    const now = Date.now();
    if (now - cache.at < 2000) return cache;
    let key = '0';
    try { key = String(fs.statSync(cfg.harnessFile).mtimeMs); } catch { key = '0'; }
    if (key === cache.key) { cache.at = now; return cache; }
    const byId = new Map(BUILTIN.map((a) => [a.id, a]));
    const errors = [];
    if (key !== '0') {
      try {
        const parsed = JSON.parse(fs.readFileSync(cfg.harnessFile, 'utf8'));
        for (const raw of Array.isArray(parsed?.adapters) ? parsed.adapters.slice(0, 64) : []) {
          const { adapter, error } = parseAdapter(raw);
          if (error) { errors.push(error); continue; }
          byId.set(adapter.id, adapter);                // an operator entry may replace a built-in (to pin a path, say)
        }
      } catch (err) {
        errors.push(`could not read ${cfg.harnessFile}: ${err.message}`);
      }
    }
    for (const e of errors) log?.warn?.('[harness] ' + e);
    cache = { key, at: now, list: [...byId.values()], errors };
    return cache;
  }

  // Looking on PATH is all a status check may do: starting an agent to see if it
  // works can launch MCP servers, run hooks or open a login page.
  function locate(command, env) {
    const hit = found.get(command);
    const now = Date.now();
    if (hit && now - hit.at < 20_000) return hit.path;
    const resolved = whichSync(command, env);
    found.set(command, { at: now, path: resolved });
    return resolved;
  }

  const get = (id) => load().list.find((a) => a.id === String(id || '').toLowerCase()) || null;

  function describe(adapter) {
    const resolved = locate(adapter.command, process.env);
    return {
      id: adapter.id, label: adapter.label, provider: adapter.provider, protocol: adapter.protocol,
      available: !!resolved, note: adapter.note || '', custom: !!adapter.custom,
      command: redact(adapter.command, 200),            // shown to whoever may read the office: no home path
      modes: MODES.slice(),
      // What a session on this adapter can honour — declared here, never guessed from the provider's name.
      caps: {
        observe: true, prompt: true, control: true, spawn: !!resolved,
        approvals: true, interrupt: true,
        nativeSandbox: adapter.protocol === 'codex-app-server',
        officeTools: adapter.mcp !== false && cfg.harness.injectMcp,
        resume: false,
      },
    };
  }

  return {
    get,
    locate: (adapter) => locate(adapter.command, process.env),
    list: () => load().list.map(describe),
    errors: () => load().errors.slice(),
  };
}
