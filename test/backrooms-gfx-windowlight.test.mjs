import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Light through a window between two rooms (gen.js windows; world.js doorLight): at Medium and High the doorway-light
// pass takes each window as a doorway with a sill (the hole's y0) and a head (its y1), always open, with no leaf, its
// cross of bars standing in it. Classic and Low have no map and no lamp for a window, as before. Uses the real kit and
// world on plain rooms (the shell only); canvas drawing is inert, and no WebGL is needed.
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
const [{ buildWorld }, { createKit }, { generate, toWorld, toLocal, wallPoint, T }, { lampPoints }, { profile }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href),
  import(new URL('shadowmap.js', B).href), import(new URL('graphics.js', B).href)]);

const SEED = 1;                                    // (count 0: three windows, all between plain rooms)
const catalogue = { has: () => false, entry: () => null, geo: () => null };
const gfxOf = (tier) => { const p = profile(tier); return { contact: p.contact, bounce: p.bounce, shadows: p.shadows, doorlight: p.doorlight, fixtures: p.fixtures }; };
async function build(t, tier, { strip = false } = {}) {
  const level = generate(SEED, { count: 0 });
  if (strip) for (const r of level.rooms) r.wins = [];
  const kit = createKit({ gfx: gfxOf(tier) });
  const world = await buildWorld(kit, level, { catalogue, barricadesEnabled: false, builders: { plain: (c) => c.shell() } });
  t.after(() => { world.dispose(); kit.dispose(); });
  return { level, world };
}
const windowed = (rt) => (rt.def.wins || []).length > 0;
const bytes = (q) => (q ? Buffer.from(q.data).toString('base64') : null);

test('the seed has windows between rooms, and each room of a pair names the other', () => {
  const level = generate(SEED, { count: 0 });
  assert.ok(level.windows.length >= 2);
  for (const w of level.windows) for (const [a, b] of [[w.a, w.b], [w.b, w.a]]) assert.ok(level.rooms[a].wins.some((r) => r.win === w.id && r.to === b));
});

test('Medium and High: a window passes its neighbour\'s light, and only through the opening', async (t) => {
  for (const tier of ['medium', 'high']) {
    const { world } = await build(t, tier);
    let lit = 0, windows = 0;
    for (const rt of world.rooms) for (const [d, entry] of (rt.doorLight || []).entries()) {
      if (!String(entry.link).startsWith('win:')) continue;
      windows++;
      const w = rt.def.wins.find((q) => `win:${q.win}` === entry.link), N = entry.other, m = rt.lm, L = m.layout;
      assert.equal(N.id, w.to);
      // the neighbour's lamp points in this room's frame
      const pts = N.lights.filter((q) => !q.spill).flatMap((q) => lampPoints(q)).map(([x, y, z]) => { const p = toWorld(N.def, x, z), l = toLocal(rt.def, p.x, p.z); return [l.x, y + (N.def.y || 0) - (rt.def.y || 0), l.z]; });
      // the opening's two faces: this side of the wall, and the far side
      const face = (off) => { const a = wallPoint(rt.def, w.side, w.c - w.w / 2, off), b = wallPoint(rt.def, w.side, w.c + w.w / 2, off); return { a, b }; };
      const f0 = face(0), f1 = face(-T), along = f0.a.x !== f0.b.x ? 'x' : 'z', across = along === 'x' ? 'z' : 'x', tol = 0.12;
      /** Does the segment S → P cross the plane `at` (across) within the opening (±tol)? */
      const within = (S, P, f) => {
        const at = f.a[across], si = across === 'x' ? 0 : 2, ui = along === 'x' ? 0 : 2, k = (at - S[si]) / (P[si] - S[si]);
        if (!(k > 0 && k < 1)) return false;
        const u = S[ui] + k * (P[ui] - S[ui]), y = S[1] + k * (P[1] - S[1]), lo = Math.min(f.a[along], f.b[along]), hi = Math.max(f.a[along], f.b[along]);
        return u > lo - tol && u < hi + tol && y > w.y0 - tol && y < w.y1 + tol;
      };
      // every texel this window lights is seen from one of the lamps through both faces of the opening: nothing came
      // through the wall beside it, above its head or below its sill
      let here = 0;
      for (const r of L.list) for (let j = 0; j < r.nv; j++) for (let i = 0; i < r.nu; i++) {
        if (m.C.data[((r.py + j) * L.width + r.px + i) * 4 + d] < 16) continue;
        const P = [0, 0, 0]; P[r.a] = r.at; P[r.u] = r.o[0] + (i + 0.5) * r.cell; P[r.v] = r.o[1] + (j + 0.5) * r.cell;
        here++;
        assert.ok(pts.some((S) => within(S, P, f0) && within(S, P, f1)), `${tier} room ${rt.id} ${entry.link}: texel on ${r.name} at ${P.map((v) => v.toFixed(2))} is lit, not through the opening`);
      }
      assert.ok(here > 20, `${tier} room ${rt.id} ${entry.link}: a patch of light (${here} texels)`);
      lit++;
    }
    assert.ok(windows >= 2 && lit === windows, `${tier}: windows pass light (${lit} of ${windows})`);
  }
});

