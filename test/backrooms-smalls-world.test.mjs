import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// c.prop hands out the level's own bin, trolley and water cooler (smalls.model.js), as it does its desk and chair: each
// exactly where the office's would have stood, as solid as it was, and the trolley as draggable as it was. The cooler's
// bottle goes into the room's glass, and a room's tint, noGlow and shadow act on it as on the office's. Uses the real kit, world and the office's real catalogue; only canvas
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
const [{ buildWorld, loadCatalogue }, { createKit }, { generate }, S, { createFurnitureMotion }, { createFurnitureGrip }, { createPlayer }, { BUILDERS }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('smalls.model.js', B).href),
  import(new URL('furniture-motion.js', B).href), import(new URL('furniture-grip.js', B).href), import(new URL('player.js', B).href), import(new URL('rooms.js', B).href)]);

const MINE = { bin: ['level:bin', S.binVox], trolley: ['level:trolley', S.trolleyVox], cooler: ['level:cooler', S.coolerVox] };
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

test('the bin, the trolley and the cooler are the level\'s own, meshed without corner shading', async (t) => {
  const { models } = await make(t, (c) => { c.prop('bin', 0, 0); c.prop('trolley', 2, 0); c.prop('cooler', -2, 0); });
  const keys = models.map((m) => m.key);
  for (const [key] of Object.values(MINE)) assert.ok(keys.includes(key), key);
  assert.ok(models.filter((m) => m.key.startsWith('level:')).every((m) => m.opt?.ao === false));
  for (const type of Object.keys(MINE)) assert.ok(!keys.some((k) => k.startsWith(`prop:${type}:`)), `the office's ${type} is not meshed`);
  // a catalogue without them: nothing of the level's, and each is the plain crate it always was
  const kit = createKit(); t.after(() => kit.dispose());
  const empty = { has: () => false, entry: () => null, geo: () => null };
  const w = await buildWorld(kit, { seed: 'smalls', rooms: [room(0)], links: [], windows: [] }, { catalogue: empty, builders: { plain: (c) => { for (const type of Object.keys(MINE)) assert.equal(c.prop(type, 0, 0).h, 0.8); } } });
  w.dispose();
});

