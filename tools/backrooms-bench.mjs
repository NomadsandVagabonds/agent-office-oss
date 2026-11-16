#!/usr/bin/env node
// The level's fixed camera tour (the dev page's &bench=1, public/world/dev/perf.js), run headless for a few seeds: one JSON
// file with every result, and a small table on stdout. It starts nothing but the browser: the office has to be running
// already (`--base`, default http://localhost:4317). docs/BACKROOMS-GRAPHICS.md, phase 0, says what the numbers mean.
//
//   node tools/backrooms-bench.mjs [--base http://localhost:4317] [--seeds 7,21,88] [--out file.json]
//        [--size 1280x720] [--flags 'vhs=0&dpr=1'] [--timeout 300]
//
// Headless Chromium here draws in software (SwiftShader): the numbers compare one build of the level with another on the
// same machine and say nothing about how it runs on real hardware.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback; };
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('node tools/backrooms-bench.mjs [--base http://localhost:4317] [--seeds 7,21,88] [--out file.json] [--size 1280x720] [--flags "vhs=0&dpr=1"] [--timeout 300]');
  process.exit(0);
}
const base = arg('base', `http://localhost:${process.env.OFFICE_PORT || 4317}`).replace(/\/$/, '');
const seeds = arg('seeds', '7,21,88').split(',').map((s) => s.trim()).filter(Boolean);
const out = arg('out', join(tmpdir(), `backrooms-bench-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
const [width, height] = arg('size', '1280x720').split('x').map(Number);
const extra = new URLSearchParams(arg('flags', ''));
const timeout = Number(arg('timeout', 300)) * 1000;

async function loadPlaywright() {
  try { return createRequire('/opt/')('playwright'); } catch { /* not there: try the ordinary way */ }
  try { return await import('playwright'); } catch { return null; }
}
const pw = await loadPlaywright();
if (!pw?.chromium) {
  console.error('backrooms-bench: Playwright is not installed here, so there is no browser to run the tour in.\n' +
    'Run the tour by hand instead: open /world/dev/backrooms.html?seed=7&bench=1 and wait for "bench done".');
  process.exit(2);
}
try { const r = await fetch(`${base}/api/health`); if (!r.ok) throw new Error(`HTTP ${r.status}`); }
catch (err) { console.error(`backrooms-bench: no office answering at ${base} (${err.message}). Start one, or pass --base.`); process.exit(2); }

const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
try {
  for (const seed of seeds) {
    const q = new URLSearchParams({ seed, bench: '1', mute: '1', pursuer: '0', card: '0' });
    for (const [k, v] of extra) q.set(k, v);
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    let line = null;
    page.on('console', (m) => {
      const text = m.text();
      if (m.type() === 'error') errors.push(text.slice(0, 300));
      if (text.startsWith('[bench] {')) line = text.slice(8);
    });
    page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 300)));
    const url = `${base}/world/dev/backrooms.html?${q}`;
    const began = Date.now();
    process.stderr.write(`seed ${seed}: ${url}\n`);
    try {
      await page.goto(url);
      await page.waitForFunction(() => document.title === 'bench done' || document.title.startsWith('over:'), null, { timeout, polling: 500 });
    } catch (err) { errors.push(`timed out or failed: ${err.message.split('\n')[0]}`); }
    const report = line ? JSON.parse(line) : null;
    for (const st of report?.stations || []) if (st.stood !== st.room) errors.push(`station ${st.i} (${st.arch} ${st.what}) stood in room ${st.stood}, not ${st.room}`);
    results.push({ seed, url, wallSeconds: Math.round((Date.now() - began) / 100) / 10, errors, report });
    await page.close();
  }
} finally { await browser.close(); }

const doc = { note: 'Headless Chromium, software rendering (SwiftShader): good for comparing builds on one machine, says nothing about real hardware.',
  base, size: `${width}x${height}`, when: new Date().toISOString(), results };
writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');

const cell = (v) => (v === null || v === undefined ? '–' : String(v));
const rows = [['seed', 'stations', 'frames', 'ms mean', 'p50', 'p95', 'p99', 'worst', 'draws mean/max', 'tris mean/max', 'tour s', 'errors']];
for (const r of results) {
  const o = r.report?.overall;
  rows.push(o ? [r.seed, r.report.stations.length, o.frames, o.ms.mean, o.ms.p50, o.ms.p95, o.ms.p99, o.ms.worst,
    `${o.calls.mean}/${o.calls.max}`, `${o.tris.mean}/${o.tris.max}`, r.report.seconds, r.errors.length + (r.report.aborted ? ' (stopped)' : '')].map(cell)
    : [r.seed, '–', '–', '–', '–', '–', '–', '–', '–', '–', '–', `${r.errors.length} (no result)`]);
}
const widths = rows[0].map((_, i) => Math.max(...rows.map((row) => row[i].length)));
console.log(`Backrooms bench · ${base} · ${width}x${height} · ${results[0]?.report?.gpu || 'renderer unknown'}`);
console.log('SOFTWARE RENDERING: these numbers compare builds on this machine and say nothing about real hardware.');
for (const row of rows) console.log(row.map((c, i) => c.padEnd(widths[i])).join('  '));
for (const r of results) for (const e of r.errors) console.log(`  seed ${r.seed}: ${e}`);
console.log(`written: ${out}`);
process.exit(results.every((r) => r.report && !r.report.aborted && !r.errors.length) ? 0 : 1);
