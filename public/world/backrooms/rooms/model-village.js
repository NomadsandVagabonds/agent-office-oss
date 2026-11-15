// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Model
// ("the street that comes up to your knee"). A whole neighbourhood, to scale,
// some other scale: houses to the knee, a road, fences, cars the size of a
// shoe. In the middle of it a table, and on the table the same neighbourhood
// again, smaller; and one house in each of them has its lights on, and it is
// the same house. Everything in it is real. It is only small.
import { ticks } from '../kit.js';
import { lawn, sheet, daylight, WHITEWASH } from '../suburb.js';

/** One house, s metres wide, at (x, z), its floor at y: walls, a roof, a door, and perhaps a light. */
function house(c, x, y, z, s, rgb, roof, lit) {
  const h = s * 0.62, r = s * 0.42, d = s * 0.8, e = s * 0.06;
  c.flat.box(x - s / 2, y, z - d / 2, x + s / 2, y + h, z + d / 2, rgb, y ? {} : { skip: '-y' });
  sheet(c.flat, [x - s / 2 - e, y + h, z + d / 2 + e], [x + s / 2 + e, y + h, z + d / 2 + e], [x + s / 2 + e, y + h + r, z], [x - s / 2 - e, y + h + r, z], 1, 1, null, roof);
  sheet(c.flat, [x + s / 2 + e, y + h, z - d / 2 - e], [x - s / 2 - e, y + h, z - d / 2 - e], [x - s / 2 - e, y + h + r, z], [x + s / 2 + e, y + h + r, z], 1, 1, null, roof);
  for (const k of [-1, 1]) sheet(c.flat, [x + k * s / 2, y + h, z + k * d / 2], [x + k * s / 2, y + h, z - k * d / 2], [x + k * s / 2, y + h + r, z], [x + k * s / 2, y + h + r, z], 1, 1, null, rgb);
  c.flat.box(x - s * 0.08, y, z + d / 2, x + s * 0.08, y + h * 0.62, z + d / 2 + s * 0.012, [0.45, 0.14, 0.1]);
  for (const k of [-1, 1]) c.flat.box(x + k * s * 0.28 - s * 0.09, y + h * 0.4, z + d / 2, x + k * s * 0.28 + s * 0.09, y + h * 0.75, z + d / 2 + s * 0.012, lit ? [1, 0.9, 0.5] : [0.16, 0.2, 0.25]);
}

export function build(c) {
  const { W, D, H, R, params: p } = c;
  c.shell({ panels: false });
  daylight(c, 3, 3, 1, 1);
  lawn(c, { wrong: 0, paint: 'mall', width: 0.4, cloudTop: H - 0.8, neighbour: 0 });
  const tints = [[0.9, 0.88, 0.8], [0.8, 0.84, 0.9], [0.9, 0.82, 0.7], [0.82, 0.9, 0.8]], roofs = [[0.36, 0.28, 0.26], [0.45, 0.2, 0.16], [0.25, 0.3, 0.36]];
  // the street: the same plan at two sizes. (u, v) in units of a plot; `unit` metres to the plot
  const plots = []; for (let i = -2; i <= 2; i++) for (const j of [-1, 1]) if (!(i === 0 && j === 1)) plots.push([i, j]);
  const street = (cx, y, cz, unit, solid) => {
    const road = c.mapped('model:road', c.kit.tex.carpet('#58595c')), w = unit * 5.4, d = unit * 0.7;
    road.grid([cx - w / 2, y + 0.012, cz - d / 2], [0, 0, 1], [1, 0, 0], ticks(d, 0.5, 0), ticks(w, 0.5, 0), (u, v) => [v / (unit * 0.6), u / (unit * 0.6)]);
    plots.forEach(([i, j], k) => {
      const x = cx + i * unit, z = cz + j * unit * 0.95, s = unit * 0.62;
      house(c, x, y, z, s, tints[k % 4], roofs[k % 3], k === p.lit % plots.length);
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
