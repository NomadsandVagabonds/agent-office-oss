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
import { Vox, M, tone } from '../../vox/vox.js';
import { garble, upright, sheet } from '../suburb.js';
import { mallNeon, wallFace } from '../mall.js';

// counter: how far out from the back wall the tills stand · aisle: between the shelves · speed: how fast the long one comes out (m/s)
export const RECEIPTS = Object.freeze({ counter: 1.6, aisle: 1.3, speed: 0.55, crumb: 0.35, most: 60 });
const PAPER = [0.93, 0.91, 0.84];

/** The bags, each with its receipt showing over the top, front face toward +z: 0 a carrier (gussets, a printed square, cut handles),
 * 1 a paper one (a turned-down lip, twisted cords), 2 a gift bag (tissue out of the top, ribbon handles). Short enough for a shelf. */
function bagVox(kind, colour) { return () => {
  const v = new Vox(), c = M(colour, 1), d = M(tone(colour, -0.18), 1), slip = M('#f2efe4', 0), ink = M('#55524a', 0);
  const receipt = (x, y0, y1) => { v.box(x, y0, -1, x + 3, y1, 0, slip); v.box(x + 1, y1 - 3, 0, x + 2, y1 - 2, 0, ink); };   // (one line of print: every colour on a face costs it its merge)
  if (kind === 0) {
    v.box(-6, 0, -2, 6, 11, 2, c); v.box(-6, 10, -2, 6, 11, 2, d);   // body, the welt
    v.box(-2, 4, 2, 2, 8, 2 + 1, M(tone(colour, 0.35), 1)); v.box(-1, 5, 2, 1, 7, 3, d);                                          // the shop's square on the front
    v.box(-4, 11, 1, -2, 14, 2, c); v.box(2, 11, 1, 4, 14, 2, c); v.box(-4, 13, 1, 4, 14, 2, c);   // the handle, as cut (the back one is behind it)
    receipt(-1, 8, 15);
  } else if (kind === 1) {
    const kraft = M('#b58a5a', 1), lip = M('#c99c68', 1), cord = M(colour, 0);
    v.box(-5, 0, -2, 5, 10, 2, kraft); v.box(-5, 9, -2, 5, 10, 3, lip);
    v.box(-3, 3, 2, 3, 6, 3, cord);                                                                                               // a band of the shop's colour
    v.tube(-3, 10, 1, -2, 14, 1, 0.6, cord); v.tube(3, 10, 1, 2, 14, 1, 0.6, cord); v.tube(-2, 14, 1, 2, 14, 1, 0.6, cord);
    receipt(0, 7, 14);
  } else {
    const tissue = M('#f4d6e0', 1), white = M('#f8f4ee', 1), ribbon = M(tone(colour, 0.3), 0);
    v.box(-4, 0, -2, 4, 9, 2, M(colour, 0)); v.box(-4, 8, -2, 4, 9, 2, d); v.box(-4, 2, 2, 4, 3, 3, ribbon);
    for (const [x, h, m] of [[-3, 13, tissue], [-1, 15, white], [1, 12, tissue], [2, 14, white], [-2, 11, white]]) v.box(x, 9, -1, x + 2, h, 1, m);   // the tissue, out of the top
    v.tube(-2, 9, 1, -2, 12, 1, 0.5, ribbon); v.tube(2, 9, 1, 2, 12, 1, 0.5, ribbon); v.tube(-2, 12, 1, 2, 12, 1, 0.5, ribbon);
    receipt(2, 6, 12);
  }
  return v; }; }
/** On the counter by every till: the spike the receipts go on (a dozen of them, through the middle), and a stack of new rolls. */
function spikeVox() { const v = new Vox(), base = M('#2d3036', 0), rod = M('#b9bec4', 0), slip = M('#efece2', 0), ink = M('#6a665c', 0);
  v.cyl('y', 0, 0, 0, 1, 3, base); v.cyl('y', 0, 0, 1, 10, 0.5, rod);
  for (let i = 0; i < 9; i++) { const y = 1 + i, a = i * 1.9, ca = Math.round(Math.cos(a) * 2), sa = Math.round(Math.sin(a) * 2); v.box(-2 + ca, y, -1 + sa, 2 + ca, y + 1, 4 + sa, i % 3 ? slip : ink); v.box(0, y, 0, 1, y + 1, 1, rod); }
  for (const [x, z, y] of [[7, -2, 0], [12, -2, 0], [9, 2, 0], [9, -1, 5]]) { v.cyl('y', x, z, y, y + 5, 2.4, M('#f2efe4', 1)); v.cyl('y', x, z, y, y + 5, 0.9, M('#8a7a5a', 0)); }   // till rolls, cores and all
  return v; }
