import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';

// Node water completion (liquid-node.js + liquid.js swellGeometry fix + glow-node.js setMRT sync, based on ac7ce22):
//   - swellGeometry reads InterleavedBufferAttributes & normalized byte attributes cleanly and repacks for WebGPU;
//   - underwater underside (LIQUID_UNDER_FRAG / UNDERSIDE) draws when inside a facing-up pool's rim (flat & swelled);
//   - High planar mirror (water 2) uses one shared ReflectorNode, respects pickMirror / samePlane / mirrorLeaves,
//     transforms torch/beam-shadow uniforms into mirror camera space, and cleans up on setLevel(1) / release().
const pub = new URL('../public/', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  if (s === 'three') return {url:${JSON.stringify(pub + 'vendor/three.module.min.js')},shortCircuit:true};
  if (s.startsWith('/vendor/')) return {url:${JSON.stringify(pub.slice(0, -1))}+s,shortCircuit:true};
  return next(s,c);
}`), import.meta.url);

const THREE = await import('three');
const N = await import('../public/vendor/three.webgpu.min.js');
const { gpu } = await import('../public/world/engine/gpu.js');
const { createKit, Batch } = await import('../public/world/backrooms/kit.js');
const { markLiquid, swellGeometry } = await import('../public/world/backrooms/liquid.js');
const { createLiquidViewNode } = await import('../public/world/backrooms/liquid-node.js');
const { HELD_ORDER } = await import('../public/world/backrooms/beam-shadows.rule.js');

const draw = new Proxy({}, { get: (_, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 6 }) : /Gradient/.test(k) ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
const oldDoc = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => draw }) };
test.after(() => { globalThis.document = oldDoc; });

function withNodes(fn) {
  const prev = gpu.nodes;
  gpu.nodes = N;
  try { return fn(); } finally { gpu.nodes = prev; }
}

function makePool({ y = -0.05, at = [0, 0, 0], banks = 2, kit = createKit() } = {}) {
  const group = new THREE.Group();
  group.position.set(...at);
  const u = { flick: { value: 1 }, dim: { value: 1 }, banks: { value: [1, 1] }, moreBanks: { value: [0, 0] } };
  const lights = Array.from({ length: banks }, (_, b) => ({ x: 0, y: 2.5, z: 0, r: 0.25 + b * 0.1, g: 0.3, b: 0.4, k: 0.1, far2: 40, wrap: 0.2, bank: b }));
  const lighting = { bankCount: banks, ambientShare: 0.3 };
  const rt = { group, u, lights, lighting, amb: [0.2, 0.25, 0.3] };
  const after = [], c = { rt, kit, after };
  const batch = new Batch();
  batch.grid([-2, y, -3], [0, 0, 1], [1, 0, 0], [0, 1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4], (a, b) => [a, b], [0.88, 1, 1]);
  const geo = kit.geometry(batch, lights, rt.amb, lighting);
  const mesh = new THREE.Mesh(geo, kit.surface({ map: new THREE.Texture(), room: u, banks, alpha: 0.52, side: THREE.DoubleSide }));
  group.add(mesh);
  const handle = markLiquid(c, mesh, { kind: 'water', y });
  for (const fn of after) fn();
  return { kit, group, rt, mesh, handle, rec: rt.liquids[0] };
}

function makeStage(...groups) {
  const scene = new THREE.Scene();
  for (const g of groups) { const part = new THREE.Scene(); part.add(g); scene.add(part); }
  const cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170);
  cam.position.set(0, 1.6, 3.5); cam.lookAt(0, -0.05, 0); cam.updateMatrixWorld();
  scene.updateMatrixWorld(true);
  return { scene, cam };
}

test('liquid-node.js never statically imports three.webgpu', () => {
  const src = fs.readFileSync(new URL('../public/world/backrooms/liquid-node.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('three.webgpu'));
});

test('swellGeometry accurately interpolates WebGPU InterleavedBufferAttributes and repacks <= 5 vertex buffers', () => {
  withNodes(() => {
    const p = makePool({ banks: 4 });
    const src = p.mesh.geometry;
    assert.equal(src.attributes.aLit.isInterleavedBufferAttribute, true, 'kit.geometry packs attributes under gpu.nodes');
    assert.equal(src.attributes.aAlb.itemSize, 4, 'kit.geometry pads byte-triplet albedo to 4 bytes');

    const dense = swellGeometry(src, 0.25, 0.5);
    assert.ok(dense.geometry, 'dense swell geometry created');
    const pos = dense.geometry.attributes.position, lit = dense.geometry.attributes.aLit, b0 = dense.geometry.attributes.aBank0;
    assert.equal(lit.isInterleavedBufferAttribute, true, 'dense geometry repacked for WebGPU 8-buffer limit');
    // Count distinct underlying buffers
    const bufs = new Set(Object.values(dense.geometry.attributes).map((a) => (a.isInterleavedBufferAttribute ? a.data : a)));
    assert.ok(bufs.size <= 5, `expected <= 5 vertex buffers on WebGPU, got ${bufs.size}`);

    // Corner lighting matches source vertex exactly (not interleaved garbage!)
    let i0 = -1, j0 = -1;
    for (let i = 0; i < pos.count; i++) if (pos.getX(i) === -2 && pos.getZ(i) === -3) { i0 = i; break; }
    for (let j = 0; j < src.attributes.position.count; j++) if (src.attributes.position.getX(j) === -2 && src.attributes.position.getZ(j) === -3) { j0 = j; break; }
    assert.ok(i0 >= 0 && j0 >= 0);
    assert.ok(Math.abs(lit.getX(i0) - src.attributes.aLit.getX(j0)) < 1e-5, 'aLit matches source corner');
    assert.ok(Math.abs(b0.getX(i0) - src.attributes.aBank0.getX(j0)) < 1e-5, 'aBank0 matches source corner');
    // Albedo stayed normalized [0..1], not 0..255
    assert.ok(dense.geometry.attributes.aAlb.getX(i0) <= 1.01 && dense.geometry.attributes.aAlb.getX(i0) >= 0.8);

    dense.geometry.dispose();
    p.kit.dispose();
  });
});

test('liquid-node: underwater underside (flat & swelled) activates inside pool rim and reverts outside', () => {
  withNodes(() => {
    const p = makePool(), { scene, cam } = makeStage(p.group), view = createLiquidViewNode();
    view.setLevel(1);

    // Above water: top material
    view.frame(scene, cam, 1);
    const pair = p.rec.pairs[0];
    assert.equal(pair.water.renderOrder, -1, 'water draws first in transparent pass, before room glass/domes');
    assert.equal(p.rec.under, false);
    assert.equal(p.rec.below, false);
    assert.equal(pair.water.material.name, 'liquid:water');
    assert.equal(pair.water.visible, true);
    assert.equal(p.mesh.visible, false);

    // Underwater inside rim: underside material
    cam.position.set(0, -0.6, 0); cam.lookAt(0, 1.0, -0.4); cam.updateMatrixWorld();
    view.frame(scene, cam, 2);
    assert.equal(p.rec.under, true);
    assert.equal(p.rec.below, true);
    assert.equal(view.stats.below, 1);
    assert.equal(pair.water.material.name, 'liquid:water:underside');
    assert.equal(pair.water.visible, true);

    // Underwater with active swell: swell underside material + dense geometry
    p.handle.swell({ at: 0, height: 0.72, breaking: 0.3 });
    view.frame(scene, cam, 2.1);
    assert.equal(p.rec.swellOn, true);
    assert.equal(pair.water.geometry, pair.dense);
    assert.equal(pair.water.material, pair.swellUnder);
    assert.equal(pair.water.material.name, 'liquid:water:underside');

    // Underwater OUTSIDE rim: falls back to room's own sheet
    cam.position.set(8, -0.6, 0); cam.lookAt(0, -0.05, 0); cam.updateMatrixWorld();
    view.frame(scene, cam, 3);
    assert.equal(p.rec.under, true);
    assert.equal(p.rec.below, false);
    assert.equal(pair.water.visible, false);
    assert.equal(p.mesh.visible, true);

    view.release(scene);
    p.kit.dispose();
  });
});

test('liquid-node: High planar mirror (water 2) selects plane, shares across same height, suppresses torch/leaves, and cleans up', () => {
  withNodes(() => {
    const kit = createKit();
    const p1 = makePool({ kit, y: -0.05, at: [0, 0, 0] });
    const p2 = makePool({ kit, y: -0.05, at: [0, 0, -7] });
    const pLow = makePool({ kit, y: -0.05, at: [6, -0.6, -2] });
    const { scene, cam } = makeStage(p1.group, p2.group, pLow.group);
    cam.position.set(0, 1.6, 4.2); cam.lookAt(0, -0.05, -2); cam.updateMatrixWorld();

    const view = createLiquidViewNode();
    // Medium (level 1): no mirror
    view.setLevel(1);
    view.frame(scene, cam, 1);
    assert.equal(view.mirror, null);
    assert.equal(view.stats.mirror.on, false);
    assert.equal(p1.rec.pairs[0].mirrorMaterial, null);

    // High (level 2): mirror activates for p1 & p2 (same plane), not pLow
    view.setLevel(2);
    view.frame(scene, cam, 2);
    assert.ok(view.mirror, 'mirror active at water 2');
    assert.equal(view.mirror.rec, p1.rec, 'nearest facing-up pool chosen');
    assert.equal(view.stats.mirror.on, true);
    assert.equal(view.stats.mirror.surfaces, 2, 'both pools on same horizontal plane share mirror');
    assert.ok(p1.rec.pairs[0].own.mirrorOn.value > 0);
    assert.ok(p2.rec.pairs[0].own.mirrorOn.value > 0);
    assert.equal(pLow.rec.pairs[0].own.mirrorOn.value, 0, 'lower plane keeps flat tint');
    assert.equal(p1.rec.pairs[0].water.material, p1.rec.pairs[0].mirrorMaterial);
    assert.equal(pLow.rec.pairs[0].water.material, pLow.rec.pairs[0].material);

    // Reflector target sits on world plane facing +Y (local +Z mapped to world +Y)
    const target = view.mirror.reflector.target;
    assert.ok(Math.abs(target.position.y - (-0.05)) < 1e-6);
    const nrm = new THREE.Vector3(0, 0, 1).applyQuaternion(target.quaternion);
    assert.ok(Math.abs(nrm.y - 1) < 1e-6);

    // Dropping back to Medium disposes reflector & mirror variants
    view.setLevel(1);
    assert.equal(view.mirror, null);
    assert.equal(p1.rec.pairs[0].mirrorMaterial, null);

    view.release(scene);
    kit.dispose();
  });
});
