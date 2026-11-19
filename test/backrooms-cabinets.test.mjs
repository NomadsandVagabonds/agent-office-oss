import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Filing cabinets (cabinets.model.js, cabinets.js; a preview behind the dev page's &preview=cabinets, docs/BLOCKROOMS-PREVIEWS.md
// "Filing cabinets"): the family's models, the placements a room can deal (piles, a sunk row, a wall of drawers, one let
// into a wall, one through the ceiling, one alone), their colliders, the way through, the drawers that open, and what is
// in them. Uses the real kit, world, rooms and catalogue; canvas drawing is inert, no WebGL.
const root = new URL('../', import.meta.url), three = new URL('public/vendor/three.module.min.js', root);
const loader = `export async function resolve(s,c,next){
  if(s==='three')return {url:${JSON.stringify(three.href)},shortCircuit:true};
  if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};
  return next(s,c);
}`;
register(`data:text/javascript;base64,${Buffer.from(loader).toString('base64')}`, import.meta.url);
const draw = new Proxy({}, { get: (_, name) => name === 'measureText' ? (t) => ({ width: String(t).length * 6 })
  : /Gradient|Pattern/.test(name) ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
globalThis.document ??= { createElement: () => ({ getContext: () => draw, style: {} }) };       // (this file's own process: left in place)

const B = new URL('public/world/backrooms/', root);
const [{ buildWorld, loadCatalogue }, { createKit }, { generate, ARCHETYPES, wallPoint, toLocal, toWorld, makeRng }, { BUILDERS }, M, K, { planSupplies, plentyOfPaper }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('rooms.js', B).href),
  import(new URL('cabinets.model.js', B).href), import(new URL('cabinets.js', B).href), import(new URL('supplies.js', B).href)]);

const VS = M.CABINETS.voxel;
const localRect = (rt, q) => { const a = toLocal(rt.def, q.x0, q.z0), b = toLocal(rt.def, q.x1, q.z1); return { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) }; };

test('the family: five kinds, each drawer a part of its own, the wear the same everywhere', () => {
  assert.deepEqual([...M.CABINETS.kinds], ['two', 'three', 'four', 'tall', 'lateral']);
  for (const kind of M.CABINETS.kinds) {
    const d = M.dims(kind), whole = M.whole(kind, { wear: 3 }).bounds();
    assert.equal(d.bays.length, { two: 2, three: 3, four: 4, tall: 5, lateral: 3 }[kind]);
    assert.ok(whole.x0 >= d.x0 && whole.x1 <= d.x1 + 1 && whole.z0 >= d.z0 && whole.z1 <= d.z1 + 1 && whole.y0 === 0 && whole.y1 === d.h, `${kind}: inside its measurements ${JSON.stringify(whole)}`);
    for (let i = 0; i < d.n; i++) {
      const f = M.drawerFront(kind, i, { wear: 3 }).bounds(), b = M.drawerBody(kind, i, { wear: 3, fill: 'files' }).bounds();
      assert.ok(f.y0 >= d.bays[i].y0 && f.y1 <= d.bays[i].y1 + 1 && f.z0 >= d.front, `${kind} drawer ${i}: its front is where that drawer is`);
      assert.ok(b.z1 <= d.front && b.y0 > d.bays[i].y0 && b.y1 <= d.bays[i].y1, `${kind} drawer ${i}: its tray is behind its front and within its height`);
    }
    // a carcase with a recess behind a drawer that opens, and none behind one that does not
    const open = M.carcase(kind, { bays: 1 }), shut = M.carcase(kind, { bays: 0 }), z = d.D / 2 - 1, y = d.bays[0].y0 + 4;
    assert.ok(!open.has(0, y, z) && shut.has(0, y, z), `${kind}: the recess`);
  }
  assert.deepEqual(M.dented('four', 5), M.dented('four', 5), 'dents are pure');
  let dents = 0, all = 0;
  for (let w = 0; w < 400; w++) for (const v of M.dented('three', w)) { dents += v; all++; }
  assert.ok(dents / all > 0.08 && dents / all < 0.22, `about one drawer in seven is dented in (${dents}/${all})`);
});

