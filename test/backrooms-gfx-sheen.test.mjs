import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// The tubes caught on floors that shine (graphics.js `sheen` and SHEEN_FLOORS, sheen.rule.js, sheen.js, kit.js surface
// `sheen`, world.js finish): off at Classic and Low, and then no define, no uniform, no shader text and no baked number
// moves; on, only floors that shine (never carpet) get the shader's block, fed with their room's own tubes at their level.
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
const THREE = await import('three');
const [{ buildWorld }, { createKit, gfxOf, lamp }, { generate }, makers, G, S, { createSheen }] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('public/world/props/office.js', root).href),
  import(new URL('graphics.js', B).href), import(new URL('sheen.rule.js', B).href), import(new URL('sheen.js', B).href)]);
const { GRAPHICS, profile, SHEEN_FLOORS, SHEEN_KEYS, floorKind, sheenOf } = G;
const { SHEEN, sheenLobe, sheenGroup, sheenLevel, sheenLamps, pickSheen, withSheen, withoutSheen, SHEEN_GLSL, SHEEN_MARK, SHEEN_END } = S;
const src = (f) => readFileSync(new URL(f, B), 'utf8');

const catalogueOf = (kit) => ({ has: (type) => typeof makers[type] === 'function', entry: () => null, geo: (type) => (makers[type] ? kit.model(type, makers[type]) : null) });
const furnish = (c) => {
  c.shell();
  const a = c.spot(0.6); if (a) c.prop('cabinet', a.x, a.z);
  const d = c.spot(0.8); if (d) c.prop('desk', d.x, d.z);
};
async function fixture(t, { gfx, theme } = {}) {
  const level = generate(7, { count: 0, ...(theme ? { theme } : {}) }), kit = gfx === undefined ? createKit() : createKit({ gfx });
  const world = await buildWorld(kit, level, { catalogue: catalogueOf(kit), barricadesEnabled: true, builders: { plain: furnish } });
  t.after(() => { world.dispose(); kit.dispose(); });
  return { level, kit, world };
}
const meshesOf = (world, rt) => {
  const out = [];
  rt.group.traverse((o) => { if (o.isMesh && o.geometry) out.push(o); });
  for (const f of world.furniture) if (f.room === rt.id) f.group.traverse((o) => { if (o.isMesh && o.geometry) out.push(o); });
  return out;
};
function fingerprint(world, rt) {
  let sum = 0, hash = 0;
  for (const m of meshesOf(world, rt)) for (const key of ['aLit', 'aFlk', 'aBank0', 'aBank1', 'aBank2', 'aBank3']) {
    const a = m.geometry.attributes[key]; if (!a) continue;
    if (key === 'aLit') for (const v of a.array) sum += v;
    for (const x of new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length)) hash = (Math.imul(hash, 31) + x) >>> 0;
  }
  return [Number(sum.toFixed(6)), hash];
}
const shaders = (world) => world.rooms.map((rt) => meshesOf(world, rt).map((m) => m.material).filter((m) => m.isShaderMaterial)
  .map((m) => [m.fragmentShader, JSON.stringify(m.defines), Object.keys(m.uniforms).sort().join()]));
const floorOf = (rt) => { let f = null; rt.group.traverse((o) => { if (o.isMesh && o.material?.uniforms?.map?.value && !f && o.material.uniforms.uSheenK) f = o; }); return f; };

test('sheen: a switch per tier, off at classic and low; the kit is told; the game hands it over on a line of its own', () => {
  assert.deepEqual(GRAPHICS.map((g) => profile(g).sheen), [0, 0, 1, 1, 1], 'classic, low, medium, high, auto (medium)');
  for (const o of [undefined, {}, { sheen: 0 }, { sheen: -1 }, { sheen: 'x' }]) assert.equal(gfxOf(o), null);
  assert.deepEqual(gfxOf({ sheen: 1 }), { contact: 0, bounce: 0, sheen: 1 });
  assert.deepEqual(gfxOf({ sheen: 0.3 }), { contact: 0, bounce: 0, sheen: 1 }, 'on or off');
  assert.deepEqual(gfxOf({ contact: 1, bounce: 0.5, shadows: 1, fixtures: 1 }), { contact: 1, bounce: 0.5, shadows: 1, fixtures: 1 }, 'what was asked for before reads as it did');
  for (const tier of ['classic', 'low']) { const p = profile(tier); assert.equal(p.sheen, 0); }
  const index = src('index.js');
  assert.match(index, /fixtures: gfx\(\)\.fixtures \} \}\);\n {4}\/\/ --- floor sheen ---\n(?: {4}\/\/[^\n]*\n)+ {4}if \(!opt\.dev\?\.gfx && !opt\.gfx && gfx\(\)\.sheen > 0\) kit\.gfx = gfxOf\(\{ \.\.\.kit\.gfx, sheen: gfx\(\)\.sheen \}\);\n {4}\/\/ --- end floor sheen ---\n/);
});

