import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { register } from 'node:module';
import { profile } from '../public/world/backrooms/graphics.js';

// The stand-in (liquid.js draw, waterpark.js createBasin): what a room draws itself in place of what the water now draws
// (userData.liquidStandIn, the waterpark's pale splash ring) is hidden for the length of the camcorder's own draw, in each
// room whose surface is drawn, and put back in the same finally. At water 0 (Classic, Low) nothing reads the mark.
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
const { createVhs } = await import('../public/world/backrooms/vhs.js');

const B = (f) => readFileSync(new URL(`../public/world/backrooms/${f}`, import.meta.url), 'utf8');
const draw = new Proxy({}, { get: (_, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 6 }) : /Gradient/.test(k) ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
const oldDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => draw }) };
test.after(() => { globalThis.document = oldDocument; });

/** A room with one kit sheet and a pale ring on it marked as a stand-in (as createBasin's), in a part, with a camera over it. */
function pool({ at = [0, 0, 0] } = {}) {
  const kit = createKit(), group = new THREE.Group(), u = { flick: { value: 1 }, dim: { value: 1 }, banks: { value: [1, 1] }, moreBanks: { value: [0, 0] } };
  group.position.set(...at);
  const rt = { group, u }, after = [], c = { rt, kit, after };
  const batch = new Batch();
  batch.grid([-2, -0.05, -1.5], [0, 0, 1], [1, 0, 0], [0, 1, 2, 3], [0, 1, 2, 3, 4], (a, b) => [a, b], [0.88, 1, 1]);
  const mesh = new THREE.Mesh(kit.geometry(batch, [], [0.6, 0.6, 0.6]), kit.surface({ map: new THREE.Texture(), room: u, alpha: 0.52, side: THREE.DoubleSide }));
  group.add(mesh);
  markLiquid(c, mesh, { kind: 'water', y: -0.05 });
  for (const fn of after) fn();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xdafcff, transparent: true, opacity: 0.4, depthWrite: false }));
  ring.position.y = -0.038; ring.userData.liquidStandIn = true; group.add(ring);
  const scene = new THREE.Scene(), part = new THREE.Scene(); part.add(group); scene.add(part); scene.background = new THREE.Color(0);
  const cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170); cam.position.set(at[0], 1.6, at[2] + 2.5); cam.lookAt(at[0], -0.05, at[2]); cam.updateMatrixWorld();
  scene.updateMatrixWorld(true);
  return { kit, group, rt, mesh, ring, rec: rt.liquids[0], scene, part, cam };
}
function fakeRenderer() {
  const log = [];
  return {
    log, autoClear: true, current: null, shadowMap: { autoUpdate: true }, state: { buffers: { depth: { setMask() {} } } },
    getPixelRatio: () => 1, getSize: (v) => v.set(1280, 800), getClearAlpha: () => 1, getClearColor: (c) => c.set(0), setClearColor() {},
    getRenderTarget() { return this.current; }, setRenderTarget(t) { this.current = t; }, clear() {}, getContext: () => ({}),
    render(scene, camera) { const drawn = []; scene.traverseVisible((o) => { if (o.material && o.layers.test(camera.layers)) drawn.push(o); }); log.push({ drawn }); },
  };
}
const target = (w = 64, h = 48) => { const t = new THREE.WebGLRenderTarget(w, h, { samples: 4 }); t.depthTexture = new THREE.DepthTexture(w, h); return t; };

test('the mark: set once, in createBasin straight after its splash ring is added, and nowhere else; read only by liquid.js', () => {
  const src = B('waterpark.js');
  assert.match(src, /  c\.add\(rippleMesh\);\n  rippleMesh\.userData\.liquidStandIn = true;\n/);
  assert.equal(src.split('liquidStandIn').length - 1, 1, 'once in waterpark.js');
  // and once in the Surge Basin, on its drawn wave (the strip, the swell's stand-in at Medium and High)
  const wave = B('rooms/wave-pool.js');
  assert.equal(wave.split('liquidStandIn').length - 1, 1, 'once in wave-pool.js');
  assert.match(wave, /crestMesh\.name = 'surge-crest';\n  crestMesh\.visible = false;\n  crestMesh\.userData\.liquidStandIn = true;/);
  // nowhere else under public/ sets or reads it, but liquid.js (which reads it)
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/vendor|knowledge|transcripts/.test(f)) walk(p); } else if (/\.m?js$/.test(f)) files.push(p); } };
  walk(new URL('../public/', import.meta.url).pathname);
  const using = files.filter((p) => readFileSync(p, 'utf8').includes('liquidStandIn')).map((p) => p.split('/public/')[1]).sort();
  assert.deepEqual(using, ['world/backrooms/liquid.js', 'world/backrooms/rooms/wave-pool.js', 'world/backrooms/waterpark.js']);
  // and waterpark.js never sets the ring's .visible: hidden for a draw, it is not fought by the room
  assert.ok(!/rippleMesh\.visible/.test(src));
});

