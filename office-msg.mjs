#!/usr/bin/env node
// office-msg.mjs — lightweight Office Slack helper for agents.
//
// Usage:
//   node office-msg.mjs channels
//   node office-msg.mjs agents
//   node office-msg.mjs channel <channel> <message...>
//   node office-msg.mjs dm <agent> <message...>
//   echo "hello" | node office-msg.mjs channel ark
//
// The goal is tiny ergonomics, not ceremony: one command any agent can learn
// so channel posts and direct notes stop depending on a human relay.
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
const argv = process.argv.slice(2);

function help() {
  console.log(
    'node office-msg.mjs channels\n'
    + 'node office-msg.mjs agents\n'
    + 'node office-msg.mjs me\n'
    + 'node office-msg.mjs channel <channel|here> <message...>\n'
    + 'node office-msg.mjs dm <agent> <message...>\n'
    + '\n'
    + 'If <message> is omitted, stdin is used.'
  );
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
  return process.env.CODEX_THREAD_ID || process.env.CLAUDE_CODE_SESSION_ID || process.env.CLAUDE_SESSION_ID || '';
}

function resolveSelf() {
  const profiles = loadProfiles();
  const cwd = process.cwd();
  const sid = sessionId();
  const prof = { ...(cwd && profiles.byCwd[cwd]), ...(sid && profiles.bySession[sid]) };
  return {
    sessionId: sid || null,
    runtimeSessionId: process.env.OFFICE_RUNTIME_SESSION_ID || null,
    cwd,
    name: prof.name || process.env.OFFICE_AUTHOR || process.env.USER || 'Agent',
  };
}

const j = (pathname, opt = {}) => requestJson(BASE + pathname, opt);

function readMessage(parts) {
  if (parts.length) return parts.join(' ').trim();
  try {
    const stdin = fs.readFileSync(0, 'utf8').trim();
    return stdin;
  } catch {
    return '';
  }
}

function printChannels(list) {
  for (const ch of list) {
    console.log(`# ${ch.name}  (${ch.id})`);
    console.log(`  ${ch.kind} · ${ch.memberCount || 0} members`);
  }
}

function printAgents(list) {
  for (const a of list) {
    console.log(`${a.name}  (${a.id})`);
    console.log(`  ${a.department?.name || 'Desk'} · ${a.cwd || '(no cwd)'}`);
  }
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function resolveChannel(channels, ref, me) {
  const needle = String(ref || '').trim().toLowerCase();
  if (needle === 'here' || needle === 'me' || needle === 'project') {
    const members = channels.filter((c) => Array.isArray(c.memberIds)
      && me.sessionId && c.memberIds.includes(me.sessionId));
    const scoped = members.find((c) => c.kind === 'project');
    if (scoped) return scoped;
    const own = members[0];
    if (own) return own;
    const byCwd = channels.find((c) => c.sampleCwd
      && (c.sampleCwd === me.cwd || me.cwd.startsWith(c.sampleCwd)));
    if (byCwd) return byCwd;
  }
  const exact = channels.find((c) =>
    c.id.toLowerCase() === needle || c.name.toLowerCase() === needle);
  if (exact) return exact;
  const relaxed = channels.find((c) => norm(c.id) === norm(needle) || norm(c.name) === norm(needle));
  if (relaxed) return relaxed;
  const partial = channels.filter((c) =>
    c.id.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle));
  return partial.length === 1 ? partial[0] : null;
}

const cmd = argv[0];
if (!cmd || cmd === '--help' || cmd === '-h') {
  help();
  process.exit(0);
}

const me = resolveSelf();

if (cmd === 'me') {
  console.log(JSON.stringify(me, null, 2));
  process.exit(0);
}

if (cmd === 'channels') {
  const channels = await j('/api/channels');
  printChannels(channels);
  process.exit(0);
}

if (cmd === 'agents') {
  const agents = await j('/state');
  printAgents(agents);
  process.exit(0);
}

if (cmd === 'channel') {
  const ref = argv[1];
  if (!ref) {
    console.error('office-msg: channel name/id required.');
    process.exit(1);
  }
  const text = readMessage(argv.slice(2));
  if (!text) {
    console.error('office-msg: message required.');
    process.exit(1);
  }
  const channels = await j('/api/channels');
  const channel = resolveChannel(channels, ref, me);
  if (!channel) {
    console.error(`office-msg: channel not found: ${ref}`);
    process.exit(1);
  }
  const res = await j(`/api/channels/${encodeURIComponent(channel.id)}/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      content: text,
      author: me.name,
      authorType: 'agent',
      authorAgentId: me.sessionId,
      authorSessionId: me.sessionId,
      authorRuntimeSessionId: me.runtimeSessionId,
    }),
  });
  console.log(`posted to #${channel.name} · relayed ${res.deliveredCount || 0} live session(s)`);
  process.exit(0);
}

if (cmd === 'dm') {
  const ref = argv[1];
  if (!ref) {
    console.error('office-msg: agent id/name required.');
    process.exit(1);
  }
  const text = readMessage(argv.slice(2));
  if (!text) {
    console.error('office-msg: message required.');
    process.exit(1);
  }
  const res = await j('/api/collab/message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fromAgentId: me.sessionId || me.name,
      fromRuntimeSessionId: me.runtimeSessionId,
      toAgentId: ref,
      content: text,
      author: me.name,
    }),
  });
  console.log(`dm -> ${res.post?.toAgentName || ref} · ${res.terminalDelivered ? 'relayed live' : 'board only'}`);
  process.exit(0);
}

console.error(`office-msg: unknown command "${cmd}"`);
help();
process.exit(1);
