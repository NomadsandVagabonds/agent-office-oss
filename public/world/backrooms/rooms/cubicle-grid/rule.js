// Pure spatial & entity rules for `cubicle-grid` ("The Open-Plan Pit"):
// No Three.js, no DOM — deterministic layout, tightrope partition-top heightfield,
// lethal cubicle-pit fall state machine, bulkhead door seal, and graph-routed
// Smiling Office Workers (`pit-clerks`) that climb slowly up out of sunken
// cubicles onto the partition beams.

export const GRID = Object.freeze({
  pitDepth: -3.60,       // floor depth of standard sunken cubicles (m)
  lipDepth: -0.08,       // 14 cm teeter lip around beams (<= 0.26 m STEP so player can slip off, > 0.025 m so items never spawn on edges)
  beamHalfW: 0.25,       // 0.50 m wide walkable partition-top cap (4 cells of 0.125 m)
  lipWidth: 0.14,        // teeter rim width outside beamHalfW before sheer -3.60 m drop
  slipDist: 0.025,       // how far past beamHalfW center-of-mass can drift before plummeting (0.275 m from beam centerline)
  fallDuration: 0.96,    // seconds of plummeting into a dark cubicle before fatal impact
  climbStartY: -3.42,    // seated/starting Y down inside the sunken cubicle
  climbSpeed: 0.62,      // m/s vertical crawl up the cubicle wallpaper (~5.5 s to crest)
  stalkSpeed: 1.18,      // m/s tightrope pursuit along partition tops (walk is 2.05 m/s, swarm cuts off junctions)
  returnSpeed: 0.88,     // m/s retreat speed once bulkhead fire door is shut
  catchDist: 0.50,       // beam grab reach (m)
  hurts: 2,              // hearts lost on a beam grab (pit fall itself is always fatal)
  recoilTime: 5.5,       // seconds of respite after a survived beam grab or scissor snip
  doorHalfW: 0.68,       // 1.36 m centered doorway in the North Bulkhead partition
});

const snap = (v) => Math.round(v / 0.125) * 0.125;

/** Safe tape hiding spots on the North Safe Sanctuary across the cubicle pit. */
export function cubicleGridStash(r, side) {
  const z0 = +(-r.D / 2 + 0.65).toFixed(3);
  const z1 = +(-r.D / 2 + 1.48).toFixed(3);
  return side < 0
    ? [+(-r.W / 2 + 0.85).toFixed(3), z0, +(-r.W / 2 + 1.85).toFixed(3), z1]
    : [+(r.W / 2 - 1.85).toFixed(3), z0, +(r.W / 2 - 0.85).toFixed(3), z1];
}

function rectDist(x, z, b) {
  const dx = Math.max(b.x0 - x, 0, x - b.x1);
  const dz = Math.max(b.z0 - z, 0, z - b.z1);
  return Math.hypot(dx, dz);
}

/**
 * Deterministic 4x4 sunken cubicle grid plan, snapped to 0.125 m cells so
 * `world.walkable(rt)` verifies 100% doorway-to-doorway reachability while
 * keeping open cubicle pits isolated from flood-fill and item placement.
 */
