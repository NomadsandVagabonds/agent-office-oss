// The Backrooms — a room lit from the floor (a preview: docs/BLOCKROOMS-PREVIEWS.md "Floor lights").
//
// The owner: "what about one level where the florecent lights are on the floor facing up?" The room's tubes are let into
// the carpet where its ceiling panels would have been, shining up; the ceiling tiles are dark and catch the light in
// pools over each panel; what stands in the room is lit from underneath (the underside of the table, a chin, the inside
// of a lampshade) and throws its shadow up the walls and across the ceiling.
//
// Everything is the level's ordinary light: c.fitting with `mount: 'floor'` (world.js) puts the shell's flat panel in
// the floor facing up and turns its baked lamp's lobe up; the bake (kit.js) does the rest, at every tier. What the bake
// has no shadow for (it has none at all at Classic and Low, and at Medium and High its light map covers only the floor
// and walls) is drawn here once, at build time, as soft blots (c.blot): each thing's top, seen from each panel near it,
// on the ceiling; and, where there is no light map, the thing itself on the wall behind it. Nothing is done per frame.
// A body in the room is tinted by what reaches its underside (rt.uplit: world.js lightAt, c.sample).
//
// Nothing here reads the room's seeded stream: where the panels go is where the room's ceiling panels were (gen.js
// rolled those), and anything else is a fixed choice. Only with the dev page's &preview=floorlight.
//
//   uplit(c) → null without the flag; else { shell (c.shell's options), panel(x, z, o), spot(x, z, o), panels(avoid),
//     stands(box), done() }. Call done() once everything is in the room.
// (it imports nothing: world.js takes FLOOR_LIT from here, and nothing that world.js reads may pull three.js in behind it)

/** Is a preview asked for (the dev page's &preview=…)? Off everywhere else, the game included (as clipping.js has it). */
export const previewing = (c, name) => !!c.env?.preview?.has?.(name);

export const FLOOR_LIT = Object.freeze({
  lift: 0.004,            // the panel's face over the carpet (it sits in a steel frame a little proud of it)
  lamp: 0.12,             // its baked lamp, over the panel
  amb: 0.08,              // the room's own ambient light, times this: the light is the panels', and the dark between them
  spill: 0.5,             // and the light from a brighter room next door through its doorways (it would light the walls high up)
  // a panel's lamp, against a ceiling panel's: brighter by `gain` but falling off much sooner (k), and nearly as bright
  // sideways as up (floor), so the walls are lit low down by the panels near them and go dark towards the ceiling
  gain: 3.4, k: 0.12, floor: 0.8,
  wall: [0.72, 0.7, 0.68], // the wallpaper, a little darker: so the light low on it shows, and a face against it
  ceil: [0.2, 0.19, 0.185],// the ceiling tiles' albedo: dark, so the panels' pools on it read and nothing glares
  rim: 0.045,             // the steel frame round a panel, and how high it stands
  rimH: 0.008,
  steel: [0.22, 0.23, 0.24],
  reach: 2.4,             // a panel throws a thing's shadow only if it is this close (its middle, across the floor)
  ceilA: 0.8,             // how dark the shadow on the ceiling is, at most
  wallA: 0.9,             // and on a wall (only without a light map: Classic, Low)
  upper: 0.4,             // on a wall, only what is above this share of a thing's height (its head and shoulders: what reads)
  most: 5,                // a shadow more than this many times the thing's own size is too faint to draw
});

const PANEL = [0.3, 0.6];  // the shell's flat panel: half across, half along (TILE / 2, TILE)
// where a panel goes when it cannot go under where it hung: half a tile at a time across, then along, then both, to 1.2 m
const NUDGE = [[0, 0]];
for (const k of [0.3, 0.6, 0.9, 1.2]) NUDGE.push([k, 0], [-k, 0], [0, k], [0, -k]);
for (const k of [0.6, 1.2]) NUDGE.push([k, k], [-k, k], [k, -k], [-k, -k]);

/** Is (x, z) on flat floor at the room's level, all over a w × d rectangle? */
function flat(c, x0, z0, x1, z1) {
  for (const x of [x0, (x0 + x1) / 2, x1]) for (const z of [z0, (z0 + z1) / 2, z1]) if (Math.abs(c.floorAt(x, z)) > 0.005) return false;
  return true;
}
const meets = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

/**
 * Where a box's shadow falls from a lamp at L onto the plane axis = at (0 x, 1 y, 2 z): the box of its corners pushed
 * from L to the plane, for the corners that are between the lamp and the plane. Pure. → { lo, hi, ks (how much bigger
 * than the box, along each), k (the most of those) } over the plane's two other axes (in x, y, z order), or null when the
 * box is not between them.
 */
