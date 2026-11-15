import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three.module.min.js';
import * as officeProps from '../public/world/props/office.js';
import { trolley } from '../public/world/props/trolley.js';
import { fixedFurnitureReason, onFurniture, boxHits } from '../public/world/backrooms/furniture-policy.js';
import { createFurnitureMotion } from '../public/world/backrooms/furniture-motion.js';
import { toLocal } from '../public/world/backrooms/gen.js';

// Use the actual builder, voxel catalogue, mesher and batches. Canvas drawing
// is the only browser stand-in; no WebGL context is needed to inspect meshes.
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const browserModule = (file, replacements = {}) => {
  const url = new URL(file, import.meta.url);
  return moduleUrl(readFileSync(url, 'utf8').replace(/from '([^']+)'/g, (_, specifier) =>
    `from '${replacements[specifier] || (specifier === 'three' ? new URL('../public/vendor/three.module.min.js', import.meta.url).href : new URL(specifier, url).href)}'`));
};
const kitUrl = browserModule('../public/world/backrooms/kit.js', {
  '../scene/textures.js': browserModule('../public/world/scene/textures.js'),
  '../vox/mesher.js': browserModule('../public/world/vox/mesher.js'),
});
const [{ buildWorld }, { createKit, Batch }] = await Promise.all([
  import(browserModule('../public/world/backrooms/world.js', { './kit.js': kitUrl })), import(kitUrl),
]);
const draw = new Proxy({}, { get: (_, name) => name === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
const previousDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => draw }) };
test.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });

function room(id, rot = 0) {
  return { id, kind: 'plain', x: id * 8, z: 0, w: 8, d: 8, W: 8, D: 8, H: 3, cx: id * 8 + 4, cz: 4, y: 0, rot,
    look: { tube: '#fffbe0', wall: '#d2c98d' }, light: { power: 1 }, panels: [], doors: [], wins: [] };
}
async function make(t, builder, { enabled = true, rot = 0, two = false } = {}) {
  const kit = createKit(), makers = { ...officeProps, trolley }, catalogue = {
    has: type => typeof makers[type] === 'function',
    geo: type => makers[type] ? kit.model(type, makers[type]) : null,
  }, rooms = two ? [room(0, rot), room(1)] : [room(0, rot)];
  const links = two ? [{ a: 0, b: 1, axis: 'x', at: 8, from: 3, to: 5 }] : [];
  if (two) { rooms[0].doors.push({ to: 1, side: rot ? 'front' : 'right', c: 0, w: 2, h: 2.1 }); rooms[1].doors.push({ to: 0, side: 'left', c: 0, w: 2, h: 2.1 }); }
  const env = { catalogue, barricadesEnabled: enabled, builders: { plain: c => { if (c.room.id === 0) builder(c); } } };
  const world = await buildWorld(kit, { seed: 'furniture-world', rooms, links, windows: [] }, env);
  env.world = world;
  t.after(() => { world.dispose(); kit.dispose(); });
  return world;
}

test('furniture policy distinguishes structural placement, not arbitrary solid flags', () => {
  const f = { x0: -1, x1: 1, z0: -.5, z1: .5, bottom: 0, top: .65 };
  assert.equal(fixedFurnitureReason('desk', f, { solid: false }), null);
  assert.equal(fixedFurnitureReason('chair', { ...f, bottom: -.025 }), null, 'native wheel overhang is not a sunk chair');
  assert.equal(fixedFurnitureReason('desk', { ...f, bottom: -.4 }), 'sunk');
  assert.equal(fixedFurnitureReason('chair', { ...f, bottom: 1 }), 'raised');
  assert.equal(fixedFurnitureReason('chair', f, { flip: true }), 'wedged');
  assert.equal(fixedFurnitureReason('chair', f, {}, 0, true), 'stacked');
  assert.equal(onFurniture(f, { x0: -.3, x1: .3, z0: -.2, z1: .2, bottom: .65, top: 1.15 }), true);
  assert.equal(onFurniture(f, { ...f, bottom: 0 }), false, 'a neighbour on the floor is not a desktop attachment');
  assert.equal(boxHits(f, { x: 1.1, z: 0, r: .2 }), true);
});

