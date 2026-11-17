// The Backrooms — The Offsite Reserve (`themes.js` `forest`): an indoor
// wilderness leadership retreat built inside the office by something that had
// only ever had forests, camping, and "touching grass" described to it in HR
// offsite decks and lumber invoices.
//
// Every room keeps all three Backrooms layers:
//   1. The Office: suspended acoustic ceiling tiles, humming fluorescent tubes,
//      duplex electrical outlets on the walls, and a strip of office carpet
//      showing along the skirting where the damp moss roll was cut short.
//   2. The Forest: sculpted 3 cm `Vox` pines, birches, hollow windfalls,
//      barcoded stumps, sunken peat-bog channels, and rustling dry bracken.
//   3. The Wrongness: upside-down ceiling canopies, 24-birdhouse grids,
//      corrupted 4th-hand scenic murals, and wooden bridges built carefully
//      over dry carpet beside the bog they missed.
//
// Shared exports:
//   forestRoom(c, opt)       plain-room carpet border, outlets, Spotter, and 8 WRONG oddities
//   forestStanding(c, p)     ceiling-piercing trunks & split-rail fences for quiet.js `thicket`
//   FOREST_THINGS            abandoned packs, stumps, camp lanterns, trail posts (gen.js)
//   woodlandLight(c, ...)    ceiling troffers for `panels: false` rooms within the 16-light cap
//   installForestFloor(c, .) peat-bog drag/sink, dry-bracken crouch stealth, log-bridge support
//   notchedTimber(c, spec)   hollow trunks felled with marks.js `lean` to bridge bogs/lanes
//   registerCallTarget(...)  Trail Call (`call`) whistle interaction target
//   garble / trailSign / forestMural   misremembered National-Park / HR signage & wall murals
//   Vox models & rigs        3 cm sculpted trees, stumps, tents, lanterns, Spotter, Bagworm, Facilitator

import * as THREE from 'three';
import { Vox, M, glow } from '../vox/vox.js';
import { Batch, lamp, lin, ticks, WHITE } from './kit.js';
import { TILE } from './gen.js';
import { LEAN, REFUSE, lean, pressing } from './marks.js';
import {
  FOREST,
  makeForestWalker, stepForestWalker,
  makeTimber, stepTimber, timberBridgeAt,
  SPOTTER, makeSpotter, stepSpotter,
} from './forest.rule.js';
import { gnarledPineVox, gnarledBirchVox } from './forest-models.js';
import { thicket } from './forest-thicket.js';
import {
  ensureForestDetail,
  woodlandDynamicLight,
  addLightShafts,
  castCanopyShadow,
  plenumBreach,
  dressForestWalls,
  buildForestWater,
} from './forest-fx.js';

const P = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const OFFICE_CARPET = '#827a61';
export const CEDAR_TIMBER = [0.46, 0.31, 0.19];
export const BIRCH_BARK = [0.84, 0.82, 0.76];
export const BRASS_TRIM = [0.72, 0.57, 0.24];
export const RANGER_BROWN = '#3b2618';
export const BLAZE_ORANGE = [0.92, 0.40, 0.10];

/* ---- 1. Artfully wrong lettering, signage & 4th-hand forest murals ------- */

export function garble(g, text, x, y, w, h, opt = {}, seed = 1) {
  let k = (seed * 2654435761) >>> 0;
  const r = () => { k = (Math.imul(k, 1664525) + 1013904223) >>> 0; return k / 4294967296; };
  const chars = String(text).split('');
  const mess = opt.mess ?? 0.34;
  const twin = { E: 'F', O: 'Q', I: 'L', A: 'V', M: 'W', N: 'H', S: '5', R: 'P', T: 'Y', C: 'G', U: 'V', D: '0', B: '8', K: 'X' };
  let size = opt.size || Math.floor(h * 0.68);
  const font = (px) => `${opt.weight || 700} ${px}px ui-monospace, Menlo, Consolas, monospace`;
  g.font = font(size);
  while (size > 5 && g.measureText('M').width * chars.length > w - 6) g.font = font(--size);
  const cw = g.measureText('M').width;
  const x0 = x + (w - cw * chars.length) / 2 + cw / 2;
  g.fillStyle = opt.color || '#f2cd5c';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  chars.forEach((ch, i) => {
    if (ch === ' ') { r(); r(); return; }
    const roll = r(), gone = roll < mess, kind = Math.floor(r() * 7);
    const cx = x0 + i * cw, cy = y + h / 2 + (gone ? (r() - 0.5) * size * 0.22 : 0);
    g.save();
    g.translate(cx, cy);
    if (!gone) { g.fillText(ch, 0, 0.5); g.restore(); return; }
    if (kind === 0) g.scale(-1, 1);
    else if (kind === 1) g.scale(1, -1);
    else if (kind === 2) g.rotate((r() - 0.5) * 0.62);
    else if (kind === 3) g.scale(0.58, 1.26);
    const what = kind === 4 ? (twin[ch] || ch) : kind === 5 && chars[i + 1] && chars[i + 1] !== ' ' ? chars[i + 1] : ch;
    g.fillText(what, 0, 0.5);
    if (kind === 6) { g.globalAlpha = 0.55; g.fillText(ch, cw * 0.34, 0.4); }
    g.restore();
  });
}

/** Dark amber-green stagnant peat-bog water texture with floating duckweed & pine needles. */
export function peatWaterTex(kit, variant = 'peat') {
  return kit.tex.custom('forest:water:' + variant, 64, 64, (g, w, h) => {
    P(g, variant === 'deep' ? '#121911' : '#1b2416', 0, 0, w, h);
    let s = 9187;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    // Tannin eddies & pale fluorescent reflections
    for (let i = 0; i < 42; i++) {
      const x = Math.floor(r() * w), y = Math.floor(r() * h);
      P(g, r() < 0.3 ? '#324024' : '#24301b', x, y, 4 + Math.floor(r() * 8), 2);
    }
    // Floating duckweed specks & stray office staple/pine-needle glints
    for (let i = 0; i < 55; i++) {
      const x = Math.floor(r() * w), y = Math.floor(r() * h);
      P(g, r() < 0.22 ? '#6e8c3d' : '#4a6329', x, y, 2, 2);
    }
    for (let i = 0; i < 8; i++) {
      P(g, 'rgba(215,235,195,0.22)', Math.floor(r() * (w - 10)), Math.floor(r() * h), 8, 1);
    }
  });
}

/** Dry rustling bracken, dead fern fronds, and fallen pinecones texture. */
export function brackenTex(kit) {
  return kit.tex.custom('forest:bracken', 64, 64, (g, w, h) => {
    P(g, '#4a351d', 0, 0, w, h);
    let s = 4421;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const cols = ['#7a5628', '#8f6932', '#5e4220', '#a37b3b', '#3b2812'];
    for (let i = 0; i < 140; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI;
      g.strokeStyle = cols[Math.floor(r() * cols.length)];
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x - Math.cos(a) * 5, y - Math.sin(a) * 5);
      g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
      g.stroke();
    }
    for (let i = 0; i < 18; i++) {
      P(g, '#2e1d0e', Math.floor(r() * (w - 3)), Math.floor(r() * (h - 3)), 3, 3);
    }
  });
}

/** Crushed pale-tan limestone trail gravel texture. */
export function gravelTrailTex(kit) {
  return kit.tex.custom('forest:gravel', 64, 64, (g, w, h) => {
    P(g, '#8c826c', 0, 0, w, h);
    let s = 7717;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const pick = r();
        P(g, pick < 0.3 ? '#a3987f' : pick < 0.6 ? '#756b57' : '#968b74', x, y, 2, 2);
      }
    }
  });
}

/** Routed wooden National-Park / Corporate-Offsite trail board bolted to drywall. */
export function trailSign(c, side, at, y, lines, opt = {}) {
  const w = opt.w || 1.18, h = opt.h || 0.72, seed = opt.seed || 11;
  const key = `forest:sign:${lines.join('|')}:${seed}`;
  const tex = c.kit.tex.custom(key, 160, 96, (g, tw, th) => {
    // Routed creosote-brown plank board with chamfered yellow-ochre border
    P(g, '#3b2516', 0, 0, tw, th);
    for (let py = 0; py < th; py += 16) P(g, '#2d1b0f', 0, py, tw, 1);
    g.strokeStyle = '#ebc44c';
    g.lineWidth = 2.5;
    g.strokeRect(5, 5, tw - 10, th - 10);
    // Brass lag-bolts in corners
    for (const [bx, by] of [[10, 10], [tw - 13, 10], [10, th - 13], [tw - 13, th - 13]]) P(g, '#b89446', bx, by, 3, 3);

    P(g, '#29190e', 9, 9, tw - 18, 21);
    garble(g, lines[0] || 'SYNERGY PINES', 10, 9, tw - 20, 21, { color: '#f5d469', size: 12, mess: opt.mess ?? 0.20 }, seed);
    const body = lines.slice(1);
    const rowH = Math.floor((th - 38) / Math.max(1, body.length));
    body.forEach((ln, idx) => {
      // Subtle duplicated wood-grain patch glitch on one row
      if (idx === body.length - 1 && (seed % 3) === 0) P(g, '#472d1b', 12, 33 + idx * rowH, tw - 24, rowH - 2);
      garble(
        g,
        ln,
        10,
        32 + idx * rowH,
        tw - 20,
        rowH,
        { color: idx === 0 && opt.warn ? '#ff8b3d' : '#efe7d1', size: 10, mess: opt.mess ?? 0.28 },
        seed + idx * 17 + 5
      );
    });
  }, { clamp: true });
  c.wbox(side, at, w + 0.05, y - h / 2 - 0.02, y + h / 2 + 0.02, 0, 0.028, CEDAR_TIMBER);
  c.hang(c.mapped(key, tex), side, at, y, w, h, null, WHITE, 0.031);
}

/**
 * Corrupted 4th-hand "Scenic Wilderness Overlook" mural painted or vinyl-pasted onto drywall:
 *   variant 0: Six-legged Coat-Rack Stags grazing beside an upward waterfall under duplicated peaks
 *   variant 1: Upside-down spruce forest growing down from office fluorescent troffers toward filing cabinets
 *   variant 2: Faceless fleece-vest offsite hikers holding 4-elbowed arms around a burning shredder bin
 */
