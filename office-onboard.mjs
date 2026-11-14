#!/usr/bin/env node
// office-onboard.mjs — the first thing to run when you arrive.
//
//   node office-onboard.mjs            your desk, your office right now, then the full skill
//   node office-onboard.mjs --brief    just the live part
//   node office-onboard.mjs --json     the same facts as JSON
//
// Works from any runtime and any directory. No Node? The daemon serves the
// same text:  curl -s "http://localhost:4317/onboard?cwd=$PWD"
import fs from 'node:fs';
import path from 'node:path';
import { OFFICE_HOME, PORT, api, headerHelp, identityQuery, resolveSelf } from './office-self.mjs';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(headerHelp(import.meta.url));
  process.exit(0);
}
const me = resolveSelf(argv);
const SKILL = path.join(OFFICE_HOME, '.claude', 'skills', 'the-office', 'SKILL.md');

let info = null;
try {
  info = await api('/api/onboarding?' + identityQuery(me));
} catch (err) {
  if (!err.unreachable) { console.error(`office-onboard: ${err.message}`); process.exit(1); }
}

if (!info) {
  // Daemon is down: the skill itself is still worth reading.
  console.log(`(The office daemon is not running on port ${PORT}, so there is no live view.`);
  console.log(` Start it with:  cd "${OFFICE_HOME}" && npm run dev)\n`);
  try { console.log(fs.readFileSync(SKILL, 'utf8').replace(/^---\n[\s\S]*?\n---\n+/, '')); }
  catch { console.log(`The skill file is missing: ${SKILL}`); }
} else if (argv.includes('--json')) {
  const { text, ...facts } = info;
  console.log(JSON.stringify(facts, null, 2));
} else if (argv.includes('--brief')) {
  console.log(info.text.split('\n---\n')[0].trimEnd());
  console.log(`\nfull onboarding: node "${path.join(OFFICE_HOME, 'office-onboard.mjs')}"`);
} else {
  console.log(info.text);
}
