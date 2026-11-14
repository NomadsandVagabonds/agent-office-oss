// The Office — Pix: a tiny pixel rasterizer with depth.
//
// The 2D office draws everything with a handful of p5 calls (rect, ellipse,
// triangle, line…). Pix speaks that same vocabulary, so the original drawing
// code ports almost line for line — but instead of painting an antialiased
// canvas it fills a crisp grid of cells, and every cell remembers how DEEP it
// is. That one grid can then become either
//   · a flat pixel sprite (toCanvas), or
//   · a little voxel sculpture with real thickness (see voxel.js).
// So each character, hat, desk item and agent-authored creation keeps exactly
// the look it has always had, and gains a third dimension for free.
//
// Coordinates follow the 2D code: x right, y DOWN, origin wherever the caller
// puts it. Depth z is in the same pixel units, positive toward the viewer.

const RELIEF = 0.22;        // how far a repaint stands proud of what it covers

function parseColor(args) {
  if (args.length >= 3) {
    return { r: args[0] | 0, g: args[1] | 0, b: args[2] | 0, a: args.length > 3 ? args[3] / 255 : 1 };
  }
  if (args.length === 2 && typeof args[0] === 'number') {
    return { r: args[0] | 0, g: args[0] | 0, b: args[0] | 0, a: args[1] / 255 };
  }
  const v = args[0];
  if (typeof v === 'number') return { r: v | 0, g: v | 0, b: v | 0, a: 1 };
  if (v && typeof v === 'object') return { r: v.r, g: v.g, b: v.b, a: v.a ?? 1 };
  const s = String(v).trim();
  if (s[0] === '#') {
    const h = s.slice(1);
    if (h.length === 3) return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: 1 };
    return {
      r: parseInt(h.slice(0, 2), 16) || 0, g: parseInt(h.slice(2, 4), 16) || 0, b: parseInt(h.slice(4, 6), 16) || 0,
      a: h.length >= 8 ? (parseInt(h.slice(6, 8), 16) || 0) / 255 : 1,
    };
  }
  const m = /rgba?\(([^)]+)\)/.exec(s);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0] | 0, g: p[1] | 0, b: p[2] | 0, a: p.length > 3 ? p[3] : 1 };
  }
  return { r: 154, g: 154, b: 166, a: 1 };
}

export class Pix {
  /**
   * @param {{x0:number,y0:number,x1:number,y1:number}} bounds  the region of
   *        drawing space this grid covers (integers)
   */
  constructor(bounds) {
    this.x0 = bounds.x0; this.y0 = bounds.y0;
    this.w = bounds.x1 - bounds.x0; this.h = bounds.y1 - bounds.y0;
    /** per cell: null or an array of {z0,z1,r,g,b} from back to front */
    this.cells = new Array(this.w * this.h).fill(null);
    /** translucent paint (glows, steam): {i,j,r,g,b,a} — drawn flat, never solid */
    this.glows = [];
    this.m = [1, 0, 0, 1, 0, 0];
    this.stack = [];
    this._fill = { r: 0, g: 0, b: 0, a: 1 };
    this._stroke = null;
    this._sw = 1;
    this._z = [-1, 1];
    this._auto = 0;              // >0 → derive depth from the shape, capped at this
    this._back = false;          // painting the far side
    this._shape = null;
  }

