// The Backrooms — the quiet rooms: how the plain rooms of a floor are laid
// out so that they cannot be told apart. Pure: no three.js, no DOM. After
// Codex's quiet-maze study (a few wall-and-pillar motifs, turned and used
// again and again, and the same small wrongnesses repeated in many rooms
// instead of one landmark each).
//
// A floor is given a small vocabulary (vocabulary(), from its theme): two or
// three motifs out of the theme's own, each with its proportions fixed for
// the whole floor, and the one or two static wrongnesses that floor has. A
// plain room then takes one motif, turned to suit its doorways, or nothing.
// Rooms of the same size roll the same way (gen.js keys the roll on the
// footprint), so the same silhouette turns up again three rooms later, and
// again on the way back.
//
//   parallel   a free-standing length of wall down the room, off the middle: two lanes, walk round either end
//   dogleg     two stubs of wall from opposite sides, staggered: the room is crossed in an S
//   bays       short stubs from one wall at even spacing: a row of empty bays, a lane along the open side
//   colonnade  a line of square columns down the room, one of them missing
//   return     a parallel wall with a short arm at one end: an L you walk round
//   nibs       (corridors) shallow piers in pairs down both walls at even spacing: a corridor of frames
//   baffle     (corridors) stubs from alternate walls, most of the way across: you walk it in a slalom
//   fence      (the neighbourhood) a picket fence, waist high, from wall to wall across the room, with a gap where a gate
//              would hang: you see the whole room over it and cross it in one place
//   flats      (the neighbourhood) a row of scenic flats down the room, off the middle, one of them missing: a painted street
//              from one side, bare board and braces from the other. Each brace's foot is in the way, a short step out behind
//   apertures  (wrong) a parallel wall with two holes in it: one at carpet level, 0.85 m high, that you can crawl
//              through, and one at head height, 1.7 to 2.3 m, that you cannot. The ordinary way round its ends stays.
//   sunk       (wrong) a whole workstation — desk, chair, monitor, keyboard, mouse — full size and perfectly still,
//              0.4 m down in the carpet. Nothing about it can be used.
//
// What a plan adds to a room (all in the room's own frame, metres):
//   pillars  { x, z, w, d } blocks of wall, floor to ceiling — or, with y0, a header hanging from the ceiling down
//            to y0 that you pass under; with h, a block that stops at h
//   lows     { x0, z0, x1, z1, h } floor where the headroom is only h (frame.js headAt reads it)
//   blocks   { x0, z0, x1, z1 } something solid that is not wall (gen.js keeps tapes out of it)
//   props    { type, x, z, y, rot } catalogue furniture for the builder to put exactly there
// Nothing here is usable, moves, makes a sound or is ever found in one room only.
import { headAt, fitsAt, floorAt, wallPoint, stairZones } from './frame.js';

const WALL = 0.2;                         // a partition is as thick as a wall
const BODY = 0.225;                       // the walker's radius (world.js walkable)
const HEAD = 0.62;                        // the least headroom anybody can get through (world.js)
const STEP = 0.26;
export const LOW = 0.85, HIGH = [1.7, 2.3]; // the hole you can crawl through · the one at head height
export const SUNK = -0.4;                 // how far down in the carpet the workstation is
const VOXEL = 0.025;
const r4 = (v) => Math.round(v * 10000) / 10000;

/** A picket fence: how high, how thick. A scenic flat: a sheet of board on its end, and how far its brace reaches out behind. */
export const FENCE = Object.freeze({ h: 0.96, t: 0.1 }), FLAT = Object.freeze({ w: 1.22, h: 2.44, t: 0.08, brace: 0.74 });
export const MOTIFS = ['parallel', 'dogleg', 'bays', 'colonnade', 'return'];
/** The motifs a corridor can take (a plain room less than NARROW across): a floor has one of them, or none. */
export const HALLS = ['nibs', 'baffle'];
export const NARROW = 4;
export const WRONG = ['apertures', 'sunk'];

