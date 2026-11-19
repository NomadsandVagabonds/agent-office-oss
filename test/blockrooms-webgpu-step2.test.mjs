// WebGPU Step 2 ("Every tier looks right at Classic", docs/BLOCKROOMS-WEBGPU.md):
// verifies that with gpu.nodes enabled, every Classic room surface patch, pool optics,
// waterpark / forest shader, extinguisher spray, paper-fire spill, held-item depth sliver,
// and grotto snow builds valid NodeMaterials with zero ShaderMaterial / PointsMaterial
// fallbacks, while leaving the default WebGL path untouched when gpu.nodes is null.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  { gpu, setGpu },
  { createKit },
  { createFireSpillMaterial },
  { createSpray },
  { createHandView, HELD_DEPTH_SLIVER },
  { addLightShafts },
  { addMistVeils },
  { generate },
  { buildWorld, loadCatalogue },
  { BUILDERS },
] = await Promise.all([
  import('../public/vendor/three.module.min.js'),
  import('../public/vendor/three.webgpu.min.js'),
  import('../public/world/engine/gpu.js'),
  import('../public/world/backrooms/kit.js'),
  import('../public/world/backrooms/inventory-fire.js'),
  import('../public/world/backrooms/spray.js'),
  import('../public/world/backrooms/hand.js'),
  import('../public/world/backrooms/forest-fx.js'),
  import('../public/world/backrooms/forest-maze.js'),
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

test('no Step 2 module statically imports three.webgpu', () => {
  const files = [
    'public/world/backrooms/kit-node.js',
    'public/world/backrooms/pool-optics.js',
    'public/world/backrooms/spray.js',
    'public/world/backrooms/inventory-fire.js',
    'public/world/backrooms/forest-fx.js',
    'public/world/backrooms/forest-maze.js',
    'public/world/backrooms/hand.js',
    'public/world/backrooms/hand-notes.js',
    'public/world/backrooms/rooms/kiddie-lagoon.js',
    'public/world/backrooms/rooms/the-grotto.js',
    'public/world/backrooms/rooms/locker-showers/glaze.js',
    'public/world/backrooms/rooms/locker-showers/fold-screen.js',
    'public/world/backrooms/rooms/locker-showers/assets.js',
    'public/world/backrooms/rooms/locker-showers/water.js',
    'public/world/backrooms/rooms/return-pool/art.js',
    'public/world/backrooms/rooms/bellmouth/art.js',
    'public/world/backrooms/rooms/flume-connector/water.js',
    'public/world/backrooms/rooms/whirlpool-flume/siphon.js',
  ];
  for (const f of files) {
    assert.ok(!fs.readFileSync(f, 'utf8').includes('three.webgpu'), `${f} must not import three.webgpu directly`);
  }
});

test('Step 2 effects build NodeMaterials under gpu.nodes and stay ShaderMaterial under WebGL', (t) => {
  const restoreDoc = stubDocument();
  t.after(() => {
    setGpu({ renderer: 'webgl', backend: 'webgl', nodes: null });
    restoreDoc();
  });

  // 1. Default WebGL path untouched
  assert.equal(gpu.nodes, null);
  const glFire = createFireSpillMaterial();
  assert.equal(glFire.isShaderMaterial, true);
  assert.equal(glFire.userData.coopEffect, 'paper-fire-spill');
  glFire.dispose();

  // 2. Enable WebGPU node build
  setGpu({ renderer: 'webgpu', backend: 'webgpu', nodes: WGPU });

  // Paper fire spill
  const gpuFire = createFireSpillMaterial();
  assert.equal(gpuFire.isNodeMaterial, true);
  assert.equal(gpuFire.isShaderMaterial, undefined);
  assert.equal(gpuFire.userData.coopEffect, 'paper-fire-spill');
  assert.equal(gpuFire.uniforms.strength.value, 0.6);
  gpuFire.dispose();

  // Extinguisher spray & white-out overlay
  const scene = new THREE.Scene();
  const spray = createSpray({ world: { scene, los: () => true, lightAt: () => [0.7, 0.7, 0.7] } });
  spray.emit(0.05, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
  const puffMesh = scene.getObjectByName('extinguisher-spray');
  const overMesh = scene.getObjectByName('extinguisher-white');
  assert.ok(puffMesh && overMesh);
  assert.equal(puffMesh.material.isNodeMaterial, true);
  assert.equal(overMesh.material.isNodeMaterial, true);
  assert.ok(puffMesh.material.vertexNode && puffMesh.material.outputNode);
  assert.ok(overMesh.material.vertexNode && overMesh.material.outputNode);
  spray.dispose();

  // Kit surface patchNode + setHeldInFront + kit.points
  const kit = createKit();
  t.after(() => kit.dispose());
  const surf = kit.surface({ map: kit.tex.white(), wet: 0.5, alpha: 0.8 });
  assert.equal(surf.isNodeMaterial, true);
  assert.equal(typeof surf.patchNode, 'function');
  assert.equal(typeof surf.setHeldInFront, 'function');
  surf.patchNode({
    position: ({ pos }) => pos,
    uv: ({ mapUv }) => mapUv,
    wetNormal: ({ wn }) => wn,
    color: ({ c }) => { c.mulAssign(0.9); },
  });
  assert.ok(surf.positionNode && surf.outputNode);
  surf.setHeldInFront(HELD_DEPTH_SLIVER);
  assert.ok(surf.depthNode, 'setHeldInFront sets depthNode for WebGPU sliver');

  const pts = kit.points(new Float32Array([0, 1, 0, 1, 1, 0]), { size: 0.045, map: kit.tex.white(), color: [0.86, 0.85, 0.82] });
  assert.equal(pts.object.isMesh, true, 'WebGPU points render as instanced quads, not 1px THREE.Points');
  assert.equal(pts.object.material.isNodeMaterial, true);
  assert.equal(pts.object.geometry.instanceCount, 2);

  // Held view items get depthNode automatically
  const cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170);
  const handScene = new THREE.Scene();
  const handView = createHandView({
    kit,
    world: { scene: handScene, lightAt: () => [0.8, 0.8, 0.8] },
    vhs: { picture: { w: 960, h: 720 } },
    player: { me: { x: 0, z: 0, speed: 0, punch: 0 } },
    inventory: { held: () => ({ type: 'torch', lit: true }) },
  }, cam);
  handView.stick('n1', { u: 0.1, v: 0.1, colour: '#f4e04d' });
  handView.update(0.016, true);
  let heldMeshes = 0;
  handScene.traverse((o) => {
    if (o.isMesh && o.material?.isKitSurface) {
      heldMeshes++;
      assert.ok(o.material.depthNode, `held mesh ${o.name || 'item'} should have depthNode sliver`);
    }
  });
  assert.ok(heldMeshes >= 2, 'torch + stuck note meshes should be marked held-in-front');
  handView.dispose();
});

test('ported rooms produce zero ShaderMaterial and zero PointsMaterial under gpu.nodes', async (t) => {
  const restoreDoc = stubDocument();
  setGpu({ renderer: 'webgpu', backend: 'webgpu', nodes: WGPU });
  t.after(() => {
    setGpu({ renderer: 'webgl', backend: 'webgl', nodes: null });
    restoreDoc();
  });

  const kit = createKit();
  t.after(() => kit.dispose());
  const catalogue = await loadCatalogue(kit);

  const targets = [
    { theme: 'waterpark', rooms: ['kiddie-lagoon', 'locker-showers', 'return-pool', 'bellmouth-baths', 'flume-connector', 'whirlpool-flume'] },
    { theme: 'forest', rooms: ['bog-boardwalk', 'old-growth'] },
    { theme: 'mall', rooms: ['the-grotto', 'the-sets'] },
  ];

  const loaded = Object.fromEntries(
    await Promise.all(
      targets.flatMap((g) => g.rooms).map(async (id) => [id, (await import(`../public/world/backrooms/rooms/${id}.js`)).build]),
    ),
  );
  const builders = { ...BUILDERS, ...loaded };

  for (const { theme, rooms } of targets) {
    for (const id of rooms) {
      const level = generate(`webgpu-step2-${id}`, { theme, only: [id] });
      const rawDef = level.rooms.find((r) => r.arch === id);
      assert.ok(rawDef, `generated room ${id} (${theme})`);
      const def = { ...rawDef, id: 0, doors: rawDef.doors.map((d) => ({ ...d, to: 0 })), links: [], wins: [] };
      const env = {
        catalogue,
        builders,
        hatches: new Map(),
        creations: {},
        cast: [{ name: 'Ivory Marten', look: {} }],
        sound: new Proxy({}, { get: () => () => {} }),
        denizens: { add() {}, remove() {}, map: new Map() },
        inventory: { held: () => null, torchPower: () => 0, drainBattery() {} },
        health: { damage: () => ({ ok: true, dead: false }), heal: () => true },
        hud: { glitch() {}, flash() {} },
        run: { met() {}, survived() {}, itemFound() {} },
        player: { RADIUS: 0.22, crouch: false, hurry: false, lean: { side: 0, dx: 0, dz: 0 }, warp() {}, addImpulse() {}, addDrag() {}, setFloorSink() {} },
        sees: () => false,
        play() {},
        hold: () => () => {},
        descend: () => {},
        renderer: { isWebGPURenderer: true, getRenderTarget: () => null, setRenderTarget() {}, render() {} },
      };
      const world = await buildWorld(kit, { ...level, rooms: [def], links: [], windows: [] }, env);
      env.world = world;

      const bad = [];
      let nodeMats = 0;
      world.scene.traverse((o) => {
        if (o.isPoints) bad.push(`THREE.Points in ${id}: ${o.name}`);
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          if (m.isShaderMaterial) bad.push(`ShaderMaterial in ${id}: ${o.name}`);
          if (m.isNodeMaterial) nodeMats++;
        }
      });
      assert.deepEqual(bad, [], `no ShaderMaterial or Points in ${id} under gpu.nodes`);
      assert.ok(nodeMats > 0, `${id} built NodeMaterials`);

      // Also verify locker-showers water onBeforeRender safely no-ops on WebGPURenderer
      world.scene.traverse((o) => {
        if (o.name === 'changing-water-sheet' && o.onBeforeRender) {
          o.onBeforeRender({ isWebGPURenderer: true }, world.scene, new THREE.PerspectiveCamera());
        }
      });

      // Also exercise opt-in forest mist veils & light shafts under gpu.nodes
      if (id === 'bog-boardwalk') {
        const rt = world.rooms[0];
        const fakeC = {
          H: rt.def.H, kit, rt, room: rt.def, after: [],
          tick() {}, ceilAt: () => rt.def.H, floorAt: () => 0,
        };
        addMistVeils(fakeC, [{ x0: -1, z0: 0, x1: 1, z1: 0 }], { force: true });
        addLightShafts(fakeC, [{ x: 0, z: 0, bank: 0 }]);
        for (const fn of fakeC.after) fn();
        const mist = rt.group.getObjectByName(`forest:detail-mist:${rt.def.id}`);
        const shafts = rt.group.getObjectByName(`forest:detail-shafts:${rt.def.id}`);
        assert.ok(mist?.material?.isNodeMaterial, 'forest mist veil uses NodeMaterial');
        assert.ok(shafts?.material?.isNodeMaterial, 'forest light shafts use NodeMaterial');
      }

      world.dispose?.();
    }
  }
});
