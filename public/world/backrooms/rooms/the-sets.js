// The Backrooms — a shop of the shopping centre (themes.js `mall`): The Sets
// ("the shop of televisions"). Somebody was told that in a shopping centre
// there is a shop where all the televisions are on at once, and that this is
// called a demonstration. So: sets on shelves to the roof along the back, and
// on tables down the middle, back to back, every one of them a different
// age. They are off. As you go by, each comes on, a beat late, with a hiss;
// behind you they go off again. Every one of them is on the same channel,
// and it says so. Most have nothing on it. Some have a picture of somewhere.
// By the till there is a big set with a camera stood on it, the way a shop
// shows you yourself on the screen: it shows the shop from up there, a
// little late, and not you. Somebody is stood where you were.
//
// The screens are one picture (a canvas, a cell for each set) drawn ten times
// a second while somebody is in here; the big set's screen is what its camera
// sees, drawn small, five times a second, only while it can be seen.
import * as THREE from 'three';
import { Batch, lamp } from '../kit.js';
import { P } from '../bits.js';
import { Vox, M, VOXEL } from '../../vox/vox.js';
import { upright } from '../suburb.js';
import { mallNeon, dummyVox, wallBox, wallFace, MALL_TEX } from '../mall.js';
const wallFace2 = (c, side, a, b, y0, y1, batch) => wallFace(c, side, a, b, y0, y1, batch, [0, 0, 1, 1], 0.014);

export const SETS = Object.freeze({ most: 64, shelf: 0.56, aisle: 1.5, near: 2.3, far: 4.2, fps: 10, cols: 8, cellW: 64, cellH: 48, feed: [160, 120], feedEvery: 0.2, lag: 2.2, gone: 1.1 });
const S = VOXEL;

/* the sets: four kinds. w, h, d: the case, in voxels; the tube behind is deeper by `tube`. The screen: sw × sh, its middle sx across, from sy up */
export const KINDS = Object.freeze([
  { w: 18, h: 15, d: 11, tube: 4, sw: 11, sh: 8, sx: -2, sy: 4, col: '#d9d0b8', trim: '#8d8676', top: 'handle' },   // a portable, cream
  { w: 26, h: 21, d: 13, tube: 6, sw: 16, sh: 12, sx: -3, sy: 5, col: '#6e7176', trim: '#3a3c40', top: null },     // grey, the knobs at the side
  { w: 32, h: 26, d: 15, tube: 6, sw: 21, sh: 16, sx: -3, sy: 6, col: '#5a3c22', trim: '#b9bec4', top: 'ears' },   // wood, a silver surround, the ears
  { w: 28, h: 22, d: 14, tube: 6, sw: 20, sh: 14, sx: 0, sy: 6, col: '#1d1e22', trim: '#55585e', top: null },      // black, the knobs under
]);

/** One set, facing +z, stood on y 0, its middle at x 0. */
export function tvVox(k) {
  return () => {
    const K = KINDS[k], v = new Vox(), cas = M(K.col, k === 2 ? 3 : 1), trim = M(K.trim, 0), glass = M('#0c1210', 0), chrome = M('#b9bec4', 0), dark = M('#141416', 0);
    const hw = K.w / 2, hd = K.d / 2;
    v.rbox(-hw, 0, -hd, hw, K.h, hd, 1, cas);
    v.box(-hw * 0.62, K.h * 0.18, -hd - K.tube, hw * 0.62, K.h * 0.82, -hd, cas);                         // the tube's housing, behind
    const x0 = K.sx - K.sw / 2, x1 = K.sx + K.sw / 2, y0 = K.sy, y1 = K.sy + K.sh;
    v.box(x0 - 1, y0 - 1, hd, x1 + 1, y1 + 1, hd, trim);                                                     // the surround, proud
    v.carve(x0, y0, hd - 1, x1, y1, hd); v.box(x0, y0, hd - 2, x1, y1, hd - 2, glass);                        // the screen, sunk
    if (k === 3) { for (let i = 0; i < 4; i++) v.cyl('z', -hw + 4 + i * 3, 2, hd, hd + 1, 0.9, chrome); for (let x = 4; x < hw - 2; x += 2) v.box(x, 1, hd, x, 4, hd, dark); }
    else { const kx = x1 + 3; for (let i = 0; i < (k === 0 ? 2 : 3); i++) v.cyl('z', kx, y1 - 2 - i * 4, hd, hd + 1, k === 0 ? 1 : 1.4, chrome);
      for (let y = y0; y < y0 + 5; y += 2) v.box(kx - 2, y, hd, kx + 2, y, hd, dark); }                       // knobs, and a grille under them
    if (k === 2) for (const x of [-hw + 2, hw - 3]) v.box(x, -3, -hd + 2, x + 1, 0, -hd + 3, cas), v.box(x, -3, hd - 3, x + 1, 0, hd - 2, cas);   // legs
    if (K.top === 'handle') { v.box(-hw + 3, K.h, -1, -hw + 4, K.h + 3, 1, dark); v.box(hw - 4, K.h, -1, hw - 3, K.h + 3, 1, dark); v.box(-hw + 3, K.h + 3, -1, hw - 3, K.h + 4, 1, dark); }
    if (K.top === 'ears') { v.ellipsoid(0, K.h + 1, -2, 4, 2, 3, dark); v.tube(-1, K.h + 2, -2, -9, K.h + 16, -2, 0.5, chrome); v.tube(1, K.h + 2, -2, 10, K.h + 14, -2, 0.5, chrome); }
    return v;
  };
}

