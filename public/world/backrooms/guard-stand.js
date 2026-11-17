// The Backrooms — The Guard-Stand (`waterpark` centerpiece entity).
//
// Built by an alien simulation reconstructing a "lifeguard" from corrupted
// fourth-hand descriptions ("tall four-legged poolside chair with ladder rungs,
// sunburnt muscular body, long golden Baywatch hair, aviator sunglasses, whistle,
// life ring, umbrella, red rescue torpedo"):
//   - Head & Hair: an elongated, eyeless, noseless, mottled raw-flesh Backrooms
//     head wearing TWO stacked, crooked pairs of dark gold-wire teardrop aviator
//     sunglasses over sunken bruised sockets and a thin sloped scar-grimace,
//     crowned by windswept, shoulder-length golden-blonde Fabio locks.
//   - Torso & Pelvis: a gaunt sunburnt ribcage fused along the spine into a
//     weathered PVC chair backrest (tarnished brass whistle on a cord over its
//     collarbone, warped life-ring, torn dorsal umbrella, and right forearm
//     melted into a crimson rescue torpedo), melting below the waist into a
//     lumpy Telephone-Pole-Monster raw-flesh mass beneath the chair seat.
//   - 4 Chair Legs Breaking Apart: 4 corner chair legs (`FL, FR, BL, BR`), each
//     built as a 3-jointed (`femur -> tibia -> tarsus`) bendy spider limb.
//     When disguised (`unfold = 0`), the 4 legs lock upright so the split front
//     ladder rungs meet cleanly across the front like a real lifeguard chair;
//     when triggered (`unfold = 1`), the chair breaks apart down the middle and
//     its 4 bendy spider legs arch high and scuttle on 4 independent phases.

import * as THREE from 'three';
import { Vox, M } from '../vox/vox.js';
import { Batch, lamp } from './kit.js';
import { clamp } from './bits.js';
import { guardStandGait } from './waterpark.rule.js';

export const GUARD_VOX_SCALE = 0.026; // 2.6 cm per voxel

function makeFlesh() {
  const raw = ['#b67165', '#a35c52', '#c88577', '#8c4a42', '#ae4d3d'].map((k) => M(k, 2));
  const bruise = M('#5c303b', 2);
  const dark = M('#3e1922', 2);
  return (x, y, z) => {
    const h = Math.sin(x * 0.63 + y * 1.27) + Math.sin(z * 0.85 - y * 0.71) + Math.sin((x + z) * 0.39);
    if (h > 1.65) return bruise;
    if (h < -1.85) return dark;
    return raw[Math.abs(Math.floor(h * 1.5 + 9)) % raw.length];
  };
}

function makeBlonde() {
  const gold = ['#dfb036', '#be8c20', '#edc95a', '#946512'].map((k) => M(k, 1));
  return (x, y, z) => {
    const w = Math.sin(x * 0.72 + y * 0.44) + Math.cos(z * 0.66 - y * 0.52);
    return gold[Math.abs(Math.floor(w * 1.6 + 6)) % gold.length];
  };
}

const PAL = () => ({
  pvc: M('#cfdbe2', 1),
  pvcShade: M('#aebdc6', 2),
  gunmetal: M('#46515a', 1),
  rungSheared: M('#7d8b96', 1),
  brass: M('#8a6828', 1),
  brassDark: M('#4d3915', 1),
  goldWire: M('#7d5c1e', 0),
  goldWireDark: M('#5e4415', 0),
  lensDark: M('#05070c', 0),
  lensTint: M('#0e1620', 0),
  lensSlash: M('#263b4e', 0),
  rubber: M('#181b1f', 1),
  skinPale: M('#daa694', 2),
  sinew: M('#caa89c', 2),
  bruise: M('#5c303b', 2),
  socketDeep: M('#080103', 0),
  gum: M('#5e1e25', 2),
  tooth: M('#9e8860', 1),
  trunks: M('#c4221e', 2),
  trunksDark: M('#7e1311', 2),
  rescueRed: M('#d82820', 1),
  sunTan: M('#cbb892', 2),
  strap: M('#1b1f24', 1),
  board: M('#8c6943', 2),
});

