// Pure room rules. The return is a spatial fold, never a locked doorway.
export const RETURN_POOL = Object.freeze({ depth: .6, step: .15, tread: .32, turns: 3, crankDelay: 1.8, warning: 1.5, speed: 1.7, recovery: 2.5, reach: .56 });

export function poolPlan({ W, D, H }) {
  return { half: 3.1, end: D / 2 - 5.1, roof: H - 1.25,
    valve: { x: -.35, z: -1.9 }, fold: { x: W / 2 - 2.25, z: -D / 2 + 1.9, toZ: D / 2 - 3.15 },
    island: { x: 0, z: 2.2, half: .65 } };
}

export function poolFloor(p, x, z) {
  const edge = Math.min(p.half - Math.abs(x), p.end - Math.abs(z));
  if (edge <= 0) return 0;
  const islandEdge = Math.max(Math.abs(x - p.island.x), Math.abs(z - p.island.z));
  const island = -Math.max(0, Math.ceil((islandEdge - p.island.half) / RETURN_POOL.tread)) * RETURN_POOL.step;
  return Math.max(-RETURN_POOL.depth, -(1 + Math.floor(edge / RETURN_POOL.tread)) * RETURN_POOL.step, island) || 0;
}

export const poolState = () => ({ turns: 0, crank: 0, laps: 0, foldCooldown: 0, previous: null, phase: 'quiet', timer: .8, wake: { x: 1.5, z: -3 }, warning: false, hit: false, warp: null });

export function turnValve(state) {
  if (state.turns >= RETURN_POOL.turns || state.crank > 0) return false;
  state.turns++; state.crank = RETURN_POOL.crankDelay;
  return true;
}

export function stepPool(state, dt, me, plan) {
  dt = Math.max(0, Math.min(.1, dt));
  state.crank = Math.max(0, state.crank - dt);
  state.foldCooldown = Math.max(0, state.foldCooldown - dt);
  state.hit = false; state.warning = false; state.warp = null;
  const prev = state.previous;
  // Crossing toward the far door only. Entering from that door or standing on
  // the threshold never warps a visitor; retreat is always possible.
  if (me.inside && prev && prev.inside && state.turns < RETURN_POOL.turns && state.foldCooldown === 0 &&
      Math.abs(me.x - plan.fold.x) < .8 && prev.z >= plan.fold.z && me.z < plan.fold.z) {
    state.laps++; state.foldCooldown = 1.5;
    state.warp = { x: me.x, z: plan.fold.toZ + me.z - plan.fold.z };
  }
  state.previous = { x: me.x, z: state.warp?.z ?? me.z, inside: me.inside };
  const wet = me.inside && poolFloor(plan, me.x, me.z) < -.3;
  state.timer = Math.max(0, state.timer - dt);
  if (!wet) {
    if (state.phase !== 'quiet') { state.phase = 'quiet'; state.timer = 1.2; }
    return state;
  }
  if (state.phase === 'quiet' && state.timer === 0) {
    state.phase = 'warning'; state.timer = RETURN_POOL.warning; state.warning = true;
    // Surface at the far end, in sight when approaching the wheel. Switch
    // ends only if the visitor is already there; never spawn at their feet.
    state.wake = { x: -me.x * .45, z: me.z > -plan.end + 3 ? -plan.end + 1.1 : plan.end - 1.1 };
  } else if (state.phase === 'warning' && state.timer === 0) {
    state.phase = 'hunting'; state.timer = 7;
  } else if (state.phase === 'hunting') {
    const dx = me.x - state.wake.x, dz = me.z - state.wake.z, distance = Math.hypot(dx, dz);
    const step = Math.min(distance, RETURN_POOL.speed * dt);
    if (distance > 0) { state.wake.x += dx / distance * step; state.wake.z += dz / distance * step; }
    if (distance <= RETURN_POOL.reach) { state.hit = true; state.phase = 'recover'; state.timer = RETURN_POOL.recovery; }
    else if (state.timer === 0) { state.phase = 'recover'; state.timer = RETURN_POOL.recovery; }
  } else if (state.phase === 'recover' && state.timer === 0) { state.phase = 'quiet'; state.timer = .7; }
  return state;
}
