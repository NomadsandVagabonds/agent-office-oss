import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createHash } from 'node:crypto';

// A ceiling light a room places itself (world.js c.fitting), for a room whose shell has `panels: false`: at Classic and
// Low the shell's flat lit panel to the byte, with the shell's lamp; at Medium and High the shell's own sculpted
// fitting (world.js `fitting`, ceiling.model.js), mounted on the ceiling's face. Uses the real kit, world and
// catalogue; only canvas drawing is inert, no WebGL.
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
const [{ buildWorld, panOf }, { createKit, lin }, { generate, TILE }, makers, { profile }, { SHINING_LIGHTS }, { lightVox, CEILING }, { meshVox }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href),
  import(new URL('public/world/props/office.js', root).href), import(new URL('graphics.js', B).href), import(new URL('shining-lights.rule.js', B).href),
  import(new URL('ceiling.model.js', B).href), import(new URL('public/world/vox/mesher.js', root).href)]);
const catalogueOf = (kit) => ({ has: (type) => typeof makers[type] === 'function', entry: () => null, geo: (type) => (makers[type] ? kit.model(type, makers[type]) : null) });
const tier = (name) => { const p = profile(name); return { contact: p.contact, bounce: p.bounce, shadows: p.shadows, doorlight: p.doorlight, fixtures: p.fixtures }; };
const CLASSIC = null, LOW = tier('low'), MEDIUM = tier('medium'), HIGH = tier('high');

const SPOTS = [{ x: -1.5, z: -1.2, state: 'on' }, { x: 1.5, z: 1.2, state: 'dead' }, { x: 2.1, z: -2.4, state: 'flicker' }, { x: -2.1, z: 2.4, state: 'on' }];
/** One 8 m room with no doorways, its ceiling's panels `panels`, a crate; `build(c)` is all of its builder. */
async function oneRoom(t, build, { gfx = CLASSIC, lighting = false, panels = [], H = 2.6, barricades = false } = {}) {
  const level = generate(7, { count: 0 }), src = level.rooms.find((r) => r.kind === 'plain' && r.panels.length >= 2);
  const def = { ...src, id: 0, x: 0, z: 0, w: 8, d: 8, W: 8, D: 8, H, cx: 4, cz: 4, y: 0, rot: 0, doors: [], wins: [], shape: null, panels };
  const kit = gfx ? createKit({ gfx }) : createKit();
  const world = await buildWorld(kit, { ...level, rooms: [def], links: [], windows: [] }, { catalogue: catalogueOf(kit), barricadesEnabled: barricades, lighting, builders: { plain: (c) => { build(c); c.crate(0.4, 0, 1, 1, 1); } } });
  t.after(() => { world.dispose(); kit.dispose(); });
  return { world, kit, rt: world.rooms[0] };
}
const meshes = (rt) => { const out = []; rt.group.traverse((o) => { if (o.isMesh && o.geometry) out.push(o); }); return out; };
/** Every mesh of the room, every attribute and index to the byte (baked light included), its material's colour and map: in order. */
const bytes = (m, kit) => {
  const h = createHash('sha1'), g = m.geometry;
  for (const [name, a] of Object.entries(g.attributes).sort(([p], [q]) => (p < q ? -1 : 1))) { h.update(name); h.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)); }
  if (g.index) h.update(new Uint8Array(g.index.array.buffer, g.index.array.byteOffset, g.index.array.byteLength));
  h.update(`${m.material.type}|${m.material.color?.toArray().join()}|${texName(kit, m.material.map)}|${!!m.userData.detail}|${m.renderOrder}`);
  return h.digest('hex');
};
/** (which of the kit's textures: two kits' textures are not the same objects) */
const texName = (kit, map) => (!map ? '' : map === kit.tex.panel(true) ? 'panel:lit' : map === kit.tex.panel(false) ? 'panel:dead' : map === kit.tex.white() ? 'white' : map === kit.tex.blob() ? 'blob' : `other:${map.image?.width}x${map.image?.height}`);
const room = ({ rt, kit }) => ({ meshes: meshes(rt).map((m) => bytes(m, kit)), lights: rt.lights.map((L) => ({ ...L })), flickers: rt.flickers.length, banks: rt.bankPanels.map((m) => m.userData.bank), panel: !!rt.panelMesh });
const vox = (rt) => meshes(rt).filter((m) => m.material.defines?.VOXEL);
const head = (H) => Math.min(2.5, Math.max(0.3, H / 2.6));

