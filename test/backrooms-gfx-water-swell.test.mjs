import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// The swell (liquid.rule.js SWELL, swellAt; liquid.js swellGeometry and the frame's swell; liquid.mark.js handle.swell):
// a wave across a marked surface, the Surge Basin's surge. While a room asks for one the surface is drawn on a denser
// copy of its sheet with SWELL defined; asked for nothing it is the surface it was. Nothing at water 0.
const pub = new URL('../public/', import.meta.url).href, root = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  if (s === 'three') return {url:${JSON.stringify(pub + 'vendor/three.module.min.js')},shortCircuit:true};
  if (s.startsWith('/vendor/')) return {url:${JSON.stringify(pub.slice(0, -1))}+s,shortCircuit:true};
  if (s.startsWith('/core/')) return {url:new URL(s.slice(1),${JSON.stringify(root)}).href,shortCircuit:true};
  return next(s,c);
}`), import.meta.url);
const THREE = await import('three');
const { createKit, Batch } = await import('../public/world/backrooms/kit.js');
const { markLiquid, createLiquidView, swellGeometry } = await import('../public/world/backrooms/liquid.js');
const R = await import('../public/world/backrooms/liquid.rule.js');
const { SWELL, swellAt, swellUnit, swellCrestZ, swellMirror, swellAsk, swellRings, LIQUID_FRAG, LIQUID_VERT, LIQUID_UNDER_FRAG } = R;

const B = (f) => readFileSync(new URL(`../public/world/backrooms/${f}`, import.meta.url), 'utf8');
const draw = new Proxy({}, { get: (_, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 6 }) : /Gradient/.test(k) ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
const oldDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => draw }) };
test.after(() => { globalThis.document = oldDocument; });

const BOX = { x0: -6.95, z0: -7.85, x1: 6.95, z1: 7.55 };   // the Surge Basin's sheet

/** A room with one kit sheet (a 1 m grid, as createBasin's), its handle, in a part, a camera over it. */
function pool() {
  const kit = createKit(), group = new THREE.Group(), u = { flick: { value: 1 }, dim: { value: 1 }, banks: { value: [1, 1] }, moreBanks: { value: [0, 0] } };
  const rt = { group, u }, after = [], c = { rt, kit, after };
  const batch = new Batch();
  batch.grid([-2, -0.05, -3], [0, 0, 1], [1, 0, 0], [0, 1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4], (a, b) => [a, b], [0.88, 1, 1]);
  const mesh = new THREE.Mesh(kit.geometry(batch, [], [0.6, 0.6, 0.6]), kit.surface({ map: new THREE.Texture(), room: u, alpha: 0.52, side: THREE.DoubleSide }));
  group.add(mesh);
  const handle = markLiquid(c, mesh, { kind: 'water', y: -0.05 });
  for (const fn of after) fn();
  const scene = new THREE.Scene(), part = new THREE.Scene(); part.add(group); scene.add(part);
  const cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170); cam.position.set(0, 1.6, 4.5); cam.lookAt(0, -0.05, 0); cam.updateMatrixWorld();
  scene.updateMatrixWorld(true);
  return { kit, group, rt, mesh, handle, rec: rt.liquids[0], scene, cam };
}

test('the numbers: a crest of about 0.6 m from the rule\'s 0.72, a steep face, a long low swell ahead, a short trough behind', () => {
  assert.ok(Math.abs(0.72 * SWELL.scale - 0.61) < 0.02, 'about today\'s height, no taller');
  assert.ok(Math.abs(swellUnit(0) - 1) < 0.01, 'its crest');
  assert.ok(swellUnit(0.55) < 0.45 && swellUnit(-0.55) > 0.7, 'steeper ahead (the face) than behind (the back)');
  assert.ok(swellUnit(2) > 0.03 && swellUnit(2) < 0.12, 'a long low swell ahead of the face');
  assert.ok(swellUnit(-SWELL.troughAt) < -0.1 && swellUnit(-SWELL.troughAt) > -0.2, 'a short trough behind');
  assert.ok(Math.abs(swellUnit(-4)) < 0.01 && Math.abs(swellUnit(9)) < 0.05, 'calm water beyond');
  // its line bends across the pool as the old crest's did; at 0 the crest is at `at`
  assert.equal(swellCrestZ(1.5, 0), 1.5 + SWELL.sweep[2] * Math.sin(SWELL.sweep[4]));
  const s = { at: 0, height: 0.6 };
  const top = Math.max(...Array.from({ length: 200 }, (_, i) => swellAt(-3, -1 + i / 100, s, BOX)));
  assert.ok(top > 0.5 && top < 0.7);
  // the handle's ask: the room's own height times scale, breaking clamped; nothing for no wave
  assert.deepEqual(swellAsk({ at: 1, height: 0.72, breaking: 3 }), { at: 1, height: 0.72 * SWELL.scale, breaking: 1 });
  for (const bad of [null, {}, { at: 1 }, { at: 1, height: 0 }, { at: NaN, height: 1 }]) assert.equal(swellAsk(bad), null);
});

test('the side walls: faded out to nothing at the sheet\'s sides and ends (no skirt), whole in the middle', () => {
  const s = { at: 0, height: 0.6 }, at = (x) => swellAt(x, swellCrestZ(0, x), s, BOX);
  assert.equal(at(BOX.x0), 0); assert.equal(at(BOX.x1), 0);
  assert.ok(at(BOX.x0 + SWELL.wall / 2) > 0 && at(BOX.x0 + SWELL.wall / 2) < at(0));
  assert.ok(at(0) > 0.5);
  assert.equal(swellAt(0, BOX.z1, { at: BOX.z1, height: 0.6 }, BOX), 0, 'nothing at the beach\'s edge');
  assert.equal(swellAt(0, BOX.z0, { at: BOX.z0, height: 0.6 }, BOX), 0, 'nor at the gates');
});

test('the eye: the water is held under it within about a metre, its own height again further off; a diver is left alone', () => {
  const s = { at: 0, height: 0.6 }, plane = -0.05, z = swellCrestZ(0, 0);
  const eye = { x: 0, y: plane + 0.35, z };
  assert.ok(swellAt(0, z, s, BOX) > 0.5, 'without the eye: the crest');
  assert.ok(swellAt(0, z, s, BOX, eye, plane) <= 0.35 - SWELL.eyeClear + 1e-9, 'under the eye: never over it');
  assert.ok(swellAt(0.3, z, s, BOX, eye, plane) <= 0.35 - SWELL.eyeClear + 1e-9);
  assert.equal(swellAt(SWELL.eyeFar + 0.01, swellCrestZ(0, SWELL.eyeFar + 0.01), s, BOX, eye, plane), swellAt(SWELL.eyeFar + 0.01, swellCrestZ(0, SWELL.eyeFar + 0.01), s, BOX), 'its own height from a metre and a bit');
  const high = { x: 0, y: plane + 1.6, z };
  assert.equal(swellAt(0, z, s, BOX, high, plane), swellAt(0, z, s, BOX), 'an eye well above it changes nothing');
  const diver = { x: 0, y: plane - 0.4, z };
  assert.equal(swellAt(0, z, s, BOX, diver, plane), swellAt(0, z, s, BOX), 'the crest passes over a diver');
  // the shader does the same
  assert.match(R.LIQUID_VERT, /if \(uEyeRoom\.y > uSwell\.z\) \{/);
  assert.match(LIQUID_VERT, /h = mix\(min\(h, room\), h, near\);/);
});

test('the mirror at High: weakened on raised water, whole on flat', () => {
  assert.equal(swellMirror(0), 1);
  assert.equal(swellMirror(SWELL.mirrorGone), 0);
  assert.ok(swellMirror((SWELL.mirrorFrom + SWELL.mirrorGone) / 2) > 0 && swellMirror((SWELL.mirrorFrom + SWELL.mirrorGone) / 2) < 1);
  const at = LIQUID_FRAG.indexOf('#ifdef MIRROR'), els = LIQUID_FRAG.indexOf('#else', at), mir = LIQUID_FRAG.slice(at, els);
  assert.match(mir, /#ifdef SWELL\n[^#]*mOn \*= 1\.0 - smoothstep\([\d.]+, [\d.]+, swellRaise\);\n  #endif/);
});

test('the shader: every part of the swell behind SWELL; the underside rises with the top; the foam capped on screen', () => {
  // take out every #ifdef SWELL … #endif (and its #else: the vertex stage's old two lines): no swell left in either stage
  const strip = (s) => s.replace(/#ifdef SWELL\n[\s\S]*?#endif\n?/g, '');
  for (const s of [LIQUID_VERT, LIQUID_FRAG, LIQUID_UNDER_FRAG]) {
    assert.ok(!/swell|uSwell/i.test(strip(s).replace(/float mOn = uMirrorOn;/, '')), 'nothing of it outside SWELL');
  }
  assert.match(LIQUID_VERT, /raised\.y \+= swellAt\(\(uToRoom \* vec4\(position, 1\.0\)\)\.xz\);/);
  assert.ok(LIQUID_UNDER_FRAG.includes('slope += floor(sws / '), 'the underside takes the swell\'s slope (and its vertices rise: the same vertex shader)');
  assert.ok(!LIQUID_UNDER_FRAG.includes('foam'), 'the foam is the top\'s alone');
  const main = LIQUID_FRAG.slice(LIQUID_FRAG.lastIndexOf('void main() {'));
  assert.match(main, /float fcs = [\d.]+ \* exp2\(-clamp\(ceil\(log2\([\d.]+ \/ \([\d.]+ \* max\(max\(fw\.x, fw\.y\), 1e-5\)\)\)\), 0\.0, 3\.0\)\);/, 'foam cells halved near the eye, never wider than foamPx pixels');
  assert.match(main, /sin\(uTime \* [\d.]+ \+ ph \* 6\.2831853\)/, 'each cell on its own slow clock (churn), not scrolled');
  assert.ok(SWELL.foamMix <= 0.5 && SWELL.foamTone < 1, 'low contrast, off-white');
  assert.ok(SWELL.foamCrest < 0.4 && SWELL.foamTall > 0, 'sparse, thinner as the crest stands taller');
});

test('the rings where it breaks: on a pier\'s seaward face as the crest reaches it, by its sides as it passes, along the beach while it breaks', () => {
  const pier = { x0: -3, z0: 1, x1: -1.5, z1: 1.5 }, beach = { z: 7.55, x0: -6.95, x1: 6.95 }, st = {};
  assert.deepEqual(swellRings(0, 0.9, 0, [pier], beach, 1, st), []);
  const face = swellRings(0.9, 1.1, 0, [pier], beach, 1, st);
  assert.equal(face.length, 2); assert.ok(face.every((r) => r.strength === SWELL.ringPier && r.z < pier.z0));
  const lee = swellRings(1.4, 1.6, 0, [pier], beach, 1, st);
  assert.equal(lee.length, 2); assert.ok(lee.every((r) => r.strength === SWELL.ringLee && r.z > pier.z1));
  const b1 = swellRings(6, 6.1, 0.9, [], beach, 2, st), b2 = swellRings(6.1, 6.2, 0.9, [], beach, 2.1, st), b3 = swellRings(6.2, 6.3, 0.9, [], beach, 2.31, st);
  assert.equal(b1.length, 1); assert.equal(b2.length, 0, 'one every beachEvery seconds'); assert.equal(b3.length, 1);
  assert.ok(b1[0].x > beach.x0 && b1[0].x < beach.x1 && b1[0].z < beach.z);
  assert.ok(SWELL.ringPier > 1.6 && SWELL.ringBeach > 1.3, 'a little stronger than the prototype\'s');
  assert.deepEqual(swellRings(1, 1, 1, [pier], beach, 9, {}), [], 'nothing without a move');
});

test('the dense copy: rows along z and columns across, the sheet\'s own light taken between its vertices; a sheet that is no grid is refused', () => {
  const p = pool(), g = p.mesh.geometry, d = swellGeometry(g, 0.25, 0.5);
  assert.ok(d.geometry);
  assert.equal(d.cols, 9); assert.equal(d.rows, 25); assert.equal(d.triangles, 8 * 24 * 2);
  assert.deepEqual(Object.keys(d.geometry.attributes).sort(), Object.keys(g.attributes).sort());
  // a corner keeps its corner's light
  const pos = d.geometry.attributes.position, lit = d.geometry.attributes.aLit;
  let i0 = 0; for (let i = 0; i < pos.count; i++) if (pos.getX(i) === -2 && pos.getZ(i) === -3) i0 = i;
  let j0 = 0; for (let j = 0; j < g.attributes.position.count; j++) if (g.attributes.position.getX(j) === -2 && g.attributes.position.getZ(j) === -3) j0 = j;
  assert.ok(Math.abs(lit.getX(i0) - g.attributes.aLit.getX(j0)) < 1e-6);
  const odd = new THREE.BufferGeometry(); odd.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3));
  assert.equal(swellGeometry(odd).geometry, null);
});

test('the frame: on while a swell is asked for (the dense copy, SWELL), off and as it was when it is not or nobody asks again; nothing at water 0', () => {
  const p = pool(), view = createLiquidView();
  assert.equal(p.handle.swell({ at: 0, height: 0.72 }), false, 'water 0 (no view has it up): nothing, and it says so');
  assert.equal(p.rec.pairs, null, 'nothing made for it');
  p.handle.swell(null);
  view.setLevel(1);
  view.frame(p.scene, p.cam, 0);
  const pair = p.rec.pairs[0];
  assert.equal(pair.water.geometry, p.mesh.geometry); assert.ok(!pair.material.defines.SWELL);
  assert.equal(p.handle.swell({ at: 0, height: 0.72, breaking: 0.5 }), true);
  view.frame(p.scene, p.cam, 0.1);
  assert.notEqual(pair.water.geometry, p.mesh.geometry); assert.equal(pair.material.defines.SWELL, 1);
  const u = pair.material.uniforms.uSwell.value;
  assert.ok(Math.abs(u.x) < 1e-9 && Math.abs(u.y - 0.72 * SWELL.scale) < 1e-6 && Math.abs(u.z - p.rec.plane.y) < 1e-6 && u.w === 0.5);
  const box = pair.material.uniforms.uSwellBox.value;
  assert.deepEqual([box.x, box.y, box.z, box.w], [-2, -3, 2, 3]);
  assert.equal(p.mesh.geometry.attributes.position.count, 35, 'the room\'s own sheet untouched');
  p.handle.swell(null); view.frame(p.scene, p.cam, 0.2);
  assert.equal(pair.water.geometry, p.mesh.geometry); assert.ok(!('SWELL' in pair.material.defines));
  // asked once and never again (its room no longer ticks): let go after a few frames
  p.handle.swell({ at: 0, height: 0.72 });
  for (let i = 0; i < 12; i++) view.frame(p.scene, p.cam, 0.3 + i / 60);
  assert.equal(pair.water.geometry, p.mesh.geometry); assert.ok(!p.rec.swellOn);
  view.release(p.scene);
});

test('the rings it starts go into the surface\'s own pool, in its room frame', () => {
  const p = pool(), view = createLiquidView(); view.setLevel(1);
  view.frame(p.scene, p.cam, 0);
  p.handle.swellBreaks([{ x0: -1, z0: -1, x1: 1, z1: -0.5 }], { z: 1, x0: -2, x1: 4 });
  p.handle.swell({ at: -1.2, height: 0.72 }); view.frame(p.scene, p.cam, 0.1);
  p.handle.swell({ at: -0.9, height: 0.72 }); view.frame(p.scene, p.cam, 0.2);
  assert.equal(p.rec.wake.pool.length, 2);
  view.release(p.scene);
});

test('the Surge Basin: one stand-in mark on its drawn wave, one swell call a tick, the piers and beach once; the rule untouched', () => {
  const src = B('rooms/wave-pool.js');
  assert.equal(src.split('liquidStandIn').length - 1, 1);
  assert.equal(src.split('.swell?.(').length - 1, 1, 'one swell call');
  assert.match(src, /info\.water\?\.swell\?\.\(ws\.active \? \{ at: ws\.crestZ, height: ws\.amp, breaking: /);
  assert.match(src, /basin\.water\?\.swellBreaks\?\.\(piers\.map\(/);
  // the strip: see-through, the pool water's teal (causticWaterTex's aqua), foam in 4 px texels, a darker trough
  assert.match(src, /addTranslucent\(c, stripBatch, \{ map: stripSkin, alpha: 0\.7, side: THREE\.FrontSide, order: 5 \}\)/);
  assert.match(B('waterpark.js'), /tone === 'deep' \? \[37, 87, 99\] : \[61, 129, 131\]/, 'the aqua sheet\'s teal');
  assert.match(src, /\[61 \+ 70 \* u, 129 \+ 68 \* u, 131 \+ 56 \* u\]/, 'the strip from the same teal');
  assert.match(src, /g\.fillRect\(q \* 4, \(63 - r\) \* 4, 4, 4\);/, '4 px texels');
  assert.ok(!/Math\.random/.test(src));
  // the hazard: the rule's own calls, as they were
  assert.match(src, /const ws = waveState\(t, bz0 \+ 0\.6, bz1 - 0\.4\);/);
  assert.match(src, /const push = wavePush\(ws, me\.z, \{/);
  assert.match(src, /const sheltered = piers\.some\(\(pr\) => Math\.abs\(me\.x - pr\.x\) <= pr\.w \* 0\.58 && me\.z > pr\.z && me\.z < pr\.z \+ 2\.1\);/);
  assert.match(src, /c\.rt\.wavePool = \{ get crestZ\(\) \{ return crestMesh\.visible \? crestMesh\.position\.z : null; \} \};/);
});
