// The Backrooms — a shop of the shopping centre (themes.js `mall`): Mens
// Ladies ("the department store"). Somebody was told that in a shopping
// centre there is a great shop of clothes, with rails, and dummies dressed in
// them, and little rooms with a curtain where you try them on. They were told
// it by people who wore office clothes, in an office, and the office is still
// in it. So: rails of jackets in the colours of carpet tile, rose and beige and
// taupe, and nothing else. One rail goes on into the floor. A dummy is stood
// in a planter up to its chest. Down the middle, the fitting rooms: a pink
// doorway with a curtain, and through it another, smaller, and another, on
// down to a corridor of doors. In the corners the office is let back in: up
// three steps, a desk and a set and a chair; in the glass, cubicles; where the
// panelling has come away, more of them, behind it.
//
// Its look is the shopping centre's in full (docs/MALL-PLAN.md): one palette
// to a room, a thing to look at down the middle, and what is wrong with it
// built, not written on it.
import { P } from '../bits.js';
import { Vox, M } from '../../vox/vox.js';
import { upright, sheet } from '../suburb.js';
import { dummyVox, wallFace, wallBox, MALL_TEX } from '../mall.js';
import { VOXEL as S } from '../../vox/vox.js';

// tunnel: the fitting rooms down the middle (frames, how each shrinks, how far apart) · deck: the office, up three steps · aisle: kept clear down the middle
export const STORE = Object.freeze({ frames: 6, shrink: 0.8, gap: 0.78, frameW: 2.5, frameH: 2.75, deck: 0.51, deckW: 3.4, deckD: 3.0, step: 0.3, aisle: 1.3, rail: 2.0, jacket: 0.085, jackets: 175 });   // jackets: how many the rails hold in all (what the budget for triangles allows)

/* the room's palette: dusty rose, beige, taupe, cream, a grey-green wall; pink for the fitting rooms; nothing that is not one of these */
export const PAL = Object.freeze({
  cloth: ['#c9b49a', '#a8907a', '#b98a8a', '#d2aea4', '#ddd0b8', '#9c7a80', '#bfa48c'],
  wall: '#7f8278', seam: '#6a6d63', carpet: '#6e4a58', fleck: ['#7d5866', '#5e3c4a', '#86606c'], tile: '#b6a0a6', grid: '#8a7378',
  pink: '#c4728a', curtain: '#a35f72', rack: '#c8c6c4', sign: '#9c4a52', zig: '#e3c7b0', wood: '#a8784e', plaster: '#e2d8c6', skin: '#d9c4a8',
});
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** A jacket on its hanger, seen from the side of the rail: it hangs in the z–y plane, its front to +x. Shoulders, sleeves, a lapel, buttons. */
export function jacketVox(col) {
  return () => {
    // (Vox boxes are half-open: box(x0, y0, z0, x1, y1, z1) fills x0 ≤ x < x1)
    const v = new Vox(), c = M(col, 1), dk = M(shade(col, 0.82), 1), lt = M(shade(col, 1.1), 0), wire = M('#9a9ca0', 0);
    for (let y = 0; y <= 27; y++) { const half = Math.round(y > 24 ? 8 - (y - 24) * 1.5 : y < 3 ? 7.5 : 8); v.box(-2, y, -half, 2, y + 1, half + 1, c); }   // the body, two voxels each side of the hanger: the shoulders falling away
    for (const s of [-1, 1]) for (let y = 3; y <= 23; y++) { const z0 = s < 0 ? -10 : 9, z1 = s < 0 ? -8 : 11; v.box(-2, y, z0, 2, y + 1, z1, dk); }   // the sleeves, at its sides
    for (let y = 12; y <= 26; y++) { const w = Math.max(0, Math.round((y - 12) * 0.45)); v.box(2, y, -w, 3, y + 1, w + 1, lt); }                       // the lapels, a V on the front
    v.box(2, 3, 0, 3, 12, 1, dk); for (const y of [6, 10]) v.set(2, y, 1, M('#3a3030', 0));                                                              // the opening, two buttons
    v.box(-1, 27, -6, 0, 28, 7, wire); v.box(-1, 28, 0, 0, 31, 1, wire); v.set(-1, 31, 1, wire);                                                        // the hanger, the hook
    return v;
  };
}
function shade(hex, k) { return '#' + rgb(hex).map((v) => Math.max(0, Math.min(255, Math.round(v * k * 255))).toString(16).padStart(2, '0')).join(''); }

/** A set of the old kind, beige, for the table of them: case, screen, a base. Faces +z. */
function crtVox() { const v = new Vox(), c = M('#d6ceb8', 1), d = M('#3a3c3a', 0); v.rbox(-8, 0, -7, 8, 13, 7, 1, c); v.box(-6, 3, 7, 7, 12, 8, d); v.box(-5, 4, 7, 6, 11, 8, M('#4f5a52', 0)); v.box(-5, -2, -4, 5, 0, 4, c); return v; }
/** The chair at the desk: five feet, a seat, a back. */
function chairVox() { const v = new Vox(), b = M('#3a3238', 1), g = M('#5a5a5e', 0); for (let i = 0; i < 5; i++) { const a = i * 1.2566; v.tube(0, 2, 0, Math.round(Math.cos(a) * 9), 1, Math.round(Math.sin(a) * 9), 0.7, g); } v.cyl('y', 0, 0, 2, 16, 1, g); v.rbox(-8, 16, -8, 8, 19, 8, 2, b); v.rbox(-7, 19, -9, 7, 38, -7, 2, b); return v; }
/** A plant in a pot, as offices have. */
function plantVox() { const v = new Vox(), pot = M('#b8a48a', 1), g = M('#4f6a42', 2), g2 = M('#6a8a52', 2); v.cyl('y', 0, 0, 0, 12, 6, pot, 7); v.cyl('y', 0, 0, 1, 40, 0.8, M('#5a4030', 2));
  for (let i = 0; i < 9; i++) { const a = i * 2.4, y = 22 + i * 2.6; v.ellipsoid(Math.round(Math.cos(a) * 5), y, Math.round(Math.sin(a) * 5), 5, 2, 4, i % 2 ? g : g2); } return v; }

