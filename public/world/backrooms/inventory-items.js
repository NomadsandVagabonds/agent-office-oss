// Detailed 3D polygon models for Backrooms pickups, held props, and HUD icons.
// Authored in 2.5 cm unit coordinates (scale = kit.VOXEL = 0.025 m on the floor)
// with real curves, bevels, negative space, and propped silhouettes.

const DEG = Math.PI / 180, TAU = Math.PI * 2;
const COLOR_CACHE = new Map();

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgb(hex, mul = 1) {
  if (Array.isArray(hex)) return mul === 1 ? hex : [hex[0] * mul, hex[1] * mul, hex[2] * mul];
  let base = COLOR_CACHE.get(hex);
  if (!base) {
    const clean = String(hex || '#ffffff').replace('#', '');
    const n = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16) || 0;
    base = [
      srgbToLinear(((n >> 16) & 255) / 255),
      srgbToLinear(((n >> 8) & 255) / 255),
      srgbToLinear((n & 255) / 255),
    ];
    COLOR_CACHE.set(hex, base);
  }
  return mul === 1 ? base : [base[0] * mul, base[1] * mul, base[2] * mul];
}

function mulMat(a, b) {
  return [
    a[0] * b[0] + a[1] * b[4] + a[2] * b[8],
    a[0] * b[1] + a[1] * b[5] + a[2] * b[9],
    a[0] * b[2] + a[1] * b[6] + a[2] * b[10],
    a[0] * b[3] + a[1] * b[7] + a[2] * b[11] + a[3],
    a[4] * b[0] + a[5] * b[4] + a[6] * b[8],
    a[4] * b[1] + a[5] * b[5] + a[6] * b[9],
    a[4] * b[2] + a[5] * b[6] + a[6] * b[10],
    a[4] * b[3] + a[5] * b[7] + a[6] * b[11] + a[7],
    a[8] * b[0] + a[9] * b[4] + a[10] * b[8],
    a[8] * b[1] + a[9] * b[5] + a[10] * b[9],
    a[8] * b[2] + a[9] * b[6] + a[10] * b[10],
    a[8] * b[3] + a[9] * b[7] + a[10] * b[11] + a[11],
  ];
}

class Sculpt {
  constructor(batch, scale = 1, opt = {}) {
    this.b = batch;
    this.grounded = !!opt.grounded;
    this.held = !!opt.held;
    this.icon = !!opt.icon;
    this.m = [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0];
    this.stack = [];
    this.nm = null;
    this.flip = false;
  }

  push() { this.stack.push(this.m.slice()); return this; }
  pop() { if (this.stack.length) { this.m = this.stack.pop(); this.nm = null; } return this; }
  apply(t) { this.m = mulMat(this.m, t); this.nm = null; return this; }
  translate(x, y, z) { return this.apply([1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z]); }
  scale(sx, sy = sx, sz = sx) { return this.apply([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0]); }
  rotateX(a) { const c = Math.cos(a), s = Math.sin(a); return this.apply([1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]); }
  rotateY(a) { const c = Math.cos(a), s = Math.sin(a); return this.apply([c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]); }
  rotateZ(a) { const c = Math.cos(a), s = Math.sin(a); return this.apply([c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]); }

  _ensureNormalMat() {
    if (this.nm) return;
    const m = this.m;
    const c00 = m[5] * m[10] - m[6] * m[9], c01 = m[6] * m[8] - m[4] * m[10], c02 = m[4] * m[9] - m[5] * m[8];
    const c10 = m[2] * m[9] - m[1] * m[10], c11 = m[0] * m[10] - m[2] * m[8], c12 = m[1] * m[8] - m[0] * m[9];
    const c20 = m[1] * m[6] - m[2] * m[5], c21 = m[2] * m[4] - m[0] * m[6], c22 = m[0] * m[5] - m[1] * m[4];
    const det = m[0] * c00 + m[1] * c01 + m[2] * c02;
    this.flip = det < 0;
    const s = det < 0 ? -1 : 1;
    this.nm = [c00 * s, c01 * s, c02 * s, c10 * s, c11 * s, c12 * s, c20 * s, c21 * s, c22 * s];
  }

  vert(x, y, z, nx, ny, nz, col, ao = 1, u = 0, v = 0) {
    this._ensureNormalMat();
    const m = this.m, nm = this.nm, b = this.b, idx = b.pos.length / 3, c = rgb(col);
    b.pos.push(
      m[0] * x + m[1] * y + m[2] * z + m[3],
      m[4] * x + m[5] * y + m[6] * z + m[7],
      m[8] * x + m[9] * y + m[10] * z + m[11],
    );
    let tx = nm[0] * nx + nm[1] * ny + nm[2] * nz;
    let ty = nm[3] * nx + nm[4] * ny + nm[5] * nz;
    let tz = nm[6] * nx + nm[7] * ny + nm[8] * nz;
    const len = Math.hypot(tx, ty, tz) || 1;
    b.nor.push(tx / len, ty / len, tz / len);
    b.uv.push(u, v);
    b.alb.push(c[0], c[1], c[2]);
    b.ao.push(ao);
    return idx;
  }

  triIdx(a, b, c) {
    this._ensureNormalMat();
    if (this.flip) this.b.idx.push(a, c, b);
    else this.b.idx.push(a, b, c);
  }

  quadIdx(a, b, c, d) {
    this.triIdx(a, b, c);
    this.triIdx(a, c, d);
  }

