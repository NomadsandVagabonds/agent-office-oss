// The Backrooms — the scissors as they are held: a right fist round the handles, the index finger laid along the neck,
// the thumb through one loop and two fingers through the other, held like a knife (thumb up, knuckles out), and the
// two halves on their pin so the blades can open, bite shut and come apart. Where all of it is, a given time into a
// jab, is hand-scissors.rule.js; this is only the model and putting it there. The skin and sleeve are the shove's
// hands' (hand.js makeHands), so the hand that holds them is the one that shoves.
//
// Cost: three meshes in the hand (the fist and two halves) where there was one. The fist is plain boxes, about 170
// triangles; the scissors are the pockets' own model (inventory-items.js), cut in two along the pin.
import * as THREE from 'three';
import { Batch, lin } from './kit.js';
import { INVENTORY_MODELS } from './inventory-items.js';
import { jabPose, restPose, fallenBlade } from './hand-scissors.rule.js';

const DEG = Math.PI / 180;
const BAKED_OPEN = 14 * DEG;             // each half of the pockets' model is turned this far off the line about its pin
const ROLL = -78 * DEG;                  // the pair turned on its edge in the fist, the thumb on top
const BASE = [0.1, 0.3, 0];              // the fist's own turn at rest: the points in toward the middle of the picture

/** Copy src's triangles into dst through m (positions) and its rotation (normals). keep(tri centroid) picks which. */
function addThrough(dst, src, m, keep = null, offset = null) {
  const n = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3(), map = new Map();
  const at = (i) => {
    if (map.has(i)) return map.get(i);
    const j = dst.verts;
    v.set(src.pos[i * 3], src.pos[i * 3 + 1], src.pos[i * 3 + 2]).applyMatrix4(m);
    if (offset) v.sub(offset);
    dst.pos.push(v.x, v.y, v.z);
    v.set(src.nor[i * 3], src.nor[i * 3 + 1], src.nor[i * 3 + 2]).applyMatrix3(n).normalize();
    dst.nor.push(v.x, v.y, v.z);
    dst.uv.push(src.uv[i * 2] || 0, src.uv[i * 2 + 1] || 0);
    dst.alb.push(src.alb[i * 3], src.alb[i * 3 + 1], src.alb[i * 3 + 2]);
    dst.ao.push(src.ao[i] ?? 1);
    map.set(i, j); return j;
  };
  for (let t = 0; t < src.idx.length; t += 3) {
    const a = src.idx[t], b = src.idx[t + 1], c = src.idx[t + 2];
    if (keep) {
      const cx = (src.pos[a * 3] + src.pos[b * 3] + src.pos[c * 3]) / 3;
      const cy = (src.pos[a * 3 + 1] + src.pos[b * 3 + 1] + src.pos[c * 3 + 1]) / 3;
      const cz = (src.pos[a * 3 + 2] + src.pos[b * 3 + 2] + src.pos[c * 3 + 2]) / 3;
      if (!keep(cx, cy, cz)) continue;
    }
    dst.idx.push(at(a), at(b), at(c));
  }
  return dst;
}

/** A box laid from a to c (in scissor units), w wide and h deep, its depth turned toward `up`. */
function limb(dst, a, c, w, h, col, unit, up = [0, 1, 0]) {
  const A = new THREE.Vector3(...a), C = new THREE.Vector3(...c), Z = C.clone().sub(A), len = Z.length();
  Z.normalize();
  const X = new THREE.Vector3(...up).cross(Z); if (X.lengthSq() < 1e-6) X.set(1, 0, 0); X.normalize();
  const Y = Z.clone().cross(X);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(A).premultiply(new THREE.Matrix4().makeScale(unit, unit, unit));
  const b = new Batch(false); b.box(-w, -h, -w * 0.4, w, h, len + w * 0.4, col);
  return addThrough(dst, b, m);
}

