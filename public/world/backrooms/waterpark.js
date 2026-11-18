// The Backrooms — the corporate aquatics annex (themes.js `waterpark`): an
// indoor waterpark and Poolrooms wing built inside the office by something
// that had only ever had swimming, recreation, and hydration described to it.
//
// It is still the building: every room keeps the suspended acoustic tile
// ceiling and humming fluorescent troffers overhead, and damp office carpet
// peeks out along the walls where the ceramic mosaic tile stops short.
//
// Shared across plain Poolrooms and the waterpark deck rooms:
//   poolroom(c)          plain-room carpet border, shallow flooded basin, Skimmer, and seeded WRONG table
//   poolStanding(c, p)   tiled cabana/shower partitions for quiet.js `cabanas`
//   POOL_THINGS          abandoned floats, noodles, and loungers (gen.js KNOWN_THINGS)
//   natatoriumLight(c)   ceiling troffers for large rooms within the 16-light budget
//   createBasin(c, spec) recessed chlorinated basin with steps, caustic water, wading, and underwater diving
//   buildFlume(c, spec)  translucent primary-coloured fiberglass slide splines with support struts
//   garble / poolSign    misremembered natatorium rule signs and depth markers
//   Vox models           3 cm sculpted inner tubes, occupied leg-floats, ladders, loungers, Skimmer, Lifeguard, mushroom

import * as THREE from 'three';
import {basinOptics,ceilingLampMap} from './pool-optics.js';
import {basinFinish,poolDetail} from './pool-finish.js';
import { Vox, M } from '../vox/vox.js';
import { Batch, lamp, lin, ticks, drawText, WHITE } from './kit.js';
import { TILE } from './gen.js';
import {
  makeSwimmer, stepSwimmer,
  evalFlume, flumeLength, sampleFlumeFrames,
  makeSkimmer, stepSkimmer,
} from './waterpark.rule.js';

const P = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const DAMP_CARPET = '#74755e';
export const COPING = [0.91, 0.95, 0.96];
export const GROUT_DARK = [0.16, 0.34, 0.38];
export const CHROME = [0.78, 0.82, 0.86];
export const BRASS = [0.74, 0.60, 0.28];

/* ---- artfully misremembered lettering & natatorium textures --------------- */

export function garble(g, text, x, y, w, h, opt = {}, seed = 1) {
  let k = (seed * 2654435761) >>> 0;
  const r = () => { k = (Math.imul(k, 1664525) + 1013904223) >>> 0; return k / 4294967296; };
  const chars = String(text).split(''), mess = opt.mess ?? 0.38;
  const twin = { E: 'F', O: 'Q', I: '1', A: 'V', M: 'W', N: 'H', S: '5', R: 'P', C: 'G', U: 'V', D: '0', B: '8' };
  let size = opt.size || Math.floor(h * 0.68);
  const font = (px) => `${opt.weight || 700} ${px}px ui-monospace, Menlo, Consolas, monospace`;
  g.font = font(size);
  while (size > 5 && g.measureText('M').width * chars.length > w - 6) g.font = font(--size);
  const cw = g.measureText('M').width, x0 = x + (w - cw * chars.length) / 2 + cw / 2;
  g.fillStyle = opt.color || '#10313b';
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
    else if (kind === 2) g.rotate((r() - 0.5) * 0.6);
    else if (kind === 3) g.scale(0.6, 1.25);
    const what = kind === 4 ? (twin[ch] || ch) : kind === 5 && chars[i + 1] && chars[i + 1] !== ' ' ? chars[i + 1] : ch;
    g.fillText(what, 0, 0.5);
    if (kind === 6) { g.globalAlpha = 0.55; g.fillText(ch, cw * 0.32, 0.5); }
    g.restore();
  });
}

/** Ceramic mosaic tile texture (white, seafoam, cobalt, or emerald). */
export function poolTileTex(kit, variant = 'seafoam') {
  const palettes = {
    white: ['#d9dec9', '#cbd2c1', '#e6e6d2', '#b8c3b2', '#7b8b7e'],
    seafoam: ['#9fbca9', '#91b2a0', '#b4c8b4', '#7fa38f', '#536e60'],
    cobalt: ['#416875', '#395d6a', '#587e87', '#304d59', '#243c43'],
    emerald: ['#427866', '#396754', '#568672', '#2e5142', '#263f33'],
  };
  const pal = palettes[variant] || palettes.seafoam;
  return kit.tex.custom('wp:mosaic:' + variant, 64, 64, (g, w, h) => {
    P(g, pal[4], 0, 0, w, h); // grout
    let s = variant.length * 4999 + 17;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let y = 0; y < h; y += 8) {
      for (let x = 0; x < w; x += 8) {
        const pick = r();
        const col = pick < 0.45 ? pal[0] : pick < 0.72 ? pal[1] : pick < 0.92 ? pal[2] : pal[3];
        P(g, col, x + 1, y + 1, 7, 7);
        // Glaze edge, recessed grout and occasional chipped corners. Small
        // value differences keep the repeating mosaic from becoming confetti.
        P(g, pal[2], x + 1, y + 1, 6, 1);
        P(g, pal[3], x + 7, y + 2, 1, 6);
        if(pick<.08)P(g, pal[4], x+1, y+6, 2, 2);
        if(pick>.92)P(g, pal[1], x+3, y+3, 3, 2);
      }
    }
  });
}

/** Muted, seamless ripples under the office fluorescents. */
export function causticWaterTex(kit, tone = 'aqua') {
  const tint = tone === 'emerald' ? [52, 113, 98] : tone === 'deep' ? [37, 87, 99] : [61, 129, 131];
  return kit.tex.custom('wp:water:' + tone, 96, 96, (g, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = x * Math.PI * 2 / w, b = y * Math.PI * 2 / h;
      const long = Math.sin(2*a + b + .8*Math.sin(2*b-a));
      const cross = Math.cos(a - 3*b + .9*Math.cos(2*a+b));
      const glimmer = Math.max(0, 1 - Math.abs(long + .77*cross)*4);
      const amount = 6*long + 5*cross + 29*glimmer*glimmer;
      const [r, green, blue] = tint;
      P(g, `rgb(${Math.round(r+amount)},${Math.round(green+amount)},${Math.round(blue+amount)})`, x,y,1,1);
    }
  });
}

// The calm sheet (a sample, used by the kiddie lagoon only): what causticWaterTex is without its glowing cells and
// white web. One colour, with a few large, low-contrast patches a shade darker or lighter, in 4 px texels.
// `alpha` is the opacity the sheet is drawn at (createBasin's `waterAlpha`): the caustic sheet's own 0.52, and the
// hue near its average, so the water liquid.js draws from this sheet at Medium and High keeps its murk and filtering.
// (docs/BACKROOMS-GRAPHICS.md, water: the sample, and how to roll it out or remove it.)
export const CALM_WATER = {
  lagoon: { base: '#2f7f8e', lo: '#28717f', hi: '#3a8e9a', alpha: 0.52 },
};
export function calmWaterTex(kit, tone = 'lagoon') {
  const t = CALM_WATER[tone] || CALM_WATER.lagoon;
  return kit.tex.custom('wp:calmwater:' + tone, 64, 64, (g, w, h) => {
    // value noise on a lattice that wraps (periods 4 and 8 blocks of 4 px across 64), from fixed hashes
    const hash = (i, j, s) => { let k = (i * 374761393 + j * 668265263 + s * 2147483647) | 0; k = Math.imul(k ^ (k >>> 13), 1274126177); return ((k ^ (k >>> 16)) >>> 0) / 4294967296; };
    const noise = (x, y, p, s) => {
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const v = (a, b) => hash(((a % p) + p) % p, ((b % p) + p) % p, s);
      return (v(i, j) * (1 - sx) + v(i + 1, j) * sx) * (1 - sy) + (v(i, j + 1) * (1 - sx) + v(i + 1, j + 1) * sx) * sy;
    };
    P(g, t.base, 0, 0, w, h);
    for (let by = 0; by < 16; by++) for (let bx = 0; bx < 16; bx++) {
      const n = 0.65 * noise(bx / 4, by / 4, 4, 17) + 0.35 * noise(bx / 2, by / 2, 8, 41);
      if (n < 0.38) P(g, t.lo, bx * 4, by * 4, 4, 4);
      else if (n > 0.58) P(g, t.hi, bx * 4, by * 4, 4, 4);
    }
  });
}

/** Hang an artfully garbled natatorium rule sign or depth marker on a wall. */
export function poolSign(c, side, at, y, lines, opt = {}) {
  const w = opt.w || 1.15, h = opt.h || 0.72, seed = opt.seed || 7;
  const key = `wp:sign:${lines.join('|')}:${seed}`;
  const tex = c.kit.tex.custom(key, 144, 96, (g, tw, th) => {
    P(g, '#e9f2f2', 0, 0, tw, th);
    P(g, opt.headerBg || '#155e7a', 4, 4, tw - 8, 22);
    P(g, '#155e7a', 4, th - 6, tw - 8, 2);
    // four corner rivets
    for (const [rx, ry] of [[7, 7], [tw - 9, 7], [7, th - 10], [tw - 9, th - 10]]) P(g, '#8fa3a8', rx, ry, 2, 2);
    garble(g, lines[0] || 'POOL RULES', 6, 4, tw - 12, 22, { color: '#f3fbfb', size: 12, mess: opt.mess ?? 0.28 }, seed);
    const body = lines.slice(1);
    const rowH = Math.floor((th - 34) / Math.max(1, body.length));
    body.forEach((line, idx) => {
      // occasional AI-image-generator duplicated strip glitch
      if (idx === body.length - 1 && (seed & 3) === 1) {
        P(g, '#dce9ea', 8, 28 + idx * rowH, tw - 16, rowH);
      }
      garble(g, line, 8, 28 + idx * rowH, tw - 16, rowH, { color: idx === 0 && opt.warn ? '#a62822' : '#14323d', size: 10, mess: opt.mess ?? 0.36 }, seed + idx * 13 + 3);
    });
  }, { clamp: true });
  c.wbox(side, at, w + 0.04, y - h / 2 - 0.02, y + h / 2 + 0.02, 0, 0.016, [0.55, 0.63, 0.66]);
  c.hang(c.mapped(key, tex), side, at, y, w, h, null, WHITE, 0.019);
}

/** Ceramic depth-marker tile set into coping or wall ("0.9 M", "404 FT", "NO DIVING"). */
export function depthTile(c, x, y, z, text, rot = 0, seed = 3) {
  const key = `wp:depth:${text}:${seed}`;
  const tex = c.kit.tex.custom(key, 96, 36, (g, w, h) => {
    P(g, '#f0f5f5', 0, 0, w, h);
    P(g, '#1c4d66', 2, 2, w - 4, 2); P(g, '#1c4d66', 2, h - 4, w - 4, 2);
    garble(g, text, 4, 4, w - 8, h - 8, { color: '#132936', size: 15, mess: 0.25 }, seed);
  }, { clamp: true });
  c.lay(c.mapped(key, tex), x, z, 0.68, 0.26, rot, null, WHITE, y + 0.006);
}

/**
 * Paint a corrupted 4th-hand alien waterpark mural directly across ceramic wall tiles:
 * multi-elbowed faceless bathers, finger-rayed vertical-teeth Sun mascot, upward waterfalls,
 * horizontal copy-paste buffer duplication, RGB scanline shear, and garbled instructions.
 */