export function buildGridPlan(W, D, H, brokenSide = 1) {
  const gridZ0 = snap(-D / 2 + 2.25); // North Bulkhead partition line
  const gridZ1 = snap(D / 2 - 2.25);  // South Foyer lip
  const spanD = gridZ1 - gridZ0;

  const x1 = snap(-W * 0.225);
  const x2 = 0;
  const x3 = snap(W * 0.225);
  const colX = [-W / 2, x1, x2, x3, W / 2];

  const z1 = snap(gridZ0 + spanD * 0.25);
  const z2 = snap(gridZ0 + spanD * 0.50);
  const z3 = snap(gridZ0 + spanD * 0.75);
  const rowZ = [gridZ0, z1, z2, z3, gridZ1];

  const hw = GRID.beamHalfW;
  const sideBreakCol = brokenSide < 0 ? 1 : 3;

  // Longitudinal segments: 3 interior columns (1, 2, 3) across 4 rows (0..3)
  // Two interior segments are buckled/collapsed so players cannot hold W blindly down x = 0:
  //   - Center column (col 2, x = 0) in row 2 (between z2 and z3)
  //   - One side column (col 1 or 3) in row 1 (between z1 and z2)
  const brokenLong = new Set([`2:2`, `${sideBreakCol}:1`]);
  const brokenSpans = [];
  const beams = [];

  for (let c = 1; c <= 3; c++) {
    const cx = colX[c];
    for (let r = 0; r < 4; r++) {
      const za = rowZ[r], zb = rowZ[r + 1];
      // Side columns stop at rowZ[1] on the north end unless connected along a north lip;
      // keeping row 0 longitudinal beams on all 3 columns + a north lip beam between x1..x3
      // gives multiple clean approaches to the centered North Bulkhead Door at (0, gridZ0).
      if (brokenLong.has(`${c}:${r}`)) {
        brokenSpans.push({
          col: c, row: r, cx,
          z0: za + hw, z1: zb - hw,
          x0: cx - hw, x1: cx + hw,
        });
      } else {
        beams.push({
          kind: 'long', col: c, row: r,
          x0: cx - hw, x1: cx + hw,
          z0: za - (r === 0 ? 0.12 : hw),
          z1: zb + (r === 3 ? 0.12 : hw),
        });
      }
    }
  }

  // Transverse walkable beams: rowZ[1], rowZ[2], rowZ[3] plus a north collector cap just south of the bulkhead wall
  for (const r of [1, 2, 3]) {
    const cz = rowZ[r];
    beams.push({
      kind: 'trans', row: r,
      x0: x1 - hw, x1: x3 + hw,
      z0: cz - hw, z1: cz + hw,
    });
  }
  // North collector beam right along the pit side of the bulkhead wall (lets left/right columns merge into the center door)
  const northBeamZ = snap(gridZ0 + 0.375);
  beams.push({
    kind: 'north-cap', row: 0,
    x0: x1 - hw, x1: x3 + hw,
    z0: gridZ0 - 0.10, z1: northBeamZ + hw,
  });

  // Precarious decorative corner spur for an unplugged watercooler (never required, off main lanes)
  const spurSign = brokenSide < 0 ? 1 : -1;
  const spurX0 = spurSign < 0 ? colX[1] - 0.95 : colX[3] + hw;
  const spurX1 = spurSign < 0 ? colX[1] - hw : colX[3] + 0.95;
  const watercoolerPad = {
    x: spurSign < 0 ? colX[1] - 0.62 : colX[3] + 0.62,
    z: z2,
    x0: Math.min(spurX0, spurX1),
    x1: Math.max(spurX0, spurX1),
    z0: z2 - 0.32,
    z1: z2 + 0.32,
  };

  // Build 15-node routing graph for Smiling Workers (`3 cols x 5 z-levels`)
  const graphZ = [northBeamZ, z1, z2, z3, gridZ1];
  const nodes = [];
  const nodeAt = (cIdx, rIdx) => cIdx * 5 + rIdx; // cIdx in 0..2 -> col 1..3, rIdx in 0..4
  for (let cIdx = 0; cIdx < 3; cIdx++) {
    for (let rIdx = 0; rIdx < 5; rIdx++) {
      nodes.push({ id: nodes.length, col: cIdx + 1, row: rIdx, x: colX[cIdx + 1], z: graphZ[rIdx] });
    }
  }
  const adj = nodes.map(() => []);
  const linkNodes = (a, b) => {
    const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
    adj[a].push({ to: b, cost: d });
    adj[b].push({ to: a, cost: d });
  };
  for (let cIdx = 0; cIdx < 3; cIdx++) {
    const col = cIdx + 1;
    for (let r = 0; r < 4; r++) {
      if (!brokenLong.has(`${col}:${r}`)) linkNodes(nodeAt(cIdx, r), nodeAt(cIdx, r + 1));
    }
  }
  for (const rIdx of [0, 1, 2, 3]) {
    linkNodes(nodeAt(0, rIdx), nodeAt(1, rIdx));
    linkNodes(nodeAt(1, rIdx), nodeAt(2, rIdx));
  }

  // 16 sunken cubicle cells (row 0..3 from north to south, col 0..3 from west to east)
  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const cx0 = colX[c], cx1 = colX[c + 1];
      const cz0 = rowZ[r], cz1 = rowZ[r + 1];
      const isBottomless = (r === 1 && c === 0) || (r === 2 && c === 3);
      const isSideways = (r === 1 && c === 2);
      cells.push({
        id: r * 4 + c,
        row: r, col: c,
        x0: cx0, x1: cx1,
        z0: cz0, z1: cz1,
        cx: (cx0 + cx1) / 2,
        cz: (cz0 + cz1) / 2,
        bottomless: isBottomless,
        sideways: isSideways,
      });
    }
  }

  // 5 Smiling Office Worker spawns inside non-bottomless cubicles, staggered so they rise all around you
  const spawnSpecs = [
    { row: 2, col: 1, climbCol: 1, climbRowIdx: 2, wallSide: 'W', delay: 0.25 },
    { row: 2, col: 2, climbCol: 3, climbRowIdx: 2, wallSide: 'E', delay: 1.05 },
    { row: 1, col: 1, climbCol: 2, climbRowIdx: 1, wallSide: 'E', delay: 1.95 },
    { row: 0, col: 0, climbCol: 1, climbRowIdx: 0, wallSide: 'E', delay: 2.90 },
    { row: 0, col: 3, climbCol: 3, climbRowIdx: 1, wallSide: 'W', delay: 3.85 },
  ];
  const climbers = spawnSpecs.map((sp, idx) => {
    const cell = cells[sp.row * 4 + sp.col];
    const targetNode = nodes[nodeAt(sp.climbCol - 1, sp.climbRowIdx)];
    const wallOffset = sp.wallSide === 'E' ? -(hw + 0.24) : (hw + 0.24);
    const faceYaw = sp.wallSide === 'E' ? Math.PI / 2 : -Math.PI / 2;
    return {
      idx,
      cellId: cell.id,
      seatX: cell.cx,
      seatZ: cell.cz,
      climbX: targetNode.x + wallOffset,
      climbZ: clampVal(cell.cz, cell.z0 + 0.55, cell.z1 - 0.55),
      crestX: targetNode.x,
      crestZ: targetNode.z,
      crestNode: targetNode.id,
      faceYaw,
      wakeDelay: sp.delay,
    };
  });

  return {
    W, D, H,
    gridZ0, gridZ1, northBeamZ,
    colX, rowZ,
    beams,
    brokenSpans,
    watercoolerPad,
    nodes,
    adj,
    cells,
    climbers,
  };
}

