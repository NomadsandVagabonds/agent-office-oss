// Borrowed Daylight (rooms/blinds.js): where its light falls. Pure: numbers in, numbers out, no three.js.
//
// The room's light is one low afternoon sun that comes through the blind and from nowhere else. It is drawn as a
// projection from one point a few metres behind the blind (where a window would have the sun; there is nothing there):
// every surface the light can reach (the carpet, the false wall it climbs, the jamb of the recessed hall, the skirting)
// is a rectangle in the room's frame, and what of each rectangle that point can see through the blind's opening is cut
// out of it here, once, as a convex polygon (the limits are planes through the point, so the cut is exact). The
// drawing then works out, for each spot of a polygon, where its ray crossed the blind and whether it met a slat, the
// cup or a gap (`lightAt`, and the same lines in the room's shader): the slats' shadows are those of the slats as
// drawn, at every tier, and their edges soften with distance from the blind.
//
// Everything is in the room's own frame (x across, z deep, y up; you come in at z = +D/2). `side` (±1) is the side the
// recessed hall is on; the blind stands toward the other.

export const DEG = Math.PI / 180;
/** The blind and its frame, metres. */
export const BLIND = Object.freeze({
  across: 1.5,                  // the opening between the posts
  post: 0.065, rail: 0.07,      // the frame's timber
  top: 2.14,                    // the frame's head (its underside)
  sill: 0.5,                    // the frame's bottom rail (its top)
  y0: 0.66, y1: 2.0,            // the slats: from the bottom rail of the blind to its head rail
  slats: 15,                    // between them
  depth: 0.05,                  // a slat's width, front to back
  tilt: 30 * DEG,               // how far the slats are turned open (0: flat, the most light)
  foot: 0.6,                    // the feet, front to back
});
/** The light: which way it goes from the blind, how high its point is, how warm. */
export const SUN = Object.freeze({
  aim: 0.75,                    // its middle ray meets the false wall this far in front of the hall's mouth: the mouth is in the light
  low: 13 * DEG,                // how far its ray through the blind's middle falls
  far: 3.6,                     // how far behind the blind its point is: the light spreads as it goes (×2 at that far beyond)
  size: 0.012,                  // how big the point is, metres: the softness of the edges (a third of the sun's: crisper than life)
  turn: 48 * DEG,               // the blind's face: turned this far from the light's way, toward where you come in
  color: [2.7, 1.62, 0.62],     // what it adds, times the surface's own colour (lin), over and above the room's light
});
/** The recessed hall, in the strip behind the false wall on its side: its mouth, its leg in, its leg along. */
export const HALL = Object.freeze({ strip: 2.6, wide: 1.15, mouth: 1.1, back: 2.05, head: 2.05, lintel: 0.2 });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const r5 = (v) => Math.round(v * 1e5) / 1e5;

/**
 * The room's layout for a room W × D × H and its params ({ side, az }), and the doorway on the hall's side if it has
 * one (`door`: { c, w }): where the false wall and the hall are, where the blind stands and which way it faces, where
 * the light comes from.
 */
