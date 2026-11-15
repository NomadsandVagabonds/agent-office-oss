// The Backrooms — the waste toner. Something that leaked out of a copier waste
// cartridge into the ceiling plenum and grew four hyper-angled, phase-slipping
// limbs around a knotted black core.
//
// It lives upside down on the suspended ceiling by default, sending out sharp
// echolocation click-trains while black toner droplets fall from the tiles
// beneath it. Hold crouch (C) or stand still and its clicks pass over you.
// Walk or sprint upright in earshot and its clicks rattle faster until it peels
// down the wall and comes after you on all fours — blistering fast, never in a
// straight line, banking onto corridor walls as it weaves and skittering right
// through low crawl holes. It has claws, not hands, so a shut fire door stops
// it cold.
//
// Feeding & brood lifecycle: each bite costs 1 heart; on landing its second
// bite (2 damage dealt — now full) its phase collapses into a brooding pool of
// black glitch slime on the carpet. Leave that puddle for ~1 minute (60 s) and
// it swells, ruptures into a spent tar ring, and hatches 2–3 new waste toners
// that cling to the ceiling around the room where they spawned unless they hear
// upright movement nearby.
import * as THREE from 'three';
import { Vox, M, glow } from '../../vox/vox.js';
import { Batch, lamp } from '../kit.js';
import { makeRng, roomDistances } from '../gen.js';
import { clamp, turnTo } from '../bits.js';
import { FIRE_FEAR, calm as unafraid, afraid, tooNear } from './fire.rule.js';
import { TONER, perched, hatchedBrood, weaveOffset, stepToner, strikeToner, snipToner } from './toner.rule.js';

const S = 0.022;                               // 2.2 cm per voxel: sharp, spindly silhouette
const VOID = '#050609', TAR = '#0d1018', OIL = '#171c29', SHEEN = '#262e42', STATIC = '#8fa4bd';

/* ---- voxel sculpture: knotted non-humanoid core, 4 arachnid-hound limbs, torn frames ---- */

/** Scanline-sheared copy of a voxel model: horizontal slices slip sideways and forward/back. */
function torn(src, R, glint = false) {
  const out = new Vox(), b = src.bounds(), shift = new Map();
  for (let y = b.y0 + R.int(0, 2); y < b.y1; y += R.int(1, 4)) {
    const h = R.int(1, 2), dx = R.pick([-6, -4, -3, -2, 2, 3, 4, 6]), dz = R.pick([-2, -1, 0, 1, 2]);
    for (let k = 0; k < h; k++) shift.set(y + k, [dx, dz]);
    y += h;
  }
  const spark = glow(STATIC), edge = M('#485673', 0);
  src.each((x, y, z, c) => {
    const sh = shift.get(y);
    const nx = x + (sh ? sh[0] : 0), nz = z + (sh ? sh[1] : 0);
    const pick = glint && sh && R.chance(0.035) ? (R.chance(0.35) ? spark : edge) : c;
    out.set(nx, y, nz, pick);
  });
  return out;
}

/** Asymmetric non-humanoid pitch-black knotted core with whipping dorsal tendrils and hanging ink threads. */
function coreVox(variant, R) {
  const v = new Vox(), voidM = M(VOID, 1), tar = M(TAR, 1), oil = M(OIL, 0), sheen = M(SHEEN, 0);
  v.ellipsoid(0, 10, 0, 6.5, 4.6, 8.2, voidM);
  v.ellipsoid(-2 + (variant % 2) * 3, 11, 3.5, 4.8, 3.8, 5.2, tar);
  v.ellipsoid(2 - (variant % 2) * 3, 9.5, -3.5, 5.2, 3.6, 5.0, tar);
  // forward sensory snout-knot (blind, cleft, jagged — no eyes, no face)
  v.tube(0, 9.5, 5, (variant % 3) - 1, 8.5, 11.5, 2.4, voidM);
  v.carve(-1, 8, 9, 1, 11, 13);
  // whipping dorsal tar spikes (different silhouette per variant so morphs writhe even when still)
  const spikes = [
    [[-3, 12, 2, -7, 19, -3], [3, 12, 0, 6, 18, -5], [0, 13, -3, -2, 20, -9], [2, 11, 5, 5, 16, 8]],
    [[-2, 13, 4, -6, 20, 1], [4, 12, -2, 8, 17, -7], [-1, 12, -5, 3, 19, -10], [-4, 10, -1, -8, 15, -5]],
    [[0, 13, 3, 4, 20, -1], [-4, 12, -1, -7, 18, -6], [2, 12, -4, -1, 19, -11], [4, 10, 4, 7, 15, 7]],
    [[-3, 12, 0, -5, 20, 4], [3, 13, 2, 7, 19, -2], [0, 12, -5, 0, 18, -11], [-2, 10, 6, -5, 15, 9]],
  ][variant % 4];
  for (const [x0, y0, z0, x1, y1, z1] of spikes) {
    const mx = (x0 + x1) / 2 + R.range(-1, 1), my = (y0 + y1) / 2 + 1.5, mz = (z0 + z1) / 2;
    v.tube(x0, y0, z0, mx, my, mz, 1.5, tar);
    v.tube(mx, my, mz, x1, y1, z1, 0.85, oil);
  }
  // hanging vertical ink filaments under the belly
  for (let i = 0; i < 6; i++) {
    const fx = R.int(-4, 4), fz = R.int(-6, 6), len = R.int(3, 7);
    v.box(fx, 7 - len, fz, fx + 1, 8, fz + 1, i % 2 ? voidM : tar);
  }
  // wet toner rim sheen on upper exposed surfaces so the black silhouette reads crisply against dim ceilings/floors
  v.each((x, y, z) => {
    if (y >= 12 && v.exposed(x, y, z, 0, 1, 0) && ((x * 3 + z * 5 + variant) & 7) === 0) v.set(x, y, z, sheen);
  });
  return v;
}

/**
 * One hyper-angled multi-jointed appendage, with its origin at the shoulder socket (y = 10*S).
 * Arches steeply UP above the back to a jagged knee, then plunges down to a forked claw at y = -10.
 */
