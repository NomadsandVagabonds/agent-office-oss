// The Backrooms — a room of the shopping centre (themes.js `mall`): The Food
// Court ("the tables round the hole"). Somebody was told that at a shopping
// centre there is a hall where every kind of food is sold from little shops
// round the edge, and you carry it on a tray to a table. So: a hall, seven
// metres of it, and round the edge the little shops, each of which sells the
// one thing it was told about, at the size it was told about it: SANDWICH
// (1), which is one sandwich; CHIPS AND CHIP; SOUP OF THE DAY: DAY; TRAY;
// HOT; and the orange drink. The tables are bolted down in rows. So that
// there are enough, each has another bolted to the roof over it, the other
// way up, laid. In the middle the floor was left out, with a brass rail
// round where it should be and a length of the rail missing. One counter
// has something on it that can be eaten.
import { ticks } from '../kit.js';
import { P } from '../bits.js';
import { Vox, M, glow } from '../../vox/vox.js';
import { upright, sheet } from '../suburb.js';
import { voidIn, mallNeon, dummyVox, orangeVox, juicerVox, cupVox, heapVox } from '../mall.js';

export const COURT = Object.freeze({ holeW: 4.6, holeD: 3.4, rail: 0.95, gap: 1.3, pitch: 2.7, seen: 14, stall: 1.7, canopy: 2.7 });

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

/** The sandwich: the one. Two slices and what is between, a stride and a half long. */
function sandwichVox() { const v = new Vox(), bread = M('#d9b77a', 2), crust = M('#9a6a34', 2); v.rbox(-26, 0, -13, 26, 5, 13, 3, bread, 'xz'); v.box(-26, 0, -13, 26, 0, 13, crust);
  for (let x = -27; x <= 27; x++) v.box(x, 5, -14, x, 6 + (Math.round(Math.sin(x * 0.9) + 1)), 14, M('#5f9a48', 2)); v.box(-25, 8, -13, 25, 9, 13, M('#e8c040', 0)); v.box(-27, 8, -9, 27, 8, -2, M('#e8c040', 0)); v.rbox(-25, 10, -12, 25, 12, 12, 2, M('#d98a86', 0), 'xz'); v.rbox(-26, 13, -13, 26, 18, 13, 3, bread, 'xz'); v.box(-26, 18, -13, 26, 18, 13, crust); v.tube(0, 18, 0, 0, 30, 0, 0.6, M('#b9925a', 3)); v.ellipsoid(0, 31, 0, 2, 2, 2, M('#3f7a3a', 2)); return v; }
