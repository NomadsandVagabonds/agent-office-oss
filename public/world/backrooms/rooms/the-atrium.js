// The Backrooms — a room of the shopping centre (themes.js `mall`): The
// Atrium ("the two floors of shops, and the way down to more"). A warehouse
// bay of the office park, eight metres to the deck, with a shopping centre
// stood up inside it by people going on what they had been told: that it is
// on more than one floor; that the shops have their names in light; that
// there are palms, and water, and moving stairs.
//
// So: a gallery of shops along the back, a storey up, and under its edge
// another row. Stairs that were meant to move, up to it. Beside them a second
// set going the other way, down through the floor to MORE SHOPS, of which
// there are none: that one is a hole, and whoever rides it is not seen again.
// On the other three walls the storeys go on up, each smaller than the one
// under it, to the roof. The only light is the signs. The fountain is a
// water cooler on a plinth of plinths. The palms are coat stands. The people
// in the windows are looking out.
import { ticks } from '../kit.js';
import { P } from '../bits.js';
import { upright, sheet } from '../suburb.js';
import { SHOPS, FRONTS, mallFronts, mallNeon, tube, dummyVox, palmVox, voidIn, orangeVox, juicerVox, cupVox, heapVox, shoeVox } from '../mall.js';
import { Vox, M, glow } from '../../vox/vox.js';

// gallery: how high, how deep · run: the length of a flight · wide: its width · bay: a shop's width · down: how far the wrong one can be walked
export const ATRIUM = Object.freeze({ gallery: 3.2, deep: 3.0, run: 6.2, wide: 1.1, bay: 2.7, down: 2.2, rail: 1.0 });

