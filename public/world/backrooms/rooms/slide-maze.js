// The Flume Knot: worn municipal pool galleries above a suspended crawl maze.
// An upward-running flume is the room's central impossible image.

import * as THREE from 'three';
import { Batch, lin, ticks, WHITE } from '../kit.js';
import { clamp, turnTo, scatter } from '../bits.js';
import { stepWalker } from '../denizens.js';
import { furnitureClear } from '../furniture-rules.js';
import { roomReturn } from '../room-physics.js';
import { goesDown } from '../seam.js';
import { makePlenumTonerRig } from './drop-plenum/rig.js';
import {
  createBasin, buildFlume, poolSign, depthTile,
  innerTubeVox, loungerVox, logBoatVox, makeVoxGroup, placeVoxStack,
  GROUT_DARK,
} from '../waterpark.js';
import {
  evalFlume, flumeLength, slideMazeSplines, stepSlideRide,
  TUBE_TONER, makeTubeToner, stepTubeToner, snipTubeToner, releaseTubeToner,
} from '../waterpark.rule.js';

import { FLUME_PALETTE as paint, flumeTextures, flumeChamber, flumeHall, flumeLights } from './slide-maze/art.js';

/* ---- Modular zero-clip cylindrical crawl-tube maze builder ---------------- */

const COPING = lin('#b9b8a1'), CHROME = lin('#7e8b7e');
const CRAWL_FLOOR_Y = 0.84;
const CRAWL_AXIS_Y = 1.46;
const CRAWL_R = 0.74;
const CRAWL_HALF_WALK = 0.44;

