// The Backrooms — the rules of the Offsite Reserve (`forest`).
// Pure: no three.js, no DOM, no I/O, zero imports. Every state machine and
// physical rule on the forest floor runs against a synthetic clock in
// `test/backrooms-forest.test.mjs`.

export const FOREST = Object.freeze({
  // Peat-bog wading & dry-bracken acoustics
  bogDrag: 0.54,           // movement multiplier in ankle-to-shin peat water
  bogSink: 0.34,           // metres the eye settles into peat water
  rustleSpeed: 1.35,       // walking faster than this upright in bracken crunches loudly
  rustleCooldown: 0.42,    // seconds between distinct crunch pulses
  rustleMemory: 1.15,      // seconds an audible crunch lingers for ear-sensitive entities
  slipSpeed: 2.85,         // sprinting out of wet peat onto slick moss-stones
  slipDuration: 0.46,

  // Notched hollow timber felling (uses marks.js lean)
  timberFallTime: 1.12,    // seconds from crack to horizontal slam
  timberMaxAngle: 1.53,    // radians (~87.7°, resting slightly proud of floor/bog)
  bridgeHalfWidth: 0.42,   // walkable width of a felled trunk

  // Loose bog duckboards (`bog-boardwalk`)
  plankDipDelay: 0.85,     // seconds stood on a loose board before it sinks under water
  plankRiseRate: 0.9,      // recovery rate once stepped off
});

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/* ---- 1. Peat-bog wading & dry-bracken acoustics -------------------------- */

export function makeForestWalker() {
  return {
    inBog: false,
    wetTimer: 0,
    slipTimer: 0,
    rustleCooldown: 0,
    rustleAlert: 0,
    stepPhase: 0,
  };
}

/**
 * Advance visitor footing across peat bogs, dry bracken beds, and felled log bridges.
 * `sense`: { inBog, onBridge, inBracken, speed, crouch, hurry }
 */
export function stepForestWalker(s, dt, sense = {}) {
  const next = { ...s };
  const events = { enteredBog: false, splash: false, slipped: false, rustled: false, bubble: false };
  if (!(dt > 0)) return { state: next, slow: 1, sink: 0, events };

  const inBog = Boolean(sense.inBog) && !sense.onBridge;
  const inBracken = Boolean(sense.inBracken) && !sense.onBridge && !inBog;
  const speed = Math.max(0, sense.speed || 0);
  const crouch = Boolean(sense.crouch);

  next.rustleCooldown = Math.max(0, next.rustleCooldown - dt);
  next.rustleAlert = Math.max(0, next.rustleAlert - dt);
  next.slipTimer = Math.max(0, next.slipTimer - dt);

  if (inBog) {
    if (!s.inBog) {
      events.enteredBog = true;
      if (speed > 0.35) events.splash = true;
    }
    next.inBog = true;
    next.wetTimer = 2.0;
    if (speed > 0.25) {
      const prev = Math.floor(next.stepPhase);
      next.stepPhase += dt * (1.2 + speed * 0.65);
      if (Math.floor(next.stepPhase) > prev) events.bubble = true;
    }
  } else {
    if (s.inBog && speed >= FOREST.slipSpeed && Boolean(sense.hurry) && next.slipTimer <= 0) {
      next.slipTimer = FOREST.slipDuration;
      events.slipped = true;
    }
    next.inBog = false;
    next.wetTimer = Math.max(0, next.wetTimer - dt);
  }

  // Dry bracken & pinecones: silent when crouched or slow-stepping; loud crunch upright
  if (inBracken && !crouch && speed > FOREST.rustleSpeed) {
    next.rustleAlert = FOREST.rustleMemory;
    if (next.rustleCooldown <= 0) {
      next.rustleCooldown = FOREST.rustleCooldown;
      events.rustled = true;
    }
  }

  const slow = next.slipTimer > 0 ? 0.45 : inBog ? FOREST.bogDrag : inBracken && !crouch ? 0.88 : 1;
  const sink = inBog ? FOREST.bogSink : 0;
  return { state: next, slow, sink, events };
}

/* ---- 2. Notched hollow timber felling & log bridges ---------------------- */

/**
 * `spec`: { x, z, dirX, dirZ, length, radius, bridgeY }
 * `(dirX, dirZ)` is the unit direction the trunk falls TOWARD when leaned on from behind `(-dirX, -dirZ)`.
 */
export function makeTimber(spec = {}) {
  const mag = Math.hypot(spec.dirX || 0, spec.dirZ || 0) || 1;
  return {
    x: spec.x || 0,
    z: spec.z || 0,
    dirX: (spec.dirX || 0) / mag,
    dirZ: (spec.dirZ ?? 1) / mag,
    length: Math.max(1.8, spec.length || 3.4),
    radius: Math.max(0.18, spec.radius || 0.28),
    bridgeY: spec.bridgeY ?? 0.14,
    mode: 'standing', // 'standing' | 'falling' | 'felled'
    progress: 0,      // 0..1 fall progress
    angle: 0,         // radians from upright
    shudder: 0,       // wrong-side knock shudder
  };
}

/**
 * Advance a notched hollow trunk.
 * `sense`: { leanedRightSide, leanedWrongSide }
 */
export function stepTimber(s, dt, sense = {}) {
  const next = { ...s };
  let cracked = false, slammed = false, refused = false;
  next.shudder = Math.max(0, next.shudder - Math.max(0, dt) * 4.5);

  if (next.mode === 'standing') {
    if (sense.leanedRightSide) {
      next.mode = 'falling';
      next.progress = 0.001;
      cracked = true;
    } else if (sense.leanedWrongSide && next.shudder <= 0.05) {
      next.shudder = 1;
      refused = true;
    }
  } else if (next.mode === 'falling' && dt > 0) {
    // Accelerating gravity tip: slow creak at top, heavy slam at bottom
    next.progress = Math.min(1, next.progress + dt / FOREST.timberFallTime);
    const ease = next.progress * next.progress;
    next.angle = FOREST.timberMaxAngle * ease;
    if (next.progress >= 1) {
      next.mode = 'felled';
      next.angle = FOREST.timberMaxAngle;
      slammed = true;
    }
  }
  return { state: next, cracked, slammed, refused };
}

