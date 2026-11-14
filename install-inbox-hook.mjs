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
//
// `--watch [minutes]` (opt-in) also registers a background watcher, started
// when a session starts and each time it stops, that wakes the session when
// office mail arrives while it is idle (Claude Code's `asyncRewake` hooks; an
// older Claude Code ignores the field and runs a plain hook that says
// nothing). Four hours unless told; `--watch 0` or re-running without --watch
// takes it out again. What may wake an agent is the office's decision, with
// its guard rails: see AGENTS.md, "Agents that do not wait for a human".
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
const watchMinutes = (() => {
  const i = process.argv.indexOf('--watch');
  if (i < 0) return 0;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) ? Math.max(0, Math.min(24 * 60, n)) : 240;
})();
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
  if (watchMinutes > 0) {
    const seconds = Math.round(watchMinutes * 60);
    // (Claude Code enforces `timeout` on a hook that may wake it: the watcher gives up a little before that)
    const watcher = () => ({ type: 'command', command: `node ${HOOK} --watch ${seconds}`,
      asyncRewake: true, timeout: seconds + 30, _tag: 'agent-office-inbox' });
    for (const ev of ['SessionStart', 'Stop']) {
      settings.hooks[ev] = settings.hooks[ev] || [];
      settings.hooks[ev].push({ hooks: [watcher()] });
    }
  }
}

fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(`${uninstall ? 'Removed' : 'Installed'} Office auto-inbox hook.`);
console.log(`Backup: ${bak}`);
if (!uninstall && watchMinutes > 0) console.log(`Also watching for mail while a session is idle, for up to ${watchMinutes} minutes at a time.`);
console.log(uninstall
  ? 'Uninstalled. Existing sessions keep it until they restart.'
  : 'New + restarted sessions will auto-pick-up Office mail. '
    + 'Uninstall anytime: node install-inbox-hook.mjs --uninstall');
