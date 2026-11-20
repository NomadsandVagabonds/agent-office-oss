import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';

// Floor sheen (SHEEN: Medium/High, kit-node-sheen.js) on WebGPURenderer, based on ac7ce22.
// Verifies node creation, uniform/define preservation, WGSL-safe uniform control flow for derivatives & lightmap
// samples, lightmap floorShade integration, and zero impact on the default WebGL path.
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
const { createSheen } = await import('../public/world/backrooms/sheen.js');
const { SHEEN } = await import('../public/world/backrooms/sheen.rule.js');
const { sheenNode } = await import('../public/world/backrooms/kit-node-sheen.js');
const { lightmapNode } = await import('../public/world/backrooms/kit-node-light.js');

function withNodes(fn) {
  const prev = gpu.nodes;
  gpu.nodes = N;
  try { return fn(); } finally { gpu.nodes = prev; }
}

test('kit-node-sheen.js never statically imports three.webgpu', () => {
  const src = fs.readFileSync(new URL('../public/world/backrooms/kit-node-sheen.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('three.webgpu'), 'kit-node-sheen.js must read gpu.nodes');
});

test('kit-node-sheen: builds SHEEN node material with room tubes and lightmap floorShade under gpu.nodes', () => {
  const rt = {
    lights: [{ x: 0, y: 2.7, z: 0, r: 1, g: 0.96, b: 0.88, lobe: true, ay: -1, k: 0.14, far2: 64 }],
    lighting: null,
    u: { flick: { value: 1 }, dim: { value: 1 }, banks: { value: [1, 1] }, moreBanks: { value: [0, 0] } },
  };
  const sheen = createSheen(rt);
  assert.ok(sheen);
  const spec = sheen.material(0.75);
  assert.ok(spec?.uniforms?.uSheenK);

  // Default WebGL path untouched
  const kitGL = createKit();
  const matGL = kitGL.surface({ map: new THREE.Texture(), room: rt.u, sheen: spec });
  assert.equal(matGL.isShaderMaterial, true);
  assert.equal(matGL.defines.SHEEN, SHEEN.lamps);
  kitGL.dispose();

  // WebGPU node path
  withNodes(() => {
    const kit = createKit();
    const map = new THREE.Texture();
    const lm = {
      materials: [],
      uniforms: {
        uLm: { value: Array.from({ length: 6 }, () => new THREE.Vector4(1, 1, 0, 0)) },
        uLmA: { value: new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1) },
        uLmB: { value: new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1) },
      },
      shadows: true,
      doors: false,
    };
    const mat = kit.surface({ map, room: rt.u, sheen: spec, lm, banks: 4 });
    assert.equal(mat.isNodeMaterial, true);
    assert.equal(mat.isKitSurface, true);
    assert.equal(mat.defines.SHEEN, SHEEN.lamps);
    assert.equal(mat.defines.LIGHTMAP, 1);
    assert.equal(mat.defines.TUBESHADOW, 1);
    assert.equal(mat.uniforms.uSheenK, spec.uniforms.uSheenK);
    assert.equal(mat.uniforms.uSheenP, sheen.uniforms.uSheenP);

    // Direct helper invocation verifies TSL graph construction with and without lightmap
    const T = N.TSL;
    const lmFn = lightmapNode(mat, mat.defines, {
      banks: 4, aSurf: null, uDim: T.float(1), uTint: T.vec3(1, 1, 1), uFlick: null,
      uBanks: T.vec2(1, 1), uMoreBanks: T.vec2(0, 0), vAlb: T.vec3(1, 1, 1),
    });
    assert.equal(typeof lmFn.floorShade, 'function');
    const fsRes = lmFn.floorShade();
    assert.ok(fsRes.sa && fsRes.sb);

    const fnWithLm = sheenNode(mat, mat.defines, {
      baseUv: T.uv(), mapTex: T.texture(map), mapSample: T.vec4(1, 1, 1, 1), vLit: T.vec3(1, 1, 1), lightmapped: lmFn,
    });
    assert.equal(typeof fnWithLm, 'function');
    const prevStack = T.getCurrentStack?.();
    const s1 = T.stack();
    T.setCurrentStack(s1);
    try {
      assert.ok(fnWithLm(T.vec3(0, 1, 0)).isNode);
    } finally {
      T.setCurrentStack(prevStack || null);
    }

    const fnNoSheen = sheenNode(mat, {}, { baseUv: T.uv(), mapTex: null, mapSample: null, vLit: T.vec3(1, 1, 1), lightmapped: null });
    assert.equal(fnNoSheen, null);

    // Unmapped sheen without lightmap
    const matPlain = kit.surface({ room: rt.u, sheen: spec });
    const fnPlain = sheenNode(matPlain, matPlain.defines, {
      baseUv: T.uv(), mapTex: null, mapSample: null, vLit: T.vec3(1, 1, 1), lightmapped: null,
    });
    const s2 = T.stack();
    T.setCurrentStack(s2);
    try {
      assert.ok(fnPlain(T.vec3(0, 1, 0)).isNode);
    } finally {
      T.setCurrentStack(prevStack || null);
    }

    kit.dispose();
  });
});

test('kit-node: initializes kitNormal unconditionally before beam if-branches in compiled WGSL', () => {
  const prevDoc = globalThis.document;
  globalThis.document = { createElementNS: () => ({ style: {}, getContext: () => null }) };
  try {
    withNodes(() => {
      const kit = createKit();
      const mat = kit.surface({ map: new THREE.Texture(), wet: 0.88 });
      const mesh = new N.Mesh(new N.BoxGeometry(1, 1, 1), mat);
      const r = new N.WebGPURenderer();
      const b = r.backend.createNodeBuilder(mesh, r);
      b.camera = new N.PerspectiveCamera();
      b.scene = new N.Scene();
      b.build();
      const mainBody = b.fragmentShader.slice(b.fragmentShader.indexOf('fn main'));
      const normalInit = mainBody.indexOf('normalViewGeometry = normalize(');
      const kitNormalInit = mainBody.indexOf('kitNormal =');
      const firstIf = mainBody.indexOf('if (');
      assert.ok(normalInit > 0 && kitNormalInit > 0 && firstIf > 0, 'WGSL main contains normal init and beam branch');
      assert.ok(normalInit < firstIf && kitNormalInit < firstIf, 'normalViewGeometry and kitNormal must initialize before any beam if-branch');
      kit.dispose();
    });
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }
});
