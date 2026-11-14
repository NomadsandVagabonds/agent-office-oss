// Night Shift — a small, monochrome office escape. Pure, JSON-safe game rules.
// Units are metres and seconds. x/y is the side-on play plane; y is feet height.
// Desks provide cover in a second depth lane; paper boxes are solid platforms.
// Light geometry and detection share rayToCover(), so visible shadow is safe.
//
// The long game (core/game.mjs) hides a keycard and two coins on this floor.
// The keycard is the access card in Records, the one you came back for: it is
// the office's once you have clocked out with it. The coins hang where it costs
// something to reach them, and are kept the moment they are touched. The state
// carries `left` (what the floor still has to give — createGame() is told) and
// `took` (what this visit has earned, for the caller to hand to the office).

const freeze = (items) => Object.freeze(items.map((item) => Object.freeze(item)));
export const PLAYER = Object.freeze({
  radius: 0.21, height: 1.2, crouchHeight: 0.8, speed: 2.8, crouchSpeed: 1.45,
  jumpSpeed: 6.1, gravity: 18, captureSeconds: 1.1, recoverySeconds: 0.85,
});
/** A coin is a disc this big, hanging with its middle at (x, y). */
export const COIN = Object.freeze({ radius: 0.2 });
export const LEVEL = Object.freeze({
  bounds: Object.freeze({ x0: 0, x1: 46 }), startX: 2, exitX: 44,
  keycardX: 20, breakerX: 33, gateX: 39.2,
  checkpoints: Object.freeze([2, 17, 29, 40.5]),
  covers: freeze([
    { id: 'reception', x: 7.4, w: 2.8, h: 0.95 },
    { id: 'sales', x: 12.6, w: 3.2, h: 0.95 },
    { id: 'records', x: 20, w: 2.8, h: 0.95 },
    { id: 'accounts', x: 25, w: 2.8, h: 0.95 },
    { id: 'executive', x: 31.2, w: 2.8, h: 0.95 },
    { id: 'final-desk', x: 35.8, w: 2.8, h: 0.95 },
  ]),
  obstacles: freeze([
    { id: 'paper-boxes', x: 15.25, w: 0.85, h: 0.48 },
    { id: 'archive-boxes', x: 27.8, w: 0.9, h: 0.62 },
  ]),
  lights: freeze([
    { id: 'reception', x: 10, y: 4.7, range: 3.8, sweep: 3.1, period: 7.8, rest: 3.2, phase: -0.9, disabledByBreaker: false },
    { id: 'archives', x: 23.5, y: 4.7, range: 3.7, sweep: 2.9, period: 8.6, rest: 3.2, phase: 1.4, disabledByBreaker: false },
    { id: 'executive', x: 35.5, y: 4.7, range: 4.1, sweep: 2.8, period: 6.9, rest: 3.2, phase: 0.2, disabledByBreaker: true },
  ]),
  // `n` is the number the office keeps its record by (core/game.mjs: this floor hides two).
  coins: freeze([
    // In the first gap between desks, right under the first lamp, too high to walk into:
    // you stand up where the beam sweeps and jump for it.
    { n: 1, x: 9.9, y: 1.9 },
    // Above the archive boxes, out of a jump's reach from the floor: up onto the stack first,
    // in the open, where the second lamp looks at the start of every scan.
    { n: 2, x: 27.8, y: 2.62 },
  ]),
});

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const EPSILON = 1e-7;
const OCCLUDERS = [...LEVEL.covers, ...LEVEL.obstacles];
const COINS = new Map(LEVEL.coins.map((coin) => [coin.n, coin]));

/**
 * A fresh shift. `left` is what the floor still hides — { card, coins: [n, …] },
 * as office.game.left('nightshift') gives it. With nothing said (no long game,
 * a test) the floor hides nothing, and plays exactly the same.
 */
export function createGame(left) {
  const coins = Array.isArray(left?.coins) ? left.coins : [];
  return {
    x: LEVEL.startX, y: 0, vx: 0, vy: 0, facing: 1, grounded: true, crouching: false,
    time: 0, stage: 'playing', exposure: 0, lit: false, cover: null,
    keycard: false, breaker: false, checkpoint: LEVEL.startX, deaths: 0,
    caughtUntil: null, graceUntil: 1.2, finishedAt: null,
    jumpHeld: false, interactHeld: false, event: null,
    left: { card: !!left?.card, coins: LEVEL.coins.map((coin) => coin.n).filter((n) => coins.includes(n)) },
    took: { card: false, coins: [] },
    message: 'Clock out quietly. The security lights did not get the memo.',
  };
}

/**
 * Start the shift again. What has been taken stays taken: the new shift is
 * given only what was still left on the floor.
 */
export function restart(previous) {
  return createGame(previous?.left);
}

/**
 * Triangle apex (x,y), with its illuminated floor interval [left,right].
 * Every scan ends with a visible recalibration blackout: even a slow crouched
 * crossing has a real opening, rather than requiring the exposure grace period.
 * The renderer uses these exact active/resting flags and countdowns.
 */
