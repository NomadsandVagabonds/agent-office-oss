// The Backrooms — the building kit: the shared language every room is written
// in. Wallpaper, carpet and ceiling-tile textures; batches that gather a whole
// room's surfaces and furniture into a handful of meshes; and the lighting.
//
// Light contributions are baked ONCE, when a room is
// built, from that room's ceiling panels (and anything else that glows), and
// the result is stored on the vertex. That is what lets a level of twenty
// rooms, each with a dozen fluorescent panels, run on anything: the picture
// has pools of light under the tubes and gloom under the dead ones, and the
// GPU only ever multiplies two colours. A flickering tube keeps its share of
// the light in a second attribute, so it can stutter by itself. The optional
// lighting study adds two ceiling-bank contributions; changing their strength
// costs a multiply, with no shadow maps or per-frame geometry rebuilds.
import * as THREE from 'three';
import { canvasTexture, shade } from '../scene/textures.js';
import { meshVox } from '../vox/mesher.js';
import { VOXEL } from '../vox/vox.js';
import { bankWeights } from './lighting.js';

const GLOW = 2.3;                              // how hard a self-lit voxel shines

const tmpColor = new THREE.Color();
/** '#rrggbb' → [r, g, b] in the linear space lighting is done in. */
export function lin(hex, k = 1) { tmpColor.set(hex); return [tmpColor.r * k, tmpColor.g * k, tmpColor.b * k]; }
const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const P = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

/** Where to cut a span so vertex lighting has something to hold on to: a loop near each end, then every `step`. */
export function ticks(len, step = 0.5, edge = 0.16) {
  const out = [0];
  // (edge 0 is "no margin", not "a margin of nothing": it used to add a strip of no width at each end, and a plain box
  // came out as 108 triangles, 96 of them with no area)
  if (edge > 0 && len > edge * 3) out.push(edge);
  const n = Math.max(1, Math.round(len / step));
  for (let i = 1; i < n; i++) { const v = (i * len) / n; if (v > edge * 1.7 && v < len - edge * 1.7) out.push(v); }
  if (edge > 0 && len > edge * 3) out.push(len - edge);
  out.push(len);
  return out;
}
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const WHITE = [1, 1, 1];

/* ---- batches ---------------------------------------------------------------- */

/** Geometry under construction: positions, normals, texture coords and the paint colour of every vertex. */
export class Batch {
  constructor(vox = false) {
    this.vox = vox;
    this.pos = []; this.nor = []; this.uv = []; this.alb = []; this.ao = []; this.idx = [];
    this.vx = []; this.sf = [];                // voxel batches: where in its model a vertex sits, and its grain + glow
  }
  get verts() { return this.pos.length / 3; }

