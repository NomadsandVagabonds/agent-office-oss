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
import { Vox, M } from '../../vox/vox.js';
import { lawn, flat, upright, daylight, setArt, cutBatch, TIMBER } from '../suburb.js';

const tubeRed = M('#b3261e', 0), steel = M('#8d949c', 0), yellow = M('#e8b52a', 0), blue = M('#27508f', 0);
/** A slide: a tower of red tube with a deck of planks, hooped rails, a ladder up the back and a moulded chute down the front. About the middle of its tower. */
function slideVox() {
  const v = new Vox(), top = 60;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) v.tube(sx * 16, 0, sz * 16, sx * 16, 92, sz * 16, 1.5, tubeRed);
  for (let x = -17; x < 17; x += 5) v.box(x, top - 2, -17, x + 4.4, top, 17, blue);
  for (const sx of [-1, 1]) { v.tube(sx * 16, 88, -16, sx * 16, 88, 16, 1.2, tubeRed); v.tube(sx * 16, 74, -16, sx * 16, 74, 16, 1, tubeRed); for (let a = 0; a <= 6; a++) v.tube(sx * 16, 92 + Math.sin(a * 0.5236) * 6, -16 + a * 5.33, sx * 16, 92 + Math.sin((a + 1) * 0.5236) * 6, -16 + (a + 1) * 5.33, 1.2, tubeRed); }
  // the ladder
  for (const sx of [-1, 1]) v.tube(sx * 10, 0, -42, sx * 10, top + 18, -17, 1.3, steel);
  for (let i = 1; i <= 6; i++) { const k = i / 7, y = top * k, z = -42 + 25 * k * (top / (top + 18)); v.tube(-10, y, z, 10, y, z, 1, steel); }
  // the chute: a trough, with a lip either side, and a flat where you are meant to stop
  const N = 26;                                       // (in steps of ten centimetres: finer than that and the room is over its budget)
  for (let i = 0; i < N; i++) { const z = 17 + i * 4, y = Math.round(top - 1 - (49 * i) / N); v.box(-11, y - 2, z, 11, y, z + 4, yellow); for (const sx of [-1, 1]) v.box(sx > 0 ? 10 : -12, y, z, sx > 0 ? 12 : -10, y + 5, z + 4, M('#d9a41e', 0)); }
  v.box(-11, 8, 121, 11, 10, 142, yellow); for (const sx of [-1, 1]) { v.box(sx > 0 ? 10 : -12, 10, 121, sx > 0 ? 12 : -10, 14, 142, M('#d9a41e', 0)); v.tube(sx * 10, 0, 136, sx * 10, 9, 136, 1.2, steel); v.tube(sx * 10, 0, 80, sx * 10, 29, 80, 1.2, steel); }
  return v;
}
/** A swing seat and the two chains it hangs by, `links` voxels of them: rubber with a steel edge, chain that is chain. From under the seat. */
const swingVox = (links) => () => {
  const v = new Vox();
  v.rbox(-11, 0, -4, 11, 2.4, 4, 1, M('#17171a', 2)); for (const sx of [-1, 1]) { v.box(sx > 0 ? 9 : -11, 0.6, -4, sx > 0 ? 11 : -9, 1.8, 4, steel); v.tube(sx * 9, 2, 0, sx * 9, 6, 0, 0.6, steel); }
  for (const sx of [-1, 1]) for (let y = 6; y < links; y += 3) v.ring(sx * 9, y + 1.5, 0, 1.5, 0.75, steel, (y / 3) % 2 ? 'x' : 'z');
  return v;
};
/** What a seesaw turns on: two legs splayed either side, an axle between. */
function pivotVox() { const v = new Vox(); for (const sx of [-1, 1]) { v.tube(sx * 5, 17, 0, sx * 7, 0, -9, 1.3, steel); v.tube(sx * 5, 17, 0, sx * 7, 0, 9, 1.3, steel); v.tube(sx * 7, 1, -9, sx * 7, 1, 9, 1, steel); } v.cyl('x', 17, 0, -7, 7, 1.8, M('#5d646c', 0)); return v; }
/** Its plank: a board with a seat and a handle at either end. About its middle, along z. */
function plankVox() {
  const v = new Vox(), board = M('#2f7a44', 2);
  v.rbox(-4.5, 0, -68, 4.5, 2.6, 68, 1, board); for (let z = -60; z < 60; z += 17) v.box(-4.5, 2.4, z, 4.5, 2.7, z + 1, M('#256338', 2));
  for (const sz of [-1, 1]) { v.rbox(-6, 2.6, sz > 0 ? 50 : -66, 6, 4.4, sz > 0 ? 66 : -50, 1.5, tubeRed); for (const sx of [-1, 1]) v.tube(sx * 4.6, 2.6, sz * 46, sx * 4.6, 13, sz * 44, 0.8, steel); v.tube(-4.6, 13, sz * 44, 4.6, 13, sz * 44, 0.9, M('#17171a', 0)); }
  return v;
}
/** A coil spring, bolted down. */
function springVox() { const v = new Vox(); v.box(-5, 0, -5, 5, 1, 5, steel); for (const [x, z] of [[-4, -4], [3, -4], [-4, 3], [3, 3]]) v.set(x, 1, z, M('#17171a', 0)); for (let y = 2; y < 17; y += 2.4) v.ring(0, y, 0, 2.7, 0.7, M('#2a2c30', 0), 'y'); v.cyl('y', 0, 0, 16, 18, 3, steel); return v; }
/** The sandpit: four sleepers bolted at the corners, and in it what the shredder made, heaped; a bucket, a spade stuck in. */
function pitVox() {
  const v = new Vox(), wood = M('#a17c4c', 3), strips = ['#efe9d8', '#e4dfcd', '#f6f3e8', '#d9d3bf', '#cfe0ea'].map((k) => M(k, 2));
  for (const [x0, z0, x1, z1] of [[-38, -38, 38, -32], [-38, 32, 38, 38], [-38, -32, -32, 32], [32, -32, 38, 32]]) v.rbox(x0, 0, z0, x1, 8, z1, 1, wood);
  for (const sx of [-35, 35]) for (const sz of [-35, 35]) v.cyl('y', sx, sz, 8, 9, 1.2, M('#5d646c', 0));
  v.box(-32, 0, -32, 32, 5, 32, strips[1]);
  for (let i = 0; i < 150; i++) { const a = i * 2.39996, r = 4 + ((i * 37) % 27), x = Math.cos(a) * r, z = Math.sin(a) * r, hgt = 5 + ((i * 13) % 5) * (r < 14 ? 1 : 0.4), t = strips[i % 5]; v.tube(x, hgt, z, x + Math.cos(i) * 3, hgt + ((i * 7) % 3) * 0.4, z + Math.sin(i) * 3, 0.5, t); }
  v.ellipsoid(-6, 6, 4, 13, 4.5, 11, strips[0]);
  v.cyl('y', 16, -12, 5, 14, 3.4, tubeRed, 4.6); v.cyl('y', 16, -12, 13, 14, 4.9, M('#efe9d8', 0)); v.carve(13, 7, -15, 19, 15, -9); v.cyl('y', 16, -12, 5, 7, 3.2, tubeRed); v.ring(16, 15, -12, 4.4, 0.5, M('#efe9d8', 0), 'x');
  v.tube(-18, 6, -14, -22, 24, -17, 0.9, M('#e8b52a', 0)); v.box(-20, 3, -16, -15, 9, -12, blue); v.tube(-23.4, 24, -17.6, -20.6, 24, -16.4, 0.9, M('#e8b52a', 0));
  return v;
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
    c.model('recess:slide:2', slideVox, x, z, { y: -down, tilt: [tip, lean], scale, solid: false, shadow: false });
    c.blot(x, z + 1.2, 2.6 * scale, 5.2 * scale, { a: 0.42 }); c.blot(x, z, 1.5 * scale, 1.5 * scale, { a: 0.4 });
  };
  const sx = -0.4, sz = -1.6;
  going(sx, sz, p.lean * 0.3, 0.06, 0.8);
  c.solid(sx - 0.55, sz - 0.9, sx + 0.55, sz + 3.3, { tall: false }); c.reserve(sx, sz + 1.2, 2.4);
  const tx = W / 2 - 3.6, tz = -D / 2 + 2.6;
  going(tx, tz, -p.lean * 0.12, 0.1, 1.23, 0.78);
  c.solid(tx - 0.4, tz - 0.4, tx + 0.4, tz + 0.5); c.reserve(tx, tz, 1.2);

  /* two swings, hung from the ceiling on chain: one where it should be, one that nobody could get on, and that one is moving */
  const wx = -W / 2 + 3.1, wz = -D / 2 + 2.9, VOX = kit.VOXEL;
  for (const k of [0, 1]) {
    const x = wx + k * 1.15, high = k === p.high, y = high ? 2.05 : 0.5, links = Math.ceil((H - y) / VOX), geo = kit.model('recess:swing:2:' + links, swingVox(links));
    c.hole(x - 0.25, wz - 0.25);
    if (!high) { c.place(geo, x, wz, { y, solid: false, shadow: false }); c.shadow(x, wz, 0.5, 0.2, 0.4); continue; }
    const b = new Batch(true); b.addVox(geo.solid, new THREE.Matrix4().compose(new THREE.Vector3(x, y, wz), new THREE.Quaternion(), new THREE.Vector3(VOX, VOX, VOX)));
    const g = c.dynamic(b, { pivot: [x, H, wz] });
    c.tick((dt, t) => { g.rotation.x = Math.sin(t * 1.25) * 0.11; });
  }
  c.reserve(wx + 0.6, wz, 1.3);

  /* the seesaw: one end is under the grass */
  { const x = W / 2 - 2.6, z = -0.2;
    c.model('recess:pivot', pivotVox, x, z, { solid: false, shadow: false });
    c.model('recess:plank', plankVox, x, z, { y: 0.44, tilt: [-0.36, 0], solid: false, shadow: false });
    c.blot(x, z - 1.6, 0.9, 0.9, { a: 0.45 }); c.solid(x - 0.15, z - 0.25, x + 0.15, z + 1.75); c.reserve(x, z, 1.9); }

  /* a duck on a spring: board, painted on the side you come in by; the spring is a spring */
  { const x = -W / 2 + 3.2, z = D / 2 - 3.4, u = art.uv('duck'), v = art.uv('duckBack', true), dx = 0.4 * Math.cos(0.5), dz = 0.4 * Math.sin(0.5);
    c.model('recess:spring', springVox, x, z, { solid: false, shadow: false });
    upright(cut, x - dx, z + dz, x + dx, z - dz, 0.42, 1.12, u); upright(cut, x + dx, z - dz, x - dx, z + dz, 0.42, 1.12, v);
    c.solid(x - 0.2, z - 0.2, x + 0.2, z + 0.2); c.shadow(x, z, 0.5, 0.4, 0.4); c.reserve(x, z, 0.7); }

  /* the sandpit: what the shredder made, a bucket, a spade */
  { const x = W / 2 - 3.5, z = D / 2 - 3.7, s = 0.95;
    c.model('recess:pit', pitVox, x, z, { solid: false, shadow: false });
    scatter(c, x, z, 9, 1.3);
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