test('sheen: the table of floors that shine, in one place; carpet never; the kind is the one kit.js draws', () => {
  for (const k of ['carpet', 'plush', 'moss', 'turf', 'screed']) assert.equal(SHEEN_FLOORS[k], 0, k);
  for (const k of ['lino', 'terrazzo']) assert.ok(SHEEN_FLOORS[k] >= 0.3 && SHEEN_FLOORS[k] <= 0.7, k);
  assert.ok(SHEEN_FLOORS.pooltile > SHEEN_FLOORS.lino && SHEEN_FLOORS.pooltile > SHEEN_FLOORS.terrazzo && SHEEN_FLOORS.pooltile <= 1);
  assert.ok(Object.isFrozen(SHEEN_FLOORS));
  // floorKind is T.floor's own choice: the texture T.floor draws for a look is the one of that kind
  const kit = createKit();
  const look = (floor) => ({ floor, carpet: '#7a6a4a', pale: '#e0d0b0' });
  const T = kit.tex;
  const byKind = { carpet: (l) => T.carpet(l.carpet), plush: (l) => T.plush(l.carpet, l.pale), moss: (l) => T.moss(l.carpet), turf: (l) => T.turf(l.carpet),
    screed: (l) => T.screed(l.carpet), lino: (l) => T.lino(l.carpet), terrazzo: (l) => T.terrazzo(l.carpet) };
  for (const f of [undefined, 'carpet', 'plush', 'moss', 'turf', 'screed', 'lino', 'terrazzo', 'pooltile', 'nonsense']) {
    const l = look(f);
    assert.equal(T.floor(l), byKind[floorKind(l)](l), `${f} → ${floorKind(l)}`);
  }
  assert.equal(floorKind(look('pooltile')), 'carpet', 'the waterpark\'s shell floor is its damp carpet: T.floor has no pool tile');
  kit.dispose();
  // a batch: what the room said, else the floor's own texture, else a key the table knows, else nothing
  assert.equal(sheenOf('floor', true, look('lino')), SHEEN_FLOORS.lino);
  assert.equal(sheenOf('floor', true, look(undefined)), 0);
  assert.equal(sheenOf('carpeted', true, look('terrazzo')), SHEEN_FLOORS.terrazzo);
  assert.equal(sheenOf('wp:btile:seafoam', false, look('pooltile')), SHEEN_FLOORS.pooltile);
  assert.equal(sheenOf('wp:bsub:cobalt', false, look('pooltile')), 0, 'a basin\'s bed is under water');
  assert.equal(sheenOf('pooltile', false, look('pooltile')), 0);
  assert.equal(sheenOf('desk', false, look('lino')), 0);
  assert.equal(sheenOf('desk', false, look('lino'), { sheen: 'terrazzo' }), SHEEN_FLOORS.terrazzo, 'a room may say its batch is a kind of floor');
  assert.equal(sheenOf('floor', true, look('lino'), { sheen: 0 }), 0, '…or that it does not shine');
  assert.equal(sheenOf('x', false, look(), { sheen: 3 }), 1);
  assert.equal(sheenOf('x', false, look(), { sheen: 'velvet' }), 0);
  assert.deepEqual(SHEEN_KEYS.map(([k]) => k), ['wp:btile:']);
  // shinier is a tighter lobe; nothing for nothing
  assert.equal(sheenLobe(0), null); assert.equal(sheenLobe(-1), null); assert.equal(sheenLobe(NaN), null);
  assert.ok(sheenLobe(SHEEN_FLOORS.pooltile).rough < sheenLobe(SHEEN_FLOORS.lino).rough);
  assert.ok(sheenLobe(SHEEN_FLOORS.pooltile).strength > sheenLobe(SHEEN_FLOORS.lino).strength);
  // one number turns the whole effect down: every kind's strength is it × the kind's shininess
  assert.ok(Number.isFinite(G.SHEEN_STRENGTH) && G.SHEEN_STRENGTH > 0);
  assert.equal(SHEEN.gain, G.SHEEN_STRENGTH);
  for (const k of ['lino', 'terrazzo', 'pooltile']) assert.equal(sheenLobe(SHEEN_FLOORS[k]).strength, G.SHEEN_STRENGTH * SHEEN_FLOORS[k]);
});