  /**
   * A flat sheet: origin o, unit edge directions U and V, cut at the distances in us and vs.
   * It faces U × V. uvOf(u, v) → [s, t]; aoOf(u, v) → 0..1 darkening for creases;
   * liftOf, if given, moves each vertex to its own height.
   */
  grid(o, U, V, us, vs, uvOf, alb = WHITE, aoOf = null, liftOf = null) {
    const nx = U[1] * V[2] - U[2] * V[1], ny = U[2] * V[0] - U[0] * V[2], nz = U[0] * V[1] - U[1] * V[0];
    const base = this.verts, nu = us.length, nv = vs.length;
    for (const v of vs) for (const u of us) {
      const x = o[0] + U[0] * u + V[0] * v, z = o[2] + U[2] * u + V[2] * v;
      // liftOf(u, v, x, z) → the height this vertex really sits at (sloping ceilings, walls cut to fit them)
      this.pos.push(x, liftOf ? liftOf(u, v, x, z) : o[1] + U[1] * u + V[1] * v, z);
      this.nor.push(nx, ny, nz);
      const t = uvOf ? uvOf(u, v) : null;
      this.uv.push(t ? t[0] : 0, t ? t[1] : 0);
      this.alb.push(alb[0], alb[1], alb[2]);
      this.ao.push(aoOf ? aoOf(u, v) : 1);
    }
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) {
      const a = base + j * nu + i;
      this.idx.push(a, a + 1, a + nu + 1, a, a + nu + 1, a + nu);
    }
    return this;
  }

  /** One quad from four corners, counter-clockwise as seen from the side it faces. uv: [[s,t]×4] or null. */
  quad(a, b, c, d, alb = WHITE, uv = null, ao = 1) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
    const base = this.verts;
    [a, b, c, d].forEach((p, i) => {
      this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz);
      this.uv.push(uv ? uv[i][0] : i === 1 || i === 2 ? 1 : 0, uv ? uv[i][1] : i >= 2 ? 1 : 0);
      this.alb.push(alb[0], alb[1], alb[2]); this.ao.push(ao);
    });
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }

  /** A triangle (a quad with two corners in the same place). */
  tri(a, b, c, alb = WHITE) { return this.quad(a, b, c, c, alb, [[0, 0], [1, 0], [0.5, 1], [0.5, 1]]); }

  /** A ball, or an egg: radius r, squashed by sy. */
  ball(cx, cy, cz, r, alb = WHITE, sy = 1, seg = 8) {
    const base = this.verts, rings = Math.max(3, seg - 2);
    for (let j = 0; j <= rings; j++) {
      const phi = (j / rings) * Math.PI, y = Math.cos(phi), rr = Math.sin(phi);
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * Math.PI * 2, x = Math.cos(th) * rr, z = Math.sin(th) * rr;
        this.pos.push(cx + x * r, cy + y * r * sy, cz + z * r); this.nor.push(x, y, z);
        this.uv.push(i / seg, 1 - j / rings); this.alb.push(alb[0], alb[1], alb[2]); this.ao.push(0.82 + 0.18 * (y * 0.5 + 0.5));
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a = base + j * (seg + 1) + i, b = a + seg + 1;
      this.idx.push(a, a + 1, b + 1, a, b + 1, b);
    }
    return this;
  }

  /**
   * A box. Long faces are cut every metre so light can vary along them.
   * opt.skip: faces to leave out, e.g. '-y' (the underside) or '+z-z'. opt.uv: metres per texture repeat.
   */
  box(x0, y0, z0, x1, y1, z1, alb = WHITE, opt = {}) {
    const skip = opt.skip || '', s = opt.uv || 0, step = opt.step || 1.0;
    const face = (name, o, U, V, lu, lv, uvOf) => {
      if (skip.includes(name) || lu <= 0 || lv <= 0) return;
      this.grid(o, U, V, ticks(lu, step, 0), ticks(lv, step, 0), s ? uvOf : null, alb, opt.ao ? () => opt.ao : null);
    };
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    face('+z', [x0, y0, z1], [1, 0, 0], [0, 1, 0], w, h, (u, v) => [(x0 + u) / s, (y0 + v) / s]);
    face('-z', [x1, y0, z0], [-1, 0, 0], [0, 1, 0], w, h, (u, v) => [(x1 - u) / s, (y0 + v) / s]);
    face('+x', [x1, y0, z1], [0, 0, -1], [0, 1, 0], d, h, (u, v) => [(z1 - u) / s, (y0 + v) / s]);
    face('-x', [x0, y0, z0], [0, 0, 1], [0, 1, 0], d, h, (u, v) => [(z0 + u) / s, (y0 + v) / s]);
    face('+y', [x0, y1, z1], [1, 0, 0], [0, 0, -1], w, d, (u, v) => [(x0 + u) / s, (z1 - v) / s]);
    face('-y', [x0, y0, z0], [1, 0, 0], [0, 0, 1], w, d, (u, v) => [(x0 + u) / s, (z0 + v) / s]);
    return this;
  }

  /**
   * Fold a meshed voxel model in, moved by `m`. The model keeps its own
   * colours and ambient occlusion; tint multiplies them, mono repaints the
   * whole thing in shades of one colour.
   */
  addVox(geo, m, opt = {}) {
    if (!geo) return this;
    const p = geo.attributes.position, n = geo.attributes.normal, c = geo.attributes.color, t = geo.attributes.aTex, e = geo.attributes.aEmis;
    const base = this.verts, v = new THREE.Vector3(), q = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m);
    const tint = opt.tint, mono = opt.mono;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); q.fromBufferAttribute(n, i);
      this.vx.push(v.x - q.x * 0.5, v.y - q.y * 0.5, v.z - q.z * 0.5);
      v.applyMatrix4(m); q.applyMatrix3(nm).normalize();
      this.pos.push(v.x, v.y, v.z); this.nor.push(q.x, q.y, q.z);
      let r = c.getX(i), g = c.getY(i), b = c.getZ(i);
      const glow = e ? e.getX(i) : 0;
      if (mono && !glow) { const l = (r * 0.3 + g * 0.55 + b * 0.15) * 1.9 + 0.08; r = mono[0] * l; g = mono[1] * l; b = mono[2] * l; }
      if (tint) { r *= tint[0]; g *= tint[1]; b *= tint[2]; }
      this.alb.push(r, g, b); this.ao.push(1);
      this.sf.push(t ? t.getX(i) : 0, opt.noGlow ? 0 : glow);
    }
    const index = geo.index.array, flip = m.determinant() < 0;
    for (let k = 0; k < index.length; k += 3) this.idx.push(base + index[k], base + index[k + (flip ? 2 : 1)], base + index[k + (flip ? 1 : 2)]);
    return this;
  }
}

