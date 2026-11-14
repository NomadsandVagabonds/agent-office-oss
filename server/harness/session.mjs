// The Office — harness: one driven session.
//
// A driven session is an agent the office runs itself, as a child process
// speaking a structured protocol, instead of a terminal it scrapes and types
// into. This class is the one interface the rest of the daemon uses, whatever
// the provider: start it, send it a turn, read what it does as events, answer
// its permission requests, stop a turn, end it.
//
// It is also what makes a driven session an ordinary citizen of the office:
// the agent's desk, status, current tool and context meter are driven from the
// event stream here (no hooks involved), every event lands in the transcript,
// and a permission request becomes a NEEDS-YOU card whose buttons are real.
//
// Ids: the session id is the office's own and is also the agent id. The
// provider's session or thread id is kept only as a reference (`nativeRef`).
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AcpAdapter } from './acp.mjs';
import { CodexAdapter } from './codex.mjs';
import { ClaudeAdapter } from './claude.mjs';
import { Transcript } from './transcript.mjs';
import { choicesFor, standingAnswer, describeRequest, categoryOf, insideFolder } from './approvals.mjs';
import { line, text as cleanText, limitWindow } from './normalize.mjs';
import { MODE_LABEL, MODES } from './catalog.mjs';
import { WAKE_MODES } from './settings.mjs';

const MAX_PROMPT_CHARS = 120_000;
const MAX_MESSAGE_CHARS = 48_000;        // one reply, as kept in the transcript
const MAX_THOUGHT_CHARS = 6_000;
const STREAM_FLUSH_MS = 120;             // live text reaches watchers a few times a second, not per token
const TOOL_LABEL = Object.freeze({ execute: 'Shell', edit: 'Edit', delete: 'Delete', move: 'Move', read: 'Read',
  search: 'Search', fetch: 'Fetch', think: 'Think', switch_mode: 'Mode' });
const FILE_KIND = Object.freeze({ edit: 'edit', delete: 'edit', move: 'edit', read: 'read', search: 'read' });
// One adapter per wire protocol; adding a provider that speaks neither is one more entry here.
const ADAPTERS = Object.freeze({ acp: AcpAdapter, 'codex-app-server': CodexAdapter, 'claude-stream-json': ClaudeAdapter });

// What a human can change on a running session, the adapter method that does it, and the words for it.
const SETTINGS = Object.freeze({
  model: { call: 'setModel', word: 'model', said: 'Model' },
  effort: { call: 'setEffort', word: 'effort', said: 'Effort' },
  agentMode: { call: 'setMode', word: 'own mode', said: 'Its own mode' },
  mode: { call: 'setAccess', word: 'mode', said: 'Mode' },
});

export class SessionError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// The session's own credential must never be readable back out of what the
// office shows or keeps: an agent that prints its environment would otherwise
// publish its token to every teammate who reads its transcript.
const expandHome = (p) => (p === '~' ? os.homedir() : p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p);

const TOKEN_MASK = '[office session token]';
function scrub(value, secret) {
  if (typeof value === 'string') return value.includes(secret) ? value.split(secret).join(TOKEN_MASK) : value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, secret));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrub(v, secret);
    return out;
  }
  return value;
}

