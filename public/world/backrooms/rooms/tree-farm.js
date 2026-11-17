// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Barcode Plantation (`tree-farm` — "forty-eight laser-aligned barcoded spruces on IV drip bags").
//
// Corporate pulp-and-Christmas-tree farming taken literally inside an office:
// Up to 48 identical arrow-straight Sitka spruces (`plantationSpruceVox`) stand
// on a strict 1.65 m × 1.65 m cubicle-grid matrix through steel carpet grommets,
// each wearing an eye-level Q4 asset barcode and an overhead ceiling-fed IV
// toner-sap drip bag!
//
// Orange sawbuck "ROW CLOSED" barricades block selected cross-aisles so you
// weave deep between the claustrophobic spruce rows to reach the central
// Harvest Irrigation Manifold (`[E]` or `call` flushes the ceiling sap lines,
// lighting up the green exit-row beacons, beside `battery` + `snack` supplies!).

import {
  forestRoom, woodlandLight, trailSign, registerCallTarget,
  placeVoxStack, buildForestWater, peatWaterTex, plenumBreach,
  ensureForestDetail, campLanternVox,
  CEDAR_TIMBER, BRASS_TRIM, BLAZE_ORANGE,
} from '../forest.js';
import {
  plantationSpruceVox, rottingBinderPileVox, forestLitterVox,
} from '../forest-models.js';
import { occluderWall, addMistVeils, buildPnwTerrain } from '../forest-maze.js';

