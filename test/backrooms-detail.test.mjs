import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// The detail option for rooms (docs/BACKROOMS.md, "What a room may cost"): fine detail in batches of its own, marked so
// that the Graphics setting can leave it out at low. Uses the real kit and world; only canvas drawing is inert.
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
const [{ buildWorld }, { createKit }, { generate }, { profile, showDetail, GRAPHICS }, { roomCost, overBudget }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href),
  import(new URL('graphics.js', B).href), import(new URL('budget.js', B).href)]);

/** Every room: its shell, a plain box, and the three kinds of detail (and, with `plainOnly`, none). */
const furnish = (plainOnly) => (c) => {
  c.shell();
  c.flat.box(-0.3, 0, -0.3, 0.3, 0.6, 0.3, [0.5, 0.4, 0.3]);
  if (plainOnly) return;
  c.detail.box(-0.2, 0.6, -0.2, 0.2, 0.65, 0.2, [0.3, 0.3, 0.3]);
  c.mapped('relief', c.kit.tex.white(), { detail: true }).box(0.5, 0, 0.5, 0.6, 1, 0.6, [0.6, 0.6, 0.6]);
  c.shining('glint', c.kit.tex.white(), 1.2, [1, 1, 1], { detail: true }).quad([0, 1, 0], [0.2, 1, 0], [0.2, 1.2, 0], [0, 1.2, 0]);
  c.mapped('plain-mapped', c.kit.tex.white()).box(-0.6, 0, -0.6, -0.5, 1, -0.5, [0.6, 0.6, 0.6]);
  c.shining('plain-shining', c.kit.tex.white(), 1.2).quad([0, 1.5, 0], [0.2, 1.5, 0], [0.2, 1.7, 0], [0, 1.7, 0]);
};
async function fixture(t, { plainOnly = false, barricades = false } = {}) {
  const level = generate(7, { count: 0 }), kit = createKit();
  const world = await buildWorld(kit, level, { catalogue: { has: () => false, entry: () => null, geo: () => null }, barricadesEnabled: barricades, builders: { plain: furnish(plainOnly) } });
  t.after(() => { world.dispose(); kit.dispose(); });
  return { level, kit, world };
}
const meshes = (o) => { const out = []; o.traverse((m) => { if (m.isMesh && m.geometry) out.push(m); }); return out; };
const materialOf = (m) => m.material;

test('c.detail, and detail: true to c.mapped and c.shining, mark their meshes as detail and nothing else', async (t) => {
  const { world } = await fixture(t);
  const rt = world.rooms.find((r) => r.def.kind === 'plain');
  const all = meshes(rt.group), marked = all.filter((m) => m.userData.detail);
  assert.equal(marked.length, 3, 'the detail batch, the mapped one and the shining one');
  for (const m of marked) assert.equal(m.visible, true, 'built visible: the tier decides afterwards');
  const unmarked = all.filter((m) => !m.userData.detail);
  assert.ok(unmarked.length >= 4, 'the shell, c.flat, and the plain mapped and shining batches are not marked');
  // the same material as the unmarked kind: a detail batch is lit and drawn like c.flat / c.mapped / c.shining
  const flatLike = marked.filter((m) => m.material.isShaderMaterial), glowLike = marked.filter((m) => m.material.isMeshBasicMaterial);
  assert.equal(flatLike.length, 2); assert.equal(glowLike.length, 1);
  assert.deepEqual(glowLike[0].material.color.toArray().map((v) => +v.toFixed(5)), [1.2, 1.2, 1.2], 'shining: its power and colour, as without the option');
  assert.equal(glowLike[0].material.depthWrite, true);
  assert.ok(flatLike.every((m) => m.geometry.attributes.aLit), 'baked like any other batch');
  assert.ok(materialOf(flatLike[0]).defines.MAPPED, 'the same surface as c.flat (a mapped white texture)');
});

test('with barricades on, a detail batch over furniture keeps its mark wherever its pieces end up', async (t) => {
  const { world } = await fixture(t, { barricades: true });
  const marked = meshes(world.scene).filter((m) => m.userData.detail);
  assert.ok(marked.length >= 3 * world.rooms.filter((r) => r.def.kind === 'plain').length);
});