const makers = await import(new URL('public/world/props/office.js', root).href);
const catalogueOf = (kit) => ({ has: (type) => typeof makers[type] === 'function', entry: () => null, geo: (type) => (makers[type] ? kit.model(type, makers[type]) : null) });
/** One room (8 × 8, doorways front and back unless given), and whatever `build` puts in it with the toolbox. */
async function oneRoom(t, build, o = {}) {
  const level = generate(7, { count: 0 }), src = level.rooms.find((r) => r.kind === 'plain'), W = o.W || 8, D = o.D || 8;
  const doors = o.doors || [{ side: 'front', c: 0, w: 1.2, sill: 0, to: 0 }, { side: 'back', c: 1, w: 1.2, sill: 0, to: 0 }];
  const def = { ...src, id: 0, x: 0, z: 0, w: W, d: D, W, D, H: 2.6, cx: W / 2, cz: D / 2, y: 0, rot: 0, doors, wins: [], shape: null, panels: [], dress: [], pillars: [] };
  const kit = createKit(), played = [], ctx = {};
  const world = await buildWorld(kit, { ...level, rooms: [def], links: [], windows: [] }, { catalogue: catalogueOf(kit), barricadesEnabled: true, play: (name) => played.push(name),
    builders: { plain: (c) => { c.shell(); ctx.c = c; build(c); } } });
  t.after(() => { world.dispose(); kit.dispose(); });
  return { rt: world.rooms[0], world, c: ctx.c, played };
}

test('colliders: each cabinet solid where what is drawn of it stands between knee and chest, and nowhere else', async (t) => {
  for (const what of ['pile', 'sunk', 'wall', 'flush', 'ceiling', 'alone', 'against']) {
    const { rt } = await oneRoom(t, (c) => { assert.ok(K.deal(c, what, 1), `${what} found a place`); });
    assert.ok(rt.cabinets.length, what);
    const mine = new Set();
    for (const k of rt.cabinets) {
      const f = k.foot, inRoom = { x0: Math.max(f.x0, -4), z0: Math.max(f.z0, -4), x1: Math.min(f.x1, 4), z1: Math.min(f.z1, 4) };
      const reach = f.y0 < 1.0 && f.y1 > 0.25 && inRoom.x1 - inRoom.x0 > 0.03 && inRoom.z1 - inRoom.z0 > 0.03;
      assert.equal(!!k.solid, reach, `${what} ${k.kind} (${JSON.stringify(f)}): solid exactly when some of it is at a body's height in the room`);
      if (!k.solid) continue;
      mine.add(k.solid);
      const r = localRect(rt, k.solid);
      for (const e of ['x0', 'z0', 'x1', 'z1']) assert.ok(Math.abs(r[e] - inRoom[e]) < 0.03, `${what} ${k.kind}: its collider is the box round what is drawn (${e}: ${r[e]} against ${inRoom[e]})`);
      assert.equal(k.solid.tall, f.y1 > 1.25, `${what} ${k.kind}: tall when it stands above a head`);
    }
    assert.ok(rt.colliders.every((q) => mine.has(q)), `${what}: nothing solid that is not a cabinet`);
    assert.equal(rt.colliders.filter((q) => q.furniture).length, 0, `${what}: none of it is furniture to be dragged`);
  }
});