test('ordinary catalogue chairs/desks/trolleys are consistently movable only with the flag', async t => {
  const build = c => {
    c.prop('chair', -2, 0); c.prop('chair', 0, -2, { solid: false });
    c.prop('desk', 1, 1, { solid: false }); c.prop('trolley', -2, 2);
    c.prop('chair', 2, -2, { y: -.35 }); c.prop('chair', 2, -2, { y: 3, flip: true });
  };
  const off = await make(t, build, { enabled: false }), on = await make(t, build);
  assert.equal(off.furniture.length, 0);
  assert.deepEqual(on.furniture.map(f => f.type), ['chair', 'chair', 'desk', 'trolley']);
  assert.ok(on.furniture.every(f => f.collider.on && f.group.parent === on.scene));
  assert.ok(on.furniture.every(f => f.y === 0), 'support height is the floor, including native chair wheels');
  for (const f of on.furniture) assert.equal(on.free(f.x, f.z, .1, { ghost: true }), false, 'furniture blocks creatures too');
});

test('flying and spectral clearance never grants permission to cross walls', async t => {
  const world = await make(t, c => { c.prop('desk', 0, 0); c.solid(-2, -3, -1.9, 3, { tall: true }); });
  const desk = world.furniture[0];
  assert.equal(world.free(desk.x, desk.z, .1, { ghost: true }), false);
  assert.equal(world.free(desk.x, desk.z, .1, { ghost: true, furniture: 'phase' }), true);
  assert.equal(world.free(desk.x, desk.z, .1, { ghost: true, furnitureY: desk.top + .01 }), true);
  assert.equal(world.free(desk.x, desk.z, .1, { ghost: true, furnitureY: desk.top - .01 }), false);
  for (const opt of [{ furniture: 'phase' }, { furnitureY: 2.5 }]) {
    assert.equal(world.free(2.05, 4, .1, { ghost: true, ...opt }), false, 'room obstacle still blocks');
    assert.equal(world.free(-1, 4, .1, { ghost: true, ...opt }), false, 'outer shell still blocks');
  }
  const fixed = await make(t, c => c.prop('desk', 0, 0), { enabled: false });
  assert.equal(fixed.free(4, 4, .1, { ghost: true, furnitureY: 2 }), true, 'ordinary fixed desks have height too');
});

test('flight clearance includes raw desktop attachments added after the furniture collider is created', async t => {
  const world = await make(t, c => {
    const desk = c.prop('desk', 0, 0);
    c.flat.box(-.2, desk.top, -.2, .2, desk.top + 1.2, .2, [1, 1, 1]);
  });
  const desk = world.furniture[0];
  assert.ok(desk.top > 1.8);
  assert.equal(desk.collider.top, desk.top);
  assert.equal(world.free(desk.x, desk.z, .1, { ghost: true, furnitureY: desk.top - .1 }), false);
  assert.equal(world.free(desk.x, desk.z, .1, { ghost: true, furnitureY: desk.top + .1 }), true);
});

test('furniture cannot be dragged into residents; only vertically overlapping airborne bodies block it', async t => {
  const world = await make(t, c => c.prop('chair', 0, 0)), chair = world.furniture[0], motion = createFurnitureMotion(world);
  const body = { x: chair.x1 + .15, z: chair.z, r: .2, on: true };
  world.bodies.push(body);
  assert.equal(motion.move(chair, .2, 0).moved, false);
  body.on = false;
  assert.equal(motion.move(chair, .1, 0).moved, true, 'an absent resident does not leave a ghost obstruction');
  body.x = chair.x1 + .15; body.on = true; body.airborne = true;
  body.bottom = chair.top + .1; body.top = body.bottom + .4;
  assert.equal(world.free(body.x, body.z, .01), true, 'a flyer is not a ground/player collider');
  assert.equal(motion.move(chair, .1, 0).moved, true, 'low chair passes underneath a moth');
  body.x = chair.x1 + .15; body.bottom = chair.top - .2;
  assert.equal(motion.move(chair, .2, 0).moved, false, 'furniture may not enter the actual flying body');
});

