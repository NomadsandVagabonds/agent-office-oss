// The Backrooms — the hand, in a room: things left lying for the visitor to
// pick up, and a model of one to stand about as set dressing. What is carried
// is the pockets' business (inventory*.js); what a resident asks about it is
// items.js. This is the part of the two that needs three.js.
import * as THREE from 'three';
import { Batch, lamp, drawText } from './kit.js';
import { INVENTORY_MODELS } from './inventory-items.js';
import { KINDS, ITEM_IDS, isPaper, isBalloon, isFlashlight, createHandOver } from './items.js';

export { ITEM_IDS, isPaper, isBalloon, isFlashlight };

/** Give a part of the building its hand (env.hand): the selected pocket, in the words its rooms use. */
export function createHand(env) {
  env.hand = createHandOver(() => env.inventory || null, `hand:${env.level.seed}:${env.level.depth ?? 0}`);
  return env.hand;
}

/**
 * What is in the selected pocket, held up in the corner of the picture: one small mesh, in front of the camcorder and to
 * the right. It bobs as you walk; a torch that is on is bright; a balloon pulls at its string; and a pink slip is held
 * where it can be read. Nothing on the pockets' own bar changes. Not drawn while the bag is open or the tape is ending.
 * (One to a part of the building: whichever was drawn last is the one on the picture.)
 */
export function createHandView(env, camera) {
  const kit = env.kit, root = new THREE.Group(), made = new Map(), at = new THREE.Vector3();
  let shown = null, type = null, t = 0, swing = 0;
  root.visible = false;
  /** FORM HR-404, as a sheet of paper held up: the one thing down here that is meant to be read. */
  function slip() {
    const tex = kit.tex.custom('hand:pink-slip:' + (env.who?.name || ''), 128, 168, (g) => {
      g.fillStyle = '#e9a7b7'; g.fillRect(0, 0, 128, 168); g.fillStyle = '#f4c2cf'; g.fillRect(0, 0, 6, 168);
      g.fillStyle = '#4a2f3a'; g.fillRect(10, 10, 108, 22);
      drawText(g, ['FORM HR-404'], 10, 11, 108, 20, { color: '#f4c2cf', size: 14 });
      drawText(g, ['NOTICE OF', 'REDUNDANCY'], 10, 38, 108, 34, { color: '#4a2f3a', size: 13 });
      g.fillStyle = '#8c5266'; for (const y of [84, 100, 116]) g.fillRect(12, y, 104, 1);
      drawText(g, [String(env.who?.name || 'EMPLOYEE').toUpperCase().slice(0, 16)], 12, 72, 104, 12, { color: '#4a2f3a', size: 9, weight: 400 });
      drawText(g, ['EFFECTIVE: LAST WEEK'], 12, 88, 104, 12, { color: '#4a2f3a', size: 8, weight: 400 });
      drawText(g, ['REASON: EFFICIENCY'], 12, 104, 104, 12, { color: '#4a2f3a', size: 8, weight: 400 });
      g.strokeStyle = '#8c5266'; g.strokeRect(70.5, 130.5, 46, 24);
      drawText(g, ['SIGN HERE'], 70, 156, 48, 9, { color: '#8c5266', size: 6, weight: 400 });
    }, { clamp: true });
    const b = new Batch(); b.quad([-0.085, -0.11, 0], [0.085, -0.11, 0], [0.085, 0.11, 0], [-0.085, 0.11, 0]);
    const mat = kit.surface({ map: tex, side: THREE.DoubleSide }), mesh = new THREE.Mesh(kit.geometry(b, [], [1, 1, 1]), mat);
    mesh.rotation.set(-0.12, -0.5, 0.1);
    return { mesh, mat, hold: [0.17, -0.035, -0.42] };
  }
  function model(kind) {
    if (kind === 'pink-slip') return slip();
    const b = new Batch(true), s = (kit.VOXEL || 0.025) * (kind === 'balloon' ? 0.26 : 0.46);
    b.addVox(kit.model(`inventory:${kind}:v1`, INVENTORY_MODELS[kind]).solid, new THREE.Matrix4().makeScale(s, s, s));
    const mat = kit.surface({ vox: true }), mesh = new THREE.Mesh(kit.geometry(b, [lamp(-1, 3, 1, [0.4, 0.4, 0.4], { k: 8, far: 12, wrap: 0.5 })], [0.8, 0.8, 0.8]), mat);
    mesh.rotation.set(0.25, kind === 'torch' ? 2.5 : -0.6, kind === 'paper' ? -0.2 : 0);
    return { mesh, mat, hold: kind === 'balloon' ? [0.24, -0.2, -0.56] : [0.2, -0.12, -0.5] };
  }
  const view = {
    /** Every frame, for the part somebody is in. show: false while the bag is open, somebody is being carried, or the tape is ending. */
    update(dt, show) {
      const item = show ? env.inventory?.held?.() ?? null : null, want = item && INVENTORY_MODELS[item.type] ? item.type : null;
      if (want !== type) {
        if (shown) shown.mesh.visible = false;
        type = want; shown = null;
        if (want) { if (!made.has(want)) { const m = model(want); m.mesh.onBeforeRender = () => { if (camera.userData.hand !== view) root.visible = false; }; made.set(want, m); root.add(m.mesh); } shown = made.get(want); shown.mesh.visible = true; }
      }
      root.visible = !!shown;
      if (!shown) return;
      if (!root.parent) env.world.scene.add(root);
      camera.userData.hand = view;
      const me = env.player.me, pace = Math.min(1, (me.speed || 0) / 2);
      t += dt * (1 + pace * 5); swing += (pace - swing) * (1 - Math.exp(-6 * dt));
      root.position.copy(camera.position).sub(env.world.scene.position); root.quaternion.copy(camera.quaternion);
      at.set(shown.hold[0] + Math.sin(t * 1.1) * 0.006 * swing, shown.hold[1] + Math.abs(Math.sin(t * 1.1)) * 0.014 * swing + Math.sin(t * 0.35) * 0.003, shown.hold[2]);
      shown.mesh.position.copy(at);
      if (type === 'balloon') shown.mesh.rotation.z = Math.sin(t * 0.5) * 0.09 + swing * 0.12;
      // lit by where you are standing — and a torch that is switched on is its own light
      const L = env.world.lightAt(me.x, me.z, 1.2), on = type === 'torch' && (env.inventory?.torchPower?.() ?? 0) > 0, k = on ? 2.4 : 1.25, floor = on ? 0.5 : 0.16;
      shown.mat.uniforms.uTint.value.set(Math.max(floor, L[0] * k) * (on ? 1.1 : 1), Math.max(floor, L[1] * k), Math.max(floor, L[2] * k) * (on ? 0.85 : 1));
    },
    dispose() { root.removeFromParent(); if (camera.userData.hand === view) camera.userData.hand = null; },
  };
  env.handView = view;
  return view;
}

