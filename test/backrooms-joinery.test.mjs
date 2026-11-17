import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const root = new URL('../', import.meta.url), three = new URL('public/vendor/three.module.min.js', root);
register(`data:text/javascript;base64,${Buffer.from(`export async function resolve(s,c,next){ if(s==='three')return {url:${JSON.stringify(three.href)},shortCircuit:true}; return next(s,c); }`).toString('base64')}`, import.meta.url);
const [W, P, { meshVox }, { isGlow, isGlass }] = await Promise.all(['public/world/backrooms/window.model.js', 'public/world/backrooms/panelling.model.js', 'public/world/vox/mesher.js', 'public/world/vox/vox.js'].map((f) => import(new URL(f, root).href)));
const COST = [42, 86, 36];                                        // sill, casing, bars at 1.2 m by 1.1 m
const tris = (v) => { const m = meshVox(v, { ao: false }); return m.solid.index.count / 3; };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const metres = (v, d) => { const b = v.bounds(); return [(b.x1 - b.x0) * d.scale[0], (b.y1 - b.y0) * d.scale[1], (b.z1 - b.z0) * d.scale[2]]; };
const plain = (v) => { let n = 0; v.each((x, y, z, c) => { if (isGlow(c) || isGlass(c)) n++; }); return n === 0; };

test('a window\'s joinery comes out to the sizes of the five blocks it stands in for', () => {
  for (const [w, h] of [[1.2, 1.1], [0.9, 0.8], [2.0, 1.3], [0.61, 0.47]]) {
    const sill = W.sillVox(w), sd = W.sillDims(w), m1 = metres(sill, sd);
    assert.ok(near(m1[0], w + 0.16) && near(m1[1], 0.05) && near(m1[2], 0.07), `sill ${m1}`);
    assert.equal(sill.bounds().x0, -sill.bounds().x1); assert.equal(sill.bounds().y0, 0); assert.equal(sill.bounds().z0, 0);
    const casing = W.casingVox({ w, h }), cd = W.casingDims({ w, h }), m2 = metres(casing, cd), cb = casing.bounds();
    assert.ok(near(m2[0], w + 0.12) && near(m2[1], h + 0.06) && near(m2[2], 0.03), `casing ${m2}`);
    assert.equal(cb.x0, -cb.x1); assert.equal(cb.y0, 0); assert.equal(cb.z0, 0);
    // the opening is clear, and near enough the hole's own size: a jamb is 0.06 m and the head 0.06 m, to a voxel's rounding
    for (let y = 0; y < cb.y1 - 4; y++) assert.equal(casing.has(0, y, 0), false);
    assert.equal(casing.has(0, cb.y1 - 1, 0), true);
    assert.ok(Math.abs(4 * cd.scale[0] - 0.06) < 0.004 && Math.abs(4 * cd.scale[1] - 0.06) < 0.004, 'jamb and head about 6 cm');
    const bars = W.barsVox({ w, h }), bd = W.barsDims({ w, h }), m3 = metres(bars, bd), bb = bars.bounds();
    assert.ok(near(m3[0], w) && near(m3[1], h) && near(m3[2], 0.03), `bars ${m3}`);
    assert.equal(bb.x0, -bb.x1); assert.equal(bb.z0, -bb.z1); assert.equal(bb.y0, 0);
    for (const v of [sill, casing, bars]) assert.ok(plain(v), 'nothing shines, nothing is glass');
  }
});

test('a whole window costs under the builder\'s ceiling of 400 triangles at 1.2 m', () => {
  const w = 1.2, h = 1.1, cost = [tris(W.sillVox(w)), tris(W.casingVox({ w, h })), tris(W.barsVox({ w, h }))];
  assert.ok(cost[0] + cost[1] + cost[2] <= 400, `sill ${cost[0]} + casing ${cost[1]} + bars ${cost[2]}`);
  assert.deepEqual(cost, COST);
});

test('a panel\'s frame is the bead the wall\'s picture draws: 0.55 m square, 2.5 cm wide, 1.25 cm proud, and cheap', () => {
  for (const flip of [false, true]) {
    const v = P.panelFrameVox('#8a6a48', { flip }), b = v.bounds(), s = P.PANELLING.voxel;
    assert.ok(near((b.x1 - b.x0) * s, 0.55) && near((b.y1 - b.y0) * s, 0.55) && near((b.z1 - b.z0) * s, 0.0125));
    assert.equal(b.x0, -b.x1); assert.equal(b.y0, -b.y1); assert.equal(b.z0, 0);
    assert.equal(v.has(b.x0, 0, 0) && v.has(b.x0 + 1, 0, 0) && !v.has(b.x0 + 2, 0, 0), true, 'the bead is two voxels: 2.5 cm');
    assert.equal(v.has(0, 0, 0), false, 'and the panel inside it is the wall');
    assert.ok(tris(v) <= 48, `${tris(v)} triangles`);
    assert.ok(plain(v));
  }
  // on the 0.8 m tile the drawn bead runs from 0.15 m to 0.70 m both ways: so the frame's middle is 0.425 m into its tile
  assert.ok(near(P.PANELLING.inset + P.PANELLING.frame, 0.7) && near(P.PANELLING.centre, 0.425) && P.PANELLING.tile === 0.8);
});
