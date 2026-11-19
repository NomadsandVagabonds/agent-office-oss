import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// Low Point (rooms/low-point.js, its plan rooms/low-point/rule.js; a preview, docs/BLOCKROOMS-PREVIEWS.md): a hall
// with a partition straight across it, its skirting level the whole way, and the carpet sagging under it in three
// facets each side, so that the way on is downhill, under the wall (with the automatic duck) and back up. Out of every
// deal (`on: false`) until the dev page's &preview=lowpoint puts it in the deck (preview-deck.js). It is walked both
// ways by the visitor (the real player.js, stooping by itself) and by the cast that fits, never by what does not; the
// slopes are walkable for both; what stops a body is what is drawn. Uses the real kit, world and catalogue; no WebGL.
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
const [{ buildWorld, loadCatalogue }, { createKit }, G, { BUILDERS }, { MORE_DECK }, P, { edition }, { atHome, THEME_IDS }, { createWalk }, { createPlayer }, rule] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('rooms.js', B).href),
  import(new URL('deck2.js', B).href), import(new URL('preview-deck.js', B).href), import(new URL('plan.js', B).href), import(new URL('themes.js', B).href),
  import(new URL('cast/walk.js', B).href), import(new URL('player.js', B).href), import(new URL('rooms/low-point/rule.js', B).href)]);
const { roomCost, overBudget } = await import(new URL('budget.js', B).href);
const { generate, ARCHETYPES, DECK, STASH, coinFits, isBig } = G;
const { LOW, planOf, floorAt, depthAt, headroomAt, roomHead, standsAt, walk, headwayOf, facets, underWall } = rule;
const src = (p) => readFileSync(new URL(p, root), 'utf8');
const ID = 'low-point', office = { name: 'Robin', projects: ['Webstore'], agents: ['Ivory Marten', 'Amber Vireo'], tasks: [] };
const HEAD = Number(/HEAD = ([\d.]+)/.exec(src('public/world/backrooms/world.js'))[1]), STEP = Number(/STEP = ([\d.]+)/.exec(src('public/world/backrooms/world.js'))[1]);
const EYE = Number(/EYE = ([\d.]+)/.exec(src('public/world/backrooms/player.js'))[1]), RADIUS = Number(/const RADIUS = ([\d.]+)/.exec(src('public/world/backrooms/player.js'))[1]);
const SIZES = [[5.8, 10.8, 2.9], [5.8, 11.8, 3.1], [5.8, 11.3, 3.0]];          // (inside sizes: the deck's 6 × 11–12 m less the walls)
const SEEDS = [7, 21, 'q'];

// (before anything is put in the deck for the preview: what the game sees)
const before = { deck: DECK.map((a) => a.id).join(), edition: edition(), floors: [7, 3, 'q'].map((s) => JSON.stringify(generate(s, {}).rooms.map((r) => [r.arch || r.kind, r.x, r.z, r.w, r.d]))) };

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

test('a preview: on: false, out of the deck and the edition, dealt only by its own flag, once', () => {
  const line = MORE_DECK.find((e) => e.id === ID);
  assert.ok(line && line.on === false, 'a line in MORE_DECK, retired');
  assert.ok(!DECK.some((e) => e.id === ID) && !ARCHETYPES[ID], 'not dealt');
  for (const f of ['gen.js', 'plan.js', 'world.js', 'index.js', 'rooms.js', 'deck2.js']) assert.ok(!/rooms\/low-point\/|preview-deck/.test(src(`public/world/backrooms/${f}`).replace(/\/\/.*$/gm, '')), `${f} does not reach the room's own files (the site's deck imports no new rooms/<x>/<y>.js)`);
  assert.match(src('public/world/backrooms/preview-deck.js'), /lowpoint: 'low-point'/, 'its flag is lowpoint');
  assert.deepEqual(P.enlist(['mound', 'clip']).filter((id) => id === ID), [], 'another flag does not deal it');
  assert.ok(!ARCHETYPES[ID]);
  // (what the game sees has not moved, by the time anything else is asked)
  assert.equal(DECK.filter((a) => a.id !== 'carpet-mound').map((a) => a.id).join(), before.deck);
  assert.equal(edition(), before.edition, 'the edition is what it was');
  assert.deepEqual(P.enlist(['lowpoint']), [ID]);
  assert.deepEqual(P.enlist(['lowpoint']), [], 'not twice');
  assert.ok(ARCHETYPES[ID] && DECK.includes(ARCHETYPES[ID]) && typeof STASH[ID] === 'function');
});