/* ---- lighting, once ---------------------------------------------------------- */

/**
 * A baked light. `lobe` makes it shine mostly along (ax, ay, az) — a ceiling
 * panel shines down; `floor` is how much still leaks sideways. `k` sets how
 * quickly it fades (bigger reaches further).
 */
export function lamp(x, y, z, rgb, o = {}) {
  return { x, y, z, r: rgb[0], g: rgb[1], b: rgb[2], k: o.k ?? 3.2, wrap: o.wrap ?? 0.3, lobe: !!o.axis, ax: o.axis?.[0] || 0, ay: o.axis?.[1] || 0, az: o.axis?.[2] || 0,
    floor: o.floor ?? 0.25, flick: !!o.flick, bank: o.bank, far2: (o.far ?? 14) ** 2 };
}

/** Light every vertex of a batch. → { lit, flk } (flk only if a flickering light reaches it). */
export function bake(batch, lights, amb, lighting = null) {
  const n = batch.verts, pos = batch.pos, nor = batch.nor, alb = batch.alb, ao = batch.ao, sf = batch.sf;
  const lit = new Float32Array(n * 3);
  let flk = null;
  const banked = (l) => lighting && (l.bank === 0 || l.bank === 1);
  const steady = lights.filter((l) => !banked(l) && !l.flick), flicker = lights.filter((l) => !banked(l) && l.flick);
  const bankLights = lighting ? [0, 1].map((k) => lights.filter((l) => l.bank === k)) : null;
  const banks = lighting ? [new Float32Array(n * 3), new Float32Array(n * 3)] : null;
  const sum = [0, 0, 0];
  const gather = (list, px, py, pz, nx, ny, nz) => {
    let r = 0, g = 0, b = 0;
    for (const L of list) {
      const dx = L.x - px, dy = L.y - py, dz = L.z - pz, d2 = dx * dx + dy * dy + dz * dz + 0.02;
      if (d2 > L.far2) continue;
      const inv = 1 / Math.sqrt(d2);
      let s = ((nx * dx + ny * dy + nz * dz) * inv + L.wrap) / (1 + L.wrap);
      if (s <= 0) continue;
      if (L.lobe) s *= L.floor + (1 - L.floor) * Math.max(0, -(dx * L.ax + dy * L.ay + dz * L.az) * inv);
      const fade = 1 - d2 / L.far2;
      s *= fade * fade / (1 + d2 / L.k);
      r += L.r * s; g += L.g * s; b += L.b * s;
    }
    sum[0] = r; sum[1] = g; sum[2] = b;
  };
  for (let i = 0; i < n; i++) {
    const j = i * 3, ar = alb[j], ag = alb[j + 1], ab = alb[j + 2];
    if (batch.vox && sf[i * 2 + 1] > 0.5) { lit[j] = ar * GLOW; lit[j + 1] = ag * GLOW; lit[j + 2] = ab * GLOW; continue; }
    const px = pos[j], py = pos[j + 1], pz = pos[j + 2], nx = nor[j], ny = nor[j + 1], nz = nor[j + 2];
    const hemi = 0.8 + 0.2 * ny, k = ao[i];
    gather(steady, px, py, pz, nx, ny, nz);
    const base = 1 - (lighting?.ambientShare || 0);
    lit[j] = ar * k * (amb[0] * hemi * base + sum[0]); lit[j + 1] = ag * k * (amb[1] * hemi * base + sum[1]); lit[j + 2] = ab * k * (amb[2] * hemi * base + sum[2]);
    if (banks) {
      const weights = bankWeights(lights, px, pz);
      for (let b = 0; b < 2; b++) {
        gather(bankLights[b], px, py, pz, nx, ny, nz);
        for (let c = 0; c < 3; c++) banks[b][j + c] = alb[j + c] * k * (sum[c] + amb[c] * hemi * lighting.ambientShare * weights[b]);
      }
    }
    if (flicker.length) {
      gather(flicker, px, py, pz, nx, ny, nz);
      if (sum[0] + sum[1] + sum[2] > 1e-4) {
        if (!flk) flk = new Float32Array(n * 3);
        flk[j] = ar * k * sum[0]; flk[j + 1] = ag * k * sum[1]; flk[j + 2] = ab * k * sum[2];
      }
    }
  }
  return { lit, flk, banks };
}

