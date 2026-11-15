// Pure walkability clip & bridge/plenum state machine for `server-chasm` ("The Cooling Chasm").
// Keeps the visitor strictly on the grated maintenance balcony, extended steel
// drawbridges, and central cooling spire without needing dozens of wall colliders.

export const BRIDGE_SPEED = 1.15; // extension fraction per second (~0.87s to lock)

export function chasmZones(W, D) {
  const zBalc = D / 2 - 3.4;          // main balcony front edge
  const wingW = 2.3;                 // left/right wing width
  const zWing = D / 2 - 6.6;         // how far forward the side overlook wings reach
  const zPylon0 = 0.2, zPylon1 = 1.6; // mid-chasm relay pylon
  const zSpire0 = -4.6, zSpire1 = -1.2; // central cooling spire island
  return {
    balcony: { x0: -W / 2 + 0.30, z0: zBalc, x1: W / 2 - 0.30, z1: D / 2 + 0.30 },
    wingL: { x0: -W / 2 + 0.30, z0: zWing, x1: -W / 2 + 0.30 + wingW, z1: D / 2 + 0.30 },
    wingR: { x0: W / 2 - 0.30 - wingW, z0: zWing, x1: W / 2 - 0.30, z1: D / 2 + 0.30 },
    span1: { x0: -1.05, z0: zPylon0 + 0.2, x1: 1.05, z1: zBalc + 1.0 },
    pylon: { x0: -1.45, z0: zPylon0, x1: 1.45, z1: zPylon1 },
    span2: { x0: -1.05, z0: zSpire1 - 0.8, x1: 1.05, z1: zPylon1 - 0.2 },
    spire: { x0: -2.25, z0: zSpire0, x1: 2.25, z1: zSpire1 },
  };
}

export function serverChasmStash(r, side) {
  const z0 = +(r.D / 2 - 6.15).toFixed(3);
  const z1 = +(r.D / 2 - 5.15).toFixed(3);
  return side < 0
    ? [-(r.W / 2 - 0.95), z0, -(r.W / 2 - 1.95), z1]
    : [r.W / 2 - 1.95, z0, r.W / 2 - 0.95, z1];
}

function inBox(x, z, r, b) {
  return x >= b.x0 + r && x <= b.x1 - r && z >= b.z0 + r && z <= b.z1 - r;
}

/** True iff a circle of radius `r` at `(x, z)` sits safely on grated catwalk or locked bridge. */
export function chasmWalkable(x, z, r, W, D, state) {
  const Z = chasmZones(W, D);
  const m = Math.min(r, 0.24);
  if (inBox(x, z, m, Z.balcony)) return true;
  if (inBox(x, z, m, Z.wingL) || inBox(x, z, m, Z.wingR)) return true;
  if (state.ext1 >= 0.98) {
    if (inBox(x, z, m, Z.span1) || inBox(x, z, m, Z.pylon)) return true;
    // Allow seamless crossing over the seam between balcony and span1, and span1 and pylon
    if (Math.abs(x) <= 1.05 - m && z >= Z.pylon.z0 + m && z <= Z.balcony.z1 - m) {
      if (state.ext2 >= 0.98) return true;
      return true;
    }
  }
  if (state.ext1 >= 0.98 && state.ext2 >= 0.98) {
    if (inBox(x, z, m, Z.span2) || inBox(x, z, m, Z.spire)) return true;
    if (Math.abs(x) <= 1.05 - m && z >= Z.spire.z0 + m && z <= Z.pylon.z1 - m) return true;
  }
  return false;
}

export function createChasmState() {
  return {
    breaker1: false,
    breaker2: false,
    ext1: 0,
    ext2: 0,
    flushed: false,
    flushTime: 0,
    fanSpeed: 0.75, // rad/s idle spin
  };
}

export function stepChasm(state, {
  dt = 0,
  toggle1 = false,
  toggle2 = false,
  triggerFlush = false,
} = {}) {
  let { breaker1, breaker2, ext1, ext2, flushed, flushTime, fanSpeed } = state;
  let locked1 = false, locked2 = false, startedFlush = false;

  if (toggle1 && !breaker1) breaker1 = true;
  if (toggle2 && !breaker2) breaker2 = true;

  if (breaker1 && ext1 < 1) {
    const next = Math.min(1, ext1 + BRIDGE_SPEED * dt);
    if (ext1 < 0.98 && next >= 0.98) locked1 = true;
    ext1 = next;
  }
  if (breaker2 && ext2 < 1) {
    const next = Math.min(1, ext2 + BRIDGE_SPEED * dt);
    if (ext2 < 0.98 && next >= 0.98) locked2 = true;
    ext2 = next;
  }

  if (triggerFlush && !flushed && ext1 >= 0.98 && ext2 >= 0.98) {
    flushed = true;
    flushTime = 0;
    startedFlush = true;
  }

  if (flushed) {
    flushTime += dt;
    fanSpeed = Math.min(4.6, fanSpeed + dt * 2.4);
  }

  return {
    state: { breaker1, breaker2, ext1, ext2, flushed, flushTime, fanSpeed },
    locked1,
    locked2,
    startedFlush,
  };
}