test('a mesh a room marks by hand (userData.detail, as a theme\'s own detail mesh does), anywhere in its group, is hidden and counted the same', async (t) => {
  const THREE = await import('three');
  const level = generate(7, { count: 0 }), kit = createKit();
  let made = null;
  const world = await buildWorld(kit, level, { catalogue: { has: () => false, entry: () => null, geo: () => null }, barricadesEnabled: false, builders: { plain: (c) => {
    furnish(true)(c);
    if (made) return;
    // a mesh of the room's own, two groups down, flagged by hand and named as such a room names it
    const outer = new THREE.Group(), inner = new THREE.Group();
    made = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
    made.name = 'waterpark-detail'; made.userData.detail = true;
    inner.add(made); outer.add(inner); c.add(outer);
  } } });
  t.after(() => { world.dispose(); kit.dispose(); });
  assert.ok(made && made.parent, 'the room put it in');
  const rt = world.rooms.find((r) => { let has = false; r.group.traverse((o) => { if (o === made) has = true; }); return has; });
  assert.ok(rt, 'it is inside a room\'s group');
  assert.equal(roomCost(rt.group).detailMeshes, 1, 'counted as detail');
  assert.equal(roomCost(rt.group).detailTriangles, 12);
  assert.equal(showDetail(world.scene, profile('low')), 1); assert.equal(made.visible, false, 'hidden at low');
  assert.equal(showDetail(world.scene, profile('classic')), 1); assert.equal(made.visible, true, 'drawn again at classic');
});

test('a low Graphics setting hides what is marked as detail; classic, medium and high draw it; nothing else is touched', async (t) => {
  const { world } = await fixture(t);
  const all = meshes(world.scene), marked = all.filter((m) => m.userData.detail), rest = all.filter((m) => !m.userData.detail);
  assert.ok(marked.length > 0);
  assert.equal(profile('low').detail, false);
  for (const g of ['classic', 'medium', 'high', 'auto']) assert.equal(profile(g).detail, true, g);
  assert.equal(showDetail(world.scene, profile('classic')), 0, 'classic: nothing to change, as today');
  assert.equal(showDetail(world.scene, profile('low')), marked.length);
  assert.ok(marked.every((m) => m.visible === false) && rest.every((m) => m.visible === true));
  assert.equal(showDetail(world.scene, profile('low')), 0, 'twice is the same as once');
  assert.equal(showDetail(world.scene, profile('high')), marked.length);
  assert.ok(all.every((m) => m.visible === true));
  for (const g of GRAPHICS) { showDetail(world.scene, profile(g)); assert.ok(rest.every((m) => m.visible === true), `${g} never hides an ordinary batch`); }
});

test('classic is unchanged: a room that marks nothing builds exactly the meshes it did, and the switch finds nothing', async (t) => {
  const { world } = await fixture(t, { plainOnly: true });
  assert.equal(meshes(world.scene).filter((m) => m.userData.detail).length, 0);
  for (const g of GRAPHICS) assert.equal(showDetail(world.scene, profile(g)), 0, g);
  // every room in the deck today: none uses the option yet, so no tier hides anything
  const dir = new URL('public/world/backrooms/', root);
  for (const f of ['rooms.js', 'rooms2.js', 'rooms3.js', 'rooms4.js']) assert.ok(!/\bdetail\s*:\s*true|c\.detail\b/.test(readFileSync(new URL(f, dir), 'utf8')), f);
});

test('a built room\'s cost counts ordinary and detail apart (budget.js roomCost), and it is within budget', async (t) => {
  const { world } = await fixture(t);
  const rt = world.rooms.find((r) => r.def.kind === 'plain'), cost = roomCost(rt.group);
  const all = meshes(rt.group);
  assert.equal(cost.meshes + cost.detailMeshes, all.length);
  assert.equal(cost.detailMeshes, 3);
  assert.ok(cost.detailTriangles >= 12 + 12 + 2, 'two boxes and a quad');
  assert.deepEqual(overBudget(cost, { lights: rt.lights.length }), []);
});
