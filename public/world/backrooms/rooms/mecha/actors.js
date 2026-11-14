// Native voxel people reduced to task apparatus. Two moving batches per active
// worker; background shifts join the room batch without adding scene meshes.
import * as THREE from 'three';
import { Batch } from '../../kit.js';
import { Vox, M } from '../../../vox/vox.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const UNIT = .04;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ROLES = {
  lawyer: { color: '#393e39', rate: 1.08 },
  accountant: { color: '#5b6247', rate: 2.45 },
  doctor: { color: '#a5ad91', rate: .83 },
  psychiatrist: { color: '#63564d', rate: .66 },
};
const SKIN = ['#a9aa87', '#8b9272', '#b4b191', '#81886b'];

function sculpt(role, variant) {
  const style = ROLES[role] || ROLES.accountant;
  const skin = M(SKIN[variant % SKIN.length], 0), shadow = M('#676e55', 0);
  const cloth = M(style.color, 0), dark = M('#252c25', 0), pale = M('#b7b59a', 0);
  const steel = M('#929884', 0), black = M('#1b221d', 0), bone = M('#dedcba', 0);
  const lower = new Vox(), torso = new Vox(), head = new Vox();
  // Overlong folded legs: the thin shins end in shoes that never leave the floor.
  for (const s of [-1, 1]) {
    const x = s < 0 ? -5 : 1;
    lower.box(x, -4, 0, x + 4, 1, 9, cloth);
    lower.box(x, -11, 7, x + 3, -4, 10, cloth);
    lower.box(x, -12, 7, x + 4, -10, 13, dark);
    lower.paint(x, -8, 7, x + 3, -7, 10, black);
  }
  lower.box(-4, 0, -2, 4, 3, 3, cloth);
  torso.box(-4, 0, -2, 4, 11, 3, cloth);
  torso.box(-4, 11, -1, 3, 13, 4, cloth);
  torso.box(-6, 8, -1, -4, 12, 3, cloth);
  torso.box(4, 7, -1, 6, 10, 3, cloth);
  // A neck too long for the old uniform, with an external dark throat tendon.
  torso.box(-1, 11, 1, 2, 20, 4, skin);
  torso.paint(0, 12, 3, 1, 19, 4, shadow);
  torso.paint(-4, 1, 2, 4, 3, 3, black); // locked waist belt
  torso.paint(-3, 7, 2, -2, 11, 3, black);
  torso.paint(2, 7, 2, 3, 11, 3, black);
  torso.box(-1, 9, -3, 1, 11, -2, steel); // spinal socket
  torso.box(0, 16, 0, 2, 18, 1, steel);   // throat / nape connector
  if (role === 'doctor') {
    torso.paint(-4, 3, 2, -2, 8, 3, pale);
    torso.paint(2, 3, 2, 4, 7, 3, pale);
    torso.paint(-1, 4, 2, 1, 11, 3, dark);
    torso.paint(-2, 8, 2, -1, 11, 3, steel);
    torso.paint(1, 8, 2, 2, 11, 3, steel);
    torso.paint(-1, 7, 2, 1, 8, 3, steel);
  } else if (role === 'lawyer') {
    torso.paint(-2, 8, 2, 2, 11, 3, pale);
    torso.paint(0, 5, 2, 1, 11, 3, M('#6f4532', 0));
    torso.paint(-2, 7, 2, -1, 8, 3, pale);
  } else if (role === 'accountant') {
    torso.paint(-3, 8, 2, 3, 11, 3, pale);
    torso.paint(-3, 5, 2, -2, 11, 3, dark);
    torso.paint(2, 5, 2, 3, 11, 3, dark);
    torso.paint(0, 8, 2, 1, 10, 3, dark);
  } else {
    torso.paint(-1, 3, 2, 1, 11, 3, pale);
    torso.paint(0, 4, 2, 1, 5, 3, dark);
    torso.paint(0, 7, 2, 1, 8, 3, dark);
  }
  torso.paint(-4, 7, 3, -2, 10, 4, pale);
  // The swollen, uneven cranial vault is deliberately unlike the round office
  // avatar. A narrow jaw hangs beneath a broad forehead, pitched into the task.
  head.box(-3, 0, -2, 3, 5, 4, skin);
  head.box(-5, 5, -3, 5, 12, 4, skin);
  head.box(-4, 12, -3, 4, 15, 3, skin);
  head.box(5, 7, -2, 6, 12, 3, skin);
  head.paint(-4, 12, -3, 4, 13, 3, shadow); // sparse cropped hair
  head.paint(-4, 13, -3, 4, 15, 3, M('#4c5343', 0));
  head.paint(-3, 1, 3, 3, 2, 4, shadow);
  head.paint(-1, 2, 3, 1, 4, 4, black); // slack, silent mouth
  // Wide whites are bounded by actual metal upper/lower eyelid spreaders.
  head.paint(-4, 7, 3, -1, 10, 4, bone);
  head.paint(1, 6, 3, 5, 9, 4, bone);
  head.paint(-3, 7, 3, -2, 9, 4, black);
  head.paint(3, 6, 3, 4, 8, 4, black);
  head.box(-5, 6, 4, -4, 11, 5, steel);
  head.box(5, 5, 4, 6, 10, 5, steel);
  head.box(-4, 10, 4, -1, 11, 5, steel);
  head.box(-4, 6, 4, -1, 7, 5, steel);
  head.box(1, 9, 4, 5, 10, 5, steel);
  head.box(1, 5, 4, 5, 6, 5, steel);
  // Clamp straps run around the temples. Crown terminals connect to the rigs.
  head.paint(-5, 10, -3, 5, 11, 4, dark);
  head.box(-3, 15, -1, -1, 17, 1, steel);
  head.box(2, 15, -1, 4, 16, 1, steel);
  head.box(-1, 8, -4, 1, 10, -3, dark);
  return { lower, torso, head, cloth, skin, steel, dark };
}

