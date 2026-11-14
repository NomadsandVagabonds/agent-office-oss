// Set Piece 4: The Sub-Floor Chasm (`server-chasm`)
// The damp Backrooms carpet rips away just past the threshold into a 5-story
// ruptured subterranean shaft: sheared cross-sections of yellow-wallpapered
// floors with wooden doors opening onto a 50-foot vertical drop, rusted iron
// catwalks over a blood-crimson pit of cable-choked 1980s mainframe monoliths,
// a stranded wooden desk + beige CRT on an isolated spire, and a gaunt figure
// watching silently from a lit doorway across the void.
import * as THREE from 'three';
import { Vox, M, glow } from '../../vox/vox.js';
import { buildCharacter, JOINT } from '../../avatar/build.js';
import { Batch, lin, drawText, WHITE } from '../kit.js';
import { P, card, framed, scatter } from '../bits.js';
import {
  pallorLook, mottleHead, stretchHead, eraseNose, hollowSocket, slippedMouth, jointMat,
} from '../uncanny.js';
import {
  chasmZones, chasmWalkable, createChasmState, stepChasm,
} from './server-chasm/rule.js';

const RUST_GIRDER = [0.16, 0.10, 0.08];
const RUST_RAIL = [0.24, 0.15, 0.11];
const IRON_DARK = [0.07, 0.07, 0.08];
const CONCRETE_SLAB = [0.22, 0.21, 0.18];
const REBAR_RUST = [0.28, 0.14, 0.09];
const ABYSS_VOID = [0.006, 0.005, 0.006];
const CABLE_BLACK = [0.03, 0.03, 0.035];
const DOOR_WOOD = [0.28, 0.18, 0.11];

/** Corroded cast-iron electrical knife-switch breaker box on rusted post. */
function breakerBoxVox() {
  const v = new Vox();
  const post = M('#171615', 0), cab = M('#2d2b27', 0), rust = M('#4d2919', 0), lever = M('#7d2119', 0);
  v.box(-4, 0, -3, 4, 34, 3, post);
  v.box(-7, 18, -5, 7, 38, 5, cab);
  v.box(-7, 18, 4, -2, 24, 5, rust);
  // Heavy iron throw-knife lever & dim amber pilot lamp
  v.box(3, 23, 5, 6, 33, 9, lever);
  v.box(-5, 32, 5, -2, 35, 6, glow('#d97824'));
  v.box(-5, 25, 5, 1, 29, 6, M('#9e9580', 0));
  return v;
}

/** Dingy 1990s beige CRT monitor sitting on the stranded spire desk. */
function spireCrtVox() {
  const v = new Vox();
  const beige = M('#b8ae96', 0), darkBeige = M('#8f8671', 0), bezel = M('#161615', 0);
  // Swivel pedestal base
  v.box(-6, 0, -5, 6, 2, 5, darkBeige);
  v.box(-3, 2, -3, 3, 5, 3, darkBeige);
  // Bulky tapered CRT rear tube housing + recessed front bezel (facing +z)
  v.box(-8, 5, -9, 8, 17, -2, darkBeige);
  v.box(-11, 4, -2, 11, 20, 6, beige);
  v.carve(-8, 7, 6, 8, 17, 6);
  v.box(-8, 7, 5, 8, 17, 5, bezel);
  // Power LED
  v.set(9, 5, 6, glow('#d93829'));
  return v;
}

/** Tall gaunt watcher standing motionless inside the high open doorway across the chasm. */
function makeDoorwayWatcherParts() {
  const look = pallorLook({
    skin: '#cfc8b4', hair: 'short', hairColor: '#181614',
    outfit: 'jacket', outfitColor: '#262522',
  }, { pallor: 0.65, tint: '#c8c2ae' });
  const parts = buildCharacter(look, { seed: 'sc:watcher' });
  const skinHex = look.skin;
  eraseNose(parts.head);
  mottleHead(parts.head, skinHex, 73, { gaunt: 0.48 });
  stretchHead(parts.head, 11, 46);
  hollowSocket(parts.head, -4.5, 50, 4, 5, skinHex, { ember: true });
  hollowSocket(parts.head, 3.5, 49, 4, 5, skinHex, { ember: true });
  slippedMouth(parts.head, 0, 38, 8, 3, skinHex, { slope: -0.25, teeth: false });
  return parts;
}

/** Corroded dark-iron catwalk grating with rust patches & pitch-black holes to the pit below. */
function makeGrateTex(kit) {
  return kit.tex.custom('sc:grate', 64, 64, (g, w, h) => {
    P(g, '#181615', 0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      P(g, '#2b2622', 0, y, w, 2);
      for (let x = ((y / 8) % 2) * 4; x < w; x += 8) {
        P(g, '#040405', x + 1, y + 2, 5, 5);
        P(g, '#3b281e', x, y + 2, 1, 5);
      }
    }
    P(g, '#4a2c1d', 8, 14, 18, 6);
    P(g, '#4a2c1d', 38, 42, 16, 8);
    P(g, '#332c26', 0, 0, w, 2);
    P(g, '#332c26', 0, 0, 2, h);
  });
}

