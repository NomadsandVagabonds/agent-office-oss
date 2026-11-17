// The Backrooms — the rules of the corporate aquatics annex (`waterpark`).
// Pure: no three.js, no DOM. Wading, wet-tile hydroplaning, underwater diving
// and camcorder-seal breath, wave surges, lazy-river currents, fiberglass
// flume riding with junction leaning, the ripple-hunting Pool Skimmer, and the
// Adult-Swim Lifeguard.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const AQUA = Object.freeze({
  eye: 1.1,
  wadeSlow: 0.68,
  swimSlow: 0.78,
  diveDepthMin: 0.62,       // minimum water depth to duck your head completely under with C
  deepSwimMin: 1.25,        // depth at which buoyancy treads water unless diving
  airWarn: 9.5,             // seconds submerged before camcorder seal / breath warning pulses
  airLimit: 14.0,           // seconds submerged before taking fair camera drain / 1 heart
  airGrace: 3.5,            // seconds after an air penalty before another can land
  airRecover: 2.8,          // recovery rate multiplier once head is back above water
  slipSpeed: 3.05,          // sprinting threshold on wet coping tile
  slipCooldown: 3.2,
});

/* ---- swimmer / wading / underwater state ---------------------------------- */

export function makeSwimmer() {
  return {
    inWater: false,
    submerged: false,
    depth: 0,
    dive: 0,                // 0..1 smooth dive offset in deep water
    airUsed: 0,             // seconds of breath / waterproof seal spent
    slipTimer: 0,
    slipCooldown: 0,
    wetTimer: 0,            // dampness carried onto surrounding tile after leaving water
    splashAcc: 0,
  };
}

/**
 * Advance one frame of wading, diving, wet-tile slipping, and underwater air.
 * sense: { waterY (null if dry), floorY, speed, crouch, jump, pitch, hurry }
 * -> { state, events: { entered, surfaced, dove, splash, bubble, warn, gasped, slipped }, eyeOffset, slow }
 */
export function stepSwimmer(prev, dt, sense) {
  const s = { ...prev };
  const events = {
    entered: false,
    surfaced: false,
    dove: false,
    splash: false,
    bubble: false,
    warn: false,
    gasped: false,
    slipped: false,
  };

  s.slipCooldown = Math.max(0, s.slipCooldown - dt);
  s.slipTimer = Math.max(0, s.slipTimer - dt);

  const hasWater = Number.isFinite(sense.waterY) && sense.waterY > sense.floorY + 0.04;
  const depth = hasWater ? sense.waterY - sense.floorY : 0;
  s.depth = depth;

  if (hasWater) {
    if (!prev.inWater) {
      events.entered = true;
      if ((sense.speed || 0) > 0.8 || depth > 0.35) events.splash = true;
    }
    s.inWater = true;
    s.wetTimer = 2.4;
  } else {
    s.inWater = false;
    s.wetTimer = Math.max(0, s.wetTimer - dt);
  }

  // Vertical swim / dive offset:
  // - In shallow water (< 0.62 m): wading only; head stays above water.
  // - In chest-deep water (0.62..1.25 m): holding C ducks camera cleanly below waterY.
  // - In deep swimming wells (>= 1.25 m): buoyancy holds eye +0.16 m above waterY by default;
  //   holding C (or pitching steeply down while moving) dives toward floorY + 0.52 m, Space kicks up.
  let eyeY = sense.floorY + AQUA.eye;
  if (hasWater) {
    if (depth >= AQUA.deepSwimMin) {
      const surfaceEye = sense.waterY + 0.16;
      const deepEye = Math.max(sense.floorY + 0.48, sense.waterY - Math.min(1.55, depth - 0.38));
      const wantDive = sense.crouch ? 1 : sense.jump ? 0 : (sense.pitch < -0.42 && sense.speed > 0.4 ? 0.85 : s.dive > 0.15 && !sense.jump ? s.dive : 0);
      const rate = wantDive > s.dive ? 3.2 : (sense.jump ? 4.4 : 2.1);
      s.dive = clamp(s.dive + (wantDive - s.dive) * (1 - Math.exp(-rate * dt)), 0, 1);
      eyeY = surfaceEye + (deepEye - surfaceEye) * s.dive;
    } else if (depth >= AQUA.diveDepthMin) {
      const wantDive = sense.crouch ? 1 : 0;
      s.dive = clamp(s.dive + (wantDive - s.dive) * (1 - Math.exp(-8 * dt)), 0, 1);
      const wadeEye = sense.floorY + AQUA.eye - Math.min(0.24, depth * 0.25);
      const underEye = sense.waterY - 0.26;
      eyeY = wadeEye + (underEye - wadeEye) * s.dive;
    } else {
      s.dive = Math.max(0, s.dive - dt * 5);
      eyeY = sense.floorY + AQUA.eye - Math.min(0.16, depth * 0.28);
    }
  } else {
    s.dive = 0;
  }

  const nowSubmerged = hasWater && eyeY < sense.waterY - 0.03;
  if (nowSubmerged && !prev.submerged) events.dove = true;
  if (!nowSubmerged && prev.submerged) events.surfaced = true;
  s.submerged = nowSubmerged;

  // Splash cadence while moving through water, or bubbles while submerged
  if (hasWater && (sense.speed || 0) > 0.3) {
    s.splashAcc += dt * (0.7 + Math.min(2.2, sense.speed * 0.55));
    if (s.splashAcc >= 1) {
      s.splashAcc -= 1;
      if (nowSubmerged) events.bubble = true;
      else events.splash = true;
    }
  } else if (nowSubmerged) {
    s.splashAcc += dt * 0.38;
    if (s.splashAcc >= 1) { s.splashAcc -= 1; events.bubble = true; }
  } else {
    s.splashAcc = 0;
  }

  // Breath / camcorder waterproof seal timer
  if (nowSubmerged) {
    s.airUsed += dt;
    if (s.airUsed >= AQUA.airWarn) events.warn = true;
    if (s.airUsed >= AQUA.airLimit) {
      events.gasped = true;
      s.airUsed = AQUA.airLimit - AQUA.airGrace;
    }
  } else {
    s.airUsed = Math.max(0, s.airUsed - dt * AQUA.airRecover);
  }

  // Wet-tile hydroplane: sprinting across wet coping right after wading or on slick border
  if (!hasWater && (sense.wetTile || s.wetTimer > 0) && sense.hurry && (sense.speed || 0) >= AQUA.slipSpeed && s.slipCooldown <= 0) {
    s.slipTimer = 0.55;
    s.slipCooldown = AQUA.slipCooldown;
    events.slipped = true;
  }

  const slow = s.slipTimer > 0 ? 1.18 : nowSubmerged ? AQUA.swimSlow : hasWater ? clamp(1 - depth * 0.36, 0.58, AQUA.wadeSlow) : 1;
  const eyeOffset = eyeY - (sense.floorY + AQUA.eye);
  return { state: s, events, eyeY, eyeOffset, slow };
}

/* ---- wave pool surge math ------------------------------------------------- */

export const WAVE = Object.freeze({
  period: 11.5,             // seconds per full wave cycle
  klaxonAt: 2.2,            // warning horn window before crest launches
  launchAt: 3.6,            // when crest leaves the caisson wall (-D/2)
  sweepDur: 4.8,            // seconds for crest to cross pool to beach (+D/2)
  crestHalfW: 1.45,         // half-thickness of pushing wave wall, metres
  crestHeight: 0.72,        // peak surge height above calm water
  pushSpeed: 4.6,           // m/s backward push if caught standing in the wave
});

