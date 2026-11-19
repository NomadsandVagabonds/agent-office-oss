import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Things half inside the structure (clipping.js; a preview, docs/BLOCKROOMS-PREVIEWS.md "Clipping"): the part inside a
// wall, the floor or the ceiling is cut off the geometry at build time; what is left is solid only in open space and
// never in a doorway's lane; it never walls a route off; and without the dev page's &preview=clip nothing of it is
// built and nothing of the seed is read. Uses the real kit, world, rooms and catalogue; canvas drawing is inert, no WebGL.
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
const [THREE, { buildWorld, loadCatalogue }, { createKit }, { generate, ARCHETYPES, wallPoint }, { BUILDERS }, C] = await Promise.all([
  import(three.href), import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href),
  import(new URL('rooms.js', B).href), import(new URL('clipping.js', B).href)]);
const ROOMS = ['phone', 'nested', 'cover'];

test('the cut: nothing of a geometry is left outside its planes, and what was inside is kept as it was', () => {
  const geo = new THREE.BoxGeometry(2, 2, 2, 3, 3, 3);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count * 3).fill(0.5), 3));
  const planes = [{ n: [1, 0, 0], d: 0.3 }, { n: [0, -1, 0], d: 0.2 }];
  const { geo: out, cut, kept } = C.cutGeometry(geo, planes);
  assert.ok(cut > 0 && kept > 0);
  const p = out.attributes.position;
  let x1 = -Infinity, y0 = Infinity;
  for (let i = 0; i < p.count; i++) { x1 = Math.max(x1, p.getX(i)); y0 = Math.min(y0, p.getY(i)); }
  assert.ok(Math.abs(x1 - 0.3) < 1e-6 && Math.abs(y0 + 0.2) < 1e-6, `cut at the planes (${x1}, ${y0})`);
  for (const k of ['normal', 'uv', 'color']) assert.equal(out.attributes[k].count, p.count, `${k} is carried along the cut`);
  // the planes in the room's frame carried into a model's: the same points kept
  const m = C.placeMatrix(1.2, -0.4, { rot: 0.7, y: -0.3, scale: 0.5 }), local = C.toModel([{ n: [0, 0, 1], d: 0 }], m), v = new THREE.Vector3(3, 5, -2);
  const room = v.clone().applyMatrix4(m), model = local[0].n[0] * v.x + local[0].n[1] * v.y + local[0].n[2] * v.z - local[0].d;
  assert.ok(Math.abs(model - room.z) < 1e-9);
});

test('solid only in open space: never in a doorway\'s lane, never out of reach, never inside the wall', () => {
  const room = { W: 8, D: 8, doors: [{ side: 'front', c: 0, w: 1.2 }, { side: 'right', c: 1, w: 1 }] };
  assert.equal(C.solidPart({ x0: -0.3, z0: 3.2, x1: 0.3, z1: 3.6, y0: 0, y1: 0.9 }, room).why, 'a doorway');
  assert.equal(C.solidPart({ x0: 3.2, z0: 0.6, x1: 3.9, z1: 1.2, y0: 0, y1: 0.9 }, room).why, 'a doorway');
  assert.equal(C.solidPart({ x0: -1, z0: -1, x1: 1, z1: 1, y0: 1.7, y1: 2.6 }, room).why, 'out of reach');
  assert.equal(C.solidPart({ x0: -1, z0: -1, x1: 1, z1: 1, y0: -0.7, y1: 0.02 }, room).why, 'out of reach');
  assert.equal(C.solidPart({ x0: 4.0, z0: -2, x1: 4.3, z1: -1, y0: 0, y1: 0.9 }, room).why, 'all inside');
  const ok = C.solidPart({ x0: 3.6, z0: -2, x1: 4.3, z1: -1.4, y0: 0, y1: 0.9 }, room);
  assert.equal(ok.why, 'open space'); assert.equal(ok.rect.x1, 4, 'clamped to the wall');
});

const makers = await import(new URL('public/world/props/office.js', root).href);
const catalogueOf = (kit) => ({ has: (type) => typeof makers[type] === 'function', entry: () => null, geo: (type) => (makers[type] ? kit.model(type, makers[type]) : null) });
/** One 8 m room with no doorways, and whatever `build` puts in it. */
async function oneRoom(t, build) {
  const level = generate(7, { count: 0 }), src = level.rooms.find((r) => r.kind === 'plain');
  const def = { ...src, id: 0, x: 0, z: 0, w: 8, d: 8, W: 8, D: 8, H: 2.6, cx: 4, cz: 4, y: 0, rot: 0, doors: [], wins: [], shape: null, panels: [], dress: [], pillars: [] };
  const kit = createKit();
  const world = await buildWorld(kit, { ...level, rooms: [def], links: [], windows: [] }, { catalogue: catalogueOf(kit), barricadesEnabled: true, builders: { plain: (c) => { c.shell(); build(c); } } });
  t.after(() => { world.dispose(); kit.dispose(); });
  return world.rooms[0];
}
const vertsOf = (rt) => { const out = []; rt.group.traverse((o) => { if (o.isMesh && o.geometry) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) out.push([p.getX(i), p.getY(i), p.getZ(i)]); } }); return out; };

