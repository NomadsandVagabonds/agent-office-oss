// The Backrooms — the fire extinguisher as it is held: a right fist over the head of it, the palm down on the squeeze
// lever and the fingers curled under the carry handle, the canister hanging below out of the bottom of the picture, the
// horn forward and the gauge turned up where it can be read. Where it all is a given time into a burst is
// hand-extinguisher.rule.js; this is only the model and putting it there. The skin and sleeve are the shove's hands'
// (hand.js makeHands), so the hand that holds it is the one that shoves.
//
// Cost: three meshes in the hand (the canister with the fist, the lever, the needle). The canister is the pockets' own
// model (inventory-items.js), with its lever cut out so that it can be squeezed.
import * as THREE from 'three';
import { Batch, lin } from './kit.js';
import { INVENTORY_MODELS, EXTINGUISHER_PARTS as P } from './inventory-items.js';
import { holdPose, leverAt, HOLD } from './hand-extinguisher.rule.js';
import { EXTINGUISHER } from './extinguisher.rule.js';

const DEG = Math.PI / 180;
const BASE = [0.0, 0.08, 0.05];             // how it hangs at rest: the horn a little in toward the middle of the picture
const UNIT = 0.62;                         // of a voxel, a unit of the pockets' model: held, it is a small one of about 24 cm

/** Copy src's triangles into dst through m (positions and normals); keep(centroid) picks which; offset is taken off. */
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
      const cx = (src.pos[a * 3] + src.pos[b * 3] + src.pos[c * 3]) / 3, cy = (src.pos[a * 3 + 1] + src.pos[b * 3 + 1] + src.pos[c * 3 + 1]) / 3, cz = (src.pos[a * 3 + 2] + src.pos[b * 3 + 2] + src.pos[c * 3 + 2]) / 3;
      if (!keep(cx, cy, cz)) continue;
    }
    dst.idx.push(at(a), at(b), at(c));
  }
  return dst;
}

/** A box laid from a to c, w wide and h deep, in model units (scaled by `unit` metres). */
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
 * The fist round the head, in the canister's own units: the back of the hand on the lever (which runs back from its pin
 * at z 0 to about z 4), the knuckles at its front, four fingers curled down the left side and under the carry handle,
 * the thumb along the right, and the wrist going back and down to the bottom right of the picture.
 */
function fist(unit) {
  const skin = lin('#d6a883'), knuckle = lin('#c4916c'), shade = lin('#b98563'), sleeve = lin('#6f7681'), cuff = lin('#9aa0a8');
  const b = new Batch(false), box = (x0, y0, z0, x1, y1, z1, col) => {
    const t = new Batch(false); t.box(x0, y0, z0, x1, y1, z1, col);
    addThrough(b, t, new THREE.Matrix4().makeScale(unit, unit, unit));
  };
  box(-1.75, 15.5, 3.6, 1.95, 16.5, 7.4, skin);                    // the back of the hand, down on the back of the lever
  box(-1.8, 15.3, 2.95, 1.9, 16.2, 3.8, knuckle);                  // the knuckles, at the front of it (the gauge and the horn stay in sight)
  for (const [k, z] of [3.2, 4.25, 5.25, 6.15].entries()) {        // four fingers: down the left side and under the handle
    const w = k === 3 ? 0.42 : 0.5;
    limb(b, [-1.5, 15.8, z], [-1.75, 14.4, z], w, w, skin, unit);
    limb(b, [-1.75, 14.4, z], [-1.0, 13.3, z + 0.1], w, w, knuckle, unit);
    limb(b, [-1.0, 13.3, z + 0.1], [0.5, 13.35, z + 0.2], w * 0.95, w * 0.95, shade, unit);
  }
  // the thumb, along the right side of the lever toward the pin
  limb(b, [1.7, 15.6, 6.6], [1.45, 15.3, 4.4], 0.55, 0.5, skin, unit);
  limb(b, [1.45, 15.3, 4.4], [1.2, 15.2, 3.1], 0.5, 0.45, knuckle, unit);
  // the wrist and forearm, back toward the camcorder and down to the right, then the cuff and the sleeve
  limb(b, [0.3, 15.9, 6.9], [2.2, 12.6, 11.6], 1.45, 1.1, skin, unit);
  limb(b, [2.2, 12.6, 11.6], [2.6, 11.8, 12.8], 1.7, 1.3, cuff, unit);
  limb(b, [2.6, 11.8, 12.8], [6.5, 1.5, 25], 2.1, 1.7, sleeve, unit);
  return b;
}

/**
 * The extinguisher in the hand. kit: the level's kit · lights, amb: as every held thing is lit (hand.js).
 * → { mesh, mat, hold, fitBounds, spraying(on), dry(), update(dt, at, item), nozzle(out, dir) }
 */
