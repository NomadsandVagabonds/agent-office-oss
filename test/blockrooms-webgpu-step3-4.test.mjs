// WebGPU Step 3 & Step 4 (docs/BLOCKROOMS-WEBGPU.md):
// - Step 3: locker-showers/water.js planar mirror via ReflectorNode (target oriented +Y, bounces: false, owned & disposed)
// - Step 4 (Medium tier): light maps (LIGHTMAP / TUBESHADOW / DOORLIGHT), floor sheen (SHEEN),
//   MRT emissive output on kit.surface & kit.glowing, and vhs-node supersample + 6-step glow bloom chain.
import test from 'node:test';
import assert from 'node:assert/strict';
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

const [
  THREE,
  WGPU,
  { setGpu },
  { createKit },
  { createVhsNode },
  { profile },
  { createBeamShadows },
  { generate },
  { buildWorld, loadCatalogue },
  { BUILDERS },
] = await Promise.all([
  import('../public/vendor/three.module.min.js'),
  import('../public/vendor/three.webgpu.min.js'),
  import('../public/world/engine/gpu.js'),
  import('../public/world/backrooms/kit.js'),
  import('../public/world/backrooms/vhs-node.js'),
  import('../public/world/backrooms/graphics.js'),
  import('../public/world/backrooms/beam-shadows.js'),
  import('../public/world/backrooms/gen.js'),
  import('../public/world/backrooms/world.js'),
  import('../public/world/backrooms/rooms.js'),
]);

function stubDocument() {
  const prev = globalThis.document;
  const draw = new Proxy({}, {
    get: (_, k) => k === 'measureText' ? (txt) => ({ width: String(txt).length * 6 })
      : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
      : /Gradient/.test(k) ? () => ({ addColorStop() {} })
      : () => {},
    set: () => true,
  });
  globalThis.document = { createElement: () => ({ getContext: () => draw, width: 128, height: 128 }) };
  return () => { globalThis.document = prev; };
}

test('Step 3: locker-showers water installs ReflectorNode oriented +Y under gpu.nodes', async (t) => {
  const restoreDoc = stubDocument();
  setGpu({ renderer: 'webgpu', backend: 'webgpu', nodes: WGPU });
  t.after(() => {
    setGpu({ renderer: 'webgl', backend: 'webgl', nodes: null });
    restoreDoc();
  });

  const kit = createKit();
  t.after(() => kit.dispose());
  const catalogue = await loadCatalogue(kit);
  const { build } = await import('../public/world/backrooms/rooms/locker-showers.js');
  const level = generate('webgpu-step3-showers', { theme: 'waterpark', only: ['locker-showers'] });
  const rawDef = level.rooms.find((r) => r.arch === 'locker-showers');
  const def = { ...rawDef, id: 0, doors: rawDef.doors.map((d) => ({ ...d, to: 0 })), links: [], wins: [] };
  const world = await buildWorld(kit, { ...level, rooms: [def], links: [], windows: [] }, {
    catalogue, builders: { ...BUILDERS, 'locker-showers': build },
    hatches: new Map(), creations: {}, cast: [{ name: 'Ivory Marten', look: {} }],
    sound: new Proxy({}, { get: () => () => {} }),
    denizens: { add() {}, remove() {}, map: new Map() },
    inventory: { held: () => null, torchPower: () => 0, drainBattery() {} },
    health: { damage: () => ({ ok: true, dead: false }), heal: () => true },
    hud: { glitch() {}, flash() {} },
    run: { met() {}, survived() {}, itemFound() {} },
    player: { RADIUS: 0.22, crouch: false, hurry: false, lean: { side: 0, dx: 0, dz: 0 }, warp() {}, addImpulse() {}, addDrag() {}, setFloorSink() {} },
    sees: () => false, play() {}, hold: () => () => {}, descend: () => {},
  });

  const group = world.scene.getObjectByName('changing-water');
  assert.ok(group, 'changing-water group exists');
  const sheet = group.getObjectByName('changing-water-sheet');
  assert.ok(sheet?.material?.isNodeMaterial, 'water sheet is a NodeMaterial');
  assert.ok(sheet.material.outputNode, 'water sheet uses outputNode (MRT-compatible)');
  const reflTarget = group.children.find((ch) => ch !== sheet && Math.abs(ch.rotation.x + Math.PI / 2) < 1e-4);
  assert.ok(reflTarget, 'ReflectorNode target is attached to changing-water group rotated -PI/2 around X (facing +Y)');
  world.dispose?.();
});

