#!/usr/bin/env node
// The captions: the command an agent typed, on label tape, for the takes where it is not obvious that an agent did it.
// They are set in the office's own type and colours (public/world/ui/ui.css) by a browser, so they match what is next to
// them; each is written as a transparent PNG for the edit to lay over a take. (The title cards are titles/titles.html.)
//
//   node rig/cards.mjs [outdir] [base]        base: any running office (for its fonts), default http://localhost:4410
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || path.join(HERE, '..', 'out', 'cards'));
const base = process.argv[3] || 'http://localhost:4410';
fs.mkdirSync(out, { recursive: true });

const CSS = `
@font-face { font-family: "Pixelify Sans"; src: url("/vendor/fonts/pixelify-sans-400.woff2") format("woff2"); font-weight: 400; }
@font-face { font-family: "Pixelify Sans"; src: url("/vendor/fonts/pixelify-sans-600.woff2") format("woff2"); font-weight: 600; }
@font-face { font-family: "IBM Plex Mono"; src: url("/vendor/fonts/ibm-plex-mono-400.woff2") format("woff2"); font-weight: 400; }
@font-face { font-family: "IBM Plex Mono"; src: url("/vendor/fonts/ibm-plex-mono-600.woff2") format("woff2"); font-weight: 600; }
:root { --edge: #080d0b; --board: #14201c; --board-2: #1c2c26; --brass: #cfa84e; --brass-hi: #ecd08a; --brass-lo: #8a6c28; --tape: #14110f; --ink: #f4f0e6; --paper: #f4ecd6; }
* { box-sizing: border-box; }
html, body { margin: 0; background: transparent; }
body { width: 1920px; height: 1080px; position: relative; overflow: hidden; -webkit-font-smoothing: none; }
/* the nameplate from the top-left of the office, at the size of a door plate */
.plate { position: relative; display: inline-flex; align-items: center; height: 152px; padding: 0 84px; border: 8px solid var(--edge); background: linear-gradient(#dfbd66, #c39a3e);
  color: #3a2a08; font: 600 76px/1 "Pixelify Sans", monospace; letter-spacing: .18em; text-indent: .18em; text-shadow: 0 4px 0 rgba(255, 255, 255, .35); white-space: nowrap;
  box-shadow: 16px 16px 0 rgba(0, 0, 0, .42), inset 0 -10px 0 rgba(138, 108, 40, .55), inset 0 6px 0 rgba(255, 244, 200, .4); }
.plate::before, .plate::after { content: ''; position: absolute; top: 50%; width: 16px; height: 16px; margin-top: -8px; background: #7a5d1e; box-shadow: inset 4px 4px 0 rgba(0, 0, 0, .35); }
.plate::before { left: 24px; } .plate::after { right: 24px; }
/* label tape: what the ticker in the bottom-left corner of the office is printed on */
.tape { display: inline-block; padding: 14px 24px 16px; background: var(--tape); color: var(--ink); font: 400 34px/1.15 "Pixelify Sans", monospace; letter-spacing: .03em; white-space: nowrap;
  box-shadow: 8px 8px 0 rgba(0, 0, 0, .42); }
.tape.cmd { font: 400 31px/1.2 "IBM Plex Mono", monospace; letter-spacing: 0; padding: 14px 24px 15px; }
.tape.cmd b { color: var(--brass-hi); font-weight: 600; margin-right: 14px; }
.end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 44px; }
.end .tape { font-size: 40px; padding: 16px 28px 19px; }
/* a full card: the colour the office is before its doors open */
.card { position: absolute; inset: 0; background: #1b1622; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 48px; }
.card::after { content: ''; position: absolute; inset: 0; background: radial-gradient(120% 90% at 50% 45%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, .42) 100%); }
.name { display: flex; align-items: stretch; gap: 22px; }
/* the version, on a keycap (what the dock's buttons are) */
.cap { display: flex; align-items: center; justify-content: center; min-width: 152px; height: 152px; padding: 0 26px 10px; border: 8px solid var(--edge); background: var(--board-2); color: var(--brass-hi);
  font: 600 76px/1 "Pixelify Sans", monospace; letter-spacing: .04em; box-shadow: 16px 16px 0 rgba(0, 0, 0, .42), inset 0 -14px 0 rgba(0, 0, 0, .34), inset 0 5px 0 rgba(255, 255, 255, .08); }
.card .tape { font-size: 44px; padding: 16px 30px 20px; }
/* a section card: two strips out of the label maker */
.strips { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
.strips .tape { font-size: 66px; padding: 20px 36px 26px; box-shadow: 12px 12px 0 rgba(0, 0, 0, .42); }
.strips .tape + .tape { margin-left: 92px; }
.shade { position: absolute; inset: 0; background: rgba(9, 8, 14, .56); }
.caption { position: absolute; left: 64px; bottom: 60px; }
`;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;

// what an agent typed, for the takes where it is not obvious that an agent did it
const COMMANDS = {
  join: 'office join --provider gemini --name "Ada"',
  me: 'office me --species cat --accessory tophat',
  desk: 'office me --desk "bonsai,mug,duck,lavalamp"',
  create: 'office create first-deploy.json',
  dm: 'office dm "Pewter Vireo" "…returns 200 with an empty body. Intended?"',
  done: 'office task move t_mwgo done',
  coffee: 'office use coffee',
  jukebox: 'office use jukebox',
  lift: 'office use lift pasture',
  resign: 'office resign --handoff HANDOFF.md --note "Out of context…"',
};
const CARDS = Object.fromEntries(Object.entries(COMMANDS).map(([k, text]) => [`cmd-${k}`, page(`<div class="caption"><span class="tape cmd"><b>$</b>${esc(text)}</span></div>`)]));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const tab = await context.newPage();
for (const [name, html] of Object.entries(CARDS)) {
  await tab.route('**/__promo/card.html', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }), { times: 1 });
  await tab.goto(`${base}/__promo/card.html`, { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(150);
  await tab.screenshot({ path: path.join(out, `${name}.png`), omitBackground: true });
  console.log('card', name);
}
await browser.close();