/**
 * Check whether `(px, pz)` stands on a felled trunk's walkable log span.
 * Returns `{ on: true, y }` or `{ on: false, y: null }`.
 */
export function timberBridgeAt(s, px, pz) {
  if (!s || s.mode !== 'felled') return { on: false, y: null };
  const dx = px - s.x, dz = pz - s.z;
  const along = dx * s.dirX + dz * s.dirZ;
  const perp = Math.abs(-dx * s.dirZ + dz * s.dirX);
  const halfW = Math.max(FOREST.bridgeHalfWidth, s.radius * 1.35);
  if (along >= -0.25 && along <= s.length + 0.18 && perp <= halfW) {
    return { on: true, y: s.bridgeY };
  }
  return { on: false, y: null };
}

/* ---- 3. Loose bog duckboards (`bog-boardwalk`) --------------------------- */

export function makeDuckboard(count = 4) {
  return {
    loads: Array.from({ length: Math.max(1, count) }, () => 0),
  };
}

/**
 * `activeIdx`: index of loose board the visitor is currently standing on (-1 if none).
 * Returns `{ state, sunkMask, creakedIdx, plungedIdx }`.
 */
export function stepDuckboard(s, dt, activeIdx = -1) {
  const loads = s.loads.slice();
  let creakedIdx = -1, plungedIdx = -1;
  for (let i = 0; i < loads.length; i++) {
    const prev = loads[i];
    if (i === activeIdx) {
      loads[i] = Math.min(1.6, prev + Math.max(0, dt));
      if (prev < 0.18 && loads[i] >= 0.18) creakedIdx = i;
      if (prev < FOREST.plankDipDelay && loads[i] >= FOREST.plankDipDelay) plungedIdx = i;
    } else {
      loads[i] = Math.max(0, prev - Math.max(0, dt) * FOREST.plankRiseRate);
    }
  }
  const sunkMask = loads.map((v) => v >= FOREST.plankDipDelay);
  return { state: { loads }, sunkMask, creakedIdx, plungedIdx };
}

/* ---- 4. Centerpiece Hunter: THE COAT-RACK BUCK (`stag.js`) --------------- */

export const BUCK = Object.freeze({
  hurt: 1,                // a heart on antler impact (it was two, half of everything: more than a room's resident should take)
  beamRange: 12.0,        // distance at which a direct torch beam wakes it
  earRange: 9.2,          // distance at which dry-bracken crunching or running wakes it
  personalSpace: 2.15,    // standing right up against the "coat-rack" wakes it even in the dark
  scrapeTime: 0.85,       // clear hoof-scrape + hook-rattle warning before charge
  chargeSpeed: 5.7,       // straight-line charge speed (m/s)
  chargeMaxDist: 10.5,    // maximum distance of a single charge run before braking
  stalkSpeed: 1.95,       // cautious circling step when tracking an echo
  returnSpeed: 1.55,      // trotting back toward its coat-rack stand
  wedgedTime: 3.4,        // seconds stuck with coat-hook antlers wedged in a trunk/wall
  recoilTime: 2.9,        // seconds recoiling from fire or safety scissors
  cooldownTime: 6.5,      // grace window after landing a hit
  strikeReach: 0.92,      // antler strike distance
  decoyTime: 4.2,         // seconds investigating a Trail Call whistle echo
});

export function makeBuck(homeX = 0, homeZ = 0) {
  return {
    homeX,
    homeZ,
    mode: 'rack',       // 'rack' | 'scrape' | 'charge' | 'wedged' | 'decoy' | 'recoil' | 'cooldown' | 'return'
    unfold: 0,          // 0 = upright coat-rack disguise, 1 = full stag stance
    timer: 0,
    chargeDx: 0,
    chargeDz: 1,
    chargeDist: 0,
    goalX: homeX,
    goalZ: homeZ,
    decoyX: homeX,
    decoyZ: homeZ,
    stride: 0,
    stepTick: 0,
  };
}

/**
 * Pure state step for The Coat-Rack Buck.
 * `sense`: {
 *   dt, inside, dist, distHome, clearLine,
 *   beamOnBuck, rustled, running, nearFire,
 *   heardCall, callX, callZ,
 *   buckX, buckZ, playerX, playerZ,
 *   blockedMove
 * }
 */
