import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { profile } from '../public/world/backrooms/graphics.js';

// The wake (water, push two; liquid.rule.js ringLeft / wakeStart / wakeStep / wakeFill / wadeStep, liquid.js wakeOf and
// feel, liquid.mark.js the handle's disturb, index.js the visitor's feed): rings where something disturbs a surface, in a
// small pool a surface, timed by the camcorder's clock, drawn as a blocky band in the surface's height. At water 0 the
// call is accepted and does nothing.
const pub = new URL('../public/', import.meta.url).href, root = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  if (s === 'three') return {url:${JSON.stringify(pub + 'vendor/three.module.min.js')},shortCircuit:true};
  if (s.startsWith('/vendor/')) return {url:${JSON.stringify(pub.slice(0, -1))}+s,shortCircuit:true};
  if (s.startsWith('/core/')) return {url:new URL(s.slice(1),${JSON.stringify(root)}).href,shortCircuit:true};
  return next(s,c);
}`), import.meta.url);
const THREE = await import('three');
const { createKit, Batch } = await import('../public/world/backrooms/kit.js');
const { markLiquid, createLiquidView } = await import('../public/world/backrooms/liquid.js');
const { LIQUID, ringLeft, wakeHash, wakeStart, wakeStep, wakeFill, wadeStep, LIQUID_FRAG } = await import('../public/world/backrooms/liquid.rule.js');
const { createVhs } = await import('../public/world/backrooms/vhs.js');

const B = (f) => readFileSync(new URL(`../public/world/backrooms/${f}`, import.meta.url), 'utf8');
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

const draw = new Proxy({}, { get: (_, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 6 }) : /Gradient/.test(k) ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
const oldDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => draw }) };
test.after(() => { globalThis.document = oldDocument; });

/** A room with one kit sheet 4 × 3 m at y −0.05 in its frame (x −2…2, z −1.5…1.5), marked, built; the room's group at `at`, turned by `turn`. */
function pool({ at = [0, 0, 0], turn = 0 } = {}) {
  const kit = createKit(), group = new THREE.Group(), u = { flick: { value: 1 }, dim: { value: 1 }, banks: { value: [1, 1] }, moreBanks: { value: [0, 0] } };
  group.position.set(...at); group.rotation.y = turn;
  const rt = { group, u }, after = [], c = { rt, kit, after };
  const batch = new Batch();
  batch.grid([-2, -0.05, -1.5], [0, 0, 1], [1, 0, 0], [0, 1, 2, 3], [0, 1, 2, 3, 4], (a, b) => [a, b], [0.88, 1, 1]);
  const mesh = new THREE.Mesh(kit.geometry(batch, [], [0.6, 0.6, 0.6]), kit.surface({ map: new THREE.Texture(), room: u, alpha: 0.52, side: THREE.DoubleSide }));
  group.add(mesh);
  const handle = markLiquid(c, mesh, { kind: 'water', y: -0.05 });
  for (const fn of after) fn();
  const scene = new THREE.Scene(), part = new THREE.Scene(); part.add(group); scene.add(part); scene.updateMatrixWorld(true);
  const cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.06, 170); cam.position.set(at[0], 1.6, at[2] + 2.5); cam.lookAt(at[0], -0.05, at[2]); cam.updateMatrixWorld();
  return { kit, group, rt, mesh, handle, rec: rt.liquids[0], scene, part, cam };
}

test('a ring\'s life: whole as it starts, fading with age, nothing at wakeLife (and no step there: nothing pops when it is dropped)', () => {
  assert.equal(ringLeft(0), 1);
  let last = 1;
  for (let a = 0.1; a < LIQUID.wakeLife; a += 0.1) { const v = ringLeft(a); assert.ok(v < last && v > 0, `fades at ${a}`); last = v; }
  assert.equal(ringLeft(LIQUID.wakeLife), 0); assert.equal(ringLeft(LIQUID.wakeLife + 1), 0); assert.equal(ringLeft(-0.01), 0); assert.equal(ringLeft(NaN), 0);
  assert.ok(ringLeft(LIQUID.wakeLife - 0.02) < 1e-4, 'all but gone in the last frame or so before it is dropped');
  assert.ok(LIQUID.wakeLife >= 2 && LIQUID.wakeLife <= 3, 'about 2 to 3 s');
  assert.equal(LIQUID.rings, 8, 'the pool is the shader\'s array');
});

test('the pool: a ring starts, ages by the clock, is dropped once faded; full, the faintest (then the oldest) is replaced', () => {
  const p = [];
  assert.equal(wakeStart(p, 1, 2, 1, 10), true);
  // each ring a little its own, from where and when it starts (no seeded stream, nothing random: the same call, the same ring)
  const j = 1 + LIQUID.wakeJitter * (wakeHash(1, 2, 10, 1) - 0.5), waves = LIQUID.wakeWaves[0] + (LIQUID.wakeWaves[1] - LIQUID.wakeWaves[0]) * wakeHash(1, 2, 10, 2);
  assert.deepEqual(p, [{ x: 1, z: 2, t0: 10, s: j, n: waves }]);
  const again = []; wakeStart(again, 1, 2, 1, 10); assert.deepEqual(again, p);
  const many = []; for (let i = 0; i < 400; i++) { const q = []; wakeStart(q, i * 0.37, i * 0.11, 1, i * 0.35); many.push(q[0]); }
  const ss = many.map((r) => r.s), ns = many.map((r) => r.n);
  assert.ok(Math.min(...ss) >= 1 - LIQUID.wakeJitter / 2 - 1e-9 && Math.max(...ss) <= 1 + LIQUID.wakeJitter / 2 + 1e-9 && Math.max(...ss) - Math.min(...ss) > LIQUID.wakeJitter * 0.8, 'strength jittered within its bounds');
  assert.ok(Math.min(...ns) >= LIQUID.wakeWaves[0] && Math.max(...ns) <= LIQUID.wakeWaves[1] && Math.max(...ns) - Math.min(...ns) > 1, 'and how many waves');
  for (const bad of [[NaN, 0, 1], [0, Infinity, 1], [0, 0, 0], [0, 0, -1], [0, 0, NaN]]) assert.equal(wakeStart(p, ...bad, 10), false, `refused ${bad}`);
  assert.equal(wakeStart(p, 0, 0, 1, NaN), false); assert.equal(wakeStart(null, 0, 0, 1, 0), false);
  wakeStart(p, 0, 0, 9, 10); assert.ok(p[1].s <= LIQUID.wakeMost && p[1].s > 1.5, 'no stronger than wakeMost');
  // ages: kept while it lives, dropped at wakeLife (and a clock that went back drops what it had)
  wakeStep(p, 10 + LIQUID.wakeLife - 0.01); assert.equal(p.length, 2);
  wakeStep(p, 10 + LIQUID.wakeLife + 1e-6); assert.equal(p.length, 0);
  wakeStart(p, 0, 0, 1, 20); wakeStep(p, 19); assert.equal(p.length, 0);
  // full: eight rings; the ninth replaces the faintest at that moment (strength times what is left of it)
  const q = [];
  for (let i = 0; i < LIQUID.rings; i++) wakeStart(q, i, 0, 1, i * 0.2);
  assert.equal(q.length, LIQUID.rings);
  const left = q.map((r) => r.s * ringLeft(1.6 - r.t0)), least = left.indexOf(Math.min(...left));
  assert.equal(least, 0, 'with near-equal strengths, the oldest is the faintest');
  wakeStart(q, 99, 0, 1, 1.6); assert.equal(q.length, LIQUID.rings); assert.equal(q[least].x, 99, 'the faintest went');
  // a fresh weak ring is fainter than an old strong one: it goes first
  const r = [];
  for (let i = 0; i < LIQUID.rings; i++) wakeStart(r, i, 0, i === 3 ? 0.05 : 2, i === 3 ? 1 : 0);
  wakeStart(r, 42, 0, 1, 1); assert.equal(r[3].x, 42, 'the faintest went');
  // to the shader: x, z, age, and waves × 4 + strength (as the shader takes them apart: q = floor(w / 4), s = w − 4q, waves = q / 16 + 1)
  const out = Array.from({ length: LIQUID.rings }, () => new THREE.Vector4(7, 7, 7, 7));
  const n = wakeFill([{ x: 1, z: 2, t0: 3, s: 0.5, n: 2.5 }], 4, out);
  assert.equal(n, 1); assert.deepEqual(out[0].toArray(), [1, 2, 1, 24 * 4 + 0.5]); assert.deepEqual(out[1].toArray(), [7, 7, 7, 7], 'the rest left alone (uRingN says how many)');
  const unpack = (w) => { const q = Math.floor(w / 4); return [q / 16 + 1, w - q * 4]; };
  for (const [nn, st] of [[1.5, 0.3], [3, 2], [2.2, 1.999]]) { const o = [new THREE.Vector4()]; wakeFill([{ x: 0, z: 0, t0: 0, s: st, n: nn }], 0, o); const [a, b] = unpack(o[0].w); assert.ok(Math.abs(a - nn) <= 1 / 32 && Math.abs(b - st) < 1e-6, `${nn} ${st}`); }
  assert.equal(wakeFill([], 0, out), 0); assert.equal(wakeFill(undefined, 0, out), 0);
  const arr = [[0, 0, 0, 0]]; wakeFill([{ x: 5, z: 6, t0: 1, s: 1, n: 1.5 }], 2, arr); assert.deepEqual(arr[0], [5, 6, 1, 8 * 4 + 1]);
});

test('the visitor\'s wake: a ring going in, then one every wadeEvery metres moved, by speed; none standing, none paused', () => {
  const run = (frames, { wet = () => true, speed = () => 1.2, dt = 1 / 60, t0 = 5 } = {}) => {
    let s = null; const rings = [];
    for (let i = 0; i < frames; i++) { const now = t0 + i * dt, r = wadeStep(s, { wet: wet(i), speed: speed(i), now }); s = r.state; if (r.ring) rings.push([+(now - t0).toFixed(3), r.ring]); }
    return rings;
  };
  const walk = run(121);                                   // two seconds at 60 frames a second, 1.2 m/s: 2.4 m
  assert.equal(walk[0][0], 0); assert.ok(near(walk[0][1], Math.min(LIQUID.wakeMost, LIQUID.wadeEntry + 0.3 * 1.2 / LIQUID.wadeWalk)), 'one going in');
  assert.equal(walk.length - 1, Math.floor(2.4 / LIQUID.wadeEvery), 'then one every wadeEvery metres');
  const gaps = walk.slice(1).map((r, i) => r[0] - walk[i][0]);
  for (const g of gaps) assert.ok(Math.abs(g - LIQUID.wadeEvery / 1.2) < 1 / 59, `spaced ${g}`);
  for (const [, s] of walk.slice(1)) assert.ok(near(s, 1.2 / LIQUID.wadeWalk), 'as strong as they are quick (a walk: 1)');
  // running lays them closer in time, and as far apart on the water
  const runs = run(121, { speed: () => 3.6 });
  assert.equal(runs.length - 1, Math.floor(7.2 / LIQUID.wadeEvery)); assert.ok(runs[2][0] - runs[1][0] < gaps[0] / 2);
  // at 10 frames a second the spacing is the same
  const slow = run(21, { dt: 0.1 }); assert.equal(slow.length - 1, Math.floor(2.4 / LIQUID.wadeEvery));
  // standing in it: the one going in and nothing after
  assert.equal(run(240, { speed: () => 0.1 }).length, 1);
  // strength by speed, within its bounds
  assert.ok(near(run(90, { speed: () => 0.4 })[1][1], LIQUID.wadeLeast)); assert.ok(near(run(30, { speed: () => 9 })[1][1], LIQUID.wadeMost));
  // a paused clock (the same now each frame) starts nothing more
  let s = wadeStep(null, { wet: true, speed: 2, now: 1 }).state;
  for (let i = 0; i < 100; i++) { const r = wadeStep(s, { wet: true, speed: 2, now: 1 }); assert.equal(r.ring, 0); s = r.state; }
  // out of it: nothing, and going in again is another ring going in
  const inOut = run(60, { wet: (i) => i < 20 || i >= 40, speed: () => 0 });
  assert.deepEqual(inOut.map((r) => r[0]), [0, +(40 / 60).toFixed(3)]);
  // a long frame counts no more than a quarter second
  s = wadeStep(null, { wet: true, now: 0 }).state;
  assert.equal(wadeStep(s, { wet: true, speed: 1.5, now: 10 }).ring, 0, 'a hitch is not a run of rings');
});

test('at water 0 (Classic, Low, no view): disturb is accepted and does nothing', () => {
  const w = pool();
  assert.equal(w.handle.disturb(0, 0, 1), false); assert.equal(w.handle.disturb(), false);
  assert.equal(w.rec.wake, null); assert.equal(w.rec.disturb, null); assert.equal(w.rec.state, 'marked');
  // the camcorder at Classic and Low makes no view: nothing ever sets the call up
  const r = { getPixelRatio: () => 1, setRenderTarget() {}, getRenderTarget: () => null, render() {}, clear() {}, getContext: () => ({}), getSize: (v) => v.set(1, 1), getClearAlpha: () => 1, getClearColor: (c) => c, setClearColor() {}, autoClear: true, state: { buffers: { depth: { setMask() {} } } } };
  const vhs = createVhs(r, w.cam, { bloom: false, level: 2, profile: profile('classic') });
  vhs.setScene(w.scene); vhs.setProfile(profile('low'));
  assert.equal(vhs.liquids, null); assert.equal(w.handle.disturb(0, 0, 1), false);
  // up at High, and back to Classic: the call is let go of with the surface
  vhs.setProfile(profile('high')); vhs.liquids.frame(w.scene, w.cam, 1);
  assert.equal(w.handle.disturb(0, 0, 1), true);
  vhs.setProfile(profile('classic'));
  assert.equal(w.rec.disturb, null); assert.equal(w.rec.wake, null); assert.equal(w.handle.disturb(0, 0, 1), false);
  // a refused sheet never has one
  const kit = createKit(), refused = markLiquid({ rt: {}, kit, after: [] }, null, {});
  assert.equal(refused.disturb(0, 0, 1), false);
  vhs.dispose(); w.kit.dispose(); kit.dispose();
});

test('a surface\'s own rings: world to its room frame, timed by the camcorder\'s clock, set into its own uniforms; none, uRingN 0', () => {
  const a = pool({ at: [10, 0.65, -4], turn: Math.PI / 2 }), b = pool();
  const view = createLiquidView();
  view.frame(a.scene, a.cam, 3); view.frame(b.scene, b.cam, 3);
  const ua = a.rec.pairs[0].material.uniforms, ub = b.rec.pairs[0].material.uniforms;
  assert.notEqual(ua.uRings, ub.uRings, 'each surface its own rings'); assert.equal(ua.uRings, a.rec.wake.u.uRings); assert.equal(ua.uRingN, a.rec.wake.u.uRingN);
  assert.equal(ua.uRingN.value, 0, 'none: uRingN 0');
  assert.equal(ua.uRings.value.length, LIQUID.rings);
  // a point given in the world (the part's frame) is kept in the room's: room (1, 0.5) is world (10 + 0.5, −4 − 1)
  const wx = 10 + 0.5, wz = -4 - 1;
  assert.equal(a.handle.disturb(wx, wz, 1.5), true);
  const [ring] = a.rec.wake.pool;
  assert.ok(near(ring.x, 1, 1e-5) && near(ring.z, 0.5, 1e-5), `in the room's frame ${ring.x}, ${ring.z}`);
  assert.equal(ring.t0, 3, 'started at the camcorder\'s time');
  view.frame(a.scene, a.cam, 4);
  assert.equal(ua.uRingN.value, 1); assert.deepEqual(ua.uRings.value[0].toArray().map((v) => +v.toFixed(4)), [1, 0.5, 1, +(Math.round((ring.n - 1) * 16) * 4 + ring.s).toFixed(4)]);
  assert.equal(view.stats.rings, 1); assert.equal(ub.uRingN.value, 0, 'the other surface untouched');
  view.frame(a.scene, a.cam, 3 + LIQUID.wakeLife + 1e-6);
  assert.equal(ua.uRingN.value, 0, 'dropped once faded'); assert.equal(a.rec.wake.pool.length, 0);
  // strength 0, or a point that is not a number: nothing
  assert.equal(a.handle.disturb(wx, wz, 0), false); assert.equal(a.handle.disturb(NaN, wz, 1), false);
  // no Math.random, nothing seeded read: the pool is the same for the same calls
  const rnd = Math.random; Math.random = () => { throw new Error('random read'); };
  try { a.handle.disturb(wx, wz, 1); view.frame(a.scene, a.cam, 9); } finally { Math.random = rnd; }
  a.kit.dispose(); b.kit.dispose();
});

