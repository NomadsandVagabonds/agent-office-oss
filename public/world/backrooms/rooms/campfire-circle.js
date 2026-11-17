// The Backrooms — a room of the Offsite Reserve (`forest`):
// Mandatory Offsite (`campfire-circle` — "the folding chairs and tents around the cellophane campfire").
//
// A ring of split cedar benches and grey office folding chairs surrounds a
// flickering cellophane-and-box-fan "campfire" beneath a soot-blackened ceiling,
// flanked by half-sunken nylon ridge tents (`tentVox`, one with dress shoes
// sticking motionless out the door!).
//
// By the fire stands **The Retreat Facilitator** (`makeFacilitatorRig` +
// `stepFacilitator`): she walks up offering a glowing coat-hanger roasted
// skewer (`[E]` accepts it, healing `+1 heart` up to 2 times!). Turn your back
// within 4.5 m for 1.35 s, sprint away mid-pitch, or stall 13.5 s, and her clay
// grin head swivels 180° backwards like an owl before she lunges for 1 heart!

import { Batch } from '../kit.js';
import { clamp, turnTo } from '../bits.js';
import { furnitureClear } from '../furniture-rules.js';
import {
  forestRoom, woodlandLight, placeVox, placeVoxStack, trailSign, forestMural,
  tentVox, backpackVox, campLanternVox, makeFacilitatorRig, ensureForestDetail,
} from '../forest.js';
import { thicket } from '../forest-thicket.js';
import { buildBlindRingMaze, addMistVeils } from '../forest-maze.js';
import {
  cellophaneFireVox, splitLogBenchVox, mushroomRingVox, fallenNurseLogVox,
  campCotVox, rottingBinderPileVox,
} from '../forest-models.js';
import { FACILITATOR, makeFacilitator, stepFacilitator, snipFacilitator } from '../forest.rule.js';

