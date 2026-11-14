// The same people as upstairs, seated and strained by the conditioning rigs.
// Native human parts keep their rounded voxel contours, skin and clothes.
// Two moving batches per active worker; limb ranges articulate within the body
// batch so twenty-four occupied cages do not require twenty-four Avatar rigs.
import * as THREE from 'three';
import { Batch, lin } from '../../kit.js';
import { Vox, M, VOXEL } from '../../../vox/vox.js';
import { JOINT } from '../../../avatar/build.js';
import { sculptHuman, HUMAN_VARIANTS } from './humans.js';

const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RATES = { lawyer: 1.08, accountant: 2.45, doctor: .83, psychiatrist: .66 };

// Flexible ends share the body's batch; articulation adds no scene meshes.
function cableTail(batch, name, anchor, socket, radius, color) {
  const axis = socket.clone().sub(anchor).normalize();
  const u = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) < .9 ? UP : new THREE.Vector3(1, 0, 0)).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u).normalize();
  const ring = [u.clone().multiplyScalar(radius), v.clone().multiplyScalar(radius), u.clone().multiplyScalar(-radius), v.clone().multiplyScalar(-radius)];
  const start = batch.verts, weights = [];
  const p = (t, j) => anchor.clone().lerp(socket, t).add(ring[j]).addScaledVector(u, Math.sin(t * Math.PI) * .025).toArray();
  const quad = (points, ts) => {
    const first = batch.verts;
    batch.quad(...points, lin(color));
    for (let i = first; i < batch.verts; i++) {
      batch.vx.push(batch.pos[i * 3] / VOXEL, batch.pos[i * 3 + 1] / VOXEL, batch.pos[i * 3 + 2] / VOXEL);
      batch.sf.push(.04, 0);
    }
    weights.push(...ts);
  };
  for (const t of [0, .5]) for (let j = 0; j < 4; j++) {
    const k = (j + 1) % 4;
    quad([p(t, j), p(t, k), p(t + .5, k), p(t + .5, j)], [t, t, t + .5, t + .5]);
  }
  quad([p(0, 3), p(0, 2), p(0, 1), p(0, 0)], [0, 0, 0, 0]);
  quad([p(1, 0), p(1, 1), p(1, 2), p(1, 3)], [1, 1, 1, 1]);
  return { name, anchor, socket, start, end: batch.verts, weights, current: socket.clone() };
}

