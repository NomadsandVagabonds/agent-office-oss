#!/usr/bin/env node
import { accountConfig } from './account-config.mjs';
// BlockRooms — the level, built as a site of its own: for whoever wants to walk
// it without an office to run it in. One folder of plain files comes out, to be
// served by anything that serves files.
//
//   node tools/blockrooms/build.mjs <folder>
//
// What goes in:
//   index.html   the front page (home.html beside this file, with home.css,
//                home.js and art.js): the caretaker's own home page, as home
//                pages were in 1998. It is small and has nothing of the level
//                in it, so it is there at once
//   play.html    the page the level is played on (page.html): its head, the
//                import map, and a list of the modules to fetch at once
//   site.js      that page's script: one building after another, tapes that
//                can be handed on (?tape=<seed>), and what the book is told
//   world/ core/ every module the level imports, found by reading the imports
//                (tools/backrooms-sample/stage.mjs does this part), and the
//                rules of the book (core/book.mjs), which both pages share
//   world/dev/perf.js, perf-stats.js
//                the measuring tape, for /play?debug&bench=1 (or &perf=1):
//                imported by site.js only when asked for, and not preloaded
//   vendor/      three.js and the add-ons the level uses, the fonts it asks
//                for, and the licences they are under
//   shots/       pictures from inside, for the front page
//   muzak.mp3    the front page's music when it is switched on: the lift's, from the office (public/audio/)
//   og.jpg       the picture a link to the site is shown with, if there is one
//                beside this file
//   robots.txt
//
// Assets come from this site. Optional accounts add exactly one Supabase
// origin to connect-src; a guest build keeps the original self-only policy. The site's
// own address is not written down anywhere in this repository: where a link
// preview needs it whole, it is taken from SITE_ORIGIN (https://example.app),
// or from what Vercel says the production address is while it builds.
// Prints the files it wrote, one to a line, relative to the folder.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { stage } from '../backrooms-sample/stage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The measuring tape's modules, at their paths in the site (and under public/ in the repository). */
export const PERF = Object.freeze(['world/dev/perf.js', 'world/dev/perf-stats.js']);

/** Where the site will be, whole (https://host), or '' if nobody has said. Never a path, a query or a trailing slash. */
export function originOf(env = process.env) {
  const given = String(env.SITE_ORIGIN || '').trim() || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${String(env.VERCEL_PROJECT_PRODUCTION_URL).trim()}` : '');
  if (!given) return '';
  let url;
  try { url = new URL(given); } catch { throw new Error(`SITE_ORIGIN is not an address: ${given}`); }
  if (url.protocol !== 'https:') throw new Error(`SITE_ORIGIN has to be https (a .app address is nothing else): ${given}`);
  return url.origin;
}

/** The import map the page carries: three.js and the office's two absolute roots, all beside the page. */
export const IMPORT_MAP = JSON.stringify({ imports: { three: './vendor/three.module.min.js', '/vendor/three-addons/': './vendor/three-addons/', '/core/': './core/' } });

/**
 * What a page lets itself do, as a browser will hold it to. Everything from this site and nowhere else; the one
 * script written into the page the level is played on is the import map, and it is allowed by what it says (its hash),
 * not by where it is (a page with no import map — `null` — has no script written into it at all). Styles are written
 * into the page by the level as it goes (the camcorder's lettering, the card), so those are allowed as they come;
 * pictures are drawn into data and blob addresses.
 */
export function policyFor(importMap = IMPORT_MAP, accounts = {}) {
  const hash = importMap === null ? '' : ` 'sha256-${crypto.createHash('sha256').update(importMap).digest('base64')}'`;
  return [
    "default-src 'self'", `script-src 'self'${hash}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
    "media-src 'self' data: blob:", "font-src 'self'", `connect-src 'self'${accounts.url ? " " + accounts.url : ""}`, "worker-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
  ].join('; ');
}

/**
 * Build the site into `out`.
 * @param {string} out
 * @param {{origin?: string, now?: Date}} [opt]  origin: where the site will be (default: originOf()) · now: the day it is built
 * @returns {{files: string[], origin: string, preloaded: number}}
 */
