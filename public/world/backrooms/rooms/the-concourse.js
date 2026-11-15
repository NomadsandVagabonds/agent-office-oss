// The Backrooms — a room of the shopping centre (themes.js `mall`): The
// Concourse ("the units, one to nine"). Nine shop units in three rows of
// three, each an office partition box with a glazed front, vertical blinds
// and an office door, and a lit sign over it. The ways between them are a
// body and a half wide. Some of those have a shutter down across them, so
// the way from one side to the other is never the straight one; the way
// round the outside is always open. One unit is lit, stocked and open. It
// has no door.
import { P } from '../bits.js';
import { upright } from '../suburb.js';
import { SHOPS, FRONTS, mallFronts, mallSigns, wrap } from '../mall.js';

export const CONCOURSE = Object.freeze({ edge: 1.35, aisle: 1.5, fascia: 0.5, shut: 4 });

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = CONCOURSE;
  c.shell({});
  const bw = (W - 2 * K.edge - 2 * K.aisle) / 3, bd = (D - 2 * K.edge - 2 * K.aisle) / 3;
  const x0 = (i) => -W / 2 + K.edge + i * (bw + K.aisle), z0 = (j) => -D / 2 + K.edge + j * (bd + K.aisle);
  const art = mallFronts(kit), fronts = c.mapped('mall:fronts', art.texture), names = R.shuffle(SHOPS.slice()).slice(0, 8), sg = mallSigns(kit, 'concourse:' + p.seed, names, p.seed);
  const signs = c.shining('mall:signs:' + p.seed, sg.texture, 1.6), top = H - K.fascia;
  const kinds = R.shuffle(['office', 'office', 'blinds', 'window', 'shutter', 'half', 'hoarding', 'door', 'office']), openAt = R.int(0, 8);
  let n = 0;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++, n++) {
    const a = x0(i), b = z0(j), kind = n === openAt ? 'open' : kinds[n], alt = R.pick(['blinds', 'shutter', 'office', 'window']);
    wrap(a, b, a + bw, b + bd, 0, top, (s) => ({ batch: fronts, uv: art.uv(s === (n % 4) ? kind : s % 2 ? alt : kind) }));
    wrap(a - 0.02, b - 0.02, a + bw + 0.02, b + bd + 0.02, top, H, (s) => ({ batch: signs, uv: sg.uv((n + s * 3) % 8) }));
    c.solid(a, b, a + bw, b + bd, { tall: true });
    if (n === openAt) c.light(a + bw / 2, 1.6, b + bd + 0.5, '#ffe9a8', 0.7, { k: 1.4, far: 5 });
    else if (n % 3 === 0) c.light(a + bw / 2, H - 0.4, b - 0.4, ['#ff9d5c', '#ff6fa8', '#9fe8c8'][n / 3 | 0], 0.5, { k: 1.6, far: 4.5 });
  }
  /* shutters down across some of the ways between units (never the way round the outside) */
  const shutter = c.mapped('concourse:shutter', kit.tex.custom('concourse:shutter', 32, 64, (g, w, h) => { for (let y = 0; y < h; y += 4) { P(g, '#8d8f8c', 0, y, w, 3); P(g, '#5e605e', 0, y + 3, w, 1); } P(g, '#3a3c3a', 0, h - 4, w, 4); P(g, '#c9a43a', 14, h - 9, 4, 3); }));
  const ways = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) ways.push([x0(i) + bw, z0(j) + bd / 2, x0(i) + bw + K.aisle, z0(j) + bd / 2]);            // across an aisle that runs in z
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) ways.push([x0(i) + bw / 2, z0(j) + bd, x0(i) + bw / 2, z0(j) + bd + K.aisle]);
  for (const [ax, az, bx, bz] of R.shuffle(ways).slice(0, K.shut)) {
    const half = R.chance(0.3), y0 = half ? 1.35 : 0;                                                    // (one in three stopped part way: under it, stooping)
    upright(shutter, ax, az, bx, bz, y0, top, [0, 0, Math.hypot(bx - ax, bz - az) / 0.8, (top - y0) / 1.6]); upright(shutter, bx, bz, ax, az, y0, top, [0, 0, Math.hypot(bx - ax, bz - az) / 0.8, (top - y0) / 1.6]);
    if (!half) c.solid(Math.min(ax, bx) - 0.03, Math.min(az, bz) - 0.03, Math.max(ax, bx) + 0.03, Math.max(az, bz) + 0.03, { tall: true });
  }
  /* what a concourse has: plants in the corners, and a board that says where you are */
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (R.chance(0.75)) c.prop('planttall', sx * (W / 2 - 0.45), sz * (D / 2 - 0.45), { rot: R.range(0, 6), tint: [0.8, 0.66, 0.42], o: { variant: R.int(0, 3) } });
  const board = c.shining('concourse:here', kit.tex.custom('concourse:here', 64, 96, (g, w, h) => {
    P(g, '#1a1612', 0, 0, w, h); P(g, '#f1ead6', 3, 3, w - 6, h - 6);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { P(g, '#cdbf9f', 10 + i * 16, 14 + j * 16, 11, 11); P(g, '#b3261e', 14 + i * 16, 18 + j * 16, 3, 3); }                // every unit: you are here
    P(g, '#b3261e', 8, 70, 48, 3); P(g, '#2a1f16', 10, 78, 44, 3); P(g, '#2a1f16', 10, 84, 30, 3);
  }), 1.2);
  { const bx = x0(1) + bw + K.aisle / 2, bz = z0(1) + bd + K.aisle / 2; for (const [ax, az, ex, ez] of [[bx - 0.3, bz + 0.03, bx + 0.3, bz + 0.03], [bx + 0.3, bz - 0.03, bx - 0.3, bz - 0.03]]) upright(board, ax, az, ex, ez, 0.75, 1.65, [0, 0, 1, 1]); c.flat.box(bx - 0.04, 0, bz - 0.03, bx + 0.04, 0.75, bz + 0.03, [0.3, 0.24, 0.18]); c.solid(bx - 0.3, bz - 0.05, bx + 0.3, bz + 0.05); }
  void FRONTS;
}
