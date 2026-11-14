// Voxel models for The Fun Committee: stiff office Culture Crew staff in
// pastel polos, lanyards, crooked striped birthday cones, and stretched HR
// grins, holding glossy red latex balloons.
// Two silhouettes:
//   - 'greeter': balanced on one leg with arms flung wide and a red balloon
//   - 'circle':  arms linked sideways for the 5-person breakroom ring
import * as THREE from 'three';
import { Vox, M } from '../../../vox/vox.js';
import { Batch, lamp } from '../../kit.js';

const S = 0.026;
const POLOS = ['#74c7b0', '#e58878', '#78b0dc', '#e6cc64', '#b498de', '#df94b8'];
const SLACKS = ['#2e3442', '#4a4339', '#38424d', '#3e3947'];

function addPartyHead(v, skin, polo, idx, headShiftX = 0) {
  const dark = M('#151318', 0), teeth = M('#f6f2e6', 0), gum = M('#9c3b42', 1);
  const hx = headShiftX;
  // Slightly elongated uncanny office head
  v.rbox(-7 + hx, 34, -5, 7 + hx, 50, 7, 4, skin);
  // Deep-set staring eyes with tiny pale pinpricks
  for (const sx of [-4, 3]) {
    v.box(sx + hx, 42, 6, sx + 2 + hx, 46, 8, dark);
    v.set(sx + hx, 44, 7, M('#f0ece0', 0));
  }
  // Stretched, frozen HR smile from ear to ear
  v.box(-5 + hx, 36, 6, 5 + hx, 40, 8, gum);
  for (let x = -4; x <= 4; x++) {
    const lift = Math.abs(x) >= 3 ? 1 : 0;
    v.set(x + hx, 38 + lift, 7, teeth);
    v.set(x + hx, 37 + lift, 7, x % 2 === 0 ? teeth : dark);
  }
  // Crooked striped paper party cone tilted on the crown
  const tilt = idx % 2 === 0 ? 1 : -1;
  for (let y = 0; y < 13; y++) {
    const r = Math.max(0.9, 5.2 * (1 - y / 13.2));
    const cx = hx + tilt * (1.2 + y * 0.22);
    const band = Math.floor(y / 3) % 2 === 0 ? M('#e85d56', 1) : M('#f2d04e', 1);
    v.cyl('y', cx, -0.5, 49 + y, 50 + y, r, band);
  }
  v.sphere(hx + tilt * 4.1, 62, -0.5, 1.6, M('#f7f4ec', 2));
}

function addBalloonAt(v, bx, by, bz, handY) {
  const red = M('#cf1d1d', 1), hi = M('#f46e6e', 0), knot = M('#8a1010', 1), str = M('#d8d2c5', 1);
  v.tube(bx, handY, bz, bx, by - 7, bz, 0.55, str);
  v.box(bx - 1, by - 8, bz - 1, bx + 1, by - 6, bz + 1, knot);
  v.ellipsoid(bx, by, bz, 5.5, 6.8, 5.5, red);
  v.box(bx - 3, by + 2, bz + 3, bx - 1, by + 5, bz + 5, hi);
}

