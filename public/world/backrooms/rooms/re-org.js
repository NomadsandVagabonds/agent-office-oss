// Set piece: The Re-Org (`re-org`)
// A dim, water-stained Backrooms atrium whose back wall has collapsed into a
// pitch-black subterranean shaft. Dozens of real hollow 1990s beige/putty office
// cubicles — complete with internal desks, overturned swivel chairs, dangling
// keyboards, and beige CRT monitors tipped onto their sides — are piled, wedged
// sideways, and hung upside-down out of broken ceiling holes up to +4.80 m.
import * as THREE from 'three';
import { Vox, M } from '../../vox/vox.js';
import { buildCharacter, JOINT } from '../../avatar/build.js';
import { Batch, lin, drawText, smooth, WHITE } from '../kit.js';
import { P, card, scatter } from '../bits.js';
import {
  pallorLook, mottleHead, stretchHead, eraseNose, hollowSocket, slippedMouth, jointMat,
} from '../uncanny.js';
import {
  TIER_H, SUMMIT_Y, REORG_DECKS, GANGWAY_DECKS, GANGWAY_HINGE, SUMMIT_BELL,
  reorgFloorY, chooseSealedDoors, createBellCascade, stepBellCascade,
} from './re-org/layout.js';

const TRIM_DARK = [0.16, 0.16, 0.15];
const STEEL_LEG = [0.28, 0.29, 0.28];
const CORD_BLACK = [0.05, 0.05, 0.06];
const LAMINATE = [0.68, 0.63, 0.54];
const WOOD_DESK = [0.44, 0.31, 0.20];
const BEIGE_TINTS = [
  [0.74, 0.70, 0.61], // dingy oatmeal
  [0.66, 0.62, 0.54], // nicotine putty
  [0.78, 0.74, 0.65], // faded cream-beige
  [0.59, 0.56, 0.49], // dusty warm grey-beige
];

function serviceBellVox() {
  const v = new Vox();
  v.cyl('y', 0, 0, 0, 2, 5, M('#1c1c1e', 0));
  v.cyl('y', 0, 0, 2, 5, 4, M('#9e823c', 0), 2.5);
  v.box(-1, 5, -1, 1, 7, 1, M('#bda258', 0));
  return v;
}

/** Authentic 1990s bulky dingy-beige CRT monitor (~150 tris, built to tip cleanly onto its side!). */
function beigeCrtVox() {
  const v = new Vox();
  const beige = M('#beb59e', 0), dark = M('#8f8772', 0), bezel = M('#141514', 0);
  v.box(-5, 0, -4, 5, 2, 4, dark);
  v.box(-2, 2, -2, 2, 4, 2, dark);
  v.box(-6, 5, -8, 6, 17, -2, dark);
  v.box(-9, 4, -2, 9, 19, 7, beige);
  v.carve(-7, 6, 7, 7, 17, 7);
  v.box(-7, 6, 6, 7, 17, 6, bezel);
  return v;
}

/** Gritty 128x128 stained beige/putty 1990s cubicle tackboard fabric with dark steel frame & tide marks. */
function makeBeigeFabricTex(kit) {
  return kit.tex.custom('ct:beige-fab', 128, 128, (g, w, h) => {
    P(g, '#c2b9a5', 0, 0, w, h);
    // Coarse woven oatmeal acoustic fabric grain + mottled damp patches
    let s = 91823;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const n = rnd();
        if (n < 0.28) P(g, '#b0a792', x, y, 2, 2);
        else if (n > 0.80) P(g, '#cec5b1', x, y, 2, 2);
      }
    }
    // Damp brownish water-stain tide mark near bottom kickplate
    P(g, 'rgba(72,54,32,0.22)', 0, h - 26, w, 18);
    P(g, 'rgba(54,40,22,0.30)', 0, h - 14, w, 8);
    // Top & bottom dark charcoal steel partition rails + kickplate
    P(g, '#2e2d29', 0, 0, w, 6);
    P(g, '#52504a', 0, 6, w, 2);
    P(g, '#23221f', 0, h - 8, w, 8);
    // Vertical slotted steel cubicle connector posts every 64px
    for (const px of [0, 62, 125]) {
      P(g, '#2c2b28', px, 0, 3, h);
      for (let sy = 10; sy < h - 10; sy += 6) P(g, '#141412', px + 1, sy, 1, 3);
    }
    // Occasional crooked pinned memo & yellowed sticky note left on the partition
    P(g, '#e6dfc8', 18, 26, 18, 22);
    P(g, '#8c2d26', 26, 27, 2, 2); // red pushpin
    P(g, '#595449', 20, 32, 13, 2);
    P(g, '#595449', 20, 36, 11, 2);
    P(g, '#595449', 20, 40, 14, 2);
    P(g, '#d8c56a', 82, 34, 12, 12); // faded yellow post-it
  });
}

/** Scuffed hollow-core wood office door texture for fallen bridge planks. */
function makeFallenDoorTex(kit) {
  return kit.tex.custom('ct:doorplank', 64, 128, (g, w, h) => {
    P(g, '#6d4e32', 0, 0, w, h);
    P(g, '#583e26', 6, 8, w - 12, 48);
    P(g, '#7a593a', 8, 10, w - 16, 44);
    P(g, '#583e26', 6, 66, w - 12, 52);
    P(g, '#7a593a', 8, 68, w - 16, 48);
    // Scuffs & tarnished brass handle plate
    P(g, 'rgba(28,20,12,0.35)', 0, 96, w, 24);
    P(g, '#b5984e', w - 11, 58, 5, 11);
    P(g, '#2a2218', w - 9, 62, 3, 3);
  });
}

/** 2x2 CRT screen atlas: green error, amber warning, dead snow, single cursor. */
function makeCrtAtlas(kit, dept) {
  return kit.tex.custom(`ct:crts:${dept}`, 128, 128, (g) => {
    P(g, '#050a06', 0, 0, 64, 64);
    drawText(g, [dept.toUpperCase(), 'DESK 404', 'REALLOCATED'], 4, 10, 56, 44, { color: '#6ee28a', size: 8, pad: 2 });
    P(g, '#0c0803', 64, 0, 64, 64);
    drawText(g, ['REMAIN AT', 'ASSIGNED', 'STATION'], 68, 10, 56, 44, { color: '#ebb048', size: 8, pad: 2 });
    // Snow static quadrant
    P(g, '#101214', 0, 64, 64, 64);
    let s = 7719;
    for (let y = 66; y < 126; y += 2) {
      for (let x = 2; x < 62; x += 2) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        const v = 40 + ((s >>> 24) & 155);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x, y, 2, 1);
      }
    }
    // Lone cursor quadrant
    P(g, '#040705', 64, 64, 64, 64);
    P(g, '#76e890', 72, 74, 7, 10);
  }, { clamp: true });
}

/** Tall hollow-eyed watcher standing dead-still inside a distant chasm cubicle. */
function makeChasmWatcherVox() {
  const look = pallorLook({
    skin: '#d2ccb8', hair: 'short', hairColor: '#201d1a',
    outfit: 'shirt', outfitColor: '#787468',
  }, { pallor: 0.62, tint: '#cbc6b4' });
  const parts = buildCharacter(look, { seed: 'ct:watcher' });
  const skinHex = look.skin;
  eraseNose(parts.head);
  mottleHead(parts.head, skinHex, 41, { gaunt: 0.45 });
  stretchHead(parts.head, 10, 46);
  hollowSocket(parts.head, -4.5, 49, 4, 5, skinHex, { ember: true });
  hollowSocket(parts.head, 3.5, 48, 4, 5, skinHex, { ember: true });
  slippedMouth(parts.head, 0, 38, 7, 3, skinHex, { slope: -0.2, teeth: false });
  return parts;
}

/**
 * Draws an ACTUAL HOLLOW 3-walled 1990s beige cubicle (`6.5cm` thin partition walls,
 * open on `openSide` so you see straight inside!) with an internal desk slab & leg brackets.
 */
