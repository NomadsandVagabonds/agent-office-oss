import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { GRAPHICS, profile, cost } from '../public/world/backrooms/graphics.js';

// Bloom from what shines (glow.js, graphics.js `glow`, kit.js's emissive bloom blocks, vhs.js): off in Classic and Low,
// on at Medium and High. Off, the camcorder's chain is the one it was, nothing of it is made, and a kit surface's shader
// is the one it was; on, it replaces the tier's thresholded bloom, and only what shines by itself feeds it.
const pub = new URL('../public/', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  if (s === 'three') return {url:${JSON.stringify(pub + 'vendor/three.module.min.js')},shortCircuit:true};
  if (s.startsWith('/vendor/')) return {url:${JSON.stringify(pub.slice(0, -1))}+s,shortCircuit:true};
  return next(s,c);
}`), import.meta.url);
const THREE = await import('three');
const { createKit } = await import('../public/world/backrooms/kit.js');
const { GlowPass, GLOW_BLOOM, glowRole, isKitSurface, createGlowMaterials, glowFaces } = await import('../public/world/backrooms/glow.js');
const { GLOW_DEPTH, GLOW_DEPTH_GLSL, glowVisible, glowLinear } = await import('../public/world/backrooms/glow.rule.js');
const { createVhs } = await import('../public/world/backrooms/vhs.js');
const { HELD_ORDER } = await import('../public/world/backrooms/beam-shadows.rule.js');

const B = (f) => readFileSync(new URL(`../public/world/backrooms/${f}`, import.meta.url), 'utf8');
const BLOCK = / *\/\/ --- emissive bloom ---\n[\s\S]*?\/\/ --- end emissive bloom ---\n/g;
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };

test('the switch: 0 in Classic and Low, 1 at Medium and High (and Auto, which starts at Medium)', () => {
  assert.deepEqual(GRAPHICS.map((t) => profile(t).glow), [0, 0, 1, 1, 1]);
  assert.equal(profile('classic').bloom, 'host', 'Classic keeps the host\'s bloom');
  assert.equal(profile('low').bloom, false, 'Low keeps no bloom');
  // its cost is counted, and the tiers still only go up in cost
  const hi = profile('high');
  assert.ok(cost(hi) > cost({ ...hi, glow: 0 }));
  assert.ok(cost(profile('low')) <= cost(profile('medium')) && cost(profile('medium')) <= cost(hi));
});

test('the kit\'s shader: off, it is the shader it was; the blocks are delimited and the shader\'s only compiles with EMISSIVE_BLOOM', () => {
  const src = B('kit.js');
  // three blocks: the fragment shader's declarations (glow.rule.js) and its part of main(), and the line in glowing()
  // that marks what shines
  assert.equal(src.split('// --- emissive bloom ---').length - 1, 3);
  assert.equal(src.split('// --- end emissive bloom ---').length - 1, 3);
  assert.match(src, /\/\/ --- end tube shadows ---\n\/\/ --- emissive bloom ---\n\$\{GLOW_DEPTH_GLSL\}\n\/\/ --- end emissive bloom ---\n\$\{FLASHLIGHT_GLSL\}\n/);
  assert.ok(GLOW_DEPTH_GLSL.trim().startsWith('#if defined(EMISSIVE_BLOOM) && defined(EMISSIVE_BLOOM_DEPTH)') && GLOW_DEPTH_GLSL.trim().endsWith('#endif'));
  assert.match(src, /    \/\/ --- emissive bloom ---\n(    \/\/[^\n]*\n)+    m\.userData\.glow = !map \|\| map === textures\.get\('white'\) \|\| map === textures\.get\('pntrue'\) \? 'lamp' : 'picture';\n(    \/\/[^\n]*\n)*    m\.userData\.bloom = glowStrength\(opt\.bloom\);\n    \/\/ --- end emissive bloom ---\n    return m;/);
  assert.match(src, /  #endif\n  \/\/ --- emissive bloom ---\n  #ifdef EMISSIVE_BLOOM\n[\s\S]*?  return;\n  #endif\n  \/\/ --- end emissive bloom ---\n  gl_FragColor = vec4\(c, uAlpha\);\n\}`;/,
    'the last thing before the surface\'s own colour is written, and all of it inside #ifdef EMISSIVE_BLOOM');

  const kit = createKit();
  const configs = [{}, { vox: true }, { map: new THREE.Texture(), cutout: true, wet: 1, flick: true, banks: 4 }, { vox: true, lm: { shadows: true, doors: true, uniforms: {}, materials: [] } }];
  for (const o of configs) {
    const mat = kit.surface(o);
    assert.equal(mat.defines.EMISSIVE_BLOOM, undefined, 'a surface is made without it');
    const blocks = mat.fragmentShader.match(BLOCK);
    assert.equal(blocks.length, 2);
    for (const block of blocks) {
      const body = block.split('\n').slice(1, -2).join('\n').trim();
      assert.ok((body.startsWith('#ifdef EMISSIVE_BLOOM') || body.startsWith('#if defined(EMISSIVE_BLOOM)')) && body.endsWith('#endif'), body.slice(0, 40));
    }
    const before = mat.fragmentShader.replace(BLOCK, '');
    assert.ok(!before.includes('EMISSIVE') && !before.includes('emitted'));
    assert.ok(!mat.vertexShader.includes('EMISSIVE'), 'the vertex shader is not touched');
  }
  // recorded from the kit before there was a glow (its fragment and vertex shaders, the same text for every surface:
  // defines are not in the text). Re-record only when the kit's own shader is changed on purpose.
  const plain = kit.surface();
  assert.deepEqual([plain.fragmentShader.replace(BLOCK, '').length, fnv(plain.fragmentShader.replace(BLOCK, '')), fnv(plain.vertexShader)], [7085, '40539f73', '8e6aa71b']);
  // co-op's own patch (coop/lights.js) still finds both lines it hooks onto, once each
  assert.equal(plain.fragmentShader.split('uniform float uTorch;').length - 1, 1);
  assert.equal(plain.fragmentShader.split('  #ifdef VOXEL\n  c += torch').length - 1, 1);
  kit.dispose();
});

