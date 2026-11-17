// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Ceiling Coppice (`inverted-grove` — "the fifty interlocking floor and upside-down ceiling trees over the mirror pool").
//
// Two dense woods sharing the same office floor in opposite directions:
//   - 35+ slender hemlock and paper-birch trunks grow UPWARD out of the damp
//     mossy carpet;
//   - 20 full trees grow UPSIDE-DOWN out of torn sod-and-carpet ceiling breaches,
//     their root buttresses gripping the fluorescent T-bar grid and their dense
//     leafy crowns hanging down to shoulder height (`y ~ 1.25 m`) between the
//     standing trunks!
//
// At `(0, 0)`, a glassy dark Mirror Pool (`buildForestWater`) reflects the
// upside-down ceiling forest right-side-up beneath an Upside-Down Executive
// Workstation bolted directly to the ceiling tiles, with a dangling orange ID
// lanyard cord (`[E]` or `call` shakes the ceiling drawer loose, sending ripples
// across the pool beside `tape` + `battery` supplies!).

import {
  forestRoom, woodlandLight, trailSign, registerCallTarget,
  placeVoxStack, buildForestWater, peatWaterTex, plenumBreach,
  ensureForestDetail, campLanternVox, stumpVox,
  CEDAR_TIMBER, BLAZE_ORANGE, BRASS_TRIM,
} from '../forest.js';
import { thicket, keepLane } from '../forest-thicket.js';
import { buildBlindRingMaze, addMistVeils } from '../forest-maze.js';
import {
  denseBirchStemVox, denseHemlockVox, sweepingConiferVox, overgrownDeskVox,
} from '../forest-models.js';

