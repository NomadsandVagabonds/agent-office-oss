// Voxel rigs for The Fun Committee: real upstairs Office staff (`avatar/build.js`
// hair, cardigans, hoodies, vests, lanyards, crooked birthday cones) whose upper
// faces are completely smooth, eyeless pallid skin and whose lower faces have
// been gouged ear-to-ear into a deep carved-in rictus smile.
//
// Two silhouettes:
//   - 'greeter': balanced motionless on one leg at the threshold, arms flung wide,
//                crimson-stained fingers holding a glossy red balloon aloft
//   - 'circle':  5 coworkers linked hand-in-hand in a ring, necks able to twist
//                over their own shoulders to face the visitor
import * as THREE from 'three';
import { Vox, M, tone } from '../../../vox/vox.js';
import { buildCharacter, JOINT } from '../../../avatar/build.js';
import { Batch, lamp } from '../../kit.js';
import {
  pallorLook, mottleHead, eyelessBrow, carvedSmile, carveCreases,
  slipRows, jointMat, localJointMat,
} from '../../uncanny.js';

const S = [0.0255, 0.028, 0.0255];

const STAFF = [
  { skin: '#e8cfa8', hair: 'short', hairColor: '#261e1a', outfit: 'cardigan', outfitColor: '#6bb59e', provider: 'claude' },
  { skin: '#eed6b5', hair: 'long', hairColor: '#cfa954', outfit: 'cardigan', outfitColor: '#d4796a', provider: 'gemini' },
  { skin: '#c89b78', hair: 'bun', hairColor: '#1d191b', outfit: 'vest', outfitColor: '#987ec2', provider: 'codex' },
  { skin: '#e0be99', hair: 'side', hairColor: '#543824', outfit: 'tee', outfitColor: '#d4b852', provider: 'claude' },
  { skin: '#d8b08c', hair: 'short', hairColor: '#753322', outfit: 'hoodie', outfitColor: '#6694bf', provider: 'opencode' },
  { skin: '#ecd2b4', hair: 'long', hairColor: '#2c201b', outfit: 'cardigan', outfitColor: '#c77f9e', provider: 'custom' },
];

function stainHands(armLower) {
  const stain = M('#4c151a', 1), dark = M('#2b0b0e', 1);
  armLower.paint(-12, 14, -3, 12, 17, 4, (x, y) => (y <= 15 ? dark : stain));
}

function crookedConeVox(tiltSign = 1) {
  const v = new Vox();
  for (let y = 0; y < 13; y++) {
    const r = Math.max(0.85, 5.8 * (1 - y / 13.4));
    const cx = -0.5 + tiltSign * (0.8 + y * 0.24);
    const band = Math.floor((y + 1) / 3) % 2 === 0;
    const base = M(band ? '#cf4b43' : '#dec047', 1);
    v.cyl('y', cx, -0.5, 51 + y, 52 + y, r, y < 2 ? tone(base, -0.18) : base);
  }
  v.sphere(-0.5 + tiltSign * 4.0, 64, -0.5, 1.7, M('#eae3d2', 2));
  return v;
}

function balloonVox(hx, hy, hz, bx, by, bz) {
  const v = new Vox();
  const red = M('#c81919', 1), hi = M('#f06868', 0), knot = M('#7c0d0d', 1), str = M('#d4cec0', 1);
  v.box(bx, hy, bz, bx + 1, by - 7, bz + 1, str);
  v.box(bx - 1, by - 8, bz - 1, bx + 1, by - 6, bz + 1, knot);
  v.ellipsoid(bx, by, bz, 5.6, 7.0, 5.6, red);
  v.box(bx - 3, by + 2, bz + 3, bx - 1, by + 5, bz + 5, hi);
  return v;
}

function buildHeadVox(spec, seedIdx) {
  const look = pallorLook(spec, { pallor: 0.42, tint: '#dfd5b4' });
  const parts = buildCharacter(look, { seed: `fun:head:${seedIdx}`, provider: spec.provider });
  const head = parts.head;
  mottleHead(head, look.skin, 91 + seedIdx * 17, { gaunt: 0.32 });
  eyelessBrow(head, look.skin);
  carvedSmile(head, look.skin, {
    halfW: 7,
    yLow: 36,
    lift: 7.8,
    openH: seedIdx === 0 ? 4.3 : 3.9,
    teeth: true,
  });
  // Carved corner tension slits slicing toward the cheekbones
  carveCreases(head, look.skin, [
    [-8, 42, -8, 45, true],
    [7, 42, 7, 45, true],
    [-6, 35, 5, 35, false],
  ]);
  if (seedIdx % 2 === 1) slipRows(head, [[38, 39, 1, 0]]);
  head.stamp(crookedConeVox(seedIdx % 2 === 0 ? 1 : -1));
  return head;
}

