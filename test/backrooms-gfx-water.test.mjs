import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { GRAPHICS, profile } from '../public/world/backrooms/graphics.js';

// Water (liquid.js, liquid.rule.js, graphics.js `water`, world.js `c.liquid`, vhs.js): a room marks the sheet it drew as
// a liquid's surface; at 0 (Classic, Low) the mark is all there is, and the room's sheet and the camcorder's one pass
// are as they were; at 1 and 2 (Medium, High) a flat sheet is drawn as water while one is in view, over a copy of the
// scene drawn in two parts.
const pub = new URL('../public/', import.meta.url).href, root = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  if (s === 'three') return {url:${JSON.stringify(pub + 'vendor/three.module.min.js')},shortCircuit:true};
  if (s.startsWith('/vendor/')) return {url:${JSON.stringify(pub.slice(0, -1))}+s,shortCircuit:true};
  if (s.startsWith('/core/')) return {url:new URL(s.slice(1),${JSON.stringify(root)}).href,shortCircuit:true};
  return next(s,c);
}`), import.meta.url);
const THREE = await import('three');
const { createKit, Batch, WHITE } = await import('../public/world/backrooms/kit.js');
const { markLiquid, settleLiquid, liquidMeshes, collectLiquids, createLiquidView, averageColour, sheetTint, sheetRim, OVER_LAYER } = await import('../public/world/backrooms/liquid.js');
const { LIQUID, flatness, underwater, holdStep, waterColours, LIQUID_FRAG, LIQUID_VERT, LIQUID_UNDER_FRAG, UNDERSIDE, seesUnderside } = await import('../public/world/backrooms/liquid.rule.js');
const { createVhs } = await import('../public/world/backrooms/vhs.js');
const { castsBeamShadow, HELD_ORDER } = await import('../public/world/backrooms/beam-shadows.rule.js');
const { glowRole } = await import('../public/world/backrooms/glow.js');

const B = (f) => readFileSync(new URL(`../public/world/backrooms/${f}`, import.meta.url), 'utf8');

// a canvas that draws nothing, for the kit's textures in node (as the waterpark's own tests have it)
const draw = new Proxy({}, { get: (_, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 6 }) : /Gradient/.test(k) ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
const oldDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => draw }) };
test.after(() => { globalThis.document = oldDocument; });

test('the switch: 0 in Classic and Low, 1 at Medium, 2 at High (the mirror: backrooms-gfx-water-mirror), Auto as Medium', () => {
  assert.deepEqual(GRAPHICS.map((t) => profile(t).water), [0, 0, 1, 2, 1]);
  assert.match(B('graphics.js'), /const WATER = \{ classic: 0, low: 0, medium: 1, high: 2 \};\nfor \(const t of Object\.keys\(TABLE\)\) TABLE\[t\]\.water = WATER\[t\];/);
});

/** A room as world.js hands it over, with one sheet as the waterpark draws it (a kit surface, see-through, mapped). */
function sheetRoom({ tilt = 0, y = -0.05, alpha = 0.52, tex = null, holder = true } = {}) {
  const kit = createKit(), group = new THREE.Group(), u = { flick: { value: 1 }, dim: { value: 1 }, banks: { value: [1, 1] }, moreBanks: { value: [0, 0] } };
  const rt = { group, u, liquids: undefined }, after = [];
  const batch = new Batch();
  batch.grid([-2, y, -1.5], [0, 0, 1], [1, 0, 0], [0, 1, 2, 3], [0, 1, 2, 3, 4], (a, b) => [a, b], [0.88, 1, 1], null, tilt ? (a, b, x) => y + x * tilt : null);
  const map = tex || new THREE.Texture();
  const pieces = { kit, rt, batch, map, after, c: { rt, kit, after } };
  const make = () => {
    const mesh = new THREE.Mesh(kit.geometry(batch, [], [0.6, 0.6, 0.6]), kit.surface({ map, room: u, alpha, side: THREE.DoubleSide }));
    mesh.renderOrder = 4;
    return mesh;
  };
  if (holder) { const g = new THREE.Group(); group.add(g); after.push(() => g.add(pieces.mesh = make())); pieces.holder = g; }
  else group.add(pieces.mesh = make());
  return pieces;
}

test('c.liquid at 0, or with no Graphics setting at all: the mark is recorded and nothing else; the sheet is as it was', async () => {
  const src = B('world.js');
  assert.match(src, /    liquid\(target, opt = \{\}\) \{ return markLiquid\(c, target, opt\); \},\n/, 'the one new call on the room\'s toolbox');
  assert.match(src, /import \{ markLiquid \} from '\.\/liquid\.mark\.js';\n/);
  assert.ok(!/from 'three'/.test(B('liquid.mark.js')) && !/import/.test(B('liquid.rule.js')), 'the mark loads without three.js, as the rooms\' own tests load world.js');
  for (const how of ['holder', 'batch', 'mesh']) {
    const r = sheetRoom({ holder: how !== 'mesh' });
    const handle = markLiquid(r.c, how === 'holder' ? r.holder : how === 'batch' ? r.batch : r.mesh, { kind: 'water', y: -0.05 });
    assert.equal(typeof handle.disturb, 'function'); assert.equal(handle.disturb(1, 2, 3), false, 'at 0 the wake does nothing (backrooms-gfx-water-wake)');
    assert.equal(r.rt.liquids.length, 1); assert.equal(r.rt.liquids[0].state, 'marked');
    const before = { material: r.mesh?.material, children: r.rt.group.children.length };
    for (const fn of r.after) fn();
    const rec = r.rt.liquids[0];
    assert.equal(rec.state, 'marked', how); assert.equal(rec.meshes.length, 1); assert.equal(rec.meshes[0], r.mesh);
    assert.ok(Math.abs(rec.plane.y + 0.05) < 1e-6 && rec.plane.height < 1e-6);
    assert.equal(rec.target, null, 'a batch is let go of once its mesh is found');
    // nothing made: the sheet's own material, nothing added beside it, the room's group as it was
    assert.ok(r.mesh.material.fragmentShader.includes('gl_FragColor = vec4(c, uAlpha);'));
    if (before.material) assert.equal(r.mesh.material, before.material);
    let surfaces = 0; r.rt.group.traverse((o) => { if (o.name === 'liquid:surface' || o.material?.name?.startsWith('liquid:')) surfaces++; });
    assert.equal(surfaces, 0);
    assert.deepEqual(collectLiquids(r.rt.group), [rec]);
    r.kit.dispose();
  }
  // a context with no after-list at all (built some other way): the call is still safe
  assert.equal(typeof markLiquid({ rt: {}, kit: null }, null, {}).disturb, 'function');
});

test('the flat test, and what is refused quietly: a sloping sheet, nothing drawn, a sheet that is not the kit\'s', () => {
  assert.deepEqual(flatness(-0.05, -0.05), { flat: true, y: -0.05, height: 0 });
  assert.equal(flatness(0, 0.0099).flat, true); assert.equal(flatness(0, 0.01).flat, false); assert.equal(flatness(Infinity, -Infinity).flat, false);
  const tilted = sheetRoom({ tilt: 0.01 });
  markLiquid(tilted.c, tilted.holder, {}); for (const fn of tilted.after) fn();
  assert.deepEqual([tilted.rt.liquids[0].state, tilted.rt.liquids[0].reason], ['refused', 'not flat']);
  assert.equal(collectLiquids(tilted.rt.group).length, 0, 'a refused mark is never drawn as water');
  const empty = sheetRoom();
  markLiquid(empty.c, new Batch(), {}); for (const fn of empty.after) fn();
  assert.deepEqual([empty.rt.liquids[0].state, empty.rt.liquids[0].reason], ['refused', 'nothing drawn']);
  // flat in its room's frame, whatever turn the room has (the room's group may be turned; its sheet is flat in it)
  const turned = sheetRoom(); turned.rt.group.rotation.set(0.3, 1.2, 0); turned.rt.group.updateMatrixWorld(true);
  markLiquid(turned.c, turned.holder, {}); for (const fn of turned.after) fn();
  assert.equal(turned.rt.liquids[0].state, 'marked');
  // a plain three.js sheet (not the kit's light) is let be at draw time
  const plain = sheetRoom({ holder: false }); plain.mesh.material = new THREE.MeshBasicMaterial({ transparent: true });
  markLiquid(plain.c, plain.mesh, {}); for (const fn of plain.after) fn();
  const view = createLiquidView(), { cam, scene } = stage(plain.rt.group);
  view.frame(scene, cam, 0);
  assert.deepEqual([plain.rt.liquids[0].state, plain.rt.liquids[0].reason], ['refused', 'not a kit sheet']);
  for (const r of [tilted, empty, turned, plain]) r.kit.dispose();
});

/** A scene with the room in it and a camera 1.6 m over the sheet looking down at it. */
function stage(group, eye = [0, 1.6, 2.5]) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  const part = new THREE.Scene(); part.add(group); scene.add(part);
  const cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170); cam.position.set(...eye); cam.lookAt(0, -0.05, 0); cam.updateMatrixWorld();
  scene.updateMatrixWorld(true);
  return { scene, cam };
}

// a renderer that draws nothing: it says what each draw would have drawn (the meshes three would draw for that camera)
function fakeRenderer() {
  const log = [];
  const r = {
    log, autoClear: true, current: null, shadowMap: { autoUpdate: true }, state: { buffers: { depth: { setMask() {} } } },
    getPixelRatio: () => 1, getSize: (v) => v.set(1280, 800), getClearAlpha: () => 1, getClearColor: (c) => c.set(0), setClearColor() {},
    getRenderTarget() { return this.current; }, setRenderTarget(t) { this.current = t; }, clear() {}, getContext: () => ({}),
    render(scene, camera) {
      const drawn = [];
      scene.traverseVisible((o) => { if (o.material && o.layers.test(camera.layers)) drawn.push(o); });
      log.push({ scene, target: this.current, drawn, autoClear: this.autoClear, background: scene.background ?? null });
    },
  };
  return r;
}

function upgraded(opt = {}) {
  const r = sheetRoom(opt);
  const handle = markLiquid(r.c, r.holder, { kind: 'water', phase: opt.phase, y: -0.05 });
  for (const fn of r.after) fn();
  return { ...r, handle, rec: r.rt.liquids[0] };
}
const target = (w = 64, h = 48) => { const t = new THREE.WebGLRenderTarget(w, h, { samples: 4 }); t.depthTexture = new THREE.DepthTexture(w, h); return t; };

test('at 1: a second mesh on the same geometry, the water\'s material, never shown outside the camcorder\'s draw; the old sheet off only inside it', () => {
  const phase = { value: 0 };
  const w = upgraded({ phase }), { scene, cam } = stage(w.rt.group), view = createLiquidView();
  assert.equal(view.frame(scene, cam, 1), true, 'in view: the two-part draw');
  const [pair] = w.rec.pairs;
  assert.equal(w.rec.state, 'up'); assert.equal(pair.old, w.mesh);
  assert.equal(pair.water.geometry, w.mesh.geometry, 'the same geometry, not a copy');
  assert.equal(pair.water.parent, w.mesh.parent); assert.equal(pair.water.renderOrder, w.mesh.renderOrder);
  assert.equal(pair.water.visible, false, 'never visible outside the draw'); assert.equal(w.mesh.visible, true);
  assert.equal(pair.water.userData.noBeamShadow, true); assert.equal(castsBeamShadow(pair.water), false, 'it throws no beam shadow');
  assert.equal(glowRole(pair.water.material), 'black', 'not an emitter: the bloom\'s exact path leaves it out');
  const m = pair.material;
  assert.equal(m.depthWrite, true); assert.equal(m.transparent, false); assert.equal(m.side, THREE.DoubleSide);
  // lit by the room as the old sheet was: the very same uniform objects (dimmer, flicker, banks, tint), and its phase
  for (const k of ['uDim', 'uFlick', 'uBanks', 'uMoreBanks', 'uTint']) assert.equal(m.uniforms[k], w.mesh.material.uniforms[k], k);
  assert.equal(m.uniforms.uPhase, phase, 'the room\'s phase drives the ripple\'s drift');
  assert.equal(m.vertexShader, LIQUID_VERT); assert.equal(m.fragmentShader, LIQUID_FRAG);

  const r = fakeRenderer(), t = target(), was = new THREE.WebGLRenderTarget(2, 2);
  r.current = was;
  let underCalls = 0;
  view.draw(r, scene, cam, t, () => { underCalls++; r.render(scene, cam); });
  assert.equal(underCalls, 1);
  const [under, copy, over] = r.log;
  assert.ok(!under.drawn.includes(w.mesh) && !under.drawn.includes(pair.water), 'under: neither the sheet nor the water');
  assert.equal(copy.target, view.copy); assert.equal(copy.scene.material.fragmentShader.includes('gl_FragDepthEXT'), true, 'the copy takes the depth too');
  assert.deepEqual([view.copy.width, view.copy.height, view.copy.samples], [64, 48, 0], 'a plain pair at the scene\'s size');
  assert.equal(over.target, t); assert.equal(over.autoClear, false); assert.equal(over.background, null, 'over: nothing cleared');
  assert.deepEqual(over.drawn, [pair.water], 'over: the water (and what is see-through and held)');
  assert.equal(m.uniforms.tScene.value, view.copy.texture); assert.equal(m.uniforms.tDepth.value, view.copy.depthTexture);
  assert.deepEqual(m.uniforms.uSize.value.toArray(), [64, 48]);
  // and put back
  assert.equal(pair.water.visible, false); assert.equal(w.mesh.visible, true); assert.equal(r.current, was);
  assert.equal(scene.background.getHex(), 0); assert.equal(r.autoClear, true); assert.equal(cam.layers.mask, 1);
  w.kit.dispose();
});

test('the tint is the old sheet\'s: its picture\'s average times its colour, murkier where the sheet was less see-through', () => {
  const pixels = (rgba) => ({ image: { width: 2, height: 1, getContext: () => ({ getImageData: () => ({ data: Uint8ClampedArray.from([...rgba, ...rgba]) }) }) } });
  const green = pixels([37, 106, 96, 255]), aqua = pixels([19, 139, 161, 255]);
  const g = averageColour(green), a = averageColour(aqua);
  assert.ok(g[1] > g[2] && g[1] > g[0], 'a green pool reads green'); assert.ok(a[2] > a[1] && a[1] > a[0], 'an aqua one aqua');
  assert.equal(averageColour({ image: { getContext: () => draw } }), null, 'a picture that cannot be read: none');
  const w = upgraded({ tex: green, alpha: 0.63 });
  const { tint, alpha } = sheetTint(w.mesh);
  assert.equal(alpha, 0.63);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(tint[i] - g[i] * [0.88, 1, 1][i]) < 0.01, 'times the sheet\'s vertex colour');
  const { scene, cam } = stage(w.rt.group), view = createLiquidView(); view.frame(scene, cam, 0);
  const u = w.rec.pairs[0].material.uniforms, col = waterColours(tint, 0.63);
  assert.deepEqual(u.uDeep.value.toArray().map((v) => +v.toFixed(5)), col.deep.map((v) => +v.toFixed(5)));
  assert.ok(u.uAbsorb.value.x > u.uAbsorb.value.y, 'red goes first in a green pool');
  // the caustics are worked out, not read from the sheet's picture: the picture gives the tint (its average) and nothing else
  assert.equal(u.map, undefined); assert.ok(!/texture2D\(map/.test(LIQUID_FRAG));
  assert.ok(waterColours(tint, 0.82).absorb[1] > waterColours(tint, 0.52).absorb[1], 'a murkier sheet absorbs faster');
  assert.ok(waterColours(tint, 0.63).absorb[2] > 3 * waterColours(tint, 0.52).absorb[2], 'the green rooms\' sheets stay murk, much more than the waterpark\'s');
  // however much a clear sheet absorbs, 2 m of it keeps about 55 % in its clearest channel; a murky sheet's floor is far lower
  const clear = waterColours([0.01, 0.26, 0.36], 0.52);
  assert.ok(Math.abs(Math.exp(-clear.keepRate * 2) * Math.max(...clear.keep) - 0.55) < 0.01);
  assert.ok(Math.exp(-waterColours([0.01, 0.26, 0.36], 0.63).keepRate * 2) < 0.01, 'the green rooms keep their murk');
  assert.deepEqual(waterColours(null), waterColours(LIQUID.fallbackTint), 'a picture that cannot be read: a pool colour of its own');
  assert.ok(waterColours([0.2, 0.3, 0.3]).deep[0] < 0.2 * LIQUID.deep, 'the pale caustic lines averaged in are pushed back out');
  w.kit.dispose();
});

test('in view: the old single pass when no surface is, the split when one is, held half a second; under the plane outside the rim, the old sheet', () => {
  assert.deepEqual(holdStep(null, 0, false), { last: -Infinity, split: false });
  let s = holdStep(null, 1, true); assert.equal(s.split, true);
  s = holdStep(s, 1.3, false); assert.equal(s.split, true, 'held');
  s = holdStep(s, 1.6, false); assert.equal(s.split, false, 'let go after the hold');
  assert.equal(holdStep(s, 2, false, 'split').split, true); assert.equal(holdStep({ last: 2 }, 2, true, 'single').split, false);
  assert.equal(underwater(-0.04, -0.05), true, 'within 2 cm over it counts as under'); assert.equal(underwater(0, -0.05), false);

  const w = upgraded(), { scene, cam } = stage(w.rt.group), view = createLiquidView();
  assert.equal(view.frame(scene, cam, 10), true);
  // looking away: still split for the hold, then the one pass
  cam.position.set(0, 1.6, 2.5); cam.lookAt(0, 1.6, 30); cam.updateMatrixWorld();
  assert.equal(view.frame(scene, cam, 10.2), true); assert.equal(view.stats.inView, 0);
  assert.equal(view.frame(scene, cam, 10.6), false);
  // the part or the room not shown: not in view
  cam.lookAt(0, -0.05, 0); cam.updateMatrixWorld();
  w.rt.group.visible = false; assert.equal(view.frame(scene, cam, 20), false); w.rt.group.visible = true;
  // a room may hide its own sheet: then neither is drawn
  w.mesh.visible = false; assert.equal(view.frame(scene, cam, 30), false); w.mesh.visible = true;
  // under the plane but outside the rim (a lower room beside the pool): the old sheet is drawn, not in view
  cam.position.set(3, -0.5, 0); cam.lookAt(0, -0.05, 0); cam.updateMatrixWorld();
  assert.equal(view.frame(scene, cam, 40), false); assert.deepEqual([w.rec.under, w.rec.below], [true, false]);
  view.force = 'split'; assert.equal(view.frame(scene, cam, 40), true);
  const r = fakeRenderer(); view.draw(r, scene, cam, target(), () => r.render(scene, cam));
  assert.ok(r.log.at(-1).drawn.includes(w.mesh), 'under it: the room\'s own sheet, see-through, drawn over');
  assert.ok(!r.log.at(-1).drawn.includes(w.rec.pairs[0].water));
  view.force = null;
  // (the underside, in the water inside the rim, has a test of its own below)
  // no depth to read: the ordinary draw
  const r2 = fakeRenderer(); let n = 0; view.draw(r2, scene, cam, new THREE.WebGLRenderTarget(4, 4), () => n++);
  assert.deepEqual([n, r2.log.length], [1, 0]);
  w.kit.dispose();
});

test('the eye in the water: the surface\'s underside, only inside the rim of a pool that faces up; put back after the draw', () => {
  const rim = { x0: -2, z0: -1.5, x1: 2, z1: 1.5 };
  assert.equal(seesUnderside({ x: 0, y: -0.5, z: 0 }, -0.05, rim, true), true);
  assert.equal(seesUnderside({ x: 0, y: 0.5, z: 0 }, -0.05, rim, true), false, 'over it: the top');
  assert.equal(seesUnderside({ x: 3, y: -0.5, z: 0 }, -0.05, rim, true), false, 'outside the rim');
  assert.equal(seesUnderside({ x: 0, y: -0.5, z: 0 }, -0.05, rim, false), false, 'a sheet facing down (the return pool\'s upper pool) keeps its own');
  assert.equal(seesUnderside({ x: 0, y: -0.5, z: 0 }, -0.05, null, true), false);

  const w = upgraded(), { scene, cam } = stage(w.rt.group), view = createLiquidView();
  view.frame(scene, cam, 0);
  const [pair] = w.rec.pairs, top = pair.material;
  assert.equal(pair.under, undefined, 'nothing of the underside is made until an eye is under it');
  const edge = sheetRim(w.rec);
  assert.equal(edge.facesUp, true, 'the waterpark\'s way of laying a sheet faces up');
  for (const [k, v] of Object.entries(rim)) assert.ok(Math.abs(edge.rim[k] - v) < 1e-6, k);
  // the same sheet laid the other way round faces down (as the return pool's upper pool is)
  const down = sheetRoom(); down.batch.idx.length = 0; down.batch.pos.length = 0;
  down.batch.grid([-2, -0.05, -1.5], [1, 0, 0], [0, 0, 1], [0, 1, 2, 3, 4], [0, 1, 2, 3], (a, b) => [a, b], [0.88, 1, 1]);
  markLiquid(down.c, down.holder, { y: -0.05 }); for (const fn of down.after) fn();
  assert.equal(sheetRim(down.rt.liquids[0]).facesUp, false);

  // in the water, inside the rim, looking up: in view, the split, the underside drawn in the sheet's place
  cam.position.set(0.3, -0.6, 0.2); cam.lookAt(0.3, 1, -0.4); cam.updateMatrixWorld();
  assert.equal(view.frame(scene, cam, 10), true);
  assert.deepEqual([w.rec.under, w.rec.below, view.stats.below, view.stats.inView], [true, true, 1, 1]);
  const r = fakeRenderer(), render = r.render.bind(r), seen = [];
  r.render = (s, c) => { render(s, c); seen.push(r.log.at(-1).drawn.map((o) => o.material.name || '')); };
  view.draw(r, scene, cam, target(), () => r.render(scene, cam));
  assert.ok(pair.under, 'made the first time'); assert.equal(pair.under.fragmentShader, LIQUID_UNDER_FRAG); assert.equal(pair.under.vertexShader, LIQUID_VERT);
  assert.equal(pair.under.uniforms, top.uniforms, 'the top\'s very uniforms: the room\'s light, its phase, the copy');
  assert.deepEqual(seen.at(-1), ['liquid:water:underside']); assert.ok(!r.log.at(-1).drawn.includes(w.mesh), 'the room\'s sheet is not drawn');
  assert.equal(pair.water.material, top, 'put back'); assert.equal(pair.water.visible, false); assert.equal(w.mesh.visible, true);
  // back over it: the top, and the underside made once is kept for the next dive
  const under = pair.under;
  cam.position.set(0, 1.6, 2.5); cam.lookAt(0, -0.05, 0); cam.updateMatrixWorld();
  view.frame(scene, cam, 11); assert.equal(w.rec.below, false);
  const r2 = fakeRenderer(), render2 = r2.render.bind(r2), seen2 = [];
  r2.render = (s, c) => { render2(s, c); seen2.push(r2.log.at(-1).drawn.map((o) => o.material.name || '')); };
  view.draw(r2, scene, cam, target(), () => r2.render(scene, cam));
  assert.deepEqual(seen2.at(-1), ['liquid:water']); assert.equal(pair.under, under);
  // let go of with the rest
  let gone = 0; under.addEventListener('dispose', () => gone++);
  view.release(scene); assert.equal(gone, 1);
  // the underside's shader: the top's own functions (the ripple and the wake's rings below too), its own main
  assert.ok(LIQUID_UNDER_FRAG.startsWith(LIQUID_FRAG.slice(0, LIQUID_FRAG.lastIndexOf('void main() {'))));
  assert.equal(LIQUID_UNDER_FRAG.split('void main() {').length, 2);
  // the top's ripple and the wake's slope, line for line: a ring passing over tilts the window as it tilts the top; the
  // wake's crest and trough light (and its stirred caustics) are the top's alone, so a ring seen from below adds no light
  const topMain = LIQUID_FRAG.slice(LIQUID_FRAG.lastIndexOf('void main() {'));
  assert.ok(LIQUID_UNDER_FRAG.includes(topMain.slice(0, topMain.indexOf('\n', topMain.indexOf('  vec3 n = normalize(uRoomToView')) + 1)));
  assert.ok(LIQUID_UNDER_FRAG.includes('wk += wakeRing(rp, uRings[i], h0, rc);'));
  assert.ok(!/wk\.[yzw]/.test(LIQUID_UNDER_FRAG.slice(LIQUID_UNDER_FRAG.indexOf('vec3 ray = normalize(vView);'))), 'no light of the wake\'s below');
  assert.match(LIQUID_UNDER_FRAG, /float w = smoothstep\(0\.631000, 0\.691000, cosUp\);/, 'Snell\'s window, about 48.6 degrees round straight up');
  assert.ok(Math.abs(Math.acos(UNDERSIDE.window) * 180 / Math.PI - 48.6) < 0.1);
  assert.match(LIQUID_UNDER_FRAG, /if \(texture2D\(tDepth, ruv\)\.x < gl_FragCoord\.z\) ruv = uv;/, 'never bent onto what is in the water in front of it');
  w.kit.dispose(); down.kit.dispose();
});

test('the caustics never lift what they land on past the brighter of itself and the room\'s light there', () => {
  // (a pale step in shallow water was lit up past the deck beside it: the Diving Well's glowing steps)
  assert.match(LIQUID_FRAG, /  vec3 bare = under;\n  under \*= 1\.0 \+ uCaustic \* k;\n/);
  const L = 'vec3(0.299, 0.587, 0.114)';
  assert.ok(LIQUID_FRAG.includes(`  under *= min(1.0, max(dot(bare, ${L}), dot(light, ${L})) / max(dot(under, ${L}), 1e-5));\n`));
  assert.ok(LIQUID_FRAG.indexOf('vec3 light = vLit;') < LIQUID_FRAG.indexOf('vec3 bare = under;'), 'the room\'s light at the surface, known by then');
  // what it does, in numbers (the shader's arithmetic, here): a dark bed as before; a pale step held at the room's light
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const lift = (bare, light, k) => { const u = bare.map((v) => v * (1 + LIQUID.caustic * k)); const s = Math.min(1, Math.max(lum(bare), lum(light)) / Math.max(lum(u), 1e-5)); return u.map((v) => v * s); };
  const light = [0.85, 1.18, 1.23];                       // (the Diving Well's light at its surface, measured)
  const bed = [0.03, 0.13, 0.1], step = [0.82, 1.05, 1.1]; // (its bed and its top step, under the surface, measured)
  assert.deepEqual(lift(bed, light, 1), bed.map((v) => v * (1 + LIQUID.caustic)), 'the bed: the full 2.3 times');
  assert.ok(Math.abs(lum(lift(step, light, 1)) - lum(light)) < 1e-9, 'the step: no brighter than the room\'s light');
  assert.deepEqual(lift(step, light, 0), step, 'and nothing where there is no caustic');
  const lamp = [3, 3, 3];
  for (const v of lift(lamp, light, 1)) assert.ok(Math.abs(v - 3) < 1e-9, 'a lamp under the water: as bright as it is, never dimmed');
});

test('the order: what is held stays last and in front; what is see-through is drawn after the water; nothing else moves', () => {
  const w = upgraded(), { scene, cam } = stage(w.rt.group), view = createLiquidView();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(), w.kit.surface({ vox: true })), glass = new THREE.Mesh(new THREE.BoxGeometry(), w.kit.surface({ alpha: 0.4 }));
  const held = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial()); held.renderOrder = HELD_ORDER;
  wall.position.set(0, 0.5, -1); glass.position.set(0.5, 0.3, 0); held.position.set(0, 1.4, 2.2);
  w.rt.group.add(wall, glass, held); scene.updateMatrixWorld(true);
  view.frame(scene, cam, 0);
  const r = fakeRenderer(); view.draw(r, scene, cam, target(), () => r.render(scene, cam));
  const [under, , over] = r.log;
  assert.ok(under.drawn.includes(wall) && !under.drawn.includes(glass) && !under.drawn.includes(held));
  assert.deepEqual(new Set(over.drawn), new Set([w.rec.pairs[0].water, glass, held]));
  for (const o of [wall, glass, held, w.mesh]) assert.equal(o.layers.mask, 1, 'every layer as it was');
  assert.ok(OVER_LAYER > 0 && OVER_LAYER < 32);
  w.kit.dispose();
});

test('everything put back when a draw throws', () => {
  const w = upgraded(), { scene, cam } = stage(w.rt.group), view = createLiquidView();
  const glass = new THREE.Mesh(new THREE.BoxGeometry(), w.kit.surface({ alpha: 0.4 })); w.rt.group.add(glass);
  view.frame(scene, cam, 0);
  const r = fakeRenderer(), was = new THREE.WebGLRenderTarget(2, 2); r.current = was;
  const render = r.render.bind(r); let n = 0;
  r.render = (s, c) => { if (++n === 3) throw new Error('lost the context'); render(s, c); };
  assert.throws(() => view.draw(r, scene, cam, target(), () => r.render(scene, cam)), /lost the context/);
  assert.equal(w.rec.pairs[0].water.visible, false); assert.equal(w.mesh.visible, true);
  assert.equal(glass.layers.mask, 1); assert.equal(w.rec.pairs[0].water.layers.mask, 1); assert.equal(cam.layers.mask, 1);
  assert.equal(scene.background.getHex(), 0); assert.equal(r.autoClear, true); assert.equal(r.current, was);
  w.kit.dispose();
});

test('vhs.js: at 0 no view and one pass, exactly as before; at 1 and 2 a view; back to 0 lets go of every surface and the copy', () => {
  const src = B('vhs.js');
  assert.match(src, /render\(dt\) \{ time \+= dt; u\.uTime\.value = time; split = !!liquids && liquids\.frame\(renderPass\.scene, camera, time\); composer\.render\(dt\); \},/);
  assert.match(src, /const drawScene = \(r, target, under\) => \(split && liquids \? liquids\.draw\(r, renderPass\.scene, camera, target, under\) : under\(\)\);/,
    'not split: the caller\'s own draw, as it always was');
  assert.match(src, /if \(this\.draw\) this\.draw\(renderer, this\.target, \(\) => renderer\.render\(this\.scene, this\.camera\)\); else renderer\.render\(this\.scene, this\.camera\);/);
  const r = fakeRenderer(), cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170);
  const vhs = createVhs(r, cam, { bloom: false, level: 2, profile: profile('classic') });
  assert.equal(vhs.liquids, null);
  vhs.setProfile(profile('low')); assert.equal(vhs.liquids, null);
  vhs.setProfile(profile('medium')); const view = vhs.liquids; assert.ok(view);
  vhs.setProfile(profile('high')); assert.equal(vhs.liquids, view, 'one view while it stays on (2 adds the mirror to it)');
  const w = upgraded(), { scene } = stage(w.rt.group);
  vhs.setScene(scene); cam.position.set(0, 1.6, 2.5); cam.lookAt(0, -0.05, 0);
  assert.equal(view.frame(scene, cam, 0), true);
  const water = w.rec.pairs[0].water;
  vhs.setProfile(profile('classic'));
  assert.equal(vhs.liquids, null); assert.equal(water.parent, null, 'the water\'s mesh is taken out'); assert.equal(w.mesh.visible, true);
  assert.equal(w.rec.state, 'marked', 'and made again if the tier comes back');
  vhs.setProfile(profile('high')); vhs.liquids.frame(scene, cam, 0); assert.equal(w.rec.state, 'up'); assert.notEqual(w.rec.pairs[0].water, water);
  vhs.setProfile(profile('classic'));
  vhs.dispose(); w.kit.dispose();
});

test('the waterpark\'s rooms, built as they are: every surface marked, flat ones up at 1, the room\'s sheet untouched at 0', async () => {
  const [{ buildWorld, loadCatalogue }, { generate }, { DECK }, { createDenizens }] = await Promise.all([
    import('../public/world/backrooms/world.js'), import('../public/world/backrooms/gen.js'), import('../public/world/backrooms/gen.js'), import('../public/world/backrooms/denizens.js')]);
  const expect = { 'kiddie-lagoon': 1, 'deep-end': 1, 'lazy-river': 1, 'slide-maze': 1, 'wave-pool': 1, 'whirlpool-flume': 1, 'return-pool': 2, 'bellmouth-baths': 1, 'hanging-changing': 3 };
  for (const [id, n] of Object.entries(expect)) {
    const { build } = await import(`../public/world/backrooms/rooms/${id}.js`), defn = DECK.find((a) => a.id === id), kit = createKit(), g = generate('water-marks', { themes: ['waterpark'] });
    const [W, D, H] = [defn.w[0], defn.d[0], defn.h[0]];
    const def = { ...g.rooms[0], id: 0, kind: 'special', arch: id, rot: 0, cx: 0, cz: 0, x: -W / 2 - 0.1, z: -D / 2 - 0.1, w: W + 0.2, d: D + 0.2, W, D, H, y: 1.7, shape: null, panels: [], wins: [], params: {},
      doors: ['front', ...defn.ports].map((side) => ({ side, c: 0, w: 1.4, h: 2.05, sill: 0, to: 0 })) };
    const level = { ...g, theme: 'waterpark', rooms: [def], links: [], windows: [], start: { room: 0, x: 0, z: 0 }, exit: { ...g.exit, way: 'wall' } };
    const builders = { ...(await import('../public/world/backrooms/rooms.js')).BUILDERS, [id]: build };
    const env = { kit, catalogue: await loadCatalogue(kit), level, hatches: new Map(), barricadesEnabled: true, hold() {}, play() {}, interfere() {}, sees: () => true, hear: () => ({ vol: 1, pan: 0 }),
      health: { damage: () => ({ ok: true }) }, camera: { drain: () => ({ ok: true }) }, hud: { flag() {}, glitch() {} }, run: { met() {}, survived() {} }, builders };
    createDenizens(env);
    const warn = console.warn; console.warn = () => {};
    let world; try { world = await buildWorld(kit, level, env); } finally { console.warn = warn; }
    const rt = world.rooms[0];
    assert.equal(rt.liquids?.length, n, `${id}: ${n} marked`);
    for (const rec of rt.liquids) assert.equal(rec.state, 'marked', `${id}: flat (${rec.reason})`);
    // nothing of the water exists at 0: every sheet is the kit's own, see-through, and nothing is beside it
    let made = 0; rt.group.traverse((o) => { if (o.material?.name?.startsWith?.('liquid:')) made++; });
    assert.equal(made, 0);
    for (const rec of rt.liquids) for (const m of rec.meshes) assert.ok(m.material.transparent && m.material.uniforms.uAlpha.value < 1, `${id}: the room's own sheet`);
    if (id === 'return-pool') assert.ok(rt.liquids.every((r) => r.phase), 'the return pool hands its phase over (its drift turns with the valve)');
    if (id === 'bellmouth-baths') assert.ok(rt.liquids[0].phase && rt.liquids[0].meshes[0].geometry.index.count === 60 * 6, 'the bellmouth\'s 60-sector fan');
    // at 1: each made into water on its own geometry
    const scene = new THREE.Scene(); scene.add(world.scene); scene.updateMatrixWorld(true);
    const view = createLiquidView(), cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170); cam.position.set(0, 20, 0.01); cam.lookAt(0, 0, 0);
    view.frame(scene, cam, 0);
    for (const rec of rt.liquids) { assert.equal(rec.state, 'up', id); for (const p of rec.pairs) assert.equal(p.water.geometry, p.old.geometry); }
    view.release(scene);
    world.dispose(); kit.dispose();
  }
});

