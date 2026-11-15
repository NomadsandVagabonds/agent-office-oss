// The Backrooms — a room of the shopping centre (themes.js `mall`): Level P
// ("the car park where every car is the one car"). Where you leave the car:
// built in the basement of an office, by people who knew that it is low,
// that there are numbers, and that you can never find yours. Every bay has
// the same number. Every car is the same car, parked the same way, the same
// colour. The barrier goes up and comes down by itself. One bay has a desk
// in it, parked.
import * as THREE from 'three';
import { Batch } from '../kit.js';
import { P } from '../bits.js';
import { carVox, payVox, garble } from '../suburb.js';

export const LEVEL_P = Object.freeze({ bay: 2.5, deep: 4.6, lane: 2.3, arm: 3.0 });

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = LEVEL_P;
  c.shell({ floorTex: kit.tex.screed('#6f7072'), skirting: false });
  const paint = [0.86, 0.84, 0.74], yellow = [0.85, 0.66, 0.12];
  const bays = Math.floor((W - 1.0) / K.bay), x0 = -(bays * K.bay) / 2, colour = R.pick([[0.62, 0.55, 0.42], [0.42, 0.2, 0.18], [0.3, 0.38, 0.44]]);
  const num = c.mapped('levelp:num:' + p.seed, kit.tex.custom('levelp:num:' + p.seed, 64, 32, (g, w, h) => { g.clearRect(0, 0, w, h); garble(g, String(p.bay), 0, 0, w, h, { color: '#e9e4d2', mess: 0.2, size: 26 }, p.seed); }, { clamp: true }), { cutout: true });
  const desk = R.int(0, bays * 2 - 1), hex = '#' + colour.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); let k = 0;
  for (const side of [-1, 1]) for (let i = 0; i < bays; i++, k++) {
    const xa = x0 + i * K.bay, zf = side * K.lane, zb = side * Math.min(D / 2 - 0.3, K.lane + K.deep), cx = xa + K.bay / 2, cz = (zf + zb) / 2;
    for (const x of i ? [xa] : [xa, xa + bays * K.bay]) c.flat.box(x - 0.05, 0, Math.min(zf, zb), x + 0.05, 0.006, Math.max(zf, zb), paint, { skip: '-y' });
    c.lay(num, cx, zf + side * 0.45, 0.9, 0.45, side > 0 ? Math.PI : 0);
    if (Math.abs(cz) < 1.4 && Math.abs(cx) > W / 2 - 2.2) continue;
    if (k === desk) { c.prop('desk', cx, cz, { rot: Math.PI / 2 }); continue; }
    if (R.chance(0.14)) { c.blot(cx, cz, 1.5, 2.6, { a: 0.5 }); continue; }                               // a bay with only what dripped from it
    // (the one car, cut coarser: there are a great many of it)
    c.model('levelp:car:' + hex, () => carVox(hex, false)().downsample(3), cx, cz, { rot: side > 0 ? -Math.PI / 2 : Math.PI / 2, scale: 3, solid: false }); c.solid(cx - 0.85, cz - 2.05, cx + 0.85, cz + 2.05, { tall: false });
  }
  /* columns, banded; the height it says it is, which it is not */
  const band = c.mapped('levelp:band', kit.tex.custom('levelp:band', 32, 64, (g, w, h) => { P(g, '#8a8b88', 0, 0, w, h); for (let y = 20; y < 44; y += 1) for (let x = 0; x < w; x++) if (((x + y) >> 3) & 1) P(g, '#d6a91f', x, y, 1, 1); else P(g, '#1c1a17', x, y, 1, 1); }));
  for (const side of [-1, 1]) for (let i = 1; i < bays; i += 2) c.pillar(x0 + i * K.bay, side * (K.lane + 0.25), 0.4, 0.4, { batch: band, skirting: false });
  const head = c.shining('levelp:head', kit.tex.custom('levelp:head', 128, 24, (g, w, h) => { P(g, '#d6a91f', 0, 0, w, h); P(g, '#1c1a17', 0, 0, w, 2); P(g, '#1c1a17', 0, h - 2, w, 2); garble(g, 'MAX HEADROOM 9.9m', 4, 3, w - 8, h - 6, { color: '#1c1a17', mess: 0.3 }, p.seed + 3); }), 0.9);
  for (const [ax, bx, z] of [[-1.6, 1.6, -K.lane + 0.02], [1.6, -1.6, K.lane - 0.02]]) { const u = (s, t) => [s, t]; void u; const q = new Batch(); void q; head.quad([ax, H - 0.42, z], [bx, H - 0.42, z], [bx, H - 0.12, z], [ax, H - 0.12, z], [1, 1, 1], [[1, 0], [0, 0], [0, 1], [1, 1]]); }
  /* the machine, and the barrier across the lane that works itself */
  c.model('suburb:pay', payVox, -W / 2 + 0.7, -K.lane + 0.5, { rot: Math.PI / 2, solid: true });
  const ax = R.pick([-1, 1]) * (W / 2 - 2.4), post = new Batch(), arm = new Batch();
  post.box(ax - 0.12, 0, -K.lane + 0.1, ax + 0.12, 1.05, -K.lane + 0.34, [0.82, 0.8, 0.72]);
  for (let i = 0; i < 10; i++) arm.box(ax - 0.04, 0.92, -K.lane + 0.34 + i * (K.arm / 10), ax + 0.04, 1.02, -K.lane + 0.34 + (i + 1) * (K.arm / 10), i % 2 ? [0.8, 0.14, 0.1] : [0.9, 0.88, 0.8]);
  c.flat.box(ax - 0.12, 0, -K.lane + 0.1, ax + 0.12, 1.05, -K.lane + 0.34, [0.82, 0.8, 0.72]);
  const g = c.dynamic(arm, { pivot: [ax, 0.97, -K.lane + 0.34] });                                  // (it stops nobody: it is a barrier as described)
  let t0 = R.range(0, 8);
  c.tick((dt) => { t0 += dt; const ph = (t0 % 9) / 9, up = ph < 0.18 ? ph / 0.18 : ph < 0.55 ? 1 : ph < 0.73 ? 1 - (ph - 0.55) / 0.18 : 0; g.rotation.x = -up * 1.45; });
  void THREE; void post;
}
