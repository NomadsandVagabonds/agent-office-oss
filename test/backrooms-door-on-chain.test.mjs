import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// The Door on the Chain (rooms/door-on-chain.js, its plan rooms/door-on-chain/rule.js): the hall behind a giant door
// standing ajar, a brass chain across it, and the way under its raised end to an ordinary door. It is walked through
// both ways by the visitor (stooping by themselves under the chain), by the cast that fits and by nothing that does not;
// what stops a body is what is drawn; and it is dealt like any other room.
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
const [{ buildWorld, loadCatalogue }, { createKit }, { generate, ARCHETYPES, DECK, isBig, STASH, coinFits }, { BUILDERS }, { planVisit }, { atHome, THEME_IDS }, { createWalk }, rule] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('rooms.js', B).href),
  import(new URL('plan.js', B).href), import(new URL('themes.js', B).href), import(new URL('cast/walk.js', B).href), import(new URL('rooms/door-on-chain/rule.js', B).href)]);
const { planOf, headroomAt, roomHead, walk, gapUnder, headwayOf, standsAt, corners, CHAIN } = rule;
const src = (p) => readFileSync(new URL(p, root), 'utf8');
const ID = 'door-on-chain', office = { name: 'Robin', projects: ['Webstore'], agents: ['Ivory Marten', 'Amber Vireo'], tasks: [] };
const HEAD = Number(/HEAD = ([\d.]+)/.exec(src('public/world/backrooms/world.js'))[1]);
const EYE = Number(/EYE = ([\d.]+)/.exec(src('public/world/backrooms/player.js'))[1]), RADIUS = Number(/const RADIUS = ([\d.]+)/.exec(src('public/world/backrooms/player.js'))[1]);
const SIZES = [[3.8, 9.8, 2.9], [3.8, 10.8, 3.1], [3.8, 10.3, 3.0]];          // (inside sizes: the deck's 4 × 10–11 m less the walls)

/** A floor built as the dev page builds it, with what the level said while it was built. */
async function built(level) {
  const builders = { ...BUILDERS };
  for (const id of new Set(level.rooms.map((r) => r.arch))) { const a = ARCHETYPES[id]; if (a?.module) { const mod = await import(new URL(a.module, B).href); if (mod.build) builders[id] = mod.build; } }
  const said = [], warn = console.warn;
  console.warn = (...args) => said.push(args.map(String).join(' '));
  const kit = createKit();
  const env = { level, kit, builders, catalogue: await loadCatalogue(kit), barricadesEnabled: true, lighting: false, plan: {},
    cast: ['Ivory Marten', 'Amber Vireo'].map((name) => ({ name, look: { species: 'human' } })), who: { name: 'Robin', look: { species: 'human' }, creations: {} },
    hatches: new Map(), ready: [], play() {}, interfere() {}, sees: () => false, run: { met() {}, survived() {} }, end() {}, steadyLighting: () => false, difficulty: () => 'normal' };
  try { const world = await buildWorld(kit, level, env); return { world, kit, said, env }; }
  finally { console.warn = warn; }
}
const local = (def, x, z) => { const C = [1, 0, -1, 0], S = [0, 1, 0, -1], c = C[def.rot], s = S[def.rot], dx = x - def.cx, dz = z - def.cz; return { x: dx * c - dz * s, z: dx * s + dz * c }; };
const worldOf = (def, lx, lz) => { const C = [1, 0, -1, 0], S = [0, 1, 0, -1], c = C[def.rot], s = S[def.rot]; return { x: def.cx + lx * c + lz * s, z: def.cz - lx * s + lz * c }; };

test('the plan: the room walks end to end both ways, and the only way is under the raised end of the chain', () => {
  assert.equal(CHAIN.reach >= RADIUS, true, 'headroom is asked of a body at least as wide as the visitor (player.js RADIUS)');
  assert.equal(CHAIN.head, HEAD, 'the least headroom anybody gets through is world.js HEAD');
  for (const [W, D, H] of SIZES) {
    const p = planOf(W, D, H), front = { x: 0, z: D / 2 - 0.5 }, back = { x: 0, z: -D / 2 + 0.5 };
    const there = walk(p, front, back), home = walk(p, back, front);
    assert.ok(there.reached, `${D} m: from the way in to the ordinary door`);
    assert.ok(home.reached, `${D} m: and back again, from the ordinary door to the way in`);
    // every crossing of the chain's line is where the gap is: at the wall end, which is the raised one
    const gap = gapUnder(p);
    assert.ok(gap && gap.x0 > 0.8 && gap.x1 <= W / 2 - 0.2, `${D} m: the gap under the chain is by the wall (${gap && gap.x0.toFixed(2)}…${gap && gap.x1.toFixed(2)})`);
    assert.ok(CHAIN.wallY > CHAIN.doorY + 0.5, 'the wall end is the raised one');
    for (const path of [there.path, home.path]) {
      const at = path.find((q) => Math.abs(q.z - p.zc) < 0.07);
      assert.ok(at && at.x >= gap.x0 - 0.07 && at.x <= gap.x1 + 0.07, `${D} m: the way crosses the chain under its raised end (x ${at && at.x.toFixed(2)})`);
    }
    // the rest of the chain's line is shut to everybody: what hangs there is lower than anybody gets under
    for (let x = -W / 2 + RADIUS; x < gap.x0 - 0.05; x += 0.05) if (standsAt(p, x, p.zc)) assert.ok(headroomAt(p, x, p.zc) < HEAD, `${D} m: at x ${x.toFixed(2)} the chain hangs too low to get under`);
  }
});

