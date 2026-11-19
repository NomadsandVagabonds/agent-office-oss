// The Backrooms — the lawn flamingo as it is held: by the neck, like a short spear, in the right hand. The palm is on the
// right of the neck, the fingers come round under it, the thumb lies over the top, and the wrist and forearm run back and
// down out of the bottom right of the picture, as the shove's hands and the extinguisher's do. The stakes point forward and
// a little down and in, the bird's body is ahead of the fist, and its head is just behind it. The bird is the pockets' own
// model (inventory-items.js), at about two-thirds of its size on a lawn. Where it all is in a stab is hand-flamingo.rule.js.
//
// Two meshes: the bird, and the hand (so that the hand can let go of it: the bird stays in what it went into).
// Both at renderOrder 10000, under a sticky note on the lens (10001: hand-notes.js).
import * as THREE from 'three';
import { Batch, lin } from './kit.js';
import { INVENTORY_MODELS } from './inventory-items.js';
import { stabPose, stabLength } from './hand-flamingo.rule.js';

const DEG = Math.PI / 180;
const U = 0.0145;                                  // metres to one of the model's units: the bird is about 44 cm, stakes and all
const GRIP = [3.75, 22.6, 0];                      // where on the neck it is held (the model's units: the neck runs up through here)
// the stakes down and in toward the middle, so that they show past the bird's body (rotation.x: + tips the stakes up)
const REST = Object.freeze({ pitch: -24 * DEG, yaw: 16 * DEG, roll: -12 * DEG });

/** Move a batch's positions and normals through m, in place. */
function through(b, m) {
  const n = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3();
  for (let i = 0; i < b.pos.length; i += 3) {
    v.set(b.pos[i], b.pos[i + 1], b.pos[i + 2]).applyMatrix4(m); b.pos[i] = v.x; b.pos[i + 1] = v.y; b.pos[i + 2] = v.z;
    v.set(b.nor[i], b.nor[i + 1], b.nor[i + 2]).applyMatrix3(n).normalize(); b.nor[i] = v.x; b.nor[i + 1] = v.y; b.nor[i + 2] = v.z;
  }
  return b;
}

/** A box laid from a to c (metres), w wide and h deep across it. */
function limb(b, a, c, w, h, col, up = [0, 1, 0]) {
  const A = new THREE.Vector3(...a), C = new THREE.Vector3(...c), Z = C.clone().sub(A), len = Z.length();
  Z.normalize();
  const X = new THREE.Vector3(...up).cross(Z); if (X.lengthSq() < 1e-6) X.set(1, 0, 0); X.normalize();
  const Y = Z.clone().cross(X);
  const t = new Batch(false); t.box(-w, -h, -w * 0.4, w, h, len + w * 0.4, col);
  through(t, new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(A));
  const base = b.verts;
  b.pos.push(...t.pos); b.nor.push(...t.nor); b.uv.push(...t.uv); b.alb.push(...t.alb); b.ao.push(...t.ao);
  for (const i of t.idx) b.idx.push(base + i);
  return b;
}

/**
 * The hand, in metres about the grip (the neck runs along z there, forward is −z), open 0 (a fist) … 1 (let go: the fingers
 * straightened off the neck and the thumb lifted). Built twice, shut and open, and the open one shown once it lets go.
 */
function hand(open = 0) {
  const skin = lin('#d6a883'), knuckle = lin('#c4916c'), shade = lin('#b98563'), sleeve = lin('#6f7681'), cuff = lin('#9aa0a8');
  const b = new Batch(false), r = 0.019;           // (the neck's radius here)
  const box = (x0, y0, z0, x1, y1, z1, col) => { const t = new Batch(false); t.box(x0, y0, z0, x1, y1, z1, col); limbless(t); };
  const limbless = (t) => { const base = b.verts; b.pos.push(...t.pos); b.nor.push(...t.nor); b.uv.push(...t.uv); b.alb.push(...t.alb); b.ao.push(...t.ao); for (const i of t.idx) b.idx.push(base + i); };
  const o = open * 0.022;
  // the palm, upright against the right of the neck, and the back of the hand outside it
  box(r - 0.002 + o, -0.03, -0.036, r + 0.01 + o, 0.032, 0.036, skin);
  box(r + 0.008 + o, -0.026, -0.032, r + 0.017 + o, 0.028, 0.032, shade);
  // four fingers round under the neck and up its left side (straightened off it, open)
  [-0.027, -0.009, 0.009, 0.026].forEach((z, k) => {
    const w = k === 0 ? 0.0075 : 0.0085;
    if (open < 0.5) {
      limb(b, [r + 0.004, -0.024, z], [0.002, -r - 0.008, z], w, w, skin);
      limb(b, [0.002, -r - 0.008, z], [-r - 0.004, -0.008, z], w * 0.95, w * 0.92, knuckle);
      limb(b, [-r - 0.004, -0.008, z], [-r + 0.002, 0.012, z], w * 0.88, w * 0.85, shade);
    } else {
      limb(b, [r + 0.004 + o, -0.024, z], [r + 0.012 + o, -0.06, z + 0.004], w, w, skin);
      limb(b, [r + 0.012 + o, -0.06, z + 0.004], [r + 0.006 + o, -0.085, z + 0.008], w * 0.95, w * 0.92, knuckle);
    }
  });
  // the thumb over the top of the neck toward the left (lifted, open)
  limb(b, [r + 0.004 + o, 0.026, 0.024], [0.002 + o, r + 0.009 + o * 0.6, 0.004], 0.0085, 0.0078, skin);
  limb(b, [0.002 + o, r + 0.009 + o * 0.6, 0.004], [-0.012 + o, r + 0.006 + o * 0.8, -0.012], 0.0076, 0.007, knuckle);
  // the wrist, straight behind the hand, and the forearm back toward the lens and down to the bottom right of the picture
  limb(b, [r + 0.006 + o, -0.004, 0.03], [0.04 + o, -0.05, 0.1], 0.016, 0.014, skin);
  limb(b, [0.04 + o, -0.05, 0.1], [0.07 + o, -0.13, 0.2], 0.018, 0.015, skin);
  limb(b, [0.07 + o, -0.13, 0.2], [0.075 + o, -0.145, 0.215], 0.021, 0.018, cuff);
  limb(b, [0.075 + o, -0.145, 0.215], [0.1 + o, -0.32, 0.38], 0.023, 0.019, sleeve);
  return b;
}

