#!/usr/bin/env node
// office-knowledge.mjs — the §5c "yours to own" half of the shared ergonomic
// layer. Sibling of office-msg.mjs (comms) and office-create.mjs (legacy).
//
// knowledge.mjs already walks every project's .md and writes the per-dept
// source-of-truth the office Binder reads. Two gaps it leaves, both closed
// here, both the exact office-msg move (one command, no human relay):
//
//   1. refresh — re-run the ingest after an agent writes docs, so the Binder
//      self-updates instead of waiting for someone to remember to run it.
//   2. read    — let an agent actually *read* another project's binder from
//      the CLI, the way office-msg lets it talk without a human relay.
//
// Usage:
//   node office-knowledge.mjs refresh
//   node office-knowledge.mjs watch          (auto-refresh on .md changes)
//   node office-knowledge.mjs list
//   node office-knowledge.mjs docs <dept>
//   node office-knowledge.mjs read <dept> <match...>
//   node office-knowledge.mjs search <query...>   (across every project)
//
// Reads the static files knowledge.mjs writes (public/knowledge/*) straight
// off disk — zero daemon edits, works with the daemon down. refresh shells
// out to knowledge.mjs (single source of truth; never reimplements the walk).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KDIR = path.join(HERE, 'public', 'knowledge');
const argv = process.argv.slice(2);
// dirs the ingest never reads — don't trigger a refresh on churn inside them
const WATCH_SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next',
  'vendor', '.venv', 'site', '.pytest_cache', 'coverage', '.cache',
  'codex-inbox', 'worktrees']);

function help() {
  console.log(
    'node office-knowledge.mjs refresh            re-run the ingest\n'
    + 'node office-knowledge.mjs watch              auto-refresh on .md changes\n'
    + 'node office-knowledge.mjs list               projects in the binder\n'
    + 'node office-knowledge.mjs docs <dept>        docs in one project\n'
    + 'node office-knowledge.mjs read <dept> <q>    print a matching doc\n'
    + 'node office-knowledge.mjs search <q>         search across all projects'
  );
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function resolveDept(ref) {
  const idx = readJson(path.join(KDIR, '_index.json'));
  const projects = (idx && idx.projects) || [];
  const needle = String(ref || '').trim().toLowerCase();
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return projects.find((p) => p.deptId.toLowerCase() === needle)
    || projects.find((p) => norm(p.deptId) === norm(needle)
      || norm(p.project) === norm(needle))
    || projects.find((p) => p.deptId.toLowerCase().includes(needle)
      || p.project.toLowerCase().includes(needle))
    || null;
}

const cmd = argv[0];
if (!cmd || cmd === '--help' || cmd === '-h') { help(); process.exit(0); }

if (cmd === 'refresh') {
  // Single source of truth: run the real generator, don't reimplement it.
  const r = spawnSync(process.execPath, [path.join(HERE, 'knowledge.mjs')],
    { cwd: HERE, encoding: 'utf8' });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.status !== 0) {
    console.error('office-knowledge: ingest failed' + (r.stderr ? ' — ' + r.stderr.trim() : ''));
    process.exit(r.status || 1);
  }
  console.log('binder refreshed — the office serves the new docs immediately.');
  process.exit(0);
}

if (cmd === 'watch') {
  // Run-and-leave: watch the same roots knowledge.mjs walks and re-ingest
  // (debounced) whenever a .md changes, so the Binder self-refreshes. Sibling
  // ethos to observe.mjs / watchdog.mjs — no daemon edits, single source of
  // truth (spawns knowledge.mjs, never reimplements the walk).
  const PROFILES = path.join(os.homedir(), '.claude', 'agent-office', 'profiles.json');
  let byCwd = {};
  try { byCwd = JSON.parse(fs.readFileSync(PROFILES, 'utf8')).byCwd || {}; } catch { /* none */ }
  const roots = [...new Set([HERE, ...Object.keys(byCwd)])].filter((d) => {
    try { return fs.statSync(d).isDirectory(); } catch { return false; }
  });
  const relevant = (fn) => fn && /\.mdx?$/i.test(fn)
    && !fn.split(path.sep).some((seg) => WATCH_SKIP.has(seg));

  let timer = null, running = false, dirty = false;
  const ingest = () => {
    if (running) { dirty = true; return; }
    running = true; dirty = false;
    const r = spawn(process.execPath, [path.join(HERE, 'knowledge.mjs')],
      { cwd: HERE, stdio: 'ignore' });
    r.on('exit', (code) => {
      running = false;
      const t = new Date().toLocaleTimeString();
      console.log(`[${t}] binder ` + (code === 0 ? 'refreshed' : `refresh FAILED (exit ${code})`));
      if (dirty) { timer = setTimeout(ingest, 300); }  // a write landed mid-ingest
    });
  };
  const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(ingest, 1500); };

  let watched = 0;
  for (const root of roots) {
    try {
      fs.watch(root, { recursive: true }, (_e, fn) => { if (relevant(fn)) schedule(); });
      watched += 1;
    } catch (e) {
      console.error(`  (can't watch ${root}: ${e && e.message})`);
    }
  }
  if (!watched) {
    console.error('office-knowledge: nothing watchable. Recursive fs.watch needs '
      + 'macOS/Windows, or Node 20+ on Linux. Use `refresh` manually meanwhile.');
    process.exit(1);
  }
  console.log(`binder watch — auto-refresh on .md changes across ${watched} root(s). Ctrl-C to stop.`);
  process.stdin.resume();   // keep alive
}

