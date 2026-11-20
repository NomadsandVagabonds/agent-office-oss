// Tests for Floor 1 Yellow Office wear & micro-architecture (public/world/backrooms/office-wear.js):
// 1. 100% deterministic across repeated builds & NEVER consumes c.R (existing layout/props identical).
// 2. Restrained coverage across 20+ rooms (peels, leaks/drips, ajar tiles stay sparse; non-yellow & crawl skipped).
// 3. Live ceiling drip animation ticks cleanly across 300 frames (forms, falls, hits puddle, ripple expands & fades; sound safe).
// 4. Works cleanly under gpu.nodes (WebGPU) with ZERO ShaderMaterial and ZERO PointsMaterial; within room budget.
// 5. Never statically imports three.webgpu; works standalone AND upgrades seamlessly when kit.tex.* hooks are provided.
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
  { generate, makeRng, TILE },
  { buildWorld },
  { roomCost, overBudget },
  makers,
  { OFFICE_WEAR_LIMITS, buildLeakSpot, dressOfficeWear },
] = await Promise.all([
  import('../public/vendor/three.module.min.js'),
  import('../public/vendor/three.webgpu.min.js'),
  import('../public/world/engine/gpu.js'),
  import('../public/world/backrooms/kit.js'),
  import('../public/world/backrooms/gen.js'),
  import('../public/world/backrooms/world.js'),
  import('../public/world/backrooms/budget.js'),
  import('../public/world/props/office.js'),
  import('../public/world/backrooms/office-wear.js'),
]);

function stubDocument() {
  const prev = globalThis.document;
  const draw = new Proxy({}, {
    get: (_, name) => name === 'measureText' ? (txt) => ({ width: String(txt).length * 6 })
      : /Gradient|Pattern/.test(name) ? () => ({ addColorStop() {} })
      : () => {},
    set: () => true,
  });
  globalThis.document = { createElement: () => ({ getContext: () => draw, style: {}, width: 128, height: 128 }) };
  return () => {
    if (prev === undefined) delete globalThis.document;
    else globalThis.document = prev;
  };
}

const catalogueOf = (kit) => ({
  has: (type) => typeof makers[type] === 'function',
  entry: () => null,
  geo: (type) => (makers[type] ? kit.model(type, makers[type]) : null),
});

function meshesOf(world, rt) {
  const out = [];
  rt.group.traverse((o) => { if (o.isMesh && o.geometry) out.push(o); });
  for (const f of world.furniture) if (f.room === rt.id) f.group.traverse((o) => { if (o.isMesh && o.geometry) out.push(o); });
  return out;
}

function geometryFingerprint(world, rt) {
  let verts = 0, tris = 0, hash = 0;
  for (const m of meshesOf(world, rt)) {
    const pos = m.geometry.attributes.position;
    if (!pos) continue;
    verts += pos.count;
    tris += (m.geometry.index ? m.geometry.index.count : pos.count) / 3;
    const arr = pos.array;
    for (let i = 0; i < arr.length; i += Math.max(1, Math.floor(arr.length / 64))) {
      hash = (Math.imul(hash, 31) + Math.round(arr[i] * 1000)) >>> 0;
    }
  }
  return [meshesOf(world, rt).length, verts, Math.round(tris), hash];
}