/** Soot-stained 1980s charcoal-iron mainframe & magnetic-tape monolith face (red/amber fault pinpricks). */
function makeMainframeTex(kit) {
  return kit.tex.custom('sc:mainframe', 128, 128, (g, w, h) => {
    P(g, '#070708', 0, 0, w, h);
    let s = 91823;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let y = 4; y < h; y += 16) {
      P(g, '#121213', 3, y, 58, 13);
      P(g, '#121213', 67, y, 58, 13);
      for (const ox of [5, 69]) {
        if (r() < 0.34) {
          // Dead 1980s dual magnetic-tape reel window
          P(g, '#09090a', ox + 2, y + 1, 32, 10);
          P(g, '#38342e', ox + 5, y + 2, 9, 8);
          P(g, '#38342e', ox + 19, y + 2, 9, 8);
          P(g, '#121110', ox + 8, y + 4, 3, 4);
          P(g, '#121110', ox + 22, y + 4, 3, 4);
        } else {
          // Rusted exhaust louvers
          for (let vx = 0; vx < 34; vx += 6) P(g, '#090808', ox + vx, y + 2, 4, 8);
        }
        // Sparse blood-red & dim-amber fault LEDs (no bright sci-fi cyan!)
        for (let lx = 39; lx < 53; lx += 5) {
          const v = r();
          if (v < 0.46) continue;
          const col = v < 0.80 ? '#b82218' : v < 0.95 ? '#b8681e' : '#6e8c4a';
          P(g, col, ox + lx, y + 4, 2, 2);
        }
      }
      // Rust streak down cabinet seam
      if (r() < 0.4) P(g, 'rgba(64, 30, 16, 0.45)', 62, y, 3, 16);
    }
  });
}

function drawTerminalScreen(g, w, h, p, flushed) {
  P(g, flushed ? '#050d07' : '#140605', 0, 0, w, h);
  P(g, flushed ? '#14381c' : '#5e140e', 0, 0, w, 20);
  drawText(g, [flushed ? 'UMBILICAL SEVERED' : `SUB-LEVEL ${p.plenum} · LIVE FEED`], 0, 2, w, 16, {
    color: flushed ? '#8de29a' : '#f2c6b6', size: 9,
  });
  drawText(g, flushed ? [
    `NODE ${p.nodeA}: OFFLINE`,
    'DOORWAY 02: VACATED',
    'DO NOT LOOK UP',
  ] : [
    `TRUNK [${p.nodeA}]: DRAWING`,
    `TRUNK [${p.nodeB}]: LISTENING`,
    '[E] SEVER UMBILICAL',
  ], 8, 26, w - 16, h - 30, {
    color: flushed ? '#7ad88b' : '#e8967e', size: 9, pad: 5,
  });
}

/** Add corroded iron catwalk deck + bent/gapped rusted handrails (`['N','S','E','W']`). */
function buildCatwalk(grateB, flatB, x0, z0, x1, z1, rails = [], openCenterN = false) {
  grateB.box(x0, -0.13, z0, x1, 0, z1, WHITE, { uv: 1.25 });
  flatB.box(x0 - 0.04, -0.22, z0 - 0.04, x1 + 0.04, -0.12, z1 + 0.04, RUST_GIRDER);

  const addRail = (rx0, rz0, rx1, rz1, brokenMid = false) => {
    flatB.box(rx0, 0.94, rz0, rx1, 0.99, rz1, RUST_RAIL);
    if (!brokenMid) flatB.box(rx0, 0.46, rz0, rx1, 0.50, rz1, IRON_DARK);
    flatB.box(rx0, 0, rz0, rx1, 0.07, rz1, RUST_GIRDER);
    const lenX = rx1 - rx0, lenZ = rz1 - rz0;
    const steps = Math.max(1, Math.round(Math.max(lenX, lenZ) / 1.4));
    for (let i = 0; i <= steps; i++) {
      const px = rx0 + (lenX * i) / steps, pz = rz0 + (lenZ * i) / steps;
      flatB.box(px - 0.03, 0, pz - 0.03, px + 0.03, 1.00, pz + 0.03, IRON_DARK);
    }
  };

  for (const side of rails) {
    if (side === 'N') {
      if (openCenterN) {
        if (-1.08 - x0 > 0.25) addRail(x0, z0 - 0.03, -1.08, z0 + 0.03, true);
        if (x1 - 1.08 > 0.25) addRail(1.08, z0 - 0.03, x1, z0 + 0.03);
      } else {
        addRail(x0, z0 - 0.03, x1, z0 + 0.03);
      }
    } else if (side === 'S') {
      if (openCenterN === 'both' || openCenterN === 'S') {
        if (-1.08 - x0 > 0.25) addRail(x0, z1 - 0.03, -1.08, z1 + 0.03);
        if (x1 - 1.08 > 0.25) addRail(1.08, z1 - 0.03, x1, z1 + 0.03, true);
      } else {
        addRail(x0, z1 - 0.03, x1, z1 + 0.03);
      }
    } else if (side === 'W') {
      addRail(x0 - 0.03, z0, x0 + 0.03, z1, true);
    } else if (side === 'E') {
      addRail(x1 - 0.03, z0, x1 + 0.03, z1);
    }
  }
}

