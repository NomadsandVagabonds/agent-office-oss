// The Office — harness: the Agent Client Protocol adapter.
//
// ACP is JSON-RPC over an agent's stdio (agentclientprotocol.com). One client
// drives every agent that speaks it — Gemini CLI (`gemini --acp`), opencode
// (`opencode acp`), Claude Code and Codex through their ACP wrappers
// (`claude-agent-acp`, `codex-acp`), and some forty others in the public ACP
// registry. This file is that client: it starts the agent, opens a session,
// sends turns, and turns the agent's `session/update` stream and permission
// requests into the uniform events in normalize.mjs.
//
// We speak the stable generation (protocol version 1, schema v1.21) and
// understand the v2 preview (schema v2.0.0-alpha.3) when an adapter asks for it
// or an agent answers in it. The message shapes, and several of the edge cases
// handled below, were learned from T3 Code's ACP client and session runtime
// (packages/effect-acp, packages/provider-acp; MIT, © 2026 T3 Tools Inc. — see
// NOTICE); the code is written from scratch for plain Node.
//
// What we deliberately do not do: we advertise no filesystem or terminal
// capability, so the agent reads, writes and runs commands itself under its
// own sandbox, and asks us only for permission.
import { RpcError, RPC } from './rpc.mjs';
import { AgentAdapter, START_TIMEOUT_MS } from './adapter.mjs';
import {
  LIMITS, isObject, line, text, tail, toolKind, toolStatus, planStatus, contentText,
  commandOf, pathsOf, toolOutputOf, permissionOptions,
} from './normalize.mjs';

const MAX_TRACKED_TOOLS = 400;
// Agents resend a tool's cumulative output on every update; these two numbers
// (from T3 Code's runtimeModel.ts) decide when a redraw is worth telling anyone about.
const TOOL_MIN_GROWTH_CHARS = 256;
const TOOL_COALESCE_LIMIT = 10;

const stopStatus = (stopReason) => {
  switch (stopReason) {
    case 'cancelled': return { status: 'interrupted' };
    case 'refusal': return { status: 'failed', error: 'the model declined to continue' };
    default: return { status: 'completed' };       // end_turn, max_tokens, max_turn_requests, anything newer
  }
};

export class AcpAdapter extends AgentAdapter {
  /**
   * @param {{command:string, args?:string[], env?:object, cwd:string, clientInfo:object,
   *          mcpServers?:Array<{name:string, command:string, args:string[], env:object}>,
   *          protocol?:1|2, model?:string, modeId?:string,
   *          startTimeoutMs?:number, cancelTimeoutMs?:number, trace?:Function}} opt
   */
  constructor(opt) {
    super(opt, { kind: 'acp', dialect: 'jsonrpc2' });
    this.generation = 0;             // 1 or 2 once the agent has answered `initialize`
    this.sessionId = '';
    this.tools = new Map();          // toolCallId → tracked state
    this.pending = new Map();        // our request id → { resolve, options }
    this.permissionSeq = 0;
    this.modes = [];
    this.models = [];
    this.modeId = '';
    this.model = '';
    this.modelOption = null;         // the session config option that selects the model, if any
    this.modeOption = null;
  }

  /* ---- starting ----------------------------------------------------------- */

