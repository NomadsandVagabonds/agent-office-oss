// The Backrooms — restrained, uncanny "lived-in" Floor 1 Yellow Office wear & micro-architecture.
// Subtle doorway foot-traffic smudges, organic damp carpet stains, rare peeling wallpaper seams,
// low baseboard wicking / drip streaks, shallow glossy floor puddles with live animated ceiling drips
// & expanding ripples, and quiet office hardware (wall light switches, ceiling HVAC diffuser grates,
// sprinkler rosettes, and rare slightly-ajar drop-ceiling tiles).
//
// Guarantees:
// - ~90% eerie intact yellow office, ~10% subtle damp wear (never post-apocalyptic).
// - 100% deterministic via a forked local RNG — NEVER consumes c.R, c.spot, c.wallSpot, or c.corner.
// - Full WebGL + WebGPU parity via kit.surface / standard Three.js MeshBasicMaterial only.
import * as THREE from 'three';
import { Vox, M, tone, noise3 } from '../vox/vox.js';
import { Batch, WHITE } from './kit.js';
import { TILE, makeRng, ceilAt, floorAt, fitsAt } from './gen.js';
import { WALLFIT, switchVox } from './wallfit.model.js';

export const OFFICE_WEAR_LIMITS = Object.freeze({
  minRoomSpan: 2.2,
  maxDoorWear: 2,
  stainChance: 0.45,
  maxCarpetStains: 2,
  peelChance: 0.28,
  maxPeels: 1,
  largeRoomArea: 30,
  largeRoomMaxPeels: 2,
  dampBandChance: 0.30,
  maxDampBands: 2,
  leakChance: 0.22,
  maxLeaks: 1,
  switchChance: 0.55,
  ventChance: 0.45,
  sprinklerChance: 0.35,
  maxSprinklers: 2,
  ajarTileChance: 0.14,
  maxAjarTiles: 1,
  dripSoundRange: 7.5,
});

const HALF_VOX = 0.0125; // half-size voxel (matches CEILING.voxel)
const DRIP_GRAVITY = 9.4;
const DRIP_FORM_SEC = 0.45;
const RIPPLE_DUR_SEC = 0.65;
const RIPPLE_BASE_OPACITY = 0.55;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const P = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