export function heldExtinguisher(kit, lights, amb) {
  const unit = (kit.VOXEL || 0.025) * UNIT;
  const whole = new Batch(false);
  INVENTORY_MODELS.extinguisher.sculpt(whole, 1, { grounded: false, held: true });
  const pivot = new THREE.Vector3(...P.pivot), scale = new THREE.Matrix4().makeScale(unit, unit, unit);
  const body = addThrough(new Batch(false), whole, scale, (x, y, z) => !P.lever(x, y, z));
  addThrough(body, fist(1), scale);
  // the lever, about its own pin: modelled where it stands let go (P.leverOpen), so it is turned back to flat here and the pose turns it
  const flat = new THREE.Matrix4().makeRotationX(-P.leverOpen * DEG);
  const leverB = addThrough(new Batch(false), whole, scale.clone().multiply(flat).multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z)), P.lever);
  // the needle: a thin dark sliver from the middle of the dial outward, along its own +Y, turned by the pose about the dial's axis
  const needleB = new Batch(false); needleB.box(-0.06 * unit, 0, 0, 0.06 * unit, P.gaugeR * 0.78 * unit, 0.05 * unit, lin('#1a1a1a'));

  const mat = kit.surface({ vox: false }); mat.transparent = true;
  const mesh = new THREE.Mesh(kit.geometry(body, lights, amb), mat);
  mesh.renderOrder = 10000;                                    // (the canister and fist first: it is the one that clears the room's depth)
  const lever = new THREE.Mesh(kit.geometry(leverB, lights, amb), mat);
  lever.renderOrder = 10001; lever.position.copy(pivot).multiplyScalar(unit); mesh.add(lever);
  const dial = new THREE.Group(); dial.position.set(...P.gauge).multiplyScalar(unit);
  dial.rotation.set(P.gaugeTilt[0] * DEG, 0, P.gaugeTilt[1] * DEG, 'ZXY'); mesh.add(dial);
  const face = new THREE.Group(); face.position.y = 0.13 * unit; face.rotation.x = -Math.PI / 2; dial.add(face);         // (the face of the dial is its +Y; the needle lies on it)
  const needle = new THREE.Mesh(kit.geometry(needleB, [], [0.25, 0.25, 0.25]), mat);
  needle.renderOrder = 10001; face.add(needle);
  // hanging: the head about where a held thing's middle is, the canister below it
  mesh.rotation.set(...BASE);

  // for a narrow picture, fit what is in the hand by the head of it and the fist (not the canister below, nor the sleeve)
  const fitBounds = new THREE.Box3();
  { const v = new THREE.Vector3();
    for (let i = 0; i < body.pos.length; i += 3) if (body.pos[i + 1] > 11.5 * unit && body.pos[i + 2] < 8 * unit) fitBounds.expandByPoint(v.set(body.pos[i], body.pos[i + 1], body.pos[i + 2])); }

  let on = false, since = 0, off = Infinity, dry = Infinity, clock = 0, share = 1;
  const mouth = new THREE.Vector3(...P.nozzle).multiplyScalar(unit), back = new THREE.Vector3(0, P.nozzle[1], 0).multiplyScalar(unit);
  return {
    mesh, mat, fitBounds,
    // (where its head is held: its own origin is at its foot, 14 units below, which the rotation carries)
    hold: [0.2, -0.075 - 14 * unit, -0.42],
    /** The lever is squeezed (true) or let go (false). */
    spraying(now) {
      if (now && !on) { on = true; since = 0; off = Infinity; dry = Infinity; }
      else if (!now && on) { on = false; off = 0; }
    },
    /** It has run dry under the hand: two pumps on nothing, and it sags. */
    dry() { dry = 0; on = false; off = 0; },
    /** Still showing one that has run dry, after the pockets have already let go of it. */
    busy() { return Number.isFinite(dry) && dry < HOLD.sputter + 0.25; },
    /** Every frame it is shown: `at` its place in the picture (moved here), the walking bob already in it · item: what the pockets hold. */
    update(dt, at, item) {
      clock += dt; if (on) since += dt; else off += dt; if (Number.isFinite(dry)) dry += dt;
      if (item?.charge !== undefined) share = Math.max(0, Math.min(1, item.charge / EXTINGUISHER.charge));
      const p = holdPose({ on, since, off, dry, share, time: clock });
      at.x += p.x; at.y += p.y; at.z += p.z;
      mesh.position.copy(at);
      mesh.rotation.set(BASE[0] + p.pitch, BASE[1] + p.yaw, BASE[2] + p.roll);
      lever.rotation.x = leverAt(p.squeeze) * DEG;
      needle.rotation.z = -p.needle;
    },
    /** Where the spray leaves it, in the world (`out`), and which way it goes (`dir`, normalised): the horn's mouth and its line. */
    nozzle(out, dir) {
      mesh.updateWorldMatrix(true, false);
      out.copy(mouth).applyMatrix4(mesh.matrixWorld);
      if (dir) dir.copy(mouth).sub(back).transformDirection(mesh.matrixWorld);
      return out;
    },
  };
}
