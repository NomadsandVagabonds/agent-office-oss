import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// c.prop hands out the level's own chair, monitor, keyboard, filing cabinet and box stacks (workstation.model.js,
// storage.model.js), as it does its desk: each exactly where the office's would have stood, as solid as it was and as
// movable as it was. Only the looks change. Uses the real kit, world and the office's real catalogue; only canvas
// drawing is inert, and no WebGL is needed.
const root = new URL('../', import.meta.url), three = new URL('public/vendor/three.module.min.js', root);
const loader = `export async function resolve(s,c,next){
  if(s==='three')return {url:${JSON.stringify(three.href)},shortCircuit:true};
  if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};
  return next(s,c);
}`;
register(`data:text/javascript;base64,${Buffer.from(loader).toString('base64')}`, import.meta.url);
const draw = new Proxy({}, { get: (_, name) => name === 'measureText' ? (t) => ({ width: String(t).length * 6 })
  : /Gradient|Pattern/.test(name) ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
const previousDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => draw, style: {} }) };
test.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });

const B = new URL('public/world/backrooms/', root);
const [{ buildWorld, loadCatalogue }, { createKit }, { generate }, W, S, { roomCost }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href),
  import(new URL('workstation.model.js', B).href), import(new URL('storage.model.js', B).href), import(new URL('budget.js', B).href)]);

const MINE = ['desk', 'chair', 'crt', 'keyboard', 'cabinet', 'boxes'];
const room = (id) => ({ id, kind: 'plain', x: id * 10, z: 0, w: 10, d: 10, W: 10, D: 10, H: 3, cx: id * 10 + 5, cz: 5, y: 0, rot: 0,
  look: { tube: '#fffbe0', wall: '#d2c98d' }, light: { power: 1 }, panels: [], doors: [], wins: [] });
/** One room built by `build`, with the office's real catalogue (or `catalogue(kit, real)`), the kit's model() watched. */
async function make(t, build, { barricades = false, catalogue = null } = {}) {
  const kit = createKit(), models = [], model = kit.model;
  kit.model = (key, mk, opt) => { models.push({ key, make: mk, opt }); return model(key, mk, opt); };
  const real = await loadCatalogue(kit), env = { catalogue: catalogue ? catalogue(kit, real) : real, barricadesEnabled: barricades, builders: { plain: (c) => build(c) } };
  const world = await buildWorld(kit, { seed: 'workstation', rooms: [room(0)], links: [], windows: [] }, env);
  t.after(() => { world.dispose(); kit.dispose(); });
  return { world, kit, models, rt: world.rooms[0], catalogue: env.catalogue };
}
/** The office's own model of a type, put down by hand where c.prop puts it: what c.prop drew before. */
const office = (c, type, x, z, opt = {}) => c.place(c.env.catalogue.geo(type, opt.o), x, z, { ...opt, furnitureType: type });
const meshes = (o) => { const out = []; o.traverse((m) => { if (m.isMesh && m.geometry) out.push(m); }); return out; };
const tris = (g) => g.solid.index.count / 3;
// (every way a room puts one of these down: turned, raised, flipped onto a ceiling, tilted, scaled)
const POSES = [{}, { rot: 0.7 }, { rot: Math.PI / 2, y: 0.4 }, { flip: true, y: 2.9, rot: 0.28 }, { tilt: [1.2, 0.43], rot: -0.52, y: 0.3 }, { scale: 0.92, rot: 2 }, { scale: [1, 1.2, 0.9] }];

test('each of the six is the level\'s own where the catalogue has it, the office\'s other things are the office\'s, and a crate where there is none', async (t) => {
  const { models } = await make(t, (c) => {
    for (const type of MINE) c.prop(type, 0, 0);
    c.prop('mouse', 1, 1);
  });
  const keys = models.map((m) => m.key);
  for (const key of ['level:desk', 'level:chair:', 'level:crt', 'level:keyboard', 'level:keyboard:keys', 'level:cabinet', 'level:boxes:0']) assert.ok(keys.includes(key), key);
  assert.ok(models.filter((m) => m.key.startsWith('level:')).every((m) => m.opt?.ao === false), 'meshed with no corner shading, as the desk is');
  for (const type of MINE) assert.ok(!keys.some((k) => k.startsWith(`prop:${type}:`)), `the office's ${type} is not meshed`);
  assert.ok(keys.includes('prop:mouse:'), 'anything else is still the office\'s');
  // a catalogue without them: nothing of the level's is handed out, and each is the plain crate it always was
  const none = await make(t, (c) => { for (const type of MINE) assert.equal(c.prop(type, 0, 0).h, 0.8); }, { catalogue: () => ({ has: () => false, entry: () => null, geo: () => null }) });
  assert.ok(!none.models.some((m) => m.key.startsWith('level:')));
});

