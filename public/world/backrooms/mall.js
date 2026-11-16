// The Backrooms — the shopping centre (themes.js `mall`): what its rooms share.
//
// A shopping centre at closing time, as a 1980s office park remembered one
// and built it out of itself. The shop units are office partitions with a
// glazed front and vertical blinds; the doors are office doors; the signs are
// lit boxes lettered by somebody who had heard what shops are called. Half
// the lights are already off. The centre closes in five minutes and has done
// for a long time.
//
// Here: the painted fronts (one sheet), the lit signs (another), and a hole in
// a floor that somebody can walk into (the gap's rule, rooms/the-culvert.js).
import { P } from './bits.js';
import * as THREE from 'three';
import { Batch, lamp } from './kit.js';
import { Vox, M, glow } from '../vox/vox.js';
import { garble, upright } from './suburb.js';

const FW = 1024, FH = 512, CELL = 128, FINE = 2, SIGN_W = 256, SIGN_H = 256, SROW = 32;
/** What the units are called. Nobody who lettered these had been in one. */
export const SHOPS = Object.freeze(['SHOES AND SHOE', 'BAGS BAGS', 'THE RECEIPT SHOP', 'KEYS CUT HEELS', 'PHOTO OF YOU', 'SALE ENDS', 'EVERYTHING MUST', 'GIFTS ASSORTED',
  'TROUSERS TO GO', 'LAST FEW DAYS', '3 FOR 2 FOR 3', 'CARDS AND CARD', 'OPEN CLOSED', 'UNIT 14', 'THE OTHER SHOP', 'MENS LADIES']);
const GLOW = ['#ff9d5c', '#ff6fa8', '#9fe8c8', '#ffd76a', '#8fc4ff', '#f4f0e0'];
export const FRONTS = Object.freeze(['office', 'window', 'shutter', 'half', 'hoarding', 'open', 'blinds', 'door']);

