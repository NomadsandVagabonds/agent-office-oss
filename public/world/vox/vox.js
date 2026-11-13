// The Office — Vox: sculpting with small cubes.
//
// Everything you can touch in the 3D office — people, chairs, mugs, the coffee
// machine — is modelled in code as a field of 2.5 cm voxels, then meshed once
// (mesher.js) into a compact, shaded surface. A model is a short function:
//
//   const v = new Vox();
//   v.rbox(-8, 0, -4, 8, 12, 4, 2, '#3f7f9a');     // a rounded block
//   v.ellipsoid(0, 16, 0, 5, 5, 5, '#f3cda8');     // a ball on top
//
// Coordinates are whole voxels: x right, y UP, z toward the viewer. Boxes are
// [min, max) — the max is exclusive, so `box(0,0,0, 4,2,4)` is 4×2×4 voxels.
// The origin is wherever you draw around; by convention the floor is y = 0 and
// models are centred on x = z = 0.

export const VOXEL = 0.025;                 // metres per voxel

const SOLID = 0x01000000;
export const GLOW = 0x02000000;             // self-lit (screens, LEDs, lamps)
export const GLASS = 0x04000000;            // see-through
const TEX_SHIFT = 27;                       // 2 bits: how much per-voxel colour variation
const BIAS = 512, MASK = 1023;              // sparse keys: 10 bits per axis

const key = (x, y, z) => ((x + BIAS) & MASK) | (((y + BIAS) & MASK) << 10) | (((z + BIAS) & MASK) << 20);

/** '#rrggbb' | 0xRRGGBB | packed voxel → packed voxel (colour + flags). */
export function C(color, opt) {
  let rgb;
  if (typeof color === 'number') {
    if (color & SOLID && !opt) return color;
    rgb = color & 0xffffff;
  } else {
    const s = String(color).replace('#', '');
    rgb = s.length === 3
      ? parseInt(s[0] + s[0] + s[1] + s[1] + s[2] + s[2], 16)
      : parseInt(s.slice(0, 6), 16);
  }
  let v = (rgb & 0xffffff) | SOLID;
  const tex = opt?.tex ?? 1;
  v |= (Math.max(0, Math.min(3, tex)) << TEX_SHIFT);
  if (opt?.glow) v |= GLOW;
  if (opt?.glass) v |= GLASS;
  return v >>> 0;
}
/** A material: colour plus surface character. tex 0 = flat plastic … 3 = rough cloth. */
export const M = (color, tex = 1, extra) => C(color, { tex, ...(extra || {}) });
export const glow = (color) => C(color, { tex: 0, glow: true });
export const glass = (color) => C(color, { tex: 0, glass: true });

export const rgbOf = (v) => v & 0xffffff;
export const texOf = (v) => (v >>> TEX_SHIFT) & 3;
export const isGlow = (v) => (v & GLOW) !== 0;
export const isGlass = (v) => (v & GLASS) !== 0;

