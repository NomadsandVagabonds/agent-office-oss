// The Backrooms — colleagues the building is keeping.
//
// Across a floor's corridors and plain rooms, standard upstairs Office workers
// (cats, dogs, humans, goblins, robots — warped in Backrooms droopy surreal
// fashion) have sunk 2/3 into the wallpaper, the damp carpet, or the acoustic
// ceiling tiles overhead. They cannot leave their spot and never end the tape,
// but their 1.5x elongated jointed arms will snare anyone who runs carelessly
// into reach (unless you steer clear, hop over sprawling floor hands, or crouch
// beneath ceiling hangers).
import { furnitureClear } from './furniture-rules.js';
import { toWorld, wallPoint, wallSpans, floorAt, ceilAt } from './gen.js';
import { clamp, turnTo } from './bits.js';
import {
  ABSORBED, ABSORBED_MOUNTS, rollAbsorbedRoster, absorbedCount,
  createAbsorbedState, stepAbsorbed, tugsTheCamera, HUNTER_NEAR, absorbedKeepOut, meetsAbsorbed, clearOfThings,
} from './absorbed/rule.js';
import { CAST } from './cast.js';
import { makeAbsorbedWorker } from './absorbed/rig.js';

/** Whoever of the cast hunts (cast.js): the ones a visitor must be left free to watch, or not to look at. */
const HUNTERS = CAST.filter((m) => m.disposition === 'hunts').map((m) => m.id);
/** Is one of them near the visitor, with nothing between the two? */
function hunted(env, me) {
  for (const id of HUNTERS) {
    const at = env.pursuer?.of?.(id)?.at?.();
    if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.z)) continue;
    if (Math.hypot(at.x - me.x, at.z - me.z) <= HUNTER_NEAR && env.world.los(me.x, me.z, at.x, at.z)) return true;
  }
  return false;
}

function doorClear(def, lx, lz, minDist) {
  for (const dr of def.doors) {
    const p = wallPoint(def, dr.side, dr.c, 0.35);
    if (Math.hypot(lx - p.x, lz - p.z) < minDist + dr.w * 0.35) return false;
  }
  return true;
}

function usesClear(rt, wx, wz, minDist = 1.35) {
  for (const u of rt.uses) {
    if (Math.hypot(wx - u.wx, wz - u.wz) < minDist) return false;
  }
  return true;
}

function findWallSpot(world, rt, R) {
  const { def } = rt;
  if (def.shape?.kind === 'pinch' || def.shape?.kind === 'ell') return null;
  for (const side of R.shuffle(['back', 'front', 'left', 'right'])) {
    const spans = wallSpans(def, side, 0.82, 2.05).filter(([a, b]) => b - a >= 1.5);
    if (!spans.length) continue;
    for (const [a, b] of R.shuffle(spans)) {
      for (let tries = 0; tries < 5; tries++) {
        const at = R.range(a + 0.68, b - 0.68);
        const p0 = wallPoint(def, side, at, 0.012);
        if (!doorClear(def, p0.x, p0.z, 1.48)) continue;
        const pFoot = wallPoint(def, side, at, 0.45);
        if (Math.abs(floorAt(def, pFoot.x, pFoot.z)) > 0.02) continue;
        const pOut = wallPoint(def, side, at, 1.012);
        const w0 = toWorld(def, p0.x, p0.z);
        const wOut = toWorld(def, pOut.x, pOut.z);
        const nx = wOut.x - w0.x, nz = wOut.z - w0.z;
        if (!usesClear(rt, w0.x, w0.z, 1.35)) continue;
        if (!world.free(w0.x + nx * 0.25, w0.z + nz * 0.25, 0.16)) continue;
        if (!world.free(w0.x + nx * 0.48, w0.z + nz * 0.48, 0.28)) continue;
        if (!world.free(w0.x + nx * 0.84, w0.z + nz * 0.84, 0.30)) continue;
        return {
          mount: 'wall',
          wx: w0.x,
          wz: w0.z,
          wy: def.y + floorAt(def, pFoot.x, pFoot.z),
          yaw: Math.atan2(nx, nz),
          nx,
          nz,
          ceilH: ceilAt(def, pFoot.x, pFoot.z),
        };
      }
    }
  }
  return null;
}