/**
 * The flamingo in the hand. → { mesh, mat, hold, fitBounds, update(dt, at), busy(), stab(), stabbed({ ok }) }
 * mesh is the bird; the hand (shut and open) is in it, as children, so that it moves with it.
 */
export function heldFlamingo(kit, lights, amb) {
  // the bird, turned so that its stakes run forward (−z) and its back is up, and moved so that the grip is at its origin
  const birdB = new Batch(false);
  INVENTORY_MODELS.flamingo.sculpt(birdB, 1, { grounded: false, held: true });
  const lie = new THREE.Matrix4().makeScale(U, U, U)
    .premultiply(new THREE.Matrix4().makeRotationX(90 * DEG))                 // (its stakes, along −y, to −z: forward; its back, +z, up)
    .multiply(new THREE.Matrix4().makeTranslation(-GRIP[0], -GRIP[1], -GRIP[2]));
  through(birdB, lie);
  const mat = kit.surface({ vox: false }); mat.transparent = true;
  // the bird is the held mesh (hand.js draws it first, over the room) and the hand is in it; let go, the bird is not drawn
  // (its draw range emptied, so that what is in it still is), and the hand drops away on its own
  const bird = new THREE.Mesh(kit.geometry(birdB, lights, amb), mat); bird.renderOrder = 10000;
  const holder = bird, mesh = bird, all = bird.geometry.drawRange.count;
  const shut = new THREE.Mesh(kit.geometry(hand(0), lights, amb), mat); shut.renderOrder = 10000; holder.add(shut);
  const opened = new THREE.Mesh(kit.geometry(hand(1), lights, amb), mat); opened.renderOrder = 10000; opened.visible = false; holder.add(opened);
  holder.rotation.set(REST.pitch, REST.yaw, REST.roll);

  // for a narrow picture, fit it by the fist and the part of the bird near it (not the stakes far out, nor the sleeve)
  const fitBounds = new THREE.Box3(new THREE.Vector3(-0.07, -0.06, -0.13), new THREE.Vector3(0.05, 0.05, 0.05));

  let t = Infinity, went = null, done = false;
  return {
    mesh, mat, fitBounds,
    hold: [0.2, -0.1, -0.36],
    /** A stab starts (the click). */
    stab() { t = 0; went = null; done = false; },
    /** How it went, once known: went in (ok), it stays there and the hand lets go; or it missed and comes back. */
    stabbed(result) { if (Number.isFinite(t)) went = !!result?.ok; },
    /** Still showing the hand letting go, after the pockets have given up the flamingo. */
    busy() { return Number.isFinite(t) && went === true && t < stabLength(true); },
    /** Every frame it is shown: `at` its place in the picture, the walking bob in it. */
    update(dt, at) {
      if (Number.isFinite(t)) t += dt;
      const p = Number.isFinite(t) ? stabPose(t, went) : null;
      if (!p) { if (Number.isFinite(t) && !done) { done = true; t = Infinity; } }
      const q = p || { x: 0, y: 0, z: 0, pitch: 0, roll: 0, bird: true, open: 0, gone: false };
      holder.position.set(at.x + q.x, at.y + q.y, at.z + q.z);
      holder.rotation.set(REST.pitch - q.pitch, REST.yaw, REST.roll + q.roll);          // (the rule's pitch: + is the stakes down)
      bird.geometry.setDrawRange(0, q.bird ? all : 0);
      shut.visible = !q.gone && q.open < 0.5; opened.visible = !q.gone && q.open >= 0.5;
    },
  };
}
