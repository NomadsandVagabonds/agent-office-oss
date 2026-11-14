// Voxel rig for The Floor Warden: safety marshall in a white hard-hat and
// neon high-vis vest carrying giant articulated chrome office scissors.
import * as THREE from 'three';
import { Vox, M } from '../../../vox/vox.js';
import { Batch, lamp } from '../../kit.js';

const S = 0.026;

function wardenBodyVox() {
  const v = new Vox();
  const vest = M('#b5e625', 1), tape = M('#dfe6ea', 0), shirt = M('#dce4ec', 1);
  const skin = M('#d9b698', 1), hat = M('#f4f4ee', 0), crest = M('#e35924', 1);
  const dark = M('#18181e', 0), stache = M('#4a3728', 2), lens = M('#7eb6d4', 0);

  // High-vis vest over pale button-down shirt + silver reflective bands
  v.rbox(-8, 18, -4, 8, 34, 5, 2, vest);
  v.box(-2, 19, 4, 2, 34, 6, shirt);
  v.box(-8, 21, -5, 8, 23, 6, tape);
  v.box(-8, 26, -5, 8, 28, 6, tape);
  // Red whistle lanyard + silver pea-whistle
  v.tube(-3, 33, 5, 0, 26, 6, 0.55, M('#cf2828', 1));
  v.box(-1, 24, 5, 1, 26, 7, M('#b8c2cc', 0));

  // Left arm with safety armband
  v.tube(-8, 31, 0, -11, 23, 2, 2.2, shirt);
  v.box(-12, 27, -2, -9, 30, 3, crest);
  v.sphere(-11, 21, 3, 1.9, skin);

  // Right arm extended forward gripping the giant scissors
  v.tube(8, 31, 0, 10, 27, 7, 2.2, shirt);
  v.tube(10, 27, 7, 9, 25, 13, 2.0, skin);
  v.sphere(9, 25, 14, 2.1, skin);

  // Stern safety-monitor head, goggles, bristling moustache, and hard-hat
  v.rbox(-7, 34, -4, 7, 48, 7, 4, skin);
  v.box(-6, 41, 7, 6, 44, 8, dark);
  v.box(-5, 42, 7, -1, 43, 8, lens);
  v.box(1, 42, 7, 5, 43, 8, lens);
  v.box(-4, 37, 7, 4, 39, 8, stache);
  // Hard-hat with front brim and orange safety badge
  v.rbox(-8, 46, -6, 8, 53, 8, 4, hat);
  v.rbox(-8, 46, 6, 8, 48, 11, 2, hat, 'xz');
  v.box(-2, 48, 8, 2, 52, 9, crest);
  return v;
}

function legVox() {
  const v = new Vox();
  const pants = M('#263040', 2), boot = M('#1b1c20', 1), cap = M('#6e7682', 0);
  v.rbox(-2, -15, -2, 2, 0, 2, 1, pants, 'xz');
  v.rbox(-2, -18, -2, 2, -14, 5, 1, boot, 'xz');
  v.box(-2, -18, 3, 2, -15, 5, cap);
  return v;
}

function scissorHalfVox(upper = true) {
  const v = new Vox();
  const steel = M('#c6d0dc', 0), edge = M('#eef4fa', 0), grip = M('#e35924', 1), screw = M('#d4a838', 0);
  // Orange plastic loop handle behind pivot (z < 0)
  const yOff = upper ? 2 : -5;
  v.rbox(-1, yOff, -11, 1, yOff + 4, -2, 1, grip);
  v.carve(-1, yOff + 1, -9, 1, yOff + 3, -4);
  v.tube(0, 0, 0, 0, yOff + 2, -3, 1.1, grip);
  // Long gleaming 95cm chrome blade ahead of pivot (z > 0)
  for (let z = 0; z < 26; z++) {
    const h = Math.max(1, Math.round(3.4 * (1 - z / 28)));
    if (upper) {
      v.box(-1, 0, z, 0, h, z + 1, steel);
      v.set(0, 0, z, edge);
    } else {
      v.box(0, -h, z, 1, 0, z + 1, steel);
      v.set(0, 0, z, edge);
    }
  }
  if (upper) v.box(-2, -1, -1, 2, 1, 1, screw);
  return v;
}

export function makeFloorWarden(kit) {
  const lights = [lamp(0.2, 2.5, 0.8, [1.3, 1.3, 1.3], { k: 8, wrap: 0.48, far: 26 })], amb = [0.64, 0.64, 0.64];
  const mat = kit.surface({ vox: true });
  const m4 = new THREE.Matrix4().makeScale(S, S, S);
  const part = (key, make) => {
    const b = new Batch(true);
    b.addVox(kit.model('warden:' + key, make).solid, m4);
    return new THREE.Mesh(kit.geometry(b, lights, amb), mat);
  };

  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);

  const torso = part('torso', wardenBodyVox);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-3.5 * S, 18 * S, 0); legL.add(part('leg', legVox));
  legR.position.set(3.5 * S, 18 * S, 0); legR.add(part('leg', legVox));

  const scissors = new THREE.Group();
  scissors.position.set(9 * S, 25 * S, 15 * S);
  const bladeU = new THREE.Group(), bladeL = new THREE.Group();
  bladeU.add(part('bladeU', () => scissorHalfVox(true)));
  bladeL.add(part('bladeL', () => scissorHalfVox(false)));
  scissors.add(bladeU, bladeL);

  rig.add(torso, legL, legR, scissors);

  const shadow = new THREE.Mesh(
    kit.own(new THREE.PlaneGeometry(0.92, 0.92)),
    kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 1;
  group.add(shadow);

  return {
    group,
    pose(time, phase, speed, tripProgress = 0) {
      if (phase === 'tripping') {
        const k = tripProgress * tripProgress;
        rig.rotation.x = (Math.PI / 2) * k;
        rig.position.y = 0.12 * Math.sin(tripProgress * Math.PI);
        scissors.rotation.x = -0.35;
        bladeU.rotation.x = -0.32;
        bladeL.rotation.x = 0.32;
        return;
      }
      rig.position.y = phase === 'chasing' ? Math.abs(Math.sin(time * 15)) * 0.055 : Math.abs(Math.sin(time * 5.5)) * 0.015;
      rig.rotation.x = phase === 'chasing' ? 0.24 : 0.02;
      const rate = phase === 'chasing' ? 15 : 5.5;
      const stride = phase === 'chasing' ? 0.72 : (speed > 0.1 ? 0.34 : 0);
      legL.rotation.x = Math.sin(time * rate) * stride;
      legR.rotation.x = -Math.sin(time * rate) * stride;

      if (phase === 'chasing') {
        scissors.rotation.set(0.18, -0.08, 0);
        const open = 0.08 + Math.abs(Math.sin(time * 11.5)) * 0.34;
        bladeU.rotation.x = -open;
        bladeL.rotation.x = open;
      } else {
        // Held upright at safety-inspection ready
        scissors.rotation.set(-0.62, -0.18, 0.12);
        bladeU.rotation.x = -0.06;
        bladeL.rotation.x = 0.06;
      }
    },
    light(rgb) { mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); },
  };
}