function frontOf(g, kind, n) {
  const w = CELL, h = CELL, frame = '#6b5138', glass = '#2c2520', beige = '#cdbf9f';
  P(g, beige, 0, 0, w, h); P(g, frame, 0, 0, w, 3); P(g, frame, 0, h - 10, w, 10); P(g, '#4a3626', 0, h - 3, w, 3);
  const pane = (x, y, pw, ph, fill = glass) => { P(g, frame, x - 2, y - 2, pw + 4, ph + 4); P(g, fill, x, y, pw, ph); P(g, 'rgba(255,255,255,0.07)', x + 2, y + 2, 3, ph - 4); };
  const blinds = (x, y, pw, ph, open) => { for (let i = 0; i < pw; i += 5) { P(g, '#d9cfb6', x + i, y, open ? 2 : 4, ph); P(g, '#a89c80', x + i + (open ? 2 : 4), y, 1, ph); } P(g, '#8c8068', x, y, pw, 2); };
  const door = (x) => { P(g, frame, x - 2, 14, 30, h - 22); P(g, '#8a6a48', x, 16, 26, h - 26); P(g, glass, x + 5, 24, 16, 30); P(g, '#c9a43a', x + 20, 70, 3, 6); P(g, '#f1ead6', x + 4, 60, 18, 8); };
  if (kind === 'office') { pane(8, 16, 70, 84); blinds(8, 16, 70, 84, n & 1); door(92); }
  else if (kind === 'blinds') { pane(8, 16, 112, 84); blinds(8, 16, 112, 84, false); for (const x of [40, 41, 42, 76]) P(g, glass, x, 40 + (x % 7), 5, 30); }                    // a slat held down, twice
  else if (kind === 'door') { door(14); door(52); door(90); }                                                                                             // three doors, and a unit as wide as one
  else if (kind === 'window') {                                                                                                                             // the ones in the window are looking out
    pane(8, 16, 112, 84, '#1c1a20');
    for (const [x, k] of [[26, 1], [52, 0.9], [76, 1.05], [100, 0.8]]) { g.fillStyle = '#b9ab95'; g.beginPath(); g.ellipse(x, 44, 6 * k, 8 * k, 0, 0, 7); g.fill(); P(g, '#b9ab95', x - 2, 50, 4, 5); P(g, ['#5a4636', '#39424f', '#7a3a34', '#4a5a40'][(x + n) % 4], x - 9 * k, 55, 18 * k, 45); }
    P(g, 'rgba(255,255,255,0.05)', 8, 16, 112, 20);
  } else if (kind === 'shutter' || kind === 'half') {
    pane(8, 16, 112, 84, '#16130f'); const down = kind === 'half' ? 46 : 84;
    for (let y = 0; y < down; y += 4) { P(g, '#8d8f8c', 8, 16 + y, 112, 3); P(g, '#5e605e', 8, 19 + y, 112, 1); }
    P(g, '#3a3c3a', 8, 14 + down, 112, 3); if (kind === 'half') { P(g, '#3d2f22', 20, 78, 30, 22); P(g, '#3d2f22', 70, 70, 24, 30); }                              // boxes, behind
  } else if (kind === 'hoarding') {
    P(g, '#e9e1cc', 6, 14, 116, 90); P(g, '#b3261e', 6, 14, 116, 5); P(g, '#b3261e', 6, 99, 116, 5);
    garble(g, 'EXCITING NEW', 10, 28, 108, 18, { color: '#1c1812', mess: 0.25 }, 7 + n); garble(g, 'UNIT COMING', 10, 50, 108, 18, { color: '#1c1812', mess: 0.4 }, 9 + n); garble(g, 'SOON 1987', 10, 74, 108, 14, { color: '#b3261e', mess: 0.5 }, 11 + n);
  } else {                                                                                                                                                  // the one that is open, stocked and lit; it has no door
    pane(8, 16, 112, 84, '#f3e6b8');
    for (let y = 0; y < 4; y++) { P(g, '#8a6a48', 10, 34 + y * 18, 108, 2); for (let x = 0; x < 13; x++) P(g, ['#c8553d', '#3f7f8f', '#e8c96a', '#6a4a8a', '#f1ead6'][(x * 3 + y + n) % 5], 12 + x * 8, 24 + y * 18, 6, 10); }
    P(g, 'rgba(255,255,255,0.18)', 8, 16, 112, 8);
  }
}
/** The second pass, at half the grain: what is stuck to the glass, what the light does to it, what was dropped at the foot of it. */
function detail(g, kind, n) {
  let k = (n * 2654435761 + 99) >>> 0; const r = () => { k = (Math.imul(k, 1664525) + 1013904223) >>> 0; return k / 4294967296; };
  const q = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  for (let i = 0; i < 3; i++) { const x = 10 + r() * 96, y = 20 + r() * 60, w = 9 + r() * 9, c = ['#e8d44a', '#f1ead6', '#e0563a'][i % 3]; if (kind === 'door') break; q(c, x, y, w, w * 1.3); q('rgba(0,0,0,0.55)', x + 1.5, y + 2, w - 3, 1); q('rgba(0,0,0,0.55)', x + 1.5, y + 4.5, w - 5, 1); q('#b3261e', x + 1.5, y + w * 0.75, w - 3, 2.5); }   // offers, stuck on from inside
  for (let i = 0; i < 40; i++) q('rgba(0,0,0,0.10)', r() * 128, 108 + r() * 18, 1 + r() * 3, 0.5);                                                 // scuffs along the kick plate
  for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 0.5; const x = 12 + r() * 100; g.beginPath(); g.moveTo(x, 18); g.lineTo(x - 14, 98); g.stroke(); }   // the tubes, in the glass
  q('rgba(255,120,170,0.10)', 8, 16, 112, 84); q('#c9a43a', 0, 3, 128, 0.7); q('#c9a43a', 0, 117.5, 128, 0.7);
  if (kind !== 'open' && kind !== 'hoarding') { q('#f1ead6', 96, 30, 14, 9); q('#b3261e', 97, 31, 12, 3); q('rgba(0,0,0,0.6)', 98, 35.5, 9, 0.8); }                                         // CLOSED, on a card, at every one
}
/** The fronts, one sheet: uv of a kind of front, the right way up for upright(). */
export function mallFronts(kit) {
  const texture = kit.tex.custom('mall:fronts', FW, FH, (g) => { FRONTS.forEach((k, i) => { g.save(); g.translate((i % 4) * CELL * FINE, (i >> 2) * CELL * FINE); g.scale(FINE, FINE); g.beginPath(); g.rect(0, 0, CELL, CELL); g.clip(); frontOf(g, k, i); detail(g, k, i); g.restore(); }); });
  return { texture, uv: (kind) => { const i = Math.max(0, FRONTS.indexOf(kind)); const c = CELL * FINE, row = 1 - (i >> 2); return [((i % 4) * c + 1) / FW, (row * c + 1) / FH, ((i % 4) * c + c - 1) / FW, (row * c + c - 1) / FH]; } };
}
/** The signs, one sheet, lit from inside: eight to a room, lettered from `names`, each a colour of tube. */
export function mallSigns(kit, key, names, seed = 1) {
  const texture = kit.tex.custom('mall:signs:' + key, SIGN_W, SIGN_H, (g) => {
    names.slice(0, 8).forEach((name, i) => {
      const y = i * SROW, col = GLOW[(i + seed) % GLOW.length];
      P(g, '#1a1612', 0, y, SIGN_W, SROW); P(g, col, 3, y + 3, SIGN_W - 6, SROW - 6); P(g, 'rgba(255,255,255,0.35)', 3, y + 3, SIGN_W - 6, 4); P(g, 'rgba(0,0,0,0.18)', 3, y + SROW - 8, SIGN_W - 6, 5);
      garble(g, name, 8, y + 4, SIGN_W - 16, SROW - 8, { color: '#2a1f16', mess: 0.42 }, seed * 13 + i * 7);
      if ((i + seed) % 3 === 0) P(g, 'rgba(26,22,18,0.82)', 3 + ((seed * 37 + i * 61) % 150), y + 3, 46, SROW - 6);                                    // a tube gone, behind some of it
    });
  });
  return { texture, uv: (i) => [0.5 / SIGN_W, 1 - (i * SROW + SROW - 0.5) / SIGN_H, 1 - 0.5 / SIGN_W, 1 - (i * SROW + 0.5) / SIGN_H] };
}
/** A flat piece on the four sides of a block (x0…z1), y0 to y1, each side by what `pick(side)` says: { batch, uv } or null. */
export function wrap(x0, z0, x1, z1, y0, y1, pick) {
  const sides = [[x0, z1, x1, z1], [x1, z1, x1, z0], [x1, z0, x0, z0], [x0, z0, x0, z1]];
  sides.forEach(([ax, az, bx, bz], i) => { const f = pick(i); if (f) upright(f.batch, ax, az, bx, bz, y0, y1, f.uv); });
}

/**
 * A hole in this room's floor that somebody can walk into, and that is the end of them (not on Tourist: env.difficulty).
 * inHole(x, z) in the room's own frame. The floor as the building has it is what counts, so anything laid across is floor.
 * As rooms/the-culvert.js, which was the first.
 */
