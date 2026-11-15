// Voxel rig for The Floor Warden: unhinged Backrooms safety marshall built on
// `avatar/build.js` (high-vis neon vest, reflective stripes, lanyard, mustache,
// steel-toe boots) with bulging mismatched bloodshot eyes under a tilted white
// hard-hat, a slipped snarling jaw, VHS head tears, and giant 3-foot chrome
// office scissors.
import * as THREE from 'three';
import { Vox, M } from '../../../vox/vox.js';
import { buildCharacter, JOINT } from '../../../avatar/build.js';
import { Batch, lamp } from '../../kit.js';
import {
  pallorLook, mottleHead, bulgingEye, slippedMouth, carveCreases,
  slipRows, tornVox, jointMat, localJointMat,
} from '../../uncanny.js';

const S = [0.0255, 0.0285, 0.0255];

const WARDEN_SPEC = {
  skin: '#dfba98',
  hair: 'short',
  hairColor: '#2d2018',
  outfit: 'vest',
  outfitColor: '#b7de26',
  facial: 'mustache',
  provider: 'claude',
};

function hardHatVox() {
  const v = new Vox();
  const hat = M('#ecebe2', 0), brim = M('#dad8cc', 0), crest = M('#de5320', 1), band = M('#202228', 1);
  // Perched high & slightly tilted so his bulging eyes stare out from beneath the brim
  v.rbox(-9, 48, -8, 9, 56, 8, 4, hat);
  v.box(-9, 48, -8, 9, 49, 8, band);
  v.rbox(-8, 48, 6, 9, 50, 12, 2, brim, 'xz');
  v.box(-2, 50, 8, 2, 54, 9, crest);
  v.box(-1, 51, 8, 1, 53, 10, M('#f4f2ea', 0));
  return v;
}

function buildWardenHeadVox() {
  const look = pallorLook(WARDEN_SPEC, { pallor: 0.34, tint: '#d4ceb8' });
  const parts = buildCharacter(look, { seed: 'warden:head', provider: 'claude' });
  const head = parts.head;
  mottleHead(head, look.skin, 771, { gaunt: 0.38 });

  // Two manic, mismatched bulging bloodshot eyes staring out from under the brim
  bulgingEye(head, -4.5, 44, 5, 5, 0, 0, look.skin, { bloodshot: true, glitch: 2 });
  bulgingEye(head, 4.5, 42, 3, 4, -1, 0, look.skin, { bloodshot: true });

  // Bared-teeth snarl below his crooked mustache + tarnished pea-whistle clenched at the corner
  slippedMouth(head, 0, 36, 9, 3, look.skin, { curve: -0.9, slope: 0.16, teeth: true });
  head.box(3, 36, 7, 6, 38, 10, M('#aeb8c4', 0));
  carveCreases(head, look.skin, [
    [-7, 47, -2, 46, true],
    [2, 46, 7, 47, true],
    [-8, 40, -5, 37, true],
    [5, 40, 8, 37, true],
  ]);
  slipRows(head, [[36, 37, 2, 0]]);
  head.stamp(hardHatVox());
  return head;
}

function buildWardenBodyBatch(kit) {
  const look = pallorLook(WARDEN_SPEC, { pallor: 0.34, tint: '#d4ceb8' });
  const parts = buildCharacter(look, { seed: 'warden:body', provider: 'claude' });

  // Silver reflective stripes across the high-vis vest + orange safety armband on left sleeve
  const tape = M('#dfe6ec', 0), crest = M('#de5320', 1);
  for (const y of [21, 26]) {
    parts.torso.decal('+z', -7, y, -2, y + 2, tape);
    parts.torso.decal('+z', 2, y, 7, y + 2, tape);
    parts.torso.decal('-z', -7, y, 7, y + 2, tape);
  }
  parts.armUpperL.paint(-12, 29, -3, -6, 32, 3, crest);

  const b = new Batch(true);
  const add = (sub, vox, m4) => {
    const geo = kit.model(`warden:body:${sub}`, () => vox);
    if (geo?.solid) b.addVox(geo.solid, m4);
  };

  add('torso', parts.torso, jointMat(S, JOINT.hips, 0.03, 0, 0, 1.03));
  // Left arm cocked stiffly out from side like a hall monitor
  const armLM = jointMat(S, JOINT.shoulderL, -0.18, 0, -0.22, 1.05);
  add('armUL', parts.armUpperL, armLM);
  add('armLL', parts.armLowerL, armLM);

  // Right arm extended forward gripping the giant chrome scissors around (9, 24, 14)
  add('armUR', parts.armUpperR, jointMat(S, JOINT.shoulderR, -0.68, 0, 0.08));
  const forearmR = new THREE.Matrix4()
    .makeScale(S[0], S[1], S[2])
    .multiply(new THREE.Matrix4().makeTranslation(...JOINT.shoulderR))
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.68, 0, 0.08, 'YXZ')))
    .multiply(new THREE.Matrix4().makeTranslation(
      JOINT.elbowR[0] - JOINT.shoulderR[0],
      JOINT.elbowR[1] - JOINT.shoulderR[1],
      JOINT.elbowR[2] - JOINT.shoulderR[2],
    ))
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.66, 0, 0, 'YXZ')))
    .multiply(new THREE.Matrix4().makeTranslation(-JOINT.elbowR[0], -JOINT.elbowR[1], -JOINT.elbowR[2]));
  add('armLR', parts.armLowerR, forearmR);
  return b;
}

