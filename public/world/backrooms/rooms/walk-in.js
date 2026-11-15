// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The
// Walk-in ("the bedroom with the closet you can get lost in"). A bedroom: a
// bed made, a lamp on, slippers. Its closet doors stand open, and the closet
// goes on: a maze of passages a body wide, every wall of it the same wall,
// drawn on in marker by somebody who had heard what is kept in one: a rail, a
// hanger, a frock, a pair of shoes, again and again. The way on is through.
import { Vox, M, glow } from '../../vox/vox.js';
import { P } from '../bits.js';

export const WALKIN = Object.freeze({ bed: 3.6, cell: 1.25, wall: 0.12 });
/** The cells of a maze nx by nz, cut by a walk from `start` (R: the room's own source). → open[i]: a set of the cells cell i opens into. Every cell is reached. */
export function carve(nx, nz, start, R) {
  const open = Array.from({ length: nx * nz }, () => new Set()), seen = new Set([start]), stack = [start];
  while (stack.length) {
    const cur = stack[stack.length - 1], x = cur % nx, z = (cur - x) / nx;
    const next = R.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]).map(([dx, dz]) => [x + dx, z + dz]).filter(([a, b]) => a >= 0 && b >= 0 && a < nx && b < nz && !seen.has(a + b * nx));
    if (!next.length) { stack.pop(); continue; }
    const k = next[0][0] + next[0][1] * nx; open[cur].add(k); open[k].add(cur); seen.add(k); stack.push(k);
  }
  return open;
}
/** A bed, made: a frame with a headboard, a mattress, a quilt in squares turned back at the top, two pillows. Head toward -z. */
function bedVox() {
  const v = new Vox(), wood = M('#7a4f2a', 3), q = ['#b85c4a', '#e8d9a0', '#5f8f8a', '#d9977a'].map((k) => M(k, 2));
  v.box(-20, 4, -40, 20, 12, 40, wood); for (const [x, z] of [[-20, -40], [17, -40], [-20, 37], [17, 37]]) v.box(x, 0, z, x + 3, 12, z + 3, wood); v.rbox(-21, 4, -43, 21, 34, -40, 3, wood, 'xy');
  v.rbox(-19, 12, -39, 19, 19, 39, 2, M('#efe9d8', 2)); v.rbox(-20, 16, -24, 20, 21, 40, 2, (x, y, z) => q[(((x + 40) >> 3) + ((z + 80) >> 3)) % 4]); v.rbox(-20, 20, -27, 20, 22, -22, 1, M('#efe9d8', 2));
  for (const x of [-16, 2]) v.rbox(x, 19, -38, x + 14, 24, -29, 2, M('#f6f3e8', 2));
  return v;
}
/** A bedside table with a lamp on it, lit, and a clock that is not right. */
function tableVox() { const v = new Vox(), wood = M('#7a4f2a', 3); v.box(-8, 0, -7, 8, 20, 7, wood); v.box(-7, 11, 7, 7, 18, 7.6, M('#6b4324', 3)); v.set(0, 14, 8, M('#c9a43a', 0)); v.cyl('y', -3, 0, 20, 21, 2.6, M('#c9a43a', 0)); v.tube(-3, 21, 0, -3, 29, 0, 0.7, M('#c9a43a', 0)); v.cyl('y', -3, 0, 28, 36, 4.6, glow('#ffe2a8'), 3); v.box(3, 20, -2, 7, 23, 1, M('#1b1614', 0)); v.box(3.4, 21, 1, 6.6, 22.4, 1.3, glow('#d9433a')); return v; }
/** One leaf of a closet's folding door: louvres in a frame. From its hinge edge. */
function leafVox() { const v = new Vox(), w = M('#efe9d8', 1), d = M('#cfc8b4', 1); v.box(0, 1, -1, 16, 80, 1, w); for (let y = 5; y < 76; y += 3) { v.carve(2, y, -1, 14, y + 2, 1); v.box(2, y, -0.6, 14, y + 1, 0.4, d); } v.box(0, 38, -1, 16, 42, 1, w); v.set(13, 40, 1, M('#c9a43a', 0)); return v; }
export function build(c) {
  const { W, D, H, R, kit } = c, K = WALKIN;
  c.shell({ floorTex: kit.tex.carpet('#8a6f5a') });
  const zb = D / 2 - K.bed, depth = zb + D / 2, across = Math.floor(W / K.cell), nx = Math.max(3, across % 2 ? across : across - 1), nz = Math.floor(depth / K.cell), cw = W / nx, cd = depth / nz;
  const mid = (nx - 1) / 2, cell = (i, j) => i + j * nx;
  const open = carve(nx, nz, cell(mid, nz - 1), R);

  /* the closet's walls: every one the same, and what somebody drew on them */
  const paper = c.mapped('walkin:wall', kit.tex.custom('walkin:wall', 64, 64, (g, w, h) => {
    P(g, '#e6dcc4', 0, 0, w, h); for (let x = 0; x < w; x += 8) P(g, '#ddd2b8', x, 0, 1, h);
    g.strokeStyle = '#2c2a33'; g.lineWidth = 1.2; g.lineCap = 'round'; const L = (...p) => { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); };
    L(0, 5.5, 64, 6.5); L(16, 6, 16, 10); L(8, 15, 16, 10, 25, 15, 8, 15); L(10, 15, 7, 34, 26, 34, 23, 15); L(11, 22, 22, 22);                       // a rail, a hanger, a frock
    L(46, 6, 46, 9); L(39, 14, 46, 9, 54, 14); L(40, 14, 40, 30, 52, 30, 52, 14); L(40, 17, 35, 26); L(52, 17, 58, 25); L(46, 14, 46, 30);              // a hanger, a jacket
    L(4, 47, 60, 47.6); for (const x of [8, 22, 38, 50]) { L(x, 47, x, 42, x + 3, 42, x + 8, 45, x + 8, 47); L(x + 1, 44, x + 3, 44); }                  // a shelf, and shoes: all left ones
    L(4, 60, 60, 60.4); g.beginPath(); g.ellipse(18, 56, 6, 3, 0, 0, 7); g.stroke(); L(14, 54, 22, 54); L(40, 60, 40, 53, 50, 53, 50, 60);             // a hat, a box
  }));
  const wall = (x0, z0, x1, z1) => c.pillar((x0 + x1) / 2, (z0 + z1) / 2, Math.max(K.wall, Math.abs(x1 - x0)), Math.max(K.wall, Math.abs(z1 - z0)), { batch: paper, skirting: false });
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = cell(i, j), x0 = -W / 2 + i * cw, z0 = -D / 2 + j * cd;
    if (i + 1 < nx && !open[k].has(cell(i + 1, j))) wall(x0 + cw, z0, x0 + cw, z0 + cd);
    if (j + 1 < nz && !open[k].has(cell(i, j + 1))) wall(x0, z0 + cd, x0 + cw, z0 + cd);
  }
  // the wall between the bedroom and all that, with the one way in; its doors folded back
  const ex0 = -W / 2 + mid * cw, ex1 = ex0 + cw;
  wall(-W / 2, zb, ex0, zb); wall(ex1, zb, W / 2, zb);
  for (const [x, rot] of [[ex0, Math.PI / 2 - 0.3], [ex0 + 0.12, Math.PI / 2 + 0.5], [ex1, Math.PI / 2 + 0.3 + Math.PI], [ex1 - 0.12, Math.PI / 2 - 0.5 + Math.PI]]) c.model('walkin:leaf', leafVox, x, zb + 0.08, { rot, solid: false, shadow: false });

  /* the bedroom */
  const bx = -W / 2 + 1.6, bz = D / 2 - 1.5;
  c.model('walkin:bed', bedVox, bx, bz, { rot: Math.PI / 2, solid: false }); c.solid(bx - 1.1, bz - 0.55, bx + 1.1, bz + 0.55);
  c.model('walkin:table', tableVox, bx - 0.9, bz - 0.95, { solid: true }); c.light(bx - 0.95, 0.9, bz - 0.9, '#ffe2a8', 0.7, { k: 1.3, far: 5 });
  { const rug = c.mapped('walkin:rug', kit.tex.custom('walkin:rug', 48, 32, (g, w, h) => { P(g, '#7d2a22', 0, 0, w, h); P(g, '#e8d9a0', 3, 3, w - 6, h - 6); P(g, '#5f8f8a', 6, 6, w - 12, h - 12); for (let x = 9; x < w - 9; x += 6) P(g, '#e8d9a0', x, 14, 3, 4); }, { clamp: true })); c.lay(rug, 0.6, bz - 0.3, 1.8, 1.2, 0.08); }
  for (const dx of [0, 0.16]) c.flat.box(bx + 1.25 + dx, 0, bz - 0.3, bx + 1.36 + dx, 0.05, bz - 0.04, [0.6, 0.3, 0.35], { skip: '-y' });

  void H;
}