function limbVox(sx, sz) {
  const v = new Vox(), voidM = M(VOID, 1), tar = M(TAR, 1), oil = M(OIL, 0), sheen = M(SHEEN, 0);
  const kx = sx * 8.5, ky = 11.5, kz = sz * 6.5;           // high-arched arachnid knee rising above the core
  const ax = sx * 12.5, ay = 0.5, az = sz * 9.5;           // mid-shank bend
  const fx = sx * 14.5, fy = -10, fz = sz * 11.5;          // planted claw tip (touches y = 0 when socket is at y = 10)
  v.tube(0, 0, 0, kx, ky, kz, 1.85, voidM);
  v.tube(kx, ky, kz, ax, ay, az, 1.45, tar);
  v.tube(ax, ay, az, fx, fy, fz, 1.0, voidM);
  // jagged knee spur + a thread of toner hanging off the joint
  v.tube(kx, ky, kz, kx + sx * 2, ky + 4.5, kz - sz * 1.5, 0.9, sheen);
  v.box(Math.round(kx), Math.round(ky - 9), Math.round(kz), Math.round(kx) + 1, Math.round(ky), Math.round(kz) + 1, tar);
  v.box(Math.round(ax), Math.round(ay - 6), Math.round(az), Math.round(ax) + 1, Math.round(ay), Math.round(az) + 1, oil);
  // forked claw toes
  v.tube(fx, fy, fz, fx + sx * 2, fy, fz + sz * 2.5, 0.75, sheen);
  v.tube(fx, fy, fz, fx - sx * 0.5, fy, fz + sz * 3, 0.7, tar);
  return v;
}

/** Gapped vertical wisps of loose toner that drift upward off the back and limbs, the way the dust hangs over a split cartridge. */
function streakVox(variant = 0) {
  const v = new Vox(), voidM = M(VOID, 0), tar = M(TAR, 0);
  const segs = [
    [[0, 0, 2], [1, 5, 8], [0, 11, 13]],
    [[0, 1, 4], [-1, 7, 9], [0, 12, 14]],
    [[0, 0, 3], [0, 6, 8], [1, 10, 12]],
  ][variant % 3];
  for (const [dx, y0, y1] of segs) {
    for (let y = y0; y < y1; y++) v.set(dx, y, 0, y === y1 - 1 ? tar : voidM);
  }
  return v;
}

/** Tiny falling toner droplet for ceiling perches. */
function dropVox() {
  const v = new Vox();
  v.box(0, 0, 0, 1, 3, 1, M(VOID, 0));
  v.set(0, 1, 0, M(OIL, 0));
  return v;
}

/** Multi-lobed irregular pool of black glitch slime left on the floor after 2 landed bites. */
function puddleBaseVox(R) {
  const v = new Vox(), voidM = M(VOID, 0), tar = M(TAR, 0), oil = M(OIL, 0);
  v.ellipsoid(0, 0.8, 0, 23, 1.3, 21, voidM);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + R.range(-0.25, 0.25), rad = R.range(12, 24);
    const lx = Math.cos(a) * rad, lz = Math.sin(a) * rad, rx = R.range(5, 11), rz = R.range(5, 11);
    v.ellipsoid(lx, 0.8, lz, rx, 1.2, rz, i % 3 === 0 ? tar : voidM);
  }
  // Small satellite splatter droplets around the rim
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4, rad = R.range(24, 30);
    v.ellipsoid(Math.cos(a) * rad, 0.6, Math.sin(a) * rad, R.range(2, 3.6), 1.0, R.range(2, 3.6), voidM);
  }
  v.carve(-45, -5, -45, 45, 0, 45);
  v.each((x, y, z) => {
    if (y >= 1 && v.exposed(x, y, z, 0, 1, 0) && ((x * 11 + z * 17) & 15) === 0) v.set(x, y, z, oil);
  });
  return v;
}

/** Thin torn scanline ripple + ferrofluid slime tendril twitching out of the dissolved pool. */
function puddleShardVox(k) {
  const v = new Vox(), voidM = M(VOID, 0), oil = M(OIL, 0), spark = glow(STATIC);
  const w = 4 + (k % 3) * 3;
  // Flat 1-voxel scanline tear skimming the puddle surface
  v.box(-w, 0, 0, w, 1, 1, k % 2 ? voidM : oil);
  v.box(-w + 3, 0, 2, Math.max(-w + 6, w - 4), 1, 3, voidM);
  // Slender rising ferrofluid spike in the middle
  const h = 3 + (k % 3) * 2;
  v.box(0, 0, 0, 1, h, 1, voidM);
  v.set(1, Math.max(1, h - 2), 0, oil);
  if (k % 3 === 0) v.set(0, h, 0, spark);
  return v;
}

/** Bake all voxel BufferGeometries once per floor so puddle hatching never hitches the frame. */
function makeSharedGeoms(kit, R) {
  const m4 = new THREE.Matrix4().makeScale(S, S, S);
  const lights = [lamp(0.3, 2.5, 0.9, [1.45, 1.48, 1.55], { k: 9, wrap: 0.55, far: 30 })], amb = [0.68, 0.7, 0.75];
  const bake = (key, make) => {
    const b = new Batch(true);
    b.addVox(kit.model('toner:' + key, make).solid, m4);
    return kit.geometry(b, lights, amb);
  };
  const sockets = [[-1, 1, 'fl'], [1, 1, 'fr'], [-1, -1, 'bl'], [1, -1, 'br']];
  return {
    cores: [0, 1, 2, 3].map((k) => ({
      wholeGeo: bake('core' + k, () => coreVox(k, R.fork ? R.fork('core' + k) : makeRng('toner-core-' + k))),
      slippedGeo: bake('coreTorn' + k, () => torn(coreVox(k, makeRng('toner-same-' + k)), R.fork ? R.fork('tear' + k) : makeRng('toner-tear-' + k), true)),
    })),
    limbs: sockets.map(([sx, sz, tag], idx) => ({
      sx, sz, tag,
      wholeGeo: bake('limb:' + tag, () => limbVox(sx, sz)),
      slippedGeo: bake('limbTorn:' + tag, () => torn(limbVox(sx, sz), makeRng('limb-tear-' + tag), idx % 2 === 0)),
    })),
    streaks: [0, 1, 2].map((k) => bake('streak' + k, () => streakVox(k))),
    dropGeo: bake('drop', dropVox),
    puddleBaseGeo: bake('puddleBase', () => puddleBaseVox(R.fork ? R.fork('puddle') : makeRng('toner-puddle'))),
    shards: Array.from({ length: 6 }, (_, i) => bake('shard' + i, () => puddleShardVox(i))),
    stainGeo: kit.own(new THREE.PlaneGeometry(1.15, 1.15)),
    stainMat: kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x040508, transparent: true, opacity: 0.56, depthWrite: false })),
    puddleStainGeo: kit.own(new THREE.PlaneGeometry(2.35, 2.35)),
  };
}

