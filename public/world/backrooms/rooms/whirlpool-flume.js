// The Backrooms — a room of the corporate aquatics annex (`waterpark`):
// The Drain Spa ("the sunken whirlpool spiralling into the illuminated floor drain").
//
// Built from a corrupted 4th-hand description of a resort hydrotherapy grotto
// inside a damp acoustic-ceilinged office bay:
//   - A sunken seafoam-and-cobalt Jacuzzi swirls around a pried-open glowing cyan
//     suction drain (`enter the drain` -> spirals down to the next floor when `goesDown`).
//   - One enclosed electric-cyan feed flume through the acoustic tiles pours
//     chlorinated broth into the NW quadrant, as a spa's fill does.
//   - Everything else is an ordinary spa: jet columns, a pink pool locker, two
//     empty inner tubes going round with the current. The drain is the one thing
//     wrong here (the art audit: one anomaly a room).
//   - Turning the NE hydro-jet valve (`reverse hydro-jets`) flips the vortex spin
//     and calms the current for 8.5 s so visitors can wade to the submerged west
//     bench supply.

import {finishPoolRoom} from '../pool-finish.js';
import * as THREE from 'three';
import { Batch, WHITE } from '../kit.js';
import { goesDown } from '../seam.js';
import {
  poolroom, natatoriumLight, createBasin, buildFlume, addTranslucent,
  poolSign, depthTile,
  spaJetPillarVox, wetLockerVox,
  makeInnerTube, placeVoxStack,
  COPING, CHROME, BRASS, GROUT_DARK, poolTileTex,
} from '../waterpark.js';
import {
  makeWhirlpoolSpa, toggleWhirlpoolJets, stepWhirlpoolSpa, whirlpoolField,
} from '../waterpark.rule.js';

