// The Backrooms — a shop of the shopping centre (themes.js `mall`): Mens
// Ladies ("the department store"). Somebody was told that in a shopping
// centre there is a great shop of clothes, with rails, and dummies dressed
// in them, and little rooms with a curtain where you try them on. They were
// told this by people who wore office clothes. So the rails are all jackets
// and blouses in the colours of carpet tile; the dummies are dressed for a
// meeting, and are having one, round a table, about a flipchart that says
// nothing; the little rooms go along the back, behind a partition, more of
// them than the wall is long. In the last one the curtain is open, and the
// glass in it shows the passage you came down, with somebody stood in it
// where you are.
import { P } from '../bits.js';
import { Vox, M } from '../../vox/vox.js';
import { upright, sheet, garble } from '../suburb.js';
import { mallNeon, dummyVox, wallFace, wallBox } from '../mall.js';

// fitting: the passage and the rooms along the back, how deep each · rail: a rail's length · aisle: between rows of rails
export const STORE = Object.freeze({ cubicle: 1.15, cubeW: 1.0, passage: 1.3, rail: 1.8, aisle: 1.5, gw: 0.46 });
const CLOTH = [[0.3, 0.34, 0.4], [0.42, 0.36, 0.3], [0.56, 0.52, 0.46], [0.24, 0.26, 0.3], [0.62, 0.58, 0.5], [0.46, 0.2, 0.18], [0.3, 0.4, 0.34]];

