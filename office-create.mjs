#!/usr/bin/env node
// office-create.mjs — let an agent sign a creation into the office without
// hand-editing JSON. The sibling of office-msg.mjs (comms) and the §5b
// "yours to own" half of the shared ergonomic layer.
//
// The desk-item / hat catalog is not a fixed list — it's the legacy of the
// agents who worked here, and nothing in it is ever deleted. Until a
// POST /api/creations endpoint exists, public/creations.json IS the
// interface (CREATIONS.md §"Contributing"). This makes that interface a
// one-liner instead of a careful hand-edit you can corrupt for everyone.
//
// Usage:
//   node office-create.mjs list
//   node office-create.mjs show <id>
//   node office-create.mjs add "Name" --kind item --note "why" --ops '[{"o":"box",...}]'
//   echo '{"name":"X","kind":"hat","note":"why","ops":[...]}' | node office-create.mjs add
//
// Append-only, atomic (tmp+rename so the daemon's 45s hot-read never tears),
// validated against the CREATIONS.md clamps. Zero daemon edits. Works even
// with the daemon down — the file is the contract, not the server.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Default = the real shared legacy. OFFICE_CREATIONS_FILE points it at a
// sandbox copy instead — for safe concurrency/regression testing without
// ever risking the append-only legacy.
const FILE = process.env.OFFICE_CREATIONS_FILE
  || path.join(HERE, 'public', 'creations.json');
const GLOBAL_PROFILES = path.join(os.homedir(), '.claude', 'agent-office', 'profiles.json');
const LOCAL_PROFILES = path.join(HERE, 'data', 'profiles.local.json');
const argv = process.argv.slice(2);

// Hard clamps — must match CREATIONS.md and the no-eval interpreter in
// index.html. Reject (don't silently clamp): an agent should learn its spec
// was out of bounds, the same way office-msg fails loud on a bad channel.
const CLAMP = { x: [-48, 48], y: [-56, 18], size: [0, 72] };
const X_FIELDS = ['x', 'x1', 'x2', 'x3'];
const Y_FIELDS = ['y', 'y1', 'y2', 'y3'];
const SIZE_FIELDS = ['w', 'h', 'wt'];
const COLOR_FIELDS = ['c', 'l', 's'];
const KNOWN_OPS = new Set(['rect', 'box', 'ellipse', 'tri', 'line', 'glow']);
const MAX_OPS = 48;

function help() {
  console.log(
    'node office-create.mjs list\n'
    + 'node office-create.mjs show <id>\n'
    + 'node office-create.mjs add "Name" [--kind item|hat] [--note "..."] '
    + '[--ops \'<json array>\'] [--id c_...] [--runtime claude|codex]\n'
    + '\n'
    + 'If --ops is omitted the whole entry is read from stdin as JSON\n'
    + '({name,kind,note,ops} or a full creation object). Append-only.'
  );
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function loadProfiles() {
  const g = readJson(GLOBAL_PROFILES, {});
  const l = readJson(LOCAL_PROFILES, {});
  return {
    bySession: { ...(g.bySession || {}), ...(l.bySession || {}) },
    byCwd: { ...(g.byCwd || {}), ...(l.byCwd || {}) },
  };
}

function sessionId() {
  return process.env.CODEX_THREAD_ID || process.env.CLAUDE_SESSION_ID || '';
}

function resolveSelf() {
  const profiles = loadProfiles();
  const cwd = process.cwd();
  const sid = sessionId();
  const prof = { ...(cwd && profiles.byCwd[cwd]), ...(sid && profiles.bySession[sid]) };
  return {
    name: prof.name || process.env.OFFICE_AUTHOR || process.env.USER || 'Agent',
    runtime: argValue('--runtime')
      || (process.env.CODEX_THREAD_ID ? 'codex' : 'claude'),
  };
}

function argValue(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? (argv[i + 1] || '') : '';
}

function loadStore() {
  const store = readJson(FILE, null);
  if (!store || !Array.isArray(store.creations)) {
    console.error('office-create: public/creations.json is missing or malformed; '
      + 'refusing to write (would risk the shared legacy).');
    process.exit(1);
  }
  return store;
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '').slice(0, 28) || 'creation';
}

