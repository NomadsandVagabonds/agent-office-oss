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
import { Vox, M } from '../vox/vox.js';
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
  return { texture, uv: (kind) => { const i = Math.max(0, FRONTS.indexOf(kind)); const c = CELL * FINE; return [((i % 4) * c + 1) / FW, ((i >> 2) * c + 1) / FH, ((i % 4) * c + c - 1) / FW, ((i >> 2) * c + c - 1) / FH]; } };
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
  return { texture, uv: (i) => [0.5 / SIGN_W, (i * SROW + 0.5) / SIGN_H, 1 - 0.5 / SIGN_W, (i * SROW + SROW - 0.5) / SIGN_H] };
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
  return { texture, uv: (i) => [1 / W, (i * ROW + 1) / H, 1 - 1 / W, (i * ROW + ROW - 1) / H], colour: (i) => TUBES[(i + seed) % TUBES.length] };
}
export const tube = (i) => TUBES[((i % TUBES.length) + TUBES.length) % TUBES.length];

/** A shop's dummy, as described: the right number of everything, joined by somebody who had not seen one move. pose: 0…3. */
export function dummyVox(pose = 0, dress = '#39424f') {
  return () => {
    const v = new Vox(), skin = M('#d8cbb4', 0), seam = M('#b3a68e', 0), cloth = M(dress, 2), base = M('#8d949c', 0);
    v.cyl('y', 0, 0, 0, 1, 8, base); v.cyl('y', 0, 0, 1, 34, 0.8, base);                                         // the stand it is on, up its back
    v.rbox(-5, 34, -3, 5, 54, 3, 2, cloth); v.rbox(-4, 30, -3, 4, 36, 3, 2, cloth); v.box(-5, 44, -3, 5, 44, 3, seam);
    for (const sx of [-1, 1]) { v.tube(sx * 2.5, 30, 0, sx * 3, 16, pose === 2 ? 3 : 0, 1.7, cloth); v.tube(sx * 3, 16, pose === 2 ? 3 : 0, sx * 3, 2, 0, 1.5, skin); v.rbox(sx * 3 - 2, 0, -2, sx * 3 + 2, 2, 5, 1, skin); }
    v.cyl('y', 0, 0, 54, 57, 1.6, skin); v.ellipsoid(0, 62, 0, 4.2, 5.2, 4.6, skin); v.box(-4, 62, -5, 4, 62, 5, seam);       // a head, with the join round it and nothing on it
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