export function alienMural(c, side, at, y, w = 3.4, h = 2.1, variant = 0, seed = 19) {
  const key = `wp:mural:${variant}:${seed}`;
  const tex = c.kit.tex.custom(key, 256, 160, (g, tw, th) => {
    // Base painted pastel sky over faint ceramic grout grid
    P(g, '#c8f0ef', 0, 0, tw, th);
    for (let gx = 0; gx < tw; gx += 16) P(g, 'rgba(65,130,140,0.16)', gx, 0, 1, th);
    for (let gy = 0; gy < th; gy += 16) P(g, 'rgba(65,130,140,0.16)', 0, gy, tw, 1);
    // Double painted border frame
    P(g, '#155870', 3, 3, tw - 6, th - 6);
    P(g, '#d8f6f4', 7, 25, tw - 14, th - 48);

    // Lower painted chlorinated sea bands
    P(g, '#29acc4', 7, th - 58, tw - 14, 35);
    P(g, '#167891', 7, th - 40, tw - 14, 17);
    for (let wx = 12; wx < tw - 18; wx += 22) {
      P(g, '#e9ffff', wx, th - 58, 12, 3);
      P(g, '#8beaf5', wx + 6, th - 44, 10, 2);
    }

    // Uncanny Sun Mascot in upper corner: rays shaped like bent fingers + vertical column of square teeth
    const sx = variant === 1 ? 46 : tw - 48, sy = 56;
    g.strokeStyle = '#f29f18';
    g.lineWidth = 3;
    for (let a = 0; a < 9; a++) {
      const thA = (a / 9) * Math.PI * 2;
      const mx = sx + Math.cos(thA) * 21, my = sy + Math.sin(thA) * 21;
      const ex = mx + Math.cos(thA + 0.55) * 9, ey = my + Math.sin(thA + 0.55) * 9;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(mx, my); g.lineTo(ex, ey); g.stroke();
    }
    g.fillStyle = '#f7ca28';
    g.beginPath(); g.arc(sx, sy, 16, 0, Math.PI * 2); g.fill();
    // Vertical mouth with square white teeth (alien misunderstanding of a human smile!)
    P(g, '#23181a', sx - 4, sy - 11, 8, 22);
    for (let ty = sy - 9; ty <= sy + 8; ty += 4) {
      P(g, '#f8fbfb', sx - 3, ty, 3, 3);
      P(g, '#f8fbfb', sx + 1, ty + 1, 3, 3);
    }

    const drawAlienBather = (bx, by, skin, suit, flip = 1) => {
      // Faceless smooth oval head + swim cap stripe
      g.fillStyle = skin;
      g.beginPath(); g.ellipse(bx, by - 16, 6, 8, 0.12 * flip, 0, Math.PI * 2); g.fill();
      P(g, suit, bx - 5, by - 22, 10, 3);
      // Elongated torso in striped bathing suit
      P(g, skin, bx - 5, by - 8, 10, 18);
      P(g, suit, bx - 6, by - 3, 12, 11);
      P(g, '#f6fafa', bx - 6, by + 1, 12, 2);
      // Three-elbowed zig-zag arms raised in "recreation"
      g.strokeStyle = skin;
      g.lineWidth = 2.6;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(bx + s * 5, by - 5);
        g.lineTo(bx + s * 13, by - 12);
        g.lineTo(bx + s * 9, by - 20);
        g.lineTo(bx + s * 18, by - 26);
        g.stroke();
      }
      // Bent legs sticking at wrong angles
      g.beginPath();
      g.moveTo(bx - 3, by + 10); g.lineTo(bx - 9, by + 19); g.lineTo(bx - 4, by + 27);
      g.moveTo(bx + 3, by + 10); g.lineTo(bx + 11, by + 17); g.lineTo(bx + 15, by + 8);
      g.stroke();
    };

    if (variant === 0) {
      // Multi-color pipes twisting across mural with multi-elbowed bathers stuffed feet-up into pipe mouths
      const pipeCols = ['#f2c12e', '#18c6e3', '#eb4d42', '#d93ca4'];
      pipeCols.forEach((col, i) => {
        const px = 28 + i * 44;
        P(g, col, px, 32, 22, 74);
        P(g, 'rgba(255,255,255,0.35)', px + 3, 32, 5, 74);
        P(g, '#163d4a', px - 2, 56 + (i % 2) * 18, 26, 4);
      });
      drawAlienBather(62, 82, '#eeb694', '#d9382e', 1);
      drawAlienBather(148, 76, '#d99b78', '#1d6396', -1);
    } else if (variant === 1) {
      // Steep UPWARD waterfall ramp shooting into a black ceiling hole, with a yellow/brown log boat ascending!
      P(g, '#11161c', 152, 26, 68, 16); // ceiling plenum void
      g.strokeStyle = '#1cc8e0';
      g.lineWidth = 26;
      g.beginPath(); g.moveTo(42, th - 36); g.lineTo(184, 34); g.stroke();
      g.strokeStyle = '#ebffff';
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(38, th - 40); g.lineTo(180, 30); g.stroke();
      // Upward arrows along chute
      g.fillStyle = '#fff36b';
      for (let k = 0; k < 4; k++) {
        const ax = 66 + k * 28, ay = 108 - k * 19;
        g.beginPath(); g.moveTo(ax, ay - 9); g.lineTo(ax - 7, ay + 3); g.lineTo(ax + 7, ay + 3); g.closePath(); g.fill();
      }
      // Ascending log boat with three identical oval heads
      g.save();
      g.translate(118, 74);
      g.rotate(-0.62);
      P(g, '#693f23', -24, -6, 48, 13);
      P(g, '#f5c422', 14, -7, 12, 14);
      for (const ox of [-14, -2, 10]) {
        P(g, '#eeb694', ox - 3, -15, 7, 9);
      }
      g.restore();
    } else if (variant === 2) {
      // Towering stack of floats & inverted chairs reaching into ceiling fluorescent bars
      for (let i = 0; i < 9; i++) {
        const col = ['#f2c12e', '#ff5c8a', '#29b6d8', '#6fd96c', '#ff8833'][i % 5];
        P(g, col, 110 + ((i * 7) % 9) - 4, th - 36 - i * 10, 34, 8);
      }
      drawAlienBather(58, 86, '#eeb694', '#e04882', 1);
      drawAlienBather(192, 86, '#eeb694', '#e04882', 1); // exact copy-pasted twin!
    } else if (variant === 3) {
      // Variant 3: Pre-swim shower labyrinth diagram — bathers standing inside UPWARD floor-drain water beams & inverted ceiling lockers!
      for (const lx of [34, 62, 184, 212]) {
        P(g, '#3d636e', lx, 26, 22, 34);
        P(g, '#1f363d', lx + 4, 48, 14, 3);
        P(g, '#eb5347', lx + 6, 58, 9, 14); // soggy towel hanging down from upside-down ceiling locker
      }
      for (const bx of [98, 152]) {
        P(g, '#7e8c94', bx - 8, th - 32, 16, 4); // floor grate
        P(g, '#18d0eb', bx - 6, 34, 12, th - 66); // upward water beam
        P(g, '#eaffff', bx - 2, 34, 4, th - 66);
        P(g, '#c29838', bx - 7, 28, 14, 6); // ceiling brass head
      }
      drawAlienBather(98, 86, '#eeb694', '#1d7aa6', 1);
      drawAlienBather(152, 82, '#d89c7a', '#d9382e', -1);
    } else if (variant === 4) {
      // Variant 4: Centrifugal Hydro-Spa — glowing cyan whirlpool funnel in floor + magenta siphon pipe sucking bathers UP into ceiling!
      g.strokeStyle = '#14c9e8';
      g.lineWidth = 4;
      for (let r = 10; r <= 44; r += 8) {
        g.beginPath(); g.ellipse(92, th - 40, r * 1.35, r * 0.42, 0, 0, Math.PI * 2); g.stroke();
      }
      P(g, '#08242e', 80, th - 44, 24, 9);
      // Upward reverse-siphon pipe into ceiling void
      P(g, '#10161c', 164, 26, 54, 14);
      P(g, '#e0429b', 178, 34, 26, th - 72);
      P(g, '#ff9ad5', 183, 34, 6, th - 72);
      for (let ay = 98; ay >= 44; ay -= 18) {
        g.fillStyle = '#ebffff';
        g.beginPath(); g.moveTo(191, ay - 8); g.lineTo(184, ay + 3); g.lineTo(198, ay + 3); g.closePath(); g.fill();
      }
      drawAlienBather(92, 88, '#eeb694', '#e04882', 1);
      drawAlienBather(191, 66, '#d99b78', '#f2c12e', -1);
    } else if (variant === 5) {
      // Variant 5: Pneumatic Wave Basin — serrated turquoise tsunami wall + bathers reclining upside-down on ceiling loungers!
      for (const lx of [42, 108, 174]) {
        P(g, '#eef2f3', lx, 28, 42, 4);
        P(g, '#e05a47', lx + 4, 32, 34, 5);
        P(g, '#eeb694', lx + 12, 37, 18, 6);
      }
      g.fillStyle = '#138da6';
      g.beginPath();
      g.moveTo(18, th - 26);
      g.lineTo(18, 64);
      g.quadraticCurveTo(92, 44, 138, 86);
      g.lineTo(232, th - 26);
      g.closePath();
      g.fill();
      // Whitewater foam teeth on wave crest + drowned filing cabinet
      for (let fx = 28; fx < 134; fx += 16) P(g, '#ebffff', fx, 56 + ((fx * 3) % 14), 12, 6);
      P(g, '#525b61', 186, th - 66, 24, 38);
      P(g, '#262d30', 190, th - 60, 16, 8);
      P(g, '#262d30', 190, th - 46, 16, 8);
    } else if (variant === 6) {
      // Variant 6: Deep Diving Well — office drywall partition hanging half-submerged over drowned CRT desk & underwater air dome!
      P(g, '#0e5b59', 7, 54, tw - 14, th - 77); // deep emerald water filling room
      P(g, '#ebffff', 7, 52, tw - 14, 3); // high waterline
      P(g, '#c7c29e', 114, 25, 22, 68); // wallpapered office partition stopping mid-water!
      P(g, '#d0dce0', 112, 91, 26, 4);
      // Underwater acrylic air dome on right + drowned CRT desk on left
      g.fillStyle = 'rgba(215, 252, 255, 0.78)';
      g.beginPath(); g.arc(186, 98, 26, Math.PI, 0); g.closePath(); g.fill();
      P(g, '#7c5d3e', 34, th - 48, 44, 6);
      P(g, '#d4d0c4', 44, th - 64, 20, 16);
      P(g, '#2ef2ff', 48, th - 60, 12, 9);
      drawAlienBather(186, 96, '#eeb694', '#1d7aa6', 1);
    } else {
      // Variant 7: Toadstool Spore Nursery — floor & ceiling red polka-dot mushrooms + candy floats with upturned black slacks!
      P(g, '#efe8d5', 120, 74, 16, 52);
      g.fillStyle = '#d6342c';
      g.beginPath(); g.ellipse(128, 74, 38, 15, 0, Math.PI, 0); g.fill();
      // Inverted ceiling mushroom!
      P(g, '#efe8d5', 122, 26, 12, 24);
      g.beginPath(); g.ellipse(128, 50, 28, 11, 0, 0, Math.PI); g.fill();
      for (const sx of [106, 124, 144]) { P(g, '#f8f6ef', sx, 64, 7, 4); P(g, '#f8f6ef', sx + 2, 52, 6, 3); }
      // Occupied floats with vertical black trousers & shoes facing ceiling!
      for (const [fx, col] of [[52, '#f2c12e'], [202, '#ff5c8a']]) {
        P(g, col, fx - 18, th - 44, 36, 10);
        P(g, '#232832', fx - 9, th - 74, 6, 30);
        P(g, '#232832', fx + 3, th - 72, 6, 28);
        P(g, '#382318', fx - 12, th - 79, 10, 5);
        P(g, '#382318', fx + 2, th - 77, 10, 5);
      }
    }

    // Corrupted image-generator artefact: horizontal slice duplicated & shifted sideways + cyan/magenta scanline tear
    const bandY = 68 + (seed % 18);
    g.drawImage(g.canvas, 14, bandY, tw - 40, 14, 28, bandY + 11, tw - 40, 14);
    P(g, 'rgba(255, 48, 168, 0.34)', 7, bandY + 10, tw - 14, 2);
    P(g, 'rgba(24, 230, 255, 0.38)', 7, bandY + 24, tw - 14, 2);

    // Header & footer alien captions
    const titles = [
      ['RECREATION PIPE PROTOCOL', 'INSERT ALL LIMBS / BONES OPTIONAL'],
      ['UPWARD LOG WATERFALL', 'WATER ASCENDS TO CEILING NOW'],
      ['EQUILIBRIUM FLOAT STACK', 'DO NOT UNSTACK MANDATORY FUN'],
      ['PRE-SWIM RINSE LABYRINTH', 'STAND IN UPWARD DRAIN BEAM 400S'],
      ['CENTRIFUGAL FLESH JACUZZI', 'ROTATE IN BROTH UNTIL BONELESS'],
      ['PNEUMATIC TIDE SCHEDULE', 'CEILING LOUNGERS RESERVED FOR SURF'],
      ['SUB-PARTITION BREATHING DOME', 'DESCEND BELOW DRYWALL / DO NOT EXHALE'],
      ['SPORE FOUNTAIN NURSERY', 'FEET MUST POINT AT FLUORESCENT SKY'],
    ][variant % 8];
    garble(g, titles[0], 10, 4, tw - 20, 20, { color: '#f4fcfc', size: 12, mess: 0.24 }, seed + 3);
    P(g, '#10394a', 7, th - 23, tw - 14, 18);
    garble(g, titles[1], 10, th - 23, tw - 20, 18, { color: '#aef7ff', size: 10, mess: 0.28 }, seed + 11);
  }, { clamp: true });

  c.hang(c.mapped(key, tex), side, at, y, w, h, null, WHITE, 0.014);
}

/* ---- light-budget ceiling helper for large natatorium rooms --------------- */

export function natatoriumLight(c, cols = 3, rows = 3, every = 1, power = 1.05) {
  // Each light is the shell's own (c.fitting): at Classic and Low the flat lit panel it always was, in the shell's batch,
  // with this helper's lamp to every `every`-th, twelve at most; at Medium and High the sculpted fitting on the ceiling.
  const { W, D, H } = c;
  const tube = c.look.tube || '#e8fbff';
  const head = clamp(H / 2.6, 0.4, 2.5);
  const fixtures = [];
  let count = 0;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = (Math.round((-W / 2 + (i + 0.5) * W / cols) / TILE - 0.5) + 0.5) * TILE;
      const z = Math.round((-D / 2 + (j + 0.5) * D / rows) / TILE) * TILE;
      fixtures.push([x, z]);                                                  // (the lamps the pools reflect: pool-optics.js)
      const lit = (i + j * 2) % every === 0 && count < 12;
      c.fitting(x, z, { y: H, tube, light: lit ? { power: power * Math.pow(head, 1.45), floor: 0.28, k: 3.6 * head, far: 15 * head } : false });
      if (lit) count++;
    }
  }
  c.rt.poolLampMap = ceilingLampMap(c, fixtures, TILE, [W, D, cols, rows].join(':'));
}

/* ---- 3 cm sculpted voxel models (Vox, never plain boxes) ------------------ */

