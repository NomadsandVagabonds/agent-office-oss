// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Stop
// ("the bus stop with the queue"). A shelter, a bench, a kerb and a strip of
// road that runs from one wall to the other. A timetable of what the office
// has not done yet, every time on it DUE. A queue of colleagues, in board,
// who turn to look at you whenever you look away. No bus.
import { drawText, ticks, WHITE } from '../kit.js';
import { P, standee } from '../bits.js';
import { Vox, M } from '../../vox/vox.js';
import { garble, lawn, beam, daylight, WHITEWASH } from '../suburb.js';

/** A bus shelter: a frame of grey tube, glass behind and at the ends, a barrel roof, a bench of slats with an arm in the middle so that nobody lies on it, a bin. */
function shelterVox() {
  const v = new Vox(), k = M('#4d5560', 0), glass = M('#9fb6c2', 0), wood = M('#b8935f', 3);
  for (const x of [-52, 0, 52]) { v.tube(x, 0, 0, x, 86, 0, 1.5, k); v.tube(x, 86, 0, x, 90, 36, 1.3, k); }
  for (const y of [12, 84]) v.tube(-52, y, 0, 52, y, 0, 1.2, k);
  v.box(-51, 13, -0.5, 51, 84, 0.5, glass); for (const x of [-26, 26]) v.box(x, 13, -0.6, x + 1, 84, 0.6, k); v.box(-51, 46, 0.5, 51, 47, 0.8, M('#efe9d8', 0));
  for (const x of [-52, 52]) { v.box(x - 0.5, 13, 0, x + 0.5, 84, 22, glass); v.tube(x, 13, 22, x, 86, 22, 1, k); }
  for (let i = 0; i < 19; i++) { const z = -4 + i * 2.2, y = 90 + Math.sin((i / 18) * Math.PI) * 4; v.box(-56, y, z, 56, y + 1.4, z + 2.2, i % 2 ? M('#5d6570', 0) : k); }
  for (const z of [6, 10, 14]) v.tube(-36, 18, z, 36, 18, z, 1.1, wood); for (const z of [3]) for (const y of [24, 28]) v.tube(-36, y, z, 36, y, z, 1, wood);
  for (const x of [-34, 0, 34]) { v.tube(x, 0, 10, x, 17, 10, 1.2, k); v.tube(x, 17, 4, x, 17, 15, 1, k); v.tube(x, 17, 3, x, 29, 2, 1, k); } v.tube(0, 18, 15, 0, 24, 15, 0.9, k); v.tube(0, 24, 15, 0, 24, 5, 0.9, k);
  v.cyl('y', 67, 22, 4, 30, 6.5, M('#2f5a3a', 1)); v.cyl('y', 67, 22, 30, 32, 7.2, M('#254a2f', 1)); v.carve(63, 22, 15, 71, 27, 17); v.tube(67, 0, 22, 67, 4, 22, 1.2, k);
  return v;
}

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
  c.model('stop:shelter', shelterVox, sx, sz, { solid: false, shadow: false });
  { const tex = kit.tex.custom('stop:advert', 48, 72, (g, w, h) => { P(g, '#f1d9a8', 0, 0, w, h); P(g, '#b3261e', 0, 0, w, 16); garble(g, 'NOW ON', 0, 0, w, 16, { color: '#f4f1e4', size: 11, mess: 0.4 }, 3); g.fillStyle = '#27406b'; g.beginPath(); g.ellipse(24, 38, 14, 12, 0, 0, 7); g.fill(); g.fillStyle = '#f1d9a8'; g.beginPath(); g.ellipse(28, 35, 6, 9, 0.5, 0, 7); g.fill(); garble(g, 'ASK INSIDE', 0, 54, w, 9, { color: '#22201c', size: 7, mess: 0.6 }, 8); garble(g, 'TERMS APLY', 0, 63, w, 7, { color: '#77756a', size: 5, mess: 0.7 }, 2); }, { clamp: true });
    c.mapped('stop:advert', tex).quad([sx + 0.62, 0.55, sz + 0.03], [sx + 1.22, 0.55, sz + 0.03], [sx + 1.22, 1.45, sz + 0.03], [sx + 0.62, 1.45, sz + 0.03], WHITE); }
  c.solid(sx - 1.3, sz - 0.05, sx + 1.3, sz + 0.45); c.solid(sx + 1.5, sz + 0.35, sx + 1.86, sz + 0.75); c.reserve(sx, sz, 1.7);
  // the timetable
  { const tex = kit.tex.custom('stop:times:' + p.route + p.rows.join('|'), 96, 128, (g, w, h) => { P(g, '#f4f1e4', 0, 0, w, h); P(g, '#27406b', 0, 0, w, 22); drawText(g, [p.route], 0, 0, w, 22, { color: '#f4f1e4', size: 14 }); p.rows.forEach((row, i) => { const y = 26 + i * 20; P(g, i % 2 ? '#e7e3d3' : '#f4f1e4', 0, y, w, 20); drawText(g, [row], 2, y, w - 30, 20, { color: '#22201c', size: 7, pad: 4 }); drawText(g, ['DUE'], w - 28, y, 26, 20, { color: '#b3261e', size: 9, pad: 2 }); }); }, { clamp: true });
    const px = sx + 2.1; beam(c.flat, [px, 0, sz], [px, 2.5, sz], 0.06, [0.3, 0.33, 0.36]); c.solid(px - 0.05, sz - 0.05, px + 0.05, sz + 0.05);
    c.mapped('stop:times', tex).quad([px - 0.3, 1.1, sz + 0.035], [px + 0.3, 1.1, sz + 0.035], [px + 0.3, 1.9, sz + 0.035], [px - 0.3, 1.9, sz + 0.035], WHITE); c.flat.box(px - 0.32, 1.08, sz - 0.01, px + 0.32, 1.92, sz + 0.03, [0.3, 0.33, 0.36]); }
  // the queue (alternating slight Z stagger prevents coplanar Z-fighting where standee borders overlap)
  for (let i = 0; i < Math.min(p.queue, cast.length ? 6 : 0); i++) { const who = cast[p.who[i % p.who.length] % cast.length], x = sx + 2.9 + i * 0.7, z = sz + 0.5 + (i % 2 ? 0.028 : -0.028); if (x > W / 2 - 0.8) break; standee(c, 'who:' + who.name, who.look, x, z, 0, { name: who.name }); c.reserve(x, sz + 0.5, 0.4); }
}
