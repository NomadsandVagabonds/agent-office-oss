// Fictional workers for the freight room: the Office's sculpted proportions,
// and faces assembled one voxel out of register. No names, badges or logos.
// The caller owns movement and posing. Everything allocated here belongs to
// the room's kit, including the independently articulated parts.
import * as THREE from 'three';
import { Vox, M, tone } from '../vox/vox.js';
import { Batch, lamp } from './kit.js';
import { buildCharacter, JOINT } from '../avatar/build.js';

const S = 0.025;
const COMPLEXION = {
  jacket: { hex: '#b78054', skin: M('#b78054', 1), shade: M('#95663f', 1), lid: M('#795638', 1) },
  broker: { hex: '#c58f70', skin: M('#c58f70', 1), shade: M('#aa7357', 1), lid: M('#8e604c', 1) },
};
const INK = M('#242329', 0), EYE = M('#d8c6aa', 0), SOLE = M('#24252a', 0);
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
  const { skin: SKIN } = COMPLEXION.jacket;
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
  const { skin: SKIN } = COMPLEXION.broker;
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
  const { skin: SKIN, shade: SHADE } = COMPLEXION[kind];
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
  const { skin: SKIN, shade: SHADE } = COMPLEXION[kind];
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
  const male = kind === 'jacket', { hex, skin, shade, lid } = COMPLEXION[kind];
  const hairHex = male ? '#858b90' : '#39271f', hair = M(hairHex, 2);
  const look = { species: 'human', skin: hex, hair: male ? 'side' : 'long', hairColor: hairHex,
    outfit: male ? 'cardigan' : 'tee', outfitColor: male ? '#242629' : '#97382f', accessory: 'none', facial: 'none' };
  // Reuse the actual Office skull, rounded hair shell and stepped fringe.
  // Only double the sculpting grid, so spectacles can have fine rims while
  // the original broad 18 × 17 × 16 voxel skull remains unmistakable.
  const source = buildCharacter(look, { seed: `freight-${kind}` }).head, v = new Vox();
  source.each((x, y, z, color) => {
    const yy = (y - JOINT.head[1]) * 2;
    v.box(x * 2, yy, z * 2, x * 2 + 2, yy + 2, z * 2 + 2, color);
  });
  const fold = M(male ? '#815638' : '#8e5f4e', 1), hollow = M('#32271f', 1);
  if (male) {
    // Broad cheeks and forehead, a restrained nose and a small quiet mouth.
    v.rbox(-15, 6, 10, 15, 16, 16, 3, skin);
    v.rbox(-12, 1, 5, 13, 7, 14, 3, skin);
    v.rbox(-2, 12, 15, 3, 20, 19, 1, shade);
    v.rbox(-3, 10, 16, 4, 13, 20, 1, skin);
  } else {
    // Softer cheek plane and a tapered chin; the long hair frames the taper.
    v.carve(-18, 0, 8, -12, 7, 18); v.carve(12, 0, 8, 18, 7, 18);
    v.rbox(-12, 5, 10, 12, 15, 16, 3, skin);
    v.rbox(-7, 0, 6, 8, 5, 13, 2, skin);
    v.rbox(-1, 11, 15, 2, 20, 18, 1, shade);
    v.rbox(-2, 10, 16, 3, 12, 19, 1, skin);
  }
  // Fixed tiny pupils, without the Office avatar's friendly eye sparkle.
  // Their unequal sockets are real recesses. The man's left eye projects
  // slightly while its partner has dropped; her larger eye is the sunk one.
  const eyes = male
    ? [{ x: -10, y: 18, w: 8, h: 6, z: 19 }, { x: 9, y: 14, w: 6, h: 5, z: 14 }]
    : [{ x: -10, y: 19, w: 7, h: 6, z: 16 }, { x: 9, y: 16, w: 8, h: 7, z: 13 }];
  for (const e of eyes) {
    const { x, y, w, h, z } = e, x0 = x - Math.floor(w / 2), y0 = y - Math.floor(h / 2);
    v.carve(x0 - 2, y0 - 2, 10, x0 + w + 2, y0 + h + 2, 22);
    v.rbox(x0 - 2, y0 - 2, 10, x0 + w + 2, y0 + h + 2, 14, 2, lid, 'xy');
    v.rbox(x0 - 1, y0 - 1, 12, x0 + w + 1, y0 + h + 1, 15, 1, hollow, 'xy');
    v.rbox(x0, y0, 12, x0 + w, y0 + h, z + 1, 2, EYE);
    v.box(x, y - 1, z, x + 1, y + 1, z + 1, INK);
    // Heavy, unequal lower lids read at room scale through the tape effect.
    v.box(x0 - 1, y0 - 2, 14, x0 + w, y0 - 1, 16, fold);
    v.box(x0 - 1, y0 + h + 2, 14, x0 + w, y0 + h + 3, 16, male ? M('#696057', 1) : M('#5b3b2c', 1));
  }
  if (male) {
    // One cheek has drawn down and dragged a CLOSED mouth with it. The
    // short echo is confined to that corner, never bands across the jaw.
    v.rbox(6, 3, 12, 14, 11, 19, 2, skin);
    v.box(11, 5, 18, 13, 9, 19, shade);
    for (let x = -7; x < 10; x++) {
      const y = 8 - Math.floor((x + 7) / 6);
      v.box(x, y - 1, 15, x + 1, y + 2, 19, shade);
      v.set(x, y, 19, hollow);
      v.set(x, y - 1, 19, skin);
    }
    v.rbox(3, 2, 15, 11, 5, 19, 1, skin);
    v.box(4, 3, 18, 10, 4, 19, fold);
    v.box(-12, 10, 15, -10, 12, 16, shade);
    v.decal('+z', -9, 27, 7, 28, tone(skin, -0.09));
    // A fuller silver side-sweep, built as overlapping rounded voxel masses
    // on the existing hair shell instead of a flat cap.
    v.rbox(-19, 30, -15, 17, 38, 10, 5, hair);
    v.rbox(-16, 35, -11, 10, 41, 8, 4, tone(hair, 0.12));
    v.rbox(-20, 25, -7, -13, 34, 10, 3, tone(hair, -0.1));
    for (let k = 0; k < 5; k++) {
      v.tube(7, 37 - k, 7 - k * 2, -16, 30 - k, 12 - k * 2, 0.65, tone(hair, k % 2 ? 0.18 : -0.1));
    }
    v.tube(7, 30, 13, 8, 37, -6, 0.6, tone(hair, -0.28));
    const frame = M('#282a29', 0);
    for (const [x0, x1, y, z] of [[-15, -4, 14, 20], [3, 14, 10, 17]]) {
      v.box(x0, y, z, x1, y + 1, z + 1, frame); v.box(x0, y + 8, z, x1, y + 9, z + 1, frame);
      v.box(x0, y, z, x0 + 1, y + 9, z + 1, frame); v.box(x1 - 1, y, z, x1, y + 9, z + 1, frame);
    }
    v.tube(-4, 19, 20, 3, 16, 17, 0.45, frame);
    v.box(-19, 20, 0, -18, 21, 20, frame); v.box(18, 16, 0, 19, 17, 17, frame);
    v.box(-19, 20, 19, -15, 21, 21, frame); v.box(14, 16, 16, 19, 17, 18, frame);
  } else {
    const lip = M('#9d6256', 1);
    // A partial second mouth is printed too far right and slightly forward.
    // It interrupts the cheek instead of turning the whole chin into stripes.
    v.rbox(-6, 7, 14, 5, 10, 18, 1, lip);
    v.box(-5, 8, 17, 5, 9, 18, hollow);
    v.rbox(3, 5, 13, 14, 12, 19, 2, skin);
    v.rbox(2, 3, 16, 12, 7, 21, 1, shade);
    v.box(3, 5, 20, 12, 6, 21, hollow);
    v.box(4, 3, 20, 11, 5, 21, lip);
    v.box(12, 7, 18, 14, 11, 19, fold);
    // Long, layered brown hair across one shoulder; broad stepped strands
    // keep the Office's silhouette while the sweep distinguishes this head.
    v.rbox(-22, -19, 5, -15, 22, 15, 3, hair, 'xz');
    v.rbox(-18, -25, 11, -10, 7, 19, 3, tone(hair, 0.08), 'xz');
    v.rbox(-13, -20, 14, -7, -1, 20, 2, hair, 'xz');
    v.rbox(-18, 30, -14, 16, 38, 11, 5, hair);
    v.rbox(-14, 35, -10, 7, 39, 10, 4, tone(hair, 0.09));
    for (let k = 0; k < 5; k++) {
      v.tube(5, 35 - k, 13, -19, 24 - k, 14, 0.6, tone(hair, 0.2));
      v.tube(-19 + k, 12, 15, -17 + k, -20 + k * 2, 17, 0.6, tone(hair, 0.16));
    }
    v.tube(6, 29, 14, 7, 37, -5, 0.6, tone(hair, -0.28));
    const earring = M('#c2a36d', 0);
    v.box(19, 8, 4, 20, 13, 6, earring); v.rbox(18, 5, 4, 21, 9, 7, 1, earring);
  }
  return v;
}