export function project(L, box, axis, at) {
  const P = [L.x, L.y, L.z], lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const toPlane = at - P[axis];
  let n = 0;
  for (const x of [box.x0, box.x1]) for (const y of [box.y0, box.y1]) for (const z of [box.z0, box.z1]) {
    const Q = [x, y, z], toQ = Q[axis] - P[axis];
    if (Math.abs(toQ) < 0.02 || Math.sign(toQ) !== Math.sign(toPlane) || Math.abs(toQ) >= Math.abs(toPlane)) continue;   // (beside the lamp, behind it, or past the plane)
    const t = toPlane / toQ;
    for (let a = 0; a < 3; a++) { const v = P[a] + (Q[a] - P[a]) * t; lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v); }
    n++;
  }
  if (n < 2) return null;
  const other = [0, 1, 2].filter((a) => a !== axis), size = (a) => Math.max(0.05, a === 0 ? box.x1 - box.x0 : a === 1 ? box.y1 - box.y0 : box.z1 - box.z0);
  const ks = other.map((a) => (hi[a] - lo[a]) / size(a));
  return { lo: other.map((a) => lo[a]), hi: other.map((a) => hi[a]), k: Math.max(...ks), ks };
}

/** The shadows the panels throw up: each thing near each lit panel, on the ceiling, and (without a light map) on the walls. */
export function throwUp(c, lamps, things) {
  const { W, D } = c, out = [];
  const mapped = c.kit.gfx?.shadows > 0;                 // (the light map has the walls' shadows already: medium and high)
  for (const b of things) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    for (const L of lamps) {
      const far = Math.hypot(L.x - cx, L.z - cz);
      if (L.dead || far > FLOOR_LIT.reach || b.y1 < L.y + 0.1) continue;
      const near = 1 - far / FLOOR_LIT.reach, top = c.ceilAt(cx, cz);
      // the ceiling: the top of it, as the panel sees it
      const ceil = project(L, { ...b, y0: b.y1 - 0.01 }, 1, top);
      if (ceil && ceil.k < FLOOR_LIT.most) {
        const x0 = Math.max(ceil.lo[0], -W / 2), x1 = Math.min(ceil.hi[0], W / 2), z0 = Math.max(ceil.lo[1], -D / 2), z1 = Math.min(ceil.hi[1], D / 2);
        if (x1 - x0 > 0.05 && z1 - z0 > 0.05) {
          const a = FLOOR_LIT.ceilA * near * (L.power ?? 1) / Math.sqrt(ceil.k);
          c.blot((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.2, z1 - z0 + 0.2, { a, down: true, y: top - 0.004 });
          out.push({ on: 'ceiling', x0, z0, x1, z1, a });
        }
      }
      if (mapped) continue;
      // the walls: the upper part of it, on whichever wall is behind it as the panel sees it
      const hi = { ...b, y0: b.y0 + (b.y1 - b.y0) * FLOOR_LIT.upper };
      for (const [side, axis, at] of [['back', 2, -D / 2], ['front', 2, D / 2], ['left', 0, -W / 2], ['right', 0, W / 2]]) {
        const s = project(L, hi, axis, at), spread = s ? s.ks[axis === 2 ? 0 : 1] : Infinity;     // (how much wider than it: up the wall it runs into the ceiling)
        if (spread > FLOOR_LIT.most) continue;
        const along = axis === 2 ? [s.lo[0], s.hi[0]] : [s.lo[1], s.hi[1]], ys = axis === 2 ? [s.lo[1], s.hi[1]] : [s.lo[0], s.hi[0]];
        const a0 = Math.max(along[0], axis === 2 ? -W / 2 : -D / 2), a1 = Math.min(along[1], axis === 2 ? W / 2 : D / 2);
        const y0 = Math.max(0, ys[0]), y1 = Math.min(c.ceilAt(axis === 2 ? (a0 + a1) / 2 : at, axis === 2 ? at : (a0 + a1) / 2), ys[1]);
        if (a1 - a0 < 0.1 || y1 - y0 < 0.3) continue;
        const a = FLOOR_LIT.wallA * near * (L.power ?? 1) / Math.sqrt(spread);
        c.blot((a0 + a1) / 2, (y0 + y1) / 2, a1 - a0 + 0.16, y1 - y0 + 0.16, { a, wall: side });
        out.push({ on: side, a0, a1, y0, y1, a });
      }
    }
  }
  return out;
}