test('the drawers: E opens the one looked at, with a sound; a dented one rattles; a locked cabinet clicks; a thing given to one is put in it as a pickup', async (t) => {
  let rec = null;
  const { rt, c, played } = await oneRoom(t, (c) => { rec = K.put(c, 'three', 0, 0, { open: true, n: 4 }); });
  const shut = rec.drawers.filter((d) => d.state === 'shut');
  assert.ok(shut.length >= 1, 'something opens');
  assert.equal(rt.drawers.length, shut.length, 'the room knows its drawers that open');
  for (const d of shut) { assert.ok(d.front && d.body && d.body.visible === false, 'each a part of its own, its tray not drawn while shut'); }
  const spawned = [];
  c.env.inventory = { physical: { spawn: (item, at) => { spawned.push({ item, at }); return { ok: true }; } } };
  const item = { id: 'test:battery', type: 'battery' };
  const low = shut.find((d) => d.holds);
  if (low) low.held = item;
  const use = rt.uses.find((u) => u.label === 'filing cabinet');
  assert.ok(use && use.when());
  c.env.player = { me: { x: c.toWorld(0, 1).x, z: c.toWorld(0, 1).z, y: (low || shut[0]).y0 + 0.15 + (rt.def.y || 0), pitch: 0 } };   // (looking straight at it)
  use.use(use);
  const opening = rt.drawers.find((d) => d.state === 'moving');
  assert.ok(opening === (low || shut[0]), 'the drawer looked at');
  assert.ok(played.includes('slide'), 'it slides with a sound');
  for (let i = 0; i < 30; i++) for (const f of rt.ticks) f(0.05, i * 0.05, { x: 0, z: 1, inside: true });
  assert.equal(opening.state, 'open');
  assert.ok(Math.abs(opening.front.position.z - (opening.pivot[2] + opening.slide)) < 1e-9, 'it came out the whole way, toward the room');
  assert.ok(opening.body.visible, 'and its tray is drawn');
  assert.ok(played.includes('thunk'));
  if (low) {
    assert.equal(spawned.length, 1, 'the thing it held is put into it');
    assert.equal(spawned[0].item, item);
    assert.ok(Math.abs(spawned[0].at.y - low.at.y) < 1e-9 && spawned[0].at.ignore?.has(rec.solid), 'on the floor of the tray, over the cabinet');
    assert.equal(low.held, null);
  }
  // a dented one, a locked one
  const dented = await oneRoom(t, (c) => { for (let n = 0; n < 60 && !c.rt.cabinets?.some((k) => k.drawers.some((d) => d.state === 'stuck')); n++) K.put(c, 'four', -3 + (n % 12) * 0.5, -3 + Math.floor(n / 12) * 1.2, { open: true, n }); });
  const stuck = dented.rt.cabinets.find((k) => k.drawers.some((d) => d.state === 'stuck'));
  assert.ok(stuck, 'a dented drawer turns up');
  assert.ok(M.dented('four', 0).length === 4);
  const locked = dented.rt.cabinets.find((k) => k.locked);
  if (locked) assert.ok(locked.drawers.every((d) => d.state === 'locked'), 'one lock does all its drawers');
});

/** A floor built as the game builds it, with or without the preview. */
async function floor(seed, preview, spy) {
  const level = generate(seed, {}), builders = { ...BUILDERS };
  for (const id of new Set(level.rooms.map((r) => r.arch))) { const a = ARCHETYPES[id]; if (a?.module) { const mod = await import(new URL(a.module, B).href); if (mod.build) builders[id] = mod.build; } }
  if (spy) { const plain = builders.plain; builders.plain = (c) => { plain(c); spy(c.room.id, c.R()); }; }
  const kit = createKit(), said = [], warn = console.warn;
  const env = { level, kit, builders, catalogue: await loadCatalogue(kit), barricadesEnabled: true, lighting: false, plan: {}, preview,
    cast: [], who: { name: 'Robin', look: { species: 'human' }, creations: {} }, hatches: new Map(), ready: [], play() {}, interfere() {}, sees: () => false, run: { met() {}, survived() {} }, end() {}, steadyLighting: () => false, difficulty: () => 'normal' };
  console.warn = (...a) => said.push(a.map(String).join(' '));
  try { const world = await buildWorld(kit, level, env); return { level, world, kit, said }; }
  finally { console.warn = warn; }
}
const SEEDS = [7, 21, 3, 11, 40, 'q', 'zz', 102];
const done = (...fs) => { for (const f of fs) { f.world.dispose(); f.kit.dispose(); } };

/** The doorways something of radius r can reach from the first, on the room's own walking grid. */
function reached(world, rt, r) {
  const def = rt.def, walk = world.walkable(rt), seen = walk.flood(def.doors.slice(0, 1)), wide = new Uint8Array(seen.length);
  const ok = (p) => { const q = toWorld(def, p.x, p.z); return world.free(q.x, q.z, r, { ghost: true }); };
  const k0 = walk.key(wallPoint(def, def.doors[0].side, def.doors[0].c, 0.5)), queue = seen[k0] ? [k0] : [];
  if (queue.length) wide[k0] = 1;
  while (queue.length) {
    const k = queue.pop(), i = k % walk.nx, j = (k - i) / walk.nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj, kk = ii + walk.nx * jj;
      if (ii < 0 || jj < 0 || ii >= walk.nx || jj >= walk.nz || wide[kk] || !seen[kk] || !ok(walk.at(kk))) continue;
      wide[kk] = 1; queue.push(kk);
    }
  }
  return def.doors.map((dr) => { const k = walk.key(wallPoint(def, dr.side, dr.c, 0.5)); return [!!seen[k], !!wide[k]]; });
}