  async start() {
    this._spawn();
    return this._handshake(() => this.#open());
  }

  async #open() {
    const timeoutMs = this.opt.startTimeoutMs || START_TIMEOUT_MS;
    const wantV2 = this.opt.protocol === 2;
    const clientInfo = this.opt.clientInfo;
    // No fs, no terminal: the agent does its own I/O and asks us only for permission.
    const clientCapabilities = { fs: { readTextFile: false, writeTextFile: false }, terminal: false };
    const init = await this.peer.request('initialize', wantV2
      // Asking for v2 carries both generations' field names, so a v1-only agent still understands it.
      ? { protocolVersion: 2, info: clientInfo, capabilities: {}, clientCapabilities, clientInfo }
      : { protocolVersion: 1, clientCapabilities, clientInfo }, { timeoutMs });
    if (!isObject(init)) throw new Error('the agent answered initialize with something that is not an object');
    // The version number is not a reliable generation marker (one shipped agent
    // reports 2 with v1-shaped fields); the response shape is.
    this.generation = isObject(init.info) && !('agentInfo' in init) ? 2 : 1;
    const agentInfo = this.generation === 2 ? init.info : init.agentInfo;
    const authMethods = (Array.isArray(init.authMethods) ? init.authMethods : []).filter(isObject).map((m) => ({
      id: String(m.id ?? m.methodId ?? '').slice(0, 120), type: typeof m.type === 'string' ? m.type : 'agent',
    })).filter((m) => m.id);
    const mcpOk = this.generation === 2 ? init.capabilities?.session?.mcp?.stdio != null : true;

    const created = await this.#newSession({ timeoutMs, authMethods, withMcp: mcpOk });
    this.sessionId = created.sessionId;
    this.#readSessionSetup(created);
    if (this.opt.modeId && this.modes.some((m) => m.id === this.opt.modeId) && this.opt.modeId !== this.modeId) {
      await this.setMode(this.opt.modeId).catch((err) => this._notice('warn', `The agent did not switch to mode “${this.opt.modeId}”: ${err.message}`));
    }
    if (this.opt.model && this.opt.model !== this.model) {
      await this.setModel(this.opt.model).catch((err) => this._notice('warn',
        `The agent did not accept the model “${this.opt.model}”; it runs on its default. (${err.message})`));
    }
    return {
      protocol: `acp/${this.generation}`,
      nativeSessionId: this.sessionId,
      agent: { name: line(agentInfo?.title || agentInfo?.name, 80), version: line(agentInfo?.version, 40) },
      model: this.model, models: this.models, modeId: this.modeId, modes: this.modes,
      // What this agent can do, read from what it declared — never assumed from its name.
      features: {
        interrupt: true,
        resume: this.generation === 2 ? init.capabilities?.session != null
          : !!(init.agentCapabilities?.loadSession || init.agentCapabilities?.sessionCapabilities?.resume),
        images: !!(this.generation === 2 ? init.capabilities?.session?.prompt?.image : init.agentCapabilities?.promptCapabilities?.image),
        officeTools: created.withMcp,
        nativeSandbox: false,     // the office's mode only governs how requests are ANSWERED; the agent's own mode decides what it asks
        exactSessionAllow: false, // an ACP agent's "always allow" may be broad and outlive the session: never sent for a session grant
      },
    };
  }

