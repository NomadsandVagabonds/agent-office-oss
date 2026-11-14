// BlockRooms: the level built as a site of its own (tools/blockrooms/build.mjs).
// What matters about it is what a stranger's browser gets: a whole page, every
// file it asks for, nothing from anywhere else, nothing of the office's own
// (its data, its documents, its transcripts), and no address written down in
// the repository — and that what is told to the host matches what is built.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, originOf, policyFor, IMPORT_MAP } from '../tools/blockrooms/build.mjs';
import { stage } from '../tools/backrooms-sample/stage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fresh = (t) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blockrooms-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };
const all = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? all(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')]));
const IMPORTS = /(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

test('the site is two whole pages with everything they ask for beside them, and nothing from anywhere else', (t) => {
  const out = fresh(t), made = build(out, { origin: '' });
  const files = all(out).sort();
  assert.deepEqual(made.files, files, 'what it says it wrote is what is there');
  const page = fs.readFileSync(path.join(out, 'play.html'), 'utf8'), home = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  for (const doc of [page, home]) {
    assert.match(doc, /^<!doctype html>\n<html lang="en">/, 'a document, not a fragment for somebody else to wrap');
    for (const need of ['<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1', '<meta property="og:title" content="BlockRooms">', '<meta http-equiv="Content-Security-Policy"']) assert.ok(doc.includes(need), `a page has no ${need}`);
    assert.match(doc, /<title>BlockRooms[^<]*<\/title>/);
    assert.ok(!/<!--[A-Z]+-->/.test(doc), 'a mark in a page that nothing filled in');
    // nothing is fetched from another site: no address of one anywhere in the page (the name of the SVG format, inside the
    // pictures a page carries in itself, is not an address anybody fetches)
    const elsewhere = [...doc.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '').matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]);
    assert.deepEqual(elsewhere, [], 'a page names another site');
  }
  assert.ok(page.includes('<script type="module" src="./site.js"></script>') && home.includes('<script type="module" src="./home.js"></script>'));
  assert.ok(!files.some((f) => /^(data|public|server|test|tools|docs|hooks|api)\//.test(f) || /knowledge|transcripts|\.env/.test(f)), 'something of the office\'s own is in the site');
  const expected = /^(index\.html|play\.html|site\.js|home\.js|home\.css|art\.js|robots\.txt|og\.jpg|shots\/[\w-]+\.jpg|(world|core|vendor)\/.+)$/;
  assert.ok(files.every((f) => expected.test(f)), `a file nobody expected: ${files.find((f) => !expected.test(f))}`);

  // the import map: three.js and the office's two roots, all beside the page, all there
  const map = JSON.parse(page.match(/<script type="importmap">([^<]+)<\/script>/)[1]);
  assert.deepEqual(map, JSON.parse(IMPORT_MAP));
  for (const [from, to] of Object.entries(map.imports)) assert.ok(to.startsWith('./') && fs.existsSync(path.join(out, to)), `${from} is mapped to ${to}, which is not there`);
  for (const lic of ['vendor/LICENSE-three.txt', 'vendor/three.core.min.js']) assert.ok(files.includes(lic), `${lic} did not come along`);
  // every module asked for at once is there, and every import in every staged file leads to a file in the folder
  const preloads = [...page.matchAll(/<link rel="modulepreload" href="\.\/([^"]+)">/g)].map((m) => m[1]);
  // (a room's file is fetched when a building has that room: only what the deck itself reads from one is asked for at once)
  const rooms = files.filter((f) => f.startsWith('world/backrooms/rooms/'));
  assert.ok(preloads.length > 40 && preloads.includes('site.js') && preloads.includes('world/backrooms/index.js'), 'the level\'s own modules are asked for at once');
  assert.ok(rooms.length > 20 && preloads.filter((f) => rooms.includes(f)).every((f) => /^world\/backrooms\/rooms\/[^/]+\/[^/]+\.js$/.test(f)) && preloads.filter((f) => rooms.includes(f)).length <= 12 && !preloads.includes('world/backrooms/rooms/kanban.js'), 'rooms in files of their own are not');
  assert.equal(new Set(preloads).size, preloads.length);
  for (const f of preloads) assert.ok(files.includes(f), `asked for at once, and not there: ${f}`);
  for (const f of files.filter((n) => /\.m?js$/.test(n))) {
    const src = fs.readFileSync(path.join(out, f), 'utf8');
    // (less its block comments: three.js's add-ons show how to import them in theirs, by a name only a bundler knows)
    for (const m of src.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(IMPORTS)) {
      const spec = m[1] || m[2];
      const to = spec === 'three' ? 'vendor/three.module.min.js' : spec.startsWith('/core/') ? spec.slice(1) : spec.startsWith('/vendor/three-addons/') ? spec.slice(1) : spec.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(f), spec)) : null;
      assert.ok(to, `${f} imports ${spec}, which a page with no office cannot give it`);
      assert.ok(files.includes(to), `${f} imports ${spec}: ${to} is not in the site`);
    }
    assert.ok(!/['"`]\/vendor\/fonts\//.test(src), `${f} still asks the office for a font`);
  }
  for (const font of [...new Set(files.filter((n) => /\.js$/.test(n)).flatMap((f) => [...fs.readFileSync(path.join(out, f), 'utf8').matchAll(/\.\/vendor\/fonts\/([\w.-]+\.woff2)/g)].map((m) => m[1])))]) assert.ok(files.includes(`vendor/fonts/${font}`), `a font is asked for and is not there: ${font}`);
});

test('the front page is the caretaker\'s: every picture it shows is there, every place its script reaches for exists, and its door is the door', (t) => {
  const out = fresh(t);
  build(out, { origin: '', now: new Date('2026-11-14T12:00:00Z') });
  const home = fs.readFileSync(path.join(out, 'index.html'), 'utf8'), script = fs.readFileSync(path.join(out, 'home.js'), 'utf8');
  assert.ok(home.includes('<link rel="stylesheet" href="./home.css">') && fs.existsSync(path.join(out, 'home.css')) && fs.existsSync(path.join(out, 'art.js')));
  assert.ok(!/<script\b(?![^>]*\bsrc=)/.test(home), 'no script is written into the front page: its policy would refuse one');
  assert.equal(home.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1], policyFor(null));
  assert.ok(policyFor(null).split('; ').includes("script-src 'self'"));
  const shots = [...home.matchAll(/<img src="\.\/([^"]+)"[^>]*alt="([^"]*)"/g)];
  assert.ok(shots.length >= 4, 'pictures from inside');
  for (const [, src, alt] of shots) { assert.ok(fs.existsSync(path.join(out, src)), `${src} is shown and is not there`); assert.ok(alt.length > 20, `${src} says nothing to somebody who cannot see it`); }
  for (const id of new Set([...script.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]))) assert.ok(new RegExp(`id="${id}"`).test(home), `home.js reaches for #${id}, which the page does not have`);
  for (const [, to] of home.matchAll(/href="(\.\/play[^"]*)"/g)) assert.match(to, /^\.\/play(\?room=[a-z-]+)?$/);
  assert.ok(home.includes('<a class="door" href="./play" id="door">'), 'the door is a link: it works with nothing switched on');
  assert.ok(home.includes('<span id="updated">14 November 1998</span>'), 'last updated: the day it was built, of the year it has been for some time');
  assert.ok(home.includes('Profiting from the world') === false && script.includes('Profiting from the world’s misery so you don’t have to'), 'MECHA\'s slogan is MECHA\'s own, as it is on its wall');
  // a room an advert or a picture leads to is a room of the deck (one that has not been built yet is an ordinary door: site.js)
  const rooms = new Set([...home.matchAll(/\?room=([a-z-]+)/g), ...script.matchAll(/\?room=([a-z-]+)/g)].map((m) => m[1]));
  const deck = fs.readFileSync(path.join(ROOT, 'public/world/backrooms/gen.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'public/world/backrooms/deck2.js'), 'utf8');
  for (const id of rooms) if (id !== 'mecha') assert.ok(deck.includes(`id: '${id}'`), `?room=${id}: no such room`);
  // what a stranger typed is put on the page as text, never as markup
  assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML|document\.write/.test(script), 'home.js writes markup');
});

test('the page the level is played on holds itself to its own site: its policy allows the one script written into it by what that script says', (t) => {
  const out = fresh(t);
  build(out, { origin: '' });
  const page = fs.readFileSync(path.join(out, 'play.html'), 'utf8');
  const policy = page.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1];
  assert.equal(policy, policyFor());
  const inline = [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1]));
  assert.equal(inline.length, 1, 'one script is written into the page (the import map); the rest are files');
  const hash = crypto.createHash('sha256').update(inline[0][2]).digest('base64');
  assert.ok(policy.includes(`script-src 'self' 'sha256-${hash}'`), 'the import map in the page is not the one the policy allows');
  for (const rule of ["default-src 'self'", "connect-src 'self'", "font-src 'self'", "object-src 'none'", "base-uri 'none'"]) assert.ok(policy.split('; ').includes(rule), `the policy has no ${rule}`);
  assert.ok(!/script-src[^;]*'unsafe-(inline|eval)'/.test(policy), 'scripts are allowed by name, not wholesale');
  assert.ok(!/\son[a-z]+="/.test(page), 'a handler written into the page: the policy would refuse it');
});

