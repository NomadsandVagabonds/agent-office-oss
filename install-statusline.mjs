#!/usr/bin/env node
// Safely point Claude Code's status line at The Office's bridge
// (hooks/office-statusline.mjs), so the office learns how much of your
// subscription's five-hour and weekly allowances is left.
//
// Same discipline as the hook installers:
//  - timestamped backup of settings.json first
//  - preserves every existing key; only touches `statusLine`
//  - if you already have a status line, it keeps showing: the bridge runs your
//    command and prints its output (your command moves into OFFICE_STATUSLINE_CMD)
//  - idempotent; `node install-statusline.mjs --uninstall` puts back what was there
//
//   node install-statusline.mjs [--refresh <seconds>] [--uninstall]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = path.join(__dir, 'hooks', 'office-statusline.mjs');
const SETTINGS = process.env.OFFICE_CLAUDE_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json');
const MARK = 'office-statusline.mjs';
const args = process.argv.slice(2);
const uninstall = args.includes('--uninstall');
const refresh = args.includes('--refresh') ? Math.max(5, Number(args[args.indexOf('--refresh') + 1]) || 60) : 0;

const quote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const unquote = (s) => String(s).slice(1, -1).replace(/'\\''/g, "'");
/** The command that was there before we wrapped it, or null. */
function wrapped(command) {
  const m = /^OFFICE_STATUSLINE_CMD=('(?:[^']|'\\'')*') /.exec(command || '');
  return m ? unquote(m[1]) : null;
}

let settings = {};
if (fs.existsSync(SETTINGS)) {
  settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  fs.copyFileSync(SETTINGS, `${SETTINGS}.bak.${Date.now()}`);
} else {
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
}

const current = settings.statusLine && typeof settings.statusLine === 'object' ? settings.statusLine : null;
const ours = !!current?.command && current.command.includes(MARK);
const before = ours ? wrapped(current.command) : (current?.command || null);

if (uninstall) {
  if (!ours) { console.log('The Office status line is not installed; nothing changed.'); process.exit(0); }
  if (before) settings.statusLine = { ...current, command: before };
  else delete settings.statusLine;
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
  console.log(before ? 'Removed the bridge; your own status line is back.' : 'Removed the Office status line.');
  process.exit(0);
}

if (before && process.platform === 'win32') {
  console.error('You already have a status line, and wrapping it needs a POSIX shell. Set OFFICE_STATUSLINE_CMD yourself, or remove yours first.');
  process.exit(1);
}
fs.chmodSync(BRIDGE, 0o755);
const command = `${before ? `OFFICE_STATUSLINE_CMD=${quote(before)} ` : ''}node ${quote(BRIDGE)}`;
settings.statusLine = { ...(current || {}), type: 'command', command, ...(refresh ? { refreshInterval: refresh } : {}) };
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(before
  ? 'Installed. Your status line still shows; the bridge runs it and tells the office what is left on your plan.'
  : 'Installed. New and restarted Claude Code sessions show a short status line and tell the office what is left on your plan.');
console.log('The numbers exist only on a Claude subscription (Pro, Max, …), after the first reply of a session.');
console.log('Undo: node install-statusline.mjs --uninstall');
