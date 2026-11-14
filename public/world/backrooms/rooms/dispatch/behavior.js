// Pure, room-local choreography. No pursuit, damage, reward or player mutation.
const CYCLE = [['pickup', 5], ['carry', 7], ['load', 4], ['return', 6], ['embrace', 12]];
const LENGTH = CYCLE.reduce((n, [, d]) => n + d, 0);

export function createFreightBehavior() {
  let cycle = 22, attention = 0, reactionTime = 0;
  const read = () => {
    if (attention > 0) {
      const phase = reactionTime < 2.2 ? 'startled' : reactionTime < 5 ? 'watch' : reactionTime < 14 ? 'follow' : 'return';
      return { phase, phaseTime: reactionTime, attention, carrying: false, afraid: Math.max(0, 1 - reactionTime / 14) };
    }
    let at = cycle;
    for (const [phase, duration] of CYCLE) {
      if (at < duration) return { phase, phaseTime: at, attention: 0, afraid: 0,
        carrying: phase === 'carry' || (phase === 'pickup' && at > 3) || (phase === 'load' && at < 2.1) };
      at -= duration;
    }
  };
  return {
    notice() { attention = 22; reactionTime = 0; cycle = 0; return read(); },
    leave() { attention = 0; reactionTime = 0; cycle = 16; return read(); },
    read,
    advance(dt, { frozen = false, arrived = true } = {}) {
      if (frozen || !(dt > 0) || !Number.isFinite(dt)) return read();
      if (attention > 0) {
        const used = Math.min(dt, attention);
        reactionTime += used; attention -= used; dt -= used;
        if (attention === 0) cycle = 0; // resume packing, rather than immediately embracing under scrutiny
      }
      if (attention === 0 && (arrived || !['pickup', 'carry', 'return'].includes(read().phase))) cycle = (cycle + dt) % LENGTH;
      return read();
    },
  };
}

// A small static local grid. All targets resolve within the reachable component;
// an unreachable target behind a crate never makes an actor cut through its wall.
export function makeFreightNavigator({ W, D, free, cell = 0.3 }) {
  const nx = Math.ceil(W / cell), nz = Math.ceil(D / cell), count = nx * nz;
  const at = k => ({ x: -W / 2 + (k % nx + 0.5) * cell, z: -D / 2 + (Math.floor(k / nx) + 0.5) * cell });
  const open = new Uint8Array(count);
  for (let k = 0; k < count; k++) { const p = at(k); open[k] = free(p.x, p.z) ? 1 : 0; }
  const edges = new Uint8Array(count);
  for (let k = 0; k < count; k++) if (open[k]) {
    const p = at(k);
    for (const [n, bit, opposite] of [[k % nx < nx - 1 ? k + 1 : -1, 1, 2], [k + nx < count ? k + nx : -1, 4, 8]]) {
      if (n < 0 || !open[n]) continue;
      const q = at(n);
      if (free((p.x + q.x) / 2, (p.z + q.z) / 2)) { edges[k] |= bit; edges[n] |= opposite; }
    }
  }
  const nearest = p => {
    let best = -1, dist = Infinity;
    for (let k = 0; k < count; k++) if (open[k]) { const q = at(k), d = (p.x - q.x) ** 2 + (p.z - q.z) ** 2; if (d < dist) { best = k; dist = d; } }
    return best;
  };
  function path(from, target) {
    const start = nearest(from);
    if (start < 0) return [];
    const prev = new Int32Array(count).fill(-1), queue = new Int32Array(count);
    prev[start] = start; queue[0] = start;
    let head = 0, tail = 1, best = start, bestD = Infinity;
    while (head < tail) {
      const k = queue[head++], p = at(k), d = (p.x - target.x) ** 2 + (p.z - target.z) ** 2;
      if (d < bestD) { bestD = d; best = k; }
      for (const [n, bit] of [[k + 1, 1], [k - 1, 2], [k + nx, 4], [k - nx, 8]]) {
        if (!(edges[k] & bit) || prev[n] >= 0) continue;
        prev[n] = k; queue[tail++] = n;
      }
    }
    const result = [];
    for (let k = best; k !== start; k = prev[k]) result.push(at(k));
    result.reverse();
    return result;
  }
  return { path, free, nearest: p => { const k = nearest(p); return k < 0 ? null : at(k); } };
}
