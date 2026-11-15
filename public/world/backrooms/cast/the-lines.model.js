// The Backrooms — what the lines are made of (cast/the-lines.js): a body, a leg, and what holds a leg on. Voxels, and nothing else:
// no three.js here, so that the room it ends in (rooms/the-culvert.js) and the creature are sculpted from the one place.
import { Vox, M } from '../../vox/vox.js';
import { LINES } from './the-lines.rule.js';

export const S = 0.03;
const POLE = LINES.pole;

/** What it is slung from them: a body of flesh the size of a car bonnet, with what it has grown round still in it. */
export function bodyVox() {
  const v = new Vox(), raw = ['#b4756a', '#a5645b', '#c48a7d', '#8f5148'].map((k) => M(k, 2)), bruise = M('#5e3540', 2), wood = M('#4a3626', 3), glass = M('#9fc7c2', 0), wire = M('#17171a', 0);
  const skin = (x, y, z) => { const h = Math.sin(x * 0.61 + y * 1.3) + Math.sin(z * 0.83 - y * 0.7) + Math.sin((x + z) * 0.37); return h > 1.5 ? bruise : raw[Math.abs(Math.floor(h * 1.4 + 8)) % 4]; };
  v.ellipsoid(0, 0, 0, 24, 15, 19, skin); v.ellipsoid(-13, 7, 5, 12, 10, 11, skin); v.ellipsoid(12, 8, -6, 13, 9, 12, skin); v.ellipsoid(3, -10, 2, 15, 9, 13, skin); v.ellipsoid(-6, 12, -9, 8, 7, 8, skin);
  // a crossarm it grew round, insulators and all, and another through the back of it
  v.box(-34, 6, -2, 34, 9, 1, wood); for (const x of [-31, -22, 22, 31]) { v.cyl('y', x, -0.5, 9, 13, 1.6, glass); v.cyl('y', x, -0.5, 13, 14, 2.2, glass); }
  v.box(-3, 10, -30, 0, 13, 28, wood); for (const z of [-27, 25]) v.cyl('y', -1.5, z, 13, 17, 1.6, glass);
  // the line, still on it: down, and trailing
  for (const [x, z, n] of [[-31, 0, 30], [31, 0, 22], [-1, -27, 34], [-1, 25, 18], [14, 12, 26]]) v.tube(x, 6, z, x + (x > 0 ? 3 : -3), 6 - n, z + 2, 0.7, wire);
  // underneath, where it opens: lengthways, and too many teeth
  for (let x = -14; x <= 14; x++) { const g = Math.round(3.2 - Math.abs(x) * 0.2); v.carve(x, -19, -g, x, -13, g); if (x % 2 === 0) { v.box(x, -15, -g, x, -13, -g, M('#efe7d2', 0)); v.box(x, -15, g, x, -13, g, M('#efe7d2', 0)); } }
  v.ellipsoid(0, -12, 0, 13, 2, 3, M('#3a1418', 0));
  return v;
}
/** A leg: a telephone pole, foot at the bottom, its two crossarms at the top, where the knee is. Along +y. */
export function poleVox() {
  const v = new Vox(), n = Math.round(POLE / S), wood = M('#4a3626', 3), dark = M('#35261b', 3), glass = M('#9fc7c2', 0), raw = M('#a5645b', 2);
  v.cyl('y', 0, 0, 0, n, 2.6, (x, y) => ((x * 7 + y) % 11 < 2 ? dark : wood), 2.1);
  for (const [y, half] of [[n - 9, 17], [n - 22, 13]]) { v.box(-half, y, -1, half, y + 3, 1.5, wood); for (const x of [-half + 2, -half + 9, half - 9, half - 2]) { v.cyl('y', x, 0.3, y + 3, y + 6, 1.4, glass); v.cyl('y', x, 0.3, y + 6, y + 7, 2, glass); } v.tube(-half + 4, y, 0, 0, y - 8, 0, 0.6, wood); v.tube(half - 4, y, 0, 0, y - 8, 0, 0.6, wood); }
  v.ellipsoid(0, n - 2, 0, 4.5, 5, 4.5, raw); v.cyl('y', 0, 0, 0, 5, 3.4, dark, 2.6);                  // where it is joined on; and a foot worn round
  for (let y = 12; y < n - 30; y += 9) v.box(2, y, -0.5, 4, y + 1, 0.5, M('#8d949c', 0));              // the rungs somebody used to climb
  return v;
}
/** What holds a leg on: a rope of the same flesh, a metre of it (it is stretched to fit). Along +y. */
export function sinewVox() { const v = new Vox(), n = Math.round(1 / S); v.cyl('y', 0, 0, 0, n, 2.4, (x, y) => M(['#a5645b', '#8f5148', '#b4756a'][(y >> 2) % 3], 2), 3.2); v.tube(1.5, 0, 0, -1.5, n, 1, 0.8, M('#17171a', 0)); return v; }

