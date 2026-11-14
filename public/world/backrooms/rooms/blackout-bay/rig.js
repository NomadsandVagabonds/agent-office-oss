// Voxel rig for The Stand-Ins: uncanny, stretched fake versions of the real
// office's staff (`c.env.cast`) standing in the dark of Blackout Bay. Built
// from `avatar/build.js` so they wear familiar outfits, hair, and species
// silhouettes — but elongated, slack-jawed, neck-cocked, with pale pinprick
// eyes gleaming before your flashlight beam hits them.
import * as THREE from 'three';
import { M, glow } from '../../../vox/vox.js';
import { buildCharacter, JOINT } from '../../../avatar/build.js';
import { Batch, lamp } from '../../kit.js';

const SX = 0.023, SY = 0.032, SZ = 0.023;

function uncannyFace(head) {
  const voidCol = M('#09080c', 0), eyeGlow = glow('#dcead0');
  const frontZ = (x, y) => {
    for (let z = 13; z >= 4; z--) if (head.has(x, y, z)) return z;
    return 8;
  };
  // Hollow out sunken eye sockets on the front surface of whatever species this is
  for (const cx of [-4, 4]) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 2; dy++) {
      const x = cx + dx, y = 43 + dy, z = frontZ(x, y);
      head.set(x, y, z, voidCol);
    }
    const ez = frontZ(cx, 44);
    head.set(cx, 44, ez, eyeGlow);
  }
  // Slack, elongated dark mouth
  for (let x = -2; x <= 2; x++) for (let y = 36; y <= 39; y++) {
    if (Math.abs(x) === 2 && (y === 36 || y === 39)) continue;
    const z = frontZ(x, y);
    head.set(x, y, z, voidCol);
  }
}

function jointMatrix(pivot, rx, ry, rz, sy = 1) {
  const mRoot = new THREE.Matrix4().makeScale(SX, SY, SZ);
  const tPos = new THREE.Matrix4().makeTranslation(pivot[0], pivot[1], pivot[2]);
  const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  const stretch = new THREE.Matrix4().makeScale(1, sy, 1);
  const tNeg = new THREE.Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]);
  return mRoot.multiply(tPos).multiply(rot).multiply(stretch).multiply(tNeg);
}

export function buildStandIn(kit, who, idx = 0) {
  const keyBase = `standin:${who.name || idx}:${idx}`;
  const sign = idx % 2 === 0 ? 1 : -1;
  const parts = buildCharacter(who.look, { seed: `standin:${who.name}:${idx}` });
  uncannyFace(parts.head);

  const b = new Batch(true);
  const rootM = new THREE.Matrix4().makeScale(SX, SY, SZ);
  const addPart = (sub, vox, mat4) => {
    if (!vox) return;
    const geo = kit.model(`${keyBase}:${sub}`, () => vox);
    if (geo?.solid) b.addVox(geo.solid, mat4);
  };

  // Sharp, wrong neck tilt + slight hunch
  const headM = jointMatrix(JOINT.head, 0.14, sign * 0.12, sign * 0.38, 1.04);
  addPart('head', parts.head, headM);
  if (parts.accessory) addPart('acc', parts.accessory, headM);

  const torsoM = jointMatrix(JOINT.hips, 0.06, 0, -sign * 0.05, 1.06);
  addPart('torso', parts.torso, torsoM);

  // Long dangling arms reaching past the knees
  const armLM = jointMatrix(JOINT.shoulderL, -0.16, 0, -0.09, 1.28);
  const armRM = jointMatrix(JOINT.shoulderR, -0.08, 0, 0.11, 1.24);
  addPart('armUL', parts.armUpperL, armLM);
  addPart('armLL', parts.armLowerL, armLM);
  addPart('armUR', parts.armUpperR, armRM);
  addPart('armLR', parts.armLowerR, armRM);

  addPart('legUL', parts.legUpperL, rootM);
  addPart('legLL', parts.legLowerL, rootM);
  addPart('legUR', parts.legUpperR, rootM);
  addPart('legLR', parts.legLowerR, rootM);

  // Very dim ambient so unlit silhouettes stay shadowy while uTorch spotlights full colour
  const lights = [lamp(0, 2.2, 0.6, [0.03, 0.03, 0.04], { k: 6, wrap: 0.6, far: 18 })];
  const amb = [0.012, 0.012, 0.016];
  const mat = kit.surface({ vox: true });
  const mesh = new THREE.Mesh(kit.geometry(b, lights, amb), mat);
  const group = new THREE.Group();
  group.add(mesh);

  return {
    group,
    mesh,
    light(rgb) {
      // Keep uTint >= 0.42 so pinprick eyes gleam faintly in total darkness while body stays dark until torched
      mat.uniforms.uTint.value.set(
        Math.max(0.42, rgb[0]),
        Math.max(0.42, rgb[1]),
        Math.max(0.45, rgb[2]),
      );
    },
  };
}
