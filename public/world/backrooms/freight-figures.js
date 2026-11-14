// Fictional workers for the freight room: office clothes, adult proportions,
// and faces assembled one voxel out of register. No names, badges or logos.
// The caller owns movement and posing. Everything allocated here belongs to
// the room's kit, including the independently articulated parts.
import * as THREE from 'three';
import { Vox, M, tone } from '../vox/vox.js';
import { Batch, lamp } from './kit.js';

const S = 0.025;
const SKIN = M('#aaa58e', 2), SHADE = M('#81816b', 2), LID = M('#686b59', 2);
const INK = M('#242329', 0), EYE = M('#b8b49a', 0), SOLE = M('#24252a', 0);
const LEATHER = M('#242629', 1), EDGE = M('#373a3b', 1), METAL = M('#757b79', 0);
const RED = M('#97382f', 2), RED_DARK = M('#72282a', 2), GOLD = M('#b69b6e', 2), CREAM = M('#c7b58b', 2);

/** An unbranded, two-fan graphics card. Bottom at 0, front +z, 23 × 4 × 10 voxels including its bracket. */
export function gpuVox() {
  const v = new Vox(), frame = M('#444a4a', 0), dark = M('#22282b', 0), board = M('#475a4d', 1);
  const steel = M('#989d96', 0), gold = M('#bda364', 0), fin = M('#707773', 0);
  v.box(-11, 0, -4, 11, 1, 4, board);
  v.rbox(-11, 1, -4, 11, 3, 4, 1, frame, 'xz');
  // Fin edges are visible along the side, not a printed texture.
  for (let x = -9; x < 10; x += 2) v.box(x, 1, 3, x + 1, 3, 4, fin);
  for (const x of [-5, 5]) {
    v.cyl('y', x, 0, 2, 3, 3.4, dark);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      v.tube(x + Math.cos(a), 3, Math.sin(a), x + Math.cos(a + 0.5) * 2.4, 3, Math.sin(a + 0.5) * 2.4, 0.45, fin);
    }
    v.cyl('y', x, 0, 3, 4, 1.1, frame);
  }
  v.box(-11, 0, -4, -10, 4, 5, steel);             // the mounting bracket
  v.box(-12, 3, -4, -10, 4, -2, steel);
  v.box(-11, 1, -2, -10, 2, 0, dark); v.box(-11, 1, 1, -10, 2, 3, dark);
  for (let x = -6; x < 7; x += 2) v.box(x, 0, -5, x + 1, 1, -4, gold);
  v.box(7, 1, -4, 10, 3, -3, dark);               // power socket
  return v;
}

/** Batch a card onto a shelf/table. y is its underside; no extra solid is added. */
export function addGPU(c, x, y, z, { rot = 0, scale = 1 } = {}) {
  return c.model('freight:gpu:v1', gpuVox, x, z, { y, rot, scale, solid: false, shadow: false });
}

// Faces and clothes are sculpted at half the furniture voxel size: enough
// resolution for a one-voxel spectacle rim and a woven floral motif, still
// visibly assembled from blocks. Limbs retain the coarser, slightly stiff cut.
function jacketTorso() {
  const v = new Vox(), tee = M('#17191b', 3), stitch = M('#454847', 1);
  v.rbox(-16, 0, -8, 16, 44, 8, 2, LEATHER, 'xz');
  v.box(-14, 0, -8, 14, 4, 8, M('#202224', 2));
  v.box(-9, 4, 7, 9, 43, 9, tee);
  v.box(-5, 41, 7, 5, 45, 9, tee);                         // black crew-neck tee
  // Open leather jacket, with broad folded lapels and restrained zip teeth.
  // The central dark opening stays continuous; there is no bright button row.
  for (let y = 5; y < 45; y++) {
    const open = y < 17 ? 5 : Math.min(11, 5 + Math.floor((y - 17) / 4));
    const lapel = y > 21 ? 4 : 2;
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -open - lapel : open;
      v.box(x0, y, 8, x0 + lapel, y + 1, 10, EDGE);
      if (y < 30) v.set(side < 0 ? -open - 1 : open, y, 10, y % 3 ? EDGE : METAL);
      // Pebbled leather, a tiny uneven grid of seams across the lapel.
      if (y > 25 && y % 4 === 0) v.box(x0, y, 10, x0 + lapel, y + 1, 11, stitch);
    }
  }
  v.box(5, 12, 10, 6, 15, 11, METAL);                      // small zip slider
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) v.set(side * (7 + i), 9 + Math.floor(i / 3), 8, INK);
    v.box(side < 0 ? -16 : 13, 40, -6, side < 0 ? -13 : 16, 43, 6, EDGE);
  }
  for (const x of [-13, 12]) v.box(x, 6, -9, x + 1, 39, -8, EDGE);
  v.box(-13, 38, -9, 13, 39, -8, stitch);
  // Shallow, broken cross-grain in the broad leather panels, not a logo.
  for (let y = 7; y < 38; y += 5) for (const side of [-1, 1]) {
    const x = side < 0 ? -15 : 11;
    v.box(x, y, 8, x + 4, y + 1, 9, y % 2 ? EDGE : LEATHER);
  }
  v.box(-4, 43, -3, 4, 53, 3, SKIN);                      // a neck just a little too long
  v.box(-8, 43, -6, -4, 47, 5, EDGE); v.box(4, 43, -6, 8, 47, 5, EDGE);
  return v;
}