export function build(c) {
  const { W, D, H, R, kit } = c, K = STORE;
  const wallT = MALL_TEX.panel(kit, 'store:wall:64', PAL.wall);
  const carpetT = MALL_TEX.carpet(kit, 'mall:carpet:64', PAL.carpet, PAL.fleck);
  const ceilT = MALL_TEX.tile(kit, 'mall:tile:64', PAL.tile, PAL.grid);
  c.shell({ wallTex: wallT, floorTex: carpetT, ceilTex: ceilT, panels: false });
  const det = c.detail, flat = c.flat, rack = rgb(PAL.rack), pink = rgb(PAL.pink), wood = rgb(PAL.wood);
  const zBack = -D / 2;

  /* 1 · down the middle: the fitting rooms. A pink doorway with a curtain either side, and through it another, smaller, and on down to a corridor */
  const frames = []; { let z = zBack + 3.6, s = 1;
    for (let i = 0; i < K.frames; i++) { frames.push({ z, s, w: K.frameW * s, h: Math.min(H - 0.15, K.frameH * s) }); z -= K.gap * s; s *= K.shrink; } }
  const curtainT = c.mapped('store:curtain', kit.tex.custom('store:curtain', 32, 64, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 0.5 + 0.5 * Math.sin(x * 1.1); P(g, `rgb(${140 + v * 36 | 0},${80 + v * 22 | 0},${98 + v * 24 | 0})`, x, 0, 1, h); } P(g, '#8a8d90', 0, 0, w, 2); }));
  frames.forEach((f, i) => {
    const t = 0.16 * f.s, d = 0.22 * f.s, x0 = -f.w / 2, x1 = f.w / 2;
    flat.box(x0, 0, f.z - d, x0 + t, f.h, f.z, pink); flat.box(x1 - t, 0, f.z - d, x1, f.h, f.z, pink); flat.box(x0, f.h - t, f.z - d, x1, f.h, f.z, pink);          // the frame
    det.box(x0 - 0.01, f.h - t - 0.012, f.z - 0.01, x1 + 0.01, f.h - t, f.z + 0.004, rgb(shade(PAL.pink, 0.8)));
    const nx = frames[i + 1];
    if (nx) {                                                                                                                                         // the walls and roof between it and the next, and the floor's pink edge
      const a = [x0 + t, 0, f.z - d], b = [nx.w / -2 + 0.16 * nx.s, 0, nx.z];
      sheet(flat, [a[0], 0, a[2]], [b[0], 0, b[2]], [b[0], nx.h - 0.16 * nx.s, b[2]], [a[0], f.h - t, a[2]], 2, 2, null, rgb('#8a7f80'));
      sheet(flat, [-b[0], 0, b[2]], [-a[0], 0, a[2]], [-a[0], f.h - t, a[2]], [-b[0], nx.h - 0.16 * nx.s, b[2]], 2, 2, null, rgb('#8a7f80'));
      sheet(flat, [a[0], f.h - t, a[2]], [b[0], nx.h - 0.16 * nx.s, b[2]], [-b[0], nx.h - 0.16 * nx.s, b[2]], [-a[0], f.h - t, a[2]], 2, 1, null, rgb('#9a8f90'));
      // a curtain on a rod across each of the first three, drawn back to the sides
      if (i < 3) { const ry = f.h - t - 0.06, open = 0.16 + 0.04 * i; det.box(x0 + t, ry - 0.012, f.z - d / 2 - 0.012, x1 - t, ry + 0.012, f.z - d / 2 + 0.012, rack);
        for (const s of [-1, 1]) { const xa = s < 0 ? x0 + t : x1 - t, xb = xa - s * f.w * open, zc = f.z - d / 2;
          upright(curtainT, Math.min(xa, xb), zc + 0.005, Math.max(xa, xb), zc + 0.005, 0.04, ry, [0, 0, 3 * open, 1]); upright(curtainT, Math.max(xa, xb), zc - 0.005, Math.min(xa, xb), zc - 0.005, 0.04, ry, [0, 0, 3 * open, 1]);
          for (let x = Math.min(xa, xb); x < Math.max(xa, xb); x += 0.09) det.box(x - 0.01, ry - 0.03, zc - 0.012, x + 0.01, ry + 0.02, zc + 0.012, rack); } }
    }
  });
  { const L = frames[frames.length - 1], t = 0.16 * L.s;                                                                                              // at the end: a corridor of doors, going on
    const far = c.shining('store:corridor', kit.tex.custom('store:corridor', 48, 64, (g, w, h) => { P(g, '#8a8070', 0, 0, w, h); for (let k = 0; k < 9; k++) { const s = 1 - k * 0.1, x0 = w / 2 - (w * s) / 2, y0 = h / 2 - (h * s) / 2 + k * 0.6; g.strokeStyle = k % 2 ? '#6a6052' : '#9a9080'; g.strokeRect(x0, y0, w * s, h * s); }
      P(g, '#5a4a40', w / 2 - 2, h * 0.42, 4, h * 0.14); for (let k = 1; k < 7; k++) { const s = 1 - k * 0.11; P(g, '#6e5038', w / 2 - (w * s) / 2 + 1, h / 2 - (h * s) * 0.18, 2, h * s * 0.42); P(g, '#6e5038', w / 2 + (w * s) / 2 - 3, h / 2 - (h * s) * 0.18, 2, h * s * 0.42); } P(g, '#4a3a40', 0, h - 6, w, 6); }), 0.75);
    upright(far, -L.w / 2 + t, L.z - 0.24 * L.s, L.w / 2 - t, L.z - 0.24 * L.s, 0, L.h - t, [0, 0, 1, 1]);
    flat.box(-L.w / 2, 0, zBack, L.w / 2, L.h, L.z - 0.25 * L.s, rgb('#6e6a66'));
    // the outside of it: a block as tall as the front frame, from the frame to the back wall, panelled; the tunnel is in it
    const f0 = frames[0], hw = f0.w / 2, panel = rgb('#8c8a84');
    sheet(flat, [-hw, 0, zBack], [-hw, 0, f0.z], [-hw, f0.h, f0.z], [-hw, f0.h, zBack], 3, 2, null, panel); sheet(flat, [hw, 0, f0.z], [hw, 0, zBack], [hw, f0.h, zBack], [hw, f0.h, f0.z], 3, 2, null, panel);
    sheet(flat, [-hw, f0.h, f0.z], [hw, f0.h, f0.z], [hw, f0.h, zBack], [-hw, f0.h, zBack], 2, 2, null, panel);
    for (const sx of [-1, 1]) for (let z = zBack + 0.6; z < f0.z - 0.1; z += 0.6) det.box(sx * hw - 0.006, 0, z - 0.006, sx * hw + 0.006, f0.h, z + 0.006, rgb(PAL.seam));
    for (const sx of [-1, 1]) det.box(Math.min(sx * hw, sx * (hw + 0.025)), 0, zBack, Math.max(sx * hw, sx * (hw + 0.025)), 0.12, f0.z, rgb('#5a4048')); }
  // you can go in as far as you can stand up in it
  { const f0 = frames[0], hw = f0.w / 2, stop = frames.find((f) => f.h < 2.05) || frames[frames.length - 1];
    for (const sx of [-1, 1]) c.solid(Math.min(sx * (hw + 0.03), sx * (hw - 0.2)), zBack, Math.max(sx * (hw + 0.03), sx * (hw - 0.2)), f0.z + 0.02, { tall: true });
    c.solid(-hw, zBack, hw, stop.z, { tall: true }); }
  { const f0 = frames[0];
    // two dummies stood either side of the way in, dressed out of the rails
    for (const s of [-1, 1]) { const x = s * (f0.w / 2 + 0.55), z = f0.z + 0.55; if (!c.clear(x, z, 0.25)) continue; c.model('store:dummy:door:' + (s > 0 ? 1 : 0), dummyVox(s > 0 ? 1 : 2, s > 0 ? PAL.cloth[1] : PAL.cloth[2]), x, z, { rot: s * 0.25, solid: false }); c.solid(x - 0.2, z - 0.2, x + 0.2, z + 0.2, { tall: false }); } }

  /* 2 · the office, let back in: up three steps in a back corner, a desk, a set on it, a chair, a cabinet, a plant; partitions round it */
  const deckSide = R.shuffle([-1, 1]).find((s) => { const x0 = s < 0 ? -W / 2 : W / 2 - K.deckW, x1 = x0 + K.deckW, sx = (x0 + x1) / 2;
    if (s < 0 ? x1 > -frames[0].w / 2 - 0.4 : x0 < frames[0].w / 2 + 0.4) return false;                                         // (clear of the fitting rooms)
    const pts = []; for (let x = x0 + 0.45; x <= x1 - 0.45 + 1e-6; x += (K.deckW - 0.9) / 3) for (let z = zBack + 0.45; z <= zBack + K.deckD - 0.3; z += (K.deckD - 0.75) / 3) pts.push([x, z]);
    pts.push([sx, zBack + K.deckD + 0.5], [sx, zBack + K.deckD + 1.2]);
    return pts.every(([x, z]) => c.clear(x, z, 0.35)); }) || 0;
  let deck = null;
  if (deckSide) {
    const x0 = deckSide < 0 ? -W / 2 : W / 2 - K.deckW, x1 = x0 + K.deckW, z0 = zBack, z1 = zBack + K.deckD, sw = 1.2, sx0 = (x0 + x1) / 2 - sw / 2, sx1 = sx0 + sw, rise = K.deck / 3;
    deck = { x0, x1, z0, z1 };
    const inDeck = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
    c.rt.floorY = (x, z) => { if (inDeck(x, z)) return K.deck; if (x >= sx0 && x <= sx1 && z > z1 && z < z1 + 3 * K.step) return rise * (3 - Math.ceil((z - z1) / K.step)) ; return 0; };
    const fl = c.floor, top = (xa, za, xb, zb, y) => fl.quad([xa, y, zb], [xb, y, zb], [xb, y, za], [xa, y, za], [1, 1, 1], [[xa / 1.6, zb / 1.6], [xb / 1.6, zb / 1.6], [xb / 1.6, za / 1.6], [xa / 1.6, za / 1.6]]);
    top(x0, z0, x1, z1, K.deck); flat.box(x0, 0, z1 - 0.01, x1, K.deck, z1, rgb('#5a4048')); if (deckSide < 0) flat.box(x1 - 0.01, 0, z0, x1, K.deck, z1, rgb('#5a4048')); else flat.box(x0, 0, z0, x0 + 0.01, K.deck, z1, rgb('#5a4048'));
    for (let k = 0; k < 3; k++) { const y = rise * (3 - k), za = z1 + k * K.step; top(sx0, za, sx1, za + K.step, y); flat.box(sx0, 0, za + K.step - 0.01, sx1, y, za + K.step, rgb('#5a4048')); det.box(sx0, y - 0.004, za + K.step - 0.03, sx1, y + 0.006, za + K.step + 0.002, rgb('#b8a090')); }
    // the rail round its edge, but for the top of the steps; a rail down each side of the steps
    const post = (x, z, y0) => flat.box(x - 0.025, y0, z - 0.025, x + 0.025, y0 + 0.95, z + 0.025, wood);
    for (const [a, b] of [[x0 + 0.05, sx0], [sx1, x1 - 0.05]]) if (b - a > 0.1) { flat.box(a, K.deck + 0.9, z1 - 0.04, b, K.deck + 0.95, z1 + 0.01, wood); for (let x = a; x <= b + 0.01; x += (b - a) / Math.max(1, Math.round((b - a) / 0.9))) post(x, z1 - 0.015, K.deck); c.solid(a, z1 - 0.06, b, z1 + 0.03, { tall: true }); }
    { const xe = deckSide < 0 ? x1 - 0.02 : x0 + 0.02; flat.box(xe - 0.025, K.deck + 0.9, z0 + 0.1, xe + 0.025, K.deck + 0.95, z1, wood); for (let z = z0 + 0.4; z <= z1; z += 0.9) post(xe, z, K.deck); c.solid(xe - 0.06, z0, xe + 0.06, z1, { tall: true }); }
    for (const x of [sx0 - 0.03, sx1 + 0.03]) { flat.box(x - 0.02, 0.9, z1, x + 0.02, 0.95 + K.deck, z1 + 0.04, wood); sheet(flat, [x - 0.02, 0.95, z1 + 3 * K.step], [x + 0.02, 0.95, z1 + 3 * K.step], [x + 0.02, 0.95 + K.deck, z1], [x - 0.02, 0.95 + K.deck, z1], 1, 1, null, wood); post(x, z1 + 3 * K.step - 0.03, 0); c.solid(x - 0.04, z1, x + 0.04, z1 + 3 * K.step, { tall: true }); }
    // the office on it: a partition, the desk, the set, the chair, the cabinet, the plant, a lamp lit
    const y = K.deck, ex = deckSide < 0 ? x0 : x1, inX = (d) => ex - deckSide * d, fabric = rgb('#6c7684');
    flat.box(Math.min(inX(0.1), inX(2.2)), y, z0 + 1.55, Math.max(inX(0.1), inX(2.2)), y + 1.35, z0 + 1.62, fabric); flat.box(Math.min(inX(0.1), inX(2.2)), y + 1.35, z0 + 1.53, Math.max(inX(0.1), inX(2.2)), y + 1.39, z0 + 1.64, rgb('#9a9ca0'));
    c.solid(Math.min(inX(0.1), inX(2.2)), z0 + 1.53, Math.max(inX(0.1), inX(2.2)), z0 + 1.64, { tall: true });
    const dx = inX(1.15), dz = z0 + 0.55; flat.box(dx - 0.75, y + 0.72, dz - 0.4, dx + 0.75, y + 0.76, dz + 0.4, rgb('#b0a28c')); for (const s of [-1, 1]) flat.box(dx + s * 0.7 - 0.03, y, dz - 0.38, dx + s * 0.7 + 0.03, y + 0.72, dz + 0.38, rgb('#8a8d90'));
    c.solid(dx - 0.75, dz - 0.4, dx + 0.75, dz + 0.4, { tall: false });
    c.model('store:crt', crtVox, dx - 0.2, dz - 0.1, { y: y + 0.82, scale: 1.4, solid: false, shadow: false }); det.box(dx - 0.2, y + 0.76, dz + 0.2, dx + 0.25, y + 0.79, dz + 0.34, rgb('#d6ceb8'));
    c.model('store:chair', chairVox, dx, dz + 0.75, { y, rot: Math.PI + 0.3, solid: false }); c.solid(dx - 0.25, dz + 0.5, dx + 0.25, dz + 1.0, { tall: false });
    const kx = inX(2.6), kz = z0 + 0.35; flat.box(kx - 0.24, y, kz - 0.3, kx + 0.24, y + 1.3, kz + 0.3, rgb('#a8a296')); for (let k = 0; k < 4; k++) { det.box(kx - 0.2, y + 0.08 + k * 0.31, kz + 0.3, kx + 0.2, y + 0.33 + k * 0.31, kz + 0.31, rgb('#b8b2a6')); det.box(kx - 0.06, y + 0.26 + k * 0.31, kz + 0.31, kx + 0.06, y + 0.28 + k * 0.31, kz + 0.33, rgb('#6a6a6e')); }
    c.solid(kx - 0.25, kz - 0.3, kx + 0.25, kz + 0.3, { tall: true });
    for (let k = 0; k < 5; k++) det.box(kx - 0.2 + k * 0.08, y + 1.3, kz - 0.12, kx - 0.14 + k * 0.08, y + 1.6, kz + 0.12, rgb(['#3a4a6a', '#6a2a2a', '#3a5a3a', '#3a4a6a', '#5a5a5a'][k]));
    c.model('store:plant', plantVox, inX(0.35), z1 - 0.4, { y, scale: 1.3, solid: false }); c.solid(inX(0.35) - 0.2, z1 - 0.6, inX(0.35) + 0.2, z1 - 0.2, { tall: false });
    const lampL = c.shining('store:lamp', kit.tex.white(), 1.5, [1, 0.85, 0.6]); det.box(dx + 0.55, y + 0.76, dz - 0.25, dx + 0.6, y + 1.15, dz - 0.2, rgb('#3a3a3a')); lampL.box(dx + 0.47, y + 1.1, dz - 0.3, dx + 0.68, y + 1.28, dz - 0.12, [1, 1, 1]);
    c.leave('snack', dx + 0.35, dz + 0.1, { y: y + 0.78 });
  }

  /* 3 · what stands on the floor. First the things the room is built round (the rail going into the floor, the planter, two plinths,
     a half-wall, two four-way racks), each keeping its ground; then rails, in rows, in what room is left */
  const jk = (ci) => 'store:jacket:' + ci, made = new Map(), jacketOf = (ci, back) => { const k = ci + (back ? 'b' : ''); if (!made.has(k)) { const v = jacketVox(PAL.cloth[ci])(); made.set(k, back ? v.turned(2) : v); } return made.get(k); };
  const zFront = D / 2 - 1.4, zRail0 = frames[0].z + 1.6, rails = [], half = K.aisle / 2 + 0.35, cream = rgb('#d8ccb8');
  let jackets = K.jackets;
  const fits = (x0, z0, x1, z1, r = 0.22) => [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]].every(([x, z]) => c.clear(x, z, r));
  const keep = (x0, z0, x1, z1) => { for (let x = x0; x <= x1 + 1e-6; x += Math.max(0.3, (x1 - x0) / Math.ceil((x1 - x0) / 0.5))) for (let z = z0; z <= z1 + 1e-6; z += Math.max(0.3, (z1 - z0) / Math.ceil((z1 - z0) / 0.5))) c.reserve(x, z, 0.3); };
  const box4 = (x0, z0, x1, z1, y0, y1, col, b = flat) => b.box(x0, y0, z0, x1, y1, z1, col);
  const plinth = (x, z, w, d, h) => { box4(x - w, z - d, x + w, z + d, 0, h, cream); box4(x - w - 0.02, z - d - 0.02, x + w + 0.02, z + d + 0.02, h, h + 0.04, wood); det.box(x - w - 0.005, 0.0, z - d - 0.005, x + w + 0.005, 0.08, z + d + 0.005, rgb('#5a4048')); c.solid(x - w - 0.03, z - d - 0.03, x + w + 0.03, z + d + 0.03, { tall: false }); keep(x - w, z - d, x + w, z + d); };

  // (a) one rail, along the way down the middle, that goes on into the floor, steeply, with its jackets, and the floor takes it without a mark
  { const s = R.pick([-1, 1]), x = s * (K.aisle / 2 + 0.05), za = zFront - 1.7, run = 0.7, drop = 1.25;                                    // flat for `run`, then down 1.55 m in `drop`
    const hole = za - run - drop, y0 = 1.55, yAt = (z) => y0 - Math.max(0, Math.min(1.7, (za - run - z) / drop)) * y0;
    if (fits(x - 0.3, hole - 0.6, x + 0.3, za + 0.05)) {
      flat.box(x - 0.022, 0, za - 0.022, x + 0.022, y0, za + 0.022, rack); flat.box(x - 0.28, 0, za - 0.03, x + 0.28, 0.035, za + 0.03, rack);
      for (let z = za; z > hole - 0.15; z -= 0.1) { const y = yAt(z), y1 = yAt(z - 0.1); sheet(flat, [x, y - 0.02, z], [x, y1 - 0.02, z - 0.1], [x, y1 + 0.02, z - 0.1], [x, y + 0.02, z], 1, 1, null, rack); sheet(flat, [x - 0.015, y + 0.02, z], [x - 0.015, y1 + 0.02, z - 0.1], [x + 0.015, y1 + 0.02, z - 0.1], [x + 0.015, y + 0.02, z], 1, 1, null, rack); }
      // its jackets, as one, going down with it; only those still partly above the carpet
      const zs = []; for (let z = za - 0.12; yAt(z) - 0.83 + 0.72 > 0.02; z -= K.jacket) zs.push(z);
      c.model('store:sinking:' + zs.length, () => { const v = new Vox(); zs.forEach((z, i) => v.stamp(jacketOf((i * 2 + 3) % PAL.cloth.length, false).turned(1), 0, Math.round((yAt(z) - yAt(zs[0])) / S), -Math.round((zs[0] - z) / S), false)); return v; },
        x, zs[0], { y: yAt(zs[0]) - 0.83, solid: false, shadow: false });
      jackets -= zs.length;
      // (no hole: it goes into the carpet as if the carpet were water, and the carpet is not disturbed)
      const hz = 0.2;
      c.solid(x - 0.3, hole - hz - 0.1, x + 0.3, za + 0.05, { tall: false }); keep(x - 0.35, hole - hz, x + 0.35, za + 0.1);
    } }

  // (b) the planter, with a dummy in it to the chest
  { const s = R.pick([-1, 1]), px = s * (half + 1.3), pz = (zRail0 + zFront) / 2 + R.range(-0.4, 0.4), w = 0.6, hgt = 0.5;
    if (fits(px - w, pz - w, px + w, pz + w, 0.3)) {
      box4(px - w, pz - w, px + w, pz - w + 0.12, 0, hgt, cream); box4(px - w, pz + w - 0.12, px + w, pz + w, 0, hgt, cream); box4(px - w, pz - w + 0.12, px - w + 0.12, pz + w - 0.12, 0, hgt, cream); box4(px + w - 0.12, pz - w + 0.12, px + w, pz + w - 0.12, 0, hgt, cream);
      box4(px - w - 0.02, pz - w - 0.02, px + w + 0.02, pz - w + 0.14, hgt, hgt + 0.04, wood); box4(px - w - 0.02, pz + w - 0.14, px + w + 0.02, pz + w + 0.02, hgt, hgt + 0.04, wood); box4(px - w - 0.02, pz - w + 0.14, px - w + 0.14, pz + w - 0.14, hgt, hgt + 0.04, wood); box4(px + w - 0.14, pz - w + 0.14, px + w + 0.02, pz + w - 0.14, hgt, hgt + 0.04, wood);
      box4(px - w + 0.12, pz - w + 0.12, px + w - 0.12, pz + w - 0.12, 0.38, 0.4, [0.16, 0.12, 0.12]);
      c.model('store:dummy:sunk', dummyVox(0, PAL.cloth[1]), px, pz, { y: -0.98, rot: Math.atan2(-px, -pz) * 0.4, solid: false });
      c.solid(px - w - 0.05, pz - w - 0.05, px + w + 0.05, pz + w + 0.05, { tall: false }); keep(px - w, pz - w, px + w, pz + w);
    } }

  // (c) two plinths by the way down the middle: on one a dummy cut off at the chest by the top of it, on the other shirts, folded, in piles
  for (let k = 0; k < 2; k++) { const s = k ? 1 : -1, x = s * (half + 0.55), z = zRail0 + 0.9 + k * 2.6 + R.range(-0.2, 0.2);
    if (!fits(x - 0.45, z - 0.45, x + 0.45, z + 0.45, 0.25)) continue;
    plinth(x, z, 0.42, 0.42, 0.45);
    if (k === 0) c.model('store:dummy:bust', dummyVox(1, PAL.cloth[4]), x, z, { y: -0.62, rot: -s * 0.5, solid: false });
    else for (let p = 0; p < 3; p++) { const px = x - 0.22 + p * 0.22; for (let q = 0; q < 4 + (p % 2); q++) { const col = rgb(PAL.cloth[(p * 3 + q) % PAL.cloth.length]); det.box(px - 0.1, 0.49 + q * 0.045, z - 0.13, px + 0.1, 0.53 + q * 0.045, z + 0.13, col); det.box(px - 0.1, 0.525 + q * 0.045, z - 0.13, px + 0.1, 0.533 + q * 0.045, z - 0.05, col.map((v) => v * 0.85)); } } }

  // (d) a half-wall, panelled, a wood cap, across in front of the fitting rooms on one side: the room in two
  { const s = deckSide ? -deckSide : R.pick([-1, 1]), x0 = s * (frames[0].w / 2 + 0.9), x1 = s * (frames[0].w / 2 + 0.9 + 2.8), z = zRail0 - 0.55, xa = Math.min(x0, x1), xb = Math.max(x0, x1);
    if (fits(xa, z - 0.2, xb, z + 0.2)) { box4(xa, z - 0.08, xb, z + 0.08, 0, 1.05, rgb(PAL.wall)); box4(xa - 0.03, z - 0.11, xb + 0.03, z + 0.11, 1.05, 1.1, wood); det.box(xa - 0.005, 0, z - 0.085, xb + 0.005, 0.1, z + 0.085, rgb('#5a4048'));
      for (let x = xa + 0.4; x < xb - 0.1; x += 0.4) for (const sz of [-1, 1]) det.box(x - 0.006, 0.1, z + sz * 0.08 - 0.003, x + 0.006, 1.05, z + sz * 0.08 + 0.003, rgb(PAL.seam));
      c.solid(xa - 0.03, z - 0.11, xb + 0.03, z + 0.11, { tall: true }); keep(xa, z - 0.15, xb, z + 0.15); } }

  // (e) two four-way racks: a post, four arms, jackets on each arm hung across it
  const fourWay = (cx, cz) => { const L = 0.62, y = 1.4, n = Math.floor((L - 0.14) / K.jacket); if (4 * n > jackets || !fits(cx - L - 0.1, cz - L - 0.1, cx + L + 0.1, cz + L + 0.1, 0.2)) return false;
    flat.box(cx - 0.025, 0, cz - 0.025, cx + 0.025, y + 0.05, cz + 0.025, rack); flat.box(cx - 0.3, 0, cz - 0.03, cx + 0.3, 0.035, cz + 0.03, rack); flat.box(cx - 0.03, 0, cz - 0.3, cx + 0.03, 0.035, cz + 0.3, rack);
    flat.box(cx - L, y - 0.015, cz - 0.015, cx + L, y + 0.015, cz + 0.015, rack); flat.box(cx - 0.015, y - 0.015, cz - L, cx + 0.015, y + 0.015, cz + L, rack);
    c.model('store:fourway:' + n, () => { const v = new Vox(), st = Math.round(K.jacket / S); for (let i = 0; i < n; i++) { const d = Math.round(0.14 / S) + i * st;
      v.stamp(jacketOf((i * 2) % PAL.cloth.length, false), d, 0, 0, false); v.stamp(jacketOf((i * 2 + 1) % PAL.cloth.length, true), -d - 1, 0, 0, false);
      v.stamp(jacketOf((i * 2 + 2) % PAL.cloth.length, false).turned(1), 0, 0, d, false); v.stamp(jacketOf((i * 2 + 3) % PAL.cloth.length, false).turned(3), 0, 0, -d - 1, false); } return v; },
      cx, cz, { y: y - 0.83, solid: false, shadow: false });
    jackets -= 4 * n; c.solid(cx - L, cz - 0.3, cx + L, cz + 0.3, { tall: false }); c.solid(cx - 0.3, cz - L, cx + 0.3, cz + L, { tall: false }); keep(cx - L, cz - L, cx + L, cz + L); return true; };
  for (const s of [-1, 1]) fourWay(s * (half + 2.6 + R.range(0, 0.6)), zRail0 + 2.0 + R.range(0, 1.4));

  // (f) the rails, in rows, in what room is left
  const railAt = (xa, xb, z, y = 1.55) => {
    const n = Math.floor((xb - xa - 0.16) / K.jacket); if (n < 6 || n > jackets) return;
    for (const xe of [xa, xb]) { flat.box(xe - 0.022, 0, z - 0.022, xe + 0.022, y, z + 0.022, rack); flat.box(xe - 0.03, 0, z - 0.28, xe + 0.03, 0.035, z + 0.28, rack); flat.box(xe - 0.035, 0.035, z - 0.03, xe + 0.035, 0.07, z + 0.03, rack); }
    flat.box(xa, y - 0.02, z - 0.015, xb, y + 0.02, z + 0.015, rack);
    const seed = rails.length * 7 + 3; jackets -= n;                                                                                         // (its jackets as one: what is between them is not drawn)
    c.model('store:rail:' + rails.length + ':' + n, () => { const v = new Vox(); for (let i = 0; i < n; i++) { const ci = (i * 3 + seed + (i % 5 === 2 ? 2 : 0)) % PAL.cloth.length; v.stamp(jacketOf(ci, i % 7 === 3), Math.round(i * K.jacket / S), 0, 0, false); } return v; },
      xa + 0.1, z, { y: y - 0.83, solid: false, shadow: false });
    c.solid(xa - 0.05, z - 0.3, xb + 0.05, z + 0.3, { tall: false }); keep(xa, z - 0.3, xb, z + 0.3); rails.push({ xa, xb, z });
  };
  for (let z = zRail0; z < zFront; z += 1.75) for (const s of [-1, 1]) {
    const inner = s * half, outer = s * (W / 2 - 1.2), xa = Math.min(inner, outer), xb = Math.max(inner, outer); if (xb - xa < 1.2) continue;
    for (let x = xa; x + 1.2 <= xb; x += 0.3) { const x1 = Math.min(xb, x + K.rail);                                                       // (in short lengths, where there is the room for one)
      if (deck && z < deck.z1 + 3 * K.step + 0.8 && x1 > deck.x0 - 0.3 && x < deck.x1 + 0.3) continue;
      if (!fits(x, z - 0.3, x1, z + 0.3)) continue;
      railAt(x, x1, z); x += K.rail + 0.6; }
  }

  /* 5 · the walls: a board of jackets in relief, a mirror with the office in it, panelling come away with the office behind it */
  const spansOf = (side, need) => c.spans(side, 0.3, 2.6).filter(([a, b]) => b - a >= need);
  const used = [];
  const onDeck = (side, a, b) => deck && [a, (a + b) / 2, b].some((u) => { const q = c.wallAt(side, u, 0.2); return q.x > deck.x0 - 0.4 && q.x < deck.x1 + 0.4 && q.z > deck.z0 - 0.4 && q.z < deck.z1 + 1.4; });
  const take = (side, need) => { for (const [a, b] of spansOf(side, need)) { let lo = Math.max(a, ...used.filter((u) => u.side === side && u.b <= b).map((u) => u.b + 0.2)); while (lo + need <= b && onDeck(side, lo, lo + need)) lo += 0.25; if (b - lo >= need) { used.push({ side, a: lo, b: lo + need }); return lo + need / 2; } } return null; };
  const office = (key, w, h) => kit.tex.custom(key, w, h, (g) => {                                                                         // cubicles, going away under a low roof of panels
    P(g, '#9a948c', 0, 0, w, h); P(g, '#b8b0a8', 0, 0, w, h * 0.3); for (let x = 0; x < w; x += 8) P(g, '#d8d4f0', x + 2, h * 0.08, 4, 2);
    P(g, '#6a5a60', 0, h * 0.62, w, h * 0.38); for (let k = 0; k < 4; k++) { const y = h * (0.38 + k * 0.06), s = 1 - k * 0.2; for (let x = (k % 2) * 6; x < w; x += 18 * s + 4) { P(g, '#7c8494', x, y, 14 * s, 10 * s); P(g, '#d6ceb8', x + 3 * s, y - 4 * s, 6 * s, 5 * s); } }
    P(g, '#3a3238', w * 0.6, h * 0.6, 6, 10); P(g, '#4f6a42', w * 0.82, h * 0.38, 6, 12);
  });
  // the board: wood, two jackets on it, hung flat, life size
  { const side = deckSide === -1 ? 'right' : 'left', m = take(side, 2.2) ?? take('back', 2.2);
    if (m != null) { const sd = used[used.length - 1].side; wallBox(c, sd, m - 1.1, m + 1.1, 0.7, 2.6, 0, 0.06, wood); for (let k = 0; k < 9; k++) wallBox(c, sd, m - 1.1 + k * 0.25, m - 1.09 + k * 0.25, 0.7, 2.6, 0.06, 0.065, rgb('#8a6040'), det);
      for (const [k, ci] of [[-0.5, 0], [0.5, 2]]) { const p = c.wallAt(sd, m + k, 0.1); c.model(jk(ci), jacketVox(PAL.cloth[ci]), p.x, p.z, { y: 1.15, rot: Math.atan2(p.n[0], p.n[2]) - Math.PI / 2, scale: 1.6, solid: false, shadow: false }); }
      for (const k of [-1.0, 1.0]) wallBox(c, sd, m + k - 0.03, m + k + 0.03, 2.45, 2.51, 0.06, 0.09, rack, det); } }
  // the mirror: a wood frame, and in the glass the office, not you
  { const side = deckSide === -1 ? 'right' : 'left', m = take(side, 1.3);
    if (m != null) { wallBox(c, side, m - 0.6, m + 0.6, 0.55, 2.45, 0, 0.05, rgb('#6a4a30')); const gl = c.shining('store:mirror', office('store:mirror', 48, 80), 0.7, [0.85, 0.88, 0.9]); wallFace(c, side, m - 0.52, m + 0.52, 0.63, 2.37, gl, [0, 0, 1, 1], 0.052);
      wallBox(c, side, m - 0.52, m - 0.4, 0.63, 2.37, 0.052, 0.054, [0.95, 0.95, 1], det); } }
  // where the panelling has come away: a skin of it stood well off the wall, a ragged hole in it, and in the gap, a slice of the office,
  // built: cubicle panels, a desk and its set, a chair, a lower roof with its light; the rest of the office painted on the wall behind
  { const side = deckSide === 1 ? 'right' : 'left', need = 3.2, m = take(side, need) ?? take(side === 'left' ? 'right' : 'left', need) ?? take('front', need);
    if (m != null) { const sd = used[used.length - 1].side, a = m - need / 2, b = m + need / 2, off = 0.75, top = Math.min(H - 0.05, 3.0), cell = 0.1;
      const hole = (u, y) => { const r = 0.62 + 0.12 * Math.sin(u * 9 + y * 5) + 0.08 * Math.sin(u * 23 - y * 11); return Math.hypot((u - m) / 1.25, (y - 1.3) / 1.3) < r * 1.15 && y > 0.12; };
      const at = (u, d, y0, y1, col, bt) => wallBox(c, sd, u[0], u[1], y0, y1, d[0], d[1], col, bt), skin = rgb(shade(PAL.wall, 0.62));   // (plain colour reads lighter than the papered wall: taken down to match)
      // the skin, a row at a time, the whole of each run of it in one piece; its torn edge, plaster, a cell at a time
      for (let y = 0; y < top - 1e-6; y += cell) { let run = null; const y1 = Math.min(top, y + cell);
        for (let u = a; u < b - 1e-6; u += cell) { const inH = hole(u + cell / 2, y + cell / 2), edge = !inH && (hole(u + cell * 1.5, y + cell / 2) || hole(u - cell / 2, y + cell / 2) || hole(u + cell / 2, y + cell * 1.5) || hole(u + cell / 2, y - cell / 2));
          if (!inH && !edge) { if (run === null) run = u; continue; }
          if (run !== null) { at([run, u], [off - 0.06, off], y, y1, skin, flat); run = null; }
          if (edge) { at([u, u + cell], [off - 0.05, off - 0.005], y, y1, rgb(PAL.plaster), det); at([u, u + cell], [off - 0.07, off - 0.05], y, y1, rgb('#8a7a5a'), det); } }
        if (run !== null) at([run, b], [off - 0.06, off], y, y1, skin, flat); }
      for (let u = a + 0.4; u < b - 0.1; u += 0.4) if (!hole(u, 0.6) && !hole(u, 2.0)) at([u - 0.006, u + 0.006], [off, off + 0.003], 0.12, top, rgb(PAL.seam), det);
      at([a - 0.05, a], [0, off], 0, top, rgb(PAL.seam), flat); at([b, b + 0.05], [0, off], 0, top, rgb(PAL.seam), flat); at([a - 0.05, b + 0.05], [0, off], top - 0.01, top, rgb(PAL.seam), flat);
      // behind: the office's floor, its lower roof and a light in it, cubicle panels across, a desk with a set, a chair; painted beyond
      const view = c.shining('store:behind', office('store:behind', 64, 64), 0.55, [0.9, 0.9, 0.95]); wallFace(c, sd, a + 0.05, b - 0.05, 0, top, view, [0, 0, 2, 1], 0.012);
      at([a, b], [0.01, off - 0.06], 0, 0.006, rgb('#6c6870'), det); at([a, b], [0.01, off - 0.06], 2.45, 2.47, rgb('#c8c0c8'), det);
      const lamp = c.shining('store:behind:lamp', kit.tex.white(), 1.2, [0.95, 0.92, 1], { detail: true }); at([m - 0.5, m + 0.5], [0.15, 0.45], 2.44, 2.45, [1, 1, 1], lamp);
      for (const u of [m - 0.85, m + 0.7]) { at([u - 0.03, u + 0.03], [0.02, off - 0.12], 0, 1.4, rgb('#6c7684'), det); at([u - 0.04, u + 0.04], [0.02, off - 0.1], 1.4, 1.43, rgb('#9a9ca0'), det); }
      at([m - 0.8, m + 0.65], [0.02, 0.5], 0.72, 0.75, rgb('#b0a28c'), det); at([m - 0.78, m - 0.74], [0.04, 0.48], 0, 0.72, rgb('#8a8d90'), det);
      { const q = c.wallAt(sd, m - 0.1, 0.24); c.model('store:crt', crtVox, q.x, q.z, { y: 0.8, rot: Math.atan2(q.n[0], q.n[2]), scale: 1.3, solid: false, shadow: false });
        const ch = c.wallAt(sd, m + 0.25, 0.58); c.model('store:chair', chairVox, ch.x, ch.z, { rot: Math.atan2(q.n[0], q.n[2]) + 0.4, scale: 0.95, solid: false, shadow: false }); }
      const p0 = c.wallAt(sd, a - 0.05, 0), p1 = c.wallAt(sd, b + 0.05, off); c.solid(Math.min(p0.x, p1.x), Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), Math.max(p0.z, p1.z), { tall: true });
      for (let k = 0; k < 9; k++) { const q = c.wallAt(sd, m - 0.7 + k * 0.17, off + 0.06 + (k % 3) * 0.07); det.box(q.x - 0.05, 0.0, q.z - 0.04, q.x + 0.05, 0.012 + (k % 2) * 0.012, q.z + 0.04, rgb(k % 2 ? PAL.plaster : '#b8a890')); } } }
  // two rails on the walls, one over the other, where there is wall for them: the jackets hung across the wall
  for (const side of ['left', 'right']) { const m = take(side, 2.4); if (m == null) continue;
    for (const [y, n0] of [[2.05, 0], [1.2, 1]]) { const n = Math.floor(2.1 / K.jacket); if (n > jackets) continue; jackets -= n;
      wallBox(c, side, m - 1.2, m + 1.2, y - 0.015, y + 0.015, 0.33, 0.36, rack); for (const k of [-1.1, 1.1]) wallBox(c, side, m + k - 0.015, m + k + 0.015, y - 0.015, y + 0.015, 0, 0.36, rack);
      const q = c.wallAt(side, m - 1.05, 0.345), turn = side === 'left' ? 1 : 3, dir = c.wallAt(side, m + 1, 0); const ux = Math.sign(dir.x - q.x), uz = Math.sign(dir.z - q.z);
      c.model('store:wallrail:' + side + ':' + n0 + ':' + n, () => { const v = new Vox(), st = Math.round(K.jacket / S); for (let i = 0; i < n; i++) v.stamp(jacketOf((i * 3 + n0 * 2 + 1) % PAL.cloth.length, false).turned(turn), ux * i * st, 0, uz * i * st, false); return v; },
        q.x, q.z, { y: y - 0.83, solid: false, shadow: false }); }
    const p0 = c.wallAt(side, m - 1.2, 0), p1 = c.wallAt(side, m + 1.2, 0.62); c.solid(Math.min(p0.x, p1.x), Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), Math.max(p0.z, p1.z), { tall: true }); }

  /* 6 · a table of old sets, stacked, by the way in: the office again, sold */
  { const s = deckSide ? -deckSide : R.pick([-1, 1]), tx = s * (W / 2 - 1.6), tz = zFront - 0.2;
    if (c.clear(tx, tz, 0.75)) { flat.box(tx - 0.7, 0, tz - 0.4, tx + 0.7, 0.85, tz + 0.4, rgb('#d8ccb8')); flat.box(tx - 0.74, 0.85, tz - 0.44, tx + 0.74, 0.9, tz + 0.44, wood); c.solid(tx - 0.74, tz - 0.44, tx + 0.74, tz + 0.44, { tall: false });
      const face = -Math.sign(tx) * 0.5 + Math.PI * 0; [[-0.35, 0, 0], [0.3, 0, 0.1], [-0.05, 0.38, -0.15], [0.32, 0.38, 0.2], [0.1, 0.74, 0]].forEach(([dx, dy, r], i) => c.model('store:crt', crtVox, tx + dx, tz, { y: 0.95 + dy, rot: face + r, scale: 1.4, solid: false, shadow: false }));
      det.box(tx - 0.5, 0.9, tz + 0.22, tx - 0.1, 0.93, tz + 0.36, rgb('#d6ceb8')); } }

  /* 7 · overhead: square signs on rods, at intervals, the zigzag on them; the ceiling's light fittings */
  const sign = c.mapped('store:sign', kit.tex.custom('store:sign', 32, 24, (g, w, h) => { P(g, PAL.sign, 0, 0, w, h); P(g, '#7a3a40', 0, 0, w, 1); P(g, '#7a3a40', 0, h - 1, w, 1); P(g, '#7a3a40', 0, 0, 1, h); P(g, '#7a3a40', w - 1, 0, 1, h);
    for (let x = 3; x < w - 3; x++) { const y = Math.round(h / 2 + 4 * Math.sin((x / (w - 6)) * Math.PI * 3) - (x - w / 2) * 0.2); P(g, PAL.zig, x, y - 1, 1, 3); } }));
  for (const [sx, sz] of [[-1, 0.15], [1, 0.4], [-1, 0.7], [1, 0.95]]) { const x = sx * (W / 2 - 2.6), z = zBack + 3.4 + sz * (D - 4.6), y = H - 0.95;
    upright(sign, x - 0.4, z, x + 0.4, z, y, y + 0.6, [0, 0, 1, 1]); upright(sign, x + 0.4, z - 0.01, x - 0.4, z - 0.01, y, y + 0.6, [0, 0, 1, 1]); flat.box(x - 0.42, y - 0.02, z - 0.008, x + 0.42, y + 0.62, z - 0.002, rgb('#7a3a40'));
    for (const k of [-0.3, 0.3]) det.box(x + k - 0.006, y + 0.62, z - 0.006, x + k + 0.006, H, z + 0.006, rgb('#3a3a3a')); }
  { const tube = c.shining('store:panels', kit.tex.white(), 1.1, [0.95, 0.9, 1]);                                                         // fittings: a frame, two tubes behind a diffuser
    for (let x = -W / 2 + 2.0; x < W / 2 - 1.5; x += 3.2) for (let z = zBack + 3.2; z < D / 2 - 1.0; z += 3.2) { if (Math.abs(x) < frames[0].w / 2 + 0.4 && z < frames[0].z + 0.6) continue;
      det.box(x - 0.62, H - 0.03, z - 0.32, x + 0.62, H - 0.005, z + 0.32, rgb('#c8c4cc')); tube.box(x - 0.56, H - 0.035, z - 0.26, x + 0.56, H - 0.03, z + 0.26, [1, 1, 1]); for (const k of [-0.1, 0.1]) det.box(x - 0.56, H - 0.037, z + k - 0.008, x + 0.56, H - 0.035, z + k + 0.008, rgb('#d8d4e0')); } }
  // the skirting and a rail at dado height, in the wall's own colour, darker; round what is left of the walls
  for (const side of ['left', 'right', 'front', 'back']) for (const [a, b] of c.spans(side, 0.05, 1.2)) { wallBox(c, side, a, b, 0, 0.12, 0, 0.02, rgb('#5a4048'), det); wallBox(c, side, a, b, 0.92, 0.96, 0, 0.022, rgb(PAL.seam), det); }

  c.light(0, H - 0.5, frames[0].z + 1.2, '#f2e2ee', 0.8, { k: 1.3, far: 7 }); c.light(-W / 4, H - 0.5, D / 4, '#f0dce6', 0.7, { k: 1.3, far: 7 }); c.light(W / 4, H - 0.5, D / 4, '#f0dce6', 0.7, { k: 1.3, far: 7 });
  c.light(0, 1.3, frames[2].z, '#ffd0e0', 0.5, { k: 1.6, far: 4 });
  if (deck) c.light((deck.x0 + deck.x1) / 2, K.deck + 1.6, deck.z0 + 1.2, '#ffe2b8', 0.6, { k: 1.4, far: 4.5 });
}
