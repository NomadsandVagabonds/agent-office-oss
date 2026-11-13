// The Office — Vox → mesh.
//
// Turns a voxel model into one compact BufferGeometry:
//   · only faces you can see are emitted
//   · coplanar faces of the same colour merge into big quads (greedy meshing)
//   · every corner carries baked ambient occlusion, so creases and the places
//     where things meet are softly darker — the single biggest thing that makes
//     voxel art read as a solid, lit object instead of a pile of flat squares
//
// Geometry is in VOXEL units (one voxel = 1.0); scale the mesh by VOXEL to put
// it in the world. That keeps positions on integers, which the material's
// per-voxel shading relies on.
import * as THREE from 'three';
import { GLOW, VOXEL, isGlass, texOf } from './vox.js';

const AO_CURVE = [0.5, 0.68, 0.85, 1.0];
const TEX_LEVELS = [0.0, 0.04, 0.075, 0.115];
const OPEN = 0xff;                           // all four corners unoccluded

const colorCache = new Map();
function linearRGB(rgb) {
  let c = colorCache.get(rgb);
  if (!c) {
    c = new THREE.Color().setRGB(((rgb >> 16) & 255) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255, THREE.SRGBColorSpace);
    colorCache.set(rgb, c);
  }
  return c;
}

function newBuffers() { return { pos: [], nor: [], col: [], tex: [], emi: [], idx: [] }; }

