// The Backrooms — colleagues who came out wrong.
//
// Every humanoid thing down here begins as a real upstairs Office figure
// (`avatar/build.js`: rounded skull, ears, layered hair, collars, pockets,
// lanyards, trainers) and is then sculpted in voxel space into something that
// should not be standing in the fluorescent light: pallid mottled skin, sockets
// carved deep into the skull, bulging unblinking sclera with pinpoint pupils,
// crooked wire spectacles, horizontal scan-slipped jaws, or smooth eyeless skin
// split ear-to-ear by a carved-in smile.
import * as THREE from 'three';
import { Vox, M, C, glow, tone, mix, toCss, rgbOf, noise3 } from '../vox/vox.js';
import { JOINT } from '../avatar/build.js';

export { JOINT };

const distRgb = (a, b) => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return Math.hypot(ar - br, ag - bg, ab - bb);
};

/** Shift a look's skin toward clammy fluorescent pallor while keeping its undertone. */
export function pallorLook(look, { pallor = 0.34, tint = '#d8d2be' } = {}) {
  const base = look?.skin || '#e2bea0';
  return {
    species: 'human',
    hair: 'short',
    hairColor: '#2a221e',
    outfit: 'tee',
    outfitColor: '#5a6e7f',
    accessory: 'none',
    facial: 'none',
    ...look,
    skin: toCss(mix(base, tint, pallor)),
  };
}

/** Frontmost solid voxel z on the face at (x, y), ignoring anything far behind the skull. */
export function faceZ(v, x, y, zMax = 11, zMin = 2) {
  for (let z = zMax; z >= zMin; z--) if (v.has(x, y, z)) return z;
  return 7;
}

/** Remove the cute protruding human nose so upper faces can be sculpted cleanly. */
export function eraseNose(v) {
  v.carve(-2, 40, 8, 2, 44, 11);
}

/**
 * Mottle skin voxels on a head with sallow blotches, sunken gaunt cheek hollows,
 * bruised temple shadows, and clammy brow highlights (leaves hair & hats intact).
 */
export function mottleHead(v, skinHex, seed = 1, { gaunt = 0.24 } = {}) {
  const target = rgbOf(C(skinHex));
  const bruise = M(toCss(mix(skinHex, '#3d2629', 0.42)), 1);
  const b = v.bounds();
  const topY = b ? b.y1 : 52;
  v.remap((x, y, z, cur) => {
    if (distRgb(rgbOf(cur), target) > 46) return cur;
    let c = cur;
    const n = noise3(x, y, z, seed);
    if (n > 0.78) c = tone(c, 0.09);
    else if (n < 0.24) c = tone(c, -0.14);
    // Sunken gaunt hollows beneath the cheekbones and at the temples
    if (z >= 3 && Math.abs(x) >= 5 && y >= 37 && y <= topY - 10) c = mix(c, bruise, gaunt);
    if (z >= 2 && Math.abs(x) >= 7 && y >= 42 && y <= topY - 5) c = tone(c, -0.16);
    if (z >= 5 && y <= 36) c = tone(c, -0.18);
    return c;
  });
}

/**
 * Vertically stretch an `avatar/build.js` head by `extraY` voxels at `splitY`,
 * shifting the crown, fringe, and bun/hat upward while extruding the skull,
 * ears, and back hair cleanly through the elongated middle band.
 */
export function stretchHead(v, extraY = 16, splitY = 46) {
  if (extraY <= 0) return v;
  const src = v.clone();
  v.map.clear();
  src.each((x, y, z, col) => {
    if (y < splitY) v.set(x, y, z, col);
    else v.set(x, y + extraY, z, col);
  });
  const sampleY = splitY - 1;
  src.each((x, y, z, col) => {
    if (y !== sampleY) return;
    for (let ny = splitY; ny < splitY + extraY; ny++) v.set(x, ny, z, col);
  });
  return v;
}

