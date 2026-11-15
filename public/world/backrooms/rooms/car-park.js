// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Car
// Park ("the car park with one car in it"). Bays painted on tarmac that was
// laid over the grass, lamp posts that go up through the ceiling, and a car in
// most of the bays. All but one of them are a car's side, cut out of board and
// painted afterwards: stand against the back of one and it goes over. The one
// that is a car has its lamps on and its door open.
//
// It is meant to be this floor's own way down (you get in; it goes down
// through the tarmac with you in it), which is seam.js's to do. Until then E
// at the car only has it answer.
import { Batch, drawText, ticks, WHITE } from '../kit.js';
import { goesDown } from '../seam.js';
import { P } from '../bits.js';
import { lawn, fallingFlat, brace, beam, car, daylight, WHITEWASH } from '../suburb.js';

export function build(c) {
  const { W, D, H, R, params: p, kit } = c;
  c.shell({ panels: false });
  daylight(c, 4, 3, 1, 1);
  lawn(c, { wrong: 0, paint: 'mall', width: 0.4, cloudTop: H - 0.8, neighbour: 0 });
  const x0 = -W / 2 + 1.5, x1 = W / 2 - 1.5, z0 = -D / 2 + 1.5, z1 = D / 2 - 1.5;
  c.mapped('park:tarmac', kit.tex.carpet('#58595c')).grid([x0, 0.012, z0], [0, 0, 1], [1, 0, 0], ticks(z1 - z0), ticks(x1 - x0), (u, v) => [(x0 + v) / 0.8, (z0 + u) / 0.8]);
  // two rows of bays, nose to the lane down the middle
  const bw = 2.7, n = Math.floor((x1 - x0 - 0.6) / bw), bx = (i) => -(n * bw) / 2 + (i + 0.5) * bw, rows = [[z0 + 0.3, z0 + 4.6], [z1 - 4.6, z1 - 0.3]];
  for (const [a, b] of rows) for (let i = 0; i <= n; i++) c.flat.box(bx(i) - bw / 2 - 0.05, 0.013, a, bx(i) - bw / 2 + 0.05, 0.016, b, WHITEWASH);
  const real = p.real % (n * 2), tints = [[0.75, 0.2, 0.18], [0.25, 0.4, 0.7], [0.85, 0.82, 0.75], [0.3, 0.5, 0.35], [0.8, 0.65, 0.25], [0.35, 0.35, 0.4]];
  let k = 0, spot = null;
  for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++, k++) {
    const x = bx(i), z = (rows[r][0] + rows[r][1]) / 2;
    if (k === real) { spot = { x, z }; continue; }
    if (p.empty.includes(k)) continue;
    // a car's side, standing where a car would, held up from behind
    const fx = x + (r ? 0.5 : -0.5), face = r ? 1 : -1;
    if (face > 0) fallingFlat(c, fx, z + 1.35, fx, z - 1.35, 'carSide', { h: 1.1, alb: tints[k % tints.length] }); else fallingFlat(c, fx, z - 1.35, fx, z + 1.35, 'carSide', { h: 1.1, alb: tints[k % tints.length] });
    brace(c, fx - face * 0.02, z, -face, 0, 0.6, 0.8);
  }
  if (spot) {
    // (in a batch of its own, so that it can go)
    const b = new Batch(true); car(c, spot.x, spot.z, false, '#9a8a66', 0, b, { door: true });                                      // its driver's door open
    const body = c.dynamic(b, { pivot: [spot.x, 0, spot.z] }), w = c.toWorld(spot.x, spot.z), SINK = 2.6;
    // Get in, and it goes down through the tarmac with you in it: a second way down from this part, where there is a part
    // below (index.js `descend`). On the last part, and for anybody it will not take, it is a car: it answers and stays.
    let going = 0;
    c.use({ x: spot.x - 1.3, z: spot.z + 0.3, r: 1.6, label: 'get in', when: () => !going, use: () => {
      c.env.play?.('shuffle', w.x, w.z, 8); c.env.interfere?.(0.5);
      if (goesDown(c.level.exit.way) && c.env.hold && c.env.descend) { c.env.hold(true); going = 0.001; }
    } });
    c.tick((dt, t, me) => {
      if (!going || going >= SINK + 1) return;
      going += dt; const k = Math.min(1, going / SINK);
      body.position.y = -1.7 * k * k; body.rotation.x = 0.06 * Math.sin(going * 9) * (1 - k);
      if (me.world) me.world.sinkTo = 1.1 * k;
      c.env.interfere?.(0.3 + 0.6 * k);
      if (going >= SINK) { going = SINK + 1; if (!c.env.descend({ x: w.x, z: w.z })) { body.position.y = 0; going = 0; } c.env.hold(false); }
    });
  }
  // lamp posts: timber, and they go on up
  for (const [x, z] of [[x0 + 0.4, 0], [x1 - 0.4, 0]]) { beam(c.flat, [x, 0, z], [x, H, z], 0.12); c.hole(x - 0.3, z - 0.3); c.solid(x - 0.08, z - 0.08, x + 0.08, z + 0.08); c.flat.box(x - 0.5, 2.45, z - 0.12, x + 0.5, 2.55, z + 0.12, [0.74, 0.6, 0.4]); }
  // somewhere to pay
  { const mx = x1 - 0.5, mz = z1 - 0.2, tex = kit.tex.custom('park:pay:' + p.pay.join('|'), 64, 64, (g, w, h) => { P(g, '#f2c230', 0, 0, w, h); P(g, '#1d1c1a', 4, 4, w - 8, 18); drawText(g, [p.pay[0]], 4, 4, w - 8, 18, { color: '#f2c230', size: 11 }); drawText(g, p.pay.slice(1), 2, 24, w - 4, h - 26, { color: '#1d1c1a', size: 8, pad: 6 }); }, { clamp: true });
    c.flat.box(mx - 0.25, 0, mz - 0.18, mx + 0.25, 1.5, mz + 0.18, [0.25, 0.27, 0.3], { skip: '-y' });
    c.mapped('park:pay', tex).quad([mx + 0.2, 0.85, mz - 0.185], [mx - 0.2, 0.85, mz - 0.185], [mx - 0.2, 1.4, mz - 0.185], [mx + 0.2, 1.4, mz - 0.185], WHITE);
    c.solid(mx - 0.25, mz - 0.18, mx + 0.25, mz + 0.18);
    c.leave('opener', mx - 0.6, mz - 0.1, { y: 0 }); }
  void R;
}