test('what emits: self-lit voxels as they show, a mapped one by its picture; the beams, the room\'s light and the wet glint never', () => {
  const block = B('kit.js').match(BLOCK).find((b) => b.includes('emitted'));
  const code = block.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.match(code, /vec3 emitted = vec3\(0\.0\);\n  float plainly = 1\.0;\n  #ifdef VOXEL\n  emitted = vLit \* step\(0\.5, vSurf\.y\);\n  plainly = 1\.0 - step\(0\.5, vSurf\.y\);\n  #endif\n  #ifdef MAPPED\n  emitted \*= t\.rgb;\n  #endif\n  #ifdef EMISSIVE_BLOOM_DEPTH\n  if \(plainly > 0\.5 \|\| glowHidden\(\)\) discard;\n  #endif\n  gl_FragColor = vec4\(emitted, plainly\);\n  return;/,
    'a self-lit voxel writes what it shows, and alpha 0: what a screen shows is left crisp under its glow');
  for (const name of ['torch', 'beam', 'uTorch', 'uCameraLamp', 'c +', 'c *', 'glint', 'uWet', 'lightmapped', 'coop'])
    assert.ok(!code.includes(name), `the emissive part reads nothing of ${name}`);
  // the same threshold the bake uses for a voxel that lights itself (its light is its colour × GLOW)
  assert.match(B('kit.js'), /if \(batch\.vox && sf\[i \* 2 \+ 1\] > 0\.5\) \{ lit\[j\] = ar \* GLOW;/);
  // and the name it declares is not one co-op's patch declares in the same main()
  for (const n of ['coopRay', 'coopReach', 'coopBeam']) assert.ok(!code.includes(n));
  // the glow over what shines: in full over a lamp, a small share over a picture or a self-lit voxel (alpha under a half)
  assert.ok(GLOW_BLOOM.over > 0 && GLOW_BLOOM.over <= 0.25 && GLOW_BLOOM.pictureAlpha < 0.35);
});

test('who is what: shining batches as they are, kit surfaces by their twin, everything else black or left out', () => {
  const kit = createKit();
  const lamp = kit.glowing(null, 2.5, [1, 1, 0.9]), sign = kit.glowing(new THREE.Texture(), 1.9);
  assert.equal(lamp.userData.glow, 'lamp', 'kit.glowing marks what shines: a plain light');
  assert.equal(sign.userData.glow, 'picture', 'and something with a picture on it (the white and lit-panel textures are lamps: kit.tex)');
  assert.equal(glowRole(lamp), 'shine');
  assert.equal(glowRole(sign), 'picture');
  assert.equal(glowRole(kit.glowing(new THREE.Texture(), 1.4, [1, 1, 1], { transparent: true, depthWrite: false })), 'skip',
    'a painted pool of light or a lamp\'s halo (all-hands\' microphone ring, rooms.js lampglow) is light, not a source');
  assert.equal(glowRole(kit.glowing(null, 1.5, [1, 1, 1], { transparent: true })), 'shine', 'see-through but writing depth: drawn as it is');
  assert.equal(glowRole(kit.surface({ vox: true })), 'kit');
  assert.equal(glowRole(kit.surface({ map: new THREE.Texture() })), 'kit', 'a dead panel is a kit surface: its twin writes black');
  assert.equal(glowRole(kit.surface({ vox: true, alpha: 0.42 })), 'skip', 'glass hides nothing');
  assert.equal(glowRole(new THREE.MeshLambertMaterial()), 'black', 'an avatar');
  assert.equal(glowRole(new THREE.MeshBasicMaterial({ color: 0xffffff })), 'black', 'unlit is not shining');
  assert.equal(glowRole(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })), 'skip', 'a blot');
  assert.equal(glowRole(new THREE.MeshBasicMaterial({ colorWrite: false })), 'keep', 'depth only');
  assert.equal(glowRole(new THREE.MeshBasicMaterial({ visible: false })), 'skip');
  assert.equal(glowRole(new THREE.ShaderMaterial({ fragmentShader: 'void main(){}' })), 'black', 'a shader that is not the kit\'s');
  assert.equal(isKitSurface(new THREE.ShaderMaterial({ fragmentShader: 'void main(){}', uniforms: { uTorchOrigin: { value: 0 } } })), false);
  kit.dispose();
});