/**
 * Smooth, eyeless blank-skin upper face for The Fun Committee: zero eyes, zero
 * pupils, nose erased — only two faint sunken skin-toned thumbprint depressions
 * beneath a taut brow ridge so fluorescent light catches where eyes ought to be.
 */
export function eyelessBrow(v, skinHex) {
  eraseNose(v);
  const indent = M(toCss(tone(skinHex, -0.15)), 1);
  const deep = M(toCss(tone(skinHex, -0.22)), 1);
  const ridge = M(toCss(tone(skinHex, 0.08)), 1);
  for (const cx of [-4.5, 3.5]) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = Math.round(cx + dx);
      const rz = faceZ(v, x, 46, 8, 3);
      if (v.has(x, 46, rz)) v.set(x, 46, rz, ridge);
      for (let y = 43; y <= 45; y++) {
        if (Math.abs(dx) === 2 && y === 43) continue;
        const z = faceZ(v, x, y, 8, 3);
        if (v.has(x, y, z)) v.set(x, y, z, Math.abs(dx) <= 1 && y === 44 ? deep : indent);
      }
    }
  }
}

/**
 * Deeply gouged ear-to-ear "carved-in" smile slicing high up into both cheeks.
 * Physically carves 2 voxels into the skull, lines the raw lip scar, and recesses
 * separated vertical yellowed teeth inside the dark cavity.
 */
export function carvedSmile(v, skinHex, {
  halfW = 7, yLow = 36, lift = 7.4, openH = 3.8, teeth = true,
} = {}) {
  const voidCol = M('#0b0305', 0);
  const gumCol = M('#4a1218', 1);
  const scarOuter = M(toCss(mix(skinHex, '#4d151b', 0.62)), 1);
  const scarFold = M(toCss(tone(skinHex, -0.32)), 1);
  const toothA = M('#e7dec0', 0), toothB = M('#cbc09a', 0);

  for (let x = -halfW - 1; x <= halfW; x++) {
    const u = (x + 0.5) / Math.max(1, halfW);
    const yc = yLow + lift * u * u;
    const h = Math.max(1.1, openH * (1 - 0.62 * Math.min(1, Math.abs(u))));
    const yBot = Math.round(yc - h * 0.45);
    const yTop = Math.round(yc + h * 0.55);

    // Carved scar lip above and below the gash
    for (const ry of [yBot - 1, yTop + 1]) {
      if (ry < 35 || ry > 49) continue;
      const rz = faceZ(v, x, ry, 8, 2);
      if (v.has(x, ry, rz)) v.set(x, ry, rz, Math.abs(u) > 0.75 ? scarFold : scarOuter);
    }

    if (Math.abs(x + 0.5) > halfW + 0.2) continue;

    for (let y = yBot; y <= yTop; y++) {
      if (y < 35 || y > 48) continue;
      const fz = faceZ(v, x, y, 8, 3);
      // Carve 2 voxels deep into the rounded cheek/jaw
      v.set(x, y, fz, 0);
      if (fz - 1 >= 1) v.set(x, y, fz - 1, 0);
      const backZ = Math.max(0, fz - 2);
      v.set(x, y, backZ, voidCol);
      for (const sx of [x - 1, x + 1]) if (v.has(sx, y, fz - 1)) v.set(sx, y, fz - 1, gumCol);

      if (teeth && Math.abs(u) < 0.78 && fz - 1 >= 1) {
        const span = yTop - yBot;
        const onBar = ((x + 16) % 2 === 0);
        if (span >= 2 && (y === yBot || y === yTop)) {
          v.set(x, y, fz - 1, onBar ? toothA : gumCol);
        } else if (onBar) {
          v.set(x, y, fz - 1, (x + y) % 3 === 0 ? toothB : toothA);
        }
      }
    }
  }
}

/**
 * Stark, unblinking bulging Backrooms eye surrounded by dark sleepless bags
 * with a tiny pinpoint pupil (and optional horizontal VHS scan-bleed).
 */
