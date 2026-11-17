import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Light worked out once with each room, beyond the lamps (kit.js gfxOf, world.js gfxExtra): contact darkening and
// bounce. Off unless asked for, and then not one baked number may move. Uses the real kit, world, rooms and
// catalogue; only canvas drawing is inert, and no WebGL is needed.
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
const [{ buildWorld, loadCatalogue }, { createKit, gfxOf, bake, lamp }, { generate, ARCHETYPES }, makers] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('public/world/props/office.js', root).href)]);

const catalogueOf = (kit) => ({ has: (type) => typeof makers[type] === 'function', entry: () => null, geo: (type) => (makers[type] ? kit.model(type, makers[type]) : null) });
/** Every room of a generated floor: its shell, and a cabinet, a crate, a desk, a chair and a pillar where the seed puts them. */
const furnish = (c) => {
  c.shell();
  const a = c.spot(0.6); if (a) c.prop('cabinet', a.x, a.z);
  const b = c.spot(0.5); if (b) c.crate(b.x, b.z, 0.6, 0.7, 0.5);
  const d = c.spot(0.8); if (d) c.prop('desk', d.x, d.z);
  const e = c.spot(0.4); if (e) c.prop('chair', e.x, e.z);
  const k = c.corner(0.5); if (k) c.pillar(k.x, k.z, 0.5, 0.5);
};
async function fixture(t, { gfx, barricades = true, lighting = false, spy = null } = {}) {
  const level = generate(7, { count: 0 }), kit = gfx === undefined ? createKit() : createKit({ gfx });
  if (spy) { const geometry = kit.geometry; kit.geometry = (...args) => { spy(args); return geometry(...args); }; }
  const world = await buildWorld(kit, level, { catalogue: catalogueOf(kit), barricadesEnabled: barricades, lighting, builders: { plain: furnish } });
  t.after(() => { world.dispose(); kit.dispose(); });
  return { level, kit, world };
}
const meshesOf = (world, rt, alsoFurniture = true) => {
  const out = [];
  rt.group.traverse((o) => { if (o.isMesh && o.geometry) out.push(o); });
  if (alsoFurniture) for (const f of world.furniture) if (f.room === rt.id) f.group.traverse((o) => { if (o.isMesh && o.geometry) out.push(o); });
  return out;
};
/** A room's baked light, summed, and hashed bit for bit. */
function fingerprint(world, rt) {
  let sum = 0, hash = 0;
  for (const m of meshesOf(world, rt)) for (const key of ['aLit', 'aFlk', 'aBank0', 'aBank1', 'aBank2', 'aBank3']) {
    const a = m.geometry.attributes[key]; if (!a) continue;
    if (key === 'aLit') for (const v of a.array) sum += v;
    for (const x of new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length)) hash = (Math.imul(hash, 31) + x) >>> 0;
  }
  return [Number(sum.toFixed(6)), hash];
}
// Recorded from the code before contact darkening and bounce existed (the same fixture, run against that commit's kit and world).
// (re-recorded when the level got a desk of its own, desk.model.js: rooms 0, 2, 3 and 5 hold a desk and only its vertices moved the numbers; rooms 1 and 4 are as first recorded)
// (re-recorded when the shell's sockets became wallfit.model.js's sculpted plate: rooms 0, 1, 2, 3 and 5 have sockets and only their vertices moved the numbers; room 4 has none and is as before)
// (re-recorded when the chair, monitor, keyboard, filing cabinet and boxes became the level's own, workstation.model.js and storage.model.js: every one of rooms 0 to 5 holds a cabinet or a chair, and only their vertices moved the numbers)
const BEFORE = {
  barricades: [[1584.031356, 2252140634], [1049.094746, 1223968603], [822.373768, 2617162352], [1393.958369, 2383361265], [423.041536, 1938364466], [3911.317837, 2896181836]],
  fixed: [[1584.031356, 2252140634], [1049.094746, 1223968603], [822.373768, 2617162352], [1393.958369, 2383361265], [423.041536, 1938364466], [3911.317837, 2896181836]],
};

