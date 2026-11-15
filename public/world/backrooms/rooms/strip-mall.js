// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The
// Parade ("the shops with the shops inside"). Three shop fronts across the
// room, named after what the office is working on. The middle one has a
// door. Inside it is the same three shops, smaller, and in the door of the
// middle one of those, the same three again.
import { drawText, ticks } from '../kit.js';
import { P } from '../bits.js';
import { lawn, upright, daylight, WHITEWASH } from '../suburb.js';

export function build(c) {
  const { W, D, H, params: p, kit } = c;
  c.shell({ panels: false });
  daylight(c, 4, 2, 1, 1);
  lawn(c, { wrong: 0, paint: 'sky', width: 0.4, cloudTop: H - 0.8, neighbour: 0 });
  const wide = Math.min(W - 2.8, 13.5), fh = 2.7, zf = -D / 2 + 3.4, half = wide / 2, dw = 0.5, TW = 360, TH = 72;
  const art = kit.tex.custom('parade:' + p.shops.join('|'), TW, TH, (g, w, h) => {
    const cols = ['#b3261e', '#1f6b3a', '#27406b'];
    for (let i = 0; i < 3; i++) {
      const x = i * (w / 3), u = w / 3;
      P(g, '#d9d5c6', x, 0, u, h); P(g, cols[i], x + 2, 3, u - 4, 16); drawText(g, [p.shops[i]], x + 2, 3, u - 4, 16, { color: '#f4f1e4', size: 12, pad: 8 });
      P(g, '#8fa3ad', x + 6, 24, u - 12, 34); P(g, '#a9bcc5', x + 8, 26, 20, 30); P(g, '#f4f1e4', x + u - 46, 30, 36, 14); drawText(g, [p.offers[i]], x + u - 46, 30, 36, 14, { color: '#b3261e', size: 7, pad: 3 });
      P(g, '#5d6a70', x + u / 2 - 14, 24, 28, 48); P(g, '#2a3338', x + u / 2 - 12, 26, 24, 46); P(g, '#b9b6a8', x, h - 4, u, 4); P(g, '#77756a', x + u - 1, 0, 1, h);
    }
  }, { clamp: true });
  const shop = c.mapped('parade', art), full = [0, 0, 1, 1], dz = TH * (2.0 / fh);
  // the front: two pieces, either side of the one door that is a door
  upright(shop, -half, zf, -dw, zf, 0, fh, [0, 0, 0.5 - dw / wide, 1]); upright(shop, dw, zf, half, zf, 0, fh, [0.5 + dw / wide, 0, 1, 1]); upright(shop, -dw, zf, dw, zf, 2.0, fh, [0.5 - dw / wide, 2.0 / fh, 0.5 + dw / wide, 1]);
  c.solid(-half, zf - 0.08, -dw, zf + 0.04, { tall: true, keep: true }); c.solid(dw, zf - 0.08, half, zf + 0.04, { tall: true, keep: true });
  for (const s of [-1, 1]) { c.flat.box(s * half - 0.05, 0, -D / 2, s * half + 0.05, fh, zf, WHITEWASH, { skip: '-y' }); c.solid(s * half - 0.05, -D / 2, s * half + 0.05, zf, { tall: true, keep: true }); }
  c.flat.box(-half, fh, -D / 2, half, fh + 0.05, zf + 0.5, WHITEWASH);
  // inside: board, carpet, and the parade again at a little over half the size; and again in its door
  const back = c.mapped('parade:board', kit.tex.carpet('#b8935f')), zi = zf - 0.06;
  back.grid([-half, 0, zi], [-1, 0, 0], [0, 1, 0], [0, -wide].map(Math.abs), [0, fh], (u, v) => [u / 0.8, v / 0.8]);
  { const k = 0.56, w2 = wide * k, z2 = zf - 2.0, h2 = fh * k; upright(shop, -w2 / 2, z2, w2 / 2, z2, 0, h2, full);
    c.flat.box(-half, h2, -D / 2 + 0.02, half, fh, z2, [0.03, 0.03, 0.035]); for (const s of [-1, 1]) c.flat.box(s * w2 / 2, 0, z2 - 0.02, s * half, h2, z2, [0.03, 0.03, 0.035], { skip: '-y' });
    c.solid(-half, z2 - 0.1, half, z2, { tall: true, keep: true });
    const k3 = k * 0.31, w3 = wide * k3; upright(shop, -w3 / 2, z2 + 0.004, w3 / 2, z2 + 0.004, 0, fh * k3, full, [0.8, 0.8, 0.8]); }
  // somewhere to leave a car, in front
  for (let x = -half + 0.6; x < half; x += 2.5) c.flat.box(x - 0.04, 0.013, zf + 0.6, x + 0.04, 0.016, zf + 4.0, WHITEWASH);
  c.mapped('parade:kerb', kit.tex.carpet('#8d8d88')).grid([-half, 0.012, zf], [0, 0, 1], [1, 0, 0], [0, 0.55], ticks(wide), (u, v) => [v / 0.8, u / 0.8]);
  void dz;
}