/** The light arriving at a point facing (nx, ny, nz) — for things that move after the bake. */
export function lightAt(lights, amb, x, y, z, nx = 0, ny = 1, nz = 0, runtime = {}) {
  const probe = { verts: 1, pos: [x, y, z], nor: [nx, ny, nz], alb: [1, 1, 1], ao: [1], sf: [0, 0], vox: false };
  const { lit, flk, banks } = bake(probe, lights, amb, runtime.lighting);
  return [0, 1, 2].map((c) => lit[c] + (flk ? flk[c] * (runtime.flick ?? 1) : 0)
    + (banks ? banks[0][c] * (runtime.banks?.[0] ?? 1) + banks[1][c] * (runtime.banks?.[1] ?? 1) : 0));
}

/* ---- the kit ----------------------------------------------------------------- */

const VERT = `
attribute vec3 aLit;
attribute vec3 aAlb;
#ifdef BANKS
attribute vec3 aBank0;
attribute vec3 aBank1;
uniform vec2 uBanks;
#endif
#ifdef FLICK
attribute vec3 aFlk;
#endif
#ifdef VOXEL
attribute vec3 aVox;
attribute vec2 aSurf;
varying vec3 vVox;
varying vec2 vSurf;
#endif
uniform float uFlick;
uniform float uDim;
uniform vec3 uTint;
varying vec3 vLit;
varying vec3 vAlb;
varying vec2 vUv;
varying vec3 vView;
void main() {
  vUv = uv;
  vec3 lit = aLit;
  #ifdef BANKS
  lit += aBank0 * uBanks.x + aBank1 * uBanks.y;
  #endif
  #ifdef FLICK
  lit += aFlk * uFlick;
  #endif
  lit *= uDim;
  #ifdef VOXEL
  vVox = aVox; vSurf = aSurf;
  lit = mix(lit, aLit, aSurf.y);
  #endif
  vLit = lit * uTint; vAlb = aAlb;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D map;
uniform float uTorch;
uniform float uAlpha;
varying vec3 vLit;
varying vec3 vAlb;
varying vec2 vUv;
varying vec3 vView;
#ifdef VOXEL
varying vec3 vVox;
varying vec2 vSurf;
float voxHash(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
#endif
void main() {
  vec3 c = vLit;
  // the camcorder's own little lamp: only matters where the room is dark
  float d = length(vView);
  float cone = smoothstep(0.60, 0.97, -vView.z / max(d, 0.0001));
  vec3 torch = vAlb * (uTorch * cone / (1.0 + d * d * 0.2));
  #ifdef VOXEL
  c += torch * (1.0 - vSurf.y);
  vec3 cell = floor(vVox + 0.0005);
  c *= 1.0 + (voxHash(cell) - 0.5) * 2.0 * vSurf.x;
  vec3 fr = abs(fract(vVox) - 0.5) * 2.0;
  float edge = smoothstep(0.80, 1.0, max(fr.x, max(fr.y, fr.z)));
  c *= 1.0 - 0.06 * edge * (0.4 + 6.0 * vSurf.x) * (1.0 - vSurf.y);
  #else
  c += torch;
  #endif
  #ifdef MAPPED
  vec4 t = texture2D(map, vUv);
  #ifdef CUTOUT
  if (t.a < 0.5) discard;
  #endif
  c *= t.rgb;
  #endif
  gl_FragColor = vec4(c, uAlpha);
}`;

/**
 * Everything a level needs to build rooms, and one place that remembers what
 * to throw away afterwards.
 */
