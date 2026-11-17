import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { profile } from '../public/world/backrooms/graphics.js';

// A bloom strength per shining batch: `bloom` in the options of kit.glowing and c.shining (0…3, 1 unless given), carried
// as material.userData.bloom next to userData.glow. It scales only what that batch adds to the emissive picture the
// bloom is made from (glow.js's stand-ins), never how the batch itself is drawn; Classic and Low have no glow at all.
const root = new URL('../', import.meta.url), pub = new URL('public/', root).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  if (s === 'three') return {url:${JSON.stringify(pub + 'vendor/three.module.min.js')},shortCircuit:true};
  if (s.startsWith('/vendor/')) return {url:${JSON.stringify(pub.slice(0, -1))}+s,shortCircuit:true};
  if (s.startsWith('/core/')) return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};
  return next(s,c);
}`), import.meta.url);
// (canvas drawing is inert: the world fixture draws textures)
const draw = new Proxy({}, { get: (_, name) => name === 'measureText' ? (t) => ({ width: String(t).length * 6 })
  : /Gradient|Pattern/.test(name) ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
const previousDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => draw, style: {} }) };
test.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });

const THREE = await import('three');
const { createKit } = await import('../public/world/backrooms/kit.js');
const { GlowPass, GLOW_BLOOM, createGlowMaterials, glowRole } = await import('../public/world/backrooms/glow.js');
const { GLOW_STRENGTH, glowStrength } = await import('../public/world/backrooms/glow.rule.js');
const { createVhs } = await import('../public/world/backrooms/vhs.js');
const { buildWorld } = await import('../public/world/backrooms/world.js');
const { generate } = await import('../public/world/backrooms/gen.js');
const B = (f) => readFileSync(new URL(`public/world/backrooms/${f}`, root), 'utf8');

test('the number: 1 unless given, clamped to 0…3; anything that is not a number is 1', () => {
  assert.deepEqual([GLOW_STRENGTH.fallback, GLOW_STRENGTH.min, GLOW_STRENGTH.max], [1, 0, 3]);
  const cases = [[undefined, 1], [null, 1], [NaN, 1], ['2', 1], [true, 1], [{}, 1], [0, 0], [-0.5, 0], [-Infinity, 0], [0.5, 0.5], [1, 1], [2, 2], [3, 3], [3.5, 3], [Infinity, 3]];
  for (const [v, want] of cases) assert.equal(glowStrength(v), want, String(v));
});

test('kit.glowing carries it per material next to `glow`, and draws the batch exactly as without it', () => {
  const kit = createKit(), tex = new THREE.Texture();
  const plain = kit.glowing(null, 2.5, [1, 0.9, 0.8]), sign = kit.glowing(tex, 1.9);
  assert.equal(plain.userData.bloom, 1, 'default 1'); assert.equal(sign.userData.bloom, 1);
  const cases = [[0, 0], [0.5, 0.5], [2, 2], [3, 3], [7, 3], [-1, 0], ['3', 1]];
  for (const [v, want] of cases) {
    for (const [map, cls] of [[null, 'lamp'], [tex, 'picture']]) {
      const m = kit.glowing(map, 2.5, [1, 0.9, 0.8], { bloom: v }), ref = kit.glowing(map, 2.5, [1, 0.9, 0.8]);
      assert.equal(m.userData.glow, cls); assert.equal(m.userData.bloom, want, `${cls} ${v}`);
      // how it is drawn: every property the scene's draw reads is the one it has without the option
      for (const k of ['transparent', 'alphaTest', 'side', 'depthWrite', 'depthTest', 'blending', 'opacity', 'map', 'fog', 'toneMapped', 'visible', 'colorWrite'])
        assert.equal(m[k], ref[k], k);
      assert.deepEqual(m.color.toArray(), ref.color.toArray(), 'its own colour is not scaled');
      assert.equal(m.onBeforeCompile, ref.onBeforeCompile); assert.equal(m.customProgramCacheKey(), ref.customProgramCacheKey());
      assert.equal(m.defines, ref.defines);
      assert.deepEqual(Object.keys(m.userData).sort(), ['bloom', 'glow'], 'userData only, beside glow');
    }
  }
  // two materials, two numbers: nothing shared
  const a = kit.glowing(tex, 2.4, [1, 1, 1], { bloom: 2 }), b = kit.glowing(tex, 2.4, [1, 1, 1], { bloom: 0.5 });
  assert.notEqual(a, b); assert.deepEqual([a.userData.bloom, b.userData.bloom], [2, 0.5]);
  kit.dispose();
});

test('the kit\'s shader for the scene is untouched: nothing of it in FRAG or VERT, no uniform, no define', () => {
  const src = B('kit.js'), kit = createKit();
  const frag = src.slice(src.indexOf('const FRAG'), src.indexOf('`;', src.indexOf('const FRAG')));
  assert.ok(frag.length > 1000);
  // (its own words for the emissive bloom block, EMISSIVE_BLOOM and "emissive bloom"/"the bloom", are older than this)
  const bare = frag.replace(/EMISSIVE_BLOOM(_DEPTH)?|emissive bloom|the bloom/g, '');
  for (const word of ['bloom', 'Bloom', 'uStrength', 'userData', 'glowStrength', 'GLOW_STRENGTH']) assert.ok(!bare.includes(word), `FRAG has no ${word}`);
  for (const o of [{}, { vox: true }, { map: new THREE.Texture(), cutout: true }]) {
    const s = kit.surface(o);
    assert.ok(!/bloom|uBloom|uStrength/i.test(s.fragmentShader.replace(/EMISSIVE_BLOOM(_DEPTH)?|emissive bloom|the bloom/g, '')), 'no new text in the surface\'s shader');
    assert.ok(!/bloom/i.test(s.vertexShader));
    assert.ok(!Object.keys(s.uniforms).some((k) => /bloom|strength/i.test(k)), 'no new uniform on the room\'s surface');
  }
  // the option reaches only the one line in glowing()'s emissive bloom block
  assert.equal(src.split('glowStrength(').length - 1, 1);
  assert.match(src, /    m\.userData\.bloom = glowStrength\(opt\.bloom\);\n    \/\/ --- end emissive bloom ---\n    return m;/);
  kit.dispose();
});

