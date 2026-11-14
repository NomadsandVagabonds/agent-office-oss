#!/usr/bin/env node
// The Office — status-line bridge for Claude Code.
//
// Claude Code hands its status line a JSON description of the session on
// stdin, and for subscribers that includes how much of the five-hour and
// weekly allowances is used. Nothing else in a hook-observed session says
// that, so this command does two jobs:
//   1. passes those numbers to the office's usage feed (POST /api/usage/report)
//   2. prints a status line — yours, if you already had one
//      (OFFICE_STATUSLINE_CMD is run with the same JSON), or a short one of
//      its own: model · folder · context · what is left.
//
// It must never slow a terminal down or break a prompt: it prints first, talks
// to the office only when the numbers changed or a minute has passed, gives up
// after a third of a second, and exits 0 whatever happens.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { claudeStatusLineToReport } from '../server/usage-sources.mjs';

const done = () => process.exit(0);
process.on('uncaughtException', done);
process.on('unhandledRejection', done);
setTimeout(done, 1200).unref();

const PORT = process.env.OFFICE_PORT || 4317;
const BASE = (process.env.OFFICE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { raw = ''; }
let input = {};
try { input = JSON.parse(raw || '{}') || {}; } catch { input = {}; }
const report = claudeStatusLineToReport(input);

/* ---- 1. the line itself ---------------------------------------------------- */
function ownLine() {
  const parts = [];
  if (input.model?.display_name) parts.push(input.model.display_name);
  const dir = input.workspace?.current_dir || input.cwd;
  if (dir) parts.push(path.basename(dir));
  const ctx = input.context_window?.used_percentage;
  if (typeof ctx === 'number') parts.push(`ctx ${Math.round(ctx)}%`);
  for (const w of report?.windows || []) {
    const left = Math.max(0, Math.round(100 - w.usedPercent));
    const text = `${w.id === 'five_hour' ? '5h' : w.id === 'seven_day' ? 'week' : 'spend'} ${left}% left`;
    parts.push(left <= 10 ? `\u001b[31m${text}\u001b[0m` : text);
  }
  return parts.join(' · ');
}
let line = '';
if (process.env.OFFICE_STATUSLINE_CMD) {
  try { line = execSync(process.env.OFFICE_STATUSLINE_CMD, { input: raw, timeout: 2000, stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' }); }
  catch { line = ''; }
}
process.stdout.write((line || ownLine()).replace(/\s+$/, '') + '\n');

/* ---- 2. tell the office, sparingly ------------------------------------------- */
if (!report) done();
const memo = path.join(os.tmpdir(), `office-statusline-${String(PORT).replace(/[^0-9]/g, '')}.json`);
const key = JSON.stringify(report.windows.map((w) => [w.id, Math.round(w.usedPercent), w.resetsAt]));
let last = {};
try { last = JSON.parse(fs.readFileSync(memo, 'utf8')) || {}; } catch { last = {}; }
if (last.key === key && Date.now() - (last.at || 0) < 60 * 1000) done();
try { fs.writeFileSync(memo, JSON.stringify({ key, at: Date.now() })); } catch { /* a memo is a nicety */ }
const headers = { 'content-type': 'application/json', ...(process.env.OFFICE_TOKEN ? { authorization: `Bearer ${process.env.OFFICE_TOKEN}` } : {}) };
fetch(`${BASE}/api/usage/report`, { method: 'POST', headers, signal: AbortSignal.timeout(350),
  body: JSON.stringify({ ...report, agent: input.session_id || undefined, account: process.env.OFFICE_USAGE_ACCOUNT || undefined }) })
  .then(done, done);
