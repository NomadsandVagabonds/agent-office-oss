#!/usr/bin/env node
// Safely register The Office AUTO-INBOX hook in ~/.claude/settings.json.
// Same discipline as install-hooks.mjs, independent + distinctly tagged:
//  - timestamped backup of settings.json first
//  - preserves every existing key; only touches `hooks`
//  - idempotent: re-running won't duplicate; only removes ITS OWN entries
//  - `node install-inbox-hook.mjs --uninstall` cleanly removes only these
//
// Registers Stop (hands-free pickup when the agent goes idle) and
// UserPromptSubmit (surfaces mail when the human is at the CLI anyway).
// Both run office-inbox-hook.mjs, which fails open and is a fast no-op
// for sessions with no Office mail.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(__dir, 'hooks', 'office-inbox-hook.mjs');
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const MARK = 'office-inbox-hook.mjs';     // unique substring = our marker
const EVENTS = ['Stop', 'UserPromptSubmit'];

const uninstall = process.argv.includes('--uninstall');
const settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));

const bak = `${SETTINGS}.bak.${Date.now()}`;
fs.copyFileSync(SETTINGS, bak);

settings.hooks = settings.hooks || {};
const isOurs = (h) => h && h.command && h.command.includes(MARK);

// strip any prior entries of ours everywhere (clean slate for idempotency)
for (const ev of Object.keys(settings.hooks)) {
  settings.hooks[ev] = (settings.hooks[ev] || [])
    .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) }))
    .filter((g) => g.hooks.length > 0);
  if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
}

if (!uninstall) {
  fs.chmodSync(HOOK, 0o755);
  const entry = () => ({ type: 'command',
    command: `node ${HOOK}`, _tag: 'agent-office-inbox' });
  for (const ev of EVENTS) {
    settings.hooks[ev] = settings.hooks[ev] || [];
    settings.hooks[ev].push({ hooks: [entry()] });
  }
}

fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(`${uninstall ? 'Removed' : 'Installed'} Office auto-inbox hook.`);
console.log(`Backup: ${bak}`);
console.log(uninstall
  ? 'Uninstalled. Existing sessions keep it until they restart.'
  : 'New + restarted sessions will auto-pick-up Office mail. '
    + 'Uninstall anytime: node install-inbox-hook.mjs --uninstall');
