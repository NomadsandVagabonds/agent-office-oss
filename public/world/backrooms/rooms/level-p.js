// The Backrooms — a room of the shopping centre (themes.js `mall`): Level P
// ("the car park of the one car"). Where you leave the car. It was built by
// people who had been told three things: that there is only ever one space,
// that you can never find yours, and that there are a great many levels. So
// there is one car, a great many times: in a row, as told; stacked one on
// another to the roof; in a drift in the corner where the rest were put; up
// the wall in bays that go on up the wall; on the roof, lights on. Every bay
// has the same number. The light is the yellow of a car park. WAY OUT is a
// ramp down, and it does not come to anything.
import { ticks, Batch } from '../kit.js';
import { P } from '../bits.js';
import { Vox, M, glow } from '../../vox/vox.js';
import { payVox, garble, upright, sheet } from '../suburb.js';
import { mallNeon, voidIn } from '../mall.js';

// car: its length, width and height · rise: one stacked on another · ramp: how wide, how long, how steep, how far it can be walked
export const LEVEL_P = Object.freeze({ long: 4.2, wide: 1.7, tall: 1.4, rise: 1.36, rampW: 2.2, rampL: 5.4, slope: 0.42, down: 3.2, arm: 3.0 });
const VOX = 4;                                                                  // (cut coarse: a tenth of a metre a cube. There are forty of it)