test('gfx: off unless asked for, and off is the bake there was before, number for number', async (t) => {
  for (const o of [undefined, null, {}, { contact: 0, bounce: 0 }, { contact: -1 }, { contact: 'x' }]) assert.equal(gfxOf(o), null);
  assert.deepEqual(gfxOf({ contact: 2, bounce: 0.5 }), { contact: 1, bounce: 0.5 });
  assert.equal(createKit().gfx, null);
  for (const barricades of [true, false]) {
    const extras = [];
    const { world } = await fixture(t, { barricades, spy: (args) => extras.push(args[4]) });
    assert.ok(extras.length > 0 && extras.every((e) => e == null), 'with the switch off, the bake is never handed anything of it');
    const got = world.rooms.slice(0, 6).map((rt) => fingerprint(world, rt));
    assert.deepEqual(got, BEFORE[barricades ? 'barricades' : 'fixed']);
    const zero = await fixture(t, { barricades, gfx: { contact: 0, bounce: 0 } });
    assert.deepEqual(zero.world.rooms.slice(0, 6).map((rt) => fingerprint(zero.world, rt)), got);
  }
});

/** One 8 m room with a crate in the middle, a platform with a crate on it, and the floor raised where the platform is. */
async function oneRoom(t, gfx) {
  const level = generate(7, { count: 0 }), src = level.rooms.find((r) => r.kind === 'plain' && r.panels.length >= 2);
  const def = { ...src, id: 0, x: 0, z: 0, w: 8, d: 8, W: 8, D: 8, H: 2.6, cx: 4, cz: 4, y: 0, rot: 0, doors: [], wins: [], shape: null,
    panels: [{ x: -2, z: -2, state: 'on' }, { x: 2, z: 2, state: 'on' }] };
  const kit = createKit({ gfx });
  const world = await buildWorld(kit, { ...level, rooms: [def], links: [], windows: [] }, { catalogue: catalogueOf(kit), barricadesEnabled: false, builders: { plain: (c) => {
    c.shell();
    c.crate(1, 0, 1, 1, 1);
    c.flat.box(-3.5, 0, -1, -1.5, 0.4, 1, [0.5, 0.5, 0.5]);            // a platform, 0.4 m: its top is floor here
    c.rt.floorY = (x, z) => (x >= -3.5 && x <= -1.5 && z >= -1 && z <= 1 ? 0.4 : 0);
    c.crate(-2.5, 0, 0.5, 0.6, 0.5, 0, [0.6, 0.55, 0.45], { y: 0.4 });
  } } });
  t.after(() => { world.dispose(); kit.dispose(); });
  return { world, rt: world.rooms[0] };
}
const lit = (mesh) => mesh.geometry.attributes.aLit.array;
const pos = (mesh) => mesh.geometry.attributes.position.array;
const floorMesh = (rt) => meshesOf(null, rt, false).find((m) => { const p = pos(m), n = m.geometry.attributes.normal; return p.length > 30 && n && m.geometry.attributes.aLit && n.getY(0) > 0.9 && p.every((v, i) => i % 3 !== 1 || Math.abs(v) < 1e-6) && Math.abs(p.reduce((a, v, i) => (i % 3 === 0 ? Math.max(a, Math.abs(v)) : a), 0) - 4) < 1e-6; });
const footDistance = (x, z, x0, z0, x1, z1) => Math.hypot(x - Math.max(x0, Math.min(x, x1)), z - Math.max(z0, Math.min(z, z1)));

