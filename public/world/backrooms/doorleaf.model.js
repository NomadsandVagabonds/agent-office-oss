// The Backrooms — a fire door's leaf, sculpted. Pure: voxels in, voxels out.
// One leaf of a pair: a painted slab with a raised frame and two sunk panels,
// a steel kick plate with its screws, a narrow wired window by the meeting
// edge, a plate where the hand goes on the side you push and a bar on the side
// you pull, a lock, three hinges and a closer at the head. Scuffed where feet
// and trolleys have been. x runs from the hinge to the meeting edge, y up,
// z through the leaf: +z is the face you push, −z the face you pull.
import { Vox, M, tone, noise3 } from '../vox/vox.js';

export const LEAF = Object.freeze({
  voxel: 0.015,      // metres per voxel: fine enough for a screw head
  core: 3,           // the slab, voxels thick (the relief stands one proud of it on either face)
  window: 0.72,      // a leaf narrower than this, metres, has no window: there is not the room beside the sign
});

const STEEL = '#8a8d8b', STEEL_DARK = '#5b5e5d', BLACK = '#1b1c1e', PANE = '#22323a', WIRE = '#34474f', BRASS = '#9a8448';

/** How many voxels a leaf of these metres is. */
export const leafSize = (w, h) => ({ W: Math.max(24, Math.round(w / LEAF.voxel)), H: Math.max(60, Math.round(h / LEAF.voxel)) });

/**
 * @param {{w:number, h:number, colour:string, hatch?:number[], bar?:boolean}} o  metres across and high, and the door's colour ·
 *        hatch [x0, x1, y0, y1] (metres from the hinge and the floor): in place of the slit, an opening right through the leaf
 *        with a pale bezel and wire bars, that can be seen through · bar: a bar to push right across both faces, in place
 *        of the plate and the pull ('push': on the push face only, and the pull stays on the other)
 * @returns {Vox}
 */
