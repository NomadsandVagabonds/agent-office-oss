// Pure layout, heightfield, fragile-tile, fire-shutter, and Plenum Toner rules
// for `drop-plenum` ("The Return Plenum"). No Three.js, no DOM.

export const PLENUM = Object.freeze({
  ceilY: 2.64,
  deckY: 2.68,
  wallZ: -1.8,
  breachHeadY: 0.88,
  joistHeadY: 1.32,
  fragileCollapseSec: 0.34,
  hurt: 1,
  listenRadius: 8.2,
  lockTime: 0.42,
  dropDuration: 0.38,
  prowlSpeed: 1.08,
  chaseSpeed: 3.22,
  catchRadius: 0.62,
  recoilSec: 5.5,
  searchSec: 2.6,
  weaveAmp: 0.78,
  weaveFreq: 5.4,
});

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const inRect = (r, x, z, pad = 0) =>
  x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;

/**
 * Deterministic architectural plan for a Return Plenum room of size `W × D × H`.
 * Works for all rolled set-piece dimensions (`W ∈ [14, 16], D ∈ [16, 18], H ∈ [4.7, 5.0]`).
 */
export function buildPlenumPlan(W = 15, D = 17, H = 4.85) {
  const frontLadder = Object.freeze({
    id: 'front-ladder',
    x0: -3.55, x1: -2.25,
    zTop: 1.65, zFoot: 4.05,       // climbs north (+z → -z): y = 0 at z = 4.05, y = 2.68 at z = 1.65
  });
  const northLadder = Object.freeze({
    id: 'north-ladder',
    x0: 2.15, x1: 3.45,
    zFoot: -6.25, zTop: -3.85,     // climbs south (-z → +z): y = 0 at z = -6.25, y = 2.68 at z = -3.85
  });

  const ducts = Object.freeze([
    Object.freeze({ id: 'south-cross', x0: -3.55, z0: 0.35, x1: 4.15, z1: 1.65 }),
    Object.freeze({ id: 'center-breach', x0: -0.88, z0: -3.85, x1: 0.88, z1: 0.35 }),
    Object.freeze({ id: 'north-cross', x0: 0.88, z0: -3.85, x1: 3.45, z1: -2.55 }),
  ]);

  // Water-stained bowed acoustic ceiling tiles that tempt corner-cutting off the steel ductwork
  const fragileTiles = Object.freeze([
    Object.freeze({ id: 'west-shortcut', index: 0, x0: -2.25, z0: -0.95, x1: -0.88, z1: 0.35 }),
    Object.freeze({ id: 'east-shortcut', index: 1, x0: 0.88, z0: -1.05, x1: 2.25, z1: 0.35 }),
  ]);

  // Open missing-tile drop-ceiling bays (`y = 2.64 m` grid absent here)
  const cutouts = Object.freeze([
    Object.freeze({ id: 'front-ladder-hole', x0: -3.75, z0: 1.50, x1: -2.05, z1: 3.72 }),
    Object.freeze({ id: 'crooked-troffer-hole', x0: -2.05, z0: 2.10, x1: -0.85, z1: 3.35 }),
    Object.freeze({ id: 'north-ladder-hole', x0: 1.95, z0: -5.92, x1: 3.65, z1: -3.70 }),
    Object.freeze({ id: 'infinite-well-hole', x0: -2.08, z0: -3.88, x1: -0.92, z1: -2.72 }),
    Object.freeze({ id: 'se-peek-hole', x0: 1.65, z0: 1.75, x1: 2.85, z1: 2.95 }),
    Object.freeze({ id: 'sw-peek-hole', x0: -5.40, z0: 0.30, x1: -4.20, z1: 1.50 }),
  ]);

  // Enclosed vertical abyss where drop-ceilings & tiny yellow ladders repeat downward instead of the office floor
  const infiniteWell = Object.freeze({
    x0: -2.12, z0: -3.92, x1: -0.88, z1: -2.68,
  });

  // Bidirectional non-Euclidean wraparound duct portal folding the East Return Spur directly into the North-West Trunk
  const portals = Object.freeze({
    east: Object.freeze({
      trigger: Object.freeze({ x0: 3.78, z0: 0.58, x1: 4.16, z1: 1.42 }),
      exitX: -0.32,
      exitZ: -2.42,
      dirX: 1,
      dirZ: 0,
    }),
    northWest: Object.freeze({
      trigger: Object.freeze({ x0: -0.89, z0: -2.74, x1: -0.66, z1: -2.06 }),
      exitX: 3.38,
      exitZ: 1.00,
      dirX: -1,
      dirZ: 0,
    }),
  });

  const breach = Object.freeze({
    x0: -0.80, x1: 0.80,
    z0: -2.22, z1: -1.38,
    headY: PLENUM.breachHeadY,
  });

  const shutter = Object.freeze({
    x0: -5.60, x1: -3.75,
    z: PLENUM.wallZ,
    leverX: -3.48,
    leverZ: -2.28,
  });

  const joistZs = Object.freeze([-4.95]);

  return Object.freeze({
    W, D, H,
    ceilY: PLENUM.ceilY,
    deckY: PLENUM.deckY,
    wallZ: PLENUM.wallZ,
    frontLadder,
    northLadder,
    ducts,
    fragileTiles,
    cutouts,
    infiniteWell,
    portals,
    breach,
    shutter,
    joistZs,
  });
}

