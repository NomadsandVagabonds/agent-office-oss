// The Office — harness: the Claude Code adapter.
//
// Claude Code has a structured mode of its own. Started as
//
//   claude --print --input-format stream-json --output-format stream-json …
//
// it reads one JSON object per line on stdin and writes one per line on stdout:
// the stream its own Agent SDK is built on. So Claude needs no ACP wrapper to be
// driven. It is newline-delimited JSON but it is not JSON-RPC. Every frame has
// a `type`; a request is { type: "control_request", request_id, request: {
// subtype, … } } and its one answer a "control_response". Claude asks us things
// on the same stream — may I use this tool? — and waits for the answer.
//
// Where the shapes come from, since none of this has met a real turn: the type
// definitions Anthropic publishes with @anthropic-ai/claude-agent-sdk 0.3.321
// (sdk.d.ts, sdk-tools.d.ts: read as text, never installed, nothing of it is
// here), the CLI's own `--help` (2.1.325), and T3 Code's Claude adapter with the
// frames it recorded from real runs (apps/server/src/orchestration-v2/Adapters/
// ClaudeAdapterV2.ts and testkit/fixtures; MIT, © 2026 T3 Tools Inc. — see
// NOTICE). Three things below follow T3's logic closely and say so where they
// are: how an office mode becomes a Claude permission mode, handing the MCP
// server over the pipe rather than the command line, and the reading of the
// usage and allowance frames. docs/HARNESS.md §7.5 names every message with
// where it was checked, and what a first real run still has to confirm.
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { StringDecoder } from 'node:string_decoder';
import { RpcError, RpcClosedError, RPC } from './rpc.mjs';
import { AgentAdapter, START_TIMEOUT_MS } from './adapter.mjs';
import { spawnAgent, redact } from './child.mjs';
import { LIMITS, isObject, line, text, tail, contentText, commandOf, pathsOf, limitWindow } from './normalize.mjs';
import { claudeStatusLineToReport } from '../usage-sources.mjs';

/**
 * How an office mode becomes Claude's own permission mode: the mapping T3 Code uses for its runtime modes
 * (permissionModeForClaudeRuntimePolicy). Claude decides by its mode what it asks about at all; whatever it
 * still asks, the office answers by the same office mode.
 */
export const CLAUDE_MODES = Object.freeze({ ask: 'default', edits: 'acceptEdits', full: 'bypassPermissions' });

// Claude's own modes, by the ids it uses on the wire and the names it gives them itself, each with how far it
// lets Claude go without asking anyone (0 nothing, 1 file edits, 2 everything). The order is Claude's own.
// A session's mode is the ceiling: Claude is never put, and never left, in a mode that goes further.
const OWN_MODES = Object.freeze([
  { id: 'default', name: 'Manual', reach: 0 },
  { id: 'plan', name: 'Plan', reach: 0 },
  { id: 'dontAsk', name: 'Don’t ask', reach: 0 },
  { id: 'acceptEdits', name: 'Accept edits', reach: 1 },
  // Known, so that a Claude found in it is placed, but not offered. What its classifier hands on to a person
  // would be answered by a session in full mode without anybody seeing it, which makes it the bypass mode by
  // another name. It is worth offering once a request can be marked as one a person must see (HARNESS.md §7.5).
  { id: 'auto', name: 'Auto', reach: 2, offered: false },
  { id: 'bypassPermissions', name: 'Bypass permissions', reach: 2 },
]);
const OFFERED = Object.freeze(OWN_MODES.filter((m) => m.offered !== false));
const REACH = Object.freeze({ ask: 0, edits: 1, full: 2 });
// A mode this file has never heard of is taken to go further than anything, so that it is never left standing.
const reachOf = (modeId) => OWN_MODES.find((m) => m.id === modeId)?.reach ?? 3;

// What makes the CLI speak this protocol at all. --permission-prompt-tool stdio is what sends its permission
// questions to us as control requests instead of to a terminal that is not there.
const WIRE_ARGS = Object.freeze(['--print', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
  '--include-partial-messages', '--permission-prompt-tool', 'stdio']);
// What an operator's entry may not set. These are the protocol, which conversation this is, and how freely
// it may act: the adapter sets them from the session, and an entry that set them would make the session lie.
const RESERVED_ARGS = new Set(['-p', '--print', '--input-format', '--output-format', '--permission-mode', '--permission-prompt-tool',
  '--permission-prompts', '--dangerously-skip-permissions', '--allow-dangerously-skip-permissions',
  '--session-id', '-r', '--resume', '-c', '--continue', '--fork-session']);

const CONTROL_TIMEOUT_MS = 20_000;
const MAX_TRACKED_TOOLS = 400;
const MAX_REMEMBERED = 400;              // message blocks and frames remembered, to tell a repeat from news

/**
 * The command line for one session, and the mode Claude starts in. Pure, so that it can be checked without
 * starting anything. `mayBypass` is false where Claude would refuse to start in its bypass mode (as root):
 * then it runs one step short of that, and the office answers what it asks.
 */
export function claudeLaunch({ access = 'ask', agentMode = '', model = '', effort = '', sessionId, mayBypass = true }) {
  const ceiling = REACH[access] ?? 0;
  const bypass = ceiling === REACH.full && mayBypass;
  let modeId = CLAUDE_MODES[access] || CLAUDE_MODES.ask;
  if (modeId === 'bypassPermissions' && !bypass) modeId = 'acceptEdits';
  // A mode of its own that somebody chose for it (plan, say) is taken when it stays within what the session allows.
  const own = OFFERED.find((m) => m.id === agentMode);
  if (own && own.reach <= ceiling && (own.id !== 'bypassPermissions' || bypass)) modeId = own.id;
  return {
    modeId, bypass,
    args: [...WIRE_ARGS, '--session-id', sessionId, '--permission-mode', modeId,
      // Without this Claude can never be moved into its bypass mode later; with it, it starts as root only inside a sandbox.
      ...(bypass ? ['--allow-dangerously-skip-permissions'] : []),
      ...(model ? ['--model', model] : []), ...(effort ? ['--effort', effort] : [])],
  };
}

/**
 * The plan's allowance windows as the office passes them on. `rateLimits` is in the shape Claude Code hands
 * its status line — { five_hour: { used_percentage, resets_at (epoch seconds) }, seven_day: … } — so that the
 * reading is the office's one shared reading of those numbers (server/usage-sources.mjs): the status-line
 * bridge and this adapter must not disagree about the same account. Every number is checked once more here,
 * since all of it came from a child process. Exported for the tests.
 */
export function claudeLimits(rateLimits) {
  const report = claudeStatusLineToReport({ rate_limits: isObject(rateLimits) ? rateLimits : {} });
  const ms = (v) => (Number.isFinite(v) && v > 0 ? (v < 1e11 ? v * 1000 : v) : undefined);          // Claude counts in seconds
  return { windows: (report?.windows || []).map((w) => limitWindow({ ...w, resetsAt: ms(w.resetsAt) })).filter(Boolean) };
}

/* ---- the wire --------------------------------------------------------------- */

const WIRE = Object.freeze({
  maxLineBytes: 16 * 1024 * 1024,   // one frame; a tool result can be large, a runaway line cannot
  maxNoiseLines: 40,                // lines that are not frames we put up with before giving up
  maxInflight: 32,                  // requests from Claude we will hold open at once
});
const isRequestId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 256;

/**
 * Both ends of Claude's stream-json conversation over a child's stdio: we ask Claude things, Claude asks us
 * things, and everything else is a message about the turn. The limits are rpc.mjs's, because the peer is as
 * untrusted: a line is bounded before it is parsed, shapes are checked before they are routed, at most 32
 * requests from Claude are held open, and a stream of lines that are not frames ends the conversation.
 *
 * One thing is deliberately different from rpc.mjs. A line that starts like a frame and does not parse is
 * counted with the noise and skipped, as Claude's own SDK does, instead of ending the session: the program
 * on the other side loads other people's plugins, and one of them printing an object must not cost a
 * session. What that risks is a frame we were waiting for; every request here has a deadline for that
 * reason, and a turn whose end was lost is ended by the stop timer once somebody stops it.
 */
