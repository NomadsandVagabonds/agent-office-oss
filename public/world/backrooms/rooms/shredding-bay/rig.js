// Voxel rig for The Retention Clerk and her heavy rolling industrial shredder.
import * as THREE from 'three';
import { Vox, M, glow } from '../../../vox/vox.js';
import { Batch, lamp, drawText } from '../../kit.js';
import { P } from '../../bits.js';

const S = 0.026;

function clerkVox() {
  const v = new Vox();
  const shoe = M('#3b2d26', 1), hose = M('#c8b6a2', 1), skirt = M('#474954', 2);
  const cardi = M('#8d7c96', 2), cardiD = M('#6e5f77', 2), blouse = M('#efe8d8', 1);
  const skin = M('#dfc1a7', 1), hair = M('#c4c8d0', 2), hairD = M('#989da8', 2);
  const spec = M('#d4b46a', 0), dark = M('#161418', 0), blush = M('#cf8a84', 1);

  // Sensible loafers and ankles
  for (const x0 of [-5, 1]) {
    v.rbox(x0, 0, -3, x0 + 4, 3, 5, shoe, 'xz');
    v.box(x0 + 1, 3, -1, x0 + 3, 8, 2, hose);
  }
  // Pleated midi skirt
  v.rbox(-7, 7, -5, 7, 19, 5, 2, skirt, 'xz');
  for (const x of [-5, -2, 1, 4]) v.box(x, 7, 5, x + 1, 18, 6, M('#363842', 2));

  // Slightly stooped cable-knit cardigan and cream collar
  v.rbox(-8, 18, -4, 8, 32, 6, 2, cardi);
  v.box(-3, 25, 5, 3, 32, 7, blouse);
  for (const y of [20, 23]) v.set(0, y, 6, M('#4a3525', 0));       // tortoiseshell buttons
  // Arms reaching forward to grip the shredder push-handle
  for (const sx of [-1, 1]) {
    v.tube(sx * 8, 29, 1, sx * 7, 25, 9, 2.2, cardi);
    v.tube(sx * 7, 25, 9, sx * 6, 24, 15, 1.9, cardiD);
    v.sphere(sx * 6, 24, 16, 1.8, skin);
  }

  // Head tilted slightly forward with silver bun, spectacles chain, and cheerful smile
  v.rbox(-7, 32, -3, 7, 46, 9, 4, skin);
  // Silver hair & high bun at the crown/back
  v.rbox(-8, 41, -5, 8, 47, 7, 3, hair);
  v.rbox(-8, 34, -5, 8, 43, 1, 2, hairD);
  v.ellipsoid(0, 46, -4, 4.5, 4.0, 4.5, hair);
  v.tube(-5, 46, -4, 5, 47, -4, 0.6, M('#7a5230', 0));             // wooden hairpin

  // Half-moon spectacles + beaded chain
  v.box(-6, 38, 9, -1, 40, 10, spec);
  v.box(1, 38, 9, 6, 40, 10, spec);
  v.box(-1, 39, 9, 1, 40, 10, spec);
  for (const sx of [-1, 1]) for (let y = 32; y <= 38; y += 2) v.set(sx * 6, y, 8, spec);

  // Cheerful twinkling eyes, rosy cheeks, and an unnervingly wide curved smile
  v.set(-4, 40, 9, dark); v.set(3, 40, 9, dark);
  v.box(-6, 36, 9, -4, 37, 10, blush); v.box(4, 36, 9, 6, 37, 10, blush);
  for (let x = -4; x <= 4; x++) {
    const lift = Math.abs(x) >= 3 ? 1 : 0;
    v.set(x, 34 + lift, 9, dark);
  }
  return v;
}

function shredderCartVox() {
  const v = new Vox();
  const body = M('#cfc8b4', 1), dark = M('#2d3138', 1), steel = M('#8e96a2', 0), caster = M('#181a1f', 1);
  const binWin = M('#4b525c', 1), shred1 = M('#f3b3c0', 1), shred2 = M('#efe9d8', 1);

  // Four industrial casters
  for (const sx of [-8, 6]) for (const sz of [14, 28]) {
    v.box(sx, 0, sz, sx + 2, 3, sz + 3, caster);
  }
  // Rolling cabinet housing
  v.rbox(-10, 3, 13, 10, 25, 31, 1, body);
  v.box(-10, 22, 13, 10, 26, 31, dark);                            // heavy steel top deck
  // Push-bar facing the clerk
  v.tube(-7, 24, 13, -7, 24, 16, 0.9, steel);
  v.tube(7, 24, 13, 7, 24, 16, 0.9, steel);
  v.tube(-7, 24, 16, 7, 24, 16, 0.95, steel);

  // Deep recessed feed throat on top
  v.carve(-8, 23, 18, 8, 27, 26);
  v.box(-8, 22, 17, 8, 25, 18, steel);
  v.box(-8, 22, 26, 8, 25, 27, steel);

  // Inspection window on front showing shredded memos and pink slips inside
  v.box(-6, 6, 31, 6, 17, 32, binWin);
  for (let x = -5; x <= 4; x += 2) for (let y = 7; y <= 13; y += 2) {
    v.set(x, y, 31, (x + y) % 3 === 0 ? shred1 : shred2);
  }
  // Status lamp on top corner
  v.box(7, 26, 28, 9, 27, 30, glow('#4be068'));
  return v;
}

