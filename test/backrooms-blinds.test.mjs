import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// Borrowed Daylight (rooms/blinds.js; a preview, docs/BLOCKROOMS-PREVIEWS.md): a wheeled Venetian blind in a windowless
// room still throwing slats of late sun across the carpet and up the false wall into a recessed hall, a paper cup in the
// light. Out of every deal (`on: false`) until the dev page's &preview=blinds puts it in the deck (preview-deck.js).
// Uses the real kit, world and catalogue; canvas drawing is inert, no WebGL.
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
const [{ buildWorld, loadCatalogue }, { createKit }, G, { BUILDERS }, { MORE_DECK }, P, SUN, { edition }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href),
  import(new URL('rooms.js', B).href), import(new URL('deck2.js', B).href), import(new URL('preview-deck.js', B).href),
  import(new URL('rooms/blinds/sun.js', B).href), import(new URL('plan.js', B).href)]);
const { generate, ARCHETYPES, DECK, wallPoint } = G;
const MEDIUM = { gfx: { contact: 1, bounce: 0.7, shadows: 1, doorlight: 1, fixtures: 1 } };
const SEEDS = [7, 21, 3, 11, 'q', 102, 1, 40];

// (before anything is put in the deck for the preview: what the game sees)
const before = { deck: DECK.map((a) => a.id).join(), edition: edition(), floors: [7, 3, 'q'].map((s) => JSON.stringify(generate(s, {}).rooms.map((r) => [r.arch || r.kind, r.x, r.z, r.w, r.d]))) };

