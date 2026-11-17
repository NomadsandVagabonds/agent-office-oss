import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// The sculpted ceiling lights (kit.js gfxOf `fixtures`, world.js shell, ceiling.model.js): off unless asked for, and
// then not a mesh, a triangle or a baked number moves; on, every light that hangs under a flat sheet of ceiling is the
// fitting, its tile open, its tubes in the very batch the flat panel would have been in (so they shine, dim, flicker and
// fail as it did), its louvre detail. Uses the real kit, world, rooms and catalogue; only canvas drawing is inert.
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
const [{ buildWorld, loadCatalogue, panOf }, { createKit, gfxOf }, { generate, ARCHETYPES, isBig }, makers, { profile, showDetail, GRAPHICS }, { roomCost, overBudget }, { lightVox, CEILING }, { meshVox }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('public/world/props/office.js', root).href),
  import(new URL('graphics.js', B).href), import(new URL('budget.js', B).href), import(new URL('ceiling.model.js', B).href), import(new URL('public/world/vox/mesher.js', root).href)]);

const catalogueOf = (kit) => ({ has: (type) => typeof makers[type] === 'function', entry: () => null, geo: (type) => (makers[type] ? kit.model(type, makers[type]) : null) });
/** The same furnished floor as backrooms-gfx-bake.test.mjs and backrooms-gfx-shadows.test.mjs. */
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
// Recorded from the code before there were fittings (the same fixture as backrooms-gfx-bake.test.mjs, BEFORE).
const BEFORE = [[1917.143025, 3831347603], [1217.726786, 2194159146], [985.762989, 3578396258], [1783.472141, 2833727947], [481.926592, 1625426114], [4863.595473, 1182328622]];
const counts = (world) => world.rooms.map((rt) => { let tri = 0; const m = meshesOf(world, rt); for (const o of m) tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; return [m.length, tri]; });
const vertsOf = (m) => m?.geometry.attributes.position.count || 0;
// how many vertices one light's tubes are, meshed as the world meshes them
const TUBE_VERTS = meshVox(lightVox().tubes, { ao: false }).solid.attributes.position.count;
const DEAD_TUBE_VERTS = meshVox(lightVox({ dead: true }).tubes, { ao: false }).solid.attributes.position.count;
// …and the inside of a lit light's pan, which shines with its tubes (world.js panOf): what one lit light puts into the
// batch the flat panel was in, vertices and triangles
const PAN = panOf(meshVox(lightVox().housing, { ao: false }).solid), HOUSING = meshVox(lightVox().housing, { ao: false }).solid;
const GLOW_VERTS = TUBE_VERTS + PAN.inside.attributes.position.count;
const GLOW_TRIS = (meshVox(lightVox().tubes, { ao: false }).solid.index.count + PAN.inside.index.count) / 3;
const lit = (rt) => rt.def.panels.filter((p) => p.state !== 'dead');
/** The room's fittings: its housing mesh and its louvre mesh (marked detail), told apart by their materials' shared kind. */
const partsOf = (rt) => {
  const vox = []; rt.group.traverse((o) => { if (o.isMesh && o.material.defines?.VOXEL) vox.push(o); });
  return { louvre: vox.filter((m) => m.userData.detail), vox };
};

