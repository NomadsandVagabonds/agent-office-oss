#!/usr/bin/env node
// Safely register The Office LOOK-BEFORE-YOU-EDIT hook in ~/.claude/settings.json.
// Same discipline as the other installers, independent and distinctly tagged:
//  - timestamped backup of settings.json first
//  - preserves every existing key; only touches `hooks`
//  - idempotent: re-running won't duplicate; only removes ITS OWN entries
//  - `node install-guard-hook.mjs --uninstall` cleanly removes only these
//
// Registers PreToolUse for the editing tools. hooks/office-guard-hook.mjs asks
// the office whether somebody else is in that file, and passes any answer to
// the agent as context. It never blocks an edit and fails open.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(__dir, 'hooks', 'office-guard-hook.mjs');
const SETTINGS = process.env.OFFICE_CLAUDE_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json');
const MARK = 'office-guard-hook.mjs';     // unique substring = our marker
const MATCHER = 'Edit|Write|MultiEdit|NotebookEdit';

const uninstall = process.argv.includes('--uninstall');
let settings = {};
if (fs.existsSync(SETTINGS)) {
  settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  fs.copyFileSync(SETTINGS, `${SETTINGS}.bak.${Date.now()}`);
} else {
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
}

settings.hooks = settings.hooks || {};
const isOurs = (h) => h && h.command && h.command.includes(MARK);
for (const ev of Object.keys(settings.hooks)) {
  settings.hooks[ev] = (settings.hooks[ev] || [])
    .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) }))
    .filter((g) => g.hooks.length > 0);
  if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
}

if (!uninstall) {
  fs.chmodSync(HOOK, 0o755);
  settings.hooks.PreToolUse = settings.hooks.PreToolUse || [];
  settings.hooks.PreToolUse.push({ matcher: MATCHER, hooks: [{ type: 'command', command: `node ${HOOK}`, _tag: 'agent-office-guard' }] });
}

fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(`${uninstall ? 'Removed' : 'Installed'} the Office look-before-you-edit hook.`);
console.log(uninstall
  ? 'Existing sessions keep it until they restart.'
  : 'New and restarted sessions are told when somebody else is in the file they are about to edit. It never blocks an edit.\nUndo: node install-guard-hook.mjs --uninstall');
