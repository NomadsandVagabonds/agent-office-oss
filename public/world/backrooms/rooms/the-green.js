// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Green
// ("the lawn you are not to walk on"). A lawn with a sprinkler head every few
// steps and a path of stones across it. The sprinklers hear. Walk on the
// grass near one and it comes up and goes round, and what it throws is not
// water: the picture tears, and the camcorder's charge goes with it. They do
// not hear the stones, the carpet at the edge, or anybody who is going slowly.
//
// The rule (pure, below). It costs charge, never a heart, and it stops when
// you are off the grass: the room can always be crossed by its stones.
import * as THREE from 'three';
import { P } from '../bits.js';
import { garble, lawn, sprinkler, stone, daylight, WHITEWASH } from '../suburb.js';

export const GREEN = Object.freeze({ hears: 2.7, pace: 1.5, runs: 4, reach: 2.4, arc: 0.45, share: 0.03, every: 0.5, stone: 0.42, edge: 0.5 });
/** Is somebody at (x, z) going `speed` m/s heard by a head at (hx, hz)? Not on a stone (`onStone`), not on the carpet round the edge (`onEdge`), not going slowly. */
export const heard = (x, z, speed, hx, hz, onStone, onEdge) => !onStone && !onEdge && speed > GREEN.pace && Math.hypot(x - hx, z - hz) < GREEN.hears;
/** Does a head at (hx, hz) throwing toward `a` (radians) catch somebody at (x, z)? */
export const caught = (x, z, hx, hz, a) => { const d = Math.hypot(x - hx, z - hz); if (d > GREEN.reach || d < 0.2) return false; let k = Math.atan2(x - hx, z - hz) - a; k = Math.atan2(Math.sin(k), Math.cos(k)); return Math.abs(k) < GREEN.arc; };

export function build(c) {
  const { W, D, H, R, kit } = c;
  c.shell({ panels: false });
  daylight(c, 3, 3, 1, 1);
  lawn(c, { wrong: 0, paint: 'sky', width: GREEN.edge, cloudTop: H - 0.8, neighbour: 0 });
  // the stones: from the door you came in by to the far wall, and a branch to either side
  const stones = [];
  for (let z = D / 2 - 0.9, k = 0; z > -D / 2 + 0.6; z -= 0.8, k++) stones.push([Math.sin(k * 0.9) * 0.9, z]);
  for (let x = 1.2; x < W / 2 - 0.5; x += 0.8) { stones.push([x, Math.sin(x) * 0.5]); stones.push([-x, -Math.sin(x) * 0.5]); }
  stones.forEach(([x, z], k) => stone(c, x, z, k, ((k * 7) % 5 - 2) * 0.12));
  // the notice
  { const s = c.wallSpot(1.4, ['back', 'left', 'right'], 0.5, 2.2); if (s) { const tex = kit.tex.custom('green:sign', 128, 64, (g, w, h) => { P(g, '#1f6b3a', 0, 0, w, h); P(g, '#f4f1e4', 3, 3, w - 6, h - 6); garble(g, 'KEEP OFF', 3, 6, w - 6, 26, { color: '#1f6b3a', size: 20, mess: 0.2 }, 4); garble(g, 'THE THE GRASS', 3, 32, w - 6, 24, { color: '#1f6b3a', size: 14, mess: 0.35 }, 7); }, { clamp: true }); c.hang(c.mapped('green:sign', tex), s.side, s.at, 1.6, 1.2, 0.6); c.wbox(s.side, s.at, 1.26, 1.27, 1.93, 0, 0.01, WHITEWASH); } }
  // the heads
  const mat = kit.own(new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
  const fan = kit.own(new THREE.BufferGeometry()); fan.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.12, 0, -1.0, 0.75, GREEN.reach, 1.0, 0.75, GREEN.reach, 0, 0.12, 0, -0.5, 1.2, GREEN.reach * 0.7, 0.5, 1.2, GREEN.reach * 0.7], 3));
  const heads = [];
  for (let x = -W / 2 + 1.7; x <= W / 2 - 1.7; x += 2.3) for (let z = -D / 2 + 1.7; z <= D / 2 - 1.7; z += 2.3) {
    const hx = x + R.range(-0.3, 0.3), hz = z + R.range(-0.3, 0.3);
    if (stones.some(([sx, sz]) => Math.hypot(sx - hx, sz - hz) < 0.6)) continue;
    sprinkler(c, hx, hz, R.range(0, 6.28));
    const spray = new THREE.Mesh(fan, mat); spray.position.set(hx, 0, hz); spray.visible = false; c.add(spray);
    heads.push({ x: hx, z: hz, spray, on: 0, a: R.range(0, 6.28) });
  }
  let cool = 0;
  c.tick((dt, t, me) => {
    cool = Math.max(0, cool - dt);
    const onStone = stones.some(([sx, sz]) => Math.hypot(sx - me.x, sz - me.z) < GREEN.stone), onEdge = Math.abs(me.x) > W / 2 - GREEN.edge - 0.1 || Math.abs(me.z) > D / 2 - GREEN.edge - 0.1;
    for (const h of heads) {
      if (me.inside && heard(me.x, me.z, me.speed, h.x, h.z, onStone, onEdge)) { if (h.on <= 0) { const w = c.toWorld(h.x, h.z); c.env.play?.('click', w.x, w.z, 6); } h.on = GREEN.runs; }
      if (h.on <= 0) continue;
      h.on -= dt; h.a += dt * 2.6; h.spray.visible = h.on > 0; h.spray.rotation.y = h.a;
      if (me.inside && !cool && caught(me.x, me.z, h.x, h.z, h.a)) { cool = GREEN.every; c.env.camera?.drain?.(GREEN.share); c.env.interfere?.(0.8); }
    }
  });
}
