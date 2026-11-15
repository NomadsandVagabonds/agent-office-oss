// The Backrooms — the waste toner's rule. Pure: no three.js, no DOM.
//
// Sonar hears upright movement; standing still or crouching avoids waking it.
// Once alert it stalks the room perimeter, climbing walls and crossing ceilings,
// then pauses for an audible wind-up before a committed flying leap. Most leaps
// aim wide; even accurate ones keep their original aim and can be dodged.
// Crawling contact never damages the visitor. A miss retreats; a landed bite
// leaves a long recovery before it can attack again. Two landed bites still
// dissolve it into the existing brooding puddle and territorial hatchlings.
export const TONER = Object.freeze({
  tall: 0.5,                       // low enough for 0.8 m crawl doorways, partition holes, and 0.95 m crawl tunnels
  r: 0.2,
  opens: false,                    // four claws, no hands: a shut door stops it cold
  crawls: true,                    // …and it goes into the crawl spaces, which nothing else that walks does (walk.js `shy`)
  hitDamage: 1,                    // 1 heart per attack
  maxHits: 2,                      // full after dealing 2 total damage: dissolves into a brooding slime pool
  touch: 0.72,                     // bite reach while on the floor
  prowlSpeed: 1.5,                 // creeping upside down across the ceiling grid
  chaseSpeed: 2.3,                // wall stalking; flying leaps use their own fixed duration
  stalkTime: 4.5,                  // wall circuits before another jump can begin
  windupTime: 0.95,                // stationary audible tell; aim locks at its start
  lungeTime: 0.8,
  lungeRange: 6,
  aimChance: 0.25,                 // accurate aim, not guaranteed damage: movement still dodges it
  missWidth: 2.2,
  packGrace: 12,                   // no other toner can chain a hit during this recovery
  weaveAmp: 1.08,                  // metres of lateral zig-zag either side of its line
  weaveFreq: 5.8,                  // rad/s base lateral weave frequency
  glitchEvery: Object.freeze([0.28, 0.68]),   // seconds between sporadic phase-jumps during a chase
  pingEvery: Object.freeze([1.85 / 0.7, 2.65 / 0.7]),     // seconds between calm ceiling sonar clicks
  warnEvery: 0.22 / 0.7,                 // seconds between frantic warning clicks while locking on
  chasePingEvery: 0.34 / 0.7,            // seconds between sonar clicks during active pursuit
  listenFar: 11,                   // metres within which upright movement is heard
  dropFar: 7.5,                    // metres within which full lock-on drops it off the ceiling
  crouchSink: 0.26,                // me.sink (from holding C or ducking in a crawlway) that keeps you below its sonar
  quietSpeed: 0.28,                // m/s below which standing counts as silent
  sprintSpeed: 2.55,               // m/s above which sprinting locks its sonar almost at once
  fuseWalk: 1.4,                  // seconds of upright walking in earshot before it drops (long enough to freeze or press C)
  fuseSprint: 0.75,                // seconds of upright sprinting in drop range before it drops
  perchStay: Object.freeze([5, 9]),           // seconds hanging under one tile before creeping to another spot
  prowlSpan: Object.freeze([6, 11]),          // seconds creeping across ceilings before perching again
  dropTime: 0.55,                  // seconds peeling off the ceiling / down a wall onto the floor
  trailMemory: 3.2,                // seconds without sight or sound before it climbs back up to the ceiling
  doorGiveUp: 2.6,                 // seconds scratching at a shut door before giving up and climbing back up
  recoilTime: Object.freeze([16, 20]),     // seconds it stays up on the ceiling ignoring you after its first bite
  emergeTime: Object.freeze([1.4, 2.2]),      // seconds newly hatched broodlings take to scramble up onto their room's ceiling
  dissolveTime: 1.15,              // seconds of glitch-melt after its second bite before becoming a floor puddle
  broodTime: 60,                   // seconds (~1 min) a gorged puddle incubates before splitting into 2–3 new toners
  broodCount: Object.freeze([2, 3]),          // how many territorial broodlings emerge from one hatched puddle
  maxPack: 7,                      // safety cap on simultaneous live toners on a single floor
  puddleRadius: 1.1,               // metres of sticky black glitch slime left behind on the carpet
  puddleSlow: 0.52,                // movement multiplier while wading through a live slime puddle
  spentSlow: 0.78,                 // mild residual tackiness of a ruptured puddle stain after hatching
});