export function stepBuck(s, sense = {}) {
  const dt = Math.max(0, sense.dt || 0);
  const next = { ...s };
  let rattled = false, snorted = false, wedgedNow = false, struck = false, hoofstep = false, unfoldedNow = false;

  if (!(dt > 0)) {
    return { state: next, speed: 0, rattled, snorted, wedgedNow, struck, hoofstep, unfoldedNow };
  }

  const px = sense.playerX ?? 0, pz = sense.playerZ ?? 0;
  const bx = sense.buckX ?? next.homeX, bz = sense.buckZ ?? next.homeZ;
  const dist = sense.dist ?? Math.hypot(px - bx, pz - bz);
  const distHome = sense.distHome ?? Math.hypot(bx - next.homeX, bz - next.homeZ);

  // Fire fear overrides aggressive states immediately
  if (sense.nearFire && next.mode !== 'recoil') {
    const awayDx = bx - (sense.fireX ?? px), awayDz = bz - (sense.fireZ ?? pz);
    const awayD = Math.hypot(awayDx, awayDz) || 1;
    next.mode = 'recoil';
    next.timer = BUCK.recoilTime;
    next.goalX = bx + (awayDx / awayD) * 3.5;
    next.goalZ = bz + (awayDz / awayD) * 3.5;
    snorted = true;
  }

  // Trail Call whistle lures the buck when disguised, returning, or stalking
  if (sense.heardCall && (next.mode === 'rack' || next.mode === 'return' || next.mode === 'decoy')) {
    if (next.mode === 'rack') unfoldedNow = true;
    next.mode = 'decoy';
    next.timer = BUCK.decoyTime;
    next.decoyX = sense.callX ?? px;
    next.decoyZ = sense.callZ ?? pz;
    next.goalX = next.decoyX;
    next.goalZ = next.decoyZ;
    rattled = true;
  }

  const triggered = Boolean(sense.inside) && (
    (Boolean(sense.beamOnBuck) && Boolean(sense.clearLine) && dist <= BUCK.beamRange) ||
    (Boolean(sense.rustled) && dist <= BUCK.earRange) ||
    (Boolean(sense.running) && dist <= BUCK.earRange * 0.82) ||
    (Boolean(sense.clearLine) && dist <= BUCK.personalSpace)
  );

  let speed = 0;

  if (next.mode === 'rack') {
    next.unfold = Math.max(0, next.unfold - dt * 2.6);
    if (triggered) {
      next.mode = 'scrape';
      next.timer = BUCK.scrapeTime;
      const dx = px - bx, dz = pz - bz, d = Math.hypot(dx, dz) || 1;
      next.chargeDx = dx / d;
      next.chargeDz = dz / d;
      next.goalX = px;
      next.goalZ = pz;
      rattled = true;
      unfoldedNow = true;
    }
  } else if (next.mode === 'scrape') {
    next.unfold = Math.min(1, next.unfold + dt * 4.2);
    // Track aim during the first half of the hoof-scrape, then commit the line so player can sidestep!
    if (next.timer > BUCK.scrapeTime * 0.38) {
      const dx = px - bx, dz = pz - bz, d = Math.hypot(dx, dz) || 1;
      next.chargeDx = dx / d;
      next.chargeDz = dz / d;
    }
    next.timer -= dt;
    if (next.timer <= 0) {
      next.mode = 'charge';
      next.chargeDist = 0;
      next.goalX = bx + next.chargeDx * BUCK.chargeMaxDist;
      next.goalZ = bz + next.chargeDz * BUCK.chargeMaxDist;
      snorted = true;
    }
  } else if (next.mode === 'charge') {
    next.unfold = 1;
    speed = BUCK.chargeSpeed;
    next.goalX = bx + next.chargeDx * 4.0;
    next.goalZ = bz + next.chargeDz * 4.0;
    next.chargeDist += speed * dt;

    if (sense.inside && dist <= BUCK.strikeReach) {
      struck = true;
      next.mode = 'cooldown';
      next.timer = BUCK.cooldownTime;
      speed = 0;
    } else if (sense.blockedMove && next.chargeDist > 0.35) {
      // Antlers slammed into a tree trunk, partition, or felled log!
      next.mode = 'wedged';
      next.timer = BUCK.wedgedTime;
      wedgedNow = true;
      speed = 0;
    } else if (next.chargeDist >= BUCK.chargeMaxDist || !sense.inside) {
      next.mode = triggered ? 'scrape' : 'return';
      next.timer = triggered ? BUCK.scrapeTime : 0;
      if (triggered) rattled = true;
    }
  } else if (next.mode === 'wedged') {
    next.unfold = 1;
    next.timer -= dt;
    if (next.timer <= 0) {
      next.mode = triggered ? 'scrape' : 'return';
      next.timer = triggered ? BUCK.scrapeTime : 0;
      if (triggered) rattled = true;
    }
  } else if (next.mode === 'decoy') {
    next.unfold = Math.min(1, next.unfold + dt * 3.0);
    next.timer -= dt;
    const toDecoy = Math.hypot(next.decoyX - bx, next.decoyZ - bz);
    next.goalX = next.decoyX;
    next.goalZ = next.decoyZ;
    speed = toDecoy > 0.55 ? BUCK.stalkSpeed : 0;
    if (triggered) {
      next.mode = 'scrape';
      next.timer = BUCK.scrapeTime;
      const dx = px - bx, dz = pz - bz, d = Math.hypot(dx, dz) || 1;
      next.chargeDx = dx / d;
      next.chargeDz = dz / d;
      rattled = true;
    } else if (next.timer <= 0) {
      next.mode = 'return';
    }
  } else if (next.mode === 'recoil') {
    next.unfold = 1;
    next.timer -= dt;
    speed = 2.4;
    if (next.timer <= 0) {
      next.mode = 'return';
    }
  } else if (next.mode === 'cooldown') {
    next.unfold = 1;
    next.timer -= dt;
    next.goalX = next.homeX;
    next.goalZ = next.homeZ;
    speed = distHome > 0.4 ? BUCK.returnSpeed : 0;
    if (next.timer <= 0) {
      next.mode = distHome <= 0.45 ? 'rack' : 'return';
    }
  } else if (next.mode === 'return') {
    next.goalX = next.homeX;
    next.goalZ = next.homeZ;
    if (triggered) {
      next.mode = 'scrape';
      next.timer = BUCK.scrapeTime;
      const dx = px - bx, dz = pz - bz, d = Math.hypot(dx, dz) || 1;
      next.chargeDx = dx / d;
      next.chargeDz = dz / d;
      rattled = true;
    } else if (distHome <= 0.35) {
      next.unfold = Math.max(0, next.unfold - dt * 2.8);
      if (next.unfold <= 0.02) {
        next.unfold = 0;
        next.mode = 'rack';
      }
    } else {
      next.unfold = Math.min(1, next.unfold + dt * 2.0);
      speed = BUCK.returnSpeed;
    }
  }

  if (speed > 0.1) {
    const rate = next.mode === 'charge' ? 3.8 : 2.1;
    next.stride += dt * speed * rate;
    const prevTick = next.stepTick;
    next.stepTick = Math.floor(next.stride / Math.PI);
    if (next.stepTick > prevTick) hoofstep = true;
  }

  return { state: next, speed, rattled, snorted, wedgedNow, struck, hoofstep, unfoldedNow };
}

