import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// A shop window lit from inside, in one room (BACKROOMS-GRAPHICS.md "Light through a shop window"): a wall of boxes
// in the room's own batches with an opening, a pane in the opening, a lamp on the shop's side. At Medium and High the
// room's light map (world.js shadowRoom, shadowmap.js bakeShadows) already lets that lamp's light through the opening
// and keeps it off the floor beside it, behind the wall, because the wall's boxes stand in the room and cast and the
// glass does not: a pane drawn into c.glass (or as a flat quad) is no caster, a pane drawn as a box into c.flat is one.
// Nothing new is called for; this pins what a room relies on. Uses the real kit and world; canvas drawing is inert.
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
const [{ buildWorld }, { createKit }, { generate }, { sampleMap }, { profile }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href),
  import(new URL('shadowmap.js', B).href), import(new URL('graphics.js', B).href)]);

const catalogue = { has: () => false, entry: () => null, geo: () => null };
const gfxOf = (tier) => { const p = profile(tier); return { contact: p.contact, bounce: p.bounce, shadows: p.shadows, doorlight: p.doorlight, fixtures: p.fixtures }; };
const level0 = generate(7, { count: 0 });
// the shop: in the first plain room big enough (and tall enough), a wall across it at x = X (shop beyond, at +x), an opening in it
const TARGET = level0.rooms.find((r) => r.kind === 'plain' && r.W >= 4.5 && r.D >= 3.5 && r.H >= 2.5 && !r.shape)?.id;
const OPEN = { z0: -0.7, z1: 0.7, y0: 0.6, y1: 1.6 }, T = 0.12, LAMP = { dx: 1.2, y: 2.2 };

/** pane: 'none' (an open hole) · 'glass' (c.glass.box) · 'quad' (a flat quad in c.flat) · 'box' (a box in c.flat). */
const shopIn = (pane) => (c) => {
  if (c.room.id !== TARGET) { c.shell(); return; }
  c.shell({ panels: false });                                                     // (the shop's lamp the only one: clean numbers)
  const { D, H, W } = c, X = W / 2 - 1.8, wall = [0.55, 0.5, 0.42], { z0, z1, y0, y1 } = OPEN;
  c.flat.box(X, 0, -D / 2, X + T, y0, D / 2, wall); c.flat.box(X, y1, -D / 2, X + T, H, D / 2, wall);
  c.flat.box(X, y0, -D / 2, X + T, y1, z0, wall); c.flat.box(X, y0, z1, X + T, y1, D / 2, wall);
  const g = X + T / 2;
  if (pane === 'glass') c.glass.box(g - 0.01, y0, z0, g + 0.01, y1, z1, [0.75, 0.85, 0.85]);
  if (pane === 'quad') c.flat.quad([g, y0, z1], [g, y0, z0], [g, y1, z0], [g, y1, z1], [0.75, 0.85, 0.85]);
  if (pane === 'box') c.flat.box(g - 0.01, y0, z0, g + 0.01, y1, z1, [0.5, 0.6, 0.62]);
  c.light(X + LAMP.dx, LAMP.y, 0, '#ffd9a0', 1.6, { k: 2.2, far: 9 });
};

async function build(t, tier, pane) {
  const level = generate(7, { count: 0 }), gfx = gfxOf(tier), kit = createKit({ gfx });
  const world = await buildWorld(kit, level, { catalogue, barricadesEnabled: false, builders: { plain: shopIn(pane) } });
  t.after(() => { world.dispose(); kit.dispose(); });
  return { world, rt: world.rooms[TARGET] };
}
/** The steady lamps' share that arrives on the floor at (x, z) (1: nothing hides it). */
const arrives = (rt, x, z) => sampleMap(rt.lm.layout, rt.lm.A.data, rt.lm.A.channels, rt.def.W, rt.def.D, x, 0, z)[0];
/** A floor point on the far side of the wall, along the line from the lamp through (y, z) of the wall's plane. */
const through = (rt, y, z) => {
  const X = rt.def.W / 2 - 1.8, L = [X + LAMP.dx, LAMP.y, 0], t = L[1] / (L[1] - y);          // (the lamp to the wall's plane at (y, z), on to the floor)
  return [L[0] + (X - L[0]) * t, L[2] + (z - L[2]) * t];
};
const bytesOf = (rt) => Buffer.from(rt.lm.A.data).toString('base64');