/* ---- turning: a motif is drawn in its own frame (u across, v along), then turned into the room's ---- */

// the same quarter-turn convention as the quiet-maze study: turn 1 takes (u, v) to (v, −u)
function turnPt(u, v, t) {
  let x = u, z = v;
  if (t === 1) [x, z] = [v, -u];
  else if (t === 2) [x, z] = [-u, -v];
  else if (t === 3) [x, z] = [-v, u];
  return { x: r4(x) || 0, z: r4(z) || 0 };
}
/** A rectangle given by its corners in the motif's frame, as a room-frame rectangle. */
function rect(u0, v0, u1, v1, t, extra = {}) {
  const a = turnPt(u0, v0, t), b = turnPt(u1, v1, t);
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
  return { x: r4((x0 + x1) / 2), z: r4((z0 + z1) / 2), w: r4(x1 - x0), d: r4(z1 - z0), ...extra };
}
const box = (p) => ({ x0: r4(p.x - p.w / 2), z0: r4(p.z - p.d / 2), x1: r4(p.x + p.w / 2), z1: r4(p.z + p.d / 2) });
/** The motif's frame for a room turned by t: how far it reaches across (A) and along (B). */
const dims = (room, t) => (t % 2 ? { A: room.D, B: room.W } : { A: room.W, B: room.D });

/* ---- the vocabulary of a floor ------------------------------------------------------------------------ */

// Each kind of floor repeats in its own way: which motifs it is made of, how much of it is bare, what its corridors
// do, and which few shapes its rooms take.
//   mix    [bare, motif, shape] as [lo, hi] each: the share of rooms that are one or the other
//   hall   what its corridors are lined with (weights; 'none': bare corridors)
const THEME_QUIET = {
  // the one everybody remembers: partitions and doglegs, about half of it bare
  yellow: { motifs: [['parallel', 3], ['dogleg', 3], ['bays', 1.5], ['colonnade', 1]], wrong: ['apertures', 'sunk'],
    mix: [[0.26, 0.36], [0.44, 0.54], [0.14, 0.22]], hall: [['nibs', 2], ['baffle', 1.5], ['none', 1.5]], shapes: ['ell', 'pinch', 'forest', 'stepceil', 'slopeceil', 'pit', 'dais', 'soffit', 'stairs'] },
  // records: bay after bay after bay, and corridors of piers
  archive: { motifs: [['bays', 5], ['parallel', 2], ['colonnade', 1]], wrong: ['apertures', 'sunk'],
    mix: [[0.14, 0.22], [0.6, 0.7], [0.1, 0.16]], hall: [['nibs', 5], ['none', 1]], shapes: ['soffit', 'stepceil', 'stairs', 'pinch'] },
  // out of hours: mostly nothing at all, and now and then a wall you have to go round in the dark
  night: { motifs: [['dogleg', 3], ['return', 2.5], ['parallel', 1.5]], wrong: ['sunk', 'apertures'],
    mix: [[0.46, 0.56], [0.28, 0.36], [0.12, 0.18]], hall: [['none', 4], ['baffle', 1]], shapes: ['pit', 'dais', 'slopeceil', 'stepceil'] },
  // being fitted out: columns where the walls will go, and stud partitions half way across the corridors
  fitout: { motifs: [['colonnade', 4.5], ['parallel', 2], ['return', 1]], wrong: ['apertures', 'sunk'],
    mix: [[0.2, 0.28], [0.5, 0.6], [0.16, 0.24]], hall: [['baffle', 4], ['nibs', 1], ['none', 1]], shapes: ['forest', 'stepceil', 'stairs', 'ell'] },
  // the top floor: screens with a return on them, alcoves, pilasters
  exec: { motifs: [['return', 4], ['bays', 2.5], ['dogleg', 1]], wrong: ['sunk', 'apertures'],
    mix: [[0.2, 0.3], [0.5, 0.6], [0.14, 0.2]], hall: [['nibs', 3], ['none', 2]], shapes: ['dais', 'soffit', 'ell', 'pinch', 'slopeceil'] },
  // the neighbourhood: lawns with nothing on them, a fence across one, the backs of a row of flats; a lawn a few steps down, or up
  suburb: { motifs: [['fence', 4], ['flats', 3.2], ['dogleg', 0.8]], wrong: ['sunk', 'apertures'],
    mix: [[0.26, 0.34], [0.4, 0.48], [0.22, 0.3]], hall: [['baffle', 3], ['nibs', 2], ['none', 1.5]], shapes: ['pinch', 'ell', 'stairs', 'soffit', 'stepceil', 'slopeceil', 'pit', 'dais'] },
  // the shopping centre: units either side of a concourse (bays), a colonnade of tiled columns, screens to queue round
  // (no line in TELLS until it is finished — themes.js `dealt: false`)
  mall: { motifs: [['bays', 4], ['colonnade', 3], ['return', 1.5], ['dogleg', 1]], wrong: ['sunk', 'apertures'],
    mix: [[0.24, 0.32], [0.42, 0.5], [0.2, 0.28]], hall: [['nibs', 3], ['baffle', 2.5], ['none', 1]], shapes: ['pinch', 'ell', 'stairs', 'soffit', 'stepceil', 'pit', 'dais'] },
  // the offsite wilderness reserve: staggered hedgerow baffles, doglegs, trunks punching through ceiling tiles, sunken peat hollows
  forest: { motifs: [['thicket', 4.2], ['dogleg', 2.6], ['return', 2.2], ['bays', 1.6]], wrong: ['sunk', 'apertures'],
    mix: [[0.14, 0.22], [0.56, 0.66], [0.14, 0.22]], hall: [['baffle', 4.5], ['nibs', 2]], shapes: ['ell', 'pinch', 'forest', 'pit', 'dais', 'stepceil', 'slopeceil'] },
};
/**
 * What gives a kind of floor away: the layouts there are more of on it than on any other kind ('none': a room with
 * nothing built in it at all). For the tests, and for anybody describing one.
 */