/** Safety Scissors jab shears a brass coat-hook tine and forces a recoil! */
export function snipBuck(s) {
  return {
    ...s,
    mode: 'recoil',
    unfold: 1,
    timer: BUCK.recoilTime,
  };
}

/** Pure 4-legged bentwood coat-rack quadruped gait angles for `stag.js`. */
export function buckGait(stride = 0, unfold = 0, mode = 'rack') {
  const u = clamp(unfold, 0, 1);
  const phases = [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5]; // FL, FR, BL, BR
  const amp = mode === 'charge' ? 0.62 : mode === 'scrape' ? 0.18 : 0.34;
  const legs = phases.map((p, idx) => {
    const sw = Math.sin(stride + p) * amp * u;
    const knee = Math.max(0, Math.cos(stride + p)) * 0.48 * u;
    const scrape = mode === 'scrape' && idx === 0 ? Math.sin(stride * 9) * 0.45 : 0;
    return {
      hipPitch: sw + scrape + (idx < 2 ? -0.12 : 0.14) * u,
      hipSplay: (idx % 2 === 0 ? -1 : 1) * (0.04 + 0.22 * u),
      kneePitch: knee + 0.18 * u,
    };
  });
  const headPitch = mode === 'charge' ? 0.68 : mode === 'scrape' ? 0.52 : mode === 'wedged' ? 0.78 : -0.05 * u;
  return { legs, headPitch };
}

/* ---- 5. Plain-Room Stalker: THE TRAIL SPOTTER ---------------------------- */

export const SPOTTER = Object.freeze({
  windup: 0.78,           // shutter whine before camera flash
  drainShare: 0.16,       // drains 16% of remaining camcorder battery on flash
  cooldown: 6.0,          // seconds before it can flash again
});

export function makeSpotter(slot = 0) {
  return {
    slot,
    charge: 0,
    cooldown: 0,
    flashedCount: 0,
    needRelocate: false,
  };
}

/**
 * `sense`: { inside, offTrail, clearLine, watched, unseen }
 */
export function stepSpotter(s, dt, sense = {}) {
  const next = { ...s };
  let whining = false, flashed = false, relocated = false;
  if (!(dt > 0)) return { state: next, whining, flashed, relocated };

  next.cooldown = Math.max(0, next.cooldown - dt);

  if (next.needRelocate && sense.unseen) {
    next.slot = (next.slot + 1) % 4;
    next.needRelocate = false;
    relocated = true;
  }

  // Looking directly at the Spotter resets its camera wind-up!
  if (!sense.inside || sense.watched || !sense.offTrail || !sense.clearLine || next.cooldown > 0) {
    next.charge = Math.max(0, next.charge - dt * 2.2);
    return { state: next, whining: false, flashed: false, relocated };
  }

  const prev = next.charge;
  next.charge += dt;
  if (prev <= 0.12 && next.charge > 0.12) whining = true;
  if (next.charge >= SPOTTER.windup) {
    next.charge = 0;
    next.cooldown = SPOTTER.cooldown;
    next.flashedCount += 1;
    next.needRelocate = true;
    flashed = true;
  }
  return { state: next, whining, flashed, relocated };
}

/* ---- 6. Campfire Entity: THE RETREAT FACILITATOR (`campfire-circle`) ----- */

export const FACILITATOR = Object.freeze({
  patience: 13.5,         // seconds holding out the roasted skewer before snapping
  backTurnLimit: 1.35,    // seconds turning your back within 4.5 m before lunge
  backTurnRange: 4.5,
  walkSpeed: 1.08,
  lungeSpeed: 3.55,
  returnSpeed: 1.5,
  offerReach: 1.35,
  strikeReach: 0.78,
  restTime: 9.0,
  rations: 1,
  hurt: 1,
});

export function makeFacilitator() {
  return {
    mode: 'fire',         // 'fire' | 'offer' | 'lunge' | 'rest' | 'recoil'
    waited: 0,
    backTimer: 0,
    rest: 0,
    rations: FACILITATOR.rations,
  };
}

/**
 * `sense`: { inside, dist, atHome, took, turnedBack, sprinting, nearFire }
 */
export function stepFacilitator(s, dt, sense = {}) {
  const next = { ...s };
  let event = null; // null | 'healed' | 'snapped' | 'hit'
  if (!(dt > 0)) return { state: next, event, speed: 0 };

  next.rest = Math.max(0, next.rest - dt);

  if (next.mode === 'recoil') {
    if (next.rest <= 0) next.mode = 'rest';
    return { state: next, event: null, speed: FACILITATOR.returnSpeed };
  }

  if (next.mode === 'fire') {
    if (sense.inside && next.rest <= 0 && next.rations > 0) {
      next.mode = 'offer';
      next.waited = 0;
      next.backTimer = 0;
    }
    return { state: next, event: null, speed: 0 };
  }

  if (next.mode === 'rest') {
    if (sense.atHome && next.rest <= 0) next.mode = 'fire';
    return { state: next, event: null, speed: sense.atHome ? 0 : FACILITATOR.returnSpeed };
  }

  if (!sense.inside) {
    next.waited = Math.max(0, next.waited - dt * 2);
    next.backTimer = 0;
    if (next.mode === 'lunge' || next.waited <= 0) next.mode = 'rest';
    return { state: next, event: null, speed: FACILITATOR.returnSpeed };
  }

  if (next.mode === 'offer') {
    if (sense.took) {
      next.rations = Math.max(0, next.rations - 1);
      next.mode = 'rest';
      next.rest = FACILITATOR.restTime;
      next.waited = 0;
      next.backTimer = 0;
      return { state: next, event: 'healed', speed: 0 };
    }
    next.waited += dt;
    if (sense.turnedBack && (sense.dist ?? 99) <= FACILITATOR.backTurnRange) {
      next.backTimer += dt;
    } else {
      next.backTimer = Math.max(0, next.backTimer - dt * 1.5);
    }

    if (next.waited >= FACILITATOR.patience || next.backTimer >= FACILITATOR.backTurnLimit || (sense.sprinting && next.waited > 1.0)) {
      next.mode = 'lunge';
      return { state: next, event: 'snapped', speed: FACILITATOR.lungeSpeed };
    }
    const speed = (sense.dist ?? 99) > FACILITATOR.offerReach ? FACILITATOR.walkSpeed : 0;
    return { state: next, event: null, speed };
  }

  if (next.mode === 'lunge') {
    if ((sense.dist ?? 99) <= FACILITATOR.strikeReach) {
      next.mode = 'rest';
      next.rest = FACILITATOR.restTime;
      next.waited = 0;
      next.backTimer = 0;
      return { state: next, event: 'hit', speed: 0 };
    }
    return { state: next, event: null, speed: FACILITATOR.lungeSpeed };
  }

  return { state: next, event: null, speed: 0 };
}

