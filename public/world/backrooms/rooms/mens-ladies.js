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
import { dummyVox, wallFace, wallBox } from '../mall.js';
import { VOXEL as S } from '../../vox/vox.js';

// tunnel: the fitting rooms down the middle (frames, how each shrinks, how far apart) · deck: the office, up three steps · aisle: kept clear down the middle
export const STORE = Object.freeze({ frames: 6, shrink: 0.8, gap: 0.78, frameW: 2.5, frameH: 2.75, deck: 0.51, deckW: 3.4, deckD: 3.0, step: 0.3, aisle: 1.3, rail: 2.0, jacket: 0.085, jackets: 170 });   // jackets: how many the rails hold in all (what the budget for triangles allows)

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
  const wallT = kit.tex.custom('store:wall', 32, 32, (g, w, h) => { P(g, PAL.wall, 0, 0, w, h); for (let x = 0; x < w; x += 16) { P(g, PAL.seam, x, 0, 1, h); P(g, '#8a8d83', x + 1, 0, 1, h); } for (let i = 0; i < 30; i++) P(g, 'rgba(0,0,0,0.05)', (i * 37) % w, (i * 53) % h, 1, 2); });
  const carpetT = kit.tex.custom('store:carpet', 32, 32, (g, w, h) => { P(g, PAL.carpet, 0, 0, w, h); for (let i = 0; i < 260; i++) P(g, PAL.fleck[i % 3], (i * 29 + (i >> 3)) % w, (i * 47) % h, 1, 1); });
  const ceilT = kit.tex.custom('store:ceil', 32, 32, (g, w, h) => { P(g, PAL.tile, 0, 0, w, h); for (let i = 0; i < 70; i++) P(g, '#a8929a', (i * 31) % w, (i * 17) % h, 1, 1); P(g, PAL.grid, 0, 0, w, 1); P(g, PAL.grid, 0, 0, 1, h); });
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

  /* 3 · the rails: rows across the room either side of the way down the middle; jackets on them in the room's colours, a few hung the other way */
  const jk = (ci) => 'store:jacket:' + ci, made = new Map(), jacketOf = (ci, back) => { const k = ci + (back ? 'b' : ''); if (!made.has(k)) { const v = jacketVox(PAL.cloth[ci])(); made.set(k, back ? v.turned(2) : v); } return made.get(k); };
  const zFront = D / 2 - 1.4, zRail0 = frames[0].z + 1.6, rails = [];
  let jackets = K.jackets;
  const railAt = (xa, xb, z, y = 1.55, fall = 0) => {
    if (Math.floor((xb - xa - 0.16) / K.jacket) > jackets) return;                                                                                               // fall: how far it has gone down by its far end
    const feet = [xa, xb], top = (x) => y - fall * ((x - xa) / (xb - xa));
    for (const xe of feet) { const yt = top(xe); if (yt > 0.2) { flat.box(xe - 0.022, 0, z - 0.022, xe + 0.022, yt, z + 0.022, rack); flat.box(xe - 0.03, 0, z - 0.28, xe + 0.03, 0.035, z + 0.28, rack); flat.box(xe - 0.035, 0.035, z - 0.03, xe + 0.035, 0.07, z + 0.03, rack); } }
    sheet(flat, [xa, top(xa) - 0.02, z], [xb, top(xb) - 0.02, z], [xb, top(xb) + 0.02, z], [xa, top(xa) + 0.02, z], 4, 1, null, rack);
    sheet(flat, [xa, top(xa) + 0.02, z - 0.015], [xb, top(xb) + 0.02, z - 0.015], [xb, top(xb) + 0.02, z + 0.015], [xa, top(xa) + 0.02, z + 0.015], 4, 1, null, rack);
    // the jackets on it, as one: packed, so that what is between them is not drawn
    const n = Math.floor((xb - xa - 0.16) / K.jacket), seed = rails.length * 7 + 3; jackets -= n;
    c.model('store:rail:' + rails.length + ':' + n, () => { const v = new Vox(); for (let i = 0; i < n; i++) { const ci = (i * 3 + seed + (i % 5 === 2 ? 2 : 0)) % PAL.cloth.length, j = jacketOf(ci, i % 7 === 3); v.stamp(j, Math.round(i * K.jacket / S), 0, 0, false); } return v; },
      xa + 0.1, z, { y: y - 0.83, solid: false, shadow: false });
    if (!fall) c.solid(xa - 0.05, z - 0.3, xb + 0.05, z + 0.3, { tall: false });
    rails.push({ xa, xb, z });
  };
  const half = K.aisle / 2 + 0.35;
  for (let z = zRail0; z < zFront; z += 1.75) for (const s of [-1, 1]) {
    const inner = s * half, outer = s * (W / 2 - 1.2), xa = Math.min(inner, outer), xb = Math.max(inner, outer); if (xb - xa < 1.2) continue;
    // in short lengths, with gaps to get between them
    for (let x = xa; x + 1.2 <= xb; x += K.rail + 0.9) { const x1 = Math.min(xb, x + K.rail); if (deck && z < deck.z1 + 3 * K.step + 0.8 && x1 > deck.x0 - 0.3 && x < deck.x1 + 0.3) continue;
      if (![x, (x + x1) / 2, x1].every((q) => c.clear(q, z, 0.32))) continue;
      railAt(x, x1, z); }
  }
  // one rail, along the way down the middle, that goes on into the floor: its jackets with it; the carpet torn round where it goes in
  { const s = R.pick([-1, 1]), x = s * (K.aisle / 2 + 0.05), za = zFront - 1.9, zb = za - 4.2;
    if ([za, (za + zb) / 2].every((z) => c.clear(x, z, 0.25))) {
      const y0 = 1.55, slope = 1.55 / 2.6, yAt = (z) => y0 - Math.max(0, (za - 1.4 - z)) * slope, hole = za - 1.4 - y0 / slope;
      flat.box(x - 0.022, 0, za - 0.022, x + 0.022, y0, za + 0.022, rack); flat.box(x - 0.28, 0, za - 0.03, x + 0.28, 0.035, za + 0.03, rack);
      for (let z = za; z > hole - 0.6; z -= 0.12) { const y = yAt(z), y1 = yAt(z - 0.12); sheet(flat, [x, y - 0.02, z], [x, y1 - 0.02, z - 0.12], [x, y1 + 0.02, z - 0.12], [x, y + 0.02, z], 1, 1, null, rack); sheet(flat, [x - 0.015, y + 0.02, z], [x - 0.015, y1 + 0.02, z - 0.12], [x + 0.015, y1 + 0.02, z - 0.12], [x + 0.015, y + 0.02, z], 1, 1, null, rack); }
      // its jackets, as one, going down with it (turned to hang across the way it goes)
      const n = Math.floor((za - 0.12 - (hole - 0.5)) / K.jacket);
      c.model('store:sinking:' + n, () => { const v = new Vox(); for (let i = 0; i < n; i++) { const z = za - 0.12 - i * K.jacket; v.stamp(jacketOf((i * 2 + 3) % PAL.cloth.length, false).turned(1), 0, Math.round((yAt(z) - yAt(za - 0.12)) / S), -Math.round(i * K.jacket / S), false); } return v; },
        x, za - 0.12, { y: yAt(za - 0.12) - 0.83, solid: false, shadow: false });
      for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.283, r = 0.32 + ((k * 7) % 5) * 0.035; det.box(x + Math.cos(a) * r - 0.05, 0.001, hole + Math.sin(a) * r * 1.6 - 0.05, x + Math.cos(a) * r + 0.05, 0.03 + (k % 3) * 0.01, hole + Math.sin(a) * r * 1.6 + 0.05, rgb(k % 2 ? PAL.fleck[0] : PAL.fleck[2])); }
      det.box(x - 0.3, 0.0015, hole - 0.5, x + 0.3, 0.003, hole + 0.5, [0.08, 0.05, 0.06]);
      c.solid(x - 0.3, hole - 0.5, x + 0.3, za + 0.05, { tall: false });
    } }

  /* 4 · the planter, with a dummy in it to the chest; in the room's way, not the aisle's */
  { const s = R.pick([-1, 1]), px = s * (K.aisle / 2 + 1.6), pz = (zRail0 + zFront) / 2 + R.range(-0.4, 0.4);
    if (c.clear(px, pz, 0.85)) {
      const w = 0.6, hgt = 0.5, cream = rgb('#d8ccb8');
      flat.box(px - w, 0, pz - w, px + w, hgt, pz - w + 0.12, cream); flat.box(px - w, 0, pz + w - 0.12, px + w, hgt, pz + w, cream); flat.box(px - w, 0, pz - w + 0.12, px - w + 0.12, hgt, pz + w - 0.12, cream); flat.box(px + w - 0.12, 0, pz - w + 0.12, px + w, hgt, pz + w - 0.12, cream);
      flat.box(px - w - 0.02, hgt, pz - w - 0.02, px + w + 0.02, hgt + 0.04, pz - w + 0.14, wood); flat.box(px - w - 0.02, hgt, pz + w - 0.14, px + w + 0.02, hgt + 0.04, pz + w + 0.02, wood); flat.box(px - w - 0.02, hgt, pz - w + 0.14, px - w + 0.14, hgt + 0.04, pz + w - 0.14, wood); flat.box(px + w - 0.14, hgt, pz - w + 0.14, px + w + 0.02, hgt + 0.04, pz + w - 0.14, wood);
      flat.box(px - w + 0.12, 0.38, pz - w + 0.12, px + w - 0.12, 0.4, pz + w - 0.12, [0.16, 0.12, 0.12]);
      c.model('store:dummy:sunk', dummyVox(0, PAL.cloth[1]), px, pz, { y: -0.98, rot: Math.atan2(-px, -pz) * 0.4, solid: false });
      c.solid(px - w - 0.05, pz - w - 0.05, px + w + 0.05, pz + w + 0.05, { tall: false });
    } }

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
  // where the panelling has come away: a skin of it stood off the wall, with a ragged hole, and through the hole, the office
  { const side = deckSide === 1 ? 'right' : 'left', m = take(side, 2.6) ?? take(side === 'left' ? 'right' : 'left', 2.6) ?? take('front', 2.6);
    if (m != null) { const sd = used[used.length - 1].side, a = m - 1.3, b = m + 1.3, off = 0.22, hole = (u, y) => { const r = 0.62 + 0.12 * Math.sin(u * 9 + y * 5) + 0.08 * Math.sin(u * 23 - y * 11); return Math.hypot((u - m) / 1.0, (y - 1.3) / 1.2) < r * 1.15; };
      const view = c.shining('store:behind', office('store:behind', 64, 64), 0.6, [0.9, 0.9, 0.95]); wallFace(c, sd, a + 0.1, b - 0.1, 0.1, 2.5, view, [0, 0, 1, 1], 0.015);
      for (let u = a; u < b - 0.001; u += 0.1) for (let y = 0; y < 2.6 - 0.001; y += 0.1) { if (hole(u + 0.05, y + 0.05)) continue; const edge = hole(u + 0.15, y + 0.05) || hole(u - 0.05, y + 0.05) || hole(u + 0.05, y + 0.15) || hole(u + 0.05, y - 0.05);
        wallBox(c, sd, u, u + 0.1, y, y + 0.1, off - 0.05, off, rgb(edge ? PAL.plaster : PAL.wall), edge ? det : flat); if (edge) wallBox(c, sd, u, u + 0.1, y, y + 0.1, off - 0.06, off - 0.05, rgb('#b8a890'), det); }
      wallBox(c, sd, a - 0.04, a, 0, 2.6, 0, off, rgb(PAL.seam)); wallBox(c, sd, b, b + 0.04, 0, 2.6, 0, off, rgb(PAL.seam));
      const p0 = c.wallAt(sd, a, 0), p1 = c.wallAt(sd, b, off); c.solid(Math.min(p0.x, p1.x), Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), Math.max(p0.z, p1.z), { tall: true });
      for (let k = 0; k < 7; k++) { const p = c.wallAt(sd, m - 0.5 + k * 0.17, off + 0.08 + (k % 3) * 0.06); det.box(p.x - 0.05, 0.002, p.z - 0.04, p.x + 0.05, 0.012 + (k % 2) * 0.01, p.z + 0.04, rgb(PAL.plaster)); } } }

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
