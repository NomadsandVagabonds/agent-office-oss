// The Office — harness: what every provider adapter has in common.
//
// An adapter owns one agent process and one conversation with it. The parts
// that do not depend on the protocol live here: starting the process and
// wiring the JSON-RPC peer, explaining a failed start in words a person can
// act on, the single active turn and its stop timer, and the careful ending —
// a process that dies mid-turn must still produce a `turn.ended` and an `exit`,
// exactly once each, with nothing left waiting.
import { EventEmitter } from 'node:events';
import { RpcPeer, RpcClosedError } from './rpc.mjs';
import { spawnAgent, stderrExcerpt } from './child.mjs';
import { text } from './normalize.mjs';

export const START_TIMEOUT_MS = 45_000;
export const CANCEL_TIMEOUT_MS = 15_000;

/** Why a process ended, for a transcript: "exit code 3: Error: boom". */
export function describeExit({ code, signal, error }, stderr, protocolError) {
  if (protocolError) return protocolError;
  if (error) return error;
  const how = signal ? `was stopped (${signal})` : Number.isInteger(code) ? `exited with code ${code}` : 'ended';
  return `the agent process ${how}${stderr ? `: ${stderr}` : ''}`;
}

export class AgentAdapter extends EventEmitter {
  constructor(opt, { kind, dialect }) {
    super();
    this.opt = opt;
    this.kind = kind;
    this.dialect = dialect;
    this.proc = null;
    this.peer = null;
    this.turn = null;               // the one turn in flight: { cancelRequested, cancelTimer, … }
    this.closing = false;           // we asked for the end
    this.exited = false;            // the end has been reported
    this.protocolError = '';
    this.stopReason = '';           // why WE ended the process, when we did
    this._goneTimer = null;
  }

  /* ---- for subclasses to implement ---------------------------------------- */
  _onRequest() { throw new Error('not implemented'); }

  /**
   * What the agent itself offers and what is current — never a catalogue of our own: a model, an effort or a
   * mode is listed here only because the agent said it has it.
   *   { model, models: [{ id, name, efforts?: [{id,name}], defaultEffort? }], modelFree?,
   *     effort, efforts: [{ id, name }], modeId, modes: [{ id, name }] }
   * `modes` are the agent's OWN modes (plan, and whatever else it calls them), not the office's ask/edits/full.
   * An adapter emits `{ type: 'settings' }` whenever this has changed on the agent's say-so.
   *
   * What can be changed on a running session is whichever of these the adapter defines:
   *   setModel(id)  setEffort(id)  setMode(id)  setAccess('ask'|'edits'|'full')
   * each resolving once the agent has accepted it (or it is stored to go out with the next turn) and rejecting
   * with a sentence a person can read. One that is not defined cannot be done, and the session says so.
   */
  settings() { return { model: '', models: [], effort: '', efforts: [], modeId: '', modes: [] }; }
  _onNotification() {}
  /** Answer every request the agent is still waiting on; it will get no better answer now. */
  _settlePending() {}
  /** Close whatever a turn left open (running tools), given how the turn ended. */
  _closeOpenWork() {}

  _emit(event) { this.emit('event', event); }
  _notice(level, message) { this._emit({ type: 'notice', level, text: text(message, 600) }); }

  _spawn() {
    const { command, args = [], env, cwd } = this.opt;
    this.proc = spawnAgent({ command, args, cwd, env });
    this.peer = new RpcPeer({
      readable: this.proc.child.stdout, writable: this.proc.child.stdin, dialect: this.dialect,
      onRequest: (method, params, ctx) => this._onRequest(method, params, ctx),
      onNotification: (method, params) => this._onNotification(method, params),
      trace: this.opt.trace,
    });
    this.peer.on('close', (reason) => { if (reason?.protocol) this.protocolError = reason.message; this._gone(); });
    this.peer.on('handler-error', () => {});
    this.peer.on('noise', (sample) => { if (!this._noiseTold) { this._noiseTold = true; this._notice('warn', `The agent wrote something that is not its protocol to stdout (“${sample.slice(0, 80)}”). Ignored.`); } });
    this.proc.exited.then(() => this._gone());
  }