test('where the site is, is given when it is built and written down nowhere', (t) => {
  assert.equal(originOf({}), '');
  assert.equal(originOf({ SITE_ORIGIN: 'https://example.app/some/page?x=1' }), 'https://example.app');
  assert.equal(originOf({ VERCEL_PROJECT_PRODUCTION_URL: 'example.app' }), 'https://example.app');
  assert.equal(originOf({ SITE_ORIGIN: 'https://first.app', VERCEL_PROJECT_PRODUCTION_URL: 'second.app' }), 'https://first.app', 'what somebody said outright comes first');
  assert.throws(() => originOf({ SITE_ORIGIN: 'http://example.app' }), /https/);
  assert.throws(() => originOf({ SITE_ORIGIN: 'not an address' }), /not an address/);
  const out = fresh(t);
  build(out, { origin: 'https://example.app' });
  const home = fs.readFileSync(path.join(out, 'index.html'), 'utf8'), page = fs.readFileSync(path.join(out, 'play.html'), 'utf8');
  assert.ok(home.includes('<meta property="og:url" content="https://example.app/">') && home.includes('<link rel="canonical" href="https://example.app/">'));
  assert.ok(page.includes('<meta property="og:url" content="https://example.app/play">') && page.includes('<link rel="canonical" href="https://example.app/play">'));
  // (the repository itself names no site: not in the pages, the scripts, the build, or what the host is told)
  for (const f of ['tools/blockrooms/page.html', 'tools/blockrooms/home.html', 'tools/blockrooms/site.js', 'tools/blockrooms/home.js', 'tools/blockrooms/build.mjs', 'vercel.json', 'api/book.mjs']) {
    const named = [...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/\b[a-z0-9-]+\.app\b/g)].map((m) => m[0]).filter((d) => d !== 'example.app');
    assert.deepEqual(named, [], `${f} names a site`);
  }
});