  async #newSession({ timeoutMs, authMethods, withMcp }) {
    const servers = withMcp ? (this.opt.mcpServers || []) : [];
    const params = (list) => ({
      cwd: this.opt.cwd,
      mcpServers: list.map((s) => ({
        ...(this.generation === 2 ? { type: 'stdio' } : {}),
        name: s.name, command: s.command, args: s.args || [],
        env: Object.entries(s.env || {}).map(([name, value]) => ({ name, value: String(value) })),
      })),
    });
    const attempt = async (list) => {
      const res = await this.peer.request('session/new', params(list), { timeoutMs });
      if (!isObject(res) || typeof res.sessionId !== 'string' || !res.sessionId) {
        throw new Error('the agent did not return a session id');
      }
      return { ...res, withMcp: list.length > 0 };
    };
    try {
      return await attempt(servers);
    } catch (err) {
      if (err instanceof RpcError && err.code === RPC.AUTH_REQUIRED) {
        // The office never handles a credential. If the agent can sign itself in
        // (it already has a login on this machine), ask it to; otherwise say so.
        const own = authMethods.find((m) => m.type === 'agent');
        if (!own) {
          throw new Error('the agent says it is not signed in. Run its CLI once in a terminal to log in, then start it here again.');
        }
        await this.peer.request(this.generation === 2 ? 'auth/login' : 'authenticate', { methodId: own.id }, { timeoutMs });
        return attempt(servers);
      }
      if (err instanceof RpcError && servers.length) {
        // An agent that refuses our MCP server should still be able to work.
        const res = await attempt([]);
        this._notice('warn', 'The agent refused the office tools (MCP); it can still work, but cannot reach the office by itself.');
        return res;
      }
      throw err;
    }
  }

  #readSessionSetup(res) {
    if (isObject(res.modes) && Array.isArray(res.modes.availableModes)) {
      this.modes = res.modes.availableModes.filter(isObject).slice(0, 24)
        .map((m) => ({ id: String(m.id || '').slice(0, 200), name: line(m.name, 60) })).filter((m) => m.id);
      this.modeId = typeof res.modes.currentModeId === 'string' ? res.modes.currentModeId.slice(0, 200) : '';
    }
    if (isObject(res.models) && Array.isArray(res.models.availableModels)) {
      this.models = res.models.availableModels.filter(isObject).slice(0, 60)
        .map((m) => ({ id: String(m.modelId || '').slice(0, 200), name: line(m.name, 80) })).filter((m) => m.id);
      this.model = typeof res.models.currentModelId === 'string' ? res.models.currentModelId.slice(0, 200) : '';
    }
    this.#readConfigOptions(res.configOptions);
  }

  // Newer agents describe model and mode as session config options instead.
  #readConfigOptions(options) {
    if (!Array.isArray(options)) return;
    for (const raw of options.slice(0, 40)) {
      if (!isObject(raw) || raw.type !== 'select') continue;
      const id = String(raw.id ?? raw.configId ?? '').slice(0, 200);
      if (!id) continue;
      const flat = (Array.isArray(raw.options) ? raw.options : [])
        .flatMap((o) => (isObject(o) && Array.isArray(o.options) ? o.options : [o])).filter(isObject).slice(0, 60)
        .map((o) => ({ id: String(o.value ?? '').slice(0, 200), name: line(o.name, 80) })).filter((o) => o.id);
      const current = typeof raw.currentValue === 'string' ? raw.currentValue.slice(0, 200) : '';
      if (raw.category === 'model' && (!this.modelOption || this.modelOption === id)) { this.modelOption = id; this.models = flat; this.model = current; }
      if (raw.category === 'mode' && (this.modeOption === id || (!this.modeOption && !this.modes.length))) { this.modeOption = id; this.modes = flat; this.modeId = current; }
    }
  }

  #setOption(configId, value) {
    return this.peer.request('session/set_config_option', { sessionId: this.sessionId, configId, value,
      ...(this.generation === 2 ? { type: 'id' } : {}) }, { timeoutMs: 20_000 });
  }

  async setModel(model) {
    const value = String(model).slice(0, 200);
    if (this.modelOption) await this.#setOption(this.modelOption, value);
    else if (this.models.length) await this.peer.request('session/set_model', { sessionId: this.sessionId, modelId: value }, { timeoutMs: 20_000 });
    else throw new Error('this agent does not offer a model choice');
    this.model = value;
  }

  async setMode(modeId) {
    const value = String(modeId).slice(0, 200);
    if (this.modeOption) await this.#setOption(this.modeOption, value);
    else await this.peer.request('session/set_mode', { sessionId: this.sessionId, modeId: value }, { timeoutMs: 20_000 });
    this.modeId = value;
    this._emit({ type: 'mode', modeId: value });
  }

  /* ---- turns -------------------------------------------------------------- */

  /** Send one turn. Returns once it is on its way; the end arrives as `turn.ended`. */
  prompt(promptText) {
    if (!this.sessionId) throw new Error('the agent is not running');
    const turn = this._beginTurn();
    this.peer.request('session/prompt', {
      sessionId: this.sessionId, prompt: [{ type: 'text', text: String(promptText) }],
    }).then((res) => {
      // v1 answers when the turn is over. v2 answers at once and reports the end
      // as a `state_update` to idle, so there is nothing to do here.
      if (this.generation !== 2) this._endTurn(turn, { ...stopStatus(res?.stopReason), stopReason: line(res?.stopReason, 40) });
    }, (err) => {
      if (!(err instanceof RpcError)) return;      // the connection broke: the exit path reports this turn, with the reason
      // "MUST return cancelled even if cancelling throws" is not something every agent manages.
      if (turn.cancelRequested) this._endTurn(turn, { status: 'interrupted', stopReason: 'cancelled' });
      else this._endTurn(turn, { status: 'failed', error: text(err.message, 600) });
    });
  }

  /** Ask the agent to stop. If it does not confirm in time, its process is ended. */
  cancel() {
    const turn = this.turn;
    if (!turn || turn.cancelRequested) return false;
    turn.cancelRequested = true;
    // The spec has the client answer every open permission request with "cancelled" first.
    this._settlePending('the turn was stopped');
    this.peer.notify('session/cancel', { sessionId: this.sessionId });
    this._armCancelTimer(turn);
    return true;
  }

  _closeOpenWork(result) {
    for (const tool of this.tools.values()) {
      if (tool.status === 'pending' || tool.status === 'running') {
        tool.status = result.status === 'completed' ? 'completed' : 'failed';
        this._emit({ type: 'tool', ...this.#toolEvent(tool) });
      }
    }
  }

  /* ---- permission requests ------------------------------------------------- */

  _settlePending(reason) {
    for (const [requestId, entry] of this.pending) {
      this.pending.delete(requestId);
      entry.resolve({ outcome: { outcome: 'cancelled' } });
      this._emit({ type: 'permission.gone', requestId, reason });
    }
  }

  /** Answer a permission request with one of the options the agent offered, or cancel it. */
  answer(requestId, decision) {
    const entry = this.pending.get(requestId);
    if (!entry) return false;
    if (decision?.cancelled) {
      this.pending.delete(requestId);
      entry.resolve({ outcome: { outcome: 'cancelled' } });
      return true;
    }
    if (!entry.options.some((o) => o.id === decision?.optionId)) return false;   // only ids the agent itself gave us
    this.pending.delete(requestId);
    entry.resolve({ outcome: { outcome: 'selected', optionId: decision.optionId } });
    return true;
  }

  _onRequest(method, params) {
    if (method === 'session/request_permission') return this.#permissionRequest(params);
    // fs/* and terminal/* were never offered; elicitation is not something we can show yet.
    throw new RpcError(RPC.METHOD_NOT_FOUND, `the office does not provide ${method}`);
  }

  #permissionRequest(params) {
    const cancelled = { outcome: { outcome: 'cancelled' } };
    if (!isObject(params) || params.sessionId !== this.sessionId) return cancelled;
    const options = permissionOptions(params.options);
    if (!options.length) return cancelled;
    // v1 names the tool call directly; v2 wraps it in a `subject` (a tool call or a bare command).
    let call = isObject(params.toolCall) ? params.toolCall : null;
    const subject = isObject(params.subject) ? params.subject : null;
    if (!call && subject?.type === 'tool_call' && isObject(subject.toolCall)) call = subject.toolCall;
    if (!call && subject?.type === 'command') {
      call = { toolCallId: subject.toolCallId, kind: 'execute', title: params.title, rawInput: { command: subject.command } };
    }
    call = call || { title: params.title };
    const toolId = typeof call.toolCallId === 'string' ? call.toolCallId.slice(0, 200) : '';
    // A request may name its tool call by id only; what we already know about that call fills the gaps.
    const tracked = toolId ? this.tools.get(toolId) : null;
    const kind = call.kind ? toolKind(call.kind) : (tracked?.kind || 'other');
    const paths = pathsOf(call);
    const requestId = `p${++this.permissionSeq}`;
    const event = {
      type: 'permission', requestId, kind, toolId,
      title: line(call.title || params.title, LIMITS.title) || tracked?.title || 'Use a tool',
      name: line(call.name, 80) || tracked?.name || '',
      detail: text(typeof params.description === 'string' ? params.description : '', 1200),
      command: commandOf(call.rawInput, call.title, kind) || tracked?.command || '',
      paths: paths.length ? paths : (tracked?.paths || []),
      options,
    };
    return new Promise((resolve) => {
      this.pending.set(requestId, { resolve, options });
      this._emit(event);
    });
  }

  /* ---- the update stream --------------------------------------------------- */

  _onNotification(method, params) {
    if (method !== 'session/update' || !isObject(params) || !isObject(params.update)) return;
    // One adapter is one root session. Updates for any other session id (a
    // sub-agent's, say) must never be folded into this one's stream.
    if (params.sessionId !== this.sessionId) return;
    if (isObject(params._meta) && params._meta.isReplay === true) return;
    const u = params.update;
    switch (u.sessionUpdate) {
      case 'agent_message_chunk': {
        if (!this.turn) return;                           // late chunks after a turn has closed are not a new reply
        const chunk = contentText(u.content);
        if (chunk) this._emit({ type: 'message.delta', text: chunk });
        return;
      }
      case 'agent_thought_chunk': {
        if (!this.turn) return;
        const chunk = contentText(u.content);
        if (chunk) this._emit({ type: 'thought.delta', text: chunk });
        return;
      }
      case 'tool_call':
      case 'tool_call_update':
        this.#toolUpdate(u, u.sessionUpdate === 'tool_call');
        return;
      case 'plan':
        this.#plan(u.entries);
        return;
      case 'plan_update':
        if (isObject(u.plan) && u.plan.type === 'items') this.#plan(u.plan.entries);
        else if (isObject(u.plan) && typeof u.plan.content === 'string') {
          this._emit({ type: 'plan', entries: [], note: text(u.plan.content, 4000) });
        }
        return;
      case 'usage_update': {
        const used = Number(u.used), size = Number(u.size);
        this._emit({ type: 'usage', ...(Number.isFinite(used) && used >= 0 ? { used } : {}),
          ...(Number.isFinite(size) && size > 0 ? { size } : {}),
          ...(isObject(u.cost) && Number.isFinite(Number(u.cost.amount))
            ? { cost: { amount: Number(u.cost.amount), currency: line(u.cost.currency, 8) } } : {}) });
        return;
      }
      case 'current_mode_update':
        if (typeof u.currentModeId === 'string') { this.modeId = u.currentModeId.slice(0, 200); this._emit({ type: 'mode', modeId: this.modeId }); }
        return;
      case 'config_option_update':
        this.#readConfigOptions(u.configOptions);
        return;
      case 'session_info_update':
        if (typeof u.title === 'string' && u.title.trim()) this._emit({ type: 'info', title: line(u.title, 120) });
        return;
      case 'notice':
        if (typeof u.title === 'string') this._notice(u.severity === 'error' ? 'error' : 'info', u.description ? `${u.title}: ${u.description}` : u.title);
        return;
      case 'state_update':
        // The v2 way of ending a turn: the prompt request returned long ago.
        if (u.state === 'idle' && this.turn && this.generation === 2) {
          const error = isObject(u.error) && typeof u.error.message === 'string' ? text(u.error.message, 600) : '';
          this._endTurn(this.turn, error ? { status: 'failed', error } : { ...stopStatus(u.stopReason), stopReason: line(u.stopReason, 40) });
        }
        return;
      default:
        return;                                            // newer specs add update kinds; unknown ones are not an error
    }
  }

  #plan(entries) {
    if (!Array.isArray(entries)) return;
    this._emit({ type: 'plan', entries: entries.filter(isObject).slice(0, LIMITS.planEntries)
      .map((e, i) => ({ text: line(e.content, 300) || `Step ${i + 1}`, status: planStatus(e.status) })) });
  }

  #toolEvent(tool) {
    return { id: tool.id, kind: tool.kind, title: tool.title, name: tool.name, status: tool.status,
      command: tool.command, paths: tool.paths, output: tool.output };
  }

  #toolUpdate(u, isNew) {
    const id = typeof u.toolCallId === 'string' ? u.toolCallId.trim().slice(0, 200) : '';
    if (!id) return;
    let tool = this.tools.get(id);
    const first = !tool;
    if (!tool) {
      tool = { id, kind: 'other', title: '', name: '', status: 'pending', command: '', paths: [], output: '',
        emittedLength: 0, skipped: 0 };
      this.tools.set(id, tool);
      if (this.tools.size > MAX_TRACKED_TOOLS) this.tools.delete(this.tools.keys().next().value);
    }
    const before = { status: tool.status, title: tool.title };
    // An absent field means "unchanged". (v1 says the same of null.)
    if (typeof u.kind === 'string') tool.kind = toolKind(u.kind);
    if (typeof u.title === 'string' && u.title.trim()) tool.title = line(u.title, LIMITS.title);
    if (typeof u.name === 'string' && u.name.trim()) tool.name = line(u.name, 80);
    tool.status = toolStatus(u.status, isNew && first ? 'pending' : tool.status);
    const command = commandOf(u.rawInput, u.title, tool.kind);
    if (command) tool.command = command;
    const paths = pathsOf(u);
    if (paths.length) tool.paths = paths;
    let output = toolOutputOf(u.content);
    if (!output && isObject(u.rawOutput)) {
      output = tail(['stdout', 'output', 'content', 'stderr'].map((k) => (typeof u.rawOutput[k] === 'string' ? u.rawOutput[k] : '')).filter(Boolean).join('\n'));
    } else if (!output && typeof u.rawOutput === 'string') output = tail(u.rawOutput);
    if (output) tool.output = output;
    if (!tool.title) tool.title = tool.command || tool.name || tool.kind;

    const terminal = tool.status === 'completed' || tool.status === 'failed';
    const changed = first || before.status !== tool.status || before.title !== tool.title;
    const grew = Math.abs(tool.output.length - tool.emittedLength) >= TOOL_MIN_GROWTH_CHARS;
    if (!terminal && !changed && !grew && tool.skipped + 1 < TOOL_COALESCE_LIMIT) { tool.skipped += 1; return; }
    tool.skipped = 0;
    tool.emittedLength = tool.output.length;
    this._emit({ type: 'tool', ...this.#toolEvent(tool) });
  }
}
