// The Backrooms — what stands at the level's desk, sculpted: the chair, the monitor, the keyboard. Pure.
// The office keeps its own (props/office.js); these are the same things at the same sizes to the voxel, so that each
// stands, is solid and is sat at exactly where the office's would be. Half-size voxels (1.25 cm), so every number here
// is twice the office's. Place with `scale: WORKSTATION.scale`.
//   chair     x −26…26, y 0…78, z −20…20   the seat's top is 32 up (office SEAT_H 16); it faces +z
//   monitor   x −20…20, y 0…40, z −18…18   the screen faces +z, 28 by 22, its middle 25 up (office CRT_SCREEN)
//   keyboard  x −24…24, y 0…6,  z −8…8     the edge you type at is +z
import { Vox, M, glow, tone, noise3 } from '../vox/vox.js';

export const WORKSTATION = Object.freeze({ scale: 0.5, bounds: Object.freeze({
  chair: Object.freeze({ x0: -26, y0: 0, z0: -20, x1: 26, y1: 78, z1: 20 }),
  crt: Object.freeze({ x0: -20, y0: 0, z0: -18, x1: 20, y1: 40, z1: 18 }),
  keyboard: Object.freeze({ x0: -24, y0: 0, z0: -8, x1: 24, y1: 6, z1: 8 }),
}) });

const box = (v) => (x0, y0, z0, x1, y1, z1, c) => v.box(Math.min(x0, x1), y0, z0, Math.max(x0, x1) + 1, y1 + 1, z1 + 1, c);
const BLACK = '#232327', STEEL = '#9aa3b0', CREAM = '#cfc6b0';

/**
 * A task chair: five legs on castors, a gas lift in a telescoping shroud, the mechanism with its two levers, a seat
 * cushion with a rolled front edge and piping, a back on a sprung upright with three channels sewn in it, and arms.
 * @param {{colour?:string}} [o] the cloth
 */