/** A till: a drawer, keys, a little screen, and the slot the paper comes out of. */
function tillVox() { const v = new Vox(), b = M('#3a3f46', 0), k = M('#d9d2bf', 0); v.rbox(-10, 0, -8, 10, 6, 8, 1, b); v.box(-9, 6, -6, 9, 10, 4, b); for (let x = -7; x <= 6; x += 3) for (let z = -4; z <= 2; z += 3) v.box(x, 10, z, x + 1, 11, z + 1, k); v.box(-4, 10, 4, 4, 18, 6, b); v.box(-3, 12, 6, 3, 16, 6, M('#3fdc6a', 0)); v.box(5, 10, -8, 9, 13, -6, b); v.box(6, 13, -8, 8, 13, -8, M('#f2efe4', 0)); return v; }

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = RECEIPTS, env = c.env;
  c.shell({ panels: false });
  const zc = -D / 2 + K.counter;
  /* the counter and the tills; over it, the name */
  c.flat.box(-W / 2 + 0.3, 0, zc - 0.55, W / 2 - 0.3, 0.95, zc, [0.36, 0.3, 0.26]); c.flat.box(-W / 2 + 0.25, 0.95, zc - 0.6, W / 2 - 0.25, 1.0, zc + 0.05, [0.85, 0.82, 0.74]); c.solid(-W / 2, zc - 0.6, W / 2, zc + 0.05, { tall: false });
  const tills = [], nt = Math.max(2, Math.floor((W - 1.2) / 1.5));
  for (let i = 0; i < nt; i++) { const x = -W / 2 + 0.9 + i * ((W - 1.8) / (nt - 1)); c.model('receipts:till', tillVox, x, zc - 0.3, { y: 1.0, rot: Math.PI, scale: 1, solid: false, shadow: false }); tills.push(x);
    c.model('receipts:spike', spikeVox, x + (i % 2 ? -0.42 : 0.42), zc - 0.22, { y: 1.0, rot: R.range(0, 6.28), solid: false, shadow: false });
    if (i < 4) c.light(x, 1.45, zc - 0.05, '#7dffa0', 0.14, { k: 2, far: 1.3 }); }   // (what lights the counter is the tills' screens, green)
  const neon = mallNeon(kit, 'receipts:' + p.seed, ['THE RECEIPT SHOP', 'ALL SALES FINAL', 'BAGS', 'RECEIPTS', 'KEEP YOUR RECEIPT', 'NO RECEIPT NO', 'RECEIPT SHOP', 'BAGS FOR LIFE'], p.seed), lit = c.shining('mall:neon:receipts:' + p.seed, neon.texture, 2.4, undefined, { bloom: 2 });
  upright(lit, -W / 2 + 0.6, -D / 2 + 0.04, W / 2 - 0.6, -D / 2 + 0.04, H - 0.85, H - 0.25, neon.uv(0)); upright(lit, -W / 4, -D / 2 + 0.04, W / 4, -D / 2 + 0.04, H - 1.5, H - 1.05, neon.uv(1));
  c.light(0, H - 0.8, zc + 0.5, '#ffd9a0', 0.8, { k: 1.3, far: 6 });
  /* the shelves: two runs down the room, to the roof, bags on every shelf */
  const cols = ['#e8e2d0', '#b3261e', '#2a4a6a', '#3f7a3a', '#e8c040'], runs = W >= 7.5 ? [-W / 6, W / 6] : [0], zs = zc + 1.2, ze = D / 2 - 1.4;
  for (const x of runs) {
    c.flat.box(x - 0.32, 0, zs, x + 0.32, H - 0.3, ze, [0.55, 0.55, 0.58]); c.solid(x - 0.35, zs, x + 0.35, ze, { tall: true });
    for (let y = 0.3, row = 0; y < H - 0.6; y += 0.42, row++) { for (const s of [-1, 1]) { c.flat.box(x + s * 0.32, y - 0.02, zs, x + s * 0.5, y, ze, [0.7, 0.7, 0.72]); for (let z = zs + 0.22; z < ze - 0.15; z += 0.34) if (R.chance(0.85)) { const k = (((row + Math.round(z * 3)) % 5) + 5) % 5, kind = (k + row) % 3; c.model('receipts:bag:' + kind + ':' + k, bagVox(kind, cols[k]), x + s * 0.41, z + R.range(-0.02, 0.02), { y, rot: s * Math.PI / 2 + R.range(-0.12, 0.12), scale: 1, solid: false, shadow: false }); }
      c.detail.box(x + s * 0.5 - (s > 0 ? 0.012 : 0), y - 0.05, zs, x + s * 0.5 + (s > 0 ? 0 : 0.012), y + 0.01, ze, [0.9, 0.88, 0.8]); for (let z = zs + 0.3; z < ze - 0.2; z += 0.68) c.detail.box(x + s * 0.5 - (s > 0 ? 0 : 0.016), y - 0.045, z, x + s * 0.5 + (s > 0 ? 0.016 : 0), y - 0.005, z + 0.07, [0.85, 0.25, 0.2]); } }   // the shelf's edge strip, and its price tickets
  }
  /* battens over the aisles, hung under the roof the shelves nearly reach */
  { const aisles = runs.length === 2 ? [-W / 2 + (W / 2 - W / 6 - 0.5) / 2, 0, W / 2 - (W / 2 - W / 6 - 0.5) / 2] : [-W / 4, W / 4];
    for (const x of aisles) for (const z of ze - zs > 3.4 ? [zs + (ze - zs) * 0.25, zs + (ze - zs) * 0.75] : [(zs + ze) / 2]) c.fitting(x, z, { kind: 'batten', len: 1.2, tube: [1, 0.95, 0.85], power: 1.4, detail: true, light: { power: 0.4, k: 1.5, far: 3.6 } }); }
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
  const print = kit.tex.custom('receipts:long', 32, 128, (g, w, h) => { P(g, '#efece2', 0, 0, w, h); for (let y = 5; y < h; y += 8) { garble(g, ['1 STEP', 'WHERE YOU WENT', 'AGAIN', 'BACK', 'TOTAL', 'YOU', 'STOOD', 'TURNED'][(y / 8) % 8 | 0], 2, y - 2, w - 10, 6, { color: '#55524a', mess: 0.3, weight: 400 }, y + 3); P(g, '#6a665c', w - 7, y, 5, 2); } P(g, '#c9c5b8', 0, 0, 1, h); P(g, '#c9c5b8', w - 1, 0, 1, h); });
  print.wrapT = THREE.RepeatWrapping; print.needsUpdate = true;
  const geo = c.kit.own(new THREE.BufferGeometry()), pos = new Float32Array(K.most * 6 * 3), uvs = new Float32Array(K.most * 6 * 2), mat = c.kit.own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.78, 0.72), map: print, side: THREE.DoubleSide }));
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.userData.noBeamShadow = true; c.add(mesh);
  let len = 0;
  const draw = () => {
    let i = 0, j = 0, left = len, run = 0; const put = (x, y, z, u, v) => { pos[i++] = x; pos[i++] = y; pos[i++] = z; uvs[j++] = u; uvs[j++] = v; };
    for (let k = 1; k < trail.length && left > 0; k++) {
      const [ax, az] = trail[k - 1], [bx0, bz0] = trail[k], seg = Math.hypot(bx0 - ax, bz0 - az), f = Math.min(1, left / Math.max(1e-6, seg)), bx = ax + (bx0 - ax) * f, bz = az + (bz0 - az) * f; left -= seg;
      const nx = -(bz - az) / Math.max(1e-6, seg) * 0.04, nz = (bx - ax) / Math.max(1e-6, seg) * 0.04, ya = k === 1 ? 1.0 : 0.012, yb = 0.012;
      const va = -run / 0.9, vb = -(run + seg * f) / 0.9; run += seg * f;                                   // (printed as it came out: the newest line at the till)
      put(ax - nx, ya, az - nz, 0, va); put(bx - nx, yb, bz - nz, 0, vb); put(bx + nx, yb, bz + nz, 1, vb); put(ax - nx, ya, az - nz, 0, va); put(bx + nx, yb, bz + nz, 1, vb); put(ax + nx, ya, az + nz, 1, va);
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.uv.needsUpdate = true; geo.setDrawRange(0, i / 3);
  };
  trail.push([start, zc + 0.5]);
  /* on a pole by that till, the customer's display: what it has come to. It charges for where you have been, by the metre */
  const dw = 128, dh = 48, shown = kit.tex.live(dw, dh, () => {}), dg = shown.image.getContext('2d'); shown.generateMipmaps = false; shown.minFilter = THREE.LinearFilter;
  let said = '';
  const show = (top, bottom) => { if (top + bottom === said) return; said = top + bottom; dg.fillStyle = '#06140b'; dg.fillRect(0, 0, dw, dh); dg.textAlign = 'right'; dg.textBaseline = 'middle'; dg.shadowColor = '#3fdc6a'; dg.shadowBlur = 4; dg.fillStyle = '#7dffa0';
    dg.font = 'bold 13px monospace'; dg.fillText(top, dw - 6, 13); dg.font = 'bold 20px monospace'; dg.fillText(bottom, dw - 6, 34); dg.shadowBlur = 0; dg.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < dh; y += 2) dg.fillRect(0, y, dw, 1); shown.needsUpdate = true; };
  show('1 BAG', '0.00');
  { const px = start + (start > 0 ? -0.38 : 0.38), pz = zc - 0.02, py = 1.42, scr = c.shining('receipts:display', shown, 1.4, [1, 1, 1], { bloom: 1 });
    c.board(scr, px, py, pz + 0.026, 0.3, 0.11, 0); c.flat.box(px - 0.17, py - 0.07, pz - 0.02, px + 0.17, py + 0.07, pz + 0.02, [0.18, 0.19, 0.21]); c.flat.box(px - 0.012, 1.0, pz - 0.012, px + 0.012, py - 0.07, pz + 0.012, [0.5, 0.52, 0.55]); }
  /* tear it off, and all of it goes back into the till, the way you came, as a tape measure does */
  let reel = false;
  c.use({ x: start, z: zc + 0.45, r: 0.9, label: 'tear it off', when: () => len > 0.8 && !reel, use: () => { reel = true; const w = c.toWorld(start, zc); env.play?.('click', w.x, w.z, 8); } });
  c.tick((dt, t, me) => {
    if (reel) {
      len = Math.max(0, len - 5 * dt); draw(); if (Math.random() < dt * 14) { const w = c.toWorld(start, zc); env.play?.('click', w.x, w.z, 5); }
      if (len <= 0) { reel = false; trail.length = 2; crumbs.length = 0; crumbs.push([me.x, me.z]); show('THANK YOU', 'NO RETURNS'); }   // (and it starts again from where you stood when you next move)
      return;
    }
    if (!me.inside) return;
    const last = crumbs[crumbs.length - 1];
    if (!last || Math.hypot(me.x - last[0], me.z - last[1]) > K.crumb) { crumbs.push([me.x, me.z]); if (trail.length < K.most) trail.push([me.x, me.z]); }
    let total = 0; for (let k = 1; k < trail.length; k++) total += Math.hypot(trail[k][0] - trail[k - 1][0], trail[k][1] - trail[k - 1][1]);
    if (len < total) { len = Math.min(total, len + K.speed * dt); draw(); if (trail.length > 2) show(trail.length >= K.most ? 'PAPER OUT' : 'WHERE YOU WENT', (len * 1.2).toFixed(2)); if (Math.random() < dt * 3) { const w = c.toWorld(start, zc); env.play?.('click', w.x, w.z, 4); } }
  });
}
