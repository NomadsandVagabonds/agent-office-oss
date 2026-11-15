// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Stop
// ("the bus stop with the queue"). A shelter, a bench, a kerb and a strip of
// road that runs from one wall to the other. A timetable of what the office
// has not done yet, every time on it DUE. A queue of colleagues, in board,
// who turn to look at you whenever you look away. No bus.
import { drawText, ticks, WHITE } from '../kit.js';
import { P, standee } from '../bits.js';
import { lawn, beam, daylight, TIMBER, WHITEWASH } from '../suburb.js';

export function build(c) {
  const { W, D, H, params: p, kit } = c, cast = c.env.cast || [];
  c.shell({ panels: false });
  daylight(c, 3, 2, 1, 1);
  lawn(c, { wrong: 0, paint: 'corn', width: 0.35, cloudTop: H - 0.6, neighbour: 0 });
  const zr = 0.6, x0 = -W / 2 + 0.02, x1 = W / 2 - 0.02;
  c.mapped('stop:road', kit.tex.carpet('#58595c')).grid([x0, 0.012, zr], [0, 0, 1], [1, 0, 0], ticks(2.2), ticks(x1 - x0), (u, v) => [(x0 + v) / 0.8, u / 0.8]);
  c.flat.box(x0, 0, zr - 0.16, x1, 0.06, zr, [0.62, 0.61, 0.57], { skip: '-y' });
  for (let x = x0 + 0.4; x < x1 - 0.8; x += 1.6) c.flat.box(x, 0.013, zr + 1.05, x + 0.8, 0.016, zr + 1.15, WHITEWASH);
  // the shelter
  const sx = -0.6, sz = -1.3;
  for (const x of [sx - 1.3, sx + 1.3]) { beam(c.flat, [x, 0, sz], [x, 2.2, sz], 0.07, [0.3, 0.33, 0.36]); c.solid(x - 0.05, sz - 0.05, x + 0.05, sz + 0.05); }
  c.flat.box(sx - 1.45, 2.2, sz - 0.15, sx + 1.45, 2.27, sz + 0.95, [0.3, 0.33, 0.36]); c.flat.box(sx - 1.3, 0.3, sz - 0.02, sx + 1.3, 2.1, sz + 0.02, [0.55, 0.62, 0.66]);
  c.flat.box(sx - 0.9, 0.42, sz + 0.1, sx + 0.9, 0.48, sz + 0.45, TIMBER); for (const x of [sx - 0.8, sx + 0.8]) c.flat.box(x - 0.03, 0, sz + 0.15, x + 0.03, 0.42, sz + 0.4, [0.3, 0.33, 0.36], { skip: '-y' });
  c.solid(sx - 1.3, sz - 0.05, sx + 1.3, sz + 0.45); c.reserve(sx, sz, 1.7);
  // the timetable
  { const tex = kit.tex.custom('stop:times:' + p.route + p.rows.join('|'), 96, 128, (g, w, h) => { P(g, '#f4f1e4', 0, 0, w, h); P(g, '#27406b', 0, 0, w, 22); drawText(g, [p.route], 0, 0, w, 22, { color: '#f4f1e4', size: 14 }); p.rows.forEach((row, i) => { const y = 26 + i * 20; P(g, i % 2 ? '#e7e3d3' : '#f4f1e4', 0, y, w, 20); drawText(g, [row], 2, y, w - 30, 20, { color: '#22201c', size: 7, pad: 4 }); drawText(g, ['DUE'], w - 28, y, 26, 20, { color: '#b3261e', size: 9, pad: 2 }); }); }, { clamp: true });
    const px = sx + 2.1; beam(c.flat, [px, 0, sz], [px, 2.5, sz], 0.06, [0.3, 0.33, 0.36]); c.solid(px - 0.05, sz - 0.05, px + 0.05, sz + 0.05);
    c.mapped('stop:times', tex).quad([px - 0.3, 1.1, sz + 0.035], [px + 0.3, 1.1, sz + 0.035], [px + 0.3, 1.9, sz + 0.035], [px - 0.3, 1.9, sz + 0.035], WHITE); c.flat.box(px - 0.32, 1.08, sz - 0.01, px + 0.32, 1.92, sz + 0.03, [0.3, 0.33, 0.36]); }
  // the queue
  for (let i = 0; i < Math.min(p.queue, cast.length ? 6 : 0); i++) { const who = cast[p.who[i % p.who.length] % cast.length], x = sx + 2.9 + i * 0.7; if (x > W / 2 - 0.8) break; standee(c, 'who:' + who.name, who.look, x, sz + 0.5, 0, { name: who.name }); c.reserve(x, sz + 0.5, 0.4); }
}
