import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// The shell's sockets and an exit sign's box are the sculpted ones (wallfit.model.js). Looks only: the sign's face, its
// glow and its light are what they were, nothing is solid or usable that was not, and the seeded source is not drawn on.
// Uses the real kit and world; only canvas drawing is inert, and no WebGL is needed.
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
const [{ buildWorld }, { createKit }, { generate }, { socketVox, exitBoxVox }, { meshVox }, makers] = await Promise.all([
  import(new URL('world.js', B).href), import(new URL('kit.js', B).href), import(new URL('gen.js', B).href), import(new URL('wallfit.model.js', B).href),
  import(new URL('public/world/vox/mesher.js', root).href), import(new URL('public/world/props/office.js', root).href)]);

const DOOR = { side: 'front', c: 0.4, w: 1.2, h: 2.05, sill: 0 };
/** One 6 m room: its shell without the sockets it would roll, and whatever `fit` puts on its walls. */
async function oneRoom(t, fit, gfx = null) {
  const level = generate(7, { count: 0 }), src = level.rooms.find((r) => r.kind === 'plain' && r.panels.length >= 2);
  const def = { ...src, id: 0, x: 0, z: 0, w: 6, d: 6, W: 6, D: 6, H: 2.6, cx: 3, cz: 3, y: 0, rot: 0, doors: [], wins: [], shape: null,
    panels: [{ x: -1, z: -1, state: 'on' }, { x: 1, z: 1, state: 'on' }] };
  const kit = gfx ? createKit({ gfx }) : createKit(), keys = [], model = kit.model;
  kit.model = (key, ...rest) => { keys.push(key); return model(key, ...rest); };
  const world = await buildWorld(kit, { ...level, rooms: [def], links: [], windows: [] }, { catalogue: { has: () => false, entry: () => null, geo: () => null }, barricadesEnabled: false,
    builders: { plain: (c) => { c.shell({ sockets: false }); fit(c); } } });
  t.after(() => { world.dispose(); kit.dispose(); });
  return { rt: world.rooms[0], keys };
}
const meshes = (rt) => { const out = []; rt.group.traverse((o) => { if (o.isMesh && o.geometry) out.push(o); }); return out; };
const tris = (rt) => meshes(rt).reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
const cost = (v) => meshVox(v, { ao: false }).solid.index.count / 3;
const three3 = (c) => { c.socket('back', -1); c.socket('left', 0.5); c.socket('right', 1, 0.12); };

test('wallfit: a socket is the sculpted plate and an exit sign has the sculpted box, at what they cost', async (t) => {
  const bare = await oneRoom(t, () => {}), one = await oneRoom(t, (c) => c.socket('back', -1)), sockets = await oneRoom(t, three3);
  const used = sockets.keys.filter((k) => k.startsWith('wallfit:socket:'));
  assert.equal(used.length, 3, 'each socket is the model');
  const variantOf = (k) => Number(k.at(-1));
  assert.equal(tris(sockets.rt) - tris(bare.rt), used.reduce((n, k) => n + cost(socketVox(variantOf(k))), 0), 'and nothing else is added');
  assert.equal(variantOf(used[2]), 0, 'nothing is plugged into a socket so low that its lead would go through the floor');
  // small: a plain plate is a few hundred triangles at most, and a room does not gain a mesh for one, or for three
  for (const v of [0, 1]) assert.ok(cost(socketVox(v)) <= 200, `socket ${v}: ${cost(socketVox(v))} triangles`);
  assert.equal(meshes(one.rt).length, meshes(bare.rt).length);
  assert.equal(meshes(sockets.rt).length, meshes(bare.rt).length);
  assert.ok(meshes(sockets.rt).every((m) => !m.userData.detail), 'nothing of it is detail: a low setting keeps the sockets');

  const sign = await oneRoom(t, (c) => c.exitSign(DOOR, 'EXIT')), two = await oneRoom(t, (c) => { c.exitSign(DOOR, 'EXIT'); c.exitSign({ ...DOOR, side: 'back', c: -1 }, 'EXIT'); });
  const box = sign.keys.filter((k) => k.startsWith('wallfit:exit:'));
  assert.equal(box.length, 1);
  const bw = 0.82 + 0.04, bh = 0.82 * 0.36, boxTris = cost(exitBoxVox({ w: bw, h: bh }));
  assert.ok(boxTris <= 120, `the exit box: ${boxTris} triangles`);
  assert.equal(tris(sign.rt) - tris(bare.rt), boxTris + 2, 'the box and the lit face, and nothing else');
  assert.equal(meshes(two.rt).length, meshes(sign.rt).length, 'a second sign costs the room no mesh');
  // the charge lamp under it shines: it is baked as a glow, red
  const glowing = meshes(sign.rt).flatMap((m) => { const s = m.geometry.attributes.aSurf, l = m.geometry.attributes.aLit; if (!s || !l) return []; const out = []; for (let i = 0; i < s.count; i++) if (s.getY(i) > 0.5) out.push([l.getX(i), l.getY(i), l.getZ(i)]); return out; });
  assert.ok(glowing.length > 0 && glowing.every(([r, g, b]) => r > 2 * g && r > 2 * b), 'a red lamp that shines');
});