/** Instantiate a Waste Toner rig sharing pre-baked geometries with its own tintable surface material. */
function instantiateRig(kit, geoms, unitScale = 1) {
  const mat = kit.surface({ vox: true });
  const root = new THREE.Group(), orient = new THREE.Group(), body = new THREE.Group();
  root.rotation.order = 'YXZ';
  orient.rotation.order = 'ZYX';
  orient.scale.setScalar(unitScale);
  root.add(orient);
  orient.add(body);

  const cores = geoms.cores.map(({ wholeGeo, slippedGeo }) => {
    const whole = new THREE.Mesh(wholeGeo, mat);
    const slipped = new THREE.Mesh(slippedGeo, mat);
    whole.visible = slipped.visible = false;
    body.add(whole, slipped);
    return { whole, slipped };
  });

  const limbs = geoms.limbs.map(({ sx, sz, wholeGeo, slippedGeo }) => {
    const g = new THREE.Group();
    g.position.set(sx * 4.8 * S, 10 * S, sz * 5.2 * S);
    const whole = new THREE.Mesh(wholeGeo, mat);
    const slipped = new THREE.Mesh(slippedGeo, mat);
    slipped.visible = false;
    g.add(whole, slipped);
    body.add(g);
    return { g, sx, sz, whole, slipped };
  });

  const streaks = Array.from({ length: 8 }, (_, i) => {
    const m = new THREE.Mesh(geoms.streaks[i % 3], mat);
    const angle = (i / 8) * Math.PI * 2;
    m.userData = { angle, rad: 0.13 + (i % 3) * 0.08, phase: i * 0.85 };
    body.add(m);
    return m;
  });

  const stain = new THREE.Mesh(geoms.stainGeo, geoms.stainMat);
  stain.rotation.x = -Math.PI / 2;
  stain.position.y = 0.012;
  stain.renderOrder = 1;
  orient.add(stain);

  const drips = Array.from({ length: 3 }, () => {
    const m = new THREE.Mesh(geoms.dropGeo, mat);
    m.visible = false;
    return { m, active: false, x: 0, y: 0, z: 0, vy: 0, floorY: 0, hold: 0 };
  });

  const puddle = new THREE.Group();
  puddle.visible = false;
  const puddleStainMat = kit.own(new THREE.MeshBasicMaterial({
    map: kit.tex.blob(), color: 0x030407, transparent: true, opacity: 0.72, depthWrite: false,
  }));
  const puddleStain = new THREE.Mesh(geoms.puddleStainGeo, puddleStainMat);
  puddleStain.rotation.x = -Math.PI / 2;
  puddleStain.position.y = 0.008;
  puddleStain.renderOrder = 1;
  puddle.add(puddleStain);

  const puddleSlab = new THREE.Mesh(geoms.puddleBaseGeo, mat);
  puddle.add(puddleSlab);

  const shards = geoms.shards.map((geo, i) => {
    const m = new THREE.Mesh(geo, mat);
    const a = (i / 6) * Math.PI * 2 + 0.3, r = 0.16 + (i % 3) * 0.17;
    m.userData = { bx: Math.cos(a) * r, bz: Math.sin(a) * r, phase: i * 1.3 };
    m.position.set(m.userData.bx, 0.02, m.userData.bz);
    puddle.add(m);
    return m;
  });

  const rig = {
    root, orient, body, cores, limbs, streaks, stain, drips, puddle, puddleSlab, puddleStainMat, shards, mat,
    variant: 0, slip: false,
    show(variant = rig.variant, slip = rig.slip) {
      rig.variant = variant % cores.length;
      rig.slip = slip;
      cores.forEach((c, k) => {
        c.whole.visible = k === rig.variant && !slip;
        c.slipped.visible = k === rig.variant && slip;
      });
      limbs.forEach((l, k) => {
        const lSlip = slip && ((k + rig.variant) % 2 === 0);
        l.whole.visible = !lSlip;
        l.slipped.visible = lSlip;
      });
    },
    light(rgb) {
      // Keep a faint floor of dark oily sheen so pitch-black toner limbs still separate in dim corridors
      mat.uniforms.uTint.value.set(Math.max(0.08, rgb[0]), Math.max(0.085, rgb[1]), Math.max(0.1, rgb[2]));
    },
  };
  rig.show(0, false);
  return rig;
}

/* ---- surface helpers: ceiling height and nearby wall banking ---------------------------- */

function surfaceBounds(w, x, z) {
  const rt = w.roomAt(x, z), floorY = w.floorY(x, z);
  const ceilY = rt ? rt.def.y + rt.def.H : floorY + 2.7;
  if (!rt) return { rt: null, floorY, ceilY, wall: null };
  const r = rt.rect;
  const walls = [
    { dist: x - r.x0, nx: 1, nz: 0 },
    { dist: r.x1 - x, nx: -1, nz: 0 },
    { dist: z - r.z0, nx: 0, nz: 1 },
    { dist: r.z1 - z, nx: 0, nz: -1 },
  ];
  let near = walls[0];
  for (const cand of walls) if (cand.dist < near.dist) near = cand;
  // Do not climb air across an open doorway throat
  for (const d of rt.def.doors || []) {
    const th = w.throats[d.link]?.link;
    if (!th) continue;
    const mid = (th.from + th.to) / 2, tx = th.axis === 'x' ? th.at : mid, tz = th.axis === 'x' ? mid : th.at;
    if (Math.hypot(x - tx, z - tz) < (th.to - th.from) * 0.5 + 0.35) return { rt, floorY, ceilY, wall: null };
  }
  return { rt, floorY, ceilY, wall: near };
}

