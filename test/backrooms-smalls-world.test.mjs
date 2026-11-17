import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// c.prop hands out the level's own bin and trolley (smalls.model.js), as it does its desk and chair: each exactly where
// the office's would have stood, as solid as it was, and the trolley as draggable as it was. The water cooler stays the
// office's: the level's bottle is twice the glass. Uses the real kit, world and the office's real catalogue; only canvas
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
const [{ buildWorld, loadCatalogue }, { createKit }, { generate }, S, { createFurnitureMotion }, { createFurnitureGrip }, { createPlayer }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('smalls.model.js', B).href),
  import(new URL('furniture-motion.js', B).href), import(new URL('furniture-grip.js', B).href), import(new URL('player.js', B).href)]);

const MINE = { bin: ['level:bin', S.binVox], trolley: ['level:trolley', S.trolleyVox] };
const room = (id) => ({ id, kind: 'plain', x: id * 10, z: 0, w: 10, d: 10, W: 10, D: 10, H: 3, cx: id * 10 + 5, cz: 5, y: 0, rot: 0,
  look: { tube: '#fffbe0', wall: '#d2c98d' }, light: { power: 1 }, panels: [], doors: [], wins: [] });
async function make(t, build, { barricades = false } = {}) {
  const kit = createKit(), models = [], model = kit.model;
  kit.model = (key, mk, opt) => { models.push({ key, make: mk, opt }); return model(key, mk, opt); };
  const env = { catalogue: await loadCatalogue(kit), barricadesEnabled: barricades, builders: { plain: (c) => build(c) } };
  const world = await buildWorld(kit, { seed: 'smalls', rooms: [room(0)], links: [], windows: [] }, env);
  env.world = world;
  t.after(() => { world.dispose(); kit.dispose(); });
  return { world, kit, models, rt: world.rooms[0], catalogue: env.catalogue };
}
/** The office's own model of a type, put down by hand where c.prop puts it: what c.prop drew before. */
const office = (c, type, x, z, opt = {}) => c.place(c.env.catalogue.geo(type, opt.o), x, z, { ...opt, furnitureType: type });
const meshes = (o) => { const out = []; o.traverse((m) => { if (m.isMesh && m.geometry) out.push(m); }); return out; };
const tris = (g) => (g ? g.index.count / 3 : 0);
const POSES = [{}, { rot: 0.7 }, { rot: Math.PI / 2, y: 0.4 }, { flip: true, y: 2.9, rot: 0.28 }, { tilt: [1.2, 0.43], rot: -0.52, y: 0.3 }, { scale: 0.92, rot: 2 }, { scale: [1, 1.2, 0.9] }];

test('the bin and the trolley are the level\'s own, meshed without corner shading; the cooler is still the office\'s', async (t) => {
  const { models } = await make(t, (c) => { c.prop('bin', 0, 0); c.prop('trolley', 2, 0); c.prop('cooler', -2, 0); });
  const keys = models.map((m) => m.key);
  for (const [key] of Object.values(MINE)) assert.ok(keys.includes(key), key);
  assert.ok(models.filter((m) => m.key.startsWith('level:')).every((m) => m.opt?.ao === false));
  for (const type of Object.keys(MINE)) assert.ok(!keys.some((k) => k.startsWith(`prop:${type}:`)), `the office's ${type} is not meshed`);
  assert.ok(keys.includes('prop:cooler:') && !keys.includes('level:cooler'), 'the cooler is the office\'s');
  // a catalogue without them: nothing of the level's, and each is the plain crate it always was
  const kit = createKit(); t.after(() => kit.dispose());
  const empty = { has: () => false, entry: () => null, geo: () => null };
  const w = await buildWorld(kit, { seed: 'smalls', rooms: [room(0)], links: [], windows: [] }, { catalogue: empty, builders: { plain: (c) => { for (const type of Object.keys(MINE)) assert.equal(c.prop(type, 0, 0).h, 0.8); } } });
  w.dispose();
});