/**
 * Wave state at room clock `t`. Wave travels from `zStart` (caissons, -D/2) to `zEnd` (beach, +D/2).
 */
export function waveState(t, zStart, zEnd) {
  const phase = ((t % WAVE.period) + WAVE.period) % WAVE.period;
  const klaxon = phase >= WAVE.klaxonAt && phase < WAVE.launchAt;
  const active = phase >= WAVE.launchAt && phase < WAVE.launchAt + WAVE.sweepDur;
  const u = active ? (phase - WAVE.launchAt) / WAVE.sweepDur : -1;
  const crestZ = active ? zStart + (zEnd - zStart) * u : zStart;
  // Wave tapers slightly as it breaks onto the shallow beach
  const amp = active ? WAVE.crestHeight * Math.sin(Math.min(1, u * 4) * (Math.PI / 2)) * (1 - 0.35 * u * u) : 0;
  return { phase, klaxon, active, u, crestZ, amp };
}

/**
 * Push velocity along +z applied to a swimmer at (x, z) by the rolling wave.
 * Diving underwater (`submerged`) or standing behind a tiled breakwater (`sheltered`) avoids the push!
 */
export function wavePush(wave, z, { inWater, submerged, sheltered }) {
  if (!wave.active || !inWater || submerged || sheltered) return 0;
  const dz = Math.abs(z - wave.crestZ);
  if (dz > WAVE.crestHalfW) return 0;
  const k = 1 - dz / WAVE.crestHalfW;
  return WAVE.pushSpeed * (0.45 + 0.55 * k);
}

/* ---- lazy river annular current & lifeguard rule -------------------------- */

/**
 * Counter-clockwise tangential drift vector inside an annular canal of radii [rInner, rOuter].
 */
export function riverCurrent(x, z, rInner, rOuter, speed = 1.55, dir = 1) {
  const r = Math.hypot(x, z);
  if (r < rInner || r > rOuter || r < 1e-4) return { vx: 0, vz: 0, inCanal: false };
  const mid = (rInner + rOuter) * 0.5;
  const half = (rOuter - rInner) * 0.5;
  const edgeFade = clamp(1 - Math.abs(r - mid) / (half + 0.15) * 0.35, 0.5, 1);
  // Tangent (-z/r, x/r) * dir, plus subtle centering pull away from canal walls
  const tx = (-z / r) * dir, tz = (x / r) * dir;
  const pull = ((mid - r) / Math.max(0.2, half)) * 0.22;
  const cx = (x / r) * pull, cz = (z / r) * pull;
  return {
    vx: (tx + cx) * speed * edgeFade,
    vz: (tz + cz) * speed * edgeFade,
    inCanal: true,
  };
}

export const GUARD = Object.freeze({
  calmDur: 6.8,
  whistleDur: 2.1,          // warning pea-whistle before scanning
  scanDur: 3.8,             // ADULT SWIM active scan window
  citeTime: 0.72,           // seconds exposed above water in scan before buoy strike
  cooldown: 2.6,
});

export function makeLifeguard() {
  return { mode: 'calm', timer: GUARD.calmDur * 0.65, exposure: 0, cooldown: 0 };
}

/**
 * Advance one frame of the Lifeguard's Adult-Swim enforcement rule.
 * sense: { inside, inCanal, submerged }
 * -> { state, whistle: boolean, cited: boolean }
 */
export function stepLifeguard(prev, dt, sense) {
  const s = { ...prev };
  let whistle = false, cited = false;
  s.cooldown = Math.max(0, s.cooldown - dt);

  if (!sense.inside) {
    s.mode = 'calm';
    s.timer = Math.max(s.timer, 2.5);
    s.exposure = 0;
    return { state: s, whistle, cited };
  }

  s.timer -= dt;
  if (s.mode === 'calm') {
    s.exposure = Math.max(0, s.exposure - dt * 2);
    if (s.timer <= 0) {
      s.mode = 'whistle';
      s.timer = GUARD.whistleDur;
      whistle = true;
    }
  } else if (s.mode === 'whistle') {
    if (s.timer <= 0) {
      s.mode = 'scan';
      s.timer = GUARD.scanDur;
    }
  } else if (s.mode === 'scan') {
    if (sense.inCanal && !sense.submerged && s.cooldown <= 0) {
      s.exposure += dt;
      if (s.exposure >= GUARD.citeTime) {
        cited = true;
        s.exposure = 0;
        s.cooldown = GUARD.cooldown;
        s.mode = 'calm';
        s.timer = GUARD.calmDur;
        return { state: s, whistle, cited };
      }
    } else {
      // Ducking underwater or stepping onto dry island clears exposure fast
      s.exposure = Math.max(0, s.exposure - dt * 2.5);
    }
    if (s.timer <= 0) {
      s.mode = 'calm';
      s.timer = GUARD.calmDur;
      s.exposure = 0;
    }
  }
  return { state: s, whistle, cited };
}

/* ---- fiberglass water slide spline & junction leaning --------------------- */

/**
 * Evaluate a piecewise-smooth Catmull-Rom 3D polyline `pts` (array of [x, y, z]) at parameter `u` in [0, 1].
 * -> { x, y, z, tx, ty, tz, yaw, pitch, bank }
 */
export function evalFlume(pts, u) {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: -1, yaw: 0, pitch: 0, bank: 0 };
  if (n === 1) return { x: pts[0][0], y: pts[0][1], z: pts[0][2], tx: 0, ty: 0, tz: -1, yaw: 0, pitch: 0, bank: 0 };
  const t = clamp(u, 0, 1) * (n - 1);
  const i = Math.min(n - 2, Math.floor(t));
  const f = t - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n - 1, i + 2)];

  const cr = (a, b, c, d, s) => {
    const s2 = s * s, s3 = s2 * s;
    return 0.5 * ((2 * b) + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s2 + (-a + 3 * b - 3 * c + d) * s3);
  };
  const dcr = (a, b, c, d, s) => {
    const s2 = s * s;
    return 0.5 * ((-a + c) + (4 * a - 10 * b + 8 * c - 2 * d) * s + (-3 * a + 9 * b - 9 * c + 3 * d) * s2);
  };

  const x = cr(p0[0], p1[0], p2[0], p3[0], f);
  const y = cr(p0[1], p1[1], p2[1], p3[1], f);
  const z = cr(p0[2], p1[2], p2[2], p3[2], f);
  let tx = dcr(p0[0], p1[0], p2[0], p3[0], f);
  let ty = dcr(p0[1], p1[1], p2[1], p3[1], f);
  let tz = dcr(p0[2], p1[2], p2[2], p3[2], f);
  const len = Math.hypot(tx, ty, tz) || 1;
  tx /= len; ty /= len; tz /= len;

  // Approximate horizontal curvature for natural flume banking
  const fAhead = Math.min(1, f + 0.08);
  let tx2 = dcr(p0[0], p1[0], p2[0], p3[0], fAhead);
  let tz2 = dcr(p0[2], p1[2], p2[2], p3[2], fAhead);
  const l2 = Math.hypot(tx2, tz2) || 1;
  tx2 /= l2; tz2 /= l2;
  const l1 = Math.hypot(tx, tz) || 1;
  const cross = (tx / l1) * tz2 - (tz / l1) * tx2;
  const bank = clamp(cross * 2.8, -0.48, 0.48);

  const yaw = Math.atan2(-tx, -tz);
  const pitch = clamp(Math.asin(clamp(ty, -0.95, 0.95)) * 0.65, -0.85, 0.55);
  return { x, y, z, tx, ty, tz, yaw, pitch, bank };
}

