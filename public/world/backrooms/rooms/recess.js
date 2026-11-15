// The Backrooms — a room of the neighbourhood (themes.js `suburb`): Recess
// ("the playground that is going under"). Fake grass, a square of bark, and
// what an office remembered of a playground: a slide, a smaller slide, two
// swings, a seesaw, a duck on a spring, a sandpit, hopscotch. The slide is
// leaning, and is some way down into the floor; the smaller one has gone
// nearly all the way. One end of the seesaw is under the grass. The swings
// were never hung from a frame: their chains go up through the ceiling, and
// one of the seats is far too high, and moving. The duck is painted board.
// The sandpit is full of what the shredder made. The hopscotch cannot count.
//
// Nothing in it is used (yet: the slide is the obvious way down, and that is
// for seam.js and whoever looks after it). It is a room to walk through.
import * as THREE from 'three';
import { Batch, drawText, ticks, WHITE } from '../kit.js';
import { P, scatter } from '../bits.js';
import { lawn, flat, sheet, upright, beam, daylight, setArt, cutBatch, TIMBER } from '../suburb.js';

const RED = [0.66, 0.13, 0.1], BLUE = [0.14, 0.3, 0.62], YELLOW = [0.9, 0.7, 0.12], STEEL = [0.5, 0.52, 0.55], GREEN = [0.16, 0.45, 0.24];

/** A slide, upright, its tower at (x, z) and its chute running out toward +z: into `b`, to be leaned and sunk afterwards. */
function slide(b, x, z) {
  const top = 1.5;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) beam(b, [x + sx * 0.4, 0, z + sz * 0.4], [x + sx * 0.4, 2.3, z + sz * 0.4], 0.07, RED);
  b.box(x - 0.44, top - 0.06, z - 0.44, x + 0.44, top, z + 0.44, BLUE);
  for (const sx of [-1, 1]) { beam(b, [x + sx * 0.4, 2.2, z - 0.4], [x + sx * 0.4, 2.2, z + 0.4], 0.05, RED); beam(b, [x + sx * 0.4, 1.85, z - 0.4], [x + sx * 0.4, 1.85, z + 0.4], 0.04, RED); }
  // the ladder, on the far side
  for (const sx of [-1, 1]) beam(b, [x + sx * 0.25, 0, z - 1.05], [x + sx * 0.25, top + 0.5, z - 0.42], 0.05, STEEL);
  for (let i = 1; i <= 5; i++) { const k = i / 6; beam(b, [x - 0.25, top * k, z - 1.05 + 0.63 * k * (top / (top + 0.5))], [x + 0.25, top * k, z - 1.05 + 0.63 * k * (top / (top + 0.5))], 0.04, STEEL); }
  // the chute, its lips, and the bit at the bottom where you stop
  const a0 = [x - 0.3, top, z + 0.44], a1 = [x + 0.3, top, z + 0.44], b0 = [x - 0.3, 0.28, z + 3.0], b1 = [x + 0.3, 0.28, z + 3.0], c0 = [x - 0.3, 0.26, z + 3.5], c1 = [x + 0.3, 0.26, z + 3.5];
  sheet(b, b0, b1, a1, a0, 1, 5, null, YELLOW); sheet(b, c0, c1, b1, b0, 1, 1, null, YELLOW);
  const lip = (p, q) => sheet(b, p, q, [q[0], q[1] + 0.15, q[2]], [p[0], p[1] + 0.15, p[2]], 4, 1, null, YELLOW, 0.85);
  lip(b0, a0); lip(a1, b1); lip(c0, b0); lip(b1, c1);
  for (const sx of [-1, 1]) beam(b, [x + sx * 0.3, 0, z + 2.9], [x + sx * 0.3, 0.3, z + 2.9], 0.05, STEEL);
}

