// The Backrooms — light worked out once per room in a small picture of its floor and walls (the Graphics setting's
// `shadows`: kit.js gfxOf). Pure: no three.js, no DOM; world.js turns what this returns into textures, and kit.js reads
// them in one block of its shader.
//
// What is stored, for every texel of the floor (5 cm, 10 cm in a big room) and of each wall (10 cm): for each group of
// lamps the bake keeps apart — the steady ones (aLit), the flickering ones (aFlk), and each lighting bank (aBank0…3) —
// how much of that group's light still arrives there, given what stands in the room (0…1, a ratio). The vertex
// attributes are left exactly as the bake made them; the shader multiplies each group's share of the vertex light by
// its own ratio. So a bank that fails takes its shadows with it, the other banks keep theirs, and a flicker shadows
// only as much as the tube is on. Nothing loops over lamps per pixel: it is one lookup (two with more than two banks).
//
// How: for each lamp (a ceiling tube is four points along its 1.2 m, so a shadow has a soft edge in four steps) and each
// box that stands in the room, the box's shadow on each receiving plane is projected from that point and filled in,
// texel by texel; a texel's share of a lamp is the fraction of its points it can see. The light a group loses there is
// then weighed against all the light that group brings there (its lamps and its share of the room's ambient light, of
// which a hidden share takes ambHide with it, as the look-dev lab did). Cost goes with the area of the shadows, not
// with the room's area times its lamps.
import { bankWeights } from './lighting.js';

export const SHADOWS = Object.freeze({
  cell: 0.05,            // a floor texel, metres (two voxels)
  coarse: 0.1,           // …in a room whose floor would need more texels than bigTexels at that size
  bigTexels: 60000,
  wall: 0.1,             // a wall texel
  step: 0.05,            // the edge the shader draws: positions are snapped to this grid before the lookup (voxel-scale steps)
  tube: [-0.45, -0.15, 0.15, 0.45],   // where along a ceiling tube (its 1.2 m, along the room's z) the points are
  ambHide: 0.8,          // of the room's ambient share a group brings to a texel, how much goes with the hidden part of its lamps
  reach: 0.04,           // a lamp's shadow is filled in no further than where its light falls below this share of its light under it
  pad: 1,                // texels of gutter round each region of the atlas (bilinear filtering never reads a neighbour)
  maxDoors: 4,           // doorways a room keeps light from (the brightest)
  housing: 0.25,         // a box this close to a lamp is its fitting, and casts nothing from it
  flat: 0.12,            // a box this thin, against a wall, is hung on it (a sign, a frame): it shades nothing on that wall
  least: 0.3,            // where a group brings ambient light, at least this share of it stays (the bounce off the lit floor round
                         // a shadow); a group with none (the red backup lamps) can go black
});

/** The lamps' groups, as kit.js bake() keeps them apart: 0 steady, 1 flicker, 2 + b bank b. */
export function groupOf(L, lighting) {
  const count = lighting ? lighting.bankCount || 2 : 0;
  if (lighting && Number.isInteger(L.bank) && L.bank >= 0 && L.bank < count) return 2 + L.bank;
  return L.flick ? 1 : 0;
}
export const groupCount = (lighting) => 2 + (lighting ? lighting.bankCount || 2 : 0);

/** One lamp's light (its brightness, the mean of its colour) at a point facing n, the way kit.js bake() gathers it. */
export function lampLum(L, px, py, pz, nx, ny, nz, sx = L.x, sy = L.y, sz = L.z) {
  const dx = sx - px, dy = sy - py, dz = sz - pz, d2 = dx * dx + dy * dy + dz * dz + 0.02;
  if (d2 > L.far2) return 0;
  const inv = 1 / Math.sqrt(d2);
  let s = ((nx * dx + ny * dy + nz * dz) * inv + L.wrap) / (1 + L.wrap);
  if (s <= 0) return 0;
  if (L.lobe) s *= L.floor + (1 - L.floor) * Math.max(0, -(dx * L.ax + dy * L.ay + dz * L.az) * inv);
  const fade = 1 - d2 / L.far2;
  return ((L.r + L.g + L.b) / 3) * s * fade * fade / (1 + d2 / L.k);
}

