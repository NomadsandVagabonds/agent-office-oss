// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Cathedral Stand (`old-growth` — "the seventy-tree dark hemlock labyrinth and the bark-mimic auditor").
//
// Extreme old-growth tree density (`big: true`): 60–75 shoulder-to-shoulder
// fluted hemlock and paper-birch columns (`denseHemlockVox`, `denseBirchStemVox`)
// fill a 6-metre-high office hall from wall to wall, woven with bioluminescent
// cyan-green server fiber-optic veins, hanging ID-badge wind chimes, a dark
// forest spring pool (`buildForestWater`), and narrow volumetric god-rays.
//
// Winding through the wall of bark is a 1.55 m mossy deer-path. Somewhere among
// the trunks stands **The Timber Auditor** (`timberAuditorVox` + `stepAuditor`):
// while watched or held in a flashlight beam (`inFlashlight`) it freezes into an
// ordinary barcoded tree trunk; look away or brush a hanging lanyard chime and
// it stalks silently between the columns!

import { Batch } from '../kit.js';
import { inFlashlight } from '../flashlight.js';
import { furnitureClear } from '../furniture-rules.js';
import {
  forestRoom, woodlandLight, trailSign, registerCallTarget,
  makeVoxGroup, placeVoxStack, buildForestWater, peatWaterTex,
  ensureForestDetail, campLanternVox, stumpVox,
  CEDAR_TIMBER, BRASS_TRIM,
} from '../forest.js';
import { thicket, keepLane } from '../forest-thicket.js';
import { buildBlindRingMaze, occluderWall, addMistVeils } from '../forest-maze.js';
import {
  timberAuditorVox, overgrownDeskVox, mushroomRingVox,
} from '../forest-models.js';
import { AUDITOR, makeAuditor, stepAuditor, snipAuditor } from '../forest.rule.js';

