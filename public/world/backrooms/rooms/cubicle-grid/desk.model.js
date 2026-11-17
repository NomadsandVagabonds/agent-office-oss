// The Open-Plan Pit's desk, sculpted. Pure: voxels in, voxels out.
// What is at the bottom of each cubicle, seen from the partition caps four metres up: a laminate top with a dark edge
// band, a pedestal of three drawers under one end and a panel leg under the other, a modesty panel across the back, a
// grommet with a cable going down it; and on the top what somebody left on it — a keyboard, a mouse on its mat, a mug,
// an in-tray, a pad with a pen. The middle of the back is left clear: that is where the room stands the monitor.
// x along the desk (1.28 m), y up (the top is 0.75 m), z from the back (−) to the edge you sit at (+). Half-size voxels.
import { Vox, M, glow, tone, noise3 } from '../../../vox/vox.js';

export const PIT_DESK = Object.freeze({ scale: 0.5, w: 1.28, d: 0.64, h: 0.75, variants: 4 });

/** @param {number} variant 0…3: which end the drawers are at, and what has been left on the top */
export function pitDeskVox(variant = 0) {
  const v = new Vox(), HX = 51, HZ = 25, H = 60, flip = variant & 1 ? -1 : 1;
  const B = (x0, y0, z0, x1, y1, z1, c) => v.box(Math.min(x0, x1), y0, z0, Math.max(x0, x1) + 1, y1 + 1, z1 + 1, c);
  const X = (x) => x * flip;
  const top = M('#b89668', 1), band = M('#5b4630', 0), steel = M('#3d4146', 0), steelL = M('#565b61', 0), drawer = M('#4a4f55', 0), pull = M('#a8aba8', 0), black = M('#141516', 0);
  // the top: laminate, a darker band round its edge, and the wear where two forearms have rested
  B(-HX, H - 4, -HZ, HX, H - 1, HZ, top); B(-HX, H - 4, -HZ, HX, H - 2, -HZ, band); B(-HX, H - 4, HZ, HX, H - 2, HZ, band); B(-HX, H - 4, -HZ, -HX, H - 2, HZ, band); B(HX, H - 4, -HZ, HX, H - 2, HZ, band);
  for (const x of [-16, 10]) B(x, H - 1, HZ - 9, x + 7, H - 1, HZ - 2, M(tone('#b89668', 0.1), 1));
  // the pedestal: three drawers, each with a pull and the top one with a lock; a plinth under it
  B(X(HX - 2), 3, -HZ + 3, X(HX - 30), H - 5, HZ - 3, steel); B(X(HX - 3), 0, -HZ + 5, X(HX - 29), 2, HZ - 5, black);
  [[5, 19], [21, 37], [39, 53]].forEach(([y0, y1], i) => {
    B(X(HX - 4), y0, HZ - 2, X(HX - 28), y1, HZ - 2, drawer); B(X(HX - 4), y0, HZ - 2, X(HX - 28), y0, HZ - 2, black);
    B(X(HX - 11), y1 - 5, HZ - 1, X(HX - 21), y1 - 4, HZ, pull);
    if (i === 2) v.set(X(HX - 6), y1 - 3, HZ - 1, M('#b39a55', 0));
  });
  if (variant === 2) { B(X(HX - 4), 21, HZ - 1, X(HX - 28), 37, HZ + 9, drawer); B(X(HX - 5), 34, HZ - 1, X(HX - 27), 36, HZ + 8, M('#e9e6da', 0)); }     // the middle drawer left open, and what is filed in it
  // the other end: a panel leg with a foot; across the back, the modesty panel; a cable tray under the top
  B(X(-HX + 2), 2, -HZ + 3, X(-HX + 4), H - 5, HZ - 3, steel); B(X(-HX + 1), 0, -HZ + 1, X(-HX + 5), 1, HZ - 1, black);
  B(X(-HX + 5), 14, -HZ + 3, X(HX - 31), H - 5, -HZ + 4, steelL);
  B(X(-HX + 8), H - 9, -HZ + 6, X(HX - 34), H - 8, -HZ + 12, steel);
  // the grommet, and the cable that goes down it and away under the partition
  B(X(-34), H - 1, -HZ + 6, X(-31), H - 1, -HZ + 9, black);
  for (let y = 0; y < H - 4; y++) v.set(X(-33), y, -HZ + 7 + (y < 6 ? 0 : (noise3(1, y >> 3, 2, 3) > 0.5 ? 1 : 0)), black);
  for (let z = -HZ - 6; z < -HZ + 7; z++) v.set(X(-33), 0, z, black);

  // on the top. A keyboard, square to the edge, its keys a shade paler than its case
  B(-14, H, HZ - 20, 12, H, HZ - 11, M('#cfc8b6', 0));
  for (let x = -13; x <= 11; x += 2) for (let z = HZ - 19; z <= HZ - 12; z += 2) v.set(x, H + 1, z, M((x + z) % 7 === 0 ? '#b9b2a0' : '#e4decd', 0));
  // a mouse on a mat, at whichever hand
  B(X(20), H, HZ - 20, X(33), H, HZ - 9, M('#2c3f5a', 2)); B(X(26), H + 1, HZ - 17, X(28), H + 2, HZ - 13, M('#d8d2c2', 0));
  // a mug with a ring under it; an in-tray with paper; a pad and a pen
  B(X(-40), H, -HZ + 16, X(-37), H + 5, -HZ + 19, M(['#c9483c', '#3d7f86', '#e9e6da', '#3a3c3f'][variant], 0)); v.set(X(-41), H + 3, -HZ + 17, M('#c9483c', 0)); B(X(-39), H + 5, -HZ + 17, X(-38), H + 5, -HZ + 18, M('#2a1c12', 0));
  B(X(36), H, -HZ + 4, X(49), H + 1, -HZ + 20, steelL); B(X(37), H + 2, -HZ + 5, X(48), H + 2 + (variant % 3), -HZ + 19, M('#efeee8', 0));
  B(X(-30), H, HZ - 16, X(-21), H, HZ - 4, M('#f1e7a0', 0)); B(X(-28), H + 1, HZ - 14, X(-27), H + 1, HZ - 7, M('#2b4a8c', 0));
  if (variant === 1) for (let k = 0; k < 5; k++) B(X(-48 + k * 2), H, -HZ + 3 + k * 3, X(-41 + k * 2), H, -HZ + 11 + k * 3, M(k % 2 ? '#efeee8' : '#e2ded0', 0));   // memos, slid
  if (variant === 3) { B(X(-48), H, HZ - 12, X(-42), H + 2, HZ - 5, black); v.set(X(-45), H + 3, HZ - 9, glow('#e8452c')); }                          // an answering machine, with one message
  return v;
}
