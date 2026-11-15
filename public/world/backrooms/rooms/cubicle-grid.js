// The Open-Plan Pit ("the sunken cubicle grid you walk across on top"):
// Beyond a narrow carpeted foyer, the floor drops sheerly away into a 4x4 grid
// of deep, shadowy 12-foot sunken Backrooms cubicles. Only the 0.50 m partition
// wall caps connect across the chasm to a far bulkhead fire door — with two
// interior spans buckled out so you must navigate real 90-degree tightrope
// turns. Step onto the grid and pale, ear-to-ear Smiling Office Workers uncurl
// from their glowing CRTs below, clawing slowly hand-over-hand up the wallpaper
// to pursue you along the beams until you cross and slam the bulkhead door shut.
// Slipping off any partition cap into a cubicle is fatal.
import * as THREE from 'three';
import { Batch, lin, ticks, WHITE } from '../kit.js';
import { headAt } from '../gen.js';
import { clamp, card, framed, wetSign, doorFrame } from '../bits.js';
import {
  GRID,
  buildGridPlan,
  gridFloorY,
  createGridRoomState,
  stepGridRoom,
  createClerkState,
  snipClerk,
  releaseClerk,
  stepClerk,
} from './cubicle-grid/rule.js';
import {
  makeGridTextures,
  pitCrtVox,
  watercoolerVox,
  buildSmilingClimber,
} from './cubicle-grid/rig.js';

function hangBulkheadDoor(c, zLine, doorHalfW) {
  const dw = doorHalfW * 2 - 0.04;
  const dh = 2.06;
  const hx = -dw / 2, hz = zLine - 0.04;

  const leafB = new Batch();
  const steel = lin('#6a332d'), trim = lin('#d8d2c2'), barCol = [0.76, 0.74, 0.68], wireCol = lin('#25282c');
  const wx0 = hx + dw * 0.28, wx1 = hx + dw * 0.72, wy0 = 1.04, wy1 = 1.58;
  // Door leaf built around a real barred vision cutout so you can see the grinning clerks pressed outside once shut!
  leafB.box(hx, 0.02, hz - 0.024, hx + dw, wy0, hz + 0.024, steel);
  leafB.box(hx, wy1, hz - 0.024, hx + dw, dh, hz + 0.024, steel);
  leafB.box(hx, wy0, hz - 0.024, wx0, wy1, hz + 0.024, steel);
  leafB.box(wx1, wy0, hz - 0.024, hx + dw, wy1, hz + 0.024, steel);
  // Vision window steel bezel + security wire bars
  leafB.box(wx0 - 0.025, wy0 - 0.025, hz - 0.032, wx1 + 0.025, wy0, hz + 0.032, trim);
  leafB.box(wx0 - 0.025, wy1, hz - 0.032, wx1 + 0.025, wy1 + 0.025, hz + 0.032, trim);
  leafB.box(wx0 - 0.025, wy0, hz - 0.032, wx0, wy1, hz + 0.032, trim);
  leafB.box(wx1, wy0, hz - 0.032, wx1 + 0.025, wy1, hz + 0.032, trim);
  for (const f of [0.25, 0.50, 0.75]) {
    const bx = wx0 + (wx1 - wx0) * f;
    leafB.box(bx - 0.006, wy0, hz - 0.008, bx + 0.006, wy1, hz + 0.008, wireCol);
    const by = wy0 + (wy1 - wy0) * f;
    leafB.box(wx0, by - 0.006, hz - 0.008, wx1, by + 0.006, hz + 0.008, wireCol);
  }
  // Push-bar on both faces
  leafB.box(hx + 0.14, 0.86, hz - 0.052, hx + dw - 0.14, 0.92, hz + 0.052, barCol);

  const door = c.dynamic(leafB, { pivot: [hx, 0, hz] });
  const bar = c.solid(-doorHalfW, zLine - 0.13, doorHalfW, zLine + 0.13, { tall: true, on: false });

  // Swings northward (-z) into the North Safe Sanctuary so it never sweeps anybody off the center beam
  const openAngle = 1.46;
  let isOpen = true, anim = 1;
  door.rotation.y = openAngle;

  const wPos = c.toWorld(0, zLine);
  c.use({
    x: 0, z: zLine - 0.25, r: 1.85, cone: 0.15,
    label: 'shut bulkhead door',
    use: () => {
      isOpen = !isOpen;
      bar.on = !isOpen;
      c.env.play(isOpen ? 'door' : 'thunk', wPos.x, wPos.z, 7);
    },
  });
  c.tick((dt) => {
    const want = isOpen ? 1 : 0;
    if (Math.abs(anim - want) < 0.002) return;
    anim += (want - anim) * Math.min(1, dt * 9.5);
    door.rotation.y = openAngle * anim;
  });

  // Reserve swing arc inside North Sanctuary so stashed tapes / props stay clear
  c.reserve(0, zLine - 0.75, 0.85);
  return { isShut: () => !isOpen };
}

