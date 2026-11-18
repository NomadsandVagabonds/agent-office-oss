// The Backrooms — a room of the corporate aquatics annex (`waterpark`):
// The Lazy Loop ("the circular canal of yellow inner tubes around the lifeguard chair").
//
// Built by an alien simulation reconstructing a "lazy river" from fourth-hand
// descriptions: an endless annular chlorinated canal drifting beneath a humming
// suspended office ceiling, ringed by glitched towers of vinyl inner tubes and
// corrupted tile murals.
//
// On the central tiled island stands what looks like a white poolside lifeguard
// chair — until you look closely at how the lifeguard's sunburnt torso and red
// trunks melt like hot wax directly into the PVC seat and all four chair legs.
// When its triple throat-whistles shriek (`ADULT SWIM`) — or the instant anyone
// sprints on the wet deck (`NO RUNNING`) — **The Guard-Stand** cracks its four
// chair legs open into a 2-metre arachnid stance and spider-stilts straight off
// the island through the chest-deep water after exposed swimmers!
// Hold `C` in the canal to duck completely underwater until its scan passes, or
// freeze dead still on dry deck outside the water.

import {finishPoolRoom} from '../pool-finish.js';
import * as THREE from 'three';
import { Batch, WHITE } from '../kit.js';
import { clamp, turnTo } from '../bits.js';
import { furnitureClear } from '../furniture-rules.js';
import {
  poolroom, natatoriumLight, createBasin, makeVoxGroup, makeInnerTube, placeVoxStack,
  innerTubeVox, alienMural, poolSign, depthTile,
  COPING, CHROME, poolTileTex,
} from '../waterpark.js';
import {
  riverCurrent,
  GUARD_STAND, makeGuardStand, stepGuardStand, snipGuardStand,
} from '../waterpark.rule.js';
import { makeGuardStandRig } from '../guard-stand.js';