/** A scene of what shines, each as kit.glowing makes it. */
function scene(kit, opts = {}) {
  const s = new THREE.Scene(), g = new THREE.BufferGeometry(), tex = new THREE.Texture();
  const mk = (map, power, rgb, o) => { const m = new THREE.Mesh(g, kit.glowing(map, power, rgb, o)); s.add(m); return m; };
  const lamp = mk(null, 2.5, [1, 0.95, 0.85], opts.lamp), sign = mk(tex, 1.9, [1, 1, 1], opts.sign), neon = mk(tex, 2.4, [1, 0.4, 0.6], opts.neon);
  const avatar = new THREE.Mesh(g, new THREE.MeshLambertMaterial()); s.add(avatar);
  return { s, lamp, sign, neon, avatar };
}
const snap = (mats, s, exact) => {
  const saved = mats.swap(s, exact);
  const out = { drawn: mats.stats.drawn, list: s.children.map((o) => (o.material.visible === false ? 'skip' : `${o.material.name || o.material.type}:${o.material.color.toArray().map((v) => +v.toFixed(6))}:${o.material.opacity}`)) };
  mats.restore(saved);
  return out;
};

test('no option anywhere: the emitter draw list, stand-ins and colours are what they were (userData.bloom absent = 1)', () => {
  const kit = createKit();
  for (const exact of [true, false]) {
    const now = scene(kit), old = scene(kit), explicit = scene(kit, { lamp: { bloom: 1 }, sign: { bloom: 1 }, neon: { bloom: 1 } });
    for (const o of old.s.children) delete o.material.userData.bloom;          // (a material as kit.glowing made it before)
    const mats = createGlowMaterials();
    const a = snap(mats, now.s, exact), b = snap(mats, old.s, exact), c = snap(mats, explicit.s, exact);
    assert.deepEqual(a, b, `exact ${exact}`); assert.deepEqual(a, c);
    if (!exact) { const saved = mats.swap(now.s, false); assert.equal(now.lamp.material.userData.glow, 'lamp'); assert.equal(now.lamp.material.name, '', 'a lamp, not exact, is still drawn as it is: no stand-in'); mats.restore(saved); }
    assert.equal(a.drawn, exact ? 3 : 4);
    mats.dispose();
  }
  // the pass: no new uniform, the same numbers
  const pass = new GlowPass(new THREE.PerspectiveCamera());
  assert.deepEqual(Object.keys(pass.addMat.uniforms).sort(), ['tEmit', 'tGlow', 'uOver', 'uStrength', 'uTint']);
  assert.deepEqual([pass.addMat.uniforms.uStrength.value, pass.addMat.uniforms.uOver.value], [GLOW_BLOOM.strength, GLOW_BLOOM.over]);
  assert.ok(!/bloom/i.test(pass.addMat.fragmentShader + pass.upMat.fragmentShader + pass.downMat.fragmentShader));
  pass.dispose(); kit.dispose();
});

