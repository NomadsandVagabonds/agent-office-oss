import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Please Be Seated (rooms/giant-chair.js; a preview, docs/BLOCKROOMS-PREVIEWS.md "Please Be Seated"): a long hall that
// ends in what looks like a dark-brown doorway and is the space under one enormous chair. Its deck entry is kept in
// preview-deck.js, out of DECK: no visit, plan or edition() has it; the dev page's &preview=chair lets it into
// ARCHETYPES so that &room=giant-chair can deal it. Uses the real kit, world, rooms and catalogue; canvas drawing is
// inert, no WebGL.
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
const [{ buildWorld, loadCatalogue }, { createKit }, gen, { BUILDERS }, { admitPreviews, MORE_DECK }, { planVisit, floorOf }, budget, chair] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('rooms.js', B).href),
  import(new URL('preview-deck.js', B).href).then(async (m) => ({ ...m, MORE_DECK: (await import(new URL('deck2.js', B).href)).MORE_DECK })), import(new URL('plan.js', B).href), import(new URL('budget.js', B).href), import(new URL('rooms/giant-chair.js', B).href)]);
const frame = await import(new URL('frame.js', B).href);
const { DECK, ARCHETYPES, STASH, wallPoint } = gen, { SEATED, layout } = chair;
const ID = 'giant-chair', EYE = 1.1, RADIUS = 0.22;
const MEDIUM = { gfx: { contact: 1, bounce: 0.7, shadows: 1, doorlight: 1, fixtures: 1 } };

test('not in the deck: nothing deals it, and only the dev page\'s flag lets it in', () => {
  assert.ok(!DECK.some((a) => a.id === ID), 'not in DECK');
  assert.equal(ARCHETYPES[ID], undefined, 'not an archetype until let in');
  assert.deepEqual(admitPreviews([]), []); assert.deepEqual(admitPreviews(['clip', 'floorlight']), []);
  assert.equal(ARCHETYPES[ID], undefined, 'another preview does not let it in');
  const entry = MORE_DECK.find((a) => a.id === ID);
  assert.equal(entry.on, false, 'waiting, as a retired room is');
  assert.equal(entry.weight, 1, 'weighted as an ordinary room, for when it is dealt');
  assert.equal(entry.module, `./rooms/${ID}.js`);
  // a visit planned with nothing asked for never has it (it is not in the deck it is dealt from)
  for (const seed of [7, 21, 3]) { const v = planVisit(seed, { name: 'Robin' }); for (let i = 0; i < v.depths; i++) assert.ok(!floorOf(v, i).rooms.some((r) => r.arch === ID)); }
});

test('the layout: the rear legs are the hall\'s jambs, the stretcher a lintel to walk under, the back goes up through the hole', () => {
  for (const [W, D] of [[7.8, 25.8], [8.8, 27.8]]) {
    const H = 4.4, L = layout(W, D, H), [rl, rr, fl, fr] = L.legs;
    assert.equal(rl.x1, -SEATED.hall); assert.equal(rr.x0, SEATED.hall);
    assert.ok(Math.abs(rl.z1 - L.zM) < 0.06, 'the rear legs stand at the hall\'s mouth');
    assert.ok(fl.z0 < rl.z0 - 2 && fr.z0 === fl.z0, 'two and a half metres under the seat');
    assert.ok(SEATED.lintel[0] > EYE + 0.6, 'the stretcher is well over anybody\'s head');
    assert.ok(SEATED.back > H + 1 && SEATED.back < H + SEATED.gap, 'the back goes up through the ceiling, and stops inside the gap');
    assert.ok(L.hole.x0 < -SEATED.hall - SEATED.leg && L.hole.x1 > SEATED.hall + SEATED.leg, 'the hole is wider than the chair');
    assert.ok(L.hole.z0 < L.zb - 0.55 && L.hole.z1 >= L.zb - 0.15, 'the back is inside the hole');
    assert.ok(L.zf - (-D / 2) > 4.5, 'room in front of the chair before the far wall');
    assert.ok(L.panels.length >= 3 && L.panels.every((z) => z > L.zM && z < L.zS), 'the hall has its row of panels');
    assert.ok(L.zS - L.zM >= 8, `a long hall (${(L.zS - L.zM).toFixed(1)} m)`); assert.ok(D / 2 - L.zW >= 6, 'a wide room to come in by');
    assert.ok(L.squeeze.x1 - L.squeeze.x0 < SEATED.hall * 2 && L.recess.x0 > L.squeeze.x1 && L.recess.x1 - L.recess.x0 >= 0.8 && L.recess.z1 - L.recess.z0 >= 0.7, 'a squeeze narrower than the hall, a recess beside it a chair fits in');
    assert.ok(L.squeeze.x1 - (L.chair.x + 0.325) >= 0.6, 'and a sidle past the chair: the chair is 0.65 m across');
    // the far wall of the wide room steps in to the squeeze: each column deeper the further it is from the middle
    for (const sx of [-1, 1]) {
      const cols = L.funnel.filter((f) => Math.sign(f.x0 + f.x1) === sx).sort((a, b) => Math.abs(a.x0 + a.x1) - Math.abs(b.x0 + b.x1));
      assert.ok(cols.length >= 2 && cols.every((f, i) => i === 0 || f.z1 > cols[i - 1].z1), 'the far wall curves in, a step at a time');
      for (const f of cols) assert.ok(Math.min(Math.abs(f.x0), Math.abs(f.x1)) >= (sx > 0 ? L.recess.x1 : -L.squeeze.x0) - 1e-9, 'and leaves the squeeze and its recess open');
    }
    assert.ok(Math.abs(((L.chamber[0][1] - L.zM) / 0.6) - Math.round((L.chamber[0][1] - L.zM) / 0.6)) < 1e-9, 'panels on the tile grid');
  }
});