export class StreamJsonWire extends EventEmitter {
  /**
   * @param {{readable:import('stream').Readable, writable:import('stream').Writable, maxLineBytes?:number,
   *          onRequest?:(subtype:string, request:object, ctx:{id:string})=>any, onCancel?:(id:string)=>void,
   *          onFrame?:(type:string, frame:object)=>void, trace?:(direction:'in'|'out', frame:object)=>void}} opt
   */
  constructor(opt) {
    super();
    this.maxLineBytes = opt.maxLineBytes || WIRE.maxLineBytes;
    this.onRequest = opt.onRequest || null;
    this.onCancel = opt.onCancel || null;
    this.onFrame = opt.onFrame || null;
    this.trace = opt.trace || null;
    this.readable = opt.readable;
    this.writable = opt.writable;
    this.closed = false;
    this.closeReason = null;
    this.stats = { in: 0, out: 0, noise: 0, unroutable: 0 };
    this._nextId = 1;
    this._pending = new Map();       // our request id → { resolve, reject, subtype, timer }
    this._inflight = new Set();      // ids of requests from Claude we have not answered
    this._decoder = new StringDecoder('utf8');
    this._parts = [];                // fragments of the line being assembled
    this._bytes = 0;

    this.readable.on('data', (chunk) => this.#feed(chunk));
    this.readable.on('end', () => { this.#flushTail(); this.close(new RpcClosedError('the agent closed its output')); });
    this.readable.on('error', (err) => this.close(new RpcClosedError('reading from the agent failed', err)));
    // A dead child makes the next write fail asynchronously (EPIPE); never let that be unhandled.
    this.writable.on('error', (err) => this.close(new RpcClosedError('writing to the agent failed', err)));
  }

  /* ---- reading ----------------------------------------------------------- */

  #feed(chunk) {
    if (this.closed) return;
    const piece = typeof chunk === 'string' ? chunk : this._decoder.write(chunk);
    let start = 0;
    while (start < piece.length && !this.closed) {
      const nl = piece.indexOf('\n', start);
      const part = piece.slice(start, nl === -1 ? piece.length : nl);
      this._bytes += Buffer.byteLength(part);
      if (this._bytes > this.maxLineBytes) {
        this._parts = [];
        this.#fatal(`the agent sent a message larger than ${this.maxLineBytes} bytes`);
        return;
      }
      this._parts.push(part);
      if (nl === -1) break;
      const whole = this._parts.join('');
      this._parts = [];
      this._bytes = 0;
      this.#line(whole);
      start = nl + 1;
    }
  }

  #flushTail() {
    // A last line without a newline: honour it if it is a frame; a torn one says less than the exit status will.
    const rest = (this._parts.join('') + this._decoder.end()).trim();
    this._parts = [];
    if (!rest || this.closed || rest[0] !== '{') return;
    try { this.#route(JSON.parse(rest)); } catch { /* torn final frame */ }
  }

  #line(raw) {
    const body = raw.replace(/\r$/, '').trim();
    if (!body) return;
    let frame = null;
    // Every frame of this protocol is an object. A banner, a log line or something a plugin printed is not.
    if (body[0] === '{') { try { frame = JSON.parse(body); } catch { frame = null; } }
    if (!isObject(frame)) {
      this.stats.noise += 1;
      this.emit('noise', body.slice(0, 400));
      if (this.stats.noise > WIRE.maxNoiseLines) this.#fatal('the agent is writing something other than its protocol to stdout');
      return;
    }
    this.#route(frame);
  }

  #route(frame) {
    const type = typeof frame.type === 'string' ? frame.type : '';
    if (!type || type.length > 80) { this.stats.unroutable += 1; return; }
    this.stats.in += 1;
    if (this.trace) { try { this.trace('in', frame); } catch { /* tracing never breaks the session */ } }
    switch (type) {
      case 'control_response': this.#answered(frame.response); return;
      case 'control_request': this.#incoming(frame); return;
      case 'control_cancel_request':
        // Claude no longer wants the answer to one of its own requests (the turn was stopped, say).
        if (isRequestId(frame.request_id) && this._inflight.delete(frame.request_id) && this.onCancel) {
          try { this.onCancel(frame.request_id); } catch (err) { this.emit('handler-error', err, type); }
        }
        return;
      case 'keep_alive': return;                             // a heartbeat: nothing to do, by definition
      default:
        if (!this.onFrame) return;
        try { this.onFrame(type, frame); } catch (err) { this.emit('handler-error', err, type); }
    }
  }

  #answered(response) {
    const entry = isObject(response) && isRequestId(response.request_id) ? this._pending.get(response.request_id) : null;
    if (!entry) { this.stats.unroutable += 1; return; }        // an answer to nothing we asked
    this._pending.delete(response.request_id);
    if (entry.timer) clearTimeout(entry.timer);
    if (response.subtype === 'success') entry.resolve(isObject(response.response) ? response.response : {});
    else entry.reject(new RpcError(RPC.INTERNAL, String(response.error || 'the request failed').slice(0, 2000), undefined, entry.subtype));
  }

  #incoming(frame) {
    const id = frame.request_id, request = frame.request;
    if (!isRequestId(id)) { this.stats.unroutable += 1; return; }
    if (this._inflight.has(id)) return;                        // the same request delivered twice: it is already being answered
    if (!isObject(request) || typeof request.subtype !== 'string' || !request.subtype || request.subtype.length > 200) {
      this.#respondError(id, 'a control request needs a subtype');
      return;
    }
    if (this._inflight.size >= WIRE.maxInflight) { this.#respondError(id, 'too many requests are already waiting on the client'); return; }
    if (!this.onRequest) { this.#respondError(id, `the client does not provide ${request.subtype}`); return; }
    this._inflight.add(id);
    let outcome;
    try { outcome = Promise.resolve(this.onRequest(request.subtype, request, { id })); }
    catch (err) { outcome = Promise.reject(err); }
    outcome.then(
      (result) => { if (this._inflight.delete(id)) this.send({ type: 'control_response', response: { subtype: 'success', request_id: id, response: result === undefined ? {} : result } }); },
      (err) => {
        if (!this._inflight.delete(id)) return;
        if (err instanceof RpcError) this.#respondError(id, err.message);
        else { this.emit('handler-error', err, request.subtype); this.#respondError(id, 'the client failed to handle this request'); }
      },
    );
  }

  #respondError(id, message) {
    return this.send({ type: 'control_response', response: { subtype: 'error', request_id: id, error: String(message || 'error') } });
  }

  /* ---- writing ----------------------------------------------------------- */

  /** Write one frame. False when the conversation is over. */
  send(frame) {
    if (this.closed) return false;
    let body;
    try { body = JSON.stringify(frame); } catch { return false; }
    this.stats.out += 1;
    if (this.trace) { try { this.trace('out', frame); } catch { /* ignore */ } }
    try { this.writable.write(body + '\n'); return true; }
    catch (err) { this.close(new RpcClosedError('writing to the agent failed', err)); return false; }
  }

  /** Ask Claude something. Rejects with RpcError (it said no) or RpcClosedError (gone, or no answer in time). */
  request(request, opt = {}) {
    if (this.closed) return Promise.reject(this.closeReason || new RpcClosedError());
    const id = `office-${this._nextId++}`;
    return new Promise((resolve, reject) => {
      const entry = { resolve, reject, subtype: request.subtype, timer: null };
      if (opt.timeoutMs > 0) {
        entry.timer = setTimeout(() => {
          if (!this._pending.delete(id)) return;
          this.send({ type: 'control_cancel_request', request_id: id });       // we have stopped waiting; say so
          reject(new RpcClosedError(`the agent did not answer ${request.subtype} within ${Math.round(opt.timeoutMs / 1000)}s`));
        }, opt.timeoutMs);
        if (typeof entry.timer.unref === 'function') entry.timer.unref();
      }
      this._pending.set(id, entry);
      if (!this.send({ type: 'control_request', request_id: id, request })) {
        this._pending.delete(id);
        if (entry.timer) clearTimeout(entry.timer);
        reject(this.closeReason || new RpcClosedError());
      }
    });
  }

  /* ---- ending ------------------------------------------------------------ */

  #fatal(message) {
    const err = new RpcClosedError(message);
    err.protocol = true;
    this.close(err);
  }

  close(reason) {
    if (this.closed) return;
    this.closed = true;
    this.closeReason = reason instanceof Error ? reason : new RpcClosedError(reason ? String(reason) : undefined);
    for (const entry of this._pending.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.reject(this.closeReason);
    }
    this._pending.clear();
    this._inflight.clear();
    this.emit('close', this.closeReason);
  }
}

/* ---- Claude's tools, in the office's words ------------------------------------ */

