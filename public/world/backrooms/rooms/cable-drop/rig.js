// Voxel sculpture for The Trunk Line: an asymmetrical humanoid of coiled IEC
// power leads, spiraled handset cords, and Cat-6 patch cables, with a coiled
// spool for a head and three-pronged RJ45 plug claws. Its arms and three slack leads are cables that hang and swing
// (cord.js); its legs step and its spine folds (makeTrunkLine).
import * as THREE from 'three';
import { Vox, M, glow } from '../../../vox/vox.js';
import { Batch, lamp } from '../../kit.js';
import { createCord, settleCord, stepCord } from './cord.js';

const S = 0.028;

function coilLoop(v, cx, cy, cz, rx, rz, tiltX, tiltZ, col, segs = 20, rad = 0.85) {
  let px = null, py = null, pz = null;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const lx = Math.cos(a) * rx, lz = Math.sin(a) * rz;
    const x = cx + lx, z = cz + lz;
    const y = cy + lx * tiltZ + lz * tiltX;
    if (px !== null) v.tube(px, py, pz, x, y, z, rad, col);
    px = x; py = y; pz = z;
  }
}

function trunkBodyVox() {
  const v = new Vox();
  const blk = M('#121317', 2), chr = M('#22262e', 2), cat6 = M('#24569c', 1), yel = M('#c89c28', 1), plug = M('#8f96a2', 0);

  // Asymmetric bowed wire legs (left slightly bent, right planted wide)
  const legs = [
    [[-9, 0, -1], [-8, 12, 1], [-6, 23, 0], [-3, 30, 0]],
    [[10, 0, 1], [8, 13, -1], [5, 23, 0], [3, 30, 0]],
  ];
  for (const pts of legs) {
    for (let i = 0; i < pts.length - 1; i++) v.tube(...pts[i], ...pts[i + 1], 1.05, blk);
    // Secondary Cat-6 wrap twisting up each leg
    for (let y = 2; y < 28; y += 3) {
      const k = y / 28, bx = pts[0][0] * (1 - k) + pts[3][0] * k;
      const a0 = y * 0.7, a1 = (y + 3) * 0.7;
      v.tube(bx + Math.cos(a0) * 1.6, y, Math.sin(a0) * 1.6, bx + Math.cos(a1) * 1.6, y + 3, Math.sin(a1) * 1.6, 0.65, y % 6 === 0 ? cat6 : chr);
    }
  }

  // Pelvis junction & central twisted trunk spine
  v.tube(-4, 29, 0, 4, 29, 0, 1.2, blk);
  v.tube(0, 29, 0, -1, 40, 1, 1.35, blk);
  v.tube(-1, 40, 1, 0, 51, 0, 1.45, blk);

  // Loose rib-like cable loops coiled around the spine
  for (let i = 0; i < 6; i++) {
    const y = 32 + i * 3.1;
    const r = 3.2 + (i > 2 ? 1.8 : 0.4);
    coilLoop(v, (i % 2 ? 0.5 : -0.5), y, 0, r, r * 0.78, (i % 2 ? 0.18 : -0.16), 0.12, i === 3 ? cat6 : i === 5 ? yel : blk, 16, 0.78);
  }

  // Broad hunched cable-bundle shoulders + surge-strip block wedged in collarbone
  v.tube(-11, 49, 0, 0, 51, 0, 1.6, blk);
  v.tube(0, 51, 0, 11, 48, 0, 1.6, blk);
  v.box(-4, 48, -2, 3, 51, 2, chr);
  v.set(-2, 49, 2, plug); v.set(1, 49, 2, glow('#d9412b'));     // illuminated surge-strip rocker
  return v;
}

