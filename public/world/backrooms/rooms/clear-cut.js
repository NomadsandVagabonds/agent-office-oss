// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Development (`clear-cut` — "the bulldozer at the edge of the trees, and the animals watching it").
//
// Half the indoor forest has been scraped down to raw rutted clay and rolled up
// like old office carpet to make way for "SYNERGY PINES — LUXURY CUBICLE COMMONS".
// Two faceless Corporate Developers in hard-hats and high-vis vests stand on sawn
// stumps gesturing with rolled blueprints while an autonomous CRT-headed Caterpillar
// Bulldozer (`bulldozerVox` + `stepDozer`) clears the grading lane a stretch further
// each pass, reverse alarm beeping as it backs up.
//
// Behind yellow caution tape at the edge of the last surviving thicket huddle the
// displaced woodland residents (`sadFoxVox` with bindle stick, `sadBadgerVox` with
// eviction notice, `sadOwlVox` on a briefcase, and a trembling ear-tagged `sadFawnVox`).
// Sneak behind the Bulldozer to pull its rear emergency hydraulic shutoff (`[E]`) —
// or blow the Trail Call (`call`) whistle to trip its wildlife-survey interlock —
// stopping the machine for good and opening the animals' stump cache!

import * as THREE from 'three';
import { Batch, WHITE, ticks } from '../kit.js';
import {
  forestRoom, woodlandLight, garble, trailSign, registerCallTarget,
  makeVoxGroup, placeVoxStack, stumpVox, campLanternVox,
  buildForestWater, peatWaterTex, ensureForestDetail,
  CEDAR_TIMBER, BLAZE_ORANGE,
} from '../forest.js';
import { thicket, keepLane } from '../forest-thicket.js';
import { occluderWall, placeStageSetClutter, buildPnwTerrain } from '../forest-maze.js';
import {
  bulldozerVox, developerVox,
  sadFoxVox, sadBadgerVox, sadOwlVox, sadFawnVox,
  fallenNurseLogVox, mossBoulderVox,
  rottingBinderPileVox, forestLitterVox, campCotVox,
} from '../forest-models.js';
import { makeDozer, stepDozer } from '../forest.rule.js';

const P = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** Raw graded clay & caterpillar tread ruts where the moss was scraped off. */
function gradedMudTex(kit) {
  return kit.tex.custom('forest:clearcut:mud', 128, 128, (g, w, h) => {
    P(g, '#594330', 0, 0, w, h);
    for (let i = 0; i < 1200; i++) {
      const x = Math.floor(hash(i) * w), y = Math.floor(hash(i + 401) * h), k = hash(i + 83);
      P(g, k < 0.36 ? '#473424' : k < 0.74 ? '#6b523b' : k < 0.94 ? '#7c6248' : '#36271b', x, y, 2, 1);
    }
    // Horizontal caterpillar grouser track imprints across the mud
    for (const ry of [24, 38, 86, 100]) {
      P(g, '#3d2c1e', 0, ry, w, 8);
      for (let gx = 2; gx < w; gx += 6) P(g, '#2b1e14', gx, ry + 1, 3, 6);
    }
  });
}

/** Architectural developer billboard showing grey cubicles paved over tree stumps. */
function developerBillboard(c, bx, bz, rot, brand, seed) {
  const tex = c.kit.tex.custom(`forest:billboard:${seed}`, 256, 144, (g, w, h) => {
    P(g, '#1f2d24', 0, 0, w, h);
    P(g, '#f2ead8', 5, 5, w - 10, h - 10);
    // Header banner
    P(g, '#1c4a32', 8, 8, w - 16, 26);
    garble(g, brand, 14, 10, w - 28, 22, { color: '#f7e594', size: 14, mess: 0.20 }, seed);

    // Architectural "artist rendering": sterile sky, rows of identical grey cubicles on concrete over buried roots
    P(g, '#b9d8e6', 12, 38, w - 24, 44);
    P(g, '#969c9e', 12, 80, w - 24, 34);
    for (let i = 0; i < 6; i++) {
      const cx = 20 + i * 38;
      P(g, '#666e73', cx, 62, 30, 26);
      P(g, '#cfd6da', cx + 3, 65, 24, 14);
      P(g, '#4aff86', cx + 9, 69, 10, 7); // little green CRT inside every cubicle!
    }
    // Copy-pasted image-generator glitch band
    g.drawImage(g.canvas, 18, 58, w - 52, 14, 30, 66, w - 52, 14);

    P(g, '#e0a01b', 8, h - 30, w - 16, 22);
    garble(g, 'PHASE II LUXURY CUBICLES · 0% TREES', 14, h - 28, w - 28, 18, { color: '#1b1a18', size: 11, mess: 0.24 }, seed + 7);
  }, { clamp: true });

  // Timber billboard posts & frame
  const cs = Math.cos(rot), sn = Math.sin(rot);
  for (const off of [-1.35, 1.35]) {
    const px = bx + cs * off, pz = bz - sn * off;
    c.flat.box(px - 0.08, 0, pz - 0.08, px + 0.08, 2.95, pz + 0.08, CEDAR_TIMBER, { skip: '-y' });
    c.solid(px - 0.12, pz - 0.12, px + 0.12, pz + 0.12, { tall: true });
  }
  c.board(c.mapped(`forest:billboard:${seed}`, tex, { side: THREE.DoubleSide }), bx, 2.05, bz, 3.1, 1.72, rot);
  c.reserve(bx, bz, 1.85);
}

