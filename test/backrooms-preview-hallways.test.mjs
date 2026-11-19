import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// The dev page's &preview=hallways (preview.js): corridors whose walls are not a rectangle, inside the rectangles the
// floor's route is worked out on. Off, nothing is touched; on, every doorway of a shaped corridor is still reached from
// every other by a body the visitor's size, nowhere is narrower than NARROWEST, and what stops you is exactly what is drawn.
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
const [{ buildWorld, loadCatalogue }, { createKit }, { generate, ARCHETYPES }, { BUILDERS }, P, { planVisit, floorOf }, { fits }, { doorPlan }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('rooms.js', B).href),
  import(new URL('preview.js', B).href), import(new URL('plan.js', B).href), import(new URL('quiet.js', B).href), import(new URL('doors.js', B).href)]);
const src = (p) => readFileSync(new URL(p, root), 'utf8');

/** A floor built as the dev page builds it (the real builders, every oddity's own), with what the level said while it was built. */
async function built(level, gfx = null) {
  const builders = { ...BUILDERS };
  for (const id of new Set(level.rooms.map((r) => r.arch))) { const a = ARCHETYPES[id]; if (a?.module) { const mod = await import(new URL(a.module, B).href); if (mod.build) builders[id] = mod.build; } }
  const said = [], warn = console.warn;
  console.warn = (...args) => said.push(args.map(String).join(' '));
  if (level.previewAsk) P.preparePreview(level, builders, level.previewAsk);
  const kit = gfx ? createKit({ gfx }) : createKit();
  const env = { level, kit, builders, catalogue: await loadCatalogue(kit), barricadesEnabled: true, lighting: false, plan: {},
    cast: ['Ivory Marten', 'Amber Vireo'].map((name) => ({ name, look: { species: 'human' } })), who: { name: 'Robin', look: { species: 'human' }, creations: {} },
    hatches: new Map(), ready: [], play() {}, interfere() {}, sees: () => false, run: { met() {}, survived() {} }, end() {}, steadyLighting: () => false, difficulty: () => 'normal' };
  try { const world = await buildWorld(kit, level, env); return { world, kit, said }; }
  finally { console.warn = warn; }
}
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