// Shared with the articulated bathers. A crooked knee, trouser cuff and actual
// heel/toe silhouette read as a person underwater, rather than two black rods.
function batherLeg(v, side, ox=0, oy=0) {
  const cloth=M('#353b3b',2),fold=M('#252d2c',2),sock=M('#797c6e',2);
  const leather=M('#48392e',1),toe=M('#55473a',1),sole=M('#20231f',2);
  const knee=side*.8,ankle=side*1.5,z=side<0?-2:1;
  const leg=(a,b,r,m)=>v.tube(a[0]+ox,a[1]+oy,a[2],b[0]+ox,b[1]+oy,b[2],r,m);
  leg([0,0,0],[knee,10,1.4],2.35,cloth);
  leg([knee,10,1.4],[ankle,19,z],1.85,cloth);
  leg([knee+side*1.4,9,1.4],[ankle+side*1.1,17,z],.55,fold);
  v.rbox(ox+ankle-2,oy+17,z-2,ox+ankle+2,oy+19,z+2,.6,fold);
  v.cyl('y',ox+ankle,z,oy+19,oy+21,1.3,sock);
  v.rbox(ox+ankle-2.3,oy+21,z-2.4,ox+ankle+2.3,oy+24,z+5.5,1.2,leather);
  v.rbox(ox+ankle-2.1,oy+23,z+2,ox+ankle+2.1,oy+25,z+5.6,1,toe);
  v.box(ox+ankle-2.3,oy+24,z-2.3,ox+ankle+2.3,oy+25,z+5.3,sole);
  v.box(ox+ankle-1.7,oy+25,z-1.8,ox+ankle+1.7,oy+26,z+.4,sole);
  for(const zz of [2,3.5])v.box(ox+ankle-1.5,oy+25,z+zz,ox+ankle+1.5,oy+25.6,z+zz+.5,leather);
}

/** Air-filled vinyl ring with a true open bore, moulded handles and patch. */
export function innerTubeVox(colorHex = '#f2c12e', occupied = false) {
  return () => {
    const v = new Vox();
    const rgb=new THREE.Color(colorHex);
    const shade=f=>M('#'+rgb.clone().multiplyScalar(f).getHexString(),1);
    const top=M(colorHex,1), underside=shade(.62), seam=shade(.78), worn=shade(1.16);
    const handle=M('#343b32',1),valve=M('#737b66',1),patch=M('#b9b08a',2);
    // Voxel centres sample an elliptical torus. cyl's last argument is a
    // taper radius, not an inner radius: the previous model filled its hole.
    const R=10.3;
    for(let x=-16;x<16;x++)for(let z=-16;z<16;z++)for(let y=0;y<10;y++){
      const radius=Math.hypot(x+.5,z+.5),dy=y+.5-4.5;
      if(((radius-R)/4.8)**2+(dy/4.1)**2>1)continue;
      const weld=y===4&&(radius>14||radius<6.5);
      const scuff=y>6&&x<-6&&z>4&&((x*7+z*3)&7)<2;
      v.set(x,y,z,weld?seam:y<3?underside:scuff?worn:top);
    }
    // Handle arches have daylight under the grip; bases are bonded to vinyl.
    for (const sx of [-1, 1]) {
      for(const z of [-3.5,3.5]){
        v.rbox(sx*R-1.6,7,z-1.5,sx*R+1.6,9,z+1.5,.6,seam);
        v.tube(sx*R,8,z,sx*R,11,z,.85,handle);
      }
      v.tube(sx*R,11,-3.5,sx*R,11,3.5,.9,handle);
    }
    v.cyl('y',0,-R,8,9.5,1.6,seam);
    v.cyl('y',0,-R,9.5,11,.9,valve);
    v.rbox(-3,8,8,2,9,12,.5,patch);
    v.box(-2,9,9,1,9.7,10,seam);
    if(occupied)for(const side of [-1,1])batherLeg(v,side,side*2.5,2);
    return v;
  };
}

/** Two independently moving legs, reusing cached voxel models. Room rules
 * drive kick strength; animation itself cannot move a hazard or cause damage. */
export function makeInnerTube(kit,color,occupied=false,scale=.03){
  const g=makeVoxGroup(kit,`wp:vinyl:${color}`,innerTubeVox(color),scale);
  g.name=occupied?'inverted-bather':'inner-tube';
  if(!occupied)return g;
  const legs=[-1,1].map(side=>{
    const leg=makeVoxGroup(kit,`wp:bather-leg:${side}`,()=>{const v=new Vox();batherLeg(v,side);return v;},scale);
    leg.name=side<0?'bather-left-leg':'bather-right-leg';
    leg.position.set(side*2.5*scale,2*scale,0);g.add(leg);return leg;
  });
  const light=g.userData.light;
  g.userData.light=rgb=>{light(rgb);for(const leg of legs)leg.userData.light(rgb);};
  g.userData.kick=(time,phase=0,agitation=0)=>{
    const burst=Math.max(0,Math.sin(time*.74+phase))**12;
    for(let i=0;i<legs.length;i++){
      const side=i?1:-1,p=phase+i*2.3;
      legs[i].rotation.x=Math.sin(time*1.25+p)*.07+Math.sin(time*7.5+p)*(burst*.16+agitation*.31);
      legs[i].rotation.z=side*.045+Math.cos(time*1.65+p)*.035+Math.sin(time*5.3+p)*agitation*.12;
      legs[i].rotation.y=Math.sin(time*1.1+p)*.07;
    }
  };
  return g;
}

/** White-and-orange rescue life ring with perimeter rope. */
export function lifeRingVox() {
  return () => {
    const v = new Vox(), white = M('#f2f5f6', 1), orange = M('#e3532a', 1), rope = M('#d8c9a3', 2);
    const R = 9.0, rT = 3.0;
    for (let a = 0; a < 48; a++) {
      const th = (a / 48) * Math.PI * 2;
      const cx = Math.cos(th) * R, cy = Math.sin(th) * R + 13;
      const band = ((a + 3) % 12) < 3 ? orange : white;
      v.ellipsoid(cx, cy, 0, rT, rT, 2.2, band);
    }
    for (let a = 0; a < 4; a++) {
      const th = (a + 0.5) * (Math.PI / 2);
      v.tube(Math.cos(th - 0.3) * 12, Math.sin(th - 0.3) * 12 + 13, 0, Math.cos(th + 0.3) * 12, Math.sin(th + 0.3) * 12 + 13, 0, 0.65, rope);
    }
    return v;
  };
}

/** Curved chrome pool ladder with three grooved treads and brass deck escutcheons. */
export function poolLadderVox() {
  return () => {
    const v = new Vox(), steel = M('#cfd8de', 0), grip = M('#2d373d', 1), brass = M('#b59449', 0);
    for (const sx of [-1, 1]) {
      const rx = sx * 7;
      // Vertical submerged rails + gooseneck curve onto coping deck
      v.cyl('y', rx, 0, 0, 38, 1.0, steel);
      v.tube(rx, 38, 0, rx, 45, -3.5, 1.0, steel);
      v.tube(rx, 45, -3.5, rx, 43, -9.5, 1.0, steel);
      v.tube(rx, 43, -9.5, rx, 30, -10.5, 1.0, steel);
      v.cyl('y', rx, -10.5, 29, 31, 2.0, brass);
      for(const dx of [-2,2])v.set(rx+dx,31,-10.5,M('#57645d',0));
    }
    for (const y of [8, 18, 28]) {
      v.rbox(-7, y, -1.5, 7, y + 1.5, 1.5, 0.5, steel);
      for(let x=-5;x<=5;x+=2)v.box(x,y+1.4,-1,x+.7,y+2,1,grip);
    }
    return v;
  };
}

/** Slatted poolside sun-lounger with striped vinyl webbing. */
export function loungerVox(stripeHex = '#2b8da8') {
  return () => {
    const v = new Vox(), frame = M('#c9cfc0', 1), s1 = M(stripeHex, 1), s2 = M('#d9d9bd', 1);
    const rubber=M('#34473f',0),hinge=M('#8a7956',0),worn=M('#9aa995',0);
    // Side rails + four legs
    for (const sx of [-1, 1]) {
      const x = sx * 9;
      v.tube(x, 9, -24, x, 9, 10, 1.0, frame);
      v.tube(x, 9, 10, x, 21, 24, 1.0, frame);
      for (const lz of [-20, 8, 20]) {
        v.tube(x, 1, lz, x, lz > 12 ? 17 : 9, lz, 0.95, frame);
        v.box(x-1,0,lz-1,x+1,1,lz+1,rubber);
      }
      // Curved armrest
      v.tube(x, 9, -4, x, 14, -4, 0.85, frame);
      v.tube(x, 14, -4, x, 15, 11, 0.85, frame);
      v.cyl('x',10,9,x-1.5,x+1.5,2,hinge);
      v.cyl('x',10,9,x-2,x+2,.6,rubber);
      v.tube(x,6,7,x,15,18,.75,frame);
      // Notched recline rack and rolled strap ends are real silhouettes.
      for(let z=12;z<20;z+=2)v.box(x-1,12,z,x+1,13,z+1,worn);
    }
    // Webbing straps along seat and reclined backrest
    for (let i = 0; i < 9; i++) {
      const z0 = -22 + i * 3.5;
      v.rbox(-8.5, 8.8, z0, 8.5, 9.8, z0 + 2.4, 0.4, i % 2 ? s1 : s2);
      for(const x of [-9,8])v.box(x,8,z0,x+1,10,z0+2.4,i%2?s1:s2);
    }
    for (let i = 0; i < 4; i++) {
      const u = (i + 0.5) / 4;
      const zc = 11 + u * 12, yc = 10 + u * 10.5;
      v.rbox(-8.5, yc, zc - 1.2, 8.5, yc + 1.4, zc + 1.2, 0.4, i % 2 ? s2 : s1);
    }
    return v;
  };
}

/** Curved foam pool noodle. */
export function noodleVox(colorHex = '#ff5c8a') {
  return () => {
    const v = new Vox(), foam = M(colorHex, 2), dark = M('#22282a', 1);
    v.tube(-16, 2.2, -3, -5, 2.4, 3.5, 2.1, foam);
    v.tube(-5, 2.4, 3.5, 7, 2.4, 2.5, 2.1, foam);
    v.tube(7, 2.4, 2.5, 17, 2.2, -4, 2.1, foam);
    v.set(-16, 2, -3, dark); v.set(17, 2, -4, dark);
    return v;
  };
}

/** Giant red-and-white spotted waterpark mushroom fountain. */
export function mushroomVox() {
  return () => {
    const v = new Vox();
    const stalk = M('#efe8d5', 2), stalkShade = M('#d7ccb4', 2), cap = M('#cd4938', 1), spot = M('#f8ead0', 1), gill = M('#e3dac2', 2);
    // Bulbous base tapering up to the gills
    v.cyl('y', 0, 0, 0, 12, 6.8, stalkShade, 5.4);
    v.cyl('y', 0, 0, 12, 42, 5.4, stalk, 4.4);
    v.cyl('y', 0, 0, 42, 52, 4.4, stalk, 5.6);
    // Painted spots follow the casting all the way over the brow; several
    // sit low enough on the lip to be seen from a child's height in the pool.
    const spots = [[-4,1,5.8],[11,14,5],[-14,19,4.7],[20,-9,4.6],[-17,-12,5.8],[1,-22,3.9]];
    for (let i=0;i<11;i++) {
      const angle = i*Math.PI*2/11+.14;
      spots.push([31*Math.cos(angle),31*Math.sin(angle),i%2 ? 3.5 : 4.2]);
    }
    const marks = spots.map(([x,z,radius]) => ({
      x, z, radius, y: 54 + 15*Math.sqrt(1-(x*x+z*z)/(33*33)),
    }));
    for (let z=-33;z<=33;z++) for (let x=-33;x<=33;x++) {
      const r = Math.hypot(x,z)/33;
      if (r>1) continue;
      const top = Math.round(54 + 15*Math.sqrt(1-r*r));
      const bottom = Math.round(51 + 2*(1-r));
      v.box(x,bottom,z,x+1,top+1,z+1,cap);
      for (const mark of marks) {
        const reach = mark.radius**2 - (x-mark.x)**2 - (z-mark.z)**2;
        if (reach <= 0) continue;
        const span = Math.sqrt(reach);
        const low = Math.max(bottom+1, Math.ceil(mark.y-span));
        const high = Math.min(top+1, Math.floor(mark.y+span)+1);
        if (high > low) v.box(x,low,z,x+1,high,z+1,spot);
      }
      v.set(x,bottom,z,gill);
    }
    for(let i=0;i<20;i++) {
      const a=i*Math.PI/10,co=Math.cos(a),si=Math.sin(a);
      v.tube(co*5,50,si*5,co*32,50,si*32,.7,stalkShade);
      v.cyl('y',co*31.5,si*31.5,48.5,51.5,1,M('#667c64',0));
    }
    v.cyl('y',0,0,9,11,7.2,M('#a2a78a',0),6);
    for(const x of [-3,3])v.box(x,10,6,x+1,13,7,M('#697c65',0));
    return v;
  };
}

/**
 * The Pool Skimmer: autonomous ribbed turquoise suction head with twin glowing
 * chlorine-tablet eyes, wide intake maw, and articulated dorsal vacuum hose.
 */
