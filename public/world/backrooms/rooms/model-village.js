// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Model
// ("the street that comes up to your knee"). A whole neighbourhood, to scale,
// some other scale: houses to the knee, a road, fences, cars the size of a
// shoe. In the middle of it a table, and on the table the same neighbourhood
// again, smaller; and one house in each of them has its lights on, and it is
// the same house. Everything in it is real. It is only small.
import { ticks } from '../kit.js';
import { Vox, M, glow, tone } from '../../vox/vox.js';
import { lawn, daylight, WHITEWASH } from '../suburb.js';

/** A cottage, a metre wide as sculpted (it is put down smaller): boarded walls, a tiled roof, a chimney, a door with a step, windows with boxes, a hedge. */
const cottageVox = (wall, tile, lit, small = false) => () => {
  const v = new Vox(), w = M(wall, 1), wd = M(tone(wall, -0.14), 1), t = M(tile, 2), td = M(tone(tile, -0.2), 2), pane = lit ? glow('#ffd98a') : M('#27323a', 0), trim = M('#efe9d8', 1);
  v.box(-20, 0, -16, 20, 25, 16, w); if (!small) for (let y = 7; y < 25; y += 8) v.paint(-20, y, 15, 20, y + 1, 16, wd);                 // (a board line or two on the front: every line is a hundred faces)
  for (let i = 0; i < 18; i++) { v.box(-22, 25 + i, -18 + i, 22, 26 + i, 18 - i, i % 3 === 2 ? td : t); v.paint(-22, 25 + i, -18 + i, -21, 26 + i, 18 - i, trim); v.paint(21, 25 + i, -18 + i, 22, 26 + i, 18 - i, trim); }
  v.box(8, 30, -6, 13, 47, -1, M('#8a4a3c', 3)); v.box(7, 46, -7, 14, 48, 0, M('#6b3a30', 3)); v.cyl('y', 10.5, -3.5, 48, 51, 1.6, M('#3a2a24', 1));
  v.box(-3.5, 0, 16, 3.5, 15, 17, M('#7d2a22', 1)); v.box(-4.5, 15, 16, 4.5, 16, 17, trim); v.set(2, 7, 17, M('#c9a43a', 0)); v.box(-5, 0, 17, 5, 1, 20, M('#9a9a96', 2));
  for (const x of [-15, 7]) { v.box(x, 8, 16, x + 8, 17, 17, pane); v.box(x - 1, 7, 16, x + 9, 8, 17.4, trim); v.box(x - 1, 17, 16, x + 9, 18, 17.4, trim); v.box(x + 3.6, 8, 16.6, x + 4.4, 17, 17.2, trim); v.box(x, 12, 16.6, x + 8, 12.8, 17.2, trim); v.box(x, 5, 17, x + 8, 7, 19, M('#5a3a26', 3)); for (let fx = x + 1; fx < x + 8; fx += 2) v.set(fx, 7, 18, M(fx % 4 < 2 ? '#d9433a' : '#f3d44a', 0)); }
  for (const x of [-15, 7]) v.box(x, 8, -17, x + 8, 17, -16, pane);
  for (const x of [-24, 7]) v.rbox(x, 0, 21, x + 17, 6, 25, 2, M('#3f7a3a', 3));
  return v.downsample(2);                                      // (they are put down at about a metre across and less: half the voxels each way is the room's budget)
};

export function build(c) {
  const { W, D, H, R, params: p } = c;
  c.shell({ panels: false });
  daylight(c, 3, 3, 1, 1);
  lawn(c, { wrong: 0, paint: 'mall', width: 0.4, cloudTop: H - 0.8, neighbour: 0 });
  const tints = ['#efe9d8', '#cfd9e6', '#ecd9b4', '#d4e6d0'], roofs = ['#5b4b46', '#8a3a2c', '#3f4a56'];
  // the street: the same plan at two sizes. (u, v) in units of a plot; `unit` metres to the plot
  const plots = []; for (let i = -2; i <= 2; i++) for (const j of [-1, 1]) if (!(i === 0 && j === 1)) plots.push([i, j]);
  const street = (cx, y, cz, unit, solid) => {
    const road = c.mapped('model:road', c.kit.tex.carpet('#58595c')), w = unit * 5.4, d = unit * 0.7;
    road.grid([cx - w / 2, y + 0.012, cz - d / 2], [0, 0, 1], [1, 0, 0], ticks(d, 0.5, 0), ticks(w, 0.5, 0), (u, v) => [v / (unit * 0.6), u / (unit * 0.6)]);
    plots.forEach(([i, j], k) => {
      const x = cx + i * unit, z = cz + j * unit * 0.95, s = unit * 0.62;
      const lit = k === p.lit % plots.length; c.model(`model:cottage:${k % 4}:${k % 3}:${lit}`, cottageVox(tints[k % 4], roofs[k % 3], lit, !solid), x, z, { y, scale: s * 2, rot: j > 0 ? Math.PI : 0, solid: false, shadow: y ? false : 0.3 });
      c.flat.box(x - unit * 0.42, y, z - j * unit * 0.5 - unit * 0.01, x + unit * 0.42, y + unit * 0.13, z - j * unit * 0.5 + unit * 0.01, WHITEWASH, y ? {} : { skip: '-y' });
      if (k % 3 === 1) c.flat.box(x - unit * 0.12, y, cz + j * unit * 0.16 - unit * 0.06, x + unit * 0.12, y + unit * 0.09, cz + j * unit * 0.16 + unit * 0.06, [[0.7, 0.2, 0.18], [0.25, 0.4, 0.7]][k % 2]);
      if (solid) { c.solid(x - s / 2, z - s * 0.4, x + s / 2, z + s * 0.4, { tall: false }); c.reserve(x, z, s * 0.7); }
    });
  };
  const unit = Math.min(1.75, (W - 2.6) / 5.2);
  street(0, 0, -0.3, unit, true);
  // the table, where the plot with no house on it is, and what is on the table
  { const x = 0, z = -0.3 + unit * 0.95, top = 0.74;
    for (const [a, b] of [[-0.5, -0.32], [0.5, -0.32], [-0.5, 0.32], [0.5, 0.32]]) c.flat.box(x + a - 0.025, 0, z + b - 0.025, x + a + 0.025, top - 0.03, z + b + 0.025, [0.3, 0.3, 0.32], { skip: '-y' });
    c.flat.box(x - 0.58, top - 0.03, z - 0.4, x + 0.58, top, z + 0.4, [0.74, 0.6, 0.4]); c.floor.grid([x - 0.56, top + 0.002, z - 0.38], [0, 0, 1], [1, 0, 0], [0, 0.76], [0, 1.12], (u, v) => [u / 1.6, v / 1.6]);
    street(x, top + 0.003, z, 0.2, false);
    c.light(x, 1.3, z, '#ffe9a8', 0.25, { k: 1, far: 3 }); c.solid(x - 0.58, z - 0.4, x + 0.58, z + 0.4); c.reserve(x, z, 1.1); }
  void R; void D;
}
