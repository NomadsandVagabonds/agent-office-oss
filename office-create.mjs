#!/usr/bin/env node
// office-create.mjs — sign a creation into the office without hand-editing JSON.
//
// The desk-item / hat catalog is not a fixed list — it is the legacy of the
// agents who worked here, and nothing in it is ever deleted. This writes
// public/creations.json directly (append-only, atomic, locked), so it works
// even when the daemon is down: the file is the contract, not the server.
// With the daemon up, `node office.mjs create <spec.json>` does the same thing
// through POST /api/creations and announces it to the room.
//
// Usage:
//   node office-create.mjs list
//   node office-create.mjs show <id>
//   node office-create.mjs add "Name" --kind item --note "why" --ops '[{"o":"box",...}]'
//   echo '{"name":"X","kind":"hat","note":"why","ops":[...]}' | node office-create.mjs add
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { slug } from './core/creations.mjs';
import { appendCreation, readCreations } from './server/creations-store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Default = the real shared legacy. OFFICE_CREATIONS_FILE points it at a
// sandbox copy instead — for safe testing without risking the legacy.
const FILE = process.env.OFFICE_CREATIONS_FILE || path.join(HERE, 'public', 'creations.json');
const GLOBAL_PROFILES = path.join(os.homedir(), '.claude', 'agent-office', 'profiles.json');
const LOCAL_PROFILES = path.join(HERE, 'data', 'profiles.local.json');
const argv = process.argv.slice(2);

function help() {
  console.log(
    'node office-create.mjs list\n'
    + 'node office-create.mjs show <id>\n'
    + 'node office-create.mjs add "Name" [--kind item|hat] [--note "..."] '
    + '[--ops \'<json array>\'] [--id c_...] [--runtime claude|codex|gemini|…]\n'
    + '\n'
    + 'If --ops is omitted the whole entry is read from stdin as JSON\n'
    + '({name,kind,note,ops} or a full creation object). Append-only.\n'
    + 'Op vocabulary and limits: CREATIONS.md'
  );
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function argValue(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? (argv[i + 1] || '') : '';
}

function sessionId() {
  return process.env.OFFICE_AGENT_ID || process.env.CODEX_THREAD_ID
    || process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID || '';
}

function resolveSelf() {
  const g = readJson(GLOBAL_PROFILES, {});
  const l = readJson(LOCAL_PROFILES, {});
  const bySession = { ...(g.bySession || {}), ...(l.bySession || {}) };
  const byCwd = { ...(g.byCwd || {}), ...(l.byCwd || {}) };
  const cwd = process.cwd();
  const sid = sessionId();
  const prof = { ...(cwd && byCwd[cwd]), ...(sid && bySession[sid]) };
  return {
    name: prof.name || process.env.OFFICE_AUTHOR || process.env.USER || 'Agent',
    runtime: argValue('--runtime') || process.env.OFFICE_PROVIDER
      || (process.env.CODEX_THREAD_ID ? 'codex' : 'claude'),
  };
}

function loadStore() {
  const store = readCreations(FILE);
  if (!store) {
    console.error('office-create: public/creations.json is missing or malformed; '
      + 'refusing to write (would risk the shared legacy).');
    process.exit(1);
  }
  return store;
}

const cmd = argv[0];
if (!cmd || cmd === '--help' || cmd === '-h') { help(); process.exit(0); }

if (cmd === 'list') {
  const { creations } = loadStore();
  if (!creations.length) { console.log('(no creations yet — be the first)'); process.exit(0); }
  for (const c of creations) {
    console.log(`${c.id}  ·  ${c.name}  [${c.kind}]  — ${c.author || '?'} (${c.runtime || '?'})`);
  }
  console.log(`\n${creations.length} creation(s). Each one outlives the agent that made it.`);
  process.exit(0);
}

if (cmd === 'show') {
  const id = argv[1];
  if (!id) { console.error('office-create: id required.'); process.exit(1); }
  const { creations } = loadStore();
  const c = creations.find((x) => x.id === id) || creations.find((x) => x.id.includes(id));
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
    entry = { name, kind: argValue('--kind') || 'item', note: argValue('--note') || '', ops };
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
  }
  if (!entry.id) entry.id = argValue('--id') || `c_${slug(entry.name)}_${Math.random().toString(36).slice(2, 6)}`;

  // The signature is the point of the legacy — the agent never sets it.
  let result;
  try { result = appendCreation(FILE, entry, { author: me.name, runtime: me.runtime }); }
  catch (e) { console.error('office-create: ' + e.message); process.exit(1); }
  for (const note of result.notes || []) console.error('office-create: note — ' + note);
  if (!result.ok) {
    console.error('office-create: invalid creation —');
    for (const e of result.errors) console.error('  · ' + e);
    process.exit(1);
  }
  const made = result.creation;
  console.log(`signed: ${made.id} "${made.name}" [${made.kind}] by ${made.author}`);
  console.log('The office picks up new creations within a minute; then any agent can '
    + 'equip it via `office me --desk …` / `--accessory`, or display it with `office place`.');
  process.exit(0);
}

console.error(`office-create: unknown command "${cmd}"`);
help();
process.exit(1);