test('the swap: twins share the room\'s uniforms, nothing of the level\'s materials changes, and all of it is put back', () => {
  const kit = createKit(), scene = new THREE.Scene(), g = new THREE.BufferGeometry();
  const wall = new THREE.Mesh(g, kit.surface({ vox: true, flick: true }));
  wall.material.defines.BEAM_SHADOWS = 1;                      // (as beam-shadows.js leaves it at High)
  const panel = new THREE.Mesh(g, kit.glowing(null, 2.5));
  const sign = new THREE.Mesh(g, kit.glowing(new THREE.Texture(), 1.9, [0.2, 1, 0.5]));
  const cut = new THREE.Mesh(g, kit.surface({ map: new THREE.Texture(), cutout: true }));
  const avatar = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const card = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: new THREE.Texture(), alphaTest: 0.4, side: THREE.DoubleSide }));
  const glass = new THREE.Mesh(g, kit.surface({ vox: true, alpha: 0.42 }));
  const held = new THREE.Mesh(g, kit.surface({})); held.material.transparent = true; held.renderOrder = HELD_ORDER;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial()), dust = new THREE.Points(g, new THREE.PointsMaterial());
  const multi = new THREE.Mesh(g, [kit.glowing(new THREE.Texture(), 1.5), new THREE.MeshLambertMaterial()]);
  const hidden = new THREE.Mesh(g, new THREE.MeshLambertMaterial()); hidden.visible = false;
  scene.add(wall, panel, sign, cut, avatar, card, glass, held, sprite, dust, multi, hidden);
  const was = new Map(scene.children.map((o) => [o, o.material]));
  const versions = [wall, cut, held].map((o) => [o.material.version, JSON.stringify(o.material.defines), o.material.fragmentShader]);

  const mats = createGlowMaterials(), saved = mats.swap(scene);
  const tw = wall.material;
  assert.ok(tw.isShaderMaterial && tw !== was.get(wall));
  assert.equal(tw.defines.EMISSIVE_BLOOM, 1); assert.equal(tw.defines.VOXEL, 1); assert.equal(tw.defines.FLICK, 1);
  assert.equal(tw.defines.BEAM_SHADOWS, undefined, 'the beam has nothing to do with the emissive picture');
  assert.equal(tw.uniforms, was.get(wall).uniforms, 'the same uniforms: the room\'s dimmer and flicker move it');
  assert.equal(tw.fragmentShader, was.get(wall).fragmentShader);
  assert.equal(panel.material, was.get(panel), 'a lamp is drawn as it is');
  const sp = sign.material;
  assert.ok(sp !== was.get(sign) && sp.isMeshBasicMaterial && sp.map === was.get(sign).map, 'a sign: itself, marked');
  assert.equal(sp.blending, THREE.NoBlending); assert.equal(sp.opacity, GLOW_BLOOM.pictureAlpha); assert.ok(sp.transparent && sp.depthWrite);
  assert.deepEqual(sp.color.toArray(), was.get(sign).color.toArray(), 'at its colour this frame');
  assert.equal(tw.blending, THREE.NoBlending, 'a twin\'s alpha is a mark, written as it is');
  assert.equal(cut.material.defines.CUTOUT, 1, 'a cut-out is cut out the same way');
  assert.ok(avatar.material.isMeshBasicMaterial && avatar.material.color.getHex() === 0 && avatar.material.fog === false, 'black, unfogged');
  assert.equal(card.material.map, was.get(card).map); assert.equal(card.material.alphaTest, 0.4); assert.equal(card.material.side, THREE.DoubleSide);
  assert.equal(glass.material.visible, false, 'glass is left out');
  assert.equal(held.material.defines.EMISSIVE_BLOOM, 1); assert.equal(held.material.transparent, true, 'held things stay in the queue drawn last, over the room');
  assert.equal(sprite.visible, false); assert.equal(dust.visible, false);
  assert.equal(multi.material[0].name, 'glow:picture'); assert.equal(multi.material[1].color.getHex(), 0);
  assert.equal(hidden.material, was.get(hidden), 'what is not drawn is not touched');
  // made once each: a second frame makes nothing new
  const t0 = mats.twins, b0 = mats.blacks, p0 = mats.pictures;
  assert.equal(p0, 2);
  was.get(sign).color.setRGB(0.1, 0.1, 0.1);                   // (a sign that dims: the stand-in follows it)
  mats.restore(saved); mats.swap(scene); assert.equal(wall.material, tw); assert.equal(sign.material, sp); assert.equal(sp.color.r, 0.1);
  assert.equal(mats.twins, t0); assert.equal(mats.blacks, b0); assert.equal(mats.pictures, p0);
  mats.restore();

  for (const o of scene.children) assert.equal(o.material, was.get(o));
  assert.equal(sprite.visible && dust.visible, true); assert.equal(hidden.visible, false);
  assert.deepEqual([wall, cut, held].map((o) => [o.material.version, JSON.stringify(o.material.defines), o.material.fragmentShader]), versions,
    'the level\'s own materials were never changed');
  // a twin goes with its surface
  let gone = 0; tw.addEventListener('dispose', () => gone++);
  was.get(wall).dispose(); assert.equal(gone, 1); assert.equal(mats.twins, t0 - 1);
  let signGone = 0; sp.addEventListener('dispose', () => signGone++);
  was.get(sign).dispose(); assert.equal(signGone, 1); assert.equal(mats.pictures, p0 - 1);
  mats.dispose(); assert.equal(mats.twins, 0); assert.equal(mats.blacks, 0); assert.equal(mats.pictures, 0);
  kit.dispose();
});