/** Lighten (+) or darken (−) a colour by a fraction, keeping its flags. */
export function tone(color, amount) {
  const v = C(color);
  let r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  if (amount >= 0) { r += (255 - r) * amount; g += (255 - g) * amount; b += (255 - b) * amount; }
  else { r *= 1 + amount; g *= 1 + amount; b *= 1 + amount; }
  return ((v & 0xff000000) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)) >>> 0;
}
export function mix(a, b, t) {
  const p = C(a), q = C(b);
  const ch = (s) => Math.round(((p >> s) & 255) + (((q >> s) & 255) - ((p >> s) & 255)) * t);
  return ((p & 0xff000000) | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0;
}
export const toCss = (color) => '#' + (C(color) & 0xffffff).toString(16).padStart(6, '0');

export class Vox {
  constructor() {
    /** sparse: key → packed voxel */
    this.map = new Map();
  }

  /* ---- single voxels --------------------------------------------------- */
  set(x, y, z, color) {
    if (x < -BIAS || y < -BIAS || z < -BIAS || x >= BIAS || y >= BIAS || z >= BIAS) return this;
    if (!color) this.map.delete(key(x, y, z));
    else this.map.set(key(x, y, z), typeof color === 'number' && (color & SOLID) ? color : C(color));
    return this;
  }
  get(x, y, z) { return this.map.get(key(x, y, z)) || 0; }
  has(x, y, z) { return this.map.has(key(x, y, z)); }

  /** Call fn(x, y, z, voxel) for every voxel. */
  each(fn) {
    for (const [k, v] of this.map) fn((k & MASK) - BIAS, ((k >> 10) & MASK) - BIAS, ((k >> 20) & MASK) - BIAS, v);
    return this;
  }

  bounds() {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    this.each((x, y, z) => {
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z;
      if (x >= x1) x1 = x + 1; if (y >= y1) y1 = y + 1; if (z >= z1) z1 = z + 1;
    });
    return this.map.size ? { x0, y0, z0, x1, y1, z1 } : { x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0 };
  }

  /* ---- shapes ---------------------------------------------------------- */
  // Every shape takes a colour (or 0 to carve). `fn(x,y,z)` may be passed in
  // place of a colour to shade a shape as it is laid down.
  _fill(x0, y0, z0, x1, y1, z1, color, inside) {
    const paint = typeof color === 'function' ? color : null;
    const flat = paint ? 0 : (color ? C(color) : 0);
    for (let x = Math.floor(x0); x < x1; x++) {
      for (let y = Math.floor(y0); y < y1; y++) {
        for (let z = Math.floor(z0); z < z1; z++) {
          if (inside && !inside(x + 0.5, y + 0.5, z + 0.5)) continue;
          this.set(x, y, z, paint ? paint(x, y, z) : flat);
        }
      }
    }
    return this;
  }

  box(x0, y0, z0, x1, y1, z1, color) { return this._fill(x0, y0, z0, x1, y1, z1, color); }

  /**
   * A box with rounded corners. `r` is the corner radius in voxels; `axes`
   * says which edges get rounded: 'xyz' all of them (a pillow), 'xz' only the
   * vertical edges (a rounded column), 'xy' the edges you see from the front.
   */
  rbox(x0, y0, z0, x1, y1, z1, r, color, axes = 'xyz') {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const hx = (x1 - x0) / 2, hy = (y1 - y0) / 2, hz = (z1 - z0) / 2;
    const rr = Math.max(0, Math.min(r, hx, hy, hz));
    const ux = axes.includes('x'), uy = axes.includes('y'), uz = axes.includes('z');
    return this._fill(x0, y0, z0, x1, y1, z1, color, (x, y, z) => {
      const qx = ux ? Math.max(Math.abs(x - cx) - (hx - rr), 0) : 0;
      const qy = uy ? Math.max(Math.abs(y - cy) - (hy - rr), 0) : 0;
      const qz = uz ? Math.max(Math.abs(z - cz) - (hz - rr), 0) : 0;
      return qx * qx + qy * qy + qz * qz <= rr * rr + 0.3;
    });
  }

  ellipsoid(cx, cy, cz, rx, ry, rz, color) {
    return this._fill(cx - rx, cy - ry, cz - rz, cx + rx + 1, cy + ry + 1, cz + rz + 1, color, (x, y, z) =>
      ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1);
  }
  sphere(cx, cy, cz, r, color) { return this.ellipsoid(cx, cy, cz, r, r, r, color); }

  /** A cylinder (or cone, when r1 differs) standing along `axis` from a to b. */
  cyl(axis, c1, c2, a, b, r0, color, r1 = r0) {
    const rmax = Math.max(r0, r1);
    const inside = (u, v, t) => {
      const r = r0 + (r1 - r0) * ((t - a) / Math.max(1e-6, b - a));
      return (u - c1) ** 2 + (v - c2) ** 2 <= r * r;
    };
    if (axis === 'y') return this._fill(c1 - rmax, a, c2 - rmax, c1 + rmax + 1, b, c2 + rmax + 1, color, (x, y, z) => inside(x, z, y));
    if (axis === 'x') return this._fill(a, c1 - rmax, c2 - rmax, b, c1 + rmax + 1, c2 + rmax + 1, color, (x, y, z) => inside(y, z, x));
    return this._fill(c1 - rmax, c2 - rmax, a, c1 + rmax + 1, c2 + rmax + 1, b, color, (x, y, z) => inside(x, y, z));
  }

  /** A capsule between two points: limbs, cables, handles. */
  tube(x0, y0, z0, x1, y1, z1, r, color) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const len2 = dx * dx + dy * dy + dz * dz || 1e-6;
    return this._fill(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.min(z0, z1) - r,
      Math.max(x0, x1) + r + 1, Math.max(y0, y1) + r + 1, Math.max(z0, z1) + r + 1, color, (x, y, z) => {
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy + (z - z0) * dz) / len2));
        return (x - x0 - dx * t) ** 2 + (y - y0 - dy * t) ** 2 + (z - z0 - dz * t) ** 2 <= r * r;
      });
  }

  /** A ring lying flat (around the y axis): halos, rims, cup handles on their side. */
  ring(cx, cy, cz, R, r, color, axis = 'y') {
    const e = R + r + 1;
    return this._fill(cx - e, cy - e, cz - e, cx + e + 1, cy + e + 1, cz + e + 1, color, (x, y, z) => {
      const [u, v, w] = axis === 'y' ? [x - cx, z - cz, y - cy] : axis === 'x' ? [y - cy, z - cz, x - cx] : [x - cx, y - cy, z - cz];
      return (Math.hypot(u, v) - R) ** 2 + w * w <= r * r;
    });
  }

  /* ---- carving + repainting -------------------------------------------- */
  carve(x0, y0, z0, x1, y1, z1) { return this._fill(x0, y0, z0, x1, y1, z1, 0); }

  /** Recolour voxels that already exist inside a box (leaves empty space alone). */
  paint(x0, y0, z0, x1, y1, z1, color) {
    const fn = typeof color === 'function' ? color : null;
    const flat = fn ? 0 : C(color);
    for (let x = Math.floor(x0); x < x1; x++) for (let y = Math.floor(y0); y < y1; y++) for (let z = Math.floor(z0); z < z1; z++) {
      const cur = this.get(x, y, z);
      if (!cur) continue;
      const next = fn ? fn(x, y, z, cur) : flat;
      if (next) this.set(x, y, z, next);
    }
    return this;
  }

  /** Recolour every voxel through fn(x, y, z, voxel) → voxel (or 0 to delete). */
  remap(fn) {
    for (const [k, v] of [...this.map]) {
      const next = fn((k & MASK) - BIAS, ((k >> 10) & MASK) - BIAS, ((k >> 20) & MASK) - BIAS, v);
      if (!next) this.map.delete(k);
      else if (next !== v) this.map.set(k, C(next));
    }
    return this;
  }

  /** Is this voxel on the outside of the model, facing direction (dx,dy,dz)? */
  exposed(x, y, z, dx, dy, dz) { return this.has(x, y, z) && !this.has(x + dx, y + dy, z + dz); }

  /**
   * Paint onto the SURFACE as seen from a direction — the way you would stick
   * a decal on. For each (u, v) in the rectangle, the first voxel met when
   * looking along −dir gets the colour. dir: '+z' front, '-z' back, '+x', '-x', '+y' top.
   */
  decal(dir, u0, v0, u1, v1, color, depth = 1) {
    const b = this.bounds();
    const fn = typeof color === 'function' ? color : null;
    const flat = fn ? 0 : C(color);
    for (let u = Math.floor(u0); u < u1; u++) for (let v = Math.floor(v0); v < v1; v++) {
      let hits = 0;
      const step = (x, y, z) => {
        if (!this.has(x, y, z)) return hits > 0;
        this.set(x, y, z, fn ? fn(u, v) : flat);
        return ++hits >= depth;
      };
      if (dir === '+z') { for (let z = b.z1 - 1; z >= b.z0; z--) if (step(u, v, z)) break; }
      else if (dir === '-z') { for (let z = b.z0; z < b.z1; z++) if (step(u, v, z)) break; }
      else if (dir === '+x') { for (let x = b.x1 - 1; x >= b.x0; x--) if (step(x, v, u)) break; }
      else if (dir === '-x') { for (let x = b.x0; x < b.x1; x++) if (step(x, v, u)) break; }
      else if (dir === '+y') { for (let y = b.y1 - 1; y >= b.y0; y--) if (step(u, y, v)) break; }
    }
    return this;
  }

  /* ---- whole-model operations ------------------------------------------ */
  /** Copy another model in, shifted. `over:false` keeps what is already here. */
  stamp(other, dx = 0, dy = 0, dz = 0, over = true) {
    other.each((x, y, z, v) => { if (over || !this.has(x + dx, y + dy, z + dz)) this.set(x + dx, y + dy, z + dz, v); });
    return this;
  }

  /** Mirror the x < 0 half onto x ≥ 0 (model half a symmetric thing, then call this). */
  mirrorX() {
    this.each((x, y, z, v) => { if (x < 0) this.set(-x - 1, y, z, v); });
    return this;
  }

  /** Rotate a quarter turn about y (n times), e.g. to face a prop another way. */
  turned(n = 1) {
    const out = new Vox();
    const k = ((n % 4) + 4) % 4;
    this.each((x, y, z, v) => {
      let nx = x, nz = z;
      for (let i = 0; i < k; i++) { const t = nx; nx = -nz - 1; nz = t; }
      out.set(nx, y, nz, v);
    });
    return out;
  }

  clone() { const out = new Vox(); out.map = new Map(this.map); return out; }
  get size() { return this.map.size; }
}

/** A stable 0..1 hash of a voxel position — for hand-made-looking variation. */
export function noise3(x, y, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