export function snipFacilitator(s) {
  return { ...s, mode: 'recoil', rest: 3.2, waited: 0, backTimer: 0 };
}

/* ---- 7. Overhead Ambush: MANILA BAGWORM HUSK (`canopy-walk`) ------------- */

export const BAGWORM = Object.freeze({
  senseRadius: 2.15,
  strikeRadius: 0.95,
  loudSpeed: 1.75,
  windup: 0.42,
  dropSpeed: 6.4,
  reelSpeed: 0.85,
  calmedTime: 8.5,
  hurt: 1,
});

export function makeBagworm(x = 0, z = 0, topY = 4.8, strikeY = 1.45) {
  return {
    x,
    z,
    topY,
    strikeY,
    y: topY,
    mode: 'perched', // 'perched' | 'windup' | 'dropping' | 'reeling' | 'calmed'
    timer: 0,
  };
}

/**
 * `sense`: { horizDist, playerY, speed, crouch, heardCall }
 */
export function stepBagworm(s, dt, sense = {}) {
  const next = { ...s };
  let warned = false, bit = false;
  if (!(dt > 0)) return { state: next, warned, bit };

  if (sense.heardCall) {
    next.mode = 'calmed';
    next.timer = BAGWORM.calmedTime;
  }

  if (next.mode === 'calmed') {
    next.y = Math.min(next.topY, next.y + BAGWORM.reelSpeed * 2.2 * dt);
    next.timer -= dt;
    if (next.timer <= 0 && next.y >= next.topY - 0.02) next.mode = 'perched';
    return { state: next, warned: false, bit: false };
  }

  const loudUnder = (sense.horizDist ?? 99) <= BAGWORM.senseRadius
    && !sense.crouch
    && (sense.speed || 0) > BAGWORM.loudSpeed;

  if (next.mode === 'perched') {
    next.y = next.topY;
    if (loudUnder) {
      next.mode = 'windup';
      next.timer = BAGWORM.windup;
      warned = true;
    }
  } else if (next.mode === 'windup') {
    if (!loudUnder && (sense.crouch || (sense.speed || 0) < 0.4)) {
      // Freezing or crouching in time aborts the drop!
      next.timer -= dt * 0.5;
      if (next.timer <= 0) next.mode = 'perched';
    } else {
      next.timer -= dt;
      if (next.timer <= 0) next.mode = 'dropping';
    }
  } else if (next.mode === 'dropping') {
    const floorStop = Math.max(0.4, (sense.playerY ?? 0) + next.strikeY);
    next.y = Math.max(floorStop, next.y - BAGWORM.dropSpeed * dt);
    if ((sense.horizDist ?? 99) <= BAGWORM.strikeRadius && Math.abs(next.y - ((sense.playerY ?? 0) + 1.35)) < 0.75) {
      bit = true;
      next.mode = 'reeling';
      next.timer = 2.0;
    } else if (next.y <= floorStop + 0.01) {
      next.mode = 'reeling';
      next.timer = 1.2;
    }
  } else if (next.mode === 'reeling') {
    next.timer = Math.max(0, next.timer - dt);
    if (next.timer <= 0.6) {
      next.y = Math.min(next.topY, next.y + BAGWORM.reelSpeed * dt);
      if (next.y >= next.topY - 0.01) {
        next.y = next.topY;
        next.mode = 'perched';
      }
    }
  }

  return { state: next, warned, bit };
}

export function snipBagworm(s) {
  return { ...s, mode: 'calmed', timer: BAGWORM.calmedTime };
}

/* ---- 8. Observational / Echo Puzzle: THE TRAIL LOOP (`blaze-junction`) --- */

/**
 * `trueIdx`: index (0..nPosts-1) whose cut stump has `targetRings` growth rings.
 * Decoy posts rotate their wooden arrows whenever unwatched!
 */
export function makeBlazePuzzle(nPosts = 5, trueIdx = 0, targetRings = 4) {
  const count = Math.max(3, nPosts);
  const win = ((trueIdx % count) + count) % count;
  const rings = Array.from({ length: count }, (_, i) => {
    if (i === win) return targetRings;
    const alt = ((targetRings + i + 1) % 6) + 2;
    return alt === targetRings ? targetRings + 1 : alt;
  });
  const pointTo = Array.from({ length: count }, (_, i) => (i === win ? win : (i + 2) % count));
  return {
    count,
    trueIdx: win,
    targetRings,
    rings,
    pointTo,
    wasSeen: Array.from({ length: count }, () => true),
    solved: false,
    wrongTries: 0,
  };
}

/**
 * `sense`: { seenMask: boolean[], triedIdx: number|null, rangCall: boolean }
 */