function trunkHeadVox() {
  const v = new Vox();
  const blk = M('#101115', 2), chr = M('#1f232b', 2), cat6 = M('#24569c', 1);
  // Dark recessed core inside the coiled spool nest
  v.ellipsoid(0, 5, 0, 5.2, 3.6, 5.2, blk);
  // Nested horizontal/tilted cable spool rings (the coiled nest silhouette)
  coilLoop(v, 0, 3.2, 0, 7.6, 7.2, 0.16, -0.12, blk, 22, 1.0);
  coilLoop(v, 0.4, 5.6, -0.3, 8.8, 8.2, -0.18, 0.15, chr, 24, 1.05);
  coilLoop(v, -0.4, 7.8, 0.3, 7.8, 7.5, 0.14, 0.22, blk, 22, 0.95);
  coilLoop(v, 0, 9.4, 0, 6.2, 6.0, -0.1, -0.14, cat6, 18, 0.75);
  // Two tiny recessed switch link LEDs deep inside the front coil
  v.set(-2, 5, 6, glow('#5bd94e'));
  v.set(2, 4, 6, glow('#f0a22e'));
  return v;
}

function trunkArmVox(side) {
  const v = new Vox();
  const blk = M('#121317', 2), chr = M('#232730', 2), cat6 = M('#24569c', 1), yel = M('#c89c28', 1), plug = M('#9aa2ae', 0), tip = M('#d8dde6', 0);
  // Long gangly core cable hanging down 34 voxels (~0.95 m)
  v.tube(0, 0, 0, side * 1.5, -15, 1, 1.05, blk);
  v.tube(side * 1.5, -15, 1, side * 1.0, -28, 2, 0.9, blk);
  // Spiraled telephone/patch cord coiled loosely down the whole arm
  let px = 2.4, py = 0, pz = 0;
  for (let i = 1; i <= 26; i++) {
    const y = -i * 1.08, a = i * 0.95 * side;
    const rad = 2.6 - i * 0.035;
    const nx = side * 1.1 + Math.cos(a) * rad, nz = 1 + Math.sin(a) * rad;
    v.tube(px, py, pz, nx, y, nz, 0.68, i % 7 === 0 ? cat6 : i % 11 === 0 ? yel : chr);
    px = nx; py = y; pz = nz;
  }
  // Three long splayed straight wire fingers capped with RJ45 modular plugs
  const wrist = [side * 1.0, -28, 2];
  const prongs = [
    [side * -4.5, -39, 5],
    [side * 1.2, -41, 6],
    [side * 6.2, -38, 3],
  ];
  for (const [fx, fy, fz] of prongs) {
    v.tube(wrist[0], wrist[1], wrist[2], fx, fy, fz, 0.72, blk);
    v.box(Math.round(fx) - 1, Math.round(fy) - 1, Math.round(fz) - 1, Math.round(fx) + 1, Math.round(fy) + 1, Math.round(fz) + 1, plug);
    v.set(Math.round(fx), Math.round(fy) - 1, Math.round(fz) + 1, tip);
  }
  return v;
}

export function dormantTendrilsVox() {
  const v = new Vox();
  const blk = M('#121317', 2), chr = M('#232730', 2), cat6 = M('#24569c', 1), yel = M('#c89c28', 1), plug = M('#9aa2ae', 0);
  const strands = [
    [-7, -5, -42, blk], [5, -6, -36, cat6], [-2, 6, -46, blk],
    [8, 4, -31, chr], [-6, 3, -34, yel], [2, -2, -48, blk],
  ];
  for (let s = 0; s < strands.length; s++) {
    const [ox, oz, len, col] = strands[s];
    let px = ox, py = 0, pz = oz;
    for (let i = 1; i <= 10; i++) {
      const k = i / 10, y = len * k;
      const nx = ox + Math.sin(i * 0.9 + s) * 2.1, nz = oz + Math.cos(i * 0.8 + s * 2) * 2.1;
      v.tube(px, py, pz, nx, y, nz, 0.78, col);
      px = nx; py = y; pz = nz;
    }
    v.box(Math.round(px) - 1, Math.round(py) - 2, Math.round(pz) - 1, Math.round(px) + 1, Math.round(py), Math.round(pz) + 1, plug);
  }
  return v;
}