/** A ceiling tube (shines down) is a row of points along its length; anything else is one point. */
export function lampPoints(L) {
  if (L.lobe && L.ay < -0.9) return SHADOWS.tube.map((dz) => [L.x, L.y, L.z + dz]);
  return [[L.x, L.y, L.z]];
}

/** How far from a lamp its shadows are worth filling in (its light falls off; beyond this it is a few per cent of what it is under it). */
export function lampReach(L, below = 2) {
  const at = (d) => { const d2 = d * d + 0.02; if (d2 > L.far2) return 0; const f = 1 - d2 / L.far2; return f * f / (1 + d2 / L.k); };
  const ref = at(Math.max(0.3, below)) * SHADOWS.reach;
  let d = Math.max(0.3, below);
  while (d < 30 && at(d) > ref) d += 0.1;
  return d;
}

/* ---- the atlas: the floor and four walls, each a block of texels with a gutter ---------------------------------- */

const REGION = {
  floor: { a: 1, u: 0, v: 2, n: [0, 1, 0] },
  back: { a: 2, u: 0, v: 1, n: [0, 0, 1] },
  front: { a: 2, u: 0, v: 1, n: [0, 0, -1] },
  left: { a: 0, u: 2, v: 1, n: [1, 0, 0] },
  right: { a: 0, u: 2, v: 1, n: [-1, 0, 0] },
};
export const REGIONS = Object.freeze(['floor', 'back', 'front', 'left', 'right']);

/**
 * Where the floor and walls go in one texture. floor: is there a plain floor at y 0; walls: which walls (a Set of side
 * names). → { width, height, cell, regions: { floor?, back?, … } } — each { name, at (the plane: axis a = value), o (its
 * in-plane origin, u and v), cell, nu, nv, px, py (its first texel in the atlas), n (its facing) } — or null if nothing.
 */
export function mapLayout({ W, D, H, floor = true, walls = new Set() }) {
  const pad = SHADOWS.pad, list = [];
  const cf = (W / SHADOWS.cell) * (D / SHADOWS.cell) > SHADOWS.bigTexels ? SHADOWS.coarse : SHADOWS.cell, cw = SHADOWS.wall;
  const make = (name, at, o, lu, lv, cell) => ({ name, ...REGION[name], at, o, cell, nu: Math.max(1, Math.ceil(lu / cell - 1e-6)), nv: Math.max(1, Math.ceil(lv / cell - 1e-6)) });
  if (floor) list.push(make('floor', 0, [-W / 2, -D / 2], W, D, cf));
  for (const [name, at, o, len] of [['back', -D / 2, [-W / 2, 0], W], ['front', D / 2, [-W / 2, 0], W], ['left', -W / 2, [-D / 2, 0], D], ['right', W / 2, [-D / 2, 0], D]])
    if (walls.has(name)) list.push(make(name, at, o, len, H, cw));
  if (!list.length) return null;
  // floor across the top; back and front side by side under it, then left and right
  let y = 0, width = 0;
  const row = (items) => { let x = 0, tall = 0; for (const r of items) { r.px = x + pad; r.py = y + pad; x += r.nu + 2 * pad; tall = Math.max(tall, r.nv + 2 * pad); } width = Math.max(width, x); y += tall; };
  const by = (n) => list.filter((r) => n.includes(r.name));
  for (const items of [by(['floor']), by(['back', 'front']), by(['left', 'right'])]) if (items.length) row(items);
  const regions = Object.fromEntries(list.map((r) => [r.name, r]));
  return { width, height: y, regions, list, cell: cf };
}

/** The point in the room at the middle of texel (i, j) of a region. */
function texelPoint(r, i, j, out) {
  out[r.a] = r.at; out[r.u] = r.o[0] + (i + 0.5) * r.cell; out[r.v] = r.o[1] + (j + 0.5) * r.cell;
  return out;
}