export function build(c) {
  const { W, D, R, params: p, kit } = c;
  c.shell({ panels: false });
  woodlandLight(c, 4, 3, 1, 1.06, { mode: 'clearcut' });
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false, thicket: false });

  // Divide room:
  //   z in [-0.3 .. D/2 - 0.5]  -> Raw bulldozed mud & stump field ("Graded Parcel")
  //   z in [-1.85 .. -0.3]      -> Bulldozer active grading lane (`laneZ = -0.95`)
  //   z in [-D/2 + 0.5 .. -1.9] -> Last surviving woodland thicket & animal refuge!
  const mudZ0 = -1.75, mudZ1 = D / 2 - 0.52;
  const mudX0 = -W / 2 + 0.52, mudX1 = W / 2 - 0.52;
  const mudBatch = c.mapped('forest:clearcut:mud', gradedMudTex(kit));
  mudBatch.grid(
    [mudX0, 0.008, mudZ0], [0, 0, 1], [1, 0, 0],
    ticks(mudZ1 - mudZ0, 0.9, 0),
    ticks(mudX1 - mudX0, 0.9, 0),
    (u, v) => [(mudX0 + v) / 2.2, (mudZ0 + u) / 2.2],
    WHITE
  );

  // Shimmering muddy rainwater puddles pooled inside the deep caterpillar tread ruts!
  buildForestWater(
    c,
    [
      { x0: -5.4, z0: 2.35, x1: -1.8, z1: 3.65, depth: 0.10, waterY: 0.015 },
      { x0: 1.4, z0: 3.15, x1: 4.8, z1: 4.45, depth: 0.10, waterY: 0.015 },
    ],
    {
      map: peatWaterTex(kit, 'peat'),
      shallowHex: '#4f402a',
      deepHex: '#1b160f',
      foamHex: '#8c7a58',
      caustics: false,
    }
  );

  // Rolled-up cylinders of stripped moss-carpet sod stacked along the graded margin!
  for (const [rx, rz] of [[-W / 2 + 1.8, D / 2 - 2.1], [-W / 2 + 1.8, D / 2 - 2.85], [-W / 2 + 1.8, D / 2 - 2.48]]) {
    const ry = rz === D / 2 - 2.48 ? 0.46 : 0.22;
    c.flat.box(rx - 0.85, ry - 0.20, rz - 0.20, rx + 0.85, ry + 0.20, rz + 0.20, [0.20, 0.34, 0.16]);
    c.flat.box(rx - 0.87, ry - 0.12, rz - 0.12, rx + 0.87, ry + 0.12, rz + 0.12, [0.58, 0.53, 0.42]); // beige carpet backing core!
  }
  c.solid(-W / 2 + 0.92, D / 2 - 3.1, -W / 2 + 2.68, D / 2 - 1.85);
  c.reserve(-W / 2 + 1.8, D / 2 - 2.45, 1.35);

  // Developer architectural render billboard on the +X graded side
  const billX = Math.min(W / 2 - 2.9, 7.6), billZ = Math.min(D / 2 - 2.6, 6.2);
  developerBillboard(c, billX, billZ, -0.45, p.brand || 'SYNERGY PINES', p.seed || 41);

  // Keep doorways & the bulldozer track (`laneZ = -0.95`) completely clear of static props
  const laneZ = -0.95;
  const dozerX0 = -W / 2 + 3.6;
  const dozerMaxX = W / 2 - 3.6;
  keepLane(c, dozerX0 - 1.8, laneZ, dozerMaxX + 1.8, laneZ, 2.9);
  for (const dr of c.room.doors) {
    const dp = c.doorPoint(dr, 0.6);
    keepLane(c, dp.x, dp.z, 0, 2.4, 1.6);
  }

  // Yellow "EVICTION / REZONING" caution tape & orange survey stakes along `tapeZ = -2.15`
  // with two walkable gaps (`x = -3.8`, `x = 3.8`) so the player can step into the refuge!
  const tapeZ = -2.15;
  const postXs = [-W / 2 + 1.6, -5.2, -2.4, 0, 2.4, 5.2, W / 2 - 1.6];
  for (let i = 0; i < postXs.length; i++) {
    const px = postXs[i];
    c.flat.box(px - 0.05, 0, tapeZ - 0.05, px + 0.05, 0.98, tapeZ + 0.05, CEDAR_TIMBER, { skip: '-y' });
    c.flat.box(px - 0.055, 0.78, tapeZ - 0.055, px + 0.055, 0.94, tapeZ + 0.055, BLAZE_ORANGE);
    c.solid(px - 0.08, tapeZ - 0.08, px + 0.08, tapeZ + 0.08);
    if (i < postXs.length - 1 && i !== 1 && i !== 4) {
      const nx = postXs[i + 1];
      c.flat.box(px, 0.72, tapeZ - 0.012, nx, 0.80, tapeZ + 0.012, [0.92, 0.78, 0.12]);
    }
  }
  // Pink-ribboned wooden survey stakes scattered across the mud
  for (const [sx, sz] of [[-4.4, 2.6], [-1.2, 3.8], [2.8, 2.2], [5.4, 3.4]]) {
    if (!c.clear(sx, sz, 0.3)) continue;
    c.flat.box(sx - 0.025, 0, sz - 0.025, sx + 0.025, 0.56, sz + 0.025, CEDAR_TIMBER, { skip: '-y' });
    c.flat.box(sx, 0.46, sz - 0.01, sx + 0.16, 0.53, sz + 0.01, [0.95, 0.30, 0.62]);
  }

  // ---- Static Sculpted Vox Stack: Full-AO Developers on Stumps, Felled Logs, Stump Field & Refuge Props ----
  const refugeX = 0.0, refugeZ = -3.35;
  c.reserve(refugeX, refugeZ, 2.35);

  const staticEntries = [
    // Two faceless Corporate Developers standing proudly on sawn tree stumps surveying the clear-cut!
    { key: 'forest:stump:5', make: stumpVox(5), x: 3.6, y: 0, z: 4.1, rot: 0.4, scale: 0.032 },
    { key: 'forest:developer', make: developerVox(), x: 3.6, y: 0.48, z: 4.1, rot: Math.atan2(-3.6, -5.0), scale: 0.028 },
    { key: 'forest:stump:4', make: stumpVox(4), x: -3.9, y: 0, z: 4.4, rot: 1.9, scale: 0.032 },
    { key: 'forest:developer', make: developerVox(), x: -3.9, y: 0.48, z: 4.4, rot: Math.atan2(3.9, -5.2), scale: 0.028 },

    // Felled bleeding logs & clear-cut stumps in the mud (all full AO!)
    { key: 'forest:under:log', make: fallenNurseLogVox(), x: -5.8, y: 0, z: 1.5, rot: 0.42, scale: 0.034 },
    { key: 'forest:under:log', make: fallenNurseLogVox(), x: 5.6, y: 0, z: 1.2, rot: -0.55, scale: 0.034 },
    { key: 'forest:stump:6', make: stumpVox(6), x: -2.4, y: 0, z: 1.9, rot: 0.8, scale: 0.03 },
    { key: 'forest:stump:3', make: stumpVox(3), x: 1.9, y: 0, z: 2.9, rot: 2.1, scale: 0.03 },
    { key: 'forest:stump:7', make: stumpVox(7), x: -6.8, y: 0, z: 3.6, rot: 1.3, scale: 0.03 },
    { key: 'forest:stump:4', make: stumpVox(4), x: 6.4, y: 0, z: 3.3, rot: -1.1, scale: 0.03 },

    // Refuge stump & warm lantern beside the huddled woodland creatures
    { key: 'forest:stump:5', make: stumpVox(5), x: refugeX, y: 0, z: refugeZ - 0.55, rot: 0.2, scale: 0.032 },
    { key: 'forest:lantern', make: campLanternVox(), x: refugeX + 0.52, y: 0, z: refugeZ - 0.15, scale: 0.028 },
    { key: 'forest:under:boulder', make: mossBoulderVox(), x: refugeX - 1.55, y: 0, z: refugeZ - 0.35, rot: 0.9, scale: 0.034 },
  ];
  for (const [sx, sz, r] of [[3.6, 4.1, 0.36], [-3.9, 4.4, 0.36], [-2.4, 1.9, 0.28], [1.9, 2.9, 0.28], [-6.8, 3.6, 0.28], [6.4, 3.3, 0.28], [refugeX, refugeZ - 0.55, 0.3]]) {
    c.solid(sx - r, sz - r, sx + r, sz + r);
    c.reserve(sx, sz, r + 0.35);
    c.blot(sx, sz, 1.05, 1.05, { rgb: [0.05, 0.04, 0.02], a: 0.45 });
  }
  c.solid(-6.1, 0.8, -5.5, 2.2);
  c.solid(5.3, 0.5, 5.9, 1.9);
  placeVoxStack(c, `forest:clearcut:static:${c.room.id}`, staticEntries);

  // `detail: true` graded-lot woodchip/binder debris & abandoned cot at the clear-cut edge!
  const det = ensureForestDetail(c);
  det.pushVox({ key: 'forest:detail:cot', make: campCotVox(), x: -6.2, y: 0, z: 5.4, rot: 0.35, scale: 0.028 });
  for (const [lx, lz, rot, kind] of [
    [-3.1, 2.9, 0.8, 'binders'], [2.9, 4.2, 2.1, 'binders'],
    [-4.8, 1.6, 1.4, 'litter'], [4.5, 2.0, -0.7, 'litter'], [0.4, 2.8, 2.6, 'litter'], [-1.4, 4.8, 0.3, 'litter'],
  ]) {
    det.pushVox({ key: `forest:detail:${kind}`, make: kind === 'binders' ? rottingBinderPileVox() : forestLitterVox(), x: lx, y: 0.005, z: lz, rot, scale: 0.028 });
  }

  // ---- The Huddle of Sad Displaced Woodland Creatures (`z ~ -3.35`) ---------
  const critters = [
    { key: 'forest:sad:fox', make: sadFoxVox(), x: refugeX - 0.85, z: refugeZ + 0.20, rot: 0.22, scale: 0.028 },
    { key: 'forest:sad:badger', make: sadBadgerVox(), x: refugeX + 0.88, z: refugeZ + 0.24, rot: -0.25, scale: 0.028 },
    { key: 'forest:sad:owl', make: sadOwlVox(), x: refugeX, z: refugeZ - 0.55, y: 0.48, rot: 0.0, scale: 0.026 },
    { key: 'forest:sad:fawn', make: sadFawnVox(), x: refugeX - 0.18, z: refugeZ + 0.62, rot: 0.35, scale: 0.027 },
  ].map((spec) => {
    const g = makeVoxGroup(kit, spec.key, spec.make, spec.scale, { room: c.rt.u });
    g.position.set(spec.x, spec.y || 0, spec.z);
    g.rotation.y = spec.rot;
    c.add(g);
    c.after.push(() => g.userData.light(c.sample(spec.x, (spec.y || 0) + 0.45, spec.z)));
    return { g, baseY: spec.y || 0, baseRot: spec.rot, x: spec.x, z: spec.z };
  });
  if (c.rt.lights.length < 14) c.light(refugeX, 0.85, refugeZ, '#ffd685', 0.72, { bank: 3, k: 1.6, far: 6.0 });
  if (c.rt.lights.length < 15) c.light(0, 1.35, laneZ, '#fff2b2', 0.75, { bank: 3, k: 2.2, far: 8.5 });

  // Supplies sheltered behind the animals' stump cache!
  c.leave('snack', refugeX - 0.42, refugeZ - 0.92);
  c.leave('battery', refugeX + 0.42, refugeZ - 0.92);

  // Staggered stacked cordwood bunks & half-demolished painted-drywall hoarding breaking up long sightlines
  // on both the graded parcel and the remnant woods (while keeping the Bulldozer's lane 100% clear)!
  const clearCutGuard = [
    { x: 3.6, z: 4.1, r: 1.1 }, { x: -3.9, z: 4.4, r: 1.1 },
    { x: refugeX, z: refugeZ, r: 2.5 }, { x: billX, z: billZ, r: 2.1 },
  ];
  occluderWall(c, -2.6, 5.2, 1.4, 5.65, { style: 'cordwood', keepClear: clearCutGuard, h: 2.38 });
  occluderWall(c, -6.2, -5.8, -3.2, -5.55, { style: 'drywall', keepClear: clearCutGuard, h: 2.52 });
  occluderWall(c, 3.2, -5.8, 6.2, -5.55, { style: 'hedge', keepClear: clearCutGuard, h: 2.52 });
  placeStageSetClutter(c, [[0.2, 4.4], [-4.8, -3.8]]);

  // Dense claustrophobic last-stand AAA woodland filling the north half (`z < -2.45`, `big: true` 500k tier)!
  keepLane(c, -3.8, -1.8, refugeX - 1.2, refugeZ - 1.2, 1.4);
  keepLane(c, 3.8, -1.8, refugeX + 1.2, refugeZ - 1.2, 1.4);
  // Bulldozed raw dirt & basalt spoil mounds piled along the south edge of the graded parcel!
  buildPnwTerrain(c, {
    style: 'excavated',
    big: true,
    density: 1.15,
    maxHeight: 1.60,
    keepClear: [[3.6, 4.1, 1.2], [-3.9, 4.4, 1.2], [billX, billZ, 2.2]],
    region: (_x, z) => z > laneZ + 1.85,
  });
  c.rt._pnwBuilt = false; // allow `thicket` below to also build lush rainforest hills in `z < -2.45`!
  thicket(c, {
    tag: 'remnant',
    big: true,
    ordCap: 208000,
    budget: 132000,
    detCap: 244000,
    detBudget: 192000,
    hub: null,
    spacing: 0.78,
    trees: 48,
    companionStems: 42,
    under: 76,
    hillsOpt: { style: 'rainforest', density: 1.45, maxHeight: 2.25 },
    region: (_x, z) => z < -2.45,
  });

  // ---- Centerpiece Autonomous CRT-Bulldozer (`bulldozerVox` + `stepDozer`) --
  const dozerEnds = [
    dozerX0 + (dozerMaxX - dozerX0) * 0.45,
    dozerX0 + (dozerMaxX - dozerX0) * 0.74,
    dozerMaxX,
  ];
  let dozer = makeDozer(dozerX0, dozerEnds);
  let wantShutoff = false;
  let hitCooldown = 0;
  let beepClock = 0;
  let rumbleClock = 0;
  let metDozer = false;

  // `+Z` of `bulldozerVox` is blade-forward; facing `+X` means `rotation.y = Math.PI / 2`!
  const dozerRig = makeVoxGroup(kit, 'forest:bulldozer', bulldozerVox(), 0.038, { room: c.rt.u });
  dozerRig.position.set(dozer.x, 0, laneZ);
  dozerRig.rotation.y = Math.PI / 2;
  c.add(dozerRig);
  c.after.push(() => dozerRig.userData.light(c.sample(dozer.x, 1.1, laneZ)));

  // Live moving collider for the 3.1 m × 1.8 m tracked bulldozer chassis
  const a0 = c.toWorld(dozer.x - 1.55, laneZ - 0.88);
  const b0 = c.toWorld(dozer.x + 1.55, laneZ + 0.88);
  const dozerCol = {
    x0: Math.min(a0.x, b0.x), z0: Math.min(a0.z, b0.z),
    x1: Math.max(a0.x, b0.x), z1: Math.max(a0.z, b0.z),
    tall: false, on: true,
  };
  c.rt.colliders.push(dozerCol);

  // Rear red emergency hydraulic shutoff (`dozer.x - 1.45, laneZ`) — moves with the bulldozer!
  c.use({
    x: dozer.x - 1.45,
    z: laneZ,
    r: 1.75,
    label: 'pull emergency shutoff',
    when: () => dozer.mode !== 'stopped',
    use: () => { wantShutoff = true; },
  });
  const shutoffUse = c.rt.uses[c.rt.uses.length - 1];

  // Blowing the Trail Call (`call`) whistle trips the wildlife-survey acoustic interlock too!
  registerCallTarget(c, refugeX, refugeZ, () => { wantShutoff = true; }, {
    r: 15,
    when: () => dozer.mode !== 'stopped',
  });

  c.rt.clearCut = {
    get dozer() { return dozer; },
    stopNow() { wantShutoff = true; },
  };

  c.tick((dt, t, me) => {
    hitCooldown = Math.max(0, hitCooldown - dt);
    const step = stepDozer(dozer, dt, { inside: me.inside, shutoff: wantShutoff });
    wantShutoff = false;
    dozer = step.state;

    const wDozer = c.toWorld(dozer.x, laneZ);
    const wRear = c.toWorld(dozer.x - 1.48, laneZ);
    shutoffUse.wx = wRear.x;
    shutoffUse.wz = wRear.z;

    // Update live world-space collider box
    const ca = c.toWorld(dozer.x - 1.45, laneZ - 0.84);
    const cb = c.toWorld(dozer.x + 1.55, laneZ + 0.84);
    dozerCol.x0 = Math.min(ca.x, cb.x); dozerCol.x1 = Math.max(ca.x, cb.x);
    dozerCol.z0 = Math.min(ca.z, cb.z); dozerCol.z1 = Math.max(ca.z, cb.z);

    if (!metDozer && me.inside && Math.hypot(me.x - dozer.x, me.z - laneZ) < 11 && c.seen(dozer.x, laneZ, { radius: 1.2 })) {
      metDozer = true;
      c.met('clearcut-dozer');
    }

    if (step.started) {
      c.env.play?.('whir', wDozer.x, wDozer.z, 12);
    }
    if (step.stopped) {
      c.env.play?.('thunk', wDozer.x, wDozer.z, 12);
      c.env.play?.('dissolve', wDozer.x, wDozer.z, 9);
      c.survived('clearcut-dozer');
    }

    if (dozer.mode !== 'stopped') {
      // Diesel chug vibration & reverse backup alarm (`beep`)
      const vib = step.dir !== 0 ? Math.sin(t * 38) * 0.016 : Math.sin(t * 18) * 0.006;
      dozerRig.position.set(dozer.x, Math.abs(vib), laneZ);
      dozerRig.rotation.z = vib * 1.2;

      if (step.dir !== 0 && me.inside) {
        rumbleClock -= dt;
        if (rumbleClock <= 0) {
          rumbleClock = 0.55;
          c.env.play?.('furnitureRoll', wDozer.x, wDozer.z, 9);
        }
      }
      if (step.beep && me.inside) {
        beepClock -= dt;
        if (beepClock <= 0) {
          beepClock = 0.68;
          c.env.play?.('beep', wRear.x, wRear.z, 11);
        }
      }

      // Blade / rear bumper knock if visitor stands directly in its path while moving
      if (me.inside && step.dir !== 0 && hitCooldown <= 0) {
        const frontEdge = step.dir > 0 ? dozer.x + 1.72 : dozer.x - 1.65;
        if (Math.abs(me.x - frontEdge) < 0.48 && Math.abs(me.z - laneZ) < 0.98) {
          hitCooldown = 2.0;
          c.hurt(1);
          c.env.interfere?.(0.85);
          c.env.hud?.glitch?.(0.5);
          c.env.play?.('thunk', wDozer.x, wDozer.z, 10);
        }
      }
    } else {
      dozerRig.position.set(dozer.x, 0, laneZ);
      dozerRig.rotation.z = 0;
    }

    // Woodland creatures: tremble sadly while the bulldozer runs; perk up & hop gently once saved!
    for (let i = 0; i < critters.length; i++) {
      const cr = critters[i];
      if (dozer.mode === 'stopped') {
        cr.g.position.y = cr.baseY + Math.abs(Math.sin(t * 4.2 + i * 1.1)) * 0.045;
        cr.g.rotation.y = cr.baseRot + Math.sin(t * 2.0 + i) * 0.12;
      } else {
        cr.g.position.y = cr.baseY;
        cr.g.rotation.y = cr.baseRot + Math.sin(t * 22 + i * 2.3) * 0.018;
      }
    }

    if (c.rt.group.visible && Math.floor(t * 2) !== Math.floor((t - dt) * 2)) {
      dozerRig.userData.light(c.sample(dozer.x, 1.1, laneZ));
    }
  });

  const spSign = c.wallSpot(1.55, ['front', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      'PARCEL B REZONING SITE',
      'WILDLIFE HAS BEEN NOTIFIED',
    ], { seed: (p.seed || 17) % 89, warn: true });
  }
}
