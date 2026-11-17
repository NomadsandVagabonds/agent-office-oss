#!/usr/bin/env node
// The look-dev lab's pictures: for each proposed feature, the same room from the same camera, LEFT = the level as it
// draws today (features=none), RIGHT = that feature on, joined side by side; at vhs=0 (clean) and vhs=2 (the camcorder
// players have). Then three or four contact sheets. Also, with --time, rough frame times (software rendering).
// See docs/BACKROOMS-LOOKDEV.md.
//
//   node tools/lookdev-shots.mjs --base http://localhost:4434 --out <dir> [--only 05,16] [--vhs 0,2] [--time [frames]]
//   node tools/lookdev-shots.mjs --round 2 --base http://localhost:4434 --out <dir> [--only 1a,6s] [--vhs 0,2] [--scale 2]
//     round two (look2.js): LEFT = the level at High as it draws now, RIGHT = one feature; frame strips; the sheets
//     sheet-vhs0.png, sheet-vhs2.png and sheet-all-chosen.png
//
// Needs a server for the repository (a scratch daemon on a port of its own: the doc says how), Playwright's Chromium as
// installed on the machine (never installed by this), and ffmpeg for the joins. Nothing is fetched from the network.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const base = arg('base', 'http://localhost:4434');
const out = arg('out', '/tmp/lookdev');
const only = arg('only', null);
const levels = String(arg('vhs', '0,2')).split(',').map(Number);
const timing = arg('time', null);
const require = createRequire('/opt/');
const { chromium } = require('playwright');

// [nn, name, query (room, cam, …), features on the right, what it shows]
const PAIRS = [
  // h — tube light and shadow (the lead)
  ['01', 'h1-tubeshadow-bank', 'room=bank&cam=a', 'tubeshadow', 'baked tube shadows, lightmap floor + re-weighted vertices'],
  ['02', 'h1-tubeshadow-vertexonly-bank', 'room=bank&cam=a', 'tubevert', 'the same, vertices only (floors cut every 0.5 m)'],
  ['03', 'h3-tubeshadow-bankout-bank', 'room=bank&cam=a&bank=out', 'tubeshadow', 'a bank of tubes out: the shadows of the rest'],
  ['04', 'h3-tubeshadow-emergency-bank', 'room=bank&cam=a&lighting=emergency&bank=red', 'tubeshadow', 'emergency red: the red lamps throw long shadows'],
  ['05', 'h2-figshadow-corner-bank', 'room=bank&cam=corner&lighting=emergency&bank=red&t=2', 'figshadow,tubeshadow', 'somebody out of frame: their shadow first'],
  ['06', 'h2-figshadow-office', 'room=office&cam=a&t=2', 'figshadow,contact', 'the walking figure in the lit copier room'],
  ['07', 'h4-torchshadow-torch', 'room=torch&cam=a', 'torchshadow', 'the torch is blocked by the copiers'],
  ['08', 'h4-torchshadow-figure-torch', 'room=torch&cam=figure', 'torchshadow', 'the torch throws the figure on the wall'],
  ['09', 'h5-doorlight-door', 'room=door&cam=front', 'doorlight', 'light through a doorway into a dark room'],
  // a–g
  ['10', 'a-relief-office', 'room=office&cam=a', 'relief', 'carpet pile, raised paper, pitted tiles'],
  ['11', 'a-relief-shiny', 'room=shiny&cam=low', 'relief', 'lino seams, blockwork'],
  ['12', 'b-sheen-office', 'room=office&cam=a', 'sheen', 'carpet and paper sheen, plastic copiers'],
  ['13', 'b-sheen-shiny', 'room=shiny&cam=a', 'sheen', 'lino shine, brass, glass edge'],
  ['14', 'c-reflect-shiny', 'room=shiny&cam=low', 'reflect', 'one cube picture, box-projected, blurred'],
  ['15', 'd-contact-office', 'room=office&cam=side', 'contact', 'soft dark under and beside the copiers'],
  ['16', 'e-water-wet', 'room=wet&cam=a&t=2', 'water', 'flooded patch, bucket in it, tide line'],
  ['17', 'e-water-puddle-wet', 'room=wet&cam=puddle&t=2.1', 'water', 'the puddle under the stain, a drip landing'],
  ['18', 'f-air-tall', 'room=tall&cam=a', 'air', 'haze and fog in the all-hands'],
  ['19', 'f-air-torch', 'room=torch&cam=a', 'air', 'dust in the beam, haze'],
  ['20', 'g-grade-office', 'room=office&cam=a', 'grade', 'the yellow floor graded'],
  ['21', 'g-grade-cold-office', 'room=office&cam=a', 'cold', 'the colder variant'],
  // every room, everything at high
  ['30', 'all-office', 'room=office&cam=a&t=2', 'all', ''],
  ['31', 'all-torch', 'room=torch&cam=a', 'all', ''],
  ['32', 'all-shiny', 'room=shiny&cam=a', 'all', ''],
  ['33', 'all-wet', 'room=wet&cam=a&t=2', 'all', ''],
  ['34', 'all-tall', 'room=tall&cam=a', 'all', ''],
  ['35', 'all-bank', 'room=bank&cam=a', 'all', ''],
  ['36', 'all-door', 'room=door&cam=front', 'all', ''],
];
const SHEETS = [
  ['sheet-0-light-and-shadow.png', ['05', '04', '08', '09'], 2],
  ['sheet-1-light-and-materials.png', ['01', '13', '14'], 0],
  ['sheet-2-water.png', ['16', '17', '33'], 0],
  ['sheet-3-everything-high-vs-today.png', ['30', '32', '34'], 2],
];