function buildCrawlMaze(c, bz0, flumeBatch) {
  // 8 junction hubs on a crisp 3x3 orthogonal grid suspended above the Sunken Hall
  const nodes = {
    NW: { x: -3.0, z: 1.25, color: paint.yellow, open: { n: true, s: true, e: true, w: false } },
    NC: { x: 0.0, z: 1.25, color: paint.blue, open: { n: false, s: false, e: true, w: true } },
    NE: { x: 3.0, z: 1.25, color: paint.red, open: { n: false, s: true, e: false, w: true } },
    MW: { x: -3.0, z: -1.35, color: paint.red, open: { n: true, s: true, e: true, w: false } },
    MC: { x: 0.0, z: -1.35, color: paint.green, open: { n: false, s: true, e: true, w: true } },
    ME: { x: 3.0, z: -1.35, color: paint.blue, open: { n: true, s: false, e: false, w: true } },
    SC: { x: 0.0, z: -3.95, color: paint.yellow, open: { n: true, s: false, e: true, w: false } },
    SE: { x: 3.0, z: -3.95, color: paint.yellow, open: { n: false, s: true, e: false, w: true } },
  };

  // Walkable cylindrical corridors (exact union of axis-aligned segments)
  const walkSegs = [
    [-3.0, 1.25, -3.0, 2.15],    // NW north entry mouth
    [-3.0, -1.35, -3.0, 1.25],   // West flank
    [-3.0, 1.25, 3.0, 1.25],     // North cross-tube
    [3.0, -1.35, 3.0, 1.25],     // East flank
    [-3.0, -1.35, 0.0, -1.35],   // West-center cross
    [0.0, -1.35, 3.0, -1.35],    // East-center cross
    [0.0, -3.95, 0.0, -1.35],    // Center-south trunk
    [0.0, -3.95, 3.0, -3.95],    // South-east cross
    [3.0, bz0 - 0.1, 3.0, -3.95], // SE south exit mouth
    [-3.0, -3.05, -3.0, -1.35],  // SW bailout lookout spur
  ];

  const inCrawl = (x, z) => {
    // The tube ends at each landing. Extending its footprint across the
    // boarding steps skipped a tread and made the entrance impassable.
    if (z > 2.05 || z < bz0) return false;
    for (const [ax, az, bx, bz] of walkSegs) {
      if (ax === bx) {
        if (Math.abs(x - ax) <= CRAWL_HALF_WALK && z >= Math.min(az, bz) - CRAWL_HALF_WALK && z <= Math.max(az, bz) + CRAWL_HALF_WALK) return true;
      } else if ( Math.abs(z - az) <= CRAWL_HALF_WALK && x >= Math.min(ax, bx) - CRAWL_HALF_WALK && x <= Math.max(ax, bx) + CRAWL_HALF_WALK) {
        return true;
      }
    }
    return false;
  };

  // Straight fiberglass segments meet the rounded junctions at their collars.
  const hubPad = 0.76;
  const tubeSpecs = [
    { x0: -3.0, z0: 2.05, x1: -3.0, z1: 1.25 + hubPad, color: paint.yellow, axis: 'z' },
    { x0: -3.0, z0: 1.25 - hubPad, x1: -3.0, z1: -1.35 + hubPad, color: paint.yellow, axis: 'z', portholeSide: -1 },
    { x0: -3.0 + hubPad, z0: 1.25, x1: 0.0 - hubPad, z1: 1.25, color: paint.blue, axis: 'x', portholeSide: -1 },
    { x0: 0.0 + hubPad, z0: 1.25, x1: 3.0 - hubPad, z1: 1.25, color: paint.blue, axis: 'x', portholeSide: 1 },
    { x0: 3.0, z0: 1.25 - hubPad, x1: 3.0, z1: -1.35 + hubPad, color: paint.red, axis: 'z', portholeSide: 1 },
    { x0: -3.0 + hubPad, z0: -1.35, x1: 0.0 - hubPad, z1: -1.35, color: paint.red, axis: 'x' },
    { x0: 0.0 + hubPad, z0: -1.35, x1: 3.0 - hubPad, z1: -1.35, color: paint.blue, axis: 'x' },
    { x0: 0.0, z0: -1.35 - hubPad, x1: 0.0, z1: -3.95 + hubPad, color: paint.green, axis: 'z', portholeSide: -1 },
    { x0: 0.0 + hubPad, z0: -3.95, x1: 3.0 - hubPad, z1: -3.95, color: paint.yellow, axis: 'x' },
    { x0: 3.0, z0: -3.95 - hubPad, x1: 3.0, z1: bz0, color: paint.yellow, axis: 'z' },
    { x0: -3.0, z0: -1.35 - hubPad, x1: -3.0, z1: -3.08, color: paint.blue, axis: 'z', portholeSide: -1 },
  ];

  const sides = 14;
  const emitCylinder = (spec) => {
    const rgb = lin(spec.color);
    const inRgb = rgb.map((v) => Math.min(1, v * 0.90 + 0.08));
    const ribRgb = rgb.map((v) => Math.min(1, v * 0.58 + 0.04));
    const len = Math.hypot(spec.x1 - spec.x0, spec.z1 - spec.z0);
    const nSegs = Math.max(2, Math.ceil(len / 0.36));

    // White non-slip floor runner strip along bottom inside of every crawlable segment (overlapping hub pad by 10 cm for seamless floor!)
    const rx0 = Math.min(spec.x0, spec.x1) - (spec.axis === 'z' ? 0.32 : 0.10);
    const rx1 = Math.max(spec.x0, spec.x1) + (spec.axis === 'z' ? 0.32 : 0.10);
    const rz0 = Math.min(spec.z0, spec.z1) - (spec.axis === 'x' ? 0.32 : 0.10);
    const rz1 = Math.max(spec.z0, spec.z1) + (spec.axis === 'x' ? 0.32 : 0.10);
    c.flat.box(rx0, CRAWL_FLOOR_Y - 0.03, rz0, rx1, CRAWL_FLOOR_Y + 0.01, rz1, COPING, { skip: '-y' });

    for (let i = 0; i < nSegs; i++) {
      const u0 = i / nSegs, u1 = (i + 1) / nSegs;
      const ax = spec.x0 + (spec.x1 - spec.x0) * u0;
      const az = spec.z0 + (spec.z1 - spec.z0) * u0;
      const bx = spec.x0 + (spec.x1 - spec.x0) * u1;
      const bz = spec.z0 + (spec.z1 - spec.z0) * u1;
      const isCollar = i === 0 || i === nSegs - 1;
      const rOut = CRAWL_R;
      const rIn = CRAWL_R * 0.95;
      const baseRgb = isCollar ? ribRgb : rgb;
      const midSlice = nSegs >= 3 && i === Math.floor(nSegs / 2);

      for (let s = 0; s < sides; s++) {
        const a0 = (s / sides) * Math.PI * 2;
        const a1 = ((s + 1) / sides) * Math.PI * 2;
        const aMid = (a0 + a1) * 0.5;
        // Leave a circular porthole cutout on the mid-segment side panel so crawlers can look out!
        if (spec.portholeSide && midSlice) {
          const targetA = spec.portholeSide > 0 ? Math.PI * 0.5 : Math.PI * 1.5;
          if (Math.abs(aMid - targetA) < 0.48) continue;
        }
        const sn0 = Math.sin(a0), cs0 = -Math.cos(a0);
        const sn1 = Math.sin(a1), cs1 = -Math.cos(a1);
        const p00 = spec.axis === 'z'
          ? [ax + sn0 * rOut, CRAWL_AXIS_Y + cs0 * rOut, az]
          : [ax, CRAWL_AXIS_Y + cs0 * rOut, az + sn0 * rOut];
        const p01 = spec.axis === 'z'
          ? [ax + sn1 * rOut, CRAWL_AXIS_Y + cs1 * rOut, az]
          : [ax, CRAWL_AXIS_Y + cs1 * rOut, az + sn1 * rOut];
        const p10 = spec.axis === 'z'
          ? [bx + sn0 * rOut, CRAWL_AXIS_Y + cs0 * rOut, bz]
          : [bx, CRAWL_AXIS_Y + cs0 * rOut, bz + sn0 * rOut];
        const p11 = spec.axis === 'z'
          ? [bx + sn1 * rOut, CRAWL_AXIS_Y + cs1 * rOut, bz]
          : [bx, CRAWL_AXIS_Y + cs1 * rOut, bz + sn1 * rOut];

        const q00 = spec.axis === 'z'
          ? [ax + sn0 * rIn, CRAWL_AXIS_Y + cs0 * rIn, az]
          : [ax, CRAWL_AXIS_Y + cs0 * rIn, az + sn0 * rIn];
        const q01 = spec.axis === 'z'
          ? [ax + sn1 * rIn, CRAWL_AXIS_Y + cs1 * rIn, az]
          : [ax, CRAWL_AXIS_Y + cs1 * rIn, az + sn1 * rIn];
        const q10 = spec.axis === 'z'
          ? [bx + sn0 * rIn, CRAWL_AXIS_Y + cs0 * rIn, bz]
          : [bx, CRAWL_AXIS_Y + cs0 * rIn, bz + sn0 * rIn];
        const q11 = spec.axis === 'z'
          ? [bx + sn1 * rIn, CRAWL_AXIS_Y + cs1 * rIn, bz]
          : [bx, CRAWL_AXIS_Y + cs1 * rIn, bz + sn1 * rIn];

        // Verify winding sign for spec.axis/direction so FrontSide faces outward on p and inward on q
        const dirSign = spec.axis === 'z' ? Math.sign(spec.z1 - spec.z0) : -Math.sign(spec.x1 - spec.x0);
        const shadeOut = 0.78 + 0.30 * (0.5 - 0.5 * Math.cos(aMid));
        const shadeIn = 0.74 + 0.28 * (0.5 + 0.5 * Math.cos(aMid));
        const cOut = [Math.min(1, baseRgb[0] * shadeOut), Math.min(1, baseRgb[1] * shadeOut), Math.min(1, baseRgb[2] * shadeOut)];
        const cIn = [Math.min(1, inRgb[0] * shadeIn), Math.min(1, inRgb[1] * shadeIn), Math.min(1, inRgb[2] * shadeIn)];

        if (dirSign > 0) {
          flumeBatch.quad(p00, p01, p11, p10, cOut);
          flumeBatch.quad(q00, q10, q11, q01, cIn);
        } else {
          flumeBatch.quad(p00, p10, p11, p01, cOut);
          flumeBatch.quad(q00, q01, q11, q10, cIn);
        }
      }
    }
  };

  for (const spec of tubeSpecs) emitCylinder(spec);

  for (const h of Object.values(nodes)) flumeChamber(c, flumeBatch, h, CRAWL_FLOOR_Y, CRAWL_AXIS_Y, CRAWL_R);

  return { inCrawl, nodes };
}

