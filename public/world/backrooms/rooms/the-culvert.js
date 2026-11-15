// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The
// Culvert ("the ditch with the hoardings beside it"). A storm drain cut right
// across the lawn, too wide to step over, and it has no bottom: concrete
// going down into the dark, a trolley jammed across it a little way in. It
// is a real hole (rt.floorY), and nothing is in the way of it. Whoever walks
// to the very edge goes in, and that is the end of the visit. (The owner, of
// a version with a ramp at each end: "too ADA nice for backrooms… an endless
// pit that allows players to fall to their death".)
//
// The one way over: the hoardings stood near the edge are loose
// (movable-cutout.js: timber rails on the back, E to take hold, R to let one
// down), and a tall one let down across the ditch is a bridge, with an edge
// either side of it like any other. One on this bank is sawn too short. One
// stands on the far bank, for coming back.
//
// Nobody has to cross: every doorway is on the near bank. What is over there
// is whatever the seed hid, and a remote. With the moving of furniture
// switched off, or in a shared visit (where a moved panel is not yet
// everybody's), there is no way over, and nothing is lost but those.
// Every flat in this room is the loose kind: none goes over when leant on
// (suburb.js fallingFlat), since two rules for one look in one room is one too many.
import { ticks } from '../kit.js';
import { Vox, M } from '../../vox/vox.js';
import { lawn, daylight } from '../suburb.js';
import { movableCutout } from '../movable-cutout.js';

// near: where the near edge is (the doorways are at 0) · deep: how far down the hole is to whoever walks (far enough) · seen: how far down it is drawn
// brink: how close to the edge the bank gives way · side: the same, off the side of a hoarding that is down · falls: seconds of it
export const CULVERT = Object.freeze({ wide: 2.0, near: -1.3, deep: 40, seen: 11, panel: 3.1, brink: 0.3, side: 0.2, falls: 1.7 });