/** Which fragile tile index `(0 | 1)` contains `(x, z)`, or `-1` if none / already broken. */
export function fragileTileAt(plan, brokenMask, x, z) {
  for (const t of plan.fragileTiles) {
    if ((brokenMask & (1 << t.index)) !== 0) continue;
    if (inRect(t, x, z)) return t.index;
  }
  return -1;
}

/** True when `(x, z)` sits inside a permanently missing or collapsed drop-ceiling tile bay. */
export function isCeilingOpenAt(plan, brokenMask, x, z, pad = 0) {
  for (const h of plan.cutouts) if (inRect(h, x, z, pad)) return true;
  for (const t of plan.fragileTiles) {
    if ((brokenMask & (1 << t.index)) !== 0 && inRect(t, x, z, pad)) return true;
  }
  return false;
}

/** Walkable heightfield `y` in the room's local frame. */
export function plenumFloorY(plan, brokenMask, x, z) {
  for (const d of plan.ducts) {
    if (inRect(d, x, z)) return plan.deckY;
  }
  if (fragileTileAt(plan, brokenMask, x, z) >= 0) return plan.deckY;

  const fl = plan.frontLadder;
  if (x >= fl.x0 && x <= fl.x1 && z >= fl.zTop && z <= fl.zFoot) {
    const t = clamp01((fl.zFoot - z) / (fl.zFoot - fl.zTop));
    return Math.round(plan.deckY * t * 10000) / 10000;
  }

  const nl = plan.northLadder;
  if (x >= nl.x0 && x <= nl.x1 && z >= nl.zFoot && z <= nl.zTop) {
    const t = clamp01((z - nl.zFoot) / (nl.zTop - nl.zFoot));
    return Math.round(plan.deckY * t * 10000) / 10000;
  }

  return 0;
}

/** Available standing/crawling headroom above `plenumFloorY` at `(x, z)`. */
export function plenumHeadY(plan, brokenMask, x, z) {
  const fy = plenumFloorY(plan, brokenMask, x, z);

  // On either step-ladder or inside an open ceiling cutout
  const onFrontLadder = inRect({ x0: plan.frontLadder.x0, x1: plan.frontLadder.x1, z0: plan.frontLadder.zTop, z1: plan.frontLadder.zFoot }, x, z, 0.24);
  const onNorthLadder = inRect({ x0: plan.northLadder.x0, x1: plan.northLadder.x1, z0: plan.northLadder.zFoot, z1: plan.northLadder.zTop }, x, z, 0.24);
  if (onFrontLadder || onNorthLadder) {
    if (isCeilingOpenAt(plan, brokenMask, x, z, 0.24)) return Math.max(1.85, plan.H - fy);
    return Math.max(1.85, plan.ceilY - fy);
  }

  // Up on the HVAC ductwork or intact fragile ceiling tiles
  if (fy >= plan.deckY - 0.05) {
    if (z >= plan.breach.z0 && z <= plan.breach.z1 && Math.abs(x) <= 1.05) {
      return plan.breach.headY;
    }
    for (const jz of plan.joistZs) {
      if (Math.abs(z - jz) < 0.16) return Math.min(plan.H - fy, PLENUM.joistHeadY);
    }
    return Math.max(1.5, plan.H - fy);
  }

  // Lower office floor (`y = 0`)
  if (isCeilingOpenAt(plan, brokenMask, x, z)) return plan.H;
  return plan.ceilY;
}

/** Stash zone `[x0, z0, x1, z1]`: east HVAC return spur (`+1`) or north plenum duct (`-1`). */
export function plenumStash(_r, side = 1) {
  return side > 0
    ? [2.15, 0.55, 2.95, 1.45]
    : [1.15, -3.65, 1.95, -2.75];
}

