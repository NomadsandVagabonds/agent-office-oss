#!/usr/bin/env node
// BlockRooms — the level, built as a site of its own: for whoever wants to walk
// it without an office to run it in. One folder of plain files comes out, to be
// served by anything that serves files.
//
//   node tools/blockrooms/build.mjs <folder>
//
// What goes in:
//   index.html   a whole page (page.html beside this file): its head, what a
//                link to it looks like when it is passed on, the import map,
//                and a list of the modules to fetch at once
//   site.js      the page's own script (beside this file): one building after
//                another, and tapes that can be handed on (?tape=<seed>)
//   world/ core/ every module the level imports, found by reading the imports
//                (tools/backrooms-sample/stage.mjs does this part)
//   vendor/      three.js and the add-ons the level uses, the fonts it asks
//                for, and the licences they are under
//   og.jpg       the picture a link to the site is shown with, if there is one
//                beside this file
//   robots.txt
//
// Nothing in the folder asks for anything from anywhere else, and the page
// says so in a way a browser enforces (its Content-Security-Policy). The site's
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
 * What the page lets itself do, as a browser will hold it to. Everything from this site and nowhere else; the one
 * script written into the page is the import map, and it is allowed by what it says (its hash), not by where it is.
 * Styles are written into the page by the level as it goes (the camcorder's lettering, the card), so those are allowed
 * as they come; pictures are drawn into data and blob addresses.
 */
export function policyFor(importMap = IMPORT_MAP) {
  const hash = crypto.createHash('sha256').update(importMap).digest('base64');
  return [
    "default-src 'self'", `script-src 'self' 'sha256-${hash}'`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
    "media-src 'self' data: blob:", "font-src 'self'", "connect-src 'self'", "worker-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
  ].join('; ');
}

/**
 * Build the site into `out`.
 * @param {string} out
 * @param {{origin?: string}} [opt]  origin: where the site will be (default: originOf())
 * @returns {{files: string[], origin: string, preloaded: number}}
 */
export function build(out, opt = {}) {
  const origin = opt.origin ?? originOf();
  fs.mkdirSync(out, { recursive: true });
  const { files, eager } = stage(out, { page: null, three: true });
  const extra = [];
  const put = (name, text) => { fs.writeFileSync(path.join(out, name), text); extra.push(name); };
  const copy = (name) => { if (!fs.existsSync(path.join(HERE, name))) return false; fs.copyFileSync(path.join(HERE, name), path.join(out, name)); extra.push(name); return true; };

  copy('site.js');
  const picture = copy('og.jpg');
  put('robots.txt', 'User-agent: *\nAllow: /\n');

  // the modules the level needs before it can show anything, asked for all at once (rooms that live in files of their
  // own are fetched when a building has them, and are not in this list)
  const first = ['site.js', 'vendor/three.module.min.js', 'vendor/three.core.min.js', ...files.filter((f) => f.startsWith('vendor/three-addons/')), ...eager.filter((f) => !f.startsWith('world/dev/'))];
  const preload = first.map((f) => `<link rel="modulepreload" href="./${f}">`).join('\n');
  const og = [
    origin && `<meta property="og:url" content="${origin}/">`,
    picture && `<meta property="og:image" content="${origin || '.'}/og.jpg">`,
    picture && '<meta property="og:image:width" content="1200">', picture && '<meta property="og:image:height" content="630">',
    `<meta name="twitter:card" content="${picture ? 'summary_large_image' : 'summary'}">`,
    origin && `<link rel="canonical" href="${origin}/">`,
  ].filter(Boolean).join('\n');
  const page = fs.readFileSync(path.join(HERE, 'page.html'), 'utf8')
    .replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${policyFor()}">`)
    .replace('<!--OG-->', og)
    .replace('<!--PRELOAD-->', preload)
    .replace('<!--IMPORTMAP-->', IMPORT_MAP);
  if (/<!--[A-Z]+-->/.test(page)) throw new Error('page.html has a mark nothing filled in');
  put('index.html', page);
  return { files: [...extra, ...files].sort(), origin, preloaded: first.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] && path.resolve(process.argv[2]);
  if (!out) { console.error('usage: node tools/blockrooms/build.mjs <folder>'); process.exit(2); }
  try {
    const made = build(out);
    console.log(made.files.join('\n'));
    console.error(`BlockRooms: ${made.files.length} files in ${out}${made.origin ? `, for ${made.origin}` : ' (no address given: link previews will carry no whole address)'}`);
  } catch (err) { console.error(err.message); process.exit(1); }
}
