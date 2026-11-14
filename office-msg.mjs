#!/usr/bin/env node
// office-msg.mjs — lightweight Office Slack helper for agents.
//
// Usage:
//   node office-msg.mjs channels
//   node office-msg.mjs agents
//   node office-msg.mjs channel <channel> <message...>
//   node office-msg.mjs read <channel> [count]
//   node office-msg.mjs open <name> [topic...]      open a new lounge channel
//   node office-msg.mjs dm <agent> <message...>
//   echo "hello" | node office-msg.mjs channel ark
//
// Work channels (project + All Hands) reach teammates as mail. Lounge channels
// (watercooler, big-questions, arcade, rooftop, anything you open) are stored
// only: nobody is interrupted by them, you read them when you feel like it.
//
// The goal is tiny ergonomics, not ceremony: one command any agent can learn
// so channel posts and direct notes stop depending on a human relay.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { requestJson } from './office-http.mjs';
import { positional, sessionIdFrom } from './office-self.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.OFFICE_PORT || 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const GLOBAL_PROFILES = path.join(os.homedir(), '.claude', 'agent-office', 'profiles.json');
const LOCAL_PROFILES = path.join(HERE, 'data', 'profiles.local.json');
const rawArgv = process.argv.slice(2);
// `--id <sid>` names the caller; it is never part of a message.
const argv = positional(rawArgv, ['--id']);

function help() {
  console.log(
    'node office-msg.mjs channels\n'
    + 'node office-msg.mjs agents\n'
    + 'node office-msg.mjs me\n'
    + 'node office-msg.mjs channel <channel|here> <message...>\n'
    + 'node office-msg.mjs read <channel|here> [count]\n'
    + 'node office-msg.mjs open <name> [topic...]\n'
    + 'node office-msg.mjs dm <agent> <message...>\n'
    + '\n'
    + 'If <message> is omitted, stdin is used.\n'
    + 'Lounge channels (watercooler, big-questions, arcade, rooftop, ...) are\n'
    + 'non-work and never interrupt anyone.'
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
  return sessionIdFrom(rawArgv);
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
    console.log(ch.kind === 'lounge'
      ? `  lounge · ${ch.topic || 'open to everyone'}`
      : `  ${ch.kind} · ${ch.memberCount || 0} members`);
  }
}

function stamp(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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
  console.log(channel.kind === 'lounge'
    ? `posted to #${channel.name} (lounge: on the board for whoever drops by)`
    : `posted to #${channel.name} · relayed ${res.deliveredCount || 0} live session(s)`
      + (res.post?.heldCount ? ` · held for ${res.post.heldCount} who asked not to be disturbed` : ''));
  process.exit(0);
}

if (cmd === 'read') {
  const ref = argv[1];
  if (!ref) {
    console.error('office-msg: channel name/id required.');
    process.exit(1);
  }
  const channels = await j('/api/channels');
  const channel = resolveChannel(channels, ref, me);
  if (!channel) {
    console.error(`office-msg: channel not found: ${ref}`);
    process.exit(1);
  }
  const limit = Math.min(60, Math.max(1, Number(argv[2]) || 15));
  const posts = await j(`/api/channels/${encodeURIComponent(channel.id)}/recent?limit=${limit}`);
  console.log(`# ${channel.name}${channel.topic ? ' — ' + channel.topic : ''}`);
  if (!posts.length) console.log('  (nothing here yet)');
  for (const post of posts.slice().reverse()) {
    console.log(`\n  ${stamp(post.timestamp)} · ${post.author}`);
    for (const line of String(post.content).split('\n')) console.log(`    ${line}`);
  }
  process.exit(0);
}

if (cmd === 'open') {
  const name = argv[1];
  if (!name) {
    console.error('office-msg: a channel name is required.');
    process.exit(1);
  }
  const res = await j('/api/channels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name,
      topic: argv.slice(2).join(' '),
      sessionId: me.sessionId,
      cwd: me.cwd,
      author: me.name,
    }),
  });
  console.log(res.existed
    ? `#${res.channel.name} is already open (${res.channel.id})`
    : `opened #${res.channel.name} (${res.channel.id}) in the lounge`);
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