/**
 * Worker origin is the chair centre. +Z is their front before rotation.
 * Hands end at y .78–.9, z .7–.9. Static workers add no moving meshes.
 * attachments contains room-local cable endpoints at the initial working pose.
 */
export function createWorker(c, { id, role, x, z, rot = 0, variant = 0, static: isStatic = false }) {
  variant = Math.abs(Math.trunc(variant)) % 4;
  const style = ROLES[role] || ROLES.accountant;
  const parts = sculpt(role, variant);
  const rootM = new THREE.Matrix4().makeRotationY(rot);
  rootM.setPosition(x, 0, z);
  const point = (a) => new THREE.Vector3(...a).applyMatrix4(rootM);
  const compose = (position, rotation, scale = [UNIT, UNIT, UNIT]) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    return rootM.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...position), q, new THREE.Vector3(...scale)));
  };
  const geo = (key, make) => c.kit.model(`mecha:worker:${role}:${variant}:${key}:v2`, make).solid;
  const add = (batch, key, make, matrix) => batch.addVox(geo(key, make), matrix);
  add(c.vox, 'lower', () => parts.lower, compose([0, .48, 0], [0, 0, 0]));
  const bodyBatch = isStatic ? c.vox : new Batch(true);
  const headBatch = isStatic ? c.vox : new Batch(true);
  const torsoMatrix = compose([0, .48, -.03], [.2, 0, -.04]);
  add(bodyBatch, 'torso', () => parts.torso, torsoMatrix);
  const segment = (key, a, b, sleeve = false) => {
    const delta = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = delta.length(), q = new THREE.Quaternion().setFromUnitVectors(DOWN, delta.normalize());
    const m = rootM.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...a), q,
      new THREE.Vector3(UNIT, length / 10, UNIT)));
    add(bodyBatch, key, () => {
      const v = new Vox();
      if (sleeve) v.box(-1, -10, -1, 2, 0, 2, parts.cloth);
      else {
        v.box(-1, -10, 0, 1, 0, 2, parts.skin);
        v.paint(0, -8, 1, 1, -1, 2, M('#626b50', 0)); // exposed tendon line
        v.paint(-1, -8, 0, 1, -7, 2, parts.steel);    // wrist restraint
        v.box(-1, -10, -1, 2, -8, 2, parts.skin);
      }
      return v;
    }, m);
  };
  for (const sign of [-1, 1]) {
    const shoulder = [sign * .25, sign < 0 ? .94 : .88, .08];
    const elbow = [sign * .35, .72, .36];
    let hand = [sign * .22, .83, .84];
    if (role === 'lawyer' && sign > 0) hand = [.21, .9, .8];
    if (role === 'doctor' && sign > 0) hand = [.08, .89, .79];
    if (role === 'psychiatrist' && sign < 0) hand = [-.26, 1.17, .32];
    segment(`upper${sign}`, shoulder, elbow, true);
    segment(`forearm${sign}`, elbow, hand);
  }
  if (role === 'lawyer') add(bodyBatch, 'stamp', () => {
    const v = new Vox(); v.box(-2, 0, -2, 2, 1, 2, parts.dark);
    v.box(0, 1, -1, 1, 3, 1, M('#6c4231', 0)); return v;
  }, compose([.21, .78, .8], [0, 0, 0]));
  if (role === 'psychiatrist') add(bodyBatch, 'receiver', () => {
    const v = new Vox(); v.box(-1, -3, 0, 1, 3, 1, parts.dark);
    v.box(-1, -4, -1, 1, -2, 1, parts.dark);
    v.box(-1, 2, -1, 1, 4, 1, parts.dark); return v;
  }, compose([-.26, 1.2, .31], [.08, 0, .15]));

  const headAt = [.045, 1.13, .12];
  const headMatrix = compose(headAt, [.18, 0, -.075]);
  add(headBatch, 'head', () => parts.head, headMatrix);
  const transformed = (p, matrix) => new THREE.Vector3(...p).applyMatrix4(matrix).toArray();
  const attachments = {
    crown: transformed([-2, 17, 0], headMatrix),
    crownSide: transformed([3, 16, 0], headMatrix),
    nape: transformed([0, 9, -4], headMatrix),
    spine: transformed([0, 10, -3], torsoMatrix),
    throat: transformed([1, 17, 0], torsoMatrix),
  };
  const workingRead = { id, role, working: true, relief: 0, headYaw: 0, headHeight: headAt[1], meshes: isStatic ? 0 : 2, static: isStatic, attachments };
  if (isStatic) return { body: null, head: null, attachments, update() {}, read: () => ({ ...workingRead }) };

  const bodyPivot = point([0, .48, -.03]), headPivot = point(headAt);
  const body = c.dynamic(bodyBatch, { pivot: bodyPivot.toArray() });
  const head = c.dynamic(headBatch, { pivot: headPivot.toArray() });
  body.name = `mecha-worker-${id}-work`; head.name = `mecha-worker-${id}-head`;
  const pitchAxis = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  const rollAxis = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
  const yawQ = new THREE.Quaternion(), pitchQ = new THREE.Quaternion(), rollQ = new THREE.Quaternion();
  let last = workingRead, rest = 0, previousTime = null;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function update({ time = 0, working = true, relief = 0, playerX = x, playerZ = z + 2 } = {}) {
    const dt = previousTime === null ? 1 / 60 : clamp(time - previousTime, 0, .1);
    previousTime = time;
    const target = working ? 0 : Math.max(.7, clamp(relief, 0, 1));
    rest += (target - rest) * (1 - Math.exp(-dt * 3.2));
    const phase = time * style.rate * Math.PI * 2 + variant * 1.71;
    const work = (1 - rest) * (reduced ? 0 : 1);
    const pulse = role === 'lawyer' ? Math.pow(Math.max(0, Math.sin(phase)), 5) : Math.sin(phase);
    const dip = role === 'lawyer' ? .052 * pulse : role === 'doctor' ? .025 * pulse : .012 * pulse;
    const side = role === 'accountant' ? Math.sin(phase * .5) * .018 : 0;
    pitchQ.setFromAxisAngle(pitchAxis, dip * work - .12 * rest);
    rollQ.setFromAxisAngle(rollAxis, side * work);
    body.quaternion.copy(pitchQ).multiply(rollQ);
    body.position.copy(bodyPivot);
    const wantedYaw = Math.atan2(playerX - x, playerZ - z) - rot;
    const wrappedYaw = Math.atan2(Math.sin(wantedYaw), Math.cos(wantedYaw));
    const gaze = clamp(wrappedYaw, -1.12, 1.12) * rest;
    const nod = (role === 'psychiatrist' ? .055 : .016) * Math.sin(phase) * work;
    yawQ.setFromAxisAngle(UP, gaze);
    pitchQ.setFromAxisAngle(pitchAxis, nod - .3 * rest);
    rollQ.setFromAxisAngle(rollAxis, -.035 * work + .025 * rest);
    head.quaternion.copy(yawQ).multiply(pitchQ).multiply(rollQ);
    head.position.copy(headPivot); head.position.y += .075 * rest;
    const forward = -.1 * rest;
    head.position.x += Math.sin(rot) * forward; head.position.z += Math.cos(rot) * forward;
    last = { ...workingRead, working, relief: rest, headYaw: gaze, headHeight: head.position.y };
  }
  update({ time: 0, working: true });
  return { body, head, attachments, update, read: () => ({ ...last }) };
}
