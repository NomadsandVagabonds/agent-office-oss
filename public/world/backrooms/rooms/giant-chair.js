// The Backrooms — Please Be Seated ("the chair at the end of the hall"). A preview (docs/BLOCKROOMS-PREVIEWS.md); its
// deck entry is in ../preview-deck.js until it is dealt.
//
// Two beats in one room. The chase: in by the front, an ordinary wide room under a 2.6 m grid, its far wall stepping in
// from both sides, voxel by voxel, to one squeeze, 1.4 m; an ordinary red office chair wedged in the squeeze's mouth
// (the catalogue's chair: it can be carried, and the pirate can shove it); just beside it a coat-hook recess the chair
// fits into; a two-drawer filing cabinet let into the left wall. With the chair where it is there is a sidle past it,
// 0.6 m; carry it into the recess and the squeeze is clear to run through. Beyond, the reveal: a long straight hall,
// 2.4 m wide, its panels running away (greener towards the end) to a dark-brown doorway.
//
// The doorway is not a doorway. Its jambs are the two rear legs of one enormous chair, and its lintel is the chair's
// stretcher; the dark beyond is the space under the seat. Walk under it and out between the front legs, turn back, and
// there it is: an oxblood vinyl visitor's chair on wooden legs, the seat over your head, the arms higher still, the
// upholstered back going up through a neat hole cut in the tile grid into a lit gap above. On this side the ceiling is
// higher (4.4 m), so all of it can be seen. Through its legs, the hall you came down; beyond, if the floor gave the room
// one, an ordinary doorway in the far wall. The big one is fixed: architecture, not furniture.
//
// Tuned at standing eye height (player.js EYE, 1.1 m): from anywhere in front of the hall's last metre the 2.6 m
// ceiling, the wall over the hall's mouth, the seat and the cushion hide the arms, the back and the hole; what shows is
// two brown posts, a brown beam across them, and the dark. The walls are the room's own blocks (c.pillar), its ceiling
// over the front part its own at 2.6 m. Nothing is used, nobody can be trapped: solid are the walls, the big chair's four
// legs and the little chair, and the way through is never narrower than 0.6 m.
import { lin, WHITE } from '../kit.js';
import { clip } from '../clipping.js';

/** The room's fixed proportions, in metres. Pure numbers, for the tests and the dev page. */
export const SEATED = Object.freeze({
  hall: 1.2,           // half the hall's width
  hallH: 2.6,          // the hall's ceiling (the room's own, H, is the chamber's: 4.4)
  chamber: 8.4,        // how deep the chamber at the end is (a whole number of tiles)
  leg: 0.4,            // a leg, square
  seatD: 3.0,          // the seat, front of the front legs to back of the back legs
  under: 2.3,          // under the seat's rails
  lintel: [1.95, 2.15],// the stretchers, the "lintel" you walk under
  cushion: [2.62, 2.96],
  arm: [3.75, 3.92],
  back: 6.0,           // the top of the seat back, 1.6 m into the gap above the ceiling
  gap: 2.4,            // how high the lit gap goes over the ceiling
  hole: { x: 2.7, d: 2.4 },
  wide: 7.2,           // the wide room you come in by, with the squeeze's wall: at least this deep
  squeeze: { w: 1.4, d: 1.2 },                         // the gap through the wall, and the wall's thickness
  recess: { x0: 0.9, x1: 1.8, d: 0.75 },               // the recess beside it, let into the wall from the wide room's side
  chair: { x: -0.3, color: '#6a2522' },                // the ordinary chair standing in the squeeze, off its middle a little
});

const TILE = 0.6;