function toGeometry(buf) {
  if (!buf.idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
  geo.setAttribute('aTex', new THREE.Float32BufferAttribute(buf.tex, 1));
  geo.setAttribute('aEmis', new THREE.Float32BufferAttribute(buf.emi, 1));
  geo.setIndex(buf.idx);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * @param {import('./vox.js').Vox} vox
 * @param {{origin?:[number,number,number]}} [opt]  the voxel coordinate that becomes (0,0,0)
 * @returns {{solid:THREE.BufferGeometry|null, glass:THREE.BufferGeometry|null, bounds:object, quads:number}}
 */
export function meshVox(vox, opt = {}) {
  const b = vox.bounds();
  if (!vox.size) return { solid: null, glass: null, bounds: b, quads: 0 };
  // dense copy with one voxel of air all round, so neighbour lookups never leave the array
  const nx = b.x1 - b.x0 + 2, ny = b.y1 - b.y0 + 2, nz = b.z1 - b.z0 + 2;
  const dims = [nx, ny, nz];
  const grid = new Uint32Array(nx * ny * nz);
  const at = (x, y, z) => x + nx * (y + ny * z);
  vox.each((x, y, z, v) => { grid[at(x - b.x0 + 1, y - b.y0 + 1, z - b.z0 + 1)] = v; });
  const [ox, oy, oz] = opt.origin || [0, 0, 0];
  const off = [b.x0 - 1 - ox, b.y0 - 1 - oy, b.z0 - 1 - oz];
  const opaque = (v) => v !== 0 && !isGlass(v);

  const solid = newBuffers(), glass = newBuffers();
  let quads = 0;

  function emit(buf, d, u, w, dir, slice, iu, jw, wd, ht, v, ao) {
    const base = [0, 0, 0];
    base[d] = slice + (dir > 0 ? 1 : 0); base[u] = iu; base[w] = jw;
    const corner = [[0, 0], [wd, 0], [wd, ht], [0, ht]];
    const col = linearRGB(v & 0xffffff);
    const tex = TEX_LEVELS[texOf(v)];
    const emis = (v & GLOW) ? 1 : 0;
    const start = buf.pos.length / 3;
    const a = [ao & 3, (ao >> 2) & 3, (ao >> 4) & 3, (ao >> 6) & 3];
    for (let c = 0; c < 4; c++) {
      const pt = [base[0], base[1], base[2]];
      pt[u] += corner[c][0]; pt[w] += corner[c][1];
      buf.pos.push(pt[0] + off[0], pt[1] + off[1], pt[2] + off[2]);
      buf.nor.push(d === 0 ? dir : 0, d === 1 ? dir : 0, d === 2 ? dir : 0);
      const k = emis ? 1 : AO_CURVE[a[c]];
      buf.col.push(col.r * k, col.g * k, col.b * k);
      buf.tex.push(tex);
      buf.emi.push(emis);
    }
    // (u, w, d) is right-handed, so 0-1-2-3 is counter-clockwise seen from +d.
    // Split along the diagonal that keeps the shading smooth.
    const alt = a[0] + a[2] < a[1] + a[3];
    const tri = dir > 0
      ? (alt ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3])
      : (alt ? [1, 3, 2, 1, 0, 3] : [0, 2, 1, 0, 3, 2]);
    for (const t of tri) buf.idx.push(start + t);
    quads++;
  }

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3, w = (d + 2) % 3;
    const nu = dims[u], nw = dims[w];
    const maskV = new Uint32Array(nu * nw);
    const maskAO = new Uint8Array(nu * nw);
    const p = [0, 0, 0], n = [0, 0, 0], s = [0, 0, 0];
    for (const dir of [1, -1]) {
      for (p[d] = 1; p[d] < dims[d] - 1; p[d]++) {
        let any = false;
        for (p[w] = 1; p[w] < nw - 1; p[w]++) {
          for (p[u] = 1; p[u] < nu - 1; p[u]++) {
            const i = p[u] + nu * p[w];
            maskV[i] = 0;
            const v = grid[at(p[0], p[1], p[2])];
            if (!v) continue;
            n[0] = p[0]; n[1] = p[1]; n[2] = p[2]; n[d] += dir;
            const nv = grid[at(n[0], n[1], n[2])];
            // a face shows if it meets air, or if it is solid and meets glass
            if (nv !== 0 && !(isGlass(nv) && !isGlass(v))) continue;
            let ao = 0;
            for (let c = 0; c < 4; c++) {
              const su = c === 0 || c === 3 ? -1 : 1, sw = c < 2 ? -1 : 1;
              s[0] = n[0]; s[1] = n[1]; s[2] = n[2]; s[u] += su;
              const s1 = opaque(grid[at(s[0], s[1], s[2])]) ? 1 : 0;
              s[u] = n[u]; s[w] += sw;
              const s2 = opaque(grid[at(s[0], s[1], s[2])]) ? 1 : 0;
              s[u] += su;
              const s3 = opaque(grid[at(s[0], s[1], s[2])]) ? 1 : 0;
              ao |= ((s1 && s2) ? 0 : 3 - (s1 + s2 + s3)) << (c * 2);
            }
            maskV[i] = v;
            maskAO[i] = ao;
            any = true;
          }
        }
        if (!any) continue;
        for (let jw = 1; jw < nw - 1; jw++) {
          for (let iu = 1; iu < nu - 1;) {
            const i = iu + nu * jw;
            const v = maskV[i];
            if (!v) { iu++; continue; }
            const ao = maskAO[i];
            let wd = 1, ht = 1;
            if (ao === OPEN) {                      // only flat, unshaded faces merge
              while (iu + wd < nu - 1 && maskV[i + wd] === v && maskAO[i + wd] === OPEN) wd++;
              grow: for (; jw + ht < nw - 1; ht++) {
                for (let k = 0; k < wd; k++) {
                  const j = i + k + nu * ht;
                  if (maskV[j] !== v || maskAO[j] !== OPEN) break grow;
                }
              }
            }
            for (let hh = 0; hh < ht; hh++) for (let k = 0; k < wd; k++) maskV[i + k + nu * hh] = 0;
            emit(isGlass(v) ? glass : solid, d, u, w, dir, p[d], iu, jw, wd, ht, v, ao);
            iu += wd;
          }
        }
      }
    }
  }

  return { solid: toGeometry(solid), glass: toGeometry(glass), bounds: b, quads };
}

export { VOXEL };
