// The Office — harness: a JSON-RPC peer over a child process's stdio.
//
// Every agent the office drives speaks newline-delimited JSON on stdin/stdout:
// requests carry an id and a method, notifications a method only, responses an
// id and a result or an error. Two dialects exist in the wild: ACP writes
// `"jsonrpc":"2.0"` on every message, Codex's app-server leaves it out. This
// class is both ends of that conversation — we ask the agent things and the
// agent asks us things (a permission request is a request FROM the agent that
// we answer later, when a human has decided).
//
// Everything that arrives here is untrusted: a line is bounded before it is
// parsed, shapes are checked before they are routed, and nothing an agent sends
// can make the daemon throw.
import { EventEmitter } from 'node:events';
import { StringDecoder } from 'node:string_decoder';

export const RPC = Object.freeze({
  PARSE_ERROR: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602, INTERNAL: -32603,
  AUTH_REQUIRED: -32000,           // ACP: sign in before this operation
  CANCELLED: -32800,
});

/** An error the other side returned for one of our requests. */
export class RpcError extends Error {
  constructor(code, message, data, method) {
    super(String(message || 'request failed'));
    this.name = 'RpcError';
    this.code = Number.isFinite(code) ? code : RPC.INTERNAL;
    this.data = data;
    this.method = method || '';
  }
}

/** The connection is gone (process exited, stream broke, or we closed it). */
export class RpcClosedError extends Error {
  constructor(message, cause) {
    super(message || 'the agent connection is closed');
    this.name = 'RpcClosedError';
    this.cause = cause;
  }
}

const isId = (v) => (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 256);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const DEFAULTS = {
  maxLineBytes: 16 * 1024 * 1024,   // one frame; a tool result can be large, a runaway line cannot
  maxNoiseLines: 40,                // stray log lines on stdout we put up with before giving up
  maxInflight: 32,                  // requests from the agent we will hold open at once
};

export class RpcPeer extends EventEmitter {
  /**
   * @param {{readable:import('stream').Readable, writable:import('stream').Writable,
   *          dialect?:'jsonrpc2'|'bare', maxLineBytes?:number,
   *          onRequest?:(method:string, params:any, ctx:{id:string|number})=>any,
   *          onNotification?:(method:string, params:any)=>void,
   *          trace?:(direction:'in'|'out', message:object)=>void}} opt
   */
  constructor(opt) {
    super();
    this.dialect = opt.dialect === 'bare' ? 'bare' : 'jsonrpc2';
    this.maxLineBytes = opt.maxLineBytes || DEFAULTS.maxLineBytes;
    this.onRequest = opt.onRequest || null;
    this.onNotification = opt.onNotification || null;
    this.trace = opt.trace || null;
    this.readable = opt.readable;
    this.writable = opt.writable;
    this.closed = false;
    this.closeReason = null;
    this.stats = { in: 0, out: 0, noise: 0, unroutable: 0 };
    this._nextId = 1;                // small integers: some SDKs decode ids as int32
    this._pending = new Map();       // id → { resolve, reject, method, timer }
    this._inflight = new Set();      // ids of requests from the agent we have not answered
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
    const text = typeof chunk === 'string' ? chunk : this._decoder.write(chunk);
    let start = 0;
    while (start < text.length && !this.closed) {
      const nl = text.indexOf('\n', start);
      const piece = text.slice(start, nl === -1 ? text.length : nl);
      this._bytes += Buffer.byteLength(piece);
      if (this._bytes > this.maxLineBytes) {
        this._parts = [];
        this.#fatal(`the agent sent a message larger than ${this.maxLineBytes} bytes`);
        return;
      }
      this._parts.push(piece);
      if (nl === -1) break;
      const line = this._parts.join('');
      this._parts = [];
      this._bytes = 0;
      this.#line(line);
      start = nl + 1;
    }
  }

  #flushTail() {
    // A final line without a newline: honour it if it parses, otherwise the
    // exit status explains a crash better than a torn frame would.
    const tail = (this._parts.join('') + this._decoder.end()).trim();
    this._parts = [];
    if (!tail || this.closed) return;
    try { this.#route(JSON.parse(tail)); } catch { /* torn final frame */ }
  }

  #line(raw) {
    const line = raw.replace(/\r$/, '').trim();
    if (!line) return;
    if (line[0] !== '{' && line[0] !== '[') {
      // Not protocol at all — a banner or a stray log line on stdout. Tolerated
      // in small numbers; a stream of it means this is not the program we expect.
      this.stats.noise += 1;
      this.emit('noise', line.slice(0, 400));
      if (this.stats.noise > DEFAULTS.maxNoiseLines) this.#fatal('the agent is writing something other than its protocol to stdout');
      return;
    }
    let message;
    try { message = JSON.parse(line); }
    catch {
      // It looked like a frame and was not one. Anything after this could be a
      // reply we are waiting for, so the conversation cannot be trusted further.
      this.#fatal('the agent sent a malformed protocol message');
      return;
    }
    if (Array.isArray(message)) { for (const one of message.slice(0, 64)) this.#route(one); return; }
    this.#route(message);
  }

