// Voxel rig for The Efficiency Partners: uncanny Backrooms management
// consultants sculpted from real `avatar/build.js` Office suits, crooked open
// wire-rim spectacles, bulging asymmetric sclera / hollow sockets, horizontal
// cheek-split creases, and bad-frame VHS head slips.
//   - Partner 0: silver-haired senior partner with crooked glasses & slipped jaw
//   - Partner 1: dark-haired associate with one bulging white eye & one hollow socket
import * as THREE from 'three';
import { Vox, M } from '../../../vox/vox.js';
import { buildCharacter, JOINT } from '../../../avatar/build.js';
import { Batch, lamp } from '../../kit.js';
import {
  pallorLook, mottleHead, eraseNose, bulgingEye, hollowSocket,
  slippedMouth, carveCreases, crookedSpecs, slipRows, tornVox,
  jointMat, localJointMat,
} from '../../uncanny.js';

const S = [0.025, 0.0295, 0.025];

const PARTNERS = [
  {
    skin: '#e5caa2',
    hair: 'side',
    hairColor: '#d4d8e0',
    outfit: 'suit',
    outfitColor: '#1f2430',
  },
  {
    skin: '#e0c2a4',
    hair: 'long',
    hairColor: '#261b16',
    outfit: 'suit',
    outfitColor: '#1a2333',
  },
];

function recolorTie(torso, hexTop, hexBot) {
  for (let y = 26; y < 34; y++) {
    torso.decal('+z', -1, y, 1, y + 1, M(y > 31 ? hexTop : hexBot, 1));
  }
}

function clipboardVox() {
  const v = new Vox();
  const board = M('#aeb8c4', 0), brass = M('#c8a243', 0), page = M('#f0ead8', 1), rule = M('#9c3b46', 1);
  v.box(-11, 22, 6, -3, 23, 16, board);
  v.box(-10, 23, 7, -4, 24, 15, page);
  v.box(-9, 24, 13, -5, 25, 14, rule);
  for (const z of [9, 11]) v.box(-9, 24, z, -5, 25, z + 1, M('#7d848e', 1));
  v.box(-8, 23, 15, -6, 25, 16, brass);
  return v;
}

function slipInHandVox() {
  const v = new Vox();
  // Modelled in shoulderR-local coordinates around the forward-bent hand (0, -14, 6)
  const slip = M('#f2aebc', 1), hdr = M('#9e2033', 1), line = M('#c46e7e', 1), pen = M('#cfd6e0', 0);
  v.tube(-1, -13, 5, -2, -10, 10, 0.52, pen);
  v.box(-3, -15, 6, 4, -14, 16, slip);
  v.box(-2, -14, 13, 3, -13, 15, hdr);
  for (const z of [8, 10, 11]) v.box(-2, -14, z, 2, -13, z + 1, line);
  return v;
}

function buildPartnerHeadVox(idx) {
  const spec = PARTNERS[idx % PARTNERS.length];
  const look = pallorLook(spec, { pallor: 0.36, tint: '#d7d0ba' });
  const parts = buildCharacter(look, { seed: `partner:${idx}` });
  const head = parts.head;
  mottleHead(head, look.skin, 301 + idx * 41, { gaunt: 0.36 });

  if (idx % 2 === 0) {
    // Jensen-echo senior partner: crooked dark wire glasses over mismatched staring eyes
    bulgingEye(head, -5, 44, 4, 4, 0, 0, look.skin, { glitch: 2 });
    bulgingEye(head, 4, 42, 4, 4, -1, 0, look.skin, { bloodshot: true });
    slippedMouth(head, -1, 37, 8, 2, look.skin, { curve: -0.4, slope: -0.2, teeth: true });
    carveCreases(head, look.skin, [
      [-6, 48, 4, 48, false],
      [-7, 40, -3, 39, true],
      [2, 39, 7, 38, true],
      [-4, 35, 3, 35, false],
    ]);
    slipRows(head, [[36, 38, -1, 0]]);
    crookedSpecs(head, { leftY: 42, rightY: 40, h: 5, z: 9, frameHex: '#181512' });
  } else {
    // Associate partner: one giant bulging eye + one gaping black hollow socket (Image 7 right figure)
    eraseNose(head);
    bulgingEye(head, -4.5, 44, 5, 5, 0, 0, look.skin, { glitch: 3, bloodshot: true });
    hollowSocket(head, 4, 43.5, 5, 5, look.skin);
    slippedMouth(head, 1.5, 37, 8, 2, look.skin, { curve: 0.5, slope: 0.22, teeth: true });
    carveCreases(head, look.skin, [
      [-6, 48, 5, 47, false],
      [0, 40, 7, 40, true],
      [-7, 40, -2, 39, true],
      [-3, 35, 5, 35, false],
    ]);
    slipRows(head, [[37, 39, 1, 0]]);
  }
  return head;
}