  /** Run the opening handshake; if the process dies during it, say why instead of "connection closed". */
  async _handshake(run) {
    try {
      return await run();
    } catch (err) {
      if (!(err instanceof RpcClosedError)) throw err;
      const status = await Promise.race([this.proc.exited, new Promise((r) => { const t = setTimeout(() => r(null), 600); t.unref?.(); })]);
      if (!status && !this.protocolError) throw err;       // still running: it simply did not answer
      throw new Error(describeExit(status || {}, stderrExcerpt(this.proc.stderr()), this.protocolError));
    }
  }

  /* ---- the active turn ---------------------------------------------------- */

  _beginTurn(extra = {}) {
    if (this.exited) throw new Error('the agent is not running');
    if (this.turn) throw new Error('a turn is already running');
    const turn = { cancelRequested: false, cancelTimer: null, ...extra };
    this.turn = turn;
    this._emit({ type: 'turn.started' });
    return turn;
  }

  _endTurn(turn, result) {
    if (this.turn !== turn) return;
    this.turn = null;
    if (turn.cancelTimer) clearTimeout(turn.cancelTimer);
    // Nothing may stay open across a turn boundary: a request nobody will answer blocks the agent forever.
    this._settlePending('the turn ended');
    this._closeOpenWork(result);
    this._emit({ type: 'turn.ended', ...result });
  }

  /** After asking the agent to stop: if it never confirms, its process is ended instead. */
  _armCancelTimer(turn, who = 'The agent') {
    turn.cancelTimer = setTimeout(() => {
      if (this.turn !== turn) return;
      this._notice('warn', `${who} did not confirm the stop; its process was ended.`);
      this.stopReason = 'it did not stop when asked, so the office ended its process';
      this.proc.kill();
    }, this.opt.cancelTimeoutMs || CANCEL_TIMEOUT_MS);
    if (typeof turn.cancelTimer.unref === 'function') turn.cancelTimer.unref();
  }

  /* ---- ending ------------------------------------------------------------- */

  _gone() {
    if (this.exited) return;
    // Wait for both halves — the stream and the process — so the last frames
    // are read and the exit status is known, but never wait long for either.
    if (!this._goneTimer) {
      this._goneTimer = setTimeout(() => this._finish({ code: null, signal: null, error: null }), 500);
      if (typeof this._goneTimer.unref === 'function') this._goneTimer.unref();
    }
    if (!this.peer.closed) return;
    Promise.race([this.proc.exited, new Promise((r) => { const t = setTimeout(() => r(null), 350); t.unref?.(); })])
      .then((status) => this._finish(status || { code: null, signal: null, error: null }));
  }

  _finish(status) {
    if (this.exited) return;
    this.exited = true;
    clearTimeout(this._goneTimer);
    if (!this.peer.closed) this.peer.close('the agent process ended');
    const stderr = stderrExcerpt(this.proc.stderr());
    const reason = this.stopReason || describeExit(status, stderr, this.protocolError);
    const turn = this.turn;
    this.turn = null;
    if (turn?.cancelTimer) clearTimeout(turn.cancelTimer);
    this._settlePending('the agent process ended');
    if (turn) {
      const stopped = this.closing || (turn.cancelRequested && !this.stopReason);
      this._closeOpenWork({ status: 'failed' });
      this._emit({ type: 'turn.ended', status: stopped ? 'interrupted' : 'failed', ...(stopped ? {} : { error: reason }) });
    }
    this._emit({ type: 'exit', code: status.code, signal: status.signal, error: status.error, stderr,
      protocolError: this.protocolError, reason, expected: this.closing });
    // A process that is still there after its stream broke is of no use to anyone.
    this.proc.kill().catch(() => {});
  }

  /** End the session: the process tree goes, and `exit` is reported. */
  async close() {
    if (!this.proc) { this.closing = true; return; }
    if (!this.closing) {
      this.closing = true;
      await this.proc.kill();
      this._gone();
    } else {
      await this.proc.exited;
    }
  }
}