/** Where on the set the screen's picture goes (metres, the set's own frame: x across, y up, z out of the front). */
export function screenOf(k, scale = 1) {
  const K = KINDS[k], u = S * scale;
  return { x0: (K.sx - K.sw / 2 - 0.5) * u, x1: (K.sx + K.sw / 2 + 0.5) * u, y0: (K.sy - 0.5) * u, y1: (K.sy + K.sh + 0.5) * u, z: (K.d / 2 - 1.5) * u + 0.004, h: (K.h + 0.5) * u, w: (K.w + 1) * u };   // (a voxel at i fills i ± ½)
}

/** The camera on its little bracket, looking +z. */
function camVox() { const v = new Vox(), b = M('#2a2c30', 0), g = M('#8d949c', 0); v.box(-2, 0, -2, 2, 1, 2, g); v.box(-1, 1, -1, 1, 3, 1, g); v.rbox(-4, 3, -6, 4, 9, 4, 1, b); v.cyl('z', 0, 6, 4, 7, 2.6, b); v.cyl('z', 0, 6, 7, 8, 2, M('#5a6a8a', 0)); v.box(3, 8, -5, 3, 8, -5, M('#ff2a1e', 0)); return v; }
/** A box a set came in. */
function boxVox(w, h, d) { return () => { const v = new Vox(), card = M('#b08a58', 2), tape = M('#c9b28a', 1); v.box(-w, 0, -d, w, h, d, card); v.box(-w, h, -1, w, h, 1, tape); v.box(-w + 3, 4, d, w - 3, h - 4, d, M('#3a2a1c', 2)); return v; }; }

/* what is on: the pictures, drawn once, small */
const PICS = ['corridor', 'door', 'shop', 'stand', 'orange', 'carpark'];
function drawPic(g, kind, w, h) {
  const F = (c, x, y, ww, hh) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); };
  if (kind === 'corridor') { F('#8a7a3a', 0, 0, w, h); F('#c9b860', w * 0.3, h * 0.25, w * 0.4, h * 0.5); F('#5a5028', w * 0.42, h * 0.38, w * 0.16, h * 0.32); for (let i = 0; i < 3; i++) F('#fff6c0', w * (0.36 + i * 0.1), h * 0.05 + i * 2, w * 0.06, 2); F('#6a5c2a', 0, h * 0.75, w, h * 0.25); }
  else if (kind === 'door') { F('#3a3a40', 0, 0, w, h); F('#0a0a0c', w * 0.38, h * 0.2, w * 0.24, h * 0.62); F('#d8d0c0', w * 0.47, h * 0.36, w * 0.06, h * 0.08); F('#c0b8a8', w * 0.45, h * 0.44, w * 0.1, h * 0.3); }
  else if (kind === 'shop') { F('#1a2030', 0, 0, w, h); for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) F((r + k) % 3 ? '#2a3040' : '#9ab0c0', 4 + k * 8.5, 6 + r * 9, 6, 5); F('#2a2a30', 0, h * 0.72, w, h * 0.28); F('#c0b8a8', w * 0.7, h * 0.5, 3, 9); }
  else if (kind === 'stand') { F('#101418', 0, 0, w, h); g.fillStyle = '#e8e4d8'; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.fillText('PLEASE', w / 2, h * 0.42); g.fillText('STAND STILL', w / 2, h * 0.66); }
  else if (kind === 'orange') { F('#f4efe0', 0, 0, w, h); for (let x = 0; x < w; x += 8) F('#f08a1e', x, 0, 4, h); g.fillStyle = '#e8761c'; g.beginPath(); g.arc(w / 2, h / 2, h * 0.3, 0, 6.3); g.fill(); F('#3f7a3a', w / 2 - 2, h * 0.16, 4, 3); }
  else { F('#2a2a2a', 0, 0, w, h); F('#c9b23a', 0, h * 0.62, w, 2); for (let k = 0; k < 4; k++) { F('#7a1a14', 6 + k * 14, h * 0.4, 10, 6); F('#101010', 7 + k * 14, h * 0.5, 3, 3); F('#101010', 13 + k * 14, h * 0.5, 3, 3); } F('#e8e0b0', 0, 2, w, 2); }
}
function drawCard(g, w, h) {
  const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
  bars.forEach((c, i) => { g.fillStyle = c; g.fillRect(Math.round((i * w) / 7), 0, Math.ceil(w / 7), Math.round(h * 0.68)); });
  g.fillStyle = '#101010'; g.fillRect(0, Math.round(h * 0.68), w, h); g.strokeStyle = '#e8e8e8'; g.lineWidth = 1; g.beginPath(); g.arc(w / 2, h * 0.42, h * 0.26, 0, 6.3); g.stroke();
  g.fillStyle = '#e8e8e8'; g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.fillText('SAME CHANNEL', w / 2, h * 0.9);
}