/* ---- Room interactive state: fragile tiles + non-Euclidean portal + shutter -- */

export function createPlenumRoomState() {
  return {
    brokenMask: 0,
    activeTile: -1,
    dwellSec: 0,
    shutterOpen: false,
    shutterLift: 0,            // 0 = jammed down, 1 = rolled up into header box
    portalCooldown: 0,
    folds: 0,
  };
}

export function pullShutterLever(state) {
  if (state.shutterOpen) return { state, openedNow: false };
  return {
    state: { ...state, shutterOpen: true },
    openedNow: true,
  };
}

export function stepPlenumRoom(state, plan, { dt = 0, x = 0, z = 0, onPlenum = false } = {}) {
  const safeDt = Math.max(0, dt);
  let brokenMask = state.brokenMask;
  let activeTile = state.activeTile;
  let dwellSec = state.dwellSec;
  let portalCooldown = Math.max(0, (state.portalCooldown || 0) - safeDt);
  let folds = state.folds || 0;
  let creakedTile = -1;
  let collapsedTile = -1;
  let warpedTo = null;

  const idx = onPlenum ? fragileTileAt(plan, brokenMask, x, z) : -1;
  if (idx >= 0) {
    if (activeTile !== idx) {
      activeTile = idx;
      dwellSec = safeDt;
      creakedTile = idx;
    } else {
      dwellSec += safeDt;
    }
    if (dwellSec >= PLENUM.fragileCollapseSec) {
      brokenMask |= (1 << idx);
      collapsedTile = idx;
      activeTile = -1;
      dwellSec = 0;
    }
  } else {
    activeTile = -1;
    dwellSec = Math.max(0, dwellSec - safeDt * 2.5);
  }

  if (onPlenum && portalCooldown <= 0 && plan.portals) {
    if (inRect(plan.portals.east.trigger, x, z)) {
      const e = plan.portals.east;
      warpedTo = { x: e.exitX, z: e.exitZ, dirX: e.dirX, dirZ: e.dirZ };
      portalCooldown = 1.25;
      folds += 1;
    } else if (inRect(plan.portals.northWest.trigger, x, z)) {
      const nw = plan.portals.northWest;
      warpedTo = { x: nw.exitX, z: nw.exitZ, dirX: nw.dirX, dirZ: nw.dirZ };
      portalCooldown = 1.25;
      folds += 1;
    }
  }

  const targetLift = state.shutterOpen ? 1 : 0;
  const shutterLift = state.shutterLift + (targetLift - state.shutterLift) * Math.min(1, safeDt * 3.4);

  return {
    state: {
      brokenMask,
      activeTile,
      dwellSec,
      shutterOpen: state.shutterOpen,
      shutterLift: Math.abs(targetLift - shutterLift) < 0.002 ? targetLift : shutterLift,
      portalCooldown,
      folds,
    },
    creakedTile,
    collapsedTile,
    warpedTo,
  };
}

/* ---- Plenum Toner state machine (echolocation slab ambush + weave + snip) ---- */

export function createPlenumTonerState(index = 0) {
  return {
    phase: 'perched',          // 'perched' | 'alert' | 'dropping' | 'chasing' | 'recoil'
    alert: 0,
    dropT: 0,
    recoilT: 0,
    searchT: 0,
    weavePhase: index * 2.1,
    clickT: 0.45 + index * 0.35,
  };
}

export function plenumWeaveOffset(weavePhase, speed = PLENUM.chaseSpeed) {
  if (speed <= 0.05) return 0;
  return (Math.sin(weavePhase) * 0.68 + Math.sin(weavePhase * 2.37 + 1.1) * 0.32) * PLENUM.weaveAmp;
}

export function snipPlenumToner(state) {
  if (state.phase !== 'dropping' && state.phase !== 'chasing') return state;
  return {
    ...state,
    phase: 'recoil',
    alert: 0,
    dropT: 0,
    recoilT: PLENUM.recoilSec,
    searchT: 0,
    clickT: 0.5,
  };
}

export function releasePlenumToner(state) {
  return {
    ...state,
    phase: 'recoil',
    alert: 0,
    dropT: 0,
    recoilT: PLENUM.recoilSec * 0.85,
    searchT: 0,
    clickT: 0.7,
  };
}