/** A slack lead hanging straight down `len` voxels from its root, a plug on the end: bent along a cord each frame. */
function leadVox(len, col, seed) {
  const v = new Vox();
  const blk = M('#121317', 2), plug = M('#9aa2ae', 0), tip = M('#d8dde6', 0), c = M(col, col === '#121317' ? 2 : 1);
  let px = 0, py = 0, pz = 0;
  for (let i = 1; i <= len; i++) {
    const nx = Math.sin(i * 0.7 + seed) * 0.5, nz = Math.cos(i * 0.6 + seed * 2) * 0.5;
    v.tube(px, py, pz, nx, -i, nz, 0.62, i % 9 === 0 ? blk : c);
    px = nx; py = -i; pz = nz;
  }
  v.box(Math.round(px) - 1, -len - 2, Math.round(pz) - 1, Math.round(px) + 1, -len, Math.round(pz) + 1, plug);
  v.set(Math.round(px), -len - 2, Math.round(pz) + 1, tip);
  return v;
}

/* ---- bending a mesh along a cord ------------------------------------------------------------------------------ */
// Quaternions as [x, y, z, w]. The shortest turn taking unit a onto unit b.
function arc(ax, ay, az, bx, by, bz, out) {
  const d = ax * bx + ay * by + az * bz;
  if (d < -0.9999) { out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0; return out; }
  const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx, w = 1 + d, l = Math.hypot(cx, cy, cz, w);
  out[0] = cx / l; out[1] = cy / l; out[2] = cz / l; out[3] = w / l; return out;
}
function mul(a, b, out) {
  const x = a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1];
  const y = a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0];
  const z = a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3];
  const w = a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2];
  out[0] = x; out[1] = y; out[2] = z; out[3] = w; return out;
}
function turn(q, x, y, z, out, o = 0) {
  const tx = 2 * (q[1] * z - q[2] * y), ty = 2 * (q[2] * x - q[0] * z), tz = 2 * (q[0] * y - q[1] * x);
  out[o] = x + q[3] * tx + q[1] * tz - q[2] * ty; out[o + 1] = y + q[3] * ty + q[2] * tx - q[0] * tz; out[o + 2] = z + q[3] * tz + q[0] * ty - q[1] * tx;
}

/**
 * A mesh modelled hanging straight down its own -Y from its origin, made to lie along a chain of points in its own
 * frame: each vertex keeps its distance down the length and its offset across it. The geometry is its own (not shared).
 */
function bendable(mesh, n, seg) {
  const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal;
  const rest = Float32Array.from(pos.array), restN = Float32Array.from(nor.array, (v) => v / 127);
  const qs = Array.from({ length: n }, () => [0, 0, 0, 1]), tmp = [0, 0, 0, 1], bl = [0, 0, 0, 1], v = [0, 0, 0];
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), seg * n + 0.4);
  return function bend(P) {
    for (let i = 0; i < n; i++) {
      const a = i * 3, b = a + 3, dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], l = Math.hypot(dx, dy, dz) || 1;
      if (i === 0) arc(0, -1, 0, dx / l, dy / l, dz / l, qs[0]);
      else {
        const pa = a - 3, ex = P[a] - P[pa], ey = P[a + 1] - P[pa + 1], ez = P[a + 2] - P[pa + 2], m = Math.hypot(ex, ey, ez) || 1;
        mul(arc(ex / m, ey / m, ez / m, dx / l, dy / l, dz / l, tmp), qs[i - 1], qs[i]);
      }
    }
    const arr = pos.array, narr = nor.array;
    for (let k = 0; k < rest.length; k += 3) {
      const s = Math.max(0, -rest[k + 1] / seg), i = Math.min(n - 1, Math.floor(s)), f = s - i;
      // across a joint the turn is shared out, so the cable curves instead of kinking
      const j = Math.min(n - 1, i + 1), w = i === j ? 0 : Math.max(0, f - 0.5), qa = qs[i], qb = qs[j];
      const sg = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3] < 0 ? -1 : 1;
      bl[0] = qa[0] + (qb[0] * sg - qa[0]) * w; bl[1] = qa[1] + (qb[1] * sg - qa[1]) * w; bl[2] = qa[2] + (qb[2] * sg - qa[2]) * w; bl[3] = qa[3] + (qb[3] * sg - qa[3]) * w;
      const bn = Math.hypot(bl[0], bl[1], bl[2], bl[3]); bl[0] /= bn; bl[1] /= bn; bl[2] /= bn; bl[3] /= bn;
      const a = i * 3, b = a + 3;
      turn(bl, rest[k], 0, rest[k + 2], v);
      arr[k] = P[a] + (P[b] - P[a]) * f + v[0]; arr[k + 1] = P[a + 1] + (P[b + 1] - P[a + 1]) * f + v[1]; arr[k + 2] = P[a + 2] + (P[b + 2] - P[a + 2]) * f + v[2];
      turn(bl, restN[k], restN[k + 1], restN[k + 2], v);
      narr[k] = v[0] * 127; narr[k + 1] = v[1] * 127; narr[k + 2] = v[2] * 127;
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
  };
}

