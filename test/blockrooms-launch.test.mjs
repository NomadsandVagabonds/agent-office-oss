// The graphics screen at launch (public/world/backrooms/launch.rule.js, launch.js): what it offers, when a tier holds,
// what Auto picks from what it measured, what is remembered, and that the pages that show it are wired to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LAUNCH_TIERS, LAUNCH_KEY, BENCH_ORDER, BENCH, frameStats, holds, autoPick, cleanLaunchRecord } from '../public/world/backrooms/launch.rule.js';
import { GRAPHICS } from '../public/world/backrooms/graphics.js';

const steady = (ms, n = 120) => Array.from({ length: n }, () => ms);

test('it offers Low, Medium and High after Auto, measures High first, and every tier is a Graphics setting', () => {
  assert.deepEqual([...LAUNCH_TIERS], ['low', 'medium', 'high']);
  assert.deepEqual([...BENCH_ORDER], ['high', 'medium']);
  for (const t of [...LAUNCH_TIERS, ...BENCH_ORDER]) assert.ok(GRAPHICS.includes(t), t);
  assert.equal(LAUNCH_KEY, 'blockrooms:graphics');
  assert.ok(BENCH.settleS + BENCH.measureS <= 3, 'a few seconds a tier');
});

test('frame stats: median, nine in ten, frames a second; nonsense left out', () => {
  assert.deepEqual(frameStats([]), { frames: 0, median: null, p90: null, fps: null });
  const s = frameStats([...steady(16, 90), ...steady(50, 10), NaN, -1, Infinity]);
  assert.equal(s.frames, 100);
  assert.equal(s.median, 16);
  assert.equal(s.p90, 50);
  assert.equal(s.fps, Math.round((1000 / ((16 * 90 + 50 * 10) / 100)) * 10) / 10);
});

test('a tier holds at 40 frames a second with nine in ten under 40 ms, and not on too few frames', () => {
  assert.ok(holds(frameStats(steady(16.7))));
  assert.ok(holds(frameStats(steady(25))));
  assert.ok(!holds(frameStats(steady(26))));
  assert.ok(!holds(frameStats([...steady(16, 80), ...steady(45, 20)])), 'hitches in more than one frame in ten');
  assert.ok(holds(frameStats([...steady(16, 95), ...steady(80, 5)])), 'a few hitches are not a slow machine');
  assert.ok(!holds(frameStats(steady(10, BENCH.minFrames - 1))));
  assert.ok(!holds(null));
});

test('Auto picks the highest tier that holds, else Low; nothing measured is the in-game Auto', () => {
  const r = (tier, ms) => ({ tier, stats: frameStats(steady(ms)) });
  assert.equal(autoPick([r('high', 16)]), 'high');
  assert.equal(autoPick([r('high', 30), r('medium', 20)]), 'medium');
  assert.equal(autoPick([r('high', 30), r('medium', 30)]), 'low');
  assert.equal(autoPick([r('medium', 16), r('high', 16)]), 'high', 'High first, whatever the order given');
  assert.equal(autoPick([]), 'auto');
  assert.equal(autoPick(null), 'auto');
  assert.equal(autoPick([{ tier: 'high', stats: frameStats([]) }]), 'auto');
});

test('what is remembered is cleaned', () => {
  assert.equal(cleanLaunchRecord(null), null);
  assert.equal(cleanLaunchRecord([]), null);
  assert.equal(cleanLaunchRecord({ tier: 'ultra' }), null);
  assert.deepEqual(cleanLaunchRecord({ tier: 'high', auto: true, picked: 'high' }), { tier: 'high', auto: true, picked: 'high' });
  assert.deepEqual(cleanLaunchRecord({ tier: 'low', auto: 'yes', picked: 'nonsense' }), { tier: 'low', auto: false, picked: null });
});

test('the play page asks before the first visit, offers it again from Settings, and says when nothing can draw', () => {
  const site = fs.readFileSync('tools/blockrooms/site.js', 'utf8');
  assert.match(site, /import\('\.\/world\/backrooms\/launch\.js'\)/);
  assert.match(site, /launch\.graphicsAvailable\(\)\)\) \{ launch\.cantRun\(\); return; \}/);
  assert.match(site, /launch\.shouldAsk\(\)\)\) await launch\.firstLaunch\(/);
  assert.match(site, /onGraphicsTest: \(handle\) => launch\.retest\(/);
  // (and the dev page imports it, which is also how the site's build finds it to stage)
  assert.match(fs.readFileSync('public/world/dev/backrooms.js', 'utf8'), /import\('\.\.\/backrooms\/launch\.js'\)/);
  const menu = fs.readFileSync('public/world/backrooms/menu.js', 'utf8');
  assert.match(menu, /onGraphicsTest \? h\('button\.br-menu-test'/);
  assert.match(menu, /mount\(node\) \{ overlay\.append\(node\); \}/);
  assert.match(fs.readFileSync('public/world/backrooms/index.js', 'utf8'), /onGraphicsTest: opt\.onGraphicsTest && /);
  // (no words on the screen but the tiers', what Auto chose, and the one for a machine that cannot draw)
  const launch = fs.readFileSync('public/world/backrooms/launch.js', 'utf8');
  const words = [...launch.matchAll(/h\('[^']*', (?:\{[^}]*\}, )?'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(words.sort(), ['NO SIGNAL', 'THIS MACHINE CAN\u2019T RUN BLOCKROOMS', '\u25AE\u25AE\u25AE'].sort());   // (the last: Auto measuring)
});
