// The Backrooms — a room of the shopping centre (themes.js `mall`): The Food
// Court ("the tables round the hole"). A tea point, scaled up by somebody who
// was told that people eat at a shopping centre: tables bolted down in rows,
// each with its four seats on arms; counters along the back wall with a lit
// board of what there is over each, and a kettle. In the middle the floor
// was left out, with a brass rail round where it should be and a length of
// the rail missing. There is nothing down it but more tables. One counter
// has something on it that can be eaten.
import { ticks } from '../kit.js';
import { P } from '../bits.js';
import { Vox, M, glow } from '../../vox/vox.js';
import { garble, upright, sheet } from '../suburb.js';
import { voidIn } from '../mall.js';

export const COURT = Object.freeze({ holeW: 4.4, holeD: 3.2, rail: 0.95, gap: 1.3, pitch: 2.5, seen: 14 });
const MENU = ['SOUP OF THE DAY: DAY', 'TRAY', 'TRAY (LARGE)', 'HOT', 'SANDWICH (1)', 'TEA OR', 'CHIPS AND CHIP', 'THE SPECIAL', 'MEAL DEAL DEAL', 'NO'];

/** A table bolted to the floor, four seats on arms from its one leg: moulded, in the colours of 1984. */
function tableVox(seat) {
  return () => {
    const v = new Vox(), top = M('#d8ccb0', 1), edge = M('#7a4f2a', 3), steel = M('#8d949c', 0), s = M(seat, 1);
    v.cyl('y', 0, 0, 0, 2, 9, steel); v.cyl('y', 0, 0, 2, 27, 2.2, steel); v.rbox(-17, 27, -17, 17, 29, 17, 3, edge, 'xz'); v.rbox(-16, 29, -16, 16, 30, 16, 3, top, 'xz');
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      v.tube(0, 9, 0, dx * 25, 9, dz * 25, 1, steel); v.tube(dx * 25, 9, dz * 25, dx * 25, 16, dz * 25, 1, steel);
      v.rbox(dx * 25 - 6, 16, dz * 25 - 6, dx * 25 + 6, 18, dz * 25 + 6, 2, s, 'xz'); v.rbox(dx * 30 - (dx ? 1 : 6), 18, dz * 30 - (dz ? 1 : 6), dx * 30 + (dx ? 1 : 6), 28, dz * 30 + (dz ? 1 : 6), 1, s);
    }
    return v;
  };
}
/** A tray, with a tray on it. */
function trayVox() { const v = new Vox(), a = M('#8a3b2c', 1), b = M('#a8452f', 1); v.rbox(-8, 0, -6, 8, 1, 6, 2, a, 'xz'); v.carve(-7, 1, -5, 7, 1, 5); v.rbox(-7, 0, -5, 7, 0, 5, 1, b, 'xz'); v.rbox(-6, 1, -4, 6, 2, 4, 2, a, 'xz'); return v; }
/** What a tea point has: a kettle, and a microwave with the door open and the light on. */
function kettleVox() { const v = new Vox(), w = M('#e9e4d6', 0); v.cyl('y', 0, 0, 0, 9, 4, w, 3.4); v.cyl('y', 0, 0, 9, 10, 3, M('#2a2f36', 0)); v.tube(4, 7, 0, 7, 5, 0, 0.8, w); v.ring(-4, 5, 0, 3, 0.7, M('#2a2f36', 0), 'z'); return v; }
function microVox() { const v = new Vox(), w = M('#d9d2bf', 0); v.box(-10, 0, -7, 10, 12, 7, w); v.carve(-8, 2, 5, 3, 10, 7); v.box(-8, 2, 4, 3, 10, 4, glow('#ffe9a8')); v.box(5, 2, 7, 8, 10, 7.4, M('#2a2f36', 0)); v.box(-10, 0, 7, -9.4, 12, 16, w); return v; }

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = COURT;
  c.shell({ floor: false });
  const hx = K.holeW / 2, hz = K.holeD / 2, inHole = (x, z) => Math.abs(x) < hx && Math.abs(z) < hz;
  voidIn(c, inHole);
  /* the floor, with the middle left out; and what is down the middle */
  const fl = c.floor, strip = (xa, xb, za, zb) => fl.grid([xa, 0, za], [0, 0, 1], [1, 0, 0], ticks(zb - za), ticks(xb - xa), (u, v) => [(xa + v + c.room.cx) / 1.6, (za + u + c.room.cz) / 1.6]);
  strip(-W / 2, W / 2, -D / 2, -hz); strip(-W / 2, W / 2, hz, D / 2); strip(-W / 2, -hx, -hz, hz); strip(hx, W / 2, -hz, hz);
  const dark = c.mapped('court:void', kit.tex.custom('court:void', 16, 16, (g) => { P(g, '#1b1916', 0, 0, 16, 16); for (let i = 0; i < 16; i += 4) P(g, '#24211d', i, 0, 1, 16); })), k0 = [0.5, 0.5, 0.5];
  const fade = (i, j) => 1;
  for (const [a, b] of [[[-hx, -hz], [hx, -hz]], [[hx, -hz], [hx, hz]], [[hx, hz], [-hx, hz]], [[-hx, hz], [-hx, -hz]]]) sheet(dark, [a[0], -K.seen, a[1]], [b[0], -K.seen, b[1]], [b[0], 0, b[1]], [a[0], 0, a[1]], 1, 6, (s, t) => [s * 3, t * 8], k0, 1);
  c.flat.box(-hx, -K.seen - 0.1, -hz, hx, -K.seen, hz, [0, 0, 0]);
  void fade;
  const seats = ['#c8642d', '#8a5a2c', '#5a7a5a', '#b8922e'];
  for (let i = 0; i < 5; i++) c.model('court:table:' + (i % 4), tableVox(seats[i % 4]), R.range(-hx + 0.9, hx - 0.9), R.range(-hz + 0.9, hz - 0.9), { y: -2.2 - i * 2.3, rot: R.range(0, 6), tilt: [R.range(-0.5, 0.5), R.range(-0.5, 0.5)], solid: false, shadow: false });
  /* the rail: brass, on posts, all the way round but for one length */
  const side = R.int(0, 3), brass = [0.72, 0.56, 0.2], post = (x, z) => c.flat.box(x - 0.03, 0, z - 0.03, x + 0.03, K.rail, z + 0.03, brass);
  const runs = [[-hx, hz, hx, hz], [hx, hz, hx, -hz], [hx, -hz, -hx, -hz], [-hx, -hz, -hx, hz]];
  runs.forEach(([ax, az, bx, bz], i) => {
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, g0 = i === side ? R.range(0.5, len - K.gap - 0.5) : -9, g1 = g0 + K.gap;
    for (const [s0, s1] of i === side ? [[0, g0], [g1, len]] : [[0, len]]) {
      const x0 = ax + ux * s0, z0 = az + uz * s0, x1 = ax + ux * s1, z1 = az + uz * s1, off = 0.12, ox = uz * off, oz = -ux * off;                // (stood a hand outside the edge)
      for (const y of [K.rail, K.rail * 0.5]) c.flat.box(Math.min(x0, x1) + ox - 0.02, y - 0.025, Math.min(z0, z1) + oz - 0.02, Math.max(x0, x1) + ox + 0.02, y + 0.025, Math.max(z0, z1) + oz + 0.02, brass);
      for (let s = s0; s <= s1 + 0.01; s += Math.max(0.6, (s1 - s0) / Math.max(1, Math.round((s1 - s0) / 1.1)))) post(ax + ux * s + ox, az + uz * s + oz);
      c.solid(Math.min(x0, x1) + ox - 0.05, Math.min(z0, z1) + oz - 0.05, Math.max(x0, x1) + ox + 0.05, Math.max(z0, z1) + oz + 0.05, { tall: false });
    }
  });
  /* the tables: in rows, clear of the hole and of the ways in */
  let n = 0;
  for (let x = -W / 2 + 1.7; x <= W / 2 - 1.69; x += K.pitch) for (let z = -D / 2 + 3.4; z <= D / 2 - 1.5; z += K.pitch) {
    if (Math.abs(x) < hx + 1.2 && Math.abs(z) < hz + 1.2) continue;
    if (Math.abs(z) < 1.0 && Math.abs(x) > W / 2 - 2.6) continue;
    c.model('court:table:' + (n % 4), tableVox(seats[n % 4]), x, z, { rot: (n % 2) * 0.785, solid: false }); c.solid(x - 0.5, z - 0.5, x + 0.5, z + 0.5, { tall: false });
    if (R.chance(0.6)) c.model('court:tray', trayVox, x + R.range(-0.2, 0.2), z + R.range(-0.2, 0.2), { y: 0.9, rot: R.range(0, 6), solid: false, shadow: false });
    n++;
  }
  /* the counters, along the back: a worktop, and over each a lit board of what there is */
  const bays = Math.max(3, Math.floor((W - 1.2) / 2.6)), bw = (W - 1.2) / bays, zc = -D / 2 + 0.75, items = R.shuffle(MENU.slice());
  const boards = c.shining('court:menu:' + p.seed, kit.tex.custom('court:menu:' + p.seed, 256, 256, (g) => {
    for (let b = 0; b < 4; b++) { const y = b * 64, col = ['#ffd76a', '#ff9d5c', '#9fe8c8', '#f4f0e0'][b]; P(g, '#1a1612', 0, y, 256, 64); P(g, col, 3, y + 3, 250, 58);
      for (let r = 0; r < 3; r++) { garble(g, items[(b * 3 + r) % items.length], 8, y + 6 + r * 18, 170, 16, { color: '#2a1f16', mess: 0.35 }, p.seed + b * 9 + r); garble(g, ['SOON', '3 FOR', 'FREE*', '0.00', 'ASK'][(b + r) % 5], 186, y + 6 + r * 18, 60, 16, { color: '#8a2a1c', mess: 0.3 }, p.seed + b + r * 5); } }
  }), 1.5);
  for (let b = 0; b < bays; b++) {
    const xa = -W / 2 + 0.6 + b * bw, xb = xa + bw - 0.25;
    c.flat.box(xa, 0, -D / 2 + 0.05, xb, 0.9, zc + 0.3, [0.5, 0.36, 0.22]); c.flat.box(xa - 0.04, 0.9, -D / 2 + 0.05, xb + 0.04, 0.95, zc + 0.36, [0.82, 0.78, 0.68]);
    c.solid(xa, -D / 2, xb, zc + 0.36, { tall: false });
    upright(boards, xa + 0.1, -D / 2 + 0.06, xb - 0.1, -D / 2 + 0.06, H - 1.25, H - 0.45, [0.004, ((b % 4) * 64 + 0.5) / 256, 0.996, ((b % 4) * 64 + 63.5) / 256]);
    c.model(b % 2 ? 'court:kettle' : 'court:micro', b % 2 ? kettleVox : microVox, xa + bw * 0.3, zc - 0.1, { y: 0.95, rot: R.range(-0.3, 0.3), solid: false, shadow: false });
    if (b % 2 === 0) c.light((xa + xb) / 2, H - 0.9, zc + 0.6, ['#ffd76a', '#ff9d5c', '#9fe8c8'][(b / 2) % 3 | 0], 0.55, { k: 1.5, far: 5 });
  }
  { const b = R.int(0, bays - 1), x = -W / 2 + 0.6 + b * bw + bw * 0.62; c.leave('snack', x, zc + 0.05, { y: 0.96 }); }
}