/**
 * Sample parallel-transport (Bishop) orthonormal frames along 3D polyline `pts`.
 * Eliminates gimbal twist / 180-degree polygon flips when a water slide pitches steeply
 * or punches vertically into the ceiling plenum!
 * -> Array<{ u, x, y, z, tx, ty, tz, ux, uy, uz, vx, vy, vz, bank }>
 */
export function sampleFlumeFrames(pts, steps = 24) {
  const nSteps = Math.max(2, steps | 0);
  const out = [];
  const p0 = evalFlume(pts, 0);
  let tx0 = p0.tx, ty0 = p0.ty, tz0 = p0.tz;

  // Initial right-handed frame (T, U, V) with V pointing skyward when horizontal
  let ux, uy, uz;
  const hLen = Math.hypot(tx0, tz0);
  if (hLen > 0.18) {
    ux = tz0 / hLen;
    uy = 0;
    uz = -tx0 / hLen;
  } else {
    // Near-vertical start: project world +X perpendicular to T0
    ux = 1 - tx0 * tx0;
    uy = -tx0 * ty0;
    uz = -tx0 * tz0;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
  }
  let vx = ty0 * uz - tz0 * uy;
  let vy = tz0 * ux - tx0 * uz;
  let vz = tx0 * uy - ty0 * ux;

  out.push({
    u: 0, x: p0.x, y: p0.y, z: p0.z,
    tx: tx0, ty: ty0, tz: tz0,
    ux, uy, uz, vx, vy, vz,
    bank: p0.bank,
  });

  for (let i = 1; i <= nSteps; i++) {
    const u = i / nSteps;
    const p = evalFlume(pts, u);
    const tx = p.tx, ty = p.ty, tz = p.tz;

    // Minimal rotation transporting T_{i-1} -> T_i (Rodrigues' formula)
    const ax = ty0 * tz - tz0 * ty;
    const ay = tz0 * tx - tx0 * tz;
    const az = tx0 * ty - ty0 * tx;
    const sinA = Math.hypot(ax, ay, az);
    const cosA = clamp(tx0 * tx + ty0 * ty + tz0 * tz, -1, 1);

    if (sinA > 1e-5) {
      const kx = ax / sinA, ky = ay / sinA, kz = az / sinA;
      const kDotU = kx * ux + ky * uy + kz * uz;
      const cx = ky * uz - kz * uy;
      const cy = kz * ux - kx * uz;
      const cz = kx * uy - ky * ux;
      ux = ux * cosA + cx * sinA + kx * kDotU * (1 - cosA);
      uy = uy * cosA + cy * sinA + ky * kDotU * (1 - cosA);
      uz = uz * cosA + cz * sinA + kz * kDotU * (1 - cosA);
    } else if (cosA < -0.999) {
      ux = -ux; uy = -uy; uz = -uz;
    }

    // Re-orthogonalize U against T and recompute V = T x U
    const tDotU = tx * ux + ty * uy + tz * uz;
    ux -= tx * tDotU; uy -= ty * tDotU; uz -= tz * tDotU;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
    vx = ty * uz - tz * uy;
    vy = tz * ux - tx * uz;
    vz = tx * uy - ty * ux;

    out.push({
      u, x: p.x, y: p.y, z: p.z,
      tx, ty, tz,
      ux, uy, uz, vx, vy, vz,
      bank: p.bank,
    });
    tx0 = tx; ty0 = ty; tz0 = tz;
  }
  return out;
}

/**
 * Minimum 3D centreline distance between two flume polylines `ptsA` and `ptsB`.
 * Used to verify zero tube-to-tube clipping (`dist >= rA + rB + clearance`).
 */
