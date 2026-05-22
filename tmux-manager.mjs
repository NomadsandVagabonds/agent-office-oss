import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function safeExec(args, opt = {}) {
  return cp.execFileSync(args[0], args.slice(1), {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opt,
  });
}

function sessionSlug(name) {
  return `office-${(''+name).toLowerCase().replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'').slice(0,40)||'agent'}`;
}

function resolveSpawnCwd(input) {
  const fallback = process.cwd();
  if (!input) return fallback;
  try {
    let cur = path.resolve(input);
    while (true) {
      if (fs.existsSync(cur) && fs.statSync(cur).isDirectory()) return cur;
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  } catch {}
  return fallback;
}

function normalizeManagedMeta(meta) {
  if (!meta || !meta.id) return null;
  return {
    id: meta.id,
    name: meta.name || meta.id.replace(/^office-/, ''),
    cwd: meta.cwd || '',
    requestedCwd: meta.requestedCwd || null,
    createdAt: Number(meta.createdAt) || null,
    task: meta.task || '',
    provider: meta.provider || 'unknown',
    alive: !!meta.alive,
    observedOnly: !!meta.observedOnly,
  };
}

export class TmuxManager {
  constructor(port, storePath) {
    this.port = port;
    this.storePath = storePath || path.join(process.cwd(), 'data', 'tmux-sessions.json');
    this.managed = this.loadManaged();
  }

  loadManaged() {
    try {
      if (!fs.existsSync(this.storePath)) return new Map();
      const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      const list = Array.isArray(raw) ? raw : raw?.sessions;
      if (!Array.isArray(list)) return new Map();
      return new Map(list.map((meta) => {
        const normalized = normalizeManagedMeta(meta);
        return normalized ? [normalized.id, normalized] : null;
      }).filter(Boolean));
    } catch {
      return new Map();
    }
  }

  saveManaged() {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, JSON.stringify(
      [...this.managed.values()].map((meta) => normalizeManagedMeta(meta)).filter(Boolean),
      null,
      2,
    ));
  }

  static isAvailable() {
    try { safeExec(['tmux', '-V']); return true; }
    catch { return false; }
  }

  static isClaudeAvailable() {
    try { safeExec(['claude', '--version']); return true; }
    catch { return false; }
  }

  static isCodexAvailable() {
    try { safeExec(['codex', '--version']); return true; }
    catch { return false; }
  }

  static runtimeStatus() {
    return {
      tmuxAvailable: TmuxManager.isAvailable(),
      claudeAvailable: TmuxManager.isClaudeAvailable(),
      codexAvailable: TmuxManager.isCodexAvailable(),
      shellAvailable: true,
    };
  }

  listSessions() {
    if (!TmuxManager.isAvailable()) return [];
    try {
      const out = safeExec(['tmux', 'list-sessions', '-F', '#{session_name}']);
      return out.trim().split('\n').filter(Boolean);
    } catch { return []; }
  }

  listManaged() {
    const live = new Set(this.listSessions());
    let changed = false;
    for (const [id] of this.managed) {
      if (!live.has(id)) {
        this.managed.delete(id);
        changed = true;
      }
    }
    if (changed) this.saveManaged();
    return [...this.managed.values()].map((s) => ({
      ...s,
      alive: live.has(s.id),
    }));
  }

  get(id) {
    const live = new Set(this.listSessions());
    const meta = this.managed.get(id);
    if (meta) return { ...meta, alive: live.has(id) };
    if (!live.has(id)) return null;
    return {
      id,
      name: id.replace(/^office-/, ''),
      cwd: '',
      createdAt: null,
      task: '',
      provider: 'unknown',
      alive: true,
      observedOnly: true,
    };
  }

  spawnAgent(opts) {
    if (!TmuxManager.isAvailable()) throw new Error('tmux is not available');
    const requestedCwd = opts.cwd || process.cwd();
    const cwd = resolveSpawnCwd(requestedCwd);
    const name = opts.name || `agent-${Date.now().toString(36)}`;
    const id = sessionSlug(name);
    const provider = opts.provider || 'claude';
    const cmd = this.buildCommand({
      runtimeSessionId: id,
      provider,
      task: opts.task || '',
      systemPrompt: opts.systemPrompt || '',
      command: opts.command || '',
      args: Array.isArray(opts.args) ? opts.args : [],
      claudeArgs: Array.isArray(opts.claudeArgs) ? opts.claudeArgs : [],
      codexArgs: Array.isArray(opts.codexArgs) ? opts.codexArgs : [],
      env: opts.env || {},
    });
    try { safeExec(['tmux', 'kill-session', '-t', id]); } catch {}
    safeExec(['tmux', 'new-session', '-d', '-s', id, '-c', cwd, ...cmd]);
    const meta = {
      id,
      name,
      cwd,
      requestedCwd: requestedCwd !== cwd ? requestedCwd : null,
      createdAt: Date.now(),
      task: opts.task || '',
      provider,
      alive: true,
      observedOnly: false,
    };
    this.managed.set(id, meta);
    this.saveManaged();
    return meta;
  }

  kill(id) {
    try { safeExec(['tmux', 'kill-session', '-t', id]); } catch {}
    this.managed.delete(id);
    this.saveManaged();
  }

  capture(id, lines = 220) {
    if (!TmuxManager.isAvailable()) throw new Error('tmux is not available');
    const start = String(-Math.max(20, Math.min(4000, Number(lines) || 220)));
    return safeExec(['tmux', 'capture-pane', '-pt', id, '-S', start]).replace(/\s+$/,'');
  }

  sendInput(id, text, opt = {}) {
    if (!TmuxManager.isAvailable()) throw new Error('tmux is not available');
    const normalized = (''+(text||'')).replace(/\r/g,'');
    const parts = normalized.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) safeExec(['tmux', 'send-keys', '-t', id, '-l', parts[i]]);
      if (i < parts.length - 1 || opt.enter) safeExec(['tmux', 'send-keys', '-t', id, 'Enter']);
    }
  }

  findUniqueSessionByCwd(cwd) {
    if (!cwd) return null;
    const matches = this.listManaged().filter((s) => s.cwd === cwd && s.alive);
    return matches.length === 1 ? matches[0] : null;
  }

  buildCommand(opts) {
    const envPairs = {
      OFFICE_PORT: String(this.port),
      OFFICE_RUNTIME_SESSION_ID: opts.runtimeSessionId || '',
      OFFICE_RUNTIME_PROVIDER: opts.provider || '',
      ...(opts.env || {}),
    };
    const envCmd = ['env', ...Object.entries(envPairs).map(([k, v]) => `${k}=${v}`)];
    if (opts.command) return [...envCmd, opts.command, ...(opts.args || [])];
    if (opts.provider === 'shell') {
      return [...envCmd, process.env.SHELL || '/bin/zsh', '-l'];
    }
    if (opts.provider === 'codex') {
      if (!TmuxManager.isCodexAvailable()) throw new Error('codex CLI is not available');
      const cmd = [...envCmd, 'codex', ...(opts.codexArgs || [])];
      if (opts.task) cmd.push(opts.task);
      return cmd;
    }
    if (opts.provider === 'claude') {
      if (!TmuxManager.isClaudeAvailable()) throw new Error('claude CLI is not available');
      const cmd = [...envCmd, 'claude', ...(opts.claudeArgs || [])];
      if (opts.systemPrompt) cmd.push('--system-prompt', opts.systemPrompt);
      if (opts.task) cmd.push(opts.task);
      return cmd;
    }
    throw new Error(`Unsupported provider: ${opts.provider}`);
  }
}