test('fixtures: a switch per tier, off at classic and low; the kit is told; off is the bake there was before, mesh for mesh', async (t) => {
  assert.deepEqual(GRAPHICS.map((g) => profile(g).fixtures), [0, 0, 1, 1, 1], 'classic, low, medium, high, auto (medium)');
  for (const o of [undefined, {}, { fixtures: 0 }, { fixtures: -1 }, { fixtures: 'x' }]) assert.equal(gfxOf(o), null);
  assert.deepEqual(gfxOf({ fixtures: 1 }), { contact: 0, bounce: 0, fixtures: 1 });
  assert.deepEqual(gfxOf({ fixtures: 0.4 }), { contact: 0, bounce: 0, fixtures: 1 }, 'on or off');
  assert.deepEqual(gfxOf({ contact: 1, bounce: 0.5, shadows: 1 }), { contact: 1, bounce: 0.5, shadows: 1 }, 'what was asked for before reads as it did');
  const p = profile('classic');
  assert.equal(createKit({ gfx: { contact: p.contact, bounce: p.bounce, shadows: p.shadows, doorlight: p.doorlight, fixtures: p.fixtures } }).gfx, null);
  assert.match(readFileSync(new URL('index.js', B), 'utf8'), /fixtures: gfx\(\)\.fixtures \} \}\)/, 'the game hands the tier\'s switch to the kit');
  const plainOff = await fixture(t, {});
  for (const gfx of [{ fixtures: 0 }, { contact: 0, bounce: 0, shadows: 0, doorlight: 0, fixtures: 0 }]) {
    const { world } = await fixture(t, { gfx });
    assert.deepEqual(world.rooms.slice(0, 6).map((rt) => fingerprint(world, rt)), BEFORE);
    assert.deepEqual(counts(world), counts(plainOff.world));
  }
  // and with the other switches of a tier on, adding nothing: the same as those switches alone
  const tier = await fixture(t, { gfx: { contact: 1, bounce: 1, shadows: 1 } }), tierOff = await fixture(t, { gfx: { contact: 1, bounce: 1, shadows: 1, fixtures: 0 } });
  assert.deepEqual(counts(tierOff.world), counts(tier.world));
  assert.deepEqual(tierOff.world.rooms.map((rt) => fingerprint(tierOff.world, rt)), tier.world.rooms.map((rt) => fingerprint(tier.world, rt)));
});

test('fixtures on: every light under a flat ceiling is a fitting, its two tiles open, its tubes where the flat panel was', async (t) => {
  for (const barricades of [true, false]) {
    const off = await fixture(t, { barricades }), on = await fixture(t, { barricades, gfx: { fixtures: 1 } });
    let fitted = 0;
    on.world.rooms.forEach((rt, i) => {
      const was = off.world.rooms[i];
      if (!rt.def.panels.length) return;
      // the same lamps, in the same places, to the bit: the light of the room is not the fitting's to change
      assert.deepEqual(rt.lights, was.lights, `room ${rt.id}: the same lamps`);
      const flat = !rt.def.shape || rt.def.shape.kind !== 'slopeceil';
      if (!flat) return;
      fitted++;
      // the lit tubes: in the 'panel' batch (no banks), one light's tubes each; no flat quads left
      if (rt.panelMesh) assert.equal(vertsOf(rt.panelMesh), rt.def.panels.filter((p) => p.state === 'on').length * GLOW_VERTS, `room ${rt.id}: the lit tubes and pans`);
      assert.equal(rt.flickers.length, rt.def.panels.filter((p) => p.state === 'flicker').length);
      for (const f of rt.flickers) assert.equal(vertsOf(f), GLOW_VERTS, 'a light that cannot decide is a mesh of its own, tubes and pan, as its flat panel was');
      // housing and louvre: a mesh each, the louvre marked as detail; the housing holds the dead lights' grey tubes
      const { louvre, vox } = partsOf(rt);
      assert.equal(louvre.length, 1, `room ${rt.id}: one louvre mesh`);
      assert.ok(vox.length >= 2);
    });
    assert.ok(fitted > 10, `${fitted} rooms with fittings`);
    // a sloping ceiling keeps its flat panels: no hole, nothing sculpted
    const slope = on.world.rooms.find((rt) => rt.def.shape?.kind === 'slopeceil' && rt.def.panels.length);
    if (slope) { assert.equal(partsOf(slope).louvre.length, 0); assert.equal(fingerprint(on.world, slope).join(), fingerprint(off.world, off.world.rooms[slope.id]).join()); }
  }
});

test('fixtures on: the ceiling sheet loses exactly the tiles the fittings fill', async (t) => {
  const off = await fixture(t, { barricades: false }), on = await fixture(t, { barricades: false, gfx: { fixtures: 1 } });
  let checked = 0;
  on.world.rooms.forEach((rt, i) => {
    const was = off.world.rooms[i], fits = partsOf(rt).louvre.length ? rt.def.panels.length : 0;
    if (!fits) return;
    // every triangle the room has, less the fittings', is the room as it was less four per light (the two tiles), less
    // the flat quads (two triangles each, lit or dead), whatever batch they were in
    const tri = (w, r) => meshesOf(w, r).reduce((n, m) => n + m.geometry.index.count / 3, 0);
    const lamps = lit(rt).length, deadN = rt.def.panels.length - lamps;
    const vox = partsOf(rt).vox.reduce((n, m) => n + m.geometry.index.count / 3, 0) - partsOf(was).vox.reduce((n, m) => n + m.geometry.index.count / 3, 0);
    const tubes = GLOW_TRIS * lamps;
    assert.equal(tri(on.world, rt) - vox - tubes, tri(off.world, was) - 4 * rt.def.panels.length - 2 * rt.def.panels.length, `room ${rt.id} (${lamps} lit, ${deadN} dead)`);
    checked++;
  });
  assert.ok(checked > 10);
});

