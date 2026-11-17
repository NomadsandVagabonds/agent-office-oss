// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Fire Tower (`fire-lookout` — "the wooden fire-lookout tower crushed into the ceiling tiles").
//
// A cross-braced timber Forestry Fire-Lookout Tower stands in the centre of an
// indoor pine grove, its cabin roof jammed flat against the 5.6 m suspended
// acoustic ceiling grid with popped ceiling tiles hanging round its eaves!
// Climb the wooden stairs to the lookout cab (`y = 2.40 m`) to pick up a
// guaranteed Trail Call (`call`) whistle beside the brass Osborne Fire-Finder.

import { Batch } from '../kit.js';
import {
  forestRoom, woodlandLight, placeVoxStack, trailSign,
  campLanternVox, backpackVox, plenumBreach,
  CEDAR_TIMBER, BRASS_TRIM, BLAZE_ORANGE,
} from '../forest.js';
import { thicket } from '../forest-thicket.js';
import { occluderWall, placeStageSetClutter, hangCardboardBirds, addMistVeils } from '../forest-maze.js';

export function build(c) {
  const { W, D, H, R, params: p } = c;
  c.shell({ panels: false });
  woodlandLight(c, 3, 3, 1, 1.02, { mode: 'canopy' });
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false });

  const cabY = 2.40;
  const cabTop = H - 0.02; // Crushed straight into the suspended ceiling tiles!
  const hw = 1.65; // 3.3 m × 3.3 m lookout cab footprint centred at (0, -0.35)
  const cz = -0.35;

  // Pop 3D HVAC return-plenum breaches all round the crushed lookout cab roof!
  for (const [hx, hz, idx] of [[-1.5, cz - 1.5, 1], [1.5, cz - 1.5, 2], [-1.5, cz + 1.5, 3], [1.5, cz + 1.5, 4], [0, cz, 5]]) {
    plenumBreach(c, hx, hz, 2, idx + 61);
  }

  // 4 Heavy Timber Tower Legs + Horizontal Girts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const lx = sx * (hw - 0.12), lz = cz + sz * (hw - 0.12);
      c.flat.box(lx - 0.09, 0, lz - 0.09, lx + 0.09, cabTop, lz + 0.09, CEDAR_TIMBER, { skip: '-y' });
      c.solid(lx - 0.14, lz - 0.14, lx + 0.14, lz + 0.14, { tall: true });
    }
  }
  for (const gy of [1.15, cabY - 0.12]) {
    c.flat.box(-hw, gy, cz - hw, hw, gy + 0.10, cz - hw + 0.10, CEDAR_TIMBER);
    c.flat.box(-hw, gy, cz + hw - 0.10, hw, gy + 0.10, cz + hw, CEDAR_TIMBER);
    c.flat.box(-hw, gy, cz - hw, -hw + 0.10, gy + 0.10, cz + hw, CEDAR_TIMBER);
    c.flat.box(hw - 0.10, gy, cz - hw, hw, gy + 0.10, cz + hw, CEDAR_TIMBER);
  }

  // Lookout Cab Deck (`y = cabY`) + Half-Walls + Crushed Eaves against the Drop Ceiling!
  c.flat.box(-hw - 0.15, cabY - 0.14, cz - hw - 0.15, hw + 0.15, cabY, cz + hw + 0.15, CEDAR_TIMBER);
  // Leave south entry gap (`x = -1.45..-0.35` on `z = cz + hw`) for the stairs!
  c.flat.box(-hw, cabY, cz - hw, hw, cabY + 1.02, cz - hw + 0.10, [0.38, 0.25, 0.15]);
  c.flat.box(-hw, cabY, cz - hw, -hw + 0.10, cabY + 1.02, cz + hw, [0.38, 0.25, 0.15]);
  c.flat.box(hw - 0.10, cabY, cz - hw, hw, cabY + 1.02, cz + hw, [0.38, 0.25, 0.15]);
  c.flat.box(-0.30, cabY, cz + hw - 0.10, hw, cabY + 1.02, cz + hw, [0.38, 0.25, 0.15]);
  // Crushed shingle roof cornice jammed flat into `H`
  c.flat.box(-hw - 0.32, cabTop - 0.22, cz - hw - 0.32, hw + 0.32, cabTop, cz + hw + 0.32, [0.22, 0.36, 0.23]);

  // Walkable Straight Timber Staircase climbing along `x = -1.25..-0.40` from `z = cz + hw + 3.4` (`y = 0`) up to `z = cz + hw` (`y = cabY`)!
  const stairX0 = -1.28, stairX1 = -0.38;
  const stairZStart = Math.min(D / 2 - 1.35, cz + hw + 3.35);
  const stairZEnd = cz + hw;
  const nSteps = 15;
  const dZ = (stairZStart - stairZEnd) / nSteps;
  for (let i = 0; i < nSteps; i++) {
    const zA = stairZStart - (i + 1) * dZ, zB = stairZStart - i * dZ;
    const sy = ((i + 1) / nSteps) * cabY;
    c.flat.box(stairX0, Math.max(0, sy - 0.20), zA, stairX1, sy, zB, CEDAR_TIMBER);
  }
  // Stair handrail
  c.flat.box(stairX0 - 0.06, 0, stairZEnd, stairX0, cabY + 0.85, stairZEnd + 0.08, CEDAR_TIMBER);

  // Smooth walkable `floorY` & `headY` for stairs + upper lookout cab (ground floor under cab remains 0 where outside stairs/cab!)
  c.rt.floorY = (x, z) => {
    if (x >= -hw && x <= hw && z >= cz - hw && z <= cz + hw) return cabY;
    if (x >= stairX0 - 0.05 && x <= stairX1 + 0.05 && z >= stairZEnd && z <= stairZStart) {
      const u = 1 - (z - stairZEnd) / (stairZStart - stairZEnd);
      return Math.max(0, Math.min(cabY, u * cabY));
    }
    return 0;
  };
  c.rt.headY = (x, z) => H - c.rt.floorY(x, z);

  // Central Osborne Fire-Finder Alidade Pedestal inside the cab (`0, cz`) + Guaranteed `call` Whistle!
  c.flat.box(-0.28, cabY, cz - 0.28, 0.28, cabY + 0.94, cz + 0.28, CEDAR_TIMBER);
  c.flat.box(0.55, cabY, cz - hw + 0.16, 1.35, cabY + 0.82, cz - hw + 0.68, CEDAR_TIMBER); // map desk
  c.leave('call', 0.95, cz - hw + 0.42, { y: cabY + 0.82 });

  const alidadeB = new Batch();
  alidadeB.box(-0.24, cabY + 0.94, cz - 0.24, 0.24, cabY + 0.99, cz + 0.24, BRASS_TRIM);
  alidadeB.box(-0.04, cabY + 0.99, cz - 0.32, 0.04, cabY + 1.12, cz + 0.36, BRASS_TRIM);
  alidadeB.box(-0.06, cabY + 1.02, cz + 0.26, 0.06, cabY + 1.14, cz + 0.42, BLAZE_ORANGE);
  // Subtle golden sightline beam cone extending out from the alidade
  alidadeB.box(-0.02, cabY + 1.05, cz + 0.42, 0.02, cabY + 1.09, cz + 2.8, [1.0, 0.88, 0.45]);
  const alidadeMesh = c.dynamic(alidadeB, { pivot: [0, cabY + 0.96, cz] });

  // It points where the seed left it and cannot be used: turning it a quarter and a ding was all it ever did.
  alidadeMesh.rotation.y = ((p.sector || 0) * Math.PI) / 2 + 0.35;

  // Cab lantern & backpack in 1 `placeVoxStack` mesh + dense claustrophobic forest crowding the tower base!
  const voxEntries = [
    { key: 'forest:tower:lantern', make: campLanternVox(), x: 0.68, y: cabY + 0.82, z: cz - hw + 0.42, scale: 0.026 },
    { key: 'forest:tower:pack', make: backpackVox('#2c6885'), x: -1.15, y: cabY, z: cz - hw + 0.45, rot: 0.5 },
  ];
  placeVoxStack(c, 'forest:lookout:grove', voxEntries);

  // Staggered painted-drywall & forestry-tarp maze around the tower base so finding the stairs requires rounding blind turns!
  const clearStairs = [{ x: -0.82, z: stairZStart + 0.4, r: 1.45 }, { x: 0, z: cz, r: 2.05 }];
  occluderWall(c, -W * 0.38, cz - 2.65, -1.15, cz - 2.42, { style: 'drywall', keepClear: clearStairs, h: 2.50 });
  occluderWall(c, 1.15, cz + 2.42, W * 0.38, cz + 2.65, { style: 'tarp', keepClear: clearStairs, h: 2.42 });
  occluderWall(c, 2.55, -D * 0.36, 2.78, -0.45, { style: 'drywall', keepClear: clearStairs, h: 2.50 });
  occluderWall(c, -2.85, 0.25, -2.42, D * 0.34, { style: 'hedge', keepClear: clearStairs, h: 2.48 });
  placeStageSetClutter(c, [[2.15, 1.85]]);
  hangCardboardBirds(c, 2.2, -1.8, 3);
  addMistVeils(c, [{ x0: -2.2, z0: cz + 2.1, x1: 0.4, z1: cz + 2.1 }], { color: [0.07, 0.15, 0.10], alpha: 0.60 });

  thicket(c, {
    tag: 'towerwoods',
    ordCap: 112000,
    budget: 92000,
    detCap: 122000,
    detBudget: 108000,
    hub: [0, cz + hw + 1.6],
    laneWidth: 1.42,
    spacing: 0.80,
    trees: 36,
    companionStems: 30,
    under: 56,
    hillsOpt: { style: 'rocky', density: 1.6, maxHeight: 2.35 },
    region: (x, z) => Math.abs(x) > hw + 1.32 || z < cz - hw - 0.55 || z > cz + hw + 1.65,
  });
  if (c.rt.lights.length < 13) c.light(0, cabY + 1.25, cz, '#ffd98a', 0.78, { bank: 3, k: 1.7, far: 6.8 });

  const spSign = c.wallSpot(1.55, ['front', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      `LOOKOUT CAB ${p.towerCode || 'T-04'}`,
      'ROOF CLEARANCE: 0.00 M',
    ], { seed: 139 + R.int(0, 9), warn: true });
  }
}