test('feel(): the visitor in a surface\'s water leaves a wake; out of it, over it, too deep or in another part, none', () => {
  const w = pool({ at: [3, 0, 0] }), view = createLiquidView();
  view.frame(w.scene, w.cam, 0);
  // standing on the deck beside it (the floor over the plane): nothing
  assert.equal(view.feel(w.part, 3, 0, 0, 1.1, 1), 0);
  // outside its footprint: nothing
  assert.equal(view.feel(w.part, 3 + 2.5, 0, -0.5, 0.6, 1), 0);
  // in it, the floor under the plane: a ring going in, where they are
  assert.ok(view.feel(w.part, 3.5, 0.2, -0.45, 0.6, 1.2) > 1);
  assert.equal(w.rec.wake.pool.length, 1); assert.ok(near(w.rec.wake.pool[0].x, 0.5, 1e-5) && near(w.rec.wake.pool[0].z, 0.2, 1e-5));
  // moving: one every wadeEvery metres moved, timed by the camcorder's clock
  let n = 0;
  for (let i = 1; i <= 60; i++) { view.frame(w.scene, w.cam, i / 30); if (view.feel(w.part, 3.5, 0.2, -0.45, 0.6, 1.2) > 0) n++; }
  assert.equal(n, Math.floor(2 * 1.2 / LIQUID.wadeEvery), 'one every wadeEvery metres (2 s at 1.2 m/s)');
  // another part's surface is not the one they stand in
  const other = new THREE.Scene(), v2 = createLiquidView(), w2 = pool({ at: [3, 0, 0] });
  v2.frame(w2.scene, w2.cam, 0);
  assert.equal(v2.feel(other, 3.5, 0.2, -0.45, 0.6, 1.2), 0); assert.equal(w2.rec.wake.pool.length, 0);
  // the eye far under the surface (a dive to the bottom of something deep) does not disturb it
  assert.equal(v2.feel(w2.part, 3.5, 0.2, -2.4, -1.6, 1.2), 0);
  // nonsense: nothing
  assert.equal(v2.feel(w2.part, NaN, 0, 0, 0, 1), 0);
  w.kit.dispose(); w2.kit.dispose();
});

