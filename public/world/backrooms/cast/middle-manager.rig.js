// The Backrooms — the middle manager's body and how it moves (cast/middle-manager.js has its rule: where it is, what it
// is doing, how far it has to bend). The model is middle-manager.model.js; this stands it up and poses it each frame.
//
//   makeMiddleManager(kit) → { group, mat, light(rgb), pose({ time, speed, fat, swell, mode, lean, heading, me, floorAt, hurt, face }), burst(progress, time), face }
//
//   group    the cast puts it where it stands (x, the floor, z) and nothing else: the rig turns it to `heading` (radians,
//            the cast's rot: 0 faces +z) and poses everything inside it.
//   pose     time the room's clock (seconds) · speed m/s now · fat 0…1 · swell 0…1 into its swelling · mode 'stands' |
//            'comes' | 'swells' | 'gone' · lean the hip bend solved from what is above it (middle-manager.rule.js bend) ·
//            me the visitor, world { x, z }, for the head to turn to · floorAt(x, z) world floor height, for the feet
//            (default: flat) · hurt seconds since it was cut (Infinity: not), for its reel · face 0…FACES − 1 to say which,
//            or left out to wear the one faceFor() gives. It works out its own stride from speed and the time between calls.
//   burst    its going off, 0 → 1: one last swelling far past anything it reached, a shudder, and it is not there. What
//            comes out of it is the cast's paper and buttons. No tendrils and nothing extra: its body, and then none.
//
// How much each part of it swells is the rule's (middle-manager.rule.js bloat): imported, not copied. The look is the
// cast's and the owner's (the model): three metres, folded at the hips under the ceiling; a tired suit a size too short,
// a dull patterned tie, the teal lanyard and the blank badge, a watch on its left wrist; a face that goes from sad to the
// grin as it is fed, and near full its skin turns. Nothing random: its shake and heave run on the clock.
import * as THREE from 'three';
import { Batch, lamp } from '../kit.js';
import { MANAGER, bloat } from './middle-manager.rule.js';
import { HEALTH } from './health.rule.js';
import { elbow } from './head-count.rule.js';
import { S, TORSO, NECK, UPPER, FORE, HAND, THIGH, SHIN, SHOE, HEAD, FACES, torsoVox, neckVox, headVox, sleeveVox, handVox, trouserVox, shoeVox } from './middle-manager.model.js';

const T = TORSO * S, N = NECK * S, U = UPPER * S, F = FORE * S, TH = THIGH * S, SH = SHIN * S, FOOT = SHOE * S;
/** Its lengths in metres, standing straight: what middle-manager.rule.js bend() is asked with. */
export const BODY = Object.freeze({ hip: TH + SH + FOOT, torso: T, neck: N, head: HEAD * S });

/**
 * Which face it wears (the owner: "starts as Sad face upside down u with tears and as it gets fed it goes from sad to neutral
 * to happy to creepily huge grin and big eyes"): 0 sad, 1 nothing, 2 pleased, 3 the grin, which it always wears swelling.
 */
export const faceFor = (fat = 0, swell = 0) => (swell > 0 || fat >= 0.8 ? 3 : fat >= 0.5 ? 2 : fat >= 0.22 ? 1 : 0);
/** Fed near to full, or swelling, its neck and its hands have turned: raw, engorged. */
export const turnedAt = (fat = 0, swell = 0) => swell > 0 || fat >= 0.8;
/** Cut, it reels: 0…1, `hurt` seconds after (0 once the flinch is over). */
export const reelAt = (hurt) => (hurt >= 0 && hurt < HEALTH.flinch ? Math.exp(-hurt * 5) * Math.min(1, hurt * 30) : 0);

