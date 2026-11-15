// Out of Office: what is lying about gives a small start now and then, so that it is seen (inventory-world.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// (the module draws with the 3D library, which a test has not got: the rule is read out of the file and run by itself)
const src = fs.readFileSync(new URL('../public/world/backrooms/inventory-world.js', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('export const JIGGLE'), src.indexOf('const phaseOf')).replace(/export /g, '');
const { JIGGLE, jiggleAt } = new Function(body + '; return { JIGGLE, jiggleAt };')();

test('a thing on the floor is still most of the time, and gives a small start every few seconds', () => {
  let moving = 0, most = 0, high = 0; const n = 5500;
  for (let i = 0; i < n; i++) { const j = jiggleAt(i * JIGGLE.every / n); if (j.tilt || j.hop) moving++; most = Math.max(most, Math.abs(j.tilt)); high = Math.max(high, j.hop); }
  assert.ok(moving / n < 0.12, 'still nine tenths of the time');
  assert.ok(most > 0.08 && most <= JIGGLE.tilt && high > 0.01 && high <= JIGGLE.hop, 'small: a rock and a hop, not a spin');
  assert.deepEqual(jiggleAt(JIGGLE.lasts + 0.01), { tilt: 0, hop: 0 }, 'and it comes back to rest exactly');
  assert.notDeepEqual(jiggleAt(0.1, 0), jiggleAt(0.1, 2), 'two things are not in step');
});

test('it is the floor\'s own tick that moves it, for things in rooms near the visitor only', () => {
  assert.match(src, /if \(e\.active && e\.rt\.near\) \{[\s\S]{0,160}jiggleAt\(clock, e\.phase/);
});