const between = ([a, b], rnd) => a + (b - a) * rnd();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** True when the visitor is silent to ceiling sonar: standing still, holding crouch (C), or stooped in a crawlway. */
export function isQuiet(sense = {}) {
  if ((sense.noiseScale ?? 1) <= 0) return true;
  if (!sense.moving || !(sense.speed > TONER.quietSpeed)) return true;
  return (sense.sink ?? 0) >= TONER.crouchSink;
}

/**
 * Lateral weave displacement (metres, perpendicular to travel). Combines two incommensurate
 * harmonics with sporadic sign/phase flips so its path never settles into a straight line.
 */
export function weaveOffset(s) {
  if (!s || s.mode !== 'chase') return 0;
  const p = s.weavePhase || 0, flip = s.weaveFlip || 1;
  const wave = Math.sin(p) * 0.68 + Math.sin(p * 2.37 + 1.15) * 0.32;
  return clamp(wave * flip, -1, 1) * TONER.weaveAmp;
}

/** Fixed launch endpoint. Inaccurate leaps aim sideways, never secretly cancel damage. */
export function planTonerLunge(from, target, rnd = Math.random) {
  const dx = target.x - from.x, dz = target.z - from.z, d = Math.hypot(dx, dz);
  const fx = d > .001 ? dx / d : 0, fz = d > .001 ? dz / d : 1;
  const accurate = rnd() < TONER.aimChance;
  const offset = accurate ? 0 : (rnd() < .5 ? -1 : 1) * TONER.missWidth;
  return { x: target.x - fz * offset, z: target.z + fx * offset, accurate };
}

/** Alternate corners along the room perimeter instead of pathing into the visitor. */
export function tonerWallGoal(rect, phase, flip = 1) {
  const pad = .38, corners = [
    [rect.x0 + pad, rect.z0 + pad], [rect.x1 - pad, rect.z0 + pad],
    [rect.x1 - pad, rect.z1 - pad], [rect.x0 + pad, rect.z1 - pad],
  ];
  const i = ((phase * flip) % 4 + 4) % 4;
  return { x: corners[i][0], z: corners[i][1] };
}

/**
 * Starting state for a waste toner.
 * `opt.territorial`: true for puddle-hatched brood, which stay around `opt.homeRoom` unless they hear the visitor.
 * `opt.emerging`: true right as a broodling crawls out of the puddle and climbs up to the ceiling.
 */
export function perched(rnd = Math.random, carried = null, opt = {}) {
  const melted = carried?.mode === 'puddle' || (carried?.hits ?? 0) >= TONER.maxHits;
  const emerging = !!opt.emerging && !melted;
  return {
    mode: melted ? 'puddle' : emerging ? 'recoil' : 'perch',
    t: melted ? 0 : emerging ? between(TONER.emergeTime, rnd) : between(TONER.perchStay, rnd),
    ping: between(TONER.pingEvery, rnd) * (emerging ? 0.45 : 0.6),
    alert: 0,
    hits: melted ? TONER.maxHits : Math.max(0, carried?.hits ?? 0),
    broodLeft: melted ? TONER.broodTime : 0,
    gestation: 0,
    territorial: !!opt.territorial,
    homeRoom: opt.homeRoom ?? null,
    weavePhase: rnd() * Math.PI * 2,
    weaveFlip: rnd() < 0.5 ? -1 : 1,
    glitchT: between(TONER.glitchEvery, rnd),
    lostT: 0,
    doorT: 0,
    attackT: TONER.stalkTime,
    seekingSound: false,
    sonar: null,
    dropped: false,
    bite: false,
    gaveUp: false,
    melted: false,
    hatched: false,
    spawnCount: 0,
    glitch: emerging,
    inPuddle: false,
    slow: 1,
  };
}

/** Convenience constructor for a newly hatched territorial broodling bound to `homeRoom`. */
export function hatchedBrood(homeRoom, rnd = Math.random) {
  return perched(rnd, null, { territorial: true, homeRoom, emerging: true });
}

const clearFlags = (s) => ({
  ...s,
  sonar: null,
  dropped: false,
  bite: false,
  gaveUp: false,
  melted: false,
  hatched: false,
  spawnCount: 0,
  glitch: false,
  inPuddle: false,
  slow: 1,
});

/**
 * Advance one waste toner (or its brooding/spent puddle) by `dt` seconds.
 * @param s      previous state from perched(), hatchedBrood(), stepToner(), or strikeToner()
 * @param dt     frame delta in seconds
 * @param sense  { d, los, audible, moving, speed, sink, blockedByDoor, cannot, there, fleeingFire }
 * @param rnd    () => 0..1
 */
