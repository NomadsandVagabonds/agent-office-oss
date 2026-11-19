// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Lock-ups
// ("the room that is all garage doors"). Roller doors down both sides and
// across the end, a number over each that is nearly a number, an oil stain in
// front of every one. They rattle. With the remote they open, and what is
// behind each is not known until it does: most stand out from the wall as a
// lock-up of their own, and in one there is what people keep in a lock-up
// (sometimes something worth having), in one a car that is exactly the size
// of it, in one somebody who has had to move out of the woods and lives there
// now. Some are still the wall, or a picture of a garage with nothing in it.
// And where the room has a way out in one of those walls, a roller is in
// front of that too, and it goes up on its own as you come to it. A remote is
// on the floor here, in case nobody has found one.
import * as THREE from 'three';
import { P } from '../bits.js';
import { Batch, lamp } from '../kit.js';
import { Vox, M } from '../../vox/vox.js';
import { garble, lawn, roller, daylight, carVox } from '../suburb.js';
import { wallBox } from '../mall.js';
import { sadFoxVox } from '../forest-models.js';

// depth: how far a lock-up stands out from the wall · post: its side walls' thickness
export const LOCKUPS = Object.freeze({ depth: 2.4, post: 0.1, w: 2.4 });
const BLOCK = [0.62, 0.6, 0.56], CONC = [0.5, 0.49, 0.47];

/** What is kept in a lock-up: steel racking, two shelves of boxes and tins, a bike against it, a mower in front. Back toward −z. */
function storeVox(n) { return () => {
  const v = new Vox(), steel = M('#6e7378', 0), card = M('#b08a5a', 2), cardD = M('#8a6a42', 2), tins = ['#b3261e', '#2a4a6a', '#e8c040', '#3f7a3a', '#e8e2d0'];
  for (const x of [-34, 33]) for (const z of [-8, 7]) v.box(x, 0, z, x + 1, 64, z + 1, steel);
  for (const y of [0, 22, 44]) v.box(-34, y + 2, -8, 34, y + 3, 8, steel);
  for (let i = 0; i < 6; i++) { const x = -32 + i * 11, y = 3 + (i % 2) * 22; v.box(x, y, -6, x + 9, y + 8 + (i % 3) * 3, 6, i % 2 ? card : cardD); v.box(x, y + 5, 6, x + 9, y + 6, 7, M('#d8cfbc', 1)); }
  for (let i = 0; i < 7; i++) { const x = -30 + i * 9; v.cyl('y', x, 0, 47, 54, 3, M(tins[(i + n) % 5], 0)); v.cyl('y', x, 0, 54, 55, 3.2, M('#8d949c', 0)); }
  // a bike, leant against the racking
  const frame = M(tins[n % 5], 0), tyre = M('#17171a', 2);
  for (const x of [-22, 18]) { v.ring(x, 14, 14, 12, 1, tyre, 'z'); v.tube(x, 14, 14, -2, 14, 14, 0.4, M('#9aa1a8', 0)); }
  v.tube(-22, 14, 14, -6, 30, 14, 0.8, frame); v.tube(-6, 30, 14, 14, 30, 14, 0.8, frame); v.tube(14, 30, 14, 18, 14, 14, 0.8, frame); v.tube(-2, 14, 14, -6, 30, 14, 0.8, frame); v.tube(-2, 14, 14, 14, 30, 14, 0.8, frame);
  v.box(-9, 31, 12, -3, 33, 16, M('#1b1614', 1)); v.tube(14, 30, 14, 16, 36, 14, 0.6, M('#9aa1a8', 0)); v.tube(12, 36, 9, 20, 36, 19, 0.6, M('#1b1614', 0));
  // a mower, its handle up
  v.rbox(-30, 3, 24, -12, 10, 40, 2, M('#3f7a3a', 1)); for (const [x, z] of [[-28, 24], [-14, 24], [-28, 39], [-14, 39]]) v.cyl('z', x, 3, z - 1, z + 1, 3, tyre);
  v.tube(-21, 10, 26, -21, 30, 18, 0.6, M('#9aa1a8', 0)); v.tube(-25, 30, 18, -17, 30, 18, 0.6, M('#1b1614', 0));
  return v; }; }

