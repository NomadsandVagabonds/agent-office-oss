// The Backrooms — a shop of the shopping centre (themes.js `mall`): Photo of
// You ("the row of photo booths"). Somebody was told that in a shopping
// centre there are little booths with a curtain where you sit and it takes
// your picture, four of them, on a strip. So: a hall of them, both sides, and
// along the back wall two rows, the upper row with nothing to climb to it.
// Walk past one and it takes your picture, with a flash that is the whole
// room's light. The strips are pinned up everywhere. They are of the room,
// four times, and in each of the four something is nearer.
import { P } from '../bits.js';
import { upright } from '../suburb.js';
import { mallNeon, shoeVox, dummyVox, wallFace } from '../mall.js';

// w, d, h: a booth · pass: how near its front a visitor has to come · rest: seconds before it will take another
export const BOOTHS = Object.freeze({ w: 1.15, d: 0.95, h: 2.1, pass: 0.75, rest: 5, flash: 0.16 });
const BODIES = [[0.86, 0.82, 0.72], [0.72, 0.18, 0.14], [0.2, 0.36, 0.5], [0.86, 0.82, 0.72]];

/** A strip: four frames, the room behind, and in each the one who is coming, nearer. The last frame: the back of a head. */
function strips(g, w, h) {
  P(g, '#f4efe0', 0, 0, w, h);
  for (let s = 0; s < 6; s++) {
    const x0 = 4 + s * 21;
    for (let f = 0; f < 4; f++) {
      const y0 = 4 + f * 30, k = 0.25 + f * 0.25;
      P(g, '#3a3438', x0, y0, 17, 26); P(g, '#4a444a', x0, y0, 17, 9); for (let i = 0; i < 17; i += 3) P(g, '#2e292d', x0 + i, y0 + 9, 1, 17);              // the curtain, behind
      const cx = x0 + 8.5 + ((s * 3 + f) % 3 - 1) * (1 - k) * 3, hr = 2 + k * 5, top = y0 + 26 - k * 22;
      g.fillStyle = '#16131a'; g.beginPath(); g.ellipse(cx, top + hr, hr, hr * 1.15, 0, 0, 7); g.fill(); P(g, '#16131a', cx - hr * 1.5, top + hr * 2, hr * 3, Math.max(0, y0 + 26 - (top + hr * 2)));
      if (f === 3 && s % 2 === 0) { P(g, '#f4efe0', cx - 1.2, top + hr * 0.8, 1, 1); P(g, '#f4efe0', cx + 0.6, top + hr * 0.8, 1, 1); }                         // on some of them it has turned round, and has no face to speak of
      P(g, 'rgba(255,240,220,0.08)', x0, y0, 17, 3);
    }
  }
}

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = BOOTHS, env = c.env;
  c.shell({ panels: false });
  const curtain = c.mapped('booths:curtain', kit.tex.custom('booths:curtain', 32, 64, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 0.5 + 0.5 * Math.sin(x * 0.8); P(g, `rgb(${70 + v * 40 | 0},${18 + v * 10 | 0},${24 + v * 12 | 0})`, x, 0, 1, h); } P(g, '#c9a43a', 0, 0, w, 3); for (let x = 2; x < w; x += 6) P(g, '#8a7a3a', x, 0, 2, 4); }));
  const strip = c.mapped('booths:strips', kit.tex.custom('booths:strips', 132, 128, strips));
  const neon = mallNeon(kit, 'booths:' + p.seed, ['PHOTOS', 'PHOTO OF YOU', '4 FOR', 'SMILE', 'DONT SMILE', 'AGAIN', 'NEXT', 'STAY STILL'], p.seed), lit = c.shining('mall:neon:booths:' + p.seed, neon.texture, 2.4);
  const inside = c.shining('booths:inside', kit.tex.custom('booths:inside', 16, 16, (g, w, h) => { P(g, '#cfd6dc', 0, 0, w, h); P(g, '#e8eef2', 2, 2, w - 4, h - 4); }), 1.5, [0.9, 0.95, 1.0]);
  const booths = [];
  /** A booth against a wall, its open front toward the room: body, seat, curtain part drawn, a lit top, the slot and a strip in it. */
  const booth = (side, at, y, n) => {
    const a = at - K.w / 2, b = at + K.w / 2, body = BODIES[n % 4], dk = body.map((v) => v * 0.7), top = y + K.h;
    const box = (s0, s1, y0, y1, d0, d1, rgb, batch = c.flat) => { const p0 = c.wallAt(side, s0, d0), p1 = c.wallAt(side, s1, d1); batch.box(Math.min(p0.x, p1.x), y0, Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), y1, Math.max(p0.z, p1.z), rgb); };
    box(a, a + 0.06, y, top, 0, K.d, body); box(b - 0.06, b, y, top, 0, K.d, body); box(a, b, top - 0.08, top + 0.04, 0, K.d, dk); box(a, b, y, y + 0.06, 0, K.d, dk);         // sides, roof, floor
    box(a + 0.06, b - 0.06, y, top, 0, 0.04, dk.map((v) => v * 0.6)); box(a + 0.1, b - 0.1, y + 0.6, top - 0.15, 0.04, 0.05, [1, 1, 1], inside);                    // the back of it, inside: lit, for the picture
    box(a + 0.25, b - 0.25, y + 0.45, y + 0.52, 0.12, 0.5, [0.3, 0.3, 0.32]); box(at - 0.04, at + 0.04, y + 0.06, y + 0.45, 0.25, 0.33, [0.6, 0.62, 0.65]);              // the stool
    box(a + 0.2, b - 0.2, y + 1.15, y + 1.45, 0.02, 0.08, [0.08, 0.08, 0.1]); box(a + 0.42, b - 0.42, y + 1.27, y + 1.33, 0.07, 0.09, [0.4, 0.6, 0.9]);                 // the glass it looks out of, at you
    const open = c.R.range(0.35, 0.65), cx = a + (b - a) * open;                                                                                                          // the curtain, drawn to here
    wallFace(c, side, a + 0.06, cx, y + 0.42, top - 0.1, curtain, [0, 0, (cx - a) / 0.35, 1], K.d - 0.02); wallFace(c, side, cx, a + 0.06, y + 0.42, top - 0.1, curtain, [0, 0, (cx - a) / 0.35, 1], K.d - 0.03);
    box(a, b, top + 0.04, top + 0.44, K.d - 0.1, K.d - 0.04, [0.1, 0.1, 0.12]); wallFace(c, side, a + 0.05, b - 0.05, top + 0.07, top + 0.41, lit, neon.uv(n % 8), K.d - 0.03);
    box(b + 0.0, b + 0.16, y + 0.9, y + 1.6, K.d - 0.5, K.d - 0.1, body); box(b + 0.03, b + 0.13, y + 1.0, y + 1.35, K.d - 0.09, K.d - 0.08, [0.95, 0.93, 0.88]);       // the slot, and a strip in it
    const f0 = c.wallAt(side, a, 0), f1 = c.wallAt(side, b + 0.16, K.d);
    if (y < 0.1) c.solid(Math.min(f0.x, f1.x), Math.min(f0.z, f1.z), Math.max(f0.x, f1.x), Math.max(f0.z, f1.z), { tall: true });
    const front = c.wallAt(side, at, K.d + 0.35);
    if (y < 0.1 && c.R.chance(0.3)) { for (const dz of [-0.09, 0.09]) { const q = c.wallAt(side, at + dz, K.d - 0.3); c.model('mall:shoe:' + (n % 5), shoeVox(['#3a2a1c', '#17171a', '#7a3a34', '#c9b08a', '#2a4a6a'][n % 5]), q.x, q.z, { y: y + 0.06, scale: 1.3, rot: Math.atan2(-q.n[0], -q.n[2]) + Math.PI / 2, solid: false, shadow: false }); } }   // somebody's feet, under the curtain; nobody above them
    booths.push({ x: front.x, z: front.z, y, last: -99 });
  };
  /* both long walls, and the back wall in two rows; the ways in left clear */
  let n = 0;
  for (const side of ['back', 'front']) for (const [a, b] of c.spans(side, 0.25, 2.3)) { const m = Math.floor((b - a) / (K.w + 0.3)); for (let i = 0; i < m; i++, n++) booth(side, a + (b - a - m * (K.w + 0.3)) / 2 + (i + 0.5) * (K.w + 0.3), 0, n); }
  if (H >= 4.3) for (const [a, b] of c.spans('back', 0.25, 4.3)) { const m = Math.floor((b - a) / (K.w + 0.3)); for (let i = 0; i < m; i++, n++) booth('back', a + (b - a - m * (K.w + 0.3)) / 2 + (i + 0.5) * (K.w + 0.3), K.h + 0.55, n); }
  // a ladder to the upper row, which stops short of it
  if (H >= 4.3) { const q = c.wallAt('back', c.R.range(-W / 4, W / 4), K.d + 0.15); for (const dx of [-0.22, 0.22]) c.flat.box(q.x + dx - 0.03, 0, q.z - 0.03, q.x + dx + 0.03, 1.9, q.z + 0.03, [0.7, 0.72, 0.75]); for (let y = 0.3; y < 1.9; y += 0.3) c.flat.box(q.x - 0.22, y - 0.02, q.z - 0.02, q.x + 0.22, y + 0.02, q.z + 0.02, [0.7, 0.72, 0.75]); }
  /* the strips, pinned up on what wall is left, in rows */
  for (const side of ['left', 'right']) for (const [a, b] of c.spans(side, 0.2, 2.2)) for (let s = a + 0.1; s + 0.2 < b; s += 0.27) for (let y = 0.75; y + 0.8 < H - 0.4; y += 0.9) { if (c.R.chance(0.2)) continue; const k = c.R.int(0, 5), u0 = (4 + k * 21) / 132, tilt = c.R.range(-0.05, 0.05), dx = c.R.range(-0.03, 0.03); wallFace(c, side, s + dx, s + dx + 0.2, y + tilt, y + 0.8 + tilt, strip, [u0, 1 - 124 / 128, u0 + 17 / 132, 1 - 4 / 128], 0.01 + c.R.range(0, 0.004)); }   // one strip to a pin
  c.light(0, H - 0.6, 0, '#ffe9c2', 0.5, { k: 1.4, far: 6 });
  /* the one in the middle: somebody who has been waiting their turn a long time */
  c.model('booths:waiting', dummyVox(0, '#39424f'), c.R.range(-W / 4, W / 4), c.R.range(-0.4, 0.4), { rot: Math.PI / 2, solid: true });
  /* walk past, and it takes you */
  let flash = 0, clock = 0, before = 1;                                      // (what the room's light was before the flash: put back, not switched on)
  c.tick((dt, t, me) => {
    clock += dt;
    if (flash > 0) { flash -= dt; if (flash <= 0) c.world.setLights(c.rt, before); }
    if (!me.inside || env.player?.me?.frozen) return;
    for (const b of booths) {
      if (b.y > 0.1 || clock - b.last < K.rest) continue;
      if (Math.hypot(me.x - b.x, me.z - b.z) < K.pass) { b.last = clock; if (flash <= 0) before = c.rt.lightsK ?? 1; flash = K.flash; c.world.setLights(c.rt, Math.max(before, 0.3) * 4); env.interfere?.(0.25); const w = c.toWorld(b.x, b.z); env.play?.('click', w.x, w.z, 6);
        // …and one of the ones up there takes you too, a moment later, though there is nobody up there to
        const up = booths.filter((q) => q.y > 0.1); if (up.length) { const q = up[(clock * 7 | 0) % up.length]; q.last = clock; setTimeout?.(() => { const w2 = c.toWorld(q.x, q.z); env.play?.('click', w2.x, w2.z, 9); }, 700); }
        break; }
    }
  });
}