export const TELLS = Object.freeze({ yellow: ['parallel', 'dogleg'], archive: ['nibs', 'bays'], night: ['none'], fitout: ['colonnade', 'baffle'], exec: ['return'], suburb: ['fence', 'flats'] });

/**
 * What the plain rooms of one floor are made of. Rolled once a floor, from its own source.
 * → { motifs: [{ kind, weight, …its proportions }], wrong: [kinds], mix: { bare, motif, shape }, wrongChance }
 */
export function vocabulary(R, themeId) {
  const q = THEME_QUIET[themeId] || THEME_QUIET.yellow;
  const pool = q.motifs.slice(), motifs = [];
  const n = R.chance(0.6) ? 2 : 3;
  while (motifs.length < n && pool.length) { const m = R.weighted(pool, (k) => k[1]); pool.splice(pool.indexOf(m), 1); motifs.push(m); }
  const params = {
    parallel: () => ({ off: R.pick([0.16, 0.2, 0.24]), gap: R.pick([1.1, 1.3]) }),
    dogleg: () => ({ band: R.pick([0.17, 0.2]), gap: R.pick([1.1, 1.3]) }),
    bays: () => ({ every: R.pick([1.7, 1.9, 2.1]), reach: R.pick([0.3, 0.36]), both: R.chance(0.5) }),
    colonnade: () => ({ every: R.pick([1.6, 1.8, 2.0]), size: R.pick([0.4, 0.5]), missing: R.int(0, 2), off: R.pick([0, 0.18]) }),
    return: () => ({ off: R.pick([0.16, 0.22]), gap: R.pick([1.1, 1.3]), arm: R.pick([1.0, 1.3]) }),
    fence: () => ({ band: R.pick([-0.14, 0.1, 0.2]), gate: R.pick([-0.25, 0, 0.25]), gap: R.pick([1.1, 1.3]) }),
    flats: () => ({ off: R.pick([0.1, 0.16]), gap: R.pick([1.1, 1.3]), missing: R.int(0, 2), face: R.pick([-1, 1]) }),
    thicket: () => ({ every: R.pick([2.1, 2.4]), rail: R.chance(0.55), shift: R.pick([-0.22, 0.22]) }),
  };
  // (what a floor's corridors do is rolled from a source of its own, so that it moves nothing a floor always had)
  const RH = R.fork('hall'), hall = RH.weighted(q.hall, (k) => k[1])[0];
  const halls = { nibs: () => ({ every: RH.pick([1.6, 1.9, 2.2]), phase: RH.pick([0, 0.5]) }), baffle: () => ({ every: RH.pick([1.9, 2.3]), reach: RH.pick([0.5, 0.56]) }) };
  // the wrongnesses this floor has: each that the theme knows, more often than not, and none at all now and then
  const wrong = q.wrong.filter((_, i) => R.chance(i === 0 ? 0.8 : 0.55));
  return {
    motifs: motifs.map(([kind, weight]) => ({ kind, weight, ...params[kind]() })),
    wrong,
    mix: { bare: R.range(...q.mix[0]), motif: R.range(...q.mix[1]), shape: R.range(...q.mix[2]) },
    hall: hall === 'none' ? null : { kind: hall, ...halls[hall]() },
    wrongChance: R.pick([0.22, 0.28]),
    // the few shapes this floor's plain rooms take (gen.js shapesFor): three of them, the same three all over the floor
    shapes: R.some(q.shapes, 3),
    ap: { at: R.pick([0.25, 0.3]), flip: R.chance(0.5) },
    sunk: { at: R.pick([0.3, 0.36]) },
  };
}