test('classic and low: a fitting is the shell\'s panel to the byte, lamp and bake and all, whatever its state', async (t) => {
  for (const gfx of [CLASSIC, LOW]) for (const lighting of [false, 'failing']) {
    const shell = await oneRoom(t, (c) => c.shell(), { gfx, lighting, panels: SPOTS });
    const own = await oneRoom(t, (c) => { c.shell({ panels: false }); for (const p of SPOTS) c.fitting(p.x, p.z, { dead: p.state === 'dead', flick: p.state === 'flicker' }); }, { gfx, lighting, panels: SPOTS });
    assert.equal(shell.rt.lights.length, 3, 'three lamps: the dead light has none');
    assert.deepEqual(room(own), room(shell), `gfx ${JSON.stringify(gfx)}, lighting ${lighting}`);
  }
});

test('classic: like-for-like with a panel drawn by hand the way the shell draws one (c.shining + c.light), byte for byte', async (t) => {
  const H = 2.9, x = 0.3, z = -0.6;
  const byHand = (light = true, tubeHex) => (c) => {
    c.shell({ panels: false });
    const tube = tubeHex ? lin(tubeHex) : lin(c.look.tube), y = H - 0.006, hd = head(H);
    c.shining(tubeHex ? 'mine' : 'panel', c.kit.tex.panel(true), 2.5, tube).quad([x - TILE / 2, y, z - TILE], [x + TILE / 2, y, z - TILE], [x + TILE / 2, y, z + TILE], [x - TILE / 2, y, z + TILE], [1, 1, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    if (light === true) c.light(x, H - 0.14, z, tube.map((v) => v * 1.05 * c.room.light.power * Math.pow(hd, 1.5)), 1, { axis: [0, -1, 0], floor: 0.24, k: 3.4 * hd, far: 14 * hd });
    else if (light) c.light(x, H - 0.14, z, tube, light.power, { axis: [0, -1, 0], floor: light.floor ?? 0.24, k: light.k, far: light.far });
  };
  const a = await oneRoom(t, byHand(), { H }), b = await oneRoom(t, (c) => { c.shell({ panels: false }); c.fitting(x, z); }, { H });
  assert.deepEqual(room(b), room(a));
  assert.equal(b.rt.lights.length, 1);
  // its own height (a room without the shell's ceiling): the same, at that height
  const y = await oneRoom(t, (c) => { c.shell({ panels: false, ceiling: false }); c.fitting(x, z, { y: H }); }, { H: 2.6 });
  const yHand = await oneRoom(t, (c) => { c.shell({ panels: false, ceiling: false }); const tube = lin(c.look.tube), hd = head(H);
    c.shining('panel', c.kit.tex.panel(true), 2.5, tube).quad([x - TILE / 2, H - 0.006, z - TILE], [x + TILE / 2, H - 0.006, z - TILE], [x + TILE / 2, H - 0.006, z + TILE], [x - TILE / 2, H - 0.006, z + TILE], [1, 1, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    c.light(x, H - 0.14, z, tube.map((v) => v * 1.05 * c.room.light.power * Math.pow(hd, 1.5)), 1, { axis: [0, -1, 0], floor: 0.24, k: 3.4 * hd, far: 14 * hd }); }, { H: 2.6 });
  assert.deepEqual(room(y), room(yHand));
  // no lamp, for a room that lights itself; a lamp of its own, as c.light's; a tube of its own colour, in a batch of its own
  const none = await oneRoom(t, (c) => { c.shell({ panels: false }); c.fitting(x, z, { light: false }); }, { H });
  assert.deepEqual(room(none), room(await oneRoom(t, byHand(false), { H })));
  const L = { power: 0.7, k: 2.2, far: 6, floor: 0.3 };
  const mine = await oneRoom(t, (c) => { c.shell({ panels: false }); c.fitting(x, z, { light: L }); }, { H });
  assert.deepEqual(room(mine), room(await oneRoom(t, byHand(L), { H })));
  const pink = await oneRoom(t, (c) => { c.shell({ panels: false }); c.fitting(x, z, { tube: '#ffd0e0', light: false }); }, { H });
  assert.deepEqual(room(pink).meshes, room(await oneRoom(t, byHand(false, '#ffd0e0'), { H })).meshes);
  assert.equal(pink.rt.panelMesh, undefined, 'not the shell\'s batch: the dimmer does not reach it');
});

test('a quarter turn lays it along x: the flat panel 1.2 m across x, the fitting turned with it', async (t) => {
  const along = (rt) => { const p = rt.panelMesh.geometry.attributes.position; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < p.count; i++) { x0 = Math.min(x0, p.getX(i)); x1 = Math.max(x1, p.getX(i)); z0 = Math.min(z0, p.getZ(i)); z1 = Math.max(z1, p.getZ(i)); } return [x1 - x0, z1 - z0].map((v) => Number(v.toFixed(4))); };
  const plain = await oneRoom(t, (c) => { c.shell({ panels: false }); c.fitting(0.3, 0); });
  assert.deepEqual(along(plain.rt), [0.6, 1.2]);
  for (const rot of [Math.PI / 2, -Math.PI / 2, 3 * Math.PI / 2, 1.5]) {
    const turned = await oneRoom(t, (c) => { c.shell({ panels: false }); c.fitting(0.3, 0, { rot }); });
    assert.deepEqual(along(turned.rt), [1.2, 0.6], `rot ${rot}`);
    assert.deepEqual(turned.rt.lights, plain.rt.lights, 'the lamp is where it was');
  }
  const half = await oneRoom(t, (c) => { c.shell({ panels: false }); c.fitting(0.3, 0, { rot: Math.PI }); });
  assert.deepEqual(along(half.rt), [0.6, 1.2], 'a half turn is no turn');
  for (const gfx of [MEDIUM, HIGH]) {
    const [flat, turned] = [await oneRoom(t, (c) => { c.shell({ panels: false }); c.fitting(0.3, 0); }, { gfx }), await oneRoom(t, (c) => { c.shell({ panels: false }); c.fitting(0.3, 0, { rot: Math.PI / 2 }); }, { gfx })];
    const [fx, fz] = along(flat.rt), [tx, tz] = along(turned.rt);
    assert.ok(fz > 1.5 * fx && tx > 1.5 * tz && Math.abs(fz - tx) < 1e-4 && Math.abs(fx - tz) < 1e-4, 'the tubes and pan run along z, and turned along x');
    assert.deepEqual(turned.rt.lights, flat.rt.lights);
  }
});

// one lit light's tubes and pan, as the world meshes them: what the shell's fitting puts into the batch the flat panel was in
const TUBES = meshVox(lightVox().tubes, { ao: false }).solid, PAN = panOf(meshVox(lightVox().housing, { ao: false }).solid);
const GLOW_VERTS = TUBES.attributes.position.count + PAN.inside.attributes.position.count;

test('medium and high: the shell\'s own fitting, mounted on the ceiling\'s face: the same parts and batches, 10 cm lower', async (t) => {
  for (const gfx of [MEDIUM, HIGH]) {
    // the shell's, let into its opening, and the room's own at the same place
    const shell = await oneRoom(t, (c) => c.shell(), { gfx, panels: SPOTS });
    const own = await oneRoom(t, (c) => { c.shell({ panels: false }); for (const p of SPOTS) c.fitting(p.x, p.z, { dead: p.state === 'dead', flick: p.state === 'flicker' }); }, { gfx, panels: SPOTS });
    assert.deepEqual(own.rt.lights, shell.rt.lights, 'the same lamps, to the bit');
    assert.equal(own.rt.flickers.length, 1); assert.equal(vertsOf(own.rt.flickers[0]), GLOW_VERTS);
    assert.equal(vertsOf(own.rt.panelMesh), 2 * GLOW_VERTS, 'the two lit lights\' tubes and pans shine in the shell\'s batch');
    const [a, b] = [vox(shell.rt), vox(own.rt)];
    // the housing (with the dead light's grey tubes) and the louvre: a mesh each, the louvre detail; vertex for vertex the shell's, CEILING.deep lower
    assert.deepEqual(b.map((m) => [!!m.userData.detail, m.geometry.attributes.position.count, m.geometry.index.count]), a.map((m) => [!!m.userData.detail, m.geometry.attributes.position.count, m.geometry.index.count]));
    assert.equal(b.filter((m) => m.userData.detail).length, 1);
    for (const [m, n] of [[b[0], a[0]], [b[1], a[1]], [own.rt.panelMesh, shell.rt.panelMesh], [own.rt.flickers[0], shell.rt.flickers[0]]]) {
      const p = m.geometry.attributes.position, q = n.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        assert.ok(p.getX(i) === q.getX(i) && p.getZ(i) === q.getZ(i));
        assert.ok(Math.abs(q.getY(i) - p.getY(i) - CEILING.deep) < 1e-5, 'mounted under the sheet, not let into it');
      }
      assert.deepEqual([...m.geometry.index.array], [...n.geometry.index.array]);
      if (m.geometry.attributes.uv) assert.deepEqual([...m.geometry.attributes.uv.array], [...n.geometry.attributes.uv.array], 'at the same spots of the panel\'s texture');
    }
    // the sheet is left whole (the room's own is under it): the shell's room less its four openings of two tiles each
    const tri = (rt) => meshes(rt).reduce((n, m) => n + m.geometry.index.count / 3, 0);
    assert.equal(tri(own.rt), tri(shell.rt) + 4 * 4);
  }
});
const vertsOf = (m) => m?.geometry.attributes.position.count || 0;

test('dead, flicker, banks: as the shell\'s lights, at classic and medium', async (t) => {
  for (const gfx of [CLASSIC, MEDIUM]) {
    const dead = await oneRoom(t, (c) => { c.shell({ panels: false }); c.fitting(0.3, 0, { dead: true }); }, { gfx });
    assert.equal(dead.rt.lights.length, 0, 'out: no lamp');
    assert.equal(dead.rt.panelMesh, undefined, 'nothing shines');
    const flick = await oneRoom(t, (c) => { c.shell({ panels: false }); c.fitting(0.3, 0, { flick: true }); }, { gfx });
    assert.equal(flick.rt.flickers.length, 1); assert.equal(flick.rt.lights[0].flick, true);
    // under the lighting banks: its bank's batch and its lamp in that bank (the shell's for that spot unless it says)
    for (const bank of [undefined, 0, 1]) {
      const r = await oneRoom(t, (c) => { c.shell({ panels: false }); c.fitting(0.3, -2.4, bank === undefined ? {} : { bank }); c.fitting(0.3, 2.4, { flick: true, ...(bank === undefined ? {} : { bank }) }); }, { gfx, lighting: 'failing', panels: [{ x: 0.3, z: -2.4, state: 'on' }, { x: 0.3, z: 2.4, state: 'flicker' }] });
      const s = await oneRoom(t, (c) => c.shell(), { gfx, lighting: 'failing', panels: [{ x: 0.3, z: -2.4, state: 'on' }, { x: 0.3, z: 2.4, state: 'flicker' }] });
      if (bank === undefined) assert.deepEqual(r.rt.lights, s.rt.lights, 'the shell\'s banks');
      else assert.deepEqual(r.rt.lights.map((L) => L.bank), [bank, bank]);
      assert.equal(r.rt.flickers.length, 0, 'under banks nothing flickers by itself, as the shell\'s');
      assert.deepEqual(r.rt.lights.map((L) => L.flick), [false, false]);
      assert.deepEqual(r.rt.bankPanels.map((m) => m.userData.bank).sort(), [...new Set(r.rt.lights.map((L) => L.bank))].sort());
    }
  }
});

test(`its lamps are kept within ${SHINING_LIGHTS.cap}, as a shining batch keeps its own; light: false leaves some out`, async (t) => {
  const grid = (opt = () => ({})) => (c) => { c.shell({ panels: false }); let k = 0; for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++, k++) c.fitting(-3 + i * 1.5, -2.7 + j * 1.8, opt(k)); };
  const all = await oneRoom(t, grid());
  assert.equal(all.rt.lights.length, SHINING_LIGHTS.cap, 'twenty fittings, sixteen lamps');
  const one = all.rt.lights[0].r * 0 + (await oneRoom(t, grid((k) => (k ? { light: false } : {})))).rt.lights[0].r;
  assert.ok(Math.abs(all.rt.lights.reduce((s, L) => s + L.r, 0) - 20 * one) < 1e-9, 'the light is merged, not lost');
  const some = await oneRoom(t, grid((k) => (k % 2 ? { light: false } : {})));
  assert.equal(some.rt.lights.length, 10);
  assert.equal(vertsOf(some.rt.panelMesh), 20 * 4, 'every one of them still shines');
});

test('it reads nothing of the room\'s seeded stream and nothing random, and adds nothing standing', async (t) => {
  // (three.js names what it makes with Math.random: so the fittings are placed under two different ones, and come out the same)
  const under = (k, fn) => { const random = Math.random; Math.random = () => k; try { fn(); } finally { Math.random = random; } };
  for (const gfx of [CLASSIC, MEDIUM]) {
    const after = [], seen = [];
    for (const k of [0.1, 0.9]) {
      const r = await oneRoom(t, (c) => { c.shell({ panels: false }); under(k, () => { for (const p of SPOTS) c.fitting(p.x, p.z, { dead: p.state === 'dead', flick: p.state === 'flicker', rot: p.x > 0 ? Math.PI / 2 : 0 }); }); after.push(c.R()); }, { gfx, panels: SPOTS });
      seen.push(room(r));
    }
    assert.deepEqual(seen[0], seen[1], 'nothing random');
    const without = [];
    await oneRoom(t, (c) => { c.shell({ panels: false }); without.push(c.R()); }, { gfx, panels: SPOTS });
    assert.deepEqual(after, [without[0], without[0]], 'the room\'s seeded stream is where it would have been');
  }
  const g = { ...MEDIUM };
  const a = await oneRoom(t, (c) => { c.shell({ panels: false }); for (const p of SPOTS) c.fitting(p.x, p.z); }, { gfx: g }), b = await oneRoom(t, (c) => c.shell({ panels: false }), { gfx: g });
  assert.deepEqual(a.rt.shadowBoxes, b.rt.shadowBoxes, 'nothing of a fitting is gathered as standing');
  assert.deepEqual(a.rt.colliders, b.rt.colliders);
});

// The waterpark's natatoriumLight() (waterpark.js) places its lights with c.fitting. Its body before, kept here as the
// reference: the shell's panel by hand in 'panel', a lamp of its own to every `every`-th, twelve at most.
function natatoriumBefore(c, cols = 3, rows = 3, every = 1, power = 1.05) {
  const { W, D, H, kit } = c;
  const tube = lin(c.look.tube || '#e8fbff');
  const on = c.shining('panel', kit.tex.panel(true), 2.5, tube);
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const head = Math.min(2.5, Math.max(0.4, H / 2.6));
  let count = 0;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = (Math.round((-W / 2 + (i + 0.5) * W / cols) / TILE - 0.5) + 0.5) * TILE;
      const z = Math.round((-D / 2 + (j + 0.5) * D / rows) / TILE) * TILE;
      const y = H - 0.006;
      on.quad([x - TILE / 2, y, z - TILE], [x + TILE / 2, y, z - TILE], [x + TILE / 2, y, z + TILE], [x - TILE / 2, y, z + TILE], [1, 1, 1], uv);
      if ((i + j * 2) % every === 0 && count < 12) {
        c.light(x, H - 0.14, z, tube, power * Math.pow(head, 1.45), { axis: [0, -1, 0], floor: 0.28, k: 3.6 * head, far: 15 * head });
        count++;
      }
    }
  }
}

