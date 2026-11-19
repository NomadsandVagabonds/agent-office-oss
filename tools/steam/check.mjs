#!/usr/bin/env node
// The spike's check (P-1): the shell opens the built site from disk, the front page and the level come up with
// nothing refused by the page's policy, a visit is played from its first part to its last and out by the way out,
// and the card comes up at the end. It reads the shell's frame-rate counter along the way.
//
//   node tools/blockrooms/build.mjs tools/steam/site      (or: cd tools/steam && npm run site)
//   xvfb-run -a node tools/steam/check.mjs [--site tools/steam/site] [--depths 3] [--shot out/play.png] [--gpu]
//
// It drives the level through its ?debug handle (descend, then finish by the way out): it proves the shell carries a
// whole visit, not that a person can walk one. The frame rate here is a software renderer in a virtual display, and
// says nothing about a real machine. Linux only: Windows and Mac are not checked by this.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback; };
const site = path.resolve(arg('site', path.join(HERE, 'site')));
const depths = Number(arg('depths', 3));
const shot = arg('shot', '');
const require = createRequire(import.meta.url);

function playwright() {
  for (const from of [import.meta.url, '/opt/node-tools/', '/opt/']) { try { return createRequire(from)('playwright'); } catch { /* next */ } }
  return null;
}
const pw = playwright();
if (!pw?._electron) { console.error('steam check: Playwright is not here (it is only used to drive the shell for this check)'); process.exit(2); }
if (!fs.existsSync(path.join(site, 'play.html'))) { console.error(`steam check: no site in ${site}; node tools/blockrooms/build.mjs ${site}`); process.exit(2); }

const fails = [], refused = [], errors = [];
const say = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`); if (!ok) fails.push(what); };
const watch = (page) => {
  page.on('console', (m) => {
    const t = m.text();
    if (/Content.Security.Policy|Refused to/i.test(t)) refused.push(t);
    else if (m.type() === 'error' && !/api\/(book|where)|503|Failed to load resource/.test(t)) errors.push(t);
  });
  page.on('pageerror', (e) => errors.push(String(e?.message || e)));
};
const fpsOf = async (page) => page.evaluate(() => { const b = document.getElementById('shell-fps'); return b?.dataset.fps ? { fps: Number(b.dataset.fps), worst: Number(b.dataset.worst) } : null; });

const app = await pw._electron.launch({
  executablePath: require('electron'),
  args: [path.join(HERE, 'main.mjs'), '--site', site, '--start', `play?debug&mute&depths=${depths}`, ...(argv.includes('--gpu') ? [] : ['--software-gl']), ...(process.env.CI || !process.env.DISPLAY ? ['--no-sandbox'] : [])],
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
  timeout: 60_000,
});
const readings = [];
try {
  const page = await app.firstWindow();
  watch(page);
  say(page.url().startsWith('app://blockrooms/play'), `opened ${page.url()}`);
  const shellKind = await page.evaluate(() => window.blockroomsShell?.kind);
  say(shellKind === 'steam', `the page sees window.blockroomsShell (kind: ${shellKind})`);
  const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
  say(/script-src 'self' 'sha256-/.test(csp), 'the site\'s own CSP is on the page');

  // the level comes up: the import map resolved three and /core/, every module came from app://
  await page.waitForFunction(() => window.__backrooms && window.__backrooms.state === 'play', null, { timeout: 120_000 });
  say(true, 'the level is up and playing (import map, /core/ paths and modules loaded under the CSP)');
  const plan = await page.evaluate(() => window.__backrooms.plan().depths);
  say(plan === depths, `the building has ${plan} parts`);
  await page.waitForTimeout(2500);
  readings.push({ at: 'landed', ...(await fpsOf(page)) });
  if (shot) { fs.mkdirSync(path.dirname(path.resolve(shot)), { recursive: true }); await page.screenshot({ path: shot }); console.log(`      (picture: ${shot})`); }

  // down through every part, waiting where the part below is still being built
  for (let d = 1; d < plan; d++) {
    await page.waitForFunction(() => window.__backrooms?.state === 'play' && !!window.__backrooms.ahead, null, { timeout: 120_000 });
    await page.evaluate(() => window.__backrooms.descend());
    await page.waitForFunction((n) => window.__backrooms?.level?.depth === n && window.__backrooms.state === 'play', d, { timeout: 120_000 });
    await page.waitForTimeout(1500);
    readings.push({ at: `part ${d + 1}`, ...(await fpsOf(page)) });
    say(true, `down to part ${d + 1} of ${plan}`);
  }
  // and out by the way out: the visit ends and its card comes up
  await page.evaluate(() => window.__backrooms.finish('exit'));
  await page.waitForSelector('.brc-box', { timeout: 120_000 });
  say(true, 'out by the way out: the card came up');
  const card = await page.evaluate(() => document.querySelector('.brc-box')?.innerText.replace(/\s+/g, ' ').slice(0, 160));
  console.log(`      (card: ${card})`);
  say(refused.length === 0, `nothing refused by the CSP${refused.length ? `: ${refused.slice(0, 3).join(' | ')}` : ''}`);
  say(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
} catch (err) {
  say(false, `stopped: ${String(err?.message || err).split('\n')[0]}`);
  if (refused.length) console.log('      refused:', refused.slice(0, 5));
  if (errors.length) console.log('      errors:', errors.slice(0, 5));
} finally {
  for (const r of readings) console.log(`      fps ${r.at}: ${r.fps ?? '?'} (worst frame ${r.worst ?? '?'} ms)`);
  await app.close().catch(() => {});
}
console.log(fails.length ? `steam check: ${fails.length} failed` : 'steam check: the shell played a visit through');
process.exit(fails.length ? 1 : 0);
