// The lab's patrol units wear employee disguises that do not quite fit.
// Movement and patrol decisions belong to the room; this module owns the model.
import * as THREE from 'three';
import { Batch } from '../../kit.js';
import { Vox, M, glow } from '../../../vox/vox.js';

const UNIT = .045;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function guardModel(variant) {
  const v = new Vox(), eyes = new Vox();
  const metal = M(['#777e70', '#687264', '#81816c'][variant], 0);
  const edge = M('#343d35', 0), joint = M('#202a23', 0);
  const brass = M('#a39b6d', 0), pale = M('#b2b29a', 0);
  const hair = M(['#211e19', '#36271c', '#29251b'][variant], 0);
  const hairEdge = M(['#3c3425', '#4c3826', '#423a2c'][variant], 0);

  // Square hydraulic legs and broad work boots retain an unmistakable robot
  // silhouette beneath the cheap hair. Flush colour bands suggest the joints.
  for (const side of [-1, 1]) {
    const x = side < 0 ? -5 : 2;
    v.box(x, 2, -2, x + 3, 14, 2, metal);
    v.paint(x, 7, -2, x + 3, 9, 2, joint);
    v.paint(x + 1, 3, 1, x + 2, 7, 2, brass);
    v.box(x - 1, 0, -3, x + 4, 3, 5, edge);
  }
  v.box(-5, 13, -3, 5, 16, 3, edge);
  v.box(-5, 16, -3, 5, 25, 3, metal);
  v.paint(-4, 17, 2, 4, 19, 3, edge);
  v.paint(-3, 21, 2, 3, 24, 3, joint);
  v.paint(-2, 22, 2, 2, 23, 3, brass);
  v.paint(-4, 19, 2, -2, 21, 3, pale); // blank employee badge
  v.box(-2, 25, -1, 2, 27, 2, joint);
  for (const side of [-1, 1]) {
    const x = side < 0 ? -8 : 6;
    v.box(x, 15, -2, x + 2, 25, 2, metal);
    v.paint(x, 18, -2, x + 2, 20, 2, joint);
    v.box(x, 12, -1, x + 2, 15, 2, edge);
  }
  v.box(-8, 23, -2, 8, 25, 2, edge);

  // A flat metal face remains visible through the glasses, glued-on beard and
  // crooked wig. The ear housings borrow the shape of office headphones.
  v.box(-5, 27, -3, 5, 35, 4, metal);
  v.paint(-5, 30, 3, 5, 34, 4, joint);
  v.paint(-1, 31, 3, 1, 32, 4, metal); // bridge of the fake spectacles
  v.box(-7, 30, -2, -5, 34, 2, edge);
  v.box(5, 30, -2, 7, 34, 2, edge);
  v.paint(-7, 31, -1, -6, 33, 1, brass);
  v.paint(6, 31, -1, 7, 33, 1, brass);
  v.paint(-3, 28, 3, 3, 30, 4, joint);
  v.paint(-2, 29, 3, 2, 30, 4, pale); // the mouth is a vent, not skin

  // A shifted cap and unequal locks are deliberately a little ridiculous.
  const lean = variant === 1 ? 1 : -1;
  v.box(-5 + lean, 35, -4, 5 + lean, 38, 3, hair);
  v.box(-6 + lean, 33, -4, -4 + lean, 36, 3, hair);
  v.box(4 + lean, 31, -4, 6 + lean, 36, 2, hair);
  v.paint(-5 + lean, 36, 2, 4 + lean, 37, 3, hairEdge);
  v.box(-4, 27, 4, 4, 30, 5, hair); // badly fitted false beard
  v.box(-3, 25, 4, 3, 27, 5, hair);
  v.box(-1, 24, 4, 2, 25, 5, hairEdge);
  v.paint(-2, 29, 4, 2, 30, 5, edge); // gap exposes the mechanical mouth
  // A bundled ponytail hangs down the back, tied with an old elastic.
  v.box(lean - 1, 28, -6, lean + 2, 35, -4, hair);
  v.box(lean, 23, -7, lean + 2, 29, -5, hair);
  v.paint(lean - 1, 31, -6, lean + 2, 32, -4, brass);
  v.paint(lean, 24, -7, lean + 1, 28, -6, hairEdge);

  eyes.box(-4, 31, 4, -1, 33, 5, glow('#ff2415'));
  eyes.box(1, 31, 4, 4, 33, 5, glow('#ff2415'));
  return { body: v, eyes };
}

/** Two meshes, no lights. Initial and update positions are room coordinates. */
export function createGuard(c, { id, x, z, variant = 0 }) {
  variant = Math.abs(Math.trunc(variant)) % 3;
  const parts = guardModel(variant);
  const matrix = new THREE.Matrix4().makeScale(UNIT, UNIT, UNIT);
  matrix.setPosition(x, 0, z);
  const bodyBatch = new Batch(true), eyeBatch = new Batch(true);
  const geometry = (part) => c.kit.model(`mecha:guard:${variant}:${part}:v1`, () => parts[part]).solid;
  bodyBatch.addVox(geometry('body'), matrix);
  eyeBatch.addVox(geometry('eyes'), matrix);
  const body = c.dynamic(bodyBatch, { pivot: [x, 0, z] });
  const eyes = c.dynamic(eyeBatch, { pivot: [x, 0, z], unlit: true });
  body.name = `mecha-guard-${id}`;
  eyes.name = `mecha-guard-${id}-eyes`;
  // Both batches were authored around the same initial pivot. Reparenting the
  // eyes at zero makes translation/yaw apply once, including nonzero spawns.
  body.add(eyes);
  eyes.position.set(0, 0, 0);
  body.rotation.order = 'YXZ';
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let lastTime = null, sag = 0;
  let last = { id, x, z, yaw: 0, time: 0, moving: false, disabled: false, meshes: 2, eyesOn: true };

  function update({ x: nextX = last.x, z: nextZ = last.z, yaw = last.yaw, time = last.time, moving = false, disabled = false } = {}) {
    const dt = lastTime === null ? 1 / 60 : clamp(time - lastTime, 0, .1);
    lastTime = time;
    sag += ((disabled ? 1 : 0) - sag) * (1 - Math.exp(-dt * 7));
    const phase = time * 5.3 + variant * 1.7;
    const motion = moving && !disabled && !reduced ? 1 : 0;
    body.position.set(nextX, Math.sin(phase * 2) * .009 * motion - .07 * sag, nextZ);
    body.rotation.set(.19 * sag, yaw, Math.sin(phase) * .024 * motion + .09 * sag, 'YXZ');
    eyes.visible = !disabled;
    last = { id, x: nextX, z: nextZ, yaw, time, moving, disabled, sag, meshes: 2, eyesOn: eyes.visible };
  }
  update();
  return { root: body, body, eyes, update, read: () => ({ ...last }) };
}