export function forestMural(c, side, at, y, w = 3.2, h = 1.95, variant = 0, seed = 23) {
  const key = `forest:mural:${variant}:${seed}`;
  const tex = c.kit.tex.custom(key, 256, 160, (g, tw, th) => {
    // Timber frame + washed-out National-Park brochure sky
    P(g, '#3d2818', 0, 0, tw, th);
    P(g, '#cde0d4', 6, 24, tw - 12, th - 46);
    P(g, '#b8d1c2', 6, 54, tw - 12, 36);

    // Duplicated copy-paste mountain peaks (exact identical peak pasted 3 times in a row!)
    const drawPeak = (px, py, pw, ph, col, snow) => {
      g.fillStyle = col;
      g.beginPath(); g.moveTo(px - pw / 2, py); g.lineTo(px, py - ph); g.lineTo(px + pw / 2, py); g.fill();
      g.fillStyle = snow;
      g.beginPath(); g.moveTo(px - pw * 0.18, py - ph * 0.64); g.lineTo(px, py - ph); g.lineTo(px + pw * 0.18, py - ph * 0.64); g.fill();
    };
    for (let i = 0; i < 4; i++) drawPeak(42 + i * 56, 98, 76, 48, i % 2 ? '#5d7a6e' : '#4d695e', '#eef3ee');

    // Meadow ground
    P(g, '#4c6e3d', 6, 96, tw - 12, 42);
    P(g, '#39572d', 6, 114, tw - 12, 24);

    if (variant % 3 === 0) {
      // Upward-flowing waterfall climbing straight into a rectangular cloud!
      P(g, '#5ea4b8', 178, 28, 22, 96);
      for (let wy = 32; wy < 120; wy += 12) P(g, '#e4f7fa', 182, wy, 14, 3);
      P(g, '#f2f5f0', 164, 26, 50, 12);

      // Two 6-legged Coat-Rack Deer with brass coat-hook antlers
      for (const [dx, dy, sc] of [[78, 108, 1], [136, 114, 0.82]]) {
        P(g, '#6a462c', dx - 14 * sc, dy - 7 * sc, 28 * sc, 9 * sc);
        P(g, '#6a462c', dx + 10 * sc, dy - 20 * sc, 5 * sc, 15 * sc);
        P(g, '#dfd7c2', dx + 9 * sc, dy - 24 * sc, 11 * sc, 5 * sc);
        // Six spindly legs!
        for (let l = 0; l < 6; l++) P(g, '#4a2e1b', dx - 12 * sc + l * 4.6 * sc, dy + 2 * sc, 2, 16 * sc);
        // Coat-hook rack
        g.strokeStyle = '#cfa23c'; g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(dx + 12 * sc, dy - 24 * sc); g.lineTo(dx + 6 * sc, dy - 35 * sc);
        g.moveTo(dx + 12 * sc, dy - 24 * sc); g.lineTo(dx + 20 * sc, dy - 35 * sc);
        g.stroke();
      }
    } else if (variant % 3 === 1) {
      // Inverted pine trees hanging downward from ceiling troffers above a herd of grey filing cabinets!
      for (let tx = 24; tx < tw - 24; tx += 34) {
        P(g, '#ebeef0', tx - 10, 25, 20, 4);
        P(g, '#593a22', tx - 2, 29, 4, 28);
        g.fillStyle = '#284d2a';
        for (const [cy, cw] of [[46, 24], [58, 19], [70, 13]]) {
          g.beginPath(); g.moveTo(tx - cw / 2, cy - 10); g.lineTo(tx, cy + 4); g.lineTo(tx + cw / 2, cy - 10); g.fill();
        }
      }
      for (let fx = 34; fx < tw - 36; fx += 44) {
        P(g, '#8b918e', fx, 100, 18, 28);
        P(g, '#5d6360', fx + 2, 103, 14, 7);
        P(g, '#5d6360', fx + 2, 112, 14, 7);
        P(g, '#5d6360', fx + 2, 121, 14, 6);
      }
    } else {
      // Offsite fleece-vest circle around a flaming office shredder bin
      P(g, '#525759', 116, 104, 24, 24);
      P(g, '#f0781e', 120, 84, 16, 20);
      P(g, '#ffd859', 124, 90, 8, 14);
      for (const hx of [54, 84, 170, 200]) {
        P(g, '#d8b49a', hx - 4, 84, 8, 9);
        P(g, '#215738', hx - 6, 93, 12, 18);
        P(g, '#b8a07a', hx - 5, 111, 4, 16);
        P(g, '#b8a07a', hx + 1, 111, 4, 16);
        g.strokeStyle = '#d8b49a'; g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(hx - 6, 96); g.lineTo(hx - 15, 90); g.lineTo(hx - 11, 81); g.lineTo(hx - 19, 76);
        g.moveTo(hx + 6, 96); g.lineTo(hx + 15, 90); g.lineTo(hx + 11, 81); g.lineTo(hx + 19, 76);
        g.stroke();
      }
    }

    // Horizontal buffer-shear glitch strip across lower sky
    P(g, 'rgba(205,224,212,0.55)', 18, 66, 92, 6);
    P(g, 'rgba(40,77,42,0.35)', 130, 64, 84, 5);

    // Header & footer captions
    const captions = [
      ['SYNERGY PINES OVERLOOK', 'TOUCH GRASS · DO NOT FEED COAT RACKS'],
      ['EXECUTIVE CANOPY ANNEX', 'TREES GROW DOWNWARD BY POLICY'],
      ['MANDATORY CAMPFIRE CIRCLE', 'LEAVE NO ACTION ITEM BEHIND'],
    ][variant % 3];
    P(g, '#26170d', 6, 4, tw - 12, 18);
    garble(g, captions[0], 10, 4, tw - 20, 18, { color: '#f5d469', size: 11, mess: 0.22 }, seed + 3);
    P(g, '#26170d', 6, th - 21, tw - 12, 17);
    garble(g, captions[1], 10, th - 21, tw - 20, 17, { color: '#e8e2cf', size: 9, mess: 0.26 }, seed + 19);
  }, { clamp: true });
  c.hang(c.mapped(key, tex), side, at, y, w, h, null, WHITE, 0.016);
}

/* ---- 2. Ceiling light-budget helper for large woodland rooms -------------- */

export {
  ensureForestDetail,
  woodlandDynamicLight,
  addLightShafts,
  castCanopyShadow,
  plenumBreach,
  dressForestWalls,
  buildForestWater,
};

export function woodlandLight(c, cols = 3, rows = 3, _every = 1, power = 1.0, opt = {}) {
  return woodlandDynamicLight(c, { cols, rows, power, ...opt });
}

/* ---- 3. Sculpted 3 cm `Vox` Woodland Props & Entities --------------------- */

function makePineBark() {
  const cols = ['#4a3120', '#3b2517', '#5c3e29', '#2e1c11'].map((k) => M(k, 2));
  return (x, y, z) => {
    const sector = Math.floor(Math.atan2(z, x) * 2.55 + Math.floor(y * 0.06));
    return cols[((sector % cols.length) + cols.length) % cols.length];
  };
}

function makeBirchBark() {
  const white = M('#e6e2d6', 2), cream = M('#cfc8b6', 2), scar = M('#262421', 2);
  return (x, y, z) => {
    const tier = Math.floor(y * 0.18);
    if (tier % 5 === 0 && (y % 6 === 0) && ((Math.abs(Math.floor(x * 0.5) + tier) % 3) === 0)) return scar;
    return tier % 3 === 0 ? cream : white;
  };
}

function makeNeedles() {
  const greens = ['#234425', '#1b361d', '#2e5730', '#386336'].map((k) => M(k, 2));
  return (x, y, z) => greens[Math.abs(Math.floor(y * 0.35) + Math.floor((x + z) * 0.14)) % greens.length];
}

/** Sculpted pine tree trunk (3 cm/voxel) with root buttresses, sawn limb knots, barcode tag, and optional boughs. */
export function pineTrunkVox(tallVoxels = 92, withBoughs = false) {
  return () => {
    const v = new Vox(), bark = makePineBark(), heart = M('#c79f68', 2), tag = M('#eef0ec', 1), ink = M('#1b1d1e', 1);
    const needles = makeNeedles();
    // Flared buttress roots
    for (let a = 0; a < 5; a++) {
      const th = (a / 5) * Math.PI * 2 + 0.3;
      v.tube(Math.cos(th) * 9.5, 0.8, Math.sin(th) * 9.5, Math.cos(th) * 3.5, 11, Math.sin(th) * 3.5, 2.3, bark);
    }
    // Slight organic taper up to ceiling
    const midY = Math.floor(tallVoxels * 0.5);
    v.cyl('y', 0, 0, 0, midY, 6.2, bark, 5.4);
    v.cyl('y', 0, 0, midY, tallVoxels, 5.4, bark, 4.8);
    // Sawn branch knots exposing pale heartwood
    for (const [ky, ang] of [[28, 0.7], [52, 2.6], [72, 4.4]]) {
      if (ky >= tallVoxels - 6) continue;
      const kx = Math.cos(ang) * 5.2, kz = Math.sin(ang) * 5.2;
      v.tube(kx * 0.5, ky - 1, kz * 0.5, kx * 1.35, ky + 2, kz * 1.35, 1.8, bark);
      v.ellipsoid(kx * 1.38, ky + 2.1, kz * 1.38, 1.3, 1.3, 1.3, heart);
    }
    // Stapled white office asset barcode tag at eye height (`y ~ 44` = 1.32 m)
    if (tallVoxels >= 50) {
      v.box(-2.5, 42, 5.0, 2.5, 46, 5.9, tag);
      v.box(-2.0, 43, 5.6, 2.0, 44.5, 6.1, ink);
    }
    if (withBoughs) {
      const tiers = [
        [Math.floor(tallVoxels * 0.48), 16, 8],
        [Math.floor(tallVoxels * 0.66), 13, 8],
        [Math.floor(tallVoxels * 0.82), 9.5, 7],
      ];
      for (const [ty, rad, th] of tiers) {
        v.cyl('y', 0, 0, ty, ty + th, rad, needles, 2.8);
      }
    }
    return v;
  };
}

/** Sculpted papery white birch trunk with black lenticel scars and orange bracket polypore fungi. */
export function birchTrunkVox(tallVoxels = 90) {
  return () => {
    const v = new Vox(), birch = makeBirchBark(), fungus = M('#cf6b24', 2), gill = M('#ead8b5', 2);
    for (let a = 0; a < 4; a++) {
      const th = (a / 4) * Math.PI * 2 + 0.5;
      v.tube(Math.cos(th) * 7.2, 0.6, Math.sin(th) * 7.2, Math.cos(th) * 2.5, 9, Math.sin(th) * 2.5, 1.9, birch);
    }
    v.tube(0, 0, 0, 1.2, Math.floor(tallVoxels * 0.5), -0.8, 4.6, birch);
    v.tube(1.2, Math.floor(tallVoxels * 0.5), -0.8, -0.5, tallVoxels, 0.5, 4.1, birch);
    // Shelf bracket fungi (`Polypore`) stepped up the bark
    for (const [fy, ang, r] of [[22, 0.4, 3.6], [26, 1.1, 2.9], [54, 3.5, 3.4]]) {
      if (fy >= tallVoxels - 6) continue;
      const fx = Math.cos(ang) * 4.4, fz = Math.sin(ang) * 4.4;
      v.ellipsoid(fx, fy, fz, r, 1.2, r, fungus);
      v.ellipsoid(fx, fy - 0.6, fz, r * 0.85, 0.8, r * 0.85, gill);
    }
    return v;
  };
}