test('office-wear.js never statically imports three.webgpu and exports frozen OFFICE_WEAR_LIMITS', () => {
  const src = fs.readFileSync(new URL('../public/world/backrooms/office-wear.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('three.webgpu'), 'must never import three.webgpu');
  assert.ok(!src.includes('ShaderMaterial'), 'must never construct raw ShaderMaterial');
  assert.ok(!src.includes('PointsMaterial'), 'must never construct raw PointsMaterial');
  assert.ok(Object.isFrozen(OFFICE_WEAR_LIMITS), 'OFFICE_WEAR_LIMITS must be frozen');
  assert.ok(OFFICE_WEAR_LIMITS.peelChance > 0.1 && OFFICE_WEAR_LIMITS.peelChance < 0.45);
  assert.ok(OFFICE_WEAR_LIMITS.leakChance > 0.1 && OFFICE_WEAR_LIMITS.leakChance < 0.4);
  assert.ok(OFFICE_WEAR_LIMITS.ajarTileChance > 0.05 && OFFICE_WEAR_LIMITS.ajarTileChance < 0.3);
});

test('dressOfficeWear is 100% deterministic and NEVER touches c.R (layout & props stay bit-identical)', async (t) => {
  const restoreDoc = stubDocument();
  t.after(restoreDoc);

  // Measure RNG stream values and furniture placements BEFORE vs AFTER dressOfficeWear is inserted mid-build.
  async function runBuild(withWear) {
    const level = generate(42, { count: 0 });
    const kit = createKit();
    const rngSamples = [];
    const propSpots = [];
    const summaries = [];

    const builder = (c) => {
      c.shell();
      const first = c.spot(0.6);
      if (first) { c.prop('cabinet', first.x, first.z); propSpots.push([c.room.id, 'cab', +first.x.toFixed(4), +first.z.toFixed(4)]); }
      if (withWear) summaries.push(dressOfficeWear(c));
      // Draw from c.R and c.spot AFTER dressOfficeWear — must be identical whether wear ran or not!
      rngSamples.push([c.room.id, +c.R().toFixed(8), +c.R().toFixed(8)]);
      const second = c.spot(0.5);
      if (second) { c.prop('desk', second.x, second.z); propSpots.push([c.room.id, 'desk', +second.x.toFixed(4), +second.z.toFixed(4)]); }
      const wall = c.wallSpot(0.8);
      if (wall) propSpots.push([c.room.id, 'wall', wall.side, +wall.at.toFixed(4)]);
    };

    const world = await buildWorld(kit, level, {
      catalogue: catalogueOf(kit),
      barricadesEnabled: false,
      builders: { plain: builder, start: builder },
    });
    const fp = world.rooms.map((rt) => geometryFingerprint(world, rt));
    const colliders = world.rooms.map((rt) => rt.colliders.length);
    world.dispose();
    kit.dispose();
    return { rngSamples, propSpots, summaries, fp, colliders };
  }

  const base = await runBuild(false);
  const runA = await runBuild(true);
  const runB = await runBuild(true);

  assert.deepEqual(runA.rngSamples, base.rngSamples, 'c.R stream must be 100% untouched');
  assert.deepEqual(runA.propSpots, base.propSpots, 'subsequent c.spot/c.wallSpot placements must be 100% untouched');
  assert.deepEqual(runA.colliders, base.colliders, 'office wear must add zero colliders');
  assert.deepEqual(runA.summaries, runB.summaries, 'wear summaries must be 100% deterministic');
  assert.deepEqual(runA.fp, runB.fp, 'wear geometry fingerprints must be 100% deterministic across builds');
});

test('restrained coverage across 20+ rooms: peels, leaks/drips, and ajar tiles stay sparse; non-yellow & crawl skipped', async (t) => {
  const restoreDoc = stubDocument();
  t.after(restoreDoc);

  // Build 24 synthetic Floor 1 yellow rooms of realistic office dimensions (5x5 to 8x7 m)
  const level = generate(13, { count: 0 });
  const baseRoom = level.rooms.find((r) => r.kind === 'plain');
  const rooms = Array.from({ length: 24 }, (_, id) => {
    const W = id % 4 === 0 ? 7 : 5, D = id % 3 === 0 ? 6 : 5;
    return {
      ...baseRoom,
      id,
      kind: 'plain',
      x: id * 10, z: 0, w: W, d: D, W, D, H: 2.6, cx: id * 10 + W / 2, cz: D / 2, y: 0, rot: 0,
      crawl: false,
      shape: null,
      pillars: [],
      wins: [],
      doors: [{ side: 'front', c: 0, w: 1.1, h: 2.05, sill: 0, to: (id + 1) % 24, link: id }],
      panels: [{ x: -0.9, z: 0, state: 'on' }, { x: 0.9, z: 0, state: 'on' }],
    };
  });

  const kit = createKit();
  const summaries = [];
  const world = await buildWorld(kit, { ...level, theme: 'yellow', rooms, links: [], windows: [] }, {
    catalogue: catalogueOf(kit),
    barricadesEnabled: false,
    builders: {
      plain: (c) => {
        c.shell();
        summaries.push(dressOfficeWear(c));
      },
    },
  });
  t.after(() => { world.dispose(); kit.dispose(); });

  const nonNull = summaries.filter(Boolean);
  assert.equal(nonNull.length, 24);

  const count = (key) => nonNull.filter((s) => s[key] > 0).length;
  const peelRooms = count('peels');
  const leakRooms = count('leaks');
  const ajarRooms = count('ajarTiles');
  const switchRooms = count('switches');
  const ventRooms = count('vents');

  // Must appear at least once across 24 rooms, yet stay clearly sparse (restrained, NOT every room!)
  assert.ok(peelRooms >= 1 && peelRooms <= 14, `peelRooms=${peelRooms} should be sparse across 24 rooms`);
  assert.ok(leakRooms >= 1 && leakRooms <= 12, `leakRooms=${leakRooms} should be sparse across 24 rooms`);
  assert.ok(ajarRooms >= 1 && ajarRooms <= 9, `ajarRooms=${ajarRooms} should be sparse across 24 rooms`);
  assert.ok(switchRooms >= 4 && switchRooms <= 22, `switchRooms=${switchRooms} should be moderate across 24 rooms`);
  assert.ok(ventRooms >= 2 && ventRooms <= 20, `ventRooms=${ventRooms} should be moderate across 24 rooms`);

  // Every single room stays well inside the Backrooms mesh & triangle budget
  for (const rt of world.rooms) {
    const cost = roomCost(rt.group);
    const over = overBudget(cost, { lights: rt.lights.length });
    assert.deepEqual(over, [], `room ${rt.id} over budget: ${over.join('; ')}`);
  }

  // Non-yellow themes & crawlspaces early-return null without adding wear
  const nonYellowKit = createKit();
  let nonYellowResult = 'unset', crawlResult = 'unset';
  const nonYellowWorld = await buildWorld(nonYellowKit, {
    ...level,
    theme: 'waterpark',
    rooms: [
      { ...rooms[0], id: 0, crawl: false, doors: [] },
      { ...rooms[1], id: 1, x: 20, cx: 22.5, crawl: true, doors: [] },
    ],
    links: [],
    windows: [],
  }, {
    catalogue: catalogueOf(nonYellowKit),
    barricadesEnabled: false,
    builders: {
      plain: (c) => {
        c.shell();
        if (c.room.id === 0) nonYellowResult = dressOfficeWear(c);
        else crawlResult = dressOfficeWear(c, { onlyYellow: false });
      },
    },
  });
  t.after(() => { nonYellowWorld.dispose(); nonYellowKit.dispose(); });
  assert.equal(nonYellowResult, null, 'non-yellow theme must early-return null');
  assert.equal(crawlResult, null, 'crawlspace must early-return null');
});

test('live ceiling drip ticks smoothly across 300 frames: forms, falls, impacts puddle, ripples expand & fade', async (t) => {
  const restoreDoc = stubDocument();
  t.after(restoreDoc);

  const level = generate(9, { count: 0 });
  const baseRoom = level.rooms.find((r) => r.kind === 'plain');
  const def = {
    ...baseRoom,
    id: 0, kind: 'plain', x: 0, z: 0, w: 6, d: 6, W: 6, D: 6, H: 2.6, cx: 3, cz: 3, y: 0, rot: 0,
    crawl: false, shape: null, pillars: [], wins: [], doors: [],
    panels: [{ x: -1.5, z: -1.5, state: 'on' }],
  };

  let soundCalls = 0;
  let leakInfo = null;
  const kit = createKit();
  const world = await buildWorld(kit, { ...level, theme: 'yellow', rooms: [def], links: [], windows: [] }, {
    catalogue: catalogueOf(kit),
    barricadesEnabled: false,
    sound: {
      play: (name, opts) => {
        soundCalls++;
        if (name === 'drip') assert.ok(opts && opts.vol > 0 && opts.vol <= 0.3);
      },
    },
    hear: () => ({ vol: 0.5, pan: 0 }),
    builders: {
      plain: (c) => {
        c.shell();
        leakInfo = buildLeakSpot(c, 0.3, 0.3, makeRng('drip-test'));
      },
    },
  });
  t.after(() => { world.dispose(); kit.dispose(); });

  assert.ok(leakInfo);
  assert.ok(Math.abs(leakInfo.tileX / TILE - Math.round(leakInfo.tileX / TILE - 0.5) - 0.5) < 1e-6, 'tileX snapped to TILE grid');
  assert.ok(Math.abs(leakInfo.tileZ / TILE - Math.round(leakInfo.tileZ / TILE - 0.5) - 0.5) < 1e-6, 'tileZ snapped to TILE grid');
  assert.equal(leakInfo.ceilY, 2.6);

  const rt = world.rooms[0];
  const drop = rt.group.getObjectByName('office-drip-drop');
  const ripple = rt.group.getObjectByName('office-drip-ripple');
  const puddle = rt.group.getObjectByName('office-puddle');
  assert.ok(drop, 'droplet mesh exists');
  assert.ok(ripple, 'ripple ring mesh exists');
  assert.ok(puddle, 'glossy puddle mesh exists');
  assert.equal(drop.castShadow, false);
  assert.equal(rt.ticks.length, 1, 'drip registers a tick callback');

  let sawFormOrFall = false;
  let minDropY = Infinity;
  let maxDropY = -Infinity;
  let maxRippleScale = 0;
  let sawRippleFadeToHidden = false;
  let prevRippleVisible = false;

  const dt = 1 / 30; // 300 frames = 10 seconds -> guaranteed at least 1-2 full drip cycles
  for (let frame = 0; frame < 300; frame++) {
    for (const fn of rt.ticks) fn(dt, frame * dt, { x: 0.5, z: 0.5, inside: true });
    if (drop.visible) {
      sawFormOrFall = true;
      minDropY = Math.min(minDropY, drop.position.y);
      maxDropY = Math.max(maxDropY, drop.position.y);
    }
    if (ripple.visible) {
      maxRippleScale = Math.max(maxRippleScale, ripple.scale.x);
      assert.ok(ripple.material.opacity >= 0 && ripple.material.opacity <= 0.56);
    } else if (prevRippleVisible) {
      sawRippleFadeToHidden = true;
    }
    prevRippleVisible = ripple.visible;
  }

  assert.ok(sawFormOrFall, 'droplet became visible during form/fall');
  assert.ok(maxDropY > 2.4 && minDropY < 1.2, `droplet fell across room height (max=${maxDropY.toFixed(2)}, min=${minDropY.toFixed(2)})`);
  assert.ok(maxRippleScale > 4.5 && maxRippleScale <= 6.01, `ripple expanded toward 6x (max=${maxRippleScale.toFixed(2)})`);
  assert.ok(sawRippleFadeToHidden, 'ripple faded out and hid cleanly');
  assert.ok(soundCalls >= 1, `quiet drip sound fired (${soundCalls}x) when player was nearby`);
});

test('works cleanly under gpu.nodes (WebGPU) with ZERO ShaderMaterial and ZERO PointsMaterial + optional kit.tex hooks', async (t) => {
  const restoreDoc = stubDocument();
  t.after(() => {
    setGpu({ renderer: 'webgl', backend: 'webgl', nodes: null });
    restoreDoc();
  });

  setGpu({ renderer: 'webgpu', backend: 'webgpu', nodes: WGPU });
  assert.equal(gpu.nodes, WGPU);

  const level = generate(7, { count: 0 });
  const baseRoom = level.rooms.find((r) => r.kind === 'plain');
  const def = {
    ...baseRoom,
    id: 0, kind: 'plain', x: 0, z: 0, w: 7, d: 7, W: 7, D: 7, H: 2.6, cx: 3.5, cz: 3.5, y: 0, rot: 0,
    crawl: false, shape: null, pillars: [], wins: [],
    doors: [{ side: 'front', c: 0, w: 1.1, h: 2.05, sill: 0, to: 0, link: 0 }],
    panels: [{ x: -1.5, z: 0, state: 'on' }, { x: 1.5, z: 0, state: 'on' }],
  };

  const kit = createKit();
  // Verify optional kit.tex hooks are called when wired in
  let hookHits = { stainAtlas: 0, waterTile: 0, peel: 0, puddle: 0 };
  const dummyTex = () => kit.tex.white();
  kit.tex.stainAtlas = () => { hookHits.stainAtlas++; return dummyTex(); };
  kit.tex.waterTile = () => { hookHits.waterTile++; return dummyTex(); };
  kit.tex.peel = () => { hookHits.peel++; return dummyTex(); };
  kit.tex.puddle = () => { hookHits.puddle++; return dummyTex(); };

  const world = await buildWorld(kit, { ...level, theme: 'yellow', rooms: [def], links: [], windows: [] }, {
    catalogue: catalogueOf(kit),
    barricadesEnabled: false,
    builders: {
      plain: (c) => {
        c.shell();
        dressOfficeWear(c, { forceLeak: true });
      },
    },
  });
  t.after(() => { world.dispose(); kit.dispose(); });

  const rt = world.rooms[0];
  let meshCount = 0;
  let shaderMats = 0;
  let pointsMats = 0;
  let nodeMats = 0;

  rt.group.traverse((o) => {
    if (!o.isMesh && !o.isPoints) return;
    meshCount++;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.isShaderMaterial) shaderMats++;
      if (m.isPointsMaterial) pointsMats++;
      if (m.isNodeMaterial) nodeMats++;
    }
  });

  assert.ok(meshCount >= 5, `expected room + wear meshes, got ${meshCount}`);
  assert.equal(shaderMats, 0, 'ZERO ShaderMaterial allowed under gpu.nodes');
  assert.equal(pointsMats, 0, 'ZERO PointsMaterial allowed under gpu.nodes');
  assert.ok(nodeMats >= 3, 'kit surfaces including glossy wet puddle build NodeMaterials under gpu.nodes');

  const puddle = rt.group.getObjectByName('office-puddle');
  assert.ok(puddle, 'puddle mesh built under gpu.nodes');
  assert.equal(puddle.material.isNodeMaterial, true, 'puddle uses kit surface NodeMaterial under WebGPU');
  assert.equal(puddle.material.defines?.WET, 1, 'puddle has WET specular glint enabled');
  assert.equal(puddle.material.transparent, true, 'puddle is translucent');

  assert.ok(hookHits.waterTile >= 1, 'kit.tex.waterTile hook used when provided');
  assert.ok(hookHits.puddle >= 1, 'kit.tex.puddle hook used when provided');
  assert.ok(hookHits.stainAtlas >= 1, 'kit.tex.stainAtlas hook used when provided');
});