/* ---- filling in a shadow ---------------------------------------------------------------------------------------- */

/** Convex hull of 2D points (flat array) → [[x, y], …] counter-clockwise, or null. */
function hull(pts) {
  const p = [];
  for (let i = 0; i < pts.length; i += 2) p.push([pts[i], pts[i + 1]]);
  p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return null;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  lo.pop(); hi.pop();
  const h = lo.concat(hi);
  return h.length >= 3 ? h : null;
}

/**
 * Project points (3D, flat) from S onto region r's plane → 2D texel coordinates (flat), texel i's middle at i.
 * Every point must lie strictly between S and the plane along the plane's axis (clip first).
 */
function project(pts3, S, r) {
  const out = [], a = r.a, at = r.at, sa = S[a];
  for (let k = 0; k < pts3.length; k += 3) {
    const pa = pts3[k + a], t = (at - sa) / (pa - sa);
    const qu = S[r.u] + t * (pts3[k + r.u] - S[r.u]), qv = S[r.v] + t * (pts3[k + r.v] - S[r.v]);
    out.push((qu - r.o[0]) / r.cell - 0.5, (qv - r.o[1]) / r.cell - 0.5);
  }
  return out;
}

/** A box's corners, cut to the slab between S and region r's plane along its axis (a little short of S) → 3D flat, or null. */
function boxBetween(b, S, r) {
  const a = r.a, lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1], eps = 0.02;
  if (r.at < S[a]) { lo[a] = Math.max(lo[a], r.at); hi[a] = Math.min(hi[a], S[a] - eps); }
  else { lo[a] = Math.max(lo[a], S[a] + eps); hi[a] = Math.min(hi[a], r.at); }
  if (hi[a] - lo[a] < 1e-4) return null;
  const out = [];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) out.push(x, y, z);
  return out;
}

/**
 * Every texel of region r whose middle is inside a convex polygon (2D texel coordinates) and within `reach` texels of
 * (cu, cv) → fn(index into the region, i, j).
 */
function fill(poly, r, cu, cv, reach, fn) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of poly) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const j0 = Math.max(0, Math.ceil(y0), Math.ceil(cv - reach)), j1 = Math.min(r.nv - 1, Math.floor(y1), Math.floor(cv + reach));
  const n = poly.length;
  for (let j = j0; j <= j1; j++) {
    let xl = Infinity, xr = -Infinity;
    for (let e = 0; e < n; e++) {
      const p = poly[e], q = poly[(e + 1) % n];
      if ((p[1] <= j && q[1] >= j) || (q[1] <= j && p[1] >= j)) {
        if (p[1] === q[1]) { xl = Math.min(xl, p[0], q[0]); xr = Math.max(xr, p[0], q[0]); continue; }
        const x = p[0] + ((j - p[1]) * (q[0] - p[0])) / (q[1] - p[1]);
        if (x < xl) xl = x; if (x > xr) xr = x;
      }
    }
    if (xl > xr) continue;
    const dv = j - cv, chord = reach * reach - dv * dv;
    if (chord < 0) continue;
    const half = Math.sqrt(chord);
    const i0 = Math.max(0, Math.ceil(xl), Math.ceil(cu - half)), i1 = Math.min(r.nu - 1, Math.floor(xr), Math.floor(cu + half));
    for (let i = i0; i <= i1; i++) fn(j * r.nu + i, i, j);
  }
}

/** Is a box hung flat on region r's wall (its back against it, thin)? */
const hungOn = (b, r) => { const lo = [b.x0, b.y0, b.z0][r.a], hi = [b.x1, b.y1, b.z1][r.a]; return hi - lo <= SHADOWS.flat && Math.min(Math.abs(lo - r.at), Math.abs(hi - r.at)) < 0.03; };
const inside = (b, S, m = 0.02) => S[0] > b.x0 - m && S[0] < b.x1 + m && S[1] > b.y0 - m && S[1] < b.y1 + m && S[2] > b.z0 - m && S[2] < b.z1 + m;
const boxDist = (b, x, y, z) => Math.hypot(x - Math.max(b.x0, Math.min(x, b.x1)), y - Math.max(b.y0, Math.min(y, b.y1)), z - Math.max(b.z0, Math.min(z, b.z1)));