export function build(c) {
  const { W, D, H, params: p, kit } = c, art = setArt(kit), cut = cutBatch(c);
  c.shell({ panels: false });
  daylight(c, 4, 3, 1, 1);
  lawn(c, { wrong: 0, paint: 'sky', width: 0.4, cloudTop: H - 0.9 });

  /* the square of bark, with a timber edge you step over */
  const m = { x0: -W / 2 + 2.3, x1: W / 2 - 4.6, z0: -D / 2 + 1.9, z1: D / 2 - 3.0 };
  c.mapped('recess:bark', kit.tex.carpet('#6a4a30')).grid([m.x0, 0.012, m.z0], [0, 0, 1], [1, 0, 0], ticks(m.z1 - m.z0), ticks(m.x1 - m.x0), (u, v) => [(m.x0 + v) / 0.8, (m.z0 + u) / 0.8]);
  for (const [ex0, ez0, ex1, ez1] of [[m.x0 - 0.1, m.z0 - 0.1, m.x1 + 0.1, m.z0], [m.x0 - 0.1, m.z1, m.x1 + 0.1, m.z1 + 0.1], [m.x0 - 0.1, m.z0, m.x0, m.z1], [m.x1, m.z0, m.x1 + 0.1, m.z1]]) c.flat.box(ex0, 0, ez0, ex1, 0.07, ez1, TIMBER, { skip: '-y' });

  /* the slide, leaning and part of the way down; the small one, nearly gone */
  const going = (x, z, lean, tip, down, scale = 1) => {
    const b = new Batch(); slide(b, x, z);
    const g = c.dynamic(b, { pivot: [x, 0, z + 1.2], side: THREE.DoubleSide });
    g.rotation.set(tip, 0, lean); g.position.y -= down; g.scale.setScalar(scale);
    c.blot(x, z + 1.2, 2.6 * scale, 5.2 * scale, { a: 0.42 }); c.blot(x, z, 1.5 * scale, 1.5 * scale, { a: 0.4 });
  };
  const sx = -0.4, sz = -1.6;
  going(sx, sz, p.lean * 0.2, -0.07, 0.62);
  c.solid(sx - 0.55, sz - 0.9, sx + 0.55, sz + 3.3, { tall: false }); c.reserve(sx, sz + 1.2, 2.4);
  const tx = W / 2 - 3.6, tz = -D / 2 + 2.6;
  going(tx, tz, -p.lean * 0.12, 0.1, 1.23, 0.78);
  c.solid(tx - 0.4, tz - 0.4, tx + 0.4, tz + 0.5); c.reserve(tx, tz, 1.2);

  /* two swings, hung from the ceiling: one where it should be, one that nobody could get on, and that one is moving */
  const wx = -W / 2 + 3.1, wz = -D / 2 + 2.9, seat = (b, x, y) => {
    for (const s of [-1, 1]) beam(b, [x + s * 0.23, H, wz], [x + s * 0.23, y, wz], 0.022, STEEL);
    b.box(x - 0.27, y - 0.04, wz - 0.1, x + 0.27, y, wz + 0.1, [0.08, 0.08, 0.09]);
  };
  for (const k of [0, 1]) {
    const x = wx + k * 1.15, high = k === p.high;
    c.hole(x - 0.25, wz - 0.25);
    if (!high) { seat(c.flat, x, 0.5); c.shadow(x, wz, 0.5, 0.2, 0.4); continue; }
    const b = new Batch(); seat(b, x, 2.05);
    const g = c.dynamic(b, { pivot: [x, H, wz], side: THREE.DoubleSide });
    c.tick((dt, t) => { g.rotation.x = Math.sin(t * 1.25) * 0.11; });
  }
  c.reserve(wx + 0.6, wz, 1.3);

  /* the seesaw: one end is under the grass */
  { const x = W / 2 - 2.6, z = -0.2;
    c.flat.box(x - 0.1, 0, z - 0.09, x + 0.1, 0.37, z + 0.09, STEEL, { skip: '-y' });
    for (const k of [-0.07, 0.07]) beam(c.flat, [x + k, -0.2, z - 1.7], [x + k, 1.04, z + 1.7], 0.13, GREEN);
    for (const s of [-0.13, 0.13]) beam(c.flat, [x + s, 0.98, z + 1.3], [x + s, 1.24, z + 1.2], 0.03, STEEL);
    beam(c.flat, [x - 0.13, 1.24, z + 1.2], [x + 0.13, 1.24, z + 1.2], 0.03, STEEL);
    c.blot(x, z - 1.6, 0.9, 0.9, { a: 0.45 }); c.solid(x - 0.15, z - 0.25, x + 0.15, z + 1.75); c.reserve(x, z, 1.9); }

  /* a duck on a spring: board, painted on the side you come in by */
  { const x = -W / 2 + 3.2, z = D / 2 - 3.4, u = art.uv('duck'), v = art.uv('duckBack', true), dx = 0.4 * Math.cos(0.5), dz = 0.4 * Math.sin(0.5);
    for (let i = 0; i < 5; i++) c.flat.box(x - 0.07 + (i % 2) * 0.02, i * 0.09, z - 0.07, x + 0.07 - (i % 2) * 0.02, i * 0.09 + 0.05, z + 0.07, [0.12, 0.12, 0.13], { skip: i ? '' : '-y' });
    upright(cut, x - dx, z + dz, x + dx, z - dz, 0.42, 1.12, u); upright(cut, x + dx, z - dz, x - dx, z + dz, 0.42, 1.12, v);
    c.solid(x - 0.2, z - 0.2, x + 0.2, z + 0.2); c.shadow(x, z, 0.5, 0.4, 0.4); c.reserve(x, z, 0.7); }

  /* the sandpit: what the shredder made, and a bucket */
  { const x = W / 2 - 3.5, z = D / 2 - 3.7, s = 0.95;
    for (const [bx0, bz0, bx1, bz1] of [[x - s, z - s, x + s, z - s + 0.1], [x - s, z + s - 0.1, x + s, z + s], [x - s, z - s + 0.1, x - s + 0.1, z + s - 0.1], [x + s - 0.1, z - s + 0.1, x + s, z + s - 0.1]]) c.flat.box(bx0, 0, bz0, bx1, 0.2, bz1, TIMBER, { skip: '-y' });
    c.mapped('recess:shred', kit.tex.carpet('#e4dfcd')).grid([x - s + 0.1, 0.15, z - s + 0.1], [0, 0, 1], [1, 0, 0], ticks(2 * s - 0.2), ticks(2 * s - 0.2), (u, v) => [u / 0.5, v / 0.5]);
    scatter(c, x, z, 9, 1.3);
    c.flat.box(x + 0.25, 0.15, z - 0.4, x + 0.42, 0.33, z - 0.23, RED); c.flat.box(x + 0.265, 0.33, z - 0.385, x + 0.405, 0.335, z - 0.245, [0.9, 0.88, 0.8]);
    c.solid(x - s, z - s, x + s, z + s, { tall: false }); c.reserve(x, z, 1.5); }

  /* a tree, in the corner, and what is behind it */
  { const x = W / 2 - 1.8, z = -D / 2 + 1.35; flat(c, x - 0.8, z, x + 0.8, z, 'tree', { h: Math.min(2.8, H - 0.1), full: 2.8, back: 'treeBack', brace: 0.75 }); }

  /* the notice, and the hopscotch */
  { const spot = c.wallSpot(1.5, ['back', 'left', 'right'], 0.5, 2.3);
    if (spot) {
      const tex = kit.tex.custom('recess:sign:' + p.rules.join('|'), 160, 96, (g, w, h) => { P(g, '#f4f1e4', 0, 0, w, h); P(g, '#1f6b3a', 0, 0, w, 30); P(g, '#1f6b3a', 0, h - 4, w, 4); drawText(g, [p.rules[0]], 0, 0, w, 30, { color: '#f4f1e4', size: 20 }); drawText(g, [p.rules[1]], 0, 32, w, 20, { color: '#22201c', size: 12, pad: 8 }); drawText(g, [p.rules[2]], 0, 52, w, 38, { color: '#b3261e', size: 13, pad: 10 }); }, { clamp: true });
      c.wbox(spot.side, spot.at, 1.3, 1.25, 2.03, 0, 0.02, [0.85, 0.85, 0.8]); c.hang(c.mapped('recess:sign', tex), spot.side, spot.at, 1.64, 1.25, 0.75, null, WHITE, 0.024); c.keepWall(spot.side, spot.at - 0.7, spot.at + 0.7);
    } }
  { const n = p.hops.length, tex = kit.tex.custom('recess:hop:' + p.hops.join(''), 24, 24 * n, (g, w) => { for (let i = 0; i < n; i++) { const y = (n - 1 - i) * 24; g.strokeStyle = '#f1efe4'; g.lineWidth = 2; g.strokeRect(2, y + 2, w - 4, 20); drawText(g, [String(p.hops[i])], 0, y, w, 24, { color: '#f1efe4', size: 14 }); } }, { clamp: true });
    const x = -W / 2 + 1.25, z = D / 2 - 1.6 - (n * 0.55) / 2;
    c.lay(c.mapped('recess:hop', tex, { cutout: true }), x, Math.max(-D / 2 + 2.5, z), 0.55, n * 0.55, 0, null, WHITE, 0.016); }
}