export function stepToner(s, dt, sense = {}, rnd = Math.random) {
  const base = clearFlags(s);
  if (!(dt > 0) || !Number.isFinite(dt)) return base;
  const d = sense.d ?? Infinity;
  const noiseScale = Math.max(0, sense.noiseScale ?? 1);
  const listenFar = TONER.listenFar * noiseScale;
  const dropFar = TONER.dropFar * noiseScale;

  // 1a. Ruptured puddle stain after hatching its brood: inert crust, never hatches again
  if (s.mode === 'spent') {
    const inside = d <= TONER.puddleRadius * 0.85;
    return { ...base, gestation: 1, inPuddle: inside, slow: inside ? TONER.spentSlow : 1 };
  }

  // 1b. Gorged puddle incubating the next 2–3 territorial broodlings (~60 s clock)
  if (s.mode === 'puddle') {
    const inside = d <= TONER.puddleRadius;
    const prevLeft = s.broodLeft ?? TONER.broodTime;
    const broodLeft = Math.max(0, prevLeft - dt);
    const gestation = clamp(1 - broodLeft / TONER.broodTime, 0, 1);
    if (broodLeft <= 0) {
      const [lo, hi] = TONER.broodCount;
      const spawnCount = lo + Math.floor(rnd() * (hi - lo + 1));
      return {
        ...base,
        mode: 'spent',
        broodLeft: 0,
        gestation: 1,
        hatched: true,
        spawnCount,
        glitch: true,
        sonar: 'drop',
        inPuddle: inside,
        slow: inside ? TONER.spentSlow : 1,
      };
    }
    // Audible warning stirrings in the final 12 seconds before the puddle splits
    let ping = (s.ping ?? 1.2) - dt, sonar = null;
    if (gestation > 0.8 && ping <= 0) {
      sonar = 'ping';
      ping = 0.45 + (1 - gestation) * 3.5;
    }
    return {
      ...base,
      broodLeft,
      gestation,
      ping,
      sonar,
      glitch: gestation > 0.75 && rnd() < dt * 6,
      inPuddle: inside,
      slow: inside ? TONER.puddleSlow : 1,
    };
  }

  // 2. Dissolving after landing its 2nd bite -> starts the 60 s brood clock
  if (s.mode === 'dissolving') {
    const t = s.t - dt;
    if (t <= 0) {
      const inside = d <= TONER.puddleRadius;
      return {
        ...base,
        mode: 'puddle',
        t: 0,
        broodLeft: TONER.broodTime,
        gestation: 0,
        ping: 1.1,
        melted: true,
        glitch: true,
        inPuddle: inside,
        slow: inside ? TONER.puddleSlow : 1,
      };
    }
    return { ...base, t, glitch: true };
  }

  // 3. Backing away from a fire overrides hunting or biting
  if (sense.fleeingFire) {
    if (s.mode === 'windup' || s.mode === 'lunge') return strikeToner(base, {}, rnd);
    return { ...base, alert: 0, seekingSound: false, glitch: rnd() < dt * 8 };
  }

  // A jump commits to its aim. Fire, a door, or pack recovery cancels it safely.
  if (s.mode === 'windup' || s.mode === 'lunge') {
    const quiet = isQuiet(sense);
    if (s.mode === 'windup' && quiet) return { ...base, mode: 'chase',
      t: 0, attackT: TONER.stalkTime, alert: 0, lostT: 0, sonar: null };
    const blocked = sense.blockedByDoor || sense.cannot || sense.attackBlocked;
    const t = s.t - dt;
    if (blocked || (s.mode === 'lunge' && t <= 0)) return strikeToner(base, {}, rnd);
    if (s.mode === 'windup') return { ...base, mode: t <= 0 ? 'lunge' : 'windup',
      t: t <= 0 ? TONER.lungeTime : t, ping: (s.ping ?? 0) <= dt ? TONER.warnEvery : s.ping-dt, sonar: t <= 0 ? 'drop' : (s.ping ?? 0) <= dt ? 'warn' : null };
    return { ...base, t, bite: !quiet && d <= TONER.touch && !!sense.los && sense.inReach !== false };
  }

  // 4. Post-bite ceiling cooldown (or broodling emerging up onto the ceiling)
  if (s.mode === 'recoil') {
    const t = s.t - dt, ping = s.ping - dt;
    const firePing = ping <= 0;
    if (t <= 0) {
      return {
        ...base,
        mode: s.territorial ? 'perch' : 'prowl',
        t: between(s.territorial ? TONER.perchStay : TONER.prowlSpan, rnd),
        ping: firePing ? between(TONER.pingEvery, rnd) : ping,
        sonar: firePing ? 'ping' : null,
      };
    }
    return {
      ...base,
      t,
      ping: firePing ? between(TONER.pingEvery, rnd) : ping,
      sonar: firePing ? 'ping' : null,
    };
  }

  // 5. Ceiling ambush & prowling: blind echolocation clicks
  if (s.mode === 'perch' || s.mode === 'prowl') {
    const quiet = isQuiet(sense);
    const heard = !quiet && !!sense.audible && d <= listenFar;
    let alert = s.alert;
    if (heard) {
      const rate = ((sense.speed ?? 0) >= TONER.sprintSpeed ? 1 / TONER.fuseSprint : 1 / TONER.fuseWalk) * noiseScale;
      const cap = d <= dropFar ? 1 : 0.86;
      alert = Math.min(cap, alert + dt * rate);
    } else {
      alert = Math.max(0, alert - dt * 1.35);
    }

    if (alert >= 1 && d <= dropFar) {
      return {
        ...base,
        mode: 'drop',
        t: TONER.dropTime,
        alert: 1,
        lostT: 0,
        doorT: 0,
        seekingSound: false,
        weavePhase: s.weavePhase + 0.9,
        weaveFlip: rnd() < 0.5 ? -1 : 1,
        sonar: 'drop',
        dropped: true,
        glitch: true,
      };
    }

    const warned = alert >= 0.22;
    let ping = s.ping - dt, sonar = null;
    if (warned && ping > TONER.warnEvery) ping = TONER.warnEvery;
    if (ping <= 0) {
      sonar = warned ? 'warn' : 'ping';
      ping = warned ? TONER.warnEvery : between(TONER.pingEvery, rnd);
    }

    let mode = s.mode, t = s.t - dt;
    const seekingSound = heard && alert >= 0.3;
    if (seekingSound && mode === 'perch') {
      mode = 'prowl';
      t = between(TONER.prowlSpan, rnd);
    } else if (!seekingSound && sense.farFromHome && !sense.cannot && !sense.blockedByDoor) {
      mode = 'prowl';
      if (t <= 0) t = between(TONER.prowlSpan, rnd);
    } else if (!seekingSound && (t <= 0 || (mode === 'prowl' && sense.there))) {
      mode = mode === 'perch' ? 'prowl' : 'perch';
      t = between(mode === 'perch' ? TONER.perchStay : TONER.prowlSpan, rnd);
    }

    return { ...base, mode, t, ping, alert, seekingSound, sonar, glitch: sonar === 'warn' };
  }

  // 6. Peeling off the ceiling / skittering down a wall onto all fours
  if (s.mode === 'drop') {
    const t = s.t - dt;
    if (t <= 0) {
      return {
        ...base,
        mode: 'chase',
        attackT: TONER.stalkTime,
        t: 0,
        ping: TONER.chasePingEvery * 0.5,
        glitchT: between(TONER.glitchEvery, rnd),
        glitch: true,
      };
    }
    return { ...base, t };
  }

  // 7. Active floor & wall chase: high-speed erratic weaving, crawl-capable, blocked by shut doors
  let weavePhase = s.weavePhase + dt * TONER.weaveFreq;
  let weaveFlip = s.weaveFlip || 1;
  let glitchT = (s.glitchT ?? 0.4) - dt;
  let glitch = false;
  if (glitchT <= 0) {
    glitch = true;
    glitchT = between(TONER.glitchEvery, rnd);
    weavePhase += 0.65 + rnd() * 0.85;
    if (rnd() < 0.65) weaveFlip = -weaveFlip;
  }

  let ping = s.ping - dt, sonar = null;
  if (ping <= 0) {
    sonar = 'chase';
    ping = TONER.chasePingEvery;
  }

  const blocked = !!sense.blockedByDoor || !!sense.cannot;
  const doorT = blocked ? (s.doorT || 0) + dt : Math.max(0, (s.doorT || 0) - dt * 2);
  if (doorT >= TONER.doorGiveUp) {
    return {
      ...base,
      mode: 'prowl',
      t: between(TONER.prowlSpan, rnd),
      ping: between(TONER.pingEvery, rnd) * 0.5,
      alert: 0,
      lostT: 0,
      doorT: 0,
      weavePhase,
      weaveFlip,
      glitchT,
      gaveUp: true,
      glitch: true,
    };
  }

  const quiet = isQuiet(sense);
  const tracked = !quiet && !!sense.audible && d <= listenFar;
  const lostT = tracked ? 0 : (s.lostT || 0) + dt;
  if (lostT >= TONER.trailMemory) {
    return {
      ...base,
      mode: 'prowl',
      t: between(TONER.prowlSpan, rnd),
      ping: between(TONER.pingEvery, rnd) * 0.6,
      alert: 0,
      lostT: 0,
      doorT: 0,
      weavePhase,
      weaveFlip,
      glitchT,
      gaveUp: true,
      glitch: true,
    };
  }

  const attackT = quiet ? TONER.stalkTime : Math.max(0, (s.attackT ?? TONER.stalkTime) - dt);
  if (!quiet && tracked && !blocked && !sense.attackBlocked && sense.los && d <= TONER.lungeRange && attackT <= 0) {
    return { ...base, mode: 'windup', t: TONER.windupTime, attackT, sonar: 'warn' };
  }
  const bite = false; // Crawling past the visitor is not an automatic contact attack.
  return {
    ...base,
    mode: 'chase',
    attackT,
    weavePhase,
    weaveFlip,
    glitchT,
    ping,
    doorT,
    lostT,
    sonar,
    bite,
    glitch,
  };
}