/** The ambient light a group brings to a point facing n (luminance), as kit.js bake() shares it out. */
function ambientOf(g, ambLum, hemi, lighting, weights) {
  if (!lighting) return g === 0 ? ambLum * hemi : 0;
  if (g === 0) return ambLum * hemi * (1 - (lighting.ambientShare || 0));
  if (g === 1) return 0;
  return ambLum * hemi * (lighting.ambientShare || 0) * (weights[g - 2] || 0);
}

/**
 * The room's tube shadows. lights: the room's lamps (a lamp with `spill` set — light from next door — is never
 * shadowed); boxes: [{ x0, y0, z0, x1, y1, z1 }] in the room's frame. → { ratio: per group a Float32Array over the atlas
 * (null for a group nothing hides), touched (texels with any shadow), polygons, ms } — or null if no shadow falls.
 */
export function bakeShadows({ layout, lights, amb, lighting = null, boxes }) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!layout || !boxes.length) return null;
  const G = groupCount(lighting), N = layout.width * layout.height;
  const hidden = Array.from({ length: G }, () => null);
  const lamps = lights.filter((L) => !L.spill && (L.r + L.g + L.b) > 1e-6).map((L) => ({ L, g: groupOf(L, lighting), pts: lampPoints(L), reach: lampReach(L, L.y) }));
  const ambLum = (amb[0] + amb[1] + amb[2]) / 3, P = [0, 0, 0];
  let polygons = 0, touched = 0;
  const any = new Uint8Array(N);
  for (const r of layout.list) {
    const size = r.nu * r.nv, stamp = new Int32Array(size).fill(-1), cnt = new Uint8Array(size), list = [];
    let cur = 0;
    for (const l of lamps) {
      const L = l.L, toPlane = Math.abs(L[['x', 'y', 'z'][r.a]] - r.at), reach = l.reach;
      if (toPlane > reach) continue;
      const near = boxes.filter((b) => boxDist(b, L.x, L.y, L.z) < reach && !(r.a !== 1 && hungOn(b, r)));
      if (!near.length) continue;
      const S = [0, 0, 0], inPlane = Math.sqrt(Math.max(0, reach * reach - toPlane * toPlane)) / r.cell;
      for (const pt of l.pts) {
        S[0] = pt[0]; S[1] = pt[1]; S[2] = pt[2]; cur++;
        const cu = (S[r.u] - r.o[0]) / r.cell - 0.5, cv = (S[r.v] - r.o[1]) / r.cell - 0.5;
        for (const b of near) {
          if (inside(b, S, SHADOWS.housing)) continue;            // (a lamp's own fitting: part of the lamp)
          const corners = boxBetween(b, S, r); if (!corners) continue;
          const poly = hull(project(corners, S, r)); if (!poly) continue;
          polygons++;
          fill(poly, r, cu, cv, inPlane, (k) => { if (stamp[k] !== cur) { stamp[k] = cur; if (cnt[k]++ === 0) list.push(k); } });
        }
      }
      if (!list.length) continue;
      const n = l.pts.length, nn = r.n;
      if (!hidden[l.g]) hidden[l.g] = new Float32Array(N);
      const H = hidden[l.g];
      for (const k of list) {
        const i = k % r.nu, j = (k - i) / r.nu;
        texelPoint(r, i, j, P);
        const I = lampLum(L, P[0], P[1], P[2], nn[0], nn[1], nn[2]);
        const a = (r.py + j) * layout.width + r.px + i;
        if (I > 0) { H[a] += I * (cnt[k] / n); any[a] = 1; }
        cnt[k] = 0;
      }
      list.length = 0;
    }
  }
  if (!hidden.some(Boolean)) return null;
  // the light each group brings, where any of it is hidden, and so the share that still arrives
  const ratio = hidden.map((H) => (H ? new Float32Array(N).fill(1) : null));
  const count = lighting ? lighting.bankCount || 2 : 0, ceiling = lighting ? lighting.ceilingBanks || count : 0;
  const U = new Float64Array(G);
  for (const r of layout.list) {
    const nn = r.n, hemi = 0.8 + 0.2 * nn[1];
    for (let j = 0; j < r.nv; j++) for (let i = 0; i < r.nu; i++) {
      const a = (r.py + j) * layout.width + r.px + i;
      if (!any[a]) continue;
      touched++;
      texelPoint(r, i, j, P);
      U.fill(0);
      for (const L of lights) { const g = groupOf(L, lighting); if (hidden[g]) U[g] += lampLum(L, P[0], P[1], P[2], nn[0], nn[1], nn[2]); }
      const weights = lighting ? bankWeights(lights, P[0], P[2], count, ceiling) : null;
      for (let g = 0; g < G; g++) {
        const H = hidden[g]; if (!H || !(H[a] > 0)) continue;
        const A = ambientOf(g, ambLum, hemi, lighting, weights), direct = U[g], total = A + direct;
        if (total < 1e-7 || direct < 1e-9) continue;
        const lost = Math.min(H[a], direct), seen = 1 - lost / direct;
        ratio[g][a] = Math.max(A > 0 ? SHADOWS.least : 0, Math.min(1, (direct - lost + A * (1 - SHADOWS.ambHide * (1 - seen))) / total));
      }
    }
  }
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { ratio, touched, polygons, ms: t1 - t0 };
}