if (cmd === 'list') {
  const idx = readJson(path.join(KDIR, '_index.json'));
  if (!idx || !Array.isArray(idx.projects)) {
    console.error('office-knowledge: no binder index yet — run `refresh` first.');
    process.exit(1);
  }
  for (const p of idx.projects)
    console.log(`${p.deptId.padEnd(10)} ${p.project.padEnd(24)} ${p.docs} doc(s)`);
  console.log(`\ngenerated ${new Date(idx.generatedAt).toLocaleString('en-US',
    { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`);
  process.exit(0);
}

if (cmd === 'docs') {
  const dept = resolveDept(argv[1]);
  if (!dept) { console.error(`office-knowledge: no project matching "${argv[1]}".`); process.exit(1); }
  const data = readJson(path.join(KDIR, dept.deptId + '.json'));
  if (!data) { console.error(`office-knowledge: ${dept.deptId}.json missing — run refresh.`); process.exit(1); }
  console.log(`# ${data.project}  (${data.deptId})  — ${data.docs.length} doc(s)\n`);
  for (const d of data.docs)
    console.log(`  ${d.path}` + (d.title && d.title !== d.path ? `  — ${d.title}` : ''));
  process.exit(0);
}

if (cmd === 'read') {
  const dept = resolveDept(argv[1]);
  if (!dept) { console.error(`office-knowledge: no project matching "${argv[1]}".`); process.exit(1); }
  const q = argv.slice(2).join(' ').trim().toLowerCase();
  if (!q) { console.error('office-knowledge: a doc match string is required.'); process.exit(1); }
  const data = readJson(path.join(KDIR, dept.deptId + '.json'));
  if (!data) { console.error(`office-knowledge: ${dept.deptId}.json missing — run refresh.`); process.exit(1); }
  const hit = data.docs.find((d) => d.path.toLowerCase() === q)
    || data.docs.find((d) => d.path.toLowerCase().includes(q)
      || (d.title || '').toLowerCase().includes(q));
  if (!hit) {
    console.error(`office-knowledge: no doc in ${dept.deptId} matches "${q}". `
      + `Try: node office-knowledge.mjs docs ${dept.deptId}`);
    process.exit(1);
  }
  console.log(`# ${hit.title}\n# ${data.project} · ${hit.path} · ${hit.bytes}b\n`
    + '─'.repeat(60) + '\n');
  console.log(hit.text);
  process.exit(0);
}

if (cmd === 'search') {
  const q = argv.slice(1).join(' ').trim().toLowerCase();
  if (!q) { console.error('office-knowledge: a search query is required.'); process.exit(1); }
  const idx = readJson(path.join(KDIR, '_index.json'));
  if (!idx || !Array.isArray(idx.projects)) {
    console.error('office-knowledge: no binder index yet — run `refresh` first.');
    process.exit(1);
  }
  let total = 0, docsHit = 0;
  for (const p of idx.projects) {
    const data = readJson(path.join(KDIR, p.deptId + '.json'));
    if (!data || !Array.isArray(data.docs)) continue;
    const hits = [];
    for (const d of data.docs) {
      const inMeta = d.path.toLowerCase().includes(q) || (d.title || '').toLowerCase().includes(q);
      const body = (d.text || '').toLowerCase();
      const bi = body.indexOf(q);
      if (!inMeta && bi < 0) continue;
      let snip = '';
      if (bi >= 0) {
        const start = Math.max(0, bi - 36);
        snip = (start > 0 ? '…' : '')
          + d.text.slice(start, bi + q.length + 44).replace(/\s+/g, ' ').trim() + '…';
      }
      hits.push({ path: d.path, title: d.title, snip });
    }
    if (!hits.length) continue;
    docsHit += hits.length;
    console.log(`\n# ${data.project}  (${p.deptId})  — ${hits.length} match(es)`);
    for (const h of hits.slice(0, 8)) {
      console.log(`  ${h.path}` + (h.title && h.title !== h.path ? `  — ${h.title}` : ''));
      if (h.snip) console.log(`    ${h.snip}`);
    }
    if (hits.length > 8) console.log(`  …and ${hits.length - 8} more`);
    total += 1;
  }
  console.log(docsHit
    ? `\n${docsHit} doc(s) across ${total} project(s) match "${q}".`
    : `\nno binder docs match "${q}".`);
  process.exit(0);
}

if (cmd !== 'watch') {   // 'watch' intentionally stays alive (no exit above)
  console.error(`office-knowledge: unknown command "${cmd}"`);
  help();
  process.exit(1);
}