export function skimmerVox() {
  return () => {
    const v = new Vox();
    const shell = M('#1f8fa3', 1), deep = M('#125c6b', 1), bumper = M('#222a30', 1), foam = M('#e6fafa', 2);
    const eye = M('#c8fff4', 0, 1); // glowing chlorine-tablet optics (aEmis = 1)
    const hose = M('#3fb9cc', 1), rib = M('#197182', 1);
    // Churning white wake collar around waterline
    v.cyl('y', 0, 0, 0, 2, 12.5, foam, 9.5);
    // Rubber bumper skirt + sculpted hydrofoil shell
    v.rbox(-9, 1, -11, 9, 4, 11, 2, bumper);
    v.ellipsoid(0, 5.5, -1, 8.5, 4.8, 10.5, shell);
    // Ribbed gills along both flanks
    for (const z of [-6, -2, 2, 6]) v.rbox(-9.2, 4, z - 0.8, 9.2, 7.2, z + 0.8, 0.6, deep);
    // Recessed front suction maw + twin glowing tablet eyes
    v.carve(-5.5, 1.5, 7, 5.5, 5.5, 12);
    for (const sx of [-3.4, 3.4]) {
      v.ellipsoid(sx, 6.8, 7.8, 1.8, 1.5, 1.5, eye);
    }
    // Corrugated dorsal vacuum hose curving up and trailing behind
    const pts = [[0, 8, -2], [0, 14, -5], [0, 18, -10], [0, 15, -15], [0, 7, -18], [0, 1, -20]];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      v.tube(a[0], a[1], a[2], b[0], b[1], b[2], 2.1, hose);
      v.ellipsoid((a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5, 2.5, 2.5, 1.2, rib);
    }
    return v;
  };
}

/**
 * The Lifeguard (3 cm per voxel, matching cast/porter.js): red STAFF tank top,
 * rescue torpedo buoy under one arm, sunblock visor, and zinc-white sunblock
 * smeared cleanly over where his eyes should be above three silver whistles.
 */
export function lifeguardVox() {
  return () => {
    const v = new Vox();
    const skin = M('#c98e67', 1), shade = M('#a9714f', 1), red = M('#c83228', 1), redDark = M('#8f2019', 1);
    const zinc = M('#f4f6f4', 1), zincRun = M('#dce3e0', 2), hair = M('#59402a', 2), whistle = M('#d4dde2', 0), cord = M('#f0ece1', 1);
    // Bare feet / flip-flops & legs
    for (const sx of [-1, 1]) {
      const lx = sx * 3.8;
      v.rbox(lx - 2, 0, -2.5, lx + 2, 1.5, 4.5, 0.8, M('#1e3d52', 1));
      v.cyl('y', lx, 0, 1.5, 19, 1.9, skin, 2.2);
      v.rbox(lx - 2.6, 18, -3, lx + 2.6, 26, 3, 1, red);
    }
    // Swim trunks + red tank torso + white cross emblem
    v.rbox(-6.5, 23, -3.5, 6.5, 29, 3.5, 1.2, redDark);
    v.rbox(-6.8, 28, -3.6, 6.8, 45, 3.6, 1.8, red);
    v.box(-1.2, 34, 3.4, 1.2, 40, 4.1, zinc);
    v.box(-3.2, 36, 3.4, 3.2, 38, 4.1, zinc);
    // Whistle lanyard
    v.tube(-2.5, 45, 2.5, -0.5, 36, 4.2, 0.55, cord);
    v.tube(2.5, 45, 2.5, 0.5, 36, 4.2, 0.55, cord);
    // Left arm cradling sculpted red rescue torpedo buoy; right arm raised to blow whistle
    v.tube(-7.2, 43, 0, -9.5, 33, 2, 1.9, skin);
    v.tube(-9.5, 33, 2, -7.5, 29, 6, 1.7, skin);
    v.ellipsoid(-8.8, 31, 4, 2.8, 2.8, 9.5, M('#e03b2d', 1)); // rescue can
    v.rbox(-9.6, 30, 11.5, -8.0, 32, 14, 0.6, M('#1e2226', 1));

    v.tube(7.2, 43, 0, 9.2, 40, 5.5, 1.9, skin);
    v.tube(9.2, 40, 5.5, 3.8, 47, 6.5, 1.7, skin);

    // Neck & head
    v.cyl('y', 0, 0, 45, 48.5, 2.2, shade);
    v.ellipsoid(0, 53.5, 0, 5.2, 5.8, 5.0, skin);
    v.ellipsoid(0, 57.5, -1, 5.5, 3.2, 5.2, hair);
    // White lifeguard sun-visor brim
    v.rbox(-5.6, 56, -5, 5.6, 57.6, 5, 1, zinc);
    v.rbox(-5.2, 55.5, 3.5, 5.2, 56.8, 9.2, 1, zinc);
    // Uncanny Backrooms face: thick white zinc sunblock plastered across the whole upper face with drips, and THREE silver pea-whistles in a wide grin
    v.rbox(-4.8, 51.5, 3.6, 4.8, 55.8, 5.4, 0.8, zinc);
    for (const [dx, len] of [[-3.5, 3], [-1.2, 4.5], [1.6, 2.8], [3.6, 3.8]]) {
      v.box(dx, 52 - len, 4.2, dx + 1, 52, 5.3, zincRun);
    }
    for (const wx of [-2.4, 0, 2.4]) {
      v.cyl('z', wx, 49.8, 4.2, 7.6, 0.95, whistle);
      v.ellipsoid(wx, 49.6, 7.8, 1.1, 1.1, 1.1, whistle);
    }
    return v;
  };
}

/**
 * Amusement-park hollowed Log-Flume Boat (3 cm/voxel): ridged cedar bark hull,
 * bright yellow fiberglass splash cowling, tandem blue seats, chrome lap-bars, and white bow foam.
 */
export function logBoatVox() {
  return () => {
    const v = new Vox();
    const bark = M('#6b4226', 2), ridge = M('#4c2d18', 2), wood = M('#c69b68', 2);
    const cowling = M('#f4c424', 1), seat = M('#1b7aa1', 1), steel = M('#d4dee3', 0), foam = M('#ebffff', 1);
    // Rounded cedar log hull (~44 voxels = 1.32 m long, ~22 voxels = 0.66 m wide)
    v.rbox(-10, 1, -21, 10, 11, 18, 4, bark);
    v.ellipsoid(0, 6, 18, 9.5, 5.2, 6.5, bark);
    // Longitudinal bark ridges
    for (const sx of [-10, -6, 6, 10]) {
      v.box(sx, 3, -19, sx + (sx < 0 ? 1 : -1), 9, 17, ridge);
    }
    // Cut end-grain stern + hollowed cockpit interior
    v.rbox(-8.5, 2, -21.5, 8.5, 9.5, -19.5, 2, wood);
    v.carve(-7, 4, -17, 7, 13, 14);
    // Yellow molded fiberglass gunwale & splash nose-bumper
    v.rbox(-10.5, 9.5, -18, 10.5, 11.5, 16, 2, cowling);
    v.carve(-7, 9, -16, 7, 12, 13);
    v.ellipsoid(0, 8.5, 19.5, 8.5, 3.8, 5.2, cowling);
    // Two padded tandem bench seats + chrome lap-bars
    for (const sz of [-9, 4]) {
      v.rbox(-6.5, 4, sz - 3, 6.5, 7.5, sz + 2, 1, seat);
      v.tube(-6.5, 8, sz + 3.5, -5.5, 12.2, sz + 2.5, 0.75, steel);
      v.tube(6.5, 8, sz + 3.5, 5.5, 12.2, sz + 2.5, 0.75, steel);
      v.tube(-5.5, 12.2, sz + 2.5, 5.5, 12.2, sz + 2.5, 0.8, steel);
    }
    // Churning whitewater spray collar around bow
    v.ellipsoid(0, 2.5, 22, 11, 2.6, 5.5, foam);
    return v;
  };
}

/**
 * Tangled 5-headed Hydra Shower Manifold (3 cm/voxel): knotted chrome wall riser
 * sprouting five brass bell-showerheads pointing at impossible angles!
 */
export function hydraShowerVox() {
  return () => {
    const v = new Vox();
    const chrome = M('#cfdbe2', 0), dark = M('#55656e', 1), brass = M('#c79b3b', 0), face = M('#2d383e', 1), red = M('#d62c24', 1);
    // Wall escutcheon flange at z = 0 + central vertical riser
    v.cyl('z', 0, 0, 0, 2.2, 3.2, chrome);
    v.tube(0, -14, 1.5, 0, 12, 1.8, 1.25, chrome);
    // Tiny crooked red mixing handle on the stem
    v.cyl('z', 0, -6, 1.8, 4.8, 0.9, brass);
    v.rbox(-2.4, -6.6, 4.4, 2.4, -5.4, 5.4, 0.4, red);

    // Five tangled gooseneck branches ending in flared brass bell-showerheads
    const heads = [
      [[0, 8, 2], [0, 14, 7], [0, 11, 12], [0, 8.5, 13.5]],
      [[0, 6, 2], [-6, 11, 6], [-9, 8, 10], [-10.5, 5.5, 11.5]],
      [[0, 6, 2], [6, 12, 5], [9.5, 14.5, 9], [11, 16.5, 10.5]],
      [[0, 2, 2], [-5, 1, 7], [-6.5, -3.5, 10.5], [-7, -6, 11.5]],
      [[0, 3, 2], [5.5, 3, 7.5], [7, 0.5, 11.5], [7.5, -1.5, 13]],
    ];
    for (const [p0, p1, p2, p3] of heads) {
      v.tube(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], 0.95, chrome);
      v.tube(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], 0.9, chrome);
      v.ellipsoid(p2[0], p2[1], p2[2], 1.5, 1.5, 1.5, brass);
      v.tube(p2[0], p2[1], p2[2], p3[0], p3[1], p3[2], 2.5, brass);
      v.ellipsoid(p3[0], p3[1], p3[2], 2.2, 1.8, 2.2, face);
      v.cyl('y', p2[0], p2[2], p2[1] - 0.5, p2[1] + 0.5, 0.5, dark);
    }
    return v;
  };
}

/**
 * Rusted Institutional Pool Locker (3 cm/voxel): dented seafoam-slate steel cabinet,
 * louvred vents, brass number tag, and a soggy striped towel pinched in the door seam.
 */
export function wetLockerVox(towelHex = '#ff5c8a', inverted = false) {
  return () => {
    const v = new Vox();
    const body = M('#455f69', 1), door = M('#577580', 1), rust = M('#7a4b32', 2), vent = M('#223238', 1);
    const brass = M('#caa042', 0), towel = M(towelHex, 2), stripe = M('#f4f8f8', 2);
    // Cabinet ~14w x 46h x 14d voxels (0.42 m x 1.38 m x 0.42 m)
    v.rbox(-7, 0, -7, 7, 46, 7, 0.8, body);
    v.rbox(-6, 2, 6.4, 6, 44, 7.6, 0.5, door);
    // Rust streaks near bottom seam
    v.box(-6.5, 0, 5.8, -2.0, 4.5, 7.7, rust);
    v.box(2.5, 0, 5.8, 6.5, 3.2, 7.7, rust);
    // Louvred vents top & bottom + brass number plate + handle
    for (const vy of [36, 38.5, 41, 6, 8.5]) {
      v.box(-4.5, vy, 7.2, 4.5, vy + 1.1, 8.0, vent);
      v.box(-4.5,vy+1.1,7.4,4.5,vy+1.7,8.6,body);
    }
    for(const y of [9,30])v.box(-6.4,y,7.3,-5.5,y+4,8.7,brass);
    v.box(-2,32.5,8,0,33,8.5,vent);v.box(1,32.5,8,1.5,33.5,8.5,vent);
    v.box(-2.2, 32, 7.3, 2.2, 34.2, 8.0, brass);
    v.box(3.6, 21, 7.3, 4.8, 26, 8.3, M('#cfdbe2', 0));
    // Flat folded cloth with ridges, an uneven hem and a woven stripe. Reads
    // as a towel at walking distance, rather than a dangling coloured cable.
    for(let i=0;i<7;i++){
      const x=-5+i,z=8+(i%3===1?1:0),lo=inverted?39:Math.max(1,2+i%3),hi=inverted?59-i%3:20;
      v.box(x,lo,z,x+1,hi,z+1,towel);
      const y=inverted?54:6;v.box(x,y,z+1,x+1,y+1,z+1,stripe);
    }
    return v;
  };
}

/**
 * Striped Resort Patio / Beach Umbrella (3 cm/voxel): cast-iron stand, chrome mast
 * with brass tilt joint, and alternating scalloped 8-wedge canopy (~1.38 m diameter).
 */
export function beachUmbrellaVox(canopyHex = '#eb5347') {
  return () => {
    const v = new Vox();
    const base = M('#2d373d', 1), pole = M('#d7e1e6', 0), brass = M('#caa042', 0);
    const c1 = M(canopyHex, 1), c2 = M('#f5f8f8', 1), rib = M('#93a6b0', 0);
    // Weighted cast-iron umbrella stand + pole sleeve
    v.cyl('y', 0, 0, 0, 2.5, 7.5, base);
    v.cyl('y', 0, 0, 2.5, 6.5, 2.4, base);
    v.cyl('y', 0, 0, 4, 57, 1.05, pole);
    v.cyl('y', 0, 0, 37, 40, 1.65, brass);
    // Under-canopy stretcher spokes
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      v.tube(0, 43, 0, Math.cos(a) * 18, 48.5, Math.sin(a) * 18, 0.65, rib);
    }
    // 8-wedge striped domed canopy + scalloped valance + brass finial
    for (let y = 46; y <= 57; y++) {
      const u = (y - 46) / 11;
      const rad = 22.5 * Math.sqrt(Math.max(0.04, 1 - u * u * 0.88));
      for (let a = 0; a < 64; a++) {
        const th = (a / 64) * Math.PI * 2;
        const wedge = Math.floor((a / 64) * 8) % 2 === 0 ? c1 : c2;
        const px = Math.cos(th) * rad, pz = Math.sin(th) * rad;
        v.ellipsoid(px, y, pz, 1.8, 1.2, 1.8, wedge);
      }
    }
    for (let a = 0; a < 16; a++) {
      const th = (a / 16) * Math.PI * 2;
      const wedge = Math.floor((a / 16) * 8) % 2 === 0 ? c1 : c2;
      v.ellipsoid(Math.cos(th) * 22.2, 44.8, Math.sin(th) * 22.2, 2.8, 1.8, 2.8, wedge);
    }
    v.cyl('y', 0, 0, 57, 60.5, 1.35, brass);
    return v;
  };
}

