#!/usr/bin/env node
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const PORT = Number(process.env.OFFICE_PORT || 4317);
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const HEALTH = `http://127.0.0.1:${PORT}/api/health`;

function ok(label, detail = '') {
  console.log(`OK   ${label}${detail ? ' — ' + detail : ''}`);
}

function warn(label, detail = '') {
  console.log(`WARN ${label}${detail ? ' — ' + detail : ''}`);
}

function fail(label, detail = '') {
  console.log(`FAIL ${label}${detail ? ' — ' + detail : ''}`);
}

function hasCmd(bin, args = ['--version']) {
  try {
    cp.execFileSync(bin, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { return null; }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function hookStatus() {
  const json = readJson(SETTINGS);
  if (!json) return { state: 'warn', detail: '~/.claude/settings.json not found' };
  const text = JSON.stringify(json);
  const hasOfficeHook = text.includes('office-hook.sh');
  const hasInboxHook = text.includes('office-inbox-hook.mjs');
  if (hasOfficeHook && hasInboxHook) return { state: 'ok', detail: 'hook bridge + inbox hook detected' };
  if (hasOfficeHook) return { state: 'warn', detail: 'office hook present, inbox hook missing' };
  return { state: 'warn', detail: 'hooks not detected yet; run npm run install-hooks and npm run install-inbox' };
}

async function daemonStatus() {
  try {
    const res = await fetch(HEALTH);
    if (!res.ok) return { state: 'warn', detail: `daemon responded ${res.status}` };
    const body = await res.json();
    return {
      state: 'ok',
      detail: `${body.agents || 0} live agents on port ${PORT}`,
    };
  } catch {
    return { state: 'warn', detail: `nothing listening on port ${PORT}` };
  }
}

const major = Number(process.versions.node.split('.')[0] || 0);
if (major >= 18) ok('Node.js', process.version);
else fail('Node.js', `found ${process.version}; expected 18+`);

hasCmd('tmux', ['-V']) ? ok('tmux') : warn('tmux', 'managed terminal features will be unavailable');
hasCmd('claude') ? ok('Claude Code CLI') : warn('Claude Code CLI', 'hooks can still work later if Claude is installed elsewhere');
hasCmd('codex') ? ok('Codex CLI') : warn('Codex CLI', 'Codex-specific launch flow unavailable');

const hooks = hookStatus();
if (hooks.state === 'ok') ok('Claude hooks', hooks.detail);
else warn('Claude hooks', hooks.detail);

// The onboarding skill: installed where runtimes look for it, and the in-repo
// mirror still matches the source of truth.
{
  const name = 'the-office';
  const source = readText(path.join(process.cwd(), '.claude', 'skills', name, 'SKILL.md'));
  const mirror = readText(path.join(process.cwd(), '.agents', 'skills', name, 'SKILL.md'));
  if (source === null) fail('Office skill', '.claude/skills/the-office/SKILL.md is missing');
  else if (mirror === source) ok('Office skill', 'source + .agents mirror in sync');
  else warn('Office skill', '.agents mirror is stale; run node install-skill.mjs --sync');
  const installed = [path.join(os.homedir(), '.claude', 'skills', name, 'SKILL.md'),
    path.join(os.homedir(), '.agents', 'skills', name, 'SKILL.md')].filter((f) => fs.existsSync(f));
  if (installed.length === 2) ok('Skill install', 'visible to Claude Code and Codex sessions in any directory');
  else warn('Skill install', 'agents outside this repo will not see the skill; run npm run install-skill');
}

const daemon = await daemonStatus();
if (daemon.state === 'ok') ok('Daemon health', daemon.detail);
else warn('Daemon health', daemon.detail);

if (fs.existsSync(path.join(process.cwd(), 'data'))) ok('Runtime data dir', 'present');
else warn('Runtime data dir', 'will be created on first write');
