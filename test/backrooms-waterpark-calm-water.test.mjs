// The calm water sample (docs/BACKROOMS-GRAPHICS.md, water): one room, the kiddie lagoon, draws its Classic and Low
// water sheet with `calmWaterTex` (waterpark.js) instead of the caustic cells; every other basin and footbath keeps
// `causticWaterTex` at its old opacity. The option is createBasin's own `waterTex` / `waterAlpha`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { register } from 'node:module';

const root = new URL('../', import.meta.url);
register(
  `data:text/javascript,${encodeURIComponent(
    `export function resolve(s,c,next){` +
      `if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};` +
      `if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};` +
      `return next(s,c);` +
    `}`,
  )}`,
  import.meta.url,
);

// a canvas that records every rectangle filled on it, and in what colour
function recorder() {
  const rects = [];
  const g = { fillStyle: '#000', fillRect(x, y, w, h) { rects.push([this.fillStyle, x, y, w, h]); } };
  return { rects, getContext: () => g, style: {} };
}
const made = [];
const oldDocument = globalThis.document;
globalThis.document = { createElement: () => { const c = recorder(); made.push(c); return c; } };
test.after(() => { globalThis.document = oldDocument; });

const { createKit } = await import('../public/world/backrooms/kit.js');
const wp = await import('../public/world/backrooms/waterpark.js');
const DIR = new URL('../public/world/backrooms/', import.meta.url);
const src = (f) => readFileSync(new URL(f, DIR), 'utf8');
const drawn = (tex) => tex.image.rects;

test('the option exists: calmWaterTex and its palette, beside causticWaterTex', () => {
  assert.equal(typeof wp.calmWaterTex, 'function');
  assert.equal(typeof wp.causticWaterTex, 'function');
  const t = wp.CALM_WATER.lagoon;
  for (const k of ['base', 'lo', 'hi']) assert.match(t[k], /^#[0-9a-f]{6}$/);
  assert.ok(t.alpha > 0.3 && t.alpha < 0.7);
});

test('only the kiddie lagoon uses it, through createBasin\'s waterTex and waterAlpha', () => {
  const users = [];
  const walk = (dir) => { for (const f of readdirSync(dir)) { const p = new URL(f, dir); if (statSync(p).isDirectory()) walk(new URL(f + '/', dir)); else if (f.endsWith('.js') && /calmWaterTex|CALM_WATER/.test(readFileSync(p, 'utf8'))) users.push(p.href.slice(DIR.href.length)); } };
  walk(DIR);
  assert.deepEqual(users.sort(), ['rooms/kiddie-lagoon.js', 'waterpark.js']);
  const room = src('rooms/kiddie-lagoon.js');
  assert.match(room, /createBasin\(c, \{[\s\S]*?waterTex: calmWaterTex\(kit\),\s*waterAlpha: CALM_WATER\.lagoon\.alpha,[\s\S]*?\}\);/);
  assert.doesNotMatch(room, /causticWaterTex/);
});

test('the default look is unchanged: the caustic cells, at 0.52, and the liquid mark is still made', () => {
  const w = src('waterpark.js');
  assert.match(w, /const waterTex = spec\.waterTex \|\| causticWaterTex\(kit, spec\.waterTone \|\| \(depth > 1\.2 \? 'deep' : 'aqua'\)\);/);
  assert.match(w, /addTranslucent\(c, waterSurf, \{\n\s*map: waterTex,\n\s*alpha: spec\.waterAlpha \?\? 0\.52,\n\s*side: THREE\.FrontSide,\n\s*order: 4,\n\s*\}\);\n\s*c\.liquid\?\.\(waterSurf, \{ kind: 'water', y: waterY \}\);/);
  // the footbaths' sheet
  assert.match(w, /addTranslucent\(c, wb, \{ map: causticWaterTex\(c\.kit, 'aqua'\), alpha: 0\.56, side: THREE\.DoubleSide, order: 4 \}\);\n\s*c\.liquid\?\.\(wb, \{ kind: 'water', y: 0\.15 \}\);/);
  // what the caustic picture draws: the base, then 2 px cells of the pale web and the mid band (counted as it was)
  const kit = createKit();
  const r = drawn(wp.causticWaterTex(kit, 'aqua'));
  assert.deepEqual(r[0], ['#138ba1', 0, 0, 64, 64]);
  assert.equal(r.filter((x) => x[0] === '#e8feff').length, CAUSTIC_HI);
  assert.equal(r.filter((x) => x[0] === '#32b8cf').length, CAUSTIC_MID);
  kit.dispose?.();
});

test('the calm picture: one colour and large patches a shade off, in 4 px texels, nothing pale, the same every time', () => {
  const a = drawn(wp.calmWaterTex(createKit())), b = drawn(wp.calmWaterTex(createKit()));
  assert.deepEqual(a, b);
  const t = wp.CALM_WATER.lagoon;
  assert.deepEqual(a[0], [t.base, 0, 0, 64, 64]);
  const rest = a.slice(1);
  assert.ok(rest.length > 256 * 0.25 && rest.length < 256 * 0.75, `${rest.length} of 256 texels in a patch`);
  for (const [col, x, y, w, h] of rest) {
    assert.ok(col === t.lo || col === t.hi, col);
    assert.ok(x % 4 === 0 && y % 4 === 0 && w === 4 && h === 4);
  }
  assert.ok(rest.some((x) => x[0] === t.lo) && rest.some((x) => x[0] === t.hi));
  // low contrast and no glow: every shade within 24 of the base on each channel, none near white
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (const k of ['lo', 'hi']) rgb(t[k]).forEach((v, i) => assert.ok(Math.abs(v - rgb(t.base)[i]) <= 24));
  for (const k of ['base', 'lo', 'hi']) assert.ok(Math.max(...rgb(t[k])) < 180);
  // seeded from fixed numbers, never Math.random
  const body = src('waterpark.js').match(/export function calmWaterTex[\s\S]*?\n\}\n/)[0];
  assert.doesNotMatch(body, /Math\.random/);
});

// the caustic picture's pale-web and mid-band cells, as drawn before the sample (unchanged by it)
const CAUSTIC_HI = 236, CAUSTIC_MID = 236;