/**
 * Municipal Fiberglass Springboard Assembly (3 cm/voxel): concrete anchor block,
 * adjustable fulcrum barrel with handwheel, curved chrome handrails, and ribbed grit board.
 */
export function divingBoardVox(boardHex = '#1ec8e6') {
  return () => {
    const v = new Vox();
    const conc = M('#dce6e8', 2), steel = M('#cfdbe2', 0), fulc = M('#1d5f7a', 1);
    const board = M(boardHex, 1), grit = M('#f4f9fa', 2), wheel = M('#d62c24', 1);
    // Anchor block (`z = -24..-12`) + forward fulcrum roller (`z = -4..0`)
    v.rbox(-7.5, 0, -24, 7.5, 9.5, -12, 1.0, conc);
    v.rbox(-7.5, 0, -4.5, 7.5, 7.5, -0.5, 0.8, fulc);
    v.cyl('x', -2.5, 8.8, -9.2, 9.2, 1.8, steel);
    v.cyl('x', -2.5, 8.8, 9.2, 10.6, 3.2, wheel);
    // Ribbed fiberglass springboard (`z = -23..28`) + non-slip white grit tip
    v.rbox(-7.2, 9.8, -23, 7.2, 11.8, 28, 0.6, board);
    v.box(-6.6, 11.6, 16, 6.6, 12.3, 27.4, grit);
    for (let rz = -20; rz <= 14; rz += 4) {
      v.box(-6.4, 11.6, rz, 6.4, 12.1, rz + 1.4, grit);
    }
    // Dual curved chrome safety handrails (`sx = -8.6, +8.6`)
    for (const sx of [-1, 1]) {
      const rx = sx * 8.6;
      v.tube(rx, 9, -22, rx, 24, -20, 0.95, steel);
      v.tube(rx, 24, -20, rx, 24, -2, 0.95, steel);
      v.tube(rx, 24, -2, rx, 10, 1, 0.95, steel);
    }
    return v;
  };
}

/**
 * Corrupted 4th-hand Alien Hydrotherapy Jet Column (3 cm/voxel): seafoam ceramic
 * pedestal bristling with 8 brass eyeball jets, copper manifold loops, and a top pressure gauge.
 */
export function spaJetPillarVox() {
  return () => {
    const v = new Vox();
    const tile = M('#9ed8d2', 1), trim = M('#235d73', 1), chrome = M('#d2dee6', 0);
    const brass = M('#caa042', 0), copper = M('#b86b3a', 0), dial = M('#f4f9fa', 1), red = M('#d92b24', 1);
    v.cyl('y', 0, 0, 0, 4, 7.8, trim);
    v.cyl('y', 0, 0, 4, 34, 6.2, tile);
    v.cyl('y', 0, 0, 34, 37, 7.0, chrome);
    // 8 protruding brass hydro-massage eyeball nozzles around 2 tiers
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (i % 2) * 0.25;
      const ny = i % 2 === 0 ? 13 : 24;
      const dx = Math.cos(a), dz = Math.sin(a);
      v.tube(dx * 5.2, ny, dz * 5.2, dx * 8.8, ny + (i % 3 - 1) * 1.2, dz * 8.8, 1.8, brass);
      v.ellipsoid(dx * 9.0, ny + (i % 3 - 1) * 1.2, dz * 9.0, 1.3, 1.3, 1.3, trim);
    }
    // Exterior copper bypass pipes + top pressure gauge dial
    for (const sx of [-1, 1]) {
      v.tube(sx * 5.5, 6, 0, sx * 7.8, 18, 0, 0.9, copper);
      v.tube(sx * 7.8, 18, 0, sx * 5.5, 31, 0, 0.9, copper);
    }
    v.cyl('y', 0, 0, 37, 41, 1.3, brass);
    v.cyl('z', 0, 44.5, -1.6, 1.6, 4.2, brass);
    v.cyl('z', 0, 44.5, 1.2, 2.0, 3.3, dial);
    v.tube(0, 44.5, 2.1, 2.0, 46.2, 2.1, 0.55, red);
    return v;
  };
}

/** Build a lit Three.js Group from a `Vox` maker at `scale` (default 3 cm/voxel), matching `porter.js`. */
export function makeVoxGroup(kit, key, make, scale = 0.03) {
  const mat = kit.surface({ vox: true });
  const q = new Batch(true);
  q.addVox(kit.model(key, make).solid, new THREE.Matrix4().makeScale(scale, scale, scale));
  const lights = [lamp(0.4, 2.5, 1.1, [1.18, 1.22, 1.24], { k: 9, wrap: 0.45, far: 30 })];
  const mesh = new THREE.Mesh(kit.geometry(q, lights, [0.62, 0.65, 0.66]), mat);
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.light = (rgb) => mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
  return g;
}

/** Place a 3 cm `Vox` prop in room `c` with automatic baked room-light tinting. */
export function placeVox(c, key, make, x, z, opt = {}) {
  const g = makeVoxGroup(c.kit, key, make, opt.scale ?? 0.03);
  const y = opt.y ?? 0;
  g.position.set(x, y, z);
  if (opt.rot) g.rotation.y = opt.rot;
  if (opt.tilt) { g.rotation.x = opt.tilt[0]; g.rotation.z = opt.tilt[1]; }
  c.add(g);
  c.after.push(() => g.userData.light(c.sample(x, Math.max(0.25, y + 0.35), z)));
  if (opt.solidRadius) {
    const r = opt.solidRadius;
    c.solid(x - r, z - r, x + r, z + r);
  }
  return g;
}

/**
 * Bake an entire glitched tower/arch/pile of `Vox` items into ONE single `THREE.Mesh` (`Batch(true)`),
 * keeping room mesh budgets lean even when stacking 16+ floats or sun-loungers!
 * entries: Array<{ key, make, x, y, z, rot?: number, tilt?: [rx, rz], scale?: number }>
 */
export function placeVoxStack(c, stackKey, entries, opt = {}) {
  if (!entries.length) return null;
  const mat = c.kit.surface({ vox: true });
  const q = new Batch(true);
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  let ax = 0, ay = 0, az = 0;
  for (const e of entries) {
    const s = e.scale ?? 0.03;
    const rx = e.tilt ? e.tilt[0] : 0;
    const rz = e.tilt ? e.tilt[1] : 0;
    euler.set(rx, e.rot || 0, rz, 'YXZ');
    quat.setFromEuler(euler);
    pos.set(e.x, e.y, e.z);
    scl.set(s, s, s);
    m4.compose(pos, quat, scl);
    q.addVox(c.kit.model(e.key, e.make).solid, m4);
    ax += e.x; ay += e.y; az += e.z;
  }
  ax /= entries.length; ay /= entries.length; az /= entries.length;

  const lights = [
    lamp(ax + 1.8, ay + 4.5, az + 2.2, [1.18, 1.22, 1.24], { k: 12, wrap: 0.48, far: 36 }),
  ];
  const mesh = new THREE.Mesh(c.kit.geometry(q, lights, [0.64, 0.67, 0.68]), mat);
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.stackKey = stackKey;
  c.add(g);
  const sampleY = opt.sampleY ?? Math.max(0.35, Math.min(2.4, ay));
  c.after.push(() => {
    const rgb = c.sample(opt.sampleX ?? ax, sampleY, opt.sampleZ ?? az);
    mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
  });
  if (opt.solidBox) {
    const [x0, z0, x1, z1] = opt.solidBox;
    c.solid(x0, z0, x1, z1, opt.solidOpt);
  }
  return g;
}