export function build(c) {
  const { W, D, H, R, kit, params: p } = c;
  c.shell({ panels: false });
  woodlandLight(c, 3, 3, 1, 0.92, {
    mode: 'islands',
    deadRatio: 0.45,
    shaftTint: [0.65, 1.0, 0.72],
  });
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false, thicket: false });

  // Central Harvest Irrigation Manifold & Tally Desk (`0, 0`)
  c.flat.box(-0.55, 0, -0.45, 0.55, 0.94, 0.45, CEDAR_TIMBER, { skip: '-y' });
  c.flat.box(-0.60, 0.94, -0.50, 0.60, 1.02, 0.50, [0.22, 0.36, 0.24]);
  c.flat.box(-0.12, 1.02, -0.12, 0.12, 1.38, 0.12, BRASS_TRIM);
  c.flat.box(-0.28, 1.32, -0.05, 0.28, 1.40, 0.05, BLAZE_ORANGE); // brass/orange valve wheel
  c.solid(-0.58, -0.48, 0.58, 0.48);
  c.reserve(0, 0, 1.45);

  c.leave('battery', -0.28, 0.12, { y: 1.02 });
  c.leave('snack', 0.28, 0.12, { y: 1.02 });

  // Shallow green toner-sap irrigation trough puddles flanking the central manifold!
  const water = buildForestWater(
    c,
    [
      { x0: -3.2, z0: -0.65, x1: -1.25, z1: 0.65, depth: 0.09, waterY: 0.015 },
      { x0: 1.25, z0: -0.65, x1: 3.2, z1: 0.65, depth: 0.09, waterY: 0.015 },
    ],
    {
      map: peatWaterTex(kit, 'peat'),
      shallowHex: '#256638',
      deepHex: '#092412',
      foamHex: '#6bff9c',
      caustics: false,
    }
  );

  // Staggered 2.38 m tall Forestry Quarantine Tarp & Cordwood Row-Dividers turning the spruce grid into blind slalom aisles!
  const keepCenter = [{ x: 0, z: 0, r: 1.85 }];
  occluderWall(c, -3.55, 1.25, -0.85, 1.68, { style: 'tarp', keepClear: keepCenter, h: 2.38 });
  occluderWall(c, 0.85, -1.68, 3.55, -1.25, { style: 'tarp', keepClear: keepCenter, h: 2.38 });
  occluderWall(c, -2.55, -D * 0.36, -2.12, -1.15, { style: 'cordwood', keepClear: keepCenter, h: 2.36 });
  occluderWall(c, 2.12, 1.15, 2.55, D * 0.36, { style: 'cordwood', keepClear: keepCenter, h: 2.36 });
  addMistVeils(c, [
    { x0: -2.2, z0: 0, x1: -0.9, z1: 0 },
    { x0: 0.9, z0: 0, x1: 2.2, z1: 0 },
  ], { color: [0.08, 0.20, 0.11], alpha: 0.62 });

  // Build the regimented Corporate Spruce Matrix evenly across ALL FOUR QUADRANTS wall-to-wall!
  // A 7 × 7 matrix (`stepX, stepZ ~ 2.0 m`) with wide eye-level spruce skirts blocks cross-aisle views!
  const cols = 7, rows = 7;
  const stepX = (W - 3.2) / (cols - 1);
  const stepZ = (D - 3.2) / (rows - 1);
  const sScale = 0.036;
  const tallVox = Math.max(78, Math.round((H + 0.14) / sScale));

  const candidates = [];
  for (let ix = 0; ix < cols; ix++) {
    const gx = (ix - (cols - 1) * 0.5) * stepX;
    for (let iz = 0; iz < rows; iz++) {
      const gz = (iz - (rows - 1) * 0.5) * stepZ;
      if (Math.hypot(gx, gz) < 1.65) continue;
      if (Math.abs(gz) < 0.85 && Math.abs(gx) < 3.45) continue;
      if (!c.clear(gx, gz, 0.32)) continue;
      candidates.push({ ix, iz, gx, gz });
    }
  }
  // Interleave checkerboard parity so Ordinary & Detail spruces distribute symmetrically across left, right, front & back!
  candidates.sort((a, b) => ((a.ix + a.iz) % 2) - ((b.ix + b.iz) % 2) || Math.hypot(a.gx, a.gz) - Math.hypot(b.gx, b.gz));

  const ordSpruces = [];
  const det = ensureForestDetail(c);
  let detCount = 0;

  for (let ix = 0; ix < cols; ix++) {
    const gx = (ix - (cols - 1) * 0.5) * stepX;
    det.arch.box(gx - 0.02, H - 0.09, -D / 2 + 1.4, gx + 0.02, H - 0.05, D / 2 - 1.4, [0.54, 0.62, 0.56]);
  }

  for (const { ix, iz, gx, gz } of candidates) {
    const greenBag = ((ix + iz) % 2) === 0;
    const entry = {
      key: `forest:spruce:${tallVox}:${greenBag ? 1 : 0}`,
      make: plantationSpruceVox(tallVox, greenBag),
      x: gx,
      y: 0,
      z: gz,
      rot: ((ix * 3 + iz) % 4) * (Math.PI * 0.5),
      scale: sScale,
    };
    if (ordSpruces.length < 14) {
      ordSpruces.push(entry);
      c.solid(gx - 0.19, gz - 0.19, gx + 0.19, gz + 0.19, { tall: true });
      c.reserve(gx, gz, 0.32);
    } else if (detCount < 16 && det.totalTris() < 120000) {
      det.pushVox(entry);
      detCount++;
      c.flat.box(gx - 0.18, 0, gz - 0.18, gx + 0.18, 0.08, gz + 0.18, [0.34, 0.36, 0.34], { skip: '-y' });
      c.solid(gx - 0.19, gz - 0.19, gx + 0.19, gz + 0.19, { tall: true });
      c.reserve(gx, gz, 0.32);
    } else {
      continue;
    }
    c.blot(gx, gz, 1.02, 1.02, { rgb: [0.04, 0.06, 0.03], a: 0.45 });
    if ((ix + iz) % 3 === 0) plenumBreach(c, gx - 0.15, gz - 0.15, 1, ix * 7 + iz);
  }

  const planted = ordSpruces.length + detCount;
  ordSpruces.push({ key: 'forest:farm:lantern', make: campLanternVox(), x: -0.42, y: 1.02, z: -0.22, scale: 0.026 });
  placeVoxStack(c, `forest:treefarm:spruces:${c.room.id}`, ordSpruces);
  c.rt.treeCount = planted;

  // Scatter `detail: true` audit binders & pine-needle litter along the rows
  for (let k = 0; k < 12; k++) {
    const lx = R.range(-W / 2 + 1.0, W / 2 - 1.0), lz = R.range(-D / 2 + 1.0, D / 2 - 1.0);
    const isBinder = k % 4 === 0;
    det.pushVox({
      key: `forest:detail:${isBinder ? 'binders' : 'litter'}`,
      make: isBinder ? rottingBinderPileVox() : forestLitterVox(),
      x: lx,
      y: 0.004,
      z: lz,
      rot: R.range(0, 6.28),
      scale: 0.027,
    });
  }

  // Two orange-flagged "ROW CLOSED" wooden sawbucks inside the grid (perimeter + adjacent aisles remain wide open!)
  for (const [bx, bz] of [[-stepX * 1.5, stepZ * 1.0], [stepX * 1.5, -stepZ * 1.0]]) {
    if (Math.abs(bx) < W / 2 - 2.2 && Math.abs(bz) < D / 2 - 2.2 && c.clear(bx, bz, 0.55)) {
      c.flat.box(bx - 0.52, 0.52, bz - 0.05, bx + 0.52, 0.64, bz + 0.05, BLAZE_ORANGE);
      c.flat.box(bx - 0.45, 0, bz - 0.18, bx - 0.37, 0.66, bz + 0.18, CEDAR_TIMBER);
      c.flat.box(bx + 0.37, 0, bz - 0.18, bx + 0.45, 0.66, bz + 0.18, CEDAR_TIMBER);
      c.solid(bx - 0.52, bz - 0.18, bx + 0.52, bz + 0.18);
    }
  }

  // Stepped Pacific Northwest mossy rock & cedar-loam embankments swelling up from the outer corners!
  buildPnwTerrain(c, {
    style: 'rainforest',
    density: 1.35,
    maxHeight: 1.92,
    region: (x, z) => Math.abs(x) > 1.35 && Math.abs(z) > 1.35,
  });

  // Interactive Irrigation Flush (`[E]` at manifold OR `call` whistle): pulses green Bank-3 sap glow & ripples!
  c.light(0, 1.35, 0, '#4dff88', 0.88, { bank: 3, k: 2.0, far: 8.5 });
  let flushed = false;
  const flushLines = () => {
    const mw = c.toWorld(0, 0);
    c.env.play?.('glug', mw.x, mw.z, 10);
    c.env.play?.('ding', mw.x, mw.z, 9);
    water?.spawnRipple(-2.2, 0, 1.35);
    water?.spawnRipple(2.2, 0, 1.35);
    if (!flushed) {
      flushed = true;
      c.env.camera?.recharge?.(15);
    }
  };
  c.use({ x: 0, z: 0, r: 1.75, label: 'flush sap manifold', use: flushLines });
  registerCallTarget(c, 0, 0, flushLines, { r: 14 });

  const spSign = c.wallSpot(1.55, ['front', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      `PULP MATRIX ${p.lotCode || 'Q4-48'}`,
      'TREES SPACED 1.65 M ON CENTER',
      'DO NOT UNPLUG SAP BAGS',
    ], { seed: 229 + R.int(0, 9), warn: true });
  }
}