test('the page\'s own script: a building nobody has had each time, a tape from the address first, and a kept one played back', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools/blockrooms/site.js'), 'utf8');
  assert.match(src, /brand: \{ over: 'OUT OF OFFICE', title: 'BlockRooms', jar: false \}/, 'the card is headed BlockRooms here, and has no jar on it: there is no office to spend a coin in');
  assert.match(src, /let next = asSeed\(q\.get\('tape'\)\) \|\| null;/);
  assert.match(src, /const mine = next \? keptTapes\(\)\.find\(\(t\) => t\.seed === seed\) : null;/);
  assert.match(src, /\.\.\.\(mine \? \{ replay: true, pursuer: typeof mine\.mascot === 'boolean' \? mine\.mascot : undefined \} : \{\}\)/, 'only a tape this browser has kept is played back; somebody else\'s is a building like any other');
  assert.match(src, /if \(result\?\.card\?\.again\) next = /, 'the card put down by its tape\'s number is asking for that building again');
  // it talks to its own site's book and to nobody else, and says two things: that somebody went in, and (unless they
  // have said not to, and never for a tape played back) what a visit that got out came to
  assert.deepEqual([...src.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1].trim()), ["'./api/book'"]);
  assert.ok(!/XMLHttpRequest|sendBeacon|WebSocket/.test(src));
  assert.match(src, /if \(!mine\) tell\(\{ do: 'in' \}\);/);
  assert.match(src, /if \(card\.replay \|\| card\.reason !== 'exit'\) return null;\n  const who = me\(\);\n  if \(!who\.sign\) return null;/);
  assert.match(src, /tell\(\{ do: 'sign', name: who\.name, message: who\.message, run: report \}\)/);
  assert.match(src, /let room = !next && q\.get\('room'\) && Object\.hasOwn\(ARCHETYPES, q\.get\('room'\)\) \? q\.get\('room'\) : null;/, 'an advert\'s room is a room of the deck, or it is an ordinary door');
});