function clampVal(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Minimum distance from `(x, z)` to any walkable `y = 0` surface (0 when safely on carpet or a partition cap). */
export function distToWalkableTop(plan, x, z) {
  if (z >= plan.gridZ1 || z <= plan.gridZ0) return 0;
  let best = Math.min(plan.gridZ1 - z, z - plan.gridZ0);
  for (const b of plan.beams) {
    const d = rectDist(x, z, b);
    if (d <= 0) return 0;
    if (d < best) best = d;
  }
  return best;
}

/** Which sunken cubicle cell `(x, z)` lies above, or the nearest pit cell. */
export function cellAtPoint(plan, x, z) {
  for (const cell of plan.cells) {
    if (x >= cell.x0 && x <= cell.x1 && z >= cell.z0 && z <= cell.z1) return cell;
  }
  let best = plan.cells[0], bestD = Infinity;
  for (const cell of plan.cells) {
    const d = Math.hypot(x - cell.cx, z - cell.cz);
    if (d < bestD) { bestD = d; best = cell; }
  }
  return best;
}

/**
 * Room heightfield:
 * - `0` on South Foyer, North Sanctuary, and intact `0.50 m` partition-top caps
 * - `-0.08` on the `0.14 m` teeter rim (lets player step off edge while blocking item placement)
 * - `-3.60` inside open cubicle pits & broken partition spans (isolates `world.walkable` flood-fill)
 */
export function gridFloorY(plan, x, z) {
  const d = distToWalkableTop(plan, x, z);
  if (d <= 0) return 0;
  if (d <= GRID.lipWidth) return GRID.lipDepth;
  return GRID.pitDepth;
}

export function createGridRoomState() {
  return {
    activated: false,
    crossedFromSouth: false,
    crossedFromNorth: false,
    sealed: false,
    falling: false,
    fallT: 0,
    fallX: 0,
    fallZ: 0,
    fallY: 0,
    died: false,
  };
}

export function stepGridRoom(state, plan, {
  dt = 0,
  x = 0,
  z = 0,
  inside = false,
  northShut = false,
  southShut = false,
} = {}) {
  let {
    activated, crossedFromSouth, crossedFromNorth, sealed,
    falling, fallT, fallX, fallZ, fallY, died,
  } = state;

  let activatedNow = false;
  let fellNow = false;
  let diedNow = false;
  let sealedNow = false;
  let teeter = 0;

  if (falling) {
    fallT = Math.min(1.2, fallT + dt / GRID.fallDuration);
    const k = Math.min(1, fallT);
    fallY = GRID.pitDepth * (k * k) * 0.94;
    if (!died && fallT >= 1.0) {
      died = true;
      diedNow = true;
    }
    return {
      state: { activated, crossedFromSouth, crossedFromNorth, sealed, falling, fallT, fallX, fallZ, fallY, died },
      activatedNow, fellNow, diedNow, sealedNow, teeter: 1,
    };
  }

  if (!inside) {
    return {
      state,
      activatedNow, fellNow, diedNow, sealedNow, teeter: 0,
    };
  }

  if (z >= plan.gridZ1 + 0.15) crossedFromSouth = true;
  if (z <= plan.gridZ0 - 0.15) crossedFromNorth = true;

  const inPitSpan = z < plan.gridZ1 - 0.04 && z > plan.gridZ0 + 0.04;
  if (inPitSpan && !activated && !sealed) {
    activated = true;
    activatedNow = true;
  }

  // Check if player sealed the bulkhead door after crossing!
  if (!sealed) {
    if (crossedFromSouth && z <= plan.gridZ0 - 0.08 && northShut) {
      sealed = true;
      sealedNow = true;
    } else if (crossedFromNorth && z >= plan.gridZ1 + 0.08 && southShut) {
      sealed = true;
      sealedNow = true;
    }
  }

  // Tightrope balance & lethal slip detection
  if (inPitSpan) {
    const dOut = distToWalkableTop(plan, x, z);
    if (dOut > GRID.slipDist) {
      const cell = cellAtPoint(plan, x, z);
      falling = true;
      fellNow = true;
      fallT = 0.01;
      fallX = x + (cell.cx - x) * 0.38;
      fallZ = z + (cell.cz - z) * 0.38;
      fallY = -0.08;
      teeter = 1;
    } else if (dOut > 0) {
      teeter = clampVal(dOut / GRID.slipDist, 0, 1);
    } else {
      // Subtle edge proximity warning within 7 cm of the cap edge
      const nearEdge = Math.min(
        ...plan.beams
          .filter((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1)
          .map((b) => Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z)),
      );
      if (Number.isFinite(nearEdge) && nearEdge < 0.07) {
        teeter = clampVal((0.07 - nearEdge) / 0.07, 0, 0.65);
      }
    }
  }

  return {
    state: { activated, crossedFromSouth, crossedFromNorth, sealed, falling, fallT, fallX, fallZ, fallY, died },
    activatedNow,
    fellNow,
    diedNow,
    sealedNow,
    teeter,
  };
}

/** Nearest node index in `plan.nodes` to `(x, z)`. */
export function nearestGridNode(plan, x, z) {
  let best = 0, bestD = Infinity;
  for (const n of plan.nodes) {
    const d = Math.hypot(x - n.x, z - n.z);
    if (d < bestD) { bestD = d; best = n.id; }
  }
  return best;
}

/** Shortest path next waypoint from `fromNode` toward `goalNode` on the intact beam graph. */
export function nextNodeToward(plan, fromNode, goalNode) {
  if (fromNode === goalNode) return goalNode;
  const N = plan.nodes.length;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int16Array(N).fill(-1);
  const used = new Uint8Array(N);
  dist[fromNode] = 0;

  for (let iter = 0; iter < N; iter++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < N; i++) {
      if (!used[i] && dist[i] < best) { best = dist[i]; u = i; }
    }
    if (u < 0 || u === goalNode) break;
    used[u] = 1;
    for (const e of plan.adj[u]) {
      const nd = dist[u] + e.cost;
      if (nd < dist[e.to]) {
        dist[e.to] = nd;
        prev[e.to] = u;
      }
    }
  }
  if (!Number.isFinite(dist[goalNode])) return fromNode;
  let cur = goalNode;
  while (prev[cur] !== -1 && prev[cur] !== fromNode) cur = prev[cur];
  return cur;
}

