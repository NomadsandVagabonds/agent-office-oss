import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// The tubes' shadows, baked per room into a small light map of its floor and walls (shadowmap.js, kit.js gfxOf
// `shadows`, world.js shadowRoom). Off unless asked for, and then nothing of it runs; on, the vertex bake is untouched
// and the map only ever takes light away, group by group. Uses the real kit, world, rooms and catalogue; only canvas
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
const [{ buildWorld, loadCatalogue }, { createKit, gfxOf, lamp, lightAt }, { generate, ARCHETYPES, toWorld }, makers, SM, { profile }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('public/world/props/office.js', root).href),
  import(new URL('shadowmap.js', B).href), import(new URL('graphics.js', B).href)]);
const { mapLayout, bakeShadows, packShadows, sampleMap, SHADOWS } = SM;

const catalogueOf = (kit) => ({ has: (type) => typeof makers[type] === 'function', entry: () => null, geo: (type) => (makers[type] ? kit.model(type, makers[type]) : null) });
/** The same furnished floor as backrooms-gfx-bake.test.mjs: its shell, a cabinet, a crate, a desk, a chair and a pillar where the seed puts them. */
const furnish = (c) => {
  c.shell();
  const a = c.spot(0.6); if (a) c.prop('cabinet', a.x, a.z);
  const b = c.spot(0.5); if (b) c.crate(b.x, b.z, 0.6, 0.7, 0.5);
  const d = c.spot(0.8); if (d) c.prop('desk', d.x, d.z);
  const e = c.spot(0.4); if (e) c.prop('chair', e.x, e.z);
  const k = c.corner(0.5); if (k) c.pillar(k.x, k.z, 0.5, 0.5);
};
async function fixture(t, { gfx, barricades = true, lighting = false } = {}) {
  const level = generate(7, { count: 0 }), kit = gfx === undefined ? createKit() : createKit({ gfx });
  const world = await buildWorld(kit, level, { catalogue: catalogueOf(kit), barricadesEnabled: barricades, lighting, builders: { plain: furnish } });
  t.after(() => { world.dispose(); kit.dispose(); });
  return { level, kit, world };
}
const meshesOf = (world, rt) => {
  const out = [];
  rt.group.traverse((o) => { if (o.isMesh && o.geometry) out.push(o); });
  for (const f of world.furniture) if (f.room === rt.id) f.group.traverse((o) => { if (o.isMesh && o.geometry) out.push(o); });
  return out;
};
function fingerprint(world, rt) {
  let sum = 0, hash = 0;
  for (const m of meshesOf(world, rt)) for (const key of ['aLit', 'aFlk', 'aBank0', 'aBank1', 'aBank2', 'aBank3']) {
    const a = m.geometry.attributes[key]; if (!a) continue;
    if (key === 'aLit') for (const v of a.array) sum += v;
    for (const x of new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length)) hash = (Math.imul(hash, 31) + x) >>> 0;
  }
  return [Number(sum.toFixed(6)), hash];
}
// Recorded from the code before there were tube shadows (the same fixture as backrooms-gfx-bake.test.mjs, BEFORE).
// (re-recorded when the level got a desk of its own, desk.model.js: rooms 0, 2, 3 and 5 hold a desk and only its vertices moved the numbers; rooms 1 and 4 are as first recorded)
const BEFORE = [[1798.331663, 4105674958], [1217.726786, 2194159146], [977.463381, 1141414623], [1699.294322, 1393588218], [481.926592, 1625426114], [4640.263823, 2301343724]];
const materialsOf = (world, rt) => meshesOf(world, rt).map((m) => m.material).filter((m) => m.defines);

test('shadows: off unless asked for; off, nothing of it runs and the bake is the one there was before', async (t) => {
  for (const o of [undefined, {}, { shadows: 0 }, { shadows: -1 }, { shadows: 'x' }]) assert.equal(gfxOf(o), null);
  assert.deepEqual(gfxOf({ shadows: 1 }), { contact: 0, bounce: 0, shadows: 1 });
  assert.deepEqual(gfxOf({ contact: 1, bounce: 0.5 }), { contact: 1, bounce: 0.5 }, 'what was asked for before reads as it did');
  for (const gfx of [undefined, { shadows: 0 }, { contact: 0, bounce: 0, shadows: 0 }]) for (const barricades of [true, false]) {
    const { world } = await fixture(t, { gfx, barricades });
    assert.deepEqual(world.rooms.slice(0, 6).map((rt) => fingerprint(world, rt)), BEFORE);
    for (const rt of world.rooms) {
      assert.equal(rt.lm, undefined); assert.equal(rt.shadowStats, undefined);
      for (const m of materialsOf(world, rt)) for (const d of ['LIGHTMAP', 'TUBESHADOW', 'DOORLIGHT']) assert.equal(m.defines[d], undefined);
    }
  }
});