/** Red cloth with winding gold stems, pale flowers and wine-colored leaves. */
function floral(x, y, z = 8) {
  const u = Math.abs(z) >= 5 ? x : z * 2 + (x < 0 ? -11 : 11);
  for (const [cx, cy] of [[-7, -22], [7, -5], [-5, 14], [7, 32], [-7, 46]]) {
    const dx = u - cx, dy = y - cy, rr = dx * dx + dy * dy;
    if (rr < 2) return RED_DARK;
    if (rr < 6) return CREAM;
    // Six uneven petals read as an embroidered flower at a distance.
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3 + cy * 0.06;
      const px = dx - Math.cos(a) * 3.6, py = dy - Math.sin(a) * 3.6;
      if (px * px + py * py < 3.5) return k % 2 ? GOLD : CREAM;
    }
  }
  for (const side of [-1, 1]) {
    const stem = side * 7 + Math.sin(y * 0.17 + side) * 4;
    const d = u - stem;
    if (Math.abs(d) < 0.7) return GOLD;
    const leaf = ((y + 70) % 12) - 6, dir = Math.floor((y + 70) / 12) % 2 ? -1 : 1;
    if (Math.abs(d - dir * 2.3) + Math.abs(leaf) * 0.7 < 2.4) return RED_DARK;
    if (Math.abs(d - dir * 2) < 0.7 && Math.abs(leaf) < 3) return GOLD;
  }
  return (Math.floor(u / 4) + Math.floor(y / 5)) % 5 === 0 ? M('#a23e32', 2) : RED;
}

function brokerTorso() {
  const v = new Vox();
  // The dress is one garment: fitted waist, gentle skirt flare, knee-length
  // hem. It belongs to the torso rather than swinging independently as pants.
  for (let y = -30; y < 44; y++) {
    const w = y < 0 ? 13 + Math.floor(-y / 10) : y < 17 ? 12 : Math.min(16, 12 + Math.floor((y - 17) / 6));
    const d = y < 0 ? 9 : 8;
    v.rbox(-w, y, -d, w, y + 1, d, 1, (x, yy, z) => floral(x, yy, z), 'xz');
  }
  v.box(-16, -30, -9, 16, -29, 9, RED_DARK);                // stitched hem, no trouser split
  v.box(-4, 43, -3, 4, 53, 3, SKIN);
  v.rbox(-6, 42, -5, 6, 48, 5, 1, floral, 'xz');            // high red neckline
  return v;
}

