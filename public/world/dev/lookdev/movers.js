// Round two's things that move: a blocky figure (standing, or caught mid-stride) and an office chair being dragged,
// built from kit boxes and lit the way the level lights what moves (world.lightAt where it stands: one tint for the
// whole thing, no shadow of its own on anything). Hand-built for the lab: the level's own creatures are voxel models,
// and what is tried here is the shadow they would throw, not the creature. Also the held torch, in the corner of the
// picture, drawn in front of the room exactly as hand.js draws what is held.
import * as THREE from 'three';
import { Batch, lin } from '../../backrooms/kit.js';
import { holdInFront, letGoOfFront } from '../../backrooms/hand.js';
import { INVENTORY_MODELS, sculptTorchGrip } from '../../backrooms/inventory-items.js';

/** The layer the movers are also on: what the movers' own shadow pictures draw (look2.js). */
export const MOVER_LAYER = 3;

function part(kit, box, rgb) {
  const b = new Batch();
  b.box(...box, rgb);
  const mesh = new THREE.Mesh(kit.geometry(b, [], [1, 1, 1]), kit.surface({ map: kit.tex.white() }));
  mesh.layers.enable(MOVER_LAYER);
  return mesh;
}

/**
 * A figure 1.78 m tall, in blocks. `stride` 0 stands, 1 is caught mid-stride (one leg forward, the other pushing off,
 * the arms the other way). Faces local -z. → { group, meshes, light(rgb) }
 */
export function figure(kit, stride = 0) {
  const g = new THREE.Group(), meshes = [];
  const coat = lin('#4d4943'), trousers = lin('#34322f'), skin = lin('#8d7663'), shoe = lin('#1e1d1c');
  const add = (parent, box, rgb, at = [0, 0, 0]) => { const m = part(kit, box, rgb); m.position.set(...at); parent.add(m); meshes.push(m); return m; };
  const joint = (parent, at, rx = 0) => { const j = new THREE.Group(); j.position.set(...at); j.rotation.x = rx; parent.add(j); return j; };
  const s = stride, swing = 0.42 * s;
  // legs: a hip joint at 0.9 m, the knee at 0.47 m below it
  for (const [side, dir] of [[-1, 1], [1, -1]]) {
    const hip = joint(g, [side * 0.1, 0.92, 0], -swing * dir);
    add(hip, [-0.075, -0.46, -0.08, 0.075, 0, 0.08], trousers);
    const knee = joint(hip, [0, -0.46, 0], dir < 0 ? 0.55 * s : 0.08 * s);
    add(knee, [-0.07, -0.42, -0.075, 0.07, 0, 0.075], trousers);
    add(knee, [-0.075, -0.46, -0.13, 0.075, -0.4, 0.07], shoe);
  }
  add(g, [-0.2, 0.88, -0.12, 0.2, 1.48, 0.12], coat);                     // body
  add(g, [-0.06, 1.48, -0.06, 0.06, 1.55, 0.06], skin);                   // neck
  add(g, [-0.11, 1.55, -0.12, 0.11, 1.78, 0.11], skin);                   // head
  for (const [side, dir] of [[-1, -1], [1, 1]]) {
    const sh = joint(g, [side * 0.27, 1.44, 0], -swing * dir * 0.8);
    add(sh, [-0.06, -0.32, -0.065, 0.06, 0.04, 0.065], coat);
    const el = joint(sh, [0, -0.31, 0], -0.25 * s - 0.05);
    add(el, [-0.055, -0.3, -0.06, 0.055, 0, 0.06], coat);
    add(el, [-0.045, -0.39, -0.05, 0.045, -0.3, 0.05], skin);
  }
  return { group: g, meshes, light(rgb) { for (const m of meshes) m.material.uniforms.uTint.value.set(...rgb); } };
}

/** An office chair on five casters, being pulled backwards by its back (tipped a little toward whoever pulls it). */
export function chair(kit) {
  const g = new THREE.Group(), meshes = [];
  const seat = lin('#3a434f'), steel = lin('#2c2d30');
  const add = (box, rgb) => { const m = part(kit, box, rgb); g.add(m); meshes.push(m); return m; };
  add([-0.24, 0.44, -0.24, 0.24, 0.52, 0.24], seat);
  add([-0.23, 0.56, 0.2, 0.23, 1.02, 0.27], seat);
  add([-0.03, 0.5, 0.21, 0.03, 0.58, 0.25], steel);
  add([-0.03, 0.08, -0.03, 0.03, 0.44, 0.03], steel);
  for (let i = 0; i < 5; i++) {
    const m = add([-0.025, 0.04, 0, 0.025, 0.08, 0.3], steel); m.rotation.y = (i / 5) * Math.PI * 2;
    const w = add([-0.025, 0, 0.25, 0.025, 0.05, 0.31], steel); w.rotation.y = m.rotation.y;
  }
  g.rotation.x = -0.06;                                                 // (its front casters just off the floor)
  return { group: g, meshes, light(rgb) { for (const m of meshes) m.material.uniforms.uTint.value.set(...rgb); } };
}

/** The level's own round blot under a dragged chair (world.js c.shadow: 0.24 m larger than the thing, at 0.5). */
export function blot(kit, w, d) {
  const q = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
  q.rotation.x = -Math.PI / 2; q.renderOrder = 1;
  return q;
}

/**
 * The torch in the hand, in the corner of the picture, as hand.js draws it: in front of the room, into the nearest
 * sliver of the depth range wherever a depth texture is being read. → the mesh (a child of a group that follows the camera)
 */
export function heldTorch(kit, camera, root, rgb = [0.5, 0.48, 0.44]) {
  const b = new Batch(false), s = (kit.VOXEL || 0.025) * 0.46;
  INVENTORY_MODELS.torch.sculpt(b, s, { grounded: false, held: true });
  sculptTorchGrip(b, s);
  const mat = kit.surface({ vox: false }), mesh = new THREE.Mesh(kit.geometry(b, [], [1, 1, 1]), mat);
  mat.transparent = true; mesh.renderOrder = 10000;
  mesh.rotation.set(0.12, 0.22, -0.08);
  mesh.position.set(0.24, -0.22, -0.5);
  mesh.onBeforeRender = (renderer) => holdInFront(renderer);
  mesh.onAfterRender = letGoOfFront;
  mesh.userData.held = true;
  mat.uniforms.uTint.value.set(...rgb);
  const holder = new THREE.Group(); holder.add(mesh); root.add(holder);
  holder.position.copy(camera.position).sub(root.position); holder.quaternion.copy(camera.quaternion); holder.updateMatrixWorld(true);
  return mesh;
}