/**
 * Advance one Plenum Toner by `dt` seconds.
 * - While the visitor crouches (`quiet: true`) or stands still, biosonar passes harmlessly overhead.
 * - Upright clanking on galvanized ductwork (`audible: true`) or crashing through a ceiling tile (`loudCrash: true`)
 *   accelerates its sonar clicks into a drop & erratic weave chase along the plenum.
 * - Lit paper (`fleeingFire: true`) or Safety Scissors (`snipPlenumToner`) drives it back up onto the concrete slab.
 */
export function stepPlenumToner(state, {
  dt = 0,
  dist = 99,
  onPlenum = false,
  audible = false,
  quiet = false,
  loudCrash = false,
  clearLine = false,
  fleeingFire = false,
} = {}) {
  const s = { ...state };
  const safeDt = Math.max(0, dt);
  let sonar = false, rattle = false, droppedNow = false, caught = false;

  if (fleeingFire && (s.phase === 'alert' || s.phase === 'dropping' || s.phase === 'chasing')) {
    s.phase = 'recoil';
    s.recoilT = Math.max(s.recoilT, 3.6);
    s.alert = 0;
    rattle = true;
  }

  const heard = !fleeingFire && (
    (loudCrash && dist < PLENUM.listenRadius * 1.25) ||
    (onPlenum && audible && !quiet && dist < PLENUM.listenRadius)
  );

  s.clickT -= safeDt;

  if (s.phase === 'recoil') {
    s.recoilT = Math.max(0, s.recoilT - safeDt);
    s.weavePhase += safeDt * 7.5;
    if (s.recoilT <= 0) {
      s.phase = 'perched';
      s.clickT = 0.8;
    }
    return { state: s, speed: 0, slabK: clamp01(1 - s.recoilT / PLENUM.recoilSec * 0.35), sonar, rattle, droppedNow, caught };
  }

  if (s.phase === 'perched') {
    if (s.clickT <= 0) {
      s.clickT = 1.45;
      if (dist < PLENUM.listenRadius * 1.45) sonar = true;
    }
    if (heard) {
      s.phase = 'alert';
      s.alert = loudCrash ? PLENUM.lockTime : Math.min(PLENUM.lockTime, safeDt * 1.4);
      s.clickT = 0.16;
      rattle = true;
    }
    return { state: s, speed: 0, slabK: 1, sonar, rattle, droppedNow, caught };
  }

  if (s.phase === 'alert') {
    if (heard) {
      s.alert += safeDt * (dist < 4.2 ? 1.55 : 1.1);
      if (s.clickT <= 0) { s.clickT = 0.22; sonar = true; }
      if (s.alert >= PLENUM.lockTime) {
        s.phase = 'dropping';
        s.dropT = 0;
        rattle = true;
        droppedNow = true;
      }
    } else {
      s.alert = Math.max(0, s.alert - safeDt * 0.9);
      if (s.alert <= 0) s.phase = 'perched';
    }
    return { state: s, speed: 0, slabK: 1, sonar, rattle, droppedNow, caught };
  }

  if (s.phase === 'dropping') {
    s.dropT += safeDt;
    s.weavePhase += safeDt * PLENUM.weaveFreq;
    const k = clamp01(s.dropT / PLENUM.dropDuration);
    if (s.dropT >= PLENUM.dropDuration) {
      s.phase = 'chasing';
      s.searchT = PLENUM.searchSec;
    }
    return { state: s, speed: PLENUM.prowlSpeed * 0.5, slabK: 1 - k, sonar, rattle, droppedNow, caught };
  }

  // s.phase === 'chasing'
  s.weavePhase += safeDt * PLENUM.weaveFreq;
  if (s.clickT <= 0) {
    s.clickT = 0.38;
    sonar = true;
  }

  if (onPlenum && (heard || (clearLine && !quiet && dist < 5.4) || dist < 1.85)) {
    s.searchT = PLENUM.searchSec;
  } else {
    s.searchT = Math.max(0, s.searchT - safeDt * (onPlenum ? 1.0 : 1.8));
  }

  if (onPlenum && dist <= PLENUM.catchRadius) {
    caught = true;
    return { state: s, speed: 0, slabK: 0, sonar, rattle: true, droppedNow, caught };
  }

  if (s.searchT <= 0) {
    s.phase = 'recoil';
    s.recoilT = 1.6;
    return { state: s, speed: 0, slabK: 0.4, sonar, rattle, droppedNow, caught };
  }

  const speed = (!onPlenum || quiet) ? PLENUM.prowlSpeed * 1.25 : PLENUM.chaseSpeed;
  return { state: s, speed, slabK: 0, sonar, rattle, droppedNow, caught };
}
