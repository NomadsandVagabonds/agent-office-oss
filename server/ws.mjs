// The Office — WebSocket hub (RFC 6455), zero dependencies.
//
// The old daemon wrote frames and ignored everything a client said. This one
// is a real endpoint: it parses masked client frames across TCP chunk
// boundaries, reassembles fragmented messages, answers ping/close, sends its
// own heartbeat so dead sockets are reaped, and drops slow consumers instead
// of buffering forever.
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const OP = { CONT: 0x0, TEXT: 0x1, BIN: 0x2, CLOSE: 0x8, PING: 0x9, PONG: 0xA };

export function acceptKey(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

/** Encode one unmasked server→client frame. */
export function encodeFrame(payload, opcode = OP.TEXT) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  const n = body.length;
  let header;
  if (n < 126) {
    header = Buffer.from([0x80 | opcode, n]);
  } else if (n < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(n, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode; header[1] = 127;
    header.writeBigUInt64BE(BigInt(n), 2);
  }
  return Buffer.concat([header, body]);
}

/**
 * Incremental frame parser. Feed it chunks; it calls back with whole frames.
 * Throws a `{code, reason}` shaped error on protocol violations.
 */
export class FrameParser {
  constructor({ maxPayload = 1 << 20, requireMask = true } = {}) {
    this.maxPayload = maxPayload;
    this.requireMask = requireMask;
    this.buf = Buffer.alloc(0);
  }

  push(chunk, onFrame) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    for (;;) {
      const frame = this.#next();
      if (!frame) return;
      onFrame(frame);
    }
  }

  #fail(code, reason) {
    const err = new Error(reason);
    err.code = code;
    throw err;
  }

  #next() {
    const buf = this.buf;
    if (buf.length < 2) return null;
    const b0 = buf[0], b1 = buf[1];
    if (b0 & 0x70) this.#fail(1002, 'reserved bits set');
    const fin = !!(b0 & 0x80);
    const opcode = b0 & 0x0f;
    const masked = !!(b1 & 0x80);
    let len = b1 & 0x7f;
    let offset = 2;
    if (len === 126) {
      if (buf.length < 4) return null;
      len = buf.readUInt16BE(2); offset = 4;
    } else if (len === 127) {
      if (buf.length < 10) return null;
      const big = buf.readBigUInt64BE(2);
      if (big > BigInt(this.maxPayload)) this.#fail(1009, 'message too big');
      len = Number(big); offset = 10;
    }
    if (len > this.maxPayload) this.#fail(1009, 'message too big');
    if (opcode >= 0x8 && (!fin || len > 125)) this.#fail(1002, 'bad control frame');
    if (this.requireMask && !masked) this.#fail(1002, 'client frames must be masked');
    const maskLen = masked ? 4 : 0;
    if (buf.length < offset + maskLen + len) return null;
    let payload = buf.subarray(offset + maskLen, offset + maskLen + len);
    if (masked) {
      const mask = buf.subarray(offset, offset + 4);
      const out = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
      payload = out;
    } else {
      payload = Buffer.from(payload);
    }
    this.buf = buf.subarray(offset + maskLen + len);
    return { fin, opcode, payload };
  }
}

let nextClientId = 1;

class WsClient extends EventEmitter {
  constructor(hub, socket, req) {
    super();
    this.hub = hub;
    this.socket = socket;
    this.id = nextClientId++;
    this.remote = socket.remoteAddress || '';
    this.url = req.url || '/';
    this.alive = true;
    this.closed = false;
    this.meta = {};
    this._parser = new FrameParser({ maxPayload: hub.maxPayload });
    this._fragments = null;
    this._fragBytes = 0;
    socket.setNoDelay(true);
    socket.setTimeout(0);
    socket.on('data', (chunk) => this.#onData(chunk));
    socket.on('close', () => this.#gone());
    socket.on('error', () => this.#gone());
  }

  #onData(chunk) {
    if (this.closed) return;
    try {
      this._parser.push(chunk, (frame) => this.#onFrame(frame));
    } catch (err) {
      this.close(err.code || 1002, err.message);
    }
  }

  #onFrame({ fin, opcode, payload }) {
    this.alive = true;
    if (opcode === OP.PING) { this.#write(encodeFrame(payload, OP.PONG)); return; }
    if (opcode === OP.PONG) return;
    if (opcode === OP.CLOSE) {
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1000;
      this.close(code === 1005 ? 1000 : code);
      return;
    }
    if (opcode === OP.BIN) { this.close(1003, 'text frames only'); return; }
    if (opcode === OP.TEXT) {
      if (this._fragments) { this.close(1002, 'unexpected new message'); return; }
      if (fin) { this.#deliver(payload); return; }
      this._fragments = [payload]; this._fragBytes = payload.length;
      return;
    }
    if (opcode === OP.CONT) {
      if (!this._fragments) { this.close(1002, 'unexpected continuation'); return; }
      this._fragments.push(payload); this._fragBytes += payload.length;
      if (this._fragBytes > this.hub.maxPayload) { this.close(1009, 'message too big'); return; }
      if (fin) {
        const whole = Buffer.concat(this._fragments);
        this._fragments = null; this._fragBytes = 0;
        this.#deliver(whole);
      }
      return;
    }
    this.close(1002, 'unknown opcode');
  }

  #deliver(buf) {
    const text = buf.toString('utf8');
    let message = null;
    try { message = JSON.parse(text); } catch { /* non-JSON text is ignored */ }
    if (message && typeof message === 'object') {
      this.emit('message', message);
      this.hub.emit('message', this, message);
    }
  }

  #write(frame) {
    if (this.closed || this.socket.destroyed) return false;
    // A client that cannot keep up is cut loose rather than buffered forever.
    if (this.socket.writableLength > this.hub.maxBuffered) {
      this.terminate();
      return false;
    }
    try { this.socket.write(frame); return true; }
    catch { this.terminate(); return false; }
  }

  send(message) {
    return this.#write(encodeFrame(typeof message === 'string'
      ? message : JSON.stringify(message)));
  }

