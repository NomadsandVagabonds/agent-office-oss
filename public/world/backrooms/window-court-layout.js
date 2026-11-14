// Geometry and harmless encounter state for the opt-in Window Court workshop.
// No renderer, clock, global randomness or production generator dependency.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function windowCourtLayout({ W = 23.8, D = 27.8, H = 12 } = {}) {
  if (W < 20 || D < 24 || H < 10) throw new RangeError('Window Court needs a tall room at least 20 × 24 × 10 metres.');
  const pit = { x0: -W / 2 + 4.4, x1: W / 2 - 4.4, z0: -D / 2 + 4.2, z1: D / 2 - 4.2 };
  const laneX = (pit.x1 + W / 2) / 2;
  const gateZ = -D / 2 + 6.0;
  const shutter = { x0: pit.x1 + 0.02, x1: W / 2, z0: gateZ - 0.12, z1: gateZ + 0.12, h: 2.65 };
  const windows = [], rowHeight = Math.min(2.65, (H - 2.5) / 3);
  for (const side of ['front', 'back', 'left', 'right']) {
    const along = side === 'front' || side === 'back' ? W : D;
    const count = Math.floor((along - 2.8) / 2.6), spacing = (along - 3.2) / count;
    for (let row = 0; row < 4; row++) for (let i = 0; i < count; i++) {
      const at = -along / 2 + 1.6 + spacing * (i + 0.5);
      // The real entry/exit doors retain their full opening.
      if (row === 0 && (side === 'front' || side === 'back') && Math.abs(at) < 1.7) continue;
      windows.push({ side, at, y: 1.55 + row * rowHeight, w: 1.18, h: 1.55,
        lit: (i + row * 3 + (side === 'left' ? 1 : 0)) % 5 === 0,
        gap: (i + row * 2) % 4 === 0, row, index: i });
    }
  }
  const entry = { x: 0, z: D / 2 - 1.2 }, exit = { x: 0, z: -D / 2 + 1.2 };
  const leftRoute = [entry, { x: -laneX, z: pit.z1 + 1.5 }, { x: -laneX, z: pit.z0 - 1.5 }, exit];
  const rightRoute = [entry, { x: laneX, z: pit.z1 + 1.5 }, { x: laneX, z: pit.z0 - 1.5 }, exit];
  return { W, D, H, pit, shutter, windows, laneX, gateZ, entry, exit, leftRoute, rightRoute,
    start: { x: laneX, z: pit.z1 - 2.3 },
    holding: { x: W / 2 - 0.65, z: gateZ - 0.65 },
    mirrorZ: { lo: gateZ + 2.4, hi: pit.z1 - 1.1 } };
}

/** A permanently available detour, with an optional shortcut offered by a
 * neutral inhabitant. The gate never closes after opening, including on reentry.
 */
export function createWindowCourtBehavior(plan) {
  const state = { phase: 'mirror', time: 0, still: 0, x: plan.start.x, z: plan.start.z,
    gate: 0, moving: false, offered: false, arrived: false, yaw: Math.PI, headYaw: Math.PI / 2 };
  const move = (target, speed, dt) => {
    const dx = target.x - state.x, dz = target.z - state.z, d = Math.hypot(dx, dz);
    const step = Math.min(d, speed * dt);
    state.moving = step > 0.0001;
    if (d > 0.001) { state.x += dx / d * step; state.z += dz / d * step; state.yaw = Math.atan2(dx, dz); }
    return d - step < 0.02;
  };
  return {
    state,
    advance(dt, player = {}) {
      if (!player.inside || player.frozen) { state.moving = false; return { ...state }; }
      dt = Math.max(0, Math.min(dt, 0.1));
      state.time += dt;
      if (state.phase === 'mirror') {
        const target = { x: plan.laneX, z: clamp(player.z ?? plan.start.z, plan.mirrorZ.lo, plan.mirrorZ.hi) };
        move(target, Math.max(0.65, Math.min(2.1, player.speed || 0)), dt);
        state.still = (player.speed || 0) < 0.08 ? state.still + dt : 0;
        // Waiting invites the figure to move independently. Approaching the
        // closed gate also offers help: no hidden requirement to stand still.
        if ((state.time > 4 && state.still > 1.6) || ((player.x || 0) > plan.pit.x1 && (player.z ?? 99) < plan.gateZ + 2)) {
          state.phase = 'lead'; state.offered = true;
        }
      } else if (state.phase === 'lead') {
        if (move({ x: plan.laneX, z: plan.gateZ + 0.65 }, 1.15, dt)) state.phase = 'open';
      } else if (state.phase === 'open') {
        state.moving = false; state.gate = Math.min(1, state.gate + dt / 2.6);
        if (state.gate === 1) state.phase = 'aside';
      } else if (state.phase === 'aside') {
        // Move through only once there is physical headroom, then turn toward
        // the wall. The inhabitant is never a collision or pursuit hazard.
        const target = state.z > plan.gateZ - 0.5 ? { x: plan.laneX, z: plan.gateZ - 0.65 } : plan.holding;
        if (move(target, 0.85, dt) && target === plan.holding) { state.phase = 'hold'; state.arrived = true; }
      } else { state.moving = false; state.yaw = Math.PI / 2; }
      return { ...state };
    },
    read: () => ({ ...state }),
  };
}

export function windowCourtFree(plan, x, z, radius = 0.225, gateOpen = false) {
  if (Math.abs(x) > plan.W / 2 - radius || Math.abs(z) > plan.D / 2 - radius) return false;
  const hits = r => Math.hypot(x - clamp(x, r.x0, r.x1), z - clamp(z, r.z0, r.z1)) < radius;
  if (hits(plan.pit)) return false;
  return gateOpen || !hits(plan.shutter);
}