test('the waterpark\'s natatoriumLight: every room that calls it is, at classic and low, what it was to the byte; at medium and high fitted', async (t) => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { natatoriumLight } = await import(new URL('waterpark.js', B).href);
  // the rooms that call it, and how (read from their own files, so a new one is not missed)
  const calls = [];
  for (const f of readdirSync(new URL('rooms/', B)).filter((n) => n.endsWith('.js')).sort()) {
    const m = /natatoriumLight\(c(?:,\s*([^)]*))?\)/.exec(readFileSync(new URL(`rooms/${f}`, B), 'utf8'));
    if (m) calls.push({ arch: f.slice(0, -3), args: (m[1] || '').split(',').filter((s) => s.trim()).map(Number) });
  }
  assert.deepEqual(calls.map((r) => r.arch), ['deep-end', 'kiddie-lagoon', 'lazy-river', 'wave-pool', 'whirlpool-flume']);
  const dealt = (arch) => { for (let seed = 1; seed < 40; seed++) { const lv = generate(seed, { theme: 'waterpark', only: [arch] }), d = lv.rooms.find((r) => r.arch === arch); if (d) return { lv, d }; } return null; };
  const build = async (lv, d, fn, { gfx, lighting }) => {
    const kit = gfx ? createKit({ gfx }) : createKit();
    const def = { ...d, id: 0, x: 0, z: 0, y: 0, rot: 0, doors: [], wins: [] };
    const world = await buildWorld(kit, { ...lv, rooms: [def], links: [], windows: [] }, { catalogue: catalogueOf(kit), barricadesEnabled: false, lighting,
      builders: { [d.arch]: (c) => { c.shell({ panels: false }); fn(c); c.crate(0.4, 0, 1, 1, 1); } } });
    t.after(() => { world.dispose(); kit.dispose(); });
    return { world, kit, rt: world.rooms[0] };
  };
  for (const { arch, args } of calls) {
    const got = dealt(arch); assert.ok(got, `${arch} is dealt on a waterpark floor`);
    const { lv, d } = got;
    assert.ok(typeof d.look.tube === 'string', `${arch}: its look has a tube colour (else the helper's own and c.fitting's default would differ)`);
    for (const gfx of [CLASSIC, LOW]) for (const lighting of [false, 'failing']) {
      const was = await build(lv, d, (c) => natatoriumBefore(c, ...args), { gfx, lighting }), now = await build(lv, d, (c) => natatoriumLight(c, ...args), { gfx, lighting });
      // (a room that is not a plain one is never given lighting banks: lighting.js planLighting)
      assert.equal(now.rt.lighting, null);
      assert.deepEqual(room(now), room(was), `${arch} ${JSON.stringify(args)} at ${gfx ? 'low' : 'classic'}, lighting ${lighting}`);
      assert.equal(now.rt.lights.length, Math.min(12, Array.from({ length: (args[0] ?? 3) * (args[1] ?? 3) }, (_, k) => k).filter((k) => (Math.floor(k / (args[1] ?? 3)) + (k % (args[1] ?? 3)) * 2) % (args[2] ?? 1) === 0).length));
    }
    // medium and high: the same lamps, and the fitting in place of every panel (one housing and one louvre mesh)
    for (const gfx of [MEDIUM, HIGH]) {
      const was = await build(lv, d, (c) => natatoriumBefore(c, ...args), { gfx, lighting: false }), now = await build(lv, d, (c) => natatoriumLight(c, ...args), { gfx, lighting: false });
      assert.deepEqual(now.rt.lights, was.rt.lights, `${arch}: the same lamps`);
      const n = (args[0] ?? 3) * (args[1] ?? 3);
      assert.equal(vertsOf(now.rt.panelMesh), n * GLOW_VERTS, `${arch}: every panel is a fitting`);
      assert.equal(vox(now.rt).filter((m) => m.userData.detail).length, 1);
    }
  }
});