/**
 * The ratios as bytes, in the textures the shader reads: A (RG: steady, flicker; or RGBA with the first two banks)
 * and, with more than two banks, B (RG: banks 2 and 3). Texels nothing hides are 255; each region's gutter repeats its
 * edge. → { A: { data, channels }, B?: { data, channels } }
 */
/* ---- light through a doorway (the Graphics setting's `doorlight`) -------------------------------------------------
 * The lamps of the room next door, seen through the opening: for each of their points, the opening's two faces (this
 * room's side of the wall and the other room's) are projected onto the floor and each wall, and where both shapes
 * overlap the light comes through. What stands on either side near the doorway, and the open leaves of a hung door,
 * cut it as they cut the tubes' light. One channel a doorway: added light, not a share, scaled each frame by how open
 * the doorway is and how bright the room next door is (world.js). */

/** A planar polygon ([[x, y, z], …]) cut to lo ≤ p[a] ≤ hi. */
function clipAxis(poly, a, lo, hi) {
  const cut = (pts, keep, at) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], pin = keep(p[a]), qin = keep(q[a]);
      if (pin) out.push(p);
      if (pin !== qin) { const t = (at - p[a]) / (q[a] - p[a]); out.push(p.map((v, k) => v + t * (q[k] - v))); }
    }
    return out;
  };
  let pts = cut(poly, (v) => v >= lo, lo);
  if (pts.length >= 3) pts = cut(pts, (v) => v <= hi, hi);
  return pts.length >= 3 ? pts : null;
}

/** The overlap of two convex polygons (2D, counter-clockwise) → polygon or null. */
function overlap(subject, clip) {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const pts = out; out = [];
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], q = pts[(k + 1) % pts.length], sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    }
  }
  return out.length >= 3 ? out : null;
}

/**
 * The light one doorway lets into a room. faces: the opening on this room's side of the wall and on the far side (each
 * four [x, y, z] corners, in this room's frame); lamps: [{ L (a lamp, moved into this room's frame), g (its group in its
 * own room), pts }]; boxes: what stands near the doorway on either side, in this room's frame; skip: the region the
 * doorway is in (its own wall). → { patch: Float32Array over the atlas, energy: per group the light it brings, peak } or null.
 */
