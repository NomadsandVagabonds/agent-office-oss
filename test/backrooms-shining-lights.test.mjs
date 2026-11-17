import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// A shining batch that lights what is near it (world.js c.shining(…, { lights }), shining-lights.rule.js): opt-in, and
// its lamps are ordinary lamps. Uses the real kit, world and shadow map; only canvas drawing is inert, no WebGL.
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
const [{ buildWorld }, { createKit, lin }, { generate }, makers, { SHINING_LIGHTS, lampSpots }, { groupOf }, { profile }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href),
  import(new URL('public/world/props/office.js', root).href), import(new URL('shining-lights.rule.js', B).href),
  import(new URL('shadowmap.js', B).href), import(new URL('graphics.js', B).href)]);
const catalogueOf = (kit) => ({ has: (type) => typeof makers[type] === 'function', entry: () => null, geo: (type) => (makers[type] ? kit.model(type, makers[type]) : null) });

const MEDIUM = (() => { const p = profile('medium'); return { contact: p.contact, bounce: p.bounce, shadows: p.shadows, doorlight: p.doorlight, fixtures: p.fixtures }; })();
const NEON = lin('#ff3fa8');

/** One 8 m room, two ceiling panels, a crate; `add(c)` does the rest. */
async function oneRoom(t, add, { gfx = null, barricades = false, lighting = false } = {}) {
  const level = generate(7, { count: 0 }), src = level.rooms.find((r) => r.kind === 'plain' && r.panels.length >= 2);
  const def = { ...src, id: 0, x: 0, z: 0, w: 8, d: 8, W: 8, D: 8, H: 2.6, cx: 4, cz: 4, y: 0, rot: 0, doors: [], wins: [], shape: null,
    panels: [{ x: -2, z: -2, state: 'on' }, { x: 2, z: 2, state: 'on' }] };
  const kit = gfx ? createKit({ gfx }) : createKit();
  const world = await buildWorld(kit, { ...level, rooms: [def], links: [], windows: [] }, { catalogue: catalogueOf(kit), barricadesEnabled: barricades, lighting, builders: { plain: (c) => {
    c.shell();
    c.crate(1, 0, 1, 1, 1);
    add(c);
  } } });
  t.after(() => { world.dispose(); kit.dispose(); });
  return { world, rt: world.rooms[0] };
}
/** The room's baked light (every attribute of every mesh) and its light map, hashed bit for bit. */
function fingerprint(rt) {
  let sum = 0, hash = 0;
  const mix = (arr) => { for (const x of new Uint32Array(arr.buffer, arr.byteOffset, arr.byteLength >> 2)) hash = (Math.imul(hash, 31) + x) >>> 0; };
  rt.group.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (const key of ['aLit', 'aFlk', 'aBank0', 'aBank1', 'aBank2', 'aBank3']) {
      const a = o.geometry.attributes[key]; if (!a) continue;
      if (key === 'aLit') for (const v of a.array) sum += v;
      mix(a.array);
    }
  });
  for (const k of ['A', 'B']) if (rt.lm?.[k]?.data) { const d = rt.lm[k].data; mix(new Uint8Array(d.buffer, d.byteOffset, d.byteLength & ~3)); }
  return [Number(sum.toFixed(6)), hash];
}
const lamps = (rt) => rt.lights.map((L) => ({ ...L }));
const tex = (c) => c.kit.tex.white();

test('off: without lights nothing of it runs; the room and its lamps are as they were', async (t) => {
  for (const gfx of [null, MEDIUM]) {
    const none = await oneRoom(t, () => {}, { gfx });
    const plain = await oneRoom(t, (c) => c.shining('neon', tex(c), 2, NEON).box(-3.9, 1.6, -0.6, -3.86, 1.64, 0.6), { gfx });
    for (const opt of [{}, { lights: null }, { lights: false }, { bloom: 2 }]) {
      const r = await oneRoom(t, (c) => c.shining('neon', tex(c), 2, NEON, opt).box(-3.9, 1.6, -0.6, -3.86, 1.64, 0.6), { gfx });
      assert.deepEqual(lamps(r.rt), lamps(none.rt));
      assert.deepEqual(fingerprint(r.rt), fingerprint(plain.rt));
    }
    assert.deepEqual(lamps(plain.rt), lamps(none.rt));
  }
});