/** One hanging arm, relative to its shoulder; short sleeves on the dress. */
function armVox(kind, side) {
  const v = new Vox();
  if (kind === 'jacket') {
    v.rbox(-3, -19, -3, 3, 1, 3, 1, LEATHER, 'xz');
    v.rbox(-2, -23, -2, 2, -18, 2, 1, EDGE);
    v.box(side < 0 ? -3 : 2, -18, -2, side < 0 ? -2 : 3, -2, -1, EDGE);
    for (const y of [-7, -13, -18]) v.box(-2, y, 3, 2, y + 1, 4, EDGE);
    v.box(-2, -12, -3, 2, -11, -2, INK);
    v.box(-2, -23, -2, 2, -22, 2, INK);
    v.set(0, -21, 3, METAL);
  } else {
    v.rbox(-2, -23, -2, 2, -6, 2, 1, SKIN, 'xz');
    v.rbox(-3, -8, -3, 3, 1, 3, 1, (x, y, z) => floral(x * 2 + side * 16, y * 2 + 43, z * 2), 'xz');
    v.box(-3, -8, -3, 3, -7, 3, RED_DARK);
    v.box(-2, -15, -2, 2, -14, -1, SHADE);                  // slight elbow crease
  }
  v.rbox(-2, -27, -2, 2, -23, 2, 1, SKIN);
  v.box(side < 0 ? 1 : -3, -25, 0, side < 0 ? 3 : -1, -23, 2, SHADE);
  for (const x of [-1, 1]) v.box(x, -27, 1, x + 1, -25, 2, SHADE);
  return v;
}

/** Hip at zero, sole at -40: long legs, with bare calves below the dress. */
function legVox(kind, side) {
  const v = new Vox();
  if (kind === 'jacket') {
    const cloth = M('#36393b', 3);
    v.rbox(-3, -35, -3, 3, 2, 3, 1, cloth, 'xz');
    v.box(-3, -36, -3, 3, -34, 3, tone(cloth, -0.16));
    v.box(side < 0 ? -3 : 2, -33, -2, side < 0 ? -2 : 3, -1, -1, tone(cloth, 0.12));
    v.box(-1, -33, 3, 0, -5, 4, tone(cloth, -0.12));
  } else {
    v.rbox(-2, -37, -2, 2, 1, 2, 1, SKIN, 'xz');
    v.rbox(-3, -27, -2, 3, -20, 2, 1, SKIN, 'xz');          // calves, narrower ankles
    v.box(-2, -19, 1, 2, -18, 2, SHADE);
  }
  const shoe = M('#29292b', 1);
  v.rbox(-3, -40, -3, 3, kind === 'jacket' ? -35 : -37, 5, 1, shoe, 'xz');
  v.box(-3, -40, -3, 3, -39, 5, SOLE);
  v.box(-2, kind === 'jacket' ? -36 : -38, 1, 2, kind === 'jacket' ? -35 : -37, 3, M('#464645', 0));
  return v;
}