function pelvisSeatVox() {
  const v = new Vox(), c = PAL(), flesh = makeFlesh();
  v.rbox(-14.5, -1.5, -12, 14.5, 2.2, 12, 1.4, c.pvc);
  for (const x of [-9, -3, 3, 9]) v.box(x - 1, 1.8, -9.5, x + 1, 2.8, 9.5, c.pvcShade);

  for (const sx of [-1, 1]) {
    const ax = sx * 13.5;
    v.tube(ax, 1.2, 9.5, ax, 9.8, 8.8, 1.25, c.pvc);
    v.tube(ax, 1.2, -9.5, ax, 9.8, -8.8, 1.25, c.pvc);
    v.rbox(ax - 1.5, 9.4, -10.5, ax + 1.5, 11.6, 10.5, 0.9, c.pvc);
    v.tube(sx * 7.5, 6.2, -3.5, ax, 10.5, -7.0, 2.1, flesh);
    v.tube(ax, 10.5, -7.0, ax, 10.8, 3.0, 1.4, flesh);
  }

  v.ellipsoid(0, 5.4, -0.5, 9.2, 4.8, 8.0, flesh);
  v.ellipsoid(-4.2, 4.6, 3.2, 5.8, 3.4, 4.6, c.trunks);
  v.ellipsoid(4.4, 4.4, 2.8, 5.4, 3.2, 4.8, c.trunks);
  v.ellipsoid(0, 4.2, -4.5, 6.8, 3.4, 4.4, c.trunksDark);
  v.ellipsoid(0, 8.4, -0.8, 7.6, 4.0, 6.4, flesh);

  // Telephone-Pole-Monster inspired broad, lumpy, asymmetrical raw-flesh mass under the seat
  v.ellipsoid(0, -4.6, 0, 12.6, 5.6, 10.5, flesh);
  v.ellipsoid(-6.8, -5.8, 3.5, 7.2, 4.6, 6.4, flesh);
  v.ellipsoid(6.8, -5.4, -3.0, 7.5, 4.5, 6.6, flesh);
  v.ellipsoid(-4.5, -6.2, -4.2, 6.5, 4.2, 5.8, flesh);
  v.ellipsoid(4.8, -6.5, 3.8, 6.4, 4.2, 5.6, flesh);

  for (let x = -7; x <= 7; x++) {
    const g = Math.max(1, Math.round(2.2 - Math.abs(x) * 0.18));
    v.carve(x, -11.5, -g, x + 1, -8.2, g);
    if (x % 2 === 0) {
      v.box(x, -9.8, -g, x + 1, -8.3, -g + 1, c.tooth);
      v.box(x, -9.8, g - 1, x + 1, -8.3, g, c.tooth);
    }
  }
  v.ellipsoid(0, -8.0, 0, 7.5, 1.5, 2.2, c.gum);
  return v;
}

function bellyTendrilsVox() {
  const v = new Vox(), flesh = makeFlesh(), c = PAL();
  const strands = [
    [-8.5, 0, 5.2, 6.5],
    [8.8, 0, 4.8, 7.0],
    [-8.2, 0, -5.4, 7.5],
    [8.4, 0, -5.0, 6.0],
  ];
  for (const [sx, sy, sz, len] of strands) {
    v.tube(sx, sy, sz, sx * 1.06, sy - len, sz * 1.04, 0.95, flesh);
    v.ellipsoid(sx * 1.06, sy - len - 0.8, sz * 1.04, 1.25, 1.6, 1.25, c.bruise);
  }
  return v;
}

/**
 * Segment 1 (`femur`, L1 = 22 voxels = 0.572 m along +X):
 * Thick, bowed, mottled raw-flesh muscular stalk arching into a swollen raw-flesh spider-knee at (22, 0, 0).
 */
function femurVox(sz) {
  const v = new Vox(), c = PAL(), flesh = makeFlesh();
  const N = 6;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const x0 = t0 * 22, x1 = t1 * 22;
    const y0 = Math.sin(t0 * Math.PI) * 2.3, y1 = Math.sin(t1 * Math.PI) * 2.3;
    const r = 2.95 - t0 * 0.65;
    v.tube(x0, y0, 0, x1, y1, 0, r, flesh);
  }
  if (sz > 0) {
    v.tube(0.5, 0.3, 0, 5.8, 1.5, 0, 3.2, c.trunks);
  }
  for (let i = 0; i < 5; i++) {
    const t0 = i / 5, t1 = (i + 1) / 5;
    const a0 = t0 * Math.PI * 2.2, a1 = t1 * Math.PI * 2.2;
    v.tube(
      2 + t0 * 18, Math.sin(t0 * Math.PI) * 2.3 + Math.sin(a0) * 1.7, Math.cos(a0) * 1.7,
      2 + t1 * 18, Math.sin(t1 * Math.PI) * 2.3 + Math.sin(a1) * 1.5, Math.cos(a1) * 1.5,
      0.85,
      i % 2 === 0 ? c.bruise : c.sinew
    );
  }
  v.tube(12, 1.6, 0, 20, 0.6, 0, 1.65, c.pvc);
  v.ellipsoid(22, 0.2, 0, 3.6, 3.4, 3.3, flesh);
  v.ellipsoid(20.8, 1.6, 0.8, 2.3, 2.1, 2.1, flesh);
  return v;
}