export function bulgingEye(v, cx, cy, w, h, pdx, pdy, skinHex, {
  bloodshot = false, glowPupil = false, glitch = 0,
} = {}) {
  const bag = M(toCss(mix(skinHex, '#210e13', 0.72)), 1);
  const crease = M(toCss(mix(skinHex, '#381c20', 0.52)), 1);
  const sclera = M('#f4f0dd', 0);
  const scleraShade = M('#ded7be', 0);
  const blood = M('#8f242a', 0);
  const pupil = glowPupil ? glow('#dcead0') : M('#060508', 0);

  const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
  // Dark bruised lid socket ring
  for (let x = x0 - 1; x <= x0 + w; x++) {
    for (let y = y0 - 1; y <= y0 + h; y++) {
      if (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h) continue;
      const corner = (x === x0 - 1 || x === x0 + w) && (y === y0 - 1 || y === y0 + h);
      const fz = faceZ(v, x, y, 8, 3);
      if (v.has(x, y, fz)) v.set(x, y, fz, corner ? crease : bag);
    }
  }
  // Stark white eyeball protruding forward out of the socket
  let maxEz = 7;
  for (let x = x0; x < x0 + w; x++) {
    for (let y = y0; y < y0 + h; y++) {
      const fz = faceZ(v, x, y, 8, 3);
      const inner = w >= 3 && h >= 3 && x > x0 && x < x0 + w - 1 && y > y0 && y < y0 + h - 1;
      const ez = inner ? fz + 1 : fz;
      if (ez > maxEz) maxEz = ez;
      const col = bloodshot && x === x0 && y === y0 ? blood : (inner ? sclera : scleraShade);
      v.set(x, y, fz, col);
      if (inner) v.set(x, y, ez, sclera);
    }
  }
  const px = Math.max(x0, Math.min(x0 + w - 1, Math.round(x0 + (w - 1) / 2 + pdx)));
  const py = Math.max(y0, Math.min(y0 + h - 1, Math.round(y0 + (h - 1) / 2 + pdy)));
  const pz = faceZ(v, px, py, maxEz + 1, 3);
  v.set(px, py, pz, pupil);
  // Optional 1-row camcorder scanline bleed beside the pupil (Image 4/7 signature)
  if (glitch) {
    const dir = glitch > 0 ? 1 : -1, len = Math.abs(glitch);
    for (let k = 1; k <= len; k++) {
      const gx = px + dir * k;
      const gz = faceZ(v, gx, py, maxEz + 1, 3);
      v.set(gx, py, gz, k === 1 ? pupil : bag);
    }
  }
}

/**
 * Deeply carved empty dark eye socket (like the hollow-eyed figure in Image 4/7),
 * optionally hiding a faint recessed pinprick deep inside the skull.
 */
export function hollowSocket(v, cx, cy, w, h, skinHex, { ember = false } = {}) {
  const rim = M(toCss(mix(skinHex, '#241013', 0.74)), 1);
  const fold = M(toCss(mix(skinHex, '#3b1f22', 0.52)), 1);
  const voidCol = M('#070406', 0);
  const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);

  for (let x = x0 - 1; x <= x0 + w; x++) {
    for (let y = y0 - 1; y <= y0 + h; y++) {
      const fz = faceZ(v, x, y, 8, 3);
      if (x < x0 || x >= x0 + w || y < y0 || y >= y0 + h) {
        const corner = (x === x0 - 1 || x === x0 + w) && (y === y0 - 1 || y === y0 + h);
        if (v.has(x, y, fz)) v.set(x, y, fz, corner ? fold : rim);
        continue;
      }
      // Carve 3 voxels deep into the skull
      v.set(x, y, fz, 0);
      if (fz - 1 >= 1) v.set(x, y, fz - 1, 0);
      if (fz - 2 >= 1) v.set(x, y, fz - 2, voidCol);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (v.has(nx, ny, fz - 1)) v.set(nx, ny, fz - 1, rim);
      }
    }
  }
  if (ember) {
    const mx = Math.round(x0 + (w - 1) / 2), my = Math.round(y0 + (h - 1) / 2);
    const fz = faceZ(v, mx, my, 8, 1);
    v.set(mx, my, Math.max(2, fz), glow('#dcead0'));
  }
}

