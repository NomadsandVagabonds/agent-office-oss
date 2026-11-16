// The Backrooms — a room of the shopping centre (themes.js `mall`): Moving
// Stairs ("the hall of moving stairs"). Somebody was told that in a shopping
// centre the stairs move, and that they go everywhere. So a hall was given
// over to them, eight or nine metres of it, and they do go everywhere:
// round in a spiral to the roof, through one another, along the wall, over
// on their backs, in a band with one side. Most of them cannot be got onto.
//
// Two can, and they do move. One goes up to the floor above through a
// covered way; one comes down from it. The one that goes up takes whoever
// stands on it. Whoever walks on it, in the covered part, is no nearer the
// top than they were: it gives them the same stretch again. (Stand, and it
// takes you. Being in a hurry is what keeps you on it.)
import { ticks } from '../kit.js';
import { P } from '../bits.js';
import { upright, sheet } from '../suburb.js';
import { mallNeon, voidIn } from '../mall.js';

// floor: the one above · run: the length of a flight · half: half its width · speed: how fast it carries · cover: how far in from
// each end the covered way starts · again: the stretch it gives back · near: how near the top of the cover that happens
// belts, belt: how many, and how wide each · slot: the gap at the end of them · fast: metres a second
export const STAIRS = Object.freeze({ floor: 3.4, deep: 3.0, run: 9, half: 0.6, speed: 1.25, cover: 1.2, again: 3.2, near: 1.5, tread: 0.4, belts: 5, belt: 1.1, slot: 0.8, fast: 2.6 });
const TREAD = [0.3, 0.31, 0.34], DARK = [0.2, 0.21, 0.24], EDGE = [0.85, 0.66, 0.12], SKIRT = [0.1, 0.1, 0.13];

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = STAIRS, G = K.floor, env = c.env;
  const zT = -D / 2 + K.deep, zB = zT + K.run, xA = -W / 5, xB = W / 5, yOf = (z) => G * Math.max(0, Math.min(1, (zB - z) / K.run));
  const onA = (x, z) => Math.abs(x - xA) < K.half && z >= zT && z <= zB, onB = (x, z) => Math.abs(x - xB) < K.half && z >= zT && z <= zB;
  c.shell({ floor: false, panels: false, skirting: false, wallAlb: [0.3, 0.29, 0.34],
    ceilTex: kit.tex.custom('atrium:deck', 32, 32, (g, w, h) => { P(g, '#15141a', 0, 0, w, h); for (let x = 0; x < w; x += 8) { P(g, '#1f1e26', x, 0, 3, h); P(g, '#0d0c11', x + 5, 0, 1, h); } }) });
  // Between the two, the floor is belts: five of them side by side, each going its own way, fast, and at either end of them
  // a slot with nothing in it. Whoever stands on one is taken to the end of it. Across them is a place with something in it.
  // (The owner: "sections that would send you into the abyss if you stayed on and you have to jump to others… lil bit of platformer".)
  const sOut = Math.min(2.7, xB - K.half - 0.2), sIn = sOut - K.slot, zL0 = zT + 1.6, zL1 = zL0 + K.belts * K.belt;
  const lane = (z) => (z > zL0 && z < zL1 ? Math.floor((z - zL0) / K.belt) : -1), inSlot = (x, z) => z > zL0 && z < zL1 && Math.abs(x) > sIn && Math.abs(x) < sOut;
  const way = R.shuffle([1, 1, -1, -1, 1]).map((d, i) => d * (i === 2 ? 1.25 : 1) * K.fast * R.pick([-1, 1]) ** 0);   // two of them together go the one way
  voidIn(c, inSlot, { floor: (x, z) => (z < zT ? G : onA(x, z) || onB(x, z) ? yOf(z) : 0) });
  const fl = c.floor, rect = (xa, xb, za, zb, y) => { if (xb - xa > 0.01 && zb - za > 0.01) fl.grid([xa, y, za], [0, 0, 1], [1, 0, 0], ticks(zb - za), ticks(xb - xa), (u, v) => [(xa + v + c.room.cx) / 1.6, (za + u + c.room.cz) / 1.6]); };
  rect(-W / 2, W / 2, zL1, D / 2, 0); rect(-W / 2, W / 2, zT, zL0, 0); rect(-W / 2, -sOut, zL0, zL1, 0); rect(sOut, W / 2, zL0, zL1, 0); rect(-W / 2, W / 2, -D / 2, zT, G); c.flat.box(-W / 2, G - 0.22, zT - 0.02, W / 2, G, zT + 0.06, [0.66, 0.52, 0.2]);
  sheet(c.flat, [-W / 2, 0, zT], [W / 2, 0, zT], [W / 2, G - 0.22, zT], [-W / 2, G - 0.22, zT], 8, 2, null, [0.16, 0.15, 0.2]);
  const two = (batch, a, b, cc, d, alb) => { sheet(batch, a, b, cc, d, 1, 1, null, alb || [1, 1, 1]); sheet(batch, a, d, cc, b, 1, 1, null, alb || [1, 1, 1]); };
  const pink = c.shining('stairs:pink', kit.tex.white(), 2.2, [1, 0.24, 0.6]), cyan = c.shining('stairs:cyan', kit.tex.white(), 2.2, [0.2, 0.88, 1]), amber = c.shining('stairs:amber', kit.tex.white(), 2.0, [1, 0.69, 0.18]), violet = c.shining('stairs:violet', kit.tex.white(), 2.2, [0.7, 0.42, 1]);

  /* the belts, and the slots at the ends of them */
  { const black = c.mapped('stairs:void', kit.tex.custom('stairs:void', 4, 4, (g) => P(g, '#000', 0, 0, 4, 4))), k0 = [0, 0, 0];
    for (const s of [-1, 1]) { const xa = s * sIn, xb = s * sOut, lo = Math.min(xa, xb), hi = Math.max(xa, xb), y = -9;
      two(black, [lo, y, zL0], [lo, y, zL1], [lo, 0, zL1], [lo, 0, zL0], k0); two(black, [hi, y, zL0], [hi, y, zL1], [hi, 0, zL1], [hi, 0, zL0], k0); two(black, [lo, y, zL0], [hi, y, zL0], [hi, 0, zL0], [lo, 0, zL0], k0); two(black, [lo, y, zL1], [hi, y, zL1], [hi, 0, zL1], [lo, 0, zL1], k0); }
    for (let i = 0; i < K.belts; i++) { const za = zL0 + i * K.belt, dir = Math.sign(way[i]);
      c.flat.box(-sIn, -0.06, za + 0.03, sIn, 0.012, za + K.belt - 0.03, [0.11, 0.11, 0.13]); c.flat.box(-sIn, -0.06, za, sIn, 0.016, za + 0.03, EDGE); c.flat.box(-sIn, -0.06, za + K.belt - 0.03, sIn, 0.016, za + K.belt, EDGE);
      for (let x = -sIn + 0.5; x < sIn - 0.4; x += 0.9) for (let k = 0; k < 3; k++) c.flat.box(x + dir * k * 0.09 - 0.03, 0.012, za + 0.2 + k * 0.12, x + dir * k * 0.09 + 0.03, 0.018, za + K.belt - 0.2 - k * 0.12, Math.abs(way[i]) > K.fast ? [0.9, 0.3, 0.2] : [0.5, 0.5, 0.55]); }   // which way, and the quick one in red
    c.light(0, 1.6, zT + 0.8, '#ffe2a8', 0.8, { k: 1.4, far: 4.5 }); c.leave('battery', R.range(-1.2, 1.2), zT + 0.7, { y: 0 }); c.leave('snack', R.range(-1.2, 1.2), zT + 0.9, { y: 0 }); }

  /* the two that can be got onto: treads, a balustrade either side, a rail in tube */
  const flight = (x, rail) => {
    const n = Math.round(K.run / K.tread);
    for (let i = 0; i < n; i++) { const za = zT + i * K.tread, y = yOf(za + K.tread / 2) + 0.06; c.flat.box(x - K.half, 0, za, x + K.half, y, za + K.tread, i % 2 ? TREAD : DARK); c.flat.box(x - K.half, y - 0.01, za + K.tread - 0.04, x + K.half, y + 0.004, za + K.tread, EDGE); }
    for (const s of [-1, 1]) { const xs = x + s * (K.half + 0.05); two(c.flat, [xs, -0.05, zB], [xs, G - 0.05, zT], [xs, G + 0.9, zT], [xs, 0.9, zB], SKIRT); two(rail, [xs - 0.03, 0.92, zB], [xs - 0.03, G + 0.92, zT], [xs + 0.03, G + 0.92, zT], [xs + 0.03, 0.92, zB], null); c.solid(xs - 0.05, zT, xs + 0.05, zB, { tall: false }); }
  };
  flight(xA, pink); flight(xB, cyan);
  /* the covered way over the one that goes up: every stretch of it the same as the last, and a curtain of strip at each end */
  const z0 = zT + K.cover, z1 = zB - K.cover, wide = K.half + 0.12, tall = 2.35;
  const lining = c.mapped('stairs:lining', kit.tex.custom('stairs:lining', 64, 64, (g, w, h) => { P(g, '#0e0d12', 0, 0, w, h); for (let x = 0; x < w; x += 32) { P(g, '#2a2833', x + 2, 6, 28, 44); P(g, '#ff3d9a', x + 4, 8, 24, 2); P(g, '#35e0ff', x + 4, 46, 24, 2); for (let k = 0; k < 4; k++) P(g, '#4a4758', x + 6, 16 + k * 7, 20 - k * 3, 3); } P(g, '#1a1922', 0, 56, w, 8); }));
  const rep = (s, t) => [(s * (z1 - z0)) / (K.again / 2), t];
  for (const sgn of [-1, 1]) { const xs = xA + sgn * wide; sheet(lining, [xs, yOf(z1), z1], [xs, yOf(z0), z0], [xs, yOf(z0) + tall, z0], [xs, yOf(z1) + tall, z1], 8, 1, rep); sheet(lining, [xs, yOf(z0), z0], [xs, yOf(z1), z1], [xs, yOf(z1) + tall, z1], [xs, yOf(z0) + tall, z0], 8, 1, rep);
    two(c.flat, [xs + sgn * 0.04, yOf(z1), z1], [xs + sgn * 0.04, yOf(z0), z0], [xs + sgn * 0.04, yOf(z0) + tall, z0], [xs + sgn * 0.04, yOf(z1) + tall, z1], [0.13, 0.13, 0.17]); }
  two(c.flat, [xA - wide, yOf(z1) + tall, z1], [xA - wide, yOf(z0) + tall, z0], [xA + wide, yOf(z0) + tall, z0], [xA + wide, yOf(z1) + tall, z1], [0.08, 0.08, 0.1]);
  const strip = c.mapped('stairs:strip', kit.tex.custom('stairs:strip', 32, 32, (g, w, h) => { P(g, '#0b0b0e', 0, 0, w, h); for (let x = 0; x < w; x += 4) P(g, '#1c1c22', x, 0, 3, h); }));
  for (const z of [z0, z1]) { upright(strip, xA - wide, z, xA + wide, z, yOf(z), yOf(z) + tall, [0, 0, 3, 1]); upright(strip, xA + wide, z, xA - wide, z, yOf(z), yOf(z) + tall, [0, 0, 3, 1]); }
  for (let k = 0; k < 2; k++) { const z = (z0 + z1) / 2 + (k - 0.5) * K.again; c.light(xA, yOf(z) + 1.9, z, k ? '#35e0ff' : '#ff3d9a', 0.5, { k: 1.6, far: 3.2 }); }

  /* the floor above: a rail, open where the two come up; and something left there */
  for (const [xa, xb] of [[-W / 2, xA - K.half - 0.1], [xA + K.half + 0.1, xB - K.half - 0.1], [xB + K.half + 0.1, W / 2]]) { for (const y of [1.0, 0.5]) c.flat.box(xa, G + y - 0.03, zT + 0.08, xb, G + y + 0.03, zT + 0.14, [0.66, 0.52, 0.2]); for (let x = xa + 0.2; x < xb; x += 1.2) c.flat.box(x - 0.03, G, zT + 0.08, x + 0.03, G + 1.0, zT + 0.14, [0.66, 0.52, 0.2]); two(amber, [xa, G + 1.04, zT + 0.16], [xb, G + 1.04, zT + 0.16], [xb, G + 1.1, zT + 0.16], [xa, G + 1.1, zT + 0.16], null); }
  c.leave('snack', R.pick([-1, 1]) * (W / 2 - 1.4), -D / 2 + 1.4, { y: G });

  /* the ones that go everywhere: a band of treads along any line through the hall, a rail either side, turned however it turns */
  const band = (at, n, rail, o = {}) => {
    const w = o.w ?? 0.55, twist = o.twist || (() => 0), e = 0.004, sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const frame = (t) => { const q = at(t), T = norm(sub(at(Math.min(1, t + e)), at(Math.max(0, t - e)))), up0 = Math.abs(T[1]) > 0.92 ? [1, 0, 0] : [0, 1, 0]; let S = norm(cross(T, up0)), U = cross(S, T); const a = twist(t), cs = Math.cos(a), sn = Math.sin(a);
      const S2 = [S[0] * cs + U[0] * sn, S[1] * cs + U[1] * sn, S[2] * cs + U[2] * sn], U2 = [U[0] * cs - S[0] * sn, U[1] * cs - S[1] * sn, U[2] * cs - S[2] * sn]; return { q, S: S2, U: U2 }; };
    const pt = (f, s, u) => [f.q[0] + f.S[0] * s + f.U[0] * u, f.q[1] + f.S[1] * s + f.U[1] * u, f.q[2] + f.S[2] * s + f.U[2] * u];
    let f0 = frame(0);
    for (let i = 1; i <= n; i++) { const f1 = frame(i / n);
      two(c.flat, pt(f0, -w, 0), pt(f1, -w, 0), pt(f1, w, 0), pt(f0, w, 0), i % 2 ? TREAD : DARK);
      for (const s of [-1, 1]) { two(c.flat, pt(f0, s * w, -0.05), pt(f1, s * w, -0.05), pt(f1, s * w, 0.7), pt(f0, s * w, 0.7), SKIRT); two(rail, pt(f0, s * w - 0.035, 0.72), pt(f1, s * w - 0.035, 0.72), pt(f1, s * w + 0.035, 0.72), pt(f0, s * w + 0.035, 0.72), null); }
      f0 = f1; }
  };
  const cx = 0, czz = (zB + D / 2) / 2 - 0.6, top = H - 0.4, T2 = Math.PI * 2;
  band((t) => [cx + Math.cos(t * T2 * 2.5) * (2.2 + t * 1.2), 2.5 + t * (top - 2.5), czz + Math.sin(t * T2 * 2.5) * (2.2 + t * 1.2)], 90, violet);                                   // round and up, to the roof
  band((t) => [-W / 2 + 0.2 + t * (W - 0.4), 4.6 + Math.sin(t * T2 * 2) * 1.5, zT + 2.2 + Math.sin(t * T2) * 1.6], 70, amber);                                                    // a wave, wall to wall, through the others
  band((t) => [xB + 2.2 + Math.sin(t * Math.PI) * 1.4, 2.6 + Math.sin(t * Math.PI) * (top - 3.2), D / 2 - 0.4 - t * (D - 3.6)], 60, pink, { twist: (t) => t * Math.PI });            // over the hall, and on its back by the far end
  band((t) => [-W / 2 + 0.75, 2.4 + t * (top - 2.4), D / 2 - 1 - t * 5], 34, cyan, { twist: () => -Math.PI / 2 });                                                                 // up the wall, treads to the room
  band((t) => [W / 2 - 2.6 + Math.cos(t * T2) * 1.7, 5.4 + Math.sin(t * T2) * 0.5, czz + 0.4 + Math.sin(t * T2) * 1.7], 56, cyan, { twist: (t) => t * Math.PI, w: 0.45 });          // a band with one side
  for (const k of [0, 1]) band((t) => [xA - 2.6 + Math.cos(t * T2 * 1.5 + k * Math.PI) * 0.9, 2.6 + t * 4.2, D / 2 - 2 - t * 6 + Math.sin(t * T2 * 1.5 + k * Math.PI) * 0.9], 48, k ? pink : amber, { w: 0.4 });   // two, plaited
  band((t) => [cx + 1.5 - t * 0.6, t * (H + 0.2) - 0.2, czz - 2.4 + t * 0.4], 30, violet, { w: 0.5 });                                                                             // out of the floor and into the roof
  c.solid(cx + 0.7, czz - 3.1, cx + 2.3, czz - 1.8, { tall: false });
  for (const [x, y, z, col] of [[cx, 4.2, czz, '#b46bff'], [-W / 2 + 2, 3.2, zT + 2.5, '#ffb02e'], [W / 2 - 2.6, 5.0, czz, '#35e0ff'], [xB + 2.6, 3.4, 2, '#ff3d9a'], [xA - 2.6, 3.2, D / 2 - 3, '#ffb02e'], [xB, 2.4, zB + 1, '#35e0ff'], [xA, 2.4, zB + 1, '#ff3d9a'], [0, G + 2, -D / 2 + 1.4, '#ffe2c0']]) c.light(x, y, z, col, 0.9, { k: 1.2, far: 7 });

  /* what it says */
  const neon = mallNeon(kit, 'stairs:' + p.seed, ['UP', 'ALSO UP', 'TO ALL FLOORS', 'STAND STILL', 'KEEP WALKING', 'DOWN IS UP', 'THIS WAY UP', 'UP UP'], p.seed), lit = c.shining('mall:neon:stairs:' + p.seed, neon.texture, 2.4);
  for (const [x, i] of [[xA, 3], [xB, 5]]) { upright(lit, x + 1.0, zB + 0.35, x - 1.0, zB + 0.35, 2.3, 2.8, neon.uv(i)); upright(lit, x - 1.0, zB + 0.35, x + 1.0, zB + 0.35, 2.3, 2.8, neon.uv((i + 1) % 8)); for (const s of [-1, 1]) c.flat.box(x + s - 0.02, 2.8, zB + 0.33, x + s + 0.02, H, zB + 0.37, [0.1, 0.1, 0.12]); }
  for (let i = 0; i < 4; i++) upright(lit, -W / 2 + 1 + i * ((W - 2) / 4), -D / 2 + 0.04, -W / 2 + 1 + (i + 1) * ((W - 2) / 4) - 0.4, -D / 2 + 0.04, G + 2.2, G + 2.75, neon.uv((i * 2) % 8));

  /* they move: whoever is on one is carried. And on the way up, under cover, whoever is walking is given the same stretch again */
  c.tick((dt, t, me) => {
    if (!me.inside || env.player?.me?.frozen) return;
    const li = Math.abs(me.x) < sIn + 0.3 ? lane(me.z) : -1;
    if (li >= 0) { const q = c.toWorld(me.x + way[li] * dt, me.z); env.player?.warp?.(q.x, q.z); return; }                 // a belt: along it, to the end of it
    const a = onA(me.x, me.z), b = !a && onB(me.x, me.z); if (!a && !b) return;
    let z = me.z + (a ? -1 : 1) * K.speed * dt;
    if (a && me.moving && me.z > z0 && me.z < z0 + K.near) { z += K.again; env.interfere?.(0.55); env.hud?.glitch?.(0.12); }
    z = Math.max(zT - 0.3, Math.min(zB + 0.3, z));
    const q = c.toWorld(me.x, z); env.player?.warp?.(q.x, q.z);
  });
}