test('the reader: hidden for the camcorder\'s draw where its room\'s surface is drawn (before the mirror), put back after', () => {
  const w = pool(), view = createLiquidView();
  assert.equal(view.frame(w.scene, w.cam, 1), true);
  const r = fakeRenderer();
  let during = null;
  view.draw(r, w.scene, w.cam, target(), () => { during = w.ring.visible; r.render(w.scene, w.cam); });
  assert.equal(during, false, 'hidden while the surface is drawn');
  for (const e of r.log) assert.ok(!e.drawn.includes(w.ring), 'in no part of the draw');
  assert.equal(w.ring.visible, true, 'and put back');
  // the order: hidden before the mirror's pass runs (so the mirror leaves it out at High too)
  const src = B('liquid.js'), d = src.slice(src.indexOf('    draw(renderer, scene, camera, target, under) {'));
  assert.ok(d.indexOf('stood.push(o)') > 0 && d.indexOf('stood.push(o)') < d.indexOf('mirrorPass(renderer'));
  assert.ok(d.indexOf('for (const o of stood) o.visible = true;') > d.indexOf('} finally {'));
  // a stand-in a room has hidden itself is left hidden (not shown by the put-back)
  w.ring.visible = false; view.draw(r, w.scene, w.cam, target(), () => r.render(w.scene, w.cam)); assert.equal(w.ring.visible, false);
  w.ring.visible = true;
  // the room's surface not drawn (looking away, past the hold; or its sheet hidden by the room): the ring is left as it is
  w.mesh.visible = false; view.frame(w.scene, w.cam, 5); view.force = 'split';
  view.draw(r, w.scene, w.cam, target(), () => { during = w.ring.visible; r.render(w.scene, w.cam); });
  assert.equal(during, true, 'a room whose surface is not drawn keeps its ring'); w.mesh.visible = true; view.force = null;
  // another room's ring, its surface not drawn (the room hides its sheet), is untouched while this one's is drawn; and a
  // room whose surface is swapped in, in view or not (as the surface itself is), has its ring hidden with it
  const other = pool({ at: [40, 0, 0] }), third = pool({ at: [-40, 0, 0] }); w.scene.add(other.part, third.part); w.scene.updateMatrixWorld(true);
  other.mesh.visible = false;
  view.frame(w.scene, w.cam, 6);
  view.draw(r, w.scene, w.cam, target(), () => { during = third.ring.visible; r.render(w.scene, w.cam); });
  assert.equal(during, false); assert.equal(third.ring.visible, true);
  view.draw(r, w.scene, w.cam, target(), () => { during = [w.ring.visible, other.ring.visible]; r.render(w.scene, w.cam); });
  assert.deepEqual(during, [false, true]);
  w.kit.dispose(); other.kit.dispose(); third.kit.dispose();
});

test('put back when a draw throws', () => {
  const w = pool(), view = createLiquidView();
  view.frame(w.scene, w.cam, 0);
  const r = fakeRenderer();
  assert.throws(() => view.draw(r, w.scene, w.cam, target(), () => { throw new Error('lost the context'); }), /lost the context/);
  assert.equal(w.ring.visible, true);
  w.kit.dispose();
});

test('at water 0: nothing reads the mark; the ring is the room\'s, as it always was', () => {
  const w = pool();
  const r = { ...fakeRenderer(), info: { autoReset: true, render: { calls: 0, triangles: 0 } } };
  const vhs = createVhs(r, w.cam, { bloom: false, level: 2, profile: profile('classic') });
  vhs.setScene(w.scene);
  assert.equal(vhs.liquids, null);
  vhs.setProfile(profile('low')); assert.equal(vhs.liquids, null);
  assert.equal(w.ring.visible, true); assert.equal(w.ring.material.opacity, 0.4);
  vhs.dispose(); w.kit.dispose();
});

test('createBasin, built as it is (the kiddie lagoon): one ring marked, never shown or hidden by the room, nothing else marked', async () => {
  const [{ buildWorld, loadCatalogue }, { generate, DECK }, { createDenizens }] = await Promise.all([
    import('../public/world/backrooms/world.js'), import('../public/world/backrooms/gen.js'), import('../public/world/backrooms/denizens.js')]);
  const id = 'kiddie-lagoon', { build } = await import(`../public/world/backrooms/rooms/${id}.js`), defn = DECK.find((a) => a.id === id), kit = createKit(), g = generate('standin', { themes: ['waterpark'] });
  const [W, D, H] = [defn.w[0], defn.d[0], defn.h[0]];
  const def = { ...g.rooms[0], id: 0, kind: 'special', arch: id, rot: 0, cx: 0, cz: 0, x: -W / 2 - 0.1, z: -D / 2 - 0.1, w: W + 0.2, d: D + 0.2, W, D, H, y: 0, shape: null, panels: [], wins: [], params: {},
    doors: ['front', ...defn.ports].map((side) => ({ side, c: 0, w: 1.4, h: 2.05, sill: 0, to: 0 })) };
  const level = { ...g, theme: 'waterpark', rooms: [def], links: [], windows: [], start: { room: 0, x: 0, z: 0 }, exit: { ...g.exit, way: 'wall' } };
  const builders = { ...(await import('../public/world/backrooms/rooms.js')).BUILDERS, [id]: build };
  const env = { kit, catalogue: await loadCatalogue(kit), level, hatches: new Map(), barricadesEnabled: true, hold() {}, play() {}, interfere() {}, sees: () => true, hear: () => ({ vol: 1, pan: 0 }),
    health: { damage: () => ({ ok: true }) }, camera: { drain: () => ({ ok: true }) }, hud: { flag() {}, glitch() {} }, run: { met() {}, survived() {} }, builders };
  createDenizens(env);
  const warn = console.warn; console.warn = () => {};
  let world; try { world = await buildWorld(kit, level, env); } finally { console.warn = warn; }
  const marked = []; world.rooms[0].group.traverse((o) => { if (o.userData?.liquidStandIn) marked.push(o); });
  assert.equal(marked.length, 1);
  assert.equal(marked[0].geometry.type, 'RingGeometry'); assert.equal(marked[0].material.color.getHex(), 0xdafcff);
  assert.equal(marked[0].parent, world.rooms[0].group); assert.equal(marked[0].visible, true);
  world.dispose(); kit.dispose();
});