test('gfx contact: the floor beside a solid is darker, the floor away from it is not; things are darker low down', async (t) => {
  const off = await oneRoom(t, null), on = await oneRoom(t, { contact: 1 });
  const fOff = floorMesh(off.rt), fOn = floorMesh(on.rt);
  assert.ok(fOff && fOn, 'the shell floor');
  const p = pos(fOn), a = lit(fOff), b = lit(fOn);
  let near = 0, far = 0;
  for (let i = 0; i < p.length / 3; i++) {
    const x = p[i * 3], z = p[i * 3 + 2], d = Math.min(footDistance(x, z, 0.5, -0.5, 1.5, 0.5), footDistance(x, z, -3.5, -1, -1.5, 1));
    if (d <= 0.3) { near++; for (let c = 0; c < 3; c++) assert.ok(b[i * 3 + c] < a[i * 3 + c] * 0.97, `floor at ${x},${z} (${d.toFixed(2)} m off) is darker`); }
    if (d > 1.0) { far++; for (let c = 0; c < 3; c++) assert.equal(b[i * 3 + c], a[i * 3 + c], `floor at ${x},${z} is untouched`); }
  }
  assert.ok(near >= 4 && far >= 10, `${near} near, ${far} far`);
  // the flat batch: the crate's own sides near the floor, and the platform's top under the crate standing on it
  const flat = (rt) => meshesOf(null, rt, false).find((m) => pos(m).length / 3 >= 24 && [...pos(m)].some((v, i) => i % 3 === 1 && Math.abs(v - 0.4) < 1e-6) && [...pos(m)].some((v, i) => i % 3 === 1 && Math.abs(v - 1) < 1e-6));
  const flOff = flat(off.rt), flOn = flat(on.rt), q = pos(flOn), nrm = flOn.geometry.attributes.normal;
  let low = 0, ontop = 0;
  for (let i = 0; i < q.length / 3; i++) {
    const x = q[i * 3], y = q[i * 3 + 1], z = q[i * 3 + 2];
    if (Math.abs(x - 1.5) < 1e-6 && y < 0.05 && nrm.getX(i) > 0.9) { low++; assert.ok(lit(flOn)[i * 3] < lit(flOff)[i * 3] * 0.9, 'a crate is darker at its foot'); }
    if (Math.abs(x + 2.5) < 1e-6 && Math.abs(y - 0.4) < 1e-6 && Math.abs(z) < 1e-6 && nrm.getY(i) > 0.9) { ontop++; assert.ok(lit(flOn)[i * 3] < lit(flOff)[i * 3] * 0.9, 'the platform is darker under what stands on it'); }
    if (Math.abs(x - 1.5) < 1e-6 && Math.abs(y - 1) < 1e-6) assert.equal(lit(flOn)[i * 3], lit(flOff)[i * 3], 'not at its top');
  }
  assert.ok(low > 0 && ontop > 0, `${low} low corners, ${ontop} under the crate on the platform`);
});

test('gfx: contact only ever darkens; bounce only ever adds, and not much', async (t) => {
  const off = await fixture(t, { barricades: false }), dark = await fixture(t, { barricades: false, gfx: { contact: 1 } }), warm = await fixture(t, { barricades: false, gfx: { bounce: 1 } });
  let darker = 0, warmer = 0;
  for (const [i, rt] of off.world.rooms.entries()) {
    const m0 = meshesOf(off.world, rt), m1 = meshesOf(dark.world, dark.world.rooms[i]), m2 = meshesOf(warm.world, warm.world.rooms[i]);
    assert.equal(m1.length, m0.length); assert.equal(m2.length, m0.length);
    const floor = floorMesh(rt), most = floor ? Math.max(...lit(floor)) : 1;
    for (let k = 0; k < m0.length; k++) for (const key of ['aLit', 'aFlk']) {
      const a = m0[k].geometry.attributes[key]?.array; if (!a) continue;
      const b = m1[k].geometry.attributes[key].array, c = m2[k].geometry.attributes[key].array;
      for (let j = 0; j < a.length; j++) {
        assert.ok(b[j] <= a[j], 'contact never brightens'); if (b[j] < a[j]) darker++;
        assert.ok(c[j] >= a[j], 'bounce never darkens'); if (c[j] > a[j]) warmer++;
        assert.ok(c[j] - a[j] <= 0.9 * most + 1e-6, `bounce is bounded: +${c[j] - a[j]} against a floor of ${most}`);
      }
    }
  }
  assert.ok(darker > 100 && warmer > 100, `${darker} darker, ${warmer} warmer`);
});