export function build(out, opt = {}) {
  const origin = opt.origin ?? originOf();
  const accounts = accountConfig(opt.accountEnv ?? process.env, { local: opt.localAccounts === true });
  fs.mkdirSync(out, { recursive: true });
  const { files, eager } = stage(out, { page: null, three: true });
  const extra = [];
  const put = (name, text) => { fs.writeFileSync(path.join(out, name), text); extra.push(name); };
  const copy = (name) => { if (!fs.existsSync(path.join(HERE, name))) return false; fs.copyFileSync(path.join(HERE, name), path.join(out, name)); extra.push(name); return true; };

  for (const name of ['site.js', 'home.js', 'home.css', 'trailer-player.js', 'trailer.mp4', 'trailer-poster.jpg', 'art.js', 'archive-page.js', 'archive.css', 'archive-client.js', 'archive-worker.js', 'archive-storage.js', 'archive-cloud.js', 'archive-preview.js', 'archive-card.js', 'archive-stamps.js', 'archive-charts.js']) if (!copy(name)) throw new Error(`tools/blockrooms/${name} is not there`);
  // (the rules of the book, looks and perks, and of the archive: shared by the pages)
  for (const coreName of ['core/book.mjs', 'core/look.mjs', 'core/perks.mjs', 'core/guest-presets.mjs', 'core/archive.mjs']) {
    if (!files.includes(coreName)) {
      fs.mkdirSync(path.join(out, 'core'), { recursive: true });
      fs.copyFileSync(path.join(HERE, '..', '..', coreName), path.join(out, coreName));
      extra.push(coreName);
    }
  }
  // (the dev page's measuring tape: site.js imports it under ?debug&perf=1 or &bench=1 and at no other time. It imports
  // nothing but its own sums, so it needs nothing else staged)
  fs.mkdirSync(path.join(out, 'world', 'dev'), { recursive: true });
  for (const name of PERF) { fs.copyFileSync(path.join(HERE, '..', '..', 'public', name), path.join(out, name)); extra.push(name); }
  const stagedItems = path.join(out, 'world', 'art', 'items.js');
  if (fs.existsSync(stagedItems)) {
    fs.writeFileSync(stagedItems, fs.readFileSync(stagedItems, 'utf8').replaceAll("'/core/look.mjs'", "'../../core/look.mjs'"));
  }
  fs.mkdirSync(path.join(out, 'vendor'), { recursive: true });
  for (const name of ['supabase-2.119.0.js', 'LICENSE-supabase.txt', 'NOTICES-supabase.txt']) { fs.copyFileSync(path.join(HERE, 'vendor', name), path.join(out, 'vendor', name)); extra.push('vendor/' + name); }
  put('account-config.json', JSON.stringify(accounts) + '\n');
  // pictures from inside, for the front page (taken through the level's own camcorder: tools/blockrooms/shots/)
  const shots = path.join(HERE, 'shots');
  if (fs.existsSync(shots)) {
    fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
    for (const name of fs.readdirSync(shots).filter((f) => /^[\w-]+\.jpg$/.test(f)).sort()) { fs.copyFileSync(path.join(shots, name), path.join(out, 'shots', name)); extra.push(`shots/${name}`); }
  }
  const picture = copy('og.jpg');
  // the front page's music, when it is switched on: the lift's, from the office upstairs
  fs.copyFileSync(path.join(HERE, '..', '..', 'public', 'audio', 'elevator-muzak.mp3'), path.join(out, 'muzak.mp3')); extra.push('muzak.mp3');
  put('robots.txt', 'User-agent: *\nAllow: /\n');

  // the modules the level needs before it can show anything, asked for all at once (rooms that live in files of their
  // own are fetched when a building has them, and are not in this list)
  const first = ['site.js', 'vendor/three.module.min.js', 'vendor/three.core.min.js', ...files.filter((f) => f.startsWith('vendor/three-addons/')), ...eager.filter((f) => !f.startsWith('world/dev/'))];
  const preload = first.map((f) => `<link rel="modulepreload" href="./${f}">`).join('\n');
  const og = (at) => [
    origin && `<meta property="og:url" content="${origin}/${at}">`,
    picture && `<meta property="og:image" content="${origin || '.'}/og.jpg">`,
    picture && '<meta property="og:image:width" content="1200">', picture && '<meta property="og:image:height" content="630">',
    `<meta name="twitter:card" content="${picture ? 'summary_large_image' : 'summary'}">`,
    origin && `<link rel="canonical" href="${origin}/${at}">`,
  ].filter(Boolean).join('\n');
  const fill = (name, marks) => {
    let page = fs.readFileSync(path.join(HERE, name), 'utf8');
    for (const [mark, text] of Object.entries(marks)) page = page.replace(`<!--${mark}-->`, text);
    if (/<!--[A-Z]+-->/.test(page)) throw new Error(`${name} has a mark nothing filled in`);
    return page;
  };
  put('play.html', fill('page.html', { CSP: `<meta http-equiv="Content-Security-Policy" content="${policyFor(IMPORT_MAP, accounts)}">`, OG: og('play'), PRELOAD: preload, IMPORTMAP: IMPORT_MAP }));
  // the front page says when it was last touched: the day it was built — of a year it has been for some time
  const day = (opt.now || new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  put('index.html', fill('home.html', { CSP: `<meta http-equiv="Content-Security-Policy" content="${policyFor(IMPORT_MAP, accounts)}">`, OG: og(''), IMPORTMAP: IMPORT_MAP, ACCOUNTS: accounts.enabled ? accounts.provider || 'supabase' : '' })
    .replace('<span id="updated">recently</span>', `<span id="updated">${day} 1998</span>`));
  put('privacy.html', fill('privacy.html', { CSP: `<meta http-equiv="Content-Security-Policy" content="${policyFor(null)}">` }));
  put('archive.html', fill('archive.html', { CSP: `<meta http-equiv="Content-Security-Policy" content="${policyFor(IMPORT_MAP, accounts)}">`, IMPORTMAP: IMPORT_MAP }));
  return { files: [...extra, ...files].sort(), origin, preloaded: first.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] && path.resolve(process.argv[2]);
  if (!out) { console.error('usage: node tools/blockrooms/build.mjs <folder>'); process.exit(2); }
  try {
    const made = build(out, { localAccounts: process.env.BLOCKROOMS_LOCAL_ACCOUNTS === '1' });
    console.log(made.files.join('\n'));
    console.error(`BlockRooms: ${made.files.length} files in ${out}${made.origin ? `, for ${made.origin}` : ' (no address given: link previews will carry no whole address)'}`);
  } catch (err) { console.error(err.message); process.exit(1); }
}