export function minSplineDistance(ptsA, ptsB, samples = 48, rangeA = [0, 1], rangeB = [0, 1]) {
  let best = Infinity;
  const n = Math.max(8, samples | 0);
  const aPts = [];
  const bPts = [];
  for (let i = 0; i <= n; i++) {
    const ua = rangeA[0] + (rangeA[1] - rangeA[0]) * (i / n);
    const ub = rangeB[0] + (rangeB[1] - rangeB[0]) * (i / n);
    aPts.push(evalFlume(ptsA, ua));
    bPts.push(evalFlume(ptsB, ub));
  }
  for (let i = 0; i <= n; i++) {
    const a = aPts[i];
    for (let j = 0; j <= n; j++) {
      const b = bPts[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Pure 3D spline layout for `slide-maze`, kept in `waterpark.rule.js` so unit tests
 * can assert zero tube-to-tube clipping (`minSplineDistance >= rA + rB + clearance`).
 */
export function slideMazeSplines(W = 17, D = 17, H = 5.7) {
  const hx = W / 2;
  void D;
  return {
    plunge: {
      radius: 0.58,
      color: '#19d3c5',
      enclosed: false,
      pts: [
        [4.65, 1.30, 2.15],
        [5.05, 1.02, 0.65],
        [4.85, 0.48, -1.05],
        [3.95, -0.06, -2.35],
        [2.75, -0.34, -3.05],
      ],
    },
    bailout: {
      radius: 0.50,
      color: '#16e0cf',
      enclosed: false,
      pts: [
        [-3.00, 0.92, -3.15],
        [-2.65, 0.35, -3.65],
        [-1.95, -0.32, -4.05],
      ],
    },
    coralOverhead: {
      radius: 0.56,
      color: '#f04c42',
      enclosed: true,
      pts: [
        [-2.15, H + 0.45, 1.05],
        [-1.05, 3.55, 0.45],
        [0.35, 3.25, -0.35],
        [1.95, 3.72, -1.45],
        [3.05, H + 0.45, -2.65],
      ],
    },
    amberOverhead: {
      radius: 0.54,
      color: '#f5a623',
      enclosed: true,
      pts: [
        [hx - 0.08, 3.72, 2.65],
        [3.15, 3.48, 3.35],
        [0.15, 3.78, 3.25],
        [-2.85, H + 0.45, 2.55],
      ],
    },
    abyssDrain: {
      radius: 0.54,
      color: '#844dff',
      enclosed: false,
      pts: [
        [0.88, -0.64, -2.22],
        [0.12, -0.98, -2.12],
        [-0.38, -1.36, -2.65],
        [0.22, -2.25, -2.88],
      ],
    },
  };
}

/**
 * Total approximate chord length of a flume polyline `pts`.
 */
export function flumeLength(pts) {
  let sum = 0;
  for (let i = 1; i < pts.length; i++) {
    sum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  }
  return Math.max(0.5, sum);
}

/**
 * Advance a rider sliding along a flume segment (possibly branching at `fork` when `u >= 1`).
 * ride: { segId, u, speed, lean }
 * segs: Record<segId, { pts, length, fork?: { left: segId, right: segId, default: segId } }>
 * steer: -1 (lean left / A) .. +1 (lean right / D)
 */
export function stepSlideRide(ride, dt, segs, steer = 0) {
  const seg = segs[ride.segId];
  if (!seg) return { ride: null, pose: null, done: true, switched: false };

  const lean = clamp(ride.lean * Math.exp(-3.5 * dt) + steer * dt * 2.8, -1, 1);
  const pose0 = evalFlume(seg.pts, ride.u);
  // Gravity boost on downward pitch
  const accel = 4.2 + Math.max(-1.5, -pose0.ty * 7.5);
  const speed = clamp(ride.speed + (accel - ride.speed * 0.48) * dt, 3.6, 8.8);
  let nextU = ride.u + (speed * dt) / seg.length;
  let segId = ride.segId;
  let switched = false;

  if (nextU >= 1) {
    if (seg.fork) {
      const pick = lean < -0.18 ? seg.fork.left : lean > 0.18 ? seg.fork.right : (seg.fork.default || seg.fork.left);
      const nextSeg = segs[pick];
      if (nextSeg) {
        const carryMeters = (nextU - 1) * seg.length;
        segId = pick;
        nextU = clamp(carryMeters / nextSeg.length, 0, 0.99);
        switched = true;
      } else {
        const endPose = evalFlume(seg.pts, 1);
        return { ride: null, pose: endPose, done: true, switched: false, exitSeg: ride.segId };
      }
    } else {
      const endPose = evalFlume(seg.pts, 1);
      return { ride: null, pose: endPose, done: true, switched: false, exitSeg: ride.segId };
    }
  }

  const activeSeg = segs[segId];
  const pose = evalFlume(activeSeg.pts, nextU);
  pose.bank = clamp(pose.bank + lean * 0.22, -0.58, 0.58);
  return {
    ride: { segId, u: nextU, speed, lean: switched ? 0 : lean },
    pose,
    done: false,
    switched,
  };
}

/* ---- plain-room entity: The Pool Skimmer ---------------------------------- */

export const SKIMMER = Object.freeze({
  glideSpeed: 0.95,
  surgeSpeed: 3.15,
  rippleSpeedMin: 0.32,     // player water movement speed that creates ripples it hears
  forgetTime: 0.9,          // seconds of stillness / dry feet before it forgets target
  biteDist: 0.62,
  recoilDur: 2.4,
});

export function makeSkimmer(x = 0, z = 0) {
  return { mode: 'glide', x, z, vx: 0, vz: 0, yaw: 0, tx: x, tz: z, memory: 0, recoil: 0, patrolAngle: 0 };
}

/**
 * Pure AI rule for the Pool Skimmer.
 * Only senses ripples made by moving in the same pool basin! Freeze still in the water or step onto dry coping/carpet and it drifts past.
 * sense: { inBasin, speed, px, pz, bounds: { x0, z0, x1, z1 } }
 */
export function stepSkimmer(prev, dt, sense) {
  const s = { ...prev };
  const b = sense.bounds;
  let bit = false, alerted = false;

  if (s.recoil > 0) {
    s.recoil = Math.max(0, s.recoil - dt);
    if (s.recoil <= 0) s.mode = 'glide';
  }

  const makesRipples = !!(sense.inBasin && (sense.speed || 0) >= SKIMMER.rippleSpeedMin);
  if (makesRipples && s.recoil <= 0) {
    if (s.mode === 'glide') alerted = true;
    s.mode = 'surge';
    s.tx = clamp(sense.px, b.x0 + 0.35, b.x1 - 0.35);
    s.tz = clamp(sense.pz, b.z0 + 0.35, b.z1 - 0.35);
    s.memory = SKIMMER.forgetTime;
  } else if (s.mode === 'surge') {
    s.memory = Math.max(0, s.memory - dt);
    if (s.memory <= 0) s.mode = 'glide';
  }

  let goalX = s.tx, goalZ = s.tz, topSpeed = SKIMMER.glideSpeed;
  if (s.mode === 'recoil') {
    // Drift away from where it bit
    goalX = (b.x0 + b.x1) * 0.5 - (s.tx - (b.x0 + b.x1) * 0.5) * 0.5;
    goalZ = (b.z0 + b.z1) * 0.5 - (s.tz - (b.z0 + b.z1) * 0.5) * 0.5;
    topSpeed = SKIMMER.glideSpeed * 1.2;
  } else if (s.mode === 'surge') {
    topSpeed = SKIMMER.surgeSpeed;
  } else {
    s.patrolAngle += dt * 0.62;
    const cx = (b.x0 + b.x1) * 0.5, cz = (b.z0 + b.z1) * 0.5;
    const rx = Math.max(0.3, (b.x1 - b.x0) * 0.36), rz = Math.max(0.3, (b.z1 - b.z0) * 0.36);
    goalX = cx + Math.cos(s.patrolAngle) * rx;
    goalZ = cz + Math.sin(s.patrolAngle * 1.3) * rz;
  }

  const dx = goalX - s.x, dz = goalZ - s.z, dist = Math.hypot(dx, dz);
  if (dist > 0.03) {
    const step = Math.min(dist, topSpeed * dt);
    s.x = clamp(s.x + (dx / dist) * step, b.x0 + 0.32, b.x1 - 0.32);
    s.z = clamp(s.z + (dz / dist) * step, b.z0 + 0.32, b.z1 - 0.32);
    s.yaw = Math.atan2(dx, dz);
  }

  if (s.mode === 'surge' && sense.inBasin && Math.hypot(sense.px - s.x, sense.pz - s.z) <= SKIMMER.biteDist) {
    bit = true;
    s.mode = 'recoil';
    s.recoil = SKIMMER.recoilDur;
    s.memory = 0;
  }

  return { state: s, bit, alerted };
}

/* ---- colored fiberglass crawl-tube entity: The Tube Waste Toner ----------- */

export const TUBE_TONER = Object.freeze({
  sonarEvery: 2.65,
  hearRange: 5.8,
  alertThreshold: 0.48,
  dropDur: 0.36,
  chaseSpeed: 2.35,
  chaseHold: 4.4,
  catchDist: 0.56,
  recoilDur: 2.4,
  hurt: 1,
});

export function makeTubeToner(index = 0) {
  return {
    phase: 'perched',
    alertSec: 0,
    dropSec: 0,
    chaseSec: 0,
    recoilSec: 0,
    sonarTimer: 0.8 + (index % 3) * 0.75,
    weavePhase: index * 1.9,
  };
}

export function snipTubeToner(prev) {
  return {
    ...prev,
    phase: 'recoil',
    alertSec: 0,
    dropSec: 0,
    chaseSec: 0,
    recoilSec: TUBE_TONER.recoilDur,
  };
}

export function releaseTubeToner(prev) {
  return {
    ...prev,
    phase: 'recoil',
    alertSec: 0,
    dropSec: 0,
    chaseSec: 0,
    recoilSec: TUBE_TONER.recoilDur * 1.15,
  };
}

/**
 * Pure AI state machine for a Waste Toner clinging upside-down inside a colored fiberglass crawl tube.
 * Crawling gently (`!audible`) or freezing still lets you slip past its echolocation clicks;
 * scrambling fast inside the resonant plastic tube wakes it onto the tube floor!
 * sense: { dt, dist, inTubes, audible }
 */
export function stepTubeToner(prev, sense) {
  const dt = sense.dt;
  const s = { ...prev, weavePhase: prev.weavePhase + dt * 7.5 };
  let sonar = false, rattle = false, droppedNow = false, caught = false;
  let slabK = 1, speed = 0;

  s.sonarTimer -= dt;
  if (s.sonarTimer <= 0 && (s.phase === 'perched' || s.phase === 'alert')) {
    s.sonarTimer = TUBE_TONER.sonarEvery;
    sonar = true;
  }

  if (s.phase === 'recoil') {
    s.recoilSec = Math.max(0, s.recoilSec - dt);
    slabK = clamp(1 - s.recoilSec / TUBE_TONER.recoilDur, 0, 1);
    if (s.recoilSec <= 0) {
      s.phase = 'perched';
      slabK = 1;
    }
    return { state: s, slabK, speed: 0, sonar, rattle, droppedNow, caught };
  }

  const heard = !!(sense.inTubes && sense.audible && sense.dist <= TUBE_TONER.hearRange);

  if (s.phase === 'perched' || s.phase === 'alert') {
    slabK = 1;
    if (heard) {
      const k = 1 + clamp((TUBE_TONER.hearRange - sense.dist) / TUBE_TONER.hearRange, 0, 1) * 0.85;
      s.alertSec += dt * k;
      if (s.phase === 'perched') {
        s.phase = 'alert';
        rattle = true;
      }
      if (s.alertSec >= TUBE_TONER.alertThreshold) {
        s.phase = 'dropping';
        s.dropSec = TUBE_TONER.dropDur;
        rattle = true;
      }
    } else {
      s.alertSec = Math.max(0, s.alertSec - dt * 1.15);
      if (s.alertSec <= 0) s.phase = 'perched';
    }
  } else if (s.phase === 'dropping') {
    s.dropSec = Math.max(0, s.dropSec - dt);
    slabK = clamp(s.dropSec / TUBE_TONER.dropDur, 0, 1);
    if (s.dropSec <= 0) {
      s.phase = 'chasing';
      s.chaseSec = TUBE_TONER.chaseHold;
      slabK = 0;
      droppedNow = true;
    }
  } else if (s.phase === 'chasing') {
    slabK = 0;
    speed = TUBE_TONER.chaseSpeed;
    if (sense.inTubes && (sense.audible || sense.dist < 2.6)) {
      s.chaseSec = Math.min(TUBE_TONER.chaseHold, s.chaseSec + dt * 0.65);
    } else {
      s.chaseSec -= dt * (sense.inTubes ? 1.0 : 2.2);
    }
    if (sense.inTubes && sense.dist <= TUBE_TONER.catchDist) {
      caught = true;
    } else if (s.chaseSec <= 0) {
      s.phase = 'recoil';
      s.recoilSec = TUBE_TONER.recoilDur * 0.75;
    }
  }

  return { state: s, slabK, speed, sonar, rattle, droppedNow, caught };
}

/* ---- centerpiece entity: The Guard-Stand (fused Lifeguard + Chair) --------- */

export const GUARD_STAND = Object.freeze({
  chairDur: 6.4,            // seconds disguised as an inert lifeguard stand before whistle cycle
  whistleDur: 1.75,         // shrill warning whistle + legs cracking open (`unfold: 0 -> 1`)
  patrolDur: 4.8,           // active scan / spider-stilt patrol window
  chaseHold: 3.4,           // seconds it sustains a lock-on surge after losing sight/exposure
  returnSpeed: 1.55,        // stilt-walk speed returning to its island post
  stalkSpeed: 1.35,         // slow spider-prowl while scanning
  surgeSpeed: 2.68,         // fast spider-stilt pursuit across tile & chest-deep water
  sprintTrigger: 2.50,      // running on wet tile (`NO RUNNING`) wakes it immediately!
  strikeDist: 1.12,         // reach of its fused red rescue-torpedo arm
  recoilDur: 2.1,           // stunned / recoiling after Safety Scissors snip or landing a blow
  hurt: 1,
});

export function makeGuardStand(homeX = 0, homeZ = -0.95) {
  return {
    mode: 'chair',          // 'chair' | 'whistle' | 'scan' | 'surge' | 'return' | 'recoil'
    timer: GUARD_STAND.chairDur * 0.72,
    unfold: 0,              // 0 = locked A-frame chair, 1 = splayed 4-legged spider stance
    stride: 0,              // accumulated gait phase (radians)
    recoilSec: 0,
    cooldown: 0,
    lastSeenX: homeX,
    lastSeenZ: homeZ,
    homeX,
    homeZ,
  };
}

export function snipGuardStand(prev) {
  return {
    ...prev,
    mode: 'recoil',
    recoilSec: GUARD_STAND.recoilDur,
    cooldown: 1.8,
  };
}

export function releaseGuardStand(prev) {
  return {
    ...prev,
    mode: 'return',
    timer: 2.6,
    cooldown: 2.8,
  };
}

/**
 * Pure per-frame behavior for The Guard-Stand.
 * sense: {
 *   dt, inside, inCanal, submerged, moving, speed, clearLine,
 *   dist, distHome, playerX, playerZ
 * }
 * Violation ("exposed"):
 *   - Inside the room, NOT submerged (`!submerged`), has line of sight (`clearLine`), AND:
 *     (a) in the water canal with head above water (`inCanal`), OR
 *     (b) moving on the wet deck (`moving`), OR
 *     (c) sprinting (`speed >= sprintTrigger`, which even wakes it early out of `'chair'`!).
 */
export function stepGuardStand(prev, sense) {
  const dt = Math.max(0, sense.dt || 0);
  const s = { ...prev };
  s.cooldown = Math.max(0, s.cooldown - dt);

  let whistle = false;
  let unfoldedNow = false;
  let struck = false;
  let footstep = false;
  let speed = 0;
  let goalX = s.homeX, goalZ = s.homeZ;

  if (!sense.inside) {
    if (s.mode !== 'chair' && sense.distHome > 0.25) {
      s.mode = 'return';
      speed = GUARD_STAND.returnSpeed;
    } else {
      s.mode = 'chair';
      s.timer = Math.max(s.timer, 2.8);
    }
    const wantUnfold = s.mode === 'chair' ? 0 : 1;
    s.unfold += (wantUnfold - s.unfold) * (1 - Math.exp(-6 * dt));
    return { state: s, speed, goalX, goalZ, whistle, unfoldedNow, struck, footstep };
  }

  const runningViolation = sense.clearLine && !sense.submerged && (sense.speed || 0) >= GUARD_STAND.sprintTrigger;
  const scanViolation = sense.clearLine && !sense.submerged && (sense.inCanal || sense.moving);

  if (s.mode === 'recoil') {
    s.recoilSec = Math.max(0, s.recoilSec - dt);
    s.unfold += (1 - s.unfold) * (1 - Math.exp(-8 * dt));
    if (s.recoilSec <= 0) {
      s.mode = 'return';
      s.timer = 2.4;
    }
  } else if (s.mode === 'chair') {
    s.timer -= dt;
    s.unfold += (0 - s.unfold) * (1 - Math.exp(-7 * dt));
    if (runningViolation && s.cooldown <= 0) {
      // Sprinting on the pool deck (`NO RUNNING!`) snaps it awake immediately!
      s.mode = 'whistle';
      s.timer = GUARD_STAND.whistleDur * 0.65;
      s.lastSeenX = sense.playerX;
      s.lastSeenZ = sense.playerZ;
      whistle = true;
    } else if (s.timer <= 0) {
      s.mode = 'whistle';
      s.timer = GUARD_STAND.whistleDur;
      whistle = true;
    }
  } else if (s.mode === 'whistle') {
    const prevUnfold = s.unfold;
    s.unfold += (1 - s.unfold) * (1 - Math.exp(-5.2 * dt));
    if (prevUnfold < 0.35 && s.unfold >= 0.35) unfoldedNow = true;
    s.timer -= dt;
    if (scanViolation) {
      s.lastSeenX = sense.playerX;
      s.lastSeenZ = sense.playerZ;
    }
    if (s.timer <= 0) {
      s.mode = scanViolation && s.cooldown <= 0 ? 'surge' : 'scan';
      s.timer = scanViolation ? GUARD_STAND.chaseHold : GUARD_STAND.patrolDur;
      speed = s.mode === 'surge' ? GUARD_STAND.surgeSpeed : GUARD_STAND.stalkSpeed;
      if (s.mode === 'surge') {
        whistle = true;
        goalX = s.lastSeenX;
        goalZ = s.lastSeenZ;
      }
    }
  } else if (s.mode === 'scan') {
    s.unfold += (1 - s.unfold) * (1 - Math.exp(-7 * dt));
    s.timer -= dt;
    speed = GUARD_STAND.stalkSpeed;
    // Orbit/prowl slightly out toward where the swimmer was or the nearest canal rim
    goalX = sense.playerX * 0.45 + s.homeX * 0.55;
    goalZ = sense.playerZ * 0.45 + s.homeZ * 0.55;
    if (scanViolation && s.cooldown <= 0) {
      s.mode = 'surge';
      s.timer = GUARD_STAND.chaseHold;
      s.lastSeenX = sense.playerX;
      s.lastSeenZ = sense.playerZ;
      whistle = true;
    } else if (s.timer <= 0) {
      s.mode = 'return';
    }
  } else if (s.mode === 'surge') {
    s.unfold = 1;
    speed = GUARD_STAND.surgeSpeed;
    if (scanViolation) {
      s.lastSeenX = sense.playerX;
      s.lastSeenZ = sense.playerZ;
      s.timer = Math.min(GUARD_STAND.chaseHold, s.timer + dt * 0.75);
      goalX = sense.playerX;
      goalZ = sense.playerZ;
    } else {
      // Submerging (`C`) or freezing out of sight breaks its lock-on!
      s.timer -= dt * (sense.submerged ? 1.85 : 1.15);
      goalX = s.lastSeenX;
      goalZ = s.lastSeenZ;
    }
    if (!sense.submerged && sense.clearLine && sense.dist <= GUARD_STAND.strikeDist && s.cooldown <= 0) {
      struck = true;
      s.cooldown = 2.8;
      s.mode = 'return';
    } else if (s.timer <= 0) {
      s.mode = 'return';
    }
  } else if (s.mode === 'return') {
    goalX = s.homeX;
    goalZ = s.homeZ;
    if (runningViolation && s.cooldown <= 0) {
      s.mode = 'surge';
      s.timer = GUARD_STAND.chaseHold;
      s.lastSeenX = sense.playerX;
      s.lastSeenZ = sense.playerZ;
      whistle = true;
      speed = GUARD_STAND.surgeSpeed;
    } else if (sense.distHome > 0.22) {
      s.unfold += (1 - s.unfold) * (1 - Math.exp(-6 * dt));
      speed = GUARD_STAND.returnSpeed;
    } else {
      s.unfold += (0 - s.unfold) * (1 - Math.exp(-5.5 * dt));
      if (s.unfold < 0.06) {
        s.unfold = 0;
        s.mode = 'chair';
        s.timer = GUARD_STAND.chairDur;
      }
    }
  }

  if (speed > 0.05) {
    const prevBeat = Math.floor(s.stride / Math.PI);
    s.stride += dt * speed * 3.1;
    if (Math.floor(s.stride / Math.PI) !== prevBeat) footstep = true;
  }

  return { state: s, speed, goalX, goalZ, whistle, unfoldedNow, struck, footstep };
}

/**
 * Compute 4-legged, 3-jointed bendy arachnid-chair gait & pelvis heave for The Guard-Stand.
 * Each of the 4 corner chair legs (`FL, FR, BL, BR`) runs on its own distinct quarter-cycle
 * spider phase (`0, pi, pi/2, 3pi/2` — never paired!) with a 3-segment planar chain
 * (`femur -> tibia -> tarsus`) inside a Y-azimuth mount:
 *   - At `unfold = 0` (`chair`): the 4 legs lock straight upright at the 4 corners of the chair
 *     so the split front ladder rungs meet seamlessly across the front (`pelvisY ~ 1.70 m`).
 *   - At `unfold = 1` (`spider`): the chair breaks apart — the front ladder rungs rip open, the
 *     pelvis crouches (`~0.73 m`), and the 4 mottled-flesh femurs arch high up while the jointed
 *     PVC shins curl and whip independently across tile and water!
 */
export function guardStandGait(unfold, stride, speed, time, mode) {
  const u = clamp(unfold, 0, 1);
  const moveK = clamp(speed / 2.1, 0, 1.25) * u;
  const TAU = Math.PI * 2;
  const SWING_FRAC = 0.36;

  // 4 distinct spider wave phases: FL (0), FR (pi), BL (3pi/2), BR (pi/2) — never stepping in pairs!
  const defs = [
    { sx: -1, sz: 1, az0: 0.0, az1: 0.74, ph: 0 },
    { sx: 1, sz: 1, az0: 0.0, az1: 0.74, ph: Math.PI },
    { sx: -1, sz: -1, az0: 0.0, az1: -0.74, ph: (TAU * 3) / 4 },
    { sx: 1, sz: -1, az0: 0.0, az1: -0.74, ph: TAU / 4 },
  ];

  // Segment lengths in metres (22, 23, 25 voxels at S = 0.026 m -> 0.572, 0.598, 0.650 m) + hip mount (+0.065 m)
  const baseT1 = -1.12 + 1.70 * u; // -64.2 deg chair hip -> +33.2 deg high-arched spider femur!
  const baseT2 = -1.56 + 0.78 * u; // -89.4 deg vertical chair post -> -44.7 deg wide spider tibia!
  const baseT3 = -1.56 - 0.22 * u; // -89.4 deg vertical chair post -> -102.0 deg inward spider hook!

  const legs = defs.map((d, idx) => {
    const az = d.az0 + (d.az1 - d.az0) * u;
    const p = ((((stride + d.ph) % TAU) + TAU) % TAU) / TAU;

    let sweep = 0;
    let reachFlex = 0;
    let lift = 0;
    let whip = 0;
    let whipTip = 0;

    if (p < SWING_FRAC) {
      const s = p / SWING_FRAC;
      const env = Math.sin(s * Math.PI);
      sweep = -Math.cos(s * Math.PI) * 0.38 * moveK;
      reachFlex = Math.cos(s * TAU) * 0.18 * moveK;
      lift = env * moveK;
      whip = env * Math.sin(s * TAU) * moveK;
      whipTip = env * Math.sin((s - 0.12) * TAU) * moveK;
    } else {
      const g = (p - SWING_FRAC) / (1 - SWING_FRAC);
      sweep = (1 - 2 * g) * 0.38 * moveK;
      reachFlex = Math.cos(g * TAU) * 0.18 * moveK;
    }

    const rearArch = d.sz < 0 ? 0.14 * u : 0;
    const feel = Math.sin(time * 2.4 + idx * 1.57) * 0.055 * u;
    const t1 = baseT1 + rearArch + lift * 0.56 - reachFlex * 0.45 + whip * 0.22 + feel;
    const t2 = baseT2 - rearArch * 0.35 - lift * 0.28 + reachFlex * 0.88 - whip * 0.78 - feel * 0.8;
    const t3 = baseT3 - lift * 0.36 + reachFlex * 0.96 - whipTip * 0.98 + feel * 1.1;

    const yaw = d.sx > 0 ? -(az + sweep) : Math.PI + az + sweep;
    return {
      yaw,
      femurZ: t1,
      tibiaZ: t2 - t1,
      tarsusZ: t3 - t2,
      lift,
      sweep,
      sx: d.sx,
      sz: d.sz,
    };
  });

  // Exact trig stance drop keeps rubber feet planted on y = 0 for all u in [0, 1]!
  const stanceDrop = -(0.065 + 0.572 * Math.sin(baseT1) + 0.598 * Math.sin(baseT2) + 0.650 * Math.sin(baseT3));
  const pelvisY = stanceDrop + Math.sin(stride * 2) * 0.045 * moveK + (mode === 'whistle' ? Math.sin(time * 22) * 0.025 : 0);
  const pelvisRoll = Math.sin(stride) * 0.08 * moveK;
  const pelvisPitch = (mode === 'whistle' ? -0.18 : 0.14 * u) + Math.cos(stride * 2) * 0.04 * moveK;
  const spinePitch = mode === 'whistle'
    ? -0.32 + Math.sin(time * 26) * 0.06
    : mode === 'surge'
      ? 0.38 + Math.sin(stride * 2) * 0.07
      : mode === 'recoil'
        ? -0.40
        : 0.04 + 0.20 * u;

  return { legs, pelvisY, pelvisRoll, pelvisPitch, spinePitch };
}

/* ---- Room 3: The Scalding Bays (Tiled Shower Maze valve & steam puzzle) --- */

export const SHOWER_MAZE = Object.freeze({
  burnCooldown: 2.2,
  jetHalfLen: 0.92,
  jetHalfThick: 0.48,
  valvesToUnlock: 2,
});

/**
 * Pure state for the 3-valve Tiled Shower Maze (`locker-showers.js`).
 * gates: array of `{ x, z, axis: 'x' | 'z' }` in room-local coordinates.
 */
export function makeShowerMaze(gates = []) {
  return {
    shut: gates.map(() => false),
    gates: gates.map((g) => ({ x: g.x, z: g.z, axis: g.axis || 'x' })),
    sanctumOpen: false,
    doorAngle: 0,
    upwardSurge: 1.0,
    burnCooldown: 0,
  };
}

/** Turn valve `idx` (`0..n-1`): shuts its linked steam gate and unlocks the sanctum locker once >= 2 are shut. */
export function turnShowerValve(prev, idx) {
  if (idx < 0 || idx >= prev.shut.length || prev.shut[idx]) {
    return { state: prev, changed: false, unlockedNow: false };
  }
  const shut = prev.shut.slice();
  shut[idx] = true;
  const shutCount = shut.filter(Boolean).length;
  const sanctumOpen = shutCount >= Math.min(SHOWER_MAZE.valvesToUnlock, shut.length);
  const unlockedNow = sanctumOpen && !prev.sanctumOpen;
  return {
    state: {
      ...prev,
      shut,
      sanctumOpen: sanctumOpen ? shut.map(() => true) && true : false,
      upwardSurge: 1.0 + shutCount * 0.28,
    },
    changed: true,
    unlockedNow,
  };
}

/**
 * Advance the shower maze one tick: animate the sanctum locker door once unlocked,
 * and check whether the visitor walked into an active scalding steam gate.
 */
export function stepShowerMaze(prev, { dt, inside, px = 0, pz = 0 }) {
  const s = {
    ...prev,
    burnCooldown: Math.max(0, prev.burnCooldown - dt),
  };
  let burned = false;
  let activeGates = 0;

  // Once sanctum unlocks (>= 2 valves turned), all remaining steam pressure vents upward!
  for (let i = 0; i < s.gates.length; i++) {
    const gateActive = !s.shut[i] && !s.sanctumOpen;
    if (!gateActive) continue;
    activeGates++;
    if (inside && s.burnCooldown <= 0) {
      const g = s.gates[i];
      const along = g.axis === 'x' ? Math.abs(px - g.x) : Math.abs(pz - g.z);
      const across = g.axis === 'x' ? Math.abs(pz - g.z) : Math.abs(px - g.x);
      if (along < SHOWER_MAZE.jetHalfLen && across < SHOWER_MAZE.jetHalfThick) {
        burned = true;
        s.burnCooldown = SHOWER_MAZE.burnCooldown;
      }
    }
  }

  if (s.sanctumOpen && s.doorAngle < 1.65) {
    s.doorAngle = Math.min(1.65, s.doorAngle + dt * 2.6);
  }

  return { state: s, burned, activeGates };
}

/* ---- Room 4: The Drain Spa (Whirlpool Flume vortex & jet-reversal rules) -- */

export const WHIRLPOOL_SPA = Object.freeze({
  calmDur: 8.5,
  vortexTangential: 1.05,
  vortexInward: 0.28,
  calmTangential: 0.24,
});

export function makeWhirlpoolSpa(spin = 1) {
  return {
    spin: spin >= 0 ? 1 : -1,
    calmSec: 0,
    toggles: 0,
    siphonSurge: 1.0,
  };
}

export function toggleWhirlpoolJets(prev) {
  return {
    ...prev,
    spin: -prev.spin,
    calmSec: WHIRLPOOL_SPA.calmDur,
    toggles: prev.toggles + 1,
    siphonSurge: 1.68,
  };
}

export function stepWhirlpoolSpa(prev, dt) {
  const calmSec = Math.max(0, prev.calmSec - Math.max(0, dt));
  const targetSurge = calmSec > 0 ? 1.68 : 1.0;
  const siphonSurge = prev.siphonSurge + (targetSurge - prev.siphonSurge) * Math.min(1, Math.max(0, dt) * 3.5);
  return { ...prev, calmSec, siphonSurge };
}

export function whirlpoolField(state, x, z, hs) {
  const r = Math.hypot(x, z);
  if (r <= 0.24 || r >= hs - 0.18) return { inVortex: false, vx: 0, vz: 0 };
  const calm = state.calmSec > 0;
  const tang = calm ? WHIRLPOOL_SPA.calmTangential : WHIRLPOOL_SPA.vortexTangential;
  const inward = calm ? -0.05 : WHIRLPOOL_SPA.vortexInward;
  const vx = (-z / r) * state.spin * tang - (x / r) * inward;
  const vz = (x / r) * state.spin * tang - (z / r) * inward;
  return { inVortex: true, vx, vz };
}

/* ---- Room 5: Surge Basin floating surf debris kinematics ------------------ */

export function waveDebrisPose(hx, hz, ws, t, phase = 0, zMin = -6, zMax = 6) {
  let lift = Math.sin(t * 2.1 + phase) * 0.025;
  let surgeZ = Math.cos(t * 1.1 + phase) * 0.12;
  let pitch = Math.sin(t * 1.8 + phase) * 0.05;
  const roll = Math.cos(t * 1.5 + phase * 1.3) * 0.06;

  if (ws && ws.active) {
    const dz = hz - ws.crestZ;
    const band = Math.exp(-(dz * dz) / 2.2);
    lift += band * ws.amp * 0.62;
    surgeZ += band * 0.68;
    pitch -= (dz / 1.5) * band * 0.38;
  }
  return {
    x: hx + Math.sin(t * 0.8 + phase) * 0.09,
    y: lift,
    z: clamp(hz + surgeZ, zMin + 0.55, zMax - 0.55),
    pitch,
    roll,
  };
}

/* ---- Room 6: The Diving Well (submerged intake grate cycle) --------------- */

export const DIVING_WELL = Object.freeze({
  period: 8.0,
  warnAt: 4.0,
  pullAt: 5.4,
  pullEnd: 7.6,
  grateX: 0,
  grateZ: 0,
  pullRadius: 3.25,
  pullSpeed: 1.85,
  hitRadius: 0.72,
  drainCooldown: 2.4,
});

export function divingWellState(t) {
  const ph = ((t % DIVING_WELL.period) + DIVING_WELL.period) % DIVING_WELL.period;
  if (ph >= DIVING_WELL.pullAt && ph < DIVING_WELL.pullEnd) {
    const u = (ph - DIVING_WELL.pullAt) / (DIVING_WELL.pullEnd - DIVING_WELL.pullAt);
    return { phase: 'pull', strength: 0.55 + 0.45 * Math.sin(u * Math.PI) };
  }
  if (ph >= DIVING_WELL.warnAt && ph < DIVING_WELL.pullAt) {
    return { phase: 'warn', strength: 0.35 };
  }
  return { phase: 'calm', strength: 0 };
}

export function makeDivingWell() {
  return { cooldown: 0 };
}

export function stepDivingWell(prev, { dt, t, inside, submerged, inAirBell, px = 0, pz = 0 }) {
  const s = { cooldown: Math.max(0, (prev?.cooldown || 0) - Math.max(0, dt)) };
  const well = divingWellState(t);
  let pullX = 0, pullZ = 0, grated = false;

  if (inside && submerged && !inAirBell && well.phase === 'pull') {
    const dx = DIVING_WELL.grateX - px;
    const dz = DIVING_WELL.grateZ - pz;
    const dist = Math.hypot(dx, dz);
    if (dist < DIVING_WELL.pullRadius && dist > 0.04) {
      const k = (1 - dist / DIVING_WELL.pullRadius) * well.strength * DIVING_WELL.pullSpeed;
      pullX = (dx / dist) * k;
      pullZ = (dz / dist) * k;
    }
    if (dist < DIVING_WELL.hitRadius && s.cooldown <= 0) {
      grated = true;
      s.cooldown = DIVING_WELL.drainCooldown;
    }
  }
  return { state: s, well, pullX, pullZ, grated };
}

/* ---- Room 7: The Toadstool Lagoon (Inverted Bathers in candy floats) ------ */

export const LAGOON_FLOATS = Object.freeze({
  splashSpeed: 2.15,
  wakeDist: 1.78,
  strikeDist: 0.74,
  lungeSpeed: 2.85,
  calmMemory: 0.85,
  cooldownDur: 2.6,
  deflatedDur: 7.5,
});

export function makeLagoonFloat(hx, hz, occupied, phase = 0) {
  return {
    hx,
    hz,
    x: hx,
    z: hz,
    occupied: !!occupied,
    phase,
    mode: 'bob', // 'bob' | 'lunge' | 'deflated'
    pursueSec: 0,
    cooldown: 0,
    deflatedSec: 0,
  };
}

export function snipLagoonFloat(prev) {
  if (!prev.occupied || prev.mode === 'deflated') return prev;
  return {
    ...prev,
    mode: 'deflated',
    deflatedSec: LAGOON_FLOATS.deflatedDur,
    pursueSec: 0,
    cooldown: 2.2,
  };
}

export function stepLagoonFloat(prev, { dt, t, inside, inBasin, crouch, speed = 0, px = 0, pz = 0 }) {
  const s = {
    ...prev,
    cooldown: Math.max(0, prev.cooldown - Math.max(0, dt)),
  };
  let wokeNow = false;
  let struck = false;
  let twitch = Math.sin(t * 1.6 + s.phase) * 0.04;

  const targetHx = s.hx + Math.cos(t * 0.55 + s.phase) * 0.16;
  const targetHz = s.hz + Math.sin(t * 0.65 + s.phase) * 0.16;

  if (!s.occupied) {
    s.x += (targetHx - s.x) * Math.min(1, dt * 1.8);
    s.z += (targetHz - s.z) * Math.min(1, dt * 1.8);
    return { state: s, twitch, wokeNow, struck };
  }

  if (s.mode === 'deflated') {
    s.deflatedSec = Math.max(0, s.deflatedSec - dt);
    s.x += (targetHx - s.x) * Math.min(1, dt * 1.5);
    s.z += (targetHz - s.z) * Math.min(1, dt * 1.5);
    twitch = 0.42;
    if (s.deflatedSec <= 0) s.mode = 'bob';
    return { state: s, twitch, wokeNow, struck };
  }

  const dist = inside ? Math.hypot(px - s.x, pz - s.z) : 99;
  const splashing = inside && inBasin && !crouch && speed > LAGOON_FLOATS.splashSpeed;

  if (splashing && dist < LAGOON_FLOATS.wakeDist && s.cooldown <= 0) {
    if (s.mode !== 'lunge') wokeNow = true;
    s.mode = 'lunge';
    s.pursueSec = LAGOON_FLOATS.calmMemory;
  } else if (s.mode === 'lunge') {
    s.pursueSec = Math.max(0, s.pursueSec - dt * (crouch || speed <= LAGOON_FLOATS.splashSpeed * 0.65 ? 1.8 : 1.0));
    if (s.pursueSec <= 0 || !inside) s.mode = 'bob';
  }

  if (s.mode === 'lunge' && inside) {
    const inv = 1 / Math.max(0.08, dist);
    s.x += (px - s.x) * inv * LAGOON_FLOATS.lungeSpeed * dt;
    s.z += (pz - s.z) * inv * LAGOON_FLOATS.lungeSpeed * dt;
    twitch = Math.sin(t * 26 + s.phase) * 0.30;
    if (dist < LAGOON_FLOATS.strikeDist && s.cooldown <= 0) {
      struck = true;
      s.cooldown = LAGOON_FLOATS.cooldownDur;
      s.pursueSec = 0;
      s.mode = 'bob';
    }
  } else {
    s.x += (targetHx - s.x) * Math.min(1, dt * 1.8);
    s.z += (targetHz - s.z) * Math.min(1, dt * 1.8);
    twitch = Math.sin(t * 1.9 + s.phase) > 0.91
      ? Math.sin(t * 24 + s.phase) * 0.14
      : Math.sin(t * 1.6 + s.phase) * 0.04;
  }

  return { state: s, twitch, wokeNow, struck };
}
