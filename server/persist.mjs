// The Office — durable local state.
//
// JsonFile: one JSON document, written atomically (tmp + rename) on a short
// debounce, with a rolling `.bak` so a torn or hand-mangled file never costs
// the whole office its memory. Journal: an append-only JSONL activity log with
// size-based rotation and an in-memory tail for cheap "what just happened".
import fs from 'node:fs';
import path from 'node:path';

const open = new Set();
let exitHooked = false;

function hookExit() {
  if (exitHooked) return;
  exitHooked = true;
  process.on('exit', flushAll);
}

/** Flush every open JsonFile/Journal synchronously (safe to call repeatedly). */
export function flushAll() {
  for (const item of open) {
    try { item.flush(); } catch { /* best effort on the way out */ }
  }
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function atomicWriteFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

export class JsonFile {
  /**
   * @param {string} file
   * @param {{defaults?:()=>any, debounceMs?:number, pretty?:boolean,
   *          validate?:(data:any)=>boolean, backupEveryMs?:number}} [opt]
   */
  constructor(file, opt = {}) {
    this.file = file;
    this.defaults = opt.defaults || (() => ({}));
    this.debounceMs = opt.debounceMs ?? 120;
    this.pretty = !!opt.pretty;
    this.validate = opt.validate || ((data) => data && typeof data === 'object');
    this.backupEveryMs = opt.backupEveryMs ?? 60_000;
    this.recoveredFrom = null;
    this._timer = null;
    this._dirty = false;
    this._lastBackup = 0;
    this.data = this.#load();
    open.add(this);
    hookExit();
  }

  #read(file) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return this.validate(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  #load() {
    if (!fs.existsSync(this.file)) {
      const bak = this.#read(this.file + '.bak');
      if (bak) { this.recoveredFrom = 'backup'; return bak; }
      return clone(this.defaults());
    }
    const main = this.#read(this.file);
    if (main) return main;
    // Unreadable primary: keep the evidence, fall back to the last good copy.
    try { fs.copyFileSync(this.file, `${this.file}.corrupt-${Date.now()}`); } catch {}
    const bak = this.#read(this.file + '.bak');
    if (bak) { this.recoveredFrom = 'backup'; return bak; }
    this.recoveredFrom = 'defaults';
    return clone(this.defaults());
  }

  /** Mark dirty; the write lands within `debounceMs`. */
  save() {
    this._dirty = true;
    if (this._timer) return;
    if (this.debounceMs <= 0) { this.flush(); return; }
    this._timer = setTimeout(() => {
      this._timer = null;
      try { this.flush(); } catch (err) { this.lastError = err; }
    }, this.debounceMs);
    if (typeof this._timer.unref === 'function') this._timer.unref();
  }

  /** Write now, synchronously and atomically. */
  flush() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (!this._dirty) return;
    const now = Date.now();
    if (now - this._lastBackup > this.backupEveryMs && fs.existsSync(this.file)) {
      try { fs.copyFileSync(this.file, this.file + '.bak'); this._lastBackup = now; } catch {}
    }
    atomicWriteFile(this.file,
      (this.pretty ? JSON.stringify(this.data, null, 2) : JSON.stringify(this.data)) + '\n');
    this._dirty = false;
  }

  close() {
    this.flush();
    open.delete(this);
  }
}

export class Journal {
  /**
   * @param {string} file  JSONL path
   * @param {{maxBytes?:number, keep?:number, tail?:number}} [opt]
   */
  constructor(file, opt = {}) {
    this.file = file;
    this.maxBytes = opt.maxBytes ?? 4 * 1024 * 1024;
    this.keep = opt.keep ?? 3;
    this.tailSize = opt.tail ?? 600;
    this.tail = [];
    this._buf = [];
    this._timer = null;
    this._bytes = 0;
    this.#prime();
    open.add(this);
    hookExit();
  }

  #prime() {
    try {
      const st = fs.statSync(this.file);
      this._bytes = st.size;
      const len = Math.min(st.size, 256 * 1024);
      const fd = fs.openSync(this.file, 'r');
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, st.size - len);
      fs.closeSync(fd);
      const lines = buf.toString('utf8').split('\n');
      if (len < st.size) lines.shift();               // partial first line
      for (const line of lines) {
        if (!line) continue;
        try { this.tail.push(JSON.parse(line)); } catch { /* skip torn line */ }
      }
      this.tail = this.tail.slice(-this.tailSize);
    } catch { /* no journal yet */ }
  }

  append(entry) {
    const record = { t: Date.now(), ...entry };
    this.tail.push(record);
    if (this.tail.length > this.tailSize) this.tail.splice(0, this.tail.length - this.tailSize);
    this._buf.push(JSON.stringify(record));
    if (!this._timer) {
      this._timer = setTimeout(() => {
        this._timer = null;
        try { this.flush(); } catch { /* never throw out of a timer */ }
      }, 250);
      if (typeof this._timer.unref === 'function') this._timer.unref();
    }
    return record;
  }

  since(ts, limit = 200) {
    const out = [];
    for (let i = this.tail.length - 1; i >= 0 && out.length < limit; i--) {
      if (this.tail[i].t <= ts) break;
      out.push(this.tail[i]);
    }
    return out.reverse();
  }

  recent(limit = 50) {
    return this.tail.slice(-limit);
  }

  #rotate() {
    try {
      for (let i = this.keep - 1; i >= 1; i--) {
        const from = `${this.file}.${i}`;
        if (fs.existsSync(from)) fs.renameSync(from, `${this.file}.${i + 1}`);
      }
      fs.renameSync(this.file, `${this.file}.1`);
      this._bytes = 0;
    } catch { /* rotation is best effort */ }
  }

  flush() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (!this._buf.length) return;
    const text = this._buf.join('\n') + '\n';
    this._buf = [];
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    if (this._bytes + text.length > this.maxBytes) this.#rotate();
    fs.appendFileSync(this.file, text);
    this._bytes += Buffer.byteLength(text);
  }

  close() {
    this.flush();
    open.delete(this);
  }
}