/**
 * The fist, in the scissors' own frame before they are turned on their edge (palm down over the loops, blades to -Z),
 * in the pockets' model's units (`unit` metres each).
 */
function fist(unit) {
  const skin = lin('#d6a883'), knuckle = lin('#c4916c'), shade = lin('#b98563'), sleeve = lin('#6f7681'), cuff = lin('#9aa0a8');
  const b = new Batch(false), box = (x0, y0, z0, x1, y1, z1, col) => {
    const t = new Batch(false); t.box(x0, y0, z0, x1, y1, z1, col);
    addThrough(b, t, new THREE.Matrix4().makeScale(unit, unit, unit));
  };
  box(-2.5, 1.7, 8.0, 4.7, 4.2, 13.6, skin);                                     // the back of the hand, over the loops
  box(-2.3, 3.9, 8.0, 4.5, 4.5, 9.4, knuckle);                                   // the knuckles
  // two fingers through the far loop, curled under it and back
  for (const x of [1.75, 3.2]) {
    limb(b, [x, 2.9, 8.4], [x, 1.5, 5.5], 0.68, 0.68, skin, unit);
    limb(b, [x, 1.5, 5.5], [x, -0.5, 5.2], 0.64, 0.64, knuckle, unit);
    limb(b, [x, -0.5, 5.2], [x, -1.1, 6.9], 0.6, 0.6, shade, unit);
  }
  // the little finger curled round outside the loop
  limb(b, [4.5, 2.6, 8.8], [5.1, 1.1, 7.2], 0.58, 0.58, skin, unit);
  limb(b, [5.1, 1.1, 7.2], [4.8, -0.5, 7.9], 0.55, 0.55, shade, unit);
  // the index finger laid along the neck toward the pin: what points the stab
  limb(b, [0.3, 2.7, 8.3], [0.5, 1.95, 4.2], 0.7, 0.62, skin, unit);
  limb(b, [0.5, 1.95, 4.2], [0.7, 1.7, 1.1], 0.64, 0.58, knuckle, unit);
  // the thumb, round the near side and through the near loop
  limb(b, [-1.9, 2.6, 11.4], [-2.95, 1.6, 8.6], 0.85, 0.8, skin, unit);
  limb(b, [-2.95, 1.6, 8.6], [-2.75, 0.5, 6.4], 0.78, 0.74, skin, unit);
  limb(b, [-2.75, 0.5, 6.4], [-2.3, -0.5, 5.7], 0.72, 0.7, knuckle, unit);
  // the wrist and forearm, out of the bottom right of the picture, then the cuff and the sleeve
  limb(b, [1.1, 2.9, 13.0], [3.6, 4.6, 21.5], 2.3, 1.9, skin, unit);
  limb(b, [3.6, 4.6, 21.5], [4.0, 4.9, 23.0], 2.6, 2.2, cuff, unit);
  limb(b, [4.0, 4.9, 23.0], [8.5, 8.0, 40], 3.0, 2.6, sleeve, unit);
  return b;
}

/**
 * The scissors in the hand. kit: the level's kit · lights, amb: as every held thing is lit (hand.js).
 * → { mesh, mat, hold, fitBounds, jab(), landed({ ok, snapped }), busy(), update(dt, at, rest) }
 */