test('shadows: on, the vertex bake is untouched (the map only multiplies it), and only the room\'s own still meshes read the map', async (t) => {
  const off = await fixture(t, { barricades: true }), on = await fixture(t, { barricades: true, gfx: { shadows: 1 } });
  assert.deepEqual(on.world.rooms.slice(0, 6).map((rt) => fingerprint(on.world, rt)), BEFORE);
  let maps = 0;
  for (const rt of on.world.rooms) {
    if (!rt.lm) continue;
    maps++;
    for (const m of meshesOf(on.world, rt)) {
      const own = m.parent === rt.group && !!m.geometry.attributes.aLit;
      if (m.material.defines?.LIGHTMAP) assert.ok(own, 'a light-mapped mesh is one of the room\'s own');
    }
    for (const f of on.world.furniture.filter((f) => f.room === rt.id)) f.group.traverse((o) => { if (o.material?.defines) assert.equal(o.material.defines.LIGHTMAP, undefined, 'what can be dragged never reads it'); });
    for (const name of ['A', 'B']) if (rt.lm[name]) for (const v of rt.lm[name].data) assert.ok(v >= 0 && v <= 255);
  }
  assert.ok(maps > 3, `${maps} rooms have a map`);
  assert.equal(off.world.rooms.length, on.world.rooms.length);
});

/** One plain lamp-lit room laid out by hand: a 6 × 6 m floor, its walls, lamps as given. */
const lumOf = (rgb) => (rgb[0] + rgb[1] + rgb[2]) / 3;
const tube = (x, z, opt = {}) => lamp(x, 2.46, z, [1, 0.95, 0.85], { axis: [0, -1, 0], floor: 0.24, k: 3.4, far: 14, ...opt });
const floorRatio = (layout, ratio, g, x, z) => { const r = layout.regions.floor, i = Math.floor((x - r.o[0]) / r.cell), j = Math.floor((z - r.o[1]) / r.cell); return ratio[g] ? ratio[g][(r.py + j) * layout.width + r.px + i] : 1; };

test('a box between a tube and the floor darkens the floor behind it, and not in front of it; walls too', () => {
  const layout = mapLayout({ W: 6, D: 6, H: 2.6, floor: true, walls: new Set(['back', 'front', 'left', 'right']) });
  const lights = [tube(0, 0)], box = { x0: 1, y0: 0, z0: -0.3, x1: 1.4, y1: 1.2, z1: 0.3 };
  const res = bakeShadows({ layout, lights, amb: [0.1, 0.1, 0.1], boxes: [box] });
  assert.ok(res && res.ratio[0] && !res.ratio[1], 'the steady group, and only it');
  // behind it (away from the tube): dark; in front, and to the side: untouched
  for (const x of [1.6, 1.9, 2.2]) assert.ok(floorRatio(layout, res.ratio, 0, x, 0) < 0.8, `behind at x ${x}: ${floorRatio(layout, res.ratio, 0, x, 0)}`);
  for (const [x, z] of [[0.5, 0], [0, 0], [-1, 0], [1.6, 1.5], [1.6, -1.5]]) assert.equal(floorRatio(layout, res.ratio, 0, x, z), 1, `in front / beside at ${x},${z}`);
  // softer at the edge than in the middle: four points along the tube
  const mid = floorRatio(layout, res.ratio, 0, 2, 0), edge = floorRatio(layout, res.ratio, 0, 2, 0.42);
  assert.ok(mid < edge && edge < 1, `penumbra ${mid} < ${edge} < 1`);
  for (const v of res.ratio[0]) assert.ok(v >= 0 && v <= 1);
  // a tall thing near a wall throws its shadow up the wall
  const tall = { x0: 2.4, y0: 0, z0: -0.3, x1: 2.8, y1: 2.0, z1: 0.3 }, w = bakeShadows({ layout, lights, amb: [0.1, 0.1, 0.1], boxes: [tall] });
  const right = layout.regions.right;
  let dark = 0;
  for (let j = 0; j < right.nv; j++) for (let i = 0; i < right.nu; i++) if (w.ratio[0][(right.py + j) * layout.width + right.px + i] < 0.9) dark++;
  assert.ok(dark > 20, `${dark} wall texels in its shadow`);
  // a lamp inside a box (a lamp in a fitting) is not put out by it; nothing at all to shadow: no map
  assert.equal(bakeShadows({ layout, lights, amb: [0.1, 0.1, 0.1], boxes: [{ x0: -0.5, y0: 2.3, z0: -0.5, x1: 0.5, y1: 2.6, z1: 0.5 }] }), null);
  assert.equal(bakeShadows({ layout, lights, amb: [0.1, 0.1, 0.1], boxes: [] }), null);
  // light from next door is never shadowed here
  const spill = { ...tube(0, 0), spill: 3 };
  assert.equal(bakeShadows({ layout, lights: [spill], amb: [0.1, 0.1, 0.1], boxes: [box] }), null);
});

