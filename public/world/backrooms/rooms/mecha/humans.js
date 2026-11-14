// These are the people from upstairs, still recognisable beneath the apparatus.
// Keep their native rounded skulls, ears, hair, clothes and hands; the lab adds
// exhaustion and small anatomical distortions rather than rebuilding them as boxes.
import { buildCharacter, facePixels, JOINT } from '../../../avatar/build.js';
import { M, mix, tone, toCss, texOf } from '../../../vox/vox.js';

export const HUMAN_VARIANTS = 8;
export { JOINT };

const PEOPLE = [
  { skin: '#d6ae90', hair: 'side', hairColor: '#503c2e', facial: 'none' },
  { skin: '#99674e', hair: 'bun', hairColor: '#2b211e', facial: 'none' },
  { skin: '#bf9777', hair: 'short', hairColor: '#77716a', facial: 'mustache' },
  { skin: '#70503f', hair: 'long', hairColor: '#272321', facial: 'none' },
  { skin: '#e0bfa2', hair: 'short', hairColor: '#8e6951', facial: 'beard' },
  { skin: '#ad8061', hair: 'side', hairColor: '#38302c', facial: 'none' },
  { skin: '#8c624c', hair: 'bald', hairColor: '#77716a', facial: 'mustache' },
  { skin: '#c4a086', hair: 'bun', hairColor: '#a29883', facial: 'none' },
];
const UNIFORMS = {
  lawyer: { outfit: 'suit', outfitColor: '#3c4654' },
  accountant: { outfit: 'vest', outfitColor: '#6b5743' },
  doctor: { outfit: 'cardigan', outfitColor: '#c9c9b5' },
  psychiatrist: { outfit: 'cardigan', outfitColor: '#6b7373' },
};
const STEEL = M('#96998d', 1), STRAP = M('#433d34', 2), INK = M('#211a1a', 0);

function faceZ(v, x, y) {
  for (let z = 11; z >= 2; z--) if (v.has(x, y, z)) return z;
  return null;
}
function faceDot(v, x, y, color, lift = 0) {
  const z = faceZ(v, x, y);
  if (z !== null) v.set(x, y, z + lift, color);
}

function tiredFace(v, look, variant) {
  const sk = M(look.skin, 1), hollow = mix(sk, '#523c43', .27);
  const lip = mix(sk, '#764f47', .33), white = M('#e4ddc7', 0);
  const side = variant % 2 ? -1 : 1;
  // One cheek has swollen under the clamp. The opposite side is drawn inward.
  v.ellipsoid(side * 6, 39.5, 5.5, 3.6, 3.2, 3.1, tone(sk, -.045));
  v.ellipsoid(side * 1.1, 35.5, 3, 4.2, 2.2, 3.5, tone(sk, -.07));
  for (let y = 38; y <= 41; y++) for (let x = 4; x <= 7; x++) {
    if (x + y < 44) continue;
    faceDot(v, -side * x, y, hollow);
  }
  // Use the house expression map, then enlarge just the eyes held open by the rig.
  for (const p of facePixels(look, 'worried')) {
    if (p.y === 40 || p.x === 8) continue; // no cartoon blush or blue sweat icon
    faceDot(v, p.x, p.y, M(p.c, 0));
  }
  for (const [i, cx] of [-6, 5].entries()) {
    const low = 42 - (i === variant % 2 ? 1 : 0), high = 46;
    for (let x = cx - 2; x <= cx + 2; x++) {
      faceDot(v, x, low - 1, hollow);
      for (let y = low; y < high; y++) {
        if (Math.abs(x - cx) === 2 && (y === low || y === high - 1)) continue;
        faceDot(v, x, y, white, x === cx && y === 43 ? 1 : 0);
      }
    }
    const gaze = variant % 3 === 0 ? side : 0;
    faceDot(v, cx + gaze, 43, INK);
    faceDot(v, cx + gaze, 44, INK);
    faceDot(v, cx + gaze - 1, 44, M('#f6f0df', 0));
    // One-voxel hooks on the outer lids, with a slender brace off the cheek.
    // The bridge and nose stay exposed, so this never reads as a robot visor.
    const outer = cx < 0 ? cx - 2 : cx + 2;
    for (const y of [low - 1, high]) {
      const z = faceZ(v, outer, y) ?? 7;
      v.box(outer, y, z + 1, outer + 1, y + 1, z + 3, STEEL);
      v.box(outer + (cx < 0 ? 0 : -1), y, z + 2,
        outer + (cx < 0 ? 2 : 1), y + 1, z + 3, STEEL);
    }
    v.box(cx < 0 ? -10 : 9, low - 1, 6, cx < 0 ? -9 : 10, high + 1, 7, STEEL);
    v.tube(cx < 0 ? -9.5 : 9.5, 44, 6, cx < 0 ? -10.5 : 10.5, 46, 0, .55, STEEL);
  }
  // Slack asymmetrical mouth, with the warm lower lip still visible.
  for (let x = -2; x <= 2; x++) {
    const y = 37 + (x === 2 * side ? 1 : 0);
    faceDot(v, x, y, INK);
    faceDot(v, x, y - 1, lip);
  }
  // Wear and age are broad tonal folds, not per-voxel noise.
  for (const x of [-4, 3]) faceDot(v, x, 38, hollow);
}