/**
 * Segment 2 (`tibia`, L2 = 23 voxels = 0.598 m along +X):
 * Sleek bowed PVC chair-leg tube wrapped in raw sinew, with the top split front ladder rung on
 * front legs (`sz > 0`) so the 4-legged lifeguard chair visibly breaks apart when unfolding!
 */
function tibiaVox(sx, sz) {
  const v = new Vox(), c = PAL(), flesh = makeFlesh();
  const N = 6;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const x0 = t0 * 23, x1 = t1 * 23;
    const y0 = Math.sin(t0 * Math.PI) * 1.6, y1 = Math.sin(t1 * Math.PI) * 1.6;
    v.tube(x0, y0, 0, x1, y1, 0, 1.85 - t0 * 0.2, i < 2 ? flesh : c.pvc);
  }
  v.tube(0, 0.8, 1.0, 12.0, 1.5, 0.5, 1.15, flesh);
  v.tube(0, -0.7, -0.9, 10.0, 1.0, -0.4, 0.95, c.sinew);

  // Split upper front ladder rung (at unfold=0, -Y points straight inward to x=0 across the front!)
  if (sz > 0) {
    const zf = sx * 0.6;
    v.tube(13.5, 0.8, zf, 13.5, -13.6, zf, 0.9, c.pvcShade);
    v.ellipsoid(13.5, -13.7, zf, 1.05, 1.05, 1.05, c.rungSheared);
  }

  v.ellipsoid(23, 0, 0, 2.8, 2.6, 2.5, flesh);
  v.cyl('z', 23, 0, -2.9, 2.9, 1.05, c.gunmetal);
  return v;
}

/**
 * Segment 3 (`tarsus`, L3 = 25 voxels = 0.650 m along +X):
 * Curved distal PVC chair leg with two lower split ladder rungs on the front legs (`sz > 0`),
 * ending in a ribbed black rubber chair ferrule / spider foot.
 */
function tarsusVox(sx, sz) {
  const v = new Vox(), c = PAL(), flesh = makeFlesh();
  const N = 6;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const x0 = t0 * 22.4, x1 = t1 * 22.4;
    const y0 = Math.sin(t0 * Math.PI) * 1.7, y1 = Math.sin(t1 * Math.PI) * 1.7;
    v.tube(x0, y0, 0, x1, y1, 0, 1.65 - t0 * 0.42, c.pvc);
  }
  v.tube(0, 0.5, 0.7, 7.5, 1.3, 0.3, 0.95, flesh);

  if (sz > 0) {
    const zf = sx * 0.6;
    for (const rx of [6.5, 15.5]) {
      v.tube(rx, 0.8, zf, rx, -13.8, zf, 0.9, c.pvcShade);
      v.ellipsoid(rx, -13.9, zf, 1.05, 1.05, 1.05, c.rungSheared);
    }
  }

  v.cyl('x', 0, 0, 21.6, 23.8, 2.25, c.rubber, 1.9);
  v.cyl('x', 0, 0, 23.5, 25.5, 2.0, c.rubber, 1.0);
  return v;
}