/** Where everything is, from the room's size: the hall's mouth, the chair's legs, the hole. Pure. */
export function layout(W, D, H) {
  const S = SEATED, zM = -D / 2 + S.chamber, zb = zM - 0.05, zf = zb - S.seatD, L = S.leg, x0 = S.hall, x1 = S.hall + L;
  const legs = [
    { x0: -x1, x1: -x0, z0: zb - L, z1: zb }, { x0, x1, z0: zb - L, z1: zb },          // the rear pair: the hall's "jambs"
    { x0: -x1, x1: -x0, z0: zf, z1: zf + L }, { x0, x1, z0: zf, z1: zf + L },          // the front pair
  ];
  // the squeeze's wall: its hall face on the tile grid, at least S.wide from the front wall
  const zS = zM + TILE * Math.floor((D / 2 - S.wide - zM) / TILE + 1e-6), zW = zS + S.squeeze.d;
  const hall = { x0: -S.hall, x1: S.hall, z0: zM, z1: zS };
  const squeeze = { x0: -S.squeeze.w / 2, x1: S.squeeze.w / 2, z0: zS, z1: zW };
  const recess = { x0: S.recess.x0, x1: S.recess.x1, z0: zW - S.recess.d, z1: zW };
  const chair = { x: S.chair.x, z: (zS + zW) / 2 };
  // the wide room's far wall, stepping in to the squeeze from both sides: three columns a side, each deeper than the last
  const funnel = [];
  for (const sx of [-1, 1]) for (const [a, b, d] of sx < 0 ? [[1.5, 2.3, 0.45], [2.3, 3.1, 1.0], [3.1, W / 2, 1.6]] : [[1.8, 2.6, 0.45], [2.6, 3.3, 1.0], [3.3, W / 2, 1.6]])
    if (b - a > 0.05) funnel.push({ x0: sx < 0 ? -b : a, x1: sx < 0 ? -a : b, z0: zW, z1: zW + d });
  const cabinet = { x: -W / 2, z: zW + 2.2 };                                            // the filing cabinet in the left wall, just short of where it steps in
  const hole = { x0: -S.hole.x, x1: S.hole.x, z0: zM - S.hole.d, z1: zM, y: H };
  // the hall's panels: on the tile grid down its middle, every four tiles from the mouth; the one nearest the mouth is out
  const panels = [];
  for (let z = zM + 1.8; z <= zS - 0.6 + 1e-6; z += 2.4) panels.push(Math.round(z * 1000) / 1000);
  const wide = [];                                                                     // the wide room's: two rows of two
  for (const z of [zW + 1.8, zW + 4.2]) if (z <= D / 2 - 0.9) for (const x of [-1.8, 1.8]) wide.push([x, Math.round(z * 1000) / 1000]);
  return { zM, zb, zf, zS, zW, legs, hall, squeeze, recess, chair, funnel, cabinet, hole, panels, wide, chamber: [[-2.4, zM - 3.0], [2.4, zM - 3.0], [0, zM - 6.6]] };
}

/** Cuts along a span from a to b: on every grid line (origin + k·TILE) and at least every `step` between. */
function lines(a, b, origin, step = 0.6, also = []) {
  const out = new Set([0, Math.round((b - a) * 1e4) / 1e4, ...also.filter((v) => v > a && v < b).map((v) => Math.round((v - a) * 1e4) / 1e4)]);
  for (let k = Math.ceil((a - origin) / TILE - 1e-6); origin + k * TILE < b - 1e-6; k++) { const v = origin + k * TILE - a; if (v > 1e-6) out.add(Math.round(v * 1e4) / 1e4); }
  const sorted = [...out].sort((p, q) => p - q), more = [];
  for (let i = 0; i + 1 < sorted.length; i++) { more.push(sorted[i]); const n = Math.ceil((sorted[i + 1] - sorted[i]) / step - 1e-6); for (let j = 1; j < n; j++) more.push(sorted[i] + ((sorted[i + 1] - sorted[i]) * j) / n); }
  more.push(sorted[sorted.length - 1]);
  return more;
}
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

