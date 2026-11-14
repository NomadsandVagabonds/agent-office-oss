// The Office — harness: the Codex app-server adapter.
//
// `codex app-server` is Codex's own structured protocol: JSON lines on stdio
// (no "jsonrpc" field), threads and turns with real ids, items that start and
// complete, and approval requests that Codex sends to us as requests and waits
// on. It is richer than ACP — native turn ids, a native sandbox and approval
// policy, an interrupt that is a request — so Codex gets its own adapter
// rather than going through an ACP wrapper.
//
// The method names and shapes used here come from the schema T3 Code generates
// from Codex (packages/effect-codex-app-server/src/_generated; MIT, © 2026 T3
// Tools Inc. — see NOTICE), and the behaviour notes from its CodexAdapterV2.
// Nothing here has been run against a real `codex` binary yet: see
// docs/HARNESS.md for how to check it.
import { RpcError, RPC } from './rpc.mjs';
import { AgentAdapter, START_TIMEOUT_MS } from './adapter.mjs';
import { LIMITS, isObject, line, text, tail, toolStatus, planStatus, limitWindow } from './normalize.mjs';

/**
 * How an office mode maps onto Codex's own policy. Codex enforces these itself
 * (its sandbox is real), which is why they are set natively rather than only
 * answered at our end. Same mapping as T3 Code's runtime modes.
 */
export const CODEX_MODES = Object.freeze({
  ask: { approvalPolicy: 'untrusted', sandbox: 'read-only' },
  edits: { approvalPolicy: 'on-request', sandbox: 'workspace-write' },
  full: { approvalPolicy: 'never', sandbox: 'danger-full-access' },
});

// The three answers Codex understands, offered as options with ids of our own
// so that the rest of the harness treats every provider's requests alike.
const APPROVAL_OPTIONS = Object.freeze([
  { id: 'accept', name: 'Allow', kind: 'allow_once' },
  { id: 'acceptForSession', name: 'Allow for this session', kind: 'allow_always' },
  { id: 'decline', name: 'Reject', kind: 'reject_once' },
]);
// Requests from the older Codex API answer with a different vocabulary.
const LEGACY_DECISION = Object.freeze({
  accept: 'approved', acceptForSession: 'approved_for_session',
  decline: { denied: { rejection: 'The user declined the request.' } }, cancel: 'abort',
});

// Codex names its allowance windows by position (primary, secondary), not by
// what they are; what they mean follows their length. When Codex leaves the
// length out, paid plans are five hours and a week and the free tiers a month.
// This reading is T3 Code's (apps/server/src/provider/codexUsageLimits.ts).
const SESSION_MINS = 5 * 60, WEEK_MINS = 7 * 24 * 60, MONTH_MINS = 30 * 24 * 60;
const LIMIT_LABEL = Object.freeze({ session: 'Session', weekly: 'Weekly', monthly: 'Monthly' });

/** Codex's rate-limit snapshot as the office's allowance windows. Exported for the tests. */
export function codexLimits(snapshot) {
  if (!isObject(snapshot)) return { plan: '', windows: [] };
  const plan = line(typeof snapshot.planType === 'string' ? snapshot.planType : '', 40);
  const monthlyPlan = plan === 'free' || plan === 'go';
  const windows = [];
  for (const [id, fallbackMins] of [['primary', monthlyPlan ? MONTH_MINS : SESSION_MINS], ['secondary', WEEK_MINS]]) {
    const w = snapshot[id];
    if (!isObject(w)) continue;
    const mins = Number.isFinite(w.windowDurationMins) && w.windowDurationMins > 0 ? w.windowDurationMins : fallbackMins;
    const kind = mins >= MONTH_MINS ? 'monthly' : mins >= WEEK_MINS ? 'weekly' : 'session';
    const window = limitWindow({ id, kind, label: LIMIT_LABEL[kind], usedPercent: w.usedPercent, windowMins: mins,
      resetsAt: Number.isFinite(w.resetsAt) ? w.resetsAt * 1000 : undefined });        // Codex counts in seconds
    if (window) windows.push(window);
  }
  // A spend cap is reported as what is left, not as what is used.
  const cap = snapshot.individualLimit;
  if (isObject(cap) && Number.isFinite(cap.remainingPercent)) {
    const window = limitWindow({ id: 'individual', kind: 'credit', label: 'Credit limit', usedPercent: 100 - cap.remainingPercent,
      resetsAt: Number.isFinite(cap.resetsAt) ? cap.resetsAt * 1000 : undefined });
    if (window) windows.push(window);
  }
  return { plan, windows };
}