  /* ---- state ----------------------------------------------------------- */
  fill(...a) { this._fill = parseColor(a); return this; }
  noFill() { this._fill = null; return this; }
  stroke(...a) { this._stroke = parseColor(a); return this; }
  noStroke() { this._stroke = null; return this; }
  strokeWeight(w) { this._sw = w; return this; }
  push() { this.stack.push({ m: this.m.slice(), f: this._fill, s: this._stroke, sw: this._sw, z: this._z, auto: this._auto, back: this._back }); }
  pop() {
    const s = this.stack.pop();
    if (!s) return;
    this.m = s.m; this._fill = s.f; this._stroke = s.s; this._sw = s.sw; this._z = s.z; this._auto = s.auto; this._back = s.back;
  }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(sx, sy = sx) { const m = this.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; }
  rotate(t) {
    const m = this.m, c = Math.cos(t), s = Math.sin(t);
    const a = m[0] * c + m[2] * s, b = m[1] * c + m[3] * s;
    const cc = -m[0] * s + m[2] * c, d = -m[1] * s + m[3] * c;
    m[0] = a; m[1] = b; m[2] = cc; m[3] = d;
  }
  /** Explicit depth for what follows: the slab spans z0..z1. */
  z(z0, z1) { this._z = [z0, z1]; this._auto = 0; return this; }
  /** Derive depth from each shape's own size (centred on z = `centre`). */
  zAuto(maxDepth = 8, centre = 0) { this._auto = maxDepth; this._zc = centre; return this; }
  /** Paint the far side: repaints land behind what is there instead of in front. */
  back(on = true) { this._back = on; return this; }

