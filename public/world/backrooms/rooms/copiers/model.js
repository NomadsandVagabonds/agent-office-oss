// The Copy Room's machine, sculpted. Pure: voxels in, voxels out.
// A floor-standing office copier of the kind that is never quite working: three paper drawers with their little
// level windows, a catch tray under the exit slot, a control panel with a screen and a keypad and one green button
// worn pale, the platen under glass with its rulers, vents down one side and the bypass tray folded up on the other,
// castors, a mains lead. Half-size voxels (1.25 cm): place it with `scale: COPIER.scale`.
// x is toward the aisle (the front), y up, z along the wall. The glass is 0.875 m up; the tray's top 0.65 m.
import { Vox, M, glow, tone, noise3 } from '../../../vox/vox.js';

export const COPIER = Object.freeze({ scale: 0.5, variants: 3, lid: Object.freeze({ w: 0.52, d: 0.72 }) });

const BODY = '#d8d1be', SHADE = '#bdb5a1', SEAM = '#9c9483', DARK = '#26292e', TRAY = '#8f8979', GLASS = '#14362a', WHITE = '#efeee8';

/** @param {number} variant 0 as it left the factory · 1 the side door hanging open on a jam · 2 a note taped to it, and toner where hands have been */
export function copierVox(variant = 0) {
  const v = new Vox();
  const B = (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c), K = (x0, y0, z0, x1, y1, z1) => v.carve(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1);
  const body = M(BODY, 1), shade = M(SHADE, 1), seam = M(SEAM, 0), dark = M(DARK, 0), tray = M(TRAY, 1), white = M(WHITE, 0), grey = M('#6f7376', 0), steel = M('#8c8f8d', 0);
  const X0 = -28, X1 = 27, Z0 = -36, Z1 = 35;

  // the plinth, set back, on four castors with a levelling foot beside each
  B(X0 + 2, 3, Z0 + 2, X1 - 2, 6, Z1 - 2, dark);
  for (const cx of [X0 + 5, X1 - 6]) for (const cz of [Z0 + 5, Z1 - 6]) { B(cx, 0, cz, cx + 1, 2, cz + 2, M('#111214', 0)); B(cx - 3, 0, cz, cx - 2, 3, cz + 1, steel); }
  // the cabinet, and above a seam the scanner, a finger's width proud all round
  B(X0, 7, Z0, X1, 55, Z1, body);
  B(X0, 56, Z0, X1, 56, Z1, seam);
  B(X0 - 1, 57, Z0 - 1, X1 + 1, 69, Z1 + 1, body);
  B(X0 - 1, 60, Z0 - 1, X1 + 1, 61, Z1 + 1, M('#3d7f86', 0));                                  // the maker's stripe, right round

  // three paper drawers on the front: a face, a grip let into it, a label for the size, a window that says how much is left
  [[9, 21, 0.7], [23, 35, 0.3], [37, 47, 0.05]].forEach(([y0, y1, full], i) => {
    B(X1 + 1, y0, Z0 + 3, X1 + 2, y1, Z1 - 3, shade);
    B(X1 + 2, y0, Z0 + 3, X1 + 2, y0, Z1 - 3, seam); B(X1 + 2, y1, Z0 + 3, X1 + 2, y1, Z1 - 3, tone(SHADE, 0.12));
    K(X1 + 2, y0 + 4, -9, X1 + 2, y0 + 7, 9); B(X1 + 1, y0 + 4, -9, X1 + 1, y0 + 7, 9, dark);
    B(X1 + 2, y1 - 4, Z0 + 6, X1 + 2, y1 - 2, Z0 + 13, white); v.set(X1 + 2, y1 - 3, Z0 + 8, dark); v.set(X1 + 2, y1 - 3, Z0 + 10, dark); v.set(X1 + 2, y1 - 3, Z0 + 11, dark);
    const h = y1 - y0 - 4, lvl = Math.round(h * full);
    B(X1 + 2, y0 + 2, Z1 - 8, X1 + 2, y0 + 2 + h, Z1 - 7, dark); if (lvl > 0) B(X1 + 2, y0 + 2, Z1 - 8, X1 + 2, y0 + 1 + lvl, Z1 - 7, white);
    if (i === 2) v.set(X1 + 2, y0 + 3 + h, Z1 - 10, glow('#ffb238'));                              // the bottom one is all but out: its lamp is on
  });
  // the exit slot, and the tray under it: a floor, two cheeks, a lip, a finger notch
  B(X1, 53, -24, X1 + 1, 55, 24, dark);
  B(X1 + 1, 50, -25, 49, 51, 25, tray);
  B(X1 + 1, 52, -25, 49, 53, -25, tray); B(X1 + 1, 52, 25, 49, 53, 25, tray); B(48, 52, -25, 49, 54, 25, tray);
  K(44, 50, -5, 49, 54, 5);
  for (let x = X1 + 3; x < 47; x += 6) B(x, 52, -23, x, 52, 23, tone(TRAY, -0.12));                // ribs, so that a sheet does not stick

  // the top: a frame, the glass let into it, a ruler down two sides and the corner the page goes to
  B(X0 + 2, 70, Z0 + 3, 20, 70, Z1 - 3, shade);
  K(X0 + 5, 70, Z0 + 6, 16, 70, Z1 - 6); B(X0 + 5, 69, Z0 + 6, 16, 69, Z1 - 6, M(GLASS, 0));
  for (let z = Z0 + 6; z <= Z1 - 6; z++) v.set(X0 + 4, 70, z, z % 4 === 0 ? dark : white);
  for (let x = X0 + 5; x <= 16; x++) v.set(x, 70, Z0 + 5, x % 4 === 0 ? dark : white);
  B(X0 + 4, 70, Z0 + 5, X0 + 5, 70, Z0 + 6, M('#e2b93a', 0));
  for (const z of [Z0 + 8, Z1 - 12]) B(X0 - 1, 70, z, X0 + 2, 72, z + 3, grey);                    // the lid's two hinges

  // the panel: a wedge along the front of the top; a screen with something on it, a keypad, start, stop, three lamps
  for (let k = 0; k < 4; k++) B(21 + k * 2, 70, Z0 + 2, X1 + 1, 70 + (3 - k), Z1 - 2, shade);
  const py = (x) => 71 + Math.max(0, 3 - Math.floor((x - 21) / 2));
  for (let x = 21; x <= X1; x++) for (let z = Z0 + 2; z <= Z1 - 2; z++) {
    const y = py(x) - 1, pz = z - Z0;
    if (pz >= 6 && pz <= 30 && x >= 22 && x <= 26) v.set(x, y, z, (x === 24 && pz % 3 !== 0 && pz > 8 && pz < 26) || (x === 23 && pz > 8 && pz < 18) ? glow('#7fe6a4') : M('#0d1a14', 0));
    else if (pz >= 36 && pz <= 46 && x >= 22 && x <= 27 && (pz % 3 !== 2) && (x % 2 === 0)) v.set(x, y, z, grey);
    else if (pz >= 52 && pz <= 57 && x >= 23 && x <= 26) v.set(x, y, z, variant === 2 ? M('#9fd9b4', 0) : glow('#49e882'));
    else if (pz >= 61 && pz <= 63 && x >= 24 && x <= 26) v.set(x, y, z, M('#c9483c', 0));
    else if (x === 22 && (pz === 52 || pz === 55 || pz === 58)) v.set(x, y, z, pz === 55 ? glow('#ffb238') : M('#3b4a3f', 0));
  }

  // one side: louvres over the fan, and the mains lead out of the back corner and away across the carpet
  for (let y = 12; y <= 40; y += 3) B(X0 + 6, y, Z0 - 1, X0 + 26, y, Z0 - 1, y % 6 === 0 ? shade : body), B(X0 + 6, y + 1, Z0, X0 + 26, y + 1, Z0, dark);
  B(X0 + 3, 9, Z0 - 1, X0 + 5, 11, Z0 - 1, dark); for (let y = 0; y <= 9; y++) v.set(X0 + 4, y, Z0 - 2, dark); for (let z = Z0 - 8; z <= Z0 - 2; z++) v.set(X0 + 4, 0, z, dark);
  // the other: the bypass tray folded up flat, its catch, and the door the jams are cleared through
  B(X0 + 8, 30, Z1 + 1, X1 - 6, 52, Z1 + 1, shade); B(X0 + 8, 52, Z1 + 1, X1 - 6, 52, Z1 + 2, seam); B(-3, 49, Z1 + 2, 3, 50, Z1 + 2, dark);
  if (variant === 1) {
    // …which somebody has left hanging: the works, two rollers, a green lever, and a sheet folded up in them like a fan
    K(X0 + 8, 10, Z1 - 5, X1 - 6, 27, Z1); B(X0 + 8, 10, Z1 - 6, X1 - 6, 27, Z1 - 6, dark);
    for (const y of [14, 22]) B(X0 + 10, y, Z1 - 4, X1 - 8, y + 2, Z1 - 3, grey);
    B(X1 - 12, 17, Z1 - 3, X1 - 9, 19, Z1 - 1, M('#3fae5c', 0));
    for (let x = X0 + 14; x <= X0 + 30; x++) v.set(x, 18 + ((x >> 1) & 1) + ((x >> 2) & 1), Z1 - 2 + ((x >> 1) & 1), white);
    B(X0 + 8, 6, Z1 + 1, X1 - 6, 9, Z1 + 16, shade); B(X0 + 8, 6, Z1 + 16, X1 - 6, 10, Z1 + 16, seam);
  } else { B(X0 + 8, 10, Z1 + 1, X1 - 6, 27, Z1 + 1, shade); B(-3, 25, Z1 + 2, 3, 26, Z1 + 2, dark); }
  // the back: a grille, and the plate with the numbers on that nobody has read
  for (let z = Z0 + 8; z <= Z1 - 8; z += 3) B(X0 - 1, 30, z, X0 - 1, 50, z + 1, dark);
  B(X0 - 1, 12, -8, X0 - 1, 18, 8, steel);

  if (variant === 2) {
    // a note taped to the front of the scanner, gone at one corner; and black where fingers have been at the slot
    B(X1 + 2, 58, -30, X1 + 2, 68, -16, M('#f1e7a0', 0)); for (const y of [61, 63, 65]) B(X1 + 3, y, -28, X1 + 3, y, -19 + (y % 3), M('#5a5646', 0));
    K(X1 + 2, 58, -30, X1 + 2, 59, -29); B(X1 + 3, 68, -25, X1 + 3, 68, -21, M('#c9c2a6', 0));
    for (let z = -24; z <= 24; z++) for (let y = 48; y <= 56; y++) if (v.has(X1 + 1, y, z) && noise3(z, y, 2, 5) > 0.72) v.set(X1 + 1, y, z, M('#33312e', 2));
    for (let x = X1 + 2; x < 46; x++) for (let z = -20; z <= 20; z++) if (noise3(x >> 1, 9, z >> 1, 9) > 0.86) v.set(x, 51, z, M('#4a4741', 2));
  }
  // corners knocked by the post trolley, low down; the foot of the front scuffed
  for (const z of [Z0, Z1]) for (let y = 8; y < 20; y++) if (noise3(1, y, z, 4) > 0.6) v.set(X1, y, z, seam);
  for (let z = Z0 + 4; z < Z1 - 3; z++) if (noise3(z >> 1, 2, 3, 8) > 0.6) v.set(X1 + 2, 9, z, seam);
  return v;
}