  faceQuad(p0, p1, p2, p3, col, ao = 1) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const a = this.vert(p0[0], p0[1], p0[2], nx, ny, nz, col, ao, 0, 0);
    const b = this.vert(p1[0], p1[1], p1[2], nx, ny, nz, col, ao, 1, 0);
    const c = this.vert(p2[0], p2[1], p2[2], nx, ny, nz, col, ao, 1, 1);
    const d = this.vert(p3[0], p3[1], p3[2], nx, ny, nz, col, ao, 0, 1);
    this.quadIdx(a, b, c, d);
    return this;
  }

  faceTri(p0, p1, p2, col, ao = 1) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const a = this.vert(p0[0], p0[1], p0[2], nx, ny, nz, col, ao, 0, 0);
    const b = this.vert(p1[0], p1[1], p1[2], nx, ny, nz, col, ao, 1, 0);
    const c = this.vert(p2[0], p2[1], p2[2], nx, ny, nz, col, ao, 0.5, 1);
    this.triIdx(a, b, c);
    return this;
  }


  /**
   * Surface of revolution around +Y.
   * pts: [[r, y, col?, ao?, crease?], ...] from bottom to top.
   */
  lathe(pts, seg = 20, opt = {}) {
    const defCol = opt.color || '#cccccc', defAo = opt.ao ?? 1;
    const colorFn = opt.colorFn || null, aoFn = opt.aoFn || null;
    const slopes = [];
    for (let j = 0; j < pts.length - 1; j++) {
      const dr = pts[j + 1][0] - pts[j][0], dy = pts[j + 1][1] - pts[j][1];
      const l = Math.hypot(dy, dr) || 1;
      slopes.push([dy / l, -dr / l]);
    }
    for (let j = 0; j < pts.length - 1; j++) {
      const p0 = pts[j], p1 = pts[j + 1];
      if (p0[0] <= 1e-5 && p1[0] <= 1e-5) continue;
      if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) <= 1e-6) continue;
      const segCol = p0[2] || defCol;
      const ao0 = p0[3] ?? defAo, ao1 = p1[3] ?? ao0;
      let s0 = slopes[j], s1 = slopes[j];
      if (j > 0 && !p0[4] && (pts[j - 1][2] || defCol) === segCol) {
        const prev = slopes[j - 1];
        if (prev[0] * s0[0] + prev[1] * s0[1] > 0.72) {
          const sx = prev[0] + s0[0], sy = prev[1] + s0[1], l = Math.hypot(sx, sy) || 1;
          s0 = [sx / l, sy / l];
        }
      }
      if (j + 1 < slopes.length && !p1[4] && (p1[2] || defCol) === segCol) {
        const next = slopes[j + 1];
        if (next[0] * s1[0] + next[1] * s1[1] > 0.72) {
          const sx = next[0] + s1[0], sy = next[1] + s1[1], l = Math.hypot(sx, sy) || 1;
          s1 = [sx / l, sy / l];
        }
      }
      const row0 = [], row1 = [];
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * TAU, c = Math.cos(th), sn = -Math.sin(th);
        const c0 = colorFn ? colorFn(th, p0[1], p0[0], j, i, segCol) : segCol;
        const c1 = colorFn ? colorFn(th, p1[1], p1[0], j + 1, i, segCol) : segCol;
        const a0 = aoFn ? aoFn(th, p0[1], p0[0], j, i, ao0) : ao0;
        const a1 = aoFn ? aoFn(th, p1[1], p1[0], j + 1, i, ao1) : ao1;
        const n0x = p0[0] <= 1e-5 ? 0 : s0[0] * c, n0y = p0[0] <= 1e-5 ? (s0[1] >= 0 ? 1 : -1) : s0[1], n0z = p0[0] <= 1e-5 ? 0 : s0[0] * sn;
        const n1x = p1[0] <= 1e-5 ? 0 : s1[0] * c, n1y = p1[0] <= 1e-5 ? (s1[1] >= 0 ? 1 : -1) : s1[1], n1z = p1[0] <= 1e-5 ? 0 : s1[0] * sn;
        row0.push(this.vert(p0[0] * c, p0[1], p0[0] * sn, n0x, n0y, n0z, c0, a0, i / seg, j / pts.length));
        row1.push(this.vert(p1[0] * c, p1[1], p1[0] * sn, n1x, n1y, n1z, c1, a1, i / seg, (j + 1) / pts.length));
      }
      for (let i = 0; i < seg; i++) {
        if (p0[0] <= 1e-5) this.triIdx(row0[i], row1[i + 1], row1[i]);
        else if (p1[0] <= 1e-5) this.triIdx(row0[i], row0[i + 1], row1[i]);
        else this.quadIdx(row0[i], row0[i + 1], row1[i + 1], row1[i]);
      }
    }
    return this;
  }

  /** Chamfered cylinder or frustum along +Y. */
  cyl(r0, r1, y0, y1, seg, col, opt = {}) {
    const h = Math.abs(y1 - y0), b = Math.min(opt.bevel ?? Math.min(r0, r1) * 0.08, h * 0.3, Math.min(r0, r1) * 0.45);
    const botCol = opt.bottomColor || col, topCol = opt.topColor || col, bevCol = opt.bevelColor || col, ao = opt.ao ?? 1;
    const pts = [];
    if (opt.capBottom !== false && r0 > 1e-4) pts.push([0, y0, botCol, ao * 0.86, true], [Math.max(0.001, r0 - b), y0, botCol, ao * 0.9, true]);
    if (b > 1e-4) pts.push([Math.max(0.001, r0 - b), y0, bevCol, ao * 0.94, true], [r0, y0 + b, col, ao, true]);
    else pts.push([r0, y0, col, ao, true]);
    if (b > 1e-4) pts.push([r1, y1 - b, bevCol, ao, true], [Math.max(0.001, r1 - b), y1, topCol, ao * 1.03, true]);
    else pts.push([r1, y1, topCol, ao, true]);
    if (opt.capTop !== false && r1 > 1e-4) pts.push([0, y1, topCol, ao * 1.02, true]);
    return this.lathe(pts, seg, { color: col, ao, colorFn: opt.colorFn, aoFn: opt.aoFn });
  }

  /** Closed hollow cylinder / roll along +Y with concentric ply bands on end faces. */
  annulus(rIn, rOut, y0, y1, seg, colors = {}) {
    const outer = colors.outer || '#c4cbd3', rim = colors.rim || outer, inner = colors.inner || '#ba935c';
    const sideA = colors.sideA || '#aeb6bf', sideB = colors.sideB || '#c7cfd7';
    const b = Math.min((rOut - rIn) * 0.14, (y1 - y0) * 0.18), plies = colors.plies || 3;
    // Outer wall + top/bottom outer bevels
    this.lathe([
      [rOut - b, y0, rim, 0.9, true],
      [rOut, y0 + b, outer, 0.96, true],
      [rOut, y1 - b, outer, 1.0, true],
      [rOut - b, y1, rim, 1.04, true],
    ], seg);
    // Inner wall (normals point inward toward axis: reverse profile top->bottom!)
    const r0 = [], r1 = [];
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * TAU, c = Math.cos(th), sn = -Math.sin(th);
      r0.push(this.vert(rIn * c, y0, rIn * sn, -c, 0, -sn, inner, 0.68 + 0.12 * (c * 0.5 + 0.5), i / seg, 0));
      r1.push(this.vert(rIn * c, y1, rIn * sn, -c, 0, -sn, inner, 0.78 + 0.12 * (c * 0.5 + 0.5), i / seg, 1));
    }
    for (let i = 0; i < seg; i++) this.quadIdx(r0[i + 1], r0[i], r1[i], r1[i + 1]);
    // Top & bottom concentric ply rings
    const span = (rOut - b) - rIn;
    for (let p = 0; p < plies; p++) {
      const ra = rIn + (span * p) / plies, rb = rIn + (span * (p + 1)) / plies;
      const col = p === 0 && colors.coreRim ? colors.coreRim : (p % 2 === 0 ? sideA : sideB);
      const topA = [], topB = [], botA = [], botB = [];
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * TAU, c = Math.cos(th), sn = -Math.sin(th);
        topA.push(this.vert(ra * c, y1, ra * sn, 0, 1, 0, col, 0.96, 0, 0));
        topB.push(this.vert(rb * c, y1, rb * sn, 0, 1, 0, col, 1.0, 1, 0));
        botA.push(this.vert(ra * c, y0, ra * sn, 0, -1, 0, col, 0.78, 0, 0));
        botB.push(this.vert(rb * c, y0, rb * sn, 0, -1, 0, col, 0.82, 1, 0));
      }
      for (let i = 0; i < seg; i++) {
        this.quadIdx(topA[i], topB[i], topB[i + 1], topA[i + 1]);
        this.quadIdx(botB[i], botA[i], botA[i + 1], botB[i + 1]);
      }
    }
    return this;
  }

  /** Watertight chamfered / rounded box of size w × h × d. */
  bevelBox(w, h, d, r, col, opt = {}) {
    const seg = opt.seg ?? 2, cyOff = opt.floor ? h * 0.5 : 0;
    const rr = Math.max(0.001, Math.min(r, w * 0.48, h * 0.48, d * 0.48));
    const hx = Math.max(0, w * 0.5 - rr), hy = Math.max(0, h * 0.5 - rr), hz = Math.max(0, d * 0.5 - rr);
    const topCol = opt.topColor || col, botCol = opt.bottomColor || col, ao = opt.ao ?? 1;
    const perim = [];
    const centers = [[hx, -hz], [-hx, -hz], [-hx, hz], [hx, hz]];
    for (let q = 0; q < 4; q++) {
      for (let k = 0; k <= seg; k++) {
        const a = q * Math.PI * 0.5 + (k / seg) * Math.PI * 0.5;
        perim.push([centers[q][0], centers[q][1], Math.cos(a), -Math.sin(a)]);
      }
    }
    perim.push(perim[0]);
    const vSteps = [];
    for (let m = 0; m <= seg; m++) vSteps.push([-hy, -Math.PI * 0.5 + (m / seg) * Math.PI * 0.5]);
    for (let m = 0; m <= seg; m++) vSteps.push([hy, (m / seg) * Math.PI * 0.5]);

    const rings = vSteps.map(([cy, phi], rIdx) => {
      const cp = Math.cos(phi), sp = Math.sin(phi);
      const rCol = sp > 0.55 ? topCol : sp < -0.55 ? botCol : col;
      const rAo = ao * (0.86 + 0.16 * (sp * 0.5 + 0.5));
      return perim.map(([qx, qz, ca, sa], i) => this.vert(
        qx + cp * rr * ca, cyOff + cy + sp * rr, qz + cp * rr * sa,
        cp * ca, sp, cp * sa, rCol, rAo, i / (perim.length - 1), rIdx / (vSteps.length - 1),
      ));
    });
    for (let j = 0; j < rings.length - 1; j++) {
      for (let i = 0; i < perim.length - 1; i++) {
        this.quadIdx(rings[j][i], rings[j][i + 1], rings[j + 1][i + 1], rings[j + 1][i]);
      }
    }
    const botCenter = this.vert(0, cyOff - hy - rr, 0, 0, -1, 0, botCol, ao * 0.82, 0.5, 0.5);
    const topCenter = this.vert(0, cyOff + hy + rr, 0, 0, 1, 0, topCol, ao * 1.02, 0.5, 0.5);
    const botRing = rings[0], topRing = rings[rings.length - 1];
    for (let i = 0; i < perim.length - 1; i++) {
      this.triIdx(botCenter, botRing[i + 1], botRing[i]);
      this.triIdx(topCenter, topRing[i], topRing[i + 1]);
    }
    return this;
  }

  /** Swept 3D tube along points = [[x,y,z], ...]. */
  tube(points, radius, seg = 10, col = '#cccccc', opt = {}) {
    const closed = !!opt.closed, count = points.length;
    if (count < 2) return this;
    const tangents = [];
    for (let j = 0; j < count; j++) {
      const prev = points[closed ? (j - 1 + count) % count : Math.max(0, j - 1)];
      const next = points[closed ? (j + 1) % count : Math.min(count - 1, j + 1)];
      let tx = next[0] - prev[0], ty = next[1] - prev[1], tz = next[2] - prev[2];
      const l = Math.hypot(tx, ty, tz) || 1;
      tangents.push([tx / l, ty / l, tz / l]);
    }
    const normals = [], binormals = [];
    let nx = 0, ny = 0, nz = 0;
    if (opt.up) {
      const [ux, uy, uz] = opt.up;
      for (let j = 0; j < count; j++) {
        const [tx, ty, tz] = tangents[j];
        let bx = ty * uz - tz * uy, by = tz * ux - tx * uz, bz = tx * uy - ty * ux;
        const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
        normals.push([by * tz - bz * ty, bz * tx - bx * tz, bx * ty - by * tx]);
        binormals.push([bx, by, bz]);
      }
    } else {
      const t0 = tangents[0];
      const ref = Math.abs(t0[1]) < 0.85 ? [0, 1, 0] : [1, 0, 0];
      let bx = t0[1] * ref[2] - t0[2] * ref[1], by = t0[2] * ref[0] - t0[0] * ref[2], bz = t0[0] * ref[1] - t0[1] * ref[0];
      const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
      nx = by * t0[2] - bz * t0[1]; ny = bz * t0[0] - bx * t0[2]; nz = bx * t0[1] - by * t0[0];
      normals.push([nx, ny, nz]); binormals.push([bx, by, bz]);
      for (let j = 1; j < count; j++) {
        const [tx, ty, tz] = tangents[j];
        const dot = nx * tx + ny * ty + nz * tz;
        nx -= dot * tx; ny -= dot * ty; nz -= dot * tz;
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        normals.push([nx, ny, nz]);
        binormals.push([ty * nz - tz * ny, tz * nx - tx * nz, tx * ny - ty * nx]);
      }
    }
    const sx = opt.sx ?? 1, sy = opt.sy ?? 1, ao = opt.ao ?? 1;
    const steps = closed ? count : count - 1;
    const rings = [];
    for (let j = 0; j <= steps; j++) {
      const k = j % count, t = j / steps, p = points[k], N = normals[k], B = binormals[k];
      const r = typeof radius === 'function' ? radius(t, k) : radius;
      const rCol = typeof col === 'function' ? col(t, k) : col;
      const row = [];
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * TAU, c = Math.cos(th), s = Math.sin(th);
        const ox = N[0] * c * sx + B[0] * s * sy;
        const oy = N[1] * c * sx + B[1] * s * sy;
        const oz = N[2] * c * sx + B[2] * s * sy;
        const nrx = N[0] * (c / sx) + B[0] * (s / sy);
        const nry = N[1] * (c / sx) + B[1] * (s / sy);
        const nrz = N[2] * (c / sx) + B[2] * (s / sy);
        const nl = Math.hypot(nrx, nry, nrz) || 1;
        row.push(this.vert(p[0] + ox * r, p[1] + oy * r, p[2] + oz * r, nrx / nl, nry / nl, nrz / nl, rCol, ao, i / seg, t));
      }
      rings.push(row);
    }
    for (let j = 0; j < steps; j++) {
      for (let i = 0; i < seg; i++) {
        this.quadIdx(rings[j][i], rings[j][i + 1], rings[j + 1][i + 1], rings[j + 1][i]);
      }
    }
    if (!closed && opt.caps !== false) {
      for (const [endIdx, sign] of [[0, -1], [count - 1, 1]]) {
        const p = points[endIdx], T = tangents[endIdx], N = normals[endIdx], B = binormals[endIdx];
        const t = endIdx / (count - 1);
        const r = typeof radius === 'function' ? radius(t, endIdx) : radius;
        const cCol = opt.capColor || (typeof col === 'function' ? col(t, endIdx) : col);
        const center = this.vert(p[0], p[1], p[2], T[0] * sign, T[1] * sign, T[2] * sign, cCol, ao, 0.5, 0.5);
        const rim = [];
        for (let i = 0; i <= seg; i++) {
          const th = (i / seg) * TAU, c = Math.cos(th), s = Math.sin(th);
          rim.push(this.vert(
            p[0] + (N[0] * c * sx + B[0] * s * sy) * r,
            p[1] + (N[1] * c * sx + B[1] * s * sy) * r,
            p[2] + (N[2] * c * sx + B[2] * s * sy) * r,
            T[0] * sign, T[1] * sign, T[2] * sign, cCol, ao, 0.5, 0.5,
          ));
        }
        for (let i = 0; i < seg; i++) {
          if (sign > 0) this.triIdx(center, rim[i], rim[i + 1]);
          else this.triIdx(center, rim[i + 1], rim[i]);
        }
      }
    }
    return this;
  }

  /** Curved 3D double-sided thick sheet with per-cell top color painting. */
  sheet(nu, nv, sample, thickness, opt = {}) {
    const grid = [], norms = [], h = thickness * 0.5;
    for (let iv = 0; iv <= nv; iv++) {
      const row = [];
      for (let iu = 0; iu <= nu; iu++) row.push(sample(iu / nu, iv / nv));
      grid.push(row);
    }
    for (let iv = 0; iv <= nv; iv++) {
      const nrow = [];
      for (let iu = 0; iu <= nu; iu++) {
        const pu0 = grid[iv][Math.max(0, iu - 1)], pu1 = grid[iv][Math.min(nu, iu + 1)];
        const pv0 = grid[Math.max(0, iv - 1)][iu], pv1 = grid[Math.min(nv, iv + 1)][iu];
        const ux = pu1[0] - pu0[0], uy = pu1[1] - pu0[1], uz = pu1[2] - pu0[2];
        const vx = pv1[0] - pv0[0], vy = pv1[1] - pv0[1], vz = pv1[2] - pv0[2];
        // pv × pu points +Y when u -> +X and v -> +Z
        let nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux;
        const l = Math.hypot(nx, ny, nz) || 1;
        nrow.push([nx / l, ny / l, nz / l]);
      }
      norms.push(nrow);
    }
    const defTop = opt.topColor || '#f5f3eb', botCol = opt.bottomColor || '#ded8c8', edgeCol = opt.edgeColor || botCol;
    const aoFn = opt.aoFn || null;
    for (let iv = 0; iv < nv; iv++) {
      for (let iu = 0; iu < nu; iu++) {
        const uMid = (iu + 0.5) / nu, vMid = (iv + 0.5) / nv;
        const col = typeof defTop === 'function' ? defTop(uMid, vMid, iu, iv) : defTop;
        const corners = [[iu, iv], [iu, iv + 1], [iu + 1, iv + 1], [iu + 1, iv]];
        const topIdx = corners.map(([cu, cv]) => {
          const p = grid[cv][cu], n = norms[cv][cu];
          const ao = aoFn ? aoFn(cu / nu, cv / nv) : 1;
          return this.vert(p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h, n[0], n[1], n[2], col, ao, cu / nu, cv / nv);
        });
        this.quadIdx(topIdx[0], topIdx[1], topIdx[2], topIdx[3]);
      }
    }
    const botVerts = [];
    for (let iv = 0; iv <= nv; iv++) {
      const row = [];
      for (let iu = 0; iu <= nu; iu++) {
        const p = grid[iv][iu], n = norms[iv][iu];
        row.push(this.vert(p[0] - n[0] * h, p[1] - n[1] * h, p[2] - n[2] * h, -n[0], -n[1], -n[2], botCol, 0.82, iu / nu, iv / nv));
      }
      botVerts.push(row);
    }
    for (let iv = 0; iv < nv; iv++) {
      for (let iu = 0; iu < nu; iu++) {
        this.quadIdx(botVerts[iv][iu], botVerts[iv][iu + 1], botVerts[iv + 1][iu + 1], botVerts[iv + 1][iu]);
      }
    }
    // Stitch 4 outer edges
    const topPos = (iu, iv) => { const p = grid[iv][iu], n = norms[iv][iu]; return [p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h]; };
    const botPos = (iu, iv) => { const p = grid[iv][iu], n = norms[iv][iu]; return [p[0] - n[0] * h, p[1] - n[1] * h, p[2] - n[2] * h]; };
    for (let iu = 0; iu < nu; iu++) {
      this.faceQuad(botPos(iu + 1, 0), botPos(iu, 0), topPos(iu, 0), topPos(iu + 1, 0), edgeCol, 0.88);
      this.faceQuad(botPos(iu, nv), botPos(iu + 1, nv), topPos(iu + 1, nv), topPos(iu, nv), edgeCol, 0.9);
    }
    for (let iv = 0; iv < nv; iv++) {
      this.faceQuad(botPos(0, iv), botPos(0, iv + 1), topPos(0, iv + 1), topPos(0, iv), edgeCol, 0.88);
      this.faceQuad(botPos(nu, iv + 1), botPos(nu, iv), topPos(nu, iv), topPos(nu, iv + 1), edgeCol, 0.9);
    }
    return this;
  }
}