/** A shopping trolley, on its side, a long way down. */
function trolleyVox() { const v = new Vox(), k = M('#8d949c', 0); for (let x = -12; x <= 12; x += 3) { v.tube(x, 4, -8, x, 4, 8, 0.5, k); v.tube(x, 4, 8, x, 18, 8, 0.5, k); } for (let z = -8; z <= 8; z += 4) v.tube(-12, 4, z, 12, 4, z, 0.5, k); for (let y = 8; y <= 18; y += 5) v.tube(-12, y, 8, 12, y, 8, 0.5, k); v.tube(-12, 18, 8, -14, 22, 12, 0.8, M('#b3261e', 0)); v.tube(-14, 22, 12, 14, 22, 12, 0.8, M('#b3261e', 0)); for (const x of [-11, 11]) v.cyl('x', 1.6, -8, x - 0.6, x + 0.6, 1.8, M('#17171a', 0)); return v; }

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = CULVERT, s = p.side;
  const z1 = K.near, z0 = z1 - K.wide;                                          // the ditch is from z0 to z1 (the doorways are at 0 and beyond); the far bank beyond z0
  c.shell({ floor: false, panels: false });
  daylight(c, 3, 3, 1, 1);
  // the hole, as whoever walks here has it. (While somebody is going down it, the whole room is as deep as they have got: cubicle-grid's way.)
  let fall = null;
  c.rt.floorY = (x, z) => (fall ? fall.y : z <= z0 || z >= z1 ? 0 : -K.deep);
  c.rt.headY = (x, z) => H - c.rt.floorY(x, z);
  // the lawn, either side, and the ditch between: poured concrete, darker the further down, and then nothing
  const turf = c.floor, bank = (a, b) => turf.grid([-W / 2, 0, a], [0, 0, 1], [1, 0, 0], ticks(b - a), ticks(W), (u, v) => [(-W / 2 + v + c.room.cx) / 1.6, (a + u + c.room.cz) / 1.6]);
  bank(-D / 2, z0); bank(z1, D / 2);
  const conc = c.mapped('culvert:concrete', kit.tex.carpet('#7a7b78')), dark = [0.5, 0.5, 0.5], shade = (u, v) => Math.max(0, 1 - (K.seen - v) / (K.seen * 0.8)) ** 2;
  conc.grid([-W / 2, -K.seen, z0], [1, 0, 0], [0, 1, 0], ticks(W), ticks(K.seen, 0.8, 0), (u, v) => [u / 0.8, v / 0.8], dark, shade);
  conc.grid([W / 2, -K.seen, z1], [-1, 0, 0], [0, 1, 0], ticks(W), ticks(K.seen, 0.8, 0), (u, v) => [u / 0.8, v / 0.8], dark, shade);
  conc.grid([-W / 2, -K.seen, z1], [0, 0, -1], [0, 1, 0], ticks(K.wide), ticks(K.seen, 0.8, 0), (u, v) => [u / 0.8, v / 0.8], dark, shade);   // the ends of it, under the walls
  conc.grid([W / 2, -K.seen, z0], [0, 0, 1], [0, 1, 0], ticks(K.wide), ticks(K.seen, 0.8, 0), (u, v) => [u / 0.8, v / 0.8], dark, shade);
  c.flat.box(-W / 2, -K.seen - 0.1, z0, W / 2, -K.seen, z1, [0, 0, 0]);
  for (const z of [z0, z1]) c.flat.box(-W / 2, 0, z - 0.06, W / 2, 0.05, z + 0.06, [0.62, 0.61, 0.57]);
  // a trolley, jammed across it a little way down, and one further, hardly to be seen
  c.model('culvert:trolley', trolleyVox, s * R.range(1.5, W / 2 - 1.5), (z0 + z1) / 2, { y: -2.2, rot: 0.2, tilt: [0.5, 1.4], scale: 1.9, solid: false, shadow: false });
  c.model('culvert:trolley', trolleyVox, -s * R.range(1, W / 2 - 1.5), (z0 + z1) / 2, { y: -5.6, rot: 1.9, tilt: [-0.4, 1.2], scale: 1.9, solid: false, shadow: false });
  lawn(c, { wrong: 0, paint: 'corn', width: 0.4, cloudTop: H - 0.7, neighbour: 0 });

  /* the hoardings: loose, each stood back from the edge so that it has to be walked up to it before it will reach */
  const back = 0.9, edge = 0.5, order = R.shuffle([-1, 1]);
  const tall = movableCutout(c, { x: order[0] * 1.5, z: z1 + back, height: K.panel, facing: 2, front: 'streetB', label: 'Hoarding' });
  movableCutout(c, { x: order[1] * 1.5, z: z1 + back, height: 1.3, facing: 2, front: 'streetA', label: 'Hoarding, sawn short' });
  const far = movableCutout(c, { x: order[1] * 1.2, z: z0 - back, height: K.panel, facing: 0, front: 'streetC', label: 'Hoarding' });
  if (tall) c.bridgeRoute(tall, { stand: { x: order[0] * 1.5, z: z1 + back + 0.75 }, path: [{ x: order[0] * 1.5, z: z1 + edge }] });
  if (far) c.bridgeRoute(far, { stand: { x: order[1] * 1.2, z: z0 - back - 0.75 }, path: [{ x: order[1] * 1.2, z: z0 - edge }] });
  // what is over there
  c.leave('opener', s * (W / 2 - 2.6), -D / 2 + 1.0, { y: 0 });

  /* going in. The floor as it is now (the building's: a hoarding let down is floor) is what counts, not where the ditch was dug */
  const env = c.env, open = (x, z) => { const q = c.toWorld(x, z); return env.world.floorY(q.x, q.z) < -1; };
  c.tick((dt, t, me) => {
    if (fall) {
      fall.t += dt; fall.y = Math.max(-80, -0.5 * 9.8 * fall.t * fall.t); fall.z += ((z0 + z1) / 2 - fall.z) * Math.min(1, dt * 3);
      const q = c.toWorld(fall.x, fall.z); env.player?.warp?.(q.x, q.z);
      const eye = env.player?.me; if (eye) eye.pitch = Math.min(0.95, eye.pitch + dt * 1.3);                           // the strip of ceiling, getting narrower
      env.red?.(Math.min(0.9, fall.t * 0.5)); env.interfere?.(0.3 + 0.5 * Math.min(1, fall.t / K.falls));
      if (fall.t >= K.falls && !fall.over) { fall.over = true; env.hold?.(false); env.end?.('caught'); if (env.difficulty?.() === 'tourist') fall = null; }
      return;
    }
    if (!me.inside || env.player?.me?.frozen) return;
    // the bank ends where it ends: within a step of the brink with nothing let down in front, and the grass is not there to stand on.
    // On a hoarding that is down: the same, off either side of it.
    const over = me.z > z0 && me.z < z1;
    const gone = over ? open(me.x, me.z) || open(me.x - K.side, me.z) || open(me.x + K.side, me.z)
      : (me.z >= z1 && me.z < z1 + K.brink && open(me.x, z1 - 0.15)) || (me.z <= z0 && me.z > z0 - K.brink && open(me.x, z0 + 0.15));
    if (gone) { fall = { x: me.x, z: me.z, y: 0, t: 0 }; env.hold?.(true); env.run?.met?.('the-culvert'); const q = c.toWorld(me.x, me.z); env.play?.('rattle', q.x, q.z, 6); }
  });
}