  sendFrame(frame) { return this.#write(frame); }

  ping() { return this.#write(encodeFrame('', OP.PING)); }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    const body = Buffer.alloc(2 + Buffer.byteLength(reason));
    body.writeUInt16BE(code, 0);
    body.write(reason, 2);
    try { this.socket.write(encodeFrame(body.subarray(0, 125), OP.CLOSE)); } catch {}
    this.closed = true;
    try { this.socket.end(); } catch {}
    this.#gone();
  }

  terminate() {
    this.closed = true;
    try { this.socket.destroy(); } catch {}
    this.#gone();
  }

  #gone() {
    if (this._goneEmitted) return;
    this._goneEmitted = true;
    this.closed = true;
    this.hub.clients.delete(this);
    this.emit('close');
    this.hub.emit('disconnect', this);
  }
}

export class WsHub extends EventEmitter {
  /**
   * @param {{maxPayload?:number, maxBuffered?:number, heartbeatMs?:number,
   *          verify?:(req:import('http').IncomingMessage)=>boolean}} [opt]
   */
  constructor(opt = {}) {
    super();
    this.maxPayload = opt.maxPayload ?? (1 << 20);
    this.maxBuffered = opt.maxBuffered ?? (8 << 20);
    this.verify = opt.verify || (() => true);
    /** @type {Set<WsClient>} */
    this.clients = new Set();
    const beat = opt.heartbeatMs ?? 25_000;
    this._beat = beat > 0 ? setInterval(() => this.#heartbeat(), beat) : null;
    if (this._beat && typeof this._beat.unref === 'function') this._beat.unref();
  }

  #heartbeat() {
    for (const client of this.clients) {
      if (!client.alive) { client.terminate(); continue; }
      client.alive = false;
      client.ping();
    }
  }

  /** Complete the HTTP upgrade; returns the client or null if refused. */
  handleUpgrade(req, socket, head) {
    const refuse = (status, text) => {
      try { socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); }
      catch {}
      return null;
    };
    const key = req.headers['sec-websocket-key'];
    const upgrade = String(req.headers.upgrade || '').toLowerCase();
    if (req.method !== 'GET' || upgrade !== 'websocket' || !key) return refuse(400, 'Bad Request');
    if (String(req.headers['sec-websocket-version'] || '') !== '13') {
      try {
        socket.end('HTTP/1.1 426 Upgrade Required\r\nSec-WebSocket-Version: 13\r\n'
          + 'Connection: close\r\nContent-Length: 0\r\n\r\n');
      } catch {}
      return null;
    }
    if (!this.verify(req)) return refuse(403, 'Forbidden');
    socket.write('HTTP/1.1 101 Switching Protocols\r\n'
      + 'Upgrade: websocket\r\nConnection: Upgrade\r\n'
      + `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`);
    const client = new WsClient(this, socket, req);
    this.clients.add(client);
    this.emit('connect', client, req);
    if (head && head.length) socket.unshift(head);
    return client;
  }

  /** Serialize once, write to everyone. */
  broadcast(message) {
    if (!this.clients.size) return;
    const frame = encodeFrame(typeof message === 'string' ? message : JSON.stringify(message));
    for (const client of this.clients) client.sendFrame(frame);
  }

  close() {
    if (this._beat) clearInterval(this._beat);
    for (const client of [...this.clients]) client.close(1001, 'server shutting down');
  }
}