export function heldScissors(kit, lights, amb) {
  const unit = (kit.VOXEL || 0.025) * 0.46;
  const whole = new Batch(false);
  INVENTORY_MODELS.scissors.sculpt(whole, unit, { grounded: false, held: true });
  const pin = new THREE.Vector3(0, unit, -0.6 * unit), pinR = 0.9 * unit;
  // which half a triangle is: the upper half has its blade to -X ahead of the pin and its loop to +X behind it
  const upper = (x, y, z) => (Math.hypot(x, z - pin.z) < pinR ? false : x * (z - pin.z) > 0);
  const id = new THREE.Matrix4();
  const halfA = addThrough(new Batch(false), whole, id, (x, y, z) => upper(x, y, z), pin);
  const halfB = addThrough(new Batch(false), whole, id, (x, y, z) => !upper(x, y, z), pin);

  const mat = kit.surface({ vox: false }); mat.transparent = true;
  const mesh = new THREE.Mesh(kit.geometry(addThrough(new Batch(false), fist(1), new THREE.Matrix4().makeRotationZ(ROLL).multiply(new THREE.Matrix4().makeScale(unit, unit, unit))), lights, amb), mat);
  mesh.renderOrder = 10000;                                    // (the fist first: it is the one that clears the room's depth)
  const tool = new THREE.Group(); tool.rotation.z = ROLL; mesh.add(tool);
  const parts = [halfA, halfB].map((b) => {
    const m = new THREE.Mesh(kit.geometry(b, lights, amb), mat);
    m.renderOrder = 10001; m.position.copy(pin); tool.add(m);
    return m;
  });
  const [bladeA, bladeB] = parts;
  mesh.rotation.set(...BASE);

  // for a narrow picture, fit what is in the hand by the whole pair and the fist (not the sleeve, which leaves the frame)
  const fitBounds = new THREE.Box3();
  { const v = new THREE.Vector3(), r = new THREE.Matrix4().makeRotationZ(ROLL);
    for (let i = 0; i < whole.pos.length; i += 3) fitBounds.expandByPoint(v.set(whole.pos[i], whole.pos[i + 1], whole.pos[i + 2]).applyMatrix4(r));
    fitBounds.expandByPoint(v.set(5 * unit, 5 * unit, 14 * unit).applyMatrix4(r)); }

  let t = -1, outcome = null, pending = false;
  const q = new THREE.Quaternion(), down = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  function setOpen(open) {
    bladeA.quaternion.setFromAxisAngle(Y, BAKED_OPEN * (open - 1));
    bladeB.quaternion.setFromAxisAngle(Y, -BAKED_OPEN * (open - 1));
  }
  function mend() { bladeA.visible = true; bladeA.position.copy(pin); setOpen(restPose().open); }
  mend();

  return {
    mesh, mat, fitBounds,
    hold: [0.19, -0.14, -0.47],
    /** The click: a jab starts, how it went not yet known. */
    jab() { if (t >= 0 && outcome === 'snapped') return; t = 0; outcome = null; pending = true; mend(); },
    /** How it went, as soon as it is known: { ok, snapped }. Harmless before inventory.js says so; the jab is then plain. */
    landed(r) { if (!pending) return; pending = false; outcome = r?.ok ? (r.snapped ? 'snapped' : 'hit') : 'miss'; },
    /** Still playing a pair coming apart, after the pockets have already let go of them. */
    busy() { return t >= 0 && outcome === 'snapped'; },
    /** Every frame the scissors are shown: `at` the fist's place in the picture (moved here), the walking bob already in it. */
    update(dt, at) {
      let p = restPose();
      if (t >= 0) {
        t += dt;
        const now = jabPose(t, outcome);
        if (now) p = now;
        else { t = -1; outcome = null; pending = false; mend(); }
      }
      at.x += p.x; at.y += p.y; at.z += p.z;
      mesh.position.copy(at);
      mesh.rotation.set(BASE[0] + p.pitch, BASE[1] + p.yaw, BASE[2] + p.roll);
      setOpen(p.open);
      if (p.broke >= 0) {
        // the loose blade falls in the picture's down, whatever way the fist is turned
        const f = fallenBlade(p.broke), s = mesh.scale.x || 1;
        mesh.updateMatrix(); tool.updateMatrix();
        q.copy(mesh.quaternion).multiply(tool.quaternion).invert();
        down.set(f.x, f.y, f.z).applyQuaternion(q).divideScalar(s);
        bladeA.position.copy(pin).add(down);
        bladeA.rotateX(f.spin);
        bladeA.visible = f.y > -0.7;
      }
    },
  };
}