export function build(c) {
  const { W, D, H, kit, params: p } = c, S = SEATED, Lo = layout(W, D, H), { zM, zb, zf } = Lo;
  c.shell({ ceiling: false, panels: false });

  // ---- the walls of the front part: a block either side of the hall, the squeeze's wall with its recess, a strip over
  // the hall's mouth
  const { zS, zW, squeeze: q, recess: rc } = Lo, hallL = zS - zM, side = W / 2 - S.hall;
  const block = (x0, z0, x1, z1) => { if (x1 - x0 > 0.01 && z1 - z0 > 0.01) c.pillar((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0); };
  for (const sx of [-1, 1]) c.pillar(sx * (S.hall + side / 2), zM + hallL / 2, side, hallL);
  block(-W / 2, zS, q.x0, zW);                                                         // the squeeze's wall, left of it…
  block(q.x1, zS, rc.x0, zW); block(rc.x0, zS, rc.x1, rc.z0); block(rc.x1, zS, W / 2, zW);   // …and right of it, round the recess
  for (const f of Lo.funnel) block(f.x0, f.z0, f.x1, f.z1);                          // the far wall stepping in to the squeeze
  c.pillar(0, zM + 0.05, S.hall * 2, 0.1, { y0: S.hallH, solid: false });
  // the ceiling over all of the front part, at 2.6 m (over the blocks it is inside them, out of sight), darker near walls
  const open = (x, z) => (z > zW && z < D / 2 && !Lo.funnel.some((f) => x > f.x0 && x < f.x1 && z < f.z1)) || (Math.abs(x) < S.hall && z > zM && z <= zS) || (x > q.x0 && x < q.x1 && z >= zS && z <= zW) || (x > rc.x0 && x < rc.x1 && z >= rc.z0 && z <= zW);
  const nearWall = (x, z) => {
    let d = 0.45;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 0.05; k < d; k += 0.05) { const X = x + dx * k, Z = z + dz * k; if (!open(X, Z) || Math.abs(X) > W / 2 || Z > D / 2) { d = k; break; } }
    return d;
  };
  const edgeAo = (d) => 0.76 + 0.24 * smooth(d / 0.45);
  const ceilUv = (x0, z0) => (u, v) => [(x0 + u - TILE / 2) / TILE, (z0 + v - zM) / TILE];
  { const x0 = -W / 2, z0 = zM + 0.1, xs = lines(x0, W / 2, TILE / 2, 0.6, [-S.hall, S.hall, q.x0, q.x1, rc.x0, rc.x1, ...Lo.funnel.flatMap((f) => [f.x0, f.x1])]), zs = lines(z0, D / 2, zM, 0.6, [rc.z0, ...Lo.funnel.map((f) => f.z1)]);
    c.ceil.grid([x0, S.hallH, z0], [1, 0, 0], [0, 0, 1], xs, zs, ceilUv(x0, z0), WHITE, (u, v) => edgeAo(nearWall(x0 + u, z0 + v))); }
  // the ordinary chair in the squeeze, facing the way in: the catalogue's, so it can be carried off and shoved
  c.prop('chair', Lo.chair.x, Lo.chair.z, { o: { color: S.chair.color } });
  // the recess beside it: a coat rail with three hooks on its back wall, nothing hung on them
  { const f = c.flat, y = 1.6, z0 = rc.z0, wd = lin('#6d4322'), steel = lin('#b9bcb4');
    f.box(rc.x0 + 0.08, y - 0.05, z0, rc.x1 - 0.08, y + 0.04, z0 + 0.022, wd);
    f.box(rc.x0 + 0.02, y + 0.2, z0, rc.x1 - 0.02, y + 0.235, z0 + 0.26, wd);                       // the shelf over the hooks
    for (let i = 0; i < 3; i++) { const x = rc.x0 + (rc.x1 - rc.x0) * (i + 1) / 4; f.box(x - 0.012, y - 0.02, z0 + 0.022, x + 0.012, y + 0.005, z0 + 0.09, steel); f.box(x - 0.012, y + 0.005, z0 + 0.07, x + 0.012, y + 0.05, z0 + 0.09, steel); }
    c.blot(rc.x0 + 0.12, rc.z0 + 0.3, 0.5, 0.4, { a: 0.18 }); }                        // (the carpet worn where something stood)
  // the filing cabinet let into the left wall, down one drawer into the floor: two drawers and its top show, flush
  clip(c, 'cabinet', Lo.cabinet.x - 0.275 + 0.05, Lo.cabinet.z, { rot: Math.PI / 2, y: -0.4 });
  // ---- the chamber's ceiling at H, with a rectangle cut out of its grid where the seat back goes through
  const hole = Lo.hole, inHole = (x, z) => x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1;
  { const x0 = -W / 2, z0 = -D / 2, xs = lines(x0, W / 2, TILE / 2), zs = lines(z0, zM, zM, 0.6);
    c.ceil.grid([x0, H, z0], [1, 0, 0], [0, 0, 1], xs, zs, ceilUv(x0, z0), WHITE, (u, v) => edgeAo(Math.min(u, W - u, v, zM - z0 - v)), null,
      (u, v) => !inHole(x0 + u, z0 + v)); }

  // ---- light: the hall's panels, the last before the mouth out; three in the chamber; and the gap over the hole
  // (the hall's far panels a greener white: the hall goes green with distance)
  Lo.panels.forEach((z, i) => c.fitting(0, z, { y: S.hallH, dead: i === 0, flick: i === 1 + ((p.flick ?? 0) % 2) && i < Lo.panels.length - 1, ...(i <= 1 ? { tube: '#dcf2c4' } : {}) }));
  for (const [x, z] of Lo.wide) c.fitting(x, z, { y: S.hallH });
  for (const [x, z] of Lo.chamber) c.fitting(x, z);
  c.light(0, H + 0.5, zM - 0.75, '#fff0cf', 2.6, { axis: [0, -1, 0], floor: 0.3, k: 4.2 });
  // the stains on the hall's tiles (what the seed rolled), and a little dust come down under the hole's front edge
  for (const [x, f, s] of p.stains || []) c.blot(x, zM + 0.6 + f * (hallL - 1.2), s, s * 0.8, { down: true, y: S.hallH - 0.004, a: 0.16, rgb: [0.22, 0.15, 0.06] });
  c.blot(0, hole.z0 - 0.25, hole.x1 * 2 - 0.4, 0.7, { a: 0.1, rgb: [0.85, 0.8, 0.66] });

  // ---- the gap: the hole's four sides and a lid, lit by themselves, palest at the top; the tiles' cut edge round it
  const gapTex = kit.tex.custom('seated-gap', 4, 64, (g, w, h) => {
    for (let y = 0; y < h; y++) { const t = y / (h - 1), k = Math.round(205 + 50 * (1 - t) ** 1.6); g.fillStyle = `rgb(${k},${Math.round(k * 0.95)},${Math.round(k * 0.78)})`; g.fillRect(0, y, w, 1); }
  });
  const gap = c.shining('seated-gap', gapTex, 1.5, lin('#fff4d6')), top = H + S.gap;
  const wallsUp = [[[hole.x0, H, hole.z0], [hole.x1, H, hole.z0]], [[hole.x1, H, hole.z0], [hole.x1, H, hole.z1]], [[hole.x1, H, hole.z1], [hole.x0, H, hole.z1]], [[hole.x0, H, hole.z1], [hole.x0, H, hole.z0]]];
  for (const [a, b] of wallsUp) gap.quad([a[0], H, a[2]], [b[0], H, b[2]], [b[0], top, b[2]], [a[0], top, a[2]], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  gap.quad([hole.x0, top, hole.z0], [hole.x1, top, hole.z0], [hole.x1, top, hole.z1], [hole.x0, top, hole.z1], WHITE, [[0, 1], [1, 1], [1, 1], [0, 1]]);
  { const rim = lin('#cfc6a8');                                                        // the tiles cut clean: 2 cm of their edge
    for (const [a, b] of wallsUp) c.flat.quad([a[0], H, a[2]], [b[0], H, b[2]], [b[0], H + 0.02, b[2]], [a[0], H + 0.02, a[2]], rim); }

  // ---- the chair: wood and oxblood vinyl, square-edged, its edges stepped
  const wood = c.mapped('seated-wood', kit.tex.custom('seated-wood', 32, 64, (g, w, h) => {
    g.fillStyle = '#6d4322'; g.fillRect(0, 0, w, h);
    let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let x = 0; x < w; x++) { const k = (r() - 0.5) * 22; g.fillStyle = `rgba(${k > 0 ? '255,220,170' : '30,15,5'},${Math.abs(k) / 90})`; g.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(40,20,8,0.35)'; g.fillRect((r() * w) | 0, (r() * h) | 0, 1, 4 + ((r() * 14) | 0)); }
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(200,160,110,0.28)'; g.fillRect((r() * w) | 0, (r() * h) | 0, 2 + ((r() * 3) | 0), 1); }     // scuffs
  }));
  const vinyl = c.mapped('seated-vinyl', kit.tex.custom('seated-vinyl:' + (p.scuffs ?? 0), 64, 64, (g, w, h) => {
    g.fillStyle = '#5e1f1c'; g.fillRect(0, 0, w, h);
    let s = 1 + ((p.scuffs ?? 0) % 9973); const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.5 ? 'rgba(20,4,4,0.16)' : 'rgba(150,70,60,0.10)'; g.fillRect((r() * w) | 0, (r() * h) | 0, 2, 2); }
    for (let i = 0; i < 14; i++) {                                                     // where it has worn pale and cracked
      const x = r() * w, y = r() * h, n = 3 + ((r() * 7) | 0); g.fillStyle = 'rgba(205,150,135,0.35)';
      for (let k = 0; k < n; k++) g.fillRect(((x + k * (r() * 2 - 0.4)) | 0) % w, ((y + k * (r() - 0.3)) | 0) % h, 1, 1);
    }
  }));
  const box = (b, x0, y0, z0, x1, y1, z1, o = {}) => b.box(x0, y0, z0, x1, y1, z1, WHITE, { uv: 1.2, step: 0.45, ...o });
  // the legs, each with its contact shadow; solid, and tall
  for (const l of Lo.legs) {
    box(wood, l.x0, 0, l.z0, l.x1, S.under, l.z1, { skip: '-y' });
    c.solid(l.x0, l.z0, l.x1, l.z1, { tall: true, top: S.under });
    c.blot((l.x0 + l.x1) / 2, (l.z0 + l.z1) / 2, 0.9, 0.9, { a: 0.55 });
  }
  // the dark under the seat (nothing at Classic throws a shadow from above: it is laid on the carpet), and round the legs
  c.blot(0, (zf + zb) / 2, S.hall * 2 + 1.2, S.seatD + 0.9, { a: 0.62, y: 0.007 });
  c.blot(0, (zf + zb) / 2, S.hall * 2 + 2.6, S.seatD + 2.4, { a: 0.22, y: 0.008 });
  // the rails under the seat, the seat board, the four stretchers (the "lintel" front and back, one each side)
  const X = S.hall + S.leg, [s0, s1] = S.lintel;
  box(wood, -X, S.under, zf, X, S.cushion[0], zb);
  box(wood, -S.hall, s0, zb - 0.32, S.hall, s1, zb - 0.1);
  box(wood, -S.hall, s0, zf + 0.1, S.hall, s1, zf + 0.32);
  for (const sx of [-1, 1]) box(wood, Math.min(sx * (X - 0.28), sx * (X - 0.08)), s0, zf + S.leg, Math.max(sx * (X - 0.28), sx * (X - 0.08)), s1, zb - S.leg);
  // the cushion, its edge stepped twice
  const [c0, c1] = S.cushion, cz0 = zf - 0.06, cz1 = zb - 0.5;
  box(vinyl, -X + 0.06, c0, cz0, X - 0.06, c1 - 0.08, cz1, { skip: '-y' });
  box(vinyl, -X + 0.12, c1 - 0.08, cz0 + 0.06, X - 0.12, c1 - 0.03, cz1, { skip: '-y' });
  box(vinyl, -X + 0.2, c1 - 0.03, cz0 + 0.14, X - 0.2, c1, cz1, { skip: '-y' });
  // the back: posts carried up from the rear legs, an upholstered panel between them, its top corners stepped, through the hole
  const bz0 = zb - 0.55, bz1 = zb - 0.15, B = S.back;
  for (const sx of [-1, 1]) box(wood, Math.min(sx * (X - 0.14), sx * X), c0, bz0 + 0.1, Math.max(sx * (X - 0.14), sx * X), B - 0.45, bz1, { skip: '-y' });
  box(vinyl, -X + 0.14, c1, bz0, X - 0.14, B - 0.24, bz1, { skip: '-y' });
  box(wood, -X, c0, bz1, X, c0 + 0.5, zb, { skip: '-y' });                            // the rail along its foot, behind (and the hall's sightline: nothing over the seat shows)
  box(vinyl, -X + 0.22, B - 0.24, bz0 + 0.04, X - 0.22, B - 0.1, bz1 - 0.02, { skip: '-y' });
  box(vinyl, -X + 0.34, B - 0.1, bz0 + 0.07, X - 0.34, B, bz1 - 0.04, { skip: '-y' });
  // the arms: a post over each front leg, a flat rail back to the seat back, its front end stepped
  const [a0, a1] = S.arm;
  for (const sx of [-1, 1]) {
    const xi = sx * (X - 0.34), xo = sx * (X - 0.02), lo = Math.min(xi, xo), hi = Math.max(xi, xo);
    box(wood, lo, c0, zf + 0.06, hi, a0, zf + 0.36, { skip: '-y' });
    box(wood, Math.min(sx * (X - 0.4), sx * (X + 0.03)), a0, zf + 0.04, Math.max(sx * (X - 0.4), sx * (X + 0.03)), a1, bz0);
    box(wood, Math.min(sx * (X - 0.36), sx * (X - 0.01)), a0 + 0.03, zf - 0.02, Math.max(sx * (X - 0.36), sx * (X - 0.01)), a1 - 0.03, zf + 0.04);
  }

  c.rt.seated = { layout: Lo, hallL };                                                // (for the dev page, the pictures and the tests)
}