/* ---- Individual High-Detail 3D Item Sculptors -------------------------------- */

function sculptTorchBody(s, prepared = false) {
  s.push();
  if (s.grounded && !s.held) {
    // Propped nose-up on its wide rubber bezel and tail cap so it catches room light
    s.translate(0, 0.29, 0);
    s.rotateX(6.5 * DEG);
    s.rotateZ(13 * DEG);
  }
  // Barrel axis runs along Z: lens at -Z (-11.2), grip at +Z (+9.2), centered at y = 3.5.
  // Lathe works along +Y; rotating +90° around X maps +Y -> +Z!
  s.push();
  s.translate(0, 3.5, 0);
  s.rotateX(90 * DEG);
  const darkRubber = '#22262c', charcoal = '#2f353d', yellow = '#f2ba2c', amberShade = '#c99218';
  const steel = '#cfd8e2', reflector = '#e4ecf4', lensGlow = '#dff7ff', bulb = '#ffe89c';
  s.lathe([
    // Deep parabolic reflector & glowing convex glass lens at -Z (y = -11.2 .. -8.2)
    [0, -9.15, bulb, 1.35, true],
    [0.52, -9.35, bulb, 1.32],
    [0.58, -8.85, '#98a4b0', 0.95, true],
    [2.65, -10.45, reflector, 1.15, true],
    [2.95, -10.55, steel, 1.08, true],
    // Brushed steel lens bezel ring + recessed glass lens lip
    [3.25, -10.95, steel, 1.08, true],
    [3.75, -10.95, darkRubber, 0.96, true],
    // Shock-absorbing flared rubber head housing
    [4.15, -10.45, darkRubber, 0.98],
    [4.18, -8.35, darkRubber, 0.96],
    [3.88, -7.85, charcoal, 0.92, true],
    [4.12, -7.45, darkRubber, 0.96, true],
    [3.92, -6.15, darkRubber, 0.94],
    [3.15, -5.15, yellow, 1.02, true],
    // High-vis yellow industrial body with recessed dark rubber grip rings
    [2.45, -4.45, yellow, 1.02, true],
    [2.45, -1.6, yellow, 1.0, true],
    [2.28, -1.45, darkRubber, 0.78, true],
    [2.28, -0.55, darkRubber, 0.78, true],
    [2.45, -0.4, yellow, 1.0, true],
    [2.45, 1.3, yellow, 1.0, true],
    [2.28, 1.45, darkRubber, 0.78, true],
    [2.28, 2.35, darkRubber, 0.78, true],
    [2.45, 2.5, yellow, 1.0, true],
    [2.45, 4.2, yellow, 1.0, true],
    [2.28, 4.35, darkRubber, 0.78, true],
    [2.28, 5.25, darkRubber, 0.78, true],
    [2.45, 5.4, amberShade, 0.96, true],
    [2.48, 7.1, yellow, 0.98, true],
    // Ribbed rubber tail cap
    [2.68, 7.35, darkRubber, 0.94, true],
    [2.68, 8.85, darkRubber, 0.92],
    [2.25, 9.25, charcoal, 0.88, true],
    [0, 9.25, darkRubber, 0.82, true],
  ], 22);
  // Translucent cool-ice convex front glass lens disc sitting over the reflector
  s.lathe([
    [0, -10.82, '#f2fcff', 1.34],
    [1.6, -10.74, lensGlow, 1.26],
    [2.78, -10.56, '#bce6f7', 1.16, true],
  ], 22);
  // Octagonal anti-roll neck collar
  s.cyl(3.45, 3.45, -5.55, -4.35, 8, charcoal, { bevel: 0.22, bevelColor: yellow });

  if (prepared) {
    // Wrapped satin-silver duct tape around barrel with raised overlaps & folded tab
    s.cyl(2.64, 2.66, 0.6, 5.1, 22, '#c5cdd5', {
      bevel: 0.14, bevelColor: '#dee5ec',
      colorFn: (th, y) => (Math.abs(y - 2.1) < 0.14 || Math.abs(y - 3.7) < 0.14 ? '#939da7' : Math.sin(th * 3 + y) > 0.65 ? '#dce3ea' : '#bfc8d1'),
    });
  }
  s.pop();

  // Molded top switch saddle + bright crimson slide switch
  s.push();
  s.translate(0, 6.05, -2.1);
  s.bevelBox(1.85, 0.95, 3.6, 0.26, '#23282e', { seg: 2, topColor: '#323840' });
  s.translate(0, 0.48, -0.35);
  s.bevelBox(1.12, 0.56, 1.65, 0.16, '#de352b', { seg: 2, topColor: '#f55349', ao: 1.08 });
  s.pop();

  if (prepared) {
    // Dog-eared duct tape tab sticking out to the right side so HUD icon reads immediately
    s.push();
    s.translate(2.55, 4.1, 2.85);
    s.rotateZ(-18 * DEG);
    s.bevelBox(1.75, 0.26, 2.7, 0.08, '#cbd3db', { seg: 1, topColor: '#e3eaf0', bottomColor: '#8d96a0' });
    s.pop();
  }

  // Rear steel lanyard loop
  const ringPts = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ringPts.push([Math.cos(a) * 0.85, 2.75 + Math.sin(a) * 0.55, 9.55 + Math.sin(a) * 0.55]);
  }
  s.tube(ringPts, 0.17, 8, '#c8d1da', { closed: true, up: [0, 1, -1] });
  s.pop();
}

