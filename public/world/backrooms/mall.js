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
import { garble, upright } from './suburb.js';

const FW = 512, FH = 256, CELL = 128, SIGN_W = 256, SIGN_H = 256, SROW = 32;
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
/** The fronts, one sheet: uv of a kind of front, the right way up for upright(). */
export function mallFronts(kit) {
  const texture = kit.tex.custom('mall:fronts', FW, FH, (g) => { FRONTS.forEach((k, i) => { g.save(); g.translate((i % 4) * CELL, (i >> 2) * CELL); g.beginPath(); g.rect(0, 0, CELL, CELL); g.clip(); frontOf(g, k, i); g.restore(); }); });
  return { texture, uv: (kind) => { const i = Math.max(0, FRONTS.indexOf(kind)); return [((i % 4) * CELL + 0.5) / FW, ((i >> 2) * CELL + 0.5) / FH, ((i % 4) * CELL + CELL - 0.5) / FW, ((i >> 2) * CELL + CELL - 0.5) / FH]; } };
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
  const { H } = c, deep = opt.deep ?? 40, brink = opt.brink ?? 0.25, falls = opt.falls ?? 1.7, env = c.env;
  let fall = null;
  c.rt.floorY = (x, z) => (fall ? fall.y : inHole(x, z) ? -deep : 0);
  c.rt.headY = (x, z) => H - c.rt.floorY(x, z);
  const open = (x, z) => { const q = c.toWorld(x, z); return env.world.floorY(q.x, q.z) < -1; };
  c.tick((dt, t, me) => {
    if (fall) {
      fall.t += dt; fall.y = Math.max(-80, -0.5 * 9.8 * fall.t * fall.t);
      const q = c.toWorld(fall.x, fall.z); env.player?.warp?.(q.x, q.z);
      const eye = env.player?.me; if (eye) eye.pitch = Math.min(0.95, eye.pitch + dt * 1.3);
      env.red?.(Math.min(0.9, fall.t * 0.5)); env.interfere?.(0.3 + 0.5 * Math.min(1, fall.t / falls));
      if (fall.t >= falls && !fall.over) { fall.over = true; env.hold?.(false); env.end?.('caught'); if (env.difficulty?.() === 'tourist') fall = null; }
      return;
    }
    if (!me.inside || env.player?.me?.frozen) return;
    for (let a = 0; a < 8; a++) if (open(me.x + Math.sin(a * 0.7854) * brink, me.z + Math.cos(a * 0.7854) * brink)) {
      fall = { x: me.x, z: me.z, y: 0, t: 0 }; env.hold?.(true); env.run?.met?.(c.room.arch);
      const q = c.toWorld(me.x, me.z); env.play?.('rattle', q.x, q.z, 6); return;
    }
  });
}