test('sheen: the lamps a room offers, and the nearest few each draw takes: deterministic, nothing seeded read', () => {
  const tube = (x, z, o = {}) => lamp(x, 2.46, z, [1, 0.95, 0.85], { axis: [0, -1, 0], floor: 0.24, k: 3.4, far: 14, ...o });
  const spill = lamp(0, 1.4, 3, [0.5, 0.5, 0.5], { axis: [0, 0, -1] }); spill.spill = 4;
  const lights = [tube(0, -3), tube(0, 0, { flick: true }), spill, lamp(1, 0.6, 1, [0.4, 0.4, 0.4]), lamp(1, 2.2, 1, [0.4, 0.3, 0.2]), lamp(0, 2.4, 2, [0, 0, 0], { axis: [0, -1, 0] }), tube(0, 3, { bank: 1 })];
  const random = Math.random;
  Math.random = () => { throw new Error('read the seed'); };
  try {
    const got = sheenLamps(lights, null);
    assert.deepEqual(got.map((l) => [l.i, l.tube, l.group]), [[0, true, 0], [1, true, 1], [4, false, 0], [6, true, 0]], 'tubes and high lamps; never the light from next door, a low lamp or one with no colour');
    assert.deepEqual(sheenLamps(lights, { bankCount: 2 }).map((l) => l.group), [0, 1, 0, 3], 'with banks, a banked lamp is its bank');
    assert.deepEqual(got[0].rgb, [1, 0.95, 0.85], 'the tube\'s colour, brightest channel 1'); assert.equal(got[0].far2, lights[0].far2); assert.equal(got[0].k, 3.4);
    // nearest first, ties by the room's order, the same every time
    const many = Array.from({ length: 12 }, (_, i) => ({ x: (i % 4) * 2, y: 2.4, z: Math.floor(i / 4) * 2, i }));
    const a = pickSheen(many, 0, 1.6, 0, 8), b = pickSheen(many, 0, 1.6, 0, 8);
    assert.deepEqual(a, b);
    assert.equal(a.length, 8);
    assert.deepEqual(a.slice(0, 3).map((p) => p.lamp.i), [0, 1, 4]);
    const d = (p) => Math.hypot(p.lamp.x, p.lamp.y - 1.6, p.lamp.z);
    for (let k = 1; k < a.length; k++) assert.ok(d(a[k]) >= d(a[k - 1]));
    const tie = pickSheen([{ x: 1, y: 2, z: 0, i: 'a' }, { x: -1, y: 2, z: 0, i: 'b' }, { x: 0, y: 2, z: 1, i: 'c' }], 0, 2, 0, 2);
    assert.deepEqual(tie.map((p) => p.lamp.i), ['a', 'b']);
    // the last ones fade as they near the one left out, so handing over is never seen; with room for all, all are whole
    assert.ok(a.every((p) => p.w >= 0 && p.w <= 1));
    assert.ok(a[7].w < 1 && a[0].w === 1);
    assert.ok(pickSheen(many.slice(0, 5), 0, 1.6, 0, 8).every((p) => p.w === 1));
    const two = [{ x: 0, y: 2, z: 1 }, { x: 0, y: 2, z: 1.0001 }];
    assert.ok(pickSheen(two, 0, 2, 0, 1)[0].w < 0.01, 'two lamps at the same distance: the one kept has faded out, as the other would have');
  } finally { Math.random = random; }
  assert.equal(SHEEN.lamps, 8);
});