export function layout(W, D, H, p = {}, door = null) {
  const s = p.side === -1 ? -1 : 1;
  const xf = s * (W / 2 - HALL.strip);                                         // the false wall's face, toward the room
  const xo = s * (W / 2 - HALL.wide);                                          // the hall's leg along the outer wall: from xo to the wall
  const zm0 = -D / 2 + HALL.back, zm1 = zm0 + HALL.mouth;                      // its mouth (zm0: the jamb the light finds)
  const dc = door ? door.c : 0, dw = door ? door.w : 1.0;
  const zd = door ? dc + dw / 2 + 0.12 : Math.max(zm1 + 0.3, 0.6);             // the leg along the outer wall runs from the mouth to here
  const B = [-s * (W / 2 - 2.1), 0, Math.min(0.8, D / 2 - 2.3)];
  const aim = [xf, (zm0 + zm1) / 2 + SUN.aim];                                 // (its middle ray, across the floor, to just past the mouth)
  const heading = Math.atan2(B[2] - aim[1], Math.abs(aim[0] - B[0])) + (p.az || 0) * DEG;
  const dh = [s * Math.cos(heading), -Math.sin(heading)];                     // the light across the floor
  // the blind: toward the other side and the front, its face turned from the light toward where you come in
  const face = Math.atan2(dh[1], dh[0]) + s * SUN.turn;
  const n = [Math.cos(face), 0, Math.sin(face)];                               // its light side
  const u = [-n[2], 0, n[0]];                                                  // across it, in its plane
  const mid = (BLIND.y0 + BLIND.y1) / 2, back = [dh[0] * Math.cos(SUN.low), -Math.sin(SUN.low), dh[1] * Math.cos(SUN.low)];
  const S = [B[0] - back[0] * SUN.far, mid - back[1] * SUN.far, B[2] - back[2] * SUN.far];   // where the light comes from: nowhere
  return { s, W, D, H, xf, xo, zm0, zm1, zd, dc, dw, door: !!door, n, u, B, S, heading };
}

/** Each slat's own lean and droop (radians; metres per metre across): it is a cheap blind and not quite straight. Fixed. */
export function slatsOf() {
  const out = [];
  for (let i = 0; i < BLIND.slats; i++) {
    const h = Math.sin(i * 12.9898 + 4.1) * 43758.5453, f = h - Math.floor(h);
    const bow = i < 3 ? (3 - i) * 0.008 : 0;                                   // the bottom three hang crooked toward one end
    out.push({ y: r5(BLIND.y0 + (i + 1) * (BLIND.y1 - BLIND.y0) / (BLIND.slats + 1)), tilt: r5(BLIND.tilt + (f - 0.5) * 16 * DEG), droop: r5(bow + (f - 0.5) * 0.014) });
  }
  return out;
}

/** Where a spot's ray crossed the blind's plane: fx across, fy up; t how far past it the spot is, and the ray's way. */
export function through(L, X) {
  const r = sub(X, L.S), len = Math.hypot(...r), dir = [r[0] / len, r[1] / len, r[2] / len];
  const dn = dot(dir, L.n), k = dot(sub(L.B, L.S), L.n) / dn;
  const A = [L.S[0] + dir[0] * k, L.S[1] + dir[1] * k, L.S[2] + dir[2] * k];
  return { fx: dot(sub(A, L.B), L.u), fy: A[1], t: len - k, k, dir, dn };
}

/** A convex polygon (3-D points) cut to where f(X) ≥ 0, f affine. */
function cut(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]); }
  }
  return out;
}
/** The plane through S and the edge P→Q, as an affine test that is ≥ 0 on the side `inside` is. */
function wedge(S, P, Q, inside) {
  const nn = cross(sub(P, S), sub(Q, S)), sg = Math.sign(dot(nn, sub(inside, S))) || 1;
  return (X) => sg * dot(nn, sub(X, S));
}

/**
 * The surfaces the light can fall on: { o, U, V, n, w, h, gate } rectangles (o a corner, U and V unit axes along it, n
 * the way it faces). `gate`: it is in the hall, so its light came in through the hall's mouth as well.
 */