test('dealt like any other room once it is: on: false is all that keeps it out, at an ordinary weight, nothing that puts it first', () => {
  P.enlist(['lowpoint']);
  const line = MORE_DECK.find((e) => e.id === ID), a = ARCHETYPES[ID];
  const { on, ...rest } = line;
  assert.deepEqual(Object.keys(rest).sort(), Object.keys(a).sort(), 'the deck\'s entry is the line without `on`');
  assert.equal(a.weight, 1, 'the ordinary weight (docs/BACKROOMS.md: "1 is ordinary")');
  for (const key of ['themes', 'planned', 'headline', 'big', 'halo', 'gate', 'resident', 'needs', 'on', 'preview']) assert.equal(a[key], undefined, `no ${key}`);
  assert.equal(isBig(a), false);
  assert.equal(a.through, true, 'its far end always leads on');
  const peers = DECK.filter((d) => d !== a && !d.themes && !d.planned && !d.headline && !isBig(d));
  for (const theme of THEME_IDS) for (const d of peers.slice(0, 12)) assert.equal(atHome(a, theme), atHome(d, theme), `${theme}: as much at home as ${d.id}`);
  for (const seed of [...SEEDS, 3, 11, 102]) {
    const level = generate(seed, { ...office, only: [ID] }), r = level.rooms.find((q) => q.arch === ID);
    assert.ok(r, `seed ${seed}: dealt when asked for`);
    assert.deepEqual(Object.keys(r.params).sort(), ['dead', 'pencil', 'stain', 'turn', 'wood']);
    const back = r.doors.find((d) => d.side === 'back'), front = r.doors.find((d) => d.side === 'front');
    assert.ok(front && back && r.doors.length === 2, `seed ${seed}: a way in and a way on, nothing else`);
    assert.equal(level.rooms[back.to].kind, 'plain', 'the way on is into an ordinary office');
    assert.ok(!(front.sill > 0.01) && !(back.sill > 0.01), 'both at the hall\'s own floor');
  }
});

test('the plan: the floor is a heightfield the slopes of which a body walks, end to end both ways, and the only way past the partition is under it', () => {
  assert.equal(LOW.head, HEAD); assert.equal(LOW.step, STEP); assert.ok(LOW.reach >= RADIUS);
  for (const [W, D, H] of SIZES) {
    const p = planOf(W, D, H), front = { x: 0, z: D / 2 - 0.5 }, back = { x: 0, z: -D / 2 + 0.5 };
    const there = walk(p, front, back), home = walk(p, back, front);
    assert.ok(there.reached && home.reached, `${D} m: from the way in to the way on, and back`);
    for (const w of [there, home]) {
      assert.ok(w.steep <= 0.15, `${D} m: never more than ${w.steep.toFixed(3)} m of floor between two cells of the way (a step is ${STEP})`);
      assert.ok(Math.min(...w.path.map((q) => floorAt(p, q.x, q.z))) < -p.deep + 0.01, `${D} m: the way goes down to the bottom`);
      const at = w.path.filter((q) => Math.abs(q.z) < p.T / 2);
      assert.ok(at.length && at.every((q) => Math.abs(q.x) < p.a), `${D} m: and past the partition only under it, through the passage`);
    }
    // the floor: level at both ends and along the shelves; down to `deep` at the foot of the partition; never a jump
    assert.equal(floorAt(p, 0, D / 2 - 0.3), 0); assert.equal(floorAt(p, W / 2 - 0.3, 0.6), 0);
    assert.ok(Math.abs(floorAt(p, 0, 0) + p.deep) < 1e-9 && Math.abs(floorAt(p, 0, p.T / 2) + p.deep) < 1e-9);
    let steepest = 0;
    for (let x = -W / 2; x < W / 2; x += 0.0625) for (let z = -D / 2; z < D / 2; z += 0.0625) {
      for (const [dx, dz] of [[0.0625, 0], [0, 0.0625]]) steepest = Math.max(steepest, Math.abs(floorAt(p, x + dx, z + dz) - floorAt(p, x, z)) / 0.0625);
    }
    assert.ok(steepest < STEP / 0.125, `${D} m: the steepest of it (${steepest.toFixed(2)} in 1) is within a step every 12.5 cm cell`);
    assert.ok(Math.atan(p.kz) < 0.3 && Math.atan(p.kx) < 0.9, `${D} m: the long slope is gentle (${(Math.atan(p.kz) * 57.3).toFixed(0)}°), the sides steeper (${(Math.atan(p.kx) * 57.3).toFixed(0)}°)`);
    // nobody gets past the partition anywhere but the passage: across its whole width, outside it, there is no standing
    for (let x = -W / 2; x <= W / 2; x += 0.05) if (Math.abs(x) > p.a - 0.01) assert.ok(!standsAt(p, x, 0), `${D} m: x ${x.toFixed(2)} is wall`);
  }
});