test('the test room is there and big enough for the shop', () => {
  assert.ok(Number.isInteger(TARGET), 'a plain room of 4.5 × 3.5 m or more on seed 7');
  const r = level0.rooms[TARGET];
  for (const [x, z] of [[0, 0], [0, 0.6], [0, -0.6]]) assert.ok(Math.abs(x) < r.W / 2 && Math.abs(z) < r.D / 2);
});

test('Medium and High: the lamp behind the wall lights the floor through the opening, not through the wall beside it', async (t) => {
  for (const tier of ['medium', 'high']) {
    const { rt } = await build(t, tier, 'glass');
    assert.ok(rt.lm?.A, `${tier}: the room has its light map`);
    const { y0, y1, z1 } = OPEN, ym = (y0 + y1) / 2;
    // through the middle of the pane: nothing in the way
    for (const z of [0, 0.3, -0.3]) { const [x, zz] = through(rt, ym, z); assert.ok(arrives(rt, x, zz) > 0.95, `${tier}: through the glass at z ${z} (${arrives(rt, x, zz)})`); }
    // through the wall beside the opening (well clear of its edge, so no soft edge reaches it): shadowed
    for (const z of [z1 + 0.35, -(z1 + 0.35)]) { const [x, zz] = through(rt, y0 + 0.2, z); assert.ok(arrives(rt, x, zz) < 0.5, `${tier}: through the wall at z ${z} (${arrives(rt, x, zz)})`); }
    // and under the sill (the wall below the opening)
    { const [x, zz] = through(rt, y0 - 0.3, 0); assert.ok(arrives(rt, x, zz) < 0.5, `${tier}: through the wall under the sill (${arrives(rt, x, zz)})`); }
  }
});

test('glass passes light: a pane in c.glass or as a flat quad is no caster, a box in c.flat is one', async (t) => {
  const none = await build(t, 'medium', 'none'), glass = await build(t, 'medium', 'glass'), quad = await build(t, 'medium', 'quad'), box = await build(t, 'medium', 'box');
  // the open hole, the glass box and the quad leave the same map, to the byte, and stand the same boxes in the room
  assert.equal(bytesOf(glass.rt), bytesOf(none.rt));
  assert.equal(bytesOf(quad.rt), bytesOf(none.rt));
  assert.deepEqual(glass.rt.shadowBoxes, none.rt.shadowBoxes);
  assert.deepEqual(quad.rt.shadowBoxes, none.rt.shadowBoxes);
  // the pane drawn as a box in the room's own batch stands in the room, and the light through it is gone
  assert.equal(box.rt.shadowBoxes.length, none.rt.shadowBoxes.length + 1);
  const [x, z] = through(box.rt, (OPEN.y0 + OPEN.y1) / 2, 0);
  assert.ok(arrives(glass.rt, x, z) > 0.95 && arrives(box.rt, x, z) < 0.5, `a box for a pane blocks (${arrives(glass.rt, x, z)} → ${arrives(box.rt, x, z)})`);
});

test('Classic and Low: no light map, and the pane changes nothing of it', async (t) => {
  for (const tier of ['classic', 'low']) for (const pane of ['none', 'glass']) {
    const { world, rt } = await build(t, tier, pane);
    assert.equal(rt.lm, undefined, `${tier} ${pane}`); assert.equal(rt.shadowStats, undefined); assert.equal(rt.doorLight, undefined);
    rt.group.traverse((o) => { if (o.isMesh && o.material?.defines) for (const d of ['LIGHTMAP', 'TUBESHADOW', 'DOORLIGHT']) assert.equal(o.material.defines[d], undefined); });
    void world;
  }
});

test('deterministic: the same shop bakes the same map twice', async (t) => {
  const a = await build(t, 'medium', 'glass'), b = await build(t, 'medium', 'glass');
  assert.equal(bytesOf(a.rt), bytesOf(b.rt));
});
