// The Backrooms — what is screwed to a wall, sculpted. Pure: voxels in, voxels out.
// A frame for a notice or a picture; a socket; a light switch; the box an exit sign's lamp lives in. In every one
// x runs along the wall (0 is the middle), y up (0 is the middle, but the exit box hangs from its top), and z out of
// the wall: the back is z = 0. Quarter-size voxels (6.25 mm): place with `scale: WALLFIT.scale`.
// The frame is hung by bits.js `framed()`. The other three are models only: sockets and exit signs are drawn by the
// shell (world.js), which is the graphics pass's to change.
import { Vox, M, glow, tone, noise3 } from '../vox/vox.js';

export const WALLFIT = Object.freeze({ scale: 0.25, voxel: 0.00625, moulding: 0.04, deep: 0.025, plate: Object.freeze([0.075, 0.115]) });
const V = WALLFIT.voxel;
const box = (v) => (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);

/** How many voxels the opening of a frame is, for a picture of these metres: { W, H } (both even). */
export const frameSize = (w, h) => ({ W: Math.max(4, Math.round(w / V / 2) * 2), H: Math.max(4, Math.round(h / V / 2) * 2) });

/**
 * A frame round a picture w by h: a moulding 4 cm wide that steps down toward the picture in three, mitred at the
 * corners, with the back edge in shadow. Only the moulding: the picture is whoever hangs it.
 */
export function frameVox({ w, h, colour }) {
  const { W, H } = frameSize(w, h), v = new Vox(), m = Math.round(WALLFIT.moulding / V), hx = W / 2, hy = H / 2;
  const lip = M(tone(colour, 0.16), 2), face = M(colour, 2), step = M(tone(colour, -0.2), 2), inner = M(tone(colour, -0.4), 2), mitre = M(tone(colour, -0.5), 2);
  for (let x = -hx - m; x < hx + m; x++) for (let y = -hy - m; y < hy + m; y++) {
    const dx = x < -hx ? -hx - x : x >= hx ? x - hx + 1 : 0, dy = y < -hy ? -hy - y : y >= hy ? y - hy + 1 : 0, d = Math.max(dx, dy);
    if (d === 0) continue;                                                       // the opening
    const top = d >= m - 1 ? 3 : d >= 3 ? 2 : 1, c = dx === dy ? mitre : d >= m - 1 ? lip : d >= 3 ? face : d === 2 ? step : inner;
    for (let z = 0; z <= top; z++) v.set(x, y, z, z === top ? c : step);
  }
  return v;
}

/**
 * A wall socket: a cream plate with a bevelled edge, two outlets each with two slots and a hole, a screw between.
 * @param {number} variant 0 as fitted · 1 something is plugged into the lower one, and its lead goes down to the skirting
 */
export function socketVox(variant = 0) {
  const v = new Vox(), B = box(v), hw = 6, hh = 9;
  const plate = M('#d6cfb4', 0), edge = M('#bdb69c', 0), dark = M('#1c1a18', 0), screw = M('#8d8a80', 0), grime = M('#a39c84', 1);
  B(-hw, -hh, 0, hw - 1, hh - 1, 0, edge); B(-hw + 1, -hh + 1, 0, hw - 2, hh - 2, 1, plate);
  for (const oy of [3, -7]) { B(-3, oy, 1, -3, oy + 3, 1, dark); B(2, oy, 1, 2, oy + 3, 1, dark); B(-1, oy - 1, 1, 0, oy - 1, 1, dark); B(-4, oy - 2, 2, 3, oy + 4, 2, plate); v.carve(-3, oy, 2, -2, oy + 4, 3); v.carve(2, oy, 2, 3, oy + 4, 3); v.carve(-1, oy - 1, 2, 1, oy, 3); }
  v.set(-1, 0, 2, screw); v.set(0, 0, 2, screw);
  for (let x = -hw + 1; x < hw - 1; x++) if (noise3(x, 2, 1, 4) > 0.7) v.set(x, -hh + 1, 1, grime);
  if (variant === 1) { B(-4, -9, 3, 3, -4, 7, M('#2a2b2e', 0)); for (let y = -hh - 30; y < -9; y++) v.set(noise3(1, y >> 3, 2, 8) > 0.5 ? 0 : -1, y, 5, dark); }
  return v;
}

/** A light switch: the same plate, two rockers, one down. */
export function switchVox() {
  const v = new Vox(), B = box(v), hw = 6, hh = 9;
  const plate = M('#d6cfb4', 0), edge = M('#bdb69c', 0), rock = M('#e7e1cc', 0), shade = M('#a8a189', 0), screw = M('#8d8a80', 0);
  B(-hw, -hh, 0, hw - 1, hh - 1, 0, edge); B(-hw + 1, -hh + 1, 0, hw - 2, hh - 2, 1, plate);
  for (const [x0, down] of [[-4, true], [1, false]]) { B(x0, -4, 2, x0 + 2, 3, 2, rock); B(x0, down ? -4 : 1, 3, x0 + 2, down ? -2 : 3, 3, rock); B(x0, down ? 3 : -4, 2, x0 + 2, down ? 3 : -4, 2, shade); }
  v.set(-1, 7, 2, screw); v.set(-1, -8, 2, screw);
  return v;
}

/**
 * The box behind an exit sign's lit face: w metres along the wall and h high, 3 cm deep, hung from its top edge
 * (y = 0 is its top). Pressed steel, a rib round the face, a conduit going up out of it, a screw at each end, a test
 * button and the little lamp that says the battery is charging.
 */
export function exitBoxVox({ w, h }) {
  const v = new Vox(), B = box(v), hx = Math.max(8, Math.round(w / V / 2)), H = Math.max(8, Math.round(h / V)), D = 4;
  const steel = M('#23302a', 0), rib = M('#33443b', 0), screw = M('#8d8a80', 0);
  B(-hx, -H, 0, hx - 1, -1, D, steel);
  B(-hx, -H, D + 1, hx - 1, -H + 1, D + 1, rib); B(-hx, -2, D + 1, hx - 1, -1, D + 1, rib); B(-hx, -H, D + 1, -hx + 1, -1, D + 1, rib); B(hx - 2, -H, D + 1, hx - 1, -1, D + 1, rib);
  B(-2, 0, 1, 1, 14, 3, M('#6f736f', 0)); B(-3, 0, 0, 2, 1, 4, rib);                              // the conduit, and its gland
  for (const x of [-hx + 3, hx - 4]) v.set(x, -(H >> 1), D + 1, screw);
  v.set(hx - 6, -H, D - 1, M('#c9c6ba', 0)); v.set(hx - 9, -H, D - 1, glow('#e8452c'));            // under it: the test button, the charge lamp
  return v;
}