export function surfaces(L) {
  const { s, W, D, H, xf, xo, zm0, zm1, zd, dc, dw } = L, S = 0.022, P = 0.02, K = 0.11;   // skirting: proud of its wall, and tall
  const out = [], lo = Math.min, hi = Math.max;
  const onX = (x, z0, z1, y0, y1, nx, gate = false) => z1 - z0 > 0.005 && out.push({ o: [x, y0, z0], U: [0, 0, 1], V: [0, 1, 0], n: [nx, 0, 0], w: z1 - z0, h: y1 - y0, gate });
  const onZ = (z, x0, x1, y0, y1, nz, gate = false) => x1 - x0 > 0.005 && out.push({ o: [x0, y0, z], U: [1, 0, 0], V: [0, 1, 0], n: [0, 0, nz], w: x1 - x0, h: y1 - y0, gate });
  const onY = (x0, x1, z0, z1, gate = false) => out.push({ o: [x0, 0, z0], U: [1, 0, 0], V: [0, 0, 1], n: [0, 1, 0], w: x1 - x0, h: z1 - z0, gate });
  // the room: its carpet, the false wall either side of the hall's mouth (and its skirting) and over it, the back wall
  onY(lo(-s * W / 2, xf), hi(-s * W / 2, xf), -D / 2, D / 2);
  for (const [z0, z1] of [[-D / 2, zm0], [zm1, D / 2]]) { onX(xf, z0, z1, K, H, -s); onX(xf - s * P, z0, z1, 0, K, -s); }
  onX(xf, zm0, zm1, HALL.head, H, -s);
  onZ(-D / 2, lo(-s * W / 2, xf), hi(-s * W / 2, xf), K, H, 1); onZ(-D / 2 + S, lo(-s * W / 2, xf), hi(-s * W / 2, xf), 0, K, 1);
  // the hall: its carpet, the jamb at the back of its mouth (and on along that wall), the outer wall round its doorway
  onY(lo(xf, s * W / 2), hi(xf, s * W / 2), zm0, zd, true);
  onZ(zm0, lo(xf, s * W / 2), hi(xf, s * W / 2), K, H, 1, true); onZ(zm0 + P, lo(xf, s * W / 2), hi(xf, s * W / 2), 0, K, 1, true);
  const wx = s * W / 2;
  if (L.door) {
    const d0 = dc - dw / 2, d1 = dc + dw / 2;
    for (const [z0, z1] of [[zm0, d0], [d1, zd]]) { onX(wx, z0, z1, K, H, -s, true); onX(wx - s * S, z0, z1, 0, K, -s, true); }
    onX(wx, d0, d1, 2.05, H, -s, true);
  } else { onX(wx, zm0, zd, K, H, -s, true); onX(wx - s * S, zm0, zd, 0, K, -s, true); }
  onX(xo, zm1, zd, K, H, s, true); onX(xo + s * P, zm1, zd, 0, K, s, true);    // (the inner wall of the leg along: lit only if the light gets round)
  return out;
}

/**
 * Every piece of light: [{ pts: [[x, y, z], …], n, gate }], each a convex polygon on one surface, a hair off it and
 * wound to face the room. `margin`: how far past the opening's edges a polygon reaches, for its soft edge.
 */
export function pieces(L, margin = 0.05) {
  const out = [], half = BLIND.across / 2 + margin, { S, B, u } = L;
  const at = (fx, fy) => [B[0] + u[0] * fx, fy, B[2] + u[2] * fx];
  const mid = at(0, (BLIND.y0 + BLIND.y1) / 2);
  const rect = [at(-half, BLIND.y0 - margin), at(half, BLIND.y0 - margin), at(half, BLIND.y1 + margin), at(-half, BLIND.y1 + margin)];
  const limits = rect.map((P, i) => wedge(S, P, rect[(i + 1) % 4], mid));
  limits.push((X) => dot(sub(X, B), L.n) - 0.04);                                // (past the blind, on its light side)
  // (in the hall a spot's ray must have come in through the mouth too: between its jambs, under its head)
  const m0 = Math.min(L.zm0, L.zm1), m1 = Math.max(L.zm0, L.zm1), mm = [L.xf, HALL.head / 2, (m0 + m1) / 2];
  const mouth = [[L.xf, 0, m0], [L.xf, 0, m1], [L.xf, HALL.head, m1], [L.xf, HALL.head, m0]];
  const gates = mouth.map((P, i) => wedge(S, P, mouth[(i + 1) % 4], mm));
  for (const q of surfaces(L)) {
    const c = (a, b) => [q.o[0] + q.U[0] * a + q.V[0] * b, q.o[1] + q.U[1] * a + q.V[1] * b, q.o[2] + q.U[2] * a + q.V[2] * b];
    let poly = [c(0, 0), c(q.w, 0), c(q.w, q.h), c(0, q.h)];
    if (dot(q.n, sub(S, poly[0])) <= 0) continue;                                 // (it faces away from where the light comes from)
    for (const f of q.gate ? [...limits, ...gates] : limits) { poly = cut(poly, f); if (poly.length < 3) break; }
    if (poly.length < 3) continue;
    const e = cross(sub(poly[1], poly[0]), sub(poly[2], poly[0]));
    if (dot(e, q.n) < 0) poly.reverse();
    const lift = 0.0025;
    out.push({ pts: poly.map((X) => [r5(X[0] + q.n[0] * lift), r5(X[1] + q.n[1] * lift), r5(X[2] + q.n[2] * lift)]), n: q.n, gate: q.gate });
  }
  return out;
}

