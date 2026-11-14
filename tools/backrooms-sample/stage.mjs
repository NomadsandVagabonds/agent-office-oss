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
//
// The same thing as a function, for whoever builds a page of their own round
// the level (tools/blockrooms/build.mjs: the site): stage(folder, { page, three }).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const under = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? under(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : [])) : []);
const IMPORTS = /(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
// A module may ask for one of the office's own fonts by its address in the office (/vendor/fonts/…, in a style it writes
// into the page). The page this goes on is not at the root of anything, so the staged copy asks for the font beside the
// page instead, and the font comes along with its licence.
const FONT = /\/vendor\/fonts\/([\w.-]+\.woff2)/g;

/**
 * Stage the level into `out`.
 * @param {string} out  the folder (its world/, core/ and vendor/ are replaced; anything else in it is left)
 * @param {{page?: string|null, three?: boolean}} [opt]
 *        page: the file to put there as index.html (default: the sample's page beside this file; null for none)
 *        three: true to copy the vendored three.js and the add-ons the level uses, with their licence (default: the
 *        page takes three.js from a CDN, and nothing of it is copied)
 * @returns {{files: string[], eager: string[]}}  what was staged, relative to the folder · of those, the modules that are
 *          loaded as soon as the level is (everything but the rooms that live in files of their own)
 */
export function stage(out, opt = {}) {
  const seen = new Set(), missing = [], vendored = new Set();
  function resolve(from, spec) {
    if (spec === 'three') return null;                                             // the page's import map says where from
    if (spec.startsWith('/vendor/')) { vendored.add(spec.slice('/vendor/'.length)); return null; }
    if (spec.startsWith('/core/')) return path.join(ROOT, spec.slice(1));
    if (spec.startsWith('/')) return path.join(ROOT, 'public', spec.slice(1));
    if (spec.startsWith('.')) return path.resolve(path.dirname(from), spec);
    return null;
  }
  function walk(file, into = seen) {
    if (into.has(file)) return;
    if (!fs.existsSync(file)) { missing.push(rel(file)); return; }
    into.add(file);
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(IMPORTS)) { const next = resolve(file, m[1] || m[2]); if (next) walk(next, into); }
  }
  walk(path.join(ROOT, 'public/world/dev/backrooms.js'));
  const eager = new Set(seen);
  for (const room of under(path.join(ROOT, 'public/world/backrooms/rooms'))) walk(room);
  if (missing.length) throw new Error('imported, but not there:\n  ' + missing.join('\n  '));

  const fonts = new Set(), staged = [], placed = new Map();
  for (const dir of ['world', 'core', 'vendor']) fs.rmSync(path.join(out, dir), { recursive: true, force: true });
  for (const file of [...seen].sort()) {
    const from = rel(file);
    if (from.startsWith('public/world/dev/')) continue;                           // the dev page itself is not the sample's page
    const to = from.startsWith('public/world/') ? 'world/' + from.slice('public/world/'.length) : from.startsWith('core/') ? from : null;
    if (!to) throw new Error(`do not know where ${from} goes`);
    fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true });
    const src = fs.readFileSync(file, 'utf8'), asked = [...src.matchAll(FONT)].map((m) => m[1]);
    if (asked.length) { for (const name of asked) fonts.add(name); fs.writeFileSync(path.join(out, to), src.replace(FONT, './vendor/fonts/$1')); }
    else fs.copyFileSync(file, path.join(out, to));
    staged.push(to); placed.set(file, to);
  }
  if (fonts.size) {
    const dir = path.join(ROOT, 'public/vendor/fonts');
    fs.mkdirSync(path.join(out, 'vendor/fonts'), { recursive: true });
    const licences = fs.readdirSync(dir).filter((f) => /^LICENSE-.*\.txt$/.test(f) && [...fonts].some((name) => name.startsWith(f.slice('LICENSE-'.length, -'.txt'.length))));
    for (const name of [...fonts, ...licences].sort()) {
      if (!fs.existsSync(path.join(dir, name))) throw new Error(`asked for, but not vendored: vendor/fonts/${name}`);
      fs.copyFileSync(path.join(dir, name), path.join(out, 'vendor/fonts', name));
      staged.push('vendor/fonts/' + name);
    }
  }
  if (opt.three) {
    // three.js itself (the module the import map names, and the core it is built on), each add-on the level asks for and
    // whatever those ask for in turn, and the licence all of it is under
    const dir = path.join(ROOT, 'public/vendor'), need = new Set(['three.module.min.js', 'three.core.min.js', 'LICENSE-three.txt']);
    const more = (name) => {
      if (need.has(name)) return;
      if (!fs.existsSync(path.join(dir, name))) throw new Error(`asked for, but not vendored: vendor/${name}`);
      need.add(name);
      for (const m of fs.readFileSync(path.join(dir, name), 'utf8').matchAll(IMPORTS)) { const spec = m[1] || m[2]; if (spec.startsWith('.')) more(path.posix.normalize(path.posix.join(path.posix.dirname(name), spec))); }
    };
    for (const name of [...vendored].filter((n) => n.startsWith('three-addons/')).sort()) more(name);
    for (const name of [...need].sort()) {
      fs.mkdirSync(path.dirname(path.join(out, 'vendor', name)), { recursive: true });
      fs.copyFileSync(path.join(dir, name), path.join(out, 'vendor', name));
      staged.push('vendor/' + name);
    }
  }
  const page = opt.page === undefined ? path.join(HERE, 'index.html') : opt.page;
  if (page) fs.copyFileSync(page, path.join(out, 'index.html'));
  return { files: [...(page ? ['index.html'] : []), ...staged], eager: [...eager].map((f) => placed.get(f)).filter(Boolean).sort() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] && path.resolve(process.argv[2]);
  if (!out) { console.error('usage: node tools/backrooms-sample/stage.mjs <folder>'); process.exit(2); }
  try { console.log(stage(out).files.join('\n')); }
  catch (err) { console.error(err.message); process.exit(1); }
}