function buildTorsoAndLeftArmBatch(kit, idx) {
  const variant = idx % PARTNERS.length;
  const spec = PARTNERS[variant];
  const look = pallorLook(spec, { pallor: 0.36, tint: '#d7d0ba' });
  const keyBase = `partner:body:${variant}`;
  const parts = buildCharacter(look, { seed: keyBase });
  if (variant === 0) recolorTie(parts.torso, '#3a7cb0', '#5aa2d8');

  const b = new Batch(true);
  const add = (sub, vox, m4) => {
    const geo = kit.model(`${keyBase}:${sub}`, () => vox);
    if (geo?.solid) b.addVox(geo.solid, m4);
  };

  add('torso', parts.torso, jointMat(S, JOINT.hips, 0.03, 0, 0, 1.04));
  // Left upper arm + forward-bent forearm cradling the aluminium clipboard
  add('armUL', parts.armUpperL, jointMat(S, JOINT.shoulderL, -0.26, 0, -0.14));
  const forearmL = new THREE.Matrix4()
    .makeScale(S[0], S[1], S[2])
    .multiply(new THREE.Matrix4().makeTranslation(...JOINT.shoulderL))
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.26, 0, -0.14, 'YXZ')))
    .multiply(new THREE.Matrix4().makeTranslation(
      JOINT.elbowL[0] - JOINT.shoulderL[0],
      JOINT.elbowL[1] - JOINT.shoulderL[1],
      JOINT.elbowL[2] - JOINT.shoulderL[2],
    ))
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-1.08, -0.22, 0, 'YXZ')))
    .multiply(new THREE.Matrix4().makeTranslation(-JOINT.elbowL[0], -JOINT.elbowL[1], -JOINT.elbowL[2]));
  add('armLL', parts.armLowerL, forearmL);
  add('clip', clipboardVox(), new THREE.Matrix4().makeScale(S[0], S[1], S[2]));
  return b;
}

function buildRightArmBatch(kit, idx) {
  const variant = idx % PARTNERS.length;
  const spec = PARTNERS[variant];
  const look = pallorLook(spec, { pallor: 0.36, tint: '#d7d0ba' });
  const keyBase = `partner:armR:${variant}`;
  const parts = buildCharacter(look, { seed: keyBase });

  const b = new Batch(true);
  b.addVox(
    kit.model(`${keyBase}:u`, () => parts.armUpperR).solid,
    localJointMat(S, JOINT.shoulderR, -0.12, 0, 0.08),
  );
  // Forearm bent forward from elbow relative to shoulderR
  const elbowRel = [
    JOINT.elbowR[0] - JOINT.shoulderR[0],
    JOINT.elbowR[1] - JOINT.shoulderR[1],
    JOINT.elbowR[2] - JOINT.shoulderR[2],
  ];
  const lowM = new THREE.Matrix4()
    .makeScale(S[0], S[1], S[2])
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.12, 0, 0.08, 'YXZ')))
    .multiply(new THREE.Matrix4().makeTranslation(...elbowRel))
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.56, 0, 0, 'YXZ')))
    .multiply(new THREE.Matrix4().makeTranslation(-JOINT.elbowR[0], -JOINT.elbowR[1], -JOINT.elbowR[2]));
  b.addVox(kit.model(`${keyBase}:l`, () => parts.armLowerR).solid, lowM);
  b.addVox(
    kit.model(`${keyBase}:slip`, slipInHandVox).solid,
    new THREE.Matrix4().makeScale(S[0], S[1], S[2]),
  );
  return b;
}

function buildLegBatch(kit, side, idx) {
  const variant = idx % PARTNERS.length;
  const spec = PARTNERS[variant];
  const look = pallorLook(spec, { pallor: 0.36, tint: '#d7d0ba' });
  const keyBase = `partner:leg:${variant}:${side < 0 ? 'L' : 'R'}`;
  const parts = buildCharacter({ ...look, outfitColor: '#1b1f29' }, { seed: 'partner:suitpants' });
  // Ensure sleek charcoal dress slacks & black oxfords
  const uVox = side < 0 ? parts.legUpperL : parts.legUpperR;
  const lVox = side < 0 ? parts.legLowerL : parts.legLowerR;
  const slacks = M('#1b1f2a', 2), oxford = M('#121114', 0);
  uVox.paint(-10, 8, -5, 10, 20, 5, slacks);
  lVox.paint(-10, 3, -5, 10, 11, 5, slacks);
  lVox.paint(-10, 0, -5, 10, 3, 7, oxford);

  const pivot = side < 0 ? JOINT.hipL : JOINT.hipR;
  const m4 = localJointMat(S, pivot);
  const b = new Batch(true);
  b.addVox(kit.model(`${keyBase}:u`, () => uVox).solid, m4);
  b.addVox(kit.model(`${keyBase}:l`, () => lVox).solid, m4);
  return b;
}