test('one box: the same baked light as c.light at its middle with the same options, at every tier, with barricades and banks', async (t) => {
  const L = { power: 0.8, k: 1.5, far: 5 };
  for (const [gfx, barricades, lighting] of [[null, false, false], [null, true, false], [MEDIUM, false, false], [MEDIUM, true, 'dim'], [{ contact: 0.7 }, false, false]]) {
    for (const extra of [{}, { flick: true }, { bank: 1 }, { axis: [1, 0, 0], floor: 0.3, wrap: 0.5 }]) {
      const opt = { ...L, ...extra };
      const a = await oneRoom(t, (c) => c.shining('neon', tex(c), 2, NEON, { lights: opt }).box(-3.9, 1.0, -0.2, -3.86, 1.3, 0.2), { gfx, barricades, lighting });
      const b = await oneRoom(t, (c) => {
        c.shining('neon', tex(c), 2, NEON).box(-3.9, 1.0, -0.2, -3.86, 1.3, 0.2);
        const { power, ...rest } = opt;
        c.light((-3.9 + -3.86) / 2, (1.0 + 1.3) / 2, 0, NEON, power, rest);
      }, { gfx, barricades, lighting });
      assert.equal(a.rt.lights.length, 3, 'two panels and one lamp');
      assert.deepEqual(lamps(a.rt), lamps(b.rt));
      assert.deepEqual(fingerprint(a.rt), fingerprint(b.rt), `gfx ${JSON.stringify(gfx)} barricades ${barricades} lighting ${lighting} ${JSON.stringify(extra)}`);
      const mine = a.rt.lights[2], hand = b.rt.lights[2];
      assert.equal(groupOf(mine, a.rt.lighting), groupOf(hand, b.rt.lighting));
    }
  }
  // color: a hex or an rgb of its own instead of the batch's
  const a = await oneRoom(t, (c) => c.shining('exit', tex(c), 1.9, undefined, { lights: { power: 0.3, color: '#58e08c', k: 0.9, far: 4, offset: [0.2, 0, 0] } }).box(-3.98, 2.0, -0.2, -3.96, 2.12, 0.2));
  const b = await oneRoom(t, (c) => { c.shining('exit', tex(c), 1.9).box(-3.98, 2.0, -0.2, -3.96, 2.12, 0.2); c.light((-3.98 + -3.96) / 2 + 0.2, (2.0 + 2.12) / 2, 0, '#58e08c', 0.3, { k: 0.9, far: 4 }); });
  assert.deepEqual(lamps(a.rt), lamps(b.rt));
  assert.deepEqual(fingerprint(a.rt), fingerprint(b.rt));
});

test('a long thin tube lights as a line: two or three lamps along it, the power shared', async (t) => {
  assert.deepEqual(lampSpots(0, 0, 0, 0.6, 0.6, 0.02), [[0.3, 0.3, 0.01]]);                  // a panel: one
  assert.deepEqual(lampSpots(0, 0, 0, 0.8, 0.04, 0.04), [[0.4, 0.02, 0.02]]);                // short: one
  assert.deepEqual(lampSpots(0, 0, 0, 1.2, 0.5, 0.5), [[0.6, 0.25, 0.25]]);                  // long but not thin: one
  const r6 = (v) => Number(v.toFixed(6));
  assert.deepEqual(lampSpots(0, 2, -0.6, 0.04, 2.04, 0.6).map((p) => r6(p[2])), [-0.3, 0.3]);    // 1.2 m along z: two
  assert.deepEqual(lampSpots(-1.2, 2, 0, 1.2, 2.04, 0.04).map((p) => r6(p[0])), [-0.8, 0, 0.8]); // 2.4 m along x: three
  const a = await oneRoom(t, (c) => c.shining('tube', tex(c), 2.5, NEON, { lights: { power: 1.2, k: 2, far: 6 } }).box(-1.2, 2.5, 0, 1.2, 2.54, 0.04));
  const b = await oneRoom(t, (c) => { c.shining('tube', tex(c), 2.5, NEON).box(-1.2, 2.5, 0, 1.2, 2.54, 0.04); for (const x of [-0.8, 0, 0.8]) c.light(x, 2.52, 0.02, NEON, 1.2 / 3, { k: 2, far: 6 }); });
  assert.equal(a.rt.lights.length, 5);
  for (let i = 2; i < 5; i++) for (const k of ['x', 'y', 'z', 'r', 'g', 'b']) assert.ok(Math.abs(a.rt.lights[i][k] - b.rt.lights[i][k]) < 1e-12, k);
  assert.ok(Math.abs(a.rt.lights.slice(2).reduce((s, L) => s + L.r, 0) - NEON[0] * 1.2) < 1e-12, 'the power is shared, not multiplied');
});

