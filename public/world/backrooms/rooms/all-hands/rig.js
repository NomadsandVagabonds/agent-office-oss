// Voxel models, gaunt Keynote Speaker rig, & 180°-head-snapping seated Backrooms
// audience for `all-hands` ("Mandatory All-Hands").
import * as THREE from 'three';
import { Vox, M, glow } from '../../../vox/vox.js';
import { buildCharacter, JOINT } from '../../../avatar/build.js';
import { Batch, lamp } from '../../kit.js';
import {
  pallorLook, mottleHead, stretchHead, eraseNose, bulgingEye, hollowSocket,
  eyelessBrow, carvedSmile, slippedMouth, crookedSpecs, slipRows, carveCreases,
  tornVox, jointMat, localJointMat,
} from '../../uncanny.js';

// Towering, gaunt, stretched-limb proportions (~2.0m tall)
const S = [0.026, 0.039, 0.026];

const SPEAKER_SPEC = {
  skin: '#d8d2be',
  hair: 'side',
  hairColor: '#22211e',
  outfit: 'suit',
  outfitColor: '#1b1c1f',
  provider: 'custom',
};

function buildSpeakerHeadVox() {
  const look = pallorLook(SPEAKER_SPEC, { pallor: 0.68, tint: '#cbc8ba' });
  const parts = buildCharacter(look, { seed: 'allhands:speaker' });
  const head = parts.head;
  eraseNose(head);
  stretchHead(head, 11, 46);

  // Greying pallid temples
  head.paint(-11, 46, -9, 11, 64, 6, (x, y, z, cur) => (Math.abs(x) >= 8 && y <= 55 ? M('#8c9088', 2) : cur));

  mottleHead(head, look.skin, 811, { gaunt: 0.56 });

  // Asymmetric nightmare gaze: left eye bulging & bloodshot, right eye a deep black ember socket, behind crooked wire specs
  bulgingEye(head, -4.5, 51.0, 5, 5, 0, 0, look.skin, { bloodshot: true, glitch: -1 });
  hollowSocket(head, 4.0, 49.5, 5, 5, look.skin, { ember: true });
  crookedSpecs(head, { leftY: 48, rightY: 46, h: 6, z: 9, frameHex: '#181614' });

  // Stretched gaping keynote jaw + deep facial scan-creases
  carvedSmile(head, look.skin, { halfW: 6, yLow: 36, lift: 5.8, openH: 4.6, teeth: true });
  carveCreases(head, look.skin, [
    [-7, 56, 6, 55, true],
    [-8, 45, -6, 37, true],
    [6, 45, 8, 37, true],
  ]);
  slipRows(head, [[53, 54, 1, 0], [38, 39, -1, 0]]);

  // Thin black wireless cheek-boom microphone + sickly red/green feedback LED
  const wire = M('#101114', 0);
  for (let z = 0; z <= 8; z++) head.set(9, 41, z, wire);
  for (let x = 3; x <= 9; x++) head.set(x, 38, 8, wire);
  head.set(2, 38, 9, glow('#d83a2e'));
  return head;
}