test('buildLeakSpot supports custom hitY (e.g. bucket surface) and safely swallows throwing sound callbacks', async (t) => {
  const restoreDoc = stubDocument();
  t.after(restoreDoc);

  const level = generate(11, { count: 0 });
  const baseRoom = level.rooms.find((r) => r.kind === 'plain');
  const def = {
    ...baseRoom,
    id: 0, kind: 'plain', x: 0, z: 0, w: 5, d: 5, W: 5, D: 5, H: 2.6, cx: 2.5, cz: 2.5, y: 0, rot: 0,
    crawl: false, shape: null, pillars: [], wins: [], doors: [],
    panels: [{ x: -1.5, z: -1.5, state: 'on' }],
  };

  const kit = createKit();
  const world = await buildWorld(kit, { ...level, theme: 'yellow', rooms: [def], links: [], windows: [] }, {
    catalogue: catalogueOf(kit),
    barricadesEnabled: false,
    sound: { play: () => { throw new Error('missing cue'); } },
    builders: {
      plain: (c) => {
        c.shell();
        buildLeakSpot(c, 0.2, -0.2, makeRng('bucket-drip'), { hitY: 0.22 });
      },
    },
  });
  t.after(() => { world.dispose(); kit.dispose(); });

  const rt = world.rooms[0];
  const ripple = rt.group.getObjectByName('office-drip-ripple');
  assert.ok(ripple);
  assert.ok(Math.abs(ripple.position.y - 0.224) < 1e-5, 'ripple sits at hitY + 0.004');
  // 200 frames with throwing sound bank must never throw
  for (let i = 0; i < 200; i++) {
    for (const fn of rt.ticks) fn(1 / 30, i / 30, { x: 0.2, z: -0.2, inside: true });
  }
});