/**
 * An elongated Office figure. Feet are the group origin; forward is +z.
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
    const scale = Array.isArray(voxelSize) ? voxelSize : [voxelSize, voxelSize, voxelSize];
    const modelMatrix = new THREE.Matrix4().makeScale(...scale);
    b.addVox(kit.model(`freight:${kind}:${key}:v5`, make).solid, modelMatrix);
    // Bake the little local rig relative to this joint, so shoes do not
    // receive the head's lighting merely because both models start at zero.
    const jointLights = lights.map((l) => ({ ...l, x: l.x - at[0], y: l.y - at[1], z: l.z - at[2] }));
    group.add(new THREE.Mesh(kit.geometry(b, jointLights, amb), mat));
    group.position.set(...at);
    return group;
  };
  const group = new THREE.Group(); group.name = `freight-${kind}`;
  const hip = 0.78, shoulder = kind === 'jacket' ? 1.24 : 1.225;
  // About four heads tall: the Office's large sculpted head remains intact,
  // while joint spacing and a long neck give its familiar body a wrongness.
  const torso = part('torso', kind === 'jacket' ? jacketTorso : brokerTorso, [0, hip, 0], [S / 2, S * 0.425, S / 2]);
  const head = part('head', () => headVox(kind), [0, 1.35, 0], S / 2);
  const armScale = [S * 0.85, S * 0.82, S * 0.9], legScale = [S * 0.9, S * 0.78, S];
  const leftArm = part('left-arm', () => armVox(kind, -1), [JOINT.shoulderL[0] * S, shoulder, 0], armScale);
  const rightArm = part('right-arm', () => armVox(kind, 1), [JOINT.shoulderR[0] * S, shoulder, 0], armScale);
  const leftLeg = part('left-leg', () => legVox(kind, -1), [JOINT.hipL[0] * S, hip, 0], legScale);
  const rightLeg = part('right-leg', () => legVox(kind, 1), [JOINT.hipR[0] * S, hip, 0], legScale);
  const heldGPU = part('held-gpu', gpuVox, [0, shoulder - 0.25, 0.50]);
  heldGPU.visible = false;
  group.add(torso, head, leftArm, rightArm, leftLeg, rightLeg, heldGPU);
  // A small contact patch follows the feet; it has no collider or behavior.
  const shadow = new THREE.Mesh(kit.own(new THREE.CircleGeometry(0.24, 16)), kit.own(new THREE.MeshBasicMaterial({ color: 0x191713, transparent: true, opacity: 0.18, depthWrite: false })));
  shadow.rotation.x = -Math.PI / 2; shadow.scale.y = 0.72; shadow.position.y = 0.008;
  group.add(shadow);
  const light = (rgb) => mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
  const updateLight = () => light(c.sample(group.position.x, group.position.y + 1.25, group.position.z));
  c.after.push(updateLight);
  return { group, torso, head, leftArm, rightArm, leftLeg, rightLeg, heldGPU, light, updateLight };
}