test('the helper lines in the waterpark\'s files: each once, and nothing else of those files changed', () => {
  // (recorded from origin/blockrooms-live at 21500d9, each file as it was before its line went in. When the waterpark's
  // builder changes one of these files, re-record its hash: the line itself must stay, once)
  const lines = [
    ['waterpark.js', "  const water = c.liquid?.(waterSurf, { kind: 'water', y: waterY });\n"],
    ['waterpark.js', "      c.liquid?.(wb, { kind: 'water', y: 0.15 });\n"],
    ['rooms/return-pool/art.js', "  c.liquid?.(group, { kind: 'water', phase, y });\n"],
    ['rooms/bellmouth/art.js', "  c.liquid?.(group,{kind:'water',phase,y:p.water});\n"],
  ];
  // (each line once, and where it goes below. The files are another builder's and will change: no record of the rest of them is kept here)
  const text = {};
  for (const [f, line] of lines) {
    text[f] ??= B(f);
    assert.equal(text[f].split(line).length - 1, 1, `${f}: ${line.trim()} once`);
    text[f] = text[f].replace(line, '');
  }
  // where each goes: after the basin's sheet, the footbath's sheet, and before each art helper hands its group back
  // (18 Nov: the waterpark's builder put one line of its own between, the lamps the Classic sheet reflects: pool-optics.js)
  assert.match(B('waterpark.js'), /    order: 4,\n(?:    finishMaterial: [^\n]*\n)?  \}\);\n  const water = c\.liquid\?\.\(waterSurf, \{ kind: 'water', y: waterY \}\);\n/);
  assert.match(B('waterpark.js'), /alpha: 0\.56, side: THREE\.DoubleSide, order: 4 \}\);\n      c\.liquid\?\.\(wb, \{ kind: 'water', y: 0\.15 \}\);\n/);
  assert.match(B('rooms/return-pool/art.js'), /  c\.liquid\?\.\(group, \{ kind: 'water', phase, y \}\);\n  return \{ group, phase \};/);
  assert.match(B('rooms/bellmouth/art.js'), /  c\.liquid\?\.\(group,\{kind:'water',phase,y:p\.water\}\);\n  return \{phase,group\};/);
});

