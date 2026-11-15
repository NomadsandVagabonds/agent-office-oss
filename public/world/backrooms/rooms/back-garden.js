// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Back
// Garden ("the garden everybody is looking into"). A tall fence on three
// sides, and over it the heads of the neighbours: colleagues, cut out of
// board, each stood on a crate so as to see over. They turn to face you
// whenever you are not looking. In the garden: a paddling pool full of the
// ceiling tiles that are missing from over it, a barbecue with a keyboard on
// it, a chair from the office, and a washing line of paperwork.
import { ticks, WHITE } from '../kit.js';
import { Vox, M } from '../../vox/vox.js';
import { standee } from '../bits.js';
import { lawn, fence, beam, daylight } from '../suburb.js';
import { TILE } from '../gen.js';

/** A paddling pool: three rings of air, blue and white, and a floor. */
function poolVox() { const v = new Vox(); v.cyl('y', 0, 0, 0, 1, 44, M('#3f7fb8', 0)); [['#2f6fa8', 3], ['#efe9d8', 8.4], ['#2f6fa8', 13.8]].forEach(([k, y]) => v.ring(0, y, 0, 42, 3.1, M(k, 0), 'y')); v.cyl('y', 46, 0, 12, 15, 1.2, M('#efe9d8', 0)); return v; }
/** A kettle barbecue: an enamel bowl on three legs, two of them with wheels; a grill; its lid hooked on the side; tongs. */
function kettleVox() {
  const v = new Vox(), enamel = M('#17171a', 0), steel = M('#8d949c', 0);
  v.ellipsoid(0, 30, 0, 12, 9, 12, enamel); v.carve(-13, 30, -13, 13, 40, 13); v.cyl('y', 0, 0, 29, 30, 11, M('#2a2420', 3));
  for (let x = -10; x <= 10; x += 2.5) v.box(x, 30, -Math.sqrt(121 - x * x), x + 0.7, 30.7, Math.sqrt(121 - x * x), steel); v.ring(0, 30.4, 0, 11.4, 0.6, steel, 'y');
  for (const a of [0.5, 2.6, 4.7]) { const x = Math.cos(a) * 9, z = Math.sin(a) * 9; v.tube(x * 0.7, 23, z * 0.7, x * 1.25, 0, z * 1.25, 0.9, steel); if (a > 1) v.cyl('x', 2.6, z * 1.25, x * 1.25 - 1, x * 1.25 + 1, 2.6, enamel); }
  v.cyl('y', 0, 0, 18, 21, 4, steel, 5);
  v.ellipsoid(15, 30, 0, 3.4, 9, 11, enamel); v.carve(11.6, 20, -12, 14.4, 40, 12); v.box(17.6, 30, -2, 20, 33, 2, M('#7a4f2a', 3));
  v.tube(-4, 31, 4, 9, 32, 9, 0.5, steel); v.tube(-4, 31.6, 5, 9, 32.6, 10, 0.5, steel);
  return v;
}
/** A post for a washing line: a T of grey tube, a hook at either end of its arm. */
function linePostVox() { const v = new Vox(), k = M('#8d949c', 0); v.tube(0, 0, 0, 0, 80, 0, 1.4, k); v.tube(-12, 78, 0, 12, 78, 0, 1.1, k); for (const x of [-11, 11]) v.tube(x, 78, 0, x, 75, 1.4, 0.5, k); v.cyl('y', 0, 0, 0, 2, 3, M('#5d646c', 0)); return v; }

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, cast = c.env.cast || [];
  c.shell({ panels: false });
  daylight(c, 3, 3, 1, 1);
  lawn(c, { wrong: 0, paint: 'sky', width: 0.35, cloudTop: H - 0.8, neighbour: 0 });
  const fx = W / 2 - 1.5, fz = -D / 2 + 1.5, gap = 1.3, hh = 1.75;
  // the fence: each run is in two, either side of where a doorway might be
  for (const s of [-1, 1]) { fence(c, s * fx, fz, s * fx, -gap, { h: hh }); fence(c, s * fx, gap, s * fx, D / 2 - 1.2, { h: hh }); fence(c, s * gap, fz, s * fx, fz, { h: hh }); }
  // the neighbours, on their crates
  let k = 0;
  const peer = (x, z, rot) => { if (!cast.length) return; const who = cast[p.who[k % p.who.length] % cast.length]; k++; c.crate(x, z, 0.5, 0.75, 0.5, 0, [0.62, 0.5, 0.33]); standee(c, 'who:' + who.name, who.look, x, z, rot, { y: 0.75, name: who.name }); };
  for (const s of [-1, 1]) { peer(s * (fx + 0.75), fz + 1.6, -s * Math.PI / 2); peer(s * (fx + 0.75), D / 2 - 2.6, -s * Math.PI / 2); peer(s * (gap + 1.6), fz - 0.75, 0); }
  // the pool: three rings of air, and in it the tiles that are missing from over it
  { const x = -1.6, z = -0.4, r = 1.15;
    c.model('garden:pool', poolVox, x, z, { solid: false, shadow: false });
    c.ceil.grid([x - 0.72, 0.2, z - 0.72], [0, 0, 1], [1, 0, 0], ticks(1.44, 0.6, 0), ticks(1.44, 0.6, 0), (u, v) => [u / TILE, v / TILE]);
    for (const [dx, dz, rot] of [[0.5, 0.4, 0.5], [-0.45, 0.5, 2.1], [0.1, -0.6, 1.2]]) c.lay(c.ceil, x + dx, z + dz, TILE, TILE, rot, [[0, 0], [1, 0], [1, 1], [0, 1]], WHITE, 0.24 + Math.abs(dx) * 0.05);
    c.hole(x - 0.6, z - 0.6, 3); c.solid(x - r, z - r, x + r, z + r, { tall: false }); c.shadow(x, z, 2.4, 2.4, 0.35); c.reserve(x, z, 1.8); }
  // the barbecue: a kettle on three legs, its lid hung on the side, and what is cooking
  { const x = 2.0, z = -1.4;
    c.model('garden:kettle', kettleVox, x, z, { rot: 0.4, solid: false, shadow: false });
    if (c.hasProp('keyboard')) c.prop('keyboard', x, z, { y: 0.79, rot: 0.2, solid: false, shadow: false });
    c.solid(x - 0.34, z - 0.34, x + 0.34, z + 0.34); c.shadow(x, z, 0.8, 0.8, 0.4); c.reserve(x, z, 0.9);
    c.prop('chair', x + 1.0, z + 1.3, { rot: -2.2 + R.range(-0.2, 0.2), o: { color: '#5a5a66' } }); }
  // the washing line
  { const a = [-fx + 0.4, 1.9, 2.2], b = [fx - 0.4, 1.9, 2.2], paper = c.mapped('paper', kit.tex.paper());
    for (const q of [a, b]) { c.model('garden:post', linePostVox, q[0], q[2], { rot: Math.PI / 2, solid: false, shadow: false }); c.solid(q[0] - 0.05, q[2] - 0.05, q[0] + 0.05, q[2] + 0.05); }
    beam(c.flat, a, b, 0.015, [0.85, 0.85, 0.8]);
    for (let x = a[0] + 0.5; x < b[0] - 0.4; x += R.range(0.3, 0.55)) { const y = 1.9 - 0.3, t = R.range(-0.04, 0.04); paper.quad([x, y, 2.2 + t], [x + 0.21, y, 2.2 - t], [x + 0.21, 1.9, 2.2], [x, 1.9, 2.2], WHITE); paper.quad([x + 0.21, y, 2.2 - t], [x, y, 2.2 + t], [x, 1.9, 2.2], [x + 0.21, 1.9, 2.2], WHITE); } }
}
