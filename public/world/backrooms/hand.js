// The Backrooms — the hand, in a room: things left lying for the visitor to
// pick up, and a model of one to stand about as set dressing. What is carried
// is the pockets' business (inventory*.js); what a resident asks about it is
// items.js. This is the part of the two that needs three.js.
import * as THREE from 'three';
import { Batch, lamp, drawText } from './kit.js';
import { INVENTORY_MODELS } from './inventory-items.js';
import { Vox, M } from '../vox/vox.js';
import { KINDS, ITEM_IDS, isPaper, isBalloon, isFlashlight, createHandOver } from './items.js';

export { ITEM_IDS, isPaper, isBalloon, isFlashlight };

/** A right glove around the torch's rear grip; the sleeve continues off the picture. Held view only. */
function torchGrip() {
  const v = new Vox(), glove = M('#ac9c7d', 2), seam = M('#81765f', 2), knuckle = M('#c2b293', 2);
  const sleeve = M('#465256', 3), cuff = M('#697371', 3), fold = M('#384446', 3);
  v.rbox(3, -2, 1, 7, 5, 8, 1, glove);                     // palm on the right of the handle
  for (const z of [1, 3, 5]) {                             // fingers curl underneath, up the far side
    v.box(-4, -2, z, 5, 1, z + 2, glove);
    v.box(-5, 0, z, -3, 4, z + 2, knuckle);
    v.box(-4, -2, z, 4, -1, z + 1, seam);
  }
  v.box(2, 4, 3, 6, 7, 7, glove);                         // thumb rests behind the switch
  v.box(0, 6, 3, 4, 8, 5, knuckle);
  v.rbox(3, -5, 6, 9, 1, 12, 1, glove);
  v.rbox(4, -8, 8, 11, -2, 15, 1, cuff);
  v.rbox(6, -12, 11, 15, -5, 21, 1, sleeve);
  v.rbox(10, -20, 17, 22, -9, 31, 1, sleeve);
  v.box(7, -11, 13, 8, -6, 19, fold);
  v.box(17, -17, 20, 19, -11, 28, fold);
  return v;
}