test('duck clearance: under the partition the visitor stoops by themselves, has room to, and the skirting is over their head', () => {
  const sinkMost = EYE - 0.42;                                     // player.js: the eye goes no lower than 0.42 m
  for (const [W, D, H] of SIZES) {
    const p = planOf(W, D, H), z0 = p.T / 2 + p.o.reach;
    let low = Infinity, high = 0;
    for (let x = -p.a + RADIUS; x <= p.a - RADIUS + 1e-9; x += 0.05) for (let z = -z0 + 0.005; z < z0 - 0.005; z += 0.02) { const h = headroomAt(p, x, z); low = Math.min(low, h); high = Math.max(high, h); }
    assert.ok(low >= HEAD, `${D} m: ${low.toFixed(2)} m at the least`);
    assert.ok(high < p.o.stand, `${D} m: ${high.toFixed(2)} m at the most: under ${p.o.stand}, so the duck is what gets the visitor through`);
    assert.ok(EYE - (low - 0.2) <= sinkMost + 1e-9, `${D} m: the eye sinks ${(EYE - (low - 0.2)).toFixed(2)} m, which it can`);
    // ducked, the eye is under the partition's underside (the old floor, y 0) and so under its skirting, with room to spare
    const eye = -p.deep + EYE - Math.max(0, EYE - (p.deep - 0.2));
    assert.ok(eye < -0.1 && eye > -p.deep + 0.5, `${D} m: the eye under the wall is ${eye.toFixed(2)} m, under the skirting`);
    // the headroom the room says is what is drawn over it, and where it is under HEAD it says none (here, nowhere a body goes)
    for (let x = -W / 2; x <= W / 2; x += 0.05) for (let z = -1; z <= 1; z += 0.05) {
      const h = headroomAt(p, x, z), r = roomHead(p, x, z);
      assert.ok(r === h || (h < HEAD && r === 0));
      assert.ok(Math.abs(h - ((underWall(p, x, z) ? 0 : H) - floorAt(p, x, z))) < 1e-9, 'the headroom is from the carpet to the underside of the wall, or to the ceiling');
    }
  }
});

