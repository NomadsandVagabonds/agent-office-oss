// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Fen (`bog-boardwalk` — "the duckboard planks over the cypress swamp and drowned workstations").
//
// A wide dark cypress-and-peat swamp spans the middle of the office, crowded
// with knobby-kneed swamp cypresses (`cypressBogTreeVox`) draped in Spanish moss
// and tangled blue Cat-5 cables, cattail reeds (`cattailReedsVox`), drifting
// bioluminescent fireflies, a stranded badger on a stump (`sadBadgerVox`), and
// drowned office workstations (`drownedWorkstationVox`) whose curved green CRT
// screens still glow beneath the tannin water!
//
// Across the fen runs a cedar boardwalk with 4 waterlogged loose duckboard
// sections (`stepDuckboard` — creak early, plunge after 0.85 s), plus two
// Notched Birches (`notchedTimber`) on the banks that can be leaned down into
// permanent dry log bridges!

import { Batch } from '../kit.js';
import {
  forestRoom, woodlandLight, installForestFloor, notchedTimber,
  placeVox, placeVoxStack, trailSign, stumpVox, campLanternVox,
  plenumBreach, ensureForestDetail,
  CEDAR_TIMBER,
} from '../forest.js';
import { thicket, keepLane } from '../forest-thicket.js';
import { occluderWall, addMistVeils } from '../forest-maze.js';
import {
  cypressBogTreeVox, cattailReedsVox, drownedWorkstationVox,
  mushroomRingVox, sadBadgerVox, hangingCanopyDrapeVox,
} from '../forest-models.js';
import { makeDuckboard, stepDuckboard } from '../forest.rule.js';

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function build(c) {
  const { W, D, H } = c;
  c.shell({ panels: false, floor: false });
  woodlandLight(c, 3, 3, 1, 0.96, { mode: 'swamp', shaftTint: [0.62, 0.96, 0.72] });
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false, thicket: false });

  // Sunken peat fen inside `[-W/2 + 2.4, W/2 - 2.4] × [-D/2 + 2.4, D/2 - 2.4]`,
  // keeping a 2.4 m outer rim where dense swamp cypresses & birches crowd the path!
  const bx0 = -W / 2 + 2.4, bx1 = W / 2 - 2.4;
  const bz0 = -D / 2 + 2.4, bz1 = D / 2 - 2.4;
  const bogDepth = 0.44;

  // Central dry peat hummock island (`[-1.05..1.05, -1.05..1.05]`) with sculpted moss mounds
  c.flat.box(-1.05, -bogDepth, -1.05, 1.05, 0.06, 1.05, [0.20, 0.29, 0.15]);
  c.leave('tape', 0.28, -0.22, { y: 0.06 });
  c.leave('battery', -0.28, -0.28, { y: 0.06 });

  // Fixed cedar boardwalk approaches on timber pilings + corner rope bollards!
  const spanZ = bz1 - 1.05;
  const spanX = bx1 - 1.05;
  const fixedSpans = [
    [-0.54, bz0, 0.54, -1.05 - spanZ * 0.48],
    [-0.54, 1.05 + spanZ * 0.48, 0.54, bz1],
    [bx0, -0.54, -1.05 - spanX * 0.48, 0.54],
    [1.05 + spanX * 0.48, -0.54, bx1, 0.54],
  ];
  for (const [x0, z0, x1, z1] of fixedSpans) {
    c.flat.box(x0, 0.01, z0, x1, 0.075, z1, CEDAR_TIMBER);
    // Support pilings extending down to the bottom of the bog + low side curbs
    for (const [px, pz] of [[x0 + 0.08, z0 + 0.12], [x1 - 0.08, z1 - 0.12], [(x0 + x1) * 0.5, (z0 + z1) * 0.5]]) {
      c.flat.box(px - 0.05, -bogDepth, pz - 0.05, px + 0.05, 0.14, pz + 0.05, [0.28, 0.19, 0.11]);
    }
  }
  for (const [px, pz] of [[-0.96, -0.96], [0.96, -0.96], [-0.96, 0.96], [0.96, 0.96]]) {
    c.flat.box(px - 0.05, -bogDepth, pz - 0.05, px + 0.05, 0.42, pz + 0.05, CEDAR_TIMBER);
  }

  // 4 Loose Waterlogged Duckboard Planks bridging the inner gaps to the central hummock!
  const looseBounds = [
    { x0: -0.52, x1: 0.52, z0: -1.05 - spanZ * 0.48, z1: -1.05 },
    { x0: -0.52, x1: 0.52, z0: 1.05, z1: 1.05 + spanZ * 0.48 },
    { x0: -1.05 - spanX * 0.48, x1: -1.05, z0: -0.52, z1: 0.52 },
    { x0: 1.05, x1: 1.05 + spanX * 0.48, z0: -0.52, z1: 0.52 },
  ];
  const looseMeshes = looseBounds.map((lb) => {
    const b = new Batch();
    const mx = (lb.x0 + lb.x1) * 0.5, mz = (lb.z0 + lb.z1) * 0.5;
    // Individual weathered planks with gaps rather than one solid slab
    const alongZ = (lb.z1 - lb.z0) >= (lb.x1 - lb.x0);
    const nPlanks = 5;
    for (let i = 0; i < nPlanks; i++) {
      if (alongZ) {
        const zA = lb.z0 + ((lb.z1 - lb.z0) * i) / nPlanks + 0.02;
        const zB = lb.z0 + ((lb.z1 - lb.z0) * (i + 1)) / nPlanks - 0.02;
        b.box(lb.x0, 0.0, zA, lb.x1, 0.06, zB, i % 2 ? [0.29, 0.20, 0.12] : [0.34, 0.24, 0.15]);
      } else {
        const xA = lb.x0 + ((lb.x1 - lb.x0) * i) / nPlanks + 0.02;
        const xB = lb.x0 + ((lb.x1 - lb.x0) * (i + 1)) / nPlanks - 0.02;
        b.box(xA, 0.0, lb.z0, xB, 0.06, lb.z1, i % 2 ? [0.29, 0.20, 0.12] : [0.34, 0.24, 0.15]);
      }
    }
    return c.dynamic(b, { pivot: [mx, 0.03, mz] });
  });

  let duck = makeDuckboard(looseBounds.length);

  // Two Notched Swamp Trunks on the outer banks that crash down as permanent dry log bridges!
  notchedTimber(c, { x: -0.72, z: bz1 + 0.25, dirX: 0, dirZ: -1, length: (bz1 - 0.55) + 0.45, bridgeY: 0.10 });
  notchedTimber(c, { x: bx1 + 0.25, z: 0.72, dirX: -1, dirZ: 0, length: (bx1 - 0.55) + 0.45, bridgeY: 0.10 });

  // ---- Rich Swamp Interior Stack: Full-AO Drowned CRT Workstations, Swamp Cypresses & Cattails! ----
  const cScale = 0.040;
  const cTall = Math.max(84, Math.round((H + bogDepth + 0.15) / cScale));
  const det = ensureForestDetail(c);

  const swampEntries = [
    // Central island camp lantern + stranded Badger's stump hummock
    { key: 'forest:fen:lantern', make: campLanternVox(), x: -0.42, y: 0.06, z: 0.35, scale: 0.028 },
    { key: 'forest:stump:4', make: stumpVox(4), x: -1.45, y: -0.22, z: 1.45, rot: 0.3, scale: 0.032 },

    // 4 Sculpted Drowned CRT Workstations + Mini-Towers + Swivel Chairs glowing eerily in the 4 quadrants!
    { key: 'forest:drowned:ws', make: drownedWorkstationVox(), x: -2.25, y: -bogDepth + 0.04, z: -2.05, rot: 0.45, scale: 0.034, tilt: [-0.14, 0.08] },
    { key: 'forest:drowned:ws', make: drownedWorkstationVox(), x: 2.35, y: -bogDepth + 0.03, z: 1.95, rot: -2.4, scale: 0.034, tilt: [0.12, -0.10] },
    { key: 'forest:drowned:ws', make: drownedWorkstationVox(), x: -2.15, y: -bogDepth + 0.05, z: 2.15, rot: 0.85, scale: 0.034, tilt: [-0.10, -0.12] },
    { key: 'forest:drowned:ws', make: drownedWorkstationVox(), x: 2.45, y: -bogDepth + 0.04, z: -2.15, rot: -0.65, scale: 0.034, tilt: [0.11, 0.09] },

    // 4 Knobby-Kneed Swamp Cypresses rising straight out of the bog water into 3D plenum breaches!
    ...([[-3.1, -2.9, 0.2], [3.2, -2.8, 1.7], [-3.2, 3.0, 3.1], [3.1, 3.1, 4.5]].filter(([cx, cz]) => Math.abs(cx) < bx1 - 0.5 && Math.abs(cz) < bz1 - 0.5).map(([cx, cz, rot], idx) => {
      plenumBreach(c, cx - 0.15, cz - 0.15, 1, idx + 41);
      c.solid(cx - 0.32, cz - 0.32, cx + 0.32, cz + 0.32, { tall: true });
      det.pushVox({ key: 'forest:detail:ceildrape', make: hangingCanopyDrapeVox(), x: cx, y: H + 0.02, z: cz, rot, scale: 0.030 });
      return {
        key: `forest:fen:cypress:${cTall}`,
        make: cypressBogTreeVox(cTall),
        x: cx,
        y: -bogDepth,
        z: cz,
        rot,
        scale: cScale,
      };
    })),
  ];
  placeVoxStack(c, `forest:fen:interior:${c.room.id}`, swampEntries);

  // Lush `detail: true` swamp reeds, lily-pads & glowing mushroom keyboards across the fen!
  det.pushVox({ key: 'forest:detail:mushrooms', make: mushroomRingVox(), x: 0.52, y: 0.06, z: 0.48, rot: 0.7, scale: 0.026 });
  for (const [rx, rz, rot] of [
    [-1.35, -1.65, 0.4], [1.45, -1.55, 1.9], [-1.65, 0.95, 2.6], [1.55, 1.35, 0.8],
    [-2.85, -0.95, 1.2], [2.85, 0.85, 3.5], [-0.95, 2.75, 2.1], [0.95, -2.75, 4.0],
    [-2.55, -2.65, 0.9], [2.65, -2.55, 2.8], [-2.65, 2.55, 1.5], [2.55, 2.65, 3.7],
  ]) {
    if (Math.abs(rx) < bx1 - 0.3 && Math.abs(rz) < bz1 - 0.3) {
      det.pushVox({ key: 'forest:detail:reeds', make: cattailReedsVox(), x: rx, y: -0.09, z: rz, rot, scale: 0.032 });
    }
  }

  // Animated shivering stranded Badger on the hummock stump!
  const badger = placeVox(c, 'forest:sad:badger', sadBadgerVox(), -1.45, 1.45, { y: 0.22, rot: 0.55, scale: 0.027 });

  // Dynamic Bank-3 green phosphor light from the drowned CRTs + warm camp lantern light on the central island!
  c.light(-2.25, 0.24, -2.05, '#4dff88', 0.78, { bank: 3, k: 1.7, far: 6.2 });
  c.light(2.35, 0.24, 1.95, '#4dff88', 0.78, { bank: 3, k: 1.7, far: 6.2 });
  if (c.rt.lights.length < 14) c.light(-0.42, 0.55, 0.35, '#ffd478', 0.58, { k: 1.5, far: 5.2 });

  // Drifting bioluminescent swamp fireflies hovering lazily above the dark water!
  const flyGroups = [0, 1].map((gIdx) => {
    const fb = new Batch();
    for (let i = 0; i < 14; i++) {
      const fx = (hash(i * 7 + gIdx * 31) - 0.5) * (bx1 - bx0 - 0.8);
      const fz = (hash(i * 13 + gIdx * 19) - 0.5) * (bz1 - bz0 - 0.8);
      const fy = 0.22 + hash(i * 23 + gIdx * 7) * 1.45;
      fb.box(fx - 0.018, fy - 0.018, fz - 0.018, fx + 0.018, fy + 0.018, fz + 0.018, i % 3 === 0 ? [0.55, 1.0, 0.65] : [0.88, 1.0, 0.42]);
    }
    return c.dynamic(fb, { unlit: true });
  });

  installForestFloor(c, {
    cutFloor: true,
    deep: true,
    islands: [[-1.05, -1.05, 1.05, 1.05]],
    bogs: [{ x0: bx0, z0: bz0, x1: bx1, z1: bz1, depth: bogDepth, waterY: -0.065 }],
    bridgeAt: (x, z) => {
      if (Math.abs(x) <= 1.05 && Math.abs(z) <= 1.05) return { on: true, y: 0.06 };
      if (Math.abs(x) <= 0.54 && ((z >= bz0 && z <= -1.05 - spanZ * 0.48) || (z >= 1.05 + spanZ * 0.48 && z <= bz1))) {
        return { on: true, y: 0.075 };
      }
      if (Math.abs(z) <= 0.54 && ((x >= bx0 && x <= -1.05 - spanX * 0.48) || (x >= 1.05 + spanX * 0.48 && x <= bx1))) {
        return { on: true, y: 0.075 };
      }
      for (let i = 0; i < looseBounds.length; i++) {
        const lb = looseBounds[i];
        if (x >= lb.x0 && x <= lb.x1 && z >= lb.z0 && z <= lb.z1) {
          if (duck.loads[i] < 0.85) return { on: true, y: 0.06 - duck.loads[i] * 0.06 };
        }
      }
      return { on: false, y: null };
    },
    onTick: (_walker, dt, t, me) => {
      let activeIdx = -1;
      if (me.inside) {
        activeIdx = looseBounds.findIndex((lb) => me.x >= lb.x0 && me.x <= lb.x1 && me.z >= lb.z0 && me.z <= lb.z1);
      }
      const res = stepDuckboard(duck, dt, activeIdx);
      duck = res.state;
      for (let i = 0; i < looseMeshes.length; i++) {
        const dip = Math.min(1, duck.loads[i] / 0.85);
        looseMeshes[i].position.y = -dip * 0.24;
        looseMeshes[i].rotation.z = Math.sin(duck.loads[i] * 14) * 0.04 * dip;
      }
      // Drift fireflies & subtle badger head-turn
      flyGroups[0].position.set(Math.sin(t * 0.55) * 0.45, Math.sin(t * 1.1) * 0.14, Math.cos(t * 0.42) * 0.45);
      flyGroups[1].position.set(Math.cos(t * 0.48) * -0.45, Math.cos(t * 0.95) * 0.16, Math.sin(t * 0.61) * 0.40);
      if (me.inside) badger.rotation.y = Math.atan2(me.x - (-1.45), me.z - 1.45);

      if (res.creakedIdx >= 0) {
        const lb = looseBounds[res.creakedIdx];
        const mx = (lb.x0 + lb.x1) * 0.5, mz = (lb.z0 + lb.z1) * 0.5;
        const w = c.toWorld(mx, mz);
        c.env.play?.('creak', w.x, w.z, 8);
        c.rt.water?.spawnRipple(mx, mz, 0.75);
      }
      if (res.plungedIdx >= 0) {
        const lb = looseBounds[res.plungedIdx];
        const mx = (lb.x0 + lb.x1) * 0.5, mz = (lb.z0 + lb.z1) * 0.5;
        const w = c.toWorld(mx, mz);
        c.env.play?.('wade', w.x, w.z, 9);
        c.rt.water?.spawnRipple(mx, mz, 1.55);
      }
    },
  });

  // Towering 2.48 m Wetland Phragmites Reed & Spanish-Moss Curtain Walls rising out of the swamp
  // right beside the 4 narrow boardwalk arms so every crossing is a claustrophobic swamp tunnel!
  const clearWalks = [
    { x: 0, z: 0, r: 1.35 },
    { x: -1.45, z: 1.45, r: 0.75 },
    { x: -0.72, z: bz1 + 0.25, r: 0.95 },
    { x: bx1 + 0.25, z: 0.72, r: 0.95 },
  ];
  occluderWall(c, -2.95, -1.35, -0.92, -0.92, { style: 'reeds', y0: -bogDepth, h: 2.46, keepClear: clearWalks });
  occluderWall(c, 0.92, 0.92, 2.95, 1.35, { style: 'reeds', y0: -bogDepth, h: 2.46, keepClear: clearWalks });
  occluderWall(c, 0.92, -2.95, 1.35, -0.92, { style: 'reeds', y0: -bogDepth, h: 2.46, keepClear: clearWalks });
  occluderWall(c, -1.35, 0.92, -0.92, 2.95, { style: 'reeds', y0: -bogDepth, h: 2.46, keepClear: clearWalks });
  // Outer dry-bank hedgerow baffles breaking perimeter sightlines!
  occluderWall(c, -W * 0.38, bz1 + 0.55, -1.65, bz1 + 0.98, { style: 'hedge', keepClear: clearWalks, h: 2.42 });
  occluderWall(c, 1.65, bz0 - 0.98, W * 0.38, bz0 - 0.55, { style: 'hedge', keepClear: clearWalks, h: 2.42 });

  addMistVeils(c, [
    { x0: -0.85, z0: 2.1, x1: 0.85, z1: 2.1 },
    { x0: -0.85, z0: -2.1, x1: 0.85, z1: -2.1 },
    { x0: -2.1, z0: -0.85, x1: -2.1, z1: 0.85 },
    { x0: 2.1, z0: -0.85, x1: 2.1, z1: 0.85 },
  ], { color: [0.06, 0.14, 0.10], alpha: 0.65 });

  // Keep boardwalk approaches & Perimeter Doorway Ring clear, then pack the outer swamp rim with Cypress & Birch thicket!
  const midRimX = (W / 2 + bx1) * 0.5, midRimZ = (D / 2 + bz1) * 0.5;
  keepLane(c, -midRimX, -midRimZ, midRimX, -midRimZ, 1.25);
  keepLane(c, -midRimX, midRimZ, midRimX, midRimZ, 1.25);
  keepLane(c, -midRimX, -midRimZ, -midRimX, midRimZ, 1.25);
  keepLane(c, midRimX, -midRimZ, midRimX, midRimZ, 1.25);
  keepLane(c, 0, bz1, 0, D / 2 - 0.5, 1.5);
  keepLane(c, 0, -D / 2 + 0.5, 0, bz0, 1.5);
  keepLane(c, bx1, 0, W / 2 - 0.5, 0, 1.5);
  keepLane(c, -W / 2 + 0.5, 0, bx0, 0, 1.5);
  for (const dr of c.room.doors) {
    const dp = c.doorPoint(dr, 0.5);
    keepLane(c, dp.x, dp.z, Math.sign(dp.x) * midRimX || 0, Math.sign(dp.z) * midRimZ || 0, 1.45);
  }

  thicket(c, {
    tag: 'swamprim',
    ordCap: 104000,
    detBudget: 72000,
    hub: null,
    wet: true,
    species: { cypress: 3, birch: 2, pine: 1 },
    region: (x, z) => (x < bx0 - 0.35 || x > bx1 + 0.35 || z < bz0 - 0.35 || z > bz1 + 0.35),
  });

  const spSign = c.wallSpot(1.55, ['front', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      'CYPRESS FEN ANNEX',
      'KEEP MOVING ON WET PLANKS',
      'DO NOT REBOOT DROWNED DESKS',
    ], { seed: 127, warn: true });
  }
}
