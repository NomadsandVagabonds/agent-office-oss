// The Backrooms — The Offsite Reserve (`forest`): Claustrophobic Survival-Horror
// Stage-Set & Feral Woodland Maze Kit (`forest-maze.js`).
//
// Translates the floor's core horror thesis into blind-corner architecture:
//   "The building staged a wilderness survival retreat out of painted pixel-tree
//    plasterboard partitions, astroturf rolls, corrugated cardboard shrub-boxes,
//    and cardboard birds on strings — and then real voxel trees, moss, water,
//    and forest entities grew through the stage set."
//
// Every solid occluder registers `tall: true` (`world.los`-blocking) while
// automatically trimming/skipping doorway & stash approaches so `world.walkable`
// never warns (`said: []`).

import * as THREE from 'three';
import { gpu } from '../engine/gpu.js';
import { fitsAt } from './gen.js';
import { Batch, WHITE, ticks } from './kit.js';
import { ensureForestDetail } from './forest-fx.js';
import { garble } from './forest.js';
import {
  fernClumpVox, cattailReedsVox, hangingCanopyDrapeVox,
  bushShrubVox, drywallCanopyCapVox, cardboardBirdVox,
  sidewaysCeilingLogVox, steppedGreyRockVox, pnwSwordFernClusterVox,
} from './forest-models.js';

const P = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/* ---- 1. Procedural 128–192px AAA Stage-Set & Woodland Occluder Textures --- */

/**
 * Weathered, damp-stained cream-sage plasterboard painted with naive blocky
 * pixel-art brown tree trunks, forked branches, two-tone green pixel canopies,
 * and basal pixel bushes (`192×192`, mapped full-height `y = 0..h`!).
 */
export function paintedDrywallTex(kit, variant = 0) {
  const v = ((variant % 3) + 3) % 3;
  return kit.tex.custom(`forest:maze:drywall:${v}`, 192, 192, (g, w, h) => {
    // Aged damp cream-sage gypsum board base
    const baseCols = ['#b5b39b', '#a8ae94', '#bab49c'];
    P(g, baseCols[v], 0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = Math.floor(hash(i * 3.7 + v * 19) * w);
      const y = Math.floor(hash(i * 6.1 + v * 31) * h);
      P(g, i % 2 ? '#a2a189' : '#c2bfaa', x, y, 3, 2);
    }
    // Vertical drywall tape joint & scuff streaks
    P(g, '#9a9982', 95, 0, 2, h);
    P(g, '#c7c4af', 97, 0, 1, h);

    const PX = 6; // crisp 6px painted pixel-mural grid!
    const cell = (cx, cy, col) => P(g, col, cx * PX, cy * PX, PX, PX);

    // Basal pixel-art bushes painted along the bottom (`cy = 24..31`)
    const bDark = '#294d23', bMid = '#3b6b30', bLit = '#50853d';
    for (let cx = 0; cx < 32; cx++) {
      const wave = Math.floor(2.6 * Math.abs(Math.sin(cx * 0.55 + v * 1.4)) + 1.5 * Math.cos(cx * 1.1));
      const topCy = 27 - Math.max(0, wave);
      for (let cy = topCy; cy < 31; cy++) {
        cell(cx, cy, cy === topCy ? bLit : cy < 29 ? bMid : bDark);
      }
    }

    // Naive painted pixel-art tree(s) rising up the plasterboard!
    const drawPixelTree = (tcx, crownCy, scale) => {
      const bark1 = '#593a22', bark2 = '#422a18';
      // Trunk (`cy = crownCy + 4 .. 30`)
      for (let cy = crownCy + 3; cy < 30; cy++) {
        cell(tcx, cy, bark1);
        if (scale > 1) cell(tcx + 1, cy, bark2);
        if (cy > 27) { cell(tcx - 1, cy, bark2); if (scale > 1) cell(tcx + 2, cy, bark1); }
      }
      // Forked pixel branches
      cell(tcx - 1, crownCy + 5, bark1); cell(tcx - 2, crownCy + 4, bark1);
      cell(tcx + scale, crownCy + 6, bark2); cell(tcx + scale + 1, crownCy + 5, bark2);

      // Blocky pixel-art leafy crown
      const rx = scale > 1 ? 6 : 4, ry = scale > 1 ? 5 : 4;
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx + (scale > 1 ? 1 : 0); dx++) {
          const d = (dx * dx) / (rx * rx + 1) + (dy * dy) / (ry * ry + 1);
          if (d > 0.96 + 0.18 * Math.sin(dx * 1.9 + dy * 1.3)) continue;
          const shade = dy < -1 ? bLit : dy > 2 ? bDark : bMid;
          cell((tcx + dx + 32) % 32, Math.max(0, crownCy + dy), shade);
        }
      }
    };

    if (v === 0) {
      drawPixelTree(15, 6, 2);
      drawPixelTree(4, 15, 1);
      drawPixelTree(26, 16, 1);
    } else if (v === 1) {
      drawPixelTree(9, 7, 2);
      drawPixelTree(23, 12, 1);
    } else {
      drawPixelTree(18, 6, 2);
      drawPixelTree(6, 13, 1);
    }

    // Damp dark water-wicking stain along bottom baseboard + plaster chips
    for (let i = 0; i < 420; i++) {
      const x = Math.floor(hash(i * 5.3 + v) * w);
      const y = h - 1 - Math.floor(Math.pow(hash(i * 2.9), 2.1) * 26);
      P(g, i % 2 ? 'rgba(34,36,26,0.55)' : 'rgba(58,48,34,0.45)', x, y, 3, 2);
    }
    P(g, '#cfc9b4', 0, h - 7, w, 7); // off-white wooden baseboard moulding
    P(g, '#8c8672', 0, h - 8, w, 1);
  });
}

export function cardboardBushTex(kit) {
  return kit.tex.custom('forest:maze:cardboard-bush', 128, 128, (g, w, h) => {
    // Corrugated kraft cardboard box side
    P(g, '#8f6b41', 0, 0, w, h);
    for (let y = 0; y < h; y += 3) P(g, y % 6 === 0 ? '#826038' : '#997449', 0, y, w, 1);
    // Torn right-hand corner exposing dark wavy corrugated cardboard flutes!
    P(g, '#5e4223', w - 22, 6, 22, 46);
    for (let fy = 8; fy < 50; fy += 4) P(g, '#3d2914', w - 20, fy, 18, 2);
    // Tan packing tape seam across top flap
    P(g, '#bfa06b', 0, 0, w - 18, 9);
    P(g, '#bfa06b', 58, 0, 12, 26);
    // Crudely hand-painted green bush silhouette on the cardboard!
    const lobes = [[64, 96, 44, 28], [34, 102, 24, 22], [92, 102, 24, 22], [50, 82, 22, 20], [78, 84, 22, 18]];
    g.fillStyle = '#264d21';
    for (const [cx, cy, rx, ry] of lobes) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#3d7031';
    for (const [cx, cy, rx, ry] of lobes) { g.beginPath(); g.ellipse(cx, cy + 3, rx * 0.78, ry * 0.75, 0, 0, Math.PI * 2); g.fill(); }
    garble(g, 'PROP SHRUB 04', 8, 16, 46, 8, { color: '#3b2814', size: 6, mess: 0.25 }, 31);
  }, { clamp: true });
}

export function thicketWallTex(kit) {
  return kit.tex.custom('forest:maze:hedge', 128, 128, (g, w, h) => {
    P(g, '#0d1a0f', 0, 0, w, h);
    const greens = ['#132916', '#1b381e', '#244726', '#0a140c', '#2e572f'];
    for (let i = 0; i < 1900; i++) {
      const x = Math.floor(hash(i * 3.1) * w);
      const y = Math.floor(hash(i * 7.3 + 19) * h);
      const col = greens[Math.floor(hash(i * 11.7) * greens.length)];
      P(g, col, x, y, 2 + (i % 4), 1 + (i % 3));
    }
    g.lineWidth = 2;
    for (let i = 0; i < 28; i++) {
      g.strokeStyle = i % 3 === 0 ? '#2b1b10' : '#3d2718';
      const x0 = hash(i + 5) * w, y0 = hash(i + 41) * h;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (hash(i + 91) - 0.5) * 38, y0 + (hash(i + 131) - 0.5) * 24); g.stroke();
    }
    g.strokeStyle = '#c9a024'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, 46); g.bezierCurveTo(42, 54, 84, 38, w, 49); g.stroke();
    g.strokeStyle = '#2e5d8f';
    g.beginPath(); g.moveTo(0, 94); g.bezierCurveTo(48, 86, 88, 102, w, 92); g.stroke();
  });
}