export class DrivenSession extends EventEmitter {
  /**
   * @param {{ctx:object, spec:object, record:object, token:string, files:{transcript:string, trace:string}}} init
   */
  constructor({ ctx, spec, record, token, files }) {
    super();
    this.ctx = ctx;
    this.cfg = ctx.cfg.harness;
    this.spec = spec;                 // the catalog entry this session was started from
    this.record = record;             // what is persisted and shown about this session
    this.id = record.id;
    this.state = 'starting';          // starting → idle ⇄ running → ended | failed
    this.transcript = new Transcript(files.transcript);
    if (token) {
      // Scrubbed where text is whole: a streamed reply can carry the token split across two chunks.
      const write = this.transcript.write.bind(this.transcript);
      this.transcript.write = (entry, opt) => write(scrub(entry, token), opt);
    }
    this.queue = [];                  // turns waiting for the current one to finish
    this.turn = null;
    this.turnCount = 0;
    this.lastTurn = null;
    this.requests = new Map();        // request id → { ev, category, choices, promptId, kind }
    this.grants = new Set();          // categories a human allowed for this session
    this.stream = null;               // the reply (or reasoning) currently being streamed
    this.itemSeq = 0;
    this.filesSeen = new Set();
    this.usage = null;
    this.limits = null;               // the provider's own account of the operator's allowance, when it gives one
    this.features = {};
    // What the agent itself says it offers (models, efforts, its own modes); empty until it has started.
    this.offer = { models: [], modelFree: false, efforts: [], modes: [] };
    this.setting = null;              // { name, value } while a human's change is on its way to the agent
    this.endReason = '';
    const port = ctx.port || ctx.cfg.port;
    const officeEnv = {
      OFFICE_PORT: String(port), OFFICE_URL: `http://127.0.0.1:${port}`,
      OFFICE_AGENT_ID: this.id, OFFICE_PROVIDER: record.provider, OFFICE_SESSION_TOKEN: token,
    };
    // The agent inherits the operator's environment (it uses the operator's own
    // login), plus who it is in the office. The office's network token is not its business.
    const env = { ...process.env, ...spec.env, ...officeEnv, OFFICE_RUNTIME_SESSION_ID: this.id };
    delete env.OFFICE_TOKEN;
    const mcpServers = this.cfg.injectMcp && spec.mcp !== false
      ? [{ name: 'office', command: process.execPath, args: [path.join(ctx.cfg.root, 'office-mcp.mjs')], env: officeEnv }]
      : [];
    const common = {
      command: spec.command, args: spec.args, env, cwd: record.cwd, mcpServers, model: record.model || '',
      effort: record.effort || '', agentMode: record.agentMode || '',
      clientInfo: { name: 'the-office', title: 'The Office', version: ctx.version || '0.0.0' },
      startTimeoutMs: this.cfg.startTimeoutMs, cancelTimeoutMs: this.cfg.cancelTimeoutMs,
      trace: this.cfg.trace ? this.#tracer(files.trace, token) : undefined,
    };
    // The one place a protocol picks code. Each adapter takes what it understands from the same options.
    const Adapter = ADAPTERS[spec.protocol] || AcpAdapter;
    this.adapter = new Adapter({ ...common, mode: record.mode, protocol: spec.acpVersion === 2 ? 2 : 1, modeId: record.agentMode || spec.modeId });
    this.adapter.on('event', (raw) => {
      const ev = token ? scrub(raw, token) : raw;
      try { this.#on(ev); }
      catch (err) { ctx.log.warn(`[harness] ${this.id} could not handle ${ev?.type}: ${err?.stack || err}`); }
    });
  }

  get live() { return this.state === 'idle' || this.state === 'running' || this.state === 'starting'; }
  get mode() { return this.record.mode; }
  get waiting() { return this.requests.size > 0; }

  // Raw frames, for comparing a real agent against what the adapters expect.
  // Off unless OFFICE_HARNESS_TRACE=1: frames carry everything the agent sees
  // (prompts, file contents in tool results) — except the session's own token.
  #tracer(file, token) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    return (direction, message) => {
      const body = scrub(JSON.stringify(message), token);
      fs.appendFile(file, JSON.stringify({ t: Date.now(), dir: direction, frame: body.length > 6000 ? body.slice(0, 6000) + '…' : body }) + '\n', () => {});
    };
  }

  #agent(patch, opt) { return this.ctx.agents.drive(this.id, patch, opt); }
  #save() { this.emit('changed'); }
  #note(level, message, extra = {}) {
    return this.transcript.write({ id: `n${++this.itemSeq}`, kind: 'notice', level, text: cleanText(message, 1000),
      ...(this.turn ? { turn: this.turn.n } : {}), ...extra });
  }

  /* ---- starting ----------------------------------------------------------- */

  async start() {
    const r = this.record;
    this.transcript.write({ id: 'session', kind: 'session', state: 'starting', adapter: r.adapter, label: r.label,
      protocol: r.protocol, cwd: r.cwd, mode: r.mode, modeLabel: MODE_LABEL[r.mode], wake: r.wake, origin: r.origin });
    this.#agent({ provider: r.provider, cwd: r.cwd, model: r.model || '', driven: true, runtimeSessionId: this.id,
      ...(r.name ? { selfName: r.name } : {}), ...(r.handle ? { handle: r.handle } : {}), ...(r.task ? { selfTask: r.task } : {}),
      status: 'arriving', turn: 'idle', tool: '' });
    let info;
    try {
      info = await this.adapter.start();
    } catch (err) {
      const reason = cleanText(err?.message || String(err), 600);
      this.#finish('failed', `could not start: ${reason}`, {});
      await this.adapter.close().catch(() => {});
      throw new SessionError(502, `${r.label} could not start: ${reason}`);
    }
    if (!this.live) throw new SessionError(502, `${r.label} ended while starting: ${r.reason}`);
    r.protocol = info.protocol;
    r.nativeRef = info.nativeSessionId;
    r.agent = info.agent;
    r.model = info.model || r.model || '';
    r.agentMode = info.modeId || '';
    this.features = info.features || {};
    this.#readSettings();
    this.state = 'idle';
    r.state = 'idle';
    this.transcript.write({ id: 'session', state: 'started', protocol: r.protocol, agent: r.agent, model: r.model,
      officeTools: !!this.features.officeTools, nativeSandbox: !!this.features.nativeSandbox });
    this.#agent({ model: r.model, status: 'thinking', turn: 'idle' });
    this.#save();
    this.#next();
    return this;
  }

  /* ---- model, effort, the agent's own mode, how freely it acts ----------------- */

  // What the agent offers and runs with, in its own words (adapter.settings()), cut to what is safe to show.
  #readSettings() {
    let now = {};
    try { now = this.adapter.settings() || {}; } catch { now = {}; }
    const list = (v, max) => (Array.isArray(v) ? v : []).filter((x) => x && typeof x.id === 'string' && x.id).slice(0, max)
      .map((x) => ({ id: x.id.slice(0, 200), name: line(x.name, 80) || x.id.slice(0, 80) }));
    this.offer = { models: list(now.models, 60), modelFree: !!now.modelFree, efforts: list(now.efforts, 12), modes: list(now.modes, 24) };
    const r = this.record;
    if (typeof now.model === 'string' && now.model) r.model = now.model.slice(0, 200);
    r.effort = typeof now.effort === 'string' ? now.effort.slice(0, 40) : '';
    if (typeof now.modeId === 'string') r.agentMode = now.modeId.slice(0, 200);
    this.emit('offer', this.offer);
  }

  /**
   * Change something about a running session. Every one of these is only what the agent itself offers
   * (`controls` says which, with the options): what it cannot do is refused, in words, rather than pretended.
   * @param {'model'|'effort'|'agentMode'|'mode'} name   `mode` is the office's ask/edits/full; `agentMode` is the agent's own
   * @param {string} value
   * @param {{by?:string}} [who]
   */
  async set(name, value, who = {}) {
    if (!this.live) throw new SessionError(409, 'this session has ended');
    const control = SETTINGS[name] ? this.#controls()[name] : null;
    if (!control) throw new SessionError(400, `a session has no setting called “${line(name, 40)}”`);
    const word = SETTINGS[name].word;
    const v = typeof value === 'string' ? value.trim().slice(0, 200) : '';
    if (!v) throw new SessionError(400, `${word}: say which`);
    if (!control.available) throw new SessionError(409, control.fixed ? `this agent's ${word} is ${control.fixed}` : `this agent offers no choice of ${word}`);
    if (!control.options.includes(v) && !control.free) throw new SessionError(400, `${word} must be one of ${control.options.join(', ')}`);
    if (v === control.value) return { changed: false };
    const by = line(who.by, 60) || 'the human';
    const r = this.record;
    const act = this.adapter[SETTINGS[name].call];
    // The office's own mode needs no agent to change (it decides how requests are answered) — unless the agent
    // enforces something of its own by it, in which case the agent is told first, and a refusal changes nothing.
    if (name !== 'mode' || typeof act === 'function') {
      this.setting = { name, value: v };
      try { await act.call(this.adapter, v); }
      catch (err) { throw new SessionError(502, `${r.label} did not take that: ${cleanText(err?.message || String(err), 300)}`); }
      finally { this.setting = null; }
      if (!this.live) throw new SessionError(409, 'this session has ended');
    }
    if (name === 'mode') r.mode = v; else this.#readSettings();
    // Said where the work is, by whom, and from when: a model that changed between two turns is part of the record.
    const later = control.applies === 'next-turn' ? (this.turn ? ' It applies from the next turn.' : '') : '';
    this.#note('info', `${SETTINGS[name].said} set to “${control.labels?.[v] && name !== 'mode' ? control.labels[v] : v}” by ${by}.${later}`);
    this.transcript.write({ id: 'session', model: r.model, mode: r.mode, modeLabel: MODE_LABEL[r.mode] });
    if (name === 'model') this.#agent({ model: r.model });
    this.#save();
    return { changed: true };
  }

  /* ---- turns -------------------------------------------------------------- */

  /**
   * Give the session a turn. It starts at once when the agent is idle and waits
   * its turn otherwise; a human's message goes ahead of anything automatic.
   * @param {string} promptText
   * @param {{origin?:'human'|'wake'|'delegation'|'handoff', by?:string, from?:string, hop?:number,
   *          display?:string, delegationId?:string, mail?:string[], onDropped?:(why:string)=>void}} [meta]
   */
  send(promptText, meta = {}) {
    if (!this.live) throw new SessionError(409, 'this session has ended');
    const body = typeof promptText === 'string' ? promptText.replace(/\u0000/g, '') : '';
    if (!body.trim()) throw new SessionError(400, 'a turn needs some text');
    if (body.length > MAX_PROMPT_CHARS) throw new SessionError(413, `a turn is at most ${MAX_PROMPT_CHARS} characters`);
    const item = { text: body, origin: meta.origin || 'human', by: meta.by || null, from: meta.from || null,
      hop: Number.isFinite(meta.hop) ? meta.hop : 0, display: meta.display, delegationId: meta.delegationId || null,
      mail: meta.mail || null, onDropped: meta.onDropped || null, queuedAt: Date.now() };
    // Context a person carried over from another session goes in front of the first thing they say here. What
    // is shown as their turn is what they typed; the exact words handed over are the `handoff` entry above it.
    if (this.carried && item.origin === 'human') {
      item.display = item.display ?? body;
      item.text = `${this.carried}\n\n${body}`;
      this.carried = null;
    }
    if (this.state === 'idle' && !this.turn && !this.queue.length) {
      this.#begin(item);
      return { queued: false, turn: this.turnCount };
    }
    if (this.queue.length >= this.cfg.maxQueuedTurns) throw new SessionError(429, 'too many turns are already waiting for this agent');
    if (item.origin === 'human') {
      const firstAutomatic = this.queue.findIndex((q) => q.origin !== 'human');
      if (firstAutomatic === -1) this.queue.push(item); else this.queue.splice(firstAutomatic, 0, item);
    } else this.queue.push(item);
    this.#save();
    return { queued: true, position: this.queue.indexOf(item) + 1 };
  }

  /** Background for this session's first turn from a person: a handoff built from another session's record. */
  carry(handoffText) { this.carried = typeof handoffText === 'string' && handoffText ? handoffText : null; }

  #next() {
    if (this.state !== 'idle' || this.turn || !this.queue.length) return;
    this.#begin(this.queue.shift());
  }

  // ACP has no system prompt, so what an agent needs to know about where it is
  // rides on its first turn, clearly fenced off from the request itself.
  #frame(item) {
    if (this.turnCount !== 1 || this.spec.preamble === false || item.text.trimStart().startsWith('/')) return item.text;
    const a = this.ctx.agents.get(this.id);
    const tools = this.features.officeTools
      ? 'You have office tools (the MCP server "office": office_inbox, office_post, office_dm, office_delegate, office_tasks and more).'
      : `Reach the office from a shell with: node ${path.join(this.ctx.cfg.root, 'office.mjs')} <verb> (try "help").`;
    const preamble = `<the_office>\nYou are working in The Office, a shared workspace for coding agents from several providers and the human who directs them. `
      + `Here you are "${a?.name || this.record.name || 'an agent'}" (agent id ${this.id}). ${tools} `
      + `Ordinary work needs none of that; use it when you need a teammate or the human. `
      + `This note is context from the office, not part of the request.\n</the_office>`;
    // Nothing the office puts in front of an agent is hidden: the exact words are on the session's record.
    this.transcript.write({ id: 'session', preamble });
    return `${preamble}\n\n<request>\n${item.text}\n</request>`;
  }

  #begin(item) {
    this.turnCount += 1;
    const n = this.turnCount;
    const turn = { n, id: `turn-${n}`, origin: item.origin, by: item.by, hop: item.hop, startedAt: Date.now(),
      text: '', delegationId: item.delegationId, tools: 0 };
    this.turn = turn;
    this.state = 'running';
    this.record.state = 'running';
    this.record.turns = n;
    this.transcript.write({ id: turn.id, kind: 'turn', n, state: 'running', origin: item.origin,
      ...(item.by ? { by: item.by } : {}), ...(item.from ? { from: item.from } : {}), ...(item.hop ? { hop: item.hop } : {}),
      ...(item.delegationId ? { delegationId: item.delegationId } : {}), ...(item.mail ? { mail: item.mail } : {}),
      automatic: item.origin !== 'human' });
    this.transcript.write({ id: `${turn.id}:user`, kind: 'user', turn: n, origin: item.origin,
      ...(item.from ? { from: item.from } : {}), text: cleanText(item.display ?? item.text, 16_000) });
    this.#agent({ status: 'thinking', turn: 'active', tool: '', blockKind: null, note: '', subagents: 0 });
    this.#save();
    this.emit('turn-started', turn);
    // A listener may set `turn.hold` — a promise that never rejects and that it bounds itself — to keep
    // the prompt back for a moment: the office snapshots the working tree before the agent can change it
    // (checkpoints.mjs). A turn stopped, or a session ended, in that moment is closed without being sent.
    const go = () => {
      if (this.turn !== turn) return;
      turn.hold = null;
      if (turn.stopRequestedBy || !this.live) { this.#turnEnded({ status: 'interrupted' }); return; }
      try {
        this.adapter.prompt(this.#frame(item));
      } catch (err) {
        this.#turnEnded({ status: 'failed', error: cleanText(err?.message || String(err), 400) });
      }
    };
    if (!turn.hold) go();
    else turn.hold.then(go).catch((err) => this.ctx.log.warn(`[harness] ${this.id} could not begin turn ${n}: ${err?.stack || err}`));
  }

  /** Stop the turn in flight. Queued turns are dropped too: a stop that restarts itself is not a stop. */
  interrupt(by = 'the human') {
    const dropped = this.queue.splice(0);
    for (const item of dropped) { try { item.onDropped?.('the session was stopped'); } catch { /* callback errors stay theirs */ } }
    if (!this.turn) {
      if (dropped.length) this.#note('info', `Stopped by ${by}: ${dropped.length} waiting turn(s) dropped.`);
      return { interrupted: false, dropped: dropped.length };
    }
    this.#note('info', `Stop requested by ${by}${dropped.length ? `; ${dropped.length} waiting turn(s) dropped` : ''}.`);
    this.turn.stopRequestedBy = by;
    const sent = this.adapter.cancel() || !!this.turn.hold;       // still held back: it will now never be sent
    return { interrupted: sent, dropped: dropped.length };
  }

  /** Stop one delegated task: its turn if it is running, its place in the queue if it is waiting. */
  cancelDelegation(delegationId, by = 'the delegator') {
    const before = this.queue.length;
    this.queue = this.queue.filter((item) => item.delegationId !== delegationId);
    if (this.turn?.delegationId === delegationId) {
      this.#note('info', `This task was cancelled by ${by}.`);
      this.turn.stopRequestedBy = by;
      return this.adapter.cancel();
    }
    return before !== this.queue.length;
  }

  /* ---- the event stream --------------------------------------------------- */

  #on(ev) {
    if (!this.live && ev.type !== 'exit') return;        // nothing is recorded after the books are closed
    switch (ev.type) {
      case 'message.delta': this.#streamText('message', ev.text); break;
      case 'thought.delta': this.#streamText('thought', ev.text); break;
      case 'message.break': this.#closeStream(); break;
      case 'tool': this.#tool(ev); break;
      case 'plan':
        this.transcript.write({ id: 'plan', kind: 'plan', turn: this.turn?.n, entries: ev.entries || [], ...(ev.note ? { note: ev.note } : {}) });
        break;
      case 'usage': this.#usage(ev); break;
      case 'limits': this.#limits(ev); break;
      case 'mode':
        // An agent told to change its mode often says so again itself, a moment later: what is already known is not news.
        if (ev.modeId === this.record.agentMode) break;
        this.record.agentMode = ev.modeId;
        // When a person asked for it, set() says so; this line is for a change the agent made by itself.
        if (!(this.setting?.name === 'agentMode' && this.setting.value === ev.modeId)) this.#note('info', `The agent switched to its “${ev.modeId}” mode.`);
        this.#save();
        break;
      case 'settings': {
        const had = this.record.model;
        this.#readSettings();
        if (this.record.model !== had) this.#agent({ model: this.record.model });      // its desk shows what it now runs on
        this.#save();
        break;
      }
      case 'access':
        // The agent's own account of how freely it runs is not what the office asked for. Its account is the
        // true one, so that is what is shown — and the difference is said out loud.
        if (!MODES.includes(ev.mode) || ev.mode === this.record.mode) break;
        this.#note('warn', `${this.record.label} reports that it ${MODE_LABEL[ev.mode]} (“${ev.mode}”), not “${line(ev.asked, 20) || this.record.mode}” as it was asked. The office shows what it reports.`);
        this.record.mode = ev.mode;
        this.transcript.write({ id: 'session', mode: ev.mode, modeLabel: MODE_LABEL[ev.mode] });
        this.#save();
        break;
      case 'info': this.record.title = ev.title; this.#save(); break;
      case 'notice': this.#note(ev.level || 'info', ev.text); break;
      case 'permission': this.#permission(ev); break;
      case 'question': this.#question(ev); break;
      case 'permission.gone': this.#requestGone(ev.requestId, ev.reason); break;
      case 'turn.ended': this.#turnEnded(ev); break;
      case 'exit': this.#exited(ev); break;
      default: break;
    }
  }

  #streamText(kind, chunk) {
    if (!this.turn || typeof chunk !== 'string' || !chunk) return;
    if (this.stream && this.stream.kind !== kind) this.#closeStream();
    if (!this.stream) this.stream = { kind, id: `${kind === 'message' ? 'm' : 'r'}${++this.itemSeq}`, text: '', full: false, timer: null };
    const s = this.stream;
    const max = kind === 'message' ? MAX_MESSAGE_CHARS : MAX_THOUGHT_CHARS;
    if (!s.full) {
      s.text += chunk;
      if (s.text.length > max) { s.text = s.text.slice(0, max) + '\n…(the rest is not kept in the transcript)'; s.full = true; }
    }
    if (!s.timer) {
      s.timer = setTimeout(() => { s.timer = null; this.#flushStream(false); }, STREAM_FLUSH_MS);
      if (typeof s.timer.unref === 'function') s.timer.unref();
    }
  }

  #flushStream(final) {
    const s = this.stream;
    if (!s) return;
    this.transcript.write({ id: s.id, kind: s.kind, turn: this.turn?.n, text: cleanText(s.text, MAX_MESSAGE_CHARS + 200),
      ...(final ? { streaming: false } : { streaming: true }) }, { persist: final });
  }

  #closeStream() {
    const s = this.stream;
    if (!s) return;
    if (s.timer) clearTimeout(s.timer);
    this.#flushStream(true);
    if (s.kind === 'message' && this.turn && s.text.trim()) this.turn.text = s.text;   // the last reply of a turn is its result
    this.stream = null;
  }

  #tool(ev) {
    this.#closeStream();
    const id = `tool:${ev.id}`;
    const known = this.transcript.get(id);
    const label = TOOL_LABEL[ev.kind] || line(ev.name, 40) || 'Tool';
    const done = ev.status === 'completed' || ev.status === 'failed';
    this.transcript.write({ id, kind: 'tool', turn: this.turn?.n ?? this.lastTurn?.n, toolKind: ev.kind, name: label,
      title: ev.title, status: ev.status, ...(ev.command ? { command: ev.command } : {}),
      ...(ev.paths?.length ? { paths: ev.paths } : {}), ...(Number.isInteger(ev.exitCode) ? { exitCode: ev.exitCode } : {}),
      ...(this.cfg.toolOutput && ev.output ? { output: ev.output } : {}) },
    { persist: !known || done || known.status !== ev.status });
    // Tell the rest of the office which files this agent is touching (the workspace layer listens).
    const fileKind = FILE_KIND[ev.kind];
    if (fileKind) {
      for (const p of ev.paths || []) {
        const key = `${fileKind}:${p}`;
        if (this.filesSeen.has(key)) continue;
        this.filesSeen.add(key);
        if (this.filesSeen.size > 2000) this.filesSeen.clear();
        // In-process listeners get the real path; "~" is only how the home folder is written where people read it.
        this.ctx.bus.local({ type: 'agent:file', id: this.id, path: expandHome(p), kind: fileKind, tool: label });
      }
    }
    if (!this.turn || this.waiting) return;
    const a = this.ctx.agents.get(this.id);
    if (!known) this.turn.tools += 1;
    this.#agent({ status: 'working', tool: label, turn: 'active', toolCount: (a?.toolCount || 0) + (known ? 0 : 1) }, { settle: true });
  }

  #usage(ev) {
    this.usage = { ...(this.usage || {}), ...(ev.used !== undefined ? { used: ev.used } : {}),
      ...(ev.size !== undefined ? { size: ev.size } : {}), ...(ev.cost ? { cost: ev.cost } : {}) };
    this.transcript.write({ id: 'usage', kind: 'usage', ...this.usage }, { persist: false });
    if (this.usage.used >= 0 && this.usage.size > 0) {
      this.#agent({ contextPct: Math.max(0, Math.min(100, Math.round((this.usage.used / this.usage.size) * 100))) });
    }
  }

  // What the provider says is left of the operator's allowance. The office never
  // asks a provider's API for this itself (it holds no credentials): it passes on
  // what the agent's own CLI reports, for whoever keeps the tally (ctx.usage).
  #limits(ev) {
    const windows = (Array.isArray(ev.windows) ? ev.windows : []).map(limitWindow).filter(Boolean).slice(0, 8);
    if (!windows.length) return;
    const plan = line(typeof ev.plan === 'string' ? ev.plan : '', 40);
    this.limits = { ...(plan ? { plan } : {}), windows, at: Date.now() };
    // Each report is the whole picture as the adapter knows it (it has merged the provider's partial updates).
    this.ctx.bus.local({ type: 'usage:report', report: { provider: this.record.provider, ...(plan ? { plan } : {}),
      source: 'driven', agentId: this.id, replace: true, windows } });
    this.#save();
  }

  /* ---- permission requests and questions ----------------------------------- */

  #requestView(requestId, pending) {
    const { ev, category, choices } = pending;
    return {
      id: requestId, sessionId: this.id, kind: pending.kind, pending: true, category,
      // What is being asked, as plain fields: which tool, and the command or the files it concerns.
      tool: pending.kind === 'question' ? '' : (TOOL_LABEL[ev.kind] || line(ev.name, 40) || 'Tool'), toolKind: ev.kind || '',
      title: ev.title || '', command: ev.command || '', paths: ev.paths || [], detail: ev.detail || '',
      choices: choices.map((c) => ({ action: c.action, label: c.label, ...(c.scope ? { scope: c.scope } : {}) })),
      // The agent's own answers, verbatim, for anyone who wants to pick one by id.
      options: (ev.options || []).map((o) => ({ id: o.id, name: o.name, kind: o.kind })),
      ...(ev.questions ? { questions: ev.questions } : {}),
    };
  }

  #block(message, blockKind) {
    this.#agent({ status: 'blocked', blockKind, note: cleanText(message, 400), tool: '' });
    this.#save();
    this.emit('waiting');
  }

  #permission(ev) {
    const category = categoryOf(ev);
    // Standing permission for files stops at the edge of this session's folder.
    const inside = insideFolder(this.record.cwd, ev.paths);
    // A request its agent marks `manual` is one the agent itself insists a person sees (a safety check of its
    // own, a rule of the operator's that says "ask"): no mode and no session grant answers it, and it is never
    // the start of a grant.
    const choices = choicesFor(ev.options, category, { nativeSessionAllow: !!this.features.exactSessionAllow, inside })
      .filter((c) => !(ev.manual && c.action === 'always'));
    const entry = { id: `perm:${ev.requestId}`, kind: 'permission', turn: this.turn?.n, category, title: ev.title,
      ...(ev.command ? { command: ev.command } : {}), ...(ev.paths?.length ? { paths: ev.paths } : {}),
      ...(ev.detail ? { detail: ev.detail } : {}) };
    const allow = choices.find((c) => c.action === 'once');
    const standing = allow && !ev.manual ? standingAnswer(this.mode, category, this.grants, { inside }) : '';
    if (standing && this.adapter.answer(ev.requestId, { optionId: allow.optionId })) {
      // Answered by policy, not by a person — and written down so that is never a secret.
      this.transcript.write({ ...entry, state: 'auto-allowed', reason: standing });
      return;
    }
    this.#closeStream();
    const pending = { ev, category, choices, kind: 'permission', promptId: null };
    this.requests.set(ev.requestId, pending);
    this.transcript.write({ ...entry, state: 'asked' });
    const message = describeRequest(ev);
    const prompt = this.ctx.prompts.openRequest(this.id, { kind: 'permission', message, request: this.#requestView(ev.requestId, pending) });
    pending.promptId = prompt?.id || null;
    this.#block(message, 'permission');
  }

  #question(ev) {
    const pending = { ev, category: 'question', choices: [], kind: 'question', promptId: null };
    this.requests.set(ev.requestId, pending);
    const message = ev.questions.map((q) => [q.header ? `${q.header}: ${q.text}` : q.text,
      q.options.length ? `(${q.options.join(' / ')})` : ''].filter(Boolean).join(' ')).join('\n')
      + (ev.questions.length > 1 ? '\n(Answer each on its own line, in order.)' : '');
    this.transcript.write({ id: `perm:${ev.requestId}`, kind: 'question', turn: this.turn?.n, state: 'asked', text: cleanText(message, 2000) });
    const prompt = this.ctx.prompts.openRequest(this.id, { kind: 'question', message, request: this.#requestView(ev.requestId, pending) });
    pending.promptId = prompt?.id || null;
    this.#block(message, 'question');
  }

  #unblock() {
    if (this.waiting || !this.turn || !this.live) return;
    this.#agent({ status: 'working', blockKind: null, note: '', turn: 'active' }, { settle: true });
    this.#save();
  }

  #requestGone(requestId, reason) {
    const pending = this.requests.get(requestId);
    if (!pending) return;
    this.requests.delete(requestId);
    this.transcript.write({ id: `perm:${requestId}`, state: 'withdrawn', reason: line(reason, 200) });
    if (pending.promptId) this.ctx.prompts.resolveRequest(pending.promptId, `The agent stopped waiting (${line(reason, 120)}).`);
    this.#unblock();
  }

  /**
   * Answer a request the agent is waiting on.
   * @param {string} requestId
   * @param {{action?:'once'|'always'|'reject', optionId?:string, text?:string}} body
   * @param {{by?:string, via?:string}} who
   */
  answer(requestId, body = {}, who = {}) {
    const pending = this.requests.get(requestId);
    if (!pending) return { error: 'this request is no longer waiting for an answer', status: 409 };
    const by = line(who.by, 60) || 'the human';
    const note = typeof body.text === 'string' ? body.text.trim() : '';
    let state, optionLabel = '', decision, grant = null;

    if (pending.kind === 'question') {
      if (!note && body.action !== 'reject') return { error: 'answer with some text (or reject to decline)', status: 400 };
      const questions = pending.ev.questions;
      const lines = note.split('\n').map((l) => l.trim()).filter(Boolean);
      const answers = Object.fromEntries(questions.map((q, i) => [q.id, questions.length > 1 && lines.length === questions.length ? lines[i] : note]));
      decision = note ? { answers } : { cancelled: true };
      state = note ? 'answered' : 'rejected';
    } else if (typeof body.optionId === 'string' && body.optionId) {
      const option = pending.ev.options.find((o) => o.id === body.optionId);
      if (!option) return { error: 'that is not one of the answers the agent offered', status: 400 };
      decision = { optionId: option.id };
      optionLabel = option.name;
      state = option.kind.startsWith('reject') ? 'rejected' : 'allowed';
    } else {
      // A decision has to be said, never guessed: words alone ("yes", "ok then") are not an answer
      // to a permission request. With a decision, words follow as the agent's next turn.
      const choice = pending.choices.find((c) => c.action === body.action);
      if (!choice) {
        return { error: `this request needs a decision: send action ${pending.choices.map((c) => c.action).join(', ')} (text is optional and follows as the agent's next turn)`,
          status: 400, actions: pending.choices.map((c) => c.action) };
      }
      const action = choice.action;
      decision = choice.optionId ? { optionId: choice.optionId } : { cancelled: true };
      state = action === 'once' ? 'allowed' : action === 'always' ? 'allowed-session' : 'rejected';
      if (action === 'always') grant = pending.category;
    }
    if (!this.adapter.answer(requestId, decision)) return { error: 'the agent is no longer waiting for this answer', status: 409 };
    this.requests.delete(requestId);
    if (grant) this.grants.add(grant);
    this.transcript.write({ id: `perm:${requestId}`, state, by, ...(who.via ? { via: who.via } : {}),
      ...(optionLabel ? { option: optionLabel } : {}), ...(grant ? { grant } : {}),
      ...(pending.kind === 'question' && note ? { answer: cleanText(note, 2000) } : {}) });
    const said = { allowed: 'Allowed once', 'allowed-session': `Allowed for this session (${pending.category})`,
      rejected: 'Rejected', answered: 'Answered' }[state];
    if (pending.promptId) this.ctx.prompts.resolveRequest(pending.promptId, `${said} by ${by}.`);
    this.#unblock();
    let followUp = null;
    if (note && pending.kind !== 'question') {
      // There is no channel for words in a permission answer, so they follow as the next turn.
      try { followUp = this.send(note, { origin: 'human', by }); } catch { followUp = null; }
    }
    this.#save();
    return { ok: true, state, sessionGrant: grant, followUp };
  }

  /* ---- endings ------------------------------------------------------------ */

  #turnEnded(ev) {
    this.#closeStream();
    const turn = this.turn;
    if (!turn) return;
    this.turn = null;
    const endedAt = Date.now();
    this.transcript.write({ id: turn.id, state: ev.status, endedAt, durationMs: endedAt - turn.startedAt, tools: turn.tools,
      ...(ev.stopReason ? { stopReason: ev.stopReason } : {}), ...(ev.error ? { error: ev.error } : {}),
      ...(turn.stopRequestedBy ? { stoppedBy: turn.stopRequestedBy } : {}) });
    if (ev.stopReason === 'max_tokens' || ev.stopReason === 'max_turn_requests') {
      this.#note('warn', `The agent stopped because it hit a limit (${ev.stopReason}); its work may be unfinished.`, { turn: turn.n });
    }
    if (this.usage) this.transcript.write({ id: 'usage', kind: 'usage', ...this.usage });
    this.lastTurn = { n: turn.n, status: ev.status, text: turn.text, error: ev.error || '', endedAt,
      origin: turn.origin, hop: turn.hop, delegationId: turn.delegationId,
      // Why a turn that did not finish was stopped: someone asked, or the whole session was being ended.
      stoppedBy: turn.stopRequestedBy || '', ending: this.endReason || '' };
    if (!this.live) return;
    this.state = 'idle';
    this.record.state = 'idle';
    this.#agent({ status: 'done', turn: 'idle', tool: '', subagents: 0, blockKind: null, note: '' }, { settle: true });
    this.#save();
    this.emit('turn-ended', this.lastTurn);
    setImmediate(() => this.#next());
  }

  #finish(state, reason, exit) {
    if (!this.live) return;
    this.#closeStream();
    this.state = state;
    const r = this.record;
    r.state = state;
    r.endedAt = Date.now();
    r.reason = reason;
    // The office gave it a name when it joined; a finished session is still listed, and should still be called that.
    r.name = this.ctx.agents.get(this.id)?.name || r.name || '';
    for (const [requestId, pending] of this.requests) {
      this.transcript.write({ id: `perm:${requestId}`, state: 'withdrawn', reason: 'the session ended' });
      if (pending.promptId) this.ctx.prompts.resolveRequest(pending.promptId, 'The session ended before this was answered.');
    }
    this.requests.clear();
    for (const item of this.queue.splice(0)) { try { item.onDropped?.('the session ended'); } catch { /* theirs */ } }
    this.transcript.write({ id: 'session', state, reason, endedAt: r.endedAt,
      ...(exit.code !== undefined ? { exit: { code: exit.code ?? null, signal: exit.signal ?? null } } : {}),
      ...(exit.stderr ? { stderr: exit.stderr } : {}) });
    this.#save();
    this.emit('ended', { state, reason });
    // The same door every other agent leaves by.
    this.ctx.agents.handleHook({ session_id: this.id, hook_event_name: 'SessionEnd' });
    setImmediate(() => this.transcript.close());
  }

  #exited(ev) {
    if (!this.live) return;
    if (ev.expected) this.#finish('ended', this.endReason || 'ended from the office', ev);
    else this.#finish('failed', ev.reason || 'the agent process ended unexpectedly', ev);
  }

  /** End the session and its whole process tree. */
  async end(reason = 'ended from the office') {
    if (!this.live) return;
    this.endReason = cleanText(reason, 200);
    await this.adapter.close();
    // close() reports through `exit`; make sure the books are closed even if it could not.
    this.#finish('ended', this.endReason, {});
  }

  // Everything a client can do with this session, each with the call that does
  // it and whether it applies right now — so a client needs to know nothing
  // about the adapter behind the session (that Codex's mode is fixed, say).
  #controls() {
    const at = `/api/harness/sessions/${this.id}`;
    const live = this.live, r = this.record, o = this.offer;
    // An agent whose own sandbox enforces the mode can change it only if it has a way to be told.
    const fixed = !!this.features.nativeSandbox && typeof this.adapter.setAccess !== 'function';
    const later = this.adapter.perTurn ? { applies: 'next-turn' } : {};
    // A choice among what the agent itself listed: ids in `options`, its names for them in `labels`.
    const pick = (field, value, list, call, extra = {}) => ({ method: 'PATCH', url: at, field, value: value || '',
      options: list.map((x) => x.id), labels: Object.fromEntries(list.map((x) => [x.id, x.name])),
      available: live && typeof this.adapter[call] === 'function' && (list.length > 0 || !!extra.free), ...later, ...extra });
    // What its turns changed on disk is there to read once the office has snapshots of its folder (checkpoints.mjs).
    const recorded = !!this.ctx.harness?.checkpoints?.recorded(this.id);
    return {
      transcript: { method: 'GET', url: `${at}/transcript`, query: ['after', 'limit'], watch: { type: 'transcript:watch', sessionId: this.id } },
      changes: { method: 'GET', url: `${at}/changes`, query: ['turn'], available: recorded },
      diff: { method: 'GET', url: `${at}/diff`, query: ['turn', 'path', 'from', 'to', 'context'], available: recorded },
      turn: { method: 'POST', url: `${at}/turn`, body: { text: '' }, available: live },
      interrupt: { method: 'POST', url: `${at}/interrupt`, available: live && (!!this.turn || this.queue.length > 0) },
      end: { method: 'DELETE', url: at, available: live },
      wake: { method: 'PATCH', url: at, field: 'wake', value: r.wake, options: WAKE_MODES.slice(), available: live },
      mode: { method: 'PATCH', url: at, field: 'mode', value: r.mode, options: MODES.slice(), labels: { ...MODE_LABEL }, available: live && !fixed,
        ...(fixed ? { fixed: 'set when this agent starts: its own sandbox enforces it' } : typeof this.adapter.setAccess === 'function' ? later : {}) },
      model: pick('model', r.model, o.models, 'setModel', o.modelFree ? { free: true } : {}),
      effort: pick('effort', r.effort, o.efforts, 'setEffort'),
      agentMode: pick('agentMode', r.agentMode, o.modes, 'setMode'),
      deliverMail: { method: 'POST', url: `${at}/mail`, available: live },
    };
  }

  /** What clients and teammates may know about this session. */
  pub() {
    const r = this.record;
    return {
      id: this.id, agentId: this.id, adapter: r.adapter, label: r.label, provider: r.provider, protocol: r.protocol,
      cwd: r.cwd, name: this.ctx.agents.get(this.id)?.name || r.name || '', model: r.model || '',
      mode: r.mode, modeLabel: MODE_LABEL[r.mode], agentMode: r.agentMode || '', effort: r.effort || '', wake: r.wake,
      state: this.waiting && this.state === 'running' ? 'waiting' : this.state, live: this.live,
      startedAt: r.startedAt, endedAt: r.endedAt || null, reason: r.reason || '',
      turns: this.turnCount, queued: this.queue.length,
      turn: this.turn ? { n: this.turn.n, origin: this.turn.origin, startedAt: this.turn.startedAt, hop: this.turn.hop } : null,
      pending: [...this.requests].map(([id, p]) => ({ id, promptId: p.promptId, kind: p.kind, category: p.category, title: p.ev.title || '' })),
      grants: [...this.grants], features: this.features, nativeRef: r.nativeRef || '',
      origin: r.origin || { kind: 'human' }, usage: this.usage, limits: this.limits,
      // Honest by construction: the office can grant, deny and stop only while it holds the process.
      caps: { observe: true, prompt: this.live, control: this.live, spawn: true },
      controls: this.#controls(),
    };
  }
}