function torsoBackrestVox() {
  const v = new Vox(), c = PAL(), flesh = makeFlesh();
  v.tube(0, 0, 0, 0, 12.5, 1.6, 5.5, flesh);
  v.ellipsoid(0, 17.5, 2.6, 8.7, 8.0, 6.0, flesh);
  for (const ry of [12, 15, 18, 21]) {
    v.carve(-6.8, ry - 0.65, 5.8, -1.7, ry + 0.65, 9.4);
    v.carve(1.7, ry - 0.65, 5.8, 6.8, ry + 0.65, 9.4);
    v.tube(-6.5, ry + 0.95, 5.6, -1.3, ry + 0.95, 7.3, 0.85, c.skinPale);
    v.tube(1.3, ry + 0.95, 7.3, 6.5, ry + 0.95, 5.6, 0.85, c.skinPale);
  }
  v.tube(0, 11.5, 7.0, 0, 22.5, 6.8, 0.95, c.skinPale);
  v.tube(-6.8, 23.6, 4.5, 5.8, 9.5, 6.4, 1.15, c.trunks);

  // Tarnished brass lifeguard whistle hanging on crimson lanyard cord over collarbone
  v.tube(-3.2, 24.8, 4.6, 0, 19.6, 7.6, 0.65, c.trunks);
  v.tube(3.2, 24.8, 4.6, 0, 19.6, 7.6, 0.65, c.trunks);
  v.ellipsoid(0, 18.8, 7.9, 1.45, 1.65, 1.45, c.brass);
  v.tube(0, 19.2, 7.6, 0, 20.4, 8.6, 0.85, c.brassDark);

  for (let y = 3; y <= 19; y += 3) {
    v.ellipsoid(0, y, -3.6, 2.1, 1.5, 2.5, flesh);
    v.tube(0, y, -3.6, 0, y, -7.2, 1.15, y > 12 ? c.pvcShade : c.sinew);
  }
  for (const sx of [-1, 1]) {
    v.tube(sx * 10.2, -2, -8.5, sx * 10.6, 20.2, -7.8, 1.5, c.pvc);
    v.tube(sx * 6.8, 17.5, -2.2, sx * 10.4, 18.2, -7.8, 1.9, flesh);
    v.tube(sx * 5.2, 13.0, -2.5, sx * 10.2, 13.5, -7.8, 1.35, c.sinew);
  }
  v.rbox(-11.8, 9.5, -9.2, 11.8, 20.2, -6.8, 1.1, c.pvc);
  v.box(-1.6, 12.0, -6.9, 1.6, 18.5, -6.0, c.rescueRed);
  v.box(-4.6, 14.2, -6.9, 4.6, 16.8, -6.0, c.rescueRed);

  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
    const rx0 = -12.6 + Math.cos(a0) * 5.4, ry0 = 14.5 + Math.sin(a0) * 6.8 - (a0 > Math.PI ? 1.6 : 0);
    const rx1 = -12.6 + Math.cos(a1) * 5.4, ry1 = 14.5 + Math.sin(a1) * 6.8 - (a1 > Math.PI ? 1.6 : 0);
    v.tube(rx0, ry0, -8.4, rx1, ry1, -8.4, 1.5, i % 3 === 0 ? c.rescueRed : c.sunTan);
  }

  v.tube(4.5, 18, -8.2, 11.5, 36, -16.5, 1.05, c.gunmetal);
  const ux = 11.5, uy = 36, uz = -16.5;
  v.ellipsoid(ux, uy + 1, uz, 2.2, 1.7, 2.2, c.gunmetal);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.25;
    const droop = (i % 3 === 0) ? -11.5 : -7.5;
    const len = (i === 3 || i === 7) ? 12 : 16.5;
    const rx = ux + Math.cos(a) * len, rz = uz + Math.sin(a) * len, ry = uy + droop;
    const col = i % 2 === 0 ? c.rescueRed : c.sunTan;
    v.tube(ux, uy, uz, rx, ry, rz, 1.25, col);
    const aNext = ((i + 1) / 8) * Math.PI * 2 + 0.25;
    const mx = ux + Math.cos((a + aNext) * 0.5) * (len * 0.72);
    const mz = uz + Math.sin((a + aNext) * 0.5) * (len * 0.72);
    v.tube(ux, uy - 0.5, uz, mx, uy + droop * 0.65, mz, 2.0, col);
  }

  v.tube(0, 22.2, 2.5, 0, 27.2, 4.5, 3.6, flesh);
  v.tube(-2.8, 21.5, 3.5, -1.6, 27.0, 5.5, 1.25, c.bruise);
  v.tube(2.8, 21.5, 3.5, 1.6, 27.0, 5.5, 1.25, c.sinew);
  return v;
}

/**
 * Sculpt one crooked pair of dark gold-wire teardrop Aviator sunglasses (`yL`, `yR`, `z`)
 * sitting 1 voxel proud of the gaunt mottled skull — classic asymmetrical Aviator teardrop
 * lenses, double gold brow/nose bridge, temple arms into the blonde locks, zero white!
 */
function addAviators(v, c, { yL, yR, z, frame }) {
  const drawLens = (side, y0) => {
    // dx = 0 (inner nose side) .. 5 (outer temple side), dy = 0 (bottom) .. 4 (flat top bar)
    for (let dx = 0; dx <= 5; dx++) {
      const x = side < 0 ? -1 - dx : 1 + dx;
      for (let dy = 0; dy <= 4; dy++) {
        const y = y0 + dy;
        // Asymmetrical Aviator teardrop cutout: inner nose tapers at dy=0..1, outer rounds at dy=0
        if (dy === 0 && (dx <= 1 || dx === 5)) continue;
        if (dy === 1 && dx === 0) continue;

        const onRim =
          dy === 4 ||
          (dy === 0 && dx >= 2 && dx <= 4) ||
          (dy === 1 && (dx === 1 || dx === 5)) ||
          (dy >= 2 && (dx === 0 || dx === 5));

        if (onRim) {
          v.set(x, y, z, frame);
        } else {
          const slash = (dx + dy) === 4;
          v.set(x, y, z, slash ? c.lensSlash : (dy >= 2 ? c.lensDark : c.lensTint));
          v.set(x, y, z - 1, c.lensDark);
        }
      }
    }
    // Thin gold wire temple arm running back along the side of the skull into the golden hair
    const earX = side < 0 ? -6 : 6;
    for (let tz = 0; tz <= z; tz++) v.set(earX, y0 + 3, tz, frame);
  };

  drawLens(-1, yL);
  drawLens(1, yR);

  // Iconic double-bar Aviator brow & nose bridge across x = -1..+1, anchored back to the flesh
  const topMid = Math.round((yL + yR) * 0.5) + 4;
  const lowMid = Math.round((yL + yR) * 0.5) + 2;
  for (const bx of [-1, 0, 1]) {
    v.set(bx, topMid, z, frame);
    v.set(bx, lowMid, z, frame);
  }
  v.set(0, lowMid, z - 1, frame);
}