// Round two: [id, file name, query, features left, features right, frames (a strip: t values; then LEFT is the first row)]
const PAIRS2 = [
  ['1a', '1-moving-shadows-standing', 'room=r2bank&cam=fig&bank=out&variant=stand', 'none', 'movers'],
  ['1b', '1-moving-shadows-midstride', 'room=r2bank&cam=fig&bank=out&variant=stride', 'none', 'movers'],
  ['1c', '1-moving-shadows-lit-room', 'room=r2office&cam=walk&variant=stride', 'none', 'movers'],
  ['2a', '2-ao-held', 'room=r2office&cam=low&held=1', 'none', 'ao'],
  ['2b', '2-ao-room', 'room=r2office&cam=a&held=1&variant=stand', 'none', 'ao'],
  ['3a', '3-ssr-corridor', 'room=r2lino&cam=a', 'none', 'ssr'],
  ['3b', '3-planar-corridor', 'room=r2lino&cam=a', 'none', 'planar'],
  ['3c', '3-planar-vs-ssr-corridor', 'room=r2lino&cam=a', 'planar', 'ssr'],
  ['3d', '3-ssr-glass-mailroom', 'room=r2shiny&cam=a', 'none', 'ssr'],
  ['4a', '4-shafts-doorway', 'room=r2door&cam=front', 'none', 'shafts'],
  ['4b', '4-shafts-tubes', 'room=r2office&cam=a', 'none', 'shafts'],
  ['4s', '4-shafts-failing-tube-strip', 'room=r2bank&cam=a&flicker=1', 'none', 'shafts', [0, 0.17, 0.34, 0.5, 0.67]],
  ['5a', '5-bloom', 'room=r2office&cam=up', 'none', 'bloom'],
  ['5b', '5-bloom-room', 'room=r2office&cam=a', 'none', 'bloom'],
  ['6a', '6-water', 'room=r2pool&cam=a&t=3', 'none', 'water'],
  ['6b', '6-water-wide', 'room=r2pool&cam=wide&t=3', 'none', 'water'],
  ['6s', '6-water-strip', 'room=r2pool&cam=a', 'none', 'water', [2.6, 2.8, 3.0, 3.2, 3.4]],
  ['7a', '7-materials-mailroom', 'room=r2shiny&cam=low', 'none', 'materials'],
  ['7b', '7-materials-with-planar-and-bloom', 'room=r2lino&cam=a', 'planar,bloom', 'planar,bloom,materials'],
  ['7c', '7-materials-copiers', 'room=r2office&cam=low', 'none', 'materials'],
  // the combination: what the round's verdicts keep (each room's `chosen`, rooms2.js)
  ['9a', 'all-chosen-office', 'room=r2office&cam=walk&variant=stride&held=1', 'none', 'chosen'],
  ['9b', 'all-chosen-bank', 'room=r2bank&cam=fig&bank=out&variant=stride', 'none', 'chosen'],
  ['9c', 'all-chosen-door', 'room=r2door&cam=front', 'none', 'chosen'],
  ['9d', 'all-chosen-corridor', 'room=r2lino&cam=a', 'none', 'chosen'],
  ['9e', 'all-chosen-pool', 'room=r2pool&cam=a&t=3', 'none', 'chosen'],
];
if (arg('round', '1') === '2') { await round2(); process.exit(0); }