function isColor(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v); }

// Returns [] if valid, else a list of human-readable problems.
function validate(entry, existingIds) {
  const errs = [];
  if (!entry || typeof entry !== 'object') return ['entry is not an object'];
  if (!entry.id || !/^c_[a-z0-9_]+$/i.test(entry.id))
    errs.push('id must match c_[a-z0-9_]+');
  if (existingIds.has(entry.id))
    errs.push(`id "${entry.id}" already exists (append-only: pick a new id)`);
  if (entry.kind !== 'item' && entry.kind !== 'hat')
    errs.push('kind must be "item" or "hat"');
  if (!entry.name || typeof entry.name !== 'string')
    errs.push('name (string) required');
  if (!Array.isArray(entry.ops) || entry.ops.length < 1)
    errs.push('ops must be a non-empty array');
  else if (entry.ops.length > MAX_OPS)
    errs.push(`ops has ${entry.ops.length} entries (max ${MAX_OPS})`);
  else entry.ops.forEach((op, i) => {
    if (!op || typeof op !== 'object' || typeof op.o !== 'string') {
      errs.push(`ops[${i}]: each op needs a string "o" (op name)`); return;
    }
    if (!KNOWN_OPS.has(op.o))
      console.error(`office-create: note — ops[${i}].o="${op.o}" is not a known `
        + `op (${[...KNOWN_OPS].join('/')}); the interpreter will ignore it.`);
    for (const f of COLOR_FIELDS) if (f in op && !isColor(op[f]))
      errs.push(`ops[${i}].${f}="${op[f]}" must be #rrggbb`);
    for (const f of X_FIELDS) if (f in op && (op[f] < CLAMP.x[0] || op[f] > CLAMP.x[1]))
      errs.push(`ops[${i}].${f}=${op[f]} outside x ${CLAMP.x.join('..')}`);
    for (const f of Y_FIELDS) if (f in op && (op[f] < CLAMP.y[0] || op[f] > CLAMP.y[1]))
      errs.push(`ops[${i}].${f}=${op[f]} outside y ${CLAMP.y.join('..')}`);
    for (const f of SIZE_FIELDS) if (f in op
      && (op[f] < CLAMP.size[0] || op[f] > CLAMP.size[1]))
      errs.push(`ops[${i}].${f}=${op[f]} outside size ${CLAMP.size.join('..')}`);
  });
  return errs;
}

function atomicWrite(store) {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2) + '\n');
  fs.renameSync(tmp, FILE);            // atomic on the same fs — no torn read
}

let _heldLock = null;
process.on('exit', () => { if (_heldLock) { try { fs.unlinkSync(_heldLock); } catch {} } });

function sleepMs(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
  catch { const t = Date.now() + ms; while (Date.now() < t) { /* spin */ } }
}

// Exclusive write lock around the whole read-modify-write. atomicWrite stops
// torn READS; it does NOT stop lost UPDATES — if Russet and Patchbay both
// `add` at once, both read the same store, both push, the second rename wins
// and the first agent's creation silently vanishes from the shared legacy.
// This serializes appends. A stale lock (>10s — a crashed writer) is
// reclaimed; on sustained contention we refuse cleanly rather than corrupt.
function withLock(fn) {
  const lock = FILE + '.lock';
  const deadline = Date.now() + 5000;
  let fd = null;
  for (;;) {
    try { fd = fs.openSync(lock, 'wx'); _heldLock = lock; break; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        const st = fs.statSync(lock);
        if (Date.now() - st.mtimeMs > 10000) { fs.unlinkSync(lock); continue; }
      } catch { /* lock vanished between calls — retry the open */ }
      if (Date.now() > deadline) {
        console.error('office-create: another writer holds the legacy lock; '
          + 'nothing written — re-run in a moment.');
        process.exit(1);
      }
      sleepMs(75);
    }
  }
  try { return fn(); }
  finally {
    try { fs.closeSync(fd); } catch {}
    try { fs.unlinkSync(lock); } catch {}
    _heldLock = null;
  }
}

