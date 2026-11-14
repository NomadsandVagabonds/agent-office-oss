#!/usr/bin/env node
// Install The Office skill where agent runtimes look for skills, so an agent
// working in ANY folder on this machine is onboarded, not only one whose
// working directory happens to be this repository.
//
//   node install-skill.mjs              install for every runtime below
//   node install-skill.mjs --uninstall  remove those copies (only ones this script wrote)
//   node install-skill.mjs --sync       after editing the skill: refresh the copies kept in this repo
//   node install-skill.mjs --check      exit 1 if a copy in this repo is stale
//
// The skill follows the open Agent Skills layout (<dir>/the-office/SKILL.md):
//   ~/.claude/skills    Claude Code
//   ~/.agents/skills    Codex, and other runtimes that read the shared location
//
// There is one source of truth: .claude/skills/the-office/SKILL.md. Installed
// copies name the `office` command by its full path, so it runs from anywhere.
// Two copies live in this repo for runtimes started inside it, and --sync
// writes both: .agents/skills/the-office/SKILL.md (byte for byte) and SKILL.md
// at the root (the same text under a plainer heading, for anything that just
// reads files).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = path.dirname(fileURLToPath(import.meta.url));
const NAME = 'the-office';
const SOURCE = path.join(HOME, '.claude', 'skills', NAME, 'SKILL.md');
const MIRROR = path.join(HOME, '.agents', 'skills', NAME, 'SKILL.md');
const ROOT_COPY = path.join(HOME, 'SKILL.md');
const TARGETS = [
  { runtime: 'Claude Code', dir: path.join(os.homedir(), '.claude', 'skills', NAME) },
  { runtime: 'Codex and others', dir: path.join(os.homedir(), '.agents', 'skills', NAME) },
];
const MARK = '<!-- the-office skill: installed by install-skill.mjs -->';
const ROOT_HEAD = `# The Office — Shared Agent Skill

This is the shared office behaviour contract for any agent working in this repo
— Claude Code, Codex, Gemini CLI, opencode, or anything else. (Claude Code loads
the same text automatically from \`.claude/skills/the-office/SKILL.md\`; this
file is written from it by \`node install-skill.mjs --sync\`.)
`;

const argv = process.argv.slice(2);
const source = fs.readFileSync(SOURCE, 'utf8');
const parts = /^(---\n[\s\S]*?\n---\n)\n*([\s\S]*)$/.exec(source);
if (!parts) { console.error(`${SOURCE} has no frontmatter`); process.exit(1); }
const [, frontmatter, body] = parts;

/** The root copy: the body, under the heading that file has always had. */
const rootCopy = () => body.replace(/^# .*\n/, ROOT_HEAD);

/** What gets installed: the same skill, saying where `office` lives on this machine. */
function installedCopy() {
  const command = `node "${path.join(HOME, 'office.mjs')}"`;
  return `${frontmatter}\n${MARK}\n> Installed from \`${HOME}\`. Here \`office\` is short for \`${command}\`, which runs from any folder.\n\n`
    + body.replace(/`node office\.mjs/g, '`' + command);
}

const read = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
const COPIES = [{ file: MIRROR, want: () => source }, { file: ROOT_COPY, want: rootCopy }];

if (argv.includes('--check')) {
  const stale = COPIES.filter((c) => read(c.file) !== c.want()).map((c) => path.relative(HOME, c.file));
  console.log(stale.length ? `stale: ${stale.join(', ')} — run: node install-skill.mjs --sync` : 'the skill copies in this repo are in sync');
  process.exit(stale.length ? 1 : 0);
}

if (argv.includes('--sync')) {
  for (const copy of COPIES) {
    fs.mkdirSync(path.dirname(copy.file), { recursive: true });
    fs.writeFileSync(copy.file, copy.want());
    console.log(`synced ${path.relative(HOME, copy.file)}`);
  }
  process.exit(0);
}

for (const target of TARGETS) {
  const file = path.join(target.dir, 'SKILL.md');
  const existing = read(file);
  if (existing !== null && !existing.includes(MARK)) {
    console.log(`skipped    ${file}  (a "${NAME}" skill is already there, and it is not ours)`);
    continue;
  }
  if (argv.includes('--uninstall')) {
    if (existing === null) continue;
    fs.rmSync(file);
    try { fs.rmdirSync(target.dir); } catch { /* something else is in there: leave it */ }
    console.log(`removed    ${file}`);
    continue;
  }
  fs.mkdirSync(target.dir, { recursive: true });
  fs.writeFileSync(file, installedCopy());
  console.log(`${existing === null ? 'installed' : 'updated  '}  ${file}  (${target.runtime})`);
}

if (!argv.includes('--uninstall')) {
  console.log(`\nNew sessions on this machine will see the skill. An agent can also onboard directly:\n  node "${path.join(HOME, 'office.mjs')}" onboard`);
}
