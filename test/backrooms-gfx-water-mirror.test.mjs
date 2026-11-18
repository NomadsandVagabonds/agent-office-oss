import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { GRAPHICS, profile } from '../public/world/backrooms/graphics.js';

// Water, push three: the mirror (liquid.js mirrorPass, liquid.rule.js MIRROR and its pure helpers, vhs.js setLevel). At
// water 2 (High) only: the water level nearest the eye that is in view, faces up and has the eye over it gets the room
// drawn mirrored about its plane, into a picture of its own, sampled in reflection(). At 0 and 1 none of it exists.
const pub = new URL('../public/', import.meta.url).href, root = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  if (s === 'three') return {url:${JSON.stringify(pub + 'vendor/three.module.min.js')},shortCircuit:true};
  if (s.startsWith('/vendor/')) return {url:${JSON.stringify(pub.slice(0, -1))}+s,shortCircuit:true};
  if (s.startsWith('/core/')) return {url:new URL(s.slice(1),${JSON.stringify(root)}).href,shortCircuit:true};
  return next(s,c);
}`), import.meta.url);
const THREE = await import('three');
const { createKit, Batch } = await import('../public/world/backrooms/kit.js');
const { markLiquid, createLiquidView } = await import('../public/world/backrooms/liquid.js');
const { LIQUID_FRAG, LIQUID_UNDER_FRAG, MIRROR, mirrorPlane, reflectMatrix, planeInView, obliqueProjection, mirrorSize, pickMirror, mirrorLeaves, screenCover, mirrorGate, mirrorWeight, mirrorDue } = await import('../public/world/backrooms/liquid.rule.js');
const { createVhs } = await import('../public/world/backrooms/vhs.js');
const { HELD_ORDER } = await import('../public/world/backrooms/beam-shadows.rule.js');

const B = (f) => readFileSync(new URL(`../public/world/backrooms/${f}`, import.meta.url), 'utf8');
const draw = new Proxy({}, { get: (_, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 6 }) : /Gradient/.test(k) ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
const oldDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => draw }) };
test.after(() => { globalThis.document = oldDocument; });

/** A room with one sheet as the waterpark draws it, marked and settled; `at` moves the room, `y` the sheet. */
function pool({ y = -0.05, at = [0, 0, 0], x0 = -2, kit = createKit() } = {}) {
  const group = new THREE.Group(), u = { flick: { value: 1 }, dim: { value: 1 }, banks: { value: [1, 1] }, moreBanks: { value: [0, 0] } };
  group.position.set(...at);
  const rt = { group, u }, after = [], batch = new Batch();
  batch.grid([x0, y, -1.5], [0, 0, 1], [1, 0, 0], [0, 1, 2, 3], [0, 1, 2, 3, 4], (a, b) => [a, b], [0.88, 1, 1]);
  const holder = new THREE.Group(); group.add(holder);
  const c = { rt, kit, after };
  let mesh = null;
  after.push(() => { mesh = new THREE.Mesh(kit.geometry(batch, [], [0.6, 0.6, 0.6]), kit.surface({ map: new THREE.Texture(), room: u, alpha: 0.52, side: THREE.DoubleSide })); mesh.renderOrder = 4; holder.add(mesh); });
  markLiquid(c, holder, { kind: 'water', y });
  for (const fn of after) fn();
  return { kit, group, rec: rt.liquids[0], get mesh() { return mesh; } };
}
function stage(...groups) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  for (const g of groups) { const part = new THREE.Scene(); part.add(g); scene.add(part); }
  const cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170); cam.position.set(0, 1.6, 2.5); cam.lookAt(0, -0.05, 0); cam.updateMatrixWorld();
  scene.updateMatrixWorld(true);
  return { scene, cam };
}
const look = (cam, p, t) => { cam.position.set(...p); cam.lookAt(...t); cam.updateMatrixWorld(); };
function fakeRenderer() {
  const log = [];
  return {
    log, autoClear: true, current: null, shadowMap: { autoUpdate: true }, state: { buffers: { depth: { setMask() {} } } }, clearColor: 0x123456, clearAlpha: 0.5,
    getPixelRatio: () => 1, getSize: (v) => v.set(1280, 800), getClearAlpha() { return this.clearAlpha; }, getClearColor(c) { return c.set(this.clearColor); },
    setClearColor(c, a) { this.clearColor = new THREE.Color(c).getHex(); this.clearAlpha = a; },
    getRenderTarget() { return this.current; }, setRenderTarget(t) { this.current = t; }, clear() {}, getContext: () => ({}),
    render(scene, camera) {
      const drawn = [];
      scene.traverseVisible((o) => { if (o.material && o.layers.test(camera.layers)) drawn.push(o); });
      log.push({ scene, camera, target: this.current, drawn, autoClear: this.autoClear, background: scene.background ?? null });
    },
  };
}
const target = (w = 64, h = 48) => { const t = new THREE.WebGLRenderTarget(w, h, { samples: 4 }); t.depthTexture = new THREE.DepthTexture(w, h); return t; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const project = (P, V, p) => new THREE.Vector4(...p, 1).applyMatrix4(V).applyMatrix4(P);

test('the switch: the mirror is water 2, High only; nothing of it at Classic, Low and Medium', () => {
  assert.deepEqual(GRAPHICS.map((t) => profile(t).water), [0, 0, 1, 2, 1]);
  const src = B('vhs.js');
  assert.match(src, /    liquids\?\.setLevel\(p\.water\);/, 'the camcorder hands the view its tier\'s water');
  const r = fakeRenderer(), cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170);
  const vhs = createVhs(r, cam, { bloom: false, level: 2, profile: profile('classic') });
  for (const t of ['classic', 'low']) { vhs.setProfile(profile(t)); assert.equal(vhs.liquids, null, t); }
  vhs.setProfile(profile('medium')); assert.equal(vhs.liquids.level, 1);
  vhs.setProfile(profile('high')); assert.equal(vhs.liquids.level, 2);
  vhs.setProfile(profile('auto')); assert.equal(vhs.liquids.level, 1, 'Auto starts at Medium');
  vhs.setProfile(profile('classic')); vhs.dispose();
});

test('the numbers: the plane, the reflection about it, the oblique near plane at the water', () => {
  assert.deepEqual(mirrorPlane([0, 2, 0], [5, 0.3, -1]), [0, 1, 0, -0.3]);
  const R = reflectMatrix([0, 1, 0, -0.3]);
  assert.deepEqual(R.map((v) => v + 0), [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0.6, 0, 1], 'y → 0.6 − y');
  const p = new THREE.Vector3(1, 1.6, 2).applyMatrix4(new THREE.Matrix4().fromArray(R));
  assert.ok(near(p.x, 1) && near(p.y, -1.0) && near(p.z, 2), 'the eye at 1.6 over water at 0.3 is mirrored to −1.0');
  // a tilted plane, for the general case: a point on it stays, a point off it goes as far the other side
  const tp = mirrorPlane([1, 1, 0], [0, 0, 0]), q = new THREE.Vector3(1, 0, 0).applyMatrix4(new THREE.Matrix4().fromArray(reflectMatrix(tp)));
  assert.ok(near(q.x, 0) && near(q.y, -1), 'about x = −y');
  // the mirror camera of an eye over water at 0.3: R · C · F, a proper camera (no turning over), under the water
  const cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170); look(cam, [0, 1.6, 2.5], [0, 0.3, -2]);
  const M = new THREE.Matrix4().fromArray(R).multiply(cam.matrixWorld).multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
  assert.ok(near(M.determinant(), 1, 1e-6), 'a camera again, not a mirror image');
  const eye = new THREE.Vector3().setFromMatrixPosition(M);
  assert.ok(near(eye.y, -1.0, 1e-9) && near(eye.z, 2.5, 1e-9), 'its eye, mirrored');
  const V = M.clone().invert(), clip = planeInView([0, 1, 0, -0.3], V.toArray());
  assert.ok(clip[3] < 0, 'the mirror camera is on the far side of the plane it keeps');
  const P0 = cam.projectionMatrix.toArray(), P1 = obliqueProjection(P0, clip), P = new THREE.Matrix4().fromArray(P1);
  for (const i of [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15]) assert.equal(P1[i], P0[i], `element ${i}: where a point lands in the picture is as it was`);
  // a point on the water lies on the near plane; one above is in front of it; one below is clipped
  for (const at of [[0, 0.3, -1], [0.7, 0.3, -3], [-1, 0.3, 0.5]]) { const c = project(P, V, at); assert.ok(near(c.z / c.w, -1, 1e-6), `on the water at ${at}: z ${c.z / c.w}`); }
  const above = project(P, V, [0, 2.4, -3]), below = project(P, V, [0, 0.1, -1.5]);
  assert.ok(above.z / above.w > -1 && above.z / above.w < 1, 'the ceiling over it is drawn');
  assert.ok(below.z / below.w < -1, 'the bed under it is not');
  // a point on the water lands where the eye sees it, turned side to side (x mirrored)
  const seen = project(cam.projectionMatrix, cam.matrixWorldInverse, [0.7, 0.3, -3]), mir = project(P, V, [0.7, 0.3, -3]);
  assert.ok(near(mir.x / mir.w, -seen.x / seen.w, 1e-9) && near(mir.y / mir.w, seen.y / seen.w, 1e-9));
  assert.deepEqual(mirrorSize(1440, 1080), [720, 540], 'half the scene each way: High at Full VHS is the tape\'s own size');
  assert.deepEqual(mirrorSize(1, 1), [1, 1]);
});

test('which surface: the nearest that may; the one that had it keeps it unless another is a metre nearer', () => {
  const a = { id: 'a' }, b = { id: 'b' };
  assert.equal(pickMirror([], null), null);
  assert.equal(pickMirror([{ rec: a, dist: 3 }, { rec: b, dist: 2 }], null), b);
  assert.equal(pickMirror([{ rec: a, dist: 2.5 }, { rec: b, dist: 2 }], a), a, 'not half a metre nearer: kept');
  assert.equal(pickMirror([{ rec: a, dist: 3.2 }, { rec: b, dist: 2 }], a), b);
  assert.equal(pickMirror([{ rec: b, dist: 2 }], a), b, 'the one that had it may not any more');
  assert.equal(MIRROR.switchBy, 1);
  // in a scene: two pools on one level, one far off at another
  const kit = createKit(), p1 = pool({ kit }), p2 = pool({ kit, at: [0, 0, -9] }), p3 = pool({ kit, at: [6, -0.4, -4] });
  const { scene, cam } = stage(p1.group, p2.group, p3.group), view = createLiquidView(); view.setLevel(2);
  look(cam, [0, 1.6, 2.5], [0, -0.05, -3]);
  view.frame(scene, cam, 0);
  assert.equal(view.mirror?.rec, p1.rec, 'the nearest');
  // drawn: every surface on the chosen one's plane has the mirror inside the draw, the one lower down keeps the tint
  const r = fakeRenderer(), on = [];
  const render = r.render.bind(r);
  r.render = (s, c) => { render(s, c); on.push([p1, p2, p3].map((p) => p.rec.pairs[0].material.uniforms.uMirrorOn.value)); };
  view.draw(r, scene, cam, target(), () => r.render(scene, cam));
  assert.equal(r.log.length, 4, 'the mirror, then under, the copy, over');
  assert.equal(r.log[0].camera, view.mirror.camera); assert.equal(r.log[0].target, view.mirror.target);
  assert.deepEqual(on.at(-1), [1, 1, 0], 'one water level: the pools on its plane; not the one 40 cm lower');
  assert.equal(view.stats.mirror.surfaces, 2);
  for (const p of [p1, p2, p3]) assert.equal(p.rec.pairs[0].material.uniforms.uMirrorOn.value, 0, 'none outside the draw');
  // out of view: not a candidate (the lower pool, turned away from the others)
  look(cam, [6, 1.2, -1], [6, -0.45, -4]); scene.updateMatrixWorld(true);
  view.frame(scene, cam, 0.1);
  assert.equal(view.mirror?.rec, p3.rec);
  view.release(scene); kit.dispose();
});

test('none when the eye is under the surface, too near it, or the sheet faces down; and none when nothing is in view', () => {
  const p = pool(), { scene, cam } = stage(p.group), view = createLiquidView(); view.setLevel(2);
  look(cam, [0.3, -0.6, 0.2], [0.3, 1, -0.4]);
  view.frame(scene, cam, 0);
  assert.equal(p.rec.below, true); assert.equal(view.mirror, null, 'under: the underside, no mirror');
  const r = fakeRenderer(); view.draw(r, scene, cam, target(), () => r.render(scene, cam));
  assert.equal(r.log.length, 3, 'the draw as it was'); assert.ok(r.log.filter((l) => l.camera.isPerspectiveCamera).every((l) => l.camera === cam));
  look(cam, [0.3, -0.05 + MIRROR.above * 0.5, 2.5], [0.3, -0.05, -1]);
  view.frame(scene, cam, 1); assert.equal(view.mirror, null, 'within a few cm of the plane');
  look(cam, [0, 1.6, 2.5], [0, 1.6, 9]);
  view.frame(scene, cam, 2); assert.equal(view.mirror, null, 'looking away (the split held, nothing in view)');
  look(cam, [0, 1.6, 2.5], [0, -0.05, 0]);
  view.frame(scene, cam, 3); assert.ok(view.mirror);
  // a sheet laid face down (the return pool's upper pool): never
  p.rec.edge = { rim: p.rec.edge.rim, facesUp: false };
  view.frame(scene, cam, 4); assert.equal(view.mirror, null);
  view.release(scene); p.kit.dispose();
});

test('what is left out of it: the sheets and the water, what is held, detail, and userData.noReflect on a mesh or a group', () => {
  assert.equal(mirrorLeaves({ userData: { noReflect: true } }), 'noReflect');
  assert.equal(mirrorLeaves({ userData: { liquid: {} } }), 'liquid');
  assert.equal(mirrorLeaves({ userData: {}, renderOrder: HELD_ORDER }), 'held');
  assert.equal(mirrorLeaves({ userData: { detail: true } }), 'detail');
  assert.equal(mirrorLeaves({ userData: {}, renderOrder: 999 }), null, 'the veil and the rest of the room: in it');
  const p = pool(), { scene, cam } = stage(p.group), view = createLiquidView(); view.setLevel(2);
  const box = () => new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), p.kit.surface({ vox: true }));
  const wall = box(), held = box(), fine = box(), marked = box(), inGroup = box(), glass = new THREE.Mesh(new THREE.BoxGeometry(), p.kit.surface({ alpha: 0.4 }));
  held.renderOrder = HELD_ORDER; fine.userData.detail = true; marked.userData.noReflect = true;
  const shy = new THREE.Group(); shy.userData.noReflect = true; shy.add(inGroup);
  wall.position.set(0, 1, -2); glass.position.set(0.5, 0.6, -1);
  p.group.add(wall, held, fine, marked, shy, glass); scene.updateMatrixWorld(true);
  view.frame(scene, cam, 0);
  const r = fakeRenderer(); view.draw(r, scene, cam, target(), () => r.render(scene, cam));
  const [mirror, under, , over] = r.log;
  assert.ok(mirror.drawn.includes(wall) && mirror.drawn.includes(glass), 'the room, see-through things included, as they are');
  for (const o of [held, fine, marked, inGroup, p.mesh, p.rec.pairs[0].water]) assert.ok(!mirror.drawn.includes(o), o.name || 'left out');
  assert.ok(under.drawn.includes(fine) && under.drawn.includes(marked) && under.drawn.includes(inGroup), 'the room\'s own draw: everything, as before');
  assert.ok(over.drawn.includes(held));
  for (const o of [wall, held, fine, marked, shy, inGroup, glass, p.mesh]) assert.equal(o.visible, true, 'shown again');
  assert.equal(p.rec.pairs[0].water.visible, false);
  assert.deepEqual(view.stats.mirror.left, { noReflect: 2, liquid: 0, held: 1, detail: 1, sheet: 1 }, 'the group and its mesh, the held, the detail, the sheet');
  view.release(scene); p.kit.dispose();
});

test('the beam is where it is in the mirror: its origin and direction taken into the mirror camera\'s space for the draw, the camcorder\'s lamp off; all put back', () => {
  const p = pool(), { scene, cam } = stage(p.group), view = createLiquidView(); view.setLevel(2);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), p.kit.surface({ vox: true })); wall.position.set(0, 1, -2); p.group.add(wall); scene.updateMatrixWorld(true);
  const s = p.kit.shared; s.uTorch.value = 1; s.uCameraLamp.value = 0.4; s.uTorchOrigin.value.set(0.1, -0.2, 0); s.uTorchDirection.value.set(0, -0.3, -1).normalize();
  const shadow = { value: new THREE.Matrix4().makeTranslation(1, 2, 3) }; wall.material.uniforms.uBeamShadowMatrix = shadow;
  const o0 = s.uTorchOrigin.value.clone(), d0 = s.uTorchDirection.value.clone(), m0 = shadow.value.clone();
  view.frame(scene, cam, 0);
  const r = fakeRenderer(), render = r.render.bind(r), during = [];
  r.render = (sc, c) => { render(sc, c); during.push({ c, o: s.uTorchOrigin.value.clone(), d: s.uTorchDirection.value.clone(), lamp: s.uCameraLamp.value, m: shadow.value.clone() }); };
  view.draw(r, scene, cam, target(), () => r.render(scene, cam));
  const m = during[0], mc = view.mirror.camera;
  assert.equal(m.c, mc); assert.equal(m.lamp, 0, 'the camcorder\'s lamp (fixed to the eye in the kit) is left out of the mirror');
  // the beam's origin, seen from the mirror, is the same place in the world as it is from the eye
  const w0 = o0.clone().applyMatrix4(cam.matrixWorld), w1 = m.o.clone().applyMatrix4(mc.matrixWorld);
  assert.ok(w0.distanceTo(w1) < 1e-9, 'the same point in the room');
  const a0 = d0.clone().transformDirection(cam.matrixWorld), a1 = m.d.clone().transformDirection(mc.matrixWorld);
  assert.ok(a0.distanceTo(a1) < 1e-9, 'pointing the same way');
  // its shadow looked up from the mirror's space lands where the eye's would
  const pt = new THREE.Vector3(0.2, 0.4, -2.5), viaEye = pt.clone().applyMatrix4(cam.matrixWorldInverse).applyMatrix4(m0);
  const viaMirror = pt.clone().applyMatrix4(mc.matrixWorldInverse).applyMatrix4(m.m);
  assert.ok(viaEye.distanceTo(viaMirror) < 1e-9);
  // and the rest of the frame sees them as they were
  for (const d of during.slice(1)) { assert.ok(d.o.equals(o0) && d.d.equals(d0) && d.lamp === 0.4 && d.m.equals(m0)); }
  assert.ok(s.uTorchOrigin.value.equals(o0) && s.uTorchDirection.value.equals(d0) && s.uCameraLamp.value === 0.4 && shadow.value.equals(m0));
  view.release(scene); p.kit.dispose();
});

test('everything put back when the mirror\'s draw throws', () => {
  const p = pool(), { scene, cam } = stage(p.group), view = createLiquidView(); view.setLevel(2);
  const held = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); held.renderOrder = HELD_ORDER; p.group.add(held);
  const s = p.kit.shared; s.uCameraLamp.value = 0.3; s.uTorchOrigin.value.set(0.1, -0.2, 0);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(), p.kit.surface({ vox: true })); p.group.add(wall); scene.updateMatrixWorld(true);
  const o0 = s.uTorchOrigin.value.clone(), camWas = cam.matrixWorld.clone(), projWas = cam.projectionMatrix.clone(), mask = cam.layers.mask;
  view.frame(scene, cam, 0);
  const r = fakeRenderer(), was = new THREE.WebGLRenderTarget(2, 2); r.current = was; r.autoClear = true; r.shadowMap.autoUpdate = true;
  r.render = () => { throw new Error('lost the context'); };
  assert.throws(() => view.draw(r, scene, cam, target(), () => r.render(scene, cam)), /lost the context/);
  assert.equal(r.current, was); assert.equal(r.autoClear, true); assert.equal(r.shadowMap.autoUpdate, true);
  assert.equal(r.clearColor, 0x123456); assert.equal(r.clearAlpha, 0.5);
  assert.equal(scene.background.getHex(), 0);
  assert.equal(held.visible, true); assert.equal(p.mesh.visible, true); assert.equal(p.rec.pairs[0].water.visible, false);
  assert.ok(s.uTorchOrigin.value.equals(o0)); assert.equal(s.uCameraLamp.value, 0.3);
  assert.equal(p.rec.pairs[0].material.uniforms.uMirrorOn.value, 0);
  assert.ok(cam.matrixWorld.equals(camWas) && cam.projectionMatrix.equals(projWas) && cam.layers.mask === mask, 'the eye\'s own camera never touched');
  for (const o of [held, wall, p.mesh]) assert.equal(o.layers.mask, 1);
  view.release(scene); p.kit.dispose();
});

test('at 1 (Medium), and back from 2: no define, no picture, no pass; the draw exactly the three it was', () => {
  const p = pool(), { scene, cam } = stage(p.group), view = createLiquidView();
  assert.equal(view.level, 1, 'a view starts without the mirror');
  view.frame(scene, cam, 0);
  const m = p.rec.pairs[0].material;
  assert.equal(m.defines.MIRROR, undefined); assert.equal(view.mirror, null);
  let r = fakeRenderer(); view.draw(r, scene, cam, target(), () => r.render(scene, cam));
  assert.equal(r.log.length, 3); assert.ok(r.log.every((l) => l.camera !== view.mirror?.camera));
  view.setLevel(2); view.frame(scene, cam, 1);
  assert.equal(m.defines.MIRROR, 1); assert.ok(view.mirror);
  r = fakeRenderer(); view.draw(r, scene, cam, target(), () => r.render(scene, cam)); assert.equal(r.log.length, 4);
  const pic = view.mirror.target; let gone = 0; pic.addEventListener('dispose', () => gone++);
  view.setLevel(1); view.frame(scene, cam, 2);
  assert.equal(m.defines.MIRROR, undefined, 'taken off again'); assert.equal(view.mirror, null); assert.equal(gone, 1, 'its picture let go');
  assert.equal(view.shared.tMirror.value, null);
  r = fakeRenderer(); view.draw(r, scene, cam, target(), () => r.render(scene, cam)); assert.equal(r.log.length, 3);
  // the underside never has it
  view.setLevel(2); look(cam, [0.3, -0.6, 0.2], [0.3, 1, -0.4]); view.frame(scene, cam, 3);
  r = fakeRenderer(); view.draw(r, scene, cam, target(), () => r.render(scene, cam));
  assert.equal(p.rec.pairs[0].under.defines.MIRROR, undefined);
  view.release(scene); p.kit.dispose();
});

test('the shader: Medium\'s reflection() word for word where MIRROR is not defined; the mirror\'s where it is', () => {
  const at = LIQUID_FRAG.indexOf('#ifdef MIRROR'), els = LIQUID_FRAG.indexOf('#else', at), end = LIQUID_FRAG.indexOf('#endif', els);
  assert.ok(at > 0 && els > at && end > els);
  assert.ok(LIQUID_FRAG.slice(els, end).includes('vec3 reflection(vec3 n, vec3 v, vec2 uv, vec3 light) { return light * 0.100000; }\n'), 'the flat tint, as it was');
  const mir = LIQUID_FRAG.slice(at, els);
  assert.match(mir, /uniform sampler2D tMirror;\nuniform mat4 uMirror;\nuniform float uMirrorOn;\n/);
  // (its weight here: uMirrorOn, and only where a swell is drawn (SWELL) less of it on raised water)
  assert.match(mir, /float mOn = uMirrorOn;\n  #ifdef SWELL\n[^#]*mOn \*= 1\.0 - smoothstep\([\d.]+, [\d.]+, swellRaise\);\n  #endif\n  if \(mOn <= 0\.0\) return flatTint;/, 'a surface without it this frame: the tint');
  assert.match(mir, /return mOn >= 1\.0 \? r : mix\(flatTint, r, mOn\);/, 'whole: exactly the mirror; a sliver: faded toward the tint');
  assert.match(mir, /vec4 m = uMirror \* vec4\(vView, 1\.0\);/, 'where this point of the surface is in the mirror');
  assert.match(mir, /\+ \(n - up\)\.xy \* [\d.]+;/, 'moved by the ripple\'s stepped tilt: it wobbles in blocks');
  assert.match(mir, /r \*= min\(1\.0, cap \/ max\(l, 1e-5\)\);/, 'its brightest held down');
  assert.match(mir, /mix\(vec3\(1\.0\), uKeep\.rgb, [\d.]+\)/, 'toward the water\'s own colour');
  assert.ok(LIQUID_FRAG.includes('col = mix(col, reflection(n, v, uv, light), F);'), 'weighted by the fresnel term the surface already had');
  assert.ok(MIRROR.dim < 1 && MIRROR.tint > 0 && MIRROR.tint < 1 && MIRROR.cap > 1);
  // the caustics, depth, contact line, wake and underside untouched by it: nothing after reflection() reads the mirror
  assert.ok(!/tMirror|uMirror/.test(LIQUID_FRAG.slice(LIQUID_FRAG.lastIndexOf('void main() {'))));
  assert.ok(!/tMirror/.test(LIQUID_UNDER_FRAG.slice(LIQUID_UNDER_FRAG.lastIndexOf('void main() {'))));
});

test('nothing seeded read, nothing random: the same frames choose the same mirror', () => {
  for (const f of ['liquid.js', 'liquid.rule.js']) assert.ok(!/Math\.random|\bR\(\)|rng/.test(B(f)), f);
  // (three.js's own ids read it while things are made: only the frame and the draw are watched)
  const p = pool(), { scene, cam } = stage(p.group), view = createLiquidView(), r = fakeRenderer(), t = target(); view.setLevel(2);
  view.frame(scene, cam, 0); view.draw(r, scene, cam, t, () => r.render(scene, cam));
  const rnd = Math.random; Math.random = () => { throw new Error('read'); };
  try {
    for (let i = 1; i < 4; i++) { view.frame(scene, cam, i); view.draw(r, scene, cam, t, () => r.render(scene, cam)); assert.equal(view.mirror.rec, p.rec); }
  } finally { Math.random = rnd; }
  view.release(scene); p.kit.dispose();
});

test('a sliver of water: its share of the picture, in numbers', () => {
  const cam = new THREE.PerspectiveCamera(90, 1, 0.1, 100); look(cam, [0, 0, 0], [0, 0, -1]);
  const PV = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).toArray();
  // a square facing the eye 1 m away, as wide as the view (90 degrees): the whole picture; a quarter of it: a quarter
  const sq = (x0, y0, x1, y1, z = -1) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
  assert.ok(near(screenCover(sq(-1, -1, 1, 1), PV), 1, 1e-9));
  assert.ok(near(screenCover(sq(0, 0, 1, 1), PV), 0.25, 1e-9));
  assert.ok(near(screenCover(sq(-0.1, -0.1, 0.1, 0.1), PV), 0.01, 1e-9), 'a tenth across each way: 1 %');
  assert.ok(near(screenCover(sq(-5, -5, 5, 5), PV), 1, 1e-9), 'bigger than the view: clipped to it');
  assert.ok(near(screenCover(sq(0.5, -1, 3, 1), PV), 0.25, 1e-9), 'half off the side: what is left');
  assert.equal(screenCover(sq(-1, -1, 1, 1, 1), PV), 0, 'behind the eye: nothing');
  assert.equal(screenCover(sq(2, 2, 3, 3), PV), 0, 'off to one side: nothing');
  // a floor running from under the eye out ahead (behind it too): cut at the near plane, the lower half of the picture
  const floor = [[-50, -1, 10], [50, -1, 10], [50, -1, -50], [-50, -1, -50]];
  const c = screenCover(floor, PV); assert.ok(c > 0.45 && c <= 0.5, `the floor: ${c}`);
  assert.equal(screenCover([], PV), 0);
});

test('the pass for a sliver: on from coverOn, off under coverOff, its weight fading in from coverOff to coverFull', () => {
  assert.ok(MIRROR.coverOff < MIRROR.coverOn && MIRROR.coverOn < MIRROR.coverFull);
  assert.deepEqual([0.005, 0.011, 0.0125, 0.02].map((c) => mirrorGate(false, c)), [false, false, true, true], 'off: on only from coverOn');
  assert.deepEqual([0.005, 0.0099, 0.01, 0.011].map((c) => mirrorGate(true, c)), [false, false, true, true], 'on: kept down to coverOff');
  assert.equal(mirrorWeight(0), 0); assert.equal(mirrorWeight(MIRROR.coverOff), 0, 'nothing where it goes off');
  assert.ok(mirrorWeight(MIRROR.coverOn) < 0.05, 'almost nothing where it comes on');
  assert.equal(mirrorWeight(MIRROR.coverFull), 1); assert.equal(mirrorWeight(0.5), 1);
  assert.ok(near(mirrorWeight((MIRROR.coverOff + MIRROR.coverFull) / 2), 0.5, 1e-12));
  for (let c = 0; c < 0.05; c += 0.001) assert.ok(mirrorWeight(c + 0.001) >= mirrorWeight(c), 'never less for more');
  // in a scene: a pool seen as a sliver at the picture's edge, then turned to
  const p = pool(), { scene, cam } = stage(p.group), view = createLiquidView(); view.setLevel(2);
  const run = (yaw) => { cam.position.set(0, 1.6, 4); cam.rotation.set(-0.3, yaw, 0, 'YXZ'); cam.updateMatrixWorld(); view.frame(scene, cam, 0); return view.stats.mirror; };
  const steps = [];
  for (let yaw = 1.5; yaw >= -0.01; yaw -= 0.05) { const s = run(yaw); steps.push({ yaw, cover: s.cover, on: s.on, weight: s.weight }); }
  const first = steps.findIndex((s) => s.on);
  assert.ok(first > 0, 'off while it is a sliver');
  assert.ok(steps.slice(0, first).every((s) => s.cover < MIRROR.coverOn) && steps[first].cover >= MIRROR.coverOn);
  assert.ok(steps.slice(first).every((s) => s.on), 'on from there');
  assert.ok(steps.at(-1).weight === 1 && steps.at(-1).cover > MIRROR.coverFull);
  // drawn while off: no mirror pass, the water's weight 0 (the flat tint); while on, the weight the cover gives
  const r = fakeRenderer(), seen = [], render = r.render.bind(r);
  r.render = (s, c) => { render(s, c); seen.push(p.rec.pairs[0].material.uniforms.uMirrorOn.value); };
  run(steps[first - 1].yaw); view.draw(r, scene, cam, target(), () => r.render(scene, cam));
  assert.equal(r.log.length, 3, 'no mirror pass for a sliver'); assert.ok(seen.every((v) => v === 0));
  // back the other way: kept on down to coverOff (the hysteresis), then off
  run(0); const back = [];
  for (let yaw = 0; yaw <= 1.5; yaw += 0.05) { const s = run(yaw); back.push({ ...s }); }
  const last = back.findIndex((s) => !s.on);
  assert.ok(last > 0 && back[last].cover < MIRROR.coverOff && back.slice(0, last).every((s) => s.cover >= MIRROR.coverOff));
  view.release(scene); p.kit.dispose();
});

test('every other frame (MIRROR.every 2): off by default; the pass on alternate frames, the picture between read through the matrix it was drawn with', () => {
  assert.equal(MIRROR.every, 1, 'every frame unless a real machine asks for less');
  const a = { id: 'a' }, b = { id: 'b' }, at = (rec, frame, w = 64, h = 48) => ({ rec, frame, w, h });
  assert.equal(mirrorDue(null, at(a, 5), 2), true, 'no picture yet: drawn');
  assert.equal(mirrorDue(at(a, 4), at(a, 5), 1), true, 'every frame at 1');
  assert.equal(mirrorDue(at(a, 4), at(a, 5), 2), false); assert.equal(mirrorDue(at(a, 4), at(a, 6), 2), true);
  assert.equal(mirrorDue(at(a, 4), at(a, 6), 3), false); assert.equal(mirrorDue(at(a, 4), at(a, 7), 3), true);
  assert.equal(mirrorDue(at(a, 4), at(b, 5), 2), true, 'another surface: drawn');
  assert.equal(mirrorDue(at(a, 4, 64, 48), at(a, 5, 32, 24), 2), true, 'a new size: drawn');
  assert.equal(mirrorDue(at(a, 4), at(a, 4), 2), true, 'twice in one frame: drawn again, never trusted');
  assert.equal(mirrorDue(at(a, 4), at(a, 5), 9), false, 'clamped to 3'); assert.equal(mirrorDue(at(a, 4), at(a, 5), 0), true, 'and to 1');

  const kit = createKit(), p1 = pool({ kit }), p3 = pool({ kit, at: [6, -0.4, -4] });
  const { scene, cam } = stage(p1.group, p3.group), view = createLiquidView(); view.setLevel(2);
  const passes = (t = target()) => { view.frame(scene, cam, 0); const r = fakeRenderer(); view.draw(r, scene, cam, t, () => r.render(scene, cam)); return r.log.filter((l) => l.camera === view.mirror?.camera).length; };
  look(cam, [0, 1.6, 2.5], [0, -0.05, -3]); scene.updateMatrixWorld(true);
  const t0 = target();
  assert.deepEqual([1, 2, 3, 4].map(() => passes(t0)), [1, 1, 1, 1], 'at 1: every frame');
  view.mirrorEvery = 2;
  assert.deepEqual([1, 2, 3, 4, 5].map(() => passes(t0)), [0, 1, 0, 1, 0], 'at 2: alternate frames');
  // the frame it is drawn: what it was drawn with kept; the next, turned a little, reads it through that and not this frame's
  view.mirrorEvery = 2; passes(t0); if (view.stats.mirror.fresh === false) passes(t0);
  assert.equal(view.stats.mirror.fresh, true);
  const mc = view.mirror.camera, drawnVP = new THREE.Matrix4().multiplyMatrices(mc.projectionMatrix, mc.matrixWorldInverse);
  cam.rotation.y += 0.03; cam.position.x += 0.02; cam.updateMatrixWorld();
  passes(t0); assert.equal(view.stats.mirror.fresh, false);
  const W = new THREE.Vector3(0.7, -0.05, -1.5);                      // a point on the water
  const viaNow = new THREE.Vector4(...W.clone().applyMatrix4(cam.matrixWorldInverse).toArray(), 1).applyMatrix4(view.shared.uMirror.value);
  const whenDrawn = new THREE.Vector4(W.x, W.y, W.z, 1).applyMatrix4(drawnVP);
  assert.ok(near(viaNow.x / viaNow.w, whenDrawn.x / whenDrawn.w, 1e-9) && near(viaNow.y / viaNow.w, whenDrawn.y / whenDrawn.w, 1e-9), 'the same place in the picture it was drawn into: no sliding');
  // the first frame a surface comes into view always draws; another surface, or a new size, draws at once
  look(cam, [0, 1.6, 2.5], [0, 1.6, 9]); passes(t0); assert.equal(view.mirror, null);
  look(cam, [0, 1.6, 2.5], [0, -0.05, -3]);
  for (let i = 0; i < 4; i++) { look(cam, [0, 1.6, 2.5], [0, 1.6, 9]); passes(t0); look(cam, [0, 1.6, 2.5], [0, -0.05, -3]); assert.equal(passes(t0), 1, `back in view (${i}): drawn`); }
  passes(t0); assert.equal(view.stats.mirror.fresh, false);
  assert.equal(passes(target(128, 96)), 1, 'resized: drawn');
  look(cam, [6, 1.2, -1], [6, -0.45, -4]); assert.equal(passes(t0), 1); assert.equal(view.mirror.rec, p3.rec, 'another surface: drawn');
  view.release(scene); kit.dispose();
});

test('the mark is documented where builders look', () => {
  const docs = readFileSync(new URL('../docs/BACKROOMS.md', import.meta.url), 'utf8'), g = readFileSync(new URL('../docs/BACKROOMS-GRAPHICS.md', import.meta.url), 'utf8');
  assert.ok(/userData\.noReflect = true/.test(docs) && /userData\.noReflect/.test(g));
  assert.ok(/### Water \(built: the mirror\)/.test(g));
});