test('per bank: a bank that is off takes its shadows with it, and the other banks keep theirs; flicker likewise', () => {
  const lighting = { ambientShare: 0.99, bankCount: 2, ceilingBanks: 2 }, amb = [0.12, 0.11, 0.1];
  const lights = [tube(-1.5, 0, { bank: 0 }), tube(-2.5, 2.5, { bank: 1 }), tube(1.5, -2, { flick: true })];
  const layout = mapLayout({ W: 6, D: 6, H: 2.6, floor: true });
  // a box beside bank 0's tube: its shadow (toward -x) is bank 0's; bank 1's tube sees past it
  const box = { x0: -2.4, y0: 0, z0: -0.3, x1: -2.1, y1: 1.4, z1: 0.3 };
  const res = bakeShadows({ layout, lights, amb, lighting, boxes: [box] });
  const at = [-2.7, 0];
  const r0 = floorRatio(layout, res.ratio, 2, ...at), r1 = floorRatio(layout, res.ratio, 3, ...at);
  assert.ok(r0 < 0.7, `bank 0 is hidden there: ${r0}`);
  assert.ok(r1 > 0.97, `bank 1 hardly: ${r1}`);
  // the light there, as the shader puts it together (each group × its level × its share), against the light without the box
  const shade = [floorRatio(layout, res.ratio, 0, ...at), floorRatio(layout, res.ratio, 1, ...at), r0, r1];
  for (const banks of [[1, 1], [0, 1], [1, 0], [0, 0]]) for (const flick of [1, 0]) {
    const rt = { lighting, banks, flick };
    const plain = lightAt(lights, amb, at[0], 0, at[1], 0, 1, 0, rt), shaded = lightAt(lights, amb, at[0], 0, at[1], 0, 1, 0, { ...rt, shade });
    const own = (b) => lightAt(lights.filter((l) => l.bank === b), amb.map(() => 0), at[0], 0, at[1], 0, 1, 0, { lighting, banks: [1, 1], flick: 0 });
    // what goes: exactly bank 0's light × its level × what is hidden of it (its share of the ambient included)
    for (let c = 0; c < 3; c++) assert.ok(shaded[c] <= plain[c] + 1e-9, 'never brighter');
    if (banks[0] === 0) {
      const withoutBank0Shadow = lightAt(lights, amb, at[0], 0, at[1], 0, 1, 0, { ...rt, shade: [shade[0], shade[1], 1, shade[3]] });
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(shaded[c] - withoutBank0Shadow[c]) < 1e-12, 'bank 0 out: its shadow is gone with it');
    }
    assert.ok(own(0)[0] > 0);
  }
  // flicker has its own channel
  const fbox = { x0: -0.3, y0: 0, z0: -1.2, x1: 0.3, y1: 1.4, z1: -0.9 }, f = bakeShadows({ layout, lights, amb, lighting, boxes: [fbox] });
  assert.ok(f.ratio[1] && floorRatio(layout, f.ratio, 1, -0.8, -0.5) < 0.9, 'the flickering tube\'s shadow is its own');
  // every bank at 1, nothing standing: exactly the bake (the map is absent, or all 1)
  const none = [1, 1, 1, 1, 1, 1];
  for (const [x, z] of [[0, 0], [-2, 1], [2.5, -2.5]]) {
    const a = lightAt(lights, amb, x, 0, z, 0, 1, 0, { lighting, banks: [1, 1] }), b = lightAt(lights, amb, x, 0, z, 0, 1, 0, { lighting, banks: [1, 1], shade: none });
    assert.deepEqual(a, b);
  }
  // the packed bytes say the same as the floats (to a byte), read the way the shader reads them
  const packed = packShadows(layout, res.ratio), read = sampleMap(layout, packed.A.data, packed.A.channels, 6, 6, -2.72, 0, 0.02);
  assert.equal(packed.A.channels, 4);
  assert.ok(Math.abs(read[2] - r0) < 0.02 && Math.abs(read[3] - r1) < 0.02, `${read} vs ${r0}, ${r1}`);
});

