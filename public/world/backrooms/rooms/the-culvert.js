// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The
// Culvert ("the ditch with the hoardings beside it"). A storm drain cut right
// across the lawn, too wide to step over and a long way down: a trolley at
// the bottom of it, and something that glints. On this side of it, three
// hoardings on the edge. Lean on the back of a prop and it goes over (the
// floor's own rule: suburb.js fallingFlat). One of these, gone over, reaches
// the other side. One is too short. One is the wrong way round.
//
// Nobody has to cross: every doorway is on the near side. What is over there
// is whatever the seed hid, and a remote.
import { ticks } from '../kit.js';
import { Vox, M } from '../../vox/vox.js';
import { lawn, fallingFlat, brace, daylight } from '../suburb.js';

export const CULVERT = Object.freeze({ wide: 2.0, deep: 3.2, far: 3.6 });

/** A shopping trolley, on its side, a long way down. */
function trolleyVox() { const v = new Vox(), k = M('#8d949c', 0); for (let x = -12; x <= 12; x += 3) { v.tube(x, 4, -8, x, 4, 8, 0.5, k); v.tube(x, 4, 8, x, 18, 8, 0.5, k); } for (let z = -8; z <= 8; z += 4) v.tube(-12, 4, z, 12, 4, z, 0.5, k); for (let y = 8; y <= 18; y += 5) v.tube(-12, y, 8, 12, y, 8, 0.5, k); v.tube(-12, 18, 8, -14, 22, 12, 0.8, M('#b3261e', 0)); v.tube(-14, 22, 12, 14, 22, 12, 0.8, M('#b3261e', 0)); for (const x of [-11, 11]) v.cyl('x', 1.6, -8, x - 0.6, x + 0.6, 1.8, M('#17171a', 0)); return v; }

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = CULVERT;
  const z1 = -D / 2 + K.far + K.wide, z0 = -D / 2 + K.far;                  // the ditch is from z0 to z1; the far bank beyond z0
  c.shell({ floor: false, panels: false });
  daylight(c, 3, 3, 1, 1);
  // the lawn, either side, and the ditch between: poured concrete, wet at the bottom
  const turf = c.floor, bank = (a, b) => turf.grid([-W / 2, 0, a], [0, 0, 1], [1, 0, 0], ticks(b - a), ticks(W), (u, v) => [(-W / 2 + v + c.room.cx) / 1.6, (a + u + c.room.cz) / 1.6]);
  bank(-D / 2, z0); bank(z1, D / 2);
  const conc = c.mapped('culvert:concrete', kit.tex.carpet('#7a7b78')), dark = [0.5, 0.5, 0.5];
  conc.grid([-W / 2, -K.deep, z0], [0, 0, 1], [1, 0, 0], ticks(K.wide), ticks(W), (u, v) => [v / 0.8, u / 0.8], [0.28, 0.3, 0.3]);
  conc.grid([-W / 2, -K.deep, z0], [1, 0, 0], [0, 1, 0], ticks(W), ticks(K.deep, 0.8, 0), (u, v) => [u / 0.8, v / 0.8], dark, (u, v) => 0.35 + 0.65 * (v / K.deep));
  conc.grid([W / 2, -K.deep, z1], [-1, 0, 0], [0, 1, 0], ticks(W), ticks(K.deep, 0.8, 0), (u, v) => [u / 0.8, v / 0.8], dark, (u, v) => 0.35 + 0.65 * (v / K.deep));
  for (const z of [z0, z1]) c.flat.box(-W / 2, 0, z - 0.06, W / 2, 0.05, z + 0.06, [0.62, 0.61, 0.57]);
  c.model('culvert:trolley', trolleyVox, R.range(-2, 2), z0 + 1.0, { y: -K.deep, rot: 0.6, tilt: [0, 1.4], solid: false, shadow: false });
  for (let i = 0; i < 5; i++) c.flat.box(R.range(-W / 2 + 1, W / 2 - 1), -K.deep, z0 + R.range(0.2, 1.6), R.range(-W / 2 + 1, W / 2 - 1) + 0.2, -K.deep + 0.04, z0 + R.range(0.2, 1.6) + 0.3, [0.8, 0.78, 0.7]);
  lawn(c, { wrong: 0, paint: 'corn', width: 0.4, cloudTop: H - 0.7, neighbour: 0 });

  /* three hoardings on the near edge. (a flat goes over onto its painted side: so the one that will bridge has its back to you) */
  const xs = [-W / 4, 0, W / 4].map((x, i) => x + (i - 1) * 0.3), order = R.shuffle([0, 1, 2]), zf = z1 + 0.1, bridges = [];
  const walls = [];                                                           // what stops you walking into the ditch, in pieces, so that a piece can go
  const bridgeAt = xs[order[0]], half = 0.61;
  for (const [a, b] of [[-W / 2, bridgeAt - half], [bridgeAt + half, W / 2]]) { c.solid(a, z1 - 0.12, b, z1 + 0.02, { keep: true }); c.solid(a, z0 - 0.02, b, z0 + 0.12, { keep: true }); }
  const gap = [c.solid(bridgeAt - half, z1 - 0.12, bridgeAt + half, z1 + 0.02, { keep: true }), c.solid(bridgeAt - half, z0 - 0.02, bridgeAt + half, z0 + 0.12, { keep: true })];
  order.forEach((which, n) => {
    const x = xs[which];
    if (n === 0) { const st = fallingFlat(c, x + half, zf, x - half, zf, 'streetB', { h: 2.44 }); bridges.push(st); }                                  // faces the ditch: lean on its back and it is a bridge
    else if (n === 1) fallingFlat(c, x + half, zf, x - half, zf, 'streetA', { h: 1.3, full: 2.44 });                                                   // the same, sawn short: it goes over, and does not reach
    else { fallingFlat(c, x - half, zf + 0.5, x + half, zf + 0.5, 'streetC', { h: 2.44 }); brace(c, x, zf + 0.5 - 0.02, 0, -1, 0.42, 1.5); }          // the wrong way round: it shudders, and stays
  });
  walls.push(...gap);
  c.tick(() => { if (bridges[0] && bridges[0].down && gap[0].on) for (const g of gap) g.on = false; });
  // what is over there
  c.leave('opener', p.side * (W / 2 - 1.6), -D / 2 + 1.2, { y: 0 });
  void walls;
}