/** Chair centre is the origin; +Z faces the desk. Ports are room-space points. */
export function createWorker(c, { id, role, x, z, rot = 0, variant = 0, static: isStatic = false }) {
  variant = Math.abs(Math.trunc(variant)) % HUMAN_VARIANTS;
  const { parts, look, ports } = sculptHuman(role, variant);
  const root = new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z);
  const point = a => new THREE.Vector3(...a).applyMatrix4(root);
  const compose = (at, angles, scale, origin) => root.clone().multiply(new THREE.Matrix4().compose(
    new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles)),
    new THREE.Vector3(...scale))).multiply(new THREE.Matrix4().makeTranslation(...origin.map(v => -v)));
  const bodyBatch = isStatic ? c.vox : new Batch(true), headBatch = isStatic ? c.vox : new Batch(true);
  const ranges = [];
  function add(batch, key, matrix, vox = parts[key]) {
    const start = batch.verts;
    // Dense native figures retain their entire silhouette and grain. Their
    // room lighting supplies depth; skip per-voxel AO seams to keep the crowd
    // within the set-piece budget without coarsening faces or hair.
    const geo = c.kit.model(`mecha:human:${role}:${variant}:${key}:v1`, () => vox, { ao: false }).solid;
    batch.addVox(geo, matrix);
    return { start, end: batch.verts };
  }
  // The native hips stay on the existing chair. Knees splay and feet hang at
  // different angles; the person looks exhausted rather than assembled.
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'L' : 'R';
    add(c.vox, `legUpper${side}`, compose([sign * .09, .51, .01], [-1.44, sign * -.08, sign * .08],
      [VOXEL, .034, VOXEL], JOINT[`hip${side}`]));
    add(c.vox, `legLower${side}`, compose([sign * .12, .47, .315], [sign < 0 ? .08 : -.06, sign * .13, sign * -.035],
      [VOXEL, .044, VOXEL], JOINT[`knee${side}`]));
  }
  const slump = .20 + (variant % 3) * .025;
  const torsoAt = [0, .50, -.035];
  const torsoM = compose(torsoAt, [slump, 0, variant % 2 ? -.055 : .055], [VOXEL, .031, VOXEL], JOINT.hips);
  add(bodyBatch, 'torso', torsoM);
  const localPoint = (p, matrix) => new THREE.Vector3(...p).applyMatrix4(matrix);
  // Native skull is only modestly lengthened; the rounded jaw, ears and hair
  // remain recognizably those of an Office human.
  const neck = localPoint(JOINT.head, torsoM);
  const headAt = new THREE.Vector3(neck.x, neck.y + .025, neck.z + .015);
  const headLocal = headAt.clone().applyMatrix4(root.clone().invert()).toArray();
  const headM = compose(headLocal, [.08, 0, variant % 2 ? -.09 : .07], [.026, .029, .025], JOINT.head);
  add(headBatch, 'head', headM);

  const shoulderPivots = [], elbowPivots = [];
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'L' : 'R';
    const shoulder = [sign * .225, sign < 0 ? .945 : .92, .09];
    const elbow = [sign * .32, .735 + (variant % 2) * .025, .35];
    let hand = [sign * .20, .815, .81];
    if (role === 'lawyer' && sign > 0) hand = [.21, .87, .77];
    if (role === 'doctor' && sign > 0) hand = [.08, .85, .79];
    if (role === 'psychiatrist' && sign < 0) hand = [-.24, 1.20, .24];
    const segment = (key, origin, a, b, length) => {
      const delta = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
      const scaleY = delta.length() / length;
      const q = new THREE.Quaternion().setFromUnitVectors(DOWN, delta.normalize());
      const matrix = root.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...a), q,
        new THREE.Vector3(VOXEL, scaleY, VOXEL))).multiply(new THREE.Matrix4().makeTranslation(...origin.map(v => -v)));
      const range = add(bodyBatch, key, matrix);
      ranges.push({ ...range, side: sign < 0 ? 0 : 1, lower: key.includes('Lower') });
      return matrix;
    };
    segment(`armUpper${side}`, JOINT[`shoulder${side}`], shoulder, elbow, 8);
    segment(`armLower${side}`, JOINT[`elbow${side}`], elbow, hand, 9);
    shoulderPivots.push(point(shoulder)); elbowPivots.push(point(elbow));
  }
  if (role === 'lawyer' || role === 'psychiatrist') {
    const v = new Vox(), dark = M('#27251f', 1);
    if (role === 'lawyer') {
      v.box(-2, 0, -2, 2, 1, 2, dark); v.box(-1, 1, -1, 1, 4, 1, M('#6c4231', 2));
    } else {
      v.rbox(-1, -4, -1, 1, 4, 1, 1, dark);
      v.box(-2, -5, -2, 2, -3, 1, dark); v.box(-2, 3, -2, 2, 5, 1, dark);
    }
    const at = role === 'lawyer' ? [.21, .79, .77] : [-.24, 1.20, .24];
    const range = add(bodyBatch, 'held', compose(at, [0, 0, 0], [VOXEL, VOXEL, VOXEL], [0, 0, 0]), v);
    ranges.push({ ...range, side: role === 'lawyer' ? 1 : 0, lower: true });
  }
  const attachments = {};
  for (const [name, p] of Object.entries(ports.head)) attachments[name] = localPoint(p, headM).toArray();
  for (const [name, p] of Object.entries(ports.body)) attachments[name] = localPoint(p, torsoM).toArray();
  const workingRead = { id, role, working: true, relief: 0, headYaw: 0, headHeight: headAt.y,
    meshes: isStatic ? 0 : 2, static: isStatic, human: true, look: { ...look }, attachments };
  if (isStatic) return { body: null, head: null, attachments, update() {}, read: () => ({ ...workingRead }) };

  const bodyPivot = point(torsoAt);
  const cables = [];
  attachments.anchors = {};
  for (const [name, offset, radius, color] of [
    ['crown', [.03, .24, -.07], .042, '#716044'],
    ['nape', [0, .05, -.24], .029, '#676948'],
    ['spine', [-.05, -.04, -.19], .060, '#252721'],
  ]) {
    const socket = new THREE.Vector3(...attachments[name]);
    const delta = point(offset).sub(point([0, 0, 0]));
    const anchor = socket.clone().add(delta);
    attachments.anchors[name] = anchor.toArray();
    cables.push(cableTail(bodyBatch, name, anchor, socket, radius, color));
  }
  const body = c.dynamic(bodyBatch, { pivot: bodyPivot.toArray() });
  const head = c.dynamic(headBatch, { pivot: headAt.toArray() });
  body.name = `mecha-worker-${id}-work`; head.name = `mecha-worker-${id}-head`;
  // Batched rigid skinning: update only the four arm ranges at 24Hz. Rest
  // positions are immutable, so repeated motion never accumulates distortion.
  let positions, restPositions, lastPoseTime = -Infinity;
  c.after.push(() => {
    positions = body.userData.mesh.geometry.getAttribute('position');
    positions.setUsage(THREE.DynamicDrawUsage);
    restPositions = positions.array.slice();
    body.userData.mesh.geometry.boundingSphere.radius += .18;
  });
  const pitchAxis = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  const rollAxis = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
  const yawQ = new THREE.Quaternion(), pitchQ = new THREE.Quaternion(), rollQ = new THREE.Quaternion();
  const armQ = [new THREE.Quaternion(), new THREE.Quaternion()];
  const elbowQ = [new THREE.Quaternion(), new THREE.Quaternion()];
  const vertex = new THREE.Vector3();
  const inverseBody = new THREE.Quaternion(), drift = new THREE.Vector3();
  let last = workingRead, rest = 0, previousTime = null;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function update({ time = 0, working = true, relief = 0, playerX = x, playerZ = z + 2 } = {}) {
    const dt = previousTime === null ? 1 / 60 : clamp(time - previousTime, 0, .1);
    previousTime = time;
    const target = working ? 0 : Math.max(.7, clamp(relief, 0, 1));
    rest += (target - rest) * (1 - Math.exp(-dt * 3.2));
    const phase = time * (RATES[role] || 1) * Math.PI * 2 + variant * 1.71;
    const work = (1 - rest) * (reduced ? 0 : 1);
    const breath = Math.sin(time * 1.31 + variant * .8) * .009 * (reduced ? 0 : 1);
    pitchQ.setFromAxisAngle(pitchAxis, breath - .06 * rest);
    rollQ.setFromAxisAngle(rollAxis, Math.sin(time * .61 + variant) * .007 * work);
    body.quaternion.copy(pitchQ).multiply(rollQ);
    if (positions && (time < lastPoseTime || time - lastPoseTime >= 1 / 24)) {
      lastPoseTime = time;
      for (let side = 0; side < 2; side++) {
        const beat = role === 'lawyer' ? Math.pow(Math.max(0, Math.sin(phase)), 6) : Math.sin(phase + side * 2.2);
        const effort = role === 'lawyer' && side === 1 ? .10 : role === 'accountant' ? .026 : .018;
        armQ[side].setFromAxisAngle(pitchAxis, -beat * effort * .3 * work + .025 * rest);
        elbowQ[side].setFromAxisAngle(pitchAxis, beat * effort * work + Math.sin(phase * 3.7 + side) * .004 * work + .035 * rest);
      }
      for (const range of ranges) for (let i = range.start; i < range.end; i++) {
        vertex.fromArray(restPositions, i * 3);
        if (range.lower) vertex.sub(elbowPivots[range.side]).applyQuaternion(elbowQ[range.side]).add(elbowPivots[range.side]);
        vertex.sub(shoulderPivots[range.side]).applyQuaternion(armQ[range.side]).add(shoulderPivots[range.side]);
        vertex.toArray(positions.array, i * 3);
      }
      positions.needsUpdate = true;
    }
    const wantedYaw = Math.atan2(playerX - x, playerZ - z) - rot;
    const gaze = clamp(Math.atan2(Math.sin(wantedYaw), Math.cos(wantedYaw)), -.55, .55) * rest;
    yawQ.setFromAxisAngle(UP, gaze);
    pitchQ.setFromAxisAngle(pitchAxis, .018 * Math.sin(phase * .5) * work - .12 * rest - breath * .5);
    rollQ.setFromAxisAngle(rollAxis, Math.sin(time * .8 + variant) * .012 * work);
    head.quaternion.copy(yawQ).multiply(pitchQ).multiply(rollQ);
    head.position.copy(headAt); head.position.y += .025 * rest;
    if (positions) {
      inverseBody.copy(body.quaternion).invert();
      for (const cable of cables) {
        const holder = cable.name === 'spine' ? body : head;
        const pivot = cable.name === 'spine' ? bodyPivot : headAt;
        cable.current.copy(cable.socket).sub(pivot).applyQuaternion(holder.quaternion).add(holder.position);
        drift.copy(cable.current).sub(cable.socket);
        for (let i = cable.start; i < cable.end; i++) {
          // Room-space interpolation keeps one end fixed and the other at
          // the real moving socket; undo the body's transform before upload.
          vertex.fromArray(restPositions, i * 3).addScaledVector(drift, cable.weights[i - cable.start]);
          vertex.sub(body.position).applyQuaternion(inverseBody).add(bodyPivot).toArray(positions.array, i * 3);
        }
      }
      positions.needsUpdate = true;
    }
    last = { ...workingRead, working, relief: rest, headYaw: gaze, headHeight: head.position.y };
  }
  update({ time: 0, working: true });
  return { body, head, attachments, update, read: () => ({ ...last,
    cables: cables.map(q => ({ name: q.name, anchor: q.anchor.toArray(), socket: q.current.toArray(), start: q.start, end: q.end, weights: q.weights })),
  }) };
}
