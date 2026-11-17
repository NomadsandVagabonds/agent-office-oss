// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Clear-Cut (`timber-lot` — "the sunken peat channel and the stag among the coat-racks").
//
// Centerpiece hunter room: a flooded peat-bog channel cuts across the clear-cut
// between barcoded lumber stacks, ceiling-piercing pine trunks, dry bracken beds,
// and two Notched Hollow Trunks (`notchedTimber`) that lean and crash down as
// dry log bridges.
//
// Standing upright among real wooden office coat-racks is **The Coat-Rack Buck**
// (`stag.js`): shine a direct torch beam on it, crunch upright through dry
// bracken, or crowd its personal space, and it scrapes a castor hoof for 0.85 s
// before charging straight at 5.7 m/s! Sidestep behind a trunk so its 10-point
// brass coat-hook antlers slam and wedge for 3.4 s, or sound the Trail Call
// (`call`) whistle to lure it toward the brass Echo Bell Post.

import * as THREE from 'three';
import { clamp, turnTo } from '../bits.js';
import { furnitureClear } from '../furniture-rules.js';
import {
  forestRoom, woodlandLight, installForestFloor, notchedTimber,
  registerCallTarget, placeVoxStack, trailSign, forestMural,
  stumpVox, plenumBreach, castCanopyShadow, ensureForestDetail,
  CEDAR_TIMBER, BRASS_TRIM,
} from '../forest.js';
import { thicket, keepLane } from '../forest-thicket.js';
import { occluderWall, addMistVeils } from '../forest-maze.js';
import {
  gnarledPineVox, gnarledBirchVox, drownedWorkstationVox, cattailReedsVox,
} from '../forest-models.js';
import { BUCK, makeBuck, stepBuck, snipBuck } from '../forest.rule.js';
import { makeCoatRackBuckRig } from '../stag.js';