function sculptSingleBattery(s) {
  // Iconic obsidian-black & metallic-copper cell standing from y = 0 to y = 6.9
  const black = '#1d2128', copper = '#e57a32', copperHi = '#f7a15c', gold = '#f2c94c';
  const steel = '#cfd7df', brass = '#ebd074', seal = '#2b3038';
  s.lathe([
    [0, 0, '#9aa3ad', 0.78, true],
    [1.55, 0, '#aeb7c1', 0.82, true],
    [1.92, 0.18, black, 0.88, true],
    [2.02, 0.36, black, 0.94],
    [2.02, 3.95, black, 0.98, true],
    [2.04, 4.32, gold, 1.08, true],
    [2.02, 4.36, copper, 1.02, true],
    [2.02, 6.18, copper, 1.04],
    [1.88, 6.42, copperHi, 1.08, true],
    [1.68, 6.48, steel, 1.04, true],
    [1.32, 6.44, seal, 0.78, true],
    [0.72, 6.44, seal, 0.82, true],
    [0.72, 6.86, brass, 1.14, true],
    [0.56, 6.96, '#fae28c', 1.18, true],
    [0, 6.96, '#fae28c', 1.18, true],
  ], 22, {
    colorFn: (th, y, r, j, i, col) => {
      // Crisp white voltage stripe down one side of the black/copper label
      if (y > 0.9 && y < 5.7 && th > 0.35 && th < 0.72 && col === black) return '#e9edf2';
      if (col === copper && Math.cos(th - 0.8) > 0.55) return copperHi;
      return col;
    },
  });
}

function sculptBattery(s) {
  // Torn yellow/white cardboard twin-pack tray corner on the floor
  s.push();
  s.translate(-0.4, 0.24, 0.2);
  s.rotateY(-12 * DEG);
  s.bevelBox(6.8, 0.44, 4.6, 0.14, '#e8dec6', { seg: 1, topColor: '#f5be36', bottomColor: '#b9b09a' });
  s.pop();

  // Cell 1: Standing proudly upright so the pickup silhouette pops vertically off the carpet!
  s.push();
  s.translate(-1.85, 0.38, -0.65);
  s.rotateZ(3.5 * DEG);
  s.rotateY(24 * DEG);
  sculptSingleBattery(s);
  s.pop();

  // Cell 2: Resting diagonally in front with its copper top & brass + nub angled toward the eye
  s.push();
  s.translate(2.15, 2.05, 1.95);
  s.rotateY(-36 * DEG);
  s.rotateX(-86 * DEG);
  sculptSingleBattery(s);
  s.pop();
}

function sculptChalkStick(s, len = 6.8, r0 = 0.68, r1 = 0.62, col = '#faf8f0') {
  s.cyl(r0, r1, 0, len, 16, col, { bevel: 0.11, topColor: '#ffffff', bottomColor: '#eae5d5', ao: 1.04 });
}

function sculptChalk(s) {
  // Open cobalt-blue & goldenrod classroom chalk box
  s.push();
  s.translate(-0.65, 0, 0.65);
  s.rotateY(11 * DEG);
  // Outer blue sleeve
  s.push();
  s.translate(0, 1.32, 0.55);
  s.bevelBox(4.5, 2.6, 6.2, 0.24, '#2458a6', { seg: 2, topColor: '#2d68bf', bottomColor: '#1a3f78' });
  // Goldenrod label band across the top of the sleeve
  s.translate(0, 0.98, 0.15);
  s.bevelBox(3.9, 0.72, 2.5, 0.12, '#f2c138', { seg: 1, topColor: '#f8cf56' });
  s.pop();
  // Cream cardboard inner tray pulled forward out of the sleeve
  s.push();
  s.translate(0, 1.05, -2.15);
  s.bevelBox(3.95, 1.85, 3.6, 0.18, '#ebe3cf', { seg: 1, topColor: '#ded5be' });
  s.pop();
  // Three round white chalk sticks nested inside the open tray
  for (const [ox, oy, oz] of [[-1.08, 1.15, -3.9], [0, 1.22, -4.35], [1.08, 1.12, -3.65]]) {
    s.push();
    s.translate(ox, oy, oz);
    s.rotateX(90 * DEG);
    sculptChalkStick(s, 5.8, 0.56, 0.52);
    s.pop();
  }
  s.pop();

  // Loose full chalk stick rolled diagonally in front of the box
  s.push();
  s.translate(2.15, 0.68, -3.15);
  s.rotateY(-38 * DEG);
  s.rotateX(90 * DEG);
  sculptChalkStick(s, 6.7, 0.66, 0.58, '#fcfbf5');
  s.pop();

  // Small crumbled white chalk flecks on the floor near the tip
  for (const [cx, cz, cr] of [[3.3, -2.5, 0.34], [2.8, -4.0, 0.24], [1.1, -4.4, 0.28]]) {
    s.push();
    s.translate(cx, cr * 0.55, cz);
    s.bevelBox(cr * 1.6, cr * 1.1, cr * 1.4, cr * 0.3, '#f7f5eb', { seg: 1, ao: 1.05 });
    s.pop();
  }
}

