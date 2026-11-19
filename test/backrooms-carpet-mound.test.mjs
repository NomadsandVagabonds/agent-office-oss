import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createHash } from 'node:crypto';

// Carpet Allowance (rooms/carpet-mound.js; a preview, docs/BLOCKROOMS-PREVIEWS.md): the wall-to-wall carpet cut too
// long, risen in one great pleat down the room. Not in the deck: the dev page's &preview=mound puts its line in for that
// page (preview-deck.js). Uses the real kit, world, rooms and catalogue; canvas drawing is inert, no WebGL.
const root = new URL('../', import.meta.url), three = new URL('public/vendor/three.module.min.js', root);
const loader = `export async function resolve(s,c,next){
  if(s==='three')return {url:${JSON.stringify(three.href)},shortCircuit:true};
  if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};
  return next(s,c);
}`;
register(`data:text/javascript;base64,${Buffer.from(loader).toString('base64')}`, import.meta.url);
const draw = new Proxy({}, { get: (_, name) => name === 'measureText' ? (t) => ({ width: String(t).length * 6 })
  : /Gradient|Pattern/.test(name) ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
globalThis.document ??= { createElement: () => ({ getContext: () => draw, style: {} }) };

const B = new URL('public/world/backrooms/', root);
const [{ buildWorld, loadCatalogue }, { createKit }, G, { BUILDERS }, P, Lay, { planVisit }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href),
  import(new URL('rooms.js', B).href), import(new URL('preview-deck.js', B).href), import(new URL('rooms/carpet-mound/layout.js', B).href),
  import(new URL('plan.js', B).href)]);
const ID = 'carpet-mound', MEDIUM = { gfx: { contact: 1, bounce: 0.7, shadows: 1, doorlight: 1, fixtures: 1 } };

// (before anything enlists it: what the deck and the plan are without the preview)
const deckBefore = G.DECK.map((a) => a.id).join(), planBefore = JSON.stringify(planVisit(7, {}));

test('without the flag it is in no deck, no visit and no floor; asking for another preview adds nothing', async () => {
  assert.ok(!G.DECK.some((a) => a.id === ID) && !G.ARCHETYPES[ID] && !G.STASH[ID]);
  assert.deepEqual(P.enlist([]), []); assert.deepEqual(P.enlist(['clip', 'floorlight']), []);
  assert.equal(G.DECK.map((a) => a.id).join(), deckBefore);
  assert.equal(JSON.stringify(planVisit(7, {})), planBefore, 'the visit is dealt as it was');
  for (const seed of [7, 21, 3]) assert.ok(!G.generate(seed, {}).rooms.some((r) => r.arch === ID));
});

test('its deck line is an ordinary one: no special weighting, its own module, a stash inside its walls', async () => {
  const { MORE_DECK } = await import(new URL('deck2.js', B).href), line = MORE_DECK.find((q) => q.id === ID);
  assert.equal(line.on, false, 'in MORE_DECK, out of the deck as a retired room is');
  const a = Lay.CARPET_MOUND;
  assert.equal(a.weight, 1); assert.equal(a.module, './rooms/carpet-mound.js');
  for (const k of ['planned', 'headline', 'big', 'halo', 'gate', 'on', 'themes']) assert.equal(a[k], undefined, k);
  for (const side of [-1, 1]) for (const [W, D] of [[8, 10], [10, 12]]) {
    const [x0, z0, x1, z1] = a.stash({ W, D, params: { side } });
    assert.ok(x0 > -W / 2 && x1 < W / 2 && z0 > -D / 2 && z1 < D / 2);
  }
});

test('the fold: the gap under it is tall enough to duck into, its sheet keeps its thickness, its cut edges step', () => {
  const L = Lay.layout(8, 11, { side: 1, sag: 0.07 });
  for (const z of [L.z0, (L.z0 + L.z1) / 2, L.z1]) {
    const crown = Lay.inner(L, 0, z);
    assert.ok(crown > 1.3 && crown < 1.6, `standing room under the crown (${crown})`);
    assert.ok(Lay.reach(L, 0.62, z) * 2 > 1.5, 'a gap wider than a body where a body gets through');
    for (let d = -1.8; d <= 1.8; d += 0.05) assert.ok(Lay.outer(L, d, z) >= Lay.inner(L, d, z) + 0.099 || Lay.inner(L, d, z) === 0, `the sheet keeps its thickness at ${d}`);
  }
  const cols = Lay.columns(L, L.z0);
  for (const q of cols) for (const y of [q.y0, q.y1]) assert.ok(Math.abs(y / Lay.MOUND.v - Math.round(y / Lay.MOUND.v)) < 1e-6, 'on the voxel step');
  assert.ok(new Set(cols.map((q) => q.y1)).size > 15, 'the edge steps up and down');
  // its foot keeps the aisle on its own side, and the walk round on the other is wider
  for (const W of [8, 9, 10]) for (const side of [-1, 1]) { const M = Lay.layout(W, 11, { side }); assert.ok(W / 2 - Math.abs(M.xc) - Lay.MOUND.ro >= 1.2 - 1e-9); assert.ok(W / 2 + Math.abs(M.xc) - Lay.MOUND.ro > 2.4); }
});