/** Add an outward-facing (`THREE.FrontSide`) tapered/flared vertical tube along `rings`. */
function addColumnShell(batch, rings, segs = 12) {
  for (let i = 0; i + 1 < rings.length; i++) {
    const r0 = rings[i], r1 = rings[i + 1];
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2;
      const a1 = ((s + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      const tw0 = r0.twist || 0, tw1 = r1.twist || 0;
      const ca0 = Math.cos(a0 + tw0), sa0 = Math.sin(a0 + tw0);
      const ca1 = Math.cos(a1 + tw0), sa1 = Math.sin(a1 + tw0);
      const cb0 = Math.cos(a0 + tw1), sb0 = Math.sin(a0 + tw1);
      const cb1 = Math.cos(a1 + tw1), sb1 = Math.sin(a1 + tw1);

      const b0 = [r0.x + ca0 * r0.r, r0.y, r0.z + sa0 * r0.r];
      const b1 = [r0.x + ca1 * r0.r, r0.y, r0.z + sa1 * r0.r];
      const t0 = [r1.x + cb0 * r1.r, r1.y, r1.z + sb0 * r1.r];
      const t1 = [r1.x + cb1 * r1.r, r1.y, r1.z + sb1 * r1.r];

      // Alternate fluted foam-streak brightness around the circumference
      const flute = (s % 2 === 0) ? 1.0 : 0.84;
      const base = r0.col;
      const col = [
        Math.min(1, base[0] * flute + (s % 3 === 0 ? 0.08 : 0)),
        Math.min(1, base[1] * flute + (s % 3 === 0 ? 0.08 : 0)),
        Math.min(1, base[2] * flute + (s % 3 === 0 ? 0.08 : 0)),
      ];
      void c0; void s0; void c1; void s1;
      // For y1 > y0 and a1 > a0, (b0 - b1) x (t1 - b1) points radially OUTWARD
      if (r1.y >= r0.y) {
        batch.quad(b1, b0, t0, t1, col);
      } else {
        batch.quad(b0, b1, t1, t0, col);
      }
    }
  }
}

export function build(c) {
  const { W, D, H, params: p, kit } = c;
  c.shell({ panels: false, floor: false, wallTex:poolTileTex(c.kit,'white') });
  natatoriumLight(c, 3, 3, 1, 1.05);
  poolroom(c, { wrong: 0, footbath: false, signs: false });

  let spaState = makeWhirlpoolSpa(p.spin || 1);

  // Sunken central Jacuzzi leaving >= 2.65 m dry promenade around all 4 walls
  // and keeping the +x, +z stash corner (`x > W/2 - 1.85, z > D/2 - 1.85`) 100% clear.
  const hs = Math.min(3.35, Math.min(W, D) * 0.5 - 2.2);
  const depth = 0.80;
  const waterY = -0.05;
  const rDrain = 0.92;

  // Walkable Jacuzzi floor profile:
  // - Entry stair ramps on +z and -z (`|x| <= 0.85`, 4 treads x 0.28 m = 1.12 m, 0.16 m/step <= 0.20 m)
  // - Cobalt underwater spa benches on -x and +x (`|x| > hs - 0.62`, y = -0.44 with 0.18 m end steps)
  // - Central glowing suction funnel (`r < 0.92`)
  const spaFloor = (x, z) => {
    if (Math.abs(x) <= 0.85 && Math.abs(z) > hs - 1.12) {
      const dist = hs - Math.abs(z);
      const stepIdx = Math.min(3, Math.max(0, Math.floor(dist / 0.28)));
      return -((stepIdx + 1) / 5) * depth;
    }
    if (Math.abs(x) > hs - 0.62 && Math.abs(z) < hs - 0.65) {
      if (Math.abs(z) >= hs - 0.93) return -0.62;
      return -0.44;
    }
    const r = Math.hypot(x, z);
    if (r < rDrain) {
      return -depth - (rDrain - r) * 0.36;
    }
    return -depth;
  };

  // Underwater cobalt tiled spa benches + brass eyeball hydro-jets along -x and +x
  const benchTile = c.mapped('wp:spabench', poolTileTex(kit, 'cobalt'));
  for (const sx of [-1, 1]) {
    const x0 = sx > 0 ? hs - 0.62 : -hs;
    const x1 = sx > 0 ? hs : -hs + 0.62;
    benchTile.box(x0, -depth, -(hs - 0.93), x1, -0.44, hs - 0.93, WHITE, { uv: 0.65, skip: '-y' });
    benchTile.box(x0, -depth, -(hs - 0.65), x1, -0.62, -(hs - 0.93), WHITE, { uv: 0.65, skip: '-y' });
    benchTile.box(x0, -depth, hs - 0.93, x1, -0.62, hs - 0.65, WHITE, { uv: 0.65, skip: '-y' });

    for (const jz of [-1.8, -0.6, 0.6, 1.8]) {
      const jx = sx * (hs - 0.03);
      const nozzleX = sx * (hs - 0.09);
      c.flat.box(jx - 0.04, -0.35, jz - 0.06, jx + 0.04, -0.23, jz + 0.06, CHROME);
      c.flat.box(
        Math.min(jx, nozzleX) - 0.03, -0.32, jz - 0.035,
        Math.max(jx, nozzleX) + 0.03, -0.26, jz + 0.035,
        BRASS,
      );
    }
  }

  // Visual entry stair ramps on +z and -z (`<= 0.16 m` per step)
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const yTop = -((i + 1) / 5) * depth;
      const zA = sz > 0 ? hs - (i + 1) * 0.28 : -hs + i * 0.28;
      const zB = sz > 0 ? hs - i * 0.28 : -hs + (i + 1) * 0.28;
      const zMin = Math.min(zA, zB), zMax = Math.max(zA, zB);
      c.flat.box(-0.84, -depth, zMin, 0.84, yTop, zMax, COPING, { skip: '-y' });
      const noseZ = sz > 0 ? zMin : zMax - 0.03;
      c.flat.box(-0.84, yTop - 0.025, noseZ, 0.84, yTop + 0.004, noseZ + 0.03, GROUT_DARK, { skip: '-y' });
    }
  }

  // Central Illuminated Suction Drain Funnel (`rDrain = 0.92`) & pried chrome grate at (0, 0)
  c.flat.box(-rDrain - 0.12, -depth - 0.34, -rDrain - 0.12, rDrain + 0.12, -depth + 0.035, rDrain + 0.12, CHROME, { skip: '-y' });
  c.flat.box(-rDrain + 0.02, -depth - 0.33, -rDrain + 0.02, rDrain - 0.02, -depth + 0.042, rDrain - 0.02, GROUT_DARK, { skip: '-y' });
  const drainGlow = c.shining('wp:drainglow', kit.tex.white(), 2.55, [0.20, 0.96, 1.0]);
  drainGlow.quad(
    [-rDrain + 0.08, -depth - 0.28, rDrain - 0.08],
    [rDrain - 0.08, -depth - 0.28, rDrain - 0.08],
    [rDrain - 0.08, -depth - 0.28, -rDrain + 0.08],
    [-rDrain + 0.08, -depth - 0.28, -rDrain + 0.08],
    WHITE,
  );
  c.light(0, -0.35, 0, '#2ff2ff', 1.15, { k: 2.8, far: 8.5 });

  // Pried-open slotted chrome suction grate leaning beside the central funnel
  c.flat.box(0.92, -depth, -0.52, 1.02, -depth + 0.44, 0.52, CHROME);
  c.flat.box(1.30, -depth, -0.52, 1.40, -depth + 0.14, 0.52, CHROME);
  for (const gz of [-0.46, -0.23, 0, 0.23, 0.46]) {
    c.flat.box(0.94, -depth + 0.08, gz - 0.03, 1.38, -depth + 0.38, gz + 0.03, CHROME);
  }

  // Supply reward on the submerged west cobalt spa bench (reachable easily when jets calm!)
  c.leave('battery', -hs + 0.32, 0, { y: -0.42 });

  // ---- 2. The Feed Flume (Translucent `Batch`) -----------------------------
  const flumeBatch = new Batch();

  // Feed Flume (Electric Cyan `#18c9e8`, NW ceiling hole -> NW Jacuzzi quadrant)
  const holeA = c.hole(-2.0, -1.9, 2);
  c.flat.box(holeA.x - 0.56, H - 0.05, holeA.z - 0.56, holeA.x + 0.56, H + 0.04, holeA.z + 0.56, CHROME);
  const feedPts = [
    [holeA.x, H + 0.16, holeA.z],
    [holeA.x, H - 0.72, holeA.z + 0.1],
    [-1.72, 1.48, -1.52],
    [-1.42, 0.52, -1.18],
  ];
  buildFlume(c, 'wp:spa:feed', feedPts, {
    radius: 0.46,
    color: '#18c9e8',
    enclosed: true,
    batch: flumeBatch,
    hangFromCeiling: true,
    ceilingH: H,
    struts: [0.42, 0.76],
  });

  // Translucent cyan splash column pouring out of the NW feed mouth into the Jacuzzi water
  addColumnShell(flumeBatch, [
    { x: -1.24, y: waterY - 0.04, z: -1.00, r: 0.36, twist: 0.35, col: [0.78, 0.99, 1.0] },
    { x: -1.29, y: waterY + 0.14, z: -1.05, r: 0.24, twist: 0.22, col: [0.32, 0.94, 0.99] },
    { x: -1.36, y: 0.34, z: -1.12, r: 0.27, twist: 0.10, col: [0.16, 0.86, 0.96] },
    { x: -1.42, y: 0.56, z: -1.18, r: 0.33, twist: 0.0, col: [0.12, 0.80, 0.94] },
  ], 10);

  // Bake the feed flume + its pouring cyan splash column into 1 translucent mesh
  addTranslucent(c, flumeBatch, { alpha: 0.76, side: THREE.FrontSide, order: 3 });

  // Dynamic swirling turquoise & whitewater vortex rings around the central drain
  const vortexBatch = new Batch();
  for (let ring = 0; ring < 3; ring++) {
    const rr = 0.44 + ring * 0.54;
    const yy = -0.19 + ring * 0.065;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + ring * 0.3;
      const px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
      const col = ring === 2 ? [0.90, 0.99, 1.0] : ring === 1 ? [0.42, 0.95, 0.99] : [0.22, 0.88, 0.96];
      // Foam is a thin see-through patch on the water, not a block under it (from below, the blocks read as slabs).
      const ca = Math.cos(a), sa = Math.sin(a), p = (u, w) => [px + u * -sa + w * ca, yy + 0.032, pz + u * ca + w * sa];
      vortexBatch.quad(p(-0.13, -0.065), p(0.13, -0.065), p(0.13, 0.065), p(-0.13, 0.065), col);
    }
  }
  const vortexMesh = addTranslucent(c, vortexBatch, { alpha: 0.72, side: THREE.DoubleSide, order: 5 });

  // ---- 3. The Spa's Fittings (Batched into ONE `placeVoxStack`) -------------
  const neX = hs + 0.38, neZ = -hs - 0.38;
  const swX = -hs - 0.38, swZ = hs + 0.38;
  const totemX = -W * 0.5 + 1.15, totemZ = -D * 0.5 + 1.15;

  const voxEntries = [
    // Two alien brass-nozzle hydrotherapy columns on NE & SW coping corners
    { key: 'wp:spajetpillar', make: spaJetPillarVox(), x: neX, y: 0.045, z: neZ, rot: -Math.PI * 0.75 },
    { key: 'wp:spajetpillar', make: spaJetPillarVox(), x: swX, y: 0.045, z: swZ, rot: Math.PI * 0.25 },

    // A rusted pink-towel pool locker in the NW corner
    {
      key: 'wp:wetlocker:#ff5c8a:0',
      make: wetLockerVox('#ff5c8a', false),
      x: totemX, y: 0, z: totemZ,
      rot: 0.68,
    },
  ];

  placeVoxStack(c, 'wp:spa:wrongstack', voxEntries, {
    sampleX: 0,
    sampleY: 1.25,
    sampleZ: -1.5,
  });

  // Solid colliders for NE & SW hydrotherapy columns (`0.28 m` radius) + NW locker base
  c.solid(neX - 0.28, neZ - 0.28, neX + 0.28, neZ + 0.28);
  c.reserve(neX, neZ, 0.45);
  c.solid(swX - 0.28, swZ - 0.28, swX + 0.28, swZ + 0.28);
  c.reserve(swX, swZ, 0.45);
  c.solid(totemX - 0.36, totemZ - 0.36, totemX + 0.36, totemZ + 0.36);
  c.reserve(totemX, totemZ, 0.55);

  // A rust puddle at the NW locker
  c.blot(totemX + 0.12, totemZ + 0.12, 1.15, 0.30, { color: [0.36, 0.52, 0.56] });

  // The spa rules sign and ceramic depth/temperature coping tiles
  poolSign(c, 'back', 3.6, 1.58, [
    'CENTRIFUGAL SPA UNIT 04',
    `BROTH TEMP: ${p.temp || '104 F'}`,
    'SUCTION DRAIN UNGUARDED',
  ], { seed: 73, warn: true, mess: 0.25 });
  depthTile(c, 0, 0.046, hs + 0.22, `SPA ${p.temp || '104 F'}`, 0, 71);
  depthTile(c, 0, 0.046, -hs - 0.22, 'DRAIN -404M', Math.PI, 77);

  // ---- 4. Dynamic Orbiting Floats, Jet-Reversal Valve & Drain Descent -------
  // 2 empty inner tubes going round with the current (`r = 1.50, 2.16`): they show which way it runs
  const orbitSpecs = [
    { color: '#f2c12e', r: 1.50, ang: 0.35, omega: 0.78, yOff: -0.05 },
    { color: '#ff5c8a', r: 2.16, ang: 2.45, omega: 0.58, yOff: -0.05 },
  ];
  const orbiters = orbitSpecs.map((sp) => {
    const g = makeInnerTube(kit, sp.color, false);
    g.position.set(Math.cos(sp.ang) * sp.r, waterY + sp.yOff, Math.sin(sp.ang) * sp.r);
    c.add(g);
    return { ...sp, g };
  });
  c.after.push(() => {
    for (const o of orbiters) {
      o.g.userData.light(c.sample(o.g.position.x, 0.38, o.g.position.z));
    }
  });

  // Dynamic red-enameled brass valve wheel mounted on the NE hydrotherapy column
  const valveY = 0.78;
  const valveBatch = new Batch();
  valveBatch.box(neX - 0.22, valveY - 0.16, neZ - 0.22, neX - 0.17, valveY + 0.16, neZ - 0.17, [0.84, 0.16, 0.14]);
  valveBatch.box(neX - 0.22, valveY - 0.03, neZ - 0.33, neX - 0.17, valveY + 0.03, neZ - 0.06, [0.84, 0.16, 0.14]);
  valveBatch.box(neX - 0.24, valveY - 0.04, neZ - 0.24, neX - 0.10, valveY + 0.04, neZ - 0.16, BRASS);
  const valveMesh = c.dynamic(valveBatch, { pivot: [neX - 0.19, valveY, neZ - 0.19] });

  let valveRot = 0;
  let valveTargetRot = 0;
  const wValve = c.toWorld(neX, neZ);
  const wCenter = c.toWorld(0, 0);
  const SINK = 2.4;
  let going = 0;

  const reverseJets = () => {
    spaState = toggleWhirlpoolJets(spaState);
    valveTargetRot += Math.PI * 1.5 * spaState.spin;
    return spaState;
  };

  // Expose deterministic runtime hook for automated tests
  c.rt.whirlpoolSpa = {
    get state() { return spaState; },
    reverseJets,
  };

  c.use({
    x: neX,
    z: neZ,
    r: 1.55,
    label: 'reverse hydro-jets',
    when: () => !going,
    use: () => {
      reverseJets();
      c.env.play?.('clack', wValve.x, wValve.z, 7);
      c.env.play?.('whir', wValve.x, wValve.z, 8);
    },
  });

  // Centerpiece Themed Way Down (`goesDown` + `env.hold` + 2.4 s spiral + `env.descend`)
  // The drain is a way down only where the visit goes down, and it is not pressed: whoever is in its throat
  // (the current carries a wader there) is taken. No key, no prompt (the owner: no button-press level transitions).
  const DRAIN_TAKES = 0.6;
  const drainOffered = () => !going && goesDown(c.level.exit.way) && !!c.env.descend;
  const enterDrain = () => {
    c.env.play?.('glug', wCenter.x, wCenter.z, 9);
    c.env.play?.('slide', wCenter.x, wCenter.z, 8);
    c.env.interfere?.(0.5);
    if (goesDown(c.level.exit.way) && c.env.hold && c.env.descend) {
      c.env.hold(true);
      going = 0.001;
    }
  };
  c.rt.whirlpoolSpa.drainOffered = drainOffered;
  c.rt.whirlpoolSpa.enterDrain = enterDrain;

  let vortexYaw = 0;

  createBasin(c, {
    x0: -hs, z0: -hs, x1: hs, z1: hs,
    depth,
    waterY,
    tile: 'seafoam',
    wallTile: 'cobalt',
    waterTone: 'aqua',
    stepsSide: 'none',
    floorAtInner: spaFloor,
    onTick: (info, dt, t, me) => {
      spaState = stepWhirlpoolSpa(spaState, dt);
      const calmFactor = spaState.calmSec > 0 ? 0.28 : 1.0;

      // Spin central vortex rings smoothly with current `spaState.spin`
      vortexYaw += dt * 1.95 * calmFactor * spaState.spin;
      vortexMesh.rotation.y = vortexYaw;

      // Smoothly turn the NE valve handwheel toward target angle
      valveRot += (valveTargetRot - valveRot) * Math.min(1, dt * 8.0);
      valveMesh.rotation.x = valveRot;

      // Orbit the two empty inner tubes in the Jacuzzi
      for (let i = 0; i < orbiters.length; i++) {
        const o = orbiters[i];
        o.ang += dt * o.omega * calmFactor * spaState.spin;
        o.g.userData.kick?.(t, i * 2.1, .18 * calmFactor);
        const rWave = o.r + Math.sin(t * 1.4 + i * 2.1) * 0.06;
        o.g.position.set(
          Math.cos(o.ang) * rWave,
          waterY + o.yOff + Math.sin(t * 2.5 + i * 1.9) * 0.024,
          Math.sin(o.ang) * rWave,
        );
        o.g.rotation.y = -o.ang * 1.35 + i * 1.4;
        o.g.rotation.x = Math.sin(t * 2.2 + i) * 0.07;
        o.g.rotation.z = Math.cos(t * 1.9 + i * 1.5) * 0.07;
      }

      if (me.inside && me.world && !me.world.frozen && drainOffered() && Math.hypot(me.x, me.z) < DRAIN_TAKES) enterDrain();

      // Whirlpool current pushing wading swimmers (`whirlpoolField` from `waterpark.rule.js`)
      if (!going && me.inside && me.world && info.inBasin(me.x, me.z)) {
        const field = whirlpoolField(spaState, me.x, me.z, hs);
        if (field.inVortex) {
          const roomYaw = (c.room.rot * Math.PI) / 2;
          const cos = Math.cos(roomYaw), sin = Math.sin(roomYaw);
          me.world.vx += (field.vx * cos + field.vz * sin) * dt * 2.15;
          me.world.vz += (-field.vx * sin + field.vz * cos) * dt * 2.15;
        }
      }

      // Spiralling descent into the glowing floor drain!
      if (going > 0 && going < SINK + 1) {
        going += dt;
        const k = Math.min(1, going / SINK);
        const rad = (1 - k) * 0.85;
        const ang = going * 5.2 * spaState.spin;
        const lx = Math.cos(ang) * rad, lz = Math.sin(ang) * rad;
        const ww = c.toWorld(lx, lz);
        c.env.player?.setRidePose({ x:ww.x, z:ww.z, y:c.room.y + waterY + .2 - 1.35*k*k,
          yaw:(me.world?.yaw || 0) + dt*3.4*spaState.spin, pitch:-.45, bank:.1*spaState.spin });
        c.env.interfere?.(0.32 + 0.65 * k);
        if (going >= SINK) {
          going = SINK + 1;
          c.env.player?.setRidePose(null);
          if (!c.env.descend({ x: wCenter.x, z: wCenter.z })) {
            if (me.world) me.world.drop = 0;
            going = 0;
          }
          c.env.hold(false);
        }
      }
    },
  });
  const leave = c.rt.onLeave;
  c.rt.onLeave = () => {
    leave?.();
    if (going) {
      going = 0;
      c.env.player?.setRidePose(null);
      c.env.hold?.(false);
    }
  };
  finishPoolRoom(c,'whirlpool-flume');
}