// By what they do. The names are Claude Code's own (sdk-tools.d.ts, and the tool lists in recorded init frames);
// anything not here is "other", which is asked about by its own name and never rides on a broader grant.
const TOOL_KIND = Object.freeze({
  Bash: 'execute', PowerShell: 'execute', Monitor: 'execute',
  Read: 'read', Glob: 'search', Grep: 'search', ToolSearch: 'search',
  Edit: 'edit', Write: 'edit', NotebookEdit: 'edit',
  WebFetch: 'fetch', WebSearch: 'fetch',
  EnterPlanMode: 'switch_mode', ExitPlanMode: 'switch_mode',
});

/** One tool call as the office shows it. `server` is the MCP server Claude says the tool belongs to, when it says. */
function describeTool(rawName, input, server = '') {
  const args = isObject(input) ? input : {};
  const str = (key, max = LIMITS.title) => (typeof args[key] === 'string' ? line(args[key], max) : '');
  const mcp = /^mcp__(.+?)__(.+)$/.exec(typeof rawName === 'string' ? rawName : '');
  if (mcp) {
    const from = line(server || mcp[1], 40), tool = line(mcp[2], 60);
    return { kind: 'other', name: line(`${from}.${tool}`, 80), title: line(`${from}: ${tool}`, LIMITS.title), command: '', paths: [] };
  }
  const name = line(rawName, 80) || 'tool';
  const kind = TOOL_KIND[name] || 'other';
  const paths = pathsOf({ rawInput: { ...args, path: args.path ?? args.notebook_path } });
  const command = kind === 'execute' ? commandOf(args, '', kind) : '';
  const where = paths[0] || 'a file';
  let title = name;
  switch (kind) {
    case 'execute': title = str('description') || line(command, LIMITS.title) || 'Run a command'; break;
    case 'read': title = `Read ${where}`; break;
    case 'edit': title = `${name === 'Write' ? 'Write' : 'Edit'} ${where}`; break;
    case 'search': title = `${name === 'Glob' ? 'Find' : 'Search for'} ${str('pattern', 160) || str('query', 160) || 'something'}`; break;
    case 'fetch': title = name === 'WebSearch' ? `Search: ${str('query', 200)}` : (str('url') || 'Fetch a page'); break;
    case 'switch_mode': title = name === 'ExitPlanMode' ? 'Leave plan mode and carry out the plan' : 'Enter plan mode'; break;
    default: if (name === 'Agent' || name === 'Task') title = str('description') || 'Start a sub-agent'; break;
  }
  return { kind, name, title: line(title, LIMITS.title), command, paths };
}

/** What a tool_result block says, as text. Claude sends a string, or content blocks. */
function resultText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.slice(0, 32).map((block) => contentText(block)).filter(Boolean).join('\n');
}

// The two answers Claude's permission question has, offered as options with ids of our own so that the rest
// of the harness treats every provider's requests alike. There is no "always" among them on purpose: what
// Claude itself proposes for that can be a whole rule, or a change of its own mode, and can outlive the
// session. "For the session" is remembered by the office instead (approvals.mjs).
// Where a rule of Claude's is kept, in words. The names are Claude's own (PermissionUpdateDestination in the
// SDK's types, plus the two tiers nobody writes a rule to from inside a session).
const RULE_SOURCE = Object.freeze({
  userSettings: 'your Claude settings', projectSettings: 'this project’s Claude settings', localSettings: 'your Claude settings for this project',
  policySettings: 'your organisation’s policy', flagSettings: 'this session’s settings', cliArg: 'this session’s command line', session: 'this session',
});
const sentence = (words) => (/[.!?…]$/.test(words) ? words : `${words}.`);

/**
 * Why a request is one a person has to see whatever the session's mode — as a sentence that person can read
 * on the request itself — or '' for an ordinary request. Read from SDKControlPermissionRequest:
 * decision_reason_type (in the CLI, an "ask" whose reason is "rule" is always one of the operator's ask
 * rules), matched_ask_rule, classifier_approvable, default_to_no and requires_user_interaction.
 */
function insistence(request, why) {
  const reason = typeof request.decision_reason_type === 'string' ? request.decision_reason_type : '';
  const rule = isObject(request.matched_ask_rule) ? request.matched_ask_rule : null;
  const said = why ? `: ${sentence(why)}` : '.';
  if (rule || reason === 'rule') {
    const name = rule && typeof rule.tool_name === 'string' ? line(rule.tool_name, 80) : '';
    const content = rule && typeof rule.rule_content === 'string' ? line(rule.rule_content, 200) : '';
    const where = rule && typeof rule.source === 'string' && Object.hasOwn(RULE_SOURCE, rule.source) ? ` (in ${RULE_SOURCE[rule.source]})` : '';
    if (!name) return `A rule of yours says to ask before this${said}`;
    return `A rule of yours says to ask before this: ${name}${content ? `(${content})` : ''}${where}.${why ? ` ${sentence(why)}` : ''}`;
  }
  if (reason === 'hook') return `A hook of yours says to ask before this${said}`;
  if (reason === 'sandboxOverride') return `Claude wants to run this outside its own sandbox${said}`;
  if (reason === 'classifier') return `Claude’s own classifier would not pass this by itself${said}`;
  if (reason === 'safetyCheck' || request.classifier_approvable === false || request.default_to_no === true) {
    return `Claude’s own safety check${why ? `: ${sentence(why)}` : ' asks for a person here.'}`;
  }
  // A plan is made to be read before it is carried out: approving it is never a matter of policy.
  if (request.tool_name === 'ExitPlanMode') return 'Claude has a plan and asks to carry it out.';
  // "One-tap approve must not be offered": the request is itself the conversation with a person.
  if (request.requires_user_interaction === true) return `Claude says a person has to look at this one${said}`;
  return '';
}

const APPROVAL_OPTIONS = Object.freeze([
  { id: 'allow', name: 'Allow', kind: 'allow_once' },
  { id: 'deny', name: 'Reject', kind: 'reject_once' },
]);

export class ClaudeAdapter extends AgentAdapter {
  /**
   * @param {{command:string, args?:string[], env?:object, cwd:string, clientInfo:object,
   *          mcpServers?:Array<{name:string, command:string, args:string[], env:object}>,
   *          model?:string, effort?:string, agentMode?:string, mode?:'ask'|'edits'|'full',
   *          startTimeoutMs?:number, cancelTimeoutMs?:number, trace?:Function}} opt
   */
  constructor(opt) {
    super(opt, { kind: 'claude-stream-json', dialect: 'stream-json' });
    // Ours to choose (--session-id), so it is known before Claude has said a word — and is what a later resume names.
    this.sessionId = crypto.randomUUID();
    this.version = '';
    this.ready = false;
    this.startFailure = '';           // Claude's own account of why it would not start, when it gives one
    this.args = [];                   // the whole command line, once it is decided
    this.access = REACH[opt.mode] !== undefined ? opt.mode : 'ask';      // the session's mode: the ceiling for Claude's own
    this.modeId = '';                 // Claude's own mode, as Claude last said
    this.mayBypass = false;           // whether this process was started able to enter its bypass mode at all
    this.holdingBack = false;
    this.moving = false;              // while the office itself is moving Claude between its modes (setAccess)
    this.models = [];                 // what the initialize answer listed: [{ id, name, efforts? }]
    this.resolved = new Map();        // a listed model's id (often an alias) → the model it stands for
    this.asked = line(opt.model, 200);          // the model somebody chose, by the name they chose it
    this.model = this.asked;          // …and what is shown: Claude's own word for what runs, once it has said
    this.wireModel = '';
    this.effort = line(opt.effort, 40);
    this.plan = '';                   // the subscription, for the allowance report
    this.tools = new Map();           // tool_use id → what we have reported about it
    this.pending = new Map();         // our request id → { controlId, question, resolve, … }
    this.byControlId = new Map();     // Claude's request id → ours (for control_cancel_request)
    this.requestSeq = 0;
    this.message = null;              // the reply being streamed: { id, blocks, counts, usage }
    this.streamed = new Map();        // "<message id>:<text|thinking>:<n>" → characters already passed on
    this.snapshots = new Map();       // message id → how many text and thinking blocks have arrived whole
    this.framesSeen = new Set();
    this.plansShown = new Set();      // plan-mode exits whose plan has been shown
    this.context = { used: undefined, size: 0, cost: undefined };
    this.windows = {};                // the allowance, merged from partial reports, in the status-line shape
    this.limitsSent = '';
    this.said = new Set();            // notices that are only worth saying once
  }

  /* ---- starting ----------------------------------------------------------- */