export function createClerkState(spec) {
  return {
    idx: spec.idx,
    phase: 'seated', // 'seated' | 'climbing' | 'stalking' | 'falling' | 'recoiling' | 'returning'
    x: spec.seatX,
    z: spec.seatZ,
    y: GRID.climbStartY,
    yaw: 0,
    nodeId: spec.crestNode,
    targetNode: spec.crestNode,
    timer: spec.wakeDelay,
    animT: spec.idx * 1.37,
  };
}

export function snipClerk(state, spec) {
  return {
    ...state,
    phase: 'falling',
    timer: GRID.recoilTime,
    x: spec.climbX,
    z: spec.climbZ,
  };
}

export function releaseClerk(state) {
  return {
    ...state,
    phase: 'recoiling',
    timer: GRID.recoilTime,
  };
}

export function stepClerk(state, spec, plan, {
  dt = 0,
  activated = false,
  sealed = false,
  px = 0,
  pz = 0,
  playerOnNorth = false,
  northShut = false,
  fleeingFire = false,
  fireX = 0,
  fireZ = 0,
} = {}) {
  let { idx, phase, x, z, y, yaw, nodeId, targetNode, timer, animT } = state;
  animT += dt;
  let crestedNow = false;
  let caught = false;
  let doorBlocked = false;

  if (!activated && phase === 'seated') {
    return { state: { ...state, animT }, crestedNow, caught, doorBlocked };
  }

  // Once sealed and the player is no longer standing right behind the north bulkhead door, retreat back down
  if (sealed && !(playerOnNorth && northShut) && (phase === 'stalking' || phase === 'climbing' || phase === 'recoiling')) {
    phase = 'returning';
  }

  if (phase === 'seated') {
    timer -= dt;
    if (timer <= 0) {
      phase = 'climbing';
      x = spec.climbX;
      z = spec.climbZ;
      y = GRID.climbStartY;
      yaw = spec.faceYaw;
    }
    return { state: { idx, phase, x, z, y, yaw, nodeId, targetNode, timer, animT }, crestedNow, caught, doorBlocked };
  }

  if (phase === 'falling') {
    y = Math.max(GRID.climbStartY, y - 6.8 * dt);
    if (y <= GRID.climbStartY + 0.01) {
      timer -= dt;
      if (timer <= 0) {
        phase = sealed ? 'seated' : 'climbing';
        timer = 0.4;
      }
    }
    return { state: { idx, phase, x, z, y, yaw, nodeId, targetNode, timer, animT }, crestedNow, caught, doorBlocked };
  }

  if (phase === 'climbing') {
    y = Math.min(0, y + GRID.climbSpeed * dt);
    yaw = spec.faceYaw;
    if (y >= -0.35) {
      // Pull smoothly onto the top of the partition beam as they crest
      const pull = (y + 0.35) / 0.35;
      x = spec.climbX + (spec.crestX - spec.climbX) * pull;
      z = spec.climbZ + (spec.crestZ - spec.climbZ) * pull;
    }
    if (y >= -0.001) {
      y = 0;
      x = spec.crestX;
      z = spec.crestZ;
      nodeId = spec.crestNode;
      targetNode = spec.crestNode;
      phase = 'stalking';
      crestedNow = true;
    }
    return { state: { idx, phase, x, z, y, yaw, nodeId, targetNode, timer, animT }, crestedNow, caught, doorBlocked };
  }

  if (phase === 'returning') {
    if (y < -0.01) {
      y = Math.max(GRID.climbStartY, y - GRID.climbSpeed * dt);
      if (y <= GRID.climbStartY + 0.01) {
        phase = 'seated';
        x = spec.seatX;
        z = spec.seatZ;
        timer = 1.5;
      }
      return { state: { idx, phase, x, z, y, yaw, nodeId, targetNode, timer, animT }, crestedNow, caught, doorBlocked };
    }
    const home = plan.nodes[spec.crestNode];
    if (Math.hypot(x - home.x, z - home.z) < 0.14) {
      x = spec.climbX;
      z = spec.climbZ;
      y = -0.15;
    } else {
      const wp = plan.nodes[targetNode];
      if (Math.hypot(x - wp.x, z - wp.z) < 0.10) {
        nodeId = targetNode;
        targetNode = nextNodeToward(plan, nodeId, spec.crestNode);
      }
      const goal = plan.nodes[targetNode];
      const dx = goal.x - x, dz = goal.z - z, d = Math.hypot(dx, dz) || 1;
      const step = Math.min(d, GRID.returnSpeed * dt);
      x += (dx / d) * step;
      z += (dz / d) * step;
      yaw = Math.atan2(dx, dz);
    }
    return { state: { idx, phase, x, z, y, yaw, nodeId, targetNode, timer, animT }, crestedNow, caught, doorBlocked };
  }

  if (phase === 'recoiling') {
    timer -= dt;
    // Back away along current beam toward home crest
    const goal = plan.nodes[spec.crestNode];
    const dx = goal.x - x, dz = goal.z - z, d = Math.hypot(dx, dz);
    if (d > 0.12) {
      const step = Math.min(d, 0.75 * dt);
      const wp = plan.nodes[nextNodeToward(plan, nodeId, spec.crestNode)];
      const wx = wp.x - x, wz = wp.z - z, wd = Math.hypot(wx, wz) || 1;
      x += (wx / wd) * step;
      z += (wz / wd) * step;
      if (Math.hypot(x - wp.x, z - wp.z) < 0.10) nodeId = wp.id;
    }
    yaw = Math.atan2(px - x, pz - z);
    if (timer <= 0) phase = 'stalking';
    return { state: { idx, phase, x, z, y, yaw, nodeId, targetNode, timer, animT }, crestedNow, caught, doorBlocked };
  }

  // phase === 'stalking'
  if (fleeingFire && Math.hypot(px - fireX, pz - fireZ) < 4.5) {
    phase = 'recoiling';
    timer = 2.4;
    return { state: { idx, phase, x, z, y, yaw, nodeId, targetNode, timer, animT }, crestedNow, caught, doorBlocked };
  }

  // If player is inside North Sanctuary and shut the bulkhead door, crowd outside the door at node (col 2, row 0)
  const doorNodeId = 1 * 5 + 0; // col 2 (x = 0), row 0 (northBeamZ)
  if (playerOnNorth && northShut) {
    const doorN = plan.nodes[doorNodeId];
    if (Math.hypot(x - doorN.x, z - doorN.z) < 0.55 && z <= doorN.z + 0.30) {
      // Hold 0.48 m back from the bulkhead door leaf so grinning faces fill the vision window without arms clipping through steel
      const standZ = plan.gridZ0 + 0.48;
      if (z < standZ) z = Math.min(standZ, z + GRID.stalkSpeed * dt);
      doorBlocked = true;
      yaw = Math.PI; // face the shut north door
      return { state: { idx, phase, x, z, y, yaw, nodeId, targetNode, timer, animT }, crestedNow, caught: false, doorBlocked };
    }
  }

  const goalNode = (playerOnNorth && northShut) ? doorNodeId : nearestGridNode(plan, px, pz);
  const wp = plan.nodes[targetNode];
  if (Math.hypot(x - wp.x, z - wp.z) < 0.10) {
    nodeId = targetNode;
    targetNode = nextNodeToward(plan, nodeId, goalNode);
  }
  const dest = plan.nodes[targetNode];
  // If already on the same beam segment as the player (and door isn't shut between them), walk directly toward player along that beam!
  let gx = dest.x, gz = dest.z;
  const distToPlayer = Math.hypot(px - x, pz - z);
  const sameBeam = !(playerOnNorth && northShut)
    && z <= plan.gridZ1 + 0.35 && pz <= plan.gridZ1 + 0.35 && pz >= plan.gridZ0 - 0.35
    && ((Math.abs(px - x) < 0.28 && distToWalkableTop(plan, x, (z + pz) / 2) <= 0.02)
      || (Math.abs(pz - z) < 0.28 && distToWalkableTop(plan, (x + px) / 2, z) <= 0.02));
  if (sameBeam) {
    gx = clampVal(px, -plan.W / 2 + 0.5, plan.W / 2 - 0.5);
    gz = clampVal(pz, plan.gridZ0 + 0.15, plan.gridZ1 - 0.05);
  }

  const dx = gx - x, dz = gz - z, d = Math.hypot(dx, dz);
  if (d > 0.02) {
    const step = Math.min(d, GRID.stalkSpeed * dt);
    x += (dx / d) * step;
    z += (dz / d) * step;
    yaw = Math.atan2(dx, dz);
  } else {
    yaw = Math.atan2(px - x, pz - z);
  }

  if (!(playerOnNorth && northShut) && distToPlayer <= GRID.catchDist && pz < plan.gridZ1 + 0.15 && pz > plan.gridZ0 - 0.15) {
    caught = true;
  }

  return {
    state: { idx, phase, x, z, y, yaw, nodeId, targetNode, timer, animT },
    crestedNow,
    caught,
    doorBlocked,
  };
}