test('bounds, foot and collider are the office\'s, to the bit, in every pose a room uses', async (t) => {
  const ws = W.WORKSTATION.bounds, st = S.STORAGE.bounds, own = { chair: ws.chair, crt: ws.crt, keyboard: ws.keyboard, cabinet: st.cabinet };
  const { kit, catalogue } = await make(t, () => {});
  for (const [type, b] of Object.entries(own)) {
    const off = catalogue.geo(type, {}).bounds;
    for (const k of ['x0', 'y0', 'z0', 'x1', 'y1', 'z1']) assert.equal(b[k], off[k] * 2, `${type} ${k}`);
  }
  for (const n of [0, 1, 2]) {
    const mine = kit.model(`t:boxes:${n}`, () => S.boxesVox(n), { ao: false }).bounds, b = st.boxes[n];
    for (const k of ['x0', 'y0', 'z0', 'x1', 'y1', 'z1']) assert.equal(mine[k], b[k], `boxes ${n} meshes to its stated bounds`);
  }
  for (const barricades of [false, true]) {
    const got = [], want = [];
    const a = await make(t, (c) => { for (const type of MINE) for (const opt of POSES) { const n = c.rt.colliders.length; got.push([c.prop(type, 1, -1, { ...opt }), c.rt.colliders.slice(n)]); } }, { barricades });
    const b = await make(t, (c) => { for (const type of MINE) for (const opt of POSES) { const n = c.rt.colliders.length; want.push([office(c, type, 1, -1, { ...opt }), c.rt.colliders.slice(n)]); } }, { barricades });
    assert.equal(got.length, MINE.length * POSES.length);
    assert.deepEqual(got, want, `feet and colliders as placed (barricades ${barricades})`);
    assert.deepEqual(a.rt.colliders, b.rt.colliders, 'and as the room keeps them');
  }
});

test('the chair is in the cloth the office\'s would have been, its own blue where there is none; its mesh is shared by colour', async (t) => {
  const { models } = await make(t, (c) => {
    c.prop('chair', 0, 0, { o: { color: '#b5483f' } }); c.prop('chair', 1, 0, { o: { color: '#b5483f' } });
    c.prop('chair', 2, 0, { o: { color: '' } }); c.prop('chair', 3, 0);
  });
  const chairs = models.filter((m) => m.key.startsWith('level:chair:'));
  assert.deepEqual([...new Set(chairs.map((m) => m.key))].sort(), ['level:chair:', 'level:chair:#b5483f']);
  const { kit } = await make(t, () => {});
  let n = 0;
  const colour = (make) => [...kit.model(`t:chair:${n++}`, make, { ao: false }).solid.attributes.color.array].join();
  const red = colour(chairs.find((m) => m.key.endsWith('#b5483f')).make), blue = colour(chairs.find((m) => m.key === 'level:chair:').make);
  assert.equal(red, colour(() => W.chairVox({ colour: '#b5483f' })), 'the cloth carried');
  assert.equal(blue, colour(() => W.chairVox()), 'no colour, or an empty one: the office\'s own blue');
  assert.notEqual(red, blue);
});

test('a stack of boxes is the one of three the office would have picked for the same layout object', async (t) => {
  const os = [{}, ...Array.from({ length: 12 }, (_, i) => ({ variant: i })), { id: 'boxes:7' }, { id: 'room-3-store' }, { variant: 'x', id: 'q' }];
  const { models, catalogue } = await make(t, (c) => { os.forEach((o, i) => c.prop('boxes', (i % 5) - 2, Math.floor(i / 5) - 1, { o })); });
  const picked = models.filter((m) => m.key.startsWith('level:boxes:') && !models.slice(0, models.indexOf(m)).some((p) => p.key === m.key));
  assert.ok(picked.length >= 1);
  const entry = catalogue.entry('boxes'), seen = new Set();
  for (const o of os) {
    const n = Number(entry.variant({ id: `boxes:${o.variant ?? 'backrooms'}`, type: 'boxes', ...o }));
    seen.add(n);
    // the office's mesh for this object is keyed by the same pick, and is the same arrangement, by its bounds
    const off = catalogue.geo('boxes', o).bounds, mine = S.STORAGE.bounds.boxes[n];
    for (const k of ['x0', 'y0', 'z0', 'x1', 'y1', 'z1']) assert.equal(mine[k], off[k] * 2, `pick ${n} ${k}`);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2], 'all three come up');
  assert.deepEqual(new Set(models.filter((m) => m.key.startsWith('level:boxes:')).map((m) => Number(m.key.at(-1)))), seen);
  // and each keeps its own collider: as the office's stack for the same object
  const got = [], want = [];
  await make(t, (c) => { for (const o of os) got.push(c.prop('boxes', 0, 0, { o, rot: 0.4 })); });
  await make(t, (c) => { for (const o of os) want.push(office(c, 'boxes', 0, 0, { o, rot: 0.4 })); });
  assert.deepEqual(got, want);
});