/**
 * The lid, by itself, to be stood open on its hinges: x runs from the hinge to the edge you lift, y is up through it
 * (the white mat is its underside), z along the machine. On top, the feeder: a hump at the hinge, a tray, two guides.
 */
export function lidVox() {
  const v = new Vox(), W = Math.round(COPIER.lid.w / 0.0125), D = Math.round(COPIER.lid.d / 0.0125) >> 1;
  const B = (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);
  const body = M(BODY, 1), shade = M(SHADE, 1), seam = M(SEAM, 0), white = M(WHITE, 0), dark = M(DARK, 0);
  B(0, 1, -D, W - 1, 3, D - 1, body); B(0, 0, -D, W - 1, 0, D - 1, shade); B(2, 0, -D + 2, W - 3, 0, D - 3, white);
  B(6, 0, -D + 6, W - 8, 0, D - 7, M('#e6e4dc', 0));                                               // where the glass has pressed
  B(0, 4, -D + 2, 15, 9, D - 3, body); B(0, 10, -D + 4, 13, 10, D - 5, shade); B(14, 6, -D + 6, 15, 7, D - 7, dark);   // the feeder, and its mouth
  for (let k = 0; k < 6; k++) B(16 + k * 3, 4, -D + 6, 18 + k * 3, 4 + Math.max(0, 2 - (k >> 1)), D - 7, shade);       // the tray the originals go on
  for (const z of [-14, 13]) B(17, 5, z, 30, 7, z, seam);                                           // the two guides
  B(W - 4, 4, -6, W - 2, 4, 5, seam);                                                               // where the fingers go, to lift it
  return v;
}
