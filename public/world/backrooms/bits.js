// The Backrooms — bits and pieces several rooms share: picture frames, cards
// with words on, door leaves, wet-floor signs, standees that turn to look at
// you, loose paper.
import { Vox, M } from '../vox/vox.js';
import { lin, drawText, WHITE } from './kit.js';
import { makeCutout } from './cutout.js';

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
/** A door leaf made of boxes, flat against a wall (or into `batch`, to swing later). → the handle's wall coordinate. */
export function doorLeaf(c, side, at, w, h, rgb, o = {}) {
  const batch = o.batch, d0 = o.d0 ?? 0.012, d1 = d0 + 0.04, dark = rgb.map((v) => v * 0.72), lite = rgb.map((v) => Math.min(1, v * 1.18));
  c.wbox(side, at, w, o.y0 ?? 0.02, h, d0, d1, rgb, { batch });
  const pw = w * 0.34, gap = w * 0.08;
  for (const px of [-pw / 2 - gap / 2, pw / 2 + gap / 2]) for (const [y0, y1] of [[h * 0.09, h * 0.42], [h * 0.48, h * 0.9]]) {
    c.wbox(side, at + px, pw, y0, y1, d1, d1 + 0.006, dark, { batch });
    c.wbox(side, at + px, pw - 0.07 * (w / 0.9), y0 + 0.035 * (h / 2), y1 - 0.035 * (h / 2), d1 + 0.006, d1 + 0.011, lite, { batch });
  }
  const hx = (o.hinge === 'right' ? -1 : 1) * (w / 2 - w * 0.09), hy = o.handleY ?? h * 0.47;
  c.wbox(side, at + hx, w * 0.05, hy - 0.012 * (h / 2), hy + 0.012 * (h / 2), d1, d1 + 0.05, [0.72, 0.68, 0.55], { batch });
  c.wbox(side, at + hx - Math.sign(hx) * w * 0.06, w * 0.15, hy - 0.012 * (h / 2), hy + 0.012 * (h / 2), d1 + 0.035, d1 + 0.05, [0.78, 0.74, 0.6], { batch });
  return hx;
}
/** A cream frame around a doorway-sized hole. */
export function doorFrame(c, side, at, w, h, rgb = lin('#e2d8bd'), depth = 0.05) {
  c.wbox(side, at - w / 2 - 0.035, 0.07, 0, h + 0.07, 0, depth, rgb);
  c.wbox(side, at + w / 2 + 0.035, 0.07, 0, h + 0.07, 0, depth, rgb);
  c.wbox(side, at, w, h, h + 0.07, 0, depth, rgb);
}
/** A yellow A-frame sign. texts: two lines. */
export function wetSign(c, x, z, rot, lines, fallen = false) {
  const tex = card(c, 'wet' + lines.join('|'), lines, { w: 48, h: 80, bg: '#f2c318', fg: '#201a08', edge: '#c79a0c', size: 11, pad: 6 });
  const batch = c.mapped('wet' + lines.join('|'), tex), inner = lin('#8a6c08'), w = 0.3, h = 0.6, spread = 0.17;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const pt = (lx, y, lz) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs];
  if (fallen) { c.lay(batch, x, z, w, h, rot, null, WHITE, 0.012); c.lay(batch, x + sn * 0.34, z + cs * 0.34, w, h, rot + 2.6, null, WHITE, 0.02); return; }
  batch.quad(pt(-w / 2, 0, spread), pt(w / 2, 0, spread), pt(w / 2, h, 0.01), pt(-w / 2, h, 0.01));
  batch.quad(pt(w / 2, 0, -spread), pt(-w / 2, 0, -spread), pt(-w / 2, h, -0.01), pt(w / 2, h, -0.01));
  c.flat.quad(pt(w / 2, 0, spread), pt(-w / 2, 0, spread), pt(-w / 2, h, 0.01), pt(w / 2, h, 0.01), inner);
  c.flat.quad(pt(-w / 2, 0, -spread), pt(w / 2, 0, -spread), pt(w / 2, h, -0.01), pt(-w / 2, h, -0.01), inner);
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