test('fixtures on: the tubes carry each lamp\'s bank, its flicker and the dimmer exactly as the flat panel did; dead lights stay dead', async (t) => {
  for (const lighting of ['failing', 'emergency', 'islands', 'travel', 'dim']) {
    const off = await fixture(t, { lighting }), on = await fixture(t, { lighting, gfx: { fixtures: 1 } });
    let banked = 0;
    on.world.rooms.forEach((rt, i) => {
      const was = off.world.rooms[i];
      assert.equal(rt.bankPanels.length, was.bankPanels.length, `room ${rt.id}: as many bank meshes as before`);
      if (!rt.lighting || !partsOf(rt).louvre.length) return;
      banked++;
      for (const m of rt.bankPanels) {
        const old = was.bankPanels.find((o) => o.userData.bank === m.userData.bank);
        assert.ok(old, 'the same bank');
        assert.deepEqual(m.material.color.toArray(), old.material.color.toArray(), 'the same glow, as power × tube colour');
        // (the red backup lamps' bank, lighting-fixtures.js, is their lenses: no ceiling light is in it, and it is as it was)
        if (m.userData.bank >= rt.lighting.ceilingBanks) { assert.equal(vertsOf(m), vertsOf(old)); assert.equal(m.material.map, on.kit.tex.white()); continue; }
        assert.ok(m.material.map === on.kit.tex.panel(true) && old.material.map === off.kit.tex.panel(true), 'the same texture (the tubes sit on its white strips)');
        // its tubes are the lights of that bank and no others: one set for each, where four corners were before
        assert.equal(vertsOf(m), (vertsOf(old) / 4) * GLOW_VERTS, `bank ${m.userData.bank}: one light's tubes and pan for every flat panel`);
        assert.equal(vertsOf(old) / 4, rt.lights.filter((l) => l.bank === m.userData.bank && l.lobe).length, 'one for every lamp of the bank');
      }
      // the bank failing: its tubes and its panel go dark together, the others stay (world.js refreshBanks, untouched)
      on.world.setLights(rt, 1); off.world.setLights(was, 1);
      for (const time of [0, 3, 11, 30]) {
        rt.lighting.cue = was.lighting.cue = undefined;
        on.world.updateLighting(time); off.world.updateLighting(time);
        assert.deepEqual(rt.lightLevels, was.lightLevels);
        rt.bankPanels.forEach((m, k) => assert.deepEqual(m.material.color.toArray(), was.bankPanels[k].material.color.toArray(), `${lighting} at ${time} s`));
      }
      // the housing and the louvre are lit by the room, bank by bank, as everything else in it
      for (const m of partsOf(rt).vox) assert.ok(m.geometry.attributes.aBank0 && m.geometry.attributes.aBank1, 'banked like the walls');
    });
    assert.ok(banked > 0, `${lighting}: some room has banks and fittings`);
  }
  // no banks: the dimmer turns the lit tubes down as it did the panel; a flickering one keeps its own mesh and stutters
  const off = await fixture(t, {}), on = await fixture(t, { gfx: { fixtures: 1 } });
  const rt = on.world.rooms.find((r) => r.panelMesh && r.flickers.length && partsOf(r).louvre.length), was = off.world.rooms[rt.id];
  for (const k of [1, 0.4, 0]) {
    on.world.setLights(rt, k); off.world.setLights(was, k);
    assert.deepEqual(rt.panelMesh.material.color.toArray(), was.panelMesh.material.color.toArray());
    assert.equal(rt.u.dim.value, was.u.dim.value);
  }
  rt.group.visible = was.group.visible = true;
  on.world.setLights(rt, 1); off.world.setLights(was, 1);
  for (const f of rt.flickers) assert.ok(f.userData.on && f.material.color.equals(f.userData.on));
  rt.phase = was.phase = 0;
  const random = Math.random; Math.random = () => 0.3;
  try { on.world.updateFlicker(0.5); off.world.updateFlicker(0.5); } finally { Math.random = random; }
  assert.deepEqual(rt.flickers.map((f) => f.material.color.toArray()), was.flickers.map((f) => f.material.color.toArray()));
  // a dead light's tubes are grey and lit by the room: in no glowing batch, and in the housing's
  for (const r of on.world.rooms) {
    if (!partsOf(r).louvre.length) continue;
    const glow = [r.panelMesh, ...r.flickers, ...r.bankPanels].filter(Boolean).reduce((n, m) => n + vertsOf(m), 0);
    assert.equal(glow, lit(r).length * GLOW_VERTS, `room ${r.id}: only the lit lights' tubes and pans glow`);
  }
  assert.ok(DEAD_TUBE_VERTS > 0 && DEAD_TUBE_VERTS !== TUBE_VERTS);
  // the pan's inside is what is seen from below (faces down or inward, above the trim), and with the rest is the whole housing
  assert.ok(PAN.inside.index.count > 0 && PAN.rest.index.count > 0);
  assert.equal(PAN.inside.index.count + PAN.rest.index.count, HOUSING.index.count);
  const p = PAN.inside.attributes.position, n = PAN.inside.attributes.normal;
  for (let i = 0; i < p.count; i++) assert.ok(p.getY(i) >= 1 && n.getY(i) < 0.5, 'nothing of the pan\'s back or the trim shines');
});

