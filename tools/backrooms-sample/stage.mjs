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
// A font a module asks for by its address in the office is copied too, with
// its licence, and the staged module asks for it beside the page.
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

// A module may ask for one of the office's own fonts by its address in the office (/vendor/fonts/…, in a style it writes
// into the page). The page this goes on is not at the root of anything, so the staged copy asks for the font beside the
// page instead, and the font comes along with its licence.
const FONT = /\/vendor\/fonts\/([\w.-]+\.woff2)/g, fonts = new Set();

const staged = [];
for (const dir of ['world', 'core', 'vendor']) fs.rmSync(path.join(out, dir), { recursive: true, force: true });
for (const file of [...seen].sort()) {
  const from = rel(file);
  if (from.startsWith('public/world/dev/')) continue;                             // the dev page itself is not the sample's page
  const to = from.startsWith('public/world/') ? 'world/' + from.slice('public/world/'.length) : from.startsWith('core/') ? from : null;
  if (!to) { console.error(`do not know where ${from} goes`); process.exit(1); }
  fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true });
  const src = fs.readFileSync(file, 'utf8'), asked = [...src.matchAll(FONT)].map((m) => m[1]);
  if (asked.length) { for (const name of asked) fonts.add(name); fs.writeFileSync(path.join(out, to), src.replace(FONT, './vendor/fonts/$1')); }
  else fs.copyFileSync(file, path.join(out, to));
  staged.push(to);
}
if (fonts.size) {
  const dir = path.join(ROOT, 'public/vendor/fonts');
  fs.mkdirSync(path.join(out, 'vendor/fonts'), { recursive: true });
  const licences = fs.readdirSync(dir).filter((f) => /^LICENSE-.*\.txt$/.test(f) && [...fonts].some((name) => name.startsWith(f.slice('LICENSE-'.length, -'.txt'.length))));
  for (const name of [...fonts, ...licences].sort()) {
    if (!fs.existsSync(path.join(dir, name))) { console.error(`asked for, but not vendored: vendor/fonts/${name}`); process.exit(1); }
    fs.copyFileSync(path.join(dir, name), path.join(out, 'vendor/fonts', name));
    staged.push('vendor/fonts/' + name);
  }
}
fs.copyFileSync(path.join(HERE, 'index.html'), path.join(out, 'index.html'));
console.log(['index.html', ...staged].join('\n'));