test('the pre-pass scales each batch by its own number, on top of its class, read each frame', () => {
  const kit = createKit();
  for (const exact of [true, false]) {
    const { s, lamp, sign, neon } = scene(kit, { lamp: { bloom: 2 }, sign: { bloom: 0.5 }, neon: { bloom: 3 } });
    const base = (o) => o.material.color.clone();
    const want = { lamp: base(lamp), sign: base(sign), neon: base(neon) };
    const mats = createGlowMaterials();
    let saved = mats.swap(s, exact);
    assert.equal(lamp.material.name, exact ? 'glow:shineX' : 'glow:shine', 'a lamp scaled gets a stand-in even without the depth');
    assert.deepEqual(lamp.material.color.toArray(), want.lamp.clone().multiplyScalar(2).toArray());
    assert.deepEqual(sign.material.color.toArray(), want.sign.clone().multiplyScalar(0.5).toArray());
    assert.deepEqual(neon.material.color.toArray(), want.neon.clone().multiplyScalar(3).toArray());
    assert.equal(sign.material.opacity, GLOW_BLOOM.pictureAlpha, 'a picture keeps its mark: its glow still goes round it, `over` on top of the scale');
    assert.equal(lamp.material.opacity, 1, 'a lamp stays a lamp');
    mats.restore(saved);
    assert.deepEqual(lamp.material.color.toArray(), want.lamp.toArray(), 'the batch\'s own colour is never changed');
    // set at run time (the dev handle): read on the next frame, clamped the same way
    lamp.material.userData.bloom = 10; sign.material.userData.bloom = 1;
    saved = mats.swap(s, exact);
    assert.deepEqual(lamp.material.color.toArray(), want.lamp.clone().multiplyScalar(3).toArray(), '10 is 3');
    assert.deepEqual(sign.material.color.toArray(), want.sign.toArray());
    mats.restore(saved);
    mats.dispose();
  }
  kit.dispose();
});