test('desktop models, raw screen/paper, added objects, uses and contact shadows travel with a turned desk', async t => {
  let extra, use;
  const world = await make(t, c => {
    const desk = c.prop('desk', 0, 0);
    c.prop('crt', 0, 0, { y: desk.top, shadow: false, solid: false });
    c.prop('keyboard', 0, -.2, { y: desk.top, shadow: false, solid: false });
    c.lay(c.mapped('note', c.kit.tex.white()), .4, .1, .2, .15, 0, null, [1, 1, 1], desk.top + .01);
    c.board(c.shining('crt-screen', c.kit.tex.white()), 0, desk.top + .3, .21, .3, .2);
    extra = new THREE.Mesh(c.kit.own(new THREE.BoxGeometry(.1, .1, .1)), c.kit.own(new THREE.MeshBasicMaterial()));
    extra.position.set(-.4, desk.top + .05, 0); c.add(extra);
    use = c.use({ x: 0, z: 0, label: 'Screen', use() {} });
  }, { rot: 1 });
  const desk = world.furniture[0], before = new THREE.Vector3();
  assert.equal(desk.group.children.length, 5, 'voxel models, paper, screen, shadow and added object share the carrier');
  assert.equal(extra.parent, desk.group);
  assert.ok(desk.top >= 1.15, 'the carried monitor contributes to clearance');
  assert.equal(world.rooms[0].group.children.length, 0, 'no furniture or contact shadow remains in the static bake');
  extra.getWorldPosition(before);
  const x = desk.x, z = desk.z, shadow = desk.group.children.find(o => o.renderOrder === 1);
  assert.ok(shadow?.geometry.attributes.color, 'its contact shadow has its own carried geometry');
  assert.equal(desk.translate(.6, -.2), true);
  const after = extra.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(after.x - before.x - .6) < 1e-6 && Math.abs(after.z - before.z + .2) < 1e-6);
  assert.equal(desk.x, x + .6); assert.equal(desk.z, z - .2);
  assert.equal(use.wx, desk.x); assert.equal(use.wz, desk.z);
  assert.equal(desk.collider.x0, desk.x0);
  world.enter(world.rooms[0]);
  const me = { x: desk.x, z: desk.z + .4, yaw: 0 };
  assert.equal(world.usable(me), use);
  desk.away = 'hidden-face'; world.refreshFurniture();
  assert.equal(world.usable(me), null, 'a vanished desk cannot leave an invisible usable screen behind');
});

test('stack bases are fixed visibly while stray chairs of the same model still move', async t => {
  const world = await make(t, c => {
    c.prop('chair', -1, 0); c.prop('chair', -1, 0, { y: .7 }); c.prop('chair', 1, 0);
  });
  assert.equal(world.furniture.length, 1);
  assert.equal(world.furniture[0].x, 5);
  const anchors = world.rooms[0].group.children.find(mesh => !mesh.material.defines?.VOXEL && mesh.geometry.attributes.aAlb);
  assert.ok(anchors?.geometry.index.count > 0, 'the fixed stack base has visible steel anchor feet');
});

test('furniture authored into a transforming room face carries visible bolts in that same batch', async t => {
  const geometryCounts = [];
  for (const enabled of [false, true]) {
    let batch, holder, foot;
    const world = await make(t, c => {
      batch = new Batch(true);
      foot = c.prop('chair', 0, 0, { batch, solid: false, shadow: false });
      holder = c.dynamic(batch);
    }, { enabled });
    geometryCounts.push(batch.verts);
    assert.equal(world.furniture.length, 0, 'the room retains ownership of its changing face');
    assert.equal(holder.children[0].geometry.attributes.position.count, batch.verts);
    assert.equal(foot.fixed, enabled ? 'anchored' : undefined);
    assert.equal(world.rooms[0].group.children.length, 1, 'no immobile bolt mesh is left outside the moving holder');
  }
  assert.ok(geometryCounts[1] > geometryCounts[0], 'the flagged version adds visible anchoring geometry');
});