export function bakeDoorway({ layout, faces, lamps, boxes, skip, groups = 6 }) {
  const N = layout.width * layout.height, P = [0, 0, 0], eps = 0.02;
  let patch = null, peak = 0;
  const energy = new Float64Array(groups);
  const mid = [0, 1, 2].map((k) => faces[0].reduce((s, p) => s + p[k], 0) / 4);
  for (const r of layout.list) {
    if (r.name === skip) continue;
    const size = r.nu * r.nv, lit = new Int32Array(size).fill(-1), blocked = new Int32Array(size).fill(-1), list = [];
    let cur = 0;
    for (const l of lamps) {
      const L = l.L, reach = lampReach(L, 2);
      if (Math.hypot(L.x - mid[0], L.y - mid[1], L.z - mid[2]) > reach) continue;
      const near = boxes.filter((b) => boxDist(b, L.x, L.y, L.z) < reach);
      for (const S of l.pts) {
        const lo = r.at < S[r.a] ? r.at : S[r.a] + eps, hi = r.at < S[r.a] ? S[r.a] - eps : r.at;
        const f0 = clipAxis(faces[0], r.a, lo, hi), f1 = f0 && clipAxis(faces[1], r.a, lo, hi);
        if (!f1) continue;
        const p0 = hull(project(f0.flat(), S, r)), p1 = p0 && hull(project(f1.flat(), S, r));
        const shape = p1 && overlap(p0, p1);
        if (!shape) continue;
        cur++; list.length = 0;
        const cu = (S[r.u] - r.o[0]) / r.cell - 0.5, cv = (S[r.v] - r.o[1]) / r.cell - 0.5, far = (reach + 1) / r.cell;
        fill(shape, r, cu, cv, far, (k) => { lit[k] = cur; list.push(k); });
        if (!list.length) continue;
        for (const b of near) {
          if (inside(b, S, 0.02)) continue;
          const corners = boxBetween(b, S, r); if (!corners) continue;
          const poly = hull(project(corners, S, r)); if (!poly) continue;
          fill(poly, r, cu, cv, far, (k) => { if (lit[k] === cur) blocked[k] = cur; });
        }
        const nn = r.n, share = 1 / l.pts.length;
        for (const k of list) {
          if (blocked[k] === cur) continue;
          const i = k % r.nu, j = (k - i) / r.nu;
          texelPoint(r, i, j, P);
          const I = lampLum(L, P[0], P[1], P[2], nn[0], nn[1], nn[2], S[0], S[1], S[2]) * share;
          if (!(I > 0)) continue;
          if (!patch) patch = new Float32Array(N);
          const a = (r.py + j) * layout.width + r.px + i;
          patch[a] += I; energy[l.g] += I;
        }
      }
    }
  }
  if (!patch) return null;
  for (let a = 0; a < N; a++) if (patch[a] > peak) peak = patch[a];
  return peak > 1e-5 ? { patch, energy, peak } : null;
}

/** Up to four doorways' patches → RGBA bytes (one doorway a channel, stored as the square root of its share of its peak). */
export function packDoorways(layout, patches) {
  const N = layout.width * layout.height, data = new Uint8Array(N * 4);
  patches.forEach((p, d) => { for (let a = 0; a < N; a++) if (p.patch[a] > 0) data[a * 4 + d] = Math.round(Math.sqrt(Math.min(1, p.patch[a] / p.peak)) * 255); });
  gutter(layout, data, 4);
  return { data, channels: 4 };
}

export function packShadows(layout, ratio) {
  const N = layout.width * layout.height, G = ratio.length;
  const byte = (g, a) => (ratio[g] ? Math.round(Math.max(0, Math.min(1, ratio[g][a])) * 255) : 255);
  const cA = G > 2 ? 4 : 2, A = new Uint8Array(N * cA).fill(255);
  const B = G > 4 ? new Uint8Array(N * 2).fill(255) : null;
  for (let a = 0; a < N; a++) {
    for (let c = 0; c < cA; c++) A[a * cA + c] = byte(c, a);
    if (B) { B[a * 2] = byte(4, a); B[a * 2 + 1] = byte(5, a); }
  }
  gutter(layout, A, cA); if (B) gutter(layout, B, 2);
  return { A: { data: A, channels: cA }, B: B ? { data: B, channels: 2 } : null };
}

