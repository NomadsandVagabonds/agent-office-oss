#!/usr/bin/env node
// The Office — project knowledge ingester.  Walks every project's .md
// (CLAUDE.md, AGENTS.md, README, docs/**, agent-written notes) and builds
// one per-department source-of-truth file at public/knowledge/<deptId>.json,
// which the daemon already serves statically (zero daemon edits, like
// creations.json). Run: `node knowledge.mjs`.  Re-run to refresh.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dir, 'public', 'knowledge');
const PROFILES = path.join(os.homedir(), '.claude', 'agent-office',
  'profiles.json');
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next',
  'vendor', '.venv', 'site', '.pytest_cache', 'coverage', '.cache',
  'codex-inbox',     // runtime agent mailboxes — never source-of-truth
  'worktrees']);     // .claude/worktrees/* — ephemeral per-agent git
                     // worktree dupes; they were starving real root docs
                     // out of the file cap and making binders 100% noise
const MAX_FILES = 60, MAX_TEXT = 16000, MAX_DEPTH = 5;

function prettyName(s) {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function loadProfiles() {
  try { return JSON.parse(fs.readFileSync(PROFILES, 'utf8')); }
  catch { return { departments: [], byCwd: {} }; }
}
function deptOf(cwd, departments) {
  for (const d of departments)
    if ((d.match || []).some((m) => cwd.includes(m)))
      return { id: d.id, name: d.name || prettyName(d.id) };
  const base = cwd.replace(/\/+$/, '').split('/').pop() || 'desk';
  return { id: base, name: prettyName(base) };
}
function walk(root, rel = '', depth = 0, acc = []) {
  if (depth > MAX_DEPTH || acc.length >= MAX_FILES) return acc;
  let ents;
  try { ents = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); }
  catch { return acc; }
  for (const e of ents) {
    if (acc.length >= MAX_FILES) break;
    if (e.name.startsWith('.') && e.name !== '.claude') {
      if (e.name !== '.cursor') continue;
    }
    if (SKIP.has(e.name)) continue;
    const r = rel ? path.join(rel, e.name) : e.name;
    if (e.isDirectory()) walk(root, r, depth + 1, acc);
    else if (/\.mdx?$/i.test(e.name)) acc.push(r);
  }
  return acc;
}
function readDoc(root, rel) {
  try {
    const full = path.join(root, rel);
    const st = fs.statSync(full);
    if (st.size > 400 * 1024) return null;            // skip huge
    const raw = fs.readFileSync(full, 'utf8');
    const text = raw.length > MAX_TEXT
      ? raw.slice(0, MAX_TEXT) + '\n\n…(truncated)…' : raw;
    const head = raw.split('\n').find((l) => /^#{1,3}\s/.test(l));
    return {
      title: (head ? head.replace(/^#+\s*/, '') : rel.split('/').pop())
        .slice(0, 70),
      bytes: st.size,
      text,
    };
  } catch { return null; }
}

const { departments = [], byCwd = {} } = loadProfiles();
// The Office's own repo is the one project that MUST always be in the
// Binder — its CONTRACT/HANDOFF/KNOWLEDGE are the source of truth agents
// browse from inside the Office — yet it lives in no profile (no agent
// runs *here*). Seed it explicitly so the cabinet is never empty at home.
const cwds = [...new Set([__dir, ...Object.keys(byCwd)])];
const byDept = new Map();
for (const cwd of cwds) {
  try { if (!fs.statSync(cwd).isDirectory()) continue; } catch { continue; }
  const d = deptOf(cwd, departments);
  if (!byDept.has(d.id)) byDept.set(d.id, { ...d, roots: [], docs: [] });
  const bucket = byDept.get(d.id);
  bucket.roots.push(cwd);
  const proj = cwd.split('/').pop();
  for (const rel of walk(cwd)) {
    const doc = readDoc(cwd, rel);
    if (doc) bucket.docs.push({ path: proj + '/' + rel, ...doc });
  }
}

fs.mkdirSync(OUT, { recursive: true });
// Trustworthy order: shallowest first (a project's top-level CONTRACT/
// README beats a vendored sub-tool's nested CLAUDE.md), then doc kind,
// then path. Reorders only — never drops a doc.
const depthOf = (p) => (p.match(/\//g) || []).length;
const kindOf = (p) => /CLAUDE\.md$/i.test(p) ? 0 : /AGENTS\.md$/i.test(p) ? 1
  : /README/i.test(p) ? 2 : 3;
const index = [];
for (const [id, b] of byDept) {
  b.docs.sort((x, y) => depthOf(x.path) - depthOf(y.path)
    || kindOf(x.path) - kindOf(y.path)
    || x.path.localeCompare(y.path));
  b.docs = b.docs.slice(0, MAX_FILES);
  const payload = { deptId: id, project: b.name, generatedAt: Date.now(),
    roots: b.roots, docs: b.docs };
  fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(payload));
  index.push({ deptId: id, project: b.name, docs: b.docs.length });
  console.log(`  ${b.name} (${id}): ${b.docs.length} docs`);
}
fs.writeFileSync(path.join(OUT, '_index.json'),
  JSON.stringify({ generatedAt: Date.now(), projects: index }));
console.log(`knowledge → public/knowledge/  (${index.length} projects)`);
