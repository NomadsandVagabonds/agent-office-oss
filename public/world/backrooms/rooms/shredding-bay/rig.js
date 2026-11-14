// Voxel rig for The Retention Clerk ("Grannie") and her heavy rolling
// industrial shredder: sculpted from `avatar/build.js` (silver bun, dusty
// cardigan, loafers) into a stooped, extra-long-headed Backrooms archivist
// with four stacked pairs of bloodshot staring eyes, three crooked pairs of
// old spectacles (leaving the top forehead pair bare), a snaggle-toothed
// whistling maw, and VHS head-tear twitches.
import * as THREE from 'three';
import { Vox, M, glow, tone, mix, toCss } from '../../../vox/vox.js';
import { buildCharacter, JOINT } from '../../../avatar/build.js';
import { Batch, lamp, drawText } from '../../kit.js';
import { P } from '../../bits.js';
import {
  pallorLook, mottleHead, stretchHead, eraseNose, bulgingEye,
  slippedMouth, carveCreases, crookedSpecs, slipRows, tornVox,
  jointMat, localJointMat,
} from '../../uncanny.js';

const S = [0.0255, 0.0265, 0.0255];

const CLERK_SPEC = {
  skin: '#e0c7ad',
  hair: 'bun',
  hairColor: '#c2c7d1',
  outfit: 'cardigan',
  outfitColor: '#7c6b86',
};

function buildClerkHeadVox() {
  const look = pallorLook(CLERK_SPEC, { pallor: 0.42, tint: '#cfc7b4' });
  const parts = buildCharacter(look, { seed: 'clerk:grannie' });
  const head = parts.head;
  eraseNose(head);

  // Stretch skull +16 voxels taller (HY1: 52 -> 68) so 4 stacked pairs of eyes fit
  stretchHead(head, 16, 46);

  // Swap cheerful coral bun scrunchie (shifted to y ≈ 67) for an antique wooden hairpin
  head.paint(-6, 65, -10, 6, 70, -1, (x, y, z, cur) => (y === 67 ? M('#5b3b24', 1) : cur));
  head.tube(-6, 70, -5.5, 5, 71, -5.5, 0.6, M('#6e482b', 0));

  mottleHead(head, look.skin, 509, { gaunt: 0.48 });

  // Bulbous, horizontally-creased fleshy nose column down the centre between the lower eyes
  const flesh = M(toCss(tone(look.skin, -0.06)), 1);
  const crease = M(toCss(mix(look.skin, '#2b1416', 0.62)), 1);
  for (let y = 41; y <= 51; y++) {
    const wide = y <= 44 ? 2 : 1;
    for (let x = -wide; x < wide; x++) {
      head.set(x, y, 8, (y === 43 || y === 46 || y === 49) ? crease : flesh);
    }
  }

  // 4 stacked pairs of staring Backrooms eyes down her extra-long head:
  // Pair 1 (top forehead, y = 60..62) — BARE / UNGLASSED, staring over all 3 frames
  bulgingEye(head, -4.5, 61.5, 5, 3, 1, 0, look.skin, { bloodshot: true });
  bulgingEye(head, 4.5, 61.5, 5, 3, -1, 0, look.skin, { bloodshot: true });

  // Pair 2 (upper-mid, y = 54..57) — framed by crooked tarnished pewter wire rims (#1)
  bulgingEye(head, -4.5, 55.5, 5, 3, 0, -1, look.skin);
  bulgingEye(head, 4.5, 56.5, 5, 3, -1, 0, look.skin, { bloodshot: true });

  // Pair 3 (lower-mid, y = 47..50) — framed by crooked dark tortoiseshell rims (#2)
  bulgingEye(head, -4.5, 49.5, 5, 3, 1, 0, look.skin, { bloodshot: true, glitch: 1 });
  bulgingEye(head, 4.5, 48.5, 5, 3, 0, 0, look.skin, { bloodshot: true });

  // Pair 4 (bottom cheek, y = 41..43) — framed by slipped gold half-moon rims + chain (#3)
  bulgingEye(head, -4.5, 42.5, 5, 3, 0, 0, look.skin, { bloodshot: true });
  bulgingEye(head, 4.5, 42.5, 5, 3, -1, 0, look.skin);

  // 3 stacked pairs of old granny glasses (for the lower 3 pairs of eyes)
  crookedSpecs(head, { leftY: 53, rightY: 54, h: 5, z: 9, frameHex: '#948d7b' });
  crookedSpecs(head, { leftY: 47, rightY: 46, h: 5, z: 9, frameHex: '#382216' });
  crookedSpecs(head, { leftY: 40, rightY: 40, h: 5, z: 9, frameHex: '#c8a048', chain: true });

  // Sunken, off-centre snaggle-toothed whistling mouth + heavy horizontal brow/cheek folds
  slippedMouth(head, 0.5, 36, 9, 3, look.skin, { curve: 1.2, slope: -0.14, teeth: true });
  carveCreases(head, look.skin, [
    [-6, 65, 5, 64, true],
    [-7, 63, 6, 63, false],
    [-7, 59, -2, 58, true],
    [2, 59, 6, 59, true],
    [-7, 52, 6, 52, true],
    [-7, 45, 6, 45, true],
    [-8, 40, -5, 36, true],
    [5, 40, 7, 36, true],
    [-4, 35, 4, 35, false],
  ]);
  slipRows(head, [[36, 37, 1, 0]]);
  return head;
}