export function chairVox({ colour = '#4d5a78' } = {}) {
  const v = new Vox(), B = box(v);
  const cloth = M(colour, 3), clothD = M(tone(colour, -0.2), 3), clothL = M(tone(colour, 0.1), 3), pipe = M(tone(colour, -0.34), 2);
  const black = M(BLACK, 0), shell = M('#34343a', 0), steel = M(STEEL, 0), wheel = M('#17171a', 0);
  // the base: five legs, drooping a little to the castor at each tip
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3, cs = Math.cos(a), sn = Math.sin(a);
    for (let r = 2; r <= 19; r++) { const x = Math.max(-26, Math.min(24, Math.round(cs * r))), z = Math.max(-20, Math.min(18, Math.round(sn * r))), y = r > 13 ? 3 : 4; B(x, y, z, x + 1, y + (r < 8 ? 2 : 1), z + 1, black); }   // (two voxels square: a leg, not a wire)
    const wx = Math.round(cs * 20), wz = Math.round(sn * 20), cx = Math.max(-25, Math.min(24, wx)), cz = Math.max(-19, Math.min(18, wz));
    B(cx, 0, cz, cx + 1, 2, cz + 1, wheel); B(cx, 3, cz, cx + 1, 3, cz + 1, shell);                                     // a castor, and its pin
  }
  // the column: a shroud in two steps, the bright cylinder between, and the mechanism it carries
  B(-3, 4, -3, 2, 9, 2, black); B(-2, 10, -2, 1, 17, 1, shell); B(-1, 18, -1, 0, 22, 0, steel);
  B(-9, 22, -8, 8, 24, 7, shell); B(11, 23, -2, 17, 23, -1, black); B(17, 22, -2, 19, 23, -1, black);     // the mechanism, and the lever that lets it down
  B(-17, 23, 3, -10, 23, 4, black); v.set(-18, 23, 3, steel);                                             // the knob that stiffens the tilt
  // the seat: a pan, the cushion on it, its front rolled over, piping round the edge
  B(-18, 24, -15, 17, 25, 13, shell);
  B(-18, 26, -15, 17, 31, 13, cloth); B(-17, 26, 14, 16, 30, 14, cloth); B(-16, 26, 15, 15, 28, 15, clothD);
  for (const x of [-18, 17]) { v.carve(x, 31, -15, x + 1, 32, -13); v.carve(x, 31, 12, x + 1, 32, 14); }
  B(-18, 28, -15, -18, 28, 13, pipe); B(17, 28, -15, 17, 28, 13, pipe); B(-18, 28, -15, 17, 28, -15, pipe); B(-17, 28, 14, 16, 28, 14, pipe);
  for (let x = -14; x <= 13; x++) for (let z = -11; z <= 10; z++) if (noise3(x >> 2, 3, z >> 2, 6) > 0.72) v.set(x, 31, z, clothL);   // where it has been sat in
  // the back: an upright off the mechanism, a plastic shell, the cushion in front of it with three channels and a lumbar swell
  B(-2, 25, -19, 1, 44, -17, black); B(-3, 24, -17, 2, 26, -14, black);
  B(-16, 40, -20, 15, 77, -19, shell); B(-14, 42, -20, 13, 75, -20, shell);
  B(-16, 40, -18, 15, 77, -15, cloth); B(-15, 46, -14, 14, 58, -14, cloth);
  for (const x of [-6, 5]) B(x, 43, -15, x, 74, -15, pipe);
  B(-16, 40, -18, 15, 40, -15, pipe); B(-16, 77, -18, 15, 77, -15, pipe); B(-16, 40, -15, -16, 77, -15, pipe); B(15, 40, -15, 15, 77, -15, pipe);
  for (const x of [-16, 15]) { v.carve(x, 76, -20, x + 1, 78, -14); v.carve(x, 40, -20, x + 1, 42, -14); }
  B(-4, 70, -20, 3, 72, -20, black);
  for (const y of [48, 60]) B(-11, y, -20, 10, y + 1, -20, black);                                         // two ribs moulded across the shell                                                                      // the maker's plate, long since unreadable
  // the arms: a post up from the pan either side, a pad on top
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? 20 : -23, x1 = s > 0 ? 22 : -21;
    B(s > 0 ? 18 : -21, 25, -7, s > 0 ? 20 : -19, 26, -4, black); B(x0, 25, -7, x1, 44, -4, black);
    B(s > 0 ? 19 : -26, 45, -12, s > 0 ? 25 : -20, 47, 7, shell); B(s > 0 ? 20 : -25, 48, -11, s > 0 ? 24 : -21, 48, 6, M('#3d3d44', 2));
  }
  return v;
}

/**
 * A beige monitor of the kind with a tube in it: the case tapering to the back with slots along the top and sides,
 * a bezel, the glass set back behind it, a row of little wheels under the picture and a lamp that is on, a foot it
 * swivels on. The glass is lit a little and has a line or two on it: it was left on.
 */
