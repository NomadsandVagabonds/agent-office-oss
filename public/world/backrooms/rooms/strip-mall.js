// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The
// Parade ("the shops with the shops inside"). Three shop fronts across the
// room, named after what the office is working on. The middle one has a
// door. Inside it is the same three shops, smaller, and in the door of the
// middle one of those, the same three again.
import { ticks } from '../kit.js';
import { P } from '../bits.js';
import { lawn, upright, daylight, garble, WHITEWASH } from '../suburb.js';

export function build(c) {
  const { W, D, H, params: p, kit } = c;
  c.shell({ panels: false });
  daylight(c, 4, 2, 1, 1);
  lawn(c, { wrong: 0, paint: 'sky', width: 0.4, cloudTop: H - 0.8, neighbour: 0 });
  const wide = Math.min(W - 2.8, 13.5), fh = 2.7, zf = -D / 2 + 3.4, half = wide / 2, dw = 0.5, TW = 540, TH = 108;
  // The parade, as remembered by something that had only seen pictures of one. Everything a shop front has is here, and
  // nearly right: the lettering is almost lettering, the things in the windows are almost things, a door turns into a
  // window part of the way up, and here and there a piece of the picture has been used twice.
  const art = kit.tex.custom('parade:2:' + p.shops.join('|'), TW, TH, (g, w, h) => {
    const cols = ['#a8322a', '#1f6b4a', '#2b477a'], pale = ['#f1d9a8', '#f4f1e4', '#e8d9a0'], u = w / 3;
    let k = (p.shops.join('').length * 7919 + 13) >>> 0; const r = () => { k = (Math.imul(k, 1664525) + 1013904223) >>> 0; return k / 4294967296; };
    for (let i = 0; i < 3; i++) {
      const x = i * u, mid = x + u / 2, door = i === 1 ? mid : x + (i ? u - 34 : 30);
      // the wall: courses of something
      P(g, '#cfc8b4', x, 0, u, h); for (let y = 30; y < h; y += 6) { P(g, '#b8b09b', x, y, u, 1); for (let bx = x + ((y / 6) % 2 ? 0 : 7); bx < x + u; bx += 14) P(g, '#b8b09b', bx, y, 1, 6); }
      // the sign: its name, nearly, and the start of its name again; a mark that means nothing
      P(g, cols[i], x + 3, 4, u - 6, 22); P(g, '#00000030', x + 3, 23, u - 6, 3);
      g.fillStyle = pale[i]; g.beginPath(); g.arc(x + 16, 15, 7, 0.6, 5.2); g.lineTo(x + 16, 15); g.fill(); g.beginPath(); g.arc(x + 21, 12, 4, 0, 7); g.fill();
      garble(g, p.shops[i] + ' ' + p.shops[i].slice(0, 3), x + 28, 4, u - 34, 22, { color: pale[i], size: 15, mess: 0.4 }, i * 31 + p.shops[i].length);
      if (i === 0) for (let ax = x + 3; ax < x + u - 3; ax += 10) { P(g, '#a8322a', ax, 27, 5, 9); P(g, '#f4f1e4', ax + 5, 27, 5, 9 - ((ax / 10) % 3)); }
      // the window: glass, shelves, and what is on them
      const wx = i === 1 ? x + 10 : door < mid ? x + 56 : x + 10, ww = i === 1 ? u - 20 : u - 66, wy = 40, wh = 46;
      const gl = g.createLinearGradient(0, wy, 0, wy + wh); gl.addColorStop(0, '#9fb6c2'); gl.addColorStop(1, '#6f8794'); g.fillStyle = gl; g.fillRect(wx, wy, ww, wh);
      for (const sy of [wy + 16, wy + 32]) { P(g, '#4d5b63', wx, sy, ww, 1); for (let bx = wx + 4; bx < wx + ww - 6; ) { const bw = 3 + Math.floor(r() * 5), bh = 5 + Math.floor(r() * 9), c2 = ['#d9b25a', '#c96a5a', '#e9e3cf', '#5f8f6a', '#7a6aa8'][Math.floor(r() * 5)]; P(g, c2, bx, sy - bh, bw, bh); if (r() < 0.6) P(g, '#2f3a40', bx + 1, sy - bh - 2, Math.max(1, bw - 2), 2); bx += bw + (r() < 0.25 ? -1 : 1 + Math.floor(r() * 3)); } }
      // somebody in the window: the right parts, counted wrong
      { const mx = wx + ww - 16; g.fillStyle = '#e9e3cf'; g.beginPath(); g.ellipse(mx, wy + 12, 3.5, 4.5, 0, 0, 7); g.fill(); if (i !== 1) { g.beginPath(); g.ellipse(mx + 5, wy + 13, 3, 4, 0, 0, 7); g.fill(); }
        P(g, '#e9e3cf', mx - 4, wy + 17, 8, 16); g.strokeStyle = '#e9e3cf'; g.lineWidth = 2; for (const [ax, ay] of [[-10, 28], [10, 26], [12, 16], [-9, 14]].slice(0, 3 + (i % 2))) { g.beginPath(); g.moveTo(mx, wy + 19); g.lineTo(mx + ax, wy + ay); g.stroke(); } P(g, '#4d5b63', mx - 1, wy + 33, 2, wh - 33); }
      g.fillStyle = '#ffffff30'; g.beginPath(); g.moveTo(wx + 8, wy); g.lineTo(wx + 20, wy); g.lineTo(wx + 6, wy + wh); g.lineTo(wx, wy + wh); g.fill();
      P(g, '#5d6a70', wx - 2, wy - 2, ww + 4, 2); P(g, '#5d6a70', wx - 2, wy + wh, ww + 4, 2); P(g, '#5d6a70', wx - 2, wy, 2, wh); P(g, '#5d6a70', wx + ww, wy, 2, wh);
      // what is on offer
      P(g, '#f4f1e4', wx + 26, wy + 3, 44, 12); garble(g, p.offers[i], wx + 26, wy + 3, 44, 12, { color: '#b3261e', size: 8, mess: 0.55 }, i * 17 + 5);
      P(g, '#f2c230', wx + 30, wy + 34, 22, 9); garble(g, ['9.9.9', '%0%', '2 4 1'][i], wx + 30, wy + 34, 22, 9, { color: '#1d1c1a', size: 7, mess: 0.3 }, i + 3);
      // the door (the middle one's is a hole, cut afterwards): a painted one is a door as far up as somebody remembered
      if (i !== 1) { const dx = door - 13; P(g, '#5d6a70', dx - 2, 34, 30, h - 34); P(g, '#27323a', dx, 36, 26, h - 36); P(g, '#3b4a54', dx + 3, 39, 20, i ? 26 : 50);
        if (i === 2) { P(g, '#6f8794', dx, 36, 26, 22); P(g, '#4d5b63', dx, 50, 26, 1); P(g, '#d9b25a', dx + 4, 43, 4, 7); P(g, '#c96a5a', dx + 11, 45, 5, 5); }
        P(g, '#c9c5b5', dx + (i ? 2 : 21), i ? 70 : 44, 3, 9); if (i === 2) P(g, '#c9c5b5', dx + 21, 78, 3, 9);
        P(g, '#f4f1e4', dx + 6, 62, 14, 8); garble(g, i ? 'OPEN' : 'CLOSD', dx + 6, 62, 14, 8, { color: '#1f6b4a', size: 6, mess: 0.6 }, i + 9); }
      for (let ty = 0; ty < 4; ty++) garble(g, ['MON-FRI', 'ALWAYS', 'NEVER', 'SUN SUN'][ty], x + u - 30, 90 + ty * 4, 26, 4, { color: '#4d5b63', size: 5, mess: 0.7 }, ty + i);
      P(g, '#8f8a78', x, h - 5, u, 5); P(g, '#77756a', x + u - 1, 0, 1, h);
    }
    // pieces of the picture, used twice: a strip of window a little along from where it belongs, a sign that goes on into the next
    g.drawImage(g.canvas, 70, 40, 26, 46, 104, 42, 22, 46); g.drawImage(g.canvas, u * 2 + 40, 4, 40, 22, u * 2 - 22, 6, 40, 20); g.drawImage(g.canvas, u + 30, 56, 30, 30, u + 150, 70, 34, 30);
    g.clearRect(w / 2 - (dw / wide) * w, h - (2.0 / fh) * h, 2 * (dw / wide) * w, (2.0 / fh) * h);
  }, { clamp: true });
  const shop = c.mapped('parade', art, { cutout: true }), full = [0, 0, 1, 1];
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
}