/**
 * Off-centre, sloped, sunken Backrooms mouth / grimace with folded lip creases
 * and sparse crooked teeth.
 */
export function slippedMouth(v, mx, my, mw, mh, skinHex, {
  curve = 0, slope = -0.18, teeth = true,
} = {}) {
  const voidCol = M('#0a0406', 0);
  const lip = M(toCss(mix(skinHex, '#2c1316', 0.68)), 1);
  const tooth = M('#ded5b4', 0);
  const x0 = Math.round(mx - mw / 2);

  for (let i = -1; i <= mw; i++) {
    const x = x0 + i;
    const t = mw > 1 ? (Math.max(0, Math.min(mw - 1, i)) / (mw - 1)) * 2 - 1 : 0;
    const off = Math.round(curve * t * t + slope * (i - mw / 2));
    for (let j = -1; j <= mh; j++) {
      const y = my + j + off;
      if (y < 35 || y > 49) continue;
      const fz = faceZ(v, x, y, 8, 3);
      if (i < 0 || i >= mw || j < 0 || j >= mh) {
        if (v.has(x, y, fz)) v.set(x, y, fz, lip);
      } else {
        v.set(x, y, fz, 0);
        const bz = Math.max(1, fz - 1);
        const showTooth = teeth && mh >= 2 && (j === mh - 1 || j === 0) && ((i + j) % 2 === 0) && i > 0 && i < mw - 1;
        v.set(x, y, bz, showTooth ? tooth : voidCol);
      }
    }
  }
}

/**
 * Carve / paint horizontal & diagonal dark skin folds and scan-seams across
 * forehead, cheeks, and chin (Image 6 & Image 7 signature).
 * Each entry: [x0, y0, x1, y1, gouge?]
 */
export function carveCreases(v, skinHex, lines) {
  const dark = M(toCss(mix(skinHex, '#231012', 0.68)), 1);
  const mid = M(toCss(mix(skinHex, '#3d2122', 0.48)), 1);
  for (const [x0, y0, x1, y1, gouge = false] of lines) {
    const steps = Math.max(1, Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      const fz = faceZ(v, x, y, 8, 3);
      if (!v.has(x, y, fz)) continue;
      if (gouge && fz > 3) {
        v.set(x, y, fz, 0);
        v.set(x, y, fz - 1, dark);
      } else {
        v.set(x, y, fz, s === 0 || s === steps ? mid : dark);
      }
    }
  }
}

/**
 * Open 3D wire-rim glasses that sit crookedly across the face (NO `glass()` flag,
 * so `.solid` meshes every frame voxel cleanly while exposing the staring eyes
 * behind them — just like Jensen in Image 7).
 */
export function crookedSpecs(v, {
  leftY = 42, rightY = 40, h = 6, z = 9, frameHex = '#191613', chain = false, darkSide = 0,
} = {}) {
  const frame = M(frameHex, 0);
  const pitch = M('#09080c', 0);
  const drawRim = (x0, x1, y0, side) => {
    for (let x = x0; x <= x1; x++) {
      v.set(x, y0, z, frame);
      v.set(x, y0 + h - 1, z, frame);
    }
    for (let y = y0; y < y0 + h; y++) {
      v.set(x0, y, z, frame);
      v.set(x1, y, z, frame);
    }
    if (darkSide === side) {
      for (let x = x0 + 1; x < x1; x++) for (let y = y0 + 1; y < y0 + h - 1; y++) v.set(x, y, z, pitch);
    }
    const earX = side < 0 ? -10 : 9, templeY = y0 + h - 2;
    for (let tz = 0; tz <= z; tz++) v.set(earX, templeY, tz, frame);
  };
  drawRim(-8, -2, leftY, -1);
  drawRim(1, 7, rightY, 1);
  // Crooked stepped nose bridge
  v.set(-1, Math.round((leftY + rightY) / 2 + h - 2), z, frame);
  v.set(0, rightY + h - 2, z, frame);
  if (chain) {
    const bead = M('#c8a654', 0);
    for (const [cx, topY] of [[-9, leftY], [8, rightY]]) {
      for (let y = 34; y <= topY; y += 2) v.set(cx, y, z - 2, bead);
    }
  }
}

