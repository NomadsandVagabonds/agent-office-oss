// Too much stock for a packing desk: the cards have buried the furniture.
// Full cards share one cached mesh and are folded into the room's voxel batch.
// (After Codex's Dispatch, thinned: it was 494 cards and 211,000 triangles, more
// than a whole set piece may cost. It is now a skin of about 95 cards over a
// dark core of slabs that nobody sees, the same height and the same footprint.)
import * as THREE from 'three';
import { gpuVox } from './figures.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function installFreightHoard(c, work) {
  const h = work.hoard;
  if (!h) throw new Error('dispatch hoard needs its reserved layout footprint');
  const R = c.R.fork('gpu-hoard'), gpu = c.kit.model('dispatch:gpu:v1', gpuVox);
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler(), vec = new THREE.Vector3(), scale = new THREE.Vector3();
  const items = [], core = [], peak = { x: h.peak.x, z: h.peak.z - 0.12 };
  const report = { gpuCount: 0, furnitureCount: 0, bounds: { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity, bottom: Infinity, top: -Infinity }, items, core, modelTriangles: gpu.solid.index.count / 3 };

  // Measure the identical transform used by c.place BEFORE touching a batch.
  // The full rotated mounting bracket/prop, not merely its center, must fit.
  function measure(geo, x, y, z, k, rot, tilt) {
    quat.setFromEuler(euler.set(tilt[0], rot, tilt[1], 'YXZ'));
    matrix.compose(vec.set(x, y, z), quat, scale.setScalar(c.kit.VOXEL * k));
    const b = geo.bounds, out = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity, bottom: Infinity, top: -Infinity };
    for (const bx of [b.x0, b.x1]) for (const by of [b.y0, b.y1]) for (const bz of [b.z0, b.z1]) {
      vec.set(bx, by, bz).applyMatrix4(matrix);
      out.x0 = Math.min(out.x0, vec.x); out.x1 = Math.max(out.x1, vec.x); out.z0 = Math.min(out.z0, vec.z); out.z1 = Math.max(out.z1, vec.z); out.bottom = Math.min(out.bottom, vec.y); out.top = Math.max(out.top, vec.y);
    }
    return out;
  }
  function keep(b) {
    for (const k of ['x0', 'z0', 'bottom']) report.bounds[k] = Math.min(report.bounds[k], b[k]);
    for (const k of ['x1', 'z1', 'top']) report.bounds[k] = Math.max(report.bounds[k], b[k]);
  }
  function place(geo, kind, x, y, z, options = {}) {
    const rot = options.rot ?? R.range(-Math.PI, Math.PI), tilt = options.tilt || [0, 0];
    let k = options.scale || 1, b = measure(geo, x, y, z, k, rot, tilt);
    const fit = Math.min(1, (h.w - 0.06) / (b.x1 - b.x0), (h.d - 0.06) / (b.z1 - b.z0), (h.h - 0.04) / (b.top - b.bottom));
    if (fit < 1) { k *= fit; b = measure(geo, x, y, z, k, rot, tilt); }
    x = clamp(x, h.x0 + 0.025 - (b.x0 - x), h.x1 - 0.025 - (b.x1 - x));
    z = clamp(z, h.z0 + 0.025 - (b.z0 - z), h.z1 - 0.025 - (b.z1 - z));
    y = clamp(y, 0.018 - (b.bottom - y), h.h - 0.02 - (b.top - y));
    b = measure(geo, x, y, z, k, rot, tilt);
    const foot = c.place(geo, x, z, { y, rot, tilt, scale: k, solid: false, shadow: false, tint: options.tint });
    keep(foot); items.push({ kind, ...foot, y, rot, tilt, scale: k });
    if (kind === 'gpu') report.gpuCount++; else report.furnitureCount++;
    return foot;
  }
  function card(x, y, z, rot, tilt, k = 1) {
    return place(gpu, 'gpu', x, y, z, { rot, tilt, scale: k, tint: R.pick([[1, 1, 1], [0.92, 1.0, 0.96], [1.06, 1.02, 0.91], [0.92, 0.96, 1.02]]) });
  }
  function prop(type, x, y, z, options) {
    const geo = c.env.catalogue.geo(type, options?.o);
    if (geo) return place(geo, type, x, y, z, options);
    return null;
  }

  // The volume is made of actual card-sized objects, including its middle.
  // Offset grids supply density, then jitter, fan angles and uneven heights
  // destroy the grid. No wide slabs or continuous horizontal stripes.
  const packed = [];
  for (let layer = 0; layer < 24; layer++) {
    const t = layer / 24, rx = 1.71 * (1 - t) + 0.10, rz = 1.47 * (1 - t) + 0.08;
    const cx = h.x + (peak.x - h.x) * t + Math.sin(layer * 1.91) * 0.10, cz = h.z + (peak.z - h.z) * t + Math.cos(layer * 2.17) * 0.08;
    const ox = R.range(-0.20, 0.20), oz = R.range(-0.14, 0.14);
    for (let zz = -rz; zz <= rz; zz += 0.31) for (let xx = -rx; xx <= rx; xx += 0.47) {
      if ((xx / rx) ** 2 + (zz / rz) ** 2 > 1.09) continue;
      packed.push({ x: cx + xx + ox + R.range(-0.10, 0.10), y: 0.055 + t * (h.h - 0.38) + R.range(-0.055, 0.055), z: cz + zz + oz + R.range(-0.085, 0.085),
        rot: R.range(-Math.PI, Math.PI), tilt: [R.range(-0.58, 0.58), R.range(-0.47, 0.47)], scale: R.range(0.94, 1.18), rank: R() });
    }
  }
  // Keep all of the sparse upper strata, then use a seeded sample of the
  // densely buried lower cards. The total visible-model budget is <500.
  // The middle of the heap is not cards any more: a dark, lumpy core, a slab to a stratum, each a little off the one
  // under it. Only the outermost of the packed cards are kept, where there is nothing in front of them.
  for (let layer = 0; layer < 9; layer++) {
    const t = layer / 9, t1 = (layer + 1) / 9, rx = (1.71 * (1 - t1) + 0.10) * 0.86, rz = (1.47 * (1 - t1) + 0.08) * 0.86;
    const cx = h.x + (peak.x - h.x) * (t + 0.05) + Math.sin(layer * 1.91) * 0.07, cz = h.z + (peak.z - h.z) * (t + 0.05) + Math.cos(layer * 2.17) * 0.06;
    const k = 0.035 + (layer % 3) * 0.012;
    c.flat.box(Math.max(h.x0 + 0.05, cx - rx), 0.02 + t * (h.h - 0.5), Math.max(h.z0 + 0.05, cz - rz), Math.min(h.x1 - 0.05, cx + rx), 0.02 + t1 * (h.h - 0.5), Math.min(h.z1 - 0.05, cz + rz), [k, k * 1.25, k * 1.05], { skip: '-y' });
  }
  const outer = packed.filter((p) => { const t = (p.y - 0.055) / (h.h - 0.38), rx = 1.71 * (1 - t) + 0.10, rz = 1.47 * (1 - t) + 0.08, cx = h.x + (peak.x - h.x) * t, cz = h.z + (peak.z - h.z) * t; return ((p.x - cx) / rx) ** 2 + ((p.z - cz) / rz) ** 2 > 0.62; }).sort((a, b) => a.rank - b.rank);
  for (const p of outer.slice(0, 28)) { const foot = card(p.x, p.y, p.z, p.rot, p.tilt, p.scale); core.push(foot); }

  // The desk already in rooms5 stays visible at the toe of the heap. These
  // familiar shapes are half lost inside it, not a second furniture exhibit.
  prop('cabinet', peak.x - 0.92, 0.03, peak.z + 0.25, { rot: -0.19, tilt: [0.1, -0.19] });
  const chair = prop('chair', h.x0 + 0.75, 0.34, h.z1 - 0.83, { rot: -0.52, tilt: [1.20, 0.43], o: { color: '#716d53' } });
  prop('crt', peak.x + 0.78, 1.61, h.z1 - 0.84, { rot: 0.15, tilt: [-0.40, 0.32] });
  prop('chair', peak.x - 0.66, h.h - 1.02, peak.z - 0.36, { rot: 0.71, tilt: [2.48, -0.37], scale: 0.92, o: { color: '#656c60' } });

  // Seventy overlapping, face-out cards in crooked pairs make the slopes
  // legible: fans, brackets, gold fingers and edge-on green circuit boards.
  for (let i = 0; i < 13; i++) {
    const t = (i + 0.25) / 13, a = i * 2.39996 + R.range(-0.22, 0.22), y = 0.23 + t * (h.h - 0.68);
    const rx = 1.70 * (1 - t) + 0.10, rz = 1.46 * (1 - t) + 0.10, tip = R.range(0.62, 1.34);
    const cx = peak.x + Math.sin(a) * rx, cz = peak.z + Math.cos(a) * rz;
    for (let k = 0; k < 2; k++) {
      const fan = k - 0.5, along = fan * 0.11;
      card(cx + Math.cos(a) * along + R.range(-0.045, 0.045), y + k * 0.052, cz - Math.sin(a) * along + R.range(-0.04, 0.04), a + fan * 0.19 + R.range(-0.12, 0.12), [tip + fan * 0.09, R.range(-0.23, 0.23)], R.range(0.95, 1.16));
    }
  }

  // Readable, face-out cards on the room-facing slope. Loose sheaves spill
  // over the old desktop, leaving a low edge at the worker's pickup point.
  for (let i = 0; i < 4; i++) {
    const x = peak.x - 0.86 + i * 0.54, z = h.z1 - 0.30 + Math.sin(i * 2) * 0.035;
    for (let k = 0; k < 6; k += 2) card(x + (k - 2.5) * 0.065, 0.84 + i * 0.01 + k * 0.035, z + (k - 2.5) * 0.014, -0.3 + i * 0.23 + (k - 2.5) * 0.13, [0.18 + i * 0.10 + k * 0.035, R.range(-0.11, 0.11)], R.range(0.98, 1.17));
  }

  // Thirty fallen cards at the wide toe. Some lie flat; others are caught
  // edge-on in the spill, with green backs and gold contacts facing outward.
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996 + R.range(-0.3, 0.3), rad = R.range(0.78, 1.05);
    const x = h.x + Math.sin(a) * (h.w / 2 - 0.22) * rad, z = h.z + Math.cos(a) * (h.d / 2 - 0.23) * rad;
    const leaned = i % 5 === 1;
    card(x, leaned ? 0.09 : 0.035 + R() * 0.13, z, R.range(-Math.PI, Math.PI), [leaned ? R.range(1.0, 1.5) : R.range(-0.22, 0.22), R.range(-0.27, 0.27)], R.range(0.9, 1.13));
  }

  // Cards caught around the crashed chair make a vertical, unstable-looking
  // knot. Their centers overlap the shell; none are suspended off the pile.
  const snagX = chair ? (chair.x0 + chair.x1) / 2 : peak.x - 0.8, snagZ = peak.z + 0.82;
  for (let i = 0; i < 6; i++) {
    const side = i % 3 - 1;
    card(snagX + side * 0.19, 0.42 + Math.floor(i / 3) * 0.16, snagZ + (i % 2) * 0.16, -0.7 + side * 0.32 + R.range(-0.15, 0.15), [R.range(1.1, 1.65), R.range(-0.5, 0.5)], R.range(1.0, 1.2));
  }

  // Eight larger boards make a ragged crown, leaning away from the midpoint
  // instead of finishing the mound with a tidy flat shelf.
  for (let i = 0; i < 6; i++) card(peak.x - 0.20 + Math.sin(i * 2.2) * 0.27, h.h - 0.66 + i * 0.035, peak.z - 0.13 + Math.cos(i * 1.8) * 0.24, R.range(-1.1, 1.1), [R.range(0.28, 1.28), R.range(-0.6, 0.6)], R.range(1.25, 1.63));

  // shadow() pads its rectangle by .24 m; keep that padded geometry inside too.
  c.shadow(h.x, h.z, h.w - 0.30, h.d - 0.30, 0.64);
  report.gpuTriangles = report.gpuCount * report.modelTriangles;
  report.withinBounds = report.bounds.x0 >= h.x0 && report.bounds.x1 <= h.x1 && report.bounds.z0 >= h.z0 && report.bounds.z1 <= h.z1 && report.bounds.bottom >= 0 && report.bounds.top <= h.h;
  return report;
}