test('through a wall, down into the floor, out of the ceiling: nothing of it shows on the far side', async (t) => {
  const bare = await oneRoom(t, () => {});
  const before = vertsOf(bare).length;
  const rt = await oneRoom(t, (c) => {
    C.clip(c, 'chair', 3.9, 1, { rot: 2.0 });                 // two-thirds through the right-hand wall
    C.clip(c, 'desk', -1, 0, { y: -0.63 });                    // to its top in the carpet
    C.clip(c, 'cabinet', 0, -3.5, { flip: true, y: 3.1 });     // out of the ceiling, upside down, and into the back wall
  });
  const all = vertsOf(rt), e = C.CLIP.into + 1e-4;
  assert.ok(all.length > before, 'something was put down');
  for (const [x, y, z] of all) assert.ok(Math.abs(x) <= 4 + e && Math.abs(z) <= 4 + e && y >= -e && y <= 2.6 + e, `a vertex outside the room: ${x}, ${y}, ${z}`);
  const [chair, desk, cabinet] = rt.clipped;
  assert.ok(chair.cut > 0 && desk.cut > 0 && cabinet.cut > 0, 'each was really cut');
  assert.equal(chair.why, 'open space', JSON.stringify(chair)); assert.ok(chair.solid && chair.solid.x1 <= rt.def.cx + 4 + 1e-9 && chair.solid.x0 >= rt.def.cx + 4 - 0.7, JSON.stringify(chair) + ' the chair is solid only where it stands in the room');
  assert.equal(desk.why, 'out of reach'); assert.equal(cabinet.why, 'out of reach');
  assert.equal(rt.colliders.filter((q) => q.furniture).length, 0, 'none of it is furniture to be dragged');
});

/** A floor with the three rooms dealt, built as the game builds it. */
async function floor(seed, preview, spy) {
  const level = generate(seed, { only: ROOMS }), builders = { ...BUILDERS };
  for (const id of new Set(level.rooms.map((r) => r.arch))) { const a = ARCHETYPES[id]; if (a?.module) { const mod = await import(new URL(a.module, B).href); if (mod.build) builders[id] = mod.build; } }
  if (spy) for (const id of ROOMS) { const build = builders[id]; builders[id] = (c) => { build(c); spy(id, c.R()); }; }      // (where the room's stream is once it is built)
  const kit = createKit(), said = [], warn = console.warn;
  const env = { level, kit, builders, catalogue: await loadCatalogue(kit), barricadesEnabled: true, lighting: false, plan: {}, preview,
    cast: [], who: { name: 'Robin', look: { species: 'human' }, creations: {} }, hatches: new Map(), ready: [], play() {}, interfere() {}, sees: () => false, run: { met() {}, survived() {} }, end() {}, steadyLighting: () => false, difficulty: () => 'normal' };
  console.warn = (...a) => said.push(a.map(String).join(' '));
  try { const world = await buildWorld(kit, level, env); return { world, kit, said, rooms: world.rooms.filter((r) => ROOMS.includes(r.def.arch)) }; }
  finally { console.warn = warn; }
}
const SEEDS = [7, 21, 3, 11, 40, 'q', 'zz', 102];