export function build(c) {
  const { W, D, H, R, kit, params: p } = c;
  c.shell({ panels: false });
  woodlandLight(c, 3, 3, 1, 0.94, {
    mode: 'canopy',
    deadRatio: 0.40,
    shaftTint: [0.68, 0.96, 0.84],
  });
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false, thicket: false });

  // Enclose the Mirror Pool inside a staggered 2.48 m Hedgerow & Overgrown-Cubicle Labyrinth (`tall: true`)!
  buildBlindRingMaze(c, {
    style: 'drywall',
    outerStyle: 'hedge',
    rInner: 2.55,
    h: 2.52,
    keepClear: [{ x: 0, z: 0, r: 2.25 }, { x: 1.95, z: 1.55, r: 0.85 }],
  });
  addMistVeils(c, [
    { x0: -2.8, z0: 2.2, x1: -1.2, z1: 2.2 },
    { x0: 1.2, z0: -2.2, x1: 2.8, z1: -2.2 },
  ], { color: [0.06, 0.16, 0.13], alpha: 0.64 });

  // Reserve a ring walkway around the central Mirror Pool `[-1.85..1.85, -1.85..1.85]` + doorway & NE stash spurs!
  const rx = 2.45, rz = 2.45;
  keepLane(c, -rx, -rz, rx, -rz, 1.42);
  keepLane(c, rx, -rz, rx, rz, 1.42);
  keepLane(c, rx, rz, -rx, rz, 1.42);
  keepLane(c, -rx, rz, -rx, -rz, 1.42);
  keepLane(c, rx, -rz, W / 2 - 1.05, -D / 2 + 1.05, 1.40); // NE stash lane
  for (const dr of c.room.doors) {
    const dp = c.doorPoint(dr, 0.55);
    const tx = Math.max(-rx, Math.min(rx, dp.x));
    const tz = Math.max(-rz, Math.min(rz, dp.z));
    keepLane(
      c,
      dp.x,
      dp.z,
      Math.abs(dp.x) > Math.abs(dp.z) ? Math.sign(dp.x) * rx : tx,
      Math.abs(dp.z) >= Math.abs(dp.x) ? Math.sign(dp.z) * rz : tz,
      1.44
    );
  }
  c.reserve(0, 0, 2.15);

  // Central Dark Glassy Mirror Pool (`[-1.85..1.85, -1.85..1.85]`) reflecting the upside-down ceiling grove!
  const water = buildForestWater(
    c,
    [{ x0: -1.85, z0: -1.85, x1: 1.85, z1: 1.85, depth: 0.15, waterY: 0.016 }],
    {
      map: peatWaterTex(kit, 'deep'),
      shallowHex: '#18382d',
      deepHex: '#050f0c',
      foamHex: '#6bd9b2',
    }
  );

  // Mossy supply stump & lantern on the south-east rim of the Mirror Pool `(1.95, 1.55)`
  c.solid(1.70, 1.30, 2.20, 1.80);
  c.reserve(1.95, 1.55, 0.55);
  c.leave('tape', 1.88, 1.48, { y: 0.48 });
  c.leave('battery', 2.06, 1.62, { y: 0.48 });

  // ---- Upside-Down Executive Workstation Bolted to the Ceiling Over `(0, 0)` + 20 Eye-Level Inverted Ceiling Trees! ----
  const invScale = 0.033;
  // Inverted trees hang down from `y = H + 0.05` right through eye level (`y ~ 0.98..2.4 m`) so hanging boughs block sightlines!
  const invSpanM = Math.max(2.9, H - 1.02);
  const invVox = Math.max(82, Math.round(invSpanM / invScale));

  const ordCeiling = [
    // Upside-down root-split office desk + CRT bolted straight onto the ceiling tiles over the Mirror Pool!
    {
      key: 'forest:inv:desk',
      make: overgrownDeskVox(),
      x: 0,
      y: H + 0.02,
      z: 0,
      rot: 0.4,
      tilt: [Math.PI, 0],
      scale: 0.034,
    },
    { key: 'forest:inv:stump', make: stumpVox(6), x: 1.95, y: 0, z: 1.55, rot: 0.3, scale: 0.031 },
    { key: 'forest:inv:lantern', make: campLanternVox(), x: 1.95, y: 0.46, z: 1.55, scale: 0.026 },
  ];

  // Dangling orange lanyard pull-cord dropping from the upside-down ceiling desk to `(0, 1.95)` at pool's south edge!
  c.flat.box(-0.012, 1.42, 1.88, 0.012, H - 0.35, 1.90, BLAZE_ORANGE);
  c.flat.box(-0.045, 1.30, 1.87, 0.045, 1.43, 1.91, BRASS_TRIM);
  c.flat.box(-0.22, H - 0.42, 0.0, 0.02, H - 0.36, 1.90, CEDAR_TIMBER);
  plenumBreach(c, -0.3, -0.3, 2, 401);

  const det = ensureForestDetail(c);
  const lowCrowns = [];
  let invPlaced = 0;

  for (let tries = 0; invPlaced < 15 && tries < 200; tries++) {
    const ix = R.range(-W / 2 + 0.9, W / 2 - 0.9);
    const iz = R.range(-D / 2 + 0.9, D / 2 - 0.9);
    // Keep directly over the central ceiling desk clear, and space upside-down crowns >= 1.45 m apart
    if (Math.hypot(ix, iz) < 1.35) continue;
    if (lowCrowns.some((q) => Math.hypot(q.x - ix, q.z - iz) < 1.45)) continue;

    const isSweep = (invPlaced % 3) === 0;
    const isHemlock = (invPlaced % 3) === 1;
    const make = isSweep ? sweepingConiferVox(invVox) : isHemlock ? denseHemlockVox(invVox, true) : denseBirchStemVox(invVox);
    const entry = {
      key: `forest:inv:${isSweep ? 'swp' : isHemlock ? 'hem' : 'bir'}:${invVox}`,
      make,
      x: ix,
      y: H + 0.05,
      z: iz,
      rot: R.range(0, Math.PI * 2),
      tilt: [Math.PI, 0],
      scale: invScale,
    };
    if (invPlaced < 6) {
      ordCeiling.push(entry);
    } else if (det.totalTris() < 104000) {
      det.pushVox(entry);
    } else {
      continue;
    }
    if (invPlaced % 2 === 0) plenumBreach(c, ix - 0.15, iz - 0.15, 1, 410 + invPlaced);
    // Circular dark peat stain on floor directly under each dripping upside-down crown!
    c.blot(ix, iz, 0.95, 0.95, { rgb: [0.05, 0.07, 0.05], a: 0.36 });
    lowCrowns.push({ x: ix, z: iz });
    invPlaced++;
  }

  placeVoxStack(c, `forest:invgrove:ceiling:${c.room.id}`, ordCeiling);

  // Ducking headroom (`0.98 m`) right underneath the lowest hanging upside-down crowns!
  c.rt.headY = (x, z) => {
    for (let i = 0; i < lowCrowns.length; i++) {
      if (Math.hypot(x - lowCrowns[i].x, z - lowCrowns[i].z) < 0.52) return 1.02;
    }
    return H;
  };

  // ---- Dense Upward-Growing Floor Stand Interlocking Between the Ceiling Trees! ----
  const grove = thicket(c, {
    tag: 'interlock',
    ordCap: 108000,
    budget: 58000,
    detCap: 100000,
    detBudget: 24000,
    hub: null,
    fiberGlow: true,
    spacing: 0.80,
    trees: 34,
    companionStems: 16,
    under: 24,
    species: { birchStem: 5, hemlock: 4 },
    region: (x, z) => Math.abs(x) > 2.15 || Math.abs(z) > 2.15,
  });
  c.rt.treeCount = grove.trees.length + grove.companions + invPlaced;

  if (c.rt.lights.length < 13) c.light(0, 1.15, 0, '#62ffd2', 0.82, { bank: 3, k: 1.8, far: 6.5 });

  let pulled = false;
  const pullCeilingCord = () => {
    const pw = c.toWorld(0, 0);
    c.env.play?.('creak', pw.x, pw.z, 10);
    c.env.play?.('splash', pw.x, pw.z, 9);
    water?.spawnRipple(0, 0, 1.45);
    water?.spawnRipple(-0.85, 0.65, 1.05);
    if (!pulled) {
      pulled = true;
      c.env.camera?.recharge?.(15);
    }
  };
  c.use({ x: 0, z: 1.88, r: 1.65, label: 'pull ceiling desk lanyard', use: pullCeilingCord });
  registerCallTarget(c, 0, 0, pullCeilingCord, { r: 14 });

  const spSign = c.wallSpot(1.55, ['front', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      `INVERTED COPPICE ${p.groveCode || 'INV-04'}`,
      'THIS SIDE UP',
    ], { seed: 271 + R.int(0, 9), warn: true });
  }
}
