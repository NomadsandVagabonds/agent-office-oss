// Interoffice Mail (`in-tray`): where everything is. Pure numbers, no three.js: the builder, the deck entry's stash and
// the test all read the same plan. Do not import gen.js here.
//
// The room's own frame (docs/BACKROOMS.md): x across, z deep, you come in at z = +D/2 looking at the back. Everything
// here is worked out in `u`, which is x turned so that the way down is always on +u: x = side · u. Three letter trays
// the size of offices stand against the back wall, one on another:
//
//   top      floor Y2, its office to the room's own ceiling. Dressed only: you see it, nobody walks in it.
//   middle   floor Y1, pulled forward of the others (`pull`); its thumb-notched lip meets a carpeted landing that a
//            short stair climbs to from the atrium floor. The way in.
//   lower    the room's own floor. Its back part (`band`) is walked: a divider stands across it under the middle
//            office's back wall; the rest, under the middle office, is seen over its lip and never walked.
//
// The floor is one height at any spot (world.js floorY), so the two offices that are walked must not lie over one
// another: the middle office is the band's depth shallower than the lower one, and its back wall stands over the
// divider. The way: up the stair onto the landing, through the notch into the middle office, round the back of its
// short sidewall into the gap at the side, down the stair in the gap, through the opening at the back of the lower
// tray's sidewall into the lower office, and out by its door (the room's back doorway, when the floor gave it one).

export const TRAY = Object.freeze({
  T: 0.1,            // a sidewall, a back wall, a lip: how thick
  plate: 0.14,       // a tray's floor plate
  Y1: 2.3,           // the middle office's carpet (ten risers of RISE)
  Y2: 4.64,          // the top office's carpet
  rise: 0.23,        // every step in the room: under world.js STEP (0.26)
  upRun: 0.3, downRun: 0.28, steps: 10,
  gap: 1.4,          // the gap at the side the stair goes down in, from the lower and middle sidewalls to the room's wall
  thin: 0.4,         // and on the other side, too narrow to go into
  lowDeep: 6.2,      // the lower tray, back wall to lip
  pull: 0.9,         // how much further forward the middle tray's lip is
  topBack: 0.5,      // how much less far the top one comes
  topShift: 0.5,     // and how far it sits over to the side of the gap
  band: 3.8,         // the part of the lower office that is walked, from the back wall
  mezz: 2.0,         // the landing, from the middle lip toward the door you came in by
  notch: 1.0,        // half the flat of the middle lip's thumb notch (walkable)
  lip: 1.0,          // the lips' height either side of the notch
});

/** The whole plan, in the room's frame, from its size and its roll (`p.side` ±1: the side the way down is on). */
export function layout(W, D, H, p = {}) {
  const t = TRAY, s = p.side === -1 ? -1 : 1, T = t.T, zb = -D / 2;
  const us = W / 2 - t.gap, uo = -(W / 2 - t.thin);                 // the inner faces of the lower and middle sidewalls
  const zl = zb + t.lowDeep, zm = zl + t.pull, zt = zm - t.topBack, zd = zb + t.band;
  const uc = (uo + us) / 2, CL = t.Y1 - t.plate, CM = t.Y2 - t.plate;
  const mezz = { u0: uc - 2.6, u1: uc + 1.6, z0: zm, z1: zm + t.mezz };
  const up = { u0: uc - 0.1, u1: uc + 1.5, z0: mezz.z1, z1: mezz.z1 + (t.steps - 1) * t.upRun };
  const down = { u0: us + T, u1: W / 2, z0: zd - (t.steps - 1) * t.downRun, z1: zd };
  return {
    s, zb, zl, zm, zt, zd, us, uo, uc, CL, CM, H,
    Y1: t.Y1, Y2: t.Y2,
    top: { uo: uo + t.topShift, us: us + t.topShift, zf: zt },
    mezz, up, down,
    ledge: { u0: us + T, u1: W / 2, z0: zd, z1: zm },                 // the gap at Y1, from the turn to the front
    hole: { z0: zb + 0.15, z1: zb + 1.25, h: 2.0 },                    // the opening at the back of the lower sidewall
    turn: { z0: zd, z1: zd + 1.2, h: 2.1 },                            // and the middle one's: round the back of it
    desk: { u0: uc - 2.5, u1: uc - 1.2, z0: mezz.z1 - 0.85, z1: mezz.z1 - 0.15 },
    notch: { u0: uc - t.notch, u1: uc + t.notch },
    x: (u) => s * u,
  };
}

/** The height of the floor at (u, z), as the room is walked (a spot the plan does not raise is the room's own floor). */
export function floorIn(L, u, z, base = 0) {
  const t = TRAY, inside = (r) => u >= r.u0 && u <= r.u1 && z >= r.z0 && z <= r.z1;
  if (z >= L.zd && z <= L.zm && u >= L.uo - t.T) return L.Y1;                      // the middle office, its lip, the ledge
  if (inside(L.mezz)) return L.Y1;
  if (inside(L.up)) return L.Y1 - (Math.min(t.steps - 1, Math.floor((z - L.up.z0) / t.upRun)) + 1) * t.rise;
  if (inside(L.down)) return L.Y1 - (Math.min(t.steps - 1, Math.floor((L.down.z1 - z) / t.downRun)) + 1) * t.rise;
  return base;
}

/** The ceiling over (u, z) for someone standing on `floor` there. */
export function ceilIn(L, u, z, floor) {
  const t = TRAY;
  if (floor < 1 && z <= L.zm && u >= L.uo - t.T && u <= L.us + t.T) return L.CL;   // under the middle tray
  if (floor < L.Y2 - 0.5 && z <= L.top.zf && u >= L.top.uo - t.T && u <= L.top.us + t.T) return L.CM;   // under the top one
  return L.H;
}

/** Where a battery or a snack left in this room goes: the far corner of the lower office's walked part. */
export function inTrayStash(room) {
  const L = layout(room.W, room.D, room.H, room.params || {}), a = L.x(L.uo + 0.35), b = L.x(L.uo + 1.05);
  return [Math.min(a, b), L.zb + 0.45, Math.max(a, b), L.zb + 1.15];
}