test('gfx: with it on, lighting banks still add up to the bake (unit and whole rooms)', async (t) => {
  const lights = [lamp(-4, 2.6, 0, [1, 0.8, 0.5], { bank: 0 }), lamp(4, 2.6, 0, [1, 0.8, 0.5], { bank: 1 }), lamp(0, 2.6, 1, [0.5, 0.5, 0.5], { flick: true })];
  const amb = [0.2, 0.18, 0.14], lighting = { ambientShare: 0.92 };
  const probe = { verts: 2, pos: [-1, 0.2, -2, 3, 0.1, 2], nor: [0, 0, 1, -1, 0, 0], alb: [0.8, 0.7, 0.6, 0.5, 0.5, 0.5], ao: [0.75, 1], sf: [0, 0, 0, 0], vox: false };
  const extra = { ao: new Float32Array([0.7, 0.9]), bounce: { w: new Float32Array([0.3, 0.2]), src: new Float32Array([-1, 0, -1.7, 0, 1, 0, 2.7, 0, 2, 0, 1, 0]), rgb: new Float32Array([0.6, 0.5, 0.3, 0.4, 0.4, 0.2]) } };
  const steady = lights.map((l) => (l.flick ? l : { ...l, flick: false }));
  const whole = bake(probe, steady, amb, null, extra), split = bake(probe, steady, amb, lighting, extra);
  for (let c = 0; c < 6; c++) assert.ok(Math.abs(whole.lit[c] + whole.flk[c] - (split.lit[c] + split.flk[c] + split.banks[0][c] + split.banks[1][c])) < 1e-6);
  const plain = bake(probe, steady, amb, null, { ao: extra.ao });
  for (let c = 0; c < 6; c++) assert.ok(whole.lit[c] > plain.lit[c], 'the bounce reaches both');

  const nb = await fixture(t, { barricades: false, gfx: { contact: 1, bounce: 1 } }), banked = await fixture(t, { barricades: false, lighting: 'dim', gfx: { contact: 1, bounce: 1 } });
  let rooms = 0;
  for (const rt of banked.world.rooms) {
    if (!rt.lighting) continue;
    rooms++;
    const withAttr = (w, r) => meshesOf(w, r, false).filter((m) => m.geometry.attributes.aLit);
    const a = withAttr(nb.world, nb.world.rooms[rt.id]), b = withAttr(banked.world, rt);
    assert.equal(a.length, b.length);
    for (let k = 0; k < a.length; k++) {
      const A = a[k].geometry.attributes, Bt = b[k].geometry.attributes;
      for (let j = 0; j < A.aLit.array.length; j++) {
        let parts = Bt.aLit.array[j] + (Bt.aFlk?.array[j] || 0);
        for (let n = 0; n < 4; n++) parts += Bt[`aBank${n}`]?.array[j] || 0;
        const all = A.aLit.array[j] + (A.aFlk?.array[j] || 0);
        assert.ok(Math.abs(parts - all) < 1e-4 * Math.max(1, all), `${parts} != ${all}`);
      }
    }
  }
  assert.ok(rooms > 0);
});

test('gfx: generation does not move, and no room gains a triangle or a mesh', async (t) => {
  const fresh = JSON.stringify(generate(7, { count: 0 }));
  const off = await fixture(t, {}), on = await fixture(t, { gfx: { contact: 1, bounce: 1 } });
  assert.equal(JSON.stringify(on.level), fresh, 'the level handed to the world is as generated');
  assert.equal(JSON.stringify(generate(7, { count: 0 })), fresh);
  const counts = (world) => world.rooms.map((rt) => { let tri = 0; const m = meshesOf(world, rt); for (const o of m) tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; return [m.length, tri]; });
  assert.deepEqual(counts(on.world), counts(off.world));

  // and real rooms, built by their own files
  const { BUILDERS } = await import(new URL('rooms.js', B).href);
  const only = ['copiers', 'mailroom', 'cutouts', 'vending'];
  const real = async (gfx) => {
    const level = generate(7, { only }), builders = { ...BUILDERS };
    for (const id of new Set(level.rooms.map((r) => r.arch))) { const a = ARCHETYPES[id]; if (a?.module) { const mod = await import(new URL(a.module, B).href); if (mod.build) builders[id] = mod.build; } }
    const kit = gfx ? createKit({ gfx }) : createKit();
    const env = { level, kit, builders, catalogue: await loadCatalogue(kit), barricadesEnabled: true, lighting: false, plan: {},
      cast: ['Ivory Marten', 'Amber Vireo', 'Olive Heron'].map((name) => ({ name, look: { species: 'human' } })), who: { name: 'Robin', look: { species: 'human' }, creations: {} },
      hatches: new Map(), ready: [], play() {}, interfere() {}, sees: () => false, run: { met() {}, survived() {} }, end() {}, steadyLighting: () => false, difficulty: () => 'normal' };
    const world = await buildWorld(kit, level, env);
    env.world = world;
    t.after(() => { world.dispose(); kit.dispose(); });
    return { level, world };
  };
  const [a, b] = [await real(null), await real({ contact: 1, bounce: 1 })];
  assert.equal(JSON.stringify(a.level), JSON.stringify(b.level));
  for (const id of only) assert.ok(a.world.rooms.some((rt) => rt.def.arch === id), id);
  assert.deepEqual(counts(b.world), counts(a.world));
});