test('actual world collision accepts exact swept footprints and ignores only the requested identities', async t => {
  const world = await make(t, c => { c.prop('desk', 0, 0); c.solid(1.7, -.4, 1.8, .4); });
  const desk = world.furniture[0], body = { x: desk.x + 1.2, z: desk.z, r: .25 };
  world.bodies.push(body);
  assert.equal(world.free(desk.x, desk.z, 0, { bounds: desk, ignoreCollider: desk.collider }), true);
  const moved = { x0: desk.x0 + .3, x1: desk.x1 + .3, z0: desk.z0, z1: desk.z1 };
  assert.equal(world.free(desk.x + .3, desk.z, 0, { bounds: moved, ignoreCollider: desk.collider }), false, 'edge of the rectangle meets a body before its centre does');
  assert.equal(world.free(desk.x + .3, desk.z, 0, { bounds: moved, ignoreCollider: desk.collider, ignoreBody: body }), true);
  assert.equal(createFurnitureMotion(world).move(desk, .5, 0).moved, true, 'a swept move advances only as far as clear space');
  assert.ok(desk.x < 4.2);
  assert.ok(world.free(desk.x, desk.z, 0, { bounds: desk, ignoreCollider: desk.collider }));
});

test('furniture crosses a real flat doorway with collision, visibility, ownership and both nav grids intact', async t => {
  const world = await make(t, c => c.prop('desk', 0, 0), { rot: 1, two: true });
  const desk = world.furniture[0], motion = createFurnitureMotion(world);
  const initial = world.furnitureRevision.get(0);
  desk.translate(.01, 0);
  assert.equal(world.furnitureRevision.get(0), initial, 'sub-grid motion does not rebuild navigation every frame');
  let straddled = false;
  for (let i = 0; i < 12; i++) {
    assert.equal(motion.move(desk, .5, 0).moved, true);
    if (desk.room === 1 && desk.x0 < 7.75) {
      straddled = true;
      const point = toLocal(world.rooms[0].def, 7.75, desk.z);
      assert.equal(world.walkable(world.rooms[0]).free(point.x, point.z), false, 'a desk owned by the next room still blocks its footprint across this doorway');
    }
  }
  assert.equal(straddled, true, 'the test crossed the ownership boundary with part of the desk still behind');
  assert.ok(desk.x > 8);
  assert.equal(desk.room, 1);
  assert.ok(world.rooms[1].colliders.includes(desk.collider));
  assert.ok(!world.rooms[0].colliders.includes(desk.collider));
  assert.ok(world.furnitureRevision.get(0) > 0 && world.furnitureRevision.get(1) > 0);
  world.rooms[0].group.visible = false; world.rooms[1].group.visible = true;
  desk.translate(.05, 0);
  assert.equal(desk.group.visible, true, 'culling its original room does not hide a carried desk');
  assert.equal(world.free(desk.x, desk.z, .1, { ghost: true }), false);
  assert.equal(world.walkable(world.rooms[1]).free(desk.x - 12, desk.z - 4), false);
  const revision = world.furnitureRevision.get(1);
  assert.equal(desk.translate(0, 0), false); assert.equal(desk.translate(NaN, 0), false);
  assert.equal(world.furnitureRevision.get(1), revision);
  desk.collider.on = false;
  desk.translate(.001, 0);
  assert.equal(desk.collider.on, true);
  assert.ok(world.furnitureRevision.get(1) > revision, 'restored collision invalidates immediately, even below 5cm');
  const restored = world.furnitureRevision.get(1);
  desk.collider.on = false; world.touchFurniture(desk);
  assert.ok(world.furnitureRevision.get(1) > restored, 'explicit rollback can invalidate its restored collider state');
  desk.away = 'room-face'; desk.group.visible = false;
  world.enter(world.rooms[1]); world.glimpse(desk.x, desk.z, 12);
  assert.equal(desk.group.visible, false, 'room culling never resurrects furniture taken out of a transforming face');
  assert.equal(desk.translate(.1, 0), false);
});