/** The room lit from its floor, under &preview=floorlight; null otherwise (and then nothing of the room is touched). */
export function uplit(c) {
  if (!previewing(c, 'floorlight')) return null;
  const rt = c.rt, lamps = [], things = [];
  rt.uplit = true;
  rt.amb = rt.amb.map((v) => v * FLOOR_LIT.amb);
  const frame = (x0, z0, x1, z1) => {
    const r = FLOOR_LIT.rim, h = FLOOR_LIT.rimH, steel = FLOOR_LIT.steel, f = c.flat;
    f.box(x0 - r, 0, z0 - r, x1 + r, h, z0, steel, { skip: '-y' }); f.box(x0 - r, 0, z1, x1 + r, h, z1 + r, steel, { skip: '-y' });
    f.box(x0 - r, 0, z0, x0, h, z1, steel, { skip: '-y' }); f.box(x1, 0, z0, x1 + r, h, z1, steel, { skip: '-y' });
  };
  const up = {
    shell: { panels: false, ceilAlb: FLOOR_LIT.ceil, wallAlb: FLOOR_LIT.wall },
    lamps, things, panelsAt: [],
    /** One of the room's tubes, let into the floor at (x, z). o: rot, dead, flick (as c.fitting) · power (its lamp's, for the shadows: 1). */
    panel(x, z, o = {}) {
      const turn = Math.abs(Math.round((o.rot || 0) / (Math.PI / 2))) % 2 === 1, [hx, hz] = turn ? [PANEL[1], PANEL[0]] : PANEL;
      const head = Math.min(2.5, Math.max(0.3, c.ceilAt(x, z) / 2.6)), power = 1.05 * c.room.light.power * Math.pow(head, 1.5) * FLOOR_LIT.gain;
      c.fitting(x, z, { light: { power, k: FLOOR_LIT.k * head, floor: FLOOR_LIT.floor }, ...o, mount: 'floor' });
      frame(x - hx, z - hz, x + hx, z + hz);
      up.panelsAt.push({ x0: x - hx, z0: z - hz, x1: x + hx, z1: z + hz });
      lamps.push({ x, y: FLOOR_LIT.lamp, z, dead: !!o.dead, power: 1 });
    },
    /** A small uplight let into the floor (a can, turned up), lighting what is over it: o.tube, o.light { power, k, far, floor }. */
    spot(x, z, o = {}) {
      c.fitting(x, z, { ...o, kind: 'can', mount: 'floor', bloom: o.bloom ?? 0.6 });
      const r = 0.07; frame(x - r, z - r, x + r, z + r);
      lamps.push({ x, y: FLOOR_LIT.lamp, z, dead: !!o.dead, power: Math.min(1, (o.light?.power ?? 0.5) * 1.6) });
    },
    /** The room's own ceiling panels, each let into the floor under where it hung — or, where that would meet one of
     * `avoid` (rects in the room's frame: plinths, a figure's own panel) or another panel, the nearest place half a tile
     * or more across or along that does not; never off flat floor or on the stairs up to a raised doorway. */
    panels(avoid = []) {
      const steps = c.room.doors.filter((dr) => (dr.sill || 0) > 0.05).map((dr) => c.wallAt(dr.side, dr.c, 0.6));
      const ok = (r) => !avoid.some((a) => meets(r, a)) && !up.panelsAt.some((a) => meets(r, a)) && Math.abs(r.x0) <= c.W / 2 - 0.3 && Math.abs(r.x1) <= c.W / 2 - 0.3
        && Math.abs(r.z0) <= c.D / 2 - 0.3 && Math.abs(r.z1) <= c.D / 2 - 0.3 && flat(c, r.x0, r.z0, r.x1, r.z1);
      for (const p of c.room.panels) {
        const at = NUDGE.map(([dx, dz]) => ({ x: p.x + dx, z: p.z + dz })).find((q) => ok({ x0: q.x - PANEL[0] - 0.05, z0: q.z - PANEL[1] - 0.05, x1: q.x + PANEL[0] + 0.05, z1: q.z + PANEL[1] + 0.05 })
          && !steps.some((d) => Math.hypot(d.x - q.x, d.z - q.z) < 1.2));
        if (at) up.panel(at.x, at.z, { dead: p.state === 'dead', flick: p.state === 'flicker' });
      }
    },
    /** Something standing in the room whose shadow the panels throw up: { x0, z0, x1, z1, y0, y1 } (its box, the room's frame). */
    stands(box) { if (box && Number.isFinite(box.x0)) things.push({ x0: box.x0, z0: box.z0, x1: box.x1, z1: box.z1, y0: box.y0 ?? box.bottom ?? 0, y1: box.y1 ?? box.top }); },
    /** Once everything is in: the shadows thrown up. */
    done() {
      for (const L of rt.lights) if (L.spill !== undefined) { L.r *= FLOOR_LIT.spill; L.g *= FLOOR_LIT.spill; L.b *= FLOOR_LIT.spill; }
      rt.uplitShadows = throwUp(c, lamps, things);
      return up;
    },
  };
  return up;
}