function hangOuterDoor(c, dr) {
  const { W, D } = c;
  const dw = Math.min(dr.w - 0.06, 1.18), dh = Math.min(dr.h - 0.03, 2.02);
  doorFrame(c, dr.side, dr.c, dw, dh, lin('#4a5058'), 0.05, 0.065);
  const p = c.wallAt(dr.side, dr.c, 0.03), U = p.U, n = p.n;
  const hx = p.x - U[0] * (dw / 2), hz = p.z - U[2] * (dw / 2);

  const leafB = new Batch();
  const steel = lin('#6a332d'), trim = lin('#d8d2c2'), barCol = [0.76, 0.74, 0.68];
  const x0 = Math.min(hx, hx + U[0] * dw) - Math.abs(n[0]) * 0.024;
  const x1 = Math.max(hx, hx + U[0] * dw) + Math.abs(n[0]) * 0.024;
  const z0 = Math.min(hz, hz + U[2] * dw) - Math.abs(n[2]) * 0.024;
  const z1 = Math.max(hz, hz + U[2] * dw) + Math.abs(n[2]) * 0.024;
  leafB.box(x0, 0.02, z0, x1, dh, z1, steel);
  leafB.box(
    Math.min(hx + U[0] * 0.14, hx + U[0] * (dw - 0.14)) - Math.abs(n[0]) * 0.05, 0.94,
    Math.min(hz + U[2] * 0.14, hz + U[2] * (dw - 0.14)) - Math.abs(n[2]) * 0.05,
    Math.max(hx + U[0] * 0.14, hx + U[0] * (dw - 0.14)) + Math.abs(n[0]) * 0.05, 1.00,
    Math.max(hz + U[2] * 0.14, hz + U[2] * (dw - 0.14)) + Math.abs(n[2]) * 0.05, barCol,
  );
  leafB.box(
    Math.min(hx + U[0] * (dw * 0.35), hx + U[0] * (dw * 0.65)) - Math.abs(n[0]) * 0.028, 1.35,
    Math.min(hz + U[2] * (dw * 0.35), hz + U[2] * (dw * 0.65)) - Math.abs(n[2]) * 0.028,
    Math.max(hx + U[0] * (dw * 0.35), hx + U[0] * (dw * 0.65)) + Math.abs(n[0]) * 0.028, 1.62,
    Math.max(hz + U[2] * (dw * 0.35), hz + U[2] * (dw * 0.65)) + Math.abs(n[2]) * 0.028, trim,
  );
  const door = c.dynamic(leafB, { pivot: [hx, 0, hz] });

  const cx = p.x, cz = p.z;
  const bar = c.solid(
    cx - Math.abs(U[0]) * (dw / 2) - Math.abs(n[0]) * 0.12,
    cz - Math.abs(U[2]) * (dw / 2) - Math.abs(n[2]) * 0.12,
    cx + Math.abs(U[0]) * (dw / 2) + Math.abs(n[0]) * 0.12,
    cz + Math.abs(U[2]) * (dw / 2) + Math.abs(n[2]) * 0.12,
    { tall: true, on: false },
  );

  const openAngle = -1.42;
  let isOpen = true, anim = 1;
  door.rotation.y = openAngle;
  const th = c.world.throats[dr.link];
  if (th) th.open = true;

  const wPos = c.toWorld(cx, cz);
  c.use({
    x: cx, z: cz, r: 1.65, cone: 0.2,
    label: 'shut fire door',
    use: () => {
      isOpen = !isOpen;
      bar.on = !isOpen;
      if (th) th.open = isOpen;
      c.env.play(isOpen ? 'door' : 'thunk', wPos.x, wPos.z, 6);
    },
  });
  c.tick((dt) => {
    const want = isOpen ? 1 : 0;
    if (Math.abs(anim - want) < 0.002) return;
    anim += (want - anim) * Math.min(1, dt * 9);
    door.rotation.y = openAngle * anim;
  });
  c.reserve(clamp(cx + n[0] * 0.6, -W / 2 + 0.5, W / 2 - 0.5), clamp(cz + n[2] * 0.6, -D / 2 + 0.5, D / 2 - 0.5), 0.75);
  return { isShut: () => !isOpen };
}