function headVox(kind) {
  const v = new Vox(), male = kind === 'jacket';
  const hair = M(male ? '#adb1b0' : '#3c302a', 2);
  const fold = M('#53574a', 2), hollow = M('#292e27', 1), lip = M('#888775', 2);
  // A human head with several parts of its face copied in the wrong place.
  // The distortion is in the volume: displaced cheek, sunken sockets and
  // stacked, closed mouth/jaw ridges. No grin, teeth, wounds or cartoon eyes.
  v.ellipsoid(0, 12, 0, male ? 10 : 9, 12, 8, SKIN);
  v.rbox(-7, 3, 3, 7, 20, 8, 2, SKIN);
  v.rbox(-7, 1, 1, 10, 7, 8, 2, SHADE);
  v.rbox(-5, -2, 2, 11, 3, 9, 1, SKIN);                  // lower jaw slipped right and down
  v.box(-11, 8, -1, -9, 14, 3, SKIN); v.box(9, 8, -1, 11, 14, 3, SKIN);
  v.rbox(4, 5, 5, 11, 12, 10, 2, SKIN);                // one stretched, heavy cheek
  v.rbox(-10, 7, 4, -6, 13, 8, 1, SHADE);
  // Two recessed eye sockets. The second one sits conspicuously too low;
  // each pupil remains a small dark mark inside a narrow, dull eye slit.
  for (const [x, y, drop] of [[-5, 15, 0], [5, 12, 1]]) {
    v.carve(x - 4, y - 3, 6, x + 4, y + 3, 11);
    v.rbox(x - 4, y - 3, 6, x + 4, y + 3, 8, 1, LID, 'xy');
    v.rbox(x - 3, y - 2, 7, x + 3, y + 2, 8, 1, hollow, 'xy');
    v.box(x - 2, y - drop, 7, x + 2, y + 1 - drop, 8, EYE);
    v.box(x - 1, y - drop, 7, x, y + 1 - drop, 8, INK);
    v.box(x - 4, y + 3, 7, x + 3, y + 4, 9, SHADE);
    v.box(x - 3, y - 4, 7, x + 3, y - 3, 9, fold);
  }
  // The bridge begins between the eyes but its tip arrives off-center.
  v.rbox(-1, 9, 7, 2, 18, 10, 1, SHADE);
  v.rbox(0, 8, 8, 6, 12, 12, 1, SKIN);
  v.box(2, 8, 11, 5, 9, 12, fold);
  // Broad closed lip ridges, duplicated a little lower and farther right.
  // The dark seams stay nearly straight, so this reads as collapsed anatomy
  // rather than an enormous smile even at camcorder resolution.
  v.rbox(-8, 5, 7, 9, 8, 11, 1, lip);
  v.box(-7, 5, 10, 8, 6, 11, hollow);
  v.rbox(-7, 2, 7, 11, 5, 12, 1, SKIN);
  v.box(-5, 2, 11, 10, 3, 12, fold);
  v.rbox(-4, -1, 5, 11, 2, 10, 1, lip);
  v.box(-2, -1, 9, 9, 0, 10, SHADE);
  v.box(8, 4, 9, 11, 6, 11, SHADE);                     // the dragged mouth corner
  // Weathered creases and scattered dull patches, laid into the skin rather
  // than a clean full-face decal. Keep the marks broader than a single pixel.
  v.box(-6, 20, 7, 3, 21, 8, SHADE);
  v.box(-4, 22, 6, 6, 23, 7, SHADE);
  v.box(-9, 7, 7, -7, 10, 9, fold);
  v.box(8, 6, 9, 10, 8, 10, LID);
  v.box(-6, 8, 8, -4, 10, 9, SHADE);
  v.box(6, 18, 6, 8, 20, 7, SHADE);
  if (male) {
    // Uneven swept crown with a side part. No horizontal slab or flat top.
    v.ellipsoid(-1, 22, -1, 10, 5, 8, hair);
    v.ellipsoid(-4, 24, 0, 7, 4, 7, tone(hair, 0.08));
    v.box(-10, 10, -5, -8, 23, 3, hair); v.box(8, 10, -5, 10, 22, 2, tone(hair, -0.15));
    v.rbox(-8, 11, -9, 8, 23, -6, 2, tone(hair, -0.18));
    for (let x = -9; x < 9; x++) {
      const y = x < 3 ? 21 + Math.floor((x + 9) / 5) : 23 - Math.floor((x - 3) / 2);
      v.box(x, y, 5, x + 1, y + 3, 8, x % 3 === 0 ? tone(hair, 0.2) : hair);
    }
    for (let k = 0; k < 5; k++) v.tube(3, 26 - k * 0.5, 3 - k, -8, 22 - k * 0.5, 5 - k, 0.45, tone(hair, 0.2));
    v.tube(3, 22, 6, 5, 25, -2, 0.5, tone(hair, -0.32));   // the dark side-part seam
    const frame = M('#303434', 0);
    for (const [x0, x1, y] of [[-10, -1, 12], [1, 10, 9]]) {
      v.box(x0, y, 9, x1, y + 1, 10, frame); v.box(x0, y + 6, 9, x1, y + 7, 10, frame);
      v.box(x0, y, 9, x0 + 1, y + 7, 10, frame); v.box(x1 - 1, y, 9, x1, y + 7, 10, frame);
    }
    v.box(-1, 16, 9, 0, 17, 10, frame); v.box(0, 15, 9, 2, 16, 10, frame);
    v.box(-11, 17, -1, -10, 18, 10, frame); v.box(10, 14, -1, 11, 15, 10, frame);
  } else {
    // Long dark-brown hair, side parted and swept over one shoulder.
    v.ellipsoid(0, 22, -1, 11, 6, 9, hair);
    v.rbox(-10, -21, -9, 10, 22, -5, 2, hair, 'xz');
    v.rbox(-12, -24, -6, -8, 22, 6, 2, hair, 'xz');
    v.rbox(8, -15, -6, 11, 21, 4, 1, hair, 'xz');
    v.rbox(-11, -34, 6, -5, 5, 11, 2, hair, 'xz');
    v.rbox(-7, -27, 9, -3, -6, 13, 1, tone(hair, 0.08), 'xz');
    for (let x = -10; x < 9; x++) {
      const low = x < 3 ? 16 + Math.floor((x + 10) * 0.5) : 22 - Math.floor((x - 3) * 0.7);
      v.box(x, low, 5, x + 1, 25, 8, hair);
    }
    for (let k = 0; k < 4; k++) {
      v.tube(2, 25 - k, 7, -10, 18 - k * 2, 7, 0.45, tone(hair, 0.2));
      v.tube(-10 + k, 7, 10, -9 + k, -31 + k * 2, 11, 0.45, tone(hair, 0.18));
    }
    v.tube(3, 23, 6, 3, 27, -2, 0.5, tone(hair, -0.3));
    const earring = M('#b8a78b', 0);
    v.box(10, 7, 2, 11, 11, 3, earring); v.box(10, 5, 2, 12, 7, 4, earring);
    v.box(-11, 7, 3, -10, 10, 4, earring);
  }
  return v;
}

