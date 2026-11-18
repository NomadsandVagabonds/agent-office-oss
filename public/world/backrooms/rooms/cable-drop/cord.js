// A length of cable as a chain of points: for The Trunk Line's arms and the slack leads that hang off it. Pure: no
// three.js, no Math.random. It is stepped at a fixed rate, so it comes out the same however the frames fall, and the
// only things it is told are where its root is, which way it would hang if it were stiff, and what it reaches for.
//
// Points are world metres, root first. Verlet: each point keeps where it was, and is moved on by what it did last step,
// gravity, a pull toward its stiff shape, a pull of the tip toward something, then the lengths are put right.

export const CORD_STEP = 1 / 120;
const MAX_STEPS = 12;                   // a long frame (a hitch, a tab come back) is not made up: the cord just jumps

/** n segments of length seg, hanging from (x, y, z) along (dx, dy, dz). */
export function createCord(n, seg, x = 0, y = 0, z = 0, dx = 0, dy = -1, dz = 0) {
  const p = new Float64Array((n + 1) * 3);
  for (let i = 0; i <= n; i++) { p[i * 3] = x + dx * seg * i; p[i * 3 + 1] = y + dy * seg * i; p[i * 3 + 2] = z + dz * seg * i; }
  return { n, seg, p, q: p.slice(), carry: 0 };
}

/** Put the whole cord back, hanging straight from the root (after it was hidden, or teleported). */
export function settleCord(c, x, y, z, dx = 0, dy = -1, dz = 0) {
  for (let i = 0; i <= c.n; i++) {
    c.p[i * 3] = c.q[i * 3] = x + dx * c.seg * i;
    c.p[i * 3 + 1] = c.q[i * 3 + 1] = y + dy * c.seg * i;
    c.p[i * 3 + 2] = c.q[i * 3 + 2] = z + dz * c.seg * i;
  }
  c.carry = 0;
}

/**
 * Advance the cord by dt seconds.
 * o: { root: [x,y,z], dir: [dx,dy,dz] the way it would lie if stiff (unit), stiff 0..1 how much it keeps that shape,
 *      gravity (m/s², default 9.8), drag 0..1 per second lost, reach: [x,y,z] | null, pull: strength of the tip's reach,
 *      floor: y it cannot go under (or -Infinity), rough: 0..1 how much the floor holds what lies on it }
 */
export function stepCord(c, dt, o) {
  c.carry = Math.min(c.carry + Math.max(0, dt), CORD_STEP * MAX_STEPS);
  let steps = 0;
  while (c.carry >= CORD_STEP) { c.carry -= CORD_STEP; tick(c, o); steps++; }
  return steps;
}

function tick(c, o) {
  const { p, q, n, seg } = c, h = CORD_STEP, g = o.gravity ?? 9.8, keep = Math.exp(-(o.drag ?? 1.2) * h);
  const [rx, ry, rz] = o.root, [dx, dy, dz] = o.dir || [0, -1, 0], stiff = o.stiff ?? 0, floor = o.floor ?? -Infinity;
  for (let i = 1; i <= n; i++) {
    const k = i * 3;
    let vx = (p[k] - q[k]) * keep, vy = (p[k + 1] - q[k + 1]) * keep, vz = (p[k + 2] - q[k + 2]) * keep;
    q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2];
    vy -= g * h * h;
    // its stiff shape: a spring toward where it would be if it were a rod (stronger near the root)
    if (stiff > 0) {
      const s = stiff * (1 - 0.55 * (i / n)) * 0.08;
      vx += (rx + dx * seg * i - p[k]) * s; vy += (ry + dy * seg * i - p[k + 1]) * s; vz += (rz + dz * seg * i - p[k + 2]) * s;
    }
    p[k] += vx; p[k + 1] += vy; p[k + 2] += vz;
  }
  if (o.reach && o.pull) {
    // the tip and the two before it lean toward what it reaches for
    const [tx, ty, tz] = o.reach;
    for (let i = Math.max(1, n - 2); i <= n; i++) {
      const k = i * 3, w = o.pull * h * (i === n ? 1 : 0.5);
      p[k] += (tx - p[k]) * w; p[k + 1] += (ty - p[k + 1]) * w; p[k + 2] += (tz - p[k + 2]) * w;
    }
  }
  p[0] = q[0] = rx; p[1] = q[1] = ry; p[2] = q[2] = rz;
  for (let it = 0; it < 4; it++) {
    for (let i = 0; i < n; i++) {
      const a = i * 3, b = a + 3;
      const ex = p[b] - p[a], ey = p[b + 1] - p[a + 1], ez = p[b + 2] - p[a + 2], d = Math.hypot(ex, ey, ez) || 1e-9;
      const f = (d - seg) / d;
      if (i === 0) { p[b] -= ex * f; p[b + 1] -= ey * f; p[b + 2] -= ez * f; }
      else { const hf = f * 0.5; p[a] += ex * hf; p[a + 1] += ey * hf; p[a + 2] += ez * hf; p[b] -= ex * hf; p[b + 1] -= ey * hf; p[b + 2] -= ez * hf; }
    }
    for (let i = 1; i <= n; i++) {
      const k = i * 3;
      if (p[k + 1] < floor) {
        p[k + 1] = floor;
        // what lies on the floor is held by it: it drags rather than slides on
        const r = o.rough ?? 0.6;
        q[k] += (p[k] - q[k]) * r; q[k + 2] += (p[k + 2] - q[k + 2]) * r; q[k + 1] = floor;
      }
    }
  }
}

/** A blow: the cable is given a sudden speed (m/s), more of it the further out along it a point is. */
export function kickCord(c, vx, vy, vz) {
  for (let i = 1; i <= c.n; i++) {
    const k = i * 3, w = (i / c.n) * CORD_STEP;
    c.q[k] -= vx * w; c.q[k + 1] -= vy * w; c.q[k + 2] -= vz * w;
  }
}