export function build(c) {
  const { W, D, H, R, look, params: p } = c;
  const plan = buildGridPlan(W, D, H, p.brokenSide ?? 1);
  const tex = makeGridTextures(c, p);

  let roomState = createGridRoomState();

  // Heightfield hook: returns fallY while plummeting into a cubicle, else the tightrope/lip/pit heightfield
  c.rt.floorY = (x, z) => {
    if (roomState.falling) return roomState.fallY;
    return Math.max(c.floorAt(x, z), gridFloorY(plan, x, z));
  };
  c.rt.headY = (x, z) => headAt(c.room, x, z);

  // Build room shell with outer wallpaper, doorways, ceiling & level-matched tubes, omitting the y=0 center carpet
  c.shell({ floor: false, skirting: false });

  // Reserve North Safe Sanctuary tape stash spots
  c.reserve(-W / 2 + 1.35, -D / 2 + 1.06, 0.65);
  c.reserve(W / 2 - 1.35, -D / 2 + 1.06, 0.65);

  const trim = lin(look.trim);
  const darkSteel = lin('#23221f');
  const hazardYel = lin('#dfb022');
  const deskWood = lin('#5a432d');
  const cabGrey = lin('#55585c');

  const capB = c.mapped('cg:cap', tex.cap);
  const cautionB = c.mapped('cg:caution', tex.caution);
  const warnSignB = c.mapped('cg:warn', tex.signWarn);
  const paperB = c.mapped('cg:paper', c.kit.tex.paper());
  const crtGlowB = c.shining('cg:crts', tex.crtAtlas, 1.95, WHITE);
  const abyssGlowB = c.shining('cg:abyss', tex.abyssGlow, 2.05, WHITE);

  /* ---- 1. South Entry Foyer & North Safe Sanctuary Carpets (y = 0) ---- */
  const carpetRect = (x0, z0, x1, z1, y = 0, aoFn = () => 0.92) => {
    c.floor.grid(
      [x0, y, z0], [0, 0, 1], [1, 0, 0],
      ticks(z1 - z0, 0.6), ticks(x1 - x0, 0.6),
      (u, v) => [(x0 + v + c.room.cx) / 1.6, (z0 + u + c.room.cz) / 1.6],
      WHITE, aoFn,
    );
  };
  carpetRect(-W / 2, plan.gridZ1, W / 2, D / 2, 0);
  carpetRect(-W / 2, -D / 2, W / 2, plan.gridZ0, 0);

  // Skirting along South Foyer & North Sanctuary outer walls
  c.flat.box(-W / 2, 0, plan.gridZ1, -W / 2 + 0.025, 0.11, D / 2, trim, { skip: '-y' });
  c.flat.box(W / 2 - 0.025, 0, plan.gridZ1, W / 2, 0.11, D / 2, trim, { skip: '-y' });
  c.flat.box(-W / 2, 0, -D / 2, -W / 2 + 0.025, 0.11, plan.gridZ0, trim, { skip: '-y' });
  c.flat.box(W / 2 - 0.025, 0, -D / 2, W / 2, 0.11, plan.gridZ0, trim, { skip: '-y' });

  // Painted yellow/black hazard threshold edge along the South Foyer lip
  c.lay(c.flat, 0, plan.gridZ1 + 0.08, W - 0.4, 0.08, 0, null, hazardYel, 0.008);
  const signX = clamp(-1.85, -W / 2 + 1.0, W / 2 - 1.0);
  if (c.clear(signX, plan.gridZ1 + 0.65, 0.42)) {
    wetSign(c, signX, plan.gridZ1 + 0.65, 0.25, ['WATCH STEP', 'CUBICLES BELOW']);
    c.reserve(signX, plan.gridZ1 + 0.65, 0.45);
  }

  // Framed corporate warning placard on a free South Foyer wall
  const foyerSignSpot = c.wallSpot(1.3, ['left', 'right'], 0.35, 2.1);
  if (foyerSignSpot) {
    framed(c, warnSignB, foyerSignSpot.side, clamp(foyerSignSpot.at, D / 2 - 1.9, D / 2 - 0.8), 1.52, 0.96, 0.72);
  } else {
    // Fallback standing sign post on the right side of the foyer lip
    const px = W / 2 - 1.15, pz = plan.gridZ1 + 0.55;
    c.flat.box(px - 0.03, 0, pz - 0.03, px + 0.03, 1.48, pz + 0.03, darkSteel);
    warnSignB.quad([px - 0.42, 1.02, pz + 0.04], [px + 0.42, 1.02, pz + 0.04], [px + 0.42, 1.62, pz + 0.04], [px - 0.42, 1.62, pz + 0.04]);
  }

  /* ---- 2. North Bulkhead Partition Wall (z = gridZ0) & Hinged Fire Doors ---- */
  const bZ0 = plan.gridZ0 - 0.11, bZ1 = plan.gridZ0 + 0.11;
  const dHW = GRID.doorHalfW, dTop = 2.08;
  const wallFace = (o, U, len, y0, y1, aoTop = 0.94) => {
    if (len < 0.02 || y1 - y0 < 0.02) return;
    c.wall.grid(
      o, U, [0, 1, 0],
      ticks(len, 0.55, 0.08), ticks(y1 - y0, 0.5, 0.08),
      (u, v) => [u / 0.8, (y0 + v) / 0.8],
      WHITE,
      (u, v) => {
        const y = y0 + v;
        if (y < 0) return 0.18 + 0.76 * clamp((y - GRID.pitDepth) / -GRID.pitDepth, 0, 1);
        return 0.82 + (aoTop - 0.82) * Math.sin(clamp(v / (y1 - y0), 0, 1) * Math.PI);
      },
    );
  };

  // Left & right full-height bulkhead wings + header over the 1.36 m centered doorway
  const wingW = W / 2 - dHW;
  // South-facing (toward pit)
  wallFace([-W / 2, 0, bZ1], [1, 0, 0], wingW, 0, H);
  wallFace([dHW, 0, bZ1], [1, 0, 0], wingW, 0, H);
  wallFace([-dHW, dTop, bZ1], [1, 0, 0], dHW * 2, dTop, H);
  // North-facing (toward sanctuary)
  wallFace([-dHW, 0, bZ0], [-1, 0, 0], wingW, 0, H);
  wallFace([W / 2, 0, bZ0], [-1, 0, 0], wingW, 0, H);
  wallFace([dHW, dTop, bZ0], [-1, 0, 0], dHW * 2, dTop, H);
  // Doorway jamb cheeks & header soffit + steel frame
  c.flat.box(-dHW - 0.04, 0, bZ0 - 0.02, -dHW + 0.02, dTop + 0.04, bZ1 + 0.02, darkSteel);
  c.flat.box(dHW - 0.02, 0, bZ0 - 0.02, dHW + 0.04, dTop + 0.04, bZ1 + 0.02, darkSteel);
  c.flat.box(-dHW - 0.04, dTop, bZ0 - 0.02, dHW + 0.04, dTop + 0.06, bZ1 + 0.02, darkSteel);
  // Solid colliders for left & right bulkhead wings (keep: true so doorway flood-fill respects the centered door)
  c.solid(-W / 2, bZ0, -dHW, bZ1, { tall: true, keep: true });
  c.solid(dHW, bZ0, W / 2, bZ1, { tall: true, keep: true });

  // Glowing green SHUT DOOR / SAFE ZONE sign above the North Bulkhead Doorway (visible all the way from entrance!)
  const bulkheadSignTex = card(c, 'cg:bulkhead-exit', ['SAFE ZONE  ·  SHUT DOOR'], {
    w: 192, h: 36, bg: '#0c3b22', fg: '#e6fff0', edge: '#249c58', size: 12, pad: 4,
  });
  const exitGlowB = c.shining('cg:exit-sign', bulkheadSignTex, 2.15, WHITE);
  exitGlowB.quad([-0.52, dTop + 0.14, bZ1 + 0.025], [0.52, dTop + 0.14, bZ1 + 0.025], [0.52, dTop + 0.36, bZ1 + 0.025], [-0.52, dTop + 0.36, bZ1 + 0.025]);
  c.light(0, dTop + 0.22, bZ1 + 0.35, '#58e08c', 0.42, { k: 1.2, far: 5.5 });

  const northBulkheadDoor = hangBulkheadDoor(c, plan.gridZ0, dHW);
  const frontDoors = c.room.doors
    .filter((dr) => dr.side === 'front' && dr.sill < 0.05 && dr.h > 1.7)
    .map((dr) => hangOuterDoor(c, dr));
  // Hang standard fire doors on back doorway too if present
  c.room.doors
    .filter((dr) => dr.side !== 'front' && dr.sill < 0.05 && dr.h > 1.7)
    .forEach((dr) => hangOuterDoor(c, dr));

  /* ---- 3. Sunken Cubicle Perimeter & 4x4 Partition Grid Walls (y = -3.60 .. 0) ---- */
  const pitY = GRID.pitDepth;
  const hw = GRID.beamHalfW;

  // Outer perimeter pit walls continuing room wallpaper down to -3.60 m (normals pointing inward into pit)
  wallFace([-W / 2, pitY, plan.gridZ1], [0, 0, -1], plan.gridZ1 - plan.gridZ0, pitY, 0);
  wallFace([W / 2, pitY, plan.gridZ0], [0, 0, 1], plan.gridZ1 - plan.gridZ0, pitY, 0);
  wallFace([W / 2, pitY, plan.gridZ1], [-1, 0, 0], W, pitY, 0);
  wallFace([-W / 2, pitY, plan.gridZ0], [1, 0, 0], W, pitY, 0);

  // Helper to build a wallpapered sunken partition wall segment from y = pitY up to topY, capped with slotted rail
  const buildPartitionWall = (x0, z0, x1, z1, topY = 0, addTopCap = true) => {
    const w = x1 - x0, d = z1 - z0;
    wallFace([x0, pitY, z1], [1, 0, 0], w, pitY, topY);
    wallFace([x1, pitY, z0], [-1, 0, 0], w, pitY, topY);
    wallFace([x1, pitY, z1], [0, 0, -1], d, pitY, topY);
    wallFace([x0, pitY, z0], [0, 0, 1], d, pitY, topY);
    if (addTopCap) {
      capB.box(x0 - 0.012, topY - 0.055, z0 - 0.012, x1 + 0.012, topY, z1 + 0.012, WHITE, { uv: 1.4 });
    } else {
      c.flat.box(x0, topY - 0.04, z0, x1, topY, z1, darkSteel);
    }
  };

  // 3 Transverse Partition Walls across [-W/2, W/2] at rowZ[1..3]
  for (const r of [1, 2, 3]) {
    const cz = plan.rowZ[r];
    // Walkable middle span between colX[1] and colX[3] gets bright slotted balance cap; outer visual dividers have recessed dark trim
    buildPartitionWall(-W / 2, cz - hw, plan.colX[1] - hw, cz + hw, -0.03, false);
    buildPartitionWall(plan.colX[1] - hw, cz - hw, plan.colX[3] + hw, cz + hw, 0, true);
    buildPartitionWall(plan.colX[3] + hw, cz - hw, W / 2, cz + hw, -0.03, false);
  }

  // North collector cap along pit side of North Bulkhead wall (`x1 - hw .. x3 + hw`)
  buildPartitionWall(plan.colX[1] - hw, plan.gridZ0, plan.colX[3] + hw, plan.northBeamZ + hw, 0, true);

  // 3 Longitudinal Partition Walls at colX[1..3], dipping sharply at `plan.brokenSpans`
  const isBrokenCell = (col, row) => plan.brokenSpans.some((bs) => bs.col === col && bs.row === row);
  for (let col = 1; col <= 3; col++) {
    const cx = plan.colX[col];
    for (let row = 0; row < 4; row++) {
      const za = row === 0 ? plan.northBeamZ + hw : plan.rowZ[row] + hw;
      const zb = row === 3 ? plan.gridZ1 : plan.rowZ[row + 1] - hw;
      if (zb - za <= 0.04) continue;
      if (isBrokenCell(col, row)) {
        // Buckled / snapped partition gap: wall collapsed to y = -0.98 m with jagged steel studs & CAUTION tape!
        buildPartitionWall(cx - hw, za, cx + hw, zb, -0.98, false);
        // Jagged broken end shoulders & bent steel channel posts
        c.flat.box(cx - hw, -0.98, za, cx + hw, -0.34, za + 0.22, darkSteel);
        c.flat.box(cx - hw, -0.98, zb - 0.22, cx + hw, -0.34, zb, darkSteel);
        c.flat.box(cx - 0.04, -0.98, za + 0.16, cx + 0.04, -0.08, za + 0.22, darkSteel);
        c.flat.box(cx - 0.04, -0.98, zb - 0.22, cx + 0.04, -0.08, zb - 0.16, darkSteel);
        // Two strips of yellow/black CAUTION tape fluttering across the gap so players never miss it
        cautionB.box(cx - 0.015, -0.14, za - 0.02, cx + 0.015, -0.06, zb + 0.02, WHITE, { uv: 1.8 });
        cautionB.box(cx - 0.16, -0.38, za - 0.02, cx - 0.13, -0.31, zb + 0.02, WHITE, { uv: 1.8 });
      } else {
        buildPartitionWall(cx - hw, za, cx + hw, zb, 0, true);
      }
    }
    // Connector posts at intersections
    for (const cz of [plan.northBeamZ, plan.rowZ[1], plan.rowZ[2], plan.rowZ[3], plan.gridZ1]) {
      c.flat.box(cx - hw - 0.02, -0.14, cz - hw - 0.02, cx + hw + 0.02, 0.008, cz + hw + 0.02, darkSteel);
    }
  }

  // Precarious decorative watercooler spur off rowZ[2]
  const wp = plan.watercoolerPad;
  buildPartitionWall(wp.x0, wp.z0, wp.x1, wp.z1, 0, true);
  c.model('cg:cooler', watercoolerVox, wp.x, wp.z, { y: 0, rot: wp.x < 0 ? Math.PI / 2 : -Math.PI / 2, solid: false, shadow: false });

  /* ---- 4. Sunken Cubicle Interiors & Surreal Backrooms Anomalies ---- */
  const crtUv = [
    [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]],
    [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]],
    [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]],
    [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]],
  ];

  let pitLightCount = 0;
  for (const cell of plan.cells) {
    const ix0 = cell.x0 + (cell.col === 0 ? 0.02 : hw);
    const ix1 = cell.x1 - (cell.col === 3 ? 0.02 : hw);
    const iz0 = cell.z0 + (cell.row === 0 ? 0.11 : hw);
    const iz1 = cell.z1 - (cell.row === 3 ? 0.02 : hw);
    const mx = (ix0 + ix1) / 2, mz = (iz0 + iz1) / 2;

    if (cell.bottomless) {
      // Surreal Anomaly: Bottomless Recursive Cubicle Shaft — 4 receding nested cubicle rims & tiny glowing CRTs!
      const deepBottom = -5.65;
      c.flat.box(ix0 - 0.04, deepBottom, iz0 - 0.04, ix1 + 0.04, pitY + 0.02, iz0 + 0.02, darkSteel);
      c.flat.box(ix0 - 0.04, deepBottom, iz1 - 0.02, ix1 + 0.04, pitY + 0.02, iz1 + 0.04, darkSteel);
      c.flat.box(ix0 - 0.04, deepBottom, iz0 - 0.04, ix0 + 0.02, pitY + 0.02, iz1 + 0.04, darkSteel);
      c.flat.box(ix1 - 0.02, deepBottom, iz0 - 0.04, ix1 + 0.04, pitY + 0.02, iz1 + 0.04, darkSteel);

      for (let tier = 1; tier <= 4; tier++) {
        const ty = pitY - tier * 0.48;
        const shrink = Math.pow(0.80, tier);
        const hwX = ((ix1 - ix0) * 0.5) * shrink;
        const hwZ = ((iz1 - iz0) * 0.5) * shrink;
        const rimT = Math.max(0.05, 0.12 * shrink);
        capB.box(mx - hwX, ty - 0.05, mz - hwZ, mx + hwX, ty, mz - hwZ + rimT, WHITE);
        capB.box(mx - hwX, ty - 0.05, mz + hwZ - rimT, mx + hwX, ty, mz + hwZ, WHITE);
        capB.box(mx - hwX, ty - 0.05, mz - hwZ, mx - hwX + rimT, ty, mz + hwZ, WHITE);
        capB.box(mx + hwX - rimT, ty - 0.05, mz - hwZ, mx + hwX, ty, mz + hwZ, WHITE);
        // Tiny glowing green CRT screen repeating smaller and smaller down the abyss!
        const cw = 0.24 * shrink;
        const cx = mx + (tier % 2 === 0 ? 0.35 : -0.35) * hwX;
        const cz = mz + (tier % 2 === 0 ? -0.35 : 0.35) * hwZ;
        c.flat.box(cx - cw, ty - 0.18 * shrink, cz - cw, cx + cw, ty, cz + cw, deskWood);
        crtGlowB.quad(
          [cx - cw * 0.65, ty + 0.02, cz],
          [cx + cw * 0.65, ty + 0.02, cz],
          [cx + cw * 0.65, ty + 0.02, cz - cw * 0.85],
          [cx - cw * 0.65, ty + 0.02, cz - cw * 0.85],
          WHITE, crtUv[0],
        );
      }
      abyssGlowB.quad([ix0, deepBottom + 0.02, iz1], [ix1, deepBottom + 0.02, iz1], [ix1, deepBottom + 0.02, iz0], [ix0, deepBottom + 0.02, iz0]);
      c.light(mx, pitY - 0.55, mz, '#4ee38a', 0.48, { k: 1.5, far: 3.8 });
      continue;
    }

    // Standard sunken cubicle carpet at y = -3.60 m
    carpetRect(ix0, iz0, ix1, iz1, pitY, () => 0.28);

    if (cell.sideways) {
      // Surreal Anomaly: Sideways-Gravity Workstation bolted 90° onto the East partition wall at y = -1.65 m!
      const wy = -1.65, wx = ix1 - 0.02;
      // Desk slab jutting horizontally out of the vertical wall
      c.flat.box(wx - 0.74, wy - 0.55, mz - 0.62, wx - 0.68, wy + 0.55, mz + 0.62, deskWood);
      c.flat.box(wx - 0.72, wy - 0.50, mz - 0.56, wx, wy - 0.44, mz - 0.50, darkSteel);
      c.flat.box(wx - 0.72, wy + 0.44, mz + 0.50, wx, wy + 0.50, mz + 0.56, darkSteel);
      // Glowing sideways CRT & sideways swivel chair bolted to the wallpaper
      c.flat.box(wx - 0.68, wy - 0.20, mz - 0.22, wx - 0.36, wy + 0.20, mz + 0.22, lin('#b5ac95'));
      crtGlowB.quad(
        [wx - 0.69, wy - 0.15, mz + 0.16],
        [wx - 0.69, wy + 0.15, mz + 0.16],
        [wx - 0.69, wy + 0.15, mz - 0.16],
        [wx - 0.69, wy - 0.15, mz - 0.16],
        WHITE, crtUv[2],
      );
      if (c.hasProp('chair')) {
        c.prop('chair', wx - 0.48, mz + 0.48, { y: wy - 0.35, rot: Math.PI / 2, tilt: [0, 0, Math.PI / 2], solid: false, shadow: false });
      }
      c.light(wx - 0.85, wy, mz, '#68eb96', 0.42, { k: 1.4, far: 3.4 });
      continue;
    }

    // Sunken corporate cubicle desk, chair, filing cabinet, scattered memos & glowing 1990s CRT
    const deskAgainstNorth = (cell.id % 2 === 0);
    const dz = deskAgainstNorth ? iz0 + 0.38 : iz1 - 0.38;
    const dw = Math.min(1.28, (ix1 - ix0) * 0.68);
    c.flat.box(mx - dw / 2, pitY + 0.70, dz - 0.32, mx + dw / 2, pitY + 0.75, dz + 0.32, deskWood);
    c.flat.box(mx - dw / 2 + 0.04, pitY, dz - 0.28, mx - dw / 2 + 0.10, pitY + 0.70, dz + 0.28, darkSteel);
    c.flat.box(mx + dw / 2 - 0.10, pitY, dz - 0.28, mx + dw / 2 - 0.04, pitY + 0.70, dz + 0.28, darkSteel);

    // Bulky beige CRT + glowing screen facing into the cubicle (and angled slightly up)
    const crtX = mx + (cell.col % 2 === 0 ? -0.18 : 0.18);
    const crtRot = deskAgainstNorth ? 0 : Math.PI;
    c.model('cg:crt', pitCrtVox, crtX, dz, { y: pitY + 0.75, scale: 0.9, rot: crtRot, solid: false, shadow: false });
    const faceZ = dz + (deskAgainstNorth ? 0.16 : -0.16);
    const uvPick = crtUv[cell.id % 4];
    if (deskAgainstNorth) {
      crtGlowB.quad([crtX - 0.14, pitY + 0.88, faceZ], [crtX + 0.14, pitY + 0.88, faceZ], [crtX + 0.14, pitY + 1.09, faceZ], [crtX - 0.14, pitY + 1.09, faceZ], WHITE, uvPick);
    } else {
      crtGlowB.quad([crtX + 0.14, pitY + 0.88, faceZ], [crtX - 0.14, pitY + 0.88, faceZ], [crtX - 0.14, pitY + 1.09, faceZ], [crtX + 0.14, pitY + 1.09, faceZ], WHITE, uvPick);
    }

    // Overturned or crooked swivel chair & tall paper stacks
    const chZ = mz + (deskAgainstNorth ? 0.28 : -0.28);
    if (c.hasProp('chair')) {
      const tipped = (cell.id % 3 === 1);
      c.prop('chair', mx, chZ, {
        y: pitY + (tipped ? 0.24 : 0),
        rot: R.range(0, Math.PI * 2),
        tilt: tipped ? [1.35, 0.2, 0] : undefined,
        solid: false,
        shadow: false,
      });
    }
    if (cell.id % 3 === 0) {
      const fx = ix0 + 0.30, fz = deskAgainstNorth ? iz1 - 0.32 : iz0 + 0.32;
      c.flat.box(fx - 0.20, pitY, fz - 0.22, fx + 0.20, pitY + 1.18, fz + 0.22, cabGrey);
    }
    // Loose white memo sheets scattered across the deep pit carpet
    for (let s = 0; s < 2; s++) {
      const px = mx + R.range(-0.45, 0.45), pz = mz + R.range(-0.45, 0.45);
      c.lay(paperB, px, pz, 0.22, 0.29, R.range(0, Math.PI), null, WHITE, pitY + 0.012);
    }

    // Sparse eerie phosphor glow in every third cubicle to stay well within baked light budget
    if (pitLightCount < 4 && cell.id % 4 === 1) {
      pitLightCount++;
      c.light(crtX, pitY + 1.15, dz, cell.id % 2 === 0 ? '#5ce386' : '#e8a43c', 0.38, { k: 1.5, far: 3.4 });
    }
  }

  /* ---- 5. Five Smiling Office Workers (`pit-clerks`) Climbing Out of Cubicles ---- */
  let metLogged = false;
  let survivedLogged = false;
  let scrapeClock = 0;

  const clerks = plan.climbers.map((spec) => {
    const rig = buildSmilingClimber(c.kit, spec.idx);
    let state = createClerkState(spec);
    const startW = c.toWorld(state.x, state.z);

    const denizen = c.env.denizens?.add({
      id: 'pit-clerks',
      x: startW.x,
      z: startW.z,
      y: c.room.y + state.y,
      r: 0.24,
      group: rig.group,
      light: (rgb) => rig.light(rgb),
      snipTarget: () => {
        if (state.phase !== 'stalking' && !(state.phase === 'climbing' && state.y >= -1.25)) return false;
        return {
          y: c.room.y + state.y + 0.85,
          r: 0.42,
          priority: 3,
        };
      },
      snip: () => {
        state = snipClerk(state, spec);
        c.env.play('thunk', denizen.x, denizen.z, 7);
        c.env.interfere(0.32);
        return true;
      },
      update(dt, time, me) {
        const pLocal = c.toLocal(me.x, me.z);
        const inRoom = c.world.current() === c.rt;
        const northShut = northBulkheadDoor.isShut();
        const playerOnNorth = inRoom && pLocal.z <= plan.gridZ0 - 0.06;

        // Check if a lit paper fire is burning near this clerk
        const nearFire = c.env.fires?.nearest?.(denizen.x, denizen.z, 4.2);
        const fireLocal = nearFire ? c.toLocal(nearFire.x, nearFire.z) : null;

        const prevPhase = state.phase;
        const res = stepClerk(state, spec, plan, {
          dt,
          activated: roomState.activated,
          sealed: roomState.sealed,
          px: pLocal.x,
          pz: pLocal.z,
          playerOnNorth,
          northShut,
          fleeingFire: !!fireLocal,
          fireX: fireLocal ? fireLocal.x : 0,
          fireZ: fireLocal ? fireLocal.z : 0,
        });
        state = res.state;

        const wNow = c.toWorld(state.x, state.z);
        denizen.x = wNow.x;
        denizen.z = wNow.z;
        denizen.y = c.room.y + state.y;

        const worldYaw = state.yaw + (c.room.rot * Math.PI) / 2;
        rig.group.rotation.y = worldYaw;

        const toPlayerYaw = Math.atan2(me.x - denizen.x, me.z - denizen.z);
        let relYaw = toPlayerYaw - worldYaw;
        while (relYaw > Math.PI) relYaw -= Math.PI * 2;
        while (relYaw < -Math.PI) relYaw += Math.PI * 2;
        rig.pose(state.phase, state.animT, relYaw);

        if (prevPhase === 'seated' && state.phase === 'climbing') {
          c.env.play('rattle', denizen.x, denizen.z, 8);
        }
        if (res.crestedNow) {
          c.env.play('clack', denizen.x, denizen.z, 8);
          if (inRoom) c.env.interfere(0.24);
        }
        if (res.doorBlocked && inRoom && Math.floor((time + spec.idx * 0.43) * 0.85) !== Math.floor((time - dt + spec.idx * 0.43) * 0.85)) {
          c.env.play('thunk', denizen.x, denizen.z, 6);
        }
        if (res.caught && inRoom && !roomState.falling) {
          state = releaseClerk(state);
          c.env.interfere(0.72);
          c.env.red?.(0.65);
          c.env.play('static', denizen.x, denizen.z, 8);
          if (c.env.health) c.env.health.damage(GRID.hurts);
          else c.env.end?.('caught');
        }
      },
    });

    return { spec, getState: () => state };
  });

  /* ---- 6. Room Tick: Tightrope Wobble, Lethal Pit Plunge & Door Seal ---- */
  c.tick((dt, t, local) => {
    const me = c.env.player?.me;
    if (!me) return;

    const northShut = northBulkheadDoor.isShut();
    const southShut = frontDoors.length > 0 && frontDoors.every((d) => d.isShut());

    const step = stepGridRoom(roomState, plan, {
      dt,
      x: local.x,
      z: local.z,
      inside: local.inside,
      northShut,
      southShut,
    });
    roomState = step.state;

    if (step.activatedNow) {
      if (!metLogged) { metLogged = true; c.env.run?.met('pit-clerks'); }
      const midW = c.toWorld(0, 0);
      c.env.play('buzz', midW.x, midW.z, 9);
      c.env.interfere(0.28);
    }

    if (step.sealedNow && !survivedLogged) {
      survivedLogged = true;
      c.env.run?.survived('pit-clerks');
    }

    // Eerie scraping sound while any clerk is climbing up the wallpaper
    if (local.inside && roomState.activated && !roomState.sealed) {
      const anyClimbing = clerks.some((cl) => cl.getState().phase === 'climbing');
      if (anyClimbing) {
        scrapeClock -= dt;
        if (scrapeClock <= 0) {
          scrapeClock = 1.35;
          const active = clerks.find((cl) => cl.getState().phase === 'climbing');
          if (active) {
            const st = active.getState(), wp2 = c.toWorld(st.x, st.z);
            c.env.play('step', wp2.x, wp2.z, 7);
          }
        }
      }
    }

    // Subtle tightrope balance warning when shoes brush the cap edge
    if (local.inside && !roomState.falling && step.teeter > 0.05) {
      c.env.interfere(step.teeter * 0.16);
    }

    // Lethal plunge into a sunken cubicle!
    if (step.fellNow) {
      if (!metLogged) { metLogged = true; c.env.run?.met('pit-clerks'); }
      c.env.hold?.(true);
      const fw = c.toWorld(roomState.fallX, roomState.fallZ);
      c.env.play('rattle', fw.x, fw.z, 8);
      c.env.interfere(0.68);
    }
    if (roomState.falling) {
      const fw = c.toWorld(roomState.fallX, roomState.fallZ);
      c.env.player.warp(fw.x, fw.z);
      // Pitch camera upward toward the receding square of fluorescent ceiling as you plummet into the cubicle
      me.pitch = clamp(me.pitch + dt * 1.45, -1.2, 0.95);
      c.env.red?.(Math.min(0.9, roomState.fallT * 0.92));
      c.env.interfere(0.35 + 0.55 * Math.min(1, roomState.fallT));
      if (step.diedNow) {
        c.env.play('thunk', fw.x, fw.z, 9);
        c.env.hold?.(false);
        c.env.end?.('caught');
        if (c.env.difficulty?.() === 'tourist') roomState = { ...roomState, falling: false, died: false, fallT: 0, fallY: 0 };
      }
    }
  });
}