export class CodexAdapter extends AgentAdapter {
  /**
   * @param {{command:string, args?:string[], env?:object, cwd:string, clientInfo:object,
   *          mcpServers?:Array<{name:string, command:string, args:string[], env:object}>,
   *          model?:string, mode?:'ask'|'edits'|'full', startTimeoutMs?:number, cancelTimeoutMs?:number,
   *          trace?:Function}} opt
   */
  constructor(opt) {
    super(opt, { kind: 'codex-app-server', dialect: 'bare' });
    this.threadId = '';
    this.items = new Map();           // item id → tool state we have reported
    this.pending = new Map();         // our request id → { rpcId, question, respond(choice) }
    this.byRpcId = new Map();         // Codex request id → our request id (for serverRequest/resolved)
    this.requestSeq = 0;
    this.model = '';
    this.rateLimits = null;           // Codex's last allowance snapshot, merged from partial updates
    this.limitsSent = '';             // what we last reported, so a repeat is not news
  }

  async start() {
    this._spawn();
    return this._handshake(() => this.#open());
  }

  async #open() {
    const timeoutMs = this.opt.startTimeoutMs || START_TIMEOUT_MS;
    const init = await this.peer.request('initialize', {
      clientInfo: this.opt.clientInfo,
      // The aggregated diff is large and we derive nothing from it.
      capabilities: { optOutNotificationMethods: ['turn/diff/updated'] },
    }, { timeoutMs });
    this.peer.notify('initialized');
    const policy = CODEX_MODES[this.opt.mode] || CODEX_MODES.ask;
    const config = {};
    // Codex takes MCP servers as config overrides, one dotted key per server
    // (the same door T3 Code uses for its own tools), so nobody edits config.toml.
    for (const s of this.opt.mcpServers || []) {
      config[`mcp_servers.${s.name}`] = { command: s.command, args: s.args || [], env: s.env || {} };
    }
    const threadParams = (withConfig) => ({
      cwd: this.opt.cwd, approvalPolicy: policy.approvalPolicy, sandbox: policy.sandbox,
      ...(this.opt.model ? { model: String(this.opt.model).slice(0, 200) } : {}),
      ...(withConfig && Object.keys(config).length ? { config } : {}),
    });
    let started;
    let officeTools = Object.keys(config).length > 0;
    try {
      started = await this.peer.request('thread/start', threadParams(true), { timeoutMs });
    } catch (err) {
      if (!(err instanceof RpcError) || !officeTools) throw err;
      // A Codex that will not take our MCP entry should still be able to work.
      started = await this.peer.request('thread/start', threadParams(false), { timeoutMs });
      officeTools = false;
      this._notice('warn', 'Codex refused the office tools (MCP); it can still work, but cannot reach the office by itself.');
    }
    if (!isObject(started) || !isObject(started.thread) || typeof started.thread.id !== 'string' || !started.thread.id) {
      throw new Error('Codex did not return a thread id');
    }
    this.threadId = started.thread.id.slice(0, 200);
    this.model = line(started.model || started.thread.model || this.opt.model || '', 80);
    this.#readLimits();
    return {
      protocol: 'codex-app-server',
      nativeSessionId: this.threadId,
      agent: { name: 'Codex', version: line(String(init?.userAgent || '').split(' ')[0].split('/')[1] || '', 40) },
      model: this.model, models: [], modeId: '', modes: [],
      features: { interrupt: true, resume: true, images: true, officeTools, nativeSandbox: true },
    };
  }