function buildBodyBatch(kit, variant, idx) {
  const spec = STAFF[variant === 'greeter' ? 0 : (idx % (STAFF.length - 1)) + 1];
  const look = pallorLook(spec, { pallor: 0.42, tint: '#dfd5b4' });
  const seedKey = `fun:body:${variant}:${idx}`;
  const parts = buildCharacter(look, { seed: seedKey, provider: spec.provider });
  stainHands(parts.armLowerL);
  stainHands(parts.armLowerR);

  const b = new Batch(true);
  const add = (sub, vox, mat4) => {
    if (!vox) return;
    const geo = kit.model(`${seedKey}:${sub}`, () => vox);
    if (geo?.solid) b.addVox(geo.solid, mat4);
  };

  if (variant === 'greeter') {
    // Frozen stork balance at the threshold: torso arched slightly back, arms flung wide
    add('torso', parts.torso, jointMat(S, JOINT.hips, -0.07, 0, 0.03, 1.04));
    // Right leg planted rigid on the floor
    add('legUR', parts.legUpperR, jointMat(S, JOINT.hipR, 0, 0, 0));
    add('legLR', parts.legLowerR, jointMat(S, JOINT.hipR, 0, 0, 0));
    // Left thigh lifted high, shin folded sharply back behind the knee (Image 2 pose)
    const thighM = jointMat(S, JOINT.hipL, -1.05, 0, -0.08);
    add('legUL', parts.legUpperL, thighM);
    const shinM = thighM.clone()
      .multiply(new THREE.Matrix4().makeScale(1 / S[0], 1 / S[1], 1 / S[2]))
      .multiply(jointMat(S, JOINT.kneeL, 2.05, 0, 0));
    // Simpler exact composition in voxel space before world scale:
    const shinLocal = new THREE.Matrix4()
      .makeScale(S[0], S[1], S[2])
      .multiply(new THREE.Matrix4().makeTranslation(...JOINT.hipL))
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-1.05, 0, -0.08, 'YXZ')))
      .multiply(new THREE.Matrix4().makeTranslation(
        JOINT.kneeL[0] - JOINT.hipL[0],
        JOINT.kneeL[1] - JOINT.hipL[1],
        JOINT.kneeL[2] - JOINT.hipL[2],
      ))
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(2.12, 0, 0, 'YXZ')))
      .multiply(new THREE.Matrix4().makeTranslation(-JOINT.kneeL[0], -JOINT.kneeL[1], -JOINT.kneeL[2]));
    void shinM;
    add('legLL', parts.legLowerL, shinLocal);

    // Wide welcoming arms raised past shoulder height
    const armRM = jointMat(S, JOINT.shoulderR, -0.22, 0, 2.08, 1.12);
    const armLM = jointMat(S, JOINT.shoulderL, -0.22, 0, -1.96, 1.12);
    add('armUR', parts.armUpperR, armRM);
    add('armLR', parts.armLowerR, armRM);
    add('armUL', parts.armUpperL, armLM);
    add('armLL', parts.armLowerL, armLM);

    // Glossy red balloon floating above the raised right hand
    add('balloon', balloonVox(26, 43, -1, 26, 61, -1), new THREE.Matrix4().makeScale(S[0], S[1], S[2]));
  } else {
    // Circle member: planted stiffly, arms angled wide & forward to clasp neighbours' hands
    add('torso', parts.torso, jointMat(S, JOINT.hips, 0.04, 0, (idx % 2 ? 1 : -1) * 0.04, 1.03));
    add('legUL', parts.legUpperL, jointMat(S, JOINT.hipL, 0, 0, -0.04));
    add('legLL', parts.legLowerL, jointMat(S, JOINT.hipL, 0, 0, -0.04));
    add('legUR', parts.legUpperR, jointMat(S, JOINT.hipR, 0, 0, 0.04));
    add('legLR', parts.legLowerR, jointMat(S, JOINT.hipR, 0, 0, 0.04));

    const armLM = jointMat(S, JOINT.shoulderL, -0.42, 0.18, -1.06, 1.14);
    const armRM = jointMat(S, JOINT.shoulderR, -0.42, -0.18, 1.06, 1.14);
    add('armUL', parts.armUpperL, armLM);
    add('armLL', parts.armLowerL, armLM);
    add('armUR', parts.armUpperR, armRM);
    add('armLR', parts.armLowerR, armRM);

    if (idx % 2 === 0) {
      add('balloon', balloonVox(25, 25, 8, 25, 56, 8), new THREE.Matrix4().makeScale(S[0], S[1], S[2]));
    }
  }
  return b;
}

export function buildCommitteeMember(kit, variant = 'greeter', idx = 0) {
  const lights = [lamp(0.2, 2.4, 0.8, [1.28, 1.28, 1.28], { k: 8, wrap: 0.48, far: 26 })], amb = [0.62, 0.62, 0.62];
  const mat = kit.surface({ vox: true });

  const bodyBatch = buildBodyBatch(kit, variant, idx);
  const bodyMesh = new THREE.Mesh(kit.geometry(bodyBatch, lights, amb), mat);

  const seedIdx = variant === 'greeter' ? 0 : idx + 1;
  const spec = STAFF[variant === 'greeter' ? 0 : (idx % (STAFF.length - 1)) + 1];
  const headBatch = new Batch(true);
  const headModel = kit.model(`fun:head:${variant}:${idx}`, () => buildHeadVox(spec, seedIdx));
  headBatch.addVox(headModel.solid, localJointMat(S, JOINT.head, 0, 0, 0));
  const headMesh = new THREE.Mesh(kit.geometry(headBatch, lights, amb), mat);

  const head = new THREE.Group();
  head.position.set(JOINT.head[0] * S[0], JOINT.head[1] * S[1], JOINT.head[2] * S[2]);
  const baseTilt = (seedIdx % 2 === 0 ? 1 : -1) * (variant === 'greeter' ? 0.28 : 0.24);
  head.rotation.set(-0.08, 0, baseTilt);
  head.add(headMesh);

  const group = new THREE.Group();
  group.add(bodyMesh, head);

  return {
    group,
    head,
    mesh: bodyMesh,
    aimHead(relYaw = 0, time = 0, mode = 'idle') {
      const clamped = Math.max(-2.35, Math.min(2.35, relYaw));
      const wobble = mode === 'partying'
        ? Math.sin(time * 3.4 + seedIdx) * 0.16
        : mode === 'swarming'
          ? Math.sin(time * 9.5 + seedIdx) * 0.14
          : Math.sin(time * 0.9 + seedIdx * 1.7) * 0.03;
      head.rotation.set(-0.08, clamped, baseTilt + wobble);
    },
    light(rgb) { mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); },
  };
}