export function build(c) {
  const { W, D, H, R, params: p, kit, env } = c, K = SETS;
  const wallT = kit.tex.custom('sets:wall', 32, 32, (g, w, h) => { P(g, '#8c8f94', 0, 0, w, h); P(g, '#7d8085', 0, 0, w, 1); for (let i = 0; i < 40; i++) P(g, 'rgba(0,0,0,0.08)', (i * 37) % w, (i * 53) % h, 1, 1); });
  const carpet = MALL_TEX.carpet(kit, 'sets:carpet:64', '#2c3142', ['#363c50', '#22263a', '#3e3346']);
  c.shell({ wallTex: wallT, floorTex: carpet, panels: false });

  /* the screens: one picture with a cell for each set */
  const sets = [], cols = K.cols, cw = K.cellW, ch = K.cellH, tw = cols * cw, th = Math.ceil(K.most / cols) * ch;
  const tex = kit.tex.live(tw, th, (g) => { g.fillStyle = '#0c1210'; g.fillRect(0, 0, tw, th); });
  tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const scr = c.shining('sets:screens', tex, 1.25, [1, 1, 1]);
  const put = (k, x, z, y, face, opt = {}) => {                                    // face: +1 the set looks +z, -1 it looks -z
    const sc = opt.scale || 1, o = screenOf(k, sc), rot = face > 0 ? 0 : Math.PI;
    if (opt.far) c.model('sets:tv:far:' + k, () => tvVox(k)().downsample(2), x, z, { y, rot, scale: sc * 2, solid: false, shadow: false });   // (out of reach, up top: cut coarser)
    else c.model('sets:tv:' + k, tvVox(k), x, z, { y, rot, scale: sc, solid: false, shadow: false });
    const zf = z + face * o.z, xa = x + face * o.x0, xb = x + face * o.x1;
    sets.push({ i: sets.length, k, x, y, z, face, xa, xb, zf, y0: y + o.y0, y1: y + o.y1, always: !!opt.always, on: 0, want: false, wait: 0, ch: opt.ch || null, boot: 0, roll: R.range(0, 40) });
    return o;
  };
  /* the back: shelves of steel to near the roof, sets along each, packed in as they come */
  const z0 = -D / 2, sd = K.shelf, steel = [0.42, 0.44, 0.48], edge = [0.78, 0.2, 0.16];
  const levels = [0.18, 0.98, 1.78, 2.58].filter((y) => y + 0.75 < H - 0.15);
  c.flat.box(-W / 2 + 0.1, 0, z0, W / 2 - 0.1, 0.18, z0 + sd, [0.16, 0.16, 0.18]);
  for (const y of levels.slice(1)) { c.flat.box(-W / 2 + 0.1, y - 0.04, z0, W / 2 - 0.1, y, z0 + sd, steel); c.flat.box(-W / 2 + 0.1, y - 0.07, z0 + sd, W / 2 - 0.1, y - 0.002, z0 + sd + 0.004, edge); }
  for (let x = -W / 2 + 0.1; x <= W / 2 - 0.09; x += (W - 0.2) / Math.round((W - 0.2) / 1.6)) c.flat.box(x - 0.03, 0, z0 + sd - 0.05, x + 0.03, levels[levels.length - 1] + 0.7, z0 + sd, steel);
  c.solid(-W / 2, z0, W / 2, z0 + sd + 0.05, { tall: true });
  for (const y of levels) {
    let x = -W / 2 + 0.25;
    while (true) { const k = R.pick([0, 1, 1, 2, 3, 3]), w = (KINDS[k].w + 1) * S; if (x + w > W / 2 - 0.2 || sets.length >= K.most) break; put(k, x + w / 2, z0 + 0.06 + ((KINDS[k].d / 2 + KINDS[k].tube) * S), y, 1, { far: y > 2 }); x += w + R.range(0.04, 0.14); }
  }
  /* down the middle: a table, sets on it both ways, back to back */
  const tz = z0 + sd + K.aisle + 0.45, tl = Math.min(W - 4.2, 6.5), tableC = [0.2, 0.2, 0.22];
  if (tl > 1.6 && tz + 0.45 < D / 2 - 2.6) {
    c.flat.box(-tl / 2 + 0.06, 0, tz - 0.39, tl / 2 - 0.06, 0.08, tz + 0.39, [0.08, 0.08, 0.09]); c.flat.box(-tl / 2, 0.08, tz - 0.45, tl / 2, 0.66, tz + 0.45, tableC); c.flat.box(-tl / 2 - 0.02, 0.66, tz - 0.47, tl / 2 + 0.02, 0.7, tz + 0.47, [0.16, 0.17, 0.2]); c.flat.box(-tl / 2 - 0.025, 0.655, tz - 0.475, tl / 2 + 0.025, 0.675, tz + 0.475, [0.72, 0.74, 0.78]);
    c.solid(-tl / 2, tz - 0.47, tl / 2, tz + 0.47, { tall: false, top: 0.7 });
    for (const face of [1, -1]) { let x = -tl / 2 + 0.1; while (true) { const k = R.pick([0, 1, 3]), w = (KINDS[k].w + 1) * S; if (x + w > tl / 2 - 0.1 || sets.length >= K.most) break; put(k, x + w / 2, tz + face * 0.06 + face * (KINDS[k].d / 2) * S, 0.7, face); x += w + R.range(0.08, 0.2); } }
  }
  /* the front: the counter on one side, and on the other the big set with the camera on it */
  const cs = R.pick([-1, 1]), zF = D / 2;
  // the counter: along the front wall, the till on it, a basket of the remote controls; boxes the sets came in, stacked
  const cx0 = cs > 0 ? 0.6 : -W / 2 + 0.9, cx1 = cs > 0 ? W / 2 - 0.9 : -0.6, cz = zF - 1.25;
  c.flat.box(cx0, 0, cz - 0.3, cx1, 0.95, cz + 0.3, [0.24, 0.24, 0.27]); c.flat.box(cx0 - 0.03, 0.95, cz - 0.33, cx1 + 0.03, 1.0, cz + 0.33, [0.7, 0.68, 0.62]); c.flat.box(cx0, 0.02, cz - 0.31, cx1, 0.12, cz - 0.3, edge);
  c.solid(cx0 - 0.03, cz - 0.33, cx1 + 0.03, cz + 0.33, { tall: false });
  const till = (cx0 + cx1) / 2 + cs * 0.6;
  for (let i = 0; i < 2 + R.int(0, 2); i++) { const bx = cs > 0 ? W / 2 - 0.55 : -W / 2 + 0.55, bz = cz - 1.0 - (i % 2) * 0.62; if (!c.clear(bx, bz, 0.3)) continue; c.model('sets:box', boxVox(10, 14, 8), bx, bz, { y: 0, rot: R.range(-0.1, 0.1), solid: false }); c.solid(bx - 0.28, bz - 0.22, bx + 0.28, bz + 0.22, { tall: false }); if (R.chance(0.6)) c.model('sets:box', boxVox(10, 14, 8), bx, bz, { y: 0.36, rot: R.range(-0.2, 0.2), solid: false }); }
  // the big set: on a low stand in the front corner, turned to look into the shop; the camera on top of it, looking the same way
  const fx = -cs * (W / 2 - 1.0), fz = zF - 1.0, look = Math.atan2(-fx * 0.6, -(fz + 0.4)), big = 1.6;
  const ok = c.clear(fx, fz, 0.6);
  let feed = null;
  if (ok) {
    c.flat.box(fx - 0.45, 0, fz - 0.35, fx + 0.45, 0.42, fz + 0.35, [0.2, 0.14, 0.1]); c.solid(fx - 0.55, fz - 0.45, fx + 0.55, fz + 0.45, { tall: false });
    c.model('sets:tv:2', tvVox(2), fx, fz, { y: 0.5, rot: look, scale: big, solid: false, shadow: false });
    const o = screenOf(2, big), cosr = Math.cos(look), sinr = Math.sin(look), at = (lx, lz) => [fx + lx * cosr + lz * sinr, fz - lx * sinr + lz * cosr];
    const [ax, az] = at(o.x0, o.z), [bx, bz] = at(o.x1, o.z);
    const [kx, kz] = at(0, o.z - 0.12), ky = 0.5 + o.h;                                   // (stood at the front of its top, so it does not see itself)
    c.model('sets:cam', camVox, kx, kz, { y: 0.5 + o.h - 0.02, rot: look, scale: 1.4, solid: false, shadow: false });
    feed = { ax, az, bx, bz, y0: 0.5 + o.y0, y1: 0.5 + o.y1, kx, kz, ky: ky + 0.15, look };
  }
  /* the name over the shelves, in tube; a card on the counter */
  const neon = mallNeon(kit, 'sets:' + p.seed, ['TELEVISION', 'ALL SETS ON', 'COLOUR', 'RENTALS', 'SAME CHANNEL', 'DEMONSTRATION', 'TV', 'CH 3'], p.seed), lit = c.shining('mall:neon:sets:' + p.seed, neon.texture, 2.3, undefined, { bloom: 2 });
  const ny = Math.min(H - 0.12, (levels[levels.length - 1] || 1) + 0.95);
  if (ny - 0.45 > levels[levels.length - 1] + 0.7) { upright(lit, -2.2, z0 + 0.05, 0, z0 + 0.05, ny - 0.45, ny, neon.uv(0)); upright(lit, 0.2, z0 + 0.05, 2.4, z0 + 0.05, ny - 0.45, ny, neon.uv(1)); }
  const card = c.mapped('sets:card', kit.tex.custom('sets:card', 64, 32, (g, w, h) => { P(g, '#f1ead6', 0, 0, w, h); P(g, '#b3261e', 0, 0, w, 7); g.fillStyle = '#1a1a1a'; g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.fillText('ALL SETS ON', w / 2, 17); g.fillText('DEMONSTRATION', w / 2, 27); }));
  upright(card, till - 0.35, cz + 0.28, till + 0.05, cz + 0.28, 1.0, 1.22, [0, 0, 1, 1]);

  /* the detail: the till, the remote controls, flex hanging off the back of the sets, a price on each shelf edge, a recorder under some, the lights on a track */
  { const det = c.mapped('sets:detail', kit.tex.white(), { detail: true }), dark = [0.1, 0.1, 0.11], white = [0.92, 0.9, 0.84];
    det.box(till - 0.18, 1.0, cz - 0.15, till + 0.18, 1.1, cz + 0.12, [0.2, 0.2, 0.22]); det.box(till - 0.14, 1.1, cz - 0.12, till + 0.14, 1.28, cz - 0.1, dark); det.box(till - 0.1, 1.0, cz + 0.12, till + 0.1, 1.04, cz + 0.22, [0.3, 0.3, 0.32]);
    const bx = till - cs * 0.6; det.box(bx - 0.2, 1.0, cz - 0.15, bx + 0.2, 1.1, cz + 0.15, [0.6, 0.45, 0.25]); for (let i = 0; i < 7; i++) { const x = bx - 0.15 + (i % 4) * 0.09, z = cz - 0.1 + Math.floor(i / 4) * 0.12; det.box(x, 1.1, z, x + 0.04, 1.12, z + 0.1, i % 3 ? dark : [0.5, 0.5, 0.52]); }
    for (const s of sets) { if (s.face < 0 || s.y > 2.7) continue; const bz = s.z - (KINDS[s.k].d / 2 + KINDS[s.k].tube) * S; det.box(s.x - 0.006, Math.max(0.02, s.y - (s.y > 0.5 ? 0.79 : 0.16)), bz - 0.02, s.x + 0.006, s.y + 0.1, bz - 0.008, dark); }
    for (const y of levels) for (let x = -W / 2 + 0.4; x < W / 2 - 0.4; x += R.range(0.7, 1.2)) { det.box(x, y - 0.065, z0 + sd + 0.001, x + 0.14, y - 0.005, z0 + sd + 0.006, white); det.box(x + 0.01, y - 0.03, z0 + sd + 0.006, x + 0.13, y - 0.012, z0 + sd + 0.008, edge); }
    for (const s of sets) if (s.y < 0.3 && s.face > 0 && R.chance(0.35)) det.box(s.x - 0.2, 0.18, s.z + 0.05, s.x + 0.2, 0.25, s.z + 0.15, [0.16, 0.16, 0.18]);
    const cans = c.shining('sets:cans', kit.tex.white(), 1.8, [1, 0.9, 0.75], { detail: true });
    for (const tzz of [z0 + sd + 0.9, zF - 2.2]) { det.box(-W / 2 + 0.6, H - 0.05, tzz - 0.02, W / 2 - 0.6, H, tzz + 0.02, dark);
      for (let x = -W / 2 + 1.0; x < W / 2 - 0.8; x += 1.3) { det.box(x - 0.05, H - 0.2, tzz - 0.05, x + 0.05, H - 0.05, tzz + 0.05, dark); cans.box(x - 0.035, H - 0.205, tzz - 0.035, x + 0.035, H - 0.2, tzz + 0.035, [1, 1, 1]); } } }
  /* the walls: slatwall along the sides, a band in the shop's red under it; a rack of tapes to rent by the counter; posters for sets */
  { const det = c.detail, slat = [0.52, 0.53, 0.56], groove = [0.3, 0.31, 0.34], red = [0.62, 0.16, 0.13];
    for (const side of ['left', 'right', 'front']) for (const [a, b] of c.spans(side, 0.2, 2.2)) {
      wallBox(c, side, a, b, 0.9, 0.96, 0, 0.025, red, det); wallBox(c, side, a, b, 0, 0.1, 0, 0.018, [0.12, 0.12, 0.14], det);
      if (side === 'front') continue;
      wallBox(c, side, a + 0.05, b - 0.05, 1.0, 2.4, 0, 0.012, slat, det); for (let y = 1.05; y < 2.38; y += 0.1) wallBox(c, side, a + 0.05, b - 0.05, y, y + 0.025, 0.012, 0.014, groove, det);
      for (let m = a + 0.6; m < b - 0.5; m += R.range(0.8, 1.4)) { wallBox(c, side, m - 0.005, m + 0.005, 1.55, 1.7, 0.012, 0.12, [0.7, 0.72, 0.76], det); wallBox(c, side, m - 0.06, m + 0.06, 1.42, 1.56, 0.1, 0.13, R.pick([[0.12, 0.12, 0.13], [0.3, 0.3, 0.32], [0.55, 0.5, 0.42]]), det); }   // a peg, and on it a remote or an aerial in its packet
    }
    // the tapes: a rack against the front wall, beside the counter; the boxes' spines in every colour, a few gaps
    { const sp = c.spans('front', 0.4, 2.0).map(([a, b]) => [a, b, Math.abs(c.wallAt('front', (a + b) / 2).x - till)]).filter(([a, b]) => b - a > 1.4).sort((p, q) => p[2] - q[2]).pop();
      if (sp) { const m = (sp[0] + sp[1]) / 2, half = Math.min(0.9, (sp[1] - sp[0]) / 2 - 0.2), p0 = c.wallAt('front', m - half, 0), p1 = c.wallAt('front', m + half, 0.32);
        if ([0, 0.5, 1].every((f) => c.clear(p0.x + (p1.x - p0.x) * f, (p0.z + p1.z) / 2, 0.15))) {                       // (not in the way to a doorway) c.flat.box(Math.min(p0.x, p1.x), 0, Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), 1.9, Math.max(p0.z, p1.z), [0.22, 0.16, 0.12]); c.solid(Math.min(p0.x, p1.x), Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), Math.max(p0.z, p1.z), { tall: true });
          const spines = [[0.1, 0.1, 0.12], [0.75, 0.2, 0.15], [0.15, 0.3, 0.6], [0.85, 0.75, 0.2], [0.2, 0.45, 0.25], [0.9, 0.88, 0.82]];
          for (let y = 0.15; y < 1.85; y += 0.33) { wallBox(c, 'front', m - half, m + half, y - 0.02, y, 0.0, 0.33, [0.3, 0.22, 0.16], det);
            for (let u = m - half + 0.03; u < m + half - 0.04; u += 0.035) if (R.chance(0.88)) wallBox(c, 'front', u, u + 0.03, y, y + 0.2 + R.range(-0.01, 0.01), 0.12, 0.33, R.pick(spines), det); }
          const sign = c.mapped('sets:rent', kit.tex.custom('sets:rent', 64, 16, (g, w, h) => { P(g, '#b3261e', 0, 0, w, h); g.fillStyle = '#f1ead6'; g.font = 'bold 10px monospace'; g.textAlign = 'center'; g.fillText('RENTALS', w / 2, 12); }));
          const q0 = c.wallAt('front', m - half, 0.34), q1 = c.wallAt('front', m + half, 0.34); upright(sign, q1.x, q1.z, q0.x, q0.z, 1.92, 2.12, [0, 0, 1, 1]); } } }
    // posters on whatever is left of the back corners' walls above the shelves: a family round a set, its picture the same snow
    const poster = c.mapped('sets:poster', kit.tex.custom('sets:poster', 32, 44, (g, w, h) => { P(g, '#e9e2cc', 0, 0, w, h); P(g, '#c03a2a', 0, 0, w, 6); P(g, '#5a3c22', 9, 18, 14, 12); P(g, '#c9c9c9', 11, 20, 10, 7); for (let i = 0; i < 10; i++) P(g, i % 2 ? '#f4f4f4' : '#8a8a8a', 11 + (i * 3) % 10, 20 + (i * 5) % 7, 1, 1); for (const x of [3, 25]) { P(g, '#3a3f4a', x, 22, 4, 12); P(g, '#e0c8a8', x, 18, 4, 4); } P(g, '#1a1a1a', 4, 38, 24, 2); }));
    for (const side of ['left', 'right']) { const sp = c.spans(side, 0.3, 2.6).find(([a, b]) => b - a > 1.0); if (sp) { const m = sp[0] + 0.55; wallFace2(c, side, m - 0.3, m + 0.3, 1.25, 2.1, poster); } }
    // flex: from the table across the carpet to the wall, taped down
    for (const sx of [-1, 1]) { const x = sx * (tl / 2 - 0.3); if (tl > 1.6) det.box(x - 0.012, 0.004, tz + 0.47, x + 0.012, 0.016, D / 2 - 0.05, [0.08, 0.08, 0.09]); }
  }
  c.light(0, 1.6, z0 + 1.4, '#9ab8d8', 0.75, { k: 1.3, far: 6 }); c.light(till, 2.2, cz - 0.2, '#ffd9a0', 0.6, { k: 1.4, far: 4.5 }); c.light(0, H - 0.4, 0.5, '#d8d0c0', 0.45, { k: 1.4, far: 7 });
  c.leave('snack', till + cs * 0.5, cz, { y: 1.02 });

  /* the screens' picture: a cell for each set, drawn here */
  const uvOf = (i) => { const col = i % cols, row = Math.floor(i / cols), e = 0.5; return [(col * cw + e) / tw, 1 - ((row + 1) * ch - e) / th, ((col + 1) * cw - e) / tw, 1 - (row * ch + e) / th]; };
  for (const s of sets) { const uv = uvOf(s.i); if (s.face > 0) upright(scr, s.xa, s.zf, s.xb, s.zf, s.y0, s.y1, uv); else upright(scr, s.xa, s.zf, s.xb, s.zf, s.y0, s.y1, uv); }
  // one or two are always on; and what each shows when it is: mostly nothing, some the card, some a picture of somewhere
  for (let n = 0; n < Math.min(2, sets.length); n++) R.pick(sets).always = true;
  for (const s of sets) s.ch = R.chance(0.6) ? 'snow' : R.chance(0.4) ? 'card' : 'pic:' + R.pick(PICS);
  const g = tex.image.getContext('2d'), mk = (draw) => { const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const gg = cv.getContext('2d'); gg.imageSmoothingEnabled = false; draw(gg); return cv; };
  const snow = Array.from({ length: 4 }, () => mk((gg) => { const im = gg.createImageData(cw, ch); for (let i = 0; i < cw * ch; i++) { const v = (Math.random() ** 1.6) * 230; im.data[i * 4] = v; im.data[i * 4 + 1] = v; im.data[i * 4 + 2] = v * 1.05; im.data[i * 4 + 3] = 255; } gg.putImageData(im, 0, 0); }));
  const pics = Object.fromEntries(PICS.map((k) => [k, mk((gg) => drawPic(gg, k, cw, ch))])), cardCv = mk((gg) => drawCard(gg, cw, ch));
  const offCv = mk((gg) => { gg.fillStyle = '#0c1210'; gg.fillRect(0, 0, cw, ch); gg.fillStyle = 'rgba(160,190,200,0.10)'; gg.fillRect(cw * 0.12, ch * 0.1, cw * 0.3, ch * 0.18); gg.fillRect(cw * 0.12, ch * 0.1, cw * 0.08, ch * 0.5); });
  const paintCell = (s, t) => {
    const x = (s.i % cols) * cw, y = Math.floor(s.i / cols) * ch;
    if (!s.on) { g.drawImage(offCv, x, y); return; }
    if (s.boot > 0) { const k = 1 - s.boot / 0.25; g.fillStyle = '#05080a'; g.fillRect(x, y, cw, ch); g.fillStyle = '#e8f0f0'; const hh = Math.max(1, ch * k * k); g.fillRect(x, y + ch / 2 - hh / 2, cw, hh); return; }
    const f = snow[(Math.random() * 4) | 0];
    if (s.ch === 'snow') g.drawImage(f, x, y);
    else { const src = s.ch === 'card' ? cardCv : pics[s.ch.slice(4)], shift = Math.sin(t * 7 + s.roll) > 0.97 ? ((Math.random() * 6) | 0) - 3 : 0;
      g.drawImage(src, x + shift, y); g.globalAlpha = 0.22 + 0.2 * Math.max(0, Math.sin(t * 0.7 + s.roll)); g.drawImage(f, x, y); g.globalAlpha = 1;
      const bar = (((t * 9 + s.roll * 3) % (ch + 12)) | 0) - 6; g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + bar, cw, 5); }
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let yy = 0; yy < ch; yy += 2) g.fillRect(x, y + yy, cw, 1);                     // the lines
    g.fillStyle = '#7dff8a'; g.font = 'bold 8px monospace'; g.textAlign = 'left'; g.fillText('CH 3', x + 4, y + 10);              // the same, on all of them
  };
  for (const s of sets) paintCell(s, 0); tex.needsUpdate = true;

  /* the big set's picture: what its camera sees, small; and somebody, in it only, stood where you were */
  let target = null, cam = null, figure = null;
  const renderer = env?.renderer;
  if (feed && renderer) {
    const rtOpts = { magFilter: THREE.NearestFilter, minFilter: THREE.LinearFilter, depthBuffer: true };
    target = kit.own(renderer.isWebGPURenderer ? new THREE.RenderTarget(K.feed[0], K.feed[1], rtOpts) : new THREE.WebGLRenderTarget(K.feed[0], K.feed[1], rtOpts));
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const fb = c.shining('sets:feed', target.texture, 1.3, [0.92, 1, 0.94]);
    upright(fb, feed.ax, feed.az, feed.bx, feed.bz, feed.y0, feed.y1, [0, 0, 1, 1]);
    cam = new THREE.PerspectiveCamera(62, K.feed[0] / K.feed[1], 0.05, 16); c.add(cam);
    cam.position.set(feed.kx, feed.ky, feed.kz); cam.rotation.set(-0.1, feed.look + Math.PI, 0, 'YXZ');
    const b = new Batch(true); b.addVox(kit.model('sets:who', dummyVox(1, '#39424f')).solid, new THREE.Matrix4().makeScale(S, S, S));
    figure = new THREE.Mesh(kit.geometry(b, [lamp(0.3, 2.4, 1.2, [1, 1, 1], { k: 9, wrap: 0.45, far: 30 })], [0.45, 0.45, 0.5]), kit.surface({ vox: true })); figure.visible = false; c.add(figure);
  }

  /* each set: on as you come by it, a beat late; off again behind you. The big one, on while you are in here */
  const was = []; let acc = 0, feedT = 0, hiss = 0, clock = 0, showing = false, own = null;
  c.tick((dt, t, me) => {
    clock += dt; hiss -= dt;
    if (me.inside) { was.push({ x: me.x, z: me.z, t: clock }); while (was.length && was[0].t < clock - K.lag - 0.5) was.shift(); }
    acc += dt; if (acc < 1 / K.fps) return; const step = acc; acc = 0;
    let dirty = false;
    for (const s of sets) {
      const d = me.inside ? Math.hypot(me.x - s.x, me.z - s.z) : 99, want = s.always ? me.inside || d < 8 : s.on ? d < K.far : d < K.near;
      if (want !== s.want) { s.want = want; s.wait = want ? 0.1 + Math.random() * 0.6 : 0.4 + Math.random(); }   // (run-time dice: not the room's seeded R)
      if (s.wait > 0) { s.wait -= step; if (s.wait <= 0 && !!s.on !== s.want) { s.on = s.want ? 1 : 0; s.boot = s.on ? 0.25 : 0; if (s.on && hiss <= 0) { const w = c.toWorld(s.x, s.z); env.play?.('static', w.x, w.z, 9); hiss = 0.3; } dirty = true; } }
      if (s.boot > 0) { s.boot -= step; dirty = true; }
      if (s.on && (me.inside || s.always)) { paintCell(s, clock); dirty = true; }
    }
    if (dirty) tex.needsUpdate = true;
    // the camera: five times a second, while somebody is in here and could see it
    if (!target || !me.inside) { showing = false; return; }
    feedT -= step; if (feedT > 0) return; feedT = K.feedEvery;
    const mx = (feed.ax + feed.bx) / 2, mz = (feed.az + feed.bz) / 2; if (!showing && !c.seen(mx, mz)) return; showing = c.seen(mx, mz);
    const then = was.find((w) => w.t >= clock - K.lag);
    figure.visible = !!then && Math.hypot(then.x - me.x, then.z - me.z) > K.gone;
    if (figure.visible) { figure.position.set(then.x, 0, then.z); figure.rotation.y = Math.atan2(feed.kx - then.x, feed.kz - then.z); }
    const scene = env.world?.scene; if (!scene) return;
    if (!own) c.rt.group.traverse((o) => { if (o.isMesh && (o.material?.map === target.texture || o.material?.uniforms?.map?.value === target.texture)) own = o; });     // (its own screen is not drawn into itself)
    const hidden = [];
    scene.traverse((o) => { if (o.visible && o.userData?.liquid) { o.visible = false; hidden.push(o); } });
    if (own) own.visible = false;
    const prev = renderer.getRenderTarget(), autoClear = renderer.autoClear, mrt = renderer.getMRT?.() ?? null;
    try {
      if (mrt) renderer.setMRT(null);
      renderer.autoClear = true;
      renderer.setRenderTarget(target);
      renderer.render(scene, cam);
    } finally {
      if (mrt) renderer.setMRT(mrt);
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(prev);
      if (own) own.visible = true;
      for (const o of hidden) o.visible = true;
      figure.visible = false;
    }
  });
}