test('duck clearance under the chain: the automatic duck gets the visitor under, from either side, and nobody is snagged', () => {
  const sinkMost = EYE - 0.42;                                     // player.js: the eye goes no lower than 0.42 m
  for (const [W, D, H] of SIZES) {
    const p = planOf(W, D, H), gap = gapUnder(p);
    // under the raised end the headroom is enough to get under (the duck asks EYE - (head - 0.2) of the eye, at most EYE - 0.42)…
    assert.ok(gap.low >= HEAD, `${D} m: ${gap.low.toFixed(2)} m at the gap's edge`);
    assert.ok(EYE - (gap.low - 0.2) <= sinkMost + 1e-9, `${D} m: the eye sinks ${(EYE - (gap.low - 0.2)).toFixed(2)} m there, which it can`);
    // …and lower than standing room for the visitor, so the duck is what gets them through, and the chain is never at the ceiling
    assert.ok(gap.high < CHAIN.stand + 0.02 && gap.high > 1.0, `${D} m: ${gap.high.toFixed(2)} m at its best, a stoop`);
    assert.equal(CHAIN.stand, EYE + 0.2, 'the visitor stoops under EYE + 0.2 m of headroom (player.js)');
    // from each side the headroom falls to the chain and rises again, without a step in it a body could catch on
    for (let z = p.zc - 1; z <= p.zc + 1; z += 0.025) {
      const h = headroomAt(p, (gap.x0 + gap.x1) / 2, z);
      assert.ok(h >= HEAD, `${D} m: the line under the raised end has room all the way across (${z.toFixed(2)}: ${h.toFixed(2)})`);
    }
    // the room tells the world nothing in between: where there is less than HEAD there is none at all (so no small creature
    // is sent where the walk will not let it set foot)
    for (let x = -W / 2; x <= W / 2; x += 0.05) for (let z = p.zc - 0.8; z <= p.zc + 0.8; z += 0.05) {
      const h = headroomAt(p, x, z), r = roomHead(p, x, z);
      assert.ok(r === h || (h < HEAD && r === 0));
    }
  }
});

