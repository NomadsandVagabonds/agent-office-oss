// The Backrooms — a room of the corporate aquatics annex (`waterpark`):
// The Diving Well ("the deep green pool with the office wall stopping under the water").
//
// A 2.05-metre-deep emerald diving well under a humming office ceiling. Across
// the middle of the pool hangs a wallpapered office partition that stops 75 cm
// below the waterline — blocking anyone swimming on the surface! Hold `C` to
// dive deep into the glowing aquamarine chamber, swim beneath the submerged
// drywall past drowned office workstations and an inverted air-pocket bell, and
// kick `Space` to surface at the far diving tower.

import * as THREE from 'three';
import { Batch, WHITE } from '../kit.js';
import {
  poolroom, natatoriumLight, createBasin, addTranslucent,
  poolSign, depthTile, poolLadderVox, lifeRingVox, placeVox,
  COPING, CHROME,
} from '../waterpark.js';

export function build(c) {
  const { W, D, H, params: p } = c;
  c.shell({ panels: false, floor: false });
  natatoriumLight(c, 3, 3, 1, 1.04);
  poolroom(c, { wrong: 0, footbath: false, signs: false });

  // Deep emerald diving basin leaving >= 1.6 m dry deck around perimeter
  const bx0 = -W / 2 + 1.65, bx1 = W / 2 - 1.65;
  const bz0 = -D / 2 + 1.85, bz1 = D / 2 - 1.85;
  const depth = 2.05;
  const waterY = -0.06;
  const wallBottomY = -0.78; // 72 cm underwater!

  // Trapped underwater air-bell dome on the far side of the submerged wall
  const airBell = { x: 0, z: -1.85, r: 0.95 };

  // Surface-blocking collider along z = 0:
  // Starts `on = false` during build-time `world.walkable` (since a player reaches the far side by diving under it!),
  // and engages dynamically during play whenever the swimmer is NOT submerged deep enough to clear `wallBottomY`!
  const surfaceBarrier = c.solid(bx0 - 0.1, -0.18, bx1 + 0.1, 0.18);
  surfaceBarrier.on = false;

  const basin = createBasin(c, {
    x0: bx0, z0: bz0, x1: bx1, z1: bz1,
    depth,
    waterY,
    tile: 'emerald',
    wallTile: 'cobalt',
    waterTone: 'emerald',
    waterAlpha: 0.54,
    stepsSide: 'both',
    deepSwim: true,
    airPocket: airBell,
    onTick: (info, dt, t, me) => {
      if (!me.inside || !me.world) {
        surfaceBarrier.on = false;
        return;
      }
      const eyeLocalY = me.world.y - (c.room.y || 0);
      const deepEnough = info.swimmer.submerged && eyeLocalY < wallBottomY + 0.16;
      const alreadyUnder = Math.abs(me.z) < 0.36;
      surfaceBarrier.on = !(deepEnough || alreadyUnder);
      // If directly beneath the submerged partition, keep head below the wet drywall soffit
      if (alreadyUnder && eyeLocalY > wallBottomY - 0.06) {
        me.world.sinkTo = Math.max(me.world.sinkTo, 0.35);
      }
      void dt; void t;
    },
  });

  // 1. The Submerged Office Partition hanging from the ceiling down to `y = -0.78 m` underwater!
  c.pillar(0, 0, (bx1 - bx0) + 0.16, 0.24, { y0: wallBottomY, solid: false, skirting: false });
  // Chrome drip-rail cap along the submerged bottom edge of the partition so you clearly see the gap underwater!
  c.flat.box(bx0 - 0.05, wallBottomY - 0.04, -0.14, bx1 + 0.05, wallBottomY + 0.02, 0.14, CHROME);

  // Garbled instruction sign mounted right on the front (+z) face of the hanging partition above the waterline
  const signKey = 'wp:divesign:' + (p.code || '404 FT');
  const signTex = c.kit.tex.custom(signKey, 216, 88, (g, tw, th) => {
    g.fillStyle = '#e9f3f2'; g.fillRect(0, 0, tw, th);
    g.strokeStyle = '#1d3640'; g.lineWidth = 3; g.strokeRect(2, 2, tw - 4, th - 4);
    g.fillStyle = '#134e5e'; g.fillRect(6, 6, tw - 12, 22);
    g.fillStyle = '#f4fbfb'; g.font = '700 11px ui-monospace, monospace'; g.textAlign = 'center';
    g.fillText('DIVING WELL CLEARANCE', tw / 2, 21);
    g.fillStyle = '#13303a'; g.font = '700 11px ui-monospace, monospace';
    g.fillText('HOLD [C] TO DIVE UNDER WALL', tw / 2, 48);
    g.fillStyle = '#a62822'; g.font = '700 10px ui-monospace, monospace';
    g.fillText(`SPACE TO SURFACE · DEPTH ${p.code || '404 FT'}`, tw / 2, 69);
  }, { clamp: true });
  c.mapped(signKey, signTex).quad([-1.02, 0.54, 0.13], [1.02, 0.54, 0.13], [1.02, 1.40, 0.13], [-1.02, 1.40, 0.13], WHITE);

  // 2. Underwater Glowing Pool Niches (4 bright cyan lamps illuminating the drowned office below!)
  const nicheMat = c.shining('wp:niche', c.kit.tex.white(), 2.4, [0.48, 0.98, 1.0]);
  for (const [sx, zN] of [[-1, 2.3], [1, 2.3], [-1, -2.3], [1, -2.3]]) {
    const nx = sx > 0 ? bx1 - 0.02 : bx0 + 0.02;
    const ny = -1.22;
    c.flat.box(nx - 0.04, ny - 0.24, zN - 0.34, nx + 0.04, ny + 0.24, zN + 0.34, CHROME);
    if (sx < 0) nicheMat.quad([nx + 0.03, ny - 0.18, zN + 0.26], [nx + 0.03, ny - 0.18, zN - 0.26], [nx + 0.03, ny + 0.18, zN - 0.26], [nx + 0.03, ny + 0.18, zN + 0.26], WHITE);
    else nicheMat.quad([nx - 0.03, ny - 0.18, zN - 0.26], [nx - 0.03, ny - 0.18, zN + 0.26], [nx - 0.03, ny + 0.18, zN + 0.26], [nx - 0.03, ny + 0.18, zN - 0.26], WHITE);
    c.light(nx - sx * 0.45, ny, zN, '#3ef2ff', 0.85, { k: 2.8, far: 7.5 });
  }

  // 3. Drowned Office Workstations & Watercooler resting at y = -2.05 m on the bottom of the pool!
  for (const [dx, dz, rot] of [[-1.65, 2.15, 0.4], [1.55, -2.35, -2.5]]) {
    if (c.hasProp('desk')) c.prop('desk', dx, dz, { y: -depth, rot, solid: false, shadow: false });
    if (c.hasProp('chair')) c.prop('chair', dx + 0.55, dz + 0.55, { y: -depth, rot: rot + 2.8, solid: false, shadow: false });
    if (c.hasProp('crt')) c.prop('crt', dx, dz, { y: -depth + 0.76, rot, solid: false, shadow: false });
  }

  // 4. Inverted Acrylic Air-Pocket Bell suspended underwater at `airBell` (refills breath mid-dive!)
  const dome = new Batch();
  const rB = airBell.r, bellY0 = -1.15, bellY1 = -0.52;
  c.flat.box(airBell.x - rB, bellY1, airBell.z - rB, airBell.x + rB, bellY1 + 0.06, airBell.z + rB, CHROME);
  dome.box(airBell.x - rB + 0.04, bellY0, airBell.z - rB + 0.04, airBell.x + rB - 0.04, bellY1, airBell.z + rB - 0.04, [0.82, 0.99, 1.0]);
  addTranslucent(c, dome, { alpha: 0.36, side: THREE.DoubleSide, order: 3 });

  // 5. High Diving Springboard Platform on the far (-z) deck + Chrome Pool Ladders
  const bSide = p.boardSide || 1;
  const dbX = bSide * 1.45, dbZ = bz0 - 0.55;
  c.flat.box(dbX - 0.38, 0, dbZ - 0.45, dbX + 0.38, 0.95, dbZ + 0.25, COPING, { skip: '-y' });
  c.flat.box(dbX - 0.28, 0.95, dbZ - 0.4, dbX + 0.28, 1.03, bz0 + 1.35, [0.18, 0.68, 0.84]);
  c.flat.box(dbX - 0.26, 1.032, bz0 + 0.95, dbX + 0.26, 1.045, bz0 + 1.33, COPING);
  c.solid(dbX - 0.4, dbZ - 0.45, dbX + 0.4, dbZ + 0.25);

  placeVox(c, 'wp:ladder', poolLadderVox(), bx1 - 0.45, bz1 - 0.55, { y: -0.92, rot: 0 });
  placeVox(c, 'wp:ladder', poolLadderVox(), bx0 + 0.45, bz0 + 0.55, { y: -0.92, rot: Math.PI });
  placeVox(c, 'wp:lifering', lifeRingVox(), -W / 2 + 0.12, 0, { y: 1.35, rot: Math.PI / 2 });

  // Reward supply on the far (-z) deck for diving under the submerged wall!
  c.leave('torch', -bSide * 1.6, bz0 - 0.75, { y: 0 });

  depthTile(c, 0, 0.045, bz1 + 0.08, p.code || '404 FT', 0, 31);
  depthTile(c, 0, 0.045, bz0 - 0.08, 'NO FLOOR', Math.PI, 37);
  poolSign(c, 'left', 2.2, 1.55, [
    'DEEP DIVING WELL',
    'SUBMERGED WALL AHEAD',
    'HOLD [C] TO DIVE DEEP',
    'AIR BELL AT MID-POOL',
  ], { seed: 61, mess: 0.18 });

  void H;
  void basin;
}