/** Shift specific horizontal y-bands `[y0, y1, dx, dz?]` of a head for permanent scan-slip wrongness. */
export function slipRows(v, bands) {
  const shift = new Map();
  for (const [y0, y1, dx, dz = 0] of bands) {
    for (let y = y0; y <= y1; y++) shift.set(y, [dx, dz]);
  }
  const copy = v.clone();
  v.map.clear();
  copy.each((x, y, z, col) => {
    const s = shift.get(y);
    v.set(s ? x + s[0] : x, y, s ? z + s[1] : z, col);
  });
  return v;
}

/** Violent bad-frame VHS head duplicate (matching `pursuer.js` `torn()`). */
export function tornVox(src, seed = 7) {
  const out = new Vox(), b = src.bounds(), shift = new Map();
  let h = seed | 0;
  const next = () => { h = Math.imul(h ^ (h >>> 15), 2246822519) + 1013904223; return ((h >>> 0) / 4294967296); };
  const pick = (arr) => arr[Math.floor(next() * arr.length)];
  for (let y = b.y0 + 2; y < b.y1; y += 2 + Math.floor(next() * 4)) {
    const span = 1 + Math.floor(next() * 3), dx = pick([-5, -3, -2, 2, 3, 4, 6]);
    for (let k = 0; k < span; k++) shift.set(y + k, dx);
    y += span;
  }
  src.each((x, y, z, c) => out.set(x + (shift.get(y) || 0), y, z, c));
  return out;
}

/**
 * Transform matrix for a limb/part modelled in figure coordinates (0..52),
 * rotated around `pivot` (`JOINT.*`) and scaled to world metres `[sx, sy, sz]`.
 */
export function jointMat(scale, pivot, rx = 0, ry = 0, rz = 0, stretchY = 1, dx = 0, dy = 0, dz = 0) {
  const [sx, sy, sz] = Array.isArray(scale) ? scale : [scale, scale, scale];
  const m = new THREE.Matrix4().makeScale(sx, sy, sz);
  if (dx || dy || dz) m.multiply(new THREE.Matrix4().makeTranslation(dx, dy, dz));
  m.multiply(new THREE.Matrix4().makeTranslation(pivot[0], pivot[1], pivot[2]));
  if (rx || ry || rz) m.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
  if (stretchY !== 1) m.multiply(new THREE.Matrix4().makeScale(1, stretchY, 1));
  m.multiply(new THREE.Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
  return m;
}

/**
 * Transform matrix in LOCAL joint space (when a THREE.Group is already placed at
 * `[pivot[0] * sx, pivot[1] * sy, pivot[2] * sz]`), shifting figure voxels so
 * `pivot` sits at `(0, 0, 0)` of the group.
 */
export function localJointMat(scale, pivot, rx = 0, ry = 0, rz = 0, stretchY = 1) {
  const [sx, sy, sz] = Array.isArray(scale) ? scale : [scale, scale, scale];
  const m = new THREE.Matrix4().makeScale(sx, sy, sz);
  if (rx || ry || rz) m.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
  if (stretchY !== 1) m.multiply(new THREE.Matrix4().makeScale(1, stretchY, 1));
  m.multiply(new THREE.Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
  return m;
}
