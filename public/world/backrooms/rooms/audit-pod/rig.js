// Voxel rig for The Efficiency Partners: sleek charcoal-suited management
// consultants with rimless glasses, an unnervingly sympathetic head-tilt, an
// aluminium clipboard in the left hand, and a pastel Pink Slip in the right.
import * as THREE from 'three';
import { Vox, M, glass } from '../../../vox/vox.js';
import { Batch, lamp } from '../../kit.js';

const S = 0.026;

function partnerTorsoVox(idx = 0) {
  const v = new Vox();
  const suit = M(idx % 2 === 0 ? '#232732' : '#1e2838', 2);
  const lapel = M('#161922', 2), shirt = M('#f4f4f0', 1), tie = M('#5aa2d8', 1);
  const skin = M(idx % 2 === 0 ? '#dfc2a8' : '#cfa888', 1);
  const hair = M(idx % 2 === 0 ? '#221e1b' : '#4a3b2e', 2);
  const clip = M('#b8c2cc', 0), brass = M('#cfa844', 0), page = M('#f3efe4', 1);
  const dark = M('#17161c', 0), spec = M('#9aa6b4', 0);

  // Tailored jacket, crisp white V-shirt, ice-blue silk tie, pocket square
  v.rbox(-7, 18, -4, 7, 34, 4, 2, suit);
  for (let y = 25; y <= 33; y++) {
    const w = Math.max(1, Math.round((y - 24) / 2.2));
    v.box(-w, y, 4, w, y + 1, 5, shirt);
    v.set(-w - 1, y, 4, lapel);
    v.set(w, y, 4, lapel);
  }
  v.box(-1, 24, 4, 1, 33, 5, tie);
  v.box(-6, 29, 4, -3, 30, 5, shirt);

  // Left arm bent forward holding brushed-aluminium clipboard
  v.tube(-7, 31, 0, -10, 24, 4, 2.0, suit);
  v.tube(-10, 24, 4, -7, 23, 10, 1.8, suit);
  v.sphere(-6, 23, 11, 1.7, skin);
  // Clipboard resting against left forearm
  v.box(-10, 22, 7, -3, 24, 16, clip);
  v.box(-9, 24, 8, -4, 25, 15, page);
  v.box(-8, 24, 15, -5, 26, 16, brass);

  // Slicked-back consultant head tilted in rehearsed corporate sympathy
  const tilt = idx % 2 === 0 ? 1 : -1;
  v.rbox(-7 + tilt, 34, -4, 7 + tilt, 49, 7, 4, skin);
  v.rbox(-8 + tilt, 45, -5, 8 + tilt, 51, 7, 3, hair);
  v.rbox(-8 + tilt, 36, -5, 8 + tilt, 46, 0, 2, hair);
  // Rimless glasses + unblinking eyes + flat closed-lip smile
  for (const sx of [-5, 1]) {
    v.box(sx + tilt, 41, 7, sx + 4 + tilt, 44, 8, glass('#cfe4f2'));
    v.set(sx + 2 + tilt, 42, 7, dark);
  }
  v.box(-1 + tilt, 42, 7, 1 + tilt, 43, 8, spec);
  for (let x = -3; x <= 3; x++) {
    v.set(x + tilt, 37 + (Math.abs(x) === 3 ? 1 : 0), 7, dark);
  }
  return v;
}

function rightArmSlipVox(idx = 0) {
  const v = new Vox();
  const suit = M(idx % 2 === 0 ? '#232732' : '#1e2838', 2);
  const skin = M(idx % 2 === 0 ? '#dfc2a8' : '#cfa888', 1);
  const slip = M('#f3b3c0', 1), hdr = M('#a62639', 1), pen = M('#cfd6e0', 0);

  // Pivoted at right shoulder (0, 0, 0), hanging down in rest pose, raised when offering
  v.tube(0, 0, 0, 2, -7, 2, 2.0, suit);
  v.tube(2, -7, 2, 1, -12, 6, 1.8, suit);
  v.sphere(1, -13, 7, 1.8, skin);
  // Silver ballpoint pen
  v.tube(0, -13, 6, -2, -11, 10, 0.5, pen);
  // Crisp pastel Pink Slip extending forward from fingers
  v.box(-2, -14, 7, 5, -13, 16, slip);
  v.box(-1, -13, 13, 4, -12, 15, hdr);
  return v;
}

function suitLegVox() {
  const v = new Vox();
  const pants = M('#1d212b', 2), oxford = M('#141210', 0);
  v.rbox(-2, -15, -2, 2, 0, 2, 1, pants, 'xz');
  v.rbox(-2, -18, -2, 2, -15, 5, 1, oxford, 'xz');
  return v;
}

export function makeEfficiencyPartner(kit, idx = 0) {
  const lights = [lamp(0.2, 2.5, 0.8, [1.3, 1.3, 1.3], { k: 8, wrap: 0.48, far: 26 })], amb = [0.64, 0.64, 0.64];
  const mat = kit.surface({ vox: true });
  const m4 = new THREE.Matrix4().makeScale(S, S, S);
  const part = (key, make) => {
    const b = new Batch(true);
    b.addVox(kit.model(key, make).solid, m4);
    return new THREE.Mesh(kit.geometry(b, lights, amb), mat);
  };

  const group = new THREE.Group();
  const body = part(`partner:body:${idx % 2}`, () => partnerTorsoVox(idx));
  const armR = new THREE.Group();
  armR.position.set(7.5 * S, 31 * S, 0);
  armR.add(part(`partner:arm:${idx % 2}`, () => rightArmSlipVox(idx)));

  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-3.2 * S, 18 * S, 0); legL.add(part('partner:leg', suitLegVox));
  legR.position.set(3.2 * S, 18 * S, 0); legR.add(part('partner:leg', suitLegVox));

  group.add(body, armR, legL, legR);

  const shadow = new THREE.Mesh(
    kit.own(new THREE.PlaneGeometry(0.82, 0.82)),
    kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.36, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 1;
  group.add(shadow);

  return {
    group,
    pose(time, phase, moving) {
      const stride = moving ? Math.sin(time * 7.2) * 0.38 : 0;
      legL.rotation.x = stride;
      legR.rotation.x = -stride;
      body.position.y = moving ? Math.abs(Math.sin(time * 7.2)) * 0.018 : 0;

      if (phase === 'offering' || phase === 'approaching') {
        armR.rotation.set(-0.68 + Math.sin(time * 3.2) * 0.04, -0.06, 0);
      } else {
        // Writing notes on clipboard
        armR.rotation.set(-0.22 + Math.sin(time * 6.5) * 0.05, -0.38, -0.12);
      }
    },
    light(rgb) { mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); },
  };
}