function buildWardenLegBatch(kit, side) {
  const look = pallorLook(WARDEN_SPEC, { pallor: 0.34, tint: '#d4ceb8' });
  const parts = buildCharacter(look, { seed: 'warden:legs' });
  const uVox = side < 0 ? parts.legUpperL : parts.legUpperR;
  const lVox = side < 0 ? parts.legLowerL : parts.legLowerR;
  const slacks = M('#222b3a', 2), boot = M('#18191e', 1), cap = M('#747d8a', 0);
  uVox.paint(-10, 8, -5, 10, 20, 5, slacks);
  lVox.paint(-10, 3, -5, 10, 11, 5, slacks);
  lVox.paint(-10, 0, -5, 10, 3, 7, boot);
  lVox.paint(-10, 1, 3, 10, 3, 7, cap);

  const pivot = side < 0 ? JOINT.hipL : JOINT.hipR;
  const m4 = localJointMat(S, pivot);
  const b = new Batch(true);
  const tag = side < 0 ? 'L' : 'R';
  b.addVox(kit.model(`warden:legU:${tag}`, () => uVox).solid, m4);
  b.addVox(kit.model(`warden:legL:${tag}`, () => lVox).solid, m4);
  return b;
}

function scissorHalfVox(upper = true) {
  const v = new Vox();
  const steel = M('#c6d0dc', 0), edge = M('#eef4fa', 0), grip = M('#e35924', 1), screw = M('#d4a838', 0);
  const stain = M('#6b171d', 0);
  const yOff = upper ? 2 : -5;
  v.rbox(-1, yOff, -11, 1, yOff + 4, -2, 1, grip);
  v.carve(-1, yOff + 1, -9, 1, yOff + 3, -4);
  v.tube(0, 0, 0, 0, yOff + 2, -3, 1.1, grip);
  for (let z = 0; z < 26; z++) {
    const h = Math.max(1, Math.round(3.4 * (1 - z / 28)));
    const tip = z >= 21 ? stain : edge;
    if (upper) {
      v.box(-1, 0, z, 0, h, z + 1, z >= 23 ? stain : steel);
      v.set(0, 0, z, tip);
    } else {
      v.box(0, -h, z, 1, 0, z + 1, z >= 23 ? stain : steel);
      v.set(0, 0, z, tip);
    }
  }
  if (upper) v.box(-2, -1, -1, 2, 1, 1, screw);
  return v;
}

