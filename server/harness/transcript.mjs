// The Office — harness: a session's transcript.
//
// What a driven session did, as a timeline a human or a teammate agent can
// read: the turns, what was asked, what the agent said, the tools it ran, the
// permissions it asked for and who answered. It replaces "scrape the terminal"
// with a record.
//
// On disk it is an append-only JSONL journal (server/persist.mjs), one file per
// session. An entry carries an `id`; a later line with the same id is a newer
// revision of the same item (a tool going from running to completed, a turn
// from running to finished). Reading folds revisions: the newest wins, at the
// position the item first appeared. Text that is still streaming is kept in
// memory and shown live, and written once — when it is complete.
//
// The transcript shows commands, file paths and a bounded tail of tool output.
// Everything passes through the redactor in child.mjs first, but it is a
// record of real work: treat it as you would the terminal it replaces.
import fs from 'node:fs';
import { Journal } from '../persist.mjs';

const MAX_ITEMS_IN_MEMORY = 1500;
const COLD_READ_BYTES = 768 * 1024;

export const ENTRY_KINDS = Object.freeze(['session', 'turn', 'user', 'message', 'thought', 'tool', 'plan',
  'usage', 'permission', 'question', 'notice', 'handoff', 'changes']);

function fold(records) {
  const items = new Map();
  for (const r of records) {
    if (!r || typeof r.id !== 'string') continue;
    const prev = items.get(r.id);
    items.set(r.id, prev ? { ...r, at: prev.at } : { ...r, at: r.at ?? r.t });
  }
  return items;
}

function page(items, { after, limit } = {}) {
  const max = Math.max(1, Math.min(1000, Number(limit) || 300));
  let list = [...items.values()];
  // `after` is a revision number: "what changed since I last asked".
  if (Number(after) > 0) list = list.filter((e) => e.seq > Number(after));
  const truncated = list.length > max;
  if (truncated) list = list.slice(-max);
  return { entries: list, truncated };
}

export class Transcript {
  constructor(file, opt = {}) {
    this.file = file;
    this.journal = new Journal(file, { tail: 1, maxBytes: opt.maxBytes ?? 8 * 1024 * 1024, keep: 2 });
    this.items = new Map();          // id → latest revision, in order of first appearance
    this.seq = 0;
    this.listeners = new Set();
  }

  onEntry(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /**
   * Add an item or revise one (same id). `persist:false` is for text that is
   * still streaming: it is shown now and written when it is complete.
   */
  write(entry, opt = {}) {
    const prev = this.items.get(entry.id);
    const record = { ...(prev || {}), ...entry, seq: ++this.seq, t: Date.now(), at: prev ? prev.at : Date.now() };
    this.items.set(record.id, record);
    if (this.items.size > MAX_ITEMS_IN_MEMORY) this.items.delete(this.items.keys().next().value);   // still on disk
    if (opt.persist !== false) {
      const { streaming, ...durable } = record;
      this.journal.append(durable);
    }
    for (const fn of this.listeners) { try { fn(record); } catch { /* a listener must not break the log */ } }
    return record;
  }

  get(id) { return this.items.get(id) || null; }

  read(opt) { return { ...page(this.items, opt), seq: this.seq, live: true }; }

  close() {
    this.listeners.clear();
    this.journal.close();
  }
}

/** Read a finished session's transcript straight from its file (the recent part of it). */
export function readTranscriptFile(file, opt) {
  let text = '';
  try {
    const st = fs.statSync(file);
    const len = Math.min(st.size, COLD_READ_BYTES);
    const fd = fs.openSync(file, 'r');
    try {
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, st.size - len);
      text = buf.toString('utf8');
      if (len < st.size) text = text.slice(text.indexOf('\n') + 1);      // drop the torn first line
    } finally { fs.closeSync(fd); }
  } catch {
    return { entries: [], truncated: false, seq: 0, live: false, missing: true };
  }
  const records = [];
  for (const row of text.split('\n')) {
    if (!row) continue;
    try { records.push(JSON.parse(row)); } catch { /* a torn line is skipped */ }
  }
  const items = fold(records);
  let seq = 0;
  for (const e of items.values()) seq = Math.max(seq, e.seq || 0);
  return { ...page(items, opt), seq, live: false };
}