/** The fountain: tiers, dry, the coins still in it; and on top, what an office calls water. */
function fountainVox() {
  const v = new Vox(), stone = M('#b7a98a', 1), tile = M('#3f7f8f', 0), dark = M('#2c5a66', 0), coin = M('#c9a43a', 0);
  v.cyl('y', 0, 0, 0, 10, 56, stone); v.cyl('y', 0, 0, 10, 12, 58, stone); for (let y = 4; y < 12; y++) for (let a = 0; a < 6.283; a += 0.02) v.set(Math.round(Math.cos(a) * 50), y, Math.round(Math.sin(a) * 50), (Math.round(a * 8) + y) % 2 ? tile : dark);
  v.carve(-49, 6, -49, 49, 12, 49); v.cyl('y', 0, 0, 0, 5, 50, tile); v.cyl('y', 0, 0, 5, 26, 26, stone); v.cyl('y', 0, 0, 26, 28, 30, stone); v.cyl('y', 0, 0, 28, 46, 12, stone); v.cyl('y', 0, 0, 46, 48, 15, stone);
  for (let i = 0; i < 46; i++) { const a = i * 2.4, r = 30 + (i * 7) % 18; v.set(Math.round(Math.cos(a) * r), 6, Math.round(Math.sin(a) * r), coin); }
  v.rbox(-7, 48, -7, 7, 62, 7, 2, M('#e9e4d6', 0)); v.box(-2, 54, 7, 2, 56, 8, M('#3a70c9', 0)); v.cyl('y', 0, 0, 62, 86, 6.5, M('#9fd0e8', 0), 6.5); v.cyl('y', 0, 0, 86, 90, 3, M('#9fd0e8', 0)); v.cyl('y', 0, 0, 62, 70, 6.5, glow('#bfe6ff'));
  return v;
}
/** One tread of a moving stair that does not: ribbed, with the yellow edge. */
const TREAD = [0.34, 0.35, 0.37], EDGE = [0.85, 0.66, 0.12];

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = ATRIUM, G = K.gallery;
  const zE = -D / 2 + K.deep, xUp = -W / 4, xDn = W / 4, half = K.wide / 2, zTop = zE + K.run;       // the gallery's edge; the two flights; where they meet the floor
  c.shell({ floor: false, panels: false, skirting: false, wallAlb: [0.36, 0.34, 0.38],
    ceilTex: kit.tex.custom('atrium:deck', 32, 32, (g, w, h) => { P(g, '#15141a', 0, 0, w, h); for (let x = 0; x < w; x += 8) { P(g, '#1f1e26', x, 0, 3, h); P(g, '#0d0c11', x + 5, 0, 1, h); } }) });
  /* the floor as whoever walks here has it: the gallery, the flight up to it, the flight down and the hole it goes to */
  const onUp = (x, z) => Math.abs(x - xUp) < half && z >= zE && z <= zTop, onDn = (x, z) => Math.abs(x - xDn) < half && z >= zE + 0.3 && z <= zTop;
  const ground = (x, z) => (z < zE ? G : onUp(x, z) ? G * (1 - (z - zE) / K.run) : onDn(x, z) ? -Math.min(1.0, (zTop - z) * 0.5) : 0);
  voidIn(c, (x, z) => onDn(x, z) && zTop - z > K.down, { floor: ground });

  /* terrazzo below, the gallery's deck above; the edge of the deck, in brass */
  const fl = c.floor, rect = (xa, xb, za, zb, y) => { if (xb - xa > 0.01 && zb - za > 0.01) fl.grid([xa, y, za], [0, 0, 1], [1, 0, 0], ticks(zb - za), ticks(xb - xa), (u, v) => [(xa + v + c.room.cx) / 1.6, (za + u + c.room.cz) / 1.6]); };
  rect(-W / 2, xDn - half, zE, D / 2, 0); rect(xDn + half, W / 2, zE, D / 2, 0); rect(xDn - half, xDn + half, zTop, D / 2, 0); rect(-W / 2, W / 2, -D / 2, zE, G);
  c.flat.box(-W / 2, G - 0.22, zE - 0.02, W / 2, G, zE + 0.06, [0.66, 0.52, 0.2]);

  /* the shops: a row under the gallery's edge, a row on it against the back wall; each with its name in tube over it */
  const art = mallFronts(kit), fronts = c.mapped('mall:fronts', art.texture), bays = Math.floor(W / K.bay), bw = W / bays;
  const names = R.shuffle(SHOPS.slice()), neon = mallNeon(kit, 'atrium:' + p.seed, names, p.seed), lit = c.shining('mall:neon:atrium:' + p.seed, neon.texture, 2.4, undefined, { bloom: 2 });
  const kinds = (row) => R.shuffle(['window', 'office', 'blinds', 'half', 'shutter', 'hoarding', 'door', 'window', 'open', 'office']).slice(0, bays).map((k, i) => (row && i === 1 ? 'window' : k));
  const lower = kinds(0), upper = kinds(1);
  // Three of the lower row are not painted: they go back, a stride and a half, and what they sell is in them
  const free = R.shuffle(Array.from({ length: bays }, (_, i) => i).filter((i) => { const m = -W / 2 + (i + 0.5) * bw; return Math.abs(m - xUp) > half + 0.3 + bw / 2 && Math.abs(m - xDn) > half + 0.3 + bw / 2; }));
  const real = new Map([[free[0], 'orange'], [free[1], 'shoes'], [free[2], 'people']].filter(([i]) => i !== undefined));
  const recess = (i, what) => {
    const xa = -W / 2 + i * bw + 0.12, xb = xa + bw - 0.24, zb = zE - 1.25, top = G - 0.3, mid = (xa + xb) / 2;
    const skin = what === 'orange' ? [0.95, 0.55, 0.14] : what === 'shoes' ? [0.42, 0.3, 0.2] : [0.2, 0.18, 0.24];
    sheet(c.flat, [xa, 0, zb], [xb, 0, zb], [xb, top, zb], [xa, top, zb], 3, 3, null, skin); sheet(c.flat, [xa, 0, zE], [xa, 0, zb], [xa, top, zb], [xa, top, zE], 2, 3, null, skin.map((v) => v * 0.8)); sheet(c.flat, [xb, 0, zb], [xb, 0, zE], [xb, top, zE], [xb, top, zb], 2, 3, null, skin.map((v) => v * 0.8));
    sheet(c.flat, [xa, 0.02, zb], [xa, 0.02, zE], [xb, 0.02, zE], [xb, 0.02, zb], 2, 3, null, [0.5, 0.46, 0.4]); sheet(c.flat, [xa, top, zE], [xa, top, zb], [xb, top, zb], [xb, top, zE], 2, 3, null, [0.16, 0.15, 0.18]);
    for (const x of [xa - 0.06, xb]) c.flat.box(x, 0, zE - 0.05, x + 0.06, top, zE + 0.03, [0.66, 0.52, 0.2]); c.flat.box(xa - 0.06, top, zE - 0.05, xb + 0.06, top + 0.08, zE + 0.03, [0.66, 0.52, 0.2]);   // a brass frame, and no glass in it
    c.light(mid, top - 0.5, zE - 0.5, what === 'orange' ? '#ffb02e' : what === 'shoes' ? '#ffe2a8' : '#b46bff', 0.8, { k: 1.4, far: 4 });
    const put = (key, make, x, z, o = {}) => c.model(key, make, x, z, { solid: false, shadow: false, ...o });
    if (what === 'orange') {
      c.flat.box(xa + 0.1, 0, zE - 0.5, xb - 0.1, 0.95, zE - 0.14, [0.94, 0.52, 0.12]); c.flat.box(xa + 0.06, 0.95, zE - 0.54, xb - 0.06, 1.0, zE - 0.1, [0.93, 0.9, 0.82]);
      for (let x = xa + 0.1; x < xb - 0.2; x += 0.4) c.flat.box(x, 0.02, zE - 0.14, x + 0.2, 0.9, zE - 0.13, [0.96, 0.94, 0.88]);
      put('orange:juicer', juicerVox, xa + 0.5, zE - 0.34, { y: 1.0, rot: Math.PI }); for (let k = 0; k < 4; k++) put('orange:cup', cupVox, mid - 0.2 + k * 0.17, zE - 0.28 - (k % 2) * 0.1, { y: 1.0 });
      put('atrium:orange', orangeVox(16, false), xb - 0.55, zE - 0.75, { y: 1.5 }); put('orange:heap:1', heapVox(1), xb - 0.5, zE - 0.85, { scale: 0.9 });
      put('atrium:server', dummyVox(1, '#f4efe0', 'orange'), mid - 0.1, zE - 0.95, { rot: 0 });
    } else if (what === 'shoes') {
      const cols = ['#3a2a1c', '#17171a', '#7a3a34', '#c9b08a'];
      for (let r = 0; r < 5; r++) { c.flat.box(xa + 0.05, 0.35 + r * 0.42, zb, xb - 0.05, 0.38 + r * 0.42, zb + 0.32, [0.6, 0.46, 0.3]); for (let k = 0; k < 7; k++) put('atrium:shoe:' + ((r + k) % 4), shoeVox(cols[(r + k) % 4]), xa + 0.25 + k * ((xb - xa - 0.5) / 6), zb + 0.17, { y: 0.38 + r * 0.42, rot: -1.5708 }); }
      put('atrium:shoe:0', shoeVox(cols[0]), mid, zE - 0.45, { y: 0.02, scale: 5, rot: -1.2 });                    // …and the one in the window, which is the size they thought a shoe is
    } else {
      for (let k = 0; k < 7; k++) put('atrium:dummy:' + (k % 4), dummyVox(k % 4, ['#39424f', '#7a3a34', '#4a5a40', '#6a4a8a'][k % 4]), xa + 0.3 + (k % 4) * ((xb - xa - 0.6) / 3) + (k > 3 ? 0.25 : 0), k > 3 ? zE - 0.85 : zE - 0.28, { rot: 0, scale: k === 5 ? 1.25 : 1 });   // a shop full of them, up at the front, as near as they can get
    }
  };
  for (let i = 0; i < bays; i++) {
    const xa = -W / 2 + i * bw, xb = xa + bw, up = Math.abs((xa + xb) / 2 - xUp) < half + 0.3, dn = Math.abs((xa + xb) / 2 - xDn) < half + 0.3;
    if (real.has(i)) recess(i, real.get(i)); else upright(fronts, xa, zE, xb, zE, 0, G - 0.22, art.uv(up || dn ? 'shutter' : lower[i]));                                                // (behind a flight: shut)
    upright(fronts, xa, -D / 2 + 0.03, xb, -D / 2 + 0.03, G, G + 2.7, art.uv(upper[i]));
    upright(lit, xa + 0.25, -D / 2 + 0.05, xb - 0.25, -D / 2 + 0.05, G + 2.75, G + 3.3, neon.uv(i % 8));
    if (!up && !dn) upright(lit, xa + 0.3, zE + 0.08, xb - 0.3, zE + 0.08, G - 0.95, G - 0.42, neon.uv((i + 4) % 8));
    if (i % 2 === 0) c.light((xa + xb) / 2, G + 2.6, -D / 2 + 1.0, neon.colour(i % 8), 0.9, { k: 1.3, far: 7 });
    else if (!real.has(i)) c.light((xa + xb) / 2, 2.0, zE + 1.1, neon.colour((i + 4) % 8), 0.8, { k: 1.3, far: 6 });
  }
  c.solid(-W / 2, zE - 0.3, xUp - half, zE, { tall: true }); c.solid(xUp + half, zE - 0.3, W / 2, zE, { tall: false });            // under the gallery, behind the fronts: nowhere
  // …and on the other three walls the storeys go on up, each smaller than the last, because that is what was said: it goes up and up
  const storey = (side, y0, h, n) => { const len = side === 'front' ? W : D, bwid = len / n; for (let i = 0; i < n; i++) { const a = -len / 2 + i * bwid, b = a + bwid, k = FRONTS[(i * 3 + n) % FRONTS.length];
    for (const flip of [0, 1]) { const [p0, p1] = flip ? [b, a] : [a, b]; if (side === 'front') upright(fronts, p0, D / 2 - 0.03 - flip * 0.001, p1, D / 2 - 0.03 - flip * 0.001, y0, y0 + h, art.uv(k)); else if (b > zE) { const x = side === 'left' ? -W / 2 + 0.03 + flip * 0.001 : W / 2 - 0.03 - flip * 0.001; upright(fronts, x, Math.max(p0, zE), x, Math.max(p1, zE), y0, y0 + h, art.uv(k)); } } } };
  for (const side of ['front', 'left', 'right']) { let y = 2.7, h = 1.9, n = Math.round((side === 'front' ? W : D) / 2.2); while (y + h < H - 0.2) { storey(side, y, h, n); c.flat.box(side === 'front' ? -W / 2 : side === 'left' ? -W / 2 : W / 2 - 0.08, y - 0.06, side === 'front' ? D / 2 - 0.08 : zE, side === 'front' ? W / 2 : side === 'left' ? -W / 2 + 0.08 : W / 2, y, D / 2, [0.5, 0.4, 0.16]); y += h; h *= 0.68; n = Math.round(n * 1.45); } }

  /* the flight up: treads that were meant to move, a balustrade either side, a rail in tube */
  const flight = (x, dir, steps, yOf, z0, z1) => { for (let i = 0; i < steps; i++) { const za = z0 + (z1 - z0) * (i / steps), zb = z0 + (z1 - z0) * ((i + 1) / steps), y = yOf((za + zb) / 2); c.flat.box(x - half, Math.min(0, y) - 0.02, Math.min(za, zb), x + half, y, Math.max(za, zb), TREAD); c.flat.box(x - half, y - 0.012, dir > 0 ? Math.max(za, zb) - 0.04 : Math.min(za, zb), x + half, y + 0.004, dir > 0 ? Math.max(za, zb) : Math.min(za, zb) + 0.04, EDGE); } };
  flight(xUp, 1, 20, (z) => G * (1 - (z - zE) / K.run) + 0.08, zE, zTop);
  const rails = c.shining('atrium:rail', kit.tex.white(), 2.2, [1, 0.24, 0.6]), cyan = c.shining('atrium:rail2', kit.tex.white(), 2.2, [0.2, 0.88, 1]);
  const side = (batch, x, za, ya, zb, yb) => { sheet(c.flat, [x, ya - 0.05, za], [x, yb - 0.05, zb], [x, yb + 0.85, zb], [x, ya + 0.85, za], 6, 1, null, [0.12, 0.13, 0.16]); sheet(c.flat, [x, yb - 0.05, zb], [x, ya - 0.05, za], [x, ya + 0.85, za], [x, yb + 0.85, zb], 6, 1, null, [0.12, 0.13, 0.16]);
    sheet(batch, [x - 0.03, ya + 0.86, za], [x - 0.03, yb + 0.86, zb], [x + 0.03, yb + 0.86, zb], [x + 0.03, ya + 0.86, za], 1, 1, null); sheet(batch, [x - 0.03, ya + 0.86, za], [x + 0.03, ya + 0.86, za], [x + 0.03, yb + 0.86, zb], [x - 0.03, yb + 0.86, zb], 1, 1, null); };
  for (const s of [-1, 1]) { side(rails, xUp + s * (half + 0.04), zTop, 0, zE, G); c.solid(xUp + s * (half + 0.04) - 0.04, zE, xUp + s * (half + 0.04) + 0.04, zTop, { tall: false }); }
  /* the flight down: the same, going into the floor, to MORE SHOPS */
  flight(xDn, -1, 22, (z) => -(zTop - z) * 0.5, zTop, zE + 0.3);
  { const glowing = c.shining('atrium:treads', kit.tex.white(), 1.1, [0.9, 0.7, 0.14]); for (let i = 0; i < 14; i++) { const z = zTop - (i + 1) * ((K.run - 0.3) / 22), y = -(zTop - z) * 0.5 + 0.012; sheet(glowing, [xDn - half, y, z], [xDn - half, y, z + 0.05], [xDn + half, y, z + 0.05], [xDn + half, y, z], 1, 1, null); } }   // the edge of each tread, lit, going down until they stop
  for (const s of [-1, 1]) { side(cyan, xDn + s * (half + 0.04), zTop, 0, zE + 0.3, -(K.run - 0.3) * 0.5); c.solid(xDn + s * (half + 0.04) - 0.05, zE + 0.2, xDn + s * (half + 0.04) + 0.05, zTop, { tall: false }); }
  c.solid(xDn - half - 0.1, zE + 0.1, xDn + half + 0.1, zE + 0.25, { tall: false });
  { const dark = c.mapped('atrium:void', kit.tex.custom('atrium:void', 4, 4, (g) => P(g, '#000', 0, 0, 4, 4))), k = [0, 0, 0], xa = xDn - half, xb = xDn + half, y = -9;
    sheet(dark, [xa, y, zE + 0.3], [xa, y, zTop], [xa, 0, zTop], [xa, 0, zE + 0.3], 1, 1, null, k); sheet(dark, [xb, y, zTop], [xb, y, zE + 0.3], [xb, 0, zE + 0.3], [xb, 0, zTop], 1, 1, null, k); sheet(dark, [xa, y, zE + 0.3], [xb, y, zE + 0.3], [xb, 0, zE + 0.3], [xa, 0, zE + 0.3], 1, 1, null, k); sheet(dark, [xb, y, zTop], [xa, y, zTop], [xa, -0.02, zTop], [xb, -0.02, zTop], 1, 1, null, k); }
  const more = mallNeon(kit, 'atrium:more', ['MORE SHOPS', 'LOWER LEVEL', 'UP UP UP', 'THIS WAY UP', 'UP', 'UP', 'LOWER LEVEL', 'MORE SHOPS'], 3), moreB = c.shining('mall:neon:atrium:more', more.texture, 2.6, undefined, { bloom: 2 });
  upright(moreB, xDn + 1.0, zTop + 0.25, xDn - 1.0, zTop + 0.25, 2.25, 2.75, more.uv(0)); upright(moreB, xDn - 1.0, zTop + 0.25, xDn + 1.0, zTop + 0.25, 2.25, 2.75, more.uv(1));
  upright(moreB, xUp + 0.8, zTop + 0.25, xUp - 0.8, zTop + 0.25, 2.3, 2.7, more.uv(2)); upright(moreB, xUp - 0.8, zTop + 0.25, xUp + 0.8, zTop + 0.25, 2.3, 2.7, more.uv(3));
  for (const x of [xDn - 1.0, xDn + 1.0, xUp - 0.8, xUp + 0.8]) c.flat.box(x - 0.02, 2.75, zTop + 0.23, x + 0.02, H, zTop + 0.27, [0.1, 0.1, 0.12]);
  c.light(xDn, 1.9, zTop + 0.9, '#35e0ff', 1.0, { k: 1.2, far: 6 }); c.light(xUp, 1.9, zTop + 0.9, '#ff3d9a', 1.0, { k: 1.2, far: 6 });

  /* the gallery's rail: brass, and a tube along the top of it; open where the flight comes up */
  for (const [xa, xb] of [[-W / 2, xUp - half - 0.08], [xUp + half + 0.08, W / 2]]) { for (const y of [K.rail, K.rail * 0.5]) c.flat.box(xa, G + y - 0.03, zE + 0.08, xb, G + y + 0.03, zE + 0.14, [0.66, 0.52, 0.2]); for (let x = xa + 0.2; x < xb; x += 1.2) c.flat.box(x - 0.03, G, zE + 0.08, x + 0.03, G + K.rail, zE + 0.14, [0.66, 0.52, 0.2]);
    sheet(rails, [xa, G + K.rail + 0.04, zE + 0.16], [xb, G + K.rail + 0.04, zE + 0.16], [xb, G + K.rail + 0.1, zE + 0.16], [xa, G + K.rail + 0.1, zE + 0.16], 1, 1, null); }

  /* the concourse: water, palms, and the people who came */
  const cz = Math.min((zTop + D / 2) / 2 + 0.2, D / 2 - 2.6);                                          // (clear of the way in at the front)
  c.model('atrium:fountain', fountainVox, 0, cz, { solid: false }); c.solid(-1.45, cz - 1.45, 1.45, cz + 1.45, { tall: false }); c.light(0, 2.6, cz, '#bfe6ff', 0.9, { k: 1.2, far: 6 });
  for (const [sx, sz] of [[-1, 1], [1, 1]]) { const x = sx * (W / 2 - 1.3), z = sz > 0 ? D / 2 - 1.3 : zTop + 0.4 + (sx > 0 ? 1.2 : 0); if (Math.abs(z) < 1.3) continue; c.model('atrium:palm', palmVox, x, z, { rot: R.range(0, 6), scale: 1.25, solid: false }); c.solid(x - 0.3, z - 0.3, x + 0.3, z + 0.3, { tall: false }); }
  const dress = ['#39424f', '#7a3a34', '#4a5a40', '#6a4a8a'];
  for (let i = 0; i < 4; i++) { const a = (i < 2 ? -1 : 1) * (1.15 + (i % 2) * 0.55), x = Math.sin(a) * 2.2, z = Math.min(D / 2 - 1.7, cz + Math.cos(a) * 2.2); c.model('atrium:dummy:' + i, dummyVox(i, dress[i]), x, z, { rot: Math.atan2(-x, D / 2 - z), scale: i === 3 ? 0.62 : 1, solid: false }); c.solid(x - 0.2, z - 0.2, x + 0.2, z + 0.2, { tall: false }); }   // a family, facing the way in
  for (let i = 0; i < bays; i++) if (upper[i] === 'window') c.model('atrium:dummy:' + (i % 4), dummyVox(i % 4, dress[i % 4]), -W / 2 + (i + 0.5) * bw + R.range(-0.5, 0.5), -D / 2 + 0.5, { y: G, rot: 0, solid: false, shadow: false });        // up on the gallery, at the rail side of the glass, looking down

  /* the detail: what stands proud and gives the place its depth. In a batch of its own (atrium:detail) so a low setting can leave it out;
     nothing in it is walked into, stood on or read */
  const det = c.mapped('atrium:detail', kit.tex.white(), { detail: true }), steel = [0.42, 0.4, 0.44], brassD = [0.66, 0.52, 0.2], cream = [0.86, 0.82, 0.74];
  // the gallery's underside: a soffit with a fascia, and downlights let into it, every 1.6 m, lit
  det.box(-W / 2, G - 0.36, zE - 0.05, W / 2, G - 0.22, zE + 0.1, [0.2, 0.19, 0.22]);
  const cans = c.shining('atrium:cans', kit.tex.white(), 1.8, [1, 0.92, 0.78], { detail: true });
  for (let x = -W / 2 + 0.8; x < W / 2 - 0.4; x += 1.6) { if (Math.abs(x - xUp) < half + 0.2 || Math.abs(x - xDn) < half + 0.2) continue; const z = zE - 0.7;
    det.box(x - 0.13, G - 0.24, z - 0.13, x + 0.13, G - 0.22, z + 0.13, steel); cans.box(x - 0.08, G - 0.245, z - 0.08, x + 0.08, G - 0.24, z + 0.08, [1, 1, 1]); }
  // the gallery's columns: round, clad in brass bands, with a capital and a plinth; real, so they are walked round
  for (let x = -W / 2 + K.bay; x < W / 2 - 0.5; x += K.bay * 2) { if (Math.abs(x - xUp) < half + 0.8 || Math.abs(x - xDn) < half + 0.8) continue; const z = zE + 0.35;
    c.model('atrium:column', () => { const v = new Vox(), m = M('#c9c0ae', 1), b = M('#a8843a', 0), d = M('#2a2830', 0); const top = Math.round((G - 0.36) / 0.025);
      v.rbox(-9, 0, -9, 9, 5, 9, 2, d); v.cyl('y', 0, 0, 5, top - 6, 6.5, m); for (let y = 20; y < top - 10; y += 22) v.cyl('y', 0, 0, y, y + 2, 7, b); v.cyl('y', 0, 0, top - 6, top - 3, 8, b); v.rbox(-9, top - 3, -9, 9, top, 9, 1, d); return v; }, x, z, { solid: false });
    c.solid(x - 0.2, z - 0.2, x + 0.2, z + 0.2, { tall: true }); }
  // benches round the fountain, facing it; a bin by each; and a directory, which is a map of a different floor
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, r = 2.25, bx = Math.sin(a) * r, bz = cz + Math.cos(a) * r; if (bz > D / 2 - 1.2 || bz < zTop + 0.4) continue;
    c.model('atrium:bench', () => { const v = new Vox(), wood = M('#7a4f2a', 3), iron = M('#2a2830', 0); for (const x of [-26, 26]) { v.box(x - 1, 0, -7, x + 1, 16, -6, iron); v.box(x - 1, 0, 6, x + 1, 16, 7, iron); v.box(x - 1, 15, -8, x + 1, 17, 8, iron); v.box(x - 1, 17, 6, x + 1, 32, 8, iron); } for (let z = -7; z <= 3; z += 3.5) v.box(-30, 17, z, 30, 18, z + 2.5, wood); for (let y = 21; y <= 30; y += 4) v.box(-30, y, 7, 30, y + 2.5, 8, wood); return v; }, bx, bz, { rot: a + Math.PI, solid: false });
    c.solid(bx - 0.75, bz - 0.75, bx + 0.75, bz + 0.75, { tall: false }); }
  { const tx = -W / 2 + 1.0, tz = zTop + 1.2; if (Math.abs(tz) > 1.6 || tx < -W / 2 + 2) { c.flat.box(tx - 0.3, 0, tz - 0.1, tx + 0.3, 2.0, tz + 0.1, [0.16, 0.15, 0.18]); c.solid(tx - 0.32, tz - 0.12, tx + 0.32, tz + 0.12, { tall: true });
    const map = c.shining('atrium:map', kit.tex.custom('atrium:map', 64, 128, (g, w, h) => { P(g, '#1a1820', 0, 0, w, h); P(g, '#f1ead6', 3, 3, w - 6, 18); for (let k = 0; k < 9; k++) { P(g, ['#ff3d9a', '#35e0ff', '#ffb02e'][k % 3], 6 + (k % 3) * 18, 26 + Math.floor(k / 3) * 26, 15, 22); } P(g, '#b3261e', 30, 110, 5, 5); P(g, '#f1ead6', 3, 118, w - 6, 6); }), 1.2);
    upright(map, tx - 0.26, tz + 0.105, tx + 0.26, tz + 0.105, 0.5, 1.9, [0, 0, 1, 1]); upright(map, tx + 0.26, tz - 0.105, tx - 0.26, tz - 0.105, 0.5, 1.9, [0, 0, 1, 1]); } }
  // the gallery's railing: a brass handrail with a round top and glass panels between the posts
  const glassR = c.mapped('mall:glass', kit.tex.custom('mall:glass', 32, 64, (g, gw, gh) => { g.clearRect(0, 0, gw, gh); g.fillStyle = 'rgba(255,255,255,0.28)'; for (let y = 0; y < gh; y++) { if (y % 9 < 6) g.fillRect(6 + y * 0.18 | 0, y, 2, 1); if (y % 13 < 4) g.fillRect(17 + y * 0.18 | 0, y, 1, 1); } g.fillStyle = 'rgba(200,190,170,0.5)'; g.fillRect(0, gh - 3, gw, 3); }), { cutout: true });
  for (const [xa, xb] of [[-W / 2, xUp - half - 0.08], [xUp + half + 0.08, W / 2]]) { for (let x = xa + 0.2; x < xb - 0.2; x += 1.2) { const x1 = Math.min(xb - 0.05, x + 1.2); upright(glassR, x + 0.05, zE + 0.11, x1 - 0.05, zE + 0.11, G + 0.08, G + 0.92, [0, 0, 1, 1]); upright(glassR, x1 - 0.05, zE + 0.11, x + 0.05, zE + 0.11, G + 0.08, G + 0.92, [0, 0, 1, 1]); }
    det.box(xa, G + K.rail - 0.02, zE + 0.06, xb, G + K.rail + 0.04, zE + 0.16, brassD); }
  void tube; void glow; void M; void Vox; void cream;
}