function addHollowCubicle(panelB, flatB, x0, z0, x1, z1, y0, y1, tint, {
  openSide = 'south', hasDesk = true, hasRoofPanel = false, roofTint = tint, step = 5,
} = {}) {
  const t = 0.065;
  const wallOpt = { uv: 1.35, step };
  if (openSide !== 'north') panelB.box(x0, y0, z0, x1, y1, z0 + t, tint, wallOpt);
  if (openSide !== 'south') panelB.box(x0, y0, z1 - t, x1, y1, z1, tint, wallOpt);
  if (openSide !== 'west') panelB.box(x0, y0, z0, x0 + t, y1, z1, tint, wallOpt);
  if (openSide !== 'east') panelB.box(x1 - t, y0, z0, x1, y1, z1, tint, wallOpt);

  // Dark steel connector posts on the two front open-mouth corners
  const posts = openSide === 'south' ? [[x0, z1 - t], [x1 - t, z1 - t]]
    : openSide === 'north' ? [[x0, z0], [x1 - t, z0]]
      : openSide === 'west' ? [[x0, z0], [x0, z1 - t]]
        : [[x1 - t, z0], [x1 - t, z1 - t]];
  for (const [cx, cz] of posts) {
    flatB.box(cx - 0.005, y0, cz - 0.005, cx + t + 0.005, y1 + 0.015, cz + t + 0.005, TRIM_DARK, { step: 5 });
  }

  // Internal laminate/wood desk inside the hollow cubicle
  if (hasDesk && y1 - y0 >= 0.72) {
    const dy = y0 + Math.min(0.68, (y1 - y0) * 0.68);
    const deskDepth = Math.min(0.58, (z1 - z0) * 0.44);
    if (openSide === 'south' || openSide === 'east') {
      flatB.box(x0 + t, dy - 0.04, z0 + t, x1 - t, dy, z0 + t + deskDepth, LAMINATE, { step: 5 });
      flatB.box(x0 + t + 0.06, y0, z0 + t + 0.06, x0 + t + 0.11, dy - 0.04, z0 + t + deskDepth - 0.06, STEEL_LEG, { step: 5 });
    } else {
      flatB.box(x0 + t, dy - 0.04, z1 - t - deskDepth, x1 - t, dy, z1 - t, WOOD_DESK, { step: 5 });
      flatB.box(x1 - t - 0.11, y0, z1 - t - deskDepth + 0.06, x1 - t - 0.06, dy - 0.04, z1 - t - 0.06, STEEL_LEG, { step: 5 });
    }
  }

  // Thin tipped-over beige partition panel forming a walkable deck across the rim (`6.5cm` thick!)
  if (hasRoofPanel) {
    panelB.box(x0, y1 - t, z0, x1, y1, z1, roofTint, { uv: 1.35, step });
    flatB.box(x0 - 0.01, y1 - t, z0 - 0.01, x1 + 0.01, y1 - t + 0.02, z0 + 0.02, TRIM_DARK, { step: 6 });
    flatB.box(x0 - 0.01, y1 - t, z1 - 0.02, x1 + 0.01, y1 - t + 0.02, z1 + 0.01, TRIM_DARK, { step: 6 });
  }
}

/** Drooping power/data/release cable catenary strung as a true oriented 3D tube between two points. */
function addSaggingCable(flatB, ax, ay, az, bx, by, bz, sag = 0.45, segs = 6, col = CORD_BLACK, r = 0.016) {
  const ring = (px, py, pz, ux, uy, uz, vx, vy, vz) => [
    [px + ux, py + uy, pz + uz],
    [px + vx, py + vy, pz + vz],
    [px - ux, py - uy, pz - uz],
    [px - vx, py - vy, pz - vz],
  ];
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const x0 = ax + (bx - ax) * t0, x1 = ax + (bx - ax) * t1;
    const z0 = az + (bz - az) * t0, z1 = az + (bz - az) * t1;
    const y0 = ay + (by - ay) * t0 - Math.sin(t0 * Math.PI) * sag;
    const y1 = ay + (by - ay) * t1 - Math.sin(t1 * Math.PI) * sag;
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const len = Math.hypot(dx, dy, dz) || 1e-4;
    const tx = dx / len, ty = dy / len, tz = dz / len;
    const upX = Math.abs(ty) < 0.9 ? 0 : 1, upY = Math.abs(ty) < 0.9 ? 1 : 0;
    const u0x = -tz * upY, u0y = tz * upX, u0z = tx * upY - ty * upX;
    const uLen = Math.hypot(u0x, u0y, u0z) || 1;
    const ux = (u0x / uLen) * r, uy = (u0y / uLen) * r, uz = (u0z / uLen) * r;
    const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux;
    const c0 = ring(x0, y0, z0, ux, uy, uz, vx, vy, vz);
    const c1 = ring(x1, y1, z1, ux, uy, uz, vx, vy, vz);
    for (let k = 0; k < 4; k++) {
      const nk = (k + 1) & 3;
      flatB.quad(c0[k], c0[nk], c1[nk], c1[k], col);
    }
  }
}

