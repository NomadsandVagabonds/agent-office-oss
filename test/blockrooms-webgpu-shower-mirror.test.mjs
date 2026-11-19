import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';

// Locker-showers planar floor mirror (rooms/locker-showers/water.js ReflectorNode) on WebGPURenderer, based on
// ac7ce22. Verifies ReflectorNode attachment, +Y plane orientation, zero unused WebGLRenderTarget under gpu.nodes,
// torch/camcorder-lamp suppression & sheet hiding in updateBefore, disposal, and glowPass.on MRT synchronization.
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
const { showerWater } = await import('../public/world/backrooms/rooms/locker-showers/water.js');
const { createGlowChain, glowPass, sceneGlowMRT } = await import('../public/world/backrooms/glow-node.js');
const { GLOW_BLOOM } = await import('../public/world/backrooms/glow.js');

function withNodes(fn) {
  const prev = gpu.nodes;
  gpu.nodes = N;
  try { return fn(); } finally { gpu.nodes = prev; }
}

test('rooms/locker-showers/water.js keeps room isolation (no engine/gpu or three.webgpu import)', () => {
  const src = fs.readFileSync(new URL('../public/world/backrooms/rooms/locker-showers/water.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('three.webgpu'));
  assert.ok(!src.includes('engine/gpu'));
});

test('showerWater builds ReflectorNode mirror eagerly under gpu.nodes and guards nested MRT', () => {
  withNodes(() => {
    const kit = createKit();
    const room = new THREE.Group();
    const batch = new Batch();
    batch.quad([-2, -0.12, 2], [2, -0.12, 2], [2, -0.12, -2], [-2, -0.12, -2]);
    const after = [];
    const c = {
      kit,
      world: { scene: new THREE.Scene() },
      rt: { lights: [], amb: [0.2, 0.2, 0.2], group: room },
      add: (o) => room.add(o),
      tick: () => {},
      after,
    };
    const surface = showerWater(c, batch, new THREE.Texture());
    for (const fn of after) fn();

    // Two children: refl.target (oriented +Y at batch.pos[1]) and changing-water-sheet mesh
    assert.equal(surface.group.children.length, 2);
    const targetObj = surface.group.children[0];
    const mesh = surface.group.children[1];
    assert.equal(mesh.name, 'changing-water-sheet');
    assert.equal(mesh.material.isNodeMaterial, true);
    assert.equal(mesh.material.uniforms.uChangingReflection.value, null, 'no unused WebGLRenderTarget allocated on WebGPU');
    assert.ok(Math.abs(targetObj.position.y - (-0.12)) < 1e-6, 'reflector target sits at water plane height');
    assert.ok(Math.abs(targetObj.rotation.x - (-Math.PI / 2)) < 1e-6, 'reflector target faces +Y');

    // WebGL onBeforeRender is inert on WebGPURenderer
    mesh.onBeforeRender({ isWebGPURenderer: true }, new THREE.Scene(), new THREE.PerspectiveCamera());

    // glow-node.js keeps glowPass.on synchronized with WebGPURenderer.prototype.setMRT
    const chain = createGlowChain(GLOW_BLOOM);
    const mrt = sceneGlowMRT();
    const fakeRenderer = Object.create(N.WebGPURenderer.prototype);
    fakeRenderer._mrt = null;
    fakeRenderer.setMRT(mrt);
    assert.equal(glowPass.on, true, 'glowPass.on enabled when emissive MRT is bound');
    fakeRenderer.setMRT(null);
    assert.equal(glowPass.on, false, 'glowPass.on cleared when ReflectorNode clears MRT');
    fakeRenderer.setMRT(mrt);
    assert.equal(glowPass.on, true, 'glowPass.on restored when ReflectorNode restores MRT');
    fakeRenderer.setMRT(null);

    chain.dispose();
    kit.dispose();
  });
});
