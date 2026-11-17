// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Sapling Archive (`nursery-aisles` — "the fifty white birch stems with eyes in their bark").
//
// Where the Records Archive and the Offsite Forest crossbred: 55+ slender white
// paper-birch poles (`denseBirchStemVox` + `eyebirchVox`) erupt in dense
// vertical black-and-white barcode curtains out of rusted grey steel filing
// drawers and damp moss beds!
//
// Six of the birches (`eyebirchVox`) have wet glowing amber eyes set into their
// horizontal black bark lenticels (`stepEyeGrove`):
//   - Walk upright (`!crouch`) within 2.15 m of an open eye-scar and the birch
//     curtain whispers (`rustle` -> 10% camcorder battery static drain)!
//   - Crouch (`C`) to stay below eye-scar level, OR sweep your flashlight beam
//     (`inFlashlight`) across a stem to slam its bark eyelids shut for 5 s!

import { inFlashlight } from '../flashlight.js';
import {
  forestRoom, woodlandLight, trailSign, registerCallTarget,
  makeVoxGroup, placeVoxStack, ensureForestDetail, campLanternVox,
  CEDAR_TIMBER,
} from '../forest.js';
import { thicket, keepLane } from '../forest-thicket.js';
import { occluderWall, addMistVeils } from '../forest-maze.js';
import {
  eyebirchVox, denseBirchStemVox, rottingBinderPileVox,
} from '../forest-models.js';
import { makeEyeGrove, stepEyeGrove } from '../forest.rule.js';