// a renderer that draws nothing: enough for the composer to be put together and for the passes to say what they would draw
function fakeRenderer(log = []) {
  const clear = new THREE.Color(0x123456);
  return {
    log, autoClear: true, shadowMap: { autoUpdate: true }, state: { buffers: { depth: { setMask() {} } } },
    getPixelRatio: () => 1, getSize: (v) => v.set(1280, 800), getClearAlpha: () => 0.5, getClearColor: (c) => c.copy(clear), setClearColor() {},
    getRenderTarget: () => null, setRenderTarget(t) { this.target = t; }, clear() {}, getContext: () => ({}),
    render(scene, camera) { log.push({ scene, target: this.target, materials: scene.isScene ? scene.children.map((o) => o.material) : null }); },
  };
}

test('vhs.js: at 0 the chain is the one it was and nothing is made; at 1 it replaces the tier\'s bloom; back to 0 undoes it', () => {
  const r = fakeRenderer(), cam = new THREE.PerspectiveCamera();
  const vhs = createVhs(r, cam, { bloom: true, level: 2, profile: profile('classic') });
  const chain = vhs.passes;
  assert.equal(chain.length, 5); assert.equal(vhs.glow, null);
  assert.equal(vhs.bloom.enabled, true, 'Classic: the host\'s bloom, bit for bit');
  assert.ok(!chain.some((p) => p instanceof GlowPass));
  vhs.setProfile(profile('low'));
  assert.equal(vhs.glow, null); assert.equal(vhs.bloom.enabled, false); assert.deepEqual(vhs.passes, chain);

  vhs.setProfile(profile('high'));
  const glow = vhs.glow;
  assert.ok(glow instanceof GlowPass);
  assert.equal(vhs.bloom.enabled, false, 'in place of the tier\'s bloom');
  assert.deepEqual(vhs.passes, [...chain.slice(0, 3), glow, ...chain.slice(3)], 'where the bloom is: after the scene, before the signal');
  vhs.layout(1280, 800);
  assert.deepEqual(glow.size, [720, 540], 'half the scene\'s size (High draws it at 1440 × 1080 under a 720 × 540 tape)');
  assert.deepEqual([glow.down[0].width, glow.down[5].width, glow.up.length], [360, 12, 5]);
  vhs.setProfile(profile('medium'));
  assert.equal(vhs.glow, glow, 'one pass while it stays on'); vhs.layout(1280, 800);
  assert.deepEqual(glow.size, [540, 405]);

  // drawn: the scene once, with the stand-ins on, then put back. Medium and High have the scene's depth (for the haze),
  // so only what shines is drawn: a wall with no self-lit voxel is not drawn at all, a lamp with the depth test
  const scene = new THREE.Scene(), kit = createKit();
  const wall = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ vox: true })), panel = new THREE.Mesh(new THREE.BufferGeometry(), kit.glowing(null, 2.5));
  scene.add(wall, panel); scene.background = new THREE.Color(0);
  vhs.setScene(scene); assert.equal(glow.scene, scene);
  const read = new THREE.WebGLRenderTarget(4, 4);
  glow.render(r, null, read);
  const draws = r.log.filter((e) => e.scene === scene);
  assert.equal(draws.length, 1); assert.equal(draws[0].target, glow.emissive);
  assert.equal(glow.stats.exact, true, 'the scene\'s depth was there: the supersampled scene\'s, as the haze reads it');
  assert.equal(glow.materials.depthUniforms.tGlowDepth.value?.isDepthTexture, true);
  assert.equal(draws[0].materials[0].visible, false, 'a kit mesh with nothing that lights itself is not drawn');
  assert.equal(draws[0].materials[1].name, 'glow:shineX'); assert.equal(draws[0].materials[1].defines.EMISSIVE_BLOOM_DEPTH, 1);
  assert.equal(glow.stats.meshes, 1, 'one thing drawn');
  assert.equal(r.log.at(-1).target, read, 'added over the picture it was given');
  assert.equal(wall.material.defines.EMISSIVE_BLOOM, undefined); assert.ok(scene.background, 'the scene is as it was');
  assert.equal(r.autoClear, true); assert.equal(r.shadowMap.autoUpdate, true);
  assert.equal(glow.addMat.blending, THREE.AdditiveBlending);
  assert.deepEqual([glow.addMat.uniforms.uStrength.value, glow.addMat.uniforms.uTint.value.toArray()], [GLOW_BLOOM.strength, [...GLOW_BLOOM.tint]]);
  assert.equal(glow.upMat.uniforms.uBase.value, GLOW_BLOOM.mix[0], 'the last step up (the first level) adds the shining thing itself back at mix[0]');
  assert.ok(GLOW_BLOOM.mix[0] < 1, 'less than whole: a sign\'s letters stay readable');
  // over a picture (alpha under a half in the emissive picture) only `over` of the glow; over a lamp or nothing, all of it
  assert.equal(glow.addMat.uniforms.tEmit.value, glow.emissive.texture); assert.equal(glow.addMat.uniforms.uOver.value, GLOW_BLOOM.over);
  assert.match(glow.addMat.fragmentShader, /float on = 1\.0 - smoothstep\(0\.35, 0\.65, texture2D\(tEmit, vUv\)\.a\);/);
  assert.match(glow.addMat.fragmentShader, /\* mix\(1\.0, uOver, on\)/);
  assert.ok(GLOW_BLOOM.pictureAlpha < 0.35, 'a picture\'s mark reads as a picture');

  // back to Classic: the pass is out of the chain and everything it made is let go
  const disposed = new Set();
  for (const t of [glow.emissive, ...glow.down, ...glow.up]) t.addEventListener('dispose', () => disposed.add(t));
  let standInGone = 0; draws[0].materials[1].addEventListener('dispose', () => standInGone++);
  vhs.setProfile(profile('classic'));
  assert.equal(vhs.glow, null); assert.deepEqual(vhs.passes, chain); assert.equal(vhs.bloom.enabled, true);
  assert.equal(disposed.size, 1 + glow.down.length + glow.up.length);
  assert.equal(standInGone, 1, 'and the stand-ins it made');
  // and the auto stepper's way: medium → low → medium
  vhs.setProfile(profile('auto')); assert.ok(vhs.glow); vhs.setProfile(profile('low')); assert.equal(vhs.glow, null); assert.deepEqual(vhs.passes, chain);
  vhs.dispose(); kit.dispose();
});