export function leafVox({ w, h, colour, hatch = null, bar = false }) {
  const { W, H } = leafSize(w, h), v = new Vox(), T = LEAF.core;
  const paint = M(colour, 1), rail = M(tone(colour, 0.07), 1), sunk = M(tone(colour, -0.06), 1), worn = M(tone(colour, -0.2), 2), bare = M('#6d6557', 2);
  const steel = M(STEEL, 0), steelD = M(STEEL_DARK, 0), scuff = M('#777a78', 0), black = M(BLACK, 0), brass = M(BRASS, 0);
  // (inclusive at both ends, which is how a joiner thinks; Vox's own boxes stop one short)
  const B = (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c), K = (x0, y0, z0, x1, y1, z1) => v.carve(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1), P = (x0, y0, z0, x1, y1, z1, c) => v.paint(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);
  const hasWindow = w >= LEAF.window;
  const y = (m) => Math.round(m / LEAF.voxel);
  const kick = y(0.27), lock0 = y(0.94), lock1 = y(1.08), stile = 6, head = 7;

  B(0, 0, 0, W - 1, H - 1, T - 1, paint);
  // the frame stands proud on both faces: two stiles, a head rail, a lock rail, a bottom rail (under the plate)
  for (const z of [-1, T]) {
    B(0, 0, z, stile - 1, H - 1, z, rail); B(W - stile, 0, z, W - 1, H - 1, z, rail);
    B(0, H - head, z, W - 1, H - 1, z, rail); B(0, lock0, z, W - 1, lock1, z, rail); B(0, 0, z, W - 1, kick + 2, z, rail);
  }
  // the panels between are the slab itself, a shade darker, with a bead round each
  for (const z of [0, T - 1]) for (const [y0, y1] of [[kick + 3, lock0 - 1], [lock1 + 1, H - head - 1]]) {
    P(stile, y0, z, W - stile - 1, y1, z, sunk);
    for (let x = stile; x < W - stile; x++) { v.set(x, y0, z, worn); v.set(x, y1, z, rail); }
    for (let yy = y0; yy <= y1; yy++) { v.set(stile, yy, z, worn); v.set(W - stile - 1, yy, z, rail); }
  }

  // the kick plate, either face: steel, a screw in each corner and one mid-way, and the marks of what has hit it
  for (const z of [-1, T]) {
    B(2, 2, z, W - 3, kick, z, steel);
    for (const [sx, sy] of [[4, 4], [W - 5, 4], [4, kick - 2], [W - 5, kick - 2], [W >> 1, 4], [W >> 1, kick - 2]]) v.set(sx, sy, z, steelD);
    for (let x = 3; x < W - 3; x++) for (let yy = 3; yy < kick; yy++) {
      // scratches run along it, low down, where the trolleys go; a dent or two above
      if (yy < kick - 3 && noise3(Math.floor(x / 9), yy, z, 7) > (yy < 9 ? 0.86 : 0.97)) v.set(x, yy, z, scuff);
    }
  }
  // paint gone at the foot of the meeting edge and along the bottom, where it catches
  for (let x = 0; x < W; x++) for (let yy = 0; yy < 5; yy++) for (const z of [-1, T]) if (v.has(x, yy, z) && noise3(Math.floor(x / 5), yy >> 1, z, 3) > 0.84) v.set(x, yy, z, bare);
  for (let yy = kick + 3; yy < lock1 + 30; yy++) for (const z of [-1, T]) for (let x = W - 3; x < W; x++) if (noise3(1, Math.floor(yy / 4), z, 11) > 0.86) v.set(x, yy, z, worn);

  // the window: a slit of wired glass in a dark steel frame, both faces (the pane does not see through: a shut door is a wall)
  if (hasWindow && !hatch) {
    const x0 = W - stile - 11, x1 = W - stile - 3, y0 = y(1.36), y1 = Math.min(H - head - 4, y(1.82));
    B(x0 - 1, y0 - 1, -1, x1 + 1, y1 + 1, T, black);
    K(x0, y0, -1, x1, y1, -1); K(x0, y0, T, x1, y1, T);
    B(x0, y0, 0, x1, y1, T - 1, M(PANE, 0));
    for (let x = x0; x <= x1; x++) for (let yy = y0; yy <= y1; yy++) if ((x - x0) % 4 === 2 || (yy - y0) % 5 === 2) { v.set(x, yy, 0, M(WIRE, 0)); v.set(x, yy, T - 1, M(WIRE, 0)); }
  }

  // the side you push: a plate for the hand, worn bright in the middle
  if (!bar) {
    const x0 = W - stile - 9, x1 = W - stile - 1, y0 = y(1.0), y1 = y(1.3);
    B(x0, y0, T, x1, y1, T, steel);
    for (const [sx, sy] of [[x0 + 1, y0 + 1], [x1 - 1, y0 + 1], [x0 + 1, y1 - 1], [x1 - 1, y1 - 1]]) v.set(sx, sy, T, steelD);
    B(x0 + 3, y0 + 6, T, x1 - 3, y1 - 6, T, M('#a3a6a3', 0));
  }
  // the side you pull: a bar on two posts, on a back plate
  if (bar !== true) {
    const x0 = W - stile - 7, x1 = W - stile - 2, y0 = y(0.92), y1 = y(1.3), bx = W - stile - 5;
    B(x0, y0, -1, x1, y1, -1, steel);
    for (const yy of [y0 + 3, y1 - 3]) B(bx, yy - 1, -4, bx + 1, yy, -2, steelD);
    B(bx, y0 + 1, -5, bx + 1, y1 - 1, -4, steel);
  }
  // the hatch: cut right through, a pale bezel standing proud of both faces, and three wires each way in the middle of the leaf
  if (hatch) {
    const x0 = Math.round(hatch[0] / (w / W)), x1 = Math.round(hatch[1] / (w / W)) - 1, y0 = y(hatch[2]), y1 = y(hatch[3]) - 1, bezel = M('#d8d2c2', 0), wire = M('#25282c', 0), mid = T >> 1;
    B(x0 - 2, y0 - 2, -2, x1 + 2, y1 + 2, T + 1, bezel); K(x0, y0, -2, x1, y1, T + 1);
    for (const f of [0.25, 0.5, 0.75]) { const bx = Math.round(x0 + (x1 - x0) * f), by = Math.round(y0 + (y1 - y0) * f); B(bx, y0, mid, bx, y1, mid, wire); B(x0, by, mid, x1, by, mid, wire); }
  }
  // the bar: across the leaf at the height of a hand, on a bracket at each end, both faces
  if (bar) for (const [z0, z1, zb] of bar === 'push' ? [[T + 1, T + 3, T]] : [[T + 1, T + 3, T], [-4, -2, -1]]) {
    const by = y(0.89), x0 = Math.round(0.14 / (w / W)), x1 = W - 1 - x0;
    B(x0, by - 1, Math.min(z0, z1), x1, by + 2, Math.max(z0, z1), M('#c2bdae', 0));
    for (const x of [x0, x1 - 2]) B(x, by - 2, Math.min(zb, z0), x + 2, by + 3, Math.max(zb, z0), steelD);
  }
  // the lock, through the lock rail: a brass cylinder either face
  for (const z of [-2, T + 1]) B(W - stile + 1, lock0 + 3, Math.min(z, z < 0 ? -1 : T), W - stile + 3, lock0 + 5, Math.max(z, z < 0 ? -1 : T), brass);
  for (const z of [-2, T + 1]) v.set(W - stile + 2, lock0 + 4, z, black);

  // three hinges on the hanging edge: a leaf screwed to the pull face, the knuckle round the edge
  for (const hy of [y(0.2), H >> 1, H - y(0.22)]) {
    B(0, hy - 4, -1, 3, hy + 4, -1, steel); B(-1, hy - 4, -1, -1, hy + 4, 0, steelD);
    for (const sy of [hy - 3, hy, hy + 3]) v.set(2, sy, -1, steelD);
    v.set(-1, hy - 1, -1, steel); v.set(-1, hy + 2, -1, steel);
  }
  // the closer at the head, on the push face: the body, and the arm folded along the rail
  {
    const y0 = H - head + 1, x0 = 3, x1 = Math.min(W - 4, x0 + 17);
    B(x0, y0, T, x1, y0 + 3, T + 2, M('#3a3c3f', 0)); B(x0, y0, T + 2, x1, y0 + 3, T + 2, M('#4a4d50', 0));
    v.set(x0 + 1, y0 + 1, T + 3, steelD); v.set(x1 - 1, y0 + 2, T + 3, steelD);
    B(x1 + 1, y0 + 4, T, Math.min(W - 2, x1 + 14), y0 + 4, T + 1, steel);
  }
  return v;
}

/** Where the sign goes on a leaf this wide: its middle and half its width, metres from the hinge. Clear of the window. */
export function signSpan(w) {
  const { W } = leafSize(w, 2), sx = w / W, left = 7 * sx, right = (w >= LEAF.window ? W - 20 : W - 7) * sx;
  return { mid: (left + right) / 2, half: Math.max(0.08, Math.min(0.16, (right - left) / 2 - 0.012)) };
}