test('the drawn faces are the floor: every slope lies on the heightfield, every wall face on the partition\'s solids', () => {
  for (const [W, D, H] of SIZES) {
    const p = planOf(W, D, H), F = facets(p);
    assert.equal(F.filter((f) => f.kind === 'slope').length, 6, 'three facets each side');
    for (const f of F) {
      const corners = f.pts;
      // a point all over each face (its corners, and between them)
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
        const [A, Bq, C, Dd = C] = corners, lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
        const X = lerp(lerp(A, Bq, i / 8), lerp(Dd, C, i / 8), j / 8);
        if (f.kind === 'slope' || f.kind === 'bottom') {
          assert.ok(Math.abs(X[1] - floorAt(p, X[0], X[2])) < 1e-6, `${D} m: ${f.name} at ${X.map((v) => v.toFixed(2))} is the floor there`);
          assert.ok(f.n[1] > 0.5, `${f.name} faces up`);
        } else if (f.kind === 'wall') {
          assert.ok(p.solids.some((s) => X[0] >= s.x0 - 1e-6 && X[0] <= s.x1 + 1e-6 && X[2] >= s.z0 - 1e-6 && X[2] <= s.z1 + 1e-6), `${D} m: ${f.name} is a face of the partition's solid`);
          assert.ok(X[1] >= floorAt(p, X[0], X[2] - Math.sign(X[2]) * 1e-4 * 0) - 1e-6 && X[1] <= 1e-9, 'from the carpet up to the old floor');
        } else assert.ok(Math.abs(X[1]) < 1e-9 && Math.abs(X[0]) <= p.a + 1e-9 && Math.abs(X[2]) <= p.T / 2 + 1e-9, 'the underside is the passage\'s ceiling');
      }
    }
    // the faces close the hole: the trough's footprint each side is the three slopes, the bottom under the wall the passage
    const area = (f) => { const q = f.pts, cr = (a, b, c) => { const u = b.map((v, k) => v - a[k]), v = c.map((w, k) => w - a[k]); return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; };
      const s = cr(q[0], q[1], q[2]); let A = Math.abs(s[1]) / 2; if (q.length === 4) A += Math.abs(cr(q[0], q[2], q[3])[1]) / 2; return A; };
    const near = F.filter((f) => f.kind === 'slope' && f.name.startsWith('near')).reduce((m, f) => m + area(f), 0);
    assert.ok(Math.abs(near - 2 * p.b * p.run) < 1e-6, `${D} m: the near slopes cover the trough (${near.toFixed(3)} m² in plan)`);
  }
});