/* ---- the motifs ------------------------------------------------------------------------------------- */

/**
 * The pillars (and holes, and low places) of one motif in a room, turned by t — or null where it does not fit.
 * Whether its doorways can all still be reached is for fits() to say.
 */
export function motif(room, m, t) {
  const { A, B } = dims(room, t), out = { pillars: [], lows: [], blocks: [], props: [] };
  const P = (u0, v0, u1, v1, extra) => out.pillars.push(rect(u0, v0, u1, v1, t, extra));
  const H = room.H;
  if (m.kind === 'parallel' || m.kind === 'return' || m.kind === 'apertures') {
    if (A < (m.kind === 'apertures' ? 3.4 : 4.4) || B < (m.kind === 'apertures' ? 5.6 : 4.4)) return null;
    const u = -A / 2 + Math.max(1.35, A * (0.5 - (m.off ?? 0.2))), gap = m.gap ?? 1.2, v0 = -B / 2 + gap, v1 = B / 2 - gap;
    if (u + WALL / 2 > A / 2 - 1.35 || v1 - v0 < 2) return null;
    if (m.kind === 'apertures') {
      // two holes, a quarter of the way in from either end: the low one first, the high one after it
      const len = v1 - v0, w = len < 4 ? 1.0 : 1.2, a = v0 + len * (m.at ?? 0.27) - w / 2, b = v1 - len * (m.at ?? 0.27) - w / 2;
      if (a - v0 < 0.3 || b - (a + w) < 0.4 || v1 - (b + w) < 0.3 || H < HIGH[1] + 0.2) return null;
      const [lo, hi] = m.flip ? [b, a] : [a, b];
      P(u - WALL / 2, v0, u + WALL / 2, Math.min(lo, hi));
      P(u - WALL / 2, lo, u + WALL / 2, lo + w, { y0: LOW, wrong: 'low' });                 // the lintel over the hole you crawl through
      P(u - WALL / 2, Math.min(lo, hi) + w, u + WALL / 2, Math.max(lo, hi));
      P(u - WALL / 2, hi, u + WALL / 2, hi + w, { h: HIGH[0], wrong: 'high' });             // under the hole you cannot reach…
      P(u - WALL / 2, hi, u + WALL / 2, hi + w, { y0: HIGH[1], wrong: 'high' });            // …and over it
      P(u - WALL / 2, Math.max(lo, hi) + w, u + WALL / 2, v1);
      const l = rect(u - WALL / 2 - BODY, lo, u + WALL / 2 + BODY, lo + w, t);
      out.lows.push({ ...box(l), h: LOW });
      out.wrong = 'apertures';
    } else {
      P(u - WALL / 2, v0, u + WALL / 2, v1);
      if (m.kind === 'return') P(u + WALL / 2, v1 - WALL, Math.min(A / 2 - 1.35, u + WALL / 2 + (m.arm ?? 1.1)), v1);
    }
  } else if (m.kind === 'dogleg') {
    if (A < 4 || B < 5) return null;
    const vb = B * (m.band ?? 0.18), gap = m.gap ?? 1.2;
    P(-A / 2, -vb - WALL / 2, A / 2 - gap, -vb + WALL / 2);
    P(-A / 2 + gap, vb - WALL / 2, A / 2, vb + WALL / 2);
  } else if (m.kind === 'bays') {
    if (A < 4.5 || B < 4) return null;
    // (stubs evenly spaced and centred, none closer than a metre to a corner; on both long walls only where a lane is left between)
    const reach = Math.min(1.7, B * (m.reach ?? 0.33)), every = m.every ?? 1.9, n = Math.floor((A - 2) / every) + 1;
    if (n < 2) return null;
    const sides = m.both && B >= 6.4 ? [-1, 1] : [-1];
    for (const s of sides) for (let i = 0; i < n; i++) {
      const u = -((n - 1) * every) / 2 + i * every;
      if (s < 0) P(u - WALL / 2, -B / 2, u + WALL / 2, -B / 2 + reach); else P(u - WALL / 2, B / 2 - reach, u + WALL / 2, B / 2);
    }
  } else if (m.kind === 'colonnade') {
    if (A < 4 || B < 5) return null;
    const every = m.every ?? 1.8, n = Math.floor((B - 1.6) / every) + 1, s = m.size ?? 0.45, u = A * (m.off ?? 0);
    if (n < 3) return null;
    const missing = Math.min(n - 1, 1 + (m.missing ?? 0));
    for (let i = 0; i < n; i++) { if (i === missing) continue; const v = (i - (n - 1) / 2) * every; P(u - s / 2, v - s / 2, u + s / 2, v + s / 2); }
  } else if (m.kind === 'fence') {
    // (two runs of it, each `prop: 'fence'`: suburb.js draws the pickets, and nothing papers them)
    if (A < 4 || B < 4.6) return null;
    const v = B * (m.band ?? 0.1), gap = m.gap ?? 1.2, g = Math.max(-A / 2 + 0.9 + gap / 2, Math.min(A / 2 - 0.9 - gap / 2, A * (m.gate ?? 0)));
    P(-A / 2, v - FENCE.t / 2, g - gap / 2, v + FENCE.t / 2, { h: FENCE.h, prop: 'fence' });
    P(g + gap / 2, v - FENCE.t / 2, A / 2, v + FENCE.t / 2, { h: FENCE.h, prop: 'fence' });
  } else if (m.kind === 'flats') {
    // sheets of board FLAT.w wide, edge to edge, with a walk round either end and one sheet left out; behind every other one a brace
    if (A < 5 || B < 4.8 || H < 2.2) return null;
    const face = m.face ?? 1, u = face * A * (m.off ?? 0.12), gap = m.gap ?? 1.2, n = Math.floor((B - 2 * gap) / FLAT.w), h = Math.min(FLAT.h, r4(H - 0.08));
    if (n < 3) return null;
    // (a short row loses a sheet off its end, so that what is left still reads as a row)
    const missing = n < 5 ? n - 1 : Math.min(n - 2, 1 + (m.missing ?? 0));
    for (let i = 0; i < n; i++) {
      if (i === missing) continue;
      const v0 = (i - n / 2) * FLAT.w;
      P(u - FLAT.t / 2, v0, u + FLAT.t / 2, v0 + FLAT.w, { h, prop: 'flat', face, art: i });
      // (the painted side faces the bigger half of the room; the brace goes out behind, toward the nearer wall)
      if (i % 2 === 0) P(u + face * FLAT.t / 2, v0 + FLAT.w / 2 - 0.06, u + face * (FLAT.t / 2 + FLAT.brace), v0 + FLAT.w / 2 + 0.06, { h: 0.34, prop: 'brace', face });
    }
  } else if (m.kind === 'thicket') {
    // staggered 2.38 m sightline-blocking hedgerow baffles + ceiling-piercing trunks so you weave around blind turns
    if (A < 4.6 || B < 4.8) return null;
    const every = m.every ?? 2.3, n = Math.floor((B - 2.4) / every) + 1;
    if (n < 2) return null;
    const s = 0.46;
    const hReach = Math.min(2.1, A * 0.42);
    for (let i = 0; i < n; i++) {
      const v = (i - (n - 1) / 2) * every;
      const side = i % 2 ? -1 : 1;
      if (A >= 5.2 && hReach >= 1.15) {
        const hx0 = side < 0 ? -A / 2 + 1.05 : A / 2 - 1.05 - hReach;
        const hx1 = side < 0 ? -A / 2 + 1.05 + hReach : A / 2 - 1.05;
        P(hx0, v - 0.21, hx1, v + 0.21, { h: 2.38, prop: 'hedge' });
        const tx = side < 0 ? hx1 + 0.28 : hx0 - 0.28;
        if (Math.abs(tx) < A / 2 - 1.05) {
          P(tx - s / 2, v - s / 2, tx + s / 2, v + s / 2, { prop: 'trunk', bark: i % 3 === 0 ? 'birch' : 'pine' });
        }
      } else {
        const u = A * (side * 0.18 + (m.shift ?? 0) * 0.35);
        if (Math.abs(u) <= A / 2 - 1.15) {
          P(u - s / 2, v - s / 2, u + s / 2, v + s / 2, { prop: 'trunk', bark: i % 3 === 0 ? 'birch' : 'pine' });
        }
      }
    }
  } else if (m.kind === 'nibs') {
    // a corridor: piers in pairs, one each side, the same distance apart all the way down
    if (A < 1.7 || A >= NARROW || B < 4.4) return null;
    const dp = A >= 2.4 ? 0.3 : 0.2, every = m.every ?? 1.9, n = Math.floor((B - 1.6) / every) + 1, shift = (m.phase ?? 0) * every * 0.5;
    if (n < 2) return null;
    for (let i = 0; i < n; i++) {
      const v = (i - (n - 1) / 2) * every + shift;
      if (Math.abs(v) > B / 2 - 0.5) continue;
      P(-A / 2, v - 0.12, -A / 2 + dp, v + 0.12); P(A / 2 - dp, v - 0.12, A / 2, v + 0.12);
    }
  } else if (m.kind === 'baffle') {
    // a corridor: a stub from one wall, then one from the other, each leaving a body's width and a bit
    if (A < 2.6 || A >= NARROW + 0.6 || B < 5) return null;
    const reach = Math.min(A - 1.3, A * (m.reach ?? 0.52)), every = m.every ?? 2.1, n = Math.floor((B - 2.6) / every) + 1;
    if (n < 2 || reach < 0.8) return null;
    for (let i = 0; i < n; i++) {
      const v = (i - (n - 1) / 2) * every;
      if (i % 2) P(A / 2 - reach, v - WALL / 2, A / 2, v + WALL / 2); else P(-A / 2, v - WALL / 2, -A / 2 + reach, v + WALL / 2);
    }
  } else return null;
  if (!out.pillars.length) return null;
  return out;
}