test('fixtures on: the louvre is detail (low hides it), nothing of a fitting stands in the room or throws a shadow, and each room stays within its budget', async (t) => {
  const on = await fixture(t, { gfx: { fixtures: 1, shadows: 1 } }), shadows = await fixture(t, { gfx: { shadows: 1 } });
  const louvres = [];
  for (const rt of on.world.rooms) louvres.push(...partsOf(rt).louvre);
  assert.ok(louvres.length > 10);
  assert.ok(louvres.every((m) => m.visible));
  assert.ok(showDetail(on.world.scene, profile('low')) >= louvres.length);
  assert.ok(louvres.every((m) => !m.visible), 'low leaves the blades out');
  showDetail(on.world.scene, profile('high'));
  assert.ok(louvres.every((m) => m.visible));
  on.world.rooms.forEach((rt, i) => {
    const was = shadows.world.rooms[i];
    // the tubes' shadows: what stands in the room is what it was; the maps are the same bytes
    assert.deepEqual(rt.shadowBoxes, was.shadowBoxes, `room ${rt.id}: nothing of a fitting is gathered as standing`);
    if (rt.lm?.A) assert.deepEqual([...rt.lm.A.data], [...was.lm.A.data]);
    const cost = roomCost(rt.group);
    assert.deepEqual(overBudget(cost, { lights: rt.lights.length }), [], `room ${rt.id}`);
    // a few draw calls, whatever the number of lights: at most the housing and the louvre more than before
    const before = roomCost(was.group);
    assert.ok(cost.meshes <= before.meshes + 1 && cost.detailMeshes <= before.detailMeshes + 1, `room ${rt.id}: ${before.meshes} → ${cost.meshes} meshes`);
  });
});

test('fixtures on: real rooms built by their own files (the copier room among them) stay within budget; generation does not move', async (t) => {
  const fresh = JSON.stringify(generate(7, { count: 0 }));
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
  const [a, b] = [await real(null), await real({ fixtures: 1 })];
  assert.equal(JSON.stringify(a.level), JSON.stringify(b.level), 'building with fittings changes nothing of the plan');
  assert.equal(JSON.stringify(generate(7, { count: 0 })), fresh);
  const copiers = b.world.rooms.find((rt) => rt.def.arch === 'copiers');
  assert.ok(copiers && partsOf(copiers).louvre.length === 1, 'the copier room has its fittings');
  b.world.rooms.forEach((rt, i) => {
    const was = a.world.rooms[i], cost = roomCost(rt.group), before = roomCost(was.group);
    if (!overBudget(before, { lights: was.lights.length, setPiece: isBig(ARCHETYPES[rt.def.arch]) }).length)
      assert.deepEqual(overBudget(cost, { lights: rt.lights.length, setPiece: isBig(ARCHETYPES[rt.def.arch]) }), [], `${rt.def.arch || rt.def.kind} #${rt.id}`);
    assert.ok(cost.meshes <= before.meshes + 1 && cost.detailMeshes <= before.detailMeshes + 1);
  });
  // the model, as the world draws it: half-size voxels, a panel of the ceiling's grid
  assert.equal(CEILING.voxel, 0.025 * CEILING.scale);
});