/**
 * Cut tree stump with flared roots, aluminium lumber tag, and `rings` (1..7)
 * distinct dark heartwood growth rings across the flat sawn top!
 */
export function stumpVox(rings = 4) {
  const nRings = clamp(Math.round(rings), 1, 7);
  return () => {
    const v = new Vox(), bark = makePineBark(), sap = M('#dfc08e', 2), ringDark = M('#6e4523', 2), tag = M('#c8d2d6', 0);
    for (let a = 0; a < 6; a++) {
      const th = (a / 6) * Math.PI * 2 + 0.2;
      v.tube(Math.cos(th) * 12.5, 1.0, Math.sin(th) * 12.5, Math.cos(th) * 5.5, 9.5, Math.sin(th) * 5.5, 2.5, bark);
    }
    v.cyl('y', 0, 0, 0, 15, 9.8, bark, 8.8);
    // Sawn flat top with countable concentric growth rings!
    v.cyl('y', 0, 0, 14, 16, 8.2, sap);
    for (let i = 1; i <= nRings; i++) {
      const rOuter = (i / (nRings + 0.5)) * 7.8;
      const rInner = Math.max(0, rOuter - 0.72);
      v.cyl('y', 0, 0, 15.2, 16.3, rOuter, ringDark, rInner);
    }
    v.box(-2.2, 7, 8.2, 2.2, 10.5, 9.4, tag);
    return v;
  };
}

/**
 * Notched hollow windfall trunk (falls toward +Z when leaned on from -Z):
 *   - `-Z` face has an unmistakable bright orange Forestry Survey Blaze mark (`PUSH`)
 *   - `+Z` face has a deep pale-wood V-axe felling notch at waist height!
 */
export function notchedTrunkVox(tallVoxels = 108) {
  return () => {
    const v = new Vox(), bark = makePineBark(), wood = M('#d8b47c', 2), blaze = M('#eb6218', 1), hollow = M('#17110b', 2);
    for (let a = 0; a < 5; a++) {
      const th = (a / 5) * Math.PI * 2;
      v.tube(Math.cos(th) * 9.5, 0.8, Math.sin(th) * 9.5, Math.cos(th) * 4.2, 8, Math.sin(th) * 4.2, 2.2, bark);
    }
    v.cyl('y', 0, 0, 0, tallVoxels, 6.8, bark, 5.8);
    // Hollow dark core down the top
    v.cyl('y', 0, 0, tallVoxels - 14, tallVoxels + 1, 3.6, hollow);
    // Deep V-shaped felling notch on +Z face (`y = 10..22`)
    v.ellipsoid(0, 16, 3.5, 5.8, 5.2, 4.2, wood);
    v.carve(-7, 12, 2.2, 7, 20, 8.5);
    // Bright orange forestry survey blaze stripe on -Z face (`y = 34..48`)
    v.rbox(-3.2, 34, -7.2, 3.2, 48, -5.6, 0.5, blaze);
    return v;
  };
}

/** Sculpted canvas/nylon hiking backpack with rolled foam sleeping mat & brass buckles. */
export function backpackVox(colorHex = '#b84b28') {
  return () => {
    const v = new Vox();
    const pack = M(colorHex, 2), flap = M('#7a321a', 2), strap = M('#2b2620', 1), brass = M('#cfa242', 0), mat = M('#387a5c', 2);
    // Main rucksack body + front pocket + side canteen pouches
    v.rbox(-7, 0, -5, 7, 17, 5, 2.2, pack);
    v.rbox(-5, 2, 4.2, 5, 10, 7.6, 1.4, pack);
    v.rbox(-9.2, 2, -2.5, -6.5, 10, 2.5, 1.2, flap);
    v.rbox(6.5, 2, -2.5, 9.2, 10, 2.5, 1.2, flap);
    // Top storm-hood flap + twin straps & brass buckles
    v.rbox(-7.4, 14, -5.4, 7.4, 19, 5.6, 2.0, flap);
    for (const sx of [-3.5, 3.5]) {
      v.box(sx - 0.8, 7, 5.0, sx + 0.8, 16, 6.2, strap);
      v.box(sx - 1.1, 10, 5.6, sx + 1.1, 11.6, 6.6, brass);
    }
    // Rolled green foam sleeping pad lashed across the top
    v.cyl('x', 19.5, 0, -8.5, 8.5, 3.2, mat);
    return v;
  };
}

/** Brass-and-forest-green camp lantern with wire bail and glowing warm mantle (`aEmis = 1`). */
export function campLanternVox() {
  return () => {
    const v = new Vox();
    const fount = M('#214f34', 1), brass = M('#c79d3e', 0), mantle = glow('#fff2ba'), glass = M('#d9e8dc', 0);
    v.cyl('y', 0, 0, 0, 5, 5.4, fount, 4.2);
    v.cyl('y', 0, 0, 5, 6.5, 4.4, brass);
    // Glowing thorium mantle inside glass globe + 4 brass guard struts
    v.ellipsoid(0, 10.5, 0, 2.4, 3.4, 2.4, mantle);
    v.cyl('y', 0, 0, 6.5, 14.5, 3.8, glass, 3.2);
    for (let a = 0; a < 4; a++) {
      const th = (a / 4) * Math.PI * 2 + 0.4;
      v.tube(Math.cos(th) * 4.2, 6, Math.sin(th) * 4.2, Math.cos(th) * 4.2, 15.5, Math.sin(th) * 4.2, 0.55, brass);
    }
    // Ventilator hood & wire carry bail
    v.cyl('y', 0, 0, 14.5, 18.5, 5.2, fount, 1.8);
    v.tube(-4.8, 15, 0, 0, 22, 0, 0.5, brass);
    v.tube(4.8, 15, 0, 0, 22, 0, 0.5, brass);
    return v;
  };
}

/** Cedar-shingled birdhouse with wooden perch peg and a tiny security-camera lens inside the hole! */
export function birdhouseVox(activeRed = false) {
  return () => {
    const v = new Vox();
    const cedar = M('#8f5e36', 2), roof = M('#38573a', 2), hole = M('#0a0b0c', 1);
    const lens = M(activeRed ? '#ff3b28' : '#a8e6cf', 0, 1), peg = M('#cfa972', 1);
    v.rbox(-5.5, 0, -5, 5.5, 11, 5, 0.8, cedar);
    // Pitched shingle roof
    for (let y = 0; y <= 6; y++) {
      const hw = 7.2 - y * 1.05;
      v.box(-hw, 10.5 + y, -6, hw, 11.6 + y, 6, roof);
    }
    v.carve(-2.2, 4.5, 3.2, 2.2, 8.8, 6);
    v.ellipsoid(0, 6.6, 3.4, 1.8, 1.8, 1.0, hole);
    v.set(0, 7, 4, lens);
    v.cyl('z', 0, 3.2, 4.5, 8.2, 0.7, peg);
    return v;
  };
}

/** Sculpted A-frame nylon ridge tent, optionally with office slacks & oxfords poking out (`shoesOut`). */
export function tentVox(colorHex = '#d47a28', shoesOut = false) {
  return () => {
    const v = new Vox();
    const nylon = M(colorHex, 2), dark = M('#242622', 2), pole = M('#c5cfd4', 0), ground = M('#2e3830', 2);
    // Groundsheet + triangular A-frame canopy (~56 voxels = 1.68 m long, ~38 voxels = 1.14 m wide)
    v.box(-18, 0, -26, 18, 1.5, 26, ground);
    for (let y = 1; y <= 24; y++) {
      const hw = Math.max(1.0, 18 * (1 - y / 24.5));
      v.box(-hw, y, -25, hw, y + 1.2, 25, nylon);
      if (y < 21) v.carve(-(hw - 1.6), y, -23, hw - 1.6, y + 1.1, 26);
    }
    // Dark open triangular front vestibule + aluminium ridge & front A-poles
    v.box(-11, 1.5, 14, 11, 16, 23, dark);
    v.cyl('z', 0, 24.5, -26.5, 26.5, 0.8, pole);
    v.tube(-18, 0, 25.5, 0, 25, 25.5, 0.75, pole);
    v.tube(18, 0, 25.5, 0, 25, 25.5, 0.75, pole);

    if (shoesOut) {
      const slacks = M('#2d333d', 2), sock = M('#e6e6e0', 2), shoe = M('#382216', 1);
      for (const sx of [-4.2, 4.2]) {
        v.tube(sx, 3.2, 16, sx * 1.1, 2.8, 31, 2.1, slacks);
        v.cyl('z', sx * 1.1, 2.8, 31, 33.5, 1.35, sock);
        v.rbox(sx * 1.1 - 2.0, 1.2, 33, sx * 1.1 + 2.0, 6.8, 36.5, 0.8, shoe);
      }
    }
    return v;
  };
}

/**
 * Plain-room stalker (`forestRoom`): **The Trail Spotter** — a ranger standee in
 * olive poncho and wide-brim campaign hat with oversized twin brass binoculars
 * and a flashbulb capacitor unit fused where its face should be!
 */
export function spotterVox() {
  return () => {
    const v = new Vox();
    const poncho = M('#3b4a2e', 2), khaki = M('#9c8865', 2), boot = M('#332115', 1);
    const hat = M('#5e492c', 2), band = M('#8f261d', 1), brass = M('#c49a3a', 0), lens = glow('#d8f7ff'), flash = glow('#eef7ff');
    // Boots & khaki trousers
    for (const sx of [-3.4, 3.4]) {
      v.rbox(sx - 2, 0, -2.5, sx + 2, 3.5, 4.5, 0.8, boot);
      v.cyl('y', sx, 0, 3.5, 22, 2.2, khaki);
    }
    // Draped ranger poncho & arms holding binocular housing up to head
    v.cyl('y', 0, 0, 20, 44, 8.2, poncho, 5.8);
    v.tube(-7.2, 40, 0, -4.5, 48, 6.5, 2.1, poncho);
    v.tube(7.2, 40, 0, 4.5, 48, 6.5, 2.1, poncho);
    // Campaign hat ("Smokey" flat brim + pinched crown)
    v.ellipsoid(0, 50, 0, 4.6, 5.2, 4.6, khaki);
    v.cyl('y', 0, 0, 53.5, 55, 9.8, hat);
    v.cyl('y', 0, 0, 55, 56, 5.2, band);
    v.ellipsoid(0, 58, 0, 4.8, 3.8, 4.8, hat);
    // Oversized twin brass field-binoculars protruding straight out of face + shoulder flashbulb!
    for (const sx of [-2.4, 2.4]) {
      v.cyl('z', sx, 50.2, 2.5, 10.5, 2.0, brass);
      v.cyl('z', sx, 50.2, 10.2, 11.2, 1.5, lens);
    }
    v.cyl('y', 6.5, 2.0, 44, 51, 1.2, brass);
    v.ellipsoid(6.5, 52.5, 2.5, 2.6, 2.6, 1.8, flash);
    return v;
  };
}