test('wallfit: the exit sign\'s face, its light and its shadow are what they were; nothing is solid or usable that was not', async (t) => {
  // recorded from the plain box's code, the same room
  const FACE = [[0.81, 2.18187, 2.965, -0.01, 2.18187, 2.965, -0.01, 2.43812, 2.965, 0.81, 2.43812, 2.965], [0, 0, 1, 0, 1, 1, 0, 1]];
  const LIGHT = { x: 0.3999999999999999, y: 2.3099999999999996, z: 2.7649999999999997, r: 0.029276204139913484, g: 0.2236212628605085, b: 0.0786751972556663, k: 0.9, wrap: 0.3, lobe: false, ax: 0, ay: 0, az: 0, floor: 0.25, flick: false, far2: 16 };
  const BOX = { x0: -0.030000000000000082, y0: 2.1623999999999994, z0: 2.9699999999999998, x1: 0.8299999999999998, y1: 2.4576, z1: 3 };
  for (const gfx of [null, { shadows: 1 }]) {
    const bare = await oneRoom(t, () => {}, gfx), { rt } = await oneRoom(t, (c) => { three3(c); c.exitSign(DOOR, 'EXIT'); }, gfx);
    const faces = meshes(rt).filter((m) => m.material?.map?.image && m.geometry.attributes.position.count === 4);
    assert.equal(faces.length, 1);
    assert.deepEqual([[...faces[0].geometry.attributes.position.array].map((v) => +v.toFixed(5)), [...faces[0].geometry.attributes.uv.array]], FACE);
    assert.equal(rt.lights.length, bare.rt.lights.length + 1);
    assert.deepEqual(JSON.parse(JSON.stringify(rt.lights.at(-1))), LIGHT);
    assert.deepEqual(rt.colliders, bare.rt.colliders); assert.deepEqual(rt.colliders, []);
    assert.equal(rt.uses.length, 0); assert.equal(rt.zones.length, 0);
    // (with the tubes' shadows on: the box stands where the plain one did, and no socket stands at all)
    if (gfx) assert.deepEqual(rt.shadowBoxes, [BOX]);
  }
});

test('wallfit: on a floor, which sockets have something plugged in is the seed\'s, and generation does not move', async (t) => {
  const catalogueOf = (kit) => ({ has: (type) => typeof makers[type] === 'function', entry: () => null, geo: (type) => (makers[type] ? kit.model(type, makers[type]) : null) });
  const fresh = JSON.stringify(generate(7, { count: 0 })), random = Math.random;
  const floor = async (r) => {
    const level = generate(7, { count: 0 }), kit = createKit(), keys = [], model = kit.model;
    kit.model = (key, ...rest) => { if (key.startsWith('wallfit:')) keys.push(key); return model(key, ...rest); };
    Math.random = () => r;
    try {
      const world = await buildWorld(kit, level, { catalogue: catalogueOf(kit), barricadesEnabled: true, lighting: false, builders: { plain: (c) => c.shell() } });
      t.after(() => { world.dispose(); kit.dispose(); });
      assert.equal(JSON.stringify(level), fresh, 'the level handed to the world is as generated');
      return { keys, world };
    } finally { Math.random = random; }
  };
  const a = await floor(0.1), b = await floor(0.9);
  assert.deepEqual(a.keys, b.keys);
  assert.ok(a.keys.includes('wallfit:socket:0') && a.keys.includes('wallfit:socket:1'), 'both kinds, somewhere on the floor');
  assert.equal(JSON.stringify(generate(7, { count: 0 })), fresh);
  for (const rt of a.world.rooms) assert.ok(meshes(rt).length <= 45);
});