export function build(c) {
  const { W, D, H, R, kit, params: p } = c;
  let cascade = createBellCascade();
  c.rt.coopRead=()=>structuredClone(cascade);c.rt.coopApply=value=>{cascade=structuredClone(value);};

  // Open-backed atrium (`halo` void beyond -D/2); `lights: 'dark'` so we control the murky gloom
  c.shell({ walls: ['front', 'left', 'right'] });
  c.rt.floorY = (x, z) => reorgFloorY(x, z, cascade);
  c.rt.headY = (x, z) => Math.max(1.85, H - reorgFloorY(x, z, cascade));

  const fabTex = makeBeigeFabricTex(kit);
  const doorTex = makeFallenDoorTex(kit);
  const crtTex = makeCrtAtlas(kit, p.dept);

  const panelB = c.mapped('ct:panels', fabTex);
  const doorB = c.mapped('ct:doors', doorTex);
  const crtScreenB = c.shining('ct:crtscreens', crtTex, 1.55);
  const litTubeB = c.shining('ct:tubes', kit.tex.panel(true), 1.9, [0.88, 0.92, 0.72]);

  const crtUv = (q) => {
    const u0 = (q % 2) * 0.5, v0 = q < 2 ? 0.5 : 0.0;
    return [[u0, v0], [u0 + 0.5, v0], [u0 + 0.5, v0 + 0.5], [u0, v0 + 0.5]];
  };

  const crtGeo = kit.model('ct:crt', beigeCrtVox);
  /**
   * Places a 1990s dingy-beige CRT monitor — upright OR tipped 90° onto its side!
   * `mode`: 'upright' | 'side-left' | 'side-right' | 'face-up'
   */
  const placeTumbledCrt = (x, y, z, rot = 0, mode = 'upright', screenIdx = 0) => {
    if (mode === 'side-left' || mode === 'side-right') {
      const sign = mode === 'side-left' ? 1 : -1;
      const cy = y + 0.238;
      c.place(crtGeo, x, z, { y: cy, rot, tilt: [0, sign * (Math.PI / 2)], solid: false, shadow: false });
      const cs = Math.cos(rot), sn = Math.sin(rot);
      const lx = -sign * 0.30, lz = 0.181;
      const sx = x + lx * cs + lz * sn, sz = z - lx * sn + lz * cs;
      const hw = 0.145, hh = 0.18;
      crtScreenB.quad(
        [sx - cs * hw, cy - hh, sz + sn * hw],
        [sx + cs * hw, cy - hh, sz - sn * hw],
        [sx + cs * hw, cy + hh, sz - sn * hw],
        [sx - cs * hw, cy + hh, sz + sn * hw],
        WHITE, crtUv(screenIdx)
      );
    } else if (mode === 'face-up') {
      c.place(crtGeo, x, z, { y: y + 0.21, rot, tilt: [-Math.PI / 2, 0], solid: false, shadow: false });
    } else {
      c.place(crtGeo, x, z, { y, rot, solid: false, shadow: false });
      const cs = Math.cos(rot), sn = Math.sin(rot);
      const sx = x + sn * 0.181, sz = z + cs * 0.181;
      const hw = 0.18;
      crtScreenB.quad(
        [sx - cs * hw, y + 0.16, sz + sn * hw],
        [sx + cs * hw, y + 0.16, sz - sn * hw],
        [sx + cs * hw, y + 0.44, sz - sn * hw],
        [sx - cs * hw, y + 0.44, sz + sn * hw],
        WHITE, crtUv(screenIdx)
      );
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Water stains, ragged ceiling holes, and sparse buzzing fluorescent tubes
  // ---------------------------------------------------------------------------
  for (const [hx, hz, hn] of [[-1.6, 0.8, 2], [2.4, -2.2, 2], [-2.8, -4.2, 2], [1.8, -5.6, 2]]) {
    c.hole(hx, hz, hn);
    c.blot(hx, hz, 2.4, 2.2, { rgb: [0.12, 0.08, 0.03], a: 0.55, y: H - 0.006, down: true });
  }
  c.blot(-2.2, 2.8, 2.2, 1.8, { rgb: [0.05, 0.04, 0.02], a: 0.48 });
  c.blot(2.6, 0.4, 1.9, 2.4, { rgb: [0.05, 0.04, 0.02], a: 0.42 });

  // Sparse working ceiling tubes (`lights: 'dark'` leaves the rest of the ceiling dead)
  const workingTubes = [
    [-3.2, D / 2 - 2.2, 1.15],
    [3.0, 2.4, 0.85],
    [-2.4, -1.6, 0.95],
    [2.6, -5.0, 1.25],
  ];
  for (const [tx, tz, pwr] of workingTubes) {
    litTubeB.quad([tx - 0.3, H - 0.008, tz - 0.6], [tx + 0.3, H - 0.008, tz - 0.6], [tx + 0.3, H - 0.008, tz + 0.6], [tx - 0.3, H - 0.008, tz + 0.6], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    c.light(tx, H - 0.35, tz, '#dbe2ad', pwr * 1.45, { far: 13, k: 1.5 });
  }

  // Torn carpet edge & rusted broken guardrail at the chasm brink (z = -D/2)
  const brinkZ = -D / 2 + 0.24;
  c.flat.box(-W / 2 + 0.2, -0.35, -D / 2 - 0.18, W / 2 - 0.2, 0.015, brinkZ + 0.12, [0.22, 0.20, 0.17], { step: 5 });
  for (const [rx0, rx1] of [[-W / 2 + 0.35, -1.8], [3.65, W / 2 - 0.35]]) {
    c.flat.box(rx0, 0.88, brinkZ - 0.03, rx1, 0.94, brinkZ + 0.03, TRIM_DARK, { step: 4 });
    c.flat.box(rx0, 0.44, brinkZ - 0.025, rx1, 0.49, brinkZ + 0.025, TRIM_DARK, { step: 4 });
    for (let px = rx0 + 0.1; px <= rx1; px += 1.45) {
      c.flat.box(px - 0.03, 0, brinkZ - 0.03, px + 0.03, 0.95, brinkZ + 0.03, TRIM_DARK, { step: 2 });
    }
    c.solid(rx0, brinkZ - 0.12, rx1, brinkZ + 0.12, { keep: true, tall: false });
  }
  c.solid(-1.8, -D / 2 - 0.1, 3.65, -D / 2 + 0.36, { keep: true, tall: false });

  // ---------------------------------------------------------------------------
  // 2. Build the 5-Tier Climb Out of Real Hollow Stacked Beige Cubicles & Fallen Doors
  // ---------------------------------------------------------------------------
  const openDirs = ['south', 'east', 'north', 'west'];
  let bayCount = 0;

  for (const d of REORG_DECKS) {
    if (d.kind === 'flat') {
      const levels = Math.round(d.y / TIER_H);
      const nx = Math.max(1, Math.round((d.x1 - d.x0) / 2.2));
      const nz = Math.max(1, Math.round((d.z1 - d.z0) / 2.2));
      const cw = (d.x1 - d.x0) / nx, cd = (d.z1 - d.z0) / nz;

      for (let lv = 0; lv < levels; lv++) {
        const y0 = lv * TIER_H, y1 = (lv + 1) * TIER_H;
        const isTop = lv === levels - 1;
        for (let ix = 0; ix < nx; ix++) {
          for (let iz = 0; iz < nz; iz++) {
            const onEdge = ix === 0 || ix === nx - 1 || iz === 0 || iz === nz - 1;
            if (!isTop && !onEdge) continue;
            bayCount++;
            if (!isTop && lv > 0 && nx > 1 && ((bayCount * 5) % 7 === 0)) continue;
            const bx0 = d.x0 + ix * cw, bx1 = bx0 + cw;
            const bz0 = d.z0 + iz * cd, bz1 = bz0 + cd;
            const tint = BEIGE_TINTS[(bayCount + lv) % BEIGE_TINTS.length];
            const openSide = iz === nz - 1 ? 'south' : ix === 0 ? 'west' : ix === nx - 1 ? 'east' : openDirs[bayCount % 4];
            addHollowCubicle(panelB, c.flat, bx0, bz0, bx1, bz1, y0, y1, tint, {
              openSide,
              hasDesk: (bayCount % 2 === 0),
              hasRoofPanel: isTop,
              roofTint: BEIGE_TINTS[(bayCount + 2) % BEIGE_TINTS.length],
            });
          }
        }
      }
    } else {
      // Improvised Backrooms climb bridges: fallen hollow-core wooden office doors & unbolted beige partition slabs!
      const isDoor = d.id === 'r1' || d.id === 'r4';
      const bBatch = isDoor ? doorB : panelB;
      const bTint = isDoor ? WHITE : BEIGE_TINTS[1];
      const thick = 0.065;
      if (d.axis === 'z') {
        const p00 = [d.x0, d.yAtZ0, d.z0], p10 = [d.x1, d.yAtZ0, d.z0];
        const p11 = [d.x1, d.yAtZ1, d.z1], p01 = [d.x0, d.yAtZ1, d.z1];
        bBatch.quad(p01, p11, p10, p00, bTint, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        c.flat.quad([d.x0, d.yAtZ0 - thick, d.z0], [d.x1, d.yAtZ0 - thick, d.z0], [d.x1, d.yAtZ1 - thick, d.z1], [d.x0, d.yAtZ1 - thick, d.z1], TRIM_DARK);
        c.flat.quad([d.x0, d.yAtZ1 - thick, d.z1], [d.x0, d.yAtZ1, d.z1], [d.x0, d.yAtZ0, d.z0], [d.x0, d.yAtZ0 - thick, d.z0], TRIM_DARK);
        c.flat.quad([d.x1, d.yAtZ0 - thick, d.z0], [d.x1, d.yAtZ0, d.z0], [d.x1, d.yAtZ1, d.z1], [d.x1, d.yAtZ1 - thick, d.z1], TRIM_DARK);
      } else {
        const p00 = [d.x0, d.yAtX0, d.z0], p01 = [d.x0, d.yAtX0, d.z1];
        const p11 = [d.x1, d.yAtX1, d.z1], p10 = [d.x1, d.yAtX1, d.z0];
        bBatch.quad(p01, p11, p10, p00, bTint, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        c.flat.quad([d.x0, d.yAtX0 - thick, d.z0], [d.x1, d.yAtX1 - thick, d.z0], [d.x1, d.yAtX1 - thick, d.z1], [d.x0, d.yAtX0 - thick, d.z1], TRIM_DARK);
        c.flat.quad([d.x0, d.yAtX0 - thick, d.z1], [d.x1, d.yAtX1 - thick, d.z1], [d.x1, d.yAtX1, d.z1], [d.x0, d.yAtX0, d.z1], TRIM_DARK);
        c.flat.quad([d.x1, d.yAtX1 - thick, d.z0], [d.x0, d.yAtX0 - thick, d.z0], [d.x0, d.yAtX0, d.z0], [d.x1, d.yAtX1, d.z0], TRIM_DARK);
      }
    }
  }

  // Standing open-topped cubicle partition walls (+1.18m above the walked decks, strictly along outer edges so walk path & stashes stay 100% clear!)
  // Tier 1 standing cubicle walls & sideways cubicle wing
  panelB.box(-3.8, TIER_H, 0.6, -3.73, TIER_H + 1.22, 2.2, BEIGE_TINTS[0], { uv: 1.35, step: 2 });
  panelB.box(-3.8, TIER_H, 0.6, -1.4, TIER_H + 1.22, 0.67, BEIGE_TINTS[0], { uv: 1.35, step: 2 });
  // Tier 2 standing cubicle back wall along x = 4.0
  panelB.box(3.93, TIER_H * 2, -4.2, 4.0, TIER_H * 2 + 1.25, 2.2, BEIGE_TINTS[1], { uv: 1.35, step: 2 });
  panelB.box(2.4, TIER_H * 2, 2.13, 4.0, TIER_H * 2 + 1.25, 2.2, BEIGE_TINTS[1], { uv: 1.35, step: 2 });
  // Tier 3 standing cubicle walls
  panelB.box(-2.4, TIER_H * 3, -4.2, 0.8, TIER_H * 3 + 1.18, -4.13, BEIGE_TINTS[2], { uv: 1.35, step: 2 });
  panelB.box(-4.2, TIER_H * 3, -1.07, -0.6, TIER_H * 3 + 1.18, -1.0, BEIGE_TINTS[2], { uv: 1.35, step: 2 });
  // Tier 4 chasm-side low partition lip
  panelB.box(-4.2, TIER_H * 4, -5.8, -1.0, TIER_H * 4 + 0.92, -5.73, BEIGE_TINTS[3], { uv: 1.35, step: 2 });
  // Tier 5 Summit open-topped beige cubicle booth jutting out over the black shaft!
  panelB.box(1.6, SUMMIT_Y, -7.0, 3.4, SUMMIT_Y + 0.94, -6.93, BEIGE_TINTS[0], { uv: 1.35, step: 2 });
  panelB.box(1.6, SUMMIT_Y, -7.0, 1.67, SUMMIT_Y + 1.18, -5.8, BEIGE_TINTS[0], { uv: 1.35, step: 2 });
  panelB.box(3.33, SUMMIT_Y, -7.0, 3.4, SUMMIT_Y + 1.18, -5.8, BEIGE_TINTS[0], { uv: 1.35, step: 2 });

  // ---------------------------------------------------------------------------
  // 3. Real Office Desks, Sideways CRT Monitors, Overturned Chairs & Filing Cabinets!
  // ---------------------------------------------------------------------------
  // Ground-floor wrecked beige cubicles around the pile (non-blocking visual clutter)
  addHollowCubicle(panelB, c.flat, -5.8, 2.6, -4.0, 4.4, 0, 1.32, BEIGE_TINTS[1], { openSide: 'east', hasDesk: true });
  c.prop('chair', -4.7, 3.5, { rot: 1.9, tilt: [0, 1.48], solid: false, shadow: 0.4, o: { color: '#4d4b46' } }); // overturned grey chair on its side!
  placeTumbledCrt(-5.25, 0.68, 3.15, 1.5, 'side-left', 2); // sideways static CRT on ground cubicle desk!

  // Toppled steel filing cabinet lying on its side propping up the fallen wooden door Ramp 1!
  c.prop('cabinet', -2.9, 2.85, { y: 0.26, rot: 0, tilt: [0, Math.PI / 2], solid: false, shadow: 0.45 });
  scatter(c, -2.5, 4.05, 8, 0.85);

  // Foreground hollow cubicle at right `(2.0..4.2, 2.5..4.3)` stacked two-high, tilted & spilling sideways CRTs!
  addHollowCubicle(panelB, c.flat, 1.9, 2.5, 3.9, 4.3, 0, 1.32, BEIGE_TINTS[0], { openSide: 'south', hasDesk: true });
  addHollowCubicle(panelB, c.flat, 2.05, 2.6, 3.85, 4.2, 1.32, 2.58, BEIGE_TINTS[3], { openSide: 'west', hasDesk: true });
  c.prop('desk', 2.9, 3.15, { y: 0, rot: 0.08, solid: false, shadow: 0.4 });
  placeTumbledCrt(2.65, 0.65, 3.10, 0.25, 'side-right', 0); // CRT tipped onto its side on the desk!
  c.prop('keyboard', 3.15, 3.45, { y: 0.42, rot: 0.2, tilt: [1.35, 0.2], solid: false, shadow: false }); // keyboard dangling off desk edge!
  placeTumbledCrt(2.85, 2.0, 3.35, -0.4, 'upright', 1); // second CRT perched inside the stacked upper cubicle!

  // Tier 1 (`y = 0.96m`) props along outer edges (clear of climb lane): sideways CRT, overturned chair, spilled boxes
  placeTumbledCrt(-3.25, TIER_H, 0.95, 0.55, 'side-left', 1);
  c.prop('keyboard', -2.85, 1.05, { y: TIER_H, rot: 0.9, solid: false, shadow: false });
  c.prop('chair', -1.85, 1.82, { y: TIER_H + 0.22, rot: -0.7, tilt: [1.45, 0.3], solid: false, shadow: false, o: { color: '#544d44' } });
  c.prop('boxes', -0.05, -0.55, { y: TIER_H, rot: 0.4, solid: false, shadow: false, o: { variant: 1 } });

  // Tier 2 (`y = 1.92m`): real desk sitting ON TOP of stacked cubicles + sideways CRT + upright CRT
  c.prop('desk', 3.45, 1.35, { y: TIER_H * 2, rot: -Math.PI / 2, solid: false, shadow: false });
  placeTumbledCrt(3.45, TIER_H * 2 + 0.65, 1.25, -Math.PI / 2 + 0.2, 'side-right', 0);
  c.prop('cabinet', 3.62, -3.65, { y: TIER_H * 2, rot: -Math.PI / 2, solid: false, shadow: false });
  placeTumbledCrt(3.60, TIER_H * 2 + 1.25, -3.65, -1.8, 'upright', 2);

  // Tier 3 (`y = 2.88m`): crooked cubicle workstation mid-climb with sideways CRT & upside-down chair!
  c.prop('desk', -1.35, -3.55, { y: TIER_H * 3, rot: 0.18, solid: false, shadow: false });
  placeTumbledCrt(-1.55, TIER_H * 3 + 0.65, -3.55, 0.3, 'side-left', 3);
  c.prop('chair', -0.45, -3.55, { y: TIER_H * 3 + 0.96, flip: true, rot: 0.8, solid: false, shadow: false, o: { color: '#474a4e' } });
  c.light(-1.4, TIER_H * 3 + 1.1, -3.2, '#92d89e', 0.65, { far: 5.5, k: 1.6 }); // eerie green CRT glow on Tier 3

  // Tier 4 (`y = 3.84m`): toppled cabinet & dead plant
  c.prop('boxes', -3.75, -5.35, { y: TIER_H * 4, rot: 1.1, solid: false, shadow: false, o: { variant: 2 } });
  placeTumbledCrt(-2.15, TIER_H * 4, -5.42, 0.2, 'face-up', 2);

  // Tier 5 Summit (`y = 4.80m`): real wooden chasm desk + interactive status CRT + brass Allocation Bell!
  c.prop('desk', 2.38, -6.48, { y: SUMMIT_Y, rot: 0, solid: false, shadow: false });
  c.place(crtGeo, 2.15, -6.52, { y: SUMMIT_Y + 0.74, rot: 0.14, solid: false, shadow: false });
  const sumLockTex = card(c, 'ct:sumcrt:lock', ['STATION 5A', 'SHUTTERS', 'SEALED'], {
    w: 128, h: 96, bg: '#120a03', fg: '#f2b238', edge: '#5c3c0e', size: 13, pad: 8,
  });
  const sumOpenTex = card(c, 'ct:sumcrt:open', ['STATION 5A', 'SHUTTERS', 'OPEN'], {
    w: 128, h: 96, bg: '#041208', fg: '#6ef292', edge: '#1b6632', size: 13, pad: 8,
  });
  const makeSummitScreenNode = (tex) => {
    const b = new Batch();
    const rot = 0.14, cs = Math.cos(rot), sn = Math.sin(rot), hw = 0.18;
    const sx = 2.15 + sn * 0.183, sz = -6.52 + cs * 0.183, sy = SUMMIT_Y + 0.74;
    b.quad(
      [sx - cs * hw, sy + 0.16, sz + sn * hw],
      [sx + cs * hw, sy + 0.16, sz - sn * hw],
      [sx + cs * hw, sy + 0.44, sz - sn * hw],
      [sx - cs * hw, sy + 0.44, sz + sn * hw],
      WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]
    );
    return c.dynamic(b, { map: tex, unlit: true });
  };
  const summitScreenLocked = makeSummitScreenNode(sumLockTex);
  const summitScreenOpen = makeSummitScreenNode(sumOpenTex);
  summitScreenOpen.visible = false;

  c.model('ct:bell', serviceBellVox, SUMMIT_BELL.x + 0.34, SUMMIT_BELL.z - 0.18, { y: SUMMIT_Y + 0.74, solid: false, shadow: false });
  c.light(2.25, SUMMIT_Y + 1.35, -6.0, '#d8b46a', 0.75, { far: 6.5, k: 1.8 });

  // ---------------------------------------------------------------------------
  // 3b. Hinged Steel Maintenance Gangway (`GANGWAY_DECKS`: drops on bell ring!)
  // ---------------------------------------------------------------------------
  const STEEL_DECK = [0.24, 0.26, 0.28];
  const STEEL_RAIL = [0.34, 0.36, 0.39];
  const HAZARD_YEL = [0.84, 0.62, 0.10];
  const [gTop, gRamp] = GANGWAY_DECKS;

  // Fixed cantilever steel landing pad bolted to east edge of Tier 5 (`x = 4.4..5.65, z = -5.6..-4.2`)
  c.flat.box(gTop.x0, SUMMIT_Y - 0.09, gTop.z0, gTop.x1, SUMMIT_Y, gTop.z1, STEEL_DECK, { step: 3 });
  c.flat.box(gTop.x0 - 0.02, SUMMIT_Y - 0.01, gTop.z0 + 0.04, gTop.x0 + 0.11, SUMMIT_Y + 0.008, gTop.z1 - 0.04, HAZARD_YEL, { step: 3 });
  // Under-deck diagonal steel brackets tying landing pad into Tier 5 stack
  for (const bz of [-5.48, -4.34]) {
    c.flat.box(4.2, SUMMIT_Y - 0.72, bz - 0.04, gTop.x1 - 0.05, SUMMIT_Y - 0.62, bz + 0.04, TRIM_DARK, { step: 3 });
    c.flat.box(gTop.x1 - 0.13, SUMMIT_Y - 0.72, bz - 0.04, gTop.x1 - 0.05, SUMMIT_Y - 0.09, bz + 0.04, TRIM_DARK, { step: 3 });
  }
  // North & East guardrails on landing pad (west connects to Tier 5; south opens onto hinged gangplank)
  c.flat.box(gTop.x0, SUMMIT_Y + 0.88, gTop.z0 - 0.03, gTop.x1, SUMMIT_Y + 0.94, gTop.z0 + 0.03, STEEL_RAIL, { step: 3 });
  c.flat.box(gTop.x0, SUMMIT_Y + 0.44, gTop.z0 - 0.025, gTop.x1, SUMMIT_Y + 0.49, gTop.z0 + 0.025, STEEL_RAIL, { step: 3 });
  c.flat.box(gTop.x1 - 0.03, SUMMIT_Y + 0.88, gTop.z0, gTop.x1 + 0.03, SUMMIT_Y + 0.94, gTop.z1, STEEL_RAIL, { step: 3 });
  c.flat.box(gTop.x1 - 0.025, SUMMIT_Y + 0.44, gTop.z0, gTop.x1 + 0.025, SUMMIT_Y + 0.49, gTop.z1, STEEL_RAIL, { step: 3 });
  for (const [px, pz] of [[gTop.x0 + 0.04, gTop.z0], [gTop.x1 - 0.03, gTop.z0], [gTop.x1 - 0.03, gTop.z1 - 0.04]]) {
    c.flat.box(px - 0.03, SUMMIT_Y, pz - 0.03, px + 0.03, SUMMIT_Y + 0.95, pz + 0.03, TRIM_DARK, { step: 2 });
  }
  // Beacon post on landing pad corner: red while gangway raised, green once dropped
  c.flat.box(gTop.x1 - 0.06, SUMMIT_Y + 0.95, gTop.z1 - 0.08, gTop.x1 + 0.02, SUMMIT_Y + 1.16, gTop.z1, TRIM_DARK, { step: 1 });
  const gwRedB = new Batch(), gwGreenB = new Batch();
  gwRedB.box(gTop.x1 - 0.08, SUMMIT_Y + 1.16, gTop.z1 - 0.10, gTop.x1 + 0.04, SUMMIT_Y + 1.28, gTop.z1 + 0.02, [0.95, 0.20, 0.16]);
  gwGreenB.box(gTop.x1 - 0.08, SUMMIT_Y + 1.16, gTop.z1 - 0.10, gTop.x1 + 0.04, SUMMIT_Y + 1.28, gTop.z1 + 0.02, [0.22, 0.95, 0.42]);
  const gangwayLampRed = c.dynamic(gwRedB, { unlit: true });
  const gangwayLampGreen = c.dynamic(gwGreenB, { unlit: true });
  gangwayLampGreen.visible = false;
  c.light(4.95, SUMMIT_Y + 1.45, -4.6, '#d6b872', 0.65, { far: 7.0, k: 1.6 });

  // Ceiling winch housing above gangway
  c.flat.box(GANGWAY_HINGE.x - 0.30, H - 0.28, -2.45, GANGWAY_HINGE.x + 0.30, H, -1.95, TRIM_DARK, { step: 2 });
  const hoistCableB = new Batch();
  hoistCableB.box(GANGWAY_HINGE.x - 0.025, SUMMIT_Y + 2.15, -2.22, GANGWAY_HINGE.x + 0.025, H - 0.25, -2.17, CORD_BLACK, { step: 4 });
  const hoistCableNode = c.dynamic(hoistCableB);

  // Dynamic 7.0m sloped steel gangplank authored in lowered pose, pivoted at `GANGWAY_HINGE`
  const gangwayB = new Batch();
  const gx0 = gRamp.x0, gx1 = gRamp.x1, gz0 = gRamp.z0, gz1 = gRamp.z1;
  const gy0 = gRamp.yAtZ0, gy1 = gRamp.yAtZ1, gThick = 0.09;
  // Walkable top plate & underside
  gangwayB.quad([gx0, gy1, gz1], [gx1, gy1, gz1], [gx1, gy0, gz0], [gx0, gy0, gz0], STEEL_DECK);
  gangwayB.quad([gx0, gy0 - gThick, gz0], [gx1, gy0 - gThick, gz0], [gx1, gy1 - gThick, gz1], [gx0, gy1 - gThick, gz1], TRIM_DARK);
  // Side stringers
  gangwayB.quad([gx0, gy1 - gThick, gz1], [gx0, gy1, gz1], [gx0, gy0, gz0], [gx0, gy0 - gThick, gz0], HAZARD_YEL);
  gangwayB.quad([gx1, gy0 - gThick, gz0], [gx1, gy0, gz0], [gx1, gy1, gz1], [gx1, gy1 - gThick, gz1], HAZARD_YEL);
  // Anti-slip cleats & sloped side handrails
  for (let i = 0; i <= 7; i++) {
    const u = i / 7;
    const cz = gz0 + (gz1 - gz0) * u, cy = gy0 + (gy1 - gy0) * u;
    gangwayB.box(gx0 + 0.06, cy, cz - 0.03, gx1 - 0.06, cy + 0.022, cz + 0.03, HAZARD_YEL, { step: 2 });
    if (i < 7) {
      const u2 = (i + 1) / 7;
      const nz = gz0 + (gz1 - gz0) * u2, ny = gy0 + (gy1 - gy0) * u2;
      for (const rx of [gx0 + 0.03, gx1 - 0.03]) {
        gangwayB.box(rx - 0.025, cy, cz - 0.025, rx + 0.025, cy + 0.86, cz + 0.025, TRIM_DARK, { step: 2 });
        // Sloped top rail segment
        gangwayB.quad([rx - 0.02, ny + 0.86, nz], [rx + 0.02, ny + 0.86, nz], [rx + 0.02, cy + 0.86, cz], [rx - 0.02, cy + 0.86, cz], STEEL_RAIL);
        gangwayB.quad([rx - 0.02, cy + 0.82, cz], [rx + 0.02, cy + 0.82, cz], [rx + 0.02, ny + 0.82, nz], [rx - 0.02, ny + 0.82, nz], STEEL_RAIL);
      }
    }
  }
  const gangwayNode = c.dynamic(gangwayB, { pivot: [GANGWAY_HINGE.x, GANGWAY_HINGE.y, GANGWAY_HINGE.z], side: THREE.DoubleSide });
  gangwayNode.rotation.x = GANGWAY_HINGE.raisedPitch;

  // ---------------------------------------------------------------------------
  // 4. Upside-Down Hollow Cubicles Hanging Out of Ripped-Open Dark Ceiling Holes!
  // ---------------------------------------------------------------------------
  // Swaying upside-down beige cubicle dangling on black power cords at (-0.6, 0.4, y = H - 2.6)
  const swayPanelB = new Batch();
  const swayFlatB = new Batch();
  addHollowCubicle(swayPanelB, swayFlatB, -1.65, -0.45, 0.45, 1.35, H - 2.65, H - 1.30, BEIGE_TINTS[1], {
    openSide: 'south', hasDesk: true, hasRoofPanel: true, step: 3,
  });
  for (const [cx, cz] of [[-1.5, -0.3], [0.3, 1.2]]) {
    swayFlatB.box(cx - 0.02, H - 1.30, cz - 0.02, cx + 0.02, H + 0.4, cz + 0.02, CORD_BLACK, { step: 4 });
  }
  const swayingPanel = c.dynamic(swayPanelB, { map: fabTex, pivot: [-0.6, H, 0.45] });
  const swayingTrim = c.dynamic(swayFlatB, { pivot: [-0.6, H, 0.45] });

  // Second inverted cubicle wedged crookedly into the ceiling hole at (2.4, -2.2) with an upside-down chair!
  addHollowCubicle(panelB, c.flat, 1.45, -3.1, 3.35, -1.3, H - 1.45, H + 0.2, BEIGE_TINTS[3], {
    openSide: 'west', hasDesk: true, step: 3,
  });
  c.prop('chair', 2.35, -2.2, { y: H - 0.15, flip: true, rot: 0.5, solid: false, shadow: false, o: { color: '#4d4b46' } });

  // Sideways hollow cubicle jammed halfway through the right yellow-wallpaper wall!
  addHollowCubicle(panelB, c.flat, W / 2 - 0.85, -0.6, W / 2 + 0.3, 1.8, 4.4, 5.75, BEIGE_TINTS[2], {
    openSide: 'west', hasDesk: true, hasRoofPanel: true, step: 3,
  });

  // Tangled black power cords drooping between ceiling holes and cubicle tiers
  addSaggingCable(c.flat, -1.6, H, 0.8, -2.6, TIER_H + 1.1, 1.2, 0.85);
  addSaggingCable(c.flat, 2.4, H, -2.2, 3.7, TIER_H * 2 + 1.1, -1.8, 0.95);
  addSaggingCable(c.flat, 1.8, H, -5.6, 1.65, SUMMIT_Y + 1.16, -6.90, 0.55);

  // ---------------------------------------------------------------------------
  // 5. Pitch-Black Subterranean Cubicle Abyss (`halo` beyond z = -D/2) & Silent Watcher
  // ---------------------------------------------------------------------------
  const abyssW = W / 2 + 6.8;
  const abyssBack = -D / 2 - 15.2;
  const darkWall = [0.22, 0.20, 0.15]; // grimy damp yellow-grey shaft concrete/wallpaper
  const slabCol = [0.14, 0.13, 0.12];

  // Pitch-black pit floor & stained subterranean shaft walls
  c.flat.box(-abyssW, -15.5, abyssBack, abyssW, -15.0, -D / 2 + 0.4, [0.008, 0.008, 0.008], { step: 8 });
  c.flat.box(-abyssW - 0.4, -15.2, abyssBack - 0.4, -abyssW, H + 2.0, -D / 2 + 0.2, darkWall, { step: 7 });
  c.flat.box(abyssW, -15.2, abyssBack - 0.4, abyssW + 0.4, H + 2.0, -D / 2 + 0.2, darkWall, { step: 7 });
  c.flat.box(-abyssW, -15.2, abyssBack - 0.4, abyssW, H + 2.0, abyssBack, darkWall, { step: 7 });

  const chasmTiers = [5.4, 2.0, -1.6, -5.4, -9.2];
  const cascadeStrips = [];

  chasmTiers.forEach((ty, idx) => {
    // Exposed ruptured floor-slab lip along the far shaft wall
    c.flat.box(-abyssW, ty - 0.24, abyssBack, abyssW, ty, abyssBack + 1.35, slabCol, { step: 6 });

    // Crooked hollow beige cubicles jutting out over the black shaft
    for (let k = 0; k < 4; k++) {
      const bx = -abyssW + 1.8 + k * ((abyssW * 2 - 5.2) / 3.3) + R.range(-0.45, 0.45);
      const bw = R.pick([2.2, 2.8]), bd = R.pick([1.7, 2.3]);
      const tint = BEIGE_TINTS[(idx + k) % BEIGE_TINTS.length];
      addHollowCubicle(panelB, c.flat, bx, abyssBack + 0.08, bx + bw, abyssBack + 0.08 + bd, ty, ty + 1.28, tint, {
        openSide: 'south', hasDesk: true, hasRoofPanel: k % 2 === 1, step: 4,
      });
      if (k === 1 && idx <= 2) {
        placeTumbledCrt(bx + bw * 0.5, ty + 0.68, abyssBack + 0.55, 0, idx === 1 ? 'upright' : 'side-left', (idx + k) % 4);
      }
    }
    // Side-wall jutting hollow cubicles
    for (const side of [-1, 1]) {
      const sx0 = side < 0 ? -abyssW : abyssW - 2.3;
      const sx1 = side < 0 ? -abyssW + 2.3 : abyssW;
      const sz = -D / 2 - 3.4 - idx * 2.2;
      addHollowCubicle(panelB, c.flat, sx0, sz, sx1, sz + 2.4, ty - 0.2, ty + 1.08, BEIGE_TINTS[(idx + (side > 0 ? 2 : 0)) % 4], {
        openSide: side < 0 ? 'east' : 'west', hasDesk: true, step: 4,
      });
    }

    // Flickering sickly-yellow chasm fluorescent strip (dark by default until summit bell cascades!)
    const stripB = new Batch();
    stripB.box(-abyssW + 1.6, ty + 2.1, abyssBack + 0.12, abyssW - 1.6, ty + 2.22, abyssBack + 0.26, [0.95, 0.96, 0.76], { step: 8 });
    cascadeStrips.push(c.dynamic(stripB, { unlit: true }));
  });

  // Uncanny Watcher standing motionless inside the middle chasm cubicle (`ty = 2.0`), staring across the void at you!
  // Vanishes into thin air the first time the summit bell cascades the lights!
  const watcherParts = makeChasmWatcherVox();
  const wScale = [0.026, 0.038, 0.026];
  const watcherX = 1.8, watcherY = 2.02, watcherZ = abyssBack + 1.15;
  const wTr = new THREE.Matrix4().makeTranslation(watcherX, watcherY, watcherZ);
  const wAt = (j, rx = 0, ry = 0, rz = 0, sy = 1) => wTr.clone().multiply(jointMat(wScale, j, rx, ry, rz, sy));
  const watcherB = new Batch(true);
  const addW = (k, vox, m4) => { const g = kit.model(`ct:w:${k}`, () => vox); if (g?.solid) watcherB.addVox(g.solid, m4); };
  addW('t', watcherParts.torso, wAt(JOINT.hips, 0.04, 0, 0));
  addW('h', watcherParts.head, wAt(JOINT.head, 0.08, 0, 0.06));
  addW('aul', watcherParts.armUpperL, wAt(JOINT.shoulderL, 0, 0, 0.05, 1.2));
  addW('all', watcherParts.armLowerL, wAt(JOINT.shoulderL, 0, 0, 0.05, 1.2));
  addW('aur', watcherParts.armUpperR, wAt(JOINT.shoulderR, 0, 0, -0.05, 1.2));
  addW('alr', watcherParts.armLowerR, wAt(JOINT.shoulderR, 0, 0, -0.05, 1.2));
  addW('lul', watcherParts.legUpperL, wAt(JOINT.hipL, 0, 0, 0, 1.15));
  addW('lll', watcherParts.legLowerL, wAt(JOINT.hipL, 0, 0, 0, 1.15));
  addW('lur', watcherParts.legUpperR, wAt(JOINT.hipR, 0, 0, 0, 1.15));
  addW('llr', watcherParts.legLowerR, wAt(JOINT.hipR, 0, 0, 0, 1.15));
  const watcherNode = c.dynamic(watcherB, { pivot: [watcherX, watcherY, watcherZ] });

  // Subtle eerie abyss lighting (strictly <= 15 lights total!)
  c.light(watcherX, watcherY + 1.6, watcherZ + 1.4, '#b8d8a0', 1.2, { far: 14, k: 1.5 });
  c.light(0, -3.5, -D / 2 - 7.5, '#6e7850', 1.4, { far: 22 });

  // Taped paper notice slapped crookedly onto the ground cubicle partition beside Ramp 1
  const noteTex = card(c, `ct:memo:${p.tierCode}`, [
    `RE-ORG: ${p.dept.toUpperCase()}`,
    `STATION MOVED -> ${p.tierCode}`,
    'DO NOT LOOK OVER RAIL',
  ], { w: 144, h: 72, bg: '#dfd6bc', fg: '#1e1c18', edge: '#6e2822', size: 9, pad: 6 });
  c.mapped('ct:memo', noteTex).quad(
    [-3.68, 1.22, 2.18], [-3.06, 1.20, 2.18], [-3.04, 1.52, 2.18], [-3.66, 1.54, 2.18],
    WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]
  );

  // ---------------------------------------------------------------------------
  // 6. Ground-Floor Security Roll-Shutters & Yellow Release Conduit to Desk 5A
  // ---------------------------------------------------------------------------
  // (What is written is what would be written: the shutter says where its release is, once, and the yellow cable that
  // runs from it up the pile to that desk says the rest. Nothing says "climb" or "ring": that is for whoever looks up.)
  const shutterWarnTex = card(c, 'ct:shutter:warn', ['SHUTTER RELEASE', 'DESK 5A'], {
    w: 148, h: 52, bg: '#d9ad26', fg: '#151412', edge: '#151412', size: 11, pad: 6,
  });
  const lockedSignTex = card(c, 'ct:shutter:red', ['SEALED'], {
    w: 148, h: 34, bg: '#3a0a0a', fg: '#ff5c52', edge: '#961e18', size: 11, pad: 5,
  });
  const openSignTex = card(c, 'ct:shutter:grn', ['OPEN'], {
    w: 148, h: 34, bg: '#0b381e', fg: '#6ef296', edge: '#249c54', size: 13, pad: 5,
  });

  let entrySide = c.room.doors.some((d) => d.side === 'front') ? 'front' : (c.room.doors[0]?.side || 'front');
  let enteredOnce = false;
  let sealedSet = new Set(chooseSealedDoors(c.room.doors, entrySide));

  const shutters = c.room.doors.map((dr) => {
    const sw = dr.w + 0.14, yBot = dr.sill || 0, yTop = yBot + dr.h;
    // Fixed overhead steel roll-drum housing & side guide channels
    c.wbox(dr.side, dr.c, sw + 0.14, yTop, yTop + 0.25, 0.01, 0.19, [0.18, 0.20, 0.22]);
    for (const s of [-1, 1]) {
      c.wbox(dr.side, dr.c + s * (sw / 2 + 0.03), 0.06, yBot, yTop + 0.25, 0.01, 0.13, [0.22, 0.24, 0.26]);
    }

    // Dynamic ribbed steel shutter curtain + warning placard, pivoted at lintel `yTop`
    const curtainB = new Batch();
    const slats = Math.max(6, Math.round(dr.h / 0.18));
    for (let i = 0; i < slats; i++) {
      const sy0 = yBot + (i / slats) * dr.h, sy1 = yBot + ((i + 1) / slats) * dr.h;
      const colSlat = i === 0 ? HAZARD_YEL : (i % 2 === 0 ? [0.30, 0.32, 0.35] : [0.21, 0.23, 0.25]);
      c.wbox(dr.side, dr.c, sw, sy0 + 0.004, sy1, 0.04, 0.09, colSlat, { batch: curtainB });
    }
    const placB = new Batch();
    c.hang(placB, dr.side, dr.c, yBot + Math.min(1.36, dr.h * 0.64), Math.min(0.84, sw * 0.68), 0.30, [[0, 0], [1, 0], [1, 1], [0, 1]], WHITE, 0.102);

    const p0 = c.wallAt(dr.side, dr.c, 0.065), pivot = [p0.x, yTop, p0.z];
    const curtainNode = c.dynamic(curtainB, { pivot });
    const placardNode = c.dynamic(placB, { map: shutterWarnTex, pivot });

    // Overhead illuminated status sign (`SEALED · RING 5A` red -> `EXIT OPEN` green)
    const signY = Math.min(H - 0.22, yTop + 0.42), signW = Math.min(0.96, sw * 0.78);
    const redB = new Batch(), grnB = new Batch();
    c.hang(redB, dr.side, dr.c, signY, signW, 0.23, [[0, 0], [1, 0], [1, 1], [0, 1]], WHITE, 0.045);
    c.hang(grnB, dr.side, dr.c, signY, signW, 0.23, [[0, 0], [1, 0], [1, 1], [0, 1]], WHITE, 0.045);
    c.wbox(dr.side, dr.c, signW + 0.05, signY - 0.13, signY + 0.13, 0.005, 0.042, TRIM_DARK);
    const redSign = c.dynamic(redB, { map: lockedSignTex, unlit: true });
    const greenSign = c.dynamic(grnB, { map: openSignTex, unlit: true });

    // Yellow-orange armored release conduit leading visibly from outgoing shutter housings up to Desk 5A!
    if (dr.side !== 'front') {
      const midX = dr.side === 'left' ? -3.6 : 3.85;
      const midY = dr.side === 'left' ? TIER_H * 3 + 1.05 : TIER_H * 2 + 1.15;
      const midZ = dr.side === 'left' ? -2.2 : -1.4;
      addSaggingCable(c.flat, p0.x, yTop + 0.18, p0.z, midX, midY, midZ, 0.45, 7, HAZARD_YEL, 0.022);
      addSaggingCable(c.flat, midX, midY, midZ, 3.35, SUMMIT_Y + 1.12, -5.85, 0.38, 7, HAZARD_YEL, 0.022);
      addSaggingCable(c.flat, 3.35, SUMMIT_Y + 1.12, -5.85, SUMMIT_BELL.x + 0.34, SUMMIT_Y + 0.75, SUMMIT_BELL.z - 0.22, 0.12, 5, HAZARD_YEL, 0.016);
    }

    // Collider starts `on: false` at build time so `world.js` no-trap check passes, then arms on tick 1
    const ca = c.wallAt(dr.side, dr.c - dr.w / 2 - 0.04, 0.01);
    const cb = c.wallAt(dr.side, dr.c + dr.w / 2 + 0.04, 0.26);
    const col = c.solid(Math.min(ca.x, cb.x), Math.min(ca.z, cb.z), Math.max(ca.x, cb.x), Math.max(ca.z, cb.z), { tall: true, on: false });

    const usePt = c.wallAt(dr.side, dr.c, 0.42);
    const doorPt = c.wallAt(dr.side, dr.c, 0.12);
    const wUse = c.toWorld(usePt.x, usePt.z);
    const wDoor = c.toWorld(doorPt.x, doorPt.z);
    const sh = { dr, p0, curtainNode, placardNode, redSign, greenSign, col, doorPt, wUse, wDoor, rattle: 0, shut: false };

    c.use({
      x: usePt.x,
      z: usePt.z,
      r: 1.55,
      label: 'sealed — ring bell at Desk 5A',
      when: () => sealedSet.has(dr) && !cascade.unlocked,
      use: () => {
        sh.rattle = 0.45;
        c.env.play('rattle', wUse.x, wUse.z, 7);
      },
    });
    return sh;
  });

  const applyShutterVisuals = (t = 0) => {
    const rollScale = Math.max(0.04, 1 - smooth(cascade.shutterOpen));
    for (const sh of shutters) {
      const isSealed = sealedSet.has(sh.dr);
      const s = isSealed ? rollScale : 0.04;
      sh.curtainNode.scale.y = s;
      sh.placardNode.scale.y = s;
      sh.placardNode.visible = isSealed && s > 0.12;
      const shake = sh.rattle > 0 ? Math.sin(t * 58) * 0.018 * (sh.rattle / 0.45) : 0;
      const yTop = (sh.dr.sill || 0) + sh.dr.h;
      sh.curtainNode.position.set(sh.p0.x + sh.p0.U[0] * shake, yTop, sh.p0.z + sh.p0.U[2] * shake);
      sh.placardNode.position.set(sh.p0.x + sh.p0.U[0] * shake, yTop, sh.p0.z + sh.p0.U[2] * shake);
      sh.redSign.visible = isSealed && !cascade.unlocked;
      sh.greenSign.visible = !isSealed || cascade.unlocked;
    }
  };
  applyShutterVisuals(0);

  const bellWorld = c.toWorld(SUMMIT_BELL.x, SUMMIT_BELL.z);
  const gwWorld = c.toWorld(GANGWAY_HINGE.x, 0.5);
  const bellUse = c.use({
    x: SUMMIT_BELL.x + 0.22,
    z: SUMMIT_BELL.z,
    r: 1.65,
    label: 'ring bell (unlock exit)',
    when: () => {
      const me = c.env.player?.me;
      if (!me) return false;
      const loc = c.toLocal(me.x, me.z);
      return reorgFloorY(loc.x, loc.z, cascade) >= SUMMIT_Y - 0.3;
    },
    use: () => {
      const res = stepBellCascade(cascade, { rang: true });
      cascade = res.state;
      bellUse.label = 'ring service bell';
      summitScreenLocked.visible = false;
      summitScreenOpen.visible = true;
      c.env.interfere(0.32);
      c.env.play('ding', bellWorld.x, bellWorld.z, 16);
      c.env.play('buzz', bellWorld.x, bellWorld.z, 16);
      if (res.justUnlocked) {
        for (const sh of shutters) {
          if (sealedSet.has(sh.dr)) c.env.play('door', sh.wUse.x, sh.wUse.z, 18);
        }
      }
    },
  });

  c.tick((dt, t, me) => {
    const rx = Math.cos(t * 0.52) * 0.024, rz = Math.sin(t * 0.73) * 0.038;
    swayingPanel.rotation.set(rx, 0, rz);
    swayingTrim.rotation.set(rx, 0, rz);

    // Loop-proof entrance detection: whichever doorway the visitor first enters from stays open!
    if (me.inside) {
      enteredOnce = true;
    } else if (!enteredOnce && !cascade.unlocked && c.room.doors.length > 1) {
      for (const sh of shutters) {
        if (sealedSet.has(sh.dr) && Math.hypot(me.x - sh.doorPt.x, me.z - sh.doorPt.z) < 2.1) {
          entrySide = sh.dr.side;
          sealedSet = new Set(chooseSealedDoors(c.room.doors, entrySide));
          break;
        }
      }
    }

    if (cascade.active || (cascade.unlocked && (cascade.shutterOpen < 1 || cascade.bridgeDrop < 1))) {
      const prev = cascade.litTier;
      const res = stepBellCascade(cascade, { dt });
      cascade = res.state;
      if (res.clackedTier >= 0 && res.clackedTier !== prev) {
        c.env.play('clack', bellWorld.x, bellWorld.z, 14);
        // The moment Tier 1 flickers out & back on, the distant chasm watcher vanishes!
        if (res.clackedTier >= 1) watcherNode.visible = false;
      }
      if (res.bridgeLanded) {
        gangwayLampRed.visible = false;
        gangwayLampGreen.visible = true;
        hoistCableNode.visible = false;
        c.env.play('thunk', gwWorld.x, gwWorld.z, 18);
        c.env.interfere(0.18);
      }
    }

    // Animate hinged express gangway drop
    const gwEase = smooth(cascade.bridgeDrop);
    gangwayNode.rotation.x = GANGWAY_HINGE.raisedPitch * (1 - gwEase);

    // Update doorway shutter animations & colliders (never arm collider while standing inside doorway throat)
    for (const sh of shutters) {
      if (sh.rattle > 0) sh.rattle = Math.max(0, sh.rattle - dt);
      const isSealed = sealedSet.has(sh.dr) && cascade.shutterOpen < 0.72;
      // The shutter is a wall to walk into, and the doorway behind it is marked shut (world.throats): everything
      // else that walks plans its way by which doorways are open, and would otherwise set off through steel. A
      // doorway that was already shut for a reason of its own (a fire door nobody has pushed) is left as it was.
      const throat = c.world.throats[sh.dr.link];
      if (!isSealed) {
        sh.col.on = false;
        if (sh.shut) { if (throat) throat.open = true; sh.shut = false; }
      } else if (!sh.col.on) {
        // (never brought down on anybody: not on the visitor, not on anything with a body that is standing in it)
        const inThroat = Math.hypot(me.x - sh.doorPt.x, me.z - sh.doorPt.z) < 0.62
          || c.world.bodies.some((b) => Math.hypot(b.x - sh.wDoor.x, b.z - sh.wDoor.z) < 0.62 + (b.r || 0.2));
        if (!inThroat) { sh.col.on = true; if (throat && throat.open) { throat.open = false; sh.shut = true; } }
      }
    }
    applyShutterVisuals(t);

    cascadeStrips.forEach((grp, idx) => {
      const m = grp.userData.mesh;
      if (!m) return;
      const hot = cascade.active && cascade.litTier === idx;
      const flicker = Math.sin(t * 19.0 + idx * 4.1) > 0.88 ? 0.04 : 0.16;
      const pulse = hot ? 2.2 : flicker;
      m.material.uniforms?.uTint?.value.set(pulse, pulse * 0.98, pulse * 0.78);
    });
  });
}
