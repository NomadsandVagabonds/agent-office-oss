import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// The dev page's &preview=corners (preview.js): doorways slid along their walls into a corner of the room, so that the
// opening runs to the end of the wall. Off, nothing is touched; on, the floor's rooms and the way through them are what
// they were, every room the generator would pass still passes, and there is no pocket by a corner to be stuck in.
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
const [{ buildWorld, loadCatalogue }, { createKit }, { generate, ARCHETYPES, roomDistances, wallLength, wallPoint }, { BUILDERS }, P, { planVisit, floorOf }, { fits }, { doorPlan }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('rooms.js', B).href),
  import(new URL('preview.js', B).href), import(new URL('plan.js', B).href), import(new URL('quiet.js', B).href), import(new URL('doors.js', B).href)]);
const src = (p) => readFileSync(new URL(p, root), 'utf8');

async function built(level, preview) {
  const builders = { ...BUILDERS };
  for (const id of new Set(level.rooms.map((r) => r.arch))) { const a = ARCHETYPES[id]; if (a?.module) { const mod = await import(new URL(a.module, B).href); if (mod.build) builders[id] = mod.build; } }
  if (preview) P.preparePreview(level, builders, preview);
  const said = [], warn = console.warn;
  console.warn = (...args) => said.push(args.map(String).join(' '));
  const kit = createKit();
  const env = { level, kit, builders, catalogue: await loadCatalogue(kit), barricadesEnabled: true, lighting: false, plan: {},
    cast: ['Ivory Marten', 'Amber Vireo'].map((name) => ({ name, look: { species: 'human' } })), who: { name: 'Robin', look: { species: 'human' }, creations: {} },
    hatches: new Map(), ready: [], play() {}, interfere() {}, sees: () => false, run: { met() {}, survived() {} }, end() {}, steadyLighting: () => false, difficulty: () => 'normal' };
  try { const world = await buildWorld(kit, level, env); return { world, kit, said }; }
  finally { console.warn = warn; }
}
const floor = (seed) => floorOf(planVisit(seed, { name: 'Robin' }), 0);
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const doorsOf = (level) => level.rooms.map((r) => JSON.stringify(r.doors.map((d) => [d.side, d.c, d.w, d.to, d.link, d.h, d.kind])));