test('built for real: nothing walled off, the colliders are the plan\'s, what is drawn stands where a body cannot, and both ways flood', async (t) => {
  P.enlist(['lowpoint']);
  for (const seed of SEEDS) {
    const level = generate(seed, { ...office, only: [ID] }), def = level.rooms.find((r) => r.arch === ID);
    assert.ok(def, `seed ${seed}: dealt`);
    const { world, kit, said } = await built(level);
    t.after(() => { world.dispose(); kit.dispose(); });
    assert.deepEqual(said.filter((s) => /low-point|#\d+ could not be reached|now flat/.test(s) && new RegExp(`#${def.id}\\b|low-point`).test(s)), [], `seed ${seed}: it builds, and nothing of it is walled off`);
    const rt = world.rooms[def.id], p = planOf(def.W, def.D, def.H, def.params);
    assert.ok(!rt.flat, 'its floor and colliders are still its own');
    // the floor the world walks is the plan's
    for (let x = -def.W / 2 + 0.1; x < def.W / 2; x += 0.37) for (let z = -def.D / 2 + 0.1; z < def.D / 2; z += 0.29) {
      const w = worldOf(def, x, z);
      assert.ok(Math.abs(world.floorY(w.x, w.z) - (def.y + floorAt(p, x, z))) < 1e-9, `seed ${seed}: the world's floor at ${x.toFixed(2)}, ${z.toFixed(2)}`);
    }
    // the colliders are exactly the plan's solids
    const got = rt.colliders.filter((c) => !c.furniture).map((c) => { const a = local(def, c.x0, c.z0), b = local(def, c.x1, c.z1); return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)].map((v) => +v.toFixed(3)); });
    const want = p.solids.map((s) => [s.x0, s.z0, s.x1, s.z1].map((v) => +v.toFixed(3)));
    assert.deepEqual(got.sort(), want.sort(), `seed ${seed}: the colliders are the partition either side of the passage`);
    // every vertex drawn: never under the carpet (but for the skirting's steps against the partition), and where it stands
    // at body height, in a solid, against the walls, or over the headroom there (the partition's underside)
    let n = 0, under = 0;
    rt.group.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (Math.abs(x) > def.W / 2 + 0.3 || Math.abs(z) > def.D / 2 + 0.3) continue;
        const f = floorAt(p, Math.max(-def.W / 2, Math.min(def.W / 2, x)), Math.max(-def.D / 2, Math.min(def.D / 2, z)));
        if (y < f - 0.003) { under++; assert.ok(y > f - 0.06 && Math.abs(Math.abs(z) - p.T / 2) < 0.03, `seed ${seed}: a vertex at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} is under the carpet`); }
        if (y < f + 0.13 || y > def.H - 0.25 || Math.abs(x) > def.W / 2 - 0.09 || Math.abs(z) > def.D / 2 - 0.09) continue;
        n++;
        const inSolid = p.solids.some((s) => x >= s.x0 - 0.075 && x <= s.x1 + 0.075 && z >= s.z0 - 0.075 && z <= s.z1 + 0.075);
        // (a body's reach of 3 cm about the point: the skirting stands 2.2 cm proud of the partition over the passage's mouths)
        assert.ok(inSolid || y >= f + headroomAt(p, x, z, 0.03) - 1e-3, `seed ${seed}: a vertex drawn at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} is in nobody's way`);
      }
    });
    assert.ok(n > 500, `seed ${seed}: the room drew its partition (${n})`);
    assert.ok(under > 0, 'the skirting steps down the partition\'s lower faces');
    // the level's own walking grid (the no-trap check's) gets from each doorway to the other
    const g = world.walkable(rt), front = def.doors.find((d) => d.side === 'front'), back = def.doors.find((d) => d.side === 'back');
    const at = (d) => ({ x: d.c, z: (d.side === 'front' ? 1 : -1) * (def.D / 2 - 0.5) });
    assert.ok(g.flood([front])[g.key(at(back))], `seed ${seed}: from the way in to the way on`);
    assert.ok(g.flood([back])[g.key(at(front))], `seed ${seed}: and back`);
    assert.ok(g.floor(0, 0) < -p.deep + 0.01 && g.head(0, 0) < p.o.stand, 'the grid has the bottom and its stoop');
    assert.equal(rt.headway, headwayOf(p, 0.5), 'the room says how much headroom its way through has, for the widest of the cast');
    assert.deepEqual(overBudget(roomCost(rt.group), { lights: rt.lights.length }), [], `seed ${seed}: within what a room may cost (budget.js)`);
  }
});

test('the visitor: walking (player.js) from the way in to the way on and back, down the slope, ducking under the wall, up again, never snagged', async (t) => {
  P.enlist(['lowpoint']);
  const level = generate(7, { ...office, only: [ID] }), def = level.rooms.find((r) => r.arch === ID);
  const { world, kit } = await built(level);
  t.after(() => { world.dispose(); kit.dispose(); });
  const p = planOf(def.W, def.D, def.H, def.params);
  const camera = { position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, rotation: { set() {} } };
  for (const [from, to] of [[1, -1], [-1, 1]]) {
    const start = worldOf(def, 0.2, from * (def.D / 2 - 0.6));
    const input = { keys: new Set(['w']), dx: 0, dy: 0, stick: { x: 0, y: 0 }, hurry: false };
    const pl = createPlayer(world, camera, { ...start, yaw: 0 }, input), me = pl.me;
    // (steered as a thumb would: at the passage's mouth, through it, then at the far doorway)
    const way = [[0.15, from * (p.T / 2 + 0.9)], [0.1, 0], [0.1, -from * (p.T / 2 + 0.9)], [0, to * (def.D / 2 - 0.5)]].map(([x, z]) => worldOf(def, x, z));
    let k = 0, stuck = 0, worst = 0, lowEye = Infinity, deepest = 0, overhead = Infinity, steps = 0;
    for (; steps < 60 * 30 && k < way.length; steps++) {
      const q = way[k], dx = q.x - me.x, dz = q.z - me.z;
      if (Math.hypot(dx, dz) < 0.3) { k++; continue; }
      me.yaw = Math.atan2(-dx, -dz);
      const bx = me.x, bz = me.z;
      pl.update(1 / 60);
      const moved = Math.hypot(me.x - bx, me.z - bz);
      stuck = moved < 0.002 ? stuck + 1 : 0; worst = Math.max(worst, stuck);
      const l = local(def, me.x, me.z), floor = world.floorY(me.x, me.z) - def.y;
      deepest = Math.min(deepest, floor);
      if (underWall(p, l.x, l.z, 0)) { lowEye = Math.min(lowEye, me.y - def.y - floor); overhead = Math.min(overhead, -(me.y - def.y)); }
    }
    t.diagnostic(`from ${from > 0 ? 'the way in' : 'the way on'}: ${(steps / 60).toFixed(1)} s, held up ${worst} frames at most, bottom ${deepest.toFixed(2)} m, eye under the wall ${lowEye.toFixed(2)} m over the carpet, ${overhead.toFixed(2)} m under the underside`);
    assert.equal(k, way.length, `from ${from > 0 ? 'the way in' : 'the way on'}: there in ${(steps / 60).toFixed(1)} s`);
    assert.ok(worst < 30, `never held up for long (${worst} frames at most)`);
    assert.ok(deepest < -p.deep + 0.02, 'down to the bottom');
    assert.ok(lowEye < EYE - 0.05, `stooping under the wall (eye ${lowEye.toFixed(2)} m over the carpet)`);
    assert.ok(overhead > 0.08, `with the underside of the wall over the eye (${overhead.toFixed(2)} m over it)`);
  }
});