test('out of the deck: on: false, and nothing in the game reaches the preview', () => {
  const a = MORE_DECK.find((e) => e.id === 'blinds');
  assert.ok(a && a.on === false && a.preview === 'blinds', 'a line in MORE_DECK, retired, with its preview flag');
  assert.ok(!DECK.some((e) => e.id === 'blinds') && !ARCHETYPES.blinds, 'not dealt');
  assert.equal(a.weight, 1, 'an ordinary weight, for the day it is dealt'); assert.equal(a.themes, undefined, 'and no favourite kind of floor');
  for (const f of ['gen.js', 'plan.js', 'world.js', 'index.js', 'rooms.js']) assert.ok(!/preview-deck|rooms\/blinds/.test(readFileSync(new URL(f, B), 'utf8')), `${f} does not reach the preview`);
  assert.match(readFileSync(new URL('../dev/backrooms.js', B), 'utf8'), /preview-deck\.js'\)\)\.enlist\(/, 'the dev page deals it');
});

test('dealPreviewRooms: only for its own flag, once, and the room is then dealt like any other', () => {
  assert.deepEqual(P.dealPreviewRooms(['clip', 'floorlight']), [], 'another preview deals nothing');
  assert.ok(!ARCHETYPES.blinds);
  assert.deepEqual(P.dealPreviewRooms(['blinds']), ['blinds']);
  assert.deepEqual(P.dealPreviewRooms(['blinds']), [], 'not twice');
  assert.ok(ARCHETYPES.blinds && DECK.some((a) => a.id === 'blinds') && typeof G.STASH.blinds === 'function');
  for (const seed of SEEDS) {
    const r = generate(seed, { only: ['blinds'] }).rooms.find((q) => q.arch === 'blinds');
    assert.ok(r, `seed ${seed}: dealt when asked for`);
    assert.deepEqual(Object.keys(r.params).sort(), ['along', 'az', 'cup']);
  }
});

test('the light: the floor, the false wall and the jamb of the hall, and none of it behind the blind or through a wall', () => {
  for (const [W, D] of [[10, 9], [11, 11], [10.6, 10.2]]) for (const door of [{ c: 0, w: 1.8 }, { c: 0, w: 1 }, null]) {
    const L = SUN.layout(W, D, 2.6, {}, door), parts = SUN.pieces(L);
    const on = (pred) => parts.filter((q) => pred(q));
    assert.ok(on((q) => q.n[1] === 1 && !q.gate).length === 1, 'on the carpet');
    const wall = on((q) => q.n[0] === -1 && !q.gate);
    assert.ok(wall.length >= 1 && Math.max(...wall.flatMap((q) => q.pts.map((x) => x[1]))) > 1.4, `it climbs the false wall (${W} × ${D})`);
    const jamb = on((q) => q.gate && q.n[2] === 1);
    assert.ok(jamb.length >= 1, 'it picks out the jamb at the back of the hall\'s mouth');
    for (const q of parts) for (const X of q.pts) {
      assert.ok(Math.abs(X[0]) <= W / 2 + 1e-6 && Math.abs(X[2]) <= D / 2 + 1e-6 && X[1] >= 0 && X[1] <= 2.6, 'inside the room');
      if (!q.gate) assert.ok(X[0] <= L.xf + 1e-3, 'none of it past the false wall but through the mouth');
      const th = SUN.through(L, X);
      assert.ok(th.t > 0 && Math.abs(th.fx) < SUN.BLIND.across / 2 + 0.2 && th.fy > SUN.BLIND.y0 - 0.2 && th.fy < SUN.BLIND.y1 + 0.2, 'every bit of it came through the blind');
    }
  }
});

test('the slats: the light is in bands, as many as there are gaps, and the cup takes a long shadow out of one', () => {
  const L = SUN.layout(10.5, 10, 2.6, {}, { c: 0, w: 1.8 }), slats = SUN.slatsOf();
  // down the wall, on a line under the middle of the opening's image: lit, dark, lit…
  const span = (q) => Math.max(...q.pts.map((x) => x[1])) - Math.min(...q.pts.map((x) => x[1]));
  const ys = [], hit = SUN.pieces(L).filter((q) => q.n[0] === -1 && !q.gate && q.pts.every((x) => x[2] > L.zm1 - 1e-6)).sort((a, b) => span(b) - span(a))[0];
  const zc = hit.pts.reduce((m, x) => m + x[2], 0) / hit.pts.length;
  let bands = 0, was = false;
  for (let y = 0.12; y < 2.4; y += 0.002) { const k = SUN.lightAt(L, [L.xf, y, zc], slats); ys.push(k); const now = k > 0.5; if (now && !was) bands++; was = now; }
  assert.ok(bands >= 5 && bands <= slats.length + 1, `bands up the wall: ${bands}`);
  assert.ok(Math.max(...ys) > 0.95 && Math.min(...ys) < 0.05, 'crisp: full light and full shadow');
  const cup = SUN.cupOf(1.0, 0.0, 0.5);
  const dir = SUN.through(L, [1.0, 0.0, 0.0]).dir, along = Math.hypot(dir[0], dir[2]);
  const behind = [1.0 + (dir[0] / along) * 0.25, 0.0, 0.0 + (dir[2] / along) * 0.25];
  assert.ok(SUN.cupShade(L, behind, cup) > 0.9, 'a quarter of a metre past the cup, down the light, is in its shadow');
  assert.ok(SUN.cupShade(L, [1.0 - dir[0] / along * 0.25, 0, -dir[2] / along * 0.25], cup) < 0.01, 'and in front of it is not');
  assert.ok(SUN.cupShade(L, [1.0 + dir[2] / along * 0.3, 0, -dir[0] / along * 0.3], cup) < 0.01, 'nor beside it');
});

/** A floor with the room on it, built as the game builds it. */
async function floor(seed, kitOpt = {}) {
  const level = generate(seed, { only: ['blinds'] }), builders = { ...BUILDERS };
  for (const id of new Set(level.rooms.map((r) => r.arch))) { const a = ARCHETYPES[id]; if (a?.module) { const mod = await import(new URL(a.module, B).href); if (mod.build) builders[id] = mod.build; } }
  const kit = createKit(kitOpt), said = [], warn = console.warn;
  const env = { level, kit, builders, catalogue: await loadCatalogue(kit), barricadesEnabled: true, lighting: false, plan: {}, preview: new Set(['blinds']),
    cast: [], who: { name: 'Robin', look: { species: 'human' }, creations: {} }, hatches: new Map(), ready: [], play() {}, interfere() {}, sees: () => false, run: { met() {}, survived() {} }, end() {}, steadyLighting: () => false, difficulty: () => 'normal' };
  console.warn = (...a) => said.push(a.map(String).join(' '));
  try { const world = await buildWorld(kit, level, env); return { world, kit, said, rt: world.rooms.find((r) => r.def.arch === 'blinds') }; }
  finally { console.warn = warn; }
}

test('built: it stands, every doorway is reached, the route goes past the blind and round the jamb, within budget', async () => {
  let doors = 0;
  for (const seed of SEEDS) for (const kitOpt of [{}, MEDIUM]) {
    const { world, kit, said, rt } = await floor(seed, kitOpt), tag = `seed ${seed} ${kitOpt.gfx ? 'medium' : 'classic'}`;
    assert.ok(rt, `${tag}: on the floor`);
    assert.deepEqual(said.filter((s) => /blinds/.test(s) && /would not|could not be reached|now flat/.test(s)), [], `${tag}: ${said}`);
    const def = rt.def, L = rt.blinds.layout, w = world.walkable(rt), seen = w.flood([def.doors[0]]);
    for (const dr of def.doors) assert.ok(seen[w.key(wallPoint(def, dr.side, dr.c, 0.5))], `${tag}: its ${dr.side} doorway is reached`);
    const right = def.doors.find((d) => d.side === 'right');
    if (right) {
      doors++;
      assert.ok(right.c - right.w / 2 > L.zm0 + 0.05 && right.c + right.w / 2 < L.zd, `${tag}: the way on is off the hall's leg along the outer wall`);
      // the hall is walked: in at the mouth, along the leg, out of the doorway
      for (const z of [(L.zm0 + L.zm1) / 2]) assert.ok(seen[w.key({ x: (L.xf + L.xo) / 2, z })], `${tag}: the hall's mouth`);
    }
    assert.ok(rt.lights.length <= 16, `${tag}: lights ${rt.lights.length}`);
    const { roomCost, overBudget } = await import(new URL('budget.js', B).href);
    assert.deepEqual(overBudget(roomCost(rt.group)), [], `${tag}: within budget`);
    assert.ok(rt.blinds.pieces.length >= 4, `${tag}: the light falls`);
    assert.ok(SUN.lightAt(L, [rt.blinds.cup.x, 0.01, rt.blinds.cup.z], rt.blinds.slats) > 0.5, `${tag}: the cup lies in the light`);
    assert.ok(Math.abs(rt.blinds.cup.x - L.xf) > 0.5 && Math.abs(rt.blinds.cup.x) < def.W / 2 - 0.3 && Math.abs(rt.blinds.cup.z) < def.D / 2 - 0.3, `${tag}: on the room's own carpet`);
    world.dispose(); kit.dispose();
  }
  // (`ports: ['right']` may give it the doorway, as for any room; without one the hall is a dead end with its dead light)
  assert.ok(doors >= SEEDS.length, `the way on through the hall was there on half these floors or more (${doors / 2} of ${SEEDS.length})`);
});

test('the room rolls only what its line says, and the preview code rolls nothing and reaches for nothing', () => {
  const src = readFileSync(new URL('rooms/blinds.js', B), 'utf8') + readFileSync(new URL('rooms/blinds/sun.js', B), 'utf8') + readFileSync(new URL('preview-deck.js', B), 'utf8');
  assert.ok(!/Math\.random|\bc\.R\b|\bR\(|\.spot\(|\.wallSpot\(|\.corner\(/.test(src), 'nothing random or seeded beyond the params');
});

test('without the preview the game is what it was: the deck, the edition, the floors', async () => {
  // (this file put the room in the deck above, so the deck is checked against what it was before; and in a fresh process)
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', `
    const G = await import(${JSON.stringify(new URL('gen.js', B).href)}); const { edition } = await import(${JSON.stringify(new URL('plan.js', B).href)});
    console.log(JSON.stringify({ deck: G.DECK.map((a) => a.id).join(), edition: edition(), floors: [7, 3, 'q'].map((s) => JSON.stringify(G.generate(s, {}).rooms.map((r) => [r.arch || r.kind, r.x, r.z, r.w, r.d]))) }));`], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out), before);
  assert.ok(!before.deck.split(',').includes('blinds'));
});