test('the pass leaves the scene and the renderer as it found them, even when the draw throws', () => {
  const kit = createKit(), scene = new THREE.Scene(), g = new THREE.BufferGeometry();
  const wall = new THREE.Mesh(g, kit.surface({ vox: true })), sign = new THREE.Mesh(g, kit.glowing(new THREE.Texture(), 1.9)), dust = new THREE.Points(g, new THREE.PointsMaterial());
  scene.add(wall, sign, dust); scene.background = new THREE.Color(0x101010);
  const before = [wall.material, sign.material], other = new THREE.WebGLRenderTarget(2, 2);
  const r = fakeRenderer(); r.current = other; r.getRenderTarget = function () { return this.current; }; r.setRenderTarget = function (t) { this.current = t; };
  let cleared = null; r.setClearColor = function (c, a) { cleared = [new THREE.Color(c).getHex(), a]; };
  r.render = function (s) { if (s === scene) throw new Error('lost the context'); };
  const glow = new GlowPass(new THREE.PerspectiveCamera(), scene); glow.resize(64, 48);
  assert.throws(() => glow.render(r, null, new THREE.WebGLRenderTarget(4, 4)), /lost the context/);
  assert.deepEqual([wall.material, sign.material], before, 'every material back');
  assert.equal(dust.visible, true, 'what was hidden for the draw is shown again');
  assert.equal(scene.background.getHex(), 0x101010); assert.equal(scene.overrideMaterial, null);
  assert.equal(r.autoClear, true); assert.equal(r.shadowMap.autoUpdate, true); assert.equal(r.current, other, 'the render target it found');
  assert.deepEqual(cleared, [0x123456, 0.5], 'and the clear colour');
  assert.equal(glow.stats.drawn, false);
  // and a room drawing the scene itself between two frames (the-sets.js's camera) sees the level's own materials
  r.render = function () {}; glow.render(r, null, new THREE.WebGLRenderTarget(4, 4));
  assert.deepEqual([wall.material, sign.material], before); assert.equal(r.current, other);
  glow.dispose(); kit.dispose();
});