export function build(c) {
  const { W, D, H, R, params: p, kit } = c;
  c.shell({ panels: false, floor: false, wallTex:poolTileTex(c.kit,'white') });
  natatoriumLight(c, 3, 3, 1, 1.08);
  poolroom(c, { wrong: 0, footbath: false, signs: false });

  const rInner = 2.25;
  const rOuter = Math.min(4.95, Math.min(W, D) * 0.5 - 2.05);
  const depth = 0.78;
  const dir = p.dir || 1;

  // Keep the central island stash [-0.45, -0.45, 0.45, 0.45] and Guard-Stand post clear
  const homeLx = 0, homeLz = -1.12;
  c.reserve(0, 0, 0.65);
  c.reserve(homeLx, homeLz, 0.75);

  // Annular floor profile inside [-rOuter, +rOuter]:
  // - Central island (`r <= rInner`) is dry (`+0.02 m`, well above `waterY = -0.06`)
  // - Outer deck (`r >= rOuter`) is dry (`0 m`)
  // - Two stepped entry/exit fords at BOTH +z and -z (`|x| <= 0.72`) step smoothly <= 0.16 m/step
  //   so outer deck, canal, and central island are 100% walkable (`said: []`).
  const canalFloor = (x, z) => {
    const r = Math.hypot(x, z);
    if (r >= rOuter) return 0;
    if (r <= rInner) return 0.02;
    if (Math.abs(x) <= 0.72) {
      const edgeDist = Math.min(r - rInner, rOuter - r);
      if (edgeDist < 0.85) {
        const stepIdx = Math.floor((edgeDist / 0.85) * 4);
        return -((stepIdx + 1) / 5) * depth;
      }
    }
    return -depth;
  };

  // Tiled central island + cobalt vertical wall + white coping rim
  const islandTile = c.mapped('wp:island', poolTileTex(kit, 'white'));
  const segs = 20;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    const x0 = Math.cos(a0) * rInner, z0 = Math.sin(a0) * rInner;
    const x1 = Math.cos(a1) * rInner, z1 = Math.sin(a1) * rInner;
    islandTile.quad([0, 0.035, 0], [x1, 0.035, z1], [x0, 0.035, z0], [0, 0.035, 0], WHITE);
    c.flat.quad([x0, -depth, z0], [x1, -depth, z1], [x1, 0.05, z1], [x0, 0.05, z0], [0.18, 0.44, 0.58]);
    c.flat.quad([x0 * 0.93, 0.052, z0 * 0.93], [x0 * 1.03, 0.052, z0 * 1.03], [x1 * 1.03, 0.052, z1 * 1.03], [x1 * 0.93, 0.052, z1 * 0.93], COPING);
  }
  // Visual coping steps on both +z and -z fords
  for (const sz of [-1, 1]) {
    for (let s = 0; s < 4; s++) {
      const yS = -((s + 1) / 5) * depth;
      const zOutA = sz * (rOuter - (s + 1) * 0.21), zOutB = sz * (rOuter - s * 0.21);
      const zInA = sz * (rInner + s * 0.21), zInB = sz * (rInner + (s + 1) * 0.21);
      c.flat.box(-0.68, -depth, Math.min(zOutA, zOutB), 0.68, yS, Math.max(zOutA, zOutB), COPING, { skip: '-y' });
      c.flat.box(-0.68, -depth, Math.min(zInA, zInB), 0.68, yS, Math.max(zInA, zInB), COPING, { skip: '-y' });
    }
  }

  // Glitched alien-waterpark oddities baked into ONE single `Batch(true)` mesh (`placeVoxStack`):
  //   - Towering crooked columns of vinyl inner tubes in clear outer deck corners (with inverted legs mid-stack!)
  //   - Upside-down inner tubes fused flat against the acoustic ceiling tiles above the canal!
  const tubePalette = ['#bc9c4d', '#af6a61', '#538a88', '#708963', '#b57d4e'];
  const stackEntries = [];
  const cornerSpots = [
    [-W * 0.5 + 1.35, -D * 0.5 + 1.35],
    [W * 0.5 - 1.35, -D * 0.5 + 1.35],
    [-W * 0.5 + 1.35, D * 0.5 - 1.35],
    [W * 0.5 - 1.35, D * 0.5 - 1.35],
  ];
  let builtTowers = 0;
  for (const [cx, cz] of cornerSpots) {
    if (builtTowers >= 1 || !c.clear(cx, cz, 0.72)) continue;
    const count = 9;
    for (let k = 0; k < count; k++) {
      const col = tubePalette[(k + builtTowers * 2) % tubePalette.length];
      const occ = k === count - 2;
      stackEntries.push({
        key: `wp:stacktube:${col}:${occ ? 1 : 0}`,
        make: innerTubeVox(col, occ),
        x: cx + Math.sin(k * 1.7 + builtTowers) * 0.09,
        y: k * 0.24,
        z: cz + Math.cos(k * 1.3 + builtTowers) * 0.09,
        rot: k * 0.65,
        tilt: [Math.sin(k * 2.1) * 0.09, Math.cos(k * 1.9) * 0.09],
        scale: 0.03,
      });
    }
    c.solid(cx - 0.36, cz - 0.36, cx + 0.36, cz + 0.36);
    builtTowers++;
  }
  // 3 upside-down inner tubes clinging to the suspended drop-ceiling above the river!
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.55;
    const col = tubePalette[(i + 1) % tubePalette.length];
    stackEntries.push({
      key: `wp:ceiltube:${col}`,
      make: innerTubeVox(col, false),
      x: Math.cos(a) * ((rInner + rOuter) * 0.5),
      y: H - 0.04,
      z: Math.sin(a) * ((rInner + rOuter) * 0.5),
      rot: a,
      tilt: [Math.PI, 0.06],
      scale: 0.03,
    });
  }
  if (stackEntries.length) {
    placeVoxStack(c, 'wp:lazy:stacks', stackEntries, { sampleAt: [0, 1.4, 0] });
  }

  // Corrupted 4th-hand alien waterpark murals on clear wall stretches
  let muralVariant = 2;
  for (const side of ['left', 'right', 'back']) {
    const sp = c.wallSpot(3.4, [side]);
    if (!sp) continue;
    alienMural(c, sp.side, sp.at, Math.min(1.65, H * 0.5), 3.1, 1.85, muralVariant % 3, 41 + muralVariant * 13 + R.int(0, 9));
    muralVariant++;
    if (muralVariant >= 3) break;
  }

  // Suspended red `ADULT SWIM / NO RUNNING` indicator box hanging on chrome rods over the island
  const lampY = H - 0.52;
  c.flat.box(-0.42, lampY + 0.16, homeLz - 0.03, -0.38, H, homeLz + 0.03, CHROME);
  c.flat.box(0.38, lampY + 0.16, homeLz - 0.03, 0.42, H, homeLz + 0.03, CHROME);
  const adultLamp = new Batch();
  adultLamp.box(-0.68, lampY - 0.16, homeLz - 0.09, 0.68, lampY + 0.16, homeLz + 0.09, [0.95, 0.16, 0.12]);
  const adultMesh = c.dynamic(adultLamp, { pivot: [0, lampY, homeLz] });
  adultMesh.visible = false;

  // 4 drifting sculpted inner tubes orbiting in the lazy river current (1 with upside-down slacks & oxfords!)
  const floatCols = ['#f2c12e', '#ff5c8a', '#29b6d8', '#f2c12e'];
  const floats = [];
  const rMid = (rInner + rOuter) * 0.5;
  for (let i = 0; i < floatCols.length; i++) {
    const col = floatCols[i];
    const occ = i === 1;
    const g = makeInnerTube(kit, col, occ);
    const ang = (i / floatCols.length) * Math.PI * 2;
    g.position.set(Math.cos(ang) * rMid, -0.10, Math.sin(ang) * rMid);
    c.add(g);
    floats.push({ g, ang, rOff: (i % 2 ? 0.26 : -0.24) });
  }
  c.after.push(() => {
    for (const f of floats) f.g.userData.light(c.sample(f.g.position.x, 0.35, f.g.position.z));
  });

  // ---- Centerpiece Entity: THE GUARD-STAND ----------------------------------
  const rig = makeGuardStandRig(kit, 'lazy');
  const homeW = c.toWorld(homeLx, homeLz);
  const faceFrontW = c.toWorld(homeLx, homeLz + 1.0);
  const baseHomeYaw = Math.atan2(faceFrontW.x - homeW.x, faceFrontW.z - homeW.z) + (p.guardYaw || 0) * 0.25;
  rig.group.rotation.y = baseHomeYaw;

  let rule = makeGuardStand(homeLx, homeLz);
  let known = false;
  let over = false;
  let frozen = false;
  let strikeFlash = 0;

  // Spider-stilt navigation: ignores the 0.78 m canal step height so its 1.47 m PVC chair legs
  // stride straight off the island into chest-deep water and out onto the pool deck!
  function stepSpiderStilt(walker, tx, tz, dist) {
    const stand = (wx, wz) => {
      if (c.world.roomAt(wx, wz) !== c.rt) return false;
      const loc = c.toLocal(wx, wz);
      if (Math.abs(loc.x) > W * 0.5 - 0.65 || Math.abs(loc.z) > D * 0.5 - 0.65) return false;
      if (!c.world.free(wx, wz, walker.r, { ghost: true })) return false;
      if (!furnitureClear(c.world, walker.x, walker.z, wx, wz, walker.r)) return false;
      return true;
    };
    let went = 0;
    let rem = dist;
    while (rem > 1e-3) {
      const dx = tx - walker.x, dz = tz - walker.z, d = Math.hypot(dx, dz);
      if (d < 0.02) break;
      const s = Math.min(rem, d, 0.09);
      let moved = false;
      for (const turn of [0, 0.5, -0.5, 1.05, -1.05, 1.6, -1.6]) {
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
      if (!moved) break;
      rem -= s;
    }
    return went;
  }

  // The building's CCTV camera for the last three seconds: The Guard-Stand cages the swimmer
  // beneath its four splayed PVC chair legs and slams its crimson rescue-torpedo arm down!
  c.rt.takes = (shot) => {
    over = true;
    const fig = shot.figure;
    const yaw = rig.group.rotation.y;
    const trap = { x: roamer.x + Math.sin(yaw) * 0.52, z: roamer.z + Math.cos(yaw) * 0.52 };
    c.env.play?.('peawhistle', roamer.x, roamer.z, 14);
    c.env.play?.('wade', roamer.x, roamer.z, 11);

    const dropLoc = c.toLocal(trap.x, trap.z);
    const cube = kit.own(new THREE.BoxGeometry(1, 1, 1));
    const splashMats = [0x46d8ea, 0xe8ffff, 0xc92320].map((hex) => kit.own(new THREE.MeshBasicMaterial({ color: hex })));
    const drops = [];
    const burst = (n) => {
      for (let i = 0; i < n && drops.length < 96; i++) {
        const m = c.add(new THREE.Mesh(cube, splashMats[drops.length % splashMats.length]));
        const size = 0.06 + Math.random() * 0.07;
        const a = Math.random() * Math.PI * 2, spd = 1.4 + Math.random() * 2.4;
        m.scale.setScalar(size);
        m.position.set(dropLoc.x, canalFloor(dropLoc.x, dropLoc.z) + 0.35, dropLoc.z);
        drops.push({ m, vx: Math.cos(a) * spd, vz: Math.sin(a) * spd, vy: 1.6 + Math.random() * 2.0 });
      }
    };

    let clock = 0, lastSlam = -1;
    return (t, dt) => {
      clock += dt;
      for (const b of drops) {
        b.vy -= 9.8 * dt;
        b.m.position.x += b.vx * dt;
        b.m.position.z += b.vz * dt;
        b.m.position.y += b.vy * dt;
      }
      const slamCycle = Math.max(0, t - 0.35) * 3.2;
      const slamIdx = Math.floor(slamCycle);
      const slamPhase = slamCycle - slamIdx;
      const strikeK = t < 0.35 ? -0.45 : Math.sin(slamPhase * Math.PI);
      if (slamIdx > lastSlam && t >= 0.35 && slamIdx < 8) {
        lastSlam = slamIdx;
        c.env.play?.('thunk', trap.x, trap.z, 10);
        c.env.play?.('wade', trap.x, trap.z, 9);
        burst(12);
      }
      rig.pose({ unfold: 1, stride: clock * 7.5, speed: 1.8, time: clock, mode: 'surge', headYaw: 0, dt, strikeK });
      if (!fig) return;
      const e = Math.min(1, t / 0.55);
      fig.position.x = shot.x + (trap.x - shot.x) * e;
      fig.position.z = shot.z + (trap.z - shot.z) * e;
      fig.rotation.y = Math.atan2(roamer.x - shot.x, roamer.z - shot.z);
      fig.rotation.x = -1.15 * e;
      fig.position.y = shot.y - 0.42 * e - Math.min(0.28, Math.max(0, t - 0.4) * 0.14);
    };
  };

  c.rt.films = (shot) => {
    const yaw = rig.group.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const far of [3.3, 2.5]) {
      for (const side of [1, -1]) {
        const x = roamer.x + fz * side * far + fx * 0.45;
        const z = roamer.z - fx * side * far + fz * 0.45;
        if (c.world.roomAt(x, z) === c.rt && c.world.los(x, z, roamer.x, roamer.z)) {
          return {
            x,
            y: Math.max(shot.y, c.room.y || 0) + 1.55,
            z,
            at: { x: roamer.x + fx * 0.22, y: (roamer.y ?? shot.y) + 1.15, z: roamer.z + fz * 0.22 },
          };
        }
      }
    }
    return null;
  };

  const roamer = c.env.denizens?.add({
    id: 'guard-stand',
    x: homeW.x,
    y: (c.room.y || 0) + 0.02,
    z: homeW.z,
    r: 0.36,
    tall: 1.75,
    heading: baseHomeYaw,
    group: rig.group,
    light: (rgb) => rig.light(rgb),
    snipTarget: () => (rule.mode !== 'chair' && rule.mode !== 'recoil' ? { id: 'guard-stand', r: 0.48, priority: 2 } : false),
    snip() {
      if (rule.mode === 'chair' || rule.mode === 'recoil') return false;
      if (!known) { known = true; c.met('guard-stand'); }
      rule = snipGuardStand(rule);
      c.env.play?.('clack', roamer.x, roamer.z, 9);
      c.env.play?.('creak', roamer.x, roamer.z, 8);
      c.survived('guard-stand');
      return { ok: true, target: 'guard-stand' };
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
      const isSubmerged = !!(c.rt.basin && c.rt.basin.swimmer && c.rt.basin.swimmer.submerged);
      const pR = Math.hypot(pLoc.x, pLoc.z);
      const inCanal = inRoom && pR > rInner + 0.06 && pR < rOuter - 0.06;

      if (!known && inRoom && dist < 10 && c.env.sees?.(roamer.x, roamer.z, { radius: 0.55 })) {
        known = true;
        c.met('guard-stand');
      }

      const res = stepGuardStand(rule, {
        dt,
        inside: inRoom,
        inCanal,
        submerged: isSubmerged,
        moving: speedNow > 0.38,
        speed: speedNow,
        clearLine,
        dist,
        distHome,
        playerX: pLoc.x,
        playerZ: pLoc.z,
      });
      rule = res.state;

      if (res.whistle) {
        c.env.play?.('peawhistle', roamer.x, roamer.z, 14);
        c.env.interfere?.(0.28);
      }
      if (res.unfoldedNow) {
        c.env.play?.('creak', roamer.x, roamer.z, 11);
        c.env.play?.('clack', roamer.x, roamer.z, 10);
      }

      let actualSpeed = 0;
      let turnDelta = 0;
      const prevYaw = rig.group.rotation.y;

      if (res.speed > 0.02) {
        const goalW = c.toWorld(res.goalX, res.goalZ);
        const went = stepSpiderStilt(roamer, goalW.x, goalW.z, res.speed * dt);
        actualSpeed = dt > 1e-4 ? went / dt : 0;
        const wantYaw = went > 1e-4 ? roamer.heading : Math.atan2(goalW.x - roamer.x, goalW.z - roamer.z);
        turnDelta = clamp(turnTo(prevYaw, wantYaw), -dt * 5.2, dt * 5.2);
        rig.group.rotation.y = prevYaw + turnDelta;
      } else if (rule.mode === 'chair' || (rule.mode === 'return' && distHome <= 0.22)) {
        turnDelta = clamp(turnTo(prevYaw, baseHomeYaw), -dt * 4.0, dt * 4.0);
        rig.group.rotation.y = prevYaw + turnDelta;
      } else if (inRoom) {
        const faceSwimmer = Math.atan2(me.x - roamer.x, me.z - roamer.z);
        turnDelta = clamp(turnTo(prevYaw, faceSwimmer), -dt * 4.6, dt * 4.6);
        rig.group.rotation.y = prevYaw + turnDelta;
      }

      // Smooth vertical wading height across island (+0.02 m), canal (-0.78 m), and outer deck (0 m)
      const nowLoc = c.toLocal(roamer.x, roamer.z);
      const wantY = (c.room.y || 0) + canalFloor(nowLoc.x, nowLoc.z);
      roamer.y = (roamer.y ?? wantY) + (wantY - (roamer.y ?? wantY)) * (1 - Math.exp(-10 * dt));

      if (res.footstep && actualSpeed > 0.2) {
        const nowR = Math.hypot(nowLoc.x, nowLoc.z);
        if (nowR > rInner && nowR < rOuter) {
          c.env.play?.('wade', roamer.x, roamer.z, 9);
          c.env.play?.('clack', roamer.x, roamer.z, 6);
        } else {
          c.env.play?.('clack', roamer.x, roamer.z, 8);
        }
      }

      if (res.struck && furnitureClear(c.world, roamer.x, roamer.z, me.x, me.z, 0.12)) {
        if (!known) { known = true; c.met('guard-stand'); }
        strikeFlash = 1.0;
        c.env.play?.('peawhistle', roamer.x, roamer.z, 13);
        c.env.play?.('thunk', roamer.x, roamer.z, 10);
        c.env.interfere?.(0.92);
        const hit = c.hurt(GUARD_STAND.hurt);
        if (hit?.ended) { over = true; return; }
        if (hit?.landed) {
          c.env.hud?.glitch?.(0.55);
          c.survived('guard-stand');
        }
      }

      strikeFlash = Math.max(0, strikeFlash - dt * 3.2);
      const wantHeadYaw = inRoom && rule.mode !== 'chair'
        ? turnTo(rig.group.rotation.y, Math.atan2(me.x - roamer.x, me.z - roamer.z))
        : 0;

      rig.pose({
        unfold: rule.unfold,
        stride: rule.stride,
        speed: actualSpeed,
        time,
        mode: rule.mode,
        headYaw: wantHeadYaw,
        dt,
        turnRate: dt > 1e-4 ? turnDelta / dt : 0,
        strikeK: Math.sin(strikeFlash * Math.PI),
      });

      const alertOn = rule.mode === 'whistle' || rule.mode === 'scan' || rule.mode === 'surge';
      adultMesh.visible = alertOn;
      adultMesh.scale.setScalar(rule.mode === 'whistle' || rule.mode === 'surge' ? 0.96 + 0.08 * Math.sin(time * 18) : 1);
    },
  });

  // Expose state/rig on room runtime for deterministic playtest probes & studio inspection
  c.rt.guardStand = {
    get state() { return rule; },
    setState(next) { rule = { ...rule, ...next }; },
    setFrozen(v, alertOn = false) {
      frozen = !!v;
      adultMesh.visible = !!alertOn;
    },
    toLocal: c.toLocal,
    toWorld: c.toWorld,
    roamer,
    rig,
  };

  createBasin(c, {
    x0: -rOuter, z0: -rOuter, x1: rOuter, z1: rOuter,
    depth,
    waterY: -0.06,
    tile: 'seafoam',
    wallTile: 'cobalt',
    waterTone: 'aqua',
    stepsSide: 'none',
    floorAtInner: canalFloor,
    onTick: (_info, dt, t, me) => {
      // Orbit the 4 inner tubes smoothly round the canal
      const omega = (1.35 / rMid) * dir;
      for (let i = 0; i < floats.length; i++) {
        const f = floats[i];
        f.ang += omega * dt;
        const rr = rMid + f.rOff + Math.sin(t * 0.9 + i) * 0.08;
        f.g.position.set(Math.cos(f.ang) * rr, -0.11 + Math.sin(t * 2.4 + i * 1.3) * 0.025, Math.sin(f.ang) * rr);
        f.g.rotation.y = -f.ang * dir + t * 0.25;
        f.g.userData.kick?.(t, i * 1.37);
      }

      const cur = me.inside ? riverCurrent(me.x, me.z, rInner + 0.08, rOuter - 0.08, 1.55, dir) : { vx: 0, vz: 0, inCanal: false };
      if (me.inside && me.world && cur.inCanal) {
        const roomYaw = (c.room.rot * Math.PI) / 2;
        const cos = Math.cos(roomYaw), sin = Math.sin(roomYaw);
        const wx = cur.vx * cos + cur.vz * sin;
        const wz = -cur.vx * sin + cur.vz * cos;
        me.world.vx += wx * dt * 2.4;
        me.world.vz += wz * dt * 2.4;
      }
    },
  });

  const prevLeave = c.rt.onLeave;
  c.rt.onLeave = () => {
    prevLeave?.();
  };

  depthTile(c, 0, 0.045, rOuter + 0.22, 'LAZY LOOP 0.8M', 0, 17);
  depthTile(c, 0, 0.055, rInner - 0.34, 'GUARD POST', 0, 29);
  poolSign(c, 'front', 2.4, 1.55, [
    'LAZY RIVER RULES',
    'NO RUNNING ON WET DECK',
    'WHISTLE = ADULT SWIM',
  ], { seed: 53, warn: true, mess: 0.22 });
  finishPoolRoom(c,'lazy-river');
}