export function voidIn(c, inHole, opt = {}) {
  const { H } = c, deep = opt.deep ?? 40, brink = opt.brink ?? 0.25, falls = opt.falls ?? 1.7, env = c.env, ground = opt.floor || (() => 0);   // (opt.floor: how high the floor is where it is not hole)
  let fall = null;
  c.rt.floorY = (x, z) => (fall ? fall.y : inHole(x, z) ? -deep : ground(x, z));
  c.rt.headY = (x, z) => H - c.rt.floorY(x, z);
  const open = (x, z) => { const q = c.toWorld(x, z); return env.world.floorY(q.x, q.z) < -1; };
  c.tick((dt, t, me) => {
    if (fall) {
      fall.t += dt; fall.y = Math.max(-80, (fall.y0 || 0) - 0.5 * 9.8 * fall.t * fall.t);
      const q = c.toWorld(fall.x, fall.z); env.player?.warp?.(q.x, q.z);
      const eye = env.player?.me; if (eye) eye.pitch = Math.min(0.95, eye.pitch + dt * 1.3);
      env.red?.(Math.min(0.9, fall.t * 0.5)); env.interfere?.(0.3 + 0.5 * Math.min(1, fall.t / falls));
      if (fall.t >= falls && !fall.over) { fall.over = true; env.hold?.(false); env.end?.('caught'); if (env.difficulty?.() === 'tourist') fall = null; }
      return;
    }
    if (!me.inside || env.player?.me?.frozen) return;
    for (let a = 0; a < 8; a++) if (open(me.x + Math.sin(a * 0.7854) * brink, me.z + Math.cos(a * 0.7854) * brink)) {
      fall = { x: me.x, z: me.z, y: ground(me.x, me.z), t: 0, y0: ground(me.x, me.z) }; env.hold?.(true); env.run?.met?.(c.room.arch);
      const q = c.toWorld(me.x, me.z); env.play?.('rattle', q.x, q.z, 6); return;
    }
  });
}

const TUBES = ['#ff3d9a', '#35e0ff', '#ffb02e', '#b46bff', '#5dff9a', '#ff5a3c'];
/**
 * Neon: words in tube on black, each with the glow it throws on what is behind it, and one tube of each not lit.
 * names: up to eight. → { texture, uv(i), colour(i) }; draw into a c.shining batch.
 */
export function mallNeon(kit, key, names, seed = 1) {
  const W = 512, H = 512, ROW = 64;
  const texture = kit.tex.custom('mall:neon:' + key, W, H, (g) => {
    g.fillStyle = '#08070a'; g.fillRect(0, 0, W, H);
    names.slice(0, 8).forEach((name, i) => {
      const y = i * ROW, col = TUBES[(i + seed) % TUBES.length];
      g.save(); g.beginPath(); g.rect(0, y, W, ROW); g.clip();
      g.shadowColor = col; g.shadowBlur = 14; garble(g, name, 14, y + 8, W - 28, ROW - 16, { color: col, mess: 0.38, weight: 400 }, seed * 17 + i * 5);
      g.shadowBlur = 5; garble(g, name, 14, y + 8, W - 28, ROW - 16, { color: '#fff4f8', mess: 0.38, weight: 400 }, seed * 17 + i * 5);
      g.shadowBlur = 0; g.fillStyle = 'rgba(8,7,10,0.86)'; g.fillRect(40 + ((seed * 53 + i * 97) % 330), y + 4, 34 + (i * 13) % 30, ROW - 8);       // a letter or two, out
      g.strokeStyle = col; g.lineWidth = 2; g.shadowColor = col; g.shadowBlur = 8; g.strokeRect(5, y + 5, W - 10, ROW - 10); g.restore();
    });
  });
  // (a sheet's rows are counted from the bottom of it by what draws it: the first name is the top row)
  return { texture, uv: (i) => [1 / W, 1 - (i * ROW + ROW - 1) / H, 1 - 1 / W, 1 - (i * ROW + 1) / H], colour: (i) => TUBES[(i + seed) % TUBES.length] };
}
export const tube = (i) => TUBES[((i % TUBES.length) + TUBES.length) % TUBES.length];

/** A shop's dummy, as described: the right number of everything, joined by somebody who had not seen one move. pose: 0…3. */
export function dummyVox(pose = 0, dress = '#39424f', head = null) {
  return () => {
    const v = new Vox(), skin = M('#d8cbb4', 0), seam = M('#b3a68e', 0), cloth = M(dress, 2), base = M('#8d949c', 0);
    const peel = M('#f08a1e', 2);
    v.cyl('y', 0, 0, 0, 1, 8, base); v.cyl('y', 0, 0, 1, 34, 0.8, base);                                         // the stand it is on, up its back
    v.rbox(-5, 34, -3, 5, 54, 3, 2, cloth); v.rbox(-4, 30, -3, 4, 36, 3, 2, cloth); v.box(-5, 44, -3, 5, 44, 3, seam);
    for (const sx of [-1, 1]) { v.tube(sx * 2.5, 30, 0, sx * 3, 16, pose === 2 ? 3 : 0, 1.7, cloth); v.tube(sx * 3, 16, pose === 2 ? 3 : 0, sx * 3, 2, 0, 1.5, skin); v.rbox(sx * 3 - 2, 0, -2, sx * 3 + 2, 2, 5, 1, skin); }
    v.cyl('y', 0, 0, 54, 57, 1.6, skin); if (head === 'orange') { v.ellipsoid(0, 64, 0, 7.5, 7, 7.5, peel); v.cyl('y', 0, 0, 70, 72, 1, M('#3f7a3a', 2)); v.box(1, 71, 0, 5, 71, 2, M('#5f9a48', 2)); } else { v.ellipsoid(0, 62, 0, 4.2, 5.2, 4.6, skin); v.box(-4, 62, -5, 4, 62, 5, seam); }       // a head, with the join round it and nothing on it
    const arm = (sx, a) => { const ex = sx * (7 + a[0]), ey = 44 + a[1], ez = a[2]; v.tube(sx * 5.5, 52, 0, ex, ey, ez, 1.5, cloth); v.tube(ex, ey, ez, ex + sx * a[3], ey + a[4], ez + a[5], 1.3, skin); v.ellipsoid(ex + sx * a[3], ey + a[4], ez + a[5], 1.6, 2, 1.6, skin); };
    const P4 = [[[1, -6, 0, 0, -9, 1], [1, -6, 0, 0, -9, 1]], [[3, 0, 3, 2, 8, 4], [1, -6, 0, 0, -9, 1]], [[2, -2, -4, -3, 9, -3], [2, -2, -4, -3, 9, -3]], [[4, 4, 0, 5, 6, 0], [4, 4, 0, 5, 6, 0]]][pose % 4];
    arm(-1, P4[0]); arm(1, P4[1]);
    return v;
  };
}
/** A palm, for the atrium: a coat stand, with what a palm has at the top of it done in green card. */
export function palmVox() {
  const v = new Vox(), wood = M('#5a3c22', 3), brass = M('#c9a43a', 0), g1 = M('#3f7a3a', 2), g2 = M('#5f9a48', 2), pot = M('#b7a98a', 1);
  v.cyl('y', 0, 0, 0, 14, 9, pot, 11); v.cyl('y', 0, 0, 13, 14, 10, M('#3a2a1c', 2)); v.cyl('y', 0, 0, 14, 110, 1.6, wood);
  for (let y = 30; y < 108; y += 13) v.ring(0, y, 0, 2.2, 0.6, brass);
  for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.4; v.tube(0, 96, 0, Math.cos(a) * 7, 101, Math.sin(a) * 7, 0.7, brass); }                 // the hooks are still on it
  for (let i = 0; i < 9; i++) { const a = i * 0.698, r1 = 30 + (i % 3) * 5, c = i % 2 ? g1 : g2;
    for (let t = 0; t <= 1.001; t += 0.05) { const x = Math.cos(a) * r1 * t, z = Math.sin(a) * r1 * t, y = 110 + 12 * t - 34 * t * t, wide = 5 * Math.sin(Math.PI * Math.min(1, t + 0.08)); v.box(Math.round(x - Math.sin(a) * wide), Math.round(y), Math.round(z - Math.cos(a) * wide), Math.round(x + Math.sin(a) * wide), Math.round(y), Math.round(z + Math.cos(a) * wide), c); } }
  return v;
}