test('what stops a body is what is drawn: every piece of the chain is over the headroom, and the solids are the door, the jamb, the wall and the leaf', () => {
  for (const [W, D, H] of SIZES) {
    const p = planOf(W, D, H);
    // a point along every bar of every link, and its corners: the headroom there (a body's reach about it) is no higher than it
    for (const l of p.links) for (const b of l.bars) {
      for (const c of corners(b)) {
        assert.ok(headroomAt(p, c[0], c[2], 0.002) <= c[1] + 1e-6, `${D} m: a corner of the chain at ${c.map((v) => v.toFixed(2))} is not walked through`);
        for (const [dx, dz] of [[0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]]) assert.ok(headroomAt(p, c[0] + dx, c[2] + dz) <= c[1] + 1e-6, 'nor brushed by a shoulder');
      }
    }
    // …and the headroom is never lower than the underside of something drawn (it is that, or the ceiling)
    for (let x = -W / 2; x <= W / 2; x += 0.1) for (let z = p.zc - 0.7; z <= p.zc + 0.7; z += 0.1) {
      const h = headroomAt(p, x, z);
      assert.ok(h === H || p.overhead.some((o) => Math.abs(o.y0 - h) < 1e-9), 'the headroom is the underside of a drawn piece');
    }
    assert.deepEqual(p.solids.map((s) => s.what), ['door', 'door', 'jamb', 'wall', 'leaf', 'handle']);
    const door = p.solids[0];
    assert.equal(door.x1, p.face, 'the door solid stops at the door\'s face');
    assert.ok(Math.abs(door.z0 - p.edge) < 1e-9 && Math.abs(door.z1 - p.hinge) < 1e-9, 'from its latch edge to its hinge');
    assert.ok(p.hinge - p.edge > 5.8 && p.hinge - p.edge < 5.9, 'the giant door is 6.5 times an office door across (0.9 m)');
  }
  // the builder makes no solid of its own: what it draws, it draws from the plan, and the plan's solids are all it puts down
  const b = src('public/world/backrooms/rooms/door-on-chain.js');
  assert.equal((b.match(/c\.solid\(/g) || []).length, 1, 'one c.solid call, the loop over the plan\'s solids');
  assert.match(b, /for \(const s of plan\.solids\) c\.solid\(s\.x0, s\.z0, s\.x1, s\.z1/);
  for (const line of b.split('\n').filter((l) => l.includes('c.pillar('))) assert.match(line, /solid: false/, 'every pillar it draws is solid: false (the plan has the solids)');
  assert.doesNotMatch(b, /c\.(prop|place|crate|model)\(/, 'nothing else is put down that could be solid');
  assert.match(b, /c\.rt\.headY = \(x, z\) => roomHead\(plan, x, z\)/, 'the headroom is the plan\'s');
});

test('built for real: no doorway walled off, the colliders are the plan\'s, and the visitor\'s own grid floods both ways', async (t) => {
  for (const seed of [7, 21, 'q']) {
    const level = generate(seed, { ...office, only: [ID] });
    const def = level.rooms.find((r) => r.arch === ID);
    assert.ok(def, `seed ${seed}: dealt`);
    const { world, kit, said } = await built(level);
    t.after(() => { world.dispose(); kit.dispose(); });
    assert.deepEqual(said.filter((s) => /door-on-chain/.test(s)), [], `seed ${seed}: it builds, and nothing of it is walled off`);
    const rt = world.rooms[def.id], p = planOf(def.W, def.D, def.H);
    assert.ok(!rt.flat, 'its colliders are still on');
    // the colliders are exactly the plan's solids
    const got = rt.colliders.filter((c) => !c.furniture).map((c) => { const a = local(def, c.x0, c.z0), b = local(def, c.x1, c.z1); return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)].map((v) => +v.toFixed(3)); });
    const want = p.solids.map((s) => [s.x0, s.z0, s.x1, s.z1].map((v) => +v.toFixed(3)));
    assert.deepEqual(got.sort(), want.sort(), `seed ${seed}: the colliders are the door, the jamb, the wall and the leaf`);
    // what is drawn at body height stands in a solid, against the walls, or overhead (over the headroom there): nowhere else
    let n = 0;
    rt.group.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (y < 0.13 || y > def.H - 0.25 || Math.abs(x) > def.W / 2 - 0.09 || Math.abs(z) > def.D / 2 - 0.09) continue;
        n++;
        const inSolid = p.solids.some((s) => x >= s.x0 - 0.075 && x <= s.x1 + 0.075 && z >= s.z0 - 0.075 && z <= s.z1 + 0.075);
        assert.ok(inSolid || y >= headroomAt(p, x, z, 0.002) - 1e-3, `seed ${seed}: a vertex drawn at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} is in nobody's way`);
      }
    });
    assert.ok(n > 500, `seed ${seed}: the room drew something in the hall (${n})`);
    // the level's own walking grid (the no-trap check's) gets from each doorway to the other
    const g = world.walkable(rt), front = def.doors.find((d) => d.side === 'front'), back = def.doors.find((d) => d.side === 'back');
    assert.ok(front && back, 'two ends');
    const at = (d) => ({ x: d.c, z: (d.side === 'front' ? 1 : -1) * (def.D / 2 - 0.5) });
    assert.ok(g.flood([front])[g.key(at(back))], `seed ${seed}: from the way in to the ordinary door`);
    assert.ok(g.flood([back])[g.key(at(front))], `seed ${seed}: and back`);
    // the doorways lead on, and the far one is an ordinary door wide, into a plain room
    assert.equal(back.w, CHAIN.ordinary.w);
    assert.equal(level.rooms[back.to].kind, 'plain');
    assert.ok(back.h >= 2.0, 'an ordinary door\'s height');
  }
});