/** The one car: a saloon of about 1984, in the colour it comes in. Nose toward +x. lit: its lights are on. */
function oneCar(paint, lit) {
  return () => {
    const v = new Vox(), body = M(paint, 1), glass = M('#141a20', 0), chrome = M('#aeb3b8', 0), tyre = M('#121214', 2), head = lit ? glow('#fff2c0') : M('#d8d2b8', 0), tail = lit ? glow('#ff2a1e') : M('#7a1a14', 0);
    v.rbox(-21, 3, -8, 21, 8, 8, 1, body, 'xz'); v.box(-9, 8, -7, 10, 12, 7, glass); v.box(-10, 12, -7, 11, 13, 7, body); for (const x of [-10, 0, 10]) v.box(x, 8, -7, x + (x === 0 ? 0 : 1), 12, 7, body); v.box(-9, 8, -7, 10, 8, 7, body);
    v.box(-22, 3, -8, -22, 4, 8, chrome); v.box(22, 3, -8, 22, 4, 8, chrome); for (const z of [-7, 5]) { v.box(22, 5, z, 22, 6, z + 2, head); v.box(-22, 5, z, -22, 6, z + 2, tail); } v.box(22, 5, -3, 22, 6, 3, M('#1c1c20', 0));
    for (const x of [-13, 13]) for (const z of [-8, 7]) v.cyl('z', x, 3, z, z + 1, 3, tyre); v.box(-4, 8, 7, -3, 9, 9, body); v.box(-1, 13, -1, 0, 16, 0, chrome);
    return v;
  };
}

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = LEVEL_P;
  const conc = kit.tex.custom('levelp:wall', 64, 64, (g, w, h) => { P(g, '#77756f', 0, 0, w, h); for (let i = 0; i < 300; i++) P(g, i % 2 ? '#6c6a64' : '#827f78', (i * 37) % w, (i * 53) % h, 1 + (i % 3), 1); P(g, '#5c5a55', 0, 0, w, 1); P(g, '#5c5a55', 0, 32, w, 1); for (let i = 0; i < 6; i++) P(g, 'rgba(40,30,20,0.25)', (i * 23) % w, 0, 1 + (i % 2), 10 + (i * 7) % 30); });
  c.shell({ floor: false, panels: false, skirting: false, wallTex: conc, wallAlb: [0.7, 0.66, 0.6],
    ceilTex: kit.tex.custom('levelp:deck', 32, 32, (g, w, h) => { P(g, '#3d3c39', 0, 0, w, h); P(g, '#2c2b29', 0, 0, w, 2); P(g, '#2c2b29', 0, 0, 2, h); for (let i = 0; i < 40; i++) P(g, '#46453f', (i * 13) % w, (i * 29) % h, 2, 1); }) });
  /* WAY OUT: a ramp down along the right-hand wall toward the back, and then not */
  const rx0 = W / 2 - 0.3 - K.rampW, rx1 = W / 2 - 0.3, rzTop = -D / 2 + 0.8 + K.rampL, onRamp = (x, z) => x > rx0 && x < rx1 && z < rzTop && z > -D / 2 + 0.4;
  voidIn(c, (x, z) => onRamp(x, z) && rzTop - z > K.down, { floor: (x, z) => (onRamp(x, z) ? -Math.min(1.2, (rzTop - z) * K.slope) : 0) });
  const fl = c.mapped('levelp:floor', kit.tex.screed('#6a6b6c')), rect = (xa, xb, za, zb) => { if (xb - xa > 0.01 && zb - za > 0.01) fl.grid([xa, 0, za], [0, 0, 1], [1, 0, 0], ticks(zb - za), ticks(xb - xa), (u, v) => [(xa + v + c.room.cx) / 1.6, (za + u + c.room.cz) / 1.6]); };
  rect(-W / 2, rx0, -D / 2, D / 2); rect(rx0, W / 2, rzTop, D / 2); rect(rx1, W / 2, -D / 2, rzTop); rect(rx0, rx1, -D / 2, -D / 2 + 0.4);
  { const n = 14, black = c.mapped('levelp:void', kit.tex.custom('levelp:void', 4, 4, (g) => P(g, '#000', 0, 0, 4, 4))), k0 = [0, 0, 0], zb = -D / 2 + 0.4;
    for (let i = 0; i < n; i++) { const za = rzTop - (i + 1) * (K.rampL / n), zc = rzTop - i * (K.rampL / n), ya = -(rzTop - za) * K.slope, yc = -(rzTop - zc) * K.slope; { const k = Math.max(0.12, 0.95 - i * 0.065); sheet(fl, [rx0, ya, za], [rx0, yc, zc], [rx1, yc, zc], [rx1, ya, za], 1, 2, (s, t) => [t, s + i], [k, k, k]); sheet(fl, [rx0, ya, za], [rx1, ya, za], [rx1, yc, zc], [rx0, yc, zc], 2, 1, (s, t) => [s, t + i], [k, k, k]); } if (i % 2 === 0 && i < 8) { sheet(c.flat, [rx0 + 0.2, yc + 0.006, zc - 0.1], [rx0 + 0.2, yc + 0.006, zc], [rx1 - 0.2, yc + 0.006, zc], [rx1 - 0.2, yc + 0.006, zc - 0.1], 1, 1, null, [0.85, 0.66, 0.12]); sheet(c.flat, [rx0 + 0.2, yc + 0.006, zc - 0.1], [rx1 - 0.2, yc + 0.006, zc - 0.1], [rx1 - 0.2, yc + 0.006, zc], [rx0 + 0.2, yc + 0.006, zc], 1, 1, null, [0.85, 0.66, 0.12]); } }
    sheet(black, [rx0, -9, zb], [rx0, -9, rzTop], [rx0, 0, rzTop], [rx0, 0, zb], 1, 1, null, k0); sheet(black, [rx1, -9, rzTop], [rx1, -9, zb], [rx1, 0, zb], [rx1, 0, rzTop], 1, 1, null, k0); sheet(black, [rx0, -9, zb], [rx1, -9, zb], [rx1, 0, zb], [rx0, 0, zb], 1, 1, null, k0);
    c.flat.box(rx0 - 0.14, 0, zb, rx0, 0.22, rzTop - 0.05, [0.78, 0.6, 0.12]); c.solid(rx0 - 0.14, zb - 0.1, rx0, rzTop - 0.05, { tall: false }); c.solid(rx0, zb - 0.2, rx1, zb, { tall: false }); }

  /* the one car */
  const paint = R.pick(['#b3402e', '#c9a23a', '#5d7f8f', '#d8d2c0']), car = (x, z, o = {}) => c.model('levelp:car:' + paint + (o.lit ? ':lit' : ''), oneCar(paint, !!o.lit), x, z, { scale: VOX, solid: false, shadow: !o.y, ...o });
  const clear = (x, z, r) => !(Math.abs(z) < 1.5 + r && Math.abs(x) > W / 2 - 2.8) && !(Math.abs(x) < 1.4 + r && z > D / 2 - 2.8);       // (not in a way in)
  // …stacked: three columns of it against the back wall, each to the roof and the last one into it
  const per = Math.ceil((H - 0.5) / K.rise);
  for (const x of [-4.6, -2.2, 0.2]) { for (let k = 0; k < per; k++) car(x + (k ? R.range(-0.12, 0.12) : 0), -D / 2 + 2.5 + (k ? R.range(-0.15, 0.15) : 0), { y: k * K.rise, rot: Math.PI / 2 + (k ? R.range(-0.1, 0.1) : 0), tilt: k ? [R.range(-0.03, 0.03), R.range(-0.03, 0.03)] : [0, 0], lit: k === 2 && x > 0 }); c.solid(x - 0.95, -D / 2 + 0.3, x + 0.95, -D / 2 + 4.7, { tall: true }); }
  // …in a drift: the corner where the rest were put
  { const hx = -W / 2 + 2.6, hz = -D / 2 + 2.8; for (let i = 0; i < 11; i++) { const a = R.range(0, 6.28), d = i < 3 ? R.range(0, 0.8) : R.range(0.8, 2.4), y = Math.max(0, 3.4 - d * 1.35) + (i < 3 ? 1.2 : 0) * (i / 3); car(Math.max(-W / 2 + 1.2, hx + Math.cos(a) * d), Math.max(-D / 2 + 1.2, hz + Math.sin(a) * d), { y, rot: R.range(0, 6.28), tilt: [R.range(-0.9, 0.9), R.range(-0.7, 0.7)], lit: i === 5 }); } c.solid(-W / 2, -D / 2, hx + 2.4, hz + 2.4, { tall: true }); }
  // …up the wall, in bays that go on up it
  const lw = -W / 2 + 0.02, paintW = [0.86, 0.84, 0.74];
  for (let i = 0; i < 3; i++) { const z = 2.6 + i * 2.3; if (z > D / 2 - 1.6) break; for (const dz of [-1.1, 1.1]) c.flat.box(lw, 0, z + dz - 0.04, lw + 0.012, H, z + dz + 0.04, paintW); car(lw + 0.72, z, { y: 1.3 + i * 1.5, rot: Math.PI, tilt: [0, Math.PI / 2], lit: i === 1 }); }
  // …on the roof, lights on
  car(1.5, 1.0, { y: H - 0.02, rot: 0.3, tilt: [Math.PI, 0], lit: true }); c.light(3.4, H - 1.4, 1.6, '#fff2c0', 1.0, { k: 1.2, far: 8 });
  // …and in a row, as told: every bay the same bay
  const num = c.mapped('levelp:num:' + p.seed, kit.tex.custom('levelp:num:' + p.seed, 64, 32, (g, w, h) => { g.clearRect(0, 0, w, h); garble(g, String(p.bay), 0, 0, w, h, { color: '#e9e4d2', mess: 0.2, size: 26 }, p.seed); }, { clamp: true }), { cutout: true });
  for (let i = 0; i < 5; i++) { const x = 2.4 + i * 2.5, z = D / 2 - 2.5; if (x > W / 2 - 1.3) break; for (const dx of i ? [1.25] : [-1.25, 1.25]) c.flat.box(x + dx - 0.05, 0, D / 2 - 4.8, x + dx + 0.05, 0.006, D / 2 - 0.3, paintW, { skip: '-y' }); c.lay(num, x, D / 2 - 5.2, 0.9, 0.45, Math.PI);
    if (i === 2) { c.blot(x, z, 1.5, 3.4, { a: 0.5 }); continue; } car(x, z, { rot: -Math.PI / 2, lit: i === 0 }); c.solid(x - 0.9, z - 2.15, x + 0.9, z + 2.15, { tall: false }); }

  /* columns, banded; the machines you pay at, of which there are several and no two the same height; the barrier that works itself */
  const band = c.mapped('levelp:band', kit.tex.custom('levelp:band', 32, 64, (g, w, h) => { P(g, '#8a8b88', 0, 0, w, h); for (let y = 44; y < 60; y += 1) for (let x = 0; x < w; x++) if (((x + y) >> 3) & 1) P(g, '#d6a91f', x, y, 1, 1); else P(g, '#1c1a17', x, y, 1, 1); }));
  for (const [x, z] of [[-4, 4.6], [3.6, -1.8], [-1.2, -0.6]]) if (clear(x, z, 0.4)) c.pillar(x, z, 0.5, 0.5, { batch: band, skirting: false });
  for (let i = 0; i < 5; i++) { const x = -W / 2 + 3.2 + i * 0.75, z = 0.9 + (i % 2) * 0.25, k = [1, 0.6, 1.5, 0.8, 1.2][i]; c.model('suburb:pay', payVox, x, z, { rot: Math.PI, scale: k, solid: false }); c.solid(x - 0.25, z - 0.2, x + 0.25, z + 0.2, { tall: false }); }
  const ax = 1.2, az = 3.4, arm = new Batch(); for (let i = 0; i < 10; i++) arm.box(ax + i * (K.arm / 10), 0.92, az - 0.04, ax + (i + 1) * (K.arm / 10), 1.02, az + 0.04, i % 2 ? [0.8, 0.14, 0.1] : [0.9, 0.88, 0.8]);
  c.flat.box(ax - 0.24, 0, az - 0.12, ax, 1.05, az + 0.12, [0.82, 0.8, 0.72]); c.solid(ax - 0.24, az - 0.12, ax, az + 0.12, { tall: false });
  const g = c.dynamic(arm, { pivot: [ax, 0.97, az] }); let t0 = R.range(0, 8);
  c.tick((dt) => { t0 += dt; const ph = (t0 % 9) / 9, up = ph < 0.18 ? ph / 0.18 : ph < 0.55 ? 1 : ph < 0.73 ? 1 - (ph - 0.55) / 0.18 : 0; g.rotation.z = up * 1.45; });

  /* what it says, in tube; and the yellow it is all in */
  const neon = mallNeon(kit, 'levelp:' + p.seed, ['WAY OUT', 'LEVEL P', 'PAY HERE', String(p.bay), 'WAY OUT', 'LEVEL P', 'PAY HERE', 'YOUR CAR'], p.seed + 2), lit = c.shining('mall:neon:levelp:' + p.seed, neon.texture, 2.4);
  upright(lit, rx1, rzTop + 0.3, rx0, rzTop + 0.3, 2.3, 2.85, neon.uv(0)); upright(lit, rx0, rzTop + 0.3, rx1, rzTop + 0.3, 2.3, 2.85, neon.uv(4)); for (const x of [rx0 + 0.05, rx1 - 0.05]) c.flat.box(x - 0.02, 2.85, rzTop + 0.28, x + 0.02, H, rzTop + 0.32, [0.1, 0.1, 0.12]);
  upright(lit, -W / 2 + 2.6, 0.04 - 0.0 + 0.0 - 0.0 + 0.5, -W / 2 + 5.4, 0.5, 2.5, 3.0, neon.uv(2));
  upright(lit, 2, D / 2 - 0.05, -1.4, D / 2 - 0.05, H - 1.6, H - 0.7, neon.uv(1)); upright(lit, 6.5, D / 2 - 0.05, 3.5, D / 2 - 0.05, 3.2, 3.8, neon.uv(7));
  for (const [x, y, z, col, pw] of [[-3, H - 1, 3, '#ffab3a', 1.7], [4, H - 1, 4.5, '#ffab3a', 1.6], [-2, H - 1.2, -3.5, '#ffab3a', 1.7], [5, H - 1.2, -2.5, '#ffab3a', 1.4], [-W / 2 + 2.5, 2.4, 6, '#ffab3a', 1.0], [-W / 2 + 3, 3.2, -D / 2 + 4.2, '#ff5a2a', 0.8], [(rx0 + rx1) / 2, 1.8, rzTop + 1, '#35e0ff', 0.9], [3.5, 1.2, D / 2 - 5.2, '#fff2c0', 0.7], [-W / 2 + 1.8, 2.6, 4.8, '#ff2a1e', 0.6], [0.2, 2.4, -D / 2 + 5.4, '#fff2c0', 0.7]]) c.light(x, y, z, col, pw, { k: 1.2, far: 8 });
}
