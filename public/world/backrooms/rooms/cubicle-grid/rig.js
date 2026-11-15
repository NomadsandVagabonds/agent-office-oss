// Procedural textures, sunken-cubicle props, and articulated Smiling Office
// Worker (`pit-clerks`) rigs for `cubicle-grid` ("The Open-Plan Pit").
import * as THREE from 'three';
import { Vox, M, glow } from '../../../vox/vox.js';
import { buildCharacter, JOINT } from '../../../avatar/build.js';
import { Batch, lamp, drawText } from '../../kit.js';
import { P } from '../../bits.js';
import {
  pallorLook, mottleHead, stretchHead, eraseNose,
  bulgingEye, hollowSocket, carvedSmile, localJointMat, jointMat,
} from '../../uncanny.js';

const S = [0.0255, 0.0285, 0.0255];

const CLIMBER_STAFF = [
  { skin: '#e6d0b2', hair: 'short', hairColor: '#221c19', outfit: 'cardigan', outfitColor: '#5d6b68', provider: 'claude' },
  { skin: '#ecd6ba', hair: 'side', hairColor: '#4a3524', outfit: 'vest', outfitColor: '#6b6352', provider: 'codex' },
  { skin: '#cfa483', hair: 'bun', hairColor: '#1b181a', outfit: 'cardigan', outfitColor: '#7a5c58', provider: 'gemini' },
  { skin: '#e2c29e', hair: 'long', hairColor: '#2c221c', outfit: 'tee', outfitColor: '#566878', provider: 'opencode' },
  { skin: '#dfc5a6', hair: 'short', hairColor: '#5e3424', outfit: 'hoodie', outfitColor: '#635c70', provider: 'custom' },
];

export function makeGridTextures(c, p) {
  const { kit, look } = c;
  const trimHex = look?.trim || '#4b4639';

  // Slotted metal/laminate partition top-cap rail (tints naturally with floor look.trim)
  const cap = kit.tex.custom(`cg:cap:${trimHex}`, 128, 64, (g, w, h) => {
    P(g, '#3b3934', 0, 0, w, h);
    P(g, trimHex, 0, 4, w, h - 8);
    P(g, 'rgba(28,26,23,0.42)', 0, 4, w, h - 8);
    // Side steel channels & center seam
    P(g, '#23221f', 0, 0, w, 5);
    P(g, '#23221f', 0, h - 5, w, 5);
    P(g, '#666258', 0, 5, w, 2);
    P(g, '#666258', 0, h - 7, w, 2);
    P(g, 'rgba(18,17,15,0.35)', 0, h / 2 - 1, w, 2);
    // Connector post rivets & dusty shoe-sole scuffs along the balance track
    for (let x = 0; x < w; x += 32) {
      P(g, '#252420', x, 0, 3, h);
      P(g, '#7c786c', x + 1, 9, 2, 2);
      P(g, '#7c786c', x + 1, h - 11, 2, 2);
    }
    P(g, 'rgba(210,202,180,0.10)', 18, 18, 34, 12);
    P(g, 'rgba(210,202,180,0.09)', 74, 30, 38, 12);
  });

  // Diagonal yellow/black CAUTION barrier tape stretched across broken partition gaps
  const caution = kit.tex.custom('cg:caution', 128, 32, (g, w, h) => {
    P(g, '#dfb022', 0, 0, w, h);
    g.fillStyle = '#1b1a17';
    for (let x = -32; x < w + 32; x += 24) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 11, 0);
      g.lineTo(x - 5, h);
      g.lineTo(x - 16, h);
      g.closePath();
      g.fill();
    }
    P(g, 'rgba(0,0,0,0.22)', 0, 0, w, 3);
    P(g, 'rgba(0,0,0,0.22)', 0, h - 3, w, 3);
  });

  // 2x2 self-luminous CRT screen atlas glowing dimly at the bottom of the sunken cubicles
  const dept = (p.dept || 'RETENTION').slice(0, 12).toUpperCase();
  const crtAtlas = kit.tex.custom(`cg:crts:${dept}`, 128, 128, (g) => {
    // Top-left: eerie green QA smile prompt
    P(g, '#040b06', 0, 0, 64, 64);
    drawText(g, [dept, 'SMILE FOR QA', 'QUOTA: FOREVER'], 4, 10, 56, 44, { color: '#69eb8a', size: 8, pad: 2 });
    // Top-right: amber warning
    P(g, '#0d0803', 64, 0, 64, 64);
    drawText(g, ['DO NOT', 'LOOK UP', 'KEEP TYPING'], 68, 10, 56, 44, { color: '#f0b24a', size: 8, pad: 2 });
    // Bottom-left: cyan-mint recursion terminal
    P(g, '#040b0c', 0, 64, 64, 64);
    drawText(g, ['DESK -3.6M', 'SUB-CUBICLE', 'OCCUPIED'], 4, 74, 56, 44, { color: '#7ce8d4', size: 8, pad: 2 });
    // Bottom-right: dead snow static
    P(g, '#0e1012', 64, 64, 64, 64);
    let s = 4419;
    for (let y = 66; y < 126; y += 2) {
      for (let x = 66; x < 126; x += 2) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        const v = 36 + ((s >>> 24) & 150);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x, y, 2, 1);
      }
    }
  }, { clamp: true });

  // Deadpan Backrooms Facilities / HR safety placard
  const signWarn = kit.tex.custom(`cg:sign:${dept}`, 192, 144, (g, w, h) => {
    P(g, '#ede6d1', 0, 0, w, h);
    P(g, '#1f1e1b', 3, 3, w - 6, h - 6);
    P(g, '#ede6d1', 6, 6, w - 12, h - 12);
    P(g, '#b8281e', 10, 10, w - 20, 28);
    drawText(g, ['OPEN-PLAN SEATING PIT'], 12, 13, w - 24, 22, { color: '#fff8eb', size: 11, weight: 800 });
    drawText(g, [
      `DEPT: ${dept}`,
      'WALK PARTITION CAPS ONLY',
      'DO NOT FALL INTO CUBICLES',
      'SHUT DOOR BEHIND YOU',
    ], 12, 44, w - 24, 88, { color: '#1b1b19', size: 10, weight: 700, pad: 3 });
  }, { clamp: true });

  // Faint eerie phosphor glow at the bottom of the 2 bottomless recursive cubicle wells
  const abyssGlow = kit.tex.custom('cg:abyss-glow', 64, 64, (g, w, h) => {
    P(g, '#030806', 0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      const m = 4 + i * 4;
      P(g, i % 2 === 0 ? '#113826' : '#06140e', m, m, w - m * 2, h - m * 2);
    }
    P(g, '#4fd68a', 26, 26, 12, 12);
  }, { clamp: true });

  return { cap, caution, crtAtlas, signWarn, abyssGlow };
}