export function lightBeams(state) {
  return LEVEL.lights.map((lamp) => {
    const center = lamp.x + Math.sin(state.time * Math.PI * 2 / lamp.period + lamp.phase) * lamp.sweep;
    const cycle = ((state.time % lamp.period) + lamp.period) % lamp.period;
    const powered = !(lamp.disabledByBreaker && state.breaker);
    const resting = powered && cycle >= lamp.period - lamp.rest;
    const active = powered && !resting;
    return { ...lamp, left: center - lamp.range, right: center + lamp.range,
      active, resting, restRemaining: resting ? lamp.period - cycle : 0,
      scanRemaining: active ? lamp.period - lamp.rest - cycle : 0 };
  });
}

// First intersection of a finite ray with an axis-aligned occluder rectangle.
function boxHit(ax, ay, bx, by, box) {
  let enter = 0, leave = 1;
  for (const [start, delta, low, high] of [[ax, bx - ax, box.x - box.w / 2, box.x + box.w / 2], [ay, by - ay, 0, box.h]]) {
    if (Math.abs(delta) < EPSILON) { if (start < low || start > high) return null; }
    else {
      const a = (low - start) / delta, b = (high - start) / delta;
      enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return null;
    }
  }
  return enter <= 1 && leave >= 0 ? Math.max(0, enter) : null;
}

/** Clip a segment against the same desks/boxes that protect the player. */
export function rayToCover(ax, ay, bx, by) {
  let t = 1, cover = null;
  for (const box of OCCLUDERS) {
    const hit = boxHit(ax, ay, bx, by, box);
    if (hit !== null && hit < t) { t = hit; cover = box.id; }
  }
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, t, cover };
}

/** Fan polygon: apex first, then left-to-right clipped rays. No duplicate end. */
export function beamPolygon(state, beam, rays = 64) {
  if (!beam.active) return [];
  const n = clamp(Math.floor(Number.isFinite(rays) ? rays : 64), 2, 256);
  const points = [[beam.x, beam.y]];
  for (let i = 0; i <= n; i++) {
    const x = beam.left + (beam.right - beam.left) * i / n;
    const hit = rayToCover(beam.x, beam.y, x, 0);
    points.push([hit.x, hit.y]);
  }
  return points;
}

function pointLit(x, y, beam) {
  if (!beam.active || y < 0 || y > beam.y) return false;
  const along = 1 - y / beam.y;
  const left = beam.x + (beam.left - beam.x) * along;
  const right = beam.x + (beam.right - beam.x) * along;
  if (x < left || x > right) return false;
  return rayToCover(beam.x, beam.y, x, y).t >= 1 - EPSILON;
}

/** Head and torso exposure; hiding your feet alone does not count. */
export function isLit(state) {
  const height = state.crouching ? PLAYER.crouchHeight : PLAYER.height;
  return lightBeams(state).some((beam) => [0.92, 0.5].some((fraction) => pointLit(state.x, state.y + height * fraction, beam)));
}

export function objective(state) {
  if (state.stage === 'won') return 'You clocked out. The office is still working.';
  if (state.stage === 'caught') return 'The lights noticed. Back to the last dark corner.';
  if (!state.keycard) return 'Find the night-shift keycard in Records.';
  if (!state.breaker) return 'Use the keycard at the security breaker.';
  return 'The last lights are out. Take the service elevator home.';
}

/**
 * What is within reach: { id, label, locked }. `label` is only the name of the
 * thing (the level kit's chip puts the key in front of it); `locked` says it
 * will not answer yet. Once you have clocked out, what is left is the lift.
 */
export function interactable(state) {
  if (state.stage === 'won') return { id: 'lift', label: 'the lift', locked: false };
  if (state.stage !== 'playing' || state.y > 0.45) return null;
  if (!state.keycard && Math.abs(state.x - LEVEL.keycardX) < 1.1) return { id: 'keycard', label: 'the staff badge', locked: false };
  if (!state.breaker && Math.abs(state.x - LEVEL.breakerX) < 1.1) return { id: 'breaker', label: 'the security breaker', locked: !state.keycard };
  if (Math.abs(state.x - LEVEL.exitX) < 1.25) return { id: 'exit', label: 'the time clock', locked: !state.breaker };
  return null;
}

function interact(state) {
  const near = interactable(state);
  if (!near) return;
  if (near.id === 'keycard') {
    state.keycard = true; state.event = 'keycard';
    state.message = 'NIGHT SHIFT. ACCESS: MOSTLY. Take this to the security breaker.';
  } else if (near.id === 'breaker') {
    if (!state.keycard) { state.event = 'locked'; state.message = 'The breaker wants a keycard. Records has one.'; return; }
    state.breaker = true; state.event = 'breaker'; state.message = 'Security power cut. The last elevator is yours.';
  } else if (near.id === 'exit' && state.breaker) {
    state.stage = 'won'; state.finishedAt = state.time; state.vx = 0; state.vy = 0;
    state.event = 'win'; state.message = 'SHIFT COMPLETE. Please do not reply all.';
    // Clocking out is what makes the badge yours to keep — once: a card found on an earlier visit is not found again.
    if (state.left.card) { state.left = { ...state.left, card: false }; state.took = { ...state.took, card: true }; }
  }
}

