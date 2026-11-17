// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Blowdown Tangle (`windthrow` — "the uprooted carpet root-plates and leaning windfall tunnels").
//
// An indoor gale tore through the fourth floor while the windows stayed shut:
// 45+ standing hemlock & birch trunks crowd around a jackstraws tangle of
// leaning windfall pines (`gnarledPineVox` tilted at 62°–70°) and giant 2-metre
// upturned root-plates (`uprootedPlateVox`) that ripped whole squares of office
// carpet, grey floor screed, and Romex wiring vertically into the air!
//
// Flooded root-pit craters (`installForestFloor` + `buildForestWater`) sit beside
// the torn-up plates. Duck (`c.rt.headY`) beneath the leaning trunks along the
// winding path, or lean (`marks.js` `lean`) on a Notched Windfall Pine to bridge
// the central flooded root crater straight to a stranded rucksack cache!

import {
  forestRoom, woodlandLight, installForestFloor, notchedTimber,
  placeVoxStack, trailSign, plenumBreach, backpackVox, campLanternVox,
} from '../forest.js';
import { thicket, keepLane } from '../forest-thicket.js';
import { occluderWall, addMistVeils } from '../forest-maze.js';
import {
  uprootedPlateVox, gnarledPineVox,
} from '../forest-models.js';

