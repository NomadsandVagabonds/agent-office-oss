// The Backrooms — the level's own desk, sculpted. Pure: voxels in, voxels out.
// The office keeps its desk (props/office.js); down here the same desk is the one every such office had: a laminate
// top with a dark edge band on a putty steel carcase — a pedestal of two box drawers and a file drawer under one
// end, a panel leg under the other, a pencil drawer between, a modesty panel with a row of slots across the back, a
// grommet and the cable that goes down it. Nothing stands on the top: rooms put their own things there.
//
// It is exactly the office desk's size, so that it stands where that stood and is solid where that was: 1.6 m by
// 0.8 m, the top 0.65 m up (props/office.js DESK_H). Half-size voxels, so the numbers here are twice the office's:
// x −64…63, y 0…51, z −32…31. As there, whoever sits at it is on the −z side and the drawers are at the +x end.
import { Vox, M, tone, noise3 } from '../vox/vox.js';

export const LEVEL_DESK = Object.freeze({ scale: 0.5, bounds: Object.freeze({ x0: -64, y0: 0, z0: -32, x1: 64, y1: 52, z1: 32 }) });

const TOP = '#b28d5e', BAND = '#4f3d2a', PUTTY = '#9b9684', PUTTY_D = '#7f7b6b', PULL = '#c9c6ba', BLACK = '#1d1e20';

export function deskVox() {
  const v = new Vox(), H = 52;
  const B = (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);
  const top = M(TOP, 1), band = M(BAND, 0), putty = M(PUTTY, 0), puttyD = M(PUTTY_D, 0), pull = M(PULL, 0), black = M(BLACK, 0);
  // the top: laminate, grain the long way in a few broad streaks, a band round the edge, the front edge worn pale
  B(-64, H - 4, -32, 63, H - 1, 31, top);
  for (const z of [-24, -15, -3, 8, 19]) B(-63, H - 1, z, 62, H - 1, z + (z % 2 ? 1 : 0), M(tone(TOP, -0.07), 1));
  B(-64, H - 4, -32, 63, H - 2, -32, band); B(-64, H - 4, 31, 63, H - 2, 31, band); B(-64, H - 4, -32, -64, H - 2, 31, band); B(63, H - 4, -32, 63, H - 2, 31, band);
  B(-22, H - 1, -31, 6, H - 1, -28, M(tone(TOP, 0.12), 1));
  for (let x = -60; x < 60; x += 5) if (noise3(x, 1, 2, 6) > 0.7) v.set(x, H - 2, -32, top);                       // the band chipped here and there
  // the pedestal, at the +x end, set back a finger under the top: two box drawers and a file drawer, a plinth
  B(26, 4, -28, 59, H - 5, 27, putty); B(28, 0, -26, 57, 3, 25, black);
  [[6, 21], [23, 34], [36, 46]].forEach(([y0, y1], i) => {
    B(27, y0, -29, 58, y1, -29, puttyD); B(28, y0 + 1, -30, 57, y1 - 1, -30, putty);
    B(36, y1 - 4, -31, 49, y1 - 3, -31, pull); B(36, y1 - 5, -30, 49, y1 - 5, -30, black);                          // a pull, and the shadow under it
    B(30, y1 - 4, -31, 33, y1 - 2, -31, M('#e9e6da', 0));                                                           // a label holder, with a label
    if (i === 2) v.set(55, y1 - 2, -31, M('#b39a55', 0));                                                           // the lock is in the top one
  });
  // the other end: a panel leg and its foot; between, a pencil drawer hung under the top
  B(-62, 2, -28, -59, H - 5, 27, putty); B(-63, 0, -30, -58, 1, 29, black);
  B(-30, H - 10, -27, 14, H - 5, 6, puttyD); B(-29, H - 9, -28, 13, H - 6, -28, putty); B(-12, H - 8, -29, -4, H - 8, -29, pull);
  // the modesty panel across the back, with a row of slots; and a rail under the top to stiffen it
  B(-58, 12, 24, 25, H - 5, 26, putty);
  for (let x = -50; x <= 16; x += 6) B(x, H - 16, 27, x + 2, H - 9, 27, puttyD), B(x, H - 16, 26, x + 2, H - 9, 26, black);
  B(-58, H - 7, -6, 25, H - 5, -4, puttyD);
  // the grommet, and the cable down the back of the panel and away
  B(-45, H - 1, 18, -42, H - 1, 21, black);
  for (let y = 0; y < H - 4; y++) v.set(-44, y, 28 + (noise3(3, y >> 3, 1, 2) > 0.55 ? 1 : 0), black);
  for (let z = 28; z <= 31; z++) v.set(-44, 0, z, black);
  // what a desk gets: the corners of the pedestal knocked, a ring where a cup stood
  for (let y = 5; y < 14; y++) if (noise3(2, y, 7, 4) > 0.55) { v.set(59, y, -28, puttyD); v.set(26, y, -28, puttyD); }
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; v.set(Math.round(40 + Math.cos(a) * 3.4), H - 1, Math.round(10 + Math.sin(a) * 3.4), M(tone(TOP, -0.16), 1)); }
  return v;
}