/* ---- The Trunk Line -------------------------------------------------------------------------------------------- */
const HIP = 29 * S;                 // the pelvis junction, where the legs meet the spine
const STRIDE = 0.95;                // metres walked per full step of both legs (the feet do not skate)

/**
 * The Trunk Line, rigged. Its body is one mesh whose legs step and whose spine folds over (moved vertex by vertex
 * about the pelvis), its arms and three slack leads are cables (cord.js) that hang, lag, swing and reach. All of it is
 * the creature's own motion and the clock: nothing random. Collision and rule are the room's and are not touched.
 * Cost: 8 meshes (body, head, 2 arms, 3 leads, shadow) where there were 5.
 *
 * pose(t, speed, crouch): t the room's clock (s), speed m/s it actually went this frame, crouch 1 standing … 0.46 under
 * the crawl header (and 0.55 → 1 as it unfolds from the drop).
 */
export function makeTrunkLine(kit) {
  const mat = kit.surface({ vox: true }), m4 = new THREE.Matrix4().makeScale(S, S, S);
  const lights = [lamp(0.2, 2.5, 0.9, [1.3, 1.3, 1.3], { k: 9, wrap: 0.48, far: 28 })], amb = [0.62, 0.62, 0.62];
  const part = (key, make) => {
    const b = new Batch(true);
    b.addVox(kit.model('trunk:' + key, make).solid, m4);
    return new THREE.Mesh(kit.geometry(b, lights, amb), mat);
  };
  const group = new THREE.Group();
  const body = part('body', trunkBodyVox);
  const head = new THREE.Group();
  head.add(part('head', trunkHeadVox));
  const armL = new THREE.Group(), armR = new THREE.Group();
  const armMeshL = part('armL', () => trunkArmVox(-1)), armMeshR = part('armR', () => trunkArmVox(1));
  armL.add(armMeshL); armR.add(armMeshR);
  group.add(body, head, armL, armR);

  // the cables: two arms that are mostly rod, three leads that are all slack
  const ARM_N = 6, ARM_SEG = 42 * S / ARM_N;
  const cables = [
    { mesh: armMeshL, holder: armL, at: [-11 * S, 49 * S, 0], n: ARM_N, seg: ARM_SEG, stiff: 0.55, drag: 2.2, side: -1, arm: true },
    { mesh: armMeshR, holder: armR, at: [11 * S, 48 * S, 0], n: ARM_N, seg: ARM_SEG, stiff: 0.55, drag: 2.2, side: 1, arm: true },
  ];
  for (const [key, at, len, n, col, seed] of [
    ['leadHip', [1 * S, HIP, -2 * S], 40, 8, '#24569c', 1],
    ['leadBackL', [-7 * S, 48 * S, -2 * S], 27, 6, '#121317', 2],
    ['leadBackR', [5 * S, 50 * S, -2 * S], 22, 5, '#c89c28', 3],
  ]) {
    const holder = new THREE.Group(), mesh = part(key, () => leadVox(len, col, seed));
    holder.add(mesh); group.add(holder);
    cables.push({ mesh, holder, at, n, seg: (len + 2) * S / n, stiff: 0.06, drag: 0.9, side: 0, arm: false });
  }
  for (const c of cables) { c.bend = bendable(c.mesh, c.n, c.seg); c.cord = createCord(c.n, c.seg); c.local = new Float64Array((c.n + 1) * 3); }

  const shadow = new THREE.Mesh(
    kit.own(new THREE.PlaneGeometry(1.1, 1.1)),
    kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 1;
  group.add(shadow);

  // the body, kept as it was modelled, to be moved from each frame
  const bg = body.geometry, bpos = bg.attributes.position, bnor = bg.attributes.normal;
  const brest = Float32Array.from(bpos.array), brestN = Float32Array.from(bnor.array, (v) => v / 127);
  bg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.8, 0), 1.6);

  let bodyKey = '', lastT = null, phase = 0, moving = 0, fold = 0, lastY = null, falling = false, landT = -1, ground = -Infinity, settled = false;
  const wp = new THREE.Vector3(), inv = new THREE.Matrix4(), gq = new THREE.Quaternion(), dirV = new THREE.Vector3();
  const qL = [0, 0, 0, 1], qR = [0, 0, 0, 1], qS = [0, 0, 0, 1], v3 = [0, 0, 0];
  const setQ = (q, ax, ay, az, ang) => { const s = Math.sin(ang / 2); q[0] = ax * s; q[1] = ay * s; q[2] = az * s; q[3] = Math.cos(ang / 2); return q; };

  /** Where a point of the upper body (above the pelvis) goes, given the spine's turn qS and the pelvis' new height. */
  function spinePoint(x, y, z, hipY, out) {
    turn(qS, x, y - HIP, z, out);
    out[1] += hipY;
    return out;
  }

  return {
    group, head, armL, armR, mat,
    pose(t, speed, crouch = 1) {
      const dt = lastT === null ? 0 : Math.max(0, Math.min(0.1, t - lastT)); lastT = t;
      group.scale.set(1, 1, 1);
      // how it is going: steps by the distance gone, a lurch when it hurries, a fold under a low ceiling
      phase += (speed * dt / STRIDE) * Math.PI * 2;
      moving += ((speed > 0.2 ? 1 : 0) - moving) * (1 - Math.exp(-dt * 6));
      const wantFold = Math.max(0, Math.min(1, (1 - crouch) / 0.54));
      fold += (wantFold - fold) * (1 - Math.exp(-dt * 10));

      // its weight: falling, and the landing (it bounces on its own cables)
      group.updateMatrixWorld(true);
      group.getWorldPosition(wp);
      if (lastY !== null && dt > 0) {
        const vy = (wp.y - lastY) / dt;
        if (vy < -1.2) falling = true;
        else if (falling && vy > -0.3) { falling = false; landT = t; ground = wp.y; }
        else if (!falling && Math.abs(vy) < 0.05) ground = wp.y;
      }
      lastY = wp.y;
      const since = landT < 0 ? 9 : t - landT;
      const bounce = since < 1.2 ? Math.exp(-since * 5) * Math.cos(since * 17) : 0;

      // the legs: each swings from its hip and lifts its foot; the other half a step behind
      const mv = moving, swing = 0.42 * mv, lean = 0.2 * mv;
      const squash = Math.max(0, Math.min(1, fold + Math.max(0, bounce) * 0.45));
      const hipY = HIP * (1 - 0.5 * squash) + Math.abs(Math.sin(phase)) * 0.03 * mv;
      const pitch = squash * 1.15 + lean + bounce * 0.18, roll = Math.sin(phase) * 0.07 * mv;
      setQ(qS, 1, 0, 0, pitch); mul(qS, setQ(qL, 0, 0, 1, roll), qS);
      const aL = Math.sin(phase) * swing, aR = -aL;
      setQ(qL, 1, 0, 0, aL); setQ(qR, 1, 0, 0, aR);
      const liftL = Math.max(0, Math.cos(phase)) * 0.08 * mv, liftR = Math.max(0, -Math.cos(phase)) * 0.08 * mv;
      const arr = bpos.array, narr = bnor.array;
      // (stood still, unfolded, done bouncing, and already drawn so: the body is left as it is)
      const key = `${mv.toFixed(3)}:${squash.toFixed(3)}:${bounce.toFixed(3)}:${mv > 0.001 ? phase.toFixed(3) : 0}`;
      if (key !== bodyKey) { bodyKey = key;
      for (let k = 0; k < brest.length; k += 3) {
        const x = brest[k], y = brest[k + 1], z = brest[k + 2];
        if (y < HIP - 0.5 * S) {
          const left = x < 0, q = left ? qL : qR, hx = left ? -4 * S : 4 * S, low = 1 - y / HIP;
          turn(q, x - hx, y - HIP, z, v3);
          const sx = 1 + 0.9 * squash, sy = 1 - 0.5 * squash;
          arr[k] = (v3[0] + hx) * sx; arr[k + 1] = (v3[1] + HIP) * sy + (left ? liftL : liftR) * low * low; arr[k + 2] = v3[2];
          turn(q, brestN[k], brestN[k + 1], brestN[k + 2], v3);
        } else {
          spinePoint(x, y, z, hipY, v3);
          arr[k] = v3[0]; arr[k + 1] = v3[1]; arr[k + 2] = v3[2];
          turn(qS, brestN[k], brestN[k + 1], brestN[k + 2], v3);
        }
        narr[k] = v3[0] * 127; narr[k + 1] = v3[1] * 127; narr[k + 2] = v3[2] * 127;
      }
      bpos.needsUpdate = true; bnor.needsUpdate = true; }

      // the head rides the top of the spine, and nods with it
      spinePoint(0, 51 * S, 0, hipY, v3); head.position.set(v3[0], v3[1], v3[2]);
      head.rotation.set(pitch * 0.55 + Math.sin(t * 3.1) * 0.08 - bounce * 0.25, Math.sin(t * 2.3) * 0.22, 0.14 + Math.cos(t * 2.7) * 0.08);

      // the cables: each hangs from where its root has gone to, in the world, so that they lag, swing and trail
      group.updateMatrixWorld(true);
      group.getWorldQuaternion(gq);
      for (const c of cables) {
        spinePoint(c.at[0], c.at[1], c.at[2], c.at[1] < HIP + S ? HIP * (1 - 0.5 * squash) : hipY, v3);
        c.holder.position.set(v3[0], v3[1], v3[2]);
        c.holder.updateMatrixWorld(true);
        c.holder.getWorldPosition(wp);
        // which way it would lie if it were rod: arms swing with the gait and reach forward on the hunt; leads trail back
        if (c.arm) {
          const reach = -0.15 - 0.95 * mv - 0.6 * squash, sw = Math.sin(phase + (c.side < 0 ? 0 : Math.PI)) * 0.5 * mv;
          dirV.set(-c.side * 0.25 * (1 - squash), -Math.cos(reach + sw), -Math.sin(reach + sw)).normalize();
        } else dirV.set(0, -1, -0.35).normalize();
        dirV.applyQuaternion(gq);
        const root = [wp.x, wp.y, wp.z], dir = [dirV.x, dirV.y, dirV.z];
        if (!settled) settleCord(c.cord, wp.x, wp.y, wp.z, dir[0], dir[1], dir[2]);
        let reachTo = null;
        if (c.arm && mv > 0.3) {
          // the plug claws go for what is in front of it, a little to their own side
          wp.set(c.side * 0.18, 0.95, 1.05); group.localToWorld(wp);
          reachTo = [wp.x, wp.y, wp.z];
        }
        stepCord(c.cord, dt, { root, dir, stiff: c.stiff, drag: c.drag, reach: reachTo, pull: 5 * mv, floor: ground + 0.02, rough: 0.7 });
        inv.copy(c.holder.matrixWorld).invert();
        const P = c.cord.p, L = c.local;
        for (let i = 0; i <= c.n; i++) {
          wp.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(inv);
          L[i * 3] = wp.x; L[i * 3 + 1] = wp.y; L[i * 3 + 2] = wp.z;
        }
        c.bend(L);
      }
      settled = true;
    },
    light(rgb) { mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); },
  };
}