test('in a whole room: a crate throws its shadow on the floor; with all banks at 1 the sum is the bake; bodies read it', async (t) => {
  const level = generate(7, { count: 0 }), src = level.rooms.find((r) => r.kind === 'plain' && r.panels.length >= 2);
  const build = async (gfx, barricades, lighting, stuff) => {
    const def = { ...src, id: 0, x: 0, z: 0, w: 8, d: 8, W: 8, D: 8, H: 2.6, cx: 4, cz: 4, y: 0, rot: 0, doors: [], wins: [], shape: null, light: { ...src.light, mode: 'normal' },
      panels: [{ x: -2, z: -2, state: 'on' }, { x: 2, z: 2, state: 'on' }, { x: -2, z: 2, state: 'on' }, { x: 2, z: -2, state: 'on' }] };
    const kit = createKit(gfx ? { gfx } : {});
    const world = await buildWorld(kit, { ...level, rooms: [def], links: [], windows: [] }, { catalogue: catalogueOf(kit), barricadesEnabled: barricades, lighting, builders: { plain: (c) => { c.shell(); stuff(c); } } });
    t.after(() => { world.dispose(); kit.dispose(); });
    return world;
  };
  const crate = (c) => c.crate(0, 0, 0.6, 1.1, 0.6);
  const w = await build({ shadows: 1 }, false, false, crate), rt = w.rooms[0];
  assert.ok(rt.lm?.shadows && rt.lm.layout.regions.floor);
  const { layout, A } = rt.lm;
  // the four tubes are at (±2, ±2): the crate's shadow falls along the diagonals, beyond it; under a tube the floor is lit
  const s = (x, z) => sampleMap(layout, A.data, A.channels, 8, 8, x, 0, z)[0];
  assert.ok(s(0.6, 0.6) < 0.92 && s(-0.6, -0.6) < 0.92, `diagonals ${s(0.6, 0.6)}, ${s(-0.6, -0.6)}`);
  assert.ok(s(-2, -2) > 0.95 && s(3.5, -3.5) > 0.98, `under a tube and far off it ${s(-2, -2)} ${s(3.5, -3.5)} ${s(-3.5,3.5)}`);
  // the round blot under the crate fades: its shadow is baked now
  const plainW = await build(null, false, false, crate);
  const alpha = (world) => { const q = []; world.rooms[0].group.traverse((o) => { if (o.geometry?.attributes.color) q.push(...o.geometry.attributes.color.array.filter((_, i) => i % 4 === 3)); }); return Math.max(...q); };
  assert.ok(alpha(w) < alpha(plainW) * 0.5, 'the blot is mostly gone');
  // a body standing in the shadow is darker than one beside it (world.lightAt); without shadows the probe is as it was
  const shaded = w.lightAt(rt.def.cx + 0.6, rt.def.cz + 0.6, 1)[0], beside = w.lightAt(rt.def.cx + 0.6, rt.def.cz - 3.5, 1)[0];
  assert.ok(shaded < plainW.lightAt(rt.def.cx + 0.6, rt.def.cz + 0.6, 1)[0]);
  assert.deepEqual(plainW.lightAt(4.6, 4.6, 1), (await build(null, false, false, crate)).lightAt(4.6, 4.6, 1));
  assert.ok(beside > 0);
  // with banks: every bank at 1 and nothing standing reconstructs the bake; something can be dragged: it throws nothing
  const banked = await build({ shadows: 1 }, true, 'failing', (c) => { c.prop('chair', 0, 0); c.prop('desk', 1.2, 1.2); });
  const brt = banked.rooms[0];
  assert.ok(banked.furniture.length >= 2, 'the chair and the desk can be dragged');
  assert.equal(brt.shadowBoxes.length, 0, 'what can be dragged is no occluder');
  assert.equal(brt.lm, undefined, 'and no map is made for nothing');
  const fixedFurniture = await build({ shadows: 1 }, false, false, (c) => { c.prop('chair', 0, 0); });
  assert.ok(fixedFurniture.rooms[0].shadowBoxes.length > 1, 'a chair that is fixed throws a chair\'s shadow (more than one box)');
  assert.ok(fixedFurniture.rooms[0].lm?.shadows);
});

