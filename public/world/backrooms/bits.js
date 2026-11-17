// The Backrooms — bits and pieces several rooms share: picture frames, cards
// with words on, door leaves, wet-floor signs, standees that turn to look at
// you, loose paper.
import * as THREE from 'three';
import { Vox, M } from '../vox/vox.js';
import { lin, drawText, WHITE } from './kit.js';
import { makeCutout } from './cutout.js';
import { WETSIGN, boardVox, frameVox } from './wetsign.model.js';
import { WOODDOOR, woodDoorVox, doorSize } from './wooddoor.model.js';

export const P = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const turnTo = (from, to) => { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

/** A slab of wood behind a picture: reads as a frame. */
export function framed(c, batch, side, at, y, w, h, uv, wood = [0.2, 0.12, 0.06], alb = WHITE) {
  const t = 0.04;
  c.wbox(side, at, w + t * 2, y - h / 2 - t, y + h / 2 + t, 0, 0.024, wood);
  return c.hang(batch, side, at, y, w, h, uv, alb, 0.028);
}
/** A texture with a few lines of text on a coloured card. */
export function card(c, key, lines, o = {}) {
  const w = o.w || 128, h = o.h || 48;
  return c.kit.tex.custom('card:' + key, w, h, (g) => {
    P(g, o.bg || '#f1ecdc', 0, 0, w, h);
    if (o.edge) { P(g, o.edge, 0, 0, w, 2); P(g, o.edge, 0, h - 2, w, 2); P(g, o.edge, 0, 0, 2, h); P(g, o.edge, w - 2, 0, 2, h); }
    drawText(g, lines, 0, 0, w, h, { color: o.fg || '#1c1812', size: o.size, pad: o.pad ?? 10, weight: o.weight });
  }, { clamp: true });
}
/** Loose sheets of paper around a spot, kept inside the room. */
export function scatter(c, x, z, n, spread = 1.2, color) {
  for (let i = 0; i < n; i++) c.paper(clamp(x + c.R.range(-spread, spread), -c.W / 2 + 0.25, c.W / 2 - 0.25), clamp(z + c.R.range(-spread, spread), -c.D / 2 + 0.25, c.D / 2 - 0.25), undefined, color);
}
/** A colour as the kit keeps it (linear, 0…1) back to the '#rrggbb' a model is sculpted in. */
const hexOf = (rgb) => '#' + rgb.map((v) => Math.round(255 * Math.max(0, Math.min(1, v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055))).toString(16).padStart(2, '0')).join('');
/**
 * The sculpted wooden door (wooddoor.model.js) put into a voxel batch, anywhere and any way up: `foot` is the middle of
 * its bottom edge at its back, and `across`, `up` and `out` are the three ways it runs from there (unit [x, y, z]).
 * w, h and t: how wide, tall and thick it is to be, metres. flip: the lever on the other side.
 */
export function woodLeaf(c, batch, foot, across, up, out, w, h, t, rgb, flip = false) {
  const colour = hexOf(rgb), { W, H } = doorSize(w, h), model = c.kit.model(`wooddoor:${colour}:${W}x${H}`, () => woodDoorVox({ w, h, colour }), { ao: false });
  const sx = (w / W) * (flip ? -1 : 1), sy = h / H, sz = t / WOODDOOR.thick, m = new THREE.Matrix4();
  m.set(across[0] * sx, up[0] * sy, out[0] * sz, foot[0],
    across[1] * sx, up[1] * sy, out[1] * sz, foot[1],
    across[2] * sx, up[2] * sy, out[2] * sz, foot[2],
    0, 0, 0, 1);
  batch.addVox(model.solid, m);
}
/**
 * A wooden door leaf flat against a wall (or into `batch`, to swing later: a voxel batch, `new Batch(true)`).
 * → the handle's wall coordinate. o.k: how thick it all is (1: a door; a door made smaller is thinner too).
 * (Given a flat batch it still makes the old leaf of boxes, for whoever has not been told.)
 */
export function doorLeaf(c, side, at, w, h, rgb, o = {}) {
  const batch = o.batch, k = o.k ?? 1, d0 = o.d0 ?? 0.012, hx = (o.hinge === 'right' ? -1 : 1) * (w / 2 - w * 0.09);
  if (batch && !batch.vox) return boxLeaf(c, side, at, w, h, rgb, o);
  const p = c.wallAt(side, at, d0), y0 = o.y0 ?? 0.02;
  woodLeaf(c, batch || c.vox, [p.x, y0, p.z], [p.U[0], 0, p.U[2]], [0, 1, 0], [p.n[0], 0, p.n[2]], w, h - y0, 0.04 * k, rgb, o.hinge === 'right');
  return hx;
}
function boxLeaf(c, side, at, w, h, rgb, o = {}) {
  const batch = o.batch, k = o.k ?? 1, d0 = o.d0 ?? 0.012, d1 = d0 + 0.04 * k, dark = rgb.map((v) => v * 0.72), lite = rgb.map((v) => Math.min(1, v * 1.18));
  c.wbox(side, at, w, o.y0 ?? 0.02, h, d0, d1, rgb, { batch });
  const pw = w * 0.34, gap = w * 0.08;
  for (const px of [-pw / 2 - gap / 2, pw / 2 + gap / 2]) for (const [y0, y1] of [[h * 0.09, h * 0.42], [h * 0.48, h * 0.9]]) {
    c.wbox(side, at + px, pw, y0, y1, d1, d1 + 0.006 * k, dark, { batch });
    c.wbox(side, at + px, pw - 0.07 * (w / 0.9), y0 + 0.035 * (h / 2), y1 - 0.035 * (h / 2), d1 + 0.006 * k, d1 + 0.011 * k, lite, { batch });
  }
  const hx = (o.hinge === 'right' ? -1 : 1) * (w / 2 - w * 0.09), hy = o.handleY ?? h * 0.47;
  c.wbox(side, at + hx, w * 0.05, hy - 0.012 * (h / 2), hy + 0.012 * (h / 2), d1, d1 + 0.05 * k, [0.72, 0.68, 0.55], { batch });
  c.wbox(side, at + hx - Math.sign(hx) * w * 0.06, w * 0.15, hy - 0.012 * (h / 2), hy + 0.012 * (h / 2), d1 + 0.035 * k, d1 + 0.05 * k, [0.78, 0.74, 0.6], { batch });
  return hx;
}
/** A cream frame around a doorway-sized hole; t is how wide its timber is. */
export function doorFrame(c, side, at, w, h, rgb = lin('#e2d8bd'), depth = 0.05, t = 0.07) {
  c.wbox(side, at - w / 2 - t / 2, t, 0, h + t, 0, depth, rgb);
  c.wbox(side, at + w / 2 + t / 2, t, 0, h + t, 0, depth, rgb);
  c.wbox(side, at, w, h, h + t, 0, depth, rgb);
}
/** A yellow A-frame sign. texts: two lines. */
export function wetSign(c, x, z, rot, lines, fallen = false) {
  const tex = card(c, 'wet' + lines.join('|'), lines, { w: 48, h: 80, bg: '#f2c318', fg: '#201a08', edge: '#c79a0c', size: 11, pad: 6 });
  const { w, h, spread, top, rim, scale } = WETSIGN, batch = c.mapped('wet' + lines.join('|'), tex), lean = Math.atan2(spread - top, h);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const pt = (lx, y, lz) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs];
  const board = (model, at, turn, tilt, y = 0) => c.place(model, at[0], at[2], { rot: turn, tilt: [tilt, 0], y, scale, solid: false, shadow: false });
  const boards = c.kit.model('wetsign:board', boardVox, { ao: false });
  if (fallen) {
    // folded flat where it went over, and the other half of another a step away: the boards lying, the words up
    for (const [ox, oz, turn, up] of [[0, 0, rot, 0.026], [sn * 0.34, cs * 0.34, rot + 2.6, 0.03]]) {
      const c2 = Math.cos(turn), s2 = Math.sin(turn);
      board(boards, [x + ox + s2 * h / 2, 0, z + oz + c2 * h / 2], turn, -Math.PI / 2, up);
      c.lay(batch, x + ox, z + oz, w - rim * 2, h - rim * 3, turn, null, WHITE, up + 0.004);
    }
    return;
  }
  // the two boards are sculpted (wetsign.model.js); what they say is laid in the well of each, a hair proud
  board(boards, pt(0, 0, spread), rot, -lean); board(boards, pt(0, 0, -spread), rot + Math.PI, -lean);
  board(c.kit.model('wetsign:frame', frameVox, { ao: false }), pt(0, 0, 0), rot, 0);
  const on = (t) => spread + (top - spread) * t + 0.004, y0 = 0.08, y1 = h - rim * 3.4, hw = w / 2 - rim;
  batch.quad(pt(-hw, y0, on(y0 / h)), pt(hw, y0, on(y0 / h)), pt(hw, y1, on(y1 / h)), pt(-hw, y1, on(y1 / h)));
  batch.quad(pt(hw, y0, -on(y0 / h)), pt(-hw, y0, -on(y0 / h)), pt(-hw, y1, -on(y1 / h)), pt(hw, y1, -on(y1 / h)));
  c.shadow(x, z, 0.3, 0.3, 0.4);
}
/** A standee that turns to face you whenever you are not looking. → { group, x, z } */
export function standee(c, key, look, x, z, rot, o = {}) {
  const g = makeCutout(c.kit, key, look, { creations: c.env.who.creations, ...o });
  g.position.set(x, o.y || 0, z); g.rotation.y = rot;
  if (o.blank) g.children[0].material = g.children[1].material;             // unprinted: cardboard on both sides
  c.add(g);
  const k = { g, x, z, rot, unseen: 0 };
  c.after.push(() => g.userData.light(c.sample(x, 1.0, z)));
  if (o.watch !== false) {
    let wait = 0;
    c.tick((dt, t, me) => {
      wait += dt; if (wait < 0.25) return; wait = 0;
      if (c.seen(k.x, k.z, { radius: 0.5 })) return;
      const want = Math.atan2(me.x - k.x, me.z - k.z);
      if (Math.abs(turnTo(k.rot, want)) > 0.12) { k.rot = want; g.rotation.y = want; }
    });
  }
  return k;
}
export const mugVox = (color = '#cf6b4b') => () => { const v = new Vox(); v.cyl('y', 0, 0, 0, 5, 2.4, M(color, 0)); v.carve(-1, 1, -1, 1, 5, 1); v.box(-1, 4, -1, 1, 5, 1, M('#3a2416', 0)); v.box(3, 1, 0, 4, 4, 1, M(color, 0)); v.carve(3, 2, 0, 4, 3, 1); v.box(4, 1, 0, 5, 4, 1, M(color, 0)); return v; };
/**
 * An evacuation plan of this very floor, the right way round for whoever reads it. Mostly accurate.
 * where: { side, at } (default: any free wall) · scribble(g, mx, my): draw on it — mx, my turn a spot of the floor into a spot on the sheet.
 */
