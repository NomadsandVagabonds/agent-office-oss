import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Interoffice Mail (`in-tray`; a preview, docs/BLOCKROOMS-PREVIEWS.md): three letter trays the size of offices. It is an
// ordinary deck entry kept out of the deck (deck2.js MORE_DECK, on: false) until the dev page asks for &preview=intray; then it
// is built like any room. Uses the real kit, world, rooms and catalogue; canvas drawing is inert, no WebGL.
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
const [{ buildWorld, loadCatalogue }, { createKit }, G, { BUILDERS }, { MORE_DECK }, P, Lay] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href),
  import(new URL('rooms.js', B).href), import(new URL('deck2.js', B).href), import(new URL('plan.js', B).href),
  import(new URL('rooms/in-tray/layout.js', B).href)]);
const { generate, DECK, ARCHETYPES, STASH, wallPoint } = G;
const ID = 'in-tray', MEDIUM = { gfx: { contact: 1, bounce: 0.7, shadows: 1, doorlight: 1, fixtures: 1 } };
const entry = MORE_DECK.find((a) => a.id === ID);

test('out of the deck: not dealt, not in the plan, and an ordinary entry when it is let in', () => {
  assert.ok(entry && entry.on === false && entry.module === './rooms/in-tray.js');
  assert.ok(!DECK.some((a) => a.id === ID) && !ARCHETYPES[ID], 'not in the deck');
  for (const seed of [1, 7, 21, 'q']) assert.ok(!JSON.stringify(P.planVisit(seed, {})).includes(ID), `seed ${seed}: not in a visit`);
  assert.ok(!JSON.stringify(P.edition()).includes(ID), 'not in the edition');
  // the fields any dealt room has, nothing extra but the flag
  for (const k of ['name', 'landmark', 'w', 'd', 'ports', 'weight', 'lights', 'module', 'stash', 'roll']) assert.ok(k in entry, k);
  for (const W of [13, 15]) for (const side of [-1, 1]) { const r = { W, D: 14.5, H: 7, params: { side } }; assert.deepEqual(entry.stash(r), Lay.inTrayStash(r), 'the line\'s stash is the layout\'s'); }
  assert.equal(entry.weight, 1); assert.ok(!entry.big && !entry.planned && !entry.themes);
});

/** Let the room into the deck as the dev page does (at home on no floor: dealt only when asked for), for this file. */
function admit() { if (!ARCHETYPES[ID]) { DECK.push(ARCHETYPES[ID] = { ...entry, themes: { '*': 0 } }); STASH[ID] = entry.stash; } }

async function floor(seed, kitOpt = {}) {
  admit();
  const level = generate(seed, { only: [ID] }), builders = { ...BUILDERS };
  for (const id of new Set(level.rooms.map((r) => r.arch))) { const a = ARCHETYPES[id]; if (a?.module) { const mod = await import(new URL(a.module, B).href); if (mod.build) builders[id] = mod.build; } }
  const kit = createKit(kitOpt), said = [], warn = console.warn;
  const env = { level, kit, builders, catalogue: await loadCatalogue(kit), barricadesEnabled: true, lighting: false, plan: {}, preview: new Set(['intray']),
    cast: [], who: { name: 'Robin', look: { species: 'human' }, creations: {} }, hatches: new Map(), ready: [], play() {}, interfere() {}, sees: () => false, run: { met() {}, survived() {} }, end() {}, steadyLighting: () => false, difficulty: () => 'normal' };
  console.warn = (...a) => said.push(a.map(String).join(' '));
  try { const world = await buildWorld(kit, level, env); return { world, kit, said, rt: world.rooms.find((r) => r.def.arch === ID) }; }
  finally { console.warn = warn; }
}
const SEEDS = [7, 21, 3, 'q', 102, 11];