/* ---- the orange drink ------------------------------------------------------------------------------------------ */

const PEEL = M('#f08a1e', 2);   // (one colour: the grain is the material's. A peel dimpled voxel by voxel is ten times the triangles)
/** An orange, r voxels: dimpled, a stalk and one leaf. Cut open (cut: true): the inside, which is the wrong colour. */
export function orangeVox(r = 8, cut = false) {
  return () => {
    const v = new Vox(); v.ellipsoid(0, r, 0, r, r * 0.94, r, PEEL); v.cyl('y', 0, 0, r * 1.9, r * 2.05, Math.max(1, r * 0.12), M('#3f7a3a', 2)); v.box(1, Math.round(r * 2), 0, Math.round(r * 0.6), Math.round(r * 2), Math.round(r * 0.25), M('#5f9a48', 2));
    if (cut) { v.carve(-r, r, 0, r, r * 3, r); v.ellipsoid(0, r, 0, r - 1.2, 0.6, r - 1.2, M('#f6ead0', 0)); for (let a = 0; a < 6.283; a += 0.785) v.tube(0, r, 0, Math.cos(a) * (r - 2), r, Math.sin(a) * (r - 2), 0.5, M('#3a70c9', 0)); v.ellipsoid(0, r, 0, 1.4, 0.7, 1.4, M('#1f2a55', 0)); }
    return v;
  };
}
/** What makes the drink: a glass tank of oranges going round, a spout, and what has come out of the spout over the years. */
export function juicerVox() {
  const v = new Vox(), steel = M('#b9bec4', 0), dark = M('#2a2f36', 0), glass = M('#f4b04a', 0), drink = M('#ff9a1e', 0);
  v.rbox(-9, 0, -8, 9, 9, 8, 2, steel); v.box(-9, 4, 8, 9, 6, 8, dark); v.cyl('y', 0, 0, 9, 34, 8, glass); v.cyl('y', 0, 0, 34, 37, 9, steel); v.cyl('y', 0, 0, 37, 39, 4, dark);
  for (let i = 0; i < 9; i++) { const a = i * 2.1, y = 12 + (i * 5) % 20; v.ellipsoid(Math.round(Math.cos(a) * 4.5), y, Math.round(Math.sin(a) * 4.5), 3, 3, 3, PEEL); }
  v.tube(0, 5, 8, 0, 3, 12, 1.2, steel); v.tube(0, 3, 12, 0, 0, 12, 0.8, drink); v.rbox(-5, -1, 9, 5, 0, 15, 1, M('#8f5a1a', 0));
  return v;
}
/** A paper cup with a lid and a straw, striped; and the same, full to the top of the straw. */
export function cupVox() { const v = new Vox(), w = M('#f6f1e2', 0), o = M('#f08a1e', 0); v.cyl('y', 0, 0, 0, 9, 2.6, (x, y) => (y % 3 === 1 ? o : w), 3.4); v.cyl('y', 0, 0, 9, 10, 3.7, w); v.tube(1, 10, 0, 2, 15, 0, 0.5, M('#d9433a', 0)); return v; }
/** A drift of oranges, as high as a desk: what a place that sells them would have a lot of. */
export function heapVox(n = 0) {
  return () => { const v = new Vox(); let k = (n + 3) * 2654435761 >>> 0; const r = () => { k = (Math.imul(k, 1664525) + 1013904223) >>> 0; return k / 4294967296; };
    for (let i = 0; i < 30; i++) { const a = r() * 6.283, d = r() * r() * 22, h = Math.max(0, 22 - d) * (0.5 + r() * 0.6); v.ellipsoid(Math.round(Math.cos(a) * d), Math.round(3 + h), Math.round(Math.sin(a) * d), 3.4, 3.2, 3.4, PEEL); }
    return v; };
}
/** A shoe. A left one. */
export function shoeVox(colour = '#3a2a1c') { return () => { const v = new Vox(), c = M(colour, 2); v.rbox(-2, 0, -5, 2, 2, 5, 1, M('#17171a', 0)); v.rbox(-2, 1, -5, 2, 4, 1, 2, c); v.rbox(-2, 1, 0, 2, 6, 5, 2, c); v.carve(-1, 4, 1, 1, 6, 4); v.box(-1, 4, -3, 1, 4, -1, M('#e9e4d6', 0)); return v; }; }

