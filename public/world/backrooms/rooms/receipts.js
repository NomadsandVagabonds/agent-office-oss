// The Backrooms — a shop of the shopping centre (themes.js `mall`): The
// Receipt Shop ("the shop that sells bags"). Somebody was told that what you
// come away from a shop with is a bag, and in the bag, a receipt. So this is
// what is sold: bags, on shelves to the roof, each with a receipt in it for
// the bag. The tills along the back print, and have never stopped; what they
// have printed hangs from the roof in long curls and lies in drifts. One of
// them has a receipt still coming out of it, along the floor, and it goes
// wherever whoever came in has been.
import * as THREE from 'three';
import { P } from '../bits.js';
import { Vox, M } from '../../vox/vox.js';
import { garble, upright, sheet } from '../suburb.js';
import { mallNeon, wallFace } from '../mall.js';

// counter: how far out from the back wall the tills stand · aisle: between the shelves · speed: how fast the long one comes out (m/s)
export const RECEIPTS = Object.freeze({ counter: 1.6, aisle: 1.3, speed: 0.55, crumb: 0.35, most: 60 });
const PAPER = [0.93, 0.91, 0.84];

/** A carrier bag: two handles, a fold, and what is in it showing over the top. */
function bagVox(colour) { return () => { const v = new Vox(), c = M(colour, 1); v.box(-6, 0, -2, 6, 14, 2, c); v.box(-6, 13, -2, 6, 14, 2, M('#2a2a2a', 0)); for (const x of [-3, 3]) v.tube(x, 14, 0, x, 19, 0, 0.5, c); v.tube(-3, 19, 0, 3, 19, 0, 0.5, c); v.box(-2, 12, -1, 2, 18, -1, M('#f2efe4', 0)); return v; }; }
/** A till: a drawer, keys, a little screen, and the slot the paper comes out of. */
function tillVox() { const v = new Vox(), b = M('#3a3f46', 0), k = M('#d9d2bf', 0); v.rbox(-10, 0, -8, 10, 6, 8, 1, b); v.box(-9, 6, -6, 9, 10, 4, b); for (let x = -7; x <= 6; x += 3) for (let z = -4; z <= 2; z += 3) v.box(x, 10, z, x + 1, 11, z + 1, k); v.box(-4, 10, 4, 4, 18, 6, b); v.box(-3, 12, 6, 3, 16, 6, M('#3fdc6a', 0)); v.box(5, 10, -8, 9, 13, -6, b); v.box(6, 13, -8, 8, 13, -8, M('#f2efe4', 0)); return v; }

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = RECEIPTS, env = c.env;
  c.shell({ panels: false });
  const zc = -D / 2 + K.counter;
  /* the counter and the tills; over it, the name */
  c.flat.box(-W / 2 + 0.3, 0, zc - 0.55, W / 2 - 0.3, 0.95, zc, [0.36, 0.3, 0.26]); c.flat.box(-W / 2 + 0.25, 0.95, zc - 0.6, W / 2 - 0.25, 1.0, zc + 0.05, [0.85, 0.82, 0.74]); c.solid(-W / 2, zc - 0.6, W / 2, zc + 0.05, { tall: false });
  const tills = [], nt = Math.max(2, Math.floor((W - 1.2) / 1.5));
  for (let i = 0; i < nt; i++) { const x = -W / 2 + 0.9 + i * ((W - 1.8) / (nt - 1)); c.model('receipts:till', tillVox, x, zc - 0.3, { y: 1.0, rot: Math.PI, scale: 1, solid: false, shadow: false }); tills.push(x); }
  const neon = mallNeon(kit, 'receipts:' + p.seed, ['THE RECEIPT SHOP', 'ALL SALES FINAL', 'BAGS', 'RECEIPTS', 'KEEP YOUR RECEIPT', 'NO RECEIPT NO', 'RECEIPT SHOP', 'BAGS FOR LIFE'], p.seed), lit = c.shining('mall:neon:receipts:' + p.seed, neon.texture, 2.4);
  upright(lit, -W / 2 + 0.6, -D / 2 + 0.04, W / 2 - 0.6, -D / 2 + 0.04, H - 0.85, H - 0.25, neon.uv(0)); upright(lit, -W / 4, -D / 2 + 0.04, W / 4, -D / 2 + 0.04, H - 1.5, H - 1.05, neon.uv(1));
  c.light(0, H - 0.8, zc + 0.5, '#ffd9a0', 0.8, { k: 1.3, far: 6 });
  /* the shelves: two runs down the room, to the roof, bags on every shelf */
  const cols = ['#e8e2d0', '#b3261e', '#2a4a6a', '#3f7a3a', '#e8c040'], runs = W >= 7.5 ? [-W / 6, W / 6] : [0], zs = zc + 1.2, ze = D / 2 - 1.4;
  for (const x of runs) {
    c.flat.box(x - 0.32, 0, zs, x + 0.32, H - 0.3, ze, [0.55, 0.55, 0.58]); c.solid(x - 0.35, zs, x + 0.35, ze, { tall: true });
    for (let y = 0.3, row = 0; y < H - 0.6; y += 0.42, row++) { for (const s of [-1, 1]) { c.flat.box(x + s * 0.32, y - 0.02, zs, x + s * 0.5, y, ze, [0.7, 0.7, 0.72]); for (let z = zs + 0.2; z < ze - 0.15; z += 0.32) if (R.chance(0.85)) { const k = (((row + Math.round(z * 3)) % 5) + 5) % 5; c.model('receipts:bag:' + k, bagVox(cols[k]), x + s * 0.42, z, { y, rot: s > 0 ? 0 : Math.PI, tilt: [0, R.range(-0.08, 0.08)], scale: 1.25, solid: false, shadow: false }); } } }
  }
  /* what the tills have printed: hanging from the roof in curls, lying in drifts */
  const paper = c.mapped('receipts:paper', kit.tex.custom('receipts:paper', 32, 128, (g, w, h) => { P(g, '#efece2', 0, 0, w, h); for (let y = 6; y < h; y += 7) garble(g, ['1 BAG', 'RECEIPT', '1 RECEIPT', 'BAG', 'TOTAL', 'VAT', 'THANK YOU', 'AGAIN'][(y / 7) % 8 | 0], 2, y - 2, w - 4, 6, { color: '#55524a', mess: 0.35, weight: 400 }, y); P(g, '#c9c5b8', 0, 0, 1, h); }));
  for (let i = 0; i < 14; i++) {
    const x0 = R.range(-W / 2 + 0.5, W / 2 - 0.5), z0 = R.range(zc + 0.4, D / 2 - 0.5); if (runs.some((x) => Math.abs(x0 - x) < 0.7 && z0 > zs - 0.2 && z0 < ze + 0.2)) continue;
    const ph = R.range(0, 6), len = H - R.range(0, 1.6), n = 14;
    let prev = null; for (let k = 0; k <= n; k++) { const t = k / n, y = H - t * len, x = x0 + Math.sin(ph + t * 9) * 0.08 * t, z = z0 + Math.cos(ph + t * 7) * 0.08 * t, cur = [[x - 0.04, y, z], [x + 0.04, y, z]]; if (prev) { sheet(paper, prev[0], prev[1], cur[1], cur[0], 1, 1, [0, 1 - (k - 1) / n, 1, 1 - k / n], PAPER); sheet(paper, prev[1], prev[0], cur[0], cur[1], 1, 1, [0, 1 - (k - 1) / n, 1, 1 - k / n], PAPER); } prev = cur; }
    if (len > H - 0.3) c.flat.box(x0 - 0.2, 0, z0 - 0.15, x0 + 0.2, 0.06, z0 + 0.15, PAPER);                                               // where it reached the floor, the rest of it, folded on itself
  }
  for (const [x, z] of [[-W / 2 + 0.7, D / 2 - 0.7], [W / 2 - 0.7, zc + 0.8]]) if (c.clear(x, z, 0.6)) { for (let k = 0; k < 9; k++) c.flat.box(x - 0.5 + R.range(0, 0.2), k * 0.05, z - 0.4 + R.range(0, 0.2), x + 0.5 - R.range(0, 0.2), k * 0.05 + 0.04, z + 0.4 - R.range(0, 0.2), PAPER); c.solid(x - 0.5, z - 0.4, x + 0.5, z + 0.4, { tall: false }); }
  /* the long one: it comes out of the till nearest the middle and goes, along the floor, wherever the visitor has been in here */
  const start = tills.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a)), trail = [[start, zc + 0.15]], crumbs = [];
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(K.most * 2 * 3 * 3 * 2), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.78, 0.76, 0.7), side: THREE.DoubleSide });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; c.add(mesh);
  let len = 0;
  const draw = () => {
    let i = 0, left = len; const put = (x, y, z) => { pos[i++] = x; pos[i++] = y; pos[i++] = z; };
    for (let k = 1; k < trail.length && left > 0; k++) {
      const [ax, az] = trail[k - 1], [bx0, bz0] = trail[k], seg = Math.hypot(bx0 - ax, bz0 - az), f = Math.min(1, left / Math.max(1e-6, seg)), bx = ax + (bx0 - ax) * f, bz = az + (bz0 - az) * f; left -= seg;
      const nx = -(bz - az) / Math.max(1e-6, seg) * 0.04, nz = (bx - ax) / Math.max(1e-6, seg) * 0.04, ya = k === 1 ? 1.0 : 0.012, yb = 0.012;
      put(ax - nx, ya, az - nz); put(bx - nx, yb, bz - nz); put(bx + nx, yb, bz + nz); put(ax - nx, ya, az - nz); put(bx + nx, yb, bz + nz); put(ax + nx, ya, az + nz);
    }
    geo.attributes.position.needsUpdate = true; geo.setDrawRange(0, i / 3);
  };
  trail.push([start, zc + 0.5]);
  c.tick((dt, t, me) => {
    if (!me.inside) return;
    const last = crumbs[crumbs.length - 1];
    if (!last || Math.hypot(me.x - last[0], me.z - last[1]) > K.crumb) { crumbs.push([me.x, me.z]); if (trail.length < K.most) trail.push([me.x, me.z]); }
    let total = 0; for (let k = 1; k < trail.length; k++) total += Math.hypot(trail[k][0] - trail[k - 1][0], trail[k][1] - trail[k - 1][1]);
    if (len < total) { len = Math.min(total, len + K.speed * dt); draw(); if (Math.random() < dt * 3) { const w = c.toWorld(start, zc); env.play?.('click', w.x, w.z, 4); } }
  });
}
