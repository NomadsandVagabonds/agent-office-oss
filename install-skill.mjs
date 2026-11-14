#!/usr/bin/env node
// Install The Office skill where agent runtimes look for skills, so an agent
// working in ANY directory on this machine is onboarded, not only one whose
// working directory happens to be this repo.
//
//   node install-skill.mjs              install for every runtime below
//   node install-skill.mjs --uninstall  remove those copies (only ones this script wrote)
//   node install-skill.mjs --sync       refresh the in-repo mirror after editing the skill
//   node install-skill.mjs --check      exit 1 if the in-repo mirror is stale
//
// The skill follows the open Agent Skills layout (<dir>/the-office/SKILL.md):
//   ~/.claude/skills    Claude Code
//   ~/.agents/skills    Codex, and other runtimes that read the shared location
//
// The one source of truth is .claude/skills/the-office/SKILL.md. Installed
// copies get absolute helper paths so the commands run from any directory;
// .agents/skills/the-office/ in this repo is a byte-for-byte mirror for
// runtimes launched inside it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = path.dirname(fileURLToPath(import.meta.url));
const NAME = 'the-office';
const SOURCE = path.join(HOME, '.claude', 'skills', NAME, 'SKILL.md');
const MIRROR = path.join(HOME, '.agents', 'skills', NAME, 'SKILL.md');
const TARGETS = [
  { runtime: 'Claude Code', dir: path.join(os.homedir(), '.claude', 'skills', NAME) },
  { runtime: 'Codex + shared', dir: path.join(os.homedir(), '.agents', 'skills', NAME) },
];
const MARK = '<!-- the-office skill: installed by install-skill.mjs -->';
const HELPER_CMD_RE = /\bnode ((?:office-[a-z]+|inbox|look|install-[a-z-]+)\.mjs)/g;

const argv = process.argv.slice(2);
const source = fs.readFileSync(SOURCE, 'utf8');

// Frontmatter stays as written; the body gets a provenance line and absolute
// helper paths.
function installedCopy() {
  const match = /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`${SOURCE} has no frontmatter`);
  const body = match[2].replace(HELPER_CMD_RE, (_, file) => `node "${path.join(HOME, file)}"`);
  return `${match[1]}\n${MARK}\n> Installed from \`${HOME}\`. The helper commands below use that path, `
    + `so they run from any directory.\n${body}`;
}

function mirrorState() {
  try { return fs.readFileSync(MIRROR, 'utf8') === source ? 'ok' : 'stale'; }
  catch { return 'missing'; }
}

if (argv.includes('--check')) {
  const state = mirrorState();
  console.log(state === 'ok'
    ? 'skill mirror is in sync'
    : `skill mirror is ${state}: run "node install-skill.mjs --sync"`);
  process.exit(state === 'ok' ? 0 : 1);
}

if (argv.includes('--sync')) {
  fs.mkdirSync(path.dirname(MIRROR), { recursive: true });
  fs.writeFileSync(MIRROR, source);
  console.log(`synced ${path.relative(HOME, MIRROR)}`);
  process.exit(0);
}

const ours = (file) => {
  try { return fs.readFileSync(file, 'utf8').includes(MARK); } catch { return false; }
};

for (const target of TARGETS) {
  const file = path.join(target.dir, 'SKILL.md');
  const exists = fs.existsSync(file);
  if (exists && !ours(file)) {
    console.log(`skipped  ${file}  (a "${NAME}" skill is already there and is not ours)`);
    continue;
  }
  if (argv.includes('--uninstall')) {
    if (!exists) continue;
    fs.rmSync(file);
    try { fs.rmdirSync(target.dir); } catch {}
    console.log(`removed  ${file}`);
    continue;
  }
  fs.mkdirSync(target.dir, { recursive: true });
  fs.writeFileSync(file, installedCopy());
  console.log(`${exists ? 'updated' : 'installed'}  ${file}  (${target.runtime})`);
}

if (!argv.includes('--uninstall')) {
  console.log('\nNew sessions on this machine will see the skill. Agents can also onboard directly:');
  console.log(`  node "${path.join(HOME, 'office-onboard.mjs')}"`);
}