export function stepBlazePuzzle(s, sense = {}) {
  const pointTo = s.pointTo.slice();
  const wasSeen = s.wasSeen.slice();
  let shuffled = false, chimedIdx = -1, opened = false, shocked = false;
  let solved = s.solved, wrongTries = s.wrongTries;

  // Unwatched decoy posts rotate their arrows on look-away -> look-back!
  if (Array.isArray(sense.seenMask) && !solved) {
    for (let i = 0; i < s.count; i++) {
      const nowSeen = Boolean(sense.seenMask[i]);
      if (i !== s.trueIdx && wasSeen[i] && !nowSeen) {
        let nextTarget = (pointTo[i] + 1) % s.count;
        if (nextTarget === s.trueIdx) nextTarget = (nextTarget + 1) % s.count;
        pointTo[i] = nextTarget;
        shuffled = true;
      }
      wasSeen[i] = nowSeen;
    }
  }

  // Sounding the Trail Call whistle (or ringing the cairn bell) echoes from the true post!
  if (sense.rangCall) {
    chimedIdx = s.trueIdx;
  }

  if (Number.isInteger(sense.triedIdx) && sense.triedIdx >= 0 && sense.triedIdx < s.count && !solved) {
    if (sense.triedIdx === s.trueIdx) {
      solved = true;
      opened = true;
      for (let i = 0; i < s.count; i++) pointTo[i] = s.trueIdx;
    } else {
      wrongTries += 1;
      shocked = true;
    }
  }

  return {
    state: { ...s, pointTo, wasSeen, solved, wrongTries },
    shuffled,
    chimedIdx,
    opened,
    shocked,
  };
}

/* ---- The Burn (`burn-scar`): the smoke layer ------------------------------
   A wood that has burned, and the office's fire drill still running in it. The smoke lies in a layer: its underside
   at `under` metres, its top at `over`. A standing visitor's eye (1.1 m) is in it; a crouched one (0.6 m) is under it.
   In it, the picture fogs at once (that is the warning, and it costs nothing); stay in it and every `every` seconds
   the lens takes soot — `share` of the camcorder's charge. Never a heart. Out of it (crouch, or leave the smoke) and
   the lungs clear twice as fast as they filled. Pure. */
export const SMOKE = Object.freeze({ under: 0.8, over: 1.45, every: 2.2, share: 0.04, cough: 1.5, clear: 2 });

export function makeSmoke() { return { lungs: 0, sinceDrain: 0, sinceCough: 0, exposed: false }; }

/** sense: { inSmoke (over a smoky patch of floor), eyeY (eye above the floor) } → { state, fog 0..1, drain (share or 0), cough, entered } */
export function stepSmoke(s, dt, sense = {}) {
  const exposed = !!sense.inSmoke && sense.eyeY > SMOKE.under && sense.eyeY < SMOKE.over + 0.5;
  const entered = exposed && !s.exposed;
  let lungs = s.lungs, sinceDrain = s.sinceDrain, sinceCough = s.sinceCough, drain = 0, cough = false;
  if (exposed) {
    lungs += dt; sinceDrain += dt; sinceCough += dt;
    if (sinceDrain >= SMOKE.every) { sinceDrain -= SMOKE.every; drain = SMOKE.share; }
    if (sinceCough >= SMOKE.cough) { sinceCough = 0; cough = true; }
  } else {
    lungs = Math.max(0, lungs - dt * SMOKE.clear);
    sinceDrain = Math.max(0, sinceDrain - dt * SMOKE.clear);
    sinceCough = 0;
  }
  const fog = exposed ? Math.min(1, 0.35 + lungs * 0.25) : Math.min(0.3, lungs * 0.2);
  return { state: { lungs, sinceDrain, sinceCough, exposed }, fog, drain, cough, entered };
}

/* ---- The Burn: the Fire Marshal --------------------------------------------
   Whoever was in charge of the drill, still doing it: hi-vis gone to tar, a hard hat, an extinguisher, and where a face
   would be, a smoke detector. It can only see what is in the smoke. Its one tell is the detector's chirp: when your
   head is in the smoke, in its sight and within `sight`, it chirps (`chirp` s, no harm yet) and then walks at you. Get
   your head under the smoke and it loses you after `lose` s. If it reaches you it empties the extinguisher: one heart,
   and then it stands down for `cool` s. Scissors make it stand down too. Pure. */
export const MARSHAL = Object.freeze({ sight: 9, chirp: 0.9, lose: 1.2, walk: 0.85, pursue: 2.2, reach: 0.7, cool: 4.5, snipCool: 3.2 });

export function makeMarshal() { return { mode: 'patrol', timer: 0, lost: 0 }; }

/**
 * sense: { inside, exposed (the visitor's head is in the smoke), dist, clearLine }
 * → { state, speed (m/s it should walk this moment; toward the visitor unless patrol), event: null | 'chirp' | 'spray' | 'lost' }
 */
export function stepMarshal(s, dt, sense = {}) {
  let { mode, timer, lost } = s, event = null;
  const sees = !!sense.inside && !!sense.exposed && !!sense.clearLine && sense.dist < MARSHAL.sight;
  if (mode === 'cool') {
    timer -= dt;
    if (timer <= 0) { mode = 'patrol'; timer = 0; }
  } else if (mode === 'patrol') {
    if (sees) { mode = 'chirp'; timer = MARSHAL.chirp; lost = 0; event = 'chirp'; }
  } else if (mode === 'chirp') {
    timer -= dt;
    if (timer <= 0) mode = sees ? 'pursue' : 'patrol';
  } else if (mode === 'pursue') {
    if (!sense.inside) { mode = 'patrol'; lost = 0; event = 'lost'; }
    else if (sense.dist < MARSHAL.reach) { mode = 'cool'; timer = MARSHAL.cool; lost = 0; event = 'spray'; }
    else if (!sense.exposed) { lost += dt; if (lost >= MARSHAL.lose) { mode = 'patrol'; lost = 0; event = 'lost'; } }
    else lost = 0;
  }
  const speed = mode === 'pursue' ? MARSHAL.pursue : mode === 'patrol' ? MARSHAL.walk : 0;
  return { state: { mode, timer, lost }, speed, event };
}

export function snipMarshal(s) { return { ...s, mode: 'cool', timer: MARSHAL.snipCool, lost: 0 }; }