test('budgets: no room gains a triangle or a mesh, generation does not move, and the largest set piece\'s map is small', async (t) => {
  const fresh = JSON.stringify(generate(7, { count: 0 }));
  const counts = (world) => world.rooms.map((rt) => { let tri = 0; const m = meshesOf(world, rt); for (const o of m) tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; return [m.length, tri]; });
  const off = await fixture(t, {}), on = await fixture(t, { gfx: { contact: 1, bounce: 1, shadows: 1 } }), contact = await fixture(t, { gfx: { contact: 1, bounce: 1 } });
  assert.equal(JSON.stringify(on.level), fresh); assert.equal(JSON.stringify(generate(7, { count: 0 })), fresh);
  assert.deepEqual(counts(on.world), counts(off.world));
  assert.deepEqual(counts(on.world), counts(contact.world));
  // the largest a room may be (a set piece: 28 × 28 m, 12 m high; set pieces have no banks, so two bytes a texel): its
  // map stays under 1 MB; and the largest plain room that can have four banks (20 × 20 m, six bytes a texel) under 1.5 MB
  const big = mapLayout({ W: 28, D: 28, H: 12, floor: true, walls: new Set(['back', 'front', 'left', 'right']) });
  assert.equal(big.cell, SHADOWS.coarse);
  assert.ok(big.width * big.height * 2 < 1e6, `${big.width}×${big.height}`);
  const plainBig = mapLayout({ W: 20, D: 20, H: 3, floor: true, walls: new Set(['back', 'front', 'left', 'right']) });
  assert.ok(plainBig.width * plainBig.height * 6 < 1.5e6, `${plainBig.width}×${plainBig.height}`);
  assert.ok(big.width <= 2048 && big.height <= 2048);

  // real rooms, built by their own files, including the set pieces that fall back
  const { BUILDERS } = await import(new URL('rooms.js', B).href);
  const only = ['copiers', 'mailroom', 'cutouts', 'all-hands'];
  const real = async (gfx) => {
    const level = generate(7, { only }), builders = { ...BUILDERS };
    for (const id of new Set(level.rooms.map((r) => r.arch))) { const a = ARCHETYPES[id]; if (a?.module) { const mod = await import(new URL(a.module, B).href); if (mod.build) builders[id] = mod.build; } }
    const kit = gfx ? createKit({ gfx }) : createKit();
    const env = { level, kit, builders, catalogue: await loadCatalogue(kit), barricadesEnabled: true, lighting: false, plan: {},
      cast: ['Ivory Marten', 'Amber Vireo', 'Olive Heron'].map((name) => ({ name, look: { species: 'human' } })), who: { name: 'Robin', look: { species: 'human' }, creations: {} },
      hatches: new Map(), ready: [], play() {}, interfere() {}, sees: () => false, run: { met() {}, survived() {} }, end() {}, steadyLighting: () => false, difficulty: () => 'normal' };
    const world = await buildWorld(kit, level, env);
    t.after(() => { world.dispose(); kit.dispose(); });
    return { level, world };
  };
  const [a, b] = [await real(null), await real({ contact: 1, bounce: 1, shadows: 1 })];
  assert.equal(JSON.stringify(a.level), JSON.stringify(b.level));
  assert.deepEqual(counts(b.world), counts(a.world));
  let bytes = 0;
  for (const rt of b.world.rooms) {
    bytes += rt.shadowStats?.bytes || 0;
    if (rt.def.arch === 'all-hands') assert.equal(rt.shadowStats.floor, false, 'a floor that is not one flat rectangle has no floor in the map');
    if (rt.def.arch === 'copiers') assert.ok(rt.lm?.shadows, 'the copiers throw shadows');
    assert.ok((rt.shadowStats?.bytes || 0) < 1.5e6);
  }
  assert.ok(bytes < 6e6, `a floor's maps: ${bytes} bytes`);
});

test('the tiers: classic and low bake no shadows, medium and high do; the kit is told', () => {
  assert.equal(profile('classic').shadows, 0); assert.equal(profile('low').shadows, 0);
  assert.equal(profile('medium').shadows, 1); assert.equal(profile('high').shadows, 1);
  assert.equal(createKit({ gfx: { contact: profile('classic').contact, bounce: profile('classic').bounce, shadows: profile('classic').shadows } }).gfx, null);
  assert.equal(createKit({ gfx: { contact: 1, bounce: 1, shadows: profile('high').shadows } }).gfx.shadows, 1);
});