test('flag off: nothing is changed, and the generator and the plan know nothing of it', () => {
  for (const seed of [7, 21]) {
    const level = generate(seed, { theme: 'yellow' }), before = JSON.stringify(level);
    for (const ask of [null, '', 'corner', undefined]) assert.equal(P.preparePreview(level, {}, ask), null);
    assert.equal(JSON.stringify(level), before);
  }
  for (const file of ['public/world/backrooms/gen.js', 'public/world/backrooms/plan.js', 'public/world/backrooms/frame.js', 'public/world/backrooms/world.js', 'public/world/backrooms/doors.js'])
    assert.doesNotMatch(src(file), /preview\.js|preparePreview/, `${file} does not reach the previews`);
  assert.doesNotMatch(src('public/world/backrooms/preview.js'), /Math\.random\(/);
});

test('flag on, many floors: doorways go to corners, pass every check the old place did, and the floor is the same floor', () => {
  let links = 0, moved = 0, both = 0, shared = 0;
  for (const seed of SEEDS) {
    const level = floor(seed), fresh = floor(seed), before = doorsOf(level), hung = new Set(doorPlan(level).map((p) => p.link));
    const dist = roomDistances(level, level.start.room);
    const out = P.preparePreview(level, null, 'corners');
    links += level.links.length; moved += out.corners.length; both += out.corners.filter((m) => m.both).length;
    const movedLinks = new Set(out.corners.map((m) => m.link));
    for (const m of out.corners) {
      const link = level.links[m.link], w = link.to - link.from;
      assert.ok(Math.abs(w - (m.to - m.from)) < 1e-6, `seed ${seed} link ${m.link}: as wide as it was`);
      assert.ok(!link.door && !hung.has(link.id) && (link.kind === 'door' || link.kind === 'arch'), 'only an open doorway or an arch, never one hung with leaves');
      let inCorner = 0;
      for (const id of m.rooms) {
        const r = level.rooms[id], d = r.doors.find((k) => k.link === m.link), half = wallLength(r, d.side) / 2;
        assert.ok(d.c - d.w / 2 >= -half - 1e-6 && d.c + d.w / 2 <= half + 1e-6, `seed ${seed} room ${id}: inside its wall`);
        if (P.cornerOf(r, d)) inCorner++;
        // no other opening on that wall closer than 30 cm, and the generator's own check of the room still passes
        for (const e of r.doors) if (e !== d && e.side === d.side) assert.ok(Math.abs(e.c - d.c) >= (e.w + d.w) / 2 + 0.3 - 1e-6, `seed ${seed} room ${id}: clear of the doorway beside it`);
        for (const e of r.wins || []) if (e.side === d.side) assert.ok(Math.abs(e.c - d.c) >= (e.w + d.w) / 2 + 0.3 - 1e-6, 'clear of a window');
        if (r.kind === 'plain' || r.kind === 'start') assert.ok(fits(r, { pillars: [] }), `seed ${seed} room ${id}: every doorway still reached (quiet.js fits)`);
      }
      assert.ok(inCorner >= 1, `seed ${seed} link ${m.link}: in a corner of one of its rooms at least`);
      if (m.both) assert.equal(inCorner, 2, 'in the corner of both, where their walls end together');
    }
    // the floor is the same floor: the same rooms, the same doorways between the same rooms, the same way to the way out
    assert.deepEqual(level.rooms.map((r) => [r.x, r.z, r.w, r.d, r.H]), fresh.rooms.map((r) => [r.x, r.z, r.w, r.d, r.H]));
    assert.deepEqual(level.links.map((l) => [l.a, l.b, l.axis, l.at, l.kind, l.h]), fresh.links.map((l) => [l.a, l.b, l.axis, l.at, l.kind, l.h]));
    assert.deepEqual([...roomDistances(level, level.start.room)], [...dist]);
    assert.deepEqual(doorPlan(level), doorPlan(fresh), 'which doorways have leaves is as it was');
    // …and nothing else moved: every doorway that is not one of the moved ones is where it was
    const after = doorsOf(level);
    level.rooms.forEach((r, i) => { if (!r.doors.some((d) => movedLinks.has(d.link))) assert.equal(after[i], before[i]); });
    for (const r of level.rooms) {
      const ends = r.doors.map((d) => { const e = P.cornerOf(r, d); return e ? `${d.side}${e}` : null; }).filter(Boolean);
      const at = (k) => { const side = k.replace(/-?1$/, ''), e = Number(k.slice(side.length)); const half = wallLength(r, side) / 2; return side === 'front' || side === 'back' ? [e * half, side === 'front' ? 1 : -1] : [side === 'right' ? 1 : -1, e * half]; };
      const keys = ends.map((k) => { const [x, z] = at(k); return `${Math.sign(x)},${Math.sign(z)}`; });
      if (keys.length !== new Set(keys).size) shared++;
    }
  }
  assert.ok(moved / links >= 0.15, `${moved} of ${links} doorways went to a corner`);
  assert.ok(both >= moved / 4, `${both} of them into the corner of both rooms`);
  assert.ok(shared >= 20, `${shared} rooms have a corner that opens two ways`);
});

test('built: the no-trap check passes, and there is nowhere by a corner doorway to be stuck', async (t) => {
  for (const seed of [7, 28, 55]) {
    const level = floor(seed);
    const { world, kit, said } = await built(level, 'corners');
    t.after(() => { world.dispose(); kit.dispose(); });
    assert.deepEqual(said.filter((s) => /could not be reached|flat and empty|(plain|start) would not build/.test(s)), [], `seed ${seed}: nothing walled off`);
    assert.ok(level.preview.corners.length >= 5);
    for (const m of level.preview.corners) {
      const link = level.links[m.link], mid = (link.from + link.to) / 2, R = 0.22, step = 0.05;
      // every spot a body fits within a metre and a half of the doorway's corner end can be walked to from the doorway
      const ends = [link.from, link.to];
      for (const end of ends) {
        const cx = link.axis === 'x' ? link.at : end, cz = link.axis === 'x' ? end : link.at, n = Math.round(1.5 / step);
        const key = (i, j) => (i + n) * 1000 + (j + n), at = (i, j) => [cx + i * step, cz + j * step];
        const free = new Map();
        // (only the two rooms the doorway joins, and the doorway: across their other walls are other rooms, reached some other way)
        const mine = (x, z) => { const r = world.roomAt(x, z); return (r && m.rooms.includes(r.id)) || world.inThroat(x, z, R); };
        for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const [x, z] = at(i, j); free.set(key(i, j), mine(x, z) && world.free(x, z, R)); }
        // (from the doorway's middle, and from the middle of each of its two rooms' halves of the box)
        const start = link.axis === 'x' ? [Math.round((link.at - cx) / step), Math.round((mid - cz) / step)] : [Math.round((mid - cx) / step), Math.round((link.at - cz) / step)];
        const seen = new Set(), queue = [];
        const push = (i, j) => { const k = key(i, j); if (Math.abs(i) <= n && Math.abs(j) <= n && free.get(k) && !seen.has(k)) { seen.add(k); queue.push([i, j]); } };
        if (Math.abs(start[0]) <= n && Math.abs(start[1]) <= n) push(...start);
        for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) if (!seen.size && free.get(key(i, j))) push(i, j);
        while (queue.length) { const [i, j] = queue.pop(); push(i + 1, j); push(i - 1, j); push(i, j + 1); push(i, j - 1); }
        assert.ok(seen.size > 100, `seed ${seed} link ${m.link}: the floor round the corner is walked (${seen.size} spots)`);
        // anything free that was not reached inside the box must at least be reached by going round outside it: it is
        // in a room's open floor, far from the corner (more than a body from the box's edge would be a pocket)
        for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
          if (!free.get(key(i, j)) || seen.has(key(i, j))) continue;
          const edge = Math.min(n - Math.abs(i), n - Math.abs(j)) * step;
          assert.ok(edge < 0.6, `seed ${seed} link ${m.link}: a spot by the corner at ${at(i, j).map((v) => v.toFixed(2))} can be stood on but not walked to`);
        }
      }
      // and the throat lets a body through anywhere across the doorway a body fits
      for (const k of [0.25, 0.5, 0.75]) { const v = link.from + R + (link.to - link.from - 2 * R) * k; assert.ok(world.free(link.axis === 'x' ? link.at : v, link.axis === 'x' ? v : link.at, R), 'through the doorway'); }
      // but never between a corner doorway's jamb and the side wall it is flush with
      const jamb = link.from - 0.05;
      assert.equal(world.inThroat(link.axis === 'x' ? link.at : jamb, link.axis === 'x' ? jamb : link.at, R), false, 'not through the wall beside it');
    }
    // every room with a doorway moved: its doorways all reached on the grid the level walks it on
    for (const rt of world.rooms) {
      if (!level.preview.corners.some((m) => m.rooms.includes(rt.id)) || rt.def.doors.length < 2) continue;
      const walk = world.walkable(rt), seen = walk.flood([rt.def.doors[0]]);
      for (const d of rt.def.doors) assert.ok(seen[walk.key(wallPoint(rt.def, d.side, d.c, 0.5))], `seed ${seed} room ${rt.id}: doorway to ${d.to} reached on the level's own grid`);
      assert.ok(!rt.flat && rt.colliders.every((c) => c.on !== false || c.furniture), `room ${rt.id} keeps its furniture solid`);
    }
  }
});

test('built: rooms the preview did not touch are built bit for bit as without it', async (t) => {
  const seed = 7, a = await built(floor(seed), null), level = floor(seed), b = await built(level, 'corners');
  t.after(() => { for (const x of [a, b]) { x.world.dispose(); x.kit.dispose(); } });
  const touched = new Set(level.preview.corners.flatMap((m) => m.rooms));
  let same = 0;
  for (const rt of a.world.rooms) {
    if (touched.has(rt.id)) continue;
    assert.deepEqual(roomPrint(b.world, b.world.rooms[rt.id]), roomPrint(a.world, rt), `room ${rt.id} as it was`);
    same++;
  }
  assert.ok(same >= 10, `${same} rooms untouched and the same`);
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
