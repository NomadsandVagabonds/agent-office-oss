// Low Point (docs/art-direction/yellow-office, "Low Point"). A PREVIEW: deck2.js `on: false`, the dev page's
// &preview=lowpoint (preview-deck.js; docs/BLOCKROOMS-PREVIEWS.md).
//
// A hall with a partition straight across it, floor to ceiling, and its skirting board running level from one side
// wall to the other like a ruler. The carpet does not stay with it. Each side of the partition it sags in three long
// flat facets, down to a level bottom more than a metre under the skirting, and there it goes on under the wall: the
// partition's underside is the ceiling of a short passage, and the wall comes down to meet the carpet each side of it,
// its skirting stepping down its edge. Walk downhill, stoop under the wall (the automatic duck, player.js) and climb
// back up into the next office. A pencil lies at the very bottom, at the foot of the slope, where everything dropped
// on this floor would roll. Two ordinary office doors stand plumb in each face of the partition at the old floor's
// height, on the level shelves the trough leaves at the side walls; they do not open. From the way in you see, under
// the wall, a little of the far slope lit by the tube over it; from the bottom you see the wall and the way through.
//
// Where everything is, and what a body meets, is rooms/low-point/rule.js: the builder draws from the same numbers.
// It reads nothing of the room's seeded stream: what varies is in the deck's roll (deck2.js).
import { lin, WHITE, ticks } from '../kit.js';
import { Vox, M } from '../../vox/vox.js';
import { woodLeaf } from '../bits.js';
import { planOf, floorAt, roomHead, headwayOf, facets, shadeAt, wornAt } from './low-point/rule.js';

const CREAM = lin('#e2d8bd');
const sm = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };

/** The pencil: a yellow hexagonal pencil, its paint a little worn, sharpened, its eraser used. Along x, 16 voxels. */
const pencilVox = () => {
  const v = new Vox(), paint = M('#e7b123', 0), lit = M('#f2c64a', 0), wood = M('#d9b383', 1), lead = M('#2e2e30', 0), ferrule = M('#a9a59b', 0), rubber = M('#d28783', 1);
  v.set(-8, 0, 0, rubber); v.set(-7, 0, 0, ferrule);
  for (let x = -6; x <= 4; x++) v.set(x, 0, 0, x % 3 === 0 ? lit : paint);
  v.set(5, 0, 0, wood); v.set(6, 0, 0, wood); v.set(7, 0, 0, lead);
  return v;
};

/**
 * A flat polygon (three or four corners, counter-clockwise from the side it faces) into a batch as a grid of cells about
 * `cell` across, so that the bake has vertices to light it by; a triangle is a quad with its last two corners the same.
 * Each vertex: the facet's own normal (the facets are flat: their edges stay crisp), uv, colour and shade by position.
 */
function patch(batch, pts, n, cell, uvOf, aoOf, albOf = null) {
  const [A, B, C, Dd] = pts.length === 4 ? pts : [pts[0], pts[1], pts[2], pts[2]];
  const len = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const nu = Math.max(1, Math.ceil(Math.max(len(A, B), len(Dd, C)) / cell)), nv = Math.max(1, Math.ceil(Math.max(len(A, Dd), len(B, C)) / cell));
  const base = batch.verts, lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const P = lerp(lerp(A, B, i / nu), lerp(Dd, C, i / nu), j / nv), t = uvOf(P), k = albOf ? albOf(P) : WHITE;
    batch.pos.push(P[0], P[1], P[2]); batch.nor.push(n[0], n[1], n[2]); batch.uv.push(t[0], t[1]);
    batch.alb.push(k[0], k[1], k[2]); batch.ao.push(aoOf(P));
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = base + j * (nu + 1) + i;
    batch.idx.push(a, a + 1, a + nu + 2, a, a + nu + 2, a + nu + 1);
  }
}