/** 1990s bulky beige CRT monitor (~140 tris) for sunken & sideways cubicles. */
export function pitCrtVox() {
  const v = new Vox();
  const beige = M('#bdb49d', 0), dark = M('#8c846f', 0), bezel = M('#141514', 0);
  v.box(-5, 0, -4, 5, 2, 4, dark);
  v.box(-2, 2, -2, 2, 4, 2, dark);
  v.box(-6, 5, -8, 6, 17, -2, dark);
  v.box(-9, 4, -2, 9, 19, 7, beige);
  v.carve(-7, 6, 7, 7, 17, 7);
  v.box(-7, 6, 6, 7, 17, 6, bezel);
  v.set(7, 5, 7, glow('#55e87c'));
  return v;
}

/** Classic 1990s office watercooler balanced on the precarious mid-grid spur. */
export function watercoolerVox() {
  const v = new Vox();
  const body = M('#dcd6c6', 1), panel = M('#b5ae9c', 1), tapR = M('#c83228', 0), tapB = M('#2d6da8', 0);
  const jug = M('#6aa8c7', 0), cap = M('#29587a', 0);
  v.box(-5, 0, -5, 5, 22, 5, body);
  v.box(-4, 12, 5, 4, 19, 6, panel);
  v.set(-2, 16, 6, tapR);
  v.set(2, 16, 6, tapB);
  v.box(-3, 22, -3, 3, 24, 3, cap);
  v.cyl('y', 0, 0, 24, 36, 4.4, jug);
  return v;
}