test('the shader: every line of it is in its own marked blocks, each switched off unless a room\'s map asks; held things never ask', () => {
  const src = readFileSync(new URL('kit.js', B), 'utf8');
  const blocks = [...src.matchAll(/\/\/ --- tube shadows \(lightmap\) ---\n([\s\S]*?)\/\/ --- end tube shadows ---/g)].map((m) => m[1].trim());
  assert.equal(blocks.length, 4, 'two blocks in each shader: what it declares, and where it is used');
  for (const b of blocks) { assert.match(b, /^#ifdef LIGHTMAP/); assert.match(b, /#endif$/); }
  const kit = createKit();
  const plain = kit.surface({ vox: true, room: null });
  assert.equal(plain.defines.LIGHTMAP, undefined);
  const hand = readFileSync(new URL('hand.js', B), 'utf8');
  assert.doesNotMatch(hand, /lm:/, 'what is held is drawn without a room map');
  const lm = { shadows: true, materials: [], uniforms: { uLm: { value: [] }, uLmA: { value: null }, uLmB: { value: null } } };
  const m = kit.surface({ lm, banks: 3 });
  assert.equal(m.defines.LIGHTMAP, 1); assert.equal(m.defines.TUBESHADOW, 1); assert.equal(lm.materials[0], m);
  assert.equal(m.uniforms.uLmA, lm.uniforms.uLmA, 'the room\'s map, shared');
  kit.dispose();
});

/* ---- light through a doorway (kit.gfx.doorlight) ------------------------------------------------------------------ */

test('doorlight: off unless asked for; on its own it bakes no shadow, and of the vertex bake only halves the old glow at a doorway', async (t) => {
  for (const o of [{ doorlight: 0 }, { doorlight: 'x' }]) assert.equal(gfxOf(o), null);
  assert.deepEqual(gfxOf({ doorlight: 1 }), { contact: 0, bounce: 0, doorlight: 1 });
  assert.equal(profile('classic').doorlight, 0); assert.equal(profile('low').doorlight, 0);
  assert.equal(profile('medium').doorlight, 1); assert.equal(profile('high').doorlight, 1);
  const { world } = await fixture(t, { barricades: true, gfx: { doorlight: 1 } }), off = await fixture(t, { barricades: true });
  world.rooms.forEach((rt, i) => {
    const a = off.world.rooms[i].lights, b = rt.lights;
    assert.equal(a.length, b.length);
    a.forEach((L, k) => { const s = L.spill !== undefined ? 0.5 : 1; for (const c of ['r', 'g', 'b']) assert.ok(Math.abs(b[k][c] - L[c] * s) < 1e-12); });
    if (!a.some((L) => L.spill !== undefined) && i < 6) assert.deepEqual(fingerprint(world, rt), BEFORE[i]);
  });
  let lit = 0;
  for (const rt of world.rooms) {
    if (rt.lm) assert.equal(rt.lm.shadows, false);
    if (rt.doorLight) { lit++; for (const m of rt.lm.materials) { assert.equal(m.defines.DOORLIGHT, 1); assert.equal(m.defines.TUBESHADOW, undefined); } }
  }
  assert.ok(lit > 3, `${lit} rooms take light through a doorway`);
});

test('a doorway lets the next room\'s tube through in the doorway\'s shape, and what stands in the way cuts it', () => {
  const W = 6, D = 6, layout = mapLayout({ W, D, H: 2.6, floor: true, walls: new Set(['back', 'front', 'left', 'right']) });
  // a doorway in the back wall (z = −3), 1 m wide at x 0, 2 m high; the lamp next door 2 m beyond it
  const face = (out) => [[-0.5, 0], [0.5, 0], [0.5, 2], [-0.5, 2]].map(([x, y]) => [x, y, -3 - out]);
  const L = tube(0, -5.2);
  const lamps = [{ L, g: 0, pts: SM.lampPoints(L) }];
  const res = SM.bakeDoorway({ layout, faces: [face(0), face(0.2)], lamps, boxes: [], skip: 'back', groups: 2 });
  assert.ok(res && res.peak > 0 && res.energy[0] > 0 && !res.energy[1]);
  const floorAtOf = (p) => (x, z) => { const r = layout.regions.floor, i = Math.floor((x + 3) / r.cell), j = Math.floor((z + 3) / r.cell); return p[(r.py + j) * layout.width + r.px + i]; };
  const at = floorAtOf(res.patch);
  assert.ok(at(0, -2.6) > 0, 'just inside the doorway, in line with it');
  assert.equal(at(-2, -2.8), 0, 'beside the doorway, behind the wall');
  assert.equal(at(2.5, -2.9), 0);
  assert.ok(res.patch.filter((v) => v > 0).length > 20);
  // a crate just inside the doorway: behind it, no light
  const crate = { x0: -0.3, y0: 0, z0: -2.6, x1: 0.3, y1: 1.5, z1: -2.3 };
  const cut = SM.bakeDoorway({ layout, faces: [face(0), face(0.2)], lamps, boxes: [crate], skip: 'back', groups: 2 });
  assert.ok(at(0, -1.9) > 0 && floorAtOf(cut.patch)(0, -1.9) === 0, 'in the crate\'s shadow');
  // packed: a doorway a channel, the square root of its share of its peak
  const packed = SM.packDoorways(layout, [res]);
  const v = sampleMap(layout, packed.data, 4, W, D, 0.02, 0, -2.6);
  assert.ok(v[0] > 0 && v[1] === 0 && v[2] === 0 && v[3] === 0);
});

test('a doorway\'s light follows the doorway (shut: none) and the room beyond (its banks, its dimmer)', async (t) => {
  const { world } = await fixture(t, { barricades: true, lighting: 'dim', gfx: { shadows: 1, doorlight: 1 } });
  world.updateLighting(0);
  const rooms = world.rooms.filter((rt) => rt.doorLight?.length);
  assert.ok(rooms.length > 3);
  // shut a doorway: its light is gone, the other doorways' are not
  const rt = rooms.find((r) => r.doorLight.length >= 2) || rooms[0], [d0, d1] = rt.doorLight;
  assert.ok(d0.u.length() > 0);
  const before1 = d1?.u.clone();
  d0.throat.open = false; world.updateLighting(0);
  assert.equal(d0.u.length(), 0, 'a shut doorway lets nothing through');
  if (d1) assert.ok(d1.u.equals(before1), 'the other doorway is as it was');
  // a hung door half shut: half its light
  d0.throat.open = true; world.env.doors = { at: (link) => (link === d0.link ? { k: 0.5 } : null) };
  world.updateLighting(0);
  const half = d0.u.length(); world.env.doors = null; world.updateLighting(0);
  assert.ok(Math.abs(half - d0.u.length() / 2) < 1e-9);
  // the room beyond turned down: its doorway's light with it; a room beyond whose banks fail: less of it
  const full = d0.u.length();
  world.setLights(d0.other, 0.02); world.updateLighting(0);
  assert.ok(d0.u.length() < full * 0.05);
  world.setLights(d0.other, 1); world.updateLighting(0);
  const banked = rooms.flatMap((r) => r.doorLight).find((d) => d.other.lighting && d.share.slice(2).some((s) => s > 0.3));
  assert.ok(banked, 'a doorway from a room with banks');
  banked.other.lighting.preview = 'working'; world.updateLighting(0);
  const on = banked.u.length();
  delete banked.other.lighting.preview; world.updateLighting(0);
  assert.ok(banked.u.length() < on, 'a failing bank next door: less light through the doorway');
  // a body standing in it is lit by it (world.lightAt), and not when the doorway is shut
  const m = rt.lm, r = m.layout.regions.floor;
  let best = null, bestV = 0;
  if (r) for (let j = 0; j < r.nv; j += 2) for (let i = 0; i < r.nu; i += 2) { const v = m.C.data[((r.py + j) * m.layout.width + r.px + i) * 4]; if (v > bestV) { bestV = v; best = [r.o[0] + (i + 0.5) * r.cell, r.o[1] + (j + 0.5) * r.cell]; } }
  assert.ok(best);
  const p = toWorld(rt.def, best[0], best[1]);
  const lit = world.lightAt(p.x, p.z, 1)[0];
  for (const d of rt.doorLight) d.throat.open = false;
  world.updateLighting(0);
  assert.ok(world.lightAt(p.x, p.z, 1)[0] < lit);
});


/* ---- what a frame pays while a part is built (world.js buildWorld, doorPass) ----------------------------------------- */

/** The fixture's floor built with a tick, recording what it was called with and how far the room it was in had got. */
async function paced(t, { gfx, late = false, stopAfter = Infinity } = {}) {
  const level = generate(7, { count: 0 }), kit = gfx === undefined ? createKit() : createKit({ gfx }), calls = [];
  let rooms = null, built = null;
  const builders = { plain: (c) => { rooms = c.world.rooms; built = c.world; furnish(c); } };
  const tick = async (i, n, short) => {
    const rt = short ? rooms[i] : null;
    calls.push({ i, short: !!short, map: rt ? !!rt.shadowStats : null, meshes: rt ? rt.group.children.length : null });
    if (calls.length >= stopAfter) built.dispose();
    await new Promise((r) => setImmediate(r));                // (a frame, as far as the build can tell)
  };
  const world = await buildWorld(kit, level, { catalogue: catalogueOf(kit), barricadesEnabled: true, builders, lateDoorLight: late }, tick);
  t.after(() => { world.dispose(); kit.dispose(); });
  return { world, calls };
}
const doorsOf = (world) => world.rooms.map((rt) => [rt.doorStats?.doors ?? null, rt.lm?.C ? Array.from(rt.lm.C.data).reduce((a, v) => (Math.imul(a, 31) + v) >>> 0, 0) : null,
  (rt.doorLight || []).map((d) => [d.link, d.peak, d.share])]);

test('a part built with a tick: without a map nothing changes; with one, each room\'s map is a slice of its own', async (t) => {
  // no map: the same ticks as ever (one a room, then the no-trap check's), none of them short, the same baked numbers
  for (const gfx of [undefined, { contact: 1, bounce: 0.7, shadows: 0, doorlight: 0 }]) {
    const { world, calls } = await paced(t, { gfx });
    assert.equal(calls.filter((c) => c.short).length, 0);
    assert.deepEqual(calls.slice(0, world.rooms.length).map((c) => c.i), world.rooms.map((rt) => rt.id + 1));
    if (!gfx) assert.deepEqual(world.rooms.slice(0, 6).map((rt) => fingerprint(world, rt)), BEFORE);
  }
  // a map: a breath before it (the room built, no map yet) and after it (the map, no mesh of the bake yet), then the bake
  // and a breath after the room; all three short, so a room takes as many frames as it did (index.js prepare)
  const gfx = { contact: 1, bounce: 0.7, shadows: 1, doorlight: 1 };
  const { world, calls } = await paced(t, { gfx }), eager = await fixture(t, { gfx }), N = world.rooms.length;
  assert.deepEqual(calls.slice(0, 3 * N).map((c) => [c.i, c.short]), world.rooms.flatMap((rt) => [[rt.id, true], [rt.id, true], [rt.id + 1, true]]));
  for (const rt of world.rooms) {
    const mine = calls.slice(3 * rt.id, 3 * rt.id + 2);
    assert.deepEqual(mine.map((c) => c.map), [false, true]);
    assert.equal(mine[0].meshes, mine[1].meshes, 'no mesh is handed over with its map');
    assert.ok(rt.group.children.length > mine[1].meshes, 'the bake comes after the map');
  }
  // sliced or not, the same rooms: the same vertex light, the same maps, the same light through the doorways
  assert.deepEqual(world.rooms.map((rt) => fingerprint(world, rt)), eager.world.rooms.map((rt) => fingerprint(eager.world, rt)));
  assert.deepEqual(world.rooms.map((rt) => rt.lm?.A?.data.length ?? null), eager.world.rooms.map((rt) => rt.lm?.A?.data.length ?? null));
  assert.deepEqual(doorsOf(world), doorsOf(eager.world));
});

test('lateDoorLight: the part is ready before its doorways\' light, which arrives a room at a time, whole, fading up; never after it is thrown away', async (t) => {
  const gfx = { shadows: 1, doorlight: 1 }, eager = await fixture(t, { gfx });
  // without a tick there is nobody to pace it: lateDoorLight is not taken up
  const kit0 = createKit({ gfx }), w0 = await buildWorld(kit0, generate(7, { count: 0 }), { catalogue: catalogueOf(kit0), barricadesEnabled: true, builders: { plain: furnish }, lateDoorLight: true });
  t.after(() => { w0.dispose(); kit0.dispose(); });
  assert.equal(w0.doorsLit, null); assert.deepEqual(doorsOf(w0), doorsOf(eager.world));

  const { world } = await paced(t, { gfx, late: true });
  assert.equal(world.doorsPending, true);
  assert.ok(world.rooms.every((rt) => !rt.doorLight && !rt.doorStats), 'ready with no doorway baked yet');
  for (const rt of world.rooms) if (rt.lm) for (const m of rt.lm.materials) assert.equal(m.defines.DOORLIGHT, undefined, 'a room draws as it does without the doorways\' light');
  // being played in (lit frame by frame) while it fills in
  let now = 10; const frames = setInterval(() => world.updateLighting((now += 0.016)), 5);
  await world.doorsLit; clearInterval(frames);
  assert.equal(world.doorsPending, false);
  assert.deepEqual(doorsOf(world), doorsOf(eager.world), 'baked late, the same light');
  for (const rt of world.rooms) if (rt.doorLight) for (const m of rt.lm.materials) assert.equal(m.defines.DOORLIGHT, 1);
  // so it fades up from when it arrived (DOOR_FADE), where the one baked before the part was ready is at full at once
  const i = world.rooms.findIndex((rt) => rt.doorLight?.some((d) => d.late)), d = world.rooms[i].doorLight.find((x) => x.late), e = eager.world.rooms[i].doorLight[world.rooms[i].doorLight.indexOf(d)];
  assert.ok(d, 'a doorway that arrived while the part was being lit');
  eager.world.updateLighting(d.since + 0.4); world.updateLighting(d.since + 0.4);
  assert.ok(d.u.length() > 0 && d.u.length() < e.u.length() * 0.75, 'half way up');
  eager.world.updateLighting(d.since + 1); world.updateLighting(d.since + 1);
  assert.ok(Math.abs(d.u.length() - e.u.length()) < 1e-9);
  // hung below and not lit frame by frame (the part ahead before anybody is near): no fade, at full as it arrives
  const still = await paced(t, { gfx, late: true });
  await still.world.doorsLit;
  for (const rt of still.world.rooms) for (const x of rt.doorLight || []) { assert.equal(x.late, false); assert.ok(x.peak === 0 || x.u.length() > 0 || !x.throat.open); }

  // thrown away half way: nothing more is baked into it
  const rooms = world.rooms.length, cut = await paced(t, { gfx, late: true, stopAfter: 3 * rooms + 3 });
  await cut.world.doorsLit;
  const done = cut.world.rooms.filter((rt) => rt.doorStats).length;
  assert.ok(done < rooms, `${done} of ${rooms} rooms were reached before it was thrown away`);
  assert.equal(cut.world.timing.some(([w]) => w === 'door light'), false);
});

test('index.js: only the part built ahead takes its doorways\' light late, and its pace gives a short breath one frame', () => {
  const src = readFileSync(new URL('public/world/backrooms/index.js', root), 'utf8');
  assert.match(src, /lateDoorLight: !!pace,/, 'the first part (no pace: the loading picture) is built whole, doorways and all');
  assert.match(src, /const pace = async \(i, n, short\) => \{ await frame\(\); if \(!short\) \{ await frame\(\); await frame\(\); \} \};/);
  assert.match(src, /autoStep\(gfxAuto, time, stage\.frameMs, !!ahead && \(!ahead\.f \|\| !!ahead\.f\.world\.doorsPending\)\)/, 'Auto does not count the frames of a doorway pass as the machine being slow');
});
