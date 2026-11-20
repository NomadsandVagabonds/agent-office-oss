// Floor 1 (Yellow Office) chunky voxel-grid procedural textures.
// Every surface is drawn onto a crisp 4×4 (or 2×2 on 128 px tiles) pixel grid so
// it keeps BlockRooms' tactile voxel roots while using LinearFilter +
// LinearMipmapLinearFilter + anisotropy = 8 — required by Three.js r180's
// WebGPURenderer to keep anisotropic filtering active at steep corridor angles.
// Pure deterministic drawing: seeded hashes and LCGs only, zero room-RNG draws.
import * as THREE from 'three';

/** Wallpaper patterns that represent printed paper (vs blockwork, board, panels, mall, sky, ceramic tiles, boughs). */
export const OFFICE_PAPER_PATTERNS = new Set([
  'chevron', 'chevrons', 'dots', 'diamonds', 'stripes', 'trellis', 'sprigs', undefined, null, '',
]);

/** Frozen 2×2 quad UVs `[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]` for `makeStainAtlasTexture()` (flipY = true). */
export const STAIN_UVS = Object.freeze([
  // Cell 0 (top-left: 0..128, 0..128): organic damp carpet water patch
  Object.freeze([Object.freeze([0, 0.5]), Object.freeze([0.5, 0.5]), Object.freeze([0.5, 1]), Object.freeze([0, 1])]),
  // Cell 1 (top-right: 128..256, 0..128): ceiling/floor tide-mark water ring
  Object.freeze([Object.freeze([0.5, 0.5]), Object.freeze([1, 0.5]), Object.freeze([1, 1]), Object.freeze([0.5, 1])]),
  // Cell 2 (bottom-left: 0..128, 128..256): doorway foot-traffic smudge
  Object.freeze([Object.freeze([0, 0]), Object.freeze([0.5, 0]), Object.freeze([0.5, 0.5]), Object.freeze([0, 0.5])]),
  // Cell 3 (bottom-right: 128..256, 128..256): shallow glossy puddle / splash
  Object.freeze([Object.freeze([0.5, 0]), Object.freeze([1, 0]), Object.freeze([1, 0.5]), Object.freeze([0.5, 0.5])]),
]);

/* ---- colour, deterministic hash & canvas helpers -------------------------------- */