const lcg = (seed) => {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const hexSeed = (str, salt = 0) => {
  let h = (2166136261 ^ salt) >>> 0;
  for (const ch of String(str || '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h || 1;
};

/* ---- self-contained fallback canvas textures (seamless upgrade via kit.tex.*) ---- */

function fallbackWaterTile(kit, ceilColor = '#d6d0bc') {
  return kit.tex.custom('office-wear:watertile:' + ceilColor, 48, 48, (g, w, h) => {
    const r = lcg(hexSeed(ceilColor, 17));
    // Base acoustic ceiling tile matching kit.tex.ceiling
    P(g, ceilColor, 0, 0, w, h);
    for (let i = 0; i < 68; i++) {
      P(g, i % 3 ? 'rgba(62,56,42,0.16)' : 'rgba(255,250,234,0.14)', 2 + ((r() * (w - 4)) | 0), 2 + ((r() * (h - 4)) | 0), 1, 1);
    }
    // Restrained off-center ochre/umber water stain + tide mark ring
    const cx = 25, cy = 23;
    const grad = g.createRadialGradient(cx, cy, 2, cx, cy, 19);
    grad.addColorStop(0, 'rgba(112, 86, 44, 0.52)');
    grad.addColorStop(0.55, 'rgba(132, 102, 52, 0.34)');
    grad.addColorStop(0.84, 'rgba(98, 72, 34, 0.44)');
    grad.addColorStop(1, 'rgba(98, 72, 34, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(cx, cy, 18, 15, 0.35, 0, Math.PI * 2);
    g.fill();
    // Subtle secondary damp lobe
    g.fillStyle = 'rgba(104, 78, 38, 0.28)';
    g.beginPath();
    g.ellipse(cx - 6, cy + 5, 10, 7, -0.4, 0, Math.PI * 2);
    g.fill();
    // Irregular mineral tide-edge flecks
    for (let i = 0; i < 42; i++) {
      const a = (i / 42) * Math.PI * 2;
      const rad = 13.5 + Math.sin(a * 3) * 2.2 + Math.cos(a * 5) * 1.4;
      P(g, 'rgba(84, 62, 28, 0.36)', Math.round(cx + Math.cos(a) * rad * 1.1), Math.round(cy + Math.sin(a) * rad * 0.9), 2, 1);
    }
    // T-bar bevel & dark grid border
    P(g, 'rgba(255,252,240,0.2)', 2, 2, w - 2, 1);
    P(g, 'rgba(42,38,28,0.2)', 2, h - 1, w - 2, 1);
    P(g, '#39362c', 0, 0, w, 2);
    P(g, '#39362c', 0, 0, 2, h);
  }, { clamp: true });
}

function fallbackPuddle(kit) {
  return kit.tex.custom('office-wear:puddle:v1', 64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = lcg(9187);
    // Crisp organic multi-lobe silhouette (solid alpha >= 0.9 inside so CUTOUT trims cleanly)
    const lobes = [
      [32, 32, 22, 17, 0.2],
      [21, 35, 14, 11, -0.35],
      [44, 29, 13, 10, 0.45],
      [34, 43, 12, 8, 0.1],
      [26, 22, 11, 8, -0.2],
    ];
    // Subtle dark wet meniscus border
    g.fillStyle = '#363427';
    for (const [cx, cy, rx, ry, rot] of lobes) {
      g.beginPath(); g.ellipse(cx, cy, rx + 1.5, ry + 1.5, rot, 0, Math.PI * 2); g.fill();
    }
    // Translucent-looking dark wet body (surface alpha 0.72 lets damp carpet show through)
    g.fillStyle = '#4e4d3d';
    for (const [cx, cy, rx, ry, rot] of lobes) {
      g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); g.fill();
    }
    // Softer pale ceiling-sheen interior reflection
    g.fillStyle = '#6f715f';
    g.beginPath(); g.ellipse(31, 30, 14, 10, 0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#868976';
    g.beginPath(); g.ellipse(29, 28, 7, 4.5, 0.15, 0, Math.PI * 2); g.fill();
    // Subtle pixel-stepped micro-ripples inside the puddle
    for (let i = 0; i < 24; i++) {
      const px = 16 + ((r() * 32) | 0), py = 20 + ((r() * 24) | 0);
      P(g, i % 2 ? 'rgba(180,186,162,0.28)' : 'rgba(34,34,26,0.25)', px, py, 2 + ((r() * 3) | 0), 1);
    }
  }, { clamp: true });
}

function fallbackPeel(kit, look) {
  const wallHex = look?.wall || '#d9c676';
  return kit.tex.custom('office-wear:peel:' + wallHex, 32, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = lcg(hexSeed(wallHex, 31));
    // Irregular vertical torn-paper backing (exposed yellowed adhesive & pale plaster)
    for (let y = 3; y < h - 3; y++) {
      const t = (y - 3) / (h - 6);
      const env = Math.sin(t * Math.PI);
      const half = Math.max(2, Math.round((3 + 7.5 * env) + Math.sin(y * 0.37) * 1.6 + Math.cos(y * 0.71) * 0.9));
      const x0 = Math.max(2, 16 - half);
      const span = Math.min(w - 4 - x0, half * 2);
      P(g, '#b8ae92', x0, y, span, 1);
      // Exposed dusty plaster center
      if (span > 4) P(g, '#ccc4ab', x0 + 2, y, span - 4, 1);
      // Thin dark adhesive seam down the middle & dark underside shadow on right edge
      P(g, '#7c7157', 15, y, 1, 1);
      P(g, '#4f4634', x0 + span - 2, y, 2, 1);
      // Subtle dried paste speckles
      if (r() > 0.65 && span > 3) P(g, '#968a6d', x0 + 1 + ((r() * (span - 2)) | 0), y, 1, 2);
    }
  }, { clamp: true });
}

function fallbackStainAtlas(kit) {
  const tex = kit.tex.custom('office-wear:stain-atlas:v2', 128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    const r = lcg(4201);

    // Cell 0 (top-left: 0,0..64,64): organic damp carpet water patch
    {
      const cx = 32, cy = 32;
      const g0 = g.createRadialGradient(cx, cy, 2, cx, cy, 26);
      g0.addColorStop(0, 'rgba(42, 34, 20, 0.72)');
      g0.addColorStop(0.55, 'rgba(54, 44, 26, 0.45)');
      g0.addColorStop(0.82, 'rgba(46, 36, 20, 0.34)');
      g0.addColorStop(1, 'rgba(46, 36, 20, 0)');
      g.fillStyle = g0;
      g.beginPath(); g.ellipse(cx, cy, 24, 19, 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(48, 38, 22, 0.28)';
      g.beginPath(); g.ellipse(cx - 9, cy + 7, 13, 10, -0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(cx + 10, cy - 6, 11, 8, 0.4, 0, Math.PI * 2); g.fill();
    }

    // Cell 1 (top-right: 64,0..128,64): organic tide-mark water ring
    {
      const cx = 96, cy = 32;
      const g1 = g.createRadialGradient(cx, cy, 8, cx, cy, 25);
      g1.addColorStop(0, 'rgba(58, 46, 24, 0.24)');
      g1.addColorStop(0.65, 'rgba(54, 42, 22, 0.56)');
      g1.addColorStop(0.86, 'rgba(42, 32, 16, 0.48)');
      g1.addColorStop(1, 'rgba(42, 32, 16, 0)');
      g.fillStyle = g1;
      g.beginPath(); g.ellipse(cx, cy, 23, 19, -0.25, 0, Math.PI * 2); g.fill();
    }

    // Cell 2 (bottom-left: 0,64..64,128): doorway foot-traffic scuff smudge
    {
      const cx = 32, cy = 96;
      const g2 = g.createRadialGradient(cx, cy, 3, cx, cy, 26);
      g2.addColorStop(0, 'rgba(34, 30, 22, 0.65)');
      g2.addColorStop(0.6, 'rgba(44, 38, 28, 0.36)');
      g2.addColorStop(1, 'rgba(44, 38, 28, 0)');
      g.fillStyle = g2;
      g.beginPath(); g.ellipse(cx, cy, 25, 16, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 28; i++) {
        const px = 12 + ((r() * 40) | 0), py = 84 + ((r() * 24) | 0);
        P(g, 'rgba(26, 22, 16, 0.22)', px, py, 2 + ((r() * 4) | 0), 1 + ((r() * 2) | 0));
      }
    }

    // Cell 3 (bottom-right: 64,64..128,128): shallow damp splash stain
    {
      const cx = 96, cy = 96;
      const g3 = g.createRadialGradient(cx, cy, 2, cx, cy, 24);
      g3.addColorStop(0, 'rgba(38, 34, 24, 0.64)');
      g3.addColorStop(0.6, 'rgba(48, 42, 28, 0.35)');
      g3.addColorStop(1, 'rgba(48, 42, 28, 0)');
      g.fillStyle = g3;
      g.beginPath(); g.ellipse(cx, cy, 20, 16, 0.2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(cx + 12, cy - 8, 7, 5, -0.3, 0, Math.PI * 2); g.fill();
    }
  }, { clamp: true });
  tex.magFilter = THREE.LinearFilter;
  return {
    texture: tex,
    count: 4,
    uv(i) {
      const k = ((i % 4) + 4) % 4;
      const u0 = (k % 2) * 0.5, u1 = u0 + 0.5;
      const v1 = 1 - Math.floor(k / 2) * 0.5, v0 = v1 - 0.5;
      return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    },
  };
}

function fallbackWallDampAtlas(kit) {
  const tex = kit.tex.custom('office-wear:wall-damp:v1', 128, 64, (g) => {
    g.clearRect(0, 0, 128, 64);

    // Cell 0 (left: 0..64, 0..64): baseboard damp wicking band (heaviest at canvas bottom = v0)
    {
      const g0 = g.createLinearGradient(0, 64, 0, 8);
      g0.addColorStop(0, 'rgba(46, 38, 24, 0.72)');
      g0.addColorStop(0.42, 'rgba(56, 46, 28, 0.42)');
      g0.addColorStop(0.78, 'rgba(62, 50, 30, 0.16)');
      g0.addColorStop(1, 'rgba(62, 50, 30, 0)');
      g.fillStyle = g0;
      for (let x = 2; x < 62; x += 2) {
        const edgeFade = Math.sin(((x - 2) / 60) * Math.PI);
        const hgt = Math.round((16 + 26 * edgeFade) + Math.sin(x * 0.23) * 5 + Math.cos(x * 0.41) * 3);
        g.fillRect(x, 64 - hgt, 2, hgt);
      }
      for (let x = 6; x < 58; x += 3) {
        const edgeFade = Math.sin(((x - 2) / 60) * Math.PI);
        const hgt = Math.round((16 + 26 * edgeFade) + Math.sin(x * 0.23) * 5);
        P(g, 'rgba(72, 58, 34, 0.24)', x, 64 - hgt, 2, 2);
      }
    }

    // Cell 1 (right: 64..128, 0..64): faint vertical wall drip streak (top = v1 -> bottom = v0)
    {
      const g1 = g.createLinearGradient(0, 4, 0, 60);
      g1.addColorStop(0, 'rgba(54, 44, 24, 0.48)');
      g1.addColorStop(0.65, 'rgba(54, 44, 24, 0.34)');
      g1.addColorStop(0.92, 'rgba(48, 38, 22, 0.42)');
      g1.addColorStop(1, 'rgba(48, 38, 22, 0)');
      g.fillStyle = g1;
      for (let y = 4; y < 58; y++) {
        const drift = Math.sin(y * 0.17) * 1.4;
        const sw = y > 50 ? 4 : 2;
        g.fillRect(Math.round(94 + drift), y, sw, 1);
        if (y < 44 && y % 2 === 0) g.fillRect(Math.round(101 - drift * 0.7), y + 2, 1, 1);
      }
      g.fillStyle = 'rgba(48, 38, 22, 0.32)';
      g.beginPath(); g.ellipse(95, 54, 4.5, 4, 0, 0, Math.PI * 2); g.fill();
    }
  }, { clamp: true });
  tex.magFilter = THREE.LinearFilter;
  return {
    texture: tex,
    count: 2,
    uv(i) {
      const k = i & 1;
      const u0 = k * 0.5, u1 = u0 + 0.5;
      return [[u0, 0], [u1, 0], [u1, 1], [u0, 1]];
    },
  };
}

function resolveStainAtlas(kit) {
  const ext = kit.tex.stainAtlas?.();
  if (ext) {
    if (ext.texture && typeof ext.uv === 'function') return ext;
    if (ext.isTexture) {
      return {
        texture: ext,
        count: 4,
        uv(i) {
          const k = ((i % 4) + 4) % 4;
          const u0 = (k % 2) * 0.5, u1 = u0 + 0.5;
          const v1 = 1 - Math.floor(k / 2) * 0.5, v0 = v1 - 0.5;
          return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
        },
      };
    }
  }
  return fallbackStainAtlas(kit);
}

/* ---- sculpted voxel micro-models (cached via kit.model) ---- */

const voxBox = (v) => (x0, y0, z0, x1, y1, z1, c) => v.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c);

/**
 * Flush-mounted ceiling HVAC air diffuser grate (0.55 x 0.55 m, hanging 1.25–2.5 cm below ceilY).
 * Half-size voxels (0.0125 m). Built strictly at y = -2..-1 so it reads cleanly under a solid ceiling sheet.
 */
function diffuserVox() {
  const v = new Vox(), B = voxBox(v), S = 22;
  const frame = M('#d4d1c7', 0), slat = M('#b8b6ad', 0), shade = M('#97968e', 0);
  const plenum = M('#151718', 0), screw = M('#868884', 0), dust = M('#827d70', 1);
  // Dark recessed plenum backing just below ceiling plane
  B(-S + 2, -1, -S + 2, S - 3, -1, S - 3, plenum);
  // Outer flanged metal frame
  B(-S, -2, -S, S - 1, -1, -S + 1, frame);
  B(-S, -2, S - 2, S - 1, -1, S - 1, frame);
  B(-S, -2, -S, -S + 1, -1, S - 1, frame);
  B(S - 2, -2, -S, S - 1, -1, S - 1, frame);
  // Parallel slotted louver slats
  for (let z = -S + 4; z <= S - 5; z += 4) {
    B(-S + 2, -2, z, S - 3, -2, z, slat);
    B(-S + 2, -2, z + 1, S - 3, -2, z + 1, shade);
  }
  // Central stiffener bar & corner screws
  B(-1, -2, -S + 2, 0, -2, S - 3, frame);
  for (const [sx, sz] of [[-S + 1, -S + 1], [S - 2, -S + 1], [-S + 1, S - 2], [S - 2, S - 2]]) {
    v.set(sx, -2, sz, screw);
  }
  // Subtle dust patina on two edges
  for (let x = -S + 2; x < S - 2; x += 2) {
    if (noise3(x, 3, 1, 7) > 0.68) v.set(x, -2, -S + 1, dust);
    if (noise3(x, 5, 2, 7) > 0.72) v.set(x, -2, S - 2, dust);
  }
  return v;
}

/**
 * Tiny ceiling fire-sprinkler rosette (quarter-size voxels: 0.00625 m, ~5 cm across, ~3 cm drop).
 */
function sprinklerVox() {
  const v = new Vox(), B = voxBox(v);
  const chrome = M('#c9cbc6', 0), ring = M('#aeb1ac', 0), brass = M('#b59449', 0), bulb = M('#b83c32', 0);
  // Escutcheon collar flush under ceiling
  B(-3, -1, -2, 2, -1, 1, chrome);
  B(-2, -1, -3, 1, -1, 2, chrome);
  B(-2, -2, -2, 1, -2, 1, ring);
  // Brass stem & deflector arms
  B(-1, -4, -1, 0, -3, 0, brass);
  v.set(0, -4, 0, bulb);
  // Deflector rosette disc
  B(-2, -5, -1, 1, -5, 0, brass);
  B(-1, -5, -2, 0, -5, 1, brass);
  return v;
}

/**
 * Thin acoustic ceiling tile slab for a slightly-ajar / shifted drop-ceiling tile (0.575 x 0.0125 x 0.575 m).
 */
function ajarTileVox(ceilHex = '#d6d0bc') {
  const v = new Vox(), B = voxBox(v), S = 23;
  const face = M(ceilHex, 1), bevel = M(tone(ceilHex, -0.14), 1), speck = M(tone(ceilHex, -0.22), 0);
  B(-S, -1, -S, S - 1, -1, S - 1, face);
  // Darker exposed cut edge along perimeter
  B(-S, -1, -S, S - 1, -1, -S, bevel);
  B(-S, -1, S - 1, S - 1, -1, S - 1, bevel);
  B(-S, -1, -S, -S, -1, S - 1, bevel);
  B(S - 1, -1, -S, S - 1, -1, S - 1, bevel);
  // Sparse acoustic pinholes
  for (let x = -S + 3; x < S - 3; x += 5) {
    for (let z = -S + 3; z < S - 3; z += 5) {
      if (noise3(x, 1, z, 11) > 0.62) v.set(x, -1, z, speck);
    }
  }
  return v;
}

/**
 * Thin 3D curled wallpaper flap standing 1–3 cm proud of the wall along a peeling vertical seam.
 * Quarter-size voxels (0.00625 m): x along wall, y up, z out of wall (0 = wall face).
 */
function peelFlapVox(wallHex = '#d9c676', inkHex = '#b59d52', curlDir = 1) {
  const v = new Vox();
  const front = M(wallHex, 1), back = M(tone(wallHex, 0.12), 0), edge = M(inkHex, 0);
  const hh = 26; // ~32 cm tall curled tongue
  for (let y = -hh; y <= hh; y++) {
    const t = (y + hh) / (2 * hh); // 0 bottom .. 1 top
    const bow = Math.sin(t * Math.PI);
    const width = Math.max(2, Math.round(3 + 8 * bow));
    for (let k = 0; k < width; k++) {
      const u = k / Math.max(1, width - 1);
      // Curves smoothly outward from z=1 at the attached seam up to z=4 (~2.5 cm) at the curled lip
      const z = 1 + Math.round(u * u * (2.2 + 1.6 * bow));
      const x = curlDir * (1 + k);
      const col = k === width - 1 ? edge : (u > 0.65 ? back : front);
      v.set(x, y, z, col);
    }
  }
  return v;
}

/* ---- pure local placement helpers (NEVER consume c.R or mutate reserved/kept) ---- */

function snapTileCoord(v, halfSpan) {
  let t = (Math.floor(v / TILE) + 0.5) * TILE;
  if (t + TILE / 2 > halfSpan - 0.02) t -= TILE;
  if (t - TILE / 2 < -halfSpan + 0.02) t += TILE;
  return t;
}

function tileOverlapsPanel(room, tx, tz) {
  for (const p of room.panels || []) {
    if (Math.abs(tx - p.x) < TILE - 0.02 && Math.abs(tz - p.z) < TILE * 1.5 - 0.02) return true;
  }
  return false;
}

function tileOverlapsPillar(room, tx, tz, cy) {
  for (const q of room.pillars || []) {
    if ((q.y0 || 0) >= cy - 0.05) continue;
    if (q.h !== undefined && q.h < cy - 0.12) continue;
    if (Math.abs(tx - q.x) < q.w / 2 + TILE / 2 + 0.02 && Math.abs(tz - q.z) < q.d / 2 + TILE / 2 + 0.02) return true;
  }
  return false;
}

function isTileFlatAndValid(room, tx, tz, minCeil = 2.05) {
  const half = TILE / 2 - 0.02;
  if (Math.abs(tx) + TILE / 2 > room.W / 2 - 0.05 || Math.abs(tz) + TILE / 2 > room.D / 2 - 0.05) return false;
  if (room.kind === 'start' && Math.abs(tx) < TILE * 1.15 && Math.abs(tz) < TILE * 1.15) return false;
  const cy = ceilAt(room, tx, tz);
  if (cy < minCeil) return false;
  for (const [dx, dz] of [[-half, -half], [half, -half], [-half, half], [half, half]]) {
    if (Math.abs(ceilAt(room, tx + dx, tz + dz) - cy) > 0.006) return false;
    if (!fitsAt(room, tx + dx, tz + dz, 0.05)) return false;
  }
  if (tileOverlapsPillar(room, tx, tz, cy)) return false;
  return true;
}

function tileKey(tx, tz) {
  return `${tx.toFixed(2)},${tz.toFixed(2)}`;
}

function collectFreeCeilingTiles(room, holeTiles = null) {
  const out = [];
  const ix0 = Math.floor((-room.W / 2 + 0.06) / TILE);
  const ix1 = Math.ceil((room.W / 2 - 0.06) / TILE);
  const iz0 = Math.floor((-room.D / 2 + 0.06) / TILE);
  const iz1 = Math.ceil((room.D / 2 - 0.06) / TILE);
  for (let ix = ix0; ix < ix1; ix++) {
    for (let iz = iz0; iz < iz1; iz++) {
      const tx = (ix + 0.5) * TILE, tz = (iz + 0.5) * TILE;
      if (!isTileFlatAndValid(room, tx, tz)) continue;
      if (tileOverlapsPanel(room, tx, tz)) continue;
      if (holeTiles?.has(tileKey(tx, tz))) continue;
      out.push({ tx, tz, key: `${ix},${iz}`, ceilY: ceilAt(room, tx, tz) });
    }
  }
  return out;
}

function pickClearSpot(c, rng, r = 0.45, opt = {}) {
  const { W, D, room } = c;
  const pad = opt.pad ?? 0.2, head = opt.head ?? 0, tries = opt.tries ?? 36, used = opt.used || [];
  const loX = -W / 2 + r + pad, hiX = W / 2 - r - pad;
  const loZ = -D / 2 + r + pad, hiZ = D / 2 - r - pad;
  if (loX >= hiX || loZ >= hiZ) return null;
  for (let i = 0; i < tries; i++) {
    const x = rng.range(loX, hiX), z = rng.range(loZ, hiZ);
    if (!c.clear(x, z, r, head)) continue;
    if (used.some(([ux, uz, ur]) => Math.hypot(x - ux, z - uz) < r + ur)) continue;
    if (opt.flatCeil || opt.avoidPanels) {
      const tx = snapTileCoord(x, W / 2), tz = snapTileCoord(z, D / 2);
      if (opt.flatCeil && !isTileFlatAndValid(room, tx, tz, head || 2.0)) continue;
      if (opt.avoidPanels && tileOverlapsPanel(room, tx, tz)) continue;
      if (c.rt?.holeTiles?.has(tileKey(tx, tz))) continue;
    }
    return { x, z };
  }
  return null;
}

function subtractWallSpans(spans, side, usedWall) {
  const out = [];
  for (let [a, b] of spans) {
    for (const [s, u0, u1] of usedWall) {
      if (s !== side || u1 <= a || u0 >= b) continue;
      if (u0 - a > 0.05) out.push([a, u0]);
      a = Math.max(a, u1);
    }
    if (b - a > 0.05) out.push([a, b]);
  }
  return out;
}

function pickWallSpot(c, rng, need, opt = {}) {
  const sides = opt.sides || ['back', 'left', 'right', 'front'];
  const margin = opt.margin ?? 0.45, minTop = opt.minTop ?? 1.8, usedWall = opt.usedWall || [];
  const options = [];
  for (const side of sides) {
    const spans = subtractWallSpans(c.spans(side, margin, minTop), side, usedWall);
    for (const [a, b] of spans) {
      if (b - a >= need) options.push({ side, a, b });
    }
  }
  if (!options.length) return null;
  const tries = Math.min(12, options.length * 3);
  for (let i = 0; i < tries; i++) {
    const o = rng.pick(options);
    const at = rng.range(o.a + need / 2, o.b - need / 2);
    if (opt.openFront) {
      const p = c.wallAt(o.side, at, 0.36);
      if (!c.clear(p.x, p.z, 0.28)) continue;
    }
    return { side: o.side, at };
  }
  if (!opt.openFront) {
    const o = rng.pick(options);
    return { side: o.side, at: rng.range(o.a + need / 2, o.b - need / 2) };
  }
  return null;
}

function placeWallFitVox(c, geo, side, at, y, scale = WALLFIT.voxel, off = 0, batch = null) {
  if (!geo?.solid) return null;
  const p = c.wallAt(side, at, off);
  const m = new THREE.Matrix4().set(
    p.U[0] * scale, 0, p.n[0] * scale, p.x,
    0, scale, 0, y,
    p.U[2] * scale, 0, p.n[2] * scale, p.z,
    0, 0, 0, 1,
  );
  (batch || c.vox).addVox(geo.solid, m);
  return p;
}

function placeCeilVox(c, geo, x, y, z, { scale = HALF_VOX, rot = 0, tiltX = 0, tiltZ = 0, batch = null } = {}) {
  if (!geo?.solid) return;
  const eul = new THREE.Euler(tiltX, rot, tiltZ, 'YXZ');
  const q = new THREE.Quaternion().setFromEuler(eul);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    q,
    new THREE.Vector3(scale, scale, scale),
  );
  (batch || c.vox).addVox(geo.solid, m);
}

function attachToRoom(c, obj) {
  // Flat surface wear & tiny droplets never cast flashlight beam shadows
  if (obj?.userData) obj.userData.noBeamShadow = true;
  if (c.rt?.group) c.rt.group.add(obj);
  else if (typeof c.add === 'function') c.add(obj);
}

function scheduleAfter(c, fn) {
  if (Array.isArray(c.after)) c.after.push(fn);
  else fn();
}

function wearCache(kit) {
  return (kit._wearCache ||= {});
}

function roomLightScale(rt) {
  const dim = rt?.u?.dim?.value ?? 1;
  const levels = rt?.lightLevels;
  let bank = 1;
  if (rt?.lighting && Array.isArray(levels) && levels.length) {
    const n = Math.min(rt.lighting.ceilingBanks || levels.length, levels.length);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += levels[i];
    bank = n > 0 ? sum / n : (levels[0] ?? 1);
  }
  return clamp(dim * bank, 0.08, 1);
}

/* ---- public API: buildLeakSpot ------------------------------------------------- */

/**
 * Builds a cohesive ceiling-to-floor leak spot:
 * 1. Water-stained ceiling tile snapped cleanly to the 0.6 m ceiling grid.
 * 2. Damp wicked carpet under-stain ring + shallow glossy translucent wet puddle (WebGL & WebGPU).
 * 3. Optional live animated voxel droplet + expanding impact ripple ring.
 *
 * Can be called by dressOfficeWear() or directly by rooms.js's 'stain' dressing.
 */
export function buildLeakSpot(c, x, z, rng, opt = {}) {
  const room = c.room;
  const localRng = rng || makeRng(`${c.level?.seed ?? 0}:leak:${room.id}:${Math.round(x * 100)},${Math.round(z * 100)}`);
  const tileX = snapTileCoord(x, room.W / 2);
  const tileZ = snapTileCoord(z, room.D / 2);
  const ceilY = ceilAt(room, tileX, tileZ);
  const floorY = floorAt(room, x, z);

  // 1. Ceiling water-stained tile snapped to 0.6 m grid (only on intact flat tiles clear of panels & holes)
  const tileBlocked = !isTileFlatAndValid(room, tileX, tileZ, 1.8)
    || tileOverlapsPanel(room, tileX, tileZ)
    || c.rt?.holeTiles?.has(tileKey(tileX, tileZ));
  if (!tileBlocked) {
    const ceilHex = c.look?.ceil || '#d6d0bc';
    const waterTex = c.kit.tex.waterTile?.(ceilHex) || fallbackWaterTile(c.kit, ceilHex);
    const wtBatch = c.mapped('office-watertile', waterTex, { detail: true, noBeamShadow: true });
    const tileRot = localRng.pick([0, Math.PI / 2, Math.PI, Math.PI * 1.5]);
    c.lay(wtBatch, tileX, tileZ, TILE, TILE, tileRot, null, WHITE, ceilY - 0.003, true);
    // Subtle damp halo bleeding across the T-bar seam (staggered below tile to prevent Z-fighting)
    c.blot(tileX, tileZ, TILE * 0.92, TILE * 0.86, { rgb: [0.16, 0.11, 0.03], a: 0.22, y: ceilY - 0.0046, down: true });
  }

  // 2. Damp wicked carpet under-stain + glossy wet translucent floor puddle
  const pw = opt.puddleW ?? localRng.range(0.64, 1.04);
  const pd = opt.puddleD ?? pw * localRng.range(0.76, 1.14);
  const pRot = localRng.range(0, Math.PI * 2);

  if (opt.puddle !== false) {
    c.blot(x, z, pw * 1.38, pd * 1.38, { rgb: [0.05, 0.04, 0.02], a: 0.30, y: floorY + 0.005 });
    c.blot(x, z, pw * 0.92, pd * 0.92, { rgb: [0.02, 0.02, 0.015], a: 0.24, y: floorY + 0.0055 });

    const puddleTex = c.kit.tex.puddle?.() || fallbackPuddle(c.kit);
    const pBatch = new Batch(false);
    const cs = Math.cos(pRot), sn = Math.sin(pRot), hw = pw / 2, hd = pd / 2, py = floorY + 0.007;
    const pt = (lx, lz) => [x + lx * cs + lz * sn, py, z - lx * sn + lz * cs];
    // 2x2 subdivided puddle sheet for smooth room-light interpolation
    const xs = [-hw, 0, hw], zs = [hd, 0, -hd], us = [0, 0.5, 1], vs = [0, 0.5, 1];
    for (let iz = 0; iz < 2; iz++) {
      for (let ix = 0; ix < 2; ix++) {
        pBatch.quad(
          pt(xs[ix], zs[iz]),
          pt(xs[ix + 1], zs[iz]),
          pt(xs[ix + 1], zs[iz + 1]),
          pt(xs[ix], zs[iz + 1]),
          WHITE,
          [[us[ix], vs[iz]], [us[ix + 1], vs[iz]], [us[ix + 1], vs[iz + 1]], [us[ix], vs[iz + 1]]],
        );
      }
    }

    scheduleAfter(c, () => {
      const geo = c.kit.geometry(pBatch, c.rt?.lights || [], c.rt?.amb || [0.3, 0.3, 0.3], c.rt?.lighting || null);
      if (!geo) return;
      const mat = c.kit.surface({
        map: puddleTex,
        room: c.rt?.u || null,
        cutout: true,
        wet: 1,
        alpha: 0.72,
        flick: geo.userData.flick,
        banks: geo.userData.banks,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'office-puddle';
      mesh.renderOrder = 2;
      mesh.matrixAutoUpdate = false;
      mesh.userData.officeWear = 'puddle';
      attachToRoom(c, mesh);
    });
  }

  // 3. Live animated falling voxel droplet + expanding impact ripple ring
  if (opt.drip !== false) {
    const dripX = opt.dripX ?? x;
    const dripZ = opt.dripZ ?? z;
    const hitY = opt.hitY ?? (floorY + 0.012);
    const startY = ceilY - 0.012;
    const maxRippleScale = opt.maxRippleScale ?? 6;
    const dripRng = localRng.fork('drip');

    let dropMesh = null;
    let dropMat = null;
    let rippleMesh = null;
    let rippleMat = null;

    scheduleAfter(c, () => {
      const cache = wearCache(c.kit);
      const dropGeo = (cache.dropGeo ||= c.kit.own(new THREE.BoxGeometry(0.018, 0.032, 0.018)));
      const lScale = roomLightScale(c.rt);
      dropMat = c.kit.own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78 }));
      dropMat.color.setRGB(0.76 * lScale, 0.81 * lScale, 0.76 * lScale);
      dropMesh = new THREE.Mesh(dropGeo, dropMat);
      dropMesh.name = 'office-drip-drop';
      dropMesh.castShadow = false;
      dropMesh.renderOrder = 3;
      dropMesh.visible = false;
      dropMesh.position.set(dripX, startY, dripZ);
      dropMesh.userData.officeWear = 'drip';
      attachToRoom(c, dropMesh);

      const ripGeo = (cache.ripGeo ||= c.kit.own(new THREE.RingGeometry(0.02, 0.035, 16)));
      rippleMat = c.kit.own(new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: RIPPLE_BASE_OPACITY,
        depthWrite: false,
        side: THREE.DoubleSide,
      }));
      rippleMat.color.setRGB(0.82 * lScale, 0.86 * lScale, 0.80 * lScale);
      rippleMesh = new THREE.Mesh(ripGeo, rippleMat);
      rippleMesh.name = 'office-drip-ripple';
      rippleMesh.castShadow = false;
      rippleMesh.renderOrder = 3;
      rippleMesh.rotation.x = -Math.PI / 2;
      rippleMesh.position.set(dripX, hitY + 0.004, dripZ);
      rippleMesh.visible = false;
      rippleMesh.userData.officeWear = 'ripple';
      attachToRoom(c, rippleMesh);
    });

    // Deterministic drip cycle state machine
    let phase = 'wait';
    let timer = 0;
    let waitDur = dripRng.range(0.5, 2.2); // staggered initial delay
    let dropY = startY;
    let dropVy = 0;
    let rippleActive = false;
    let rippleAge = 0;

    c.tick((dt, _t, me) => {
      if (!dropMesh || !rippleMesh) return;
      const step = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
      if (step <= 0) return;

      const lScale = roomLightScale(c.rt);
      if (phase === 'wait') {
        timer += step;
        if (timer >= waitDur) {
          phase = 'form';
          timer = 0;
          dropY = startY;
          dropVy = 0;
          dropMesh.visible = true;
          dropMesh.position.set(dripX, startY, dripZ);
          dropMesh.scale.set(0.35, 0.25, 0.35);
          dropMat.color.setRGB(0.76 * lScale, 0.81 * lScale, 0.76 * lScale);
        }
      } else if (phase === 'form') {
        timer += step;
        const u = clamp(timer / DRIP_FORM_SEC, 0, 1);
        const s = 0.35 + 0.65 * u;
        dropMesh.visible = true;
        dropMesh.position.set(dripX, startY - 0.014 * u, dripZ);
        dropMesh.scale.set(s, 0.25 + 0.9 * u, s);
        dropMat.color.setRGB(0.76 * lScale, 0.81 * lScale, 0.76 * lScale);
        if (u >= 1) {
          phase = 'fall';
          dropY = startY - 0.014;
          dropVy = 0.08;
        }
      } else if (phase === 'fall') {
        dropVy += DRIP_GRAVITY * step;
        dropY -= dropVy * step;
        if (dropY <= hitY) {
          // Impact!
          dropMesh.visible = false;
          phase = 'wait';
          timer = 0;
          waitDur = dripRng.range(2.4, 5.8);
          // Trigger expanding impact ripple
          rippleActive = true;
          rippleAge = 0;
          rippleMesh.visible = true;
          rippleMesh.position.set(dripX, hitY + 0.004, dripZ);
          rippleMesh.scale.setScalar(1);
          rippleMat.opacity = RIPPLE_BASE_OPACITY;
          rippleMat.color.setRGB(0.82 * lScale, 0.86 * lScale, 0.80 * lScale);
          // Quiet sparse spatial drop audio within 7.5 m
          if (me && typeof c.env?.sound?.play === 'function') {
            const dist = Math.hypot((me.x ?? 99) - dripX, (me.z ?? 99) - dripZ);
            if (dist <= OFFICE_WEAR_LIMITS.dripSoundRange) {
              try {
                const wp = c.toWorld(dripX, dripZ);
                const at = typeof c.env.hear === 'function' ? c.env.hear(wp.x, wp.z, OFFICE_WEAR_LIMITS.dripSoundRange) : null;
                const vol = at ? at.vol * 0.2 : (1 - dist / OFFICE_WEAR_LIMITS.dripSoundRange) * 0.14;
                if (vol > 0.015) c.env.sound.play('drip', { vol, ...(at?.pan !== undefined ? { pan: at.pan } : {}) });
              } catch { /* sound cue optional */ }
            }
          }
        } else {
          dropMesh.position.set(dripX, dropY, dripZ);
          const stretch = 1 + Math.min(0.8, dropVy * 0.14);
          dropMesh.scale.set(0.84, stretch, 0.84);
          dropMat.color.setRGB(0.76 * lScale, 0.81 * lScale, 0.76 * lScale);
        }
      }

      if (rippleActive) {
        rippleAge += step;
        const u = rippleAge / RIPPLE_DUR_SEC;
        if (u >= 1) {
          rippleActive = false;
          rippleMesh.visible = false;
          rippleMat.opacity = 0;
        } else {
          rippleMesh.scale.setScalar(1 + (maxRippleScale - 1) * u);
          rippleMat.opacity = RIPPLE_BASE_OPACITY * (1 - u) * (1 - u);
          rippleMat.color.setRGB(0.82 * lScale, 0.86 * lScale, 0.80 * lScale);
        }
      }
    });
  }

  return { x, z, tileX, tileZ, ceilY };
}