test('built: the way goes up, through the middle office, down the side and out; nothing traps, the budget holds', async () => {
  let throughs = 0;
  for (const seed of SEEDS) for (const kitOpt of [{}, MEDIUM]) {
    const { world, kit, said, rt } = await floor(seed, kitOpt), tag = `seed ${seed} ${kitOpt.gfx ? 'medium' : 'classic'}`;
    assert.ok(rt, `${tag}: dealt`);
    assert.deepEqual(said.filter((s) => /in-tray|letter/.test(s) || /could not be reached|now flat|would not load/.test(s)), [], `${tag}: ${said}`);
    const def = rt.def, L = rt.inTray, s = L.s, w = world.walkable(rt);
    assert.ok(rt.lights.length <= 16, `${tag}: ${rt.lights.length} lights`);
    // every doorway from every other
    const seen = w.flood([def.doors[0]]);
    for (const dr of def.doors) assert.ok(seen[w.key(wallPoint(def, dr.side, dr.c, 0.5))], `${tag}: its ${dr.side} doorway is reached`);
    // the places on the way, each reached, each at its height
    const at = (u, z) => ({ x: s * u, z }), reached = (p) => seen[w.key(p)] && w.free(p.x, p.z);
    const stops = { landing: at(L.uc + 0.6, (L.mezz.z0 + L.mezz.z1) / 2), middle: at(L.uc, (L.zd + L.zm) / 2), turn: at(L.us + 0.7, L.zd + 0.6),
      bottom: at(L.us + 0.7, L.zb + 0.7), lower: at(L.uc, L.zb + 1.8), atrium: at(L.uc + 2.5, L.up.z1 + 0.6) };
    const want = { landing: L.Y1, middle: L.Y1, turn: L.Y1, bottom: 0, lower: 0, atrium: 0 };
    for (const [k, p] of Object.entries(stops)) {
      assert.ok(reached(p), `${tag}: ${k} reached`);
      assert.ok(Math.abs(w.floor(p.x, p.z) - want[k]) < 0.01, `${tag}: ${k} at ${want[k]} (${w.floor(p.x, p.z)})`);
      assert.ok(w.head(p.x, p.z) > 1.9, `${tag}: standing room at ${k}`);
    }
    // the part of the lower office under the middle one, and the gaps behind the trays: never stood in
    for (const p of [at(L.uc, (L.zd + L.zl) / 2 + 0.3), at(L.uo - 0.2, L.zd + 1), at(L.us + 0.7, (L.zd + L.zm) / 2)]) {
      const k = w.key(p); if (!seen[k]) continue;
      assert.ok(Math.abs(w.floor(p.x, p.z) - L.Y1) < 0.01, `${tag}: (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) is only reached on the middle level`);
    }
    // a body can stand nowhere the drawing has a wall: the middle office's short sidewall and the lower one's
    for (const [u, z] of [[L.us + 0.05, (L.turn.z1 + L.zm) / 2], [L.us + 0.05, (L.hole.z1 + L.zd) / 2], [L.uo - 0.05, -1]]) assert.ok(!w.free(s * u, z), `${tag}: a wall at (${u}, ${z})`);
    if (def.doors.some((d) => d.side === 'back')) throughs++;
    world.dispose(); kit.dispose();
  }
  assert.ok(throughs > 0, 'on some floor the lower office\'s door is the way on');
});

test('the plan: the walked offices never lie over one another; the stairs are stairs', () => {
  for (const [W, D, H] of [[13, 14, 6.9], [15, 15, 7.2]]) for (const side of [-1, 1]) {
    const L = Lay.layout(W, D, H, { side });
    assert.ok(L.zd < L.zl && L.zl < L.zm && L.mezz.z1 < L.up.z1 && L.up.z1 < D / 2 - 1.2, 'in order, with room at the door');
    assert.ok(L.down.z0 > L.hole.z1 - 0.01, 'the stair down ends beside the opening');
    for (let z = L.down.z0; z < L.down.z1; z += 0.02) { const a = Lay.floorIn(L, L.us + 0.7, z), b = Lay.floorIn(L, L.us + 0.7, z + 0.02); assert.ok(Math.abs(a - b) < 0.24); }
    for (let z = L.up.z0; z < L.up.z1 + 0.1; z += 0.02) { const a = Lay.floorIn(L, L.uc + 0.6, z), b = Lay.floorIn(L, L.uc + 0.6, z + 0.02); assert.ok(Math.abs(a - b) < 0.24); }
    assert.ok(L.CL - 0 > 2.1 && L.CM - L.Y1 > 2.1, 'headroom in both offices');
    const st = Lay.inTrayStash({ W, D, H, params: { side } });
    assert.equal(Lay.floorIn(L, side * (st[0] + st[2]) / 2, (st[1] + st[3]) / 2), 0, 'the stash is on the lower office\'s floor');
  }
});