/** Pinch the bottom of the balloon string; the wrist runs out of the frame. */
function balloonGrip() {
  const v = new Vox(), glove = M('#ac9c7d', 2), knuckle = M('#c2b293', 2), cuff = M('#697371', 3), sleeve = M('#465256', 3);
  v.rbox(-3, -6, -2, 5, 0, 5, 1, glove);
  v.box(-2, -2, -2, 1, 2, 0, knuckle);
  v.box(1, -3, 0, 4, 1, 3, knuckle);
  v.rbox(0, -10, 2, 7, -4, 9, 1, cuff);
  v.rbox(2, -22, 5, 13, -8, 20, 1, sleeve);
  v.rbox(7, -36, 14, 20, -18, 33, 1, sleeve);
  return v;
}

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
  const kit = env.kit, root = new THREE.Group(), made = new Map(), at = new THREE.Vector3(), rest = new THREE.Vector3();
  let shown = null, type = null, t = 0, swing = 0, jabT = 0, layoutKey = '';
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
    // (near enough to read, far enough not to stand between the visitor and the room: about a ninth of the picture, in its corner)
    return { mesh, mat, hold: [0.215, -0.085, -0.56] };
  }
  function model(kind) {
    if (kind === 'pink-slip') return slip();
    const b = new Batch(true), s = (kit.VOXEL || 0.025) * (kind === 'balloon' ? 0.36 : 0.46);
    const item = kit.model(`inventory:${kind}:v1`, INVENTORY_MODELS[kind]).solid, scale = new THREE.Matrix4().makeScale(s, s, s);
    b.addVox(item, scale);
    if (kind === 'torch') b.addVox(kit.model('hand:torch-grip:v1', torchGrip).solid, scale);
    if (kind === 'balloon') b.addVox(kit.model('hand:balloon-grip:v1', balloonGrip).solid, scale);
    const mat = kit.surface({ vox: true }), mesh = new THREE.Mesh(kit.geometry(b, [lamp(-1, 3, 1, [0.4, 0.4, 0.4], { k: 8, far: 12, wrap: 0.5 })], [0.8, 0.8, 0.8]), mat);
    if (kind === 'torch' || kind === 'balloon') {
      // The torch points down camera -Z; the balloon rises above its grip.
      mesh.rotation.set(...(kind === 'balloon' ? [0, -.12, 0] : [0.12, 0.22, -0.08]));
      // A first-person grip is drawn over the room: pressing against a wall
      // must not cut the held item or the visitor's fingers out of the frame.
      mat.transparent = true;
      mesh.renderOrder = 10000;
      item.computeBoundingBox();
      return { mesh, mat, hold: kind === 'balloon' ? [.22, -.25, -.6] : [0.24, -0.22, -0.5], fitBounds: item.boundingBox.clone().applyMatrix4(scale) };
    }
    mesh.rotation.set(0.25, -0.6, kind === 'paper' ? -0.2 : 0);
    return { mesh, mat, hold: [0.2, -0.12, -0.5] };
  }
  function fitPicture() {
    const p = env.vhs.picture, focal = p.h * camera.projectionMatrix.elements[5] / 2;
    const key = `${type}:${p.w}:${p.h}:${focal}`;
    if (key === layoutKey) return;
    layoutKey = key; rest.fromArray(shown.hold); shown.mesh.scale.setScalar(1);
    if (p.w > 520 || p.h <= 1) return;
    // The narrow HUD has 54px pockets, a 10px gap and a 17px caption band.
    // Keep a further 12px clear, plus room for walking bob and balloon sway.
    const pad = 10, right = p.w * .94 - pad, top = p.h * .16 + pad;
    const bottom = p.h * (p.h <= 430 ? .96 : .97) - 54 - 10 - 17 - 12 - pad;
    if (!shown.bounds) {
      shown.mesh.geometry.computeBoundingBox();
      // A sleeve must leave the frame, not be shrunk into another floating
      // object. On phones fit the torch itself above the pockets, as before.
      const bounds = shown.fitBounds || shown.mesh.geometry.boundingBox;
      shown.bounds = new THREE.Box3();
      const r = shown.mesh.rotation;
      for (const z of type === 'balloon' ? [-.09, 0, .21] : [r.z]) {
        const turn = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r.x, r.y, z));
        shown.bounds.union(bounds.clone().applyMatrix4(turn));
      }
      shown.extent = shown.bounds.getSize(new THREE.Vector3());
    }
    const b = shown.bounds, size = shown.extent, depth = -shown.hold[2], near = Math.max(0, b.max.z);
    const width = Math.max(1, p.w * .38 - pad * 2), height = Math.max(1, bottom - top);
    // Fit against the nearest depth so perspective cannot push a corner into
    // the HUD. Only this small mesh scales; its distance from the camera stays put.
    const scale = Math.min(1, width * depth / (size.x * focal + width * near), height * depth / (size.y * focal + height * near));
    shown.mesh.scale.setScalar(scale);
    rest.x = (right - p.w / 2) / focal * (depth - b.max.z * scale) - b.max.x * scale;
    const bottomY = (p.h / 2 - bottom) / focal;
    rest.y = bottomY * (depth - (bottomY < 0 ? b.max.z : b.min.z) * scale) - b.min.y * scale;
  }
  const view = {
    /** Every frame, for the part somebody is in. show: false while the bag is open, somebody is being carried, or the tape is ending. */
    update(dt, show) {
      const item = show ? env.inventory?.held?.() ?? null : null, want = item && INVENTORY_MODELS[item.type] ? item.type : null;
      if (want !== type) {
        if (shown) shown.mesh.visible = false;
        type = want; shown = null;
        if (want) {
          if (!made.has(want)) {
            const m = model(want);
            m.mesh.onBeforeRender = renderer => {
              if (camera.userData.hand !== view) root.visible = false;
              // Keep the grip's own depth (fingers behind the handle), but discard
              // the room's depth before drawing this final first-person mesh.
              else if (want === 'torch' || want === 'balloon') {
                // The previous transparent room mesh may have disabled depth writes;
                // WebGL also applies that mask to clear(), before our material is set.
                renderer.state.buffers.depth.setMask(true);
                renderer.clearDepth();
              }
            };
            made.set(want, m); root.add(m.mesh);
          }
          shown = made.get(want); shown.mesh.visible = true;
        }
      }
      root.visible = !!shown;
      if (!shown) return;
      if (!root.parent) env.world.scene.add(root);
      // Two parts can be alive together. Hide the previous hand before Three
      // builds its draw list, rather than relying on a late render callback.
      if (camera.userData.hand !== view) camera.userData.hand?.hide();
      camera.userData.hand = view;
      fitPicture();
      const me = env.player.me, pace = Math.min(1, (me.speed || 0) / 2);
      t += dt * (1 + pace * 5); swing += (pace - swing) * (1 - Math.exp(-6 * dt));
      if (jabT > 0) jabT = Math.max(0, jabT - dt / 0.28);
      root.position.copy(camera.position).sub(env.world.scene.position); root.quaternion.copy(camera.quaternion);
      at.set(rest.x + Math.sin(t * 1.1) * 0.006 * swing, rest.y + Math.abs(Math.sin(t * 1.1)) * 0.014 * swing + Math.sin(t * 0.35) * 0.003, rest.z);
      if (type === 'scissors') {
        const u = jabT > 0 ? 1 - jabT : 0;
        const thrust = u > 0 ? Math.sin(Math.pow(u, 0.55) * Math.PI) : 0;
        at.x -= thrust * 0.088;
        at.y += thrust * 0.045;
        at.z -= thrust * 0.165;
        shown.mesh.rotation.set(0.25 - thrust * 0.56, -0.6 + thrust * 0.36, thrust * 0.4);
      }
      shown.mesh.position.copy(at);
      if (type === 'balloon') shown.mesh.rotation.z = Math.sin(t * 0.5) * 0.09 + swing * 0.12;
      // lit by where you are standing — and a torch that is switched on is its own light
      const L = env.world.lightAt(me.x, me.z, 1.2), on = type === 'torch' && item.lit, k = on ? 1.45 : 1.25, floor = on ? 0.22 : 0.16;
      shown.mat.uniforms.uTint.value.set(Math.max(floor, L[0] * k) * (on ? 1.1 : 1), Math.max(floor, L[1] * k), Math.max(floor, L[2] * k) * (on ? 0.85 : 1));
    },
    hide() { root.visible = false; },
    jab() { jabT = 1; },
    dispose() { root.removeFromParent(); if (camera.userData.hand === view) camera.userData.hand = null; },
  };
  env.handView = view;
  return view;
}

/** One of a thing, as a model with nothing to do: for a room to stand about. `light(rgb)` tints it. */
export function buildItemProp(kit, kind) {
  const type = INVENTORY_MODELS[kind] ? kind : (KINDS[kind] || 'paper'), b = new Batch(true), s = kit.VOXEL || 0.025, group = new THREE.Group();
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
