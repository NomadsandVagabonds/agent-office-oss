#!/usr/bin/env node
// office-presence.mjs — manual Office presence bridge for non-Claude sessions.
//
// This gives Codex (and any other runtime that knows its own session id) a
// way to become a first-class desk in the Office without pretending it has
// Claude's hook system.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { requestJson } from './office-http.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.OFFICE_PORT || 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const GLOBAL_PROFILES = path.join(os.homedir(), '.claude', 'agent-office', 'profiles.json');
const LOCAL_PROFILES = path.join(HERE, 'data', 'profiles.local.json');
const FEED_DIR = path.join(HERE, 'public', 'transcripts');
const FEED_TURNS = 140;
const FEED_CHARS = 1800;
const argv = process.argv.slice(2);

function help() {
  console.log(
    'node office-presence.mjs start [--model "Codex Desktop"]\n'
    + 'node office-presence.mjs think\n'
    + 'node office-presence.mjs work [tool]\n'
    + 'node office-presence.mjs note <message>\n'
    + 'node office-presence.mjs block <message>\n'
    + 'node office-presence.mjs done\n'
    + 'node office-presence.mjs stop\n'
    + '\n'
    + 'Uses CODEX_THREAD_ID when available; otherwise pass --id <sessionId>.'
  );
}

function argValue(flag) {
  const idx = argv.indexOf(flag);
  return idx >= 0 ? argv[idx + 1] || '' : '';
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return { bySession: {}, byCwd: {} }; }
}

function loadProfiles() {
  const global = readJson(GLOBAL_PROFILES);
  const local = readJson(LOCAL_PROFILES);
  return {
    bySession: { ...(global.bySession || {}), ...(local.bySession || {}) },
    byCwd: { ...(global.byCwd || {}), ...(local.byCwd || {}) },
  };
}

function sessionId() {
  return argValue('--id') || process.env.CODEX_THREAD_ID || process.env.CLAUDE_SESSION_ID || '';
}

function resolveSelf() {
  const profiles = loadProfiles();
  const sid = sessionId();
  const cwd = process.cwd();
  const prof = { ...(cwd && profiles.byCwd[cwd]), ...(sid && profiles.bySession[sid]) };
  return {
    sessionId: sid,
    cwd,
    name: prof.name || process.env.OFFICE_AUTHOR || process.env.USER || 'Agent',
    task: prof.task || '',
    model: argValue('--model') || process.env.OFFICE_MODEL || process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE || 'Codex Desktop',
  };
}

function feedPath(sid) {
  return path.join(FEED_DIR, sid + '.json');
}

function feedText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, FEED_CHARS);
}

function readFeed(sid) {
  try { return JSON.parse(fs.readFileSync(feedPath(sid), 'utf8')); }
  catch { return { sid, turns: [], at: 0, source: 'manual' }; }
}

function writeFeed(sid, feed) {
  try {
    fs.mkdirSync(FEED_DIR, { recursive: true });
    const file = feedPath(sid);
    fs.writeFileSync(file + '.tmp', JSON.stringify(feed));
    fs.renameSync(file + '.tmp', file);
  } catch {}
}

function appendFeedTurn(sid, role, text) {
  const x = feedText(text);
  if (!x) return;
  const feed = readFeed(sid);
  const turns = Array.isArray(feed.turns) ? feed.turns.slice(-FEED_TURNS + 1) : [];
  const last = turns[turns.length - 1];
  if (!last || last.r !== role || last.x !== x) turns.push({ r: role, x });
  feed.sid = sid;
  feed.source = 'manual';
  feed.turns = turns.slice(-FEED_TURNS);
  feed.at = Date.now();
  writeFeed(sid, feed);
}

function statusLine(kind, detail) {
  if (detail) return detail;
  if (kind === 'start') return 'Clocked in at the desk.';
  if (kind === 'think') return 'Reviewing context and lining up the next move.';
  if (kind === 'done') return 'Wrapped the current step and waiting for the next handoff.';
  if (kind === 'stop') return 'Signed off from the desk.';
  return '';
}

async function post(body) {
  requestJson(`${BASE}/hook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

const action = argv[0];
if (!action || action === '--help' || action === '-h') {
  help();
  process.exit(0);
}

const me = resolveSelf();
if (!me.sessionId) {
  console.error('office-presence: no session id. Set CODEX_THREAD_ID or pass --id <sessionId>.');
  process.exit(1);
}

const base = {
  session_id: me.sessionId,
  runtime_session_id: process.env.OFFICE_RUNTIME_SESSION_ID || '',
  cwd: me.cwd,
  model: me.model,
};

if (action === 'start') {
  await post({ ...base, hook_event_name: 'SessionStart' });
  await post({ ...base, hook_event_name: 'UserPromptSubmit' });
  appendFeedTurn(me.sessionId, 'a', statusLine('start', argv.slice(1).join(' ').trim()));
  console.log(`office-presence: ${me.name} joined the office (${me.sessionId.slice(0, 8)}).`);
  process.exit(0);
}

if (action === 'think') {
  await post({ ...base, hook_event_name: 'UserPromptSubmit' });
  appendFeedTurn(me.sessionId, 'a', statusLine('think', argv.slice(1).join(' ').trim()));
  console.log(`office-presence: ${me.name} marked thinking.`);
  process.exit(0);
}

if (action === 'work') {
  const tool = argv.slice(1).join(' ').trim() || 'Codex';
  await post({ ...base, hook_event_name: 'PreToolUse', tool_name: tool });
  appendFeedTurn(me.sessionId, 't', '↳ ' + tool);
  console.log(`office-presence: ${me.name} marked working (${tool}).`);
  process.exit(0);
}

if (action === 'note') {
  const message = argv.slice(1).join(' ').trim();
  if (!message) {
    console.error('office-presence: note message required.');
    process.exit(1);
  }
  appendFeedTurn(me.sessionId, 'a', message);
  console.log(`office-presence: ${me.name} left a desk note.`);
  process.exit(0);
}

if (action === 'block') {
  const message = argv.slice(1).join(' ').trim();
  if (!message) {
    console.error('office-presence: block message required.');
    process.exit(1);
  }
  await post({ ...base, hook_event_name: 'Notification', message });
  appendFeedTurn(me.sessionId, 'a', 'Waiting on input: ' + message);
  console.log(`office-presence: ${me.name} flagged blocked.`);
  process.exit(0);
}

if (action === 'done') {
  await post({ ...base, hook_event_name: 'Stop' });
  appendFeedTurn(me.sessionId, 'a', statusLine('done', argv.slice(1).join(' ').trim()));
  console.log(`office-presence: ${me.name} marked done.`);
  process.exit(0);
}

if (action === 'stop') {
  appendFeedTurn(me.sessionId, 'a', statusLine('stop', argv.slice(1).join(' ').trim()));
  await post({ ...base, hook_event_name: 'SessionEnd' });
  console.log(`office-presence: ${me.name} left the office.`);
  process.exit(0);
}

console.error(`office-presence: unknown action "${action}"`);
help();
process.exit(1);
