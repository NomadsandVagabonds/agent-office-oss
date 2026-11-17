import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// (the mesher imports three by its bare name: point that at the vendored copy, as backrooms-wallfit.test.mjs does)
const root = new URL('../', import.meta.url), three = new URL('public/vendor/three.module.min.js', root);
const loader = `export async function resolve(s,c,next){
  if(s==='three')return {url:${JSON.stringify(three.href)},shortCircuit:true};
  return next(s,c);
}`;
register(`data:text/javascript;base64,${Buffer.from(loader).toString('base64')}`, import.meta.url);
const [{ SMALLS, binVox, trolleyVox, coolerVox }, { meshVox }, { isGlow, isGlass }] = await Promise.all([
  import(new URL('public/world/backrooms/smalls.model.js', root).href), import(new URL('public/world/vox/mesher.js', root).href), import(new URL('public/world/vox/vox.js', root).href)]);

// What the office's own measure, in its full-size voxels (read off the mesher): props/kitchen.js bin and cooler, props/trolley.js trolley.
const OFFICE = {
  bin: { x0: -10, y0: 0, z0: -10, x1: 10, y1: 23, z1: 10 },
  trolley: { x0: -15, y0: 1, z0: -10, x1: 15, y1: 38, z1: 10 },
  cooler: { x0: -10, y0: 0, z0: -8, x1: 10, y1: 46, z1: 10 },
};
const MAKE = { bin: binVox, trolley: trolleyVox, cooler: coolerVox };
const tris = (g) => (g ? g.index.count / 3 : 0);

test('the level\'s bin, trolley and cooler are exactly the size of the office\'s, so their colliders do not move', () => {
  const k = 1 / SMALLS.scale;
  for (const name of Object.keys(OFFICE)) {
    const b = MAKE[name]().bounds();
    for (const key of Object.keys(OFFICE[name])) { assert.equal(b[key], OFFICE[name][key] * k, `${name} ${key}`); assert.equal(SMALLS.bounds[name][key], OFFICE[name][key] * k, `${name} ${key}`); }
  }
});

test('what they cost to draw, meshed the way the level meshes them', () => {
  const cost = (name) => { const m = meshVox(MAKE[name](), { ao: false }); return [tris(m.solid), tris(m.glass)]; };
  assert.deepEqual(cost('bin'), [1480, 0]);
  assert.deepEqual(cost('trolley'), [1264, 0]);
  const [solid, glass] = cost('cooler');
  assert.ok(solid <= 1300 && glass <= 2200, `cooler ${solid} + ${glass} glass`);
});

test('the cooler: the bottle and the cup tube are glass, and nothing shines but a light over each tap', () => {
  const v = coolerVox(), lights = [], bx = new Set();
  let glass = 0;
  v.each((x, y, z, c) => { if (isGlow(c)) lights.push([x, y, z]); if (isGlass(c)) glass++; });
  assert.ok(glass > 2000, 'a bottle of it');
  for (const [x] of lights) bx.add(x < -5 ? 'cold' : 'hot');
  assert.equal(bx.size, 2, 'one over the cold tap and one over the hot');
  // the office's are one voxel each, at (−6, 25, 7) and (0, 25, 7): ours are those two voxels doubled, no more and no less
  const want = []; for (const x0 of [-12, 0]) for (const dx of [0, 1]) for (const y of [50, 51]) for (const z of [14, 15]) want.push([x0 + dx, y, z].join());
  assert.deepEqual(lights.map((l) => l.join()).sort(), want.sort());
  assert.equal(binVox().size > 0 && trolleyVox().size > 0, true);
  let other = 0; for (const make of [binVox, trolleyVox]) make().each((x, y, z, c) => { if (isGlow(c) || isGlass(c)) other++; });
  assert.equal(other, 0, 'the bin and the trolley have neither');
});