/**
 * Elongated Backrooms head: eyeless, noseless mottled raw flesh + TWO stacked pairs
 * of crooked gold-wire Aviator sunglasses + tense sloped scar-grimace + flowing golden Fabio locks!
 */
function headVox() {
  const v = new Vox(), c = PAL(), flesh = makeFlesh(), blonde = makeBlonde();

  // Vertically elongated, gaunt, hollow-cheeked Backrooms skull (no pig snout, no cartoon eyes!)
  v.ellipsoid(0, 11.4, 0.5, 6.1, 6.4, 5.9, flesh);
  v.ellipsoid(0, 5.0, 0.8, 5.7, 5.8, 5.7, flesh);
  v.ellipsoid(0, -1.6, 1.2, 4.3, 3.6, 4.6, flesh);

  // Gaunt sunken cheek hollows & bruised depressions behind the aviators (only recolouring existing skull)
  v.carve(-6.2, -2.4, 3.0, -4.1, 1.4, 6.4);
  v.carve(4.1, -2.4, 3.0, 6.2, 1.4, 6.4);
  for (let x = -5; x <= 5; x++) {
    if (Math.abs(x) < 1) continue;
    for (const yBand of [1, 2, 3, 4, 8, 9, 10, 11]) {
      for (let sz = 3; sz <= 6; sz++) {
        if (v.has(x, yBand, sz)) v.set(x, yBand, sz, c.bruise);
      }
    }
  }

  // Forehead crease on exposed raw mottled brow above the upper aviators
  v.tube(-4.4, 13.8, 4.8, 4.4, 13.6, 4.8, 0.7, c.bruise);

  // PAIR 1 (Upper Aviators — tilted left-high across upper brow, y = 8..12 left / 7..11 right, raw brow visible above!)
  addAviators(v, c, { yL: 8, yR: 7, z: 7, frame: c.goldWire });

  // PAIR 2 (Lower Aviators — tilted right-high across mid-face, y = 0..4 left / 1..5 right, cleanly separated!)
  addAviators(v, c, { yL: 0, yR: 1, z: 7, frame: c.goldWireDark });

  // Grim, narrow, crookedly sloped Backrooms scar-slit below the lower aviators
  for (let x = -3; x <= 3; x++) {
    const my = Math.round(-2.2 - x * 0.16);
    v.set(x, my, 5, 0);
    v.set(x, my, 6, 0);
    v.set(x, my, 4, c.socketDeep);
    if (v.has(x, my + 1, 5)) v.set(x, my + 1, 5, c.gum);
    if (v.has(x, my - 1, 5)) v.set(x, my - 1, 5, c.bruise);
  }

  // GLORIOUS SWEPT-BACK GOLDEN-BLONDE FABIO / BAYWATCH CROWN MANE (high parted crown leaving raw brow exposed)
  v.ellipsoid(0, 16.0, -1.4, 7.3, 4.0, 6.4, blonde);
  v.ellipsoid(-4.3, 16.3, 0.5, 4.6, 3.3, 5.5, blonde);
  v.ellipsoid(4.5, 16.1, 0.3, 4.8, 3.2, 5.5, blonde);
  v.tube(-1.4, 15.2, 4.5, -5.8, 17.8, 2.0, 2.3, blonde);
  v.tube(-5.8, 17.8, 2.0, -8.0, 13.4, -2.4, 2.65, blonde);
  v.tube(0.4, 15.2, 4.5, 5.6, 18.0, 2.2, 2.4, blonde);
  v.tube(5.6, 18.0, 2.2, 8.0, 13.2, -2.2, 2.65, blonde);
  v.tube(-7.0, 13.8, 1.0, -8.0, 6.4, -0.6, 2.4, blonde);
  v.tube(7.0, 13.8, 1.0, 8.0, 6.4, -0.6, 2.4, blonde);
  return v;
}