test('flag off: nothing is changed, and the generator and the plan know nothing of it', () => {
  for (const seed of [7, 21]) {
    const level = generate(seed, { theme: 'yellow' }), before = JSON.stringify(level);
    for (const ask of [null, '', 'nothing', undefined]) assert.equal(P.preparePreview(level, {}, ask), null);
    assert.equal(JSON.stringify(level), before, 'a level not asked for a preview is untouched');
  }
  // generate() and the visit's plan (and so plan.js edition(), which hashes the plan and every part) never see it
  for (const file of ['public/world/backrooms/gen.js', 'public/world/backrooms/plan.js', 'public/world/backrooms/frame.js', 'public/world/backrooms/world.js'])
    assert.doesNotMatch(src(file), /preview\.js|preparePreview/, `${file} does not reach the previews`);
  assert.match(src('public/world/backrooms/index.js'), /if \(opt\.debug && opt\.dev\?\.preview\)/, 'only a debug visit with the dev page\'s flag asks for one');
  assert.doesNotMatch(src('public/world/backrooms/preview.js'), /Math\.random\(/, 'nothing about the shapes is random');
});

test('flag on: the same floor gives the same shapes, and generate() itself is not moved by it', () => {
  const a = generate(19, { theme: 'yellow' }), b = generate(19, { theme: 'yellow' }), fresh = JSON.stringify(generate(19, { theme: 'yellow' }));
  P.preparePreview(a, null, 'hallways'); P.preparePreview(b, null, 'hallways');
  assert.deepEqual(a.preview, b.preview);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(JSON.stringify(generate(19, { theme: 'yellow' })), fresh, 'a preview on one level object leaves the next generate() as it was');
});

test('flag on, many floors: every shaped corridor walks end to end, is wide enough, keeps its doorways open, and leaves its neighbours fine', () => {
  const kinds = {}, R = Number(/const RADIUS = ([\d.]+)/.exec(src('public/world/backrooms/player.js'))[1]);
  assert.equal(P.BODY_R, R, 'the preview knows the visitor\'s radius (player.js)');
  assert.ok(P.NARROWEST >= 2 * (2 * R) - 1e-9, 'the narrowest a corridor gets is at least two bodies across (four of the visitor\'s radius)');
  let shaped = 0;
  for (const seed of SEEDS) {
    const level = floorOf(planVisit(seed, { name: 'Robin' }), 0), before = new Map(level.rooms.map((r) => [r.id, JSON.stringify(r.doors.map((d) => [d.side, d.c, d.to]))]));
    const leaves = doorPlan(level).map((p) => [p.link, p.room, p.other]);
    const out = P.preparePreview(level, null, 'hallways');
    assert.deepEqual(doorPlan(level).map((p) => [p.link, p.room, p.other]), leaves, `seed ${seed}: the same doorways have leaves`);
    for (const h of out.hallways) {
      const room = level.rooms[h.room], hall = room.hall;
      shaped++; kinds[h.kind] = (kinds[h.kind] || 0) + 1;
      assert.ok(P.walksThrough(room, hall), `seed ${seed} room ${room.id} (${h.kind}): every doorway reached from the first`);
      assert.ok(P.narrowest(hall) >= P.NARROWEST - 1e-6, `seed ${seed} room ${room.id}: ${P.narrowest(hall)} m at its narrowest`);
      // (sampled along the corridor too: the distance across, at right angles to the walls, never under NARROWEST)
      const ax = P.axesOf(room);
      for (let v = -ax.len / 2; v <= ax.len / 2 + 1e-9; v += 0.05) assert.ok(P.uAt(hall.right, v) - P.uAt(hall.left, v) >= P.NARROWEST - 1e-6);
      for (const d of room.doors) {
        const at = (k, off) => wallPointOf(room, d, k, off), clip = P.hallClip(room, hall);
        // a body just inside each doorway, anywhere across it that the throat lets it be, is between the corridor's walls
        for (let k = -0.5; k <= 0.5; k += 0.1) { const p = at(k * Math.max(0, d.w - 2 * R), 0.3); assert.ok(clip(p.x, p.z, R), `seed ${seed} room ${room.id}: doorway to ${d.to} open at ${k.toFixed(1)}`); }
      }
      // the rooms next door still pass the generator's own check with the doorways as they now are (narrowed to a metre, at most)
      for (const d of room.doors) { const n = level.rooms[d.to]; if (n.kind === 'plain' || n.kind === 'start') assert.ok(fits(n, { pillars: [] }), `seed ${seed}: room ${n.id} next door`); }
    }
    // nothing else on the floor moved: every room that is not shaped and not next door to one has its doorways where they were
    const touched = new Set(out.hallways.flatMap((h) => [h.room, ...level.rooms[h.room].doors.map((d) => d.to)]));
    for (const r of level.rooms) if (!touched.has(r.id)) assert.equal(JSON.stringify(r.doors.map((d) => [d.side, d.c, d.to])), before.get(r.id));
  }
  assert.ok(shaped >= 25, `${shaped} corridors shaped over ${SEEDS.length} floors`);
  for (const k of ['taper', 'skew', 'deadend', 'dogleg']) assert.ok(kinds[k] >= 1, `at least one ${k}: ${JSON.stringify(kinds)}`);
});
function wallPointOf(room, d, along, off) {
  const at = d.c + along;
  if (d.side === 'front') return { x: at, z: room.D / 2 - off };
  if (d.side === 'back') return { x: at, z: -room.D / 2 + off };
  if (d.side === 'left') return { x: -room.W / 2 + off, z: at };
  return { x: room.W / 2 - off, z: at };
}

test('built: the no-trap check passes, and what stops you is exactly the walls that are drawn', async (t) => {
  for (const seed of [1, 2, 32]) {
    const level = floorOf(planVisit(seed, { name: 'Robin' }), 0);
    level.previewAsk = 'hallways';
    const { world, kit, said } = await built(level);
    t.after(() => { world.dispose(); kit.dispose(); });
    // (an oddity that will not build without a browser says so here too, with or without the preview: only a plain room's failing would be ours)
    assert.deepEqual(said.filter((s) => /could not be reached|flat and empty|(plain|start) would not build/.test(s)), [], `seed ${seed}: nothing walled off, nothing fell back`);
    assert.ok(level.preview.hallways.length >= 1, `seed ${seed} has a shaped corridor`);
    for (const h of level.preview.hallways) {
      const rt = world.rooms[h.room], { def } = rt, hall = def.hall, walls = P.hallWalls(def, hall), R = 0.22;
      assert.ok(rt.clip && !rt.flat, `room ${def.id} keeps its own walls`);
      // the wall vertices the room drew inside its rectangle, at standing height, facing sideways: each is on a wall of the corridor
      const chairs = world.furniture.filter((f) => f.room === def.id).map((f) => toLocalOf(def, f.x, f.z));
      const inner = [];
      rt.group.traverse((o) => {
        if (!o.isMesh || !o.geometry?.attributes?.normal) return;
        const p = o.geometry.attributes.position, n = o.geometry.attributes.normal;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          if (Math.abs(n.getY(i)) > 0.1 || y < 0.5 || y > 1.6 || Math.abs(x) > def.W / 2 - 0.03 || Math.abs(z) > def.D / 2 - 0.03) continue;
          if (chairs.some((c) => Math.hypot(c.x - x, c.z - z) < 0.7)) continue;
          inner.push({ x, z, nx: n.getX(i), nz: n.getZ(i) });
        }
      });
      assert.ok(inner.length >= walls.length * 4, `room ${def.id}: its inner walls are drawn (${inner.length} vertices)`);
      const seg = (p, w) => { const dx = w.b.x - w.a.x, dz = w.b.z - w.a.z, L2 = dx * dx + dz * dz, k = Math.max(0, Math.min(1, ((p.x - w.a.x) * dx + (p.z - w.a.z) * dz) / L2)); return Math.hypot(p.x - (w.a.x + k * dx), p.z - (w.a.z + k * dz)); };
      for (const p of inner) {
        // (a vertex where two pieces of wall meet is on both: it faces the way one of them does)
        const on = walls.filter((w) => seg(p, w) < 1e-3);
        assert.ok(on.length, `room ${def.id}: a wall vertex at ${p.x.toFixed(2)},${p.z.toFixed(2)} lies on a wall of the corridor`);
        assert.ok(on.some((w) => p.nx * w.n.x + p.nz * w.n.z > 0.99), `room ${def.id}: and faces into the corridor`);
      }
      // …and at the middle of every wall drawn, a body stops one radius off it: not before, not after
      for (const w of walls) {
        const m = { x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 };
        assert.ok(inner.some((p) => Math.hypot(p.x - m.x, p.z - m.z) < 0.35) || chairs.some((c) => Math.hypot(c.x - m.x, c.z - m.z) < 0.7), `room ${def.id}: the wall at ${m.x.toFixed(2)},${m.z.toFixed(2)} is drawn`);
        const at = (k) => world.free(...worldOf(def, m.x + w.n.x * k, m.z + w.n.z * k), R);
        assert.equal(at(R - 0.02), false, `room ${def.id}: a body cannot stand closer than its radius to the wall`);
        assert.equal(at(-0.1), false, 'nor behind it, in the solid part');
        if (!chairs.some((c) => Math.hypot(c.x - m.x, c.z - m.z) < 1.2)) assert.equal(at(R + 0.03), true, `room ${def.id}: and can stand just clear of it`);
      }
      // the floor's own walking grid (the one the no-trap check floods) reaches every doorway from the first
      const walk = world.walkable(rt), seen = walk.flood([def.doors[0]]);
      for (const d of def.doors) assert.ok(seen[walk.key(wallPointOf(def, d, 0, 0.5))], `room ${def.id}: doorway to ${d.to} reached on the level's own grid`);
    }
  }
});
function toLocalOf(def, x, z) {
  const COS = [1, 0, -1, 0], SIN = [0, 1, 0, -1], c = COS[def.rot], s = SIN[def.rot], dx = x - def.cx, dz = z - def.cz;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}