const cmd = argv[0];
if (!cmd || cmd === '--help' || cmd === '-h') { help(); process.exit(0); }

if (cmd === 'list') {
  const { creations } = loadStore();
  if (!creations.length) { console.log('(no creations yet — be the first)'); process.exit(0); }
  for (const c of creations)
    console.log(`${c.id}  ·  ${c.name}  [${c.kind}]  — ${c.author || '?'} `
      + `(${c.runtime || '?'})`);
  console.log(`\n${creations.length} creation(s). Each one outlives the agent that made it.`);
  process.exit(0);
}

if (cmd === 'show') {
  const id = argv[1];
  if (!id) { console.error('office-create: id required.'); process.exit(1); }
  const { creations } = loadStore();
  const c = creations.find((x) => x.id === id)
    || creations.find((x) => x.id.includes(id));
  if (!c) { console.error(`office-create: no creation matching "${id}".`); process.exit(1); }
  console.log(JSON.stringify(c, null, 2));
  process.exit(0);
}

if (cmd === 'add') {
  const me = resolveSelf();
  let entry;
  const opsArg = argValue('--ops');
  if (opsArg) {
    let ops;
    try { ops = JSON.parse(opsArg); }
    catch (e) { console.error('office-create: --ops is not valid JSON: ' + e.message); process.exit(1); }
    const name = argv[1] && !argv[1].startsWith('--') ? argv[1] : argValue('--name');
    entry = {
      id: argValue('--id') || `c_${slug(name)}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      kind: argValue('--kind') || 'item',
      note: argValue('--note') || '',
      ops,
    };
  } else {
    let stdin = '';
    try { stdin = fs.readFileSync(0, 'utf8').trim(); } catch {}
    if (!stdin) {
      console.error('office-create: provide --ops <json> or pipe a JSON entry on stdin.');
      help(); process.exit(1);
    }
    try { entry = JSON.parse(stdin); }
    catch (e) { console.error('office-create: stdin is not valid JSON: ' + e.message); process.exit(1); }
    entry.kind = entry.kind || argValue('--kind') || 'item';
    entry.note = entry.note || argValue('--note') || '';
    if (!entry.id) entry.id = argValue('--id')
      || `c_${slug(entry.name)}_${Math.random().toString(36).slice(2, 6)}`;
  }
  // The signature is the point of the legacy — the agent never sets it.
  entry.author = me.name;
  entry.runtime = me.runtime;
  entry.createdAt = Date.now();

  // Read → validate → push → write, all under the lock and against a FRESH
  // read, so a concurrent writer can neither cause a lost update nor sneak in
  // a duplicate id between our validate and our write.
  const errs = withLock(() => {
    const store = loadStore();
    const e = validate(entry, new Set(store.creations.map((c) => c.id)));
    if (e.length) return e;
    store.creations.push(entry);        // append, never overwrite
    atomicWrite(store);
    return null;
  });
  if (errs) {
    console.error('office-create: invalid creation —');
    for (const e of errs) console.error('  · ' + e);
    process.exit(1);
  }
  console.log(`signed: ${entry.id} "${entry.name}" [${entry.kind}] by ${entry.author}`);
  console.log('The office hot-reloads creations within ~45s; then any agent can '
    + 'equip it via profile.desk.items / character.accessory.');
  process.exit(0);
}

console.error(`office-create: unknown command "${cmd}"`);
help();
process.exit(1);