test('the cast: what fits under the raised end walks through both ways, what does not is never sent in', async (t) => {
  const level = generate(7, { ...office, only: [ID] }), def = level.rooms.find((r) => r.arch === ID);
  const { world, kit, env } = await built(level);
  t.after(() => { world.dispose(); kit.dispose(); });
  env.world = world;
  const w = createWalk(env), rt = world.rooms[def.id];
  const p = planOf(def.W, def.D, def.H);
  assert.equal(rt.headway, headwayOf(p, 0.5), 'the room says how much headroom its way through has, for the widest of the cast');
  const before = world.rooms[def.doors.find((d) => d.side === 'front').to], after = world.rooms[def.doors.find((d) => d.side === 'back').to];
  const bodies = { toner: { r: 0.2, tall: 0.5, crawls: true }, worm: { r: 0.09, tall: 0.14, crawls: true }, intern: { r: 0.3, tall: 1.4 }, mascot: { r: 0.26, tall: 1.62, opens: true }, mother: { r: 0.36, tall: 1.9 } };
  for (const [name, body] of Object.entries(bodies)) {
    for (const [from, to] of [[before, after], [after, before]]) {
      const a = { ...body, x: 0, z: 0, speed: 1 }, s = w.spotIn(a, from.id); a.x = s.x; a.z = s.z;
      const goal = w.spotIn(a, to.id), fits = body.tall <= rt.headway;
      let went = false, k = 0;
      for (; k < 3000; k++) { w.go(a, goal, 0.08); if (world.roomAt(a.x, a.z) === rt) went = true; if (Math.hypot(a.x - goal.x, a.z - goal.z) < 0.25) break; }
      if (fits) assert.ok(went && k < 3000, `${name}: walks under the chain from room ${from.id} to room ${to.id}`);
      else assert.equal(went, false, `${name}: is never sent into the chain's room (it would stop at the chain)`);
    }
  }
});

test('dealt like any other room: an ordinary weight, at home everywhere the yellow office is, nothing that puts it first', () => {
  const a = ARCHETYPES[ID];
  assert.ok(a && DECK.includes(a), 'in the deck');
  assert.equal(a.weight, 1, 'the ordinary weight (docs/BACKROOMS.md: "1 is ordinary")');
  for (const key of ['themes', 'planned', 'headline', 'big', 'halo', 'gate', 'resident', 'needs', 'on']) assert.equal(a[key], undefined, `no ${key}`);
  assert.equal(isBig(a), false);
  // on every kind of floor its peers (the plain deck, at home everywhere) are dealt on, it is dealt at its weight, as they are
  const peers = DECK.filter((d) => d !== a && !d.themes && !d.planned && !d.headline && !isBig(d));
  assert.ok(peers.length >= 10);
  for (const theme of THEME_IDS) for (const d of peers) assert.equal(atHome(a, theme), atHome(d, theme), `${theme}: as much at home as ${d.id}`);
  const ws = peers.map((d) => d.weight).sort((x, y) => x - y);
  assert.ok(a.weight >= ws[0] && a.weight <= ws[Math.floor(ws.length / 2)], `no heavier than the middle of its peers (${ws.join(', ')})`);
  // and it does turn up: over many visits, about as often as a peer of about its weight (tiny-door, 1.1)
  let mine = 0, theirs = 0;
  for (let s = 0; s < 400; s++) { const v = planVisit('deal' + s, office); const all = v.floors.flatMap((f) => f.hand || []); if (all.includes(ID)) mine++; if (all.includes('tiny-door')) theirs++; }
  assert.ok(mine > 0 && mine / theirs > 0.7 && mine / theirs < 1.3, `in ${mine} visits of 400, tiny-door in ${theirs}`);
});

test('its hiding place: in the office past the chain, where a coin fits everywhere in it and the builder leaves the floor clear', () => {
  const b = src('public/world/backrooms/rooms/door-on-chain.js');
  for (const seed of [7, 21, 'q', 3, 11]) {
    const level = generate(seed, { ...office, only: [ID] }), r = level.rooms.find((q) => q.arch === ID), p = planOf(r.W, r.D, r.H);
    for (const side of [-1, 1]) {
      const [x0, z0, x1, z1] = STASH[ID](r, side);
      assert.ok(x0 < x1 && z0 < z1 && z1 < p.edge, `seed ${seed}: past the latch edge, in the ordinary office`);
      for (let x = x0; x <= x1 + 1e-9; x += 0.05) for (let z = z0; z <= z1 + 1e-9; z += 0.05) {
        assert.ok(coinFits(r, x, z), `seed ${seed}: a coin fits at ${x.toFixed(2)}, ${z.toFixed(2)} (gen.js coinFits: walls, doorways)`);
        assert.ok(standsAt(p, x, z, 0.35) && headroomAt(p, x, z) === r.H, `seed ${seed}: nothing of the room stands or hangs there`);
      }
    }
  }
  // the builder keeps that floor for it: its reserve is the stash's middle
  assert.match(b, /c\.reserve\(half - 0\.8, -D \/ 2 \+ 1\.8, 0\.5\)/);
  const s = STASH[ID]({ W: 3.8, D: 10.8 }, 1);
  assert.ok(Math.abs((s[0] + s[2]) / 2 - (1.9 - 0.8)) < 1e-9 && Math.abs((s[1] + s[3]) / 2 - (-5.4 + 1.8)) < 1e-9, 'the reserve is the stash');
});
