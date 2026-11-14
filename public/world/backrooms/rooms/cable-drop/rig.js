// Voxel sculpture for The Trunk Line: an asymmetrical humanoid of coiled IEC
// power leads, spiraled handset cords, and Cat-6 patch cables, with a coiled
// spool for a head and three-pronged RJ45 plug claws.
import * as THREE from 'three';
import { Vox, M, glow } from '../../../vox/vox.js';
import { Batch, lamp } from '../../kit.js';

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
  head.position.set(0, 51 * S, 0);
  head.add(part('head', trunkHeadVox));
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-11 * S, 49 * S, 0); armL.add(part('armL', () => trunkArmVox(-1)));
  armR.position.set(11 * S, 48 * S, 0); armR.add(part('armR', () => trunkArmVox(1)));
  group.add(body, head, armL, armR);

  const shadow = new THREE.Mesh(
    kit.own(new THREE.PlaneGeometry(1.1, 1.1)),
    kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 1;
  group.add(shadow);

  return {
    group, head, armL, armR, mat,
    pose(t, speed, crouchScale = 1) {
      group.scale.set(1, crouchScale, 1);
      const walk = speed > 0.2 ? Math.sin(t * 9.5) : Math.sin(t * 1.8) * 0.15;
      const reach = speed > 0.2 ? -0.68 : -0.15;
      armL.rotation.set(reach + walk * 0.45, 0, -0.16 - Math.abs(walk) * 0.08);
      armR.rotation.set(reach - walk * 0.45, 0, 0.16 + Math.abs(walk) * 0.08);
      head.rotation.set(Math.sin(t * 3.1) * 0.08, Math.sin(t * 2.3) * 0.22, 0.14 + Math.cos(t * 2.7) * 0.08);
    },
    light(rgb) { mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); },
  };
}
