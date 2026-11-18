// The other lights a ceiling wears (fittings.model.js), and the troffer as a closed box (ceiling.model.js { surface }).
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const root = new URL('../', import.meta.url), three = new URL('public/vendor/three.module.min.js', root);
register(`data:text/javascript;base64,${Buffer.from(`export async function resolve(s,c,next){ if(s==='three')return {url:${JSON.stringify(three.href)},shortCircuit:true}; return next(s,c); }`).toString('base64')}`, import.meta.url);
const [F, C, { meshVox }, { isGlow, isGlass }] = await Promise.all(['public/world/backrooms/fittings.model.js', 'public/world/backrooms/ceiling.model.js', 'public/world/vox/mesher.js', 'public/world/vox/vox.js'].map((f) => import(new URL(f, root).href)));
const tris = (v) => meshVox(v, { ao: false }).solid.index.count / 3, S = F.FITTINGS.voxel;
const glows = (v) => { let n = 0; v.each((x, y, z, c) => { if (isGlow(c)) n++; }); return n; };
const whole = (parts) => { let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9; for (const v of Object.values(parts)) { const b = v.bounds(); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); z0 = Math.min(z0, b.z0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); z1 = Math.max(z1, b.z1); } return { x0, y0, z0, x1, y1, z1 }; };
const near = (a, b) => Math.abs(a - b) < 1e-9;
/** What is lit shines and nothing else does; dead, nothing does; and there is no glass in any of it. */
function lit(make, shining, opt = {}) {
  const on = make(opt), off = make({ ...opt, dead: true });
  assert.deepEqual(Object.keys(on), Object.keys(off), 'the same parts lit and dead');
  for (const [name, v] of Object.entries(on)) { assert.equal(glows(v) > 0, name === shining, `${name} ${name === shining ? 'shines' : 'does not shine'}`); v.each((x, y, z, c) => assert.equal(isGlass(c), false)); }
  for (const [name, v] of Object.entries(off)) assert.equal(glows(v), 0, `dead, ${name} does not shine`);
  return on;
}

test('the pool light: a troffer\'s footprint and depth, a closed body, a lens that shines', () => {
  const p = lit(F.poolLightVox, 'lens'), b = whole(p);
  assert.deepEqual(Object.keys(p), ['housing', 'lens']);
  assert.ok(near((b.x1 - b.x0) * S, F.FITTINGS.pool.size[0]) && near((b.z1 - b.z0) * S, F.FITTINGS.pool.size[1]) && near((b.y1 - b.y0) * S, F.FITTINGS.pool.deep));
  assert.equal(b.x0, -b.x1); assert.equal(b.z0, -b.z1); assert.equal(b.y0, 0, 'its lowest face is the origin');
  for (let x = b.x0; x < b.x1; x++) for (let z = b.z0; z < b.z1; z++) assert.ok(p.housing.has(x, b.y1 - 1, z), 'shut on top');
  assert.deepEqual([tris(p.housing), tris(p.lens)], [136, 280]); assert.ok(tris(p.housing) + tris(p.lens) <= 500);
});

test('the batten: a channel, two holders and one tube, in three lengths that cost the same', () => {
  for (const len of F.FITTINGS.batten.lengths) {
    const p = lit(F.battenVox, 'tube', { len }), b = whole(p);
    assert.deepEqual(Object.keys(p), ['channel', 'holders', 'tube']);
    assert.ok(near((b.z1 - b.z0) * S, len), `${len} m long`); assert.ok(near((b.x1 - b.x0) * S, F.FITTINGS.batten.wide)); assert.ok(near((b.y1 - b.y0) * S, F.FITTINGS.batten.deep));
    assert.equal(b.x0, -b.x1); assert.equal(b.z0, -b.z1); assert.equal(b.y0, 0);
    assert.deepEqual([tris(p.channel), tris(p.holders), tris(p.tube)], [20, 40, 36]); assert.ok(tris(p.channel) + tris(p.holders) + tris(p.tube) <= 150);
  }
  assert.equal(whole(F.battenVox({ len: 7 })).z1, 48, 'a length it does not come in is 1.2 m');
});

test('the can: a trim and a lit disc set up inside it, cheap enough to hang many', () => {
  const p = lit(F.canVox, 'disc'), b = whole(p);
  assert.deepEqual(Object.keys(p), ['trim', 'disc']);
  assert.ok(near((b.x1 - b.x0) * S, F.FITTINGS.can.across) && near((b.z1 - b.z0) * S, F.FITTINGS.can.across) && near((b.y1 - b.y0) * S, F.FITTINGS.can.deep));
  assert.equal(b.x0, -b.x1); assert.equal(b.z0, -b.z1); assert.equal(b.y0, 0);
  assert.equal(p.disc.bounds().y0, 1, 'the disc is a voxel up inside the trim');
  assert.deepEqual([tris(p.trim), tris(p.disc)], [60, 12]); assert.ok(tris(p.trim) + tris(p.disc) <= 80);
});

test('the troffer as a closed box: the same face, tubes and louvre, upright sides and a lid, no deeper', () => {
  const open = C.lightVox(), shut = C.lightVox({ surface: true });
  assert.deepEqual(Object.keys(shut), ['housing', 'tubes', 'louvre']);
  assert.deepEqual(shut.housing.bounds(), open.housing.bounds(), 'the same box: CEILING.deep and no deeper');
  assert.equal(tris(shut.tubes), tris(open.tubes)); assert.equal(tris(shut.louvre), tris(open.louvre));
  const b = shut.housing.bounds();
  for (let x = b.x0; x < b.x1; x++) for (let z = b.z0; z < b.z1; z++) assert.ok(shut.housing.has(x, 7, z), 'a lid over all of it');
  for (let y = 1; y <= 7; y++) for (let z = b.z0; z < b.z1; z++) { assert.ok(shut.housing.has(b.x0, y, z)); assert.ok(shut.housing.has(b.x1 - 1, y, z)); }
  assert.equal(open.housing.has(b.x0, 5, 0), false, 'where the troffer let into a ceiling has none');
  assert.deepEqual([tris(open.housing), tris(shut.housing)], [280, 264]);
  assert.equal(glows(shut.housing), 0); assert.ok(glows(shut.tubes) > 0);
});