export function createKit() {
  const owned = new Set();
  const own = (thing) => { if (thing) owned.add(thing); return thing; };
  const shared = { uTorch: { value: 0 } };
  const textures = new Map();
  const tex = (key, make) => { if (!textures.has(key)) textures.set(key, own(make())); return textures.get(key); };

  /* textures: drawn once per colourway */
  const T = {
    white: () => tex('white', () => canvasTexture(2, 2, (g) => P(g, '#ffffff', 0, 0, 2, 2))),
    /** Wallpaper: a 0.8 m repeat of a small motif, a little uneven, the way old paper is. */
    wallpaper: (look) => tex(`wp${look.wall}${look.ink}${look.pattern}`, () => canvasTexture(32, 32, (g, w, h) => {
      const { wall, ink, pale } = look;
      P(g, wall, 0, 0, w, h);
      const r = lcg(look.wall.length * 977 + parseInt(look.wall.slice(1), 16));
      for (let i = 0; i < 46; i++) P(g, shade(wall, (r() - 0.5) * 0.045), (r() * w) | 0, (r() * h) | 0, 1, 2 + ((r() * 4) | 0));
      if (look.pattern === 'dots') { for (let y = 2; y < h; y += 8) for (let x = ((y - 2) / 8) % 2 ? 6 : 2; x < w; x += 8) { P(g, ink, x, y, 2, 2); P(g, pale, x, y - 1, 1, 1); } }
      else if (look.pattern === 'diamonds') { for (let y = 4; y < h; y += 16) for (let x = ((y - 4) / 16) % 2 ? 12 : 4; x < w; x += 16) { P(g, ink, x, y - 2, 1, 5); P(g, ink, x - 1, y - 1, 3, 3); P(g, ink, x - 2, y, 5, 1); P(g, pale, x, y, 1, 1); } }
      else if (look.pattern === 'stripes') { for (let x = 2; x < w; x += 8) { P(g, ink, x, 0, 2, h); P(g, pale, x + 3, 0, 1, h); } }
      else if (look.pattern === 'trellis') { for (let i = 0; i < w; i++) { P(g, ink, i, i, 1, 1); P(g, ink, w - 1 - i, i, 1, 1); P(g, ink, (i + 16) % w, i, 1, 1); P(g, ink, (w - 1 - i + 16) % w, i, 1, 1); } for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) P(g, pale, x + 7, y + 7, 2, 2); }
      // the three that are not paper at all (themes.js): painted blockwork, bare plasterboard, panelling
      else if (look.pattern === 'blocks') { for (let y = 0; y < h; y += 8) { P(g, ink, 0, y, w, 1); P(g, pale, 0, y + 1, w, 1); for (let x = (y / 8) % 2 ? 8 : 0; x < w; x += 16) P(g, ink, x, y, 1, 8); } for (let i = 0; i < 30; i++) P(g, shade(wall, -0.07), (r() * w) | 0, (r() * h) | 0, 2, 1); }
      else if (look.pattern === 'board') { P(g, pale, 14, 0, 4, h); P(g, shade(wall, -0.05), 13, 0, 1, h); P(g, shade(wall, -0.05), 18, 0, 1, h); for (let y = 3; y < h; y += 8) { P(g, ink, 10, y, 1, 1); P(g, ink, 21, y, 1, 1); P(g, ink, 0, y + 4, 1, 1); } }
      else if (look.pattern === 'panel') { P(g, ink, 0, 0, w, 2); P(g, ink, 0, 0, 2, h); P(g, pale, 2, 2, w - 2, 1); P(g, pale, 2, 2, 1, h - 2); P(g, ink, 6, 6, w - 10, 1); P(g, ink, 6, 6, 1, h - 10); P(g, pale, 6, h - 5, w - 10, 1); P(g, pale, w - 5, 6, 1, h - 10); for (let x = 3; x < w; x += 3) P(g, shade(wall, (r() - 0.5) * 0.09), x, 2, 1, h - 2); }
      else if (look.pattern === 'sprigs') { for (let y = 5; y < h; y += 16) for (let x = ((y - 5) / 16) % 2 ? 13 : 5; x < w; x += 16) { P(g, ink, x, y, 1, 4); P(g, ink, x - 1, y + 1, 3, 1); P(g, pale, x - 1, y - 1, 1, 1); P(g, pale, x + 1, y - 1, 1, 1); P(g, pale, x, y - 2, 1, 1); } }
      else { for (let y = 3; y < h; y += 8) for (let x = 0; x < w; x++) { const k = x % 8; P(g, ink, x, y + (k < 4 ? k : 7 - k), 1, 1); } }
    })),
    /** Carpet: 1.6 m of speckle, slightly darker in patches, as if it never quite dried. */
    carpet: (color) => tex('cp' + color, () => canvasTexture(64, 64, (g, w, h) => {
      P(g, color, 0, 0, w, h);
      const r = lcg(parseInt(color.slice(1), 16));
      for (let i = 0; i < 9; i++) { g.fillStyle = shade(color, -0.05); g.beginPath(); g.ellipse(r() * w, r() * h, 5 + r() * 9, 3 + r() * 6, r() * 3, 0, 7); g.fill(); }
      for (let y = 0; y < h; y += 2) for (let x = (y / 2) & 1 ? 1 : 0; x < w; x += 2) { const n = r(); if (n > 0.66) P(g, shade(color, 0.08), x, y, 1, 1); else if (n < 0.3) P(g, shade(color, -0.1), x, y, 1, 1); }
    })),
    /** What is underfoot on this floor of the building: carpet, mostly — but lino in Records, screed where they are still fitting out, and something deeper upstairs. */
    floor: (look) => (look.floor === 'lino' ? T.lino(look.carpet) : look.floor === 'screed' ? T.screed(look.carpet) : look.floor === 'plush' ? T.plush(look.carpet, look.pale) : T.carpet(look.carpet)),
    /** Vinyl tiles, 0.4 m, two tones, laid chequerwise and scuffed where people turned. */
    lino: (color) => tex('lino' + color, () => canvasTexture(64, 64, (g, w, h) => {
      const r = lcg(parseInt(color.slice(1), 16) + 3);
      for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { P(g, shade(color, ((x + y) / 16) % 2 ? 0.1 : -0.04), x, y, 16, 16); P(g, shade(color, -0.2), x, y, 16, 1); P(g, shade(color, -0.2), x, y, 1, 16); }
      for (let i = 0; i < 220; i++) P(g, shade(color, (r() - 0.5) * 0.16), (r() * w) | 0, (r() * h) | 0, 1 + ((r() * 3) | 0), 1);
      for (let i = 0; i < 5; i++) { g.strokeStyle = shade(color, -0.22); g.lineWidth = 1; g.beginPath(); g.arc(r() * w, r() * h, 4 + r() * 9, r() * 6, r() * 6 + 1.2); g.stroke(); }
    })),
    /** Bare screed: grey, trowelled, with the dust of whatever has been cut on it. */
    screed: (color) => tex('screed' + color, () => canvasTexture(64, 64, (g, w, h) => {
      P(g, color, 0, 0, w, h);
      const r = lcg(parseInt(color.slice(1), 16) + 9);
      for (let i = 0; i < 16; i++) { g.fillStyle = shade(color, (r() - 0.5) * 0.12); g.beginPath(); g.ellipse(r() * w, r() * h, 6 + r() * 14, 2 + r() * 5, r() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 300; i++) P(g, shade(color, (r() - 0.45) * 0.2), (r() * w) | 0, (r() * h) | 0, 1, 1);
    })),
    /** A carpet somebody chose: deep pile, a small motif every 0.4 m. */
    plush: (color, motif) => tex('plush' + color + motif, () => canvasTexture(64, 64, (g, w, h) => {
      P(g, color, 0, 0, w, h);
      const r = lcg(parseInt(color.slice(1), 16) + 21);
      for (let y = 0; y < h; y += 2) for (let x = (y / 2) & 1 ? 1 : 0; x < w; x += 2) { const n = r(); if (n > 0.6) P(g, shade(color, 0.07), x, y, 1, 1); else if (n < 0.3) P(g, shade(color, -0.14), x, y, 1, 1); }
      for (let y = 8; y < h; y += 16) for (let x = ((y - 8) / 16) % 2 ? 16 : 8; x < w; x += 16) { P(g, shade(motif, -0.25), x, y - 1, 1, 3); P(g, shade(motif, -0.25), x - 1, y, 3, 1); }
    })),
    /** One 0.6 m ceiling tile: pinholes, and the dark T-bar it rests on. */
    ceiling: (color) => tex('ct' + color, () => canvasTexture(24, 24, (g, w, h) => {
      P(g, color, 0, 0, w, h);
      const r = lcg(parseInt(color.slice(1), 16) + 5);
      for (let i = 0; i < 34; i++) P(g, shade(color, -0.1 - r() * 0.1), 2 + ((r() * 21) | 0), 2 + ((r() * 21) | 0), 1, 1);
      P(g, shade(color, 0.1), 1, 1, w - 1, 1); P(g, shade(color, -0.12), 1, h - 1, w - 1, 1);
      P(g, '#39362c', 0, 0, w, 1); P(g, '#39362c', 0, 0, 1, h);
    })),
    /** A fluorescent troffer, two tiles long: lit, or dead. */
    panel: (lit) => tex('pn' + lit, () => canvasTexture(24, 48, (g, w, h) => {
      P(g, lit ? '#3d3b33' : '#34322b', 0, 0, w, h);
      P(g, lit ? '#b9b6a2' : '#77756a', 1, 1, w - 2, h - 2);
      for (const x of [5, 15]) { P(g, lit ? '#ffffff' : '#9d9b8e', x, 4, 4, h - 8); P(g, lit ? '#e6e3d2' : '#85837a', x - 1, 3, 6, 1); P(g, lit ? '#e6e3d2' : '#85837a', x - 1, h - 4, 6, 1); }
      P(g, lit ? '#8e8b7a' : '#5d5b52', 11, 1, 2, h - 2);
    }, { clamp: true })),
    /** A soft round shadow. */
    blob: () => tex('blob', () => { const t = canvasTexture(32, 32, (g) => { const k = g.createRadialGradient(16, 16, 1, 16, 16, 16); k.addColorStop(0, 'rgba(255,255,255,1)'); k.addColorStop(0.55, 'rgba(255,255,255,.6)'); k.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = k; g.fillRect(0, 0, 32, 32); }, { clamp: true }); t.magFilter = THREE.LinearFilter; return t; }),
    /** Brick, for whatever is behind things. */
    brick: () => tex('brick', () => canvasTexture(40, 40, (g, w, h) => {
      const c = '#7a4a40'; P(g, shade(c, -0.45), 0, 0, w, h);
      const r = lcg(51);
      for (let y = 0; y < h; y += 5) for (let x = ((y / 5) | 0) % 2 ? -5 : 0; x < w; x += 10) P(g, shade(c, (r() - 0.5) * 0.24), x, y, 9, 4);
    })),
    /** A sheet of paper with a few lines of something on it. */
    paper: (color = '#f4f1e6') => tex('paper' + color, () => canvasTexture(16, 22, (g, w, h) => {
      P(g, color, 0, 0, w, h); P(g, shade(color, -0.12), 0, h - 1, w, 1); P(g, shade(color, -0.12), w - 1, 0, 1, h);
      for (let y = 3; y < h - 3; y += 3) P(g, shade(color, -0.45), 2, y, y % 2 ? 9 : 11, 1);
    }, { clamp: true })),
    /** Anything else: a texture drawn by the caller, remembered under `key`. */
    custom: (key, w, h, draw, opt) => tex('x' + key, () => canvasTexture(w, h, draw, opt)),
    /** A fresh canvas texture nobody shares (screens that change). */
    live: (w, h, draw, opt) => own(canvasTexture(w, h, draw || (() => {}), opt)),
  };

  /** The one material: baked light × texture, with the per-room dimmer and flicker. */
  function surface({ map = null, room = null, vox = false, cutout = false, flick = false, banks = false, alpha = 1, side = THREE.FrontSide } = {}) {
    const defines = {};
    if (map) defines.MAPPED = 1;
    if (vox) defines.VOXEL = 1;
    if (cutout) defines.CUTOUT = 1;
    if (flick) defines.FLICK = 1;
    if (banks) defines.BANKS = 1;
    return own(new THREE.ShaderMaterial({
      defines, vertexShader: VERT, fragmentShader: FRAG, side,
      transparent: alpha < 1, depthWrite: alpha >= 1,
      uniforms: {
        map: { value: map }, uFlick: room ? room.flick : { value: 1 }, uDim: room ? room.dim : { value: 1 },
        uBanks: room?.banks || { value: [1, 1] },
        uTint: { value: new THREE.Vector3(1, 1, 1) }, uTorch: shared.uTorch, uAlpha: { value: alpha },
      },
    }));
  }
  /** Something that shines by itself (a lit panel, a screen, a sign): `power` above 1 blooms. */
  function glowing(map, power = 1, rgb = WHITE, opt = {}) {
    const m = own(new THREE.MeshBasicMaterial({ map, transparent: !!opt.transparent, alphaTest: opt.alphaTest || 0, side: opt.side || THREE.FrontSide, depthWrite: opt.depthWrite !== false }));
    m.color.setRGB(rgb[0] * power, rgb[1] * power, rgb[2] * power);
    return m;
  }

  /** Batch → geometry with its light baked in. */
  function geometry(batch, lights, amb, lighting = null) {
    if (!batch.verts) return null;
    const { lit, flk, banks } = bake(batch, lights, amb, lighting);
    const geo = own(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(batch.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(batch.vox ? new Float32Array(batch.verts * 2) : batch.uv, 2));
    geo.setAttribute('aLit', new THREE.BufferAttribute(lit, 3));
    if (flk) geo.setAttribute('aFlk', new THREE.BufferAttribute(flk, 3));
    if (banks) for (let b = 0; b < 2; b++) geo.setAttribute(`aBank${b}`, new THREE.BufferAttribute(banks[b], 3));
    const alb = new Uint8Array(batch.alb.length);
    for (let i = 0; i < alb.length; i++) alb[i] = Math.max(0, Math.min(255, Math.round(batch.alb[i] * 255)));
    geo.setAttribute('aAlb', new THREE.BufferAttribute(alb, 3, true));
    if (batch.vox) { geo.setAttribute('aVox', new THREE.Float32BufferAttribute(batch.vx, 3)); geo.setAttribute('aSurf', new THREE.Float32BufferAttribute(batch.sf, 2)); }
    geo.setIndex(batch.idx);
    geo.computeBoundingSphere();
    geo.userData.flick = !!flk;
    geo.userData.banks = !!banks;
    return geo;
  }
  /** Batch → plain geometry (position + uv), for things that shine by themselves. */
  function plain(batch) {
    if (!batch.verts) return null;
    const geo = own(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(batch.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(batch.uv, 2));
    geo.setIndex(batch.idx);
    geo.computeBoundingSphere();
    return geo;
  }

  /* voxel models sculpted for this level only (the office's own catalogue is borrowed, never owned) */
  const models = new Map();
  function model(key, make, opt = {}) {
    if (!models.has(key)) {
      const meshed = meshVox(make(), opt);
      own(meshed.solid); own(meshed.glass);
      models.set(key, { solid: meshed.solid, glass: meshed.glass, bounds: meshed.bounds });
    }
    return models.get(key);
  }

  return {
    own, shared, tex: T, surface, glowing, geometry, plain, model, VOXEL,
    dispose() { for (const thing of owned) thing.dispose?.(); owned.clear(); textures.clear(); models.clear(); },
  };
}

/* ---- a grid of small pictures in one texture (labels, portraits, key caps) ------- */

export function atlas(kit, key, cellW, cellH, count, draw) {
  const cols = Math.max(1, Math.min(count, Math.floor(1024 / cellW))), rows = Math.ceil(count / cols);
  const texture = kit.tex.custom(key, cols * cellW, rows * cellH, (g) => {
    for (let i = 0; i < count; i++) { g.save(); g.translate((i % cols) * cellW, Math.floor(i / cols) * cellH); g.beginPath(); g.rect(0, 0, cellW, cellH); g.clip(); draw(g, i, cellW, cellH); g.restore(); }
  }, { clamp: true });
  /** uv corners of cell i, in quad order (bottom-left, bottom-right, top-right, top-left) */
  const uv = (i) => { const u0 = (i % cols) / cols, u1 = u0 + 1 / cols, v1 = 1 - Math.floor(i / cols) / rows, v0 = v1 - 1 / rows; return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]; };
  return { texture, uv };
}

/** Crisp text on a canvas: lines centred in a box, shrunk to fit. */
export function drawText(g, lines, x, y, w, h, opt = {}) {
  const list = [].concat(lines).map(String);
  let size = opt.size || Math.floor(h / list.length * 0.8);
  const font = (s) => `${opt.weight || 700} ${s}px ${opt.font || 'ui-monospace, Menlo, Consolas, monospace'}`;
  g.font = font(size);
  while (size > 5 && Math.max(...list.map((t) => g.measureText(t).width)) > w - (opt.pad ?? 4)) { size -= 1; g.font = font(size); }
  g.fillStyle = opt.color || '#1c1812'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lh = size * (opt.leading || 1.2), top = y + h / 2 - ((list.length - 1) * lh) / 2;
  list.forEach((t, i) => g.fillText(t, x + w / 2, top + i * lh + 0.5));
  return size;
}

export { smooth, WHITE, GLOW };