test(`the cap: at most ${SHINING_LIGHTS.cap} lamps a batch, the nearest merged, the power kept`, async (t) => {
  const row = (c, opt) => { const b = c.shining('row', tex(c), 2, NEON, opt); for (let i = 0; i < 30; i++) b.box(-3.6 + i * 0.24, 2.5, -1, -3.5 + i * 0.24, 2.54, -0.9); };
  const a = await oneRoom(t, (c) => row(c, { lights: { power: 0.1 } }));
  const own = a.rt.lights.slice(2);
  assert.equal(own.length, SHINING_LIGHTS.cap);
  assert.ok(Math.abs(own.reduce((s, L) => s + L.g, 0) - 30 * 0.1 * NEON[1]) < 1e-9);
  const xs = own.map((L) => L.x);
  assert.deepEqual(xs, [...xs].sort((p, q) => p - q), 'merged in place: still in order along the row');
  assert.ok(xs[0] >= -3.6 && xs.at(-1) <= -3.5 + 29 * 0.24);
  const lower = await oneRoom(t, (c) => row(c, { lights: { power: 0.1, cap: 4 } }));
  assert.equal(lower.rt.lights.length, 2 + 4);
  const higher = await oneRoom(t, (c) => row(c, { lights: { power: 0.1, cap: 99 } }));
  assert.equal(higher.rt.lights.length, 2 + SHINING_LIGHTS.cap, 'the cap cannot be raised');
  // under the cap, one lamp a box, in the order they were added
  const ten = await oneRoom(t, (c) => { const b = c.shining('row', tex(c), 2, NEON, { lights: { power: 0.1 } }); for (let i = 0; i < 10; i++) b.box(-3.6 + i * 0.5, 2.5, -1, -3.5 + i * 0.5, 2.54, -0.9); });
  assert.deepEqual(ten.rt.lights.slice(2).map((L) => Number(L.x.toFixed(6))), Array.from({ length: 10 }, (_, i) => Number((-3.55 + i * 0.5).toFixed(6))));
});

test('every adder counts once (a box is one piece, not its six faces); a key keeps the lights of its first call', async (t) => {
  const a = await oneRoom(t, (c) => {
    const b = c.shining('mix', tex(c), 2, NEON, { lights: { power: 0.2 } });
    b.quad([0, 2, 0], [0.2, 2, 0], [0.2, 2.2, 0], [0, 2.2, 0]);
    b.tri([1, 2, 0], [1.2, 2, 0], [1.1, 2.2, 0]);
    b.ball(-1, 1.5, 0, 0.1);
    b.box(-2, 1, -2, -1.9, 1.1, -1.9);
    c.shining('mix', tex(c), 2, NEON).box(2, 1, -2, 2.1, 1.1, -1.9);         // the same batch, its lights still on
  });
  assert.equal(a.rt.lights.length, 2 + 5);
  assert.deepEqual(a.rt.lights.slice(2).map((L) => [L.x, L.y, L.z].map((v) => Number(v.toFixed(4)))),
    [[0.1, 2.1, 0], [1.1, 2.1, 0], [-1, 1.5, 0], [-1.95, 1.05, -1.95], [2.05, 1.05, -1.95]]);
});

test('determinism: two builds, the same lamps and the same light; nothing seeded is read', async (t) => {
  const build = (c) => { const b = c.shining('row', tex(c), 2, NEON, { lights: { power: 0.3, k: 1.4, far: 5 } }); for (let i = 0; i < 28; i++) b.box(-3.6 + (i % 7) * 1.1, 2.5, -3 + Math.floor(i / 7) * 1.5, -3.5 + (i % 7) * 1.1, 2.54, -2 + Math.floor(i / 7) * 1.5); };
  const a = await oneRoom(t, build, { gfx: MEDIUM }), b = await oneRoom(t, build, { gfx: MEDIUM });
  assert.deepEqual(lamps(a.rt), lamps(b.rt));
  assert.deepEqual(fingerprint(a.rt), fingerprint(b.rt));
  // the room's seeded stream is where it would be without the batch
  let left = null, right = null;
  await oneRoom(t, (c) => { build(c); left = c.R(); });
  await oneRoom(t, (c) => { c.shining('row', tex(c), 2, NEON).box(0, 2.5, 0, 0.1, 2.54, 0.1); right = c.R(); });
  assert.equal(left, right);
});

test('grouping: flicker and banks as a hand-placed lamp with the same options; tube shadows treat them alike', async (t) => {
  for (const lighting of [false, 'dim']) {
    const a = await oneRoom(t, (c) => {
      c.shining('f', tex(c), 2, NEON, { lights: { power: 0.6, flick: true } }).box(-2, 2.5, 0, -1.9, 2.54, 0.1);
      c.shining('b', tex(c), 2, NEON, { lights: { power: 0.6, bank: 1, axis: [0, -1, 0] } }).box(2, 2.5, 0, 2.1, 2.54, 0.1);
    }, { gfx: MEDIUM, lighting });
    const own = a.rt.lights.slice(2);
    assert.equal(groupOf(own[0], a.rt.lighting), 1, 'a flickering lamp');
    assert.equal(groupOf(own[1], a.rt.lighting), lighting ? 3 : 0, 'bank 1 when the room has banks, steady when not');
    assert.ok(a.rt.lm?.shadows, 'the room bakes its shadows with them');
  }
});