export function create(c) {
  const env = c.env, level = env.level, R = c.R, me = c.me;
  const units = [];
  let geoms = null, placed = false, nextId = 1, wadeT = 0, seenT = 0, known = false, over = false;

  function pickStartRoom() {
    const dist = roomDistances(level, level.start.room);
    const plain = level.rooms.filter((r) => r.kind === 'plain' && !r.crawl && r.H >= 2.2 && r.H <= 3.6 && (dist.get(r.id) ?? 0) >= 2);
    const far = level.rooms.filter((r) => r.kind !== 'start' && r.kind !== 'exit' && !r.crawl && r.H >= 2.2 && (dist.get(r.id) ?? 0) >= 2);
    const fallback = level.rooms.filter((r) => r.kind !== 'start' && r.H >= 1.8 && (dist.get(r.id) ?? 1) >= 1);
    const pool = plain.length ? plain : far.length ? far : fallback.length ? fallback : level.rooms;
    return R.pick(pool);
  }

  function pickSpotInRoom(walker, roomId, preferAngle = null, awayFrom = null) {
    const w = env.world, rt = roomId != null ? w.rooms[roomId] : null;
    if (!rt) return null;
    const r = rt.rect, pad = 0.52;
    const x0 = r.x0 + pad, x1 = Math.max(x0 + 0.1, r.x1 - pad);
    const z0 = r.z0 + pad, z1 = Math.max(z0 + 0.1, r.z1 - pad);
    if (preferAngle !== null) {
      const cx = (x0 + x1) * 0.5, cz = (z0 + z1) * 0.5;
      const rx = (x1 - x0) * 0.38, rz = (z1 - z0) * 0.38;
      for (let k = 0; k < 10; k++) {
        const a = preferAngle + (k ? (Math.random() - 0.5) * 0.9 : 0);
        const scale = 1 - k * 0.06;
        const px = clamp(cx + Math.cos(a) * rx * scale, x0, x1);
        const pz = clamp(cz + Math.sin(a) * rz * scale, z0, z1);
        if (w.roomAt(px, pz) === rt && c.walk.stand(walker, px, pz)) return { x: px, z: pz };
      }
    }
    if (awayFrom) {
      let best = null, bestD = -1;
      for (let k = 0; k < 10; k++) {
        const px = x0 + Math.random() * (x1 - x0), pz = z0 + Math.random() * (z1 - z0);
        if (w.roomAt(px, pz) !== rt || !c.walk.stand(walker, px, pz)) continue;
        const d = Math.hypot(px - awayFrom.x, pz - awayFrom.z);
        if (d > bestD) { bestD = d; best = { x: px, z: pz }; }
      }
      if (best) return best;
    } else {
      for (let k = 0; k < 12; k++) {
        const px = x0 + Math.random() * (x1 - x0), pz = z0 + Math.random() * (z1 - z0);
        if (w.roomAt(px, pz) !== rt || !c.walk.stand(walker, px, pz)) continue;
        if (Math.hypot(px - walker.x, pz - walker.z) > 0.85 || k >= 8) return { x: px, z: pz };
      }
    }
    return c.walk.spotIn(walker, roomId);
  }

  /** Roaming ceiling goal across connected rooms (used by the original floor Waste Toner). */
  function chooseRoamingGoal(walker, awayFrom = null) {
    const exits = c.walk.exits(walker);
    if (!exits.length) return pickSpotInRoom(walker, c.room(walker.x, walker.z), null, awayFrom);
    if (awayFrom) {
      let best = null, bestD = -1;
      for (const e of exits) {
        const sp = c.walk.spotIn(walker, e.room);
        const d = Math.hypot(sp.x - awayFrom.x, sp.z - awayFrom.z);
        if (d > bestD) { bestD = d; best = sp; }
      }
      return best;
    }
    const pick = exits[Math.floor(Math.random() * exits.length)];
    return c.walk.spotIn(walker, pick.room);
  }

  /**
   * Territorial ceiling leash for puddle-hatched broodlings:
   * stays on the ceiling inside (or right beside) `homeRoom` unless sonar hears the player.
   * If a chase led it elsewhere and it lost the player, creeps back home across the ceiling.
   */
  function chooseTerritorialGoal(unit, awayFrom = null) {
    const hr = unit.s.homeRoom, curRoom = c.room(unit.walker.x, unit.walker.z);
    if (hr === null || !env.world.rooms[hr]) return chooseRoamingGoal(unit.walker, awayFrom);
    if (curRoom !== hr) {
      const homeSpot = pickSpotInRoom(unit.walker, hr, null, awayFrom);
      if (homeSpot && c.walk.steps(unit.walker, homeSpot) < Infinity) return homeSpot;
      // Cut off from homeRoom by a shut fire door: patrol current room's ceiling until a path opens
      return pickSpotInRoom(unit.walker, curRoom, null, awayFrom);
    }
    // 20% of calm prowls peek just outside an open doorway of homeRoom, then return next cycle
    if (!awayFrom && Math.random() < 0.2) {
      const exits = c.walk.exits(unit.walker);
      if (exits.length) {
        const e = exits[Math.floor(Math.random() * exits.length)];
        const peek = c.walk.spotBeyond(hr, e.room, 1.15);
        if (peek && c.walk.stand(unit.walker, peek.x, peek.z)) return peek;
      }
    }
    return pickSpotInRoom(unit.walker, hr, null, awayFrom);
  }

  function spawnUnit(x, z, state, unitScale = 1, initGoal = null, initYaw = R.range(0, Math.PI * 2)) {
    const rig = instantiateRig(env.kit, geoms, unitScale);
    c.add(rig.root);
    c.add(rig.puddle);
    for (const d of rig.drips) c.add(d.m);
    const solidBody = { x: 1e6, z: 1e6, r: 0.18 };
    c.body(solidBody);

    const walker = { x, z, r: TONER.r, tall: TONER.tall, opens: TONER.opens, crawls: TONER.crawls, speed: TONER.prowlSpeed };
    const b = surfaceBounds(env.world, x, z);
    const isFloorPuddle = state.mode === 'puddle' || state.mode === 'spent';
    const isEmerging = !!state.territorial && state.mode === 'recoil';
    let surfY = b.ceilY - 0.03, bankZ = Math.PI;

    if (isFloorPuddle) {
      surfY = b.floorY; bankZ = 0;
      rig.root.visible = false;
      rig.puddle.position.set(x, b.floorY + 0.005, z);
      rig.puddle.visible = true;
    } else if (isEmerging) {
      // Newly hatched broodlings crawl directly out of the floor puddle and scramble up to the ceiling
      surfY = b.floorY + 0.02; bankZ = 0;
      rig.root.position.set(x, surfY, z);
      rig.orient.rotation.set(0, 0, bankZ);
    } else {
      rig.root.position.set(x, surfY, z);
      rig.orient.rotation.set(0, 0, bankZ);
    }

    const unit = {
      id: nextId++,
      walker,
      solidBody,
      s: state,
      rig,
      unitScale,
      emerging: isEmerging,
      yaw: initYaw,
      surfY,
      bankZ,
      bankX: 0,
      prowlGoal: initGoal,
      fear: unafraid(),
      gait: Math.random() * Math.PI * 2,
      morphT: 0.08 + Math.random() * 0.16,
      dripT: 0.4 + Math.random() * 0.8,
      away: null,                      // the room it was in has gone, and it with it (takeAway below): which room
    };
    units.push(unit);
    return unit;
  }

  /** Split a gorged 60-second puddle into 2–3 new territorial Waste Toners bound to `homeRoom`. */
  function hatchPuddle(parentUnit, distToPlayer) {
    const px = parentUnit.walker.x, pz = parentUnit.walker.z;
    c.play('dissolve', px, pz, 11);
    c.play('sonarrattle', px, pz, 12);
    if (distToPlayer < 12) env.interfere(0.6);

    const homeRoom = c.room(px, pz);
    const activeHunters = units.filter((u) => u.s.mode !== 'spent' && u.s.mode !== 'puddle').length;
    const toSpawn = Math.max(0, Math.min(parentUnit.s.spawnCount, TONER.maxPack - activeHunters));
    const probe = { x: px, z: pz, r: TONER.r, tall: TONER.tall, opens: TONER.opens, crawls: TONER.crawls };

    for (let k = 0; k < toSpawn; k++) {
      const ang = (k / Math.max(1, toSpawn)) * Math.PI * 2 + Math.random() * 0.45;
      let sx = px, sz = pz;
      for (const rad of [0.34, 0.18]) {
        const cx = px + Math.cos(ang) * rad, cz = pz + Math.sin(ang) * rad;
        if (c.walk.stand(probe, cx, cz) && env.world.passable(px, pz, cx, cz)) { sx = cx; sz = cz; break; }
      }
      const sectorGoal = pickSpotInRoom(probe, homeRoom, ang, null);
      spawnUnit(sx, sz, hatchedBrood(homeRoom), 0.9 + Math.random() * 0.07, sectorGoal, ang);
    }
  }

  function ready() {
    geoms = makeSharedGeoms(env.kit, R);
    const probe = { x: 0, z: 0, r: TONER.r, tall: TONER.tall, opens: TONER.opens, crawls: TONER.crawls };
    const startRoom = pickStartRoom();
    const spot = c.walk.spotIn(probe, startRoom.id);
    spawnUnit(spot.x, spot.z, perched(() => R(), c.carried), 1, null, R.range(0, Math.PI * 2));
    placed = true;
  }

  function stepDroplets(unit, dt, canDrop, emitX, emitY, emitZ, floorY, visible) {
    const rig = unit.rig;
    unit.dripT -= dt;
    if (canDrop && visible && unit.dripT <= 0) {
      unit.dripT = 0.55 + Math.random() * 0.85;
      const slot = rig.drips.find((d) => !d.active);
      if (slot) {
        slot.active = true;
        slot.x = emitX + (Math.random() - 0.5) * 0.28;
        slot.z = emitZ + (Math.random() - 0.5) * 0.28;
        slot.y = emitY - 0.14;
        slot.vy = -0.6;
        slot.floorY = floorY;
        slot.hold = 0.45;
        slot.m.scale.set(1, 1.3, 1);
      }
    }
    for (const d of rig.drips) {
      if (!d.active) { d.m.visible = false; continue; }
      if (d.y > d.floorY + 0.02) {
        d.vy -= 7.8 * dt;
        d.y = Math.max(d.floorY + 0.015, d.y + d.vy * dt);
        if (d.y <= d.floorY + 0.02) d.m.scale.set(1.8, 0.25, 1.8);
      } else {
        d.hold -= dt;
        if (d.hold <= 0) { d.active = false; d.m.visible = false; continue; }
      }
      d.m.position.set(d.x, d.y, d.z);
      d.m.visible = visible;
    }
  }

  function animateBody(unit, dt, t, went, chasing) {
    const rig = unit.rig, s = unit.s;
    const moveRate = chasing ? 22 : went > 1e-3 ? 11 : 2.6;
    unit.gait += dt * moveRate + went * 5.5;
    unit.morphT -= dt;
    if (s.glitch || unit.morphT <= 0) {
      unit.morphT = chasing ? 0.045 + Math.random() * 0.08 : 0.14 + Math.random() * 0.35;
      const nextVar = (rig.variant + 1 + Math.floor(Math.random() * 3)) % rig.cores.length;
      const nextSlip = s.glitch || (chasing ? Math.random() < 0.52 : Math.random() < 0.18);
      rig.show(nextVar, nextSlip);
    }
    // Diagonal hound/spider quadrupedal scuttle + jitter
    rig.limbs.forEach((l, idx) => {
      const diag = idx === 0 || idx === 3 ? 0 : Math.PI;
      const swing = Math.sin(unit.gait + diag) * (chasing ? 0.52 : went > 1e-3 ? 0.3 : 0.06);
      const lift = Math.max(0, Math.cos(unit.gait + diag)) * (chasing ? 0.38 : went > 1e-3 ? 0.2 : 0.04);
      l.g.rotation.set(swing * l.sz, swing * 0.22 * l.sx, -lift * l.sx);
    });
    // the wisps of loose toner drifting round the core
    for (const st of rig.streaks) {
      const u = st.userData;
      const p = (t * (chasing ? 3.2 : 1.4) + u.phase) % 1;
      const r = u.rad * (chasing ? 1.15 : 0.85);
      st.position.set(Math.cos(u.angle + t * 0.9) * r, 0.04 + p * 0.24, Math.sin(u.angle + t * 0.9) * r);
      st.scale.set(1, 0.5 + Math.sin(p * Math.PI) * (chasing ? 0.72 : 0.45), 1);
      st.visible = ((Math.floor(t * 19) + Math.round(u.phase * 3)) % 3) !== 0;
    }
    // Micro lateral phase-twitch on slipped frames
    rig.body.position.x = rig.slip ? (Math.random() - 0.5) * (chasing ? 0.16 : 0.05) : 0;
    rig.body.position.z = rig.slip ? (Math.random() - 0.5) * 0.06 : 0;
  }

  function animatePuddle(unit, dt, t, vis) {
    const rig = unit.rig, s = unit.s;
    rig.puddle.visible = vis;
    if (!vis) return;
    if (s.mode === 'spent') {
      rig.puddle.scale.set(0.94, 1, 0.94);
      rig.puddleSlab.scale.set(1, 0.36, 1);
      rig.puddleStainMat.opacity = 0.46;
      rig.shards.forEach((sh, i) => {
        sh.position.set(sh.userData.bx, 0.008, sh.userData.bz);
        sh.scale.set(0.85, 0.25, 0.85);
        sh.visible = i % 2 === 0;
      });
      return;
    }
    const meltK = s.mode === 'dissolving' ? clamp(1 - s.t / TONER.dissolveTime, 0, 1) : 1;
    const gest = s.mode === 'puddle' ? clamp(s.gestation || 0, 0, 1) : 0;
    const spread = (0.25 + 0.75 * meltK) * (1 + gest * 0.14);
    const throb = gest > 0.2 ? Math.sin(t * (3.2 + gest * 11)) * 0.08 * gest : 0;
    rig.puddle.scale.set(spread, 1, spread);
    rig.puddleSlab.scale.set(1 + throb, 1 + gest * 1.45 + throb * 3, 1 - throb * 0.6);
    rig.puddleStainMat.opacity = 0.72 + gest * 0.14;
    rig.shards.forEach((sh, i) => {
      const u = sh.userData, rate = 14 + gest * 16, jitter = Math.floor(t * rate + i * 2.1);
      const twitch = (jitter % 5 === 0) ? ((jitter % 2 ? 1 : -1) * (0.07 + gest * 0.05)) : 0;
      sh.position.set(u.bx + twitch, 0.015, u.bz - twitch * 0.5);
      const tall = (0.5 + Math.abs(Math.sin(t * (5.2 + gest * 6) + u.phase)) * 1.4) * (1 + gest * 0.95);
      sh.scale.set(1 + (jitter % 3) * 0.22, tall, 1);
      sh.visible = (jitter % 6) !== 0;
    });
  }

  function stepUnit(unit, dt, t, w, m) {
    const walker = unit.walker, rig = unit.rig;
    const vis = c.drawn(walker);
    const dx = m.x - walker.x, dz = m.z - walker.z, d = Math.hypot(dx, dz);

    // 1. Floor-only brooding puddle or spent stain (no movement/LOS/fire work needed)
    if (unit.s.mode === 'puddle' || unit.s.mode === 'spent') {
      unit.s = stepToner(unit.s, dt, { d });
      if (unit.s.sonar === 'ping') c.play('sonar', walker.x, walker.z, 8.5);
      if (unit.s.inPuddle) {
        const isSpent = unit.s.mode === 'spent';
        m.slow = Math.min(m.slow, unit.s.slow);
        m.sinkTo = Math.max(m.sinkTo, isSpent ? 0.02 : 0.045);
        env.interfere(isSpent ? 0.08 : 0.24);
        if (!isSpent && m.moving && wadeT <= 0) { wadeT = 0.42; c.play('wade', walker.x, walker.z, 4); }
      }
      if (unit.s.hatched) hatchPuddle(unit, d);
      unit.solidBody.x = 1e6; unit.solidBody.z = 1e6;
      rig.root.visible = false;
      animatePuddle(unit, dt, t, vis);
      stepDroplets(unit, dt, false, walker.x, unit.surfY, walker.z, unit.surfY, false);
      rig.light(c.light(walker.x, walker.z, 0.2));
      return;
    }

    const los = d < 18 && c.los(walker.x, walker.z, m.x, m.z);
    const curRoom = c.room(walker.x, walker.z);
    const sameRoom = curRoom === c.room(m.x, m.z);
    const noiseScale = m.noise ?? env.perk?.noiseScale ?? 1;
    const audible = los || sameRoom || (d <= TONER.listenFar * noiseScale && c.walk.steps(walker, m) <= 2);
    const farFromHome = unit.s.territorial && unit.s.homeRoom !== null && curRoom !== unit.s.homeRoom
      && !(w.rooms[unit.s.homeRoom]?.def.doors || []).some((dr) => dr.to === curRoom);

    // Fire check: backs away from lit paper fires and refuses to cross a burning doorway
    const fire = unit.s.mode !== 'dissolving' ? c.fire(walker.x, walker.z) : null;
    unit.fear = afraid(unit.fear, dt, { x: walker.x, z: walker.z, yaw: unit.yaw }, fire);
    let went = 0, blockedByDoor = false, cannot = false, there = false;

    if (unit.fear.flee) {
      const bx = walker.x, bz = walker.z;
      for (const turn of FIRE_FEAR.turns) {
        const a = unit.fear.away + turn;
        const tx = walker.x + Math.sin(a) * 1.4, tz = walker.z + Math.cos(a) * 1.4;
        const got = c.walk.stride(walker, tx, tz, unit.fear.step);
        if (got > 1e-3) { unit.yaw = a; break; }
      }
      went = Math.hypot(walker.x - bx, walker.z - bz);
      c.walk.forget(walker);
    } else if (unit.s.mode === 'prowl' || unit.s.mode === 'recoil') {
      walker.speed = unit.s.mode === 'recoil' ? TONER.prowlSpeed * 1.55 : TONER.prowlSpeed;
      const awayTarget = unit.s.mode === 'recoil' && !unit.emerging ? m : null;
      const target = unit.s.seekingSound && unit.s.mode !== 'recoil'
        ? { x: m.x, z: m.z }
        : (unit.prowlGoal || (unit.prowlGoal = unit.s.territorial
            ? chooseTerritorialGoal(unit, awayTarget)
            : chooseRoamingGoal(walker, awayTarget)));
      if (target) {
        if (tooNear(target, fire)) {
          cannot = true;
          unit.prowlGoal = null;
        } else {
          const bx = walker.x, bz = walker.z;
          const res = c.walk.go(walker, target, walker.speed * Math.min(dt, 0.08), 0.25);
          went = Math.hypot(walker.x - bx, walker.z - bz);
          there = res.there;
          if (res.there || res.cannot || res.door) unit.prowlGoal = null;
          if (went > 1e-4) unit.yaw += clamp(turnTo(unit.yaw, Math.atan2(walker.x - bx, walker.z - bz)), -dt * 7, dt * 7);
        }
      }
    } else if (unit.s.mode === 'chase') {
      unit.prowlGoal = null;
      unit.emerging = false;
      walker.speed = TONER.chaseSpeed;
      if (tooNear(m, fire) || (fire && d > Math.hypot(fire.x - walker.x, fire.z - walker.z))) {
        cannot = true;
      } else {
        const bx = walker.x, bz = walker.z;
        const stepDist = TONER.chaseSpeed * Math.min(dt, 0.06);
        const res = c.walk.go(walker, m, stepDist, 0.28);
        blockedByDoor = !!res.door;
        cannot = res.cannot;
        there = res.there;

        // Erratic side-to-side weave perpendicular to travel so it NEVER runs in a straight line
        if (!blockedByDoor && !cannot && !walker.thru) {
          const mvx = walker.x - bx, mvz = walker.z - bz, mvLen = Math.hypot(mvx, mvz);
          const fx = mvLen > 1e-4 ? mvx / mvLen : dx / Math.max(d, 0.01);
          const fz = mvLen > 1e-4 ? mvz / mvLen : dz / Math.max(d, 0.01);
          const rx = -fz, rz = fx;
          const taper = clamp((d - 0.45) / 1.15, 0.18, 1);
          const latVel = Math.cos(unit.s.weavePhase) * TONER.weaveFreq * TONER.weaveAmp * (unit.s.weaveFlip || 1) * taper;
          const latDist = Math.min(Math.abs(latVel) * Math.min(dt, 0.06), stepDist * 1.15);
          if (latDist > 1e-3) {
            const sgn = latVel >= 0 ? 1 : -1;
            const got = c.walk.stride(walker, walker.x + rx * sgn * 1.2, walker.z + rz * sgn * 1.2, latDist);
            if (got < latDist * 0.25) unit.s = { ...unit.s, weaveFlip: -(unit.s.weaveFlip || 1) };
          }
        }
        went = Math.hypot(walker.x - bx, walker.z - bz);
        const aimYaw = went > 1e-4 ? Math.atan2(walker.x - bx, walker.z - bz) : Math.atan2(dx, dz);
        unit.yaw += clamp(turnTo(unit.yaw, aimYaw), -dt * 16, dt * 16);
        if (blockedByDoor && Math.random() < dt * 3.2) c.play('rattle', walker.x, walker.z, 7);
        if (went > 0.02 && Math.random() < dt * 9) c.play('tick', walker.x, walker.z, 5);
      }
    }

    unit.s = stepToner(unit.s, dt, {
      d, los, audible, moving: m.moving, speed: m.speed, sink: m.sink, noiseScale,
      blockedByDoor, cannot, there, farFromHome, fleeingFire: unit.fear.flee,
    });
    if (unit.s.gaveUp) unit.prowlGoal = null;
    if (unit.emerging && unit.s.mode !== 'recoil') unit.emerging = false;

    // Audio cues: creepy biosonar click-trains & drop rattle
    if (unit.s.sonar === 'ping') c.play('sonar', walker.x, walker.z, 9.5);
    else if (unit.s.sonar === 'warn') { c.play('sonarrattle', walker.x, walker.z, 11); if (d < 9) env.interfere(0.18 + 0.25 * unit.s.alert); }
    else if (unit.s.sonar === 'drop') { c.play('sonarrattle', walker.x, walker.z, 12); c.play('clack', walker.x, walker.z, 9); env.interfere(0.55); }
    else if (unit.s.sonar === 'chase') c.play('sonar', walker.x, walker.z, 10);

    if (unit.s.glitch && d < 9 && unit.s.mode === 'chase') env.interfere(0.28);

    // Strike handling: 1 damage per bite; recoils after 1st, dissolves into brooding slime after 2nd!
    if (unit.s.bite) {
      c.play('buzz', walker.x, walker.z, 8);
      env.interfere(0.85);
      const hit = c.hurt(TONER.hitDamage);
      // that was the last of them (or there is no health down here, and being got is the end): the tape is ending, and
      // none of them does anything more — it was biting again every frame until the picture went, and saying so
      if (hit.ended || (hit.dead && hit.ended !== false)) { over = true; return; }
      unit.s = strikeToner(unit.s, hit);
      unit.prowlGoal = null;
      if (unit.s.survived && !unit.s.dissolved) c.survived();
      if (unit.s.dissolving) {
        c.play('dissolve', walker.x, walker.z, 10);
        const b = surfaceBounds(w, walker.x, walker.z);
        rig.puddle.position.set(walker.x, b.floorY + 0.005, walker.z);
      }
    }

    if (unit.s.inPuddle) {
      m.slow = Math.min(m.slow, unit.s.slow);
      m.sinkTo = Math.max(m.sinkTo, 0.045);
      env.interfere(0.24);
    }

    // Surface positioning & wall/ceiling banking
    const b = surfaceBounds(w, walker.x, walker.z);
    let wantY = b.floorY, wantBankZ = 0, wantBankX = 0;
    if (unit.s.mode === 'perch' || unit.s.mode === 'prowl' || unit.s.mode === 'recoil') {
      wantY = b.ceilY - 0.03;
      if (unit.emerging && unit.surfY < b.ceilY - 0.35 && b.wall && b.wall.dist < 1.15) {
        const sideSign = (Math.cos(unit.yaw) * b.wall.nx - Math.sin(unit.yaw) * b.wall.nz) >= 0 ? -1 : 1;
        wantBankZ = sideSign * (Math.PI * 0.5);
      } else {
        wantBankZ = Math.PI;
      }
    } else if (unit.s.mode === 'drop') {
      const k = clamp(1 - unit.s.t / TONER.dropTime, 0, 1);
      wantY = b.ceilY - 0.03 + (b.floorY - (b.ceilY - 0.03)) * (k * k);
      if (b.wall && b.wall.dist < 1.35) {
        const sideSign = (Math.cos(unit.yaw) * b.wall.nx - Math.sin(unit.yaw) * b.wall.nz) >= 0 ? -1 : 1;
        wantBankZ = k < 0.75 ? sideSign * (Math.PI * 0.5) : sideSign * (Math.PI * 0.5) * (1 - (k - 0.75) / 0.25);
      } else {
        wantBankZ = Math.PI * (1 - k);
      }
    } else if (unit.s.mode === 'chase' && b.wall && b.wall.dist < 0.72) {
      // Bank up onto corridor walls whenever its erratic weave sweeps close to one!
      const wk = clamp(1 - b.wall.dist / 0.72, 0, 1);
      wantY = b.floorY + wk * 0.78;
      const sideSign = (Math.cos(unit.yaw) * b.wall.nx - Math.sin(unit.yaw) * b.wall.nz) >= 0 ? -1 : 1;
      wantBankZ = sideSign * wk * 1.18;
    }

    const rateK = unit.s.mode === 'drop' || unit.s.mode === 'chase' ? 20 : unit.emerging ? 3.8 : 10;
    const rate = 1 - Math.exp(-rateK * dt);
    unit.surfY += (wantY - unit.surfY) * rate;
    unit.bankZ += turnTo(unit.bankZ, wantBankZ) * rate;
    unit.bankX += (wantBankX - unit.bankX) * rate;
    if (unit.emerging && Math.abs(unit.surfY - (b.ceilY - 0.03)) < 0.08) unit.emerging = false;

    // Solid floor collider only while physically down on the floor chasing/dropping
    if (unit.s.mode === 'chase' || unit.s.mode === 'drop') {
      unit.solidBody.x = walker.x; unit.solidBody.z = walker.z;
    } else {
      unit.solidBody.x = 1e6; unit.solidBody.z = 1e6;
    }

    if (unit.s.mode === 'puddle' || unit.s.mode === 'spent') {
      rig.root.visible = false;
      animatePuddle(unit, dt, t, vis);
      stepDroplets(unit, dt, false, walker.x, unit.surfY, walker.z, b.floorY, false);
      rig.light(c.light(walker.x, walker.z, 0.2));
      return;
    }

    rig.root.visible = vis;
    rig.root.position.set(walker.x, unit.surfY, walker.z);
    rig.root.rotation.set(0, unit.yaw, 0);
    rig.orient.rotation.set(unit.bankX, 0, unit.bankZ);

    if (unit.s.mode === 'dissolving') {
      const k = clamp(1 - unit.s.t / TONER.dissolveTime, 0, 1);
      rig.body.scale.set(1 + k * 0.55, Math.max(0.05, 1 - k * 0.95), 1 + k * 0.55);
      rig.root.position.y = b.floorY;
      rig.orient.rotation.set(0, 0, 0);
      animateBody(unit, dt, t, 0.2, true);
      animatePuddle(unit, dt, t, vis);
    } else {
      rig.body.scale.set(1, 1, 1);
      animatePuddle(unit, dt, t, false);
      animateBody(unit, dt, t, went, unit.s.mode === 'chase' || unit.s.mode === 'drop');
    }

    const onCeiling = (unit.s.mode === 'perch' || unit.s.mode === 'prowl' || unit.s.mode === 'recoil') && !unit.emerging;
    stepDroplets(unit, dt, onCeiling, walker.x, unit.surfY, walker.z, b.floorY, vis);
    rig.light(c.light(walker.x, walker.z, clamp(unit.surfY - b.floorY, 0.25, 2.2)));

    if (!known && vis && !c.hidden(walker.x, walker.z, 0.45) && d < 13) {
      seenT += dt;
      if (seenT > 0.35) { known = true; c.met(); }
    }
  }

  return {
    ready,
    update(dt, t = 0) {
      if (!placed || !units.length || over) return;
      wadeT = Math.max(0, wadeT - dt);
      const w = env.world, m = me();
      const snapshot = units.slice();
      for (const unit of snapshot) if (!unit.away) {if(env.withVisitor)env.withVisitor('toner',unit.walker,()=>stepUnit(unit,dt,t,w,me()));else stepUnit(unit, dt, t, w, m);}          // (one that is not here does nothing here)
    },

    /**
     * A room has gone, and taken what was in it (pursuer.js takeAway: the hallway that is not sure where it leads, which
     * waits for nobody). This is more than one body and they are not all in one place, so it puts its own away: only
     * the ones that were in that room go — whoever was on its ceiling, a puddle on its carpet, with its clock stopped —
     * and the rest carry on. → how many went.
     */
    takeAway(inside, key) {
      let n = 0;
      for (const u of units) {
        if (u.away || !inside(u.walker.x, u.walker.z)) continue;
        u.away = key; n++;
        u.solidBody.x = 1e6; u.solidBody.z = 1e6;
        u.rig.root.visible = false; u.rig.puddle.visible = false;
        for (const d of u.rig.drips) { d.active = false; d.m.visible = false; }
      }
      return n;
    },
    /** That room is back, and they are in it: where they were, as they were. → how many came back. */
    bringBack(key) {
      let n = 0;
      for (const u of units) if (u.away === key) { u.away = null; n++; }
      return n;
    },
    /** Which room some of it is away with (the first, if more than one), or null. */
    awayWith: () => units.find((u) => u.away)?.away ?? null,

    at() {
      const here = units.filter((u) => !u.away);
      const lead = here.find((u) => u.s.mode !== 'spent' && u.s.mode !== 'puddle') || here[0] || units[0];
      if (!lead) return null;
      return {
        x: +lead.walker.x.toFixed(2),
        y: +lead.surfY.toFixed(2),
        z: +lead.walker.z.toFixed(2),
        mode: lead.s.mode,
        hits: lead.s.hits,
        alert: +lead.s.alert.toFixed(2),
        weave: +weaveOffset(lead.s).toFixed(2),
        broodLeft: +lead.s.broodLeft.toFixed(1),
        territorial: lead.s.territorial,
        homeRoom: lead.s.homeRoom,
        count: units.length,
        hunters: units.filter((u) => u.s.mode !== 'spent' && u.s.mode !== 'puddle').length,
        pack: units.map((u) => ({
          id: u.id,
          x: +u.walker.x.toFixed(2),
          y: +u.surfY.toFixed(2),
          z: +u.walker.z.toFixed(2),
          room: c.room(u.walker.x, u.walker.z),
          mode: u.s.mode,
          hits: u.s.hits,
          territorial: u.s.territorial,
          homeRoom: u.s.homeRoom,
          broodLeft: +u.s.broodLeft.toFixed(1),
          gestation: +u.s.gestation.toFixed(2),
          away: u.away || undefined,
        })),
      };
    },

    carry() {
      const first = units[0];
      if (!first || first.s.hits <= 0) return null;
      return { hits: first.s.hits, mode: first.s.mode === 'puddle' ? 'puddle' : undefined };
    },

    snipTargets() {
      if (!placed || !units.length) return [];
      const out = [];
      for (const u of units) {
        if (u.s.mode === 'drop' || u.s.mode === 'chase' || u.s.mode === 'perch' || u.s.mode === 'prowl') {
          out.push({
            id: 'toner',
            x: u.walker.x,
            z: u.walker.z,
            y: u.surfY + 0.18,
            r: 0.34,
            priority: u.s.mode === 'chase' || u.s.mode === 'drop' ? 3 : 2,
            snip: () => {
              const next = snipToner(u.s);
              if (!next.repelled) return false;
              u.s = next;
              u.prowlGoal = null;
              u.emerging = false;
              u.rig.show((u.rig.variant + 1) % u.rig.cores.length, true);
              c.play('sonarrattle', u.walker.x, u.walker.z, 10);
              c.play('buzz', u.walker.x, u.walker.z, 8);
              if (!known) { known = true; c.met(); }
              c.survived();
              return { ok: true, target: 'toner' };
            },
          });
        } else if (u.s.mode === 'puddle') {
          const floorY = env.world?.floorY(u.walker.x, u.walker.z) ?? 0;
          out.push({
            id: 'toner-puddle',
            x: u.walker.x,
            z: u.walker.z,
            y: floorY + 0.12,
            r: 0.65,
            priority: 1,
            snip: () => {
              const next = snipToner(u.s);
              if (!next.ruptured) return false;
              u.s = next;
              c.play('dissolve', u.walker.x, u.walker.z, 9);
              return { ok: true, target: 'toner-puddle' };
            },
          });
        }
      }
      return out;
    },

    /** Dev helper: place on ceiling/floor, trigger an immediate drop/chase, or fast-forward puddle hatching. */
    hurry(spot) {
      if (spot?.hatch) {
        for (const u of units) {
          if (u.s.mode === 'puddle') u.s = { ...u.s, broodLeft: Number.isFinite(spot.broodLeft) ? spot.broodLeft : 0.04 };
        }
      }
      const u = (spot?.index != null ? units[spot.index] : units.find((k) => k.s.mode !== 'spent' && k.s.mode !== 'puddle')) || units[0];
      if (!u) return;
      if (spot && Number.isFinite(spot.x) && Number.isFinite(spot.z)) {
        u.walker.x = spot.x; u.walker.z = spot.z;
        u.prowlGoal = null;
        c.walk.forget(u.walker);
        const b = surfaceBounds(env.world, u.walker.x, u.walker.z);
        u.surfY = (u.s.mode === 'perch' || u.s.mode === 'prowl') ? b.ceilY - 0.03 : b.floorY;
      }
      if (spot?.drop) {
        u.s = { ...u.s, mode: 'drop', t: TONER.dropTime, alert: 1 };
      } else if (spot?.chase) {
        const b = surfaceBounds(env.world, u.walker.x, u.walker.z);
        u.surfY = b.floorY; u.bankZ = 0; u.emerging = false;
        u.s = { ...u.s, mode: 'chase', t: 0, alert: 1, lostT: 0, doorT: 0 };
      }
    },

    dispose() {
      for (const u of units) {
        const idx = env.world?.bodies.indexOf(u.solidBody) ?? -1;
        if (idx >= 0) env.world.bodies.splice(idx, 1);
        u.rig.root.removeFromParent();
        u.rig.puddle.removeFromParent();
        for (const d of u.rig.drips) d.m.removeFromParent();
      }
      units.length = 0;
      geoms = null;
    },
  };
}
