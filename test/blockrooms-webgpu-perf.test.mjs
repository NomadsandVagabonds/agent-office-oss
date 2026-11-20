import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// WebGPU shader bloat, WGSL uniformity, beam-shadow lifecycle, blurLightmap bit-exactness, and lightAt() parity tests.
const pub = new URL('../public/', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  if (s === 'three') return {url:${JSON.stringify(pub + 'vendor/three.module.min.js')},shortCircuit:true};
  if (s.startsWith('/vendor/')) return {url:${JSON.stringify(pub.slice(0, -1))}+s,shortCircuit:true};
  return next(s,c);
}`), import.meta.url);

const THREE = await import('three');
const N = await import('../public/vendor/three.webgpu.min.js');
const { gpu } = await import('../public/world/engine/gpu.js');
const { createKit, lamp, bake, lightAt } = await import('../public/world/backrooms/kit.js');
const { createSheen } = await import('../public/world/backrooms/sheen.js');
const { createBeamShadows } = await import('../public/world/backrooms/beam-shadows.js');
const { FLASHLIGHT_POSES } = await import('../public/world/backrooms/flashlight.js');
const { mapLayout, blurLightmap, gutter } = await import('../public/world/backrooms/shadowmap.js');

function withNodes(fn) {
  const prev = gpu.nodes;
  gpu.nodes = N;
  try { return fn(); } finally { gpu.nodes = prev; }
}

function withMockDom(fn) {
  const prevDoc = globalThis.document;
  globalThis.document = { createElementNS: () => ({ style: {}, getContext: () => null }) };
  try { return fn(); } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }
}

/** Track brace depth & enclosing `if (...)` conditions for every line inside WGSL `fn main`. */
function analyzeMainControlFlow(wgsl) {
  const mainStart = wgsl.indexOf('fn main');
  assert.ok(mainStart >= 0, 'WGSL contains fn main');
  const mainSrc = wgsl.slice(mainStart);
  const lines = mainSrc.split('\n');
  const stack = [];
  const entries = [];
  let braceDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const closes = (line.match(/\}/g) || []).length;
    const opens = (line.match(/\{/g) || []).length;
    // Update stack before recording closing brace lines
    if (trimmed.startsWith('}')) {
      for (let c = 0; c < closes; c++) {
        braceDepth--;
        while (stack.length && stack[stack.length - 1].depth > braceDepth) stack.pop();
      }
      if (/^}\s*else\s*\{/.test(trimmed)) {
        braceDepth += opens;
        stack.push({ depth: braceDepth, cond: 'else' });
      }
      continue;
    }
    entries.push({ lineNo: i, line, trimmed, depth: braceDepth, ifs: stack.map((s) => s.cond) });
    if (opens > 0) {
      const m = trimmed.match(/^if\s*\((.*)\)\s*\{$/);
      braceDepth += opens;
      if (m) stack.push({ depth: braceDepth, cond: m[1].trim() });
    }
    if (closes > 0) {
      braceDepth -= closes;
      while (stack.length && stack[stack.length - 1].depth > braceDepth) stack.pop();
    }
  }
  return { mainSrc, entries };
}

test('WebGPU full-featured surfaceNode (sheen + 4-bank lightmap + doors + wet + beam-shadows): compact WGSL, <= 6 lightmap fetches, and WGSL-uniform derivatives & PCF compare', () => {
  withMockDom(() => withNodes(() => {
    const kit = createKit();
    const rt = {
      lights: [{ x: 0, y: 2.7, z: 0, r: 1, g: 0.96, b: 0.88, lobe: true, ay: -1, k: 0.14, far2: 64 }],
      lighting: null,
      u: { flick: { value: 1 }, dim: { value: 1 }, banks: { value: [1, 1] }, moreBanks: { value: [1, 1] } },
    };
    const sheen = createSheen(rt);
    const spec = sheen.material(0.75);
    const mkLm = (v) => {
      const t = new THREE.DataTexture(new Uint8Array([v, v, v, v]), 1, 1);
      t.magFilter = t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      return t;
    };
    const lm = {
      materials: [],
      uniforms: {
        uLm: { value: Array.from({ length: 6 }, () => new THREE.Vector4(1, 1, 0, 0)) },
        uLmA: { value: mkLm(255) },
        uLmB: { value: mkLm(255) },
        uLmC: { value: mkLm(0) },
        uDoorL: { value: Array.from({ length: 4 }, () => new THREE.Vector3()) },
      },
      shadows: true,
      doors: true,
    };

    const mat = kit.surface({ map: new THREE.Texture(), room: rt.u, sheen: spec, lm, banks: 4, flick: true, wet: 0.5 });
    mat.defines.BEAM_SHADOWS = 1;
    mat.uniforms.uBeamShadowMap = { value: null };
    mat.uniforms.uBeamShadowMatrix = { value: new THREE.Matrix4() };
    mat.uniforms.uBeamShadowK = { value: new THREE.Vector2(1 / 1024, 1) };
    mat.rebuildNode();

    const mesh = new N.Mesh(new N.BoxGeometry(1, 1, 1), mat);
    const r = new N.WebGPURenderer();
    r.backend.renderer = r;
    const b = r.backend.createNodeBuilder(mesh, r);
    b.camera = new N.PerspectiveCamera();
    b.scene = new N.Scene();
    b.build();

    const frag = b.fragmentShader;
    // 1. WGSL size < 45 KB (was > 219 KB / 292 KB!)
    assert.ok(frag.length < 45 * 1024, `expected WGSL < 45 KB, got ${frag.length} bytes`);

    // 2. Non-shadow texture fetches <= 6 (was 41!)
    const sampleCount = (frag.match(/textureSample\(/g) || []).length;
    const sampleLevelCount = (frag.match(/textureSampleLevel\(/g) || []).length;
    const compareCount = (frag.match(/textureSampleCompare\(/g) || []).length;
    assert.ok(sampleCount + sampleLevelCount <= 6, `expected <= 6 textureSample/Level calls, got ${sampleCount} + ${sampleLevelCount}`);
    assert.equal(sampleLevelCount, 3, 'uLmA, uLmB, uLmC each sampled exactly once with level(0)');
    assert.equal(sampleCount, 1, 'albedo map sampled once');
    assert.equal(compareCount, 9, '3x3 PCF kernel emits 9 textureSampleCompare taps');

    // 3. Flat interpolation on vLmRegion
    assert.match(frag, /@interpolate\(\s*flat\s*\)\s+vLmRegion/, 'vLmRegion uses flat interpolation');

    // 4. Analyze control flow inside fn main
    const { entries } = analyzeMainControlFlow(frag);

    // 4a. Every dpdx/dpdy executes at top level (depth === 1, zero enclosing `if` blocks) BEFORE the sheen branch
    const derivLines = entries.filter((e) => /\b(dpdx|dpdy)\s*\(/.test(e.line));
    assert.ok(derivLines.length >= 4, `expected 4 derivative calls (px, py, ux, uy), got ${derivLines.length}`);
    for (const d of derivLines) {
      assert.equal(d.ifs.length, 0, `derivative "${d.trimmed}" must not be inside any if-branch, found inside: ${JSON.stringify(d.ifs)}`);
    }
    const sheenIf = entries.find((e) => /if\s*\(.*dot\(\s*kitNormal/.test(e.trimmed));
    assert.ok(sheenIf, 'found sheen normal-up branch');
    for (const d of derivLines) {
      assert.ok(d.lineNo < sheenIf.lineNo, `derivative at line ${d.lineNo} must precede sheen if-branch at line ${sheenIf.lineNo}`);
    }

    // 4b. Every textureSampleCompare executes strictly inside uniform branches (object.nodeUniform* only),
    // NEVER inside fragment-varying branches like torchPart > 0 or sp.w > 0 && s.z < 1!
    const compareLines = entries.filter((e) => /textureSampleCompare\s*\(/.test(e.line));
    assert.equal(compareLines.length, 9);
    for (const c of compareLines) {
      assert.equal(c.ifs.length, 2, `textureSampleCompare must sit inside 2 uniform guards (uTorch & uK.y), got ${JSON.stringify(c.ifs)}`);
      for (const cond of c.ifs) {
        assert.match(cond, /^(\(\s*)?object\.nodeUniform/, `enclosing if condition must be uniform, got: ${cond}`);
        assert.ok(!cond.includes('nodeVar'), `enclosing if condition must not depend on fragment-varying nodeVar: ${cond}`);
      }
    }

    kit.dispose();
  }));
});

test('beam-shadows.js: skips invisible scenes, shrinks WebGPU color target to RedFormat/UnsignedByteType, warms cutout depthFor, and cleans up depths on cutout texture dispose', () => {
  withNodes(() => {
    let target = null;
    const draws = [];
    const renderer = {
      isWebGPURenderer: true,
      coordinateSystem: N.WebGPUCoordinateSystem,
      autoClear: true,
      info: { autoReset: true, render: { calls: 0, triangles: 0 } },
      getRenderTarget: () => target,
      setRenderTarget: (t) => { target = t; },
      getMRT: () => null,
      setMRT() {},
      clear() {},
      render(scene) {
        const mats = [];
        scene.traverseVisible((o) => { if (o.isMesh) mats.push({ o, material: o.material }); });
        draws.push({ scene, target, mats });
      },
    };

    const kit = createKit();
    const visibleScene = new THREE.Scene();
    const hiddenScene = new THREE.Scene();
    hiddenScene.visible = false;

    const cutTex = new THREE.Texture();
    const grate = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ map: cutTex, cutout: true }));
    visibleScene.add(grate);
    const hiddenWall = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ vox: true }));
    hiddenScene.add(hiddenWall);

    const camera = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170);
    kit.shared.uTorch.value = 1.5;
    kit.shared.uTorchOrigin.value.fromArray(FLASHLIGHT_POSES.hand.origin);
    kit.shared.uTorchDirection.value.fromArray(FLASHLIGHT_POSES.hand.direction);

    const bs = createBeamShadows(renderer);

    // 1. warm() pre-creates target (RedFormat/UnsignedByteType) AND cutout depth material
    bs.warm(1024, visibleScene);
    assert.equal(bs.size, 1024);
    assert.equal(grate.material.defines.BEAM_SHADOWS, 1);

    // 2. draw() skips hiddenScene completely and reuses pre-warmed cutout depth material
    const st = bs.draw(1024, camera, [visibleScene, hiddenScene], kit.shared);
    assert.equal(st.drawn, true);
    assert.equal(st.casters, 1, 'hiddenScene caster skipped');
    assert.equal(st.receivers, 1, 'hiddenScene receiver skipped');
    assert.equal(draws.length, 1, 'only visibleScene rendered');
    assert.equal(draws[0].scene, visibleScene);
    assert.equal(draws[0].target.texture.format, N.RedFormat, 'WebGPU dummy color target uses 1-channel RedFormat');
    assert.equal(draws[0].target.texture.type, N.UnsignedByteType, 'WebGPU dummy color target uses UnsignedByteType');

    const grateDepthMat = draws[0].mats[0].material;
    let disposedCount = 0;
    const origDispose = grateDepthMat.dispose.bind(grateDepthMat);
    grateDepthMat.dispose = () => { disposedCount++; origDispose(); };

    // 3. Disposing the cutout texture disposes and evicts its depth material from `depths`
    cutTex.dispose();
    assert.equal(disposedCount, 1, 'cutout depth material disposed automatically when cutout texture disposes');

    // Drawing again creates a fresh depth material (proving the old key was removed)
    bs.draw(1024, camera, [visibleScene], kit.shared);
    const grateDepthMat2 = draws[1].mats[0].material;
    assert.notEqual(grateDepthMat2, grateDepthMat, 'stale cutout depth material was evicted from cache');

    bs.dispose();
    kit.dispose();
  });
});

test('blurLightmap specialized interior loops match reference [1,2,1]/4 formula bit-for-bit across all channel counts & edge sizes', () => {
  function refBlur(data, layout, ch, passes) {
    const W = layout.width, out = new Uint8Array(data), tmp = new Uint8Array(out.length);
    for (let pass = 0; pass < passes; pass++) {
      for (const r of layout.list) {
        const x0 = r.px, x1 = r.px + r.nu - 1, y0 = r.py, y1 = r.py + r.nv - 1;
        for (let y = y0; y <= y1; y++) {
          const row = y * W;
          for (let x = x0; x <= x1; x++) {
            const xl = x > x0 ? x - 1 : x0, xr = x < x1 ? x + 1 : x1;
            const o = (row + x) * ch, ol = (row + xl) * ch, or = (row + xr) * ch;
            for (let c = 0; c < ch; c++) tmp[o + c] = (out[ol + c] + (out[o + c] << 1) + out[or + c] + 2) >> 2;
          }
        }
        for (let y = y0; y <= y1; y++) {
          const yu = y > y0 ? y - 1 : y0, yd = y < y1 ? y + 1 : y1;
          const row = y * W, rowU = yu * W, rowD = yd * W;
          for (let x = x0; x <= x1; x++) {
            const o = (row + x) * ch, ou = (rowU + x) * ch, od = (rowD + x) * ch;
            for (let c = 0; c < ch; c++) out[o + c] = (tmp[ou + c] + (tmp[o + c] << 1) + tmp[od + c] + 2) >> 2;
          }
        }
      }
    }
    gutter(layout, out, ch);
    return out;
  }

  const layouts = [
    mapLayout({ W: 1.5, D: 1.2, H: 1.0, floor: true, walls: new Set(['back', 'front', 'left', 'right']) }),
    // Degenerate 1x1, 1x2, 2x1, 2x2 regions
    { width: 10, height: 10, list: [
      { px: 1, py: 1, nu: 1, nv: 1 },
      { px: 4, py: 1, nu: 2, nv: 1 },
      { px: 1, py: 4, nu: 1, nv: 2 },
      { px: 4, py: 4, nu: 2, nv: 2 },
    ] },
  ];

  let seed = 0x12345678;
  const randByte = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed >>> 24) & 255; };

  for (const layout of layouts) {
    for (const ch of [1, 2, 3, 4]) {
      const src = new Uint8Array(layout.width * layout.height * ch);
      for (let i = 0; i < src.length; i++) src[i] = randByte();
      for (const passes of [1, 2, 3]) {
        const actual = blurLightmap(src, layout, ch, passes);
        const expected = refBlur(src, layout, ch, passes);
        assert.deepEqual(actual, expected, `bit-exact mismatch for ch=${ch}, passes=${passes}, W=${layout.width}`);
      }
    }
  }
});

test('lightAt() matches bake() within 1e-6 across steady, flickered, banked, lobed, and shadowed lights', () => {
  function refLightAt(lights, amb, x, y, z, nx = 0, ny = 1, nz = 0, runtime = {}) {
    const probe = { verts: 1, pos: [x, y, z], nor: [nx, ny, nz], alb: [1, 1, 1], ao: [1], sf: [0, 0], vox: false };
    const { lit, flk, banks } = bake(probe, lights, amb, runtime.lighting);
    const s = runtime.shade || [];
    return [0, 1, 2].map((c) => lit[c] * (s[0] ?? 1)
      + (flk ? flk[c] * (runtime.flick ?? 1) * (s[1] ?? 1) : 0)
      + (banks ? banks.reduce((sum, bank, b) => sum + bank[c] * (runtime.banks?.[b] ?? 1) * (s[2 + b] ?? 1), 0) : 0));
  }

  const lights = [
    lamp(-4, 2.7, -2, [1.0, 0.92, 0.78], { axis: [0, -1, 0], floor: 0.25, k: 3.2, wrap: 0.3, far: 14, bank: 0 }),
    lamp(4, 2.7, -2, [0.95, 0.90, 0.80], { axis: [0, -1, 0], floor: 0.3, k: 3.5, wrap: 0.25, far: 12, bank: 1 }),
    lamp(-3, 2.7, 3, [0.9, 0.95, 1.0], { axis: [0, -1, 0], floor: 0.2, k: 2.8, wrap: 0.35, far: 14, bank: 2 }),
    lamp(3, 2.5, 3, [2.0, 0.08, 0.04], { k: 2.2, wrap: 0.4, far: 10, bank: 3 }),
    lamp(0, 2.6, 0, [0.8, 0.75, 0.65], { flick: true, axis: [0, -1, 0], floor: 0.25, k: 3.0, far: 12 }),
    lamp(0.5, 1.8, -1, [0.5, 0.55, 0.45], { k: 4.0, wrap: 0.2, far: 15 }),
    // Far-away flickering light below 1e-4 threshold and out-of-range light
    lamp(11.9, 2.6, 0, [0.001, 0.001, 0.001], { flick: true, far: 12 }),
    lamp(50, 2.6, 0, [5, 5, 5], { far: 10 }),
  ];
  const amb = [0.22, 0.20, 0.16];
  const points = [
    [0, 0, 0, 0, 1, 0],
    [-3.5, 1.2, -1.5, 1, 0, 0],
    [3.2, 0.5, 2.8, 0, 0, -1],
    [0, 2.5, 0, 0, -1, 0],
    [4.5, 1.0, -2.5, -0.7071, 0.7071, 0],
  ];
  const runtimes = [
    {},
    { flick: 0 },
    { flick: 0.35, shade: [0.6, 0.8] },
    { lighting: { ambientShare: 0.92, bankCount: 2, ceilingBanks: 2 }, banks: [1, 0.015], flick: 0.7, shade: [0.9, 0.5, 0.7, 0.4] },
    { lighting: { ambientShare: 0.92, bankCount: 4, ceilingBanks: 3 }, banks: [0.8, 0.2, 1.0, 0.9], flick: 0.4, shade: [0.5, 0.6, 0.7, 0.8, 0.9, 0.3] },
    { lighting: { ambientShare: 0, bankCount: 3, ceilingBanks: 2 }, banks: [0.015, 0.015, 1.0], flick: 1.0 },
  ];

  for (const [x, y, z, nx, ny, nz] of points) {
    for (const rt of runtimes) {
      const actual = lightAt(lights, amb, x, y, z, nx, ny, nz, rt);
      const expected = refLightAt(lights, amb, x, y, z, nx, ny, nz, rt);
      for (let c = 0; c < 3; c++) {
        assert.ok(Math.abs(actual[c] - expected[c]) < 1e-6,
          `mismatch ch=${c} at (${x},${y},${z}) rt=${JSON.stringify(rt)}: actual=${actual[c]} vs expected=${expected[c]}`);
      }
    }
  }
});
