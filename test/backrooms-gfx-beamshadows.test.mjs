import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { BEAM_SHADOW, HELD_ORDER, coverDegrees, beamShadowSize, beamFrustum, texelAt, beamShadowBias, edgeFade, drawsBeamShadow,
  castsBeamShadow, receivesBeamShadow, BEAM_SHADOW_GLSL } from '../public/world/backrooms/beam-shadows.rule.js';
import { FLASHLIGHT, FLASHLIGHT_POSES, CAMCORDER_LAMP } from '../public/world/backrooms/flashlight.js';
import { GRAPHICS, profile } from '../public/world/backrooms/graphics.js';

// The flashlight casting shadows (beam-shadows.rule.js / beam-shadows.js, graphics.js `beamShadows`): off in Classic,
// Low and Medium, a 1024² depth picture at High; and with it off the kit's shader compiles to what it was.
const three = new URL('../public/vendor/three.module.min.js', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  return s === 'three' ? {url:${JSON.stringify(three)},shortCircuit:true} : next(s,c);
}`), import.meta.url);
const THREE = await import('three');
const { createKit } = await import('../public/world/backrooms/kit.js');
const { createBeamShadows } = await import('../public/world/backrooms/beam-shadows.js');

const B = (f) => readFileSync(new URL(`../public/world/backrooms/${f}`, import.meta.url), 'utf8');

test('the switch: 0 in Classic, Low and Medium, on at High, a size or nothing', () => {
  assert.deepEqual(GRAPHICS.map((t) => profile(t).beamShadows), [0, 0, 0, 1024, 0]);
  for (const v of [0, 512, 1024, 2048]) assert.equal(beamShadowSize(v), v);
  for (const v of [1, 300, -1, '1024x', null, undefined, NaN, true]) assert.equal(beamShadowSize(v), 0);
  assert.equal(beamShadowSize('512'), 512);
});

test('the frustum is the beam\'s outer cone with a degree to spare, out to its reach, from the pose', () => {
  assert.ok(Math.abs(coverDegrees() - 19) < 1e-9, 'the beam\'s edge is 18°');
  const f = beamFrustum(FLASHLIGHT_POSES.hand, 1024);
  assert.ok(Math.abs(f.fov - 38) < 1e-9); assert.equal(f.aspect, 1);
  assert.equal(f.far, FLASHLIGHT.range); assert.ok(f.near > 0 && f.near < 0.1);
  assert.deepEqual(f.origin, [...FLASHLIGHT_POSES.hand.origin]);
  assert.ok(Math.abs(Math.hypot(...f.direction) - 1) < 1e-12);
  // the emitter is inside the visitor's collision radius; the near plane is a hair past it (a wall pressed against is the receiver, not a caster)
  for (const pose of Object.values(FLASHLIGHT_POSES)) assert.ok(Math.hypot(...pose.origin) < 0.22);
  assert.ok(BEAM_SHADOW.near <= 0.02);
  assert.equal(beamFrustum(FLASHLIGHT_POSES.camera, 1024), null, 'a light at the lens throws nothing that can be seen');
  assert.equal(beamFrustum(FLASHLIGHT_POSES.hand, 0), null);
  assert.ok(beamFrustum(FLASHLIGHT_POSES.mounted, 512));
  assert.ok(CAMCORDER_LAMP.range < 2.5, 'the camcorder lamp, unshadowed, only reaches a couple of metres');
});

test('the pass is only drawn when the flashlight is on and the switch is', () => {
  assert.equal(drawsBeamShadow(1024, FLASHLIGHT_POSES.hand, 1.5), true);
  assert.equal(drawsBeamShadow(1024, FLASHLIGHT_POSES.hand, 0), false, 'switched off, or its battery flat');
  assert.equal(drawsBeamShadow(1024, FLASHLIGHT_POSES.hand, 0.00005), false, 'below the shader\'s own threshold');
  assert.equal(drawsBeamShadow(0, FLASHLIGHT_POSES.hand, 1.5), false);
  assert.equal(drawsBeamShadow(1024, FLASHLIGHT_POSES.camera, 1.5), false);
});

test('texels and bias: a texel and a half out along the normal, more on a grazing wall, capped', () => {
  const t = texelAt(3, 1024);
  assert.ok(Math.abs(t - (2 * 3 * Math.tan(19 * Math.PI / 180)) / 1024) < 1e-12);
  assert.ok(Math.abs(texelAt(3, 512) - 2 * t) < 1e-12);
  assert.ok(Math.abs(beamShadowBias(3, 1, 1024) - 1.5 * t) < 1e-12, 'facing the light: the normal offset alone');
  assert.ok(beamShadowBias(3, 0.5, 1024) > beamShadowBias(3, 0.9, 1024));
  assert.ok(Math.abs(beamShadowBias(3, 0, 1024) - t * (BEAM_SHADOW.normalBias + BEAM_SHADOW.slopeBias * BEAM_SHADOW.slopeCap)) < 1e-12);
  // small enough that a chair's leg (a voxel or two: 2.5–5 cm) still casts across a room
  for (const d of [1, 2, 4, 6]) assert.ok(beamShadowBias(d, 0.5, 1024) < 0.015, `bias at ${d} m: ${beamShadowBias(d, 0.5, 1024)}`);
  assert.ok(beamShadowBias(3, 1, 1024) > 0);
});

test('the border of the picture fades to unshadowed', () => {
  assert.equal(edgeFade(0.5, 0.5), 1);
  for (const [u, v] of [[0, 0.5], [1, 0.5], [0.5, 0], [0.5, 1]]) assert.equal(edgeFade(u, v), 0);
  assert.ok(edgeFade(0.01, 0.5) > 0 && edgeFade(0.01, 0.5) < 1);
  assert.equal(edgeFade(BEAM_SHADOW.edge, 0.5), 1);
  // the beam itself is dark well before the picture's edge: its 18° cone sits inside the 19° picture
  const inner = Math.tan(18 * Math.PI / 180) / Math.tan(19 * Math.PI / 180);
  assert.ok((1 - inner) / 2 > BEAM_SHADOW.edge, 'the fade is outside the beam');
});

test('who casts and who receives', () => {
  const m = (o = {}) => ({ visible: true, colorWrite: true, depthWrite: true, transparent: false, alphaTest: 0, ...o });
  const mesh = (material, o = {}) => ({ isMesh: true, renderOrder: 0, userData: {}, material, ...o });
  assert.equal(castsBeamShadow(mesh(m())), true, 'an opaque thing');
  assert.equal(castsBeamShadow(mesh(m(), { isInstancedMesh: true })), true, 'instanced');
  assert.equal(castsBeamShadow(mesh(m(), { renderOrder: HELD_ORDER })), false, 'held in the hand');
  assert.equal(castsBeamShadow(mesh(m({ transparent: true, depthWrite: false })), false), false, 'a blot or a decal');
  assert.equal(castsBeamShadow(mesh(m({ transparent: true, alphaTest: 0.5 }))), true, 'a cut-out, cut out');
  assert.equal(castsBeamShadow(mesh(m({ transparent: true }))), false, 'see-through');
  assert.equal(castsBeamShadow(mesh(m({ uniforms: { uAlpha: { value: 0.5 } } }))), false, 'a kit surface drawn see-through');
  assert.equal(castsBeamShadow(mesh(m({ colorWrite: false }))), false);
  assert.equal(castsBeamShadow(mesh(m(), { userData: { noBeamShadow: true } })), false);
  assert.equal(castsBeamShadow({ isPoints: true, material: m() }), false);
  assert.equal(castsBeamShadow(mesh([m(), m()])), true);
  assert.equal(castsBeamShadow(mesh([m(), m({ transparent: true })])), false);

  const kit = createKit();
  const wall = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ vox: true }));
  assert.equal(receivesBeamShadow(wall), true, 'every kit surface takes it');
  const held = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ vox: true })); held.renderOrder = HELD_ORDER;
  assert.equal(receivesBeamShadow(held), false, 'never what is in the hand');
  assert.equal(receivesBeamShadow(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())), false);
  assert.equal(castsBeamShadow(new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ alpha: 0.5 }))), false);
  kit.dispose();
});

test('the kit\'s shader: off, it is the shader it was; the block is delimited and only compiled with BEAM_SHADOWS', () => {
  const src = B('kit.js');
  // one block of declarations after the beams', one line where the flashlight's light is added, each between markers
  assert.equal(src.split('// --- beam shadows ---').length - 1, 2);
  assert.equal(src.split('// --- end beam shadows ---').length - 1, 2);
  assert.match(src, /\$\{FLASHLIGHT_GLSL\}\n\/\/ --- beam shadows ---\n\$\{BEAM_SHADOW_GLSL\}\n\/\/ --- end beam shadows ---\nvoid main\(\) \{/);
  assert.match(src, /  if \(uTorch > 0\.0001\) beam \+= uTorch \* flashlightBeam\(vView, normal\);\n  \/\/ --- beam shadows ---\n  #ifdef BEAM_SHADOWS\n  if \(beam > 0\.0\) beam \*= beamShadow\(vView, normal\);\n  #endif\n  \/\/ --- end beam shadows ---\n  if \(uCameraLamp > 0\.0001\) beam \+= uCameraLamp \* camcorderBeam\(vView, normal\);/,
    'only the flashlight\'s share is shadowed; the camcorder lamp is added after');
  assert.ok(BEAM_SHADOW_GLSL.trim().startsWith('#ifdef BEAM_SHADOWS') && BEAM_SHADOW_GLSL.trim().endsWith('#endif'));

  // with the defines a surface has, and no BEAM_SHADOWS, the preprocessed shader is the one before this feature
  const kit = createKit(), mat = kit.surface({ map: new THREE.Texture(), vox: true, cutout: true, wet: 1 });
  assert.equal(mat.defines.BEAM_SHADOWS, undefined, 'a surface is made without it');
  const strip = (s) => s.replace(/\/\/ --- beam shadows ---\n[\s\S]*?\/\/ --- end beam shadows ---\n/g, '');
  const before = strip(mat.fragmentShader);
  assert.ok(!before.includes('beamShadow') && !before.includes('BEAM_SHADOW'));
  // (and what was cut out is all inside #ifdef BEAM_SHADOWS, so the compiler sees nothing else either)
  const blocks = mat.fragmentShader.match(/\/\/ --- beam shadows ---\n([\s\S]*?)\/\/ --- end beam shadows ---\n/g);
  assert.equal(blocks.length, 2);
  for (const b of blocks) { const body = b.split('\n').slice(1, -2).join('\n').trim(); assert.ok(body.startsWith('#ifdef BEAM_SHADOWS') && body.endsWith('#endif'), body.slice(0, 40)); }
  // co-op's own patch (coop/lights.js) still finds both of the lines it hooks onto
  assert.equal(mat.fragmentShader.split('uniform float uTorch;').length - 1, 1);
  assert.equal(mat.fragmentShader.split('  #ifdef VOXEL\n  c += torch').length - 1, 1);
  kit.dispose();
});

test('beam-shadows.js: switched off it makes nothing and touches nothing; on, it patches what it was shown and undoes it', () => {
  let rendered = 0;
  const renderer = { render() { rendered++; }, getRenderTarget: () => null, setRenderTarget() {}, clear() {}, autoClear: true,
    state: { buffers: { depth: { setMask() {} } } }, info: { autoReset: true, render: { calls: 0, triangles: 0 } } };
  const kit = createKit(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const wall = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ vox: true })); scene.add(wall);
  const blot = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); scene.add(blot);
  const held = new THREE.Mesh(new THREE.BufferGeometry(), kit.surface({ vox: false })); held.renderOrder = HELD_ORDER; scene.add(held);
  kit.shared.uTorch.value = 1.5;
  kit.shared.uTorchOrigin.value.fromArray(FLASHLIGHT_POSES.hand.origin); kit.shared.uTorchDirection.value.fromArray(FLASHLIGHT_POSES.hand.direction);
  const bs = createBeamShadows(renderer);
  for (let i = 0; i < 3; i++) bs.draw(0, camera, [scene], kit.shared);
  assert.equal(bs.size, 0); assert.equal(rendered, 0); assert.equal(bs.patched, 0);
  assert.equal(wall.material.defines.BEAM_SHADOWS, undefined);

  const s = bs.draw(1024, camera, [scene], kit.shared);
  assert.equal(s.drawn, true); assert.equal(rendered, 1); assert.equal(bs.size, 1024);
  assert.equal(s.casters, 1, 'the wall casts; the blot and the held thing do not'); assert.equal(s.receivers, 1);
  assert.equal(wall.material.defines.BEAM_SHADOWS, 1); assert.equal(held.material.defines.BEAM_SHADOWS, undefined);
  assert.ok(wall.material.uniforms.uBeamShadowMap.value?.isDepthTexture);
  assert.equal(wall.material.isShaderMaterial, true, 'its own material is back after the pass');
  assert.equal(blot.visible && held.visible, true, 'what was hidden for the pass is shown again');
  assert.equal(wall.material.uniforms.uBeamShadowK.value.y, 1);

  kit.shared.uTorch.value = 0;                              // switched off: no pass, and the shader lets the beam through
  bs.draw(1024, camera, [scene], kit.shared);
  assert.equal(rendered, 1); assert.equal(wall.material.uniforms.uBeamShadowK.value.y, 0);
  kit.shared.uTorch.value = 1.5; kit.shared.uTorchOrigin.value.set(0, 0, 0);   // the eye's own light (no pockets)
  bs.draw(1024, camera, [scene], kit.shared);
  assert.equal(rendered, 1);

  bs.draw(0, camera, [scene], kit.shared);                  // back to Classic at run time
  assert.equal(bs.size, 0); assert.equal(bs.patched, 0); assert.equal(wall.material.defines.BEAM_SHADOWS, undefined);
  bs.dispose(); kit.dispose();
});

test('index.js draws the pass before the picture, from the profile, and graphics.js keeps the switch on its own lines', () => {
  const index = B('index.js');
  assert.match(index, /\/\/ --- beam shadows ---[^\n]*\n[^\n]*gfx\(\)\.beamShadows[^\n]*\n[^\n]*beamShadows\.draw\([^\n]*\n {4}\/\/ --- end beam shadows ---\n {4}vhs\.render\(paused \? 0 : dt\);/);
  assert.match(index, /beamShadows\.dispose\(\)/);
  const g = B('graphics.js');
  assert.match(g, /\nconst BEAM_SHADOWS = \{ classic: 0, low: 0, medium: 0, high: 1024 \};\n/);
  assert.ok(!/classic: \{[^\n]*beamShadows/.test(g), 'the table\'s rows are as they were');
});
