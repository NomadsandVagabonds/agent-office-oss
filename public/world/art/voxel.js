// The Office — Pix → geometry. A Pix grid is a field of columns, each a stack
// of coloured segments along z. This turns it into one merged BufferGeometry
// (only the faces you can actually see), or into a flat textured quad.
import * as THREE from 'three';

const colorCache = new Map();
function linear(r, g, b) {
  const key = (r << 16) | (g << 8) | b;
  let c = colorCache.get(key);
  if (!c) {
    c = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    colorCache.set(key, c);
  }
  return c;
}

/** Parts of [a,b] not covered by any of `cover` (sorted, possibly overlapping). */
function uncovered(a, b, cover) {
  const out = [];
  let from = a;
  for (const s of cover) {
    if (s.z1 <= from) continue;
    if (s.z0 >= b) break;
    if (s.z0 > from) out.push([from, Math.min(s.z0, b)]);
    from = Math.max(from, s.z1);
    if (from >= b) break;
  }
  if (from < b) out.push([from, b]);
  return out;
}

/**
 * Build the visible shell of a Pix grid.
 * @param {import('./pix.js').Pix} pix
 * @param {{scale?:number, pivot?:{x:number,y:number}, zScale?:number}} [opt]
 *        pivot is in drawing coordinates; it becomes the geometry's origin.
 */
export function voxelGeometry(pix, opt = {}) {
  const s = opt.scale ?? 1;
  const zs = (opt.zScale ?? 1) * s;
  const px = opt.pivot?.x ?? 0, py = opt.pivot?.y ?? 0;
  const pos = [], nor = [], col = [], idx = [];
  const EPS = 1e-4;

  function quad(p0, p1, p2, p3, n, c) {
    // fix the winding so the face looks along its normal
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const base = pos.length / 3;
    for (const p of flip ? [p0, p3, p2, p1] : [p0, p1, p2, p3]) {
      pos.push(p[0], p[1], p[2]);
      nor.push(n[0], n[1], n[2]);
      col.push(c.r, c.g, c.b);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const cellAt = (i, j) => (i < 0 || j < 0 || i >= pix.w || j >= pix.h ? null : pix.cells[j * pix.w + i]);

  for (let j = 0; j < pix.h; j++) {
    for (let i = 0; i < pix.w; i++) {
      const cell = pix.cells[j * pix.w + i];
      if (!cell) continue;
      const x0 = (pix.x0 + i - px) * s, x1 = x0 + s;
      const top = -(pix.y0 + j - py) * s, bot = top - s;
      for (let k = 0; k < cell.length; k++) {
        const seg = cell[k];
        const c = linear(seg.r, seg.g, seg.b);
        const za = seg.z0 * zs, zb = seg.z1 * zs;
        const next = cell[k + 1], prev = cell[k - 1];
        if (!next || next.z0 > seg.z1 + EPS) quad([x0, bot, zb], [x1, bot, zb], [x1, top, zb], [x0, top, zb], [0, 0, 1], c);
        if (!prev || prev.z1 < seg.z0 - EPS) quad([x1, bot, za], [x0, bot, za], [x0, top, za], [x1, top, za], [0, 0, -1], c);
        const sides = [
          [cellAt(i - 1, j), (a, b) => quad([x0, bot, a], [x0, bot, b], [x0, top, b], [x0, top, a], [-1, 0, 0], c)],
          [cellAt(i + 1, j), (a, b) => quad([x1, bot, a], [x1, bot, b], [x1, top, b], [x1, top, a], [1, 0, 0], c)],
          [cellAt(i, j - 1), (a, b) => quad([x0, top, a], [x1, top, a], [x1, top, b], [x0, top, b], [0, 1, 0], c)],
          [cellAt(i, j + 1), (a, b) => quad([x0, bot, a], [x1, bot, a], [x1, bot, b], [x0, bot, b], [0, -1, 0], c)],
        ];
        for (const [neighbour, emit] of sides) {
          for (const [a, b] of uncovered(seg.z0, seg.z1, neighbour || [])) {
            if (b - a > EPS) emit(a * zs, b * zs);
          }
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

let sharedVoxelMaterial = null;
export function voxelMaterial() {
  if (!sharedVoxelMaterial) sharedVoxelMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  return sharedVoxelMaterial;
}

/** A lit, shadow-casting mesh from a Pix grid. */
export function voxelMesh(pix, opt = {}) {
  const mesh = new THREE.Mesh(voxelGeometry(pix, opt), opt.material || voxelMaterial());
  mesh.castShadow = opt.castShadow !== false;
  mesh.receiveShadow = opt.receiveShadow !== false;
  return mesh;
}

/** A crisp canvas texture from a Pix grid (front or back view). */
export function pixTexture(pix, opt = {}) {
  const canvas = pix.toCanvas(opt.px ?? 4, !!opt.back);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  return tex;
}

/**
 * A flat cutout of a Pix grid: an upright quad whose origin is the drawing's
 * pivot. Unlit, alpha-tested — it looks exactly like the 2D sprite.
 */
export function pixSprite(pix, opt = {}) {
  const s = opt.scale ?? 1;
  const px = opt.pivot?.x ?? 0, py = opt.pivot?.y ?? 0;
  const geo = new THREE.PlaneGeometry(pix.w * s, pix.h * s);
  geo.translate((pix.x0 + pix.w / 2 - px) * s, -(pix.y0 + pix.h / 2 - py) * s, 0);
  const mat = new THREE.MeshBasicMaterial({
    map: pixTexture(pix, opt), transparent: false, alphaTest: 0.5, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}