/* ---- The Development (`clear-cut`): the bulldozer -------------------------
   It clears a lane along the edge of what is left of the wood, a stretch further each pass: forward (blade first) to
   the end of this pass, a pause, then back again in reverse with its alarm going, a pause, and the next pass goes
   further. It waits, engine idling, until somebody is in the room. Whatever its blade or its back end meets takes a
   knock (the room decides; it is slow, loud and lit, so it is never a surprise). Pull the emergency stop on its back
   (the room says when somebody is close enough behind it) and it stops for good. Pure. */
export const DOZER = Object.freeze({ speed: 1.05, pause: 1.4, passes: 3 });

/** x0: where it starts (reverse end); ends: where each pass's forward run stops, nearest first. */
export function makeDozer(x0, ends) { return { mode: 'idle', x: x0, x0, ends: ends.slice(), pass: 0, timer: 0 }; }

/** sense: { inside, shutoff (the stop was pulled this moment) } → { state, dir (+1 forward, -1 reverse, 0 still), beep, started, stopped, turned } */
export function stepDozer(s, dt, sense = {}) {
  let { mode, x, pass, timer } = s;
  let dir = 0, beep = false, started = false, stopped = false, turned = false;
  if (mode === 'stopped') return { state: s, dir: 0, beep, started, stopped, turned };
  if (sense.shutoff) return { state: { ...s, mode: 'stopped' }, dir: 0, beep, started, stopped: true, turned };
  const end = s.ends[Math.min(pass, s.ends.length - 1)];
  if (mode === 'idle') { if (sense.inside) { mode = 'forward'; started = true; } }
  else if (mode === 'forward') {
    dir = 1; x = Math.min(end, x + DOZER.speed * dt);
    if (x >= end) { mode = 'pauseF'; timer = DOZER.pause; turned = true; }
  } else if (mode === 'pauseF') {
    timer -= dt; if (timer <= 0) mode = 'reverse';
  } else if (mode === 'reverse') {
    dir = -1; beep = true; x = Math.max(s.x0, x - DOZER.speed * dt);
    if (x <= s.x0) { mode = 'pauseR'; timer = DOZER.pause; pass = Math.min(pass + 1, s.ends.length - 1); turned = true; }
  } else if (mode === 'pauseR') {
    timer -= dt; if (timer <= 0) mode = 'forward';
  }
  return { state: { ...s, mode, x, pass, timer }, dir, beep, started, stopped, turned };
}

/* ---- Dynamic 4-Bank Woodland Canopy Lighting & Interactive Water Ripples ---- */

export const CANOPY_LIGHT = Object.freeze({
  slots: 6,
  minRippleGap: 0.18,
});

/**
 * The four banks of a forest room's light, `[b0, b1, b2, b3]`, at a moment of the visit's clock.
 *   - Banks `0..2` are the ceiling's tubes, and they hold still: each mode has its own fixed levels, so a room has
 *     bright bays and dull ones, and they stay where they are. (They used to swell and fade on a ten-second sway, in
 *     every room, all the time. The owner, on playing it: "the lighting and fog effects need work"; the review,
 *     `docs/FOREST-REVIEW.md` §2: a tube does not do that, and it hid the one tube that is meant to be failing.)
 *   - Bank `3` is whatever the room lights itself with, and only that moves, where it is a thing that moves: a fire
 *     (`ember`), a screen under water (`swamp`), a machine's lamps (`clearcut`), a slow glow (`islands`). A lantern
 *     (`canopy`) is steady.
 * `steady` (the accessibility setting) holds bank 3 as well. A creature's blackout or flash (`effect !== 1`) owns the
 * ceiling untouched.
 */
const CEILING = Object.freeze({
  ember: [0.76, 0.22, 0.68, 0.92],
  swamp: [0.78, 0.34, 0.72, 0.95],
  islands: [0.95, 0.16, 0.42, 0.85],
  clearcut: [0.96, 0.88, 0.34, 0.90],
  canopy: [0.92, 0.68, 0.82, 0.85],
});
export function stepCanopyBanks(mode = 'canopy', time = 0, { steady = false, effect = 1, seed = 0 } = {}) {
  if (effect !== 1) return [1, 1, 1, 0];
  const [b0, b1, b2, own] = CEILING[mode] || CEILING.canopy;
  if (steady || mode === 'canopy' || !CEILING[mode]) return [b0, b1, b2, own];
  const t = time + (seed % 97) * 0.13;
  let b3 = own;
  if (mode === 'ember') b3 = clamp(0.86 + 0.26 * Math.sin(t * 6.8) + 0.14 * Math.cos(t * 11.3 + 0.8), 0.45, 1.32);
  else if (mode === 'swamp') b3 = clamp(0.88 + 0.18 * Math.sin(t * 2.4) + (Math.sin(t * 17.0) > 0.92 ? -0.28 : 0), 0.42, 1.22);
  else if (mode === 'islands') b3 = clamp(0.84 + 0.16 * Math.sin(t * 1.35), 0.6, 1.15);
  else if (mode === 'clearcut') b3 = clamp(0.85 + 0.22 * Math.sin(t * 3.2), 0.55, 1.20);
  return [b0, b1, b2, b3];
}

/** Ring buffer of up to 6 expanding `[x, z, startTime, strength]` water ripples for `forest-fx.js`. */
export function makeRippleState(slots = CANOPY_LIGHT.slots) {
  return {
    cursor: 0,
    lastStepAt: -99,
    ripples: Array.from({ length: slots }, () => [0, 0, -99, 0]),
  };
}

export function pushWaterRipple(state, x, z, time, strength = 1.0) {
  const idx = state.cursor % state.ripples.length;
  const ripples = state.ripples.map((r, i) => (i === idx ? [x, z, time, clamp(strength, 0.15, 1.6)] : r));
  return {
    ...state,
    cursor: (idx + 1) % ripples.length,
    ripples,
  };
}