function findFloorSpot(world, rt, R) {
  const { def } = rt;
  if (def.W < 4.0 || def.D < 4.0) return null;
  for (let tries = 0; tries < 28; tries++) {
    const lx = R.range(-def.W / 2 + 1.2, def.W / 2 - 1.2);
    const lz = R.range(-def.D / 2 + 1.2, def.D / 2 - 1.2);
    if (Math.abs(floorAt(def, lx, lz)) > 0.02) continue;
    if (ceilAt(def, lx, lz) < 2.0) continue;
    if (!doorClear(def, lx, lz, 1.72)) continue;
    const w = toWorld(def, lx, lz);
    if (!usesClear(rt, w.x, w.z, 1.45)) continue;
    if (!world.free(w.x, w.z, 0.72)) continue;
    // Face vaguely toward the middle of the room (or nearest doorway)
    const toCenterLocal = Math.atan2(-lx, -lz);
    const c = toWorld(def, lx + Math.sin(toCenterLocal), lz + Math.cos(toCenterLocal));
    return {
      mount: 'floor',
      wx: w.x,
      wz: w.z,
      wy: def.y + floorAt(def, lx, lz),
      yaw: Math.atan2(c.x - w.x, c.z - w.z),
      nx: 0,
      nz: 0,
      ceilH: ceilAt(def, lx, lz),
    };
  }
  return null;
}

function findCeilingSpot(world, rt, R) {
  const { def } = rt;
  if (def.W < 3.2 || def.D < 3.2) return null;
  for (let tries = 0; tries < 28; tries++) {
    const lx = R.range(-def.W / 2 + 1.0, def.W / 2 - 1.0);
    const lz = R.range(-def.D / 2 + 1.0, def.D / 2 - 1.0);
    const fy = floorAt(def, lx, lz);
    if (Math.abs(fy) > 0.02) continue;
    const ch = ceilAt(def, lx, lz) - fy;
    if (ch < ABSORBED.ceilingMinH || ch > ABSORBED.ceilingMaxH) continue;
    if (!doorClear(def, lx, lz, 1.5)) continue;
    // Emerge from an acoustic tile between lit tube panels, not through a tube
    if (def.panels?.some((p) => p.state !== 'dead' && Math.abs(p.x - lx) < 0.62 && Math.abs(p.z - lz) < 0.92)) continue;
    const w = toWorld(def, lx, lz);
    if (!usesClear(rt, w.x, w.z, 1.35)) continue;
    if (!world.free(w.x, w.z, 0.56)) continue;
    return {
      mount: 'ceiling',
      wx: w.x,
      wz: w.z,
      wy: def.y + fy,
      yaw: R.range(-Math.PI, Math.PI),
      nx: 0,
      nz: 0,
      ceilH: ch,
    };
  }
  return null;
}

const SPOT_FINDERS = {
  wall: findWallSpot,
  floor: findFloorSpot,
  ceiling: findCeilingSpot,
};

/**
 * Instantiate and register one 2/3-absorbed coworker in `env.denizens`.
 */