test('vhs.js: the switch is read from the profile and nothing else changes at 0', () => {
  const src = B('vhs.js');
  assert.match(src, /if \(p\.glow > 0 && !glow\) \{ glow = new GlowPass\(camera, renderPass\.scene, undefined, sceneDepth\); composer\.insertPass\(glow, composer\.passes\.indexOf\(bloom\) \+ 1\); \}/);
  assert.match(src, /const sceneDepth = \(read\) => \(superPass\.enabled \? superPass\.target\.depthTexture : read\.depthTexture\) \|\| null;/,
    'the depth the haze reads, and nothing where there is none');
  assert.match(src, /u\.tDepth\.value = \(superPass\.enabled \? superPass\.target\.depthTexture : read\.depthTexture\) \|\| null;/);
  assert.match(src, /else if \(!\(p\.glow > 0\) && glow\) \{ composer\.removePass\(glow\); glow\.dispose\(\); glow = null; \}/);
  assert.match(src, /bloom\.enabled = bloomOn\(p, hostBloom\) && !glow;/);
  assert.match(src, /composer\.addPass\(renderPass\); composer\.addPass\(superPass\); composer\.addPass\(bloom\); composer\.addPass\(signal\); composer\.addPass\(screen\);/, 'the chain it always had');
});

test('glow.rule.js: a fragment shines unless the scene is nearer by more than a margin that grows with distance', () => {
  assert.equal(glowVisible(3, 3), true, 'a tube against its own depth');
  assert.equal(glowVisible(3.04, 3), true, 'a hair behind (the picture is half size, the scene supersampled)');
  assert.equal(glowVisible(3.5, 3), false, 'a tube half a metre behind a wall');
  assert.equal(glowVisible(8.09, 8), true, 'a ceiling seen at a slant 8 m off does not hide its own tubes');
  assert.equal(glowVisible(1.2, 0.0601), false, 'a held thing (its depth in the nearest sliver, hand.js) hides what is behind it');
  assert.ok(Math.abs(glowLinear(0, 0.06, 170) - 0.06) < 1e-9 && Math.abs(glowLinear(1, 0.06, 170) - 170) < 1e-6);
  for (const v of [GLOW_DEPTH.share, GLOW_DEPTH.metres, GLOW_DEPTH.tap]) assert.ok(GLOW_DEPTH_GLSL.includes(Number(v).toFixed(6)));
  assert.match(GLOW_DEPTH_GLSL, /float d = min\(min\(/, 'the nearest of four reads');
});

test('glowFaces: only the triangles that light themselves, their corners copied; none, none', () => {
  const geo = new THREE.BufferGeometry();
  // two quads (four triangles): the first lit, the second not
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 3, 1, 0, 2, 1, 0], 3));
  geo.setAttribute('aSurf', new THREE.Float32BufferAttribute([0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], 2));
  geo.setAttribute('aLit', new THREE.Float32BufferAttribute(Array.from({ length: 24 }, (_, i) => i), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const cache = new Map(), sub = glowFaces(geo, cache);
  assert.equal(sub.index.count, 6); assert.equal(sub.attributes.position.count, 4);
  assert.deepEqual([...sub.attributes.aLit.array.slice(0, 3)], [0, 1, 2]);
  assert.notEqual(sub.attributes.position, geo.attributes.position, 'its own copy: let go of without touching the room\'s buffers');
  assert.equal(glowFaces(geo, cache), sub, 'once per geometry');
  const dark = geo.clone(); dark.setAttribute('aSurf', new THREE.Float32BufferAttribute(new Array(16).fill(0), 2));
  assert.equal(glowFaces(dark), null); assert.equal(glowFaces(new THREE.BufferGeometry()), null);
});

test('the exact swap: only what shines is drawn, the scene\'s depth to hide it; the rest is not drawn; all put back', () => {
  const kit = createKit(), scene = new THREE.Scene();
  const voxGeo = new THREE.BufferGeometry();
  voxGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 2, 0, 0, 3, 0, 0, 3, 1, 0], 3));
  voxGeo.setAttribute('aSurf', new THREE.Float32BufferAttribute([0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0], 2));
  voxGeo.setIndex([0, 1, 2, 3, 4, 5]);
  const darkGeo = new THREE.BufferGeometry(); darkGeo.setAttribute('aSurf', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2)); darkGeo.setIndex([0, 1, 2]);
  const screen = new THREE.Mesh(voxGeo, kit.surface({ vox: true })), wall = new THREE.Mesh(darkGeo, kit.surface({ vox: true }));
  const lamp = new THREE.Mesh(voxGeo, kit.glowing(null, 2.5)), sign = new THREE.Mesh(voxGeo, kit.glowing(new THREE.Texture(), 1.9));
  const avatar = new THREE.Mesh(voxGeo, new THREE.MeshLambertMaterial()), held = new THREE.Mesh(darkGeo, kit.surface({})); held.renderOrder = HELD_ORDER;
  scene.add(screen, wall, lamp, sign, avatar, held);
  const was = new Map(scene.children.map((o) => [o, [o.material, o.geometry]]));
  const mats = createGlowMaterials(), saved = mats.swap(scene, true);
  assert.equal(screen.geometry.index.count, 3, 'of a kit mesh, only its lit triangles');
  assert.equal(screen.material.defines.EMISSIVE_BLOOM_DEPTH, 1); assert.equal(screen.material.uniforms.tGlowDepth, mats.depthUniforms.tGlowDepth);
  assert.equal(screen.material.uniforms.uDim, was.get(screen)[0].uniforms.uDim, 'the room\'s dimmer, the same object');
  assert.ok(!('tGlowDepth' in was.get(screen)[0].uniforms), 'the surface\'s own uniforms are not touched');
  for (const o of [wall, avatar, held]) assert.equal(o.material.visible, false, 'not drawn: the scene\'s depth does its hiding');
  assert.equal(lamp.material.name, 'glow:shineX'); assert.equal(sign.material.name, 'glow:pictureX'); assert.equal(sign.material.opacity, GLOW_BLOOM.pictureAlpha);
  // the depth test is put in front of everything the material does
  const shader = { uniforms: {}, fragmentShader: 'uniform vec3 diffuse;\nvoid main() {\n\tvec4 diffuseColor = vec4( diffuse, opacity );\n}' };
  lamp.material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.tGlowDepth, mats.depthUniforms.tGlowDepth);
  assert.match(shader.fragmentShader, /bool glowHidden\(\)[\s\S]*void main\(\) \{\n\tif \( glowHidden\(\) \) discard;\n\tvec4 diffuseColor/);
  assert.equal(lamp.material.customProgramCacheKey(), 'glow:depth');
  assert.equal(mats.stats.drawn, 3); assert.equal(mats.stats.faces, 1);
  mats.restore(saved);
  for (const o of scene.children) assert.deepEqual([o.material, o.geometry], was.get(o));
  // not exact (no depth to read): as before, everything that hides drawn black, kit meshes whole
  const full = mats.swap(scene, false);
  assert.equal(screen.geometry, voxGeo); assert.equal(avatar.material.name, 'glow:black'); assert.equal(lamp.material, was.get(lamp)[0]);
  assert.equal(wall.material.defines.EMISSIVE_BLOOM_DEPTH, undefined);
  mats.restore(full);
  mats.dispose(); assert.equal(mats.faces, 0); kit.dispose();
});