export function makeKeynoteSpeaker(kit) {
  const look = pallorLook(SPEAKER_SPEC, { pallor: 0.68, tint: '#cbc8ba' });
  const parts = buildCharacter(look, { seed: 'allhands:speaker' });
  const lights = [lamp(0, 2.8, 1.4, [1.55, 1.52, 1.44], { k: 11, wrap: 0.45, far: 30 })];
  const amb = [0.36, 0.37, 0.38];
  const mat = kit.surface({ vox: true });

  const bodyB = new Batch(true);
  const add = (sub, vox, m4) => {
    const geo = kit.model(`speaker:${sub}`, () => vox);
    if (geo?.solid) bodyB.addVox(geo.solid, m4);
  };
  add('torso', parts.torso, jointMat(S, JOINT.hips, 0.06, 0, 0, 1.12));
  add('legUL', parts.legUpperL, jointMat(S, JOINT.hipL, 0, 0, 0, 1.14));
  add('legLL', parts.legLowerL, jointMat(S, JOINT.hipL, 0, 0, 0, 1.14));
  add('legUR', parts.legUpperR, jointMat(S, JOINT.hipR, 0, 0, 0, 1.14));
  add('legLR', parts.legLowerR, jointMat(S, JOINT.hipR, 0, 0, 0, 1.14));

  // Unnatural long hanging arms reaching slightly toward the aisle
  for (const side of [-1, 1]) {
    const sh = side < 0 ? JOINT.shoulderL : JOINT.shoulderR;
    const uVox = side < 0 ? parts.armUpperL : parts.armUpperR;
    const lVox = side < 0 ? parts.armLowerL : parts.armLowerR;
    const armM = jointMat(S, sh, -0.42, side * 0.14, side * 0.18, 1.24);
    add(side < 0 ? 'armUL' : 'armUR', uVox, armM);
    add(side < 0 ? 'armLL' : 'armLR', lVox, armM);
  }

  const group = new THREE.Group();
  const bodyMesh = new THREE.Mesh(kit.geometry(bodyB, lights, amb), mat);

  const head = new THREE.Group();
  head.position.set(0, (JOINT.head[1] + 1.2) * S[1], 0);
  const headM4 = localJointMat(S, JOINT.head);
  const bWhole = new Batch(true);
  bWhole.addVox(kit.model('speaker:headWhole', buildSpeakerHeadVox).solid, headM4);
  const bTorn = new Batch(true);
  bTorn.addVox(kit.model('speaker:headTorn', () => tornVox(buildSpeakerHeadVox(), 307)).solid, headM4);
  const headWhole = new THREE.Mesh(kit.geometry(bWhole, lights, amb), mat);
  const headTorn = new THREE.Mesh(kit.geometry(bTorn, lights, amb), mat);
  headTorn.visible = false;
  head.add(headWhole, headTorn);
  group.add(bodyMesh, head);

  return {
    group,
    head,
    animate(time, qaMode, blackout) {
      const glitch = blackout || (qaMode && Math.floor(time * 13) % 7 === 0) || (time % 3.9 > 3.76);
      headWhole.visible = !glitch;
      headTorn.visible = glitch;
      head.rotation.z = glitch ? 0.34 : Math.sin(time * 0.9) * 0.07;
      head.rotation.x = qaMode ? 0.14 : 0.05;
    },
    setTint(r, g, b) {
      mat.uniforms.uTint.value.set(r, g, b);
    },
  };
}

/**
 * Builds 3 uncanny seated colleague variants for the silent Backrooms audience:
 * - Seated slumped body (facing -z toward the projector screen)
 * - Uncanny head (rendered facing -z during slides, then snapped 180° backwards to +z during Q&A!)
 */