/**
 * Apply the outcome of `c.hurt(TONER.hitDamage)` when `s.bite` triggered.
 * First landed hit recoils to the ceiling; second landed hit fills it and starts dissolving into a brooding puddle.
 */
export function strikeToner(s, hit = {}, rnd = Math.random) {
  const base = clearFlags(s);
  if (hit.ended || hit.dead) return { ...base, survived: false, dissolving: false };
  if (!hit.landed) {
    return {
      ...base,
      mode: 'recoil',
      t: between(TONER.recoilTime, rnd) * 0.65,
      ping: between(TONER.pingEvery, rnd),
      alert: 0,
      lostT: 0,
      doorT: 0,
      glitch: true,
      survived: false,
      dissolving: false,
    };
  }
  const hits = (s.hits || 0) + 1;
  if (hits >= TONER.maxHits) {
    return {
      ...base,
      hits,
      mode: 'dissolving',
      t: TONER.dissolveTime,
      broodLeft: TONER.broodTime,
      gestation: 0,
      alert: 0,
      lostT: 0,
      doorT: 0,
      glitch: true,
      survived: true,
      dissolved: true,
      dissolving: true,
    };
  }
  return {
    ...base,
    hits,
    mode: 'recoil',
    t: between(TONER.recoilTime, rnd),
    ping: between(TONER.pingEvery, rnd),
    alert: 0,
    lostT: 0,
    doorT: 0,
    glitch: true,
    survived: true,
    dissolved: false,
    dissolving: false,
  };
}