export function build(c) {
  const { W, D, H, R, kit } = c;
  c.shell({ panels: false });
  woodlandLight(c, 3, 3, 1, 0.88, { mode: 'ember', shaftTint: [1.0, 0.78, 0.44] });
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false, thicket: false });

  // 1. Sculpted River-Cobble, Desk-Fan & Cellophane "Campfire" (`cellophaneFireVox`) + Flickering Flame Tip + Ceiling Soot!
  placeVox(c, 'forest:cellofire', cellophaneFireVox(), 0, 0, { scale: 0.034 });
  const flameB = new Batch();
  flameB.box(-0.10, 0.55, -0.03, 0.10, 0.98, 0.03, [1.0, 0.52, 0.14]);
  flameB.box(-0.03, 0.55, -0.10, 0.03, 0.94, 0.10, [1.0, 0.82, 0.26]);
  const flameMesh = c.dynamic(flameB, { pivot: [0, 0.55, 0], unlit: true });
  c.light(0, 0.85, 0, '#ff8826', 1.18, { bank: 3, k: 1.8, far: 8.2 });
  c.blot(0, 0, 3.0, 3.0, { rgb: [0.02, 0.02, 0.02], a: 0.78, y: H - 0.005, down: true });
  c.blot(0, 0, 1.6, 1.6, { rgb: [0.06, 0.04, 0.02], a: 0.55 });
  c.solid(-0.52, -0.52, 0.52, 0.52);
  c.reserve(0, 0, 1.25);

  c.tick((_dt, t) => {
    flameMesh.scale.y = 0.86 + 0.24 * Math.sin(t * 14) + 0.10 * Math.cos(t * 23);
    flameMesh.rotation.y = Math.sin(t * 6.0) * 0.28;
  });

  // 2. Ring of Sculpted Bark-On Split-Cedar Log Benches (`splitLogBenchVox`) + Sunken Office Chairs!
  const voxEntries = [];
  for (const ang of [0.62, 2.52, 3.76, 5.66]) {
    const lx = Math.cos(ang) * 2.25, lz = Math.sin(ang) * 2.25;
    if (!c.clear(lx, lz, 0.75)) continue;
    voxEntries.push({
      key: 'forest:bench:splitlog',
      make: splitLogBenchVox(),
      x: lx,
      y: 0,
      z: lz,
      rot: -ang + Math.PI / 2,
      scale: 0.03,
    });
    const tx = -Math.sin(ang) * 0.62, tz = Math.cos(ang) * 0.62;
    c.solid(
      Math.min(lx - tx, lx + tx) - 0.18, Math.min(lz - tz, lz + tz) - 0.18,
      Math.max(lx - tx, lx + tx) + 0.18, Math.max(lz - tz, lz + tz) + 0.18
    );
    c.reserve(lx, lz, 0.95);
  }
  // Two office swivel chairs dragged out into the trust circle, half-sinking into the moss!
  for (const [cx, cz] of [[-2.15, 0.0], [2.15, 0.0]]) {
    if (c.clear(cx, cz, 0.45)) {
      c.prop('chair', cx, cz, { y: -0.08, rot: Math.atan2(-cx, -cz), o: { color: '#2b5440' } });
      c.reserve(cx, cz, 0.55);
    }
  }

  // 3. Consolidated `placeVoxStack` of Nylon Ridge Tents (one half-sunk with dress shoes!), Packs, Lanterns & Mushrooms
  const tentSpots = [
    [-3.6, -3.4, '#d47a28', true, -0.18, 0.65],
    [3.6, -3.3, '#2b6e58', false, 0, -0.65],
    [-3.5, 3.3, '#8a5a2b', false, -0.06, 2.35],
  ];
  for (const [tx, tz, col, shoes, yOff, rot] of tentSpots) {
    if (!c.clear(tx, tz, 0.95)) continue;
    voxEntries.push({
      key: `forest:camp:tent:${col}:${shoes ? 1 : 0}`,
      make: tentVox(col, shoes),
      x: tx,
      y: yOff,
      z: tz,
      rot,
      scale: 0.028,
    });
    c.blot(tx, tz, 2.0, 2.0, { rgb: [0.05, 0.06, 0.03], a: 0.48 });
    c.solid(tx - 0.55, tz - 0.65, tx + 0.55, tz + 0.65);
    c.reserve(tx, tz, 1.15);
  }
  voxEntries.push(
    { key: 'forest:camp:pack1', make: backpackVox('#c98a26'), x: -1.55, y: 0, z: -2.65, rot: 0.5 },
    { key: 'forest:camp:pack2', make: backpackVox('#b84b28'), x: 1.75, y: 0, z: -2.55, rot: -0.8 },
    { key: 'forest:camp:lantern', make: campLanternVox(), x: 1.35, y: 0, z: 2.35, scale: 0.028 },
    { key: 'forest:under:log', make: fallenNurseLogVox(), x: 3.15, y: 0, z: 2.25, rot: -0.45, scale: 0.03 },
  );
  c.solid(2.9, 1.6, 3.4, 2.9);
  c.reserve(3.15, 2.25, 0.9);
  placeVoxStack(c, 'forest:campfire:tents', voxEntries);

  // `detail: true` collapsed camp cot, rotting offsite binders & mushroom ring around the campfire!
  const det = ensureForestDetail(c);
  det.pushVox({ key: 'forest:detail:mushrooms', make: mushroomRingVox(), x: -2.65, y: 0, z: 1.55, rot: 1.1, scale: 0.03 });
  det.pushVox({ key: 'forest:detail:cot', make: campCotVox(), x: 2.75, y: 0, z: -1.25, rot: -0.4, scale: 0.027 });
  det.pushVox({ key: 'forest:detail:binders', make: rottingBinderPileVox(), x: -1.45, y: 0, z: 2.45, rot: 0.65, scale: 0.028 });

  // Enclose the trust circle behind staggered 2.40 m Olive-Tarp Orientation Baffles & Hedgerows (`tall: true`)
  // so visitors enter down blind canvas/pine chutes before meeting the Retreat Facilitator!
  c.reserve(0, -1.65, 1.1); // keep Facilitator's home spot open
  buildBlindRingMaze(c, {
    style: 'tarp',
    outerStyle: 'hedge',
    rInner: 3.15,
    h: 2.40,
    keepClear: [{ x: 0, z: 0, r: 2.85 }, { x: 0, z: -1.65, r: 1.15 }],
  });
  addMistVeils(c, [
    { x0: -3.2, z0: 1.8, x1: -1.6, z1: 1.8 },
    { x0: 1.6, z0: -1.8, x1: 3.2, z1: -1.8 },
  ], { color: [0.14, 0.12, 0.08], alpha: 0.58 });

  thicket(c, {
    tag: 'camprim',
    ordCap: 108000,
    budget: 62000,
    laneWidth: 1.45,
    region: (x, z) => Math.hypot(x, z) > 3.55,
  });

  // ---- Entity: THE RETREAT FACILITATOR --------------------------------------
  const homeLx = 0, homeLz = -1.65;
  c.reserve(homeLx, homeLz, 0.75);

  const rig = makeFacilitatorRig(kit, 'camp');
  const homeW = c.toWorld(homeLx, homeLz);
  const faceW = c.toWorld(0, 0);
  const baseYaw = Math.atan2(faceW.x - homeW.x, faceW.z - homeW.z);
  rig.group.rotation.y = baseYaw;

  let state = makeFacilitator();
  let stride = 0;
  let pendingTake = false;
  let known = false;
  let over = false;

  // Dynamic `[E]` prompt moving with the Facilitator when she holds out a roasted skewer!
  const takeUse = c.use({
    x: homeLx,
    z: homeLz,
    r: 1.85,
    label: 'accept toasted ration',
    when: () => state.mode === 'offer' && state.rations > 0 && !over,
    use: () => { pendingTake = true; },
  });

  function stepWalker(walker, tx, tz, dist) {
    const stand = (wx, wz) => {
      if (c.world.roomAt(wx, wz) !== c.rt) return false;
      const loc = c.toLocal(wx, wz);
      if (Math.abs(loc.x) > W / 2 - 0.6 || Math.abs(loc.z) > D / 2 - 0.6) return false;
      if (Math.hypot(loc.x, loc.z) < 0.85) return false; // step round the central fire!
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
      for (const turn of [0, 0.5, -0.5, 1.05, -1.05, 1.6, -1.6]) {
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

  // Custom 3-second CCTV ending: The Retreat Facilitator stands smiling over the visitor by the campfire!
  c.rt.takes = (shot) => {
    over = true;
    const fig = shot.figure;
    c.env.play?.('whistle', roamer.x, roamer.z, 11);
    let clock = 0;
    return (t, dt) => {
      clock += dt;
      rig.pose({ mode: 'lunge', stride: clock * 5, headYaw: Math.PI * Math.sin(clock * 2.5), time: clock });
      if (!fig) return;
      const e = Math.min(1, t / 0.5);
      fig.rotation.x = -1.25 * e;
      fig.position.y = shot.y - 0.52 * e;
    };
  };

  c.rt.films = (shot) => {
    const yaw = rig.group.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const side of [1, -1]) {
      const x = roamer.x + fz * side * 2.8 + fx * 0.4;
      const z = roamer.z - fx * side * 2.8 + fz * 0.4;
      if (c.world.roomAt(x, z) === c.rt && c.world.los(x, z, roamer.x, roamer.z)) {
        return {
          x,
          y: Math.max(shot.y, c.room.y || 0) + 1.45,
          z,
          at: { x: roamer.x, y: (roamer.y ?? shot.y) + 1.05, z: roamer.z },
        };
      }
    }
    return null;
  };

  const roamer = c.env.denizens?.add({
    id: 'retreat-facilitator',
    x: homeW.x,
    y: c.room.y || 0,
    z: homeW.z,
    r: 0.30,
    tall: 1.68,
    heading: baseYaw,
    group: rig.group,
    light: (rgb) => rig.light(rgb),
    snipTarget: () => (state.mode === 'lunge' || state.mode === 'offer' ? { id: 'retreat-facilitator', r: 0.45, priority: 2 } : false),
    snip() {
      if (!known) { known = true; c.met('retreat-facilitator'); }
      state = snipFacilitator(state);
      c.env.play?.('snip', roamer.x, roamer.z, 8);
      c.survived('retreat-facilitator');
      return { ok: true, target: 'retreat-facilitator' };
    },
    update(dt, time, me) {
      if (over) return;
      const inRoom = c.world.current() === c.rt;
      const dist = Math.hypot(me.x - roamer.x, me.z - roamer.z);
      const rLoc = c.toLocal(roamer.x, roamer.z);
      const atHome = Math.hypot(rLoc.x - homeLx, rLoc.z - homeLz) < 0.38;
      const speedNow = Math.hypot(me.vx || 0, me.vz || 0);
      const watched = inRoom && !!c.env.sees?.(roamer.x, roamer.z, { radius: 0.55 });

      if (!known && watched && dist < 9) {
        known = true;
        c.met('retreat-facilitator');
      }

      // Check if visitor has turned their back on her (`facingDot < -0.15`)
      const toFacX = (roamer.x - me.x) / (dist || 1), toFacZ = (roamer.z - me.z) / (dist || 1);
      const lookX = -Math.sin(me.yaw), lookZ = -Math.cos(me.yaw);
      const turnedBack = (toFacX * lookX + toFacZ * lookZ) < -0.15;
      const sprinting = speedNow > 2.65 && turnedBack;

      const tookNow = pendingTake;
      pendingTake = false;

      const res = stepFacilitator(state, dt, {
        inside: inRoom,
        dist,
        atHome,
        took: tookNow,
        turnedBack,
        sprinting,
      });
      state = res.state;

      if (res.event === 'healed') {
        if (!known) { known = true; c.met('retreat-facilitator'); }
        c.env.health?.heal?.(1);
        c.env.play?.('ding', roamer.x, roamer.z, 8);
        c.survived('retreat-facilitator');
      } else if (res.event === 'snapped') {
        if (!known) { known = true; c.met('retreat-facilitator'); }
        c.env.play?.('whistle', roamer.x, roamer.z, 12);
        c.env.interfere?.(0.55);
      } else if (res.event === 'hit') {
        if (!known) { known = true; c.met('retreat-facilitator'); }
        c.env.play?.('thunk', roamer.x, roamer.z, 10);
        c.env.interfere?.(0.88);
        const hit = c.hurt(FACILITATOR.hurt);
        if (hit?.ended) { over = true; return; }
        if (hit?.landed) {
          c.env.hud?.glitch?.(0.5);
          c.survived('retreat-facilitator');
        }
      }

      if (res.speed > 0.02) {
        const goal = state.mode === 'rest' || state.mode === 'recoil' ? homeW : { x: me.x, z: me.z };
        const went = stepWalker(roamer, goal.x, goal.z, res.speed * dt);
        stride += went * 3.1;
        const wantYaw = went > 1e-4 ? roamer.heading : Math.atan2(goal.x - roamer.x, goal.z - roamer.z);
        rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 5.2, dt * 5.2);
      } else if (inRoom) {
        const faceMe = Math.atan2(me.x - roamer.x, me.z - roamer.z);
        rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, faceMe), -dt * 4.5, dt * 4.5);
      }

      // Keep interactive `[E]` offer prompt glued to her world position!
      if (takeUse) {
        takeUse.wx = roamer.x;
        takeUse.wz = roamer.z;
      }

      // Uncanny detail: when your back is turned, her clay grin head twists 180° owl-style!
      const headYaw = state.backTimer > 0.25 ? Math.PI * Math.min(1, state.backTimer / 0.8) : 0;
      rig.pose({ mode: state.mode, stride, headYaw, time, waited: state.waited });
    },
  });

  c.rt.facilitator = { get state() { return state; }, roamer, rig };

  const spSign = c.wallSpot(1.55, ['front', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      'MANDATORY CAMPFIRE',
      'ATTENDANCE IS BEING TAKEN',
    ], { seed: 109, warn: true });
  }
  const spMural = c.wallSpot(3.0, ['back', 'left', 'right']);
  if (spMural) forestMural(c, spMural.side, spMural.at, 1.48, 2.9, 1.75, 2, 113 + R.int(0, 9));
}