function buildSmilingHeadVox(spec, idx) {
  const look = pallorLook(spec, { pallor: 0.58, tint: '#dfdac8' });
  const parts = buildCharacter(look, { seed: `cg:head:${idx}`, provider: spec.provider });
  const head = parts.head;
  eraseNose(head);
  mottleHead(head, look.skin, 131 + idx * 23, { gaunt: 0.42 });

  // Alternate between unblinking bulging eyes with glowing pinpoint pupils and hollow ember sockets
  if (idx % 2 === 0) {
    bulgingEye(head, -4.5, 44, 4, 4, 0, 1, look.skin, { bloodshot: true, glowPupil: true });
    bulgingEye(head, 3.5, 44, 4, 4, 0, 1, look.skin, { bloodshot: true, glowPupil: true });
  } else {
    hollowSocket(head, -4.5, 44, 4, 4, look.skin, { ember: true });
    hollowSocket(head, 3.5, 44, 4, 4, look.skin, { ember: true });
  }

  // Deeply carved ear-to-ear corporate rictus grin with gleaming self-lit teeth visible down in the dark pit
  carvedSmile(head, look.skin, {
    halfW: 7,
    yLow: 36,
    lift: 7.8,
    openH: 4.2,
    teeth: true,
  });
  const gleamTooth = glow('#f2eee0');
  for (let x = -5; x <= 5; x += 2) {
    const u = (x + 0.5) / 7;
    const yc = Math.round(36 + 7.8 * u * u);
    head.set(x, yc, 6, gleamTooth);
  }
  stretchHead(head, 5, 47);
  return head;
}

function buildClimberLimbs(kit, idx) {
  const spec = CLIMBER_STAFF[idx % CLIMBER_STAFF.length];
  const look = pallorLook(spec, { pallor: 0.58, tint: '#dfdac8' });
  const parts = buildCharacter(look, { seed: `cg:body:${idx}`, provider: spec.provider });

  // Pale clammy fingertips
  const gripCol = M('#cfc9b4', 1);
  parts.armLowerL.paint(-14, 14, -4, 14, 17, 4, () => gripCol);
  parts.armLowerR.paint(-14, 14, -4, 14, 17, 4, () => gripCol);

  // Hunched torso + bent scrambling legs baked into one compact body batch
  const bodyB = new Batch(true);
  const addBody = (key, vox, m) => {
    const mod = kit.model(`cg:${idx}:${key}`, () => vox);
    if (mod.solid) bodyB.addVox(mod.solid, m);
  };
  addBody('torso', parts.torso, jointMat(S, JOINT.hips, 0.22, 0, 0, 1.04));
  addBody('legUL', parts.legUpperL, jointMat(S, JOINT.hipL, -0.34, 0, -0.08));
  addBody('legLL', parts.legLowerL, jointMat(S, JOINT.hipL, 0.22, 0, -0.08));
  addBody('legUR', parts.legUpperR, jointMat(S, JOINT.hipR, 0.26, 0, 0.08));
  addBody('legLR', parts.legLowerR, jointMat(S, JOINT.hipR, -0.18, 0, 0.08));

  const armLB = new Batch(true);
  const armULMod = kit.model(`cg:${idx}:armUL`, () => parts.armUpperL);
  const armLLMod = kit.model(`cg:${idx}:armLL`, () => parts.armLowerL);
  if (armULMod.solid) armLB.addVox(armULMod.solid, localJointMat(S, JOINT.shoulderL, 0, 0, 0, 1.12));
  if (armLLMod.solid) armLB.addVox(armLLMod.solid, localJointMat(S, JOINT.shoulderL, -0.18, 0, 0, 1.12));

  const armRB = new Batch(true);
  const armURMod = kit.model(`cg:${idx}:armUR`, () => parts.armUpperR);
  const armLRMod = kit.model(`cg:${idx}:armLR`, () => parts.armLowerR);
  if (armURMod.solid) armRB.addVox(armURMod.solid, localJointMat(S, JOINT.shoulderR, 0, 0, 0, 1.12));
  if (armLRMod.solid) armRB.addVox(armLRMod.solid, localJointMat(S, JOINT.shoulderR, -0.18, 0, 0, 1.12));

  const headB = new Batch(true);
  const headMod = kit.model(`cg:${idx}:head`, () => buildSmilingHeadVox(spec, idx));
  if (headMod.solid) headB.addVox(headMod.solid, localJointMat(S, JOINT.head, 0, 0, 0));

  return { bodyB, armLB, armRB, headB };
}