/* ---- Room builder --------------------------------------------------------- */

export function build(c) {
  const { W, D, H } = c;
  const hx = W / 2, hz = D / 2;

  const tex = flumeTextures(c.kit);
  c.shell({ panels: false, floor: false, wallTex: tex.paint, trim: lin('#737b66'), sockets: false });
  flumeLights(c);

  // ---------------------------------------------------------------------------
  // 1. Sunken Flooded Lower Hall (`y = -1.45 m`, shin-deep water `y = -1.16 m`)
  //    Sheer 1.45 m glazed cobalt cliffs on all 4 sides — once you slide down
  //    into this lower hall, you CANNOT climb back up the slide!
  // ---------------------------------------------------------------------------
  const bx0 = -hx + 1.75, bx1 = hx - 1.75;
  const bz0 = -hz + 2.35, bz1 = 2.05;
  const LOWER_Y = -1.45;
  const WATER_Y = -1.16;
  let lowerLatched = false;

  createBasin(c, {
    x0: bx0, z0: bz0, x1: bx1, z1: bz1,
    depth: -LOWER_Y,
    active: () => lowerLatched,
    waterY: WATER_Y,
    tile: 'seafoam',
    subTile: 'cobalt',
    wallTile: 'cobalt',
    deckTex: tex.deck, bedTex: tex.bed, wallTex: tex.bed, waterTex: tex.water,
    waterAlpha: .38,
    stepsSide: 'none',
  });

  // A surviving service lamp gives the lower hall a small pool of visibility.
  c.light(2.4, -.35, -2.2, '#94aa8f', .32, { k: 2.4, far: 6 });
  depthTile(c, 0, 0.045, bz1 + 0.09, 'DROP 1.5M', 0, 17);

  // Chrome parapet guardrails around the y = 0 upper gallery edge (leaving openings only for tube mouths & slide!)
  const addRailZ = (x0, x1, z) => {
    if (x1 - x0 <= 0.15) return;
    c.flat.box(x0, 0.04, z - 0.035, x1, 0.92, z + 0.035, CHROME, { skip: '-y' });
    // Only top/bottom bars visually: carve middle? Even cleaner: two horizontal rails + posts!
  };
  const railSpanX = (x0, x1, z) => {
    if (x1 - x0 <= 0.2) return;
    c.flat.box(x0, 0.86, z - 0.035, x1, 0.92, z + 0.035, CHROME);
    c.flat.box(x0, 0.44, z - 0.025, x1, 0.48, z + 0.025, CHROME);
    for (const px of [x0 + 0.06, (x0 + x1) * 0.5, x1 - 0.06]) {
      c.flat.box(px - 0.035, 0.04, z - 0.035, px + 0.035, 0.92, z + 0.035, CHROME, { skip: '-y' });
    }
    c.solid(x0, z - 0.09, x1, z + 0.09);
  };
  const railSpanZ = (x, z0, z1) => {
    if (z1 - z0 <= 0.2) return;
    c.flat.box(x - 0.035, 0.86, z0, x + 0.035, 0.92, z1, CHROME);
    c.flat.box(x - 0.025, 0.44, z0, x + 0.025, 0.48, z1, CHROME);
    for (const pz of [z0 + 0.06, (z0 + z1) * 0.5, z1 - 0.06]) {
      c.flat.box(x - 0.035, 0.04, pz - 0.035, x + 0.035, 0.92, pz + 0.035, CHROME, { skip: '-y' });
    }
    c.solid(x - 0.09, z0, x + 0.09, z1);
  };
  void addRailZ;

  railSpanX(bx0, -3.72, bz1 + 0.08);
  railSpanX(-2.28, 3.85, bz1 + 0.08);
  railSpanX(5.45, bx1, bz1 + 0.08);
  railSpanX(bx0, 2.28, bz0 - 0.08);
  railSpanX(3.72, bx1, bz0 - 0.08);
  railSpanZ(bx0 - 0.08, bz0, bz1);
  railSpanZ(bx1 + 0.08, bz0, bz1);

  // ---------------------------------------------------------------------------
  // 2. Stored Sun-Lounger Barricades on Left & Right Galleries
  //    Chosen clear of any `left`/`right` doorways so doors always connect, while
  //    forcing Front <-> Back traversal THROUGH the Colored Crawl-Tube Maze!
  // ---------------------------------------------------------------------------
  const pickDividerZ = (side) => {
    const doorZs = c.room.doors.filter((d) => d.side === side).map((d) => d.c);
    for (const cand of [-1.4, 0.35, -3.1, 1.35]) {
      if (cand > bz0 + 0.8 && cand < bz1 - 0.6 && doorZs.every((dz) => Math.abs(dz - cand) > 1.35)) {
        return cand;
      }
    }
    return -0.95;
  };

  const barricadeEntries = [];
  for (const [side, xMid, sign] of [['left', (-hx + bx0) * 0.5, -1], ['right', (hx + bx1) * 0.5, 1]]) {
    const dz = pickDividerZ(side);
    const stripeCols = ['#667d71', '#a7a186', '#698279', '#aaa18b', '#667d71'];
    for (let i = 0; i < 5; i++) {
      const col = stripeCols[i % stripeCols.length];
      barricadeEntries.push({
        key: 'wp:lounger:' + col,
        make: loungerVox(col),
        x: xMid + (i % 2 ? 0.08 : -0.08) * sign,
        y: i * 0.38 + (i % 2 ? 0.16 : 0),
        z: dz + ((i * 3) % 5 - 2) * 0.06,
        rot: Math.PI * 0.5 * sign + (i * 0.32 - 0.5),
        tilt: [i % 2 ? Math.PI : 0.18, (i - 2) * 0.16],
      });
    }
    // `keep: true` ensures the side gallery stays blocked so walkable floods cleanly through the Crawl-Tube Maze!
    c.solid(
      side === 'left' ? -hx : bx1 - 0.1,
      dz - 0.48,
      side === 'left' ? bx0 + 0.1 : hx,
      dz + 0.48,
      { tall: true, keep: true }
    );
  }
  placeVoxStack(c, 'wp:lounger:barricades', barricadeEntries);

  // ---------------------------------------------------------------------------
  // 3. Suspended Fiberglass Crawl-Tube Maze + Boarding Stairs
  // ---------------------------------------------------------------------------
  const flumeBatch = new Batch();
  const crawl = buildCrawlMaze(c, bz0, flumeBatch);

  c.light(0, CRAWL_AXIS_Y + .15, 1.25, '#c8bd90', .26, { k: 1.3, far: 3.6 });

  // 4 walkable boarding steps up into North Yellow Tube Mouth (`x = -3.0, z: +3.33 -> +2.05`, 0.17 m/step <= 0.23 m)
  const nStairs = 4, stairRun = 0.32;
  const nMouthZ = bz1;
  for (let i = 0; i < nStairs; i++) {
    const yTop = ((nStairs - i) / (nStairs + 1)) * CRAWL_FLOOR_Y;
    c.flat.box(-3.62, 0, nMouthZ + i * stairRun, -2.38, yTop, nMouthZ + (i + 1) * stairRun, COPING, { skip: '-y' });
  }

  // 4 walkable exit steps down from South Tangerine Tube Mouth (`x = +3.0, z: bz0 -> bz0 - 1.28`)
  const sMouthZ = bz0;
  for (let i = 0; i < nStairs; i++) {
    const yTop = ((nStairs - i) / (nStairs + 1)) * CRAWL_FLOOR_Y;
    c.flat.box(2.38, 0, sMouthZ - (i + 1) * stairRun, 3.62, yTop, sMouthZ - i * stairRun, COPING, { skip: '-y' });
  }

  // 4 walkable steps up to Front-Right Plunge Slide Platform (`x = +4.65, z = +2.55, y = 0.84 m`)
  const pX = 4.65, pZ0 = bz1, pZ1 = bz1 + 0.95;
  c.flat.box(pX - 0.78, 0, pZ0, pX + 0.78, CRAWL_FLOOR_Y, pZ1, COPING, { skip: '-y' });
  for (let i = 0; i < nStairs; i++) {
    const yTop = ((nStairs - i) / (nStairs + 1)) * CRAWL_FLOOR_Y;
    c.flat.box(pX - 0.68, 0, pZ1 + i * stairRun, pX + 0.68, yTop, pZ1 + (i + 1) * stairRun, COPING, { skip: '-y' });
  }
  // Dispatch arch over the One-Way Plunge Slide
  c.flat.box(pX - 0.74, CRAWL_FLOOR_Y, pZ0, pX - 0.62, CRAWL_FLOOR_Y + 1.85, pZ0 + 0.12, CHROME);
  c.flat.box(pX + 0.62, CRAWL_FLOOR_Y, pZ0, pX + 0.74, CRAWL_FLOOR_Y + 1.85, pZ0 + 0.12, CHROME);
  c.flat.box(pX - 0.78, CRAWL_FLOOR_Y + 1.72, pZ0 - 0.04, pX + 0.78, CRAWL_FLOOR_Y + 1.94, pZ0 + 0.16, GROUT_DARK);

  // Wire two-layer `floorY` and `headY`:
  //   - Upper layer (`me.y - room.y >= 0.25`, or build-time flood check when `player` is null):
  //     stairs + elevated Crawl-Tube Maze (`y = 0.84 m`, crouch headroom `0.96 m`).
  //   - Sunken Lower Hall (`me.y - room.y < 0.25`, i.e. standing/wading at `floor = -1.45 m`, `eye ~ -0.35 m`):
  //     player wades freely underneath the suspended tubes across the entire `-1.45 m` basin!
  // Layer is explicit ride state. Floor queries must never change it: the
  // nav grid and nearby furniture query many places the player is not at.

  const prevFloorY = c.rt.floorY;
  c.rt.floorY = (x, z) => {
    if (!lowerLatched) {
      if (crawl.inCrawl(x, z)) return CRAWL_FLOOR_Y;
      if (Math.abs(x - (-3.0)) <= 0.60 && z > nMouthZ && z <= nMouthZ + nStairs * stairRun) {
        const idx = Math.floor((z - nMouthZ) / stairRun);
        return ((nStairs - idx) / (nStairs + 1)) * CRAWL_FLOOR_Y;
      }
      if (Math.abs(x - 3.0) <= 0.60 && z < sMouthZ && z >= sMouthZ - nStairs * stairRun) {
        const idx = Math.floor((sMouthZ - z) / stairRun);
        return ((nStairs - idx) / (nStairs + 1)) * CRAWL_FLOOR_Y;
      }
      if (Math.abs(x - pX) <= 0.76 && z >= pZ0 && z <= pZ1) return CRAWL_FLOOR_Y;
      if (Math.abs(x - pX) <= 0.66 && z > pZ1 && z <= pZ1 + nStairs * stairRun) {
        const idx = Math.floor((z - pZ1) / stairRun);
        return ((nStairs - idx) / (nStairs + 1)) * CRAWL_FLOOR_Y;
      }
    }
    return prevFloorY ? prevFloorY(x, z) : 0;
  };

  const prevHeadY = c.rt.headY;
  c.rt.headY = (x, z) => {
    if (lowerLatched) {
      return crawl.inCrawl(x, z) ? (CRAWL_FLOOR_Y - LOWER_Y - 0.06) : (prevHeadY ? prevHeadY(x, z) : H);
    }
    // Inside the cylindrical tubes, headroom is 0.96 m (>= 0.85 HEAD, < 1.10 EYE -> automatic crouch-crawl!)
    if (crawl.inCrawl(x, z) && z <= nMouthZ + 0.05 && z >= sMouthZ - 0.05) return 0.96;
    return prevHeadY ? prevHeadY(x, z) : H;
  };

  // ---------------------------------------------------------------------------
  // 4. Zero-Clip Overhead Ceiling-Punch Tubes, One-Way Plunge Slide & Abyssal Drain
  // ---------------------------------------------------------------------------
  const splines = slideMazeSplines(W, D, H);

  // Knocked-out ceiling tiles where high tubes & upward waterfall punch into the plenum!
  const holeCoralA = c.hole(-2.15, 1.05, 2);
  c.hole(3.05, -2.65, 2);
  c.hole(-2.85, 2.55, 2);
  scatter(c, -2.15, 3.85, 5, 1.05);
  void holeCoralA;

  buildFlume(c, 'wp:plunge', splines.plunge.pts, {
    radius: splines.plunge.radius,
    color: paint.blue,
    enclosed: false,
    batch: flumeBatch,
    struts: [0.32, 0.72],
    strutFloorY: LOWER_Y,
    solidStruts: false,
  });
  buildFlume(c, 'wp:bailout', splines.bailout.pts, {
    radius: splines.bailout.radius,
    color: paint.cream,
    enclosed: false,
    batch: flumeBatch,
    struts: [0.6],
    strutFloorY: LOWER_Y,
    solidStruts: false,
  });
  buildFlume(c, 'wp:coral:high', splines.coralOverhead.pts, {
    radius: splines.coralOverhead.radius,
    color: paint.red,
    enclosed: true,
    batch: flumeBatch,
    hangFromCeiling: true,
    ceilingH: H,
    struts: [0.35, 0.68],
  });
  buildFlume(c, 'wp:amber:high', splines.amberOverhead.pts, {
    radius: splines.amberOverhead.radius,
    color: paint.yellow,
    enclosed: true,
    batch: flumeBatch,
    hangFromCeiling: true,
    ceilingH: H,
    struts: [0.35, 0.68],
  });
  buildFlume(c, 'wp:abyss:drain', splines.abyssDrain.pts, {
    radius: splines.abyssDrain.radius,
    color: paint.green,
    enclosed: false,
    batch: flumeBatch,
    struts: [],
  });

  // Opaque fiberglass: the maze hides its inhabitants and has readable depth.
  c.dynamic(flumeBatch, { map: tex.fiberglass });
  flumeHall(c, tex, { bx0, bx1, bz0, bz1 });

  // Glowing abyssal floor drain rim down in the Sunken Flooded Hall (`(0.15, -2.65)`)
  c.flat.box(-0.72, LOWER_Y, -3.42, 0.98, LOWER_Y + 0.14, -1.88, GROUT_DARK, { skip: '-y' });
  const abyssGlow = c.shining('wp:abyss:glow', c.kit.tex.blob(), .55, lin('#82957a'), { transparent: true, depthWrite: false });
  abyssGlow.quad([-0.55, LOWER_Y + 0.15, -3.25], [0.80, LOWER_Y + 0.15, -3.25], [0.80, LOWER_Y + 0.15, -2.05], [-0.55, LOWER_Y + 0.15, -2.05]);
  c.light(0.15, LOWER_Y + 0.55, -2.65, '#8d9f79', .19, { k: 1.8, far: 3.5 });

  // ---------------------------------------------------------------------------
  // 5. IMPOSSIBLE PHYSICS: The Reverse Upward Log-Drop Waterfall!
  //    Water & a hollowed yellow Amusement-Park Log-Flume Boat rocket UPWARD
  //    from the sunken pool (`y = -1.35`) straight through a ceiling hole (`y = H`)!
  // ---------------------------------------------------------------------------
  const wfX = bx0 + 1.05;
  const wfZ0 = -4.25, wfY0 = LOWER_Y + 0.08;
  const wfZ1 = -0.15, wfY1 = H + 0.28;
  const wfW = 1.38;
  c.hole(wfX, wfZ1, 2);
  c.light(wfX + 0.65, 2.15, (wfZ0 + wfZ1) * 0.5, '#bcc9a0', .65, { k: 3.4, far: 8 });

  // Inclined turquoise trough bed + white bullnose side curbs
  const wfAngle = Math.atan2(wfY1 - wfY0, wfZ1 - wfZ0);
  const wfLen = Math.hypot(wfY1 - wfY0, wfZ1 - wfZ0);
  const troughTile = c.mapped('wp:wf:tile', tex.bed);
  troughTile.quad(
    [wfX - wfW / 2, wfY0, wfZ0],
    [wfX + wfW / 2, wfY0, wfZ0],
    [wfX + wfW / 2, wfY1, wfZ1],
    [wfX - wfW / 2, wfY1, wfZ1],
    WHITE
  );
  for (const sx of [-1, 1]) {
    const rx = wfX + sx * (wfW / 2 + 0.07);
    c.flat.quad(
      [rx - 0.07, wfY0, wfZ0], [rx + 0.07, wfY0, wfZ0],
      [rx + 0.07, wfY1, wfZ1], [rx - 0.07, wfY1, wfZ1],
      COPING
    );
    c.flat.quad(
      [rx - 0.07, wfY0 + 0.24, wfZ0], [rx + 0.07, wfY0 + 0.24, wfZ0],
      [rx + 0.07, wfY1 + 0.24, wfZ1], [rx - 0.07, wfY1 + 0.24, wfZ1],
      COPING
    );
  }
  // Support stanchion under mid-ramp
  c.flat.box(wfX - 0.12, LOWER_Y, (wfZ0 + wfZ1) * 0.5 - 0.12, wfX + 0.12, (wfY0 + wfY1) * 0.5 - 0.25, (wfZ0 + wfZ1) * 0.5 + 0.12, CHROME, { skip: '-y' });

  // Lit water on the ramp; it does not illuminate the whole room.
  const wfWater = c.mapped('wp:wf:water', tex.water, { side: THREE.DoubleSide });
  wfWater.grid(
    [wfX - wfW * 0.46, wfY0 + 0.07, wfZ0],
    [0, (wfY1 - wfY0) / wfLen, (wfZ1 - wfZ0) / wfLen],
    [1, 0, 0],
    ticks(wfLen, 0.85, 0),
    ticks(wfW * 0.92, 0.65, 0),
    (u, v) => [v / 1.2, u / 1.4],
    WHITE
  );

  // Dynamic upward-surging whitewater foam chevrons + sculpted Yellow Log-Flume Boat shooting UP into the ceiling!
  const wfMidY = (wfY0 + wfY1) * 0.5;
  const wfMidZ = (wfZ0 + wfZ1) * 0.5;
  const foamBatch = new Batch();
  for (let k = 0; k < 5; k++) {
    const u = 0.14 + k * 0.16;
    const fy = wfY0 + (wfY1 - wfY0) * u + 0.10;
    const fz = wfZ0 + (wfZ1 - wfZ0) * u;
    foamBatch.box(wfX - wfW * 0.40, fy - 0.04, fz - 0.09, wfX + wfW * 0.40, fy + 0.05, fz + 0.09, [0.92, 1.0, 1.0]);
    foamBatch.box(wfX - wfW * 0.24, fy + 0.03, fz + 0.04, wfX + wfW * 0.24, fy + 0.11, fz + 0.18, WHITE);
  }
  const foamDyn = c.dynamic(foamBatch, { pivot: [wfX, wfMidY, wfMidZ] });

  const upBoat = makeVoxGroup(c.kit, 'wp:logboat', logBoatVox(), 0.03);
  c.add(upBoat);
  let wfPhase = 0.38; // starts prominently ascending mid-waterfall!
  const syncWaterfall = (ph) => {
    const u = ph % 1;
    const bz = wfZ0 + (wfZ1 - wfZ0) * u;
    const by = wfY0 + (wfY1 - wfY0) * u + 0.14;
    upBoat.position.set(wfX, by, bz);
    upBoat.rotation.set(-wfAngle, 0, Math.sin(u * Math.PI * 6) * 0.05, 'YXZ');
    const fU = ((ph * 2.2) % 1) - 0.5;
    foamDyn.position.set(
      wfX,
      wfMidY + (wfY1 - wfY0) * fU * 0.22,
      wfMidZ + (wfZ1 - wfZ0) * fU * 0.22
    );
  };
  syncWaterfall(wfPhase);
  c.after.push(() => upBoat.userData.light(c.sample(wfX + 0.5, 1.8, (wfZ0 + wfZ1) * 0.5)));

  // A few abandoned rings drift against a column; the flume, not a prop tower,
  // owns the silhouette of this hall.
  placeVoxStack(c, 'flume:stored-rings', [0, 1, 2].map(i => ({
    key: 'flume:ring:' + i, make: innerTubeVox(i === 1 ? paint.yellow : paint.blue),
    x: -1.5 + i * .08, y: LOWER_Y + .08 + i * .22, z: -.05,
    rot: i * .7, tilt: [.08 * i, -.06 * i],
  })), { sampleX: -1.5, sampleY: .2, sampleZ: -.05 });

  // A spare pack rewards reaching the island in the flooded lower hall.
  c.flat.box(1.55, LOWER_Y, -0.55, 2.45, WATER_Y + 0.12, 0.35, COPING, { skip: '-y' });
  c.leave('battery', 2.0, -0.1, { y: WATER_Y + 0.12 });
  const signSpot = c.wallSpot(1.8, 'front', .4, 2.5);
  if (signSpot) poolSign(c, 'front', signSpot.at, 1.8, [
    'FLUME HALL',
    'ONE BATHER AT A TIME',
    'WAIT UNTIL WATER CLEARS',
    'DO NOT RETURN FOR LOST PROPERTY',
  ], { seed: 41, mess: .28 });

  // ---------------------------------------------------------------------------
  // 7. Two Prowling Tube Waste Toners Inside the Colored Crawl-Tube Maze!
  //    Cling upside-down (`slabK = 1`) to the curved fiberglass roof, click sonar,
  //    drop & skitter down the colored tubes if you scramble fast, and recoil on
  //    Safety Scissors snip!
  // ---------------------------------------------------------------------------
  const tonerSpawns = [
    { key: 'cyan-magenta', lx: 1.5, lz: 1.25, patrolA: [-1.2, 1.25], patrolB: [3.0, 1.25], patrolC: [3.0, -1.1] },
    { key: 'coral-emerald', lx: 0.0, lz: -2.2, patrolA: [-2.2, -1.35], patrolB: [0.0, -1.35], patrolC: [0.0, -3.7] },
  ];

  let knownToner = false;
  for (let i = 0; i < tonerSpawns.length; i++) {
    const sp = tonerSpawns[i];
    const startW = c.toWorld(sp.lx, sp.lz);
    const rig = makePlenumTonerRig(c.kit, 'tube-' + sp.key);
    let tState = makeTubeToner(i);
    const waypoints = [sp.patrolA, sp.patrolB, sp.patrolC, sp.patrolB];
    let wpIdx = 1;

    const denizen = c.env.denizens?.add({
      id: 'flume-toner',
      x: startW.x,
      z: startW.z,
      y: c.room.y + CRAWL_AXIS_Y + 0.52,
      r: 0.20,
      tall: 0.68,
      heading: 0,
      group: rig.group,
      light: () => {
        rig.light(c.world.lightAt(denizen.x, denizen.z, CRAWL_AXIS_Y));
      },
      snipTarget: () => (
        tState.phase === 'dropping' || tState.phase === 'chasing'
          ? { id: 'flume-toner', y: (denizen.y ?? c.room.y + CRAWL_FLOOR_Y) + 0.24, r: 0.40, priority: 3 }
          : false
      ),
      snip() {
        if (tState.phase !== 'dropping' && tState.phase !== 'chasing') return false;
        tState = snipTubeToner(tState);
        c.env.play?.('clack', denizen.x, denizen.z, 9);
        c.env.play?.('sonarrattle', denizen.x, denizen.z, 10);
        c.env.interfere?.(0.45);
        c.survived('flume-toner');
        return { ok: true, target: 'flume-toner' };
      },
      update(dt, time, me) {
        const inRoom = c.world.current() === c.rt;
        const meLoc = c.toLocal(me.x, me.z);
        const playerRelY = me.y - c.room.y;
        const inTubes = inRoom && crawl.inCrawl(meLoc.x, meLoc.z) && playerRelY >= CRAWL_FLOOR_Y - 0.15;
        // Crawling slowly (< 0.92 m/s) or holding still lets you slip past its sonar!
        const audible = inTubes && me.moving && me.speed > 0.92;
        const dist = Math.hypot(me.x - denizen.x, me.z - denizen.z);

        if (!knownToner && inRoom && dist < 7.0 && c.env.sees?.(denizen.x, denizen.z, { radius: 0.45 })) {
          knownToner = true;
          c.met('flume-toner');
        }

        const res = stepTubeToner(tState, { dt, dist, inTubes, audible });
        tState = res.state;

        if (res.sonar && inRoom) c.env.play?.('sonar', denizen.x, denizen.z, 10);
        if (res.rattle && inRoom) c.env.play?.('sonarrattle', denizen.x, denizen.z, 12);
        if (res.droppedNow && inRoom) {
          c.env.play?.('thunk', denizen.x, denizen.z, 10);
          c.env.interfere?.(0.32);
        }

        const roofY = c.room.y + CRAWL_AXIS_Y + 0.52;
        const floorWorldY = c.room.y + CRAWL_FLOOR_Y;
        denizen.y = floorWorldY + (roofY - floorWorldY) * res.slabK;

        let went = 0;
        if (tState.phase === 'chasing' && res.speed > 0) {
          const prevX = denizen.x, prevZ = denizen.z;
          went = stepWalker(c.world, denizen, me.x, me.z, res.speed * dt);
          const afterLoc = c.toLocal(denizen.x, denizen.z);
          if (!crawl.inCrawl(afterLoc.x, afterLoc.z)) {
            denizen.x = prevX;
            denizen.z = prevZ;
            went = 0;
          }
          const wantYaw = Math.atan2(me.x - denizen.x, me.z - denizen.z);
          rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 10, dt * 10);
          if (dist < 2.4 && inTubes) c.env.interfere?.(clamp((2.4 - dist) * 0.22, 0, 0.55));
        } else if (tState.phase === 'perched') {
          const goalLoc = waypoints[wpIdx];
          const goalW = c.toWorld(goalLoc[0], goalLoc[1]);
          if (Math.hypot(goalW.x - denizen.x, goalW.z - denizen.z) < 0.18) {
            wpIdx = (wpIdx + 1) % waypoints.length;
          }
          const step = 0.34 * dt;
          const dx = goalW.x - denizen.x, dz = goalW.z - denizen.z, d = Math.hypot(dx, dz) || 1;
          denizen.x += (dx / d) * Math.min(d, step);
          denizen.z += (dz / d) * Math.min(d, step);
          went = Math.min(d, step);
          const wantYaw = Math.atan2(dx, dz);
          rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 4, dt * 4);
        }

        rig.pose(time, tState.phase, res.slabK, went / Math.max(dt, 1e-3), 0);

        if (res.caught && c.world.los(denizen.x, denizen.z, me.x, me.z) && furnitureClear(c.world, denizen.x, denizen.z, me.x, me.z, .12)) {
          c.env.play?.('sonarrattle', denizen.x, denizen.z, 9);
          c.env.play?.('dissolve', denizen.x, denizen.z, 8);
          c.env.interfere?.(0.95);
          if (!knownToner) { knownToner = true; c.met('flume-toner'); }
          const hit = c.hurt(TUBE_TONER.hurt);
          if (!hit.ended) {
            tState = releaseTubeToner(tState);
            if (hit.landed) {
              c.env.hud?.glitch?.(0.65);
              c.survived('flume-toner');
            }
          }
        }
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 8. One-Way Water Slides:
  //    - `plunge` & `bailout`: ride down into the Sunken Flooded Lower Hall (`y = -1.45 m`)
  //      out of an overhanging lip so you CANNOT climb back up!
  //    - `abyssDrain`: ride down through the glowing floor drain into the NEXT FLOOR
  //      of the Backrooms (`goesDown` + `env.descend`), plus a recessed sump escape
  //      valve on the far back wall if there is no floor below!
  // ---------------------------------------------------------------------------
  const rideSegs = {
    plunge: { pts: splines.plunge.pts, length: flumeLength(splines.plunge.pts) },
    bailout: { pts: splines.bailout.pts, length: flumeLength(splines.bailout.pts) },
    abyss: { pts: splines.abyssDrain.pts, length: flumeLength(splines.abyssDrain.pts) },
  };

  let ride = null;
  let rideMode = null;
  c.rt.sliding = () => !!ride;
  c.rt.flumeMaze = { get lower() { return lowerLatched; }, get ride() { return ride; }, crawl, bounds: {bx0,bx1,bz0,bz1} };

  const inLowerHall = () => {
    const me = c.env.player?.me;
    if (!me) return true;
    const fY = c.world.floorY(me.x, me.z) - c.room.y;
    return fY < -0.5;
  };

  const startSlide = (segId, mode) => {
    const p0 = evalFlume(rideSegs[segId].pts, 0);
    const w = c.toWorld(p0.x, p0.z);
    c.env.play?.('wade', w.x, w.z, 8);
    c.env.play?.('slide', w.x, w.z, 8);
    c.env.hold?.(true);
    ride = { segId, u: 0.01, speed: 5.4, lean: 0 };
    rideMode = mode;
  };

  // Launch 1: Front-Right One-Way Plunge Slide into Sunken Lower Hall
  c.use({
    x: pX,
    z: pZ0 + 0.35,
    r: 1.65,
    label: 'ride the plunge slide (one-way)',
    when: () => !ride && !lowerLatched,
    use: () => startSlide('plunge', 'toLower'),
  });

  // Launch 2: Mid-Maze Bailout Chute at the end of the Aqua Teal tube spur (`(-3.0, -3.0)`)
  c.use({
    x: -3.0,
    z: -2.95,
    r: 1.35,
    label: 'bail out down drop chute (one-way)',
    when: () => !ride && !lowerLatched,
    use: () => startSlide('bailout', 'toLowerBail'),
  });

  // Launch 3: Abyssal Corkscrew Floor-Descent Slide down in the Sunken Lower Hall!
  c.use({
    x: 0.35,
    z: -2.45,
    r: 1.75,
    label: 'slide down into lower level',
    when: () => !ride && inLowerHall(),
    use: () => startSlide('abyss', 'toNextFloor'),
  });

  // Sump escape valve hatch tucked against the far `-z` cobalt cliff wall so final-floor players never soft-lock
  const hatchX = -0.85, hatchZ = bz0 + 0.08;
  c.flat.box(hatchX - 0.38, LOWER_Y + 0.35, bz0 - 0.04, hatchX + 0.38, LOWER_Y + 1.15, bz0 + 0.08, CHROME);
  c.flat.box(hatchX - 0.28, LOWER_Y + 0.45, bz0 + 0.06, hatchX + 0.28, LOWER_Y + 1.05, bz0 + 0.11, GROUT_DARK);
  c.use({
    x: hatchX,
    z: bz0 + 0.55,
    r: 1.55,
    label: 'squeeze through sump discharge',
    when: () => !ride && inLowerHall(),
    use: () => {
      const w = roomReturn(c, hatchX, bz0 - 0.75);
      if (!w) return;
      lowerLatched = false;
      c.env.play?.('glug', w.x, w.z, 8);
      c.env.interfere?.(0.42);
      c.env.player?.warp(w.x, w.z);
    },
  });

  // ---------------------------------------------------------------------------
  // 9. Per-Frame Tick: Upward Log-Drop Waterfall + Active Water Slide Ride
  // ---------------------------------------------------------------------------
  c.tick((dt, t, me) => {
    // Animate the impossible UPWARD waterfall & ascending yellow log-flume boat!
    wfPhase = (wfPhase + dt * 0.34) % 1;
    syncWaterfall(wfPhase);

    if (!ride) return;
    const step = stepSlideRide(ride, dt, rideSegs, 0);
    const pose = step.pose || evalFlume(rideSegs[ride.segId].pts, 1);

    if (pose && c.env.player) {
      const w = c.toWorld(pose.x, pose.z);
      const roomYaw = (c.room.rot * Math.PI) / 2;
      c.env.player.setRidePose({ x: w.x, z: w.z, y: c.room.y + pose.y,
        yaw: pose.yaw + roomYaw, pitch: pose.pitch, bank: pose.bank * .42 });
      c.env.interfere?.(0.18);
    }

    if (step.done) {
      const finishedMode = rideMode;
      ride = null;
      rideMode = null;
      c.env.player?.setRidePose(null);

      if (finishedMode === 'toNextFloor') {
        const wDrain = c.toWorld(0.15, -2.65);
        c.env.play?.('glug', wDrain.x, wDrain.z, 9);
        c.env.interfere?.(0.88);
        const descended = goesDown(c.level.exit.way) && c.env.descend ? c.env.descend({ x: wDrain.x, z: wDrain.z }) : false;
        c.env.hold?.(false);
        if (!descended) {
          // On a bottom floor with nowhere deeper to descend, spit the rider out of the sump discharge onto the back terrace!
          lowerLatched = false;
          const wOut = roomReturn(c, hatchX, bz0 - 0.75) || c.toWorld(0, c.D / 2 - 1);
          c.env.player?.warp(wOut.x, wOut.z);
          if (me.world) { me.world.drop = 0; me.world.dropV = 0; }
        }
      } else {
        c.env.hold?.(false);
        lowerLatched = true;
        const landX = finishedMode === 'toLowerBail' ? -1.65 : 1.85;
        const landZ = finishedMode === 'toLowerBail' ? -2.75 : -2.45;
        const wEnd = c.toWorld(landX, landZ);
        c.env.player?.warp(wEnd.x, wEnd.z);
        if (me.world) { me.world.drop = 0.25; me.world.dropV = -1.6; }
        c.env.play?.('wade', wEnd.x, wEnd.z, 9);
        c.env.interfere?.(0.38);
      }
    } else {
      ride = step.ride;
    }
  });

  const prevLeave = c.rt.onLeave;
  c.rt.onLeave = () => {
    prevLeave?.();
    lowerLatched = false;
    if (ride) {
      ride = null;
      rideMode = null;
      c.env.hold?.(false);
      c.env.player?.setRidePose(null);
    }
  };
}