function headRestraints(v) {
  // Leather cups sit behind the ears; the upper face and hair remain readable.
  for (const s of [-1, 1]) {
    v.rbox(s < 0 ? -11 : 9, 45, -4, s < 0 ? -9 : 11, 49, 1, 1, STRAP);
    v.box(s < 0 ? -11 : 10, 46, -2, s < 0 ? -10 : 11, 48, 0, STEEL);
  }
  v.rbox(-8, 47, -10, 8, 49, -8, 1, STRAP);
  // A pair of scalp contacts, with short stems to the room's larger hoses.
  v.cyl('y', -3, 0, 51, 54, 1.7, STRAP);
  v.cyl('y', -3, 0, 53, 56, .9, STEEL);
  v.cyl('y', 4, -1, 50, 53, 1.5, STRAP);
  v.cyl('y', 4, -1, 52, 55, .9, STEEL);
  v.rbox(-2, 41, -10, 2, 45, -8, 1, STRAP);
  v.box(-1, 42, -11, 1, 44, -9, STEEL);
}

function dressAndRestrain(parts, role, look) {
  const v = parts.torso, sk = M(look.skin, 1);
  // A broad lap belt and narrow shoulder webbing leave collars, lapels and
  // chest details visible. The clothing still carries the person's profession.
  v.decal('+z', -7, 20, 7, 22, STRAP);
  v.decal('-z', -7, 20, 7, 22, STRAP);
  for (const s of [-1, 1]) {
    v.decal('+z', s < 0 ? -6 : 4, 23, s < 0 ? -4 : 6, 33, STRAP);
    v.decal('-z', s < 0 ? -6 : 4, 22, s < 0 ? -4 : 6, 34, STRAP);
  }
  v.box(-1, 20, 4, 2, 22, 5, STEEL);
  v.rbox(-2, 27, -6, 2, 31, -4, 1, STRAP);
  v.box(-1, 28, -7, 1, 30, -5, STEEL);
  v.rbox(-2, 34, -2, 2, 37, 2, 1, sk);
  v.box(-1, 34, 2, 1, 36, 4, STEEL);
  if (role === 'doctor') {
    const coat = M('#d6d5bf', 2), shirt = M('#6f8883', 2);
    v.decal('+z', -2, 24, 2, 35, shirt);
    v.decal('+z', -7, 24, -4, 29, coat);
    v.decal('+z', 4, 24, 7, 29, coat);
    // A stethoscope falls between the lapels, distinct from the heavy lab hoses.
    v.tube(-2.5, 34, 4.5, -3.5, 30, 4.5, .55, INK);
    v.tube(2.5, 34, 4.5, 3.5, 30, 4.5, .55, INK);
    v.tube(-3.5, 30, 4.5, 0, 28, 4.5, .55, INK);
    v.tube(3.5, 30, 4.5, 0, 28, 4.5, .55, INK);
    v.cyl('z', 0, 27, 4, 6, 1.3, STEEL);
  }
  // An old employee badge, no readable copy or tutorial lettering.
  if (role !== 'lawyer') {
    v.box(2, 29, 4, 4, 32, 5, M('#dcd7c6', 1));
    v.box(2, 31, 5, 4, 32, 6, M('#6a6758', 1));
  }
  for (const side of ['L', 'R']) {
    const a = parts['armLower' + side], x = side === 'L' ? -9 : 9;
    // Rolled-back cuffs expose wrists and the house model's rounded hands.
    a.paint(x - 2, 18, -2, x + 2, 22, 3, sk);
    a.rbox(x - 3, 19, -3, x + 3, 21, 3, 1, STRAP);
    a.box(x - 1, 19, 3, x + 1, 21, 4, STEEL);
    a.decal('+z', x - 1, 15, x, 17, tone(sk, -.12));
  }
}

/** Native avatar parts in figure voxel coordinates, ready for a seated rig. */
export function sculptHuman(role, variant = 0) {
  variant = Math.abs(Math.trunc(variant)) % HUMAN_VARIANTS;
  const person = PEOPLE[variant], uniform = UNIFORMS[role] || UNIFORMS.accountant;
  const look = {
    species: 'human', accessory: 'none', ...person, ...uniform,
    // Keep the original undertone under the clammy pallor.
    skin: toCss(mix(person.skin, '#cec7ad', .14)),
  };
  const parts = buildCharacter(look, { seed: `mecha-human-${role}-${variant}` });
  // Keep the house hair sculpture and material grain. A single worn colour
  // lets its coplanar faces merge across the crowd instead of meshing every
  // random colour streak as a separate strip.
  const hair = M(look.hairColor, 2);
  parts.head.remap((x, y, z, color) => texOf(color) === 2 ? hair : color);
  tiredFace(parts.head, look, variant);
  headRestraints(parts.head);
  dressAndRestrain(parts, role, look);
  return {
    parts, look,
    ports: {
      head: { crown: [-3, 55, 0], crownSide: [4, 54, -1], nape: [0, 43, -10] },
      body: { spine: [0, 29, -6], throat: [0, 35, 3] },
    },
  };
}