/**
 * Adult-sized articulated figure. Feet are the group origin; forward is +z.
 * Arms hang from their shoulders, so negative rotation.x lifts them forward.
 * Suggested carrying pose: both arms x=-1.16, heldGPU.visible=true.
 * Returns unattached Groups; the caller adds group to c and owns all behavior.
 */
export function makeFreightFigure(c, kind = 'jacket') {
  if (kind !== 'jacket' && kind !== 'broker') throw new Error(`Unknown freight figure: ${kind}`);
  const { kit } = c, mat = kit.surface({ vox: true, room: c.rt.u });
  const lights = [lamp(0.2, 2.5, 1.2, [1, 1, 1], { k: 7, wrap: 0.5, far: 12 })], amb = [0.42, 0.42, 0.42];
  const part = (key, make, at, voxelSize = S) => {
    const group = new THREE.Group(), b = new Batch(true);
    group.name = `freight-${kind}-${key}`;
    const modelMatrix = new THREE.Matrix4().makeScale(voxelSize, voxelSize, voxelSize);
    b.addVox(kit.model(`freight:${kind}:${key}:v3`, make).solid, modelMatrix);
    // Bake the little local rig relative to this joint, so shoes do not
    // receive the head's lighting merely because both models start at zero.
    const jointLights = lights.map((l) => ({ ...l, x: l.x - at[0], y: l.y - at[1], z: l.z - at[2] }));
    group.add(new THREE.Mesh(kit.geometry(b, jointLights, amb), mat));
    group.position.set(...at);
    return group;
  };
  const group = new THREE.Group(); group.name = `freight-${kind}`;
  const hip = 40 * S, shoulder = (kind === 'jacket' ? 62 : 61) * S;
  const torso = part('torso', kind === 'jacket' ? jacketTorso : brokerTorso, [0, hip, 0], S / 2);
  const head = part('head', () => headVox(kind), [0, 66 * S, 0], S / 2);
  head.scale.set(1.16, 1.12, 1.13);                       // faces must survive the distant VHS view
  const leftArm = part('left-arm', () => armVox(kind, -1), [-10 * S, shoulder, 0]);
  const rightArm = part('right-arm', () => armVox(kind, 1), [10 * S, shoulder, 0]);
  const leftLeg = part('left-leg', () => legVox(kind, -1), [-4 * S, hip, 0]);
  const rightLeg = part('right-leg', () => legVox(kind, 1), [4 * S, hip, 0]);
  const heldGPU = part('held-gpu', gpuVox, [0, shoulder - 0.35, 0.56]);
  heldGPU.visible = false;
  group.add(torso, head, leftArm, rightArm, leftLeg, rightLeg, heldGPU);
  // A small contact patch follows the feet; it has no collider or behavior.
  const shadow = new THREE.Mesh(kit.own(new THREE.CircleGeometry(0.24, 16)), kit.own(new THREE.MeshBasicMaterial({ color: 0x191713, transparent: true, opacity: 0.18, depthWrite: false })));
  shadow.rotation.x = -Math.PI / 2; shadow.scale.y = 0.72; shadow.position.y = 0.008;
  group.add(shadow);
  const light = (rgb) => mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
  const updateLight = () => light(c.sample(group.position.x, group.position.y + 1.2, group.position.z));
  c.after.push(updateLight);
  return { group, torso, head, leftArm, rightArm, leftLeg, rightLeg, heldGPU, light, updateLight };
}
