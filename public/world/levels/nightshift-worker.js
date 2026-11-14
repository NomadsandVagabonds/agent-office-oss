// Rigid voxel parts, articulated at hips, knees, shoulders and elbows.
// Crouching folds the same employee into cover; no body part changes size.
import * as THREE from 'three';
import { workerHead, workerBody, workerLimb, workerFoot, WORKER_PARTS } from './nightshift-props.js';
import { PLAYER } from '/core/nightshift-game.mjs';

export function createWorker(w) {
  const root = new THREE.Group(), torso = new THREE.Group();
  root.name = 'nightshift-worker'; torso.name = 'torso';
  w.scene.add(root); root.add(torso);
  function mesh(model, parent) { const node = w.vox(model, 0, 0, 'S'); parent.add(node); return node; }
  // You came back for your badge: the jacket has no ID on it until the access card is in hand.
  const jacket = mesh(() => workerBody({ badge: false }), torso), badged = mesh(workerBody, torso);
  const head = mesh(workerHead, torso); head.name = 'head'; head.position.y = 0.425;
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group(), knee = new THREE.Group(); root.add(hip); hip.add(knee);
    mesh(() => workerLimb({ leg: true, part: 'upper' }), hip);
    mesh(() => workerLimb({ leg: true, part: 'lower' }), knee);
    knee.position.y = -0.175;
    const foot = mesh(workerFoot, root);
    return { hip, knee, foot, side };
  });
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group(), elbow = new THREE.Group(); torso.add(shoulder); shoulder.add(elbow);
    mesh(() => workerLimb({ part: 'upper' }), shoulder);
    mesh(() => workerLimb({ part: 'lower' }), elbow);
    shoulder.position.set(0, 0.36, side * 0.16); elbow.position.y = -0.175;
    return { shoulder, elbow, side };
  });
  let fold = 0;
  const size = PLAYER.height / WORKER_PARTS.height;
  function update(state, dt, reducedMotion) {
    fold += (Number(state.crouching) - fold) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 24));
    const moving = state.grounded && Math.abs(state.vx) > 0.05 && !reducedMotion;
    const phase = state.time * (state.crouching ? 7 : 10);
    const hipX = -0.12 * fold, hipY = 0.425 - 0.18 * fold - (moving ? 0.018 * (1 - fold) : 0);
    const lean = -1.15 * fold;
    root.position.set(state.x, state.y, 1.1); root.rotation.y = state.facing * 0.3;
    root.scale.set(state.facing * size, size, size); root.visible = state.stage !== 'caught';
    torso.position.set(hipX, hipY, 0); torso.rotation.z = lean;
    head.rotation.z = -lean - 0.06 * fold;
    badged.visible = !!state.keycard; jacket.visible = !state.keycard;

    // Two-bone IK plants both feet during a crouch and keeps the knees forward.
    for (const { hip, knee, foot, side } of legs) {
      const wave = moving ? Math.sin(phase + (side > 0 ? Math.PI : 0)) : 0;
      const x = hipX + side * 0.065, footX = x + wave * (0.16 - 0.08 * fold);
      const footY = 0.05 + Math.max(0, wave) * (0.045 - 0.025 * fold);
      hip.position.set(x, hipY, side * 0.065);
      foot.position.set(footX, footY, side * 0.065);
      const dx = footX - x, dy = footY - hipY;
      const distance = Math.max(0.03, Math.min(0.375, Math.hypot(dx, dy))), ux = dx / Math.hypot(dx, dy), uy = dy / Math.hypot(dx, dy);
      const along = (0.175 ** 2 - 0.2 ** 2 + distance ** 2) / (2 * distance);
      const bend = Math.sqrt(Math.max(0, 0.175 ** 2 - along ** 2));
      const kx = ux * along - uy * bend, ky = uy * along + ux * bend;
      const upper = Math.atan2(kx, -ky), lower = Math.atan2(dx - kx, -(dy - ky));
      hip.rotation.z = upper; knee.rotation.z = lower - upper;
    }
    for (const { shoulder, elbow, side } of arms) {
      const swing = moving ? Math.sin(phase + (side > 0 ? Math.PI : 0)) * 0.3 * (1 - fold) : 0;
      shoulder.rotation.z = -lean + 0.2 * fold + swing;
      elbow.rotation.z = 1.1 * fold;
    }
  }
  return { root, update };
}
