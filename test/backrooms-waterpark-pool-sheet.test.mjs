// Every pool's Classic and Low water sheet (the owner, 18 Nov: "ripples with light reflections"): createBasin draws
// causticWaterTex (the waterpark builder's muted ripples) at 0.52 and gives it the ceiling lamps' reflection
// (pool-optics.js); the footbaths the same picture at 0.56. No pool passes a sheet of its own. (An earlier calm sheet
// for the kiddie lagoon alone was a sample, shown to the owner beside this and not kept.)
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

test('the kiddie lagoon draws the default sheet again; the calm sample is gone', () => {
  // (other rooms may pass a sheet of their own by their builder's choice: the slide maze does)
  const room = src('rooms/kiddie-lagoon.js');
  assert.match(room, /createBasin\(c, \{/);
  assert.ok(!/waterTex:|waterAlpha:|calmWaterTex|CALM_WATER/.test(room));
  assert.ok(!/calmWaterTex|CALM_WATER/.test(src('waterpark.js')));
  assert.equal(wp.calmWaterTex, undefined);
});

test('the default sheet: causticWaterTex at 0.52, and the liquid mark is still made', () => {
  const w = src('waterpark.js');
  assert.match(w, /const waterTex = spec\.waterTex \|\| causticWaterTex\(kit, spec\.waterTone \|\| \(depth > 1\.2 \? 'deep' : 'aqua'\)\);/);
  assert.match(w, /addTranslucent\(c, waterSurf, \{\n\s*map: waterTex,\n\s*alpha: spec\.waterAlpha \?\? 0\.52,\n\s*side: THREE\.FrontSide,\n\s*order: 4,\n(?:\s*finishMaterial: [^\n]*\n)?\s*\}\);\n\s*const water = c\.liquid\?\.\(waterSurf, \{ kind: 'water', y: waterY \}\);/);
  // (18 Nov: the optional line is the waterpark's builder's own, the ceiling lamps the caustic sheet reflects at Classic
  // (pool-optics.js); it is not given to a pool with a sheet of its own; none has one)
  assert.match(w, /finishMaterial: c\.rt\.poolLampMap && !spec\.waterTex \?/);
  // the footbaths' sheet
  assert.match(w, /addTranslucent\(c, wb, \{ map: causticWaterTex\(c\.kit, 'aqua'\), alpha: 0\.56, side: THREE\.DoubleSide, order: 4 \}\);\n\s*c\.liquid\?\.\(wb, \{ kind: 'water', y: 0\.15 \}\);/);
  // what the default picture draws. 18 Nov: the waterpark's builder replaced the caustic web with muted ripples
  // (causticWaterTex keeps its name), so the default look DID change, by the builder's own hand; what is pinned now is
  // that picture: 96 x 96, a texel at a time, every shade near the tint with nothing pale, the same every time
  const r = drawn(wp.causticWaterTex(createKit(), 'aqua')), again = drawn(wp.causticWaterTex(createKit(), 'aqua'));
  assert.deepEqual(r, again);
  assert.equal(r.length, 96 * 96);
  for (const [col, , , w, h] of r) {
    const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(col);
    assert.ok(m && w === 1 && h === 1, col);
    assert.ok(Math.max(+m[1], +m[2], +m[3]) < 180, col);
  }
});