function worldOf(def, lx, lz) {
  const COS = [1, 0, -1, 0], SIN = [0, 1, 0, -1], c = COS[def.rot], s = SIN[def.rot];
  return [def.cx + lx * c + lz * s, def.cz - lx * s + lz * c];
}

test('built: rooms the preview did not touch are built bit for bit as without it', async (t) => {
  const seed = 1, plainLevel = floorOf(planVisit(seed, { name: 'Robin' }), 0);
  const asked = floorOf(planVisit(seed, { name: 'Robin' }), 0);
  asked.previewAsk = 'hallways';
  const a = await built(plainLevel), b = await built(asked);
  t.after(() => { for (const x of [a, b]) { x.world.dispose(); x.kit.dispose(); } });
  const touched = new Set(asked.preview.hallways.flatMap((h) => [h.room, ...asked.rooms[h.room].doors.map((d) => d.to)]));
  let same = 0;
  for (const rt of a.world.rooms) {
    if (touched.has(rt.id)) continue;
    assert.deepEqual(roomPrint(b.world, b.world.rooms[rt.id]), roomPrint(a.world, rt), `room ${rt.id} as it was`);
    same++;
  }
  assert.ok(same >= a.world.rooms.length - touched.size);
});
function roomPrint(world, rt) {
  let h = 0, n = 0;
  const meshes = [];
  rt.group.traverse((o) => { if (o.isMesh && o.geometry) meshes.push(o); });
  for (const f of world.furniture) if (f.room === rt.id) f.group.traverse((o) => { if (o.isMesh && o.geometry) meshes.push(o); });
  for (const m of meshes) for (const key of ['position', 'aLit']) {
    const a = m.geometry.attributes[key]; if (!a) continue;
    for (const x of new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length)) { h = (Math.imul(h, 31) + x) >>> 0; n++; }
  }
  return [meshes.length, n, h, rt.colliders.length, rt.lights.length];
}