/**
 * Overhead ambush cocoon (`canopy-walk`): **Manila Bagworm Husk** — shingled in
 * manila `CONFIDENTIAL` file folders, pine needles, yellow Cat-5 cable silk, and
 * dark stapler-mandibles!
 */
export function bagwormVox() {
  return () => {
    const v = new Vox();
    const manila = M('#cfa96e', 2), manilaDark = M('#a8834c', 2), stamp = M('#9e261e', 1);
    const pine = makeNeedles(), cable = M('#e3b429', 1), jaw = M('#1f2226', 0), eye = glow('#d9f598');
    // Spindle cocoon hanging from y = 0 down to y = -38 (~1.14 m)
    v.cyl('y', 0, 0, -6, 2, 1.2, cable);
    for (let i = 0; i < 7; i++) {
      const yTop = -4 - i * 4.5;
      const rTop = 3.2 + Math.sin((i / 6) * Math.PI) * 5.2;
      const rBot = 2.4 + Math.sin(((i + 1) / 7) * Math.PI) * 5.0;
      v.cyl('y', 0, 0, yTop - 5.2, yTop, rBot, i % 2 ? manila : manilaDark, rTop);
      // Protruding folder-tab corners & pine sprigs
      const ang = i * 1.9;
      const fx = Math.cos(ang) * (rTop + 1.2), fz = Math.sin(ang) * (rTop + 1.2);
      v.box(fx - 2.2, yTop - 4, fz - 0.6, fx + 2.2, yTop - 0.5, fz + 0.6, i === 2 ? stamp : pine);
    }
    // Dark lower aperture with stapler-mandibles & glowing pinhead eyes
    v.ellipsoid(0, -35.5, 0, 3.6, 3.0, 3.6, jaw);
    for (const sx of [-1, 1]) {
      v.tube(sx * 2.4, -36, 1.2, sx * 1.2, -40.5, 2.8, 0.9, jaw);
      v.set(sx * 2, -35, 3, eye);
    }
    return v;
  };
}

/**
 * Articulated **Retreat Facilitator** rig (`campfire-circle`):
 *   - Forest-green corporate fleece vest over plaid shirt, khaki shorts, hiking boots
 *   - Clay-putty smiling head on an articulated `headPivot` that smoothly swivels 180°
 *     backwards to watch the player if they turn their back!
 *   - Right arm (`armPivot`) holding a bent wire coat-hanger skewer with a glowing
 *     toasted marshmallow/ration cube (`aEmis = 1`).
 */
export function makeFacilitatorRig(kit, tag = 'facil') {
  const S = 0.028;
  const mat = kit.surface({ vox: true });
  const m4 = new THREE.Matrix4().makeScale(S, S, S);
  const lights = [
    lamp(0.5, 2.8, 1.2, [1.18, 1.15, 1.08], { k: 9, wrap: 0.48, far: 28 }),
    lamp(0.0, 0.4, 1.1, [0.95, 0.52, 0.22], { k: 5, wrap: 0.52, far: 14 }),
  ];

  const bodyPart = () => {
    const v = new Vox();
    const skin = M('#d4a88c', 2), clay = M('#cbbba2', 2), vest = M('#1f5436', 2), vestDark = M('#163d27', 2);
    const shirt = M('#b84532', 2), khaki = M('#a8936d', 2), sock = M('#ecebe4', 2), boot = M('#4a2f1b', 1);
    const sole = M('#1f1a17', 1), badge = M('#f2f4f0', 1), cord = M('#2d8c52', 1);
    for (const sx of [-3.6, 3.6]) {
      v.rbox(sx - 2.3, 0, -2.8, sx + 2.3, 1.8, 5.2, 0.7, sole);
      v.rbox(sx - 2.1, 1.5, -2.5, sx + 2.1, 4.8, 4.9, 1.2, boot);
      v.cyl('y', sx, 0, 4.6, 9.0, 2.05, sock);
      v.cyl('y', sx, 0, 8.8, 19.5, 2.15, skin, 2.35);
      v.rbox(sx - 3.0, 19, -3.4, sx + 3.0, 27.5, 3.4, 1.4, khaki);
    }
    v.rbox(-6.4, 25, -3.7, 6.4, 30.5, 3.7, 1.8, khaki);
    // Quilted down-vest with horizontal puffer ribs + lanyard + badge
    v.rbox(-6.9, 29.5, -4.1, 6.9, 46.2, 4.1, 2.4, vest);
    for (const qy of [33.5, 38.0, 42.2]) v.rbox(-7.05, qy, -4.2, 7.05, qy + 0.9, 4.2, 0.4, vestDark);
    v.ellipsoid(0, 44.5, 3.2, 2.2, 2.6, 1.4, shirt);
    v.tube(-2.2, 45.5, 3.8, 0, 38.5, 4.3, 0.55, cord);
    v.tube(2.2, 45.5, 3.8, 0, 38.5, 4.3, 0.55, cord);
    v.rbox(-2.0, 35.0, 4.0, 2.0, 38.8, 4.8, 0.4, badge);
    // Left arm in rolled flannel sleeve holding wooden retreat clipboard with checklist
    v.tube(-7.2, 44, 0, -9.4, 35, 2.0, 2.15, shirt);
    v.tube(-9.4, 35, 2.0, -7.2, 30.5, 5.8, 1.75, clay);
    v.rbox(-10.2, 25.5, 5.4, -4.4, 35.2, 6.5, 0.6, M('#8c6239', 2));
    v.rbox(-9.5, 26.5, 6.2, -5.1, 34.2, 6.8, 0.3, badge);
    return v;
  };

  const headPart = () => {
    const v = new Vox();
    const clay = M('#d4c4ab', 3), clayShade = M('#b09e84', 3), hair = M('#4d3826', 2);
    const tooth = M('#f4f1e6', 1), eye = glow('#e8f7c8'), pupil = M('#121412', 0), brass = M('#cfa23c', 0);
    v.cyl('y', 0, 0, 0, 3.6, 2.3, clay);
    v.ellipsoid(0, 8.6, 0.2, 5.4, 6.2, 5.2, clay);
    v.ellipsoid(0, 5.2, 1.8, 4.8, 3.6, 4.2, clayShade);
    // Sculpted parted hair waves (`ellipsoid` curls instead of a box!)
    v.ellipsoid(0, 12.8, -0.6, 5.7, 3.4, 5.5, hair);
    v.ellipsoid(-2.8, 12.2, 2.8, 3.2, 2.2, 2.8, hair);
    v.ellipsoid(3.0, 12.5, 2.4, 2.6, 1.9, 2.5, hair);
    for (const sx of [-5.2, 5.2]) v.ellipsoid(sx, 8.2, 0, 1.1, 2.0, 1.5, clayShade);
    // Deep carved eye hollows with tiny unblinking pinprick eyes
    v.carve(-3.6, 8.4, 3.6, -1.0, 10.8, 6.0);
    v.carve(1.0, 8.4, 3.6, 3.6, 10.8, 6.0);
    for (const sx of [-2.3, 2.3]) {
      v.sphere(sx, 9.5, 4.0, 0.95, pupil);
      v.set(sx, 9.8, 4.8, eye);
    }
    // Uncanny wide carved clay grin stretched upward at the corners by two brass paperclips!
    v.carve(-4.0, 4.2, 3.2, 4.0, 6.9, 6.0);
    for (let tx = -3; tx <= 3; tx += 1.5) v.ellipsoid(tx, 5.6, 4.1, 0.65, 1.0, 0.7, tooth);
    for (const sx of [-4.2, 4.2]) v.ring(sx, 6.4, 4.2, 1.1, 0.45, brass, 'z');
    return v;
  };

  const armSkewerPart = () => {
    const v = new Vox();
    const shirt = M('#b84532', 2), clay = M('#d4c4ab', 2), wire = M('#aeb8bd', 0), ember = glow('#ffb84d'), char = M('#3b2316', 2);
    // Shoulder at (0,0,0) reaching forward with wire coat-hanger roasting stick
    v.tube(0, 0, 0, 1.5, -5.5, 7.5, 1.9, shirt);
    v.tube(1.5, -5.5, 7.5, 0.6, -4.0, 13.5, 1.65, clay);
    v.tube(0.6, -4.0, 13.5, 0.2, -1.5, 30.0, 0.55, wire);
    // Glowing campfire-roasted marshmallow/ration skewer at tip
    v.rbox(-1.8, -3.2, 28.5, 2.2, 0.6, 32.8, 0.9, ember);
    v.box(-2.0, -0.2, 30.2, 2.4, 0.9, 32.9, char);
    return v;
  };

  const buildMesh = (key, fn) => {
    const q = new Batch(true);
    q.addVox(kit.model(`forest:${tag}:${key}`, fn).solid, m4);
    return new THREE.Mesh(kit.geometry(q, lights, [0.58, 0.58, 0.55]), mat);
  };

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.add(buildMesh('body', bodyPart));
  group.add(body);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 45.8 * S, 0);
  headPivot.add(buildMesh('head', headPart));
  body.add(headPivot);

  const armPivot = new THREE.Group();
  armPivot.position.set(6.8 * S, 43.5 * S, 0.5 * S);
  armPivot.add(buildMesh('arm', armSkewerPart));
  body.add(armPivot);

  function pose({ mode = 'fire', stride = 0, headYaw = 0, time = 0, waited = 0 }) {
    const bob = Math.abs(Math.sin(stride)) * (mode === 'lunge' ? 0.055 : 0.025);
    body.position.y = bob;
    body.rotation.x = mode === 'lunge' ? 0.22 : 0;
    // Head can rotate ALL the way round (+/- PI) like an owl when your back is turned!
    headPivot.rotation.y = headYaw;
    headPivot.rotation.z = mode === 'offer' && waited > 8 ? Math.sin(time * 18) * 0.12 : Math.sin(time * 1.7) * 0.05;
    armPivot.rotation.x = mode === 'lunge'
      ? -0.75 + Math.sin(time * 22) * 0.32
      : mode === 'offer'
        ? -0.28 + Math.sin(time * 2.5) * 0.05
        : 0.18;
  }

  pose({});

  return {
    group,
    headPivot,
    armPivot,
    pose,
    light(rgb) {
      mat.uniforms.uTint.value.set(rgb[0] * 1.32 + 0.06, rgb[1] * 1.32 + 0.06, rgb[2] * 1.32 + 0.06);
    },
  };
}

