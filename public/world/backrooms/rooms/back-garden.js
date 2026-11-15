// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Back
// Garden ("the garden everybody is looking into"). A tall fence on three
// sides, and over it the heads of the neighbours: colleagues, cut out of
// board, each stood on a crate so as to see over. They turn to face you
// whenever you are not looking. In the garden: a paddling pool full of the
// ceiling tiles that are missing from over it, a barbecue with a keyboard on
// it, a chair from the office, and a washing line of paperwork.
import { ticks, WHITE } from '../kit.js';
import { standee } from '../bits.js';
import { lawn, fence, beam, daylight, TIMBER } from '../suburb.js';
import { TILE } from '../gen.js';

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
  // the pool, and where what is in it came from
  { const x = -1.6, z = -0.4, s = 1.2, blue = [0.2, 0.5, 0.75];
    for (const [a, b, d, e] of [[x - s, z - s, x + s, z - s + 0.12], [x - s, z + s - 0.12, x + s, z + s], [x - s, z - s + 0.12, x - s + 0.12, z + s - 0.12], [x + s - 0.12, z - s + 0.12, x + s, z + s - 0.12]]) c.flat.box(a, 0, b, d, 0.38, e, blue, { skip: '-y' });
    c.ceil.grid([x - s + 0.12, 0.3, z - s + 0.12], [0, 0, 1], [1, 0, 0], ticks(2 * s - 0.24, 0.6, 0), ticks(2 * s - 0.24, 0.6, 0), (u, v) => [u / TILE, v / TILE]);
    c.hole(x - 0.6, z - 0.6, 3); c.solid(x - s, z - s, x + s, z + s, { tall: false }); c.reserve(x, z, 1.8); }
  // the barbecue
  { const x = 2.0, z = -1.4;
    for (const [a, b] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) c.flat.box(x + a - 0.02, 0, z + b - 0.02, x + a + 0.02, 0.7, z + b + 0.02, [0.1, 0.1, 0.1], { skip: '-y' });
    c.flat.box(x - 0.4, 0.7, z - 0.28, x + 0.4, 0.86, z + 0.28, [0.12, 0.12, 0.13]); c.flat.box(x - 0.36, 0.86, z - 0.24, x + 0.36, 0.875, z + 0.24, [0.45, 0.45, 0.45]);
    if (c.hasProp('keyboard')) c.prop('keyboard', x, z, { y: 0.875, rot: 0.2, solid: false, shadow: false });
    c.solid(x - 0.4, z - 0.28, x + 0.4, z + 0.28); c.shadow(x, z, 0.8, 0.6, 0.4); c.reserve(x, z, 0.9);
    c.prop('chair', x + 1.0, z + 1.3, { rot: -2.2 + R.range(-0.2, 0.2), o: { color: '#5a5a66' } }); }
  // the washing line
  { const a = [-fx + 0.4, 1.9, 2.2], b = [fx - 0.4, 1.9, 2.2], paper = c.mapped('paper', kit.tex.paper());
    for (const q of [a, b]) { beam(c.flat, [q[0], 0, q[2]], [q[0], 2.0, q[2]], 0.07, TIMBER); c.solid(q[0] - 0.05, q[2] - 0.05, q[0] + 0.05, q[2] + 0.05); }
    beam(c.flat, a, b, 0.015, [0.85, 0.85, 0.8]);
    for (let x = a[0] + 0.5; x < b[0] - 0.4; x += R.range(0.3, 0.55)) { const y = 1.9 - 0.3, t = R.range(-0.04, 0.04); paper.quad([x, y, 2.2 + t], [x + 0.21, y, 2.2 - t], [x + 0.21, 1.9, 2.2], [x, 1.9, 2.2], WHITE); paper.quad([x + 0.21, y, 2.2 - t], [x, y, 2.2 + t], [x, 1.9, 2.2], [x + 0.21, 1.9, 2.2], WHITE); } }
}