function buildClerkBodyBatch(kit) {
  const look = pallorLook(CLERK_SPEC, { pallor: 0.46, tint: '#d4cfc2' });
  const parts = buildCharacter(look, { seed: 'clerk:grannie' });

  // Pleated dark midi skirt + sensible orthopaedic loafers over the Office legs
  const skirtVox = new Vox();
  const skirt = M('#3d3f4a', 2), pleat = M('#2c2e37', 2);
  skirtVox.rbox(-7, 7, -5, 7, 19, 5, 2, skirt, 'xz');
  for (const x of [-5, -2, 1, 4]) skirtVox.box(x, 7, 5, x + 1, 18, 6, pleat);

  const loafer = M('#2d221d', 1), hose = M('#bfb09c', 1);
  for (const leg of [parts.legLowerL, parts.legLowerR]) {
    leg.paint(-10, 3, -5, 10, 10, 5, hose);
    leg.paint(-10, 0, -5, 10, 3, 7, loafer);
  }

  const b = new Batch(true);
  const add = (sub, vox, m4) => {
    const geo = kit.model(`clerk:body:${sub}`, () => vox);
    if (geo?.solid) b.addVox(geo.solid, m4);
  };

  // Hunched forward from the hips toward the shredder push-bar
  add('torso', parts.torso, jointMat(S, JOINT.hips, 0.22, 0, 0, 0.98));
  add('skirt', skirtVox, new THREE.Matrix4().makeScale(S[0], S[1], S[2]));
  add('legUL', parts.legUpperL, jointMat(S, JOINT.hipL));
  add('legLL', parts.legLowerL, jointMat(S, JOINT.hipL));
  add('legUR', parts.legUpperR, jointMat(S, JOINT.hipR));
  add('legLR', parts.legLowerR, jointMat(S, JOINT.hipR));

  // Both arms pitched forward from her stooped shoulders to grip the steel push-bar (z ≈ 15)
  for (const side of [-1, 1]) {
    const sh = side < 0 ? JOINT.shoulderL : JOINT.shoulderR;
    const uVox = side < 0 ? parts.armUpperL : parts.armUpperR;
    const lVox = side < 0 ? parts.armLowerL : parts.armLowerR;
    lVox.paint(-12, 14, -4, 12, 17, 4, M('#5c3e3c', 1));
    const armM = jointMat(S, sh, -1.16, side * -0.14, side * -0.08, 1.06, 0, -1.2, 3.2);
    add(side < 0 ? 'armUL' : 'armUR', uVox, armM);
    add(side < 0 ? 'armLL' : 'armLR', lVox, armM);
  }
  return b;
}

function shredderCartVox() {
  const v = new Vox();
  const body = M('#c9c1ac', 1), dark = M('#292d34', 1), steel = M('#8a929e', 0), caster = M('#17191e', 1);
  const binWin = M('#414852', 1), shred1 = M('#eeb0bc', 1), shred2 = M('#eae3d0', 1), stain = M('#59181d', 1);

  for (const sx of [-8, 6]) for (const sz of [14, 28]) {
    v.box(sx, 0, sz, sx + 2, 3, sz + 3, caster);
  }
  v.rbox(-10, 3, 13, 10, 25, 31, 1, body);
  v.box(-10, 22, 13, 10, 26, 31, dark);
  // Push-bar gripped by the clerk
  v.tube(-7, 24, 13, -7, 24, 16, 0.9, steel);
  v.tube(7, 24, 13, 7, 24, 16, 0.9, steel);
  v.tube(-7, 24, 16, 7, 24, 16, 0.95, steel);

  // Recessed feed throat with faint dried crimson/rust stains along the lip
  v.carve(-8, 23, 18, 8, 27, 26);
  v.box(-8, 22, 17, 8, 25, 18, steel);
  v.box(-8, 22, 26, 8, 25, 27, steel);
  for (const x of [-5, -2, 3, 5]) v.set(x, 25, 26, stain);
  for (const x of [-4, 1, 4]) v.set(x, 25, 17, stain);

  v.box(-6, 6, 31, 6, 17, 32, binWin);
  for (let x = -5; x <= 4; x += 2) for (let y = 7; y <= 13; y += 2) {
    v.set(x, y, 31, (x + y) % 5 === 0 ? stain : (x + y) % 3 === 0 ? shred1 : shred2);
  }
  v.box(7, 26, 28, 9, 27, 30, glow('#4be068'));
  return v;
}