function hairSideLocksVox(sx) {
  return () => {
    const v = new Vox(), blonde = makeBlonde();
    const locks = [
      [[0, 2.0, 1.0], [sx * 1.8, -5.0, 2.2], [sx * 1.0, -12.5, 3.6], [sx * 2.4, -20.5, 2.6], 2.15],
      [[sx * 0.8, 2.5, -0.4], [sx * 3.0, -5.5, 0.2], [sx * 4.0, -13.5, -0.8], [sx * 2.8, -22.0, 0.4], 2.3],
      [[0.2, 1.5, -1.8], [sx * 2.2, -6.5, -2.2], [sx * 1.4, -14.5, -1.2], [sx * 3.2, -22.5, -2.0], 2.1],
      [[sx * 1.4, 0.0, 0.8], [sx * 4.4, -8.0, 1.6], [sx * 3.4, -16.0, 2.2], [sx * 4.8, -20.8, 1.2], 1.65],
    ];
    for (const [p0, p1, p2, p3, r] of locks) {
      v.tube(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], r, blonde);
      v.tube(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], r * 0.9, blonde);
      v.tube(p2[0], p2[1], p2[2], p3[0], p3[1], p3[2], r * 0.72, blonde);
    }
    return v;
  };
}

function hairBackLocksVox() {
  const v = new Vox(), blonde = makeBlonde();
  v.ellipsoid(0, -1.5, -0.5, 6.8, 5.0, 3.2, blonde);
  for (let i = -3; i <= 3; i++) {
    const bx = i * 2.1;
    const sway = (i % 2 === 0 ? 1 : -1) * 1.3;
    v.tube(bx, 1.5, 0, bx + sway * 0.6, -7.0, -1.6, 2.2, blonde);
    v.tube(bx + sway * 0.6, -7.0, -1.6, bx - sway * 0.5, -15.5, -2.8, 1.95, blonde);
    v.tube(bx - sway * 0.5, -15.5, -2.8, bx + sway * 0.8, -23.0 + Math.abs(i) * 0.8, -2.0, 1.45, blonde);
  }
  return v;
}

function rightTorpedoArmVox() {
  const v = new Vox(), c = PAL(), flesh = makeFlesh();
  v.ellipsoid(0, 0, 0, 3.1, 3.1, 3.1, flesh);
  v.tube(0, 0, 0, 2.2, -14, 3.5, 2.2, flesh);
  v.ellipsoid(2.2, -14, 3.5, 2.5, 2.5, 2.5, flesh);
  v.tube(2.2, -14, 3.5, 1.4, -25, 10.5, 2.05, flesh);

  for (const off of [-2.0, 0, 2.0]) {
    v.tube(1.4, -23, 9.5, 1.4 + off, -28.5, 16.0, 1.25, off === 0 ? c.sinew : flesh);
  }
  v.tube(1.4, -26, 12, 1.4, -36.5, 35, 4.2, c.rescueRed);
  v.ellipsoid(1.4, -37.0, 36.2, 3.7, 3.3, 4.6, c.rescueRed);
  v.tube(1.4, -30.5, 21.5, 1.4, -32.0, 25.0, 4.35, c.sunTan);
  v.carve(-1.7, -34.0, 17.5, 0.3, -29.5, 28.5);
  v.carve(2.5, -34.0, 17.5, 4.5, -29.5, 28.5);
  v.tube(1.4, -26, 12.5, 2.6, -35.5, 9.5, 0.65, c.strap);
  v.tube(2.6, -35.5, 9.5, 0.4, -40.5, 12.8, 0.65, c.strap);
  return v;
}

function leftClawArmVox() {
  const v = new Vox(), c = PAL(), flesh = makeFlesh();
  v.ellipsoid(0, 0, 0, 2.9, 2.9, 2.9, flesh);
  v.tube(0, 0, 0, -2.3, -14, 2.5, 2.05, flesh);
  v.ellipsoid(-2.3, -14, 2.5, 2.3, 2.3, 2.3, flesh);
  v.tube(-2.3, -14, 2.5, -1.6, -26, 7.8, 1.8, flesh);
  v.rbox(-2.9, -36.5, 5.5, -0.2, -25, 13.8, 0.6, c.board);
  v.box(-2.5, -35.5, 6.2, -0.5, -26.5, 13.0, c.sunTan);
  v.box(-2.6, -26.5, 8.2, -0.4, -24.6, 11.0, c.gunmetal);
  for (let f = 0; f < 4; f++) {
    const zf = 6.8 + f * 1.7;
    v.tube(-1.6, -26, 7.8, -3.3, -32.5 - (f % 2) * 1.5, zf, 0.75, c.sinew);
  }
  return v;
}

/**
 * Build the articulated 4-legged, 3-jointed Guard-Stand rig sharing a single `vox` surface material.
 */