export function cordwoodStackTex(kit) {
  return kit.tex.custom('forest:maze:cordwood', 128, 128, (g, w, h) => {
    P(g, '#17100b', 0, 0, w, h);
    const rLog = 8;
    for (let row = 0; row < 8; row++) {
      const cy = row * 16 + 8, off = (row % 2) * 8;
      for (let col = -1; col < 9; col++) {
        const cx = col * 16 + off + 8;
        const bark = (row + col) % 4 === 0 ? '#cfc8b6' : '#3d2718';
        const sap = (row + col) % 2 === 0 ? '#b88c58' : '#a67946';
        g.fillStyle = bark; g.beginPath(); g.arc(cx, cy, rLog - 0.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = sap; g.beginPath(); g.arc(cx, cy, rLog - 2.3, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#7d552c'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, rLog - 4.5, 0, Math.PI * 2); g.stroke();
        P(g, '#59391c', cx - 1, cy - 1, 2, 2);
      }
    }
    // (no inventory tags on the log ends: three a tile, each a black bar on white, tiled into diagonal lines of dashes
    // across every cordwood wall on the floor. docs/FOREST-REVIEW.md §4)
  });
}

export function overgrownCubicleTex(kit) {
  return kit.tex.custom('forest:maze:cubicle', 128, 128, (g, w, h) => {
    P(g, '#525954', 0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = Math.floor(hash(i * 2.3) * w), y = Math.floor(hash(i * 5.7) * h);
      P(g, i % 2 ? '#474f49' : '#5e6660', x, y, 2, 1);
    }
    P(g, '#313634', 0, 0, 4, h); P(g, '#313634', w - 4, 0, 4, h); P(g, '#313634', 0, 62, w, 3);
    P(g, '#dfd9c5', 26, 24, 24, 30); P(g, '#b83228', 37, 25, 3, 3);
    garble(g, 'Q4 WOODS', 28, 31, 20, 8, { color: '#2a2d2b', size: 6, mess: 0.35 }, 17);
    for (let i = 0; i < 950; i++) {
      const x = Math.floor(hash(i * 4.1 + 7) * w);
      const band = hash(i * 8.9);
      const y = band < 0.65 ? h - 1 - Math.floor(Math.pow(hash(i * 3.7), 1.6) * 58) : Math.floor(Math.pow(hash(i * 6.1), 1.8) * 38);
      P(g, i % 3 === 0 ? '#1e3b1c' : i % 3 === 1 ? '#2d5227' : '#3d6932', x, y, 3, 3);
    }
  });
}

export function rustedArchiveTex(kit) {
  return kit.tex.custom('forest:maze:archive', 128, 128, (g, w, h) => {
    P(g, '#363b39', 0, 0, w, h);
    for (let tier = 0; tier < 4; tier++) {
      const y0 = tier * 32 + 3;
      P(g, '#252928', 4, y0, w - 8, 27);
      for (let fx = 8; fx < w - 10; fx += 5) {
        const fh = 16 + Math.floor(hash(fx + tier * 19) * 8);
        P(g, (fx + tier) % 3 === 0 ? '#c9b37c' : '#dfd0a3', fx, y0 + 25 - fh, 4, fh);
      }
      P(g, '#484f4c', 4, y0 + 22, w - 8, 6);
      P(g, '#b5a890', 54, y0 + 23, 20, 4);
    }
    for (let i = 0; i < 360; i++) {
      const x = Math.floor(hash(i * 5.3) * w), y = Math.floor(hash(i * 9.1) * h);
      P(g, i % 2 ? '#5c341d' : '#264722', x, y, 3, 2);
    }
  });
}

export function charredDrywallTex(kit) {
  return kit.tex.custom('forest:maze:charred', 128, 128, (g, w, h) => {
    P(g, '#181616', 0, 0, w, h);
    for (let i = 0; i < 1100; i++) {
      const x = Math.floor(hash(i * 3.7) * w), y = Math.floor(hash(i * 6.3) * h);
      P(g, i % 3 === 0 ? '#242120' : i % 3 === 1 ? '#111010' : '#2e2927', x, y, 3, 2);
    }
    for (let sx = 14; sx < w; sx += 32) P(g, '#0c0b0b', sx, 0, 6, h);
    for (let i = 0; i < 22; i++) {
      P(g, i % 2 ? '#e85d17' : '#ffa733', Math.floor(hash(i * 11) * w), h - 4 - Math.floor(hash(i * 17) * 14), 2, 1);
    }
  });
}

export function reedWallTex(kit) {
  return kit.tex.custom('forest:maze:reeds', 128, 128, (g, w, h) => {
    P(g, '#0e1a12', 0, 0, w, h);
    const cols = ['#243d21', '#315229', '#446632', '#57522c', '#182b17'];
    for (let x = 0; x < w; x += 2) {
      for (let k = 0; k < 3; k++) {
        const col = cols[Math.floor(hash(x * 3 + k * 19) * cols.length)];
        const yTop = Math.floor(hash(x * 7 + k * 11) * 18);
        P(g, col, x + (k % 2), yTop, 2, h - yTop);
      }
      if (hash(x * 13) > 0.72) P(g, '#4a2e18', x, 16 + Math.floor(hash(x * 5) * 24), 3, 13);
    }
  });
}

export function tarpWallTex(kit) {
  return kit.tex.custom('forest:maze:tarp', 128, 128, (g, w, h) => {
    P(g, '#2e3d29', 0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      const x = Math.floor(hash(i * 2.9) * w), y = Math.floor(hash(i * 7.1) * h);
      P(g, i % 2 ? '#253321' : '#384a32', x, y, 4, 2);
    }
    P(g, '#cf5c19', 0, 44, w, 14);
    garble(g, 'OFFSITE BOUNDARY · KEEP ON TRAIL', 6, 46, w - 12, 10, { color: '#171614', size: 8, mess: 0.28 }, 43);
    for (let gx = 8; gx < w; gx += 24) P(g, '#c49d48', gx, 4, 3, 3);
  });
}

function texForStyle(kit, style, variant = 0) {
  if (style === 'drywall') return paintedDrywallTex(kit, variant);
  if (style === 'cordwood') return cordwoodStackTex(kit);
  if (style === 'cubicle') return overgrownCubicleTex(kit);
  if (style === 'archive') return rustedArchiveTex(kit);
  if (style === 'charred') return charredDrywallTex(kit);
  if (style === 'reeds') return reedWallTex(kit);
  if (style === 'tarp') return tarpWallTex(kit);
  return thicketWallTex(kit);
}

/** Add a full-height UV-mapped wall box (`v = 0` at floor `y0` -> `v = 1` at top `y1`, subdivided for smooth lighting) so painted trees stand right-side up! */
function fullHeightWallBox(batch, cFlat, ax0, y0, az0, ax1, y1, az1) {
  const alongX = (ax1 - ax0) >= (az1 - az0);
  const w = ax1 - ax0, h = y1 - y0, d = az1 - az0;
  if (alongX) {
    batch.grid([ax0, y0, az1], [1, 0, 0], [0, 1, 0], ticks(w, 0.9, 0), ticks(h, 0.9, 0), (u, v) => [u / 2.2, v / h], WHITE);
    batch.grid([ax1, y0, az0], [-1, 0, 0], [0, 1, 0], ticks(w, 0.9, 0), ticks(h, 0.9, 0), (u, v) => [u / 2.2, v / h], WHITE);
  } else {
    batch.grid([ax1, y0, az1], [0, 0, -1], [0, 1, 0], ticks(d, 0.9, 0), ticks(h, 0.9, 0), (u, v) => [u / 2.2, v / h], WHITE);
    batch.grid([ax0, y0, az0], [0, 0, 1], [0, 1, 0], ticks(d, 0.9, 0), ticks(h, 0.9, 0), (u, v) => [u / 2.2, v / h], WHITE);
  }
  // Raw gypsum plaster edges & top cap
  const gypsum = [0.74, 0.71, 0.62];
  cFlat.box(ax0, y1 - 0.03, az0, ax1, y1, az1, gypsum);
  if (alongX) {
    cFlat.box(ax0, y0, az0, ax0 + 0.035, y1, az1, gypsum, { skip: '-y' });
    cFlat.box(ax1 - 0.035, y0, az0, ax1, y1, az1, gypsum, { skip: '-y' });
  } else {
    cFlat.box(ax0, y0, az0, ax1, y1, az0 + 0.035, gypsum, { skip: '-y' });
    cFlat.box(ax0, y0, az1 - 0.035, ax1, y1, az1, gypsum, { skip: '-y' });
  }
}

/* ---- 2. Doorway-Safe Multi-Layered 3D Sightline Occluder Wall ------------ */

export function occluderWall(c, x0, z0, x1, z1, opt = {}) {
  const { W, D, H, kit } = c;
  let ax0 = Math.max(-W / 2 + 0.14, Math.min(x0, x1));
  let ax1 = Math.min(W / 2 - 0.14, Math.max(x0, x1));
  let az0 = Math.max(-D / 2 + 0.14, Math.min(z0, z1));
  let az1 = Math.min(D / 2 - 0.14, Math.max(z0, z1));

  const alongX = (ax1 - ax0) >= (az1 - az0);
  const minDoorClear = opt.doorClear ?? 1.32;

  const guards = [
    ...c.room.doors.map((dr) => {
      const p = c.doorPoint(dr, 0.55);
      return { x: p.x, z: p.z, r: minDoorClear };
    }),
    ...(c.room.stash ? [{
      x: (c.room.stash[0] + c.room.stash[2]) * 0.5,
      z: (c.room.stash[1] + c.room.stash[3]) * 0.5,
      r: 0.95,
    }] : []),
    ...(opt.keepClear || []),
  ];

  for (const g of guards) {
    const cx = clamp(g.x, ax0, ax1), cz = clamp(g.z, az0, az1);
    if (Math.hypot(g.x - cx, g.z - cz) < g.r) {
      if (alongX) {
        const leftLen = (g.x - g.r) - ax0, rightLen = ax1 - (g.x + g.r);
        if (leftLen >= rightLen && leftLen > 0.65) ax1 = g.x - g.r;
        else if (rightLen > 0.65) ax0 = g.x + g.r;
        else return null;
      } else {
        const botLen = (g.z - g.r) - az0, topLen = az1 - (g.z + g.r);
        if (botLen >= topLen && botLen > 0.65) az1 = g.z - g.r;
        else if (topLen > 0.65) az0 = g.z + g.r;
        else return null;
      }
    }
  }

  const span = alongX ? (ax1 - ax0) : (az1 - az0);
  if (span < 0.60) return null;

  const style = opt.style || 'drywall';
  // Keep drywall partitions realistically crisp & plaster-thin (`0.22 m`)!
  if (style === 'drywall') {
    if (alongX && (az1 - az0) > 0.24) {
      const m = (az0 + az1) * 0.5; az0 = m - 0.11; az1 = m + 0.11;
    } else if (!alongX && (ax1 - ax0) > 0.24) {
      const m = (ax0 + ax1) * 0.5; ax0 = m - 0.11; ax1 = m + 0.11;
    }
  }

  const y0 = opt.y0 ?? 0;
  const h = Math.min(H - 0.28, opt.h ?? (style === 'drywall' ? 2.52 : style === 'cubicle' || style === 'charred' ? 2.28 : 2.46));
  const variant = Math.abs(Math.round(ax0 * 3 + az0 * 5)) % 3;
  const batch = c.mapped(`forest:occluder:${style}:${style === 'drywall' ? variant : 0}`, texForStyle(kit, style, variant));
  const mx = (ax0 + ax1) * 0.5, mz = (az0 + az1) * 0.5;
  const det = ensureForestDetail(c);

  if (style === 'drywall') {
    // Full-height painted pixel-tree plasterboard + raw crumbled gypsum stepped edge + 3D voxel canopy bursting out top!
    fullHeightWallBox(batch, c.flat, ax0, y0, az0, ax1, h, az1);
    // Jagged broken gypsum stair-step notch & fallen plaster chunks at one end!
    const gypsum = [0.78, 0.75, 0.66], lath = [0.44, 0.32, 0.20];
    if (alongX) {
      c.flat.box(ax0 - 0.14, 0, az0 + 0.02, ax0, h * 0.62, az1 - 0.02, gypsum, { skip: '-y' });
      c.flat.box(ax0 - 0.07, h * 0.62, az0 + 0.03, ax0, h * 0.84, az1 - 0.03, lath);
      c.flat.box(ax0 - 0.22, 0, az1 + 0.08, ax0 - 0.08, 0.07, az1 + 0.20, gypsum, { skip: '-y' });
    } else {
      c.flat.box(ax0 + 0.02, 0, az0 - 0.14, ax1 - 0.02, h * 0.62, az0, gypsum, { skip: '-y' });
      c.flat.box(ax0 + 0.03, h * 0.62, az0 - 0.07, ax1 - 0.03, h * 0.84, az0, lath);
      c.flat.box(ax1 + 0.08, 0, az0 - 0.22, ax1 + 0.20, 0.07, az0 - 0.08, gypsum, { skip: '-y' });
    }
    // Real 3D voxel green tree-crown cap erupting right out of the top of the painted drywall!
    if ((c.rt._pendingDetTris || 0) < 185000 && h + 0.35 < H) {
      det.pushVox({
        key: 'forest:detail:drywall-cap',
        make: drywallCanopyCapVox(),
        x: mx,
        y: h - 0.06,
        z: mz,
        rot: alongX ? 0 : Math.PI * 0.5,
        scale: 0.034,
      });
    }
    // Lush 3D voxel woodland shrub nestled against the wall base!
    if (opt.tufts !== false && (c.rt._pendingDetTris || 0) < 185000) {
      const off = alongX ? [0, 0.30] : [0.30, 0];
      det.pushVox({
        key: 'forest:detail:shrub',
        make: bushShrubVox(),
        x: mx + off[0],
        y: 0,
        z: mz + off[1],
        rot: mx + mz,
        scale: 0.030,
      });
    }
  } else {
    const uvScale = style === 'cordwood' ? 1.15 : style === 'archive' ? 1.85 : style === 'tarp' ? 1.95 : 1.35;
    batch.box(ax0, y0, az0, ax1, h, az1, WHITE, { uv: uvScale, skip: y0 === 0 ? '-y' : '' });
    const nCrests = Math.max(2, Math.floor(span / 1.15));
    for (let i = 0; i < nCrests; i++) {
      const tA = (i + 0.08) / nCrests, tB = (i + 0.88) / nCrests;
      const extraH = 0.12 + hash(i * 13 + ax0 * 7 + az0 * 11) * 0.26;
      if (h + extraH > H - 0.06) continue;
      if (alongX) {
        const cx0 = ax0 + (ax1 - ax0) * tA, cx1 = ax0 + (ax1 - ax0) * tB;
        if (style === 'charred') c.flat.box(cx0, h, mz - 0.04, cx0 + 0.08, h + extraH + 0.16, mz + 0.04, [0.10, 0.09, 0.09]);
        else batch.box(cx0, h, az0 + 0.05, cx1, h + extraH, az1 - 0.05, [0.86, 0.90, 0.84], { uv: uvScale, skip: '-y' });
      } else {
        const cz0 = az0 + (az1 - az0) * tA, cz1 = az0 + (az1 - az0) * tB;
        if (style === 'charred') c.flat.box(mx - 0.04, h, cz0, mx + 0.04, h + extraH + 0.16, cz0 + 0.08, [0.10, 0.09, 0.09]);
        else batch.box(ax0 + 0.05, h, cz0, ax1 - 0.05, h + extraH, cz1, [0.86, 0.90, 0.84], { uv: uvScale, skip: '-y' });
      }
    }
    if (style === 'cordwood') {
      const strap = [0.88, 0.38, 0.10];
      for (const f of [0.25, 0.75]) {
        if (alongX) { const sx = ax0 + (ax1 - ax0) * f; c.flat.box(sx - 0.03, y0, az0 - 0.015, sx + 0.03, h + 0.02, az1 + 0.015, strap, { skip: '-y' }); }
        else { const sz = az0 + (az1 - az0) * f; c.flat.box(ax0 - 0.015, y0, sz - 0.03, ax1 + 0.015, h + 0.02, sz + 0.03, strap, { skip: '-y' }); }
      }
    }
    if (opt.tufts !== false && (style === 'hedge' || style === 'reeds' || style === 'cubicle') && (c.rt._pendingDetTris || 0) < 185000) {
      const isReed = style === 'reeds';
      det.pushVox({
        key: isReed ? 'forest:detail:reeds' : 'forest:detail:shrub',
        make: isReed ? cattailReedsVox() : bushShrubVox(),
        x: mx + (alongX ? 0 : 0.28),
        y: y0,
        z: mz + (alongX ? 0.28 : 0),
        rot: mx * 2.1,
        scale: 0.028,
      });
    }
  }

  if (y0 >= -0.05) {
    c.blot(mx, mz, (ax1 - ax0) + 0.55, (az1 - az0) + 0.55, { rgb: [0.03, 0.04, 0.02], a: 0.50 });
  }

  c.solid(ax0, az0, ax1, az1, { tall: true });
  const steps = Math.max(1, Math.ceil(span / 0.5));
  const halfThick = (alongX ? (az1 - az0) : (ax1 - ax0)) * 0.5 + 0.22;
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    c.reserve(alongX ? ax0 + (ax1 - ax0) * u : mx, alongX ? mz : az0 + (az1 - az0) * u, halfThick);
  }
  return { x0: ax0, z0: az0, x1: ax1, z1: az1 };
}

/* ---- 3. Framed Painted-Drywall Doorway & Low Crouch Crawl-Portal Walls --- */

/**
 * Place a painted-pixel-tree drywall partition with EITHER:
 *   - `kind: 'door'` (`1.34 m × 2.22 m` wood-framed interior doorway creating receding corridor vistas), OR
 *   - `kind: 'crawl'` (`1.34 m × 0.96 m` low wood-framed crouch-portal with solid wall above!).
 */
export function portalWall(c, cx, cz, alongX = true, opt = {}) {
  const { W, D, H, kit } = c;
  const span = opt.span ?? 3.6;
  const openW = opt.openW ?? 1.34;
  const kind = opt.kind || 'door';
  const openH = kind === 'crawl' ? 0.96 : 2.22;
  const topH = Math.min(H - 0.25, opt.h ?? 2.68);
  const halfT = 0.11;

  // Skip if too close to outer walls or doorways
  if (Math.abs(cx) > W / 2 - (alongX ? span * 0.5 + 0.4 : 1.2) || Math.abs(cz) > D / 2 - (alongX ? 1.2 : span * 0.5 + 0.4)) {
    return null;
  }
  for (const dr of c.room.doors) {
    const dp = c.doorPoint(dr, 0.55);
    if (Math.hypot(dp.x - cx, dp.z - cz) < span * 0.5 + 1.1) return null;
  }

  const wingLen = (span - openW) * 0.5;
  if (wingLen < 0.65) return null;

  const trim = [0.76, 0.73, 0.62];
  const variant = Math.abs(Math.round(cx * 5 + cz * 7)) % 3;
  const batch = c.mapped(`forest:occluder:drywall:${variant}`, paintedDrywallTex(kit, variant));

  if (alongX) {
    const xL0 = cx - span * 0.5, xL1 = cx - openW * 0.5;
    const xR0 = cx + openW * 0.5, xR1 = cx + span * 0.5;
    fullHeightWallBox(batch, c.flat, xL0, 0, cz - halfT, xL1, topH, cz + halfT);
    fullHeightWallBox(batch, c.flat, xR0, 0, cz - halfT, xR1, topH, cz + halfT);
    // Overhead lintel header across the doorway / crawl-hole!
    batch.box(xL1, openH, cz - halfT, xR0, topH, cz + halfT, WHITE, { uv: 2.2 });
    // Wood jambs & lintel frame
    c.flat.box(xL1 - 0.04, 0, cz - halfT - 0.015, xL1 + 0.04, openH + 0.05, cz + halfT + 0.015, trim, { skip: '-y' });
    c.flat.box(xR0 - 0.04, 0, cz - halfT - 0.015, xR0 + 0.04, openH + 0.05, cz + halfT + 0.015, trim, { skip: '-y' });
    c.flat.box(xL1 - 0.04, openH - 0.04, cz - halfT - 0.018, xR0 + 0.04, openH + 0.05, cz + halfT + 0.018, trim);
    c.solid(xL0, cz - halfT, xL1, cz + halfT, { tall: true });
    c.solid(xR0, cz - halfT, xR1, cz + halfT, { tall: true });
  } else {
    const zL0 = cz - span * 0.5, zL1 = cz - openW * 0.5;
    const zR0 = cz + openW * 0.5, zR1 = cz + span * 0.5;
    fullHeightWallBox(batch, c.flat, cx - halfT, 0, zL0, cx + halfT, topH, zL1);
    fullHeightWallBox(batch, c.flat, cx - halfT, 0, zR0, cx + halfT, topH, zR1);
    batch.box(cx - halfT, openH, zL1, cx + halfT, topH, zR0, WHITE, { uv: 2.2 });
    c.flat.box(cx - halfT - 0.015, 0, zL1 - 0.04, cx + halfT + 0.015, openH + 0.05, zL1 + 0.04, trim, { skip: '-y' });
    c.flat.box(cx - halfT - 0.015, 0, zR0 - 0.04, cx + halfT + 0.015, openH + 0.05, zR0 + 0.04, trim, { skip: '-y' });
    c.flat.box(cx - halfT - 0.018, openH - 0.04, zL1 - 0.04, cx + halfT + 0.018, openH + 0.05, zR0 + 0.04, trim);
    c.solid(cx - halfT, zL0, cx + halfT, zL1, { tall: true });
    c.solid(cx - halfT, zR0, cx + halfT, zR1, { tall: true });
  }

  c.reserve(cx, cz, span * 0.5 + 0.25);

  if (kind === 'crawl') {
    const prevHeadY = c.rt.headY;
    c.rt.headY = (x, z) => {
      const inOpening = alongX
        ? (Math.abs(x - cx) <= openW * 0.5 + 0.05 && Math.abs(z - cz) <= 0.32)
        : (Math.abs(z - cz) <= openW * 0.5 + 0.05 && Math.abs(x - cx) <= 0.32);
      if (inOpening) return 0.92;
      return prevHeadY ? prevHeadY(x, z) : (H - (c.rt.floorY ? c.rt.floorY(x, z) : 0));
    };
  }
  return { cx, cz };
}

/* ---- 4. Stage-Set Props: Cardboard Shrub Boxes, Birds, Peeled Turf & Ceiling Logs ---- */

/** Place 1–2 corrugated cardboard shipping boxes painted with green bushes + stepped grey rock! */
export function placeStageSetClutter(c, spots) {
  const { kit } = c;
  const det = ensureForestDetail(c);
  const boxBatch = c.mapped('forest:maze:cardboard-bush', cardboardBushTex(kit));
  const addCardboardBox = (bx0, bz0, bx1, by1, bz1, alb = WHITE) => {
    const uvSide = [[0, 0], [1, 0], [1, 1], [0, 1]];
    boxBatch.quad([bx0, 0, bz1], [bx1, 0, bz1], [bx1, by1, bz1], [bx0, by1, bz1], alb, uvSide);
    boxBatch.quad([bx1, 0, bz0], [bx0, 0, bz0], [bx0, by1, bz0], [bx1, by1, bz0], alb, uvSide);
    boxBatch.quad([bx1, 0, bz1], [bx1, 0, bz0], [bx1, by1, bz0], [bx1, by1, bz1], alb, uvSide);
    boxBatch.quad([bx0, 0, bz0], [bx0, 0, bz1], [bx0, by1, bz1], [bx0, by1, bz0], alb, uvSide);
    // Kraft top flaps with tan packing tape seam
    c.flat.box(bx0, by1 - 0.02, bz0, bx1, by1, bz1, [0.56, 0.42, 0.25]);
    c.flat.box(bx0, by1 + 0.001, (bz0 + bz1) * 0.5 - 0.04, bx1, by1 + 0.004, (bz0 + bz1) * 0.5 + 0.04, [0.74, 0.62, 0.42]);
  };
  for (let i = 0; i < spots.length; i++) {
    const [x, z] = spots[i];
    if (!c.clear(x, z, 0.55)) continue;
    const w = 0.82, h = 0.68, d = 0.58;
    addCardboardBox(x - w / 2, z - d / 2, x + w / 2, h, z + d / 2, WHITE);
    if (i % 2 === 0) {
      addCardboardBox(x + 0.44, z - 0.22, x + 0.92, 0.46, z + 0.24, [0.92, 0.90, 0.86]);
      c.solid(x - w / 2, z - d / 2, x + 0.92, z + d / 2);
      c.reserve(x + 0.2, z, 0.78);
    } else {
      c.solid(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
      c.reserve(x, z, 0.62);
    }
    c.blot(x, z, 1.35, 1.15, { rgb: [0.03, 0.04, 0.02], a: 0.48 });
    if ((c.rt._pendingDetTris || 0) < 185000) {
      det.pushVox({
        key: i % 2 === 0 ? 'forest:detail:shrub' : 'forest:detail:greyrock',
        make: i % 2 === 0 ? bushShrubVox() : steppedGreyRockVox(),
        x: x - 0.62,
        y: 0,
        z: z + 0.18,
        rot: i * 1.7,
        scale: 0.030,
      });
    }
  }
}

/** Suspend 2–3 corrugated-cardboard voxel birds on thin strings from the ceiling grid! */
export function hangCardboardBirds(c, cx, cz, count = 3) {
  const { H } = c;
  const det = ensureForestDetail(c);
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + 0.4;
    const bx = cx + Math.cos(ang) * (i === 0 ? 0.25 : 0.95);
    const bz = cz + Math.sin(ang) * (i === 0 ? 0.25 : 0.95);
    const by = H - 0.72 - (i % 2) * 0.34;
    if (by < 1.95) continue;
    // Thin white ceiling suspension strings
    det.arch.box(bx - 0.004, by + 0.04, bz - 0.004, bx + 0.004, H - 0.01, bz + 0.004, [0.82, 0.84, 0.80]);
    if ((c.rt._pendingDetTris || 0) < 190000) {
      det.pushVox({
        key: 'forest:detail:cardboard-bird',
        make: cardboardBirdVox(),
        x: bx,
        y: by,
        z: bz,
        rot: ang + 1.2,
        tilt: [0.08, -0.10],
        scale: 0.026,
      });
    }
  }
}

/** Buckled/peeled-up wave of moss carpet revealing scuffed beige office vinyl floor tiles underneath! */
export function peeledTurfStrip(c, cx, cz, alongX = true, len = 2.2) {
  const linoTex = c.kit.tex.custom('forest:maze:under-lino', 64, 64, (g, w, h) => {
    P(g, '#8c7858', 0, 0, w, h);
    for (let y = 0; y < h; y += 16) { P(g, '#66563d', 0, y, w, 1); }
    for (let x = 0; x < w; x += 16) { P(g, '#66563d', x, 0, 1, h); }
    for (let i = 0; i < 120; i++) P(g, i % 2 ? '#786548' : '#9e8968', Math.floor(hash(i * 3) * w), Math.floor(hash(i * 7) * h), 2, 2);
  });
  const lino = c.mapped('forest:maze:under-lino', linoTex);
  const hw = alongX ? len * 0.5 : 0.65, hd = alongX ? 0.65 : len * 0.5;
  lino.quad([cx - hw, 0.009, cz + hd], [cx + hw, 0.009, cz + hd], [cx + hw, 0.009, cz - hd], [cx - hw, 0.009, cz - hd], WHITE, [[0, 0], [2, 0], [2, 2], [0, 2]]);
  // Buckled moss-turf wave ridge arching 18 cm off the lino!
  const det = ensureForestDetail(c).arch;
  const turfTop = [0.16, 0.30, 0.14], backing = [0.48, 0.42, 0.32];
  for (let s = -3; s <= 3; s++) {
    const u0 = (s / 4) * 0.55, u1 = ((s + 1) / 4) * 0.55;
    const h0 = Math.max(0.015, Math.cos((s / 3.2) * 1.45) * 0.19);
    const h1 = Math.max(0.015, Math.cos(((s + 1) / 3.2) * 1.45) * 0.19);
    const ym = (h0 + h1) * 0.5;
    if (alongX) {
      det.box(cx - hw, ym, cz + u0, cx + hw, ym + 0.028, cz + u1, turfTop);
      det.box(cx - hw, Math.max(0.01, ym - 0.018), cz + u0, cx + hw, ym, cz + u1, backing);
    } else {
      det.box(cx + u0, ym, cz - hd, cx + u1, ym + 0.028, cz + hd, turfTop);
      det.box(cx + u0, Math.max(0.01, ym - 0.018), cz - hd, cx + u1, ym, cz + hd, backing);
    }
  }
}

/** Upside-down strip of moss turf glued to the ceiling + sideways dumbbell ceiling logs & hanging vines! */
export function ceilingTurfAndLogs(c, cx, cz, alongX = true, len = 4.4) {
  const { H } = c;
  const det = ensureForestDetail(c);
  const hw = alongX ? len * 0.5 : 0.72, hd = alongX ? 0.72 : len * 0.5;
  det.arch.box(cx - hw, H - 0.032, cz - hd, cx + hw, H - 0.006, cz + hd, [0.14, 0.27, 0.13]);
  for (const off of [-len * 0.28, len * 0.28]) {
    const lx = alongX ? cx + off : cx;
    const lz = alongX ? cz : cz + off;
    if ((c.rt._pendingDetTris || 0) < 185000) {
      det.pushVox({
        key: 'forest:detail:sideways-log',
        make: sidewaysCeilingLogVox(),
        x: lx,
        y: H - 0.02,
        z: lz,
        rot: alongX ? Math.PI * 0.5 : 0,
        scale: 0.032,
      });
    }
  }
}

/** Small glowing mint-green wall/pillar sconce lantern (`#52ffb0`) + optional light! */
export function mintWallSconce(c, x, y, z, withLight = false) {
  const sconceB = c.shining('forest:mint-sconce', c.kit.tex.white(), 2.1, [0.32, 1.0, 0.66]);
  sconceB.box(x - 0.045, y - 0.11, z - 0.045, x + 0.045, y + 0.11, z + 0.045, WHITE);
  c.flat.box(x - 0.055, y + 0.11, z - 0.055, x + 0.055, y + 0.14, z + 0.055, [0.22, 0.25, 0.24]);
  c.flat.box(x - 0.055, y - 0.14, z - 0.055, x + 0.055, y - 0.11, z + 0.055, [0.22, 0.25, 0.24]);
  if (withLight && c.rt.lights.length < 15) {
    c.light(x, y, z, '#52ffb0', 0.48, { bank: 3, k: 1.5, far: 4.8 });
  }
}

/* ---- 5. Concentric Stage-Set & Woodland Blind-Corner Labyrinth Ring ------ */

export function buildBlindRingMaze(c, opt = {}) {
  const { W, D } = c;
  const style = opt.style || 'drywall';
  const altStyle = opt.outerStyle || 'hedge';
  const thick = style === 'drywall' ? 0.22 : (opt.thick ?? 0.46);
  const rInner = opt.rInner ?? 2.55;
  const keepClear = opt.keepClear || [];

  const cx = opt.cx ?? 0, cz = opt.cz ?? 0;
  const ix = Math.min(W * 0.25, rInner + 0.55);
  const iz = Math.min(D * 0.25, rInner + 0.55);

  // Inner 4-sided broken enclosure with offset gaps + glowing mint sconces on corners!
  const wN = occluderWall(c, cx - ix, cz - iz - thick * 0.5, cx + ix * 0.34, cz - iz + thick * 0.5, { style, keepClear, h: opt.h });
  const wS = occluderWall(c, cx - ix * 0.34, cz + iz - thick * 0.5, cx + ix, cz + iz + thick * 0.5, { style, keepClear, h: opt.h });
  occluderWall(c, cx - ix - thick * 0.5, cz - iz * 0.28, cx - ix + thick * 0.5, cz + iz, { style: altStyle, keepClear, h: opt.h });
  occluderWall(c, cx + ix - thick * 0.5, cz - iz, cx + ix + thick * 0.5, cz + iz * 0.28, { style: altStyle, keepClear, h: opt.h });

  if (wN) mintWallSconce(c, wN.x1 - 0.15, 1.58, wN.z1 + 0.06, true);
  if (wS) mintWallSconce(c, wS.x0 + 0.15, 1.58, wS.z0 - 0.06, false);

  // Outer framed doorway portal + crouch crawl-portal + cardboard stage-set clutter!
  if (W >= 15.0 && D >= 15.0 && opt.outer !== false) {
    const ox = W * 0.35, oz = D * 0.35;
    portalWall(c, 0, oz * 1.04, true, { kind: 'door', span: 3.5, h: opt.h ?? 2.65 });
    portalWall(c, ox * 1.02, 0, false, { kind: 'crawl', span: 3.4, h: opt.h ?? 2.62 });
    occluderWall(c, -ox - 1.1, -oz - 0.12, -ox + 1.25, -oz + 0.12, { style: 'drywall', keepClear, h: opt.h });
    occluderWall(c, -ox - 0.12, oz - 1.25, -ox + 0.12, oz + 1.0, { style: altStyle, keepClear, h: opt.h });

    placeStageSetClutter(c, [[-ix + 0.4, iz + 0.65], [ix - 0.4, -iz - 0.65]]);
    hangCardboardBirds(c, -ox * 0.45, oz * 0.45, 3);
    ceilingTurfAndLogs(c, ox * 0.42, -oz * 0.42, true, 3.8);
    peeledTurfStrip(c, 0.85, oz * 0.72, true, 2.1);
  }
}

/* ---- 6. Drifting Corridor Mist / Spore Veil Curtains (`detail: true`) ---- */

const VEIL_VERT = `
varying vec2 vUv;
varying vec3 vView;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const VEIL_FRAG = `
uniform vec3 uMistCol;
uniform float uMistAlpha;
uniform float uMistTime;
uniform float uDim;
varying vec2 vUv;
varying vec3 vView;
void main() {
  float dist = length(vView);
  float nearPart = smoothstep(0.65, 2.85, dist);
  float edgeX = sin(vUv.x * 3.14159265);
  float edgeY = sin(vUv.y * 3.14159265);
  float swirl = 0.62 + 0.38 * sin(vUv.x * 9.0 + uMistTime * 0.55) * cos(vUv.y * 7.0 - uMistTime * 0.42);
  float a = edgeX * edgeY * swirl * uMistAlpha * nearPart * clamp(uDim + 0.25, 0.35, 1.0);
  if (a < 0.01) discard;
  gl_FragColor = vec4(uMistCol, a);
}`;

export function addMistVeils(c, segments, opt = {}) {
  // Off. The veils were flat upright cards of one colour: pale panels standing in the lane of a dark room, dark blotches
  // in a lit one, gone as you walked up to them (the owner: "the lighting and fog effects need work";
  // docs/FOREST-REVIEW.md §2). Thirteen rooms still call this, and get nothing, so that a room which earns mist can ask
  // for it again with `opt.force` once there is a mist worth having (a height band of the camcorder's own haze).
  if (!opt.force) return null;
  if (!segments?.length) return null;
  const { H, kit } = c;
  const pos = [], uv = [], idx = [];
  for (const seg of segments) {
    const y0 = seg.y0 ?? 0.05;
    const y1 = Math.min(H - 0.08, seg.y1 ?? 2.55);
    const base = pos.length / 3;
    pos.push(seg.x0, y0, seg.z0, seg.x1, y0, seg.z1, seg.x1, y1, seg.z1, seg.x0, y1, seg.z0);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  if (!idx.length) return null;

  const uTime = { value: 0 };
  const col = opt.color || [0.07, 0.14, 0.09];

  c.after.push(() => {
    const geo = kit.own(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();

    let mat;
    if (gpu.nodes) {
      const N = gpu.nodes, T = N.TSL;
      const { Fn, vec4, float, uniform, uv, length, sin, cos, clamp, If, Discard, positionView } = T;
      const ss = (e0, e1, x) => { const t = clamp(float(x).sub(e0).div(e1 - e0), 0, 1); return t.mul(t).mul(t.mul(-2).add(3)); };
      mat = kit.own(new N.NodeMaterial());
      mat.transparent = true; mat.depthWrite = false; mat.side = THREE.DoubleSide;
      mat.uniforms = {
        uMistCol: { value: new THREE.Vector3(col[0], col[1], col[2]) },
        uMistAlpha: { value: opt.alpha ?? 0.64 },
        uMistTime: uTime,
        uDim: c.rt.u.dim,
      };
      const uMistCol = uniform(new N.Vector3(col[0], col[1], col[2])).onRenderUpdate(() => { uMistCol.value.copy(mat.uniforms.uMistCol.value); });
      const uMistAlpha = uniform(opt.alpha ?? 0.64).onRenderUpdate(() => mat.uniforms.uMistAlpha.value);
      const uMistTime = uniform(0).onRenderUpdate(() => mat.uniforms.uMistTime.value);
      const uDim = uniform(1).onRenderUpdate(() => mat.uniforms.uDim.value);
      mat.fragmentNode = Fn(() => {
        const vUv = uv();
        const nearPart = ss(0.65, 2.85, length(positionView));
        const edgeX = sin(vUv.x.mul(3.14159265)), edgeY = sin(vUv.y.mul(3.14159265));
        const swirl = sin(vUv.x.mul(9).add(uMistTime.mul(0.55))).mul(cos(vUv.y.mul(7).sub(uMistTime.mul(0.42)))).mul(0.38).add(0.62);
        const a = edgeX.mul(edgeY).mul(swirl).mul(uMistAlpha).mul(nearPart).mul(clamp(uDim.add(0.25), 0.35, 1.0));
        If(a.lessThan(0.01), () => { Discard(); });
        return vec4(uMistCol, a);
      })();
    } else {
      mat = kit.own(new THREE.ShaderMaterial({
        vertexShader: VEIL_VERT,
        fragmentShader: VEIL_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uMistCol: { value: new THREE.Vector3(col[0], col[1], col[2]) },
          uMistAlpha: { value: opt.alpha ?? 0.64 },
          uMistTime: uTime,
          uDim: c.rt.u.dim,
        },
      }));
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `forest:detail-mist:${c.room.id}`;
    mesh.userData.detail = true;
    mesh.renderOrder = 3;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    c.rt.group.add(mesh);
  });

  c.tick((_dt, t) => { uTime.value = t; });
  return { uTime };
}

/* ---- 7. Pacific Northwest Stepped Rock / Dirt / Moss Voxel Hills ---------- */

/**
 * Wet Pacific Northwest fractured basalt & granite cliff texture (`128×128`)
 * with blocky stone courses, cool slate highlights, crustose lichen, and
 * dark-emerald moss cushions clinging to rock crevices.
 */
export function pnwRockTex(kit) {
  return kit.tex.custom('forest:pnw:rock', 128, 128, (g, w, h) => {
    P(g, '#393e40', 0, 0, w, h);
    // Blocky voxel stone courses (`16px` tall courses, staggered joints)
    const stones = ['#323739', '#41474a', '#4d5457', '#2b2f31', '#575f62'];
    for (let row = 0; row < 8; row++) {
      const y0 = row * 16;
      const shift = (row % 2) * 14 + Math.floor(hash(row * 17.3) * 8);
      for (let col = -1; col < 6; col++) {
        const x0 = col * 26 + shift;
        const sw = 24 + (col % 2) * 2;
        const shade = stones[Math.floor(hash(row * 7.1 + col * 13.7) * stones.length)];
        P(g, shade, x0 + 1, y0 + 1, sw - 1, 14);
        P(g, '#646d70', x0 + 2, y0 + 1, sw - 3, 2); // top stone highlight bevel
        P(g, '#212426', x0, y0 + 15, sw + 1, 1);     // horizontal mortar/fracture crease
        P(g, '#212426', x0, y0, 1, 16);              // vertical fracture seam
      }
    }
    // Fine granite speckle & wet rainwater seepage streaks
    for (let i = 0; i < 900; i++) {
      const x = Math.floor(hash(i * 3.9 + 5) * w);
      const y = Math.floor(hash(i * 8.3 + 11) * h);
      P(g, i % 3 === 0 ? '#25292b' : i % 3 === 1 ? '#5c6467' : '#3d4345', x, y, 2, 2);
    }
    // Pale green lichen & lush emerald Pacific Northwest moss cushions in upper crevices!
    for (let i = 0; i < 240; i++) {
      const x = Math.floor(hash(i * 5.7 + 23) * w);
      const y = Math.floor(Math.pow(hash(i * 4.1 + 7), 1.35) * h);
      const col = i % 5 === 0 ? '#748a66' : i % 2 === 0 ? '#234a20' : '#35692e';
      P(g, col, x, y, 4 + (i % 3) * 2, 3 + (i % 2) * 2);
    }
  });
}

/**
 * Stepped voxel Pacific Northwest forest dirt / cedar-loam riser (`128×128`):
 * Top `26%` (`y = 0..33`, `t = 0.74..1.0`) is a thick, blocky emerald moss-turf
 * overhang lip; lower `74%` is rich damp brown loam studded with grey river
 * pebbles and twisted cedar rootlets!
 */
export function pnwDirtTex(kit) {
  return kit.tex.custom('forest:pnw:dirt', 128, 128, (g, w, h) => {
    // Rich dark damp PNW forest soil base (`y = 0..128`)
    P(g, '#3b2617', 0, 0, w, h);
    const soils = ['#2e1d11', '#472f1d', '#543823', '#332013', '#614129'];
    for (let i = 0; i < 1600; i++) {
      const x = Math.floor(hash(i * 4.3 + 3) * w);
      const y = Math.floor(hash(i * 7.9 + 17) * h);
      P(g, soils[i % soils.length], x, y, 4, 4);
    }
    // Embedded grey river pebbles & stones (`y = 34..122`)
    for (let i = 0; i < 48; i++) {
      const px = Math.floor(hash(i * 11.3 + 9) * (w - 8));
      const py = 36 + Math.floor(hash(i * 6.7 + 21) * (h - 42));
      P(g, i % 2 ? '#5d6361' : '#737a77', px, py, 6, 4);
      P(g, '#8a918e', px + 1, py, 4, 1);
    }
    // Twisted orange-brown cedar rootlets threading through the loam
    for (let r = 0; r < 14; r++) {
      let rx = Math.floor(hash(r * 19.1) * w);
      let ry = 28 + Math.floor(hash(r * 7.3) * 24);
      for (let s = 0; s < 9; s++) {
        P(g, s % 2 ? '#6e4726' : '#825630', (rx + w) % w, ry, 4, 3);
        rx += Math.floor((hash(r * 31 + s * 5) - 0.48) * 7);
        ry += 4;
      }
    }
    // Thick blocky voxel emerald moss-turf overhang lip at top of step (`y = 0..34`)!
    const PX = 4;
    for (let cx = 0; cx < w / PX; cx++) {
      const hang = 5 + Math.floor(hash(cx * 5.9 + 2.1) * 4); // `20..36 px` overhang
      // Dark shadow crease directly under the overhanging moss lip
      P(g, '#1c1109', cx * PX, hang * PX, PX, PX);
      for (let cy = 0; cy < hang; cy++) {
        const col = cy === 0 ? '#467d39' : cy < 3 ? '#33632a' : cy === hang - 1 ? '#1b3b19' : '#264d21';
        P(g, col, cx * PX, cy * PX, PX, PX);
      }
    }
  });
}

/**
 * Velvety Pacific Northwest moss-and-fir-needle terrace cap (`128×128`) with
 * emerald moss cushions, fallen golden-brown Douglas-fir needles, and wood sorrel.
 */
export function pnwMossCapTex(kit) {
  return kit.tex.custom('forest:pnw:mosscap', 128, 128, (g, w, h) => {
    P(g, '#21421e', 0, 0, w, h);
    const mosses = ['#193617', '#274f23', '#32612b', '#3e7334', '#142b13'];
    for (let i = 0; i < 1800; i++) {
      const x = Math.floor(hash(i * 3.7 + 13) * w);
      const y = Math.floor(hash(i * 6.9 + 29) * h);
      P(g, mosses[i % mosses.length], x, y, 4, 4);
    }
    // Fallen golden-brown Douglas-fir needles & tiny pale-green oxalis clover specks
    for (let i = 0; i < 180; i++) {
      const x = Math.floor(hash(i * 9.1 + 4) * w);
      const y = Math.floor(hash(i * 5.3 + 19) * h);
      if (i % 6 === 0) {
        P(g, '#6ca356', x, y, 3, 3);
      } else {
        P(g, i % 2 ? '#5c4324' : '#4a351c', x, y, 5, 1);
      }
    }
  });
}

/**
 * Generates multi-tiered voxel Pacific Northwest rock, cedar-loam dirt, and
 * moss-turf hills & cliff embankments (`buildPnwTerrain`) inside room `c`:
 *   - Fills dead perimeter corners & interior pockets with stepped voxel hills
 *     (`0.32 m` vertical blocks, up to `1.92–2.35 m` tall) while keeping every
 *     doorway, walking lane, puzzle, and stash 100% open (`said: []`).
 *   - Greedy-merges top caps and vertical risers into `2–3` shared room batches
 *     with per-vertex step-crevice AO (`0.52` in creases, `1.0` on lips).
 *   - Registers `tall: true` colliders on eye-level hills (`>= 1.45 m`) to
 *     obscure entities around rocky bends, and exposes `c.rt.pnwTopAt(x, z)` so
 *     `thicket()` plants conifers, hemlocks, nurse stumps, boulders, and giant
 *     sword ferns directly ON TOP of the stepped hills!
 */
export function buildPnwTerrain(c, opt = {}) {
  const { W, D, H, R, kit, room } = c;
  if (room.crawl || Math.min(W, D) < 5.0) return { mounds: 0, tris: 0, cells: 0 };
  c.rt._pnwBuilt = true;

  const cell = opt.cell ?? 0.48;
  const stepH = opt.stepH ?? 0.32;
  const style = opt.style || 'rainforest'; // 'rainforest' | 'rocky' | 'peat' | 'scorched' | 'excavated'
  const maxTierCap = Math.max(2, Math.min(8, Math.floor((opt.maxHeight ?? Math.min(2.24, H - 0.85)) / stepH)));
  const nx = Math.max(4, Math.floor((W - 0.12) / cell));
  const nz = Math.max(4, Math.floor((D - 0.12) / cell));
  const xStart = -(nx * cell) * 0.5;
  const zStart = -(nz * cell) * 0.5;
  const cxOf = (gx) => xStart + (gx + 0.5) * cell;
  const czOf = (gz) => zStart + (gz + 0.5) * cell;

  // Snapshot existing colliders in room-local space with a `0.95 m` walkway buffer so
  // hills never pinch or seal off a passage around an `occluderWall` or stair landing!
  const existingCols = c.rt.colliders.map((col) => {
    const a = c.toLocal(col.x0, col.z0), b = c.toLocal(col.x1, col.z1);
    return {
      x0: Math.min(a.x, b.x) - 0.95,
      z0: Math.min(a.z, b.z) - 0.95,
      x1: Math.max(a.x, b.x) + 0.95,
      z1: Math.max(a.z, b.z) + 0.95,
    };
  });
  const keepClear = opt.keepClear || [];
  const region = opt.region || (() => true);
  const doorClear = opt.doorClear ?? 1.80;
  const laneClear = opt.laneClear ?? 0.72;

  // 1. Precompute safe mask `safe[gx + gz * nx]` (1 = allowed for hill blocks)
  const safe = new Uint8Array(nx * nz);
  const ceilMaxTier = new Uint8Array(nx * nz);
  for (let gz = 0; gz < nz; gz++) {
    const cz = czOf(gz);
    const innerZ = clamp(cz, -D * 0.5 + 0.62, D * 0.5 - 0.62);
    for (let gx = 0; gx < nx; gx++) {
      const idx = gx + gz * nx;
      const cx = cxOf(gx);
      if (!region(cx, cz)) continue;
      if (!fitsAt(room, cx, cz, 0.08) || Math.abs(c.floorAt(cx, cz)) > 0.03) continue;

      // Generous clear apron around every doorway & window
      let nearDoor = false;
      for (const dr of room.doors) {
        const dp = c.doorPoint(dr, 0.55);
        if (Math.hypot(cx - dp.x, cz - dp.z) < dr.w * 0.5 + doorClear) { nearDoor = true; break; }
      }
      if (nearDoor) continue;
      for (const wn of room.wins || []) {
        const wp = c.doorPoint(wn, 0.30);
        if (Math.hypot(cx - wp.x, cz - wp.z) < wn.w * 0.5 + 0.95) { nearDoor = true; break; }
      }
      if (nearDoor) continue;

      // Respect all `c.reserve(...)` walking lanes, hubs, Spotter corners & stashes
      const innerX = clamp(cx, -W * 0.5 + 0.62, W * 0.5 - 0.62);
      if (!c.clear(innerX, innerZ, laneClear)) continue;

      let blocked = false;
      for (const [kx, kz, kr] of keepClear) {
        if (Math.hypot(cx - kx, cz - kz) < kr + cell * 0.55) { blocked = true; break; }
      }
      if (blocked) continue;
      for (const col of existingCols) {
        if (cx > col.x0 - cell * 0.42 && cx < col.x1 + cell * 0.42 && cz > col.z0 - cell * 0.42 && cz < col.z1 + cell * 0.42) {
          blocked = true; break;
        }
      }
      if (blocked) continue;

      const cTop = c.ceilAt(cx, cz);
      const tLim = Math.min(maxTierCap, Math.floor((cTop - 0.65) / stepH));
      if (tLim < 1) continue;
      safe[idx] = 1;
      ceilMaxTier[idx] = tLim;
    }
  }

  // 2. Seed Pacific Northwest perimeter mountain embankments + interior rocky/mossy hill islands!
  const area = W * D;
  const density = opt.density ?? 1.0;
  const nPerim = opt.perimeterMounds ?? Math.max(3, Math.round((area / 28) * density));
  const nIslands = opt.islandMounds ?? Math.max(2, Math.round((area / 36) * density));
  const lobes = [];

  // Perimeter embankments hugging walls & corners (erases empty perimeter floor!)
  for (let i = 0, tries = 0; i < nPerim && tries < nPerim * 10; tries++) {
    const edge = tries % 4;
    const lx = edge === 0 ? -W * 0.47 : edge === 1 ? W * 0.47 : R.range(-W * 0.44, W * 0.44);
    const lz = edge === 2 ? -D * 0.47 : edge === 3 ? D * 0.47 : R.range(-D * 0.44, D * 0.44);
    const gx = clamp(Math.floor((lx - xStart) / cell), 0, nx - 1);
    const gz = clamp(Math.floor((lz - zStart) / cell), 0, nz - 1);
    if (!safe[gx + gz * nx]) continue;
    const rx = R.range(1.55, Math.min(3.8, W * 0.28));
    const rz = R.range(1.55, Math.min(3.8, D * 0.28));
    const peak = R.int(Math.min(3, maxTierCap), maxTierCap);
    const rocky = style === 'rocky' ? R.chance(0.82) : style === 'rainforest' ? R.chance(0.42) : style === 'scorched';
    lobes.push({ x: cxOf(gx), z: czOf(gz), rx, rz, peak, rocky, phase: R.range(0, 6.28) });
    i++;
  }

  // Interior multi-lobed hill islands & mossy basalt crags (creates winding canyon trails & sightline blocks!)
  for (let i = 0, tries = 0; i < nIslands && tries < nIslands * 14; tries++) {
    const gx = R.int(2, nx - 3), gz = R.int(2, nz - 3);
    if (!safe[gx + gz * nx]) continue;
    const rx = R.range(1.25, Math.min(3.1, W * 0.23));
    const rz = R.range(1.25, Math.min(3.1, D * 0.23));
    const peak = R.int(Math.min(3, maxTierCap), Math.max(3, maxTierCap - (R.chance(0.35) ? 0 : 1)));
    const rocky = style === 'rocky' ? R.chance(0.85) : style === 'rainforest' ? R.chance(0.48) : style === 'scorched';
    lobes.push({ x: cxOf(gx), z: czOf(gz), rx, rz, peak, rocky, phase: R.range(0, 6.28) });
    i++;
  }

  if (!lobes.length) return { mounds: 0, tris: 0, cells: 0 };

  // 3. Evaluate height grid `tier[idx]` (`0..maxTierCap`) and `rockCell[idx]` (`0` = dirt/moss, `1` = basalt rock)
  const tier = new Uint8Array(nx * nz);
  const rockCell = new Uint8Array(nx * nz);
  for (let gz = 0; gz < nz; gz++) {
    const cz = czOf(gz);
    for (let gx = 0; gx < nx; gx++) {
      const idx = gx + gz * nx;
      if (!safe[idx]) continue;
      const cx = cxOf(gx);
      let hVal = 0;
      let rockVote = 0;
      for (let k = 0; k < lobes.length; k++) {
        const L = lobes[k];
        const dx = (cx - L.x) / L.rx, dz = (cz - L.z) / L.rz;
        const warp = 0.16 * Math.sin(cx * 1.55 + L.phase) * Math.cos(cz * 1.45 - L.phase);
        const d2 = dx * dx + dz * dz + warp;
        if (d2 >= 1.0) continue;
        const v = (1.0 - d2) * (L.peak + 0.55);
        if (v > hVal) {
          hVal = v;
          rockVote = L.rocky ? 1 : (hash(gx * 7.3 + gz * 13.1 + k * 5.7) > 0.68 ? 1 : 0);
        }
      }
      const t = Math.min(ceilMaxTier[idx], Math.floor(hVal));
      if (t >= 1) {
        tier[idx] = t;
        rockCell[idx] = style === 'excavated'
          ? (hash(gx * 5.1 + gz * 9.7) > 0.62 ? 1 : 0)
          : rockVote;
      }
    }
  }

  // Prune isolated single-cell spikes (`0` orthogonal neighbors >= 1) so hills read as cohesive voxel landforms
  let filledCells = 0;
  for (let gz = 0; gz < nz; gz++) {
    for (let gx = 0; gx < nx; gx++) {
      const idx = gx + gz * nx;
      const t = tier[idx];
      if (!t) continue;
      const nUp = (gx > 0 && tier[idx - 1] > 0 ? 1 : 0)
        + (gx + 1 < nx && tier[idx + 1] > 0 ? 1 : 0)
        + (gz > 0 && tier[idx - nx] > 0 ? 1 : 0)
        + (gz + 1 < nz && tier[idx + nx] > 0 ? 1 : 0);
      if (nUp === 0 && t < 2) { tier[idx] = 0; continue; }
      filledCells++;
    }
  }
  if (!filledCells) return { mounds: 0, tris: 0, cells: 0 };

  // Palette tints by terrain biome style
  const rockTint = style === 'scorched'
    ? [0.34, 0.31, 0.30]
    : style === 'peat'
      ? [0.62, 0.68, 0.64]
      : WHITE;
  const dirtTint = style === 'scorched'
    ? [0.32, 0.28, 0.26]
    : style === 'excavated'
      ? [0.95, 0.82, 0.68]
      : style === 'peat'
        ? [0.64, 0.68, 0.58]
        : WHITE;
  const mossTint = style === 'peat'
    ? [0.76, 0.86, 0.70]
    : WHITE;

  const rockB = c.mapped('forest:pnw:rock', pnwRockTex(kit));
  const dirtB = c.mapped('forest:pnw:dirt', pnwDirtTex(kit));
  const mossB = c.mapped('forest:pnw:moss', pnwMossCapTex(kit));
  const trisBefore = (rockB.idx.length + dirtB.idx.length + mossB.idx.length) / 3;

  const tierAt = (gx, gz) => (gx < 0 || gz < 0 || gx >= nx || gz >= nz ? 0 : tier[gx + gz * nx]);

  // 4. Greedy-merge horizontal top caps (`+y` at `y = t * stepH`)
  // Cap material: `0` = mossCap, `1` = bare mossy basalt rock, `2` = raw excavated/scorched dirt
  const capKind = new Uint8Array(nx * nz);
  for (let gz = 0; gz < nz; gz++) {
    for (let gx = 0; gx < nx; gx++) {
      const idx = gx + gz * nx;
      if (!tier[idx]) continue;
      if (style === 'scorched') {
        capKind[idx] = 1;
      } else if (style === 'excavated') {
        capKind[idx] = rockCell[idx] ? 1 : 2;
      } else if (rockCell[idx]) {
        // On rocky outcrops: ~55% bare weathered grey stone step tops, ~45% emerald moss cushion caps!
        capKind[idx] = hash(gx * 11.7 + gz * 17.3 + room.id) < 0.55 ? 1 : 0;
      } else {
        capKind[idx] = 0;
      }
    }
  }

  const usedCap = new Uint8Array(nx * nz);
  for (let gz = 0; gz < nz; gz++) {
    for (let gx = 0; gx < nx; gx++) {
      const idx = gx + gz * nx;
      const t = tier[idx];
      if (!t || usedCap[idx]) continue;
      const ck = capKind[idx];
      let wRun = 1;
      while (gx + wRun < nx) {
        const i2 = (gx + wRun) + gz * nx;
        if (usedCap[i2] || tier[i2] !== t || capKind[i2] !== ck) break;
        wRun++;
      }
      let dRun = 1;
      outerCap: while (gz + dRun < nz) {
        for (let dx = 0; dx < wRun; dx++) {
          const i2 = (gx + dx) + (gz + dRun) * nx;
          if (usedCap[i2] || tier[i2] !== t || capKind[i2] !== ck) break outerCap;
        }
        dRun++;
      }
      for (let dz = 0; dz < dRun; dz++) {
        for (let dx = 0; dx < wRun; dx++) usedCap[(gx + dx) + (gz + dz) * nx] = 1;
      }

      const x0 = xStart + gx * cell, x1 = x0 + wRun * cell;
      const z0 = zStart + gz * cell, z1 = z0 + dRun * cell;
      const yTop = t * stepH;
      const targetB = ck === 1 ? rockB : ck === 2 ? dirtB : mossB;
      const alb = ck === 1 ? rockTint : ck === 2 ? dirtTint : mossTint;
      // Per-vertex crevice AO when a neighboring cell steps HIGHER right next to this terrace!
      const aoTop = (u, v) => {
        const wx = x0 + u, wz = z1 - v;
        const sx = clamp(Math.floor((wx - xStart) / cell), 0, nx - 1);
        const sz = clamp(Math.floor((wz - zStart) / cell), 0, nz - 1);
        const higher = tierAt(sx - 1, sz) > t || tierAt(sx + 1, sz) > t || tierAt(sx, sz - 1) > t || tierAt(sx, sz + 1) > t;
        return higher ? 0.62 : 1.0;
      };
      targetB.grid(
        [x0, yTop, z1], [1, 0, 0], [0, 0, -1],
        ticks(x1 - x0, cell, 0), ticks(z1 - z0, cell, 0),
        ck === 2 ? (u, v) => [(x0 + u) / 0.96, 0.08 + (((z1 - v) / 0.96) % 0.55 + 0.55) % 0.55] : (u, v) => [(x0 + u) / 0.96, (z1 - v) / 0.96],
        alb,
        aoTop
      );
      if (t === 1 && (gx + gz) % 2 === 0) {
        c.blot((x0 + x1) * 0.5, (z0 + z1) * 0.5, (x1 - x0) + 0.55, (z1 - z0) + 0.55, { rgb: [0.04, 0.05, 0.03], a: 0.42 });
      }
    }
  }

  // 5. Emit vertical risers (`+z`, `-z`, `+x`, `-x`) with greedy horizontal run merging!
  const emitRiserRun = (face, fixedCoord, span0, span1, lowT, highT, isRockFace) => {
    const len = span1 - span0;
    const makeFace = (batch, y0, y1, alb, uvFn, creaseBottom) => {
      const h = y1 - y0;
      if (h <= 0.001) return;
      const aoFn = (_u, v) => (creaseBottom && v < 0.02 ? 0.52 : 0.72 + 0.28 * (v / h));
      const us = ticks(len, cell, 0), vs = [0, h];
      if (face === '+z') {
        batch.grid([span0, y0, fixedCoord], [1, 0, 0], [0, 1, 0], us, vs, (u, v) => uvFn(span0 + u, v, y0), alb, aoFn);
      } else if (face === '-z') {
        batch.grid([span1, y0, fixedCoord], [-1, 0, 0], [0, 1, 0], us, vs, (u, v) => uvFn(span1 - u, v, y0), alb, aoFn);
      } else if (face === '+x') {
        batch.grid([fixedCoord, y0, span1], [0, 0, -1], [0, 1, 0], us, vs, (u, v) => uvFn(span1 - u, v, y0), alb, aoFn);
      } else {
        batch.grid([fixedCoord, y0, span0], [0, 0, 1], [0, 1, 0], us, vs, (u, v) => uvFn(span0 + u, v, y0), alb, aoFn);
      }
    };

    if (isRockFace || style === 'scorched') {
      makeFace(rockB, lowT * stepH, highT * stepH, rockTint, (uWorld, v, y0) => [uWorld / 0.96, (y0 + v) / 0.96], true);
    } else if (style === 'excavated') {
      // Raw churned soil without green moss lip (`t = 0.05..0.68` per step)
      for (let kt = lowT; kt < highT; kt++) {
        makeFace(dirtB, kt * stepH, (kt + 1) * stepH, dirtTint, (uWorld, v) => [uWorld / 0.64, 0.05 + (v / stepH) * 0.63], kt === lowT);
      }
    } else {
      // Realistic PNW geology: fractured grey mossy basalt bedrock on lower cliff drop (`lowT .. highT - 1`),
      // crowned by rich cedar-loam soil + overhanging emerald moss-turf lip on the top step (`highT - 1 .. highT`)!
      if (highT - 1 > lowT) {
        makeFace(rockB, lowT * stepH, (highT - 1) * stepH, rockTint, (uWorld, v, y0) => [uWorld / 0.96, (y0 + v) / 0.96], true);
      }
      makeFace(
        dirtB,
        (highT - 1) * stepH,
        highT * stepH,
        dirtTint,
        (uWorld, v) => [uWorld / 0.64, 0.06 + (v / stepH) * 0.94],
        highT - 1 === lowT
      );
    }
  };

  // `+z` and `-z` risers (scanning along `gx`)
  for (let gz = 0; gz < nz; gz++) {
    for (const [dir, face, zPlane] of [[1, '+z', zStart + (gz + 1) * cell], [-1, '-z', zStart + gz * cell]]) {
      let gx = 0;
      while (gx < nx) {
        const idx = gx + gz * nx;
        const hi = tier[idx], lo = tierAt(gx, gz + dir);
        if (hi <= lo) { gx++; continue; }
        const rk = rockCell[idx] || capKind[idx] === 1 ? 1 : 0;
        let run = 1;
        while (gx + run < nx) {
          const i2 = (gx + run) + gz * nx;
          const rk2 = rockCell[i2] || capKind[i2] === 1 ? 1 : 0;
          if (tier[i2] !== hi || tierAt(gx + run, gz + dir) !== lo || rk2 !== rk) break;
          run++;
        }
        emitRiserRun(face, zPlane, xStart + gx * cell, xStart + (gx + run) * cell, lo, hi, rk === 1);
        gx += run;
      }
    }
  }

  // `+x` and `-x` risers (scanning along `gz`)
  for (let gx = 0; gx < nx; gx++) {
    for (const [dir, face, xPlane] of [[1, '+x', xStart + (gx + 1) * cell], [-1, '-x', xStart + gx * cell]]) {
      let gz = 0;
      while (gz < nz) {
        const idx = gx + gz * nx;
        const hi = tier[idx], lo = tierAt(gx + dir, gz);
        if (hi <= lo) { gz++; continue; }
        const rk = rockCell[idx] || capKind[idx] === 1 ? 1 : 0;
        let run = 1;
        while (gz + run < nz) {
          const i2 = gx + (gz + run) * nx;
          const rk2 = rockCell[i2] || capKind[i2] === 1 ? 1 : 0;
          if (tier[i2] !== hi || tierAt(gx + dir, gz + run) !== lo || rk2 !== rk) break;
          run++;
        }
        emitRiserRun(face, xPlane, zStart + gz * cell, zStart + (gz + run) * cell, lo, hi, rk === 1);
        gz += run;
      }
    }
  }

  const emittedTris = (rockB.idx.length + dirtB.idx.length + mossB.idx.length) / 3 - trisBefore;
  c.rt._pendingOrdTris = (c.rt._pendingOrdTris || 0) + emittedTris;

  // 6. Greedy-merge `c.solid` boxes (`tall: true` where `tier * stepH >= 1.45 m` so tall hills block `world.los`!)
  const tallMinTier = Math.max(2, Math.ceil(1.45 / stepH));
  for (const passTall of [true, false]) {
    const usedCol = new Uint8Array(nx * nz);
    for (let gz = 0; gz < nz; gz++) {
      for (let gx = 0; gx < nx; gx++) {
        const idx = gx + gz * nx;
        const t = tier[idx];
        const match = passTall ? t >= tallMinTier : (t >= 1 && t < tallMinTier);
        if (!match || usedCol[idx]) continue;
        let wRun = 1;
        while (gx + wRun < nx) {
          const i2 = (gx + wRun) + gz * nx;
          const t2 = tier[i2];
          const m2 = passTall ? t2 >= tallMinTier : (t2 >= 1 && t2 < tallMinTier);
          if (!m2 || usedCol[i2]) break;
          wRun++;
        }
        let dRun = 1;
        outerCol: while (gz + dRun < nz) {
          for (let dx = 0; dx < wRun; dx++) {
            const i2 = (gx + dx) + (gz + dRun) * nx;
            const t2 = tier[i2];
            const m2 = passTall ? t2 >= tallMinTier : (t2 >= 1 && t2 < tallMinTier);
            if (!m2 || usedCol[i2]) break outerCol;
          }
          dRun++;
        }
        let maxRectT = t;
        for (let dz = 0; dz < dRun; dz++) {
          for (let dx = 0; dx < wRun; dx++) {
            const i2 = (gx + dx) + (gz + dz) * nx;
            usedCol[i2] = 1;
            if (tier[i2] > maxRectT) maxRectT = tier[i2];
          }
        }
        const x0 = xStart + gx * cell, x1 = x0 + wRun * cell;
        const z0 = zStart + gz * cell, z1 = z0 + dRun * cell;
        c.solid(x0, z0, x1, z1, { tall: passTall, top: maxRectT * stepH });
      }
    }
  }

  // 7. Expose `c.rt.pnwTopAt(x, z)` so `thicket()` plants conifers, hemlocks, nurse stumps,
  //    boulders, saplings, and sword ferns directly ON TOP of the stepped PNW hills!
  const prevTopAt = c.rt.pnwTopAt;
  c.rt.pnwTopAt = (x, z) => {
    const gx = Math.floor((x - xStart) / cell);
    const gz = Math.floor((z - zStart) / cell);
    const hHere = gx >= 0 && gz >= 0 && gx < nx && gz < nz ? tier[gx + gz * nx] * stepH : 0;
    return prevTopAt ? Math.max(prevTopAt(x, z), hHere) : hHere;
  };

  // Sprinkle a few sculpted stepped rocks & giant sword ferns on hill shoulders (`detail: true`)!
  const det = ensureForestDetail(c);
  if (style !== 'scorched' && style !== 'excavated' && det.totalTris() < (opt.big ? 235000 : 114000)) {
    let placed = 0;
    for (let tries = 0; tries < 24 && placed < 5; tries++) {
      if (det.totalTris() >= (opt.big ? 238000 : 116000)) break;
      const gx = R.int(1, nx - 2), gz = R.int(1, nz - 2);
      const t = tier[gx + gz * nx];
      if (t < 1 || t > maxTierCap - 1) continue;
      const px = cxOf(gx), pz = czOf(gz), py = t * stepH;
      if (c.ceilAt(px, pz) - py < 1.1) continue;
      const isRock = placed % 3 === 0;
      det.pushVox({
        key: isRock ? 'forest:detail:stepped-rock' : 'forest:detail:pnw-swordfern',
        make: isRock ? steppedGreyRockVox() : pnwSwordFernClusterVox(),
        x: px,
        y: py,
        z: pz,
        rot: R.range(0, 6.28),
        scale: isRock ? 0.032 : R.range(0.030, 0.038),
      });
      placed++;
    }
  }

  return { mounds: lobes.length, tris: emittedTris, cells: filledCells };
}