/* ---- the workstation in the carpet -------------------------------------------------------------------- */

// the catalogue's own bounds, in voxels (props/office.js): planning it needs no meshing
const BOUNDS = { desk: [-32, 0, -16, 32, 26, 16], chair: [-13, 0, -10, 13, 39, 10], crt: [-10, 0, -9, 10, 20, 9], keyboard: [-12, 0, -4, 12, 3, 4], mouse: [-2, 0, -3, 2, 3, 9] };
// where the monitor, keyboard and mouse sit on a desk, in voxels (props/office.js DESK), and which way each faces on it
const ON_DESK = [['crt', [-3, 26, 5], 2], ['keyboard', [-3, 26, -10], 2], ['mouse', [12, 26, -10], 0]];
function footOf(type, x, z, q) {
  const b = BOUNDS[type], c = [];
  for (const vx of [b[0], b[3]]) for (const vz of [b[2], b[5]]) c.push(turnPt(vx * VOXEL, vz * VOXEL, q));
  return { x0: r4(x + Math.min(...c.map((p) => p.x))), z0: r4(z + Math.min(...c.map((p) => p.z))), x1: r4(x + Math.max(...c.map((p) => p.x))), z1: r4(z + Math.max(...c.map((p) => p.z))) };
}
/**
 * A workstation sunk SUNK metres into the carpet, its desk centred at (x, z), turned by q quarter turns (0: the desk's long side
 * across the room, its chair toward +z). → { props, blocks } in the room's frame. Full size: nothing is scaled.
 */
