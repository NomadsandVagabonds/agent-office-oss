// The Backrooms — the standing meeting's rule. Pure: no three.js, nothing of
// the page.
//
// A long low thing: nine pairs of hips in a row, joined along the top, their
// legs out sideways and bent the wrong way down to the floor, and more legs
// off each end. It has no front and no back, and goes either way. It can see,
// a little, straight out from whichever end is leading. When somebody is in front of it in a clear line it stops and stands
// the front of itself up on end, so that what is underneath is seen: a mouth
// the length of it, and fingers down both sides. Then it comes down, going: dead straight, faster than anybody runs, and
// it cannot turn. Whoever is still in the line when it arrives is run down.
// Whoever has stepped out of the line, through a doorway or round a corner or
// simply aside, watches it go past and into the wall, where it is a while
// getting its legs back under it.

export const MEETING = Object.freeze({
  r: 0.38, tall: 0.95,     // the front of it, which is what walks: low
  parts: 9,                // lengths of it, nose to tail
  gap: 0.36,               // metres between one length and the next
  wide: 0.7,               // metres either side of its middle that it runs down (its legs go further; they go over you)
  files: 1.1,              // metres a second, going about
  charge: 6.2,             // …and coming: a run is 3.7
  sees: 15,                // metres ahead that it sees
  cone: 0.5,               // radians either side of straight ahead
  drum: 1.05,              // seconds it stands up on end before it comes (the warning)
  far: 16,                 // metres at most in one charge
  winded: 2.8,             // seconds getting up after it meets a wall
  spent: 1.2,              // …or after a charge that met nothing
  hurts: 2,
  fire: 3,
});

/** As it is first found: in file. */
export const filing = () => ({ mode: 'files', t: 0, dir: null, run: 0, hit: false });

/** Is a spot ahead of it, in what it sees? (yaw: the way it is going, as atan2(x, z).) */
export function ahead(at, yaw, spot) {
  const dx = spot.x - at.x, dz = spot.z - at.z, d = Math.hypot(dx, dz);
  if (d > MEETING.sees || d < 1e-6) return false;
  const off = Math.atan2(dx, dz) - yaw;
  return Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) <= MEETING.cone;
}

/** Is somebody in its way: within its width of the line it is running, and not behind it? */
export function inLine(at, dir, spot, wide = MEETING.wide) {
  const dx = spot.x - at.x, dz = spot.z - at.z, along = dx * dir.x + dz * dir.z, across = Math.abs(dx * dir.z - dz * dir.x);
  return along > -0.3 && across <= wide;
}

/**
 * A moment of it.
 * @param s  its state
 * @param o  { dt, seen: the visitor is ahead of it in a clear line, to: { x, z } the way to them (a unit vector), went: metres it
 *             got this moment while charging, blocked: it could go no further, touched: it has reached somebody in its line,
 *             fire: a fire is near it or in its way }
 * @returns the next state; `drums` on the moment it stops to, `goes` on the moment it comes, `struck` when it meets a wall,
 *          `took` when it runs somebody down
 */
export function meets(s, o) {
  const { dt, seen = false, to = null, went = 0, blocked = false, touched = false, fire = false } = o;
  let { mode, t, dir, run, hit } = s;
  t += dt;
  if (mode === 'files') {
    if (seen && to && !fire) return { mode: 'drums', t: 0, dir: { x: to.x, z: to.z }, run: 0, hit: false, drums: true };
    return { mode, t, dir: null, run: 0, hit: false };
  }
  if (mode === 'drums') {
    // it is still taking aim while it drums; once it goes, that is the way it goes
    if (fire) return filing();
    if (seen && to) dir = { x: to.x, z: to.z };
    if (t >= MEETING.drum) return { mode: 'charges', t: 0, dir, run: 0, hit: false, goes: true };
    return { mode, t, dir, run, hit };
  }
  if (mode === 'charges') {
    run += went;
    const took = touched && !hit; if (took) hit = true;
    if (blocked) return { mode: 'down', t: 0, dir, run, hit, struck: true, took, rest: MEETING.winded };
    if (run >= MEETING.far) return { mode: 'down', t: 0, dir, run, hit, took, rest: MEETING.spent };
    return { mode, t, dir, run, hit, took };
  }
  // down: getting its legs back under it
  if (t >= (s.rest ?? MEETING.winded)) return filing();
  return { mode, t, dir, run, hit, rest: s.rest };
}

/**
 * Where each length of it is: the front is where it is, and every length behind follows where the one in front has been.
 * @param trail  [{ x, z }] where its front has been, newest first
 * @returns [{ x, z, yaw }] one for each length, nose first
 */
export function lengths(trail, parts = MEETING.parts, gap = MEETING.gap) {
  const out = []; let i = 0, left = 0, px = trail[0].x, pz = trail[0].z, yaw = 0;
  for (let n = 0; n < parts; n++) {
    let need = n === 0 ? 0 : gap;
    while (need > 0 && i < trail.length - 1) {
      const a = trail[i], b = trail[i + 1], seg = Math.hypot(b.x - a.x, b.z - a.z), rest = seg - left;
      if (rest <= need) { need -= rest; i++; left = 0; px = b.x; pz = b.z; if (seg > 1e-6) yaw = Math.atan2(a.x - b.x, a.z - b.z); }
      else { left += need; const k = left / seg; px = a.x + (b.x - a.x) * k; pz = a.z + (b.z - a.z) * k; yaw = Math.atan2(a.x - b.x, a.z - b.z); need = 0; }
    }
    if (need > 0) { px -= Math.sin(yaw) * need; pz -= Math.cos(yaw) * need; }     // (it has not been anywhere yet: laid out straight behind)
    out.push({ x: px, z: pz, yaw });
  }
  return out;
}