export function build(c) {
  const { W, D, H, params: p, look, room } = c;
  const plan = planOf(W, D, H, p), o = plan.o, { T, a, b, deep, top, kx } = plan;
  c.shell({ floor: false, panels: false, sockets: false });

  /* ---- what a body meets: the floor (a heightfield, rule.js floorAt), the headroom over it, and the partition */
  c.rt.floorY = (x, z) => floorAt(plan, x, z);
  c.rt.headY = (x, z) => roomHead(plan, x, z);
  // (the most headroom the widest of the cast, half a metre across its middle, keeps all the way under the partition:
  // anything taller does not set off into the room, cast/walk.js)
  c.rt.headway = headwayOf(plan, 0.5);
  for (const s of plan.solids) c.solid(s.x0, s.z0, s.x1, s.z1, { tall: s.tall, keep: true });
  c.rt.lowPoint = { plan };                              // (for the dev page and for scripts)

  /* ---- the carpet: level where it is level (as the shell lays it), then the six slopes and the bottom, each facet its own */
  const floor = c.floor, cx = room.cx || 0, cz = room.cz || 0;
  const edge = (x, z) => 0.76 + 0.24 * sm(Math.min(x + W / 2, W / 2 - x, z + D / 2, D / 2 - z) / 0.45);
  const worn = (x, z) => { const k = 1 + 0.13 * wornAt(plan, x, z); return [k, k, k * 0.97]; };
  const level = (x0, z0, x1, z1) => {
    if (x1 - x0 < 0.005 || z1 - z0 < 0.005) return;
    const start = floor.verts;
    floor.grid([x0, 0, z0], [0, 0, 1], [1, 0, 0], ticks(z1 - z0, 0.4), ticks(x1 - x0, 0.4), (u, v) => [(x0 + v + cx) / 1.6, (z0 + u + cz) / 1.6], WHITE, (u, v) => edge(x0 + v, z0 + u));
    for (let i = start; i < floor.verts; i++) { const k = worn(floor.pos[i * 3], floor.pos[i * 3 + 2]); for (let q = 0; q < 3; q++) floor.alb[i * 3 + q] = k[q]; }
  };
  for (const s of [1, -1]) {
    const zw = s * T / 2, zt = s * top, zE = s * D / 2, lo = Math.min(zw, zt), hi = Math.max(zw, zt);
    level(-W / 2, lo, -b, hi); level(b, lo, W / 2, hi);                     // the shelves beside the trough
    level(-W / 2, Math.min(zt, zE), W / 2, Math.max(zt, zE));              // the landing at that end of the hall
  }
  // (on the side facets the carpet is stretched across the slope as it is laid, so its pile does not smear: a seam at each crease)
  const slant = Math.hypot(1, kx);
  const carpetUv = (f) => (P) => (f.name.endsWith('side') ? [(Math.sign(P[0]) * (a + (Math.abs(P[0]) - a) * slant) + cx) / 1.6, (P[2] + cz) / 1.6] : [(P[0] + cx) / 1.6, (P[2] + cz) / 1.6]);
  const wall = c.wall, plaster = lin('#b9ad8a');
  for (const f of facets(plan)) {
    // (each facet a shade of its own, as the tubes would leave them if they cast shadows: the steep side facets darker than
    // the long one, the one on the right darkest)
    const tint = f.name.endsWith('right side') ? 0.8 : f.name.endsWith('left side') ? 0.9 : 1;
    if (f.kind === 'slope' || f.kind === 'bottom') patch(floor, f.pts, f.n, 0.3, carpetUv(f), (P) => tint * edge(P[0], P[2]) * shadeAt(plan, P[0], P[1], P[2]), (P) => worn(P[0], P[2]));
    else if (f.kind === 'wall') {
      // (the partition's lower faces carry on the wallpaper of the faces above them, as c.pillar papers them)
      const uv = f.n[2] > 0.5 ? (P) => [(P[0] + W / 2) / 0.8, P[1] / 0.8] : f.n[2] < -0.5 ? (P) => [(W + T + W / 2 - P[0]) / 0.8, P[1] / 0.8] : (P) => [(P[2] + 7) / 0.8, P[1] / 0.8];
      patch(wall, f.pts, f.n, 0.3, uv, (P) => shadeAt(plan, P[0], Math.min(0, P[1] - 0.15), P[2]) * (0.86 + 0.14 * sm((P[1] + deep) / 0.5)));
    } else patch(c.flat, f.pts, f.n, 0.2, () => [0.5, 0.5], (P) => 0.6 + 0.3 * sm((Math.abs(P[2]) - T / 4) / (T / 4)), () => plaster);   // (the underside of a wall: bare board, never papered)
  }
  // the seams where the facets meet, and where the slopes leave the level carpet: a darker line of pile, a hair proud
  // (fine detail, which a low Graphics setting leaves out)
  const seam = c.detail, dark = lin(look.carpet).map((k) => k * 0.62);
  const line = (P, Q, n, wide = 0.018) => {
    const d = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]], l = Math.hypot(...d), u = d.map((k) => k / l);
    const s = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]].map((k) => k * wide / 2), up = n.map((k) => k * 0.003);
    const q = (X, sg) => [X[0] + sg * s[0] + up[0], X[1] + sg * s[1] + up[1], X[2] + sg * s[2] + up[2]];
    seam.quad(q(P, -1), q(P, 1), q(Q, 1), q(Q, -1), dark);             // (wound so that it faces n: (u × n) × u is n)
  };
  for (const s of [1, -1]) {
    const zw = s * T / 2, zt = s * top, nb = [0, 1, 0], ns = [0, 1, -s * plan.kz].map((k, i, v) => k / Math.hypot(...v));
    for (const sx of [-1, 1]) { line([sx * a, -deep, zw], [sx * b, 0, zt], ns); line([sx * b, 0, zw], [sx * b, 0, zt], nb); }
    line([-b, 0, zt], [b, 0, zt], nb); line([-a, -deep, zw], [a, -deep, zw], nb, 0.012);
  }

  /* ---- the partition: a block of wall floor to ceiling (its solids are the plan's, either side of the passage), and the
   * skirting straight across both its faces at the old floor's height, the whole width of the hall, over the trough */
  c.pillar(0, 0, W, T, { solid: false, skirting: false });
  const trim = lin(look.trim), k = o.proud, sk = o.skirt;
  for (const s of [1, -1]) {
    const zf = s * T / 2, z0 = Math.min(zf, zf + s * k), z1 = Math.max(zf, zf + s * k);
    const gaps = plan.doors.filter((d) => d.side === s).map((d) => [d.x - d.w / 2 - o.door.frame, d.x + d.w / 2 + o.door.frame]).sort((p, q) => p[0] - q[0]);
    let from = -W / 2;
    for (const [g0, g1] of [...gaps, [W / 2, W / 2]]) { if (g0 - from > 0.01) c.flat.box(from, 0, z0, g0, sk, z1, trim); from = g1; }
    // where the wall comes down to meet the carpet, its skirting follows the carpet down in steps, to the passage
    for (const sx of [-1, 1]) for (let u = 0; u < b - a - 1e-6; u += o.vox) {
      const ua = u, ub = Math.min(b - a, u + o.vox), y = -(deep - kx * ua);
      const xa = sx * (a + ua), xb = sx * (a + ub);
      c.flat.box(Math.min(xa, xb), y, z0, Math.max(xa, xb), Math.min(y + sk, sk), z1, trim, { skip: '-y' });
    }
  }
  // the passage's own skirting, at the foot of its two sides
  for (const sx of [-1, 1]) c.flat.box(sx > 0 ? a - k : -a, -deep, -T / 2, sx > 0 ? a : -a + k, -deep + sk, T / 2, trim, { skip: '-y' });

  /* ---- the doors in the partition: ordinary office doors, plumb, at the old floor's height, shut, in their frames */
  const wood = lin(p.wood || '#7a4a2a'), fr = o.door.frame;
  for (const d of plan.doors) {
    const s = d.side, zf = s * T / 2, z0 = Math.min(zf, zf + s * 0.05), z1 = Math.max(zf, zf + s * 0.05);
    woodLeaf(c, c.vox, [d.x, 0.012, zf + s * 0.008], [s, 0, 0], [0, 1, 0], [0, 0, s], d.w, d.h - 0.012, 0.04, wood);
    c.flat.box(d.x - d.w / 2 - fr, 0, z0, d.x - d.w / 2, d.h + fr, z1, CREAM);
    c.flat.box(d.x + d.w / 2, 0, z0, d.x + d.w / 2 + fr, d.h + fr, z1, CREAM);
    c.flat.box(d.x - d.w / 2, d.h, z0, d.x + d.w / 2, d.h + fr, z1, CREAM);
    c.blot(d.x, zf + s * 0.2, d.w + 0.1, 0.3, { a: 0.18 });                  // where the feet go, at each door nobody opens
  }

  /* ---- the pencil, at the bottom, where it rolled to; its little shadow */
  const pc = plan.pencil, py = floorAt(plan, pc.x, pc.z + 0.01);
  c.model('low-point:pencil', pencilVox, pc.x, pc.z, { rot: pc.rot, y: py + 0.0005, scale: [pc.len / 16 / 0.025, pc.thick / 0.025, pc.thick / 0.025], solid: false, shadow: false });
  c.blot(pc.x, pc.z + 0.004, pc.len + 0.03, 0.03, { a: 0.35, y: py + 0.004 });

  /* ---- the ceiling's own: four fittings down the middle (the one over the far slope is what lights the carpet you see
   * under the wall from the way in; the one by the way in is dead in some halls), and the tiles' stains */
  c.fitting(0, D / 2 - 1.3, { dead: !!p.dead });
  // (the two over the slopes reach further down than a tube at this height would: the carpet at the foot of the far slope
  // is what shows under the wall, and it is the bright thing past the dark of the passage)
  const deepLight = { power: 1.5 * (room.light?.power ?? 1), k: 7, far: 14 };
  c.fitting(0, T / 2 + 1.2, { light: deepLight });
  c.fitting(0, -(T / 2 + 1.2), { light: deepLight });
  c.fitting(0, -(D / 2 - 1.3), { flick: !p.dead && (p.stain || 0) % 4 === 0 });
  let st = p.stain || 1;
  const rnd = () => ((st = (Math.imul(st, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < 6; i++) c.blot(-W / 2 + 0.6 + rnd() * (W - 1.2), -D / 2 + 0.6 + rnd() * (D - 1.2), 0.35 + rnd() * 0.7, 0.3 + rnd() * 0.6, { down: true, y: H - 0.004, a: 0.1 + rnd() * 0.16, rgb: [0.32, 0.24, 0.08] });
  c.blot(0, T / 2 + 0.5, 1.4, 0.7, { down: true, y: H - 0.004, a: 0.14, rgb: [0.25, 0.17, 0.05] });
  c.socket('left', D / 2 - 2.0);
  c.socket('right', -(D / 2 - 2.2));
  c.reserve(0, D / 2 - 0.8, 0.8); c.reserve(0, -D / 2 + 0.8, 0.8);
  c.reserve((W / 2 - 0.8), -D / 2 + 0.8, 0.45); c.reserve(-(W / 2 - 0.8), -D / 2 + 0.8, 0.45);   // (where a coin is hidden: the stash in deck2.js)
}