function sculptPaper(s) {
  // Warm amber-manila folder base with left index tab
  s.push();
  s.translate(-0.2, 0.22, 0.2);
  s.rotateY(-6 * DEG);
  s.bevelBox(14.2, 0.36, 16.8, 0.12, '#dfa74b', { seg: 1, topColor: '#eab65d', bottomColor: '#b58435' });
  s.translate(-7.1, 0.02, -3.4);
  s.bevelBox(1.5, 0.34, 4.8, 0.1, '#eab65d', { seg: 1 });
  s.pop();

  // Lower skewed white bond sheets creating crisp fanned corners
  for (const [ry, ox, oy, oz, shade] of [[8 * DEG, 0.45, 0.56, -0.25, '#ebe8dc'], [-10 * DEG, -0.35, 0.92, 0.35, '#f3f0e6']]) {
    s.push();
    s.translate(ox, oy, oz);
    s.rotateY(ry);
    s.bevelBox(12.8, 0.32, 15.8, 0.09, shade, { seg: 1, bottomColor: '#cfc9b8' });
    s.pop();
  }

  // Top bright-white memo sheet with graceful 3D upward S-curl & printed memo graphics
  s.push();
  s.rotateY(3 * DEG);
  s.sheet(10, 12, (u, v) => {
    const x = (u - 0.5) * 12.6, z = (v - 0.5) * 15.6;
    const corner = Math.max(0, (u - 0.28) * 0.9 + (v - 0.32) * 0.95);
    const curl = corner > 0 ? Math.pow(corner, 2.05) * 2.55 : 0;
    const arch = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.55;
    return [x - curl * 0.24, 1.24 + arch + curl, z - curl * 0.18];
  }, 0.28, {
    bottomColor: '#dcd7c8',
    edgeColor: '#e6e2d5',
    aoFn: (u, v) => 0.94 + Math.max(0, u + v - 1.0) * 0.12,
    topColor: (u, v, iu, iv) => {
      if (iv === 1 && iu >= 1 && iu <= 8) return '#234f91';             // Bold navy MEMO header bar
      if (iu === 1 && iv >= 2 && iv <= 10) return '#d6453d';            // Vertical red margin rule
      if ((iv === 3 || iv === 5 || iv === 7) && iu >= 2 && iu <= 8) return '#424954'; // Dark ink text lines
      if (iv === 9 && iu >= 2 && iu <= 6) return '#58606d';
      return '#fbfaf5';
    },
  });

  // Bent chrome wire paperclip gripping the top-left corner of the stack
  const clip = [
    [-4.6, 1.56, -5.2], [-4.6, 1.62, -7.85], [-3.25, 1.62, -7.85],
    [-3.25, 1.56, -4.45], [-4.15, 1.54, -4.45], [-4.15, 1.56, -7.15],
  ];
  s.tube(clip, 0.17, 8, '#cfd8e2', { ao: 1.1 });
  s.pop();
}

function sculptPinkSlip(s) {
  // Vivid rose-pink FORM HR-404 arched in a 3D S-wave with lifted corner so it never flattens into carpet
  s.push();
  s.rotateY(-7 * DEG);
  s.sheet(10, 12, (u, v) => {
    const x = (u - 0.5) * 12.2, z = (v - 0.5) * 15.4;
    const wave = Math.sin(v * Math.PI * 1.15) * 1.35 + Math.sin(u * Math.PI) * 0.42;
    const lift = Math.pow(Math.max(0, (u - 0.35) * 0.85 + (v - 0.42) * 0.9), 2) * 2.1;
    return [x - lift * 0.18, 0.15 + Math.max(0, wave) + lift, z - lift * 0.14];
  }, 0.28, {
    bottomColor: '#d97896',
    edgeColor: '#e88aa7',
    aoFn: (u, v) => 0.95 + Math.sin(v * Math.PI) * 0.1,
    topColor: (u, v, iu, iv) => {
      if (iu === 0) return '#ffc8da';                                   // Pale pink perforated margin
      if (iv === 1 && iu >= 1 && iu <= 8) return '#4a1b33';             // Deep plum FORM HR-404 banner
      if ((iv === 4 || iv === 6 || iv === 8) && iu >= 2 && iu <= 8) return '#7c2f54'; // Ruled form lines
      if (iv >= 9 && iv <= 10 && iu >= 5 && iu <= 8) return '#cf233c';  // Crimson REDUNDANT stamp box
      return '#f795b4';
    },
  });
  s.pop();
}

function sculptScissors(s) {
  s.push();
  if (s.grounded && !s.held) {
    // Propped up dynamically on one finger loop & lower blade so the open V-jaws catch light
    s.translate(0, 3.74, 0.3);
    s.rotateX(15 * DEG);
    s.rotateZ(-19 * DEG);
  } else {
    s.translate(0, 1.0, 0);
  }

  const red = '#e03628', redHi = '#f55445', steelBright = '#e2e9f0', steelMid = '#9aa6b2', brass = '#e8bf56';
  // Half-scissor builder: +1 = upper blade/left handle, -1 = lower blade/right handle
  for (const side of [-1, 1]) {
    s.push();
    s.translate(0, side * 0.24, -0.6);
    s.rotateY(side * 14 * DEG);

    // Tapered beveled stainless-steel blade extending forward to -Z (-10.6)
    const z0 = 1.2, zTip = -9.8;
    const pBackL = [side * -0.15, 0.14, z0], pBackR = [side * 1.28, 0.04, z0];
    const pMidL = [side * -0.12, 0.13, -4.6], pMidR = [side * 0.92, 0.03, -4.6];
    const pTip = [side * 0.04, 0.02, zTip];
    const bBackL = [side * -0.15, -0.14, z0], bBackR = [side * 1.28, -0.04, z0];
    const bMidL = [side * -0.12, -0.13, -4.6], bMidR = [side * 0.92, -0.03, -4.6];
    const bTip = [side * 0.04, -0.02, zTip];
    if (side > 0) {
      s.faceQuad(pBackL, pMidL, pMidR, pBackR, steelBright, 1.08);
      s.faceTri(pMidL, pTip, pMidR, steelBright, 1.1);
      s.faceQuad(bBackR, bMidR, bMidL, bBackL, steelMid, 0.88);
      s.faceTri(bMidR, bTip, bMidL, steelMid, 0.9);
      s.faceQuad(bBackL, bMidL, pMidL, pBackL, steelBright, 1.04);
      s.faceQuad(bMidL, bTip, pTip, pMidL, steelBright, 1.06);
      s.faceQuad(pBackR, pMidR, bMidR, bBackR, steelMid, 0.92);
      s.faceQuad(pMidR, pTip, bTip, bMidR, steelMid, 0.94);
    } else {
      s.faceQuad(pBackR, pMidR, pMidL, pBackL, steelBright, 1.06);
      s.faceTri(pMidR, pTip, pMidL, steelBright, 1.08);
      s.faceQuad(bBackL, bMidL, bMidR, bBackR, steelMid, 0.86);
      s.faceTri(bMidL, bTip, bMidR, steelMid, 0.88);
      s.faceQuad(pBackL, pMidL, bMidL, bBackL, steelBright, 1.04);
      s.faceQuad(pMidL, pTip, bTip, bMidL, steelBright, 1.06);
      s.faceQuad(bBackR, bMidR, pMidR, pBackR, steelMid, 0.92);
      s.faceQuad(bMidR, bTip, pTip, pMidR, steelMid, 0.94);
    }

    // Molded red plastic neck tang connecting pivot to oval finger ring
    s.push();
    s.translate(side * 1.15, 0, 2.55);
    s.rotateY(side * -16 * DEG);
    s.bevelBox(1.25, 0.72, 3.1, 0.26, red, { seg: 2, topColor: redHi });
    s.pop();

    // Smooth 18-segment closed oval finger loop with real negative space
    const loopPts = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      loopPts.push([
        side * (2.65 + Math.cos(a) * 1.75),
        Math.sin(a) * 0.04,
        6.15 + Math.sin(a) * 2.55,
      ]);
    }
    s.tube(loopPts, 0.56, 10, red, { closed: true, up: [0, 1, 0], sx: 1.05, sy: 0.78, ao: 1.02 });
    s.pop();
  }

  // Raised machined brass pivot screw + dark screw slot at cross-joint
  s.push();
  s.translate(0, 0, -0.6);
  s.cyl(0.76, 0.76, -0.58, 0.62, 16, brass, { bevel: 0.12, topColor: '#f7d674', ao: 1.12 });
  s.translate(0, 0.63, 0);
  s.bevelBox(1.1, 0.12, 0.22, 0.04, '#3a2d14', { seg: 1 });
  s.pop();
  s.pop();
}

function sculptSnack(s) {
  s.push();
  if (s.grounded && !s.held) {
    // Jaunty 20° propped pillow angle so the bright foil bag rises clearly off the floor
    s.translate(0, 3.56, 0.15);
    s.rotateX(-20 * DEG);
    s.rotateZ(9 * DEG);
  } else {
    s.translate(0, 1.8, 0);
  }

  // Puffed 3D foil pillow packet along Z (-6.4 .. +6.4), sculpted via elliptical lathe
  const blue = '#1e5cc4', blueHi = '#3276e3', yellow = '#f7ca36', red = '#de322a', silver = '#d4dce4';
  s.push();
  s.rotateX(90 * DEG);
  s.scale(1.38, 1, 0.58);
  s.lathe([
    [0.12, -6.1, silver, 0.92, true],
    [2.75, -5.75, blue, 0.96],
    [3.42, -4.1, blue, 1.0],
    [3.68, -1.85, blueHi, 1.04, true],
    [3.74, -1.75, yellow, 1.08, true],
    [3.78, -0.45, yellow, 1.1, true],
    [3.78, -0.35, red, 1.06, true],
    [3.74, 1.35, red, 1.06, true],
    [3.68, 1.45, blueHi, 1.04, true],
    [3.42, 4.1, blue, 1.0],
    [2.75, 5.75, blue, 0.96],
    [0.12, 6.1, silver, 0.92, true],
  ], 22, {
    colorFn: (th, y, r, j, i, col) => {
      // White nutrition panel on underside, bright diagonal flash on top
      if (Math.sin(th) < -0.55 && Math.abs(y) < 3.4) return '#eef0f4';
      if (col === yellow && Math.cos(th - 0.5) > 0.72) return '#fff099';
      return col;
    },
  });
  s.pop();

  // Crinkled metallic silver zig-zag heat-crimped top & bottom foil seals
  for (const sign of [-1, 1]) {
    for (let k = -4; k <= 4; k++) {
      s.push();
      s.translate(k * 0.98, (k % 2 === 0 ? 0.08 : -0.06), sign * 6.55);
      s.rotateY((k % 2 === 0 ? 12 : -12) * DEG);
      s.bevelBox(1.12, 0.34, 1.45, 0.08, k % 2 === 0 ? '#dde5ed' : '#aeb8c4', { seg: 1, ao: 1.06 });
      s.pop();
    }
  }
  s.pop();
}