  // AgentAdapter's own _spawn wires a JSON-RPC peer. This is the same wiring around the stream-json one; the
  // rest of the base class (the single turn, the stop timer, the careful ending) only needs `closed` and `close`.
  _spawn() {
    const { command, env, cwd } = this.opt;
    this.proc = spawnAgent({ command, args: this.args, cwd, env });
    this.peer = new StreamJsonWire({
      readable: this.proc.child.stdout, writable: this.proc.child.stdin,
      onRequest: (subtype, request, ctx) => this._onRequest(subtype, request, ctx),
      onCancel: (id) => this.#withdrawn(id),
      onFrame: (type, frame) => this._onNotification(type, frame),
      trace: this.opt.trace,
    });
    this.peer.on('close', (reason) => { if (reason?.protocol) this.protocolError = reason.message; this._gone(); });
    this.peer.on('handler-error', () => {});
    this.peer.on('noise', (sample) => this.#once('noise', 'warn', `Claude wrote something that is not its protocol to stdout (“${sample.slice(0, 80)}”). Ignored.`));
    this.proc.exited.then(() => this._gone());
  }

  async start() {
    const reserved = (this.opt.args || []).map((a) => String(a).split('=')[0]).find((a) => RESERVED_ARGS.has(a));
    if (reserved) {
      throw new Error(`this adapter entry passes ${reserved}, which the office sets itself from the session (the protocol, which conversation it is, how freely it may act). Take it out of the entry's args.`);
    }
    // Claude refuses to start in (or able to enter) its bypass mode as root, unless it is told it is in a sandbox.
    const env = this.opt.env || process.env;
    const root = typeof process.getuid === 'function' && process.getuid() === 0 && env.IS_SANDBOX !== '1' && !env.CLAUDE_CODE_BUBBLEWRAP;
    const launch = claudeLaunch({ access: this.access, agentMode: this.opt.agentMode, model: this.asked, effort: this.effort,
      sessionId: this.sessionId, mayBypass: !root });
    // The entry's own arguments first: where one of them and one of ours name the same thing, the last wins, and that is ours.
    this.args = [...(this.opt.args || []), ...launch.args];
    this.modeId = launch.modeId;
    this.mayBypass = launch.bypass;
    this._spawn();
    try {
      return await this._handshake(() => this.#open(root));
    } catch (err) {
      // Where Claude said in its own frame why it would not start, that says more than the last line of stderr.
      if (this.startFailure) throw new Error(this.startFailure);
      throw err;
    }
  }

  async #open(root) {
    const timeoutMs = this.opt.startTimeoutMs || START_TIMEOUT_MS;
    // The handshake costs nothing: no model is called until a user message is written. A title of our own
    // also spares the request Claude would otherwise make to name the conversation.
    const title = [this.opt.clientInfo?.title, this.opt.env?.OFFICE_AGENT_ID].filter((v) => typeof v === 'string' && v).join(' · ');
    const init = await this.peer.request({ subtype: 'initialize', ...(title ? { title: line(title, 120) } : {}) }, { timeoutMs });
    if (!isObject(init)) throw new Error('Claude answered initialize with something that is not an object');
    this.#readInit(init);
    if (this.access === 'full' && !this.mayBypass) {
      this._notice('info', root
        ? 'Claude Code will not bypass its permission checks as root, so it runs in its “acceptEdits” mode: it asks about the rest, and the office answers for it.'
        : 'Claude Code was not started able to bypass its permission checks: it asks, and the office answers for it.');
    }
    if (this.opt.agentMode && this.opt.agentMode !== this.modeId) {
      this._notice('warn', `Claude was not started in its “${line(this.opt.agentMode, 40)}” mode: that is not one of its modes, or it goes further than this session's “${this.access}” mode allows. It runs in “${this.modeId}”.`);
    }
    const officeTools = await this.#offerTools(timeoutMs);
    this.ready = true;
    this.#readUsage();
    return {
      protocol: 'claude-stream-json',
      nativeSessionId: this.sessionId,
      agent: { name: 'Claude Code', version: this.version },
      model: this.model, models: this.models, modeId: this.modeId, modes: this.settings().modes,
      features: {
        interrupt: true, resume: true, images: true, officeTools,
        // Claude has no sandbox: a command it was allowed to run runs with the operator's own rights. What
        // it does have is its own permission mode, which decides what it asks about at all. That is set from
        // the session's mode here and kept in step with it (setAccess) — a policy inside Claude, not a wall.
        nativeSandbox: false,
        // Never sent for a session grant: what Claude proposes as "always" can be a whole rule or a change of its mode.
        exactSessionAllow: false,
      },
    };
  }

  #readInit(init) {
    this.version = line(typeof init.claude_code_version === 'string' ? init.claude_code_version : '', 40);
    // Only what Claude lists is offered; the office keeps no list of its own (they go stale in weeks).
    this.models = (Array.isArray(init.models) ? init.models : []).filter(isObject).slice(0, 60).map((m) => {
      const id = line(typeof m.value === 'string' ? m.value : '', 200);
      const efforts = (Array.isArray(m.supportedEffortLevels) ? m.supportedEffortLevels : []).filter((e) => typeof e === 'string')
        .map((e) => line(e, 40)).filter(Boolean).slice(0, 12).map((e) => ({ id: e, name: e }));
      if (id && typeof m.resolvedModel === 'string' && m.resolvedModel) this.resolved.set(id, line(m.resolvedModel, 200));
      return { id, name: line(m.displayName, 80) || id, ...(efforts.length ? { efforts } : {}) };
    }).filter((m) => m.id);
    // The account's e-mail address is in this answer too. It is nobody's business here and is not kept.
    this.plan = line(isObject(init.account) && typeof init.account.subscriptionType === 'string' ? init.account.subscriptionType : '', 40);
  }