export function build(c) {
  const { W, D, H, R, params: p, kit } = c;
  c.shell({ panels: false, floor: false });
  woodlandLight(c, 4, 3, 1, 1.04, { mode: 'canopy' });
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false });

  // Sunken peat channel through the middle, leaving generous 2.4 m dry perimeter banks
  // all round the room so every doorway connects cleanly AND can be crossed dry once bridged!
  const bogX0 = -W / 2 + 2.45, bogX1 = W / 2 - 2.45;
  const bogZ0 = -1.65, bogZ1 = 1.65;
  const bogs = [{ x0: bogX0, z0: bogZ0, x1: bogX1, z1: bogZ1, depth: 0.40, waterY: -0.06 }];

  // Dry rustling bracken patches flanking the slough (crouch [C] to step silently!)
  const brackens = [
    { x0: -3.6, z0: 2.05, x1: -0.6, z1: Math.min(D / 2 - 1.2, 4.4) },
    { x0: 0.8, z0: -Math.min(D / 2 - 1.2, 4.4), x1: 3.8, z1: -2.05 },
  ];

  // Two Notched Hollow Trunks on opposite banks ready to be leaned on (`marks.js` `lean`)
  // so they crash right across the 3.3 m peat channel as dry bridges!
  notchedTimber(c, { x: -1.85, z: bogZ1 + 0.25, dirX: 0, dirZ: -1, length: 3.85, bridgeY: 0.12 });
  notchedTimber(c, { x: 1.85, z: bogZ0 - 0.25, dirX: 0, dirZ: 1, length: 3.85, bridgeY: 0.12 });

  installForestFloor(c, { cutFloor: true, bogs, brackens });

  // Brass Echo Bell Post on the far +X bank (`bellX, bellZ`): pressing [E] at it OR blowing
  // the Trail Call (`call`) whistle anywhere within 13 m rings an acoustic decoy echo here!
  const bellX = Math.min(W / 2 - 1.65, 5.2), bellZ = 2.45;
  c.flat.box(bellX - 0.06, 0, bellZ - 0.06, bellX + 0.06, 1.48, bellZ + 0.06, CEDAR_TIMBER, { skip: '-y' });
  c.flat.box(bellX - 0.14, 1.44, bellZ - 0.14, bellX + 0.14, 1.54, bellZ + 0.14, CEDAR_TIMBER);
  c.flat.ball(bellX, 1.30, bellZ, 0.11, BRASS_TRIM, 1.2, 7);
  c.solid(bellX - 0.10, bellZ - 0.10, bellX + 0.10, bellZ + 0.10);
  c.reserve(bellX, bellZ, 0.55);

  let callPulse = null;
  const ringDecoyBell = () => {
    const bw = c.toWorld(bellX, bellZ);
    c.env.play?.('ring', bw.x, bw.z, 14);
    callPulse = { x: bellX, z: bellZ, age: 0 };
  };
  c.use({ x: bellX, z: bellZ, r: 1.55, label: 'ring decoy bell', use: ringDecoyBell });
  registerCallTarget(c, bellX, bellZ, () => {
    const bw = c.toWorld(bellX, bellZ);
    c.env.play?.('ring', bw.x, bw.z, 14);
    callPulse = { x: bellX, z: bellZ, age: 0 };
  }, { r: 14 });

  // Consolidated grove of full-AO sculpted pine/birch trunks (built to dodge & wedge the Buck's antlers!)
  const treeSpots = [
    [-3.4, -3.2], [0.2, -3.5], [3.5, -3.1],
    [-3.5, 3.1], [0.4, 3.4],
  ];
  const voxEntries = [];
  const lotScale = 0.038;
  const tallVox = Math.max(88, Math.round((H + 0.18) / lotScale));
  treeSpots.forEach(([tx, tz], i) => {
    if (Math.abs(tx) > W / 2 - 1.2 || Math.abs(tz) > D / 2 - 1.2 || !c.clear(tx, tz, 0.55)) return;
    plenumBreach(c, tx - 0.15, tz - 0.15, 1, i + 17);
    castCanopyShadow(c, tx, tz, 1.45, i + 9);
    voxEntries.push({
      key: i % 2 ? `forest:lot:birch:${tallVox}` : `forest:lot:pine:${tallVox}`,
      make: i % 2 ? gnarledBirchVox(tallVox) : gnarledPineVox(tallVox, true),
      x: tx,
      y: 0,
      z: tz,
      rot: i * 1.15,
      scale: lotScale,
    });
    c.solid(tx - 0.25, tz - 0.25, tx + 0.25, tz + 0.25, { tall: true });
    c.reserve(tx, tz, 0.55);
  });

  // Drowned workstation + cattails inside the peat channel!
  voxEntries.push({ key: 'forest:drowned:ws', make: drownedWorkstationVox(), x: 0.15, y: -0.36, z: 0.05, rot: 0.85, scale: 0.032, tilt: [0.10, -0.08] });
  c.light(0.15, 0.22, 0.05, '#4dff88', 0.65, { bank: 3, k: 1.6, far: 5.5 });
  const det = ensureForestDetail(c);
  for (const [rx, rz, rot] of [[-2.9, -0.9, 0.4], [2.9, 0.85, 2.2], [-0.8, 1.0, 1.4], [1.2, -1.0, 3.1]]) {
    if (Math.abs(rx) < bogX1 - 0.35) det.pushVox({ key: 'forest:detail:reeds', make: cattailReedsVox(), x: rx, y: -0.08, z: rz, rot, scale: 0.030 });
  }

  // Cut stumps & decoy wooden coat-racks
  for (const [sx, sz, rings] of [[-4.8, 0.2, 5], [4.8, -0.3, 3]]) {
    if (Math.abs(sx) < W / 2 - 1.0 && c.clear(sx, sz, 0.45)) {
      voxEntries.push({ key: `forest:stump:${rings}`, make: stumpVox(rings), x: sx, y: 0, z: sz, rot: rings });
      c.solid(sx - 0.26, sz - 0.26, sx + 0.26, sz + 0.26);
    }
  }
  if (voxEntries.length) placeVoxStack(c, 'forest:lot:grove', voxEntries);

  // Build a claustrophobic Tagged-Lumberyard Cordwood Maze (`tall: true`) on both dry banks
  // so you NEVER see the Coat-Rack Buck across the room — you round narrow lumber alleys!
  const buckHomeGuess = p.buckSide ? p.buckSide * 1.65 : -1.45;
  const kc = [
    { x: -1.85, z: bogZ1 + 0.35, r: 1.15 },
    { x: 1.85, z: bogZ0 - 0.35, r: 1.15 },
    { x: bellX, z: bellZ, r: 1.10 },
    { x: buckHomeGuess, z: -2.65, r: 1.25 },
  ];
  // South bank (`z > 1.85`) staggered cordwood racks blocking cross-channel sightlines!
  occluderWall(c, -4.8, 3.15, -2.55, 3.68, { style: 'cordwood', keepClear: kc, h: 2.45 });
  occluderWall(c, -0.55, 2.35, 2.45, 2.88, { style: 'cordwood', keepClear: kc, h: 2.45 });
  occluderWall(c, 3.35, 3.65, 3.88, Math.min(D / 2 - 1.3, 6.8), { style: 'cubicle', keepClear: kc, h: 2.32 });
  // North bank (`z < -1.85`) blind lumber bays hiding the Coat-Rack Buck!
  occluderWall(c, -3.15, -3.95, -0.25, -3.42, { style: 'cordwood', keepClear: kc, h: 2.45 });
  occluderWall(c, 2.55, -3.65, 5.15, -3.12, { style: 'cordwood', keepClear: kc, h: 2.45 });
  occluderWall(c, -4.65, -Math.min(D / 2 - 1.3, 6.8), -4.12, -3.35, { style: 'hedge', keepClear: kc, h: 2.48 });

  addMistVeils(c, [
    { x0: -2.6, z0: 0, x1: -0.6, z1: 0 },
    { x0: 0.6, z0: 0, x1: 2.6, z1: 0 },
  ], { color: [0.08, 0.14, 0.10], alpha: 0.60 });

  // Outer claustrophobic AAA forest perimeter on both dry banks (`big: true` 500k tier!)
  const homeLx = p.buckSide ? p.buckSide * 1.65 : -1.45;
  const homeLz = -2.65;
  c.reserve(homeLx, homeLz, 1.05);
  c.reserve(-2.6, -2.5, 0.55);
  c.reserve(2.4, -2.8, 0.55);

  keepLane(c, -W / 2 + 1.2, 2.4, W / 2 - 1.2, 2.4, 1.45);
  keepLane(c, -W / 2 + 1.2, -2.6, W / 2 - 1.2, -2.6, 1.55);
  for (const dr of c.room.doors) {
    const dp = c.doorPoint(dr, 0.6);
    keepLane(c, dp.x, dp.z, Math.max(-3, Math.min(3, dp.x)), dp.z >= 0 ? 2.4 : -2.6, 1.45);
  }
  thicket(c, {
    tag: 'lotrim',
    big: true,
    ordCap: 228000,
    budget: 145000,
    detCap: 242000,
    detBudget: 195000,
    hub: null,
    wet: true,
    spacing: 0.80,
    trees: 48,
    companionStems: 40,
    under: 76,
    hillsOpt: { style: 'rainforest', density: 1.45, maxHeight: 2.25 },
    region: (_x, z) => z < bogZ0 - 0.55 || z > bogZ1 + 0.55,
  });

  // Two genuine office coat-racks standing near the Buck's post so the silhouette is uncanny
  for (const [rx, rz] of [[-2.6, -2.5], [2.4, -2.8]]) {
    c.prop('coatrack', rx, rz, { rot: rx, fallback: [0.3, 1.7, 0.3] });
  }

  // ---- Centerpiece Hunter: THE COAT-RACK BUCK (`stag.js`) -------------------

  const rig = makeCoatRackBuckRig(kit, 'lot');
  const homeW = c.toWorld(homeLx, homeLz);
  const faceW = c.toWorld(homeLx, homeLz + 1.0);
  const baseYaw = Math.atan2(faceW.x - homeW.x, faceW.z - homeW.z);
  rig.group.rotation.y = baseYaw;

  let rule = makeBuck(homeLx, homeLz);
  let known = false;
  let over = false;
  let frozen = false;

  // Step walker in world space; returns `{ went, blocked }` so slamming a trunk wedges its antlers!
  function stepBuckBody(walker, tx, tz, dist, straightOnly = false) {
    const stand = (wx, wz) => {
      if (c.world.roomAt(wx, wz) !== c.rt) return false;
      const loc = c.toLocal(wx, wz);
      if (Math.abs(loc.x) > W / 2 - 0.65 || Math.abs(loc.z) > D / 2 - 0.65) return false;
      if (!c.world.free(wx, wz, walker.r, { ghost: true })) return false;
      if (!furnitureClear(c.world, walker.x, walker.z, wx, wz, walker.r)) return false;
      return true;
    };
    let went = 0, rem = dist, blocked = false;
    const turns = straightOnly ? [0] : [0, 0.45, -0.45, 0.95, -0.95, 1.5, -1.5];
    while (rem > 1e-3) {
      const dx = tx - walker.x, dz = tz - walker.z, d = Math.hypot(dx, dz);
      if (d < 0.02) break;
      const s = Math.min(rem, d, 0.085);
      let moved = false;
      for (const turn of turns) {
        const cs = Math.cos(turn), sn = Math.sin(turn);
        const ux = (dx * cs - dz * sn) / d, uz = (dx * sn + dz * cs) / d;
        const nx = walker.x + ux * s, nz = walker.z + uz * s;
        if (stand(nx, nz)) {
          walker.x = nx;
          walker.z = nz;
          walker.heading = Math.atan2(ux, uz);
          went += s;
          moved = true;
          break;
        }
      }
      if (!moved) {
        blocked = true;
        break;
      }
      rem -= s;
    }
    return { went, blocked };
  }

  // Custom 3-second CCTV ending: The Coat-Rack Buck hoists the visitor onto its brass coat-hook antlers!
  c.rt.takes = (shot) => {
    over = true;
    const fig = shot.figure;
    const yaw = rig.group.rotation.y;
    const hookPos = { x: roamer.x + Math.sin(yaw) * 0.62, z: roamer.z + Math.cos(yaw) * 0.62 };
    c.env.play?.('rattle', roamer.x, roamer.z, 12);
    c.env.play?.('thunk', roamer.x, roamer.z, 12);
    let clock = 0;
    return (t, dt) => {
      clock += dt;
      rig.pose({ unfold: 1, stride: clock * 4.5, speed: 0.8, time: clock, mode: 'scrape', headYaw: Math.sin(clock * 5) * 0.25, dt });
      if (!fig) return;
      const e = Math.min(1, t / 0.48);
      fig.position.x = shot.x + (hookPos.x - shot.x) * e;
      fig.position.z = shot.z + (hookPos.z - shot.z) * e;
      fig.position.y = shot.y + 0.55 * e + Math.sin(clock * 6) * 0.04;
      fig.rotation.y = yaw + Math.PI;
      fig.rotation.z = 0.28 * e;
    };
  };

  c.rt.films = (shot) => {
    const yaw = rig.group.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const far of [3.4, 2.5]) {
      for (const side of [1, -1]) {
        const x = roamer.x + fz * side * far + fx * 0.5;
        const z = roamer.z - fx * side * far + fz * 0.5;
        if (c.world.roomAt(x, z) === c.rt && c.world.los(x, z, roamer.x, roamer.z)) {
          return {
            x,
            y: Math.max(shot.y, c.room.y || 0) + 1.5,
            z,
            at: { x: roamer.x + fx * 0.3, y: (roamer.y ?? shot.y) + 1.25, z: roamer.z + fz * 0.3 },
          };
        }
      }
    }
    return null;
  };

  const roamer = c.env.denizens?.add({
    id: 'coat-rack-buck',
    x: homeW.x,
    y: c.room.y || 0,
    z: homeW.z,
    r: 0.34,
    tall: 1.85,
    heading: baseYaw,
    group: rig.group,
    light: (rgb) => rig.light(rgb),
    snipTarget: () => (rule.mode !== 'rack' && rule.mode !== 'recoil' ? { id: 'coat-rack-buck', r: 0.52, priority: 2 } : false),
    snip() {
      if (rule.mode === 'rack' || rule.mode === 'recoil') return false;
      if (!known) { known = true; c.met('coat-rack-buck'); }
      rule = snipBuck(rule);
      c.env.play?.('clack', roamer.x, roamer.z, 10);
      c.env.play?.('rattle', roamer.x, roamer.z, 9);
      c.survived('coat-rack-buck');
      return { ok: true, target: 'coat-rack-buck' };
    },
    update(dt, time, me) {
      if (over || frozen) return;
      const inRoom = c.world.current() === c.rt;
      const pLoc = c.toLocal(me.x, me.z);
      const rLoc = c.toLocal(roamer.x, roamer.z);
      const dist = Math.hypot(me.x - roamer.x, me.z - roamer.z);
      const distHome = Math.hypot(rLoc.x - homeLx, rLoc.z - homeLz);
      const speedNow = Math.hypot(me.vx || 0, me.vz || 0);
      const clearLine = inRoom && c.world.los(roamer.x, roamer.z, me.x, me.z);

      const keys = c.env.player?.input?.keys;
      const crouched = !!(keys && keys.has('c'));
      const running = !crouched && speedNow > 2.45;

      let heardCall = false, callX = bellX, callZ = bellZ;
      if (callPulse) {
        callPulse.age += dt;
        if (callPulse.age <= 0.25) {
          heardCall = true;
          callX = callPulse.x;
          callZ = callPulse.z;
        } else {
          callPulse = null;
        }
      }

      if (!known && inRoom && rule.mode !== 'rack' && dist < 12 && c.env.sees?.(roamer.x, roamer.z, { radius: 0.6 })) {
        known = true;
        c.met('coat-rack-buck');
      }

      // Move first if already charging so `blockedMove` immediately catches trunk collisions!
      let actualSpeed = 0, turnDelta = 0, blockedMove = false;
      const prevYaw = rig.group.rotation.y;
      if (rule.mode === 'charge') {
        const goalW = c.toWorld(rLoc.x + rule.chargeDx * 3.0, rLoc.z + rule.chargeDz * 3.0);
        const mv = stepBuckBody(roamer, goalW.x, goalW.z, BUCK.chargeSpeed * dt, true);
        actualSpeed = dt > 1e-4 ? mv.went / dt : 0;
        blockedMove = mv.blocked;
      }

      const curLoc = c.toLocal(roamer.x, roamer.z);
      const res = stepBuck(rule, {
        dt,
        inside: inRoom,
        dist: Math.hypot(me.x - roamer.x, me.z - roamer.z),
        distHome: Math.hypot(curLoc.x - homeLx, curLoc.z - homeLz),
        clearLine,
        // (it wakes to somebody in its space, or running near it, and to nothing else: a torch beam and the bracken used
        // to wake it as well, which was three rules where a creature has one. docs/FOREST-REVIEW.md §3)
        beamOnBuck: false,
        rustled: false,
        running,
        heardCall,
        callX,
        callZ,
        buckX: curLoc.x,
        buckZ: curLoc.z,
        playerX: pLoc.x,
        playerZ: pLoc.z,
        blockedMove,
      });
      rule = res.state;

      if (res.rattled) c.env.play?.('rattle', roamer.x, roamer.z, 12);
      if (res.snorted) c.env.play?.('creak', roamer.x, roamer.z, 11);
      if (res.wedgedNow) {
        c.env.play?.('crack', roamer.x, roamer.z, 13);
        c.env.play?.('rattle', roamer.x, roamer.z, 11);
        c.env.interfere?.(0.45);
        if (known) c.survived('coat-rack-buck');
      }

      if (rule.mode !== 'charge' && res.speed > 0.02) {
        const goalW = c.toWorld(rule.goalX, rule.goalZ);
        const mv = stepBuckBody(roamer, goalW.x, goalW.z, res.speed * dt, false);
        actualSpeed = dt > 1e-4 ? mv.went / dt : 0;
        const wantYaw = mv.went > 1e-4 ? roamer.heading : Math.atan2(goalW.x - roamer.x, goalW.z - roamer.z);
        turnDelta = clamp(turnTo(prevYaw, wantYaw), -dt * 5.8, dt * 5.8);
        rig.group.rotation.y = prevYaw + turnDelta;
      } else if (rule.mode === 'charge' || rule.mode === 'scrape') {
        const aimW = c.toWorld(curLoc.x + rule.chargeDx, curLoc.z + rule.chargeDz);
        const wantYaw = Math.atan2(aimW.x - roamer.x, aimW.z - roamer.z);
        turnDelta = clamp(turnTo(prevYaw, wantYaw), -dt * 7.5, dt * 7.5);
        rig.group.rotation.y = prevYaw + turnDelta;
      } else if (rule.mode === 'rack') {
        turnDelta = clamp(turnTo(prevYaw, baseYaw), -dt * 3.5, dt * 3.5);
        rig.group.rotation.y = prevYaw + turnDelta;
      }

      const finalLoc = c.toLocal(roamer.x, roamer.z);
      const wantY = (c.room.y || 0) + (c.rt.floorY ? c.rt.floorY(finalLoc.x, finalLoc.z) : 0);
      roamer.y = (roamer.y ?? wantY) + (wantY - (roamer.y ?? wantY)) * (1 - Math.exp(-10 * dt));

      if (res.hoofstep && actualSpeed > 0.25) {
        c.env.play?.('clack', roamer.x, roamer.z, 9.5);
      }

      if (res.struck) {
        if (!known) { known = true; c.met('coat-rack-buck'); }
        c.env.play?.('thunk', roamer.x, roamer.z, 12);
        c.env.play?.('rattle', roamer.x, roamer.z, 10);
        c.env.interfere?.(0.92);
        const hit = c.hurt(BUCK.hurt);
        if (hit?.ended) { over = true; return; }
        if (hit?.landed) {
          c.env.hud?.glitch?.(0.55);
          c.survived('coat-rack-buck');
        }
      }

      const headYaw = inRoom && rule.mode !== 'rack'
        ? turnTo(rig.group.rotation.y, Math.atan2(me.x - roamer.x, me.z - roamer.z))
        : 0;
      rig.pose({
        unfold: rule.unfold,
        stride: rule.stride,
        speed: actualSpeed,
        time,
        mode: rule.mode,
        headYaw,
        dt,
        turnRate: dt > 1e-4 ? turnDelta / dt : 0,
      });
    },
  });

  c.rt.coatRackBuck = {
    get state() { return rule; },
    setState(next) { rule = { ...rule, ...next }; },
    setFrozen(v) { frozen = !!v; },
    roamer,
    rig,
  };

  // The cloakroom's board: a name and a disclaimer (what wakes the rack is for the visitor to find)
  const spSign = c.wallSpot(1.55, ['front', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      'CLEAR-CUT CLOAKROOM',
      'COATS LEFT AT OWN RISK',
    ], { seed: 61, warn: true });
  }
  const spMural = c.wallSpot(3.1, ['back', 'left', 'right']);
  if (spMural) forestMural(c, spMural.side, spMural.at, 1.5, 3.0, 1.8, 0, 83 + R.int(0, 9));
}