test('sheen: each lamp follows its group: the dimmer, a flicker, a bank turned down; a dead panel has no lamp', () => {
  const u = { dim: { value: 0.8 }, flick: { value: 0.25 }, banks: { value: [0.5, 1] }, moreBanks: { value: [0.1, 0] } };
  assert.equal(sheenLevel(0, u), 0.8);
  assert.equal(sheenLevel(1, u), 0.8 * 0.25);
  assert.equal(sheenLevel(2, u), 0.8 * 0.5);
  assert.equal(sheenLevel(3, u), 0.8);
  assert.equal(sheenLevel(4, u), 0.8 * 0.1);
  assert.equal(sheenLevel(5, u), 0);
  assert.equal(sheenLevel(0, {}), 1);
  // the bake's own grouping (kit.js bake: banked only where the room has banks and the bank is one of them)
  assert.equal(sheenGroup({ flick: true, bank: 0 }, null), 1);
  assert.equal(sheenGroup({ flick: true, bank: 0 }, { bankCount: 2 }), 2);
  assert.equal(sheenGroup({ bank: 3 }, { bankCount: 2 }), 0);
  assert.equal(sheenGroup({ bank: 3 }, { bankCount: 4 }), 5);
  // sheen.js: a frame moves the nearest into the camera's space at this frame's level
  const rt = { lights: [lamp(0, 2.46, -2, [1, 1, 1], { axis: [0, -1, 0] }), lamp(0, 2.46, 2, [1, 1, 1], { axis: [0, -1, 0], flick: true })],
    lighting: null, u: { dim: { value: 1 }, flick: { value: 1 }, banks: { value: [1, 1] }, moreBanks: { value: [0, 0] } } };
  // (a room moved and turned a quarter, as rooms are; the eye at its +z end, so the lamp at z = 2 is the nearer)
  const sh = createSheen(rt), mesh = new THREE.Mesh(), cam = new THREE.PerspectiveCamera();
  mesh.position.set(5, 0.5, -3); mesh.rotation.y = Math.PI / 2; mesh.updateMatrixWorld();
  cam.position.copy(mesh.localToWorld(new THREE.Vector3(0, 1.6, 4))); cam.lookAt(mesh.localToWorld(new THREE.Vector3(0, 0, 0))); cam.updateMatrixWorld();
  const near4 = (i) => Array.from(sh.uniforms.uSheenP.value.slice(i * 4, i * 4 + 4));
  const C = () => [0, 1].map((i) => +sh.uniforms.uSheenC.value[i * 4].toFixed(6));
  sh.frame.call(mesh, null, null, cam);
  assert.deepEqual(C(), [1, 1]);
  const view = (x, y, z) => mesh.localToWorld(new THREE.Vector3(x, y, z)).applyMatrix4(cam.matrixWorldInverse);
  const P = near4(0), near = view(0, 2.46, 2);
  assert.ok(Math.abs(P[0] - near.x) < 1e-5 && Math.abs(P[1] - near.y) < 1e-5 && Math.abs(P[2] - near.z) < 1e-5 && P[3] === 1, 'the nearer (flickering) one first, in view space, its group in w');
  const T = sh.uniforms.uSheenT.value, tube = view(0, 2.46, 2 + SHEEN.tube).sub(near);
  assert.ok(Math.abs(T[0] - tube.x) < 1e-5 && Math.abs(T[1] - tube.y) < 1e-5 && Math.abs(T[2] - tube.z) < 1e-5, 'a tube: half its length along the room\'s z');
  rt.u.flick.value = 0.3; rt.u.dim.value = 0.5;
  sh.frame.call(mesh, null, null, cam);
  assert.deepEqual(C(), [0.15, 0.5], 'the flickering one flickers, both dim');
  assert.equal(sh.uniforms.uSheenC.value[8], 0, 'no third lamp: none');
  assert.deepEqual(Array.from(sh.uniforms.uSheenE.value).map((v) => +v.toFixed(6)), [0.325, 0.325, 0.325], 'the wax as a whole: the mean of the tubes at their level');
  const up = new THREE.Vector3(0, 1, 0).transformDirection(mesh.matrixWorld).transformDirection(cam.matrixWorldInverse), U = sh.uniforms.uSheenUp.value;
  assert.ok(Math.hypot(U[0] - up.x, U[1] - up.y, U[2] - up.z) < 1e-5);
  assert.equal(createSheen({ ...rt, lights: [] }), null, 'a room with no tube has none');
  const m = sh.material(SHEEN_FLOORS.lino);
  assert.equal(m.uniforms.uSheenP, sh.uniforms.uSheenP, 'a room\'s floors share its lamps');
  assert.equal(m.uniforms.uSheenK.value[2], SHEEN.blocky);
  assert.ok(!/from 'three'/.test(src('sheen.js')), 'sheen.js needs no three.js of its own (tests that load world.js by hand)');
  assert.equal(sh.material(0), null);
});