export function build(c) {
  const { W, D, H, R, kit, params: p } = c;
  c.shell({ panels: false });
  woodlandLight(c, 4, 4, 1, 0.94, {
    mode: 'islands',
    deadRatio: 0.52,
    shaftTint: [0.58, 0.98, 0.78],
    shaftStrength: 0.16,
    maxShafts: 6,
  });
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false, thicket: false });

  // Build a disorienting 2.75 m tall Hedgerow & Overgrown-Cubicle Labyrinth (`tall: true`)
  // with offset gaps & drifting mist veils so you NEVER see > 4 m or survey the Timber Auditor!
  c.reserve(0, 0, 1.85);
  buildBlindRingMaze(c, {
    style: 'drywall',
    outerStyle: 'hedge',
    rInner: 2.75,
    h: 2.75,
    keepClear: [{ x: 0, z: 0, r: 2.15 }],
  });
  // Two extra dogleg choke-baffles forcing tight 90° blind turns in the outer ring!
  occluderWall(c, -W * 0.28, -0.12, -W * 0.14, 0.12, { style: 'drywall', h: 2.68 });
  occluderWall(c, W * 0.14, -0.22, W * 0.28, 0.22, { style: 'hedge', h: 2.65 });

  const wx = W * 0.22, wz = D * 0.22;
  addMistVeils(c, [
    { x0: -wx - 1.1, z0: wz * 0.55, x1: -wx + 1.1, z1: wz * 0.55 },
    { x0: wx - 1.1, z0: -wz * 0.55, x1: wx + 1.1, z1: -wz * 0.55 },
    { x0: -1.2, z0: -wz, x1: 1.2, z1: -wz },
    { x0: -1.2, z0: wz, x1: 1.2, z1: wz },
  ], { color: [0.06, 0.15, 0.10], alpha: 0.68 });

  // Reserve narrow winding footpath connecting doorways, blind gaps & SE stash so trees pack right up to both shoulders!
  keepLane(c, 0, D / 2 - 1.1, -wx, wz * 0.85, 1.32);
  keepLane(c, -wx, wz * 0.85, 0, 0, 1.32);
  keepLane(c, 0, 0, wx, -wz * 0.85, 1.32);
  keepLane(c, wx, -wz * 0.85, 0, -D / 2 + 1.1, 1.32);
  keepLane(c, wx, wz * 0.5, W / 2 - 1.05, D / 2 - 1.05, 1.28);
  for (const dr of c.room.doors) {
    const dp = c.doorPoint(dr, 0.55);
    keepLane(c, dp.x, dp.z, Math.sign(dp.x) * wx * 0.8, Math.sign(dp.z) * wz * 0.8, 1.34);
  }

  // Central Mossy Server-Hollow Shrine (`0, 0`) + Dark Bioluminescent Spring Pool!
  buildForestWater(
    c,
    [{ x0: -1.65, z0: -1.85, x1: 0.45, z1: -0.25, depth: 0.14, waterY: 0.016 }],
    {
      map: peatWaterTex(kit, 'deep'),
      shallowHex: '#1c4232',
      deepHex: '#04120c',
      foamHex: '#5ee8a0',
    }
  );
  const shrineEntries = [
    { key: 'forest:shrine:desk', make: overgrownDeskVox(), x: 0.75, y: 0, z: 0.35, rot: -0.55, scale: 0.032 },
    { key: 'forest:shrine:stump', make: stumpVox(6), x: -0.55, y: 0, z: 0.85, rot: 0.4, scale: 0.031 },
    { key: 'forest:shrine:lantern', make: campLanternVox(), x: -0.55, y: 0.46, z: 0.85, scale: 0.027 },
  ];
  c.solid(0.25, -0.15, 1.25, 0.85);
  c.solid(-0.85, 0.55, -0.25, 1.15);
  placeVoxStack(c, `forest:oldgrowth:shrine:${c.room.id}`, shrineEntries);
  c.light(0, 0.95, 0, '#4affb0', 0.85, { bank: 3, k: 1.8, far: 7.2 });
  c.leave('tape', 0.65, 0.32, { y: 0.72 });
  c.leave('battery', 0.92, 0.42, { y: 0.62 });

  const det = ensureForestDetail(c);
  det.pushVox({ key: 'forest:detail:mushrooms', make: mushroomRingVox(), x: 1.35, y: 0, z: -0.65, rot: 0.9, scale: 0.03 });

  // 4 Hanging Conference-Lanyard Wind Chimes along the winding deer-path!
  let pendingChime = null;
  const chimeCoords = [
    [-wx, wz * 0.65],
    [wx * 0.9, -wz * 0.65],
    [-wx * 0.85, -wz * 0.75],
    [wx, wz * 0.75],
  ];
  const chimeMeshes = chimeCoords.map(([cx, cz], idx) => {
    const b = new Batch();
    // Overhead branch arm + 3 hanging plastic ID badges & brass chimes at head height
    b.box(cx - 0.26, 2.15, cz - 0.03, cx + 0.26, 2.21, cz + 0.03, CEDAR_TIMBER);
    for (const ox of [-0.18, 0, 0.18]) {
      b.box(cx + ox - 0.008, 1.52, cz - 0.008, cx + ox + 0.008, 2.15, cz + 0.008, [0.18, 0.45, 0.62]);
      b.box(cx + ox - 0.035, 1.38, cz - 0.006, cx + ox + 0.035, 1.52, cz + 0.006, ox === 0 ? BRASS_TRIM : [0.90, 0.88, 0.82]);
    }
    const m = c.dynamic(b, { pivot: [cx, 2.18, cz] });
    c.zone({
      x0: cx - 0.55, z0: cz - 0.55, x1: cx + 0.55, z1: cz + 0.55,
      enter: () => {
        const w = c.toWorld(cx, cz);
        c.env.play?.('ring', w.x, w.z, 11);
        c.env.play?.('clack', w.x, w.z, 8);
        pendingChime = { x: cx, z: cz, idx };
      },
    });
    return { m, idx, swing: 0 };
  });

  // Sounding the Trail Call (`call`) whistle rings the far NW decoy chime to pull the Auditor off the shrine!
  registerCallTarget(c, chimeCoords[2][0], chimeCoords[2][1], () => {
    const [dx, dz] = chimeCoords[2];
    const w = c.toWorld(dx, dz);
    c.env.play?.('ring', w.x, w.z, 14);
    pendingChime = { x: dx, z: dz, idx: 2 };
  }, { r: 16 });

  // ---- Ultra-Dense Wall-to-Wall Old-Growth Hemlock & Birch Stand + PNW Hills ----
  const homeX = -wx * 0.45, homeZ = -wz * 0.85;
  c.reserve(homeX, homeZ, 0.72);
  for (const [cx, cz] of chimeCoords) c.reserve(cx, cz, 0.72);

  const grove = thicket(c, {
    tag: 'cathedral',
    big: true,
    ordCap: 230000,
    budget: 204000,
    detCap: 245000,
    detBudget: 205000,
    hub: null,
    fiberGlow: true,
    spacing: 0.78,
    trees: 66,
    companionStems: 56,
    under: 74,
    hillsOpt: { style: 'rainforest', density: 1.45, maxHeight: 2.24 },
    species: { sweeping: 3, hemlock: 5, birchStem: 4 },
  });
  c.rt.treeCount = grove.trees.length + grove.companions;

  // ---- Bark-Mimic Entity: THE TIMBER AUDITOR (`timberAuditorVox`) -----------
  const auditorRig = makeVoxGroup(kit, 'forest:auditor', timberAuditorVox(), 0.028, { room: c.rt.u });
  const homeW = c.toWorld(homeX, homeZ);
  let auditor = makeAuditor(homeX, homeZ);
  let known = false;
  let stride = 0;
  let restLevel = null;

  function moveAuditor(walker, tx, tz, dist) {
    const stand = (wx, wz) => {
      if (c.world.roomAt(wx, wz) !== c.rt) return false;
      const loc = c.toLocal(wx, wz);
      if (Math.abs(loc.x) > W / 2 - 0.55 || Math.abs(loc.z) > D / 2 - 0.55) return false;
      if (!c.world.free(wx, wz, walker.r, { ghost: true })) return false;
      if (!furnitureClear(c.world, walker.x, walker.z, wx, wz, walker.r)) return false;
      return true;
    };
    let went = 0, rem = dist;
    while (rem > 1e-3) {
      const dx = tx - walker.x, dz = tz - walker.z, d = Math.hypot(dx, dz);
      if (d < 0.02) break;
      const s = Math.min(rem, d, 0.08);
      let moved = false;
      for (const turn of [0, 0.5, -0.5, 1.0, -1.0, 1.55, -1.55]) {
        const cs = Math.cos(turn), sn = Math.sin(turn);
        const ux = (dx * cs - dz * sn) / d, uz = (dx * sn + dz * cs) / d;
        const nx = walker.x + ux * s, nz = walker.z + uz * s;
        if (stand(nx, nz)) {
          walker.x = nx; walker.z = nz; walker.heading = Math.atan2(ux, uz);
          went += s; moved = true; break;
        }
      }
      if (!moved) break;
      rem -= s;
    }
    return went;
  }

  const roamer = c.env.denizens?.add({
    id: 'timber-auditor',
    x: homeW.x,
    y: c.room.y || 0,
    z: homeW.z,
    r: 0.24,
    tall: 2.1,
    heading: 0,
    group: auditorRig,
    light: (rgb) => auditorRig.userData.light(rgb),
    snipTarget: () => (auditor.mode === 'cool' ? false : { id: 'timber-auditor', r: 0.46, priority: 2 }),
    snip() {
      if (!known) { known = true; c.met('timber-auditor'); }
      auditor = snipAuditor(auditor);
      c.env.play?.('snip', roamer.x, roamer.z, 8);
      c.env.play?.('crack', roamer.x, roamer.z, 8);
      c.survived('timber-auditor');
      return { ok: true, target: 'timber-auditor' };
    },
    update(dt, time, me) {
      const inRoom = c.world.current() === c.rt;
      const aLoc = c.toLocal(roamer.x, roamer.z);
      const pLoc = c.toLocal(me.x, me.z);
      const watched = inRoom && !!c.env.sees?.(roamer.x, roamer.z, { radius: 0.35 }) && c.world.los(me.x, me.z, roamer.x, roamer.z);
      const torchPow = c.env.inventory?.torchPower?.() || 0;
      const litByBeam = inRoom && inFlashlight(
        { x: me.x, y: me.y, z: me.z, yaw: me.yaw, pitch: me.pitch || 0, mounted: !!c.env.inventory?.mounted?.() },
        roamer,
        { power: torchPow, los: c.world.los(me.x, me.z, roamer.x, roamer.z), bottom: 0.3, top: 2.0, radius: 0.24 }
      );

      if (!known && watched && Math.hypot(me.x - roamer.x, me.z - roamer.z) < 8.5) {
        known = true;
        c.met('timber-auditor');
      }

      // (how lit the room is, of how lit it is at rest: 1 in its ordinary light, which is steady now, so the Auditor's
      // boost in the dark bites only when something really darkens the room. It used to be the banks' bare mean, which
      // at rest here is 0.51, under the rule's 0.55: a boost that was always on)
      const mean = c.rt.lightLevels ? (c.rt.lightLevels[0] + c.rt.lightLevels[1] + c.rt.lightLevels[2]) / 3 : 1;
      if (restLevel === null && mean > 0) restLevel = mean;
      const bankLv = (restLevel ? mean / restLevel : 1) * (c.rt.lightsK ?? 1);
      const chimeNow = pendingChime;
      pendingChime = null;

      const step = stepAuditor(auditor, dt, {
        inside: inRoom,
        px: pLoc.x,
        pz: pLoc.z,
        ax: aLoc.x,
        az: aLoc.z,
        watched,
        inBeam: litByBeam,
        chimePos: chimeNow,
        bankLevel: bankLv,
      });
      auditor = step.state;

      if (step.event === 'creak') {
        c.env.play?.('creak', roamer.x, roamer.z, 9);
      }
      if (step.event === 'struck') {
        c.env.play?.('crack', roamer.x, roamer.z, 10);
        c.env.interfere?.(0.8);
        const hit = c.hurt(AUDITOR.hurt);
        if (hit?.landed) {
          c.env.hud?.glitch?.(0.5);
          if (known) c.survived('timber-auditor');
        }
      }
      if (step.speed > 0.01) {
        const goalW = c.toWorld(auditor.goalX, auditor.goalZ);
        const moved = moveAuditor(roamer, goalW.x, goalW.z, step.speed * dt);
        stride += moved * 3.4;
        auditorRig.rotation.y = roamer.heading;
        auditorRig.position.y = Math.abs(Math.sin(stride)) * 0.035;
      } else {
        auditorRig.position.y = 0;
      }
      void time;
    },
  });

  if (!roamer) {
    c.add(auditorRig);
    auditorRig.position.set(homeX, 0, homeZ);
  }

  c.tick((dt, t) => {
    for (const ch of chimeMeshes) {
      ch.m.rotation.z = Math.sin(t * 2.1 + ch.idx * 1.4) * 0.05;
    }
    void dt;
  });

  const spSign = c.wallSpot(1.55, ['front', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      `OLD GROWTH STAND ${p.standCode || 'OG-09'}`,
      'ALL STEMS ARE ACCOUNTED FOR',
    ], { seed: 211 + R.int(0, 9), warn: true });
  }
}