export const SMOOTH_SHADOW_PASSES = Object.freeze({ tubes: 1, doors: 2 });

/** Fill each region's gutter with its edge texels (so a bilinear lookup at its edge reads only itself). */
export function gutter(layout, data, ch) {
  const w = layout.width, h = layout.height, pad = SHADOWS.pad;
  for (const r of layout.list) {
    for (let j = -pad; j < r.nv + pad; j++) for (let i = -pad; i < r.nu + pad; i++) {
      if (i >= 0 && j >= 0 && i < r.nu && j < r.nv) continue;
      const dx = r.px + i, dy = r.py + j;
      if (dx < 0 || dx >= w || dy < 0 || dy >= h) continue;
      const si = Math.max(0, Math.min(r.nu - 1, i)), sj = Math.max(0, Math.min(r.nv - 1, j));
      const d = (dy * w + dx) * ch, s = ((r.py + sj) * w + r.px + si) * ch;
      for (let c = 0; c < ch; c++) data[d + c] = data[s + c];
    }
  }
}

/**
 * Separable [1, 2, 1] / 4 soft-penumbra filter applied strictly inside each atlas region { px, py, nu, nv }.
 * Clamps neighbor reads to each region's bounds so shadows never bleed across floor/wall boundaries, then
 * refreshes the 1-texel gutter around every region for hardware LinearFilter. Works for 1..4 channels.
 * Pure by default (returns a fresh Uint8Array); pass { inPlace: true } to mutate `data` in place.
 */
export function blurLightmap(data, layout, channels, passes = 1, opt = null) {
  let nPasses = passes;
  let inPlace = !!(opt && opt.inPlace);
  if (passes && typeof passes === 'object') {
    nPasses = passes.passes ?? 1;
    inPlace = !!passes.inPlace;
  }
  const W = layout?.width || 0, H = layout?.height || 0;
  const ch = channels || (W && H ? Math.round(data.length / (W * H)) : 0);
  const out = inPlace ? data : new Uint8Array(data);
  if (!W || !H || !layout?.list?.length || ch < 1 || ch > 4 || data.length < W * H * ch || nPasses <= 0) return out;
  const tmp = new Uint8Array(out.length);
  for (let pass = 0; pass < nPasses; pass++) {
    for (const r of layout.list) {
      if (r.nu <= 0 || r.nv <= 0) continue;
      const x0 = r.px, x1 = r.px + r.nu - 1, y0 = r.py, y1 = r.py + r.nv - 1;
      for (let y = y0; y <= y1; y++) {
        const row = y * W;
        for (let x = x0; x <= x1; x++) {
          const xl = x > x0 ? x - 1 : x0, xr = x < x1 ? x + 1 : x1;
          const o = (row + x) * ch, ol = (row + xl) * ch, or = (row + xr) * ch;
          for (let c = 0; c < ch; c++) tmp[o + c] = (out[ol + c] + (out[o + c] << 1) + out[or + c] + 2) >> 2;
        }
      }
      for (let y = y0; y <= y1; y++) {
        const yu = y > y0 ? y - 1 : y0, yd = y < y1 ? y + 1 : y1;
        const row = y * W, rowU = yu * W, rowD = yd * W;
        for (let x = x0; x <= x1; x++) {
          const o = (row + x) * ch, ou = (rowU + x) * ch, od = (rowD + x) * ch;
          for (let c = 0; c < ch; c++) out[o + c] = (tmp[ou + c] + (tmp[o + c] << 1) + tmp[od + c] + 2) >> 2;
        }
      }
    }
  }
  gutter(layout, out, ch);
  return out;
}

/**
 * The shader's numbers for a layout: per region (floor, back, front, left, right) uv = (coord − origin) × scale +
 * offset as [scaleU, scaleV, offsetU, offsetV] in the room's own units (0s for a region that is not there), and the
 * room's half-size and the step. Matches kit.js's `tube shadows (lightmap)` block.
 * Pass `opt = { smooth: true, gpu?: boolean }` for continuous bilinear sampling (`0` on WebGPU, `1e-4` on WebGL);
 * omitting `opt` or `{ smooth: false }` keeps classic `SHADOWS.step` (0.05 m).
 */