test('Step 4: Medium tier builds LIGHTMAP, SHEEN, glowing MRT, and vhs-node supersample + glow chain', async (t) => {
  const restoreDoc = stubDocument();
  setGpu({ renderer: 'webgpu', backend: 'webgpu', nodes: WGPU });
  t.after(() => {
    setGpu({ renderer: 'webgl', backend: 'webgl', nodes: null });
    restoreDoc();
  });

  const med = profile('medium');
  const kit = createKit({ gfx: med });
  t.after(() => kit.dispose());
  const catalogue = await loadCatalogue(kit);

  // Glowing material uses MeshBasicNodeMaterial + userData.emissiveMrt under gpu.nodes (no material.mrtNode so Classic stays 1-attachment)
  const lampMat = kit.glowing(kit.tex.white(), 2.2, [1, 0.98, 0.9]);
  assert.equal(lampMat.isNodeMaterial, true);
  assert.equal(lampMat.mrtNode, null, 'material.mrtNode stays null so Classic single-target draws never fail');
  assert.ok(lampMat.userData.emissiveMrt, 'lamp glowing material emits into MRT emissive attachment');
  const signMat = kit.glowing(kit.tex.custom('test:sign', 16, 16, () => {}), 1.5, [1, 1, 1], { bloom: 2 });
  assert.equal(signMat.userData.glow, 'picture');
  assert.ok(signMat.userData.emissiveMrt, 'picture glowing material emits into MRT emissive attachment');
  const haloMat = kit.glowing(kit.tex.white(), 1, [1, 1, 1], { transparent: true, depthWrite: false });
  assert.ok(haloMat.userData.emissiveMrt, 'transparent non-depth-writing halo preserves emissive buffer behind it');

  // Build a real Medium-tier floor (mall terrazzo floor triggers SHEEN + LIGHTMAP + TUBESHADOW + DOORLIGHT + glowing panels)
  const level = generate('webgpu-step4-med', { theme: 'mall' });
  const world = await buildWorld(kit, level, {
    catalogue, builders: BUILDERS,
    hatches: new Map(), creations: {}, cast: [{ name: 'Ivory Marten', look: {} }],
    sound: new Proxy({}, { get: () => () => {} }),
    denizens: { add() {}, remove() {}, map: new Map() },
    inventory: { held: () => null, torchPower: () => 0, drainBattery() {} },
    health: { damage: () => ({ ok: true, dead: false }), heal: () => true },
    hud: { glitch() {}, flash() {} },
    run: { met() {}, survived() {}, itemFound() {} },
    player: { RADIUS: 0.22, crouch: false, hurry: false, lean: { side: 0, dx: 0, dz: 0 }, warp() {}, addImpulse() {}, addDrag() {}, setFloorSink() {} },
    sees: () => false, play() {}, hold: () => () => {}, descend: () => {},
  });

  let lmCount = 0, sheenCount = 0, voxelMrtCount = 0, glowMats = 0, badShaders = 0;
  world.scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (m?.isShaderMaterial) badShaders++;
    if (m?.defines?.LIGHTMAP) lmCount++;
    if (m?.defines?.SHEEN) sheenCount++;
    if (m?.defines?.VOXEL && m?.userData?.emissiveMrt) voxelMrtCount++;
    if (m?.userData?.glow && m?.userData?.emissiveMrt) glowMats++;
  });
  assert.equal(badShaders, 0, 'zero ShaderMaterials on Medium tier under gpu.nodes');
  assert.ok(lmCount > 0, 'Medium tier built LIGHTMAP surfaces');
  assert.ok(sheenCount > 0, 'records lino floor built SHEEN surfaces');
  assert.ok(voxelMrtCount > 0, 'voxel props attached MRT emissive node');
  assert.ok(glowMats > 0, 'glowing panels attached MRT emissive node');
  world.dispose?.();

  // vhs-node supersample + MRT glow chain lifecycle (Classic -> Medium -> High -> Classic)
  const calls = [];
  const fakeRenderer = {
    isWebGPURenderer: true,
    toneMapping: 0,
    outputColorSpace: 'srgb',
    getPixelRatio: () => 1,
    setMRT: (m) => calls.push(['mrt', !!m]),
    setRenderTarget: (rt) => calls.push(['rt', rt ? rt.textures?.length || 1 : 0]),
    render: () => calls.push(['render']),
  };
  const cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170);
  const vhs = createVhsNode(fakeRenderer, cam, { level: 2, profile: profile('classic') });
  vhs.layout(960, 720);
  assert.equal(vhs.glow, null, 'Classic has no glow chain');

  vhs.setProfile(med);
  vhs.layout(960, 720);
  assert.ok(vhs.glow?.mrt, 'Medium activates MRT glow chain');
  calls.length = 0;
  vhs.render(0.016);
  assert.ok(calls.some(([k, v]) => k === 'mrt' && v === true), 'Medium enables MRT for scene draw');
  assert.ok(calls.some(([k, v]) => k === 'mrt' && v === false), 'Medium clears MRT after scene draw');
  assert.ok(calls.some(([k, v]) => k === 'rt' && v === 2), 'Medium draws into 2-attachment MRT RenderTarget');

  // High beamShadows safely no-ops on WebGPURenderer until Step 6
  const bs = createBeamShadows(fakeRenderer);
  const st = bs.draw(1024, cam, [new THREE.Scene()], { uTorch: { value: 1 }, uTorchOrigin: { value: new THREE.Vector3() }, uTorchDirection: { value: new THREE.Vector3(0, 0, -1) } });
  assert.equal(st.drawn, false);

  vhs.dispose();
});