mkdirSync(out, { recursive: true });
const tmp = join(out, '.parts'); mkdirSync(tmp, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open(page, query) {
  await page.goto(`${base}/world/dev/lookdev/index.html?${query}`);
  await page.waitForFunction(() => document.title === 'ready' || document.title === 'error', null, { timeout: 240000 });
  if (await page.title() === 'error') throw new Error(`lab failed: ${query}`);
  await page.evaluate(() => document.body.classList.add('shot'));
}

if (timing) {
  // Frame time, software rendering (SwiftShader): relative cost only. The camcorder at its default (vhs=2: a 720×540
  // picture), one CSS pixel to a device pixel.
  const frames = Number(timing) > 1 ? Number(timing) : 200;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const rooms = [['office', 'room=office&cam=a'], ['torch', 'room=torch&cam=a'], ['shiny', 'room=shiny&cam=a'], ['wet', 'room=wet&cam=a'], ['tall', 'room=tall&cam=a'], ['bank', 'room=bank&cam=a'], ['door', 'room=door&cam=front']];
  const sets = ['none', 'tubeshadow', 'figshadow', 'doorlight', 'torchshadow', 'relief', 'sheen', 'reflect', 'contact', 'water', 'air', 'grade', 'all'];
  const table = {};
  for (const [room, q] of rooms) {
    await open(page, `${q}&vhs=2&features=none`);
    table[room] = {};
    for (const f of sets) {
      const ms = await page.evaluate(([f, n]) => { window.__lab.set({ features: f }); return window.__lab.time(n); }, [f, frames]);
      table[room][f] = Math.round(ms * 10) / 10;
      console.log(room, f, table[room][f], 'ms');
    }
  }
  writeFileSync(join(out, 'frame-times.json'), JSON.stringify({ frames, renderer: 'SwiftShader (software)', picture: 'vhs=2, 720x540 internal', table }, null, 1));
  await browser.close();
  process.exit(0);
}

const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('  pageerror:', e.message));
const want = only ? new Set(String(only).split(',')) : null;
const made = new Map();
for (const [nn, name, q, feat, what] of PAIRS) {
  if (want && !want.has(nn)) continue;
  for (const v of levels) {
    const file = join(out, `${nn}-${name}-vhs${v}.png`);
    const left = join(tmp, `${nn}-${v}-L.png`), right = join(tmp, `${nn}-${v}-R.png`);
    const t0 = Date.now();
    await open(page, `${q}&vhs=${v}&features=none`);
    await page.screenshot({ path: left });
    await page.evaluate((f) => window.__lab.set({ features: f }), feat);
    await page.screenshot({ path: right });
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', left, '-i', right, '-filter_complex', 'hstack=2', file]);
    made.set(`${nn}-${v}`, file);
    console.log(file, `${Date.now() - t0}ms`, what);
  }
}
for (const [sheet, list, v] of SHEETS) {
  // (from this run, or from an earlier one in the same folder: `--only` re-takes a few and the sheets keep the rest)
  const onDisk = (nn, lv) => { const p = PAIRS.find((x) => x[0] === nn); return p && join(out, `${nn}-${p[1]}-vhs${lv}.png`); };
  const files = list.map((nn) => [made.get(`${nn}-${v}`), onDisk(nn, v), made.get(`${nn}-0`), onDisk(nn, 0)].find((f) => f && existsSync(f))).filter(Boolean);
  if (files.length < 2) continue;
  const inputs = files.flatMap((f) => ['-i', f]);
  const scaled = files.map((_, i) => `[${i}]scale=2560:-1[s${i}]`).join(';');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', `${scaled};${files.map((_, i) => `[s${i}]`).join('')}vstack=${files.length}`, join(out, sheet)]);
  console.log(join(out, sheet));
}
rmSync(tmp, { recursive: true, force: true });
await browser.close();