/** A floor with the room dealt, built as the game builds it. */
async function floor(seed, kitOpt = {}) {
  P.enlist(['mound']);
  const level = G.generate(seed, { only: [ID] }), builders = { ...BUILDERS };
  for (const id of new Set(level.rooms.map((r) => r.arch))) { const a = G.ARCHETYPES[id]; if (a?.module) { const mod = await import(new URL(a.module, B).href); if (mod.build) builders[id] = mod.build; } }
  const kit = createKit(kitOpt), said = [], warn = console.warn;
  const env = { level, kit, builders, catalogue: await loadCatalogue(kit), barricadesEnabled: true, lighting: false, plan: {}, preview: new Set(['mound']),
    cast: [], who: { name: 'Robin', look: { species: 'human' }, creations: {} }, hatches: new Map(), ready: [], play() {}, interfere() {}, sees: () => false, run: { met() {}, survived() {} }, end() {}, steadyLighting: () => false, difficulty: () => 'normal' };
  console.warn = (...a) => said.push(a.map(String).join(' '));
  try { const world = await buildWorld(kit, level, env); return { world, kit, said, rt: world.rooms.find((r) => r.def.arch === ID) }; }
  finally { console.warn = warn; }
}
const SEEDS = [7, 21, 3, 11, 'q', 102];

test('built: every doorway reached, under the fold and round it; colliders where the sheet is; the duck under its sides', async () => {
  for (const seed of SEEDS) for (const kitOpt of [{}, MEDIUM]) {
    const f = await floor(seed, kitOpt), tag = `seed ${seed} ${kitOpt.gfx ? 'medium' : 'classic'}`;
    assert.ok(f.rt, `${tag}: on the floor`);
    assert.deepEqual(f.said.filter((s) => /carpet-mound|could not be reached|now flat/.test(s)), [], `${tag}: ${f.said}`);
    const { def } = f.rt, L = f.rt.mound.layout, w = f.world.walkable(f.rt), seen = w.flood([def.doors[0]]);
    for (const dr of def.doors) assert.ok(seen[w.key(G.wallPoint(def, dr.side, dr.c, 0.5))], `${tag}: its ${dr.side} doorway is reached`);
    // the way under: from one mouth to the other along its middle line, every cell reached and with headroom to duck through
    for (let z = L.z0 + 0.1; z < L.z1 - 0.1; z += 0.25) {
      const k = w.key({ x: L.xc, z });
      assert.ok(seen[k], `${tag}: under the fold at z ${z.toFixed(2)}`);
      assert.ok(w.head(L.xc, z) > 1.25, `${tag}: room to stand under the crown`);
    }
    // nobody stands inside the sheet: where the gap is lower than a duck, or on the flank, nothing is free
    for (let z = L.z0; z <= L.z1; z += 0.5) for (const k of [-1, 1]) {
      for (let d = 0; d <= 1.8; d += 0.05) {
        const x = L.xc + k * d, h = Lay.inner(L, d, z), o = Lay.outer(L, d, z);
        if (o > 0.15 && h < 0.62) assert.ok(!w.free(x, z), `${tag}: a body inside the carpet at d=${d.toFixed(2)} z=${z.toFixed(2)}`);
      }
      const duck = L.xc + k * (Lay.reach(L, 0.9, z) + 0.05);
      if (w.free(duck, z)) assert.ok(w.head(duck, z) < 1.3, `${tag}: under its side the visitor ducks`);
    }
    // the walk round, on the open side, is clear its whole length
    const wx = L.xc - L.s * (Lay.MOUND.ro + 0.6);
    for (let z = -def.D / 2 + 0.5; z < def.D / 2 - 0.5; z += 0.25) assert.ok(seen[w.key({ x: wx, z })], `${tag}: the walk round at z ${z.toFixed(2)}`);
    assert.ok(f.rt.lights.length <= 16, `${tag}: the light budget`);
    f.world.dispose(); f.kit.dispose();
  }
});

const hash = (rt, world) => {
  const h = createHash('sha1'), meshes = [];
  rt.group.traverse((o) => { if (o.isMesh && o.geometry) meshes.push(o); });
  for (const f of world.furniture) if (f.room === rt.id) f.group.traverse((o) => { if (o.isMesh && o.geometry) meshes.push(o); });
  for (const m of meshes) for (const a of Object.values(m.geometry.attributes)) h.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength));
  h.update(JSON.stringify(rt.colliders.map((q) => [q.x0, q.z0, q.x1, q.z1, q.on]))); h.update(JSON.stringify(rt.lights)); h.update(JSON.stringify(rt.amb));
  return h.digest('hex');
};

test('the room reads nothing seeded but its own roll and the shell\'s: built twice, the same to the byte', async () => {
  const a = await floor(7), b = await floor(7);
  assert.equal(hash(a.rt, a.world), hash(b.rt, b.world));
  for (const f of [a, b]) { f.world.dispose(); f.kit.dispose(); }
});

test('the game never reaches the preview: nothing but the dev page imports preview-deck.js or the room', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('public/world/backrooms/', root);
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(name, dir), 'utf8');
    if (name !== 'preview-deck.js') assert.ok(!/(from\s*|import\s*\()\s*['"][^'"]*preview-deck/.test(src), `${name} reaches the preview`);
  }
});