function greeterVox() {
  const v = new Vox();
  const skin = M('#dfcab0', 1), polo = M(POLOS[0], 2), collar = M('#f2ede0', 1);
  const pants = M(SLACKS[0], 2), shoe = M('#222026', 1), badge = M('#d94b43', 0);

  // Standing leg (right) planted squarely
  v.rbox(1, 0, -3, 6, 3, 6, 1, shoe, 'xz');
  v.rbox(1, 3, -2, 6, 19, 3, 1, pants, 'xz');
  // Raised bent leg (left): knee lifted, shin tucked back in frozen stork balance
  v.rbox(-6, 11, -1, -1, 19, 4, 1, pants, 'xz');
  v.tube(-3.5, 12, 2, -3.5, 10, -7, 2.2, pants);
  v.rbox(-6, 7, -10, -1, 12, -6, 1, shoe);

  // Pastel Culture Crew polo + collar + HR lanyard
  v.rbox(-7, 18, -4, 7, 35, 4, 2, polo);
  v.box(-3, 32, 3, 3, 35, 5, collar);
  v.tube(-3, 34, 4, -1, 26, 5, 0.6, badge);
  v.box(-3, 22, 4, 1, 27, 5, M('#f4f0e4', 0));

  // Wide outstretched welcoming arms; right hand holds the red balloon string
  v.tube(7, 32, 0, 14, 34, 2, 2.1, polo);
  v.tube(14, 34, 2, 20, 39, 3, 1.8, skin);
  v.sphere(20, 39, 3, 2.0, skin);
  for (const dy of [-1, 1, 2]) v.tube(20, 39, 3, 22, 40 + dy, 4, 0.6, skin);

  v.tube(-7, 32, 0, -14, 33, 2, 2.1, polo);
  v.tube(-14, 33, 2, -20, 38, 3, 1.8, skin);
  v.sphere(-20, 38, 3, 2.0, skin);
  for (const dy of [-1, 1, 2]) v.tube(-20, 38, 3, -22, 39 + dy, 4, 0.6, skin);

  addPartyHead(v, skin, polo, 0, 0);
  addBalloonAt(v, 20, 58, 3, 39);
  return v;
}

function circleMemberVox(idx) {
  const v = new Vox();
  const skins = ['#e2cbb2', '#cfa98a', '#dec2a8', '#b88f70', '#e6d2bc'];
  const skin = M(skins[idx % skins.length], 1);
  const polo = M(POLOS[(idx + 1) % POLOS.length], 2), collar = M('#f2ede0', 1);
  const pants = M(SLACKS[idx % SLACKS.length], 2), shoe = M('#252329', 1);

  for (const x0 of [-6, 1]) {
    v.rbox(x0, 0, -3, x0 + 5, 3, 6, 1, shoe, 'xz');
    v.rbox(x0, 3, -2, x0 + 5, 19, 3, 1, pants, 'xz');
  }
  v.rbox(-7, 18, -4, 7, 35, 4, 2, polo);
  v.box(-3, 32, 3, 3, 35, 5, collar);
  v.box(2, 28, 4, 6, 31, 5, M('#f4f0e4', 0));            // 'HELLO MY NAME IS' sticker

  // Arms curved wide to link hands with neighbours on both sides
  for (const sx of [-1, 1]) {
    v.tube(sx * 7, 32, 0, sx * 12, 26, 3, 2.1, polo);
    v.tube(sx * 12, 26, 3, sx * 16, 22, 6, 1.8, skin);
    v.sphere(sx * 16, 22, 6, 1.9, skin);
  }

  addPartyHead(v, skin, polo, idx + 1, idx % 2 === 0 ? 1 : -1);
  if (idx % 2 === 0) addBalloonAt(v, 16, 54, 6, 22);
  return v;
}

export function buildCommitteeMember(kit, variant = 'greeter', idx = 0) {
  const lights = [lamp(0.2, 2.4, 0.8, [1.28, 1.28, 1.28], { k: 8, wrap: 0.48, far: 26 })], amb = [0.64, 0.64, 0.64];
  const m4 = new THREE.Matrix4().makeScale(S, S, S);
  const key = variant === 'greeter' ? 'fun:greeter' : `fun:circle:${idx}`;
  const model = kit.model(key, () => (variant === 'greeter' ? greeterVox() : circleMemberVox(idx)));
  const b = new Batch(true);
  b.addVox(model.solid, m4);
  const mat = kit.surface({ vox: true });
  const mesh = new THREE.Mesh(kit.geometry(b, lights, amb), mat);
  const group = new THREE.Group();
  group.add(mesh);
  return {
    group,
    mesh,
    light(rgb) { mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); },
  };
}