export function build(c) {
  const { W, D, H, R, params: p } = c;
  c.shell({ panels: false, floor: false });
  woodlandLight(c, 3, 3, 1, 0.96, {
    mode: 'canopy',
    deadRatio: 0.38,
    shaftTint: [0.78, 0.95, 0.68],
  });
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false, thicket: false });

  // Central Flooded Root-Ball Crater (`[-2.35..2.35, -1.65..1.65]`) where two giant trees tore out of the slab!
  const crater = { x0: -2.35, z0: -1.65, x1: 2.35, z1: 1.65, depth: 0.40, waterY: -0.06 };

  // Build 4 staggered 2.38 m Blowdown Hedge & Cordwood Canyon Walls around the crater so sightlines break at every corner!
  const clearCrater = [{ x: -0.35, z: crater.z1 + 0.3, r: 1.15 }, { x: 0.55, z: crater.z0 - 0.45, r: 1.05 }];
  occluderWall(c, -W * 0.38, 2.35, -1.25, 2.80, { style: 'hedge', keepClear: clearCrater, h: 2.40 });
  occluderWall(c, 1.25, -2.80, W * 0.38, -2.35, { style: 'hedge', keepClear: clearCrater, h: 2.40 });
  occluderWall(c, -4.45, -D * 0.36, -4.02, -0.95, { style: 'cordwood', keepClear: clearCrater, h: 2.36 });
  occluderWall(c, 4.02, 0.95, 4.45, D * 0.36, { style: 'cordwood', keepClear: clearCrater, h: 2.36 });
  addMistVeils(c, [
    { x0: -3.9, z0: 0, x1: -2.8, z1: 0 },
    { x0: 2.8, z0: 0, x1: 3.9, z1: 0 },
  ], { color: [0.08, 0.14, 0.10], alpha: 0.62 });

  // Reserve a compact ring closely hugging the crater & root-plates so the entire outer woods pack dense with trees!
  const rx = 3.35, rz = 2.55;
  keepLane(c, -rx, -rz, rx, -rz, 1.38);
  keepLane(c, rx, -rz, rx, rz, 1.38);
  keepLane(c, rx, rz, -rx, rz, 1.38);
  keepLane(c, -rx, rz, -rx, -rz, 1.38);
  keepLane(c, -rx, -rz, -W / 2 + 1.05, -D / 2 + 1.05, 1.38); // stash spur
  for (const dr of c.room.doors) {
    const dp = c.doorPoint(dr, 0.55);
    const tx = Math.max(-rx, Math.min(rx, dp.x));
    const tz = Math.max(-rz, Math.min(rz, dp.z));
    keepLane(c, dp.x, dp.z, Math.abs(dp.x) > Math.abs(dp.z) ? Math.sign(dp.x) * rx : tx, Math.abs(dp.z) >= Math.abs(dp.x) ? Math.sign(dp.z) * rz : tz, 1.42);
  }

  // Notched Pine on the south bank ready to be leaned down across the 3.3 m flooded root crater!
  notchedTimber(c, { x: -0.35, z: crater.z1 + 0.28, dirX: 0, dirZ: -1, length: 3.9, bridgeY: 0.12 });

  installForestFloor(c, {
    cutFloor: true,
    deep: true,
    bogs: [crater],
    brackens: [
      { x0: -rx - 0.8, z0: -1.4, x1: -2.6, z1: 1.4 },
      { x0: 2.6, z0: -1.4, x1: rx + 0.8, z1: 1.4 },
    ],
  });

  // Stranded dry supply hummock on the north lip of the crater (`0.55, crater.z0 - 0.45`)
  c.reserve(0.55, crater.z0 - 0.45, 0.85);
  c.leave('battery', 0.38, crater.z0 - 0.45);
  c.leave('snack', 0.78, crater.z0 - 0.45);

  // ---- Giant Upturned Carpet/Screed Root-Plates & Leaning Jackstraw Windfalls ----
  const blowdownEntries = [
    // Two monumental upturned root-plates flanking the crater where the trees ripped up the office floor!
    { key: 'forest:rootplate', make: uprootedPlateVox(), x: -2.55, y: 0, z: -0.2, rot: Math.PI * 0.5, scale: 0.036 },
    { key: 'forest:rootplate', make: uprootedPlateVox(), x: 2.55, y: 0, z: 0.2, rot: -Math.PI * 0.5, scale: 0.036 },

    // Two leaning jackstraw windfall trunks slanting high OVER the east & west walking lanes (`y = 1.05..2.8 m`, forming duck-under arches!)
    { key: 'forest:windfall:84', make: gnarledPineVox(84, true), x: -2.45, y: 0.55, z: -0.2, rot: -Math.PI * 0.5, tilt: [1.18, 0], scale: 0.036 },
    { key: 'forest:windfall:84', make: gnarledPineVox(84, true), x: 2.45, y: 0.55, z: 0.2, rot: Math.PI * 0.5, tilt: [1.18, 0], scale: 0.036 },

    // Stranded rucksack & lantern by the north lip
    { key: 'forest:pack:#c98a26', make: backpackVox('#c98a26'), x: 0.55, y: 0, z: crater.z0 - 0.82, rot: 0.4 },
    { key: 'forest:lantern', make: campLanternVox(), x: 0.12, y: 0, z: crater.z0 - 0.65, scale: 0.027 },
  ];
  // Solid colliders ONLY on the vertical root-plates themselves (`|x| ~ 2.55`), leaving the `|x| = rx` lanes wide open under the leaning trunks!
  c.solid(-2.80, -0.95, -2.30, 0.55, { tall: true });
  c.solid(2.30, -0.55, 2.80, 0.95, { tall: true });
  c.reserve(-2.55, -0.2, 0.95);
  c.reserve(2.55, 0.2, 0.95);
  plenumBreach(c, -4.2, -0.2, 2, 301);
  plenumBreach(c, 4.2, 0.2, 2, 302);
  placeVoxStack(c, `forest:windthrow:blowdown:${c.room.id}`, blowdownEntries);

  if (c.rt.lights.length < 13) c.light(0.12, 0.55, crater.z0 - 0.65, '#ffd480', 0.72, { bank: 3, k: 1.6, far: 5.8 });

  // Gentle auto-duck headroom (`0.96 m` >= `0.62 m` crawl minimum!) right where the two leaning windfalls cross the side lanes!
  c.rt.headY = (x, z) => {
    if (Math.abs(z) < 0.75 && (Math.abs(x + rx) < 0.75 || Math.abs(x - rx) < 0.75)) {
      return 0.98;
    }
    return H - (c.rt.floorY ? c.rt.floorY(x, z) : 0);
  };

  // ---- Dense Surrounding Hemlock & Birch Stand (60+ additional trunks!) -----
  const grove = thicket(c, {
    tag: 'galewoods',
    ordCap: 112000,
    budget: 64000,
    detCap: 118000,
    detBudget: 92000,
    hub: null,
    spacing: 0.80,
    trees: 36,
    companionStems: 28,
    species: { sweeping: 3, hemlock: 4, birchStem: 4 },
    region: (x, z) => Math.abs(x) > 3.05 || Math.abs(z) > 2.15,
  });
  c.rt.treeCount = grove.trees.length + grove.companions + 2;

  const spSign = c.wallSpot(1.55, ['front', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      `WINDTHROW PARCEL ${p.galeCode || 'W-12'}`,
      'DUCK UNDER LEANING TRUNKS',
      'LEAN NOTCHED PINE TO BRIDGE PIT',
    ], { seed: 241 + R.int(0, 9), warn: true });
  }
}