export function spawnAbsorbed(env, { rt, placement, spec }) {
  const { world, kit } = env;
  const look = rt.def.look || {};
  const rig = makeAbsorbedWorker(kit, spec, placement.mount, {
    wall: look.wall,
    carpet: look.carpet,
    ceil: look.ceil,
    ceilH: placement.ceilH,
  });
  rig.group.rotation.y = placement.yaw;

  const mount = placement.mount;
  const reachX = mount === 'wall' ? placement.wx + placement.nx * 0.18 : placement.wx;
  const reachZ = mount === 'wall' ? placement.wz + placement.nz * 0.18 : placement.wz;

  // Floor mounts register a compact central body so you cannot clip inside the head,
  // while the surrounding 1.06 m arm ring stays walkable to snare careless runners.
  let bodyRef = null;
  if (mount === 'floor') {
    bodyRef = { x: placement.wx, z: placement.wz, r: 0.21, get on() { return !denizen.away && !denizen.gone; } };
    world.bodies.push(bodyRef);
  }

  let rule = createAbsorbedState(mount);
  let holdDirX = placement.nx || Math.sin(placement.yaw);
  let holdDirZ = placement.nz || Math.cos(placement.yaw);

  const denizen = env.denizens.add({
    kind: 'absorbed',
    physical: false, // floor mount owns its body above; wall/ceiling forms are not floor obstacles
    mount,
    species: rig.species,
    roomId: rt.id,
    x: placement.wx,
    y: placement.wy,
    z: placement.wz,
    reachX,
    reachZ,
    yaw: placement.yaw,
    group: rig.group,
    rig,
    get state() { return rule; },
    sampleLight(w) {
      const sx = mount === 'wall' ? placement.wx + placement.nx * 0.42 : placement.wx;
      const sz = mount === 'wall' ? placement.wz + placement.nz * 0.42 : placement.wz;
      const sy = mount === 'ceiling' ? Math.max(1.1, placement.ceilH - 0.75) : mount === 'floor' ? 0.55 : 1.05;
      const L = w.lightAt(sx, sz, sy);
      // Keep minimum readable ambient so absorbed silhouettes never turn pitch-black on dim walls
      return [Math.max(0.18, L[0]), Math.max(0.18, L[1]), Math.max(0.18, L[2])];
    },
    light: (rgb) => rig.light(rgb),
    dispose() {
      if (bodyRef) {
        const idx = world.bodies.indexOf(bodyRef);
        if (idx >= 0) world.bodies.splice(idx, 1);
      }
    },
    update(dt, time, me) {
      const dx = me.x - reachX;
      const dz = me.z - reachZ;
      const dist = Math.hypot(dx, dz);

      // Wall mounts only see/grab on their room-facing side (`dot > 0.02`), never through the 20 cm wall!
      const inFrontOfWall = mount !== 'wall' || ((me.x - placement.wx) * placement.nx + (me.z - placement.wz) * placement.nz > 0.02);
      const playerRoom = world.roomAt(me.x, me.z);
      const sameOrLos = inFrontOfWall && (playerRoom?.id === rt.id || (dist < 3.2 && world.los(reachX, reachZ, me.x, me.z)));

      const inputKeys = env.player?.input?.keys;
      const struggling = Math.hypot(me.wishX || 0, me.wishZ || 0) > 0.25 || !!(inputKeys && (inputKeys.has(' ') || inputKeys.has('Shift')));

      // paper the visitor has set light to, near enough and in its sight (inventory-fire.js): it lets go, and keeps its arms down
      const burning = env.inventory?.fire?.threatAt?.(reachX, reachZ, placement.wy);
      const fire = !!burning && Math.hypot(burning.x - reachX, burning.z - reachZ) <= ABSORBED.fireRadius;

      const res = stepAbsorbed(rule, {
        dt,
        fire,
        dist,
        playerSink: me.sink || 0,
        playerDrop: me.drop || 0,
        struggling,
        clearLine: sameOrLos,
        contactClear: furnitureClear(world, reachX, reachZ, me.x, me.z, .06),
      });
      rule = res.state;

      if (res.noticedNow) {
        env.play('creak', reachX, reachZ, 4.5);
      }
      // (for the card at the end: met, once a visit, when one is seen reaching. tally.js keeps it to once across the parts)
      if (meetsAbsorbed(rule.phase, env.sees(placement.wx, placement.wz, { radius: 0.5, far: 12 }), env.metAbsorbed)) { env.metAbsorbed = true; env.run?.met?.('absorbed'); }

      if (res.startedGrab) {
        if (mount === 'wall') {
          holdDirX = placement.nx;
          holdDirZ = placement.nz;
        } else if (dist > 0.05) {
          holdDirX = dx / dist;
          holdDirZ = dz / dist;
        }
        env.play('thunk', reachX, reachZ, 5.5);
        env.play('rustle', reachX, reachZ, 4.5);
      }

      if (res.interfere > 0) env.interfere(res.interfere);

      // For floor & ceiling mounts, slowly twist body yaw toward a nearby visitor
      if (mount !== 'wall' && (rule.phase === 'reaching' || rule.phase === 'grabbing') && dist > 0.08) {
        const wantBodyYaw = Math.atan2(dx, dz);
        const turnRate = rule.phase === 'grabbing' ? 5.5 : 1.9;
        denizen.yaw += clamp(turnTo(denizen.yaw, wantBodyYaw), -dt * turnRate, dt * turnRate);
        rig.group.rotation.y = denizen.yaw;
      }

      if (rule.phase === 'grabbing') {
        me.slow = Math.min(me.slow, res.slow);
        me.sinkTo = Math.max(me.sinkTo, res.sinkTo);
        me.vx *= Math.exp(-15 * dt);
        me.vz *= Math.exp(-15 * dt);

        // Hold the player inside the 1.5x grasping hands (~0.58 m out from chest)
        const holdDist = mount === 'wall' ? 0.56 : mount === 'floor' ? 0.58 : 0.34;
        const holdX = reachX + holdDirX * holdDist;
        const holdZ = reachZ + holdDirZ * holdDist;
        const pullK = (1 - Math.exp(-9 * dt)) * Math.max(0.35, rule.grabBlend);
        const nx = me.x + (holdX - me.x) * pullK;
        const nz = me.z + (holdZ - me.z) * pullK;
        if (furnitureClear(world, me.x, me.z, nx, nz, env.player?.RADIUS ?? 0.22)
          && world.free(nx, nz, env.player?.RADIUS ?? 0.22)) {
          me.x = nx;
          me.z = nz;
        }

        // Subtle physical camera tug toward the clutching coworker's face on initial snare
        // (not while something that hunts is near and in sight: the visitor's look is theirs to keep — absorbed/rule.js)
        if (tugsTheCamera(rule.holdLeft, hunted(env, me))) {
          const faceYaw = Math.atan2(-(reachX - me.x), -(reachZ - me.z));
          me.yaw += turnTo(me.yaw, faceYaw) * (1 - Math.exp(-4.8 * dt));
          const wantPitch = mount === 'ceiling' ? 0.42 : mount === 'floor' ? -0.34 : 0.02;
          me.pitch += (wantPitch - me.pitch) * (1 - Math.exp(-4.2 * dt));
        }
      } else if (res.releasedGrab) {
        // Wrenching free pushes you slightly clear of the recoiling hands
        env.play('rustle', reachX, reachZ, 4.5);
        const pushX = me.x + holdDirX * 0.16;
        const pushZ = me.z + holdDirZ * 0.16;
        if (furnitureClear(world, me.x, me.z, pushX, pushZ, env.player?.RADIUS ?? 0.22)
          && world.free(pushX, pushZ, env.player?.RADIUS ?? 0.22)) {
          me.x = pushX;
          me.z = pushZ;
        }
      }

      const worldYawToMe = dist > 0.05 ? Math.atan2(me.x - placement.wx, me.z - placement.wz) : denizen.yaw;
      const relYaw = sameOrLos ? turnTo(denizen.yaw, worldYawToMe) : 0;
      rig.pose(time, {
        reachBlend: rule.reachBlend,
        grabBlend: rule.grabBlend,
        relYaw,
        phase: rule.phase,
      });
    },
  });

  return denizen;
}