test('never in the way: with the cabinets dealt every doorway is reached as it was, by the visitor and by the cast', async () => {
  const seen = new Set(), { doorLanes } = await import(new URL('clipping.js', B).href);
  for (const seed of SEEDS) {
    const off = await floor(seed), on = await floor(seed, new Set(['cabinets']));
    assert.deepEqual(on.said.filter((s) => /could not be reached|now flat|would not build/.test(s)), off.said.filter((s) => /could not be reached|now flat|would not build/.test(s)), `seed ${seed}: no room gave up its furniture for the cabinets`);
    for (const rt of on.world.rooms) {
      if (!rt.cabinets?.length) continue;
      for (const k of rt.cabinets) seen.add(k.how);
      const was = off.world.rooms.find((r) => r.id === rt.id);
      assert.ok(rt.colliders.every((q) => q.on !== false), `room ${rt.id} (seed ${seed}): nothing had to stop being solid`);
      if (rt.def.doors.length) assert.deepEqual(reached(on.world, rt, 0.35), reached(off.world, was, 0.35), `room ${rt.id} (seed ${seed}): the same doorways reached, by the visitor and by something of r 0.35`);
      for (const k of rt.cabinets) if (k.solid) for (const lane of doorLanes(rt.def)) {
        const r = localRect(rt, k.solid);
        assert.ok(!(r.x0 < lane.x1 && lane.x0 < r.x1 && r.z0 < lane.z1 && lane.z0 < r.z1), `room ${rt.id} (seed ${seed}): nothing solid in a doorway's lane`);
      }
    }
    done(off, on);
  }
  for (const how of ['pile', 'sunk', 'wall', 'flush', 'ceiling', 'alone']) assert.ok(seen.has(how), `the ${how} placement turned up on the floors tried (${[...seen]})`);
});

test('what is in the drawers: paper common, the odd thing rare, and the only things to carry are the ones the part was dealt', async () => {
  // (the fills, over a great many cabinets: the rolls are their own stream, so this is what a floor deals)
  const counts = {};
  let drawers = 0;
  const { c } = await oneRoom({ after() {} }, () => {});
  for (let n = 0; n < 3000; n++) {
    const R = makeRng(`${c.level.seed}/cabinets/0/${n}`);
    R.int(0, 4); R.int(0, 7); R.chance(K.DRAWERS.locked);
    for (let i = 0; i < 4; i++) { const odd = R.chance(K.DRAWERS.odd); R.int(0, 5); const roll = R(); const f = odd ? 'odd' : roll < K.DRAWERS.files ? 'files' : roll < K.DRAWERS.files + K.DRAWERS.paper ? 'paper' : 'empty'; counts[f] = (counts[f] || 0) + 1; drawers++; }
  }
  assert.ok(counts.odd / drawers < 0.05 && counts.odd / drawers > 0.015, `the odd thing is rare (${counts.odd}/${drawers})`);
  assert.ok((counts.files + counts.paper) / drawers > 0.55, 'most hold paper, to look at');
  // what can be carried is only what supplies.js dealt the part: hide() (rt.hide) moves a thing it is handed into a drawer, and makes none
  for (const seed of SEEDS.slice(0, 4)) {
    const on = await floor(seed, new Set(['cabinets']));
    const plan = [...planSupplies(on.level, []), ...plentyOfPaper(on.level)];
    const hidden = {}, dealt = {};
    for (const p of plan) {
      dealt[p.type] = (dealt[p.type] || 0) + 1;
      for (const id of p.rooms) {
        const rt = on.world.rooms.find((r) => r.id === id);
        if (rt?.drawers?.length && K.hide(rt, { id: `t:${seed}:${p.id}`, type: p.type })) { hidden[p.type] = (hidden[p.type] || 0) + 1; break; }
      }
    }
    for (const [type, n] of Object.entries(hidden)) assert.ok(n <= dealt[type], `seed ${seed}: no more ${type} in drawers than the part was dealt`);
    const held = on.world.rooms.flatMap((rt) => rt.drawers || []).filter((d) => d.held);
    assert.equal(held.length, Object.values(hidden).reduce((a, b) => a + b, 0), `seed ${seed}: each thing hidden once`);
    assert.ok(held.every((d) => d.holds && d.state === 'shut'), 'only in a drawer that opens and is low enough to see into');
    done(on);
  }
  // inventory.js hands rt.hide only what it was about to put on a floor
  const inv = readFileSync(new URL('inventory.js', B), 'utf8');
  assert.equal([...inv.matchAll(/\.hide\?\.\(/g)].length, 2, 'two places: the supplies, and the paper in plenty');
  assert.equal([...inv.matchAll(/rt\.hide\?\.\(makeItem\(type, id\(key\), made\)\)/g)].length, 2, 'each the thing it was about to place, by its own id');
  assert.ok(!/cabinets\.js'/.test(inv), 'and imports nothing of the cabinets: the room says whether it has a hiding place');
});

const hash = (rt, world) => {
  const h = createHash('sha1'), meshes = [];
  rt.group.traverse((o) => { if (o.isMesh && o.geometry) meshes.push(o); });
  for (const f of world.furniture) if (f.room === rt.id) f.group.traverse((o) => { if (o.isMesh && o.geometry) meshes.push(o); });
  for (const m of meshes) for (const a of Object.values(m.geometry.attributes)) h.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength));
  h.update(JSON.stringify(rt.colliders.map((q) => [q.x0, q.z0, q.x1, q.z1, q.on]))); h.update(JSON.stringify(rt.lights));
  return h.digest('hex');
};

