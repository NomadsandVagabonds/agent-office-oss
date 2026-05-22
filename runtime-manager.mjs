import { TmuxManager } from './tmux-manager.mjs';

const RUNTIMES = Object.freeze([
  {
    id: 'claude-code',
    provider: 'claude',
    label: 'Claude Code',
    shortLabel: 'Claude',
    lane: 'primary',
    kind: 'terminal',
    transport: 'tmux',
    firstParty: true,
    experimental: false,
    utility: false,
    launchable: true,
    note: 'Primary first-party Claude Code runtime for daily agent work.',
  },
  {
    id: 'codex',
    provider: 'codex',
    label: 'Codex',
    shortLabel: 'Codex',
    lane: 'primary',
    kind: 'terminal',
    transport: 'tmux',
    firstParty: true,
    experimental: false,
    utility: false,
    launchable: true,
    note: 'Primary first-party Codex runtime for collaborative coding work.',
  },
  {
    id: 'shell',
    provider: 'shell',
    label: 'Shell',
    shortLabel: 'Shell',
    lane: 'utility',
    kind: 'terminal',
    transport: 'tmux',
    firstParty: false,
    experimental: false,
    utility: true,
    launchable: true,
    note: 'Utility terminal for practical work without an agent wrapper.',
  },
  {
    id: 'openrouter',
    provider: 'openrouter',
    label: 'OpenRouter Lab',
    shortLabel: 'OpenRouter',
    lane: 'experimental',
    kind: 'api',
    transport: 'bridge',
    firstParty: false,
    experimental: true,
    utility: false,
    launchable: false,
    note: 'Experimental OSS-model lane via OpenRouter. Scaffold only for now; no first-party terminal runtime yet.',
  },
  {
    id: 'observed',
    provider: 'unknown',
    label: 'Observed Terminal',
    shortLabel: 'Observed',
    lane: 'observed',
    kind: 'terminal',
    transport: 'tmux',
    firstParty: false,
    experimental: false,
    utility: false,
    launchable: false,
    note: 'Live tmux session discovered by the Office but not launched through the managed runtime registry.',
  },
]);

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function runtimeById(id) {
  return RUNTIMES.find((item) => item.id === id) || null;
}

function runtimeByProvider(provider) {
  return RUNTIMES.find((item) => item.provider === provider) || null;
}

function resolveRuntimeKey(value, fallbackId = 'claude-code') {
  return runtimeById(value) || runtimeByProvider(value) || runtimeById(fallbackId);
}

function availabilityFor(runtime, status) {
  if (runtime.provider === 'claude') {
    return {
      available: status.tmuxAvailable && status.claudeAvailable,
      launchable: status.tmuxAvailable && status.claudeAvailable,
    };
  }
  if (runtime.provider === 'codex') {
    return {
      available: status.tmuxAvailable && status.codexAvailable,
      launchable: status.tmuxAvailable && status.codexAvailable,
    };
  }
  if (runtime.provider === 'shell') {
    return {
      available: status.tmuxAvailable && status.shellAvailable !== false,
      launchable: status.tmuxAvailable && status.shellAvailable !== false,
    };
  }
  return {
    available: false,
    launchable: false,
  };
}

function enrichRuntime(runtime, status) {
  return {
    ...clone(runtime),
    ...availabilityFor(runtime, status),
  };
}

function sessionFromTerminal(meta, runtime) {
  return {
    id: meta.id,
    name: meta.name,
    cwd: meta.cwd,
    requestedCwd: meta.requestedCwd || null,
    createdAt: meta.createdAt,
    task: meta.task || '',
    provider: meta.provider,
    alive: !!meta.alive,
    observedOnly: !!meta.observedOnly,
    runtimeId: runtime.id,
    runtimeLabel: runtime.label,
    lane: runtime.lane,
    kind: runtime.kind,
    transport: runtime.transport,
    firstParty: runtime.firstParty,
    experimental: runtime.experimental,
    utility: runtime.utility,
  };
}

export class RuntimeManager {
  constructor(port) {
    this.tmux = new TmuxManager(port);
    this.sessions = new Map();
  }

  static catalog() {
    return RUNTIMES.map((item) => clone(item));
  }

  resolveRuntime(value, fallbackId) {
    return enrichRuntime(resolveRuntimeKey(value, fallbackId), TmuxManager.runtimeStatus());
  }

  listRuntimes() {
    const status = TmuxManager.runtimeStatus();
    return RUNTIMES.filter((item) => item.id !== 'observed')
      .map((item) => enrichRuntime(item, status));
  }

  listLiveTerminals() {
    return this.tmux.listSessions();
  }

  reconcile() {
    const live = this.tmux.listManaged();
    const liveIds = new Set(this.tmux.listSessions());
    for (const meta of live) {
      const runtime = this.resolveRuntime(meta.runtimeId || meta.provider);
      this.sessions.set(meta.id, sessionFromTerminal(meta, runtime));
    }
    for (const [id, session] of this.sessions) {
      if (session.kind !== 'terminal') continue;
      if (!liveIds.has(id) && session.observedOnly) {
        this.sessions.delete(id);
        continue;
      }
      this.sessions.set(id, { ...session, alive: liveIds.has(id) });
    }
  }

  listSessions() {
    this.reconcile();
    return [...this.sessions.values()]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map((item) => ({ ...item }));
  }

  getSession(id) {
    this.reconcile();
    if (this.sessions.has(id)) return { ...this.sessions.get(id) };
    const meta = this.tmux.get(id);
    if (!meta) return null;
    const runtime = this.resolveRuntime(meta.runtimeId || meta.provider, 'observed');
    const session = sessionFromTerminal(meta, runtime);
    this.sessions.set(id, session);
    return { ...session };
  }

  runtimeStatus() {
    const base = TmuxManager.runtimeStatus();
    return {
      ...base,
      runtimes: this.listRuntimes(),
      sessions: this.listSessions(),
    };
  }

  spawnSession(opts = {}) {
    const runtime = this.resolveRuntime(opts.runtimeId || opts.provider || 'claude-code');
    if (!runtime.launchable) throw new Error(runtime.note);
    const meta = this.tmux.spawnAgent({
      name: opts.name,
      cwd: opts.cwd || process.cwd(),
      task: opts.task || '',
      provider: runtime.provider,
      systemPrompt: opts.systemPrompt || '',
      command: opts.command || '',
      args: Array.isArray(opts.args) ? opts.args : [],
      claudeArgs: Array.isArray(opts.claudeArgs) ? opts.claudeArgs : [],
      codexArgs: Array.isArray(opts.codexArgs) ? opts.codexArgs : [],
      env: opts.env || {},
    });
    const session = sessionFromTerminal(meta, runtime);
    this.sessions.set(session.id, session);
    return { ...session };
  }

  kill(id) {
    this.tmux.kill(id);
    this.sessions.delete(id);
  }

  capture(id, lines) {
    return this.tmux.capture(id, lines);
  }

  sendInput(id, text, opt) {
    return this.tmux.sendInput(id, text, opt);
  }

  findUniqueSessionByCwd(cwd) {
    if (!cwd) return null;
    const matches = this.listSessions()
      .filter((item) => item.kind === 'terminal' && item.alive
        && (item.cwd === cwd || item.requestedCwd === cwd));
    return matches.length === 1 ? matches[0] : null;
  }
}