test('a keyboard\'s keys are detail, laid over its case; one batch of them a room, however many keyboards', async (t) => {
  const keysTris = (k) => tris(k.model('level:keyboard:keys', W.keyboardKeysVox, { ao: false }));
  const keyboards = (n) => (c) => { for (let i = 0; i < n; i++) c.prop('keyboard', -3 + i, 2, { y: 0.4, rot: i, solid: false }); };
  const one = await make(t, keyboards(1)), five = await make(t, keyboards(5)), none = await make(t, () => {});
  const cost = (w) => roomCost(w.rt.group);
  assert.equal(cost(none).detailMeshes, 0);
  assert.equal(cost(one).detailMeshes, 1, 'the keys: one detail mesh');
  assert.equal(cost(five).detailMeshes, 1, 'five keyboards: still one');
  assert.equal(cost(five).meshes, cost(one).meshes, 'no ordinary mesh gained per keyboard');
  assert.equal(cost(one).detailTriangles, keysTris(one.kit));
  assert.equal(cost(five).detailTriangles, 5 * keysTris(five.kit));
  // laid over the case: the same place, turn and scale, so every key is inside the case's own box
  const k = meshes(one.rt.group).find((m) => m.userData.detail);
  k.geometry.computeBoundingBox();
  const bb = k.geometry.boundingBox, foot = { x0: -3 - 0.3, x1: -3 + 0.3, z0: 2 - 0.1, z1: 2 + 0.1 };
  assert.ok(bb.min.x >= foot.x0 && bb.max.x <= foot.x1 && bb.min.z >= foot.z0 && bb.max.z <= foot.z1 && bb.min.y >= 0.4 && bb.max.y <= 0.4 + 6 * 0.0125 + 1e-9, JSON.stringify(bb));
  // nothing of the keys stands in the room: no collider, no use
  const plain = await make(t, (c) => { c.prop('keyboard', -3, 2, { y: 0.4, solid: false }); });
  assert.deepEqual(plain.rt.colliders, (await make(t, (c) => { office(c, 'keyboard', -3, 2, { y: 0.4, solid: false }); })).rt.colliders);
});