/** Build a lit Three.js Group from a `Vox` maker at `scale` (default 3 cm/voxel), always keeping full voxel AO unless `opt.ao === false`. */
export function makeVoxGroup(kit, key, make, scale = 0.03, opt = {}) {
  const mat = kit.surface({ vox: true, room: opt.room });
  const q = new Batch(true);
  const flat = opt.ao === false;
  q.addVox(kit.model(flat ? `${key}:flat` : key, make, flat ? { ao: false } : undefined).solid, new THREE.Matrix4().makeScale(scale, scale, scale));
  const lights = [
    lamp(0.65, 2.8, 1.2, [1.08, 1.14, 1.06], { k: 9, wrap: 0.42, far: 30 }),
    lamp(-1.1, 1.2, -0.9, [0.22, 0.28, 0.22], { k: 7, wrap: 0.35, far: 20 }),
  ];
  const mesh = new THREE.Mesh(kit.geometry(q, lights, [0.46, 0.50, 0.45]), mat);
  if (opt.detail) mesh.userData.detail = true;
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.light = (rgb) => mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
  return g;
}

/** Place a single sculpted `Vox` prop in room `c` with automatic room-dimming & spatial light sampling. */
export function placeVox(c, key, make, x, z, opt = {}) {
  const g = makeVoxGroup(c.kit, key, make, opt.scale ?? 0.03, { ao: opt.ao, room: c.rt.u, detail: opt.detail });
  const y = opt.y ?? 0;
  g.position.set(x, y, z);
  if (opt.rot) g.rotation.y = opt.rot;
  if (opt.tilt) { g.rotation.x = opt.tilt[0]; g.rotation.z = opt.tilt[1]; }
  c.add(g);
  c.after.push(() => g.userData.light(c.sample(x, Math.max(0.25, y + 0.45), z)));
  if (opt.solidRadius) {
    const r = opt.solidRadius;
    c.solid(x - r, z - r, x + r, z + r, opt.keep ? { keep: true } : undefined);
  }
  return g;
}

/**
 * Bake many `Vox` props in room-local space into ONE single `THREE.Mesh` (`Batch(true)`)
 * lit per-vertex by ALL room lights, ambient, and 4 dynamic lighting banks (`c.rt.lighting`)!
 * Pass `opt.detail = true` to mark the batch `mesh.userData.detail = true` for the 250k/500k tier.
 */