test('the pass without the scene\'s depth draws as it always did (the fallback), with it only what shines', () => {
  const kit = createKit(), scene = new THREE.Scene();
  const wall = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ vox: true })), avatar = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial());
  scene.add(wall, avatar);
  const r = fakeRenderer(), read = new THREE.WebGLRenderTarget(4, 4);
  const plain = new GlowPass(new THREE.PerspectiveCamera(), scene); plain.resize(64, 48); plain.render(r, null, read);
  assert.equal(plain.stats.exact, false); assert.equal(plain.stats.meshes, 2, 'everything drawn, black or by its twin');
  let depth = null;
  const tied = new GlowPass(new THREE.PerspectiveCamera(), scene, undefined, () => depth); tied.resize(64, 48);
  tied.render(r, null, read); assert.equal(tied.stats.exact, false, 'a profile with no depth: the fallback, never nothing');
  depth = new THREE.DepthTexture(4, 4); tied.render(r, null, read);
  assert.equal(tied.stats.exact, true); assert.equal(tied.stats.meshes, 0, 'nothing here shines: nothing drawn');
  assert.deepEqual(tied.materials.depthUniforms.uGlowDepth.value.toArray().slice(0, 2), [1 / 32, 1 / 24]);
  plain.dispose(); tied.dispose(); kit.dispose();
});
