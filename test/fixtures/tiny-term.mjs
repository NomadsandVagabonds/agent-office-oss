// Test fixture — a terminal just big enough to check what `office chat` draws.
// It understands the handful of control sequences that client writes (cursor
// up and across, carriage return, line feed, erase to the end of the screen,
// clear, colours) and keeps the visible grid plus what scrolled off the top.
// Anything else is recorded in `unknown`, so a test can insist there is none.
import { PassThrough } from 'node:stream';
import { width } from '../../core/console.mjs';

export class TinyTerm {
  constructor(cols = 80, rows = 24) {
    this.cols = cols; this.rows = rows;
    this.grid = Array.from({ length: rows }, () => []);
    this.scrolled = [];
    this.x = 0; this.y = 0; this.wrapPending = false;
    this.unknown = [];
    this.modes = new Set();
  }

  #lineFeed() {
    if (this.y < this.rows - 1) { this.y++; return; }
    this.scrolled.push(this.grid.shift().join('').replace(/\s+$/, ''));
    this.grid.push([]);
  }

  #put(ch) {
    const w = width(ch);
    if (w === 0) return;
    if (this.wrapPending || this.x + w > this.cols) { this.x = 0; this.#lineFeed(); this.wrapPending = false; }
    const row = this.grid[this.y];
    while (row.length < this.x) row.push(' ');
    row[this.x] = ch;
    for (let i = 1; i < w; i++) row[this.x + i] = '';
    this.x += w;
    if (this.x >= this.cols) { this.x = this.cols - 1; this.wrapPending = true; }
  }

  write(data) {
    const s = String(data);
    for (let i = 0; i < s.length;) {
      const ch = s[i];
      if (ch === '\x1b') {
        const m = /^\x1b\[(\??)([0-9;]*)([A-Za-z])/.exec(s.slice(i, i + 24));
        if (!m) { this.unknown.push(JSON.stringify(s.slice(i, i + 6))); i++; continue; }
        const n = Number(m[2].split(';')[0] || 1), code = m[3];
        this.wrapPending = false;
        if (m[1] === '?') { if (code === 'h') this.modes.add(m[2]); else if (code === 'l') this.modes.delete(m[2]); else this.unknown.push(m[0]); }
        else if (code === 'A') this.y = Math.max(0, this.y - n);
        else if (code === 'B') this.y = Math.min(this.rows - 1, this.y + n);
        else if (code === 'C') this.x = Math.min(this.cols - 1, this.x + n);
        else if (code === 'D') this.x = Math.max(0, this.x - n);
        else if (code === 'H') { this.x = 0; this.y = 0; }
        else if (code === 'J') {
          const mode = m[2] === '' ? 0 : Number(m[2]);
          if (mode === 2) this.grid = Array.from({ length: this.rows }, () => []);
          else if (mode === 3) this.scrolled = [];
          else { this.grid[this.y].length = Math.min(this.grid[this.y].length, this.x); for (let r = this.y + 1; r < this.rows; r++) this.grid[r] = []; }
        } else if (code === 'K') this.grid[this.y].length = Math.min(this.grid[this.y].length, this.x);
        else if (code !== 'm') this.unknown.push(m[0]);
        i += m[0].length;
        continue;
      }
      if (ch === '\r') { this.x = 0; this.wrapPending = false; i++; continue; }
      if (ch === '\n') { this.#lineFeed(); this.wrapPending = false; i++; continue; }
      const cp = s.codePointAt(i), text = String.fromCodePoint(cp);
      if (cp >= 0x20 && cp !== 0x7f) this.#put(text); else this.unknown.push(JSON.stringify(text));
      i += text.length;
    }
  }

  /** The rows on screen, without trailing space. */
  screen() { return this.grid.map((row) => Array.from(row, (c) => (c === undefined ? ' ' : c)).join('').replace(/\s+$/, '')); }
  /** Everything a person could scroll back through, then the screen, as text (no trailing blank rows). */
  text() { return [...this.scrolled, ...this.screen()].join('\n').replace(/\n+$/, ''); }
  /** The row the cursor is on, and the text before the cursor on it. */
  cursor() { const row = this.screen()[this.y] || ''; return { x: this.x, y: this.y, row, before: row.slice(0, this.x) }; }
}

/** A keyboard and a screen for a program that wants a terminal: { input, output, term, type(keys), press(name) }. */
export function fakeTerminal(cols = 80, rows = 24) {
  const term = new TinyTerm(cols, rows);
  const input = new PassThrough();
  input.isTTY = true; input.setRawMode = () => input; input.isRaw = true;
  const output = new PassThrough();
  output.isTTY = true; output.columns = cols; output.rows = rows;
  output.on('data', (chunk) => term.write(chunk.toString('utf8')));
  const KEYS = { enter: '\r', esc: '\x1b', up: '\x1b[A', down: '\x1b[B', right: '\x1b[C', left: '\x1b[D', backspace: '\x7f', tab: '\t',
    'ctrl-c': '\x03', 'ctrl-d': '\x04', 'ctrl-u': '\x15', 'ctrl-w': '\x17', 'ctrl-a': '\x01', 'ctrl-e': '\x05', home: '\x1b[H', end: '\x1b[F' };
  const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));
  return {
    input, output, term,
    /** Type text, one key at a time (so it is typing, not a paste). */
    async type(text) { for (const ch of text) { input.write(ch); await tick(2); } await tick(); },
    async press(name) { input.write(KEYS[name] ?? name); await tick(name === 'esc' ? 650 : 20); },
    async paste(text) { input.write(text); await tick(); },
    tick,
  };
}