/**
 * Dynamically scatter 2/3-absorbed Office coworkers across walls, carpets, and
 * ceilings of a built Backrooms floor.
 */
export function populateAbsorbed(env, R) {
  const { world, level, cast } = env;
  if (!world) return [];
  const start = level.start || { x: 0, z: 0 };

  // (never in a room that is somebody's: the mascot's plinth room, the porter's — absorbed/rule.js)
  const theirs = absorbedKeepOut(level, env.visit);
  const candidates = world.rooms.filter((rt) => (
    rt.def.kind === 'plain'
    && !theirs.has(rt.id)
    && !rt.def.crawl
    && rt.def.W >= 2.8
    && rt.def.D >= 2.8
    && rt.def.H >= 2.25
  ));

  const targetCount = absorbedCount(candidates.length);
  if (!targetCount) {
    env.absorbed = [];
    return [];
  }

  // What is lying about in this part is already on the floor by now (inventory.js scatters when a part is landed in,
  // before anybody takes their place): none of them is put where a thing could not be picked up without being held.
  // (They move for the things, not the things for them: what the seed leaves, and where, is compared on a kept tape.)
  const things = (env.inventory?.physical?.report?.().items || []).filter((i) => i.active !== false && Number.isFinite(i.wx) && Number.isFinite(i.wz)).map((i) => ({ x: i.wx, z: i.wz }));
  // …nor where one of the cast has just taken its place (they are placed first, and may be anywhere now that the mascot
  // can start a part already walking): a creature will not set foot within half a metre of one of these (cast/walk.js),
  // and one put down on top of it would leave it with nowhere to step.
  const company = Object.values(env.pursuer?.cast?.() || {}).filter((at) => at && Number.isFinite(at.x) && Number.isFinite(at.z)).map((at) => ({ x: at.x, z: at.z }));

  const roster = rollAbsorbedRoster(R, targetCount + 3, cast || []);
  const shuffledRooms = R.shuffle(candidates);
  const placed = [];

  for (const rt of shuffledRooms) {
    if (placed.length >= targetCount) break;
    const spec = roster[placed.length];
    // Try preferred mount first, then fall back to the other two mounts so narrow corridors still get wall/ceiling mounts
    const order = [spec.preferredMount, ...ABSORBED_MOUNTS.filter((m) => m !== spec.preferredMount)];
    let spot = null;
    for (const m of order) {
      const s = SPOT_FINDERS[m](world, rt, R);
      if (!s) continue;
      if (Math.hypot(s.wx - start.x, s.wz - start.z) < 3.4) continue;
      if (placed.some((p) => Math.hypot(s.wx - p.x, s.wz - p.z) < 5.0)) continue;
      if (!clearOfThings(s.wx, s.wz, things) || !clearOfThings(s.wx, s.wz, company)) continue;
      spot = s;
      break;
    }
    if (!spot) continue;
    placed.push(spawnAbsorbed(env, { rt, placement: spot, spec }));
  }

  env.absorbed = placed;
  return placed;
}
