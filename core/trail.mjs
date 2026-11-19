// BlockRooms — the route a visit took, as the game writes it down and the book reads it back. Pure: no clock, no world.
//
// One sample a second of play: which part of the building (0 is the first under the office) and where on it, to
// half a metre. Written compactly so that a visit of the longest tape fits in a signing:
//
//   "@0|0,-1|1,-1|3,0|@1|-4,2|..."     "@d" starts a part; "x,z" is a sample in half-metres
//
// The book does not take the visitor's word for it: it builds the same building from the seed and checks the route
// against it (tools/blockrooms/visit-check.mjs).

export const TRAIL = Object.freeze({ every: 1, unit: 0.5, most: 3700 });

/** A trail being written: `at(depth, x, z)` as often as you like; `tick(seconds)` of play adds a sample each second. */
export function createTrail() {
  const parts = [];                                   // [[depth, [x, z], [x, z], ...], ...]
  let last = null, owed = 0, count = 0;
  return {
    at(depth, x, z) {
      const d = Math.floor(Number(depth));
      if (!Number.isFinite(d) || d < 0 || !Number.isFinite(x) || !Number.isFinite(z)) return;
      last = { d, x, z };
    },
    tick(dt) {
      if (!(dt > 0)) return;
      owed += dt;
      while (owed >= TRAIL.every) {
        owed -= TRAIL.every;
        if (!last || count >= TRAIL.most) continue;
        let part = parts[parts.length - 1];
        if (!part || part[0] !== last.d) { part = [last.d]; parts.push(part); }
        part.push([Math.round(last.x / TRAIL.unit), Math.round(last.z / TRAIL.unit)]);
        count++;
      }
    },
    get length() { return count; },
    encode() { return parts.map(([d, ...xz]) => `@${d}` + xz.map(([x, z]) => `|${x},${z}`).join('')).join('|'); },
  };
}

/** A written trail read back: [{ d, x, z }] in metres, or null if it is not one. Nothing in it is trusted but its shape. */
export function readTrail(text) {
  if (typeof text !== 'string' || text.length > TRAIL.most * 14 + 64) return null;
  if (!text) return [];
  const out = [];
  let d = null;
  for (const tok of text.split('|')) {
    if (tok[0] === '@') {
      const n = Number(tok.slice(1));
      if (!Number.isInteger(n) || n < 0 || n > 12) return null;
      d = n; continue;
    }
    const m = /^(-?\d{1,5}),(-?\d{1,5})$/.exec(tok);
    if (!m || d === null) return null;
    out.push({ d, x: Number(m[1]) * TRAIL.unit, z: Number(m[2]) * TRAIL.unit });
    if (out.length > TRAIL.most) return null;
  }
  return out;
}