/** A flipchart on its easel: a pad, and on it a line that goes up, and a line that goes down, and no words. */
function flipVox() { const v = new Vox(), m = M('#8d949c', 0); v.tube(-8, 0, -4, -6, 60, 0, 0.7, m); v.tube(8, 0, -4, 6, 60, 0, 0.7, m); v.tube(0, 0, 6, 0, 56, 0, 0.7, m); v.box(-10, 34, 0, 10, 62, 1, M('#f6f3e8', 0)); v.box(-10, 61, -1, 10, 63, 2, M('#2a2f36', 0)); for (let x = -8; x < 8; x++) v.set(x, 40 + Math.round(Math.abs(x) * 1.4 - (x > 0 ? x * 2.4 : 0)), 2, M('#b3261e', 0)); return v; }
/** A bottle of scent, on the glass: what it is called is a word nobody knows. */
function bottleVox(c) { return () => { const v = new Vox(); v.rbox(-2, 0, -2, 2, 5, 2, 1, M(c, 0)); v.box(-1, 5, -1, 1, 7, 1, M('#c9a43a', 0)); return v; }; }

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = STORE, env = c.env;
  c.shell({ panels: false, wallAlb: [0.68, 0.64, 0.6] });
  const neon = mallNeon(kit, 'store:' + p.seed, ['MENS', 'LADIES', 'MENS LADIES', 'FITTING ROOMS', 'SALE', 'NEW SEASON', 'SEASON', 'TRY ME'], p.seed), lit = c.shining('mall:neon:store:' + p.seed, neon.texture, 2.4);

  /* the fitting rooms: a partition across the back with a way in at one end, a passage behind it, little rooms along the back wall */
  const zP = -D / 2 + K.cubicle + K.passage, way = R.pick([-1, 1]), gap0 = way < 0 ? -W / 2 + 0.6 : W / 2 - 1.8, gap1 = gap0 + 1.2;
  const part = [0.78, 0.74, 0.66];
  for (const [a, b] of [[-W / 2, gap0], [gap1, W / 2]]) if (b - a > 0.05) { c.flat.box(a, 0, zP - 0.06, b, 2.3, zP + 0.06, part); c.flat.box(a, 2.3, zP - 0.08, b, 2.38, zP + 0.08, [0.66, 0.52, 0.2]); c.solid(a, zP - 0.08, b, zP + 0.08, { tall: true }); }
  upright(lit, gap0 - 0.2, zP + 0.1, gap1 + 0.2, zP + 0.1, 2.4, 2.9, neon.uv(3)); c.flat.box(gap0 - 0.2, 2.38, zP + 0.02, gap1 + 0.2, 2.92, zP + 0.08, [0.1, 0.1, 0.12]);
  const curtain = c.mapped('store:curtain', kit.tex.custom('store:curtain', 32, 64, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 0.5 + 0.5 * Math.sin(x * 0.9); P(g, `rgb(${120 + v * 40 | 0},${104 + v * 34 | 0},${86 + v * 28 | 0})`, x, 0, 1, h); } P(g, '#8d949c', 0, 0, w, 3); }));
  const zc = -D / 2 + K.cubicle, n = Math.floor((W - 0.2) / K.cubeW), last = way < 0 ? n - 1 : 0;
  for (let i = 0; i < n; i++) {
    const x0 = -W / 2 + 0.1 + i * K.cubeW, x1 = x0 + K.cubeW, m = (x0 + x1) / 2;
    c.flat.box(x0, 0, -D / 2, x0 + 0.05, 2.2, zc, part); if (i === n - 1) c.flat.box(x1 - 0.05, 0, -D / 2, x1, 2.2, zc, part);
    c.flat.box(x0 + 0.1, 0.45, -D / 2 + 0.05, x1 - 0.1, 0.5, -D / 2 + 0.4, [0.5, 0.4, 0.3]); c.flat.box(x0 + 0.15, 1.7, -D / 2 + 0.04, x0 + 0.25, 1.78, -D / 2 + 0.12, [0.66, 0.52, 0.2]);   // a bench, a hook
    if (i === last) {                                                                                                                                    // the last one: open, and the glass in it
      const glass = c.shining('store:glass', kit.tex.custom('store:glass', 64, 128, (g, w, h) => {
        P(g, '#4a4640', 0, 0, w, h); for (let k = 0; k < 6; k++) { const s = 1 - k * 0.15, x0g = w / 2 - w * s / 2, y0g = h / 2 - h * s / 2; g.strokeStyle = k % 2 ? '#6a6458' : '#8a8374'; g.lineWidth = 2; g.strokeRect(x0g, y0g, w * s, h * s); }   // the passage, going on, in the glass
        P(g, '#2a2620', w / 2 - 6, h * 0.62, 12, 6); g.fillStyle = '#16131a'; g.beginPath(); g.ellipse(w / 2, h * 0.36, 7, 8, 0, 0, 7); g.fill(); P(g, '#16131a', w / 2 - 11, h * 0.43, 22, h * 0.42);   // and somebody in it, where you stand
        P(g, 'rgba(255,255,255,0.08)', 0, 0, w, 10); P(g, '#c9a43a', 0, 0, w, 2); P(g, '#c9a43a', 0, h - 2, w, 2);
      }), 0.9);
      upright(glass, x0 + 0.12, -D / 2 + 0.03, x1 - 0.12, -D / 2 + 0.03, 0.15, 2.05, [0, 0, 1, 1]);
    } else {
      const shut = R.range(0.55, 0.95), cx = x0 + 0.05 + (K.cubeW - 0.1) * shut;
      upright(curtain, x0 + 0.05, zc, cx, zc, 0.3, 2.1, [0, 0, shut * 3, 1]); upright(curtain, cx, zc - 0.005, x0 + 0.05, zc - 0.005, 0.3, 2.1, [0, 0, shut * 3, 1]);
      c.flat.box(x0, 2.1, zc - 0.02, x1, 2.13, zc + 0.02, [0.55, 0.57, 0.6]);
    }
    c.solid(x0, -D / 2, x1, zc - 0.05, { tall: true });
  }
  c.light(0, 2.0, (zc + zP) / 2, '#ffe9c2', 0.5, { k: 1.6, far: 4 });

  /* the rails, in rows, with what is on them */
  const zA = zP + 1.3, zB = D / 2 - 1.2;
  let k = 0;
  for (let z = zA; z <= zB; z += K.aisle + 0.6) for (let x = -W / 2 + 1.4; x + K.rail <= W / 2 - 0.9; x += K.rail + K.aisle) {
    if (Math.abs(z) < 1.2 && (x < -W / 2 + 2.6 || x + K.rail > W / 2 - 2.6)) continue;                                                  // (the ways in at the sides)
    if (z > D / 2 - 2.4 && Math.abs(x + K.rail / 2) < 1.6) continue;
    if (k === 2 || k === 5) { k++; continue; }                                                                                            // (room for the meeting)
    const chrome = [0.72, 0.74, 0.78];
    for (const xe of [x, x + K.rail]) { c.flat.box(xe - 0.025, 0, z - 0.25, xe + 0.025, 0.04, z + 0.25, chrome); c.flat.box(xe - 0.02, 0, z - 0.02, xe + 0.02, 1.55, z + 0.02, chrome); }
    c.flat.box(x, 1.52, z - 0.015, x + K.rail, 1.56, z + 0.015, chrome);
    for (let g = x + 0.12; g < x + K.rail - 0.08; g += 0.14) { const ci = (((k * 3 + Math.round(g * 9)) % CLOTH.length) + CLOTH.length) % CLOTH.length, hex = '#' + CLOTH[ci].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
      // a jacket, side on, on its hanger: body, shoulders, sleeves, the shirt showing at the front. (Boxes, not voxels: there are a hundred of them)
      const col = CLOTH[ci].map((v) => v * R.range(0.88, 1.08)), dk = col.map((v) => v * 0.78), jz = z + R.range(-0.03, 0.03), hw = 0.2, f = c.flat; void hex;
      f.box(g - 0.018, 0.84, jz - hw, g + 0.018, 1.44, jz + hw, col); f.box(g - 0.022, 1.36, jz - hw - 0.03, g + 0.022, 1.46, jz + hw + 0.03, col);
      for (const sz of [-1, 1]) f.box(g - 0.03, 0.98, jz + sz * hw - 0.03, g + 0.03, 1.4, jz + sz * hw + 0.03, dk);
      f.box(g + 0.018, 1.2, jz - 0.05, g + 0.024, 1.44, jz + 0.05, [0.9, 0.88, 0.82]); f.box(g - 0.006, 1.46, jz - 0.15, g + 0.006, 1.48, jz + 0.15, [0.6, 0.62, 0.65]); }
    c.solid(x - 0.05, z - 0.28, x + K.rail + 0.05, z + 0.28, { tall: false });
    k++;
  }
  /* the meeting: a table, its dummies dressed for it, the flipchart */
  { const mx = R.range(-1, 1), mz = (zA + zB) / 2 + R.range(-0.4, 0.4), dress = ['#2a2f36', '#39424f', '#4a4038', '#2a2f36', '#5a4a3a'];
    c.flat.box(mx - 1.0, 0.72, mz - 0.5, mx + 1.0, 0.76, mz + 0.5, [0.5, 0.36, 0.22]); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.flat.box(mx + sx * 0.9 - 0.03, 0, mz + sz * 0.42 - 0.03, mx + sx * 0.9 + 0.03, 0.72, mz + sz * 0.42 + 0.03, [0.3, 0.3, 0.32]);
    c.solid(mx - 1.0, mz - 0.5, mx + 1.0, mz + 0.5, { tall: false });
    [[-1.4, 0], [1.4, 0], [-0.5, -0.85], [0.5, -0.85], [0, 0.85]].forEach(([dx, dz], i) => { const x = mx + dx, z = mz + dz; c.model('store:dummy:' + i + (i === 4 ? ':o' : ''), dummyVox(i % 4, dress[i], i === 4 ? 'orange' : null), x, z, { rot: Math.atan2(mx - x, mz - z) + (i === 1 ? Math.PI : 0), solid: false }); c.solid(x - 0.2, z - 0.2, x + 0.2, z + 0.2, { tall: false }); });   // one is facing the other way
    c.model('store:flip', flipVox, mx, mz - 1.5, { scale: 1, rot: 0, solid: false }); c.solid(mx - 0.3, mz - 1.65, mx + 0.3, mz - 1.35, { tall: false });
    c.light(mx, H - 0.6, mz, '#ffe9c2', 0.8, { k: 1.4, far: 5 }); }
  /* the scent counter, by the way in; and the names, along the walls */
  { const sx = way > 0 ? -W / 2 + 1.0 : W / 2 - 1.0, sz = D / 2 - 1.0; if (c.clear(sx, sz, 0.7)) { const glassC = c.shining('store:case', kit.tex.white(), 1.2, [0.7, 0.85, 0.9]); glassC.box(sx - 0.7, 0.2, sz - 0.3, sx + 0.7, 0.95, sz + 0.3, [1, 1, 1]); c.flat.box(sx - 0.72, 0, sz - 0.32, sx + 0.72, 0.2, sz + 0.32, [0.2, 0.2, 0.22]); c.solid(sx - 0.72, sz - 0.32, sx + 0.72, sz + 0.32, { tall: false });
    for (let i = 0; i < 9; i++) c.model('store:bottle:' + (i % 3), bottleVox(['#ff3d9a', '#35e0ff', '#ffb02e'][i % 3]), sx - 0.55 + (i % 5) * 0.27, sz - 0.15 + (i > 4 ? 0.2 : 0), { y: 0.95, scale: 1.4, solid: false, shadow: false }); c.light(sx, 1.2, sz, '#ff3d9a', 0.6, { k: 1.5, far: 3 }); } }
  for (const side of ['left', 'right']) for (const [a, b] of c.spans(side, 0.4, 3.0)) if (b - a > 1.6) { const m = (a + b) / 2; wallBox(c, side, m - 0.9, m + 0.9, 2.4, 2.9, 0, 0.12, [0.1, 0.1, 0.12]); wallFace(c, side, m - 0.85, m + 0.85, 2.43, 2.87, lit, neon.uv(side === 'left' ? 0 : 1), 0.125); }
  /* SALE, on banners across the room, on strings, never ending */
  const banner = c.mapped('store:banner:' + (p.seed % 4), kit.tex.custom('store:banner:' + (p.seed % 4), 128, 32, (g, w, h) => { P(g, '#b3261e', 0, 0, w, h); P(g, '#8a1a14', 0, h - 4, w, 4); for (let x = 0; x < w; x += 8) { g.fillStyle = '#b3261e'; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 4, h + 4); g.lineTo(x + 8, h); g.fill(); }
    garble(g, ['SALE  SALE  SALE', 'SALE ENDS SOON', 'EVERYTHING MUST', 'LAST DAYS SALE'][p.seed % 4], 4, 4, w - 8, h - 10, { color: '#f6f1e2', mess: 0.3 }, p.seed); }, { clamp: true }), { cutout: true });
  for (let z = zA - 0.4; z < zB + 0.5; z += 2.4) { const y = Math.min(H - 0.5, 2.9), sag = 0.18; c.flat.box(-W / 2, y + 0.3 - 0.005, z - 0.005, W / 2, y + 0.3 + 0.005, z + 0.005, [0.2, 0.2, 0.2]);
    for (let x = -W / 2 + 0.4; x < W / 2 - 1.4; x += 1.6) { const dy = -sag * Math.sin(Math.PI * (x + W / 2) / W); upright(banner, x, z, x + 1.4, z, y + dy, y + 0.32 + dy, [0, 0, 1, 1]); upright(banner, x + 1.4, z - 0.004, x, z - 0.004, y + dy, y + 0.32 + dy, [0, 0, 1, 1]); } }
  c.light(-W / 4, H - 0.7, zB - 0.5, '#ffb02e', 0.6, { k: 1.4, far: 5 }); c.light(W / 4, H - 0.7, zA, '#35e0ff', 0.5, { k: 1.4, far: 5 });
  void env; void sheet;
}