  /* ---- the operator's allowance -------------------------------------------- */

  // Asked once, when the session starts, and never waited for: a Codex that is
  // too old to know the method, or signed in with an API key, simply has no
  // answer. After that Codex tells us itself (account/rateLimits/updated).
  #readLimits() {
    const before = this.rateLimits;
    this.peer.request('account/rateLimits/read', null, { timeoutMs: 10_000 }).then((res) => {
      if (!isObject(res)) return;
      const byId = isObject(res.rateLimitsByLimitId) ? res.rateLimitsByLimitId.codex : null;
      // An update that arrived while we were asking is newer than this answer.
      if (this.rateLimits === before) this.#limits(isObject(byId) ? byId : res.rateLimits);
    }, () => {});
  }

  #limits(update) {
    if (!isObject(update)) return;
    // A snapshot for one model's own limit must not overwrite the main allowance.
    if (typeof update.limitId === 'string' && update.limitId && update.limitId !== 'codex') return;
    // Updates are partial: a field Codex leaves out keeps its earlier value.
    const merged = { ...(this.rateLimits || {}) };
    for (const key of ['planType', 'primary', 'secondary', 'individualLimit']) {
      if (update[key] !== undefined) merged[key] = update[key];
    }
    this.rateLimits = merged;
    const limits = codexLimits(merged);
    if (!limits.windows.length) return;
    const key = JSON.stringify(limits);
    if (key === this.limitsSent) return;
    this.limitsSent = key;
    this._emit({ type: 'limits', ...(limits.plan ? { plan: limits.plan } : {}), windows: limits.windows });
  }

  /* ---- turns -------------------------------------------------------------- */

  prompt(promptText) {
    if (!this.threadId) throw new Error('Codex is not running');
    const turn = this._beginTurn({ id: '', streamed: new Set() });
    this.peer.request('turn/start', {
      threadId: this.threadId, input: [{ type: 'text', text: String(promptText) }],
    }).then((res) => {
      if (isObject(res?.turn) && typeof res.turn.id === 'string') turn.id = turn.id || res.turn.id;
      // A stop pressed before Codex had registered the turn would otherwise be lost.
      if (turn.cancelRequested && this.turn === turn) this.#sendInterrupt(turn);
    }, (err) => {
      if (err instanceof RpcError) this._endTurn(turn, { status: 'failed', error: text(err.message, 600) });
    });
  }

  #sendInterrupt(turn) {
    if (!turn.id || turn.interruptSent) return;
    turn.interruptSent = true;
    // The reply only acknowledges the request; the turn's real end still arrives as turn/completed.
    this.peer.request('turn/interrupt', { threadId: this.threadId, turnId: turn.id }, { timeoutMs: 10_000 }).catch(() => {});
  }

  cancel() {
    const turn = this.turn;
    if (!turn || turn.cancelRequested) return false;
    turn.cancelRequested = true;
    this.#sendInterrupt(turn);
    this._armCancelTimer(turn, 'Codex');
    return true;
  }

  _closeOpenWork(result) {
    for (const tool of this.items.values()) {
      if (tool.status === 'pending' || tool.status === 'running') {
        tool.status = result.status === 'completed' ? 'completed' : 'failed';
        this._emit({ type: 'tool', ...tool });
      }
    }
  }

  /* ---- approvals and questions --------------------------------------------- */

  _settlePending(reason) {
    for (const [requestId, entry] of this.pending) {
      this.pending.delete(requestId);
      this.byRpcId.delete(String(entry.rpcId));
      entry.respond(entry.question ? null : 'cancel');
      this._emit({ type: 'permission.gone', requestId, reason });
    }
  }

  /** `{optionId}` for an approval, `{answers:{questionId:text}}` for a question, `{cancelled:true}` for either. */
  answer(requestId, decision) {
    const entry = this.pending.get(requestId);
    if (!entry) return false;
    let choice;
    if (entry.question) choice = decision?.cancelled ? null : (isObject(decision?.answers) ? decision.answers : null);
    else if (decision?.cancelled) choice = 'cancel';
    else if (APPROVAL_OPTIONS.some((o) => o.id === decision?.optionId)) choice = decision.optionId;
    else return false;
    this.pending.delete(requestId);
    this.byRpcId.delete(String(entry.rpcId));
    entry.respond(choice);
    return true;
  }

  #ask(rpcId, event, makeResponse) {
    const requestId = `p${++this.requestSeq}`;
    return new Promise((resolve) => {
      this.pending.set(requestId, { rpcId, question: event.type === 'question', respond: (choice) => resolve(makeResponse(choice)) });
      this.byRpcId.set(String(rpcId), requestId);
      this._emit({ ...event, requestId });
    });
  }

  _onRequest(method, params, { id }) {
    if (!isObject(params)) throw new RpcError(RPC.INVALID_PARAMS, 'params must be an object');
    const tracked = typeof params.itemId === 'string' ? this.items.get(params.itemId) : null;
    const reason = text(typeof params.reason === 'string' ? params.reason : '', 1200);
    const approval = (fields) => ({ type: 'permission', options: APPROVAL_OPTIONS, command: '', paths: [], detail: reason, ...fields });
    switch (method) {
      case 'item/commandExecution/requestApproval':
        return this.#ask(id, approval({
          kind: 'execute', toolId: line(params.itemId, 200), title: 'Run a command', name: 'shell',
          command: line(typeof params.command === 'string' ? params.command : tracked?.command || '', LIMITS.command),
          detail: [reason, typeof params.cwd === 'string' ? `in ${text(params.cwd, 300)}` : ''].filter(Boolean).join(' — '),
        }), (choice) => ({ decision: choice }));
      case 'item/fileChange/requestApproval':
        return this.#ask(id, approval({
          kind: 'edit', toolId: line(params.itemId, 200), title: 'Change files', name: 'apply_patch',
          paths: tracked?.paths?.length ? tracked.paths : (typeof params.grantRoot === 'string' ? [params.grantRoot.slice(0, 1024)] : []),
        }), (choice) => ({ decision: choice }));
      case 'item/permissions/requestApproval':
        return this.#ask(id, approval({
          kind: 'other', toolId: line(params.itemId, 200), title: 'Grant extra permissions', name: 'permissions',
        }), (choice) => (choice === 'accept' || choice === 'acceptForSession'
          ? { permissions: params.permissions, scope: choice === 'acceptForSession' ? 'session' : 'turn' }
          : { permissions: {}, scope: 'turn' }));
      case 'execCommandApproval':
        return this.#ask(id, approval({
          kind: 'execute', toolId: line(params.callId, 200), title: 'Run a command', name: 'shell',
          command: line(Array.isArray(params.command) ? params.command.filter((p) => typeof p === 'string').join(' ') : '', LIMITS.command),
        }), (choice) => ({ decision: LEGACY_DECISION[choice] ?? 'abort' }));
      case 'applyPatchApproval':
        return this.#ask(id, approval({
          kind: 'edit', toolId: line(params.callId, 200), title: 'Change files', name: 'apply_patch',
          paths: isObject(params.fileChanges) ? Object.keys(params.fileChanges).slice(0, LIMITS.paths).map((p) => p.slice(0, 1024)) : [],
        }), (choice) => ({ decision: LEGACY_DECISION[choice] ?? 'abort' }));
      case 'item/tool/requestUserInput': {
        const questions = (Array.isArray(params.questions) ? params.questions : []).filter(isObject).slice(0, 8).map((q) => ({
          id: String(q.id || '').slice(0, 120), header: line(q.header, 80), text: text(q.question, 1200),
          options: (Array.isArray(q.options) ? q.options : []).filter(isObject).slice(0, 8).map((o) => line(o.label, 120)).filter(Boolean),
        })).filter((q) => q.id);
        if (!questions.length) return { answers: {} };
        return this.#ask(id, { type: 'question', questions }, (answers) => ({
          answers: Object.fromEntries(questions.map((q) => [q.id, { answers: answers && typeof answers[q.id] === 'string' ? [answers[q.id]] : [] }])),
        }));
      }
      default:
        // Token refresh, dynamic tools, MCP elicitation: the office holds no credentials and offers none of these.
        throw new RpcError(RPC.METHOD_NOT_FOUND, `the office does not provide ${method}`);
    }
  }

  /* ---- the notification stream --------------------------------------------- */

  _onNotification(method, params) {
    if (!isObject(params)) return;
    // One adapter is one thread; a sub-agent's thread reports under its own id and is not ours to flatten.
    if (typeof params.threadId === 'string' && params.threadId !== this.threadId) return;
    switch (method) {
      case 'turn/started':
        if (this.turn && isObject(params.turn) && typeof params.turn.id === 'string') {
          this.turn.id = this.turn.id || params.turn.id;
          if (this.turn.cancelRequested) this.#sendInterrupt(this.turn);
        }
        return;
      case 'turn/completed': {
        const turn = this.turn;
        if (!turn || !isObject(params.turn)) return;
        if (turn.id && typeof params.turn.id === 'string' && params.turn.id !== turn.id) return;   // someone else's turn
        const status = params.turn.status;
        if (status === 'inProgress') return;
        const error = isObject(params.turn.error) && typeof params.turn.error.message === 'string' ? text(params.turn.error.message, 600) : '';
        this._endTurn(turn, status === 'completed' ? { status: 'completed' }
          : status === 'interrupted' ? { status: 'interrupted', stopReason: 'cancelled' }
            : { status: 'failed', error: error || 'Codex reported that the turn failed' });
        return;
      }
      case 'item/agentMessage/delta':
        if (this.turn && typeof params.delta === 'string' && params.delta) {
          if (typeof params.itemId === 'string') this.turn.streamed.add(params.itemId);
          this._emit({ type: 'message.delta', text: params.delta.slice(0, LIMITS.delta) });
        }
        return;
      case 'item/reasoning/summaryTextDelta':
      case 'item/reasoning/textDelta':
        if (this.turn && typeof params.delta === 'string' && params.delta) this._emit({ type: 'thought.delta', text: params.delta.slice(0, LIMITS.delta) });
        return;
      case 'item/started':
      case 'item/completed':
        if (isObject(params.item)) this.#item(params.item, method === 'item/completed');
        return;
      case 'item/commandExecution/outputDelta': {
        const tool = typeof params.itemId === 'string' ? this.items.get(params.itemId) : null;
        if (tool && typeof params.delta === 'string') tool.output = tail(tool.output + params.delta);
        return;                                           // reported with the item's completion, not chunk by chunk
      }
      case 'turn/plan/updated':
        if (Array.isArray(params.plan)) {
          this._emit({ type: 'plan', note: text(typeof params.explanation === 'string' ? params.explanation : '', 600),
            entries: params.plan.filter(isObject).slice(0, LIMITS.planEntries)
              .map((s, i) => ({ text: line(s.step, 300) || `Step ${i + 1}`, status: planStatus(s.status) })) });
        }
        return;
      case 'thread/tokenUsage/updated': {
        const usage = params.tokenUsage;
        if (!isObject(usage) || !isObject(usage.last)) return;
        const used = Number(usage.last.totalTokens), size = Number(usage.modelContextWindow);
        this._emit({ type: 'usage', ...(Number.isFinite(used) && used >= 0 ? { used } : {}), ...(Number.isFinite(size) && size > 0 ? { size } : {}) });
        return;
      }
      case 'account/rateLimits/updated':
        this.#limits(params.rateLimits);
        return;
      case 'serverRequest/resolved': {
        // Codex settles its own requests when their turn ends; nobody is waiting for our answer any more.
        const requestId = this.byRpcId.get(String(params.requestId));
        const entry = requestId && this.pending.get(requestId);
        if (!entry) return;
        this.pending.delete(requestId);
        this.byRpcId.delete(String(params.requestId));
        entry.respond(entry.question ? null : 'cancel');
        this._emit({ type: 'permission.gone', requestId, reason: 'Codex stopped waiting' });
        return;
      }
      case 'error':
        if (isObject(params.error) && typeof params.error.message === 'string') {
          this._notice(params.willRetry ? 'warn' : 'error', params.willRetry ? `${params.error.message} (Codex is retrying)` : params.error.message);
        }
        return;
      case 'warning':
      case 'configWarning':
        if (typeof params.message === 'string') this._notice('warn', params.message);
        return;
      default:
        return;
    }
  }

  // Codex reports work as items. The ones that are tools become `tool` events;
  // a finished agent message that was never streamed becomes the reply itself.
  #item(item, completed) {
    const id = typeof item.id === 'string' ? item.id.slice(0, 200) : '';
    if (!id) return;
    let tool = null;
    switch (item.type) {
      case 'commandExecution':
        tool = { kind: 'execute', name: 'shell', title: line(item.command, LIMITS.title) || 'Run a command',
          command: line(item.command, LIMITS.command), paths: [],
          output: typeof item.aggregatedOutput === 'string' ? tail(item.aggregatedOutput) : (this.items.get(id)?.output || ''),
          ...(Number.isFinite(item.exitCode) ? { exitCode: item.exitCode } : {}) };
        break;
      case 'fileChange': {
        const paths = (Array.isArray(item.changes) ? item.changes : []).filter(isObject)
          .map((c) => (typeof c.path === 'string' ? c.path.slice(0, 1024) : '')).filter(Boolean).slice(0, LIMITS.paths);
        tool = { kind: 'edit', name: 'apply_patch', title: paths.length ? `Edit ${paths.length === 1 ? paths[0] : `${paths.length} files`}` : 'Edit files',
          command: '', paths, output: '' };
        break;
      }
      case 'mcpToolCall':
        tool = { kind: 'other', name: line(`${item.server || 'mcp'}.${item.tool || 'tool'}`, 80),
          title: line(`${item.server || 'mcp'}: ${item.tool || 'tool'}`, LIMITS.title), command: '', paths: [], output: '' };
        break;
      case 'dynamicToolCall':
        tool = { kind: 'other', name: line(item.tool, 80), title: line(item.tool, LIMITS.title) || 'Tool', command: '', paths: [], output: '' };
        break;
      case 'webSearch':
        tool = { kind: 'fetch', name: 'web_search', title: line(`Search: ${item.query || ''}`, LIMITS.title), command: '', paths: [], output: '' };
        break;
      case 'agentMessage':
        if (completed && this.turn && !this.turn.streamed.has(id) && typeof item.text === 'string' && item.text) {
          this._emit({ type: 'message.delta', text: item.text.slice(0, LIMITS.delta) });
        }
        if (completed) this._emit({ type: 'message.break' });       // the next agent message is a new item
        return;
      case 'plan':
        if (completed && typeof item.text === 'string') this._emit({ type: 'plan', entries: [], note: text(item.text, 4000) });
        return;
      default:
        return;                                            // reasoning, user echoes, review markers: nothing to show as work
    }
    const fallback = completed ? 'completed' : 'running';
    const status = typeof item.status === 'string' ? toolStatus(item.status, fallback) : fallback;
    const state = { id, ...tool, status: completed && status === 'running' ? 'completed' : status };
    this.items.set(id, state);
    if (this.items.size > 400) this.items.delete(this.items.keys().next().value);
    this._emit({ type: 'tool', ...state });
  }
}
