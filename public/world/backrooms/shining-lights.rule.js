// The Backrooms — a shining batch that lights what is near it (world.js `c.shining(key, texture, power, rgb,
// { lights })`). Opt-in per batch: without `lights` none of this runs. With it, every piece of geometry added to the
// batch afterwards (a box, a quad, a triangle, a ball, a grid or a voxel model: one lamp per outermost call, from the
// bounds of the vertices it added) also hands the room ordinary baked lamps (kit.js `lamp`), exactly as `c.light`
// would with the same options: the bake, tube shadows (shadowmap.js), doorway light and the lighting banks cannot tell
// them apart. Positions come from the geometry alone: no seed is read, nothing random; the same room, the same lamps.
// No three.js in here: the tests read it.

export const SHINING_LIGHTS = Object.freeze({
  cap: 16,            // lamps one batch may hand the room at most (the room's whole budget of lights, budget.js); past it, the two nearest are merged into one
  long: 0.9,          // a box this long (metres) or longer…
  thin: 3,            // …and this many times longer than its next-longest side is a line: its light is shared along it
  three: 1.8,         // from this long, three lamps along it; under it, two
});

/** The options of `lights` that are handed to every lamp, as `c.light` hands them: the same names, the same meaning. */
const PASSED = ['k', 'far', 'axis', 'floor', 'wrap', 'flick', 'bank'];

/** Where the lamps of one piece go, from its bounds: [[x, y, z], …], one at its middle, or two or three along a line. */
export function lampSpots(x0, y0, z0, x1, y1, z1) {
  const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], size = [x1 - x0, y1 - y0, z1 - z0];
  const order = [0, 1, 2].sort((a, b) => size[b] - size[a] || a - b), L = size[order[0]], M = size[order[1]];
  const n = L >= SHINING_LIGHTS.long && L >= SHINING_LIGHTS.thin * M ? (L >= SHINING_LIGHTS.three ? 3 : 2) : 1;
  if (n === 1) return [c];
  const axis = order[0], lo = [x0, y0, z0][axis];
  return Array.from({ length: n }, (_, i) => { const p = c.slice(); p[axis] = lo + (L * (i + 0.5)) / n; return p; });
}

/**
 * A room's lamps kept within a cap, as one shining batch keeps its own (shineLights, below; world.js c.fitting keeps the
 * room's ceiling fittings' lamps in one too): `put(x, y, z, rgb, w, opt)` adds the lamp `add(x, y, z, rgb, opt)` makes
 * (rgb linear, as handed to the lamp; w the power it carries, for merging) and → it. Past the cap (`lights.cap`, at
 * most SHINING_LIGHTS.cap) the nearest two of the set's lamps become one, weighted by power, in the place of the
 * earlier one; the later is handed to `drop(lamp)`. → { own: the set's lamps ({ L, w }, a live list), put }.
 */
export function lampSet(lights, add, drop) {
  const cap = Math.max(1, Math.min(SHINING_LIGHTS.cap, Math.floor(Number(lights?.cap) || SHINING_LIGHTS.cap)));
  const own = [];                      // { L, w }: the lamp, and the power it carries (for merging)
  const merge = (a, b) => {            // b into a
    const W = a.w + b.w, A = a.L, B = b.L;
    A.x = (A.x * a.w + B.x * b.w) / W; A.y = (A.y * a.w + B.y * b.w) / W; A.z = (A.z * a.w + B.z * b.w) / W;
    A.r += B.r; A.g += B.g; A.b += B.b; a.w = W;
  };
  const put = (x, y, z, rgb, w, opt) => {
    const next = { L: add(x, y, z, rgb, opt), w };
    own.push(next);
    if (own.length <= cap) return next.L;
    // the nearest two (ties: the earliest pair), the later into the earlier
    let bi = 0, bj = 1, best = Infinity;
    for (let i = 0; i < own.length; i++) for (let j = i + 1; j < own.length; j++) {
      const a = own[i].L, b = own[j].L, d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
      if (d < best) { best = d; bi = i; bj = j; }
    }
    merge(own[bi], own[bj]);
    drop(own[bj].L);
    own.splice(bj, 1);
    return next.L;
  };
  return { own, put };
}

/**
 * Make `batch` light the room: from now on, each outermost call that adds vertices to it adds lamps through
 * `add(x, y, z, rgb, opt)` (→ the lamp it made, which the room keeps), each of power `lights.power / n` (n the lamps
 * of that piece) in `rgb` (linear), with `lights.offset` [dx, dy, dz] added to its place if given. Past the cap
 * (`lights.cap`, at most SHINING_LIGHTS.cap) the nearest two of the batch's lamps become one (lampSet, above).
 * → the batch's own lamps (a live list).
 */
export function shineLights(batch, rgb, lights, add, drop) {
  const power = Number.isFinite(Number(lights.power)) ? Number(lights.power) : 1;
  const off = Array.isArray(lights.offset) ? lights.offset.map((v) => Number(v) || 0) : null;
  const opt = {};
  for (const name of PASSED) if (lights[name] !== undefined) opt[name] = lights[name];
  const set = lampSet(lights, add, drop);
  const place = (p, share) => {
    const x = p[0] + (off ? off[0] : 0), y = p[1] + (off ? off[1] : 0), z = p[2] + (off ? off[2] : 0);
    set.put(x, y, z, rgb.map((v) => v * share), share, opt);
  };
  let depth = 0;
  for (const name of ['grid', 'quad', 'tri', 'ball', 'box', 'addVox']) {
    const original = batch[name];
    batch[name] = function (...args) {
      const start = this.verts, outer = depth++ === 0;
      let out;
      try { out = original.apply(this, args); }
      finally { depth--; }
      if (outer && this.verts > start) {
        let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
        const p = this.pos;
        for (let v = start * 3; v < p.length; v += 3) {
          const x = p[v], y = p[v + 1], z = p[v + 2];
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
        }
        if ([x0, y0, z0, x1, y1, z1].every(Number.isFinite)) {
          const spots = lampSpots(x0, y0, z0, x1, y1, z1), share = spots.length === 1 ? power : power / spots.length;
          for (const s of spots) place(s, share);
        }
      }
      return out;
    };
  }
  return set.own;
}