// (the cooler was held back because its bottle was over a thousand glass triangles more a cooler, and a corridor stands ten or
//  more of them. The cast made the bottle lighter than the office's the same hour this test was written, and the two met in the
//  lead's merge: so what is pinned now is that the reason is gone. The switch itself is still the builder's to make, with its proof.)
test('the cooler is not swapped yet, and its bottle is no longer the reason: it is no heavier in glass than the office\'s', async (t) => {
  const { kit, catalogue } = await make(t, () => {});
  const mine = kit.model('t:cooler', S.coolerVox, { ao: false }), theirs = catalogue.geo('cooler', {});
  assert.ok(tris(mine.glass) <= tris(theirs.glass), `${tris(mine.glass)} against ${tris(theirs.glass)}`);
});

test('bounds, foot and collider are the office\'s, to the bit, in every pose', async (t) => {
  const { kit, catalogue } = await make(t, () => {});
  for (const [type, [, vox]] of Object.entries(MINE)) {
    const off = catalogue.geo(type, {}).bounds, mine = kit.model(`t:${type}`, vox, { ao: false }).bounds;
    for (const k of ['x0', 'y0', 'z0', 'x1', 'y1', 'z1']) { assert.equal(mine[k], off[k] * 2, `${type} ${k}`); assert.equal(S.SMALLS.bounds[type][k], mine[k]); }
  }
  for (const barricades of [false, true]) {
    const got = [], want = [];
    const a = await make(t, (c) => { for (const type of Object.keys(MINE)) for (const opt of POSES) { const n = c.rt.colliders.length; got.push([c.prop(type, 1, -1, { ...opt }), c.rt.colliders.slice(n)]); } }, { barricades });
    const b = await make(t, (c) => { for (const type of Object.keys(MINE)) for (const opt of POSES) { const n = c.rt.colliders.length; want.push([office(c, type, 1, -1, { ...opt }), c.rt.colliders.slice(n)]); } }, { barricades });
    assert.deepEqual(got, want, `feet and colliders as placed (barricades ${barricades})`);
    assert.deepEqual(a.rt.colliders, b.rt.colliders);
  }
});

test('the bin is the office\'s blue whatever colour a room hands it (the museum hands every exhibit one), as the office\'s is', async (t) => {
  const { models, kit } = await make(t, (c) => { c.prop('bin', 0, 0, { o: { color: '#4a7a6a' } }); c.prop('bin', 1, 0); });
  const bins = models.filter((m) => m.key.startsWith('level:bin'));
  assert.deepEqual([...new Set(bins.map((m) => m.key))], ['level:bin']);
  const colour = (g) => [...g.solid.attributes.color.array].join();
  assert.equal(colour(kit.model('level:bin')), colour(kit.model('t:bin', () => S.binVox({ colour: '#3f7f9a' }), { ao: false })));
});

test('tint and noGlow act on them as on anything c.place puts down, and neither has glass or glow to lose', async (t) => {
  const tint = [0.3, 0.5, 0.7], got = {};
  await make(t, (c) => {
    for (const type of Object.keys(MINE)) for (const [name, opt] of [['plain', {}], ['dim', { tint, noGlow: true }]]) {
      const a = c.vox.alb.length, s = c.vox.sf.length, g = c.glass.pos.length;
      c.prop(type, 0, 0, { ...opt, shadow: false, solid: false });
      got[`${type}:${name}`] = { alb: c.vox.alb.slice(a), sf: c.vox.sf.slice(s), glass: c.glass.pos.length - g };
    }
  });
  for (const type of Object.keys(MINE)) {
    const p = got[`${type}:plain`], d = got[`${type}:dim`];
    assert.ok(p.alb.length > 0 && p.alb.length === d.alb.length);
    for (let i = 0; i < p.alb.length; i++) assert.ok(Math.abs(d.alb[i] - p.alb[i] * tint[i % 3]) < 1e-6, `${type} tinted at ${i}`);
    assert.equal(p.glass + d.glass, 0, `${type}: no glass`);
    for (let i = 1; i < p.sf.length; i += 2) assert.equal(p.sf[i], 0, `${type}: nothing shines`);
  }
});