/* ---- the ways between: what every plain room of the shopping centre is --------------------------------------------- */

/** A box against a wall: from a to b along it, d0 to d1 out from it, y0 to y1 up. */
export function wallBox(c, side, a, b, y0, y1, d0, d1, rgb, batch = c.flat) {
  const p = c.wallAt(side, a, d0), q = c.wallAt(side, b, d1);
  batch.box(Math.min(p.x, q.x), y0, Math.min(p.z, q.z), Math.max(p.x, q.x), y1, Math.max(p.z, q.z), rgb);
}
/** A flat thing on a wall, from a to b along it, y0 to y1, `off` out from it, facing into the room. */
export function wallFace(c, side, a, b, y0, y1, batch, uv, off = 0.012, alb) { const p = c.wallAt(side, a, off), q = c.wallAt(side, b, off); upright(batch, p.x, p.z, q.x, q.z, y0, y1, uv, alb); }
const lowest = (c, side, a, b, off = 0.3) => Math.min(...[a, (a + b) / 2, b].map((t) => { const p = c.wallAt(side, t, off); return c.ceilAt(p.x, p.z); }));

/** A shopping trolley, nose toward +x: it nests in the one in front of it. */
export function trolleyVox() {
  const v = new Vox(), k = M('#9aa1a8', 0), red = M('#b3261e', 0), tyre = M('#17171a', 2);
  for (let x = -12; x <= 12; x += 3) { v.tube(x, 12, -8, x, 12, 8, 0.45, k); v.tube(x, 12, -8, x + (x > 0 ? 0 : 0), 26, -8, 0.45, k); v.tube(x, 12, 8, x, 26, 8, 0.45, k); }
  for (let y = 12; y <= 26; y += 4.5) { v.tube(-12, y, -8, 14, y, -8, 0.45, k); v.tube(-12, y, 8, 14, y, 8, 0.45, k); }
  for (let z = -8; z <= 8; z += 4) { v.tube(-12, 12, z, 14, 12, z, 0.45, k); v.tube(-12, 12, z, -12, 26, z, 0.45, k); }
  v.tube(-14, 28, -9, -14, 28, 9, 1.1, red); v.tube(-12, 26, -9, -14, 28, -9, 0.6, k); v.tube(-12, 26, 9, -14, 28, 9, 0.6, k);
  for (const [x, z] of [[-11, -7], [-11, 7], [12, -6], [12, 6]]) { v.tube(x, 12, z, x, 3, z, 0.6, k); v.cyl('z', x, 2, z - 1, z + 1, 2, tyre); }
  return v;
}
/** A bin, the round steel kind with a lid like a hat; `full`: with the small ones in it. */
export function binVox(full = false) {
  return () => { const v = new Vox(), s = M('#7d8288', 0), d = M('#4a4f55', 0);
    v.cyl('y', 0, 0, 0, 30, 9, s, 10); v.cyl('y', 0, 0, 30, 32, 11, d); v.carve(-8, 6, -8, 8, 32, 8); for (let y = 4; y < 30; y += 6) v.ring(0, y, 0, 9.6, 0.5, d);
    if (full) for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; v.cyl('y', Math.round(Math.cos(a) * 3.5), Math.round(Math.sin(a) * 3.5), 18 + i * 3, 36 + i * 4, 3.4, s, 3.8); }
    return v; };
}
/** A coin ride: something on a sprung foot, with a box for the coin. What it is depends on what they were told: an orange. */
function rideVox() {
  const v = new Vox(), base = M('#2a6fb3', 1), chrome = M('#c9ccd0', 0), seat = M('#b3261e', 1);
  v.rbox(-14, 0, -10, 14, 4, 10, 2, base, 'xz'); v.cyl('y', 0, 0, 4, 12, 2.4, chrome); for (let y = 5; y < 12; y += 2) v.ring(0, y, 0, 3.2, 0.6, chrome);
  v.ellipsoid(0, 22, 0, 12, 11, 11, M('#f08a1e', 2)); v.rbox(-6, 31, -6, 6, 34, 6, 2, seat, 'xz'); v.tube(-6, 34, 0, -9, 42, 0, 0.8, chrome); v.tube(-9, 42, -4, -9, 42, 4, 0.8, chrome);
  v.box(10, 0, -4, 16, 16, 4, M('#d9d2bf', 0)); v.box(16, 10, -1, 16, 12, 1, M('#1a1a1a', 0)); v.box(16, 13, -2, 16, 14, 2, glow('#ff3d9a'));
  return v;
}

const STREETS = ['shops', 'shops', 'shops', 'shutters', 'hoarding'], NEON_NAMES = [SHOPS.slice(0, 8), SHOPS.slice(8, 16), ['OPEN', 'CLOSED', 'OPEN CLOSED', 'SALE', 'ENDS', 'SALE ENDS', 'EVERYTHING', 'MUST'], ['YOU ARE HERE', 'YOU WERE HERE', 'THIS WAY', 'THAT WAY', 'EXIT', 'ALSO EXIT', 'MORE SHOPS', 'NO MORE SHOPS']];
/**
 * The shopping centre's way of finishing a plain room (rooms.js plain(), last). A street of units along the walls: fronts with
 * a pilaster between, a fascia over each with its name in tube, a kick plate; or all of them shuttered; or all hoarding. A
 * passage too narrow for a shop is a service corridor: painted block, pipes along the top, a number, STAFF ONLY. Some of
 * the light comes from the signs. And in some bare rooms, one thing whoever built this got wrong (MALL_WRONG, below).
 */
