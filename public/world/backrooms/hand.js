// The Backrooms — the hand, in a room: things left lying for the visitor to
// pick up, and a model of one to stand about as set dressing. What is carried
// is the pockets' business (inventory*.js); what a resident asks about it is
// items.js. This is the part of the two that needs three.js.
import * as THREE from 'three';
import { Batch, lamp, drawText, lin } from './kit.js';
import { handAt, showing } from './shove-hands.rule.js';
import { INVENTORY_MODELS, sculptTorchGrip } from './inventory-items.js';
import { Vox, M } from '../vox/vox.js';
import { KINDS, ITEM_IDS, isPaper, isBalloon, isFlashlight, createHandOver } from './items.js';
import { heldScissors } from './hand-scissors.js';

export { ITEM_IDS, isPaper, isBalloon, isFlashlight };

const ITEM_LIGHTS = () => [
  lamp(-1.4, 3.2, 1.6, [0.48, 0.46, 0.42], { k: 10, far: 14, wrap: 0.45 }),
  lamp(1.8, 1.9, -1.6, [0.20, 0.22, 0.26], { k: 10, far: 14, wrap: 0.35 }),
];
const ITEM_AMB = [0.78, 0.78, 0.80];

function boundsFromBatch(b) {
  const box = new THREE.Box3(), v = new THREE.Vector3();
  for (let i = 0; i < b.pos.length; i += 3) box.expandByPoint(v.set(b.pos[i], b.pos[i + 1], b.pos[i + 2]));
  return box;
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

/*
 * How a held thing gets in front of the room. As it always was: the room's depth is cleared, then the thing is drawn.
 * But when the picture is drawn into a target with a depth texture, somebody reads that depth after the scene is drawn
 * (the Graphics setting's haze: vhs.js, medium and high), and clearing it would leave the whole room reading as the
 * void, unhazed, for as long as anything is in the hand. Then the thing is drawn into the nearest sliver of the depth
 * range instead: in front of everything, its own parts still in order, read by the haze as nearer than the haze begins,
 * and the room's depth left as it was. Classic has no depth texture, so it never takes this path.
 */
export const HELD_DEPTH_SLIVER = 0.002;
let squeezed = false;
/** Before a held mesh draws. `first`: the mesh that, as before, clears the room's depth when nothing reads it. */
export function holdInFront(renderer, first = true) {
  if (renderer.getRenderTarget?.()?.depthTexture) { renderer.getContext().depthRange(0, HELD_DEPTH_SLIVER); squeezed = true; return 'sliver'; }
  if (!first) return 'as-drawn';
  // The previous transparent room mesh may have disabled depth writes;
  // WebGL also applies that mask to clear(), before our material is set.
  renderer.state.buffers.depth.setMask(true);
  renderer.clearDepth();
  return 'cleared';
}
/** After a held mesh draws: the depth range back to whole, if holdInFront narrowed it. */
export function letGoOfFront(renderer) {
  if (squeezed) { renderer.getContext().depthRange(0, 1); squeezed = false; }
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
  let shown = null, type = null, t = 0, swing = 0, layoutKey = '';
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
    mat.transparent = true; mesh.renderOrder = 10000;                       // (drawn over the room, as every held thing is: see onBeforeRender below)
    // (near enough to read, far enough not to stand between the visitor and the room: about a ninth of the picture, in its corner)
    return { mesh, mat, hold: [0.215, -0.085, -0.56] };
  }
  function model(kind) {
    if (kind === 'pink-slip') return slip();
    if (kind === 'scissors') return heldScissors(kit, ITEM_LIGHTS(), ITEM_AMB);   // (a fist round them, and two halves on a pin: hand-scissors.js)
    const b = new Batch(false), s = (kit.VOXEL || 0.025) * (kind === 'balloon' ? 0.36 : 0.46);
    INVENTORY_MODELS[kind].sculpt(b, s, { grounded: false, held: true });
    const itemBounds = kind === 'torch' || kind === 'balloon' ? boundsFromBatch(b) : null;
    if (kind === 'torch') sculptTorchGrip(b, s);
    const mat = kit.surface({ vox: false }), mesh = new THREE.Mesh(kit.geometry(b, ITEM_LIGHTS(), ITEM_AMB), mat);
    if (kind === 'balloon') {
      // The glove and the string it holds are a voxel model (the party's own): a mesh of their own, on the same hand.
      const g = new Batch(true); g.addVox(kit.model('hand:balloon-grip:v1', balloonGrip).solid, new THREE.Matrix4().makeScale(s, s, s));
      const gm = kit.surface({ vox: true }), grip = new THREE.Mesh(kit.geometry(g, [lamp(-1, 3, 1, [0.4, 0.4, 0.4], { k: 8, far: 12, wrap: 0.5 })], [0.8, 0.8, 0.8]), gm);
      gm.transparent = true; grip.renderOrder = 10000; mesh.add(grip);
    }
    if (kind === 'torch' || kind === 'balloon') {
      // The torch points down camera -Z (its lens is local -Z, like the camera's); the balloon rises above its grip.
      mesh.rotation.set(...(kind === 'balloon' ? [0, -.12, 0] : [0.12, 0.22, -0.08]));
      // A first-person grip is drawn over the room: pressing against a wall
      // must not cut the held item or the visitor's fingers out of the frame.
      mat.transparent = true;
      mesh.renderOrder = 10000;
      return { mesh, mat, hold: kind === 'balloon' ? [.22, -.25, -.6] : [0.24, -0.22, -0.5], fitBounds: itemBounds };
    }
    mesh.rotation.set(0.25, -0.6, kind === 'paper' ? -0.2 : 0);
    // Held 0.5 m in front of a camera that can be 0.22 m from a wall: like the torch and the balloon, it is drawn over the
    // room (last, with the room's depth discarded), or the wall would hide it whenever the visitor stood close to one.
    mat.transparent = true;
    mesh.renderOrder = 10000;
    return { mesh, mat, hold: [0.2, -0.12, -0.5] };
  }
  /**
   * Both hands, for a shove (shove-hands.rule.js: where they go): a forearm in a sleeve coming up from below the frame, the back of a
   * hand held up flat with the fingers up and a thumb to the inside. Plain boxes, 84 triangles each, drawn over the room as every
   * held thing is. The left one is the right one mirrored.
   */
  let hands = null;
  function makeHands() {
    const skin = lin('#d6a883'), knuckle = lin('#c4916c'), sleeve = lin('#6f7681'), cuff = lin('#9aa0a8'), b = new Batch(false);
    b.box(-0.02, -0.022, 0.12, 0.02, 0.022, 0.24, sleeve);                  // the sleeve, back toward the camera
    b.box(-0.022, -0.024, 0.11, 0.022, 0.024, 0.13, cuff);                 // its cuff
    b.box(-0.024, -0.024, 0.0, 0.024, 0.024, 0.11, skin);                   // the wrist and forearm
    b.box(-0.04, -0.012, -0.05, 0.04, 0.095, 0.0, skin);                    // the back of the hand, standing up
    for (const x of [-0.03, -0.01, 0.01, 0.03]) b.box(x - 0.0085, 0.095, -0.045, x + 0.0085, 0.175 - Math.abs(x) * 0.8, -0.005, x === -0.03 || x === 0.03 ? skin : knuckle);   // four fingers
    b.box(-0.075, 0.015, -0.04, -0.042, 0.045, -0.012, skin);               // the thumb, to the inside
    const group = new THREE.Group(), made = [];
    for (const side of [-1, 1]) {
      const mat = kit.surface({ vox: false, side: THREE.DoubleSide }), mesh = new THREE.Mesh(kit.geometry(b, ITEM_LIGHTS(), ITEM_AMB), mat);
      mat.transparent = true; mesh.renderOrder = 10000; mesh.scale.x = side;                      // (the left is the right, turned over)
      mesh.onBeforeRender = (renderer) => { if (camera.userData.hand !== view) root.visible = false; else holdInFront(renderer); };
      mesh.onAfterRender = letGoOfFront;
      group.add(mesh); made.push({ side, mesh, mat });
    }
    group.visible = false; root.add(group);
    return { group, made };
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
      const item = show ? env.inventory?.held?.() ?? null : null;
      // (a pair coming apart goes on being shown until the blade has fallen, though the pockets have already let go of it)
      const want = item && INVENTORY_MODELS[item.type] ? item.type : show && made.get('scissors')?.busy() ? 'scissors' : null;
      if (want !== type) {
        if (shown) shown.mesh.visible = false;
        type = want; shown = null;
        if (want) {
          if (!made.has(want)) {
            const m = model(want);
            m.mesh.onBeforeRender = renderer => {
              if (camera.userData.hand !== view) root.visible = false;
              // Keep the grip's own depth (fingers behind the handle), but discard
              // the room's depth before drawing this final first-person mesh
              // (or, while the haze reads that depth, draw in front of it: holdInFront).
              else holdInFront(renderer);
            };
            m.mesh.onAfterRender = letGoOfFront;
            // (a part of it with a mesh of its own, the balloon's glove: in front of the room too, while the haze reads its depth)
            m.mesh.traverse((o) => { if (o !== m.mesh && o.isMesh) { o.onBeforeRender = (renderer) => holdInFront(renderer, false); o.onAfterRender = letGoOfFront; } });
            made.set(want, m); root.add(m.mesh);
          }
          shown = made.get(want); shown.mesh.visible = true;
        }
      }
      // a shove: both hands out and back, while the pulse lasts (and not with the scissors in the hand: that click is the jab)
      const meP = env.player.me, striking = show && showing(meP.punch || 0, { scissors: type === 'scissors' });
      if (striking && !hands) hands = makeHands();
      if (hands) {
        hands.group.visible = striking;
        if (striking) for (const h of hands.made) { const a = handAt(meP.punch, h.side); h.mesh.position.set(a.x, a.y, a.z); h.mesh.rotation.set(a.pitch, a.yaw, 0); }
      }
      root.visible = !!shown || striking;
      if (!shown && !striking) return;
      if (!root.parent) env.world.scene.add(root);
      // Two parts can be alive together. Hide the previous hand before Three
      // builds its draw list, rather than relying on a late render callback.
      if (camera.userData.hand !== view) camera.userData.hand?.hide();
      camera.userData.hand = view;
      if (!shown) {                                                  // (nothing in the hand: only the hands of a shove, lit like the rest)
        root.position.copy(camera.position).sub(env.world.scene.position); root.quaternion.copy(camera.quaternion);
        const L = env.world.lightAt(meP.x, meP.z, 1.2); for (const h of hands.made) h.mat.uniforms.uTint.value.set(Math.max(0.16, L[0] * 1.25), Math.max(0.16, L[1] * 1.25), Math.max(0.16, L[2] * 1.25));
        return;
      }
      fitPicture();
      const me = env.player.me, pace = Math.min(1, (me.speed || 0) / 2);
      t += dt * (1 + pace * 5); swing += (pace - swing) * (1 - Math.exp(-6 * dt));
      root.position.copy(camera.position).sub(env.world.scene.position); root.quaternion.copy(camera.quaternion);
      at.set(rest.x + Math.sin(t * 1.1) * 0.006 * swing, rest.y + Math.abs(Math.sin(t * 1.1)) * 0.014 * swing + Math.sin(t * 0.35) * 0.003, rest.z);
      if (type === 'scissors') shown.update(dt, at);           // (the jab, and how it went: hand-scissors.rule.js)
      else shown.mesh.position.copy(at);
      if (hands?.group.visible) { const L2 = env.world.lightAt(me.x, me.z, 1.2); for (const h of hands.made) h.mat.uniforms.uTint.value.set(Math.max(0.16, L2[0] * 1.25), Math.max(0.16, L2[1] * 1.25), Math.max(0.16, L2[2] * 1.25)); }
      if (type === 'balloon') shown.mesh.rotation.z = Math.sin(t * 0.5) * 0.09 + swing * 0.12;
      // lit by where you are standing — and a torch that is switched on is its own light
      const L = env.world.lightAt(me.x, me.z, 1.2), on = type === 'torch' && item.lit, k = on ? 1.45 : 1.25, floor = on ? 0.22 : 0.16;
      shown.mat.uniforms.uTint.value.set(Math.max(floor, L[0] * k) * (on ? 1.1 : 1), Math.max(floor, L[1] * k), Math.max(floor, L[2] * k) * (on ? 0.85 : 1));
    },
    hide() { root.visible = false; },
    /** The scissors' click: a jab starts. */
    jab() { made.get('scissors')?.jab(); },
    /** How the jab went, once it is known (inventory.js): { ok, snapped }. A hit, a miss and a break each look their own. */
    landed(result) { made.get('scissors')?.landed(result); },
    dispose() { hands = null; root.removeFromParent(); if (camera.userData.hand === view) camera.userData.hand = null; },
  };
  env.handView = view;
  return view;
}

/** One of a thing, as a model with nothing to do: for a room to stand about. `light(rgb)` tints it. */
export function buildItemProp(kit, kind) {
  const type = INVENTORY_MODELS[kind] ? kind : (KINDS[kind] || 'paper'), b = new Batch(false), s = kit.VOXEL || 0.025, group = new THREE.Group();
  INVENTORY_MODELS[type].sculpt(b, s, { grounded: true });
  const mat = kit.surface({ vox: false });
  group.add(new THREE.Mesh(kit.geometry(b, ITEM_LIGHTS(), ITEM_AMB), mat));
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