/** Does the segment (z, y) a → b pass through the box { z0, z1, y0, y1 }? (a slab test, in the plane down the hall) */
function crosses(a, b, q) {
  let t0 = 0, t1 = 1;
  for (const [p, d, lo, hi] of [[a[0], b[0] - a[0], q.z0, q.z1], [a[1], b[1] - a[1], q.y0, q.y1]]) {
    if (Math.abs(d) < 1e-12) { if (p <= lo || p >= hi) return false; continue; }
    let u = (lo - p) / d, v = (hi - p) / d; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 >= t1) return false;
  }
  return t1 - t0 > 1e-6;
}

test('the sightline at standing eye height: from the hall (until a metre from its end), nothing of the chair over its seat can be seen', () => {
  for (const D of [25.8, 27.8]) {
    const H = 4.4, L = layout(8, D, H), S = SEATED;
    // what is in the way: the hall's ceiling and the wall over its mouth, the seat (its rails and board) and the cushion
    const block = [{ z0: L.zM, z1: D / 2, y0: S.hallH, y1: 99 }, { z0: L.zf, z1: L.zb, y0: S.under, y1: S.cushion[0] }, { z0: L.zf - 0.06, z1: L.zb - 0.5, y0: S.cushion[0], y1: S.cushion[1] },
      { z0: L.zb - 0.15, z1: L.zb, y0: S.cushion[0], y1: S.cushion[0] + 0.5 }, { z0: L.zb - 0.55, z1: L.zb - 0.15, y0: S.cushion[1], y1: S.back }];
    // what would give it away: anything of the back, the arms, the hole's edge, the top of the cushion
    const tells = [];
    for (let y = S.cushion[1] + 0.02; y < S.back; y += 0.1) tells.push([L.zb - 0.56, y], [L.zb - 0.14, y + 0.5]);
    for (let z = L.zf; z < L.zb - 0.6; z += 0.1) tells.push([z, S.arm[1]], [z, S.cushion[1] + 0.001]);
    for (let y = S.cushion[0]; y < S.arm[0]; y += 0.1) tells.push([L.zf + 0.05, y]);
    for (let z = L.hole.z0; z <= L.hole.z1; z += 0.1) tells.push([z, H - 0.001]);
    let looked = 0;
    for (let ze = L.zM + 1; ze <= D / 2 - 0.3; ze += 0.25) for (const t of tells) {
      const eye = [ze, EYE]; looked++;
      assert.ok(block.some((q) => crosses(eye, t, q)), `D ${D}: from ${(ze - L.zM).toFixed(2)} m back up the hall, (${t[0].toFixed(2)}, ${t[1].toFixed(2)}) is in sight`);
    }
    assert.ok(looked > 2000);
  }
});

/** A floor with the room dealt where you land, built as the game builds it. */
async function floor(seed, kitOpt = {}) {
  admitPreviews(['chair']);
  const level = floorOf(planVisit(seed, { name: 'Robin', only: [ID] }), 0), builders = { ...BUILDERS };
  for (const id of new Set(level.rooms.map((r) => r.arch))) { const a = ARCHETYPES[id]; if (a?.module) { const mod = await import(new URL(a.module, B).href); if (mod.build) builders[id] = mod.build; } }
  const kit = createKit(kitOpt), said = [], warn = console.warn;
  const env = { level, kit, builders, catalogue: await loadCatalogue(kit), barricadesEnabled: true, lighting: false, plan: {}, preview: new Set(['chair']),
    cast: [], who: { name: 'Robin', look: { species: 'human' }, creations: {} }, hatches: new Map(), ready: [], play() {}, interfere() {}, sees: () => false, run: { met() {}, survived() {} }, end() {}, steadyLighting: () => false, difficulty: () => 'normal' };
  console.warn = (...a) => said.push(a.map(String).join(' '));
  try { const world = await buildWorld(kit, level, env); return { world, kit, said, rt: world.rooms.find((r) => r.def.arch === ID) }; }
  finally { console.warn = warn; }
}