test('with barricades on, a keyboard on a desk that can be dragged is carried as it was, its case and no keys: none are left behind', async (t) => {
  const scene = (put) => (c) => {
    const desk = put(c, 'desk', 0, 0, {});
    put(c, 'crt', 0.05, 0.12, { y: desk.top, solid: false });
    put(c, 'keyboard', 0, -0.2, { y: desk.top, solid: false });
    put(c, 'chair', 0, -0.9, { rot: Math.PI });
    const bolted = put(c, 'desk', -3, 2, { fixed: true });                      // a desk bolted down: what is on it stays in the room
    put(c, 'keyboard', -3, 1.8, { y: bolted.top, solid: false });
    put(c, 'keyboard', 3, 3, { y: 0.4, solid: false });                         // and one on a shelf of the room's own
  };
  const mine = await make(t, scene((c, type, x, z, opt) => c.prop(type, x, z, opt)), { barricades: true });
  const was = await make(t, scene((c, type, x, z, opt) => office(c, type, x, z, opt)), { barricades: true });
  const { world, rt, kit } = mine, desk = world.furniture.find((f) => f.type === 'desk'), chair = world.furniture.find((f) => f.type === 'chair');
  assert.ok(desk && chair, 'the desk and the chair can be dragged, as before');
  assert.deepEqual(world.furniture.map((f) => [f.type, meshes(f.group).length]), was.world.furniture.map((f) => [f.type, meshes(f.group).length]), 'each carries as many meshes as before');
  assert.equal(meshes(desk.group).filter((m) => m.userData.detail).length, 0, 'no keys on the carried desk');
  // the carried desk's own vox mesh is the desk, the monitor and the keyboard's case
  const solidTris = (key, mk) => tris(kit.model(key, mk, { ao: false }));
  const deskTris = meshes(desk.group).filter((m) => m.renderOrder === 0).reduce((n, m) => n + m.geometry.index.count / 3, 0);
  assert.equal(deskTris, tris(kit.model('level:desk')) + solidTris('level:crt', W.crtVox) + solidTris('level:keyboard', W.keyboardVox), 'the desk, the monitor and the case travel together');
  const inRoom = meshes(rt.group).filter((m) => m.userData.detail);
  assert.equal(inRoom.length, 1, 'the keys of the keyboards that stay put: one mesh');
  assert.equal(inRoom[0].geometry.index.count / 3, 2 * solidTris('level:keyboard:keys', W.keyboardKeysVox), 'on the bolted desk and on the shelf');
  // nothing of the keys is where the carried keyboard was
  inRoom[0].geometry.computeBoundingBox();
  const bb = inRoom[0].geometry.boundingBox;
  assert.ok(bb.min.x > -3.5 && !(bb.min.x < 0.35 && bb.max.x > -0.35 && bb.min.z < -0.05 && bb.max.z > -0.35 && bb.max.x < 0.35), 'no keys left floating over the carried desk');
  // a keyboard drawn into a batch a room gives it (as a room that moves its scenery does) is its case alone
  const own = await make(t, (c) => { const b = new (c.vox.constructor)(true); c.prop('keyboard', 0, 0, { batch: b, solid: false }); c.dynamic(b); }, { barricades: true });
  assert.equal(meshes(own.rt.group).filter((m) => m.userData.detail).length, 0);
});

test('what can be dragged registers as before: the same furniture, feet, tops and colliders, with and without the level\'s models', async (t) => {
  const scene = (put) => (c) => {
    const d = put(c, 'desk', 0, 0, {}); put(c, 'crt', 0.05, 0.12, { y: d.top, solid: false }); put(c, 'keyboard', 0, -0.2, { y: d.top, solid: false });
    put(c, 'chair', 0, -0.9, { rot: Math.PI, o: { color: '#3f7f9a' } }); put(c, 'chair', 2, 2, { y: -0.35 }); put(c, 'chair', 2, 2, { y: 2.9, flip: true });
    put(c, 'cabinet', -3, 3, { rot: 0.3 }); put(c, 'boxes', 3, -3, { o: { variant: 2 } }); put(c, 'chair', -2, -2, { tilt: [1.2, 0.4] });
  };
  const rec = (w) => w.furniture.map((f) => ({ id: f.id, type: f.type, x: f.x, z: f.z, x0: f.x0, z0: f.z0, x1: f.x1, z1: f.z1, y: f.y, top: f.top, surfaceY: f.surfaceY,
    collider: [f.collider.x0, f.collider.z0, f.collider.x1, f.collider.z1, f.collider.top, f.collider.on, f.collider.tall], fixed: f.placement.fixed, uses: f.attachments.length }));
  const a = await make(t, scene((c, type, x, z, opt) => c.prop(type, x, z, opt)), { barricades: true });
  const b = await make(t, scene((c, type, x, z, opt) => office(c, type, x, z, opt)), { barricades: true });
  assert.deepEqual(rec(a.world), rec(b.world));
  assert.ok(a.world.furniture.some((f) => f.type === 'chair') && a.world.furniture.some((f) => f.type === 'desk'), 'a chair and a desk can be dragged');
  assert.deepEqual(a.rt.colliders.map((k) => ({ ...k })), b.rt.colliders.map((k) => ({ ...k })));
});

test('generation does not move, and a room reads nothing more from its seeded source for the level\'s models', async (t) => {
  const a = JSON.stringify(generate(7)), draws = [];
  const build = (put) => (c) => { put(c); draws.push(c.R()); };
  await make(t, build((c) => { for (const type of MINE) for (const opt of POSES) c.prop(type, 0, 0, { ...opt, o: { color: '#556677', variant: 3 } }); }));
  await make(t, build(() => {}));
  assert.equal(draws[0], draws[1], 'the next number the room draws is the one it would have drawn');
  assert.equal(JSON.stringify(generate(7)), a);
});