test('sheen: the shader block is put in only for a floor given it; off, the shader is the one there was', () => {
  const kit = createKit({ gfx: { sheen: 1 } }), map = new THREE.Texture();
  const plain = kit.surface({ map }), lmPlain = kit.surface({ map, lm: { uniforms: {}, materials: [], shadows: true } });
  assert.ok(!/Sheen|SHEEN|floor sheen/.test(plain.fragmentShader), 'no sheen text without it');
  assert.equal(plain.defines.SHEEN, undefined);
  assert.ok(!Object.keys(plain.uniforms).some((k) => k.startsWith('uSheen')));
  const sh = createSheen({ lights: [lamp(0, 2.4, 0, [1, 1, 1], { axis: [0, -1, 0] })], lighting: null, u: {} });
  const on = kit.surface({ map, sheen: sh.material(0.5) });
  assert.equal(on.defines.SHEEN, SHEEN.lamps);
  assert.notEqual(on.fragmentShader, plain.fragmentShader);
  assert.equal(withoutSheen(on.fragmentShader), plain.fragmentShader, 'taking the block out gives back the shader there was, to the character');
  assert.equal(on.fragmentShader, withSheen(plain.fragmentShader));
  assert.equal(on.fragmentShader.split(SHEEN_MARK).length - 1, 2);
  assert.equal(on.fragmentShader.split(SHEEN_END).length - 1, 2);
  assert.ok(on.fragmentShader.includes(SHEEN_GLSL));
  assert.match(on.fragmentShader, / {2}\/\/ --- floor sheen ---\n {2}c \+= floorSheen\(normal\);\n {2}\/\/ --- end floor sheen ---\n {2}gl_FragColor = vec4\(c, uAlpha\);\n\}$/, 'added last, after the texture and the wet glint: white light, not the floor\'s colour');
  assert.match(on.fragmentShader, /\/\/ --- end floor sheen ---\nvoid main\(\) \{/);
  assert.ok(on.fragmentShader.indexOf(SHEEN_MARK) > on.fragmentShader.indexOf('vec2 lmUv(float k)'), 'after the light map\'s lookup it borrows');
  for (const k of ['uSheenP', 'uSheenT', 'uSheenC', 'uSheenK', 'uSheenUp']) assert.ok(on.uniforms[k], k);
  const lmOn = kit.surface({ map, lm: { uniforms: {}, materials: [], shadows: true }, sheen: sh.material(0.5) });
  assert.equal(withoutSheen(lmOn.fragmentShader), lmPlain.fragmentShader);
  assert.ok(SHEEN_GLSL.includes('#if defined(LIGHTMAP) && defined(TUBESHADOW)') && SHEEN_GLSL.includes('sheenShade('), 'under the tube shadows of its group');
  assert.ok(SHEEN_GLSL.includes('pow(1.0 - max(dot(H, V), 0.0), 5.0)'), 'fresnel: nearly nothing looking straight down');
  assert.throws(() => withSheen('void main() {}'), /changed/);
  // kit.js: the block and its plumbing are marked; the shader constant itself has no sheen text
  const k = src('kit.js'), FRAG = k.slice(k.indexOf('const FRAG = `'), k.indexOf('}`;', k.indexOf('const FRAG = `')));
  assert.ok(!/[Ss]heen/.test(FRAG));
  assert.equal(k.split('// --- floor sheen ---').length - 1, 2);
  kit.dispose();
});