function sculptLighter(s) {
  s.push();
  // Stands upright (~6.4 units = 16 cm) with a slight 6° lean so its red + chrome silhouette is unmistakable
  if (s.grounded && !s.held) {
    s.translate(0, 0.20, 0);
    s.rotateZ(-6 * DEG);
    s.rotateY(18 * DEG);
  }
  const red = '#dc2f26', redHi = '#f24b42', whiteCap = '#eeece6', chrome = '#d8e0e8', dark = '#242930', steel = '#8c96a2';

  // Classic smooth oval-cross-section Bic lighter body
  s.push();
  s.scale(1.48, 1, 0.82);
  s.lathe([
    [0, 0, whiteCap, 0.85, true],
    [1.22, 0, whiteCap, 0.9, true],
    [1.36, 0.24, whiteCap, 0.96, true],
    [1.38, 0.28, red, 0.98, true],
    [1.38, 4.35, red, 1.02],
    [1.28, 4.55, redHi, 1.06, true],
    [0, 4.55, dark, 0.78, true],
  ], 22, {
    colorFn: (th, y, r, j, i, col) => (col === red && Math.cos(th - 0.7) > 0.65 ? redHi : col),
  });
  s.pop();

  // Perforated brushed-chrome wind-hood on left half of top (-X)
  s.push();
  s.translate(-0.42, 4.48, 0);
  s.scale(1.18, 1, 0.88);
  s.cyl(1.12, 1.04, 0, 1.85, 18, chrome, {
    bevel: 0.18, topColor: '#2a3038', bevelColor: '#eef4fa', ao: 1.08,
    colorFn: (th, y, r, j, i, col) => (y > 0.55 && y < 1.35 && Math.abs(Math.sin(th * 2)) > 0.82 ? dark : col),
  });
  // Brass flame nozzle inside chimney
  s.cyl(0.28, 0.22, 1.4, 2.02, 10, '#e6be58', { bevel: 0.04, ao: 1.1 });
  s.pop();

  // Knurled steel flint striker wheel (rotating around Z axis)
  s.push();
  s.translate(0.72, 5.45, 0);
  s.rotateX(90 * DEG);
  s.cyl(0.68, 0.68, -0.48, 0.48, 16, steel, {
    bevel: 0.08, topColor: chrome, bottomColor: chrome,
    colorFn: (th) => (Math.sin(th * 8) > 0 ? '#adb7c2' : '#58606a'),
  });
  s.pop();

  // Red gas-release thumb lever fork extending out to +X
  s.push();
  s.translate(1.38, 4.78, 0);
  s.rotateZ(-14 * DEG);
  s.bevelBox(1.35, 0.42, 0.92, 0.12, red, { seg: 2, topColor: redHi });
  s.pop();
  s.pop();
}

function sculptTape(s) {
  // Curled peeling strip of satin-silver duct tape sweeping out along the floor & propping the roll
  s.sheet(9, 4, (u, v) => {
    const x = 1.2 + u * 6.6, z = 1.6 + (v - 0.5) * 3.1 + u * 1.4;
    const wave = Math.sin(u * Math.PI * 1.4) * 0.48 + Math.pow(Math.max(0, u - 0.62) * 2.6, 2) * 1.35;
    // Serrated torn tape teeth at far end (u = 1)
    const tear = u > 0.92 ? ((Math.round(v * 6) % 2) * 0.35) : 0;
    return [x + tear, 0.16 + Math.max(0, wave), z];
  }, 0.22, {
    topColor: (u) => (u > 0.72 ? '#dfe6ed' : '#c4ccd4'),
    bottomColor: '#8d959e',
    edgeColor: '#dce3ea',
  });

  // Thick 28-segment circular duct-tape roll propped at a 17° tilt so both cylinder & cardboard core read clearly
  s.push();
  if (s.grounded && !s.held) {
    s.translate(-0.35, 1.64, -0.25);
    s.rotateZ(-17 * DEG);
    s.rotateX(8 * DEG);
  }
  s.annulus(2.95, 5.35, 0, 3.35, 28, {
    outer: '#c5cdd5',
    rim: '#e3eaf0',
    inner: '#c69b61',
    coreRim: '#dfb67c',
    sideA: '#9fa8b2',
    sideB: '#cfd7df',
    plies: 4,
  });
  s.pop();
}

function sculptOpener(s) {
  s.push();
  if (s.grounded && !s.held) {
    // Propped nose-up on its rear metal visor clip so faceplate, red button & antenna silhouette stand tall
    s.translate(0, 2.26, 0.2);
    s.rotateX(17 * DEG);
    s.rotateZ(-8 * DEG);
  } else {
    s.translate(0, 0.9, 0);
  }

  // Two-tone molded RF remote housing: dark slate lower shell + warm ivory upper faceplate
  s.bevelBox(5.6, 1.35, 9.6, 0.42, '#292e36', { seg: 2, bottomColor: '#1d2127' });
  s.push();
  s.translate(0, 0.56, -0.15);
  s.bevelBox(4.85, 0.44, 8.65, 0.22, '#eee8d8', { seg: 2, topColor: '#f7f3e8' });
  s.pop();

  // Recessed dark button well + large tactile crimson OPEN push-button + secondary dark Aux button
  s.push();
  s.translate(0, 0.76, -1.65);
  s.bevelBox(3.4, 0.24, 3.6, 0.14, '#1f242b', { seg: 1 });
  s.translate(0, 0.28, -0.35);
  s.bevelBox(2.55, 0.56, 2.05, 0.22, '#e0342a', { seg: 2, topColor: '#f65248', ao: 1.08 });
  s.translate(0, -0.1, 1.55);
  s.bevelBox(2.2, 0.36, 0.78, 0.12, '#505864', { seg: 1, topColor: '#697382' });
  s.pop();

  // Bright glowing emerald-green RF indicator LED
  s.push();
  s.translate(-1.35, 0.82, -3.75);
  s.cyl(0.32, 0.24, 0, 0.34, 12, '#4ce86a', { bevel: 0.08, topColor: '#a6ffba', ao: 1.34 });
  s.pop();

  // Molded tactile grip ribs on lower half of faceplate
  for (const rz of [1.45, 2.35, 3.25]) {
    s.push();
    s.translate(0, 0.8, rz);
    s.bevelBox(3.2, 0.18, 0.36, 0.06, '#b8b2a2', { seg: 1 });
    s.pop();
  }

  // Bent spring-steel visor clip underneath
  s.push();
  s.translate(0, -0.82, 1.4);
  s.bevelBox(2.2, 0.36, 4.8, 0.1, '#b8c2cc', { seg: 1 });
  s.pop();

  // Sleek telescoping chrome stub antenna with orange safety tip bead
  const antPts = [[1.65, 0.55, -4.4], [2.15, 2.45, -5.9], [2.55, 4.35, -7.25]];
  s.tube(antPts, (t) => 0.26 - t * 0.1, 10, '#dce4ec', { ao: 1.12 });
  s.push();
  s.translate(2.55, 4.35, -7.25);
  s.cyl(0.28, 0.22, -0.2, 0.24, 10, '#f26430', { bevel: 0.08, ao: 1.15 });
  s.pop();
  s.pop();
}


function sculptBalloon(s) {
  const yBase = s.icon ? 14 : 28.6;
  if (!s.icon) s.translate(0, 0.05, 0);
  // Smooth 3D S-curved twine string (with floor coil when not rendering compact HUD icon)
  const stringPts = [];
  if (!s.icon) {
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 1.65, r = 1.55 - i * 0.15;
      stringPts.push([Math.cos(a) * r, 0.16 + i * 0.03, Math.sin(a) * r]);
    }
  }
  const steps = s.icon ? 10 : 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, y = (s.icon ? 0 : 0.45) + t * (yBase - (s.icon ? 0 : 0.45));
    stringPts.push([
      Math.sin(t * Math.PI * 2.1) * 0.85,
      y,
      Math.cos(t * Math.PI * 1.7) * 0.48 - 0.18,
    ]);
  }
  s.tube(stringPts, s.icon ? 0.28 : 0.19, 8, '#e6dec8', { ao: 0.98 });

  // Smooth 24-seg × 18-ring lathed glossy crimson pear balloon with pinched neck, knot & studio highlight
  const red = '#d92424', ruby = '#961519', gloss = '#ff6a60', hotSpec = '#ffd6d1';
  const profile = [
    [0, yBase - 1.15, ruby, 0.85, true],
    [1.35, yBase - 1.05, red, 0.94, true],       // Flared rolled rubber lip
    [0.62, yBase - 0.25, ruby, 0.82, true],      // Pinched neck
    [1.18, yBase + 0.35, ruby, 0.9, true],       // Tied rubber knot bulge
    [0.78, yBase + 0.88, red, 0.94, true],
  ];
  const rings = 16;
  for (let j = 1; j <= rings; j++) {
    const t = j / rings, phi = t * Math.PI;
    // Pear profile: narrower tapered lower neck, full round upper dome (rMax ~ 9.6, height ~ 24.8)
    const pear = Math.sin(phi) * (0.76 + 0.28 * Math.sin(t * Math.PI * 0.85) + 0.12 * t);
    const r = j === rings ? 0 : pear * 9.35;
    const y = yBase + 0.88 + (1 - Math.cos(phi)) * 12.45;
    profile.push([r, y, red, 0.94 + 0.12 * t]);
  }
  s.lathe(profile, 24, {
    colorFn: (th, y, r, j, i, col) => {
      if (j < 5) return col;
      const ny = (y - (yBase + 13.0)) / 12.5;
      const hx = Math.cos(th - 2.25);            // Upper-left-front glossy window reflection
      if (ny > 0.18 && ny < 0.78 && hx > 0.82) return ny > 0.38 && ny < 0.62 && hx > 0.93 ? hotSpec : gloss;
      if (ny < -0.25 && hx < -0.2) return ruby;
      return col;
    },
    aoFn: (th, y, r, j, i, ao) => {
      const ny = (y - (yBase + 13.0)) / 12.5, hx = Math.cos(th - 2.25);
      return ny > 0.18 && ny < 0.78 && hx > 0.82 ? 1.2 : ao;
    },
  });
}

