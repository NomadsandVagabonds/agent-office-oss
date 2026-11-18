// Voxel rig for The Stand-Ins: elongated, neck-broken Backrooms doppelgängers
// of the real upstairs Office cast (`c.env.cast`) standing in Blackout Bay.
// Built from `avatar/build.js` so you recognise a teammate's hoodie, hair,
// lanyard, or species silhouette — until your flashlight beam hits their
// hollowed sockets, bulging multi-eyes, shattered visors, and scan-slipped jaws.
import * as THREE from 'three';
import { M, glow } from '../../../vox/vox.js';
import { buildCharacter, JOINT } from '../../../avatar/build.js';
import { legsFor } from '../../walk-legs.js';
import { Batch, lamp } from '../../kit.js';
import {
  pallorLook, mottleHead, eraseNose, bulgingEye, hollowSocket,
  slippedMouth, carvedSmile, carveCreases, crookedSpecs, slipRows, jointMat,
} from '../../uncanny.js';

const S = [0.0235, 0.0325, 0.0235];

function corruptStandInHead(head, look, hadSpecs, idx) {
  if (look.species === 'robot') {
    // Cracked visor gouged open on one side, one glaring static eye, wrenched grille
    hollowSocket(head, 4, 43.5, 5, 5, '#5a626e', { ember: false });
    bulgingEye(head, -4, 44, 4, 4, 0, 0, '#5a626e', { glowPupil: true, glitch: 2 });
    head.carve(-3, 35, 6, 3, 39, 9);
    for (const x of [-3, -1, 1, 3]) head.box(x, 35, 6, x + 1, 39, 7, M('#9aa3b0', 0));
    // Exposed copper/crimson wire stubs dangling from the shattered socket
    head.tube(4, 42, 6, 5, 38, 9, 0.55, M('#a8322b', 0));
    head.tube(3, 41, 6, 2, 37, 8, 0.5, M('#c9933b', 0));
    slipRows(head, [[41, 42, -2, 0], [36, 37, 1, 0]]);
    return;
  }

  mottleHead(head, look.skin, 613 + idx * 37, { gaunt: 0.44 });
  if (look.species === 'human') eraseNose(head);

  const mode = idx % 4;
  if (mode === 0) {
    // One giant bulging sclera + one deep hollow socket + gaping vertical jaw
    bulgingEye(head, -4.5, 44, 5, 5, 0, 0, look.skin, { bloodshot: true, glitch: 2 });
    hollowSocket(head, 4, 43.5, 5, 5, look.skin, { ember: true });
    slippedMouth(head, 0, 36, 5, 5, look.skin, { curve: 0, slope: -0.1, teeth: true });
    carveCreases(head, look.skin, [[-7, 40, -3, 38, true], [3, 40, 7, 39, true]]);
    slipRows(head, [[38, 39, 2, 0]]);
  } else if (mode === 1) {
    // Three crammed staring eyes + horizontal cheek folds
    bulgingEye(head, -5, 44, 3, 4, 0, 0, look.skin);
    bulgingEye(head, 0, 45, 4, 4, 0, -1, look.skin, { bloodshot: true });
    bulgingEye(head, 5, 43, 3, 4, -1, 0, look.skin);
    slippedMouth(head, -1, 36, 8, 3, look.skin, { curve: -0.8, slope: 0.2, teeth: true });
    carveCreases(head, look.skin, [[-7, 40, 7, 39, true], [-6, 35, 5, 35, false]]);
    slipRows(head, [[40, 41, -1, 0]]);
  } else if (mode === 2) {
    // Slid eye on the cheek + vertical off-side screamer gash
    bulgingEye(head, -4, 45, 5, 5, 1, 0, look.skin, { bloodshot: true });
    bulgingEye(head, 4.5, 40, 3, 3, 0, 0, look.skin);
    slippedMouth(head, -2, 36, 4, 6, look.skin, { curve: 0, slope: 0, teeth: true });
    carveCreases(head, look.skin, [[1, 45, 7, 44, true], [-7, 41, -4, 38, true]]);
    slipRows(head, [[42, 43, -2, 0], [36, 37, 1, 0]]);
  } else {
    // Twin hollow pits with buried glowing pinpricks + carved cheek-to-cheek grin
    hollowSocket(head, -4.5, 44, 4, 5, look.skin, { ember: true });
    hollowSocket(head, 4, 44, 4, 5, look.skin, { ember: true });
    carvedSmile(head, look.skin, { halfW: 7, yLow: 36, lift: 7.0, openH: 3.6, teeth: true });
    slipRows(head, [[43, 44, 1, 0], [37, 38, -2, 0]]);
  }

  if (hadSpecs) {
    crookedSpecs(head, { leftY: 42, rightY: 40, h: 5, z: 9, frameHex: '#181512' });
  }
}