export function placeVoxStack(c, stackKey, entries, opt = {}) {
  if (!entries.length) return null;
  const q = new Batch(true);
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  for (const e of entries) {
    const s = e.scale ?? 0.03;
    euler.set(e.tilt ? e.tilt[0] : 0, e.rot || 0, e.tilt ? e.tilt[1] : 0, 'YXZ');
    quat.setFromEuler(euler);
    pos.set(e.x, e.y ?? 0, e.z);
    scl.set(s, s, s);
    m4.compose(pos, quat, scl);
    const flat = e.ao === false;
    const model = c.kit.model(flat ? `${e.key}:flat` : e.key, e.make, flat ? { ao: false } : undefined);
    q.addVox(model.solid, m4, e.tint ? { tint: e.tint } : undefined);
  }

  const tris = q.idx.length / 3;
  if (opt.detail) c.rt._pendingDetTris = (c.rt._pendingDetTris || 0) + tris;
  else c.rt._pendingOrdTris = (c.rt._pendingOrdTris || 0) + tris;

  const g = new THREE.Group();
  g.name = stackKey;
  c.add(g);

  c.after.push(() => {
    const geo = c.kit.geometry(q, c.rt.lights, c.rt.amb, c.rt.lighting);
    if (!geo) return;
    const mat = c.kit.surface({
      vox: true,
      room: c.rt.u,
      flick: geo.userData.flick,
      banks: geo.userData.banks,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = opt.detail ? `${stackKey}:detail` : stackKey;
    if (opt.detail) mesh.userData.detail = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    g.add(mesh);
  });

  if (opt.solidBox) {
    const [x0, z0, x1, z1] = opt.solidBox;
    c.solid(x0, z0, x1, z1, opt.keep ? { keep: true } : undefined);
  }
  return g;
}

/* ---- 4. Shared Floor Mechanics: Peat Bogs, Bracken, Felled Timber & Call -- */

/**
 * Register a target that answers the carried **Trail Call (`call`)** whistle when
 * `[E]` is pressed while holding `call` within `r` metres (mirroring `suburb.js` `roller`).
 */
export function registerCallTarget(c, x, z, onCall, opt = {}) {
  // Cut (the lead, on docs/FOREST-REVIEW.md §3). The Trail Call was a remote control for the floor: held, it made E live
  // anywhere within 11 to 16 m of a room's centre and fired that room's event from there (dropped the bridge, stopped the
  // bulldozer, shut the eyes, rang the true post), which skipped every room's own discovery and lit the E mark across
  // whole rooms with nothing in front of the visitor. No room leaves one any more and no room answers one. The item is
  // still defined (inventory-state.js) and the rooms' calls are left as they are, so it can come back as one thing that
  // does the same everywhere: `opt.force` registers as before.
  if (!opt.force) return;
  const r = opt.r ?? 12.5;
  const hasCall = () => c.env.inventory?.held?.()?.type === 'call';
  const w = c.toWorld(x, z);
  c.use({
    x,
    z,
    r,
    cone: opt.cone ?? -1,
    label: opt.label || 'sound the call',
    when: () => hasCall() && (!opt.when || opt.when()),
    use: () => {
      const me = c.env.player?.me;
      const wx = me ? me.x : w.x, wz = me ? me.z : w.z;
      c.env.play?.('whistle', wx, wz, 13);
      c.rt.lastCall = { x, z, wx, wz, time: performance.now() * 0.001 };
      onCall?.({ x, z, wx, wz });
    },
  });
}

/**
 * Place an interactive **Notched Hollow Trunk** at `(x, z)` that falls toward `(dirX, dirZ)`
 * when leaned on from behind `(-dirX, -dirZ)` using `marks.js` `lean` + `pressing`!
 * Once felled, its upright collider switches off and `timberBridgeAt(state, px, pz)`
 * forms a dry walkable log bridge across peat bogs!
 */
export function notchedTimber(c, spec = {}) {
  const x = spec.x || 0, z = spec.z || 0;
  const length = spec.length || 3.4;
  const dirX = spec.dirX || 0, dirZ = spec.dirZ ?? 1;
  const yaw = Math.atan2(dirX, dirZ); // +Z of Vox model points toward fall direction `(dirX, dirZ)`!
  const tScale = spec.scale ?? 0.036;
  const tallVoxels = Math.max(64, Math.round(length / tScale));

  const holder = new THREE.Group();
  holder.position.set(x, spec.baseY ?? 0, z);
  holder.rotation.y = yaw;
  const voxMesh = makeVoxGroup(c.kit, `forest:notched:${tallVoxels}`, notchedTrunkVox(tallVoxels), tScale, {
    ao: spec.ao,
    room: c.rt.u,
  });
  holder.add(voxMesh);
  c.add(holder);
  c.after.push(() => voxMesh.userData.light(c.sample(x, 0.9, z)));

  const rad = spec.radius || 0.24;
  const col = c.solid(x - rad, z - rad, x + rad, z + rad, { tall: true, keep: !!spec.keep });
  c.reserve(x, z, rad + 0.35);

  let timber = makeTimber({ x, z, dirX, dirZ, length, radius: rad, bridgeY: spec.bridgeY ?? 0.14 });
  let heldRight = 0, heldWrong = 0;

  const w0 = c.toWorld(x, z);
  const w1 = c.toWorld(x + timber.dirX, z + timber.dirZ);
  const fw = [w1.x - w0.x, w1.z - w0.z];

  c.tick((dt, _t, me) => {
    let leanedRight = false, leanedWrong = false;
    if (timber.mode === 'standing' && me.inside) {
      const rx = me.x - x, rz = me.z - z;
      const along = rx * timber.dirX + rz * timber.dirZ; // < 0 is behind (-dir), > 0 is notch face (+dir)
      const perp = -rx * timber.dirZ + rz * timber.dirX;
      const wishFwd = me.world ? me.world.wishX * fw[0] + me.world.wishZ * fw[1] : 0;

      // Pushing from behind (`along < 0`, `wishFwd > 0`) fells the trunk; pushing the front shudders!
      const distFace = Math.max(0, Math.hypot(rx, rz) - rad);
      heldRight = lean(heldRight, dt, along < -0.05 && pressing(distFace, perp, rad * 3.2, wishFwd, me.speed));
      heldWrong = lean(heldWrong, dt, along >= -0.05 && pressing(distFace, perp, rad * 3.2, -wishFwd, me.speed));
      if (heldRight >= LEAN) { leanedRight = true; heldRight = 0; }
      if (heldWrong >= REFUSE) { leanedWrong = true; heldWrong = 0; }
    }

    const res = stepTimber(timber, dt, { leanedRightSide: leanedRight, leanedWrongSide: leanedWrong });
    timber = res.state;

    if (res.refused) {
      c.env.play?.('knock', w0.x, w0.z, 6);
    }
    if (res.cracked) {
      col.on = false;
      c.env.play?.('crack', w0.x, w0.z, 11);
      c.env.play?.('creak', w0.x, w0.z, 9);
    }
    if (res.slammed) {
      const tipX = x + timber.dirX * length * 0.65, tipZ = z + timber.dirZ * length * 0.65;
      const tipW = c.toWorld(tipX, tipZ);
      c.env.play?.('thunk', tipW.x, tipW.z, 12);
      c.env.play?.('wade', tipW.x, tipW.z, 9);
      c.env.interfere?.(0.32);
      c.rt.water?.spawnRipple(tipX, tipZ, 1.55);
    }

    const shudder = timber.shudder > 0 ? Math.sin(timber.shudder * 42) * 0.045 * timber.shudder : 0;
    voxMesh.rotation.x = timber.angle + shudder;
  });

  const handle = {
    get state() { return timber; },
    fellNow() {
      col.on = false;
      timber = { ...timber, mode: 'felled', progress: 1, angle: FOREST.timberMaxAngle };
      voxMesh.rotation.x = timber.angle;
    },
    bridgeAt: (px, pz) => timberBridgeAt(timber, px, pz),
  };
  (c.rt.timbers ||= []).push(handle);
  return handle;
}

/**
 * Lay sunken peat-bog basins (`bogs: [{ x0, z0, x1, z1, depth?, waterY? }]`) and
 * dry bracken beds (`brackens: [{ x0, z0, x1, z1 }]`), wiring `stepForestWalker`
 * AND the 2027 AAA multi-layer GLSL water shader (`buildForestWater`)!
 */
export function installForestFloor(c, spec = {}) {
  const bogs = spec.bogs || [];
  const brackens = spec.brackens || [];
  const customBridgeAt = spec.bridgeAt || null;

  // Optionally tile `c.floor` around `bogs[0]` when `c.shell({ floor: false })` was used so sunken bogs open cleanly below `y = 0`!
  if (spec.cutFloor && bogs.length) {
    const { W, D, room } = c;
    const b0 = bogs[0];
    const rect = (x0, z0, x1, z1, y) => {
      if (x1 - x0 > 0.005 && z1 - z0 > 0.005) {
        c.floor.grid(
          [x0, y, z0], [0, 0, 1], [1, 0, 0],
          ticks(z1 - z0), ticks(x1 - x0),
          (u, v) => [(x0 + v + (room.cx || 0)) / 1.6, (z0 + u + (room.cz || 0)) / 1.6],
          WHITE,
        );
      }
    };
    rect(-W / 2, -D / 2, W / 2, b0.z0, 0);
    rect(-W / 2, b0.z1, W / 2, D / 2, 0);
    rect(-W / 2, b0.z0, b0.x0, b0.z1, 0);
    rect(b0.x1, b0.z0, W / 2, b0.z1, 0);
  }

  const bridgeSupport = (x, z) => {
    if (customBridgeAt) {
      const cb = customBridgeAt(x, z);
      if (cb && cb.on) return cb;
    }
    for (const tb of c.rt.timbers || []) {
      const hit = tb.bridgeAt(x, z);
      if (hit.on) return hit;
    }
    return { on: false, y: null };
  };

  // Render sunken peat beds + 2027 AAA GLSL water surface with depth absorption, ripples, caustics & flashlight glints!
  let water = null;
  if (bogs.length) {
    for (const b of bogs) {
      const dp = b.depth ?? 0.38;
      c.flat.grid(
        [b.x0, -dp, b.z0], [0, 0, 1], [1, 0, 0],
        ticks(b.z1 - b.z0, 0.7, 0), ticks(b.x1 - b.x0, 0.7, 0),
        null,
        [0.05, 0.065, 0.04]
      );
    }
    water = buildForestWater(c, bogs, {
      deep: !!spec.deep,
      map: peatWaterTex(c.kit, spec.deep ? 'deep' : 'peat'),
      islands: spec.islands || [],
      isBridged: (x, z) => bridgeSupport(x, z).on,
      drips: spec.drips !== false,
    });
    c.rt.water = water;
  }

  // Render rustling dry bracken & pinecone beds
  if (brackens.length) {
    const brBatch = c.mapped('forest:bracken', brackenTex(c.kit));
    for (const br of brackens) {
      const y = br.y ?? 0.014;
      brBatch.grid(
        [br.x0, y, br.z0], [0, 0, 1], [1, 0, 0],
        ticks(br.z1 - br.z0, 0.7, 0), ticks(br.x1 - br.x0, 0.7, 0),
        (u, v) => [(br.x0 + v) / 1.2, (br.z0 + u) / 1.2],
        WHITE
      );
    }
  }

  const findBog = (x, z) => bogs.find((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) || null;
  const inBracken = (x, z) => brackens.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);

  // Gentle sloped bog floor (`<= 0.15 m` per 12.5 cm cell) so `world.walkable` flood-fills cleanly!
  const prevFloorY = c.rt.floorY;
  c.rt.floorY = (x, z) => {
    const br = bridgeSupport(x, z);
    if (br.on) return br.y;
    const bog = findBog(x, z);
    if (bog) {
      const dp = bog.depth ?? 0.38;
      const edge = Math.min(x - bog.x0, bog.x1 - x, z - bog.z0, bog.z1 - z);
      const ramp = clamp(edge / 0.55, 0, 1);
      return -dp * ramp;
    }
    return prevFloorY ? prevFloorY(x, z) : 0;
  };

  let walker = makeForestWalker();
  c.rt.forestAlert = 0;

  c.tick((dt, t, me) => {
    if (!me.inside) {
      c.rt.forestAlert = Math.max(0, (c.rt.forestAlert || 0) - dt);
      return;
    }
    const keys = c.env.player?.input?.keys;
    const crouch = !!(keys && keys.has('c'));
    const hurry = !!(keys && keys.has('Shift')) || !!c.env.player?.input?.hurry;
    const br = bridgeSupport(me.x, me.z);
    const bog = findBog(me.x, me.z);

    const res = stepForestWalker(walker, dt, {
      inBog: !!bog,
      onBridge: br.on,
      inBracken: inBracken(me.x, me.z),
      speed: me.speed,
      crouch,
      hurry,
    });
    walker = res.state;
    c.rt.forestAlert = walker.rustleAlert;

    if (me.world) {
      me.world.slow = Math.min(me.world.slow, res.slow);
      if (res.sink > 0) me.world.sinkTo = Math.max(me.world.sinkTo, res.sink * 0.55);
      if (res.events.slipped) {
        const w = c.toWorld(me.x, me.z);
        c.env.play?.('shuffle', w.x, w.z, 6);
        me.world.vx *= 1.28;
        me.world.vz *= 1.28;
      }
      if (res.events.splash || res.events.bubble) {
        const w = c.toWorld(me.x, me.z);
        c.env.play?.(res.events.splash ? 'wade' : 'glug', w.x, w.z, 6.5);
        water?.spawnRipple(me.x, me.z, res.events.splash ? 1.15 : 0.65);
      }
      if (res.events.rustled) {
        const w = c.toWorld(me.x, me.z);
        c.env.play?.('rustle', w.x, w.z, 9.5);
      }
    }
    spec.onTick?.(walker, dt, t, me);
  });

  return { bridgeSupport, water, get walker() { return walker; } };
}

/* ---- 5. Plain-room standing props (`quiet.js` `thicket`) ------------------ */

export function forestStanding(c, p) {
  const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2;
  if (p.prop === 'trunk') {
    const topY = c.ceilAt(p.x, p.z);
    const scale = 0.038, tallVox = Math.round((topY + 0.2) / scale);
    const isBirch = ((Math.round(p.x * 7 + p.z * 11) + c.room.id) & 1) === 1;
    placeVox(
      c,
      `forest:stand:${isBirch ? 'birch' : 'pine'}:${tallVox}`,
      isBirch ? gnarledBirchVox(tallVox) : gnarledPineVox(tallVox, true),
      p.x,
      p.z,
      { rot: (p.x + p.z) * 1.7, scale }
    );
    plenumBreach(c, p.x - 0.15, p.z - 0.15, 1, Math.round(p.x * 5 + p.z * 9));
    castCanopyShadow(c, p.x, p.z, 1.25, Math.round(p.x * 3 + p.z * 7));
    c.solid(x0, z0, x1, z1, { tall: true, keep: true });
    c.reserve(p.x, p.z, 0.45);
  } else if (p.prop === 'hedge') {
    const h = Math.min(c.H - 0.25, p.h || 2.38);
    const tex = c.kit.tex.custom('forest:plain:hedge', 128, 128, (g, w, th) => {
      g.fillStyle = '#0d1a0f'; g.fillRect(0, 0, w, th);
      const cols = ['#132916', '#1b381e', '#244726', '#0a140c', '#2d542e'];
      for (let i = 0; i < 1500; i++) {
        const rx = Math.floor(Math.abs(Math.sin(i * 12.7) * w));
        const ry = Math.floor(Math.abs(Math.cos(i * 31.3) * th));
        g.fillStyle = cols[i % cols.length];
        g.fillRect(rx, ry, 3, 2);
      }
      g.strokeStyle = '#3b2617'; g.lineWidth = 2;
      for (let i = 0; i < 18; i++) {
        g.beginPath(); g.moveTo((i * 19) % w, (i * 29) % th); g.lineTo(((i * 19) + 26) % w, ((i * 29) + 14) % th); g.stroke();
      }
    });
    const b = c.mapped('forest:plain:hedge', tex);
    b.box(x0, 0, z0, x1, h, z1, WHITE, { uv: 1.35, skip: '-y' });
    if (h + 0.18 < c.H - 0.05) {
      b.box(x0 + 0.08, h, z0 + 0.05, x1 - 0.08, h + 0.18, z1 - 0.05, [0.85, 0.9, 0.85], { uv: 1.35, skip: '-y' });
    }
    c.blot(p.x, p.z, p.w + 0.55, p.d + 0.55, { rgb: [0.03, 0.04, 0.02], a: 0.50 });
    c.solid(x0, z0, x1, z1, { tall: true, keep: true });
    c.reserve(p.x, p.z, Math.max(p.w, p.d) * 0.5 + 0.22);
  } else if (p.prop === 'rail') {
    const alongX = p.w >= p.d;
    const h = p.h || 0.96;
    // Split-rail cedar trail fence with end posts & two horizontal rails
    const posts = alongX ? [[x0 + 0.06, p.z], [x1 - 0.06, p.z]] : [[p.x, z0 + 0.06], [p.x, z1 - 0.06]];
    for (const [px, pz] of posts) {
      c.flat.box(px - 0.055, 0, pz - 0.055, px + 0.055, h + 0.06, pz + 0.055, CEDAR_TIMBER, { skip: '-y' });
    }
    for (const ry of [0.38, 0.78]) {
      if (alongX) c.flat.box(x0, ry, p.z - 0.035, x1, ry + 0.085, p.z + 0.035, CEDAR_TIMBER);
      else c.flat.box(p.x - 0.035, ry, z0, p.x + 0.035, ry + 0.085, z1, CEDAR_TIMBER);
    }
    c.solid(x0, z0, x1, z1, { keep: true });
    c.reserve(p.x, p.z, Math.max(p.w, p.d) * 0.5 + 0.18);
  }
}

/* ---- 6. Plain-room dressing (`gen.js` `KNOWN_THINGS`) --------------------- */

export const FOREST_THINGS = {
  stump(c, item) {
    const s = c.spot(0.55, { head: 0.9 });
    if (!s) return;
    const rings = 2 + (item.seed % 5);
    placeVox(c, `forest:stump:${rings}`, stumpVox(rings), s.x, s.z, { rot: item.turn, solidRadius: 0.26 });
    c.blot(s.x, s.z, 0.85, 0.85, { a: 0.34 });
  },
  backpack(c, item) {
    const s = c.corner(0.55, undefined, 1.0) || c.spot(0.5, { head: 1.0 });
    if (!s) return;
    const col = ['#b84b28', '#2c6885', '#c98a26', '#4a6b38'][item.seed % 4];
    placeVox(c, `forest:pack:${col}`, backpackVox(col), s.x, s.z, { rot: item.turn, solidRadius: 0.22 });
  },
  lantern(c, item) {
    const s = c.corner(0.45, undefined, 1.0) || c.spot(0.45, { head: 1.0 });
    if (!s) return;
    placeVox(c, 'forest:lantern', campLanternVox(), s.x, s.z, { rot: item.turn });
    if (c.rt.lights.length < 13) {
      c.light(s.x, 0.45, s.z, '#ffd480', 0.48, { k: 1.4, far: 5.5 });
    }
  },
  trailpost(c, item) {
    const s = c.spot(0.45, { head: 1.5 });
    if (!s) return;
    c.flat.box(s.x - 0.055, 0, s.z - 0.055, s.x + 0.055, 1.22, s.z + 0.055, CEDAR_TIMBER, { skip: '-y' });
    c.flat.box(s.x - 0.058, 0.92, s.z - 0.058, s.x + 0.058, 1.08, s.z + 0.058, BLAZE_ORANGE);
    c.solid(s.x - 0.09, s.z - 0.09, s.x + 0.09, s.z + 0.09);
    c.reserve(s.x, s.z, 0.35);
    void item;
  },
};

/* ---- 7. Eight Seeded Plain-Room Wrongnesses (`globalThis.__forestWrong`) -- */

export const WRONG = {
  // 1. Upside-down pine canopy hanging roots-up from popped ceiling tiles, shedding needles onto carpet
  canopy(c) {
    const { W, D } = c, topY = c.ceilAt(0, 0);
    if (topY < 2.6 || Math.min(W, D) < 4.2) return false;
    const entries = [];
    for (const [dx, dz, frac] of [[-0.95, -0.65, 0.5], [0.85, 0.55, 0.56], [0.05, -0.1, 0.62]]) {
      if (Math.abs(dx) > W / 2 - 1.1 || Math.abs(dz) > D / 2 - 1.1) continue;
      plenumBreach(c, dx - 0.15, dz - 0.15, 1, Math.round(dx * 7));
      const len = Math.round((topY * frac) / 0.042);
      entries.push({
        key: `forest:ceilpine:${len}`,
        make: gnarledPineVox(len, true),
        x: dx,
        y: topY + 0.05,
        z: dz,
        rot: dx * 2.1,
        tilt: [Math.PI, 0.04],
        scale: 0.042,
      });
    }
    if (!entries.length) return false;
    placeVoxStack(c, `forest:wrong:canopy:${c.room.id}`, entries);
    c.blot(0, 0, 2.6, 2.3, { rgb: [0.05, 0.08, 0.04], a: 0.48 });
  },

  // 2. Every barcoded tree stump from a clear-cut stacked neatly in one corner pyramid
  stumps(c) {
    const k = c.corner(1.05, undefined, 1.8) || c.spot(0.95, { head: 1.8 });
    if (!k) return false;
    const entries = [];
    const tiers = [
      [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]],
      [[-0.16, 0], [0.18, 0.05]],
      [[0, 0]],
    ];
    tiers.forEach((pts, ty) => {
      pts.forEach(([ox, oz], idx) => {
        const rings = ((ty * 2 + idx) % 6) + 2;
        entries.push({
          key: `forest:stump:${rings}`,
          make: stumpVox(rings),
          x: k.x + ox,
          y: ty * 0.45,
          z: k.z + oz,
          rot: (ty + idx) * 1.1,
          scale: 0.028,
        });
      });
    });
    c.blot(k.x, k.z, 1.65, 1.65, { rgb: [0.05, 0.04, 0.02], a: 0.48 });
    placeVoxStack(c, `forest:wrong:stumps:${c.room.id}`, entries, {
      solidBox: [k.x - 0.62, k.z - 0.62, k.x + 0.62, k.z + 0.62],
    });
  },

  // 3. Mandatory HR cellophane-and-box-fan "campfire" surrounded by office chairs & soot on ceiling
  campfire(c) {
    const s = c.spot(1.15, { head: 2.0 });
    if (!s) return false;
    for (let a = 0; a < 8; a++) {
      const th = (a / 8) * Math.PI * 2;
      c.flat.ball(s.x + Math.cos(th) * 0.38, 0.06, s.z + Math.sin(th) * 0.38, 0.09, [0.36, 0.35, 0.33], 0.7, 5);
    }
    c.flat.box(s.x - 0.22, 0, s.z - 0.22, s.x + 0.22, 0.14, s.z + 0.22, [0.18, 0.20, 0.22], { skip: '-y' });
    const flame = new Batch();
    flame.box(s.x - 0.16, 0.14, s.z - 0.04, s.x + 0.16, 0.62, s.z + 0.04, [0.98, 0.48, 0.12]);
    flame.box(s.x - 0.04, 0.14, s.z - 0.16, s.x + 0.04, 0.56, s.z + 0.16, [1.0, 0.76, 0.22]);
    const fm = c.dynamic(flame, { pivot: [s.x, 0.14, s.z] });
    c.tick((_dt, t) => {
      fm.scale.y = 0.88 + 0.22 * Math.sin(t * 14);
      fm.rotation.y = Math.sin(t * 6) * 0.18;
    });
    if (c.rt.lights.length < 13) c.light(s.x, 0.55, s.z, '#ff8d2e', 0.65, { k: 1.5, far: 5.5 });
    const topY = c.ceilAt(s.x, s.z);
    c.blot(s.x, s.z, 2.0, 2.0, { rgb: [0.03, 0.03, 0.03], a: 0.65, y: topY - 0.005, down: true });
    c.solid(s.x - 0.38, s.z - 0.38, s.x + 0.38, s.z + 0.38);
    c.reserve(s.x, s.z, 0.95);
  },

  // 4. Corrupted 4th-hand scenic wilderness mural pasted across the drywall
  mural(c) {
    const w = c.wallSpot(2.8, undefined, 0.3, 2.2);
    if (!w) return false;
    forestMural(c, w.side, w.at, 1.38, 2.65, 1.65, c.room.id % 3, c.room.id * 17 + 9);
  },

  // 5. Half-sunken orange nylon ridge tent swallowed by the moss with motionless dress shoes poking out!
  sunkTent(c) {
    const s = c.spot(1.25, { head: 1.4 });
    if (!s) return false;
    placeVox(c, 'forest:tent:shoes', tentVox('#d47a28', true), s.x, s.z, {
      y: -0.22,
      rot: c.R.range(0, Math.PI * 2),
      scale: 0.028,
    });
    c.blot(s.x, s.z, 2.1, 2.1, { rgb: [0.06, 0.08, 0.04], a: 0.48 });
    c.solid(s.x - 0.52, s.z - 0.68, s.x + 0.52, s.z + 0.68);
    c.reserve(s.x, s.z, 1.15);
  },

  // 6. Ceiling tiles popped open with 3D HVAC plenum breach & roots tangling down into a yellow CAUTION bucket
  roots(c) {
    const s = c.spot(0.75, { head: 2.3 });
    if (!s) return false;
    const hole = plenumBreach(c, s.x, s.z, 2, c.room.id + 5);
    if (!hole) return false;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const rx = s.x + Math.cos(a) * 0.28, rz = s.z + Math.sin(a) * 0.28;
      c.flat.box(rx - 0.03, hole.y - 0.85 - (i % 3) * 0.35, rz - 0.03, rx + 0.03, hole.y + 0.04, rz + 0.03, CEDAR_TIMBER);
    }
    c.flat.box(s.x - 0.16, 0, s.z - 0.16, s.x + 0.16, 0.26, s.z + 0.16, [0.85, 0.72, 0.16], { skip: '-y' });
    c.blot(s.x, s.z, 1.2, 1.2, { rgb: [0.12, 0.08, 0.03], a: 0.45 });
    c.solid(s.x - 0.18, s.z - 0.18, s.x + 0.18, s.z + 0.18);
    c.reserve(s.x, s.z, 0.55);
  },

  // 7. Regimented 6×4 grid of 24 identical cedar birdhouses screwed to one wall — one ticks & glows red!
  birdhouses(c) {
    const w = c.wallSpot(2.5, undefined, 0.35, 2.2);
    if (!w) return false;
    const entries = [];
    let tickPos = null;
    for (let col = 0; col < 6; col++) {
      for (let row = 0; row < 4; row++) {
        const along = w.at + (col - 2.5) * 0.38;
        const p = c.wallAt(w.side, along, 0.14);
        const active = col === 4 && row === 1;
        if (active) tickPos = p;
        entries.push({
          key: `forest:birdhouse:${active ? 1 : 0}`,
          make: birdhouseVox(active),
          x: p.x,
          y: 0.65 + row * 0.42,
          z: p.z,
          rot: p.rot,
          scale: 0.025,
        });
      }
    }
    placeVoxStack(c, `forest:wrong:birds:${c.room.id}`, entries);
    if (tickPos) {
      const wp = c.toWorld(tickPos.x, tickPos.z);
      let wait = 1.2;
      c.tick((dt, _t, me) => {
        wait -= dt;
        if (wait <= 0 && me.inside) {
          wait = 1.4 + Math.random() * 1.2;
          c.env.play?.('tick', wp.x, wp.z, 4.5);
        }
      });
    }
  },

  // 8. An arched wooden trail footbridge built proudly over dry carpet, right beside the shimmering bog puddle it missed!
  bridge(c) {
    const s = c.spot(1.35, { head: 1.8 });
    if (!s) return false;
    const px = clamp(s.x + 0.88, -c.W / 2 + 0.9, c.W / 2 - 0.9);
    c.blot(px, s.z, 1.35, 1.55, { rgb: [0.04, 0.07, 0.03], a: 0.62 });
    buildForestWater(c, [{ x0: px - 0.52, z0: s.z - 0.62, x1: px + 0.52, z1: s.z + 0.62, depth: 0.10, waterY: 0.016 }], {
      map: peatWaterTex(c.kit, 'peat'),
      caustics: false,
      drips: true,
    });
    const bx = s.x - 0.25, bz = s.z;
    for (let i = -3; i <= 3; i++) {
      const pz = bz + i * 0.22;
      const archY = 0.04 + (1 - (i / 3.5) ** 2) * 0.14;
      c.flat.box(bx - 0.42, 0, pz - 0.09, bx + 0.42, archY, pz + 0.09, CEDAR_TIMBER, { skip: '-y' });
    }
    for (const sx of [-0.40, 0.40]) {
      c.flat.box(bx + sx - 0.03, 0, bz - 0.72, bx + sx + 0.03, 0.78, bz - 0.64, CEDAR_TIMBER);
      c.flat.box(bx + sx - 0.03, 0, bz + 0.64, bx + sx + 0.03, 0.78, bz + 0.72, CEDAR_TIMBER);
      c.flat.box(bx + sx - 0.03, 0.72, bz - 0.72, bx + sx + 0.03, 0.78, bz + 0.72, CEDAR_TIMBER);
      c.solid(bx + sx - 0.06, bz - 0.72, bx + sx + 0.06, bz + 0.72);
    }
    c.reserve(s.x, s.z, 1.25);
  },
};
export const WRONG_KEYS = Object.freeze(Object.keys(WRONG));