/**
 * Apply a desperate close-quarters scissor jab (`snipToner(s, rnd)`):
 *   - Against an active hunter (`drop`, `chase`, or low `perch`/`prowl`): severs its lunge and drives it
 *     straight back up into ceiling `'recoil'` WITHOUT hurting the visitor or advancing `hits` toward a puddle.
 *   - Against a brooding `'puddle'`: ruptures the incubating slime sac early into inert `'spent'` crust
 *     so it never hatches 2–3 broodlings.
 */
export function snipToner(s, rnd = Math.random) {
  const base = clearFlags(s);
  if (s.mode === 'drop' || s.mode === 'chase' || s.mode === 'windup' || s.mode === 'lunge' || s.mode === 'perch' || s.mode === 'prowl') {
    return {
      ...base,
      mode: 'recoil',
      t: between(TONER.recoilTime, rnd),
      ping: between(TONER.pingEvery, rnd),
      alert: 0,
      lostT: 0,
      doorT: 0,
      seekingSound: false,
      glitch: true,
      repelled: true,
      ruptured: false,
    };
  }
  if (s.mode === 'puddle') {
    return {
      ...base,
      mode: 'spent',
      broodLeft: 0,
      gestation: 1,
      hatched: false,
      spawnCount: 0,
      glitch: true,
      repelled: false,
      ruptured: true,
    };
  }
  return { ...base, repelled: false, ruptured: false };
}