export function crtVox() {
  const v = new Vox(), B = box(v);
  const body = M(CREAM, 0), shade = M(tone(CREAM, -0.14), 0), deep = M(tone(CREAM, -0.3), 0), dark = M('#1b1c1e', 0);
  B(-20, 6, -18, 19, 39, 17, body);
  for (let z = -18; z < -6; z++) {                                                                        // the tube narrows toward the back
    const k = Math.round((-6 - z) * 0.55) + 1;
    v.carve(-20, 6, z, -20 + k, 40, z + 1); v.carve(20 - k, 6, z, 20, 40, z + 1); v.carve(-20, 40 - k, z, 20, 40, z + 1);
  }
  for (const x of [-20, 19]) for (const y of [6, 39]) v.carve(x, y, 14, x + 1, y + 1, 18);                    // the front corners eased
  B(-19, 8, 17, 18, 38, 17, shade); v.carve(-15, 14, 16, 15, 37, 18);                                       // the bezel, and the well the glass sits in
  B(-14, 14, 15, 13, 35, 15, M('#0c1410', 0)); B(-15, 13, 16, 14, 13, 16, deep); B(-15, 36, 16, 14, 36, 16, deep); B(-15, 13, 16, -15, 36, 16, deep); B(14, 13, 16, 14, 36, 16, deep);
  // what is on it: a prompt, two short lines above, all of it the green of that phosphor
  const ink = glow('#57d98a'), dim = M('#12241a', 0);
  B(-11, 31, 15, 2, 31, 15, ink); B(-11, 28, 15, -3, 28, 15, ink); B(-11, 19, 15, -10, 19, 15, ink); B(-8, 19, 15, -7, 20, 15, ink);
  for (let y = 17; y <= 34; y += 6) B(-13, y, 15, 12, y, 15, dim);                    // the lines of the raster, faintly
  B(-11, 31, 15, 2, 31, 15, ink); B(-11, 28, 15, -3, 28, 15, ink);
  // under the picture: a badge, the wheels for brightness and the rest, the switch and its lamp
  B(-15, 9, 17, -8, 10, 17, deep); for (const x of [0, 3, 6]) B(x, 9, 17, x + 1, 10, 17, deep); B(11, 9, 17, 13, 10, 17, shade); v.set(15, 10, 17, glow('#86e0a8'));
  // slots: along the top, down each side toward the back
  for (let x = -14; x < 14; x += 3) v.carve(x, 39, -12, x + 1, 40, 4);
  for (const x of [-20, 19]) for (let y = 14; y < 34; y += 3) v.carve(x, y, -4, x + 1, y + 1, 8);
  // the back: where the lead and the signal cable go in; underneath, the neck and the foot
  B(-6, 14, -18, 5, 24, -18, deep); B(-3, 16, -18, -2, 19, -18, dark); B(2, 16, -18, 3, 17, -18, dark);
  B(-6, 3, -6, 5, 5, 5, shade); B(-14, 0, -10, 13, 2, 9, shade); for (const [x, z] of [[-14, -10], [13, -10], [-14, 9], [13, 9]]) v.carve(x, 0, z, x + 1, 3, z + 1);
  return v;
}

/** A keyboard: a wedge of a case, higher at the back, every key its own, a long bar at the front, three lamps, a lead. */
export function keyboardVox() {
  const v = new Vox(), B = box(v);
  const caseC = M(tone(CREAM, -0.12), 0), key = M(CREAM, 0), keyD = M(tone(CREAM, -0.2), 0), grey = M('#a9a290', 0), dark = M('#1b1c1e', 0);
  B(-24, 0, -8, 23, 1, 7, caseC); B(-24, 2, -8, 23, 2, 2, caseC); B(-24, 3, -8, 23, 3, -4, caseC);          // the wedge
  for (const [x, z] of [[-24, -8], [23, -8], [-24, 7], [23, 7]]) v.carve(x, 0, z, x + 1, 4, z + 1);
  const rows = [[-6, 4, false], [-3, 3, false], [0, 3, false], [3, 2, false], [6, 2, true]];               // z of the row, the height its keys stand on, the bar row
  rows.forEach(([z, y, bar], r) => {
    for (let x = -22; x <= 20; x += 3) {
      if (bar && x >= -10 && x <= 8) continue;
      const mod = x < -16 || x > 14 || (r === 0 && (x + 22) % 12 === 9);
      B(x, y, z - 1, x + 1, y + 1, z, mod ? grey : key); v.set(x, y, z, mod ? keyD : keyD);
    }
    if (bar) B(-10, y, z - 1, 9, y + 1, z, key);
  });
  B(-22, 4, -8, -21, 5, -8, M('#c96a5a', 0));                                                               // the one red key
  for (const x of [15, 18, 21]) v.set(x, 4, -8, x === 15 ? glow('#86e0a8') : dark);                          // lamps: one of them lit
  B(-2, 2, -8, -1, 3, -8, dark);                                                                            // the lead
  return v;
}