/** One of a thing, as a model with nothing to do: for a room to stand about. `light(rgb)` tints it. */
export function buildItemProp(kit, kind) {
  const type = KINDS[kind] || 'paper', b = new Batch(true), s = kit.VOXEL || 0.025, group = new THREE.Group();
  b.addVox(kit.model(`inventory:${type}:v1`, INVENTORY_MODELS[type]).solid, new THREE.Matrix4().makeScale(s, s, s));
  const mat = kit.surface({ vox: true });
  group.add(new THREE.Mesh(kit.geometry(b, [lamp(-1, 3, 1, [0.4, 0.4, 0.4], { k: 8, far: 12, wrap: 0.5 })], [0.8, 0.8, 0.8]), mat));
  group.userData.light = (rgb) => mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
  return group;
}

/**
 * Leave something in a room for the visitor to pick up: at (x, z) in the room's own frame, `y` metres up (a desk top).
 * It goes down once the part is built and the pockets are hung (c.leave: world.js); a visit without pockets leaves nothing.
 * → { get(): the kind lying there until it is taken, as far as the room can know · set(kind): leave another }
 */
export function placePickup(c, kind, x, z, y = 0, opt = {}) {
  const type = KINDS[kind];
  let slot = type ? kind : null;
  if (type) c.leave(type, x, z, { y, quantity: opt.quantity ?? (type === 'paper' ? 3 : 1), taken: () => { slot = null; opt.onTake?.(kind, null); } });
  // a visit without pockets: the thing itself lies there, and E puts it in the one hand there is (items.js)
  if (type) {
    const prop = buildItemProp(c.kit, kind), w = c.toWorld(x, z);
    prop.position.set(x, y, z); prop.visible = false; c.add(prop);
    c.after.push(() => prop.userData.light(c.sample(x, y + 0.3, z).map((v) => Math.max(0.2, v))));
    c.tick(() => { prop.visible = !c.env.inventory && slot === kind; });
    c.use({ x, z, r: opt.r ?? 1.5, cone: opt.cone ?? 0.45, when: () => !c.env.inventory && slot === kind && c.env.hand?.get() === null,
      use: () => { if (c.env.hand.give(kind) === null) { slot = null; c.env.play(isPaper(kind) ? 'rustle' : 'click', w.x, w.z, 4); opt.onTake?.(kind, null); } } });
  }
  return { get: () => slot, set(next) { if (KINDS[next]) { slot = next; c.leave(KINDS[next], x, z, { y }); } else slot = null; } };
}