test('sheen: off (classic, low, or not asked for), every room bakes and draws as before; on, only floors that shine take it', async (t) => {
  // the plain office floor (carpet): on changes nothing at all, shader or bake
  const off = await fixture(t, {}), on = await fixture(t, { gfx: { sheen: 1 } });
  assert.deepEqual(on.world.rooms.map((rt) => fingerprint(on.world, rt)), off.world.rooms.map((rt) => fingerprint(off.world, rt)));
  assert.deepEqual(shaders(on.world), shaders(off.world), 'carpet: not one material differs');
  assert.ok(on.world.rooms.every((rt) => !rt.sheen));
  // Records (lino): the bake is the same with and without it, the floors take the block, nothing else does
  for (const tier of ['classic', 'low', 'medium']) {
    const p = profile(tier), gfx = { contact: p.contact, bounce: p.bounce, shadows: p.shadows, doorlight: p.doorlight, fixtures: p.fixtures };
    const a = await fixture(t, { gfx, theme: 'archive' }), b = await fixture(t, { gfx: { ...gfx, sheen: p.sheen }, theme: 'archive' });
    assert.deepEqual(b.world.rooms.map((rt) => fingerprint(b.world, rt)), a.world.rooms.map((rt) => fingerprint(a.world, rt)), `${tier}: the same baked numbers`);
    if (!p.sheen) { assert.deepEqual(shaders(b.world), shaders(a.world), `${tier}: the same shaders`); continue; }
    const lino = b.world.rooms.filter((rt) => rt.def.look.floor === 'lino');
    assert.ok(lino.length > 3);
    let floors = 0, dead = 0, flick = 0;
    for (const rt of b.world.rooms) {
      const ms = meshesOf(b.world, rt), with_ = ms.filter((m) => m.material.uniforms?.uSheenK);
      for (const m of with_) {
        assert.equal(m.onBeforeRender, rt.sheen.frame, 'the room\'s tubes moved into each draw\'s camera');
        assert.equal(withoutSheen(m.material.fragmentShader).includes('floorSheen'), false);
      }
      if (rt.def.look.floor !== 'lino' || !rt.sheen) { assert.equal(with_.length, 0, `room ${rt.id} (${rt.def.look.floor})`); continue; }
      const floor = floorOf(rt);
      assert.ok(floor, `room ${rt.id}: its floor shines`);
      assert.ok(with_.every((m) => m.material.uniforms.map.value === floor.material.uniforms.map.value), 'only the floor');
      assert.deepEqual(rt.sheen.lamps.map((l) => l.i), sheenLamps(rt.lights, rt.lighting).map((l) => l.i));
      assert.ok(rt.sheen.lamps.every((l) => !rt.lights[l.i].spill));
      // a dead panel has no lamp, so no streak; a flickering one is in the flicker's group (or its bank's)
      for (const p of rt.def.panels || []) {
        const at = rt.sheen.lamps.filter((l) => l.tube && Math.hypot(l.x - p.x, l.z - p.z) < 0.05);
        if (p.state === 'dead') { assert.equal(at.length, 0, `room ${rt.id}: a dead panel`); dead++; }
        if (p.state === 'flicker' && at.length && !rt.lighting) { assert.ok(at.every((l) => l.group === 1)); flick++; }
      }
      floors++;
    }
    assert.ok(floors > 3);
    assert.ok(dead > 0 && flick > 0, `Records has dead (${dead}) and flickering (${flick}) panels over its lino`);
  }
});

test('sheen: world.js gives it on lines of its own; the dev page can force it', () => {
  const w = src('world.js');
  assert.match(w, /\/\/ --- floor sheen ---\n(?:[^\n]*\n){1,12}? {6}\/\/ --- end floor sheen ---\n {6}for \(const \[key, m\] of mapped\) \{\n {8}const sheen = rt\.sheen \? rt\.sheen\.material\(sheenFor\(key, m\)\) : null;\n/);
  assert.match(w, /lm: owner \? null : rt\.lm, \.\.\.\(sheen && !owner \? \{ sheen \} : \{\}\) \}\), 0, false, key\);/);
  assert.match(w, /if \(material\.uniforms\?\.uSheenK\) last\.onBeforeRender = rt\.sheen\.frame;/);
  assert.match(readFileSync(new URL('public/world/dev/backrooms.js', root), 'utf8'), /&gfx=sheen/);
});