test('never a trap: with the preview every doorway is still reached, and nothing that was walkable is lost but the thing itself', async () => {
  for (const seed of SEEDS) {
    const off = await floor(seed), on = await floor(seed, new Set(['clip']));
    assert.deepEqual(on.said.filter((s) => /could not be reached|would not build|now flat/.test(s) && (/\b(phone|nested|cover)\b/.test(s) || /could not be reached|now flat/.test(s))), [], `seed ${seed}: ${on.said}`);
    assert.deepEqual(on.said.filter((s) => /could not be reached|now flat/.test(s)), off.said.filter((s) => /could not be reached|now flat/.test(s)), `seed ${seed}: the preview made no room give up its furniture`);
    assert.equal(on.rooms.length, 3, `seed ${seed}: the three rooms are on the floor`);
    for (const rt of on.rooms) {
      const was = off.rooms.find((r) => r.def.id === rt.def.id), def = rt.def;
      assert.ok(rt.clipped?.length, `${def.arch} (seed ${seed}) has its wrong thing`);
      assert.ok(rt.colliders.every((q) => q.on !== false), `${def.arch} (seed ${seed}): nothing had to stop being solid`);
      const walk = on.world.walkable(rt), seen = walk.flood([def.doors[0]]);
      for (const dr of def.doors) assert.ok(seen[walk.key(wallPoint(def, dr.side, dr.c, 0.5))], `${def.arch} (seed ${seed}): its ${dr.side} doorway is reached`);
      const before = off.world.walkable(was), had = before.flood([def.doors[0]]);
      const near = (p) => rt.clipped.some((k) => k.solid && p.x > k.foot.x0 - 0.36 && p.x < k.foot.x1 + 0.36 && p.z > k.foot.z0 - 0.36 && p.z < k.foot.z1 + 0.36);
      for (let k = 0; k < had.length; k++) if (had[k] && !seen[k]) assert.ok(near(walk.at(k)), `${def.arch} (seed ${seed}): a cell far from the thing is no longer reached (${JSON.stringify(walk.at(k))})`);
      for (const k of rt.clipped) if (k.solid) for (const dr of def.doors) {
        const p = wallPoint(def, dr.side, dr.c, 0.5);
        assert.ok(!(p.x > k.foot.x0 - 0.3 && p.x < k.foot.x1 + 0.3 && p.z > k.foot.z0 - 0.3 && p.z < k.foot.z1 + 0.3), `${def.arch}: nothing solid in a doorway`);
      }
    }
    for (const f of [off, on]) { f.world.dispose(); f.kit.dispose(); }
  }
});

const hash = (rt, world) => {
  const h = createHash('sha1'), meshes = [];
  rt.group.traverse((o) => { if (o.isMesh && o.geometry) meshes.push(o); });
  for (const f of world.furniture) if (f.room === rt.id) f.group.traverse((o) => { if (o.isMesh && o.geometry) meshes.push(o); });
  for (const m of meshes) for (const a of Object.values(m.geometry.attributes)) h.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength));
  h.update(JSON.stringify(rt.colliders.map((q) => [q.x0, q.z0, q.x1, q.z1, q.on]))); h.update(JSON.stringify(rt.lights));
  return h.digest('hex');
};

test('without the preview nothing of it is built, and with it nothing of the seed is read', async () => {
  for (const seed of [7, 3]) {
    const streams = {};
    const spy = (tag) => (id, next) => { (streams[id] ||= {})[tag] = next; };
    const none = await floor(seed, undefined, spy('none')), empty = await floor(seed, new Set(), spy('empty')), other = await floor(seed, new Set(['corners']), spy('other')), on = await floor(seed, new Set(['clip']), spy('on'));
    for (let i = 0; i < 3; i++) {
      for (const f of [none, empty, other]) assert.equal(f.rooms[i].clipped, undefined);
      assert.equal(hash(empty.rooms[i], empty.world), hash(none.rooms[i], none.world), `${none.rooms[i].def.arch}: an empty preview is today's room`);
      assert.equal(hash(other.rooms[i], other.world), hash(none.rooms[i], none.world), `${none.rooms[i].def.arch}: another preview is today's room`);
      assert.notEqual(hash(on.rooms[i], on.world), hash(none.rooms[i], none.world), `${none.rooms[i].def.arch}: the preview changes it`);
    }
    for (const id of ROOMS) assert.ok(new Set(Object.values(streams[id])).size === 1 && Object.keys(streams[id]).length === 4, `${id}: the room's stream is where it was, preview or not (${JSON.stringify(streams[id])})`);
    for (const f of [none, empty, other, on]) { f.world.dispose(); f.kit.dispose(); }
  }
});

test('the dressing rolls nothing and reaches for nothing', () => {
  const src = readFileSync(new URL('clipping.js', B), 'utf8');
  assert.ok(!/Math\.random|\bc\.R\b|\.spot\(|\.wallSpot\(|\.corner\(/.test(src), 'clipping.js reads no seeded stream and nothing random');
  for (const file of ['rooms2.js', 'rooms4.js', 'rooms/cover.js']) {
    const text = readFileSync(new URL(file, B), 'utf8'), blocks = [...text.matchAll(/if \((?:previewing\(c, 'clip'\)|sunk)\) \{([\s\S]*?)\n  \}/g)].map((m) => m[1]);
    assert.ok(blocks.length >= 1, `${file} has its preview behind the flag`);
    for (const b of blocks) assert.ok(!/\bR[.(]|Math\.random|\.spot\(|\.wallSpot\(|\.corner\(/.test(b), `${file}: the preview rolls nothing`);
  }
});