  // The office's own tools, with this session's token in their environment. They go over the pipe
  // (mcp_set_servers) and never on the command line, where every other user of the machine could read the
  // token — the way T3 Code hands Claude its own MCP server ("Send MCP credentials over stdin…").
  async #offerTools(timeoutMs) {
    const list = this.opt.mcpServers || [];
    if (!list.length) return false;
    const servers = Object.fromEntries(list.map((s) => [s.name, { type: 'stdio', command: s.command, args: s.args || [],
      env: Object.fromEntries(Object.entries(s.env || {}).map(([name, value]) => [name, String(value)])) }]));
    try {
      const res = await this.peer.request({ subtype: 'mcp_set_servers', servers }, { timeoutMs });
      const failed = isObject(res?.errors) ? Object.keys(res.errors).filter((name) => name in servers) : [];
      if (!failed.length) return true;
      // Claude's error text can repeat the entry it was given, token and all: only the names are said.
      this._notice('warn', `Claude could not start the office tools (MCP: ${failed.map((n) => line(n, 40)).join(', ')}); it can still work, but cannot reach the office by itself.`);
      return false;
    } catch (err) {
      if (!(err instanceof RpcError)) throw err;
      // A Claude that will not take our MCP server should still be able to work.
      this._notice('warn', 'Claude refused the office tools (MCP); it can still work, but cannot reach the office by itself.');
      return false;
    }
  }

  /* ---- model, effort, its own mode, how freely it acts -------------------------- */

  #modelRow() {
    return this.models.find((m) => m.id === this.model) || this.models.find((m) => this.wireModel && this.resolved.get(m.id) === this.wireModel)
      || (this.asked ? undefined : this.models.find((m) => m.id === 'default'));
  }

  settings() {
    const ceiling = REACH[this.access];
    return {
      model: this.model, models: this.models, modelFree: true,     // --model and set_model take an alias ("opus") or a full model name
      effort: this.effort, efforts: this.#modelRow()?.efforts || [],
      modeId: this.modeId,
      // Its own modes, as far as the session's mode lets it go — and bypass only if this process can enter it at all.
      modes: OFFERED.filter((m) => m.reach <= ceiling && (m.id !== 'bypassPermissions' || this.mayBypass)).map(({ id, name }) => ({ id, name })),
    };
  }

  // What Claude itself says it runs. It is believed over what was asked for; an alias somebody chose is kept
  // only while Claude's answer shows it is still what the alias stands for.
  #modelSeen(said, announce) {
    const wire = line(typeof said === 'string' ? said : '', 200);
    if (!wire || wire === '<synthetic>') return;
    this.wireModel = wire;
    const next = this.asked && (this.asked === wire || this.resolved.get(this.asked) === wire) ? this.asked : wire;
    if (next === this.model) return;
    this.model = next;
    if (announce) this._emit({ type: 'settings' });
  }

  async setModel(model) {
    const value = line(model, 200);
    if (!value) throw new Error('a model needs a name');
    const res = await this.peer.request({ subtype: 'set_model', model: value }, { timeoutMs: CONTROL_TIMEOUT_MS });
    this.asked = value;
    this.model = value;
    this.#modelSeen(isObject(res) ? res.model : '', false);
    // An effort the new model does not list is one Claude now lowers by itself, to a level it does not report.
    const efforts = this.#modelRow()?.efforts || [];
    if (this.effort && efforts.length && !efforts.some((e) => e.id === this.effort)) {
      this._notice('info', `This model does not list the effort “${this.effort}” that was set (it has ${efforts.map((e) => e.id).join(', ')}); how hard it thinks is Claude's own choice until one is set again.`);
      this.effort = '';
    }
  }

  async setEffort(effort) {
    const value = line(effort, 40);
    const efforts = this.#modelRow()?.efforts || [];
    if (!value || (efforts.length && !efforts.some((e) => e.id === value))) {
      throw new Error(efforts.length ? `this model thinks at ${efforts.map((e) => e.id).join(', ')}` : 'an effort needs a name');
    }
    // Claude has no request for effort alone: it is a setting, merged into the session's own layer of them.
    await this.peer.request({ subtype: 'apply_flag_settings', settings: { effortLevel: value } }, { timeoutMs: CONTROL_TIMEOUT_MS });
    this.effort = value;
  }

  async #putInMode(modeId) {
    const res = await this.peer.request({ subtype: 'set_permission_mode', mode: modeId }, { timeoutMs: CONTROL_TIMEOUT_MS });
    // Claude answers with the mode it is now in. That, and not what was asked, is what is shown.
    this.#modeSeen(isObject(res) && typeof res.mode === 'string' ? res.mode : modeId);
    if (this.modeId !== modeId) throw new Error(`Claude answered that it is in its “${this.modeId}” mode`);
  }

  /** Claude's OWN mode. Any of them, as long as it does not go further than the session's mode allows. */
  async setMode(modeId) {
    const mode = OFFERED.find((m) => m.id === modeId);
    if (!mode) throw new Error(`Claude's own modes are ${OFFERED.map((m) => m.id).join(', ')}`);
    if (mode.reach > REACH[this.access]) throw new Error(`its “${mode.id}” mode goes further than this session's “${this.access}” mode allows; change the session's mode first`);
    if (mode.id === 'bypassPermissions' && !this.mayBypass) throw new Error('this Claude was not started able to bypass its permission checks');
    await this.#putInMode(mode.id);
  }

  #modeFor(access) {
    const want = CLAUDE_MODES[access];
    return want === 'bypassPermissions' && !this.mayBypass ? 'acceptEdits' : want;
  }

  /**
   * The session's mode changed: Claude's own mode follows it.
   *
   * Tightening is put to Claude first and has to be accepted, or the change is refused and the session's
   * mode stays as it was: a session must never say "ask" while Claude still bypasses its checks. That holds
   * for a mode somebody chose for it too (it sits in acceptEdits, the session goes to ask: it is brought
   * back to default), and for plan mode, which Claude leaves for whatever it was in before: it is taken out
   * and put back, so that what it returns to is within the new mode.
   *
   * Loosening cannot fail the change — where Claude will not go further it keeps asking, and the office
   * answers by the new mode. It moves Claude only if Claude was simply following the session's mode; a
   * mode of its own that somebody chose (plan, dontAsk) is left alone.
   */
  async setAccess(mode) {
    if (REACH[mode] === undefined) throw new Error('mode must be ask, edits or full');
    const was = this.access, want = this.#modeFor(mode), before = this.modeId;
    let told = false;                             // whether a notice has already said where Claude ended up
    // The moves below are the office's doing, so they are not reported as Claude switching by itself.
    this.moving = true;
    try {
      if (REACH[mode] < REACH[was]) {
        const planning = this.modeId === 'plan';
        if (planning || reachOf(this.modeId) > REACH[mode]) {
          await this.#putInMode(want);
          if (planning) {
            await this.#putInMode('plan').catch((err) => {
              told = true;
              this._notice('warn', `Claude did not go back into plan mode (${text(err?.message || String(err), 200)}); it is in its “${this.modeId}” mode.`);
            });
          }
        }
        this.access = mode;                       // the ceiling comes down only once Claude is under it
      } else {
        const following = this.modeId === this.#modeFor(was);
        this.access = mode;                       // …and goes up first, so that what Claude then says it is in is within it
        if (mode === 'full' && !this.mayBypass && was !== 'full') {
          this._notice('info', `Claude Code was not started able to bypass its permission checks, so it goes no further than its “${want}” mode: it asks about the rest, and the office answers for it.`);
        }
        if (following && want !== this.modeId) {
          await this.#putInMode(want).catch((err) => {
            // No answer at all is not a "no": the change is not made, here or in the session.
            if (err instanceof RpcClosedError) { this.access = was; throw err; }
            this._notice('info', `Claude would not switch to its “${want}” mode (${text(err?.message || String(err), 200)}); it keeps asking, and the office answers for it.`);
          });
        }
      }
    } finally {
      this.moving = false;
      if (this.modeId !== before && !told) this._notice('info', `Claude's own mode is now “${this.modeId}”.`);
      // Its own mode may have moved, and which of its modes it may be put in has a new ceiling — or, where
      // the change was refused half-way, the session should at least show the mode Claude says it is in.
      this._emit({ type: 'settings' });
    }
  }

  #modeSeen(said) {
    const modeId = line(typeof said === 'string' ? said : '', 40);
    if (!modeId || modeId === this.modeId) return;
    this.modeId = modeId;
    if (!this.moving) this._emit({ type: 'mode', modeId });
    // Claude changes its own mode too: it enters and leaves plan mode, a setting of the operator's applies.
    // It may make itself more careful. It may not end up going further than the session allows.
    if (reachOf(modeId) > REACH[this.access]) this.#holdBack();
  }

  // Told once to come back within the session's mode. A Claude that will not is ended: better no agent than
  // one that runs with more than the session shows.
  #holdBack() {
    if (this.holdingBack || !this.ready) return;
    this.holdingBack = true;
    const want = this.#modeFor(this.access), went = this.modeId;
    const end = (why) => {
      this._notice('error', `Claude is in its “${this.modeId}” mode, which goes further than this session's “${this.access}” mode, and would not leave it (${why}). The office ended it.`);
      this.stopReason = 'it would not stay within the session’s mode, so the office ended its process';
      this.proc.kill();
    };
    this.peer.request({ subtype: 'set_permission_mode', mode: want }, { timeoutMs: CONTROL_TIMEOUT_MS }).then((res) => {
      const now = isObject(res) && typeof res.mode === 'string' ? res.mode : want;
      if (reachOf(now) > REACH[this.access]) { end(`it answered “${line(now, 40)}”`); return; }
      this.holdingBack = false;
      this.#modeSeen(now);
      this._notice('warn', `Claude put itself in its “${went}” mode, which goes further than this session's “${this.access}” mode allows. The office put it back in “${line(now, 40)}”.`);
    }, (err) => { if (!this.peer.closed) end(text(err?.message || String(err), 200)); });
  }

  /* ---- the operator's allowance -------------------------------------------- */

  // Asked once, when the session starts, and never waited for (as the Codex adapter asks for its rate limits):
  // an API-key session has no plan windows, and an older Claude does not know the request. The SDK marks the
  // request experimental, so nothing is taken from the answer that is not checked field by field.
  #readUsage() {
    this.peer.request({ subtype: 'get_usage', skip_behaviors: true }, { timeoutMs: CONTROL_TIMEOUT_MS }).then((res) => {
      if (!isObject(res)) return;
      if (typeof res.subscription_type === 'string' && res.subscription_type) this.plan = line(res.subscription_type, 40);
      if (res.rate_limits_available === false || !isObject(res.rate_limits)) return;
      const seen = {};
      for (const id of ['five_hour', 'seven_day']) {
        const w = res.rate_limits[id];
        // Here the share used is a percentage already, and the reset an ISO time.
        if (isObject(w) && Number.isFinite(w.utilization)) seen[id] = { used_percentage: w.utilization, resets_at: Date.parse(w.resets_at) / 1000 };
      }
      // What the stream said in the meantime is newer than this answer.
      this.#limits(seen, { older: true });
    }, () => {});
  }

  // One rate_limit_event. In the stream the share used is a fraction and the reset is in epoch seconds
  // (T3 Code's claudeRateLimitEventToUpdate reads them so; the CLI's own description of the field agrees).
  #rateLimit(info) {
    if (!isObject(info)) return;
    const seen = {};
    const take = (id, w) => {
      if ((id === 'five_hour' || id === 'seven_day') && isObject(w) && Number.isFinite(w.utilization)) {
        seen[id] = { used_percentage: w.utilization * 100, resets_at: w.resetsAt };
      }
    };
    // The window that currently limits, and — where this Claude sends them — every window it tracks.
    take(info.rateLimitType, info);
    if (isObject(info.unifiedWindows)) for (const [id, w] of Object.entries(info.unifiedWindows).slice(0, 8)) take(id, w);
    this.#limits(seen);
    // A model's own weekly window (seven_day_opus, …) is not the account's allowance and is not reported as one.
    const paidFor = info.overageStatus === 'allowed' || info.overageStatus === 'allowed_warning' || info.isUsingOverage === true || info.overageInUse === true;
    if (info.status === 'rejected' && !paidFor) {
      const which = { five_hour: 'five-hour', seven_day: 'weekly' }[info.rateLimitType] || 'usage';
      const until = Number.isFinite(info.resetsAt) && info.resetsAt > 0 ? ` It says the window reopens at ${new Date(info.resetsAt * 1000).toISOString()}.` : '';
      this.#once(`limit:${info.rateLimitType}:${info.resetsAt}`, 'warn',
        `Claude has used up its ${which} allowance.${until} A turn waits for that unless somebody stops it.`);
    }
  }

  // Reports are partial: a window Claude leaves out keeps its last value.
  #limits(seen, { older = false } = {}) {
    this.windows = older ? { ...seen, ...this.windows } : { ...this.windows, ...seen };
    const { windows } = claudeLimits(this.windows);
    if (!windows.length) return;
    const key = JSON.stringify([this.plan, windows]);
    if (key === this.limitsSent) return;
    this.limitsSent = key;
    this._emit({ type: 'limits', ...(this.plan ? { plan: this.plan } : {}), windows });
  }

  /* ---- turns -------------------------------------------------------------- */

  /** Send one turn. Returns once it is on its way; the end arrives as `turn.ended`. */
  prompt(promptText) {
    if (!this.ready) throw new Error('Claude is not running');
    // The id is echoed on the result of the turn this message starts, which is how that result is told from
    // the end of a turn Claude started by itself (a background task of its own reporting back).
    const turn = this._beginTurn({ uuid: crypto.randomUUID() });
    this.message = null;
    this.peer.send({ type: 'user', message: { role: 'user', content: String(promptText) }, parent_tool_use_id: null, uuid: turn.uuid });
  }

  /** Ask Claude to stop. If it does not end the turn in time, its process is ended. */
  cancel() {
    const turn = this.turn;
    if (!turn || turn.cancelRequested) return false;
    turn.cancelRequested = true;
    // What it was waiting on is refused first, so that nothing it asked is left hanging over the stop.
    this._settlePending('the turn was stopped');
    // Those answers are written once the promises they resolve have run; the interrupt goes out after them,
    // never past them. Its own answer only acknowledges the request: the turn's real end arrives as its result.
    setImmediate(() => {
      if (this.turn === turn) this.peer.request({ subtype: 'interrupt' }, { timeoutMs: CONTROL_TIMEOUT_MS }).catch(() => {});
    });
    this._armCancelTimer(turn, 'Claude');
    return true;
  }

  _closeOpenWork(result) {
    for (const tool of this.tools.values()) {
      if (tool.status === 'pending' || tool.status === 'running') {
        tool.status = result.status === 'completed' ? 'completed' : 'failed';
        this._emit({ type: 'tool', ...tool });
      }
    }
  }

  /* ---- permission requests and questions ------------------------------------ */

  _settlePending(reason) {
    for (const [requestId, entry] of this.pending) {
      this.pending.delete(requestId);
      this.byControlId.delete(entry.controlId);
      entry.resolve({ behavior: 'deny', message: `The request was withdrawn: ${reason}.`, interrupt: true, ...entry.echo });
      this._emit({ type: 'permission.gone', requestId, reason });
    }
  }

  // Claude stopped waiting by itself (control_cancel_request). The wire has already forgotten the request.
  #withdrawn(controlId) {
    const requestId = this.byControlId.get(controlId);
    const entry = requestId && this.pending.get(requestId);
    if (!entry) return;
    this.pending.delete(requestId);
    this.byControlId.delete(controlId);
    entry.resolve({});
    this._emit({ type: 'permission.gone', requestId, reason: 'Claude stopped waiting' });
  }

  /** `{optionId}` for a permission, `{answers:{questionId:text}}` for a question, `{cancelled:true}` for either. */
  answer(requestId, decision) {
    const entry = this.pending.get(requestId);
    if (!entry) return false;
    let reply;
    if (entry.question) reply = !decision?.cancelled && isObject(decision?.answers) ? entry.answered(decision.answers) : entry.declined();
    else if (decision?.cancelled || decision?.optionId === 'deny') reply = { behavior: 'deny', message: 'The human in the office declined this request.', ...entry.echo };
    else if (decision?.optionId === 'allow') reply = { behavior: 'allow', updatedInput: entry.input, ...entry.echo };
    else return false;                                       // only the answers we offered
    this.pending.delete(requestId);
    this.byControlId.delete(entry.controlId);
    entry.resolve(reply);
    return true;
  }

  #ask(controlId, event, entry) {
    const requestId = `p${++this.requestSeq}`;
    return new Promise((resolve) => {
      this.pending.set(requestId, { controlId, resolve, question: event.type === 'question', ...entry });
      this.byControlId.set(controlId, requestId);
      this._emit({ ...event, requestId });
    });
  }

  _onRequest(subtype, request, { id }) {
    switch (subtype) {
      case 'can_use_tool': return this.#permission(request, id);
      case 'elicitation':
        // An MCP server asking the person for input: a form the office cannot show yet. Declining is its own answer.
        this.#once('elicitation', 'info', 'An MCP server asked Claude’s user for input, which the office cannot show yet; it was declined.');
        return { action: 'decline' };
      default:
        // Hook callbacks, in-process MCP servers, dialogs: the office registered none of them.
        throw new RpcError(RPC.METHOD_NOT_FOUND, `the office does not provide ${line(subtype, 60)}`);
    }
  }

  #permission(request, controlId) {
    const toolName = typeof request.tool_name === 'string' ? request.tool_name : '';
    const toolId = typeof request.tool_use_id === 'string' ? request.tool_use_id.trim().slice(0, 200) : '';
    const input = isObject(request.input) ? request.input : {};
    const echo = toolId ? { toolUseID: toolId } : {};
    if (toolName === 'AskUserQuestion') return this.#question(input, controlId, echo);

    const server = isObject(request.mcp_server) && typeof request.mcp_server.name === 'string' ? request.mcp_server.name : '';
    // Claude asks before the tool runs, and usually after it has announced the call. Either way the record
    // shows what is being asked about before the question.
    const tool = this.#toolStarted({ id: toolId, name: toolName, input }, server) || describeTool(toolName, input, server);
    const paths = tool.paths.slice();
    const outside = typeof request.blocked_path === 'string' && request.blocked_path.trim() ? redact(request.blocked_path.trim(), 1024) : '';
    if (outside && !paths.includes(outside) && paths.length < LIMITS.paths) paths.push(outside);
    // Why Claude asks, in its words (it may carry terminal colours: they are stripped), and who is asking.
    const why = text(typeof request.decision_reason === 'string' ? request.decision_reason : '', 600).replace(/\s+/g, ' ').trim();
    // Some asks are ones Claude puts to a person whatever mode it is in: a check of its own (a write to its
    // settings or under .git, a dangerous removal, a command that would leave its sandbox, something its
    // classifier would not pass), or a rule or a hook of the operator's own that says "ask". Those are marked
    // `manual`, and the session answers none of them by its mode or by a grant: they are why Claude still asks
    // at all in its bypass mode. T3 Code draws the same line (requiresClaudeApproval: "CLI-forwarded requests
    // need a person's decision even under bypass"). The request says why in so many words, because somebody
    // who chose "acts without asking" is otherwise left to wonder why they are being asked.
    const insists = insistence(request, why);
    const detail = [insists ? `${insists} It is put to a person in every mode.` : why, outside ? `outside its folder: ${outside}` : '',
      typeof request.agent_id === 'string' && request.agent_id ? 'asked by a sub-agent' : ''].filter(Boolean).join(' — ');
    return this.#ask(controlId, { type: 'permission', kind: tool.kind, toolId, title: tool.title, name: tool.name, detail,
      command: tool.command, paths, options: APPROVAL_OPTIONS, ...(insists ? { manual: true } : {}) }, { input, echo });
  }

  // Claude's question to the person is a tool of its own, and its answer is that tool's input, completed.
  #question(input, controlId, echo) {
    const asked = (Array.isArray(input.questions) ? input.questions : []).filter(isObject).slice(0, 8)
      .map((q, i) => ({ id: `q${i + 1}`, key: typeof q.question === 'string' ? q.question : '', header: line(q.header, 80), text: text(q.question, 1200),
        options: (Array.isArray(q.options) ? q.options : []).filter(isObject).slice(0, 8).map((o) => line(o.label, 120)).filter(Boolean) }))
      .filter((q) => q.key.trim());
    const declined = () => ({ behavior: 'deny', message: 'The human in the office declined to answer.', ...echo });
    if (!asked.length) return declined();
    return this.#ask(controlId, { type: 'question', questions: asked.map(({ id, header, text: wording, options }) => ({ id, header, text: wording, options })) }, {
      echo, declined,
      // Claude keys the answers by the question's own text, exactly as it wrote it.
      answered: (answers) => ({ behavior: 'allow', ...echo,
        updatedInput: { ...input, answers: Object.fromEntries(asked.map((q) => [q.key, typeof answers[q.id] === 'string' ? answers[q.id] : ''])) } }),
    });
  }

  /* ---- the stream ----------------------------------------------------------- */

  _onNotification(type, frame) {
    switch (type) {
      case 'stream_event': this.#streamEvent(frame); return;
      case 'assistant': this.#assistant(frame); return;
      case 'user': this.#user(frame); return;
      case 'result': this.#result(frame); return;
      case 'system': this.#system(frame); return;
      case 'rate_limit_event': this.#rateLimit(frame.rate_limit_info); return;
      case 'auth_status':
        if (typeof frame.error === 'string' && frame.error.trim()) this.#once(`auth:${frame.error.slice(0, 80)}`, 'error', `Claude Code could not sign in: ${frame.error}`);
        return;
      default:
        return;                                            // the set of frames grows; one we do not know is not an error
    }
  }

  // The reply as it is written (--include-partial-messages): the Messages API's own stream events, wrapped.
  // Only the root conversation's: a sub-agent's words are its own, never folded into this reply.
  #streamEvent(frame) {
    const ev = frame.event;
    if (!isObject(ev) || frame.parent_tool_use_id) return;
    switch (ev.type) {
      case 'message_start': {
        const m = isObject(ev.message) ? ev.message : {};
        this.message = { id: typeof m.id === 'string' ? m.id.slice(0, 120) : '', blocks: new Map(), counts: { text: 0, thinking: 0 }, usage: {} };
        this.#usage(m.usage);
        return;
      }
      case 'content_block_start': {
        const b = ev.content_block;
        const kind = isObject(b) && (b.type === 'text' || b.type === 'thinking') ? b.type : '';
        if (!this.message || !kind) return;                // a tool call is reported from the whole message, once its input is complete
        const block = { kind, key: `${this.message.id}:${kind}:${this.message.counts[kind]++}`, chars: 0 };
        this.message.blocks.set(ev.index, block);
        this.#words(block, kind === 'text' ? b.text : b.thinking);
        return;
      }
      case 'content_block_delta': {
        const block = this.message?.blocks.get(ev.index), d = ev.delta;
        if (!block || !isObject(d)) return;
        if (d.type === 'text_delta' && block.kind === 'text') this.#words(block, d.text);
        else if (d.type === 'thinking_delta' && block.kind === 'thinking') this.#words(block, d.thinking);
        return;
      }
      case 'content_block_stop': {
        const block = this.message?.blocks.get(ev.index);
        if (!block) return;
        this.message.blocks.delete(ev.index);
        if (block.kind === 'text' && block.chars && this.turn) this._emit({ type: 'message.break' });      // the next text is a new reply
        return;
      }
      case 'message_delta': this.#usage(ev.usage); return;
      default: return;
    }
  }

  #words(block, chunk) {
    if (typeof chunk !== 'string' || !chunk) return;
    block.chars += chunk.length;
    this.#remember(this.streamed, block.key, block.chars);
    // Words outside a turn are Claude going on by itself; the office says so once the result is in (#result).
    if (this.turn) this._emit({ type: block.kind === 'text' ? 'message.delta' : 'thought.delta', text: chunk.slice(0, LIMITS.delta) });
  }

  #remember(map, key, value) {
    map.delete(key);
    map.set(key, value);
    if (map.size > MAX_REMEMBERED) map.delete(map.keys().next().value);
  }

  // One finished block of a reply: Claude sends each block as its own `assistant` message when it is complete,
  // whether or not it was streamed first. What was streamed is not said twice.
  #assistant(frame) {
    const m = frame.message;
    if (!isObject(m)) return;
    if (typeof frame.uuid === 'string' && frame.uuid) {
      if (this.framesSeen.has(frame.uuid)) return;         // the same frame again
      this.framesSeen.add(frame.uuid);
      if (this.framesSeen.size > MAX_REMEMBERED) this.framesSeen.delete(this.framesSeen.values().next().value);
    }
    const root = !frame.parent_tool_use_id;
    const id = typeof m.id === 'string' ? m.id.slice(0, 120) : '';
    const blocks = (Array.isArray(m.content) ? m.content : []).filter(isObject).slice(0, 64);
    if (root) {
      this.#modelSeen(m.model, true);
      const counts = this.snapshots.get(id) || { text: 0, thinking: 0 };
      for (const b of blocks) {
        if (b.type !== 'text' && b.type !== 'thinking') continue;
        const key = `${id}:${b.type}:${counts[b.type]++}`;
        const whole = b.type === 'text' ? b.text : b.thinking;
        if (typeof whole !== 'string' || !whole) continue;
        const had = this.streamed.get(key) || 0;
        if (had >= whole.length) continue;
        this.#remember(this.streamed, key, whole.length);
        if (!this.turn) continue;
        this._emit({ type: b.type === 'text' ? 'message.delta' : 'thought.delta', text: whole.slice(had, had + LIMITS.delta) });
        if (b.type === 'text' && !had) this._emit({ type: 'message.break' });      // it never streamed, so nothing else will close it
      }
      this.#remember(this.snapshots, id, counts);
      if (!this.message || this.message.id !== id) { this.message = { id, blocks: new Map(), counts: { text: 0, thinking: 0 }, usage: {} }; this.#usage(m.usage); }
      if (frame.error === 'authentication_failed') {
        this.#once('signed-out', 'error', 'Claude Code is not signed in, or its login has expired. Run `claude` once in a terminal and log in, then give it the turn again. The office never handles a credential.');
      }
    }
    // A sub-agent's tool calls are work done in this session's folder, so they are shown; its words are not.
    for (const b of blocks) if (b.type === 'tool_use') this.#toolStarted(b);
  }

  #toolStarted(block, server = '') {
    const id = typeof block.id === 'string' ? block.id.trim().slice(0, 200) : '';
    const name = typeof block.name === 'string' ? block.name : '';
    const input = isObject(block.input) ? block.input : {};
    if (name === 'AskUserQuestion') return null;           // shown as the question it is
    if (name === 'TodoWrite') { this.#todos(input); return null; }
    if (!id) return null;
    let tool = this.tools.get(id);
    if (!tool) {
      tool = { id, ...describeTool(name, input, server), status: 'running', output: '' };
      this.tools.set(id, tool);
      if (this.tools.size > MAX_TRACKED_TOOLS) this.tools.delete(this.tools.keys().next().value);
      this._emit({ type: 'tool', ...tool });
    }
    // The plan Claude wants to carry out. The tool's own input need not hold it (its type declares no such
    // field); the request to approve it does, which is where T3 Code reads it too (claudeProposedPlan). It is
    // shown once, with whichever of the two brings it first.
    if (name === 'ExitPlanMode' && typeof input.plan === 'string' && input.plan.trim() && !this.plansShown.has(id)) {
      this.plansShown.add(id);
      if (this.plansShown.size > MAX_REMEMBERED) this.plansShown.delete(this.plansShown.values().next().value);
      this._emit({ type: 'plan', entries: [], note: text(input.plan, 4000) });
    }
    return tool;
  }

  // Claude's task list is a tool call whose input is the whole list, every time.
  #todos(input) {
    if (!Array.isArray(input.todos)) return;
    this._emit({ type: 'plan', entries: input.todos.filter(isObject).slice(0, LIMITS.planEntries).map((t, i) => ({
      text: line(t.content, 300) || `Step ${i + 1}`,
      status: t.status === 'completed' ? 'completed' : t.status === 'in_progress' ? 'running' : 'pending' })) });
  }

  // What Claude adds to the conversation itself: chiefly the results of its tool calls.
  #user(frame) {
    const content = isObject(frame.message) ? frame.message.content : null;
    if (!Array.isArray(content)) return;
    for (const b of content.slice(0, 64)) {
      if (!isObject(b) || b.type !== 'tool_result' || typeof b.tool_use_id !== 'string') continue;
      const tool = this.tools.get(b.tool_use_id.trim().slice(0, 200));
      if (!tool || tool.status === 'completed' || tool.status === 'failed') continue;
      tool.status = b.is_error === true ? 'failed' : 'completed';
      tool.output = tail(resultText(b.content));
      this._emit({ type: 'tool', ...tool });
    }
  }

  // How full the context is: what the latest request carried in (fresh, cache-written and cache-read input)
  // plus what it has produced so far. A count the closing event leaves out keeps what the opening one said.
  // The same reading as T3 Code's claudeProviderTurnTokenUsage.
  #usage(usage) {
    if (!isObject(usage) || !this.message) return;
    const m = this.message.usage;
    for (const k of ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens']) {
      if (Number.isFinite(usage[k]) && usage[k] >= 0) m[k] = usage[k];
    }
    const input = (m.input_tokens || 0) + (m.cache_creation_input_tokens || 0) + (m.cache_read_input_tokens || 0);
    if (!input) return;                                    // usage without input is a placeholder, not a measurement
    this.#measured({ used: input + (m.output_tokens || 0) });
  }

  #measured({ used = this.context.used, size = this.context.size, cost = this.context.cost }) {
    const c = this.context;
    if (used === c.used && size === c.size && cost === c.cost) return;
    Object.assign(c, { used, size, cost });
    this._emit({ type: 'usage', ...(used !== undefined ? { used } : {}), ...(size ? { size } : {}),
      // Claude's own estimate of what the session has cost, as it states it. Not a bill.
      ...(cost !== undefined ? { cost: { amount: cost, currency: 'USD' } } : {}) });
  }

  // The end of a turn: exactly one `result` each. It also carries the window the model's context is measured
  // against, which nothing earlier in the stream says.
  #result(frame) {
    if (typeof frame.startup_failure_reason === 'string' && !this.ready) {
      this.startFailure = text((Array.isArray(frame.errors) ? frame.errors : []).filter((e) => typeof e === 'string').join('; '), 600)
        || `Claude Code would not start (${line(frame.startup_failure_reason, 60)})`;
      return;
    }
    const perModel = isObject(frame.modelUsage) ? Object.entries(frame.modelUsage).filter(([, v]) => isObject(v)) : [];
    // Helper models are counted there too; the window that matters is the one of the model that holds the conversation.
    const main = perModel.find(([name]) => name === this.wireModel) || (perModel.length === 1 ? perModel[0] : null);
    const size = main && Number.isFinite(main[1].contextWindow) && main[1].contextWindow > 0 ? main[1].contextWindow : this.context.size;
    const cost = Number.isFinite(frame.total_cost_usd) && frame.total_cost_usd >= 0 ? frame.total_cost_usd : this.context.cost;
    this.#measured({ size, cost });

    const turn = this.turn;
    const echoed = Array.isArray(frame.user_message_uuids) ? frame.user_message_uuids : (typeof frame.user_message_uuid === 'string' ? [frame.user_message_uuid] : []);
    // Ours is the one that names our message. A Claude too old to name any ends our turn with whatever result
    // is not marked as a background task's.
    const ours = turn && (echoed.length ? echoed.includes(turn.uuid) : !(isObject(frame.origin) && frame.origin.kind === 'task-notification'));
    if (!ours) {
      // A turn Claude started by itself. It is not an answer to anything the office asked, so it is not shown as one.
      const words = typeof frame.result === 'string' ? frame.result.trim() : '';
      if (words) this._notice('info', `Claude went on by itself after work in the background finished, and said: ${text(words, 400)}`);
      return;
    }
    this.message = null;
    this._endTurn(turn, this.#outcome(frame, turn));
  }

  #outcome(frame, turn) {
    const why = typeof frame.terminal_reason === 'string' ? frame.terminal_reason : '';
    const stopReason = line(typeof frame.stop_reason === 'string' ? frame.stop_reason : '', 40);
    if (why === 'aborted_streaming' || why === 'aborted_tools') return { status: 'interrupted', stopReason: 'cancelled' };
    if (frame.subtype === 'success' && frame.is_error !== true) {
      if (stopReason === 'refusal') return { status: 'failed', error: 'the model declined to continue' };
      return { status: 'completed', stopReason: stopReason || 'end_turn' };
    }
    if (frame.subtype === 'error_max_turns') return { status: 'completed', stopReason: 'max_turn_requests' };
    if (turn.cancelRequested) return { status: 'interrupted', stopReason: 'cancelled' };
    // An API failure ends a turn as "success" with is_error set and the error as its text; the other endings list their errors.
    const said = frame.subtype === 'success' ? (typeof frame.result === 'string' ? frame.result : '')
      // Lines starting "[ede_diagnostic]" are Claude's own telemetry, not something to show a person (T3 Code leaves them out too).
      : (Array.isArray(frame.errors) ? frame.errors : []).filter((e) => typeof e === 'string' && e && !e.startsWith('[ede_diagnostic]')).join('; ');
    return { status: 'failed', error: text(said, 600) || `Claude stopped the turn (${line(why || String(frame.subtype || ''), 60) || 'it gave no reason'})` };
  }

  #system(frame) {
    switch (frame.subtype) {
      case 'init': {
        // Sent at the start of every turn. The session id is the one we chose, unless Claude started a new conversation.
        if (typeof frame.session_id === 'string' && frame.session_id && frame.session_id !== this.sessionId) {
          this._notice('warn', `Claude says this conversation is ${line(frame.session_id, 80)}, not ${this.sessionId} as the office asked. Resuming it later needs the id Claude gives.`);
          this.sessionId = frame.session_id.slice(0, 200);
        }
        if (typeof frame.claude_code_version === 'string') this.version = line(frame.claude_code_version, 40) || this.version;
        this.#modelSeen(frame.model, true);
        this.#modeSeen(frame.permissionMode);
        if (typeof frame.effort === 'string' && frame.effort && line(frame.effort, 40) !== this.effort) { this.effort = line(frame.effort, 40); this._emit({ type: 'settings' }); }
        const ours = new Set((this.opt.mcpServers || []).map((s) => s.name));
        const down = (Array.isArray(frame.mcp_servers) ? frame.mcp_servers : []).filter(isObject).filter((s) => ours.has(s.name) && s.status === 'failed');
        if (down.length) this.#once('mcp-down', 'warn', 'Claude reports that the office tools (MCP) failed to start; it cannot reach the office by itself.');
        return;
      }
      case 'status':
        this.#modeSeen(frame.permissionMode);
        if (frame.status === 'compacting') this._notice('info', 'Claude is summarising its conversation to make room.');
        if (frame.compact_result === 'failed') this._notice('warn', `Claude could not summarise its conversation${typeof frame.compact_error === 'string' ? `: ${frame.compact_error}` : '.'}`);
        return;
      case 'compact_boundary': {
        const after = isObject(frame.compact_metadata) ? frame.compact_metadata.post_tokens : undefined;
        if (Number.isFinite(after) && after >= 0) this.#measured({ used: after });
        return;
      }
      case 'api_retry':
        // Said for the first attempt of a run of them; the outcome arrives as the turn's result either way.
        if (frame.attempt === 1) this._notice('warn', `Claude’s request to its API failed (${line(String(frame.error || 'no reason given'), 60)}); it is trying again.`);
        return;
      case 'local_command_output':
        // What one of Claude's own slash commands printed (/context, /cost): the answer to a turn that was one.
        if (this.turn && typeof frame.content === 'string' && frame.content) {
          this._emit({ type: 'message.delta', text: frame.content.slice(0, LIMITS.delta) });
          this._emit({ type: 'message.break' });
        }
        return;
      case 'permission_denied':
        // Refused by Claude's own rules without anybody being asked (a deny rule, its dontAsk mode).
        this._notice('info', `Claude refused a ${line(typeof frame.tool_name === 'string' ? frame.tool_name : 'tool', 60)} call by its own rules${typeof frame.message === 'string' && frame.message ? `: ${frame.message}` : '.'}`);
        return;
      default:
        return;                                            // hooks, background tasks, thinking-token counts: nothing to show yet
    }
  }

  #once(key, level, message) {
    if (this.said.has(key)) return;
    this.said.add(key);
    if (this.said.size > 200) this.said.delete(this.said.values().next().value);
    this._notice(level, message);
  }
}
