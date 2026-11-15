import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { bridgeSupport, canTip } from '../public/world/backrooms/bridge-rules.js';
import { createFurnitureMotion } from '../public/world/backrooms/furniture-motion.js';
import { verifyBridgePlan, bridgeReachable } from '../public/world/backrooms/bridge-puzzles.js';
import { createFurnitureGrip, furnitureTarget } from '../public/world/backrooms/furniture-grip.js';
import { createWalk } from '../public/world/backrooms/cast/walk.js';
import { createPlayer } from '../public/world/backrooms/player.js';
import { furnitureClear } from '../public/world/backrooms/furniture-rules.js';
const root = new URL('../', import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};return next(s,c);}`)}`, import.meta.url);
const [{ createKit, Batch }, { buildWorld }, { generate, toWorld }, { movableCutout }] = await Promise.all([
  import('../public/world/backrooms/kit.js'), import('../public/world/backrooms/world.js'), import('../public/world/backrooms/gen.js'), import('../public/world/backrooms/movable-cutout.js'),
]);
const { Box3 } = await import('../public/vendor/three.module.min.js');
const previousDocument = globalThis.document;
const draw = new Proxy({}, { get: (_, k) => k === 'measureText' ? s => ({ width: String(s).length * 6 }) : /Gradient/.test(k) ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
globalThis.document = { createElement: () => ({ getContext: () => draw }) };
test.after(() => { globalThis.document = previousDocument; });

async function fixture(t, { rot = 0, both = true, plan = true, enabled = true, wall = false, ceiling = 4, height = 2.7, shifted = false, prop = false } = {}) {
  const generated = generate('bridge-test'), original = generated.rooms[0];
  const def = { ...original, id: 0, kind: 'plain', rot, x: -6.1, z: -6.1, w: 12.2, d: 12.2, W: 12, D: 12, H: ceiling, cx: 0, cz: 0, y: 1.7, shape: null, panels: [], wins: [],
    doors: plan ? [{ side: 'front', c: 0, w: 2, h: 2.1, sill: 0 }, { side: 'back', c: 0, w: 2, h: 2.1, sill: 0 }] : [] };
  const kit = createKit(), items = [], plans = [], level = { ...generated, rooms: [def], links: [], windows: [], start: { room: 0, x: 0, z: 4 } };
  const env = { catalogue: { has: () => false }, barricadesEnabled: enabled, level, builders: { plain(c) {
    c.rt.floorY = (x, z) => Math.abs(z) < .85 ? -3 : 0;
    c.rt.headY = (x, z) => ceiling - c.rt.floorY(x, z);
    for (const [x, z, facing] of both ? [[-1.5, 1.8, 2], [1.5, -1.8, 0]] : [[-1.5, 1.8, 2]]) {
      const item = movableCutout(c, { x, z, height, facing }); items.push(item);
      if (plan && item) plans.push(c.bridgeRoute(item, { stand: { x, z: z + Math.sign(z) * .75 }, path: [{ x: shifted ? x + 3 : x, z: Math.sign(z) * 1.35 }] }));
    }
    if (wall) c.solid(-3, 1.45, -.7, 1.5, { keep: true, tall: true });
    if (prop) {
      const batch = new Batch(); batch.box(2.75, 0, 2.75, 3.25, .6, 3.25, [.5, .3, .2]);
      items.push(c.movable(c.dynamic(batch, { pivot: [3, 0, 3] }), { label: 'Wooden box', foot: { x: 3, z: 3, x0: 2.75, x1: 3.25, z0: 2.75, z1: 3.25, bottom: 0, top: .6 } }));
    }
  } } };
  const warnings = [], warn = console.warn; console.warn = (...s) => warnings.push(s.join(' '));
  let world;
  try { world = await buildWorld(kit, level, env); } finally { console.warn = warn; }
  env.world = world; env.barricades = createFurnitureMotion(world);
  t.after(() => { world.dispose(); kit.dispose(); });
  const at = (x, z) => toWorld(def, x, z);
  return { world, env, def, kit, items, plans, warnings, at };
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function moveToBank(f, index = 0) {
  const item = f.items[index], direction = f.at(0, index ? .45 : -.45), zero = f.at(0, 0);
  const moved = f.env.barricades.move(item, direction.x - zero.x, direction.z - zero.z);
  assert.equal(moved.moved, true); return item;
}
function deploy(f, item, me) {
  const got = f.env.barricades.tip(item, me); assert.equal(got.ok, true, got.reason);
  item.tick(.5); assert.equal(item.deployed, true); return got;
}
function geometryFits(item) {
  item.group.updateMatrixWorld(true);
  const b = new Box3().setFromObject(item.group), eps = .026; // voxel meshing rounds one cell
  assert.ok(b.min.x >= item.x0 - eps && b.max.x <= item.x1 + eps);
  assert.ok(b.min.z >= item.z0 - eps && b.max.z <= item.z1 + eps, `mesh z ${b.min.z},${b.max.z}; body ${item.z0},${item.z1}; rotation ${item.group.rotation.toArray()}`);
  assert.ok(b.min.y >= item.y - eps && b.max.y <= item.top + eps);
}

test('room-built cutouts register coherent meshes/bodies in turned and raised rooms; flag-off stays solid', async t => {
  for (const rot of [0, 1, 2, 3]) {
    const f = await fixture(t, { rot, plan: false });
    assert.equal(f.warnings.length, 0, f.warnings.join('\n'));
    const item = f.items[0]; assert.ok(item); assert.equal(item.group.parent, f.world.scene);
    assert.equal(furnitureTarget(f.world, { ...f.at(-1.5, 2.55), y: 2.8, yaw: rot * Math.PI / 2, pitch: 0 }), item);
    const before = item.group.position.clone();
    moveToBank(f);
    const actual = item.group.position.clone().sub(before), dest = f.at(-1.5, 1.35);
    close(item.hinge.x, dest.x); close(item.hinge.z, dest.z); close(actual.length(), .45);
    close(item.collider.x0, item.x0); close(item.y, 1.7);
    assert.equal(f.world.free(item.x, item.z, .22), false);
    geometryFits(item);
    deploy(f, item, f.at(-1.5, 2.1)); geometryFits(item);
    const far = moveToBank(f, 1); deploy(f, far, f.at(1.5, -2.1)); geometryFits(far);
  }
  const off = await fixture(t, { enabled: false, plan: false });
  assert.equal(off.world.furniture.length, 0); assert.deepEqual(off.items, [null, null]);
  const p = off.at(-1.5, 1.8); assert.equal(off.world.free(p.x, p.z, .22), false);
});

test('a room-built box uses ordinary grip, collision and removal without a catalogue entry', async t => {
  const f = await fixture(t, { plan: false, prop: true, rot: 1 }), box = f.items.at(-1);
  assert.equal(box.type, 'prop'); assert.equal(box.group.parent, f.world.scene); geometryFits(box);
  const me = { ...f.at(3, 3.8), y: 2.2, yaw: Math.PI / 2, pitch: -.3 }, grip = createFurnitureGrip(f.world, f.env.barricades);
  grip.update(.016, me); assert.equal(grip.target, box); const rev = f.env.barricades.version(0); assert.equal(grip.use(), true);
  // (carried, since the chair-grab fix: it goes where its carrier goes, and is solid again where it is set down)
  const before = box.group.position.clone();
  assert.equal(grip.step(-.04, 0, (dx, dz) => { me.x += dx; me.z += dz; return true; }), true); close(box.group.position.x - before.x, -.04);
  grip.release(); assert.equal(grip.held, null);
  geometryFits(box); assert.ok(f.env.barricades.version(0) > rev);
  const p = { x: box.x, z: box.z }; box.remove();
  assert.equal(f.world.free(p.x, p.z), true); assert.equal(f.world.furniture.includes(box), false);
});

test('a real supported bridge becomes floor after its animation; the player and grounded cast cross it', async t => {
  for (const rot of [0, 1]) {
    const f = await fixture(t, { rot, plan: false });
    const p = f.at(-1.5, 0); close(f.world.floorY(p.x, p.z), -1.3);
    const item = moveToBank(f), me = { ...f.at(-1.5, 2.1), r: .22 };
    const got = f.env.barricades.tip(item, me); assert.equal(got.ok, true, got.reason);
    assert.equal(item.transition !== null, true); close(f.world.floorY(p.x, p.z), -1.3);
    item.tick(.5);
    close(f.world.floorY(p.x, p.z), 1.78); close(f.world.headroom(p.x, p.z), 3.92);
    assert.equal(f.world.free(p.x, p.z, .22), true); assert.equal(furnitureClear(f.world, me.x, me.z, p.x, p.z, .22), true);
    const walk = createWalk(f.env), target = f.at(-1.5, -2.3), actor = { ...me, r: .22, tall: 1.6, speed: 1, opens: true, pushes: true };
    for (let i = 0; i < 300; i++) walk.go(actor, target, .03);
    assert.ok(Math.hypot(actor.x - target.x, actor.z - target.z) < .2, 'grounded creature crosses the actual supported floor');
    const input = { keys: new Set(['w']), dx: 0, dy: 0, stick: { x: 0, y: 0 } }, camera = { position: { set() {} }, rotation: { set() {} } };
    const player = createPlayer(f.world, camera, { ...me, yaw: rot * Math.PI / 2 }, input);
    for (let i = 0; i < 75; i++) player.update(.03);
    const end = f.at(-1.5, -1.5);
    assert.ok(Math.hypot(player.me.x - end.x, player.me.z - end.z) < 1.1, 'player walks over the bridge without warping');
  }
});

test('support cannot be faked by a short panel, one good bank, or another bridge', async t => {
  const f = await fixture(t, { height: 1.3, plan: false });
  const short = moveToBank(f); assert.equal(canTip(f.world, short).ok, false);
  const g = await fixture(t, { plan: false });
  const item = moveToBank(g), box = item.pose(Math.PI / 2);
  assert.equal(bridgeSupport(g.world, box, item.bridge.axis).ok, true);
  const fake = Object.create(g.world); fake.terrainY = () => -3; fake.floorY = () => box.y;
  assert.equal(bridgeSupport(fake, box, item.bridge.axis).ok, false, 'movable surfaces do not support floating bridge chains');
});

test('swept lowering/raising cannot hit ceilings, walls, people or hide the loss of a bridge', async t => {
  const f = await fixture(t, { plan: false }); const item = moveToBank(f), near = { ...f.at(-1.5, 2.1) };
  const low = Object.create(f.world); low.ceilingY = () => 3;
  assert.equal(canTip(low, item, { actor: near }).ok, false);
  f.world.bodies.push({ ...f.at(-1.5, -.1), r: .25, on: true });
  assert.equal(canTip(f.world, item, { actor: near }).ok, false, 'cannot lower onto a creature in the pit');
  f.world.bodies.length = 0;
  deploy(f, item, near);
  const over = f.at(-1.5, 0); f.world.env.player = { me: over, RADIUS: .22 };
  assert.equal(f.env.barricades.tip(item, near).ok, false, 'cannot raise under a visitor even with a different caller');
  delete f.world.env.player;
  assert.equal(f.env.barricades.move(item, .1, 0).moved, false, 'a deployed bridge is not shoved out from under its users');
  assert.equal(f.env.barricades.tip(item, f.at(-1.5, -2)).reason, 'hinge');
  const rev = f.env.barricades.version(0);
  assert.equal(f.env.barricades.tip(item, near).ok, true); item.tick(.5);
  assert.equal(item.deployed, false); close(f.world.floorY(over.x, over.z), -1.3);
  assert.ok(f.env.barricades.version(0) > rev);
});

test('reachability proves real drag-and-tip plans from BOTH entrances without mutating scenery', async t => {
  const f = await fixture(t);
  assert.equal(f.warnings.length, 0, f.warnings.join('\n'));
  assert.equal(f.world.rooms[0].bridgePuzzleVerified, true);
  assert.equal(f.world.rooms[0].flat, false);
  assert.equal(bridgeReachable(f.world, f.world.rooms[0]), true);
  for (const item of f.items) { assert.equal(item.deployed, false); assert.equal(item.transition, null); assert.equal(item.offsetX, 0); assert.equal(item.offsetZ, 0); }
  const result = verifyBridgePlan(f.world, f.world.rooms[0], f.plans[0]); assert.ok(result);
  const bad = { ...f.plans[0], stand: { x: -1.5, z: 0 } };
  assert.equal(verifyBridgePlan(f.world, f.world.rooms[0], bad), null);
  const oneSide = await fixture(t, { both: false });
  assert.equal(oneSide.world.rooms[0].bridgePuzzleVerified, undefined);
  assert.ok(oneSide.warnings.length, 'the unreachable-bank puzzle still invokes the normal rescue');
  const walled = await fixture(t, { wall: true });
  assert.equal(walled.world.rooms[0].bridgePuzzleVerified, undefined, 'a route through a wall is not proof');
});

test('hiding a deployed panel removes its surface and invalidates navigation; returning restores it', async t => {
  const f = await fixture(t, { plan: false }), item = moveToBank(f); deploy(f, item, f.at(-1.5, 2.1));
  const p = f.at(-1.5, 0), rev = f.env.barricades.version(0);
  f.env.barricades.takeAway((x) => x < 0, 'scenery'); close(f.world.floorY(p.x, p.z), -1.3);
  assert.ok(f.env.barricades.version(0) > rev);
  f.env.barricades.bringBack('scenery'); close(f.world.floorY(p.x, p.z), 1.78);
});
