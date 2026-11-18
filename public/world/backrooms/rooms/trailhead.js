// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Visitor Kiosk (`trailhead` — "the timber ranger booth under the ceiling tubes").
//
// A cedar-shingled National-Park check-in booth wedged beneath the office's
// suspended ceiling grid, flanked by chrome lobby turnstiles, a glassed 3D
// moss-and-cubicle relief table of the floor, a stack of unassigned rucksacks,
// a guaranteed Trail Call (`call`) whistle on the counter, and a rotatable
// brass Trail Azimuth Dial that swings toward the floor's real exit.

import { Batch, WHITE } from '../kit.js';
import {
  forestRoom, woodlandLight, trailSign, forestMural,
  placeVox, placeVoxStack, registerCallTarget,
  stumpVox, backpackVox, campLanternVox,
  CEDAR_TIMBER, BRASS_TRIM, BLAZE_ORANGE,
} from '../forest.js';
import { thicket } from '../forest-thicket.js';
import { occluderWall, portalWall, placeStageSetClutter, hangCardboardBirds, peeledTurfStrip, ceilingTurfAndLogs } from '../forest-maze.js';

export function build(c) {
  const { W, D, H, R, params: p } = c;
  c.shell({ panels: false });
  woodlandLight(c, 3, 3, 1, 1.04);
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false });

  // Reserve central lanes so doorways & stash stay 100% clear
  c.reserve(0, 0, 1.35);

  // 1. Timber Ranger Check-In Booth offset to `x = -2.15, z = -1.35` (plenty of lane all round!)
  const bx = -Math.min(2.15, W * 0.22), bz = -Math.min(1.35, D * 0.16);
  const bw = 2.1, bd = 1.75, roofBase = Math.min(2.25, H - 0.65);
  // Lower timber counter walls + open service window facing +Z/+X
  c.flat.box(bx - bw / 2, 0, bz - bd / 2, bx + bw / 2, 1.02, bz + bd / 2, CEDAR_TIMBER, { skip: '-y' });
  c.flat.box(bx - bw / 2 - 0.06, 1.02, bz + bd / 2 - 0.12, bx + bw / 2 + 0.06, 1.09, bz + bd / 2 + 0.14, [0.58, 0.42, 0.25]);
  // Rear wall & 4 corner posts supporting cedar-shingle pitched roof jammed near ceiling
  c.flat.box(bx - bw / 2, 1.02, bz - bd / 2, bx + bw / 2, roofBase, bz - bd / 2 + 0.12, [0.34, 0.22, 0.13]);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = bx + sx * (bw / 2 - 0.07), pz = bz + sz * (bd / 2 - 0.07);
      c.flat.box(px - 0.06, 1.02, pz - 0.06, px + 0.06, roofBase, pz + 0.06, CEDAR_TIMBER);
    }
  }
  for (let tier = 0; tier < 5; tier++) {
    const shrink = tier * 0.18;
    const y0 = roofBase + tier * 0.10;
    if (y0 + 0.10 > H - 0.02) break;
    c.flat.box(
      bx - bw / 2 - 0.14 + shrink, y0, bz - bd / 2 - 0.14 + shrink * 0.6,
      bx + bw / 2 + 0.14 - shrink, y0 + 0.105, bz + bd / 2 + 0.14 - shrink * 0.6,
      tier % 2 ? [0.22, 0.36, 0.23] : [0.27, 0.43, 0.28]
    );
  }
  c.solid(bx - bw / 2, bz - bd / 2, bx + bw / 2, bz + bd / 2, { tall: true });
  c.reserve(bx, bz, 1.65);

  // Guaranteed themed item pickup: the Trail Call (`call`) whistle waiting on the service counter!
  placeVox(c, 'forest:kiosk:lantern', campLanternVox(), bx - 0.68, bz + bd / 2 + 0.02, { y: 1.09, scale: 0.026 });
  if (c.rt.lights.length < 13) c.light(bx - 0.68, 1.38, bz + bd / 2 + 0.12, '#ffd584', 0.68, { bank: 3, k: 1.5, far: 5.8 });

  // 2. Chrome Office Subway Turnstile standing absurdly beside a split-rail log post on the +X side
  const tx = Math.min(2.25, W * 0.22), tz = -1.15;
  c.flat.box(tx - 0.12, 0, tz - 0.48, tx + 0.12, 0.98, tz + 0.48, [0.72, 0.76, 0.79], { skip: '-y' });
  c.flat.box(tx + 0.82, 0, tz - 0.12, tx + 1.02, 0.98, tz + 0.12, [0.72, 0.76, 0.79], { skip: '-y' });
  for (const ry of [0.52, 0.72, 0.88]) {
    c.flat.box(tx + 0.12, ry, tz - 0.025, tx + 0.82, ry + 0.035, tz + 0.025, [0.84, 0.87, 0.90]);
  }
  c.solid(tx - 0.14, tz - 0.50, tx + 0.14, tz + 0.50);
  c.solid(tx + 0.80, tz - 0.14, tx + 1.04, tz + 0.14);
  c.reserve(tx + 0.4, tz, 0.95);

  // 3. Interactive Topographic Relief Table & Brass Trail Azimuth Dial at `(0.45, 1.35)`
  const mx = 0.45, mz = Math.min(1.45, D * 0.16);
  c.flat.box(mx - 0.72, 0, mz - 0.56, mx + 0.72, 0.86, mz + 0.56, CEDAR_TIMBER, { skip: '-y' });
  c.flat.box(mx - 0.66, 0.86, mz - 0.50, mx + 0.66, 0.92, mz + 0.50, [0.19, 0.34, 0.18]);
  // Miniature beige office cubicles + miniature moss ridges inside the relief table!
  for (const [ox, oz, hBox, col] of [
    [-0.36, -0.22, 0.11, [0.78, 0.75, 0.66]],
    [-0.12, 0.16, 0.09, [0.78, 0.75, 0.66]],
    [0.28, -0.18, 0.15, [0.24, 0.44, 0.22]],
    [0.36, 0.20, 0.13, [0.28, 0.48, 0.25]],
  ]) {
    c.flat.box(mx + ox - 0.11, 0.92, mz + oz - 0.09, mx + ox + 0.11, 0.92 + hBox, mz + oz + 0.09, col);
  }
  c.solid(mx - 0.72, mz - 0.56, mx + 0.72, mz + 0.56);
  c.reserve(mx, mz, 1.05);

  // Dynamic Brass Trail Azimuth Needle that swings to point toward `c.level.exit.room`!
  const needleBatch = new Batch();
  needleBatch.box(-0.035, 0, -0.34, 0.035, 0.03, 0.34, BRASS_TRIM);
  needleBatch.box(-0.055, 0.02, 0.18, 0.055, 0.05, 0.38, BLAZE_ORANGE); // bright blaze tip (+Z)
  const dialPivot = c.dynamic(needleBatch, { pivot: [mx, 0.98, mz] });

  const exitDef = c.level.rooms?.[c.level.exit?.room] || null;
  const tableW = c.toWorld(mx, mz);
  let targetLocalYaw = 0;
  if (exitDef) {
    const exLocal = c.toLocal(exitDef.cx, exitDef.cz);
    targetLocalYaw = Math.atan2(exLocal.x - mx, exLocal.z - mz);
  }
  let dialAligned = false;
  let spinVel = 0;

  const triggerDial = () => {
    spinVel = 9.5;
    dialAligned = true;
    c.env.play?.('clack', tableW.x, tableW.z, 7);
    c.env.play?.('ding', tableW.x, tableW.z, 7);
  };

  c.use({
    x: mx,
    z: mz,
    r: 1.75,
    label: 'spin trail dial',
    use: triggerDial,
  });
  registerCallTarget(c, mx, mz, triggerDial, { r: 11, when: () => !dialAligned });

  c.tick((dt, t) => {
    if (!dialAligned) {
      dialPivot.rotation.y = Math.sin(t * 1.1) * 0.25;
      return;
    }
    if (spinVel > 0.05) {
      dialPivot.rotation.y += spinVel * dt;
      spinVel = Math.max(0, spinVel - dt * 5.2);
      if (spinVel <= 0.05) dialPivot.rotation.y = targetLocalYaw;
    } else {
      dialPivot.rotation.y = targetLocalYaw;
    }
  });

  // 4. Stack of unassigned rucksacks & cut stump beside the booth + dense woodland thicket surrounding the kiosk!
  const voxEntries = [];
  if (c.clear(bx + 1.45, bz - 0.55, 0.45)) {
    voxEntries.push(
      { key: 'forest:pack:#b84b28', make: backpackVox('#b84b28'), x: bx + 1.42, y: 0, z: bz - 0.55, rot: 0.4 },
      { key: 'forest:pack:#2c6885', make: backpackVox('#2c6885'), x: bx + 1.52, y: 0.52, z: bz - 0.52, rot: -0.6 },
      { key: 'forest:stump:4', make: stumpVox(4), x: bx + 1.38, y: 0, z: bz + 0.15, rot: 0.9 }
    );
    c.solid(bx + 1.15, bz - 0.82, bx + 1.78, bz + 0.42);
  }
  if (voxEntries.length) placeVoxStack(c, 'forest:trailhead:props', voxEntries);

  // Stage-set painted-tree drywall queue baffles, framed interior portal, cardboard shrub boxes & hanging cardboard birds!
  const clearKiosk = [{ x: bx, z: bz, r: 1.85 }, { x: mx, z: mz, r: 1.45 }, { x: tx + 0.4, z: tz, r: 1.15 }];
  occluderWall(c, -W * 0.36, 2.35, -0.85, 2.58, { style: 'drywall', keepClear: clearKiosk, h: 2.52 });
  occluderWall(c, 1.85, 0.45, 2.08, Math.min(D / 2 - 1.4, 4.4), { style: 'drywall', keepClear: clearKiosk, h: 2.52 });
  portalWall(c, 0, -Math.min(D / 2 - 2.3, 3.8), true, { kind: 'door', span: 3.3, h: 2.56 });
  placeStageSetClutter(c, [[-2.6, 2.05], [2.45, -2.35]]);
  hangCardboardBirds(c, 0.2, -0.4, 3);
  peeledTurfStrip(c, -0.5, 2.95, true, 1.9);
  ceilingTurfAndLogs(c, 1.2, 0.8, false, 3.4);

  thicket(c, {
    tag: 'kioskgrove',
    ordCap: 112000,
    budget: 92000,
    detCap: 122000,
    detBudget: 108000,
    hub: [mx, mz],
    laneWidth: 1.38,
    spacing: 0.80,
    trees: 38,
    companionStems: 32,
    under: 58,
    hillsOpt: { style: 'rainforest', density: 1.5, maxHeight: 2.15 },
    region: (x, z) => Math.hypot(x - mx, z - mz) > 1.95 && Math.hypot(x - bx, z - bz) > 2.15,
  });

  // Signage & 4th-hand scenic mural
  const spSign = c.wallSpot(1.5, ['back', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      p.parkName || 'SYNERGY PINES',
      'ALL VISITORS MUST BE EXPECTED',
      `PERMIT: ${p.permit || 'Q4-GRASS'}`,
    ], { seed: 31, warn: true });
  }
  const spMural = c.wallSpot(3.1, ['right', 'left', 'back']);
  if (spMural) {
    forestMural(c, spMural.side, spMural.at, 1.46, 2.9, 1.75, 0, 47 + R.int(0, 9));
  }
}