export function floorPlan(c, where = null, scribble = null) {
  const w = where || c.wallSpot(1.3); if (!w) return;
  const p0 = c.wallAt(w.side, w.at, 0), lv = c.level, me = c.room;
  let far = 6;
  for (const r of lv.rooms) far = Math.max(far, Math.abs(r.x - me.cx), Math.abs(r.x + r.w - me.cx), Math.abs(r.z - me.cz), Math.abs(r.z + r.d - me.cz));
  const S = 150, k = (S / 2 - 6) / far;
  // map-right is the way the wall runs, map-up is the way you face when reading it
  const mx = (x, z) => S / 2 + ((x - me.cx) * p0.U[0] + (z - me.cz) * p0.U[2]) * k, my = (x, z) => S / 2 + 12 + ((x - me.cx) * p0.n[0] + (z - me.cz) * p0.n[2]) * k;
  const tex = c.kit.tex.custom('plan' + me.id, S, S + 24, (g) => {
    P(g, '#f3efe2', 0, 0, S, S + 24); P(g, '#b5483f', 0, 0, S, 12);
    drawText(g, ['EVACUATION PLAN'], 0, 0, S, 12, { color: '#fff7e6', size: 9 });
    const box = (r, fill) => { const xs = [mx(r.x, r.z), mx(r.x + r.w, r.z + r.d)], ys = [my(r.x, r.z), my(r.x + r.w, r.z + r.d)]; const x = Math.min(...xs), y = Math.min(...ys), bw = Math.abs(xs[1] - xs[0]), bh = Math.abs(ys[1] - ys[0]); P(g, '#4a4436', x, y, bw, bh); P(g, fill, x + 1, y + 1, bw - 2, bh - 2); };
    for (const r of lv.rooms) box(r, r.kind === 'exit' ? '#7fd08f' : r.id === me.id ? '#f6d9a8' : r.kind === 'special' ? '#dcd6c4' : '#ffffff');
    for (const l of lv.links) { const a = l.axis === 'x' ? [l.at, l.from, l.at, l.to] : [l.from, l.at, l.to, l.at]; const x0 = mx(a[0], a[1]), y0 = my(a[0], a[1]), x1 = mx(a[2], a[3]), y1 = my(a[2], a[3]); P(g, '#ffffff', Math.min(x0, x1) - 1, Math.min(y0, y1) - 1, Math.abs(x1 - x0) + 2, Math.abs(y1 - y0) + 2); }
    const ex = lv.rooms[lv.exit.room];
    g.fillStyle = '#1f7a3e'; g.font = '700 7px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.fillText('EXIT', mx(ex.cx, ex.cz), my(ex.cx, ex.cz) + 3);
    g.fillStyle = '#d8281c'; g.beginPath(); g.arc(mx(me.cx, me.cz), my(me.cx, me.cz), 3, 0, 7); g.fill();
    drawText(g, ['● YOU ARE HERE (PROBABLY)'], 0, S + 12, S, 12, { color: '#3a3428', size: 7 });
    scribble?.(g, mx, my);                                  // whatever somebody has added to it since, in pen
  }, { clamp: true });
  framed(c, c.mapped('plan' + me.id, tex), w.side, w.at, 1.25, 0.84, 0.84 * (S + 24) / S, null, [0.55, 0.55, 0.5]);
}