test('the feed: index.js gives the visitor to the view once a frame, only while playing; no room file and no gameplay file touched', () => {
  const src = B('index.js');
  assert.match(src, /    world\.update\(dt, time, me\);\n    \/\/ --- water --- [^\n]*\n    if \(state === 'play' && !me\.frozen\) vhs\.liquids\?\.feel\(world\.scene, me\.x, me\.z, me\.y - player\.EYE \+ me\.sink, me\.y, me\.speed\);[^\n]*\n    \/\/ --- end water ---\n/);
  assert.equal(src.split('vhs.liquids?.feel(').length - 1, 1);
  for (const f of ['player.js', 'waterpark.js', 'waterpark.rule.js', 'pursuer.js']) assert.ok(!/\.disturb\(|liquids\?\.feel|wakeStart/.test(B(f)), `${f}: nothing of the wake`);
  assert.ok(!/Math\.random|\bR\(|\brng\b|makeRng/.test(B('liquid.js') + B('liquid.rule.js') + B('liquid.mark.js')), 'nothing seeded, nothing random');
});

test('the shader: each ring on cells of its own that widen far off (not flattened), a broken crest, a trough, the bed stirred; none, the old path', () => {
  const ring = LIQUID_FRAG.slice(LIQUID_FRAG.indexOf('vec4 wakeRing('), LIQUID_FRAG.indexOf('float liquidDepth('));
  assert.ok(ring.length > 100);
  assert.match(ring, /float front = [\d.]+ \+ [\d.]+ \* age \+ base \* [\d.]+;/, 'its front spreads at a fixed speed, moved a little by the ripple');
  assert.match(ring, /lambda = max\([\d.]+, 3\.0 \* rc\);/, 'its waves never shorter than three of its cells');
  assert.match(ring, /float t = clamp\(1\.0 - age \/ [\d.]+, 0\.0, 1\.0\);/);
  assert.match(ring, /exp\(-[\d.]+ \* age\) \* t \* t \* inversesqrt\(1\.0 \+ [\d.]+ \* r\)/, 'fading with age (to nothing at its life) and with the distance gone');
  assert.match(ring, /float q = floor\(w\.w \/ 4\.0\), s = w\.w - q \* 4\.0, waves = q \/ 16\.0 \+ 1\.0;/, 'as wakeFill packs it');
  // the ripple's height has no ring in it any more: the ring's slope is its own, after the ripple's far-off flattening
  const height = LIQUID_FRAG.slice(LIQUID_FRAG.indexOf('float liquidHeight('), LIQUID_FRAG.indexOf('vec3 reflection('));
  assert.ok(!/uRing|wakeRing/.test(height));
  const main = LIQUID_FRAG.slice(LIQUID_FRAG.indexOf('void main()'));
  const flat = main.indexOf('slope *= clamp((cell / max(max(fw.x, fw.y), 1e-5)'), own = main.indexOf('slope += floor(vec2(wx - wk.x, wz - wk.x)');
  assert.ok(flat > 0 && own > flat, 'the ring is added after the ripple lies flat far off, so it is not flattened with it');
  assert.ok(own < main.indexOf('vec3 n = normalize('), 'and before the normal: it bends the bed and the light');
  assert.match(main, /float rc = cell \* exp2\(clamp\(ceil\(log2\([\d.]+ \* sqrt\(max\(fw\.x \* fw\.y, 1e-10\)\) \/ cell\)\), 0\.0, 2\.0\)\);\n    vec2 rp = \(floor\(vRoom\.xz \/ rc\) \+ 0\.5\) \* rc;/, 'its cells: 5, 10 or 20 cm of the room\'s frame');
  assert.match(main, /wk\.y \*= g \* step\([\d.]+, fract\(sin\(dot\(floor\(vRoom\.xz \/ rc\)/, 'the crest a broken band of its cells');
  assert.match(main, /float g = mix\([\d.]+, 1\.0, smoothstep\([\d.]+, [\d.]+, distance\(/, 'gentler right under the eye');
  assert.match(main, /if \(uRingN > 0\) under \*= 1\.0 \+ [\d.]+ \* min\(wk\.w, 1\.5\) \* \(0\.35 \+ k\);/, 'the bed stirred inside a fresh ring');
  assert.match(main, /if \(uRingN > 0\) col \*= 1\.0 \+ \(clamp\(wk\.y \* [\d.]+, 0\.0, 0\.9\) - clamp\(wk\.z \* [\d.]+, 0\.0, 0\.35\)\) \* \(1\.0 - edge\);/, 'crest light, trough dark');
  // none set: every part of it behind uRingN > 0 (the picture is the old one: the page's proof)
  assert.equal(main.split('uRingN > 0').length - 1, 3);
  assert.ok(LIQUID.wakeWave / LIQUID.cell >= 3, 'a wave is several cells long near: it reads as blocks, not speckle');
  assert.equal(LIQUID_FRAG.split('texture2D(').length - 1, 3, 'its three reads of the copy, as before: no new read');
  assert.ok(LIQUID.wakeNear[2] > 0 && LIQUID.wakeNear[2] < 1 && LIQUID.wakeNear[0] < LIQUID.wakeNear[1]);
});