export function buildAudienceKit(kit) {
  const outfits = ['#36393d', '#47453e', '#2e3338'];
  const hairs = ['#1e1b18', '#332c24', '#48443e'];
  const variants = [0, 1, 2].map((vIdx) => {
    const look = pallorLook({
      skin: '#d6d0bc',
      hair: vIdx === 1 ? 'parted' : 'short',
      hairColor: hairs[vIdx],
      outfit: vIdx === 0 ? 'shirt' : 'suit',
      outfitColor: outfits[vIdx],
    }, { pallor: 0.66, tint: '#cac6b6' });
    const parts = buildCharacter(look, { seed: `allhands:aud:${vIdx}` });
    const h = parts.head;
    eraseNose(h);
    stretchHead(h, vIdx === 0 ? 7 : 5, 46);
    mottleHead(h, look.skin, 200 + vIdx * 37, { gaunt: 0.52 });

    if (vIdx === 0) {
      // Deep gouged black eye sockets with faint glowing pinpricks
      hollowSocket(h, -4.5, 48, 4, 5, look.skin, { ember: true });
      hollowSocket(h, 3.5, 48, 4, 5, look.skin, { ember: true });
      slippedMouth(h, 0, 38, 8, 3, look.skin, { slope: -0.22, teeth: true });
    } else if (vIdx === 1) {
      // Blank eyeless skin brow + wide ear-to-ear carved grin
      eyelessBrow(h, look.skin);
      carvedSmile(h, look.skin, { halfW: 6, yLow: 36, lift: 6.2, openH: 3.6, teeth: true });
    } else {
      // Bulging bloodshot eyes staring over crooked wire glasses
      bulgingEye(h, -4.5, 47.5, 5, 4, 0, 0, look.skin, { bloodshot: true });
      bulgingEye(h, 4.0, 46.5, 4, 4, 0, 0, look.skin, { bloodshot: true });
      crookedSpecs(h, { leftY: 45, rightY: 43, h: 6, z: 9 });
      slippedMouth(h, 0.5, 37, 7, 3, look.skin, { curve: -1.2, teeth: true });
    }

    return {
      torso: kit.model(`ah:aud:t:${vIdx}`, () => parts.torso.downsample(2, 0.18)),
      headFwd: kit.model(`ah:aud:hf:${vIdx}`, () => h.downsample(2, 0.2)),
      headBack: kit.model(`ah:aud:hb:${vIdx}`, () => h),
      armU: kit.model(`ah:aud:au:${vIdx}`, () => parts.armUpperL.downsample(2, 0.15)),
      legU: kit.model(`ah:aud:lu:${vIdx}`, () => parts.legUpperL.downsample(2, 0.15)),
    };
  });

  const AS = [0.025, 0.027, 0.025];
  const AS2 = [AS[0] * 2, AS[1] * 2, AS[2] * 2];
  const halfJ = (j) => [j[0] * 0.5, j[1] * 0.5, j[2] * 0.5];
  const tmpM = new THREE.Matrix4(), worldM = new THREE.Matrix4();

  return {
    /** Stamp one seated figure at `(x, seatFloorY, z)` facing `-z` (`rot = Math.PI`). */
    stamp(bodyB, headFwdB, headBackB, vIdx, x, seatFloorY, z, headTiltZ = 0) {
      const v = variants[vIdx % variants.length];
      // Base seated height: shift down by ~0.16m so hips rest on the folding chair pan
      const baseY = seatFloorY - 0.16;
      worldM.makeRotationY(Math.PI).setPosition(x, baseY, z);

      const addBody = (geo, localM) => {
        if (!geo?.solid) return;
        tmpM.multiplyMatrices(worldM, localM);
        bodyB.addVox(geo.solid, tmpM);
      };
      addBody(v.torso, jointMat(AS2, halfJ(JOINT.hips), 0.08, 0, 0, 1.04));
      addBody(v.armU, jointMat(AS2, halfJ(JOINT.shoulderL), -0.35, 0, 0.08, 1.1));
      addBody(v.armU, jointMat(AS2, halfJ(JOINT.shoulderR), -0.35, 0, -0.08, 1.1, 7, 0, 0));
      addBody(v.legU, jointMat(AS2, halfJ(JOINT.hipL), -1.35, 0, 0, 0.95));
      addBody(v.legU, jointMat(AS2, halfJ(JOINT.hipR), -1.35, 0, 0, 0.95, 3.5, 0, 0));

      // Forward-facing head (coarsened back-of-head facing -z toward projector screen)
      tmpM.multiplyMatrices(worldM, jointMat(AS2, halfJ(JOINT.head), -0.05, 0, 0));
      headFwdB.addVox(v.headFwd.solid, tmpM);

      // 180°-snapped FULL-DETAIL uncanny head (faces +z straight up the dark aisle at the visitor!)
      tmpM.multiplyMatrices(worldM, jointMat(AS, JOINT.head, 0.12, Math.PI, headTiltZ));
      headBackB.addVox(v.headBack.solid, tmpM);
    },
  };
}

/** Drab grey-putty tubular-steel institutional folding/stacking Backrooms chair (faces -z). */
export function auditoriumSeatVox() {
  const v = new Vox();
  const drab = M('#3d3f3b', 3), drabDark = M('#2b2c29', 3);
  const frame = M('#52544e', 0);
  for (const sx of [-6, 4]) {
    v.box(sx, 0, -5, sx + 2, 11, -3, frame);
    v.box(sx, 0, 3, sx + 2, 24, 5, frame);
  }
  v.box(-6, 10, -5, 6, 12, 5, drab);
  v.box(-6, 16, 4, 6, 24, 6, drab);
  v.box(-4, 18, 3, 4, 22, 4, drabDark);
  return v.downsample(2, 0.12);
}

// (the lectern is sculpted in its own file: lectern.model.js)
export { LECTERN, lecternVox } from './lectern.model.js';

/** Lone standing floor Q&A microphone with blood-red ON AIR ring in the dark pit. */
export function qaMicVox() {
  const v = new Vox();
  const base = M('#18191c', 0), chrome = M('#8d9298', 0), head = M('#303338', 0);
  v.cyl('y', 0, 0, 0, 2, 5.5, base);
  v.box(-1, 2, -1, 1, 39, 1, chrome);
  v.tube(0, 39, 0, 0, 42, 4, 0.9, base);
  v.sphere(-0.5, 42.5, 4.5, 2.0, head);
  v.set(0, 40, 2, glow('#f0382c'));
  return v;
}