export function build(c) {
  const { W, D, H, R, kit, params: p } = c;
  c.shell({ panels: false });
  woodlandLight(c, 3, 3, 1, 0.94, {
    mode: 'canopy',
    deadRatio: 0.34,
    shaftTint: [0.86, 0.96, 0.78],
  });
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false, thicket: false });

  // Build 6 staggered 2.42 m Rusted Archive Shelving Canyon Stacks (`tall: true`)
  // so visitors weave around tight blind filing-stack corners right into Eye-Scar Birches!
  const ax = W * 0.24, az = D * 0.24;
  const kc = [{ x: 0, z: 0, r: 1.55 }];
  occluderWall(c, -ax - 0.24, -az * 1.15, -ax + 0.24, az * 0.35, { style: 'archive', keepClear: kc, h: 2.42 });
  occluderWall(c, ax - 0.24, -az * 0.35, ax + 0.24, az * 1.15, { style: 'archive', keepClear: kc, h: 2.42 });
  occluderWall(c, -ax * 0.85, az - 0.22, ax * 0.55, az + 0.22, { style: 'archive', keepClear: kc, h: 2.42 });
  occluderWall(c, -ax * 0.55, -az - 0.22, ax * 0.85, -az + 0.22, { style: 'archive', keepClear: kc, h: 2.42 });
  occluderWall(c, -W * 0.36, 0.45, -ax - 0.85, 0.88, { style: 'cubicle', keepClear: kc, h: 2.32 });
  occluderWall(c, ax + 0.85, -0.88, W * 0.36, -0.45, { style: 'cubicle', keepClear: kc, h: 2.32 });

  addMistVeils(c, [
    { x0: -ax, z0: az * 0.65, x1: 0, z1: az * 0.65 },
    { x0: 0, z0: -az * 0.65, x1: ax, z1: -az * 0.65 },
  ], { color: [0.14, 0.16, 0.13], alpha: 0.58 });

  keepLane(c, 0, D / 2 - 1.1, -ax * 0.5, az + 0.9, 1.28);
  keepLane(c, -ax + 0.95, 0, 0, 0, 1.28);
  keepLane(c, 0, 0, ax - 0.95, 0, 1.28);
  keepLane(c, -ax - 0.9, -az * 0.5, -W / 2 + 1.05, -D / 2 + 1.05, 1.26);
  for (const dr of c.room.doors) {
    const dp = c.doorPoint(dr, 0.55);
    keepLane(c, dp.x, dp.z, Math.sign(dp.x) * 1.6, Math.sign(dp.z) * 1.6, 1.30);
  }
  c.reserve(0, 0, 1.32);

  // Central Open Lateral Archive Cabinet & Lantern Cache (`0, 0`)
  c.flat.box(-0.62, 0, -0.34, 0.62, 0.88, 0.34, [0.38, 0.41, 0.40], { skip: '-y' });
  c.flat.box(-0.56, 0.38, 0.30, 0.56, 0.68, 0.68, [0.46, 0.49, 0.48]); // pulled-open file drawer!
  c.flat.box(-0.50, 0.64, 0.34, 0.50, 0.70, 0.64, [0.82, 0.74, 0.52]); // manila folders
  c.solid(-0.64, -0.36, 0.64, 0.70);
  c.leave('tape', -0.24, 0.48, { y: 0.70 });
  c.leave('snack', 0.24, 0.48, { y: 0.70 });
  placeVoxStack(c, `forest:nursery:center:${c.room.id}`, [
    { key: 'forest:nursery:lantern', make: campLanternVox(), x: -0.38, y: 0.88, z: 0, scale: 0.026 },
  ]);
  if (c.rt.lights.length < 13) c.light(0, 1.25, 0.25, '#ffe094', 0.75, { bank: 3, k: 1.6, far: 5.8 });

  // ---- 6 Blinking Eye-Scar Birches (`eyebirchVox`) flanking the serpentine path ----
  const bScale = 0.032;
  const tallVox = Math.max(84, Math.round((H + 0.14) / bScale));
  const eyeCandidates = [
    [-ax + 0.95, az * 0.55 + 0.85],
    [-ax - 0.95, az * 0.15],
    [-1.15, -0.95],
    [1.15, 0.95],
    [ax - 0.95, -az * 0.55 - 0.85],
    [ax + 0.95, -az * 0.15],
  ].filter(([ex, ez]) => Math.abs(ex) < W / 2 - 0.8 && Math.abs(ez) < D / 2 - 0.8 && c.clear(ex, ez, 0.36));

  const eyeStems = eyeCandidates.map(([ex, ez], idx) => {
    const openGroup = makeVoxGroup(kit, `forest:eyebirch:${tallVox}`, eyebirchVox(tallVox), bScale, { room: c.rt.u });
    const shutGroup = makeVoxGroup(kit, `forest:birchstem:${tallVox}`, denseBirchStemVox(tallVox), bScale, { room: c.rt.u });
    openGroup.position.set(ex, 0, ez);
    shutGroup.position.set(ex, 0, ez);
    shutGroup.visible = false;
    c.add(openGroup);
    c.add(shutGroup);
    c.after.push(() => {
      const rgb = c.sample(ex, 1.2, ez);
      openGroup.userData.light(rgb);
      shutGroup.userData.light(rgb);
    });
    c.solid(ex - 0.24, ez - 0.22, ex + 0.24, ez + 0.22, { tall: true });
    c.reserve(ex, ez, 0.45);
    c.blot(ex, ez, 1.1, 1.1, { rgb: [0.05, 0.06, 0.04], a: 0.45 });
    return { x: ex, z: ez, wPos: c.toWorld(ex, ez), openGroup, shutGroup, idx };
  });

  let eyeState = makeEyeGrove(eyeStems.length);
  let known = false;

  // Sounding the Trail Call (`call`) startles all eye-scars shut for 5 seconds!
  registerCallTarget(c, 0, 0, () => {
    eyeState = { ...eyeState, shut: eyeState.shut.map(() => 5.0) };
  }, { r: 14 });

  // ---- Dense Curtain of 85+ Slender White Paper-Birch Poles! ----------------
  const grove = thicket(c, {
    tag: 'birchcurtain',
    ordCap: 112000,
    budget: 88000,
    detCap: 108000,
    detBudget: 96000,
    hub: null,
    spacing: 0.74,
    trees: 54,
    companionStems: 42,
    under: 44,
    species: { birchStem: 9, birch: 1 },
  });
  c.rt.treeCount = grove.trees.length + grove.companions + eyeStems.length;

  const det = ensureForestDetail(c);
  for (let i = 0; i < 8; i++) {
    det.pushVox({
      key: 'forest:detail:binders',
      make: rottingBinderPileVox(),
      x: R.range(-W / 2 + 1.0, W / 2 - 1.0),
      y: 0.004,
      z: R.range(-D / 2 + 1.0, D / 2 - 1.0),
      rot: R.range(0, 6.28),
      scale: 0.028,
    });
  }

  c.tick((dt, _t, me) => {
    if (!me.inside || !eyeStems.length) return;
    const keys = c.env.player?.input?.keys;
    const crouch = !!(keys && keys.has('c'));
    const torchPow = c.env.inventory?.torchPower?.() || 0;
    const meW = c.toWorld(me.x, me.z);

    const dists = [];
    const litMask = [];

    for (let i = 0; i < eyeStems.length; i++) {
      const st = eyeStems[i];
      const d = Math.hypot(me.x - st.x, me.z - st.z);
      dists.push(d);

      // Open eye-scars slowly turn to watch the visitor!
      if (eyeState.shut[i] <= 0) {
        st.openGroup.rotation.y = Math.atan2(me.x - st.x, me.z - st.z);
      }

      const lit = torchPow > 0.05 && me.world && inFlashlight(
        { x: meW.x, y: me.world.y || 1.5, z: meW.z, yaw: me.world.yaw || 0, pitch: me.world.pitch || 0, mounted: !!c.env.inventory?.mounted?.() },
        { x: st.wPos.x, y: c.room.y || 0, z: st.wPos.z },
        { power: torchPow, los: c.world.los(meW.x, meW.z, st.wPos.x, st.wPos.z), bottom: 0.9, top: 1.8, radius: 0.25 }
      );
      litMask.push(!!lit);

      if (!known && d < 5.5 && c.seen(st.x, st.z, { radius: 0.35 })) {
        known = true;
        c.met('eye-birches');
      }
    }

    const res = stepEyeGrove(eyeState, dt, { inside: true, crouch, dists, litMask });
    eyeState = res.state;

    for (let i = 0; i < eyeStems.length; i++) {
      const closed = eyeState.shut[i] > 0;
      eyeStems[i].openGroup.visible = !closed;
      eyeStems[i].shutGroup.visible = closed;
    }

    if (res.blinkedShut) {
      c.env.play?.('clack', meW.x, meW.z, 7);
    }
    if (res.whispered) {
      c.env.play?.('rustle', meW.x, meW.z, 8);
    }
    if (res.drained > 0) {
      c.env.play?.('static', meW.x, meW.z, 8);
      c.env.camera?.drain?.(res.drained);
      c.env.interfere?.(0.65);
      c.env.hud?.glitch?.(0.35);
      if (known) c.survived('eye-birches');
    }
  });

  const spSign = c.wallSpot(1.55, ['front', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      `SAPLING ARCHIVE ${p.fileCode || 'REC-58'}`,
      'RETENTION PERIOD: 80 YEARS',
    ], { seed: 257 + R.int(0, 9), warn: true });
  }
}