export function makeFloorWarden(kit) {
  const lights = [lamp(0.2, 2.5, 0.8, [1.3, 1.3, 1.3], { k: 8, wrap: 0.48, far: 26 })], amb = [0.62, 0.62, 0.62];
  const mat = kit.surface({ vox: true });
  const scScale = new THREE.Matrix4().makeScale(S[0], S[1], S[2]);
  const part = (key, make) => {
    const b = new Batch(true);
    b.addVox(kit.model('warden:' + key, make).solid, scScale);
    return new THREE.Mesh(kit.geometry(b, lights, amb), mat);
  };

  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);

  const torso = new THREE.Mesh(kit.geometry(buildWardenBodyBatch(kit), lights, amb), mat);

  const head = new THREE.Group();
  head.position.set(JOINT.head[0] * S[0], JOINT.head[1] * S[1], JOINT.head[2] * S[2]);
  const headM4 = localJointMat(S, JOINT.head);
  const bWhole = new Batch(true);
  bWhole.addVox(kit.model('warden:headWhole', buildWardenHeadVox).solid, headM4);
  const bSlip = new Batch(true);
  bSlip.addVox(kit.model('warden:headTorn', () => tornVox(buildWardenHeadVox(), 911)).solid, headM4);
  const headWhole = new THREE.Mesh(kit.geometry(bWhole, lights, amb), mat);
  const headSlipped = new THREE.Mesh(kit.geometry(bSlip, lights, amb), mat);
  headSlipped.visible = false;
  head.add(headWhole, headSlipped);

  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(JOINT.hipL[0] * S[0], JOINT.hipL[1] * S[1], JOINT.hipL[2] * S[2]);
  legR.position.set(JOINT.hipR[0] * S[0], JOINT.hipR[1] * S[1], JOINT.hipR[2] * S[2]);
  legL.add(new THREE.Mesh(kit.geometry(buildWardenLegBatch(kit, -1), lights, amb), mat));
  legR.add(new THREE.Mesh(kit.geometry(buildWardenLegBatch(kit, 1), lights, amb), mat));

  const scissors = new THREE.Group();
  scissors.position.set(9.5 * S[0], 23.5 * S[1], 14.5 * S[2]);
  const bladeU = new THREE.Group(), bladeL = new THREE.Group();
  bladeU.add(part('bladeU', () => scissorHalfVox(true)));
  bladeL.add(part('bladeL', () => scissorHalfVox(false)));
  scissors.add(bladeU, bladeL);

  rig.add(torso, head, legL, legR, scissors);

  const shadow = new THREE.Mesh(
    kit.own(new THREE.PlaneGeometry(0.92, 0.92)),
    kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 1;
  group.add(shadow);

  return {
    group,
    pose(time, phase, speed, tripProgress = 0) {
      if (phase === 'tripping') {
        const k = tripProgress * tripProgress;
        rig.rotation.x = (Math.PI / 2) * k;
        rig.position.y = 0.12 * Math.sin(tripProgress * Math.PI);
        headWhole.visible = false;
        headSlipped.visible = true;
        scissors.rotation.x = -0.35;
        bladeU.rotation.x = -0.32;
        bladeL.rotation.x = 0.32;
        return;
      }
      rig.position.y = phase === 'chasing' ? Math.abs(Math.sin(time * 15)) * 0.055 : Math.abs(Math.sin(time * 5.5)) * 0.015;
      rig.rotation.x = phase === 'chasing' ? 0.24 : 0.02;
      const rate = phase === 'chasing' ? 15 : 5.5;
      const stride = phase === 'chasing' ? 0.72 : (speed > 0.1 ? 0.34 : 0);
      legL.rotation.x = Math.sin(time * rate) * stride;
      legR.rotation.x = -Math.sin(time * rate) * stride;

      const torn = phase === 'chasing' ? (Math.floor(time * 16) % 5 === 0) : ((time % 3.4) > 3.28);
      headWhole.visible = !torn;
      headSlipped.visible = torn;
      head.rotation.set(
        phase === 'chasing' ? -0.14 : 0.04,
        Math.sin(time * 2.4) * 0.08,
        phase === 'chasing' ? 0.32 + Math.sin(time * 14) * 0.1 : -0.18,
      );

      if (phase === 'chasing') {
        scissors.rotation.set(0.18, -0.08, 0);
        const open = 0.08 + Math.abs(Math.sin(time * 11.5)) * 0.34;
        bladeU.rotation.x = -open;
        bladeL.rotation.x = open;
      } else {
        scissors.rotation.set(-0.62, -0.18, 0.12);
        bladeU.rotation.x = -0.06;
        bladeL.rotation.x = 0.06;
      }
    },
    light(rgb) { mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); },
  };
}

/** Knocked-off white hard-hat left beside his scissors after he trips headlong onto his blades. */
export function makeFallenHardHat(kit) {
  const lights = [lamp(0.2, 2.5, 0.8, [1.3, 1.3, 1.3], { k: 8, wrap: 0.48, far: 26 })], amb = [0.62, 0.62, 0.62];
  const mat = kit.surface({ vox: true });
  const m4 = new THREE.Matrix4().makeScale(S[0], S[1], S[2]).multiply(new THREE.Matrix4().makeTranslation(0, -48, 0));
  const b = new Batch(true);
  b.addVox(kit.model('warden:fallenHat', hardHatVox).solid, m4);
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(kit.geometry(b, lights, amb), mat);
  mesh.rotation.set(-0.22, 0.65, 0.34);
  mesh.position.y = 0.04;
  group.add(mesh);
  group.userData.light = (rgb) => mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
  return group;
}