test('Medium: the light through a window is as a doorway\'s: always open, the neighbour\'s colour, no leaf, no throat', async (t) => {
  const { world } = await build(t, 'medium');
  const ds = world.rooms.flatMap((rt) => (rt.doorLight || []).filter((d) => String(d.link).startsWith('win:')).map((d) => ({ rt, d })));
  assert.ok(ds.length >= 2);
  for (const { rt, d } of ds) {
    assert.equal(d.throat.open, true);
    assert.ok(d.u.x > 0 || d.u.y > 0 || d.u.z > 0, 'lit this frame');
    for (const tint of d.tint) for (const v of tint) assert.ok(Number.isFinite(v) && v > 0);
    assert.ok(rt.doorStats.windows >= 1 && rt.doorStats.ofWindows === rt.def.wins.length);
  }
  // only rooms with a window have one
  for (const rt of world.rooms) if (!windowed(rt)) for (const d of rt.doorLight || []) assert.ok(!String(d.link).startsWith('win:'));
});

test('Medium: rooms with no window, and no neighbour with one, are as they would be with no windows on the floor', async (t) => {
  const a = await build(t, 'medium'), b = await build(t, 'medium', { strip: true });
  const near = new Set(a.world.rooms.filter(windowed).flatMap((rt) => [rt.id, ...rt.def.doors.map((dr) => dr.to)]));
  let checked = 0;
  for (const rt of a.world.rooms) {
    if (near.has(rt.id)) continue;
    const q = b.world.rooms[rt.id];
    assert.equal(bytes(rt.lm?.A), bytes(q.lm?.A)); assert.equal(bytes(rt.lm?.C), bytes(q.lm?.C));
    assert.deepEqual((rt.doorLight || []).map((d) => [d.link, d.peak, d.share]), (q.doorLight || []).map((d) => [d.link, d.peak, d.share]));
    checked++;
  }
  assert.ok(checked > 5);
});

test('Classic and Low: no map, and no lamp for a window', async (t) => {
  for (const tier of ['classic', 'low']) {
    const { world } = await build(t, tier);
    for (const rt of world.rooms) {
      assert.equal(rt.lm, undefined); assert.equal(rt.doorLight, undefined); assert.equal(rt.doorStats, undefined);
      // the glow lamps from next door are the doorways' alone, one for each doorway into a brighter room
      const brighter = rt.def.doors.filter((dr) => world.rooms[dr.to].level - rt.level >= 0.05).length;
      assert.equal(rt.lights.filter((L) => L.spill !== undefined).length, brighter);
    }
  }
});

test('deterministic: the same floor bakes the same windows twice', async (t) => {
  const a = await build(t, 'medium'), b = await build(t, 'medium');
  for (const rt of a.world.rooms.filter(windowed)) assert.equal(bytes(rt.lm?.C), bytes(b.world.rooms[rt.id].lm?.C));
});
