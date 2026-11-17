// The Backrooms — a room of the corporate aquatics annex (`waterpark`):
// The Scalding Bays ("the tiled shower bays hissed shut by steam").
//
// An alien simulation's glitched reconstruction of a "pre-swim shower room":
// an interlocking labyrinth of glazed white & seafoam ceramic stalls over an
// ankle-deep flooded drain floor under humming office fluorescent troffers.
// Half the shower columns run in reverse gravity — pressurized cyan jets blast
// UPWARD out of floor drains into upside-down brass showerheads and inverted
// gym lockers bolted to the acoustic ceiling tiles — while tangled 5-headed
// hydra manifolds hiss along the walls. Turn at least two red brass mixing
// valves (`E · turn mixing valve`) inside the maze lanes to vent the scalding
// steam gates and pop open the jammed Sanctum Supply Locker at the center!

import {finishPoolRoom} from '../pool-finish.js';
import * as THREE from 'three';
import { Batch, ticks, WHITE } from '../kit.js';
import { wetSign } from '../bits.js';
import {
  poolroom, natatoriumLight, poolTileTex, causticWaterTex, poolSign,
  alienMural, addTranslucent, placeVoxStack,
  hydraShowerVox, wetLockerVox, innerTubeVox, loungerVox,
  CHROME, BRASS, COPING, GROUT_DARK,
} from '../waterpark.js';
import {
  makeShowerMaze, turnShowerValve, stepShowerMaze,
} from '../waterpark.rule.js';