export function makeEfficiencyPartner(kit, idx = 0) {
  const lights = [lamp(0.2, 2.5, 0.8, [1.3, 1.3, 1.3], { k: 8, wrap: 0.48, far: 26 })], amb = [0.62, 0.62, 0.62];
  const mat = kit.surface({ vox: true });
  const variant = idx % PARTNERS.length;

  const group = new THREE.Group();
  const body = new THREE.Mesh(kit.geometry(buildTorsoAndLeftArmBatch(kit, variant), lights, amb), mat);

  const head = new THREE.Group();
  head.position.set(JOINT.head[0] * S[0], JOINT.head[1] * S[1], JOINT.head[2] * S[2]);
  const headM4 = localJointMat(S, JOINT.head);
  const bWhole = new Batch(true);
  bWhole.addVox(kit.model(`partner:head:${variant}`, () => buildPartnerHeadVox(variant)).solid, headM4);
  const bSlip = new Batch(true);
  bSlip.addVox(
    kit.model(`partner:headTorn:${variant}`, () => tornVox(buildPartnerHeadVox(variant), 73 + variant * 19)).solid,
    headM4,
  );
  const headWhole = new THREE.Mesh(kit.geometry(bWhole, lights, amb), mat);
  const headSlipped = new THREE.Mesh(kit.geometry(bSlip, lights, amb), mat);
  headSlipped.visible = false;
  head.add(headWhole, headSlipped);

  const armR = new THREE.Group();
  armR.position.set(JOINT.shoulderR[0] * S[0], JOINT.shoulderR[1] * S[1], JOINT.shoulderR[2] * S[2]);
  armR.add(new THREE.Mesh(kit.geometry(buildRightArmBatch(kit, variant), lights, amb), mat));

  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(JOINT.hipL[0] * S[0], JOINT.hipL[1] * S[1], JOINT.hipL[2] * S[2]);
  legR.position.set(JOINT.hipR[0] * S[0], JOINT.hipR[1] * S[1], JOINT.hipR[2] * S[2]);
  legL.add(new THREE.Mesh(kit.geometry(buildLegBatch(kit, -1, variant), lights, amb), mat));
  legR.add(new THREE.Mesh(kit.geometry(buildLegBatch(kit, 1, variant), lights, amb), mat));

  group.add(body, head, armR, legL, legR);

  const shadow = new THREE.Mesh(
    kit.own(new THREE.PlaneGeometry(0.84, 0.84)),
    kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 1;
  group.add(shadow);

  const baseTilt = variant === 0 ? 0.21 : -0.23;
  head.rotation.set(0.05, 0, baseTilt);

  return {
    group,
    pose(time, phase, moving) {
      const stride = moving ? Math.sin(time * 7.2) * 0.38 : 0;
      legL.rotation.x = stride;
      legR.rotation.x = -stride;
      const bob = moving ? Math.abs(Math.sin(time * 7.2)) * 0.018 : 0;
      body.position.y = bob;
      head.position.y = JOINT.head[1] * S[1] + bob;

      // Intermittent bad-frame VHS head tear + jerky corporate sympathy tilt
      const cyc = (time + variant * 1.9) % 3.7;
      const torn = cyc > 3.58;
      headWhole.visible = !torn;
      headSlipped.visible = torn;
      head.rotation.set(
        0.05 + Math.sin(time * 1.3 + variant) * 0.03,
        phase === 'offering' ? Math.sin(time * 0.9) * 0.08 : 0,
        baseTilt + (torn ? -baseTilt * 1.4 : Math.sin(time * 1.7 + variant) * 0.03),
      );

      if (phase === 'offering' || phase === 'approaching') {
        armR.rotation.set(-0.56 + Math.sin(time * 3.2) * 0.04, -0.06, 0);
      } else {
        armR.rotation.set(-0.18 + Math.sin(time * 6.5) * 0.05, -0.34, -0.1);
      }
    },
    light(rgb) { mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); },
  };
}