  #route(message) {
    if (!isObject(message)) { this.stats.unroutable += 1; return; }
    this.stats.in += 1;
    if (this.trace) { try { this.trace('in', message); } catch { /* tracing never breaks the session */ } }
    const hasMethod = typeof message.method === 'string' && message.method.length > 0 && message.method.length <= 200;
    const hasId = message.id !== undefined && message.id !== null;
    if (hasMethod && hasId) {
      if (!isId(message.id)) { this.stats.unroutable += 1; return; }
      this.#incomingRequest(message.id, message.method, message.params);
      return;
    }
    if (hasMethod) {
      if (!this.onNotification) return;
      try { this.onNotification(message.method, message.params); }
      catch (err) { this.emit('handler-error', err, message.method); }
      return;
    }
    if (hasId && isId(message.id) && ('result' in message || 'error' in message)) {
      const entry = this._pending.get(String(message.id));
      if (!entry) { this.stats.unroutable += 1; return; }   // a reply to nothing we asked
      this._pending.delete(String(message.id));
      if (entry.timer) clearTimeout(entry.timer);
      if (isObject(message.error)) {
        entry.reject(new RpcError(Number(message.error.code), String(message.error.message || '').slice(0, 2000),
          message.error.data, entry.method));
      } else if ('error' in message && message.error !== null && message.error !== undefined) {
        entry.reject(new RpcError(RPC.INTERNAL, String(message.error).slice(0, 2000), undefined, entry.method));
      } else {
        entry.resolve(message.result);
      }
      return;
    }
    this.stats.unroutable += 1;
  }

  #incomingRequest(id, method, params) {
    if (this._inflight.size >= DEFAULTS.maxInflight) {
      this.respondError(id, RPC.INTERNAL, 'too many requests are already waiting on the client');
      return;
    }
    if (!this.onRequest) { this.respondError(id, RPC.METHOD_NOT_FOUND, `method not found: ${method}`); return; }
    this._inflight.add(id);
    let outcome;
    try { outcome = Promise.resolve(this.onRequest(method, params, { id })); }
    catch (err) { outcome = Promise.reject(err); }
    outcome.then(
      (result) => { if (this._inflight.delete(id)) this.#send({ id, result: result === undefined ? {} : result }); },
      (err) => {
        if (!this._inflight.delete(id)) return;
        if (err instanceof RpcError) this.respondError(id, err.code, err.message, err.data);
        else { this.emit('handler-error', err, method); this.respondError(id, RPC.INTERNAL, 'the client failed to handle this request'); }
      },
    );
  }

  /* ---- writing ----------------------------------------------------------- */

  #send(message) {
    if (this.closed) return false;
    const frame = this.dialect === 'jsonrpc2' ? { jsonrpc: '2.0', ...message } : message;
    let text;
    try { text = JSON.stringify(frame); } catch { return false; }
    this.stats.out += 1;
    if (this.trace) { try { this.trace('out', frame); } catch { /* ignore */ } }
    try { this.writable.write(text + '\n'); return true; }
    catch (err) { this.close(new RpcClosedError('writing to the agent failed', err)); return false; }
  }

  /** Ask the agent something. Rejects with RpcError (it said no) or RpcClosedError. */
  request(method, params, opt = {}) {
    if (this.closed) return Promise.reject(this.closeReason || new RpcClosedError());
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      const entry = { resolve, reject, method, timer: null };
      if (opt.timeoutMs > 0) {
        entry.timer = setTimeout(() => {
          if (!this._pending.delete(String(id))) return;
          reject(new RpcClosedError(`the agent did not answer ${method} within ${Math.round(opt.timeoutMs / 1000)}s`));
        }, opt.timeoutMs);
        if (typeof entry.timer.unref === 'function') entry.timer.unref();
      }
      this._pending.set(String(id), entry);
      if (!this.#send({ id, method, ...(params === undefined ? {} : { params }) })) {
        this._pending.delete(String(id));
        if (entry.timer) clearTimeout(entry.timer);
        reject(this.closeReason || new RpcClosedError());
      }
    });
  }

  /** A notification has no id: an agent that sees one would treat it as a request and wait forever. */
  notify(method, params) {
    return this.#send({ method, ...(params === undefined ? {} : { params }) });
  }

  respondError(id, code, message, data) {
    this._inflight.delete(id);
    return this.#send({ id, error: { code, message: String(message || 'error'), ...(data === undefined ? {} : { data }) } });
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