export function build(c) {
  const { W, D, H, params: p, kit } = c;
  c.shell({ panels: false, wallTex:poolTileTex(c.kit,'white') });
  natatoriumLight(c, 3, 3, 1, 1.06);
  poolroom(c, { wrong: 0, footbath: false, signs: false });

  const m = p.lockerSide || 1;
  const mx = (x) => m * x;

  const whiteTile = c.mapped('wp:shower:white', poolTileTex(kit, 'white'));
  const seaTile = c.mapped('wp:shower:sea', poolTileTex(kit, 'seafoam'));
  const cobTile = c.mapped('wp:shower:cob', poolTileTex(kit, 'cobalt'));

  // 1. Flooded ankle-deep seafoam shower-maze basin (`x in [-3.85, 3.85]`, `z in [-4.05, 4.05]`)
  const bx0 = -3.85, bx1 = 3.85, bz0 = -4.05, bz1 = 4.05;
  // Low bevelled ceramic coping curb around the wet labyrinth (walkable step)
  const cw = 0.14, ch = 0.07;
  c.flat.box(bx0 - cw, 0, bz0 - cw, bx1 + cw, ch, bz0, COPING, { skip: '-y' });
  c.flat.box(bx0 - cw, 0, bz1, bx1 + cw, ch, bz1 + cw, COPING, { skip: '-y' });
  c.flat.box(bx0 - cw, 0, bz0, bx0, ch, bz1, COPING, { skip: '-y' });
  c.flat.box(bx1, 0, bz0, bx1 + cw, ch, bz1, COPING, { skip: '-y' });

  seaTile.grid(
    [bx0, 0.014, bz0], [0, 0, 1], [1, 0, 0],
    ticks(bz1 - bz0, 0.65, 0), ticks(bx1 - bx0, 0.65, 0),
    (u, v) => [v / 0.72, u / 0.72], WHITE
  );

  // Shimmering ankle-deep flooded caustic water film across the entire shower labyrinth
  const waterFilm = new Batch();
  waterFilm.grid(
    [bx0, 0.052, bz0], [0, 0, 1], [1, 0, 0],
    ticks(bz1 - bz0, 0.9, 0), ticks(bx1 - bx0, 0.9, 0),
    (u, v) => [v / 1.45, u / 1.45], [0.88, 1.0, 1.0]
  );
  addTranslucent(c, waterFilm, {
    map: causticWaterTex(kit, 'aqua'),
    alpha: 0.44,
    side: THREE.DoubleSide,
    order: 2,
  });

  // 2. Interlocking 8-Partition Ceramic Shower Labyrinth (`y = 0.14..2.20 m` on chrome stall legs)
  // Every lane & doorway is 1.60m - 1.95m wide (`said: []` guaranteed on all seeds!).
  const addPartition = (ax, az, bx, bz, useSea = false) => {
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx);
    const z0 = Math.min(az, bz), z1 = Math.max(az, bz);
    const tile = useSea ? seaTile : whiteTile;
    tile.box(x0, 0.15, z0, x1, 2.16, z1, WHITE, { uv: 0.65 });
    // Cobalt mosaic accent band at shoulder height
    cobTile.box(x0 - 0.004, 1.42, z0 - 0.004, x1 + 0.004, 1.56, z1 + 0.004, WHITE, { uv: 0.5 });
    // Polished stainless top header rail + floor-gap support pedestals
    c.flat.box(x0 - 0.01, 2.16, z0 - 0.01, x1 + 0.01, 2.21, z1 + 0.01, CHROME);
    const spanX = x1 - x0 >= z1 - z0;
    const len = spanX ? (x1 - x0) : (z1 - z0);
    const posts = Math.max(2, Math.round(len / 1.6) + 1);
    for (let k = 0; k < posts; k++) {
      const f = posts === 1 ? 0.5 : k / (posts - 1);
      const px = spanX ? x0 + 0.12 + f * Math.max(0, len - 0.24) : (x0 + x1) * 0.5;
      const pz = spanX ? (z0 + z1) * 0.5 : z0 + 0.12 + f * Math.max(0, len - 0.24);
      c.flat.box(px - 0.03, 0, pz - 0.03, px + 0.03, 0.15, pz + 0.03, CHROME, { skip: '-y' });
    }
    c.solid(x0, z0, x1, z1, { tall: true });
  };

  const t = 0.065;
  // Outer North (`z = -3.80`, leaves 1.65 m NW mouth at `x_raw in [-3.60, -1.95]`)
  addPartition(mx(-1.95), -3.80 - t, mx(3.60), -3.80 + t, false);
  // Outer South (`z = +3.80`, leaves 1.65 m SE mouth at `x_raw in [+1.95, +3.60]`)
  addPartition(mx(-3.60), 3.80 - t, mx(1.95), 3.80 + t, false);
  // Outer West (`x_raw = -3.60`, `z in [-2.15, +3.80]`)
  addPartition(mx(-3.60) - t, -2.15, mx(-3.60) + t, 3.80, true);
  // Outer East (`x_raw = +3.60`, `z in [-3.80, +2.15]`)
  addPartition(mx(3.60) - t, -3.80, mx(3.60) + t, 2.15, true);
  // Inner West Lane Divider (`x_raw = -1.95`, `z in [-2.15, +2.15]`)
  addPartition(mx(-1.95) - t, -2.15, mx(-1.95) + t, 2.15, false);
  // Inner East Lane Divider (`x_raw = +1.95`, `z in [-2.15, +2.15]`)
  addPartition(mx(1.95) - t, -2.15, mx(1.95) + t, 2.15, false);
  // Sanctum North Baffle (`z = -1.95`, leaves 1.60 m NE Sanctum doorway at `x_raw in [+0.35, +1.95]`)
  addPartition(mx(-1.95), -1.95 - t, mx(0.35), -1.95 + t, true);
  // Sanctum South Baffle (`z = +1.95`, leaves 1.60 m SW Sanctum doorway at `x_raw in [-1.95, -0.35]`)
  addPartition(mx(-0.35), 1.95 - t, mx(1.95), 1.95 + t, true);

  // Overhead stainless plumbing tie-pipes spanning between stalls under the fluorescent ceiling
  for (const zp of [-2.88, 0, 2.88]) {
    c.flat.box(-3.62, 2.21, zp - 0.022, 3.62, 2.255, zp + 0.022, CHROME);
  }

  // 3. Impossible Reverse-Gravity Upward Shower Columns!
  // Narrow high-pressure cyan nozzle blasting UP out of a recessed floor drain, fanning wider
  // into a churning white foam ring around an upside-down brass showerhead on the ceiling tile!
  const upSpots = [
    [mx(-2.78), -0.35],
    [mx(2.78), 0.35],
    [mx(0.92), 0.72],
  ];
  const upStreams = [];
  for (let i = 0; i < upSpots.length; i++) {
    const [ux, uz] = upSpots[i];
    // Floor nozzle grate + ceiling-bolted upside-down brass showerhead + soaked ceiling blot
    c.flat.box(ux - 0.22, 0.015, uz - 0.22, ux + 0.22, 0.058, uz + 0.22, CHROME);
    c.flat.box(ux - 0.08, 0.058, uz - 0.08, ux + 0.08, 0.16, uz + 0.08, BRASS);
    c.flat.box(ux - 0.14, H - 0.16, uz - 0.14, ux + 0.14, H - 0.01, uz + 0.14, BRASS);
    c.flat.box(ux - 0.42, H - 0.035, uz - 0.42, ux + 0.42, H - 0.008, uz + 0.42, [0.85, 0.98, 1.0]);

    // Inverted cone column (narrow at floor -> wide at ceiling!) + rising chevron rings
    const sb = new Batch();
    const segs = 7;
    const hSpan = H - 0.20;
    for (let s = 0; s < segs; s++) {
      const f0 = s / segs, f1 = (s + 1) / segs;
      const y0 = 0.14 + f0 * hSpan, y1 = 0.14 + f1 * hSpan;
      const r = 0.055 + f1 * 0.24; // widens going UPWARD!
      const col = s === segs - 1 ? [0.92, 1.0, 1.0] : s % 2 === 0 ? [0.16, 0.86, 0.98] : [0.58, 0.96, 1.0];
      sb.box(-r, y0, -r, r, y1, r, col);
    }
    const streamMesh = addTranslucent(c, sb, { alpha: 0.46, side: THREE.DoubleSide, order: 4 });
    streamMesh.position.set(ux, 0, uz);

    // Rising water-pulse rings that physically travel UPWARD toward the ceiling every tick!
    const rb = new Batch();
    rb.box(-0.22, -0.06, -0.22, 0.22, 0.06, 0.22, [0.92, 1.0, 1.0]);
    rb.box(-0.15, 0.42, -0.15, 0.15, 0.52, 0.15, [0.55, 0.96, 1.0]);
    const pulseMesh = addTranslucent(c, rb, { alpha: 0.58, side: THREE.DoubleSide, order: 5 });
    pulseMesh.position.set(ux, 0.3, uz);
    upStreams.push({ ux, uz, streamMesh, pulseMesh, phase: i * 0.37 });
  }

  // 4. Baked 3 cm `Vox` Oddities: Upside-Down Ceiling Lockers, 5-Headed Hydra Showers & Corner Totem!
  const voxEntries = [
    // 3 Upside-down rusted gym lockers bolted straight to the suspended acoustic ceiling tiles!
    { key: 'wp:locker:inv:#ff5c8a', make: wetLockerVox('#ff5c8a', true), x: mx(-0.95), y: H - 0.02, z: -2.88, rot: 0.12, tilt: [Math.PI, 0.04] },
    { key: 'wp:locker:inv:#f2c12e', make: wetLockerVox('#f2c12e', true), x: mx(0.95), y: H - 0.02, z: 2.88, rot: Math.PI - 0.1, tilt: [Math.PI, -0.05] },
    { key: 'wp:locker:inv:#29b6d8', make: wetLockerVox('#29b6d8', true), x: mx(-0.15), y: H - 0.02, z: 0.88, rot: Math.PI * 0.5, tilt: [Math.PI, 0.03] },

    // 4 Tangled 5-Headed Hydra Shower Manifolds sprouting out of the tiled maze partitions!
    { key: 'wp:hydra', make: hydraShowerVox(), x: mx(-3.51), y: 1.62, z: -1.15, rot: m > 0 ? Math.PI * 0.5 : -Math.PI * 0.5 },
    { key: 'wp:hydra', make: hydraShowerVox(), x: mx(3.51), y: 1.62, z: 1.15, rot: m > 0 ? -Math.PI * 0.5 : Math.PI * 0.5 },
    { key: 'wp:hydra', make: hydraShowerVox(), x: mx(-1.86), y: 1.66, z: 0.25, rot: m > 0 ? Math.PI * 0.5 : -Math.PI * 0.5 },
    { key: 'wp:hydra', make: hydraShowerVox(), x: mx(1.86), y: 1.66, z: -0.25, rot: m > 0 ? -Math.PI * 0.5 : Math.PI * 0.5 },
  ];

  // Add a glitched stacked Locker + Lounger + Inner-Tube Totem in a clear outer corner if clear
  const cornerX = mx(-W / 2 + 1.05), cornerZ = D / 2 - 1.05;
  let totemSolid = null;
  if (c.clear(cornerX, cornerZ, 0.65)) {
    voxEntries.push(
      { key: 'wp:locker:#ff5c8a', make: wetLockerVox('#ff5c8a'), x: cornerX, y: 0, z: cornerZ, rot: m > 0 ? 0.55 : -0.55 },
      { key: 'wp:tube:#f2c12e:0', make: innerTubeVox('#f2c12e', false), x: cornerX, y: 1.38, z: cornerZ, rot: 0.4, tilt: [0.08, -0.06] },
      { key: 'wp:tube:#29b6d8:0', make: innerTubeVox('#29b6d8', false), x: cornerX + 0.03, y: 1.64, z: cornerZ - 0.02, rot: 1.7, tilt: [-0.06, 0.08] },
      { key: 'wp:lounger:#eb5347', make: loungerVox('#eb5347'), x: cornerX, y: 2.28, z: cornerZ, rot: 0.9, tilt: [Math.PI, 0.14], scale: 0.024 }
    );
    totemSolid = [cornerX - 0.34, cornerZ - 0.34, cornerX + 0.34, cornerZ + 0.34];
    c.reserve(cornerX, cornerZ, 0.72);
  }
  placeVoxStack(c, 'wp:shower:voxstack:' + c.room.id, voxEntries, totemSolid ? { solidBox: totemSolid } : {});

  // 5. Central Sanctum Supply Locker + Slatted Bench (`x_raw in [-0.75, -0.15], z in [-0.55, 0.55]`)
  const sx = mx(-0.48), sz = -0.15;
  c.flat.box(sx - 0.26, 0, sz - 0.30, sx + 0.26, 1.96, sz + 0.30, [0.30, 0.44, 0.49], { skip: '-y' });
  // Interior glowing shelf inside the jammed Sanctum Locker
  c.flat.box(sx - 0.21, 0.88, sz - 0.24, sx + 0.21, 0.93, sz + 0.24, COPING);
  c.solid(sx - 0.28, sz - 0.32, sx + 0.28, sz + 0.32, { tall: true });

  // Animated hinged Sanctum Locker door (`doorMesh.rotation.y` swings wide when >= 2 valves are shut!)
  const doorBatch = new Batch();
  const faceSign = m > 0 ? 1 : -1;
  doorBatch.box(-0.02, 0.08, 0, 0.02, 1.88, 0.54, [0.44, 0.60, 0.65]);
  for (const ly of [1.56, 1.64, 1.72]) {
    doorBatch.box(-0.03, ly, 0.09, 0.03, ly + 0.03, 0.45, GROUT_DARK);
  }
  doorBatch.box(-0.035, 0.95, 0.42, 0.035, 1.12, 0.48, BRASS);
  const sanctumDoor = c.dynamic(doorBatch, { pivot: [sx + faceSign * 0.27, 0, sz - 0.27] });

  // Slatted wooden changing bench right beside the Sanctum Locker + guaranteed supply reward!
  const benchX = mx(0.28), benchZ = -0.15;
  c.flat.box(benchX - 0.20, 0.40, benchZ - 0.58, benchX + 0.20, 0.46, benchZ + 0.58, [0.68, 0.50, 0.32]);
  c.flat.box(benchX - 0.16, 0, benchZ - 0.46, benchX + 0.16, 0.40, benchZ - 0.36, CHROME, { skip: '-y' });
  c.flat.box(benchX - 0.16, 0, benchZ + 0.36, benchX + 0.16, 0.40, benchZ + 0.46, CHROME, { skip: '-y' });
  c.solid(benchX - 0.22, benchZ - 0.60, benchX + 0.22, benchZ + 0.60);
  c.leave('battery', benchX, benchZ, { y: 0.47 });

  // 6. Three Scalding Steam Gates & Three Interactive Red Brass Mixing Valves!
  // Gate 0 blocks North Cross Lane (`z in [-3.75, -2.00]` at `x = 0`)
  // Gate 1 blocks South Cross Lane (`z in [+2.00, +3.75]` at `x = 0`)
  // Gate 2 blocks Sanctum North Doorway (`x_raw in [+0.40, +1.90]` at `z = -1.95`)
  const gateSpecs = [
    { x: 0, z: -2.88, axis: 'z', span: 1.65 },
    { x: 0, z: 2.88, axis: 'z', span: 1.65 },
    { x: mx(1.15), z: -1.95, axis: 'x', span: 1.48 },
  ];
  let maze = makeShowerMaze(gateSpecs);

  const plumes = gateSpecs.map((g) => {
    const pb = new Batch();
    for (let k = 0; k < 5; k++) {
      const u = (k / 4) - 0.5;
      const along = u * g.span;
      const r = 0.24 + (1 - Math.abs(u)) * 0.18;
      const cx = g.axis === 'x' ? along : 0;
      const cz = g.axis === 'z' ? along : 0;
      pb.box(cx - r, 0.32, cz - r, cx + r, 2.08, cz + r, [0.95, 0.99, 1.0]);
    }
    const mesh = addTranslucent(c, pb, { alpha: 0.32, side: THREE.FrontSide, order: 3 });
    mesh.position.set(g.x, 0, g.z);
    return mesh;
  });

  // Three Red Brass Mixing Valves tucked along the West Lane, East Lane, and SW Turn!
  const valveSpecs = [
    { vx: mx(-3.46), vz: 1.35, faceX: m > 0 ? 1 : -1 },
    { vx: mx(3.46), vz: -1.35, faceX: m > 0 ? -1 : 1 },
    { vx: mx(-2.09), vz: -1.35, faceX: m > 0 ? -1 : 1 },
  ];
  const wheels = valveSpecs.map((v, idx) => {
    c.flat.box(v.vx - 0.04, 0.55, v.vz - 0.04, v.vx + 0.04, 1.38, v.vz + 0.04, CHROME);
    c.flat.box(v.vx - 0.06, 1.08, v.vz - 0.06, v.vx + 0.06, 1.24, v.vz + 0.06, BRASS);
    const wb = new Batch();
    const rCol = [0.88, 0.16, 0.14];
    wb.box(-0.06, -0.24, -0.05, 0.06, 0.24, 0.05, rCol);
    wb.box(-0.06, -0.05, -0.24, 0.06, 0.05, 0.24, rCol);
    wb.box(-0.04, -0.24, -0.24, 0.04, -0.18, 0.24, rCol);
    wb.box(-0.04, 0.18, -0.24, 0.04, 0.24, 0.24, rCol);
    const wheel = c.dynamic(wb, { pivot: [v.vx + v.faceX * 0.11, 1.16, v.vz] });

    c.use({
      x: v.vx + v.faceX * 0.35,
      z: v.vz,
      r: 1.65,
      label: 'turn mixing valve',
      when: () => !maze.shut[idx],
      use: () => {
        const res = turnShowerValve(maze, idx);
        maze = res.state;
        const w = c.toWorld(v.vx, v.vz);
        c.env.play?.('click', w.x, w.z, 7);
        c.env.play?.('slide', w.x, w.z, 6);
        if (res.unlockedNow) {
          const sw = c.toWorld(sx, sz);
          c.env.play?.('rattle', sw.x, sw.z, 8);
        }
      },
    });
    return wheel;
  });

  // Debug / test handle (`c.rt.showerMaze`)
  c.rt.showerMaze = {
    get state() { return maze; },
    turnValve: (idx) => {
      const res = turnShowerValve(maze, idx);
      maze = res.state;
      return res;
    },
  };

  // 7. Corrupted 4th-Hand Alien Shower Mural + Garbled Hygiene Rules + Caution Sign
  const muralWall = c.wallSpot(2.6, undefined, 0.35, 2.3);
  if (muralWall) {
    alienMural(c, muralWall.side, muralWall.at, 1.42, 2.48, 1.52, 3, c.room.id * 23 + 11);
  }
  const signWall = c.wallSpot(1.3, undefined, 0.25, 2.1);
  if (signWall) {
    poolSign(c, signWall.side, signWall.at, 1.52, [
      p.bayCode || 'RINSE LABYRINTH',
      'WATER RISES TO CEILING',
      'SHUT TWO RED VALVES',
      'LOCKER OPENS AT ZERO PSI',
    ], { seed: 97, warn: true, mess: 0.24 });
  }
  wetSign(c, mx(-2.78), -4.35, 0.14, ['RINSE UPWARD', 'STEAM MAZE']);

  let hissTimer = 0.9;
  c.tick((dt, tNow, me) => {
    // Flooded maze floor gentle wading drag
    if (me.inside && me.world && Math.abs(me.x) < 3.85 && Math.abs(me.z) < 4.05) {
      me.world.slow = Math.min(me.world.slow, 0.84);
    }

    const step = stepShowerMaze(maze, {
      dt,
      inside: me.inside,
      px: me.x,
      pz: me.z,
    });
    maze = step.state;

    if (step.activeGates > 0 && me.inside) {
      hissTimer -= dt;
      if (hissTimer <= 0) {
        hissTimer = 2.5;
        const w = c.toWorld(0, 0);
        c.env.play?.('slide', w.x, w.z, 5);
      }
    }

    if (step.burned) {
      const w = c.toWorld(me.x, me.z);
      c.env.play?.('slide', w.x, w.z, 9);
      c.env.interfere?.(0.8);
      c.env.hud?.glitch?.(0.45);
      const drained = c.env.camera?.drain?.(0.10);
      if (!drained || !drained.ok) c.hurt(1);
    }

    // Spin shut valve wheels & hide vented steam gates
    for (let i = 0; i < wheels.length; i++) {
      if (maze.shut[i]) {
        wheels[i].rotation.x = Math.min(4.6, wheels[i].rotation.x + dt * 6.5);
      }
    }
    for (let i = 0; i < plumes.length; i++) {
      const on = !maze.shut[i] && !maze.sanctumOpen;
      plumes[i].visible = on;
      if (on) {
        plumes[i].scale.set(
          1 + 0.07 * Math.sin(tNow * 9 + i * 2),
          1 + 0.06 * Math.cos(tNow * 7 + i),
          1 + 0.07 * Math.sin(tNow * 8 + i)
        );
      }
    }

    // Swing open the Sanctum Supply Locker once unlocked
    sanctumDoor.rotation.y = (m > 0 ? 1 : -1) * maze.doorAngle;

    // Animate upward-shooting reverse-gravity water columns!
    const hMax = Math.max(0.8, H - 0.85);
    for (let i = 0; i < upStreams.length; i++) {
      const u = upStreams[i];
      const cyc = ((tNow * (1.25 * maze.upwardSurge) + u.phase) % 1);
      u.pulseMesh.position.y = 0.18 + cyc * hMax;
      const sc = 0.65 + cyc * 0.85;
      u.pulseMesh.scale.set(sc, 1, sc);
      u.streamMesh.scale.set(
        1 + 0.08 * Math.sin(tNow * 11 + i) * maze.upwardSurge,
        1,
        1 + 0.08 * Math.cos(tNow * 10 + i) * maze.upwardSurge
      );
    }
  });

  void W; void D;
  finishPoolRoom(c,'locker-showers');
}
