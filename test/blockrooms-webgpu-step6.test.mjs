import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';

// Step 6 (docs/BLOCKROOMS-WEBGPU.md): High-tier flashlight shadows (beam-shadows.js + kit-node-shadow.js) on
// WebGPURenderer, branched from 59111b9. Verifies depth pass, cutout casters, receiver patching & cache-key rebuild,
// WebGL vs WebGPU NDC-z projection matrix mapping, MRT isolation, error recovery, and clean teardown.
const pub = new URL('../public/', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  if (s === 'three') return {url:${JSON.stringify(pub + 'vendor/three.module.min.js')},shortCircuit:true};
  if (s.startsWith('/vendor/')) return {url:${JSON.stringify(pub.slice(0, -1))}+s,shortCircuit:true};
  return next(s,c);
}`), import.meta.url);

const THREE = await import('three');
const N = await import('../public/vendor/three.webgpu.min.js');
const { gpu } = await import('../public/world/engine/gpu.js');
const { createKit } = await import('../public/world/backrooms/kit.js');
const { createBeamShadows } = await import('../public/world/backrooms/beam-shadows.js');
const { BEAM_SHADOW, HELD_ORDER, receivesBeamShadow, castsBeamShadow } = await import('../public/world/backrooms/beam-shadows.rule.js');
const { FLASHLIGHT, FLASHLIGHT_POSES } = await import('../public/world/backrooms/flashlight.js');

function withNodes(fn) {
  const prev = gpu.nodes;
  gpu.nodes = N;
  try { return fn(); } finally { gpu.nodes = prev; }
}

function makeFakeWebGPURenderer(coordinateSystem = N.WebGPUCoordinateSystem) {
  let target = null, mrt = null;
  const draws = [];
  return {
    isWebGPURenderer: true,
    coordinateSystem,
    autoClear: true,
    info: { autoReset: true, render: { calls: 0, triangles: 0 } },
    draws,
    getRenderTarget: () => target,
    setRenderTarget: (t) => { target = t; },
    getMRT: () => mrt,
    setMRT: (m) => { mrt = m; },
    clear() {},
    render(scene, cam) {
      const seen = [];
      scene.traverseVisible((o) => { if (o.isMesh) seen.push({ mesh: o, material: o.material }); });
      draws.push({ scene, cam, target, mrt, autoClear: this.autoClear, seen });
    },
  };
}

test('kit-node-shadow.js and beam-shadows.js never statically import three.webgpu', () => {
  for (const f of ['public/world/backrooms/kit-node-shadow.js', 'public/world/backrooms/beam-shadows.js']) {
    assert.ok(!fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').includes('three.webgpu'), `${f} must read gpu.nodes`);
  }
});

test('Step 6: receivesBeamShadow recognizes kit-node surfaces and excludes held meshes', () => {
  withNodes(() => {
    const kit = createKit();
    const wall = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ vox: true }));
    assert.equal(wall.material.isNodeMaterial, true);
    assert.equal(wall.material.isKitSurface, true);
    assert.equal(receivesBeamShadow(wall), true, 'kit-node surface receives beam shadows');

    const held = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ vox: true }));
    held.renderOrder = HELD_ORDER;
    assert.equal(receivesBeamShadow(held), false, 'held surface never receives beam shadows');

    const plain = new THREE.Mesh(new THREE.BufferGeometry(), new N.MeshBasicNodeMaterial());
    assert.equal(receivesBeamShadow(plain), false);
    kit.dispose();
  });
});

test('Step 6: WebGPURenderer beam shadow depth pass, node cutout casters, MRT safety, rebuild & teardown', () => {
  withNodes(() => {
    const renderer = makeFakeWebGPURenderer(N.WebGPUCoordinateSystem);
    const activeMrt = { tag: 'glow-mrt' };
    renderer.setMRT(activeMrt);

    const kit = createKit();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170);
    const wall = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ vox: true }));
    const cutTex = new THREE.Texture();
    const grate = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ map: cutTex, cutout: true }));
    const blot = new THREE.Mesh(new THREE.BufferGeometry(), new N.MeshBasicNodeMaterial({ transparent: true, depthWrite: false }));
    const held = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ vox: false }));
    held.renderOrder = HELD_ORDER;
    scene.add(wall, grate, blot, held);

    kit.shared.uTorch.value = 1.5;
    kit.shared.uTorchOrigin.value.fromArray(FLASHLIGHT_POSES.hand.origin);
    kit.shared.uTorchDirection.value.fromArray(FLASHLIGHT_POSES.hand.direction);

    const wallFragBefore = wall.material.fragmentNode;
    const bs = createBeamShadows(renderer);

    // Off at 0: allocates nothing, touches nothing
    bs.draw(0, camera, [scene], kit.shared);
    assert.equal(bs.size, 0);
    assert.equal(bs.patched, 0);
    assert.equal(renderer.draws.length, 0);

    // High (1024): draws depth pass with MeshBasicNodeMaterial casters and rebuilds kit-node fragmentNode
    const st = bs.draw(1024, camera, [scene], kit.shared);
    assert.equal(st.drawn, true);
    assert.equal(bs.size, 1024);
    assert.equal(st.casters, 2, 'wall and grate cast; blot and held do not');
    assert.equal(st.receivers, 2, 'wall and grate receive; blot and held do not');
    assert.equal(renderer.draws.length, 1);

    const pass = renderer.draws[0];
    assert.equal(pass.mrt, null, 'MRT cleared during single-target depth pass');
    assert.equal(renderer.getMRT(), activeMrt, 'caller MRT restored after depth pass');
    assert.ok(pass.target?.depthTexture?.isDepthTexture);
    assert.equal(pass.target.depthTexture.compareFunction, N.LessEqualCompare);
    assert.equal(pass.target.depthTexture.minFilter, N.LinearFilter);
    assert.equal(pass.seen.length, 2);

    const wallCaster = pass.seen.find((x) => x.mesh === wall).material;
    const grateCaster = pass.seen.find((x) => x.mesh === grate).material;
    assert.equal(wallCaster.isNodeMaterial, true, 'caster uses NodeMaterial on WebGPURenderer');
    assert.equal(wallCaster.colorWrite, false);
    assert.equal(wallCaster.polygonOffset, true);
    assert.equal(grateCaster.isNodeMaterial, true);
    assert.equal(grateCaster.map, cutTex, 'cutout texture preserved on depth caster');
    assert.equal(grateCaster.alphaTest, 0.5, 'cutout alphaTest preserved');

    // Receiver patched and fragmentNode rebuilt for fresh pipeline cache key
    assert.equal(wall.material.defines.BEAM_SHADOWS, 1);
    assert.notEqual(wall.material.fragmentNode, wallFragBefore, 'fragmentNode rebuilt with BEAM_SHADOWS');
    assert.equal(wall.material.uniforms.uBeamShadowMap.value, pass.target.depthTexture);
    assert.equal(wall.material.uniforms.uBeamShadowK.value.y, 1);
    assert.equal(held.material.defines.BEAM_SHADOWS, undefined);
    assert.equal(blot.visible && held.visible, true, 'hidden meshes restored');

    // Verify uBeamShadowMatrix maps near -> z=0 and far -> z=1 on WebGPUCoordinateSystem
    const orig = kit.shared.uTorchOrigin.value;
    const dir = kit.shared.uTorchDirection.value.clone().normalize();
    const proj = (dist) => {
      const p = orig.clone().addScaledVector(dir, dist);
      const v = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(wall.material.uniforms.uBeamShadowMatrix.value);
      return [v.x / v.w, v.y / v.w, v.z / v.w];
    };
    const atNear = proj(BEAM_SHADOW.near);
    const atMid = proj(2.0);
    const atFar = proj(FLASHLIGHT.range);
    assert.ok(Math.abs(atNear[0] - 0.5) < 1e-5 && Math.abs(atNear[1] - 0.5) < 1e-5 && Math.abs(atNear[2] - 0) < 1e-5, `near on WebGPU: ${atNear}`);
    assert.ok(atMid[2] > 0 && atMid[2] < 1, `mid z in (0,1): ${atMid[2]}`);
    assert.ok(Math.abs(atFar[2] - 1) < 1e-5, `far on WebGPU: ${atFar}`);

    // Verify WebGLCoordinateSystem (WebGL 2 fallback backend) maps near -> z=0 and far -> z=1 identically
    const rGL2 = makeFakeWebGPURenderer(N.WebGLCoordinateSystem);
    const bsGL2 = createBeamShadows(rGL2);
    bsGL2.draw(1024, camera, [scene], kit.shared);
    const projGL2 = (dist) => {
      const p = orig.clone().addScaledVector(dir, dist);
      const v = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(bsGL2.uniforms.uBeamShadowMatrix.value);
      return [v.x / v.w, v.y / v.w, v.z / v.w];
    };
    assert.ok(Math.abs(projGL2(BEAM_SHADOW.near)[2] - 0) < 1e-5, 'near on WebGL 2 backend');
    assert.ok(Math.abs(projGL2(FLASHLIGHT.range)[2] - 1) < 1e-5, 'far on WebGL 2 backend');
    bsGL2.dispose();

    // Turning off rebuilds fragmentNode back without BEAM_SHADOWS
    const wallFragShadowed = wall.material.fragmentNode;
    bs.draw(0, camera, [scene], kit.shared);
    assert.equal(bs.size, 0);
    assert.equal(bs.patched, 0);
    assert.equal(wall.material.defines.BEAM_SHADOWS, undefined);
    assert.notEqual(wall.material.fragmentNode, wallFragShadowed, 'fragmentNode rebuilt without BEAM_SHADOWS');

    // Error recovery: materials, visibility, MRT, renderTarget all restored if render throws
    renderer.render = () => { throw new Error('device lost'); };
    assert.throws(() => bs.draw(1024, camera, [scene], kit.shared), /device lost/);
    assert.equal(wall.material.isKitSurface, true);
    assert.equal(blot.visible && held.visible, true);
    assert.equal(renderer.getMRT(), activeMrt);

    bs.dispose();
    kit.dispose();
  });
});