  /* ---- plotting -------------------------------------------------------- */
  _tx(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4] - this.x0, m[1] * x + m[3] * y + m[5] - this.y0]; }
  _axisAligned() { return this.m[1] === 0 && this.m[2] === 0; }

  _plot(i, j, col, half) {
    if (i < 0 || j < 0 || i >= this.w || j >= this.h || !col) return;
    if (col.a < 0.34) { this.glows.push({ i, j, r: col.r, g: col.g, b: col.b, a: col.a }); return; }
    const k = j * this.w + i;
    let cell = this.cells[k];
    let { r, g, b } = col;
    let z0, z1;
    if (this._auto) {
      const hd = Math.max(0.5, Math.min(this._auto / 2, half ?? this._auto / 2));
      z0 = (this._zc || 0) - hd; z1 = (this._zc || 0) + hd;
    } else {
      [z0, z1] = this._z;
    }
    if (!cell) {
      this.cells[k] = [{ z0, z1, r, g, b }];
      return;
    }
    if (col.a < 1) {                       // translucent paint tints what is there
      const top = this._back ? cell[0] : cell[cell.length - 1];
      r = Math.round(top.r + (r - top.r) * col.a);
      g = Math.round(top.g + (g - top.g) * col.a);
      b = Math.round(top.b + (b - top.b) * col.a);
    }
    if (this._back) {
      const first = cell[0];
      const nz1 = Math.min(first.z0, z1);
      const nz0 = Math.min(nz1 - RELIEF, z0);
      cell.unshift({ z0: nz0, z1: nz1, r, g, b });
    } else {
      const last = cell[cell.length - 1];
      const nz0 = Math.max(last.z1, z0);
      const nz1 = Math.max(nz0 + RELIEF, z1);
      cell.push({ z0: nz0, z1: nz1, r, g, b });
    }
  }

  /** Fill every cell whose centre passes `inside(px, py)` within a device bbox. */
  _scan(bx0, by0, bx1, by1, col, inside, halfOf) {
    const i0 = Math.max(0, Math.floor(bx0)), i1 = Math.min(this.w - 1, Math.ceil(bx1));
    const j0 = Math.max(0, Math.floor(by0)), j1 = Math.min(this.h - 1, Math.ceil(by1));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const t = inside(i + 0.5, j + 0.5);
        if (t === false || t === undefined) continue;
        this._plot(i, j, col, halfOf ? halfOf(i + 0.5, j + 0.5, t) : undefined);
      }
    }
  }

  _poly(pts, col) {
    if (!col || pts.length < 3) return;
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const [x, y] of pts) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
    const j0 = Math.max(0, Math.floor(by0)), j1 = Math.min(this.h - 1, Math.ceil(by1));
    for (let j = j0; j <= j1; j++) {
      const y = j + 0.5;
      const xs = [];
      for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
        const [xa, ya] = pts[a], [xb, yb] = pts[b];
        if ((ya > y) !== (yb > y)) xs.push(xa + ((y - ya) / (yb - ya)) * (xb - xa));
      }
      xs.sort((p, q) => p - q);
      for (let s = 0; s + 1 < xs.length; s += 2) {
        const span = xs[s + 1] - xs[s];
        const i0 = Math.max(0, Math.ceil(xs[s] - 0.5)), i1 = Math.min(this.w - 1, Math.floor(xs[s + 1] - 0.5));
        for (let i = i0; i <= i1; i++) this._plot(i, j, col, span / 2);
      }
    }
  }

  /* ---- primitives (the p5 subset the office uses) ---------------------- */
  rect(x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    const col = this._fill;
    if (!col) return;
    if (this._axisAligned()) {
      const [ax, ay] = this._tx(x, y), [bx, by] = this._tx(x + w, y + h);
      const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
      const half = Math.min(x1 - x0, 1e9) / 2;
      const i0 = Math.max(0, Math.ceil(x0 - 0.5)), i1 = Math.min(this.w - 1, Math.floor(x1 - 0.5 - 1e-6));
      const j0 = Math.max(0, Math.ceil(y0 - 0.5)), j1 = Math.min(this.h - 1, Math.floor(y1 - 0.5 - 1e-6));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this._plot(i, j, col, half);
    } else {
      this._poly([this._tx(x, y), this._tx(x + w, y), this._tx(x + w, y + h), this._tx(x, y + h)], col);
    }
  }

  ellipse(cx, cy, w, h = w) {
    const rx = w / 2, ry = h / 2;
    if (rx <= 0 || ry <= 0) return;
    const m = this.m;
    const det = m[0] * m[3] - m[1] * m[2] || 1;
    const corners = [this._tx(cx - rx, cy - ry), this._tx(cx + rx, cy - ry), this._tx(cx + rx, cy + ry), this._tx(cx - rx, cy + ry)];
    const bx0 = Math.min(...corners.map((c) => c[0])), bx1 = Math.max(...corners.map((c) => c[0]));
    const by0 = Math.min(...corners.map((c) => c[1])), by1 = Math.max(...corners.map((c) => c[1]));
    const local = (px, py) => {
      const dx = px + this.x0 - m[4], dy = py + this.y0 - m[5];
      return [(m[3] * dx - m[2] * dy) / det, (-m[1] * dx + m[0] * dy) / det];
    };
    if (this._fill) {
      const sx = Math.hypot(m[0], m[1]);
      this._scan(bx0, by0, bx1, by1, this._fill, (px, py) => {
        const [lx, ly] = local(px, py);
        const q = ((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2;
        return q <= 1 ? q : false;
      }, (px, py, q) => Math.min(rx, ry) * sx * Math.sqrt(Math.max(0, 1 - q)));   // a ball, not a coin
    }
    if (this._stroke) this._arcStroke(cx, cy, rx, ry, 0, Math.PI * 2);
  }

  triangle(x1, y1, x2, y2, x3, y3) { this._poly([this._tx(x1, y1), this._tx(x2, y2), this._tx(x3, y3)], this._fill); }
  quad(x1, y1, x2, y2, x3, y3, x4, y4) {
    this._poly([this._tx(x1, y1), this._tx(x2, y2), this._tx(x3, y3), this._tx(x4, y4)], this._fill);
  }
  beginShape() { this._shape = []; }
  vertex(x, y) { if (this._shape) this._shape.push(this._tx(x, y)); }
  endShape() { if (this._shape) this._poly(this._shape, this._fill); this._shape = null; }

  _dot(px, py, col, weight) {
    const r = Math.max(0.5, weight / 2);
    if (r <= 0.75) { this._plot(Math.floor(px), Math.floor(py), col, r); return; }
    for (let j = Math.floor(py - r); j <= Math.floor(py + r); j++) {
      for (let i = Math.floor(px - r); i <= Math.floor(px + r); i++) {
        if ((i + 0.5 - px) ** 2 + (j + 0.5 - py) ** 2 <= r * r) this._plot(i, j, col, r);
      }
    }
  }

  line(x1, y1, x2, y2) {
    const col = this._stroke;
    if (!col) return;
    const [ax, ay] = this._tx(x1, y1), [bx, by] = this._tx(x2, y2);
    const weight = this._sw * Math.hypot(this.m[0], this.m[1]);
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
    let li = null, lj = null;
    for (let s = 0; s <= steps; s++) {
      const px = ax + (bx - ax) * (s / steps), py = ay + (by - ay) * (s / steps);
      if (weight <= 1.5) {
        const i = Math.floor(px), j = Math.floor(py);
        if (i === li && j === lj) continue;
        li = i; lj = j;
      }
      this._dot(px, py, col, weight);
    }
  }

  _arcStroke(cx, cy, rx, ry, a0, a1) {
    const col = this._stroke;
    if (!col) return;
    const weight = this._sw * Math.hypot(this.m[0], this.m[1]);
    const steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) * Math.hypot(this.m[0], this.m[1]) * 2));
    for (let s = 0; s <= steps; s++) {
      const t = a0 + (a1 - a0) * (s / steps);
      const [px, py] = this._tx(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry);
      this._dot(px, py, col, weight);
    }
  }

  arc(cx, cy, w, h, a0, a1) {
    const rx = w / 2, ry = h / 2;
    if (this._fill) {
      const pts = [];
      const steps = Math.max(6, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry)));
      for (let s = 0; s <= steps; s++) {
        const t = a0 + (a1 - a0) * (s / steps);
        pts.push(this._tx(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry));
      }
      this._poly(pts, this._fill);
    }
    if (this._stroke) this._arcStroke(cx, cy, rx, ry, a0, a1);
  }

  /* ---- output ---------------------------------------------------------- */

  /** Is there anything solid at this cell? */
  solid(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && !!this.cells[j * this.w + i]; }

  /** Paint the grid, as seen from the front (or the back), onto a canvas. */
  toCanvas(scale = 1, fromBack = false, target) {
    const canvas = target || document.createElement('canvas');
    canvas.width = this.w * scale; canvas.height = this.h * scale;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const cell = this.cells[j * this.w + i];
        if (!cell) continue;
        const c = fromBack ? cell[0] : cell[cell.length - 1];
        ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
        ctx.fillRect((fromBack ? this.w - 1 - i : i) * scale, j * scale, scale, scale);
      }
    }
    for (const gl of this.glows) {
      ctx.fillStyle = `rgba(${gl.r},${gl.g},${gl.b},${gl.a})`;
      ctx.fillRect((fromBack ? this.w - 1 - gl.i : gl.i) * scale, gl.j * scale, scale, scale);
    }
    return canvas;
  }

  /** Bounding box of what was actually drawn, in drawing coordinates. */
  extent() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      if (!this.cells[j * this.w + i]) continue;
      x0 = Math.min(x0, i); x1 = Math.max(x1, i + 1); y0 = Math.min(y0, j); y1 = Math.max(y1, j + 1);
    }
    if (x0 === Infinity) return null;
    return { x0: x0 + this.x0, y0: y0 + this.y0, x1: x1 + this.x0, y1: y1 + this.y0 };
  }
}

/* ---- colour helpers shared by all the ported art ------------------------ */
export function hex2rgb(h) {
  const c = parseColor([h]);
  return [c.r, c.g, c.b];
}
export function shade(h, d) {
  const c = parseColor([h]);
  const k = (v) => Math.max(0, Math.min(255, v + d));
  return `rgb(${k(c.r)},${k(c.g)},${k(c.b)})`;
}
export function lerpHex(a, b, t) {
  const A = parseColor([a]), B = parseColor([b]);
  return `rgb(${(A.r + (B.r - A.r) * t) | 0},${(A.g + (B.g - A.g) * t) | 0},${(A.b + (B.b - A.b) * t) | 0})`;
}
export function toHex(c) {
  const { r, g, b } = parseColor([c]);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
