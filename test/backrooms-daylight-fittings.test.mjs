import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createHash } from 'node:crypto';

// (harness as test/backrooms-room-fittings.test.mjs)
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

const { daylight } = await import(new URL('suburb.js', B).href);

/** daylight() as it was before it placed the shell's own fittings: a panel quad and a lamp by hand. */
function daylightByHand(c, cols, rows, every = 1, power = 1) {
  const { W, D, H, kit } = c, tube = lin(c.look.tube), on = c.shining('panel', kit.tex.panel(true), 2.5, tube), uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const hd = Math.max(0.3, Math.min(2.5, H / 2.6));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = (Math.round((-W / 2 + (i + 0.5) * W / cols) / TILE - 0.5) + 0.5) * TILE, z = Math.round((-D / 2 + (j + 0.5) * D / rows) / TILE) * TILE, y = H - 0.006;
    on.quad([x - TILE / 2, y, z - TILE], [x + TILE / 2, y, z - TILE], [x + TILE / 2, y, z + TILE], [x - TILE / 2, y, z + TILE], [1, 1, 1], uv);
    if ((i + j * 2) % every === 0) c.light(x, H - 0.14, z, tube, 1.05 * power * Math.pow(hd, 1.5), { axis: [0, -1, 0], floor: 0.24, k: 3.4 * hd, far: 14 * hd });
  }
}

test('the neighbourhood\'s daylight(): the shell\'s own fittings now, and at Classic and Low the same room to the byte as the panels and lamps it drew by hand', async (t) => {
  for (const gfx of [CLASSIC, LOW]) for (const [cols, rows, every, power, H] of [[3, 3, 1, 1, 2.6], [4, 2, 1, 1, 3.4], [2, 3, 2, 0.8, 2.9]]) {
    const before = await oneRoom(t, (c) => { c.shell({ panels: false }); daylightByHand(c, cols, rows, every, power); }, { gfx, H });
    const after = await oneRoom(t, (c) => { c.shell({ panels: false }); daylight(c, cols, rows, every, power); }, { gfx, H });
    assert.deepEqual(room(after), room(before), `gfx ${JSON.stringify(gfx)}, ${cols}×${rows} every ${every} power ${power} H ${H}`);
  }
});

test('at Medium and High daylight() hangs the sculpted fittings, and lights the room as before', async (t) => {
  for (const gfx of [MEDIUM, HIGH]) {
    const before = await oneRoom(t, (c) => { c.shell({ panels: false }); daylightByHand(c, 3, 3); }, { gfx, H: 2.9 });
    const after = await oneRoom(t, (c) => { c.shell({ panels: false }); daylight(c, 3, 3); }, { gfx, H: 2.9 });
    assert.ok(vox(after.rt).length > vox(before.rt).length, 'the fittings are models');
    assert.deepEqual(after.rt.lights.map((L) => ({ ...L })), before.rt.lights.map((L) => ({ ...L })), 'the same lamps');
  }
});