export function sunk(x, z, q) {
  const props = [], blocks = [];
  const add = (type, px, pz, y, quarter) => { props.push({ type, x: r4(px), z: r4(pz), y: r4(y), rot: r4((quarter % 4) * Math.PI / 2) }); };
  add('desk', x, z, SUNK, q);
  // (the chair pulled out on the keyboard's side, facing the way the desk does: as the study placed it)
  const ch = turnPt(0, -0.95, q); add('chair', x + ch.x, z + ch.z, SUNK, q);
  for (const [type, [vx, vy, vz], k] of ON_DESK) { const o = turnPt(vx * VOXEL, vz * VOXEL, q); add(type, x + o.x, z + o.z, SUNK + vy * VOXEL, q + k); }
  blocks.push(footOf('desk', x, z, q), footOf('chair', x + ch.x, z + ch.z, q));
  return { props, blocks };
}

/* ---- does it fit? --------------------------------------------------------------------------------------- */

/** The room's floor as a walker meets it, with a plan laid over it: can a body of the walker's radius stand at (x, z)? */
export function standable(room, x, z, plan = room) {
  if (Math.abs(x) > room.W / 2 - BODY || Math.abs(z) > room.D / 2 - BODY || !fitsAt(room, x, z, BODY)) return false;
  if (headOf(room, x, z, plan) < HEAD) return false;
  const hit = (q) => { const dx = x - Math.max(q.x0, Math.min(x, q.x1)), dz = z - Math.max(q.z0, Math.min(z, q.z1)); return dx * dx + dz * dz < BODY * BODY; };
  for (const p of plan.pillars || []) if (!(p.y0 > HEAD) && hit(box(p))) return false;
  for (const b of plan.blocks || []) if (hit(b)) return false;
  return true;
}
const headOf = (room, x, z, plan) => {
  let h = headAt(room, x, z);
  if (plan !== room) for (const l of plan.lows || []) if (x >= l.x0 && x <= l.x1 && z >= l.z0 && z <= l.z1) h = Math.min(h, l.h);
  return h;
};
/**
 * Can every doorway of the room be walked to from every other with this plan in it (rule 5), on the 12.5 cm grid the level is
 * walked on, ducking under whatever is low? And is the floor just inside each doorway clear, and every flight of stairs?
 */