/** A chip. And the other chip. */
function chipVox() { const v = new Vox(), c = M('#e8c040', 2), d = M('#c79a2a', 2); v.rbox(-30, 0, -4, 30, 7, 4, 2, c); v.box(-30, 0, -4, -27, 7, 4, d); v.box(27, 0, -4, 30, 7, 4, d); v.rbox(-8, 7, -3, 8, 11, 3, 1, c); for (let i = 0; i < 14; i++) v.set(-26 + i * 4, 8, (i * 3) % 7 - 3, M('#f6f3e8', 0)); return v; }
/** The soup: a pot the size of a desk, lit from inside by what is in it. */
function potVox() { const v = new Vox(), iron = M('#2a2c30', 0); v.cyl('y', 0, 0, 0, 22, 17, iron, 20); v.cyl('y', 0, 0, 22, 24, 21, iron); v.carve(-17, 14, -17, 17, 24, 17); v.cyl('y', 0, 0, 13, 19, 17, glow('#ffb347')); for (const s of [-1, 1]) v.ring(s * 21, 16, 0, 4, 1, iron, 'z'); v.tube(6, 19, 2, 16, 34, 6, 1, M('#b9bec4', 0)); return v; }
/** TRAY: trays, to the roof. n: how many. */
function traysVox(n) { return () => { const v = new Vox(), a = M('#8a3b2c', 1), b = M('#a8452f', 1); for (let i = 0; i < n; i++) { const o = (i * 7) % 3 - 1; v.rbox(-8 + o, i * 2, -6, 8 + o, i * 2 + 1, 6, 2, i % 2 ? a : b, 'xz'); } return v; }; }

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = COURT;
  c.shell({ floor: false, panels: false, skirting: false, wallAlb: [0.34, 0.31, 0.36],
    ceilTex: kit.tex.custom('atrium:deck', 32, 32, (g, w, h) => { P(g, '#15141a', 0, 0, w, h); for (let x = 0; x < w; x += 8) { P(g, '#1f1e26', x, 0, 3, h); P(g, '#0d0c11', x + 5, 0, 1, h); } }) });
  const hx = K.holeW / 2, hz = K.holeD / 2, inHole = (x, z) => Math.abs(x) < hx && Math.abs(z) < hz;
  voidIn(c, inHole);
  /* the floor, with the middle left out; and what is down the middle */
  const fl = c.floor, strip = (xa, xb, za, zb) => fl.grid([xa, 0, za], [0, 0, 1], [1, 0, 0], ticks(zb - za), ticks(xb - xa), (u, v) => [(xa + v + c.room.cx) / 1.6, (za + u + c.room.cz) / 1.6]);
  strip(-W / 2, W / 2, -D / 2, -hz); strip(-W / 2, W / 2, hz, D / 2); strip(-W / 2, -hx, -hz, hz); strip(hx, W / 2, -hz, hz);
  const dark = c.mapped('court:void', kit.tex.custom('court:void', 16, 16, (g) => { P(g, '#1b1916', 0, 0, 16, 16); for (let i = 0; i < 16; i += 4) P(g, '#24211d', i, 0, 1, 16); }));
  for (const [a, b] of [[[-hx, -hz], [hx, -hz]], [[hx, -hz], [hx, hz]], [[hx, hz], [-hx, hz]], [[-hx, hz], [-hx, -hz]]]) sheet(dark, [a[0], -K.seen, a[1]], [b[0], -K.seen, b[1]], [b[0], 0, b[1]], [a[0], 0, a[1]], 1, 6, (s, t) => [s * 3, t * 8], [0.5, 0.5, 0.5], 1);
  c.flat.box(-hx, -K.seen - 0.1, -hz, hx, -K.seen, hz, [0, 0, 0]);
  const seats = ['#c8642d', '#8a5a2c', '#5a7a5a', '#b8922e'];
  for (let i = 0; i < 5; i++) c.model('court:tbl:' + (i % 4), () => tableVox(seats[i % 4])().downsample(2), R.range(-hx + 0.9, hx - 0.9), R.range(-hz + 0.9, hz - 0.9), { y: -2.2 - i * 2.3, scale: 2, rot: R.range(0, 6), tilt: [R.range(-0.5, 0.5), R.range(-0.5, 0.5)], solid: false, shadow: false });
  /* the rail: brass, a tube along the top of it, all the way round but for one length */
  const side = R.int(0, 3), brass = [0.72, 0.56, 0.2], post = (x, z) => c.flat.box(x - 0.03, 0, z - 0.03, x + 0.03, K.rail, z + 0.03, brass), tubeB = c.shining('court:rail', kit.tex.white(), 2.0, [1, 0.69, 0.18]);
  const runs = [[-hx, hz, hx, hz], [hx, hz, hx, -hz], [hx, -hz, -hx, -hz], [-hx, -hz, -hx, hz]];
  runs.forEach(([ax, az, bx, bz], i) => {
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, g0 = i === side ? R.range(0.5, len - K.gap - 0.5) : -9, g1 = g0 + K.gap;
    for (const [s0, s1] of i === side ? [[0, g0], [g1, len]] : [[0, len]]) {
      const x0 = ax + ux * s0, z0 = az + uz * s0, x1 = ax + ux * s1, z1 = az + uz * s1, off = 0.12, ox = uz * off, oz = -ux * off;
      for (const y of [K.rail, K.rail * 0.5]) c.flat.box(Math.min(x0, x1) + ox - 0.02, y - 0.025, Math.min(z0, z1) + oz - 0.02, Math.max(x0, x1) + ox + 0.02, y + 0.025, Math.max(z0, z1) + oz + 0.02, brass);
      tubeB.box(Math.min(x0, x1) + ox - 0.025, K.rail + 0.03, Math.min(z0, z1) + oz - 0.025, Math.max(x0, x1) + ox + 0.025, K.rail + 0.07, Math.max(z0, z1) + oz + 0.025, [1, 1, 1]);
      for (let s = s0; s <= s1 + 0.01; s += Math.max(0.6, (s1 - s0) / Math.max(1, Math.round((s1 - s0) / 1.1)))) post(ax + ux * s + ox, az + uz * s + oz);
      c.solid(Math.min(x0, x1) + ox - 0.05, Math.min(z0, z1) + oz - 0.05, Math.max(x0, x1) + ox + 0.05, Math.max(z0, z1) + oz + 0.05, { tall: false });
    }
  });

  /* the little shops round the edge: a counter, a roof over it with the name in tube, and on the roof the thing it sells */
  const kinds = R.shuffle(['sandwich', 'chips', 'soup', 'tray', 'hot', 'orange']), names = { sandwich: 'SANDWICH (1)', chips: 'CHIPS AND CHIP', soup: 'SOUP OF THE DAY: DAY', tray: 'TRAY', hot: 'HOT', orange: 'THE ORANGE ONE' };
  const neon = mallNeon(kit, 'court:' + p.seed, kinds.map((k) => names[k]).concat(['FOOD', 'EAT HERE']), p.seed), lit = c.shining('mall:neon:court:' + p.seed, neon.texture, 2.4);
  const skins = { sandwich: [0.55, 0.42, 0.24], chips: [0.78, 0.2, 0.16], soup: [0.2, 0.34, 0.3], tray: [0.42, 0.2, 0.16], hot: [0.6, 0.12, 0.1], orange: [0.94, 0.52, 0.12] };
  const put = (key, make, x, z, o = {}) => c.model(key, make, x, z, { solid: false, shadow: false, ...o });
  const stall = (i, xa, xb, wall, dir) => {
    const kind = kinds[i], zf = wall + dir * K.stall, mid = (xa + xb) / 2, sk = skins[kind], top = K.canopy, fx = (a, b) => (dir > 0 ? [a, b] : [b, a]), [l, r] = fx(xa, xb);
    c.flat.box(xa, 0, Math.min(zf, zf - dir * 0.55), xb, 0.95, Math.max(zf, zf - dir * 0.55), sk); c.flat.box(xa - 0.04, 0.95, Math.min(zf + dir * 0.05, zf - dir * 0.6), xb + 0.04, 1.0, Math.max(zf + dir * 0.05, zf - dir * 0.6), [0.9, 0.87, 0.78]);
    for (let x = xa + 0.1; x < xb - 0.2; x += 0.5) c.flat.box(x, 0.03, zf + dir * 0.001 - 0.004, x + 0.22, 0.9, zf + dir * 0.001 + 0.004, sk.map((v) => Math.min(1, v * 1.5 + 0.1)));
    c.flat.box(xa, top, Math.min(wall, zf + dir * 0.25), xb, top + 0.55, Math.max(wall, zf + dir * 0.25), sk.map((v) => v * 0.7));                          // the roof of it
    for (const x of [xa, xb - 0.08]) c.flat.box(x, 0, Math.min(wall, zf), x + 0.08, top, Math.max(wall, zf), sk.map((v) => v * 0.6));
    sheet(c.flat, [l, 0, wall + dir * 0.03], [r, 0, wall + dir * 0.03], [r, top, wall + dir * 0.03], [l, top, wall + dir * 0.03], 3, 2, null, sk.map((v) => v * 0.85));
    upright(lit, l + (dir > 0 ? 0.15 : -0.15), zf + dir * 0.27, r - (dir > 0 ? 0.15 : -0.15), zf + dir * 0.27, top + 0.03, top + 0.52, neon.uv(i));
    c.solid(xa - 0.04, Math.min(wall, zf + dir * 0.06), xb + 0.04, Math.max(wall, zf + dir * 0.06), { tall: false });
    c.light(mid, top - 0.5, zf - dir * 0.6, neon.colour(i), 0.9, { k: 1.3, far: 5.5 });
    const zc = zf - dir * 0.28, zr = (wall + zf) / 2, yr = top + 0.55, ry = dir > 0 ? 0 : Math.PI;
    if (kind === 'sandwich') { put('court:sandwich', sandwichVox, mid, zr, { y: yr, scale: 2.4, rot: R.range(-0.15, 0.15) }); put('court:sandwich', sandwichVox, mid, zc, { y: 1.0, scale: 0.9 }); }
    else if (kind === 'chips') { put('court:chip', chipVox, mid, zr, { y: yr, scale: 2.2, rot: 0.1 }); put('court:chip', chipVox, mid + 0.3, zr, { y: yr + 0.5, scale: 2.2, rot: -0.35, tilt: [0, 0.25] }); put('court:chip', chipVox, mid, zc, { y: 1.0, scale: 0.6 }); }
    else if (kind === 'soup') { put('court:pot', potVox, mid, zr, { y: yr, scale: 2.2 }); put('court:pot', potVox, mid - 0.5, zc, { y: 1.0, scale: 0.7 }); c.light(mid, yr + 1.6, zr, '#ffb347', 0.7, { k: 1.4, far: 4 }); }
    else if (kind === 'tray') { for (let y = yr, i = 0; y < H - 0.02; y += 0.05, i++) c.flat.box(mid - 0.24 + ((i * 7) % 3 - 1) * 0.02, y, zr - 0.17, mid + 0.24 + ((i * 7) % 3 - 1) * 0.02, y + 0.035, zr + 0.17, i % 2 ? [0.54, 0.23, 0.17] : [0.66, 0.27, 0.18]); for (const [dx, m] of [[-0.4, 14], [0.4, 6]]) for (let i = 0; i < m; i++) c.flat.box(mid + dx - 0.2, 1.0 + i * 0.05, zc - 0.15, mid + dx + 0.2, 1.035 + i * 0.05, zc + 0.15, i % 2 ? [0.54, 0.23, 0.17] : [0.66, 0.27, 0.18]); }
    else if (kind === 'hot') { for (let k = 0; k < 4; k++) { const x = xa + 0.5 + k * ((xb - xa - 1) / 3); c.flat.box(x - 0.14, top - 0.5, zc - 0.14, x + 0.14, top - 0.36, zc + 0.14, [0.3, 0.3, 0.32]); c.flat.box(x - 0.015, top - 0.36, zc - 0.015, x + 0.015, top, zc + 0.015, [0.2, 0.2, 0.22]); } c.light(mid, 1.8, zc, '#ff2a1e', 1.1, { k: 1.6, far: 3.5 }); put('court:kettle', kettleVox, mid, zr, { y: yr, scale: 7 }); }
    else { put('orange:juicer', juicerVox, mid - 0.6, zc, { y: 1.0, rot: ry }); for (let k = 0; k < 3; k++) put('orange:cup', cupVox, mid + k * 0.17, zc, { y: 1.0 }); put('court:orange', orangeVox(18, false), mid, zr, { y: yr, scale: 1.4 }); put('orange:heap:2', heapVox(2), mid + 0.7, zr, { y: yr, scale: 0.9 }); put('court:server', dummyVox(1, '#f4efe0', 'orange'), mid, zr, { rot: ry }); }
    return { mid, zc };
  };
  const made = [], n = 4, bw = (W - 0.8) / n;
  for (let i = 0; i < n; i++) made.push(stall(i, -W / 2 + 0.4 + i * bw + 0.15, -W / 2 + 0.4 + (i + 1) * bw - 0.15, -D / 2, 1));
  made.push(stall(4, -W / 2 + 0.5, -1.9, D / 2, -1)); made.push(stall(5, 1.9, W / 2 - 0.5, D / 2, -1));
  { const m = made[R.int(0, made.length - 1)]; c.leave('snack', m.mid + 0.55, m.zc, { y: 1.02 }); }

  /* the tables: in rows, clear of the hole and of the ways in; and for each, another on the roof over it */
  const tray = (x, y, z, up = 1) => { c.flat.box(x - 0.2, y, z - 0.15, x + 0.2, y + 0.02 * up, z + 0.15, [0.54, 0.23, 0.17]); c.flat.box(x - 0.15, y + 0.02 * up, z - 0.1, x + 0.15, y + 0.045 * up, z + 0.1, [0.66, 0.27, 0.18]); };   // (a tray with a tray on it, as plain as that: there are forty)
  let k = 0;
  for (let x = -W / 2 + 1.9; x <= W / 2 - 1.89; x += K.pitch) for (let z = -D / 2 + K.stall + 1.9; z <= D / 2 - K.stall - 1.8; z += K.pitch) {
    if (Math.abs(x) < hx + 1.25 && Math.abs(z) < hz + 1.25) continue;
    if (Math.abs(z) < 1.1 && Math.abs(x) > W / 2 - 2.7) continue;
    if (Math.abs(x) < 1.3 && z > D / 2 - K.stall - 2.6) continue;
    const key = 'court:tbl:' + (k % 4), rot = (k % 2) * 0.785, seat = seats[k % 4], mk = () => tableVox(seat)().downsample(2);   // (cut coarser: there are two dozen)
    c.model(key, mk, x, z, { rot, scale: 2, solid: false }); c.solid(x - 0.5, z - 0.5, x + 0.5, z + 0.5, { tall: false });
    put(key, mk, x, z, { y: H, scale: 2, rot: -rot, tilt: [Math.PI, 0] }); tray(x + 0.1, H - 0.76, z - 0.1, -1);
    if (R.chance(0.6)) tray(x + R.range(-0.15, 0.15), 0.76, z + R.range(-0.15, 0.15));
    if (k % 3 === 1) put('court:diner:' + (k % 4), dummyVox(k % 4, ['#39424f', '#7a3a34', '#4a5a40', '#6a4a8a'][k % 4]), x + 0.78, z, { rot: -Math.PI / 2 });               // somebody stood at one, facing their tray
    k++;
  }
  /* FOOD, over the hole, pointing down it */
  upright(lit, -1.3, hz - 0.2, 1.3, hz - 0.2, 3.3, 4.0, neon.uv(6)); upright(lit, 1.3, hz - 0.2, -1.3, hz - 0.2, 3.3, 4.0, neon.uv(6)); for (const x of [-1.25, 1.25]) c.flat.box(x - 0.02, 4.0, hz - 0.22, x + 0.02, H, hz - 0.18, [0.1, 0.1, 0.12]);
  const arrow = c.shining('court:arrow', kit.tex.white(), 2.2, [1, 0.24, 0.6]); for (let i = 0; i < 4; i++) arrow.box(-0.5 + i * 0.12, 3.15 - i * 0.14, hz - 0.22, 0.5 - i * 0.12, 3.25 - i * 0.14, hz - 0.18, [1, 1, 1]);
  c.light(0, 3.0, 0, '#ff3d9a', 0.9, { k: 1.2, far: 7 }); c.light(-W / 4, H - 1.2, 1.5, '#ffb02e', 0.8, { k: 1.2, far: 8 }); c.light(W / 4, H - 1.2, -1.5, '#35e0ff', 0.8, { k: 1.2, far: 8 });
  void M; void Vox;
}