test('built: it builds clean at Classic and Medium, within its budget, and everybody gets through it', async () => {
  for (const seed of [7, 3, 'q', 13]) for (const kitOpt of [{}, MEDIUM]) {
    const { world, kit, said, rt } = await floor(seed, kitOpt), tag = `seed ${seed} ${kitOpt.gfx ? 'medium' : 'classic'}`;
    try {
      assert.ok(rt, `${tag}: dealt`);
      assert.deepEqual(said.filter((s) => /giant-chair|Please Be Seated/.test(s) || (/could not be reached/.test(s) && s.includes(`room ${rt.def.id}`))), [], `${tag}: ${said}`);
      assert.equal(typeof STASH[ID], 'function', 'its hiding place is known once it is let in');
      const def = rt.def, L = rt.seated.layout;
      assert.ok(rt.lights.length <= 16, `${tag}: ${rt.lights.length} lights`);
      const cost = budget.roomCost(rt.group); assert.deepEqual(budget.overBudget(cost), [], `${tag}: ${JSON.stringify(cost)}`);
      // the colliders: the walls of the hall, and exactly the four legs drawn
      const legs = rt.colliders.filter((q) => q.tall && q.on !== false && !q.keep && Math.abs(q.top - (def.y || 0) - SEATED.under) < 1e-6);
      assert.equal(legs.length, 4, `${tag}: the four legs are solid, and nothing else of the chair is`);
      for (const q of legs) assert.ok(Math.abs((q.x1 - q.x0) * (q.z1 - q.z0) - SEATED.leg ** 2) < 1e-6, `${tag}: a leg's collider is the leg drawn`);
      // walk it: from the way in, under the seat, out in front of the chair, and on to every doorway
      const w = world.walkable(rt), seen = w.flood([def.doors.find((d) => d.side === 'front')]);
      for (const dr of def.doors) assert.ok(seen[w.key(wallPoint(def, dr.side, dr.c, 0.5))], `${tag}: its ${dr.side} doorway is reached`);
      const toW = (x, z) => ({ x, z });                       // (walkable's grid is in the room's own frame)
      for (const [x, z] of [[0, (L.zf + L.zb) / 2], [0, L.zf - 1], [-def.W / 2 + 0.6, L.zf - 1], [0, -def.D / 2 + 1]]) {
        assert.ok(seen[w.key(toW(x, z))], `${tag}: (${x.toFixed(1)}, ${z.toFixed(1)}) is reached`);
      }
      assert.ok(!seen[w.key(toW(-SEATED.hall - 0.8, L.zM + 4))], `${tag}: nothing behind the hall's walls is walked to`);
      // the filing cabinet: let into the left wall, nothing of it outside the room
      const cab = (rt.clipped || []).find((k) => k.what === 'cabinet');
      assert.ok(cab && cab.foot.x0 >= -def.W / 2 - 0.02 && cab.foot.x1 < -def.W / 2 + 0.2, `${tag}: the cabinet is flush in the left wall`);
      // the ordinary chair in the squeeze: furniture (it can be carried, and shoved), leaving a sidle past it
      const f = world.furniture.find((r) => r.room === rt.id && r.type === 'chair');
      if (world.env?.barricadesEnabled !== false) assert.ok(f, `${tag}: the chair in the squeeze is furniture`);
      assert.ok(seen[w.key(toW(L.squeeze.x1 - 0.3, (L.squeeze.z0 + L.squeeze.z1) / 2))], `${tag}: there is a way past it`);
      assert.ok(!w.free(toW(L.chair.x, L.chair.z).x, toW(L.chair.x, L.chair.z).z), `${tag}: and it is in the way`);
      // carried into the recess it fits, and the squeeze is clear across its width
      if (f) {
        const from = frame.toWorld(def, L.chair.x, L.chair.z), to = frame.toWorld(def, (L.recess.x0 + L.recess.x1) / 2, (L.recess.z0 + L.recess.z1) / 2 + 0.05);
        const fx = (f.x0 + f.x1) / 2, fz = (f.z0 + f.z1) / 2; assert.ok(Math.hypot(fx - from.x, fz - from.z) < 0.15, `${tag}: the chair stands where it was put`);
        assert.ok(f.translate(to.x - fx, to.z - fz), `${tag}: it moves`);
        for (const [x, z] of [[f.x0, f.z0], [f.x1, f.z1]]) { const q = frame.toLocal(def, x, z); assert.ok(q.x > L.recess.x0 - 0.01 && q.x < L.recess.x1 + 0.01 && q.z > L.recess.z0 - 0.01 && q.z < L.recess.z1 + 0.06, `${tag}: inside the recess (${q.x.toFixed(2)}, ${q.z.toFixed(2)})`); }
        const w2 = world.walkable(rt), seen2 = w2.flood([def.doors.find((d) => d.side === 'front')]);
        for (let x = L.squeeze.x0 + 0.25; x <= L.squeeze.x1 - 0.25; x += 0.125) assert.ok(seen2[w2.key(toW(x, (L.squeeze.z0 + L.squeeze.z1) / 2))], `${tag}: with the chair in the recess the squeeze is clear at ${x.toFixed(2)}`);
        for (const dr of def.doors) assert.ok(seen2[w2.key(wallPoint(def, dr.side, dr.c, 0.5))], `${tag}: and every doorway still reached`);
      }
    } finally { world.dispose(); kit.dispose(); }
  }
});