export function makeGuardStandRig(kit, tag = 'guard-stand') {
  const S = GUARD_VOX_SCALE;
  const mat = kit.surface({ vox: true });
  const m4 = new THREE.Matrix4().makeScale(S, S, S);
  const lights = [
    lamp(0.4, 3.2, 1.2, [1.20, 1.20, 1.22], { k: 10, wrap: 0.5, far: 32 }),
    lamp(-0.6, -0.8, 0.6, [0.28, 0.68, 0.78], { k: 5, wrap: 0.55, far: 18 }),
  ];

  const geoCache = new Map();
  const makePart = (partKey, fn) => {
    let geo = geoCache.get(partKey);
    if (!geo) {
      const q = new Batch(true);
      q.addVox(kit.model(`wp:guardstand4:${tag}:${partKey}`, fn).solid, m4);
      geo = kit.geometry(q, lights, [0.56, 0.57, 0.59]);
      geoCache.set(partKey, geo);
    }
    return new THREE.Mesh(geo, mat);
  };

  const group = new THREE.Group();
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 1.70, 0);
  pelvisGroup.add(makePart('pelvis', pelvisSeatVox));
  group.add(pelvisGroup);

  const bellyHolder = new THREE.Group();
  bellyHolder.position.set(0, -6.5 * S, 0);
  bellyHolder.add(makePart('bellyTendrils', bellyTendrilsVox));
  pelvisGroup.add(bellyHolder);

  // 4 corner chair legs (`FL, FR, BL, BR`) breaking apart into 3-jointed bendy spider legs!
  const legDefs = [
    { key: 'fl', sx: -1, sz: 1 },
    { key: 'fr', sx: 1, sz: 1 },
    { key: 'bl', sx: -1, sz: -1 },
    { key: 'br', sx: 1, sz: -1 },
  ];

  const legs = legDefs.map(({ key, sx, sz }) => {
    const mount = new THREE.Group();
    mount.position.set(sx * 4.2 * S, 2.5 * S, sz * 9.5 * S);

    const femur = new THREE.Group();
    femur.add(makePart(sz > 0 ? 'femurF' : 'femurB', () => femurVox(sz)));
    mount.add(femur);

    const tibia = new THREE.Group();
    tibia.position.set(22 * S, 0, 0);
    tibia.add(makePart('tibia:' + key, () => tibiaVox(sx, sz)));
    femur.add(tibia);

    const tarsus = new THREE.Group();
    tarsus.position.set(23 * S, 0, 0);
    tarsus.add(makePart('tarsus:' + key, () => tarsusVox(sx, sz)));
    tibia.add(tarsus);

    pelvisGroup.add(mount);
    return { key, mount, femur, tibia, tarsus, sx, sz };
  });

  const spinePivot = new THREE.Group();
  spinePivot.position.set(0, 6 * S, -1 * S);
  spinePivot.add(makePart('torso', torsoBackrestVox));
  pelvisGroup.add(spinePivot);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 26.8 * S, 4.5 * S);
  headPivot.add(makePart('head', headVox));
  spinePivot.add(headPivot);

  const hairLeft = new THREE.Group();
  hairLeft.position.set(-6.3 * S, 10.5 * S, 0.2 * S);
  hairLeft.add(makePart('hairL', hairSideLocksVox(-1)));
  headPivot.add(hairLeft);

  const hairRight = new THREE.Group();
  hairRight.position.set(6.3 * S, 10.5 * S, 0.2 * S);
  hairRight.add(makePart('hairR', hairSideLocksVox(1)));
  headPivot.add(hairRight);

  const hairBack = new THREE.Group();
  hairBack.position.set(0, 10.0 * S, -4.8 * S);
  hairBack.add(makePart('hairB', hairBackLocksVox));
  headPivot.add(hairBack);

  const hairSprings = [
    { g: hairLeft, sx: -1, quick: 1.05, aZ: 0, vZ: 0, aX: 0, vX: 0, off: 0.0 },
    { g: hairRight, sx: 1, quick: 0.98, aZ: 0, vZ: 0, aX: 0, vX: 0, off: 1.7 },
    { g: hairBack, sx: 0, quick: 0.88, aZ: 0, vZ: 0, aX: 0, vX: 0, off: 3.1 },
  ];
  const bellySpring = { aZ: 0, vZ: 0, aX: 0, vX: 0 };

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(8.8 * S, 21.5 * S, 2.5 * S);
  rightArmPivot.add(makePart('rarm', rightTorpedoArmVox));
  spinePivot.add(rightArmPivot);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-8.8 * S, 21.5 * S, 2.5 * S);
  leftArmPivot.add(makePart('larm', leftClawArmVox));
  spinePivot.add(leftArmPivot);

  function pose({ unfold = 0, stride = 0, speed = 0, time = 0, mode = 'chair', headYaw = 0, dt = 0.016, turnRate = 0, strikeK = 0 }) {
    const g = guardStandGait(unfold, stride, speed, time, mode);
    pelvisGroup.position.y = g.pelvisY;
    pelvisGroup.rotation.set(g.pelvisPitch, 0, g.pelvisRoll, 'YXZ');

    for (let i = 0; i < legs.length; i++) {
      const lg = legs[i], pl = g.legs[i];
      lg.mount.rotation.y = pl.yaw;
      lg.femur.rotation.z = pl.femurZ;
      lg.tibia.rotation.z = pl.tibiaZ;
      lg.tarsus.rotation.z = pl.tarsusZ;
    }

    spinePivot.rotation.x = g.spinePitch + strikeK * 0.52;
    spinePivot.rotation.z = Math.sin(stride) * 0.065 * unfold;

    const idleTwitch = mode === 'chair' && Math.sin(time * 0.95) > 0.955 ? Math.sin(time * 36) * 0.07 : 0;
    headPivot.rotation.y = clamp(headYaw, -0.88, 0.88) + idleTwitch;
    headPivot.rotation.x = mode === 'whistle'
      ? -0.22 + Math.sin(time * 32) * 0.08
      : mode === 'surge'
        ? -0.40 - strikeK * 0.42
        : 0.14 - 0.20 * unfold;
    headPivot.rotation.z = mode === 'scan' ? Math.sin(time * 2.6) * 0.22 : idleTwitch * 0.7;

    const rRaise = mode === 'surge'
      ? -0.68 + Math.sin(stride * 2) * 0.18
      : mode === 'whistle'
        ? -0.38
        : -0.04 - 0.18 * unfold;
    rightArmPivot.rotation.x = rRaise + strikeK * 1.25;
    rightArmPivot.rotation.z = 0.08 + 0.22 * unfold;

    leftArmPivot.rotation.x = -0.06 - 0.24 * unfold - Math.sin(stride) * 0.20 * unfold;
    leftArmPivot.rotation.z = -0.08 - 0.16 * unfold;

    const stepDt = clamp(dt, 0.001, 0.05);
    const windBack = clamp(speed / 2.6, 0, 1.2) * 0.42 + (mode === 'whistle' ? 0.22 : 0);
    for (const h of hairSprings) {
      const targetZ = h.sx * (0.06 + windBack * 0.35) - turnRate * 0.09;
      const targetX = -windBack * (h.sx === 0 ? 0.65 : 0.42) - headPivot.rotation.x * 0.55;
      h.vZ += (18 * h.quick * (targetZ - h.aZ) - 4.4 * h.vZ) * stepDt;
      h.vX += (18 * h.quick * (targetX - h.aX) - 4.4 * h.vX) * stepDt;
      h.aZ = clamp(h.aZ + h.vZ * stepDt, -0.85, 0.85);
      h.aX = clamp(h.aX + h.vX * stepDt, -0.95, 0.65);
      const wave = Math.sin(time * 3.1 * h.quick + stride * 0.8 + h.off) * (0.04 + 0.12 * clamp(speed / 2, 0, 1) + (mode === 'whistle' ? 0.10 : 0));
      h.g.rotation.z = h.aZ + (h.sx !== 0 ? h.sx * Math.abs(wave) * 0.7 : wave * 0.4);
      h.g.rotation.x = h.aX + wave;
    }

    bellySpring.vZ += (-15 * bellySpring.aZ - 4.0 * bellySpring.vZ - turnRate * 0.42) * stepDt;
    bellySpring.vX += (-15 * (bellySpring.aX + clamp(speed * 0.12, 0, 0.35)) - 4.0 * bellySpring.vX) * stepDt;
    bellySpring.aZ = clamp(bellySpring.aZ + bellySpring.vZ * stepDt, -0.8, 0.8);
    bellySpring.aX = clamp(bellySpring.aX + bellySpring.vX * stepDt, -0.8, 0.8);
    bellyHolder.rotation.z = bellySpring.aZ + Math.sin(time * 2.3) * (0.04 + 0.10 * unfold);
    bellyHolder.rotation.x = bellySpring.aX + Math.cos(time * 1.9) * (0.03 + 0.09 * unfold);
  }

  pose({ unfold: 0, stride: 0, speed: 0, time: 0, mode: 'chair' });

  return {
    group,
    pelvisGroup,
    spinePivot,
    headPivot,
    hairLeft,
    hairRight,
    hairBack,
    rightArmPivot,
    leftArmPivot,
    legs,
    pose,
    light(rgb) {
      mat.uniforms.uTint.value.set(
        rgb[0] * 1.38 + 0.06,
        rgb[1] * 1.38 + 0.06,
        rgb[2] * 1.38 + 0.06
      );
    },
  };
}