/** Bake and add a lit translucent `Batch` (`uAlpha < 1`, `depthWrite: false`, `renderOrder = 3`). */
export function addTranslucent(c, batch, opt = {}) {
  const holder = new THREE.Group();
  c.add(holder);
  c.after.push(() => {
    const geo = c.kit.geometry(batch, c.rt.lights, c.rt.amb, c.rt.lighting);
    if (!geo) return;
    const mat = c.kit.surface({
      map: opt.map || c.kit.tex.white(),
      room: c.rt.u,
      flick: geo.userData.flick,
      banks: geo.userData.banks,
      alpha: opt.alpha ?? 0.52,
      side: opt.side ?? THREE.DoubleSide,                  // (?? not ||: FrontSide is 0, and a caller asking for it gets it)
    });
    opt.finishMaterial?.(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = opt.order ?? 3;
    holder.add(mesh);
  });
  return holder;
}

/* ---- translucent fiberglass water slide geometry (zero-twist Bishop frames) */

/**
 * Extrude a smooth translucent fiberglass flume along 3D polyline `pts` using
 * parallel-transport (Bishop) frames — zero gimbal twist on vertical climbs/dives,
 * outward-facing `FrontSide` shells (plus inward-facing shell on open troughs or
 * crawlable interiors), and integrated molded seam ribs so flanges never slice neighbors!
 */
export function buildFlume(c, key, pts, opt = {}) {
  const radius = opt.radius ?? 0.66;
  const enclosed = opt.enclosed !== false;
  // An inward shell for every flume unless a caller says otherwise (`interior: false`): open troughs always had one;
  // an enclosed tube drawn front-side only needs one too, or from inside (or looking up into its mouth) it is a hole.
  // (A molded flume always has one.)
  const molded = !!opt.molded;
  const wantInner = molded || !enclosed || opt.interior !== false;
  const rgb = lin(opt.color || '#1ec8e6');
  const stripeRgb = molded ? lin('#f2ce97') : null;
  const ribRgb = rgb.map((v) => Math.min(1, v * 0.62 + 0.05));
  const innerRgb = rgb.map((v) => Math.min(1, v * 0.88 + 0.08));
  const steps = opt.steps || Math.max(18, Math.ceil(flumeLength(pts) / (molded ? 0.40 : 0.30)));
  const sides = molded ? 20 : enclosed ? 12 : 8;
  const arc0 = enclosed ? 0 : -Math.PI * 0.68;
  const arc1 = enclosed ? Math.PI * 2 : Math.PI * 0.68;

  const shell = opt.batch || new Batch();
  void key;

  const frames = sampleFlumeFrames(pts, steps);
  const ringPts = (f, rScale = 1) => {
    const out = [];
    const rr = radius * rScale;
    const bankOff = enclosed ? 0 : f.bank * 0.45;
    for (let s = 0; s <= sides; s++) {
      const a = arc0 + ((arc1 - arc0) * s) / sides + bankOff;
      const sn = Math.sin(a), cs = -Math.cos(a);
      out.push([
        f.x + (f.ux * sn + f.vx * cs) * rr,
        f.y + (f.uy * sn + f.vy * cs) * rr,
        f.z + (f.uz * sn + f.vz * cs) * rr,
      ]);
    }
    return out;
  };

  // The gelcoat has one continuous reflection across panel edges. Give each
  // corner its radial normal while leaving the joint and rim edges faceted.
  function skinQuad(a, b, d, e, color, f0, f1, inward = false) {
    const start = shell.nor.length;
    shell.quad(a, b, d, e, color);
    if (!molded) return;
    const centers = inward ? [f0, f1, f1, f0] : [f0, f0, f1, f1];
    const scale = inward ? -1 / (radius * 0.955) : 1 / radius;
    for (const [i, point] of [a, b, d, e].entries()) {
      const frame = centers[i], k = start + 3 * i;
      shell.nor[k] = (point[0] - frame.x) * scale;
      shell.nor[k + 1] = (point[1] - frame.y) * scale;
      shell.nor[k + 2] = (point[2] - frame.z) * scale;
    }
  }

  for (let i = 0; i < steps; i++) {
    const f0 = frames[i], f1 = frames[i + 1];
    // Every 4th ring is a darker molded fiberglass flange seam on a watertight continuous radius!
    const isRib = !molded && (i % 4 === 2) && i > 0 && i < steps - 1;
    const baseRgb = isRib ? ribRgb : rgb;
    const ring0 = ringPts(f0, 1.0);
    const ring1 = ringPts(f1, 1.0);

    for (let s = 0; s < sides; s++) {
      const aMid = arc0 + ((arc1 - arc0) * (s + 0.5)) / sides;
      const shadeK = 0.78 + 0.32 * (0.5 - 0.5 * Math.cos(aMid));
      // A faded cream side stripe runs continuously through successive slide sections.
      const paint = molded && (s === sides / 4 || s === sides * 3 / 4 - 1) ? stripeRgb : baseRgb;
      const colOut = [
        Math.min(1, paint[0] * shadeK),
        Math.min(1, paint[1] * shadeK),
        Math.min(1, paint[2] * shadeK),
      ];
      // Outward-facing radial normal (`U x T = -V` at bottom `a = 0`) for clean FrontSide culling!
      skinQuad(ring0[s], ring0[s + 1], ring1[s + 1], ring1[s], colOut, f0, f1);
    }

    if (wantInner) {
      const in0 = ringPts(f0, 0.955);
      const in1 = ringPts(f1, 0.955);
      for (let s = 0; s < sides; s++) {
        const aMid = arc0 + ((arc1 - arc0) * (s + 0.5)) / sides;
        const shadeK = 0.72 + 0.28 * (0.5 + 0.5 * Math.cos(aMid));
        const colIn = [
          Math.min(1, innerRgb[0] * shadeK),
          Math.min(1, innerRgb[1] * shadeK),
          Math.min(1, innerRgb[2] * shadeK),
        ];
        // Inward-facing radial normal so inside of open troughs / crawl tubes renders cleanly with FrontSide!
        skinQuad(in0[s], in1[s], in1[s + 1], in0[s + 1], colIn, f0, f1, true);
      }
    }
  }

  // Raised bolted collars sit outside the existing tube; the crawling bore
  // and its floor remain unchanged. One shared detail draw for every flume.
  const fittings=poolDetail(c).batch;
  const joints = [];
  if (molded) {
    // A joint every mould length in metres, including on the long sweeping bends.
    let distance = 0, nextJoint = 1.6;
    for (let i = 1; i < steps; i++) {
      const f = frames[i], prev = frames[i - 1];
      distance += Math.hypot(f.x - prev.x, f.y - prev.y, f.z - prev.z);
      if (distance >= nextJoint) { joints.push(i); nextJoint += 2.2; }
    }
    // Close just the exposed wall thickness, so the mouth reads as rolled plastic.
    for (const i of [0, steps]) {
      const outer = ringPts(frames[i]), inner = ringPts(frames[i], 0.955);
      for (let j = 0; j < sides; j++) {
        if (i === 0) shell.quad(outer[j], inner[j], inner[j+1], outer[j+1], ribRgb);
        else shell.quad(outer[j+1], inner[j+1], inner[j], outer[j], ribRgb);
      }
    }
  } else {
    for (let i = 6; i < steps - 2; i += 8) joints.push(i);
  }
  for(const i of joints){
    const f=frames[i],before=frames[i-1],after=frames[i+1];
    const a={...f,x:f.x+(before.x-after.x)*.06,y:f.y+(before.y-after.y)*.06,z:f.z+(before.z-after.z)*.06};
    const d={...f,x:f.x+(after.x-before.x)*.06,y:f.y+(after.y-before.y)*.06,z:f.z+(after.z-before.z)*.06};
    const innerA=ringPts(a,1.005),innerD=ringPts(d,1.005),outerA=ringPts(a,1.07),outerD=ringPts(d,1.07);
    for(let j=0;j<sides;j++){
      fittings.quad(outerA[j],outerA[j+1],outerD[j+1],outerD[j],ribRgb);
      fittings.quad(innerA[j+1],outerA[j+1],outerA[j],innerA[j],ribRgb);
      fittings.quad(innerD[j],outerD[j],outerD[j+1],innerD[j+1],ribRgb);
      if(j%(molded?4:2)===0){const q=outerA[j];fittings.box(q[0]-.024,q[1]-.024,q[2]-.024,q[0]+.024,q[1]+.024,q[2]+.024,lin('#c3c3a7'));}
    }
  }

  if (!opt.batch) {
    addTranslucent(c, shell, { alpha: opt.alpha ?? 0.76, side: THREE.FrontSide, order: 3 });
  }

  // Steel support columns down to floor or hanger rods up into ceiling tiles
  const floorBase = opt.strutFloorY ?? 0;
  for (const su of opt.struts || []) {
    const p = evalFlume(pts, su);
    if (opt.hangFromCeiling && opt.ceilingH) {
      c.flat.box(p.x - 0.04, p.y + radius * 0.88, p.z - 0.04, p.x + 0.04, opt.ceilingH, p.z + 0.04, CHROME);
    } else if (p.y - radius > floorBase + 0.15) {
      c.flat.box(p.x - 0.08, floorBase, p.z - 0.08, p.x + 0.08, p.y - radius * 0.82, p.z + 0.08, CHROME, { skip: '-y' });
      c.flat.box(p.x - 0.20, floorBase, p.z - 0.20, p.x + 0.20, floorBase + 0.06, p.z + 0.20, GROUT_DARK, { skip: '-y' });
      if (opt.solidStruts !== false && floorBase === 0) c.solid(p.x - 0.14, p.z - 0.14, p.x + 0.14, p.z + 0.14);
    }
  }
}

/** Sealed-gallery slides share a wet, opaque gelcoat and a single shell draw per room. */
export function buildOverheadFlumes(c, specs) {
  const batch = new Batch();
  for (const spec of specs) {
    buildFlume(c, spec.id, spec.pts, { radius: spec.radius, color: spec.color, molded: true, batch });
  }
  return c.dynamic(batch, { wet: 0.78 });
}

/* ---- recessed chlorinated basin + wading + underwater swimming ------------ */

/**
 * Carve & render a recessed mosaic swimming basin inside a room, and wire full
 * wading, wet-tile hydroplaning, and underwater submerging (`C` or deep dive)!
 *
 * spec: {
 *   x0, z0, x1, z1,
 *   depth: 0.78,              // basin depth below y = 0 (positive metres)
 *   waterY: -0.06,            // water surface height
 *   tile: 'seafoam'|'cobalt'|'emerald'|'white',
 *   waterTone: 'aqua'|'deep'|'emerald',
 *   deckBorder: true,         // draw dry mosaic deck + bullnose coping around basin
 *   deckTex?, bedTex?, wallTex?, waterTex?, // authored materials; default pool tiles otherwise
 *   stepsSide: 'front'|'back'|'left'|'right'|'both'|'none',
 *   deepSwim: false,          // true: buoyancy treads water at surface; C dives to bottom
 *   floorAtInner?: (x, z) => y, // custom sloped floor (e.g. wave pool beach)
 *   airPocket?: { x, z, r },  // submerged air bell that refills air underwater
 *   onTick?: (info, dt, t, me) => void
 * }
 */
export function createBasin(c, spec) {
  const { W, D, kit } = c;
  const bx0 = spec.x0, bz0 = spec.z0, bx1 = spec.x1, bz1 = spec.z1;
  const depth = spec.depth ?? 0.78;
  const waterY = spec.waterY ?? -0.06;
  const tileTex = spec.deckTex || poolTileTex(kit, spec.tile || 'seafoam');
  const subTileVariant = spec.subTile || (spec.tile === 'emerald' ? 'emerald' : 'cobalt');
  const subTileTex = spec.bedTex || poolTileTex(kit, subTileVariant);
  const wallTileTex = spec.wallTex || poolTileTex(kit, spec.wallTile || 'cobalt');
  const waterTex = spec.waterTex || causticWaterTex(kit, spec.waterTone || (depth > 1.2 ? 'deep' : 'aqua'));
  const tileBatch = c.mapped('wp:btile:' + (spec.tile || 'seafoam'), tileTex);
  const subBatch = c.mapped('wp:bsub:' + subTileVariant, subTileTex);
  const wallBatch = c.mapped('wp:bwall:' + (spec.wallTile || 'cobalt'), wallTileTex);

  const inBasin = (x, z) => x > bx0 && x < bx1 && z > bz0 && z < bz1;

  // Entry/exit pool stair ramps inside the basin so world.walkable & passable allow smooth entry/exit (<= 0.21 m/step)
  const stepSides = spec.stepsSide === 'both' ? ['front', 'back'] : spec.stepsSide === 'none' ? [] : [spec.stepsSide || 'front'];
  const stepRun = 0.25, nSteps = Math.max(1, Math.ceil(depth / 0.21));
  const stepSpan = Math.min(1.45, Math.max(1.15, (bx1 - bx0) * 0.22));

  const stepFloor = (x, z) => {
    let best = -depth;
    for (const side of stepSides) {
      if ((side === 'front' || side === 'back') && Math.abs(x - (bx0 + bx1) * 0.5) <= stepSpan * 0.5) {
        const dist = side === 'front' ? (bz1 - z) : (z - bz0);
        if (dist >= 0 && dist < nSteps * stepRun) {
          const idx = Math.floor(dist / stepRun);
          best = Math.max(best, -((idx + 1) / (nSteps + 1)) * depth);
        }
      } else if ((side === 'left' || side === 'right') && Math.abs(z - (bz0 + bz1) * 0.5) <= stepSpan * 0.5) {
        const dist = side === 'right' ? (bx1 - x) : (x - bx0);
        if (dist >= 0 && dist < nSteps * stepRun) {
          const idx = Math.floor(dist / stepRun);
          best = Math.max(best, -((idx + 1) / (nSteps + 1)) * depth);
        }
      }
    }
    return best;
  };

  const baseFloorAt = (x, z) => {
    if (!inBasin(x, z)) return 0;
    if (spec.floorAtInner) return spec.floorAtInner(x, z);
    return stepFloor(x, z);
  };

  // Visual dry deck framing the basin all the way to the room walls (leaving the basin cutout open at y = 0!)
  // `poolroom()` lays damp office carpet at y = 0.011 along non-doorway wall borders on top of this deck.
  if (spec.deckBorder !== false) {
    const dx0 = -W / 2, dx1 = W / 2, dz0 = -D / 2, dz1 = D / 2;
    const layStrip = (ax0, az0, ax1, az1) => {
      if (ax1 - ax0 <= 0.01 || az1 - az0 <= 0.01) return;
      tileBatch.grid(
        [ax0, 0, az0], [0, 0, 1], [1, 0, 0],
        ticks(az1 - az0, 0.6, 0), ticks(ax1 - ax0, 0.6, 0),
        (u, v) => [(ax0 + v) / 0.8, (az0 + u) / 0.8],
        WHITE
      );
    };
    layStrip(dx0, dz0, dx1, bz0);
    layStrip(dx0, bz1, dx1, dz1);
    layStrip(dx0, Math.max(dz0, bz0), bx0, Math.min(dz1, bz1));
    layStrip(bx1, Math.max(dz0, bz0), dx1, Math.min(dz1, bz1));
  }

  basinFinish(c,spec);

  // White ceramic bullnose coping around basin lip
  const cw = 0.18;
  c.flat.box(bx0 - cw, 0, bz0 - cw, bx1 + cw, 0.045, bz0, COPING, { skip: '-y' });
  c.flat.box(bx0 - cw, 0, bz1, bx1 + cw, 0.045, bz1 + cw, COPING, { skip: '-y' });
  c.flat.box(bx0 - cw, 0, bz0, bx0, 0.045, bz1, COPING, { skip: '-y' });
  c.flat.box(bx1, 0, bz0, bx1 + cw, 0.045, bz1, COPING, { skip: '-y' });

  // Recessed mosaic pool floor & vertical tiled basin walls
  subBatch.grid(
    [bx0, -depth, bz0], [0, 0, 1], [1, 0, 0],
    ticks(bz1 - bz0, 0.65, 0), ticks(bx1 - bx0, 0.65, 0),
    (u, v) => [(bx0 + v) / 0.8, (bz0 + u) / 0.8],
    WHITE, null,
    spec.floorAtInner ? (u, v) => spec.floorAtInner(bx0 + v, bz0 + u) : null
  );
  // Four inward-facing tiled walls of the basin
  wallBatch.grid([bx0, -depth, bz0], [1, 0, 0], [0, 1, 0], ticks(bx1 - bx0, 0.7, 0), ticks(depth + 0.04, 0.5, 0), (u, v) => [u / 0.8, v / 0.8]);
  wallBatch.grid([bx1, -depth, bz1], [-1, 0, 0], [0, 1, 0], ticks(bx1 - bx0, 0.7, 0), ticks(depth + 0.04, 0.5, 0), (u, v) => [u / 0.8, v / 0.8]);
  wallBatch.grid([bx0, -depth, bz1], [0, 0, -1], [0, 1, 0], ticks(bz1 - bz0, 0.7, 0), ticks(depth + 0.04, 0.5, 0), (u, v) => [u / 0.8, v / 0.8]);
  wallBatch.grid([bx1, -depth, bz0], [0, 0, 1], [0, 1, 0], ticks(bz1 - bz0, 0.7, 0), ticks(depth + 0.04, 0.5, 0), (u, v) => [u / 0.8, v / 0.8]);

  // Draw physical tiled steps at stepSides
  if (!spec.floorAtInner) {
    const cx = (bx0 + bx1) * 0.5, cz = (bz0 + bz1) * 0.5;
    for (const side of stepSides) {
      for (let i = 0; i < nSteps; i++) {
        const yTop = -((i + 1) / (nSteps + 1)) * depth;
        if (side === 'front') c.flat.box(cx - stepSpan / 2, -depth, bz1 - (i + 1) * stepRun, cx + stepSpan / 2, yTop, bz1 - i * stepRun, COPING, { skip: '-y' });
        else if (side === 'back') c.flat.box(cx - stepSpan / 2, -depth, bz0 + i * stepRun, cx + stepSpan / 2, yTop, bz0 + (i + 1) * stepRun, COPING, { skip: '-y' });
        else if (side === 'left') c.flat.box(bx0 + i * stepRun, -depth, cz - stepSpan / 2, bx0 + (i + 1) * stepRun, yTop, cz + stepSpan / 2, COPING, { skip: '-y' });
        else if (side === 'right') c.flat.box(bx1 - (i + 1) * stepRun, -depth, cz - stepSpan / 2, bx1 - i * stepRun, yTop, cz + stepSpan / 2, COPING, { skip: '-y' });
      }
    }
  }

  // Translucent caustic water surface, drawn from above only: seen from below, the caustic picture was a bright
  // lattice of opaque-looking cells (Classic and Low; at Medium and High the water is drawn by liquid.js).
  const waterSurf = new Batch();
  waterSurf.grid(
    [bx0, waterY, bz0], [0, 0, 1], [1, 0, 0],
    ticks(bz1 - bz0, 1.0, 0), ticks(bx1 - bx0, 1.0, 0),
    (u, v) => [(bx0 + v) / 1.9, (bz0 + u) / 1.9],
    [0.88, 1.0, 1.0]
  );
  const poolClock = { value: 0 };
  addTranslucent(c, waterSurf, {
    map: waterTex,
    alpha: spec.waterAlpha ?? 0.52,
    side: THREE.FrontSide,
    order: 4,
    finishMaterial: c.rt.poolLampMap && !spec.waterTex ? mat => basinOptics(c, mat, poolClock, waterY) : undefined,
  });
  c.liquid?.(waterSurf, { kind: 'water', y: waterY });

  // Expanding splash ripple ring + underwater aquamarine camera veil (only visible while camera is below waterY!)
  const rippleGeo = new THREE.RingGeometry(0.18, 0.26, 18);
  rippleGeo.rotateX(-Math.PI / 2);
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xdafcff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
  rippleMesh.position.y = waterY + 0.012;
  c.add(rippleMesh);
  rippleMesh.userData.liquidStandIn = true;

  const veilGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
  const veilMat = new THREE.MeshBasicMaterial({ color: 0x0d7b8c, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.BackSide });
  const veilMesh = new THREE.Mesh(veilGeo, veilMat);
  veilMesh.renderOrder = 999;
  veilMesh.visible = false;
  c.add(veilMesh);

  let swimmer = makeSwimmer();
  let dynamicSupportY = null;
  let rippleAge = 99;
  if (spec.deepSwim) c.rt.fold = true;

  const prevFloorY = c.rt.floorY;
  c.rt.floorY = (x, z) => {
    if (!inBasin(x, z)) return prevFloorY ? prevFloorY(x, z) : 0;
    if (dynamicSupportY !== null) return dynamicSupportY;
    return baseFloorAt(x, z);
  };

  const info = {
    inBasin,
    waterY,
    depth,
    bounds: { x0: bx0, z0: bz0, x1: bx1, z1: bz1 },
    get swimmer() { return swimmer; },
  };
  c.rt.basin = info;

  c.tick((dt, t, me) => {
    poolClock.value = t;
    const inside = me.inside && spec.active?.() !== false && inBasin(me.x, me.z);
    const trueFloor = inside ? baseFloorAt(me.x, me.z) : 0;
    const keys = c.env.player?.input?.keys;
    const crouch = !!(keys && keys.has('c'));
    const jump = !!(keys && keys.has(' '));
    const hurry = !!(keys && keys.has('Shift')) || !!c.env.player?.input?.hurry;
    const pitch = me.world?.pitch ?? 0;

    let effWaterY = inside ? waterY : null;
    if (inside && spec.airPocket && Math.hypot(me.x - spec.airPocket.x, me.z - spec.airPocket.z) < spec.airPocket.r) {
      effWaterY = null; // head inside trapped air dome!
    }

    const res = stepSwimmer(swimmer, dt, {
      waterY: effWaterY,
      floorY: trueFloor,
      speed: me.speed,
      crouch,
      jump,
      pitch,
      hurry,
      wetTile: me.inside && !inside && Math.abs(me.x) < W / 2 - 0.45 && Math.abs(me.z) < D / 2 - 0.45,
    });
    swimmer = res.state;

    if (me.inside && me.world) {
      me.world.slow = Math.min(me.world.slow, res.slow);

      // Vertical positioning for chest-deep ducking & deep-pool swimming:
      if (inside) {
        const trueWaterDepth = waterY - trueFloor;
        if (spec.deepSwim && trueWaterDepth >= 1.25) {
          // Buoyancy support plane moves smoothly between treading-water height and deep-dive floor.
          // Compensate for player.js crouch sink (`me.world.sink`) so `me.y` tracks `res.eyeY` cleanly!
          dynamicSupportY = res.eyeY - 1.1 + (me.world.sink || 0);
        } else {
          dynamicSupportY = null;
          const wantSink = clamp((trueFloor + 1.1) - res.eyeY, 0, 0.68);
          me.world.sinkTo = Math.max(me.world.sinkTo, wantSink);
        }
      } else {
        dynamicSupportY = null;
      }

      if (res.events.slipped) {
        const w = c.toWorld(me.x, me.z);
        c.env.play?.('shuffle', w.x, w.z, 6);
        me.world.vx *= 1.38;
        me.world.vz *= 1.38;
        me.world.sinkTo = Math.max(me.world.sinkTo, 0.32);
      }
      if (res.events.splash) {
        const w = c.toWorld(me.x, me.z);
        c.env.play?.('wade', w.x, w.z, 7);
        rippleMesh.position.set(me.x, waterY + 0.012, me.z);
        rippleAge = 0;
      }
      if (res.events.dove || res.events.surfaced || res.events.bubble) {
        const w = c.toWorld(me.x, me.z);
        c.env.play?.('glug', w.x, w.z, 6);
      }
      if (res.events.warn) {
        c.env.interfere?.(0.28);
      }
      if (res.events.gasped) {
        const w = c.toWorld(me.x, me.z);
        c.env.play?.('glug', w.x, w.z, 8);
        c.env.interfere?.(0.85);
        c.env.hud?.glitch?.(0.45);
        const drained = c.env.camera?.drain?.(0.14);
        if (!drained || !drained.ok) c.hurt(1);
      }

      if (swimmer.submerged) {
        veilMesh.visible = true;
        veilMesh.position.set(me.x, me.world.y - (c.room.y || 0), me.z);
        veilMat.opacity = 0.34 + 0.14 * clamp(swimmer.airUsed / 14, 0, 1);
      } else {
        veilMesh.visible = false;
      }
    } else if (!me.inside && veilMesh.visible) {
      veilMesh.visible = false;
      dynamicSupportY = null;
    }

    if (rippleAge < 1.2) {
      rippleAge += dt;
      const k = rippleAge / 1.2;
      rippleMesh.scale.setScalar(0.7 + k * 2.8);
      rippleMat.opacity = (1 - k) * 0.55;
    } else {
      rippleMat.opacity = 0;
    }

    spec.onTick?.(info, dt, t, me);
  });

  const prevLeave = c.rt.onLeave;
  c.rt.onLeave = () => {
    prevLeave?.();
    dynamicSupportY = null;
    veilMesh.visible = false;
  };

  return info;
}

/* ---- plain-room cabana partitions (`quiet.js` `prop: 'cabana'`) ----------- */

export function poolStanding(c, p) {
  const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2;
  const h = p.h || 2.05;
  const tileBatch = c.mapped('wp:cabana', poolTileTex(c.kit, 'white'));
  // Raised tiled shower partition lifted 16 cm off the floor on chrome legs (classic locker-room stall!)
  tileBatch.box(x0, 0.16, z0, x1, h, z1, WHITE, { uv: 0.65 });
  c.flat.box(x0 - 0.01, h, z0 - 0.01, x1 + 0.01, h + 0.035, z1 + 0.01, CHROME);
  for (const [lx, lz] of [[x0 + 0.06, z0 + 0.06], [x1 - 0.06, z1 - 0.06]]) {
    c.flat.box(lx - 0.025, 0, lz - 0.025, lx + 0.025, 0.16, lz + 0.025, CHROME, { skip: '-y' });
  }
  c.solid(x0, z0, x1, z1, { tall: true, keep: true });
  c.reserve(p.x, p.z, Math.max(p.w, p.d) * 0.5 + 0.18);
}

/* ---- plain-room seeded oddities (`WRONG`, switchable via __waterparkWrong) -- */

export const WRONG = {
  // 1. An upside-down chlorinated pool recessed into the suspended ceiling grid, complete with glowing water & float!
  ceilingPool(c) {
    const { W, D, H, kit } = c;
    if (W < 5 || D < 5) return;
    const pw = Math.min(3.1, W * 0.46), pd = Math.min(3.1, D * 0.46);
    const yCeil = H - 0.008;
    const cw = 0.16, lipH = 0.16;
    // Four perimeter bullnose coping curbs hanging from the acoustic ceiling (leaving the centre open to the water!)
    c.flat.box(-pw / 2 - cw, yCeil - lipH, -pd / 2 - cw, pw / 2 + cw, yCeil, -pd / 2, COPING);
    c.flat.box(-pw / 2 - cw, yCeil - lipH, pd / 2, pw / 2 + cw, yCeil, pd / 2 + cw, COPING);
    c.flat.box(-pw / 2 - cw, yCeil - lipH, -pd / 2, -pw / 2, yCeil, pd / 2, COPING);
    c.flat.box(pw / 2, yCeil - lipH, -pd / 2, pw / 2 + cw, yCeil, pd / 2, COPING);
    // Inverted glowing caustic water plane inside the ceiling coping frame
    const upWater = c.shining('wp:ceilwater', causticWaterTex(kit, 'aqua'), 1.85, [0.58, 0.96, 1.0], { alpha: 0.9, side: THREE.DoubleSide });
    upWater.grid(
      [-pw / 2, yCeil - 0.11, -pd / 2], [1, 0, 0], [0, 0, 1],
      ticks(pw, 0.75, 0), ticks(pd, 0.75, 0),
      (u, v) => [u / 1.5, v / 1.5],
      WHITE
    );
    // Upside-down yellow float ring clinging to the ceiling water!
    placeVox(c, 'wp:ceiltube', innerTubeVox('#f2c12e', false), 0.35, -0.25, { y: yCeil - 0.19, tilt: [Math.PI, 0.15] });
    c.light(0, yCeil - 0.38, 0, '#4be6ff', 0.75, { k: 2.8, far: 8.5 });
    c.blot(0, 0, pw * 0.85, pd * 0.85, { rgb: [0.06, 0.22, 0.26], a: 0.38 });
  },

  // 2. A curved chrome pool ladder bolted high on a dry wall climbing straight into a missing ceiling tile
  ceilingLadder(c) {
    const w = c.wallSpot(1.2, undefined, 0.4, 2.2);
    if (!w) return;
    const p = c.wallAt(w.side, w.at, 0.32);
    const hole = c.hole(p.x, p.z, 1);
    placeVox(c, 'wp:ladder', poolLadderVox(), p.x, p.z, { y: Math.max(0.8, hole.y - 1.25), rot: p.rot, scale: 0.032 });
  },

  // 3. Glitched physics-overflow totem of floats and noodles stacked almost to the ceiling!
  floatPile(c) {
    const k = c.corner(0.95, undefined, 1.6) || c.spot(0.85, { head: 1.5 });
    if (!k) return;
    const colors = ['#f2c12e', '#ff5c8a', '#29b6d8', '#6fd96c', '#ff8833'];
    const entries = [];
    const maxRings = Math.min(11, Math.max(6, Math.floor((c.H - 0.35) / 0.24)));
    for (let i = 0; i < maxRings; i++) {
      const col = colors[i % colors.length];
      const occ = i === maxRings - 1;
      entries.push({
        key: `wp:tube:${col}:${occ ? 1 : 0}`,
        make: innerTubeVox(col, occ),
        x: k.x + (c.R() - 0.5) * 0.22,
        y: i * 0.23,
        z: k.z + (c.R() - 0.5) * 0.22,
        rot: c.R() * 6.28,
        tilt: [(c.R() - 0.5) * 0.26, (c.R() - 0.5) * 0.26],
      });
    }
    for (let i = 0; i < 4; i++) {
      const col = colors[(i + 2) % colors.length];
      entries.push({
        key: 'wp:noodle:' + col,
        make: noodleVox(col),
        x: k.x + (c.R() - 0.5) * 0.55,
        y: 0.14 + i * 0.36,
        z: k.z + (c.R() - 0.5) * 0.55,
        rot: c.R() * 6.28,
        tilt: [(c.R() - 0.5) * 0.85, (c.R() - 0.5) * 0.85],
      });
    }
    placeVoxStack(c, 'wp:wrong:totem:' + c.room.id, entries, {
      solidBox: [k.x - 0.42, k.z - 0.42, k.x + 0.42, k.z + 0.42],
    });
  },

  // 4. Corrupted 4th-hand alien waterpark mural painted over plain-room ceramic tiles
  alienWallMural(c) {
    const w = c.wallSpot(2.6, undefined, 0.3, 2.3);
    if (!w) return;
    alienMural(c, w.side, w.at, 1.38, 2.5, 1.55, c.room.id % 8, c.room.id * 19 + 7);
  },

  // 5. A translucent fiberglass slide section bursting out of one drywall partition and plunging directly into the floor
  deadSlide(c) {
    const w = c.wallSpot(1.5, undefined, 0.8, 2.2);
    if (!w) return;
    const p0 = c.wallAt(w.side, w.at, -0.15);
    const p1 = c.wallAt(w.side, w.at, 0.75);
    const p2 = c.wallAt(w.side, w.at, 1.55);
    if (!c.clear(p2.x, p2.z, 0.65)) return;
    const col = c.R.pick(['#1ec8e6', '#f2a922', '#eb5347']);
    buildFlume(c, 'dead:' + c.room.id, [
      [p0.x, 1.95, p0.z],
      [p1.x, 1.35, p1.z],
      [p2.x, 0.45, p2.z],
      [p2.x, -0.25, p2.z],
    ], { radius: 0.46, color: col, alpha: 0.68, struts: [] });
    c.blot(p2.x, p2.z, 1.35, 1.35, { rgb: [0.05, 0.2, 0.24], a: 0.42 });
    c.reserve(p2.x, p2.z, 0.75);
  },

  // 6. A sculpted fiberglass diving springboard bolted right onto the dry floor facing a tiny puddle
  lowBoard(c) {
    const s = c.spot(0.95, { head: 1.2 });
    if (!s) return;
    placeVox(c, 'wp:divelow:#1ec8e6', divingBoardVox('#1ec8e6'), s.x, s.z, { rot: c.R() * 6.28, scale: 0.026 });
    c.blot(s.x, s.z, 1.25, 1.25, { rgb: [0.08, 0.32, 0.38], a: 0.48 });
    c.solid(s.x - 0.32, s.z - 0.32, s.x + 0.32, s.z + 0.32);
    c.reserve(s.x, s.z, 0.9);
  },

  // 7. Reverse-gravity floor-drain geyser shooting straight UP into an upside-down beach umbrella bolted to the ceiling!
  upwardPuddleStream(c) {
    const s = c.spot(0.85, { head: 1.8 });
    if (!s || c.H < 2.5) return;
    c.flat.box(s.x - 0.18, 0, s.z - 0.18, s.x + 0.18, 0.03, s.z + 0.18, CHROME, { skip: '-y' });
    c.blot(s.x, s.z, 1.15, 1.15, { rgb: [0.06, 0.28, 0.34], a: 0.44 });
    placeVox(c, 'wp:umbceil:#eb5347', beachUmbrellaVox('#eb5347'), s.x, s.z, {
      y: c.H - 0.02,
      tilt: [Math.PI, 0.05],
      scale: 0.026,
    });
    const stream = new Batch();
    const nSeg = 8, yTop = c.H - 1.15;
    for (let i = 0; i < nSeg; i++) {
      const a0 = (i / nSeg) * Math.PI * 2, a1 = ((i + 1) / nSeg) * Math.PI * 2;
      const r0 = 0.05, r1 = 0.24;
      stream.quad(
        [s.x + Math.cos(a0) * r0, 0.03, s.z + Math.sin(a0) * r0],
        [s.x + Math.cos(a1) * r0, 0.03, s.z + Math.sin(a1) * r0],
        [s.x + Math.cos(a1) * r1, yTop, s.z + Math.sin(a1) * r1],
        [s.x + Math.cos(a0) * r1, yTop, s.z + Math.sin(a0) * r1],
        [0.42, 0.96, 1.0]
      );
    }
    addTranslucent(c, stream, { alpha: 0.48, side: THREE.DoubleSide, order: 3 });
    c.reserve(s.x, s.z, 0.72);
  },

  // 8. Two poolside sun-loungers + occupied inner tube bolted upside-down to the fluorescent ceiling!
  ceilingLoungerRow(c) {
    if (c.W < 4.5 || c.D < 4.5) return;
    const entries = [
      { key: 'wp:lounger:#2b8da8', make: loungerVox('#2b8da8'), x: -0.65, y: c.H - 0.02, z: 0, rot: 0.18, tilt: [Math.PI, 0], scale: 0.028 },
      { key: 'wp:lounger:#e05a47', make: loungerVox('#e05a47'), x: 0.65, y: c.H - 0.02, z: 0.1, rot: -0.14, tilt: [Math.PI, 0], scale: 0.028 },
      { key: 'wp:tube:#f2c12e:1', make: innerTubeVox('#f2c12e', true), x: 0, y: c.H - 0.08, z: -0.95, rot: 0.9, tilt: [Math.PI, 0.08], scale: 0.028 },
    ];
    placeVoxStack(c, 'wp:wrong:ceillounger:' + c.room.id, entries, { sampleY: Math.max(1.2, c.H - 0.5) });
    c.blot(0, 0, 1.8, 1.4, { rgb: [0.05, 0.20, 0.25], a: 0.34 });
  },
};
export const WRONG_KEYS = Object.freeze(Object.keys(WRONG));

/* ---- plain-room Pool Skimmer spawner -------------------------------------- */

export function spawnSkimmer(c, basin) {
  const b = basin.bounds;
  const fig = makeVoxGroup(c.kit, 'wp:skimmer', skimmerVox(), 0.028);
  c.add(fig);
  let sk = makeSkimmer((b.x0 + b.x1) * 0.5, (b.z0 + b.z1) * 0.5);
  let met = false, clock = 0;
  c.rt.skimmer = { get state() { return sk; } };

  c.after.push(() => {
    fig.position.set(sk.x, basin.waterY - 0.06, sk.z);
    fig.userData.light(c.sample(sk.x, 0.4, sk.z));
  });

  c.tick((dt, t, me) => {
    clock += dt;
    const inBasin = me.inside && basin.inBasin(me.x, me.z);
    const res = stepSkimmer(sk, dt, {
      inBasin,
      speed: me.speed,
      px: me.x,
      pz: me.z,
      bounds: b,
    });
    sk = res.state;
    if (!met && me.inside && c.seen(sk.x, sk.z)) {
      met = true;
      c.met('pool-skimmer');
    }
    if (res.alerted) {
      const w = c.toWorld(sk.x, sk.z);
      c.env.play?.('whir', w.x, w.z, 7);
    }
    if (res.bit) {
      const w = c.toWorld(sk.x, sk.z);
      c.env.play?.('glug', w.x, w.z, 8);
      c.env.interfere?.(0.9);
      c.env.hud?.glitch?.(0.5);
      c.env.camera?.drain?.(0.08);
      c.hurt(1);
    }
    fig.position.set(sk.x, basin.waterY - 0.05 + Math.sin(clock * (sk.mode === 'surge' ? 14 : 4)) * 0.025, sk.z);
    fig.rotation.y = sk.yaw;
    if (c.rt.group.visible && Math.floor(clock * 2) !== Math.floor((clock - dt) * 2)) {
      fig.userData.light(c.sample(sk.x, 0.4, sk.z));
    }
  });
}

/* ---- plain Poolrooms dressing (`rooms.js` calls `poolroom(c)`) ------------ */

export function poolroom(c, opt = {}) {
  const { W, D, R, room } = c, s = room.shape;
  if (room.crawl) return;

  // 1. Damp office carpet showing along wall borders (never across doorways), keeping it grounded in the office!
  if (opt.border !== false && !(s && (s.kind === 'ell' || s.kind === 'pinch'))) {
    const bw = opt.width || R.pick([0.34, 0.42, 0.48]);
    const carpet = c.mapped('wp:carpet', c.kit.tex.carpet(DAMP_CARPET));
    const rect = (x0, z0, x1, z1, y) => {
      if (x1 - x0 > 0.01 && z1 - z0 > 0.01) {
        carpet.grid([x0, y, z0], [0, 0, 1], [1, 0, 0], ticks(z1 - z0, 0.5, 0), ticks(x1 - x0, 0.5, 0), (u, v) => [(x0 + v) / 1.6, (z0 + u) / 1.6], WHITE);
      }
    };
    for (const side of ['back', 'front', 'left', 'right']) {
      const ends = side === 'left' || side === 'right';
      const half = (ends ? D : W) / 2, trim = ends ? bw : 0;
      const cuts = room.doors.filter((d) => d.side === side).map((d) => [d.c - d.w / 2, d.c + d.w / 2]).sort((a, b) => a[0] - b[0]);
      let from = -half + trim;
      for (const [a, b] of [...cuts, [half - trim, half - trim]]) {
        if (a - from > 0.05) {
          const p = c.wallAt(side, from, 0), q = c.wallAt(side, a, bw);
          rect(Math.min(p.x, q.x), Math.min(p.z, q.z), Math.max(p.x, q.x), Math.max(p.z, q.z), 0.011);
        }
        from = Math.max(from, b);
      }
    }
  }

  // 2. Occasional garbled natatorium rules board on a free stretch of wall
  if (opt.signs !== false && R.chance(0.32)) {
    const ws = c.wallSpot(1.3);
    if (ws) {
      const ruleSets = [
        ['AQUATICS ANNEX', 'SHOWER BEFORE Q4', 'NO RUNNING ON CARPET', 'CHLORINE LEVEL: YES'],
        ['POOL REGULATIONS', 'SHALLOW END 0.9M', 'DEEP END: SEE HR', 'LIFEGUARD ON BREAK'],
        ['HYDRATION BASIN', 'ADULT SWIM ONLY', 'DO NOT DRINK THE', 'FLUME WATER'],
      ];
      poolSign(c, ws.side, ws.at, 1.48, R.pick(ruleSets), { seed: room.id * 17 + 5 });
    }
  }

  // 3. Bare wide plain rooms can hold a curbed splash footbath wading basin (above `c.shell()`'s y = 0 floor!)
  const canFootbath = opt.footbath !== false && room.kind === 'plain' && !s && !room.pillars.length && !(room.blocks && room.blocks.length)
    && W >= 6.4 && D >= 6.4 && room.toExit > 2 && R.chance(0.38);
  if (canFootbath) {
    const hw = Math.min(2.1, W * 0.27), hd = Math.min(2.1, D * 0.27);
    if (c.clear(0, 0, Math.max(hw, hd) + 0.35)) {
      const cw = 0.16, curbH = 0.19;
      c.flat.box(-hw - cw, 0, -hd - cw, hw + cw, curbH, -hd, COPING, { skip: '-y' });
      c.flat.box(-hw - cw, 0, hd, hw + cw, curbH, hd + cw, COPING, { skip: '-y' });
      c.flat.box(-hw - cw, 0, -hd, -hw, curbH, hd, COPING, { skip: '-y' });
      c.flat.box(hw, 0, -hd, hw + cw, curbH, hd, COPING, { skip: '-y' });
      const cob = c.mapped('wp:fb:cob', poolTileTex(c.kit, 'cobalt'));
      cob.grid([-hw, 0.015, -hd], [0, 0, 1], [1, 0, 0], ticks(hd * 2, 0.6, 0), ticks(hw * 2, 0.6, 0), (u, v) => [v / 0.8, u / 0.8], WHITE);
      const wb = new Batch();
      wb.grid([-hw, 0.15, -hd], [0, 0, 1], [1, 0, 0], ticks(hd * 2, 0.8, 0), ticks(hw * 2, 0.8, 0), (u, v) => [v / 1.5, u / 1.5], [0.88, 1.0, 1.0]);
      addTranslucent(c, wb, { map: causticWaterTex(c.kit, 'aqua'), alpha: 0.56, side: THREE.DoubleSide, order: 4 });
      c.liquid?.(wb, { kind: 'water', y: 0.15 });
      const basin = {
        inBasin: (x, z) => Math.abs(x) < hw && Math.abs(z) < hd,
        waterY: 0.15,
        depth: 0.14,
        bounds: { x0: -hw, z0: -hd, x1: hw, z1: hd },
      };
      c.tick((dt, t, me) => {
        if (me.inside && me.world && basin.inBasin(me.x, me.z)) {
          me.world.slow = Math.min(me.world.slow, 0.78);
        }
      });
      if (R.chance(0.48) && hw >= 1.65) {
        spawnSkimmer(c, basin);
      } else if (R.chance(0.55)) {
        placeVox(c, 'wp:tube:#ff5c8a:1', innerTubeVox('#ff5c8a', true), R.range(-0.4, 0.4), R.range(-0.4, 0.4), {
          y: 0.06,
          rot: R.range(0, 6.28),
        });
      }
    }
  }

  // 4. Seeded plain-room Backrooms wrongness (forceable via globalThis.__waterparkWrong for visual auditing!)
  const forced = globalThis.__waterparkWrong;
  if (forced && WRONG[forced]) {
    WRONG[forced](c);
  } else if (opt.wrong !== 0 && R.chance(opt.wrong ?? 0.26)) {
    const which = R.pick(WRONG_KEYS);
    WRONG[which](c);
  }
}

/* ---- plain-room loose waterpark items (`themes.js` `dressing`) ------------- */

export const POOL_THINGS = {
  floatring(c, item) {
    const s = c.spot(0.55, { head: 1.0 });
    if (!s) return;
    const colors = ['#f2c12e', '#ff5c8a', '#29b6d8', '#6fd96c'];
    const col = colors[item.seed % colors.length];
    placeVox(c, 'wp:tube:' + col + ':0', innerTubeVox(col, false), s.x, s.z, { rot: item.turn });
    c.blot(s.x, s.z, 0.95, 0.95, { rgb: [0.05, 0.18, 0.22], a: 0.28 });
  },
  noodle(c, item) {
    const s = c.spot(0.5, { head: 0.8 });
    if (!s) return;
    const colors = ['#ff5c8a', '#29b6d8', '#f2c12e', '#9b6dff'];
    const col = colors[item.seed % colors.length];
    placeVox(c, 'wp:noodle:' + col, noodleVox(col), s.x, s.z, { rot: item.turn });
  },
  lounger(c, item) {
    const w = c.wallSpot(1.5, undefined, 0.55, 1.4);
    if (!w) return;
    const p = c.wallAt(w.side, w.at, 0.65);
    if (!c.clear(p.x, p.z, 0.55, 1.2)) return;
    c.reserve(p.x, p.z, 0.65);
    placeVox(c, 'wp:lounger:#2b8da8', loungerVox('#2b8da8'), p.x, p.z, { rot: p.rot + Math.PI, solidRadius: 0.36 });
  },
};