/* ---- public API: dressOfficeWear ----------------------------------------------- */

/**
 * Adds restrained, deterministic Floor 1 Yellow Office "lived-in" damp wear & quiet hardware
 * to a room without ever touching c.R or disturbing layout/prop seeds.
 */
export function dressOfficeWear(c, opt = {}) {
  if (!c || !c.room || c.room.crawl) return null;
  if (c.room.W < OFFICE_WEAR_LIMITS.minRoomSpan || c.room.D < OFFICE_WEAR_LIMITS.minRoomSpan) return null;
  if (opt.onlyYellow !== false && c.level?.theme && c.level.theme !== 'yellow') return null;

  const rng = makeRng(`${c.level?.seed ?? 0}:office-wear:${c.room.id}`);
  const room = c.room;
  const usedFloor = [];
  const usedWall = [];
  const usedTiles = new Set();
  const stainQuads = [];
  const wallDampQuads = [];

  const summary = {
    doorWear: 0,
    stains: 0,
    peels: 0,
    dampBands: 0,
    leaks: 0,
    switches: 0,
    vents: 0,
    sprinklers: 0,
    ajarTiles: 0,
  };

  const pushFloorStain = (x, z, w, d, rot, variant, alpha, y) => {
    const cs = Math.cos(rot), sn = Math.sin(rot), hw = w / 2, hd = d / 2;
    const pt = (lx, lz) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs];
    stainQuads.push({
      corners: [pt(-hw, hd), pt(hw, hd), pt(hw, -hd), pt(-hw, -hd)],
      center: [x, y, z],
      normal: [0, 1, 0],
      variant,
      alpha,
    });
  };

  const pushWallDamp = (side, at, y, w, h, variant, alpha, off = 0.005) => {
    const p = c.wallAt(side, at, off), U = p.U, hw = w / 2, hh = h / 2;
    wallDampQuads.push({
      corners: [
        [p.x - U[0] * hw, y - hh, p.z - U[2] * hw],
        [p.x + U[0] * hw, y - hh, p.z + U[2] * hw],
        [p.x + U[0] * hw, y + hh, p.z + U[2] * hw],
        [p.x - U[0] * hw, y + hh, p.z - U[2] * hw],
      ],
      center: [p.x, y, p.z],
      normal: [p.n[0], 0, p.n[2]],
      variant,
      alpha,
    });
  };

  // A. Subtle Doorway Foot-Traffic Wear & Damp Carpet Stains
  const floorDoors = (room.doors || []).filter((dr) => (dr.sill || 0) < 0.01);
  if (floorDoors.length) {
    const chosen = rng.shuffle(floorDoors).slice(0, Math.min(OFFICE_WEAR_LIMITS.maxDoorWear, rng.int(1, 2)));
    for (const dr of chosen) {
      const p = c.doorPoint(dr, rng.range(0.32, 0.56));
      if (Math.abs(floorAt(room, p.x, p.z)) > 0.01) continue;
      const rot = dr.side === 'left' || dr.side === 'right' ? Math.PI / 2 : 0;
      const w = Math.min(dr.w * 0.9, rng.range(0.68, 0.98));
      const d = rng.range(0.45, 0.72);
      // Cell 2 = doorway foot-traffic smudge (matches office-textures.js STAIN_UVS[2])
      pushFloorStain(p.x, p.z, w, d, rot + rng.range(-0.12, 0.12), 2, rng.range(0.16, 0.24), 0.0062);
      summary.doorWear++;
    }
  }

  if (rng.chance(OFFICE_WEAR_LIMITS.stainChance)) {
    const nStains = rng.int(1, OFFICE_WEAR_LIMITS.maxCarpetStains);
    for (let i = 0; i < nStains; i++) {
      const pt = pickClearSpot(c, rng, 0.48, { used: usedFloor });
      if (!pt) break;
      usedFloor.push([pt.x, pt.z, 0.55]);
      const w = rng.range(0.55, 1.12), d = w * rng.range(0.72, 1.18);
      // Cell 0 = damp carpet patch, Cell 1 = water tide-mark ring
      const variant = rng.chance(0.72) ? 0 : 1;
      pushFloorStain(pt.x, pt.z, w, d, rng.range(0, Math.PI * 2), variant, rng.range(0.22, 0.34), floorAt(room, pt.x, pt.z) + 0.0064);
      summary.stains++;
    }
  }

  // B. Rare Peeling / Curled Wallpaper Seams (~28% of rooms, 1 spot — max 2 in large rooms > 30 m²)
  if (rng.chance(OFFICE_WEAR_LIMITS.peelChance)) {
    const area = room.W * room.D;
    const maxP = area > OFFICE_WEAR_LIMITS.largeRoomArea ? OFFICE_WEAR_LIMITS.largeRoomMaxPeels : OFFICE_WEAR_LIMITS.maxPeels;
    const nPeels = maxP > 1 && rng.chance(0.45) ? 2 : 1;
    const peelTex = c.kit.tex.peel?.(c.look) || fallbackPeel(c.kit, c.look);
    const peelBatch = c.mapped('office-peel', peelTex, { cutout: true, detail: true, noBeamShadow: true });
    const wallHex = c.look?.wall || '#d9c676';
    const inkHex = c.look?.ink || '#b59d52';

    for (let i = 0; i < nPeels; i++) {
      const spot = pickWallSpot(c, rng, 0.55, { margin: 0.5, minTop: 2.15, usedWall, openFront: true });
      if (!spot) break;
      usedWall.push([spot.side, spot.at - 0.35, spot.at + 0.35]);
      const p = c.wallAt(spot.side, spot.at, 0.05);
      const cy = ceilAt(room, p.x, p.z);
      const pw = rng.range(0.14, 0.24), ph = rng.range(0.38, 0.66);
      const lowSeam = rng.chance(0.25);
      const y = clamp(lowSeam ? rng.range(0.45, 0.72) : rng.range(1.15, 2.05), 0.16 + ph / 2, cy - 0.14 - ph / 2);
      const curlDir = rng.chance(0.5) ? 1 : -1;

      const peelUv = curlDir < 0 ? [[1, 0], [0, 0], [0, 1], [1, 1]] : null;
      c.hang(peelBatch, spot.side, spot.at, y, pw, ph, peelUv, WHITE, 0.006);
      // Thin 3D curled paper flap standing 1–3 cm proud of the wall
      const flapModel = c.kit.model(`office-wear:peel-flap:${wallHex}:${curlDir}`, () => peelFlapVox(wallHex, inkHex, curlDir), { ao: false });
      placeWallFitVox(c, flapModel, spot.side, spot.at, y, WALLFIT.voxel, 0.002, c.vox);
      summary.peels++;
    }
  }

  // C. Subtle Baseboard Damp Wicking & Wall Drip Streaks (~30% of rooms, 1–2 spots)
  if (rng.chance(OFFICE_WEAR_LIMITS.dampBandChance)) {
    const nBands = rng.int(1, OFFICE_WEAR_LIMITS.maxDampBands);
    for (let i = 0; i < nBands; i++) {
      const isStreak = rng.chance(0.35);
      if (isStreak) {
        const spot = pickWallSpot(c, rng, 0.4, { margin: 0.45, minTop: 2.0, usedWall });
        if (!spot) continue;
        usedWall.push([spot.side, spot.at - 0.22, spot.at + 0.22]);
        const p = c.wallAt(spot.side, spot.at, 0.05);
        const cy = ceilAt(room, p.x, p.z);
        const sw = rng.range(0.09, 0.16), sh = Math.min(cy - 0.35, rng.range(0.55, 1.15));
        pushWallDamp(spot.side, spot.at, cy - 0.02 - sh / 2, sw, sh, 1, rng.range(0.16, 0.26), 0.005);
        summary.dampBands++;
      } else {
        const spot = pickWallSpot(c, rng, 0.9, { margin: 0.4, minTop: 0.9, usedWall });
        if (!spot) continue;
        usedWall.push([spot.side, spot.at - 0.55, spot.at + 0.55]);
        const bw = rng.range(0.75, 1.45), bh = rng.range(0.20, 0.28);
        pushWallDamp(spot.side, spot.at, 0.11 + bh / 2, bw, bh, 0, rng.range(0.18, 0.28), 0.005);
        summary.dampBands++;
      }
    }
  }

  // D. Shallow Glossy Puddles + Live Ceiling Drips (~22% of rooms, or opt.forceLeak)
  if (opt.forceLeak || rng.chance(OFFICE_WEAR_LIMITS.leakChance)) {
    let pt = pickClearSpot(c, rng, 0.55, { head: 2.0, flatCeil: true, avoidPanels: true, used: usedFloor });
    if (!pt && opt.forceLeak) {
      pt = pickClearSpot(c, rng, 0.45, { head: 1.8, used: usedFloor }) || { x: 0, z: 0 };
    }
    if (pt) {
      usedFloor.push([pt.x, pt.z, 0.65]);
      const leak = buildLeakSpot(c, pt.x, pt.z, rng, { drip: opt.drip !== false });
      const ix = Math.floor(leak.tileX / TILE), iz = Math.floor(leak.tileZ / TILE);
      usedTiles.add(`${ix},${iz}`);
      summary.leaks++;
    }
  }

  // E. Quiet Uncanny Office Architectural Hardware (zero colliders, cached Vox models)

  // E1. Wall Light Switch (~55% of rooms, 0.38 m beside one doorway at y = 1.18 m)
  if (floorDoors.length && rng.chance(OFFICE_WEAR_LIMITS.switchChance)) {
    const swModel = c.kit.model('wallfit:switch:v1', switchVox, { ao: false });
    outer: for (const dr of rng.shuffle(floorDoors)) {
      const spans = subtractWallSpans(c.spans(dr.side, 0.24, 1.55), dr.side, usedWall);
      for (const dir of rng.shuffle([-1, 1])) {
        const at = dr.c + dir * (dr.w / 2 + 0.38);
        const fitsSpan = spans.some(([a, b]) => at >= a + 0.12 && at <= b - 0.12);
        if (!fitsSpan) continue;
        const p = c.wallAt(dr.side, at, 0.15);
        if (ceilAt(room, p.x, p.z) < 1.55) continue;
        usedWall.push([dr.side, at - 0.14, at + 0.14]);
        placeWallFitVox(c, swModel, dr.side, at, 1.18, WALLFIT.voxel, 0, c.vox);
        summary.switches++;
        break outer;
      }
    }
  }

  // Gather unoccupied flat ceiling tiles (never overlapping fluorescent light panels or ceiling holes)
  const freeTiles = collectFreeCeilingTiles(room, c.rt?.holeTiles).filter((t) => !usedTiles.has(t.key));
  const takeTile = (minDist = 0, fromList = []) => {
    const pool = freeTiles.filter((t) => !usedTiles.has(t.key) && fromList.every((o) => Math.hypot(t.tx - o.tx, t.tz - o.tz) >= minDist));
    if (!pool.length) return null;
    const picked = rng.pick(pool);
    usedTiles.add(picked.key);
    return picked;
  };

  // E2. Ceiling HVAC Air Diffuser Grate (~45% of rooms, 1 tile)
  if (freeTiles.length && rng.chance(OFFICE_WEAR_LIMITS.ventChance)) {
    const tile = takeTile();
    if (tile) {
      const ventModel = c.kit.model('office-wear:hvac-diffuser:v1', diffuserVox, { ao: false });
      placeCeilVox(c, ventModel, tile.tx, tile.ceilY - 0.002, tile.tz, {
        scale: HALF_VOX,
        rot: rng.pick([0, Math.PI / 2]),
        batch: c.vox,
      });
      summary.vents++;
    }
  }

  // E3. Ceiling Sprinkler Head (~35% of rooms, 1–2 tiny brass/chrome rosettes)
  if (freeTiles.length && rng.chance(OFFICE_WEAR_LIMITS.sprinklerChance)) {
    const nSprinklers = rng.int(1, OFFICE_WEAR_LIMITS.maxSprinklers);
    const spModel = c.kit.model('office-wear:sprinkler:v1', sprinklerVox, { ao: false });
    const placed = [];
    for (let i = 0; i < nSprinklers; i++) {
      const tile = takeTile(1.8, placed);
      if (!tile) break;
      placed.push(tile);
      placeCeilVox(c, spModel, tile.tx, tile.ceilY - 0.002, tile.tz, {
        scale: WALLFIT.voxel,
        rot: rng.range(0, Math.PI * 2),
        batch: c.vox,
      });
      summary.sprinklers++;
    }
  }

  // E4. Rare Slightly-Ajar Ceiling Tile (~14% of rooms, max 1)
  if (freeTiles.length && rng.chance(OFFICE_WEAR_LIMITS.ajarTileChance)) {
    const tile = takeTile();
    if (tile) {
      const ceilHex = c.look?.ceil || '#d6d0bc';
      const dir = rng.pick([0, 1, 2, 3]); // which edge reveals the dark plenum gap
      const gapW = 0.032, gapSpan = TILE - 0.02, yGap = tile.ceilY - 0.004;
      const dx = dir === 0 ? 1 : dir === 1 ? -1 : 0;
      const dz = dir === 2 ? 1 : dir === 3 ? -1 : 0;
      // Crisp 3.2 cm dark plenum shadow gap along the open edge
      if (dx !== 0) {
        const gx = tile.tx + dx * (TILE / 2 - gapW / 2 - 0.008);
        c.lay(c.detail, gx, tile.tz, gapW, gapSpan, 0, null, [0.014, 0.014, 0.013], yGap, true);
      } else {
        const gz = tile.tz + dz * (TILE / 2 - gapW / 2 - 0.008);
        c.lay(c.detail, tile.tx, gz, gapSpan, gapW, 0, null, [0.014, 0.014, 0.013], yGap, true);
      }
      // Thin shifted/slightly-tilted acoustic ceiling tile lip hanging ~1.5 cm below the T-bar
      const tileModel = c.kit.model(`office-wear:ajar-tile:${ceilHex}`, () => ajarTileVox(ceilHex), { ao: false });
      placeCeilVox(c, tileModel, tile.tx - dx * 0.024, tile.ceilY - 0.011, tile.tz - dz * 0.024, {
        scale: HALF_VOX,
        tiltX: dz * 0.036,
        tiltZ: -dx * 0.036,
        batch: c.vox,
      });
      summary.ajarTiles++;
    }
  }

  // Flush batched translucent stain / damp quads into at most 1–2 lean detail meshes per room
  const flushDecalQuads = (quads, atlasObj, name, tag) => {
    if (!quads.length) return;
    scheduleAfter(c, () => {
      const pos = [], uv = [], col = [], idx = [];
      for (const q of quads) {
        const base = pos.length / 3;
        const [cx, cy, cz] = q.center, [nx, ny, nz] = q.normal;
        const l = typeof c.sample === 'function' ? c.sample(cx, cy, cz, nx, ny, nz) : [0.7, 0.7, 0.7];
        const lr = clamp(l[0] * 1.15 + 0.01, 0.01, 1);
        const lg = clamp(l[1] * 1.15 + 0.01, 0.01, 1);
        const lb = clamp(l[2] * 1.15 + 0.01, 0.01, 1);
        const qUv = atlasObj.uv(q.variant);
        for (let k = 0; k < 4; k++) {
          const p = q.corners[k];
          pos.push(p[0], p[1], p[2]);
          uv.push(qUv[k][0], qUv[k][1]);
          col.push(lr, lg, lb, q.alpha);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      const geo = c.kit.own(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
      geo.setIndex(idx);
      const cache = wearCache(c.kit);
      const matKey = tag === 'stains' ? 'stainMat' : 'dampMat';
      let mat = cache[matKey];
      if (!mat || mat.map !== atlasObj.texture) {
        mat = c.kit.own(new THREE.MeshBasicMaterial({
          map: atlasObj.texture,
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }));
        cache[matKey] = mat;
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = name;
      mesh.renderOrder = 1;
      mesh.matrixAutoUpdate = false;
      mesh.userData.officeWear = tag;
      mesh.userData.detail = true;
      attachToRoom(c, mesh);
    });
  };

  if (stainQuads.length) flushDecalQuads(stainQuads, resolveStainAtlas(c.kit), 'office-wear-stains', 'stains');
  if (wallDampQuads.length) flushDecalQuads(wallDampQuads, fallbackWallDampAtlas(c.kit), 'office-wear-damp', 'damp');

  return summary;
}