export function concourse(c, opt = {}) {
  const { W, D, R, room, kit } = c;
  if (room.crawl) return;
  const narrow = Math.min(W, D) < 3.3 && room.kind === 'plain', street = opt.street || (narrow ? (R.chance(0.55) ? 'service' : 'shutters') : R.pick(STREETS));
  c.rt.street = street;
  const art = mallFronts(kit), fronts = c.mapped('mall:fronts', art.texture), v = R.int(0, NEON_NAMES.length - 1), neon = mallNeon(kit, 'plain:' + v, NEON_NAMES[v], v + 1), lit = c.shining('mall:neon:plain:' + v, neon.texture, 2.3);
  const glows = [];
  if (street === 'service') {
    // painted block: cream to the roof, and a band of green up to the dado
    const blockOf = (key, a, b) => c.mapped(key, kit.tex.custom(key, 64, 32, (g, w, h) => { P(g, a, 0, 0, w, h); for (let y = 0; y < h; y += 8) { P(g, b, 0, y, w, 1); for (let x = ((y >> 3) & 1) * 16; x < w; x += 32) P(g, b, x, y, 1, 8); } for (let i = 0; i < 18; i++) P(g, 'rgba(60,50,30,0.14)', (i * 37) % w, (i * 19) % h, 1, 2 + (i % 4)); }));
    const block = blockOf('mall:block', '#c9c3b0', '#b3ad9a'), dado = blockOf('mall:dado', '#3f6b4f', '#355c43');
    const stencil = c.mapped('mall:stencil:' + (room.id % 5), kit.tex.custom('mall:stencil:' + (room.id % 5), 64, 32, (g, w, h) => { g.clearRect(0, 0, w, h); garble(g, ['UNIT 14', 'STAFF ONLY', 'NO ENTRY', 'BINS', 'UNIT 14B'][room.id % 5], 0, 0, w, h, { color: '#1c1a17', mess: 0.25 }, room.id); }, { clamp: true }), { cutout: true });
    for (const side of ['back', 'front', 'left', 'right']) for (const [a, b] of c.spans(side, 0.02, 1.2)) {
      const top = lowest(c, side, a, b, 0.05); wallFace(c, side, a, b, 1.0, top, block, [0, 0, (b - a) / 1.6, (top - 1.0) / 0.8], 0.008); wallFace(c, side, a, b, 0, 1.0, dado, [0, 0, (b - a) / 1.6, 1.0 / 0.8], 0.008); wallBox(c, side, a, b, 0.98, 1.03, 0, 0.02, [0.16, 0.22, 0.18]);
      if (b - a > 1.6 && R.chance(0.6)) { const m = R.range(a + 0.6, b - 0.6); wallFace(c, side, m - 0.5, m + 0.5, 1.35, 1.85, stencil, [0, 0, 1, 1], 0.012); }
      if (side === 'back' || side === 'left') { for (const [y, r, rgb] of [[top - 0.22, 0.05, [0.42, 0.44, 0.46]], [top - 0.36, 0.035, [0.7, 0.25, 0.18]], [top - 0.46, 0.03, [0.85, 0.82, 0.72]]]) wallBox(c, side, a, b, y - r, y + r, 0.03, 0.03 + r * 2, rgb); }
    }
    if (R.chance(0.5)) { const ws = c.wallSpot(0.8, ['back', 'front', 'left', 'right'], 0.3, 2); if (ws) { const p = c.wallAt(ws.side, ws.at, 0.35); c.model('mall:bin:0', binVox(false), p.x, p.z, { scale: 1.6, solid: false }); c.solid(p.x - 0.3, p.z - 0.3, p.x + 0.3, p.z + 0.3, { tall: false }); } }
    return;
  }
  // a street: units along each run of wall
  const kinds = street === 'shutters' ? ['shutter', 'shutter', 'half', 'shutter', 'blinds'] : street === 'hoarding' ? ['hoarding'] : ['office', 'window', 'blinds', 'half', 'door', 'office', 'window', 'shutter', 'open'];
  let n = 0;
  for (const side of ['back', 'front', 'left', 'right']) for (const [a, b] of c.spans(side, 0.1, 2.0)) {
    const len = b - a; if (len < 0.9) continue;
    const bays = Math.max(1, Math.round(len / R.pick([2.2, 2.6, 3.0]))), bw = len / bays;
    for (let i = 0; i < bays; i++, n++) {
      const x0 = a + i * bw, x1 = x0 + bw, top = lowest(c, side, x0, x1), face = Math.min(2.45, top - 0.62), kind = R.pick(kinds);
      if (face < 1.4) continue;
      wallFace(c, side, x0 + 0.07, x1 - 0.07, 0, face, fronts, art.uv(kind), 0.06);
      wallBox(c, side, x0 + 0.04, x1 - 0.04, face, face + 0.5, 0, 0.2, [0.13, 0.12, 0.15]);                                                   // the fascia, and the name on it
      wallFace(c, side, x0 + 0.12, x1 - 0.12, face + 0.04, face + 0.46, lit, neon.uv((n + room.id) % 8), 0.205);
      wallBox(c, side, x0 - 0.06, x0 + 0.07, 0, face + 0.5, 0, 0.15, [0.66, 0.52, 0.2]);                                                     // pilasters, brass, either side
      if (i === bays - 1) wallBox(c, side, x1 - 0.07, x1 + 0.06, 0, face + 0.5, 0, 0.15, [0.66, 0.52, 0.2]);
      wallBox(c, side, x0 + 0.07, x1 - 0.07, 0, 0.12, 0.05, 0.09, [0.3, 0.26, 0.22]);                                                          // kick plate
      if (street !== 'shutters' || R.chance(0.3)) glows.push({ side, at: (x0 + x1) / 2, y: face + 0.25, col: neon.colour((n + room.id) % 8) });
    }
  }
  for (const g of R.shuffle(glows).slice(0, street === 'shutters' ? 1 : 3)) { const p = c.wallAt(g.side, g.at, 0.7); c.light(p.x, g.y, p.z, g.col, 0.85, { k: 1.4, far: 4.5 }); }
  // and in some bare rooms, the one thing got wrong
  const chance = opt.wrong ?? (!room.shape && room.kind === 'plain' && Math.min(W, D) >= 3.4 ? (room.quiet ? 0.3 : 0.5) : 0);
  const which = opt.which;
  if ((chance > 0 && R.chance(chance)) || which) { const name = which || R.pick(Object.keys(MALL_WRONG)); if (MALL_WRONG[name](c) !== false) c.rt.weird = name; }
}