test('what the host is told matches what is built, and only the branch that is for the public is deployed', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.equal(cfg.framework, null);
  assert.equal(cfg.installCommand, '', 'nothing to install: an empty command skips the step');
  const [, script, folder] = cfg.buildCommand.match(/^node (\S+) (\S+)$/) || [];
  assert.ok(script && fs.existsSync(path.join(ROOT, script)), `the build command runs ${script}, which is not there`);
  assert.equal(cfg.outputDirectory, folder, 'the folder that is built is the folder that is served');
  assert.ok(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n').includes(`/${folder}/`), 'the built folder is not for committing');
  assert.deepEqual(cfg.git.deploymentEnabled, { '**': false, 'blockrooms-live': true }, 'helpers push to this repository all day: none of that is to reach the public');
  const everywhere = cfg.headers.find((h) => h.source === '/(.*)').headers.map((h) => h.key);
  for (const key of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy']) assert.ok(everywhere.includes(key), `no ${key}`);
  assert.equal(cfg.cleanUrls, true, 'the page the level is played on is /play');
  // the book: one function, where the host looks for functions, and it is the three lines it says it is
  const fn = fs.readFileSync(path.join(ROOT, 'api/book.mjs'), 'utf8');
  assert.match(fn, /export const GET = \(request\) => handle\(request, ctx\);\nexport const POST = \(request\) => handle\(request, ctx\);/);
  for (const [, from] of fn.matchAll(/from '(\.\.[^']+)'/g)) assert.ok(fs.existsSync(path.join(ROOT, 'api', from)), `api/book.mjs imports ${from}`);
  assert.ok(!/['"`][A-Za-z0-9_-]{24,}['"`]/.test(fn), 'nothing that looks like a key is written into it');
});

test('the sample stager still stages the sample, and a page of its own only when asked', (t) => {
  const out = fresh(t), made = stage(out);
  assert.ok(made.files.includes('index.html') && made.files.includes('world/backrooms/index.js') && made.files.includes('core/runs.mjs'));
  assert.ok(!made.files.some((f) => f.startsWith('vendor/three')), 'the sample takes three.js from elsewhere: none of it is copied');
  assert.ok(made.eager.includes('world/backrooms/index.js') && !made.eager.includes('world/backrooms/rooms/kanban.js') && !made.eager.some((f) => f.startsWith('world/dev/')));
  assert.ok(made.files.includes('world/backrooms/rooms/kanban.js'), 'a room in a file of its own is staged, though nothing imports it');
  const bare = fresh(t);
  assert.ok(!stage(bare, { page: null }).files.includes('index.html') && !fs.existsSync(path.join(bare, 'index.html')));
});
