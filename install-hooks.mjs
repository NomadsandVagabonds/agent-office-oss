#!/usr/bin/env node
// Safely register The Office hook bridge in ~/.claude/settings.json.
// - backs up settings.json first (timestamped)
// - preserves every existing key; only touches `hooks`
// - idempotent: re-running won't duplicate entries
// - `node install-hooks.mjs --uninstall` cleanly removes only our entries
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(__dir, 'hooks', 'office-hook.sh');
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const TAG = 'agent-office'; // marker so we only ever remove our own entries

const WITH_MATCHER = ['PreToolUse', 'PostToolUse'];
const NO_MATCHER = ['SessionStart', 'SessionEnd', 'UserPromptSubmit',
  'Notification', 'Stop', 'SubagentStop'];

const uninstall = process.argv.includes('--uninstall');
const settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));

// backup
const bak = `${SETTINGS}.bak.${Date.now()}`;
fs.copyFileSync(SETTINGS, bak);

settings.hooks = settings.hooks || {};
const isOurs = (h) => h && h.command && h.command.includes('office-hook.sh');

// strip any prior Office entries everywhere (clean slate for idempotency)
for (const ev of Object.keys(settings.hooks)) {
  settings.hooks[ev] = (settings.hooks[ev] || [])
    .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) }))
    .filter((g) => g.hooks.length > 0);
  if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
}

if (!uninstall) {
  fs.chmodSync(HOOK, 0o755);
  const entry = () => ({ type: 'command', command: HOOK, _tag: TAG });
  for (const ev of NO_MATCHER) {
    settings.hooks[ev] = settings.hooks[ev] || [];
    settings.hooks[ev].push({ hooks: [entry()] });
  }
  for (const ev of WITH_MATCHER) {
    settings.hooks[ev] = settings.hooks[ev] || [];
    settings.hooks[ev].push({ matcher: '*', hooks: [entry()] });
  }
}

fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(`${uninstall ? 'Removed' : 'Installed'} Office hooks.`);
console.log(`Backup: ${bak}`);
console.log(uninstall
  ? 'Existing sessions keep old hooks until they restart.'
  : 'New Claude Code sessions will now appear in the office.');