test('deterministic: the same seed, the same cabinets, drawers and contents; and nothing of the room\'s stream is read', async () => {
  for (const seed of [7, 'q']) {
    const streams = {};
    const spy = (tag) => (id, next) => { (streams[id] ||= {})[tag] = next; };
    const a = await floor(seed, new Set(['cabinets']), spy('a')), b = await floor(seed, new Set(['cabinets']), spy('b')), none = await floor(seed, undefined, spy('none'));
    const sum = (f) => f.world.rooms.map((rt) => [hash(rt, f.world), (rt.drawers || []).map((d) => [d.fill, d.state, d.held?.id])]);
    assert.deepEqual(sum(a), sum(b), `seed ${seed}: built twice, the same`);
    for (const [id, s] of Object.entries(streams)) assert.ok(s.a === s.b && s.a === s.none, `room ${id}: its stream is where it was, cabinets or not`);
    done(a, b, none);
  }
  const src = readFileSync(new URL('cabinets.js', B), 'utf8') + readFileSync(new URL('cabinets.model.js', B), 'utf8');
  assert.ok(!/Math\.random|\bc\.R\b|\.spot\(|\.wallSpot\(|\.corner\(/.test(src), 'no Math.random, and nothing of the room\'s own stream');
});

test('(the preview) without &preview=cabinets nothing of it is built: today\'s rooms', async () => {
  for (const seed of [7, 3, 21]) {
    const none = await floor(seed), empty = await floor(seed, new Set()), other = await floor(seed, new Set(['clip', 'floorlight'])), on = await floor(seed, new Set(['cabinets']));
    let changed = 0;
    none.world.rooms.forEach((rt, i) => {
      for (const f of [none, empty, other]) assert.equal(f.world.rooms[i].cabinets, undefined);
      assert.equal(hash(empty.world.rooms[i], empty.world), hash(rt, none.world), `room ${i}: an empty preview is today's room`);
      if (!['phone', 'nested', 'cover', 'party', 'museum'].includes(rt.def.arch)) assert.equal(hash(other.world.rooms[i], other.world), hash(rt, none.world), `room ${i}: another preview is today's room`);
      if (on.world.rooms[i].cabinets) { changed++; assert.equal(rt.def.kind, 'plain'); }
      else assert.equal(hash(on.world.rooms[i], on.world), hash(rt, none.world), `room ${i}: a room without cabinets is untouched by the preview`);
    });
    assert.ok(changed >= 3, `seed ${seed}: the preview put cabinets in plain rooms (${changed})`);
    done(none, empty, other, on);
  }
});