async function round2() {
  mkdirSync(out, { recursive: true });
  const parts = join(out, '.parts'); mkdirSync(parts, { recursive: true });
  const scale = Number(arg('scale', 2));
  const browser2 = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser2.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.log('  pageerror:', e.message));
  const want = only ? new Set(String(only).split(',')) : null;
  const ff = (args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);
  for (const [id, name, q, left, right, frames] of PAIRS2) {
    if (want && !want.has(id)) continue;
    for (const v of levels) {
      const file = join(out, `${name}-vhs${v}.png`), t0 = Date.now();
      await page.goto(`${base}/world/dev/lookdev/index.html?${q}&vhs=${v}&features=${left}`);
      await page.waitForFunction(() => document.title === 'ready' || document.title === 'error', null, { timeout: 600000 });
      if (await page.title() === 'error') { console.log('  failed', id, v); continue; }
      await page.evaluate(() => document.body.classList.add('shot'));
      if (!frames) {
        const L = join(parts, `${id}-${v}-L.png`), R = join(parts, `${id}-${v}-R.png`);
        await page.evaluate((f) => window.__lab.set({ features: f }), left); await page.screenshot({ path: L });
        await page.evaluate((f) => window.__lab.set({ features: f }), right); await page.screenshot({ path: R });
        ff(['-i', L, '-i', R, '-filter_complex', 'hstack=2', file]);
      } else {
        // a strip: the frames side by side (each a quarter of the window), LEFT's above, RIGHT's below
        const rows = [];
        for (const [k, f] of [['L', left], ['R', right]]) {
          const shots = [];
          for (let i = 0; i < frames.length; i++) {
            const p = join(parts, `${id}-${v}-${k}${i}.png`);
            await page.evaluate(([f, t]) => window.__lab.set({ features: f, t }), [f, frames[i]]);
            await page.screenshot({ path: p }); shots.push(p);
          }
          const row = join(parts, `${id}-${v}-${k}.png`);
          ff([...shots.flatMap((p) => ['-i', p]), '-filter_complex', `${shots.map((_, i) => `[${i}]scale=iw/2:-1[s${i}]`).join(';')};${shots.map((_, i) => `[s${i}]`).join('')}hstack=${shots.length}`, row]);
          rows.push(row);
        }
        ff(['-i', rows[0], '-i', rows[1], '-filter_complex', 'vstack=2', file]);
      }
      console.log(file, `${Date.now() - t0}ms`);
    }
  }
  // the sheets: one picture of each feature per tape setting, and the combination
  const sheet = (file, ids, v) => {
    const files = ids.map((id) => PAIRS2.find((p) => p[0] === id)).map((p) => join(out, `${p[1]}-vhs${v}.png`)).filter((f) => existsSync(f));
    if (files.length < 2) return;
    ff([...files.flatMap((f) => ['-i', f]), '-filter_complex', `${files.map((_, i) => `[${i}]scale=2560:-1[s${i}]`).join(';')};${files.map((_, i) => `[s${i}]`).join('')}vstack=${files.length}`, join(out, file)]);
    console.log(join(out, file));
  };
  const each = ['1a', '2a', '3b', '4a', '5a', '6a', '7a'];
  for (const v of levels) sheet(`sheet-vhs${v}.png`, each, v);
  sheet('sheet-all-chosen.png', ['9a', '9b', '9c', '9d', '9e'], levels.includes(2) ? 2 : levels[0]);
  rmSync(parts, { recursive: true, force: true });
  await browser2.close();
}