function parseColor(c, fallback = '#c8bc72') {
  const raw = String(c || fallback).trim();
  if (raw.startsWith('rgb')) {
    const m = raw.match(/\d+/g);
    if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
  }
  const s = raw.replace('#', '');
  const full = s.length === 3 ? s[0] + s[0] + s[1] + s[1] + s[2] + s[2] : s.padEnd(6, '0');
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return [Number.isFinite(r) ? r : 200, Number.isFinite(g) ? g : 188, Number.isFinite(b) ? b : 114];
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

function shade(c, amt) {
  const [r, g, b] = parseColor(c);
  const f = (v) => clamp255(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function shadeRgba(c, amt, a) {
  const [r, g, b] = parseColor(c);
  const f = (v) => clamp255(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  return `rgba(${f(r)},${f(g)},${f(b)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

function shiftRgba(c, dr, dg, db, a) {
  const [r, g, b] = parseColor(c);
  return `rgba(${clamp255(r + dr)},${clamp255(g + dg)},${clamp255(b + db)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

const lcg = (seed) => {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const hash = (x, y, s = 0) => {
  let n = Math.imul(x + 913, s + 374761393) ^ Math.imul(y + 719, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
};

const colorSeed = (c, salt = 0) => {
  const [r, g, b] = parseColor(c);
  return (((r << 16) | (g << 8) | b) + salt * 977) >>> 0;
};

const P = (g, c, x, y, w, h) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

/** Fill a rect wrapping cleanly across `[0..W) × [0..H)` so tiled motifs never clip at borders. */
function fillWrap(g, c, x, y, w, h, W, H) {
  g.fillStyle = c;
  const rx = ((x % W) + W) % W;
  const ry = ((y % H) + H) % H;
  const w1 = Math.min(w, W - rx), w2 = w - w1;
  const h1 = Math.min(h, H - ry), h2 = h - h1;
  g.fillRect(rx, ry, w1, h1);
  if (w2 > 0) g.fillRect(0, ry, w2, h1);
  if (h2 > 0) g.fillRect(rx, 0, w1, h2);
  if (w2 > 0 && h2 > 0) g.fillRect(0, 0, w2, h2);
}

/** Smooth minimum of two signed distances for organic multi-lobe silhouettes. */
function smin(a, b, k = 0.22) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function makeTexture(w, h, draw, {
  wrapS = THREE.RepeatWrapping,
  wrapT = THREE.RepeatWrapping,
  anisotropy = 8,
  minFilter = THREE.LinearMipmapLinearFilter,
  magFilter = THREE.LinearFilter,
} = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) {
    g.imageSmoothingEnabled = false;
    draw(g, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = magFilter;
  t.minFilter = minFilter;
  t.anisotropy = anisotropy;
  t.wrapS = wrapS;
  t.wrapT = wrapT;
  t.needsUpdate = true;
  return t;
}

/* ---- 1. Wallpaper (256×256, 0.8 m repeat, 4×4 chunky voxel grid) ---------------- */

/**
 * Floor 1 office wallpaper: 256×256 on a 4×4 voxel grid preserving kit.js's exact
 * 32×32 motif scale (S = 8 px per classic unit), enriched with vertical vinyl/linen
 * micro-weave, seamless sun-fade aging, and a vertical strip seam along x = 0..4.
 */
export function makeWallpaperTexture(look = {}) {
  const wall = look?.wall || '#d5c879';
  const ink = look?.ink || shade(wall, -0.18);
  const pale = look?.pale || shade(wall, 0.12);
  const pattern = look?.pattern;

  return makeTexture(256, 256, (g, W, H) => {
    const seed = colorSeed(wall, 11);
    const r = lcg(seed);
    const phaseA = r() * Math.PI * 2;
    const phaseB = r() * Math.PI * 2;
    const phaseC = r() * Math.PI * 2;
    const TAU = Math.PI * 2;

    P(g, wall, 0, 0, W, H);

    // Seamless sun-fade aging mottling + vertical linen/vinyl micro-weave on 4×4 grid (64×64 cells)
    for (let row = 0; row < 64; row++) {
      const y = row * 4;
      const vy = (row / 64) * TAU;
      for (let col = 0; col < 64; col++) {
        const x = col * 4;
        const vx = (col / 64) * TAU;
        const h = hash(col, row, seed & 0xffff);

        // Broad seamless aging / sun-fade wave (integer frequencies guarantee zero seam pop)
        const mottle =
          Math.sin(vx + phaseA) * Math.cos(vy + phaseB) * 0.55 +
          Math.sin(vx * 2 - vy + phaseC) * 0.30 +
          Math.cos(vy * 2 + phaseA * 0.7) * 0.15;
        if (mottle > 0.36) P(g, shadeRgba(wall, 0.045, 0.55), x, y, 4, 4);
        else if (mottle < -0.34) P(g, shiftRgba(wall, -9, -11, -14, 0.38), x, y, 4, 4);

        // Subtle vertical linen/vinyl weave: alternating warm/cool ±2–3% tooth
        const colBias = (col & 1) ? 1 : -1;
        const cross = ((row + (col & 1)) & 3) === 0;
        if (cross) {
          P(g, colBias > 0 ? shiftRgba(wall, 7, 5, 1, 0.24) : shiftRgba(wall, -6, -5, -2, 0.22), x, y, 4, 4);
        } else if ((h % 7) === 0) {
          P(g, colBias > 0 ? shadeRgba(wall, 0.032, 0.42) : shadeRgba(wall, -0.035, 0.42), x, y, 4, 4);
        }
      }
    }

    // Occasional longer vertical linen slub fibers (4×8..4×20), seamless via fillWrap
    for (let i = 0; i < 42; i++) {
      const sx = ((r() * 64) | 0) * 4;
      const sy = ((r() * 64) | 0) * 4;
      const sh = (2 + ((r() * 4) | 0)) * 4;
      const tone = (r() - 0.5) * 0.055;
      fillWrap(g, shadeRgba(wall, tone, 0.55), sx, sy, 4, sh, W, H);
    }

    // Classic 32×32 motifs at S = 8 px per classic unit, sculpted on the 4×4 voxel grid
    const S = 8;
    const inkDeep = shade(ink, -0.09);
    const inkSoft = shadeRgba(ink, 0.08, 0.65);

    if (pattern === 'dots') {
      for (let gy = 2; gy < 32; gy += 8) {
        const xStart = (((gy - 2) / 8) % 2) ? 6 : 2;
        for (let gx = xStart; gx < 32; gx += 8) {
          const px = gx * S, py = gy * S;
          // 16×16 dot footprint with embossed top-left pale glint and dark core
          fillWrap(g, shadeRgba(ink, -0.14, 0.35), px + 4, py + 12, 12, 4, W, H);
          fillWrap(g, ink, px, py, 16, 16, W, H);
          fillWrap(g, inkDeep, px + 4, py + 4, 8, 8, W, H);
          fillWrap(g, pale, px, py - 8, 8, 8, W, H);
          fillWrap(g, shadeRgba(pale, 0.14, 0.65), px, py, 4, 4, W, H);
        }
      }
    } else if (pattern === 'diamonds') {
      for (let gy = 4; gy < 32; gy += 16) {
        const xStart = (((gy - 4) / 16) % 2) ? 12 : 4;
        for (let gx = xStart; gx < 32; gx += 16) {
          const cx = gx * S, cy = gy * S;
          // Exact 5×5 classic-unit stepped diamond (40×40 px)
          fillWrap(g, shadeRgba(ink, -0.14, 0.30), cx + 4, cy - 12, 8, 40, W, H);
          fillWrap(g, ink, cx, cy - 16, 8, 40, W, H);
          fillWrap(g, ink, cx - 8, cy - 8, 24, 24, W, H);
          fillWrap(g, ink, cx - 16, cy, 40, 8, W, H);
          // Stepped inner accent & crisp embossed highlight
          fillWrap(g, inkDeep, cx - 4, cy - 8, 16, 24, W, H);
          fillWrap(g, inkDeep, cx - 8, cy - 4, 24, 16, W, H);
          fillWrap(g, pale, cx, cy, 8, 8, W, H);
          fillWrap(g, shadeRgba(pale, 0.12, 0.60), cx - 8, cy - 8, 4, 4, W, H);
          fillWrap(g, shadeRgba(pale, 0.12, 0.60), cx, cy - 16, 4, 4, W, H);
        }
      }
    } else if (pattern === 'stripes') {
      for (let gx = 2; gx < 32; gx += 8) {
        const px = gx * S;
        // 16 px wide printed ink band with fine woven sub-ribbing + 8 px pale pinstripe
        P(g, ink, px, 0, 16, H);
        P(g, inkDeep, px, 0, 4, H);
        P(g, inkSoft, px + 12, 0, 4, H);
        for (let y = 0; y < H; y += 16) {
          P(g, shadeRgba(wall, 0.04, 0.22), px + 4, y, 8, 4);
        }
        P(g, pale, px + 24, 0, 8, H);
        P(g, shadeRgba(pale, 0.16, 0.45), px + 24, 0, 4, H);
      }
    } else if (pattern === 'trellis') {
      // Diagonal lattice repeating every 16 classic units (128 px = 32 cells of 4 px)
      for (let i = 0; i < 64; i++) {
        const y = i * 4;
        const x1 = i * 4;
        const x2 = (63 - i) * 4;
        for (const shift of [0, 128]) {
          fillWrap(g, ink, x1 + shift, y, 8, 8, W, H);
          fillWrap(g, ink, x2 + shift, y, 8, 8, W, H);
          fillWrap(g, shadeRgba(pale, 0.08, 0.35), x1 + shift + 8, y, 4, 4, W, H);
          fillWrap(g, shadeRgba(pale, 0.08, 0.35), x2 + shift - 4, y, 4, 4, W, H);
        }
      }
      // Classic pale rosette nodes at (x + 7, y + 7) every 16 classic units
      for (let gy = 0; gy < 32; gy += 16) {
        for (let gx = 0; gx < 32; gx += 16) {
          const nx = (gx + 7) * S, ny = (gy + 7) * S;
          fillWrap(g, inkDeep, nx - 4, ny - 4, 24, 24, W, H);
          fillWrap(g, pale, nx, ny, 16, 16, W, H);
          fillWrap(g, ink, nx + 4, ny + 4, 8, 8, W, H);
        }
      }
    } else if (pattern === 'sprigs') {
      for (let gy = 5; gy < 32; gy += 16) {
        const xStart = (((gy - 5) / 16) % 2) ? 13 : 5;
        for (let gx = xStart; gx < 32; gx += 16) {
          const px = gx * S, py = gy * S;
          // Stem (8×32 px), paired voxel leaves, and 3-petal pale blossom
          fillWrap(g, ink, px, py, 8, 32, W, H);
          fillWrap(g, inkDeep, px + 4, py + 4, 4, 28, W, H);
          fillWrap(g, ink, px - 8, py + 8, 24, 8, W, H);
          fillWrap(g, inkSoft, px - 8, py + 8, 8, 4, W, H);
          fillWrap(g, inkSoft, px + 8, py + 8, 8, 4, W, H);
          fillWrap(g, pale, px - 8, py - 8, 8, 8, W, H);
          fillWrap(g, pale, px + 8, py - 8, 8, 8, W, H);
          fillWrap(g, pale, px, py - 16, 8, 8, W, H);
          fillWrap(g, shadeRgba(pale, 0.18, 0.7), px, py - 16, 4, 4, W, H);
          fillWrap(g, inkDeep, px, py - 8, 8, 8, W, H);
        }
      }
    } else {
      // Classic Backrooms chevron wave: repeats every 8 classic units (64 px)
      for (let gy = 3; gy < 32; gy += 8) {
        const baseY = gy * S;
        for (let gx = 0; gx < 32; gx++) {
          const k = gx % 8;
          const dy = (k < 4 ? k : 7 - k) * S;
          const px = gx * S, py = baseY + dy;
          // Embossed pale crest highlight, crisp 8×8 chevron stroke, subtle stepped underside shadow
          fillWrap(g, shadeRgba(pale, 0.12, 0.48), px, py - 4, 8, 4, W, H);
          fillWrap(g, ink, px, py, 8, 8, W, H);
          fillWrap(g, inkDeep, px + 4, py + 4, 4, 4, W, H);
          if (k === 0 || k === 4) {
            fillWrap(g, shadeRgba(ink, -0.15, 0.42), px, py + 8, 8, 4, W, H);
          }
        }
      }
    }

    // Subtle vertical wallpaper strip seam along x = 0..4 + 4 px pale overlap edge
    P(g, shadeRgba(wall, -0.12, 0.25), W - 4, 0, 4, H);
    P(g, shadeRgba(wall, -0.28, 0.68), 0, 0, 2, H);
    P(g, shadeRgba(wall, -0.14, 0.42), 2, 0, 2, H);
    P(g, shadeRgba(pale, 0.16, 0.42), 4, 0, 4, H);
  });
}

/* ---- 2. Commercial Office Carpet (256×256, 1.6 m repeat, 2×2 carpet tiles) ------ */

/**
 * Moist commercial office carpet: 256×256 on a 4×4 voxel grid representing a 2×2 grid
 * of 0.8 m carpet tiles (1.6 m repeat), with alternating tile nap tint shift, subtle
 * tile seams, organic multi-stepped damp patches, and woven low-pile voxel speckle.
 */
export function makeCarpetTexture(color = '#80765b') {
  const base = color || '#80765b';
  return makeTexture(256, 256, (g, W, H) => {
    const seed = colorSeed(base, 23);
    const r = lcg(seed);
    const pA = r() * Math.PI * 2;
    const pB = r() * Math.PI * 2;
    const pC = r() * Math.PI * 2;
    const TAU = Math.PI * 2;

    // 2×2 commercial carpet-tile bases with subtle ±3.5% checkerboard nap-direction tint shift
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const shift = ((tx + ty) & 1) ? -0.034 : 0.034;
        P(g, shade(base, shift), tx * 128, ty * 128, 128, 128);
      }
    }

    // Multi-stepped organic damp-patch tonal clouds (seamless integer-harmonic field + blotches)
    for (let row = 0; row < 64; row++) {
      const y = row * 4;
      const vy = (row / 64) * TAU;
      for (let col = 0; col < 64; col++) {
        const x = col * 4;
        const vx = (col / 64) * TAU;
        const cloud =
          Math.sin(vx + pA) * Math.sin(vy + pB) * 0.50 +
          Math.cos(vx * 2 + vy + pC) * 0.30 +
          Math.sin(vx - vy * 2 + pA * 0.6) * 0.20;
        if (cloud < -0.44) {
          // Deeper olive/brownish damp pocket
          P(g, shiftRgba(base, -18, -14, -22, 0.42), x, y, 4, 4);
        } else if (cloud < -0.18) {
          // Outer damp halo
          P(g, shiftRgba(base, -10, -8, -13, 0.28), x, y, 4, 4);
        } else if (cloud > 0.48) {
          // Slightly drier/worn traffic high spot
          P(g, shadeRgba(base, 0.055, 0.26), x, y, 4, 4);
        }
      }
    }

    // Stepped voxel damp blotches (wrapped seamlessly across tile edges)
    for (let i = 0; i < 10; i++) {
      const cx = ((r() * 64) | 0) * 4;
      const cy = ((r() * 64) | 0) * 4;
      const rx = (3 + ((r() * 5) | 0)) * 4;
      const ry = (2 + ((r() * 4) | 0)) * 4;
      fillWrap(g, shiftRgba(base, -14, -12, -18, 0.26), cx - rx, cy - ry, rx * 2, ry * 2, W, H);
      fillWrap(g, shiftRgba(base, -22, -17, -24, 0.30), cx - ((rx * 0.5) & ~3), cy - ((ry * 0.5) & ~3), Math.max(8, rx), Math.max(8, ry), W, H);
    }

    // Woven low-pile voxel speckle with alternating directional weave per carpet tile
    for (let row = 0; row < 64; row++) {
      const y = row * 4;
      const ty = row >> 5;
      for (let col = 0; col < 64; col++) {
        const x = col * 4;
        const tx = col >> 5;
        const h = hash(col, row, (seed ^ 0x51a7) & 0xffff);
        const horizNap = ((tx + ty) & 1) === 0;
        const rib = horizNap ? (row & 1) : (col & 1);
        const m = h % 16;

        if (m < 3) {
          P(g, shadeRgba(base, 0.095, 0.58), x, y, 4, 4);
        } else if (m < 6) {
          P(g, shadeRgba(base, -0.105, 0.58), x, y, 4, 4);
        } else if (m === 6) {
          P(g, shiftRgba(base, -20, -18, -22, 0.52), x, y, 4, 4);
        } else if (m === 7) {
          P(g, shadeRgba(base, 0.12, 0.42), x, y, 4, 4);
        } else if (rib === 0 && (h & 32)) {
          P(g, shadeRgba(base, 0.045, 0.36), x, y, 4, 4);
        } else if (rib === 1 && (h & 64)) {
          P(g, shadeRgba(base, -0.055, 0.36), x, y, 4, 4);
        }
      }
    }

    // Subtle commercial carpet-tile grid seams at 0 and 128 (0.8 m modular tile joints)
    for (const k of [0, 128]) {
      P(g, shadeRgba(base, -0.24, 0.48), k, 0, 2, H);
      P(g, shadeRgba(base, 0.07, 0.24), k + 2, 0, 2, H);
      P(g, shadeRgba(base, -0.24, 0.48), 0, k, W, 2);
      P(g, shadeRgba(base, 0.07, 0.24), 0, k + 2, W, 2);
    }
  });
}

/* ---- 3 & 4. Acoustic Drop-Ceiling Tiles (128×128, 0.6 m tile) ------------------- */

function drawCeilingTileBase(g, W, H, color) {
  const base = color || '#d6d2c4';
  const seed = colorSeed(base, 37);
  const r = lcg(seed);

  P(g, base, 0, 0, W, H);

  // Subtle 4×4 mineral-board tonal variation + slight aged edge darkening
  for (let row = 0; row < 32; row++) {
    const y = row * 4;
    for (let col = 0; col < 32; col++) {
      const x = col * 4;
      const h = hash(col, row, seed & 0xffff);
      const edgeDist = Math.min(col, row, 31 - col, 31 - row);
      if (edgeDist <= 2) {
        P(g, shiftRgba(base, -12, -11, -14, edgeDist <= 1 ? 0.42 : 0.22), x, y, 4, 4);
      } else if ((h % 9) === 0) {
        P(g, shadeRgba(base, 0.035, 0.45), x, y, 4, 4);
      } else if ((h % 11) === 0) {
        P(g, shadeRgba(base, -0.04, 0.45), x, y, 4, 4);
      }
    }
  }

  // Clustered mineral-fiber fissures and pinholes on 2×2 voxel grid (authentic acoustic tile, NOT uniform static)
  const clusterCount = 16;
  for (let c = 0; c < clusterCount; c++) {
    const cx = 12 + (((r() * 50) | 0) * 2);
    const cy = 12 + (((r() * 50) | 0) * 2);

    // 2–3 horizontal/slightly-diagonal worm fissures per cluster (4–10 px long)
    const fissures = 2 + ((r() * 2) | 0);
    for (let f = 0; f < fissures; f++) {
      let fx = cx + ((((r() * 9) | 0) - 4) * 2);
      let fy = cy + ((((r() * 9) | 0) - 4) * 2);
      const steps = 2 + ((r() * 3) | 0);
      const dirY = r() < 0.35 ? -2 : r() < 0.7 ? 2 : 0;
      const dark = shade(base, -0.20 - r() * 0.08);
      const lip = shadeRgba(base, 0.08, 0.55);
      for (let s = 0; s < steps; s++) {
        if (fx >= 10 && fx <= W - 10 && fy >= 10 && fy <= H - 10) {
          P(g, dark, fx, fy, 2, 2);
          if (s === 0 && fy > 12) P(g, lip, fx, fy - 2, 2, 2);
        }
        fx += 2;
        if (s === 1 && dirY !== 0) fy += dirY;
      }
    }

    // 3–5 clustered 2×2 pinholes around the fissures
    const pins = 3 + ((r() * 3) | 0);
    for (let p = 0; p < pins; p++) {
      const px = cx + ((((r() * 13) | 0) - 6) * 2);
      const py = cy + ((((r() * 13) | 0) - 6) * 2);
      if (px >= 10 && px <= W - 10 && py >= 10 && py <= H - 10) {
        P(g, shade(base, -0.24 - r() * 0.10), px, py, 2, 2);
      }
    }
  }

  // Sparse secondary 2×2 pinholes & subtle pale chalky fiber flecks
  for (let i = 0; i < 24; i++) {
    const px = 10 + (((r() * 54) | 0) * 2);
    const py = 10 + (((r() * 54) | 0) * 2);
    P(g, i % 3 === 0 ? shadeRgba(base, 0.07, 0.55) : shadeRgba(base, -0.20, 0.7), px, py, 2, 2);
  }
}

function drawCeilingTBar(g, W, H, color) {
  const base = color || '#d6d2c4';
  // Subtle inner tile recess bevel (top & left next to T-bar, bottom & right next to neighbouring T-bar)
  P(g, shadeRgba(base, -0.24, 0.78), 6, 6, W - 10, 2);
  P(g, shadeRgba(base, -0.24, 0.78), 6, 6, 2, H - 10);
  P(g, shadeRgba(base, -0.10, 0.45), 8, 8, W - 14, 2);
  P(g, shadeRgba(base, -0.10, 0.45), 8, 8, 2, H - 14);

  // Opposite-edge tile drop shadow & flange seat
  P(g, shadeRgba(base, -0.18, 0.70), 6, H - 4, W - 6, 2);
  P(g, shadeRgba(base, -0.18, 0.70), W - 4, 6, 2, H - 6);
  P(g, '#9a968b', 0, H - 2, W, 2);
  P(g, '#9a968b', W - 2, 0, 2, H);

  // Crisp beveled aluminum T-bar frame along top (y = 0..6) and left (x = 0..6)
  P(g, '#c5c2b6', 0, 0, W, 6);
  P(g, '#c5c2b6', 0, 0, 6, H);
  // Brushed metallic highlight strip
  P(g, '#e4e1d6', 2, 2, W - 2, 2);
  P(g, '#e4e1d6', 2, 2, 2, H - 2);
  // Subtle brushed aluminum grain ticks along the rail
  for (let k = 8; k < W - 4; k += 12) {
    P(g, '#b2afa3', k, 4, 6, 2);
    P(g, '#b2afa3', 4, k, 2, 6);
  }
  // Dark center T-bar recess groove
  P(g, '#434139', 0, 0, W, 2);
  P(g, '#434139', 0, 0, 2, H);
  // Clean corner miter intersection
  P(g, '#b8b5a9', 2, 2, 4, 4);
  P(g, '#434139', 0, 0, 2, 2);
}

/** One 0.6 m acoustic ceiling tile (128×128, RepeatWrapping): beveled aluminum T-bar + clustered mineral fissures. */
export function makeCeilingTexture(color = '#d6d2c4') {
  const base = color || '#d6d2c4';
  return makeTexture(128, 128, (g, W, H) => {
    drawCeilingTileBase(g, W, H, base);
    drawCeilingTBar(g, W, H, base);
  });
}

/** Single 0.6 m water-damaged ceiling tile (128×128, ClampToEdgeWrapping) with concentric yellowish-brown tide ring. */
export function makeWaterCeilingTileTexture(color = '#d6d2c4') {
  const base = color || '#d6d2c4';
  return makeTexture(128, 128, (g, W, H) => {
    drawCeilingTileBase(g, W, H, base);

    const seed = colorSeed(base, 43);
    // Concentric irregular voxel-stepped yellowish-brown water-damage tide ring (2×2 grid)
    const cx1 = 58, cy1 = 66, rx1 = 40, ry1 = 34;
    const cx2 = 78, cy2 = 54, rx2 = 24, ry2 = 22;

    for (let py = 6; py < H - 4; py += 2) {
      for (let px = 6; px < W - 4; px += 2) {
        const dx1 = (px - cx1) / rx1, dy1 = (py - cy1) / ry1;
        const a1 = Math.atan2(dy1, dx1);
        const w1 = 1 + 0.14 * Math.sin(a1 * 3 + 0.6) + 0.08 * Math.cos(a1 * 5 - 1.2) + 0.05 * Math.sin(a1 * 9 + 2.1);
        const d1 = Math.hypot(dx1, dy1) / w1;

        const dx2 = (px - cx2) / rx2, dy2 = (py - cy2) / ry2;
        const a2 = Math.atan2(dy2, dx2);
        const w2 = 1 + 0.12 * Math.cos(a2 * 4 + 1.1) + 0.06 * Math.sin(a2 * 7 - 0.5);
        const d2 = Math.hypot(dx2, dy2) / w2;

        const d = smin(d1, d2, 0.20);
        if (d >= 1.08) continue;

        const h = hash(px >> 1, py >> 1, seed & 0xffff);
        if (d < 0.28) {
          // Slightly darker damp leak center
          P(g, 'rgba(116,86,38,0.34)', px, py, 2, 2);
        } else if (d < 0.62) {
          // Yellowish-ochre damp interior
          P(g, 'rgba(154,122,58,0.26)', px, py, 2, 2);
        } else if (d < 0.80) {
          // Warm amber-brown mid wash
          P(g, 'rgba(148,108,46,0.38)', px, py, 2, 2);
        } else if (d < 0.90) {
          // Inner tide deposit band
          P(g, 'rgba(122,82,32,0.54)', px, py, 2, 2);
        } else if (d < 1.00) {
          // Crisp dark yellowish-brown outer tide rim
          P(g, 'rgba(92,58,22,0.72)', px, py, 2, 2);
        } else {
          // Subtle outer seepage halo
          P(g, 'rgba(166,136,76,0.22)', px, py, 2, 2);
        }

        // Occasional tiny mineral/mildew dark flecks along the inner tide band
        if (d > 0.72 && d < 0.96 && (h % 19) === 0) {
          P(g, 'rgba(70,46,18,0.52)', px, py, 2, 2);
        }
      }
    }

    // Re-draw T-bar on top so stain rests neatly on the recessed panel
    drawCeilingTBar(g, W, H, base);
  }, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
}

/* ---- 5. Rubber-Cove Skirting Baseboard (128×32, Repeat S / Clamp T) ------------- */

/**
 * Commercial rubber-cove baseboard (128×32, Repeat S / Clamp T):
 * beveled top lip highlight (y = 0..4), matte cove body with faint vertical scuff ticks,
 * and a dark mop-line grime band along the bottom ~20% (y = 26..32, floor contact).
 */
export function makeSkirtingTexture(trimHex = '#5a4632') {
  const trim = trimHex || '#5a4632';
  return makeTexture(128, 32, (g, W, H) => {
    const seed = colorSeed(trim, 51);
    const r = lcg(seed);

    // Matte cove body with subtle horizontal stepped rubber-profile shading
    P(g, trim, 0, 0, W, H);
    P(g, shade(trim, 0.05), 0, 4, W, 6);
    P(g, shade(trim, -0.05), 0, 18, W, 6);

    // Subtle beveled top lip highlight (top edge meets wall)
    P(g, shade(trim, -0.24), 0, 0, W, 2);
    P(g, shade(trim, 0.24), 0, 2, W, 2);
    P(g, shade(trim, 0.09), 0, 4, W, 2);

    // Subtle rubber-cove toe glint just above mop line
    P(g, shadeRgba(trim, 0.10, 0.34), 0, 23, W, 2);

    // Faint vertical scuff ticks & light vacuum/shoe rub marks along the cove body
    for (let i = 0; i < 28; i++) {
      const sx = ((r() * 64) | 0) * 2;
      const sy = 6 + (((r() * 8) | 0) * 2);
      const sh = 4 + (((r() * 4) | 0) * 2);
      const dark = i % 3 !== 0;
      P(g, shadeRgba(trim, dark ? -0.18 : 0.12, dark ? 0.36 : 0.24), sx, sy, 2, Math.min(sh, 24 - sy));
    }
    for (let i = 0; i < 8; i++) {
      const sx = ((r() * 60) | 0) * 2;
      const sy = 16 + (((r() * 4) | 0) * 2);
      const sw = 4 + (((r() * 4) | 0) * 2);
      P(g, shadeRgba(trim, -0.22, 0.34), sx, sy, sw, 2);
    }

    // Subtle vinyl strip butt-joint at x = 0
    P(g, shadeRgba(trim, -0.28, 0.55), 0, 2, 2, H - 2);
    P(g, shadeRgba(trim, 0.08, 0.25), 2, 2, 2, H - 2);

    // Dark mop-line grime band along the bottom 20% (y = 25..32)
    for (let x = 0; x < W; x += 4) {
      const h = hash(x >> 2, 13, seed & 0xffff);
      const bump = (h % 3) === 0 ? 1 : 0;
      P(g, shadeRgba(trim, -0.24, 0.55), x, 25 - bump, 4, 2 + bump);
    }
    P(g, shade(trim, -0.34), 0, 27, W, 3);
    P(g, shade(trim, -0.46), 0, 30, W, 2);
  }, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
}

/* ---- 6. 2×2 Stain Decal Atlas (256×256, ClampToEdge, 4×4 voxel-stepped) -------- */

/**
 * 256×256 transparent RGBA stain atlas (2×2 cells of 128×128 each on a 4×4 voxel grid):
 *   Cell 0 (top-left):     Organic damp carpet water patch
 *   Cell 1 (top-right):    Ceiling/floor tide-mark water ring
 *   Cell 2 (bottom-left):  Subtle doorway foot-traffic smudge
 *   Cell 3 (bottom-right): Shallow glossy puddle / splash silhouette
 */
export function makeStainAtlasTexture() {
  return makeTexture(256, 256, (g, W, H) => {
    g.clearRect(0, 0, W, H);

    // Cell 0 (0..128, 0..128): Organic damp carpet water patch (8 px transparent margin)
    for (let ly = 8; ly < 120; ly += 4) {
      for (let lx = 8; lx < 120; lx += 4) {
        const dx1 = (lx - 60) / 40, dy1 = (ly - 64) / 34;
        const a1 = Math.atan2(dy1, dx1);
        const w1 = 1 + 0.16 * Math.sin(a1 * 3 + 0.4) + 0.10 * Math.cos(a1 * 5 - 0.9);
        const d1 = Math.hypot(dx1, dy1) / w1;

        const dx2 = (lx - 84) / 22, dy2 = (ly - 52) / 20;
        const d2 = Math.hypot(dx2, dy2);

        const dx3 = (lx - 42) / 18, dy3 = (ly - 80) / 16;
        const d3 = Math.hypot(dx3, dy3);

        const d = smin(smin(d1, d2, 0.24), d3, 0.22);
        if (d >= 1.0) continue;

        const h = hash(lx >> 2, ly >> 2, 101);
        const jitter = (h % 5) === 0 ? -0.05 : 0;
        if (d < 0.48) {
          P(g, `rgba(34,30,18,${(0.68 + jitter).toFixed(3)})`, lx, ly, 4, 4);
        } else if (d < 0.80) {
          P(g, `rgba(48,42,26,${(0.46 + jitter).toFixed(3)})`, lx, ly, 4, 4);
        } else {
          P(g, 'rgba(62,54,34,0.22)', lx, ly, 4, 4);
        }
      }
    }

    // Cell 1 (128..256, 0..128): Ceiling/floor tide-mark water ring
    for (let ly = 8; ly < 120; ly += 4) {
      for (let lx = 8; lx < 120; lx += 4) {
        const dx1 = (lx - 62) / 42, dy1 = (ly - 64) / 38;
        const a1 = Math.atan2(dy1, dx1);
        const w1 = 1 + 0.13 * Math.sin(a1 * 3 - 0.5) + 0.08 * Math.cos(a1 * 6 + 1.3);
        const d1 = Math.hypot(dx1, dy1) / w1;

        const dx2 = (lx - 80) / 22, dy2 = (ly - 56) / 20;
        const d2 = Math.hypot(dx2, dy2);
        const d = smin(d1, d2, 0.18);
        if (d >= 1.06) continue;

        const gx = 128 + lx, gy = ly;
        if (d < 0.54) {
          P(g, 'rgba(136,100,44,0.13)', gx, gy, 4, 4);
        } else if (d < 0.76) {
          P(g, 'rgba(132,92,38,0.30)', gx, gy, 4, 4);
        } else if (d < 0.89) {
          P(g, 'rgba(112,72,26,0.56)', gx, gy, 4, 4);
        } else if (d < 1.00) {
          P(g, 'rgba(82,48,16,0.78)', gx, gy, 4, 4);
        } else {
          P(g, 'rgba(142,106,52,0.18)', gx, gy, 4, 4);
        }
      }
    }

    // Cell 2 (0..128, 128..256): Subtle doorway foot-traffic smudge
    for (let ly = 8; ly < 120; ly += 4) {
      for (let lx = 8; lx < 120; lx += 4) {
        const dx = (lx - 64) / 46;
        const dy = (ly - 64) / 24;
        const a = Math.atan2(dy, dx);
        const wobble = 1 + 0.11 * Math.cos(a * 2 + 0.3) + 0.07 * Math.sin(a * 5 - 0.7);
        const d = Math.hypot(dx, dy) / wobble;
        if (d >= 1.0) continue;

        const h = hash(lx >> 2, ly >> 2, 307);
        const gx = lx, gy = 128 + ly;
        if (d < 0.36) {
          P(g, (h & 3) ? 'rgba(28,25,20,0.46)' : 'rgba(22,20,16,0.54)', gx, gy, 4, 4);
        } else if (d < 0.70) {
          P(g, (h & 3) ? 'rgba(34,30,24,0.30)' : 'rgba(28,25,20,0.38)', gx, gy, 4, 4);
        } else if ((h % 3) !== 0) {
          P(g, 'rgba(42,38,30,0.16)', gx, gy, 4, 4);
        }
      }
    }

    // Cell 3 (128..256, 128..256): Shallow glossy puddle / splash shape
    for (let ly = 8; ly < 120; ly += 4) {
      for (let lx = 8; lx < 120; lx += 4) {
        // Kidney / teardrop silhouette
        const dx1 = (lx - 58) / 36, dy1 = (ly - 68) / 28;
        const a1 = Math.atan2(dy1, dx1);
        const w1 = 1 + 0.14 * Math.sin(a1 * 2 - 0.8) + 0.08 * Math.cos(a1 * 4 + 0.5);
        const d1 = Math.hypot(dx1, dy1) / w1;

        const dx2 = (lx - 82) / 22, dy2 = (ly - 48) / 22;
        const d2 = Math.hypot(dx2, dy2);

        const d = smin(d1, d2, 0.24);
        if (d >= 0.98) continue;

        const gx = 128 + lx, gy = 128 + ly;
        if (d < 0.45) {
          P(g, 'rgba(18,24,24,0.74)', gx, gy, 4, 4);
        } else if (d < 0.84) {
          P(g, 'rgba(26,32,30,0.62)', gx, gy, 4, 4);
        } else {
          // Subtle bright wet meniscus rim (stronger on upper-left catch-light edge)
          const catchLight = (lx - 64) + (ly - 64) < 12;
          P(g, catchLight ? 'rgba(206,216,202,0.48)' : 'rgba(136,148,140,0.30)', gx, gy, 4, 4);
        }
      }
    }
    // Subtle surface specular glint + 3 satellite splash droplets in Cell 3
    P(g, 'rgba(226,234,220,0.34)', 128 + 44, 128 + 52, 12, 4);
    P(g, 'rgba(226,234,220,0.26)', 128 + 40, 128 + 56, 8, 4);
    for (const [sx, sy] of [[24, 32], [100, 88], [96, 28]]) {
      P(g, 'rgba(26,32,30,0.60)', 128 + sx, 128 + sy, 8, 8);
      P(g, 'rgba(206,216,202,0.42)', 128 + sx, 128 + sy, 4, 4);
    }
  }, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
}

/* ---- 7. Peeling Wallpaper Seam Decal (64×128, ClampToEdge) ---------------------- */

/**
 * 64×128 transparent RGBA vertical peeling wallpaper seam: curled strip of the room's
 * wallpaper + motif peeling slightly off the left seam, revealing pale grey-beige
 * drywall/paste backing and a dark fold crevice shadow.
 */
export function makePeelTexture(look = {}) {
  const wall = look?.wall || '#d5c879';
  const ink = look?.ink || shade(wall, -0.18);
  const pale = look?.pale || shade(wall, 0.12);
  const pattern = look?.pattern;

  return makeTexture(64, 128, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const seed = colorSeed(wall, 67);

    // Subtle vertical glued seam anchor line along left edge
    P(g, 'rgba(42,36,26,0.42)', 4, 4, 2, H - 8);

    const yStart = 8, yEnd = 120;
    for (let y = yStart; y < yEnd; y += 4) {
      const t = (y - yStart) / (yEnd - yStart);
      const arch = Math.pow(Math.sin(t * Math.PI), 0.76);
      const ripple = 0.88 + 0.12 * Math.sin(t * Math.PI * 3 + 0.5);
      const span = arch * ripple;

      // Exposed pale grey-beige drywall/paste sliver on the left
      const backW = Math.max(2, Math.round((span * 18) / 2) * 2);
      // Curled wallpaper strip to the right of the fold
      const curlW = Math.max(4, Math.round((span * 16) / 2) * 2);
      const foldX = 6 + backW;

      // Drywall & dried paste backing
      for (let bx = 6; bx < foldX; bx += 2) {
        const h = hash(bx >> 1, y >> 2, seed & 0xffff);
        const nearSeam = bx < 10;
        const c = nearSeam
          ? ((h % 3) ? '#c7be9f' : '#beb494')
          : ((h % 4) === 0 ? '#dbd5c8' : (h % 4) === 1 ? '#c2bab0' : '#cfc8bc');
        P(g, c, bx, y, 2, 4);
      }

      // Soft cast shadow on drywall under the curling lip
      const shW = Math.min(backW, 4);
      P(g, 'rgba(38,32,24,0.44)', foldX - shW, y, shW, 4);

      // Thin dark crevice shadow right along the fold
      P(g, 'rgba(30,24,18,0.80)', foldX, y, 2, 4);

      // Curled paper underside/lip highlight (catches grazing light along the ridge)
      P(g, shade(pale, 0.16), foldX + 2, y, 4, 4);

      // Curled wallpaper face in the room's wall colour + subtle cylindrical shading
      const faceX = foldX + 6;
      const faceW = Math.max(2, curlW - 4);
      P(g, shade(wall, 0.05), faceX, y, Math.min(4, faceW), 4);
      if (faceW > 4) P(g, wall, faceX + 4, y, faceW - 4, 4);

      // Hint of the room's wallpaper motif on the curled strip
      const rowIdx = (y >> 2);
      const hasMotif =
        pattern === 'stripes' ? true :
        pattern === 'dots' ? (rowIdx % 4 === 1) :
        pattern === 'diamonds' || pattern === 'sprigs' ? (rowIdx % 6 === 2 || rowIdx % 6 === 3) :
        pattern === 'trellis' ? ((rowIdx % 4) === 0 || (rowIdx % 4) === 2) :
        (rowIdx % 3 === 1); // chevrons / default
      if (hasMotif && faceW >= 4) {
        const mx = faceX + (pattern === 'stripes' ? 2 : ((rowIdx % 2) * 2) % Math.max(2, faceW - 2));
        P(g, ink, mx, y, Math.min(4, faceX + faceW - mx), 4);
      }

      // Soft right-side transition shadow back onto flat wall
      if (faceX + faceW < W - 2) {
        P(g, 'rgba(34,28,18,0.22)', faceX + faceW, y, 4, 4);
      }
    }
  }, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
}

/* ---- 8. Glossy Shallow Puddle Mask (128×128, ClampToEdge) ----------------------- */

/**
 * 128×128 transparent RGBA shallow puddle mask on a 4×4 voxel grid:
 * semi-translucent dark damp tint in the center with a feathered alpha edge,
 * built to pair with `kit.surface({ map, wet: 1, alpha: 0.72 })` for fluorescent
 * and flashlight specular glints.
 */
export function makePuddleMaskTexture() {
  return makeTexture(128, 128, (g, W, H) => {
    g.clearRect(0, 0, W, H);

    // 4×4 voxel-stepped organic multi-lobe puddle silhouette (8 px transparent border)
    for (let py = 8; py < H - 8; py += 4) {
      for (let px = 8; px < W - 8; px += 4) {
        const dx1 = (px - 58) / 38, dy1 = (py - 66) / 30;
        const a1 = Math.atan2(dy1, dx1);
        const w1 = 1 + 0.14 * Math.sin(a1 * 3 + 0.9) + 0.08 * Math.cos(a1 * 5 - 0.6);
        const d1 = Math.hypot(dx1, dy1) / w1;

        const dx2 = (px - 80) / 22, dy2 = (py - 50) / 20;
        const d2 = Math.hypot(dx2, dy2);

        const dx3 = (px - 36) / 18, dy3 = (py - 76) / 15;
        const d3 = Math.hypot(dx3, dy3);

        const d = smin(smin(d1, d2, 0.24), d3, 0.22);
        if (d >= 1.0) continue;

        const h = hash(px >> 2, py >> 2, 419);
        if (d < 0.46) {
          // Deep wet core
          P(g, (h & 3) ? 'rgba(24,28,24,0.80)' : 'rgba(18,22,20,0.84)', px, py, 4, 4);
        } else if (d < 0.76) {
          // Shallow translucent damp body
          P(g, 'rgba(34,38,32,0.62)', px, py, 4, 4);
        } else if (d < 0.90) {
          // Meniscus rim with subtle upper-left catch-light tint
          const rimBright = (px - 60) + (py - 64) < 8;
          P(g, rimBright ? 'rgba(148,158,144,0.38)' : 'rgba(48,52,44,0.40)', px, py, 4, 4);
        } else {
          // Feathered damp alpha edge
          P(g, 'rgba(54,52,40,0.18)', px, py, 4, 4);
        }
      }
    }

    // Two tiny detached 4×4 splash droplets near the puddle perimeter
    P(g, 'rgba(34,38,32,0.52)', 96, 84, 4, 4);
    P(g, 'rgba(34,38,32,0.44)', 24, 44, 4, 4);
  }, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
}