test('0: a lamp is left out of the draw list (one draw fewer); a picture is drawn black with its mark, so it stays crisp', () => {
  const kit = createKit();
  const none = scene(kit), zero = scene(kit, { lamp: { bloom: 0 }, sign: { bloom: 0 } });
  const mats = createGlowMaterials();
  const a = snap(mats, none.s, true), b = snap(mats, zero.s, true);
  assert.equal(b.drawn, a.drawn - 1, 'exact: the lamp at 0 is not drawn at all');
  assert.equal(b.list[0], 'skip');
  assert.equal(b.list[1], `glow:pictureX:0,0,0:${GLOW_BLOOM.pictureAlpha}`, 'the sign: black, marked');
  assert.equal(b.list[2], a.list[2], 'the one beside it as it was');
  // without the scene's depth (the fallback) a lamp at 0 still hides what is behind it: black
  const c = snap(mats, zero.s, false);
  assert.equal(c.list[0], 'glow:black:0,0,0:1'); assert.equal(c.drawn, snap(mats, none.s, false).drawn);
  assert.equal(glowRole(zero.lamp.material), 'shine', 'its class is unchanged: only the stand-in knows the number');
  mats.dispose(); kit.dispose();
});

test('Classic and Low: no glow pass exists, so the option is accepted and does nothing', () => {
  const fake = { autoClear: true, shadowMap: { autoUpdate: true }, state: { buffers: { depth: { setMask() {} } } }, getPixelRatio: () => 1, getSize: (v) => v.set(1280, 800),
    getClearAlpha: () => 1, getClearColor: (c) => c, setClearColor() {}, getRenderTarget: () => null, setRenderTarget() {}, clear() {}, getContext: () => ({}), render() {} };
  for (const tier of ['classic', 'low']) {
    assert.equal(profile(tier).glow, 0);
    const vhs = createVhs(fake, new THREE.PerspectiveCamera(), { bloom: true, level: 2, profile: profile(tier) });
    assert.equal(vhs.glow, null, `${tier}: nothing reads userData.bloom`);
    vhs.dispose();
  }
  // and the only reader of it is glow.js
  for (const f of ['vhs.js', 'world.js', 'graphics.js', 'index.js']) assert.ok(!B(f).includes('userData.bloom'), f);
  assert.ok(B('glow.js').includes('glowStrength(m.userData'));
});

test('c.shining: two keys that differ only in `bloom` are two batches; a key asked for again keeps its first options', async (t) => {
  const level = generate(7, { count: 0 }), kit = createKit();
  const build = (c) => {
    c.shell();
    const tex = c.kit.tex.white();
    c.shining('neon:soft', tex, 2.4, [1, 0.5, 0.7], { bloom: 0.5 }).quad([0, 1, 0], [0.2, 1, 0], [0.2, 1.2, 0], [0, 1.2, 0]);
    c.shining('neon:hard', tex, 2.4, [1, 0.5, 0.7], { bloom: 3 }).quad([0, 1.5, 0], [0.2, 1.5, 0], [0.2, 1.7, 0], [0, 1.7, 0]);
    c.shining('neon:soft', tex, 2.4, [1, 0.5, 0.7], { bloom: 2 }).quad([0, 2, 0], [0.2, 2, 0], [0.2, 2.2, 0], [0, 2.2, 0]);   // (the first call's options win)
    c.shining('plain', tex, 2.4, [1, 0.5, 0.7]).quad([0, 2.5, 0], [0.2, 2.5, 0], [0.2, 2.7, 0], [0, 2.7, 0]);
  };
  const world = await buildWorld(kit, level, { catalogue: { has: () => false, entry: () => null, geo: () => null }, builders: { plain: build } });
  t.after(() => { world.dispose(); kit.dispose(); });
  const rt = world.rooms.find((r) => r.def.kind === 'plain');
  const lit = []; rt.group.traverse((o) => { if (o.isMesh && o.material?.userData?.glow && o.material.color.g < 1.3 && o.material.color.r > 2.3) lit.push(o); });
  const byBloom = lit.map((o) => [o.material.userData.bloom, o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3]).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(byBloom, [[0.5, 4], [1, 2], [3, 2]], 'three meshes: soft (both of its quads, at its first number), plain at 1, hard at 3');
  assert.deepEqual(new Set(lit.map((o) => o.material.color.toArray().join())).size, 1, 'all drawn the same');
});