test('what the surface is made of: the kit\'s shader text untouched; the room\'s cells, the copy\'s depth, a slot for the mirror', () => {
  // the kit's shader is not this file's to change: nothing of the water's is in it (its own record is backrooms-gfx-glow's)
  assert.ok(!/liquid|uRings|caustic\(/i.test(B('kit.js')), 'nothing of the water in kit.js');
  for (const f of ['gen.js', 'plan.js']) assert.ok(!/liquid/.test(B(f)), `${f}: nothing of the water`);
  assert.match(LIQUID_FRAG, /vec2 c = \(floor\(vRoom\.xz \/ cell\) \+ 0\.5\) \* cell;/, 'cells of the room\'s own frame');
  assert.match(LIQUID_VERT, /vRoom = \(uToRoom \* vec4\(position, 1\.0\)\)\.xyz;/);
  assert.match(LIQUID_FRAG, /vec3 reflection\(vec3 n, vec3 v, vec2 uv, vec3 light\) \{ return light \* /, 'one function where the mirror goes');
  assert.match(LIQUID_FRAG, /if \(rd < gl_FragCoord\.z\) ruv = uv;/, 'the ripple never fetches what is above the water');
  assert.match(LIQUID_FRAG, /uniform vec4 uRings\[\d+\];\nuniform int uRingN;/, 'the wake\'s slot');
  assert.match(LIQUID_FRAG, /float k = caustic\(vRoom\.xz \+ dir\.xz \* thick, slope, thick\) \* exp\(-[\d.]+ \* uKeep\.w \* thick\);/, 'the caustics where the ray reaches the bed, fading with depth, far faster in a murky pool');
  assert.match(LIQUID_FRAG, /  under \*= 1\.0 \+ uCaustic \* k;/, 'they only brighten what they land on: no colour of their own');
  assert.match(LIQUID_FRAG, /q = \(floor\(q \/ [\d.]+\) \+ 0\.5\) \* [\d.]+;/, 'on cells of the room\'s frame');
  assert.ok(/uTime \* [\d.]+( \+ [\d.]+)?, e\);/.test(LIQUID_FRAG), 'they change with the clock');
  assert.ok(LIQUID.causticScale[0] / LIQUID.causticScale[1] % 1 !== 0, 'two layers at scales that do not line up');
  assert.ok(!/Math\.random|\bR\./.test(B('liquid.js') + B('liquid.rule.js')), 'nothing seeded, nothing random: the ripple is timed by the clock');
});


test('a basin keeps its water\'s handle: a room can ring the surface at Medium and High; at Classic and Low it does nothing', () => {
  const src = B('waterpark.js');
  assert.match(src, /  const water = c\.liquid\?\.\(waterSurf, \{ kind: 'water', y: waterY \}\);\n/);
  assert.match(src, /    get swimmer\(\) \{ return swimmer; \},\n    water,[^\n]*\n  \};\n  c\.rt\.basin = info;\n/);
});