/** What whoever built the shopping centre got wrong, one to a room, in rooms with nothing else in them. Each returns false if it could not. */
export const MALL_WRONG = {
  // every left shoe, put in the one corner
  shoes(c) { const k = c.corner(1.0); if (!k) return false; const R = c.R, cols = ['#3a2a1c', '#17171a', '#7a3a34', '#c9b08a', '#2a4a6a'];
    for (const [n, r, y] of [[16, 0.85, 0], [10, 0.55, 0.1], [6, 0.3, 0.2], [2, 0.1, 0.3]]) for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + R.range(-0.3, 0.3); c.model('mall:shoe:' + (i % 5), shoeVox(cols[i % 5]), k.x + Math.cos(a) * r * R.range(0.5, 1), k.z + Math.sin(a) * r * R.range(0.5, 1), { y: y + R.range(0, 0.05), scale: 1.4, rot: R.range(0, 6.28), tilt: [R.range(-0.6, 0.6), R.range(-0.6, 0.6)], solid: false, shadow: false }); }
    c.solid(k.x - 0.8, k.z - 0.8, k.x + 0.8, k.z + 0.8, { tall: false }); c.shadow(k.x, k.z, 2, 2, 0.35); },
  // trolleys, nested, going into the wall: the last of them is mostly in it
  trolleys(c) { const ws = c.wallSpot(3.4, undefined, 0.6, 1.4); if (!ws) return false; const R = c.R;
    for (let d = 0.4; d <= 3.3; d += 0.45) { const q = c.wallAt(ws.side, ws.at, d); if (!c.clear(q.x, q.z, 0.5)) return false; }                  // (nowhere a doorway is walked into)
    for (let i = 0; i < 5; i++) { const p = c.wallAt(ws.side, ws.at, 2.9 - i * 0.62), rot = Math.atan2(-p.n[0], -p.n[2]) - Math.PI / 2; c.model('mall:trolley', trolleyVox, p.x, p.z, { rot: rot + R.range(-0.04, 0.04), solid: false }); }
    const a = c.wallAt(ws.side, ws.at - 0.4, 0), b = c.wallAt(ws.side, ws.at + 0.4, 3.3); c.solid(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), { tall: false }); },
  // a family, stood round a bin, facing in
  family(c) { const at = c.spot(1.1, { pad: 0.8 }); if (!at) return false; const dress = ['#39424f', '#7a3a34', '#4a5a40', '#6a4a8a'];
    c.model('mall:bin:0', binVox(false), at.x, at.z, { scale: 1.5, solid: false });
    for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.3, x = at.x + Math.cos(a) * 0.75, z = at.z + Math.sin(a) * 0.75; c.model('atrium:dummy:' + i + (i === 2 ? ':o' : ''), dummyVox(i, dress[i], i === 2 ? 'orange' : null), x, z, { rot: Math.atan2(at.x - x, at.z - z), scale: i === 3 ? 0.65 : 1, solid: false }); }
    c.solid(at.x - 1, at.z - 1, at.x + 1, at.z + 1, { tall: false }); },
  // a ride for a coin, facing the wall, going; nobody on it
  ride(c) { const ws = c.wallSpot(1.4, undefined, 0.5, 1.6); if (!ws) return false; const p = c.wallAt(ws.side, ws.at, 0.7), env = c.env, kit = c.kit;
    const b = new Batch(true); b.addVox(kit.model('mall:ride', rideVox).solid, new THREE.Matrix4().makeScale(kit.VOXEL, kit.VOXEL, kit.VOXEL));
    const mat = kit.surface({ vox: true }), mesh = new THREE.Mesh(kit.geometry(b, [lamp(0.4, 2.4, 1.2, [1.2, 1.2, 1.2], { k: 9, wrap: 0.45, far: 30 })], [0.6, 0.6, 0.6]), mat), g = new THREE.Group(); g.add(mesh);
    g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(-p.n[0], -p.n[2]) + Math.PI / 2; g.userData.light = (rgb) => mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); c.add(g);
    c.solid(p.x - 0.5, p.z - 0.5, p.x + 0.5, p.z + 0.5, { tall: false }); c.light(p.x, 0.6, p.z, '#ff3d9a', 0.5, { k: 1.6, far: 3 });
    let t0 = c.R.range(0, 5); c.tick((dt, t, me) => { t0 += dt; mesh.rotation.x = Math.sin(t0 * 5.3) * 0.12; mesh.rotation.z = Math.sin(t0 * 3.1) * 0.08; if (me.inside && Math.random() < dt * 0.4) { const w = c.toWorld(p.x, p.z); env.play?.('click', w.x, w.z, 4); } }); },
  // the handrail of a moving stair, and nothing under it: out of the floor, over, into the floor
  rail(c) { const at = c.spot(1.4, { pad: 0.6 }); if (!at) return false; const R = c.R, along = c.W > c.D, L = 2.6, hgt = Math.min(2.0, c.ceilAt(at.x, at.z) - 0.4), tube = c.shining('mall:rail', c.kit.tex.white(), 2.1, [0.2, 0.88, 1]);
    for (let i = 0; i < 24; i++) { const t0 = i / 24, t1 = (i + 1) / 24, s0 = -L / 2 + L * t0, s1 = -L / 2 + L * t1, y0 = Math.sin(Math.PI * t0) * hgt, y1 = Math.sin(Math.PI * t1) * hgt;
      for (const off of [-0.45, 0.45]) { const [x0, z0, x1, z1] = along ? [at.x + s0, at.z + off, at.x + s1, at.z + off] : [at.x + off, at.z + s0, at.x + off, at.z + s1]; c.flat.box(Math.min(x0, x1) - 0.04, Math.min(y0, y1) - 0.05, Math.min(z0, z1) - 0.04, Math.max(x0, x1) + 0.04, Math.max(y0, y1), Math.max(z0, z1) + 0.04, [0.06, 0.06, 0.07]); tube.box(Math.min(x0, x1) - 0.02, Math.max(y0, y1), Math.min(z0, z1) - 0.02, Math.max(x0, x1) + 0.02, Math.max(y0, y1) + 0.03, Math.max(z0, z1) + 0.02, [1, 1, 1]); } }
    for (const s of [-1, 1]) { const x = along ? at.x + s * L / 2 : at.x, z = along ? at.z : at.z + s * L / 2; c.blot(x, z, along ? 0.4 : 1.2, along ? 1.2 : 0.4, { a: 0.5 }); }
    c.light(at.x, 1.2, at.z, '#35e0ff', 0.6, { k: 1.4, far: 3.5 }); void R; },
  // a queue: posts and belts, folded back on itself four times, round nothing; and at the head of it, nothing
  queue(c) { const at = c.spot(1.5, { pad: 0.4 }); if (!at) return false; const belt = [0.12, 0.14, 0.4], post = [0.7, 0.72, 0.75];
    const rows = 4, w = 2.4, gap = 0.75, x0 = at.x - w / 2, z0 = at.z - (rows - 1) * gap / 2;
    for (let r = 0; r < rows; r++) { const z = z0 + r * gap; for (let k = 0; k <= 3; k++) { const x = x0 + k * (w / 3); c.flat.box(x - 0.03, 0, z - 0.03, x + 0.03, 0.95, z + 0.03, post); c.flat.box(x - 0.08, 0, z - 0.08, x + 0.08, 0.03, z + 0.08, post); }
      c.flat.box(x0 + (r % 2 ? 0 : 0.4), 0.86, z - 0.012, x0 + w - (r % 2 ? 0.4 : 0), 0.9, z + 0.012, belt); c.solid(x0 + (r % 2 ? 0 : 0.4), z - 0.05, x0 + w - (r % 2 ? 0.4 : 0), z + 0.05, { tall: false }); }
    const head = z0 + rows * gap - 0.2, sign = c.shining('mall:queue', c.kit.tex.custom('mall:queue', 64, 32, (g, ww, hh) => { P(g, '#f1ead6', 0, 0, ww, hh); P(g, '#b3261e', 0, 0, ww, 6); garble(g, 'PLEASE WAIT', 2, 8, ww - 4, 11, { color: '#1c1812', mess: 0.2 }, 3); garble(g, 'HERE', 2, 19, ww - 4, 11, { color: '#1c1812', mess: 0.4 }, 5); }), 1.3);
    c.flat.box(x0 - 0.03, 0, head - 0.03, x0 + 0.03, 1.25, head + 0.03, post); upright(sign, x0 - 0.3, head, x0 + 0.3, head, 1.25, 1.55, [0, 0, 1, 1]); upright(sign, x0 + 0.3, head, x0 - 0.3, head, 1.25, 1.55, [0, 0, 1, 1]); },
  // a bin, and in it, bins
  bins(c) { const k = c.corner(0.7); if (!k) return false; c.model('mall:bin:full', binVox(true), k.x, k.z, { scale: 2.2, solid: false }); c.model('mall:bin:0', binVox(false), k.x - k.sx * 0.9, k.z, { scale: 1.2, rot: 0.4, tilt: [0, 1.5], solid: false }); c.solid(k.x - 0.55, k.z - 0.55, k.x + 0.55, k.z + 0.55, { tall: false }); },
  // a shop, stood out in the room: front, fascia, name lit; it is as deep as the board it is painted on
  shallow(c) { const at = c.spot(1.6, { pad: 0.7 }); if (!at) return false; const art = mallFronts(c.kit), fronts = c.mapped('mall:fronts', art.texture), neon = mallNeon(c.kit, 'plain:0', NEON_NAMES[0], 1), lit = c.shining('mall:neon:plain:0', neon.texture, 2.3), w = 1.25, top = Math.min(2.3, c.ceilAt(at.x, at.z) - 0.6), ply = [0.6, 0.48, 0.34];
    upright(fronts, at.x - w, at.z, at.x + w, at.z, 0, top, art.uv('open')); upright(c.flat, at.x + w, at.z - 0.06, at.x - w, at.z - 0.06, 0, top + 0.5, null, ply); c.flat.box(at.x - w, top, at.z - 0.06, at.x + w, top + 0.5, at.z + 0.02, [0.13, 0.12, 0.15]);
    upright(lit, at.x - w + 0.1, at.z + 0.03, at.x + w - 0.1, at.z + 0.03, top + 0.05, top + 0.45, neon.uv(2)); for (const s of [-1, 1]) c.flat.box(at.x + s * w - 0.05, 0, at.z - 0.5, at.x + s * w + 0.05, 0.06, at.z - 0.06, ply);
    c.solid(at.x - w, at.z - 0.08, at.x + w, at.z + 0.04, { tall: true }); c.light(at.x, 1.4, at.z + 0.8, '#ffe9a8', 0.6, { k: 1.4, far: 3.5 }); },
};