test('the cast: what fits under the wall walks the slopes and the passage both ways, what does not is never sent in', async (t) => {
  P.enlist(['lowpoint']);
  const level = generate(7, { ...office, only: [ID] }), def = level.rooms.find((r) => r.arch === ID);
  const { world, kit, env } = await built(level);
  t.after(() => { world.dispose(); kit.dispose(); });
  env.world = world;
  const w = createWalk(env), rt = world.rooms[def.id], p = planOf(def.W, def.D, def.H, def.params);
  assert.ok(rt.headway > 1.0 && rt.headway < p.deep + 1e-9, `the way through keeps ${rt.headway} m`);
  const before = world.rooms[def.doors.find((d) => d.side === 'front').to], after = world.rooms[def.doors.find((d) => d.side === 'back').to];
  // (the bodies of the cast as their rules have them: cast/*.rule.js, pursuer.js)
  const bodies = { toner: { r: 0.2, tall: 0.5, crawls: true }, worm: { r: 0.09, tall: 0.14, crawls: true }, meeting: { r: 0.38, tall: 0.95 }, headcount: { r: 0.5, tall: 1.05 },
    follower: { r: 0.2, tall: 1.3 }, intern: { r: 0.3, tall: 1.4 }, mascot: { r: 0.26, tall: 1.62, opens: true }, mother: { r: 0.36, tall: 1.9 } };
  const went = {};
  for (const [name, body] of Object.entries(bodies)) {
    for (const [from, to] of [[before, after], [after, before]]) {
      const a = { ...body, x: 0, z: 0, speed: 1 }, s = w.spotIn(a, from.id); a.x = s.x; a.z = s.z;
      const goal = w.spotIn(a, to.id), fits = body.tall <= rt.headway;
      let inside = false, k = 0, low = 0, jump = 0, py = world.floorY(a.x, a.z);
      for (; k < 3000; k++) {
        w.go(a, goal, 0.08);
        const y = world.floorY(a.x, a.z); jump = Math.max(jump, Math.abs(y - py)); py = y;
        if (world.roomAt(a.x, a.z) === rt) { inside = true; low = Math.min(low, y - def.y); }
        if (Math.hypot(a.x - goal.x, a.z - goal.z) < 0.25) break;
      }
      if (fits) {
        assert.ok(inside && k < 3000, `${name}: walks through from room ${from.id} to room ${to.id}`);
        assert.ok(low < -p.deep + 0.02, `${name}: down to the bottom and under the wall`);
        assert.ok(jump <= STEP, `${name}: never more than a step of floor at a stride (${jump.toFixed(3)})`);
      } else assert.equal(inside, false, `${name}: is never sent into the room (it would stop at the wall)`);
      t.diagnostic(`${name} (${body.tall} m): ${fits ? `through, ${(k * 0.08).toFixed(1)} m walked, down to ${low.toFixed(2)}, ${jump.toFixed(3)} m a stride at most` : 'kept out'} (${from.id} → ${to.id})`);
      went[name] = fits;
    }
  }
  assert.deepEqual(Object.keys(went).filter((n) => went[n]), ['toner', 'worm', 'meeting', 'headcount'], 'the low ones go under; the follower, the intern, the mascot and the mother keep out');
});