function sculptCamcorder(s) {
  // 90s VHS camcorder for HUD Combine / Equipment icon
  s.push();
  s.translate(0, 4.8, 0.5);
  // Main charcoal-slate body + brushed-silver control deck
  s.bevelBox(7.2, 6.8, 11.4, 0.55, '#353c3e', { seg: 2, topColor: '#485154', bottomColor: '#23282a' });
  s.push();
  s.translate(2.6, 0.2, 0.4);
  s.bevelBox(2.4, 4.8, 8.2, 0.35, '#8f989c', { seg: 2, topColor: '#aab3b7' });
  s.pop();
  // Multi-stepped telephoto lens barrel along -Z with coated cyan-emerald glass lens
  s.push();
  s.translate(-0.4, 0.35, 0);
  s.rotateX(90 * DEG);
  s.lathe([
    [0, -10.8, '#7be8ea', 1.28, true],
    [2.15, -10.65, '#3aaab0', 1.18, true],
    [2.55, -11.35, '#1b2024', 0.92, true],
    [2.95, -11.35, '#252b30', 0.96, true],
    [2.95, -8.2, '#252b30', 0.98, true],
    [3.2, -8.0, '#aeb7bf', 1.08, true],
    [3.2, -7.3, '#aeb7bf', 1.08, true],
    [2.85, -7.1, '#252b30', 0.96, true],
    [2.85, -5.4, '#252b30', 0.96, true],
  ], 20);
  // Top shotgun microphone with foam windscreen
  s.push();
  s.translate(0.5, -2.2, -4.45);
  s.cyl(0.85, 0.85, -7.8, -1.2, 14, '#23282c', { bevel: 0.22, topColor: '#3a4146' });
  s.pop();
  s.pop();
  // Flip-out side LCD / viewfinder & crimson REC button
  s.push();
  s.translate(-4.6, 0.4, 0.2);
  s.bevelBox(2.2, 3.2, 5.4, 0.24, '#5a6366', { seg: 1, topColor: '#768084' });
  s.translate(0.2, 0, 0);
  s.bevelBox(2.35, 2.2, 4.2, 0.12, '#7ce0cb', { seg: 1, ao: 1.2 });
  s.pop();
  s.push();
  s.translate(1.8, 2.2, 5.85);
  s.rotateX(90 * DEG);
  s.cyl(0.68, 0.68, 0, 0.45, 12, '#e0352b', { bevel: 0.1, ao: 1.15 });
  s.pop();
  s.pop();
}

/**
 * A small red fire extinguisher, as off a wall bracket: the cylinder standing on its black foot ring, a cream label round
 * the back (toward whoever holds it), the brass neck and black head, the fixed carry handle under the squeeze lever, both
 * running back over the hand (+Z), a short black horn pointing forward (-Z, the way the camcorder looks) and a pressure
 * gauge on the head, its face turned up and back so that the one holding it can read it. Stands from y 0 to about 15.6.
 */
export const EXTINGUISHER_PARTS = Object.freeze({
  gauge: Object.freeze([-1.3, 14.4, -0.15]), gaugeTilt: Object.freeze([70, 38]),   // its centre, and its face turned (degrees: back about X, then left about Z)
  gaugeR: 0.72,
  nozzle: Object.freeze([0, 13.95, -4.6]),                                         // the mouth of the horn
  pivot: Object.freeze([0, 14.82, 0.05]), leverOpen: -12,                         // the lever's pin, and how far up it stands (degrees) let go
  lever: (x, y, z) => y > 14.66 && z > -0.25 && Math.abs(x) < 0.8,                // which of the model's triangles are the lever (by their middle)
});
function sculptExtinguisher(s) {
  const red = '#c4231b', redHi = '#e24a3b', redLo = '#8c1812', black = '#1d1f23', rubber = '#2a2c31', brass = '#c9a34e', brassHi = '#e8c873';
  const cream = '#ebe2c8', ink = '#34302a', steel = '#c3cbd3', steelLo = '#7d8690';
  s.push();
  if (s.grounded && !s.held) { s.translate(0, 0.02, 0); s.rotateY(-28 * DEG); }
  // the foot ring, and the cylinder: domed at the top into a short neck
  s.cyl(2.98, 2.98, 0, 0.62, 24, black, { bevel: 0.18, bevelColor: rubber });
  s.lathe([
    [0, 0.5, redLo, 0.8, true],
    [2.55, 0.5, redLo, 0.85, true],
    [2.82, 0.72, red, 0.92],
    [2.86, 1.4, red, 0.98],
    [2.86, 10.6, red, 1.0],
    [2.74, 11.45, red, 1.02],
    [2.32, 12.15, redHi, 1.05],
    [1.55, 12.62, red, 1.04],
    [0.95, 12.82, redLo, 0.96, true],
    [0.95, 12.95, brass, 1.0, true],
    [0, 12.95, brass, 1.0, true],
  ], 24, {
    colorFn: (th, y, r, j, i, col) => {
      // the label, on the side toward the hand (+Z: th about 3π/2), with lines of instruction on it and a hazard band
      const back = Math.abs(th - 4.712) < 1.15;
      if (back && y > 4.2 && y < 9.6 && col === red) {
        if (y > 8.7) return '#2e6b3a';
        if ((y > 5.0 && y < 5.3) || (y > 6.0 && y < 6.3) || (y > 7.0 && y < 7.3) || (y > 7.9 && y < 8.2)) return Math.abs(th - 4.712) < 0.8 ? ink : cream;
        return cream;
      }
      if (col === red && Math.cos(th - 0.6) > 0.72) return redHi;               // where the light catches the curve
      if (col === red && Math.cos(th - 3.7) > 0.8) return redLo;
      return col;
    },
  });
  // the brass neck and the black valve head
  s.cyl(0.86, 0.82, 12.9, 13.55, 16, brass, { bevel: 0.08, topColor: brassHi });
  s.push(); s.translate(0, 14.05, 0.2); s.bevelBox(1.9, 1.15, 2.6, 0.28, black, { seg: 2, topColor: rubber }); s.pop();
  // the horn: a short black cone forward, its mouth flared
  s.push(); s.translate(0, 13.95, -1.0); s.rotateX(-90 * DEG);
  s.cyl(0.42, 0.5, 0, 2.3, 14, black, { bevel: 0.06 });
  s.cyl(0.5, 0.92, 2.25, 3.6, 16, rubber, { bevel: 0.08, topColor: '#0c0d0f', capTop: false });
  s.pop();
  // the carry handle (fixed) and the squeeze lever above it, both running back over the hand
  s.push(); s.translate(0, 13.75, 3.1); s.rotateX(4 * DEG); s.bevelBox(1.35, 0.42, 5.0, 0.16, steel, { seg: 2, topColor: '#dde3e9', bottomColor: steelLo }); s.pop();
  s.push(); s.translate(...EXTINGUISHER_PARTS.pivot); s.rotateX(EXTINGUISHER_PARTS.leverOpen * DEG); s.translate(0, 0.13, 2.75);
  s.bevelBox(1.45, 0.38, 5.4, 0.15, red, { seg: 2, topColor: redHi, bottomColor: redLo }); s.pop();
  // the pin: a ring at the side, through the head, and its broken plastic tag (somebody has used this one)
  s.tube(Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * TAU; return [1.25 + Math.cos(a) * 0.55, 14.05 + Math.sin(a) * 0.55, 0.9]; }), 0.1, 6, steel, { closed: true });
  s.tube([[1.3, 13.6, 0.9], [1.55, 12.9, 1.15], [1.5, 12.3, 1.45]], 0.07, 5, '#d9c94a');
  // the gauge: a steel bezel on the head, its face up and back, green to the right of the dial and red to the left
  s.push(); s.translate(...EXTINGUISHER_PARTS.gauge); s.rotateZ(EXTINGUISHER_PARTS.gaugeTilt[1] * DEG); s.rotateX(EXTINGUISHER_PARTS.gaugeTilt[0] * DEG);
  s.cyl(EXTINGUISHER_PARTS.gaugeR, EXTINGUISHER_PARTS.gaugeR, -0.22, 0.12, 18, steel, { bevel: 0.07, topColor: '#f1efe6',
    // (a thin arc round the edge, green to the right and a short red to the left, and nothing else on the face: blotches
    // and a needle on a pale disc read as a little face, and a face is the one thing a gauge must not have)
    colorFn: (th, y, r, j, i, col) => (y > 0.1 && r > 0.5 && r < 0.66 ? (Math.cos(th) > 0.25 && Math.sin(th) < 0.5 ? '#3f9a4a' : Math.cos(th) < -0.6 ? '#c23a2c' : col) : col) });
  s.pop();
  // the hose: a short black loop from the head to a clip on the side (it is the horn that sprays; this only holds)
  s.tube([[-0.9, 13.6, -0.6], [-2.1, 12.6, -1.2], [-3.05, 10.2, -0.9], [-3.05, 7.2, -0.4]], 0.32, 8, rubber, { ao: 0.92 });
  s.push(); s.translate(-2.98, 7.0, -0.35); s.bevelBox(0.5, 0.9, 0.9, 0.12, steelLo); s.pop();
  s.pop();
}