/* ---- 8. Plain-Room Stalker: The Trail Spotter ----------------------------- */

function spawnTrailSpotter(c, trailAxis) {
  const { W, D } = c;
  const slots = [
    [-W / 2 + 0.85, -D / 2 + 0.85],
    [W / 2 - 0.85, -D / 2 + 0.85],
    [W / 2 - 0.85, D / 2 - 0.85],
    [-W / 2 + 0.85, D / 2 - 0.85],
  ].filter(([sx, sz]) => c.clear(sx, sz, 0.42));
  if (slots.length < 2) return;
  for (const [sx, sz] of slots) c.reserve(sx, sz, 0.58);

  const fig = makeVoxGroup(c.kit, 'forest:spotter', spotterVox(), 0.028, { room: c.rt.u });
  c.add(fig);
  let state = makeSpotter(c.R.int(0, slots.length - 1));
  let known = false;

  const placeAtSlot = (me) => {
    const [sx, sz] = slots[state.slot % slots.length];
    fig.position.set(sx, 0, sz);
    fig.rotation.y = me ? Math.atan2(me.x - sx, me.z - sz) : Math.atan2(-sx, -sz);
    fig.userData.light(c.sample(sx, 1.1, sz));
    return [sx, sz];
  };

  c.after.push(() => placeAtSlot(null));
  c.rt.spotter = { fig, get state() { return state; } };

  c.tick((dt, _t, me) => {
    if (!me.inside) return;
    const [sx, sz] = slots[state.slot % slots.length];
    const wPos = c.toWorld(sx, sz);
    const meW = c.toWorld(me.x, me.z);
    const watched = c.seen(sx, sz, { radius: 0.48 });
    const clearLine = c.world.los(wPos.x, wPos.z, meW.x, meW.z);
    const offTrail = trailAxis === 'x' ? Math.abs(me.z) > 0.95 : Math.abs(me.x) > 0.95;

    if (!known && watched && Math.hypot(me.x - sx, me.z - sz) < 8) {
      known = true;
      c.met('trail-spotter');
    }

    // Track visitor with binoculars whenever unwatched!
    if (!watched) {
      fig.rotation.y = Math.atan2(me.x - sx, me.z - sz);
    }

    const res = stepSpotter(state, dt, {
      inside: true,
      offTrail,
      clearLine,
      watched,
      unseen: !watched,
    });
    state = res.state;

    if (res.relocated) {
      placeAtSlot(me);
    }
    if (res.whining) {
      c.env.play?.('whir', wPos.x, wPos.z, 7.5);
    }
    if (res.flashed) {
      c.env.play?.('shutter', wPos.x, wPos.z, 10);
      c.env.camera?.drain?.(SPOTTER.drainShare);
      c.env.interfere?.(0.75);
      c.env.hud?.glitch?.(0.45);
      if (known) c.survived('trail-spotter');
    }
  });
}