test('its hiding place: on the far landing, level, where a coin fits everywhere in it and the builder keeps the floor clear', () => {
  P.enlist(['lowpoint']);
  const b = src('public/world/backrooms/rooms/low-point.js');
  for (const seed of [...SEEDS, 3, 11]) {
    const level = generate(seed, { ...office, only: [ID] }), r = level.rooms.find((q) => q.arch === ID), p = planOf(r.W, r.D, r.H, r.params);
    for (const side of [-1, 1]) {
      const [x0, z0, x1, z1] = STASH[ID](r, side);
      assert.ok(x0 < x1 && z0 < z1 && z1 < -p.top, `seed ${seed}: past the trough, on the far landing`);
      for (let x = x0; x <= x1 + 1e-9; x += 0.05) for (let z = z0; z <= z1 + 1e-9; z += 0.05) {
        assert.ok(coinFits(r, x, z), `seed ${seed}: a coin fits at ${x.toFixed(2)}, ${z.toFixed(2)} (gen.js coinFits)`);
        assert.ok(standsAt(p, x, z, 0.35) && depthAt(p, x, z) === 0 && headroomAt(p, x, z) === r.H, `seed ${seed}: on level floor with nothing over it`);
      }
    }
  }
  assert.match(b, /c\.reserve\(\(W \/ 2 - 0\.8\), -D \/ 2 \+ 0\.8, 0\.45\); c\.reserve\(-\(W \/ 2 - 0\.8\), -D \/ 2 \+ 0\.8, 0\.45\)/, 'the builder reserves the stash\'s middle, either side');
  const s = STASH[ID]({ W: 5.8, D: 11.8 }, 1);
  assert.ok(Math.abs((s[0] + s[2]) / 2 - (2.9 - 0.8)) < 1e-9 && Math.abs((s[1] + s[3]) / 2 - (-5.9 + 0.8)) < 1e-9, 'the reserve is the stash');
});

test('the builder draws from the plan and puts nothing else down: one c.solid loop, the plan\'s floor and headroom, the pencil at the bottom', () => {
  const b = src('public/world/backrooms/rooms/low-point.js');
  assert.equal((b.match(/c\.solid\(/g) || []).length, 1);
  assert.match(b, /for \(const s of plan\.solids\) c\.solid\(s\.x0, s\.z0, s\.x1, s\.z1/);
  assert.match(b, /c\.rt\.floorY = \(x, z\) => floorAt\(plan, x, z\)/);
  assert.match(b, /c\.rt\.headY = \(x, z\) => roomHead\(plan, x, z\)/);
  for (const line of b.split('\n').filter((l) => /c\.(pillar|model)\(/.test(l))) assert.match(line, /solid: false/, 'every pillar and model it draws is solid: false (the plan has the solids)');
  assert.doesNotMatch(b, /c\.(prop|place|crate|spot|corner)\(/, 'nothing else is put down that could be solid, nor a spot drawn from the room\'s stream');
  for (const [W, D, H] of SIZES) {
    const p = planOf(W, D, H, { pencil: 0.3, turn: 0.15 }), q = p.pencil;
    assert.ok(Math.abs(q.x) < p.a - 0.1 && q.z > p.T / 2 && q.z < p.T / 2 + 0.1, 'the pencil lies at the foot of the slope, in front of the passage');
    assert.ok(floorAt(p, q.x, q.z) < -p.deep + 0.03, 'at the very bottom, where things roll');
  }
});
