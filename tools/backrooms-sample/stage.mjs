#!/usr/bin/env node
// The Backrooms, on a page of its own — for showing somebody the level without
// an office to run it in. This copies everything the level needs out of the
// working tree into one folder, at the paths index.html (beside this file)
// loads it from. The folder can then be served by anything, or published.
//
//   node tools/backrooms-sample/stage.mjs <folder>
//
// What goes in: the level's own page (index.html), and every module the level
// imports — found by reading the imports, starting from the dev page's script
// and from each room that lives in a file of its own (those are fetched by
// name when a floor has them, so nothing imports them). three.js is not
// copied: the page takes it from a CDN at the version of the vendored copy.
// Prints the files it staged, one to a line, relative to the folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const out = process.argv[2] && path.resolve(process.argv[2]);
if (!out) { console.error('usage: node tools/backrooms-sample/stage.mjs <folder>'); process.exit(2); }

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const seen = new Set(), missing = [];
function resolve(from, spec) {
  if (spec === 'three' || spec.startsWith('/vendor/')) return null;               // from the CDN (the page's import map)
  if (spec.startsWith('/core/')) return path.join(ROOT, spec.slice(1));
  if (spec.startsWith('/')) return path.join(ROOT, 'public', spec.slice(1));
  if (spec.startsWith('.')) return path.resolve(path.dirname(from), spec);
  return null;
}
function walk(file) {
  if (seen.has(file)) return;
  if (!fs.existsSync(file)) { missing.push(rel(file)); return; }
  seen.add(file);
  const src = fs.readFileSync(file, 'utf8');
  const re = /(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (let m; (m = re.exec(src));) { const next = resolve(file, m[1] || m[2]); if (next) walk(next); }
}
const under = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? under(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : [])) : []);

walk(path.join(ROOT, 'public/world/dev/backrooms.js'));
for (const room of under(path.join(ROOT, 'public/world/backrooms/rooms'))) walk(room);
if (missing.length) { console.error('imported, but not there:\n  ' + missing.join('\n  ')); process.exit(1); }

const staged = [];
for (const dir of ['world', 'core']) fs.rmSync(path.join(out, dir), { recursive: true, force: true });
for (const file of [...seen].sort()) {
  const from = rel(file);
  if (from.startsWith('public/world/dev/')) continue;                             // the dev page itself is not the sample's page
  const to = from.startsWith('public/world/') ? 'world/' + from.slice('public/world/'.length) : from.startsWith('core/') ? from : null;
  if (!to) { console.error(`do not know where ${from} goes`); process.exit(1); }
  fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true });
  fs.copyFileSync(file, path.join(out, to));
  staged.push(to);
}
fs.copyFileSync(path.join(HERE, 'index.html'), path.join(out, 'index.html'));
console.log(['index.html', ...staged].join('\n'));