test('the trolley can be dragged as a barricade and set down, as the office\'s was: the same registration, the same drag, its own mesh carried', async (t) => {
  const scene = (put) => (c) => { put(c, 'trolley', 0, 1.5, {}); put(c, 'trolley', -3, -3, { rot: 0.6 }); put(c, 'bin', 3, 3, {}); };
  const rec = (w) => w.furniture.map((f) => ({ type: f.type, x: f.x, z: f.z, x0: f.x0, z0: f.z0, x1: f.x1, z1: f.z1, y: f.y, top: f.top,
    collider: [f.collider.x0, f.collider.z0, f.collider.x1, f.collider.z1, f.collider.top, f.collider.on, f.collider.tall], fixed: f.placement.fixed }));
  const drag = async (put) => {
    const m = await make(t, scene(put), { barricades: true }), { world } = m, cart = world.furniture[0];
    const input = { keys: new Set(), dx: 0, dy: 0, stick: { x: 0, y: 0 } }, camera = { position: { set() {} }, rotation: { set() {} } };
    const player = createPlayer(world, camera, { x: cart.x, z: cart.z - 0.8, yaw: Math.PI }, input);
    world.env.player = player; Object.assign(player.me, { y: 1.1, pitch: -0.5 });
    const grip = createFurnitureGrip(world, createFurnitureMotion(world));
    player.on('move', (dx, dz, step) => grip.step(dx, dz, step));
    const tick = (n) => { for (let i = 0; i < n; i++) { grip.update(0.05, player.me); player.update(0.05); } };
    grip.update(0, player.me);
    const out = { m, registered: rec(world), target: grip.target === cart, took: grip.use(), carriedOff: cart.collider.on === false };
    input.keys.add('s'); tick(16); input.keys.clear(); input.keys.add('d'); tick(6); input.keys.clear();
    out.set = grip.use(); out.after = rec(world); out.onAgain = cart.collider.on;
    return out;
  };
  const mine = await drag((c, type, x, z, opt) => c.prop(type, x, z, opt)), was = await drag((c, type, x, z, opt) => office(c, type, x, z, opt));
  assert.deepEqual(mine.registered, was.registered, 'registered as before');
  assert.deepEqual(mine.registered.map((f) => f.type), ['trolley', 'trolley'], 'both trolleys can be dragged; the bin cannot');
  assert.equal(mine.target && mine.took && mine.carriedOff, true, 'taken hold of');
  assert.equal(mine.set && mine.onAgain, true, 'set down, solid again');
  assert.ok(Math.hypot(mine.after[0].x - mine.registered[0].x, mine.after[0].z - mine.registered[0].z) > 0.4, 'it moved');
  assert.deepEqual(mine.after, was.after, 'dragged and set down exactly where the office\'s was');
  // what it carries is its own model: the level's trolley, and nothing of the office's
  const cart = mine.m.world.furniture[0], carried = meshes(cart.group).filter((o) => o.renderOrder === 0).reduce((n, o) => n + tris(o.geometry), 0);
  assert.equal(carried, tris(mine.m.kit.model('level:trolley').solid));
});

test('generation does not move, and a room reads nothing more from its seeded source for them', async (t) => {
  const a = JSON.stringify(generate(7)), draws = [];
  const build = (put) => (c) => { put(c); draws.push(c.R()); };
  await make(t, build((c) => { for (const type of [...Object.keys(MINE), 'cooler']) for (const opt of POSES) c.prop(type, 0, 0, { ...opt, o: { color: '#556677', variant: 3 } }); }));
  await make(t, build(() => {}));
  assert.equal(draws[0], draws[1]);
  assert.equal(JSON.stringify(generate(7)), a);
});