function rollerVox() {
  const v = new Vox();
  const steel = M('#9aa3b0', 0), edge = M('#cfd6e0', 0), gap = M('#23262c', 1), stain = M('#5e191e', 0);
  v.cyl('x', 0, 0, -7, 7, 2.2, gap);
  for (let x = -7; x <= 6; x += 2) {
    v.cyl('x', 0, 0, x, x + 1, 2.6, x === -1 || x === 3 ? stain : steel);
    v.set(x, 2, 1, edge); v.set(x, -2, -1, edge);
    v.set(x, 1, -2, edge); v.set(x, -1, 2, edge);
  }
  return v;
}

export function makeRetentionClerk(kit) {
  const mat = kit.surface({ vox: true });
  const cartScale = new THREE.Matrix4().makeScale(S[0], S[1], S[2]);
  const lights = [lamp(0.2, 2.5, 0.9, [1.3, 1.3, 1.3], { k: 9, wrap: 0.48, far: 28 })], amb = [0.62, 0.62, 0.62];
  const part = (key, make) => {
    const b = new Batch(true);
    b.addVox(kit.model('clerk:' + key, make).solid, cartScale);
    return new THREE.Mesh(kit.geometry(b, lights, amb), mat);
  };

  const group = new THREE.Group();
  const clerk = new THREE.Group();
  const bodyMesh = new THREE.Mesh(kit.geometry(buildClerkBodyBatch(kit), lights, amb), mat);

  // Forward-stooped neck pivot (hunched +3.4 voxels forward along +z)
  const head = new THREE.Group();
  head.position.set(0, (JOINT.head[1] - 1.2) * S[1], 3.4 * S[2]);
  const headM4 = localJointMat(S, JOINT.head);
  const bWhole = new Batch(true);
  bWhole.addVox(kit.model('clerk:headWhole', buildClerkHeadVox).solid, headM4);
  const bSlip = new Batch(true);
  bSlip.addVox(kit.model('clerk:headTorn', () => tornVox(buildClerkHeadVox(), 113)).solid, headM4);
  const headWhole = new THREE.Mesh(kit.geometry(bWhole, lights, amb), mat);
  const headSlipped = new THREE.Mesh(kit.geometry(bSlip, lights, amb), mat);
  headSlipped.visible = false;
  head.add(headWhole, headSlipped);
  head.rotation.set(0.05, 0, -0.08);
  clerk.add(bodyMesh, head);

  const cart = part('cart', shredderCartVox);
  const rollerA = new THREE.Group(), rollerB = new THREE.Group();
  rollerA.position.set(0, 24.2 * S[1], 20.5 * S[2]); rollerA.add(part('roller', rollerVox));
  rollerB.position.set(0, 24.2 * S[1], 23.8 * S[2]); rollerB.add(part('roller', rollerVox));
  group.add(clerk, cart, rollerA, rollerB);

  const plateTex = kit.tex.custom('clerk:plate', 128, 36, (g, w, h) => {
    P(g, '#20242a', 0, 0, w, h); P(g, '#c99326', 2, 2, w - 4, h - 4);
    drawText(g, ['FEED PAPER HERE', 'KEEP HANDS CLEAR'], 4, 4, w - 8, h - 8, { color: '#181818', size: 10, pad: 2, leading: 1.1 });
  }, { clamp: true });
  const plateB = new Batch();
  const px = 7.5 * S[0], py0 = 18.2 * S[1], py1 = 21.5 * S[1], pz = 31.3 * S[2];
  plateB.quad([-px, py0, pz], [px, py0, pz], [px, py1, pz], [-px, py1, pz]);
  const plateMat = kit.surface({ map: plateTex });
  group.add(new THREE.Mesh(kit.geometry(plateB, lights, amb), plateMat));

  const confetti = new THREE.Group();
  confetti.position.set(0, 26 * S[1], 22 * S[2]);
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
    kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.012, 0.28); shadow.renderOrder = 1;
  group.add(shadow);

  return {
    group, confetti,
    animate(dt, time, moving, shredding) {
      const spin = shredding ? 24 : 7;
      rollerA.rotation.x += dt * spin;
      rollerB.rotation.x -= dt * spin;
      clerk.position.y = moving ? Math.abs(Math.sin(time * 6.5)) * 0.018 : 0;
      clerk.rotation.z = moving ? Math.sin(time * 6.5) * 0.028 : Math.sin(time * 1.6) * 0.014;

      const cyc = time % 3.1;
      const torn = shredding ? (Math.floor(time * 14) % 4 === 0) : cyc > 2.98;
      headWhole.visible = !torn;
      headSlipped.visible = torn;
      head.rotation.set(
        0.05 + Math.sin(time * 2.2) * 0.04,
        Math.sin(time * 1.3) * 0.08,
        -0.08 + (torn ? 0.34 : Math.sin(time * 3.1) * 0.04),
      );

      confetti.visible = shredding;
      if (shredding) {
        confetti.rotation.y = time * 5.5;
        confetti.position.y = 26 * S[1] + ((time * 3) % 1) * 0.14;
      }
    },
    light(rgb) {
      mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
      plateMat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
      confMat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
    },
  };
}
