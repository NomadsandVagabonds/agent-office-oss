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
import { Vox, M, glow, tone } from '../../vox/vox.js';
import { payVox, garble, upright, sheet } from '../suburb.js';
import { mallNeon, voidIn, wallBox } from '../mall.js';

// car: its length, width and height · rise: one stacked on another · ramp: how wide, how long, how steep, how far it can be walked
export const LEVEL_P = Object.freeze({ long: 4.2, wide: 1.7, tall: 1.4, rise: 1.36, rampW: 2.2, rampL: 5.4, slope: 0.42, down: 3.2, arm: 3.0 });
const VOX = 2;                                                                  // (a twentieth of a metre a cube: the car is modelled at that)

/** The one car: a saloon of about 1984, in the colour it comes in, at a twentieth of a metre a cube. Nose toward +x. lit: its lights on.
 *  Wheel arches, bumpers with rubber strips, a grille, door lines and handles, mirrors, wipers, a number plate, the seats seen through. */
function oneCar(paint, lit) {
  return () => {
    const v = new Vox(), body = M(paint, 1), shade = M(tone(paint, -0.18), 1), glass = M('#121a20', 0), chrome = M('#aeb3b8', 0), rubber = M('#16161a', 2), tyre = M('#121214', 2), hub = M('#8d949c', 0);
    const head = lit ? glow('#fff2c0') : M('#d8d2b8', 0), tail = lit ? glow('#ff2a1e') : M('#7a1a14', 0), seat = M('#3a3026', 2);
    // the body: a box with its corners and edges rounded, the lower half a shade darker past the swage line
    v.rbox(-42, 6, -17, 42, 16, 17, 3, body); v.rbox(-42, 6, -17, 42, 9, 17, 2, shade); v.box(-40, 12, -17, 40, 12, 17, shade);
    // the glasshouse: pillars, glass, roof; the seats seen through it
    v.rbox(-18, 16, -15, 20, 25, 15, 2, glass); v.rbox(-17, 25, -15, 19, 27, 15, 2, body);
    for (const x of [-18, -1, 19]) v.box(x, 16, -15, x + 1, 25, 15, body); v.carve(-16, 17, -13, 17, 24, 13);
    for (const x of [-14, 2]) { v.rbox(x, 9, -12, x + 9, 15, -2, 1, seat); v.rbox(x, 9, 2, x + 9, 15, 12, 1, seat); v.box(x, 15, -12, x + 2, 22, -2, seat); v.box(x, 15, 2, x + 2, 22, 12, seat); }
    v.rbox(-17, 16, -15, 19, 16, 15, 1, glass);
    // the arches, the wheels in them, hubs
    for (const x of [-27, 26]) { v.carve(x - 8, 6, -18, x + 8, 13, 18); for (const z of [-17, 13]) { v.cyl('z', x, 6, z, z + 4, 6, tyre); v.cyl('z', x, 6, z < 0 ? z - 0.5 : z + 3.5, z < 0 ? z + 0.5 : z + 4.5, 3.5, hub); } v.ring(x, 7, -17, 8, 1, shade, 'z'); v.ring(x, 7, 17, 8, 1, shade, 'z'); }
    // bumpers with a rubber strip, the grille, the lamps, a plate
    for (const s of [-1, 1]) { const x0 = s > 0 ? 42 : -45, x1 = s > 0 ? 45 : -42; v.box(x0, 5, -17, x1, 9, 17, chrome); v.box(x0, 7, -17, x1, 7, 17, rubber); v.box(s * 43, 9, -6, s * 43, 11, 6, M('#e9e4d6', 0)); }
    v.box(42, 10, -8, 42, 14, 8, M('#1c1c20', 0)); for (let z = -7; z <= 7; z += 2) v.box(42, 10, z, 43, 14, z, chrome);
    for (const z of [-15, 11]) { v.box(42, 11, z, 43, 14, z + 4, head); v.box(-43, 11, z, -42, 14, z + 4, tail); }
    // doors: a line round each, handles; mirrors; wipers on the screen
    for (const z of [-17, 17]) { for (const x of [-18, 0, 20]) v.box(x, 7, z, x, 16, z, shade); v.box(-17, 12, z, 19, 12, z, shade); for (const x of [-6, 12]) v.box(x, 13, z < 0 ? z - 1 : z + 1, x + 3, 14, z < 0 ? z - 1 : z + 1, chrome); v.box(20, 17, z < 0 ? z - 3 : z + 1, 22, 19, z < 0 ? z - 1 : z + 3, body); }
    for (const z of [-8, 4]) v.box(20, 16, z, 21, 17, z + 6, rubber);
    v.box(-1, 27, -1, 0, 32, 0, chrome);                                                                                                   // the aerial
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
  const paint = R.pick(['#b3402e', '#c9a23a', '#5d7f8f', '#d8d2c0']), car = (x, z, o = {}) => c.model('levelp:car:' + paint + (o.lit ? ':lit' : '') + (o.fine ? ':fine' : ':far'), o.fine ? oneCar(paint, !!o.lit) : () => oneCar(paint, !!o.lit)().downsample(3), x, z, { scale: o.fine ? VOX : VOX * 3, solid: false, shadow: !o.y, ...o });
  const clear = (x, z, r) => !(Math.abs(z) < 1.5 + r && Math.abs(x) > W / 2 - 2.8) && !(Math.abs(x) < 1.4 + r && z > D / 2 - 2.8);       // (not in a way in)
  // …stacked: three columns of it against the back wall, each to the roof and the last one into it
  const per = Math.ceil((H - 0.5) / K.rise);
  for (const x of [-4.6, -2.2, 0.2]) { for (let k = 0; k < per; k++) car(x + (k ? R.range(-0.12, 0.12) : 0), -D / 2 + 2.5 + (k ? R.range(-0.15, 0.15) : 0), { y: k * K.rise, rot: Math.PI / 2 + (k ? R.range(-0.1, 0.1) : 0), tilt: k ? [R.range(-0.03, 0.03), R.range(-0.03, 0.03)] : [0, 0], lit: k === 2 && x > 0 }); c.solid(x - 0.95, -D / 2 + 0.3, x + 0.95, -D / 2 + 4.7, { tall: true }); }
  // …in a drift: the corner where the rest were put
  { const hx = -W / 2 + 2.6, hz = -D / 2 + 2.8; for (let i = 0; i < 11; i++) { const a = R.range(0, 6.28), d = i < 3 ? R.range(0, 0.8) : R.range(0.8, 2.4), y = Math.max(0, 3.4 - d * 1.35) + (i < 3 ? 1.2 : 0) * (i / 3); car(Math.max(-W / 2 + 1.2, hx + Math.cos(a) * d), Math.max(-D / 2 + 1.2, hz + Math.sin(a) * d), { y, rot: R.range(0, 6.28), tilt: [R.range(-0.9, 0.9), R.range(-0.7, 0.7)], lit: i === 5 }); } c.solid(-W / 2, -D / 2, hx + 2.4, hz + 2.4, { tall: true }); }
  // …up the wall, in bays that go on up it
  const lw = -W / 2 + 0.02, paintW = [0.86, 0.84, 0.74];
  for (let i = 0; i < 3; i++) { const z = 2.6 + i * 2.3; if (z > D / 2 - 1.6) break; for (const dz of [-1.1, 1.1]) c.flat.box(lw, 0, z + dz - 0.04, lw + 0.012, H, z + dz + 0.04, paintW); car(lw + 0.72, z, { y: 1.3 + i * 1.5, rot: Math.PI, tilt: [0, Math.PI / 2], lit: i === 1, fine: i === 0 }); }
  // …on the roof, lights on
  car(1.5, 1.0, { y: H - 0.02, rot: 0.3, tilt: [Math.PI, 0], lit: true, fine: true }); c.light(3.4, H - 1.4, 1.6, '#fff2c0', 1.0, { k: 1.2, far: 8 });
  // …and in a row, as told: every bay the same bay
  const num = c.mapped('levelp:num:' + p.seed, kit.tex.custom('levelp:num:' + p.seed, 64, 32, (g, w, h) => { g.clearRect(0, 0, w, h); garble(g, String(p.bay), 0, 0, w, h, { color: '#e9e4d2', mess: 0.2, size: 26 }, p.seed); }, { clamp: true }), { cutout: true });
  for (let i = 0; i < 5; i++) { const x = 2.4 + i * 2.5, z = D / 2 - 2.5; if (x > W / 2 - 1.3) break; for (const dx of i ? [1.25] : [-1.25, 1.25]) c.flat.box(x + dx - 0.05, 0, D / 2 - 4.8, x + dx + 0.05, 0.006, D / 2 - 0.3, paintW, { skip: '-y' }); c.lay(num, x, D / 2 - 5.2, 0.9, 0.45, Math.PI);
    if (i === 2) { c.blot(x, z, 1.5, 3.4, { a: 0.5 }); continue; } car(x, z, { rot: -Math.PI / 2, lit: i === 0, fine: true }); c.solid(x - 0.9, z - 2.15, x + 0.9, z + 2.15, { tall: false }); }

  /* columns, banded; the machines you pay at, of which there are several and no two the same height; the barrier that works itself */
  const band = c.mapped('levelp:band', kit.tex.custom('levelp:band', 32, 64, (g, w, h) => { P(g, '#8a8b88', 0, 0, w, h); for (let y = 44; y < 60; y += 1) for (let x = 0; x < w; x++) if (((x + y) >> 3) & 1) P(g, '#d6a91f', x, y, 1, 1); else P(g, '#1c1a17', x, y, 1, 1); }));
  for (const [x, z] of [[-4, 4.6], [3.6, -1.8], [-1.2, -0.6]]) if (clear(x, z, 0.4)) c.pillar(x, z, 0.5, 0.5, { batch: band, skirting: false });
  for (let i = 0; i < 5; i++) { const x = -W / 2 + 3.2 + i * 0.75, z = 0.9 + (i % 2) * 0.25, k = [1, 0.6, 1.5, 0.8, 1.2][i]; c.model('suburb:pay', payVox, x, z, { rot: Math.PI, scale: k, solid: false }); c.solid(x - 0.25, z - 0.2, x + 0.25, z + 0.2, { tall: false }); }
  const ax = 1.2, az = 3.4, arm = new Batch(); for (let i = 0; i < 10; i++) arm.box(ax + i * (K.arm / 10), 0.92, az - 0.04, ax + (i + 1) * (K.arm / 10), 1.02, az + 0.04, i % 2 ? [0.8, 0.14, 0.1] : [0.9, 0.88, 0.8]);
  c.flat.box(ax - 0.24, 0, az - 0.12, ax, 1.05, az + 0.12, [0.82, 0.8, 0.72]); c.solid(ax - 0.24, az - 0.12, ax, az + 0.12, { tall: false });
  const g = c.dynamic(arm, { pivot: [ax, 0.97, az] }); let t0 = R.range(0, 8);
  c.tick((dt) => { t0 += dt; const ph = (t0 % 9) / 9, up = ph < 0.18 ? ph / 0.18 : ph < 0.55 ? 1 : ph < 0.73 ? 1 - (ph - 0.55) / 0.18 : 0; g.rotation.z = up * 1.45; });

  /* the detail: what a car park's roof and walls have, standing proud. In a batch of its own (levelp:detail); nothing in it is walked into */
  { const det = c.mapped('levelp:detail', kit.tex.white(), { detail: true }), beam = [0.48, 0.47, 0.44], pipe = [0.62, 0.18, 0.14], duct = [0.6, 0.62, 0.64], tray = [0.38, 0.4, 0.42], guard = [0.85, 0.66, 0.12];
    // downstand beams across the roof every 3.6 m, and a deeper one along the middle
    for (let x = -W / 2 + 1.8; x < W / 2; x += 3.6) det.box(x - 0.2, H - 0.55, -D / 2, x + 0.2, H, D / 2, beam);
    det.box(-W / 2, H - 0.7, -0.25, W / 2, H, 0.25, beam.map((v) => v * 0.92));
    // a red sprinkler main, with drops and heads; a grey duct; a cable tray with cables in it
    det.box(-W / 2, H - 0.82, 1.6, W / 2, H - 0.72, 1.7, pipe); for (let x = -W / 2 + 1; x < W / 2; x += 1.8) { det.box(x - 0.015, H - 1.0, 1.635, x + 0.015, H - 0.82, 1.665, pipe); det.box(x - 0.04, H - 1.04, 1.61, x + 0.04, H - 1.0, 1.69, [0.8, 0.7, 0.3]); }
    det.box(-W / 2, H - 1.05, -2.6, W / 2, H - 0.75, -2.1, duct); for (let x = -W / 2 + 0.6; x < W / 2; x += 1.2) det.box(x - 0.02, H - 1.07, -2.62, x + 0.02, H - 0.73, -2.08, duct.map((v) => v * 0.85));
    det.box(-W / 2, H - 0.62, 3.4, W / 2, H - 0.58, 3.8, tray); for (const z of [3.45, 3.75]) det.box(-W / 2, H - 0.62, z - 0.01, W / 2, H - 0.52, z + 0.01, tray); for (const [z, col] of [[3.52, [0.1, 0.1, 0.1]], [3.6, [0.7, 0.2, 0.15]], [3.68, [0.15, 0.3, 0.6]]]) det.box(-W / 2, H - 0.58, z - 0.018, W / 2, H - 0.545, z + 0.018, col);
    // light fittings: a batten under each beam, its tube lit
    // (the shell's batten, `c.fitting` kind 'batten', 1.2 m along z, hung from the beam's underside; the room lights itself, so no lamp)
    for (let x = -W / 2 + 1.8; x < W / 2; x += 3.6) for (const z of [-4.5, 0.9, 5.5]) { if (Math.abs(z) > D / 2 - 0.6) continue; c.fitting(x, z, { kind: 'batten', len: 1.2, y: H - 0.55, tube: [1, 0.82, 0.55], power: 1.6, detail: true, light: false }); }
    // the columns' corners guarded in yellow steel to knee height; wheel stops in the row of bays
    for (const [x, z] of [[-4, 4.6], [3.6, -1.8], [-1.2, -0.6]]) if (clear(x, z, 0.4)) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) det.box(x + sx * 0.25 - (sx > 0 ? 0.06 : 0), 0, z + sz * 0.25 - (sz > 0 ? 0.06 : 0), x + sx * 0.25 + (sx < 0 ? 0.06 : 0), 0.9, z + sz * 0.25 + (sz < 0 ? 0.06 : 0), guard);
    for (let i = 0; i < 5; i++) { const x = 2.4 + i * 2.5; if (x > W / 2 - 1.3) break; det.box(x - 0.6, 0, D / 2 - 0.55, x + 0.6, 0.1, D / 2 - 0.4, [0.62, 0.6, 0.56]); det.box(x - 0.55, 0.1, D / 2 - 0.53, x - 0.35, 0.11, D / 2 - 0.42, guard); det.box(x + 0.35, 0.1, D / 2 - 0.53, x + 0.55, 0.11, D / 2 - 0.42, guard); }
    // on the walls: a fire hose reel in its red box, a fuse board, an extinguisher, a level marker painted large
    const ws = (side) => c.spans(side, 0.6, 2.4)[0];
    { const sp = ws('back'); if (sp) { const m = (sp[0] + sp[1]) / 2 + 1.5; wallBox(c, 'back', m - 0.4, m + 0.4, 1.0, 1.8, 0, 0.22, [0.7, 0.12, 0.1], det); wallBox(c, 'back', m - 0.25, m + 0.25, 1.15, 1.65, 0.22, 0.24, [0.2, 0.2, 0.22], det);
      wallBox(c, 'back', m + 0.7, m + 1.3, 1.2, 2.0, 0, 0.16, [0.6, 0.62, 0.6], det); wallBox(c, 'back', m + 0.75, m + 1.25, 1.25, 1.95, 0.16, 0.17, [0.4, 0.42, 0.42], det);
      wallBox(c, 'back', m - 0.9, m - 0.72, 0.3, 0.9, 0.05, 0.23, [0.75, 0.1, 0.08], det); } }
  }
  /* what it says, in tube; and the yellow it is all in */
  const neon = mallNeon(kit, 'levelp:' + p.seed, ['WAY OUT', 'LEVEL P', 'PAY HERE', String(p.bay), 'WAY OUT', 'LEVEL P', 'PAY HERE', 'YOUR CAR'], p.seed + 2), lit = c.shining('mall:neon:levelp:' + p.seed, neon.texture, 2.4, undefined, { bloom: 2 });
  upright(lit, rx1, rzTop + 0.3, rx0, rzTop + 0.3, 2.3, 2.85, neon.uv(0)); upright(lit, rx0, rzTop + 0.3, rx1, rzTop + 0.3, 2.3, 2.85, neon.uv(4)); for (const x of [rx0 + 0.05, rx1 - 0.05]) c.flat.box(x - 0.02, 2.85, rzTop + 0.28, x + 0.02, H, rzTop + 0.32, [0.1, 0.1, 0.12]);
  upright(lit, -W / 2 + 2.6, 0.04 - 0.0 + 0.0 - 0.0 + 0.5, -W / 2 + 5.4, 0.5, 2.5, 3.0, neon.uv(2));
  upright(lit, 2, D / 2 - 0.05, -1.4, D / 2 - 0.05, H - 1.6, H - 0.7, neon.uv(1)); upright(lit, 6.5, D / 2 - 0.05, 3.5, D / 2 - 0.05, 3.2, 3.8, neon.uv(7));
  for (const [x, y, z, col, pw] of [[-3, H - 1, 3, '#ffab3a', 1.7], [4, H - 1, 4.5, '#ffab3a', 1.6], [-2, H - 1.2, -3.5, '#ffab3a', 1.7], [5, H - 1.2, -2.5, '#ffab3a', 1.4], [-W / 2 + 2.5, 2.4, 6, '#ffab3a', 1.0], [-W / 2 + 3, 3.2, -D / 2 + 4.2, '#ff5a2a', 0.8], [(rx0 + rx1) / 2, 1.8, rzTop + 1, '#35e0ff', 0.9], [3.5, 1.2, D / 2 - 5.2, '#fff2c0', 0.7], [-W / 2 + 1.8, 2.6, 4.8, '#ff2a1e', 0.6], [0.2, 2.4, -D / 2 + 5.4, '#fff2c0', 0.7]]) c.light(x, y, z, col, pw, { k: 1.2, far: 8 });
}