export function layoutUniforms(layout, W, D, opt = null) {
  let opts = opt;
  if (W && typeof W === 'object') {
    opts = W;
    W = undefined;
    D = undefined;
  }
  if (typeof W !== 'number' || typeof D !== 'number') {
    const fl = layout?.regions?.floor;
    const bk = layout?.regions?.back || layout?.regions?.front;
    const lt = layout?.regions?.left || layout?.regions?.right;
    W = typeof W === 'number' ? W : (fl ? -fl.o[0] * 2 : bk ? -bk.o[0] * 2 : lt ? Math.abs(lt.at) * 2 : 0);
    D = typeof D === 'number' ? D : (fl ? -fl.o[1] * 2 : lt ? -lt.o[0] * 2 : bk ? Math.abs(bk.at) * 2 : 0);
  }
  const step = opts?.smooth ? (opts.gpu ? 0 : 1e-4) : SHADOWS.step;
  const out = REGIONS.map((name) => {
    const r = layout?.regions[name];
    if (!r) return [0, 0, 0, 0];
    // texel i's middle (coord o + (i + .5) cell) at uv (px + i + .5) / width
    return [1 / (r.cell * layout.width), 1 / (r.cell * layout.height), (r.px - r.o[0] / r.cell) / layout.width, (r.py - r.o[1] / r.cell) / layout.height];
  });
  out.push([W / 2, D / 2, step, 0]);
  return out;
}

/** Which region a point of the room (facing n) is on, as the shader decides it: → region name or null. */
export function regionOf(layout, W, D, x, y, z, nx, ny, nz) {
  if (!layout) return null;
  const R = layout.regions, e = 0.04;
  if (Math.abs(x) > W / 2 + 0.002 || Math.abs(z) > D / 2 + 0.002) return null;
  if (R.floor && ny > 0.7 && Math.abs(y) < e) return 'floor';
  if (Math.abs(ny) >= 0.3) return null;
  if (R.back && nz > 0.7 && Math.abs(z + D / 2) < e) return 'back';
  if (R.front && nz < -0.7 && Math.abs(z - D / 2) < e) return 'front';
  if (R.left && nx > 0.7 && Math.abs(x + W / 2) < e) return 'left';
  if (R.right && nx < -0.7 && Math.abs(x - W / 2) < e) return 'right';
  return null;
}

/**
 * A texel's value, read as the shader reads it (positions snapped to the step grid, then a bilinear lookup in the
 * region), from bytes with `ch` channels → [channel values 0…1] — for things that move (world.js lightAt) and tests.
 */
export function sampleMap(layout, data, ch, W, D, x, y, z, nx = 0, ny = 1, nz = 0) {
  const name = regionOf(layout, W, D, x, y, z, nx, ny, nz);
  if (!name) return null;
  const r = layout.regions[name], p = [x, y, z], st = SHADOWS.step;
  const snap = (v, o) => (Math.floor((v - o) / st) + 0.5) * st + o;
  const u = (snap(p[r.u], r.o[0]) - r.o[0]) / r.cell - 0.5, v = (snap(p[r.v], r.o[1]) - r.o[1]) / r.cell - 0.5;
  const cu = Math.max(-0.5, Math.min(r.nu - 0.5, u)), cv = Math.max(-0.5, Math.min(r.nv - 0.5, v));
  const i0 = Math.floor(cu), j0 = Math.floor(cv), fu = cu - i0, fv = cv - j0, w = layout.width, out = [];
  const at = (i, j, c) => data[((r.py + j) * w + r.px + i) * ch + c] / 255;
  for (let c = 0; c < ch; c++) {
    const a = at(i0, j0, c) * (1 - fu) + at(i0 + 1, j0, c) * fu, b = at(i0, j0 + 1, c) * (1 - fu) + at(i0 + 1, j0 + 1, c) * fu;
    out.push(a * (1 - fv) + b * fv);
  }
  return out;
}