export function makeMiddleManager(kit) {
  const LIGHTS = [lamp(0.6, 3.4, 1.4, [1.1, 1.05, 1.0], { k: 9, wrap: 0.45, far: 40 })];
  const mat = kit.surface({ vox: true, wet: 0.2 }), group = new THREE.Group();
  group.name = 'middle-manager';
  // (no corner shading: flat faces of one colour merge, and it reads smooth rather than built; f: built coarser, drawn bigger)
  const geo = (key, make, f = 1) => { const b = new Batch(true); b.addVox(kit.model(key, make, { ao: false }).solid, new THREE.Matrix4().makeScale(S * f, S * f, S * f)); return kit.geometry(b, LIGHTS, [0.4, 0.38, 0.38]); };
  const part = (g, name) => { const k = new THREE.Mesh(g, mat); if (name) k.name = name; group.add(k); return k; };
  const thin = part(geo('manager:torso:thin3', () => torsoVox(false)), 'body'), full = part(geo('manager:torso:full4', () => torsoVox(true).downsample(2), 2), 'body');     // (big enough to be built at half the grain)
  const neck = part(geo('manager:neck', () => neckVox(false))), rawNeck = part(geo('manager:neck:raw', () => neckVox(true)));
  // its face, as fed as it is: one head each, and only the one it has on is shown
  const heads = Array.from({ length: FACES }, (_, f) => part(geo(`manager:head4:${f}`, () => headVox(f)), 'head'));
  const upper = geo('manager:upper3', () => sleeveVox(UPPER)), fore = geo('manager:fore3', () => sleeveVox(FORE, true)), watch = geo('manager:fore3:watch', () => sleeveVox(FORE, true, 4.6, true));
  const hand = geo('manager:hand3', () => handVox(false)), rawHand = geo('manager:hand3:raw', () => handVox(true));
  const thigh = geo('manager:thigh', () => trouserVox(THIGH)), shin = geo('manager:shin2', () => trouserVox(SHIN, 5.2, true)), shoe = geo('manager:shoe', shoeVox);
  const limbs = [], shoes = [];
  for (const side of [-1, 1]) limbs.push({ arm: true, side, a: part(upper), b: part(side < 0 ? watch : fore), end: part(hand, 'hand'), raw: part(rawHand, 'hand') });   // (a watch on its left wrist; and a hand that has turned)
  for (const side of [-1, 1]) { limbs.push({ arm: false, side, a: part(thigh), b: part(shin), end: null }); shoes.push(part(shoe)); }
  const parts = [...group.children];
  let head = heads[0];

  const vx = new THREE.Vector3(), vy = new THREE.Vector3(), vz = new THREE.Vector3(), basis = new THREE.Matrix4(), toLocal = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  /** Turn a length of it (made along +y) to run along a direction, its front (+z) as near another as that allows; stretch it, and let it out. */
  const aim = (mesh, dx, dy, dz, fx, fy, fz, len, made, wide = 1) => {
    vy.set(dx, dy, dz).normalize(); vz.set(fx, fy, fz); vx.crossVectors(vy, vz);
    if (vx.lengthSq() < 1e-6) vx.set(1, 0, 0); vx.normalize(); vz.crossVectors(vx, vy).normalize();
    mesh.quaternion.setFromRotationMatrix(basis.makeBasis(vx, vy, vz)); mesh.scale.set(wide, len / made, wide);
  };

  let lean = 0, phase = 0, last = null, burstFrom = null;

  function pose({ time = 0, speed = 0, fat = 0, swell = 0, mode = 'stands', lean: solved = 0, heading = 0, me = null, floorAt = null, hurt = Infinity, face = null } = {}) {
    const dt = last === null ? 0 : Math.max(0, Math.min(0.1, time - last)); last = time;
    if (burstFrom !== null) { for (const k of parts) k.visible = true; burstFrom = null; }       // (a fresh one: whole again; what shows is sorted below)
    group.rotation.set(0, heading, 0);
    // in its own frame: forward +z, its right +x, the floor at y 0 where it stands
    const fx = 0, fz = 1, px = 1, pz = 0, gy = group.position.y, ch = Math.cos(heading), shd = Math.sin(heading);
    const floor = (lx, lz) => (floorAt ? floorAt(group.position.x + lx * ch + lz * shd, group.position.z - lx * shd + lz * ch) - gy : 0);
    const sw = mode === 'swells' ? Math.max(0, Math.min(1, swell)) : 0, B = bloat(fat, sw, time), shake = B.shake * Math.sin(time * 38), reel = reelAt(hurt);
    // the cast's bend keeps its head under the ceiling; coming for you it stoops a little more, swelling more again (eased
    // into); cut, it reels up and back off its stoop, its arms thrown out — at once, not eased: a reel that has to wait for
    // the stoop to come round to it is over before it shows
    const want = Math.max(-0.35, Math.min(1.45, (Number.isFinite(solved) ? solved : 0) + (mode === 'comes' ? 0.12 : 0) + sw * 0.15));
    lean += (want - lean) * (dt > 0 ? Math.min(1, dt * 4) : 1);
    const L = Math.max(-0.35, lean - reel * 0.9);
    // its walk: long, slow strides, whatever its speed; the knees always a little bent
    const stride = 0.55 + 0.25 * (1 - fat), moved = Math.max(0, speed) * dt;
    phase += moved / stride * Math.PI;
    const kneel = 0.06 + sw * 0.1 + fat * 0.04, hipBack = T * Math.sin(L) * 0.35;
    const hip = { x: -fx * hipBack, y: BODY.hip - kneel + Math.abs(Math.sin(phase)) * 0.02, z: -fz * hipBack };
    const dir = { x: fx * Math.sin(L), y: Math.cos(L), z: fz * Math.sin(L) }, front = { x: fx * Math.cos(L), y: -Math.sin(L), z: fz * Math.cos(L) };
    // the body: thin, let out as it fattens; past half, the full one (four times the width: they meet at half), let out the rest of the way
    const widen = B.body + shake;
    thin.visible = fat < 0.5; full.visible = !thin.visible;
    const body = thin.visible ? thin : full, wide = (thin.visible ? 1 + fat * 1.3 : 0.375 + (fat - 0.5) * 1.25) * widen;
    body.position.set(hip.x, hip.y, hip.z); aim(body, dir.x, dir.y, dir.z, front.x, front.y, front.z, T, T, wide);
    const sh = { x: hip.x + dir.x * T, y: hip.y + dir.y * T, z: hip.z + dir.z * T }, half = (thin.visible ? 13 : 34) * S * wide;     // (its shoulders are where the jacket's are, however far out it has got)
    // the neck and the head: down further than the body, and turned to whoever it is having its meeting with
    const na = L * MANAGER.neck, ha = L * MANAGER.head - reel * 0.5, nd = { x: fx * Math.sin(na), y: Math.cos(na), z: fz * Math.sin(na) };
    const turned = turnedAt(fat, sw); neck.visible = !turned; rawNeck.visible = turned; const nk = turned ? rawNeck : neck;
    nk.position.set(sh.x, sh.y, sh.z); aim(nk, nd.x, nd.y, nd.z, fx * Math.cos(na), -Math.sin(na), fz * Math.cos(na), N, N, B.neck);
    const hb = { x: sh.x + nd.x * N, y: sh.y + nd.y * N, z: sh.z + nd.z * N };
    let tl = 0;
    if (me && Number.isFinite(me.x) && Number.isFinite(me.z)) {
      toLocal.set(me.x - group.position.x, 0, me.z - group.position.z).applyAxisAngle(UP, -heading);
      tl = Math.max(-1, Math.min(1, Math.atan2(toLocal.x - hb.x, toLocal.z - hb.z)));
    }
    const wear = Math.max(0, Math.min(FACES - 1, Number.isInteger(face) ? face : faceFor(fat, sw)));
    heads.forEach((h, f) => { h.visible = f === wear; }); head = heads[wear];
    head.position.set(hb.x, hb.y, hb.z); aim(head, Math.sin(tl) * Math.sin(ha), Math.cos(ha), Math.cos(tl) * Math.sin(ha), Math.sin(tl) * Math.cos(ha), -Math.sin(ha), Math.cos(tl) * Math.cos(ha), 1, 1, B.head); head.scale.y = B.tall;     // (fed, the head swells too)
    head.rotateZ(Math.sin(time * 0.7) * 0.06 + shake * 2);
    const swing = moved > 0 ? Math.sin(phase) : 0;
    limbs.forEach((l, i) => {
      if (l.arm) {
        // its arms hang, long; coming for you they swing; swelling, they lift from its sides; cut, they are thrown out
        const j = { x: sh.x + px * l.side * half, y: sh.y - 0.04, z: sh.z + pz * l.side * half };
        const reachOut = mode === 'comes' ? 0.35 : 0, sa = -l.side * swing * 0.35, out = 0.06 + sw * 0.5 + fat * 0.3 + reel * 0.6;
        const to = { x: j.x + fx * (reachOut + sa) + px * l.side * out, y: j.y - (U + F) * (0.97 - sw * 0.35 - reel * 0.3) + reachOut * 0.3, z: j.z + fz * (reachOut + sa) + pz * l.side * out };
        const e = elbow(j, to, U, F, { x: -fx * 2 + px * l.side, z: -fz * 2 + pz * l.side });
        l.a.position.set(j.x, j.y, j.z); aim(l.a, e.x - j.x, e.y - j.y, e.z - j.z, fx, 0, fz, U, U, B.arm);
        const hl = Math.min(F, Math.hypot(to.x - e.x, to.y - e.y, to.z - e.z));
        l.b.position.set(e.x, e.y, e.z); aim(l.b, to.x - e.x, to.y - e.y, to.z - e.z, fx, 0, fz, F, F, B.arm * 0.92);
        const hx = e.x + (to.x - e.x) / (hl || 1) * F, hy = e.y + (to.y - e.y) / (hl || 1) * F, hz = e.z + (to.z - e.z) / (hl || 1) * F;
        l.end.visible = !turned; l.raw.visible = turned; const hd = turned ? l.raw : l.end;
        hd.position.set(hx, hy, hz); aim(hd, to.x - e.x, to.y - e.y, to.z - e.z, fx, 0, fz, HAND * S, HAND * S, B.hand);
      } else {
        // its feet: one in front of the other, the far one lifting
        const ph = phase + (l.side > 0 ? Math.PI : 0), forward = moved > 0 || speed > 0 ? Math.sin(ph) * stride * 0.5 : 0, lift = moved > 0 ? Math.max(0, Math.cos(ph)) * 0.12 : 0;
        const j = { x: hip.x + px * l.side * (0.1 + fat * 0.12), y: hip.y, z: hip.z + pz * l.side * (0.1 + fat * 0.12) };
        const ax = px * l.side * (0.12 + fat * 0.1) + fx * forward, az = pz * l.side * (0.12 + fat * 0.1) + fz * forward;
        const ankle = { x: ax, y: floor(ax, az) + FOOT + lift, z: az };
        const e = elbow(j, ankle, TH, SH, { x: fx * 3, z: fz * 3 });
        l.a.position.set(j.x, j.y, j.z); aim(l.a, e.x - j.x, e.y - j.y, e.z - j.z, fx, 0, fz, TH, TH, B.leg);
        l.b.position.set(e.x, e.y, e.z); aim(l.b, ankle.x - e.x, ankle.y - e.y, ankle.z - e.z, fx, 0, fz, SH, SH, 1 + (B.leg - 1) * 0.6);
        const s = shoes[i - 2]; s.position.set(ankle.x, ankle.y, ankle.z); s.rotation.set(-lift * 1.5, 0, 0);
      }
    });
  }

  /**
   * Going off, 0 → 1. It is at full swell when it starts (the cast's pose left it there): in the first tenth it swells on past
   * that, juddering, its arms thrown up and out; then it is gone, all at once, and only what it was full of is left.
   */
  function burst(progress, time = 0) {
    const k = Math.max(0, Math.min(1, progress));
    // (where its last pose left it: what the going-off is measured from)
    if (burstFrom === null) burstFrom = { body: [thin, full, ...heads].map((p) => p.scale.clone()), arms: limbs.filter((l) => l.arm).map((l) => l.a.quaternion.clone()) };
    const pop = 0.1;
    if (k >= pop) { for (const p of parts) p.visible = false; return; }
    const u = k / pop, sw = 1 + 0.35 * u * u, judder = Math.sin(time * 90) * 0.03 * u;
    [thin, full, ...heads].forEach((p, i) => { const b0 = burstFrom.body[i]; p.scale.set(b0.x * sw * (1 + judder), b0.y * (1 + 0.04 * u), b0.z * sw * (1 - judder)); });
    limbs.filter((l) => l.arm).forEach((l, i) => { l.a.quaternion.copy(burstFrom.arms[i]); l.a.rotateZ(l.side * 0.5 * u); });
  }

  return {
    group,
    mat,
    light(rgb) { mat.uniforms.uTint.value.set(rgb[0] * 1.5 + 0.05, rgb[1] * 1.5 + 0.05, rgb[2] * 1.5 + 0.05); },
    pose,
    burst,
    /** The face it is wearing now (0…FACES − 1). */
    get face() { return heads.indexOf(head); },
  };
}