/**
 * A lawn flamingo: a pink plastic bird on two steel stakes. Its stakes stand from y 0 (their points) up into its belly at about
 * 14, its body is about 14 to 20, its neck goes up in an S to its head at about 29, and its bill points along +X (it looks
 * along +X). The points are what stab (FLAMINGO_PARTS.tip): a creature stabbed has the bird standing out of it.
 */
export const FLAMINGO_PARTS = Object.freeze({ tip: Object.freeze([0, 0, 0]), height: 30.5 });
function sculptFlamingo(s) {
  const pink = '#ef7ea6', pinkHi = '#ffa3c3', pinkLo = '#c95786', faded = '#f2a9c0', bill = '#f1ece0', billTip = '#1e1b1c', steel = '#a3abb3', steelLo = '#6f777f';
  const blob = (cx, cy, cz, rx, ry, rz, col, hi = null, seg = 16) => {
    const pts = []; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI; pts.push([Math.max(0, Math.cos(a)), Math.sin(a), col, 0.9 + 0.12 * (i / 8)]); }
    s.push(); s.translate(cx, cy, cz); s.scale(rx, ry, rz);
    s.lathe(pts, seg, hi ? { colorFn: (th, y, r, j, i, c) => (Math.cos(th - 0.5) > 0.6 && y > 0 ? hi : c) } : {});
    s.pop();
  };
  s.push();
  if (s.grounded && !s.held) { s.translate(0, 0, 0); s.rotateY(24 * DEG); }
  // the stakes: two steel rods, pointed, splayed a little, into the belly
  for (const z of [-0.55, 0.55]) {
    s.push(); s.translate(0.2, 0, z); s.rotateX(z * 0.05);
    s.cyl(0.03, 0.2, 0, 1.4, 8, steelLo, { bevel: 0.01 });
    s.cyl(0.2, 0.18, 1.4, 14.6, 8, steel, { bevel: 0.03, topColor: steelLo });
    s.pop();
  }
  // the body: a plump oval, the tail tipped up behind (−X), a wing pressed along each side
  blob(0, 17.2, 0, 4.4, 2.9, 2.6, pink, pinkHi, 18);
  s.push(); s.translate(-4.1, 18.4, 0); s.rotateZ(-28 * DEG); blob(0, 0, 0, 1.9, 0.9, 1.4, pinkLo, null, 12); s.pop();
  for (const z of [-1.0, 1.0]) { s.push(); s.translate(-0.6, 17.7, z * 2.15); s.rotateZ(-8 * DEG); blob(0, 0, 0, 3.3, 1.7, 0.55, z < 0 ? pinkLo : faded, null, 12); s.pop(); }
  // the neck: up from the breast, back, and over in an S to the head
  s.tube([[3.4, 18.6, 0], [4.2, 21.2, 0], [3.4, 23.8, 0], [2.4, 26.0, 0], [2.8, 28.2, 0], [3.9, 29.1, 0]], (t) => 0.95 - t * 0.3, 10, (t) => (t < 0.5 ? pink : pinkHi), { up: [0, 0, 1] });
  // the head, the bill turned down at its end, and an eye each side
  blob(4.3, 29.3, 0, 1.25, 1.1, 0.95, pink, pinkHi, 14);
  s.push(); s.translate(5.3, 29.1, 0); s.rotateZ(-100 * DEG);
  s.cyl(0.55, 0.38, 0, 1.4, 10, bill, { bevel: 0.05 });
  s.cyl(0.38, 0.06, 1.4, 2.5, 10, billTip, { bevel: 0.02, capTop: false });
  s.pop();
  for (const z of [-0.78, 0.78]) { s.push(); s.translate(4.65, 29.75, z); s.bevelBox(0.38, 0.38, 0.14, 0.06, billTip); s.pop(); }
  s.pop();
}

/** Sculpted 3D right work-glove & jacket sleeve wrapping the held flashlight barrel. */
export function sculptTorchGrip(batch, scale = 1) {
  const s = new Sculpt(batch, scale, { grounded: false, held: true });
  const glove = '#b6a382', knuckle = '#cbb998', palmShade = '#8d7d62', cuff = '#6d7876', sleeve = '#435056';
  // Palm wrapping right side of barrel
  s.push();
  s.translate(3.2, 2.3, 4.2);
  s.rotateZ(14 * DEG);
  s.bevelBox(3.4, 4.8, 6.8, 0.85, glove, { seg: 2, topColor: knuckle, bottomColor: palmShade });
  s.pop();
  // Four curved gloved fingers curling underneath and up the left side of the barrel
  for (let f = 0; f < 4; f++) {
    const z = 0.8 + f * 1.65;
    const pts = [
      [3.1, 0.7, z], [1.2, -0.35, z], [-1.3, -0.25, z],
      [-3.15, 1.15, z], [-3.35, 3.15, z], [-2.35, 4.45, z],
    ];
    s.tube(pts, (t) => 0.78 - t * 0.14, 10, (t) => (t > 0.55 ? knuckle : glove), { ao: 0.96 });
  }
  // Thumb resting along upper-right behind the switch
  s.tube([
    [3.4, 3.8, 5.8], [2.6, 5.3, 4.2], [1.45, 6.15, 2.5], [0.65, 6.25, 1.15],
  ], (t) => 0.92 - t * 0.16, 10, knuckle, { ao: 1.02 });
  // Wrist, ribbed knit cuff & pleated jacket sleeve extending off bottom-right frame
  s.tube([
    [3.8, 1.2, 6.8], [5.8, -2.4, 10.6], [8.8, -6.8, 15.6], [14.5, -14.5, 25.5],
  ], (t) => 2.55 + t * 2.35, 14, (t) => (t < 0.22 ? glove : t < 0.44 ? cuff : sleeve), { sx: 1.12, sy: 0.92, ao: 0.95 });
  return batch;
}

function makeEntry(sculptFn) {
  const entry = (batch, scale = 1, opt = {}) => sculptFn(new Sculpt(batch, scale, opt));
  entry.sculpt = entry;
  return entry;
}

export const torch = makeEntry((s) => sculptTorchBody(s, false));
export const preparedTorch = makeEntry((s) => sculptTorchBody(s, true));
export const battery = makeEntry(sculptBattery);
export const chalk = makeEntry(sculptChalk);
export const paper = makeEntry(sculptPaper);
export const pinkSlip = makeEntry(sculptPinkSlip);
export const scissors = makeEntry(sculptScissors);
export const snack = makeEntry(sculptSnack);
export const balloon = makeEntry(sculptBalloon);
export const lighter = makeEntry(sculptLighter);
export const tape = makeEntry(sculptTape);
export const opener = makeEntry(sculptOpener);
export const camcorder = makeEntry(sculptCamcorder);
export const extinguisher = makeEntry(sculptExtinguisher);
export const flamingo = makeEntry(sculptFlamingo);

torch.grip = sculptTorchGrip;

export const INVENTORY_MODELS = Object.freeze({
  torch,
  battery,
  chalk,
  paper,
  scissors,
  snack,
  balloon,
  lighter,
  tape,
  opener,
  'pink-slip': pinkSlip,
  extinguisher,
  flamingo,
});

export const ICON_MODELS = Object.freeze({
  ...INVENTORY_MODELS,
  'torch-prepared': preparedTorch,
  camera: camcorder,
});

/** Build a standalone Three.js BufferGeometry (with vertex colors) for HUD icon snapshots or previews. */
export function buildItemGeometry(THREE, type, opt = {}) {
  const entry = ICON_MODELS[type] || INVENTORY_MODELS[type];
  if (!entry?.sculpt) return null;
  const batch = { pos: [], nor: [], uv: [], alb: [], ao: [], idx: [] };
  entry.sculpt(batch, opt.scale ?? 0.025, opt);
  if (!batch.pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(batch.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(batch.nor, 3));
  const colors = new Float32Array(batch.alb.length);
  for (let i = 0, v = 0; i < batch.alb.length; i += 3, v++) {
    const k = 0.52 + 0.48 * batch.ao[v];
    colors[i] = Math.min(1.5, batch.alb[i] * k);
    colors[i + 1] = Math.min(1.5, batch.alb[i + 1] * k);
    colors[i + 2] = Math.min(1.5, batch.alb[i + 2] * k);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(batch.idx);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}