function rollerVox() {
  const v = new Vox();
  const steel = M('#9aa3b0', 0), edge = M('#cfd6e0', 0), gap = M('#23262c', 1);
  v.cyl('x', 0, 0, -7, 7, 2.2, gap);
  for (let x = -7; x <= 6; x += 2) {
    v.cyl('x', 0, 0, x, x + 1, 2.6, steel);
    v.set(x, 2, 1, edge); v.set(x, -2, -1, edge);
    v.set(x, 1, -2, edge); v.set(x, -1, 2, edge);
  }
  return v;
}

export function makeRetentionClerk(kit) {
  const mat = kit.surface({ vox: true }), m4 = new THREE.Matrix4().makeScale(S, S, S);
  const lights = [lamp(0.2, 2.5, 0.9, [1.3, 1.3, 1.3], { k: 9, wrap: 0.48, far: 28 })], amb = [0.64, 0.64, 0.64];
  const part = (key, make) => {
    const b = new Batch(true);
    b.addVox(kit.model('clerk:' + key, make).solid, m4);
    return new THREE.Mesh(kit.geometry(b, lights, amb), mat);
  };

  const group = new THREE.Group();
  const clerk = part('lady', clerkVox);
  const cart = part('cart', shredderCartVox);
  const rollerA = new THREE.Group(), rollerB = new THREE.Group();
  rollerA.position.set(0, 24.2 * S, 20.5 * S); rollerA.add(part('roller', rollerVox));
  rollerB.position.set(0, 24.2 * S, 23.8 * S); rollerB.add(part('roller', rollerVox));
  group.add(clerk, cart, rollerA, rollerB);

  // Warning plate across the front of the shredder
  const plateTex = kit.tex.custom('clerk:plate', 128, 36, (g, w, h) => {
    P(g, '#20242a', 0, 0, w, h); P(g, '#c99326', 2, 2, w - 4, h - 4);
    drawText(g, ['FEED PAPER HERE', 'KEEP HANDS CLEAR'], 4, 4, w - 8, h - 8, { color: '#181818', size: 10, pad: 2, leading: 1.1 });
  }, { clamp: true });
  const plateB = new Batch();
  const px = 7.5 * S, py0 = 18.2 * S, py1 = 21.5 * S, pz = 31.3 * S;
  plateB.quad([-px, py0, pz], [px, py0, pz], [px, py1, pz], [-px, py1, pz]);
  const plateMat = kit.surface({ map: plateTex });
  group.add(new THREE.Mesh(kit.geometry(plateB, lights, amb), plateMat));

  // Small confetti burst group when shredding paper
  const confetti = new THREE.Group();
  confetti.position.set(0, 26 * S, 22 * S);
  confetti.visible = false;
  const confB = new Batch();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, r = 0.04 + (i % 3) * 0.04, y = (i % 4) * 0.045;
    confB.box(Math.cos(a) * r - 0.012, y, Math.sin(a) * r - 0.008, Math.cos(a) * r + 0.012, y + 0.006, Math.sin(a) * r + 0.008, i % 2 ? [0.95, 0.7, 0.76] : [0.94, 0.92, 0.86]);
  }
  const confMat = kit.surface({});
  confetti.add(new THREE.Mesh(kit.geometry(confB, lights, amb), confMat));
  group.add(confetti);

  const shadow = new THREE.Mesh(
    kit.own(new THREE.PlaneGeometry(1.15, 1.45)),
    kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.012, 0.28); shadow.renderOrder = 1;
  group.add(shadow);

  return {
    group, confetti,
    animate(dt, time, moving, shredding) {
      const spin = shredding ? 22 : 7;
      rollerA.rotation.x += dt * spin;
      rollerB.rotation.x -= dt * spin;
      clerk.position.y = moving ? Math.abs(Math.sin(time * 6.5)) * 0.018 : 0;
      clerk.rotation.z = moving ? Math.sin(time * 6.5) * 0.025 : Math.sin(time * 1.6) * 0.012;
      confetti.visible = shredding;
      if (shredding) {
        confetti.rotation.y = time * 5.5;
        confetti.position.y = 26 * S + ((time * 3) % 1) * 0.14;
      }
    },
    light(rgb) {
      mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
      plateMat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
      confMat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
    },
  };
}