/** Articulated Smiling Office Worker rig (`4` small meshes sharing `1` material). */
export function buildSmilingClimber(kit, idx = 0) {
  const lights = [lamp(0.2, 2.5, 0.9, [1.25, 1.25, 1.22], { k: 8, wrap: 0.5, far: 24 })];
  const amb = [0.56, 0.56, 0.54];
  const mat = kit.surface({ vox: true });

  const { bodyB, armLB, armRB, headB } = buildClimberLimbs(kit, idx);

  const bodyGroup = new THREE.Group();
  const bodyMesh = new THREE.Mesh(kit.geometry(bodyB, lights, amb), mat);
  bodyGroup.add(bodyMesh);

  const head = new THREE.Group();
  head.position.set(JOINT.head[0] * S[0], JOINT.head[1] * S[1] + 0.03, JOINT.head[2] * S[2] + 0.03);
  head.add(new THREE.Mesh(kit.geometry(headB, lights, amb), mat));
  bodyGroup.add(head);

  const armL = new THREE.Group();
  armL.position.set(JOINT.shoulderL[0] * S[0], JOINT.shoulderL[1] * S[1], JOINT.shoulderL[2] * S[2]);
  armL.add(new THREE.Mesh(kit.geometry(armLB, lights, amb), mat));
  bodyGroup.add(armL);

  const armR = new THREE.Group();
  armR.position.set(JOINT.shoulderR[0] * S[0], JOINT.shoulderR[1] * S[1], JOINT.shoulderR[2] * S[2]);
  armR.add(new THREE.Mesh(kit.geometry(armRB, lights, amb), mat));
  bodyGroup.add(armR);

  const group = new THREE.Group();
  group.add(bodyGroup);

  const tiltSign = idx % 2 === 0 ? 1 : -1;

  return {
    group,
    bodyGroup,
    head,
    armL,
    armR,
    pose(phase, t, relYaw = 0) {
      const clampedYaw = Math.max(-1.85, Math.min(1.85, relYaw));
      if (phase === 'seated') {
        bodyGroup.position.set(0, -0.22, 0);
        bodyGroup.rotation.set(0.32, 0, 0);
        // Even down in the pit, their head slowly tilts up with that fixed wide grin
        head.rotation.set(-0.68 + Math.sin(t * 1.1) * 0.06, clampedYaw * 0.4, tiltSign * 0.18);
        armL.rotation.set(-0.75, 0, -0.12);
        armR.rotation.set(-0.75, 0, 0.12);
      } else if (phase === 'climbing') {
        const reach = Math.sin(t * 4.4);
        bodyGroup.position.set(0, Math.abs(reach) * 0.04, 0);
        bodyGroup.rotation.set(0.14, 0, reach * 0.07);
        // Craned sharply backward so the gleaming smile stares straight UP out of the cubicle shaft!
        head.rotation.set(-1.12, clampedYaw * 0.35, tiltSign * 0.22 + reach * 0.08);
        armL.rotation.set(-2.55 + reach * 0.52, 0.12, -0.18);
        armR.rotation.set(-2.55 - reach * 0.52, -0.12, 0.18);
      } else if (phase === 'falling') {
        bodyGroup.position.set(0, 0, 0);
        bodyGroup.rotation.set(-0.55, 0, Math.sin(t * 14) * 0.35);
        head.rotation.set(-0.4, 0, tiltSign * 0.4);
        armL.rotation.set(-2.2, 0, -0.75);
        armR.rotation.set(-2.2, 0, 0.75);
      } else {
        // 'stalking' | 'recoiling' | 'returning': crooked tightrope balance prowl along the partition tops!
        const stride = Math.sin(t * 5.8);
        const sway = Math.sin(t * 2.9 + idx);
        bodyGroup.position.set(0, Math.abs(stride) * 0.03, 0);
        bodyGroup.rotation.set(0.26, 0, sway * 0.09);
        head.rotation.set(-0.18, clampedYaw, tiltSign * 0.28 + sway * 0.10);
        // Arms held out wide like grotesque tightrope walkers, reaching forward as they close in
        armL.rotation.set(-0.82 + stride * 0.28, 0.15, -0.72 - sway * 0.14);
        armR.rotation.set(-0.82 - stride * 0.28, -0.15, 0.72 - sway * 0.14);
      }
    },
    light(rgb) {
      // Clamp minimum visibility so their pale grinning faces still read eerily down inside the dark shafts
      mat.uniforms.uTint.value.set(
        Math.max(0.20, rgb[0]),
        Math.max(0.20, rgb[1]),
        Math.max(0.19, rgb[2]),
      );
    },
  };
}