// (the cooler was held back while its bottle was over a thousand glass triangles more than the office's; the cast made it
//  lighter than the office's, and it is swapped. What it costs to draw is pinned in backrooms-smalls.test.mjs)
test('the cooler\'s bottle is no heavier in glass than the office\'s', async (t) => {
  const { kit, catalogue } = await make(t, () => {});
  const mine = kit.model('level:cooler', S.coolerVox, { ao: false }), theirs = catalogue.geo('cooler', {});
  assert.ok(tris(mine.glass) > 0 && tris(mine.glass) <= tris(theirs.glass), `${tris(mine.glass)} against ${tris(theirs.glass)}`);
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

test('tint and noGlow act on the bin and the trolley as on anything c.place puts down, and neither has glass or glow to lose', async (t) => {
  const tint = [0.3, 0.5, 0.7], got = {};
  await make(t, (c) => {
    for (const type of ['bin', 'trolley']) for (const [name, opt] of [['plain', {}], ['dim', { tint, noGlow: true }]]) {
      const a = c.vox.alb.length, s = c.vox.sf.length, g = c.glass.pos.length;
      c.prop(type, 0, 0, { ...opt, shadow: false, solid: false });
      got[`${type}:${name}`] = { alb: c.vox.alb.slice(a), sf: c.vox.sf.slice(s), glass: c.glass.pos.length - g };
    }
  });
  for (const type of ['bin', 'trolley']) {
    const p = got[`${type}:plain`], d = got[`${type}:dim`];
    assert.ok(p.alb.length > 0 && p.alb.length === d.alb.length);
    for (let i = 0; i < p.alb.length; i++) assert.ok(Math.abs(d.alb[i] - p.alb[i] * tint[i % 3]) < 1e-6, `${type} tinted at ${i}`);
    assert.equal(p.glass + d.glass, 0, `${type}: no glass`);
    for (let i = 1; i < p.sf.length; i += 2) assert.equal(p.sf[i], 0, `${type}: nothing shines`);
  }
});

/** One cooler put down by `put` with `opt`, and what it added: the solid batch's colours and glowing vertices, the glass
 * batch's vertices and colours, the floor's blots. */
function coolerInto(c, put, opt) {
  const a = c.vox.alb.length, s = c.vox.sf.length, g = c.glass.pos.length, ga = c.glass.alb.length, d = c.decals.col.length;
  put(c, 'cooler', 0, 0, { rot: Math.PI / 2, solid: false, ...opt });
  const sf = c.vox.sf.slice(s);
  return { alb: c.vox.alb.slice(a), glow: sf.filter((v, i) => i % 2 === 1 && v > 0).length, glass: (c.glass.pos.length - g) / 3, galb: c.glass.alb.slice(ga), blots: c.decals.col.slice(d) };
}
test('the cooler: its glass goes to the room\'s glass batch; tint, noGlow and shadow act on it as on the office\'s', async (t) => {
  const OPTS = { plain: {}, dim: { tint: [0.4, 0.4, 0.4], noGlow: true, shadow: false }, lit: { tint: [0.95, 0.95, 0.95], noGlow: false, shadow: 0.4 } };
  const got = {};
  const { kit } = await make(t, (c) => {
    for (const [who, put] of [['mine', (c, ...a) => c.prop(...a)], ['office', office]]) for (const [name, opt] of Object.entries(OPTS)) got[`${who}:${name}`] = coolerInto(c, put, opt);
  });
  const lvl = kit.model('level:cooler');
  for (const who of ['mine', 'office']) {
    const p = got[`${who}:plain`], d = got[`${who}:dim`], l = got[`${who}:lit`];
    assert.ok(p.glow > 0 && l.glow === p.glow, `${who}: the tap lights shine, and still do in the lit end`);
    assert.equal(d.glow, 0, `${who}: noGlow puts the tap lights out`);
    assert.ok(p.glass > 0, `${who}: the bottle is in the room's glass`);
    for (let i = 0; i < p.alb.length; i++) assert.ok(Math.abs(d.alb[i] - p.alb[i] * 0.4) < 1e-6, `${who}: solid tinted at ${i}`);
    for (let i = 0; i < p.galb.length; i++) assert.ok(Math.abs(d.galb[i] - p.galb[i] * 0.4) < 1e-6, `${who}: glass tinted at ${i}`);
    assert.equal(d.blots.length, 0, `${who}: shadow false: no blot`);
    assert.equal(l.blots.length, 16, `${who}: one blot`);
    assert.ok(l.blots.filter((_, i) => i % 4 === 3).every((a) => a === 0.4), `${who}: at the strength asked for`);
    assert.equal(p.blots[3], 0.45, `${who}: the default blot`);
  }
  assert.equal(got['mine:plain'].glass, lvl.glass.attributes.position.count, 'the level\'s bottle, all of it, into the glass');
  assert.equal(got['mine:plain'].alb.length / 3, lvl.solid.attributes.position.count, 'the level\'s cabinet into the solid batch');
  assert.deepEqual(got['mine:lit'].blots, got['office:lit'].blots, 'the blot is the office\'s: the same size and place');
  // the glow is the two tap lights and nothing else: every glowing vertex of the model is up at them
  const pos = lvl.solid.attributes.position, em = lvl.solid.attributes.aEmis;
  let n = 0;
  for (let i = 0; i < pos.count; i++) if (em.getX(i) > 0) { n++; assert.ok(pos.getY(i) >= 50 && pos.getY(i) <= 52 && pos.getZ(i) >= 14, `glow at ${pos.getX(i)},${pos.getY(i)},${pos.getZ(i)}`); }
  assert.equal(got['mine:plain'].glow, n);
});

test('the coolers corridor: the same coolers lit and dimmed as with the office\'s, the dimmed ones dark, one bubbling', async (t) => {
  const g = generate('smalls', { only: ['coolers'] }), d0 = g.rooms.find((r) => r.arch === 'coolers');
  const def = { ...d0, id: 0, x: -d0.w / 2, z: -d0.d / 2, cx: 0, cz: 0, y: 0, doors: [], links: [], wins: [] };
  const build = async (swap) => {
    const kit = createKit(), calls = [];
    const env = { catalogue: await loadCatalogue(kit), level: g, barricadesEnabled: true, play() {}, builders: { coolers: (c) => {
      const prop = c.prop;
      c.prop = (type, x, z, opt = {}) => {
        if (type !== 'cooler') return prop(type, x, z, opt);
        const s = c.vox.sf.length, foot = swap ? prop(type, x, z, opt) : office(c, type, x, z, opt), sf = c.vox.sf.slice(s);
        calls.push({ noGlow: !!opt.noGlow, tint: opt.tint[0], shadow: opt.shadow, glow: sf.filter((v, i) => i % 2 === 1 && v > 0).length, foot });
        return foot;
      };
      return BUILDERS.coolers(c);
    } } };
    const world = await buildWorld(kit, { ...g, rooms: [def], links: [], windows: [] }, env);
    t.after(() => { world.dispose(); kit.dispose(); });
    let bubbles = 0; world.rooms[0].group.traverse((o) => { if (o.isMesh && o.geometry?.type === 'SphereGeometry') bubbles++; });
    return { calls, bubbles, colliders: world.rooms[0].colliders.map((k) => ({ ...k })) };
  };
  const mine = await build(true), was = await build(false);
  assert.ok(mine.calls.length >= 10, `${mine.calls.length} coolers`);
  assert.deepEqual(mine.calls.map((k) => [k.noGlow, k.tint, k.shadow, k.foot]), was.calls.map((k) => [k.noGlow, k.tint, k.shadow, k.foot]), 'the same coolers, the same options, the same feet');
  assert.ok(mine.calls.some((k) => k.noGlow) && mine.calls.some((k) => !k.noGlow), 'some lit, some dimmed');
  for (const k of mine.calls) assert.equal(k.glow > 0, !k.noGlow, `a cooler at ${k.tint.toFixed(2)} ${k.noGlow ? 'is dark' : 'shines'}`);
  assert.deepEqual(mine.calls.map((k) => k.glow > 0), was.calls.map((k) => k.glow > 0), 'shining where the office\'s shone');
  assert.equal(mine.bubbles, 5, 'one cooler bubbling'); assert.equal(was.bubbles, 5);
  assert.deepEqual(mine.colliders, was.colliders);
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
  await make(t, build((c) => { for (const type of Object.keys(MINE)) for (const opt of POSES) c.prop(type, 0, 0, { ...opt, o: { color: '#556677', variant: 3 } }); }));
  await make(t, build(() => {}));
  assert.equal(draws[0], draws[1]);
  assert.equal(JSON.stringify(generate(7)), a);
});