/* ---- 9. `forestRoom(c)`: Plain-Room Office Edge + Trail + Wrongness ------- */

const PLAIN_SIGNS = [
  ['SYNERGY PINES', 'STAY ON GRAVEL TRAIL', 'DO NOT FEED RACKS'],
  ['OFFSITE SECTOR 4', 'PLEASE DO NOT NAME THE TREES', 'REPORT LOOSE ANTLERS'],
  ['TOUCH GRASS ZONE', 'KEEP BADGE VISIBLE', 'NO UNAUTHORIZED SINKING'],
  ['Q4 TIMBER RESERVE', 'ALL TIMBER IS INVENTORIED', 'NO OVERNIGHT MEETINGS'],
];

export function forestRoom(c, opt = {}) {
  const { W, D, R, room } = c;
  const s = room.shape;
  if (room.crawl) return;

  // 1. Layer One (The Office): Perimeter office carpet showing around the cut moss roll + wall duplex outlets & conduits!
  if (opt.border !== false && !(s && (s.kind === 'ell' || s.kind === 'pinch'))) {
    const bw = opt.width || R.pick([0.36, 0.42, 0.48]);
    const carpet = c.mapped('forest:carpet', c.kit.tex.carpet(OFFICE_CARPET));
    const cutLip = [0.09, 0.13, 0.06];
    const rect = (x0, z0, x1, z1, y, batch, alb, uv) => {
      if (x1 - x0 > 0.01 && z1 - z0 > 0.01) {
        batch.grid(
          [x0, y, z0], [0, 0, 1], [1, 0, 0],
          ticks(z1 - z0, 0.55, 0), ticks(x1 - x0, 0.55, 0),
          uv ? (u, v) => [(x0 + v) / 1.6, (z0 + u) / 1.6] : null,
          alb
        );
      }
    };
    for (const side of ['back', 'front', 'left', 'right']) {
      const ends = side === 'left' || side === 'right';
      const half = (ends ? D : W) / 2;
      const trim = ends ? bw : 0;
      const cuts = room.doors
        .filter((d) => d.side === side)
        .map((d) => [d.c - d.w / 2, d.c + d.w / 2])
        .sort((a, b) => a[0] - b[0]);
      let from = -half + trim;
      for (const [a, b] of [...cuts, [half - trim, half - trim]]) {
        if (a - from > 0.06) {
          const p0 = c.wallAt(side, from, 0);
          const p1 = c.wallAt(side, a, bw);
          const e0 = c.wallAt(side, from, bw + 0.03);
          rect(Math.min(p0.x, p1.x), Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), Math.max(p0.z, p1.z), 0.010, carpet, WHITE, true);
          rect(Math.min(e0.x, p1.x), Math.min(e0.z, p1.z), Math.max(e0.x, p1.x), Math.max(e0.z, p1.z), 0.012, c.flat, cutLip, false);
        }
        from = Math.max(from, b);
      }
    }
  }

  // Duplex ivory electrical outlets + 3D galvanized EMT wall conduits (`detail: true`)!
  for (const side of ['left', 'right', 'back']) {
    const sp = c.wallSpot(0.5, [side], 0.25, 0.6);
    if (!sp) continue;
    c.wbox(side, sp.at, 0.08, 0.24, 0.36, 0, 0.012, [0.88, 0.85, 0.76]);
    c.wbox(side, sp.at, 0.04, 0.26, 0.29, 0.012, 0.015, [0.16, 0.16, 0.16]);
    c.wbox(side, sp.at, 0.04, 0.31, 0.34, 0.012, 0.015, [0.16, 0.16, 0.16]);
  }
  dressForestWalls(c, room.id * 11 + 3);

  // Crushed gravel trail strip running down the longer room axis in plain rooms
  const trailAxis = W >= D ? 'x' : 'z';
  if (opt.trail !== false && room.kind === 'plain' && !s && Math.min(W, D) >= 3.6) {
    const grav = c.mapped('forest:gravel', gravelTrailTex(c.kit));
    const gx0 = trailAxis === 'x' ? -W / 2 + 0.45 : -0.62;
    const gx1 = trailAxis === 'x' ? W / 2 - 0.45 : 0.62;
    const gz0 = trailAxis === 'z' ? -D / 2 + 0.45 : -0.62;
    const gz1 = trailAxis === 'z' ? D / 2 - 0.45 : 0.62;
    grav.grid(
      [gx0, 0.008, gz0], [0, 0, 1], [1, 0, 0],
      ticks(gz1 - gz0, 0.8, 0), ticks(gx1 - gx0, 0.8, 0),
      (u, v) => [(gx0 + v) / 1.2, (gz0 + u) / 1.2],
      WHITE
    );
  }

  // Occasional routed National-Park / HR rule board on plain walls
  if (opt.signs !== false && room.kind === 'plain' && R.chance(0.42)) {
    const sp = c.wallSpot(1.35, undefined, 0.35, 2.0);
    if (sp) trailSign(c, sp.side, sp.at, 1.48, R.pick(PLAIN_SIGNS), { seed: room.id * 13 + 7 });
  }

  // Plain-room stalker: The Trail Spotter (flashes off-trail visitors for 16% battery unless watched)
  if (opt.spotter !== false && room.kind === 'plain' && !s && Math.min(W, D) >= 4.4 && R.chance(0.32)) {
    spawnTrailSpotter(c, trailAxis);
  }

  // Seeded plain-room WRONG oddities (forceable via `globalThis.__forestWrong`)
  const canHold = room.kind === 'plain' && !s && Math.min(W, D) >= 3.8;
  const chance = opt.wrong ?? (!room.quiet && canHold ? 0.45 : 0);
  const forced = typeof globalThis !== 'undefined' && WRONG[globalThis.__forestWrong] ? globalThis.__forestWrong : opt.which;
  if ((forced && (canHold || opt.wrong > 0)) || (chance > 0 && R.chance(chance))) {
    const name = forced || R.pick(WRONG_KEYS);
    if (WRONG[name](c) !== false) c.rt.weird = name;
  }

  // Dense two-tier AAA Pacific Northwest forest thicket & stepped rock/dirt hills in whatever floor remains!
  if (opt.thicket !== false && room.kind === 'plain' && Math.min(W, D) >= 2.6) {
    const lanes = [];
    if (opt.trail !== false && !s && Math.min(W, D) >= 3.6) {
      lanes.push(trailAxis === 'x' ? [-W / 2 + 0.4, 0, W / 2 - 0.4, 0, 1.45] : [0, -D / 2 + 0.4, 0, D / 2 - 0.4, 1.45]);
    }
    thicket(c, {
      lanes,
      trees: s ? Math.round((W * D) / 4.2) : undefined,
      hillsOpt: { density: 1.15 },
    });
  }
}