/** Heavy sagging black umbilical cable catenary draped across the abyss. */
function addCableSag(flatB, p0, p1, sag = 1.4, thick = 0.024, segs = 14) {
  let prev = p0;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const nx = p0[0] + (p1[0] - p0[0]) * t;
    const nz = p0[2] + (p1[2] - p0[2]) * t;
    const ny = p0[1] + (p1[1] - p0[1]) * t - Math.sin(t * Math.PI) * sag;
    flatB.box(
      Math.min(prev[0], nx) - thick, Math.min(prev[1], ny) - thick, Math.min(prev[2], nz) - thick,
      Math.max(prev[0], nx) + thick, Math.max(prev[1], ny) + thick, Math.max(prev[2], nz) + thick,
      CABLE_BLACK, { step: 3 },
    );
    prev = [nx, ny, nz];
  }
}

export function build(c) {
  const { W, D, H, kit, params: p } = c;
  // Open 3-sided subterranean shaft: only the entry `front` wall uses the standard shell
  c.shell({ walls: ['front'], floor: false, ceiling: false, panels: false, sockets: false });

  let state = createChasmState();
  c.rt.clip = (x, z, r) => chasmWalkable(x, z, r, W, D, state);
  c.rt.headY = () => H + 2.0;

  const Z = chasmZones(W, D);
  const grateTex = makeGrateTex(kit);
  const grateB = c.mapped('sc:grate', grateTex);
  const mainframeTex = makeMainframeTex(kit);
  const mainframeB = c.shining('sc:mainframe', mainframeTex, 1.05);
  const doorGlowB = c.shining('sc:doorglow', kit.tex.white(), 1.45, lin('#d8c878'));

  // ---------------------------------------------------------------------------
  // 1. Ruptured 5-Story Yellow-Wallpaper Backrooms Shaft (`y = -15.0m .. +10.2m`)
  // ---------------------------------------------------------------------------
  const shaftW = W / 2 + 6.8;
  const shaftBack = -D / 2 - 14.5;
  const yBot = -15.0, yTop = 10.2;

  // Pitch-black abyss floor & upper shaft lid
  c.flat.box(-shaftW - 0.8, yBot - 0.5, shaftBack - 1.2, shaftW + 0.8, yBot, D / 2 + 0.5, ABYSS_VOID, { step: 8 });
  c.flat.box(-shaftW - 0.8, yTop, shaftBack - 1.2, shaftW + 0.8, yTop + 0.5, D / 2 + 0.5, ABYSS_VOID, { step: 8 });
  // Outer black void backing behind the ruptured doorways
  c.flat.box(-shaftW - 0.9, yBot, shaftBack - 1.3, -shaftW - 0.4, yTop, D / 2 + 0.4, ABYSS_VOID, { step: 8 });
  c.flat.box(shaftW + 0.4, yBot, shaftBack - 1.3, shaftW + 0.9, yTop, D / 2 + 0.4, ABYSS_VOID, { step: 8 });
  c.flat.box(-shaftW - 0.8, yBot, shaftBack - 1.3, shaftW + 0.8, yTop, shaftBack - 0.8, ABYSS_VOID, { step: 8 });

  // Front sub-cliff wall below the entry balcony (`z = D/2`) and above `H`
  c.wall.box(-shaftW, yBot, D / 2 - 0.04, shaftW, 0, D / 2 + 0.25, [0.42, 0.39, 0.31], { uv: 1.25, step: 6 });
  c.wall.box(-shaftW, 0, D / 2 - 0.04, -W / 2, yTop, D / 2 + 0.25, [0.58, 0.55, 0.44], { uv: 1.25, step: 5 });
  c.wall.box(W / 2, 0, D / 2 - 0.04, shaftW, yTop, D / 2 + 0.25, [0.58, 0.55, 0.44], { uv: 1.25, step: 5 });
  c.wall.box(-W / 2, H, D / 2 - 0.04, W / 2, yTop, D / 2 + 0.25, [0.58, 0.55, 0.44], { uv: 1.25, step: 4 });

  // Build 7 stacked sheared Backrooms office stories around the 3 chasm walls!
  const storyYs = [-12.8, -9.6, -6.4, -3.2, 0.0, 3.2, 6.4];
  for (let sIdx = 0; sIdx < storyYs.length; sIdx++) {
    const sy = storyYs[sIdx];
    const sh = 2.92;
    const depthFade = Math.max(0.28, Math.min(0.76, 0.52 + sy * 0.032));
    const wallAlb = [depthFade, depthFade * 0.95, depthFade * 0.78];

    // Sheared concrete floor-slab ledge + fringe of torn beige carpet + rusted rebar stubs
    c.flat.box(-shaftW - 0.4, sy - 0.28, shaftBack - 0.7, -shaftW + 0.62, sy, D / 2, CONCRETE_SLAB, { step: 6 });
    c.flat.box(shaftW - 0.62, sy - 0.28, shaftBack - 0.7, shaftW + 0.4, sy, D / 2, CONCRETE_SLAB, { step: 6 });
    c.flat.box(-shaftW - 0.4, sy - 0.28, shaftBack - 0.8, shaftW + 0.4, sy, shaftBack + 0.72, CONCRETE_SLAB, { step: 6 });

    c.floor.box(-shaftW, sy, shaftBack, -shaftW + 0.48, sy + 0.025, D / 2 - 0.5, wallAlb, { uv: 1.6, step: 6 });
    c.floor.box(shaftW - 0.48, sy, shaftBack, shaftW, sy + 0.025, D / 2 - 0.5, wallAlb, { uv: 1.6, step: 6 });
    c.floor.box(-shaftW, sy, shaftBack, shaftW, sy + 0.025, shaftBack + 0.58, wallAlb, { uv: 1.6, step: 6 });

    // Protruding snapped rebar rods along sheared slab lips
    if (sy >= -6.4 && sy <= 6.4) {
      for (let rx = -shaftW + 2.5; rx <= shaftW - 2.5; rx += 4.2) {
        c.flat.box(rx - 0.03, sy - 0.16, shaftBack + 0.72, rx + 0.03, sy - 0.10, shaftBack + 1.18, REBAR_RUST);
      }
    }

    // Yellow-striped Backrooms walls for each story, with wooden doors & open doorways onto the abyss!
    c.wall.box(-shaftW - 0.35, sy, shaftBack, -shaftW, sy + sh, D / 2, wallAlb, { uv: 1.25, step: 6 });
    c.wall.box(shaftW, sy, shaftBack, shaftW + 0.35, sy + sh, D / 2, wallAlb, { uv: 1.25, step: 6 });

    if (Math.abs(sy - 3.2) < 0.05) {
      // Story +3.2m on the far chasm wall has a tall OPEN yellow-lit corridor mouth at x ∈ [-0.88, +0.88]!
      c.wall.box(-shaftW, sy, shaftBack - 0.35, -0.88, sy + sh, shaftBack, wallAlb, { uv: 1.25, step: 5 });
      c.wall.box(0.88, sy, shaftBack - 0.35, shaftW, sy + sh, shaftBack, wallAlb, { uv: 1.25, step: 5 });
      c.wall.box(-0.88, sy + 2.48, shaftBack - 0.35, 0.88, sy + sh, shaftBack, wallAlb, { uv: 1.25, step: 2 });
      // Wooden door frame around the open void doorway
      c.flat.box(-0.95, sy, shaftBack - 0.04, -0.87, sy + 2.52, shaftBack + 0.06, DOOR_WOOD);
      c.flat.box(0.87, sy, shaftBack - 0.04, 0.95, sy + 2.52, shaftBack + 0.06, DOOR_WOOD);
      c.flat.box(-0.95, sy + 2.46, shaftBack - 0.04, 0.95, sy + 2.54, shaftBack + 0.06, DOOR_WOOD);
    } else {
      c.wall.box(-shaftW, sy, shaftBack - 0.35, shaftW, sy + sh, shaftBack, wallAlb, { uv: 1.25, step: 6 });
    }

    // Closed / half-open wooden office doors stranded on the sheer chasm walls Opening Into Nothing!
    if (sy === 0.0 || sy === -3.2 || sy === 6.4) {
      const dx = sy === 0.0 ? -4.8 : 4.6;
      c.flat.box(dx - 0.48, sy + 0.02, shaftBack + 0.01, dx + 0.48, sy + 2.12, shaftBack + 0.07, DOOR_WOOD);
      c.flat.box(dx + 0.32, sy + 0.98, shaftBack + 0.07, dx + 0.40, sy + 1.04, shaftBack + 0.12, [0.68, 0.58, 0.32]);
      // Side chasm wall stranded wooden doors
      const dz = sy === 0.0 ? -3.4 : -8.8;
      c.flat.box(-shaftW + 0.01, sy + 0.02, dz - 0.46, -shaftW + 0.07, sy + 2.12, dz + 0.46, DOOR_WOOD);
      c.flat.box(shaftW - 0.07, sy + 0.02, dz + 1.8 - 0.46, shaftW - 0.01, sy + 2.12, dz + 1.8 + 0.46, DOOR_WOOD);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Torn Carpet Entry Lip, Rusted Dark-Iron Catwalks, Pylon & Central Spire
  // ---------------------------------------------------------------------------
  const bx0 = -W / 2 + 0.30, bx1 = W / 2 - 0.30, zBalc = Z.balcony.z0;
  // Jagged torn strip of damp Backrooms carpet & broken acoustic ceiling clinging to the entry wall!
  c.floor.box(-W / 2, -0.02, D / 2 - 1.28, W / 2, 0.012, D / 2, [0.64, 0.61, 0.50], { uv: 1.6, step: 3 });
  c.flat.box(-W / 2, -0.26, D / 2 - 1.34, W / 2, 0.005, D / 2 - 1.24, CONCRETE_SLAB, { step: 3 });
  c.ceil.box(-W / 2, H, D / 2 - 1.85, W / 2, H + 0.08, D / 2, [0.58, 0.56, 0.48], { uv: 0.6, step: 3 });
  c.hole(-2.4, D / 2 - 1.2, 2);
  c.hole(2.2, D / 2 - 1.2, 2);
  c.blot(0, D / 2 - 1.05, 3.6, 1.4, { rgb: [0.04, 0.03, 0.02], a: 0.58, y: 0.015 });

  // Corroded iron balcony grating cantilevered beyond the torn carpet edge
  grateB.box(bx0, -0.13, zBalc, bx1, 0, D / 2 - 1.24, WHITE, { uv: 1.25 });
  c.flat.box(bx0 - 0.04, -0.24, zBalc - 0.04, bx1 + 0.04, -0.12, D / 2, RUST_GIRDER, { step: 4 });
  buildCatwalk(grateB, c.flat, bx0 + 2.3, zBalc, bx1 - 2.3, zBalc + 0.12, ['N'], true);
  buildCatwalk(grateB, c.flat, Z.wingL.x0, Z.wingL.z0, Z.wingL.x1, zBalc, ['N', 'W', 'E']);
  buildCatwalk(grateB, c.flat, Z.wingR.x0, Z.wingR.z0, Z.wingR.x1, zBalc, ['N', 'W', 'E']);
  buildCatwalk(grateB, c.flat, bx0, zBalc, bx0 + 0.12, D / 2, ['W']);
  buildCatwalk(grateB, c.flat, bx1 - 0.12, zBalc, bx1, D / 2, ['E']);

  // Mid-Chasm Relay Pylon + rusted lattice column plunging into `-15m` pit
  buildCatwalk(grateB, c.flat, Z.pylon.x0, Z.pylon.z0, Z.pylon.x1, Z.pylon.z1, ['W', 'E']);
  c.flat.box(-0.52, yBot, 0.58, 0.52, -0.2, 1.22, IRON_DARK, { step: 5 });

  // Central Spire Island: sheared concrete & iron-grate pillar stranded in the middle of the chasm
  buildCatwalk(grateB, c.flat, Z.spire.x0, Z.spire.z0, Z.spire.x1, Z.spire.z1, ['N', 'W', 'E', 'S'], 'S');
  // Patch of damp torn Backrooms carpet stranded under the spire desk!
  c.floor.box(-1.35, 0.002, -4.25, 1.35, 0.016, -2.55, [0.58, 0.55, 0.45], { uv: 1.5, step: 2 });
  c.flat.box(-1.18, yBot, -3.95, 1.18, -0.2, -1.85, CONCRETE_SLAB, { step: 5 });

  // ---------------------------------------------------------------------------
  // 3. Two Retractable Rusted Iron Gangways (`bridge1` & `bridge2`)
  // ---------------------------------------------------------------------------
  const makeBridge = (zStart, zEnd) => {
    const b = new Batch();
    const len = zStart - zEnd;
    b.box(-1.02, -0.11, zEnd, 1.02, -0.01, zStart, [0.20, 0.16, 0.14]);
    for (const sx of [-1.02, 0.96]) {
      b.box(sx, 0, zEnd, sx + 0.06, 0.90, zStart, RUST_RAIL);
      b.box(sx, 0, zEnd, sx + 0.06, 0.07, zStart, IRON_DARK);
      for (let s = 0; s <= 3; s++) {
        const pz = zEnd + (len * s) / 3;
        b.box(sx, 0, pz - 0.03, sx + 0.06, 0.92, pz + 0.03, IRON_DARK);
      }
    }
    return { holder: c.dynamic(b, { pivot: [0, 0, zStart] }), len };
  };
  const bridge1 = makeBridge(zBalc, Z.pylon.z1);
  const bridge2 = makeBridge(Z.pylon.z0, Z.spire.z1);
  bridge1.holder.scale.z = 0.06;
  bridge2.holder.scale.z = 0.06;

  // ---------------------------------------------------------------------------
  // 4. Twelve Soot-Black 1980s Mainframe Monoliths & Feral Umbilical Cable Webs
  // ---------------------------------------------------------------------------
  const rackRowsZ = [0.6, -4.8, -10.0, -13.6];
  const rackColsX = [-shaftW + 2.6, -5.0, 5.0, shaftW - 2.6];
  const surgeBands = [new Batch(), new Batch(), new Batch()];
  const surgeYs = [-8.2, -2.2, 3.8];

  for (const rz of rackRowsZ) {
    for (const rx of rackColsX) {
      if (Math.abs(rx) < 3.0) continue;
      const rw = 1.02, rd = 1.02;
      c.flat.box(rx - rw, yBot, rz - rd, rx + rw, yTop - 1.6, rz + rd, IRON_DARK, { step: 6 });
      const vTop = (yTop - 1.8 - yBot) / 2.4;
      const uv = [[0, 0], [1, 0], [1, vTop], [0, vTop]];
      mainframeB.quad([rx - rw + 0.08, yBot, rz + rd + 0.015], [rx + rw - 0.08, yBot, rz + rd + 0.015], [rx + rw - 0.08, yTop - 1.8, rz + rd + 0.015], [rx - rw + 0.08, yTop - 1.8, rz + rd + 0.015], WHITE, uv);
      mainframeB.quad([rx + rw - 0.08, yBot, rz - rd - 0.015], [rx - rw + 0.08, yBot, rz - rd - 0.015], [rx - rw + 0.08, yTop - 1.8, rz - rd - 0.015], [rx + rw - 0.08, yTop - 1.8, rz - rd - 0.015], WHITE, uv);
      if (rx < 0) {
        mainframeB.quad([rx + rw + 0.015, yBot, rz + rd - 0.08], [rx + rw + 0.015, yBot, rz - rd + 0.08], [rx + rw + 0.015, yTop - 1.8, rz - rd + 0.08], [rx + rw + 0.015, yTop - 1.8, rz + rd - 0.08], WHITE, uv);
      } else {
        mainframeB.quad([rx - rw - 0.015, yBot, rz - rd + 0.08], [rx - rw - 0.015, yBot, rz + rd - 0.08], [rx - rw - 0.015, yTop - 1.8, rz + rd - 0.08], [rx - rw - 0.015, yTop - 1.8, rz - rd + 0.08], WHITE, uv);
      }

      surgeYs.forEach((sy, sIdx) => {
        surgeBands[sIdx].box(rx - rw - 0.04, sy, rz - rd - 0.04, rx + rw + 0.04, sy + 0.14, rz + rd + 0.04, WHITE);
      });
    }
  }
  const surgeGroups = surgeBands.map((b) => c.dynamic(b, { unlit: true }));

  // Sagging feral black umbilical cables draping from broken upper floors into the spire & monoliths!
  addCableSag(c.flat, [-shaftW + 0.4, 6.4, -2.0], [-5.0, 2.2, -4.8], 1.8, 0.055);
  addCableSag(c.flat, [shaftW - 0.4, 6.4, -2.2], [5.0, 2.0, -4.8], 1.9, 0.055);
  addCableSag(c.flat, [-5.0, 1.8, -4.8], [-0.25, 0.72, -3.75], 1.35, 0.05);
  addCableSag(c.flat, [5.0, 1.8, -4.8], [0.25, 0.72, -3.75], 1.45, 0.05);
  addCableSag(c.flat, [0, 3.2, shaftBack + 0.6], [0, 0.65, -4.1], 2.6, 0.06, 9);
  addCableSag(c.flat, [-5.0, 3.8, 0.6], [5.0, 3.6, 0.6], 1.5, 0.045);

  // Two slow, grinding rusted exhaust fans deep on the far chasm wall
  const fanGroups = [];
  for (const fx of [-5.8, 5.8]) {
    const fy = -1.4, fz = shaftBack + 0.25;
    c.flat.box(fx - 1.9, fy - 1.9, fz - 0.2, fx + 1.9, fy - 1.6, fz + 0.2, RUST_GIRDER);
    c.flat.box(fx - 1.9, fy + 1.6, fz - 0.2, fx + 1.9, fy + 1.9, fz + 0.2, RUST_GIRDER);
    c.flat.box(fx - 1.9, fy - 1.6, fz - 0.2, fx - 1.6, fy + 1.6, fz + 0.2, RUST_GIRDER);
    c.flat.box(fx + 1.6, fy - 1.6, fz - 0.2, fx + 1.9, fy + 1.6, fz + 0.2, RUST_GIRDER);
    doorGlowB.quad([fx - 1.6, fy - 1.6, fz - 0.14], [fx + 1.6, fy - 1.6, fz - 0.14], [fx + 1.6, fy + 1.6, fz - 0.14], [fx - 1.6, fy + 1.6, fz - 0.14], [0.42, 0.08, 0.05], [[0, 0], [1, 0], [1, 1], [0, 1]]);

    const fb = new Batch();
    fb.box(fx - 0.25, fy - 0.25, fz, fx + 0.25, fy + 0.25, fz + 0.16, IRON_DARK);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const dx = Math.cos(a) * 1.48, dy = Math.sin(a) * 1.48;
      const wx = -Math.sin(a) * 0.20, wy = Math.cos(a) * 0.20;
      fb.quad([fx - wx, fy - wy, fz + 0.08], [fx + wx, fy + wy, fz + 0.08], [fx + dx + wx, fy + dy + wy, fz + 0.04], [fx + dx - wx, fy + dy - wy, fz + 0.04], RUST_GIRDER);
    }
    fanGroups.push(c.dynamic(fb, { pivot: [fx, fy, fz + 0.08] }));
  }

  // ---------------------------------------------------------------------------
  // 5. High Lit Void Doorway & Gaunt Watcher Across the Chasm (`y = +3.2m`)
  // ---------------------------------------------------------------------------
  const doorBackB = new Batch();
  doorBackB.quad([-0.87, 3.2, shaftBack - 0.32], [0.87, 3.2, shaftBack - 0.32], [0.87, 5.66, shaftBack - 0.32], [-0.87, 5.66, shaftBack - 0.32], [0.85, 0.78, 0.44]);
  const doorwayLitHolder = c.dynamic(doorBackB, { unlit: true });

  const wParts = makeDoorwayWatcherParts();
  const wBatch = new Batch(true);
  const wScl = [0.027, 0.039, 0.027]; // ~2.05m tall gaunt silhouette!
  const wPos = [0, 3.22, shaftBack + 0.34];
  const wTr = new THREE.Matrix4().makeTranslation(wPos[0], wPos[1], wPos[2]);
  const wAt = (j, rx = 0, ry = 0, rz = 0, sy = 1) => wTr.clone().multiply(jointMat(wScl, j, rx, ry, rz, sy));
  const addW = (k, vox, m4) => { const g = kit.model(`sc:w:${k}`, () => vox); if (g?.solid) wBatch.addVox(g.solid, m4); };
  addW('t', wParts.torso, wAt(JOINT.hips, 0.04, 0, 0));
  addW('h', wParts.head, wAt(JOINT.head, 0.14, 0, 0.06));
  addW('aul', wParts.armUpperL, wAt(JOINT.shoulderL, 0.04, 0, 0.04, 1.22));
  addW('all', wParts.armLowerL, wAt(JOINT.shoulderL, 0.04, 0, 0.04, 1.22));
  addW('aur', wParts.armUpperR, wAt(JOINT.shoulderR, 0.04, 0, -0.04, 1.22));
  addW('alr', wParts.armLowerR, wAt(JOINT.shoulderR, 0.04, 0, -0.04, 1.22));
  addW('lul', wParts.legUpperL, wAt(JOINT.hipL, 0, 0, 0, 1.15));
  addW('lll', wParts.legLowerL, wAt(JOINT.hipL, 0, 0, 0, 1.15));
  addW('lur', wParts.legUpperR, wAt(JOINT.hipR, 0, 0, 0, 1.15));
  addW('llr', wParts.legLowerR, wAt(JOINT.hipR, 0, 0, 0, 1.15));
  const watcherHolder = c.dynamic(wBatch, { pivot: wPos });

  // ---------------------------------------------------------------------------
  // 6. Knife-Switch Breakers on Balcony + Stranded Wooden Desk & Beige CRT on Spire
  // ---------------------------------------------------------------------------
  const brk1X = -2.05, brk2X = 2.05, brkZ = zBalc + 0.35;
  c.model('sc:breaker', breakerBoxVox, brk1X, brkZ, { rot: 0, solid: true, shadow: false });
  c.model('sc:breaker', breakerBoxVox, brk2X, brkZ, { rot: 0, solid: true, shadow: false });

  const warnSpot = c.wallSpot(1.5, ['front']);
  if (warnSpot) {
    const sign = card(c, `sc:warn:${p.plenum}`, [
      `FLOOR RUPTURE · SHAFT ${p.plenum}`,
      'ENGAGE BOTH KNIFE BREAKERS',
      'DO NOT APPROACH FAR LEDGES',
    ], { w: 196, h: 74, bg: '#cfc5a8', fg: '#1d1712', edge: '#6e1d14', size: 9, pad: 8 });
    framed(c, c.mapped('sc:warn', sign), warnSpot.side, warnSpot.at, 1.50, 1.24, 0.46, null, [0.16, 0.11, 0.08]);
  }

  // Stranded 1990s Backrooms office workstation on the central chasm spire!
  const termZ = -3.65;
  c.prop('desk', 0, termZ, { rot: 0, solid: true, shadow: false });
  c.prop('chair', -0.95, termZ - 0.45, {
    y: 0.28, rot: 0.8, tilt: [Math.PI / 2, -0.25], solid: false, shadow: false,
  });
  c.prop('keyboard', 0, termZ + 0.22, { y: 0.74, rot: 0.08, solid: false, shadow: false });
  scatter(c, 0.55, termZ + 0.75, 5, 0.65, '#cfc5a8');

  c.model('sc:spirecrt', spireCrtVox, 0, termZ - 0.05, { y: 0.74, rot: 0, solid: false, shadow: false });
  const termTex = kit.tex.live(192, 112, (g, w, h) => drawTerminalScreen(g, w, h, p, false), { clamp: true });
  c.board(c.shining('sc:termscreen', termTex, 1.55), 0, 1.05, termZ + 0.106, 0.41, 0.26, 0);

  // ---------------------------------------------------------------------------
  // 7. Oppressive High-Contrast Lighting: Dying Tube Above, Blood-Crimson Pit Below
  // ---------------------------------------------------------------------------
  // Lone flickering yellow-green tube on the torn entry ceiling fragment
  {
    const fx = 0, fz = D / 2 - 0.88;
    const fb = new Batch();
    fb.quad([fx - 0.3, H - 0.006, fz - 0.6], [fx + 0.3, H - 0.006, fz - 0.6], [fx + 0.3, H - 0.006, fz + 0.6], [fx - 0.3, H - 0.006, fz + 0.6], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    const fMesh = new THREE.Mesh(kit.plain(fb), kit.glowing(kit.tex.panel(true), 2.0, lin('#cfd896')));
    fMesh.userData.on = fMesh.material.color.clone();
    c.rt.flickers.push(fMesh);
    c.rt.group.add(fMesh);
    c.light(fx, H - 0.3, fz, '#cbd492', 1.35, { far: 9.5, flick: true, k: 1.7 });
  }
  // Dim amber pilot lamps at the two rusted knife-switch breakers
  c.light(brk1X, 1.55, brkZ + 0.35, '#d97828', 0.85, { far: 4.5 });
  c.light(brk2X, 1.55, brkZ + 0.35, '#d97828', 0.85, { far: 4.5 });
  // Eerie pale glow around the stranded spire CRT workstation
  c.light(0, 1.65, termZ + 0.45, '#d98c6c', 1.55, { far: 7.5 });
  // Deep blood-crimson subterranean abyss glow rising through the open iron grates!
  c.light(-4.8, -5.5, -3.5, '#9e1910', 2.6, { far: 19 });
  c.light(4.8, -5.5, -3.5, '#9e1910', 2.6, { far: 19 });
  c.light(0, -8.5, -9.5, '#8c140c', 3.0, { far: 22 });
  // Sickly yellow Backrooms corridor spill on the gaunt Watcher across the chasm
  c.light(0, 4.4, shaftBack + 1.2, '#d8c874', 2.2, { far: 12 });

  const b1World = c.toWorld(brk1X, brkZ);
  const b2World = c.toWorld(brk2X, brkZ);
  const termWorld = c.toWorld(0, termZ);

  c.use({
    x: brk1X,
    z: brkZ,
    r: 1.75,
    label: 'throw span 01 knife-breaker',
    when: () => !state.breaker1,
    use: () => {
      state = stepChasm(state, { toggle1: true }).state;
      c.env.play('clack', b1World.x, b1World.z, 12);
      c.env.play('slide', 0, (zBalc + Z.pylon.z1) / 2, 16);
    },
  });

  c.use({
    x: brk2X,
    z: brkZ,
    r: 1.75,
    label: 'throw span 02 knife-breaker',
    when: () => !state.breaker2,
    use: () => {
      state = stepChasm(state, { toggle2: true }).state;
      c.env.play('clack', b2World.x, b2World.z, 12);
      c.env.play('slide', 0, (Z.pylon.z0 + Z.spire.z1) / 2, 16);
    },
  });

  c.use({
    x: 0,
    z: termZ,
    r: 1.95,
    label: 'sever trunk umbilical',
    when: () => !state.flushed && state.ext1 >= 0.98 && state.ext2 >= 0.98,
    use: () => {
      const res = stepChasm(state, { triggerFlush: true });
      state = res.state;
      if (res.startedFlush) {
        const g = termTex.image.getContext('2d');
        drawTerminalScreen(g, 192, 112, p, true);
        termTex.needsUpdate = true;
        // Distant doorway light & gaunt Watcher snap off into darkness!
        doorwayLitHolder.visible = false;
        watcherHolder.visible = false;
        c.env.interfere(0.75);
        c.env.play('shutter', termWorld.x, termWorld.z, 18);
        c.env.play('whir', termWorld.x, termWorld.z, 20);
        c.env.sound?.air?.(0.75);
      }
    },
  });

  c.tick((dt, t) => {
    const res = stepChasm(state, { dt });
    state = res.state;

    if (res.locked1) c.env.play('thunk', 0, Z.pylon.z1, 16);
    if (res.locked2) c.env.play('thunk', 0, Z.spire.z1, 16);

    bridge1.holder.scale.z = 0.06 + 0.94 * state.ext1;
    bridge2.holder.scale.z = 0.06 + 0.94 * state.ext2;

    for (let i = 0; i < fanGroups.length; i++) {
      fanGroups[i].rotation.z += state.fanSpeed * 0.65 * dt * (i % 2 ? -1 : 1);
    }

    // Pulse blood-crimson fault bands in the pit -> cold dead phosphor-green once severed!
    surgeGroups.forEach((grp, idx) => {
      const m = grp.userData.mesh;
      if (!m?.material?.uniforms?.uTint) return;
      if (!state.flushed) {
        const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 + idx * 1.5);
        m.material.uniforms.uTint.value.set(1.35 * pulse, 0.16 * pulse, 0.09 * pulse);
      } else {
        const wave = Math.max(0, 1 - Math.abs(state.flushTime * 1.6 - idx) * 0.85);
        const cool = 0.45 + 0.95 * wave;
        m.material.uniforms.uTint.value.set(0.18 * cool, 0.85 * cool, 0.36 * cool);
      }
    });
  });
}