/* ---- The Cathedral Stand (`old-growth`): The Timber Auditor ---------------
   A mossy, barcoded hemlock trunk with a clipboard polypore shelf that steps
   through the 70-tree labyrinth ONLY when neither your eyes nor your beam are
   on it. Brushing a hanging ID-lanyard chime draws it at hurry speed; holding
   sight or torch beam freezes it back into an ordinary trunk. Pure. */

export const AUDITOR = Object.freeze({
  walkSpeed: 1.75,
  chimeSpeed: 2.55,
  darkBoost: 1.25,
  reach: 0.74,
  coolTime: 4.2,
  snipCool: 3.5,
  lureTime: 5.5,
  hurt: 1,
});

export function makeAuditor(homeX = 0, homeZ = 0) {
  return {
    mode: 'mimic', // 'mimic' | 'stalk' | 'lured' | 'cool'
    homeX,
    homeZ,
    goalX: homeX,
    goalZ: homeZ,
    timer: 0,
    creaked: false,
  };
}

/**
 * `sense`: { inside, px, pz, ax, az, watched, inBeam, chimePos: { x, z } | null, bankLevel }
 */
export function stepAuditor(s, dt, sense = {}) {
  const next = { ...s };
  let speed = 0, event = null;
  if (!(dt > 0)) return { state: next, speed, event };

  if (sense.chimePos) {
    next.goalX = sense.chimePos.x;
    next.goalZ = sense.chimePos.z;
    if (next.mode !== 'cool') {
      next.mode = 'lured';
      next.timer = AUDITOR.lureTime;
    }
  }

  if (next.mode === 'cool') {
    next.timer = Math.max(0, next.timer - dt);
    if (next.timer <= 0) next.mode = 'mimic';
    return { state: next, speed: 0, event: null };
  }

  // Being looked at OR lit by the torch beam locks the Auditor into a motionless tree trunk!
  if (!sense.inside || sense.watched || sense.inBeam) {
    if (next.mode === 'stalk') next.mode = 'mimic';
    return { state: next, speed: 0, event: null };
  }

  const distPlayer = Math.hypot((sense.px || 0) - (sense.ax || 0), (sense.pz || 0) - (sense.az || 0));
  const darkMul = (sense.bankLevel ?? 1) < 0.55 ? AUDITOR.darkBoost : 1.0;

  if (next.mode === 'lured') {
    next.timer -= dt;
    const distGoal = Math.hypot(next.goalX - (sense.ax || 0), next.goalZ - (sense.az || 0));
    if (next.timer <= 0 || distGoal < 0.45) {
      next.mode = 'mimic';
    } else {
      speed = AUDITOR.chimeSpeed * darkMul;
    }
  } else {
    if (next.mode === 'mimic') {
      next.mode = 'stalk';
      event = 'creak';
    }
    next.goalX = sense.px || 0;
    next.goalZ = sense.pz || 0;
    if (distPlayer <= AUDITOR.reach) {
      next.mode = 'cool';
      next.timer = AUDITOR.coolTime;
      event = 'struck';
      speed = 0;
    } else {
      speed = AUDITOR.walkSpeed * darkMul;
    }
  }

  return { state: next, speed, event };
}

export function snipAuditor(s) {
  return { ...s, mode: 'cool', timer: AUDITOR.snipCool };
}

/* ---- The Sapling Archive (`nursery-aisles`): Blinking Eye-Scar Birches -----
   Slender white paper-birch trunks whose black lenticel bark-scars open into
   wet amber eyes. Walking upright within `2.1 m` of an open eye-stem builds a
   whispering static glare (`0.75 s` tell -> `10%` camcorder drain). Crouching
   (`C`) stays below eye-scar level, and a flashlight beam shuts an eye for 5 s! */

export const EYEBIRCH = Object.freeze({
  sightRadius: 2.15,
  windup: 0.75,
  shutTime: 5.0,
  cooldown: 3.4,
  drainShare: 0.10,
});

export function makeEyeGrove(count = 6) {
  return {
    shut: Array(count).fill(0),
    charge: 0,
    cooldown: 0,
  };
}

/**
 * `sense`: { inside, crouch, dists: number[], litMask: boolean[] }
 */
export function stepEyeGrove(s, dt, sense = {}) {
  const shut = s.shut.map((t, i) => (sense.litMask?.[i] ? EYEBIRCH.shutTime : Math.max(0, t - dt)));
  let cooldown = Math.max(0, s.cooldown - dt);
  let charge = s.charge;
  let whispered = false, drained = 0, blinkedShut = false;

  if (sense.litMask?.some((lit, i) => lit && s.shut[i] <= 0.05)) blinkedShut = true;

  const exposed = !!sense.inside && !sense.crouch && cooldown <= 0 && (sense.dists || []).some((d, i) => shut[i] <= 0 && d <= EYEBIRCH.sightRadius);
  if (exposed) {
    const prev = charge;
    charge += dt;
    if (prev <= 0.08 && charge > 0.08) whispered = true;
    if (charge >= EYEBIRCH.windup) {
      charge = 0;
      cooldown = EYEBIRCH.cooldown;
      drained = EYEBIRCH.drainShare;
    }
  } else {
    charge = Math.max(0, charge - dt * 2.0);
  }

  return { state: { shut, charge, cooldown }, whispered, drained, blinkedShut };
}



/* ---- Lights Out (`lights-out`): the tent beside you goes dark ---------------------------------------------- */

/** reach: how near a tent's middle somebody is for it to be the dark one (m) · off, on: seconds to go out and to come back · pool: its light on the carpet */
export const LIGHTS_OUT = Object.freeze({ reach: 3.4, off: 0.12, on: 1.6, pool: 0.34 });

/**
 * Which tent is dark: the nearest one within reach of (x, z), or -1 with nobody near any. One at a time, always, so a
 * visitor between two tents has one of them lit. Pure. `tents`: [{ x, z }].
 */
export function nearestTent(tents, x, z, reach = LIGHTS_OUT.reach) {
  let best = -1, bd = reach;
  for (let i = 0; i < tents.length; i++) {
    const d = Math.hypot(tents[i].x - x, tents[i].z - z);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