export function fits(room, plan) {
  const all = { pillars: [...(room.pillars || []), ...plan.pillars], lows: [...(room.lows || []), ...(plan.lows || [])], blocks: [...(room.blocks || []), ...(plan.blocks || [])] };
  const pad = (q, m) => ({ x0: q.x0 - m, z0: q.z0 - m, x1: q.x1 + m, z1: q.z1 + m });
  for (const d of room.doors) {
    // a doorway keeps a metre of clear floor in front of it, a little wider than itself: the whole of that floor, not
    // points on it (the end of a partition is twenty centimetres across, and stood between any five points one tried)
    const a = wallPoint(room, d.side, d.c - (d.w + 0.4) / 2, 0.15), b = wallPoint(room, d.side, d.c + (d.w + 0.4) / 2, 1.0);
    const zone = { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) };
    if ([...plan.pillars.map(box), ...(plan.blocks || [])].map((q) => pad(q, 0.05)).some((q) => q.x1 > zone.x0 && q.x0 < zone.x1 && q.z1 > zone.z0 && q.z0 < zone.z1)) return false;
  }
  for (const s of stairZones(room, 0.6)) if ([...plan.pillars.map(box), ...(plan.blocks || [])].some((q) => q.x1 > s.x0 && q.x0 < s.x1 && q.z1 > s.z0 && q.z0 < s.z1)) return false;
  if (!room.doors.length) return true;
  const cell = 0.125, nx = Math.ceil(room.W / cell), nz = Math.ceil(room.D / cell);
  const at = (i, j) => ({ x: -room.W / 2 + (i + 0.5) * cell, z: -room.D / 2 + (j + 0.5) * cell });
  const key = (p) => Math.floor((p.x + room.W / 2) / cell) + nx * Math.floor((p.z + room.D / 2) / cell);
  const ok = new Map(), free = (k, p) => { if (!ok.has(k)) ok.set(k, standable(room, p.x, p.z, all)); return ok.get(k); };
  const starts = room.doors.map((d) => key(wallPoint(room, d.side, d.c, 0.5)));
  const seen = new Uint8Array(nx * nz), queue = [starts[0]];
  seen[starts[0]] = 1;
  while (queue.length) {
    const k = queue.pop(), i = k % nx, j = (k - i) / nx, here = at(i, j), hy = floorAt(room, here.x, here.z);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj, kk = ii + nx * jj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || seen[kk]) continue;
      const there = at(ii, jj);
      if (!free(kk, there) || Math.abs(floorAt(room, there.x, there.z) - hy) > STEP) continue;
      seen[kk] = 1; queue.push(kk);
    }
  }
  return starts.every((k) => seen[k] === 1);
}

/**
 * A motif that is the same small thing over and over (piers, stubs, columns) does not have to be given up because one
 * of them would stand in a doorway: that one is left out, as a builder would have. → the plan without them, or null if
 * too few are left for it to read as a row of anything.
 */
export function pruned(room, plan, least = 3) {
  const zones = [];
  for (const d of room.doors) { const a = wallPoint(room, d.side, d.c - d.w / 2 - 0.35, 0), b = wallPoint(room, d.side, d.c + d.w / 2 + 0.35, 1.15); zones.push({ x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) }); }
  zones.push(...stairZones(room, 0.6));
  const pillars = plan.pillars.filter((p) => { const q = box(p); return !zones.some((k) => q.x1 > k.x0 && q.x0 < k.x1 && q.z1 > k.z0 && q.z0 < k.z1); });
  return pillars.length >= least ? { ...plan, pillars } : null;
}

/** A room's layout in a word, for the tests and the plan: its size (smaller side first) and what is in it. */
export const layoutOf = (room) => `${Math.min(room.W, room.D).toFixed(1)}x${Math.max(room.W, room.D).toFixed(1)}:${room.quiet ? room.quiet.kind : room.shape ? room.shape.kind : 'bare'}`;