export function build(c) {
  const { W, D, H, R, params: p, kit, room } = c, K = LOCKUPS;
  c.shell({ panels: false });
  daylight(c, 3, 3, 1, 1);
  lawn(c, { wrong: 0, paint: 'sky', clouds: false, width: 0.5, neighbour: 0 });
  const tarmac = c.mapped('lock:tarmac', kit.tex.carpet('#58595c'));
  tarmac.grid([-W / 2 + 0.5, 0.012, -D / 2 + 0.5], [0, 0, 1], [1, 0, 0], [0, D - 1], [0, W - 1], (u, v) => [v / 0.8, u / 0.8]);
  const nums = kit.tex.custom('lock:nums:' + p.nums.join(), 32 * 8, 16, (g) => { p.nums.forEach((n, i) => { P(g, '#1d1c1a', i * 32, 0, 32, 16); garble(g, String(n), i * 32, 0, 32, 16, { color: '#e8d9a0', size: 12, mess: 0.45 }, n + i); }); }, { clamp: true }), numB = c.mapped('lock:nums', nums);
  const living = [];
  const bays = p.bays || p.empty.map(() => 'picture');   // (what is behind each door, rolled: an old roll knows only which were pictures)
  /* a lock-up: its two side walls of block, a lintel over the door to the roof, a concrete floor; the door at its front */
  const lockup = (side, at, w, inside, back = true) => {
    const a = at - w / 2, b = at + w / 2;
    for (const [s0, s1] of [[a - K.post, a], [b, b + K.post]]) { wallBox(c, side, s0, s1, 0, H, 0, K.depth + 0.06, BLOCK); const q0 = c.wallAt(side, s0, 0), q1 = c.wallAt(side, s1, K.depth + 0.06); c.solid(Math.min(q0.x, q1.x), Math.min(q0.z, q1.z), Math.max(q0.x, q1.x), Math.max(q0.z, q1.z), { tall: true }); }
    wallBox(c, side, a - K.post, b + K.post, 2.1, H, K.depth - 0.04, K.depth + 0.06, BLOCK); wallBox(c, side, a - K.post, b + K.post, 2.08, 2.12, K.depth + 0.06, K.depth + 0.1, CONC);
    if (inside) { wallBox(c, side, a, b, 0, 0.02, 0, K.depth, CONC); if (back) wallBox(c, side, a, b, 0.02, H, 0, 0.02, BLOCK.map((v) => v * 0.9)); }   // its floor; its back wall, block, over the painted sky
  };
  // (no two lock-ups may stand in the same floor: where one along a side wall meets one along the end, the second stays a door in the wall)
  const taken = [], rectOf = (side, at, w) => { const q0 = c.wallAt(side, at - w / 2 - K.post - 0.05, 0), q1 = c.wallAt(side, at + w / 2 + K.post + 0.05, K.depth + 0.15); return [Math.min(q0.x, q1.x), Math.min(q0.z, q1.z), Math.max(q0.x, q1.x), Math.max(q0.z, q1.z)]; };
  const free = (r) => !taken.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
  /* where the room has a way out in one of the lock-up walls, a roller in front of that too, which goes up as you come to it */
  if (p.through) for (const d of room.doors) {
    if (!['left', 'back', 'right'].includes(d.side)) continue;
    const w = Math.max(1.3, (d.w || 1) + 0.3), at = d.c, r = rectOf(d.side, at, w); if (!free(r)) continue; taken.push(r); lockup(d.side, at, w, true, false);   // (no back: the doorway is its back)
   
    roller(c, d.side, at, { depth: K.depth, w, auto: true }); c.rt.through = { side: d.side, at };
    const lq = c.wallAt(d.side, at, 1.2); c.light(lq.x, 2.0, lq.z, '#ffe9c2', 0.3, { k: 1.6, far: 3 });
    break;
  }
  let k = 0;
  for (const side of ['left', 'back', 'right']) for (const [a, b] of c.spans(side, 0.5, 2.4)) for (let at = a + 1.5; at + 1.5 <= b && k < 8; at += 3.1, k++) {
    let kind = bays[k] || 'wall'; const r = rectOf(side, at, K.w); if (kind !== 'wall' && kind !== 'picture' && !free(r)) kind = 'wall';
    const deep = kind !== 'wall' && kind !== 'picture'; if (deep) taken.push(r);
    if (deep) lockup(side, at, K.w, true);
    const it = roller(c, side, at, { garage: kind === 'picture', depth: deep ? K.depth : 0, solid: deep, onOpen: () => opened(kind, side, at) });
    void it;
    c.hang(numB, side, at, 2.34, 0.5, 0.25, [[k / 8, 0], [(k + 1) / 8, 0], [(k + 1) / 8, 1], [k / 8, 1]], undefined, deep ? K.depth + 0.11 : 0.07);
    const f = c.wallAt(side, at, (deep ? K.depth : 0) + 1.4); c.blot(f.x, f.z, 1.2, 0.9, { rgb: [0.02, 0.02, 0.02], a: 0.5 });
    if (deep) fill(kind, side, at, k);
  }
  c.leave('opener', R.range(-0.5, 0.5), 0.4, { y: 0 });

  /* what is in them */
  function fill(kind, side, at, n) {
    const mid = c.wallAt(side, at, K.depth / 2), back = c.wallAt(side, at, 0.3), face = Math.atan2(mid.n[0], mid.n[2]);
    const bulb = c.wallAt(side, at, K.depth / 2); c.flat.box(bulb.x - 0.04, H - 0.18, bulb.z - 0.04, bulb.x + 0.04, H - 0.1, bulb.z + 0.04, [0.95, 0.93, 0.85]);
    if (kind === 'store') {
      c.model('lock:store:' + (n % 5), storeVox(n), back.x, back.z, { rot: face, solid: false, shadow: false });
      const q0 = c.wallAt(side, at - 0.9, 0), q1 = c.wallAt(side, at + 0.9, 0.5); c.solid(Math.min(q0.x, q1.x), Math.min(q0.z, q1.z), Math.max(q0.x, q1.x), Math.max(q0.z, q1.z), { tall: true });
      if (p.items?.includes(n)) { const q = c.wallAt(side, at + R.range(-0.6, 0.6), 1.3); c.leave(R.pick(['battery', 'snack', 'torch', 'bandage']), q.x, q.z, { y: 0 }); }
      c.light(bulb.x, H - 0.3, bulb.z, '#ffd9a0', 0.28, { k: 1.8, far: 2.6 });
    } else if (kind === 'car') {
      const q = c.wallAt(side, at, K.depth / 2 + 0.05), paint = ['#9a8a66', '#7d2a22', '#3f5f8a', '#5f7f5a'][n % 4];
      c.model('lock:car:' + paint, () => carVox(paint, false)().downsample(2), q.x, q.z, { rot: face + Math.PI / 2, scale: 1.04, solid: false, shadow: false });   // (nose to the back wall; exactly the size of the lock-up: at half its size, half as many voxels, each the usual 2.5 cm)
      const q0 = c.wallAt(side, at - 0.55, 0.15), q1 = c.wallAt(side, at + 0.55, K.depth - 0.15); c.solid(Math.min(q0.x, q1.x), Math.min(q0.z, q1.z), Math.max(q0.x, q1.x), Math.max(q0.z, q1.z), { tall: false });
      c.light(bulb.x, H - 0.3, bulb.z, '#ffd9a0', 0.22, { k: 1.8, far: 2.6 });
    } else if (kind === 'living') {
      // somebody who had to leave the woods, and lives here now: a bed of sacking, a tin, and them, breathing, who look up when the door does
      const q = c.wallAt(side, at + 0.2, 0.8); wallBox(c, side, at - 0.6, at + 0.8, 0.02, 0.07, 0.3, 1.3, [0.48, 0.38, 0.24]); c.flat.box(q.x + 0.5, 0.02, q.z - 0.08, q.x + 0.62, 0.14, q.z + 0.04, [0.6, 0.62, 0.64]);
      const b = new Batch(true); b.addVox(kit.model('lock:fox', sadFoxVox()).solid, new THREE.Matrix4().makeScale(kit.VOXEL, kit.VOXEL, kit.VOXEL));
      const geo = kit.geometry(b, [lamp(0, 2.4, 1, [0.7, 0.62, 0.5], { k: 4, wrap: 0.5, far: 30 })], [0.2, 0.19, 0.2]);
      const who = new THREE.Mesh(geo, kit.surface({ vox: true })), g = new THREE.Group(); g.add(who); g.position.set(q.x, 0.06, q.z); g.rotation.y = face + R.range(-0.6, 0.6); c.add(g);
      living.push({ g, who, side, at, look: 0 });
    }
  }
  function opened(kind, side, at) {
    if (kind !== 'living') return; const l = living.find((q) => q.side === side && q.at === at); if (!l) return; l.look = 0.001; const w = c.toWorld(l.g.position.x, l.g.position.z); c.env.play?.('rustle', w.x, w.z, 7);
  }
  if (living.length) c.tick((dt, t) => { for (const l of living) { l.who.scale.y = 1 + Math.sin(t * 1.6) * 0.025; if (l.look > 0 && l.look < 1) { l.look = Math.min(1, l.look + dt * 1.5); l.who.rotation.x = -0.18 * Math.sin(Math.PI * Math.min(1, l.look) * 0.5); } } });
  void H;
}