/** Touching a coin takes it, there and then. Nothing afterwards — a catch, a restart — gives it back. */
function pocket(state) {
  const top = state.y + (state.crouching ? PLAYER.crouchHeight : PLAYER.height);
  for (const n of state.left.coins) {
    const coin = COINS.get(n);
    const dx = Math.max(Math.abs(state.x - coin.x) - PLAYER.radius, 0);
    const dy = Math.max(state.y - coin.y, coin.y - top, 0);
    if (dx * dx + dy * dy > COIN.radius ** 2) continue;
    state.left = { ...state.left, coins: state.left.coins.filter((k) => k !== n) };
    state.took = { ...state.took, coins: [...state.took.coins, n] };
    state.event = 'coin';
  }
}

function move(state, axis, dt) {
  state.vx = axis * (state.crouching ? PLAYER.crouchSpeed : PLAYER.speed);
  if (axis) state.facing = axis > 0 ? 1 : -1;
  let x = clamp(state.x + state.vx * dt, LEVEL.bounds.x0 + PLAYER.radius, LEVEL.bounds.x1 - PLAYER.radius);
  const solids = state.breaker ? LEVEL.obstacles : [...LEVEL.obstacles, { x: LEVEL.gateX, w: 0.16, h: 4.8 }];
  for (const box of solids) {
    const left = box.x - box.w / 2, right = box.x + box.w / 2;
    if (state.y >= box.h - EPSILON || x + PLAYER.radius <= left || x - PLAYER.radius >= right) continue;
    if (state.vx > 0) x = left - PLAYER.radius;
    else if (state.vx < 0) x = right + PLAYER.radius;
  }
  state.x = x;
  state.vy -= PLAYER.gravity * dt;
  let y = state.y + state.vy * dt;
  let ground = 0;
  for (const box of LEVEL.obstacles) {
    if (state.x + PLAYER.radius > box.x - box.w / 2 && state.x - PLAYER.radius < box.x + box.w / 2
      && state.y >= box.h - EPSILON && y <= box.h) ground = Math.max(ground, box.h);
  }
  state.grounded = y <= ground && state.vy <= 0;
  if (state.grounded) { y = ground; state.vy = 0; }
  state.y = Math.max(0, y);
}

function tick(state, axis, dt) {
  state.time += dt;
  if (state.stage === 'caught') {
    if (state.time + EPSILON >= state.caughtUntil) {
      Object.assign(state, { x: state.checkpoint, y: 0, vx: 0, vy: 0, grounded: true,
        stage: 'playing', caughtUntil: null, exposure: 0, lit: false, graceUntil: state.time + 1.2,
        event: 'respawn', message: 'A fresh start. Stay low behind desks; cross the gaps when the beam turns.' });
    }
    return;
  }
  move(state, axis, dt);
  if (state.left.coins.length) pocket(state);
  state.cover = LEVEL.covers.find((cover) => state.x > cover.x - cover.w / 2 && state.x < cover.x + cover.w / 2 && state.y < cover.h)?.id || null;
  state.lit = isLit(state);
  if (state.time > state.graceUntil) {
    state.exposure = clamp(state.exposure + (state.lit ? dt / PLAYER.captureSeconds : -dt * 1.4), 0, 1);
    if (state.exposure >= 1 - EPSILON) {
      Object.assign(state, { stage: 'caught', exposure: 1, caughtUntil: state.time + PLAYER.recoverySeconds,
        vx: 0, vy: 0, deaths: state.deaths + 1, event: 'caught', message: 'AFTER-HOURS PRESENCE DETECTED. Please remain unnecessarily calm.' });
      return;
    }
  }
  for (const checkpoint of LEVEL.checkpoints) {
    if (state.x >= checkpoint && checkpoint > state.checkpoint && (!state.lit || state.graceUntil > state.time)) {
      state.checkpoint = checkpoint; if (!state.event) state.event = 'checkpoint';
    }
  }
}

/**
 * Advance by dt seconds, returning a new state. jump/interact are rising-edge
 * buttons; it is safe to pass held keys. A suspended tab never advances more
 * than 250 ms in one call. Callers should skip step entirely while paused.
 */
export function step(previous, input = {}, dt = 0) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Night Shift dt must be finite and non-negative.');
  if (previous.stage === 'won') return previous;
  const state = { ...previous, event: null };
  const axis = Number.isFinite(input.axis) ? clamp(input.axis, -1, 1) : 0;
  state.crouching = !!input.crouch;
  const jump = !!input.jump && !previous.jumpHeld, use = !!input.interact && !previous.interactHeld;
  state.jumpHeld = !!input.jump; state.interactHeld = !!input.interact;
  if (state.stage === 'playing') {
    if (jump && state.grounded && !state.crouching) { state.vy = PLAYER.jumpSpeed; state.grounded = false; }
    if (use) interact(state);
  }
  if (state.stage === 'won') return state;
  let left = Math.min(dt, 0.25);
  while (left > EPSILON) { const chunk = Math.min(left, 1 / 120); tick(state, axis, chunk); left -= chunk; }
  return state;
}