const ss = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
/** The two ladder tapes the slats hang in, across the blind (fractions of its half-width). */
export const TAPES = Object.freeze([-0.62, 0.62]);
/**
 * How lit a spot is by the borrowed sun (0…1), worked out as the room's shader works it out: inside the opening, not
 * behind a slat, a ladder tape or the cup. X in the room's frame. (The hall's mouth is the polygons' business.)
 */
export function lightAt(L, X, slats = slatsOf(), cup = null) {
  const { fx, fy, t, dir, dn } = through(L, X);
  if (t <= 0 || dn <= 0) return 0;
  const soft = 0.002 + t * SUN.size / SUN.far, half = BLIND.across / 2;
  let k = ss(-soft, soft, fx + half) * ss(-soft, soft, half - fx) * ss(-soft, soft, fy - BLIND.y0) * ss(-soft, soft, BLIND.y1 - fy);
  const tau = dir[1] / dn;                                                       // (how far the ray drops per metre it goes through the blind)
  for (const sl of slats) {
    const yc = sl.y + sl.droop * fx, hh = (BLIND.depth / 2) * Math.abs(Math.sin(sl.tilt) - Math.cos(sl.tilt) * tau) + 0.0025;
    k *= ss(hh - soft, hh + soft, Math.abs(fy - yc));
  }
  for (const tx of TAPES) k *= 1 - 0.55 * (1 - ss(0.004 - soft, 0.004 + soft, Math.abs(fx - tx * half)));
  if (cup) k *= 1 - cupShade(L, X, cup);
  return k;
}

/** The cup: lying on its side at (x, z), its mouth turned `rot` (radians about y). → its axis (narrow end to mouth) and radii. */
export function cupOf(x, z, rot) {
  const len = 0.105, r0 = 0.029, r1 = 0.041, ax = [Math.cos(rot), 0, -Math.sin(rot)];
  const a = [r5(x - ax[0] * len / 2), r0, r5(z - ax[2] * len / 2)], b = [r5(x + ax[0] * len / 2), r1, r5(z + ax[2] * len / 2)];
  return { a, b, r0, r1, x, z, rot, len };
}
/** How much of the light the cup takes off a spot (0…1): how near the spot's ray comes to the cup's axis, against its radius there. */
export function cupShade(L, X, cup) {
  const dir = through(L, X).dir;
  let best = 1e9;
  for (let k = 0; k <= 6; k++) {
    const f = k / 6, P = [cup.a[0] + (cup.b[0] - cup.a[0]) * f, cup.a[1] + (cup.b[1] - cup.a[1]) * f, cup.a[2] + (cup.b[2] - cup.a[2]) * f], r = cup.r0 + (cup.r1 - cup.r0) * f;
    const w = sub(P, X), back = -dot(w, dir);                                    // (toward the light is −dir)
    if (back <= 0) continue;
    const q = [w[0] + dir[0] * back, w[1] + dir[1] * back, w[2] + dir[2] * back];
    best = Math.min(best, (Math.hypot(...q) - r) / (0.003 + back * SUN.size / SUN.far));
  }
  return 1 - ss(-1, 1, best);
}