export function buildStandIn(kit, who, idx = 0) {
  const keyBase = `standin:${who.name || idx}:${idx}`;
  const sign = idx % 2 === 0 ? 1 : -1;
  const rawAcc = who.look?.accessory;
  const hadSpecs = rawAcc === 'glasses' || rawAcc === 'shades' || rawAcc === 'monocle';
  const look = pallorLook(
    { ...(who.look || {}), accessory: hadSpecs ? 'none' : (rawAcc || 'none') },
    { pallor: 0.44, tint: '#cfd2bf' },
  );

  const parts = buildCharacter(look, { seed: `standin:${who.name}:${idx}` });
  corruptStandInHead(parts.head, look, hadSpecs, idx);

  // Darken dangling fingertips
  for (const arm of [parts.armLowerL, parts.armLowerR]) {
    arm.paint(-12, 14, -4, 12, 17, 4, M('#361519', 1));
  }

  const b = new Batch(true);
  const rootM = new THREE.Matrix4().makeScale(S[0], S[1], S[2]);
  const addPart = (sub, vox, mat4) => {
    if (!vox) return;
    const geo = kit.model(`${keyBase}:${sub}`, () => vox);
    if (geo?.solid) b.addVox(geo.solid, mat4);
  };

  // Snapped neck tilt + crooked slumped shoulders + long dangling arms past the knees
  const headM = jointMat(S, JOINT.head, 0.14, sign * 0.14, sign * 0.44, 1.05);
  addPart('head', parts.head, headM);
  if (parts.accessory) addPart('acc', parts.accessory, headM);

  const torsoM = jointMat(S, JOINT.hips, 0.08, 0, -sign * 0.07, 1.07);
  addPart('torso', parts.torso, torsoM);

  const armLM = jointMat(S, JOINT.shoulderL, -0.18, 0, -0.11, 1.34);
  const armRM = jointMat(S, JOINT.shoulderR, -0.09, 0, 0.13, 1.30);
  addPart('armUL', parts.armUpperL, armLM);
  addPart('armLL', parts.armLowerL, armLM);
  addPart('armUR', parts.armUpperR, armRM);
  addPart('armLR', parts.armLowerR, armRM);

  addPart('legUL', parts.legUpperL, rootM);
  addPart('legLL', parts.legLowerL, rootM);
  addPart('legUR', parts.legUpperR, rootM);
  addPart('legLR', parts.legLowerR, rootM);

  const lights = [lamp(0, 2.2, 0.6, [0.03, 0.03, 0.04], { k: 6, wrap: 0.6, far: 18 })];
  const amb = [0.012, 0.012, 0.016];
  const mat = kit.surface({ vox: true });
  const mesh = new THREE.Mesh(kit.geometry(b, lights, amb), mat);
  const group = new THREE.Group();
  group.add(mesh);
  // Its legs walk while it comes on in the dark (walk-legs.js), by how far the room has moved it: read as it is drawn, so
  // nothing in the room has to ask (a frame behind, which nobody standing in the dark will see). Still, it is still.
  const step = legsFor(mesh, { hip: JOINT.hipL[1] * S[1], knee: JOINT.kneeL[1] * S[1], stride: 0.85, swing: 0.5, fold: 0.85,
    keep: (x) => Math.abs(x) > 7 * S[0] });                                          // (its arms hang past its knees: not legs)
  let clock = 0, seen = null;
  mesh.onBeforeRender = () => {
    const now = (globalThis.performance?.now?.() ?? 0) / 1000;
    if (seen !== null) clock += Math.min(0.1, Math.max(0, now - seen));
    seen = now;
    step(group.position.x, group.position.z, clock);
  };

  return {
    group,
    mesh,
    light(rgb) {
      mat.uniforms.uTint.value.set(
        Math.max(0.42, rgb[0]),
        Math.max(0.42, rgb[1]),
        Math.max(0.45, rgb[2]),
      );
    },
  };
}
